// PerspectiveGroundRenderer.js  (v8)
//
// Full DOM-canvas renderer with:
//   - Layer 0: trapezoid-warped ground  (pgr-ground,   z-index:1)
//   - Layer 1: upright billboard tiles  (pgr-objects,  z-index:2)
//   - Player:  drawn in row-order so near objects occlude them correctly
//   - Lighting: radial gradient DOM overlay (pgr-light, z-index:3)
//
// Phaser canvas sits at z-index:10 — UI, joystick, inventory all unaffected.
// Player's Phaser sprite is hidden; PGR owns all player rendering.
//
// Usage:
//   const pgr = new PerspectiveGroundRenderer(scene)
//   pgr.setPlayer(this.player)   ← call after initializeLocation()
//
// Tuning constants (adjust to taste):
//   TILES_ACROSS      — fewer = more zoomed in
//   CAMERA_ROW_OFFSET — lower = horizon closer to player
//   FOCAL_LENGTH      — lower = more dramatic vanishing point
//   HORIZON_Y_FRAC    — higher = more sky visible
//   HEIGHT_MULTIPLIER — taller object billboards
//   LIGHT_RADIUS      — how far the player light reaches (0..1, fraction of screen)
//   LIGHT_DARKNESS    — how dark unlit areas are (0=transparent, 1=black)

export default class PerspectiveGroundRenderer {

  static DEBUG_RECTS = false

  // ── Perspective ───────────────────────────────────────────────────────────
  static CAMERA_ROW_OFFSET = 12
  static TILES_ACROSS      = 5
  static PLAYER_DIST_TILES = 5
  static FOCAL_LENGTH      = 14
  static HORIZON_Y_FRAC    = 0.25
  static HEIGHT_MULTIPLIER = 1.5

  // ── Lighting ──────────────────────────────────────────────────────────────
  static LIGHT_RADIUS   = 0.25   // fraction of screen half-diagonal
  static LIGHT_DARKNESS = 0.82   // opacity of dark area (0=none, 1=pitch black)
  static LIGHT_COLOR    = 'rgba(255, 240, 180, 0.18)'  // warm inner glow tint

  // ── Tileset ───────────────────────────────────────────────────────────────
  static TW         = 24
  static TH         = 24
  static MG         = 24
  static SHEET_COLS = 54
  static TILESET_URL = '/assets/oryx/oryx_16bit_fantasy_world_trans.png'

  // ─────────────────────────────────────────────────────────────────────────

  constructor(scene) {
    this.scene           = scene
    this._player         = null   // set via setPlayer()
    this._playerCanvas   = null   // offscreen canvas of current player frame
    this._playerFrameKey = null   // track frame changes

    const phaserCanvas   = scene.game.canvas
    this._sw             = phaserCanvas.width
    this._sh             = phaserCanvas.height
    this.tileDisplaySize = 48   // TW * SCALE = 24 * 2

    this._tilesetImg = null
    this._tileCache  = new Map()
    this._ready      = false

    // Load tileset
    if (PerspectiveGroundRenderer.DEBUG_RECTS) {
      this._ready = true
    } else {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        this._tilesetImg = img
        this._ready      = true
        this._lastCamX   = null
        this._lastCamY   = null
        console.log('[PGR v8] tileset ready —', img.width, 'x', img.height)
      }
      img.onerror = e => console.error('[PGR v8] tileset load failed', e)
      img.src = PerspectiveGroundRenderer.TILESET_URL
    }

    // ── DOM layer stack ───────────────────────────────────────────────────
    const container = phaserCanvas.parentNode

    // Push Phaser canvas to z-index:10 (UI lives here — untouched)
    Array.from(container.querySelectorAll('canvas')).forEach(c => {
      c.style.position   = 'absolute'
      c.style.top        = '0'
      c.style.left       = '0'
      c.style.zIndex     = '10'
      c.style.background = 'transparent'
    })

    this._groundCanvas  = this._makeCanvas(container, 'pgr-ground',   1)
    this._objectCanvas  = this._makeCanvas(container, 'pgr-objects',  2)
    this._gCtx          = this._groundCanvas.getContext('2d')
    this._oCtx          = this._objectCanvas.getContext('2d')
    this._gCtx.imageSmoothingEnabled = false
    this._oCtx.imageSmoothingEnabled = false

    // Lighting overlay — regular div with radial-gradient background
    this._lightDiv = document.createElement('div')
    this._lightDiv.id = 'pgr-light'
    this._lightDiv.style.cssText = [
      'position:absolute', 'top:0', 'left:0',
      `width:${this._sw}px`, `height:${this._sh}px`,
      'z-index:3', 'pointer-events:none',
    ].join(';')
    container.appendChild(this._lightDiv)

    this._lastCamX    = null
    this._lastCamY    = null
    this._lastCamZoom = null
    this._debugged    = false

    console.log('[PGR v8] constructed —', this._sw, 'x', this._sh)
  }

  _makeCanvas(container, id, zIndex) {
    const c        = document.createElement('canvas')
    c.width        = this._sw
    c.height       = this._sh
    c.id           = id
    c.style.cssText = [
      'position:absolute', 'top:0', 'left:0',
      `z-index:${zIndex}`, 'pointer-events:none',
      'image-rendering:pixelated', 'image-rendering:crisp-edges',
    ].join(';')
    container.appendChild(c)
    return c
  }

  // ── Player registration ───────────────────────────────────────────────────

  setPlayer(player) {
    this._player = player
    // Hide the Phaser sprite — PGR draws the player from now on
    if (player.sprite) {
      player.sprite.setVisible(false)
      // Also hide bow overlay — we'll draw it manually
      if (player.bowOverlay) player.bowOverlay.setVisible(false)
    }
    console.log('[PGR v8] player registered')
  }

  // Build (or rebuild) the offscreen canvas for the current player frame.
  // Called whenever the frame key changes (armor swap, etc.).
  _refreshPlayerCanvas() {
    if (!this._player) return

    const sprite    = this._player.sprite
    if (!sprite) return

    // Determine the current texture + frame
    const texKey    = sprite.texture?.key
    const frameKey  = sprite.frame?.name ?? this._player.currentFrameName
    const cacheKey  = `${texKey}::${frameKey}`
    if (cacheKey === this._playerFrameKey && this._playerCanvas) return

    try {
      // Get the source image from Phaser's texture manager
      const tex       = this.scene.textures.get(texKey)
      const frame     = tex.get(frameKey)
      const src       = tex.getSourceImage()

      const { cutX, cutY, cutWidth, cutHeight } = frame

      const tc        = document.createElement('canvas')
      tc.width        = cutWidth
      tc.height       = cutHeight
      const tCtx      = tc.getContext('2d')
      tCtx.imageSmoothingEnabled = false
      tCtx.drawImage(src, cutX, cutY, cutWidth, cutHeight, 0, 0, cutWidth, cutHeight)

      this._playerCanvas   = tc
      this._playerFrameKey = cacheKey
      console.log('[PGR v8] player canvas refreshed —', cacheKey, cutWidth, 'x', cutHeight)
    } catch(e) {
      console.warn('[PGR v8] could not build player canvas:', e.message)
      this._playerCanvas = null
    }
  }

  // ── Projection ────────────────────────────────────────────────────────────

  _zoom()        { return this.scene.cameras.main.zoom || 1 }
  _horizonPx()   { return Math.floor(this._sh * PerspectiveGroundRenderer.HORIZON_Y_FRAC) }
  _groundH()     { return this._sh - this._horizonPx() }

  _pxPerTileAtPlayer() {
    return (this._sw * this._zoom()) / PerspectiveGroundRenderer.TILES_ACROSS
  }

  _perspCamRow() {
    const c = this.scene.cameras.main, zoom = this._zoom()
    return (c.scrollY + this._sh / (2 * zoom)) / this.tileDisplaySize
         + PerspectiveGroundRenderer.CAMERA_ROW_OFFSET
  }

  _perspCamCol() {
    const c = this.scene.cameras.main, zoom = this._zoom()
    return (c.scrollX + this._sw / (2 * zoom)) / this.tileDisplaySize
  }

  _rowToScreenY(worldRow) {
    const d = this._perspCamRow() - worldRow
    if (d <= 0) return null
    const FL = PerspectiveGroundRenderer.FOCAL_LENGTH
    return this._horizonPx() + this._groundH() * FL / (FL + d)
  }

  _scaleAtRow(worldRow) {
    const d = this._perspCamRow() - worldRow
    if (d <= 0) return 0
    const FL = PerspectiveGroundRenderer.FOCAL_LENGTH
    const PD = PerspectiveGroundRenderer.PLAYER_DIST_TILES
    return this._pxPerTileAtPlayer() * (FL + PD) / (FL + d)
  }

  _colToScreenX(worldCol, worldRow) {
    return this._sw / 2 + (worldCol - this._perspCamCol()) * this._scaleAtRow(worldRow)
  }

  perspectiveProject(worldTileX, worldTileY) {
    const screenY = this._rowToScreenY(worldTileY + 1)
    if (screenY === null || screenY < this._horizonPx() || screenY > this._sh + this.tileDisplaySize) return null
    const scale   = this._scaleAtRow(worldTileY + 1) / this.tileDisplaySize
    const screenX = this._colToScreenX(worldTileX + 0.5, worldTileY + 1)
    return { screenX, screenY, scale }
  }

  // ── applyPerspective (Phaser sprites — NPCs, items, etc.) ─────────────────
  //
  // Still useful for any Phaser GameObjects you want perspective-placed.
  // Pass logical world-pixel coords, NOT sprite.x/y.
  // Sprite origin must be (0.5, 1).

  applyPerspective(sprite, worldPixelX, worldPixelY, tileSize, baseDisplaySize) {
    const proj = this.perspectiveProject(worldPixelX / tileSize, worldPixelY / tileSize)
    if (!proj) { sprite.setVisible(false); return false }
    const cam  = this.scene.cameras.main
    const zoom = this._zoom()
    sprite.setPosition(proj.screenX / zoom + cam.scrollX, proj.screenY / zoom + cam.scrollY)
    const displayPx = Math.round(proj.scale * (baseDisplaySize ?? tileSize * 2) / zoom)
    sprite.setDisplaySize(displayPx, displayPx)
    sprite.setVisible(true)
    return true
  }

  // ── Tile cache ────────────────────────────────────────────────────────────

  _srcRect(gid) {
    const idx = gid - 1
    const col = idx % PerspectiveGroundRenderer.SHEET_COLS
    const row = Math.floor(idx / PerspectiveGroundRenderer.SHEET_COLS)
    const { MG, TW, TH } = PerspectiveGroundRenderer
    return { sx: MG + col * TW, sy: MG + row * TH, sw: TW, sh: TH }
  }

  _getTileCanvas(gid) {
    if (this._tileCache.has(gid)) return this._tileCache.get(gid)
    const { sx, sy, sw, sh } = this._srcRect(gid)
    const tc   = document.createElement('canvas')
    tc.width   = sw;  tc.height = sh
    const tCtx = tc.getContext('2d')
    tCtx.imageSmoothingEnabled = false
    tCtx.drawImage(this._tilesetImg, sx, sy, sw, sh, 0, 0, sw, sh)
    this._tileCache.set(gid, tc)
    return tc
  }

  // ── Affine triangle (ground) ──────────────────────────────────────────────

  _drawAffineTriangle(ctx, img, t0, t1, t2, p0, p1, p2) {
    const { u: u0, v: v0 } = t0, { u: u1, v: v1 } = t1, { u: u2, v: v2 } = t2
    const det = u0*(v1-v2) - u1*(v0-v2) + u2*(v0-v1)
    if (Math.abs(det) < 0.00001) return
    const a = (p0.x*(v1-v2) + p1.x*(v2-v0) + p2.x*(v0-v1)) / det
    const c = (p0.x*(u2-u1) + p1.x*(u0-u2) + p2.x*(u1-u0)) / det
    const e =  p0.x - a*u0 - c*v0
    const b = (p0.y*(v1-v2) + p1.y*(v2-v0) + p2.y*(v0-v1)) / det
    const d = (p0.y*(u2-u1) + p1.y*(u0-u2) + p2.y*(u1-u0)) / det
    const f =  p0.y - b*u0 - d*v0
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y)
    ctx.closePath(); ctx.clip()
    ctx.setTransform(a, b, c, d, e, f)
    ctx.drawImage(img, 0, 0)
    ctx.restore()
  }

  _drawTrapezoid(ctx, gid, tl, tr, bl, br) {
    const img = this._getTileCanvas(gid), W = img.width, H = img.height
    this._drawAffineTriangle(ctx, img, {u:0,v:0},{u:W,v:0},{u:W,v:H}, tl, tr, br)
    this._drawAffineTriangle(ctx, img, {u:0,v:0},{u:W,v:H},{u:0,v:H}, tl, br, bl)
  }

  // ── Billboard (objects + player) ──────────────────────────────────────────

  _drawBillboard(ctx, img, screenX, screenY, scaledTileW, heightMult) {
    const hm      = heightMult ?? PerspectiveGroundRenderer.HEIGHT_MULTIPLIER
    const scaledW = scaledTileW
    const scaledH = scaledTileW * hm
    ctx.drawImage(img, screenX - scaledW / 2, screenY - scaledH, scaledW, scaledH)
  }

  // ── Lighting overlay ──────────────────────────────────────────────────────

  _updateLight(playerScreenX, playerScreenY) {
    const sw      = this._sw
    const sh      = this._sh
    const radius  = Math.sqrt(sw * sw + sh * sh) * PerspectiveGroundRenderer.LIGHT_RADIUS
    const dark    = PerspectiveGroundRenderer.LIGHT_DARKNESS
    const glow    = PerspectiveGroundRenderer.LIGHT_COLOR
    const px      = playerScreenX.toFixed(1)
    const py      = playerScreenY.toFixed(1)
    const r       = radius.toFixed(1)

    // Radial gradient: transparent at player, dark at edges
    this._lightDiv.style.background = [
      `radial-gradient(ellipse ${r}px ${r * 0.6}px at ${px}px ${py}px,`,
      `  ${glow} 0%,`,
      `  transparent 35%,`,
      `  rgba(0,0,0,${dark}) 100%)`
    ].join('\n')
  }

  // ── Main render ───────────────────────────────────────────────────────────

  update() {
    if (!this._ready) return

    const cam  = this.scene.cameras.main
    const zoom = this._zoom()

    if (cam.scrollX === this._lastCamX &&
        cam.scrollY === this._lastCamY &&
        zoom        === this._lastCamZoom &&
        !this._player?.isMoving) return

    this._lastCamX    = cam.scrollX
    this._lastCamY    = cam.scrollY
    this._lastCamZoom = zoom

    // Refresh player canvas if frame changed (armor swap etc.)
    this._refreshPlayerCanvas()

    const sw        = this._sw
    const sh        = this._sh
    const FL        = PerspectiveGroundRenderer.FOCAL_LENGTH
    const horizonPx = this._horizonPx()

    const layer0 = this.scene.mapData?.layers?.[0]
    const layer1 = this.scene.mapData?.layers?.[1] ?? null
    if (!layer0) return

    const mapH   = layer0.length
    const mapW   = layer0[0].length
    const camRow = this._perspCamRow()
    const camCol = this._perspCamCol()

    this._gCtx.clearRect(0, 0, sw, sh)
    this._oCtx.clearRect(0, 0, sw, sh)

    const tileRowEnd   = Math.min(mapH - 1, Math.floor(camRow) - 1)
    const tileRowStart = Math.max(0, Math.floor(camRow - FL * 15))

    // ── Player tile row ───────────────────────────────────────────────────
    // We draw the player when the row loop reaches their tile row,
    // so objects on nearer rows (drawn later) naturally overdraw them.
    const p             = this._player
    const playerTileRow = p ? Math.floor(p.logicalY / this.tileDisplaySize) : -1
    const playerTileCol = p ? p.logicalX / this.tileDisplaySize : -1
    let   playerDrawn   = false

    // Screen position of player (for lighting + sub-tile interpolation)
    let playerScreenX = sw / 2
    let playerScreenY = sh / 2

    if (p) {
      const proj = this.perspectiveProject(playerTileCol, playerTileRow)
      if (proj) {
        playerScreenX = proj.screenX
        playerScreenY = proj.screenY
      }
    }

    let groundCount = 0, objectCount = 0

    for (let tileRow = tileRowStart; tileRow <= tileRowEnd; tileRow++) {

      // ── Ground geometry ─────────────────────────────────────────────────
      const yTop = this._rowToScreenY(tileRow)
      const yBot = this._rowToScreenY(tileRow + 1)

      if (yBot === null) continue
      if (yTop !== null && yTop > sh) continue
      if (yBot < horizonPx) continue

      const yTopClamped = (yTop === null || yTop < horizonPx) ? horizonPx : yTop
      const yBotClamped = Math.min(sh + 2, yBot)
      if (yBotClamped <= yTopClamped) continue

      const scaleNear = this._scaleAtRow(tileRow + 1)
      const halfCols  = scaleNear > 0.001 ? (sw / 2) / scaleNear + 1 : mapW
      const colStart  = Math.max(0,      Math.floor(camCol - halfCols))
      const colEnd    = Math.min(mapW-1, Math.ceil (camCol + halfCols))

      for (let tileCol = colStart; tileCol <= colEnd; tileCol++) {

        // ── Ground tile ─────────────────────────────────────────────────
        const gid0 = layer0[tileRow]?.[tileCol]
        if (gid0) {
          const xTL = this._colToScreenX(tileCol,     tileRow)
          const xTR = this._colToScreenX(tileCol + 1, tileRow)
          const xBL = this._colToScreenX(tileCol,     tileRow + 1)
          const xBR = this._colToScreenX(tileCol + 1, tileRow + 1)

          if (PerspectiveGroundRenderer.DEBUG_RECTS) {
            const colors = ['rgba(255,0,0,0.5)','rgba(0,200,0,0.5)',
                            'rgba(0,100,255,0.5)','rgba(255,200,0,0.5)']
            this._gCtx.fillStyle = colors[tileRow % colors.length]
            this._gCtx.beginPath()
            this._gCtx.moveTo(xTL, yTopClamped); this._gCtx.lineTo(xTR, yTopClamped)
            this._gCtx.lineTo(xBR, yBotClamped); this._gCtx.lineTo(xBL, yBotClamped)
            this._gCtx.closePath(); this._gCtx.fill()
            this._gCtx.strokeStyle = 'rgba(255,255,255,0.25)'
            this._gCtx.lineWidth = 0.5; this._gCtx.stroke()
          } else {
            this._drawTrapezoid(this._gCtx, gid0,
              {x: xTL, y: yTopClamped}, {x: xTR, y: yTopClamped},
              {x: xBL, y: yBotClamped}, {x: xBR, y: yBotClamped})
          }
          groundCount++
        }

        // ── Player (drawn at their tile row, before same-row objects) ───
        // This means objects on the same tile as the player will appear
        // in front of them, and all objects on nearer rows will too.
        if (!playerDrawn && tileRow === playerTileRow && this._playerCanvas && p) {
          const scaledTileW = this._scaleAtRow(playerTileRow + 1)
          this._drawBillboard(
            this._oCtx, this._playerCanvas,
            playerScreenX, playerScreenY,
            scaledTileW, 1.8
          )
          playerDrawn = true
        }

        // ── Object tile (billboard) ─────────────────────────────────────
        if (layer1) {
          const gid1 = layer1[tileRow]?.[tileCol]
          if (gid1) {
            const screenX     = this._colToScreenX(tileCol + 0.5, tileRow + 1)
            const screenY     = this._rowToScreenY(tileRow + 1)
            const scaledTileW = this._scaleAtRow(tileRow + 1)
            if (screenY !== null && screenY >= horizonPx && screenY <= sh + this.tileDisplaySize * 2) {
              this._drawBillboard(this._oCtx, this._getTileCanvas(gid1), screenX, screenY, scaledTileW)
              objectCount++
            }
          }
        }

      } // tileCol
    } // tileRow

    // Fallback: draw player if their row was outside the visible range
    // (shouldn't normally happen but prevents disappearing at map edges)
    if (!playerDrawn && this._playerCanvas && p) {
      const proj = this.perspectiveProject(playerTileCol, playerTileRow)
      if (proj) {
        const scaledTileW = this._scaleAtRow(playerTileRow + 1)
        this._drawBillboard(this._oCtx, this._playerCanvas, proj.screenX, proj.screenY, scaledTileW, 1.8)
      }
    }

    // ── Update lighting overlay ───────────────────────────────────────────
    this._updateLight(playerScreenX, playerScreenY)

    if (!this._debugged) {
      this._debugged = true
      console.log('[PGR v8] first frame —',
        'zoom:', zoom.toFixed(2),
        'perspCamRow:', camRow.toFixed(2),
        'tileRows:', tileRowStart, '→', tileRowEnd,
        'ground:', groundCount, 'objects:', objectCount
      )
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  destroy() {
    this._tileCache.clear()
    ;[this._groundCanvas, this._objectCanvas].forEach(c => {
      if (c?.parentNode) c.parentNode.removeChild(c)
    })
    if (this._lightDiv?.parentNode) this._lightDiv.parentNode.removeChild(this._lightDiv)
    this._groundCanvas = null
    this._objectCanvas = null
    this._lightDiv     = null
    this._gCtx         = null
    this._oCtx         = null
    this._player       = null
    this._playerCanvas = null
    console.log('[PGR v8] destroyed')
  }
}


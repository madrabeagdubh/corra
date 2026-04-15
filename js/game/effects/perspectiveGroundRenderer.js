// PerspectiveGroundRenderer.js  (v8)
//
// Two-canvas architecture:
//   pgr-ground   z-index:1  — layer 0 ground tiles (trapezoid-warped)
//   pgr-objects  z-index:2  — layer 1 tiles as upright billboards + player
//   pgr-light    z-index:3  — radial gradient lighting overlay (DOM div)
//
// Phaser canvas sits at z-index:10 — UI, joystick, inventory all unaffected.
// Player's Phaser sprite is hidden; PGR owns all player rendering.
//
// Player logical coords are tile-centre pixel values (spawn.x * 48 + 24).
// PGR projects these using a -0.5 tile offset so the billboard foot lands
// on the correct tile's ground line, not half a tile south.
//
// Usage:
//   const pgr = new PerspectiveGroundRenderer(scene)
//   pgr.setPlayer(this.player)   ← call after initializeLocation()

export default class PerspectiveGroundRenderer {

  static DEBUG_RECTS = false

  // ── Perspective ───────────────────────────────────────────────────────────
  static CAMERA_ROW_OFFSET    = 10.5
  static TILES_ACROSS         = 6.5
  static PLAYER_DIST_TILES    = 4.1
  static FOCAL_LENGTH         = 7.5
  static HORIZON_Y_FRAC       = 0.3   // sky visible above 30% line
  static HEIGHT_MULTIPLIER    = 1.6

  // ── Lighting ──────────────────────────────────────────────────────────────
  static LIGHT_RADIUS   = 0.45
  static LIGHT_DARKNESS = 0.82
  static LIGHT_COLOR    = 'rgba(255, 240, 180, 0.18)'

  // ── Tileset ───────────────────────────────────────────────────────────────
  static TW         = 24
  static TH         = 24
  static MG         = 24
  static SHEET_COLS = 54
  static TILESET_URL = '/assets/oryx/oryx_16bit_fantasy_world_trans.png'

  // ─────────────────────────────────────────────────────────────────────────

  constructor(scene) {
    this.scene           = scene
    this._player         = null
    this._playerCanvas   = null
    this._playerFrameKey = null
this._encounterFlags = []
    // Nuke any lingering DOM elements from a previous PGR instance.
    // This guards against double-stacking when scene transitions overlap.
    ;['pgr-ground','pgr-objects','pgr-light','pgr-sky','pgr-sky-img','pgr-fog'].forEach(id => {
      const el = document.getElementById(id)
      if (el) el.parentNode?.removeChild(el)
    })

    const phaserCanvas   = scene.game.canvas
    this._sw             = phaserCanvas.width
    this._sh             = phaserCanvas.height
    this.tileDisplaySize = 48   // TW * SCALE = 24 * 2

    this._tilesetImg = null
    this._tileCache  = new Map()
    this._ready      = false

    // Build flat GID set from oryxCatalogue if loaded
    this._flatGids = new Set()
    this._loadCatalogue()

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

    // Set Phaser canvas style directly — targeting phaserCanvas specifically
    // ensures it works on scene transition when new canvases are added later.
    phaserCanvas.style.position   = 'absolute'
    phaserCanvas.style.top        = '0'
    phaserCanvas.style.left       = '0'
    phaserCanvas.style.zIndex     = '10'
    phaserCanvas.style.background = 'transparent'

    this._groundCanvas = this._makeCanvas(container, 'pgr-ground',  1)
    this._objectCanvas = this._makeCanvas(container, 'pgr-objects', 2)
    this._gCtx         = this._groundCanvas.getContext('2d')
    this._oCtx         = this._objectCanvas.getContext('2d')
    this._gCtx.imageSmoothingEnabled = false
    this._oCtx.imageSmoothingEnabled = false

    // Sky + vignette — sits behind everything at z-index:0
    this._skyDiv = this._buildSkyVignette(container)

    // Lighting overlay
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

  // ── Catalogue ─────────────────────────────────────────────────────────
  // Load oryxCatalogue.json from Phaser cache and build _flatGids Set.
  // Call once at construction — catalogue must be preloaded in preload():
  //   this.load.json('oryxCatalogue', '/assets/oryx/oryxCatalogue.json')

  _loadCatalogue() {
    try {
      const catalogue = this.scene.cache.json.get('oryxCatalogue')
      if (!catalogue) {
        console.warn('[PGR] oryxCatalogue not in cache — all layer 1 tiles will be billboards')
        return
      }
      let flatCount = 0
      for (const [gidStr, entry] of Object.entries(catalogue)) {
        if (entry?.flat === true) {
          this._flatGids.add(parseInt(gidStr))
          flatCount++
        }
      }
      console.log(`[PGR] catalogue loaded — ${flatCount} flat GIDs, ${Object.keys(catalogue).length - flatCount} billboard GIDs`)
    } catch(e) {
      console.warn('[PGR] catalogue load failed:', e.message)
    }
  }

  _makeCanvas(container, id, zIndex) {
    const c = document.createElement('canvas')
    c.width  = this._sw
    c.height = this._sh
    c.id     = id
    c.style.cssText = [
      'position:absolute', 'top:0', 'left:0',
      `z-index:${zIndex}`, 'pointer-events:none',
      'image-rendering:pixelated', 'image-rendering:crisp-edges',
    ].join(';')
    container.appendChild(c)
    return c
  }

  // ── Sky + vignette ───────────────────────────────────────────────────────
  //
  // A single CSS div at z-index:0, behind all canvases.
  // Top portion: deep night sky gradient fading toward horizon.
  // Perimeter: dark vignette that hides the hard map edge.
  // No per-frame updates needed — pure CSS.

  _buildSkyVignette(container) {
    const sw = this._sw
    const sh = this._sh

    // ── Sky image ─────────────────────────────────────────────────────────
    // z-index:0 — behind ground canvas (z-index:1) but above container bg.
    // Negative z-index would hide behind the stacking context background.
    const img = document.createElement('img')
    img.id  = 'pgr-sky-img'
    img.src = '/assets/bg0.png'
    img.style.cssText = [
      'position:absolute',
      'top:0',
      'left:0',
      `width:${sw}px`,
      `height:${sh}px`,
      'z-index:0',
      'pointer-events:none',
      'object-fit:cover',
      'object-position:center top',
      'opacity:0.9',
    ].join(';')
    container.appendChild(img)
    this._skyImg = img

    // ── Gradient overlay ──────────────────────────────────────────────────
    // z-index:0 same as sky — sits just above it (appended after).
    const div = document.createElement('div')
    div.id = 'pgr-sky'
    div.style.cssText = [
      'position:absolute',
      'top:0',
      'left:0',
      `width:${sw}px`,
      `height:${sh}px`,
      'z-index:0',
      'pointer-events:none',
      `background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.7) 70%,rgba(0,0,0,0.95) 85%)`,
    ].join(';')

    container.appendChild(div)
    return div
  }

  // ── Lighting overrides ──────────────────────────────────────────────────────
  // Call from scene to override default dark bog lighting
  setLighting({ darkness, radius, groundColour } = {}) {
    if (darkness    != null) this._lightDarkness  = darkness
    if (radius      != null) this._lightRadius    = radius
    if (groundColour != null) this._groundColour  = groundColour
  }

  // ── Player registration ───────────────────────────────────────────────────

  setPlayer(player) {
    this._player = player
    if (player.sprite)      player.sprite.setVisible(false)
    if (player.bowOverlay)  player.bowOverlay.setVisible(false)
    console.log('[PGR v8] player registered')
  }

  // Set player billboard height multiplier (default 1.8)
  setPlayerScale(mult) {
    this._playerHeightMult = mult ?? 1.8
    this._playerFrameKey = null  // force canvas refresh
  }

  // Call this after equipping/unequipping items to force overlay refresh
  invalidatePlayerCanvas() {
    this._playerFrameKey = null
  }

  _refreshPlayerCanvas() {
    if (!this._player?.sprite) return

    const sprite   = this._player.sprite
    const texKey   = sprite.texture?.key
    const frameKey = sprite.frame?.name ?? this._player.currentFrameName
    const cacheKey = `${texKey}::${frameKey}`
    if (cacheKey === this._playerFrameKey && this._playerCanvas) return

    try {
      const tex              = this.scene.textures.get(texKey)
      if (!tex || tex.key === '__MISSING') {
        console.warn('[PGR v8] player texture not found:', texKey)
        return
      }
      const frame            = tex.get(frameKey)
      if (!frame) {
        console.warn('[PGR v8] player frame not found:', frameKey)
        return
      }
      const src              = tex.getSourceImage()
      const { cutX, cutY, cutWidth, cutHeight } = frame

      const tc   = document.createElement('canvas')
      tc.width   = cutWidth
      tc.height  = cutHeight
      const tCtx = tc.getContext('2d')
      tCtx.imageSmoothingEnabled = false
      tCtx.drawImage(src, cutX, cutY, cutWidth, cutHeight, 0, 0, cutWidth, cutHeight)

      // Weapon overlay is drawn separately each frame in _drawWeaponOverlay
      // so it can rotate without invalidating this canvas.

      this._playerCanvas   = tc
      this._playerFrameKey = cacheKey
      console.log('[PGR v8] player canvas refreshed —', cacheKey, cutWidth, 'x', cutHeight)
    } catch(e) {
      console.warn('[PGR v8] could not build player canvas:', e.message)
      this._playerCanvas = null
    }
  }

  // ── Projection ────────────────────────────────────────────────────────────

  _zoom()      { return this.scene.cameras.main.zoom || 1 }
  _horizonPx() { return Math.floor(this._sh * PerspectiveGroundRenderer.HORIZON_Y_FRAC) }
  _groundH()   { return this._sh - this._horizonPx() }

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

  // Project a tile's bottom-centre to screen space.
  // worldTileX/Y are integer tile indices (NOT pixel coords).
  perspectiveProject(worldTileX, worldTileY) {
    const screenY = this._rowToScreenY(worldTileY + 1)
    if (screenY === null || screenY < this._horizonPx() || screenY > this._sh + this.tileDisplaySize) return null
    const scale   = this._scaleAtRow(worldTileY + 1) / this.tileDisplaySize
    const screenX = this._colToScreenX(worldTileX + 0.5, worldTileY + 1)
    return { screenX, screenY, scale }
  }

  // Project logical pixel coords (tile-centre values) to screen space.
  // Subtracts 0.5 tile so the billboard foot lands on the correct tile line,
  // not half a tile south of it.
  _projectLogical(logicalPixelX, logicalPixelY) {
    const ts         = this.tileDisplaySize
    const worldTileX = logicalPixelX / ts - 0.5
    const worldTileY = logicalPixelY / ts - 0.5
    return this.perspectiveProject(worldTileX, worldTileY)
  }

  // ── applyPerspective (Phaser sprites — NPCs etc.) ─────────────────────────

  applyPerspective(sprite, worldPixelX, worldPixelY, tileSize, baseDisplaySize) {
    const proj = this._projectLogical(worldPixelX, worldPixelY)
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

  // ── Affine triangle (ground tiles) ───────────────────────────────────────
  //
  // Each trapezoid is split into two triangles. To eliminate the sub-pixel
  // seam along the shared diagonal, we expand the clip region of each
  // triangle by SEAM_BLEED pixels outward so they overlap slightly.
  // The texture mapping is unchanged — only the clip shape is expanded.

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

    // Expand each triangle clip by 0.75px to cover the sub-pixel seam gap
    const BLEED = 1.75
    const cx    = (p0.x + p1.x + p2.x) / 3
    const cy    = (p0.y + p1.y + p2.y) / 3
    const expand = (p) => ({
      x: p.x + (p.x - cx < 0 ? -BLEED : BLEED),
      y: p.y + (p.y - cy < 0 ? -BLEED : BLEED),
    })
    const e0 = expand(p0), e1 = expand(p1), e2 = expand(p2)

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(e0.x, e0.y); ctx.lineTo(e1.x, e1.y); ctx.lineTo(e2.x, e2.y)
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

  // ── Billboard (object tiles + player) ────────────────────────────────────

  _drawBillboard(ctx, img, screenX, screenY, scaledTileW, heightMult) {
    const hm      = heightMult ?? PerspectiveGroundRenderer.HEIGHT_MULTIPLIER
    const scaledW = scaledTileW
    const scaledH = scaledTileW * hm
    ctx.drawImage(img, screenX - scaledW / 2, screenY - scaledH, scaledW, scaledH)
  }

  // ── Lighting overlay ──────────────────────────────────────────────────────

  _updateLight(playerScreenX, playerScreenY) {
    const sw     = this._sw
    const sh     = this._sh
    const radius = Math.sqrt(sw * sw + sh * sh) * (this._lightRadius ?? PerspectiveGroundRenderer.LIGHT_RADIUS)
    const dark   = this._lightDarkness ?? PerspectiveGroundRenderer.LIGHT_DARKNESS
    const glow   = PerspectiveGroundRenderer.LIGHT_COLOR
    this._lightDiv.style.background = [
      `radial-gradient(ellipse ${radius.toFixed(1)}px ${(radius * 0.6).toFixed(1)}px`,
      ` at ${playerScreenX.toFixed(1)}px ${playerScreenY.toFixed(1)}px,`,
      ` ${glow} 0%, transparent 35%, rgba(0,0,0,${dark}) 100%)`
    ].join('')
  }

  // ── Main render ───────────────────────────────────────────────────────────
  // ── render ───────────────────────────────────────────────────────────────

  update(fov) {
    if (!this._ready) return

    const cam  = this.scene.cameras.main
    const zoom = this._zoom()

    // Also redraw when bow is aiming so weapon rotation updates
    const bowAiming = this.scene.bowMechanics?.isAiming ?? false
    if (cam.scrollX === this._lastCamX &&
        cam.scrollY === this._lastCamY &&
        zoom        === this._lastCamZoom &&
        !this._player?.isMoving &&
        !bowAiming) return

    this._lastCamX    = cam.scrollX
    this._lastCamY    = cam.scrollY
    this._lastCamZoom = zoom

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

    // Fill ground canvas only below the horizon — above is transparent
    // so the sky image behind the canvas shows through.
    const horizonFill = this._horizonPx()
    this._gCtx.clearRect(0, 0, sw, sh)
    this._gCtx.fillStyle = this._groundColour ?? '#2a3a1a'
    this._gCtx.fillRect(0, horizonFill, sw, sh - horizonFill)
    this._oCtx.clearRect(0, 0, sw, sh)

    const tileRowEnd   = Math.min(mapH - 1, Math.floor(camRow) - 1)
    const tileRowStart = Math.max(0, Math.floor(camRow - FL * 15))

    // ── Player projection ─────────────────────────────────────────────────
    // Use _projectLogical to account for the -0.5 tile offset that aligns
    // the billboard foot with the correct ground line.
    const p = this._player
    let playerTileRow   = -1
    let playerScreenX   = sw / 2
    let playerScreenY   = sh / 2
    let playerDrawn     = false

    if (p) {
      const proj = this._projectLogical(p.logicalX, p.logicalY)
      if (proj) {
        playerScreenX = proj.screenX
        playerScreenY = proj.screenY
        // The tile row the player visually sits on (for painter's order)
        playerTileRow = Math.floor(p.logicalY / this.tileDisplaySize - 0.5)
      }
    }

    let groundCount = 0, objectCount = 0

    for (let tileRow = tileRowStart; tileRow <= tileRowEnd; tileRow++) {

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

        // ── Edge fade opacity ───────────────────────────────────────────
        const edgeDist  = Math.min(tileRow, tileCol, mapH - 1 - tileRow, mapW - 1 - tileCol)
        const edgeAlpha = edgeDist === 0 ? 0.08
                        : edgeDist === 1 ? 0.30
                        : edgeDist === 2 ? 0.55
                        : 1.0

        // FOV: skip hidden tiles entirely (fog covers them).
        // Visited tiles draw at full brightness — fog canvas handles dimming.
        if (fov && fov.isHidden(tileCol, tileRow)) continue

        const tileAlpha = edgeAlpha

        // ── Ground tile ─────────────────────────────────────────────────
        const gid0 = layer0[tileRow]?.[tileCol]
        if (gid0) {
          const xTL = this._colToScreenX(tileCol,     tileRow)
          const xTR = this._colToScreenX(tileCol + 1, tileRow)
          const xBL = this._colToScreenX(tileCol,     tileRow + 1)
          const xBR = this._colToScreenX(tileCol + 1, tileRow + 1)

          this._gCtx.globalAlpha = tileAlpha
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
          this._gCtx.globalAlpha = 1.0
          groundCount++
        }

        // ── Player (drawn at their tile row, before same-row objects) ───
        if (!playerDrawn && tileRow === playerTileRow && this._playerCanvas && p) {
          const scaledTileW = this._scaleAtRow(playerTileRow + 1)
          const playerHM = this._playerHeightMult ?? 1.8
          // Draw weapon FIRST (behind player)
          const aimAngle = this.scene.bowMechanics?.isAiming
            ? this.scene.bowMechanics._currentAimAngle ?? null
            : null
          // Weapon behind player
          this._drawWeaponOverlay(playerScreenX, playerScreenY, scaledTileW, aimAngle)
          // Player on top
          this._drawBillboard(this._oCtx, this._playerCanvas,
            playerScreenX, playerScreenY, scaledTileW, playerHM)
          playerDrawn = true
        }

        // ── Object tile — flat or billboard depending on catalogue ────────
        if (layer1) {
          const gid1 = layer1[tileRow]?.[tileCol]
          if (gid1) {
            if (this._flatGids.has(gid1)) {
              // ── FLAT: draw as perspective trapezoid on ground canvas ────
              const xTL = this._colToScreenX(tileCol,     tileRow)
              const xTR = this._colToScreenX(tileCol + 1, tileRow)
              const xBL = this._colToScreenX(tileCol,     tileRow + 1)
              const xBR = this._colToScreenX(tileCol + 1, tileRow + 1)
              this._gCtx.globalAlpha = tileAlpha
              this._drawTrapezoid(this._gCtx, gid1,
                {x: xTL, y: yTopClamped}, {x: xTR, y: yTopClamped},
                {x: xBL, y: yBotClamped}, {x: xBR, y: yBotClamped})
              this._gCtx.globalAlpha = 1.0
            } else {
              // ── BILLBOARD: draw upright on objects canvas ───────────────
              const screenX     = this._colToScreenX(tileCol + 0.5, tileRow + 1)
              const screenY     = this._rowToScreenY(tileRow + 1)
              const scaledTileW = this._scaleAtRow(tileRow + 1)
              if (screenY !== null &&
                  screenY >= horizonPx &&
                  screenY <= sh + this.tileDisplaySize * 2) {
                this._oCtx.globalAlpha = tileAlpha
                this._drawBillboard(this._oCtx, this._getTileCanvas(gid1),
                  screenX, screenY, scaledTileW)
                this._oCtx.globalAlpha = 1.0
              }
            }
            objectCount++
          }
        }

        // ── Encounter flags ───────────────────────────────────────────────
        if (this._encounterFlags?.length) {
          for (const flag of this._encounterFlags) {
            if (flag.tileX !== tileCol || flag.tileY !== tileRow) continue
            if (!flag.image?.width) continue
            const screenX     = this._colToScreenX(tileCol + 0.5, tileRow + 1)
            const screenY     = this._rowToScreenY(tileRow + 1)
            const scaledTileW = this._scaleAtRow(tileRow + 1)
            if (screenY !== null &&
                screenY >= horizonPx &&
                screenY <= sh + this.tileDisplaySize * 2) {
              this._oCtx.globalAlpha = tileAlpha
              this._drawBillboard(this._oCtx, flag.image, screenX, screenY, scaledTileW, 1.2)
              this._oCtx.globalAlpha = 1.0
            }
          }
        }

      } // tileCol

      // Draw player after last column if their row matched this row but
      // no column loop ran (e.g. player is off to the side of the map)
      if (!playerDrawn && tileRow === playerTileRow && this._playerCanvas && p) {
        const scaledTileW = this._scaleAtRow(playerTileRow + 1)
        const playerHM2 = this._playerHeightMult ?? 1.8
        this._drawWeaponOverlay(playerScreenX, playerScreenY, scaledTileW, null)
        this._drawBillboard(this._oCtx, this._playerCanvas,
          playerScreenX, playerScreenY, scaledTileW, playerHM2)
        playerDrawn = true
      }

    } // tileRow

    // Fallback: player row outside visible range
    if (!playerDrawn && this._playerCanvas && p) {
      const proj = this._projectLogical(p.logicalX, p.logicalY)
      if (proj) {
        const scaledTileW = this._scaleAtRow(playerTileRow + 1)
        this._drawBillboard(this._oCtx, this._playerCanvas,
          proj.screenX, proj.screenY, scaledTileW, 1.8)
      }
    }

    this._updateLight(playerScreenX, playerScreenY)

    if (!this._debugged) {
      this._debugged = true
      console.log('[PGR v8] first frame —',
        'zoom:', zoom.toFixed(2),
        'perspCamRow:', camRow.toFixed(2),
        'tileRows:', tileRowStart, '->',  tileRowEnd,
        'ground:', groundCount, 'objects:', objectCount
      )
    }
  }

  // ── Encounter flag registration ───────────────────────────────────────────

  setEncounterFlags(flags) {
    // flags: array of { tileX, tileY, image } where image is an HTMLImageElement
    this._encounterFlags = flags || []
  }

  clearEncounterFlag(tileX, tileY) {
    if (!this._encounterFlags) return
    this._encounterFlags = this._encounterFlags.filter(
      f => !(f.tileX === tileX && f.tileY === tileY)
    )
  }



  // ── Cleanup ───────────────────────────────────────────────────────────────

  // ── Weapon billboard ─────────────────────────────────────────────────────
  // Called from update() to draw the equipped weapon separately so it can
  // rotate to match the bow aim angle without invalidating the player canvas.
  //
  // aimAngle: radians (fire direction), or null for resting position
  _drawWeaponOverlay(playerScreenX, playerScreenY, scaledTileW, aimAngle) {
    const inv = this.scene.player?.inventory
    if (!inv) return
    const item = inv.getEquippedItem?.('rightHand')
    if (!item) return

    try {
      // Prefer itemGid on items sheet over individual spriteKey texture
      let itemImg = null
      if (item.itemGid && this.scene.itemSheet?.isReady) {
        itemImg = this.scene.itemSheet.getCanvas(item.itemGid)
      } else if (item.spriteKey) {
        const itemTex = this.scene.textures.get(item.spriteKey)
        if (itemTex && itemTex.key !== '__MISSING') {
          itemImg = itemTex.getSourceImage()
        }
      }
      if (!itemImg?.width) return

      const ctx  = this._oCtx
      const iw   = scaledTileW * 0.9
      const ih   = iw * (itemImg.height / itemImg.width)

      // Resting angle: bow held at ~7 o'clock = 210deg = pointing SW
      // When aiming, rotate to fire direction
      // 210deg offset aligns bow grip with hand naturally
      const REST_ANGLE = (345 * Math.PI) / 180
      const angle      = aimAngle != null ? aimAngle + (Math.PI / 2) + (135 * Math.PI / 180) : REST_ANGLE

      // Position at sprite centre (foot - half sprite height) with slight right offset
      const spriteCentreY = playerScreenY - scaledTileW * 1.8 * 0.5
      const offsetX       = scaledTileW * 0.12

      ctx.save()
      ctx.translate(playerScreenX + offsetX, spriteCentreY)
      ctx.rotate(angle)
      ctx.globalAlpha = 0.95
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(itemImg, -iw / 2, -ih / 2, iw, ih)
      ctx.globalAlpha = 1.0
      ctx.restore()
    } catch(e) {
      // non-fatal
    }
  }

  destroy() {
    this._tileCache.clear()
    ;[this._groundCanvas, this._objectCanvas].forEach(c => {
      if (c?.parentNode) c.parentNode.removeChild(c)
    })
    if (this._lightDiv?.parentNode) this._lightDiv.parentNode.removeChild(this._lightDiv)
    if (this._skyDiv?.parentNode)   this._skyDiv.parentNode.removeChild(this._skyDiv)
    if (this._skyImg?.parentNode)   this._skyImg.parentNode.removeChild(this._skyImg)
    this._groundCanvas = null
    this._objectCanvas = null
    this._lightDiv     = null
    this._skyDiv       = null
    this._skyImg       = null
    this._gCtx         = null
    this._oCtx         = null
    this._player       = null
    this._playerCanvas = null
    console.log('[PGR v8] destroyed')
  }
}


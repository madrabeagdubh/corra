// PerspectiveGroundRenderer.js  (v5j)
//
// Fix: projection formula was inverted. Correct formula:
//   screenY = horizonPx + groundH * FL / (FL + d)
// where d = perspCamRow - worldRow (larger = farther from camera).
// This gives: d large (far) → screenY near horizonPx (top of ground area)
//             d small (near) → screenY near sh (bottom of screen)
// Which is the correct perspective behaviour.

export default class PerspectiveGroundRenderer {

  static DEBUG_RECTS = false

  static CAMERA_ROW_OFFSET = 20
  static TILES_ACROSS      = 9
  static PLAYER_DIST_TILES = 5
  static FOCAL_LENGTH      = 20
  static HORIZON_Y_FRAC    = 0.03

  static TW         = 24
  static TH         = 24
  static MG         = 24
  static SHEET_COLS = 54

  static TILESET_URL = '/assets/oryx/oryx_16bit_fantasy_world_trans.png'

  constructor(scene) {
    this.scene = scene

    const phaserCanvas      = scene.game.canvas
    this._sw                = phaserCanvas.width
    this._sh                = phaserCanvas.height
    this.tileDisplaySize    = 48
    this._pxPerTileAtPlayer = this._sw / PerspectiveGroundRenderer.TILES_ACROSS

    this._tilesetImg = null
    this._tileCache  = new Map()
    this._ready      = false

    if (PerspectiveGroundRenderer.DEBUG_RECTS) {
      this._ready = true
    } else {
      const img       = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        this._tilesetImg = img
        this._ready      = true
        this._lastCamX   = null
        this._lastCamY   = null
        console.log('[PGR v5j] tileset ready —', img.width, 'x', img.height)
      }
      img.onerror = (e) => console.error('[PGR v5j] tileset load failed', e)
      img.src = PerspectiveGroundRenderer.TILESET_URL
    }

    // ── DOM canvas ────────────────────────────────────────────────────────
    this._canvas        = document.createElement('canvas')
    this._canvas.width  = this._sw
    this._canvas.height = this._sh
    this._canvas.id     = 'pgr-ground'

    const container = phaserCanvas.parentNode
    Array.from(container.querySelectorAll('canvas')).forEach(c => {
      c.style.position   = 'absolute'
      c.style.top        = '0'
      c.style.left       = '0'
      c.style.zIndex     = '10'
      c.style.background = 'transparent'
    })
    this._canvas.style.cssText = [
      'position:absolute', 'top:0', 'left:0',
      'z-index:1', 'pointer-events:none',
      'image-rendering:pixelated', 'image-rendering:crisp-edges',
    ].join(';')
    container.appendChild(this._canvas)

    this._ctx = this._canvas.getContext('2d')
    this._ctx.imageSmoothingEnabled = false

    this._lastCamX = null
    this._lastCamY = null
    this._debugged = false

    console.log('[PGR v5j] constructed —', this._sw, 'x', this._sh)
  }

  // ── Src rect ──────────────────────────────────────────────────────────────

  _srcRect(gid) {
    const idx = gid - 1
    const col = idx % PerspectiveGroundRenderer.SHEET_COLS
    const row = Math.floor(idx / PerspectiveGroundRenderer.SHEET_COLS)
    const { MG, TW, TH } = PerspectiveGroundRenderer
    return { sx: MG + col * TW, sy: MG + row * TH, sw: TW, sh: TH }
  }

  // ── Projection ────────────────────────────────────────────────────────────
  //
  // Camera is SOUTH of the map, looking NORTH.
  // d = perspCamRow - worldRow  (always positive for visible rows)
  // Large d = far north = close to horizon = small screen-y (near top)
  // Small d = close south = near player = large screen-y (near bottom)
  //
  // Correct formula: screenY = horizonPx + groundH * FL / (FL + d)
  //   d → ∞:  screenY → horizonPx          (horizon, top of ground)
  //   d → 0:  screenY → horizonPx + groundH (bottom of screen)
  //
  // For a tile row [tileRow .. tileRow+1]:
  //   North/far edge  = tileRow     → d large → small screenY → top of trapezoid
  //   South/near edge = tileRow + 1 → d small → large screenY → bottom of trapezoid
  // So yTop = _rowToScreenY(tileRow), yBot = _rowToScreenY(tileRow+1)
  // and yTop < yBot  ✓

  _horizonPx() { return Math.floor(this._sh * PerspectiveGroundRenderer.HORIZON_Y_FRAC) }
  _groundH()   { return this._sh - this._horizonPx() }

  _perspCamRow() {
    const c = this.scene.cameras.main
    return (c.scrollY + this._sh / 2) / this.tileDisplaySize
         + PerspectiveGroundRenderer.CAMERA_ROW_OFFSET
  }
  _perspCamCol() {
    const c = this.scene.cameras.main
    return (c.scrollX + this._sw / 2) / this.tileDisplaySize
  }

  _rowToScreenY(worldRow) {
    const d = this._perspCamRow() - worldRow
    if (d <= 0) return null
    const FL = PerspectiveGroundRenderer.FOCAL_LENGTH
    // CORRECTED: large d → small screenY (far = near top)
    return this._horizonPx() + this._groundH() * FL / (FL + d)
  }

  _scaleAtRow(worldRow) {
    const d = this._perspCamRow() - worldRow
    if (d <= 0) return 0
    const FL = PerspectiveGroundRenderer.FOCAL_LENGTH
    const PD = PerspectiveGroundRenderer.PLAYER_DIST_TILES
    return this._pxPerTileAtPlayer * (FL + PD) / (FL + d)
  }

  _colToScreenX(worldCol, worldRow) {
    return this._sw / 2 + (worldCol - this._perspCamCol()) * this._scaleAtRow(worldRow)
  }

  perspectiveProject(worldTileX, worldTileY) {
    // South/near edge = tileRow+1 → largest screenY = bottom of tile = feet
    const screenY = this._rowToScreenY(worldTileY + 1)
    if (screenY === null || screenY < this._horizonPx() || screenY > this._sh + this.tileDisplaySize) return null
    const scale   = this._scaleAtRow(worldTileY + 1) / this.tileDisplaySize
    const screenX = this._colToScreenX(worldTileX + 0.5, worldTileY + 1)
    return { screenX, screenY, scale }
  }

  // ── Tile canvas cache ─────────────────────────────────────────────────────

  _getTileCanvas(gid) {
    if (this._tileCache.has(gid)) return this._tileCache.get(gid)
    const { sx, sy, sw, sh } = this._srcRect(gid)
    const tc   = document.createElement('canvas')
    tc.width   = sw
    tc.height  = sh
    const tCtx = tc.getContext('2d')
    tCtx.imageSmoothingEnabled = false
    tCtx.drawImage(this._tilesetImg, sx, sy, sw, sh, 0, 0, sw, sh)
    this._tileCache.set(gid, tc)
    return tc
  }

  // ── Affine triangle renderer ──────────────────────────────────────────────

  _drawAffineTriangle(img, t0, t1, t2, p0, p1, p2) {
    const ctx = this._ctx
    const u0 = t0.u, v0 = t0.v
    const u1 = t1.u, v1 = t1.v
    const u2 = t2.u, v2 = t2.v

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
    ctx.moveTo(p0.x, p0.y)
    ctx.lineTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.closePath()
    ctx.clip()
    ctx.setTransform(a, b, c, d, e, f)
    ctx.drawImage(img, 0, 0)
    ctx.restore()
  }

  _drawTrapezoid(gid, tl, tr, bl, br) {
    const img = this._getTileCanvas(gid)
    const W   = img.width
    const H   = img.height
    this._drawAffineTriangle(img, {u:0,v:0}, {u:W,v:0}, {u:W,v:H}, tl, tr, br)
    this._drawAffineTriangle(img, {u:0,v:0}, {u:W,v:H}, {u:0,v:H}, tl, br, bl)
  }

  // ── Main render ───────────────────────────────────────────────────────────

  update() {
    if (!this._ready) return

    const cam = this.scene.cameras.main
    if (cam.scrollX === this._lastCamX && cam.scrollY === this._lastCamY) return
    this._lastCamX = cam.scrollX
    this._lastCamY = cam.scrollY

    const ctx       = this._ctx
    const sw        = this._sw
    const sh        = this._sh
    const FL        = PerspectiveGroundRenderer.FOCAL_LENGTH
    const horizonPx = this._horizonPx()
    const layer0    = this.scene.mapData?.layers?.[0]
    if (!layer0) return

    const mapH   = layer0.length
    const mapW   = layer0[0].length
    const camRow = this._perspCamRow()
    const camCol = this._perspCamCol()

    ctx.clearRect(0, 0, sw, sh)

    // Visible tile row range
    // tileRowEnd: nearest (southernmost) row — clamp so d > 0
    const tileRowEnd   = Math.min(mapH - 1, Math.floor(camRow) - 1)
    // tileRowStart: farthest (northernmost) visible row
    // At d = FL * 15, screenY ≈ horizonPx + groundH * FL/(FL + FL*15) = horizonPx + groundH/16
    // which is just slightly below horizon — fine upper bound
    const tileRowStart = Math.max(0, Math.floor(camRow - FL * 15))

    let drawCount = 0

    // Draw far→near (north→south): tileRowStart first, tileRowEnd last
    // Near rows overdraw far rows — correct painter's algorithm
    for (let tileRow = tileRowStart; tileRow <= tileRowEnd; tileRow++) {

      // yTop = north/far edge (smaller screenY = higher on screen)
      // yBot = south/near edge (larger screenY = lower on screen)
      const yTop = this._rowToScreenY(tileRow)
      const yBot = this._rowToScreenY(tileRow + 1)

      if (yBot === null) continue
      if (yTop !== null && yTop > sh) continue   // entirely below screen
      if (yBot < horizonPx) continue              // entirely above horizon

      const yTopClamped = (yTop === null || yTop < horizonPx) ? horizonPx : yTop
      const yBotClamped = Math.min(sh + 2, yBot)

      if (yBotClamped <= yTopClamped) continue

      // Column culling: use near (south) edge scale — widest point of trapezoid
      const scaleNear = this._scaleAtRow(tileRow + 1)
      const halfCols  = scaleNear > 0.001 ? (sw / 2) / scaleNear + 1 : mapW

      const colStart = Math.max(0,      Math.floor(camCol - halfCols))
      const colEnd   = Math.min(mapW-1, Math.ceil (camCol + halfCols))

      for (let tileCol = colStart; tileCol <= colEnd; tileCol++) {
        const gid = layer0[tileRow]?.[tileCol]
        if (!gid) continue

        // Far (north/top) edge is narrower, near (south/bottom) edge is wider
        const xTL = this._colToScreenX(tileCol,     tileRow)       // far-left
        const xTR = this._colToScreenX(tileCol + 1, tileRow)       // far-right
        const xBL = this._colToScreenX(tileCol,     tileRow + 1)   // near-left
        const xBR = this._colToScreenX(tileCol + 1, tileRow + 1)   // near-right

        if (PerspectiveGroundRenderer.DEBUG_RECTS) {
          const colors = ['rgba(255,0,0,0.5)','rgba(0,200,0,0.5)',
                          'rgba(0,100,255,0.5)','rgba(255,200,0,0.5)']
          ctx.fillStyle = colors[tileRow % colors.length]
          ctx.beginPath()
          ctx.moveTo(xTL, yTopClamped)
          ctx.lineTo(xTR, yTopClamped)
          ctx.lineTo(xBR, yBotClamped)
          ctx.lineTo(xBL, yBotClamped)
          ctx.closePath()
          ctx.fill()
          ctx.strokeStyle = 'rgba(255,255,255,0.25)'
          ctx.lineWidth = 0.5
          ctx.stroke()
        } else {
          this._drawTrapezoid(gid,
            {x: xTL, y: yTopClamped},
            {x: xTR, y: yTopClamped},
            {x: xBL, y: yBotClamped},
            {x: xBR, y: yBotClamped},
          )
        }
        drawCount++
      }
    }

    if (!this._debugged) {
      this._debugged = true
      console.log('[PGR v5j] first frame —',
        'perspCamRow:', camRow.toFixed(2),
        'tileRows:', tileRowStart, '→', tileRowEnd,
        'drew:', drawCount,
        'yTop(row0):', this._rowToScreenY(0)?.toFixed(1),
        'yTop(row14):', this._rowToScreenY(14)?.toFixed(1),
        'yBot(row14):', this._rowToScreenY(15)?.toFixed(1),
        'yBot(row29):', this._rowToScreenY(30)?.toFixed(1)
      )
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  destroy() {
    this._tileCache.clear()
    if (this._canvas?.parentNode) this._canvas.parentNode.removeChild(this._canvas)
    this._canvas = null
    this._ctx    = null
    console.log('[PGR v5j] destroyed')
  }
}


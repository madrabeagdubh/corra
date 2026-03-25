// FogRenderer.js
//
// Renders fog of war on a dedicated DOM canvas (z-index between ground and objects).
// Three tile states:
//   HIDDEN  — never seen: full dark overlay
//   VISITED — seen before: greyed/desaturated overlay
//   VISIBLE — currently in FOV: clear (no overlay)
//
// Redraws whenever the player moves (FOV changes).
// Works in screen space using PGR's projection — no Phaser involvement.
//
// Usage:
//   const fog = new FogRenderer(pgrInstance)
//   fog.update(fovSystem)   // call after fov.compute() each move
//   fog.destroy()

export default class FogRenderer {

  // Overlay alpha values
  static HIDDEN_ALPHA  = 0.96   // near-black for unseen tiles
  static VISITED_ALPHA = 0.55   // grey wash for visited tiles
  static HIDDEN_COLOR  = '10,8,20'    // dark blue-black
  static VISITED_COLOR = '20,18,30'   // slightly lighter

  constructor(pgr) {
    this._pgr = pgr

    const phaserCanvas = pgr.scene.game.canvas
    const container    = phaserCanvas.parentNode
    const sw           = pgr._sw
    const sh           = pgr._sh

    this._canvas        = document.createElement('canvas')
    this._canvas.width  = sw
    this._canvas.height = sh
    this._canvas.id     = 'pgr-fog'
    Object.assign(this._canvas.style, {
      position:      'absolute',
      top:           '0',
      left:          '0',
      zIndex:        '6',   // above sky(4,5), below Phaser(10)
      pointerEvents: 'none',
      imageRendering: 'pixelated',
	    filter:        'blur(12px)',
    })
    container.appendChild(this._canvas)
    this._ctx = this._canvas.getContext('2d')

    console.log('[FogRenderer] constructed')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  update(fovSystem) {
    const pgr    = this._pgr
    const ctx    = this._ctx
    const sw     = pgr._sw
    const sh     = pgr._sh

    const layer0 = pgr.scene.mapData?.layers?.[0]
    if (!layer0) return

    const mapH      = layer0.length
    const mapW      = layer0[0].length
    const camRow    = pgr._perspCamRow()
    const camCol    = pgr._perspCamCol()
    const FL        = pgr.constructor.FOCAL_LENGTH
    const horizonPx = pgr._horizonPx()

    ctx.clearRect(0, 0, sw, sh)

    const tileRowEnd   = Math.min(mapH - 1, Math.floor(camRow) - 1)
    const tileRowStart = Math.max(0, Math.floor(camRow - FL * 15))

    for (let tileRow = tileRowStart; tileRow <= tileRowEnd; tileRow++) {
      const yTop = pgr._rowToScreenY(tileRow)
      const yBot = pgr._rowToScreenY(tileRow + 1)

      if (yBot === null) continue
      if (yTop !== null && yTop > sh) continue
      if (yBot < horizonPx) continue

      const yTopClamped = (yTop === null || yTop < horizonPx) ? horizonPx : yTop
      const yBotClamped = Math.min(sh + 2, yBot)
      if (yBotClamped <= yTopClamped) continue

      const scaleNear = pgr._scaleAtRow(tileRow + 1)
      const halfCols  = scaleNear > 0.001 ? (sw / 2) / scaleNear + 1 : mapW
      const colStart  = Math.max(0,      Math.floor(camCol - halfCols))
      const colEnd    = Math.min(mapW-1, Math.ceil (camCol + halfCols))

      for (let tileCol = colStart; tileCol <= colEnd; tileCol++) {
        // Skip if visible — no fog overlay needed
        if (fovSystem.isVisible(tileCol, tileRow)) continue

        const isVisited = fovSystem.isVisited(tileCol, tileRow)
        const alpha     = isVisited
          ? FogRenderer.VISITED_ALPHA
          : FogRenderer.HIDDEN_ALPHA
        const color     = isVisited
          ? FogRenderer.VISITED_COLOR
          : FogRenderer.HIDDEN_COLOR

        const xTL = pgr._colToScreenX(tileCol,     tileRow)
        const xTR = pgr._colToScreenX(tileCol + 1, tileRow)
        const xBL = pgr._colToScreenX(tileCol,     tileRow + 1)
        const xBR = pgr._colToScreenX(tileCol + 1, tileRow + 1)

        ctx.fillStyle = `rgba(${color},${alpha})`
        ctx.beginPath()
        ctx.moveTo(xTL, yTopClamped)
        ctx.lineTo(xTR, yTopClamped)
        ctx.lineTo(xBR, yBotClamped)
        ctx.lineTo(xBL, yBotClamped)
        ctx.closePath()
        ctx.fill()
      }
    }

    // Fill above horizon with full dark (sky area for hidden tiles)
    ctx.fillStyle = `rgba(${FogRenderer.HIDDEN_COLOR},${FogRenderer.HIDDEN_ALPHA})`
    ctx.fillRect(0, 0, sw, horizonPx)
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  destroy() {
    if (this._canvas?.parentNode)
      this._canvas.parentNode.removeChild(this._canvas)
    this._canvas = null
    this._ctx    = null
    console.log('[FogRenderer] destroyed')
  }
}


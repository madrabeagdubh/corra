// FogRenderer.js  (v5)
//
// Three tile states, clearly separated:
//
//   HIDDEN  — never visited: draw fog texture at full opacity
//   VISITED — explored, not in FOV: draw dark tint only (no fog texture)
//             tint fades IN  when tile leaves FOV  (via getTintProgress)
//             tint fades OUT when tile enters FOV  (handled by not drawing it)
//   VISIBLE — currently in FOV: draw nothing (fully clear)
//             EXCEPT during fade-in: draw fog texture at decreasing opacity
//
// No flood fill. No erase compositing. Each tile drawn once with correct alpha.
// CSS blur gives soft edges.

export default class FogRenderer {

  static PHASER_TEXTURE_KEY = 'fogTexture'
  static BLUR_PX            = 10
  static HIDDEN_OPACITY     = 0.97   // fog texture opacity over hidden tiles
  static VISITED_TINT       = 0.32   // max dark tint alpha over visited tiles
  static VISITED_TINT_COL   = '5,5,18'

  constructor(pgr) {
    this._pgr     = pgr
    this._pattern = null
    this._ready   = false

    const phaserCanvas = pgr.scene.game.canvas
    const container    = phaserCanvas.parentNode
    this._sw = pgr._sw
    this._sh = pgr._sh

    // Nuke any existing fog canvas before creating new one
    const oldFog = document.getElementById('pgr-fog')
    if (oldFog) oldFog.parentNode?.removeChild(oldFog)

    this._canvas        = document.createElement('canvas')
    this._canvas.width  = this._sw
    this._canvas.height = this._sh
    this._canvas.id     = 'pgr-fog'
    Object.assign(this._canvas.style, {
      position:      'absolute',
      top:           '0',
      left:          '0',
      zIndex:        '6',
      pointerEvents: 'none',
      filter:        `blur(${FogRenderer.BLUR_PX}px)`,
    })
    container.appendChild(this._canvas)
    this._ctx = this._canvas.getContext('2d')

    this._initPattern()
    console.log('[FogRenderer v5] constructed')
  }

  _initPattern() {
    try {
      const tex = this._pgr.scene.textures.get(FogRenderer.PHASER_TEXTURE_KEY)
      if (!tex || tex.key === '__MISSING') {
        console.warn('[FogRenderer v5] fogTexture missing — flat colour fallback')
        this._ready = true
        return
      }
      this._pattern = this._ctx.createPattern(tex.getSourceImage(), 'repeat')
      this._ready   = true
      console.log('[FogRenderer v5] pattern ready')
    } catch(e) {
      console.warn('[FogRenderer v5] pattern failed:', e.message)
      this._ready = true
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  update(fovSystem) {
    if (!this._ready) return

    const pgr    = this._pgr
    const ctx    = this._ctx
    const sw     = this._sw
    const sh     = this._sh

    const layer0 = pgr.scene.mapData?.layers?.[0]
    if (!layer0) return

    const mapH      = layer0.length
    const mapW      = layer0[0].length
    const camRow    = pgr._perspCamRow()
    const camCol    = pgr._perspCamCol()
    const FL        = pgr.constructor.FOCAL_LENGTH
    const horizonPx = pgr._horizonPx()

    const tileRowEnd   = Math.min(mapH - 1, Math.floor(camRow) - 1)
    const tileRowStart = Math.max(0, Math.floor(camRow - FL * 15))

    ctx.clearRect(0, 0, sw, sh)
    ctx.globalCompositeOperation = 'source-over'

    const fogFill  = this._pattern ?? 'rgba(5,5,18,1)'

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

        const hidden  = fovSystem.isHidden(tileCol, tileRow)
        const visible = !hidden && fovSystem.isVisible(tileCol, tileRow)
        const visited = !hidden && !visible  // visited but not currently visible

        // Get trapezoid corners (used by all three branches)
        const xTL = pgr._colToScreenX(tileCol,     tileRow)
        const xTR = pgr._colToScreenX(tileCol + 1, tileRow)
        const xBL = pgr._colToScreenX(tileCol,     tileRow + 1)
        const xBR = pgr._colToScreenX(tileCol + 1, tileRow + 1)

        if (hidden) {
          // ── HIDDEN: full fog texture ──────────────────────────────────
          ctx.globalAlpha = FogRenderer.HIDDEN_OPACITY
          ctx.fillStyle   = fogFill
          ctx.beginPath()
          ctx.moveTo(xTL, yTopClamped); ctx.lineTo(xTR, yTopClamped)
          ctx.lineTo(xBR, yBotClamped); ctx.lineTo(xBL, yBotClamped)
          ctx.closePath(); ctx.fill()

        } else if (visible) {
          // ── VISIBLE: clear — fade fog out only on FIRST discovery ─────
          // If tile was already visited before this FOV entry, skip fade
          // entirely — it was already revealed, no need to show fog again.
          const wasVisitedBefore = fovSystem.wasVisitedBeforeCurrentEntry(tileCol, tileRow)
          if (wasVisitedBefore) continue  // already known, always clear
          const fade = fovSystem.getFadeProgress(tileCol, tileRow)
          if (fade >= 1.0) continue
          ctx.globalAlpha = FogRenderer.HIDDEN_OPACITY * (1.0 - fade)
          ctx.fillStyle   = fogFill
          ctx.beginPath()
          ctx.moveTo(xTL, yTopClamped); ctx.lineTo(xTR, yTopClamped)
          ctx.lineTo(xBR, yBotClamped); ctx.lineTo(xBL, yBotClamped)
          ctx.closePath(); ctx.fill()

        } else if (visited) {
          // ── VISITED: dark tint only, no fog texture ───────────────────
          // Tint fades IN as tile leaves FOV (tintProgress 0→1)
          const tintP = fovSystem.getTintProgress(tileCol, tileRow)
          if (tintP <= 0.001) continue  // just left FOV, still clear
          ctx.globalAlpha = FogRenderer.VISITED_TINT * tintP
          ctx.fillStyle   = `rgb(${FogRenderer.VISITED_TINT_COL})`
          ctx.beginPath()
          ctx.moveTo(xTL, yTopClamped); ctx.lineTo(xTR, yTopClamped)
          ctx.lineTo(xBR, yBotClamped); ctx.lineTo(xBL, yBotClamped)
          ctx.closePath(); ctx.fill()
        }
      }
    }

    ctx.globalAlpha = 1.0
  }

  destroy() {
    if (this._canvas?.parentNode)
      this._canvas.parentNode.removeChild(this._canvas)
    this._pattern = null
    this._canvas  = null
    this._ctx     = null
    console.log('[FogRenderer v5] destroyed')
  }
}


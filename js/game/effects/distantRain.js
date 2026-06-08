/**
 * DistantRainLayer
 *
 * A second rain curtain for d3OpenSea, rendered behind the existing StormOverlay.
 * Appears as a grey-blue veil of slow, fine rain falling at a shallow angle —
 * giving the impression of a squall several miles further out to sea.
 *
 * Managed entirely with a single Canvas2D element so it costs nothing extra
 * on the Phaser side and can be destroyed cleanly on scene exit.
 *
 * Usage:
 *   this._distantRain = new DistantRainLayer()
 *   this._distantRain.setIntensity(0..1)   // call every frame from update()
 *   this._distantRain.update(delta)
 *   this._distantRain.destroy()
 */

const DROP_COUNT   = 180          // total pool — only a fraction drawn at low intensity
const BASE_SPEED   = 55           // px/sec fall speed (much slower than foreground rain)
const WIND_DRIFT   = 28           // px/sec horizontal drift (shallow angle)
const DROP_ALPHA   = 0.18         // max opacity of each streak
const DROP_LEN_MIN = 18
const DROP_LEN_MAX = 38
const VEIL_ALPHA   = 0.38         // max opacity of the grey-blue veil at full intensity

export class DistantRainLayer {

  constructor() {
    this._intensity  = 0
    this._targetIntensity = 0
    this._canvas     = null
    this._ctx        = null
    this._drops      = []
    this._raf        = null
    this._lastTs     = null
    this._destroyed  = false

    this._buildCanvas()
    this._initDrops()
    this._raf = requestAnimationFrame(this._tick.bind(this))
  }

  // ── Public ────────────────────────────────────────────────────────────────

  /**
   * Set target intensity (0..1). Actual intensity lerps toward target each frame
   * so it fades in/out smoothly as the player moves east/west.
   */
  setIntensity(v) {
    this._targetIntensity = Math.max(0, Math.min(1, v))
  }

  /** Call from scene update() — not strictly required (rAF is self-running)
   *  but kept for API consistency with StormOverlay. */
  update(_delta) {}

  destroy() {
    this._destroyed = true
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null }
    if (this._canvas?.parentNode) this._canvas.parentNode.removeChild(this._canvas)
    this._canvas = null
    this._ctx    = null
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  _buildCanvas() {
    const canvas = document.createElement('canvas')
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
    canvas.style.cssText = [
      'position:fixed',
      'inset:0',
      'width:100%',
      'height:100%',
      // Behind the existing StormOverlay (z-index assumed ~10000) but above the game canvas
      'z-index:9800',
      'pointer-events:none',
      'opacity:1',
    ].join(';')
    document.body.appendChild(canvas)
    this._canvas = canvas
    this._ctx    = canvas.getContext('2d')
  }

  _initDrops() {
    const W = this._canvas.width
    const H = this._canvas.height
    this._drops = Array.from({ length: DROP_COUNT }, () => this._newDrop(W, H, true))
  }

  _newDrop(W, H, randomY = false) {
    const len = DROP_LEN_MIN + Math.random() * (DROP_LEN_MAX - DROP_LEN_MIN)
    return {
      x:    Math.random() * (W + 80) - 40,
      y:    randomY ? Math.random() * H : -len,
      len,
      speed: BASE_SPEED * (0.7 + Math.random() * 0.6),
      drift: WIND_DRIFT * (0.5 + Math.random() * 1.0),
      alpha: DROP_ALPHA * (0.5 + Math.random() * 0.5),
    }
  }

  _tick(ts) {
    if (this._destroyed) return
    this._raf = requestAnimationFrame(this._tick.bind(this))

    const dt = this._lastTs === null ? 0 : Math.min((ts - this._lastTs) / 1000, 0.05)
    this._lastTs = ts

    // Smooth intensity
    this._intensity += (this._targetIntensity - this._intensity) * 0.025

    const W = this._canvas.width
    const H = this._canvas.height
    const ctx = this._ctx
    ctx.clearRect(0, 0, W, H)

    if (this._intensity < 0.01) return

    const t = this._intensity

    // ── Grey-blue veil ───────────────────────────────────────────────────
    // Adds darkness and desaturation — the sea just goes bleak
    const veilAlpha = t * t * VEIL_ALPHA
    ctx.fillStyle = `rgba(18,28,48,${veilAlpha.toFixed(3)})`
    ctx.fillRect(0, 0, W, H)

    // ── Rain streaks ─────────────────────────────────────────────────────
    // Only draw a fraction of the pool proportional to intensity
    const visible = Math.floor(t * DROP_COUNT)

    ctx.save()
    ctx.globalCompositeOperation = 'screen'

    for (let i = 0; i < visible; i++) {
      const d = this._drops[i]

      // Advance position
      d.y += d.speed  * dt
      d.x += d.drift  * dt

      // Recycle when off-screen
      if (d.y - d.len > H || d.x > W + 40) {
        this._drops[i] = this._newDrop(W, H, false)
        continue
      }

      // Draw streak — thin, pale blue-grey
      const x0 = d.x
      const y0 = d.y - d.len
      const x1 = d.x + d.drift * (d.len / d.speed) * 0.6
      const y1 = d.y

      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.strokeStyle = `rgba(160,185,220,${(d.alpha * t).toFixed(3)})`
      ctx.lineWidth   = 0.6 + Math.random() * 0.4
      ctx.stroke()
    }

    ctx.restore()
  }
}


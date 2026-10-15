// pgrView.js
// Location: js/game/effects/pgrView.js
//
// The player's own view of the world: pinch to zoom, two fingers to look around. Off unless the page has ?pinch=1.
//
//   one finger        unchanged: a tap walks, a drag draws a route (perspectiveScene._setupTapToPath)
//   two fingers       pinch zooms (ZMIN..ZMAX); dragging both looks around (PAN_X, PAN_Y of the screen). The second finger
//                     cancels any route the first had begun, so nothing is walked afterwards.
//   mouse wheel       zooms (for testing on a desktop)
//   afterwards        the look-around eases back to you when you start to walk, or after IDLE_MS; the zoom stays
//
// It works through pgr._view (perspectiveGroundRenderer.js): a camera step in or out (a real dolly, as the sword-fight
// lens does, so tiles stay square on screen), a tilt to keep the player on screen when stepping in, and a shift of
// the camera. Everything that projects through PGR follows (taps, routes, rock, light). It gives way to the
// fight lens (combat/fightLens.js) while a bout is on: the renderer scales the view by 1 - the lens's weight.

const ZMIN = 0.75, ZMAX = 1.6
const PAN_X = 0.5, PAN_Y = 0.42     // how far the player may be pushed off centre, as fractions of the screen
const IDLE_MS = 3500
const H_MIN = 0.1            // as fightLens.js: the furthest the camera tilts down
const ELEV = 0.55            // zoomed right out the horizon has risen this much (of the screen): the camera looks down from higher up
let KEEP_Z = 1               // the zoom you chose lasts from scene to scene
let TOLD = false             // the caption that says the view is on is shown once a session

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export default class PGRView {
  constructor(scene) {
    this.scene = scene
    this.z = this.zT = KEEP_Z
    this.px = this.py = this.pxT = this.pyT = 0
    this.touch = IDLE_MS
    this.pts = new Map()
    this.gest = null
    if (scene.allowPinchView?.() !== false) this._bind()          // a small room has no use for it
  }

  get g() { return this.scene.perspectiveGround }

  // ── fingers ──────────────────────────────────────────────────────────────
  _bind() {
    const canvas = this.canvas = this.scene.game.canvas
    // without this a phone's browser keeps two-finger gestures for itself (page zoom and scroll) and cancels ours
    this._ta = canvas.style.touchAction
    canvas.style.touchAction = 'none'
    if (!TOLD) {
      TOLD = true
      this.scene.time.delayedCall(1800, () => this.scene._caption?.show?.('Zoom: pinch', 'Pinch to zoom, two fingers to look around', 2600))
    }
    const at = (e) => {
      const r = canvas.getBoundingClientRect()
      return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height]
    }
    this._h = {
      down: (e) => {
        const [x, y] = at(e)
        if (this.pts.size >= 2 || this.scene._tapBlocked?.(x, y)) return
        this.pts.set(e.pointerId, { x, y })
        if (this.pts.size === 2) this._start()
      },
      move: (e) => {
        const p = this.pts.get(e.pointerId)
        if (!p) return
        const [x, y] = at(e); p.x = x; p.y = y
        if (this.gest && this.pts.size === 2) this._gesture()
      },
      up: (e) => {
        if (!this.pts.delete(e.pointerId)) return
        this.touch = 0
        if (this.pts.size < 2) this.gest = null
      },
      wheel: (e) => {
        if (this.scene._tapBlocked?.(...at(e))) return
        e.preventDefault()
        this.zT = clamp(this.zT * Math.exp(-e.deltaY * 0.0015), ZMIN, ZMAX)
        this.touch = 0
      },
    }
    canvas.addEventListener('pointerdown', this._h.down)
    canvas.addEventListener('pointermove', this._h.move)
    canvas.addEventListener('pointerup', this._h.up)
    canvas.addEventListener('pointercancel', this._h.up)
    canvas.addEventListener('wheel', this._h.wheel, { passive: false })
  }

  _mid() { const [a, b] = [...this.pts.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1 } }

  _start() {
    this.scene._cancelTap?.()                         // the first finger's route, if any, is not a walk any more
    const m = this._mid()
    this.gest = { d0: m.d, z0: this.zT, x0: m.x, y0: m.y, px0: this.pxT, py0: this.pyT }
    this.touch = 0
  }

  // screen pixels at the player's feet: across a tile, and down a row
  _pxPerTile() {
    const g = this.g, p = this.scene.player
    if (!g || !p) return { x: 40, y: 20 }
    const r = Math.floor(p.logicalY / this.scene.tileSize)
    const x = g._scaleAtRow(r + 1) || 40
    const y0 = g._rowToScreenY(r), y1 = g._rowToScreenY(r + 1)
    return { x, y: y0 != null && y1 != null && y1 - y0 > 2 ? y1 - y0 : x * 0.5 }
  }

  _gesture() {
    const G = this.gest, m = this._mid(), px = this._pxPerTile()
    this.zT = clamp(G.z0 * m.d / G.d0, ZMIN, ZMAX)
    // drag the world with your fingers: the camera goes the other way
    const g = this.g, mx = PAN_X * g._sw / px.x, my = PAN_Y * g._sh / px.y
    this.pxT = clamp(G.px0 - (m.x - G.x0) / px.x, -mx, mx)
    this.pyT = clamp(G.py0 - (m.y - G.y0) / px.y, -my, my)
    this.touch = 0
  }

  // ── the camera ───────────────────────────────────────────────────────────
  // z times closer (or further). In: a step of the camera along its way, the horizon tilted to keep the player where
  // they are on screen, and magnification for what the step can't give (as fightLens.js). Out: see below
  _cam(g, z) {
    const K = g.constructor, FL = K.FOCAL_LENGTH, off = g._cameraRowOffset ?? K.CAMERA_ROW_OFFSET
    const base = g._horizonYFrac ?? K.HORIZON_Y_FRAC, sh = g._sh
    const d0 = off - 0.5
    const h0 = base * sh, yT = h0 + (sh - h0) * FL / (FL + d0)         // where the player stands on the screen
    if (z <= 1) {
      // Out: the camera climbs. The horizon rises with the zoom (more of a view from above), the camera's distance
      // is whatever keeps the player where they stand on the screen, and the player's size is made up with magnification.
      const t = clamp((1 - z) / (1 - ZMIN), 0, 1), r = (FL + 0.6) / FL
      const hLim = (r * yT - sh) / (r - 1) / sh                         // not so high that the camera reaches the player
      const h = Math.max(hLim, base - ELEV * t * t * (3 - 2 * t)) * sh
      const d = FL * (sh - h) / (yT - h) - FL
      return { dolly: d0 - d, horizon: h / sh, hw: 1, mag: z * (FL + d) / (FL + d0) }
    }
    // a horizon already above the top of the screen (a cave seen from above) may go a little further up; one on the screen stays below H_MIN
    const lo = Math.min(H_MIN, base - 0.5)
    const hMin = lo * sh
    const qMax = (yT - hMin) / (sh - hMin), dMin = FL / qMax - FL
    const zd = Math.max(1, Math.min(z, (FL + d0) / (FL + dMin)))
    const dolly = (FL + d0) * (1 - 1 / zd), q = FL / (FL + d0 - dolly)
    return { dolly, horizon: Math.max(lo, Math.min(base, ((yT - sh * q) / (1 - q)) / sh)), hw: 1, mag: z / zd }
  }

  update(dt) {
    const g = this.g
    if (!this._h || !g?._sh) return
    dt = Math.min(100, dt)
    this.touch += dt
    const p = this.scene.player
    if (!this.gest && p && (p.isMoving || p.pathQueue?.length || this.touch > IDLE_MS)) this.pxT = this.pyT = 0
    const kz = 1 - Math.exp(-dt / 120), kp = 1 - Math.exp(-dt / (this.gest ? 50 : 420))
    this.z += (this.zT - this.z) * kz
    this.px += (this.pxT - this.px) * kp
    this.py += (this.pyT - this.py) * kp
    KEEP_Z = this.zT
    const on = Math.abs(this.z - 1) > 0.004 || Math.abs(this.px) + Math.abs(this.py) > 0.01
    g._view = on ? { ...this._cam(g, this.z), dCol: this.px, dRow: this.py } : null
  }

  destroy() {
    const c = this.canvas, h = this._h
    if (c && h) {
      c.removeEventListener('pointerdown', h.down); c.removeEventListener('pointermove', h.move)
      c.removeEventListener('pointerup', h.up); c.removeEventListener('pointercancel', h.up)
      c.removeEventListener('wheel', h.wheel)
    }
    if (c) c.style.touchAction = this._ta || ''
    if (this.g) this.g._view = null
    this.pts.clear(); this.gest = null
  }
}

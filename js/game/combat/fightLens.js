// fightLens.js
// Location: js/game/combat/fightLens.js
//
// The camera closes in on a sword fight. While a bout is on, it looks at the
// point between you and him, and steps in as close as it can while keeping
// you both on screen: toe to toe you're large; at the edge of range it's
// about the usual view. When the bout ends it eases back out.
//
// It works through PGR's lens (pgr._lens: perspectiveGroundRenderer.js), so
// it is a real step forward of the camera, not a crop -- and everything
// that projects through PGR (taps, routes, the students, the sword) follows.
//
//   const lens = new FightLens(scene, melee)
//   lens.update(dt)     every frame
//   lens.active         true while it's doing anything
//   lens.destroy()

const ZMAX = 2.4                 // closest: figures this many times their usual size
const SAFE = { left: 0.08, right: 0.92, top: 0.2, bottom: 0.76 }   // of the screen; the moon is below `bottom`
// a conversation keeps both speakers clear of the text above them, and off the moon
const SAFE_TALK = { left: 0.1, right: 0.9, top: 0.44, bottom: 0.84 }
const TALL = 2.0                 // a figure's height, in its tile widths, with the sword raised
const H_MIN = 0.1               // the furthest the camera tilts down: horizon this far from the top
const T_ZOOM = 420, T_PAN = 260, T_BLEND = 380      // ms: how quickly it follows

export default class FightLens {
  constructor(scene, melee) {
    this.scene = scene
    this.m = melee
    this.cur = { col: 0, row: 0, w: 0, z: 1 }
    this.active = false
  }

  get pgr() { return this.scene.perspectiveGround }

  // where the fighters stand, as ground points (tile units, centres at +0.5).
  // scene.lensFocus() -> [c, r] | null: something else to close in on with
  // you (a training dummy) when there's no bout.
  _points() {
    const p = this.scene.player, ts = this.scene.tileSize, m = this.m
    const out = [[p.logicalX / ts, p.logicalY / ts]]
    if (this._focus) out.push([this._focus[0] + 0.5, this._focus[1] + 0.5])
    else if (!m.noFoe) { const [x, y] = m.foeDrawPos(); out.push([x + 0.5, y + 0.5]) }
    return out
  }

  // The lens for looking at (col, row) z times closer: as much of it as
  // possible a real step in (dolly), the camera tilting down to keep the
  // point where it was on screen; whatever the tilt can't allow, made up
  // with magnification.
  _lensFor(col, row, z) {
    const g = this.pgr, K = g.constructor
    const FL = K.FOCAL_LENGTH, off = g._cameraRowOffset ?? K.CAMERA_ROW_OFFSET
    const base = g._horizonYFrac ?? K.HORIZON_Y_FRAC, sh = g._sh
    const d0 = off - 0.5                                     // the point's feet, from the camera
    const h0 = base * sh, yT = h0 + (sh - h0) * FL / (FL + d0)
    const hMin = H_MIN * sh
    const qMax = (yT - hMin) / (sh - hMin), dMin = FL / qMax - FL
    const zd = Math.max(1, Math.min(z, (FL + d0) / (FL + dMin)))
    const dolly = (FL + d0) * (1 - 1 / zd)
    const q = FL / (FL + d0 - dolly)
    const horizon = Math.max(H_MIN, Math.min(base, ((yT - sh * q) / (1 - q)) / sh))
    return { col, row, w: 1, dolly, horizon, mag: z / zd }
  }

  // Would both fit through that lens?
  _fits(lens) {
    const g = this.pgr, keep = g._lens
    g._lens = lens
    let ok = true
    const SF = this._talk ? SAFE_TALK : SAFE
    for (const [c, r] of this._points()) {
      const y = g._rowToScreenY(r + 0.5)
      if (y == null) { ok = false; break }
      const s = g._scaleAtRow(r + 0.5), x = g._colToScreenX(c, r + 0.5)
      if (x - s * 0.6 < g._sw * SF.left || x + s * 0.6 > g._sw * SF.right ||
          y > g._sh * SF.bottom || y - s * TALL < g._sh * SF.top) { ok = false; break }
    }
    g._lens = keep
    return ok
  }

  // as close as it can get, by halving
  _best(col, row) {
    // too far apart to fit even at the usual view: stay at it, centred between them.
    // (Never back the camera off: past the edge of the map there is nothing to draw.)
    if (!this._fits(this._lensFor(col, row, 1))) return 1
    if (this._fits(this._lensFor(col, row, ZMAX))) return ZMAX
    let lo = 1, hi = ZMAX
    for (let i = 0; i < 7; i++) { const mid = (lo + hi) / 2; if (this._fits(this._lensFor(col, row, mid))) lo = mid; else hi = mid }
    return lo
  }

  update(dt) {
    const g = this.pgr, m = this.m
    if (!g?._sh) return
    const bout = !m.noFoe && (m.combat || m.bout.over)
    this._focus = bout ? null : (this.scene.lensFocus?.() || null)
    const live = bout || !!this._focus
    this._talk = !bout && !!this._focus && !!this.scene.lensSolo?.()      // a conversation: both speakers, in or out
    // tilt-shift through a bout (dialogue brings its own, textPanel.js)
    const ts = this.scene.tiltShift
    if (ts) {
      if (bout && !this.scene.textPanel?.isVisible) { if (!ts._dialogueMode) { ts.setDialogueMode(true, null, 'combat'); this._ts = true } }
      else if (this._ts && ts._profile === 'combat') { ts.setDialogueMode(false); this._ts = false }
    }
    const cur = this.cur, k = t => 1 - Math.exp(-Math.min(100, dt) / t)
    if (live) {
      const pts = this._points()
      const col = pts.reduce((a, p) => a + p[0], 0) / pts.length
      const row = pts.reduce((a, p) => a + p[1], 0) / pts.length
      if (cur.w < 0.01) { cur.col = col; cur.row = row }
      cur.col += (col - cur.col) * k(T_PAN); cur.row += (row - cur.row) * k(T_PAN)
      cur.w += (1 - cur.w) * k(T_BLEND)
      const want = this._best(cur.col, cur.row)
      // stepping in is unhurried; backing out when someone leaves the frame is quicker
      cur.z += (want - cur.z) * k(want < cur.z ? T_ZOOM * 0.5 : T_ZOOM)
    } else {
      cur.w += (0 - cur.w) * k(T_BLEND)
      cur.z += (1 - cur.z) * k(T_ZOOM)
    }
    this.active = cur.w > 0.002 || Math.abs(cur.z - 1) > 0.002
    g._lens = this.active ? { ...this._lensFor(cur.col, cur.row, cur.z), w: cur.w } : null
  }

  destroy() {
    if (this._ts) { this.scene.tiltShift?.setDialogueMode(false); this._ts = false }
    if (this.pgr) this.pgr._lens = null
    this.active = false
  }
}

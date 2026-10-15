// watchers.js
// Location: js/game/effects/watchers.js
//
// Ghouls in the dark. Two green points that open beyond your torchlight while you stand still, and watch.
// They are drawn to the light and fascinated by it, and creep up to its edge -- but of their own accord they
// stay out of it. Walk away or aside and they shut and are gone. Walk toward them, so that your light reaches
// them (or you come within a few strides), and they stop watching and charge: onAttack(watcher) is called, and
// the scene turns that watcher into a fight (otherside1.js, combat/ghoul.js).
//
//   const w = new Watchers(scene, cave, { count: 4, onAttack })
//   w.update(dtMs)                  every frame, after cave.update
//   w.busy = true                   a fight is on: nothing opens, whatever is open shuts
//   w.challenge()                   the player has saluted: the nearest open pair steps forward (a fight, as onAttack)
//   w.destroy()
//
// The camera looks north and sees only about three and a half tiles across, so they open ahead of you, in the
// dark cells the screen shows beyond your light (never behind rock, never lit). Drawn in the row they are in
// (cave.rows), so nearer rock covers them.
//
// Each watcher: hidden (waits for you to be still, then looks for a place: dark, 5.7 to 11.5 tiles off, in
// sight of you, not another's) -> opening (fades in over a second) -> watching (creeps toward your light's edge)
// -> closing (you moved away, lost sight of it, or it has watched long enough) | attacking (the light reached it).

const GREEN = [120, 255, 140]
const MIN_OPEN = 5.7, MAX_OPEN = 11.5
const DARK = 0.05          // the brightest a spot may be and still be where they open or creep to
const LIT = 0.10           // lit this much: it charges
const CLOSE = 3.8          // you come this near: it charges
const STILL = 1.2          // seconds you must have stood still for them to open
const CREEP = 0.45         // tiles a second toward the light's edge
const sstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t) }
const rnd = (a, b) => a + Math.random() * (b - a)

export default class Watchers {
  constructor(scene, cave, { count = 4, audio = null, onAttack = null } = {}) {
    this.scene = scene; this.cave = cave; this.audio = audio; this.onAttack = onAttack
    this.busy = false
    this.still = 0
    this.list = []
    for (let i = 0; i < count; i++) {
      this.list.push({ state: 'hidden', t: i === 0 ? 3 : rnd(3, 10), a: 0, post: null, life: 0, prevD: 0, probe: 0, away: 0, phase: rnd(0, 6) })
    }
    // one draw per row, pushed after that row's rock so they sit in front of its wall
    for (let r = 0; r < cave.H; r++) cave.rows[r].push({ draw: (ctx, pgr) => this._draw(ctx, pgr, r) })
  }

  _seen(p) {                      // is there a clear line from the torch to this post?
    const c = this.cave
    return c._ray(c.px, c.py, p.x, p.y, Math.floor(p.x), Math.floor(p.y))
  }

  _onScreen(p) {
    const pgr = this.scene.perspectiveGround
    const pt = this.cave._G(pgr, p.x, p.y, p.z)
    if (!pt) return false
    return pt.x > 24 && pt.x < pgr._sw - 24 && pt.y > 24 && pt.y < pgr._sh - 250
  }

  _place(w) {
    const c = this.cave
    const opts = []
    for (let r = Math.floor(c.py - 12); r <= Math.floor(c.py - 4); r++) for (let cc = Math.floor(c.px - 4); cc <= Math.floor(c.px + 4); cc++) {
      if (c.isRock(cc, r) || c.blocks(cc, r)) continue
      const p = { x: cc + 0.5 + (Math.random() - 0.5) * 0.4, y: r + 0.5, z: 0.85 + Math.random() * 0.5 }
      const d = Math.hypot(p.x - c.px, p.y - c.py)
      if (d < MIN_OPEN || d > MAX_OPEN) continue
      if (c.brightSmooth(p.x, p.y) > DARK) continue
      if (this.list.some(o => o !== w && o.post && Math.hypot(o.post.x - p.x, o.post.y - p.y) < 2.2)) continue
      if (!this._seen(p) || !this._onScreen(p)) continue
      opts.push(p)
    }
    if (!opts.length) return false
    const p = opts[Math.floor(Math.random() * opts.length)]
    w.post = p; w.state = 'opening'; w.life = rnd(12, 24); w.prevD = Math.hypot(p.x - c.px, p.y - c.py); w.probe = 0.3; w.away = 0
    this.audio?.eyeOpen(this._pan(p))
    return true
  }

  // You salute the eyes (swipe up, en garde): the nearest that is open steps forward and the fight begins, as if the light
  // had reached it. Returns its post {x, y, z}, or null if none is open.
  challenge() {
    if (this.busy || !this.onAttack) return null
    const c = this.cave
    let best = null, bd = Infinity
    for (const w of this.list) {
      if ((w.state !== 'opening' && w.state !== 'watching') || w.a < 0.3 || !w.post) continue
      const d = Math.hypot(w.post.x - c.px, w.post.y - c.py)
      if (d < bd) { bd = d; best = w }
    }
    if (!best) return null
    best.state = 'attacking'
    this.onAttack(best, best.post)
    return best.post
  }

  _pan(p) { return Math.max(-1, Math.min(1, (p.x - this.cave.px) / 8)) }

  _close(w, fast) {
    if (w.state === 'closing' || w.state === 'attacking') return
    w.state = 'closing'; w.fast = fast
    if (fast && w.post) this.audio?.eyeVanish(this._pan(w.post))
  }

  update(dtMs) {
    const dt = dtMs / 1000, c = this.cave, pl = this.scene.player
    if (c.px === undefined) return
    const moving = !!(pl && (pl.isMoving || pl.pathQueue?.length))
    this.still = moving ? 0 : this.still + dt
    let seeing = 0
    for (const w of this.list) {
      if (w.state === 'hidden') {
        w.t -= dt
        if (!this.busy && this.still >= STILL && w.t <= 0 && !this._place(w)) w.t = 1.2
        else if (w.t <= 0 && (this.busy || this.still < STILL)) w.t = 0.5
        continue
      }
      const p = w.post
      const d = Math.hypot(p.x - c.px, p.y - c.py)
      if (w.state === 'attacking') { w.a = Math.max(0, w.a - dt / 0.25); if (w.a <= 0) { w.state = 'hidden'; w.post = null; w.t = rnd(8, 16) } continue }
      if (this.busy) this._close(w, true)

      if (w.state !== 'closing') {
        const lit = c.brightSmooth(p.x, p.y)
        if (lit > LIT || d < CLOSE) {                       // the light has reached it
          if (!this.busy && w.a > 0.5 && this.onAttack) { w.state = 'attacking'; this.onAttack(w, p); continue }
          this._close(w, true)
        }
        // while you stand still it creeps to the edge of your light; if you move, it only stays while you come toward it
        if (!moving) {
          w.away = 0
          if (d > 4.6) {
            const nx = p.x + (c.px - p.x) / d * CREEP * dt, ny = p.y + (c.py - p.y) / d * CREEP * dt
            if (!c.isRock(Math.floor(nx), Math.floor(ny)) && !c.blocks(Math.floor(nx), Math.floor(ny)) && c.brightSmooth(nx, ny) <= DARK) { p.x = nx; p.y = ny }
          }
          w.prevD = d; w.probe = 0.3
        } else if ((w.probe -= dt) <= 0) {
          w.probe = 0.3
          if (d < w.prevD - 0.12) w.away = 0; else w.away += 0.3
          w.prevD = d
          if (w.away >= 0.6) this._close(w, true)
        }
        if (!this._seen(p) || !this._onScreen(p) && (w.off = (w.off || 0) + dt) > 0.8) this._close(w, true)
        else if (this._onScreen(p)) w.off = 0
        if ((w.life -= dt) <= 0) this._close(w, false)
      }
      if (w.state === 'opening') { w.a = Math.min(1, w.a + dt / 1.1); if (w.a >= 1) w.state = 'watching' }
      else if (w.state === 'closing') {
        w.a = Math.max(0, w.a - dt / (w.fast ? 0.22 : 1.3))
        if (w.a <= 0) { w.state = 'hidden'; w.post = null; w.t = rnd(5, 12) }
      }
      if (w.a > 0.4) seeing++
    }
    this.audio?.setWatched(seeing)
  }

  _draw(ctx, pgr, row) {
    const c = this.cave
    for (const w of this.list) {
      const p = w.post
      if (!p || w.a <= 0.01 || Math.floor(p.y) !== row) continue
      const pt = c._G(pgr, p.x, p.y, p.z)
      if (!pt) continue
      const s = pgr._scaleAtRow(p.y)
      const d = Math.hypot(p.x - c.px, p.y - c.py)
      // dimmer the further off, and as any light reaches them
      const a = w.a * (1 - sstep(MAX_OPEN - 2.5, MAX_OPEN + 1, d)) * (1 - sstep(DARK, 0.2, c.brightSmooth(p.x, p.y)))
      if (a <= 0.01) continue
      const [r, g, b] = GREEN
      const sep = 0.14 * s, rad = 0.032 * s, breath = 0.88 + 0.12 * Math.sin(performance.now() / 700 + w.phase)
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const side of [-1, 1]) {
        const x = pt.x + side * sep, y = pt.y
        const gr = ctx.createRadialGradient(x, y, 0, x, y, rad * 4.5)
        gr.addColorStop(0, `rgba(${r},${g},${b},${(0.4 * a * breath).toFixed(3)})`)
        gr.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.fillStyle = gr
        ctx.beginPath(); ctx.arc(x, y, rad * 4.5, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = `rgba(${r},${g},${b},${(0.95 * a * breath).toFixed(3)})`
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
    }
  }

  destroy() {
    this.list = []
    this.audio?.setWatched(0)
  }
}

// watchers.js
// Location: js/game/effects/watchers.js
//
// Eyes in the dark. A few somethings that watch you from beyond your torch: a pair of pale points that open
// in a passage ahead, in the black where your light does not reach, and look at you. They are only ever in
// the dark and only ever far: come within a few strides, or let your light fall on them, and they shut and
// are gone -- and later open again, somewhere else you can see, further off. Never in a place you cannot see
// (the line from you to them is checked, and what stands in the way hides them as it hides anything).
//
//   const w = new Watchers(scene, cave, posts, { count: 5, audio })
//   w.update(dtMs)                  every frame, after cave.update
//   w.destroy()
//
// The camera looks north and sees only about three and a half tiles across, so a pair of eyes off to the side of
// you would never be on the screen: they open ahead of you, in the dark cells of the floor that the screen shows
// beyond your light (never behind rock, never lit). Drawn in the row they are in (cave.rows), so nearer rock
// covers them. audio: an UnderworldAudio (optional). posts (optional) are extra places they may favour.
//
// Each watcher: hidden (waits, then looks for a post to open at: dark, 6 to 11.5 tiles off, in sight of you,
// not another's) -> opening (fades in over a second) -> watching (follows you with its pupils, blinks now and
// then) -> closing (when you come near, light it, lose sight of it, or it has watched long enough).

const COLOURS = [
  [255, 236, 170],    // pale gold
  [196, 236, 255],    // ice
  [208, 255, 170],    // sickly green
  [255, 214, 190],    // dim rose
  [255, 150, 90],     // ember (rare)
]
const NEAR = 5.0          // closer than this and they go
const MIN_OPEN = 5.7, MAX_OPEN = 11.5
const DARK = 0.05         // the brightest a spot may be and still be where they open
const sstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t) }
const rnd = (a, b) => a + Math.random() * (b - a)

export default class Watchers {
  constructor(scene, cave, posts, { count = 5, audio = null } = {}) {
    this.scene = scene; this.cave = cave; this.posts = posts || []; this.audio = audio
    this.list = []
    for (let i = 0; i < count; i++) {
      this.list.push({
        state: 'hidden', t: i === 0 ? 7 : rnd(5, 16), a: 0, post: null, life: 0, blink: 0, blinkIn: rnd(2, 5),
        col: COLOURS[i === count - 1 ? 4 : i % 4], size: rnd(0.85, 1.25), look: 0, lastPost: -1,
      })
    }
    // one draw per row that has a post in it, pushed after that row's rock so they sit in front of its wall
    for (let r = 0; r < cave.H; r++) cave.rows[r].push({ draw: (ctx, pgr) => this._draw(ctx, pgr, r) })
  }

  _seen(p) {                      // is there a clear line from the torch to this post?
    const c = this.cave
    return c._ray(c.px, c.py, p.x, p.y, Math.floor(p.x), Math.floor(p.y))
  }

  // where on the screen a spot is (null if it is off it)
  _onScreen(p) {
    const pgr = this.scene.perspectiveGround
    const pt = this.cave._G(pgr, p.x, p.y, p.z)
    if (!pt) return false
    return pt.x > 24 && pt.x < pgr._sw - 24 && pt.y > 24 && pt.y < pgr._sh - 250
  }

  _place(w) {
    const c = this.cave, md = this.scene.mapData
    const opts = []
    for (let r = Math.floor(c.py - 12); r <= Math.floor(c.py - 4); r++) for (let cc = Math.floor(c.px - 4); cc <= Math.floor(c.px + 4); cc++) {
      if (c.isRock(cc, r) || c.blocks(cc, r)) continue
      const p = { x: cc + 0.5 + (Math.random() - 0.5) * 0.4, y: r + 0.5, z: 0.85 + Math.random() * 0.8 }
      const d = Math.hypot(p.x - c.px, p.y - c.py)
      if (d < MIN_OPEN || d > MAX_OPEN) continue
      if (c.brightSmooth(p.x, p.y) > DARK) continue
      if (this.list.some(o => o !== w && o.post && Math.hypot(o.post.x - p.x, o.post.y - p.y) < 2.2)) continue
      if (!this._seen(p) || !this._onScreen(p)) continue
      opts.push(p)
    }
    if (!opts.length) return false
    const p = opts[Math.floor(Math.random() * opts.length)]
    w.post = p; w.state = 'opening'; w.life = rnd(9, 20); w.blinkIn = rnd(1.5, 4); w.off = 0
    this.audio?.eyeOpen(this._pan(p))
    return true
  }

  _pan(p) { return Math.max(-1, Math.min(1, (p.x - this.cave.px) / 8)) }

  update(dtMs) {
    const dt = dtMs / 1000, c = this.cave
    if (c.px === undefined) return
    let seeing = 0
    for (const w of this.list) {
      if (w.state === 'hidden') {
        w.t -= dt
        if (w.t <= 0 && !this._place(w)) w.t = 1.2
        continue
      }
      const p = w.post
      const d = Math.hypot(p.x - c.px, p.y - c.py)
      const lit = c.brightSmooth(p.x, p.y) > 0.16
      const onScreen = this._onScreen(p)
      w.off = onScreen ? 0 : w.off + dt
      const gone = d < NEAR || lit || !this._seen(p) || w.off > 0.8
      if (w.state !== 'closing') {
        if (gone) { w.state = 'closing'; w.fast = true; this.audio?.eyeVanish(this._pan(p)) }
        else if ((w.life -= dt) <= 0) { w.state = 'closing'; w.fast = false }
      }
      if (w.state === 'opening') { w.a = Math.min(1, w.a + dt / 1.1); if (w.a >= 1) w.state = 'watching' }
      else if (w.state === 'closing') {
        w.a = Math.max(0, w.a - dt / (w.fast ? 0.22 : 1.3))
        if (w.a <= 0) { w.state = 'hidden'; w.post = null; w.t = rnd(4, 11) }
      }
      // blinks
      if ((w.blinkIn -= dt) <= 0) { w.blink = 0.22; w.blinkIn = rnd(2.2, 6) }
      if (w.blink > 0) w.blink = Math.max(0, w.blink - dt)
      // the way they look: towards you, a little behind
      if (w.post) w.look += (Math.sign(c.px - w.post.x) - w.look) * Math.min(1, dt * 2)
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
      // dimmer the further off, and dimmer as any light reaches them
      const a = w.a * (1 - sstep(MAX_OPEN - 2.5, MAX_OPEN + 1, d)) * (1 - sstep(DARK, 0.2, c.brightSmooth(p.x, p.y)))
      if (a <= 0.01) continue
      const [r, g, b] = w.col
      const sep = 0.15 * s * w.size
      const lid = w.blink > 0 ? Math.abs(w.blink / 0.22 - 0.5) * 2 : 1          // 1 open .. 0 shut .. 1
      const ew = 0.07 * s * w.size, eh = 0.042 * s * w.size * Math.max(0.08, lid)
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const side of [-1, 1]) {
        const x = pt.x + side * sep, y = pt.y
        // the glow it throws
        const gr = ctx.createRadialGradient(x, y, 0, x, y, ew * 3.6)
        gr.addColorStop(0, `rgba(${r},${g},${b},${(0.34 * a).toFixed(3)})`)
        gr.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.fillStyle = gr
        ctx.beginPath(); ctx.arc(x, y, ew * 3.6, 0, Math.PI * 2); ctx.fill()
        // the eye: an almond, brightest in the middle
        ctx.fillStyle = `rgba(${r},${g},${b},${(0.95 * a).toFixed(3)})`
        ctx.beginPath(); ctx.ellipse(x, y, ew, eh, side * 0.18, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'
      for (const side of [-1, 1]) {                    // the pupils: dark slits, turned to you
        if (lid < 0.35) continue
        const x = pt.x + side * sep + w.look * ew * 0.35, y = pt.y
        ctx.fillStyle = `rgba(8,6,4,${(0.85 * a).toFixed(3)})`
        ctx.beginPath(); ctx.ellipse(x, y, ew * 0.2, eh * 0.85, 0, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
    }
  }

  destroy() {
    this.list = []; this.posts = []
    this.audio?.setWatched(0)
  }
}

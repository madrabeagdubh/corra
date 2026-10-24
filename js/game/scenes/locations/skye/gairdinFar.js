// gairdinFar.js
// Location: js/game/scenes/locations/skye/gairdinFar.js
//
// What stands in the view north of the garden (the vista map skye_gairdin_n, drawn beyond row 0): Conall's
// cottage on the west bank, near but in the background, a thread of smoke going up; and the heron, a huge one,
// standing in the shallows among rocks and reeds (the set piece that opens the course: faicheCourse.js _watch).
// Drawn on the ground canvas
// with the same projection as the ground (so it foreshortens and parallaxes with it) and hazed a little.
// (The lake's still water, the sea beyond the hills and the far coast are the scene's far backdrop:
// skyeGairdin.js getFarBackdrop, drawn by effects/pgr/pgrFarBackdrop.js.)
//
//   const far = new GairdinFar()
//   far.draw(ctx, pgr)        from the scene's drawFarHost(ctx, pgr)
//   far.dawn = 0..1           the pink dawn: haze and silhouettes shift from the grey of day toward rose and violet
//   far.play('tilt' | 'strike' | 'rise' | 'stand')     the heron's moves
//
// Positions are LOCAL tiles of the vista map (row 35 is the one next to the garden).

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`
const HAZE = [188, 196, 193]
const HAZE_DAWN = [232, 186, 190]                           // the rose of the dawn haze
const SIL = [58, 62, 84], SIL_DAWN = [54, 50, 96]           // silhouettes: slate by day, blue-violet at dawn

// The heron, a grey heron as she is (heron units; she faces right; heights are measured UP from her feet, and the water
// lies 0.6 below them). She is a skeleton of a few numbers (the state S) that her moves animate by keyframes:
//   bx, hip, pitch      the body: where, how high the hips, how far it leans (degrees, front up)
//   hx, hy, beak, tilt  the HEAD, in the world, not on the body: where it is, which way the beak points (degrees, down is
//                       +), the cant of the head. Walking, the body moves under a head that does not (see walk).
//   sl                  how much slack the neck has (1: folded into its S, 0: stretched)
//   focus, open         the gleam in her eye, 0..1; the beak open, 0..1
//   fA, fAl, fB, fBl    each foot: its place on the rock, and how high it is lifted
//   ruf, oy             the folded wing lifted and shaken, 0..1; how far she has waded down off the rock
// A neck is a curve from the shoulder to the head that is S-shaped when the head is near and straight when it is far.
const LN = 2.8, LEG = 1.45, BEAK = 1.3, DEG = Math.PI / 180
const REST = { bx: -0.9, hip: 2.1, pitch: 24, hx: 0.7, hy: 4.0, beak: 12, tilt: 0, focus: 0.1, open: 0, fA: -1.2, fAl: 0, fB: -0.6, fBl: 0, ruf: 0, oy: 0, sl: 1 }
const EASE = { io: u => 0.5 - 0.5 * Math.cos(Math.PI * u), o: u => 1 - Math.pow(1 - u, 3), i: u => u * u }
const STEP = 2.3                                                 // seconds a step takes (three of them)
// the tracks for n steps of `step` seconds: each foot in turn rises, hangs, reaches forward and settles; the body creeps over
// it; the head stays where it was in the world until the step is done, then glides forward
// a track of quick moves with holds between: [[time, value, seconds it takes], ...]. She does not drift from pose to pose; she
// holds, and then moves, all at once (a bird's head is still, then it is somewhere else)
const sn = (v0, steps) => { const o = []; let v = v0; for (const [t, x, d = 0.12] of steps) { o.push([t, v], [t + d, x, 'o']); v = x } return o }
const walkTracks = (S0, n, step, pause = 0, lead = 0) => {
  const k = step / STEP, tr = { bx: [], hx: [], fA: [], fAl: [], fB: [], fBl: [], pitch: [] }
  let bx = S0.bx, hx = S0.hx; const f = { A: S0.fA, B: S0.fB }
  for (let i = 0; i < n; i++) {
    const t = lead + i * (step + pause), w = i % 2 === 0 ? 'A' : 'B', x0 = f[w], x1 = x0 + 1
    tr['f' + w + 'l'].push([t, 0], [t + 0.8 * k, 1], [t + 1.7 * k, 1], [t + 2.05 * k, 0])
    tr['f' + w].push([t + 0.7 * k, x0], [t + 1.7 * k, x1]); f[w] = x1
    tr.bx.push([t + 0.5 * k, bx + 0.03], [t + 2.05 * k, bx + 0.5]); bx += 0.5
    tr.pitch.push([t + 0.5 * k, S0.pitch + 2], [t + 2.05 * k, S0.pitch])
    tr.hx.push([t + 2.0 * k, hx], [t + 2.35 * k, hx + 0.5, 'o']); hx += 0.5
  }
  return tr
}
// The hunt: she is low, the back nearly level, the head carried forward and down, the neck folded. Three steps, each followed by
// a stillness and a scan (the head cocked one way, then the other). `lead` is the time she takes to sink into the crouch first.
const STALK = { hip: 1.75, pitch: 9, hy: 2.9, beak: 30, lead: 1.0, step: 2.0, pause: 1.2 }
const WALK_T = STALK.lead + 3 * (STALK.step + STALK.pause)      // seconds from the start of 'walk' to the start of 'aim'
// Bullet time (the game's own: meleeBout.js cueFocus, wired by skyeGairdin.js onSlow): on as the fish leaves the water (riseAt, 0.72 s into the strike), through the flip and the catch (0.65 s into 'eat'), off just
// after the catch. Seconds into the 'strike' phase, and into the 'eat' phase (it is 0.9 s after the strike began).
const SLOW_IN = 0.7, SLOW_OUT = 0.8

// Each phase is a set of tracks: key -> [[seconds, value, easing], ...], from the state the last phase ended in.
const PHASES = {
  // The stalk: she sinks into a hunch, then three slow deliberate steps. Each: the foot rises, hangs, reaches forward and settles;
  // the body creeps over it; the head stays exactly where it was in the world until the step is done, then comes forward in a
  // quick glide, and she is still and scans before the next.
  walk(S0) {
    const H = STALK, cyc = H.step + H.pause, k = H.step / STEP
    const tr = walkTracks({ ...S0, hip: H.hip, pitch: H.pitch, hy: H.hy, beak: H.beak }, 3, H.step, H.pause, H.lead)
    tr.hip = [[H.lead, H.hip]]; tr.hy = [[H.lead, H.hy]]; tr.beak = [[H.lead, H.beak]]; tr.pitch.unshift([H.lead, H.pitch])
    tr.focus = [[0, S0.focus], [WALK_T, 0.6]]
    tr.tilt = []                                                  // scanning, in each stillness once the head has glided forward
    for (let i = 0; i < 3; i++) { const s = H.lead + i * cyc + 2.4 * k; tr.tilt.push(...sn(0, [[s + 0.1, 10], [s + 0.55, -8], [s + 0.95, 0]])) }
    return tr
  },
  // Away: five steps, a little quicker, wading down off the rock into the shallows, the head held as before
  leave(S0) {
    const tr = walkTracks(S0, 6, 1.9)
    tr.oy = [[2.5, 0], [6.5, -0.55]]; tr.focus = [[1, 0.15]]
    return tr
  },
  // Still. The head comes down and the beak to the water, the body leans and sinks; then the head is cocked, held, cocked
  // the other way; the eye gleams. (It holds until she strikes.)
  aim(S0) {
    const x = S0.bx
    return {
      hip: sn(S0.hip, [[2.0, S0.hip - 0.1, 0.3], [5.2, S0.hip - 0.2, 0.3]]), pitch: sn(S0.pitch, [[2.0, S0.pitch - 3, 0.3], [5.2, S0.pitch - 6, 0.3]]), bx: sn(S0.bx, [[2.0, x + 0.07, 0.3], [5.2, x + 0.15, 0.3]]),
      hx: sn(S0.hx, [[0.8, x + 1.5, 0.15], [2.6, x + 1.9, 0.15], [4.0, x + 2.25, 0.15], [5.2, x + 2.6, 0.2]]),
      hy: sn(S0.hy, [[0.8, S0.hy - 0.3, 0.15], [2.6, S0.hy - 0.7, 0.15], [4.0, S0.hy - 1.1, 0.15], [5.2, S0.hy - 1.5, 0.2]]),
      beak: sn(S0.beak, [[0.8, S0.beak + (58 - S0.beak) * 0.26, 0.15], [2.6, S0.beak + (58 - S0.beak) * 0.52, 0.15], [4.0, S0.beak + (58 - S0.beak) * 0.83, 0.15], [5.2, 58, 0.2]]),
      focus: [[0, S0.focus], [5.6, 1]],
      tilt: sn(0, [[6.6, 11, 0.12], [7.8, 0, 0.12], [9.8, -7, 0.12], [11.0, 0, 0.12], [13.0, 9, 0.12], [14.2, 0, 0.12]]),
    }
  },
  // The strike: all at once. The beak is in the water and out again in a snap, and the silver goes up with it: it leaves the water
  // at 0.72 s (see riseAt, _fish) and is already in the air when 'eat' begins at 0.9.
  strike(S0) {
    const b = S0.bx + 0.5
    return {
      bx: [[0.3, b, 'o'], [0.75, b], [0.85, b - 0.1, 'o']], hip: [[0.3, 1.7, 'o'], [0.75, 1.7], [0.9, 2.1, 'o']], pitch: [[0.3, -10, 'o'], [0.75, -10], [0.9, 24, 'o']],
      hx: [[0.3, b + 2.56, 'o'], [0.7, b + 2.56], [0.8, b + 2.1, 'o'], [0.9, b + 2.1]], hy: [[0.3, 0.375, 'o'], [0.7, 0.375], [0.8, 2.2, 'o'], [0.9, 2.2]],
      beak: [[0.3, 78, 'o'], [0.7, 78], [0.8, 50, 'o'], [0.9, 50]], focus: [[0.3, 1], [0.9, 0.7]], tilt: [[0.3, 0]],
    }
  },
  // The catch: the head goes up after the silver, the beak opens, it is caught (0.65 s in) head-first and gulped; then the head
  // jerks up, once, twice, the folded wing is shaken out, and she settles back into her stillness. All of it quick.
  eat(S0) {
    const h = S0.hy, x = S0.bx
    return {
      beak: sn(S0.beak, [[0.1, -30, 0.25], [0.75, -18, 0.15], [1.15, -46, 0.08], [1.35, -12, 0.12], [1.75, -44, 0.08], [1.95, -10, 0.12], [2.9, 12, 0.2]]),
      hy: sn(h, [[0.1, h + 0.9, 0.25], [0.75, h + 0.5, 0.15], [1.15, h + 1.25, 0.08], [1.35, h + 0.7, 0.12], [1.75, h + 1.3, 0.08], [1.95, h + 0.75, 0.12], [2.9, 4.0, 0.2]]),
      hx: sn(S0.hx, [[0.1, S0.hx - 0.3, 0.25], [0.75, x + 1.2, 0.15], [2.9, x + 1.6, 0.2]]),
      open: [[0.35, 0], [0.45, 1, 'o'], [0.7, 1], [0.78, 0, 'o']], focus: [[0.3, 0.3], [3.5, 0.1]],
      sl: [[0.1, 1], [0.2, 0.4], [0.7, 0.4], [1.2, 1]],
      ruf: [[2.4, 0], [2.5, 1, 'o'], [2.7, 0.35], [2.8, 1, 'o'], [3.1, 0]],
    }
  },
}

export default class GairdinFar {
  constructor(opts = {}) {
    this.cottage = { col: 3.3, row: 28, size: 0.8, fog: 0.3, ...opts.cottage }
    // the heron: local vista tile (col, row), her height in tiles at that distance (she is larger than life), facing -1 left / 1 right
    this.heron = { col: 17.7, row: 27, tall: 1.35, face: 1, ...opts.heron }
    this.dawn = 0
    this.zoom = 1; this.zoomWant = 1; this.zoomMs = 3000                  // the push in on her (1: as she stands in the distance)
    this.vis = 0; this.visWant = 0; this.visMs = 1
    this.show = false                                       // the heron is only there for the set piece
    this.fog = 1; this.fogWant = 1; this.fogMs = 3000          // the lake lies in fog from the start
    this.S = { ...REST }; this.tl = []; this.cur = { n: 'stand', at: 0, S0: { ...REST }, tr: {} }; this.flyAt = 0; this._hit = true; this._hitX = 3.8
    this.strikeAt = -1e9; this.riseAt = -1e9
    this.t = 0
    this.rate = 1                                           // how fast her clock runs (the scene sets it: bullet time slows the world)
    this.onSlow = null                                      // (on) => ...: the strike's slow begins and ends (the scene turns the game's bullet time on)
    this._slow = false; this._preyAlive = true; this._preyX = 4.08
    this._darts = []; this._fp = null; this._dartAt = -1e9; this._glintAt = -1e9; this._hm = false; this._dn = 0      // the prey's darts (see _dart)
    this.last = performance.now()
    this._fogImage()                                         // (loaded now, so it is there when the fog is needed)
    // reeds and rocks, in heron units across her feet (fixed: seeded)
    let s = 7
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
    this.reeds = Array.from({ length: 38 }, () => {
      const side = rnd() < 0.5 ? -1 : 1
      return { x: side * (0.9 + rnd() * 4.2), h: 1.3 + rnd() * 2.1, ph: rnd() * 6.28, lean: (rnd() - 0.5) * 0.4, w: 0.045 + rnd() * 0.03 }
    })
    this.rocks = [[-2.1, 0.05, 1.0, 0.36], [2.0, 0.03, 0.9, 0.3], [-3.6, 0.02, 0.7, 0.24], [3.7, 0.04, 0.9, 0.3], [0.1, 0.14, 1.7, 0.78]]       // the last is the one she stands on
    this.mist = Array.from({ length: 4 }, (_, i) => ({ y: -0.4 - i * 0.9, x: (rnd() - 0.5) * 6, w: 7 + rnd() * 5, v: 0.06 + rnd() * 0.06, a: 0.14 + 0.06 * rnd() }))
  }

  /** how much of her can be seen, 0..1, eased over ms: she is brought up out of the fog */
  /** push in on her (or out): 1 is as she stands in the distance, about 2.4 is all the way in; eased over ms */
  setZoom(v, ms = 3000) { this.zoomWant = v; this.zoomMs = Math.max(1, ms) }
  setVis(v, ms = 3000) { this.visWant = v; this.visMs = Math.max(1, ms) }

  /** a move of the heron's: 'walk' (then, still, she takes aim), 'strike' (then she eats), 'leave' (she stalks away), 'stand' */
  play(name) {
    const t = this.t
    this.tl = this.tl.filter(e => e.at <= t)                    // (a new move cancels what was still to come)
    if (name === 'tilt') name = 'walk'
    if (name === 'reach') name = 'strike'
    if (name === 'stand') { this.tl = []; this._start('stand', t, { ...REST }); return }
    if (name === 'walk') this.tl.push({ n: 'walk', at: t }, { n: 'aim', at: t + WALK_T + 0.1 })
    else if (name === 'aim') this.tl.push({ n: 'aim', at: t })
    else if (name === 'strike') { this.tl.push({ n: 'strike', at: t }, { n: 'eat', at: t + 0.9 }); this.riseAt = t + 0.72; this._hit = false }
    else if (name === 'leave') this.tl.push({ n: 'leave', at: t })
  }

  draw(ctx, pgr) {
    if (!pgr?._cameraReady?.() || !pgr._northNeighbor) return
    const now = performance.now(); if (!this.freeze) this.t += Math.min(0.1, (now - this.last) / 1000) * this.rate; this.last = now
    this._pose()
    this.fog += (this.fogWant - this.fog) * (1 - Math.exp(-Math.min(0.1, (now - (this._ft || now)) / 1000) * 1000 / Math.max(1, this.fogMs) * 2.2)); this._ft = now
    this.zoom += (this.zoomWant - this.zoom) * (1 - Math.exp(-Math.min(0.1, (now - (this._zt || now)) / 1000) * 1000 / Math.max(1, this.zoomMs) * 2.2)); this._zt = now
    this.vis += (this.visWant - this.vis) * (1 - Math.exp(-Math.min(0.1, (now - (this._vt || now)) / 1000) * 1000 / this.visMs * 2.2)); this._vt = now
    this._haze(ctx, pgr)
    this._cottage(ctx, pgr, this.cottage)
    this._heron(ctx, pgr, this.heron)                      // (the lake, rock, reeds, mist and fog are always there; the bird only when she is seen)
  }

  /** the colour of the haze at the garden's north edge: the water tiles are tinted to this there, so the join is seamless */
  hazeColor() { return mix(HAZE, HAZE_DAWN, this.dawn) }

  _start(n, at, S0) {
    this.cur = { n, at, S0, tr: PHASES[n] ? PHASES[n](S0) : {} }
    // where the beak will come down, in heron units (the fish lies there: _prey): the strike's reach from where she will stand
    if (n === 'walk') { this._preyX = S0.bx + 4.98; this._preyAlive = true; this._darts = []; this._fp = null } else if (n === 'aim') this._preyX = S0.bx + 3.48
    else if (n === 'stand') { this._preyAlive = true; this._darts = []; this._fp = null }
  }
  // the state at `tau` seconds into a phase: every track eased from where the phase began
  _sample(c, tau) {
    const S = { ...c.S0 }
    for (const k in c.tr) {
      let t0 = 0, v0 = c.S0[k], val = v0
      for (const [t1, v1, e] of c.tr[k]) {
        if (tau <= t1) { const u = t1 > t0 ? Math.max(0, (tau - t0) / (t1 - t0)) : 1; val = v0 + (v1 - v0) * EASE[e || 'io'](u); break }
        t0 = t1; v0 = v1; val = v1
      }
      S[k] = val
    }
    return S
  }
  _pose() {
    while (this.tl.length && this.tl[0].at <= this.t) {                  // (phases are stepped through in order, so a jump in time lands right)
      const nx = this.tl.shift()
      this._start(nx.n, nx.at, this._sample(this.cur, nx.at - this.cur.at))
    }
    const tau = this.t - this.cur.at
    this.S = this._sample(this.cur, tau)
    if (this.cur.n === 'strike' && !this._hit && tau >= 0.27) {          // the beak goes in: a ring, a splash
      this._hit = true; this.strikeAt = this.t; this._hitX = this._geom(this.S).tip[0]; this._preyAlive = false; this._darts = []     // (the fish is taken)
    }
    // the prey answers her head: when the head begins to move (a tilt, a glide forward, a lunge) something darts in the water (see _dart),
    // and a lone faint dart now and then between, so it is never still for long. (Hunting only: in the strike it holds its place.)
    const dtp = this.t - (this._pt ?? this.t); this._pt = this.t
    const ph = this._ph || (this._ph = { x: this.S.hx, y: this.S.hy, tilt: this.S.tilt })
    if (dtp > 1e-4 && (this.cur.n === 'walk' || this.cur.n === 'aim') && this._preyAlive) {
      const vh = Math.hypot(this.S.hx - ph.x, this.S.hy - ph.y) / dtp, vt = Math.abs(this.S.tilt - ph.tilt) / dtp
      const moving = vh > 2.5 || vt > 60
      if (moving && !this._hm && this.t - this._dartAt > 0.45) this._dart(Math.min(1, 0.35 + vh / 14 + vt / 400))
      else if (!moving && this.t - this._dartAt > 2.4) this._dart(0.3)
      this._hm = moving
    }
    ph.x = this.S.hx; ph.y = this.S.hy; ph.tilt = this.S.tilt
    // the slow: from the fish leaving the water until just after the catch
    const slow = (this.cur.n === 'strike' && tau >= SLOW_IN) || (this.cur.n === 'eat' && tau < SLOW_OUT)
    if (slow !== this._slow) { this._slow = slow; this.onSlow?.(slow) }
  }
  // a colour, hazed: by day grey, at dawn rose
  _c(base, dawnBase, fog, a = 1) {
    const b = mix(base, dawnBase, this.dawn), h = mix(HAZE, HAZE_DAWN, this.dawn), m = mix(b, h, fog)
    return a >= 1 ? rgb(m) : `rgba(${m[0]},${m[1]},${m[2]},${a})`
  }

  // The far shore lies in a haze that thickens with distance: a veil over everything beyond the garden's north edge,
  // thickest at the horizon, so the hills are only a grey-green memory and the heron's lake a long way off.
  _haze(ctx, pgr) {
    const yEdge = pgr._rowToScreenY(0)
    if (yEdge === null || yEdge === undefined || yEdge < 20) return
    const c = mix(HAZE, HAZE_DAWN, this.dawn).map(v => Math.round(v)), s = `${c[0]},${c[1]},${c[2]}`
    const g = ctx.createLinearGradient(0, 0, 0, yEdge)
    for (let i = 0; i <= 8; i++) { const u = i / 8, a = Math.min(0.92, 0.2 + 0.7 * Math.pow(1 - u, 0.65)); g.addColorStop(u, `rgba(${s},${a.toFixed(3)})`) }
    ctx.fillStyle = g; ctx.fillRect(0, 0, pgr._sw, yEdge)
  }

  // a thatched cottage on the bank, seen from the south across the shore
  _cottage(ctx, pgr, c) {
    const nb = pgr._northNeighbor
    const wr = c.row + 0.5 - nb.height                      // world row (negative: north of the garden)
    const y0 = pgr._rowToScreenY(wr)
    if (y0 === null) return
    const sc = pgr._scaleAtRow(wr)
    if (sc < 0.2) return
    const hv = (x, y) => nb.heightMap?.[y]?.[x] ?? 0
    const cx = Math.floor(c.col), cy = Math.floor(c.row)
    const h = (hv(cx, cy) + hv(cx + 1, cy) + hv(cx, cy + 1) + hv(cx + 1, cy + 1)) / 4
    const px = pgr._colToScreenX(c.col, wr)
    if (px < -sc * 12 || px > pgr._sw + sc * 12) return
    const k = (v, f = c.fog) => rgb(mix(v, HAZE, f))
    ctx.save()
    ctx.translate(px, y0 - h * sc)
    ctx.scale(sc * c.size, sc * c.size)     // 1 unit = 1 tile at size 1
    // the cottage: a low wall, a deep thatch, a chimney, a dark door
    const wall = k([200, 192, 170], c.fog + 0.05), thatch = k([86, 78, 52]), dark = k([46, 40, 34])
    ctx.fillStyle = wall; ctx.fillRect(-1.5, -1.3, 3, 1.3)
    ctx.fillStyle = thatch
    ctx.beginPath(); ctx.moveTo(-2.0, -1.2); ctx.lineTo(-0.9, -2.5); ctx.lineTo(0.9, -2.5); ctx.lineTo(2.0, -1.2); ctx.closePath(); ctx.fill()
    ctx.fillStyle = k([120, 112, 100]); ctx.fillRect(0.9, -3.1, 0.34, 0.9)
    ctx.fillStyle = dark; ctx.fillRect(-0.18, -0.75, 0.36, 0.75)
    // smoke: a thin thread, drifting and thinning as it climbs
    for (let j = 0; j < 14; j++) {
      const f = j / 13, y = -3.2 - f * 3.4
      const x = 1.08 + Math.sin(this.t * 0.7 + f * 4.2) * 0.22 * f + f * 0.9
      ctx.fillStyle = `rgba(214,216,210,${0.34 * (1 - f)})`
      ctx.beginPath(); ctx.arc(x, y, 0.16 + 0.22 * f, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }

  // the heron, her rocks and reeds and the mist, seen from the south across the shallows
  _heron(ctx, pgr, hr) {
    const nb = pgr._northNeighbor
    const wr = hr.row + 0.5 - nb.height
    const y0 = pgr._rowToScreenY(wr)
    if (y0 === null) return
    const sc = pgr._scaleAtRow(wr)
    if (sc < 0.2) return
    const px = pgr._colToScreenX(hr.col, wr)
    const u = sc * hr.tall / 6.4 * this.zoom                  // one heron unit in px: 6.4 units from foot to crown
    const uf = sc * 4 / 6.4                                   // the fog's scale: the air does not grow when we push in on her
    if (px < -pgr._sw * 2 || px > pgr._sw * 3) return
    const t = this.t, fog = 0.18 + 0.1 * (1 - this.dawn) + 0.5 * this.fog      // in the thick of the fog she is nearly the colour of the air
    ctx.save()
    ctx.translate(px, y0)
    // mist behind her: soft rose-white bands drifting slowly
    for (const m of this.mist) {
      const x = ((m.x + t * m.v + 40) % 14) - 7
      const g = ctx.createRadialGradient(x * u, m.y * u, 0, x * u, m.y * u, m.w * u * 0.5)
      g.addColorStop(0, this._c([232, 232, 236], [250, 214, 216], 0, m.a)); g.addColorStop(1, this._c([232, 232, 236], [250, 214, 216], 0, 0))
      ctx.fillStyle = g
      ctx.save(); ctx.scale(1, 0.16); ctx.beginPath(); ctx.arc(x * u, m.y * u / 0.16, m.w * u * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.restore()
    }
    if (this.vis > 0.004) this._swirls(ctx, u, fog)
    // her reflection first (so everything stands on it): the same figure turned over, faint
    if (this.vis > 0.004) { ctx.save(); ctx.scale(1, -0.5); ctx.globalAlpha = 0.2 * this.vis; this._bird(ctx, u, hr.face, fog); ctx.restore() }
    // far reeds, rocks, her, near reeds
    this._reeds(ctx, u, t, fog, 0)
    for (const [x, y, rx, ry] of this.rocks) {
      ctx.fillStyle = this._c([54, 58, 76], [70, 58, 102], fog + 0.04)
      ctx.beginPath(); ctx.ellipse(x * u, y * u, rx * u, ry * u, 0, Math.PI, 0); ctx.fill()                  // the dome of the rock above the water
      ctx.fillStyle = this._c([138, 142, 158], [246, 190, 190], fog + 0.1, 0.5)
      ctx.beginPath(); ctx.ellipse(x * u + rx * u * 0.1, (y - ry * 0.55) * u, rx * u * 0.7, ry * u * 0.18, 0, Math.PI, 0); ctx.fill()   // the rim of dawn light on it
    }
    this._prey(ctx, u, hr.face)
    this._fogBanks(ctx, uf, false, px, pgr._sw)
    if (this.vis > 0.004) { ctx.save(); ctx.globalAlpha = this.vis; this._bird(ctx, u, hr.face, fog); ctx.restore() }
    this._ripples(ctx, u, hr.face)
    this._fogBanks(ctx, uf, true, px, pgr._sw)
    this._reeds(ctx, u, t, fog, 1)
    ctx.restore()
  }

  // reeds: thin sprung strokes, swaying (pass 0: the farther half, 1: the nearer)
  _reeds(ctx, u, t, fog, pass) {
    ctx.lineCap = 'round'
    ctx.strokeStyle = this._c([44, 48, 66], [58, 48, 92], fog)
    this.reeds.forEach((r0, i) => {
      if ((i % 2) !== pass) return
      const r = (pass === 1 && r0.x > 1.4 && r0.x < 5.4) ? { ...r0, h: r0.h * 0.4 } : r0          // (the near reeds stay low where the strike is)
      const sway = Math.sin(t * 0.9 + r.ph) * 0.14 * r.h + r.lean * r.h
      ctx.lineWidth = Math.max(1, r.w * u)
      ctx.beginPath(); ctx.moveTo(r.x * u, 0); ctx.quadraticCurveTo((r.x + sway * 0.3) * u, -r.h * 0.6 * u, (r.x + sway) * u, -r.h * u); ctx.stroke()
    })
  }

  // The prey: a sliver of silver under the water where her beak will come down. It is not still. Each time she shifts her head (a tilt, a
  // glide forward, the lunge of the eye) something answers in the water: it darts, in a direction of its own, fading in and out as it
  // goes, and flashes where it stops, with a ring after it, and her eye catches the flash. Hunting, it ranges wide of the mark; as she
  // settles to the strike it is drawn in to the one place (preyX) where the beak will come down. On the world's clock.
  _dart(power = 0.6) {
    if (!this._preyAlive) return
    const t = this.t, n = ++this._dn
    const h = k => { const x = Math.sin((n * 7 + k) * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
    const aim = this.cur.n === 'aim' ? Math.min(1, (t - this.cur.at) / 5.2) : this.cur.n === 'walk' ? 0 : 1
    const spread = 1.7 * (1 - aim) + 0.12 * aim                    // how far from the mark it may range
    const fp = this._fp || (this._fp = { x: this._preyX + 0.8 * (h(9) - 0.5) * 2, y: 0.18 })
    const a = h(1) * Math.PI * 2, len = 0.5 + 0.9 * h(2) * (0.5 + power)
    let x1 = fp.x + Math.cos(a) * len, y1 = fp.y + Math.sin(a) * len * 0.12         // (the water lies flat to us: the depth of it is shallow)
    x1 = this._preyX + Math.max(-spread, Math.min(spread, x1 - this._preyX)); y1 = Math.max(0.09, Math.min(0.3, y1))
    this._darts.push({ t0: t, dur: 0.3 + 0.12 * h(3), x0: fp.x, y0: fp.y, x1, y1, p: power })
    fp.x = x1; fp.y = y1
    this._dartAt = t; this._glintAt = t
    if (this._darts.length > 6) this._darts.shift()
  }
  _prey(ctx, u, face) {
    const vis = this.vis * (1 - 0.55 * this.fog)
    if (!this._preyAlive || vis < 0.03) return
    const t = this.t, fp = this._fp, S = 'rgb(228,238,252)'
    const sliver = (x, y, rx, ry, al) => { ctx.globalAlpha = al; ctx.fillStyle = S; ctx.beginPath(); ctx.ellipse(face * x * u, y * u, rx * u, ry * u, 0, 0, Math.PI * 2); ctx.fill() }
    ctx.save(); ctx.lineCap = 'round'
    if (fp) sliver(fp.x, fp.y, 0.4, 0.04, (0.06 + 0.03 * Math.sin(t * 1.7)) * vis)       // where it lies: a bare shimmer
    this._darts = this._darts.filter(d => t - d.t0 < d.dur + 1.5)
    for (const d of this._darts) {
      const age = t - d.t0, k = age / d.dur, w = 0.5 + 0.5 * d.p
      if (k <= 1) {                                                          // darting: a streak, in and out of the dark
        const at = q => { const e = 1 - (1 - q) * (1 - q); return [face * (d.x0 + (d.x1 - d.x0) * e) * u, (d.y0 + (d.y1 - d.y0) * e) * u] }
        const head = at(k), tail = at(Math.max(0, k - 0.3)), env = Math.pow(Math.sin(Math.PI * k), 1.2)
        ctx.globalAlpha = 0.55 * env * w * vis; ctx.strokeStyle = S; ctx.lineWidth = Math.max(1, u * 0.05)
        ctx.beginPath(); ctx.moveTo(tail[0], tail[1]); ctx.lineTo(head[0], head[1]); ctx.stroke()
        ctx.fillStyle = S; ctx.beginPath(); ctx.arc(head[0], head[1], Math.max(0.8, u * 0.03), 0, Math.PI * 2); ctx.fill()
      } else {
        const a2 = age - d.dur                                               // where it stopped: a flash, and a ring that barely spreads
        if (a2 < 0.22) { const f = 1 - a2 / 0.22; sliver(d.x1, d.y1, 0.46, 0.055, 0.5 * f * w * vis); sliver(d.x1, d.y1, 0.12, 0.012, 0.8 * f * w * vis) }
        const r = (0.1 + a2 * 0.5) * u
        ctx.globalAlpha = 0.2 * (1 - a2 / 1.5) * w * vis; ctx.strokeStyle = 'rgb(240,226,232)'; ctx.lineWidth = Math.max(1, u * 0.03)
        ctx.beginPath(); ctx.ellipse(face * d.x1 * u, 0.05 * u + (d.y1 - 0.05) * u * 0.3, r, r * 0.22, 0, 0, Math.PI * 2); ctx.stroke()
      }
    }
    ctx.restore()
  }

  // a ring spreading on the water where the beak went in, and the spray thrown up
  _ripples(ctx, u, face) {
    const age = this.t - this.strikeAt, X = face * this._hitX * u
    if (age < 0 || age > 2.4) return
    ctx.strokeStyle = 'rgba(240,226,232,0.5)'
    for (let k = 0; k < 3; k++) {
      const a = age - k * 0.28
      if (a < 0) continue
      const r = (0.3 + a * 1.5) * u, al = Math.max(0, 1 - a / 2) * 0.5
      ctx.globalAlpha = al; ctx.lineWidth = Math.max(1, u * 0.04)
      ctx.beginPath(); ctx.ellipse(X, 0.05 * u, r, r * 0.22, 0, 0, Math.PI * 2); ctx.stroke()
    }
    ctx.fillStyle = 'rgba(240,244,252,0.9)'
    for (let k = 0; k < 11 && age < 0.9; k++) {
      const vx = (k - 5) * 0.34, vy = 2.4 + (k % 4) * 0.5, y = vy * age - 4.6 * age * age
      if (y < 0) continue
      ctx.globalAlpha = 1 - age / 0.9; ctx.beginPath(); ctx.arc(X + vx * age * u, 0.05 * u - y * u, Math.max(1, u * 0.035), 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // ── her ──────────────────────────────────────────────────────────────────
  // a bearing-by-bearing curve (the neck, the tail): from (x, y), the bearing (degrees from vertical, toward +x) running
  // a0 + a1*f + a2*f^3, n steps of total length len, each step shrunk by `shrink` toward the end (a tail ends in a tight curl)
  _curve(x, y, a0, a1, a2, len, n = 28, shrink = 0, wave = 0, ph = 0) {
    const pts = [[x, y]]
    let w = 0; const ws = []
    for (let i = 0; i < n; i++) { const f = (i + 0.5) / n; const k = 1 - shrink * f; ws.push(k); w += k }
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n, a = (a0 + a1 * f + a2 * f * f * f + wave * f * Math.sin(f * 6.5 - ph)) * Math.PI / 180, dl = len * ws[i] / w
      x += Math.sin(a) * dl; y -= Math.cos(a) * dl; pts.push([x, y])
    }
    return pts
  }
  // a ribbon along points, width w0 at the start to w1 at the end
  _ribbon(ctx, pts, w0, w1, wEnd = null) {
    const n = pts.length - 1, L = [], R = []
    for (let i = 0; i <= n; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(n, i + 1)]
      let dx = p1[0] - p0[0], dy = p1[1] - p0[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d
      const f = i / n, w = (wEnd == null ? (w0 + (w1 - w0) * f) : (f < 0.5 ? w0 + (w1 - w0) * (f / 0.5) : w1 + (wEnd - w1) * ((f - 0.5) / 0.5))) / 2   // (with wEnd: swelling to w1 mid-way, then tapering to a point)
      L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]); R.push([pts[i][0] + dy * w, pts[i][1] - dx * w])
    }
    ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); for (const q of L) ctx.lineTo(q[0], q[1]); for (let i = n; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]); ctx.closePath(); ctx.fill()
  }
  // a ribbon whose width at fraction f of its length is wf(f)
  _ribbonW(ctx, pts, wf) {
    const n = pts.length - 1, L = [], R = []
    for (let i = 0; i <= n; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(n, i + 1)]
      let dx = p1[0] - p0[0], dy = p1[1] - p0[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d
      const w = wf(i / n) / 2
      L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]); R.push([pts[i][0] + dy * w, pts[i][1] - dx * w])
    }
    ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); for (const q of L) ctx.lineTo(q[0], q[1]); for (let i = n; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]); ctx.closePath(); ctx.fill()
    return { L, R }
  }
  _spiral(ctx, x, y, r0, turns, a0 = 0, dir = 1) {
    ctx.beginPath()
    for (let i = 0; i <= 26; i++) { const f = i / 26, a = a0 + dir * f * turns * Math.PI * 2, r = r0 * (1 - 0.88 * f); const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py) }
    ctx.stroke()
  }

  // slow spirals turning in the mist round her, faint rose lines: the air itself in Kells knotwork
  _swirls(ctx, u, fog) {
    const T = this.t, c = this._c([170, 170, 210], [255, 214, 226], 0, 0.2 + 0.1 * (1 - this.fog))
    ctx.save(); ctx.scale(u, u); ctx.strokeStyle = c; ctx.lineCap = 'round'; ctx.lineWidth = 0.05
    for (const [x, y, r, turns, sp, dir] of [[-2.6, -4.6, 1.5, 2.6, 0.12, 1], [2.9, -3.2, 1.9, 3, 0.09, -1], [-0.4, -6.3, 1.1, 2.2, 0.15, -1], [3.6, -5.6, 0.9, 2, 0.13, 1], [-3.6, -2.2, 1.2, 2.4, 0.1, -1]]) {
      ctx.beginPath()
      for (let i = 0; i <= 60; i++) { const f = i / 60, a = T * sp * dir + dir * f * turns * Math.PI * 2, rr = r * (1 - 0.9 * f); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.8; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py) }
      ctx.stroke()
    }
    ctx.restore()
  }

  _twitch(T) {
    const P = 2.7, k = Math.floor(T / P), f = T / P - k
    const h = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
    const val = n => (h(n + 13) > 0.5 ? [h(n) - 0.5, h(n + 7.7) - 0.5, h(n + 3.1) - 0.5] : [0, 0, 0]), a = val(k - 1), b = val(k), e = 1 - Math.pow(1 - Math.min(1, f * 10), 3)
    return a.map((v, i) => v + (b[i] - v) * e)
  }
  // where everything is, from the state (heights; the neck and the beak's tip in drawing coordinates, y down)
  _geom(S) {
    const T = this.t, p = S.pitch * DEG
    const f = [Math.cos(p), Math.sin(p)], n = [-Math.sin(p), Math.cos(p)]
    const c = [S.bx, S.hip + 0.35 + S.oy + Math.sin(T * 1.3) * 0.012]
    const q = (a, b) => [c[0] + a * f[0] + b * n[0], c[1] + a * f[1] + b * n[1]]
    const sh = q(0.95, 0.15)
    // she is alert: every second or so the head is somewhere very slightly else, all at once (still while she is intent)
    const tw = this._twitch(T), tk = (1 - 0.85 * S.focus) * (this.cur.n === 'strike' ? 0 : 1)
    const H = [S.hx + tw[0] * 0.1 * tk, S.hy + S.oy + tw[1] * 0.08 * tk]
    const ba = (S.beak + S.tilt * 0.35 + tw[2] * 5 * tk) * DEG, dir = [Math.cos(ba), -Math.sin(ba)]
    const tip = [H[0] + dir[0] * BEAK, -(H[1] + dir[1] * BEAK)]
    // the neck: shoulder to head, bowed into an S by the slack
    const A = [sh[0], -sh[1]], B = [H[0], -H[1]]
    const d = Math.hypot(B[0] - A[0], B[1] - A[1]), g = Math.min(Math.max(0, LN - d) * 1.25 * S.sl, 1.5)
    const P1 = [A[0] + (B[0] - A[0]) * 0.33 + g, A[1] + (B[1] - A[1]) * 0.33], P2 = [A[0] + (B[0] - A[0]) * 0.66 - g * 0.9, A[1] + (B[1] - A[1]) * 0.66]
    const neck = []
    for (let i = 0; i <= 22; i++) {
      const s = i / 22, m = 1 - s
      neck.push([m * m * m * A[0] + 3 * m * m * s * P1[0] + 3 * m * s * s * P2[0] + s * s * s * B[0], m * m * m * A[1] + 3 * m * m * s * P1[1] + 3 * m * s * s * P2[1] + s * s * s * B[1]])
    }
    // the legs: two bones each, the joint (the heel, the "knee" that bends the wrong way) behind
    const leg = (hipX, fx, lift) => {
      const P = [hipX, c[1] - 0.35 - 0.1], F = [fx, lift * 0.85 + S.oy]
      const dx = F[0] - P[0], dy = F[1] - P[1], dd = Math.hypot(dx, dy) || 1e-3, dm = Math.min(dd, 2 * LEG - 0.02), ux = dx / dd, uy = dy / dd
      const hh = Math.sqrt(Math.max(0, LEG * LEG - dm * dm / 4))
      const J = [P[0] + ux * dm / 2 + uy * hh, P[1] + uy * dm / 2 - ux * hh]
      return { P, J, F: [P[0] + ux * dm, P[1] + uy * dm], lift }
    }
    return { c, f, n, sh, H, dir, ba, tip, neck, legA: leg(c[0] - 0.22, S.fA, S.fAl), legB: leg(c[0] + 0.02, S.fB, S.fBl) }
  }

  // The bird: legs, tail, wings, body, the S of her neck, head, plume, beak, the gleam of her eye; the fish.
  _bird(ctx, u, face, fog) {
    const S = this.S, T = this.t, G = this._geom(S)
    const body = this._c([116, 124, 142], [160, 128, 180], fog), belly = this._c([182, 186, 198], [248, 206, 228], fog)
    const wingC = this._c([84, 92, 112], [114, 88, 152], fog), dark = this._c([36, 40, 56], [60, 40, 88], fog), pale = this._c([220, 222, 230], [255, 228, 240], fog)
    const legC = this._c([150, 142, 108], [216, 152, 152], fog), beakC = this._c([218, 176, 84], [255, 192, 132], fog)
    const rim = this._c([200, 204, 224], [255, 200, 224], fog * 0.5, 0.7), lineC = this._c([200, 204, 224], [255, 214, 234], fog * 0.6, 0.75)
    const Y = q => [q[0], -q[1]]
    const bq = (a, b) => Y([G.c[0] + a * G.f[0] + b * G.n[0], G.c[1] + a * G.f[1] + b * G.n[1]])
    // a plume: a curve from p0 by c to p1 that ends in a spiral (a Kells flourish), dir +1 curling clockwise as drawn
    const plume = (p0, c, p1, r, turns, dir) => {
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(c[0], c[1], p1[0], p1[1]); ctx.stroke()
      let tx = p1[0] - c[0], ty = p1[1] - c[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl
      const nx = dir > 0 ? -ty : ty, ny = dir > 0 ? tx : -tx, cx = p1[0] + nx * r, cy = p1[1] + ny * r, a0 = Math.atan2(-ny, -nx)
      ctx.beginPath()
      for (let i = 0; i <= 24; i++) { const f = i / 24, a = a0 + dir * f * turns * Math.PI * 2, rr = r * (1 - 0.85 * f); const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y) }
      ctx.stroke()
    }
    ctx.save()
    ctx.scale(u * face, u); ctx.translate(0, -0.55)             // (she stands on the rock)
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    // legs
    const leg = (L, col) => {
      ctx.strokeStyle = col; ctx.fillStyle = col
      const P = Y(L.P), J = Y(L.J), F = Y(L.F)
      ctx.lineWidth = 0.2; ctx.beginPath(); ctx.moveTo(P[0], P[1]); ctx.lineTo(J[0], J[1]); ctx.stroke()           // (feathered thigh)
      ctx.lineWidth = 0.085; ctx.beginPath(); ctx.moveTo(J[0], J[1]); ctx.lineTo(F[0], F[1]); ctx.stroke()
      ctx.lineWidth = 0.065; ctx.beginPath()                                                                      // toes: flat on the ground, hanging when lifted
      for (const a of [-0.12, 0.0, 0.12]) { const ang = a + L.lift * 1.1; ctx.moveTo(F[0], F[1]); ctx.lineTo(F[0] + Math.cos(ang) * 0.5, F[1] + Math.sin(ang) * 0.5) }
      ctx.stroke()
    }
    leg(G.legA, this._c([120, 112, 90], [180, 128, 134], fog))
    // the neck: pale, a dark line of spots down its front, thicker at the breast
    const neck = G.neck, N = neck.length
    ctx.fillStyle = pale
    this._ribbonW(ctx, neck, f => 0.3 + 0.32 * Math.pow(1 - f, 1.6))
    ctx.strokeStyle = dark; ctx.lineWidth = 0.05; ctx.setLineDash([0.12, 0.1]); ctx.beginPath()
    for (let i = 3; i < N - 3; i++) {
      const a = neck[i - 1], b = neck[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, w = 0.1
      const x = neck[i][0] - dy / d * w, y = neck[i][1] + dx / d * w; i === 3 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke(); ctx.setLineDash([])
    // the tail, short and square, the body, the pale breast
    ctx.fillStyle = body
    ctx.beginPath(); const t0 = bq(-0.7, 0.3), t1 = bq(-2.0, -0.15), t2 = bq(-0.7, -0.35); ctx.moveTo(t0[0], t0[1]); ctx.lineTo(t1[0], t1[1]); ctx.lineTo(t2[0], t2[1]); ctx.closePath(); ctx.fill()
    ctx.save(); const bc = Y(G.c); ctx.translate(bc[0], bc[1]); ctx.rotate(-S.pitch * DEG)
    ctx.beginPath(); ctx.ellipse(0, 0, 1.15, 0.62, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = belly; ctx.beginPath(); ctx.ellipse(0.35, 0.2, 0.8, 0.34, 0.1, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = rim; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.ellipse(0, 0, 1.15, 0.62, 0, Math.PI * 1.1, Math.PI * 1.85); ctx.stroke()      // the dawn on her back
    ctx.restore()
    leg(G.legB, legC)
    // the wing: folded on the back, its dark tips lying past the tail; engraved with scrolls; lifted and shaken when she ruffles
    {
      const pv = bq(0.85, 0.2), rf = S.ruf * (0.3 + 0.08 * Math.sin(T * 30))
      ctx.save(); ctx.translate(pv[0], pv[1]); ctx.rotate(rf); ctx.translate(-pv[0], -pv[1])
      if (S.ruf > 0.05) {                                                                                // the long feathers come apart as it is shaken
        ctx.strokeStyle = dark; ctx.lineWidth = 0.15
        for (let i = 0; i < 6; i++) { const q0 = bq(-0.5 - 0.3 * i, 0.15), q1 = bq(-1.5 - 0.22 * i, -0.2 - S.ruf * 0.1 * i + Math.sin(T * 28 + i) * 0.04 * S.ruf); ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.stroke() }
      }
      ctx.fillStyle = wingC; ctx.beginPath()
      const a = bq(0.85, 0.2); ctx.moveTo(a[0], a[1])
      const c1 = bq(0.2, 0.66), c2 = bq(-0.9, 0.3); ctx.quadraticCurveTo(c1[0], c1[1], c2[0], c2[1])
      const e = bq(-2.3, -0.08); ctx.lineTo(e[0], e[1])
      const c3 = bq(-0.6, -0.5), c4 = bq(0.5, -0.18); ctx.quadraticCurveTo(c3[0], c3[1], c4[0], c4[1]); ctx.closePath(); ctx.fill()
      ctx.fillStyle = dark; ctx.beginPath(); const p0 = bq(-1.2, 0.18), p1 = bq(-2.3, -0.08), p2 = bq(-1.2, -0.2); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = lineC; ctx.lineWidth = 0.035; ctx.lineCap = 'round'                              // the engraving: a spiral at the shoulder, its scroll running back, feather arcs
      const s1 = bq(0.15, 0.17), s2 = bq(-0.55, 0.08)
      this._spiral(ctx, s1[0], s1[1], 0.3, 1.9, 0.5, 1); this._spiral(ctx, s2[0], s2[1], 0.2, 1.7, 3.6, -1)
      ctx.beginPath(); const l0 = bq(-0.1, 0.0), l1 = bq(-0.9, -0.12), l2 = bq(-1.7, 0.02); ctx.moveTo(l0[0], l0[1]); ctx.quadraticCurveTo(l1[0], l1[1], l2[0], l2[1]); ctx.stroke()
      for (let i = 0; i < 5; i++) { const q0 = bq(-0.4 - 0.34 * i, 0.3 - 0.04 * i), q1 = bq(-0.62 - 0.34 * i, 0.1 - 0.02 * i), q2 = bq(-0.4 - 0.34 * i, -0.12); ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.quadraticCurveTo(q1[0], q1[1], q2[0], q2[1]); ctx.stroke() }
      ctx.restore()
    }
    // the tail: three long strands that end in curls, swaying
    ctx.strokeStyle = dark; ctx.lineWidth = 0.035
    for (let i = 0; i < 3; i++) { const sw = Math.sin(T * 0.9 + i * 1.7) * 0.07, p0 = bq(-1.7, 0.0 - 0.1 * i), c = bq(-2.2 - 0.1 * i, 0.15 - 0.12 * i + sw), p1 = bq(-2.55 - 0.3 * i, 0.12 - 0.3 * i + sw * 1.5); plume(p0, c, p1, 0.17, 1.6, i % 2 ? 1 : -1) }
    // long filaments of the breast, hanging, each ending in a small curl
    ctx.strokeStyle = lineC; ctx.lineWidth = 0.03
    for (let i = 0; i < 3; i++) { const sw = Math.sin(T * 0.8 + i * 2.1) * 0.06, p0 = bq(0.7 - 0.2 * i, -0.02 - 0.08 * i), c = bq(0.95 - 0.28 * i + sw, -0.42 - 0.1 * i), p1 = bq(0.72 - 0.34 * i + sw * 1.6, -0.9 - 0.12 * i); plume(p0, c, p1, 0.12, 1.5, i % 2 ? -1 : 1) }
    // the head: pale, a black stripe over the eye running back to a plume; the dagger of a beak
    const H = Y(G.H), ba = G.ba, dx = Math.cos(ba), dy = Math.sin(ba)             // (y down: the beak angle is as drawn)
    const rot = ba + S.tilt * 0.6 * DEG
    ctx.fillStyle = pale; ctx.beginPath(); ctx.ellipse(H[0], H[1], 0.38, 0.21, rot, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = dark; ctx.lineWidth = 0.075
    const nx = -dy, ny = dx                                                        // (down-and-back side is +n)
    ctx.beginPath(); ctx.moveTo(H[0] + dx * 0.25 - nx * 0.1, H[1] + dy * 0.25 - ny * 0.1); ctx.quadraticCurveTo(H[0] - dx * 0.2 - nx * 0.15, H[1] - dy * 0.2 - ny * 0.15, H[0] - dx * 0.55 - nx * 0.05, H[1] - dy * 0.55 - ny * 0.05); ctx.stroke()
    ctx.strokeStyle = dark; ctx.lineWidth = 0.04   // the crest: two long plumes streaming back from the nape, drooping, ending in curls
    for (const k of [0, 1]) {
      const L = 1.2 + 0.35 * k, sw = Math.sin(T * 1.2 + k * 1.3) * 0.05 * L
      plume([H[0] - dx * 0.3 - nx * 0.12, H[1] - dy * 0.3 - ny * 0.12], [H[0] - dx * 0.7 - nx * 0.18, H[1] - dy * 0.7 - ny * 0.18 + 0.12 + sw], [H[0] - dx * L * 0.85 + sw, H[1] - dy * L * 0.5 + 0.3 + 0.55 * L * 0.7 + 0.1 * k], 0.14, 1.7, k ? -1 : 1)
    }
    const bb = [H[0] + dx * 0.22, H[1] + dy * 0.22]                                // the beak's root
    ctx.fillStyle = beakC
    const op = S.open * 13 * DEG, up = ba - op, lo = ba + op
    ctx.beginPath(); ctx.moveTo(bb[0] - nx * 0.1, bb[1] - ny * 0.1)
    ctx.lineTo(bb[0] + Math.cos(up) * 1.08, bb[1] + Math.sin(up) * 1.08); ctx.lineTo(bb[0] + nx * 0.02, bb[1] + ny * 0.02); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(bb[0] + nx * 0.02, bb[1] + ny * 0.02)
    ctx.lineTo(bb[0] + Math.cos(lo) * 1.0, bb[1] + Math.sin(lo) * 1.0); ctx.lineTo(bb[0] + nx * 0.09, bb[1] + ny * 0.09); ctx.closePath(); ctx.fill()
    const tp = [bb[0] + dx * 1.08, bb[1] + dy * 1.08]
    // the eye: bright, wide-awake: a ring of gold round a dark pupil with a catch-light
    const e = [H[0] + dx * 0.19 - nx * 0.04, H[1] + dy * 0.19 - ny * 0.04], fc = Math.max(0.35, S.focus), ef = fog * 0.25
    ctx.fillStyle = this._c([255, 214, 50], [255, 222, 90], ef); ctx.beginPath(); ctx.arc(e[0], e[1], 0.095, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgb(60,44,24)'; ctx.lineWidth = 0.022; ctx.beginPath(); ctx.arc(e[0], e[1], 0.095, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = 'rgb(16,14,22)'; ctx.beginPath(); ctx.arc(e[0] + dx * 0.014, e[1] + dy * 0.014, 0.046, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(e[0] - 0.03 + dx * 0.02, e[1] - 0.035 + dy * 0.02, 0.02, 0, Math.PI * 2); ctx.fill()
    const gl = this.t - this._glintAt                                            // the eye catches the flash in the water
    if (gl >= 0 && gl < 0.32) { ctx.fillStyle = `rgba(255,250,236,${0.7 * (1 - gl / 0.32)})`; ctx.beginPath(); ctx.arc(e[0] - 0.02 + dx * 0.03, e[1] - 0.02 + dy * 0.03, 0.05, 0, Math.PI * 2); ctx.fill() }
    this._fish(ctx, neck, tp[0], tp[1], ba, body)
    ctx.restore()
  }

  // The silver. It is flipped straight out of the water as the beak comes up (no holding it first), spinning and flashing as
  // it climbs and turns, and caught head-first as it comes down, and swallowed.
  _fish(ctx, neck, bx, by, ba, col) {
    const age = this.t - this.riseAt
    if (age < 0 || age > 1.2) { this._f0 = null; return }
    const TOSS = 0, CATCH = 0.83, FLY = CATCH - TOSS
    const body = (x, y, rot, flip, a = 1, flash = 0) => {                 // not a fish so much as a bent flash of silver, there and gone
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1.3, 1.3 * flip)
      ctx.shadowColor = `rgba(255,255,255,${0.55 + 0.4 * flash})`; ctx.shadowBlur = 5
      ctx.fillStyle = `rgba(${230 + 25 * flash},${238 + 17 * flash},252,${0.9 * a})`
      ctx.beginPath(); ctx.moveTo(0.55, 0.02); ctx.quadraticCurveTo(0.0, -0.3, -0.58, 0.0); ctx.quadraticCurveTo(-0.05, -0.1, 0.55, 0.02); ctx.fill()
      ctx.restore()
    }
    const spark = (x, y, k) => {
      if (k < 0.05) return
      ctx.save(); ctx.translate(x, y); ctx.strokeStyle = `rgba(255,250,255,${0.9 * k})`; ctx.lineWidth = 0.04; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(-0.55 * k, 0); ctx.lineTo(0.55 * k, 0); ctx.moveTo(0, -0.55 * k); ctx.lineTo(0, 0.55 * k); ctx.moveTo(-0.3 * k, -0.3 * k); ctx.lineTo(0.3 * k, 0.3 * k); ctx.moveTo(0.3 * k, -0.3 * k); ctx.lineTo(-0.3 * k, 0.3 * k); ctx.stroke()
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.5 * k); g.addColorStop(0, `rgba(255,252,255,${0.7 * k})`); g.addColorStop(1, 'rgba(255,252,255,0)')
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 0.5 * k, 0, Math.PI * 2); ctx.fill(); ctx.restore()
    }
    const drops = (x0, y0, a0) => {
      ctx.fillStyle = 'rgba(236,242,252,0.85)'
      for (let k = 0; k < 9; k++) {
        const s = a0 - k * 0.04; if (s < 0 || s > 1.6) continue
        const vx = (k - 4) * 0.5, vy = -2.2 - (k % 3) * 0.7
        ctx.beginPath(); ctx.arc(x0 + vx * s, y0 + vy * s + 4.5 * s * s, 0.04, 0, Math.PI * 2); ctx.fill()
      }
    }
    if (age < CATCH) {                                                  // flipped: up from the water, spinning, flashing; down to her beak
      if (!this._f0) this._f0 = [bx, by + 0.15]
      const f = (age - TOSS) / FLY, e = f
      const x = this._f0[0] + (bx - this._f0[0]) * e + Math.sin(f * 3) * 0.25
      const y = this._f0[1] + (by - this._f0[1]) * e - 3.1 * 4 * f * (1 - f)
      const rot = Math.PI / 2 + f * 3.2 * Math.PI, flip = Math.cos(f * 3 * Math.PI)
      const flash = Math.pow(Math.abs(Math.sin(f * 3 * Math.PI)), 4)
      body(x, y, rot, Math.abs(flip) < 0.15 ? 0.15 : flip, 1, flash)
      spark(x, y, flash)
      drops(this._f0[0], this._f0[1], age - TOSS)
      return
    }
    const g = (age - CATCH) / 0.35                                       // caught head first, and gulped
    if (g < 1) { body(bx - Math.cos(ba) * (0.1 + 0.55 * g), by - Math.sin(ba) * (0.1 + 0.55 * g), ba, 1, 1 - g); spark(bx, by, 1 - g) }
  }

  // ── fog between us and her ───────────────────────────────────────────────
  // fog01.png tinted to the dawn, in a few banks drifting at different speeds across the heron's plane, nearer ones
  // faster and in front. `fog` 0..1 is how thick it lies (1: she is hidden; 0: clear), eased toward `fogWant`.
  _fogImage() {
    if (this._fogImg !== undefined) return this._fogImg
    this._fogImg = null
    try {
      const im = new Image()
      im.onload = () => {
        const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height
        const x = cv.getContext('2d'); x.drawImage(im, 0, 0)
        x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(236,214,222,0.9)'; x.fillRect(0, 0, cv.width, cv.height)
        x.globalCompositeOperation = 'destination-in'                          // feather every edge: no rectangle
        const hg = x.createLinearGradient(0, 0, cv.width, 0)
        hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(0.25, 'rgba(0,0,0,1)'); hg.addColorStop(0.75, 'rgba(0,0,0,1)'); hg.addColorStop(1, 'rgba(0,0,0,0)')
        x.fillStyle = hg; x.fillRect(0, 0, cv.width, cv.height)
        const vg = x.createLinearGradient(0, 0, 0, cv.height)
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(0.35, 'rgba(0,0,0,1)'); vg.addColorStop(0.65, 'rgba(0,0,0,1)'); vg.addColorStop(1, 'rgba(0,0,0,0)')
        x.fillStyle = vg; x.fillRect(0, 0, cv.width, cv.height)
        this._fogImg = cv
      }
      im.src = 'assets/fog01.png'
    } catch (_) {}
    return this._fogImg
  }
  setFog(v, ms = 3000) { this.fogWant = v; this.fogMs = ms }
  _fogBanks(ctx, u, front, px = 0, sw = 1000) {
    const img = this._fogImage()
    if (!img) return
    const f = this.fog
    if (f < 0.01) return
    if (front) {                                    // a pale veil under the swirls, so at full fog she is only a hint
      const g = ctx.createLinearGradient(0, -8.5 * u, 0, 0.6 * u), a = 0.6 * f * f, c = rgb(mix([226, 216, 224], [240, 214, 222], this.dawn))
      const stop = (o, al) => g.addColorStop(o, c.replace('rgb', 'rgba').replace(')', `,${al.toFixed(3)})`))
      stop(0, 0); stop(0.22, a * 0.8); stop(0.5, a); stop(0.85, a * 0.9); stop(1, 0)
      ctx.fillStyle = g; ctx.fillRect(-px - 4, -8.5 * u, sw + 8, 9.1 * u)          // (right across the screen: no edge to it)
    }
    const banks = front
      ? [{ y: -2.6, w: 15, h: 5.6, sp: 0.55, x0: 0, a: 1.0, fl: 1 }, { y: -1.0, w: 17, h: 4.2, sp: 0.8, x0: 8, a: 0.9, fl: 0 }, { y: -4.8, w: 14, h: 5.2, sp: 0.4, x0: 4, a: 0.9, fl: 0 }, { y: -3.4, w: 12, h: 4.4, sp: 0.65, x0: 20, a: 0.9, fl: 1 }, { y: -6.2, w: 13, h: 3.8, sp: 0.3, x0: 14, a: 0.8, fl: 0 }]
      : [{ y: -3.4, w: 18, h: 6, sp: 0.25, x0: 3, a: 0.9, fl: 0 }, { y: -0.8, w: 14, h: 3.6, sp: 0.35, x0: 11, a: 0.7, fl: 1 }]
    for (const b of banks) {
      const span = 34, x = (((b.x0 + this.t * b.sp) % span) + span) % span - span / 2
      for (let k = -3; k <= 3; k++) {                                       // (repeated across the whole screen)
        const X = (x + k * span) * u
        if (X + px < -b.w * u / 2 || X + px > sw + b.w * u / 2) continue
        ctx.save(); ctx.globalAlpha = Math.min(1, f * b.a * (front ? 1 : 0.8))
        ctx.translate(X, b.y * u); if (b.fl) ctx.scale(-1, 1)
        ctx.drawImage(img, -b.w * u / 2, -b.h * u / 2, b.w * u, b.h * u)
        ctx.restore()
      }
    }
  }
}

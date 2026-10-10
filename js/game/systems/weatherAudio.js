// weatherAudio.js
// Location: js/game/systems/weatherAudio.js
//
// The sound of the rain, driven by weather.state and the weather singleton's
// wetness. One RainSound per scene; it is created lazily and does nothing at
// all (no nodes, no CPU) while it is dry.
//
// ── What you hear ────────────────────────────────────────────────────────────
// The bed is a stack of looping layers, each a different length (7 to 29 s) so
// they slide against each other and the whole never repeats in any way you can
// hear. Every layer is baked once, as a stereo buffer of individually placed
// drops with the two channels independent, which is where the width and the
// ASMR close-up quality come from. On top of the bed each layer breathes on its
// own slow cycle, drifts a little in pitch and in the stereo field, and swells
// with the gusts. Then a sparse scatter of events:
//
//   OUTDOORS, LAND   hiss of fine drops on grass, soft patter on bracken and
//                    leaves, sharper ticks on leaf edges, deep thuds of heavy
//                    drops on peat; far sizzle; two broad "curtains" of rain
//                    that sweep across the stereo field every half minute;
//                    single heavy drops close by; runs of drips from leaves;
//                    a little trickle off to one side.
//   OUTDOORS, WATER  a brighter hiss, a thousand tiny bubbles, a low hollow
//                    wash beneath, bubbling gurgles. Crossfaded with the land
//                    layers by how much of the ground under the player is water
//                    (Water 1, Bog Shore about half), so you hear the river
//                    change as you cross it.
//   ROOF             indoors on a wet day: a muffled drum on thatch, dry wood
//                    ticks, a dripping gutter, a hollow thrum.
//   FOG              softens everything above ~3 kHz as the mist thickens.
//
// ── Cost ─────────────────────────────────────────────────────────────────────
// Baking: about a second of work, spread over several frames, once per session.
// Memory: ~17 MB outdoors (+ ~6 MB the first time a roof is heard).
// Running: about 14 looping sources, a handful of gains and one filter, plus
// one or two short events a second. The graph is torn down 4 s after the rain
// stops. If it ever costs too much, lower  rainSound.quality  (0..1): it drops
// the sparse events first and then the minor layers.
//
// Room for music: while a conversation is under way (DialogueHarp.isStarted())
// the rain steps back to about a quarter and the mids are carved out of it, and
// each footstep dips it for a moment so the step is heard.
//
// Switches:  ?rainsound=0 turns it off.   window.rainSound.volume = 0..1
// A map opts out with  getRainSound() { return false }.
//
// wetStep(ctx, terrain) is the squelch the champion's feet make on wet ground;
// player.js calls it after the ordinary footstep.

import { weather } from '../effects/weather.js'
import { wind } from '../effects/wind.js'
import { DialogueHarp } from './music/dialogueHarp.js'

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const rnd = (a, b) => a + Math.random() * (b - a)
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const TAU = Math.PI * 2

let DISABLED = false
try { DISABLED = new URLSearchParams(window.location.search).get('rainsound') === '0' } catch (e) { /* no window */ }

// ── baking ───────────────────────────────────────────────────────────────────
// Drops are placed at random positions in a loop; anything that runs past the
// end wraps round to the start, so the loop is seamless.

function put(d, n, i0, k, v) { d[(i0 + k) % n] += v }

// damped sine: a tick on a leaf, a drip
function ping(d, n, sr, t, f, decay, amp) {
  const len = Math.min(Math.floor(decay * 5 * sr), 4000)
  const i0 = Math.floor(t * sr), w = TAU * f / sr, k0 = 1 / (decay * sr)
  for (let k = 0; k < len; k++) put(d, n, i0, k, amp * Math.sin(w * k) * Math.exp(-k * k0))
}

// a bubble: rises in pitch as it pops, quick decay
function bubble(d, n, sr, t, f0, amp) {
  const len = Math.floor(0.04 * sr), i0 = Math.floor(t * sr)
  let ph = 0
  for (let k = 0; k < len; k++) {
    const ts = k / sr
    ph += TAU * f0 * (1 + 45 * ts) / sr
    put(d, n, i0, k, amp * Math.sin(ph) * Math.exp(-ts / 0.011) * Math.min(1, k / 8))
  }
}

// a burst of low-passed noise: a drop on soft ground
function tick(d, n, sr, t, amp, lp, decay) {
  const len = Math.min(Math.floor(decay * 6 * sr), 3000), i0 = Math.floor(t * sr)
  let y = 0
  const k0 = 1 / (decay * sr)
  for (let k = 0; k < len; k++) {
    y += (Math.random() * 2 - 1 - y) * lp
    put(d, n, i0, k, amp * y * Math.exp(-k * k0))
  }
}

// a low thud: a heavy drop on peat or thatch
function thump(d, n, sr, t, f, decay, amp) {
  const len = Math.floor(decay * 5 * sr), i0 = Math.floor(t * sr)
  let ph = 0
  for (let k = 0; k < len; k++) {
    const ts = k / sr
    ph += TAU * f * (1 - 0.5 * Math.min(1, ts / decay)) / sr
    put(d, n, i0, k, amp * Math.sin(ph) * Math.exp(-ts / decay))
  }
}

// Filtered noise: first-order high-pass and low-pass, run twice for a steeper
// slope. hp = lp = 0 leaves that side out.
function noiseBed(d, hpHz, lpHz, sr, gain) {
  const n = d.length
  const a = lpHz ? 1 - Math.exp(-TAU * lpHz / sr) : 1
  const b = hpHz ? 1 - Math.exp(-TAU * hpHz / sr) : 0
  let l1 = 0, l2 = 0, h1 = 0, h2 = 0
  for (let i = 0; i < n; i++) {
    let x = Math.random() * 2 - 1
    l1 += (x - l1) * a; l2 += (l1 - l2) * a
    x = l2
    h1 += (x - h1) * b; h2 += (h1 - h2) * b
    d[i] = (x - h2) * gain
  }
}

// Each layer: a name, the length of its loop, its sample rate, and how to draw
// one channel of it. Rates are drops per second.
const LAYERS = {
  // land
  hiss:     { secs: 9,  sr: 24000, group: 'land',  fill: (d, n, sr) => noiseBed(d, 2600, 9500, sr, 0.9) },
  patter:   { secs: 17, sr: 24000, group: 'land',  fill: (d, n, sr, S) => {
    for (let i = 0; i < S * 240; i++) tick(d, n, sr, Math.random() * S, Math.pow(Math.random(), 2.4) * 1.1, rnd(0.18, 0.5), rnd(0.0025, 0.007)) } },
  leaf:     { secs: 23, sr: 24000, group: 'land',  fill: (d, n, sr, S) => {
    for (let i = 0; i < S * 38; i++) ping(d, n, sr, Math.random() * S, rnd(2200, 5200), rnd(0.004, 0.011), Math.pow(Math.random(), 1.8) * 0.8) } },
  thud:     { secs: 29, sr: 8000,  group: 'land',  fill: (d, n, sr, S) => {
    for (let i = 0; i < S * 5; i++) thump(d, n, sr, Math.random() * S, rnd(110, 260), rnd(0.015, 0.035), Math.pow(Math.random(), 2.2) * 0.9) } },
  sizzle:   { secs: 7,  sr: 24000, group: 'land',  fill: (d, n, sr) => noiseBed(d, 6000, 11500, sr, 0.8) },
  // water
  whiss:    { secs: 11, sr: 24000, group: 'water', fill: (d, n, sr) => noiseBed(d, 3800, 11000, sr, 0.8) },
  plops:    { secs: 19, sr: 24000, group: 'water', fill: (d, n, sr, S) => {
    for (let i = 0; i < S * 95; i++) bubble(d, n, sr, Math.random() * S, rnd(700, 3600), Math.pow(Math.random(), 1.7) * 0.9) } },
  wash:     { secs: 13, sr: 8000,  group: 'water', fill: (d, n, sr) => noiseBed(d, 90, 520, sr, 2.6) },
  // roof
  drum:     { secs: 21, sr: 8000,  group: 'roof',  fill: (d, n, sr, S) => {
    for (let i = 0; i < S * 70; i++) thump(d, n, sr, Math.random() * S, rnd(110, 380), rnd(0.012, 0.03), Math.pow(Math.random(), 1.5) * 0.9) } },
  wood:     { secs: 27, sr: 24000, group: 'roof',  fill: (d, n, sr, S) => {
    for (let i = 0; i < S * 26; i++) ping(d, n, sr, Math.random() * S, rnd(900, 2300), rnd(0.003, 0.008), Math.pow(Math.random(), 1.8) * 0.8) } },
  roofbed:  { secs: 19, sr: 8000,  group: 'roof',  fill: (d, n, sr) => noiseBed(d, 220, 1500, sr, 1.8) },
}

const _cache = new WeakMap()      // AudioContext -> { name: AudioBuffer }, plus pending

function bake(ctx, name) {
  const L = LAYERS[name]
  const n = Math.round(L.secs * L.sr)
  const buf = ctx.createBuffer(2, n, L.sr)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    L.fill(d, n, L.sr, L.secs)
    // keep each layer's peak sensible, whatever its recipe produced
    let pk = 0
    for (let i = 0; i < n; i += 3) { const a = Math.abs(d[i]); if (a > pk) pk = a }
    const g = pk > 0 ? 0.9 / pk : 1
    for (let i = 0; i < n; i++) d[i] *= g
  }
  return buf
}

// Bakes the layers of a group one per macrotask so a frame never stalls.
function ensureGroup(ctx, group) {
  let c = _cache.get(ctx)
  if (!c) { c = { bufs: {}, state: {} }; _cache.set(ctx, c) }
  if (c.state[group]) return c
  c.state[group] = 'baking'
  const names = Object.keys(LAYERS).filter(k => LAYERS[k].group === group)
  const next = () => {
    const nm = names.shift()
    if (!nm) { c.state[group] = 'ready'; return }
    try { c.bufs[nm] = bake(ctx, nm) } catch (e) { console.warn('[rainSound] bake failed', nm, e) }
    setTimeout(next, 0)
  }
  setTimeout(next, 0)
  return c
}

function noiseOne(ctx) {
  let c = _cache.get(ctx)
  if (!c) { c = { bufs: {}, state: {} }; _cache.set(ctx, c) }
  if (!c.noise) {
    const n = ctx.sampleRate * 2
    const b = ctx.createBuffer(1, n, ctx.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
    c.noise = b
  }
  return c.noise
}

// ── the sound ────────────────────────────────────────────────────────────────
// How loud each layer is at rain r (0..1). Heavier rain brings in the heavy
// layers; drizzle is mostly hiss and a little patter.
const LEVEL = {
  hiss:    r => 0.50 * Math.pow(r, 1.1),          // a drizzle is almost silent
  patter:  r => 0.95 * smooth(0.04, 0.9, r),
  leaf:    r => 0.55 * smooth(0.12, 0.75, r),
  thud:    r => 0.40 * smooth(0.65, 1.0, r),
  sizzle:  r => 0.30 * Math.pow(r, 1.2),
  whiss:   r => 0.50 * Math.pow(r, 1.1),
  plops:   r => 0.90 * smooth(0.03, 0.85, r),
  wash:    r => 0.55 * smooth(0.25, 1.0, r),
  drum:    r => 0.90 * smooth(0.04, 0.9, r),
  wood:    r => 0.60 * smooth(0.10, 0.80, r),
  roofbed: r => 0.55 * Math.pow(r, 0.8),
}

// where a layer sits in the stereo field, how fast it breathes, how far it wanders
const VOICES = {
  hiss:    { pan: 0,    wander: 0.10, period: 31, depth: 0.18 },
  patter:  { pan: -0.1, wander: 0.30, period: 19, depth: 0.28 },
  leaf:    { pan: 0.2,  wander: 0.55, period: 13, depth: 0.45 },
  thud:    { pan: -0.2, wander: 0.35, period: 41, depth: 0.35 },
  sizzle:  { pan: 0,    wander: 0.15, period: 23, depth: 0.25 },
  whiss:   { pan: 0,    wander: 0.10, period: 29, depth: 0.18 },
  plops:   { pan: 0,    wander: 0.45, period: 17, depth: 0.35 },
  wash:    { pan: 0,    wander: 0.20, period: 47, depth: 0.40 },
  drum:    { pan: 0,    wander: 0.25, period: 37, depth: 0.30 },
  wood:    { pan: 0,    wander: 0.60, period: 11, depth: 0.50 },
  roofbed: { pan: 0,    wander: 0.10, period: 53, depth: 0.22 },
}

export class RainSound {
  /**
   * opts (all optional) let something other than a Phaser scene drive it, as
   * the return crossing does:
   *   ctx      the AudioContext to build in          out     node to feed (default: speakers)
   *   source   () => ({rain, mist, wind}), instead of the weather singleton
   *   water    0..1 how much of what you hear is on water (held, if no terrain is given)
   *   duck     false: do not step back for the dialogue harp
   *   prepare  true: bake the layers now, so they are ready when the rain comes
   *   global   false: do not publish as window.rainSound
   */
  constructor(scene, opts = {}) {
    this.scene = scene
    this.ctx = opts.ctx || scene?.sound?.context || window._phaserAudioContext || null
    this.out = opts.out || null
    this._source = opts.source || null
    this._duckable = opts.duck !== false
    this.volume = 1            // preferences menu: set this
    this.quality = 1
    this._g = null             // the live graph, or null while dry
    this._mode = 'none'
    this._t = 0
    this._ctl = 0
    this._clock = null
    this._dryFor = 0
    this._water = opts.water ?? 0
    if (opts.prepare && this.ctx) { ensureGroup(this.ctx, 'land'); ensureGroup(this.ctx, 'water') }
    this._ev = { drop: 2, drip: 8, trickle: 8, tick: 2 }
    this._talking = false
    this._pulseUntil = 0
    if (opts.global !== false && typeof window !== 'undefined') window.rainSound = this
  }

  /** Per frame. mode: 'outdoor' | 'roof' | 'none'. terrain: the player's terrain name. */
  update(mode, terrain) {
    // a conversation is under way: the dialogue harp (and voices) need room
    this._talking = this._duckable && !!(DialogueHarp && DialogueHarp.isStarted && DialogueHarp.isStarted())
    if (DISABLED || !this.ctx) return
    const now = performance.now()
    const dt = this._clock == null ? 0 : Math.min(0.25, (now - this._clock) / 1000)
    this._clock = now
    this._mode = mode

    const r = mode === 'none' ? 0 : this._read().rain
    const wantOn = r > 0.03

    if (!wantOn) {
      this._dryFor += dt
      if (this._g && this._dryFor > 4) this._teardown()
      else if (this._g) this._setLevels(0.4, 0)
      return
    }
    this._dryFor = 0
    if (this._g && this._g.mode !== mode) this._teardown()     // indoors <-> outdoors
    if (!this._g && !this._build()) return

    this._t += dt
    this._ctl += dt
    // water underfoot, smoothed over a second or two
    const wTarget = terrain === 'Water' ? 1 : terrain === 'Bog Shore' ? 0.55 : 0
    this._water += (wTarget - this._water) * Math.min(1, dt / 1.5)

    if (this._ctl >= 0.08) {
      const step = this._ctl
      this._ctl = 0
      this._setLevels(0.35, r)
      this._events(step, r)
    }
  }

  _read() {
    return this._source ? this._source()
      : { rain: weather.state.rain, mist: weather.state.mist, wind: wind.strength }
  }

  // ── building the graph ────────────────────────────────────────────────────
  _build() {
    const ctx = this.ctx
    const mode = this._mode
    const groups = mode === 'roof' ? ['roof'] : ['land', 'water']
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    let ready = true
    for (const gname of groups) {
      ensureGroup(ctx, gname)
      if (_cache.get(ctx).state[gname] !== 'ready') ready = false
    }
    if (!ready) return false          // still baking: try again next frame

    const bufs = _cache.get(ctx).bufs
    const out = ctx.createGain()
    out.gain.value = 0
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14; comp.knee.value = 18; comp.ratio.value = 3.5
    comp.attack.value = 0.01; comp.release.value = 0.25
    const fog = ctx.createBiquadFilter()
    fog.type = 'lowpass'; fog.frequency.value = 14000; fog.Q.value = 0.5
    // room for music and voices: a gain that dips while someone is talking (or
    // a foot lands), and a wide dip in the mids where a harp and a voice live
    const duck = ctx.createGain(); duck.gain.value = 1
    const carve = ctx.createBiquadFilter()
    carve.type = 'peaking'; carve.frequency.value = 1800; carve.Q.value = 0.5; carve.gain.value = -4
    fog.connect(duck); duck.connect(carve); carve.connect(out)
    out.connect(comp); comp.connect(this.out || ctx.destination)

    const layers = {}
    for (const gname of groups) {
      for (const name of Object.keys(LAYERS)) {
        if (LAYERS[name].group !== gname || !bufs[name]) continue
        const src = ctx.createBufferSource()
        src.buffer = bufs[name]; src.loop = true
        // every start is at a random offset, so each visit sounds different
        const g = ctx.createGain(); g.gain.value = 0
        const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null
        if (p) { src.connect(g); g.connect(p); p.connect(fog) } else { src.connect(g); g.connect(fog) }
        src.start(0, Math.random() * bufs[name].duration)
        const V = VOICES[name]
        layers[name] = { src, g, p, ph: rnd(0, TAU), qh: rnd(0, TAU), V }
      }
    }

    // two broad curtains of rain that sweep across the stereo field, made from
    // the hiss, read from different offsets and speeds
    const sweeps = []
    if (bufs.hiss) {
      for (let i = 0; i < 2; i++) {
        const src = ctx.createBufferSource()
        src.buffer = bufs.hiss; src.loop = true
        src.playbackRate.value = i ? 0.93 : 1.06
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'; bp.frequency.value = i ? 3800 : 5200; bp.Q.value = 0.6
        const g = ctx.createGain(); g.gain.value = 0
        const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null
        src.connect(bp); bp.connect(g)
        if (p) { g.connect(p); p.connect(fog) } else g.connect(fog)
        src.start(0, Math.random() * bufs.hiss.duration)
        sweeps.push({ src, g, p, period: i ? 37 : 26, ph: rnd(0, TAU) })
      }
    }

    this._g = { out, comp, fog, duck, carve, layers, sweeps, mode }
    out.gain.setTargetAtTime(this.volume, ctx.currentTime, 0.8)
    return true
  }

  _teardown() {
    const G = this._g
    this._g = null
    if (!G) return
    try {
      const t = this.ctx.currentTime
      G.out.gain.cancelScheduledValues(t)
      G.out.gain.setTargetAtTime(0, t, 0.4)
      setTimeout(() => {
        for (const k in G.layers) { try { G.layers[k].src.stop() } catch (e) {} }
        for (const s of G.sweeps) { try { s.src.stop() } catch (e) {} }
        try { G.out.disconnect(); G.comp.disconnect(); G.fog.disconnect(); G.duck.disconnect(); G.carve.disconnect() } catch (e) {}
      }, 2200)
    } catch (e) { /* context gone */ }
  }

  destroy() {
    this._teardown()
    if (typeof window !== 'undefined' && window.rainSound === this) window.rainSound = null
  }

  // ── slow control: levels, drift, fog ──────────────────────────────────────
  _setLevels(tc, r) {
    const G = this._g
    if (!G) return
    const t = this._t, now = this.ctx.currentTime
    const roof = this._mode === 'roof'
    const water = roof ? 0 : this._water
    const gust = 1 + 0.30 * clamp(this._read().wind, 0, 1.4) * (0.6 + 0.4 * Math.sin(t * 0.37))
    const q = this.quality

    for (const name in G.layers) {
      const L = G.layers[name]
      const grp = LAYERS[name].group
      const w = grp === 'roof' ? (roof ? 1 : 0) : roof ? 0 : grp === 'water' ? water : 1 - water * 0.85
      // a minor layer is dropped first if quality is lowered
      const keep = (name === 'leaf' || name === 'sizzle' || name === 'wood') && q < 0.5 ? 0 : 1
      const breathe = 1 - L.V.depth + L.V.depth * (0.5 + 0.5 * Math.sin(TAU * t / L.V.period + L.ph) *
        (0.8 + 0.2 * Math.sin(TAU * t / (L.V.period * 2.7) + L.qh)))
      const v = LEVEL[name](r) * w * keep * breathe * gust
      L.g.gain.setTargetAtTime(v, now, tc)
      if (L.p) L.p.pan.setTargetAtTime(
        clamp(L.V.pan + L.V.wander * Math.sin(TAU * t / (L.V.period * 1.7) + L.qh), -1, 1), now, 0.5)
      // a faint wander in pitch: the rain seems to come and go in density
      L.src.playbackRate.setTargetAtTime(1 + 0.025 * Math.sin(TAU * t / (L.V.period * 0.9) + L.ph), now, 0.6)
    }

    // curtains passing: each swells as it crosses, and is gone between
    G.sweeps.forEach((s, i) => {
      const ph = TAU * t / s.period + s.ph
      const swell = Math.pow(0.5 + 0.5 * Math.sin(ph * 0.5), 2.2)
      const v = (roof ? 0 : 0.55) * r * r * swell * (i ? 0.8 : 1)
      s.g.gain.setTargetAtTime(v, now, tc)
      if (s.p) s.p.pan.setTargetAtTime(Math.sin(ph * 0.5 + 1.2) * 0.85, now, 0.3)
    })

    // fog closes in on the high end; the roof muffles it a little anyway
    const mist = clamp(this._read().mist, 0, 1)
    const cut = Math.exp(Math.log(14000) + (Math.log(2600) - Math.log(14000)) * Math.min(1, mist * 1.1))
    G.fog.frequency.setTargetAtTime(roof ? Math.min(cut, 5200) : cut, now, 1.2)
    G.out.gain.setTargetAtTime(this.volume * (0.8 + 0.2 * (1 - mist)), now, 0.6)

    // someone is speaking (the dialogue harp is playing): the rain steps back to
    // about a quarter, with the mids carved out further, and comes up slowly after
    const talk = this._talking
    G.carve.gain.setTargetAtTime(talk ? -10 : -4, now, talk ? 0.3 : 1.5)
    if (now >= this._pulseUntil) G.duck.gain.setTargetAtTime(talk ? 0.26 : 1, now, talk ? 0.3 : 1.4)
  }

  /** A footstep (or anything that must be heard): the rain dips for a moment. */
  pulseDuck() {
    const G = this._g
    if (!G) return
    const now = this.ctx.currentTime
    this._pulseUntil = now + 0.26
    G.duck.gain.setTargetAtTime((this._talking ? 0.26 : 1) * 0.45, now, 0.02)
  }

  // ── sparse events ──────────────────────────────────────────────────────────
  _events(dt, r) {
    const q = this.quality
    if (q < 0.3 || r < 0.15) return          // a drizzle has no single drops to pick out
    const E = this._ev
    const roof = this._mode === 'roof'
    const wet = this._water > 0.5

    E.drop -= dt
    if (E.drop <= 0) {
      E.drop = rnd(0.5, 2.4) / (0.25 + r)
      if (roof) this._woodTick(r)
      else if (wet) this._plop(r)
      else this._leafDrop(r)
    }
    E.drip -= dt
    if (E.drip <= 0) {
      E.drip = roof ? rnd(5, 13) : rnd(9, 24)
      if (!wet && r > 0.2) this._dripTrain(r, roof)
    }
    E.trickle -= dt
    if (E.trickle <= 0) {
      E.trickle = rnd(9, 24)
      if (!roof && r > 0.35 && q > 0.5) this._trickle(r, wet)
    }
  }

  _env(g, t0, attack, hold, rel, peak) {
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(peak, t0 + attack)
    g.gain.setValueAtTime(peak, t0 + attack + hold)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + rel)
  }

  _voice(pan) {
    const ctx = this.ctx
    const g = ctx.createGain()
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    if (p) { p.pan.value = pan; g.connect(p); p.connect(this._g.fog) } else g.connect(this._g.fog)
    return { g, p }
  }

  _ring(t0, f, decay, peak, pan) {
    const ctx = this.ctx
    const o = ctx.createOscillator()
    o.type = 'sine'; o.frequency.value = f
    const { g, p } = this._voice(pan)
    this._env(g, t0, 0.001, 0, decay * 4, peak)
    o.connect(g); o.start(t0); o.stop(t0 + decay * 4 + 0.05)
    o.onended = () => { try { o.disconnect(); g.disconnect(); p && p.disconnect() } catch (e) {} }
  }

  // one heavy drop on a leaf, close by: a clear tick with a faint soft thump
  _leafDrop(r) {
    if (!this._g) return
    const t = this.ctx.currentTime + 0.02
    const pan = rnd(-0.9, 0.9)
    const f = rnd(1800, 4200)
    this._ring(t, f, rnd(0.008, 0.02), rnd(0.10, 0.26) * (0.5 + 0.5 * r), pan)
    this._ring(t, f * 0.5, 0.012, 0.025, pan)
  }

  // one big bubble on water
  _plop(r) {
    if (!this._g) return
    const ctx = this.ctx, t = ctx.currentTime + 0.02
    const pan = rnd(-0.9, 0.9)
    const o = ctx.createOscillator()
    o.type = 'sine'
    const f0 = rnd(500, 1700)
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(f0 * 2.1, t + 0.05)
    const { g, p } = this._voice(pan)
    this._env(g, t, 0.003, 0.01, rnd(0.04, 0.09), rnd(0.12, 0.3) * (0.5 + 0.5 * r))
    o.connect(g); o.start(t); o.stop(t + 0.2)
    o.onended = () => { try { o.disconnect(); g.disconnect(); p && p.disconnect() } catch (e) {} }
  }

  // wood tick on a roof: dry and short
  _woodTick(r) {
    if (!this._g) return
    const t = this.ctx.currentTime + 0.02
    const pan = rnd(-0.6, 0.6)
    this._ring(t, rnd(700, 1500), 0.006, rnd(0.10, 0.22), pan)
    this._ring(t, rnd(120, 200), 0.03, 0.08, pan)
  }

  // water running off a leaf or a thatch edge: drip, drip, drip...
  _dripTrain(r, roof) {
    if (!this._g) return
    const n = Math.round(rnd(3, roof ? 10 : 7))
    const pan = rnd(-0.8, 0.8)
    const f = rnd(1100, 2400) * (roof ? 0.7 : 1)
    let t = this.ctx.currentTime + 0.05
    let gap = rnd(0.3, 0.7)
    for (let i = 0; i < n; i++) {
      const ff = f * (1 - 0.04 * i) * rnd(0.97, 1.03)
      this._ring(t, ff, rnd(0.012, 0.03), rnd(0.07, 0.15), pan)
      this._ring(t, ff * 0.5, 0.05, 0.04, pan)
      t += gap * rnd(0.85, 1.2)
      gap *= rnd(0.96, 1.06)
    }
  }

  // a little running water off to one side: filtered noise with a stuttering
  // amplitude and a wandering centre
  _trickle(r, wet) {
    if (!this._g) return
    const ctx = this.ctx, t = ctx.currentTime + 0.05
    const dur = rnd(2.5, 5)
    const src = ctx.createBufferSource()
    src.buffer = noiseOne(ctx); src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.Q.value = 5
    const f0 = wet ? rnd(380, 800) : rnd(900, 1700)
    bp.frequency.setValueAtTime(f0, t)
    for (let i = 1; i <= 6; i++) bp.frequency.linearRampToValueAtTime(f0 * rnd(0.8, 1.35), t + dur * i / 6)
    const { g, p } = this._voice(rnd(0.5, 0.9) * (Math.random() < 0.5 ? -1 : 1))
    const curve = new Float32Array(Math.ceil(dur * 14))
    for (let i = 0; i < curve.length; i++) {
      const edge = Math.min(1, i / 10, (curve.length - 1 - i) / 14)
      curve[i] = (0.25 + 0.75 * Math.random()) * Math.max(0, edge) * 0.34 * (0.5 + 0.5 * r)
    }
    g.gain.setValueAtTime(0, t)
    g.gain.setValueCurveAtTime(curve, t, dur)
    src.connect(bp); bp.connect(g)
    src.start(t, Math.random()); src.stop(t + dur + 0.1)
    src.onended = () => { try { src.disconnect(); bp.disconnect(); g.disconnect(); p && p.disconnect() } catch (e) {} }
    // ...with small bubbles and plinks scattered through it, like a dribble
    // off a gutter or a spout
    const pan = (p && p.pan.value) || 0
    const nb = Math.round(dur * rnd(3, 6))
    for (let i = 0; i < nb; i++) {
      const tb = t + 0.2 + Math.random() * (dur - 0.3)
      const o = ctx.createOscillator(); o.type = 'sine'
      const f = wet ? rnd(450, 1200) : rnd(1400, 3200)
      o.frequency.setValueAtTime(f, tb)
      o.frequency.exponentialRampToValueAtTime(f * 1.8, tb + 0.04)
      const v = this._voice(pan * rnd(0.9, 1.1))
      this._env(v.g, tb, 0.002, 0.004, rnd(0.03, 0.07), rnd(0.05, 0.13) * (0.5 + 0.5 * r))
      o.connect(v.g); o.start(tb); o.stop(tb + 0.12)
      o.onended = () => { try { o.disconnect(); v.g.disconnect(); v.p && v.p.disconnect() } catch (e) {} }
    }
  }
}

// ── wet footsteps ────────────────────────────────────────────────────────────
// Squelch (a band of noise sliding upward as the foot pulls free), a short
// splash of fine drops, and, once the ground is properly soaked, a small
// droplet plop. Louder as the ground gets wetter. Called by player.js after the
// ordinary step sound, not for water (which has its own).
export function wetStep(ctx, terrain) {
  try {
    if (!ctx || DISABLED || terrain === 'Water') return
    const wet = weather.wet || 0
    const rain = weather.state.rain
    const k = clamp(Math.max(wet, rain * 0.5), 0, 1)
    if (k < 0.1) return
    const now = ctx.currentTime
    const vol = (0.20 + 0.24 * k) * rnd(0.85, 1.15)
    if (typeof window !== 'undefined') window.rainSound?.pulseDuck?.()
    const nz = noiseOne(ctx)
    const off = Math.random() * 1.5

    // squelch
    const s = ctx.createBufferSource(); s.buffer = nz
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.Q.value = 2.2
    const f0 = rnd(380, 560)
    bp.frequency.setValueAtTime(f0, now)
    bp.frequency.exponentialRampToValueAtTime(f0 * rnd(2.3, 3.2), now + 0.11)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(vol * 1.6, now + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.14)
    s.connect(bp); bp.connect(g); g.connect(ctx.destination)
    s.start(now, off); s.stop(now + 0.16)

    // splash
    const s2 = ctx.createBufferSource(); s2.buffer = nz
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'; hp.frequency.value = rnd(1800, 2800)
    const g2 = ctx.createGain()
    g2.gain.setValueAtTime(vol * 0.9, now + 0.01)
    g2.gain.exponentialRampToValueAtTime(0.0005, now + 0.08)
    s2.connect(hp); hp.connect(g2); g2.connect(ctx.destination)
    s2.start(now + 0.01, off + 0.3); s2.stop(now + 0.1)

    // a droplet thrown up falls back
    if (k > 0.55) {
      const o = ctx.createOscillator(); o.type = 'sine'
      const f = rnd(600, 1100)
      o.frequency.setValueAtTime(f, now + 0.07)
      o.frequency.exponentialRampToValueAtTime(f * 1.9, now + 0.11)
      const g3 = ctx.createGain()
      g3.gain.setValueAtTime(0, now + 0.07)
      g3.gain.linearRampToValueAtTime(vol * 0.5, now + 0.075)
      g3.gain.exponentialRampToValueAtTime(0.0005, now + 0.15)
      o.connect(g3); g3.connect(ctx.destination)
      o.start(now + 0.07); o.stop(now + 0.16)
    }
  } catch (e) { /* a missed squelch is not worth an error */ }
}

export default RainSound

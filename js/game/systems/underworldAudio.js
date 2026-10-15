// underworldAudio.js
// Location: js/game/systems/underworldAudio.js
//
// The sound of the other side: all of it made here, no files. One small graph, built when you arrive and
// taken down when you leave.
//
//   a drone       two low sines a fifth apart, a triangle under them, swelling on a slow breath of their own
//   air           a faint noise, moving: the draught that goes through the passages
//   a reverb      every event below is sent through a long dark room, so the place is bigger than it looks
//   drips         (drip(): wet = it fell in water) a plink, a bubble; louder the nearer
//   water         (setWater(0..1)) a trickle that comes up as you go into the wet and falls away
//   settling      a far low rumble of stone, now and then
//   whispers      very quiet breath-voices from somewhere to one side, now and then, more when watched
//   eyes          eyeOpen(): a rising shimmer; eyeVanish(): a hiss and a blip. setWatched(n): a heartbeat, quicker
//                 and louder the more of them can see you
//
//   const audio = new UnderworldAudio(scene)       null-safe: if there is no audio context it does nothing
//   audio.update(dtMs)  audio.drip(pan, near, wet)  audio.setWater(v)  audio.setWatched(n)  audio.destroy()

import { SoundBoard } from './soundBoard.js'

const rnd = (a, b) => a + Math.random() * (b - a)

export default class UnderworldAudio {
  constructor(scene, { volume = 0.85 } = {}) {
    const c = this.c = SoundBoard.ctx(scene)
    this.dead = !c
    if (!c) return
    this.t = { drip: 0, rumble: rnd(15, 30), whisper: rnd(12, 25), beat: 0 }
    this.watched = 0
    this.nodes = []
    const keep = (n) => { this.nodes.push(n); return n }
    const gain = (v) => { const g = keep(c.createGain()); g.gain.value = v; return g }

    this.out = gain(0)
    this.out.connect(c.destination)
    this.out.gain.setTargetAtTime(volume, c.currentTime, 1.5)
    this.dry = gain(1); this.dry.connect(this.out)
    this.send = gain(1)
    this.verb = keep(c.createConvolver())
    this.verb.buffer = this._impulse(3.4, 2.4)
    const verbOut = gain(0.9)
    this.send.connect(this.verb); this.verb.connect(verbOut); verbOut.connect(this.out)

    // the drone
    const droneBus = gain(0.0); droneBus.connect(this.dry); droneBus.connect(this.send)
    droneBus.gain.setTargetAtTime(1, c.currentTime, 3)
    const lp = keep(c.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 260; lp.connect(droneBus)
    const mk = (type, f, g) => { const o = keep(c.createOscillator()); o.type = type; o.frequency.value = f; const gg = gain(g); o.connect(gg); gg.connect(lp); o.start(); return gg }
    const g1 = mk('sine', 55, 0.05), g2 = mk('sine', 82.6, 0.032), g3 = mk('triangle', 110.4, 0.016)
    const lfo = keep(c.createOscillator()); lfo.frequency.value = 0.045
    const lg = gain(0.018); lfo.connect(lg); lg.connect(g1.gain); lg.connect(g2.gain); lfo.start()

    // air through the passages
    this.noise = this._noise(4)
    const air = keep(c.createBufferSource()); air.buffer = this.noise; air.loop = true
    const af = keep(c.createBiquadFilter()); af.type = 'bandpass'; af.frequency.value = 520; af.Q.value = 0.7
    const ag = gain(0.012)
    air.connect(af); af.connect(ag); ag.connect(this.dry); ag.connect(this.send); air.start()
    const alfo = keep(c.createOscillator()); alfo.frequency.value = 0.07
    const alg = gain(0.007); alfo.connect(alg); alg.connect(ag.gain); alfo.start()
    const alfo2 = keep(c.createOscillator()); alfo2.frequency.value = 0.031
    const alg2 = gain(180); alfo2.connect(alg2); alg2.connect(af.frequency); alfo2.start()

    // water underfoot, near the wet
    const wsrc = keep(c.createBufferSource()); wsrc.buffer = this._noise(3); wsrc.loop = true
    const wf = keep(c.createBiquadFilter()); wf.type = 'bandpass'; wf.frequency.value = 1500; wf.Q.value = 1.3
    this.water = gain(0)
    wsrc.connect(wf); wf.connect(this.water); this.water.connect(this.dry); this.water.connect(this.send); wsrc.start()
    const wlfo = keep(c.createOscillator()); wlfo.frequency.value = 0.4
    const wlg = gain(420); wlfo.connect(wlg); wlg.connect(wf.frequency); wlfo.start()
  }

  _noise(sec) {
    const c = this.c, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
    return b
  }
  _impulse(sec, decay) {
    const c = this.c, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch)
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) * (i < 400 ? i / 400 : 1)
    }
    return b
  }

  // a one-shot into the dry bus and the reverb: gain node g, panned
  _route(node, pan = 0, dry = 0.7, wet = 0.8) {
    const c = this.c
    const p = c.createStereoPanner ? c.createStereoPanner() : null
    if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(p) }
    const last = p || node
    const d = c.createGain(); d.gain.value = dry; last.connect(d); d.connect(this.dry)
    const w = c.createGain(); w.gain.value = wet; last.connect(w); w.connect(this.send)
    return last
  }
  _env(g, peak, attack, decay) {
    const c = this.c, t = c.currentTime
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  }
  _stop(src, sec) { src.stop(this.c.currentTime + sec + 0.1); src.onended = () => { try { src.disconnect() } catch (e) {} } }

  // a drop: near 0..1 (1 right here), wet: it fell in water
  drip(pan = 0, near = 0.5, wet = false) {
    if (this.dead) return
    const c = this.c, o = c.createOscillator(), g = c.createGain()
    const f = wet ? rnd(520, 900) : rnd(1500, 2600)
    o.type = 'sine'; o.frequency.setValueAtTime(f, c.currentTime)
    o.frequency.exponentialRampToValueAtTime(wet ? f * 1.5 : f * 0.62, c.currentTime + (wet ? 0.09 : 0.07))
    this._env(g, 0.05 + 0.1 * near, 0.002, wet ? 0.16 : 0.1)
    o.connect(g); this._route(g, pan, 0.4 + 0.5 * near, 0.9)
    o.start(); this._stop(o, 0.4)
  }

  // how wet the ground round you is, 0..1
  setWater(v) { if (!this.dead) this.water.gain.setTargetAtTime(0.055 * v, this.c.currentTime, 0.4) }
  // how many of them can see you
  setWatched(n) { this.watched = n }

  // something opens its eyes in the dark
  eyeOpen(pan = 0) {
    if (this.dead) return
    const c = this.c
    for (const [f0, f1, v] of [[620, 930, 0.012], [931, 1396, 0.008]]) {
      const o = c.createOscillator(), g = c.createGain()
      o.type = 'sine'; o.frequency.setValueAtTime(f0, c.currentTime); o.frequency.exponentialRampToValueAtTime(f1, c.currentTime + 1.2)
      this._env(g, v, 0.5, 1.4)
      o.connect(g); this._route(g, pan, 0.3, 1.2)
      o.start(); this._stop(o, 2.2)
    }
    const o = c.createOscillator(), g = c.createGain()
    o.type = 'sine'; o.frequency.value = 73.4
    this._env(g, 0.05, 0.7, 1.6)
    o.connect(g); this._route(g, pan * 0.5, 0.6, 0.8)
    o.start(); this._stop(o, 2.5)
  }
  // ...and it is gone
  eyeVanish(pan = 0) {
    if (this.dead) return
    const c = this.c
    const src = c.createBufferSource(); src.buffer = this.noise
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(3200, c.currentTime); f.frequency.exponentialRampToValueAtTime(900, c.currentTime + 0.25); f.Q.value = 2
    const g = c.createGain(); this._env(g, 0.05, 0.01, 0.22)
    src.connect(f); f.connect(g); this._route(g, pan, 0.6, 1)
    src.start(c.currentTime, Math.random() * 3); this._stop(src, 0.4)
    const o = c.createOscillator(), og = c.createGain()
    o.type = 'sine'; o.frequency.setValueAtTime(700, c.currentTime); o.frequency.exponentialRampToValueAtTime(180, c.currentTime + 0.22)
    this._env(og, 0.035, 0.005, 0.2)
    o.connect(og); this._route(og, pan, 0.5, 1)
    o.start(); this._stop(o, 0.4)
  }

  // a ghoul shows itself: a long rasp of breath and a low growl under it, before it runs
  ghoulHiss(pan = 0) {
    if (this.dead) return
    const c = this.c, t0 = c.currentTime
    const src = c.createBufferSource(); src.buffer = this.noise
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(2200, t0); f.frequency.linearRampToValueAtTime(4200, t0 + 0.7); f.Q.value = 1.6
    const g = c.createGain(); this._env(g, 0.11, 0.2, 0.7)
    src.connect(f); f.connect(g); this._route(g, pan, 0.8, 0.9)
    src.start(t0, Math.random() * 3); this._stop(src, 1.2)
    const o = c.createOscillator(), lp = c.createBiquadFilter(), og = c.createGain()
    o.type = 'sawtooth'; o.frequency.setValueAtTime(64, t0); o.frequency.linearRampToValueAtTime(48, t0 + 0.9)
    lp.type = 'lowpass'; lp.frequency.value = 240
    this._env(og, 0.07, 0.25, 0.7)
    o.connect(lp); lp.connect(og); this._route(og, pan, 0.7, 1)
    o.start(t0); this._stop(o, 1.2)
  }

  _rumble() {
    const c = this.c
    const src = c.createBufferSource(); src.buffer = this.noise
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = rnd(90, 150)
    const g = c.createGain(); this._env(g, 0.2, 1.0, 2.6)
    src.connect(f); f.connect(g); this._route(g, rnd(-0.8, 0.8), 0.7, 0.9)
    src.start(c.currentTime, Math.random() * 3); this._stop(src, 4)
    // a few small stones after it
    for (let i = 0; i < 4; i++) setTimeout(() => this.dead || this.drip(rnd(-0.8, 0.8), 0.2, false), 700 + i * rnd(250, 700))
  }
  _whisper() {
    const c = this.c
    const src = c.createBufferSource(); src.buffer = this.noise
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 9
    const t = c.currentTime, f0 = rnd(700, 1500)
    f.frequency.setValueAtTime(f0, t); f.frequency.linearRampToValueAtTime(f0 * rnd(0.7, 1.4), t + 1.6)
    const g = c.createGain(); this._env(g, 0.045, 0.6, 1.4)
    src.connect(f); f.connect(g); this._route(g, rnd(-1, 1), 0.25, 1.4)
    src.start(t, Math.random() * 3); this._stop(src, 2.4)
  }
  _beat(level) {
    const c = this.c
    for (const [dt, v, f] of [[0, 0.16, 54], [0.2, 0.1, 46]]) {
      const o = c.createOscillator(), g = c.createGain()
      o.type = 'sine'; o.frequency.setValueAtTime(f, c.currentTime + dt); o.frequency.exponentialRampToValueAtTime(f * 0.6, c.currentTime + dt + 0.12)
      g.gain.setValueAtTime(0.0001, c.currentTime + dt)
      g.gain.linearRampToValueAtTime(v * level, c.currentTime + dt + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dt + 0.2)
      o.connect(g); g.connect(this.dry); g.connect(this.send)
      o.start(c.currentTime + dt); o.stop(c.currentTime + dt + 0.3)
    }
  }

  update(dtMs) {
    if (this.dead) return
    const dt = dtMs / 1000
    this.t.rumble -= dt; this.t.whisper -= dt * (1 + this.watched * 0.8)
    if (this.t.rumble <= 0) { this._rumble(); this.t.rumble = rnd(30, 70) }
    if (this.t.whisper <= 0) { this._whisper(); this.t.whisper = rnd(18, 45) }
    if (this.watched > 0) {
      this.t.beat -= dt
      if (this.t.beat <= 0) { this._beat(Math.min(1, 0.45 + this.watched * 0.25)); this.t.beat = Math.max(0.62, 1.25 - this.watched * 0.18) }
    } else this.t.beat = 0
  }

  destroy() {
    if (this.dead) return
    this.dead = true
    const c = this.c
    try { this.out.gain.cancelScheduledValues(c.currentTime); this.out.gain.setTargetAtTime(0, c.currentTime, 0.25) } catch (e) {}
    setTimeout(() => {
      for (const n of this.nodes) { try { n.stop?.() } catch (e) {} try { n.disconnect() } catch (e) {} }
      this.nodes = []
    }, 1400)
  }
}

// farHostAudio.js — the far training ground, heard
// Location: js/game/effects/farHostAudio.js
//
// Distant clashes, shouts, cheers, horns and hooves for farHost.js, all synthesised (no files),
// all through one "far away" bus: a low-passed, echoing, reverberant send, so everything sounds
// like it is coming across a sound of water. The bus level follows how much of the host the fog
// is letting you see (setLevel), and nothing is made while it is off-screen.
//
//   clash      blade on blade / staff on staff, a handful a second at most
//   shout      one voice: a call, a bout cry (now and then, with clashes)
//   cheer      the ring roaring at a good bout: many voices and a clatter of hands
//   carnyx     the war-horn: a rasping low call; two notes for a change of formation,
//              a long rising blast with a second horn under it for the charge
//   volley     a long hiss of javelins in the air
//   hooves     the chariots going by: a rolling drum of ground
//
// Uses the game's AudioContext (window._phaserAudioContext); silent if there isn't one yet.

const TAU = Math.PI * 2
const rnd = (a, b) => a + Math.random() * (b - a)

export default class FarHostAudio {
  constructor(opts = {}) {
    this.volume = opts.volume ?? 0.55
    this.level = 0                  // 0..1: how much of it the player can see (and so hear)
    this.target = 0
    this.ctx = null
    this.last = { clash: 0, shout: 0, cheer: 0, horn: 0, volley: 0, hooves: 0 }
    this.nodes = null
  }

  _ctx() {
    const c = window._phaserAudioContext
    if (!c || c.state === 'closed') return null
    if (c.state === 'suspended') { c.resume().catch(() => {}); return null }
    if (c !== this.ctx) { this.ctx = c; this._build(c) }
    return c
  }

  _build(c) {
    // master -> lowpass -> dry + (echo + reverb) -> out
    const master = c.createGain(); master.gain.value = 0
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.4
    const dry = c.createGain(); dry.gain.value = 0.55
    const wet = c.createGain(); wet.gain.value = 0.7
    const conv = c.createConvolver()
    const len = Math.floor(c.sampleRate * 2.4), ir = c.createBuffer(2, len, c.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) * (i < 400 ? i / 400 : 1)
    }
    conv.buffer = ir
    const echo = c.createDelay(1.5); echo.delayTime.value = 0.46
    const fb = c.createGain(); fb.gain.value = 0.26
    const ef = c.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 600
    echo.connect(ef).connect(fb).connect(echo)
    master.connect(lp)
    lp.connect(dry).connect(c.destination)
    lp.connect(conv).connect(wet).connect(c.destination)
    lp.connect(echo); ef.connect(wet)
    this.nodes = { master, lp }
  }

  /** 0..1: how clearly the host can be seen right now. */
  setLevel(v) { this.target = Math.max(0, Math.min(1, v)) }

  /** Called every frame (dt seconds): eases the bus toward the target level. */
  update(dt) {
    const c = this._ctx(); if (!c || !this.nodes) return
    this.level += (this.target - this.level) * Math.min(1, dt * 1.5)
    const L = this.level
    this.nodes.master.gain.setTargetAtTime(this.volume * (0.1 + 0.9 * L * L), c.currentTime, 0.25)
    this.nodes.lp.frequency.setTargetAtTime(380 + 1500 * L, c.currentTime, 0.3)
  }

  _ok(kind, gap) {
    const t = performance.now() / 1000
    if (t - this.last[kind] < gap) return false
    this.last[kind] = t
    return true
  }

  event(name, d = {}) {
    if (this.target < 0.01) return
    const c = this._ctx(); if (!c || !this.nodes) return
    const pan = d.x != null ? Math.max(-0.8, Math.min(0.8, (d.x / 360 - 0.5) * 1.4)) : rnd(-0.5, 0.5)
    const out = this._panner(c, pan)
    if (name === 'clash') {
      if (!this._ok('clash', 0.22)) return
      this.clash(c, out)
    } else if (name === 'cheer') {
      if ((d.n ?? 0) < 12 || !this._ok('cheer', 7)) return
      this.cheer(c, out, Math.min(1, (d.n ?? 12) / 40))
    } else if (name === 'formation') {
      if (!this._ok('horn', 2)) return
      this.carnyx(c, out, d.kind || 'call')
    } else if (name === 'volley') {
      if (this._ok('volley', 3)) this.volley(c, out)
    } else if (name === 'chariots') {
      if (this._ok('hooves', 10)) { this.carnyx(c, out, 'call'); this.hooves(c, out, d.lead || 0, d.dur || 25) }
    }
  }

  _panner(c, p) {
    const n = this.nodes.master
    if (!c.createStereoPanner) return n
    const sp = c.createStereoPanner(); sp.pan.value = p; sp.connect(n)
    return sp
  }

  _noise(c, dur) {
    const b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate), d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const s = c.createBufferSource(); s.buffer = b
    return s
  }

  clash(c, out) {
    const t = c.currentTime, v = rnd(0.12, 0.3), metal = Math.random() < 0.45
    const n = this._noise(c, 0.06), f = c.createBiquadFilter(), g = c.createGain()
    f.type = 'bandpass'; f.frequency.value = rnd(1800, 3600); f.Q.value = 0.8
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
    n.connect(f).connect(g).connect(out); n.start(t)
    const parts = metal ? [[rnd(1500, 2300), 1], [rnd(3100, 3900), 0.5], [rnd(4800, 5600), 0.25]] : [[rnd(380, 520), 1], [rnd(1000, 1300), 0.5]]
    for (const [hz, a] of parts) {
      const o = c.createOscillator(), og = c.createGain(), ring = metal ? rnd(0.35, 0.7) : rnd(0.06, 0.1)
      o.type = metal ? 'sine' : 'triangle'; o.frequency.value = hz
      og.gain.setValueAtTime(v * a * 0.5, t); og.gain.exponentialRampToValueAtTime(0.0001, t + ring)
      o.connect(og).connect(out); o.start(t); o.stop(t + ring + 0.05)
    }
  }

  // one voice: a formant-filtered sawtooth with a rising-falling pitch, like a call across a field
  _voice(c, out, t, f0, dur, vol, vowel) {
    const o = c.createOscillator(); o.type = 'sawtooth'
    o.frequency.setValueAtTime(f0 * 0.92, t)
    o.frequency.linearRampToValueAtTime(f0 * 1.18, t + dur * 0.35)
    o.frequency.linearRampToValueAtTime(f0 * 0.8, t + dur)
    const vib = c.createOscillator(), vg = c.createGain()
    vib.frequency.value = rnd(5, 7); vg.gain.value = f0 * 0.02; vib.connect(vg).connect(o.frequency)
    const F = vowel === 'a' ? [[720, 8, 1], [1150, 9, 0.5], [2500, 10, 0.1]] : [[460, 7, 1], [900, 8, 0.6], [2400, 10, 0.1]]
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.08)
    g.gain.setValueAtTime(vol, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    for (const [hz, q, a] of F) {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = hz; bp.Q.value = q
      const fg = c.createGain(); fg.gain.value = a
      o.connect(bp).connect(fg).connect(g)
    }
    g.connect(out)
    o.start(t); vib.start(t); o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05)
  }

  shout(c, out, bout) {
    const t = c.currentTime + rnd(0, 0.1), f0 = rnd(105, 175)
    this._voice(c, out, t, f0, bout ? rnd(0.6, 0.95) : rnd(0.4, 0.7), rnd(0.6, 0.95), Math.random() < 0.6 ? 'a' : 'o')
  }

  cheer(c, out, size) {
    const t = c.currentTime, voices = 5 + Math.round(size * 8)
    for (let i = 0; i < voices; i++) {
      const fem = Math.random() < 0.3
      this._voice(c, out, t + rnd(0, 0.7), (fem ? 210 : 112) * rnd(0.88, 1.15), rnd(0.9, 1.7), rnd(0.12, 0.22) * (0.6 + size), Math.random() < 0.5 ? 'a' : 'o')
    }
    // hands and staves
    const n = this._noise(c, 2.2), bp = c.createBiquadFilter(), g = c.createGain()
    bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.6
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18 * size + 0.05, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2)
    n.connect(bp).connect(g).connect(out); n.start(t)
  }

  // the carnyx: a low, rasping brass note with a bell-mouth growl. kind: call (two notes), surge (rising), charge (long, two horns)
  carnyx(c, out, kind) {
    const t0 = c.currentTime + 0.05
    const note = (t, hz, dur, vol, bend, scoop = 0.93, attack = 0) => {
      const o = c.createOscillator(), o2 = c.createOscillator(); o.type = 'sawtooth'; o2.type = 'square'
      for (const [osc, m] of [[o, 1], [o2, 1.005]]) {
        osc.frequency.setValueAtTime(hz * m * scoop, t)
        osc.frequency.exponentialRampToValueAtTime(hz * m, t + (scoop < 0.97 ? 0.18 : 0.04))
        if (bend) osc.frequency.exponentialRampToValueAtTime(hz * m * bend, t + dur)
      }
      // the rattle: the reed buzzing, amplitude-modulated fast
      const trem = c.createOscillator(), tg = c.createGain(), amp = c.createGain()
      trem.frequency.value = rnd(26, 34); tg.gain.value = 0.35; amp.gain.value = 0.65
      trem.connect(tg).connect(amp.gain)
      const env = c.createGain()
      env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(vol, t + (attack || Math.min(0.12, dur * 0.25)))
      env.gain.setValueAtTime(vol, t + dur * (attack ? 0.5 : 0.72)); env.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      const bell = [[hz * 4, 3, 0.8], [hz * 8, 3, 0.35]]
      const mix = c.createGain(); mix.gain.value = 0.5
      o.connect(mix); o2.connect(mix)
      mix.connect(amp).connect(env)
      for (const [fz, q, a] of bell) {
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(fz, 3000); bp.Q.value = q
        const fg = c.createGain(); fg.gain.value = a * 0.6
        amp.connect(bp).connect(fg).connect(env)
      }
      env.connect(out)
      for (const s of [o, o2, trem]) { s.start(t); s.stop(t + dur + 0.05) }
    }
    // "The Bold Fenian Men" in D minor (from the sheet music, 3/4). Phrases are [hz, beats]: the verse's
    // opening three, then the chorus's three. Heard singly and out of order while the host manoeuvres;
    // only at the charge do they all come round in sequence.
    const C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392, A4 = 440, C5 = 523.25, D5 = 587.33, E5 = 659.25
    const PH = {
      listened: [[A4, 1], [C5, 1.5], [E5, 0.5], [D5, 2]],               // list-ened a while
      song:     [[D4, 0.5], [E4, 0.5], [F4, 2]],                         // to the song
      humming:  [[G4, 0.5], [F4, 0.5], [E4, 0.5], [C4, 1.5], [D4, 0.5], [E4, 0.5]],   // she was hum-ming
      glory1:   [[D4, 0.5], [E4, 0.5], [F4, 2]],                         // Glo-ry O!
      glory2:   [[G4, 0.5], [A4, 0.5], [C5, 2]],                         // Glo-ry O!
      men:      [[A4, 0.5], [G4, 0.5], [A4, 1], [D4, 1], [C4, 1], [D4, 3]],   // To the bold Fen-ian men
    }
    // each note a little detached so the tune can be heard; the last of a phrase lingers (hold)
    const play = (seq, t, vol, beat = 0.42, hold = 1) => {
      let tt = t
      seq.forEach(([hz, b], i) => { const d = b * beat * (i === seq.length - 1 ? hold : 1); note(tt, hz, d + 0.1, vol, 1.0, 0.99); tt += d + 0.03 })
      return tt
    }
    // The drone: the horn's low D and its fifth hold underneath and swell as the phrases go on, and when
    // the line comes together on its last note every voice sounds at once and rings out.
    const D2 = 73.42, A2 = 110, D3 = 146.83, A3 = 220
    const drone = (t, hz, dur, vol, rise) => { note(t, hz, dur, vol, 1.0, 0.995, rise); note(t, hz * 1.004, dur, vol * 0.6, 1.0, 0.995, rise) }   // a hair apart: it beats slowly
    // out of order: the bag cycles through the phrases, never in the tune's own order, and the drone
    // under each grows a little with every phrase heard
    const BAG = ['glory1', 'humming', 'listened', 'men', 'song', 'glory2']
    const nextPhrase = () => PH[BAG[(this._phr = (this._phr ?? -1) + 1) % BAG.length]]
    const n = this._heard = (this._heard ?? 0) + 1, bed = Math.min(0.3, 0.12 + 0.03 * n)
    if (kind === 'call') {
      drone(t0, D2, 7, bed, 1.6)
      play(nextPhrase(), t0 + 0.4, 0.45, 0.46, 1.8)
    } else if (kind === 'surge') {
      drone(t0, D2, 9, bed + 0.03, 1.8)
      play(nextPhrase(), t0 + 0.5, 0.5, 0.46, 1.8)          // still just one phrase: leave the rest unsaid
    } else {
      // the charge: the tune comes round at last, in order, slow and with air between the phrases;
      // under it only the low D and its fifth, and at the end one long chord
      drone(t0, D2, 30, 0.26, 3.2); drone(t0 + 5, A2, 24, 0.18, 3.0)
      let tt = t0 + 0.4
      for (const k of ['listened', 'glory1', 'glory2']) tt = play(PH[k], tt, 0.5, 0.5, 1.6) + 0.7
      const tEnd = play(PH.men.slice(0, -1), tt, 0.55, 0.5, 1)
      note(tEnd, D4, 12, 0.36, 1.0, 0.995, 0.4)              // the last D, long
      drone(tEnd, D3, 14, 0.2, 0.8)
    }
  }

  volley(c, out) {
    const t = c.currentTime, n = this._noise(c, 1.6), bp = c.createBiquadFilter(), g = c.createGain()
    bp.type = 'bandpass'; bp.Q.value = 1.2
    bp.frequency.setValueAtTime(900, t); bp.frequency.linearRampToValueAtTime(2200, t + 0.9); bp.frequency.linearRampToValueAtTime(1200, t + 1.6)
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.65, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)
    n.connect(bp).connect(g).connect(out); n.start(t)
  }

  // Thunder of hooves: a pre-rendered gallop (low thuds with a pitch drop, four to a stride, plus a
  // rumble of earth) that swells as the chariots come on, rolls on while they run and dies away.
  hooves(c, out, lead = 0, dur = 25) {
    if (!this._hb || this._hb.sr !== c.sampleRate) {
      const sr = c.sampleRate, len = Math.floor(sr * 6), buf = c.createBuffer(1, len, sr), d = buf.getChannelData(0)
      let lp = 0
      for (let i = 0; i < len; i++) { lp += (Math.random() * 2 - 1 - lp) * 0.02; d[i] = lp * 3 }   // rumble
      const stride = 0.34
      for (let st = 0; st * stride < 5.8; st++) {
        for (const [off, amp] of [[0, 1], [0.07, 0.7], [0.15, 0.9], [0.22, 0.6]]) {
          const t0 = Math.floor((st * stride + off + Math.random() * 0.03) * sr), f0 = 95 - Math.random() * 20
          for (let j = 0; j < sr * 0.22 && t0 + j < len; j++) {
            const tt = j / sr, env = Math.exp(-tt * 20)
            d[t0 + j] += amp * env * (Math.sin(TAU * (f0 * 0.55 * tt + f0 * 0.45 * (1 - Math.exp(-tt * 30)) / 30)) * 1.4 + (Math.random() * 2 - 1) * 0.25 * Math.exp(-tt * 70))
          }
        }
      }
      let mx = 0; for (let i = 0; i < len; i++) mx = Math.max(mx, Math.abs(d[i])); for (let i = 0; i < len; i++) d[i] /= mx || 1
      this._hb = { buf, sr }
    }
    const t = c.currentTime + lead, run = Math.max(8, dur), s = c.createBufferSource(), lp = c.createBiquadFilter(), g = c.createGain()
    s.buffer = this._hb.buf; s.loop = true; s.playbackRate.value = 1
    lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.5
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(1.3, t + 3)
    g.gain.setValueAtTime(1.3, t + run * 0.7)
    g.gain.exponentialRampToValueAtTime(0.0001, t + run)
    s.connect(lp).connect(g).connect(out); s.start(t); s.stop(t + run + 0.2)
  }

  destroy() { this.nodes?.master.disconnect(); this.nodes = null }
}

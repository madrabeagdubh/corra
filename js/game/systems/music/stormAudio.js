// stormAudio.js
// Location: js/game/systems/music/stormAudio.js
//
// Synthesised storm soundscape for d3_open_sea.
// Architecture mirrors forgeAudio.js — pure Web Audio API.
//
// Layers:
//   1. Wind bed      — detuned oscillators + noise, pitch rises with intensity
//   2. Wind howl     — periodic pitched swoops, eerie and frightening
//   3. Wave crashes  — low rumble + mid crash + high spray tail
//   4. Spray patter  — rain of droplets falling back to sea
//
// Usage:
//   import { StormAudio } from '../systems/music/stormAudio.js'
//   const storm = new StormAudio()
//   storm.start()
//   storm.setIntensity(0.0 – 1.0)   // call each frame
//   storm.stop()

export class StormAudio {

  constructor() {
    this.ac          = null
    this.master      = null
    this._intensity  = 0
    this._running    = false

    // Layer gains
    this._windBedGain   = null
    this._windHowlGain  = null
    this._crashGain     = null
    this._sprayGain     = null

    // Scheduling
    this._nextCrash     = 0
    this._nextHowl      = 0
    this._nextSpray     = 0
    this._scheduleAhead = 0.1   // seconds

    this._rafId         = null
  }

  start() {
    if (this._running) return
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      this.ac = new AC()

      this.master = this.ac.createGain()
      this.master.gain.value = 0
      this.master.connect(this.ac.destination)

      this._buildWindBed()
      this._buildWindHowl()
      this._buildSprayBed()

      this._running = true
      this._nextCrash = this.ac.currentTime + 1.0
      this._nextHowl  = this.ac.currentTime + 2.0
      this._nextSpray = this.ac.currentTime + 0.5

      this._tick()
      console.log('[StormAudio] started')
    } catch(e) {
      console.warn('[StormAudio] failed:', e)
    }
  }

  setIntensity(v) {
    this._intensity = Math.max(0, Math.min(1, v))
  }

  stop() {
    this._running = false
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null }
    if (!this.ac) return
    try {
      const now = this.ac.currentTime
      this.master.gain.setValueAtTime(this.master.gain.value, now)
      this.master.gain.linearRampToValueAtTime(0, now + 1.5)
      setTimeout(() => {
        try { this.ac?.close() } catch(e) {}
        this.ac = null
      }, 2000)
    } catch(e) {}
    console.log('[StormAudio] stopped')
  }

  // ── Wind bed — continuous detuned oscillators + noise ─────────────────────
  // The foundation of the storm. Multiple oscillators slightly detuned
  // create that unsettling howl. Noise adds the rushing air character.

  _buildWindBed() {
    const ac = this.ac

    // Three detuned sawtooth oscillators for the howling bed
    this._windOscs = []
    const freqs = [55, 58, 62]   // low detuned cluster
    for (const f of freqs) {
      const osc = ac.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = f

      // Heavily lowpass filtered — removes the buzz, keeps the moan
      const lp = ac.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 400
      lp.Q.value = 0.8

      const g = ac.createGain()
      g.gain.value = 0
      osc.connect(lp); lp.connect(g)
      g.connect(this.master)
      osc.start()
      this._windOscs.push({ osc, gain: g, baseFreq: f })
    }

    // Noise layer for the rushing air sound
    const noiseBuf = this._makeNoiseBuf(8.0)
    this._windNoise = ac.createBufferSource()
    this._windNoise.buffer = noiseBuf
    this._windNoise.loop = true

    // Bandpass shaped to wind frequencies
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 800
    bp.Q.value = 0.5

    const hp = ac.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 200

    this._windBedGain = ac.createGain()
    this._windBedGain.gain.value = 0

    this._windNoise.connect(bp); bp.connect(hp); hp.connect(this._windBedGain)
    this._windBedGain.connect(this.master)
    this._windNoise.start()
  }

  // ── Wind howl — periodic eerie pitched swoops ─────────────────────────────
  // The frightening element. A pitch that rises and falls unpredictably.

  _buildWindHowl() {
    const ac = this.ac
    this._windHowlGain = ac.createGain()
    this._windHowlGain.gain.value = 0
    this._windHowlGain.connect(this.master)
  }

  _scheduleHowl(startTime) {
    if (!this.ac || !this._windHowlGain) return
    const ac        = this.ac
    const intensity = this._intensity
    if (intensity < 0.2) return

    const dur    = 1.8 + Math.random() * 3.5
    const buf    = this._makeNoiseBuf(dur)
    const src    = ac.createBufferSource()
    src.buffer   = buf

    // Narrow bandpass creates the pitched howl character
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 8.0   // very narrow = pitch

    // Sweep frequency for the howling motion
    const f0 = 120 + Math.random() * 200
    const f1 = f0 * (0.6 + Math.random() * 0.8)
    bp.frequency.setValueAtTime(f0, startTime)
    bp.frequency.exponentialRampToValueAtTime(f1, startTime + dur * 0.6)
    bp.frequency.exponentialRampToValueAtTime(
      f0 * (0.7 + Math.random() * 0.5), startTime + dur)

    // Second harmonic for richer howl
    const bp2 = ac.createBiquadFilter()
    bp2.type = 'bandpass'
    bp2.Q.value = 5.0
    bp2.frequency.setValueAtTime(f0 * 2.1, startTime)
    bp2.frequency.exponentialRampToValueAtTime(f1 * 2.1, startTime + dur * 0.6)

    const g = ac.createGain()
    g.gain.setValueAtTime(0, startTime)
    g.gain.linearRampToValueAtTime(
      (0.15 + intensity * 0.35) * (0.6 + Math.random() * 0.6),
      startTime + dur * 0.25)
    g.gain.setValueAtTime(
      (0.12 + intensity * 0.28) * (0.6 + Math.random() * 0.4),
      startTime + dur * 0.7)
    g.gain.linearRampToValueAtTime(0, startTime + dur)

    src.connect(bp); bp.connect(g)
    src.connect(bp2); bp2.connect(g)
    g.connect(this._windHowlGain)
    src.start(startTime)
    src.stop(startTime + dur)
  }

  // ── Wave crash — low rumble + mid crash + high spray tail ─────────────────

  _scheduleWaveCrash(startTime) {
    if (!this.ac) return
    const ac        = this.ac
    const intensity = this._intensity
    if (intensity < 0.1) return

    const dur = 1.5 + intensity * 1.5

    // ── Low rumble — the weight of the wave ──
    const rumbleBuf = this._makeNoiseBuf(dur * 0.8)
    const rumble    = ac.createBufferSource()
    rumble.buffer   = rumbleBuf

    const rumbleLp = ac.createBiquadFilter()
    rumbleLp.type = 'lowpass'
    rumbleLp.frequency.value = 150

    const rumbleG = ac.createGain()
    rumbleG.gain.setValueAtTime(0, startTime)
    rumbleG.gain.linearRampToValueAtTime(0.5 + intensity * 0.4, startTime + 0.06)
    rumbleG.gain.exponentialRampToValueAtTime(0.001, startTime + dur * 0.7)

    rumble.connect(rumbleLp); rumbleLp.connect(rumbleG); rumbleG.connect(this.master)
    rumble.start(startTime); rumble.stop(startTime + dur * 0.8)

    // ── Mid crash — the impact ──
    const crashBuf = this._makeNoiseBuf(dur * 0.5)
    const crash    = ac.createBufferSource()
    crash.buffer   = crashBuf

    const crashBp = ac.createBiquadFilter()
    crashBp.type = 'bandpass'
    crashBp.frequency.value = 600 + Math.random() * 400
    crashBp.Q.value = 0.8

    const crashG = ac.createGain()
    crashG.gain.setValueAtTime(0, startTime)
    crashG.gain.linearRampToValueAtTime(0.4 + intensity * 0.5, startTime + 0.04)
    crashG.gain.exponentialRampToValueAtTime(0.001, startTime + dur * 0.5)

    crash.connect(crashBp); crashBp.connect(crashG); crashG.connect(this.master)
    crash.start(startTime); crash.stop(startTime + dur * 0.5)

    // ── High spray tail — the hiss after impact ──
    const sprayBuf = this._makeNoiseBuf(dur)
    const spray    = ac.createBufferSource()
    spray.buffer   = sprayBuf

    const sprayHp = ac.createBiquadFilter()
    sprayHp.type = 'highpass'
    sprayHp.frequency.value = 2000 + Math.random() * 1000

    const sprayG = ac.createGain()
    sprayG.gain.setValueAtTime(0, startTime + 0.08)
    sprayG.gain.linearRampToValueAtTime(0.15 + intensity * 0.20, startTime + 0.2)
    sprayG.gain.exponentialRampToValueAtTime(0.001, startTime + dur)

    spray.connect(sprayHp); sprayHp.connect(sprayG); sprayG.connect(this.master)
    spray.start(startTime + 0.08); spray.stop(startTime + dur)
  }

  // ── Spray patter — droplets falling back to sea ───────────────────────────
  // Rapid short noise bursts at medium-high frequency.
  // Sounds like rain on water — the aftermath of a crash.

  _buildSprayBed() {
    const ac = this.ac
    const buf = this._makeNoiseBuf(6.0)
    this._sprayNode = ac.createBufferSource()
    this._sprayNode.buffer = buf
    this._sprayNode.loop = true

    const hp = ac.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 2500

    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 6000

    this._sprayGain = ac.createGain()
    this._sprayGain.gain.value = 0
    this._sprayNode.connect(hp); hp.connect(lp); lp.connect(this._sprayGain)
    this._sprayGain.connect(this.master)
    this._sprayNode.start()
  }

  // ── Main tick — update gains and schedule events ──────────────────────────

  _tick() {
    if (!this._running) return
    this._rafId = requestAnimationFrame(() => this._tick())

    if (!this.ac) return
    if (this.ac.state === 'suspended') this.ac.resume()

    const now       = this.ac.currentTime
    const intensity = this._intensity
    const t         = intensity

    // Master volume
    const targetMaster = 0.25 + t * 0.55
    this._ramp(this.master.gain, targetMaster, 0.05)

    // Wind bed — oscillators rise in pitch and volume with intensity
    if (this._windOscs) {
      const windVol = t * t * 0.18
      for (const { osc, gain, baseFreq } of this._windOscs) {
        // Pitch rises with storm — wind screams higher
        const targetFreq = baseFreq * (1 + t * 0.8)
        osc.frequency.setTargetAtTime(targetFreq, now, 0.5)
        this._ramp(gain.gain, windVol, 0.04)
      }
    }

    // Wind noise bed
    if (this._windBedGain) {
      this._ramp(this._windBedGain.gain, t * 0.35, 0.04)
    }

    // Spray bed hiss
    if (this._sprayGain) {
      this._ramp(this._sprayGain.gain, Math.max(0, t - 0.25) * 0.28, 0.03)
    }

    // Schedule wave crashes
    const crashInterval = Math.max(1.5, 6.0 - t * 4.5)
    if (now + this._scheduleAhead > this._nextCrash && t > 0.08) {
      this._scheduleWaveCrash(this._nextCrash)
      this._nextCrash += crashInterval * (0.7 + Math.random() * 0.6)
    }

    // Schedule wind howls
    const howlInterval = Math.max(2.0, 8.0 - t * 5.0)
    if (now + this._scheduleAhead > this._nextHowl && t > 0.2) {
      this._scheduleHowl(this._nextHowl)
      this._nextHowl += howlInterval * (0.5 + Math.random() * 1.0)
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _ramp(param, target, tau) {
    if (!this.ac) return
    const now = this.ac.currentTime
    const cur = param.value
    param.setTargetAtTime(target, now, tau)
  }

  _makeNoiseBuf(duration) {
    const ac      = this.ac
    const samples = Math.ceil(ac.sampleRate * duration)
    const buf     = ac.createBuffer(1, samples, ac.sampleRate)
    const data    = buf.getChannelData(0)
    for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1
    return buf
  }
}


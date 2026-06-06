// stormAudio.js
// Location: js/game/systems/music/stormAudio.js
//
// Wind is the lead. Ocean breathes slowly beneath it.
// Thunder is rare and dramatic — synced to lightning via callback.

export class StormAudio {

  constructor() {
    this.ac        = null
    this.master    = null
    this.intensity = 0
    this._running  = false

    this._rafId        = null
    this._nextWindGust = 0
    this._nextThunder  = 0
    this._oceanLayers  = []
    this._windGain     = null

    // Called by d3OpenSea when thunder fires — sync lightning
    this.onThunder     = null
  }

  start() {
    if (this._running) return
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      this.ac     = new AC()
      this.master = this.ac.createGain()
      this.master.gain.value = 0.85
      this.master.connect(this.ac.destination)


      this._running      = true
      this._nextWindGust = this.ac.currentTime + 0.3
      this._nextThunder  = this.ac.currentTime + 10 + Math.random() * 15

      this._tick()
      console.log('[StormAudio] started')
    } catch(e) {
      console.warn('[StormAudio] failed:', e)
    }
  }

  setIntensity(v) {
    this.intensity = Math.max(0, Math.min(1, v))
  }

  stop() {
    this._running = false
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null }
    if (!this.ac) return
    try {
      const now = this.ac.currentTime
      this.master.gain.setValueAtTime(this.master.gain.value, now)
      this.master.gain.linearRampToValueAtTime(0, now + 2.5)
      setTimeout(() => { try { this.ac?.close() } catch(e) {} this.ac = null }, 3000)
    } catch(e) {}
  }

  // ── Ocean — slowly breathing layers ──────────────────────────────────────
  // Five bandpass layers at different frequencies and LFO rates.
  // The LFOs are slow (8-20s period) — the ocean breathing not waves crashing.
  // Each layer has a harmonic relationship to the others.
  // The complexity comes from them being slightly out of phase.


  _buildWindBed() {
    const ac  = this.ac
    const buf = this._makeNoiseBuf(12.0)
    const src = ac.createBufferSource()
    src.buffer = buf; src.loop = true

    const hp = ac.createBiquadFilter()
    hp.type = 'highpass'; hp.frequency.value = 400
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 2200

    this._windGain = ac.createGain()
    this._windGain.gain.value = 0
    src.connect(hp); hp.connect(lp); lp.connect(this._windGain)
    this._windGain.connect(this.master)
    src.start()
  }

  // ── Wind gust — the star ──────────────────────────────────────────────────
  // High-Q bandpass on noise, sweeping upward.
  // Multiple voices, each with a distinct "word" — a shape to its sweep.
  // The wind says something different each time.

  // ── Storm roar — furious, arrives with rain ─────────────────────────────────
  _scheduleStormRoar(when) {
    if (!this.ac || this.intensity < 0.25) return
    const ac = this.ac
    const t  = this.intensity
    const voices = t < 0.5 ? 1 : 2

    for (let v = 0; v < voices; v++) {
      const dur  = 2.0 + Math.random() * 4.0 + t * 3.0
      const buf  = this._makeNoiseBuf(dur)
      const src  = ac.createBufferSource()
      src.buffer = buf

      const bp   = ac.createBiquadFilter()
      bp.type    = 'bandpass'
      bp.Q.value = 3 + Math.random() * 4

      const f0     = 300 + Math.random() * 400
      const offset = v * 0.4 + Math.random() * 0.6
      bp.frequency.setValueAtTime(f0, when + offset)
      const steps = 4 + Math.floor(Math.random() * 4)
      for (let s = 1; s <= steps; s++) {
        bp.frequency.exponentialRampToValueAtTime(
          200 + Math.random() * 800,
          when + offset + dur * s / steps)
      }

      const vol = (0.25 + t * 0.50) * (0.6 + Math.random() * 0.5)
      const g   = ac.createGain()
      g.gain.setValueAtTime(0, when + offset)
      g.gain.linearRampToValueAtTime(vol, when + offset + dur * 0.1)
      g.gain.setValueAtTime(vol * 0.9, when + offset + dur * 0.8)
      g.gain.linearRampToValueAtTime(0, when + offset + dur)

      src.connect(bp); bp.connect(g); g.connect(this.master)
      src.start(when + offset)
      src.stop(when + offset + dur + 0.1)
    }
  }

    _scheduleWindGust(when) {
    if (!this.ac) return
    const ac = this.ac
    const t  = this.intensity

    // Number of simultaneous voices
    const voices = t < 0.2 ? 1 : t < 0.45 ? 2 : t < 0.7 ? 3 : 5

    // Different "words" the wind can say — different sweep shapes
    const shapes = [
      // Long rising moan — oooOOOOOOO
      (bp, g, start, dur, vol) => {
        bp.Q.value = 25 + Math.random() * 15
        const f0 = 120 + Math.random() * 80
        bp.frequency.setValueAtTime(f0, start)
        bp.frequency.exponentialRampToValueAtTime(f0 * 3.5, start + dur * 0.85)
        bp.frequency.exponentialRampToValueAtTime(f0 * 3.2, start + dur)
        g.gain.setValueAtTime(0, start)
        g.gain.linearRampToValueAtTime(vol * 0.3, start + dur * 0.1)
        g.gain.linearRampToValueAtTime(vol, start + dur * 0.45)
        g.gain.linearRampToValueAtTime(vol * 0.8, start + dur * 0.8)
        g.gain.linearRampToValueAtTime(0, start + dur)
      },
      // Rise and fall — oooOOOooo — like someone calling out then fading
      (bp, g, start, dur, vol) => {
        bp.Q.value = 30 + Math.random() * 20
        const f0 = 160 + Math.random() * 100
        bp.frequency.setValueAtTime(f0, start)
        bp.frequency.exponentialRampToValueAtTime(f0 * 2.8, start + dur * 0.5)
        bp.frequency.exponentialRampToValueAtTime(f0 * 1.1, start + dur)
        g.gain.setValueAtTime(0, start)
        g.gain.linearRampToValueAtTime(vol, start + dur * 0.35)
        g.gain.setValueAtTime(vol * 0.9, start + dur * 0.55)
        g.gain.linearRampToValueAtTime(0, start + dur)
      },
      // Short sharp cry — a shriek
      (bp, g, start, dur, vol) => {
        const d = dur * 0.35
        bp.Q.value = 40 + Math.random() * 20
        const f0 = 250 + Math.random() * 200
        bp.frequency.setValueAtTime(f0, start)
        bp.frequency.exponentialRampToValueAtTime(f0 * 4.0, start + d * 0.6)
        bp.frequency.exponentialRampToValueAtTime(f0 * 3.5, start + d)
        g.gain.setValueAtTime(0, start)
        g.gain.linearRampToValueAtTime(vol * 1.2, start + d * 0.2)
        g.gain.exponentialRampToValueAtTime(0.001, start + d)
      },
      // Wavering — oOoOoOo — the wind changing direction
      (bp, g, start, dur, vol) => {
        bp.Q.value = 22 + Math.random() * 12
        const f0 = 180 + Math.random() * 80
        // Multiple waypoints creating the wavering
        bp.frequency.setValueAtTime(f0, start)
        bp.frequency.exponentialRampToValueAtTime(f0 * 2.2, start + dur * 0.2)
        bp.frequency.exponentialRampToValueAtTime(f0 * 1.4, start + dur * 0.4)
        bp.frequency.exponentialRampToValueAtTime(f0 * 3.0, start + dur * 0.65)
        bp.frequency.exponentialRampToValueAtTime(f0 * 1.8, start + dur * 0.85)
        bp.frequency.exponentialRampToValueAtTime(f0 * 2.5, start + dur)
        g.gain.setValueAtTime(0, start)
        g.gain.linearRampToValueAtTime(vol * 0.7, start + dur * 0.15)
        g.gain.setValueAtTime(vol * 0.7, start + dur * 0.85)
        g.gain.linearRampToValueAtTime(0, start + dur)
      },
    ]

    for (let v = 0; v < voices; v++) {
      const dur    = 3.0 + Math.random() * 7.0 + t * 5.0
      const buf    = this._makeNoiseBuf(dur)
      const src    = ac.createBufferSource()
      src.buffer   = buf

      const bp = ac.createBiquadFilter()
      bp.type  = 'bandpass'

      const vol    = (0.35 + t * 0.65) * (0.5 + Math.random() * 0.6)
      const g      = ac.createGain()
      const offset = v * 0.5 + Math.random() * 1.2

      // Pick a shape — bias toward long moans but allow variety
      const shapeIdx = Math.random() < 0.5 ? 0
                     : Math.random() < 0.5 ? 1
                     : Math.random() < 0.5 ? 2 : 3
      shapes[shapeIdx](bp, g, when + offset, dur, vol)

      src.connect(bp); bp.connect(g); g.connect(this.master)
      src.start(when + offset)
      src.stop(when + offset + dur + 0.2)
    }
  }

  // ── Thunder — rare, long, sometimes with lightning callback ───────────────

  _scheduleThunder(when) {
    if (!this.ac) return
    const ac   = this.ac
    const size = 0.5 + Math.random() * 0.5

    // Notify lightning
    if (this.onThunder) {
      const delayMs = (when - ac.currentTime) * 1000
      setTimeout(() => this.onThunder(size), Math.max(0, delayMs))
    }

    // Pick a thunder personality
    const roll = Math.random()
    if (roll < 0.25)      this._thunderCrackAndRoll(when, size, ac)
    else if (roll < 0.50) this._thunderDeepRumble(when, size, ac)
    else if (roll < 0.70) this._thunderStutter(when, size, ac)
    else if (roll < 0.85) this._thunderDistant(when, size, ac)
    else                  this._thunderMajestic(when, size, ac)
  }

  // ── Sharp crack followed by classic rolling boom ──
  _thunderCrackAndRoll(when, size, ac) {
    // Crack — pure impulse. Only fires 1 in 4 times.
    if (Math.random() < 0.25) {
      const buf = this._makeNoiseBuf(0.04)
      const src = ac.createBufferSource()
      src.buffer = buf
      const g = ac.createGain()
      g.gain.setValueAtTime(1.0, when)
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.04)
      src.connect(g); g.connect(this.master)
      src.start(when); src.stop(when + 0.05)
    }
    // Body — mid crack
    {
      const buf = this._makeNoiseBuf(0.3)
      const src = ac.createBufferSource()
      src.buffer = buf
      const bp = ac.createBiquadFilter()
      bp.type = 'bandpass'; bp.frequency.value = 300; bp.Q.value = 0.4
      const g = ac.createGain()
      g.gain.setValueAtTime(0.7 + size * 0.2, when + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.3)
      src.connect(bp); bp.connect(g); g.connect(this.master)
      src.start(when + 0.01); src.stop(when + 0.35)
    }
    // Deep roll
    const dur = 5 + Math.random() * 5
    {
      const buf = this._makeNoiseBuf(dur)
      const src = ac.createBufferSource()
      src.buffer = buf
      const lp = ac.createBiquadFilter()
      lp.type = 'lowpass'; lp.frequency.value = 55 + Math.random() * 30
      const g = ac.createGain()
      g.gain.setValueAtTime(0, when + 0.02)
      g.gain.linearRampToValueAtTime(0.75 + size * 0.25, when + 0.1)
      g.gain.exponentialRampToValueAtTime(0.06, when + 1.5)
      g.gain.exponentialRampToValueAtTime(0.001, when + dur)
      src.connect(lp); lp.connect(g); g.connect(this.master)
      src.start(when); src.stop(when + dur)
    }
    // Mid rumble layer
    {
      const buf = this._makeNoiseBuf(dur * 0.7)
      const src = ac.createBufferSource()
      src.buffer = buf
      const bp = ac.createBiquadFilter()
      bp.type = 'bandpass'; bp.frequency.value = 100 + Math.random() * 60; bp.Q.value = 0.7
      const g = ac.createGain()
      g.gain.setValueAtTime(0, when + 0.05)
      g.gain.linearRampToValueAtTime(0.35 + size * 0.2, when + 0.2)
      g.gain.exponentialRampToValueAtTime(0.001, when + dur * 0.7)
      src.connect(bp); bp.connect(g); g.connect(this.master)
      src.start(when); src.stop(when + dur * 0.7)
    }
  }

  // ── Long mysterious deep rumble — distant, no crack ──
  _thunderDeepRumble(when, size, ac) {
    const dur = 8 + Math.random() * 8
    // Very deep, almost subsonic
    for (let layer = 0; layer < 3; layer++) {
      const freq = 30 + layer * 25 + Math.random() * 20
      const buf  = this._makeNoiseBuf(dur)
      const src  = ac.createBufferSource()
      src.buffer = buf
      src.playbackRate.value = 0.8 + Math.random() * 0.4
      const lp = ac.createBiquadFilter()
      lp.type = 'lowpass'; lp.frequency.value = freq
      const startDelay = layer * (0.3 + Math.random() * 0.5)
      const g = ac.createGain()
      g.gain.setValueAtTime(0, when + startDelay)
      g.gain.linearRampToValueAtTime(
        (0.4 + size * 0.3) / (layer + 1),
        when + startDelay + 0.5 + layer * 0.3)
      g.gain.exponentialRampToValueAtTime(0.001, when + dur - layer)
      src.connect(lp); lp.connect(g); g.connect(this.master)
      src.start(when + startDelay); src.stop(when + dur)
    }
  }

  // ── Stutter — ka KA kakakaaaa — multiple rapid strikes ──
  _thunderStutter(when, size, ac) {
    // Initial big crack
    this._thunderCrackAndRoll(when, size * 0.7, ac)
    // Rapid secondary strikes
    const numStrikes = 2 + Math.floor(Math.random() * 4)
    let t = when + 0.3 + Math.random() * 0.2
    for (let i = 0; i < numStrikes; i++) {
      const strikeSize = size * (0.3 + Math.random() * 0.5) * (1 - i * 0.15)
      const buf = this._makeNoiseBuf(0.12)
      const src = ac.createBufferSource()
      src.buffer = buf
      const bp = ac.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 200 + Math.random() * 400
      bp.Q.value = 0.5
      const g = ac.createGain()
      g.gain.setValueAtTime(0.5 * strikeSize, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
      src.connect(bp); bp.connect(g); g.connect(this.master)
      src.start(t); src.stop(t + 0.15)
      t += 0.08 + Math.random() * 0.18
    }
    // Final long fade
    const fadeDur = 4 + Math.random() * 4
    const buf = this._makeNoiseBuf(fadeDur)
    const src = ac.createBufferSource()
    src.buffer = buf
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 70
    const g = ac.createGain()
    g.gain.setValueAtTime(0.3 * size, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + fadeDur)
    src.connect(lp); lp.connect(g); g.connect(this.master)
    src.start(t); src.stop(t + fadeDur)
  }

  // ── Distant — just a low far-away rumble, no crack ──
  _thunderDistant(when, size, ac) {
    const dur = 6 + Math.random() * 6
    const delay = 0.5 + Math.random() * 1.0  // arrives late
    const buf = this._makeNoiseBuf(dur)
    const src = ac.createBufferSource()
    src.buffer = buf
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 45 + Math.random() * 25
    const g = ac.createGain()
    g.gain.setValueAtTime(0, when + delay)
    g.gain.linearRampToValueAtTime(0.25 + size * 0.15, when + delay + 1.0)
    g.gain.exponentialRampToValueAtTime(0.001, when + delay + dur)
    src.connect(lp); lp.connect(g); g.connect(this.master)
    src.start(when + delay); src.stop(when + delay + dur)
  }

  // ── Majestic — massive crack, enormous boom, long slow roll ──
  _thunderMajestic(when, size, ac) {
    // Giant crack — 1 in 4
    if (Math.random() < 0.25) {
      const buf = this._makeNoiseBuf(0.06)
      const src = ac.createBufferSource()
      src.buffer = buf
      const g = ac.createGain()
      g.gain.setValueAtTime(1.0, when)
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.06)
      src.connect(g); g.connect(this.master)
      src.start(when); src.stop(when + 0.07)
    }
    // Enormous sub boom
    const dur = 10 + Math.random() * 6
    {
      const buf = this._makeNoiseBuf(dur)
      const src = ac.createBufferSource()
      src.buffer = buf
      const lp = ac.createBiquadFilter()
      lp.type = 'lowpass'; lp.frequency.value = 40 + Math.random() * 20
      const g = ac.createGain()
      g.gain.setValueAtTime(0, when + 0.01)
      g.gain.linearRampToValueAtTime(0.9 + size * 0.1, when + 0.06)
      g.gain.exponentialRampToValueAtTime(0.1, when + 2.0)
      g.gain.exponentialRampToValueAtTime(0.001, when + dur)
      src.connect(lp); lp.connect(g); g.connect(this.master)
      src.start(when); src.stop(when + dur)
    }
    // Rolling mid with LFO wobble
    {
      const buf = this._makeNoiseBuf(dur * 0.8)
      const src = ac.createBufferSource()
      src.buffer = buf
      const bp = ac.createBiquadFilter()
      bp.type = 'bandpass'; bp.frequency.value = 90; bp.Q.value = 0.8
      const lfo = ac.createOscillator()
      lfo.frequency.value = 0.4 + Math.random() * 0.3
      const lfoG = ac.createGain(); lfoG.gain.value = 40
      lfo.connect(lfoG); lfoG.connect(bp.frequency)
      const g = ac.createGain()
      g.gain.setValueAtTime(0, when + 0.08)
      g.gain.linearRampToValueAtTime(0.5 + size * 0.2, when + 0.3)
      g.gain.exponentialRampToValueAtTime(0.001, when + dur * 0.8)
      src.connect(bp); bp.connect(g); g.connect(this.master)
      lfo.start(when); lfo.stop(when + dur * 0.8)
      src.start(when + 0.08); src.stop(when + dur * 0.8)
    }
  }



  // ── Main tick ─────────────────────────────────────────────────────────────

  _tick() {
    if (!this._running) return
    this._rafId = requestAnimationFrame(() => this._tick())
    if (!this.ac) return
    if (this.ac.state === 'suspended') this.ac.resume()

    const now = this.ac.currentTime
    const t   = this.intensity
    const dt  = 1 / 60

    // ── Ocean layers ──
    for (const layer of this._oceanLayers) {
      layer.phase += layer.rate * dt
      const lfo = (Math.sin(layer.phase) + 1) * 0.5  // 0-1

      const effT = Math.max(0, (t - layer.minIntens) / (1 - layer.minIntens + 0.01))
      // Base volume is low — ocean is present but not overwhelming
      const baseVol   = effT * 0.18
      const targetVol = baseVol * (0.3 + layer.amp * lfo)
      layer.gain.gain.setTargetAtTime(Math.max(0, targetVol), now, 0.5)

      // Filter breathes too — very slowly
      const freqLfo = 1.0 + Math.sin(layer.phase * 0.18) * 0.18
      layer.filter.frequency.setTargetAtTime(
        layer.baseFreq * freqLfo, now, 2.0)
    }



    // ── Storm roar — arrives with rain ──
    if (!this._nextStormRoar) this._nextStormRoar = now + 2
    if (now >= this._nextStormRoar && t > 0.25) {
      this._scheduleStormRoar(now + 0.05)
      const minR = Math.max(1.0, 4.0 - t * 3.0)
      const maxR = Math.max(2.5, 8.0 - t * 5.0)
      this._nextStormRoar = now + minR + Math.random() * (maxR - minR)
    }

    // ── Wind gusts ──
    if (now >= this._nextWindGust) {
      this._scheduleWindGust(now + 0.05)
      // At calm: lonely gaps. At full storm: overlapping voices constantly.
      const minGap = Math.max(0.5, 4.5 - t * 4.0)
      const maxGap = Math.max(1.5, 10.0 - t * 8.0)
      this._nextWindGust = now + minGap + Math.random() * (maxGap - minGap)
    }

    // ── Thunder ──
    if (now >= this._nextThunder && t > 0.1) {
      this._scheduleThunder(now + 0.1 + Math.random() * 0.5)
      const minT = Math.max(8,  25 - t * 17)
      const maxT = Math.max(15, 55 - t * 38)
      this._nextThunder = now + minT + Math.random() * (maxT - minT)
    }
  }

  _makeNoiseBuf(duration) {
    const ac      = this.ac
    const samples = Math.ceil(ac.sampleRate * Math.min(duration, 20))
    const buf     = ac.createBuffer(1, samples, ac.sampleRate)
    const data    = buf.getChannelData(0)
    for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1
    return buf
  }
}


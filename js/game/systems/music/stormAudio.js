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

      this._buildOcean()
      this._buildWindBed()

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

  _buildOcean() {
    const ac = this.ac

    // Harmonically related frequencies — like overtones of a very low fundamental
    // 40Hz fundamental (below hearing but felt), then 80, 120, 200, 360
    // These are 1st, 2nd, 3rd, 5th, 9th harmonics — not a perfect chord,
    // which is why the ocean sounds complex and restless rather than musical
    const defs = [
      { freq: 80,  Q: 2.5, period: 18.0, amp: 0.55 },  // fundamental roar
      { freq: 140, Q: 3.0, period: 13.5, amp: 0.45 },  // second harmonic
      { freq: 220, Q: 2.8, period: 11.0, amp: 0.38 },  // third — the "body"
      { freq: 380, Q: 2.2, period: 16.5, amp: 0.30 },  // fifth — adds tension
      { freq: 650, Q: 1.8, period: 9.5,  amp: 0.22 },  // upper — the shimmer
    ]

    for (const def of defs) {
      const buf = this._makeNoiseBuf(def.period * 2.2)
      const src = ac.createBufferSource()
      src.buffer = buf
      src.loop   = true
      // Slightly different playback rates so texture is never static
      src.playbackRate.value = 0.93 + Math.random() * 0.14

      const bp = ac.createBiquadFilter()
      bp.type  = 'bandpass'
      bp.frequency.value = def.freq
      bp.Q.value = def.Q

      const g = ac.createGain()
      g.gain.value = 0

      src.connect(bp)
      bp.connect(g)
      g.connect(this.master)
      src.start(0, Math.random() * def.period)

      this._oceanLayers.push({
        gain:     g,
        filter:   bp,
        phase:    Math.random() * Math.PI * 2,
        rate:     (Math.PI * 2) / def.period,
        amp:      def.amp,
        baseFreq: def.freq,
        minIntens: def.freq > 300 ? 0.3 : 0.0,
      })
    }
  }

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

    // Notify lightning system — flash should coincide with crack
    if (this.onThunder) {
      const delayMs = (when - ac.currentTime) * 1000
      setTimeout(() => this.onThunder(size), Math.max(0, delayMs))
    }

    // ── Sub-bass rumble — long rolling away ──
    {
      const dur = 5.0 + Math.random() * 7.0
      const buf = this._makeNoiseBuf(dur)
      const src = ac.createBufferSource()
      src.buffer = buf
      const lp = ac.createBiquadFilter()
      lp.type = 'lowpass'; lp.frequency.value = 55 + Math.random() * 35
      const g = ac.createGain()
      g.gain.setValueAtTime(0, when)
      g.gain.linearRampToValueAtTime(0.55 + size * 0.35, when + 0.05)
      g.gain.setValueAtTime(0.45 + size * 0.28, when + 0.8)
      g.gain.exponentialRampToValueAtTime(0.001, when + dur)
      src.connect(lp); lp.connect(g); g.connect(this.master)
      src.start(when); src.stop(when + dur)
    }

    // ── Mid crack — not always, but when present it's sharp ──
    if (Math.random() < 0.6) {
      const buf = this._makeNoiseBuf(0.18)
      const src = ac.createBufferSource()
      src.buffer = buf
      const bp = ac.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 250 + Math.random() * 300
      bp.Q.value = 0.9
      const g = ac.createGain()
      g.gain.setValueAtTime(0.7 + size * 0.3, when)
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.18)
      src.connect(bp); bp.connect(g); g.connect(this.master)
      src.start(when); src.stop(when + 0.2)
    }

    // ── Second roll — distant echo ──
    if (Math.random() < 0.45) {
      const delay = 1.5 + Math.random() * 3.0
      const dur   = 3.0 + Math.random() * 4.0
      const buf   = this._makeNoiseBuf(dur)
      const src   = ac.createBufferSource()
      src.buffer  = buf
      const lp    = ac.createBiquadFilter()
      lp.type = 'lowpass'; lp.frequency.value = 45
      const g = ac.createGain()
      g.gain.setValueAtTime(0, when + delay)
      g.gain.linearRampToValueAtTime(0.22 + size * 0.18, when + delay + 0.15)
      g.gain.exponentialRampToValueAtTime(0.001, when + delay + dur)
      src.connect(lp); lp.connect(g); g.connect(this.master)
      src.start(when + delay); src.stop(when + delay + dur)
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

    // ── Wind bed ──
    if (this._windGain) {
      this._windGain.gain.setTargetAtTime(0.02 + t * 0.08, now, 0.3)
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


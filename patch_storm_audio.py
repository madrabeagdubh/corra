path = '/data/data/com.termux/files/home/Corra/js/game/scenes/locations/bog/d3OpenSea.js'
with open(path, 'r') as f:
    content = f.read()

changes = 0

# 1. Init audio in create()
old = "    this._struggleTimer   = 0"
new = """    this._struggleTimer   = 0

    // Storm audio
    this._stormAC       = null
    this._stormMaster   = null
    this._windGain      = null
    this._windNoise     = null
    this._waveGain      = null
    this._sprayGain     = null
    this._lastWaveCrash = 0
    this._initStormAudio()"""
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('audio init added to create')
else:
    print('WARN: struggleTimer not found')

# 2. Add audio update call in update loop
old = "    // Storm camera\n    this._applyStormCamera(delta, intensity)"
new = """    // Storm audio
    this._updateStormAudio(intensity, delta)

    // Storm camera
    this._applyStormCamera(delta, intensity)"""
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('audio update call added')
else:
    print('WARN: storm camera not found')

# 3. Add audio cleanup to _cleanupEffects
old = "  _cleanupEffects() {\n    this.cameras?.main?.setRotation(0)\n    this._waveRenderer?.destroy()\n    this._waveRenderer = null"
new = """  _cleanupEffects() {
    this.cameras?.main?.setRotation(0)
    this._waveRenderer?.destroy()
    this._waveRenderer = null
    this._stopStormAudio()"""
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('audio cleanup added')
else:
    print('WARN: cleanupEffects not found')

# 4. Add all storm audio methods before _applyStormTint
old = "  _applyStormTint(intensity) {"
new = '''  // ── Storm audio ─────────────────────────────────────────────────────────

  _initStormAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      this._stormAC     = new AC()
      this._stormMaster = this._stormAC.createGain()
      this._stormMaster.gain.value = 0
      this._stormMaster.connect(this._stormAC.destination)

      // ── Wind layer — continuous filtered noise ──
      const windBuf = this._makeNoiseBuf(4.0)
      this._windNoise = this._stormAC.createBufferSource()
      this._windNoise.buffer = windBuf
      this._windNoise.loop   = true

      // Bandpass for wind character
      const windBp = this._stormAC.createBiquadFilter()
      windBp.type            = 'bandpass'
      windBp.frequency.value = 600
      windBp.Q.value         = 0.4

      // Highpass to remove rumble
      const windHp = this._stormAC.createBiquadFilter()
      windHp.type            = 'highpass'
      windHp.frequency.value = 300

      this._windGain = this._stormAC.createGain()
      this._windGain.gain.value = 0

      this._windNoise.connect(windBp)
      windBp.connect(windHp)
      windHp.connect(this._windGain)
      this._windGain.connect(this._stormMaster)
      this._windNoise.start()

      // ── Spray layer — high freq hiss ──
      const sprayBuf = this._makeNoiseBuf(3.0)
      this._sprayNoise = this._stormAC.createBufferSource()
      this._sprayNoise.buffer = sprayBuf
      this._sprayNoise.loop   = true

      const sprayHp = this._stormAC.createBiquadFilter()
      sprayHp.type            = 'highpass'
      sprayHp.frequency.value = 3000

      this._sprayGain = this._stormAC.createGain()
      this._sprayGain.gain.value = 0

      this._sprayNoise.connect(sprayHp)
      sprayHp.connect(this._sprayGain)
      this._sprayGain.connect(this._stormMaster)
      this._sprayNoise.start()

      console.log('[StormAudio] initialised')
    } catch(e) {
      console.warn('[StormAudio] failed to init:', e)
    }
  }

  _makeNoiseBuf(duration) {
    const ac      = this._stormAC
    const samples = Math.ceil(ac.sampleRate * duration)
    const buf     = ac.createBuffer(1, samples, ac.sampleRate)
    const data    = buf.getChannelData(0)
    for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  _updateStormAudio(intensity, delta) {
    if (!this._stormAC || !this._stormMaster) return

    // Resume if suspended (browser autoplay policy)
    if (this._stormAC.state === 'suspended') {
      this._stormAC.resume()
    }

    const now    = this._stormAC.currentTime
    const smooth = 0.95   // lerp factor per frame

    // Master volume ramps in with intensity
    const targetMaster = 0.3 + intensity * 0.55
    const curMaster    = this._stormMaster.gain.value
    this._stormMaster.gain.setValueAtTime(
      curMaster + (targetMaster - curMaster) * (1 - smooth), now)

    // Wind volume and pitch rise with intensity
    if (this._windGain) {
      const targetWind = intensity * intensity * 0.7
      const curWind    = this._windGain.gain.value
      this._windGain.gain.setValueAtTime(
        curWind + (targetWind - curWind) * 0.04, now)
    }

    // Spray hiss scales with intensity
    if (this._sprayGain) {
      const targetSpray = Math.max(0, intensity - 0.3) * 0.5
      const curSpray    = this._sprayGain.gain.value
      this._sprayGain.gain.setValueAtTime(
        curSpray + (targetSpray - curSpray) * 0.03, now)
    }

    // Periodic wave crashes
    const crashInterval = Math.max(1800, 5000 - intensity * 3500)
    const elapsed       = this._t * 1000
    if (elapsed - this._lastWaveCrash > crashInterval && intensity > 0.15) {
      this._lastWaveCrash = elapsed
      this._playWaveCrash(intensity)
    }

    // Occasional wind gusts
    if (!this._nextGust) this._nextGust = elapsed + 3000 + Math.random() * 4000
    if (elapsed > this._nextGust && intensity > 0.1) {
      this._nextGust = elapsed + 4000 + Math.random() * 6000
      this._playWindGust(intensity)
    }
  }

  _playWaveCrash(intensity) {
    if (!this._stormAC) return
    const ac  = this._stormAC
    const now = ac.currentTime
    const dur = 1.2 + intensity * 0.8

    const buf = this._makeNoiseBuf(dur)
    const src = ac.createBufferSource()
    src.buffer = buf

    // Shape: low rumble + mid crash + high spray
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 400

    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 1.2

    const g = ac.createGain()
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(0.4 + intensity * 0.4, now + 0.08)
    g.gain.exponentialRampToValueAtTime(0.001, now + dur)

    src.connect(bp); bp.connect(g)
    g.connect(this._stormMaster)
    src.start(now); src.stop(now + dur)

    // Add low rumble
    const src2 = ac.createBufferSource()
    src2.buffer = this._makeNoiseBuf(dur * 0.6)
    const g2 = ac.createGain()
    g2.gain.setValueAtTime(0, now)
    g2.gain.linearRampToValueAtTime(0.25 + intensity * 0.3, now + 0.15)
    g2.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.6)
    src2.connect(lp); lp.connect(g2); g2.connect(this._stormMaster)
    src2.start(now); src2.stop(now + dur * 0.6)
  }

  _playWindGust(intensity) {
    if (!this._stormAC) return
    const ac  = this._stormAC
    const now = ac.currentTime
    const dur = 1.5 + Math.random() * 2.0

    const buf = this._makeNoiseBuf(dur)
    const src = ac.createBufferSource()
    src.buffer = buf

    const hp = ac.createBiquadFilter()
    hp.type = 'highpass'; hp.frequency.value = 500 + intensity * 400

    const g = ac.createGain()
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(0.15 + intensity * 0.25, now + dur * 0.3)
    g.gain.linearRampToValueAtTime(0.05, now + dur * 0.7)
    g.gain.linearRampToValueAtTime(0, now + dur)

    src.connect(hp); hp.connect(g); g.connect(this._stormMaster)
    src.start(now); src.stop(now + dur)
  }

  _stopStormAudio() {
    if (!this._stormAC) return
    try {
      if (this._windNoise)  { this._windNoise.stop();  this._windNoise  = null }
      if (this._sprayNoise) { this._sprayNoise.stop(); this._sprayNoise = null }
      if (this._stormMaster) {
        this._stormMaster.gain.setValueAtTime(0, this._stormAC.currentTime)
      }
      setTimeout(() => {
        try { this._stormAC?.close() } catch(e) {}
        this._stormAC = null
      }, 500)
    } catch(e) {}
    console.log('[StormAudio] stopped')
  }

  _applyStormTint(intensity) {'''
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('storm audio methods added')
else:
    print('WARN: _applyStormTint not found')

with open(path, 'w') as f:
    f.write(content)
print(f'done — {changes} changes')

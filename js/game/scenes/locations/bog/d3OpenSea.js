// d3OpenSea.js
// Location: js/game/scenes/locations/bog/d3OpenSea.js

import RiverScene   from '../riverScene.js'
import WaveRenderer from '../../../effects/waveRenderer.js'
import { StormAudio }   from '../../../systems/music/stormAudio.js'
import { StormOverlay } from '../../../effects/stormOverlay.js'

const INTENSITY_START_COL  = 8
const INTENSITY_FULL_COL   = 63
const DRIFT_UNLOCK_COL     = 10
const SPEED_CAP_START_COL  = 8
const MANANNAN_TRIGGER_COL = 45   // must be past here AND struggling to summon him
const POINT_OF_NO_RETURN   = 65

const MANANNAN_WARNING = {
  ga: 'Filleadh. Ní leatsa an fharraige seo.',
  en: 'Turn back. This sea is not yours.',
}

const MANANNAN_FINAL = {
  ga: 'D\'fhanas leat. Anois, tar liom.',
  en: 'I waited for you. Now, come with me.',
}

export default class D3OpenSea extends RiverScene {

  constructor() { super({ key: 'd3_open_sea' }) }

  usesSwallows()         { return false }
  getMapKey()              { return 'd3_open_sea' }
  getAmbient()             { return 0x111a2a }
  getPlayerLight()         { return { color: 0x9ab8d8, intensity: 1.2, radius: 260 } }
  getWisps()               { return [] }
  getMusicTrack()          { return null }
  getExtraUnwalkableGIDs() { return new Set() }
  getSkyImage()            { return '/assets/skies/bog_threshold_sky.png' }
  getSkyPosition()         { return '50% 40%' }
  getMountainImage()       { return null }
  getMountainPosition()    { return '50% 100%' }

  getElevationConfig() {
    return {
      cliffGids:    new Set(),
      cliffFaceGid: 0,
      elevatedGids: new Set(),
      cliffSouth:   new Set(),
      cliffHeight:  0,
    }
  }

  preload() {
    super.preload()
    this.load.image('boat', '/assets/boat.png')
  }

  async create(data) {
    await super.create(data)

    if (this.boatSystem) {
      this.boatSystem._triggerDisembark = () => {}
      this.boatSystem._reboard          = () => {}
    }
    this._doDisembark   = () => {}
    this._noDisembarkUI = true

    // Remove swallow canvas — no birds at sea
    document.getElementById('swallow-canvas')?.remove()
    // Block swallow sounds while on this scene
    window._noSwallowSounds = true
    this._waveRenderer = new WaveRenderer(this, this.perspectiveGround)

    this._manannánWarned  = false
    this._gameOverPending = false
    this._driftUnlocked   = false
    this._stormCamT       = 0
    this._struggleTimer   = 0
    this._capsized        = false
    this._capsizeTimer    = 0

    // Storm audio
    this._stormAudio = new StormAudio()
    this._stormAudio.start()

    // Storm overlay — rain, lightning, vignette, sky
    this._stormOverlay = new StormOverlay(this)

    // Wire thunder → lightning sync
    this._stormAudio.onThunder = (size) => {
      this._stormOverlay?.triggerLightning(size)
    }

    // Wire thunder → lightning sync
    this._stormAudio.onThunder = (size) => {
      this._stormOverlay?.triggerLightning(size)
    }

    this._fadeDiv = document.createElement('div')
    this._fadeDiv.style.cssText = [
      'position:fixed', 'top:0', 'left:0',
      'width:100%', 'height:100%',
      'background:black',
      'opacity:0',
      'pointer-events:none',
      'z-index:99',
      'transition:opacity 4s ease-in',
    ].join(';')
    document.body.appendChild(this._fadeDiv)
  }

  onEnter() {
    // No swallows or ambient birds in the open sea
    if (this._swallows) { this._swallows.stop(); this._swallows = null }
    this.time.delayedCall(50, () => {
      if (!this.boatSystem || !this.perspectiveGround) return
      if (this.textures.exists('boat')) {
        this.perspectiveGround.loadBoatImage(
          this.textures.get('boat').getSourceImage()
        )
      }
      this.boatSystem._noDrift = true
      this._currentDriftOverride = 0
      this.boatSystem.activate()
    })
  }

  update(time, delta) {
    super.update(time, delta)

    if (this._disembarkBadgeShown) {
      this._disembarkBadgeShown = false
      this._encounterPanel?.clearNotify()
      this.joystick?.drawBadgeGlow?.(0)
    }

    if (!this.player || this._gameOverPending) return

    const tileX = Math.floor(this.player.logicalX / this.tileSize)
    const mapW  = this.mapData?.width ?? 72

    const raw       = (tileX - INTENSITY_START_COL) /
                      (INTENSITY_FULL_COL - INTENSITY_START_COL)
    const intensity = Math.max(0, Math.min(1, raw))
    const eastProgress = Math.max(0, Math.min(1, tileX / mapW))

    this._waveRenderer?.setIntensity(intensity)
    this._waveRenderer?.setEastProgress(eastProgress)
    this._waveRenderer?.update(delta)

    // ── Horse collision ─────────────────────────────────────────────────
    if (!this._capsized && !this._gameOverPending && !this._manannánWarned) {
      this._checkHorseCollision(tileX)
    }

    // Capsize animation tick
    if (this._capsized) {
      this._capsizeTimer += delta
      this._tickCapsize(delta)
      return
    }

    // Drift — locked until DRIFT_UNLOCK_COL
    if (!this._driftUnlocked && tileX >= DRIFT_UNLOCK_COL) {
      this._driftUnlocked = true
      this.boatSystem._noDrift = false
    }
    if (this._driftUnlocked) {
      this._currentDriftOverride = -8 - intensity * 30
    } else {
      this._currentDriftOverride = 0
      this.boatSystem._noDrift   = true
    }

    // Speed cap — boat slows to standstill at tile 63
    if (this.boatSystem) {
      if (tileX >= SPEED_CAP_START_COL) {
        const capProgress = Math.max(0, Math.min(1,
          (tileX - SPEED_CAP_START_COL) /
          (INTENSITY_FULL_COL - SPEED_CAP_START_COL)
        ))
        this.boatSystem._eastSpeedCap = Math.max(0, 160 * (1 - capProgress * capProgress))
      } else {
        this.boatSystem._eastSpeedCap = null
      }
    }

    // Storm audio + overlay
    this._stormAudio?.setIntensity(intensity)
    this._stormOverlay?.setIntensity(intensity)
    this._stormOverlay?.update(delta)

    // Storm camera handled by StormOverlay

    // ── Manannan struggle timer ───────────────────────────────────────────
    // Manannan rises after 10 seconds of the player actively pushing east
    // at the wall (past MANANNAN_TRIGGER_COL, speed nearly zero)
    if (!this._manannánWarned) {
      const joyAngle = this.joystick?.angle ?? 0
      const atWall    = tileX >= MANANNAN_TRIGGER_COL
      const pushing   = (this.joystick?.force ?? 0) > 10 &&
                        joyAngle > -60 && joyAngle < 60
      const slowSpeed = Math.abs(this.boatSystem?._vx ?? 0) < 20

      if (atWall && pushing && slowSpeed) {
        this._struggleTimer += delta
        if (this._struggleTimer > 10000) {
          this._manannánWarned = true
          this._triggerManannánWarning()
        }
      } else if (!atWall || !pushing) {
        // Reset timer if they stop pushing or retreat
        this._struggleTimer = 0
      }
    }

    // Point of no return — if player somehow gets past
    if (!this._gameOverPending && tileX >= POINT_OF_NO_RETURN) {
      this._gameOverPending = true
      this._triggerManannánFinal()
    }
  }

  // ── Storm audio ─────────────────────────────────────────────────────────

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

  // ── Horse collision ─────────────────────────────────────────────────────

  _checkHorseCollision(tileX) {
    if (!this._waveRenderer || !this.player) return
    const ts      = this.tileSize
    const horses  = this._waveRenderer._horses
    if (!horses) return

    const px = this.player.logicalX
    const py = this.player.logicalY

    const activeCount = Math.min(
      horses.length,
      Math.floor(Math.max(0, this._waveRenderer.intensity + 0.15) * horses.length)
    )
    for (let _hi = 0; _hi < activeCount; _hi++) {
      const h = horses[_hi]
      if (!h || h.worldX === undefined) continue

      // Only horses clearly above surface are dangerous
      // Use the actual dolphin curve values for accuracy
      const localI    = this._waveRenderer._localIntensity(h.worldX)
      const sinVal    = Math.sin(h.risePhase)
      const cosVal    = Math.cos(h.risePhase)
      const surfaceT  = sinVal <= 0 ? 0
        : cosVal >= 0 ? Math.pow(sinVal, 0.7)
        : Math.pow(sinVal, 0.5)
      const scaledW   = this.perspectiveGround?._scaleAtRow(h.worldY / ts + 1) ?? ts
      const fullH     = scaledW * (h.heightMult ?? 1.3) * (0.7 + localI * 0.5)
      const bobAmp    = scaledW * (0.05 + localI * 1.8)
      const cappedBob = Math.min(fullH * 0.85, surfaceT * bobAmp * localI)

      // Must be meaningfully surfaced — use absolute pixel threshold
      if (surfaceT < 0.15) continue       // not surfaced enough
      if (localI < 0.1) continue          // too far west
      if (cappedBob < 3) continue         // less than 3px above surface


      // World-space distance — trefoil is roughly circular
      const dx   = h.worldX - px
      const dy   = h.worldY - py
      const dist = Math.sqrt(dx * dx + dy * dy)

      // Tighter collision radius — only the trefoil body, not the whole tile
      const radius = ts * (0.7 + localI * 0.5)

      if (dist < radius) {
        this._triggerCapsize()
        return
      }
    }
  }

  _triggerCapsize() {
    if (this._capsized) return
    this._capsized = true
    this._capsizeTimer = 0

    // Stop all boat movement
    if (this.boatSystem) {
      this.boatSystem._vx      = 0
      this.boatSystem._vy      = 0
      this.boatSystem._noDrift = true
    }
    // Disable joystick
    if (this.joystick) this.joystick.force = 0

    // Play whinny
    this._playWhinny()

    // Signal PGR to start flip animation
    if (this.perspectiveGround) {
      this.perspectiveGround._capsizeFlip = 0   // 0 → 1 over time
    }

    console.log('[Capsize] triggered')
  }

  _tickCapsize(delta) {
    const pgr = this.perspectiveGround
    // Set flip on PGR instance — boat rotates 180 over 2 seconds
    if (pgr) {
      pgr._capsizeFlip = Math.min(1, (pgr._capsizeFlip ?? 0) + delta / 2000)
    }

    // Storm overlay tilts dramatically
    if (this._stormOverlay) {
      this._stormOverlay._tiltAngle = Math.sin(this._capsizeTimer * 0.003) * 0.25
    }

    // Fade out storm audio immediately
    if (this._stormAudio?.ac && !this._audioFading) {
      this._audioFading = true
      const ac  = this._stormAudio.ac
      const now = ac.currentTime
      this._stormAudio.master?.gain.setTargetAtTime(0, now, 1.2)
    }

    // Camera starts sinking immediately, slowly
    if (!this._capsizeFading) {
      this._capsizeFading = true
      this._beginCapsize()
    }
  }

  _playWhinny() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      const ac  = new AC()
      const now = ac.currentTime

      // Horse whinny — rising pitch burst then falling
      const osc = ac.createOscillator()
      osc.type  = 'sawtooth'

      // Whinny contour: fast rise then tumbling fall
      osc.frequency.setValueAtTime(400, now)
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.18)
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.35)
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.7)
      osc.frequency.exponentialRampToValueAtTime(180, now + 1.1)

      // Narrow bandpass for horse-throat character
      const bp  = ac.createBiquadFilter()
      bp.type   = 'bandpass'
      bp.frequency.value = 900
      bp.Q.value = 3.5

      // Vibrato — horses whinny with vibrato
      const vib   = ac.createOscillator()
      const vibG  = ac.createGain()
      vib.frequency.value  = 12
      vibG.gain.value = 30
      vib.connect(vibG)
      vibG.connect(osc.frequency)

      const g = ac.createGain()
      g.gain.setValueAtTime(0, now)
      g.gain.linearRampToValueAtTime(0.7, now + 0.05)
      g.gain.setValueAtTime(0.65, now + 0.3)
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.2)

      osc.connect(bp); bp.connect(g); g.connect(ac.destination)
      vib.start(now); osc.start(now)
      osc.stop(now + 1.3); vib.stop(now + 1.3)

      // Splash — the boat hitting the water
      const nBuf = ac.createBuffer(1,
        Math.ceil(ac.sampleRate * 0.8), ac.sampleRate)
      const nd = nBuf.getChannelData(0)
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
      const ns  = ac.createBufferSource()
      ns.buffer = nBuf
      const nlp = ac.createBiquadFilter()
      nlp.type  = 'lowpass'; nlp.frequency.value = 800
      const ng  = ac.createGain()
      ng.gain.setValueAtTime(0, now + 0.5)
      ng.gain.linearRampToValueAtTime(0.8, now + 0.55)
      ng.gain.exponentialRampToValueAtTime(0.001, now + 1.3)
      ns.connect(nlp); nlp.connect(ng); ng.connect(ac.destination)
      ns.start(now + 0.5)

      setTimeout(() => { try { ac.close() } catch(e) {} }, 2000)
    } catch(e) {
      console.warn('[Capsize] whinny failed:', e)
    }
  }

  _beginCapsize() {
    // Veil fades in slowly — after camera has been sinking a while
    const veil = document.createElement('div')
    veil.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:1000000',
      'background:#000814',
      'opacity:0',
      'pointer-events:none',
    ].join(';')
    document.body.appendChild(veil)

    // Camera sinks slowly — starts immediately, takes 5 seconds
    const cam = this.cameras?.main
    if (cam && this.player) {
      this.tweens?.add({
        targets:    cam,
        scrollY:    this.player.logicalY + 400,
        duration:   5500,
        ease:       'Sine.easeIn',
      })
    }

    // Fade to black starts after 2s, takes 3.5s
    setTimeout(() => {
      veil.style.transition = 'opacity 3.5s ease-in'
      requestAnimationFrame(() => { veil.style.opacity = '1' })
    }, 2000)

    // Reload after full fade
    setTimeout(() => {
      // Destroy wave renderer and audio before reload
      this._waveRenderer?.destroy()
      this._stormAudio?.stop()
      this._stormOverlay?.destroy()
      window.location.reload()
    }, 6000)
  }

  _applyStormTint(intensity) {
    if (intensity < 0.02) return
    const pgr = this.perspectiveGround
    if (!pgr?._gCtx) return
    const horizonPx = pgr._horizonPx?.() ?? 0
    const sw = pgr._sw, sh = pgr._sh
    if (!sw || !sh) return
    const t   = intensity
    const ctx = pgr._gCtx
    ctx.save()
    // 'multiply' darkens existing tile pixels — works regardless of alpha
    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = 0.6 + t * 0.3
    // Cold grey-green — desaturates blue tiles toward stormy ocean
    const r = Math.round(60  - t * 20)
    const g = Math.round(75  - t * 15)
    const b = Math.round(90  - t * 10)
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(0, horizonPx, sw, sh - horizonPx)
    ctx.restore()
  }



  _applyStormCamera(delta, intensity) {
    const cam = this.cameras?.main
    if (!cam || !this.player) return

    if (intensity < 0.02) {
      cam.setRotation(0)
      return
    }

    const dt = Math.min(delta / 1000, 0.05)
    this._stormCamT += dt
    const t   = this._stormCamT
    const amp = intensity * intensity

    const sw   = this.scale.width
    const sh   = this.scale.height
    const zoom = cam.zoom || 1

    const wavePhase = this._waveRenderer?.wavePhaseAtPlayer ?? 0
    const waveRise  = Math.sin(wavePhase) * 6 * amp
    const sway      = Math.sin(t * 0.55) * 2.5 * amp

    cam.scrollX = this.player.logicalX - sw / 2 / zoom + sway
    cam.scrollY = this.player.logicalY - sh / 2 / zoom + waveRise
  }

  _triggerManannánWarning() {
    if (this.boatSystem) {
      this.boatSystem._vx = 0
      this.boatSystem._vy = 0
    }
    this._waveRenderer?.spawnManannan()
    this._waveRenderer?.triggerHorseSequence()

    // Give Manannan time to drift into view before text fires
    this.time.delayedCall(3000, () => {
      this.textPanel?.show({
        ga:      MANANNAN_WARNING.ga,
        en:      MANANNAN_WARNING.en,
        type:    'notification',
        speaker: 'Manannán Mac Lir',
      })
    })
  }

  _triggerManannánFinal() {
    if (this.boatSystem) {
      this.boatSystem._vx      = 0
      this.boatSystem._vy      = 0
      this.boatSystem._noDrift = true
    }
    this._waveRenderer?.triggerHorseSurround()
    this.time.delayedCall(1200, () => {
      this.textPanel?.show({
        ga:      MANANNAN_FINAL.ga,
        en:      MANANNAN_FINAL.en,
        type:    'notification',
        speaker: 'Manannán Mac Lir',
        onDismiss: () => this._beginFade(),
      })
    })
  }

  _beginFade() {
    this._fadeDiv.style.opacity = '1'
    this.cameras?.main?.setRotation(0)
    this.time.delayedCall(4400, () => {
      if (this._fadeDiv) this._fadeDiv.style.opacity = '0'
      this.time.delayedCall(600, () => {
        this._cleanupEffects()
        this.scene.start('d3_sea')
      })
    })
  }

  _cleanupEffects() {
    this.cameras?.main?.setRotation(0)
    if (this._swallows) { this._swallows.stop(); this._swallows = null }
    this._waveRenderer?.destroy()
    this._waveRenderer = null
    this._stormAudio?.stop()
    this._stormAudio = null
    this._stormOverlay?.destroy()
    this._stormOverlay = null
    if (this._fadeDiv) {
      this._fadeDiv.parentNode?.removeChild(this._fadeDiv)
      this._fadeDiv = null
    }
  }

  checkExits() {
    if (this._capsized) return  // no exits during capsize
    if (!this.mapData?.exits) return
    const tileX = Math.floor(this.player.logicalX / this.tileSize)
    const tileY = Math.floor(this.player.logicalY / this.tileSize)
    for (const [, exitData] of Object.entries(this.mapData.exits)) {
      if (exitData.tiles.some(([ex, ey]) => ex === tileX && ey === tileY)) {
        this._cleanupEffects()
        this.scene.start(exitData.destination, {
          entryEdge:  exitData.entryPoint,
          sourceTile: { x: tileX, y: tileY }
        })
        return
      }
    }
  }

  shutdown() {
    this._cleanupEffects()
    document.getElementById('swallow-canvas')?.remove()
    super.shutdown?.()
  }
}


// d3OpenSea.js
// Location: js/game/scenes/locations/bog/d3OpenSea.js

import RiverScene              from '../riverScene.js'
import WaveRenderer            from '../../../effects/waveRenderer.js'
import { StormAudio }          from '../../../systems/music/stormAudio.js'
import { StormOverlay }        from '../../../effects/stormOverlay.js'
import { DistantRainLayer }    from '../../../effects/distantRain.js'
import { ScrollingTextPlayer } from '../../../ui/scrollingTextPlayer.js'
import { GameState }           from '../../../systems/gameState.js'

const INTENSITY_START_COL  = 8
const INTENSITY_FULL_COL   = 63
const DRIFT_UNLOCK_COL     = 10
const SPEED_CAP_START_COL  = 8
const MANANNAN_TRIGGER_COL = 45
const POINT_OF_NO_RETURN   = 65

// How close (logical px) the player must row to Manannan's spawn
// to auto-trigger the scroll without pressing the badge
const MANANNAN_COLLISION_RADIUS = 160

// Scroll speed for the Manannan sequence (px/sec)
const MANANNAN_SCROLL_SPEED = 48

const MANANNAN_FINAL = {
  ga: 'D\'fhanas leat. Anois, tar liom.',
  en: 'I waited for you. Now, come with me.',
}

const MANANNAN_LINES = [
  { ga: 'A leanbh baoth faoi mhóid bheith saor',                              en: 'O reckless child of defiant vow',                                       speaker: 'manannan' },
  { ga: 'cén gealtachas atá ort?',                                             en: 'what madness drives thee so?',                                          speaker: 'manannan' },
  { ga: 'Cad a spreagann thú chun troid i gcoinne',                            en: 'What maketh thee to quarrel against',                                   speaker: 'manannan' },
  { ga: 'mo ghaoithe craosacha',                                               en: 'my ravenous winds',                                                     speaker: 'manannan' },
  { ga: 'mo tonnta básach',                                                    en: 'my deadly waves',                                                       speaker: 'manannan' },
  { ga: 'a chroí diongbháilte',                                                en: 'O stubborn-hearted mortal',                                             speaker: 'manannan' },
  { ga: 'Óir mise a chuir ríthe faoin tonn agus a scrios laochra',             en: 'For I have drowned kings and unmade heroes',                            speaker: 'manannan' },
  { ga: 'Agus is mise a shlog síar longa bródúla na céadta tíortha',           en: 'And it is I who has swallowed up the proud ships of a hundred nations', speaker: 'manannan' },
  { ga: "Feicim d'altanna chomh bán le cnámh",                                en: 'I see thy knuckles bone-pale bright',                                   speaker: 'manannan' },
  { ga: 'i nglas ar maide oclánach',                                           en: 'locked upon a groaning oar',                                            speaker: 'manannan' },
  { ga: 'Feicim ionait cíanta bhfúr ndícheall',                                en: 'I see in you ages of mortal striving',                                  speaker: 'manannan' },
  { ga: 'Is mór an t-iontas liom fós é!',                                      en: 'At which I marvel greatly!',                                            speaker: 'manannan' },
  { ga: "Fill ar d'oileán glas",                                              en: 'Go back to thy green island',                                           speaker: 'manannan' },
  { ga: 'Scaoileann an fharraige saor tú...',                                  en: 'The sea releases thee...',                                              speaker: 'manannan' },
  { ga: 'an uair seo.',                                                        en: 'this time.',                                                            speaker: 'manannan' },
]

export default class D3OpenSea extends RiverScene {

  constructor() { super({ key: 'd3_open_sea' }) }

  usesSwallows()           { return false }
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
    this.load.image('boat',     '/assets/boat.png')
    this.load.image('manannan', '/assets/manannan.png')
  }

  async create(data) {
    // Remove any lingering canvases from the previous scene (BogD3Sea)
    // before PGR initialises — Phaser can overlap scene lifecycles during
    // transitions so shutdown() of the outgoing scene may not have run yet.
    document.getElementById('estuary-waves')?.remove()
    document.getElementById('swallow-canvas')?.remove()

    await super.create(data)

    // Clear any solid CSS background left on the canvas by the previous scene.
    // Only the style property — do NOT touch Phaser's render clear colour
    // or PGR will have nothing to draw onto.
    if (this.game?.canvas) {
      this.game.canvas.style.background = 'transparent'
    }

    if (this.boatSystem) {
      this.boatSystem._triggerDisembark = () => {}
      this.boatSystem._reboard          = () => {}
    }
    this._doDisembark   = () => {}
    this._noDisembarkUI = true

    document.getElementById('swallow-canvas')?.remove()
    window._noSwallowSounds = true
    this._waveRenderer = new WaveRenderer(this, this.perspectiveGround)

    this._manannanWarned       = false
    this._manannanScrollActive = false
    this._gameOverPending      = false
    this._driftUnlocked        = false
    this._stormCamT            = 0
    this._struggleTimer        = 0
    this._capsized             = false
    this._capsizeTimer         = 0

    this._manannanBadgeEl             = null
    this._manannanScroll              = null
    this._preManannanZoom             = null
    this._preManannanScrollY          = null
    this._manannanReleasedAndRetreated = GameState.hasNote('met_manannan')

    // Storm audio — deferred until first user gesture to avoid
    // AudioContext suspension on normal (non-direct) page loads.
    // The context is created and started on the first joystick input.
    this._stormAudio = new StormAudio()
    this._stormAudioStarted = false

    // Storm overlay — rain, lightning, vignette, sky
    this._stormOverlay = new StormOverlay(this)

    // Distant rain — second curtain, independent canvas
    this._distantRain = new DistantRainLayer()

    this._stormCanvas = this.game.canvas

    // Append storm overlays inside gameContainer, not document.body.
    // returnCrossing.js sets gameContainer to z-index:999999 on exit,
    // which puts it above any div appended to body at a lower z-index.
    const _overlayParent = document.getElementById('gameContainer') ?? document.body

    this._vignetteDiv = document.createElement('div')
    this._vignetteDiv.style.cssText = [
      'position:fixed', 'inset:0',
      'background:radial-gradient(120% 70% at 50% 50%, transparent 35%, rgba(4,8,20,0) 100%)',
      'pointer-events:none',
      'z-index:9900',
    ].join(';')
    _overlayParent.appendChild(this._vignetteDiv)

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
    _overlayParent.appendChild(this._fadeDiv)
  }

  onEnter() {
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

    // Start storm audio on first user interaction — guarantees AudioContext
    // is created after a gesture, avoiding Chrome's autoplay suspension.
    if (!this._stormAudioStarted && (this.joystick?.force ?? 0) > 0) {
      this._stormAudioStarted = true
      this._stormAudio.start()
    }

    if (!this.player || this._gameOverPending) return

    const _southLimit = 35 * this.tileSize
    if (this.player.logicalY > _southLimit) {
      this.player.logicalY = _southLimit
      if (this.boatSystem) { this.boatSystem._vy = 0 }
    }

    const tileX = Math.floor(this.player.logicalX / this.tileSize)
    const mapW  = this.mapData?.width ?? 72

    const raw       = (tileX - INTENSITY_START_COL) /
                      (INTENSITY_FULL_COL - INTENSITY_START_COL)
    const intensity = Math.max(0, Math.min(1, raw))
    const eastProgress = Math.max(0, Math.min(1, tileX / mapW))

    this._waveRenderer?.setIntensity(intensity)
    this._waveRenderer?.setEastProgress(eastProgress)
    this._waveRenderer?.update(delta)

    const rainProgress = Math.max(0, Math.min(1, (tileX - 20) / 35))
    this._distantRain?.setIntensity(rainProgress)
    this._distantRain?.update(delta)

    const darkProgress = Math.max(0, Math.min(1, (tileX - 30) / 30))
    const t            = darkProgress * darkProgress

    if (this._stormCanvas) {
      const sat  = Math.round(100 - t * 70)
      const bri  = Math.round(100 - t * 30)
      const hue  = Math.round(t * 195)
      this._stormCanvas.style.filter = t < 0.01
        ? ''
        : `saturate(${sat}%) brightness(${bri}%) hue-rotate(${hue}deg)`
    }

    if (this._vignetteDiv) {
      const edgeAlpha = (t * 0.82).toFixed(3)
      const clearZone = 35
      const fadeStop  = Math.round(55 + t * 15)
      this._vignetteDiv.style.background =
        `radial-gradient(120% ${fadeStop}% at 50% 50%, transparent ${clearZone}%, rgba(4,8,20,${edgeAlpha}) 100%)`
    }

    if (!this._capsized && !this._gameOverPending &&
        !this._manannanWarned && !this._manannanScrollActive) {
      this._checkHorseCollision(tileX)
    }

    if (this._manannanWarned && !this._manannanScrollActive && this._manannanBadgeEl) {
      this._checkManannanProximity()
    }

    if (this._capsized) {
      this._capsizeTimer += delta
      this._tickCapsize(delta)
      return
    }

    if (!this._driftUnlocked && tileX >= DRIFT_UNLOCK_COL) {
      this._driftUnlocked = true
      this.boatSystem._noDrift = false
    }
    if (this._manannanScrollActive) {
      this._currentDriftOverride = 0
      if (this.boatSystem) this.boatSystem._noDrift = true
    } else if (this._driftUnlocked) {
      this._currentDriftOverride = -8 - intensity * 30
    } else {
      this._currentDriftOverride = 0
      this.boatSystem._noDrift   = true
    }

    if (this.boatSystem && !this._manannanScrollActive) {
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

    this._stormAudio?.setIntensity(intensity)
    this._stormOverlay?.setIntensity(intensity)
    this._stormOverlay?.update(delta)

    const _clampCam = this.cameras?.main
    if (_clampCam && this.player) {
      const _maxSY = 36 * this.tileSize - this.scale.height / (_clampCam.zoom || 1)
      if (_clampCam.scrollY > _maxSY) _clampCam.scrollY = _maxSY
    }

    const pastTrigger = tileX >= MANANNAN_TRIGGER_COL
    const safeTileX   = MANANNAN_TRIGGER_COL - 8

    if (GameState.hasNote('met_manannan')) {
      if (!this._manannanReleasedAndRetreated && tileX <= safeTileX) {
        this._manannanReleasedAndRetreated = true
        console.log('[Manannan] player retreated to safe zone — second approach armed')
      }

      if (this._manannanReleasedAndRetreated &&
          pastTrigger &&
          !this._gameOverPending &&
          !this._devourStarted) {
        this._manannanWarned  = true
        this._gameOverPending = true
        this._triggerManannanDevour()
      }
    } else if (!this._manannanWarned && !this._manannanScrollActive) {
      const joyAngle  = this.joystick?.angle ?? 0
      const pushing   = (this.joystick?.force ?? 0) > 10 &&
                        joyAngle > -60 && joyAngle < 60
      const slowSpeed = Math.abs(this.boatSystem?._vx ?? 0) < 20

      if (pastTrigger && pushing && slowSpeed) {
        this._struggleTimer += delta
        if (this._struggleTimer > 10000) {
          this._manannanWarned = true
          this._triggerManannanWarning()
        }
      } else if (!pastTrigger || !pushing) {
        this._struggleTimer = 0
      }
    }

    if (!this._gameOverPending && tileX >= POINT_OF_NO_RETURN) {
      this._gameOverPending = true
      this._triggerManannanFinal()
    }
  }

  _checkManannanProximity() {
    if (!this.player || !this._waveRenderer) return

    const mx = this._waveRenderer._manannánWorldX ?? null

    if (mx === null) {
      const tileX = Math.floor(this.player.logicalX / this.tileSize)
      if (tileX >= MANANNAN_TRIGGER_COL + 4) {
        console.log('[Manannan] proximity fallback — auto-opening scroll')
        this._openManannanScroll()
      }
      return
    }

    const my = this._waveRenderer._manannánWorldY ?? this.player.logicalY

    const dx   = this.player.logicalX - mx
    const dy   = this.player.logicalY - my
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < MANANNAN_COLLISION_RADIUS) {
      console.log('[Manannan] proximity collision — auto-opening scroll')
      this._openManannanScroll()
    }
  }

  _initStormAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      this._stormAC     = new AC()
      this._stormMaster = this._stormAC.createGain()
      this._stormMaster.gain.value = 0
      this._stormMaster.connect(this._stormAC.destination)

      const windBuf = this._makeNoiseBuf(4.0)
      this._windNoise = this._stormAC.createBufferSource()
      this._windNoise.buffer = windBuf
      this._windNoise.loop   = true

      const windBp = this._stormAC.createBiquadFilter()
      windBp.type            = 'bandpass'
      windBp.frequency.value = 600
      windBp.Q.value         = 0.4

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

    if (this._stormAC.state === 'suspended') {
      this._stormAC.resume()
    }

    const now    = this._stormAC.currentTime
    const smooth = 0.95

    const targetMaster = 0.3 + intensity * 0.55
    const curMaster    = this._stormMaster.gain.value
    this._stormMaster.gain.setValueAtTime(
      curMaster + (targetMaster - curMaster) * (1 - smooth), now)

    if (this._windGain) {
      const targetWind = intensity * intensity * 0.7
      const curWind    = this._windGain.gain.value
      this._windGain.gain.setValueAtTime(
        curWind + (targetWind - curWind) * 0.04, now)
    }

    if (this._sprayGain) {
      const targetSpray = Math.max(0, intensity - 0.3) * 0.5
      const curSpray    = this._sprayGain.gain.value
      this._sprayGain.gain.setValueAtTime(
        curSpray + (targetSpray - curSpray) * 0.03, now)
    }

    const crashInterval = Math.max(1800, 5000 - intensity * 3500)
    const elapsed       = this._t * 1000
    if (elapsed - this._lastWaveCrash > crashInterval && intensity > 0.15) {
      this._lastWaveCrash = elapsed
      this._playWaveCrash(intensity)
    }

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

      if (surfaceT < 0.15) continue
      if (localI < 0.1)    continue
      if (cappedBob < 3)   continue

      const dx   = h.worldX - px
      const dy   = h.worldY - py
      const dist = Math.sqrt(dx * dx + dy * dy)
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

    if (this.boatSystem) {
      this.boatSystem._vx      = 0
      this.boatSystem._vy      = 0
      this.boatSystem._noDrift = true
    }
    if (this.joystick) this.joystick.force = 0

    this._playWhinny()

    if (this.perspectiveGround) {
      this.perspectiveGround._capsizeFlip = 0
    }

    console.log('[Capsize] triggered')
  }

  _tickCapsize(delta) {
    const pgr = this.perspectiveGround
    if (pgr) {
      pgr._capsizeFlip = Math.min(1, (pgr._capsizeFlip ?? 0) + delta / 2000)
    }

    if (this._stormOverlay) {
      this._stormOverlay._tiltAngle = Math.sin(this._capsizeTimer * 0.003) * 0.25
    }

    if (this._stormAudio?.ac && !this._audioFading) {
      this._audioFading = true
      const ac  = this._stormAudio.ac
      const now = ac.currentTime
      this._stormAudio.master?.gain.setTargetAtTime(0, now, 1.2)
    }

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

      const osc = ac.createOscillator()
      osc.type  = 'sawtooth'
      osc.frequency.setValueAtTime(400, now)
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.18)
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.35)
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.7)
      osc.frequency.exponentialRampToValueAtTime(180, now + 1.1)

      const bp  = ac.createBiquadFilter()
      bp.type   = 'bandpass'
      bp.frequency.value = 900
      bp.Q.value = 3.5

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
    const veil = document.createElement('div')
    veil.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:1000000',
      'background:#000814',
      'opacity:0',
      'pointer-events:none',
    ].join(';')
    document.body.appendChild(veil)

    const cam = this.cameras?.main
    if (cam && this.player) {
      this.tweens?.add({
        targets:    cam,
        scrollY:    this.player.logicalY + 400,
        duration:   5500,
        ease:       'Sine.easeIn',
      })
    }

    setTimeout(() => {
      veil.style.transition = 'opacity 3.5s ease-in'
      requestAnimationFrame(() => { veil.style.opacity = '1' })
    }, 2000)

    setTimeout(() => {
      this._waveRenderer?.destroy()
      this._stormAudio?.stop()
      this._stormOverlay?.destroy()
      window.location.reload()
    }, 6000)
  }

  _beginCapsizeFade() {
    const veil = document.createElement('div')
    veil.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:1000000',
      'background:#000814',
      'opacity:0',
      'pointer-events:none',
    ].join(';')
    document.body.appendChild(veil)

    requestAnimationFrame(() => {
      veil.style.transition = 'opacity 0.6s ease-in'
      requestAnimationFrame(() => { veil.style.opacity = '1' })
    })

    setTimeout(() => {
      this._waveRenderer?.destroy()
      this._stormAudio?.stop()
      this._stormOverlay?.destroy()
      window.location.reload()
    }, 1200)
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
    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = 0.6 + t * 0.3
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
    const rawScrollY = this.player.logicalY - sh / 2 / zoom + waveRise
    const _maxScrollY = 36 * this.tileSize - sh / zoom
    cam.scrollY = Math.min(rawScrollY, _maxScrollY)
  }

  // ── Manannan sequence ────────────────────────────────────────────────────

  _triggerManannanWarning() {
    if (this.boatSystem) {
      this.boatSystem._vx = 0
      this.boatSystem._vy = 0
    }
    this._waveRenderer?.spawnManannan()
    this._waveRenderer?.triggerHorseSequence()

    // Show badge as a visual flourish, but also auto-open the scroll
    // after a longer delay — guarantees the sequence fires regardless
    // of whether the badge is tappable (e.g. on slow first loads where
    // encounterPanel may not be fully ready).
    this.time.delayedCall(3000, () => {
      this._showManannanBadge()
    })
    this.time.delayedCall(5000, () => {
      if (!this._manannanScrollActive) {
        this._openManannanScroll()
      }
    })
  }

  _showManannanBadge() {
    const hubEl     = document.getElementById('dpad-moon-hub')
    const moonEl    = this._encounterPanel?._moonWidget?.element ?? hubEl
    const parent    = moonEl ?? hubEl ?? document.body

    const moonCanvas = this._encounterPanel?._moonWidget?.getCanvas?.()
      ?? parent.querySelector('canvas')
      ?? null
    const size = moonCanvas
      ? (moonCanvas.offsetWidth || moonCanvas.width || 48)
      : 48

    const badge = document.createElement('canvas')
    badge.width  = size
    badge.height = size
    badge.style.cssText = [
      'position:absolute',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%)',
      `width:${size}px`,
      `height:${size}px`,
      'border-radius:50%',
      'cursor:pointer',
      'display:block',
      'opacity:0',
      'transition:opacity 400ms ease',
      'z-index:3',
      'pointer-events:all',
    ].join(';')

    if (this.textures.exists('manannan')) {
      const src = this.textures.get('manannan').getSourceImage()
      const ctx = badge.getContext('2d')
      ctx.imageSmoothingEnabled = true
      ctx.save()
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(src, 0, 0, size, size)
      ctx.restore()
    }

    badge.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      this._openManannanScroll()
    })

    parent.appendChild(badge)
    this._manannanBadgeEl = badge

    requestAnimationFrame(() => { badge.style.opacity = '1' })
    console.log('[Manannan] badge shown')
  }

  _hideManannanBadge() {
    const badge = this._manannanBadgeEl
    if (!badge) return
    badge.style.opacity = '0'
    setTimeout(() => {
      badge.parentNode?.removeChild(badge)
      this._manannanBadgeEl = null
    }, 400)
  }

  _pullCameraBack(onComplete) {
    const cam = this.cameras?.main
    if (!cam) { onComplete?.(); return }

    this._preManannanZoom    = cam.zoom ?? 1
    this._preManannanScrollY = cam.scrollY

    const targetZoom = this._preManannanZoom * 0.75

    this.tweens?.add({
      targets:    cam,
      zoom:       targetZoom,
      duration:   1200,
      ease:       'Sine.easeInOut',
      onComplete: () => onComplete?.(),
    })
  }

  _restoreCamera() {
    const cam = this.cameras?.main
    if (!cam || this._preManannanZoom == null) return

    this.tweens?.add({
      targets:  cam,
      zoom:     this._preManannanZoom,
      duration: 1000,
      ease:     'Sine.easeInOut',
    })

    this._preManannanZoom    = null
    this._preManannanScrollY = null
  }

  _openManannanScroll() {
    if (this._manannanScrollActive) return
    this._manannanScrollActive = true

    this._hideManannanBadge()

    if (this.boatSystem) {
      this.boatSystem._vx           = 0
      this.boatSystem._vy           = 0
      this.boatSystem._noDrift      = true
      this.boatSystem._eastSpeedCap = 0
    }
    this._currentDriftOverride = 0

    this._pullCameraBack(() => this._launchScroll())
  }

  _launchScroll() {
    const hubEl       = document.getElementById('dpad-moon-hub')
    const clearancePx = hubEl
      ? (window.innerHeight - hubEl.getBoundingClientRect().top + 8)
      : 120

    const getMoonPhase = () =>
      this._encounterPanel?._moonWidget?.getPhase?.() ?? 0.5

    this._manannanScroll = new ScrollingTextPlayer({
      lines:             MANANNAN_LINES,
      getMoonPhase,
      onComplete:        () => this._onManannanScrollComplete(),
      container:         document.body,
      bottomClearancePx: clearancePx,
      scrollSpeed:       MANANNAN_SCROLL_SPEED,
    })

    this._manannanScroll.start()
    console.log('[Manannan] scroll started')
  }

  _onManannanScrollComplete() {
    console.log('[Manannan] scroll complete')

    GameState.addNote('met_manannan')

    this._manannanScroll       = null
    this._manannanScrollActive = false

    this._restoreCamera()

    if (this.boatSystem) {
      this.boatSystem._noDrift      = false
      this.boatSystem._eastSpeedCap = null
      this.boatSystem._vx           = 0
      this.boatSystem._vy           = 0
    }
    if (this._driftUnlocked) {
      const tileX     = Math.floor(this.player.logicalX / this.tileSize)
      const raw       = (tileX - INTENSITY_START_COL) /
                        (INTENSITY_FULL_COL - INTENSITY_START_COL)
      const intensity = Math.max(0, Math.min(1, raw))
      this._currentDriftOverride = -8 - intensity * 30
    }

    console.log('[Manannan] boat released — westward drift restored')
  }

  // ── Devoured (returning player) ───────────────────────────────────────────

  _triggerManannanDevour() {
    if (this._devourStarted) return
    this._devourStarted = true

    // Freeze everything
    if (this.boatSystem) {
      this.boatSystem._vx           = 0
      this.boatSystem._vy           = 0
      this.boatSystem._noDrift      = true
      this.boatSystem._eastSpeedCap = 0
    }
    if (this.joystick) this.joystick.force = 0
    this._currentDriftOverride = 0

    const p = this.player
    if (!p) { this._beginCapsizeFade(); return }

    // ── Hide player and boat immediately ─────────────────────────────────
    // The boat and player sprite are rendered by perspectiveGround onto its
    // own canvas — hiding only game.canvas leaves them visible.
    // We hide everything that could show them:
    //   1. perspectiveGround canvas (boat + player sprite)
    //   2. game.canvas (Phaser layer, player sprite if rendered there too)
    //   3. Set a flag so perspectiveGround skips drawing the boat this frame
    if (this.game?.canvas)       this.game.canvas.style.opacity = '0'
    if (this.perspectiveGround) {
      // Hide the PerspectiveGround canvas element directly
      const pgCanvas = this.perspectiveGround.canvas
                    ?? this.perspectiveGround._canvas
                    ?? this.perspectiveGround.element
      if (pgCanvas?.style) pgCanvas.style.opacity = '0'

      // Flag checked by PerspectiveGround.render() / drawBoat() if present
      this.perspectiveGround._hideBoat   = true
      this.perspectiveGround._hidePlayer = true
    }

    // ── Screen-space approach ────────────────────────────────────────────
    const pgr         = this.perspectiveGround
    const playerTileY = Math.floor(p.logicalY / this.tileSize)

    const playerScreenY = pgr?._rowToScreenY?.(playerTileY + 1) ?? (this.scale.height * 0.6)
    const scaledW       = pgr?._scaleAtRow?.(playerTileY + 1)   ?? 48
    const horizonPx     = pgr?._horizonPx?.() ?? 180

    const cam           = this.cameras?.main
    const zoom          = cam?.zoom ?? 1
    const playerScreenX = cam
      ? (p.logicalX - cam.scrollX) * zoom
      : this.scale.width / 2

    // Overlay canvas for the charge animation — sits above everything
    const oc = document.createElement('canvas')
    oc.width  = this.scale.width
    oc.height = this.scale.height
    oc.style.cssText = [
      'position:fixed', 'inset:0',
      'width:100%', 'height:100%',
      'pointer-events:none',
      'z-index:9950',
    ].join(';')
    document.body.appendChild(oc)
    this._devourCanvas = oc
    const ctx = oc.getContext('2d')

    const spriteW       = scaledW * 3.5
    const startScreenX  = this.scale.width + spriteW * 0.5
    const targetScreenX = playerScreenX
    const drawY         = playerScreenY - scaledW * 2.5

    const wr  = this._waveRenderer
    const img = wr?._manannánDevourImg ?? wr?._manannánImg ?? null

    const CHARGE_MS   = 1800
    const chargeStart = performance.now()

    const charge = () => {
      if (!this._devourStarted) return
      const elapsed = performance.now() - chargeStart
      const rawT    = Math.min(elapsed / CHARGE_MS, 1)
      const t       = rawT * rawT * rawT

      const cx = startScreenX + (targetScreenX - startScreenX) * t

      ctx.clearRect(0, 0, oc.width, oc.height)

      if (img?.complete && img.naturalWidth > 0) {
        const aspect = img.naturalHeight / img.naturalWidth
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, horizonPx, oc.width, oc.height - horizonPx)
        ctx.clip()
        ctx.globalAlpha = 1
        ctx.drawImage(img, cx - spriteW * 0.5, drawY, spriteW, spriteW * aspect)
        ctx.restore()
      } else {
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, horizonPx, oc.width, oc.height - horizonPx)
        ctx.clip()
        ctx.beginPath()
        ctx.arc(cx, playerScreenY - scaledW, spriteW * 0.4, 0, Math.PI * 2)
        const grd = ctx.createRadialGradient(cx, playerScreenY - scaledW, 0, cx, playerScreenY - scaledW, spriteW * 0.4)
        grd.addColorStop(0, 'rgba(255,220,60,0.95)')
        grd.addColorStop(1, 'rgba(180,100,0,0)')
        ctx.fillStyle = grd
        ctx.fill()
        ctx.restore()
      }

      if (rawT < 1) {
        requestAnimationFrame(charge)
      } else {
        this._playUlp()
        this._flashWhite()

        // Stop BoatSystem from pushing player.logicalX/Y back each frame —
        // it runs in RiverScene.update() before PGR and would immediately
        // overwrite any position we set here.
        if (this.boatSystem) {
          this.boatSystem._vx           = 0
          this.boatSystem._vy           = 0
          this.boatSystem._noDrift      = true
          this.boatSystem._eastSpeedCap = 0
          // No-op remaining updates so velocity can't restore the position
          this.boatSystem.update = () => {}
        }

        // Move player far off any renderable row so PGR draws neither
        // the player sprite nor the boat (both keyed off logicalX/Y).
        if (p) {
          p.logicalX = -999999
          p.logicalY = -999999
          p.targetX  = -999999
          p.targetY  = -999999
        }

        // Clear the boat canvas PGR holds so it can't draw it independently.
        if (this.perspectiveGround) {
          this.perspectiveGround._boatActive = false
          this.perspectiveGround._boatCanvas = null
        }

        if (wr) {
          wr._manannánWorldX   = null
          wr._manannánSurfaceT = 0
        }
        setTimeout(() => this._manannanSwimOff(ctx, oc, startScreenX, targetScreenX, playerScreenY, scaledW, horizonPx, img, spriteW), 120)
      }
    }
    requestAnimationFrame(charge)
  }

  _manannanSwimOff(ctx, oc, startScreenX, playerScreenX, playerScreenY, scaledW, horizonPx, img, spriteW) {
    if (!this._devourStarted) return

    const SWIM_MS     = 1400
    const swimStart   = performance.now()
    const exitScreenX = playerScreenX - (startScreenX - playerScreenX)

    const swim = () => {
      if (!this._devourStarted) return
      const elapsed = performance.now() - swimStart
      const rawT    = Math.min(elapsed / SWIM_MS, 1)
      const t       = 1 - Math.pow(1 - rawT, 2)

      const cx    = playerScreenX + (exitScreenX - playerScreenX) * t
      const sinkY = playerScreenY - scaledW * 2.5 * (1 - t)
      const alpha = 1 - t

      ctx.clearRect(0, 0, oc.width, oc.height)

      if (img?.complete && img.naturalWidth > 0 && alpha > 0.02) {
        const aspect = img.naturalHeight / img.naturalWidth
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, horizonPx, oc.width, oc.height - horizonPx)
        ctx.clip()
        ctx.globalAlpha = alpha
        ctx.drawImage(img, cx - spriteW * 0.5, sinkY, spriteW, spriteW * aspect)
        ctx.restore()
      }

      if (rawT < 1) {
        requestAnimationFrame(swim)
      } else {
        // Game canvas and perspectiveGround stay hidden — _beginCapsizeFade
        // cuts to black and reloads immediately after.
        if (oc.parentNode) oc.parentNode.removeChild(oc)
        this._devourCanvas = null
        this._beginCapsizeFade()
      }
    }
    requestAnimationFrame(swim)
  }

  _flashWhite() {
    const flash = document.createElement('div')
    flash.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:999999',
      'background:white', 'opacity:0.9', 'pointer-events:none',
    ].join(';')
    document.body.appendChild(flash)
    setTimeout(() => {
      flash.style.transition = 'opacity 0.35s ease-out'
      flash.style.opacity = '0'
      setTimeout(() => flash.parentNode?.removeChild(flash), 400)
    }, 60)
  }

  _playUlp() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      const ac  = new AC()
      const now = ac.currentTime

      const osc = ac.createOscillator()
      osc.type  = 'sine'
      osc.frequency.setValueAtTime(320, now)
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.22)

      const bp = ac.createBiquadFilter()
      bp.type  = 'bandpass'
      bp.frequency.value = 180
      bp.Q.value = 2.8

      const g = ac.createGain()
      g.gain.setValueAtTime(0, now)
      g.gain.linearRampToValueAtTime(0.9, now + 0.03)
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.28)

      osc.connect(bp); bp.connect(g); g.connect(ac.destination)
      osc.start(now); osc.stop(now + 0.32)

      const nBuf = ac.createBuffer(1, Math.ceil(ac.sampleRate * 0.18), ac.sampleRate)
      const nd   = nBuf.getChannelData(0)
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
      const ns  = ac.createBufferSource()
      ns.buffer = nBuf
      const nlp = ac.createBiquadFilter()
      nlp.type = 'lowpass'; nlp.frequency.value = 600
      const ng = ac.createGain()
      ng.gain.setValueAtTime(0.4, now)
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
      ns.connect(nlp); nlp.connect(ng); ng.connect(ac.destination)
      ns.start(now)

      setTimeout(() => { try { ac.close() } catch(e) {} }, 800)
    } catch(e) {
      console.warn('[Devour] ulp sound failed:', e)
    }
  }

  // ── Final (devoured) ─────────────────────────────────────────────────────

  _triggerManannanFinal() {
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
    this._hideManannanBadge()
    if (this._manannanScroll) {
      this._manannanScroll.destroy()
      this._manannanScroll = null
    }
    this._distantRain?.destroy()
    this._distantRain = null
    if (this._stormCanvas) {
      this._stormCanvas.style.filter = ''
      this._stormCanvas = null
    }
    if (this._vignetteDiv) {
      this._vignetteDiv.parentNode?.removeChild(this._vignetteDiv)
      this._vignetteDiv = null
    }
    if (this._devourCanvas) {
      this._devourCanvas.parentNode?.removeChild(this._devourCanvas)
      this._devourCanvas = null
    }
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
    if (this._capsized) return
    if (!this.mapData?.exits) return
    const tileX = Math.floor(this.player.logicalX / this.tileSize)
    const tileY = Math.floor(this.player.logicalY / this.tileSize)
    for (const [, exitData] of Object.entries(this.mapData.exits)) {
      if (exitData.tiles.some(([ex, ey]) => ex === tileX && ey === tileY)) {
        if (this._exiting) return
        this._exiting = true
        this._cleanupEffects()
        import('../../../ui/sceneTransition.js').then(m => m.transitionOut(180))
        this.time.delayedCall(200, () => {
          this.scene.start(exitData.destination, {
            entryEdge:  exitData.entryPoint,
            sourceTile: { x: tileX, y: tileY }
          })
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


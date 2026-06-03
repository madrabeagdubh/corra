// d3OpenSea.js
// Location: js/game/scenes/locations/bog/d3OpenSea.js

import RiverScene   from '../riverScene.js'
import WaveRenderer from '../../../effects/waveRenderer.js'

const INTENSITY_START_COL  = 8
const DRIFT_UNLOCK_COL     = 10
const MANANNAN_TRIGGER_COL = 45
const POINT_OF_NO_RETURN   = 65
const SPEED_CAP_START_COL  = 8
const INTENSITY_FULL_COL   = 63   // cap hits zero at tile 63
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

  getMapKey()              { return 'd3_open_sea' }
  getAmbient()             { return 0x111a2a }
  getPlayerLight()         { return { color: 0x9ab8d8, intensity: 1.2, radius: 260 } }
  getWisps()               { return [] }
  getMusicTrack()          { return null }
  getExtraUnwalkableGIDs() { return new Set() }
  getSkyImage()            { return '/assets/skies/open_sea_sky.png' }
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

    this._waveRenderer = new WaveRenderer(this, this.perspectiveGround)

    this._manannánWarned  = false
    this._gameOverPending = false
    this._driftUnlocked   = false
    this._stormCamT       = 0

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


if (!this._logThrottle2) this._logThrottle2 = 0
this._logThrottle2++
if (this._logThrottle2 % 120 === 0) {
  console.log('[OpenSea] eastSpeedCap:', this.boatSystem?._eastSpeedCap?.toFixed(1),
    'tileX:', tileX, 'intensity:', intensity.toFixed(2), 'tileSize:', this.tileSize)
}

    const eastProgress = Math.max(0, Math.min(1, tileX / mapW))

    this._waveRenderer?.setIntensity(intensity)
    this._waveRenderer?.setEastProgress(eastProgress)
    this._waveRenderer?.update(delta)

    // Drift: locked until DRIFT_UNLOCK_COL
    if (!this._driftUnlocked && tileX >= DRIFT_UNLOCK_COL) {
      this._driftUnlocked = true
      this.boatSystem._noDrift = false
      console.log('[OpenSea] drift unlocked at tileX:', tileX)
    }
    if (this._driftUnlocked) {
      this._currentDriftOverride = -8 - intensity * 30
    } else {
      this._currentDriftOverride = 0
      this.boatSystem._noDrift   = true
    }

    // Speed cap — gradual from col 10 to near standstill at full intensity
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

    // Storm camera
    this._applyStormCamera(delta, intensity)

    // Manannan warning — spawn him drifting in
    if (!this._manannánWarned && tileX >= MANANNAN_TRIGGER_COL) {
      this._manannánWarned = true
      this._triggerManannánWarning()
    }

    // Point of no return
    if (!this._gameOverPending && tileX >= POINT_OF_NO_RETURN) {
      this._gameOverPending = true
      this._triggerManannánFinal()
    }
 




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

    // Rise and fall with wave phase passing under player
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
    // Spawn Manannan drifting in from east of player
    this._waveRenderer?.spawnManannan()
    this._waveRenderer?.triggerHorseSequence()

    this.time.delayedCall(2000, () => {
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
        this.scene.start('d3_sea')
      })
    })
  }

  shutdown() {
    this.cameras?.main?.setRotation(0)
    this._waveRenderer?.destroy()
    this._waveRenderer = null
    this._fadeDiv?.parentNode?.removeChild(this._fadeDiv)
    this._fadeDiv = null
    super.shutdown?.()
  }
}


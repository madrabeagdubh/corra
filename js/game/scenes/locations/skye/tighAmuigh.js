// tighAmuigh.js
// Location: js/game/scenes/locations/skye/tighAmuigh.js
//
// Outside Tigh Chonaill. A little thatched cottage at the top of the screen, the champion standing before it;
// tumbledown drystone walls frame the garden, long neglected and thriving for it: wildflowers, swaying in
// the breeze (effects/vegetation.js, the game's own wind). A trodden path leads south, out through a gap in
// the wall, to the training ground (skye_gairdin) where Conall waits.
//
// An official map: public/maps/skyeMaps/skye_tigh_amuigh.json (cottage: a billboard; walls: cuboids; the
// textures are painted in tighRoom.js -> public/assets/tigh/out*.png). The cottage door is the map's own
// door (back into the cabin); the south edge is the map's own exit.
//
// No route drawing yet (skyeTapOnly.js): a tap walks, and the garden's dummy teaches the rest.

import SkyeScene from './skyeScene.js'
import PerspectiveGroundRenderer from '../../../effects/perspectiveGroundRenderer.js'
import SkyeCaption from './skyeCaption.js'
import { checkLook } from './skyeLook.js'
import { setupTapOnly } from './skyeTapOnly.js'
import { TighConaill } from './tighConaill.js'
import { chimneySmoke } from './skyeFx.js'

const ACROSS = 4.8, HORIZON = 0.22, CAMROWS = 7, HERO_SCALE = 1.1

export class TighAmuigh extends SkyeScene {
  constructor() { super({ key: 'skye_tigh_amuigh' }) }
  getMapKey() { return 'skye_tigh_amuigh' }
  getAmbient() { return 0x8f8a7c }                       // a bright morning

  async create(data) {
    await super.create(data)
    if (!this.player) return
    this._spent = {}
    const q = new URLSearchParams(location.search), R = PerspectiveGroundRenderer
    R._psDefault ??= R.PLAYER_SCALE
    R._taDefault ??= R.TILES_ACROSS; R._hzDefault ??= R.HORIZON_Y_FRAC; R._camDefault ??= R.CAMERA_ROW_OFFSET
    R.CAMERA_ROW_OFFSET = Number(q.get('cam')) || CAMROWS
    R.HORIZON_Y_FRAC = Number(q.get('hz')) || HORIZON
    R.PLAYER_SCALE = Number(q.get('ps')) || HERO_SCALE          // a little larger than the usual: the champion beside a door
    R.TILES_ACROSS = Number(q.get('across')) || ACROSS           // a little out from the usual: the whole cottage, and room above the champion's head
    if (this.perspectiveGround) { this.perspectiveGround._cameraRowOffset = R.CAMERA_ROW_OFFSET; this.perspectiveGround._horizonYFrac = R.HORIZON_Y_FRAC; this.perspectiveGround._lastCamX = null }
    this._caption = new SkyeCaption({ scene: this, color: '#e6dcc0' })
    this.events.once('shutdown', () => { R.PLAYER_SCALE = R._psDefault; R.TILES_ACROSS = R._taDefault; R.HORIZON_Y_FRAC = R._hzDefault; R.CAMERA_ROW_OFFSET = R._camDefault; this._caption?.destroy(); this._caption = null; this._tapOff?.() })
    this.cameras.main.fadeIn(350, 0, 0, 0)
  }

  _setupTapToPath() { this._tapOff = setupTapOnly(this) }

  // the garden's life: smoke from the chimney (butterflies and bees are in skyeFx.js, put by for a style that fits)
  hasContinuousAnimation() { return true }
  onPGRDrawComplete(ctx) {
    const pgr = this.perspectiveGround
    if (!pgr || this._dead) return
    chimneySmoke(ctx, pgr)
  }

  // the door: the Oryx door of the cabin, opened with the cabin's own creak and thump on the way in
  _bld(id) { return this.perspectiveGround?._buildings?.find(b => b.id === id) }
  _triggerDoor(door) {
    if (this._exiting) return
    const a = this._bld('door'), b = this._bld('doorOpen')
    if (a && b) { a.hidden = true; b.hidden = false; this.perspectiveGround._lastCamX = null }
    this._doorSound(true)
    super._triggerDoor(door)
  }

  // the door first (back into the cabin), then whatever can be looked at
  checkProximityInteractions() {
    if (this._dead || !this.player) return
    if (this._checkDoorProximity()) return
    checkLook(this)
  }

  // the garden: wildflowers everywhere the ground is not trodden, thick inside the walls, a few beyond them
  getVegetation() {
    const pd = () => this.mapData?.pathDist
    return {
      species: ['mearacan', 'noinin', 'minscoth', 'crobhein', 'odhrach', 'lusmor', 'buachalan'],
      density: 1.9, perTile: 3, scaleJitter: 0.4, onGround: true, clumpBias: 0.3,
      allowAt: (key, col, row) => {
        if (row < 10) return false
        if ((pd()?.[row]?.[col] ?? 1) < 0.55) return false          // not on the path
        const inside = col >= 13 && col <= 22 && row <= 25
        return inside ? true : Math.abs(Math.sin(col * 12.9898 + row * 78.233) * 43758.5453) % 1 < 0.35
      },
      isWater: () => false,
    }
  }
}

// the cabin's synthesised door sounds
for (const k of ['_audio', '_tone', '_noise', '_doorSound']) TighAmuigh.prototype[k] = TighConaill.prototype[k]

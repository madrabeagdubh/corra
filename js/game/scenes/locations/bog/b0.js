import BogLocationScene from '../bogScene.js'
import SteepFaceRenderer from '../../../effects/steepFaceRenderer.js'

// b0 -- the village: a working ráth on its hill.
// Terrain comes entirely from the heightMap written by gen_village_map.mjs
// (dome, bank, ditch, southern causeway); the old GID-driven elevationConfig
// is retired. SteepFaceRenderer stone-faces the bank's scarps and the gate
// cheeks; the palisade is the map's wallMask ring rendered as bare timber
// poles via the ForestEffects options below (no canopy, no branches).
// House sites and features live in mapData.houses / mapData.features,
// awaiting the RoundhouseRenderer phase. NPCs load from /data/bog/b0.js.
export default class BogB0 extends BogLocationScene {
  constructor() { super({ key: 'b0' }) }

  // Defensive: the tavern's interior overlay (#pgr-ceiling gradient +
  // #pgr-blackmask) is raw DOM that the tavern is meant to tear down on exit.
  // If that teardown is missed on the door-exit path it would leave the village
  // dark, so strip any leftovers here -- the exterior never creates them itself.
  create() {
    super.create()
    document.getElementById('pgr-ceiling')?.remove()
    document.getElementById('pgr-blackmask')?.remove()
    const c = this.game?.canvas?.parentNode
    if (c) c.style.background = ''
  }

  getMapKey()      { return 'b0' }
  getAmbient()     { return 0x223322 }
  getPlayerLight() { return { color: 0xfff5dd, intensity: 2.0, radius: 320 } }
  getWisps()       { return [] }
  getMusicTrack()  { return null }
  getSkyImage()    { return '/assets/skies/bog_threshold_sky.png' }
  getSkyPosition() { return '42% 50%' }
  getMountainPosition() { return '42% 90%' }

  // Palisade: the wallMask ring renders as bare timber poles -- thin, short,
  // effectively no canopy, no branches. Tune widthScale/heightScale for
  // post heft; keep the canopy scales near zero or the fence sprouts leaves.
  getForestEffectsOptions() {
    return {
      trunkKeepChance: 1.0,
      widthScale:  0.18,
      heightScale: 0.30,
      canopyHaze:  false,
      canopyFacetScale:  0.1,
      canopyLayerScale:  0.1,
      canopyRadiusScale: 0.06,
      branchScale: 0.0,
    }
  }

  // Stone-faced bank scarps + gate cheeks (same wiring as d3Sea).
  onEnter() {
    super.onEnter?.()
    this.steepFaces = new SteepFaceRenderer(this)
  }

  onPGRDrawComplete() {
    super.onPGRDrawComplete?.()
    if (this.steepFaces) this.steepFaces.update()
  }

  shutdown() {
    if (this.steepFaces) { this.steepFaces.destroy(); this.steepFaces = null }
    super.shutdown()
  }
}


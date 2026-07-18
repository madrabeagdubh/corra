import BogLocationScene from '../bogScene.js'

export default class BogA4 extends BogLocationScene {
  constructor() { super({ key: 'a4' }) }
  getMapKey()      { return 'a4' }
  getAmbient()     { return 0x100a18 }
  getPlayerLight() { return { color: 0xcc99ff, intensity: 1.5, radius: 250 } }
  getWisps()       { return [] }
  getMusicTrack()  { return null }
  getSkyImage()    { return '/assets/skies/bog_threshold_sky.png' }
  getSkyPosition() { return '25% 50%' }
  getMountainPosition() { return '25% 45%' }

  // -- Forest-threshold canopy masses ----------------------------------------
  // a4-d4 is the APPROACH to the deep forest: ordinary sparse trees under
  // normal sky (the default overworld ForestEffects options, same as c2/d2),
  // plus tunables for the southern band's canopy masses (wallMask value 2,
  // placed by threshold_band_gen.mjs) -- trunk-less mounds of foliage that
  // rise from the bottom of the screen as the camera nears the forest,
  // reading as the treetops of the deep forest seen from outside.
  //   canopyMassRadiusTiles   -- mound size in tile units
  //   canopyMassMaxScreenFrac -- cap on any one mound's radius as a fraction
  //                              of screen height (keeps near-camera mounds
  //                              stacking instead of whiting out the view)
  getForestEffectsOptions() {
    return {
      ...super.getForestEffectsOptions(),
      canopyMassRadiusTiles:   2.2,
      canopyMassMaxScreenFrac: 0.4,
    }
  }
}


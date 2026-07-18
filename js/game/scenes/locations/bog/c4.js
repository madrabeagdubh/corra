import BogLocationScene from '../bogScene.js'

export default class BogC4 extends BogLocationScene {
  constructor() { super({ key: 'c4' }) }
  getMapKey()      { return 'c4' }
  getAmbient()     { return 0x100a18 }
  getPlayerLight() { return { color: 0xcc99ff, intensity: 1.5, radius: 250 } }
  getWisps()       { return [] }
  getMusicTrack()  { return null }
  getSkyImage()    { return '/assets/skies/bog_threshold_sky.png' }
  getSkyPosition() { return '58% 50%' }
  getMountainPosition() { return '58% 45%' }

  // ── Boat entry ────────────────────────────────────────────────────────────
  // c4 is the easternmost river map -- player arrives by boat from the east.
  // entryEdge 'east' means they came from the sea/estuary side, so activate boat.
  // Also activate if no entryEdge at all (fresh game start on this map).

  onEnter() {
    const edge = this.entryData?.entryEdge
    const shouldBeInBoat = !edge || edge === 'east'
    if (shouldBeInBoat) {
      this._activateBoatOnReady()
    }
  }

  _activateBoatOnReady() {
    // PGR and player are ready by the time onEnter() fires, but give one frame
    // for the walk grid to settle after applyEntryPosition.
    this.time.delayedCall(50, () => {
      if (!this.boatSystem) return
      this.boatSystem.activate()
      // Load boat image into PGR now that we know we need it
      if (this.perspectiveGround && this.textures.exists('boat')) {
        this.perspectiveGround.loadBoatImage(
          this.textures.get('boat').getSourceImage()
        )
      }
    })
  }

  preload() {
    super.preload()
    this.load.image('boat', '/assets/boat.png')
  }

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


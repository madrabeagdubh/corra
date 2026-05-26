import BogLocationScene from './bogLocationScene.js'

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
}


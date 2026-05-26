import BogLocationScene from './bogLocationScene.js'

export default class BogD3 extends BogLocationScene {
  constructor() { super({ key: 'd3' }) }
  getMapKey()      { return 'd3' }
  getAmbient()     { return 0x1a2a2a }
  getPlayerLight() { return { color: 0xcceeee, intensity: 1.7, radius: 300 } }
  getWisps()       { return [] }
  getMusicTrack()  { return null }
  getSkyImage()    { return '/assets/skies/bog_threshold_sky.png' }
  getSkyPosition() { return '75% 50%' }
  getMountainPosition() { return '75% 60%' }

  preload() {
    super.preload()
    this.load.image('boat', '/assets/boat.png')
  }

  onEnter() {
    const edge = this.entryData?.entryEdge
    // Arrive by boat from the east (sea/estuary), or fresh start on this map
    const shouldBeInBoat = !edge || edge === 'east'
    if (shouldBeInBoat) {
      this.time.delayedCall(50, () => {
        if (!this.boatSystem) return
        if (this.perspectiveGround && this.textures.exists('boat')) {
          this.perspectiveGround.loadBoatImage(
            this.textures.get('boat').getSourceImage()
          )
        }
        this.boatSystem.activate()
      })
    }
  }
}


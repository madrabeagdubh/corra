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
    const edge    = this.entryData?.entryEdge
    const mapKey  = this.getMapKey()
    const saved   = GameState.getBoatPosition(mapKey)
    const fromEast = !edge || edge === 'east'

    this.time.delayedCall(50, () => {
      if (!this.boatSystem || !this.perspectiveGround) return
      if (this.textures.exists('boat')) {
        this.perspectiveGround.loadBoatImage(
          this.textures.get('boat').getSourceImage()
        )
      }

      if (saved) {
        // Restore moored boat at saved position
        const ts = this.tileSize
        const pgr = this.perspectiveGround
        pgr._boatWorldX  = saved.tileX * ts + ts / 2
        pgr._boatWorldY  = saved.tileY * ts + ts / 2
        pgr._boatDrifting = false
        // If player is on the same tile, board it
        const pTX = Math.floor(this.player.logicalX / ts)
        const pTY = Math.floor(this.player.logicalY / ts)
        if (pTX === saved.tileX && pTY === saved.tileY) {
          this.boatSystem.activate()
        }
        console.log(`[d3] boat restored at [${saved.tileX},${saved.tileY}]`)
      } else if (fromEast) {
        // Fresh arrival -- player starts in boat
        this.boatSystem.activate()
      }
    })
  }
}


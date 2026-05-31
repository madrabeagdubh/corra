import { GameState } from '../../../systems/gameState.js'
import RiverScene from '../riverScene.js'

export default class BogD3 extends RiverScene {
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
    const fromEast = !edge || edge === 'east'
    // Restore moored boat from GameState, or activate if arriving from east
    this._restoreBoatOnEnter({ activateIfNoSave: fromEast })
  }
}


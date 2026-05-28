import { GameState } from '../../../systems/gameState.js'
import BogLocationScene from './bogLocationScene.js'

export default class BogC3 extends BogLocationScene {
  constructor() { super({ key: 'c3' }) }
  getMapKey()      { return 'c3' }
  getAmbient()     { return 0x1a2a2a }
  getPlayerLight() { return { color: 0xcceeee, intensity: 1.7, radius: 300 } }
  getWisps()       { return [] }
  getMusicTrack()  { return null }
  getSkyImage()    { return '/assets/skies/bog_threshold_sky.png' }
  getSkyPosition() { return '58% 50%' }
  getMountainPosition() { return '58% 60%' }


  preload() {
    super.preload()
    this.load.image('boat', '/assets/boat.png')
  }

  onEnter() {
    const edge = this.entryData?.entryEdge
    const fromEast = !edge || edge === 'east'
    this._restoreBoatOnEnter({ activateIfNoSave: fromEast })
  }
}
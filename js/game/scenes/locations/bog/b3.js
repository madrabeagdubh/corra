import BogLocationScene from './bogLocationScene.js'

export default class BogB3 extends BogLocationScene {
  constructor() { super({ key: 'b3' }) }
  getMapKey()      { return 'b3' }
  getAmbient()     { return 0x1a2a2a }
  getPlayerLight() { return { color: 0xcceeee, intensity: 1.7, radius: 300 } }
  getWisps()       { return [] }
  getMusicTrack()  { return null }
  getSkyImage()    { return '/assets/skies/bog_threshold_sky.png' }
  getSkyPosition() { return '42% 50%' }
  getMountainPosition() { return '42% 60%' }
}

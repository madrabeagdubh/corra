import BogLocationScene from './bogLocationScene.js'

export default class BogA2 extends BogLocationScene {
  constructor() { super({ key: 'a2' }) }
  getMapKey()      { return 'a2' }
  getAmbient()     { return 0x2a2a15 }
  getPlayerLight() { return { color: 0xfff0cc, intensity: 1.9, radius: 280 } }
  getWisps()       { return [] }
  getMusicTrack()  { return null }
  getSkyImage()    { return '/assets/skies/bog_threshold_sky.png' }
  getSkyPosition() { return '25% 50%' }
  getMountainPosition() { return '25% 75%' }
}

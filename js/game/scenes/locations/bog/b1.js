import BogLocationScene from './bogLocationScene.js'

export default class BogB1 extends BogLocationScene {
  constructor() { super({ key: 'b1' }) }
  getMapKey()      { return 'b1' }
  getAmbient()     { return 0x223322 }
  getPlayerLight() { return { color: 0xfff5dd, intensity: 2.0, radius: 320 } }
  getWisps()       { return [] }
  getMusicTrack()  { return null }
  getSkyImage()    { return '/assets/skies/bog_threshold_sky.png' }
  getSkyPosition() { return '42% 50%' }
}

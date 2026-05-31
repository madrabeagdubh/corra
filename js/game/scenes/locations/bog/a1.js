import BogLocationScene from '../bogScene.js'

export default class BogA1 extends BogLocationScene {
  constructor() { super({ key: 'a1' }) }
  getMapKey()      { return 'a1' }
  getAmbient()     { return 0x223322 }
  getPlayerLight() { return { color: 0xfff5dd, intensity: 2.0, radius: 320 } }
  getWisps()       { return [] }
  getMusicTrack()  { return null }
  getSkyImage()    { return '/assets/skies/bog_threshold_sky.png' }
  getSkyPosition() { return '25% 50%' }
  getMountainPosition() { return '25% 90%' }
}

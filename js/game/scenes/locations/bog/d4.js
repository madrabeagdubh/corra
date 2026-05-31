import BogLocationScene from '../bogScene.js'

export default class BogD4 extends BogLocationScene {
  constructor() { super({ key: 'd4' }) }
  getMapKey()      { return 'd4' }
  getAmbient()     { return 0x100a18 }
  getPlayerLight() { return { color: 0xcc99ff, intensity: 1.5, radius: 250 } }
  getWisps()       { return [] }
  getMusicTrack()  { return null }
  getSkyImage()    { return '/assets/skies/bog_threshold_sky.png' }
  getSkyPosition() { return '75% 50%' }
  getMountainPosition() { return '75% 45%' }
}

import BogLocationScene from './bogLocationScene.js'

export default class BogA4 extends BogLocationScene {
  constructor() { super({ key: 'a4' }) }
  getMapKey()      { return 'a4' }
  getAmbient()     { return 0x100a18 }
  getPlayerLight() { return { color: 0xcc99ff, intensity: 1.5, radius: 250 } }
  getWisps()       { return [] }
  getMusicTrack()  { return null }
  getSkyImage()    { return '/assets/skies/bog_threshold_sky.png' }
  getSkyPosition() { return '25% 50%' }
  getMountainPosition() { return '25% 45%' }
}

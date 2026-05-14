import BogLocationScene from './bogLocationScene.js'

export default class BogC2 extends BogLocationScene {
  constructor() { super({ key: 'c2' }) }
  getMapKey()      { return 'c2' }
  getAmbient()     { return 0x2a2a15 }
  getPlayerLight() { return { color: 0xfff0cc, intensity: 1.9, radius: 280 } }
  getWisps()       { return [] }
  getMusicTrack()  { return null }
  getSkyImage()    { return '/assets/skies/bog_threshold_sky.png' }
}

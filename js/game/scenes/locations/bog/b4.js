import BogLocationScene from './bogLocationScene.js'

export default class BogB4 extends BogLocationScene {
  constructor() { super({ key: 'b4' }) }
  getMapKey()      { return 'b4' }
  getAmbient()     { return 0x100a18 }
  getPlayerLight() { return { color: 0xcc99ff, intensity: 1.5, radius: 250 } }
  getWisps()       { return [] }
  getMusicTrack()  { return null }
  getSkyImage()    { return '/assets/skies/druid_sky.png' }
}

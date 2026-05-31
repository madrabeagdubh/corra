import BogLocationScene from '../bogScene.js'

export default class CursedWood extends BogLocationScene {
  constructor() { super({ key: 'Cursed_Wood' }) }
  getMapKey()     { return 'cursed_wood' }
  getAmbient()    { return 0x111111 }
  getPlayerLight(){ return { color: 0xffaa44, intensity: 2.2, radius: 220 } }
  getWisps()      { return [
    { rx: 0.9, ry: 0.35, color: 0x220000, intensity: 0.6, radius: 180 },
  ]}
  getMusicTrack()  { return 'morrison' }
  getExtraUnwalkableGIDs() { return new Set([206, 208, 209, 211]) }
}


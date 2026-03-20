import BogLocationScene from './bogLocationScene.js'

export default class GreatOpenBog extends BogLocationScene {
  constructor() { super({ key: 'Great_Open_Bog' }) }
  getMapKey()     { return 'great_open_bog' }
  getAmbient()    { return 0x334422 }
  getPlayerLight(){ return { color: 0xddddcc, intensity: 1.6, radius: 260 } }
  getWisps()      { return [
    { rx: 0.2, ry: 0.4, color: 0x99ff99, intensity: 0.4, radius: 150 },
    { rx: 0.7, ry: 0.6, color: 0x99ff99, intensity: 0.3, radius: 120 },
    { rx: 0.5, ry: 0.8, color: 0x88eeaa, intensity: 0.35, radius: 140 },
  ]}
  getMusicTrack() { return 'banish_misfortune' }
}


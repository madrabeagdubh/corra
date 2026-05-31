import BogLocationScene from '../bogScene.js'

export default class FortressOfBlood extends BogLocationScene {
  constructor() { super({ key: 'Fortress_Of_Blood' }) }
  getMapKey()     { return 'fortress_of_blood' }
  getAmbient()    { return 0x331111 }
  getPlayerLight(){ return { color: 0xff9966, intensity: 1.5, radius: 250 } }
  getWisps()      { return [
    { rx: 0.15, ry: 0.15, color: 0xff2200, intensity: 0.4, radius: 160 },
    { rx: 0.85, ry: 0.15, color: 0xff2200, intensity: 0.4, radius: 160 },
    { rx: 0.15, ry: 0.85, color: 0xff4400, intensity: 0.3, radius: 130 },
    { rx: 0.85, ry: 0.85, color: 0xff4400, intensity: 0.3, radius: 130 },
    { rx: 0.5,  ry: 0.5,  color: 0xff6600, intensity: 0.5, radius: 200 },
  ]}
  getMusicTrack()  { return 'cooley' }
  getExtraUnwalkableGIDs() { return new Set([103]) }
}


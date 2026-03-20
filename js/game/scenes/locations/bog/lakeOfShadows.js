import BogLocationScene from './bogLocationScene.js'

export default class LakeOfShadows extends BogLocationScene {
  constructor() { super({ key: 'Lake_Of_Shadows' }) }
  getMapKey()     { return 'lake_of_shadows' }
  getAmbient()    { return 0x112233 }
  getPlayerLight(){ return { color: 0xeeeeff, intensity: 1.7, radius: 290 } }
  getWisps()      { return [
    { rx: 0.47, ry: 0.47, color: 0x0044ff, intensity: 0.7, radius: 300 },
    { rx: 0.1,  ry: 0.1,  color: 0x003366, intensity: 0.3, radius: 120 },
    { rx: 0.9,  ry: 0.1,  color: 0x003366, intensity: 0.3, radius: 120 },
    { rx: 0.1,  ry: 0.9,  color: 0x003366, intensity: 0.3, radius: 120 },
    { rx: 0.9,  ry: 0.9,  color: 0x003366, intensity: 0.3, radius: 120 },
  ]}
  getMusicTrack()  { return 'drowsy_maggie' }
}


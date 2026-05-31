import BogLocationScene from '../bogScene.js'

export default class FairyMargin extends BogLocationScene {
  constructor() { super({ key: 'Fairy_Margin' }) }
  getMapKey()     { return 'fairy_margin' }
  getAmbient()    { return 0x446633 }
  getPlayerLight(){ return { color: 0xccffcc, intensity: 1.4, radius: 320 } }
  getWisps()      { return [
    { rx: 0.5,  ry: 0.5,  color: 0x00ff88, intensity: 0.8, radius: 240 },
    { rx: 0.2,  ry: 0.2,  color: 0xaaffaa, intensity: 0.4, radius: 140 },
    { rx: 0.8,  ry: 0.2,  color: 0xaaffaa, intensity: 0.4, radius: 140 },
    { rx: 0.2,  ry: 0.8,  color: 0xaaffaa, intensity: 0.4, radius: 140 },
    { rx: 0.8,  ry: 0.8,  color: 0xaaffaa, intensity: 0.4, radius: 140 },
  ]}
  getMusicTrack()  { return 'the_butterfly' }
  getExtraUnwalkableGIDs() { return new Set([677]) }
}


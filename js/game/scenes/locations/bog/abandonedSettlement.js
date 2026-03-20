import BogLocationScene from './bogLocationScene.js'

export default class AbandonedSettlement extends BogLocationScene {
  constructor() { super({ key: 'Abandoned_Settlement' }) }
  getMapKey()     { return 'abandoned_settlement' }
  getAmbient()    { return 0x222233 }
  getPlayerLight(){ return { color: 0xffeedd, intensity: 1.8, radius: 280 } }
  getWisps()      { return [
    { rx: 0.15, ry: 0.2,  color: 0xaaaaff, intensity: 0.25, radius: 100 },
    { rx: 0.75, ry: 0.65, color: 0xaaaaff, intensity: 0.2,  radius: 100 },
  ]}
  getMusicTrack()  { return 'maid_behind_the_bar' }
  getExtraUnwalkableGIDs() { return new Set([252, 198, 200]) }
}


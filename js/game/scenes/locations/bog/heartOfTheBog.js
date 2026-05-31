import BogLocationScene from '../bogScene.js'

export default class HeartOfTheBog extends BogLocationScene {
  constructor() { super({ key: 'Heart_Of_The_Bog' }) }
  getMapKey()     { return 'heart_of_the_bog' }
  getAmbient()    { return 0x223322 }
  getPlayerLight(){ return { color: 0xffffff, intensity: 1.2, radius: 200 } }
  getWisps()      { return [
    { rx: 0.5, ry: 0.5, color: 0x00ff44, intensity: 1.2, radius: 350 },
    { rx: 0.3, ry: 0.3, color: 0x44ff44, intensity: 0.4, radius: 120 },
    { rx: 0.7, ry: 0.3, color: 0x44ff44, intensity: 0.4, radius: 120 },
    { rx: 0.3, ry: 0.7, color: 0x44ff44, intensity: 0.4, radius: 120 },
    { rx: 0.7, ry: 0.7, color: 0x44ff44, intensity: 0.4, radius: 120 },
  ]}
  getMusicTrack()  { return 'the_kesh' }
  getExtraUnwalkableGIDs() { return new Set([103, 677]) }
  onEnter() {
    if (this.player?.speed) this.player.speed *= 0.7
  }
}


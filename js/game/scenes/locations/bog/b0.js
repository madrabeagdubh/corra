import BogLocationScene from '../bogScene.js'      

export default class BogB0 extends BogLocationScene {
  constructor() { super({ key: 'b0' }) }
  getMapKey()      { return 'b0' }
  getAmbient()     { return 0x223322 }
  getPlayerLight() { return { color: 0xfff5dd, intensity: 2.0, radius: 320 } }
  getWisps()       { return [] }
  getMusicTrack()  { return null }
  getSkyImage()    { return '/assets/skies/bog_threshold_sky.png' }
  getSkyPosition() { return '42% 50%' }
  getMountainPosition() { return '42% 90%' }

  getElevationConfig() {
    const cfg = this.mapData?.elevationConfig
    if (!cfg) return null
    return {
      cliffFaceGid: cfg.cliffFaceGid ?? 740,
      elevatedGids: new Set(cfg.elevatedGids ?? [839, 840]),
      cliffSouth:   new Set(cfg.cliffSouth   ?? [731, 1625, 1679]),
      cliffHeight:  cfg.cliffHeight ?? 1.0,
    }
  }

  getExtraUnwalkableGIDs() {
    return new Set([156, 733])  // BLDG_WALL, BLDG_ROOF — swap when final GIDs chosen
  }
}

import BogLocationScene from '../bogScene.js'

export default class BogB0 extends BogLocationScene {
  constructor() { super({ key: 'b0' }) }

  // Defensive: the tavern's interior overlay (#pgr-ceiling gradient +
  // #pgr-blackmask) is raw DOM that the tavern is meant to tear down on exit.
  // If that teardown is missed on the door-exit path it would leave the village
  // dark, so strip any leftovers here -- the exterior never creates them itself.
  create() {
    super.create()
    document.getElementById('pgr-ceiling')?.remove()
    document.getElementById('pgr-blackmask')?.remove()
    const c = this.game?.canvas?.parentNode
    if (c) c.style.background = ''
  }
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
    // Register custom building tile images with PGR
    if (cfg.customTiles && this.perspectiveGround) {
      for (const [gid, url] of Object.entries(cfg.customTiles))
        this.perspectiveGround.registerCustomTile(Number(gid), url)
    }
    return {
      cliffFaceGid: cfg.cliffFaceGid,
      elevatedGids: new Set(cfg.elevatedGids),
      cliffSouth:   new Set(cfg.cliffSouth),
      cliffHeight:  cfg.cliffHeight,
      gidHeights:   cfg.gidHeights,
    }
  }

  getExtraUnwalkableGIDs() {
    return new Set([3001, 3002, 3011, 3012, 3013])
  }
}

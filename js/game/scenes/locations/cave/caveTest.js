// caveTest.js
// Location: js/game/scenes/locations/cave/caveTest.js
//
// TEST SCENE: how PGR copes with a closed place. Rock walls, standing stones and torchlight from
// CaveWalls (effects/caveWalls.js); the map from tools/map-editor/generators/cave_gen.mjs.
//
//   ?scene=caveTest                       the defaults
//   &cam=high       camera: top | high | close                   (top)
//   &torch=4        torch radius, tiles   (5.5)
//   &wallH=2        rock height, tiles    (the map's cave.wallHeight, 1.4)
//   &xray=0         rock never drawn over you, no ghost, for comparison
//   &margins=0      no yellow edge on walkable floor hidden under rock
//   &knee=20        how deep you sink wading, px at 48 a tile (0 = not at all)  (20)
//   &day=8          tiles daylight reaches in from the mouth     (8)
//   &exit=0         no way out at the south edge (it leads to d2)
//   &grain=3.2      tiles from you at which the grain on rock tops fades out; 0 none, 99 everywhere  (3.2)
//   &amb=0.05       light everywhere regardless, 0..1           (0)
//   &lean=0.4       walls overhang the passage, tiles            (0.15)
//   &rough=0.25     grid corners nudged by up to, tiles          (0.1)
//   &drips=1        seconds between drips, about; 0 for none    (3)
//   &at=17,9        start on this tile instead of the landing
//
// Nothing here is for keeps: it's for seeing what works.

import PerspectiveScene from '../perspectiveScene.js'
import CaveWalls from '../../../effects/caveWalls.js'
import PerspectiveGroundRenderer from '../../../effects/perspectiveGroundRenderer.js'

const Q = new URLSearchParams(window.location.search)
const KNEE = 20      // how deep you sink in the pool: px at 48 px a tile (the overworld shallows: 35)
const num = (k) => (Q.has(k) ? Number(Q.get(k)) : undefined)

// PGR's camera looks level, from FOCAL_LENGTH + CAMERA_ROW_OFFSET tiles behind you and (screen height
// below the horizon x FOCAL_LENGTH / (tile px x (FOCAL_LENGTH + PLAYER_DIST_TILES))) tiles up. The
// overworld's is ~3 up and ~17 back: barely 10 degrees down, so near rock hides the floor. Looking down
// on a cave needs the eye high and near: a horizon above the top of the screen (the shift a level
// camera can make), and a short distance.
const CAMS = {
  top:   { HORIZON_Y_FRAC: -0.5, TILES_ACROSS: 3.6, FOCAL_LENGTH: 6.5, CAMERA_ROW_OFFSET: 2.6 },   // ~45 degrees down
  high:  { HORIZON_Y_FRAC: -0.5, TILES_ACROSS: 3.4, FOCAL_LENGTH: 9.4, CAMERA_ROW_OFFSET: 3.6 },   // ~35
  close: { TILES_ACROSS: 2.4, CAMERA_ROW_OFFSET: 9.0, FOCAL_LENGTH: 8.0 },                        // the old one, ~10
}

export default class CaveTest extends PerspectiveScene {
  constructor(key = 'caveTest') {
    super({ key })
    this.tileSize = 48
    this.tileHighlight = false    // PGR's pale square under your feet: it glows in the dark
    this.playerFootShift = 0.5    // stand in the middle of your tile, not on its front edge: seen from
                                  // above, a wall that stops you is right in front of you
  }

  // PGR crops your feet when the ground in front of you is higher than yours (a hill, seen from low
  // down) and moves its camera to keep hills out of the way: neither makes sense looking down into a
  // cave, and the first hid your legs on the slope below the landing
  _updatePlayerOcclusionFade() {
    const pgr = this.perspectiveGround
    if (pgr) { pgr._playerOcclusionAlpha = 1; pgr._playerOcclusionCropPx = 0 }
  }
  _updateCameraTerrainAvoidance() {}

  getMapKey() { return 'caveTest' }
  getMapPath() { return `/maps/cave/${this.getMapKey()}.json?v=${Date.now()}` }

  // CLIP_TOP_FRAC 0: PGR clips everything at the horizon unless told not to, and the rock has to rise
  // above it. Put back on the way out (_cleanup), as tighConaill does
  getPGRConfig() {
    return { ...super.getPGRConfig(), ...(CAMS[Q.get('cam')] || CAMS.top), CLIP_TOP_FRAC: 0 }
  }

  // light is CaveWalls' job; Phaser's lights barely touch PGR's canvases
  getAmbient() { return 0x000000 }
  getPlayerLight() { return { color: 0xffaa66, intensity: 0.6, radius: 120 } }
  getSkyImage() { return null }
  getWisps() { return [] }
  getMusicTrack() { return null }
  getCloudShadows() { return false }     // no weather underground
  getRainSound() { return false }
  getTiltShift() { return false }       // its haze greys the dark
  hasContinuousAnimation() { return true }   // the flame keeps moving when you don't

  async _loadContent() {
    this.mapData.objects = []
    this.mapData.npcs = []
    this.mapData.introNarrative = []
    if (Q.get('exit') === '0') this.mapData.exits = {}
    const at = Q.get('at')
    if (at) { const [x, y] = at.split(',').map(Number); this.mapData.spawns.player = { x, y } }
  }

  isColliding(x, y) {
    const tx = Math.floor(x / this.tileSize), ty = Math.floor(y / this.tileSize)
    const m = this.mapData?.rockMask
    if (!m || ty < 0 || ty >= m.length || tx < 0 || tx >= m[0].length) return true
    if (m[ty][tx] >= 1) return true
    return !!this.cave?.blocks(tx, ty)
  }

  // Tight places: the joystick gives eight directions, 45 degrees each, and a step into rock simply
  // doesn't happen -- so in a one-tile passage a thumb a little off the line (up and a bit right) is a
  // diagonal into a wall, and you stand there. Here a diagonal that would go into rock, or cut the
  // corner of one, slides along it: whichever of its two straight steps is open (the one the thumb is
  // nearer to, if both are).
  adjustStep(sx, sy, dx, dy, angle) {
    if (!dx || !dy) return null
    const ts = this.tileSize, tx = Math.floor(sx / ts), ty = Math.floor(sy / ts)
    const free = (x, y) => !this.isColliding((x + 0.5) * ts, (y + 0.5) * ts)
    if (free(tx + dx, ty + dy) && free(tx + dx, ty) && free(tx, ty + dy)) return null     // a clean diagonal
    const h = free(tx + dx, ty), v = free(tx, ty + dy)
    if (h && v) return Math.abs(Math.cos(angle * Math.PI / 180)) >= Math.abs(Math.sin(angle * Math.PI / 180)) ? [dx, 0] : [0, dy]
    if (h) return [dx, 0]
    if (v) return [0, dy]
    return [0, 0]
  }

  onEnter() {
    const pgr = this.perspectiveGround
    // underground: no sky, no mountains, no daylight glow; black behind everything
    pgr.setSkyImage(null)
    pgr.setMountainImage?.(null)
    if (pgr._lightDiv) pgr._lightDiv.style.display = 'none'
    const box = pgr._groundCanvas?.parentElement
    if (box) { this._oldBg = box.style.background; box.style.background = '#000' }

    this.cave = new CaveWalls(this, {
      torch: num('torch'), wallHeight: num('wallH'), xray: Q.get('xray') !== '0', margins: Q.get('margins') !== '0', grain: num('grain'), dayR: num('day'), ambient: num('amb'),
      lean: num('lean'), rough: num('rough'), drips: num('drips'),
    })
    this._wadeKnee = num('knee')
    this.events.once('shutdown', () => this._cleanup())
  }

  update(time, delta) {
    this.cave?.update(delta)
    super.update(time, delta)
    this._wade(delta)
  }

  // Wading: in the pool you stand in water to about the knee -- the sink the overworld's shallows use
  // (player.terrainSinkOffset: the sprite is drawn that much lower, cropped at the surface) -- and every
  // step stirs it: rings spread from your feet, a spray when you step in. Player.js asks footTerrain()
  // for the sound of a step.
  _wade(delta) {
    const p = this.player, c = this.cave
    if (!p || !c) return
    const ts = this.tileSize, lx = p.logicalX / ts, ly = p.logicalY / ts
    const tx = Math.floor(lx), ty = Math.floor(ly)
    const wet = c.isWater(tx, ty)
    this._wadeNow = wet
    if (this._wadeDepth === undefined) { this._wadeDepth = 0; this._wadeWas = wet; this._wadeTile = tx + ',' + ty; this._wadeT = 0 }
    const want = wet ? (Number.isFinite(this._wadeKnee) ? this._wadeKnee : KNEE) : 0
    this._wadeDepth += (want - this._wadeDepth) * Math.min(1, delta / 150)
    if (this._wadeDepth < 0.3 && !wet) this._wadeDepth = 0
    p.terrainSinkOffset = this._wadeDepth
    const key = tx + ',' + ty
    if (wet && key !== this._wadeTile) c.ripple(lx, ly, this._wadeWas ? 1 : 1.6)       // a footfall; stepping in, a splash
    else if (!wet && this._wadeWas) c.ripple(lx, ly, 1)                                 // stepping out
    if (wet && p.isMoving) { this._wadeT -= delta; if (this._wadeT <= 0) { this._wadeT = 190; c.ripple(lx, ly, 0.5) } }
    this._wadeTile = key
    this._wadeWas = wet
  }

  footTerrain() { return this._wadeNow ? 'Water' : null }

  // PGR's last word each frame: your ghost over any rock in front of you
  onPGRDrawComplete() { this.cave?.finish() }

  _cleanup() {
    PerspectiveGroundRenderer.CLIP_TOP_FRAC = null
    this.cave?.destroy(); this.cave = null
    const pgr = this.perspectiveGround
    if (pgr?._lightDiv) pgr._lightDiv.style.display = ''
    const box = pgr?._groundCanvas?.parentElement
    if (box && this._oldBg !== undefined) box.style.background = this._oldBg
  }

  shutdown() { this._cleanup(); super.shutdown() }
}

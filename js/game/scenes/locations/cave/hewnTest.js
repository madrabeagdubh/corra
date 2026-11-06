// hewnTest.js
// Location: js/game/scenes/locations/cave/hewnTest.js
//
// TEST SCENE: rock hewn into levels (effects/hewnRock.js) -- a crack to squeeze along, a cavern, a cleft with
// a bridge, a stream in a canyon, climbable blocks, a grand stair, a terrace over a court you can't reach.
// The map is tools/map-editor/generators/hewn_test_gen.mjs.
//
//   ?scene=hewnTest
//   &torch=6        torch radius, tiles
//   &at=16,30       start on this tile
//   &zoom=0         the camera stays where you put it (no closing in and drawing back by area)
//   &map=mock_well  another map from public/maps/cave (the underworld mockups: tools/map-editor/generators/
//                   underworld_mocks_gen.mjs), &z=0.6 to fix the zoom, &look=0.12 the look-ahead,
//                   &grade=teal|ember|etch|pixel a screen grade
//
// You stand at the height of the tile you're on. A step up or down of more than STEP is a wall; the
// camera's height follows yours, a little behind, so the world rises and falls round you on a stair.

import PerspectiveScene from '../perspectiveScene.js'
import HewnRock from '../../../effects/hewnRock.js'
import PerspectiveGroundRenderer from '../../../effects/perspectiveGroundRenderer.js'

const Q = new URLSearchParams(window.location.search)
const num = (k) => (Q.has(k) ? Number(Q.get(k)) : undefined)
const STEP = 0.55          // the most you can step up or down, tiles
const Z_MS = 90            // how quickly you rise or sink onto a new tile
const CAM_MS = 260         // and how quickly the camera's height follows
const SQUARE = 0.88        // a tile where you stand is this deep on the screen for its width (1: square; less, seen more from the side)
const YOU = 0.6            // you stand this far down the screen

export default class HewnTest extends PerspectiveScene {
  constructor(key = 'hewnTest') {           // (a scene built on this one passes its own key: cave/escape.js)
    super({ key })
    this.tileSize = 48
    this.tileHighlight = false
    this.playerFootShift = 0.5
  }

  getMapKey() { return Q.get('map') || 'hewnTest' }
  getMapPath() { return `/maps/cave/${this.getMapKey()}.json?v=${Date.now()}` }

  // The camera. PGR's eye looks level, with its picture shifted down to show the ground; the further the
  // horizon is above the screen, the more the ground is stretched up the screen (off-centre projection).
  // So it is worked out from what should be seen instead (viewCamera, below): tiles as deep on the screen
  // as SQUARE times their width where you stand, and you at YOU of the way down the screen. These
  // defaults are that camera for a phone at zoom 1 (in case the view is turned off: ?pinch=0).
  getPGRConfig() {
    return { ...super.getPGRConfig(), HORIZON_Y_FRAC: -0.04, TILES_ACROSS: 5.0, FOCAL_LENGTH: 6.5, CAMERA_ROW_OFFSET: 4.0, CLIP_TOP_FRAC: 0 }
  }

  // For zoom z (below 1: further out) and a look-ahead la (you that much further down the screen): where
  // the camera stands (dolly: rows in from PGR's own), where its horizon is, and the magnification.
  //   k(d)   = P (FL + PD) / (FL + d)            across a tile, d rows from the camera (P = pixels at PD)
  //   rows   = gH FL / (FL + d)^2                down a row, gH = screen height - horizon
  //   square: rows / k = SQUARE at your row; you: sh - gH d / (FL + d) = YOU sh
  // which give d = A FL / (SQUARE P (FL + PD)) and gH = A (FL + d) / d, with A = (1 - YOU) sh.
  viewCamera(g, z, la = 0) {
    const K = g.constructor, FL = K.FOCAL_LENGTH, PD = K.PLAYER_DIST_TILES
    const off = g._cameraRowOffset ?? K.CAMERA_ROW_OFFSET
    const sh = g._sh, P = g._sw * (g._zoom?.() || 1) / K.TILES_ACROSS * z
    const A = Math.max(0.12, 1 - YOU - la) * sh
    const d = A * FL / (SQUARE * P * (FL + PD))
    const gH = A * (FL + d) / d
    return { dolly: off - d, horizon: (sh - gH) / sh, hw: 1, mag: z }
  }

  getAmbient() { return 0x000000 }
  getPlayerLight() { return { color: 0xffaa66, intensity: 0.6, radius: 120 } }
  getSkyImage() { return null }
  getWisps() { return [] }
  getMusicTrack() { return null }
  getCloudShadows() { return false }
  getRainSound() { return false }
  getTiltShift() { return false }
  hasContinuousAnimation() { return true }
  // how far out the view may draw back (effects/pgrView.js): a hall needs more than the overworld
  get viewZMin() { return 0.55 }

  // PGR's hill handling (crop your feet behind higher ground, dodge the camera round hills) is for the overworld
  _updatePlayerOcclusionFade() {
    const pgr = this.perspectiveGround
    if (pgr) { pgr._playerOcclusionAlpha = 1; pgr._playerOcclusionCropPx = 0 }
  }
  _updateCameraTerrainAvoidance() {}

  async _loadContent() {
    this.mapData.objects = []
    this.mapData.npcs = []
    this.mapData.introNarrative = []
    const at = Q.get('at')
    if (at) { const [x, y] = at.split(',').map(Number); this.mapData.spawns.player = { x, y } }
    // where you can stand, and at what height -- read from the map now, so the walk grid PGR's scene
    // builds before onEnter (and the routes it gives) already knows (the rock is drawn later, in onEnter)
    const md = this.mapData, hw = md.hewn, W = md.width, H = md.height
    this._walk = new Float32Array(W * H).fill(NaN)
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (hw.kind[r][c] === '.') this._walk[r * W + c] = hw.z[r][c]
    for (const [x, y] of hw.block || []) if (x >= 0 && y >= 0 && x < W && y < H) this._walk[y * W + x] = NaN     // under smooth water (hewnRock.js)
    for (const s of hw.spans || []) {
      const i = s.y * W + s.x
      if ((s.walk || 'deck') === 'deck') this._walk[i] = s.z
    }
  }

  walkZ(c, r) {
    const md = this.mapData
    if (!this._walk || c < 0 || r < 0 || c >= md.width || r >= md.height) return null
    const z = this._walk[r * md.width + c]
    return Number.isNaN(z) ? null : z
  }

  onEnter() {
    const pgr = this.perspectiveGround
    pgr.setSkyImage(null)
    pgr.setMountainImage?.(null)
    if (pgr._lightDiv) pgr._lightDiv.style.display = 'none'
    const box = pgr._groundCanvas?.parentElement
    if (box) { this._oldBg = box.style.background; box.style.background = '#000' }
    this.hewn = new HewnRock(this, { torch: num('torch'), grade: Q.get('grade'), ...(this.hewnOptions?.() || {}) })
    const p = this.player
    this._pz = this._camZ = this._zAt(p.logicalX, p.logicalY) ?? 0
    this._zones = Q.get('zoom') === '0' || Q.has('z') ? [] : (this.mapData.hewn.zones || [])
    if (Q.has('z')) this.time.delayedCall(10, () => { if (this._pgrView) this._pgrView.zT = this._pgrView.z = Number(Q.get('z')) })
    this._zone = null
    // routes: a step too high is no way
    if (this.pathFinder) this.pathFinder.edgeOk = (x, y, nx, ny) => this._stepOk(x, y, nx, ny)
    this.events.once('shutdown', () => this._cleanup())
  }

  _zAt(px, py) {
    const ts = this.tileSize
    return this.walkZ(Math.floor(px / ts), Math.floor(py / ts))
  }

  _stepOk(x, y, nx, ny) {
    const a = this.walkZ(x, y), b = this.walkZ(nx, ny)
    if (a == null || b == null) return false
    if (b - a > STEP) return false                  // a drop of any height may be taken, but not climbed back: a steep side is one way
    // a diagonal may not cut the corner of anything it couldn't step onto
    if (x !== nx && y !== ny) {
      for (const [cx, cy] of [[nx, y], [x, ny]]) {
        const m = this.walkZ(cx, cy)
        if (m == null || m - a > STEP || b - m > STEP) return false
      }
    }
    return true
  }

  update(time, delta) {
    this._liftMelee()
    const p = this.player
    if (p && this.hewn) {
      // you rise or sink onto the tile you're stepping to; the camera's height comes after you
      const want = this._zAt(p.targetX ?? p.logicalX, p.targetY ?? p.logicalY) ?? this._pz
      this._pz += (want - this._pz) * (1 - Math.exp(-delta / Z_MS))
      this._camZ += (this._pz - this._camZ) * (1 - Math.exp(-delta / CAM_MS))
      this.hewn.update(delta, this._pz, this._camZ)
      this._zoneZoom(p)
    }
    super.update(time, delta)
  }

  // closing in and drawing back by area: the view's zoom is moved there as you enter (you can still pinch)
  _zoneZoom(p) {
    const ts = this.tileSize, tx = Math.floor(p.logicalX / ts), ty = Math.floor(p.logicalY / ts)
    const z = this._zones.find(z => tx >= z.x0 && tx <= z.x1 && ty >= z.y0 && ty <= z.y1) || null
    if (z === this._zone) return
    this._zone = z
    if (z && this._pgrView && z.zoom) this._pgrView.zT = z.zoom
  }

  // the camera looks out ahead of you by area (a fraction of the screen you're moved down by), as effects/pgrView.js asks
  viewLookAhead() { return Q.has('look') ? Number(Q.get('look')) : (this._zone?.look ?? 0) }

  // PGR draws you at your height above the camera's (perspectiveGroundRenderer's player lift)
  playerLiftTiles() { return (this._pz ?? 0) - (this._camZ ?? 0) }

  // (a mistake in the drawing is reported once, not every frame, and doesn't stop the game)
  onPGRDrawComplete(ctx) {
    try { this.hewn?.draw() } catch (e) { if (!this._drawErr) { this._drawErr = true; console.error('[hewnTest] draw:', e) } }
    this._melee?._overHewn?.(this.hewn?.xctx || ctx)
  }

  // A sword fight's marks -- the blue veil of bullet time, the charge ring at your feet, the target tiles -- are drawn by
  // PGR on its own canvas, which the rock in front of you (hewn's canvas over you) covers: only the top of the screen
  // showed them. Each bout's are drawn instead after the rock, on that canvas over everything.
  _liftMelee() {
    const b = this._melee
    if (!b || b._overHewn) return
    b._overHewn = b.draw.bind(b)
    b.draw = () => {}
  }

  // a tap: the tile drawn under the finger (systems/pathFinder.js asks)
  screenToTile(x, y) { return this.hewn ? this.hewn.pick(x, y) : undefined }

  isColliding(x, y) {
    const tx = Math.floor(x / this.tileSize), ty = Math.floor(y / this.tileSize)
    const z = this.walkZ(tx, ty)
    if (z == null) {
      // pressing on water (the pool's, or open water): a ring goes out from its edge, where you pressed
      const pl = this.player, hw = this.hewn
      if (pl && (hw?.blocked?.has(ty * this.mapData.width + tx) || hw?.isWater?.(tx, ty))) {
        const px = pl.logicalX / this.tileSize, py = pl.logicalY / this.tileSize
        if (Math.hypot(px - (tx + 0.5), py - (ty + 0.5)) < 2.2) hw.bump(px, py, Math.min(tx + 1, Math.max(tx, px)), Math.min(ty + 1, Math.max(ty, py)))
      }
      return true
    }
    // a step too high is a wall to you, however you are walking (routes already know: _stepOk)
    const p = this.player, here = p ? this._zAt(p.logicalX, p.logicalY) : null
    return here != null && z - here > STEP          // up a steep side is a wall; down it is a drop (one way)
  }

  isSlopeBlocked(fromX, fromY, toX, toY) {
    const ts = this.tileSize
    return !this._stepOk(Math.floor(fromX / ts), Math.floor(fromY / ts), Math.floor(toX / ts), Math.floor(toY / ts))
  }

  // a diagonal that would cut a corner it can't slides along it instead (as caveTest's does)
  adjustStep(sx, sy, dx, dy, angle) {
    if (!dx || !dy) return null
    const ts = this.tileSize, tx = Math.floor(sx / ts), ty = Math.floor(sy / ts)
    if (this._stepOk(tx, ty, tx + dx, ty + dy)) return null
    const h = this._stepOk(tx, ty, tx + dx, ty), v = this._stepOk(tx, ty, tx, ty + dy)
    if (h && v) return Math.abs(Math.cos(angle * Math.PI / 180)) >= Math.abs(Math.sin(angle * Math.PI / 180)) ? [dx, 0] : [0, dy]
    if (h) return [dx, 0]
    if (v) return [0, dy]
    return [0, 0]
  }

  _cleanup() {
    PerspectiveGroundRenderer.CLIP_TOP_FRAC = null
    this.hewn?.destroy(); this.hewn = null
    const pgr = this.perspectiveGround
    if (pgr?._lightDiv) pgr._lightDiv.style.display = ''
    const box = pgr?._groundCanvas?.parentElement
    if (box && this._oldBg !== undefined) box.style.background = this._oldBg
  }

  shutdown() { this._cleanup(); super.shutdown() }
}

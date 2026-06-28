// testForest.js
// Location: js/game/scenes/locations/forest/testForest.js
//
// ── Purpose ───────────────────────────────────────────────────────────────────
// PROTOTYPE ONLY. Tests whether the "dense forest interior" feel (gloom,
// close camera, walled-maze collision) works at all before any generator
// or overworld-integration work happens. Extends PerspectiveScene directly
// (not BogScene) -- no encounter deck, no content file, no NPCs. Just a
// hand-placed maze map (testForest.json) and mood/camera overrides.
//
// ── What this tests ───────────────────────────────────────────────────────────
//   • Does isColliding() treat OAK wall GIDs as solid via getExtraUnwalkableGIDs()?
//   • Does a tighter getPGRConfig() actually feel "close/over-the-shoulder"?
//   • Does dark getAmbient() + small warm getPlayerLight() read as "gloom"?
//   • Does FOV/walkGrid/pathfinding work unmodified against a walled maze?
//
// ── What this does NOT do yet ─────────────────────────────────────────────────
//   • No exits (mapData.exits is absent -- checkExits() no-ops safely)
//   • No NPCs, no encounters, no content file
//   • No dust motes / light shafts / vignette -- that's a follow-up pass
//   • No generator -- testForest.json is hand-placed, see build_map.py
//
// Map file: public/maps/bogMaps/testForest.json

import PerspectiveScene from '../perspectiveScene.js'
import ForestEffects from '../../../effects/forestEffects.js'

// NOTE: OAK wall GIDs previously lived here and were marked unwalkable via
// getExtraUnwalkableGIDs(). Removed for this pass -- testForest.json's
// layer1 is now all-zero so PGR draws no tree billboards, isolating
// ForestEffects' trunks/canopy for a clean look before reintroducing real
// wall/collision data.

export default class TestForest extends PerspectiveScene {

 constructor() {
    super({ key: 'testForest' })
    this.tileSize = 48   // must match Player's default and wallMask's authored grid
  }
	getMapKey() { return 'testForest' }

  // Map lives in public/maps/forest/, not the inherited default
  // (/maps/bogMaps/${key}.json) -- forest maps get their own folder.
  getMapPath() { return `/maps/forest/${this.getMapKey()}.json?v=${Date.now()}` }

  // ── Collision ─────────────────────────────────────────────────────────────
  // TEMP DEBUGGING: returns false unconditionally -- entire map is walkable,
  // including wall-mask cells. This is to isolate whether "can't reach the
  // west edge" is a real wallMask/collision bug, or something unrelated
  // (visibility confusion from dense trunks, input issue, etc). Once
  // confirmed, REVERT to the real wallMask check below (kept commented,
  // not deleted, so it's a one-line swap back).
  isColliding(x, y) {
    return false

  const tx = Math.floor(x / this.tileSize)
  const ty = Math.floor(y / this.tileSize)
  const mask = this.mapData?.wallMask
  if (!mask) return false
  if (ty < 0 || ty >= mask.length || tx < 0 || tx >= mask[0].length) return true
  return mask[ty][tx] === 1 
  }

  // ── Camera: close / over-the-shoulder ─────────────────────────────────────
  // Overworld default (from BaseLocationScene) is TILES_ACROSS: 3.8 -- showing
  // ~4 tiles of width. Tightening this zooms in. CAMERA_ROW_OFFSET pulls the
  // camera closer behind the player; FOCAL_LENGTH shorter = more fisheye/close
  // feel. These are first-guess numbers -- expect to tune by eye in-engine.
  getPGRConfig() {
    return {
      ...super.getPGRConfig(),
      TILES_ACROSS:      2.4,   // was 3.8 -- zoom in, narrower field of view
      CAMERA_ROW_OFFSET: 9.0,   // was 14.0 -- camera sits closer behind player
      FOCAL_LENGTH:      8.0,   // was 12.0 -- tighter, more claustrophobic
      // HORIZON_Y_FRAC and HEIGHT_MULTIPLIER reverted to overworld defaults
      // (via super.getPGRConfig() / PGR's own static) -- the previous attempt
      // tried to fake "looming canopy" by pushing these to extremes, which
      // turned the canopy into an opaque wall blocking the floor entirely.
      // Canopy looming is now ForestEffects' job (see forestEffects.js),
      // layered above PGR rather than baked into ground-renderer billboards.
    }
  }

  // ── Mood: gloom under canopy ───────────────────────────────────────────────
  // Dark ambient + small warm player light = "your own light is small against
  // the dark." No sky image -- canopy blocks it entirely (PGR falls back to
  // flat ground colour when getSkyImage() returns null).
  getAmbient() { return 0x0a0c08 }

  getPlayerLight() {
    return { color: 0xffcc88, intensity: 1.1, radius: 140 }
  }

  getSkyImage() { return null }

  getWisps()      { return [] }
  getMusicTrack() { return null }

  // PerspectiveScene's default _loadContent() is a no-op, which leaves
  // mapData.objects/npcs as undefined. createObjects() guards on that and
  // returns early WITHOUT setting this.interactables = [], so the very next
  // update() crashes in checkProximityInteractions() on undefined.forEach.
  // Explicitly initialize both to empty arrays until real content exists.
  async _loadContent() {
    this.mapData.objects        = []
    this.mapData.npcs           = []
    this.mapData.introNarrative = []
  }

  onEnter() {
    console.log('[testForest] prototype scene ready -- walk into the walls to sanity-check collision')
    // PGR exists by the time onEnter() fires (create() builds it earlier
    // in drawTilemap()). Construct the canopy overlay now.
    this.forestEffects = new ForestEffects(this)

    // IMPORTANT: Phaser dispatches 'shutdown' as an EVENT through
    // this.events -- it does NOT automatically invoke a plain method
    // literally named shutdown() on the Scene instance. Confirmed via
    // Phaser docs (Scenes.Events.SHUTDOWN: "dispatched... Listen to it
    // from a Scene using this.events.on('shutdown', listener)").
    // The shutdown() method below being a plain override was likely
    // NEVER firing -- confirmed directly: no "[testForest] shutdown()
    // called" log ever appeared during a real testForest -> c2 scene
    // transition, which is why ForestEffects' canvas was persisting
    // into the next scene. Wiring the real event here as a belt-and-
    // suspenders fix. NOTE: this same gap likely affects
    // PerspectiveScene.shutdown() for every scene extending it, not just
    // this prototype -- worth fixing upstream once confirmed safe to do so.
    this.events.once('shutdown', () => {
      console.log('[testForest] real shutdown EVENT fired -- cleaning up forestEffects')
      if (this.forestEffects) { this.forestEffects.destroy(); this.forestEffects = null }
    })
  }

  // PGR calls this.scene?.onPGRDrawComplete?.(ctx) at the very end of its own
  // update(), every frame -- this is the hook PerspectiveScene's update()
  // loop already provides without us needing to override update() ourselves
  // and duplicate its (fairly large) body. ForestEffects.update() reads
  // pgr.playerScreenX/Y, which are guaranteed current by this point in the
  // frame since PGR just finished setting them.
  onPGRDrawComplete() {
    if (this.forestEffects) this.forestEffects.update()
  }

  // Kept as a plain method override too, in case it DOES also get invoked
  // in some code path (e.g. if something explicitly calls scene.shutdown()
  // as a method elsewhere) -- harmless either way since forestEffects is
  // nulled after first cleanup, so a second call here is a no-op.
  shutdown() {
    console.log('[testForest] shutdown() method called -- forestEffects present:', !!this.forestEffects)
    if (this.forestEffects) { this.forestEffects.destroy(); this.forestEffects = null }
    super.shutdown()
  }
}


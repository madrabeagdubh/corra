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
// ── Canopy-as-elevated-cube experiment (NEW) ────────────────────────────────────
// One-off test: registers a single custom GID (9101) as an elevated tile via
// ElevationRenderer, at a fixed test cell near spawn, to answer an open
// question from the canopy work in forestEffects.js -- specifically, whether
// PGR's existing building/cliff cube-rendering system can represent canopy
// as geometry that's visually elevated AND passable (camera/player can walk
// under/through it), rather than the screen-space DOM-canvas band/patch
// approaches tried previously, which never tracked the world correctly.
//
// This is NOT yet integrated with ForestEffects' trunks/canopy system --
// it's an isolated test of ONE tile, at ONE fixed height, to observe
// whether the rendered result floats above the ground (good) or fills in
// as a solid pillar from ground to canopy height (would need more work).
// See getElevationConfig() below for the actual wiring.
//
// IMPORTANT: this map previously had NO `hasCliffs` flag, which means
// PGR's elevation branch was never active for this scene (confirmed: PGR
// checks `this.scene.mapData?.hasCliffs` before doing anything with
// elevation at all). testForest.json has been patched to add
// `"hasCliffs": true` as part of this experiment -- without that flag,
// ElevationRenderer.update() no-ops immediately regardless of any config
// passed to it. (Worth a follow-up: `hasCliffs` is a poor name for what's
// now a general "this map has elevation data" flag, given it also governs
// buildings and now this canopy test -- rename once this experiment either
// pans out or doesn't, rather than rename mid-experiment.)
//
// ── What this does NOT do yet ─────────────────────────────────────────────────
//   • No exits beyond the existing west exit
//   • No NPCs, no encounters, no content file
//   • No dust motes / light shafts / vignette -- that's a follow-up pass
//   • No generator -- testForest.json is hand-placed, see build_map.py
//   • Canopy-as-cube is NOT yet driven by trunk positions or any density
//     logic -- this is a single fixed test tile, intentionally minimal,
//     to answer the floating-vs-pillar question before building anything
//     more elaborate on top of it.
//
// Map file: public/maps/forest/testForest.json

import PerspectiveScene from '../perspectiveScene.js'
import ForestEffects from '../../../effects/forestEffects.js'
import UndergrowthRenderer from '../../../effects/undergrowthRenderer.js'

// NOTE: OAK wall GIDs previously lived here and were marked unwalkable via
// getExtraUnwalkableGIDs(). Removed for this pass -- testForest.json's
// layer1 is now all-zero so PGR draws no tree billboards, isolating
// ForestEffects' trunks/canopy for a clean look before reintroducing real
// wall/collision data.
//
// Canopy test GID 9101 is deliberately NOT added to any unwalkable set
// here either -- that absence IS the test for "can the player/camera pass
// under/through it." If getExtraUnwalkableGIDs() is reintroduced later for
// real wall collision, make sure 9101 stays excluded from it.

export default class TestForest extends PerspectiveScene {

 constructor() {
    super({ key: 'testForest' })
    this.tileSize = 48   // must match Player's default and wallMask's authored grid
  }
	getMapKey() { return 'testForest' }

  // Map lives in public/maps/forest/, not the inherited default
  // (/maps/bogMaps/${key}.json) -- forest maps get their own folder.
  getMapPath() { return `/maps/forest/${this.getMapKey()}.json?v=${Date.now()}` }

  // ── Elevation / canopy-as-cube test ──────────────────────────────────────
  // Same pattern as BogB0's getElevationConfig() override -- registers the
  // custom canopy test texture with PGR, then tells ElevationRenderer that
  // GID 9101 is an elevated tile with a fixed height well above head
  // height. cliffFaceGid/cliffSouth/cliffHeight are left at
  // ElevationRenderer's own defaults via the spread of an empty base config,
  // since this map has no real cliffs -- only the one test tile matters
  // here.
  //
  // gidHeights: { 9101: 4.0 } -- 4 tile-heights up is an arbitrary first
  // guess, picked to sit well above where a person's head would be,
  // purely so we can visually tell "floating" apart from "grounded" at a
  // glance. Expect to retune once we see it in-engine.
  getElevationConfig() {
    const CANOPY_TEST_GID = 9101

    // Custom tile texture must be registered on perspectiveGround directly
    // (same call BogB0 makes) -- ElevationRenderer itself doesn't load
    // textures, it only computes height/offset math. PGR is guaranteed to
    // exist by the time getElevationConfig() is read (called after
    // drawTilemap() in BaseLocationScene's create() flow, same as BogB0).
    if (this.perspectiveGround) {
      this.perspectiveGround.registerCustomTile(
        CANOPY_TEST_GID,
        '/assets/canopy_test.png'
      )
    }

    return {
      elevatedGids: new Set([CANOPY_TEST_GID]),
      gidHeights:   { [CANOPY_TEST_GID]: 4.0 },
      // No real cliffs on this map -- cliffFaceGid/cliffSouth/cliffHeight
      // intentionally omitted, ElevationRenderer falls back to its own
      // defaults for those, which won't matter since no other tile here
      // is in elevatedGids.
    }
  }

  // ── Collision ─────────────────────────────────────────────────────────────
  // TEMP DEBUGGING: returns false unconditionally -- entire map is walkable,
  // including wall-mask cells. This is to isolate whether "can't reach the
  // west edge" is a real wallMask/collision bug, or something unrelated
  // (visibility confusion from dense trunks, input issue, etc). Once
  // confirmed, REVERT to the real wallMask check below (kept commented,
  // not deleted, so it's a one-line swap back).
  //
  // NOTE: this also means today's canopy-cube test tells us nothing about
  // real walkability under the cube -- collision is globally disabled
  // right now regardless of GID. That's fine for THIS test (which is only
  // checking visual floating-vs-pillar behaviour), but worth remembering:
  // don't conclude "canopy is walkable" from this test alone once real
  // collision comes back.
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
      // The elevated-cube canopy experiment (getElevationConfig() above) is
      // a SEPARATE, parallel approach being tested independently -- not yet
      // reconciled with ForestEffects. Keep both running side by side until
      // one clearly wins, rather than ripping ForestEffects out prematurely.
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
    console.log('[testForest] canopy-cube test: GID 9101 placed near spawn, height 4.0 tiles -- walk toward (16,12) and look up')
    // PGR exists by the time onEnter() fires (create() builds it earlier
    // in drawTilemap()). Construct the canopy overlay now.
    this.forestEffects = new ForestEffects(this)

    // Undergrowth (rocks/roots/brambles at wallMask cells) shares
    // ForestEffects' own canvas context (via its `ctx` getter) rather
    // than creating a second DOM canvas layer -- ForestEffects.update()
    // already has a no-op-safe hook (this.undergrowthRenderer) that
    // calls .update(pgr, sw, sh) on whatever's assigned here, at the
    // right point in the draw order (after floor tint, before trunks).
    this.forestEffects.undergrowthRenderer = new UndergrowthRenderer(this, this.forestEffects.ctx)

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
      if (this.forestEffects?.undergrowthRenderer) {
        this.forestEffects.undergrowthRenderer.destroy()
        this.forestEffects.undergrowthRenderer = null
      }
      if (this.forestEffects) { this.forestEffects.destroy(); this.forestEffects = null }
    })
  }

  // Tells PGR's idle-redraw-skip optimization (an 8-second battery-saving
  // early-return when player/camera are stationary) that this scene has
  // continuous animation that must keep running regardless -- canopy
  // sway (ForestEffects) animates via performance.now() every frame and
  // was silently freezing whenever the player stood still for 8+
  // seconds, since PGR's update() (which onPGRDrawComplete depends on)
  // was returning early before ever reaching ForestEffects.update().
  // Confirmed the same root cause affects water tile animation and fire
  // particles elsewhere in the codebase -- not unique to this scene.
  hasContinuousAnimation() { return true }

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
    if (this.forestEffects?.undergrowthRenderer) {
      this.forestEffects.undergrowthRenderer.destroy()
      this.forestEffects.undergrowthRenderer = null
    }
    if (this.forestEffects) { this.forestEffects.destroy(); this.forestEffects = null }
    super.shutdown()
  }
}


// grove.js
// Location: js/game/scenes/locations/forest/grove.js
//
// ── Purpose ───────────────────────────────────────────────────────────────────
// PROTOTYPE. A small, purpose-built clearing/grove -- a pause-point space
// the player can rest in and see something at the centre from a distance,
// as a deliberate CONTRAST to testForest's dense maze. Built to test the
// "purpose first, then choose features" design direction: this map uses
// trunks + canopy + gentle elevation + LIGHT undergrowth accents, not the
// dense wall-to-wall obstacle coverage that made testForest read as
// cluttered once 3D undergrowth boxes were combined with trunks and
// canopy all at once.
//
// ── Design choices specific to this map ──────────────────────────────────────
//   • wallMask is SPARSE and intentional -- individually-spaced trees
//     ringing a clearing, not a maze. ForestEffects is constructed with
//     trunkKeepChance: 1.0 so EVERY wallMask cell gets a trunk (no
//     further thinning) -- the sparseness is already baked into the map
//     data itself, unlike testForest where thinning compensates for a
//     densely-authored wallMask.
//   • UndergrowthRenderer is constructed with keepChance/heightScale
//     turned down substantially for a much lighter presence, per
//     explicit direction: keep some undergrowth, but quiet.
//   • mapData.focalPoint marks the centre tile where "the thing to find"
//     will eventually go -- not yet built, this scene just confirms the
//     player can see toward that point from the entrance.
//
// Map file: public/maps/forest/grove.json

import PerspectiveScene from '../perspectiveScene.js'
import ForestEffects from '../../../effects/forestEffects.js'
import UndergrowthRenderer from '../../../effects/undergrowthRenderer.js'
import DolmenRenderer from '../../../effects/dolmenRenderer.js'

export default class Grove extends PerspectiveScene {

  constructor() {
    super({ key: 'grove' })
    this.tileSize = 48
  }

  getMapKey() { return 'grove' }
  getMapPath() { return `/maps/forest/${this.getMapKey()}.json?v=${Date.now()}` }

  // No real wall collision data beyond wallMask-driven trunks for now --
  // same temporary all-walkable debug stance as testForest, kept
  // consistent rather than introducing a different collision behaviour
  // between the two forest prototypes while both are still in flux.
  isColliding(x, y) {
    return false
  }

  // Slightly more open than testForest's tight maze framing -- this is a
  // clearing meant to be SEEN across, not a claustrophobic corridor, so
  // the field of view is a little wider. Still close/over-the-shoulder
  // per the established camera direction (not revisiting camera choice
  // here, per earlier discussion that camera position is fine for now).
  getPGRConfig() {
    return {
      ...super.getPGRConfig(),
      TILES_ACROSS:      3.0,    // wider than testForest's 2.4 -- see across the clearing
      CAMERA_ROW_OFFSET: 9.0,
      FOCAL_LENGTH:      9.0,    // slightly less tight than testForest's 8.0
    }
  }

  getAmbient() { return 0x141810 }   // slightly lighter than testForest's near-black --
                                       // this is a calmer space, not oppressive gloom

  getPlayerLight() {
    return { color: 0xffe0a0, intensity: 1.2, radius: 160 }
  }

  getSkyImage() { return null }
  getWisps()      { return [] }
  getMusicTrack() { return null }

  async _loadContent() {
    this.mapData.objects        = []
    this.mapData.npcs           = []
    this.mapData.introNarrative = []
  }

  onEnter() {
    console.log('[grove] prototype scene ready -- sparse trees, light undergrowth, clear centre sightline')
    console.log('[grove] focal point at', this.mapData?.focalPoint, '-- placeholder, no object placed yet')

    // trunkKeepChance: 1.0 -- every wallMask cell gets a trunk. The
    // grove's wallMask is ALREADY sparse by design (individually-spaced
    // trees from gen_grove_map.py), unlike testForest's dense maze where
    // the default 0.45 thinning compensates for every-other-cell
    // coverage. Applying that same thinning here would make an already
    // sparse layout even sparser than intended.
    this.forestEffects = new ForestEffects(this, { trunkKeepChance: 1.0 })

    // Light undergrowth: keepChance thins WHICH wallMask cells get an
    // obstacle box at all (0.35 -- roughly a third), heightScale shrinks
    // every kind's height substantially (0.5 -- about half) for a
    // quieter, accent-level presence rather than testForest's full
    // density/height, which combined with trunks+canopy read as
    // cluttered. Tune both further once seen in-engine.
    this.forestEffects.undergrowthRenderer = new UndergrowthRenderer(
      this, this.forestEffects.ctx, { keepChance: 0.35, heightScale: 0.5 }
    )

    // TEMPORARY TEST PLACEMENT: the dolmen's real home is the
    // not-yet-built lagoon map, but the grove already has working
    // terrain/heightmap/camera, so it's the fastest place to actually
    // SEE the dolmen rendering for real before building the full lagoon
    // map around it. Anchored at the grove's existing focalPoint, which
    // was always meant to hold "the thing to find" anyway.
    const fp = this.mapData?.focalPoint
    if (fp) {
      this.dolmen = new DolmenRenderer(this, this.forestEffects.ctx, {
        anchorX: fp.x, anchorY: fp.y
      })
    }

    this.events.once('shutdown', () => {
      console.log('[grove] real shutdown EVENT fired -- cleaning up forestEffects')
      if (this.dolmen) { this.dolmen.destroy(); this.dolmen = null }
      if (this.forestEffects?.undergrowthRenderer) {
        this.forestEffects.undergrowthRenderer.destroy()
        this.forestEffects.undergrowthRenderer = null
      }
      if (this.forestEffects) { this.forestEffects.destroy(); this.forestEffects = null }
    })
  }

  // See TestForest's identical method for the full explanation -- PGR's
  // idle-redraw-skip optimization (8s battery saver) was silently
  // freezing canopy sway whenever the player stood still. This opts
  // grove out of that skip.
  hasContinuousAnimation() { return true }

  onPGRDrawComplete() {
    if (this.forestEffects) this.forestEffects.update()
    // Dolmen draws AFTER forestEffects (trunks/canopy/undergrowth) so it
    // layers on top -- reasonable default for a hero object that should
    // never be hidden behind ordinary forest clutter, though this may
    // need real depth-sorting against nearby trunks once the lagoon map
    // has trees near the dolmen itself.
    if (this.dolmen && this.perspectiveGround) {
      this.dolmen.update(this.perspectiveGround, this.forestEffects?._sw, this.forestEffects?._sh)
    }
  }

  shutdown() {
    console.log('[grove] shutdown() method called -- forestEffects present:', !!this.forestEffects)
    if (this.forestEffects?.undergrowthRenderer) {
      this.forestEffects.undergrowthRenderer.destroy()
      this.forestEffects.undergrowthRenderer = null
    }
    if (this.forestEffects) { this.forestEffects.destroy(); this.forestEffects = null }
    super.shutdown()
  }
}


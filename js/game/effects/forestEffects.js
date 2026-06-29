// forestEffects.js
// Location: js/game/effects/forestEffects.js
//
// ── Purpose ───────────────────────────────────────────────────────────────────
// Forest-interior-specific atmosphere, kept OUT of PerspectiveGroundRenderer
// (which is already large) per the same pattern as distantRain.js,
// stormOverlay.js, starfield.js etc. -- standalone effect modules that a
// scene opts into explicitly.
//
// ── Canopy approach (current) ────────────────────────────────────────────────
// Canopy is drawn as a FOLIAGE CAP on each individual trunk, inside
// _drawTrunks itself -- NOT as a separate screen-space band (tried first,
// looked detached from the world and didn't move with the camera) and NOT
// as standalone patches projected at each trunk's world position via a
// second pass (tried second, either invisible when sparse or an
// indistinguishable blob when dense enough to read as coverage). Also
// tried and abandoned: representing canopy as PGR's elevated-cube terrain
// system (used for buildings/cliffs) -- confirmed via PGR's own
// architecture docs that elevation there always means "raised GROUND
// connected to a cliff face," not floating geometry, so it's structurally
// the wrong primitive for a ceiling with nothing underneath it.
//
// Foliage caps fix the "detached from the world" problem by construction:
// there is no separate canopy layer to keep in sync with the camera --
// the cap is part of the same draw call, in the same loop, using the same
// projected screenX/screenY/scale as the trunk's own strokes. It moves
// exactly because it never had its own position to begin with.
//
// ── What this does ────────────────────────────────────────────────────────────
// Renders trunk clusters (species-varied stroke shapes) derived live from
// scene.mapData.wallMask, each topped with a soft mottled foliage cap, plus
// wall-cell floor tinting so the ground itself shows the maze shape. A
// soft player-centred cutout keeps the player's own sprite from ever being
// fully obscured by a nearby trunk/cap.
//
// ── What this does NOT do yet ─────────────────────────────────────────────────
//   • Does not touch PerspectiveGroundRenderer source at all
//   • Does not know about tile GIDs, walls, or collision
//   • Does not manage its own update loop -- the owning scene calls update()
//     once per frame, same as it already does for perspectiveGround.update()
//   • Does not yet model light beams / dust motes / canopy gaps -- those
//     depend on a gap-placement design that doesn't exist yet. A "gap" in
//     this model would naturally just be a region with no/sparse trunks,
//     since caps only exist above real trunks -- no separate density
//     system needed, but the actual light-shaft visual is future work.
//
// ── Usage ─────────────────────────────────────────────────────────────────────
//   import ForestEffects from '../../effects/forestEffects.js'
//   // after this.perspectiveGround exists (i.e. after drawTilemap()):
//   this.forestEffects = new ForestEffects(this)
//   // each frame, after perspectiveGround.update():
//   this.forestEffects.update()
//   // in shutdown():
//   if (this.forestEffects) { this.forestEffects.destroy(); this.forestEffects = null }

export default class ForestEffects {

  // Soft cutout radius as a fraction of screen diagonal. Previous value
  // (0.32) was far too large on a tall portrait screen -- with the player
  // sitting low on screen, only the circle's upper arc was visible at all,
  // which is exactly the "floating circle in the sky" symptom seen in
  // testing. Shrunk substantially so the whole circle fits around the
  // player with room to spare.
  static HOLE_RADIUS_FRAC = 0.11

  // How much of the hole's radius is fully transparent vs. fading out.
  // 0 = fades from centre; closer to 1 = mostly solid hole with a thin
  // soft edge. Soft circle per current direction -> keep this fairly low.
  static HOLE_INNER_FRAC = 0.15

  // Canopy/foliage cap fill -- placeholder mottled texture (baked once,
  // tiled via ctx.fillStyle = pattern). Swap for real canopy art later;
  // this just proves the layering mechanic with something foliage-ish
  // rather than a flat color block.
  static CANOPY_BASE_COLOR  = 'rgba(10, 26, 12, 1)'
  static CANOPY_MOTTLE_DARK = 'rgba(4, 14, 6, 0.55)'
  static CANOPY_MOTTLE_LIGHT= 'rgba(34, 58, 24, 0.35)'
  static CANOPY_TILE_SIZE   = 128   // px, pattern repeat size

  // ── High canopy haze (vague bright smoke-like upper layer) ──────────────────
  // A general atmospheric wash occupying the top portion of the screen,
  // deliberately bright (catching implied sky-light from above) and
  // deliberately independent of trunk position -- per explicit
  // direction: "dominate the top third with bright chaos, resolving
  // into distinct clumps as it descends toward the trunks." This is
  // SEPARATE from the per-trunk leaf-facet caps (CAP_* constants below)
  // -- the haze provides the vague/bright upper read, the facet caps
  // provide the literal/traceable lower read, and trunks/caps drawing
  // ON TOP of the haze each frame is what visually "resolves" the haze
  // into clumps as you look down.
  static HAZE_BAND_FRAC      = 0.62   // was 0.34 -- too short, left a visible gap above
                                        // the actual canopy caps (confirmed via screenshot:
                                        // haze and caps occupied separate bands with plain
                                        // dark sky between them). Extended well down screen
                                        // so the two layers actually overlap.
  static HAZE_FADE_FRAC      = 0.45   // fraction of the band's OWN height that fades to transparent at its bottom
  static HAZE_BLOB_COUNT     = 14
  static HAZE_BRIGHT_COLOR   = 'rgba(146, 168, 96, 0.55)'   // bright, sky-lit
  static HAZE_MID_COLOR      = 'rgba(88, 110, 58, 0.4)'
  static HAZE_DARK_COLOR     = 'rgba(40, 54, 26, 0.3)'

  // ── Floor tint for wall cells ──────────────────────────────────────────────
  // Without this, the ground is one unbroken grass rectangle regardless of
  // the wall mask -- trunks alone don't read as "negative space" if the
  // floor underneath doesn't change too. Dark wash painted over wall-cell
  // floor positions, projected the same way trunks are.
  static WALL_FLOOR_TINT = 'rgba(6, 10, 5, 0.78)'

  // Trunks are derived LIVE from scene.mapData.wallMask in the constructor
  // (see _bakeTrunkShapesFromMask) rather than a hardcoded position list.
  // Only wall cells bordering at least one open floor cell get a trunk --
  // see _bakeTrunkShapesFromMask for why.

  static TRUNK_BASE_HEIGHT_TILES = 2.6   // was 1.6 -- taller trunks push leaf-cap clumps
  // higher up the screen, closing a visible gap between the literal canopy
  // caps and the high haze layer (confirmed via screenshot: haze and caps
  // occupied disconnected vertical ranges no amount of haze-band resizing
  // could fix, since the two layers are positioned by entirely different
  // mechanisms -- haze by screen fraction, caps by actual trunk-top
  // position). WIDTH is intentionally left unchanged below, since the
  // earlier "trunks block the view" problem came from increasing height
  // AND width together -- taller-but-still-slim trunks shouldn't
  // reintroduce that.
  static TRUNK_BASE_WIDTH_TILES  = 0.45  // reverted

  // ── Foliage cap (canopy-on-trunk) ────────────────────────────────────────────
  // Cap radius is relative to the trunk's own projected WIDTH (widthPx,
  // computed the same way trunk strokes already are) rather than an
  // independent tile-unit constant -- this guarantees the cap scales
  // exactly in lockstep with the trunk it belongs to, at every distance,
  // with no separate distance-fade math required.
  static CAP_RADIUS_WIDTH_MUL = 2.6   // was 1.6 -- bigger caps for more overlapping coverage
  // between neighbouring trees, aiming for "heaps of foliage" rather than
  // isolated separated clumps with visible sky between them.
  // NOTE: was 3.2 (way oversized, dominated the screen), then 1.1 (read as
  // a tight round ball sitting on the trunk). This sits between the two --
  // wide enough to read as a canopy mass once combined with the flatter
  // blob spread below, not a basketball perched on a pole.

  // Lifts the cap's anchor point slightly above the trunk's own top --
  // NOT a large offset. A first attempt at 1.4 created a visible empty
  // gap between trunk top and the lowest cap blobs, because blobs only
  // extend roughly +-yRatio*capRadius around the anchor (yRatio range is
  // small, ~+-0.225) -- pushing the anchor up by 1.4*capRadius guaranteed
  // a gap far larger than the blobs could ever bridge. Height should
  // come from capRadius itself (bigger cap = taller silhouette), not
  // from detaching the anchor from the trunk.
  static CAP_HEIGHT_OFFSET_MUL = 0.35

  static CAP_FACET_COUNT_MIN = 6   // was 4 -- more facets to fill the larger cap radius
  static CAP_FACET_COUNT_MAX = 11  // was 7

  // Number of stacked cap LAYERS per trunk -- per explicit direction
  // ("heaps of leaves... stack em"), one flat facet cluster wasn't
  // enough volume even at a large radius. Each layer sits higher than
  // the one below it (CAP_LAYER_SPACING apart, in cap-radius units) and
  // is progressively smaller, so a tree builds upward in tapering tiers
  // rather than one hat-shaped cluster.
  static CAP_LAYER_COUNT_MIN = 3
  static CAP_LAYER_COUNT_MAX = 5
  static CAP_LAYER_SPACING   = 0.55   // vertical gap between layers, in cap-radius units

  // ── Canopy sway (breeze) ──────────────────────────────────────────────────────
  // Gentle whole-cap rotation, animated per-frame at draw time (NOT
  // baked) so it stays cheap -- see _drawFoliageCap's sway comment for
  // why facets themselves are never re-baked for this.
  static SWAY_MAX_ANGLE_RAD = 0.045   // ~2.6 degrees max tilt either way -- gentle, not violent
  static SWAY_SPEED_MIN     = 0.25    // radians/sec input to the sine wave, per-trunk varied between these
  static SWAY_SPEED_MAX     = 0.5

  // ── Leaf textures (low-poly canopy facets) ───────────────────────────────────
  // Paths to leaf texture images -- code handles any number of entries.
  // Loaded async (same pattern as PGR's registerCustomTile: an Image
  // with onload/onerror, not awaited) -- facets fall back to the
  // existing CANOPY_BASE_COLOR flat fill until a texture finishes
  // loading, rather than blocking construction or erroring if assets
  // aren't ready yet. Assumes files exist at these paths; update list to
  // match whatever's actually placed in public/assets/textures/.
  static LEAF_TEXTURE_PATHS = [
    '/assets/textures/leaves1.png',
    '/assets/textures/leaves2.png',
  ]

  // ── Species presets ────────────────────────────────────────────────────────
  // Irish native trees with genuinely distinct silhouettes, expressed via
  // stroke-drawing parameters rather than sprite art. Each trunk picks one
  // species deterministically (seeded by position) so the look is varied
  // but stable across reloads.
  static SPECIES = {
    oak: {
      // thick, gnarled, dark -- the original look, kept as baseline
      colorDark: 'rgba(18, 14, 10, 0.95)',
      colorRim:  'rgba(58, 48, 30, 0.55)',
      stemCountMin: 2, stemCountMax: 4,
      widthMul: 1.0, curveMul: 1.0, branchChance: 0.55,
    },
    birch: {
      // pale bark, thin, often multi-stemmed, straighter than oak
      colorDark: 'rgba(168, 160, 142, 0.92)',
      colorRim:  'rgba(80, 72, 58, 0.6)',
      stemCountMin: 2, stemCountMax: 3,
      widthMul: 0.55, curveMul: 0.4, branchChance: 0.3,
    },
    rowan: {
      // slender, medium brown, gentle curve, rounder branching
      colorDark: 'rgba(58, 40, 26, 0.92)',
      colorRim:  'rgba(110, 84, 50, 0.5)',
      stemCountMin: 1, stemCountMax: 2,
      widthMul: 0.7, curveMul: 0.8, branchChance: 0.5,
    },
    yew: {
      // very dark, dense, twisted, reads as a mass rather than distinct stems
      colorDark: 'rgba(10, 12, 8, 0.97)',
      colorRim:  'rgba(30, 36, 22, 0.4)',
      stemCountMin: 3, stemCountMax: 5,
      widthMul: 1.15, curveMul: 1.3, branchChance: 0.2,
    },
    hazel: {
      // many thin stems fanning from one base, no dominant trunk
      colorDark: 'rgba(54, 42, 28, 0.9)',
      colorRim:  'rgba(96, 78, 48, 0.45)',
      stemCountMin: 4, stemCountMax: 6,
      widthMul: 0.35, curveMul: 0.7, branchChance: 0.15,
    },
  }
  static SPECIES_KEYS = Object.keys(ForestEffects.SPECIES)

  // South-of-player trunk fade: trunks between the player and the camera
  // (higher tile row than the player) are faded, not erased, so the player
  // is never lost behind a tree without making that tree disappear
  // outright.
  static SOUTH_FADE_RANGE_TILES = 2.5   // how many tiles south of the player are affected
  static SOUTH_FADE_MIN_ALPHA   = 0.35  // opacity of the trunk closest to the player

  // Toggle for isolating trunks during tuning -- set false to see trunks
  // (and now caps) against open floor with nothing else drawn.
  static CANOPY_ENABLED = true

  constructor(scene, options = {}) {
    this.scene = scene
    this._sw = scene.game.canvas.width
    this._sh = scene.game.canvas.height

    // Per-instance trunk-keep-chance override, defaulting to the static
    // (used by testForest's dense maze, where thinning matters). The
    // grove map needs every wallMask cell to get a trunk -- it's already
    // deliberately sparse by design, so no further thinning should
    // happen -- but TRUNK_KEEP_CHANCE is a shared static affecting every
    // ForestEffects instance, so mutating it directly would also thin
    // testForest. This override lets each scene opt into its own value
    // without affecting other scenes using the same class.
    this._trunkKeepChance = options.trunkKeepChance ?? ForestEffects.TRUNK_KEEP_CHANCE

    const container = scene.game.canvas.parentNode
    this._canvas = document.createElement('canvas')
    this._canvas.id = 'forest-canopy'
    this._canvas.width  = this._sw
    this._canvas.height = this._sh
    this._canvas.style.cssText = [
      'position:absolute', 'top:0', 'left:0',
      'z-index:5', 'pointer-events:none',
      'image-rendering:pixelated', 'image-rendering:crisp-edges',
    ].join(';')
    container.appendChild(this._canvas)
    this._ctx = this._canvas.getContext('2d')
    this._ctx.imageSmoothingEnabled = false

    this._resizeHandler = () => {
      const canvas = scene.game.canvas
      this._sw = canvas.width
      this._sh = canvas.height
      this._canvas.width  = this._sw
      this._canvas.height = this._sh
    }
    window.addEventListener('resize', this._resizeHandler)

    this._canopyPattern = this._bakeCanopyPattern()
    this._leafTextures = this._loadLeafTextures()
    this._trunks = this._bakeTrunkShapesFromMask()

    console.log('[ForestEffects] constructed -', this._sw, 'x', this._sh, '-', this._trunks.length, 'trunk clusters -- trunkKeepChance:', this._trunkKeepChance)
  }

  // Loads each path in LEAF_TEXTURE_PATHS as an Image, async -- returns
  // an array of slots that start as null and get filled in-place once
  // each image's onload fires. _drawFoliageCap reads from this same
  // array every frame, so textures simply "appear" mid-session once
  // loaded rather than needing any explicit ready/waiting state --
  // facets fall back to CANOPY_BASE_COLOR (a flat fill, via
  // _fillFacetFallback) for any texture slot that's still null when
  // drawn. Same async-tolerant pattern as PGR's registerCustomTile.
  _loadLeafTextures() {
    const slots = new Array(ForestEffects.LEAF_TEXTURE_PATHS.length).fill(null)
    ForestEffects.LEAF_TEXTURE_PATHS.forEach((path, i) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        slots[i] = img
        console.log(`[ForestEffects] leaf texture ${i} loaded -- ${img.width}x${img.height} from ${path}`)
      }
      img.onerror = (e) => console.warn(`[ForestEffects] leaf texture ${i} failed to load: ${path}`, e)
      img.src = path
    })
    return slots
  }

  static TRUNK_KEEP_CHANCE = 0.45

  _bakeTrunkShapesFromMask() {
    const mask = this.scene.mapData?.wallMask
    if (!mask) {
      console.warn('[ForestEffects] no mapData.wallMask found -- no trunks will render')
      return []
    }
    const mapH = mask.length
    const mapW = mask[0]?.length ?? 0
    const isWall = (x, y) => (y >= 0 && y < mapH && x >= 0 && x < mapW) ? mask[y][x] === 1 : true

    const cellKeepValue = (x, y) => {
      let h = (x * 374761393 + y * 668265263) | 0
      h = Math.imul(h ^ (h >>> 13), 1274126177)
      h = (h ^ (h >>> 16)) >>> 0
      return h / 0xffffffff
    }

    const positions = []
    for (let ty = 0; ty < mapH; ty++) {
      for (let tx = 0; tx < mapW; tx++) {
        if (!isWall(tx, ty)) continue
        const bordersOpen =
          !isWall(tx + 1, ty) || !isWall(tx - 1, ty) ||
          !isWall(tx, ty + 1) || !isWall(tx, ty - 1)
        if (!bordersOpen) continue
        if (cellKeepValue(tx, ty) > this._trunkKeepChance) continue
        positions.push([tx + 0.5, ty + 0.5])
      }
    }
    return positions.map(([tx, ty]) => this._buildTrunkShape(tx, ty))
  }

  _buildTrunkShape(tx, ty) {
      let seed = Math.floor(tx * 7919 + ty * 104729) & 0x7fffffff
      const rand = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        return seed / 0x7fffffff
      }

      const speciesKey = ForestEffects.SPECIES_KEYS[
        Math.floor(rand() * ForestEffects.SPECIES_KEYS.length)
      ]
      const species = ForestEffects.SPECIES[speciesKey]

      const strokeCount = species.stemCountMin +
        Math.floor(rand() * (species.stemCountMax - species.stemCountMin + 1))
      const strokes = []
      for (let i = 0; i < strokeCount; i++) {
        const xOffset  = (rand() - 0.5) * 1.4
        const curve    = (rand() - 0.5) * 0.5 * species.curveMul
        const heightMul = 0.82 + rand() * 0.36
        const widthMul  = (0.7 + rand() * 0.6) * species.widthMul
        const hasBranch = rand() < species.branchChance
        const branchAt  = 0.45 + rand() * 0.35
        const branchAng = (rand() - 0.5) * 1.1
        const branchLen = 0.5 + rand() * 0.6
        strokes.push({ xOffset, curve, heightMul, widthMul, hasBranch, branchAt, branchAng, branchLen })
      }

      // Foliage cap LAYERS (low-poly, leaf-textured, STACKED): per
      // explicit direction ("heaps of leaves... stack em"), a single
      // flat facet cluster wasn't enough volume even at a large radius
      // -- this generates CAP_LAYER_COUNT separate facet clusters per
      // trunk, each at a progressively higher vertical offset, so one
      // tree builds foliage upward in tiers (like a tree being mostly
      // canopy, stacked, rather than a hat on a pole). Each layer is
      // generated the same way the original single cluster was (same
      // facet-generation logic), just repeated per layer with an
      // increasing yOffsetRatio baked in.
      const layerCount = ForestEffects.CAP_LAYER_COUNT_MIN +
        Math.floor(rand() * (ForestEffects.CAP_LAYER_COUNT_MAX - ForestEffects.CAP_LAYER_COUNT_MIN + 1))
      const capLayers = []
      for (let layer = 0; layer < layerCount; layer++) {
        // Each successive layer sits higher (more negative Y) and
        // slightly smaller/more concentrated than the one below it --
        // tapering upward like a real canopy crown narrows toward its
        // peak, rather than stacking identically-sized clusters.
        const layerYOffset = -layer * ForestEffects.CAP_LAYER_SPACING
        const layerScale = 1.0 - layer * 0.12   // each layer slightly smaller than the one below

        const facetCount = ForestEffects.CAP_FACET_COUNT_MIN +
          Math.floor(rand() * (ForestEffects.CAP_FACET_COUNT_MAX - ForestEffects.CAP_FACET_COUNT_MIN + 1))
        const facets = []
        for (let i = 0; i < facetCount; i++) {
          const cx = (rand() - 0.5) * 2.2 * layerScale
          const cy = layerYOffset + (rand() - 0.5) * 0.45 * layerScale
          const baseSize = (0.32 + rand() * 0.3) * layerScale
          const jitter = () => baseSize * (0.6 + rand() * 0.7)
          const corners = [
            { xRatio: cx - jitter(), yRatio: cy - jitter() * 0.6 },
            { xRatio: cx + jitter(), yRatio: cy - jitter() * 0.6 },
            { xRatio: cx + jitter(), yRatio: cy + jitter() * 0.6 },
            { xRatio: cx - jitter(), yRatio: cy + jitter() * 0.6 },
          ]
          const brightness = 0.65 + rand() * 0.55
          facets.push({ corners, brightness, textureSeed: rand() })
        }
        capLayers.push(facets)
      }
      // capFacets kept as a flattened view (all layers concatenated)
      // for any code that doesn't care about layer structure -- but the
      // bake step below uses capLayers directly so it can still apply
      // per-layer logic if needed later (e.g. different fade per tier).
      const capFacets = capLayers.flat()

      return { tx, ty, species, strokes, capFacets, capLayers }
  }

  _bakeCanopyPattern() {
    const size = ForestEffects.CANOPY_TILE_SIZE
    const tile = document.createElement('canvas')
    tile.width = size
    tile.height = size
    const tctx = tile.getContext('2d')

    tctx.fillStyle = ForestEffects.CANOPY_BASE_COLOR
    tctx.fillRect(0, 0, size, size)

    let seed = 1337
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }

    const blobPass = (color, count, minR, maxR) => {
      tctx.fillStyle = color
      for (let i = 0; i < count; i++) {
        const x = rand() * size
        const y = rand() * size
        const r = minR + rand() * (maxR - minR)
        tctx.beginPath()
        tctx.arc(x, y, r, 0, Math.PI * 2)
        tctx.fill()
      }
    }

    blobPass(ForestEffects.CANOPY_MOTTLE_DARK,  22, 6, 18)
    blobPass(ForestEffects.CANOPY_MOTTLE_LIGHT, 16, 4, 12)

    return this._ctx.createPattern(tile, 'repeat')
  }

  // ── Public accessors for sibling effect modules ──────────────────────────────
  // UndergrowthRenderer (and potentially future forest-interior effects)
  // draws onto this SAME canvas rather than creating its own DOM layer --
  // these getters are the sanctioned way to get at the context/dimensions
  // without reaching into _ctx/_sw/_sh directly from outside the class.
  get ctx() { return this._ctx }
  get width() { return this._sw }
  get height() { return this._sh }

  update() {

    const pgr = this.scene.perspectiveGround
    if (!pgr) return

    const canvas = this.scene.game.canvas
    if (canvas.width !== this._sw || canvas.height !== this._sh) {
      this._sw = canvas.width
      this._sh = canvas.height
      this._canvas.width  = this._sw
      this._canvas.height = this._sh
    }

    const sw = this._sw, sh = this._sh
    const ctx = this._ctx

    const px = pgr.playerScreenX ?? sw / 2
    const py = pgr.playerScreenY ?? sh / 2

    ctx.clearRect(0, 0, sw, sh)

    const p = this.scene.player
    const ts = pgr.tileDisplaySize ?? 48
    const playerTileY = Math.floor((p?.targetY ?? p?.logicalY ?? 0) / ts)

    this._drawWallFloorTint(pgr)
    this._drawExitMarkers(pgr)

    // Undergrowth (rocks/roots/brambles at wallMask cells) is an
    // independent sibling module, NOT imported here -- if the owning
    // scene has wired one in (see testForest.js), draw it now, after the
    // floor tint but before trunks, so undergrowth boxes sit visually on
    // top of the tinted ground and trunks can still draw over/around
    // them. ForestEffects has no hard dependency on UndergrowthRenderer
    // existing -- this is a no-op if undergrowthRenderer was never set.
    if (this.undergrowthRenderer) {
      this.undergrowthRenderer.update(pgr, sw, sh)
    }

    // High canopy HAZE layer: a vague, bright, screen-space band
    // occupying roughly the top third, drawn BEFORE trunks/leaf-facet
    // caps so the literal canopy renders on top of it -- this is what
    // produces "resolves into distinct clumps as it descends," since
    // the haze is visible above/between the literal caps but gets
    // progressively covered by them lower down. Deliberately
    // independent of trunk positions (a general atmospheric wash, not
    // tied to where trees actually are) and deliberately screen-space
    // rather than world-projected -- unlike the abandoned first canopy
    // attempt, detachment from the world is fine here because this
    // layer is explicitly meant to read as vague/abstract sky-glow, not
    // as architecture that needs to track the camera precisely.
    this._drawCanopyHaze(sw, sh)

    this._drawTrunks(pgr, playerTileY)

    // Soft circular cutout centred on the player -- guards against a
    // cap/trunk that happens to land almost exactly on the player's own
    // screen position from fully hiding the player sprite. Cheap
    // insurance, not load-bearing the way it was for the old screen-space
    // band.
    const radius = Math.sqrt(sw * sw + sh * sh) * ForestEffects.HOLE_RADIUS_FRAC
    this._punchHole(px, py, radius, ForestEffects.HOLE_INNER_FRAC)
  }

  // Draws the high canopy haze: a bright, vague, screen-space band
  // occupying the top portion of the screen. Baked ONCE into a cached
  // canvas (re-baked only if screen dimensions change), same
  // bake-then-drawImage performance approach used for per-trunk caps --
  // there's no reason to redraw soft blob noise every frame when it
  // never changes shape, and this avoids reintroducing the kind of
  // per-frame cost that caused the earlier slowdown.
  _drawCanopyHaze(sw, sh) {
    if (!this._hazeCanvas || this._hazeCanvasW !== sw || this._hazeCanvasH !== sh) {
      this._bakeCanopyHaze(sw, sh)
    }
    this._ctx.drawImage(this._hazeCanvas, 0, 0)
  }

  _bakeCanopyHaze(sw, sh) {
    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const hctx = canvas.getContext('2d')

    const bandH = sh * ForestEffects.HAZE_BAND_FRAC
    const fadeH = bandH * ForestEffects.HAZE_FADE_FRAC
    const solidH = bandH - fadeH

    // Deterministic seeded blobs, same LCG pattern used throughout this
    // file -- stable across reloads, not re-rolled per bake.
    let seed = 8821
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }

    hctx.save()
    hctx.beginPath()
    hctx.rect(0, 0, sw, bandH)
    hctx.clip()

    // Base vertical gradient: brightest at the very top (implied
    // sky-light source), darkening toward the band's own bottom edge --
    // independent of the separate fade-to-transparent step below, which
    // controls how the band's bottom blends into open space rather than
    // its internal brightness gradient.
    const baseGrad = hctx.createLinearGradient(0, 0, 0, bandH)
    baseGrad.addColorStop(0,   ForestEffects.HAZE_BRIGHT_COLOR)
    baseGrad.addColorStop(0.5, ForestEffects.HAZE_MID_COLOR)
    baseGrad.addColorStop(1,   ForestEffects.HAZE_DARK_COLOR)
    hctx.fillStyle = baseGrad
    hctx.fillRect(0, 0, sw, bandH)

    // Soft irregular blobs on top of the gradient -- "bright chaos"
    // texture, not a flat gradient alone. Larger/more numerous near the
    // top (vague/amorphous), implicitly thinning toward the bottom of
    // the band simply because blob Y-positions are weighted upward via
    // a squared random distribution.
    for (let i = 0; i < ForestEffects.HAZE_BLOB_COUNT; i++) {
      const x = rand() * sw
      // Bias toward the top: squaring a [0,1) value skews results
      // toward 0, so most blobs land in the upper portion of the band.
      const yBias = rand() * rand()
      const y = yBias * bandH
      const r = sw * (0.08 + rand() * 0.16)   // scale with screen width, not a fixed px size
      const colorRoll = rand()
      const color = colorRoll < 0.4 ? ForestEffects.HAZE_BRIGHT_COLOR
                   : colorRoll < 0.75 ? ForestEffects.HAZE_MID_COLOR
                   : ForestEffects.HAZE_DARK_COLOR

      const grad = hctx.createRadialGradient(x, y, 0, x, y, r)
      grad.addColorStop(0, color)
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      hctx.fillStyle = grad
      hctx.beginPath()
      hctx.arc(x, y, r, 0, Math.PI * 2)
      hctx.fill()
    }

    // Fade-to-transparent at the band's bottom edge, so it blends into
    // open space rather than ending in a hard horizontal seam.
    if (fadeH > 0) {
      const fadeGrad = hctx.createLinearGradient(0, solidH, 0, bandH)
      fadeGrad.addColorStop(0, 'rgba(0,0,0,1)')
      fadeGrad.addColorStop(1, 'rgba(0,0,0,0)')
      hctx.save()
      hctx.beginPath()
      hctx.rect(0, solidH, sw, fadeH)
      hctx.clip()
      hctx.globalCompositeOperation = 'destination-in'
      hctx.fillStyle = fadeGrad
      hctx.fillRect(0, 0, sw, bandH)
      hctx.restore()
    }

    hctx.restore()

    this._hazeCanvas  = canvas
    this._hazeCanvasW = sw
    this._hazeCanvasH = sh
  }

  _punchHole(cx, cy, radius, innerStopFrac) {
    const ctx = this._ctx
    ctx.globalCompositeOperation = 'destination-out'
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
    grad.addColorStop(0,             'rgba(0,0,0,1)')
    grad.addColorStop(innerStopFrac, 'rgba(0,0,0,1)')
    grad.addColorStop(1,             'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }

  _drawExitMarkers(pgr) {
    const exits = this.scene.mapData?.exits
    if (!exits) return
    const ctx = this._ctx
    const horizonPx = pgr._horizonPx?.() ?? 0
    const tileDisplaySize = pgr.tileDisplaySize ?? 48
    const sh = this._sh

    for (const exitData of Object.values(exits)) {
      if (!exitData?.tiles) continue
      for (const [tx, ty] of exitData.tiles) {
        const yTopRaw = pgr._rowToScreenY?.(ty)
        const yBotRaw = pgr._rowToScreenY?.(ty + 1)
        if (yBotRaw == null) continue

        const yTopClamped = (yTopRaw == null || yTopRaw < horizonPx - tileDisplaySize)
          ? horizonPx - tileDisplaySize
          : yTopRaw
        const yBotClamped = Math.min(sh + 100, yBotRaw)
        if (yBotClamped <= yTopClamped) continue
        if (yBotClamped < -50 || yTopClamped > sh + 50) continue

        const xTL = pgr._colToScreenX?.(tx,     ty)
        const xTR = pgr._colToScreenX?.(tx + 1, ty)
        const xBL = pgr._colToScreenX?.(tx,     ty + 1)
        const xBR = pgr._colToScreenX?.(tx + 1, ty + 1)
        if (xTL == null) continue
        if (Math.max(xTL, xTR, xBL, xBR) < -50) continue
        if (Math.min(xTL, xTR, xBL, xBR) > this._sw + 50) continue

        ctx.fillStyle = 'rgba(255, 20, 20, 0.85)'
        ctx.beginPath()
        ctx.moveTo(xTL, yTopClamped)
        ctx.lineTo(xTR, yTopClamped)
        ctx.lineTo(xBR, yBotClamped)
        ctx.lineTo(xBL, yBotClamped)
        ctx.closePath()
        ctx.fill()
      }
    }
  }

  _drawWallFloorTint(pgr) {
    const mask = this.scene.mapData?.wallMask
    if (!mask) return
    const ctx = this._ctx
    const mapH = mask.length
    const mapW = mask[0]?.length ?? 0

    const horizonPx = pgr._horizonPx?.() ?? 0
    const tileDisplaySize = pgr.tileDisplaySize ?? 48
    const sh = this._sh

    for (let ty = 0; ty < mapH; ty++) {
      for (let tx = 0; tx < mapW; tx++) {
        if (mask[ty][tx] !== 1) continue

        const yTopRaw = pgr._rowToScreenY?.(ty)
        const yBotRaw = pgr._rowToScreenY?.(ty + 1)
        if (yBotRaw == null) continue

        const yTopClamped = (yTopRaw === null || yTopRaw < horizonPx - tileDisplaySize)
          ? horizonPx - tileDisplaySize
          : yTopRaw
        const yBotClamped = Math.min(sh + 100, yBotRaw)
        if (yBotClamped <= yTopClamped) continue

        if (yBotClamped < -50 || yTopClamped > sh + 50) continue

        const xTL = pgr._colToScreenX?.(tx,     ty)
        const xTR = pgr._colToScreenX?.(tx + 1, ty)
        const xBL = pgr._colToScreenX?.(tx,     ty + 1)
        const xBR = pgr._colToScreenX?.(tx + 1, ty + 1)
        if (xTL == null) continue
        if (Math.max(xTL, xTR, xBL, xBR) < -50) continue
        if (Math.min(xTL, xTR, xBL, xBR) > this._sw + 50) continue

        // Height-adjusted corners -- same formula PGR's own ground-tile
        // loop uses (_yTL/_yTR/_yBL/_yBR): each corner's screenY is
        // shifted up by that corner's vertex height times the SCALE AT
        // THAT CORNER'S OWN ROW, not a single shared scale. Falls back
        // to the flat yTopClamped/yBotClamped harmlessly if _vertexH or
        // _scaleAtRow are unavailable, or the map has no heightMap (both
        // return 0/no-op in that case, confirmed from PGR source).
        const sTop = pgr._scaleAtRow?.(ty)     ?? 0
        const sBot = pgr._scaleAtRow?.(ty + 1) ?? 0
        const hTL = (pgr._vertexH?.(tx,     ty)     ?? 0) * sTop
        const hTR = (pgr._vertexH?.(tx + 1, ty)     ?? 0) * sTop
        const hBL = (pgr._vertexH?.(tx,     ty + 1) ?? 0) * sBot
        const hBR = (pgr._vertexH?.(tx + 1, ty + 1) ?? 0) * sBot

        const yTL = yTopClamped - hTL
        const yTR = yTopClamped - hTR
        const yBL = yBotClamped - hBL
        const yBR = yBotClamped - hBR

        ctx.fillStyle = ForestEffects.WALL_FLOOR_TINT
        ctx.beginPath()
        ctx.moveTo(xTL, yTL)
        ctx.lineTo(xTR, yTR)
        ctx.lineTo(xBR, yBR)
        ctx.lineTo(xBL, yBL)
        ctx.closePath()
        ctx.fill()
      }
    }
  }

  // Bakes one trunk's entire foliage cap (all its facets) into a small
  // offscreen canvas ONCE, cached on the trunk object itself
  // (trunk._cachedCapCanvas) -- subsequent frames just drawImage() that
  // cached result scaled to the trunk's current on-screen size, instead
  // of re-clipping/re-filling every facet every single frame. A first
  // version did the full facet draw (clip + pattern fill + brightness
  // overlay, per facet) every frame for every trunk, which was the
  // actual cause of a reported slowdown -- confirmed: that's real
  // per-frame canvas state-change work that doesn't need to happen more
  // than once, since a cap's facet shapes/textures/brightness never
  // change after being baked in _buildTrunkShape.
  //
  // Baked at a CANONICAL size (BAKE_REFERENCE_RADIUS_PX as if capRadius
  // were that many pixels) -- per-frame drawing just scales this fixed
  // bitmap up/down via drawImage's width/height args to match the
  // trunk's actual current capRadius, rather than re-baking at a
  // different resolution every time distance changes.
  static BAKE_REFERENCE_RADIUS_PX = 80

  _bakeCapForTrunk(trunk) {
    const R = ForestEffects.BAKE_REFERENCE_RADIUS_PX
    const canvas = document.createElement('canvas')
    // Padding is ASYMMETRIC, not a square margin -- stacked layers
    // extend well ABOVE the anchor point (up to CAP_LAYER_COUNT_MAX-1
    // layers * CAP_LAYER_SPACING, e.g. 4 * 0.55 = 2.2 cap-radii upward)
    // but barely below it (lowest layer's facets only reach down to
    // roughly +0.3 cap-radii, same range a single non-stacked cluster
    // always had). A first version used uniform square padding sized
    // for the OLD single-layer facet spread -- with multiple stacked
    // layers, that risked clipping the topmost layer's facets off the
    // top of the bake canvas entirely.
    const padX     = R * 1.6
    const padTop   = R * (1.0 + ForestEffects.CAP_LAYER_SPACING * (ForestEffects.CAP_LAYER_COUNT_MAX - 1) + 0.6)
    const padBottom= R * 0.7
    canvas.width  = Math.ceil(padX * 2)
    canvas.height = Math.ceil(padTop + padBottom)
    const bctx = canvas.getContext('2d')
    const cx = padX, cy = padTop   // bake-space anchor point, corresponds to (screenX, capAnchorY) at draw time

    const loadedTextures = this._leafTextures?.filter(t => t != null) ?? []
    const useTexture = loadedTextures.length > 0

    for (const facet of trunk.capFacets) {
      const pts = facet.corners.map(c => ({
        x: cx + c.xRatio * R,
        y: cy + c.yRatio * R,
      }))

      let fillSource
      if (useTexture) {
        const idx = Math.floor(facet.textureSeed * loadedTextures.length) % loadedTextures.length
        const img = loadedTextures[idx]
        if (!this._leafPatternCache) this._leafPatternCache = new Map()
        if (!this._leafPatternCache.has(img)) {
          this._leafPatternCache.set(img, bctx.createPattern(img, 'repeat'))
        }
        fillSource = this._leafPatternCache.get(img)
      } else {
        fillSource = this._canopyPattern ?? ForestEffects.CANOPY_BASE_COLOR
      }

      bctx.save()
      bctx.beginPath()
      bctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) bctx.lineTo(pts[i].x, pts[i].y)
      bctx.closePath()
      bctx.clip()

      const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x))
      const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y))
      bctx.fillStyle = fillSource
      bctx.fillRect(minX, minY, maxX - minX, maxY - minY)

      if (facet.brightness < 1) {
        bctx.fillStyle = `rgba(0,0,0,${(1 - facet.brightness).toFixed(3)})`
        bctx.fillRect(minX, minY, maxX - minX, maxY - minY)
      } else if (facet.brightness > 1) {
        const overlayAlpha = Math.min(0.4, (facet.brightness - 1))
        bctx.fillStyle = `rgba(255,255,255,${overlayAlpha.toFixed(3)})`
        bctx.fillRect(minX, minY, maxX - minX, maxY - minY)
      }

      bctx.restore()
    }

    trunk._cachedCapCanvas = canvas
    // Store the bake-space anchor position (cx, cy) and canvas
    // dimensions separately, rather than a single square "pad" value --
    // the canvas is no longer square/symmetric around its anchor, so
    // draw-time positioning needs to know exactly where within the
    // image the anchor point sits, not just one radius value.
    trunk._cachedCapAnchorX = cx
    trunk._cachedCapAnchorY = cy
    trunk._cachedCapW = canvas.width
    trunk._cachedCapH = canvas.height
    // Snapshot which texture slots were loaded at bake time -- if more
    // textures finish loading later (async), this lets _drawFoliageCap
    // detect the change and re-bake once, rather than permanently
    // freezing every cap at "whatever textures happened to be ready
    // first."
    trunk._cachedCapTextureCount = loadedTextures.length
  }

  // Draws one trunk's foliage cap using its cached baked canvas,
  // scaled/positioned to the trunk's current on-screen capRadius --
  // cheap drawImage call per frame instead of re-rendering every facet.
  // Re-bakes automatically (once) if the trunk has no cached canvas yet,
  // or if more leaf textures have finished loading since the last bake.
  _drawFoliageCap(trunk, screenX, topY, widthPx, alpha) {
    const ctx = this._ctx
    const capRadius = widthPx * ForestEffects.CAP_RADIUS_WIDTH_MUL
    if (!(capRadius > 0)) return

    const loadedCount = this._leafTextures?.filter(t => t != null).length ?? 0
    if (!trunk._cachedCapCanvas || trunk._cachedCapTextureCount !== loadedCount) {
      this._bakeCapForTrunk(trunk)
    }

    const capAnchorY = topY - capRadius * ForestEffects.CAP_HEIGHT_OFFSET_MUL
    const R = ForestEffects.BAKE_REFERENCE_RADIUS_PX
    const scaleFactor = capRadius / R
    const drawW = trunk._cachedCapW * scaleFactor
    const drawH = trunk._cachedCapH * scaleFactor
    // Position so the baked anchor point (cachedCapAnchorX/Y within the
    // image) lands exactly at (screenX, capAnchorY) on screen -- NOT
    // simply centring the image, since the anchor sits asymmetrically
    // within the (now taller-on-top) baked canvas.
    const drawX = screenX    - trunk._cachedCapAnchorX * scaleFactor
    const drawY = capAnchorY - trunk._cachedCapAnchorY * scaleFactor

    // Sway: a gentle whole-cap rotation around the BASE anchor point
    // (screenX, capAnchorY -- where the cap meets the trunk), animated
    // by a per-trunk-seeded sine wave so trees don't all sway in
    // lockstep. This animates the cheap drawImage call itself rather
    // than re-baking facets every frame, which would reintroduce the
    // exact per-frame cost the bake-once approach was built to avoid.
    // Per-trunk phase/speed jitter derived once from tx/ty (deterministic,
    // stable across reloads) rather than re-randomized each frame.
    if (trunk._swayPhase == null) {
      // Cheap deterministic per-trunk seed reusing the same hash style
      // as elsewhere in this file -- not cryptographic, just needs to
      // differ per trunk.
      const h = Math.sin(trunk.tx * 12.9898 + trunk.ty * 78.233) * 43758.5453
      trunk._swayPhase = (h - Math.floor(h)) * Math.PI * 2
      trunk._swaySpeed = ForestEffects.SWAY_SPEED_MIN +
        ((h * 7.13) % 1) * (ForestEffects.SWAY_SPEED_MAX - ForestEffects.SWAY_SPEED_MIN)
    }
    const swayAngle = Math.sin(performance.now() * 0.001 * trunk._swaySpeed + trunk._swayPhase)
                       * ForestEffects.SWAY_MAX_ANGLE_RAD

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(screenX, capAnchorY)
    ctx.rotate(swayAngle)
    ctx.translate(-screenX, -capAnchorY)
    ctx.drawImage(trunk._cachedCapCanvas, drawX, drawY, drawW, drawH)
    ctx.restore()
  }

  _drawTrunks(pgr, playerTileY) {
    const ctx = this._ctx
    const fadeRangeTiles = ForestEffects.SOUTH_FADE_RANGE_TILES
    const minAlpha = ForestEffects.SOUTH_FADE_MIN_ALPHA

    for (const trunk of this._trunks) {
      const baseScreenY = pgr._rowToScreenY?.(trunk.ty + 1)
      const scale       = pgr._scaleAtRow?.(trunk.ty + 1)
      if (baseScreenY == null || !(scale > 0)) continue

      const screenX = pgr._colToScreenX?.(trunk.tx + 0.5, trunk.ty + 1)
      if (screenX == null) continue

      // Height-respecting ground position: trunk anchors at tx+0.5, so
      // average the two nearest vertex heights (tx, ty+1) and (tx+1,
      // ty+1) at this row -- same _vertexH lookup PGR's own tile loop
      // uses, applied here so trunks sit ON the undulating ground rather
      // than floating at flat height once a real heightMap exists.
      // Falls back to 0 (flat) harmlessly if _vertexH is unavailable or
      // the map has no heightMap -- _vertexH itself returns 0 in that
      // case, confirmed from PGR source.
      // trunk.ty is a .5-offset value (trunks are placed at [tx+0.5,
      // ty+0.5] in _buildTrunkShapesFromMask), so trunk.ty + 1 is
      // non-integer (e.g. 22.5) -- _vertexH does hm[row][col] with NO
      // internal flooring of row/col, only a bounds comparison, so a
      // non-integer row silently resolves to undefined rather than
      // erroring inside _vertexH itself. Must floor explicitly here.
      // Confirmed as the actual cause of "Cannot read properties of
      // undefined (reading '22')" -- trunk.ty+1 was passing through as
      // ~22.5, displayed/truncated as 22 in the error message.
      const groundRow = Math.floor(trunk.ty + 1)
      const hLeft  = pgr._vertexH?.(Math.floor(trunk.tx),     groundRow) ?? 0
      const hRight = pgr._vertexH?.(Math.floor(trunk.tx) + 1, groundRow) ?? 0
      const groundHeightTiles = (hLeft + hRight) * 0.5
      const screenY = baseScreenY - groundHeightTiles * scale

      if (screenX < -200 || screenX > this._sw + 200) continue
      if (screenY < -200 || screenY > this._sh + 200) continue

      let alpha = 1.0
      const southDist = trunk.ty - playerTileY
      if (southDist > 0 && southDist < fadeRangeTiles) {
        const t = 1 - southDist / fadeRangeTiles
        alpha = 1 - t * (1 - minAlpha)
      }
      ctx.globalAlpha = alpha

      const widthPx  = ForestEffects.TRUNK_BASE_WIDTH_TILES  * scale
      const heightPx = ForestEffects.TRUNK_BASE_HEIGHT_TILES * scale

      for (const s of trunk.strokes) {
        const w = widthPx * s.widthMul
        const h = heightPx * s.heightMul
        const baseX = screenX + s.xOffset * widthPx
        const baseY = screenY
        const topX  = baseX + s.curve * w * 3
        const topY  = baseY - h
        const midX  = (baseX + topX) / 2 + s.curve * w * 1.5
        const midY  = (baseY + topY) / 2

        ctx.fillStyle = trunk.species.colorDark
        ctx.beginPath()
        ctx.moveTo(baseX - w / 2, baseY)
        ctx.quadraticCurveTo(midX - w / 4, midY, topX - w / 8, topY)
        ctx.lineTo(topX + w / 8, topY)
        ctx.quadraticCurveTo(midX + w / 4, midY, baseX + w / 2, baseY)
        ctx.closePath()
        ctx.fill()

        ctx.strokeStyle = trunk.species.colorRim
        ctx.lineWidth = Math.max(1, w * 0.12)
        ctx.beginPath()
        ctx.moveTo(baseX - w / 2, baseY)
        ctx.quadraticCurveTo(midX - w / 4, midY, topX - w / 8, topY)
        ctx.stroke()

        if (s.hasBranch) {
          const branchBaseX = baseX + (topX - baseX) * s.branchAt
          const branchBaseY = baseY + (topY - baseY) * s.branchAt
          const branchEndX  = branchBaseX + Math.sin(s.branchAng) * w * 3 * s.branchLen
          const branchEndY  = branchBaseY - Math.cos(s.branchAng) * w * 2 * s.branchLen
          ctx.strokeStyle = trunk.species.colorDark
          ctx.lineWidth = Math.max(1, w * 0.35)
          ctx.beginPath()
          ctx.moveTo(branchBaseX, branchBaseY)
          ctx.lineTo(branchEndX, branchEndY)
          ctx.stroke()
        }
      }

      // Foliage cap, drawn last (on top of this trunk's own strokes),
      // anchored at the trunk's overall top point.
      if (ForestEffects.CANOPY_ENABLED) {
        const topY = screenY - heightPx
        this._drawFoliageCap(trunk, screenX, topY, widthPx, alpha)
      }
    }
    ctx.globalAlpha = 1.0
  }

  destroy() {
    console.log('[ForestEffects] destroy() called -- canvas present:', !!this._canvas,
      'has parent:', !!this._canvas?.parentNode)
    window.removeEventListener('resize', this._resizeHandler)
    if (this._canvas?.parentNode) {
      this._canvas.parentNode.removeChild(this._canvas)
      console.log('[ForestEffects] canvas removed from DOM')
    } else {
      console.warn('[ForestEffects] destroy() ran but canvas had no parent -- already removed, or never attached?')
    }
    this._canvas = null
    this._ctx = null
  }
}


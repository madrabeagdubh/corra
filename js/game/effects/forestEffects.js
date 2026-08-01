// forestEffects.js
// Location: js/game/effects/forestEffects.js
//
// ── v7 (this version): trunks moved into PGR's ground canvas ────────────────
// Trunks USED TO render on their own dedicated canvas, pinned at a fixed
// z-index ABOVE both PGR's ground canvas (_gCtx, z:2) and its object canvas
// (_oCtx, z:3, where the player is drawn). That meant trunks could never be
// occluded by nearer/taller terrain (hills always "see-through" for trees),
// and the player could never stand in front of a tree (the tree's canvas
// always won, regardless of true relative depth).
//
// Cliffs/elevated terrain don't have this problem: they're drawn on _gCtx,
// which sits BELOW _oCtx -- so the player (fixed on _oCtx) always correctly
// draws over a cliff face, and within _gCtx itself, PGR's own per-row draw
// order (far-to-near) already gives correct hill-vs-cliff occlusion.
//
// This version moves trunk drawing into THAT SAME mechanism: ForestEffects
// no longer owns a canvas for trunks or draws them itself. It only bakes
// trunk SHAPES (unchanged baking logic) and exposes them via
// getTrunksForRow()/drawTrunk(ctx, ...), which PerspectiveGroundRenderer
// calls from inside its own per-row loop, passing its own _gCtx. Trees now
// inherit the same proven occlusion behaviour as cliffs, for free.
//
// The old per-trunk "occluding" alpha-fade hack (dimming a tree when the
// player stood near it, to fake "player in front of tree") is REMOVED --
// it only existed to work around trunks being unconditionally on top of
// the player; now that trunks are on _gCtx, the player (still on _oCtx)
// always draws over them correctly with no special-case check needed.
//
// ForestEffects STILL owns its own canvas for canopy haze and exit markers
// -- those are full-screen/atmospheric effects, not solid occludable
// objects, so keeping them always-on-top is correct and unaffected by any
// of the above.
//
// ── v6: trunk screen-position fix ────────────────────────────────────────────
// _bakeTrunkShapesFromMask() stores each trunk's anchor as tile-CENTRE
// coordinates: [tx + 0.5, ty + 0.5]. The old _drawTrunks() was adding a
// FURTHER +0.5 (X) / +1 (Y) on top of that already-offset value, drawing
// the trunk a half-tile southeast of the wallMask cell it actually
// collides on. Fixed by using trunk.tx / trunk.ty + 0.5 directly (already
// tile-centre) instead of adding a second offset. Preserved in the
// refactored drawTrunk() below.
//
// ── v5: tapered branches + tintManager foliage tint ──────────────────────────
// 1. Branches were a constant-width straight stroke at HALF the trunk's
//    own width -- confirmed via screenshot this read as girder-like, not
//    branch-like. Replaced with a TAPERED FILLED SHAPE (thick at the
//    trunk, narrow at the tip) with a slight curve, at a much smaller base
//    width. branchScale instance option (default 1.0) scales branch
//    length/width, or disables branches entirely at 0.
// 2. Foliage canopy gets the SAME tintManager-driven per-tile colour
//    variation the old Oryx tree stamps had. Baked once per trunk cap,
//    not per-frame.
//
// ── v4: canopy bushiness controls ─────────────────────────────────────────────
// canopyFacetScale / canopyLayerScale / canopyRadiusScale (all default
// 1.0) let non-forest contexts have visibly smaller, sparser canopies.
//
// ── Terrain contour driven entirely by tree roots ────────────────────────────
// Terrain peaks are baked into the map JSON at generation/migration time,
// NOT mutated here at runtime.
//
// ── Trunk sinks into the ground ───────────────────────────────────────────────
// The trunk's drawn shape extends PAST its ground anchor point, burying
// the base regardless of small terrain/anchor alignment mismatch.
//
// ── Usage ─────────────────────────────────────────────────────────────────────
//   import ForestEffects from '../../effects/forestEffects.js'
//   this.forestEffects = new ForestEffects(this, {
//     trunkKeepChance: 1.0,
//     widthScale: 0.35, heightScale: 0.35,
//     canopyHaze: false,
//     canopyFacetScale: 0.5, canopyLayerScale: 0.5, canopyRadiusScale: 0.55,
//     branchScale: 0.4,   // 0 to disable branches entirely
//   })
//   this.perspectiveGround.setForestEffects(this.forestEffects)   // NEW -- wires trunks into PGR's own draw loop
//   this.forestEffects.update()   // each frame, after perspectiveGround.update() -- still needed for haze/exit markers
//   if (this.forestEffects) { this.forestEffects.destroy(); this.forestEffects = null }   // shutdown

export default class ForestEffects {

  static CANOPY_BASE_COLOR  = 'rgba(10, 26, 12, 1)'
  static CANOPY_MOTTLE_DARK = 'rgba(4, 14, 6, 0.55)'
  static CANOPY_MOTTLE_LIGHT= 'rgba(34, 58, 24, 0.35)'
  static CANOPY_TILE_SIZE   = 128

  static HAZE_BAND_FRAC      = 0.62
  static HAZE_FADE_FRAC      = 0.45
  static HAZE_BLOB_COUNT     = 14
  static HAZE_BRIGHT_COLOR   = 'rgba(146, 168, 96, 0.55)'
  static HAZE_MID_COLOR      = 'rgba(88, 110, 58, 0.4)'
  static HAZE_DARK_COLOR     = 'rgba(40, 54, 26, 0.3)'

  static WALL_FLOOR_TINT = 'rgba(6, 10, 5, 0.78)'

  static TRUNK_BASE_HEIGHT_TILES = 4.4
  static TRUNK_BASE_WIDTH_TILES  = 1.3

  static TRUNK_UNDERGROUND_EXTEND_PX_MUL = 0.8

  // ── Bark striations ───────────────────────────────────────────────────────────
  static BARK_STRIPE_COUNT_MIN = 5
  static BARK_STRIPE_COUNT_MAX = 9
  static BARK_STRIPE_DARK  = 'rgba(0, 0, 0, 0.2)'
  static BARK_STRIPE_LIGHT = 'rgba(255, 255, 255, 0.09)'

  // ── Branches (tapered, see v5 note) ──────────────────────────────────────────
  static BRANCH_LENGTH_MUL     = 3.2   // was effectively 4 (x) / 3 (y), now uniform
  static BRANCH_BASE_WIDTH_MUL = 0.16  // was 0.5 -- half-trunk-width read as girders
  static BRANCH_TIP_WIDTH_FRAC = 0.12  // tip width as a fraction of base width (taper)
  static BRANCH_CURVE_FRAC     = 0.15  // sideways bow, as a fraction of branch length

  // ── Foliage cap (canopy-on-trunk) ────────────────────────────────────────────
  static CAP_RADIUS_WIDTH_MUL = 2.6
  static CAP_HEIGHT_OFFSET_MUL = 0.35
  static CAP_FACET_COUNT_MIN = 6
  static CAP_FACET_COUNT_MAX = 11
  static CAP_LAYER_COUNT_MIN = 3
  static CAP_LAYER_COUNT_MAX = 5
  static CAP_LAYER_SPACING   = 0.55

  // GID used purely as a lookup key into tintManager's 'vegetation'
  // category (see GID_CATEGORIES.vegetation in tintManager.js) -- any
  // vegetation-category GID works identically here, since getTint()'s
  // actual colour output is driven by tile position hashing, not GID.
  static TINT_LOOKUP_GID = 315

  static SWAY_MAX_ANGLE_RAD = 0.045
  static SWAY_SPEED_MIN     = 0.25
  static SWAY_SPEED_MAX     = 0.5

  static LEAF_TEXTURE_PATHS = [
    '/assets/textures/leaves1.png',
    '/assets/textures/leaves2.png',
  ]

  static SPECIES = {
    oak: {
      colorDark: 'rgba(18, 14, 10, 0.95)',
      colorRim:  'rgba(58, 48, 30, 0.55)',
      stemCountMin: 2, stemCountMax: 4,
      widthMul: 1.0, curveMul: 1.0, branchChance: 0.55,
    },
    birch: {
      colorDark: 'rgba(168, 160, 142, 0.92)',
      colorRim:  'rgba(80, 72, 58, 0.6)',
      stemCountMin: 2, stemCountMax: 3,
      widthMul: 0.55, curveMul: 0.4, branchChance: 0.3,
    },
    rowan: {
      colorDark: 'rgba(58, 40, 26, 0.92)',
      colorRim:  'rgba(110, 84, 50, 0.5)',
      stemCountMin: 1, stemCountMax: 2,
      widthMul: 0.7, curveMul: 0.8, branchChance: 0.5,
    },
    yew: {
      colorDark: 'rgba(10, 12, 8, 0.97)',
      colorRim:  'rgba(30, 36, 22, 0.4)',
      stemCountMin: 3, stemCountMax: 5,
      widthMul: 1.15, curveMul: 1.3, branchChance: 0.2,
    },
    hazel: {
      colorDark: 'rgba(54, 42, 28, 0.9)',
      colorRim:  'rgba(96, 78, 48, 0.45)',
      stemCountMin: 4, stemCountMax: 6,
      widthMul: 0.35, curveMul: 0.7, branchChance: 0.15,
    },
  }
  static SPECIES_KEYS = Object.keys(ForestEffects.SPECIES)

  static SOUTH_FADE_RANGE_TILES = 2.5
  static SOUTH_FADE_MIN_ALPHA   = 0.35

  static CANOPY_ENABLED = true

  static TRUNK_KEEP_CHANCE = 0.45

  // Row offset added to trunk.ty (already tile-centre, i.e. originalTY+0.5)
  // to get the anchor row used for screenX/screenY/scale. Calibrated from
  // two direct visual observations, not re-derived from projection math a
  // third time: +0.5 (i.e. originalTY+1, the tile's south/front edge)
  // read as the tile's TOP edge; +1.0 (originalTY+1.5) read as the tile's
  // BOTTOM edge. Since those two values bracket the tile and land on its
  // two edges, their average -- +0.75 (originalTY+1.25) -- should land on
  // the tile's MIDDLE, which is what we actually want. If this still
  // isn't centred, the discrepancy is probably a full-tile-scale issue
  // elsewhere, not a fraction to keep splitting.
  static TRUNK_ROW_ANCHOR_OFFSET = 0.75

  constructor(scene, options = {}) {
    this.scene = scene
    this._sw = scene.game.canvas.width
    this._sh = scene.game.canvas.height

    this._trunkKeepChance   = options.trunkKeepChance ?? ForestEffects.TRUNK_KEEP_CHANCE
    this._widthScale        = options.widthScale      ?? 1.0
    this._heightScale       = options.heightScale     ?? 1.0
    this._canopyHazeEnabled = options.canopyHaze      ?? true
    this._canopyFacetScale  = options.canopyFacetScale  ?? 1.0
    this._canopyLayerScale  = options.canopyLayerScale  ?? 1.0
    this._canopyRadiusScale = options.canopyRadiusScale ?? 1.0

    // ── Canopy-mass cells (wallMask value 2) ─────────────────────────
    // Cells marked 2 in the wallMask render as pure trunk-less foliage
    // mounds sitting on the ground line -- "the forest's canopy seen from
    // outside": e.g. the a4-d4 threshold band, where what should rise from
    // the bottom of the screen as the camera nears the forest is masses of
    // leaves, not a colonnade of trunks. They block movement exactly like
    // value-1 cells. Radius is tile-based (independent of widthScale) and
    // clamped to a fraction of the screen height so near-camera masses
    // stack as mounds instead of whiting out the whole view.
    this._canopyMassRadiusTiles   = options.canopyMassRadiusTiles   ?? 2.2
    this._canopyMassMaxScreenFrac = options.canopyMassMaxScreenFrac ?? 0.4
    this._branchScale       = options.branchScale       ?? 1.0

    // This canvas is now ONLY used for canopy haze + exit markers --
    // full-screen/atmospheric effects with no per-tile occlusion needs.
    // Trunks are drawn by PGR directly onto its own _gCtx (see drawTrunk()).
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

    this._canopyPattern = this._bakeCanopyPattern()
    this._leafTextures = this._loadLeafTextures()
    this._trunks = this._bakeTrunkShapesFromMask()

    // Row index for PGR to query cheaply during its own per-row loop.
    // trunk.ty is tile-centre (originalTY + 0.5); floor gives the real
    // tile row the trunk's wallMask cell occupies.
    this._trunksByRow = new Map()
    for (const trunk of this._trunks) {
      const row = Math.floor(trunk.ty)
      if (!this._trunksByRow.has(row)) this._trunksByRow.set(row, [])
      this._trunksByRow.get(row).push(trunk)
    }

    // North-direction map preview (see PerspectiveGroundRenderer's
    // setNorthNeighbor/_drawNorthPreviewRow) -- empty until the scene
    // calls setNorthNeighborWallMask() with the north neighbour's data,
    // if any. Purely visual: these trunks live at NEGATIVE world rows,
    // are never collided with, and are only ever drawn by the dedicated
    // preview path, faded toward the horizon.
    this._northPreviewTrunksByRow = new Map()

    console.log('[ForestEffects] constructed -', this._sw, 'x', this._sh, '-', this._trunks.length, 'trunk clusters -- trunkKeepChance:', this._trunkKeepChance, '-- widthScale:', this._widthScale, 'heightScale:', this._heightScale, 'canopyHaze:', this._canopyHazeEnabled, '-- canopyFacetScale:', this._canopyFacetScale, 'canopyLayerScale:', this._canopyLayerScale, 'canopyRadiusScale:', this._canopyRadiusScale, '-- branchScale:', this._branchScale)
  }

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

  _bakeTrunkShapesFromMask() {
    const mask = this.scene.mapData?.wallMask
    if (!mask) {
      console.warn('[ForestEffects] no mapData.wallMask found -- no trunks will render')
      return []
    }
    const mapH = mask.length
    const mapW = mask[0]?.length ?? 0
    const isWall = (x, y) => (y >= 0 && y < mapH && x >= 0 && x < mapW) ? mask[y][x] >= 1 : true

    const layer0 = this.scene.mapData?.layers?.[0]
    const isWater = (x, y) => {
      const gid = layer0?.[y]?.[x]
      return gid === 1625 || gid === 1679
    }

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
        if (isWater(tx, ty)) continue
        const bordersOpen =
          !isWall(tx + 1, ty) || !isWall(tx - 1, ty) ||
          !isWall(tx, ty + 1) || !isWall(tx, ty - 1)
        if (!bordersOpen) continue
        if (cellKeepValue(tx, ty) > this._trunkKeepChance) continue
        positions.push([tx + 0.5, ty + 0.5, mask[ty][tx] === 2])
      }
    }
    return positions.map(([tx, ty, mass]) => this._buildTrunkShape(tx, ty, mass))
  }

  _buildTrunkShape(tx, ty, canopyMass = false) {
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

        const branchCount = rand() < species.branchChance ? (1 + Math.floor(rand() * 2)) : 0
        const branches = []
        for (let b = 0; b < branchCount; b++) {
          branches.push({
            at:  0.35 + rand() * 0.5,
            ang: (rand() - 0.5) * 1.3,
            len: 0.9 + rand() * 1.1,
          })
        }

        const stripeCount = ForestEffects.BARK_STRIPE_COUNT_MIN +
          Math.floor(rand() * (ForestEffects.BARK_STRIPE_COUNT_MAX - ForestEffects.BARK_STRIPE_COUNT_MIN + 1))

        strokes.push({ xOffset, curve, heightMul, widthMul, branches, stripeCount })
      }

      const layerCount = Math.max(1, Math.round((ForestEffects.CAP_LAYER_COUNT_MIN +
        Math.floor(rand() * (ForestEffects.CAP_LAYER_COUNT_MAX - ForestEffects.CAP_LAYER_COUNT_MIN + 1))) * this._canopyLayerScale))
      const capLayers = []
      for (let layer = 0; layer < layerCount; layer++) {
        const layerYOffset = -layer * ForestEffects.CAP_LAYER_SPACING
        const layerScale = 1.0 - layer * 0.12

        const facetCount = Math.max(2, Math.round((ForestEffects.CAP_FACET_COUNT_MIN +
          Math.floor(rand() * (ForestEffects.CAP_FACET_COUNT_MAX - ForestEffects.CAP_FACET_COUNT_MIN + 1))) * this._canopyFacetScale))
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
      const capFacets = capLayers.flat()

      return { tx, ty, canopyMass, species, strokes, capFacets, capLayers }
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

  get ctx() { return this._ctx }
  get width() { return this._sw }
  get height() { return this._sh }

  // Still called each frame by the scene (unchanged contract) -- now only
  // handles canvas resize-sync, exit markers, undergrowth, and canopy
  // haze. Trunk drawing has moved to PGR (see drawTrunk()/getTrunksForRow()
  // below, called from PerspectiveGroundRenderer.update()).
  update() {

    const pgr = this.scene.perspectiveGround
    if (!pgr) return

    const groundCanvas = document.getElementById('pgr-ground')
    if (groundCanvas) {
      if (groundCanvas.width !== this._sw || groundCanvas.height !== this._sh) {
        this._sw = groundCanvas.width
        this._sh = groundCanvas.height
        this._canvas.width  = this._sw
        this._canvas.height = this._sh
      }
      if (this._canvas.style.width  !== groundCanvas.style.width ||
          this._canvas.style.height !== groundCanvas.style.height) {
        this._canvas.style.width  = groundCanvas.style.width
        this._canvas.style.height = groundCanvas.style.height
      }
    }

    const sw = this._sw, sh = this._sh
    const ctx = this._ctx

    ctx.clearRect(0, 0, sw, sh)

    // _drawExitMarkers() call removed -- the solid red rectangle it draws
    // over every exit tile was fine at the old 5-tile-wide exit slice, but
    // with most borders now spanning the map's whole edge (34 tiles) it
    // rendered as a glaring red stripe across nearly the entire boundary.
    // Method left defined below (unused) in case a narrower, more
    // deliberate indicator is wanted later.

    if (this.undergrowthRenderer) {
      this.undergrowthRenderer.update(pgr, sw, sh)
    }

    if (this._canopyHazeEnabled) this._drawCanopyHaze(sw, sh)
  }

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

    let seed = 8821
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }

    hctx.save()
    hctx.beginPath()
    hctx.rect(0, 0, sw, bandH)
    hctx.clip()

    const baseGrad = hctx.createLinearGradient(0, 0, 0, bandH)
    baseGrad.addColorStop(0,   ForestEffects.HAZE_BRIGHT_COLOR)
    baseGrad.addColorStop(0.5, ForestEffects.HAZE_MID_COLOR)
    baseGrad.addColorStop(1,   ForestEffects.HAZE_DARK_COLOR)
    hctx.fillStyle = baseGrad
    hctx.fillRect(0, 0, sw, bandH)

    for (let i = 0; i < ForestEffects.HAZE_BLOB_COUNT; i++) {
      const x = rand() * sw
      const yBias = rand() * rand()
      const y = yBias * bandH
      const r = sw * (0.08 + rand() * 0.16)
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

  // NOT called from update() -- left defined in case another forest
  // scene reusing this class still wants the dark unwalkable-tile tint.
  _drawWallFloorTint(pgr) {
    const mask = this.scene.mapData?.wallMask
    if (!mask) return
    const ctx = this._ctx
    const mapH = mask.length
    const mapW = mask[0]?.length ?? 0

    const layer0 = this.scene.mapData?.layers?.[0]
    const isWater = (x, y) => {
      const gid = layer0?.[y]?.[x]
      return gid === 1625 || gid === 1679
    }

    const horizonPx = pgr._horizonPx?.() ?? 0
    const tileDisplaySize = pgr.tileDisplaySize ?? 48
    const sh = this._sh

    for (let ty = 0; ty < mapH; ty++) {
      for (let tx = 0; tx < mapW; tx++) {
        if (mask[ty][tx] !== 1) continue
        if (isWater(tx, ty)) continue

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

  static BAKE_REFERENCE_RADIUS_PX = 80

  _bakeCapForTrunk(trunk, pgr) {
    const R = ForestEffects.BAKE_REFERENCE_RADIUS_PX
    const canvas = document.createElement('canvas')
    const padX     = R * 1.6
    const padTop   = R * (1.0 + ForestEffects.CAP_LAYER_SPACING * (ForestEffects.CAP_LAYER_COUNT_MAX - 1) + 0.6)
    const padBottom= R * 0.7
    canvas.width  = Math.ceil(padX * 2)
    canvas.height = Math.ceil(padTop + padBottom)
    const bctx = canvas.getContext('2d')
    const cx = padX, cy = padTop

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

    // Per-position colour variation, same tintManager path the old Oryx
    // tree stamps used ('vegetation' category -- hue/sat/lightness hashed
    // per tile position). Baked once here, not per-frame.
    const tint = pgr?.tintManager?.getTint?.(
      ForestEffects.TINT_LOOKUP_GID, Math.floor(trunk.tx), Math.floor(trunk.ty)
    )
    if (tint) {
      bctx.save()
      bctx.globalCompositeOperation = 'source-atop'
      bctx.globalAlpha = tint.alpha ?? 0.5
      bctx.fillStyle = `hsl(${tint.h},${tint.s}%,${tint.l}%)`
      bctx.fillRect(0, 0, canvas.width, canvas.height)
      bctx.restore()
    }

    trunk._cachedCapCanvas = canvas
    trunk._cachedCapAnchorX = cx
    trunk._cachedCapAnchorY = cy
    trunk._cachedCapW = canvas.width
    trunk._cachedCapH = canvas.height
    trunk._cachedCapTextureCount = loadedTextures.length
  }

  // ctx now passed explicitly (was this._ctx) -- PGR calls this with its
  // own _gCtx so the cap draws on the ground canvas alongside cliffs.
  _drawFoliageCap(ctx, trunk, screenX, topY, widthPx, alpha, pgr, radiusOverride = null) {
    const capRadius = radiusOverride ?? (widthPx * ForestEffects.CAP_RADIUS_WIDTH_MUL * this._canopyRadiusScale)
    if (!(capRadius > 0)) return

    const loadedCount = this._leafTextures?.filter(t => t != null).length ?? 0
    if (!trunk._cachedCapCanvas || trunk._cachedCapTextureCount !== loadedCount) {
      this._bakeCapForTrunk(trunk, pgr)
    }

    const capAnchorY = topY - capRadius * ForestEffects.CAP_HEIGHT_OFFSET_MUL
    const R = ForestEffects.BAKE_REFERENCE_RADIUS_PX
    const scaleFactor = capRadius / R
    const drawW = trunk._cachedCapW * scaleFactor
    const drawH = trunk._cachedCapH * scaleFactor
    const drawX = screenX    - trunk._cachedCapAnchorX * scaleFactor
    const drawY = capAnchorY - trunk._cachedCapAnchorY * scaleFactor

    if (trunk._swayPhase == null) {
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

  // Tapered, slightly curved branch -- filled shape (thick at the trunk,
  // narrow at the tip), not a constant-width stroke. See v5 header note
  // for why the old straight, half-trunk-width stroke read as a girder.
  // ctx now passed explicitly (was this._ctx).
  _drawBranch(ctx, baseX, baseY, ang, len, colorDark) {
    const endX = baseX + Math.sin(ang) * len
    const endY = baseY - Math.cos(ang) * len

    const baseWidth = Math.max(0.6, len * 0.09)   // proportion to length, not trunk width
    const tipWidth  = baseWidth * ForestEffects.BRANCH_TIP_WIDTH_FRAC

    const dx = endX - baseX, dy = endY - baseY
    const segLen = Math.hypot(dx, dy) || 1
    const nx = -dy / segLen, ny = dx / segLen

    // Slight sideways bow, direction derived from the branch's own angle
    // (deterministic, no extra random state needed) so it curves away
    // from straight without looking arbitrary.
    const bow = segLen * ForestEffects.BRANCH_CURVE_FRAC * (ang >= 0 ? 1 : -1)
    const midX = (baseX + endX) / 2 + nx * bow
    const midY = (baseY + endY) / 2 + ny * bow

    ctx.fillStyle = colorDark
    ctx.beginPath()
    ctx.moveTo(baseX - nx * baseWidth / 2, baseY - ny * baseWidth / 2)
    ctx.quadraticCurveTo(midX - nx * tipWidth, midY - ny * tipWidth, endX, endY)
    ctx.quadraticCurveTo(midX + nx * tipWidth, midY + ny * tipWidth, baseX + nx * baseWidth / 2, baseY + ny * baseWidth / 2)
    ctx.closePath()
    ctx.fill()
  }

  /**
   * Trunks anchored to the given integer tile row, in the same order they
   * were baked (typically only a handful per row, so no extra sort is
   * needed -- PGR's own per-row loop already provides the correct
   * far-to-near draw order at the row level).
   */
  getTrunksForRow(row) {
    return this._trunksByRow.get(row) ?? []
  }

  /**
   * Bakes trunk shapes for the map's NORTH NEIGHBOUR (see
   * PerspectiveScene's north-preview fetch and PGR's setNorthNeighbor/
   * _drawNorthPreviewRow), so a fading glimpse of trees beyond the
   * current map's north edge can be drawn. Purely visual -- these trunks
   * are indexed by NEGATIVE world row (the neighbour's own row `r`, out
   * of `neighborHeight` local rows, maps to world row `r - neighborHeight`,
   * so its southmost row -- immediately adjacent to our row 0 -- lands at
   * world row -1). Reuses the exact same per-cell hash/border logic as
   * the current map's own trunk baking, just sourced from a different
   * wallMask and shifted into negative-row space.
   *
   * @param {number[][]|null} wallMask   -- the neighbour's wallMask, or
   *   null/undefined to clear any existing preview (e.g. if the neighbour
   *   has no wallMask at all, such as b1's empty fields).
   * @param {number} neighborHeight      -- the neighbour's own tile height
   */
  setNorthNeighborWallMask(wallMask, neighborHeight) {
    this._northPreviewTrunksByRow = new Map()
    if (!wallMask || !neighborHeight) return

    const mapH = wallMask.length
    const mapW = wallMask[0]?.length ?? 0
    const isWall = (x, y) => (y >= 0 && y < mapH && x >= 0 && x < mapW) ? wallMask[y][x] >= 1 : true
    const cellKeepValue = (x, y) => {
      let h = (x * 374761393 + y * 668265263) | 0
      h = Math.imul(h ^ (h >>> 13), 1274126177)
      h = (h ^ (h >>> 16)) >>> 0
      return h / 0xffffffff
    }

    for (let ty = 0; ty < mapH; ty++) {
      for (let tx = 0; tx < mapW; tx++) {
        if (!isWall(tx, ty)) continue
        const bordersOpen =
          !isWall(tx + 1, ty) || !isWall(tx - 1, ty) ||
          !isWall(tx, ty + 1) || !isWall(tx, ty - 1)
        if (!bordersOpen) continue
        if (cellKeepValue(tx, ty) > this._trunkKeepChance) continue

        const worldTy = (ty + 0.5) - neighborHeight
        const trunk = this._buildTrunkShape(tx + 0.5, worldTy, wallMask[ty][tx] === 2)
        const row = Math.floor(worldTy)
        if (!this._northPreviewTrunksByRow.has(row)) this._northPreviewTrunksByRow.set(row, [])
        this._northPreviewTrunksByRow.get(row).push(trunk)
      }
    }
  }

  getNorthPreviewTrunksForRow(row) {
    return this._northPreviewTrunksByRow.get(row) ?? []
  }

  /**
   * Shared screen-anchor computation for a trunk -- used by BOTH drawTrunk()
   * and getTrunkScreenBounds() below, so the two can never drift apart the
   * way position math has already drifted twice in this file's history.
   * Returns null if the trunk is off-screen or the row can't be projected.
   */
  _computeTrunkAnchor(trunk, pgr) {
    // A missing pgr should not take the whole render loop down -- the
    // existing ?. calls below guard the CALLS but not the property reads,
    // so an undefined pgr still threw. One frame of missing trunks is a
    // far better failure than a dead scene.
    if (!pgr || !trunk) return null
    const anchorRow = trunk.ty + ForestEffects.TRUNK_ROW_ANCHOR_OFFSET

    const baseScreenY = pgr._rowToScreenY?.(anchorRow)
    const scale       = pgr._scaleAtRow?.(anchorRow)
    if (baseScreenY == null || !(scale > 0)) return null

    const screenX = pgr._colToScreenX?.(trunk.tx, anchorRow)
    if (screenX == null) return null

    const groundRow = Math.floor(trunk.ty + 1)
    const hLeft  = pgr._vertexH?.(Math.floor(trunk.tx),     groundRow) ?? 0
    const hRight = pgr._vertexH?.(Math.floor(trunk.tx) + 1, groundRow) ?? 0
    const groundHeightTiles = (hLeft + hRight) * 0.5
    const screenY = baseScreenY - groundHeightTiles * scale

    if (screenX < -200 || screenX > this._sw + 200) return null
    if (screenY < -200 || screenY > this._sh + 200) return null

    const widthPx  = ForestEffects.TRUNK_BASE_WIDTH_TILES  * scale * this._widthScale
    const heightPx = ForestEffects.TRUNK_BASE_HEIGHT_TILES * scale * this._heightScale

    return { screenX, screenY, scale, widthPx, heightPx }
  }

  /**
   * Screen-space bounds for a trunk's rendered silhouette (trunk + canopy),
   * for precise occlusion checks (e.g. "does the player's actual screen
   * position fall inside this tree," not just "is a tree nearby in tile
   * space"). Mirrors the same geometry drawTrunk() actually draws, via the
   * shared _computeTrunkAnchor() above.
   *
   * @returns {{screenX:number, capRadius:number, topY:number, footY:number}|null}
   */
  getTrunkScreenBounds(trunk, pgr) {
    const anchor = this._computeTrunkAnchor(trunk, pgr)
    if (!anchor) return null
    const { screenX, screenY, widthPx, heightPx } = anchor

    // Canopy masses: bounds mirror the ground-anchored, clamped-radius cap
    // drawn by drawTrunk()'s canopyMass branch.
    if (trunk.canopyMass) {
      const rawR = anchor.scale * this._canopyMassRadiusTiles
      const capRadius = Math.min(rawR, this._sh * this._canopyMassMaxScreenFrac)
      return {
        screenX, capRadius,
        topY:  screenY - capRadius * (1 + ForestEffects.CAP_HEIGHT_OFFSET_MUL),
        footY: screenY,
      }
    }

    const capRadius = widthPx * ForestEffects.CAP_RADIUS_WIDTH_MUL * this._canopyRadiusScale
    const trunkTopY = screenY - heightPx
    // Canopy extends upward from the trunk top by roughly capRadius,
    // offset slightly by CAP_HEIGHT_OFFSET_MUL (see _drawFoliageCap) --
    // generous but not exact, adequate for an occlusion test rather than
    // pixel-perfect hit-testing.
    const topY = trunkTopY - capRadius
    const footY = screenY + widthPx * ForestEffects.TRUNK_UNDERGROUND_EXTEND_PX_MUL

    return { screenX, capRadius, topY, footY }
  }

  /**
   * Draw a single trunk onto the given context. Called by
   * PerspectiveGroundRenderer from inside its own per-row loop, passing
   * its _gCtx -- NOT called from this class's own update() any more.
   *
   * @param {CanvasRenderingContext2D} ctx        -- PGR's _gCtx
   * @param {object} trunk                        -- from getTrunksForRow()
   * @param {PerspectiveGroundRenderer} pgr
   * @param {number} playerTileRow                -- for the south-fade-near-player effect
   * @param {number} [extraAlpha]                  -- additional multiplier, e.g. the
   *   north-preview's horizon fade. Defaults to 1 (no change) for normal calls.
   */
  drawTrunk(ctx, trunk, pgr, playerTileRow, extraAlpha = 1) {
    const fadeRangeTiles = ForestEffects.SOUTH_FADE_RANGE_TILES
    const minAlpha = ForestEffects.SOUTH_FADE_MIN_ALPHA

    const anchor = this._computeTrunkAnchor(trunk, pgr)
    if (!anchor) return
    const { screenX, screenY, widthPx, heightPx } = anchor

    let alpha = 1.0
    const southDist = trunk.ty - playerTileRow
    if (southDist > 0 && southDist < fadeRangeTiles) {
      const t = 1 - southDist / fadeRangeTiles
      alpha = 1 - t * (1 - minAlpha)
    }
    alpha *= extraAlpha

    ctx.globalAlpha = alpha

    // Canopy-mass cells (wallMask 2): no trunk, no branches -- just the
    // foliage cap sitting on the ground line, radius tile-based and clamped
    // so near-camera masses read as stacked mounds of leaves rather than
    // one full-screen sheet.
    if (trunk.canopyMass) {
      const rawR = anchor.scale * this._canopyMassRadiusTiles
      const capRadius = Math.min(rawR, this._sh * this._canopyMassMaxScreenFrac)
      this._drawFoliageCap(ctx, trunk, screenX, screenY, 0, alpha, pgr, capRadius)
      ctx.globalAlpha = 1.0
      return
    }

    const groundY = screenY + widthPx * ForestEffects.TRUNK_UNDERGROUND_EXTEND_PX_MUL

    for (const s of trunk.strokes) {
      const w = widthPx * s.widthMul
      const h = heightPx * s.heightMul
      const baseX = screenX + s.xOffset * widthPx
      const topX  = baseX + s.curve * w * 3
      const topY  = screenY - h
      const midX  = (baseX + topX) / 2 + s.curve * w * 1.5
      const midY  = (screenY + topY) / 2

      ctx.fillStyle = trunk.species.colorDark
      ctx.beginPath()
      ctx.moveTo(baseX - w / 2, groundY)
      ctx.quadraticCurveTo(midX - w / 4, midY, topX - w / 8, topY)
      ctx.lineTo(topX + w / 8, topY)
      ctx.quadraticCurveTo(midX + w / 4, midY, baseX + w / 2, groundY)
      ctx.closePath()
      ctx.fill()

      this._drawBarkStriations(ctx, baseX, groundY, topX, topY, midX, midY, w, s.stripeCount)

      ctx.strokeStyle = trunk.species.colorRim
      ctx.lineWidth = Math.max(1, w * 0.12)
      ctx.beginPath()
      ctx.moveTo(baseX - w / 2, groundY)
      ctx.quadraticCurveTo(midX - w / 4, midY, topX - w / 8, topY)
      ctx.stroke()

      if (this._branchScale > 0.001) {
        for (const br of s.branches) {
          const branchBaseX = baseX + (topX - baseX) * br.at
          const branchBaseY = screenY + (topY - screenY) * br.at
          const len = w * ForestEffects.BRANCH_LENGTH_MUL * br.len * this._branchScale
          this._drawBranch(ctx, branchBaseX, branchBaseY, br.ang, len, trunk.species.colorDark)
        }
      }
    }

    if (ForestEffects.CANOPY_ENABLED) {
      const topY = screenY - heightPx
      this._drawFoliageCap(ctx, trunk, screenX, topY, widthPx, alpha, pgr)
    }

    ctx.globalAlpha = 1.0
  }

  _drawBarkStriations(ctx, baseX, baseY, topX, topY, midX, midY, w, stripeCount) {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(baseX - w / 2, baseY)
    ctx.quadraticCurveTo(midX - w / 4, midY, topX - w / 8, topY)
    ctx.lineTo(topX + w / 8, topY)
    ctx.quadraticCurveTo(midX + w / 4, midY, baseX + w / 2, baseY)
    ctx.closePath()
    ctx.clip()

    for (let i = 0; i < stripeCount; i++) {
      const frac = (i + 0.5) / stripeCount
      const sBaseX = baseX - w / 2 + frac * w
      const sTopX  = topX  - w / 8 + frac * (w / 4)
      const sMidX  = midX  - w / 4 + frac * (w / 2)
      ctx.strokeStyle = (i % 2 === 0) ? ForestEffects.BARK_STRIPE_DARK : ForestEffects.BARK_STRIPE_LIGHT
      ctx.lineWidth = Math.max(1, w * 0.035)
      ctx.beginPath()
      ctx.moveTo(sBaseX, baseY)
      ctx.quadraticCurveTo(sMidX, midY, sTopX, topY)
      ctx.stroke()
    }

    ctx.restore()
  }

  destroy() {
    console.log('[ForestEffects] destroy() called -- canvas present:', !!this._canvas,
      'has parent:', !!this._canvas?.parentNode)
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


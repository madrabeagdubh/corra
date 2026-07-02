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
// _drawTrunks itself -- see history in prior versions of this file for
// why screen-space bands and standalone patches were tried and abandoned.
//
// ── Terrain contour driven entirely by tree roots ────────────────────────────
// Each tree raises a real peak in the heightMap (see
// _raiseGroundPeaksForTrunks) with a small flat PLATEAU at full height
// right around the tree (ROOT_PEAK_PLATEAU_RADIUS_TILES), so the mound
// doesn't need pixel-perfect alignment with wherever the trunk's own
// height sample point happens to land -- see the plateau comment on that
// method for why. Map-level authored hills (the old CONFIG.bumps in the
// generator) should stay scrapped -- tree-root peaks are the ONLY source
// of terrain elevation on this map.
//
// ── Trunk sinks into the ground (current fix for the "floating" look) ────────
// Even with the plateau, small gaps between the visible ground and the
// trunk's drawn base persisted in review -- chasing pixel-perfect
// alignment between the terrain sample point and the trunk's anchor
// turned out to be a losing battle. Instead, the trunk's drawn shape now
// extends PAST its ground anchor point by TRUNK_UNDERGROUND_EXTEND_PX_MUL
// (relative to trunk width) -- the top of the trunk is unaffected (so
// canopy height/position stays correct), but the bottom is pushed further
// down-screen than the true ground point, burying it. Any small mismatch
// between terrain and anchor is now irrelevant, since the trunk always
// overlaps the ground by a guaranteed margin rather than needing to land
// exactly on it.
//
// ── What this does ────────────────────────────────────────────────────────────
// Renders trunk clusters (species-varied stroke shapes, bark striations,
// a real root-driven terrain peak, ground-sunk trunk bases, and a soft
// mottled foliage cap) derived live from scene.mapData.wallMask. A soft
// player-centred cutout keeps the player's own sprite from ever being
// fully obscured by a nearby trunk/cap -- flagged separately as needing
// its own revisit, not addressed in this pass.
//
// ── What this does NOT do yet ─────────────────────────────────────────────────
//   • Does not touch PerspectiveGroundRenderer source at all
//   • Does not know about tile GIDs, walls, or collision
//   • Does not manage its own update loop -- the owning scene calls update()
//     once per frame, same as it already does for perspectiveGround.update()
//   • Bark striations are a cheap procedural approximation, not real
//     bark texture.
//   • Player-visibility punch-hole is known to look wrong; deferred.
//   • No vegetation/undergrowth pass in this version -- deliberately
//     deferred until the root/elevation look is confirmed working.
//
// ── Usage ─────────────────────────────────────────────────────────────────────
//   import ForestEffects from '../../effects/forestEffects.js'
//   this.forestEffects = new ForestEffects(this)
//   this.forestEffects.update()   // each frame, after perspectiveGround.update()
//   if (this.forestEffects) { this.forestEffects.destroy(); this.forestEffects = null }   // shutdown

export default class ForestEffects {

  static HOLE_RADIUS_FRAC = 0.11
  static HOLE_INNER_FRAC = 0.15

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

  // How far the trunk's DRAWN shape extends below its true ground anchor
  // point, relative to the trunk's own on-screen width -- see file header
  // "Trunk sinks into the ground." Purely visual burial; does not affect
  // canopy height/position (topY is computed independently, see
  // _drawTrunks).
  static TRUNK_UNDERGROUND_EXTEND_PX_MUL = 0.8

  // ── Bark striations ───────────────────────────────────────────────────────────
  static BARK_STRIPE_COUNT_MIN = 5
  static BARK_STRIPE_COUNT_MAX = 9
  static BARK_STRIPE_DARK  = 'rgba(0, 0, 0, 0.2)'
  static BARK_STRIPE_LIGHT = 'rgba(255, 255, 255, 0.09)'

  // ── Tree-root terrain peaks (the sole source of elevation) ───────────────────
  static ROOT_PEAK_RADIUS_TILES = 0.9    // gaussian sigma (falloff region), in tiles
  static ROOT_PEAK_AMPLITUDE    = 0.75   // per-trunk peak height contribution
  static ROOT_PEAK_MAX_ADD      = 1.1    // cap on SUMMED contribution per vertex
  // Radius (in tiles) around each tree that sits at FULL peak height
  // before any falloff begins -- a flat plateau, not a single sharp
  // point. Exists because the trunk's visual anchor and the exact vertex
  // sampled for its height don't line up with pixel precision (an
  // existing quirk in this projection, not introduced by this pass) -- a
  // plateau makes the mound forgiving of that mismatch instead of
  // requiring the peak to land on an exact point.
  static ROOT_PEAK_PLATEAU_RADIUS_TILES = 0.5

  // ── Foliage cap (canopy-on-trunk) ────────────────────────────────────────────
  static CAP_RADIUS_WIDTH_MUL = 2.6
  static CAP_HEIGHT_OFFSET_MUL = 0.35
  static CAP_FACET_COUNT_MIN = 6
  static CAP_FACET_COUNT_MAX = 11
  static CAP_LAYER_COUNT_MIN = 3
  static CAP_LAYER_COUNT_MAX = 5
  static CAP_LAYER_SPACING   = 0.55

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

  constructor(scene, options = {}) {
    this.scene = scene
    this._sw = scene.game.canvas.width
    this._sh = scene.game.canvas.height

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





// Terrain peaks are now baked into the map JSON at generation time
    // (see forest_scatter_gen.mjs's buildTrunkPositions/
    // applyRootPeaksToHeightMap) rather than mutated at runtime here --
    // runtime mutation of scene.mapData.heightMap didn't actually reach
    // PGR's rendering (PGR very likely copies/converts heightMap into
    // its own internal structure during scene setup, before this
    // constructor ever runs). _raiseGroundPeaksForTrunks is left defined
    // below, unused, in case a hand-authored map without pre-baked peaks
    // ever wants runtime baking.

    console.log('[ForestEffects] constructed -', this._sw, 'x', this._sh, '-', this._trunks.length, 'trunk clusters -- trunkKeepChance:', this._trunkKeepChance)
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
        positions.push([tx + 0.5, ty + 0.5])
      }
    }
    return positions.map(([tx, ty]) => this._buildTrunkShape(tx, ty))
  }

  // Mutates scene.mapData.heightMap in place, adding a peak with a flat
  // plateau (full height within ROOT_PEAK_PLATEAU_RADIUS_TILES) around
  // each trunk position, falling off with a gaussian beyond that -- see
  // ROOT_PEAK_PLATEAU_RADIUS_TILES comment for why the plateau exists.
  // Accumulates into a separate buffer first, then applies with a
  // per-vertex cap (ROOT_PEAK_MAX_ADD) so vertices shared by several
  // trunks in a dense cluster blend into one hillock rather than stacking
  // into an unboundedly tall spike.
  _raiseGroundPeaksForTrunks(positions) {
    const hm = this.scene.mapData?.heightMap
    if (!hm) {
      console.warn('[ForestEffects] no heightMap found -- skipping root-driven terrain peaks')
      return
    }
    const vertsH = hm.length
    const vertsW = hm[0]?.length ?? 0
    const sigma = ForestEffects.ROOT_PEAK_RADIUS_TILES
    const amp = ForestEffects.ROOT_PEAK_AMPLITUDE
    const plateau = ForestEffects.ROOT_PEAK_PLATEAU_RADIUS_TILES
    const reach = Math.ceil((sigma + plateau) * 2.5)

    const add = Array.from({ length: vertsH }, () => new Array(vertsW).fill(0))

    for (const [tx, ty] of positions) {
      const vx0 = Math.max(0, Math.floor(tx - reach))
      const vx1 = Math.min(vertsW - 1, Math.ceil(tx + reach))
      const vy0 = Math.max(0, Math.floor(ty - reach))
      const vy1 = Math.min(vertsH - 1, Math.ceil(ty + reach))
      for (let vy = vy0; vy <= vy1; vy++) {
        for (let vx = vx0; vx <= vx1; vx++) {
          const d = Math.sqrt((vx - tx) ** 2 + (vy - ty) ** 2)
          const g = d <= plateau
            ? 1
            : Math.exp(-((d - plateau) ** 2) / (2 * sigma * sigma))
          add[vy][vx] += amp * g
        }
      }
    }

    let mutated = 0
    for (let vy = 0; vy < vertsH; vy++) {
      for (let vx = 0; vx < vertsW; vx++) {
        if (add[vy][vx] <= 0) continue
        hm[vy][vx] = hm[vy][vx] + Math.min(add[vy][vx], ForestEffects.ROOT_PEAK_MAX_ADD)
        mutated++
      }
    }
    console.log('[ForestEffects] raised', mutated, 'heightMap vertices for', positions.length, 'tree-root peaks')
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

      const layerCount = ForestEffects.CAP_LAYER_COUNT_MIN +
        Math.floor(rand() * (ForestEffects.CAP_LAYER_COUNT_MAX - ForestEffects.CAP_LAYER_COUNT_MIN + 1))
      const capLayers = []
      for (let layer = 0; layer < layerCount; layer++) {
        const layerYOffset = -layer * ForestEffects.CAP_LAYER_SPACING
        const layerScale = 1.0 - layer * 0.12

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

    // _drawWallFloorTint intentionally NOT called -- unwalkable cells are
    // communicated by trees alone. Method left defined below in case
    // another forest scene reusing this class still wants it.
    this._drawExitMarkers(pgr)

    if (this.undergrowthRenderer) {
      this.undergrowthRenderer.update(pgr, sw, sh)
    }

    this._drawCanopyHaze(sw, sh)
    this._drawTrunks(pgr, playerTileY)

    // Player-visibility punch-hole: known to look wrong, deliberately
    // left unchanged in this pass -- revisit separately.
    const radius = Math.sqrt(sw * sw + sh * sh) * ForestEffects.HOLE_RADIUS_FRAC
    this._punchHole(px, py, radius, ForestEffects.HOLE_INNER_FRAC)
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

  // NOT called from update() anymore -- see comment at the call site.
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

  _bakeCapForTrunk(trunk) {
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

    trunk._cachedCapCanvas = canvas
    trunk._cachedCapAnchorX = cx
    trunk._cachedCapAnchorY = cy
    trunk._cachedCapW = canvas.width
    trunk._cachedCapH = canvas.height
    trunk._cachedCapTextureCount = loadedTextures.length
  }

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

  _drawTrunks(pgr, playerTileY) {
    const ctx = this._ctx
    const fadeRangeTiles = ForestEffects.SOUTH_FADE_RANGE_TILES
    const minAlpha = ForestEffects.SOUTH_FADE_MIN_ALPHA

    const sortedTrunks = [...this._trunks].sort((a, b) => a.ty - b.ty)

    for (const trunk of sortedTrunks) {
      const baseScreenY = pgr._rowToScreenY?.(trunk.ty + 1)
      const scale       = pgr._scaleAtRow?.(trunk.ty + 1)
      if (baseScreenY == null || !(scale > 0)) continue

      const screenX = pgr._colToScreenX?.(trunk.tx + 0.5, trunk.ty + 1)
      if (screenX == null) continue

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

      // Ground-sink: the drawn shape's BASE extends this far past the
      // true ground anchor (screenY), burying it. topY below is computed
      // from the original screenY, NOT groundY, so canopy height/position
      // is unaffected -- only the visible bottom moves.
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

        this._drawBarkStriations(baseX, groundY, topX, topY, midX, midY, w, s.stripeCount)

        ctx.strokeStyle = trunk.species.colorRim
        ctx.lineWidth = Math.max(1, w * 0.12)
        ctx.beginPath()
        ctx.moveTo(baseX - w / 2, groundY)
        ctx.quadraticCurveTo(midX - w / 4, midY, topX - w / 8, topY)
        ctx.stroke()

        for (const br of s.branches) {
          const branchBaseX = baseX + (topX - baseX) * br.at
          const branchBaseY = screenY + (topY - screenY) * br.at
          const branchEndX  = branchBaseX + Math.sin(br.ang) * w * 4 * br.len
          const branchEndY  = branchBaseY - Math.cos(br.ang) * w * 3 * br.len
          ctx.strokeStyle = trunk.species.colorDark
          ctx.lineWidth = Math.max(1.5, w * 0.5)
          ctx.beginPath()
          ctx.moveTo(branchBaseX, branchBaseY)
          ctx.lineTo(branchEndX, branchEndY)
          ctx.stroke()
        }
      }

      if (ForestEffects.CANOPY_ENABLED) {
        const topY = screenY - heightPx
        this._drawFoliageCap(trunk, screenX, topY, widthPx, alpha)
      }
    }
    ctx.globalAlpha = 1.0
  }

  _drawBarkStriations(baseX, baseY, topX, topY, midX, midY, w, stripeCount) {
    const ctx = this._ctx
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

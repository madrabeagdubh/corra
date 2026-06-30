// undergrowthRenderer.js
// Location: js/game/effects/undergrowthRenderer.js
//
// ── Purpose ───────────────────────────────────────────────────────────────────
// Renders scene.mapData.wallMask cells as discrete textured 3D-ish box
// obstacles (rocks, root tangles, bramble clumps) -- giving the existing
// unwalkable cells real physical presence instead of the flat dark tint
// ForestEffects currently paints over them.
//
// ── Why this is NOT built on ElevationRenderer ──────────────────────────────────
// ElevationRenderer's _buildElevationMap() is a PLATEAU detector: it scans
// each map column for a single north/south cliff edge (a row where an
// elevatedGid tile borders a cliffSouth tile) and elevates everything
// between that edge and the map boundary. That model fits buildings and
// terraced terrain -- one or two big contiguous raised regions per map --
// but does NOT fit scattered, irregular, single-cell obstacles with no
// consistent edge to detect. Forcing wallMask's scattered blobs through
// that algorithm would very likely produce wrong/undefined results rather
// than "lots of small bumps." This module reimplements just the piece we
// actually need (project a tile position + height into a textured box via
// PGR's own projection math) without any plateau/cliff-edge logic at all.
//
// ── What this does ────────────────────────────────────────────────────────────
// For every wallMask cell, draws a simple box: one top-face trapezoid plus
// one front-face (south-facing) trapezoid, projected through PGR's
// _rowToScreenY/_colToScreenX/_scaleAtRow -- the same functions
// ForestEffects already uses for trunks, so boxes move/scale identically
// to everything else in the scene with no separate sync problem.
//
// Each cell's height/footprint/texture-variant is derived deterministically
// from REGIONAL zones (coarse blocks of the map, currently 4x4 tiles) so
// nearby obstacles read as belonging to the same "kind" of undergrowth
// (a rocky patch, a bramble thicket, a root tangle) rather than each cell
// rolling fully independently. Individual cells within a zone still vary
// modestly around that zone's baseline so it doesn't look like a uniform
// stamped grid.
//
// ── What this does NOT do yet ─────────────────────────────────────────────────
//   • Does not use real Oryx tile art -- placeholder procedural textures
//     only, same spirit as forestEffects.js's canopy pattern and the
//     canopy_test.png experiment. Swap in real art/Oryx scatter later.
//   • Does not replace collision -- wallMask already drives isColliding()
//     upstream; this module is purely visual.
//   • Does not yet vary footprint shape beyond width/depth scale -- "mix
//     of full-cell and smaller/irregular" is implemented as a per-cell
//     scale-down factor and offset jitter, not arbitrary polygon shapes.
//
// ── Usage ─────────────────────────────────────────────────────────────────────
//   import UndergrowthRenderer from '../../effects/undergrowthRenderer.js'
//   this.undergrowth = new UndergrowthRenderer(this, ctx)  // shares a canvas ctx
//   // each frame, alongside forestEffects.update():
//   this.undergrowth.update(pgr)
//   // no DOM canvas of its own -- pass in an existing 2D context to draw into
//   // (e.g. ForestEffects' own canvas) to avoid managing another DOM layer.

export default class UndergrowthRenderer {

  // Regional zone size, in tiles. Cells are grouped into REGION_SIZE x
  // REGION_SIZE blocks; each block deterministically picks one "kind" of
  // undergrowth from KINDS below. Smaller = more zone variety per map,
  // larger = bigger contiguous patches of one kind.
  static REGION_SIZE = 4

  // ── Undergrowth kinds ────────────────────────────────────────────────────────
  // Each kind has a baseline height (in tile-height units, same unit
  // ForestEffects' TRUNK_BASE_HEIGHT_TILES uses) and a colour pair (dark
  // fill + lighter rim, same two-tone approach as trunk species) so kinds
  // are visually distinguishable from across the screen, not just by
  // height. heightJitter/footprintJitter are PER-CELL variation ranges
  // applied on top of the zone's baseline.
  static KINDS = {
    rocks: {
      baseHeight: 0.55,
      heightJitter: 0.25,
      footprintMin: 0.55, footprintMax: 0.85,   // fraction of full cell width
      colorTop:  'rgba(96, 92, 84, 0.95)',
      colorFace: 'rgba(58, 54, 48, 0.95)',
      colorSide: 'rgba(42, 39, 34, 0.95)',
      textureKey: 'rocks',
    },
    roots: {
      baseHeight: 0.4,
      heightJitter: 0.2,
      footprintMin: 0.65, footprintMax: 1.0,
      colorTop:  'rgba(64, 46, 28, 0.92)',
      colorFace: 'rgba(40, 28, 16, 0.92)',
      colorSide: 'rgba(28, 19, 10, 0.92)',
      textureKey: 'roots',
    },
    brambles: {
      baseHeight: 0.95,
      heightJitter: 0.35,
      footprintMin: 0.7, footprintMax: 1.05,    // can slightly exceed cell bounds
      colorTop:  'rgba(36, 48, 22, 0.9)',
      colorFace: 'rgba(22, 30, 14, 0.92)',
      colorSide: 'rgba(15, 21, 9, 0.92)',
      textureKey: 'brambles',
    },
  }
  static KIND_KEYS = Object.keys(UndergrowthRenderer.KINDS)

  // ctx: an existing 2D canvas context to draw into (pass ForestEffects'
  // own context to avoid a second DOM canvas layer). scene: the owning
  // Phaser scene, same role as ForestEffects' constructor.
  constructor(scene, ctx, options = {}) {
    this.scene = scene
    this._ctx  = ctx
    // keepChance: fraction of wallMask cells that get an obstacle at all
    // (1.0 = every cell, same as original behaviour). heightScale:
    // multiplier on every kind's baseHeight, for scenes wanting a
    // visually lighter undergrowth presence (e.g. the grove) without
    // touching the shared KINDS config used by other scenes.
    this._keepChance  = options.keepChance  ?? 1.0
    this._heightScale = options.heightScale ?? 1.0
    this._patterns = this._bakeAllPatterns()
    this._obstacles = this._buildObstaclesFromMask()
    console.log('[UndergrowthRenderer] constructed -', this._obstacles.length, 'obstacles -- keepChance:', this._keepChance, 'heightScale:', this._heightScale)
  }

  // Bakes one CanvasPattern per kind, each with a visually distinct
  // procedural texture rather than a flat fill -- same general technique
  // as ForestEffects._bakeCanopyPattern() (deterministic seeded blobs/
  // strokes baked once into an offscreen canvas, then wrapped as a
  // tiling pattern), but each kind gets its OWN shape language rather
  // than reusing one blob style for everything:
  //   rocks    -> angular faceted polygons + small speckle dots
  //   roots    -> long thin streaky strokes, mostly one direction
  //   brambles -> tangled criss-crossing thin lines + small thorns
  // Patterns are baked at the kind's colorTop tone -- side/face shading
  // is then applied per-draw via globalAlpha-based darkening rather than
  // baking three separate pattern variants per kind, which would triple
  // the bake cost for a difference that's primarily about brightness.
  _bakeAllPatterns() {
    const patterns = {}
    for (const key of UndergrowthRenderer.KIND_KEYS) {
      const kind = UndergrowthRenderer.KINDS[key]
      if (key === 'rocks')    patterns[key] = this._bakeRockPattern(kind)
      if (key === 'roots')    patterns[key] = this._bakeRootPattern(kind)
      if (key === 'brambles') patterns[key] = this._bakeBramblePattern(kind)
    }
    return patterns
  }

  _bakeRockPattern(kind) {
    const size = 96
    const tile = document.createElement('canvas')
    tile.width = size; tile.height = size
    const tctx = tile.getContext('2d')

    tctx.fillStyle = kind.colorTop
    tctx.fillRect(0, 0, size, size)

    let seed = 4242
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }

    // Rounded, irregular blob masses -- NOT angular polygons. A first
    // attempt used faceted straight-edged shapes here, which read as
    // cut/dressed stone (deliberate masonry) rather than natural
    // weathered rock -- confirmed via direct feedback ("looks more like
    // an aztec temple"). Natural boulders erode round and lumpy, so this
    // uses overlapping soft-edged blobs (same blob-clip-gradient
    // technique as ForestEffects' canopy) instead of polygons.
    const blobPass = (count, minR, maxR, colorDark, colorLight) => {
      for (let i = 0; i < count; i++) {
        const cx = rand() * size, cy = rand() * size
        const r  = minR + rand() * (maxR - minR)
        const useDark = rand() < 0.55
        tctx.fillStyle = useDark ? colorDark : colorLight
        tctx.beginPath()
        tctx.arc(cx, cy, r, 0, Math.PI * 2)
        tctx.fill()
      }
    }
    // Large lumpy boulder-shadow masses, then smaller highlight blobs on
    // top -- gives a rounded volumetric read rather than a flat speckle.
    blobPass(7, 10, 20, 'rgba(30,28,24,0.32)', 'rgba(150,146,136,0.22)')
    blobPass(10, 5, 11,  'rgba(24,22,18,0.28)', 'rgba(160,156,146,0.2)')

    // Patchy moss/lichen blotches -- irregular soft-edged green-ish
    // patches, deliberately uneven in size/placement (not a uniform
    // speckle) so it reads as organic growth claiming parts of the
    // surface rather than a texture applied everywhere equally.
    const mossSpots = 5 + Math.floor(rand() * 4)
    for (let i = 0; i < mossSpots; i++) {
      const cx = rand() * size, cy = rand() * size
      const r  = 6 + rand() * 14
      const grad = tctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      grad.addColorStop(0,   'rgba(58, 78, 30, 0.55)')
      grad.addColorStop(0.6, 'rgba(48, 66, 26, 0.35)')
      grad.addColorStop(1,   'rgba(48, 66, 26, 0)')
      tctx.fillStyle = grad
      tctx.beginPath()
      tctx.arc(cx, cy, r, 0, Math.PI * 2)
      tctx.fill()
    }

    // Thin crack lines -- fine, irregular, NOT the bold straight facet
    // edges from the previous version. Cracks wander slightly via a
    // jittered multi-segment line rather than one straight stroke.
    tctx.strokeStyle = 'rgba(10,9,7,0.4)'
    tctx.lineWidth = 1
    for (let i = 0; i < 6; i++) {
      let x = rand() * size, y = rand() * size
      tctx.beginPath()
      tctx.moveTo(x, y)
      const segs = 3 + Math.floor(rand() * 3)
      for (let s = 0; s < segs; s++) {
        x += (rand() - 0.5) * 14
        y += (rand() - 0.5) * 14
        tctx.lineTo(x, y)
      }
      tctx.stroke()
    }

    // Fine speckle for close-up grain.
    tctx.fillStyle = 'rgba(0,0,0,0.15)'
    for (let i = 0; i < 60; i++) {
      const x = rand() * size, y = rand() * size, r = 1 + rand() * 2
      tctx.beginPath(); tctx.arc(x, y, r, 0, Math.PI * 2); tctx.fill()
    }

    return this._ctx.createPattern(tile, 'repeat')
  }

  _bakeRootPattern(kind) {
    const size = 96
    const tile = document.createElement('canvas')
    tile.width = size; tile.height = size
    const tctx = tile.getContext('2d')

    tctx.fillStyle = kind.colorTop
    tctx.fillRect(0, 0, size, size)

    let seed = 9119
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }

    // Long thin streaky strokes, loosely one dominant direction --
    // reads as fibrous/woody rather than rocky or leafy.
    for (let i = 0; i < 22; i++) {
      const x0 = rand() * size, y0 = rand() * size
      const ang = Math.PI * 0.5 + (rand() - 0.5) * 0.6   // mostly vertical-ish, some spread
      const len = 20 + rand() * 40
      const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len
      tctx.strokeStyle = rand() < 0.5 ? 'rgba(15,10,4,0.35)' : 'rgba(90,68,40,0.3)'
      tctx.lineWidth = 1.5 + rand() * 2.5
      tctx.beginPath(); tctx.moveTo(x0, y0); tctx.lineTo(x1, y1); tctx.stroke()
    }

    return this._ctx.createPattern(tile, 'repeat')
  }

  _bakeBramblePattern(kind) {
    const size = 96
    const tile = document.createElement('canvas')
    tile.width = size; tile.height = size
    const tctx = tile.getContext('2d')

    tctx.fillStyle = kind.colorTop
    tctx.fillRect(0, 0, size, size)

    let seed = 5577
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }

    // Tangled criss-crossing thin curved lines -- reads as a thicket
    // rather than rock or wood grain.
    for (let i = 0; i < 26; i++) {
      const x0 = rand() * size, y0 = rand() * size
      const ang = rand() * Math.PI * 2
      const len = 10 + rand() * 22
      const cx  = x0 + Math.cos(ang) * len * 0.5 + (rand() - 0.5) * 10
      const cy  = y0 + Math.sin(ang) * len * 0.5 + (rand() - 0.5) * 10
      const x1  = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len
      tctx.strokeStyle = rand() < 0.6 ? 'rgba(10,14,6,0.4)' : 'rgba(70,84,40,0.28)'
      tctx.lineWidth = 1 + rand() * 1.5
      tctx.beginPath()
      tctx.moveTo(x0, y0)
      tctx.quadraticCurveTo(cx, cy, x1, y1)
      tctx.stroke()
    }
    // Small thorn flecks.
    tctx.fillStyle = 'rgba(0,0,0,0.25)'
    for (let i = 0; i < 30; i++) {
      const x = rand() * size, y = rand() * size, r = 0.8 + rand() * 1.2
      tctx.beginPath(); tctx.arc(x, y, r, 0, Math.PI * 2); tctx.fill()
    }

    return this._ctx.createPattern(tile, 'repeat')
  }

  // Deterministic per-cell hash -> [0,1), same hashing approach
  // ForestEffects uses for trunk thinning -- stable across reloads.
  static _hash01(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    h = (h ^ (h >>> 16)) >>> 0
    return h / 0xffffffff
  }

  // Picks one KIND for a given REGION_SIZE x REGION_SIZE zone,
  // deterministically from the zone's own coordinates -- this is what
  // gives "regional consistency" (nearby obstacles share a kind) rather
  // than each cell rolling independently.
  _kindForZone(zoneX, zoneY) {
    const t = UndergrowthRenderer._hash01(zoneX * 9176 + 17, zoneY * 5471 + 31)
    const idx = Math.floor(t * UndergrowthRenderer.KIND_KEYS.length)
    return UndergrowthRenderer.KIND_KEYS[Math.min(idx, UndergrowthRenderer.KIND_KEYS.length - 1)]
  }

  // Builds one obstacle descriptor per wallMask cell: kind (from its
  // zone), per-cell height/footprint jitter, and a small per-cell stroke
  // seed for the procedural texture variant. All derived live from
  // scene.mapData.wallMask, same pattern ForestEffects uses for trunks --
  // no separate authoring data needed.
  _buildObstaclesFromMask() {
    const mask = this.scene.mapData?.wallMask
    if (!mask) {
      console.warn('[UndergrowthRenderer] no mapData.wallMask found -- no obstacles will render')
      return []
    }
    const mapH = mask.length
    const mapW = mask[0]?.length ?? 0
    const RS = UndergrowthRenderer.REGION_SIZE

    // Water tiles are also wallMask=1 (unwalkable) -- excluded here so
    // rock/root/bramble obstacles don't spawn in open water. Same fix as
    // ForestEffects' trunk placement; see that file's comment for the
    // full rationale.
    const layer0 = this.scene.mapData?.layers?.[0]
    const isWater = (x, y) => {
      const gid = layer0?.[y]?.[x]
      return gid === 1625 || gid === 1679
    }

    const obstacles = []
    for (let ty = 0; ty < mapH; ty++) {
      for (let tx = 0; tx < mapW; tx++) {
        if (mask[ty][tx] !== 1) continue
        if (isWater(tx, ty)) continue

        const zoneX = Math.floor(tx / RS)
        const zoneY = Math.floor(ty / RS)
        const kindKey = this._kindForZone(zoneX, zoneY)
        const kind = UndergrowthRenderer.KINDS[kindKey]

        // Per-cell seeded rand, continuing the same LCG pattern used
        // elsewhere in this codebase for deterministic-but-varied values.
        let seed = Math.floor(tx * 7919 + ty * 104729 + zoneX * 13 + zoneY * 29) & 0x7fffffff
        const rand = () => {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff
          return seed / 0x7fffffff
        }

        // Density thinning -- applied AFTER drawing from rand() once for
        // determinism's sake isn't required here since this is purely a
        // keep/skip gate, not used for shape variation -- but draw it
        // from the same sequence regardless so adding this check doesn't
        // shift every subsequent rand() call's results relative to a
        // keepChance of 1.0 (kept ordering identical to avoid silently
        // changing every other scene's existing obstacle shapes).
        if (rand() > this._keepChance) continue

        const heightTiles = Math.max(0.15,
          (kind.baseHeight + (rand() - 0.5) * kind.heightJitter) * this._heightScale)
        const footprintFrac = kind.footprintMin +
          rand() * (kind.footprintMax - kind.footprintMin)
        // Offset jitter keeps some obstacles centred, others pushed
        // toward a cell edge -- this is the "mix of full-cell and
        // smaller/irregular" footprint variation, rather than every
        // obstacle being perfectly centred at every size.
        const offsetX = (rand() - 0.5) * (1 - footprintFrac) * 0.8
        const offsetY = (rand() - 0.5) * (1 - footprintFrac) * 0.4
        const textureSeed = Math.floor(rand() * 1e9)

        obstacles.push({ tx, ty, kindKey, kind, heightTiles, footprintFrac, offsetX, offsetY, textureSeed })
      }
    }
    return obstacles
  }

  // playerTileY is accepted for a future south-of-player fade (matching
  // ForestEffects' trunk fade) but not yet applied -- obstacles currently
  // always draw at full opacity. Revisit if nearby obstacles end up
  // hiding the player the way trunks could before that fade existed.
  //
  // sw/sh: current canvas dimensions, passed in explicitly rather than
  // read off pgr -- PGR doesn't reliably expose its own width/height as
  // public properties (ForestEffects itself tracks these independently
  // via scene.game.canvas, not via pgr._sw/_sh, which may not exist).
  update(pgr, sw, sh) {
    if (!pgr) return
    const ctx = this._ctx

    for (const ob of this._obstacles) {
      this._drawObstacle(pgr, ctx, ob, sw, sh)
    }
  }

  // Projects one obstacle's footprint corners at ground level, then
  // raises a copy of those corners by heightTiles to form the top face,
  // and draws: (1) east + west side faces, (2) front (south) face, (3)
  // top face. North (far) face is deliberately skipped -- same
  // simplification PGR's own building/cliff rendering relies on, since
  // the camera never sees behind an obstacle from this fixed viewing
  // angle. East/west faces were ORIGINALLY skipped too on the same
  // assumption, but that assumption was wrong: obstacles whose footprint
  // offset jitter shifts them enough, or that sit near screen edges
  // where the viewing angle exposes a side, showed a hollow open-sided
  // look with nothing drawn there at all. Confirmed via screenshot.
  _drawObstacle(pgr, ctx, ob, sw, sh) {
    const { tx, ty, kind, heightTiles, footprintFrac, offsetX, offsetY } = ob

    // Footprint corners in TILE space, before projection -- centred in
    // the cell, shrunk by footprintFrac, shifted by offset jitter.
    const half = footprintFrac / 2
    const cx = tx + 0.5 + offsetX
    const cy = ty + 0.5 + offsetY
    const x0 = cx - half, x1 = cx + half
    const y0 = cy - half, y1 = cy + half   // y0 = north edge, y1 = south edge (closer to camera)

    // Project all four GROUND corners first.
    const gTL = this._project(pgr, x0, y0)
    const gTR = this._project(pgr, x1, y0)
    const gBL = this._project(pgr, x0, y1)
    const gBR = this._project(pgr, x1, y1)
    if (!gTL || !gTR || !gBL || !gBR) return   // offscreen/behind camera

    // Terrain-height adjustment: shift each ground corner by its own
    // vertex height (bilinearly interpolated from the four nearest
    // integer vertices, since this footprint's corners sit at fractional
    // tile coordinates, not on the vertex grid itself) -- same _vertexH
    // data PGR's own tile loop reads. Without this, obstacle bases float
    // above or sink into the real ground once a heightMap exists, even
    // though the obstacle's own box height still looks fine in isolation.
    // Falls back to 0 harmlessly if _vertexH is unavailable or the map
    // has no heightMap.
    const terrainH = (px, py) => {
      const x0i = Math.floor(px), y0i = Math.floor(py)
      const fx = px - x0i, fy = py - y0i
      const h00 = pgr._vertexH?.(x0i,     y0i)     ?? 0
      const h10 = pgr._vertexH?.(x0i + 1, y0i)     ?? 0
      const h01 = pgr._vertexH?.(x0i,     y0i + 1) ?? 0
      const h11 = pgr._vertexH?.(x0i + 1, y0i + 1) ?? 0
      return h00 * (1 - fx) * (1 - fy) + h10 * fx * (1 - fy)
           + h01 * (1 - fx) * fy       + h11 * fx * fy
    }
    const sTopGround = pgr._scaleAtRow?.(y0) ?? 0
    const sBotGround = pgr._scaleAtRow?.(y1) ?? 0
    gTL.y -= terrainH(x0, y0) * sTopGround
    gTR.y -= terrainH(x1, y0) * sTopGround
    gBL.y -= terrainH(x0, y1) * sBotGround
    gBR.y -= terrainH(x1, y1) * sBotGround

    // Cull cheaply if the whole footprint is far outside the visible
    // screen -- generous margin since height can push the top face
    // upward beyond the ground footprint's own bounds. Falls back to a
    // very large bound if sw/sh weren't passed, effectively disabling
    // the cull rather than wrongly culling everything.
    const safeSw = sw ?? 99999, safeSh = sh ?? 99999
    const xs = [gTL.x, gTR.x, gBL.x, gBR.x]
    const ys = [gTL.y, gTR.y, gBL.y, gBR.y]
    if (Math.max(...xs) < -150 || Math.min(...xs) > safeSw + 150) return
    if (Math.max(...ys) < -150 || Math.min(...ys) > safeSh + 150) return

    // Height offset in screen pixels at each corner's own row scale --
    // using each corner's individual scale (not a single shared value)
    // keeps the box's top face correctly perspective-skewed rather than
    // uniformly shifted, matching how PGR itself raises elevated tiles.
    // Applied ON TOP of the terrain-height-adjusted ground corners above,
    // so the obstacle's own height stacks correctly on undulating ground
    // rather than replacing the terrain adjustment.
    const hTL = heightTiles * sTopGround
    const hTR = hTL
    const hBL = heightTiles * sBotGround
    const hBR = hBL

    const topTL = { x: gTL.x, y: gTL.y - hTL }
    const topTR = { x: gTR.x, y: gTR.y - hTR }
    const topBL = { x: gBL.x, y: gBL.y - hBL }
    const topBR = { x: gBR.x, y: gBR.y - hBR }

    // Side faces drawn first (furthest from viewer logically, and the
    // top/front faces' fills will paint over any seam at the shared
    // edges). Uses the SAME baked pattern as the top face, darkened via
    // a translucent black overlay rather than a separate baked texture
    // variant -- this keeps texture visible on every face (flat-colored
    // sides were part of why obstacles read as too uniform/synthetic)
    // while still preserving the cheap directional-shading cue.
    const pattern = this._patterns[ob.kindKey]
    this._fillTexturedQuad(ctx, topTL, topBL, gBL, gTL, pattern, 0.55)   // west face, darkest
    this._fillTexturedQuad(ctx, topTR, topBR, gBR, gTR, pattern, 0.55)   // east face, darkest

    // Front (south) face: connects the south GROUND edge to the south
    // TOP edge. Slightly less darkened than the sides.
    this._fillTexturedQuad(ctx, topBL, topBR, gBR, gBL, pattern, 0.72)

    // Top face, drawn last, full brightness (no darkening overlay).
    this._fillTexturedQuad(ctx, topTL, topTR, topBR, topBL, pattern, 1.0)
  }

  // Fills a quad with a CanvasPattern, then optionally darkens it via a
  // translucent black overlay clipped to the same quad path --
  // brightnessFrac of 1.0 = no darkening, lower values = darker. This
  // lets all faces share one baked pattern per kind while still reading
  // as differently-lit faces of a 3D box.
  _fillTexturedQuad(ctx, p1, p2, p3, p4, pattern, brightnessFrac) {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.lineTo(p3.x, p3.y)
    ctx.lineTo(p4.x, p4.y)
    ctx.closePath()
    ctx.clip()

    ctx.fillStyle = pattern
    ctx.fillRect(
      Math.min(p1.x, p2.x, p3.x, p4.x), Math.min(p1.y, p2.y, p3.y, p4.y),
      Math.max(p1.x, p2.x, p3.x, p4.x) - Math.min(p1.x, p2.x, p3.x, p4.x),
      Math.max(p1.y, p2.y, p3.y, p4.y) - Math.min(p1.y, p2.y, p3.y, p4.y)
    )

    if (brightnessFrac < 1.0) {
      ctx.fillStyle = `rgba(0,0,0,${(1 - brightnessFrac).toFixed(3)})`
      ctx.fillRect(
        Math.min(p1.x, p2.x, p3.x, p4.x), Math.min(p1.y, p2.y, p3.y, p4.y),
        Math.max(p1.x, p2.x, p3.x, p4.x) - Math.min(p1.x, p2.x, p3.x, p4.x),
        Math.max(p1.y, p2.y, p3.y, p4.y) - Math.min(p1.y, p2.y, p3.y, p4.y)
      )
    }

    ctx.restore()
  }

  // Thin wrapper around PGR's projection functions for a tile-space
  // point -- returns {x, y} in screen space, or null if off-camera.
  _project(pgr, tileX, tileY) {
    const y = pgr._rowToScreenY?.(tileY)
    if (y == null) return null
    const x = pgr._colToScreenX?.(tileX, tileY)
    if (x == null) return null
    return { x, y }
  }

  destroy() {
    this._obstacles = []
    this._ctx = null
  }
}


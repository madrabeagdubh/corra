// caveWalls.js
// Location: js/game/effects/caveWalls.js
//
// A cave for PGR: rock walls, standing stones, and the only light being the one you carry.
// Hooked in through pgr.setStructures(this), so everything here is drawn row by row inside PGR's
// own far-to-near loop, on the ground canvas: nearer rock covers farther rock, and the player
// (on the objects canvas above) is never hidden by a wall.
//
//   const cave = new CaveWalls(scene, opts)     after PGR exists (onEnter)
//   cave.update(dtMs)                           every frame, before PGR draws (scene.update)
//   cave.destroy()
//
// The floor is PGR's own tiles, but not Oryx's: CaveWalls makes a seamless stone floor (and a pool
// bed for the water) and slices it into tiles, each cell taking the slice for its place, so there is
// no grid. The floor follows the map's heightMap like any PGR ground, and so does everything here.
//
// Per row, PGR calls getEntriesForRow(row); each entry's draw(ctx, pgr) runs in that row's turn:
//   1. the row's floor is darkened: black where the torch doesn't reach, a warm wash where it does.
//      The light is a LIGHTMAP (brightness, SUB values per tile each way), blocked by rock: each
//      tile is lit if a ray from the torch reaches any of a few points on it. Once a frame the light
//      becomes a picture of the screen's darkness (each pixel traced back to the floor it shows,
//      heights and all), and each row takes its own band of that. Water swallows light, but shows
//      its surface: a cold sheen, the line where it meets the shore, the flame glinting on it.
//   2. drips (see below)
//   3. the rock: solid blocks. Every rock cell has a TOP at the walls' height, near black (the flame
//      is below it); the faces turned toward the camera -- the south face of rock with open floor in
//      front, the east/west face of rock beside open floor -- rise to it from the floor, spreading out
//      onto the floor at their foot, leaning in a little higher up, lit at the foot as the floor there.
//      All of it opaque: what a block hides stays hidden. A south face is drawn in the turn of the row
//      in front of it, after that row's floor, so its foot lies over that floor.
//      Rock SOUTH of your row -- between you and the camera -- is drawn on a canvas above you, so it
//      hides you as solid rock should; a faint ghost of you is laid over it (finish), as d3_sea does
//      behind its hills, so you're never lost. A ragged black edge marks where floor meets rock that
//      turns no face (the far side of a passage). Where tops hide walkable floor, its edge shows
//      through as a thin yellow line (_drawMarginsUnder), so you can tell you can walk there.
//   4. standing stones (mapData.stones): rough tapering slabs of paler stone, lit the same way, and
//      over you, like rock, when they stand south of you.
//   Drips: now and then a drop falls out of the dark somewhere near you. On water it opens a ring, on
//   stone a little splash -- only seen where your light reaches (onDrip(x, y, wet) is called for
//   each, so the scene can play a sound you hear whether you see it or not).
//
//   The scene calls cave.finish() from onPGRDrawComplete, for the ghost.
//
// opts (all optional; the scene feeds them from URL params for experimenting):
//   wallHeight   tiles (map's cave.wallHeight, else 1.4). At the cave's 45 degree camera a wall hides
//                as many rows of floor behind it as it is tall
//   torch        radius of the light, tiles
//   xray         false: no rock drawn over you, no ghost (for comparison)
//   margins      false: no yellow edge on floor hidden under rock
//   lean         how far the walls overhang the passage at the top, tiles (0.15)
//   rough        how far grid corners are nudged, tiles (0.1)
//   ambient      0..1, light everywhere regardless (0 = true dark)
//   drips        seconds between drops falling from the dark, on average (3; 0 = none)

const RING_SQUASH = 0.5                 // ripples lie flat on the floor: ovals, twice as wide as they are deep
const SUB = 4                         // lightmap pixels per tile
const ROCK_WARM = [225, 190, 150]       // what the flame does to bare rock: barely warms it, so it reads grey
const FLOOR_WARM = [225, 190, 170]    // what the flame does to dry floor: a faint warmth over grey stone, not orange
const WARM = [255, 150, 70]           // the torch's colour, as a wash over what it lights
const TEX_TILES = 4                   // the wall texture spans this many tiles before repeating
const ATLAS = 8                       // the floor texture spans this many tiles each way
const TILE_PX = 32                    // pixels per floor tile in it
const GID_FLOOR = 9200                // + (row % ATLAS) * ATLAS + (col % ATLAS)
const GID_BED = 9300                  // the same, for the pool bed under the water
const DRESSED_UP = 0.5                // dressed stone stands this much taller than the rock round it
const DAY = [200, 212, 228]           // daylight's colour, as a wash over what it lights
const TORCH_Z = 1.1                   // how high you hold it, tiles
const FLARE = 0.16                    // how far a wall's foot spreads onto the floor, tiles
const MARGIN = [150, 128, 92]          // the hidden floor's edge: a dull, worn ochre -- there to be found, not to be seen
const MARGIN_A = 0.5
const MARGIN_W = 1.2
const MARGIN_IN = 0.07                 // how far in from the rock the hidden floor's line runs, tiles
const GRAIN_A = 0.9                    // how strong the grain on a rock top is, at its strongest
const MARGIN_DEEP = 5                  // px a line must lie inside a top to be drawn under it
const GHOST = 0.32                     // how much of you shows through rock in front of you
const BOUNCE = 0.22                   // light off the rock, round corners the flame can't see

export default class CaveWalls {
  constructor(scene, opts = {}) {
    this.scene = scene
    this.pgr = scene.perspectiveGround
    const md = this.md = scene.mapData
    this.W = md.width; this.H = md.height
    this.mask = md.rockMask
    this.water = md.waterMask || null
    this.hm = md.heightMap || null
    if (this.hm) {
      this._hf = new Float32Array((this.W + 1) * (this.H + 1))
      for (let j = 0; j <= this.H; j++) for (let i = 0; i <= this.W; i++) this._hf[j * (this.W + 1) + i] = this.hm[j]?.[i] ?? 0
    }
    this.stones = (md.stones || []).map((s, i) => ({ ...s, i }))
    // dressed stone: rock cells that are worked masonry, not cave (the old way in): taller, blocks on their
    // faces. _dh: 1 at every grid corner touching one, between corners smoothly, so the wall climbs to it
    this.dressed = new Set((md.cave?.dressed || []).map(([x, y]) => y * this.W + x))
    this._dh = null
    if (this.dressed.size) {
      this._dh = new Float32Array((this.W + 1) * (this.H + 1))
      for (const k of this.dressed) {
        const x = k % this.W, y = Math.floor(k / this.W)
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) this._dh[(y + dy) * (this.W + 1) + x + dx] = 1
      }
    }
    this.wallH = opts.wallHeight ?? md.cave?.wallHeight ?? 1.4
    this.torchR = opts.torch ?? 5.5
    this.xray = opts.xray ?? true
    this.margins = opts.margins ?? true
    this._marginJobs = []
    this.dayR = opts.dayR ?? 8             // tiles daylight reaches in from the mouth
    this.grain = opts.grain ?? 3.2        // tiles from you at which the grain on rock tops has faded; 0 = none
    this.lean = opts.lean ?? 0.15
    this.rough = opts.rough ?? 0.1
    this.ambient = opts.ambient ?? 0.0
    this.dripEvery = opts.drips ?? 3
    this.onDrip = opts.onDrip || null
    this.drips = []
    this.ripples = []                       // what you stir up wading: rings (and, entering, a splash)
    this._reflJobs = []                     // reflections of the stones that stand in water (laid in finish())
    this._gctx = null
    this._nextDrip = 1.5
    this.t = 0

    // the lightmap: brightness 0..1, SUB x SUB per tile; the floor's darkness and the faces' light
    // are both read from it
    this.bright = new Float32Array(this.W * SUB * this.H * SUB)
    this.vis = new Float32Array(this.W * this.H)
    this._visKey = null

    this.rockTex = makeRockTexture(64 * TEX_TILES, 160, [72, 72, 75], 1)
    this.stoneTex = makeRockTexture(48, 96, [132, 128, 118], 2)
    this.topTex = makeRockTexture(96, 96, [30, 30, 32], 5)
    this.blockTex = this.dressed.size ? makeBlockTexture(64 * TEX_TILES, 160, 7) : null

    // the see-through canvas: over the player (objects, z 3), under the canopy layer (z 5)
    const box = this.pgr._objectCanvas?.parentElement
    if (box) {
      this.xc = document.createElement('canvas')
      this.xc.id = 'cave-xray'
      // stretched over the screen exactly as PGR's own canvases are (the stylesheet's 100%), or after a
      // resize (going fullscreen) it no longer lines up with them
      this.xc.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:4;pointer-events:none'
      box.appendChild(this.xc)
      this.xctx = this.xc.getContext('2d')
    }

    this._makeFloor()
    this._buildDaylight()
    this._buildRows()
    this.pgr.setStructures(this)
  }

  // ── the floor ────────────────────────────────────────────────────────────────
  // a seamless stone floor and pool bed, sliced into tiles for PGR; every open cell gets its slice
  _makeFloor() {
    this._k = new Uint8Array(this.W * this.H)
    for (let r = 0; r < this.H; r++) for (let c = 0; c < this.W; c++) {
      this._k[r * this.W + c] = this.mask[r][c] >= 1 ? 1 : this.water?.[r]?.[c] ? 2 : this.md.outsideMask?.[r]?.[c] ? 3 : 0
    }
    const floor = makeFloorAtlas(ATLAS, TILE_PX, 11, false)
    const bed = makeFloorAtlas(ATLAS, TILE_PX, 12, true)
    const slice = (atlas, i, j) => {
      const c = document.createElement('canvas'); c.width = c.height = TILE_PX
      c.getContext('2d').drawImage(atlas, i * TILE_PX, j * TILE_PX, TILE_PX, TILE_PX, 0, 0, TILE_PX, TILE_PX)
      return c
    }
    const cache = this.pgr._tileCache
    for (let j = 0; j < ATLAS; j++) for (let i = 0; i < ATLAS; i++) {
      cache.set(GID_FLOOR + j * ATLAS + i, slice(floor, i, j))
      cache.set(GID_BED + j * ATLAS + i, slice(bed, i, j))
    }
    const g = this.md.layers[0]
    for (let r = 0; r < this.H; r++) for (let c = 0; c < this.W; c++) {
      if (this.isRock(c, r)) continue
      g[r][c] = (this.isWater(c, r) ? GID_BED : GID_FLOOR) + (r % ATLAS) * ATLAS + (c % ATLAS)
    }
    this.pgr.forceRedraw?.()
  }

  // ── geometry: built once ─────────────────────────────────────────────────────
  // what each cell is, flat: 0 open floor, 1 rock, 2 water, 3 daylit threshold (the way out; built in _makeFloor; off the map: rock)
  _kind(c, r) { return r < 0 || c < 0 || r >= this.H || c >= this.W ? 1 : this._k[r * this.W + c] }
  isRock(c, r) { return this._kind(c, r) === 1 }
  isWater(c, r) { return this._kind(c, r) === 2 }

  // the floor's height at (x, y), tiles, between the heightMap's corners (read from a flat copy:
  // this is asked for every pixel of the floor's darkness)
  heightAt(x, y) {
    const f = this._hf
    if (!f) return 0
    const W1 = this.W + 1
    let ix = Math.floor(x), iy = Math.floor(y)
    const tx = x - ix, ty = y - iy
    if (ix < 0) ix = 0; else if (ix > this.W - 1) ix = this.W - 1
    if (iy < 0) iy = 0; else if (iy > this.H - 1) iy = this.H - 1
    const o = iy * W1 + ix
    return (f[o] * (1 - tx) + f[o + 1] * tx) * (1 - ty) + (f[o + W1] * (1 - tx) + f[o + W1 + 1] * tx) * ty
  }

  // how high the rock stands at a point on the grid (tiles). Dressed stone is taller.
  _wh(x, y) {
    let h = this.wallH
    const f = this._dh
    if (f) {
      const W1 = this.W + 1
      const ix = Math.max(0, Math.min(this.W - 1, Math.floor(x))), iy = Math.max(0, Math.min(this.H - 1, Math.floor(y)))
      const tx = x - ix, ty = y - iy, o = iy * W1 + ix
      const d = (f[o] * (1 - tx) + f[o + 1] * tx) * (1 - ty) + (f[o + W1] * (1 - tx) + f[o + W1 + 1] * tx) * ty
      h *= 1 + DRESSED_UP * d
    }
    return h
  }

  // the nudge for grid corner (vx, vy): [dx, dy] in tiles, the same whoever asks
  _jit(vx, vy, salt = 0) {
    const h = hash(vx * 73856093 ^ vy * 19349663 ^ salt * 83492791)
    const h2 = hash(h)
    return [((h & 0xffff) / 0xffff - 0.5) * 2 * this.rough, ((h2 & 0xffff) / 0xffff - 0.5) * 2 * this.rough]
  }

  // which way the rock at grid corner (vx, vy) leans: toward the open cells around it
  _leanAt(vx, vy) {
    let lx = 0, ly = 0
    for (const [dc, dr] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
      const c = vx + dc, r = vy + dr
      if (!this.isRock(c, r)) { lx += c + 0.5 - vx; ly += r + 0.5 - vy }
    }
    const n = Math.hypot(lx, ly)
    return n ? [lx / n, ly / n] : [0, 0]
  }

  // A point of a wall, k of the way up it (0 foot .. 1 top): [x, y, z] in tiles.
  //   base   [x, y]   where it stands on the grid line (a corner, or a point along the edge)
  //   dir    [dx, dy] the way out of the rock, into the open
  //   flare  how far the foot spreads out over the floor
  // The foot spreads out onto the floor and the wall curves up out of it (so it grows from the floor,
  // no seam between them); higher up it leans in over the passage.
  _wallPt(base, dir, flare, k) {
    const out = flare * (1 - k) * (1 - k) + this.lean * k * k
    const x = base[0] + dir[0] * out, y = base[1] + dir[1] * out
    return [x, y, this.heightAt(base[0] + dir[0] * flare, base[1] + dir[1] * flare) + k * this._wh(base[0], base[1])]
  }

  // a grid corner as a wall shares it: nudged a little (the same for every face that meets there),
  // and turned out toward the open cells around it
  _cornerBase(vx, vy) {
    const [jx, jy] = this._jit(vx, vy)
    return { base: [vx + jx, vy + jy], dir: this._leanAt(vx, vy), flare: FLARE + 0.04 * ((hash(vx * 31 + vy * 977) & 255) / 255) }
  }

  // the middle of an edge between two corners: a point a third of the way along, and another two
  // thirds, each pushed out over the floor by its own amount -- so no wall foot is a straight line
  _edgeMids(ax, ay, bx, by, n) {
    const out = []
    for (const t of [1 / 3, 2 / 3]) {
      const h = hash((ax * 92821 + ay * 68917 + bx * 31337 + by * 2749) ^ Math.round(t * 99))
      out.push({ base: [ax + (bx - ax) * t, ay + (by - ay) * t], dir: n, flare: FLARE * 0.4 + FLARE * 1.2 * ((h & 1023) / 1023) })
    }
    return out
  }

  // steps (md.stairs: [{ x0, y0, x1, y1, dir }], dir the way down): the floor there is a slope; each cell is
  // a tread, and gets a dark line at its low edge (the shadow under the nosing) and a pale one above it
  _drawStairs(ctx, pgr, r) {
    const s = pgr._scaleAtRow(r + 0.5)
    ctx.save()
    ctx.lineCap = 'butt'
    for (const t of this._stairRows[r]) {
      const b = this.brightSmooth(t.c + 0.5, r + 0.5)
      if (b < 0.03) continue
      const k = Math.min(1, b * 1.6)
      let a, e
      if (t.dir === 'S') { a = this._G(pgr, t.c, r + 1, 0); e = this._G(pgr, t.c + 1, r + 1, 0) }
      else if (t.dir === 'N') { a = this._G(pgr, t.c, r, 0); e = this._G(pgr, t.c + 1, r, 0) }
      else if (t.dir === 'E') { a = this._G(pgr, t.c + 1, r, 0); e = this._G(pgr, t.c + 1, r + 1, 0) }
      else { a = this._G(pgr, t.c, r, 0); e = this._G(pgr, t.c, r + 1, 0) }
      if (!a || !e) continue
      const up = t.dir === 'S' || t.dir === 'N' ? [0, -1] : [t.dir === 'E' ? -1 : 1, 0]     // toward the higher tread
      ctx.strokeStyle = `rgba(0,0,0,${(0.55 * k).toFixed(3)})`; ctx.lineWidth = Math.max(2, s * 0.07)
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(e.x, e.y); ctx.stroke()
      const o = Math.max(2, s * 0.06)
      ctx.strokeStyle = `rgba(225,200,170,${(0.2 * k).toFixed(3)})`; ctx.lineWidth = Math.max(1, s * 0.03)
      ctx.beginPath(); ctx.moveTo(a.x + up[0] * o, a.y + up[1] * o); ctx.lineTo(e.x + up[0] * o, e.y + up[1] * o); ctx.stroke()
    }
    ctx.restore()
  }

  _buildRows() {
    this._stairRows = null
    if (this.md.stairs?.length) {
      this._stairRows = {}
      for (const f of this.md.stairs) for (let r = f.y0; r <= f.y1; r++) for (let c = f.x0; c <= f.x1; c++) (this._stairRows[r] ||= []).push({ c, dir: f.dir })
    }
    this.rows = Array.from({ length: this.H }, () => [])
    this.rockDraw = []
    const fronts = []                                   // per row: rock cells with open floor to the south
    for (let r = 0; r < this.H; r++) {
      const f = []
      for (let c = 0; c < this.W; c++) if (this.isRock(c, r) && !this.isRock(c, r + 1)) f.push(c)
      fronts.push(f)
    }
    for (let r = 0; r < this.H; r++) {
      this.rows[r].push({ draw: (ctx, pgr) => this._drawFloorShade(ctx, pgr, r) })
      if (this._stairRows?.[r]) this.rows[r].push({ draw: (ctx, pgr) => this._drawStairs(ctx, pgr, r) })
      // drips land after the floor and before the row's own rock, which stands behind them
      this.rows[r].push({ draw: (ctx, pgr) => { this._gctx = ctx; this._drawDrips(ctx, pgr, r) } })
      const sides = [], edges = []
      for (let c = 0; c < this.W; c++) {
        if (this.isRock(c, r)) {
          if (!this.isRock(c + 1, r)) sides.push({ c, dir: +1 })    // east face, floor to the east
          if (!this.isRock(c - 1, r)) sides.push({ c, dir: -1 })    // west face
        } else {
          // the open cell's edges against rock that turns no face to the camera
          if (this.isRock(c, r + 1)) edges.push({ c, side: 'S' })
          if (this.isRock(c + 1, r)) edges.push({ c, side: 'E' })
          if (this.isRock(c - 1, r)) edges.push({ c, side: 'W' })
        }
      }
      if (edges.length) this.rows[r].push({ draw: (ctx, pgr) => this._drawRockEdges(ctx, pgr, r, edges) })
      // this row's floor is down: now the south faces of the rock just behind it (their feet spread
      // onto it), then this row's own side faces
      const behind = r > 0 ? fronts[r - 1] : []
      const rock = []
      for (let c = 0; c < this.W; c++) if (this.isRock(c, r)) rock.push(c)
      if (behind.length || sides.length || rock.length) {
        const draw = (ctx, pgr) => this._drawRowRock(ctx, pgr, r, behind, sides, rock)
        this.rows[r].push({ draw })
        this.rockDraw[r] = draw                          // (also for the rows PGR doesn't draw: _drawNearRock)
      }
    }
    for (const s of this.stones) {
      const r = Math.min(this.H - 1, Math.floor(s.y + 0.15))
      this.rows[r].push({ draw: (ctx, pgr) => {
        this._drawStone(this._dst(ctx, r), pgr, s)
        if (this.isWater(Math.floor(s.x), Math.floor(s.y))) this._queueReflection(ctx, pgr, s)
      } })
    }
  }

  // stones block movement as rock does
  blocks(tx, ty) {
    for (const s of this.stones) if (Math.floor(s.x) === tx && Math.floor(s.y) === ty) return true
    return false
  }

  // rows past the map's south edge (PGR draws those too, nearest of all, when the camera is beyond
  // the map): rock, so black
  getEntriesForRow(row) {
    if (row >= this.H) return this._beyond || (this._beyond = [{ draw: (ctx, pgr) => this._drawBeyond(ctx, pgr) }])
    return this.rows[row] || []
  }

  _drawBeyond(ctx, pgr) {
    if (this._beyondFrame === this._frame) return            // once a frame covers them all
    this._beyondFrame = this._frame
    const y = pgr._rowToScreenY(this.H)
    ctx.save(); ctx.fillStyle = '#000'
    ctx.fillRect(0, y === null ? 0 : Math.floor(y - this.heightAt(this.W / 2, this.H) * pgr._scaleAtRow(this.H)) + 2, pgr._sw, pgr._sh)
    ctx.restore()
  }

  // ── daylight ─────────────────────────────────────────────────────────────────
  // Light that comes in at the mouth, worked out once: every lightmap pixel of cave floor takes the
  // brightest of what each outside cell can send it -- fading with distance (dayR tiles) and stopped by
  // rock, so it falls round boulders and bends into the lobes as the real thing would. Outside: full.
  _buildDaylight() {
    const { W, H } = this, lw = W * SUB, lh = H * SUB
    this.day = new Float32Array(lw * lh)
    const src = []
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (this._kind(c, r) === 3) src.push([c + 0.5, r + 0.5])
    if (!src.length) { this.bright.fill(0); return }
    const R = this.dayR, R2 = R * R
    for (let y = 0; y < lh; y++) {
      const wy = (y + 0.5) / SUB, r = Math.floor(wy)
      for (let x = 0; x < lw; x++) {
        const wx = (x + 0.5) / SUB, c = Math.floor(wx), k = this._kind(c, r)
        if (k === 1) continue
        if (k === 3) { this.day[y * lw + x] = 1; continue }
        let best = 0
        for (const [sx, sy] of src) {
          const dx = wx - sx, dy = wy - sy, d2 = dx * dx + dy * dy
          if (d2 >= R2) continue
          const f = Math.pow(1 - Math.sqrt(d2) / R, 1.2)
          if (f > best && this._ray(sx, sy, wx, wy, c, r)) best = f
        }
        this.day[y * lw + x] = best
      }
    }
    this.bright.set(this.day)
  }

  // ── light ──────────────────────────────────────────────────────────────────
  update(dt) {
    this.t += dt / 1000
    this._frame = (this._frame || 0) + 1
    this._marginJobs = []
    this._reflJobs = []
    this.ripples = this.ripples.filter(r => this.t - r.t0 < r.life)
    const p = this.scene.player
    if (!p) return
    const ts = this.scene.tileSize
    const px = this.px = p.logicalX / ts, py = this.py = p.logicalY / ts     // tile units, centre of the player
    // the flame breathes: slow swell plus a quicker shiver
    const flick = 1 + 0.035 * Math.sin(this.t * 2.3) + 0.025 * Math.sin(this.t * 11.7 + 1.3) + 0.015 * Math.sin(this.t * 23.1)
    const R = this.R = this.torchR * flick
    this._light(px, py, R)
    this._stepDrips(px, py)
  }

  // how much of each tile the torch can see: 0..1. A tile is tried at its middle and four points near
  // its corners, so a winding passage doesn't throw shadow on the floor right beside you
  _visibility(px, py, R) {
    const key = `${Math.floor(px * 4)},${Math.floor(py * 4)},${Math.ceil(R)}`
    if (key === this._visKey) return
    this._visKey = key
    const { W, H, vis } = this
    vis.fill(0)
    const pc = Math.floor(px), pr = Math.floor(py)
    const r0 = Math.max(0, Math.floor(py - R - 1)), r1 = Math.min(H - 1, Math.ceil(py + R + 1))
    const c0 = Math.max(0, Math.floor(px - R - 1)), c1 = Math.min(W - 1, Math.ceil(px + R + 1))
    const PTS = [[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      if (Math.hypot(c + 0.5 - px, r + 0.5 - py) > R + 1) continue
      // right beside you: seen
      if (Math.abs(c - pc) <= 1 && Math.abs(r - pr) <= 1) { vis[r * W + c] = 1; continue }
      let hits = 0
      for (const [ox, oy] of PTS) if (this._ray(px, py, c + ox, r + oy, c, r)) hits++
      vis[r * W + c] = Math.min(1, hits / 2.5)
    }
  }

  // can the torch at (px, py) see (tx, ty) in tile (c, r)? Rock on the way (not the tile itself) stops it
  _ray(px, py, tx, ty, c, r) {
    const d = Math.hypot(tx - px, ty - py)
    const n = Math.ceil(d * 3)
    for (let k = 1; k < n; k++) {
      const cx = Math.floor(px + (tx - px) * k / n), cy = Math.floor(py + (ty - py) * k / n)
      if (cx === c && cy === r) return true
      if (this.isRock(cx, cy)) return false
    }
    return true
  }

  // the torch's fall-off with distance (tiles): bright at your feet, gone by R
  _fall(d, R = this.R) {
    if (d >= R) return 0
    const u = d / R
    return Math.pow(1 - u, 1.4) * (1 - 0.25 * u)
  }

  // brightness, 0..1, at every lightmap pixel the torch can reach; the rest stays 0. Only the box
  // around the flame is worked out, and last frame's box cleared first.
  _light(px, py, R) {
    this._visibility(px, py, R)
    const { W, vis, bright } = this
    const lw = W * SUB, lh = this.H * SUB
    const amb = this.ambient
    if (amb > 0) bright.fill(amb)
    else if (this._box) {
      const [x0, y0, x1, y1] = this._box
      for (let y = y0; y < y1; y++) bright.set(this.day.subarray(y * lw + x0, y * lw + x1), y * lw + x0)
    }
    const x0 = Math.max(0, Math.floor((px - R) * SUB)), x1 = Math.min(lw, Math.ceil((px + R) * SUB) + 1)
    const y0 = Math.max(0, Math.floor((py - R) * SUB)), y1 = Math.min(lh, Math.ceil((py + R) * SUB) + 1)
    this._box = [x0, y0, x1, y1]
    const R2 = R * R
    for (let y = y0; y < y1; y++) {
      const wy = (y + 0.5) / SUB, ty = Math.floor(wy), dy = wy - py
      for (let x = x0; x < x1; x++) {
        const wx = (x + 0.5) / SUB, dx = wx - px
        const d2 = dx * dx + dy * dy
        if (d2 >= R2) continue
        // what the flame sees is lit; round a corner, a little light still comes off the rock, so open
        // floor near you never looks like solid black
        const v = Math.max(vis[ty * W + Math.floor(wx)], BOUNCE)
        bright[y * lw + x] = Math.max(this._fall(Math.sqrt(d2), R * 0.8) * v, this._fall(Math.sqrt(d2), R) * vis[ty * W + Math.floor(wx)], amb, this.day[y * lw + x])
      }
    }
  }

  // brightness at a point in tile coords (nearest lightmap pixel)
  brightAt(x, y) {
    const lx = Math.floor(x * SUB), ly = Math.floor(y * SUB)
    const lw = this.W * SUB
    if (lx < 0 || ly < 0 || lx >= lw || ly >= this.H * SUB) return 0
    return this.bright[ly * lw + lx]
  }

  // brightness at a point, smoothly between lightmap pixels
  brightSmooth(x, y, B = this.bright) {
    const lw = this.W * SUB, lh = this.H * SUB
    const fx = x * SUB - 0.5, fy = y * SUB - 0.5
    const ix = Math.floor(fx), iy = Math.floor(fy)
    if (ix < 0 || iy < 0 || ix >= lw - 1 || iy >= lh - 1) return 0      // the map's edge: rock, dark
    const tx = fx - ix, ty = fy - iy, o = iy * lw + ix
    return (B[o] * (1 - tx) + B[o + 1] * tx) * (1 - ty) + (B[o + lw] * (1 - tx) + B[o + lw + 1] * tx) * ty
  }

  // light on something up off the floor (the rock's tops): by straight distance from the
  // flame, no shadows -- what it's for is being seen
  _brightUp(x, y, z) {
    if (this.px === undefined) return 0
    const zt = this.heightAt(this.px, this.py) + TORCH_Z
    return this._fall(Math.hypot(x - this.px, y - this.py, (z - zt) * 0.8))
  }

  // ── drips ──────────────────────────────────────────────────────────────────
  _stepDrips(px, py) {
    const FALL = 0.5, LIFE = 1.6
    this.drips = this.drips.filter(d => this.t - d.t0 < FALL + LIFE)
    if (!this.dripEvery || this.t < this._nextDrip) return
    this._nextDrip = this.t + this.dripEvery * (0.4 + Math.random() * 1.2)
    // somewhere open within a few tiles of you, water likelier than stone
    for (let tries = 0; tries < 12; tries++) {
      const x = px + (Math.random() - 0.5) * 12, y = py + (Math.random() - 0.7) * 10
      const c = Math.floor(x), r = Math.floor(y)
      if (this.isRock(c, r) || this._kind(c, r) === 3) continue      // (nor at the way out)
      const wet = this.isWater(c, r)
      if (!wet && Math.random() < 0.6) continue
      this.drips.push({ x, y, wet, t0: this.t, fall: FALL, life: LIFE, landed: false })
      break
    }
  }

  _drawDrips(ctx, pgr, r) {
    for (const d of this.drips) {
      if (Math.floor(d.y) !== r) continue
      const age = this.t - d.t0
      const b = this.brightSmooth(d.x, d.y)
      if (age < d.fall) {
        // falling: a short streak out of the dark, visible only low down where the light is
        if (b < 0.05) continue
        const z = this.wallH * (1 - age / d.fall) ** 1.6
        const p0 = this._G(pgr, d.x, d.y, z), p1 = this._G(pgr, d.x, d.y, z + 0.18)
        if (!p0 || !p1) continue
        const a = Math.min(1, b * 1.5) * (1 - z / this.wallH)
        ctx.save(); ctx.strokeStyle = `rgba(255,205,150,${(a * 0.8).toFixed(3)})`; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); ctx.restore()
        continue
      }
      if (!d.landed) { d.landed = true; this.onDrip?.(d.x, d.y, d.wet) }
      if (b < 0.04) continue
      const u = (age - d.fall) / d.life                       // 0..1 over the ripple's life
      ctx.save()
      if (d.wet) {
        // rings: two, the second a little behind, widening and fading
        for (const lag of [0, 0.22]) {
          const v = u - lag
          if (v <= 0) continue
          const rad = 0.08 + v * 0.55
          const c = this._G(pgr, d.x, d.y, 0), n = this._G(pgr, d.x, d.y - rad, 0), f = this._G(pgr, d.x, d.y + rad, 0)
          if (!c || !n || !f) continue
          const rx = rad * pgr._scaleAtRow(d.y), ry = Math.max(0.5, (f.y - n.y) / 2 * RING_SQUASH)
          const a = (1 - v) ** 1.5 * Math.min(1, b * 1.8) * (lag ? 0.5 : 0.85)
          ctx.strokeStyle = `rgba(255,190,130,${a.toFixed(3)})`; ctx.lineWidth = 1
          ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke()
        }
      } else if (u < 0.35) {
        // stone: a few specks thrown up and gone
        const k = u / 0.35
        for (let i = 0; i < 4; i++) {
          const ang = i * 1.7 + d.x * 3, sp = 0.12 + (i % 2) * 0.06
          const q = this._G(pgr, d.x + Math.cos(ang) * sp * k, d.y + Math.sin(ang) * sp * k * 0.6, 0.25 * Math.sin(k * Math.PI))
          if (!q) continue
          ctx.fillStyle = `rgba(255,210,160,${((1 - k) * Math.min(1, b * 1.8) * 0.8).toFixed(3)})`
          ctx.fillRect(q.x - 0.75, q.y - 0.75, 1.5, 1.5)
        }
      }
      ctx.restore()
    }
  }

  // ── wading ─────────────────────────────────────────────────────────────────
  // s: 0.5 a trailing ring, 1 a footfall, 1.6 stepping in (rings and a spray of drops)
  ripple(x, y, s = 1) {
    this.ripples.push({ x, y, t0: this.t, s, life: 0.9 + 0.5 * s, spray: s >= 1.5 })
    if (this.ripples.length > 40) this.ripples.shift()
  }

  // clip to the water cells in a box of tiles (so rings and reflections stay on water, never over rock)
  _waterClip(ctx, pgr, c0, r0, c1, r1) {
    ctx.beginPath()
    let any = false
    for (let r = Math.max(0, r0); r <= Math.min(this.H - 1, r1); r++) for (let c = Math.max(0, c0); c <= Math.min(this.W - 1, c1); c++) {
      if (!this.isWater(c, r)) continue
      const a = this._G(pgr, c, r, 0), b = this._G(pgr, c + 1, r, 0), d = this._G(pgr, c + 1, r + 1, 0), e = this._G(pgr, c, r + 1, 0)
      if (!a || !b || !d || !e) continue
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(d.x, d.y); ctx.lineTo(e.x, e.y); ctx.closePath(); any = true
    }
    if (any) ctx.clip(); else { ctx.rect(0, 0, 0, 0); ctx.clip() }
  }

  _drawRipples(pgr) {
    const ctx = this._gctx
    if (!ctx || !this.ripples.length) return
    for (const q of this.ripples) {
      const u = (this.t - q.t0) / q.life
      if (u < 0 || u >= 1) continue
      const b = Math.min(1, 0.35 + this.brightSmooth(q.x, q.y) * 1.4)
      ctx.save()
      this._waterClip(ctx, pgr, Math.floor(q.x - 2), Math.floor(q.y - 2), Math.floor(q.x + 2), Math.floor(q.y + 2))
      // two rings, the second behind the first, each widening and fading; a footfall's reach more than a trail's
      for (const lag of [0, 0.25]) {
        const v = u - lag
        if (v <= 0) continue
        const rad = 0.1 + v * (0.45 + 0.35 * q.s)
        const c = this._G(pgr, q.x, q.y, 0), n = this._G(pgr, q.x, q.y - rad, 0), f = this._G(pgr, q.x, q.y + rad, 0)
        if (!c || !n || !f) continue
        const rx = rad * this._scaleAt(pgr, q.y), ry = Math.max(0.5, (f.y - n.y) / 2 * RING_SQUASH)
        const a = (1 - v) ** 1.4 * b * (lag ? 0.35 : 0.6) * Math.min(1, 0.5 + q.s * 0.4)
        ctx.strokeStyle = `rgba(190,205,230,${a.toFixed(3)})`; ctx.lineWidth = 1.2
        ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke()
      }
      ctx.restore()
      if (q.spray && u < 0.42) {
        // drops thrown up and falling back, each on its own arc
        const k = u / 0.42
        ctx.save(); ctx.fillStyle = `rgba(215,225,240,${((1 - k) * b * 0.9).toFixed(3)})`
        for (let i = 0; i < 7; i++) {
          const ang = i * 2.4 + q.x * 5, sp = 0.1 + (i % 3) * 0.06
          const z = 0.55 * (1.1 * k - k * k) * (0.7 + (i % 3) * 0.25)
          const pt = this._G(pgr, q.x + Math.cos(ang) * sp * k, q.y + Math.sin(ang) * sp * k * 0.6, Math.max(0, z))
          if (pt) ctx.fillRect(pt.x - 1, pt.y - 1, 2, 2)
        }
        ctx.restore()
      }
    }
  }

  // ── reflections ────────────────────────────────────────────────────────────
  // A stone standing in water is drawn once more into a scratch picture and kept; in finish() (after the
  // floor rows in front of it, which would paint over it) it is laid on the water below its foot, upside
  // down, in thin strips that sway sideways, fainter the further from the foot, only over water.
  _queueReflection(ctx, pgr, st) {
    const b = Math.max(this.brightAt(st.x, st.y + 0.45), this.brightAt(st.x, st.y - 0.45) * 0.35)
    if (b < 0.03) return
    const base = this.heightAt(st.x, st.y) - 0.05
    const foot = this._P(pgr, st.x, st.y, base), top = this._P(pgr, st.x, st.y, base + st.h)
    if (!foot || !top) return
    const k = this._scaleAt(pgr, st.y)
    const hw = Math.ceil(k * 0.6), bx = Math.max(0, Math.floor(foot.x - hw)), by = Math.max(0, Math.floor(top.y - 6))
    const cw = ctx.canvas.width, ch = ctx.canvas.height
    const bw = Math.min(cw - bx, hw * 2), bh = Math.min(ch - by, Math.ceil(foot.y - by + 4))
    if (bw < 2 || bh < 2) return
    if (!this._rc || this._rc.width !== cw || this._rc.height !== ch) {
      this._rc = document.createElement('canvas'); this._rc.width = cw; this._rc.height = ch
      this._rcx = this._rc.getContext('2d')
    }
    this._rcx.clearRect(bx - 4, by - 4, bw + 8, bh + 8)
    this._drawStone(this._rcx, pgr, st)
    let img = st._refl
    if (!img || img.width !== bw || img.height !== bh) { img = st._refl = document.createElement('canvas'); img.width = bw; img.height = bh }
    const ix = img.getContext('2d'); ix.clearRect(0, 0, bw, bh)
    ix.drawImage(this._rc, bx, by, bw, bh, 0, 0, bw, bh)
    this._rcx.clearRect(bx - 4, by - 4, bw + 8, bh + 8)
    this._reflJobs.push({ ctx, img, bx, by, bw, bh, baseY: foot.y - by, st, b })
  }

  _drawReflection(j, pgr) {
    const { ctx, img, bx, by, bw, bh, baseY, st, b } = j
    const A = 0.62 * Math.min(1, b * 1.6)
    ctx.save()
    this._waterClip(ctx, pgr, Math.floor(st.x - 3), Math.floor(st.y - 1), Math.floor(st.x + 3), Math.ceil(st.y + st.h * 1.2 + 1))
    const STRIP = 2
    for (let sy = 0; sy < Math.min(bh, baseY); sy += STRIP) {
      const dd = baseY - sy                                         // height above the foot, px
      const fade = 1 - 0.75 * dd / baseY
      const dx = Math.sin(this.t * 1.9 + dd * 0.16) * (1 + dd * 0.03) + Math.sin(this.t * 3.1 + dd * 0.41) * 0.6
      ctx.globalAlpha = A * fade * fade
      ctx.drawImage(img, 0, sy, bw, STRIP, bx + dx, by + baseY + dd * 0.9, bw, STRIP)
    }
    ctx.restore()
  }

  // ── projection ─────────────────────────────────────────────────────────────
  // tile coords (x, y) at height z tiles (absolute) -> screen; null behind the camera
  // PGR's own projection, written out so it also reaches the rows just past its camera row: the eye is
  // FOCAL_LENGTH rows further back, so they're still in front of it (PGR stops there because ground
  // that near falls below the screen -- but rock standing there doesn't)
  _P(pgr, x, y, z) {
    const C = pgr.constructor, FL = C.FOCAL_LENGTH
    const d = pgr._perspCamRow() - y
    if (d <= -FL * 0.85) return null
    const k = pgr._pxPerTileAtPlayer() * (FL + C.PLAYER_DIST_TILES) / (FL + d)
    return { x: pgr._sw / 2 + (x - pgr._perspCamCol()) * k, y: pgr._horizonPx() + pgr._groundH() * FL / (FL + d) - z * k }
  }
  _scaleAt(pgr, y) {
    const C = pgr.constructor, FL = C.FOCAL_LENGTH, d = pgr._perspCamRow() - y
    return d <= -FL * 0.85 ? 0 : pgr._pxPerTileAtPlayer() * (FL + C.PLAYER_DIST_TILES) / (FL + d)
  }
  // the same, z measured from the floor there
  _G(pgr, x, y, z) { return this._P(pgr, x, y, z + this.heightAt(x, y)) }

  // ── the floor's darkness ─────────────────────────────────────────────────────
  // A picture of the whole screen: each of its (quarter-size) pixels is traced back to the floor it
  // shows -- allowing for the floor's height there -- and given that spot's light. Made once a frame,
  // the first time a row asks; each row then takes its own band of it.
  _screenShade(pgr) {
    const DS = 4
    const sw = pgr._sw, sh = pgr._sh
    const cw = Math.ceil(sw / DS), ch = Math.ceil(sh / DS)
    if (!this.sc || this.sc.width !== cw || this.sc.height !== ch) {
      this.sc = document.createElement('canvas'); this.sc.width = cw; this.sc.height = ch
      this.scCtx = this.sc.getContext('2d'); this.scImg = this.scCtx.createImageData(cw, ch)
      this.sk = document.createElement('canvas'); this.sk.width = cw; this.sk.height = ch
      this.skCtx = this.sk.getContext('2d'); this.skImg = this.skCtx.createImageData(cw, ch)
    }
    const data = this.scImg.data, dk = this.skImg.data
    const C = pgr.constructor, FL = C.FOCAL_LENGTH
    const hz = pgr._horizonPx(), gH = pgr._groundH(), camRow = pgr._perspCamRow(), camCol = pgr._perspCamCol()
    const K = pgr._pxPerTileAtPlayer() * (FL + C.PLAYER_DIST_TILES)
    const rowOf = (Y) => (Y - hz <= 0 ? null : camRow - (FL * gH / (Y - hz) - FL))
    const scaleOf = (row) => { const d = camRow - row; return d <= 0 ? 0 : K / (FL + d) }
    for (let j = 0; j < ch; j++) {
      const Y = (j + 0.5) * DS
      const row0 = rowOf(Y)
      for (let i = 0; i < cw; i++) {
        const o = (j * cw + i) * 4
        const X = (i + 0.5) * DS - sw / 2
        let b = 0, wet = false, shore = 0, dshare = 0
        if (row0 !== null) {
          // the flat guess, then twice: lift by the floor's height there and look again
          let row = row0, s = scaleOf(row), col = camCol + X / s
          for (let it = 0; it < 2 && this.hm; it++) {
            const r2 = rowOf(Y + this.heightAt(col, row) * s)
            if (r2 === null) break
            row = r2; s = scaleOf(row); if (!s) break; col = camCol + X / s
          }
          const ci = Math.floor(col), ri = Math.floor(row)
          const kind = this._kind(ci, ri)
          // under the rock: nothing to see
          b = kind === 1 ? 0 : this.brightSmooth(col, row)
          if (b > 0.001) dshare = Math.min(1, this.brightSmooth(col, row, this.day) / b)      // how much of it is daylight
          wet = kind === 2
          if (wet) {
            // how near the water's edge: open dry floor within a fraction of a tile
            const fx = col - ci, fy = row - ri, E = 0.16
            if ((fx < E && !this._kind(ci - 1, ri)) || (fx > 1 - E && !this._kind(ci + 1, ri)) ||
                (fy < E && !this._kind(ci, ri - 1)) || (fy > 1 - E && !this._kind(ci, ri + 1))) shore = 1
          }
        }
        let a = 1 - b * 0.9
        const w = b * b
        if (wet) {
          // dark water: it takes most of the light, gives back a cold sheen, and a pale line where it
          // laps the stone. Unlit, black as the rest
          a = 1 - b * (shore ? 0.75 : 0.5)
          const sheen = Math.min(1, b * 2.2)
          data[o]     = (14 + WARM[0] * w * 0.25 + shore * 120 * b) * sheen
          data[o + 1] = (22 + WARM[1] * w * 0.25 + shore * 110 * b) * sheen
          data[o + 2] = (30 + WARM[2] * w * 0.2 + shore * 95 * b) * sheen
        } else {
          data[o] = (FLOOR_WARM[0] + (DAY[0] - FLOOR_WARM[0]) * dshare) * w; data[o + 1] = (FLOOR_WARM[1] + (DAY[1] - FLOOR_WARM[1]) * dshare) * w; data[o + 2] = (FLOOR_WARM[2] + (DAY[2] - FLOOR_WARM[2]) * dshare) * w
        }
        data[o + 3] = Math.round(Math.min(1, a) * 255)
        // the deep dark only, for re-covering PGR's tile bleed (see _drawFloorShade)
        dk[o] = data[o]; dk[o + 1] = data[o + 1]; dk[o + 2] = data[o + 2]
        dk[o + 3] = Math.round(Math.max(0, Math.min(1, (a - 0.86) / 0.12)) * 255)
      }
    }
    this.scCtx.putImageData(this.scImg, 0, 0)
    this.skCtx.putImageData(this.skImg, 0, 0)
  }

  // the screen outline of a row's floor, as PGR draws it (heights and all): its far edge left to
  // right, then its near edge right to left. Only the columns on screen, and a margin.
  _rowOutline(pgr, r) {
    const s0 = pgr._scaleAtRow(r), s1 = pgr._scaleAtRow(r + 1)
    if (!(s1 > 0)) return null
    const camCol = pgr._perspCamCol(), sw = pgr._sw
    const c0 = Math.max(0, Math.floor(camCol - sw / 2 / s1) - 1), c1 = Math.min(this.W, Math.ceil(camCol + sw / 2 / s1) + 1)
    const y0 = pgr._rowToScreenY(r), y1 = pgr._rowToScreenY(r + 1)
    const vh = (c, rr) => this.hm?.[rr]?.[c] ?? 0
    const far = [], near = []
    for (let c = c0; c <= c1; c++) {
      far.push(y0 === null ? { x: pgr._colToScreenX(c, r + 1), y: -10 } : { x: pgr._colToScreenX(c, r), y: y0 - vh(c, r) * s0 })
      near.push({ x: pgr._colToScreenX(c, r + 1), y: y1 - vh(c, r + 1) * s1 })
    }
    return { far, near }
  }

  _drawFloorShade(ctx, pgr, r) {
    const yB = pgr._rowToScreenY(r + 1)
    if (yB === null) return
    const ol = this._rowOutline(pgr, r)
    if (!ol) return
    if (this._shadeFrame !== this._frame) {
      // the first row this frame: make the frame's darkness, and black out whatever PGR put beyond
      // the far rows (its glimpse past the map's north edge: flat ground colour, in a cave)
      this._screenShade(pgr); this._shadeFrame = this._frame
      this._xrayBegin(pgr)
      let top = Infinity
      for (const p of ol.far) top = Math.min(top, p.y)
      ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, pgr._sw, Math.max(0, top)); ctx.restore()
    }
    const last = r === this._lastRow(pgr)
    const path = (lift) => {
      ctx.beginPath()
      ctx.moveTo(ol.far[0].x, ol.far[0].y - lift)
      for (const p of ol.far) ctx.lineTo(p.x, p.y - lift)
      for (let i = ol.near.length - 1; i >= 0; i--) ctx.lineTo(ol.near[i].x, ol.near[i].y)
      ctx.closePath()
    }
    if (last) {
      // nearer than the last row PGR draws (the strip just in front of the camera) there's no floor,
      // only PGR's fill colour: black
      ctx.save(); ctx.fillStyle = '#000'; ctx.beginPath()
      ctx.moveTo(Math.min(ol.near[0].x, -10), ol.near[0].y)
      for (const p of ol.near) ctx.lineTo(p.x, p.y)
      ctx.lineTo(Math.max(ol.near[ol.near.length - 1].x, pgr._sw + 10), ol.near[ol.near.length - 1].y)
      ctx.lineTo(pgr._sw + 10, pgr._sh + 10); ctx.lineTo(-10, pgr._sh + 10); ctx.closePath(); ctx.fill(); ctx.restore()
    }
    ctx.save()
    ctx.imageSmoothingEnabled = true
    ctx.save(); path(0); ctx.clip()
    ctx.drawImage(this.sc, 0, 0, this.sc.width * 4, this.sc.height * 4)
    ctx.restore()
    // PGR grows each floor tile 3px every way, so this row's tiles have just painted a thin band over
    // the bottom of the row behind, after that row was shaded: grey hairlines in the dark. Cover the
    // band again (and the seam between the rows), but only where it's deep dark -- elsewhere a second
    // coat would show as a stripe
    ctx.beginPath()
    ctx.moveTo(ol.far[0].x, ol.far[0].y - 4)
    for (const p of ol.far) ctx.lineTo(p.x, p.y - 4)
    for (let i = ol.far.length - 1; i >= 0; i--) ctx.lineTo(ol.far[i].x, ol.far[i].y + 1)
    ctx.closePath(); ctx.clip()
    ctx.drawImage(this.sk, 0, 0, this.sk.width * 4, this.sk.height * 4)
    ctx.restore()
    this._drawGlints(ctx, pgr, r)
  }

  _lastRow(pgr) {
    // the nearest row with a near edge in front of the camera (its far edge may be behind it)
    const cr = pgr._perspCamRow()
    let r = Math.ceil(cr) - 2
    if (cr - (r + 2) > 1e-6) r++
    return Math.min(this.H - 1, r)
  }

  // the flame on dark water: short warm streaks that come and go, only where the light reaches
  _drawGlints(ctx, pgr, r) {
    let any = false
    for (let c = 0; c < this.W; c++) {
      if (!this.isWater(c, r)) continue
      const b = this.brightAt(c + 0.5, r + 0.5)
      if (b < 0.06) continue
      if (!any) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; any = true }
      // a couple of chances a tile, most of them spent: only the brightest water shows much
      for (let k = 0; k < 2; k++) {
        const ph = hash(c * 131 + r * 977 + k * 7) & 0xffff
        const life = (this.t * (0.35 + (ph % 7) * 0.06) + ph / 0xffff) % 1   // each glint fades in and out
        const on = Math.max(0, Math.sin(life * Math.PI * 2))                    // half its time, gone
        const a = on * on * b * b * 0.9
        if (a < 0.03) continue
        const gx = c + 0.15 + ((ph * 13) % 70) / 100, gy = r + 0.15 + ((ph * 7) % 70) / 100
        const len = 0.1 + 0.08 * Math.sin(this.t * 2 + k)
        const p0 = this._G(pgr, gx - len / 2, gy, 0), p1 = this._G(pgr, gx + len / 2, gy, 0)
        if (!p0 || !p1) continue
        ctx.strokeStyle = `rgba(255,190,120,${a.toFixed(3)})`
        ctx.lineWidth = Math.max(1, pgr._scaleAtRow(gy) * 0.03)
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke()
      }
    }
    if (any) ctx.restore()
  }

  // ── drawing helpers ────────────────────────────────────────────────────────
  // draw img's triangle (u,v pixel coords) onto screen triangle p0 p1 p2, its clip grown a little
  // every way so neighbouring faces meet
  _tri(ctx, img, t0, t1, t2, p0, p1, p2) {
    const [u0, v0] = t0, [u1, v1] = t1, [u2, v2] = t2
    const det = u0 * (v1 - v2) - u1 * (v0 - v2) + u2 * (v0 - v1)
    if (Math.abs(det) < 1e-6) return
    const a = (p0.x * (v1 - v2) + p1.x * (v2 - v0) + p2.x * (v0 - v1)) / det
    const c = (p0.x * (u2 - u1) + p1.x * (u0 - u2) + p2.x * (u1 - u0)) / det
    const e = p0.x - a * u0 - c * v0
    const b = (p0.y * (v1 - v2) + p1.y * (v2 - v0) + p2.y * (v0 - v1)) / det
    const d = (p0.y * (u2 - u1) + p1.y * (u0 - u2) + p2.y * (u1 - u0)) / det
    const f = p0.y - b * u0 - d * v0
    ctx.save()
    ctx.beginPath()
    const cx = (p0.x + p1.x + p2.x) / 3, cy = (p0.y + p1.y + p2.y) / 3
    const g = (p) => ({ x: p.x + Math.sign(p.x - cx) * 0.9, y: p.y + Math.sign(p.y - cy) * 0.9 })
    const q0 = g(p0), q1 = g(p1), q2 = g(p2)
    ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.closePath(); ctx.clip()
    ctx.setTransform(a, b, c, d, e, f)
    ctx.drawImage(img, 0, 0)
    ctx.restore()
  }

  // a textured quad: tl tr br bl on screen, texture columns u0..u1 (all of it by default)
  _quad(ctx, tex, tl, tr, br, bl, u0 = 0, u1 = tex.width) {
    const h = tex.height
    this._tri(ctx, tex, [u0, 0], [u1, 0], [u1, h], tl, tr, br)
    this._tri(ctx, tex, [u0, 0], [u1, h], [u0, h], tl, br, bl)
  }

  // light over a face: b at its foot, falling toward bTop (default black) at the top. The same path is
  // stroked as it's filled, so the shading reaches as far as the texture's grown edge
  _shade(ctx, pts, yFoot, yTop, b, bTop = 0) {
    const g = ctx.createLinearGradient(0, yFoot, 0, yTop)
    const col = (bb, k = 1) => {
      const a = Math.min(1, 1 - bb * 0.92), w = bb * bb * k
      return `rgba(${(ROCK_WARM[0] * w) | 0},${(ROCK_WARM[1] * w) | 0},${(ROCK_WARM[2] * w) | 0},${a.toFixed(3)})`
    }
    g.addColorStop(0, col(b))
    g.addColorStop(0.35, col(b * 0.75 + bTop * 0.25, 0.6))
    g.addColorStop(0.8, col(b * 0.2 + bTop * 0.8, 0.3))
    g.addColorStop(1, col(bTop, 0.3))
    this._fillPoly(ctx, pts, g, true)
  }

  _fillPoly(ctx, pts, style, stroke = false) {
    ctx.save()
    ctx.fillStyle = style; ctx.strokeStyle = style; ctx.lineWidth = 2; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.closePath(); ctx.fill(); if (stroke) ctx.stroke()
    ctx.restore()
  }

  _flat(b) {
    const a = Math.min(1, 1 - b * 0.92), w = b * b
    return `rgba(${(WARM[0] * w) | 0},${(WARM[1] * w) | 0},${(WARM[2] * w) | 0},${a.toFixed(3)})`
  }

  _playerRow() {
    const p = this.scene.player
    return p ? p.logicalY / this.scene.tileSize : Infinity
  }

  // ── rock in front of you ─────────────────────────────────────────────────────
  // PGR draws you on a canvas above all the ground, so on the ground canvas no rock can ever hide you.
  // Rock in the rows south of yours -- between you and the camera -- is drawn instead on a canvas of
  // its own ABOVE you: walk behind a wall and it hides you, as solid rock does. At the end of the frame
  // (finish) a faint ghost of you is laid over it, as in d3_sea's hills, so you're never lost.
  _xrayBegin(pgr) {
    const o = this.xc
    if (!o) return
    const src = pgr._objectCanvas, w = src?.width || pgr._sw, h = src?.height || pgr._sh
    if (o.width !== w || o.height !== h) { o.width = w; o.height = h }
    this.xctx.clearRect(0, 0, w, h)
    this._pTileRow = Math.floor(this._playerRow())
  }

  // where rock of row r is drawn: over you if it's south of you, on the ground canvas if not
  _dst(ctx, r) { return this.xray && this.xctx && r > this._pTileRow ? this.xctx : ctx }

  // the scene's onPGRDrawComplete: your ghost, over any rock in front of you
  finish() {
    const pgr = this.pgr, o = this.xctx, src = pgr?._objectCanvas
    const jobs = this._marginJobs; this._marginJobs = []
    for (const j of jobs) this._drawMarginsUnder(j.ctx, pgr, j.c, j.r, j.path, j.q)
    for (const j of this._reflJobs) this._drawReflection(j, pgr)
    this._drawRipples(pgr)
    if (!this.xray || !o || !src || pgr.playerScreenX == null) return
    const s = pgr._scaleAtRow(this._playerRow() + 0.5)
    if (!(s > 0)) return
    const x0 = Math.max(0, Math.floor(pgr.playerScreenX - s * 0.6)), x1 = Math.min(src.width, Math.ceil(pgr.playerScreenX + s * 0.6))
    const y0 = Math.max(0, Math.floor(pgr.playerScreenY - s * 1.9)), y1 = Math.min(src.height, Math.ceil(pgr.playerScreenY + s * 0.15))
    if (x1 <= x0 || y1 <= y0) return
    o.save(); o.globalAlpha = GHOST
    o.drawImage(src, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0)
    o.restore()
  }

  // ── margins of hidden floor ────────────────────────────────────────────────
  // A rock top hides the floor behind it. Where that's floor you can walk on, its edge -- the line
  // between open floor and rock, a hair in on the open side -- shows through the top as a thin yellow
  // line, fading toward the edge of your light: just enough to say "you can walk here". Each top draws
  // the edges of the floor cells it could be hiding, clipped to its own outline (path(ctx) sets it).
  _drawMarginsUnder(ctx, pgr, c, r, path, q) {
    const R = this.torchR * 1.25, IN = MARGIN_IN
    const reach = Math.ceil(this.wallH * (1 + DRESSED_UP)) + 1                      // rows behind it a top can lie over
    const segs = []
    let amax = 0
    // an edge of open cell (cc, rr) facing rock in direction (dx, dy): its two ends meet the next line
    // properly -- pulled in where the boundary turns in (rock beside), pushed out where it turns out
    const edge = (cc, rr, dx, dy) => {
      const tx = -dy, ty = dx                                    // along the edge
      const ox = dx > 0 ? 1 - IN : dx < 0 ? IN : 0, oy = dy > 0 ? 1 - IN : dy < 0 ? IN : 0
      const ends = [-1, 1].map(e => {
        const sx = cc + tx * e, sy = rr + ty * e                 // the next cell along
        if (this.isRock(sx, sy)) return IN                       // turns in: stop short, meet its line
        if (!this.isRock(sx + dx, sy + dy)) return -IN           // turns out: run on to meet it
        return 0
      })
      // the edge's line, from end -1 to end +1, in tile coords
      const base = (e, off) => {
        const t = (e < 0 ? 0 : 1) + (e < 0 ? off : -off)          // 0..1 along the cell side
        const ax = dx !== 0 ? cc + ox : cc + (tx > 0 ? t : 1 - t), ay = dy !== 0 ? rr + oy : rr + (ty > 0 ? t : 1 - t)
        return [ax, ay]
      }
      const [x0, y0] = base(-1, ends[0]), [x1, y1] = base(1, ends[1])
      segs.push([x0, y0, x1, y1])
    }
    // (the floor a top hides lies further from the middle of the view than the top itself -- the top is
    // nearer you, and perspective spreads things out with distance -- so look further out the further
    // the top is from the middle: a line along a wall far to one side would else break between tops)
    const span = 1 + Math.ceil(Math.abs(c + 0.5 - pgr._perspCamCol()) * 0.3)
    for (let rr = r - reach; rr < r; rr++) for (let cc = c - span; cc <= c + span; cc++) {
      if (this.isRock(cc, rr)) continue
      const a = Math.max(0, 1 - Math.hypot(cc + 0.5 - this.px, rr + 0.5 - this.py) / R)
      if (a <= 0.02) continue
      amax = Math.max(amax, a)
      if (this.isRock(cc, rr - 1)) edge(cc, rr, 0, -1)
      if (this.isRock(cc, rr + 1)) edge(cc, rr, 0, 1)
      if (this.isRock(cc - 1, rr)) edge(cc, rr, -1, 0)
      if (this.isRock(cc + 1, rr)) edge(cc, rr, 1, 0)
    }
    if (!segs.length) return
    const G = (gx, gy) => this._P(pgr, gx, gy, this.heightAt(gx, gy))
    // only where the top really covers it: a line that's no more than a sliver in from the top's edge
    // (the top leans a little over floor you can see) isn't drawn. Only edges along open floor count:
    // the seam with the next top is no edge at all, or the line would break wherever it crossed one
    const deep = (pt) => insideBy(q, pt, q.op) > MARGIN_DEEP
    ctx.save(); path(ctx); ctx.clip()
    ctx.lineWidth = MARGIN_W; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'
    // stroked twice, each at the alpha that makes two of them the intended one: where this top's clip
    // meets the next one's, each holds half the line (anti-aliased), and a single stroke leaves a dim seam
    ctx.strokeStyle = `rgba(${MARGIN[0]},${MARGIN[1]},${MARGIN[2]},${(1 - Math.sqrt(1 - amax * MARGIN_A)).toFixed(3)})`
    ctx.beginPath()
    // in short pieces, each kept or not on its own: a line running from one top on under the next is
    // drawn by each where it's deep inside it
    const N = 8
    for (const [ax, ay, bx, by] of segs) {
      let prev = G(ax, ay), on = false
      for (let i = 1; i <= N; i++) {
        const t = i / N, cur = G(ax + (bx - ax) * t, ay + (by - ay) * t)
        if (!prev || !cur) { prev = cur; on = false; continue }
        // (its ends too, not only its middle: a piece lying across the seam between two tops has its
        // middle in one and an end in the other, and the other would leave its half out)
        if (deep({ x: (prev.x + cur.x) / 2, y: (prev.y + cur.y) / 2 }) || deep(prev) || deep(cur)) {
          if (!on) ctx.moveTo(prev.x, prev.y)
          ctx.lineTo(cur.x, cur.y); on = true
        } else on = false
        prev = cur
      }
    }
    ctx.stroke(); ctx.stroke(); ctx.restore()
  }

  // ── rock ───────────────────────────────────────────────────────────────────
  // Solid blocks: every rock cell has a top, and the faces turned toward the camera (south faces of
  // rock with open floor in front, east/west faces of rock beside open floor) rise to it from the floor.
  // All of it opaque: what a block hides stays hidden. In a row's turn: the south faces of the row
  // behind (their feet lie on this row's floor), this row's side faces, then this row's tops.
  _drawRowRock(ctx, pgr, r, behind, sides, rock) {
    const camCol = pgr._perspCamCol()
    if (r === this._lastRow(pgr)) this._nearRows = true      // (drawn after this row's own rock, below)
    for (const c of behind) this._drawFront(this._dst(ctx, r - 1), pgr, r - 1, c)
    // side faces, outermost first, so the ones nearer the middle of the view lie over them
    const vis = sides.filter(s => (s.dir > 0 ? camCol > s.c + 1 : camCol < s.c))
    vis.sort((a, b) => Math.abs(b.c - camCol) - Math.abs(a.c - camCol))
    for (const s of vis) this._drawSide(this._dst(ctx, r), pgr, r, s.c, s.dir)
    this._drawTops(this._dst(ctx, r), pgr, r, rock)
    if (this._nearRows) { this._nearRows = false; this._drawNearRock(ctx, pgr, r) }
  }

  // PGR draws no rows nearer than the one just in front of the camera -- but the rock in those rows
  // still stands over the floor in front of it, at a wall's height. Their tops are drawn here, after
  // the last row PGR draws, with what would fall behind the camera held just in front of it: without
  // them, the floor you've just walked over looked clear while you stood behind rock.
  _drawNearRock(ctx, pgr, last) {
    const FL = pgr.constructor.FOCAL_LENGTH
    const r1 = Math.min(this.H - 1, Math.floor(pgr._perspCamRow() + FL * 0.8))
    for (let r = last + 1; r <= r1; r++) this.rockDraw[r]?.(ctx, pgr)
  }

  // a wall: its foot from grid corner A to grid corner B (n: the way out into the open), rising
  // in two bands. Textured along its length, lit at the foot as the floor there, darker up to its top
  _drawFace(ctx, pgr, A, B, n, uCol, b, tex = this.rockTex) {
    const ca = this._cornerBase(A[0], A[1]), cb = this._cornerBase(B[0], B[1])
    const foot = [ca, ...this._edgeMids(A[0], A[1], B[0], B[1], n), cb]
    const ks = [0, 0.4, 1]
    const grid = []                                     // grid[band][point] on screen
    for (const k of ks) {
      const row = []
      for (const f of foot) {
        const [x, y, z] = this._wallPt(f.base, f.dir, f.flare, k)
        const q = this._P(pgr, x, y, z)
        if (!q) return
        row.push(q)
      }
      grid.push(row)
    }
    const tw = tex.width / TEX_TILES, th = tex.height
    const u0 = (((uCol % TEX_TILES) + TEX_TILES) % TEX_TILES) * tw
    const N = foot.length - 1
    const outline = [...grid[0], ...grid[ks.length - 1].slice().reverse()]
    for (let i = 0; i < ks.length - 1; i++) {
      // texture rows follow the height, so the bands join up
      const v0 = th * (1 - ks[i + 1]), v1 = th * (1 - ks[i])
      for (let j = 0; j < N; j++) {
        const ua = u0 + tw * j / N, ub = u0 + tw * (j + 1) / N
        const bl = grid[i][j], br = grid[i][j + 1], tl = grid[i + 1][j], tr = grid[i + 1][j + 1]
        this._tri(ctx, tex, [ua, v0], [ub, v0], [ub, v1], tl, tr, br)
        this._tri(ctx, tex, [ua, v0], [ub, v1], [ua, v1], tl, br, bl)
      }
    }
    let yFoot = 0, yTop = 0
    for (const q of grid[0]) yFoot += q.y / grid[0].length
    for (const q of grid[ks.length - 1]) yTop += q.y / grid[0].length
    // up to the top's black, so face and top meet without a line
    this._shade(ctx, outline, yFoot, yTop, b, 0)
  }

  _texOf(c, r) { return this.blockTex && this.dressed.has(r * this.W + c) ? this.blockTex : this.rockTex }

  _drawFront(ctx, pgr, r, c) {
    // west corner to east corner, along the line between this rock row and the floor in front
    this._drawFace(ctx, pgr, [c, r + 1], [c + 1, r + 1], [0, 1], c, this.brightAt(c + 0.5, r + 1.15), this._texOf(c, r))
  }

  _drawSide(ctx, pgr, r, c, dir) {
    const x = dir > 0 ? c + 1 : c
    const b = this.brightAt(x + dir * 0.15, r + 0.5) * 0.85
    // drawn as if facing you: an east face runs back-to-front, a west face front-to-back
    const tex = this._texOf(c, r)
    if (dir > 0) this._drawFace(ctx, pgr, [x, r], [x, r + 1], [1, 0], r, b, tex)
    else this._drawFace(ctx, pgr, [x, r + 1], [x, r], [-1, 0], r, b, tex)
  }

  // the top of each rock cell in row r, at the walls' height: an outline through the tops of the faces
  // round it (the same points, so no gap between face and top), filled dark -- rock, unlit from below
  _drawTops(ctx, pgr, r, rock) {
    const camCol = pgr._perspCamCol(), s = this._scaleAt(pgr, r + 1)
    if (!(s > 0)) return
    const half = pgr._sw / 2 / s + 2
    const top = (f) => { const [x, y, z] = this._wallPt(f.base, f.dir, f.flare, 1); return this._P(pgr, x, y, z) }
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = 1.5
    for (const c of rock) {
      if (c < camCol - half || c > camCol + half) continue
      // corners clockwise from north-west; between them, the face-top points along any open side
      const TL = this._cornerBase(c, r), TR = this._cornerBase(c + 1, r), BR = this._cornerBase(c + 1, r + 1), BL = this._cornerBase(c, r + 1)
      // op[i]: the edge from point i to the next runs along open floor (not a seam with another top)
      const pts = [], op = []
      const side = (corner, isOpen, mids) => {
        pts.push(corner); op.push(isOpen)
        if (isOpen) for (const m of mids) { pts.push(m); op.push(true) }
      }
      const oN = !this.isRock(c, r - 1), oE = !this.isRock(c + 1, r), oS = !this.isRock(c, r + 1), oW = !this.isRock(c - 1, r)
      side(TL, oN, oN ? this._edgeMids(c, r, c + 1, r, [0, -1]) : [])
      side(TR, oE, oE ? this._edgeMids(c + 1, r, c + 1, r + 1, [1, 0]) : [])
      side(BR, oS, oS ? this._edgeMids(c, r + 1, c + 1, r + 1, [0, 1]).reverse() : [])
      side(BL, oW, oW ? this._edgeMids(c, r + 1, c, r, [-1, 0]) : [])
      const q = pts.map(top)
      if (q.some(p => !p)) continue
      q.op = op
      const path = (x) => { x.beginPath(); x.moveTo(q[0].x, q[0].y); for (let i = 1; i < q.length; i++) x.lineTo(q[i].x, q[i].y); x.closePath() }
      // the grain: this cell's own quarter of the texture, laid on its corners -- fixed to the rock, so
      // it moves with it. A dark fill under it closes any hairline between cells
      path(ctx); ctx.fillStyle = ctx.strokeStyle = '#000'; ctx.fill(); ctx.stroke()
      // (only near the light: further off it's too dark to see the grain anyway)
      const dist = Math.hypot(c + 0.5 - this.px, r + 0.5 - this.py)
      const near = dist < this.torchR + 1.5
      // the grain shows only close by, fading out by `grain` tiles: beyond it the rock is one dark mass
      // you can only guess at, not a pavement of tiles
      const g1 = this.grain, g0 = g1 * 0.35
      const ga = g1 > 0 ? Math.max(0, Math.min(1, (g1 - dist) / (g1 - g0))) * GRAIN_A : 0
      if (ga > 0.02) {
        const T = 48, u = (c & 1) * T, v = (r & 1) * T
        const [qa, qb, qc, qd] = [TL, TR, BR, BL].map(top)
        ctx.globalAlpha = ga
        this._tri(ctx, this.topTex, [u, v], [u + T, v], [u + T, v + T], qa, qb, qc)
        this._tri(ctx, this.topTex, [u, v], [u + T, v + T], [u, v + T], qa, qc, qd)
        ctx.globalAlpha = 1
      }
      // and the edges of walkable floor it hides: drawn last of all (finish), once every top is down --
      // the next top's outline would otherwise paint over the line where they meet
      if (this.margins && near) this._marginJobs.push({ ctx, c, r, path, q })
    }
    ctx.restore()
  }

  // where open floor meets rock that turns no face to the camera (the far side of a passage from
  // you, or a side you're looking past): the rock's foot still spreads out over the floor, a little,
  // unevenly, black -- so the floor ends in a ragged rock line, not on a tile's straight edge
  _drawRockEdges(ctx, pgr, r, edges) {
    const camCol = pgr._perspCamCol()
    ctx.save(); ctx.fillStyle = '#000'
    for (const { c, side } of edges) {
      let A, B, n
      if (side === 'S') { A = [c, r + 1]; B = [c + 1, r + 1]; n = [0, -1] }
      else if (side === 'E') { if (camCol < c + 1) continue; A = [c + 1, r]; B = [c + 1, r + 1]; n = [-1, 0] }   // its face is drawn
      else { if (camCol > c) continue; A = [c, r]; B = [c, r + 1]; n = [1, 0] }
      const ca = this._cornerBase(A[0], A[1]), cb = this._cornerBase(B[0], B[1])
      const pts = [ca, ...this._edgeMids(A[0], A[1], B[0], B[1], n), cb].map(f => {
        const [x, y, z] = this._wallPt(f.base, f.dir, f.flare, 0)
        return this._P(pgr, x, y, z)
      })
      // and back along the grid line, a little way into the rock
      const back = [B, A].map(([x, y]) => this._P(pgr, x - n[0] * 0.1, y - n[1] * 0.1, this.heightAt(x, y)))
      if (pts.some(q => !q) || back.some(q => !q)) continue
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
      for (const q of [...pts, ...back]) ctx.lineTo(q.x, q.y)
      ctx.closePath(); ctx.fill()
    }
    ctx.restore()
  }

  // ── standing stones ──────────────────────────────────────────────────────────
  // a rough slab, narrowing to an uneven top. Its front and the side you can see.
  _drawStone(ctx, pgr, st) {
    const seed = hash(st.i * 7919 + 13)
    const rnd = (k) => ((hash(seed + k * 101) & 0xffff) / 0xffff)
    const w = 0.42 + rnd(1) * 0.16, d = 0.26 + rnd(2) * 0.08
    // silhouette across the face (s 0..1 left to right) at heights (k 0..1): narrower at the shoulder
    // and the top, the top sloping one way
    const lean = (rnd(3) - 0.5) * 0.12
    const shoulder = 0.62 + rnd(4) * 0.15
    const outline = [
      [0, 0], [1, 0],
      [1 - 0.04, shoulder], [0.82 - rnd(5) * 0.1, 0.94 + rnd(6) * 0.06], [0.35 + rnd(7) * 0.2, 1],
      [0.08, 0.86 + rnd(8) * 0.08], [0.02, shoulder * 0.9],
    ]
    const x0 = st.x - w / 2, x1 = st.x + w / 2, yF = st.y + d / 2, yK = st.y - d / 2
    const base = this.heightAt(st.x, st.y) - 0.05                  // set into the ground a little
    const faceAt = (sx, k, y) => this._P(pgr, x0 + sx * w + lean * k, y, base + k * st.h)
    const front = outline.map(([sx, k]) => faceAt(sx, k, yF))
    if (front.some(p => !p)) return
    const b = Math.max(this.brightAt(st.x, st.y + 0.45), this.brightAt(st.x, st.y - 0.45) * 0.35)
    // the torch is held low, so light falls off up a tall stone -- but not to black: the head of it still
    // catches some (and the flat top, which you look down on)
    const bTop = Math.max(b * 0.55, this._brightUp(st.x, st.y, base + st.h) * 0.9)
    const camCol = pgr._perspCamCol()
    // the side turned toward you: a quad from the front edge back by d
    const side = camCol > x1 ? 1 : camCol < x0 ? 0 : null
    if (side !== null) {
      const kTop = side ? 0.95 : 0.88
      const fF = faceAt(side, 0, yF), fK = faceAt(side, 0, yK)
      const tF = faceAt(side ? 0.96 : 0.02, shoulder, yF), tK = faceAt(side ? 0.96 : 0.02, shoulder, yK)
      const hF = faceAt(side ? 0.8 : 0.1, kTop, yF), hK = faceAt(side ? 0.8 : 0.1, kTop, yK)
      if (fF && fK && tF && tK && hF && hK) {
        const pts = side ? [hK, hF, tF, fF, fK, tK] : [hF, hK, tK, fK, fF, tF]
        this._clipped(ctx, pts, () => this._quad(ctx, this.stoneTex, hK, hF, fF, fK))
        this._shade(ctx, pts, fF.y, hF.y, b * 0.7, bTop * 0.6)
      }
    }
    // front: the texture on the face's box, clipped to its outline
    const bl = faceAt(0, 0, yF), br = faceAt(1, 0, yF), tl = faceAt(0, 1, yF), tr = faceAt(1, 1, yF)
    this._clipped(ctx, front, () => this._quad(ctx, this.stoneTex, tl, tr, br, bl))
    this._shade(ctx, front, bl.y, tl.y, b, bTop)
    // the top: the head of the outline carried back by the stone's depth. You look down on it at about
    // 45 degrees, so it shows as a strip -- the surface that was missing
    const head = [3, 4, 5].map(i => outline[i])
    const capF = head.map(([sx, k]) => faceAt(sx, k, yF)), capK = head.map(([sx, k]) => faceAt(sx, k, yK))
    if (!capF.some(q => !q) && !capK.some(q => !q)) {
      const cap = [...capF, ...capK.slice().reverse()]
      const tb = Math.max(bTop, this._brightUp(st.x, st.y, base + st.h))
      this._clipped(ctx, cap, () => this._quad(ctx, this.stoneTex, capK[0], capK[2], capF[2], capF[0]))
      this._shade(ctx, cap, capF[1].y, capK[1].y, tb, tb * 0.8)
      ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(capK[0].x, capK[0].y)
      for (const q of capK) ctx.lineTo(q.x, q.y)
      ctx.stroke(); ctx.restore()
    }
  }

  _clipped(ctx, pts, fn) {
    ctx.save(); ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.closePath(); ctx.clip(); fn(); ctx.restore()
  }

  destroy() {
    if (this.pgr?._structures === this) this.pgr.setStructures(null)
    this.xc?.remove(); this.xc = null; this.xctx = null
    this.rows = null
  }
}

// how far point p lies inside polygon pts (screen px): its distance to the nearest edge, negative if outside
// (op: if given, op[k] says whether the edge from pts[k] to the next counts for the distance)
function insideBy(pts, p, op) {
  let inside = false, d = Infinity
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j]
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside
    if (op && !op[j]) continue
    const ex = b.x - a.x, ey = b.y - a.y, L = ex * ex + ey * ey || 1
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.y - a.y) * ey) / L))
    d = Math.min(d, Math.hypot(p.x - a.x - ex * t, p.y - a.y - ey * t))
  }
  return inside ? d : -d
}

function hash(n) {
  n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15)
  return n >>> 0
}

function seeded(seed) {
  let s = seed * 9973 + 1
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

// value noise on a grid that wraps (nx by ny cells), sampled at u, v in 0..1
function wrapNoise(rnd, nx, ny) {
  const g = Array.from({ length: ny }, () => Array.from({ length: nx }, rnd))
  return (u, v) => {
    const fx = u * nx, fy = v * ny, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty)
    const at = (i, j) => g[((j % ny) + ny) % ny][((i % nx) + nx) % nx]
    return (at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx) * (1 - sy) + (at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx) * sy
  }
}

// ── the floor: an n x n tile picture of stone, seamless every way ───────────────
// Worn rock, damp hollows, grit, a scatter of small stones and a few cracks, with no straight line in it.
// bed = the pool's bed: darker, smoother, silted.
function makeFloorAtlas(n, px, seed, bed) {
  const S = n * px
  const c = document.createElement('canvas'); c.width = c.height = S
  const x = c.getContext('2d')
  const img = x.createImageData(S, S)
  const rnd = seeded(seed)
  const n1 = wrapNoise(rnd, n, n), n2 = wrapNoise(rnd, n * 3, n * 3), n3 = wrapNoise(rnd, n * 9, n * 9)
  const base = bed ? [48, 48, 54] : [84, 84, 94]       // grey, a breath of violet-blue
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const u = i / S, v = j / S
    const big = n1(u, v), mid = n2(u, v), fine = n3(u, v)
    let k = 0.62 + 0.28 * big + 0.16 * mid + 0.1 * fine + (rnd() - 0.5) * (bed ? 0.05 : 0.12)
    let tint = [1, 1, 1]
    if (big < 0.32) { k *= 0.72; tint = [0.9, 0.95, 1.08] }                 // damp hollows
    if (!bed && mid > 0.7) k *= 1.08                                          // worn high spots
    if (!bed && rnd() < 0.035) k *= rnd() < 0.5 ? 0.6 : 1.35                  // grit
    const o = (j * S + i) * 4
    img.data[o] = base[0] * k * tint[0]; img.data[o + 1] = base[1] * k * tint[1]; img.data[o + 2] = base[2] * k * tint[2]
    img.data[o + 3] = 255
  }
  x.putImageData(img, 0, 0)
  // everything drawn three times over each edge, so the picture still wraps
  const wrapped = (fn) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { x.save(); x.translate(ox, oy); fn(); x.restore() } }
  // small stones: a pale top, a dark lower edge
  const stones = bed ? n * n : n * n * 3
  for (let q = 0; q < stones; q++) {
    const sx = rnd() * S, sy = rnd() * S, r = 1.2 + rnd() * (bed ? 2 : 3.2), ry = r * (0.55 + rnd() * 0.3)
    const tone = bed ? 60 + rnd() * 20 : 95 + rnd() * 45
    wrapped(() => {
      x.fillStyle = `rgba(14,14,20,0.55)`; x.beginPath(); x.ellipse(sx + 0.4, sy + 0.8, r, ry, 0, 0, Math.PI * 2); x.fill()
      x.fillStyle = `rgb(${(tone * 0.96) | 0},${(tone * 0.96) | 0},${tone | 0})`; x.beginPath(); x.ellipse(sx, sy, r, ry, 0, 0, Math.PI * 2); x.fill()
      x.fillStyle = 'rgba(255,240,220,0.12)'; x.beginPath(); x.ellipse(sx - r * 0.3, sy - ry * 0.35, r * 0.5, ry * 0.4, 0, 0, Math.PI * 2); x.fill()
    })
  }
  // cracks: thin, wandering
  if (!bed) {
    x.strokeStyle = 'rgba(12,12,18,0.45)'; x.lineWidth = 1
    for (let q = 0; q < n * 2; q++) {
      const pts = [[rnd() * S, rnd() * S]]
      for (let k = 0; k < 6; k++) { const [px0, py0] = pts[pts.length - 1]; pts.push([px0 + (rnd() - 0.5) * 16, py0 + (rnd() - 0.5) * 16]) }
      wrapped(() => { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (const p of pts) x.lineTo(p[0], p[1]); x.stroke() })
    }
  }
  return c
}

// ── dressed stone: courses of big blocks, weathered, joints dark; one block carries a spiral ──
// (seamless left to right, like the rock; the spiral sits in one quarter of the width, so it shows on
// every fourth face)
function makeBlockTexture(w, h, seed) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d')
  const rnd = seeded(seed)
  const courses = [30, 34, 32, 36, 28]                 // heights, bottom to top, adding to h
  let y = h
  for (let ci = 0; ci < courses.length; ci++) {
    const ch = courses[ci]; y -= ch
    // blocks along the course, widths adding to w exactly, joints staggered from course to course
    const cuts = []; let u = -rnd() * 60
    while (u < w + 120) { cuts.push(u); u += 44 + rnd() * 46 }
    for (let k = 0; k < cuts.length - 1; k++) {
      const u0 = cuts[k], u1 = cuts[k + 1]
      const tone = 0.78 + rnd() * 0.34
      for (const off of [-w, 0, w]) {
        const g = x.createLinearGradient(0, y, 0, y + ch)
        const r0 = 76 * tone, g0 = 76 * tone, b0 = 80 * tone
        g.addColorStop(0, `rgb(${r0 * 1.08 | 0},${g0 * 1.08 | 0},${b0 * 1.08 | 0})`)
        g.addColorStop(1, `rgb(${r0 * 0.82 | 0},${g0 * 0.82 | 0},${b0 * 0.82 | 0})`)
        x.fillStyle = g; x.fillRect(u0 + off, y, u1 - u0, ch)
        // weathering: speckle and pits
        for (let q = 0; q < (u1 - u0) * ch / 90; q++) {
          x.fillStyle = rnd() < 0.5 ? 'rgba(20,20,22,0.18)' : 'rgba(140,140,146,0.1)'
          x.fillRect(u0 + off + rnd() * (u1 - u0), y + rnd() * ch, 1 + rnd() * 2, 1 + rnd())
        }
        // dark joints, a pale lip under the course above
        x.fillStyle = 'rgba(8,8,10,0.85)'; x.fillRect(u0 + off - 1, y, 2, ch); x.fillRect(u0 + off, y + ch - 1.5, u1 - u0, 1.5)
        x.fillStyle = 'rgba(150,150,156,0.12)'; x.fillRect(u0 + off + 1, y + 1, u1 - u0 - 2, 1)
      }
    }
  }
  // a spiral, pecked in one block: a dark groove with a pale lip, near the middle of the second quarter
  const sx = w * 0.375, sy = h * 0.5
  const spiral = (dx, dy, col, lw) => {
    x.strokeStyle = col; x.lineWidth = lw; x.lineCap = 'round'; x.beginPath()
    for (let t = 0; t <= 3.2 * Math.PI * 2; t += 0.12) {
      const rr = 1.2 + t * 1.15
      const px = sx + dx + Math.cos(t) * rr, py = sy + dy + Math.sin(t) * rr
      t === 0 ? x.moveTo(px, py) : x.lineTo(px, py)
    }
    x.stroke()
  }
  spiral(0.8, 0.8, 'rgba(150,150,156,0.22)', 1.6)
  spiral(0, 0, 'rgba(14,14,16,0.6)', 1.4)
  return c
}

// ── rock: a canvas of noise, strata and cracks, seamless left to right ──────────
function makeRockTexture(w, h, [r, g, b], seed) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d')
  const img = x.createImageData(w, h)
  const rnd = seeded(seed)
  const nx1 = Math.max(2, Math.round(w / 40)), nx2 = Math.max(4, Math.round(w / 12))
  const g1 = wrapNoise(rnd, nx1, 4), g2 = wrapNoise(rnd, nx2, 12)
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const u = i / w, v = j / h
    const big = g1(u, v), fine = g2(u, v)
    let k = 0.42 + 0.45 * big + 0.25 * fine + (rnd() - 0.5) * 0.14
    k *= 0.88 + 0.12 * Math.sin(v * 23 + big * 6)                    // strata, wavering
    if (fine > 0.78) k *= 1.15                                        // knobs catching light
    if (big < 0.22) k *= 0.7                                          // hollows
    const o = (j * w + i) * 4
    img.data[o] = r * k; img.data[o + 1] = g * k; img.data[o + 2] = b * k; img.data[o + 3] = 255
  }
  x.putImageData(img, 0, 0)
  // dark cracks, wrapping at the edges
  x.strokeStyle = 'rgba(12,10,8,0.6)'; x.lineWidth = 1.2
  const n = Math.round(w / 20)
  for (let q = 0; q < n; q++) {
    let px = rnd() * w, py = rnd() * h
    for (let k = 0; k < 5; k++) {
      const nx = px + (rnd() - 0.5) * 22, ny = py + rnd() * 18
      for (const off of [-w, 0, w]) { x.beginPath(); x.moveTo(px + off, py); x.lineTo(nx + off, ny); x.stroke() }
      px = nx; py = ny
    }
  }
  return c
}

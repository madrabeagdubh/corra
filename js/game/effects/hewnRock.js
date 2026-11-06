// hewnRock.js
// Location: js/game/effects/hewnRock.js
//
// Rock hewn into levels: every tile of the map is a column with a flat top at its own height, and
// wherever two neighbours differ there is a sheer cut face between them. Stairs are runs of short
// columns (each riser a real face), ledges drop to the floor of a hall below, a cleft falls away into
// the dark, and the rock round a cavern rises out of sight. The map's `hewn` block says what is where
// (tools/map-editor/generators/hewn_test_gen.mjs).
//
//   const h = new HewnRock(scene, opts)     after PGR exists (onEnter)
//   h.update(dtMs)                          every frame, before PGR draws (scene.update)
//   h.draw()                                the scene's onPGRDrawComplete: draws the lot
//   h.walkZ(c, r)                           the height you stand at on a tile, or null (not walkable)
//   h.pick(screenX, screenY)                the walkable tile drawn under a screen point, or null
//   h.destroy()
//   h.rowHooks.push((ctx, r) => ...)       draw something of your own with row r, in front of its rock (hewnFigures.js)
//   opts.warm  [r, g, b]                    the colour of the carried light (default a warm torch)
//   mapData.hewn.block [[x, y]]             floor that can't be walked on (under a river or pool painted over it)
//
// Map (mapData.hewn):
//   kind    rows of characters: '#' rock, '.' floor, '~' water (not walked), 'v' void (no bottom)
//   z       rows of numbers: a floor's height, water's surface, the top of rock (tiles)
//   spans   [{ x, y, z, t, walk }]  a slab whose top is at z, t thick, over the tile's own column:
//           walk 'deck' -- a bridge: you walk on the slab, over whatever is below (a cleft, a stream)
//           walk 'under' -- a lintel or arch: you walk on the floor beneath it
//   lights  [{ x, y, z, r, rgb, i }]  light that is always there (a fire, glow-worms, pale water)
//   props   [{ x, y, z, gid, s }]  an item from the item sheet, standing there (gid), s its size
//           [{ x, y, z, type: 'embers' }]  a dying fire
//   falls   [{ x0, x1, y, z0, z1 }]  water falling from z0 to z1 along the line y, x0..x1
//   mat     rows of characters, the stone of each tile (hewnExtras.js): r hewn (the default), c cave,
//           m masonry, b basalt, w wood, d drystone, o standing slabs; g on water, a green glow
//   hex     [{ x, y, z, r, base, lichen, pool }]  hexagonal basalt columns
//   drips   true: stone dripping from every lip over the void
//   ambient [r, g, b]  a little light everywhere (0..1 each)
//   bg      [colours]  a backdrop, top to bottom, instead of black (a sky)
//   abyss   false: faces into the void don't fade to black (a glow from below can show)
//   grade   { palette, px, strength, source, follow }  the screen drawn again in big pixels and few
//           colours (hewnExtras.js); ?grade=teal|ember|etch|pixel asks for one on any map
//   props of other types, from hewnExtras.js: torch, shaft, mite, box, sprite, arch, mob, ogham, spiral,
//           eyes, eye, cauldron, candles, mist; and over several rows, roots, fish, streak
//
// Drawing: PGR's own floor is left empty; all of this is drawn after it, on its ground canvas, far
// row to near (painter's order: nearer columns cover farther ones), each tile's top and then the faces
// it turns to the camera -- the south face where the tile in front is lower, the east or west face
// where the camera is to that side and the neighbour is lower (thin, as the camera looks straight
// north). Rows in front of you go on a canvas above you, so a block in front hides you; a faint ghost
// of you is laid over it. Rock in those rows -- between you and the camera -- is drawn cut away a little
// above your waist (CUT), its cut tops darker: tall walls behind you would otherwise stand up the screen
// over you and the way ahead. (Only the drawing: it still stops light as the full wall.)
//
// The camera's height follows yours (camZ, the scene eases it): everything is drawn relative to it, so
// you stay where you are on the screen as you climb and descend, and the world rises and falls round you.
//
// Light: a lightmap (SUB pixels a tile) at each tile's own height -- the torch, by 3D distance, stopped
// by any column a ray from the flame passes below the top of -- plus the fixed lights, worked out once.
// Floors take it from a lit copy of the floor texture, multiplied by the light in colour; faces by a
// gradient of the light at their foot and up their height (so tall rock rises into darkness).

import { makeFloorAtlas, seeded, wrapNoise, hash } from './caveWalls.js'
import * as X from './hewnExtras.js'

const K_FLOOR = 0, K_ROCK = 1, K_WATER = 2, K_VOID = 3
const SUB = 4                     // lightmap pixels per tile
const TP = 32                     // floor texture pixels per tile
const FACE_PX = 96                // face texture pixels per tile
const MULTI = {
  roots: { rows: (p) => [Math.floor(p.y0), Math.floor(p.y1)], draw: (h, c, p) => X.drawRoots(h, c, p) },
  fish: { rows: (p) => [Math.floor(p.y - p.rad), Math.floor(p.y + p.rad)], draw: (h, c, p) => X.drawFish(h, c, p) },
  streak: { rows: (p) => [Math.floor(p.y0), Math.ceil(p.y1) - 1], draw: (h, c, p) => X.drawStreak(h, c, p) },
  steps: { rows: (p) => [Math.floor(p.y0), Math.floor(p.y1)], draw: (h, c, p) => X.drawSteps(h, c, p) },
  river: { rows: (p) => X.riverRows(p), draw: (h, c, p) => X.drawRiver(h, c, p), under: true },
  pool: { rows: (p) => X.poolRows(p), draw: (h, c, p) => X.drawPool(h, c, p), under: true },
  stones: { rows: (p) => [Math.floor(p.y0), Math.floor(p.y1)], draw: (h, c, p) => X.drawStones(h, c, p), under: true },
  farrock: { rows: () => [0, 0], draw: (h, c, p) => X.drawFarRock(h, c, p), under: true },
  seafog: { rows: (p) => [p.row0, p.row0], draw: (h, c, p) => X.drawSeaFog(h, c, p) },
  murk: { rows: (p) => [p.y0, p.y1], draw: (h, c, p) => X.drawMurk(h, c, p) },
  wake: { rows: (p) => [p.y0, p.y1], draw: (h, c, p) => X.drawWake(h, c, p), under: true },
}
const ATLAS = 8                   // the floor texture spans this many tiles each way
const VOID_DEPTH = 14             // how far below you a face into the void is drawn (tiles)
const TORCH_Z = 1.1               // how high you hold the torch above your feet
const BOUNCE = 0.2                // light off the rock round corners the flame can't see
const WARM = [1.0, 0.86, 0.7]     // the torch, as a multiplier on what it lights: a warmth over grey stone, not orange
const ROCK_TONE = [76, 74, 76]    // a face's base colour (where a side face is drawn flat)
const TOP_TONE = [40, 39, 42]     // the top of rock
const WATER_TINT = [0.55, 0.68, 0.9]
// pure water (mat 'p' on water): the bed seen through it, nearly black, or a deep clear blue (opts.water); ripples
// spread across it and stars of light come and go on it (_drawRipples)
const PURE = { dark: [0.1, 0.14, 0.22], blue: [0.22, 0.48, 1.05] }
const GHOST = 0.32
const LOD_PX = 9                  // a floor strip less tall than this on the screen is drawn the cheap way
const STRIP_PX = 3                // a floor is laid in strips about this tall on the screen (_strips)
const CUT = 0.9                   // rock between you and the camera is drawn cut off this far above your feet
const FLOOR_GAIN = 1.0            // the floor texture's brightness (light only darkens it)
const ABYSS = [1.2, 4.5]          // a face into the void is lit to this far below its lip, and black by this far

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

export default class HewnRock {
  constructor(scene, opts = {}) {
    this.scene = scene
    this.pgr = scene.perspectiveGround
    const md = scene.mapData, hw = md.hewn
    const W = this.W = md.width, H = this.H = md.height
    this.k = new Uint8Array(W * H)
    this.z = new Float32Array(W * H)
    const KIND = { '#': K_ROCK, '.': K_FLOOR, '~': K_WATER, 'v': K_VOID }
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const i = r * W + c
      this.k[i] = KIND[hw.kind[r]?.[c]] ?? K_ROCK
      this.z[i] = hw.z[r]?.[c] ?? 0
    }
    this.span = new Map()
    for (const s of hw.spans || []) this.span.set(s.y * W + s.x, { ...s, t: s.t ?? 0.6, walk: s.walk || 'deck' })
    this.lights = (hw.lights || []).map(L => ({ x: L.x, y: L.y, z: L.z, r: L.r, i: L.i ?? 1, col: (L.rgb || [255, 255, 255]).map(v => v / 255) }))
    this.props = (hw.props || []).map((p, n) => ({ ...p, n }))
    this.blocked = hw.block?.length ? new Set(hw.block.map(([x, y]) => y * W + x)) : null      // floor under smooth water: not walked on
    this.glints = hw.glints !== false                                                         // the glints of light on water (off where the water should lie still)
    this.ripples = hw.ripples !== false                                                       // the random rings on pure water (off where fish make them)
    // materials, hex columns, dripping lips, a light everywhere, a backdrop (hewnExtras.js)
    this.mat = new Uint8Array(W * H).fill(114)
    if (hw.mat) for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { const ch = hw.mat[r]?.[c]; if (ch && ch !== '.') this.mat[r * W + c] = ch.charCodeAt(0) }
    this.hex = (hw.hex || []).map((h, n) => ({ ...h, n })).sort((a, b) => a.y - b.y)
    this.drips = !!hw.drips
    this.ambient = hw.ambient || null
    this.stoneOnly = hw.stoneOnly || null                                                      // [[x0, y0, x1, y1, below]]: floor lower than `below` there (default just under 0) is only under stones: no faces of its own
    this.floorArt = hw.floorArt || null                                                        // a floor laid by hand (hewnExtras.js paintFloorArt)
    this.bg = hw.bg || null
    this.abyss = hw.abyss !== false
    // a screen grade (hewnExtras.js): the map's own, or one asked for (?grade=teal|ember|etch|pixel)
    this.grade = opts.grade ? { palette: opts.grade === 'pixel' ? null : opts.grade, px: 3, strength: 1 } : (hw.grade || null)
    this.FACE_PX = FACE_PX
    this.falls = hw.falls || []
    this.torchR = opts.torch ?? 6
    this.warm = opts.warm || WARM            // the colour of the light you carry (a ghost's is cold)
    this.waterLook = opts.water || 'dark'    // pure water: 'dark' or 'blue'
    this.rowHooks = []                       // fn(ctx, row): drawn with each row, after its rock and props (figures: hewnFigures.js)
    this.t = 0
    this.camZ = 0
    this.pz = 0

    // per row, the lowest thing in it (for how far back the rows are drawn) and whether it has void
    this.rowMin = new Float32Array(H); this.rowVoid = new Uint8Array(H)
    for (let r = 0; r < H; r++) {
      let m = Infinity
      for (let c = 0; c < W; c++) { const i = r * W + c; if (this.k[i] === K_VOID) this.rowVoid[r] = 1; else m = Math.min(m, this.z[i]) }
      this.rowMin[r] = m
    }

    this._buildTextures()
    this._buildStatic()
    this.lw = W * SUB; this.lh = H * SUB
    this.torchB = new Float32Array(this.lw * this.lh)
    this.visT = new Float32Array(W * H)
    this._visKey = null
    this.lightCv = document.createElement('canvas'); this.lightCv.width = this.lw; this.lightCv.height = this.lh
    this.lightCtx = this.lightCv.getContext('2d')
    this.lightImg = this.lightCtx.createImageData(this.lw, this.lh)
    this.litCv = document.createElement('canvas'); this.litCtx = this.litCv.getContext('2d')

    // the canvas over you: above the player (objects, z 3), as caveWalls' is
    const box = this.pgr._objectCanvas?.parentElement
    if (box) {
      this.xc = document.createElement('canvas')
      this.xc.id = 'hewn-over'
      this.xc.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:4;pointer-events:none'
      box.appendChild(this.xc)
      this.xctx = this.xc.getContext('2d')
    }
    this._polys = []
  }

  // ── what is where ──────────────────────────────────────────────────────────
  _i(c, r) { return c < 0 || r < 0 || c >= this.W || r >= this.H ? -1 : r * this.W + c }
  kindAt(c, r) { const i = this._i(c, r); return i < 0 ? K_ROCK : this.k[i] }
  isWater(c, r) { return this.kindAt(c, r) === K_WATER }

  // the column's height, for the faces between tiles: void has no bottom (and a span's slab is not a column)
  colZ(c, r) {
    const i = this._i(c, r)
    if (i < 0) return 99
    return this.k[i] === K_VOID ? -Infinity : this.z[i]
  }

  // the surface the light falls on: a bridge's deck, else the floor or water; none for rock and void
  surfZ(c, r) {
    const i = this._i(c, r)
    if (i < 0) return null
    const s = this.span.get(i)
    if (s && s.walk === 'deck') return s.z
    const k = this.k[i]
    return k === K_FLOOR || k === K_WATER ? this.z[i] : null
  }

  walkZ(c, r) {
    const i = this._i(c, r)
    if (i < 0) return null
    const s = this.span.get(i)
    if (this.blocked?.has(i) && !(s && s.walk === 'deck')) return null       // under smooth water, unless bridged
    if (s) return s.walk === 'deck' ? s.z : (this.k[i] === K_FLOOR ? this.z[i] : null)
    return this.k[i] === K_FLOOR ? this.z[i] : null
  }

  // ── textures ───────────────────────────────────────────────────────────────
  _buildTextures() {
    const { W, H } = this
    const floor = makeHewnFloor(ATLAS, TP, 11)
    const bed = makeFloorAtlas(ATLAS, TP, 12, true)
    this.mats = X.makeMaterials(ATLAS, TP, FACE_PX, floor, makeHewnTexture(FACE_PX * 2, FACE_PX * 2, 21))
    // the whole map's floor, one picture: the floor texture where there is floor (or a deck), the bed
    // tinted cold where there is water, black elsewhere
    const base = this.base = document.createElement('canvas')
    base.width = W * TP; base.height = H * TP
    const b = base.getContext('2d')
    b.fillStyle = '#000'; b.fillRect(0, 0, base.width, base.height)
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const i = r * W + c, s = this.span.get(i)
      const deck = s && s.walk === 'deck'
      const k = this.k[i]
      if (!deck && k !== K_FLOOR && k !== K_WATER) continue
      const m = String.fromCharCode(this.mat[i])
      const src = !deck && k === K_WATER ? bed : (this.mats[deck && m === 'r' ? 'r' : m] || this.mats.r).floor
      b.drawImage(src, (c % ATLAS) * TP, (r % ATLAS) * TP, TP, TP, c * TP, r * TP, TP, TP)
    }
    const img = b.getImageData(0, 0, base.width, base.height), d = img.data
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const i = r * W + c, s = this.span.get(i)
      const wet = this.k[i] === K_WATER && !(s && s.walk === 'deck')
      const green = wet && this.mat[i] === 103, pure = wet && this.mat[i] === 112
      const g = pure ? PURE[this.waterLook] || PURE.dark : green ? [0.5, 1.9, 1.0] : wet ? [WATER_TINT[0] * 1.3, WATER_TINT[1] * 1.3, WATER_TINT[2] * 1.3] : [FLOOR_GAIN, FLOOR_GAIN, FLOOR_GAIN * 0.98]
      for (let y = r * TP; y < (r + 1) * TP; y++) for (let x = c * TP; x < (c + 1) * TP; x++) {
        const o = (y * base.width + x) * 4
        d[o] = Math.min(255, d[o] * g[0]); d[o + 1] = Math.min(255, d[o + 1] * g[1]); d[o + 2] = Math.min(255, d[o + 2] * g[2])
      }
    }
    b.putImageData(img, 0, 0)
    if (this.floorArt) {
      const gc = this.glow = document.createElement('canvas'); gc.width = base.width; gc.height = base.height
      X.paintFloorArt(this, b, TP, gc.getContext('2d'))
    }
    // faces: rough hewn stone, seamless every way, laid on in world space so neighbouring faces run on
    this.faceTex = makeHewnTexture(FACE_PX * 2, FACE_PX * 2, 21)
    this._facePat = null
  }

  // ── fixed light, worked out once ───────────────────────────────────────────
  // For each fixed light: which tiles it sees (a few points on each, by 3D rays), and the colour it puts
  // on every lightmap pixel. Rock tops get a share of every light by distance alone.
  _buildStatic() {
    const { W, H } = this, lw = W * SUB, lh = H * SUB
    this.stat = new Float32Array(lw * lh * 3)
    this.statTop = new Float32Array(W * H * 3)
    this.visS = this.lights.map(() => new Float32Array(W * H))
    const PTS = [[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]
    this.lights.forEach((L, li) => {
      const vis = this.visS[li]
      const r0 = Math.max(0, Math.floor(L.y - L.r - 1)), r1 = Math.min(H - 1, Math.ceil(L.y + L.r + 1))
      const c0 = Math.max(0, Math.floor(L.x - L.r - 1)), c1 = Math.min(W - 1, Math.ceil(L.x + L.r + 1))
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const sz = this.surfZ(c, r)
        if (sz === null) {
          // a rock top: by distance only
          if (this.kindAt(c, r) === K_ROCK) {
            const f = this._fallL(Math.hypot(c + 0.5 - L.x, r + 0.5 - L.y, (this.z[r * W + c] - L.z) * 0.8), L.r) * L.i
            for (let q = 0; q < 3; q++) this.statTop[(r * W + c) * 3 + q] += L.col[q] * f
          }
          continue
        }
        let hits = 0
        for (const [ox, oy] of PTS) if (this._ray(L.x, L.y, L.z, c + ox, r + oy, sz + 0.02, c, r)) hits++
        vis[r * W + c] = Math.min(1, hits / 2.5)
      }
      const x0 = Math.max(0, Math.floor((L.x - L.r) * SUB)), x1 = Math.min(lw, Math.ceil((L.x + L.r) * SUB))
      const y0 = Math.max(0, Math.floor((L.y - L.r) * SUB)), y1 = Math.min(lh, Math.ceil((L.y + L.r) * SUB))
      for (let y = y0; y < y1; y++) {
        const wy = (y + 0.5) / SUB, r = Math.floor(wy)
        for (let x = x0; x < x1; x++) {
          const wx = (x + 0.5) / SUB, c = Math.floor(wx)
          const v = vis[r * W + c]
          if (!v) continue
          const sz = this.surfZ(c, r)
          const f = this._fallL(Math.hypot(wx - L.x, wy - L.y, (sz - L.z) * 0.8), L.r) * v * L.i
          if (f <= 0) continue
          const o = (y * lw + x) * 3
          this.stat[o] += L.col[0] * f; this.stat[o + 1] += L.col[1] * f; this.stat[o + 2] += L.col[2] * f
        }
      }
    })
    this._faceStatic = new Map()        // a face's fixed light at a few heights, worked out when first drawn
    if (this.ambient) {
      const A = this.ambient
      for (let i = 0; i < this.stat.length; i += 3) { this.stat[i] += A[0]; this.stat[i + 1] += A[1]; this.stat[i + 2] += A[2] }
      for (let i = 0; i < this.statTop.length; i += 3) { this.statTop[i] += A[0]; this.statTop[i + 1] += A[1]; this.statTop[i + 2] += A[2] }
    }
  }

  // fall-off with distance (tiles): bright at the source, gone by R
  _fallL(d, R) {
    if (d >= R) return 0
    const u = d / R
    return Math.pow(1 - u, 1.4) * (1 - 0.25 * u)
  }

  // Can a light at (ax, ay, az) see the point (bx, by, bz) in tile (tc, tr)? A ray in 3D: stopped by
  // any tile it passes over lower than that tile's column (rock, a ledge, a riser).
  _ray(ax, ay, az, bx, by, bz, tc, tr) {
    const d = Math.hypot(bx - ax, by - ay)
    const n = Math.max(1, Math.ceil(d * 3))
    for (let k = 1; k < n; k++) {
      const t = k / n
      const cx = Math.floor(ax + (bx - ax) * t), cy = Math.floor(ay + (by - ay) * t)
      if (cx === tc && cy === tr) return true
      const zr = az + (bz - az) * t
      if (this.colZ(cx, cy) > zr + 0.02) return false
    }
    return true
  }

  // ── each frame ─────────────────────────────────────────────────────────────
  // camZ: the camera's height; pz: yours (both eased by the scene)
  update(dt, pz = this.pz, camZ = this.camZ) {
    this.t += dt / 1000
    this.pz = pz; this.camZ = camZ
    const p = this.scene.player
    if (!p) return
    const ts = this.scene.tileSize
    const px = this.px = p.logicalX / ts, py = this.py = p.logicalY / ts
    const flick = 1 + 0.035 * Math.sin(this.t * 2.3) + 0.025 * Math.sin(this.t * 11.7 + 1.3) + 0.015 * Math.sin(this.t * 23.1)
    this.R = this.torchR * flick
    this.tz = pz + TORCH_Z
    this._torch(px, py, this.tz, this.R)
  }

  _torchVis(px, py, tz, R) {
    const key = `${Math.floor(px * 4)},${Math.floor(py * 4)},${Math.round(tz * 4)},${Math.ceil(R)}`
    if (key === this._visKey) return
    this._visKey = key
    const { W, H, visT } = this
    if (this._visBox) { const [c0, r0, c1, r1] = this._visBox; for (let r = r0; r <= r1; r++) visT.fill(0, r * W + c0, r * W + c1 + 1) }
    const r0 = Math.max(0, Math.floor(py - R - 1)), r1 = Math.min(H - 1, Math.ceil(py + R + 1))
    const c0 = Math.max(0, Math.floor(px - R - 1)), c1 = Math.min(W - 1, Math.ceil(px + R + 1))
    this._visBox = [c0, r0, c1, r1]
    const pc = Math.floor(px), pr = Math.floor(py)
    const PTS = [[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const sz = this.surfZ(c, r)
      if (sz === null) continue
      if (Math.hypot(c + 0.5 - px, r + 0.5 - py) > R + 1) continue
      if (Math.abs(c - pc) <= 1 && Math.abs(r - pr) <= 1 && Math.abs(sz - (tz - TORCH_Z)) < 0.6) { visT[r * W + c] = 1; continue }
      let hits = 0
      for (const [ox, oy] of PTS) if (this._ray(px, py, tz, c + ox, r + oy, sz + 0.02, c, r)) hits++
      visT[r * W + c] = Math.min(1, hits / 2.5)
    }
  }

  _torch(px, py, tz, R) {
    this._torchVis(px, py, tz, R)
    const { W, lw, lh, torchB, visT } = this
    if (this._tBox) { const [x0, y0, x1, y1] = this._tBox; for (let y = y0; y < y1; y++) torchB.fill(0, y * lw + x0, y * lw + x1) }
    const x0 = Math.max(0, Math.floor((px - R) * SUB)), x1 = Math.min(lw, Math.ceil((px + R) * SUB) + 1)
    const y0 = Math.max(0, Math.floor((py - R) * SUB)), y1 = Math.min(lh, Math.ceil((py + R) * SUB) + 1)
    this._tBox = [x0, y0, x1, y1]
    for (let y = y0; y < y1; y++) {
      const wy = (y + 0.5) / SUB, r = Math.floor(wy)
      for (let x = x0; x < x1; x++) {
        const wx = (x + 0.5) / SUB, c = Math.floor(wx)
        const sz = this.surfZ(c, r)
        if (sz === null) continue
        const d = Math.hypot(wx - px, wy - py, (sz - tz) * 0.8)
        if (d >= R) continue
        const v = visT[r * W + c]
        torchB[y * lw + x] = Math.max(this._fallL(d, R * 0.8) * Math.max(v, BOUNCE), this._fallL(d, R) * v)
      }
    }
  }

  // the light at a point (x, y, z) in colour, 0..1 each: the torch (if a ray reaches it) and the fixed
  // lights (if they see tile oc). Used for faces, props and falls.
  lightAt(x, y, z, oc, staticToo = true) {
    let R0 = 0, G0 = 0, B0 = 0
    if (this.px !== undefined) {
      const d = Math.hypot(x - this.px, y - this.py, (z - this.tz) * 0.8)
      if (d < this.R) {
        const seen = this._ray(this.px, this.py, this.tz, x, y, z, Math.floor(x), Math.floor(y)) ? 1 : 0
        const f = Math.max(this._fallL(d, this.R * 0.8) * Math.max(seen, BOUNCE), this._fallL(d, this.R) * seen)
        const Wm = this.warm; R0 += Wm[0] * f; G0 += Wm[1] * f; B0 += Wm[2] * f
      }
    }
    if (staticToo && oc >= 0) {
      for (let li = 0; li < this.lights.length; li++) {
        const v = this.visS[li][oc]
        if (!v) continue
        const L = this.lights[li]
        const f = this._fallL(Math.hypot(x - L.x, y - L.y, (z - L.z) * 0.8), L.r) * v * L.i
        if (f <= 0) continue
        R0 += L.col[0] * f; G0 += L.col[1] * f; B0 += L.col[2] * f
      }
    }
    if (staticToo && this.ambient) { R0 += this.ambient[0]; G0 += this.ambient[1]; B0 += this.ambient[2] }
    return [clamp01(R0), clamp01(G0), clamp01(B0)]
  }

  // ── projection ─────────────────────────────────────────────────────────────
  // PGR's camera (a level eye with its picture shifted up, so it looks down), heights measured from camZ.
  // Written out so it reaches the rows between the camera's ground row and its eye, which PGR doesn't.
  _frameCam() {
    const g = this.pgr, C = g.constructor
    const FL = C.FOCAL_LENGTH
    this.cam = {
      FL, sw: g._sw, sh: g._sh, hz: g._horizonPx(), gH: g._groundH(),
      row: g._perspCamRow(), col: g._perspCamCol(),
      k0: g._pxPerTileAtPlayer() * (FL + C.PLAYER_DIST_TILES), z: this.camZ,
    }
  }
  _k(y) { const C = this.cam, d = C.row - y; return d <= -C.FL * 0.85 ? 0 : C.k0 / (C.FL + d) }
  _P(x, y, z) {
    const C = this.cam, d = C.row - y
    if (d <= -C.FL * 0.85) return null
    const k = C.k0 / (C.FL + d)
    return { x: C.sw / 2 + (x - C.col) * k, y: C.hz + C.gH * C.FL / (C.FL + d) - (z - C.z) * k }
  }
  _X(x, y) { return this.cam.sw / 2 + (x - this.cam.col) * this._k(y) }
  _Y(y, z) { const C = this.cam, d = C.row - y; return C.hz + C.gH * C.FL / (C.FL + d) - (z - C.z) * C.k0 / (C.FL + d) }

  // ── drawing ────────────────────────────────────────────────────────────────
  draw() {
    const g = this.pgr, gctx = g?._gCtx
    if (!gctx || !g._sw) return
    this._frameCam()
    const C = this.cam
    this._polys = []
    const pRow = this._pRow = this.scene.player ? Math.floor(this.scene.player.logicalY / this.scene.tileSize) : -1
    this._py = this.scene.player ? this.scene.player.logicalY / this.scene.tileSize : -1; this._px = this.scene.player ? (this.scene.player.logicalX ?? 0) / this.scene.tileSize : 0
    this._cut = this.pz + CUT

    gctx.save()
    gctx.setTransform(1, 0, 0, 1, 0, 0)
    gctx.globalCompositeOperation = 'source-over'; gctx.globalAlpha = 1
    if (this.bg) {
      const g = gctx.createLinearGradient(0, 0, 0, gctx.canvas.height)
      this.bg.forEach((c, q) => g.addColorStop(q / (this.bg.length - 1), c))
      gctx.fillStyle = g
    } else gctx.fillStyle = '#000'
    gctx.fillRect(0, 0, gctx.canvas.width, gctx.canvas.height)
    const o = this.xctx
    if (o) {
      const src = g._objectCanvas, w = src?.width || C.sw, h = src?.height || C.sh
      if (this.xc.width !== w || this.xc.height !== h) { this.xc.width = w; this.xc.height = h }
      o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, w, h)
    }

    // which rows: from the nearest the camera can see to the furthest whose lowest point is still on the screen
    // a row is drawn if anything in it can reach the screen: its lowest floor, or the foot of a face
    // falling from it to the row in front (so a hall far below a ledge still shows)
    const near = Math.min(this.H - 1, Math.floor(C.row + C.FL * 0.8))
    let far = near + 1
    for (let r = 0; r <= near; r++) {
      if (!(this._k(r) > 0)) continue
      let lo = Math.min(this.rowMin[r], r + 1 < this.H ? this.rowMin[r + 1] : Infinity)
      if (this.rowVoid[r] || (r + 1 < this.H && this.rowVoid[r + 1])) lo = C.z - VOID_DEPTH
      if (this._Y(r + 1, Math.max(lo, C.z - VOID_DEPTH)) >= -8) { far = r; break }
    }
    if (far > near) { gctx.restore(); return }
    const cols = []
    let wc0 = this.W, wc1 = 0
    for (let r = far; r <= near; r++) {
      const kf = this._k(r) || this._k(r + 1)
      if (!kf) { cols[r] = null; continue }
      const c0 = Math.max(0, Math.floor(C.col - C.sw / 2 / kf) - 1), c1 = Math.min(this.W - 1, Math.ceil(C.col + C.sw / 2 / kf) + 1)
      cols[r] = [c0, c1]; wc0 = Math.min(wc0, c0); wc1 = Math.max(wc1, c1)
    }
    if (wc1 < wc0) { gctx.restore(); return }
    this._buildLit()

    for (let r = far; r <= near; r++) {
      if (!cols[r]) continue
      const dst = r > pRow && o ? o : gctx
      this._drawRow(dst, r, cols[r][0], cols[r][1])
    }
    gctx.restore()
    this._ghost()
    if (this.grade) {
      const st = X.gradeStrength(this, this.grade)
      X.applyGrade(this, gctx.canvas, this.grade, st)
      if (this.xc) X.applyGrade(this, this.xc, this.grade, st)
    }
  }

  // The whole map's floor, lit: the floor texture with the light multiplied over it (in colour). Made
  // once; after that, each frame, only the patch round the torch (where it is and where it was) is made
  // again -- the fixed lights don't change.
  _buildLit() {
    const { W, H, lw, stat, torchB } = this
    const cv = this.litCv, l = this.litCtx
    let c0, r0, c1, r1
    if (!this._litReady) {
      cv.width = W * TP; cv.height = H * TP
      c0 = 0; r0 = 0; c1 = W - 1; r1 = H - 1
      this._litReady = true
    } else {
      const a = this._tBox, b = this._litPrev || a
      if (!a) return
      c0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) / SUB) - 1); r0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) / SUB) - 1)
      c1 = Math.min(W - 1, Math.ceil(Math.max(a[2], b[2]) / SUB) + 1); r1 = Math.min(H - 1, Math.ceil(Math.max(a[3], b[3]) / SUB) + 1)
    }
    this._litPrev = this._tBox
    // the lightmap there as a picture: fixed light plus the torch
    const d = this.lightImg.data
    const y0 = r0 * SUB, y1 = (r1 + 1) * SUB, x0 = c0 * SUB, x1 = (c1 + 1) * SUB
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const p = y * lw + x, q = p * 3, t = torchB[p], o4 = p * 4, Wm = this.warm
      d[o4] = clamp01(stat[q] + Wm[0] * t) * 255
      d[o4 + 1] = clamp01(stat[q + 1] + Wm[1] * t) * 255
      d[o4 + 2] = clamp01(stat[q + 2] + Wm[2] * t) * 255
      d[o4 + 3] = 255
    }
    this.lightCtx.putImageData(this.lightImg, 0, 0, x0, y0, x1 - x0, y1 - y0)
    const X = c0 * TP, Y = r0 * TP, w = (c1 - c0 + 1) * TP, h = (r1 - r0 + 1) * TP
    l.globalCompositeOperation = 'source-over'; l.imageSmoothingEnabled = false
    l.drawImage(this.base, X, Y, w, h, X, Y, w, h)
    l.globalCompositeOperation = 'multiply'; l.imageSmoothingEnabled = true
    l.drawImage(this.lightCv, x0, y0, x1 - x0, y1 - y0, X, Y, w, h)
    if (this.glow) { l.globalCompositeOperation = 'lighter'; l.drawImage(this.glow, X, Y, w, h, X, Y, w, h) }
    l.globalCompositeOperation = 'source-over'
  }

  // you pressed against the pool's edge (hewnTest.js isColliding): a ring goes out from the water's edge nearest you, at most
  // once in a while. (x, y: where you are, in tiles.)
  // On open water (no pool) the ring goes out from the point pressed on (ex, ey).
  bump(x, y, ex = x, ey = y) {
    const pool = this.props.find(p => p.type === 'pool')
    if (!(pool || this.props.some(p => p.type === 'wake')) || (this._bumpT !== undefined && this.t - this._bumpT < 1.3)) return
    if (pool && ((ex - pool.x) / (pool.rx + 1.5)) ** 2 + ((ey - pool.y) / (pool.ry + 1.5)) ** 2 > 1) return     // (other water in the hall: a stream's channel)
    this._bumpT = this.t
    const th = pool && Math.atan2((y - pool.y) / pool.ry, (x - pool.x) / pool.rx)
    ;(this.bumps || (this.bumps = [])).push(pool ? { x: pool.x + pool.rx * Math.cos(th), y: pool.y + pool.ry * Math.sin(th), t0: this.t } : { x: ex, y: ey, t0: this.t })
    if (this.bumps.length > 4) this.bumps.shift()
  }

  // a column's height as drawn: rock south of you cut away (see CUT)
  _dz(c, r) {
    const z = this.colZ(c, r)
    if (!(r > this._pRow && z > this._cut) || this.kindAt(c, r) !== K_ROCK) return z
    // cut away by degrees, not at once: the rock a tile ahead of you comes down as you near it, so a wall does not stand up
    // the moment you reach its row
    const u = Math.min(1, Math.max(0, r - this._py)), f = u * u * (3 - 2 * u)
    return z - (z - this._cut) * f
  }

  _drawRow(ctx, r, c0, c1) {
    const pz = this.pz
    // a far row, thin on the screen: its whole floor laid in one go (where there is rock the picture is black, and
    // the rock's tops go over it), instead of a piece for every run of one height
    this._rowLaid = false
    {
      const zm = this.rowMin[r], ya = this._Y(r, zm), yb = this._Y(r + 1, zm)
      if (yb - ya < LOD_PX && yb > -2 && ya < this.cam.sh + 2 && zm < 90) {
        const xl = this._X(c0, r + 1), xr = this._X(c1 + 1, r + 1)
        ctx.drawImage(this.litCv, c0 * TP, r * TP, (c1 - c0 + 1) * TP, TP, Math.floor(xl), Math.floor(ya), Math.ceil(xr - xl) + 1, Math.ceil(yb - ya) + 1)
        this._rowLaid = true
      }
    }
    // tops, in runs of the same height and kind
    let c = c0
    while (c <= c1) {
      const i = r * this.W + c, k = this.k[i], z = k === K_ROCK ? this._dz(c, r) : this.z[i]
      let e = c
      while (e + 1 <= c1 && e + 1 - c < ATLAS) {
        const j = i + (e + 1 - c)
        const zj = this.k[j] === K_ROCK ? this._dz(e + 1, r) : this.z[j]
        if (this.k[j] !== k || zj !== z || this.span.has(j) !== this.span.has(i)) break
        e++
      }
      if (k === K_ROCK) this._rockTops(ctx, r, c, e, z, z < this.z[i] - 0.01)
      else if (k !== K_VOID) this._floorTop(ctx, r, c, e, z, k === K_FLOOR && this.walkZ(c, r) !== null && !(this.span.get(i)?.walk === 'deck'))
      c = e + 1
    }
    // smooth water painted over the floor (a river, a pool): before the faces and the slabs, which go over it
    for (const p of this.props) {
      const m = MULTI[p.type]
      if (!m || !m.under) continue
      const [r0, r1] = m.rows(p)
      if (r >= r0 && r <= r1) { p.row = r; m.draw(this, ctx, p) }
    }
    // faces
    for (let c = c0; c <= c1; c++) {
      const zt = this._dz(c, r)
      if (zt === -Infinity) continue
      if (this.stoneOnly && this.k[r * this.W + c] === K_FLOOR && this.stoneOnly.some(([a, b, e, f, zm = -0.005]) => zt < zm && c >= a && c <= e && r >= b && r <= f)) continue
      const zs = this._dz(c, r + 1)
      if (zt > zs + 0.01) this._southFace(ctx, c, r, zt, zs)
      const ze = this._dz(c + 1, r), zw = this._dz(c - 1, r)
      if (zt > ze + 0.01 && this.cam.col > c + 1) this._sideFace(ctx, c, r, c + 1, zt, ze)
      if (zt > zw + 0.01 && this.cam.col < c) this._sideFace(ctx, c, r, c, zt, zw)
    }
    this._drawGlints(ctx, r, c0, c1)
    this._drawRipples(ctx, r, c0, c1)
    for (const f of this.falls) if (Math.floor(f.y) === r) this._drawFall(ctx, f)
    // slabs over the row (bridges, lintels): after its columns; one over you goes on the canvas above you
    for (let c = c0; c <= c1; c++) {
      const s = this.span.get(r * this.W + c)
      if (!s) continue
      const over = this.xctx && r === this._pRow && s.walk === 'under' && pz < s.z - s.t ? this.xctx : ctx
      this._slab(over, c, r, s)
    }
    for (const hx of this.hex) if (Math.floor(hx.y) === r) X.drawHex(this, ctx, hx)
    for (const p of this.props) if (!MULTI[p.type] && (p.type === 'arch' || p.type === 'span' ? Math.ceil(p.y) - 1 : Math.floor(p.y)) === r) this._drawProp(ctx, p)
    // set pieces that run over several rows: drawn a row's slice at a time
    for (const p of this.props) {
      const m = MULTI[p.type]
      if (!m || m.under) continue
      const [r0, r1] = m.rows(p)
      if (r >= r0 && r <= r1) { p.row = r; m.draw(this, ctx, p) }
    }
    for (const f of this.rowHooks) f(ctx, r)
  }

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
    const gx = (p) => p.x + Math.sign(p.x - cx) * 0.8, gy = (p) => p.y + Math.sign(p.y - cy) * 0.8
    ctx.moveTo(gx(p0), gy(p0)); ctx.lineTo(gx(p1), gy(p1)); ctx.lineTo(gx(p2), gy(p2)); ctx.closePath(); ctx.clip()
    ctx.setTransform(a, b, c, d, e, f)
    ctx.drawImage(img, 0, 0)
    ctx.restore()
  }

  // a floor (or water) top, tiles c0..c1 of row r at height z, from the lit floor picture
  _floorTop(ctx, r, c0, c1, z, walk) {
    const tl = this._P(c0, r, z), tr = this._P(c1 + 1, r, z), br = this._P(c1 + 1, r + 1, z), bl = this._P(c0, r + 1, z)
    if (!tl || !tr || !br || !bl) return
    if (bl.y < -2 || tl.y > this.cam.sh + 2) { this._polys.push({ pts: [tl, tr, br, bl], r, z, walk, c0, c1 }); return }
    const u0 = c0 * TP, u1 = (c1 + 1) * TP, v0 = r * TP, v1 = v0 + TP
    this._polys.push({ pts: [tl, tr, br, bl], r, z, walk, c0, c1 })
    if (bl.y - tl.y < LOD_PX) {
      // far off and thin on the screen: the picture laid straight into the strip, no warping (it can't be seen) --
      // and if the whole row was laid at once already (_drawRow), nothing more
      if (!this._rowLaid) ctx.drawImage(this.litCv, u0, v0, u1 - u0, TP, Math.floor(bl.x), Math.floor(tl.y), Math.ceil(br.x - bl.x) + 1, Math.ceil(bl.y - tl.y) + 1)
      return
    }
    this._strips(ctx, this.litCv, r, c0, c1, z, u0, u1, v0, tl.y, bl.y)
    this._edges(ctx, r, c0, c1, z)
  }

  // The floor laid in thin horizontal strips, each a plain stretched copy of its slice of the picture: the camera looks
  // straight north, so across any one line of the screen the floor is evenly spread, and only down it does the
  // perspective change -- which strips this thin follow closely. (Two clipped, warped triangles did the same at
  // several times the cost.) Strips meet at the same x on both sides of a seam, so neighbouring runs close up.
  _strips(ctx, img, r, c0, c1, z, u0, u1, v0, ya, yb) {
    const C = this.cam, H = yb - ya
    const n = Math.max(2, Math.min(40, Math.ceil(H / STRIP_PX)))
    const num = C.gH * C.FL - (z - C.z) * C.k0           // screen y - horizon = num / (FL + d), d = camera row - y
    const rowAt = (Y) => C.row - (num / Math.max(1e-3, Y - C.hz) - C.FL)
    ctx.imageSmoothingEnabled = false
    for (let i = 0; i < n; i++) {
      const y0 = ya + H * i / n, y1 = ya + H * (i + 1) / n
      const ra = Math.max(r, Math.min(r + 1, rowAt(y0))), rb = Math.max(r, Math.min(r + 1, rowAt(y1)))
      const ym = rowAt((y0 + y1) / 2), xl = this._X(c0, ym), xr = this._X(c1 + 1, ym)
      const sv = v0 + (ra - r) * TP, sh = Math.max(0.5, (rb - ra) * TP)
      ctx.drawImage(img, u0, sv, u1 - u0, sh, xl - 0.35, y0 - 0.35, xr - xl + 0.7, y1 - y0 + 0.7)
    }
  }

  // Where a tile meets something higher, the floor darkens toward its foot (light can't get in there);
  // where it falls away beyond (to the north, the edge you look over), a pale lip.
  _edges(ctx, r, c0, c1, z) {
    const AO = 0.32, LIP = 0.05
    for (let c = c0; c <= c1; c++) {
      const n = this.colZ(c, r - 1), e = this.colZ(c + 1, r), w = this.colZ(c - 1, r)
      if (n > z + 0.05) {
        const a = this._P(c, r, z), b = this._P(c + 1, r, z), m = this._P(c, r + AO, z)
        if (a && b && m) {
          const g = ctx.createLinearGradient(0, a.y, 0, m.y)
          g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = g; ctx.fillRect(Math.floor(a.x), a.y, Math.ceil(b.x - a.x), m.y - a.y)
        }
      } else if (n < z - 0.3) {
        const a = this._P(c, r, z), b = this._P(c + 1, r, z)
        if (a && b) {
          const L = this.lightAt(c + 0.5, r + 0.02, z + 0.05, this._i(c, r), false)
          const v = Math.max(L[0], L[1], L[2])
          if (v > 0.05) {
            ctx.fillStyle = `rgba(235,220,200,${Math.min(0.45, v * 0.6).toFixed(3)})`
            ctx.fillRect(Math.floor(a.x), Math.round(a.y), Math.ceil(b.x - a.x), Math.max(1, Math.round(this._k(r) * LIP * 0.4)))
          }
        }
      }
      for (const [nz, x, dir] of [[e, c + 1, -1], [w, c, 1]]) {
        if (!(nz > z + 0.05)) continue
        const a = this._P(x, r, z), b = this._P(x, r + 1, z), a2 = this._P(x + dir * AO, r, z), b2 = this._P(x + dir * AO, r + 1, z)
        if (!a || !b || !a2 || !b2) continue
        const g = ctx.createLinearGradient(a.x, 0, a2.x, 0)
        g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(a2.x, a2.y); ctx.closePath(); ctx.fill()
      }
    }
  }

  // rock tops: dark, lit only a little (the light is below them), each tile on its own; cut away (in
  // front of you), a paler section
  _rockTops(ctx, r, c0, c1, z, cut = false) {
    const W = this.W
    for (let c = c0; c <= c1; c++) {
      const tl = this._P(c, r, z), tr = this._P(c + 1, r, z), br = this._P(c + 1, r + 1, z), bl = this._P(c, r + 1, z)
      if (!tl || !tr || !br || !bl) continue
      this._polys.push({ pts: [tl, tr, br, bl], r, z, walk: false, c0: c, c1: c })
      if (bl.y < -2 || tl.y > this.cam.sh + 2) continue
      const i = r * W + c
      let L = [this.statTop[i * 3], this.statTop[i * 3 + 1], this.statTop[i * 3 + 2]]
      if (this.px !== undefined) {
        const f = this._fallL(Math.hypot(c + 0.5 - this.px, r + 0.5 - this.py, (z - this.tz) * 0.8), this.R)
        L = [L[0] + this.warm[0] * f, L[1] + this.warm[1] * f, L[2] + this.warm[2] * f]
      }
      const n = (hash(c * 7919 + r * 104729) & 255) / 255
      const tone = (this.mats[String.fromCharCode(this.mat[i])] || this.mats.r).top.map((v, q) => Math.min(255, v * (cut ? 0.75 : 1) * (0.85 + 0.3 * n) * clamp01(L[q] * 1.4)) | 0)
      ctx.fillStyle = `rgb(${tone[0]},${tone[1]},${tone[2]})`
      ctx.beginPath(); ctx.moveTo(tl.x - 0.5, tl.y - 0.5); ctx.lineTo(tr.x + 0.5, tr.y - 0.5); ctx.lineTo(br.x + 0.5, br.y + 0.5); ctx.lineTo(bl.x - 0.5, bl.y + 0.5); ctx.closePath(); ctx.fill()
    }
  }

  _pattern(ctx, m = 'r') {
    if (this._patCtx !== ctx) { this._pats = {}; this._patCtx = ctx }
    return this._pats[m] || (this._pats[m] = ctx.createPattern((this.mats[m] || this.mats.r).face, 'repeat'))
  }
  _matAt(c, r) { const i = this._i(c, r); return i < 0 ? 'r' : String.fromCharCode(this.mat[i]) }

  // the light up a face: colours at a few heights, foot to top. The fixed part is kept per face.
  _faceStops(key, x, y, zb, zt, oc) {
    const N = 4, out = []
    let st = this._faceStatic.get(key)
    if (!st) {
      st = []
      for (let q = 0; q < N; q++) {
        const z = zb + (zt - zb) * q / (N - 1)
        let R0 = 0, G0 = 0, B0 = 0
        for (let li = 0; li < this.lights.length; li++) {
          const L = this.lights[li]
          const f = this._fallL(Math.hypot(x - L.x, y - L.y, (z - L.z) * 0.8), L.r) * L.i
          if (f <= 0) continue
          if (!this._ray(L.x, L.y, L.z, x, y, z, Math.floor(x), Math.floor(y))) continue
          R0 += L.col[0] * f; G0 += L.col[1] * f; B0 += L.col[2] * f
        }
        const A = this.ambient || [0, 0, 0]
        st.push([R0 + A[0], G0 + A[1], B0 + A[2]])
      }
      this._faceStatic.set(key, st)
    }
    for (let q = 0; q < N; q++) {
      const z = zb + (zt - zb) * q / (N - 1)
      const t = this.lightAt(x, y, z, oc, false)
      out.push([clamp01(st[q][0] + t[0]), clamp01(st[q][1] + t[1]), clamp01(st[q][2] + t[2])])
    }
    return out
  }

  _rgb(L, base = [255, 255, 255]) {
    return `rgb(${(base[0] * L[0]) | 0},${(base[1] * L[1]) | 0},${(base[2] * L[2]) | 0})`
  }

  // the south face of tile (c, r), from zt down to zs (the tile in front; none: into the dark)
  _southFace(ctx, c, r, zt, zs) {
    const C = this.cam
    const zb = zs === -Infinity ? C.z - VOID_DEPTH : zs
    const k = this._k(r + 1)
    if (!k) return
    const x0 = this._X(c, r + 1), x1 = this._X(c + 1, r + 1)
    if (x1 < 0 || x0 > C.sw) return
    let yT = this._Y(r + 1, zt), yB = this._Y(r + 1, zb)
    this._polys.push({ pts: [{ x: x0, y: yT }, { x: x1, y: yT }, { x: x1, y: yB }, { x: x0, y: yB }], r, walk: false })
    if (yB < 0 || yT > C.sh) return
    // clipped to the screen, so a face reaching far up or down doesn't cost a huge fill; whole pixels,
    // so neighbouring faces meet without a seam
    const y0 = Math.floor(Math.max(-2, yT)), y1 = Math.ceil(Math.min(C.sh + 2, yB))
    const X0 = Math.floor(x0), X1 = Math.ceil(x1)
    if (y1 <= y0) return
    if (this._raisedFloor(c, r, zs)) {
      // a floor-stone pushed up: its face is the stone's own edge, the top's picture carried down (the joints turn the
      // corner; the stone is the same colour all the way down), with a course joint at every third of a tile
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(this.base, c * TP, r * TP + TP - 5, TP, 3, X0, y0, X1 - X0, y1 - y0)
      ctx.fillStyle = 'rgba(6,8,14,0.24)'; ctx.fillRect(X0, y0, X1 - X0, y1 - y0)
      const jw = Math.max(1, Math.round(k * 0.03))
      for (let z = zt - 1 / 3; z > zb + 0.05; z -= 1 / 3) {
        const yj = Math.round(this._Y(r + 1, z))
        ctx.fillStyle = 'rgba(8,10,16,0.55)'; ctx.fillRect(X0, yj, X1 - X0, jw)
        ctx.fillStyle = 'rgba(190,200,220,0.16)'; ctx.fillRect(X0, yj + jw, X1 - X0, jw)
      }
    } else {
    const pat = this._pattern(ctx, this._matAt(c, r)), s = k / FACE_PX
    pat.setTransform?.(new DOMMatrix([s, 0, 0, s, C.sw / 2 - C.col * k, this._Y(r + 1, 0) + (r % 3) * 7]))
    ctx.fillStyle = pat
    ctx.fillRect(X0, y0, X1 - X0, y1 - y0)
    }
    // the light over it, multiplied: at its foot what lights the tile in front, rising into the dark
    // (into the void the light is worked out over a fixed depth, so it needn't be again as you move)
    const zL = zs === -Infinity ? zt - 10 : zb
    const stops = this._faceStops(`S${c},${r},${zt},${zL}`, c + 0.5, r + 1.04, zL, zt, this._i(c, r + 1))
    const gr = ctx.createLinearGradient(0, this._Y(r + 1, zL), 0, yT)
    stops.forEach((L, q) => gr.addColorStop(q / (stops.length - 1), this._rgb(L)))
    ctx.globalCompositeOperation = 'multiply'
    ctx.fillStyle = gr
    ctx.fillRect(X0, y0, X1 - X0, y1 - y0)
    if (zs === -Infinity && this.abyss) this._abyss(ctx, X0, X1, y0, y1, r + 1, zt)
    ctx.globalCompositeOperation = 'source-over'
    if (zs === -Infinity && this.drips) X.drawDrips(this, ctx, c, r, zt)
    // a hairline of light along the lip, where the top meets the face
    const top = stops[stops.length - 1]
    if (top[0] + top[1] + top[2] > 0.15) {
      ctx.fillStyle = `rgba(${(255 * top[0]) | 0},${(235 * top[1]) | 0},${(215 * top[2]) | 0},0.35)`
      ctx.fillRect(X0, Math.round(yT), X1 - X0, Math.max(1, Math.round(k * 0.02)))
    }
  }

  // a floor tile (in a hall whose floor is laid by hand) standing above its neighbour: its faces are cut from the floor's picture
  _raisedFloor(c, r, zn) { return !!this.floorArt && zn !== -Infinity && this.k[r * this.W + c] === K_FLOOR }

  // into the void: whatever light there is gives out a little below the lip, and below that it is black
  _abyss(ctx, x0, x1, y0, y1, y, zt) {
    const a = this._Y(y, zt - ABYSS[0]), b = this._Y(y, zt - ABYSS[1])
    const g = ctx.createLinearGradient(0, a, 0, b)
    g.addColorStop(0, '#fff'); g.addColorStop(0.55, '#3a3a3a'); g.addColorStop(1, '#000')
    ctx.fillStyle = g
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
  }

  // an east or west face of tile (c, r), on the line x = fx, from zt down to zn (the neighbour)
  _sideFace(ctx, c, r, fx, zt, zn) {
    const C = this.cam
    const zb = zn === -Infinity ? C.z - VOID_DEPTH : zn
    const a = this._P(fx, r, zt), b = this._P(fx, r + 1, zt), cc = this._P(fx, r + 1, zb), d = this._P(fx, r, zb)
    if (!a || !b || !cc || !d) return
    this._polys.push({ pts: [a, b, cc, d], r, walk: false })
    if (Math.max(a.x, b.x) < 0 || Math.min(a.x, b.x) > C.sw) return
    if (Math.abs(b.x - a.x) < 0.4) return
    const oc = this._i(fx === c ? c - 1 : c + 1, r)
    const ox = fx === c ? -0.04 : 0.04
    const zL = zn === -Infinity ? zt - 10 : zb
    const stops = this._faceStops(`${fx === c ? 'W' : 'E'}${c},${r},${zt},${zL}`, fx + ox, r + 0.5, zL, zt, oc)
    const yF = this._Y(r + 0.5, zL), yT = this._Y(r + 0.5, zt)
    const gr = ctx.createLinearGradient(0, yF, 0, yT)
    const side = (this.mats[this._matAt(c, r)] || this.mats.r).side
    if (this._raisedFloor(c, r, zn)) {
      // the stone's own side: the picture's strip at that edge, carried down (see _southFace), a little darker
      const xe = fx === c ? c * TP + 4.5 : (c + 1) * TP - 4.5, dx = fx === c ? -3 : 3, v0 = r * TP
      ctx.save()
      this._tri(ctx, this.base, [xe, v0], [xe, v0 + TP], [xe + dx, v0 + TP], a, b, cc)
      this._tri(ctx, this.base, [xe, v0], [xe + dx, v0 + TP], [xe + dx, v0], a, cc, d)
      stops.forEach((L, q) => gr.addColorStop(q / (stops.length - 1), this._rgb(L, [205, 205, 210])))
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = gr
      ctx.beginPath(); ctx.moveTo(a.x, a.y - 0.5); ctx.lineTo(b.x, b.y - 0.5); ctx.lineTo(cc.x, cc.y + 0.5); ctx.lineTo(d.x, d.y + 0.5); ctx.closePath(); ctx.fill()
      ctx.restore()
      return
    }
    stops.forEach((L, q) => gr.addColorStop(q / (stops.length - 1), this._rgb(L, side.map(v => v * 0.85))))
    ctx.fillStyle = gr
    ctx.beginPath(); ctx.moveTo(a.x, a.y - 0.5); ctx.lineTo(b.x, b.y - 0.5); ctx.lineTo(cc.x, cc.y + 0.5); ctx.lineTo(d.x, d.y + 0.5); ctx.closePath(); ctx.fill()
    if (zn === -Infinity) {
      ctx.save(); ctx.clip(); ctx.globalCompositeOperation = 'multiply'
      this._abyss(ctx, Math.min(a.x, b.x) - 1, Math.max(a.x, b.x) + 1, Math.min(a.y, b.y) - 1, Math.max(cc.y, d.y) + 1, r + 0.5, zt)
      ctx.restore()
    }
  }

  // a slab: a bridge's deck or a lintel, top at s.z, s.t thick
  _slab(ctx, c, r, s) {
    if (s.hid) return                                           // a step you climb that is painted, not built (hewnExtras' pool)
    const z = s.z, zb = s.z - s.t
    const tl = this._P(c, r, z), tr = this._P(c + 1, r, z), br = this._P(c + 1, r + 1, z), bl = this._P(c, r + 1, z)
    if (!tl || !tr || !br || !bl) return
    const C = this.cam
    // top
    if (s.walk === 'deck') {
      const u0 = c * TP, v0 = r * TP
      this._tri(ctx, this.litCv, [u0, v0], [u0 + TP, v0], [u0 + TP, v0 + TP], tl, tr, br)
      this._tri(ctx, this.litCv, [u0, v0], [u0 + TP, v0 + TP], [u0, v0 + TP], tl, br, bl)
    } else {
      const L = this.lightAt(c + 0.5, r + 0.5, z + 0.05, -1)
      ctx.fillStyle = this._rgb(L.map(v => clamp01(v * 1.2)), [110, 106, 104])
      ctx.beginPath(); ctx.moveTo(tl.x - 0.5, tl.y - 0.5); ctx.lineTo(tr.x + 0.5, tr.y - 0.5); ctx.lineTo(br.x + 0.5, br.y + 0.5); ctx.lineTo(bl.x - 0.5, bl.y + 0.5); ctx.closePath(); ctx.fill()
    }
    this._polys.push({ pts: [tl, tr, br, bl], r, z, walk: s.walk === 'deck', c0: c, c1: c })
    // its front, unless the slab runs on into the next row
    const next = this.span.get(this._i(c, r + 1))
    if (!next || Math.abs(next.z - z) > 0.01) {
      const x0 = this._X(c, r + 1), x1 = this._X(c + 1, r + 1), yT = this._Y(r + 1, z), yB = this._Y(r + 1, zb)
      const k = this._k(r + 1), pat = this._pattern(ctx, this._matAt(c, r)), sc = k / FACE_PX
      pat.setTransform?.(new DOMMatrix([sc, 0, 0, sc, C.sw / 2 - C.col * k, this._Y(r + 1, 0)]))
      ctx.fillStyle = pat; ctx.fillRect(x0 - 0.5, yT - 0.5, x1 - x0 + 1, yB - yT + 1)
      const L0 = this.lightAt(c + 0.5, r + 1.04, zb, this._i(c, r + 1)), L1 = this.lightAt(c + 0.5, r + 1.04, z, this._i(c, r + 1))
      const gr = ctx.createLinearGradient(0, yB, 0, yT)
      gr.addColorStop(0, this._rgb(L0.map(v => v * 0.8))); gr.addColorStop(1, this._rgb(L1))
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = gr; ctx.fillRect(x0 - 0.5, yT - 0.5, x1 - x0 + 1, yB - yT + 1)
      ctx.globalCompositeOperation = 'source-over'
      this._polys.push({ pts: [{ x: x0, y: yT }, { x: x1, y: yT }, { x: x1, y: yB }, { x: x0, y: yB }], r, walk: false })
    }
    // its sides, where it stands out over the drop
    for (const [nx, fx] of [[c + 1, c + 1], [c - 1, c]]) {
      const ns = this.span.get(this._i(nx, r))
      if (ns && Math.abs(ns.z - z) < 0.01) continue
      if (this.colZ(nx, r) >= z) continue
      if (fx === c + 1 ? C.col <= c + 1 : C.col >= c) continue
      const a = this._P(fx, r, z), b = this._P(fx, r + 1, z), cc = this._P(fx, r + 1, zb), d = this._P(fx, r, zb)
      if (!a || !b || !cc || !d) continue
      const L = this.lightAt(fx, r + 0.5, z - s.t / 2, -1)
      ctx.fillStyle = this._rgb(L, ROCK_TONE.map(v => v * 0.7))
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(cc.x, cc.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill()
    }
  }

  // the flame and the pale lights on water: short streaks that come and go
  _drawGlints(ctx, r, c0, c1) {
    if (!this.glints) return
    let any = false
    for (let c = c0; c <= c1; c++) {
      if (this.kindAt(c, r) !== K_WATER) continue
      const sz = this.z[r * this.W + c]
      const p = (Math.floor((r + 0.5) * SUB) * this.lw + Math.floor((c + 0.5) * SUB))
      const b = Math.max(this.torchB[p], (this.stat[p * 3] + this.stat[p * 3 + 1] + this.stat[p * 3 + 2]) / 3)
      if (b < 0.05) continue
      if (!any) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; any = true }
      for (let k = 0; k < 3; k++) {
        const ph = hash(c * 131 + r * 977 + k * 7) & 0xffff
        const life = (this.t * (0.35 + (ph % 7) * 0.06) + ph / 0xffff) % 1
        const on = Math.max(0, Math.sin(life * Math.PI * 2))
        const a = on * on * Math.min(1, b * 1.6) * 0.8
        if (a < 0.03) continue
        const gx = c + 0.15 + ((ph * 13) % 70) / 100, gy = r + 0.15 + ((ph * 7) % 70) / 100
        const len = 0.1 + 0.08 * Math.sin(this.t * 2 + k)
        const p0 = this._P(gx - len / 2, gy, sz), p1 = this._P(gx + len / 2, gy, sz)
        if (!p0 || !p1) continue
        const warm = this.torchB[p] > 0.1
        ctx.strokeStyle = warm ? `rgba(255,195,130,${a.toFixed(3)})` : `rgba(190,215,240,${a.toFixed(3)})`
        ctx.lineWidth = Math.max(1, this._k(gy) * 0.03)
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke()
      }
    }
    if (any) ctx.restore()
  }

  // pure water: rings spreading from a point and fading, a few at a time over the whole surface, and small stars of
  // light that come and go on it -- seen in the dark too, faintly, so the water always shows where it is
  _drawRipples(ctx, r, c0, c1) {
    let any = false
    const blue = this.waterLook === 'blue'
    for (let c = c0; c <= c1; c++) {
      const i = r * this.W + c
      if (this.k[i] !== K_WATER || this.mat[i] !== 112) continue
      const sz = this.z[i], k = this._k(r + 0.5)
      if (!k || k < 14) continue                         // too far off to see a ripple
      if (!any) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; any = true }
      const p = (Math.floor((r + 0.5) * SUB) * this.lw + Math.floor((c + 0.5) * SUB))
      const lit = Math.min(1, Math.max(this.torchB[p], (this.stat[p * 3] + this.stat[p * 3 + 1] + this.stat[p * 3 + 2]) / 3) * 1.6)
      const ph = hash(c * 7919 + r * 104729)
      // a ring: each tile now and then (its own period), from a point in it
      const per = 4.5 + (ph % 9) * 0.6, life = ((this.t + (ph & 1023) / 97) % per) / 2.2
      if (this.ripples && life < 1) {
        const cx = c + 0.25 + ((ph >> 10) & 63) / 126, cy = r + 0.25 + ((ph >> 16) & 63) / 126
        const ctr = this._P(cx, cy, sz), side = this._P(cx + 1, cy, sz), down = this._P(cx, cy + 1, sz)
        if (ctr && side && down) {
          const rad = 0.08 + 0.55 * life, a = (1 - life) * (0.22 + 0.5 * lit)
          ctx.strokeStyle = blue ? `rgba(200,230,255,${a.toFixed(3)})` : `rgba(225,235,245,${a.toFixed(3)})`
          ctx.lineWidth = Math.max(1, k * 0.018 * (1 - life * 0.5))
          ctx.beginPath(); ctx.ellipse(ctr.x, ctr.y, Math.abs(side.x - ctr.x) * rad, Math.abs(down.y - ctr.y) * rad, 0, 0, Math.PI * 2); ctx.stroke()
        }
      }
      // stars on the surface
      for (let q = 0; q < (this.glints ? 1 : 0); q++) {
        const h2 = hash(ph + q * 31337), tw = Math.sin(this.t * (0.6 + (h2 % 5) * 0.17) + (h2 & 255)) ** 16
        if (tw < 0.05) continue
        const pt = this._P(c + 0.1 + ((h2 >> 8) & 255) / 320, r + 0.1 + ((h2 >> 16) & 255) / 320, sz)
        if (!pt) continue
        const s = Math.max(1, k * 0.03) * (0.6 + tw)
        ctx.fillStyle = `rgba(255,255,255,${(tw * (0.35 + 0.55 * lit)).toFixed(3)})`
        ctx.fillRect(pt.x - s / 2, pt.y - s / 2, s, s)
      }
    }
    if (any) ctx.restore()
  }

  // water over an edge: pale strands sliding down, fading into the dark
  _drawFall(ctx, f) {
    const oc = this._i(Math.floor((f.x0 + f.x1) / 2), Math.floor(f.y) - 1)
    const L = this.lightAt((f.x0 + f.x1) / 2, f.y - 0.3, f.z0, oc)
    const b = Math.max(L[0], L[1], L[2])
    if (b < 0.03) return
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'
    const n = Math.max(3, Math.round((f.x1 - f.x0) * 6))
    for (let s = 0; s < n; s++) {
      const x = f.x0 + (s + 0.5) / n * (f.x1 - f.x0)
      const ph = (hash(s * 977 + Math.floor(f.y) * 31) & 1023) / 1023
      for (let q = 0; q < 4; q++) {
        const u = ((this.t * (0.5 + ph * 0.3) + q / 4 + ph) % 1)
        const za = f.z0 - (f.z0 - f.z1) * u * u, zb2 = za - 0.6 - u * 1.2
        const p0 = this._P(x, f.y, za), p1 = this._P(x, f.y, zb2)
        if (!p0 || !p1) continue
        const a = b * (1 - u) * 0.55
        ctx.strokeStyle = `rgba(${(200 * L[0] / b) | 0},${(225 * L[1] / b) | 0},${(245 * L[2] / b) | 0},${a.toFixed(3)})`
        ctx.lineWidth = Math.max(1, this._k(f.y) * 0.025)
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke()
      }
    }
    ctx.restore()
  }

  // a thing standing there: an item's picture, lit where it is; or a fire's last embers
  _drawProp(ctx, p) {
    if (p.type === 'glowworms') { this._drawGlowworms(ctx, p); return }
    const ex = { torch: X.drawTorch, shaft: X.drawShaft, mite: X.drawMite, box: X.drawBox, sprite: X.drawSprite, arch: X.drawArch, span: X.drawSpan,
      mob: X.drawMob, ogham: X.drawOgham, spiral: X.drawSpiral, eyes: X.drawEyes, eye: X.drawEye, cauldron: X.drawCauldron, candles: X.drawCandles, mist: X.drawMist, grille: X.drawGrille, sigil: X.drawSigil, statue: X.drawStatue, ferry: X.drawFerry, wraith: X.drawWraith, fogbank: X.drawFogBank, body: X.drawBody, pillar: X.drawPillar, doorway: X.drawDoorway }[p.type]
    if (ex) { ex(this, ctx, p); return }
    const at = this._P(p.x, p.y, p.z)
    if (!at) return
    const k = this._k(p.y)
    const oc = this._i(Math.floor(p.x), Math.floor(p.y))
    if (p.type === 'embers') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      const glow = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, k * 0.7)
      const fl = 0.75 + 0.25 * Math.sin(this.t * 3.1 + p.n) * Math.sin(this.t * 7.3)
      glow.addColorStop(0, `rgba(255,120,40,${(0.45 * fl).toFixed(3)})`); glow.addColorStop(1, 'rgba(255,80,20,0)')
      ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(at.x, at.y, k * 0.7, k * 0.35, 0, 0, Math.PI * 2); ctx.fill()
      for (let q = 0; q < 9; q++) {
        const h = hash(q * 7 + p.n * 131)
        const ex = p.x + ((h & 255) / 255 - 0.5) * 0.5, ey = p.y + (((h >> 8) & 255) / 255 - 0.5) * 0.3
        const e = this._P(ex, ey, p.z)
        if (!e) continue
        const a = 0.5 + 0.5 * Math.sin(this.t * (2 + (h % 5)) + q)
        ctx.fillStyle = `rgba(255,${(90 + 80 * a) | 0},30,${(0.5 + 0.5 * a).toFixed(3)})`
        ctx.fillRect(e.x - 1, e.y - 1, 2, 2)
      }
      ctx.restore()
      return
    }
    const img = p.gid ? this.scene.itemSheet?.getCanvas?.(p.gid) : null
    if (!img) return
    const L = this.lightAt(p.x, p.y, p.z + 0.25, oc)
    const b = Math.max(L[0], L[1], L[2])
    if (b < 0.02) return
    const s = k * (p.s ?? 0.5)
    ctx.save()
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(X.litSprite(img, 0, 0, img.width, img.height, b), at.x - s / 2, at.y - s, s, s)
    ctx.restore()
    // a glint, now and then, on what catches the light
    const tw = Math.max(0, Math.sin(this.t * 1.7 + p.n * 2.1)) ** 12
    if (tw > 0.05 && b > 0.15) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      ctx.strokeStyle = `rgba(255,240,200,${(tw * b).toFixed(3)})`; ctx.lineWidth = 1
      const gx = at.x + s * 0.15, gy = at.y - s * 0.7, l = s * 0.35 * tw
      ctx.beginPath(); ctx.moveTo(gx - l, gy); ctx.lineTo(gx + l, gy); ctx.moveTo(gx, gy - l); ctx.lineTo(gx, gy + l); ctx.stroke()
      ctx.restore()
    }
  }

  // glow-worms on a south-facing wall (the face on the line y): points of cold light, each slowly
  // brightening and dimming on its own
  _drawGlowworms(ctx, p) {
    const k = this._k(p.y)
    if (!k) return
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    const sz = Math.max(1, k * 0.022)
    for (let q = 0; q < (p.n ?? 60); q++) {
      const h = hash(q * 2654435761 + p.n * 97 + 13)
      const x = p.x0 + ((h & 1023) / 1023) * (p.x1 - p.x0)
      const z = p.z0 + (((h >> 10) & 1023) / 1023) ** 0.7 * (p.z1 - p.z0)
      const at = this._P(x, p.y, z)
      if (!at || at.y < -4 || at.y > this.cam.sh + 4) continue
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.t * (0.4 + (h % 7) * 0.08) + (h >> 20)))
      ctx.fillStyle = `rgba(150,255,225,${(a * 0.85).toFixed(3)})`
      ctx.fillRect(at.x - sz / 2, at.y - sz / 2, sz, sz)
      if (a > 0.85) { ctx.fillStyle = `rgba(90,230,200,${((a - 0.85) * 1.2).toFixed(3)})`; ctx.fillRect(at.x - sz * 1.5, at.y - sz * 1.5, sz * 3, sz * 3) }
    }
    ctx.restore()
  }

  // your ghost, over whatever stands in front of you
  _ghost() {
    const g = this.pgr, o = this.xctx, src = g?._objectCanvas
    if (!o || !src || g.playerScreenX == null) return
    const s = g._scaleAtRow((this.scene.player?.logicalY ?? 0) / this.scene.tileSize + 0.5)
    if (!(s > 0)) return
    const x0 = Math.max(0, Math.floor(g.playerScreenX - s * 0.6)), x1 = Math.min(src.width, Math.ceil(g.playerScreenX + s * 0.6))
    const y0 = Math.max(0, Math.floor(g.playerScreenY - s * 1.9)), y1 = Math.min(src.height, Math.ceil(g.playerScreenY + s * 0.15))
    if (x1 <= x0 || y1 <= y0) return
    o.save(); o.globalAlpha = GHOST
    o.drawImage(src, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0)
    o.restore()
  }

  // ── a tap ──────────────────────────────────────────────────────────────────
  // the nearest thing drawn under the point: if it's a floor you can walk on, that tile
  pick(sx, sy) {
    const P = this._polys
    for (let n = P.length - 1; n >= 0; n--) {
      const q = P[n]
      if (!insideQuad(q.pts, sx, sy)) continue
      if (!q.walk) return null
      // which tile of the run: back through the camera at that height
      const C = this.cam
      const A = C.gH * C.FL - (q.z - C.z) * C.k0
      const den = sy - C.hz
      if (den <= 0) return null
      const d = A / den - C.FL
      const col = C.col + (sx - C.sw / 2) * (C.FL + d) / C.k0
      const tx = Math.max(q.c0, Math.min(q.c1, Math.floor(col)))
      return { tx, ty: q.r }
    }
    return null
  }

  destroy() {
    this.xc?.parentNode?.removeChild(this.xc)
    this.xc = null; this.xctx = null
    this._polys = []
  }
}

function insideQuad(pts, x, y) {
  let s = 0
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i + 1) % 4]
    const cr = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)
    if (Math.abs(cr) < 1e-9) continue
    const sg = cr > 0 ? 1 : -1
    if (!s) s = sg; else if (s !== sg) return false
  }
  return true
}

// ── hewn stone: chisel-worked rock, seamless every way ────────────────────────
// Broad uneven planes, a faint grain of tool marks running across, the odd deeper gouge and crack.
// No courses, no joints: rock cut back, not built.
function makeHewnTexture(w, h, seed) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d')
  const img = x.createImageData(w, h)
  const rnd = seeded(seed)
  const big = wrapNoise(rnd, 3, 3), mid = wrapNoise(rnd, 8, 8), fine = wrapNoise(rnd, 24, 24), marks = wrapNoise(rnd, 4, 40)
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const u = i / w, v = j / h
    // planes: the big noise quantised a little, so flats meet at soft edges
    const b = big(u, v), m = mid(u, v), f = fine(u, v), t = marks(u, v)
    let k = 0.62 + 0.16 * Math.round(b * 4) / 4 + 0.12 * m + 0.1 * f
    k *= 0.95 + 0.05 * Math.sin((v * 40 + u * 9 + t * 4) * Math.PI)  // tool marks, aslant
    if (m < 0.22) k *= 0.88                                          // hollows
    k += (rnd() - 0.5) * 0.06
    const o = (j * w + i) * 4
    img.data[o] = 150 * k; img.data[o + 1] = 146 * k; img.data[o + 2] = 148 * k; img.data[o + 3] = 255
  }
  x.putImageData(img, 0, 0)
  x.strokeStyle = 'rgba(14,12,12,0.5)'; x.lineWidth = 1.2
  for (let q = 0; q < 10; q++) {
    let px = rnd() * w, py = rnd() * h
    for (let k = 0; k < 4; k++) {
      const nx = px + (rnd() - 0.5) * 30, ny = py + (rnd() - 0.2) * 26
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { x.beginPath(); x.moveTo(px + ox, py + oy); x.lineTo(nx + ox, ny + oy); x.stroke() }
      px = nx; py = ny
    }
  }
  return c
}

// ── a hewn floor: n x n tiles of worn, cut stone, seamless every way ────────────
// Low in contrast (the light does the modelling here): broad worn planes, fine grit, a few hairline
// cracks and chips. No blotches, which would read as holes.
function makeHewnFloor(n, px, seed) {
  const S = n * px
  const c = document.createElement('canvas'); c.width = c.height = S
  const x = c.getContext('2d')
  const img = x.createImageData(S, S)
  const rnd = seeded(seed)
  const n1 = wrapNoise(rnd, n, n), n2 = wrapNoise(rnd, n * 4, n * 4), n3 = wrapNoise(rnd, n * 12, n * 12)
  const base = [104, 102, 108]
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const u = i / S, v = j / S
    let k = 0.78 + 0.12 * n1(u, v) + 0.1 * n2(u, v) + 0.08 * n3(u, v) + (rnd() - 0.5) * 0.08
    if (rnd() < 0.02) k *= rnd() < 0.5 ? 0.78 : 1.15                 // grit
    const o = (j * S + i) * 4
    img.data[o] = base[0] * k; img.data[o + 1] = base[1] * k; img.data[o + 2] = base[2] * k; img.data[o + 3] = 255
  }
  x.putImageData(img, 0, 0)
  const wrapped = (fn) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { x.save(); x.translate(ox, oy); fn(); x.restore() } }
  x.lineWidth = 1
  for (let q = 0; q < n * 3; q++) {
    const pts = [[rnd() * S, rnd() * S]]
    for (let k = 0; k < 4; k++) { const [a, b] = pts[pts.length - 1]; pts.push([a + (rnd() - 0.5) * 14, b + (rnd() - 0.5) * 14]) }
    wrapped(() => {
      x.strokeStyle = 'rgba(20,18,22,0.35)'; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (const p of pts) x.lineTo(p[0], p[1]); x.stroke()
      x.strokeStyle = 'rgba(200,195,190,0.08)'; x.beginPath(); x.moveTo(pts[0][0] + 0.7, pts[0][1] + 0.7); for (const p of pts) x.lineTo(p[0] + 0.7, p[1] + 0.7); x.stroke()
    })
  }
  for (let q = 0; q < n * n; q++) {                                  // chips: a small dark nick with a pale edge
    const sx = rnd() * S, sy = rnd() * S, r = 0.8 + rnd() * 1.4
    wrapped(() => {
      x.fillStyle = 'rgba(18,16,20,0.4)'; x.beginPath(); x.ellipse(sx, sy, r, r * 0.6, 0, 0, Math.PI * 2); x.fill()
      x.fillStyle = 'rgba(210,205,200,0.12)'; x.fillRect(sx - r, sy + r * 0.5, r * 2, 1)
    })
  }
  return c
}

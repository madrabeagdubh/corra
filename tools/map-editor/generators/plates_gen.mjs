// plates_gen.mjs  (v2: bandMaps)
// Location: tools/map-editor/generators/plates_gen.mjs
//
//  Purpose 
// A set of levels built to be PHOTOGRAPHED, not played. The intro's far / mid / near
// backdrop plates are meant to carry the look of the game itself, so each one gets
// its own level, shot on its own, so that every layer is COMPLETE. (Shot together,
// the mid hill would hide part of the mountains behind it, and parallax slides the
// layers against each other, so the hole would show.)
//
//   plates_far.json    FAR   rugged mountains along the north edge. Steep fronts, so the
//                            game's stone-face renderer paints them as rock. Nothing else.
//   plates_mid.json    MID   a broad hill with a flat crown (the druid and queen stand
//                            there) and two low shoulders. The ground BEHIND it is left
//                            empty, so the hill stands against the sky colour, and the
//                            ground line is the edge of the land, not a plain to the horizon.
//   plates_near.json   NEAR  bare rolling meadow. The ground flora (Vegetation) grows here.
//   plates.json        ALL   all three in one view: the composition as it will be assembled.
//                            A preview, not a source: the layers occlude one another here.
//
// Open one with   ?scene=plates&band=far|mid|near|all    (see bog/plates.js)
//
//  Periodic 
// Every noise here repeats every `period` tiles (48), and the maps are two periods wide.
// Screenshots taken exactly one period apart are identical, and a plate is one period
// long, so its ends already meet. (Perspective makes the match approximate rather than
// exact where a feature spans many rows -- blend the seam in GIMP.)
//
//  Heights 
// Terrain height converts to screen pixels as   height x pixels-per-tile-at-that-row,
// and the ground layers are CLIPPED at the horizon. The tallest crest that still fits
// under it is about   (1 - horizon) x (screenHeight / screenWidth) x 3.45   units:
// ~6.4 at &horizon=0.10 on a phone, ~5.1 at the game's own 0.28. `mountains.peak`
// stays well under that. The game's own maps run 0..~2.1, so this is new territory:
// if the renderer misbehaves on the steep fronts, lower the peak first.
//
// Usage:
//   node tools/map-editor/generators/plates_gen.mjs            (writes plates, plates_far/_mid/_near)
//   node tools/map-editor/generators/plates_gen.mjs myname     (writes myname, myname_far ...)
//
// Deterministic: same name, same maps. Change SEED_SALT for different ones. The mountains
// are the same in `far` and `all`, and the hill the same in `mid` and `all`.

import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = resolve(__dirname, '../../../public/maps/bogMaps')

//  CONFIG 

const CONFIG = {
  width:  96,        // two periods wide: room to walk sideways between shots
  height: 64,
  period: 48,        // every feature repeats at this interval (tiles); width must be a multiple
  SEED_SALT: 11,

  // Where the player starts, per band. South edge, looking north.
  spawns: {
    all:  { x: 48, y: 58 },
    far:  { x: 48, y: 58 },
    mid:  { x: 24, y: 54 },   // due south of the hill; walk north to bring it closer
    near: { x: 48, y: 58 },
  },

  // Low, slow roll over the meadow so the ground is not a billiard table.
  // Wavelengths must divide `period`.
  meadowRoll: { amp: 0.16, wavelengths: [16, 12] },

  // FAR: the mountains. Heights in heightMap units.
  mountains: {
    peak:      6.4,   // tallest crest. See the note on heights above.
    footRow:   15,    // south edge of the range: the front face starts rising here
    crestRow:  8,     // where the crest runs
    backFrac:  0.35,  // by the north edge (row 0) the far side has sunk to this share of the crest
    minFrac:   0.30,  // even the lowest saddle stands at this share of the peak
    massif:    { wl: 16, wly: 10 },                    // big rises and saddles along x
    detail:    [ { wl: 12, wly: 7,   w: 0.30 },        // jagged detail on the crest and faces:
                 { wl: 6,  wly: 4,   w: 0.42 },        //   spurs, notches, gullies. Wavelengths
                 { wl: 3,  wly: 2.4, w: 0.28 } ],      //   must divide the period.
    sharp:     1.7,   // >1 sharpens the detail into spikes
    relief:    0.72,  // how much of a crest's height the detail controls (0 = smooth ridge)
  },

  // MID: the hilltop, plus two low shoulders. Positions are per period (tiles from its start).
  hill: {
    row:   40,        // centre row
    at:    24,        // centre x within a period
    crown: 3.0,       // height of the flat crown
    rx:    16,        // half-width of the footprint (tiles)
    ry:    12,        // half-depth (rows). Depth matters: the SLOPE is crown / (ry x (1-flat)),
                      // and it must stay under the stone threshold (see plates.js: 0.84) or the
                      // game paints the hill as rock. Max steepness here is ~0.75.
    flat:  0.38,      // share of the radius that is the flat crown (~10 tiles across)
    shoulders: [ { dx: -19, crown: 1.4, rx: 10, ry: 7 },
                 { dx:  19, crown: 1.8, rx: 10, ry: 7 } ],
  },
  midVoidRow: 25,     // MID band only: ground north of this row is left empty
}

const FEATURES = {          // what each band's map contains
  all:  { mountains: true,  hill: true,  voidNorth: false },
  far:  { mountains: true,  hill: false, voidNorth: false },
  mid:  { mountains: false, hill: true,  voidNorth: true  },
  near: { mountains: false, hill: false, voidNorth: false },
}

//  Helpers 

const make2D = (w, h, v = 0) => Array.from({ length: h }, () => new Array(w).fill(v))

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const smooth = (t) => t * t * (3 - 2 * t)
const clamp01 = (v) => Math.max(0, Math.min(1, v))
const hashStr = (s) => s.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)

// Smooth value noise, in two dimensions, that REPEATS every `period` tiles along x.
// `wlx` must divide `period` (that is what makes it wrap); `wly` is free.
function periodicNoise2D(rng, period, wlx, wly, rows) {
  const nx = Math.round(period / wlx)
  if (Math.abs(nx * wlx - period) > 1e-9) throw new Error(`wavelength ${wlx} must divide period ${period}`)
  const ny = Math.ceil(rows / wly) + 3
  const pts = Array.from({ length: ny }, () => Array.from({ length: nx }, () => rng()))
  return (x, y) => {
    const gx = x / wlx, gy = y / wly
    const ix = Math.floor(gx), iy = Math.floor(gy)
    const fx = smooth(gx - ix), fy = smooth(gy - iy)
    const x0 = ((ix % nx) + nx) % nx, x1 = (x0 + 1) % nx
    const a = pts[iy][x0], b = pts[iy][x1], c = pts[iy + 1][x0], d = pts[iy + 1][x1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
  }
}

// Shortest signed distance from x to cx around a loop of length `period`.
const wrapDist = (x, cx, period) => {
  let d = (x - cx) % period
  if (d > period / 2) d -= period
  if (d < -period / 2) d += period
  return d
}

//  Ground 

function buildBase(W, H, voidRows = 0) {
  // The same checker the other generated maps use. Rows above voidRows are EMPTY (gid 0):
  // nothing is drawn there, so what shows through is whatever is behind the world.
  return Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) => (y < voidRows ? 0 : ((x + y) % 2 === 0 ? 839 : 840))))
}

//  Height 
// heightMap is a VERTEX grid, (H+1) x (W+1) -- PGR reads it that way.

function buildHeightMap(cfg, name, feat) {
  const { width: W, height: H, period } = cfg
  const seed = (tag) => mulberry32((hashStr(name + ':' + tag) * 2654435761 + cfg.SEED_SALT) >>> 0)

  // Each feature draws from its own stream, so the mountains in `far` and `all`
  // are the same mountains, and adding or removing a feature never shifts another.
  const rollNoise = cfg.meadowRoll.wavelengths.map((wl, i) =>
    periodicNoise2D(seed('roll' + i), period, wl, wl * 0.8, H + 2))
  const m = cfg.mountains
  const massif = periodicNoise2D(seed('massif'), period, m.massif.wl, m.massif.wly, H + 2)
  const detail = m.detail.map((d, i) => periodicNoise2D(seed('detail' + i), period, d.wl, d.wly, H + 2))

  const hm = make2D(W + 1, H + 1, 0)
  const ridged = (v) => Math.pow(1 - Math.abs(2 * v - 1), m.sharp)

  // Row profile of the range: 0 at the foot, rising to 1 at the crest (steepest in the
  // middle of the rise: that is the face), then sinking to backFrac at the north edge.
  const profile = (y) => {
    if (y >= m.footRow) return 0
    if (y >= m.crestRow) return smooth((m.footRow - y) / (m.footRow - m.crestRow))
    const u = y / m.crestRow                      // 0 at the north edge .. 1 at the crest
    return m.backFrac + (1 - m.backFrac) * smooth(u)
  }

  for (let vy = 0; vy <= H; vy++) {
    for (let vx = 0; vx <= W; vx++) {
      // The meadow: a low roll everywhere.
      let roll = 0
      cfg.meadowRoll.wavelengths.forEach((_, i) => { roll += (rollNoise[i](vx, vy) - 0.5) * 2 * cfg.meadowRoll.amp / (i + 1) })
      let h = 0.08 + roll

      if (feat.mountains) {
        // Big rises and saddles, contrast-stretched so there are real gaps, then jagged
        // detail (ridged noise: sharp crests where the noise crosses its midline).
        const l = clamp01((massif(vx, vy) - 0.22) / 0.56)
        let d = 0
        m.detail.forEach((dd, i) => { d += dd.w * ridged(detail[i](vx, vy)) })
        const dn = clamp01((d - 0.26) / 0.52)
        const mass = m.peak * (m.minFrac + (1 - m.minFrac) * l) * ((1 - m.relief) + m.relief * dn)
        h += profile(vy) * mass
      }

      if (feat.hill) {
        const c = cfg.hill
        const bump = (dx, dy, crown, rx, ry, flat) => {
          const r = Math.hypot(dx / rx, dy / ry)
          return crown * (1 - smooth(clamp01((r - flat) / (1 - flat))))
        }
        // The hill and its shoulders repeat every period.
        let hh = bump(wrapDist(vx, c.at, period), vy - c.row, c.crown, c.rx, c.ry, c.flat)
        for (const s of c.shoulders)
          hh = Math.max(hh, bump(wrapDist(vx, c.at + s.dx, period), vy - c.row - 1, s.crown, s.rx, s.ry, 0.15))
        h += hh
      }

      hm[vy][vx] = Math.max(0.02, h)
    }
  }

  // In the MID map the land ends at the void row: bring the ground down to a low, flat
  // edge there, so the ground line is a clean shoreline rather than a cut through a slope.
  if (feat.voidNorth) {
    for (let vy = 0; vy <= cfg.midVoidRow + 2; vy++)
      for (let vx = 0; vx <= W; vx++) {
        const t = clamp01((vy - cfg.midVoidRow) / 2)     // 0 at the void row .. 1 two rows in
        hm[vy][vx] = 0.06 + (hm[vy][vx] - 0.06) * t
      }
  }
  return hm
}

//  Main 

function buildMap(cfg, name, bandKey) {
  const feat = FEATURES[bandKey]
  const { width: W, height: H } = cfg
  const mapName = bandKey === 'all' ? name : `${name}_${bandKey}`
  return {
    file: mapName,
    map: {
      name: mapName,
      width: W,
      height: H,
      hasCliffs: true,            // tells PGR to read heightMap for ground undulation
      layers: [buildBase(W, H, feat.voidNorth ? cfg.midVoidRow : 0), make2D(W, H, 0)],
      wallMask: make2D(W, H, 0),  // nothing collides: no trees in these levels
      heightMap: buildHeightMap(cfg, name, feat),
      legend: { '839': 'grass', '840': 'grass' },
      spawns: { player: cfg.spawns[bandKey] },
      exits: {},
      entries: {},
    },
  }
}

function generate(name) {
  const cfg = CONFIG
  if (cfg.width % cfg.period) throw new Error(`width ${cfg.width} must be a multiple of period ${cfg.period}`)
  for (const bandKey of Object.keys(FEATURES)) {
    const { file, map } = buildMap(cfg, name, bandKey)
    writeFileSync(resolve(OUTPUT_DIR, `${file}.json`), JSON.stringify(map))
    const hm = map.heightMap.flat()
    console.log(`Written: public/maps/bogMaps/${file}.json  (${cfg.width}x${cfg.height}, height ${Math.min(...hm).toFixed(2)}..${Math.max(...hm).toFixed(2)})`)
  }
  console.log('\nOpen with  ?scene=plates&band=far | mid | near | all   (add &key=1 &night=1 for the cut-out, graded shot)')
}

generate(process.argv[2] || 'plates')

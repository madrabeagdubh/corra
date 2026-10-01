// skye_gen.mjs
// Generates the five Isle of Skye training-ground maps into
// public/maps/skyeMaps/. PLACEHOLDER TERRAIN: enough shape to read each
// place and walk the whole island; every map will get its own proper
// pass later.
//
//          skye_dun          dome of rock, sea behind it to the north
//             |
//        skye_droichead      gorge band of sea, 3-wide bridge across
//             |
//        skye_machaire ---- skye_faiche
//             |
//         skye_cladach       strand + sea along the south
//
// Exits run the full width of each edge wherever both sides are standable
// (see the build section at the bottom); entries mirror the
// bog maps' convention (arrive 3 tiles in, position carried from source).
// pathDist gives the trails PGR's mud tint.
//
// Deterministic (seeded) -- reruns produce identical maps.
//
// Usage:  node tools/map-editor/generators/skye_gen.mjs

import { writeFileSync, mkdirSync } from 'fs'
import { createNoise2D } from 'simplex-noise'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { readFileSync } from 'fs'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = resolve(__dirname, '../../../public/maps/skyeMaps')

// The kata live in a browser ES module; node treats this repo's .js as
// CommonJS, so load it from its source text instead.
const { LAR, BOARD_R, onBoard, inlay } = await import('data:text/javascript,' +
  encodeURIComponent(readFileSync(resolve(__dirname, '../../../public/data/skye/kata.js'), 'utf8')))

const W = 36, H = 36
const MID = 18
const GRASS = [839, 840], STRAND = 731, SEA = 1625

const LEGEND = { '0': 'overlay', '731': 'waterside', '839': 'grass', '840': 'grass', '1625': 'water',
                 '44': 'bramble', '45': 'bramble', '46': 'bramble', '47': 'bramble', '48': 'bramble',
                 '154': 'stone', '155': 'stone', '156': 'stone' }

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

const grid = (w, h, f) => Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => f(x, y)))

// ── exits / entries ─────────────────────────────────────────────────────────
const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' }


// Arrival rules (every map, every edge): 3 tiles in, same row/column as
// crossed -- the generator only makes exits where that tile is standable.
const ENTRIES = {
  north: { y: 3,     xFromSource: true },
  south: { y: H - 4, xFromSource: true },
  west:  { x: 3,     yFromSource: true },
  east:  { x: W - 4, yFromSource: true },
}

// ── trails -> pathDist ──────────────────────────────────────────────────────
const EDGE_PT = { north: [MID, 0], south: [MID, H - 1], west: [0, MID], east: [W - 1, MID] }

function segDist(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function pathDistFor(points, falloff = 3) {
  return grid(W, H, (x, y) => {
    let d = Infinity
    for (const [a, b] of points) d = Math.min(d, segDist(x, y, a, b))
    return +Math.min(1, d / falloff).toFixed(3)
  })
}

// ── per-map terrain ─────────────────────────────────────────────────────────
// Each returns { tile(x,y) -> gid, height(vx,vy) -> number, trail: [[a,b],...], spawn? }

const MAPS = {
  skye_cladach: {
    // west, off the headland top (rows 16-20): Uathach's kata garden
    exits: { north: 'skye_loch', west: 'skye_gairdin' },
    // At the foot of the headland; jetty and boat behind (south).
    spawn: { x: MID, y: 28 },
    build(n, rng) {
      // ── Layout (keep in sync with skye/skyeCladach.js) ────────────────
      //   rows 30+   sea; row 29 strand; jetty (18-19, 30-33), boat (34)
      //   rows 27-28 the foot of the headland, rocky
      //   THE WALL   three stone risers (rows 26, 24, 22) with one-row
      //              terraces between (25, 23). Every riser tile is solid
      //              (blockMask) except ONE per riser -- the hidden stair,
      //              drawn identically to the rest: only her calls find it.
      //                gaps: (17,26)  (19,24)  (16,22)
      //   rows 0-21 the headland top, open ground running north to the
      //              loch. Uathach waits at (17,20).
      const LV = [0.1, 1.1, 2.1, 3.1]              // foot, terrace 1, terrace 2, top
      const FLOOR = 1.2                            // ravine floor
      const GAPS = { 26: 17, 24: 19, 22: 16 }      // riser row -> stair column
      const JETTY = { x0: 18, x1: 19, y0: 30, y1: 33, deckH: 0.28 }
      const inBox = (b, x, y) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1

      // Tile height by class. Risers belong to the level BELOW them; the
      // vertex rule below lifts their north edge, making each riser a
      // half-step slope (0.5): stone to look at, climbable where open.
      const tileH = (x, y) => {
        x = Math.max(0, Math.min(W - 1, x)); y = Math.max(0, Math.min(H - 1, y))
        if (y >= 29) return 0
        if (y >= 26) return LV[0]
        if (y >= 24) return LV[1]
        if (y >= 22) return LV[2]
        return LV[3]                                 // the top, all the way north
      }
      const isSea = (x, y) => !inBox(JETTY, x, y) && y >= 30

      return {
        tile: (x, y) => {
          if (inBox(JETTY, x, y)) return GRASS[0]        // walkable; the deck is drawn over it
          if (y >= 30) return SEA
          if (y === 29) return STRAND
          return null
        },
        overlay: () => 0,
        // vertex = the highest tile touching it (+ a whisper of noise)
        height: (x, y) => {
          if (inBox({ ...JETTY, x1: JETTY.x1 + 1, y1: JETTY.y1 + 1 }, x, y)) return JETTY.deckH
          if (y >= 30) return 0
          const h = Math.max(tileH(x - 1, y - 1), tileH(x, y - 1), tileH(x - 1, y), tileH(x, y))
          return h + (y >= 29 ? 0 : (n(x * 0.3, y * 0.3) + 1) * 0.02)
        },
        trail: [[[16, 21], [MID, 0]]],
        trailFalloff: 1.5,
        extra: {
          // solid: every riser tile but the stair, and the wall's two ends
          // (so its narrow ledges don't lead off the map sideways)
          blockMask: grid(W, H, (x, y) =>
            ((y in GAPS && x !== GAPS[y]) || (y >= 22 && y <= 26 && (x === 0 || x === W - 1))) ? 1 : 0),
          // the wall, its terraces and its foot read as bare rock (the
          // risers also get SteepFaceRenderer's stone texture on top)
          stoneTint: grid(W, H, (x, y) =>
            (y >= 22 && y <= 28 && !inBox(JETTY, x, y)) ? 1 : 0),
          // Dressed as harbour stonework by skye/harbourWall.js
          wall: { risers: [26, 24, 22], ledges: [25, 23], quay: [27, 28], gaps: GAPS },
          jetty: JETTY,
          boat: { x: 18.9, y: 34.4, width: 2.3 },
        },
      }
    },
  },

  skye_gairdin: {
    exits: { east: 'skye_cladach' },
    spawn: { x: 30, y: 18 },
    build(n) {
      // ── Uathach's ráth (skye/skyeGairdin.js) ──────────────────────────
      // A gentle ringfort, like Tara: concentric rises in the land, a ripple
      // from a drop of water, walkable everywhere -- a comfort, not a
      // defence. From the centre out:
      //   the board   a round floor of stones, inlaid as a sun wheel in
      //               four colours (kata.js inlay), the lár at its heart
      //   the tier    one low raised ring to sit on and watch from
      //   the bank    a soft outer rampart, then the open field
      // Radii in tiles from the lár's centre; every rise stays well under
      // the 0.6 climb limit.
      const cx = LAR[0] + 0.5, cy = LAR[1] + 0.5
      const smooth = (a, b, r) => { const t = Math.max(0, Math.min(1, (r - a) / (b - a))); return t * t * (3 - 2 * t) }
      const stones = []
      const R = Math.ceil(BOARD_R)
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++)
          if (onBoard(dx, dy)) stones.push([LAR[0] + dx, LAR[1] + dy, inlay(dx, dy)])
      return {
        tile: () => null,
        overlay: () => 0,
        height: (x, y) => {
          const r = Math.hypot(x - cx, y - cy)
          const floor = 0.1
          const tier  = 0.45 * smooth(9.9, 11.2, r)                    // step up to the tier
          const bank  = 0.55 * smooth(12.4, 14.4, r) * (1 - smooth(14.8, 17.2, r))
          const out   = 0.25 * smooth(14.8, 17.2, r)                    // the field beyond
          const h = floor + tier + bank + out - 0.45 * smooth(14.8, 17.2, r)
          return h + (r > 10 ? (n(x * 0.2, y * 0.2) + 1) * 0.02 : 0)
        },
        trail: [[[W - 1, LAR[1]], [LAR[0] + BOARD_R + 1, LAR[1]]]],
        trailFalloff: 1.2,
        extra: {
          stones,                                   // [x, y, colour]
          lar: LAR,
          boardR: BOARD_R,
          // weathered standing stones: two on the tier, one out on the bank
          standingStones: [[11, 10], [27, 12], [31, 26]],
          // wildflowers and gorse grow beyond the bank (radius, tiles)
          floraFrom: 15.2,
        },
      }
    },
  },

  skye_loch: {
    exits: { north: 'skye_machaire', south: 'skye_cladach' },
    spawn: { x: MID, y: 27 },
    build(n) {
      // ── Layout (keep in sync with skye/skyeLoch.js) ───────────────────
      //   rows 25+   south bank (arrival from the shore)
      //   POOL A     rows 17-24, stepping stones from (18,24) to (19,17)
      //   rows 11-16 middle bank; Uathach waits first at (18,15)
      //   POOL B     rows 5-10, stepping stones from (18,10) to (19,5)
      //   rows 0-4   north bank; her second spot (18,3); exit to machaire
      // Pool water is LOCH (1679): walkable for the d-pad (step off a stone
      // and you go in -- skyeLoch.js dunks you) but blocked for the
      // pathfinder, so a tapped route only ever lands on stones.
      const LOCH = 1679
      const inPool = (y) => (y >= 17 && y <= 24) || (y >= 5 && y <= 10)
      // Every diagonal hop also has a corner stone, so the d-pad can always
      // cross in straight steps (longer, and easy to misstep); a tap takes
      // the diagonal shortcuts.
      const STONES = [
        // pool A
        [18,24],[18,23],[17,23],[16,23],[16,22],[16,21],[16,20],[17,20],[17,19],
        [18,19],[18,18],[19,18],[19,17],
        // pool B
        [18,10],[18,9],[18,8],[19,8],[20,8],[20,7],[20,6],[19,6],[19,5],
      ]
      const stoneSet = new Set(STONES.map(([x, y]) => `${x},${y}`))
      const isStone = (x, y) => stoneSet.has(`${x},${y}`)
      return {
        tile: (x, y) => inPool(y) ? LOCH : null,
        overlay: () => 0,
        height: (x, y) => {
          // vertex: water if any touching tile is open water; stones stand
          // a little proud of it
          const touch = [[x - 1, y - 1], [x, y - 1], [x - 1, y], [x, y]]
          const wet = touch.some(([tx, ty]) => inPool(ty) && !isStone(tx, ty))
          const stone = touch.some(([tx, ty]) => isStone(tx, ty))
          if (wet && !stone) return 0
          if (stone) return 0.12
          return 0.22 + (n(x * 0.2, y * 0.2) + 1) * 0.06
        },
        trail: [[[MID, 35], [MID, 25]], [[19, 16], [MID, 11]], [[19, 4], [MID, 0]]],
        trailFalloff: 1.3,
        extra: {
          stones: STONES,
          uathachSpots: [[18, 15], [18, 3]],
          poolStarts: { A: [18, 25], B: [18, 11] },
        },
      }
    },
  },

  skye_machaire: {
    exits: { north: 'skye_droichead', south: 'skye_loch', east: 'skye_faiche' },
    build(n) {
      return {
        tile: () => null,
        height: (x, y) => (n(x * 0.12, y * 0.12) + 1) * 0.12,
        trail: [[EDGE_PT.south, [MID, MID]], [[MID, MID], EDGE_PT.north], [[MID, MID], EDGE_PT.east]],
      }
    },
  },

  skye_faiche: {
    exits: { west: 'skye_machaire' },
    build(n) {
      // ── The practice green (keep in sync with skye/faicheGrounds.js) ──
      //   THE RING    one marked circle of worn ground: drills and bouts
      //               both. The students stand in a loose ring round it.
      //   THE DAIS    a raised wooden platform to the north, for the teacher
      //               to address the green from. Its edges are solid
      //               (blockMask) but for one stair, front and centre.
      //               faicheGrounds.js dresses it in planks.
      //   RACKS       weapon racks either side of the way in from the west
      //   DUMMIES     straw-stuffed posts along the east side
      //   BANNERS     on poles round the ring, on the diagonals
      const RING    = { cx: 18.5, cy: 19.5, r: 7 }        // tile units; centre = middle of tile (18,19)
      const DAIS    = { x0: 15, x1: 21, y0: 6, y1: 8, h: 1.0 }
      const STAIR   = [18, 9]
      const RACKS   = [[6, 15], [6, 21]]
      const DUMMIES = [[31, 16], [31, 19], [31, 22]]
      const BANNERS = [[12, 13], [25, 13], [12, 26], [25, 26]]
      const inBox = (b, x, y) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1
      const ring = { x0: DAIS.x0 - 1, x1: DAIS.x1 + 1, y0: DAIS.y0 - 1, y1: DAIS.y1 + 1 }
      const onRing = (x, y) => inBox(ring, x, y) && !inBox(DAIS, x, y)
      const isStair = (x, y) => x === STAIR[0] && y === STAIR[1]
      // tile heights; a vertex takes the highest tile touching it, so the
      // ring round the dais becomes its slope (boarded over), and the stair
      // tile one slope from the deck to the ground: half the height on
      // average, so a climb of half a step either side of it
      const tileH = (x, y) => inBox(DAIS, x, y) ? DAIS.h : 0
      const props = [...RACKS, ...DUMMIES, ...BANNERS]
      const isProp = (x, y) => props.some(([px, py]) => px === x && py === y)
      // the ring: worn bare inside, and a little more so round its edge
      const ringWear = (x, y) => {
        const d = Math.hypot(x + 0.5 - RING.cx, y + 0.5 - RING.cy)
        return d > RING.r ? 1 : d > RING.r - 1 ? 0.25 : 0.5
      }
      const trail = [[EDGE_PT.west, [Math.floor(RING.cx - RING.r), MID]]]
      return {
        tile: () => null,
        height: (x, y) => {
          const h = Math.max(tileH(x - 1, y - 1), tileH(x, y - 1), tileH(x - 1, y), tileH(x, y))
          return h + (n(x * 0.1, y * 0.1) + 1) * 0.03
        },
        trail,
        extra: {
          // the trail from the west, and the ring's worn ground
          pathDist: (() => {
            const t = pathDistFor(trail)
            return t.map((row, y) => row.map((v, x) => Math.min(v, ringWear(x, y))))
          })(),
          blockMask: grid(W, H, (x, y) => ((onRing(x, y) && !isStair(x, y)) || isProp(x, y)) ? 1 : 0),
          faiche: { ring: RING, dais: DAIS, stair: STAIR, racks: RACKS, dummies: DUMMIES, banners: BANNERS },
        },
      }
    },
  },

  skye_droichead: {
    exits: { north: 'skye_dun', south: 'skye_machaire' },
    build(n) {
      const GORGE_TOP = 15, GORGE_BOT = 19          // tile rows of the gorge
      const onBridge = x => x >= MID - 1 && x <= MID + 1
      return {
        tile: (x, y) => (y >= GORGE_TOP && y <= GORGE_BOT && !onBridge(x)) ? SEA : null,
        height: (x, y) => {
          // vertex rows strictly inside the gorge drop to sea level, except
          // under the bridge deck (vertex cols MID-1..MID+2)
          const inGorge  = y > GORGE_TOP && y <= GORGE_BOT
          const underDeck = x >= MID - 1 && x <= MID + 2
          if (inGorge && !underDeck) return 0
          return 0.8 + (n(x * 0.15, y * 0.15) + 1) * 0.05
        },
        trail: [[EDGE_PT.south, EDGE_PT.north]],
      }
    },
  },

  skye_dun: {
    exits: { south: 'skye_droichead' },
    build(n) {
      const cx = MID, cy = 16, SIGMA = 6, PEAK = 1.6
      return {
        tile: (x, y) => y <= 4 ? SEA : null,
        height: (x, y) => {
          if (y <= 4) return 0
          const g = PEAK * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * SIGMA * SIGMA))
          return 0.8 + g + (n(x * 0.2, y * 0.2) + 1) * 0.04
        },
        trail: [[EDGE_PT.south, [cx, cy]]],
      }
    },
  },
}

// ── build ───────────────────────────────────────────────────────────────────
// Two passes. First every map's terrain; then the exits, which need both
// sides of each edge: an edge tile is an exit only where you can stand on
// it AND on the tile you'd arrive at next door. So exits run the full width
// of an edge, broken only where something physically blocks the way
// (cliff, wall, sea) -- no hunting for a narrow corridor.
mkdirSync(OUTPUT_DIR, { recursive: true })

const built = {}
Object.entries(MAPS).forEach(([name, def], i) => {
  const rng   = mulberry32(0x5C1A + i * 101)
  const noise = createNoise2D(rng)
  const t     = def.build(noise, rng)
  built[name] = {
    def, t,
    layer0: grid(W, H, (x, y) => t.tile(x, y) ?? GRASS[rng() < 0.5 ? 0 : 1]),
    layer1: grid(W, H, (x, y) => t.overlay?.(x, y) ?? 0),
    heightMap: grid(W + 1, H + 1, (x, y) => +t.height(x, y).toFixed(4)),
  }
})

// Standable: not sea, not a loch pool, not solid rock or hedge.
const NOT_STANDABLE = new Set([SEA, 1679])
function standable(m, x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return false
  if (NOT_STANDABLE.has(m.layer0[y][x])) return false
  const ex = m.t.extra || {}
  return !ex.blockMask?.[y]?.[x] && !ex.hedgeMask?.[y]?.[x]
}

// The edge tile, and the tile next door it leads to, for position i.
const EDGE = {
  north: i => [[i, 0], [i, H - 1]],
  south: i => [[i, H - 1], [i, 0]],
  west:  i => [[0, i], [W - 1, i]],
  east:  i => [[W - 1, i], [0, i]],
}
// Where an arrival lands, three tiles in from the edge it came through.
const LAND = {
  north: i => [i, 3],     south: i => [i, H - 4],
  west:  i => [3, i],     east:  i => [W - 4, i],
}

for (const [name, m] of Object.entries(built)) {
  const exits = {}, entries = {}
  const openCols = new Set(), openRows = new Set()
  for (const [dir, dest] of Object.entries(m.def.exits)) {
    const d = built[dest]
    const tiles = []
    for (let i = 1; i < (dir === 'north' || dir === 'south' ? W : H) - 1; i++) {
      const [[ax, ay], [bx, by]] = EDGE[dir](i)
      const [lx, ly] = LAND[OPPOSITE[dir]](i)
      if (standable(m, ax, ay) && d && standable(d, bx, by) && standable(d, lx, ly)) {
        tiles.push([ax, ay])
        ;(dir === 'north' || dir === 'south' ? openCols : openRows).add(i)
      }
    }
    if (!tiles.length) console.warn(`[skye_gen] ${name}: no crossable tiles on the ${dir} edge`)
    exits[dir] = { tiles, destination: dest, entryPoint: OPPOSITE[dir] }
  }
  // Arrivals keep the row/column they crossed at (see LAND).
  for (const dir of ['north', 'south', 'east', 'west']) entries[dir] = ENTRIES[dir]

  const t = m.t
  const map = {
    name, width: W, height: H,
    layers: [m.layer0, m.layer1],
    heightMap: m.heightMap, legend: LEGEND,
    spawns: { player: m.def.spawn ?? { x: MID, y: MID } },
    exits, entries,
    pathDist: pathDistFor(t.trail, t.trailFalloff),
    ...(t.extra || {}),
    border: { openCols: [...openCols].sort((a, b) => a - b), openRows: [...openRows].sort((a, b) => a - b) },
  }
  writeFileSync(resolve(OUTPUT_DIR, `${name}.json`), JSON.stringify(map))
  console.log(`[skye_gen] ${name}.json  exits: ` +
    Object.entries(exits).map(([k, v]) => `${k} (${v.tiles.length} tiles)`).join(', '))
}

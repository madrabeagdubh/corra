// cave_gen.mjs
// Location: tools/map-editor/generators/cave_gen.mjs
//
// The cave's test map: a layout carved from a list of passages and chambers, roughened with
// seeded noise, written once to public/maps/cave/<name>.json and then hand-edited from there.
// Re-running with the same seed gives the same map; the seed and the shapes below are the design.
//
//   node tools/map-editor/generators/cave_gen.mjs              -> caveTest.json, seed 3
//   node tools/map-editor/generators/cave_gen.mjs caveTest 11  -> same shapes, another roughening
//
// What's in the JSON beyond the usual (layers / wallMask / heightMap / spawns):
//   rockMask  1 = rock, 0 = open. NOT wallMask: every PerspectiveScene grows trees from a wallMask
//   outsideMask 1 = the way out: open cells whose daylight CaveWalls spreads into the cave
//   waterMask 1 = standing water. Drawn by caveWalls.js, NOT as PGR water tiles (PGR's water is a river's:
//             shifted rows and bank faces). The floor under it is plain dark stone.
//   stones    [{ x, y, h }]   standing stones (tile coords, h in tiles): drawn by caveWalls.js, block movement
//   cave      { ... }         hints for CaveWalls (wall height, dressed: [[x, y]] rock cells of worked stone), all optional
//
// Layout, south to north (the camera looks north, so you walk "into" the screen):
//   the way in         a short two-wide passage of dressed stone at the south; daylight comes down it
//   the great cave     one big irregular room at the mouth, three lobes run together, with boulders
//                      standing in it and spurs of rock jutting from its walls
//   the squeeze        from the back of it, one tile wide and long, winding north: close and dark
//   the drowned ring   a round chamber, a ring of stones, its southern half under water
// No single-tile alcoves (they read as digging, and are hard to line up with your feet): a pass fills
// any open cell with rock on three sides.

import { writeFileSync, mkdirSync } from 'fs'
import { createNoise2D } from 'simplex-noise'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../../../public/maps/cave')

const NAME = process.argv[2] || 'caveTest'
const SEED = Number(process.argv[3] || 3)

const W = 40, H = 48
const FLOOR = 6        // dark irregular flagstones (Oryx)
const ROCK  = 4        // plain dark grey: under the walls, never really seen
const POOL  = 4        // the floor under the water: plain dark grey

// seeded random (mulberry32), and noise from it
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
const rand = rng(SEED)
const noise = createNoise2D(rand)

// ── the shapes ────────────────────────────────────────────────────────────────
// chamber: centre, radius, rough = how far the wall wanders (tiles). The squeeze: a line of points,
// one tile wide
const CAVE = [
  { at: [20, 35], r: 7, rough: 1.8 },       // the mouth and the middle
  { at: [25.5, 31], r: 4.8, rough: 1.5 },     // a lobe to the north-east, where the squeeze starts
  { at: [13.5, 31], r: 4.2, rough: 1.4 },   // a lobe to the north-west
]
const SQUEEZE = [[24, 29], [23, 26], [22, 23], [20, 20], [19, 17], [18, 14], [18, 11]]
const POOL_ROOM = { at: [17, 6], r: 5.4, rough: 0.5 }          // the drowned ring's chamber
const RING = { at: [17, 6], r: 3.4, n: 7, waterFrom: 6.6 }     // stones; water south of y = waterFrom
// the way in: a short passage, two wide, from the cave's south lip to the map's edge. Its walls are
// dressed stone (cave.dressed: taller, in courses of blocks, spirals pecked on some), and the last two
// rows are where daylight comes from (outsideMask), the very last the way out
const MOUTH = { x: [19, 20], y: [42, 45], dressed: 3 }
const SPAWN = [20, 43]
const OUTSIDE_Y = 44
const EXIT_Y = MOUTH.y[1]
const BOULDERS = 7, SPURS = 7                                   // stood in the great cave

// ── carve ─────────────────────────────────────────────────────────────────────
const open = Array.from({ length: H }, () => new Array(W).fill(false))
const inb = (x, y) => x >= 1 && y >= 1 && x < W - 1 && y < H - 1
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const chamber = (s) => {
  const [cx, cy] = s.at
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy
    const a = Math.atan2(dy, dx)
    const r = s.r + s.rough * noise(Math.cos(a) * 1.3 + cx, Math.sin(a) * 1.3 + cy)
    if (Math.hypot(dx, dy) <= r) open[y][x] = true
  }
}
const nOpen = (x, y) => DIRS.filter(([dx, dy]) => open[y + dy]?.[x + dx]).length
// open cells with rock on three or four sides: alcoves, one tile deep and wide. Filled.
const fillNotches = (n = 4) => {
  for (let k = 0; k < n; k++) {
    let any = false
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (open[y][x] && nOpen(x, y) <= 1) { open[y][x] = false; any = true }
    if (!any) break
  }
}
const distToRock = (x, y) => {
  let d = 99
  for (let yy = y - 5; yy <= y + 5; yy++) for (let xx = x - 5; xx <= x + 5; xx++) if (!open[yy]?.[xx]) d = Math.min(d, Math.hypot(xx - x, yy - y))
  return d
}

for (const s of CAVE) chamber(s)
chamber(POOL_ROOM)
fillNotches()
for (let y = MOUTH.y[0]; y <= MOUTH.y[1]; y++) for (let x = MOUTH.x[0]; x <= MOUTH.x[1]; x++) open[y][x] = true

// boulders: rock standing free in the great cave, a cell to three. Kept well clear of the walls (so no
// one-tile gaps beside them), the way in and the way on
const inCave = (x, y) => y >= 26 && y <= 42
const far = (x, y, [px, py], d) => Math.hypot(x - px, y - py) >= d
const placed = []
for (let tries = 0; tries < 400 && placed.length < BOULDERS; tries++) {
  const x = 6 + Math.floor(rand() * 26), y = 27 + Math.floor(rand() * 14)
  if (!open[y][x] || !inCave(x, y)) continue
  if (distToRock(x, y) < 3 || !far(x, y, SPAWN, 3.5) || !far(x, y, SQUEEZE[0], 3.2)) continue
  if (placed.some(p => !far(x, y, p, 3.4))) continue
  placed.push([x, y])
  open[y][x] = false
  const extra = Math.floor(rand() * 3)                          // 0 to 2 more cells, joined on
  let [cx, cy] = [x, y]
  for (let k = 0; k < extra; k++) {
    const [dx, dy] = DIRS[Math.floor(rand() * 4)]
    if (open[cy + dy]?.[cx + dx] && distToRock(cx + dx, cy + dy) >= 2) { cx += dx; cy += dy; open[cy][cx] = false }
  }
}
// spurs: rock jutting from the wall, one or two cells in
let spurs = 0
for (let tries = 0; tries < 600 && spurs < SPURS; tries++) {
  const x = 4 + Math.floor(rand() * 30), y = 27 + Math.floor(rand() * 14)
  if (!open[y][x] || !inCave(x, y) || nOpen(x, y) !== 3) continue         // a floor cell against the wall
  if (!far(x, y, SPAWN, 4) || !far(x, y, SQUEEZE[0], 3.5)) continue
  if (placed.some(p => !far(x, y, p, 2.5))) continue
  const [dx, dy] = DIRS.find(([ax, ay]) => !open[y + ay]?.[x + ax])       // towards the wall
  open[y][x] = false; spurs++
  const [ix, iy] = [x - dx, y - dy]                                       // and one further in, sometimes
  if (rand() < 0.5 && open[iy]?.[ix] && nOpen(ix, iy) >= 3 && distToRock(ix, iy) >= 1.5) open[iy][ix] = false
}

// the squeeze: a single file of cells, no diagonal-only joins
for (let i = 0; i < SQUEEZE.length - 1; i++) {
  const [x0, y0] = SQUEEZE[i], [x1, y1] = SQUEEZE[i + 1]
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 4)
  let px = null, py = null
  for (let k = 0; k <= n; k++) {
    const t = k / n, cx = Math.floor(x0 + (x1 - x0) * t), cy = Math.floor(y0 + (y1 - y0) * t)
    if (!inb(cx, cy)) continue
    open[cy][cx] = true
    if (px !== null && px !== cx && py !== cy) open[py][cx] = true
    px = cx; py = cy
  }
}

// ── layers ────────────────────────────────────────────────────────────────────
// no way through that's only a diagonal step: wherever two open cells touch only at a corner, open one
// of the two rock cells beside them (whichever has more open floor round it already)
for (let pass = 0; pass < 3; pass++) {
  for (let y = 1; y < H - 2; y++) for (let x = 1; x < W - 2; x++) {
    const a = open[y][x], b = open[y][x + 1], c = open[y + 1][x], d = open[y + 1][x + 1]
    let pick = null
    if (a && d && !b && !c) pick = [[x + 1, y], [x, y + 1]]
    else if (b && c && !a && !d) pick = [[x, y], [x + 1, y + 1]]
    if (!pick) continue
    const around = ([px, py]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => open[py + dy]?.[px + dx]).length
    const [px, py] = around(pick[0]) >= around(pick[1]) ? pick[0] : pick[1]
    open[py][px] = true
  }
}

fillNotches(2)

// everything must be reachable from where you land
{
  const seen = new Set(), q = [SPAWN.join(',')]
  while (q.length) {
    const k = q.pop(); if (seen.has(k)) continue; seen.add(k)
    const [x, y] = k.split(',').map(Number)
    for (const [dx, dy] of DIRS) if (open[y + dy]?.[x + dx]) q.push(`${x + dx},${y + dy}`)
  }
  const ringOk = seen.has(`${RING.at[0]},${RING.at[1] - 1}`)
  const lost = []
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (open[y][x] && !seen.has(`${x},${y}`)) lost.push([x, y])
  if (!ringOk || lost.length) console.error(`!! ${lost.length} open cells unreachable; ring reachable: ${ringOk}`)
  for (const [x, y] of lost) open[y][x] = false     // pockets nobody can reach: filled
}

const outsideMask = open.map((row, y) => row.map(o => (o && y >= OUTSIDE_Y ? 1 : 0)))
// the rock flanking the passage, and closing its end: dressed
const dressed = []
for (let y = MOUTH.y[0]; y <= MOUTH.y[1] + 1; y++) for (let x = MOUTH.x[0] - MOUTH.dressed; x <= MOUTH.x[1] + MOUTH.dressed; x++) if (!open[y]?.[x]) dressed.push([x, y])
const exitTiles = []
for (let x = 0; x < W; x++) if (open[EXIT_Y][x]) exitTiles.push([x, EXIT_Y])
const rockMask = open.map(row => row.map(o => (o ? 0 : 1)))
const wet = (x, y) => y + 0.5 > RING.waterFrom && Math.hypot(x + 0.5 - RING.at[0], y + 0.5 - RING.at[1]) < 6.5
const waterMask = open.map((row, y) => row.map((o, x) => (o && wet(x, y) ? 1 : 0)))
const ground = open.map((row, y) => row.map((o, x) => (!o ? ROCK : waterMask[y][x] ? POOL : FLOOR)))
const objects = open.map(row => row.map(() => 0))
// the floor's lie, at the grid's corners (tiles): a gentle swell everywhere, the landing a little
// higher than the depths (the throat runs down between them), and the pool's bed below its shore.
// Kept small: PGR's camera doesn't rise and fall with you, so big heights shift the whole view
const swell = createNoise2D(rand)
const heightMap = Array.from({ length: H + 1 }, (_, y) => Array.from({ length: W + 1 }, (_, x) => {
  const lie = y >= 36 ? 0.35 : y <= 25 ? 0.1 : 0.1 + 0.25 * (y - 25) / 11
  let h = lie + 0.09 * swell(x * 0.35, y * 0.35) + 0.04 * swell(x * 1.1 + 40, y * 1.1)
  let wet = 0
  for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) if (waterMask[y + dy]?.[x + dx]) wet++
  h -= 0.06 * wet                       // a corner between four water cells: a quarter tile down
  return +h.toFixed(3)
}))

// the ring: stones evenly round, each a little different, one fallen short. Turned so the gap between two
// of them faces the way in (the squeeze comes up at about 71 degrees), not a stone
const RING_TURN = -0.31
const stones = []
for (let i = 0; i < RING.n; i++) {
  const a = -Math.PI / 2 + RING_TURN + (i / RING.n) * Math.PI * 2 + (rand() - 0.5) * 0.15
  const x = RING.at[0] + Math.cos(a) * RING.r, y = RING.at[1] + Math.sin(a) * RING.r
  stones.push({ x: +x.toFixed(2), y: +y.toFixed(2), h: +(i === 4 ? 0.7 : 1.5 + rand() * 0.7).toFixed(2) })
}

const map = {
  name: NAME, width: W, height: H,
  layers: [ground, objects], rockMask, waterMask, outsideMask, heightMap,
  legend: { [FLOOR]: 'cave floor', [ROCK]: 'rock / pool bed' },
  spawns: { player: { x: SPAWN[0], y: SPAWN[1] } },
  exits: { south: { tiles: exitTiles, destination: 'd2', entryPoint: 'cave' } },     // d2's side isn't built yet: it lands on d2's usual spawn
  stones,
  cave: { wallHeight: 1.4, dressed },
  seed: SEED,
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(resolve(OUT_DIR, `${NAME}.json`), JSON.stringify(map))

// a picture in the terminal: # rock, . floor, ~ water, o stone
const grid = ground.map((row, y) => row.map((g, x) => (rockMask[y][x] ? '#' : waterMask[y][x] ? '~' : '.')))
for (const s of stones) grid[Math.floor(s.y)][Math.floor(s.x)] = 'o'
console.log(grid.map(r => r.join('')).join('\n'))
console.log(`wrote public/maps/cave/${NAME}.json (seed ${SEED})`)

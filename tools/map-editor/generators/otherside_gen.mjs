// otherside_gen.mjs
// Location: tools/map-editor/generators/otherside_gen.mjs
//
// The first layer of the other side: a web of passages and chambers at several heights, written to
// public/maps/cave/otherside1.json (the same format as the cave's, see cave_gen.mjs, plus a few extras).
//
//   node tools/map-editor/generators/otherside_gen.mjs          seed 5
//   node tools/map-editor/generators/otherside_gen.mjs 9        another roughening, same design
//
// The design (north is up the screen; you start at the top and the way "back" is south):
//
//   THE RING        the drowned ring of the cave, copied cell for cell from caveTest.json (the chamber and the
//                   squeeze that leaves it), so it is the same place. But its walls are not all wall: set back
//                   in the dark, a way leaves it to the north, the north-east, the east and the west.
//   THE SQUEEZE     the same, down to the
//   GREAT HALL      a big room with pillars, a spur or two. From it:
//                     west   the Long Gallery (a straight way between standing stones, with niches) to the Weir
//                     east   steps UP to the Upper Ledge, and on to the East Crypts
//                     south  the Grand Stair, DOWN to the Sunken Court
//                     south-west  the Winding Way, a corridor that circles a solid core, down to the court
//   THE WEIR        a stream across a cavern: wade it; the ring's west tunnel and the north way both end here
//   EAST CRYPTS     three small round chambers (one flooded), reached from the ring's east tunnel, and joined to
//                   the Upper Ledge
//   SUNKEN COURT    the lowest big room: a lake with an island and a second ring of stones, a dry causeway to it
//   THE PROCESSIONAL  an avenue of paired stones east from the court, to the threshold, and the stair down (the
//                   exit, to the next layer, which is not built: otherside2)
//   shrines         small dead-end rooms with one stone, off the Gallery, the Hall, the Processional
//
// Heights: each chamber is given a height (tiles), the stairs are rises and falls between them, and the passages
// in between are left to settle (each cell the average of its neighbours), so they slope gently. Slopes are
// checked at the end.
//
// Extras in the JSON: stairs [{ x0, y0, x1, y1, dir }] (the cells of each flight; dir is the way DOWN),
// eyes [{ x, y, z }] (places something may watch from), cave.dressed (worked stone round the stairs and avenue).

import { writeFileSync, readFileSync, mkdirSync } from 'fs'
import { createNoise2D } from 'simplex-noise'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../../../public/maps/cave')
const SEED = Number(process.argv[2] || 5)
const W = 104, H = 112
const FLOOR = 6, ROCK = 4, POOL = 4
const OFF = [34, 14]                   // where the cave's ring chamber is put

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
const rand = rng(SEED)
const noise = createNoise2D(rand)

const open = Array.from({ length: H }, () => new Array(W).fill(false))
const water = Array.from({ length: H }, () => new Array(W).fill(0))
const fixed = Array.from({ length: H }, () => new Array(W).fill(null))     // anchored heights
const inb = (x, y) => x >= 1 && y >= 1 && x < W - 1 && y < H - 1
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]]

// ── the ring, copied ───────────────────────────────────────────────────────────
const cave = JSON.parse(readFileSync(resolve(OUT_DIR, 'caveTest.json'), 'utf8'))
const COPY_ROWS = 26
for (let y = 0; y < COPY_ROWS; y++) for (let x = 0; x < cave.width; x++) {
  const X = x + OFF[0], Y = y + OFF[1]
  if (!inb(X, Y)) continue
  open[Y][X] = !cave.rockMask[y][x]
  water[Y][X] = cave.waterMask[y][x]
  if (open[Y][X]) fixed[Y][X] = 0.1
}
const RING_STONES = cave.stones.map(s => ({ x: +(s.x + OFF[0]).toFixed(2), y: +(s.y + OFF[1]).toFixed(2), h: s.h }))
const RING_AT = [17 + OFF[0], 6 + OFF[1]]
const SPAWN = [RING_AT[0], RING_AT[1] - 1]

// ── carving ────────────────────────────────────────────────────────────────────
// a rough round chamber; h anchors its height; wet floods it
function chamber(cx, cy, r, rough = 1.2, h = null, wet = false) {
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy
    if (Math.abs(dx) > r + rough + 1 || Math.abs(dy) > r + rough + 1) continue
    const a = Math.atan2(dy, dx)
    const rr = r + rough * noise(Math.cos(a) * 1.3 + cx * 0.37, Math.sin(a) * 1.3 + cy * 0.37)
    if (Math.hypot(dx, dy) <= rr) { open[y][x] = true; if (h !== null) fixed[y][x] = h; if (wet) water[y][x] = 1 }
  }
}
// a passage along a line of points, w wide, its centre wandering a little
function way(pts, w = 2, wobble = 0.5, h = null) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(len * 3))
    for (let k = 0; k <= n; k++) {
      const t = k / n
      const cx = x0 + (x1 - x0) * t + wobble * noise(t * len * 0.35 + i * 7.1, 3.3 + i)
      const cy = y0 + (y1 - y0) * t + wobble * noise(5.5 + i, t * len * 0.35 + i * 3.7)
      if (w <= 1) {
        const X = Math.floor(cx), Y = Math.floor(cy)
        if (inb(X, Y)) { open[Y][X] = true; if (h !== null) fixed[Y][X] = h }
        continue
      }
      const rad = w / 2 + 0.2
      for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++) for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
        if (inb(x, y) && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= rad) { open[y][x] = true; if (h !== null) fixed[y][x] = h }
      }
    }
  }
}
// a straight run of cells (inclusive): a flight of steps. dir: the way DOWN; hTop at its high end, hBottom at its low
function rect(x0, y0, x1, y1, h = null) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y)) { open[y][x] = true; if (h !== null) fixed[y][x] = h }
}
const stairs = []
const pendingFlights = []
const flight = (...a) => pendingFlights.push(a)       // laid last, so no chamber or passage anchors over a step
function layFlight(x0, y0, x1, y1, dir, hTop, hBottom) {
  rect(x0, y0, x1, y1)
  const horiz = dir === 'E' || dir === 'W'
  const len = horiz ? x1 - x0 + 1 : y1 - y0 + 1
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = horiz ? (dir === 'E' ? x - x0 : x1 - x) : (dir === 'S' ? y - y0 : y1 - y)
    fixed[y][x] = hTop + (hBottom - hTop) * (i + 0.5) / len
  }
  stairs.push({ x0, y0, x1, y1, dir })
}
const flood = (cx, cy, r, keepDry = null) => {
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (open[y][x] && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r && !(keepDry && keepDry(x, y))) water[y][x] = 1
}
const dry = (cx, cy, r) => { for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) water[y][x] = 0 }
const stones = [...RING_STONES]
const stone = (x, y, h = 1.6) => stones.push({ x: +x.toFixed(2), y: +y.toFixed(2), h: +h.toFixed(2) })

// heights, tiles
const H_HALL = 0.4, H_COURT = -0.7, H_LEDGE = 1.3, H_CRYPT = 1.0, H_WEIR = -0.2, H_DEEP = -2.0

// ── the way on from the ring: the squeeze, then the great hall ──────────────────
way([[56, 39], [57, 41], [57, 44]], 1)
chamber(57, 54, 10.5, 2.2, H_HALL)
chamber(47, 57, 6.5, 1.6, H_HALL)
chamber(67, 57, 6.5, 1.6, H_HALL)
chamber(57, 63, 6, 1.4, H_HALL)

// the ring's hidden ways: each begins in the dark behind a bend, in the north half of the chamber
way([[51, 16], [51, 13], [49, 10], [44, 8], [37, 8], [30, 10], [26, 14]], 2, 0.6)                   // north
way([[54, 16], [57, 12], [62, 9]], 1)                                                                    // north-east: a spur
chamber(65, 8, 2.9, 0.6, 0.2)
way([[54, 19], [58, 19], [63, 19], [70, 18], [77, 19], [84, 21]], 2, 0.7)                              // east
way([[48, 19], [43, 19], [38, 21], [33, 23], [28, 27], [24, 32], [19, 38], [16, 45]], 2, 0.7)          // west
chamber(26, 15, 3, 0.8, -0.1)                                                                            // a cell where the north way bends
way([[26, 14], [22, 20], [18, 28], [12, 38], [10, 48], [10, 54]], 2, 0.6)                              // ...and on, down the far west

// the weir: a stream across a cavern
chamber(15, 56, 7.2, 1.6, H_WEIR)
way([[15, 44], [15, 70]], 3, 0.8, H_WEIR)
chamber(10, 67, 3.5, 0.8, H_WEIR)
for (let y = 46; y <= 69; y++) for (let x = 13; x <= 16; x++) if (open[y][x]) water[y][x] = 1      // the stream, wherever the cavern is

// the long gallery, hall to weir, with its niches
way([[42, 57], [22, 57]], 3, 0.3)
way([[30, 56], [30, 51]], 1)
chamber(30, 48.5, 2.6, 0.4)
way([[28, 59], [28, 63]], 1)
chamber(28, 65.5, 2.6, 0.4)

// the grand stair down to the sunken court
flight(56, 68, 58, 75, 'S', H_HALL, H_COURT)
chamber(57, 88, 13, 1.8, H_COURT)
chamber(57, 100, 4, 0.8, H_COURT)

// the winding way: a corridor round a solid core, from the hall's south-west to the court's west
way([[44, 63], [40, 67]], 2, 0.4)
const CORE = [36, 74], CORE_R = 5.4
{
  const ring = []
  for (let k = 0; k <= 40; k++) { const a = -Math.PI * 0.2 + (k / 40) * Math.PI * 2; ring.push([CORE[0] + Math.cos(a) * CORE_R, CORE[1] + Math.sin(a) * CORE_R]) }
  way(ring, 2, 0.15)
}
way([[36, 80], [38, 85], [44, 88]], 2, 0.4)

// the upper ledge: steps up from the hall's east, a shelf, and a stair of passages to the crypts
flight(71, 56, 77, 58, 'W', H_LEDGE, H_HALL)
way([[77, 57], [92, 57]], 3, 0.3, H_LEDGE)
chamber(86, 52, 3.8, 0.8, H_LEDGE)
way([[86, 50], [86, 37]], 2, 0.4)

// the east crypts
chamber(88, 22, 3.6, 0.7, H_CRYPT)
chamber(93, 30, 3.4, 0.7, H_CRYPT, true)
chamber(86, 36, 3.1, 0.6, H_CRYPT)
way([[88, 22], [93, 30]], 2, 0.4)
way([[93, 30], [86, 36]], 2, 0.4)
way([[84, 21], [88, 22]], 2, 0.2)

// the court's lake, island and causeway
flood(57, 89, 8.8)
dry(57, 89, 3.4)
{ // the causeway, 3 wide, from the stair's foot to the island
  for (let y = 75; y <= 87; y++) for (let x = 56; x <= 58; x++) water[y][x] = 0
}

// the processional and the threshold, and the stair down
way([[70, 88], [90, 88]], 3, 0.1, H_COURT)
chamber(94, 91, 5, 0.8, H_COURT)
way([[82, 88], [82, 84]], 1)
chamber(82, 81.5, 2.6, 0.4, H_COURT)
flight(93, 96, 95, 103, 'S', H_COURT, H_DEEP)
// a shrine off the hall
way([[49, 47], [44, 42], [40, 40]], 1)
chamber(38, 38.5, 2.7, 0.4, H_HALL)

for (const f of pendingFlights) layFlight(...f)

// ── pillars and spurs in the hall (rock standing free), as the cave's boulders ──
const distToRock = (x, y) => {
  let d = 99
  for (let yy = y - 4; yy <= y + 4; yy++) for (let xx = x - 4; xx <= x + 4; xx++) if (!open[yy]?.[xx]) d = Math.min(d, Math.hypot(xx - x, yy - y))
  return d
}
const reserved = [[56.5, 41], [57, 44], [57, 66], [57, 69], [44, 57], [70, 57], [46, 62], [41, 57]]
const pillars = []
for (let tries = 0; tries < 800 && pillars.length < 11; tries++) {
  const x = 46 + Math.floor(rand() * 26), y = 45 + Math.floor(rand() * 22)
  if (!open[y][x] || distToRock(x, y) < 2.6) continue
  if (reserved.some(([rx, ry]) => Math.hypot(x - rx, y - ry) < 3.6)) continue
  if (pillars.some(p => Math.hypot(x - p[0], y - p[1]) < 4.2)) continue
  pillars.push([x, y]); open[y][x] = false
  if (rand() < 0.5) { const [dx, dy] = DIRS[Math.floor(rand() * 4)]; if (open[y + dy][x + dx] && distToRock(x + dx, y + dy) >= 2) open[y + dy][x + dx] = false }
}
// a few big rocks in the court, on its dry parts
for (let tries = 0; tries < 400 && pillars.length < 16; tries++) {
  const x = 46 + Math.floor(rand() * 24), y = 78 + Math.floor(rand() * 20)
  if (!open[y][x] || water[y][x] || distToRock(x, y) < 2.6) continue
  if (Math.hypot(x - 57, y - 89) < 11) continue
  if (pillars.some(p => Math.hypot(x - p[0], y - p[1]) < 4.2)) continue
  pillars.push([x, y]); open[y][x] = false
}

// ── tidy: no diagonal-only joins, no one-cell notches ──────────────────────────
const nOpen = (x, y) => DIRS.filter(([dx, dy]) => open[y + dy]?.[x + dx]).length
for (let pass = 0; pass < 3; pass++) {
  for (let y = 1; y < H - 2; y++) for (let x = 1; x < W - 2; x++) {
    const a = open[y][x], b = open[y][x + 1], c = open[y + 1][x], d = open[y + 1][x + 1]
    let pick = null
    if (a && d && !b && !c) pick = [[x + 1, y], [x, y + 1]]
    else if (b && c && !a && !d) pick = [[x, y], [x + 1, y + 1]]
    if (!pick) continue
    const [px, py] = pick.map(p => [p, DIRS.filter(([dx, dy]) => open[p[1] + dy]?.[p[0] + dx]).length]).sort((m, n) => n[1] - m[1])[0][0]
    open[py][px] = true
  }
}
for (let k = 0; k < 3; k++) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (open[y][x] && nOpen(x, y) <= 1 && !(x === SPAWN[0] && y === SPAWN[1])) open[y][x] = false
// the core of the winding way stays solid, the ring's stones and anything standing in rock go
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!open[y][x]) { water[y][x] = 0; fixed[y][x] = null }

// ── stones ─────────────────────────────────────────────────────────────────────
for (const [x, y] of [[38, 56.5], [34, 58.5], [26, 56.5], [24, 58.5]]) stone(x, y, 1.5 + rand() * 0.6)     // the gallery
stone(54.5, 67.6, 1.9); stone(59.5, 67.6, 1.7)                                                              // by the stair's head
{ // the island's ring and the stones in the water
  const n = 5
  for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + 0.3 + (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.2; stone(57 + Math.cos(a) * 2.5, 89 + Math.sin(a) * 2.5, 1.4 + rand() * 0.7) }
  for (const [x, y] of [[54.2, 79], [59.8, 81.5], [54, 84], [60, 87], [51.5, 91], [63, 93], [57, 96.5]]) stone(x, y, 1.3 + rand() * 0.8)
}
for (const x of [74, 77, 83, 86]) { stone(x + 0.5, 87.5, 1.7 + rand() * 0.5); stone(x + 0.5, 89.5, 1.7 + rand() * 0.5) }   // the avenue
stone(91.5, 88, 2.2)
stone(94.5, 90.5, 1.0); stone(92, 93.5, 1.9); stone(97, 93.5, 1.9)
for (const [x, y] of [[88, 22], [86, 36], [38, 38.5], [30, 48.5], [28, 65.5], [82, 81.5], [65, 8], [26, 15], [10, 67]]) stone(x, y, 0.9 + rand() * 0.7)        // shrines and crypts
for (const [x, y] of [[93, 28.4], [95.4, 30], [93, 32], [90.6, 30]]) stone(x, y, 1.5)                                                                           // round the flooded crypt
for (const [x, y] of [[84, 50.8], [87.5, 53], [83.5, 53.4]]) stone(x, y, 1.7)                                                                                   // the ledge's chamber
stone(12.5, 55, 1.6); stone(18, 60, 1.5); stone(13.5, 50, 1.4)                                                                                                // the weir

// ── what must be reachable from where you wake ─────────────────────────────────
const stoneAt = new Set(stones.map(s => `${Math.floor(s.x)},${Math.floor(s.y)}`))
{
  const seen = new Set(), q = [SPAWN.join(',')]
  while (q.length) {
    const k = q.pop(); if (seen.has(k)) continue; seen.add(k)
    const [x, y] = k.split(',').map(Number)
    for (const [dx, dy] of DIRS) if (open[y + dy]?.[x + dx] && !stoneAt.has(`${x + dx},${y + dy}`)) q.push(`${x + dx},${y + dy}`)
  }
  const lost = []
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (open[y][x] && !seen.has(`${x},${y}`) && !stoneAt.has(`${x},${y}`)) lost.push([x, y])
  if (lost.length) {
    // pockets nobody can reach are filled -- unless they are big enough to be a design mistake
    const biggest = (() => { const s2 = new Set(lost.map(p => p.join(','))); let best = 0; const done = new Set(); for (const p of lost) { const k = p.join(','); if (done.has(k)) continue; let n = 0; const st = [k]; while (st.length) { const c = st.pop(); if (done.has(c) || !s2.has(c)) continue; done.add(c); n++; const [x, y] = c.split(',').map(Number); for (const [dx, dy] of DIRS) st.push(`${x + dx},${y + dy}`) } best = Math.max(best, n) } return best })()
    console.error(`!! ${lost.length} open cells unreachable (largest pocket ${biggest}): filled`)
    for (const [x, y] of lost) open[y][x] = false
  }
  for (const [name, [x, y]] of Object.entries({ hall: [57, 54], ledge: [86, 52], crypt: [88, 22], weir: [15, 56], court: [57, 88], threshold: [94, 91], island: [57, 89], stairEnd: [94, 102], shrineN: [26, 15], cell: [65, 8] })) {
    if (!seen.has(`${x},${y}`) && !stoneAt.has(`${x},${y}`)) console.error(`!! ${name} (${x},${y}) not reachable`)
  }
}

// ── heights ────────────────────────────────────────────────────────────────────
const hv = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (fixed[y][x] ?? 0.25)))
for (let it = 0; it < 2500; it++) {
  let moved = 0
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (!open[y][x] || fixed[y][x] !== null) continue
    let s = 0, n = 0
    for (const [dx, dy] of DIRS) if (open[y + dy][x + dx]) { s += hv[y + dy][x + dx]; n++ }
    if (!n) continue
    const v = s / n
    moved = Math.max(moved, Math.abs(v - hv[y][x]))
    hv[y][x] = v
  }
  if (moved < 1e-4) break
}
let worst = 0, worstAt = null
for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
  if (!open[y][x]) continue
  for (const [dx, dy] of [[1, 0], [0, 1]]) if (open[y + dy][x + dx]) { const d = Math.abs(hv[y][x] - hv[y + dy][x + dx]); if (d > worst) { worst = d; worstAt = [x, y] } }
}
console.log(`steepest step between neighbouring cells: ${worst.toFixed(3)} tiles at ${worstAt}`)
const swell = createNoise2D(rand)
const heightMap = Array.from({ length: H + 1 }, (_, y) => Array.from({ length: W + 1 }, (_, x) => {
  let s = 0, n = 0, wet = 0
  for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
    const cx = x + dx, cy = y + dy
    if (open[cy]?.[cx]) { s += hv[cy][cx]; n++; if (water[cy][cx]) wet++ }
  }
  let h = n ? s / n : 0.25
  // the pieces that are copied and the stairs stay as they are; elsewhere a small swell
  const onStair = stairs.some(a => x >= a.x0 && x <= a.x1 + 1 && y >= a.y0 && y <= a.y1 + 1)
  if (!onStair) h += 0.07 * swell(x * 0.35, y * 0.35) + 0.03 * swell(x * 1.1 + 40, y * 1.1)
  h -= 0.06 * wet
  return +h.toFixed(3)
}))

// ── worked stone: round the stairs and along the avenue ─────────────────────────
const dressed = []
const dressZone = (x0, y0, x1, y1, m = 2) => { for (let y = y0 - m; y <= y1 + m; y++) for (let x = x0 - m; x <= x1 + m; x++) if (!open[y]?.[x] && inb(x, y)) dressed.push([x, y]) }
for (const f of stairs) dressZone(f.x0, f.y0, f.x1, f.y1, 2)
dressZone(70, 87, 92, 89, 1)
dressZone(88, 85, 100, 97, 1)

// ── eyes: places in the dark something may watch from ───────────────────────────
const EYES = [
  [51, 11.5, 1.0], [45.5, 18.5, 1.0], [57.5, 19.5, 1.0], [55, 13.5, 1.0],              // the ring's four ways
  [47, 47, 1.0], [67, 46, 1.2], [48, 65, 1.0], [67, 65, 1.0], [57, 44.5, 1.5],          // the hall's corners
  [22.5, 57, 1.0], [27, 56.5, 1.2], [33, 58.5, 1.0], [41, 57, 1.0],                       // the gallery
  [10.5, 52, 1.0], [20, 61, 1.0], [15, 46, 1.0], [15, 67, 1.0],                           // the weir
  [40, 8, 1.0], [30, 9.5, 1.0], [24, 17, 1.0], [18, 29, 1.0],                              // the north and west ways
  [66, 19, 1.0], [75, 19, 1.0], [82, 21, 1.0],                                            // the east way
  [90, 24, 1.0], [93, 32, 1.0], [85, 37, 1.0],                                            // the crypts
  [80, 57, 1.2], [90, 57, 1.2], [84, 54, 1.2],                                            // the ledge
  [50, 96, 1.0], [64, 96, 1.0], [46.5, 86, 1.0], [68, 86, 1.0], [57, 100, 1.6], [57, 79, 1.4],   // the court
  [36, 68.5, 1.0], [41, 74, 1.0], [31, 74, 1.0], [36, 79.5, 1.0],                         // the winding way
  [76, 88, 1.0], [84, 88, 1.0], [92, 88.5, 1.0],                                          // the processional
  [38, 38.5, 1.0], [30, 49, 1.0], [28, 64, 1.0], [82, 82, 1.0], [65, 8.5, 1.0],
].filter(([x, y]) => open[Math.floor(y)]?.[Math.floor(x)])
for (const [x, y] of EYES) { if (!open[Math.floor(y)]?.[Math.floor(x)]) console.error('!! eye post in rock', x, y) }

// ── write ──────────────────────────────────────────────────────────────────────
const rockMask = open.map(row => row.map(o => (o ? 0 : 1)))
const waterMask = open.map((row, y) => row.map((o, x) => (o && water[y][x] ? 1 : 0)))
const ground = open.map((row, y) => row.map((o, x) => (!o ? ROCK : waterMask[y][x] ? POOL : FLOOR)))
const objects = open.map(row => row.map(() => 0))
const outsideMask = open.map(row => row.map(() => 0))
const map = {
  name: 'otherside1', width: W, height: H,
  layers: [ground, objects], rockMask, waterMask, outsideMask, heightMap,
  legend: { [FLOOR]: 'floor', [ROCK]: 'rock / pool bed' },
  spawns: { player: { x: SPAWN[0], y: SPAWN[1] } },
  exits: { down: { tiles: [[93, 103], [94, 103], [95, 103]], destination: 'otherside2', entryPoint: 'north' } },      // not built yet: ignored until it is
  stones, stairs, eyes: EYES.map(([x, y, z]) => ({ x, y, z })),
  cave: { wallHeight: 1.4, dressed },
  seed: SEED,
}
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(resolve(OUT_DIR, 'otherside1.json'), JSON.stringify(map))

const grid = ground.map((row, y) => row.map((g, x) => (rockMask[y][x] ? '#' : waterMask[y][x] ? '~' : '.')))
for (const f of stairs) for (let y = f.y0; y <= f.y1; y++) for (let x = f.x0; x <= f.x1; x++) grid[y][x] = '='
for (const s of stones) grid[Math.floor(s.y)][Math.floor(s.x)] = 'o'
for (const [x, y] of EYES) if (grid[Math.floor(y)][Math.floor(x)] === '.' || grid[Math.floor(y)][Math.floor(x)] === '~') grid[Math.floor(y)][Math.floor(x)] = 'e'
grid[SPAWN[1]][SPAWN[0]] = 'S'
console.log(grid.map(r => r.join('')).join('\n'))
console.log(`wrote public/maps/cave/otherside1.json (seed ${SEED}); ${open.flat().filter(Boolean).length} open cells`)

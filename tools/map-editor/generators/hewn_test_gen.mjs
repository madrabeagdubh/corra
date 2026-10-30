// hewn_test_gen.mjs
// Location: tools/map-editor/generators/hewn_test_gen.mjs
//
// A small test chamber for hewn rock (js/game/effects/hewnRock.js): every tile a column at its own height.
// Written to public/maps/cave/hewnTest.json. Laid out by hand, for the camera, which always looks north:
// a cliff shows its face to someone south of it, and a drop shows best looking north over its edge.
//
//   node tools/map-editor/generators/hewn_test_gen.mjs
//
// South to north (you start at the bottom):
//
//   THE GULLET      a winding crack one tile wide, its walls rising out of the light; two lintels across it
//                   to duck under, a lip to step over. The camera closes in.
//   THE CAVERN      it opens out: a hall whose walls go up out of sight. A dying fire by the way in.
//   THE CLEFT       across the hall, a crack with no bottom, three tiles across, and a bridge over it. A stream runs down its own
//                   narrow canyon from the north and pours over the edge into the dark.
//   THE CUBES       stepped blocks against the east wall, climbable one onto the next, to a shelf with a pouch
//   THE GRAND STAIR rising north, its risers toward you, to the terrace
//   THE TERRACE     high, with two pillars; the stream comes out from under it, through an arch in its face
//   THE SUNKEN COURT  north of the terrace and far below its edge: a floor you can see but not reach, a pool,
//                   glow-worms on the far wall, and high in that wall a niche with a candle and a crown in it

import { writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../../../public/maps/cave')
const W = 34, H = 52
const BIG = 11            // the rock round the halls: far above any floor
const TIGHT = 4.5         // the gullet's walls

const kind = Array.from({ length: H }, () => new Array(W).fill('#'))
const z = Array.from({ length: H }, () => new Array(W).fill(BIG))
const set = (x, y, k, h) => { kind[y][x] = k; z[y][x] = h }
const rect = (x0, y0, x1, y1, k, h) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, k, h) }
const spans = [], lights = [], props = [], falls = []

// ── the sunken court, and the niche in its north wall ─────────────────────────
rect(6, 2, 29, 10, '.', 0)
rect(20, 5, 26, 8, '~', -0.2)                      // a pool, a hand's depth below the floor
rect(9, 6, 10, 7, '.', 1.0)                        // a block
set(15, 4, '.', 0.6)
set(18, 1, '.', 3); set(19, 1, '.', 3)            // the niche, three tiles up the wall
props.push({ x: 18.95, y: 1.65, z: 3, gid: 2436, s: 0.5 })         // a crown (TILES.CROWN)
lights.push({ x: 18.9, y: 1.5, z: 3.5, r: 3.4, rgb: [255, 190, 110], i: 1.2 })          // its candle
for (const [x, zz, i] of [[8, 5, 1.0], [11.5, 7.5, 0.8], [14.5, 4.5, 0.9], [25, 6.5, 0.9], [28.5, 4, 0.8]])
  lights.push({ x, y: 2.15, z: zz, r: 7.5, rgb: [80, 215, 185], i })                     // glow-worms on the far wall
props.push({ x: 0, y: 1.999, type: 'glowworms', x0: 6.2, x1: 17.6, z0: 1.5, z1: 9.5, n: 70 })
props.push({ x: 0, y: 1.999, type: 'glowworms', x0: 20.4, x1: 29.8, z0: 1, z1: 9, n: 60 })
lights.push({ x: 23, y: 6.8, z: 0.4, r: 5.5, rgb: [140, 180, 225], i: 0.9 })           // the pool's own pallor
lights.push({ x: 15, y: 6.5, z: 6, r: 10, rgb: [150, 165, 200], i: 0.7 })              // something pale, high up
lights.push({ x: 8.5, y: 8.5, z: 1.5, r: 4.5, rgb: [80, 215, 185], i: 0.7 })            // glow-worms low on the west wall

// ── the terrace ───────────────────────────────────────────────────────────────
rect(6, 11, 29, 17, '.', 4)
set(13, 13, '#', BIG); set(24, 14, '#', BIG)      // pillars

// ── the cavern ────────────────────────────────────────────────────────────────
rect(6, 18, 29, 40, '.', 0)
// the grand stair: twelve risers of a third of a tile, rising north from the cavern floor to the terrace
for (let y = 18; y <= 28; y++) for (let x = 18; x <= 20; x++) set(x, y, '.', +(4 - (y - 17) / 3).toFixed(3))
// the stream: a narrow canyon six tiles down, from under the terrace (an arch: the terrace runs over it on a
// slab) south to the cleft, where it falls over the edge
rect(10, 11, 11, 17, '~', -6)
for (let y = 11; y <= 17; y++) for (let x = 10; x <= 11; x++) spans.push({ x, y, z: 4, t: 0.8, walk: 'deck' })
rect(10, 18, 11, 33, '~', -6)
for (const y of [13.5, 19.5, 25.5, 31.5]) lights.push({ x: 10.9, y, z: -5.2, r: 5, rgb: [150, 190, 230], i: 0.95 })
// the cleft, and the bridge over it
rect(6, 34, 29, 36, 'v', 0)
for (let y = 34; y <= 36; y++) for (const x of [18, 19]) spans.push({ x, y, z: 0, t: 0.7, walk: 'deck' })
falls.push({ x0: 10.05, x1: 11.95, y: 34.02, z0: -6, z1: -16 })
lights.push({ x: 11, y: 34.6, z: -7.5, r: 4.5, rgb: [150, 190, 230], i: 0.8 })
// the cubes: a step at a time, half a tile each, up to a shelf against the east wall
set(25, 29, '.', 0.5); set(26, 29, '.', 1.0); set(26, 28, '.', 1.5); set(27, 28, '.', 2.0)
rect(28, 26, 29, 28, '.', 2.5)
props.push({ x: 28.9, y: 27.1, z: 2.5, gid: 2353, s: 0.42 })      // a pouch (TILES.POUCH)
// blocks standing about, too high to climb
set(13, 22, '.', 0.6); set(14, 22, '.', 1.6); set(14, 23, '.', 1.0)
set(8, 39, '.', 1.3); set(23, 39, '.', 0.8)
// pillars
set(15, 26, '#', BIG); set(24, 32, '#', BIG); set(26, 20, '#', BIG)
// the fire by the way in, burnt down
props.push({ x: 16.5, y: 38.5, z: 0, type: 'embers' })
lights.push({ x: 16.5, y: 38.5, z: 0.5, r: 6.5, rgb: [255, 140, 70], i: 1.0 })
props.push({ x: 22.6, y: 37.7, z: 0, gid: 2381, s: 0.5 })         // bones by the edge (TILES.BONES)

// ── the gullet ────────────────────────────────────────────────────────────────
for (let y = 41; y < H; y++) for (let x = 12; x <= 20; x++) if (kind[y][x] === '#') z[y][x] = TIGHT
for (const [x, y] of [[15, 41], [15, 42], [15, 43], [16, 43], [16, 44], [16, 45], [17, 45], [17, 46], [17, 47], [16, 47], [16, 48], [16, 49], [16, 50]]) set(x, y, '.', 0)
set(16, 48, '.', 0.4)                                                // a lip to step over
spans.push({ x: 16, y: 44, z: 2.2, t: 0.45, walk: 'under' })         // lintels: you pass under them
spans.push({ x: 17, y: 46, z: 2.0, t: 0.4, walk: 'under' })
const SPAWN = { x: 16, y: 50 }

// the camera: closer in the gullet, further out in the halls, furthest at the terrace's edge, where it looks
// out ahead of you (look: you're moved that much further down the screen, and more shows beyond)
const zones = [
  { x0: 12, y0: 41, x1: 20, y1: 51, zoom: 1.05 },
  { x0: 6, y0: 11, x1: 29, y1: 13, zoom: 0.58, look: 0.2 },      // the terrace's edge: look out over the court
  { x0: 0, y0: 0, x1: 33, y1: 40, zoom: 0.72, look: 0.06 },
]

const map = {
  name: 'hewnTest', width: W, height: H,
  layers: [Array.from({ length: H }, () => new Array(W).fill(0)), Array.from({ length: H }, () => new Array(W).fill(0))],
  legend: {}, spawns: { player: SPAWN }, exits: {},
  hewn: { kind: kind.map(r => r.join('')), z, spans, lights, props, falls, zones },
}
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(resolve(OUT_DIR, 'hewnTest.json'), JSON.stringify(map))
console.log(`hewnTest.json: ${W}x${H}, ${spans.length} spans, ${lights.length} lights, ${props.length} props`)
console.log(kind.map((r, y) => String(y).padStart(2) + ' ' + r.join('')).join('\n'))

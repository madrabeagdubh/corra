// d2_tomb_gen.mjs -- d2 with the hill and the portal tomb that leads down into the cave.
//
//   node tools/map-editor/generators/d2_tomb_gen.mjs
//
// Reads the forest d2 as it was (public/maps/bogMaps/d2.pre-tomb.json -- made from d2.json the first time this
// runs, so it can be run again) and writes d2.json with:
//   * a hill in the north-east, steep behind the tomb (the climb limit is 0.6 a tile: it's a wall), and a level
//     terrace in front of the tomb
//   * a worn path up to it from the middle of the map (no trees, a mud tint: map.pathDist), gently graded
//   * more trees on the hill's flanks, none on the path or the terrace
//   * mapData.tomb: where the dolmen stands, the tiles its stones fill (blocked), and the doorway
//   * exits.cave (the doorway -> the cave scene, walking on in), entries.cave (where you come out)
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { buildPathDistGrid, carvePathCorridor } from './_pathShared.mjs'

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../public/maps/bogMaps')
const SRC = `${DIR}/d2.pre-tomb.json`, OUT = `${DIR}/d2.json`
if (!existsSync(SRC)) copyFileSync(OUT, SRC)
const map = JSON.parse(readFileSync(SRC, 'utf8'))
const W = map.width, H = map.height

// ── where things are ─────────────────────────────────────────────────────────
const HILL = { x: 28.0, y: 5.4, R: 5.4, p: 3, rise: 4.2 }   // a round, steep-shouldered mound: the tomb's body, its passage cut into the south face
const TOMB = { x: 28, y: 10 }                   // the dolmen's anchor tile
const DOOR = [[28, 10]]                         // the doorway tile: solid; you go in by choosing to (d2.js, the card), not by stepping
const OUT_AT = { x: 28, y: 13 }                 // where you come out
const TERRACE = { x: 28.5, y: 12.2, r: 2.6 }    // level ground before the tomb
const PATH = [[17.5, 18.5], [20.5, 17.5], [23.5, 15.5], [25.5, 13.8], [27.0, 12.8], [28.0, 12.2]]
const PATH_HALF = 1.8

const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t) }
const hm = map.heightMap.map(r => r.slice())

// ── the hill ─────────────────────────────────────────────────────────────────
for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) {
  const g = Math.exp(-Math.pow(Math.hypot(x - HILL.x, y - HILL.y) / HILL.R, HILL.p))
  hm[y][x] += HILL.rise * g
}
// the terrace: level, at the height the hill gives its middle
const th = (() => { const x = Math.round(TERRACE.x), y = Math.round(TERRACE.y); return hm[y][x] })()
for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) {
  const d = Math.hypot(x - TERRACE.x, (y - TERRACE.y) * 1.2)
  const w = 1 - smooth((d - TERRACE.r) / 2.2)
  if (w > 0) hm[y][x] = hm[y][x] * (1 - w) + th * w
}
// the path: graded from the height where it starts to the terrace's
const segLen = PATH.slice(1).map((p, i) => Math.hypot(p[0] - PATH[i][0], p[1] - PATH[i][1]))
const total = segLen.reduce((a, b) => a + b, 0)
const near = (px, py) => {            // distance to the path, and how far along it (0..1)
  let best = Infinity, at = 0, run = 0
  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, ay] = PATH[i], [bx, by] = PATH[i + 1], dx = bx - ax, dy = by - ay
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    const d = Math.hypot(px - (ax + dx * t), py - (ay + dy * t))
    if (d < best) { best = d; at = (run + segLen[i] * t) / total }
    run += segLen[i]
  }
  return { d: best, at }
}
const h0 = hm[Math.round(PATH[0][1])][Math.round(PATH[0][0])]
for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) {
  const { d, at } = near(x, y)
  const w = 1 - smooth((d - PATH_HALF) / 1.6)
  if (w > 0) hm[y][x] = hm[y][x] * (1 - w) + (h0 + (th - h0) * smooth(at)) * w
}
map.heightMap = hm.map(r => r.map(v => +v.toFixed(3)))

// ── trees and the path ───────────────────────────────────────────────────────
let seed = 90210
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
const wm = map.wallMask.map(r => r.slice())
// the mound is bare: clear any tree the old forest left on it
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.hypot(x + 0.5 - HILL.x, y + 0.5 - HILL.y) / HILL.R < 1.3) wm[y][x] = 0
for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
  const dh = Math.hypot(x + 0.5 - HILL.x, y + 0.5 - HILL.y) / HILL.R   // none on the mound itself: it's a built thing
  if (dh > 1.15 && dh < 2.2 && rnd() < 0.14) wm[y][x] = 1
}
const dist = buildPathDistGrid(PATH, W, H)
const pathDist = carvePathCorridor(wm, dist, W, H, { halfWidth: PATH_HALF + 0.6, tintFalloff: 4.5 })
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (Math.hypot(x + 0.5 - TERRACE.x, (y + 0.5 - TERRACE.y) * 1.2) < TERRACE.r + 0.8) wm[y][x] = 0
}
// keep the frontage clear: nothing stands between you and the passage
for (let y = 9; y <= 16; y++) for (let x = 24; x <= 33; x++) wm[y][x] = 0
map.wallMask = wm
map.pathDist = pathDist.map(r => r.map(v => +v.toFixed(3)))

// ── the tomb, the way in, the way out ────────────────────────────────────────
// the portal stones either side of the doorway, and the rock behind it, are solid
map.tomb = { x: TOMB.x, y: TOMB.y, blocked: [[28, 10], [27, 10], [29, 10], [26, 10], [30, 10], [27, 9], [28, 9], [29, 9]] }
map.exits = { ...map.exits, cave: { tiles: [], destination: 'caveTest', entryPoint: 'north', walk: [0, -1] } }
map.entries = { ...map.entries, cave: { x: OUT_AT.x, y: OUT_AT.y } }

writeFileSync(OUT, JSON.stringify(map))
console.log('wrote', OUT)

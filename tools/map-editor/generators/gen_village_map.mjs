// gen_village_map.mjs
// Regenerates b0 as a working ráth: a homely single-bank ringfort crowning
// a low green hill, approached from the south (b1) so the whole composition
// rises ahead of the camera -- slope, ditch, earthen bank with stone-faced
// scarps (SteepFaceRenderer picks these up in the updated BogB0 scene), a
// timber palisade along the crest (wallMask posts rendered by ForestEffects
// with the scene's bare-pole options), and one causewayed gateway due south.
//
// TERRAIN (pure heightMap -- the old GID-driven elevationConfig is retired):
//   • broad dome ~HILL_H tiles high, centred on the fort
//   • bank: radial ridge +BANK_H at radius RING_R
//   • ditch: radial trench -DITCH_D just outside the bank
//   • causeway: a southern angular wedge where bank+ditch fade to a smooth
//     ramp -- the only comfortable way in, flanked by the bank's cut cheeks
//
// LAYOUT (recorded in map JSON for phase 2's RoundhouseRenderer; footprints
// are left unmasked and walkable until houses actually render):
//   mapData.houses   -- great hall at the crown, tavern-house, dwellings
//   mapData.features -- fire pit, well, hurdle pen
//
// PRESERVED: exits / entries / border / spawns are carried over from
// b0.pre-village.json (created on first run), so the b1 link is untouched.
// Idempotent: reruns always source those from the backup.
//
// Usage:  node tools/map-editor/generators/gen_village_map.mjs

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MAPS_DIR = resolve(__dirname, '../../../public/maps/bogMaps')

const W = 36, H = 36
const CX = 18, CY = 15          // fort centre (crown sits north of map centre
                                // so the southern approach is long)
const HILL_H  = 1.2             // dome height (tiles)
const HILL_R  = 15              // dome radius
const RING_R  = 10.5            // bank crest radius
const BANK_H  = 1.5             // bank height above local ground
const BANK_W  = 1.0             // bank gaussian half-width
const DITCH_R = 13.2            // ditch centre radius
const DITCH_D = 0.8             // ditch depth
const DITCH_W = 1.1
const GATE_HALF_DEG = 12        // causeway angular half-width (due south)
const GRASS_GIDS = [839, 840]

const gauss = (d, w) => Math.exp(-(d * d) / (2 * w * w))
const smooth = t => t * t * (3 - 2 * t)
function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2654435761) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff
}

// How much the ring (bank + ditch) applies at a given angle: fades to zero
// through the gate wedge, which faces due south (atan2 y-positive = south).
function ringFactor(vx, vy) {
  const ang = Math.atan2(vy - CY, vx - CX) * 180 / Math.PI   // south = +90
  const off = Math.abs(ang - 90)
  if (off >= GATE_HALF_DEG * 2) return 1
  if (off <= GATE_HALF_DEG) return 0
  return smooth((off - GATE_HALF_DEG) / GATE_HALF_DEG)
}

// ── Terrain ──────────────────────────────────────────────────────────────────
const hm = []
for (let vy = 0; vy <= H; vy++) {
  const row = []
  for (let vx = 0; vx <= W; vx++) {
    const d = Math.hypot(vx - CX, vy - CY)
    let h = (hash(vx, vy, 7) - 0.5) * 0.12                     // faint texture
    h += HILL_H * smooth(Math.max(0, 1 - d / HILL_R))          // the dome
    const rf = ringFactor(vx, vy)
    h += BANK_H * gauss(d - RING_R, BANK_W) * rf               // the bank
    h -= DITCH_D * gauss(d - DITCH_R, DITCH_W) * rf            // the ditch
    row.push(Number(h.toFixed(4)))
  }
  hm.push(row)
}

// ── Palisade (wallMask posts on the bank crest, gate left open) ─────────────
const wallMask = Array.from({ length: H }, () => new Array(W).fill(0))
let posts = 0
for (let ty = 0; ty < H; ty++)
  for (let tx = 0; tx < W; tx++) {
    const d = Math.hypot(tx + 0.5 - CX, ty + 0.5 - CY)
    if (d < RING_R - 0.45 || d > RING_R + 0.45) continue
    if (ringFactor(tx + 0.5, ty + 0.5) < 0.85) continue        // gate + cheeks stay clear
    wallMask[ty][tx] = 1
    posts++
  }

// ── Layout for phase 2 (recorded, not yet rendered or masked) ───────────────
const houses = [
  { id: 'greathall', kind: 'greathall', x: 18, y: 10, r: 3.0 },
  { id: 'tavern',    kind: 'tavern',    x: 23, y: 14, r: 2.5, door: 'tavern' },
  { id: 'house_1',   kind: 'dwelling',  x: 13, y: 12, r: 2.0 },
  { id: 'house_2',   kind: 'dwelling',  x: 13, y: 18, r: 2.0 },
  { id: 'house_3',   kind: 'dwelling',  x: 22, y: 19, r: 2.0 },
]
const features = [
  { id: 'firepit', kind: 'firepit', x: 18, y: 15 },
  { id: 'well',    kind: 'well',    x: 16, y: 18 },
  { id: 'pen',     kind: 'pen',     x: 24, y: 17 },
]

// ── Layers ───────────────────────────────────────────────────────────────────
const layer0 = Array.from({ length: H }, (_, y) =>
  Array.from({ length: W }, (_, x) => GRASS_GIDS[hash(x, y, 41) < 0.5 ? 0 : 1]))
const layer1 = Array.from({ length: H }, () => new Array(W).fill(0))

// ── Preserve links from the pre-village original ─────────────────────────────
const path = resolve(MAPS_DIR, 'b0.json')
const backup = resolve(MAPS_DIR, 'b0.pre-village.json')
if (!existsSync(path)) { console.error('b0.json not found'); process.exit(1) }
if (!existsSync(backup)) writeFileSync(backup, readFileSync(path))
const orig = JSON.parse(readFileSync(backup, 'utf8'))

const map = {
  name: 'village-rath-b0',
  width: W, height: H,
  layers: [layer0, layer1],
  heightMap: hm,
  wallMask,
  hasCliffs: true,
  legend: { 839: 'grass', 840: 'grass' },
  houses,
  features,
  spawns:  orig.spawns  ?? { player: { x: 17, y: 30 } },
  entries: orig.entries ?? { south: { x: 17, y: 32, yFromSource: false } },
  exits:   orig.exits   ?? {},
  border:  orig.border  ?? {},
}
writeFileSync(path, JSON.stringify(map))

// ── Report ───────────────────────────────────────────────────────────────────
console.log(`b0: ráth generated | ${posts} palisade posts | ${houses.length} house sites | ${features.length} features | links preserved (${Object.keys(map.exits).join('/') || 'none'})`)

// Gate-line height profile (col x=18, walking north from the south edge):
const tileH = (x, y) => (hm[y][x] + hm[y][x + 1] + hm[y + 1][x] + hm[y + 1][x + 1]) / 4
let profile = []
let maxStep = 0
for (let y = H - 2; y >= 8; y--) {
  profile.push(tileH(18, y).toFixed(2))
  if (y < H - 2) maxStep = Math.max(maxStep, Math.abs(tileH(18, y) - tileH(18, y + 1)))
}
console.log('gate approach profile (x=18, south->north):', profile.join(' '))
console.log(`max step on approach: ${maxStep.toFixed(2)} tiles ${maxStep < 0.8 ? '✓ comfortable' : '⚠ steep -- widen GATE_HALF_DEG'}`)

// ASCII: # post, h house site, f feature, E exit, . ground, = ditch, ^ bank
const exitTiles = new Set(Object.values(map.exits).flatMap(e => e.tiles.map(([x, y]) => `${x},${y}`)))
for (let y = 0; y < H; y++) {
  let row = ''
  for (let x = 0; x < W; x++) {
    const d = Math.hypot(x + 0.5 - CX, y + 0.5 - CY)
    if (exitTiles.has(`${x},${y}`)) row += 'E'
    else if (wallMask[y][x]) row += '#'
    else if (houses.some(hh => Math.hypot(x - hh.x, y - hh.y) < 1)) row += 'h'
    else if (features.some(f => f.x === x && f.y === y)) row += 'f'
    else if (tileH(x, y) - HILL_H * smooth(Math.max(0, 1 - d / HILL_R)) < -0.35) row += '='
    else if (tileH(x, y) - HILL_H * smooth(Math.max(0, 1 - d / HILL_R)) > 0.6) row += '^'
    else row += '.'
  }
  console.log(row)
}

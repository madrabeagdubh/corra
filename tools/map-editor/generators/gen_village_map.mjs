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

// Scaled up from the original 36x36/HILL_H=1.2 draft to an actual hillfort:
// a broader, taller dome (a real climb, not a bump), a bigger-radius crest
// (real interior room for the house sites below instead of a tight cluster),
// and a longer flat approach from the b1 border before the slope even starts.
const W = 56, H = 56
const CX = 28, CY = 24          // fort centre (crown sits north of map centre
                                // so the southern approach is long)
const HILL_H  = 3.0             // dome height (tiles) -- a real climb
const HILL_R  = 22              // dome radius
const RING_R  = 16              // bank crest radius (fort interior)
const BANK_H  = 2.0             // bank height above local ground
const BANK_W  = 1.2             // bank gaussian half-width
const DITCH_R = 19.5            // ditch centre radius
const DITCH_D = 1.0             // ditch depth
const DITCH_W = 1.3
const GATE_HALF_DEG = 13        // causeway angular half-width (due south)
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
  // Rectangular, not round -- reads as distinct/prestigious against the
  // huts by shape alone. Shown lengthwise: w = full length (east-west,
  // broadside to the southern approach) is the LARGE dimension, d = full
  // depth (north-south) is short. r kept as a bounding radius for
  // offscreen culling/sort only.
  { id: 'longhall', kind: 'longhall', x: 28, y: 18, w: 7.0, d: 3.2, r: 3.9 },
  { id: 'tavern',   kind: 'tavern',   x: 36, y: 23, r: 2.6, door: 'tavern' },
  { id: 'house_1',  kind: 'dwelling', x: 20, y: 22, r: 2.4 },
]
const features = [
  { id: 'firepit', kind: 'firepit', x: 28, y: 24 },
  { id: 'well',    kind: 'well',    x: 25, y: 29 },
  { id: 'pen',     kind: 'pen',     x: 37, y: 27 },
]

// ── Layers ───────────────────────────────────────────────────────────────────
const layer0 = Array.from({ length: H }, (_, y) =>
  Array.from({ length: W }, (_, x) => GRASS_GIDS[hash(x, y, 41) < 0.5 ? 0 : 1]))
const layer1 = Array.from({ length: H }, () => new Array(W).fill(0))

// ── Keep a copy of the pre-village original around (revert safety net) ─────
const path = resolve(MAPS_DIR, 'b0.json')
const backup = resolve(MAPS_DIR, 'b0.pre-village.json')
if (!existsSync(path)) { console.error('b0.json not found'); process.exit(1) }
if (!existsSync(backup)) writeFileSync(backup, readFileSync(path))

// Southern link to b1: now spans the FULL width of the map's south edge --
// not just a narrow corridor -- since the flat apron between the ring and
// the edge is already open ground the whole way across; the ring's own
// single gate is still the only way IN to the ráth itself, this just
// widens where the b1 threshold crossing can happen along that apron.
const doorTiles = Array.from({ length: W }, (_, x) => [x, H - 2])
const openCols   = Array.from({ length: W }, (_, x) => x)

const map = {
  name: 'village-rath-b0',
  width: W, height: H,
  layers: [layer0, layer1],
  heightMap: hm,
  wallMask,
  hasCliffs: false,
  legend: { 839: 'grass', 840: 'grass' },
  houses,
  features,
  spawns:  { player: { x: CX - 1, y: H - 6 } },
  entries: { south: { x: CX - 1, y: H - 4, yFromSource: false } },
  exits:   { south: { tiles: doorTiles, destination: 'b1', entryPoint: 'north' } },
  border:  { openCols, openRows: [] },
}
writeFileSync(path, JSON.stringify(map))

// ── Report ───────────────────────────────────────────────────────────────────
console.log(`b0: ráth generated | ${posts} palisade posts | ${houses.length} house sites | ${features.length} features | links preserved (${Object.keys(map.exits).join('/') || 'none'})`)

// Gate-line height profile (col x=CX, walking north from the south edge):
const tileH = (x, y) => (hm[y][x] + hm[y][x + 1] + hm[y + 1][x] + hm[y + 1][x + 1]) / 4
let profile = []
let maxStep = 0
for (let y = H - 2; y >= CY; y--) {
  profile.push(tileH(CX, y).toFixed(2))
  if (y < H - 2) maxStep = Math.max(maxStep, Math.abs(tileH(CX, y) - tileH(CX, y + 1)))
}
console.log(`gate approach profile (x=${CX}, south->north):`, profile.join(' '))
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

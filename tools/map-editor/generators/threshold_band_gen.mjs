// threshold_band_gen.mjs
// Phase 1 of the deep-forest threshold: converts the a4-d4 row into the
// forest's edge. The southern portion of each map becomes a band of large,
// closely-canopied trees -- walkable ground between trunks, but foliage
// dense enough that (with the scene's enlarged ForestEffects options) the
// camera loses sight of the middle of the map as the player pushes south.
//
// Per map, this script:
//   1. Collects every Oryx tree-stamp cell (any layer) and clears them all
//      (same GID catalogue + logic as migrate_oryx_trees.mjs).
//   2. NORTH ZONE (rows 0 .. BAND_START_ROW-1): sparse-keeps a fraction of
//      the old tree cells as wallMask trunks (KEEP_CHANCE, deterministic
//      hash) -- identical behaviour to the a1-d3 migration.
//   3. BAND ZONE (rows BAND_START_ROW .. H-2): ignores the old stamps and
//      places fresh trunks on a jittered grid (GRID_STEP +/- jitter), with
//      keep-probability ramping from BAND_DENSITY_NEAR at the band's north
//      edge to BAND_DENSITY_FAR at the south edge -- the forest thickens
//      as you go deeper. Skips water, map borders, entry/spawn clearings,
//      and the south-exit tiles (plus margin) so the crossing is passable
//      but never a telegraphed corridor.
//   4. Bakes root peaks for ALL wallMask cells into the existing heightMap
//      (gaussian-with-plateau, constants matching migrate_oryx_trees /
//      ForestEffects trunk anchoring).
//   5. Sets hasCliffs = true.
//   6. Adds a south exit (y = H-2, cols SOUTH_EXIT_COLS) to the matching
//      row-5 map (a4 -> a5, etc.), entryPoint 'north', tagged
//      beat:'threshold' for the phase-2 crossing beat. Unions the exit
//      cols into border.openCols so the edge is physically open.
//   7. Verifies (BFS over the final wallMask + border) that the north
//      entry can still reach the south exit. Aborts without writing if not.
//
// Writes <name>.json in place, saving <name>.pre-threshold.json backup
// (first run only -- reruns won't clobber the original backup).
//
// Usage:  node tools/map-editor/generators/threshold_band_gen.mjs           (all four)
//         node tools/map-editor/generators/threshold_band_gen.mjs a4 c4     (specific maps)
//
// Rerunning is safe and idempotent: if <name>.pre-threshold.json exists it
// is used as the pristine source, so constants can be retuned and the
// script rerun freely without accumulating heightMap root peaks.

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MAPS_DIR = resolve(__dirname, '../../../public/maps/bogMaps')

// ── Tunables ──────────────────────────────────────────────────────────────────
const BAND_START_ROW    = 24     // first row of the canopy band (top 2/3 of map stays open)
const GRID_STEP         = 3      // base trunk spacing in the band (tiles)
const JITTER            = 1      // +/- tiles of deterministic grid jitter
const BAND_DENSITY_NEAR = 0.7    // keep-probability at band's north edge
const BAND_DENSITY_FAR  = 1.0    // keep-probability at the south map edge
const KEEP_CHANCE       = 0.025  // north-zone keep -- 'few if any': open bog until the forest edge
const SOUTH_EXIT_COLS   = [15, 16, 17, 18, 19]
const EXIT_CLEAR        = { x0: 14, x1: 20, y0: 32 }   // no trunks here (y0..H-1)
const ENTRY_CLEAR_R     = 1      // clearing radius around entries/spawns

// Water GIDs (matches ForestEffects' isWater -- trunks never render on
// water, so wallMask there would be an invisible collider).
const WATER_GIDS = new Set([1625, 1679])

// Full Oryx tree-stamp catalogue (copied from migrate_oryx_trees.mjs).
const TREE_GIDS = new Set([
  260, 261, 262, 263, 264, 265, 269, 270,
  314, 315, 316, 317, 318, 319, 321, 324,
  368, 369, 370, 371, 372, 373, 374, 375, 376,
  422, 423, 424, 425, 426, 427, 428, 429, 430,
  476, 477, 478, 479, 480, 481,
])

// a4 -> a5 etc.
const SOUTH_DEST = { a4: 'a5', b4: 'b5', c4: 'c5', d4: 'd5' }

// Same hash family ForestEffects / migrate_oryx_trees use -- deterministic per cell.
function cellHash(x, y, salt = 0) {
  let h = (x * 374761393 + y * 668265263 + salt * 2654435761) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = (h ^ (h >>> 16)) >>> 0
  return h / 0xffffffff
}

// Gaussian-with-plateau root peaks (copied from migrate_oryx_trees.mjs).
function applyRootPeaks(hm, positions) {
  const vertsH = hm.length
  const vertsW = hm[0]?.length ?? 0
  const sigma = 0.9, amp = 0.75, maxAdd = 1.1, plateau = 0.5
  const reach = Math.ceil((sigma + plateau) * 2.5)
  const add = Array.from({ length: vertsH }, () => new Array(vertsW).fill(0))
  for (const [tx, ty] of positions) {
    const vx0 = Math.max(0, Math.floor(tx - reach)), vx1 = Math.min(vertsW - 1, Math.ceil(tx + reach))
    const vy0 = Math.max(0, Math.floor(ty - reach)), vy1 = Math.min(vertsH - 1, Math.ceil(ty + reach))
    for (let vy = vy0; vy <= vy1; vy++) {
      for (let vx = vx0; vx <= vx1; vx++) {
        const d = Math.sqrt((vx - tx) ** 2 + (vy - ty) ** 2)
        const g = d <= plateau ? 1 : Math.exp(-((d - plateau) ** 2) / (2 * sigma * sigma))
        add[vy][vx] += amp * g
      }
    }
  }
  let mutated = 0
  for (let vy = 0; vy < vertsH; vy++)
    for (let vx = 0; vx < vertsW; vx++)
      if (add[vy][vx] > 0) { hm[vy][vx] = Number((hm[vy][vx] + Math.min(add[vy][vx], maxAdd)).toFixed(4)); mutated++ }
  return mutated
}

// BFS reachability over the final map state -- mirrors PerspectiveScene's
// isColliding() border/wallMask rules (GID walkability ignored: trunk
// placement already avoids water, and pre-existing unwalkable GIDs were
// unwalkable before this script too).
function reachable(map, from, to) {
  const W = map.width, H = map.height
  const mask = map.wallMask
  const border = map.border || {}
  const blocked = (x, y) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return true
    if (mask[y][x] === 1) return true
    const onOuter = x === 0 || x === W - 1 || y === 0 || y === H - 1
    if (onOuter) {
      const open =
        ((x === 0 || x === W - 1) && (border.openRows || []).includes(y)) ||
        ((y === 0 || y === H - 1) && (border.openCols || []).includes(x))
      if (!open) return true
    }
    return false
  }
  const q = [from]
  const seen = new Set([`${from[0]},${from[1]}`])
  while (q.length) {
    const [x, y] = q.shift()
    if (x === to[0] && y === to[1]) return true
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy
      const k = `${nx},${ny}`
      if (seen.has(k) || blocked(nx, ny)) continue
      seen.add(k)
      q.push([nx, ny])
    }
  }
  return false
}

function processMap(name) {
  const dest = SOUTH_DEST[name]
  if (!dest) { console.error(`${name}: not a threshold-row map (expected a4/b4/c4/d4) -- skipping.`); return }

  const path = resolve(MAPS_DIR, `${name}.json`)
  if (!existsSync(path)) { console.error(`Not found: ${path}`); return }
  // Idempotent reruns: if a pre-threshold backup exists, ALWAYS regenerate
  // from that pristine source. Rerunning from the already-processed json
  // would find no tree stamps (north zone would come out empty) and would
  // bake root peaks onto an already-raised heightMap.
  const backupPath = resolve(MAPS_DIR, `${name}.pre-threshold.json`)
  const srcPath = existsSync(backupPath) ? backupPath : path
  if (srcPath === backupPath) console.log(`${name}: regenerating from backup ${name}.pre-threshold.json`)
  const map = JSON.parse(readFileSync(srcPath, 'utf8'))
  const W = map.width, H = map.height

  if (!map.heightMap) { console.error(`${name}: no heightMap -- aborting, nothing written.`); return }

  const layer0 = map.layers?.[0] || []
  const isWater = (x, y) => WATER_GIDS.has(layer0[y]?.[x])

  // Per-map salt so a4-d4 don't all get the identical band layout
  // (cellHash is otherwise purely coordinate-driven).
  const mapSalt = [...name].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)

  // Cells to keep clear: entries, spawns (radius ENTRY_CLEAR_R), exit zone.
  const clear = new Set()
  const markClear = (cx, cy, r) => {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++)
        clear.add(`${x},${y}`)
  }
  for (const e of Object.values(map.entries || {})) {
    if (Number.isInteger(e.x) && Number.isInteger(e.y)) markClear(e.x, e.y, ENTRY_CLEAR_R)
  }
  for (const s of Object.values(map.spawns || {})) {
    if (Number.isInteger(s.x) && Number.isInteger(s.y)) markClear(s.x, s.y, ENTRY_CLEAR_R)
  }
  for (let y = EXIT_CLEAR.y0; y < H; y++)
    for (let x = EXIT_CLEAR.x0; x <= EXIT_CLEAR.x1; x++)
      clear.add(`${x},${y}`)

  const placeable = (x, y) =>
    x > 0 && x < W - 1 && y > 0 && y < H - 1 &&
    !isWater(x, y) && !clear.has(`${x},${y}`)

  // 1. Collect + clear all Oryx tree stamps
  const treeCells = new Set()
  let cleared = 0
  for (const layer of map.layers || []) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (TREE_GIDS.has(layer[y]?.[x])) {
          treeCells.add(`${x},${y}`)
          layer[y][x] = 0
          cleared++
        }
  }

  // 2. North zone: sparse keep of the old stamp cells
  const wallMask = Array.from({ length: H }, () => new Array(W).fill(0))
  let northKept = 0
  for (const key of treeCells) {
    const [x, y] = key.split(',').map(Number)
    if (y >= BAND_START_ROW) continue
    if (!placeable(x, y)) continue
    if (cellHash(x, y) > KEEP_CHANCE) continue
    wallMask[y][x] = 1
    northKept++
  }

  // 3. Band zone: jittered grid, density ramping southward
  let bandPlaced = 0
  for (let gy = BAND_START_ROW; gy < H - 1; gy += GRID_STEP) {
    for (let gx = 1; gx < W - 1; gx += GRID_STEP) {
      const jx = Math.round((cellHash(gx, gy, mapSalt + 1) - 0.5) * 2 * JITTER)
      const jy = Math.round((cellHash(gx, gy, mapSalt + 2) - 0.5) * 2 * JITTER)
      const x = gx + jx, y = gy + jy
      if (y < BAND_START_ROW || !placeable(x, y)) continue
      const depth = (y - BAND_START_ROW) / Math.max(1, (H - 2) - BAND_START_ROW)
      const keepP = BAND_DENSITY_NEAR + (BAND_DENSITY_FAR - BAND_DENSITY_NEAR) * depth
      if (cellHash(x, y, mapSalt + 3) > keepP) continue
      wallMask[y][x] = 1
      bandPlaced++
    }
  }

  map.wallMask = wallMask

  // 4. Root peaks for every trunk cell
  const peaks = []
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (wallMask[y][x] === 1) peaks.push([x + 0.5, y + 1.0])
  const mutated = applyRootPeaks(map.heightMap, peaks)

  // 5.
  map.hasCliffs = true

  // 6. South exit + open border
  map.exits = map.exits || {}
  map.exits.south = {
    tiles: SOUTH_EXIT_COLS.map(c => [c, H - 2]),
    destination: dest,
    entryPoint: 'north',
    beat: 'threshold',
  }
  map.border = map.border || {}
  map.border.openCols = Array.from(new Set([...(map.border.openCols || []), ...SOUTH_EXIT_COLS])).sort((a, b) => a - b)

  // 7. Connectivity check: north entry -> a south exit tile
  const entry = map.entries?.north || map.spawns?.player
  const from = [entry?.x ?? Math.floor(W / 2), entry?.y ?? 4]
  const to = [SOUTH_EXIT_COLS[Math.floor(SOUTH_EXIT_COLS.length / 2)], H - 2]
  if (!reachable(map, from, to)) {
    console.error(`${name}: BFS says south exit is UNREACHABLE from (${from}) -- NOT WRITTEN. Tune band constants.`)
    return
  }

  if (!existsSync(backupPath)) writeFileSync(backupPath, readFileSync(path))
  writeFileSync(path, JSON.stringify(map))

  console.log(`${name}: ${treeCells.size} stamp cells cleared (${cleared} GIDs) | north kept ${northKept} | band placed ${bandPlaced} | ${mutated} heightMap verts raised | south exit -> ${dest} | entry->exit reachable ✓`)

  // ASCII preview: . open, # trunk, ~ water, E exit tile
  const exitTiles = new Set(map.exits.south.tiles.map(([x, y]) => `${x},${y}`))
  for (let y = 0; y < H; y++) {
    let row = ''
    for (let x = 0; x < W; x++) {
      if (exitTiles.has(`${x},${y}`)) row += 'E'
      else if (wallMask[y][x]) row += '#'
      else if (isWater(x, y)) row += '~'
      else row += '.'
    }
    console.log(row)
  }
  console.log('')
}

const args = process.argv.slice(2)
const targets = args.length ? args : ['a4', 'b4', 'c4', 'd4']
for (const name of targets) processMap(name)

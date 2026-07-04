// migrate_oryx_trees.mjs
// One-off migration: replaces dense Oryx tree stamps on old bogMaps with
// a sparse set of cells for ForestEffects' rendered trunks.
//
// Per map:
//   1. Collect every cell (any layer) holding a tree-stamp GID.
//   2. Thin to a sparse subset (KEEP_CHANCE, deterministic hash).
//   3. Clear ALL tree GIDs from all layers (kept + dropped -- sprites go away).
//   4. Write kept cells as wallMask (these maps had NO wallMask; trees
//      were decorative and traversable. New rendered trunks SHOULD block
//      -- this is a deliberate behaviour change).
//   5. Bake root peaks into the EXISTING heightMap at kept cells (same
//      gaussian-with-plateau as the forest generator, same +0.5/+1.0
//      centre offsets matching ForestEffects trunk anchoring).
//   6. Set hasCliffs = true.
// Writes <name>.json in place, saving <name>.pre-migration.json backup.
//
// Scene must then run ForestEffects with trunkKeepChance: 1.0 so every
// wallMask cell gets a trunk -- what you see is exactly what blocks.
//
// Usage:  node tools/map-editor/migrate_oryx_trees.mjs c3
//         (operates on public/maps/bogMaps/<name>.json)

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MAPS_DIR = resolve(__dirname, '../../../public/maps/bogMaps')

const KEEP_CHANCE = 0.12   // fraction of old dense tree cells that become real trunks -- tune per taste

// Full Oryx tree-stamp catalogue: oak, bog, pine, withered, incl. partial/edge tiles.
const TREE_GIDS = new Set([
  260, 261, 262, 263, 264, 265, 269, 270,
  314, 315, 316, 317, 318, 319, 321, 324,
  368, 369, 370, 371, 372, 373, 374, 375, 376,
  422, 423, 424, 425, 426, 427, 428, 429, 430,
  476, 477, 478, 479, 480, 481,
])

// Same hash family ForestEffects/forest gen use -- deterministic per cell.
function cellKeepValue(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = (h ^ (h >>> 16)) >>> 0
  return h / 0xffffffff
}

// Gaussian-with-plateau, constants matching the forest generator /
// ForestEffects ROOT_PEAK_* values.
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

function migrate(name) {
  const path = resolve(MAPS_DIR, `${name}.json`)
  if (!existsSync(path)) { console.error(`Not found: ${path}`); process.exit(1) }
  const map = JSON.parse(readFileSync(path, 'utf8'))
  const W = map.width, H = map.height

  if (!map.heightMap) { console.error(`${name} has no heightMap -- aborting, nothing written.`); process.exit(1) }

  // 1. Collect tree cells across all layers
  const treeCells = []
  for (const layer of map.layers || []) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (TREE_GIDS.has(layer[y]?.[x])) treeCells.push([x, y])
  }
  // De-dup (a cell may hold tree GIDs on multiple layers)
  const seen = new Set()
  const uniqueCells = treeCells.filter(([x, y]) => {
    const k = `${x},${y}`
    if (seen.has(k)) return false
    seen.add(k); return true
  })

  if (uniqueCells.length === 0) {
    console.log(`${name}: no tree GIDs found -- nothing to do.`)
    return
  }

  // 2. Thin
  const kept = uniqueCells.filter(([x, y]) => cellKeepValue(x, y) <= KEEP_CHANCE)

  // 3. Clear all tree GIDs from all layers
  let cleared = 0
  for (const layer of map.layers || []) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (TREE_GIDS.has(layer[y]?.[x])) { layer[y][x] = 0; cleared++ }
  }

  // 4. wallMask from kept cells
  const wallMask = Array.from({ length: H }, () => new Array(W).fill(0))
  for (const [x, y] of kept) wallMask[y][x] = 1
  map.wallMask = wallMask

  // 5. Root peaks at kept cells -- +0.5/+1.0 offsets match ForestEffects
  //    trunk anchoring (see forest_scatter_gen.mjs buildTrunkPositions).
  const peakPositions = kept.map(([x, y]) => [x + 0.5, y + 1.0])
  const mutated = applyRootPeaks(map.heightMap, peakPositions)

  // 6.
  map.hasCliffs = true

  const backup = resolve(MAPS_DIR, `${name}.pre-migration.json`)
  if (!existsSync(backup)) writeFileSync(backup, readFileSync(path))
  writeFileSync(path, JSON.stringify(map))

  console.log(`${name}: ${uniqueCells.length} tree cells found, ${kept.length} kept as trunks (${cleared} GID cells cleared, ${mutated} heightMap vertices raised)`)
  console.log(`Backup: ${backup}`)

  // ASCII preview of kept trunks
  console.log('\n# trunk  . open\n')
  for (let y = 0; y < H; y++) {
    let row = ''
    for (let x = 0; x < W; x++) row += wallMask[y][x] ? '#' : '.'
    console.log(row)
  }
}

migrate(process.argv[2] || 'c3')

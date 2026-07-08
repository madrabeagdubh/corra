// gen_b1c1c2_test.mjs
// Location: tools/map-editor/generators/gen_b1c1c2_test.mjs
//
// ── Purpose ───────────────────────────────────────────────────────────────────
// Proves out THREE changes together, on three real adjacent maps, before
// folding any of them into gen_all_maps.mjs for the full 12-map (a1-d3)
// regeneration:
//
//   1. FULLY OPEN BORDERS -- shared edges between b1-c1 (east/west) and
//      c1-c2 (north/south) span their WHOLE width/height, not a narrow
//      5-tile exit slice. Walking off one map's edge lands on the exact
//      corresponding tile of the neighbour, anywhere along that edge --
//      not just through a "sticking-out bit." Needs xFromSource entry
//      support (perspectiveScene.js applyEntryPosition -- see that file's
//      own changes) alongside the existing yFromSource.
//
//   2. CROSS-MAP FOREST CONTINUITY -- c1 and c2 (both forested) sample ONE
//      shared cluster field (_clusterShared.mjs) instead of independent
//      per-map cluster placement, so a cluster straddling their shared
//      seam continues naturally into the neighbour instead of two
//      unrelated fields coincidentally meeting at the edge.
//
//   3. VILLAGE-TO-RIVER PATH -- continues through all three maps
//      (b0->b1->c1->c2->c3 overall; this script covers the b1->c1->c2
//      leg), now free to wander across the full-width open borders
//      rather than threading a narrow corridor.
//
// b1 stays empty fields (future farmland) -- no clusters, no clutter
// scatter (see strip_ground_clutter.mjs -- GIDs 44/45/48/98/100 are
// deliberately absent project-wide, pending deliberate reintroduction as
// collectibles).
//
// Only the b1-c1 and c1-c2 seams are opened full-width here -- b1's own
// north/south exits and c1/c2's OTHER edges (c1 east to d1, c2 east/west/
// south to d2/b2/c3) are left as narrow placeholder exits, since proving
// the mechanism on the pair that matters is the point of this test, not
// a full 12-map rollout yet.
//
// SAFETY: writes directly to the real public/maps/bogMaps/{b1,c1,c2}.json
// so they're immediately playable, backing up any existing file first
// (once) as <name>.pre-openborder-test.json.
//
// Usage:
//   node tools/map-editor/generators/gen_b1c1c2_test.mjs

import { writeFileSync, readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

import { buildTrunkPositions, applyRootPeaksToHeightMap } from './_treeShared.mjs'
import { buildPathWaypoints, buildPathDistGrid, carvePathCorridor } from './_pathShared.mjs'
import { buildSharedClusterField, sampleLocalWallMask } from './_clusterShared.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../../../public/maps/bogMaps')

// ── Shared constants (match gen_all_maps.mjs exactly, so heightmap slices
// stay seamless with the real, not-yet-regenerated neighbours too) ──────────
const W = 36, H = 36
const MID = 17
const GRID_COLS = 4, GRID_ROWS = 4          // full grid, matches gen_all_maps.mjs
const CLUSTER_GRID_ROWS = 3                  // only a1-d3 (rows 1-3) get clusters; row 4 excluded
const VW = GRID_COLS * W + 1, VH = GRID_ROWS * H + 1
const HEIGHT_AMP = 3
const make2D = (w, h, v = 0) => Array.from({ length: h }, () => new Array(w).fill(v))
const inB    = (x, y) => x >= 0 && x < W && y >= 0 && y < H

function mulberry32(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
}
function seededRng(name) { return mulberry32(name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 2654435761) }

// ── Shared height map (identical algorithm to gen_all_maps.mjs) ─────────────
function buildSharedHeightMap() {
  function cornerHash(gx, gy) {
    let s = (gx * 374761393 + gy * 1103515245) | 0
    s = Math.imul((s ^ (s >>> 16)), 0x45d9f3b)
    s = Math.imul((s ^ (s >>> 16)), 0x45d9f3b)
    return ((s ^ (s >>> 16)) & 0xffff) / 0xffff
  }
  function valueNoise(nx, ny, scale) {
    const gx0 = Math.floor(nx * scale), gy0 = Math.floor(ny * scale)
    const gx1 = gx0 + 1, gy1 = gy0 + 1
    const fx = nx * scale - gx0, fy = ny * scale - gy0
    const sfx = fx * fx * (3 - 2 * fx), sfy = fy * fy * (3 - 2 * fy)
    return (
      cornerHash(gx0, gy0) * (1 - sfx) * (1 - sfy) +
      cornerHash(gx1, gy0) *      sfx  * (1 - sfy) +
      cornerHash(gx0, gy1) * (1 - sfx) *      sfy  +
      cornerHash(gx1, gy1) *      sfx  *      sfy
    )
  }
  const octaves = [
    { scale: 0.040, amp: 1.00 },
    { scale: 0.090, amp: 0.45 },
    { scale: 0.200, amp: 0.20 },
  ]
  const totalAmp = octaves.reduce((s, o) => s + o.amp, 0)
  const raw = new Array(VW * VH)
  for (let vy = 0; vy < VH; vy++) {
    for (let vx = 0; vx < VW; vx++) {
      let v = 0
      for (const { scale, amp } of octaves) v += (valueNoise(vx, vy, scale) * 2 - 1) * amp
      v /= totalAmp
      raw[vy * VW + vx] = +Math.max(0, Math.min(HEIGHT_AMP, v * HEIGHT_AMP)).toFixed(4)
    }
  }
  return raw
}
const SHARED_HM = buildSharedHeightMap()

function sliceHeightMap(gridX, gridY) {
  const ox = gridX * W, oy = gridY * H
  const rows = []
  for (let dy = 0; dy <= H; dy++) {
    const row = []
    for (let dx = 0; dx <= W; dx++) {
      const vx = Math.max(0, Math.min(VW - 1, ox + dx))
      const vy = Math.max(0, Math.min(VH - 1, oy + dy))
      row.push(SHARED_HM[vy * VW + vx])
    }
    rows.push(row)
  }
  return rows
}

// ── Shared cluster field (a1-d3, rows 1-3 only -- row 4 excluded) ──────────
const CLUSTER_CFG = {
  gridCols: GRID_COLS, gridRows: CLUSTER_GRID_ROWS, mapW: W, mapH: H,
  clustersPerMap: 9, clusterMinRadius: 1.5, clusterMaxRadius: 3.0,
  clusterPeakChance: 0.4, strayTreeChance: 0.01,
}
const CLUSTER_SEED_RNG = mulberry32(2654435761 % 0x7fffffff)
const CLUSTER_FIELD = buildSharedClusterField(CLUSTER_CFG, CLUSTER_SEED_RNG)

const GRASS = [839, 840]
function buildGrassBase() {
  return Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (x + y) % 2 === 0 ? GRASS[0] : GRASS[1]))
}

// ── Exit/entry builders ──────────────────────────────────────────────────────
// Narrow (legacy-style) exit -- used for edges NOT part of this test's
// open-border pair (b1's own north/south, c1's east, c2's other sides).
function narrowExitEntry(dir, dest) {
  const HALF = 2
  let tiles, entryX, entryY, entryPoint
  if (dir === 'north') { tiles = [[MID-HALF,1],[MID-1,1],[MID,1],[MID+1,1],[MID+HALF,1]]; entryPoint='south'; entryX=MID; entryY=4 }
  else if (dir === 'south') { tiles = [[MID-HALF,H-2],[MID-1,H-2],[MID,H-2],[MID+1,H-2],[MID+HALF,H-2]]; entryPoint='north'; entryX=MID; entryY=H-4 }
  else if (dir === 'west') { tiles = [[0,MID-HALF],[0,MID-1],[0,MID],[0,MID+1],[0,MID+HALF]]; entryPoint='east'; entryX=4; entryY=MID }
  else { tiles = [[W-2,MID-HALF],[W-2,MID-1],[W-2,MID],[W-2,MID+1],[W-2,MID+HALF]]; entryPoint='west'; entryX=W-4; entryY=MID }
  return {
    exit:  { tiles, destination: dest, entryPoint },
    entry: { x: entryX, y: entryY, yFromSource: (dir === 'east' || dir === 'west') },
  }
}

// FULL-WIDTH open-border exit -- spans the entire edge (minus the two
// literal corner tiles, which stay closed same as any map corner).
// entryX/entryY use xFromSource/yFromSource so a crossing anywhere along
// the edge lands at the corresponding point on the far side, not
// recentred to the middle.
function openExitEntry(dir, dest) {
  let tiles, entryPoint, entry
  if (dir === 'west') {
    tiles = Array.from({ length: H - 2 }, (_, i) => [0, i + 1])
    entryPoint = 'east'
    entry = { x: 4, yFromSource: true }
  } else if (dir === 'east') {
    tiles = Array.from({ length: H - 2 }, (_, i) => [W - 1, i + 1])
    entryPoint = 'west'
    entry = { x: W - 4, yFromSource: true }
  } else if (dir === 'north') {
    tiles = Array.from({ length: W - 2 }, (_, i) => [i + 1, 0])
    entryPoint = 'south'
    entry = { y: 4, xFromSource: true }
  } else {
    tiles = Array.from({ length: W - 2 }, (_, i) => [i + 1, H - 1])
    entryPoint = 'north'
    entry = { y: H - 4, xFromSource: true }
  }
  return { exit: { tiles, destination: dest, entryPoint }, entry }
}

function addBorder(map) {
  const openCols = new Set(), openRows = new Set()
  for (const [dir, ex] of Object.entries(map.exits || {})) {
    for (const [tx, ty] of ex.tiles) {
      if (dir === 'north' || dir === 'south') openCols.add(tx)
      if (dir === 'east'  || dir === 'west')  openRows.add(ty)
    }
  }
  const layer0 = map.layers[0], layer1 = map.layers[1]
  for (let x = 0; x < W; x++) {
    if (!openCols.has(x)) { layer0[0][x] = 0; if (layer1[0]) layer1[0][x] = 0 }
    if (!openCols.has(x)) { layer0[H-1][x] = 0; if (layer1[H-1]) layer1[H-1][x] = 0 }
  }
  for (let y = 0; y < H; y++) {
    if (!openRows.has(y)) { layer0[y][0] = 0; if (layer1[y]) layer1[y][0] = 0 }
    if (!openRows.has(y)) { layer0[y][W-1] = 0; if (layer1[y]) layer1[y][W-1] = 0 }
  }
  map.border = { openCols: [...openCols], openRows: [...openRows] }
  return map
}

function writeMap(map) {
  addBorder(map)
  const outPath = resolve(OUT, `${map.name}.json`)
  const backupPath = resolve(OUT, `${map.name}.pre-openborder-test.json`)
  if (existsSync(outPath) && !existsSync(backupPath)) {
    writeFileSync(backupPath, readFileSync(outPath))
    console.log(`  Backup saved: ${map.name}.pre-openborder-test.json`)
  }
  writeFileSync(outPath, JSON.stringify(map))
  console.log(`  Written: public/maps/bogMaps/${map.name}.json`)
}

function asciiPreview(name, wallMask, distGrid) {
  console.log(`\n${name} ASCII preview  # tree  P path  . open\n`)
  for (let y = 0; y < H; y += 1) {
    let row = ''
    for (let x = 0; x < W; x += 1) {
      row += wallMask[y][x] ? '#' : (distGrid && distGrid[y][x] < 1.5 ? 'P' : '.')
    }
    console.log(row)
  }
}

// ── b1: empty fields, full-width east exit to c1 ────────────────────────────
function generateB1() {
  const name = 'b1'
  const base = buildGrassBase()
  const overlay = make2D(W, H, 0)
  // No wallMask at all -- b1 has no trees (fields/future farmland), so no
  // ForestEffects trunks render here regardless.
  const wallMask = make2D(W, H, 0)

  // Path: enters north-mid (from b0, unchanged/narrow for now), wanders to
  // the FULL-WIDTH east edge, exiting toward c1 at the same row c1's own
  // west entry uses (mid-height), so the path lines up across the seam.
  const waypoints = buildPathWaypoints(MID, 0, W - 1, MID, { wobbleAmp: 3, wobbleFreq: 1.0, samples: 20, seed: 0.4 })
  const distGrid = buildPathDistGrid(waypoints, W, H)
  const pathDist = carvePathCorridor(wallMask, distGrid, W, H, { halfWidth: 3, tintFalloff: 7 })
  // (carvePathCorridor also touches wallMask, harmless here since it's
  // already all-zero -- kept for consistency with c1/c2's pipeline.)

  const north = narrowExitEntry('north', 'b0')
  const south = narrowExitEntry('south', 'b2')
  const east  = openExitEntry('east', 'c1')

  const exits   = { north: north.exit, south: south.exit, east: east.exit }
  const entries = { north: north.entry, south: south.entry, east: east.entry }

  const map = {
    name, width: W, height: H,
    layers: [base, overlay],
    wallMask, heightMap: sliceHeightMap(1, 0), pathDist,
    hasCliffs: true,
    legend: { '839': 'grass', '840': 'grass' },
    spawns: { player: { x: MID, y: H - 6 } },
    exits, entries,
  }
  writeMap(map)
  asciiPreview('b1', wallMask, distGrid)
}

// ── c1: forest via shared cluster field, full-width west (b1) + south (c2) ──
function generateC1() {
  const name = 'c1'
  const wallMask = sampleLocalWallMask(CLUSTER_FIELD, 2, 0, CLUSTER_CFG)

  // Path: enters west-mid (from b1, matching row), wanders to the
  // full-width south edge (toward c2).
  const waypoints = buildPathWaypoints(0, MID, MID, H - 1, { wobbleAmp: 4, wobbleFreq: 1.2, samples: 24, seed: 1.7 })
  const distGrid = buildPathDistGrid(waypoints, W, H)
  const pathDist = carvePathCorridor(wallMask, distGrid, W, H, { halfWidth: 3, tintFalloff: 7 })

  const heightMap = sliceHeightMap(2, 0)
  const trunkPositions = buildTrunkPositions(wallMask, W, H)
  const mutated = applyRootPeaksToHeightMap(heightMap, trunkPositions)
  console.log(`  c1: ${trunkPositions.length} trunk positions, ${mutated} heightMap vertices raised`)

  const base = buildGrassBase()
  const overlay = make2D(W, H, 0)

  const west  = openExitEntry('west', 'b1')
  const south = openExitEntry('south', 'c2')
  const east  = narrowExitEntry('east', 'd1')   // out of scope for this test -- left narrow

  const exits   = { west: west.exit, south: south.exit, east: east.exit }
  const entries = { west: west.entry, south: south.entry, east: east.entry }

  const map = {
    name, width: W, height: H,
    layers: [base, overlay],
    wallMask, heightMap, pathDist,
    hasCliffs: true,
    legend: { '839': 'grass', '840': 'grass' },
    spawns: { player: { x: 4, y: MID } },
    exits, entries,
  }
  writeMap(map)
  asciiPreview('c1', wallMask, distGrid)
}

// ── c2: forest continuing from c1, full-width north (c1) ────────────────────
function generateC2() {
  const name = 'c2'
  const wallMask = sampleLocalWallMask(CLUSTER_FIELD, 2, 1, CLUSTER_CFG)

  // Path: enters north-mid (from c1, matching column), wanders onward
  // toward the south edge (toward c3 -- not generated in this test, but
  // the path still terminates near there for visual continuity later).
  const waypoints = buildPathWaypoints(MID, 0, MID, H - 1, { wobbleAmp: 4, wobbleFreq: 1.3, samples: 24, seed: 2.3 })
  const distGrid = buildPathDistGrid(waypoints, W, H)
  const pathDist = carvePathCorridor(wallMask, distGrid, W, H, { halfWidth: 3, tintFalloff: 7 })

  const heightMap = sliceHeightMap(2, 1)
  const trunkPositions = buildTrunkPositions(wallMask, W, H)
  const mutated = applyRootPeaksToHeightMap(heightMap, trunkPositions)
  console.log(`  c2: ${trunkPositions.length} trunk positions, ${mutated} heightMap vertices raised`)

  const base = buildGrassBase()
  const overlay = make2D(W, H, 0)

  const north = openExitEntry('north', 'c1')
  const west  = narrowExitEntry('west', 'b2')   // out of scope for this test -- left narrow
  const east  = narrowExitEntry('east', 'd2')   // out of scope for this test -- left narrow
  const south = narrowExitEntry('south', 'c3')  // out of scope for this test -- left narrow

  const exits   = { north: north.exit, west: west.exit, east: east.exit, south: south.exit }
  const entries = { north: north.entry, west: west.entry, east: east.entry, south: south.entry }

  const map = {
    name, width: W, height: H,
    layers: [base, overlay],
    wallMask, heightMap, pathDist,
    hasCliffs: true,
    legend: { '839': 'grass', '840': 'grass' },
    spawns: { player: { x: MID, y: 4 } },
    exits, entries,
  }
  writeMap(map)
  asciiPreview('c2', wallMask, distGrid)
}

console.log('Generating b1 / c1 / c2 (open-border + cluster-continuity + path test)...\n')
generateB1()
generateC1()
generateC2()
console.log('\nDone. Check c1\'s east-edge column against d1 is NOT part of this test (d1 untouched).')
console.log('Check c1 south edge (row 35) vs c2 north edge (row 0) for cluster continuity.')

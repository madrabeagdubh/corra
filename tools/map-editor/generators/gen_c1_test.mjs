// gen_c1_test.mjs
// Location: tools/map-editor/generators/gen_c1_test.mjs
//
// ── Purpose ───────────────────────────────────────────────────────────────────
// TEST generator for c1 only -- proves out two changes before they get folded
// into gen_all_maps.mjs's genForestMaze:
//   1. Trees are written DIRECTLY as wallMask + heightMap root-peaks (via
//      _treeShared.mjs), with no GID tree stamps at all -- the old approach
//      (buildTreeLayer in gen_all_maps.mjs) is now fully obsolete; nothing
//      uses Oryx tree stamps anymore.
//   2. A wandering path corridor (via _pathShared.mjs) connects c1's west
//      entry (from b1) to its south exit (toward c2), clearing wallMask
//      along the way and baking a pathDist grid for TintManager's mud-tint
//      blend. Because trunk positions are only sampled from wallMask cells,
//      clearing the corridor BEFORE building trunk positions means the path
//      is automatically free of both trees and root-peak bumps -- "flat and
//      clear" falls out of the ordering, no separate flattening step needed.
//
// Once you've played this in-engine and are happy with tree density/path
// feel, the same approach (steps marked NEW below) should be folded into
// gen_all_maps.mjs's genForestMaze so all forest maps benefit, not just c1.
//
// SAFETY: writes to the REAL public/maps/bogMaps/c1.json (so it's actually
// playable), but backs up the existing file first, same pattern as
// migrate_oryx_trees.mjs -- c1.pre-path-test.json can be restored if this
// doesn't look right.
//
// Usage:
//   node tools/map-editor/generators/gen_c1_test.mjs

import { writeFileSync, readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

import { buildTrunkPositions, applyRootPeaksToHeightMap } from './_treeShared.mjs'
import { buildPathWaypoints, buildPathDistGrid, carvePathCorridor } from './_pathShared.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../../../public/maps/bogMaps')

// ── Shared constants (copied from gen_all_maps.mjs -- must match exactly so
// c1's heightmap slice stays seamless with its neighbours) ───────────────────
const W = 36, H = 36
const MID = 17
const GRID_COLS = 4, GRID_ROWS = 4
const VW = GRID_COLS * W + 1, VH = GRID_ROWS * H + 1
const HEIGHT_AMP = 3
const make2D = (w, h, v = 0) => Array.from({ length: h }, () => new Array(w).fill(v))
const inB    = (x, y) => x >= 0 && x < W && y >= 0 && y < H
const getG   = (g, x, y, dv) => inB(x, y) ? g[y][x] : dv

function mulberry32(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
}
function seededRng(name) { return mulberry32(name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 2654435761) }

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

const GRASS = [839, 840]

function buildGrassBase() {
  return Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (x + y) % 2 === 0 ? GRASS[0] : GRASS[1]))
}

// NOTE: no bush/flower scatter here. strip_ground_clutter.mjs deliberately
// removed GIDs 44/45/48/98/100 across the live maps so flowers/plants could
// be reintroduced later as deliberate collectible objects, not randomised
// decoration tiles. Reintroducing them here would silently undo that.

function buildClusterTreeMask(cfg, rng) {
  const mask = make2D(W, H, false)

  const clusters = Array.from({ length: cfg.clusterCount }, () => ({
    cx: 3 + rng() * (W - 6),
    cy: 3 + rng() * (H - 6),
    radius: cfg.clusterMinRadius + rng() * (cfg.clusterMaxRadius - cfg.clusterMinRadius),
  }))

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let chance = 0
      for (const c of clusters) {
        const d = Math.hypot(x - c.cx, y - c.cy)
        if (d > c.radius) continue
        const t = 1 - d / c.radius
        chance = Math.max(chance, t * cfg.clusterPeakChance)
      }
      if (chance === 0) chance = cfg.strayTreeChance
      if (rng() < chance) mask[y][x] = true
    }
  }

  // Thin solid cluster interiors -- a cell with no open neighbour never
  // surfaces as a rendered trunk anyway (ForestEffects only draws wallMask
  // cells that border open ground), so clearing it here removes dead
  // collision weight without changing what's visible. Net effect: clusters
  // read as a loose ring/clump of individual trees, not a solid mass.
  const isOpen = (x, y) => !inB(x, y) || !mask[y][x]
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mask[y][x]) continue
      const bordersOpen = isOpen(x+1,y) || isOpen(x-1,y) || isOpen(x,y+1) || isOpen(x,y-1)
      if (!bordersOpen) mask[y][x] = false
    }
  }

  return mask.map(row => row.map(v => v ? 1 : 0))
}


function clearCorridor(wallMask, dir, midY, midX, depth, half) {
  for (let d = 0; d < depth; d++) {
    for (let o = -half; o <= half; o++) {
      let x, y
      if (dir === 'west') { x = d; y = midY + o }
      else if (dir === 'east') { x = W - 1 - d; y = midY + o }
      else if (dir === 'north') { x = midX + o; y = d }
      else { x = midX + o; y = H - 1 - d }
      if (inB(x, y)) wallMask[y][x] = false
    }
  }
}

function makeExitEntry(exits_def) {
  const exits = {}, entries = {}
  const HALF = 2
  for (const [dir, dest] of Object.entries(exits_def)) {
    let tiles, entryX, entryY, entryPoint
    if (dir === 'north') { tiles = [[MID-HALF,1],[MID-1,1],[MID,1],[MID+1,1],[MID+HALF,1]]; entryPoint='south'; entryX=MID; entryY=4 }
    else if (dir === 'south') { tiles = [[MID-HALF,H-2],[MID-1,H-2],[MID,H-2],[MID+1,H-2],[MID+HALF,H-2]]; entryPoint='north'; entryX=MID; entryY=H-4 }
    else if (dir === 'west') { tiles = [[0,MID-HALF],[0,MID-1],[0,MID],[0,MID+1],[0,MID+HALF]]; entryPoint='east'; entryX=4; entryY=MID }
    else { tiles = [[W-2,MID-HALF],[W-2,MID-1],[W-2,MID],[W-2,MID+1],[W-2,MID+HALF]]; entryPoint='west'; entryX=W-4; entryY=MID }
    exits[dir] = { tiles, destination: dest, entryPoint }
    entries[dir] = { x: entryX, y: entryY, yFromSource: (dir === 'east' || dir === 'west') }
  }
  return { exits, entries }
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

// ── Generate c1 ───────────────────────────────────────────────────────────────

function generate() {
  const name = 'c1'
  const exits_def = { west: 'b1', east: 'd1', south: 'c2' }
  const rng = seededRng(name)

  // 1. Cluster-based tree placement -- loose clumps with real gaps between
  // them, rather than one connected CA mass. First-guess numbers for a
  // 36x36 walkable map (forest_scatter_gen.mjs's testForest values were
  // tuned for a denser 32x32 canopy-forest feel -- these are pulled well
  // back for readability/performance here). Expect to tune count/radius/
  // peakChance by eye once you've seen it in-engine.
  const cfg = {
    clusterCount:      9,
    clusterMinRadius:  1.5,
    clusterMaxRadius:  3.0,
    clusterPeakChance: 0.4,
    strayTreeChance:   0.01,
  }
  const wallMask = buildClusterTreeMask(cfg, rng)

  // Exit corridors only -- NOT a forced solid perimeter. Edge blocking on
  // non-exit border tiles is already enforced independently by isColliding()
  // via mapData.border (openRows/openCols, built from exits below) -- a
  // solid tree ring around the whole map was redundant for collision and
  // only served to visually wall the player in, which we don't want.
  const DEPTH = 7, HALF = 2
  for (const dir of Object.keys(exits_def)) clearCorridor(wallMask, dir, MID, MID, DEPTH, HALF)

  // 2. NEW -- wandering path corridor: west entry (from b1) to south exit
  // (toward c2). Entry/exit points match the exit tile midpoints above.
  const waypoints = buildPathWaypoints(
    0, MID,      // west entry point
    MID, H - 1,  // south exit point
    { wobbleAmp: 4, wobbleFreq: 1.2, samples: 24, seed: 1.7 }
  )
  const distGrid = buildPathDistGrid(waypoints, W, H)
  const pathDist = carvePathCorridor(wallMask, distGrid, W, H, { halfWidth: 3, tintFalloff: 7 })

  // 3. NEW -- trunk positions + root-peak heightmap bumps, direct from
  // wallMask (path corridor already cleared above, so no trunks/bumps land
  // on the path -- "flat and clear" falls out of doing this after carving).
  const heightMap = sliceHeightMap(2, 0)   // c1's grid position, per gen_all_maps.mjs
  const trunkPositions = buildTrunkPositions(wallMask, W, H)
  const mutated = applyRootPeaksToHeightMap(heightMap, trunkPositions)
  console.log(`c1: ${trunkPositions.length} trunk positions, ${mutated} heightMap vertices raised`)

  // 4. Base + light scatter (bushes/flowers) -- overlay stays otherwise
  // empty; no tree GIDs at all, ForestEffects renders every trunk from
  // wallMask directly.
  const base = buildGrassBase()
  const overlay = make2D(W, H, 0)

  const { exits, entries } = makeExitEntry(exits_def)

  const map = {
    name, width: W, height: H,
    layers: [base, overlay],
    wallMask,
    heightMap,
    pathDist,
    hasCliffs: true,
    legend: { '839': 'grass', '840': 'grass' },
    spawns: { player: { x: W - 4, y: MID } },
    exits, entries,
  }

  addBorder(map)

  const outPath = resolve(OUT, `${name}.json`)
  const backupPath = resolve(OUT, `${name}.pre-path-test.json`)
  if (existsSync(outPath) && !existsSync(backupPath)) {
    writeFileSync(backupPath, readFileSync(outPath))
    console.log(`Backup saved: ${backupPath}`)
  }
  writeFileSync(outPath, JSON.stringify(map))
  console.log(`Written: public/maps/bogMaps/${name}.json`)

  // ASCII preview: # tree, . open, P path centre-ish (dist < 1 tile)
  console.log('\nASCII preview  # tree  P path  . open\n')
  for (let y = 0; y < H; y++) {
    let row = ''
    for (let x = 0; x < W; x++) {
      row += wallMask[y][x] ? '#' : (distGrid[y][x] < 1.5 ? 'P' : '.')
    }
    console.log(row)
  }
}

generate()

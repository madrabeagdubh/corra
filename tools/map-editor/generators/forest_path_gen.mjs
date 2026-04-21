// forest_path_gen.mjs
// 48x48 forest map with winding stream, small pools, oak/pine/bog trees,
// flowers and bushes in clearings.
//
// Usage:
//   node tools/map-editor/generators/forest_path_gen.mjs v001
//
// View at: http://localhost:5173/tools/map-editor/viewer.html?map=v001

import { writeFileSync } from 'fs'
import { createNoise2D } from 'simplex-noise'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = resolve(__dirname, '../../../public/maps/bogMaps')

// ── CONFIG ───────────────────────────────────────────────────────────────────

const CONFIG = {
  width:  48,
  height: 48,

  // Forest density (CA seed)
  initialDensity: 0.48,
  smoothPasses:   3,
  birthThreshold:  5,
  surviveThreshold: 3,

  // Stream
  streamAmplitude: 7,    // how much it wanders north/south
  streamFrequency: 0.12, // how quickly it bends
  streamWidth:     2,    // half-width of stream in tiles
  streamPools:     3,    // number of pools to bulge off the stream

  // Pool size range
  poolMinRadius: 2,
  poolMaxRadius: 4,

  // East-west path corridor (kept clear of trees)
  pathHalfWidth:  2,
  pathFuzz:       2,
  pathAmplitude:  4,
  pathFrequency:  0.15,

  // Exit width
  exitWidth: 5,

  // Exits
  exitWest:  true,
  exitEast:  true,
  exitNorth: false,
  exitSouth: false,

  exitClearDepth: 5,
}

// ── TILE IDS ─────────────────────────────────────────────────────────────────

// Oak stamp
const OAK = { TL:260,TC:261,TR:262,ML:314,MC:315,MR:316,BL:368,BC:369,BR:370 }

// Pine stamp (3x2 -- top row + centre row only, no separate bottom)
// 269=pine TL, 270=pine TC, 323=pine TR (guessed from sequence)
// 324=pine centre -- use as single-tile pine for now
const PINE_SINGLE = 211  // single pine tree sprite

// Bog tree stamp
const BOG = { TL:263,TC:264,TR:265,ML:317,MC:318,MR:319,BL:371,BC:372,BR:373 }

// Water -- blue river tiles
const WATER = [1625, 1679]

// Dithered water edge tiles (placed on LAND cells adjacent to water)
// Describes the 8 positions around a water body from the land side:
//   NW=1463  N=1464  NE=1465
//   W=1517           E=1519
//   SW=1571  S=1572  SE=1573
const EDGE = {
  NW: 1571, N: 1464, NE: 1573,
  W:  1517,           E: 1519,
  SW: 1463, S: 1572, SE: 1465,
}

// Stepping stones (overlay, placed in water where path crosses stream)
const STEPPING = [1735, 1789]

// Forest floor near water
const WATERSIDE = 731

// Ground
const GRASS = [839, 840]

// Vegetation overlay
const BUSHES  = [44, 45, 48]
const FLOWERS = [98, 100]
const PLANTS  = [213, 214, 215, 216]

// ── HELPERS ──────────────────────────────────────────────────────────────────

const make2D   = (w, h, v = false) => Array.from({ length: h }, () => new Array(w).fill(v))
const inBounds = (x, y, W, H)     => x >= 0 && x < W && y >= 0 && y < H
const getF     = (g, x, y, W, H)  => inBounds(x, y, W, H) ? g[y][x] : true  // OOB = tree
const getW     = (g, x, y, W, H)  => inBounds(x, y, W, H) ? g[y][x] : false // OOB = no water
const dist2    = (ax, ay, bx, by)  => (ax-bx)**2 + (ay-by)**2

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// ── STREAM CENTRE ─────────────────────────────────────────────────────────────

function streamCentreAt(x, H, cfg) {
  const mid   = H / 2 + 4  // offset slightly south of centre
  const wave1 = Math.sin(x * cfg.streamFrequency) * cfg.streamAmplitude
  const wave2 = Math.sin(x * cfg.streamFrequency * 1.9 + 0.8) * (cfg.streamAmplitude * 0.35)
  return Math.round(mid + wave1 + wave2)
}

// ── PATH CENTRE ───────────────────────────────────────────────────────────────

function pathCentreAt(x, H, cfg) {
  const mid   = H / 2 - 5  // offset north of stream
  const wave1 = Math.sin(x * cfg.pathFrequency + 0.5) * cfg.pathAmplitude
  const wave2 = Math.sin(x * cfg.pathFrequency * 1.6 + 2.1) * (cfg.pathAmplitude * 0.3)
  return Math.round(mid + wave1 + wave2)
}

// ── BUILD WATER GRID ──────────────────────────────────────────────────────────

function buildWaterGrid(cfg, rng) {
  const { width: W, height: H } = cfg
  const water = make2D(W, H, false)

  // Carve stream -- guaranteed to reach both west and east edges.
  // The sine wave naturally reaches the edges since it runs x=0..W-1,
  // but we clamp the Y and ensure the stream carves all the way to x=0
  // and x=W-1 so river exits are always valid.
  const streamCentres = []
  for (let x = 0; x < W; x++) {
    const cy = Math.max(cfg.streamWidth + 1,
                Math.min(H - cfg.streamWidth - 2,
                  streamCentreAt(x, H, cfg)))
    streamCentres.push(cy)
    // Carve stream width -- slightly wider at edges for clean exit
    const hw = (x < 3 || x > W-4) ? cfg.streamWidth + 1 : cfg.streamWidth
    for (let r = -hw; r <= hw; r++) {
      const y = cy + r
      if (inBounds(x, y, W, H)) water[y][x] = true
    }
  }

  // Bulge pools off the stream
  const poolPositions = []
  for (let p = 0; p < cfg.streamPools; p++) {
    // Pick a random x position along the stream, avoiding edges
    const px = Math.floor(rng() * (W - 16)) + 8
    const py = streamCentres[px] + (rng() > 0.5 ? 1 : -1) * (cfg.streamWidth + 1)
    const radius = cfg.poolMinRadius + Math.floor(rng() * (cfg.poolMaxRadius - cfg.poolMinRadius + 1))
    poolPositions.push({ px, py, radius })

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx*dx + dy*dy <= radius*radius) {
          const wx = px + dx, wy = py + dy
          if (inBounds(wx, wy, W, H)) water[wy][wx] = true
        }
      }
    }
  }

  return { water, streamCentres, poolPositions }
}

// ── BUILD WATER OVERLAY ──────────────────────────────────────────────────────
// Returns an overlay grid with:
//   - Blue water fill tiles on water cells
//   - Dithered edge tiles on land cells adjacent to water
//   - Stepping stones where the path crosses the stream

function buildWaterOverlay(water, pathCentres, streamCentres, W, H, cfg) {
  const overlay = make2D(W, H, 0)

  // Water fill -- base water tiles
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (water[y][x]) overlay[y][x] = (x + y) % 2 === 0 ? WATER[0] : WATER[1]

  // Dithered edge tiles placed ON water cells at the water boundary.
  // These overlay the water fill tile to soften the water edge from inside.
  // We look at each water cell's neighbours -- if a neighbour is land,
  // that side is an edge. The tile describes which side(s) face land.
  // This softens the water from the inside rather than the land side.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!water[y][x]) continue  // only water cells
      const N  = !getW(water, x,   y-1, W, H)  // true = land to north
      const S  = !getW(water, x,   y+1, W, H)  // true = land to south
      const E  = !getW(water, x+1, y,   W, H)  // true = land to east
      const Ww = !getW(water, x-1, y,   W, H)  // true = land to west
      if (!N && !S && !E && !Ww) continue       // deep water, no edge

      // Corners first (two land sides), then cardinal edges.
      // N/S: tile name describes where the dither faces (toward water centre).
      // Land to S + W -> NW corner tile (dither faces NW into water)
      // Land to N -> S tile (dither faces south, water is above)
      if (S && Ww && !N && !E)   { overlay[y][x] = EDGE.NW; continue }
      if (S && E  && !N && !Ww)  { overlay[y][x] = EDGE.NE; continue }
      if (N && Ww && !S && !E)   { overlay[y][x] = EDGE.SW; continue }
      if (N && E  && !S && !Ww)  { overlay[y][x] = EDGE.SE; continue }
      if (S  && !N && !E && !Ww) { overlay[y][x] = EDGE.S;  continue }
      if (N  && !S && !E && !Ww) { overlay[y][x] = EDGE.N;  continue }
      if (E  && !N && !S && !Ww) { overlay[y][x] = EDGE.E;  continue }
      if (Ww && !N && !S && !E)  { overlay[y][x] = EDGE.W;  continue }
      // Multiple edges -- dominant
      if (S) { overlay[y][x] = EDGE.S; continue }
      if (N) { overlay[y][x] = EDGE.N; continue }
      if (E) { overlay[y][x] = EDGE.E; continue }
      if (Ww){ overlay[y][x] = EDGE.W; continue }
    }
  }

  // Stepping stones -- find the single best crossing point (narrowest stream,
  // closest to path) and place stones only there in a 3-tile wide column.
  let bestX = -1, bestScore = Infinity
  for (let x = 2; x < W - 2; x++) {
    const pcy = pathCentres[x]
    const scy = streamCentres[x]
    let waterWidth = 0
    for (let y = 0; y < H; y++) if (water[y][x]) waterWidth++
    const score = Math.abs(pcy - scy) * 2 + waterWidth
    if (score < bestScore) { bestScore = score; bestX = x }
  }
  if (bestX >= 0) {
    // Place sparse zigzag stepping stones through the water at bestX.
    // Walk through the water column, placing a stone every 2 tiles
    // with a slight zigzag offset so they feel hand-placed not mechanical.
    const waterCells = []
    for (let y = 0; y < H; y++)
      if (water[y][bestX]) waterCells.push(y)

    let stoneCount = 0
    for (let i = 0; i < waterCells.length; i += 2) {
      // Zigzag: alternate x by -1, 0, +1
      const xOffset = [0, 1, 0, -1][stoneCount % 4]
      const sx = bestX + xOffset
      const sy = waterCells[i]
      if (inBounds(sx, sy, W, H) && water[sy][sx]) {
        overlay[sy][sx] = stoneCount % 2 === 0 ? STEPPING[0] : STEPPING[1]
      }
      stoneCount++
    }
  }

  return overlay
}

// ── FOREST CA ─────────────────────────────────────────────────────────────────

function seedForest(cfg, water, pathCentres, rng) {
  const { width: W, height: H } = cfg
  const grid = make2D(W, H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (water[y][x]) { grid[y][x] = false; continue }
      // Clear path core
      const dist = Math.abs(y - pathCentres[x])
      if (dist <= cfg.pathHalfWidth) { grid[y][x] = false; continue }
      grid[y][x] = rng() < cfg.initialDensity
    }
  }
  return grid
}

function smoothForest(grid, water, cfg) {
  const { width: W, height: H } = cfg
  const next = make2D(W, H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (water[y][x]) { next[y][x] = false; continue }
      let n = 0
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (!(dx===0&&dy===0) && getF(grid, x+dx, y+dy, W, H)) n++
      next[y][x] = grid[y][x] ? n >= cfg.surviveThreshold : n >= cfg.birthThreshold
    }
  }
  return next
}

// ── PERIMETER + EXIT CARVING ─────────────────────────────────────────────────

function enforcePerimeter(forest, water, cfg) {
  const { width: W, height: H, exitWidth } = cfg
  const half = Math.floor(exitWidth / 2)
  const midY = Math.floor(H / 2)
  const midX = Math.floor(W / 2)

  for (let x = 0; x < W; x++) { forest[0][x] = true; forest[H-1][x] = true }
  for (let y = 0; y < H; y++) { forest[y][0] = true; forest[y][W-1] = true }

  // Punch exits
  if (cfg.exitWest)  for (let dy = -half; dy <= half; dy++) if (inBounds(0, midY+dy, W, H)) forest[midY+dy][0] = false
  if (cfg.exitEast)  for (let dy = -half; dy <= half; dy++) if (inBounds(W-1, midY+dy, W, H)) forest[midY+dy][W-1] = false
  if (cfg.exitNorth) for (let dx = -half; dx <= half; dx++) if (inBounds(midX+dx, 0, W, H)) forest[0][midX+dx] = false
  if (cfg.exitSouth) for (let dx = -half; dx <= half; dx++) if (inBounds(midX+dx, H-1, W, H)) forest[H-1][midX+dx] = false
}

function clearEntryZones(forest, cfg) {
  const { width: W, height: H } = cfg
  const midY = Math.floor(H / 2)
  for (let dy = -4; dy <= 4; dy++) {
    const y = midY + dy
    if (!inBounds(0, y, W, H)) continue
    for (let x = 0; x < cfg.exitClearDepth; x++)       forest[y][x] = false
    for (let x = W-cfg.exitClearDepth; x < W; x++)     forest[y][x] = false
  }
}

// ── TREE TILE PLACEMENT ───────────────────────────────────────────────────────
// Tree type is determined per connected region using flood-fill, so all cells
// in one mass use the same stamp (no hard edges between oak/bog).
// Isolated single trees in open ground can be pine or bog for variety.

function buildTreeTypeMap(forest, W, H, noise2D) {
  // Assign a stamp type to each connected forest region via flood-fill.
  // Large regions: noise decides oak vs bog at region centre.
  // Result: a grid of stamp types (0=oak, 1=bog) per tree cell.
  const typeMap = make2D(W, H, 0)
  const visited = make2D(W, H, false)

  for (let sy = 0; sy < H; sy++) {
    for (let sx = 0; sx < W; sx++) {
      if (!forest[sy][sx] || visited[sy][sx]) continue
      // Flood fill this region
      const stack = [[sx, sy]]
      const region = []
      while (stack.length) {
        const [x, y] = stack.pop()
        if (!inBounds(x, y, W, H) || visited[y][x] || !forest[y][x]) continue
        visited[y][x] = true
        region.push([x, y])
        stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1])
      }
      // Decide type from noise at region centre
      const cx = Math.round(region.reduce((a,[x])=>a+x,0)/region.length)
      const cy = Math.round(region.reduce((a,[,y])=>a+y,0)/region.length)
      // All connected forest masses use oak stamp only.
      // Individual scattered trees in open ground handle bog/pine variety.
      region.forEach(([x, y]) => { typeMap[y][x] = 0 })
    }
  }
  return typeMap
}

function buildTreeOverlay(forest, water, W, H, noise2D) {
  const layer   = make2D(W, H, 0)
  const typeMap = buildTreeTypeMap(forest, W, H, noise2D)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!forest[y][x]) continue

      const N  = getF(forest, x,   y-1, W, H)
      const S  = getF(forest, x,   y+1, W, H)
      const E  = getF(forest, x+1, y,   W, H)
      const Ww = getF(forest, x-1, y,   W, H)
      const isInterior = N && S && E && Ww

      const stamp = typeMap[y][x] === 1 ? BOG : OAK

      // Interior cells -- always use stamp centre tile
      if (isInterior) {
        layer[y][x] = stamp.MC
        continue
      }

      // Edge cells -- use correct stamp border tile
      if (!N && !Ww) { layer[y][x] = stamp.TL; continue }
      if (!N && !E)  { layer[y][x] = stamp.TR; continue }
      if (!S && !Ww) { layer[y][x] = stamp.BL; continue }
      if (!S && !E)  { layer[y][x] = stamp.BR; continue }
      if (!N)        { layer[y][x] = stamp.TC; continue }
      if (!S)        { layer[y][x] = stamp.BC; continue }
      if (!Ww)       { layer[y][x] = stamp.ML; continue }
      if (!E)        { layer[y][x] = stamp.MR; continue }

      layer[y][x] = stamp.MC
    }
  }

  return layer
}

// ── BASE LAYER ────────────────────────────────────────────────────────────────
// Grass base throughout. Tile 731 (forest-green mixed) within 3 tiles of water.
// Water cells use blue water fill as base.

function buildBase(water, W, H) {
  return Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) => {
      if (water[y][x]) return (x+y)%2===0 ? WATER[0] : WATER[1]
      // Within 3 tiles of water -- use 731 (forest waterside grass)
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++)
          if (getW(water, x+dx, y+dy, W, H)) return WATERSIDE
      return (x+y)%2===0 ? GRASS[0] : GRASS[1]
    })
  )
}

// ── VEGETATION SCATTER ────────────────────────────────────────────────────────

function scatterVegetation(overlay, waterOverlay, forest, water, W, H, rng, noise2D) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (forest[y][x]) continue   // skip trees
      if (water[y][x])  continue   // skip water
      if (overlay[y][x]) continue
      if (waterOverlay[y][x]) continue // skip water edge tiles

      const r     = rng()
      const flowerNoise = (noise2D(x * 0.25, y * 0.25) + 1) / 2

      if (r < 0.02) {
        // Lone tree -- pine, single bog tree, or withered tree in open ground
        const t = rng()
        overlay[y][x] = t < 0.33 ? PINE_SINGLE : t < 0.66 ? 208 : 209
      } else if (r < 0.08) {
        // Flowers prefer open areas
        overlay[y][x] = flowerNoise < 0.5
          ? FLOWERS[Math.floor(rng() * FLOWERS.length)]
          : PLANTS[Math.floor(rng() * PLANTS.length)]
      } else if (r < 0.13) {
        overlay[y][x] = BUSHES[Math.floor(rng() * BUSHES.length)]
      }
    }
  }
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

function generate(outputName) {
  const cfg = CONFIG
  const { width: W, height: H } = cfg

  const seedVal = outputName.split('').reduce((a,c) => a + c.charCodeAt(0), 0) * 2654435761
  const rng     = mulberry32(seedVal)
  const noise2D = createNoise2D()

  console.log(`\nGenerating ${W}x${H} forest path map: "${outputName}"`)

  // Build path centres
  const pathCentres = Array.from({ length: W }, (_, x) => pathCentreAt(x, H, cfg))

  // Build water
  const { water, streamCentres } = buildWaterGrid(cfg, rng)

  // Build forest
  let forest = seedForest(cfg, water, pathCentres, rng)
  for (let i = 0; i < cfg.smoothPasses; i++)
    forest = smoothForest(forest, water, cfg)

  // Remove isolated forest cells (0 forest neighbours) -- they look wrong
  // as a single stamp tile with no context.
  for (let y = 1; y < H-1; y++) {
    for (let x = 1; x < W-1; x++) {
      if (!forest[y][x]) continue
      let n = 0
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (!(dx===0&&dy===0) && getF(forest, x+dx, y+dy, W, H)) n++
      if (n < 2) forest[y][x] = false  // too isolated, clear it
    }
  }

  enforcePerimeter(forest, water, cfg)
  clearEntryZones(forest, cfg)

  // Build layers
  const base        = buildBase(water, W, H)
  const waterOverlay = buildWaterOverlay(water, pathCentres, streamCentres, W, H, cfg)
  const treeOverlay  = buildTreeOverlay(forest, water, W, H, noise2D)

  // Merge: water edges + trees into single overlay
  // Priority: trees > water overlay > vegetation
  const overlay = make2D(W, H, 0)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      overlay[y][x] = treeOverlay[y][x] || waterOverlay[y][x]

  // Scatter vegetation into remaining open non-water cells
  scatterVegetation(overlay, waterOverlay, forest, water, W, H, rng, noise2D)

  // ── Detect natural exits ────────────────────────────────────────────────────
  // Scan each active edge for water cells (river exit) or open walkable ground
  // (path exit). Valid exits only where forest is NOT blocking the edge.
  // Stream Y positions at each edge are stored for map chaining.

  function scanEdgeExits(edge) {
    const runs  = []   // contiguous runs of valid (non-tree) edge tiles
    let   run   = null

    const len = edge === 'west' || edge === 'east' ? H : W

    for (let i = 0; i < len; i++) {
      const x = edge === 'west' ? 0 : edge === 'east' ? W-1 : i
      const y = edge === 'north' ? 0 : edge === 'south' ? H-1 : i
      const isTree  = forest[y][x]
      const isWater = water[y][x]
      const isOpen  = !isTree

      if (isOpen) {
        if (!run) run = { start: i, end: i, hasWater: isWater }
        else { run.end = i; if (isWater) run.hasWater = true }
      } else {
        if (run) { runs.push(run); run = null }
      }
    }
    if (run) runs.push(run)
    return runs
  }

  const exits   = {}
  const entries = {}

  // Stream Y at each edge for chaining metadata
  const streamWestY = streamCentres[0]
  const streamEastY = streamCentres[W - 1]

  const edgesToCheck = []
  if (cfg.exitWest)  edgesToCheck.push('west')
  if (cfg.exitEast)  edgesToCheck.push('east')
  if (cfg.exitNorth) edgesToCheck.push('north')
  if (cfg.exitSouth) edgesToCheck.push('south')

  edgesToCheck.forEach(edge => {
    const runs = scanEdgeExits(edge)
    if (!runs.length) return

    // Prefer runs that contain water (river exit), else take widest run
    const waterRun = runs.find(r => r.hasWater)
    const chosen   = waterRun || runs.reduce((a, b) => (b.end - b.start > a.end - a.start) ? b : a)
    const centre   = Math.round((chosen.start + chosen.end) / 2)
    const half     = Math.floor(cfg.exitWidth / 2)

    const exitType = chosen.hasWater ? 'water' : 'ground'

    let tiles, dest, entryPoint, entryX, entryY

    switch (edge) {
      case 'west':
        tiles      = Array.from({length: cfg.exitWidth}, (_, i) => [0, centre - half + i])
        dest       = 'River_West'
        entryPoint = 'east'
        entryX     = cfg.exitClearDepth
        entryY     = centre
        break
      case 'east':
        tiles      = Array.from({length: cfg.exitWidth}, (_, i) => [W-1, centre - half + i])
        dest       = 'River_East'
        entryPoint = 'west'
        entryX     = W - cfg.exitClearDepth
        entryY     = centre
        break
      case 'north':
        tiles      = Array.from({length: cfg.exitWidth}, (_, i) => [centre - half + i, 0])
        dest       = 'Forest_North'
        entryPoint = 'south'
        entryX     = centre
        entryY     = cfg.exitClearDepth
        break
      case 'south':
        tiles      = Array.from({length: cfg.exitWidth}, (_, i) => [centre - half + i, H-1])
        dest       = 'Forest_South'
        entryPoint = 'north'
        entryX     = centre
        entryY     = H - cfg.exitClearDepth
        break
    }

    exits[edge]   = { tiles, destination: dest, entryPoint, exitType }
    entries[edge] = { x: entryX, yFromSource: true, y: entryY }

    console.log(`  Exit ${edge}: ${exitType} at centre ${centre}`)
  })

  // Spawn near east exit entry point, clear of trees
  const spawnY = entries.east?.y ?? entries.west?.y ?? Math.floor(H / 2)
  const spawnX = W - cfg.exitClearDepth

  const map = {
    name: outputName, width: W, height: H,
    layers: [base, overlay],
    // Stream positions at map edges -- used for chaining maps along a river
    streamEdges: {
      west: streamWestY,
      east: streamEastY,
    },
    legend: {
      '839':'plain grass','840':'grass with twigs',
      '731':'forest waterside grass',
      '1625':'blue water 1','1679':'blue water 2',
      '1463':'water edge NW','1464':'water edge N','1465':'water edge NE',
      '1517':'water edge W','1519':'water edge E',
      '1571':'water edge SW','1572':'water edge S','1573':'water edge SE',
      '1735':'stepping stone 1','1789':'stepping stone 2',
      '260':'oak TL','261':'oak TC','262':'oak TR',
      '314':'oak ML','315':'oak MC','316':'oak MR',
      '368':'oak BL','369':'oak BC','370':'oak BR',
      '211':'pine tree','208':'bog tree','209':'withered tree',
      '44':'large bush','45':'medium bush','48':'small bush',
      '98':'scattered flowers','100':'flower',
      '213':'green plants','214':'green plant','215':'brown plants','216':'brown plant',
      '0':'empty overlay'
    },
    spawns: { player: { x: spawnX, y: spawnY } },
    exits,
    entries
  }

  writeFileSync(resolve(OUTPUT_DIR, `${outputName}.json`), JSON.stringify(map))
  console.log(`Written: public/maps/bogMaps/${outputName}.json`)
  console.log(`View at: http://localhost:5173/tools/map-editor/viewer.html?map=${outputName}`)
  console.log(`Stream edges: west y=${streamWestY}  east y=${streamEastY}`)

  // ASCII preview
  const step = 2
  console.log('\nASCII (every 2nd cell)  # tree  ~ water  . open\n')
  for (let y = 0; y < H; y += step) {
    let row = ''
    for (let x = 0; x < W; x += step)
      row += forest[y][x] ? '#' : water[y][x] ? '~' : '.'
    console.log(row)
  }
}

const outputName = process.argv[2] || 'forest_path_default'
generate(outputName)


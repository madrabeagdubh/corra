// forest_maze_gen.mjs
// Generates a 72x72 forest maze map -- cave-style passages through dense oak woodland.
// The forest is the "rock", clearings and passages are the "tunnels".
//
// Usage:
//   node tools/map-editor/generators/forest_maze_gen.mjs v001
//   node tools/map-editor/generators/forest_maze_gen.mjs v002
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
  width:  32,
  height: 32,

  // Initial fill probability -- higher = denser starting forest
  // 0.55 gives a good balance of passages and dead ends
  // CA smoothing passes -- more = smoother, rounder chambers
  // 4-5 gives cave-like feel, 2-3 is more jagged

  // CA rules: a cell becomes/stays forest if it has >= birthThreshold forest neighbours
  // Standard cave values: born=5, survive=4





initialDensity: 0.42,
smoothPasses: 2,
birthThreshold: 6,
surviveThreshold: 3,
  // After CA, flood-fill from centre to find the main connected open region.
  // Any isolated open pockets smaller than this are filled with trees.
  minOpenRegion: 30,

  // Guaranteed exit corridors: how wide (in tiles) the punched exit is
  exitWidth: 5,

  // Which edges get exits. Always includes west and east.
  // Set north/south to true to add those too.
  exitNorth: false,
  exitSouth: false,
  exitWest:  true,
  exitEast:  true,

  // Clear zone depth inward from each exit (so player never spawns into a tree)
  exitClearDepth: 6,
}

// ── TILE IDS ─────────────────────────────────────────────────────────────────

const OAK = {
  TL: 260, TC: 261, TR: 262,
  ML: 314, MC: 315, MR: 316,
  BL: 368, BC: 369, BR: 370,
}
const ROCKS  = [154, 155, 156]
const BUSHES = [44, 48]

// ── HELPERS ──────────────────────────────────────────────────────────────────

const make2D    = (w, h, v = false) => Array.from({ length: h }, () => new Array(w).fill(v))
const inBounds  = (x, y, W, H)     => x >= 0 && x < W && y >= 0 && y < H
const get       = (g, x, y, W, H)  => inBounds(x, y, W, H) ? g[y][x] : true // OOB = tree

// ── SEEDED RNG ────────────────────────────────────────────────────────────────
// Simple mulberry32 -- deterministic per seed so results are reproducible

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// ── PHASE 1: SEED ─────────────────────────────────────────────────────────────

function seedGrid(cfg, rng) {
  const { width: W, height: H } = cfg
  const grid = make2D(W, H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      grid[y][x] = rng() < cfg.initialDensity
  return grid
}

// ── PHASE 2: CA SMOOTHING ─────────────────────────────────────────────────────
// Standard cave CA: count 8-neighbour forest cells.
// Born if >= birthThreshold, survives if >= surviveThreshold.

function smooth(grid, cfg) {
  const { width: W, height: H } = cfg
  const next = make2D(W, H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let n = 0
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (!(dx === 0 && dy === 0) && get(grid, x+dx, y+dy, W, H)) n++
      if (grid[y][x]) {
        next[y][x] = n >= cfg.surviveThreshold
      } else {
        next[y][x] = n >= cfg.birthThreshold
      }
    }
  }
  return next
}

// ── PHASE 3: FLOOD FILL / CONNECTIVITY ───────────────────────────────────────
// Find all connected open regions. Keep only the largest one (main cave).
// Fill all others with trees to prevent isolated pockets.

function floodFill(grid, startX, startY, W, H) {
  const visited = make2D(W, H, false)
  const cells   = []
  const stack   = [[startX, startY]]
  while (stack.length) {
    const [x, y] = stack.pop()
    if (!inBounds(x, y, W, H) || visited[y][x] || grid[y][x]) continue
    visited[y][x] = true
    cells.push([x, y])
    stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1])
  }
  return cells
}

function enforceConnectivity(grid, cfg) {
  const { width: W, height: H } = cfg
  const visited = make2D(W, H, false)
  let largestRegion = []

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y][x] || visited[y][x]) continue
      const region = floodFill(grid, x, y, W, H)
      region.forEach(([rx, ry]) => { visited[ry][rx] = true })
      if (region.length > largestRegion.length) largestRegion = region
    }
  }

  // Fill all open cells not in the largest region
  const mainSet = new Set(largestRegion.map(([x, y]) => `${x},${y}`))
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (!grid[y][x] && !mainSet.has(`${x},${y}`))
        grid[y][x] = true

  return grid
}

// ── PHASE 4: CARVE EXIT CORRIDORS ────────────────────────────────────────────
// Punch guaranteed corridors through to each active edge.
// The corridor connects the map edge to the nearest open cell in the main cave.

function carveExitCorridor(grid, cfg, edge) {
  const { width: W, height: H, exitWidth, exitClearDepth } = cfg
  const half = Math.floor(exitWidth / 2)

  let centreX, centreY, dx, dy

  switch (edge) {
    case 'west':  centreX = 0;     centreY = Math.floor(H/2); dx =  1; dy = 0; break
    case 'east':  centreX = W-1;   centreY = Math.floor(H/2); dx = -1; dy = 0; break
    case 'north': centreX = Math.floor(W/2); centreY = 0;     dx = 0;  dy =  1; break
    case 'south': centreX = Math.floor(W/2); centreY = H-1;   dx = 0;  dy = -1; break
  }

  // Walk inward until we hit open ground or reach exitClearDepth
  let cx = centreX, cy = centreY
  for (let i = 0; i < W; i++) {
    // Clear a strip of exitWidth around the centre line
    for (let offset = -half; offset <= half; offset++) {
      const px = cx + (dy !== 0 ? offset : 0)
      const py = cy + (dx !== 0 ? offset : 0)
      if (inBounds(px, py, W, H)) grid[py][px] = false
    }
    // Stop once we've carved deep enough AND hit open space
    if (i >= exitClearDepth && !grid[cy][cx]) break
    cx += dx
    cy += dy
  }

  return { centreX, centreY }
}

// ── PHASE 5: PERIMETER RULE ───────────────────────────────────────────────────
// Every edge tile is either tree or exit. Never open walkable ground.

function enforcePerimeter(grid, exits, cfg) {
  const { width: W, height: H, exitWidth } = cfg
  const half = Math.floor(exitWidth / 2)

  // Fill entire perimeter
  for (let x = 0; x < W; x++) { grid[0][x] = true; grid[H-1][x] = true }
  for (let y = 0; y < H; y++) { grid[y][0] = true; grid[y][W-1] = true }

  // Re-punch exit holes on the perimeter
  exits.forEach(({ edge, centreX, centreY }) => {
    const half2 = Math.floor(exitWidth / 2)
    switch (edge) {
      case 'west':
        for (let dy = -half2; dy <= half2; dy++) {
          const y = centreY + dy
          if (inBounds(0, y, W, H)) grid[y][0] = false
        }
        break
      case 'east':
        for (let dy = -half2; dy <= half2; dy++) {
          const y = centreY + dy
          if (inBounds(W-1, y, W, H)) grid[y][W-1] = false
        }
        break
      case 'north':
        for (let dx = -half2; dx <= half2; dx++) {
          const x = centreX + dx
          if (inBounds(x, 0, W, H)) grid[0][x] = false
        }
        break
      case 'south':
        for (let dx = -half2; dx <= half2; dx++) {
          const x = centreX + dx
          if (inBounds(x, H-1, W, H)) grid[H-1][x] = false
        }
        break
    }
  })
}

// ── TILE PLACEMENT ────────────────────────────────────────────────────────────

function buildOverlay(forest, W, H) {
  const layer = make2D(W, H, 0)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!forest[y][x]) continue
      const N  = get(forest, x,   y-1, W, H)
      const S  = get(forest, x,   y+1, W, H)
      const E  = get(forest, x+1, y,   W, H)
      const Ww = get(forest, x-1, y,   W, H)
      if (!N && !Ww) { layer[y][x] = OAK.TL; continue }
      if (!N && !E)  { layer[y][x] = OAK.TR; continue }
      if (!S && !Ww) { layer[y][x] = OAK.BL; continue }
      if (!S && !E)  { layer[y][x] = OAK.BR; continue }
      if (!N)        { layer[y][x] = OAK.TC; continue }
      if (!S)        { layer[y][x] = OAK.BC; continue }
      if (!Ww)       { layer[y][x] = OAK.ML; continue }
      if (!E)        { layer[y][x] = OAK.MR; continue }
      layer[y][x] = OAK.MC
    }
  }
  return layer
}

const buildBase = (W, H) =>
  Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) => (x + y) % 2 === 0 ? 839 : 840))

function scatterDetails(overlay, forest, W, H, rng) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (overlay[y][x] || forest[y][x]) continue
      const r = rng()
      if      (r < 0.04) overlay[y][x] = ROCKS[Math.floor(rng() * ROCKS.length)]
      else if (r < 0.09) overlay[y][x] = BUSHES[Math.floor(rng() * BUSHES.length)]
    }
  }
}

// ── BUILD EXIT METADATA ───────────────────────────────────────────────────────

function buildExitMeta(cfg, exitCentres) {
  const { width: W, height: H, exitWidth } = cfg
  const half = Math.floor(exitWidth / 2)
  const exits = {}
  const entries = {}

  exitCentres.forEach(({ edge, centreX, centreY }) => {
    let tiles = [], dest, entryPoint, entryX, entryY

    switch (edge) {
      case 'west':
        tiles = Array.from({ length: exitWidth }, (_, i) => [0, centreY - half + i])
        dest = 'Village'; entryPoint = 'east'
        entryX = 3; entryY = centreY
        exits.west = { tiles, destination: dest, entryPoint }
        entries.west = { x: entryX, yFromSource: true, y: entryY }
        break
      case 'east':
        tiles = Array.from({ length: exitWidth }, (_, i) => [W-1, centreY - half + i])
        dest = 'Bog_Threshold'; entryPoint = 'west'
        entryX = W-3; entryY = centreY
        exits.east = { tiles, destination: dest, entryPoint }
        entries.east = { x: entryX, yFromSource: true, y: entryY }
        break
      case 'north':
        tiles = Array.from({ length: exitWidth }, (_, i) => [centreX - half + i, 0])
        dest = 'Forest_North'; entryPoint = 'south'
        exits.north = { tiles, destination: dest, entryPoint }
        entries.north = { x: centreX, yFromSource: false, y: 3 }
        break
      case 'south':
        tiles = Array.from({ length: exitWidth }, (_, i) => [centreX - half + i, H-1])
        dest = 'Forest_South'; entryPoint = 'north'
        exits.south = { tiles, destination: dest, entryPoint }
        entries.south = { x: centreX, yFromSource: false, y: H-3 }
        break
    }
  })

  return { exits, entries }
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

function generate(outputName) {
  const cfg = CONFIG
  const { width: W, height: H } = cfg

  // Use output name as seed for reproducibility
  const seedVal = outputName.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 2654435761
  const rng = mulberry32(seedVal)

  console.log(`\nGenerating ${W}x${H} forest maze: "${outputName}"`)

  // Phase 1: seed
  let grid = seedGrid(cfg, rng)

  // Phase 2: smooth
  for (let i = 0; i < cfg.smoothPasses; i++) {
    grid = smooth(grid, cfg)
    process.stdout.write(`  CA pass ${i+1}/${cfg.smoothPasses}\r`)
  }
  console.log()

  // Phase 3: connectivity -- keep only largest open region
  grid = enforceConnectivity(grid, cfg)

  // Phase 4: carve exit corridors
  const activeEdges = []
  if (cfg.exitWest)  activeEdges.push('west')
  if (cfg.exitEast)  activeEdges.push('east')
  if (cfg.exitNorth) activeEdges.push('north')
  if (cfg.exitSouth) activeEdges.push('south')

  const exitCentres = activeEdges.map(edge => {
    const centre = carveExitCorridor(grid, cfg, edge)
    return { edge, ...centre }
  })

  // Phase 5: perimeter rule
  enforcePerimeter(grid, exitCentres, cfg)

  // Build layers
  const base    = buildBase(W, H)
  const overlay = buildOverlay(grid, W, H)
  scatterDetails(overlay, grid, W, H, rng)

  // Spawn: place near east exit, clear of trees
  const eastExit  = exitCentres.find(e => e.edge === 'east') || { centreY: Math.floor(H/2) }
  const spawnX    = W - 4
  const spawnY    = eastExit.centreY

  const { exits, entries } = buildExitMeta(cfg, exitCentres)

  const map = {
    name: outputName, width: W, height: H,
    layers: [base, overlay],
    legend: {
      '839':'plain grass','840':'grass with twigs',
      '260':'oak TL','261':'oak TC','262':'oak TR',
      '314':'oak ML','315':'oak MC','316':'oak MR',
      '368':'oak BL','369':'oak BC','370':'oak BR',
      '154':'large grey rock','155':'large grey rock 2','156':'three grey rocks',
      '44':'large green bush','48':'small green bush','0':'empty overlay'
    },
    spawns: { player: { x: spawnX, y: spawnY } },
    exits,
    entries
  }

  const outPath = resolve(OUTPUT_DIR, `${outputName}.json`)
  writeFileSync(outPath, JSON.stringify(map))
  console.log(`Written: ${outPath}`)
  console.log(`View at: http://localhost:5173/tools/map-editor/viewer.html?map=${outputName}`)

  // ASCII preview (scaled down for large maps -- print every other row/col)
  const step = 2
  console.log('\nASCII preview (every 2nd cell)  # tree  . open\n')
  for (let y = 0; y < H; y += step) {
    let row = ''
    for (let x = 0; x < W; x += step)
      row += grid[y][x] ? '#' : '.'
    console.log(row)
  }
}

const outputName = process.argv[2] || 'forest_maze_default'
generate(outputName)


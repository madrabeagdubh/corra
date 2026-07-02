// forest_scatter_gen.mjs
// Open forest test map: loose tree clusters with clearings between them.
// Trees are the only blocking element. Terrain elevation comes ENTIRELY
// from tree-root peaks baked in here at generation time (see
// buildTrunkPositions/applyRootPeaksToHeightMap below) -- NOT from
// standalone authored hills for regular play and NOT from runtime
// heightMap mutation in forestEffects.js (that was tried first and
// didn't actually reach PGR's rendering -- PGR very likely copies/
// converts heightMap into its own internal structure during scene setup,
// before ForestEffects' constructor ever runs).
//
// A separate STANDALONE TEST HILL (CONFIG.testHill) is also baked in --
// large, exaggerated, and ASYMMETRIC (one gentle climbable ramp facing
// spawn, steep drop-only on every other side), with trees force-cleared
// around it. Exists to make the "gradual side is climbable, steep side
// is drop-only" mechanic unambiguous -- a smaller/symmetric test hill
// was too easy to mistake for a rock or a lighting trick. Set
// CONFIG.testHill to null to omit it once slope collision is confirmed
// working and tuned.
//
// Usage:
//   node tools/map-editor/generators/forest_scatter_gen.mjs testForest
//
// Writes to public/maps/forest/<name>.json (testForest.js's getMapPath()
// reads from that folder, not the bogMaps folder other generators use).

import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = resolve(__dirname, '../../../public/maps/forest')

const CONFIG = {
  width: 32,
  height: 32,

  // Cluster placement
  clusterCount: 7,
  clusterMinRadius: 2.5,
  clusterMaxRadius: 4.5,
  clusterPeakChance: 0.5,   // tree chance at a cluster's own centre

  // Sparse stray trees outside clusters, so clearings aren't perfectly bare
  strayTreeChance: 0.02,

  // Spawn stays clear of trees within this radius
  spawnClearRadius: 3,

  // West exit -- reused as-is from the previous hand-placed map
  spawn: { x: 15, y: 13 },
  exitWestTiles: [
    [0, 10], [1, 10], [0, 11], [1, 11], [0, 12], [1, 12], [0, 13], [1, 13],
    [0, 14], [1, 14], [0, 15], [1, 15], [0, 16], [1, 16], [0, 17], [1, 17],
    [0, 18], [1, 18], [0, 19], [1, 19], [0, 20], [1, 20], [0, 21], [1, 21],
  ],

  // Base flat elevation only -- no standalone authored hills for regular
  // play. All contour comes from tree-root peaks (applyRootPeaksToHeightMap
  // below), so the terrain reads as "the roots caused this," not two
  // competing elevation systems.
  baseHeight: 0.15,
  bumps: [],

  // Standalone test hill -- much larger, deliberately exaggerated, with
  // an ASYMMETRIC shape: one gentle ramp (toward spawn, so it's the
  // natural approach) and steep drop-offs on every other side. This is
  // the actual "gradual climbable side + drop-only sides" shape from the
  // SNES-Zelda-tier idea, not just a symmetric bump -- exists to make
  // the effect unambiguous rather than something that could be mistaken
  // for a rock or a lighting trick.
  testHill: {
    cx: 16, cy: 10,
    plateauRadius: 4,      // flat walkable top, big enough to move around on
    steepSigma: 0.9,       // falloff sharpness on the non-ramp sides -- steep
    gentleSigma: 6,        // falloff sharpness along the ramp direction -- gradual
    rampSharpness: 3,      // higher = narrower ramp sector, more clearly "one side"
    amplitude: 3.0,        // total height above base -- deliberately dramatic
    clearRadius: 9,        // trees force-cleared within this radius, so the whole
                             // hill (all sides) is testable independent of tree collision
  },
}

const make2D = (w, h, v = 0) => Array.from({ length: h }, () => new Array(w).fill(v))
const inBounds = (x, y, W, H) => x >= 0 && x < W && y >= 0 && y < H

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// ── Tree scatter: clusters + sparse strays, spawn kept clear ────────────────

function buildTreeMask(cfg, rng) {
  const { width: W, height: H } = cfg
  const mask = make2D(W, H, 0)

  const clusters = Array.from({ length: cfg.clusterCount }, () => ({
    cx: 2 + rng() * (W - 4),
    cy: 2 + rng() * (H - 4),
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

      if (rng() < chance) mask[y][x] = 1
    }
  }

  for (let x = 0; x < W; x++) { mask[0][x] = 1; mask[H - 1][x] = 1 }
  for (let y = 0; y < H; y++) { mask[y][0] = 1; mask[y][W - 1] = 1 }
  for (const [tx, ty] of cfg.exitWestTiles) mask[ty][tx] = 0

  const { x: sx, y: sy } = cfg.spawn
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (Math.hypot(x - sx, y - sy) <= cfg.spawnClearRadius) mask[y][x] = 0

  const isOpen = (x, y) => !inBounds(x, y, W, H) || mask[y][x] === 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (mask[y][x] !== 1) continue
      const bordersOpen = isOpen(x + 1, y) || isOpen(x - 1, y) || isOpen(x, y + 1) || isOpen(x, y - 1)
      if (!bordersOpen) mask[y][x] = 0
    }
  }

  return mask
}

// ── Trunk position replication (MUST mirror ForestEffects._bakeTrunkShapesFromMask) ──
// forestEffects.js only renders a trunk on ~TRUNK_KEEP_CHANCE of wallMask
// cells bordering open ground (a hash-based thinning), not every tree
// cell. Terrain peaks need to land exactly where trunks are actually
// drawn, not everywhere trees exist -- baking peaks in here (generation
// time) rather than at runtime avoids a timing problem: PGR very likely
// converts heightMap into its own internal structure during scene setup,
// before ForestEffects' constructor (where the runtime mutation used to
// happen) ever runs. If ForestEffects' hash function, bordersOpen rule,
// or TRUNK_KEEP_CHANCE ever changes, update this to match, or peaks will
// drift out of sync with visible trunks again.
const TRUNK_KEEP_CHANCE = 0.45

function cellKeepValue(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = (h ^ (h >>> 16)) >>> 0
  return h / 0xffffffff
}

function buildTrunkPositions(mask, W, H) {
  const isWall = (x, y) => inBounds(x, y, W, H) ? mask[y][x] === 1 : true
  const positions = []
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      if (!isWall(tx, ty)) continue
      const bordersOpen =
        !isWall(tx + 1, ty) || !isWall(tx - 1, ty) ||
        !isWall(tx, ty + 1) || !isWall(tx, ty - 1)
      if (!bordersOpen) continue
      if (cellKeepValue(tx, ty) > TRUNK_KEEP_CHANCE) continue
      // +0.5 for X, +1.0 for Y -- matches ForestEffects passing
      // [t.tx, t.ty + 0.5] where t.ty is ALREADY cell+0.5, so the final
      // Y is cell + 0.5 + 0.5 = cell + 1.0.
      positions.push([tx + 0.5, ty + 1.0])
    }
  }
  return positions
}

// Same gaussian-with-plateau math as ForestEffects._raiseGroundPeaksForTrunks
// (now unused there) -- constants below must match that method's
// ROOT_PEAK_* statics if those are ever retuned.
function applyRootPeaksToHeightMap(hm, positions) {
  const vertsH = hm.length
  const vertsW = hm[0]?.length ?? 0
  const sigma   = 0.9    // ROOT_PEAK_RADIUS_TILES
  const amp     = 0.75   // ROOT_PEAK_AMPLITUDE
  const maxAdd  = 1.1    // ROOT_PEAK_MAX_ADD
  const plateau = 0.5    // ROOT_PEAK_PLATEAU_RADIUS_TILES
  const reach = Math.ceil((sigma + plateau) * 2.5)

  const add = Array.from({ length: vertsH }, () => new Array(vertsW).fill(0))
  for (const [tx, ty] of positions) {
    const vx0 = Math.max(0, Math.floor(tx - reach))
    const vx1 = Math.min(vertsW - 1, Math.ceil(tx + reach))
    const vy0 = Math.max(0, Math.floor(ty - reach))
    const vy1 = Math.min(vertsH - 1, Math.ceil(ty + reach))
    for (let vy = vy0; vy <= vy1; vy++) {
      for (let vx = vx0; vx <= vx1; vx++) {
        const d = Math.sqrt((vx - tx) ** 2 + (vy - ty) ** 2)
        const g = d <= plateau ? 1 : Math.exp(-((d - plateau) ** 2) / (2 * sigma * sigma))
        add[vy][vx] += amp * g
      }
    }
  }
  for (let vy = 0; vy < vertsH; vy++)
    for (let vx = 0; vx < vertsW; vx++)
      if (add[vy][vx] > 0) hm[vy][vx] += Math.min(add[vy][vx], maxAdd)
}

// ── Standalone test hill (asymmetric: one gentle ramp, steep elsewhere) ──────
// Falloff sigma varies by direction from the hill's own centre: sides
// aligned with the ramp direction (toward cfg.spawn, so it's the natural
// approach) use gentleSigma; sides facing away use steepSigma. rampSharpness
// narrows how wide that gentle sector is -- without it, roughly half the
// hill's circumference would read as "gentle," diluting the contrast this
// is meant to demonstrate. Applied via Math.max against the existing
// heightMap so it doesn't stack with any nearby tree peak. Also force-
// clears wallMask around it so the whole hill is walkable/testable
// independent of tree collision.
function applyTestHill(heightMap, wallMask, cfg) {
  const th = cfg.testHill
  if (!th) return

  const rampAngle = Math.atan2(cfg.spawn.y - th.cy, cfg.spawn.x - th.cx)

  for (let vy = 0; vy < heightMap.length; vy++) {
    for (let vx = 0; vx < heightMap[0].length; vx++) {
      const dx = vx - th.cx, dy = vy - th.cy
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d === 0) {
        heightMap[vy][vx] = Math.max(heightMap[vy][vx], cfg.baseHeight + th.amplitude)
        continue
      }
      const angle = Math.atan2(dy, dx)
      let angleDiff = angle - rampAngle
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI
      const alignment = (Math.cos(angleDiff) + 1) / 2   // 1 = toward spawn, 0 = away
      const gentleWeight = Math.pow(alignment, th.rampSharpness)
      const sigma = th.steepSigma + (th.gentleSigma - th.steepSigma) * gentleWeight

      const g = d <= th.plateauRadius ? 1 : Math.exp(-((d - th.plateauRadius) ** 2) / (2 * sigma * sigma))
      heightMap[vy][vx] = Math.max(heightMap[vy][vx], cfg.baseHeight + th.amplitude * g)
    }
  }

  for (let y = 0; y < cfg.height; y++)
    for (let x = 0; x < cfg.width; x++)
      if (Math.hypot(x - th.cx, y - th.cy) <= th.clearRadius) wallMask[y][x] = 0
}

// ── Elevation: flat base, peaks added separately ─────────────────────────────
// IMPORTANT: heightMap is a VERTEX grid, not a tile grid -- PGR reads
// heights at tile CORNERS, so a WxH tile map needs a (W+1)x(H+1)
// heightMap.
function buildHeightMap(cfg) {
  const vertsW = cfg.width + 1
  const vertsH = cfg.height + 1
  const hm = make2D(vertsW, vertsH, cfg.baseHeight)
  for (let y = 0; y < vertsH; y++) {
    for (let x = 0; x < vertsW; x++) {
      let h = cfg.baseHeight
      for (const b of cfg.bumps) {
        const d2 = (x - b.cx) ** 2 + (y - b.cy) ** 2
        h += b.amp * Math.exp(-d2 / (2 * b.sigma * b.sigma))
      }
      hm[y][x] = Math.max(0, Number(h.toFixed(4)))
    }
  }
  return hm
}

function buildBase(W, H) {
  return Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) => (x + y) % 2 === 0 ? 839 : 840))
}

// ── Main ──────────────────────────────────────────────────────────────────

function generate(outputName) {
  const cfg = CONFIG
  const seedVal = outputName.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 2654435761
  const rng = mulberry32(seedVal)

  const wallMask = buildTreeMask(cfg, rng)
  const heightMap = buildHeightMap(cfg)

  const trunkPositions = buildTrunkPositions(wallMask, cfg.width, cfg.height)
  applyRootPeaksToHeightMap(heightMap, trunkPositions)
  console.log(`  Baked root-peak terrain for ${trunkPositions.length} trunk positions`)

  applyTestHill(heightMap, wallMask, cfg)
  if (cfg.testHill) console.log(`  Baked asymmetric test hill at (${cfg.testHill.cx}, ${cfg.testHill.cy}), trees cleared within radius ${cfg.testHill.clearRadius}`)

  const base = buildBase(cfg.width, cfg.height)
  const overlay = make2D(cfg.width, cfg.height, 0)

  const map = {
    name: outputName,
    width: cfg.width,
    height: cfg.height,
    hasCliffs: true,   // tells PGR to actually read/apply heightMap for ground undulation
    layers: [base, overlay],
    wallMask,
    heightMap,
    legend: { '839': 'grass', '840': 'grass' },
    spawns: { player: cfg.spawn },
    exits: {
      west: { tiles: cfg.exitWestTiles, destination: 'c2', entryPoint: 'east' },
    },
  }

  writeFileSync(resolve(OUTPUT_DIR, `${outputName}.json`), JSON.stringify(map))
  console.log(`Written: public/maps/forest/${outputName}.json`)

  const step = 1
  console.log('\nASCII preview  # tree  . open\n')
  for (let y = 0; y < cfg.height; y += step) {
    let row = ''
    for (let x = 0; x < cfg.width; x += step) row += wallMask[y][x] ? '#' : '.'
    console.log(row)
  }
}

generate(process.argv[2] || 'testForest')

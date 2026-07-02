// elevation_moat_test_gen.mjs
// (Despite the filename, this version has no water/moat -- see note below.
// Renamed conceptually to a "cliff showcase" map: one large open field
// containing SIX separate elevated plateaus, each with its ramp facing a
// different compass direction, so the drop-down/no-climb-back mechanic
// can be experienced approaching from every angle in a single map.
//
// ── Why no water this time ────────────────────────────────────────────────────
// The previous elevationMoatTest proved PGR renders a real visible cliff
// face when a raised tile borders WATER specifically (not steepness) --
// but water tiles are also hard-blocked in BOTH directions via wallMask,
// same as any water in the game. That's fine for a pure visual test, but
// wrong here: the actual spec is "walkable high area, walkable low area,
// one-way drop between them" -- water would make the low side
// unreachable entirely, defeating the mechanic. So this map uses dry
// slope-collision only (the engine-level isSlopeBlocked rule in
// perspectiveScene.js/player.js, already proven working on testForest's
// tree-driven mesas). Tradeoff: without water, the steep sides render as
// smoothly tilted grass, not a distinct rock face -- combining both the
// visual AND the walkable drop is unsolved and would need PGR's cliff-
// face code to trigger on steepness, not just water adjacency.
//
// ── Layout ──────────────────────────────────────────────────────────────────
// Six plateaus arranged across a large field, each with an explicit ramp
// direction (not all pointing toward spawn) so the player experiences
// the cliff edge from six different real approach angles, not just one
// relative orientation repeated six times.
//
// Usage:
//   node tools/map-editor/generators/elevation_moat_test_gen.mjs cliffShowcase
//
// Writes to public/maps/forest/<name>.json

import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = resolve(__dirname, '../../../public/maps/forest')

const HILL_DEFAULTS = {
  plateauRadius: 3,      // flat walkable top
  steepSigma:    0.8,    // falloff sharpness on the non-ramp sides -- steep, blocks climbing
  gentleSigma:   4.5,    // falloff sharpness along the ramp direction -- gradual, climbable
  rampSharpness: 3,      // higher = narrower ramp sector
  amplitude:     2.4,    // total height above base
}

const CONFIG = {
  width: 56,
  height: 44,
  baseHeight: 0.15,
  lowGid: 840,

  spawn: { x: 6, y: 22 },

  // Six plateaus, spread across the field, each with an EXPLICIT ramp
  // direction (degrees, 0 = east, 90 = south, 180 = west, 270 = north --
  // standard screen/atan2 convention) rather than all computed toward
  // spawn. This is what makes it a genuine multi-angle showcase.
  hills: [
    { cx: 14, cy: 10, rampAngleDeg: 270, ...HILL_DEFAULTS },  // ramp faces north -- approach from south
    { cx: 30, cy: 12, rampAngleDeg: 0,   ...HILL_DEFAULTS },  // ramp faces east  -- approach from west
    { cx: 46, cy: 10, rampAngleDeg: 90,  ...HILL_DEFAULTS },  // ramp faces south -- approach from north
    { cx: 14, cy: 33, rampAngleDeg: 180, ...HILL_DEFAULTS },  // ramp faces west  -- approach from east
    { cx: 30, cy: 34, rampAngleDeg: 45,  ...HILL_DEFAULTS },  // ramp faces southeast
    { cx: 46, cy: 32, rampAngleDeg: 315, ...HILL_DEFAULTS },  // ramp faces northwest
  ],
}

const make2D = (w, h, v = 0) => Array.from({ length: h }, () => new Array(w).fill(v))

function buildHeightMap(cfg) {
  const vertsW = cfg.width + 1
  const vertsH = cfg.height + 1
  const hm = make2D(vertsW, vertsH, cfg.baseHeight)

  for (const h of cfg.hills) {
    const rampAngle = (h.rampAngleDeg * Math.PI) / 180
    for (let vy = 0; vy < vertsH; vy++) {
      for (let vx = 0; vx < vertsW; vx++) {
        const dx = vx - h.cx, dy = vy - h.cy
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d === 0) {
          hm[vy][vx] = Math.max(hm[vy][vx], cfg.baseHeight + h.amplitude)
          continue
        }
        const angle = Math.atan2(dy, dx)
        let diff = angle - rampAngle
        while (diff > Math.PI) diff -= 2 * Math.PI
        while (diff < -Math.PI) diff += 2 * Math.PI
        const alignment = (Math.cos(diff) + 1) / 2   // 1 = toward ramp direction, 0 = away
        const gentleWeight = Math.pow(alignment, h.rampSharpness)
        const sigma = h.steepSigma + (h.gentleSigma - h.steepSigma) * gentleWeight

        const g = d <= h.plateauRadius ? 1 : Math.exp(-((d - h.plateauRadius) ** 2) / (2 * sigma * sigma))
        hm[vy][vx] = Math.max(hm[vy][vx], cfg.baseHeight + h.amplitude * g)
      }
    }
  }
  return hm
}

function buildBase(cfg) {
  return Array.from({ length: cfg.height }, (_, y) =>
    Array.from({ length: cfg.width }, (_, x) => (x + y) % 2 === 0 ? 839 : 840))
}

function buildWallMask(cfg) {
  const { width: W, height: H } = cfg
  const mask = make2D(W, H, 0)
  for (let x = 0; x < W; x++) { mask[0][x] = 1; mask[H - 1][x] = 1 }
  for (let y = 0; y < H; y++) { mask[y][0] = 1; mask[y][W - 1] = 1 }
  return mask
}

function generate(outputName) {
  const cfg = CONFIG
  const heightMap = buildHeightMap(cfg)
  const base = buildBase(cfg)
  const overlay = make2D(cfg.width, cfg.height, 0)
  const wallMask = buildWallMask(cfg)

  const map = {
    name: outputName,
    width: cfg.width,
    height: cfg.height,
    hasCliffs: true,
    layers: [base, overlay],
    wallMask,
    heightMap,
    legend: { [cfg.lowGid]: 'low ground' },
    spawns: { player: cfg.spawn },
    exits: {},
  }

  writeFileSync(resolve(OUTPUT_DIR, `${outputName}.json`), JSON.stringify(map))
  console.log(`Written: public/maps/forest/${outputName}.json`)
  console.log(`Spawn: (${cfg.spawn.x}, ${cfg.spawn.y})\n`)
  cfg.hills.forEach((h, i) => {
    console.log(`  Hill ${i + 1}: centre (${h.cx}, ${h.cy}) -- ramp faces ${h.rampAngleDeg}° (approach from the opposite side)`)
  })

  console.log('\nASCII preview  1-6 hill centres  # blocked  . open\n')
  for (let y = 0; y < cfg.height; y++) {
    let row = ''
    for (let x = 0; x < cfg.width; x++) {
      const hillIdx = cfg.hills.findIndex(h => h.cx === x && h.cy === y)
      row += wallMask[y][x] ? '#' : (hillIdx >= 0 ? String(hillIdx + 1) : '.')
    }
    console.log(row)
  }
}

generate(process.argv[2] || 'cliffShowcase')

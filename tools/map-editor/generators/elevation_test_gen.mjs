// elevation_test_gen.mjs
// Minimal test map for ElevationRenderer's plateau/cliff system + a
// designed collision gate. South half is low ground (solid GID 840),
// north half is a raised plateau (solid GID 839), with ONE ramp gap
// (a few columns wide) where the plateau tile touching low ground is
// ALSO 839 instead of 840 -- this deliberately breaks
// ElevationRenderer's cliff-detection condition (elevatedGids tile
// bordering a cliffSouth tile) at those columns only, so that column
// never gets elevation at all: it stays flat, textured like the
// plateau near the top, and reads as a walkable cut straight through
// the cliff. Everywhere else, a baked wallMask blocks crossing the
// boundary row entirely -- the actual gameplay gate, since
// ElevationRenderer itself is purely visual and has no collision of
// its own.
//
// This is a deliberately blunt first version to let the mechanic be
// FELT (walk up via the ramp, get blocked trying to cross anywhere
// else) before refining shape, asymmetric drop-vs-climb rules, or
// blending this with the tree-driven organic hills from testForest.
//
// Usage:
//   node tools/map-editor/generators/elevation_test_gen.mjs elevationTest
//
// Writes to public/maps/forest/<name>.json

import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = resolve(__dirname, '../../../public/maps/forest')

const CONFIG = {
  width: 24,
  height: 24,

  boundaryRow: 12,      // rows 0..boundaryRow = plateau, boundaryRow+1..height-1 = low ground
  rampStartCol: 10,
  rampWidth: 4,          // columns [rampStartCol, rampStartCol+rampWidth) are the walkable gate

  lowGid:   840,
  highGid:  839,
  cliffFaceGid: 740,     // purely visual, painted by ElevationRenderer at the boundary

  spawn: { x: 12, y: 20 },   // south side, well below the boundary
}

const make2D = (w, h, v = 0) => Array.from({ length: h }, () => new Array(w).fill(v))

function generate(outputName) {
  const cfg = CONFIG
  const { width: W, height: H, boundaryRow, rampStartCol, rampWidth, lowGid, highGid } = cfg

  const layer0 = make2D(W, H, lowGid)
  const wallMask = make2D(W, H, 0)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const isRamp = x >= rampStartCol && x < rampStartCol + rampWidth

      if (y <= boundaryRow) {
        // Plateau area (and one row south of it AT RAMP COLUMNS ONLY --
        // see next block) is textured with highGid.
        layer0[y][x] = highGid
      }

      // The row immediately south of the plateau is the one
      // ElevationRenderer's cliff detection actually reads
      // (elevatedGids tile at boundaryRow bordering a cliffSouth tile
      // at boundaryRow+1). At ramp columns, force that southern tile
      // to ALSO be highGid so the cliffSouth condition never matches
      // there -- this is what makes the ramp columns stay flat
      // (elevation 0) instead of getting the plateau's height.
      if (y === boundaryRow + 1 && isRamp) {
        layer0[y][x] = highGid
      }

      // Collision gate: block the boundary crossing everywhere EXCEPT
      // the ramp columns. This is the actual gameplay mechanism --
      // ElevationRenderer only draws the cliff face, it doesn't block
      // movement on its own.
      if (y === boundaryRow + 1 && !isRamp) {
        wallMask[y][x] = 1
      }
    }
  }

  const map = {
    name: outputName,
    width: W,
    height: H,
    hasCliffs: true,
    elevationConfig: {
      cliffFaceGid: cfg.cliffFaceGid,
      elevatedGids: [cfg.highGid],
      cliffSouth:   [cfg.lowGid],
      cliffHeight:  2.5,
    },
    layers: [layer0, make2D(W, H, 0)],
    wallMask,
    legend: {
      [cfg.lowGid]:  'low ground',
      [cfg.highGid]: 'plateau',
    },
    spawns: { player: cfg.spawn },
    exits: {},
  }

  writeFileSync(resolve(OUTPUT_DIR, `${outputName}.json`), JSON.stringify(map))
  console.log(`Written: public/maps/forest/${outputName}.json`)
  console.log(`Ramp columns: ${cfg.rampStartCol} - ${cfg.rampStartCol + cfg.rampWidth - 1}`)

  console.log('\nASCII preview  # blocked  R ramp  . open\n')
  for (let y = 0; y < H; y++) {
    let row = ''
    for (let x = 0; x < W; x++) {
      const isRamp = x >= cfg.rampStartCol && x < cfg.rampStartCol + cfg.rampWidth
      row += wallMask[y][x] ? '#' : (y === cfg.boundaryRow + 1 && isRamp ? 'R' : '.')
    }
    console.log(row)
  }
}

generate(process.argv[2] || 'elevationTest')

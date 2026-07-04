// strip_ground_clutter.mjs
// Removes flower/bush decoration GIDs (44, 45, 48 bushes; 98, 100
// flowers) from map layers, so flowers/plants/mushrooms can be
// reintroduced later as deliberate, collectible game objects instead of
// randomly mixed decoration tiles.
//
// Purely subtractive -- clears matching cells to 0, no wallMask or
// heightMap changes (these tiles were never blocking). Writes
// <name>.json in place, saving <name>.pre-clutter-strip.json backup
// (only on first run).
//
// Usage:
//   node strip_ground_clutter.mjs a1 a2 a3 a4     (accepts multiple names)
//   (run from tools/map-editor/generators/ -- operates on
//   public/maps/bogMaps/<name>.json)

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MAPS_DIR = resolve(__dirname, '../../../public/maps/bogMaps')

const CLUTTER_GIDS = new Set([44, 45, 48, 98, 100])

function strip(name) {
  const path = resolve(MAPS_DIR, `${name}.json`)
  if (!existsSync(path)) { console.error(`${name}: NOT FOUND at ${path} -- skipped`); return }
  const map = JSON.parse(readFileSync(path, 'utf8'))

  let cleared = 0
  for (const layer of map.layers || []) {
    for (let y = 0; y < layer.length; y++) {
      for (let x = 0; x < layer[y].length; x++) {
        if (CLUTTER_GIDS.has(layer[y][x])) { layer[y][x] = 0; cleared++ }
      }
    }
  }

  if (cleared === 0) {
    console.log(`${name}: no clutter GIDs found -- nothing to do.`)
    return
  }

  const backup = resolve(MAPS_DIR, `${name}.pre-clutter-strip.json`)
  if (!existsSync(backup)) writeFileSync(backup, readFileSync(path))
  writeFileSync(path, JSON.stringify(map))

  console.log(`${name}: cleared ${cleared} clutter cells. Backup: ${backup}`)
}

// Accepts one or more map names -- was previously only reading argv[2]
// and silently ignoring every name after the first, so e.g.
// "node strip_ground_clutter.mjs a2 a3 a4" only ever processed a2.
const names = process.argv.slice(2)
if (names.length === 0) {
  console.error('Usage: node strip_ground_clutter.mjs <mapName> [mapName2] [...]')
  process.exit(1)
}
names.forEach(strip)

// gen_forest_heightmap.mjs
// Location: tools/map-editor/generators/gen_forest_heightmap.mjs (suggested)
//
// ── Purpose ───────────────────────────────────────────────────────────────────
// Generates a standalone heightMap for testForest.json (or any single
// non-grid-shared prototype map) using the SAME multi-octave bilinear
// value-noise technique as gen_all_maps.mjs's buildSharedHeightMap(), but
// with parameters tuned for a small standalone forest-interior map rather
// than copied verbatim from the overworld's 145x145 shared grid.
//
// ── Why parameters differ from gen_all_maps.mjs ──────────────────────────────────
// 1. FREQUENCY: gen_all_maps.mjs's octave scales (0.04/0.09/0.2) were
//    tuned for a 145x145 SHARED grid spanning 4x4 overworld maps. On a
//    standalone 33x33 vertex grid (32x32 tiles), those same absolute
//    scale values mean the lowest-frequency octave barely completes ONE
//    full noise cycle across the entire map -- confirmed visually via a
//    Python prototype: it rendered as one large slow gradient, not
//    rolling hills. Frequencies here are scaled up so multiple complete
//    hill/valley cycles fit across a ~32-tile map.
// 2. BASELINE_SHIFT: the overworld algorithm deliberately clamps negative
//    noise values to 0 with NO baseline shift, so valleys read as flat
//    low ground against hills -- correct for an open vista with real
//    rivers/lowlands. For forest floor underfoot undulation, that
//    produced ~79% of the map sitting at flat zero in testing -- "mostly
//    flat, occasional small mound" rather than "rolling everywhere."
//    BASELINE_SHIFT lifts the distribution before clamping so most of
//    the map has SOME gentle variation, while still allowing some true
//    flat low pockets for variety.
// 3. HEIGHT_AMP: much lower than the overworld's value of 3 -- this is a
//    tight, close-camera interior maze space (TILES_ACROSS: 2.4,
//    CAMERA_ROW_OFFSET: 9.0 in testForest.js's getPGRConfig()), not an
//    open vista. Gentle underfoot rises/dips, not hills blocking
//    sightlines through the maze.
//
// ── Usage ─────────────────────────────────────────────────────────────────────
//   import { generateForestHeightMap } from './gen_forest_heightmap.mjs'
//   const heightMap = generateForestHeightMap(32, 32)
//   // then: map.heightMap = heightMap  (same property PGR already reads)
//   //       (no map.hasCliffs / elevationConfig needed -- heightMap is
//   //       read independently of ElevationRenderer's plateau system,
//   //       confirmed via perspectiveGroundRenderer.js's _vertexH /
//   //       _tileHeightAt / the ground-tile loop's _yTL/_yTR/_yBL/_yBR
//   //       height-offset calculations)

const HEIGHT_AMP      = 0.7    // forest-appropriate: gentle, not dramatic
const BASELINE_SHIFT   = 0.55   // lifts distribution before clamping -- see header comment

const OCTAVES = [
  { scale: 0.12, amp: 1.00 },
  { scale: 0.28, amp: 0.45 },
  { scale: 0.55, amp: 0.20 },
]
const TOTAL_AMP = OCTAVES.reduce((s, o) => s + o.amp, 0)

// Deterministic corner hash -- same algorithm as gen_all_maps.mjs's
// cornerHash, reproduced here since this generator is standalone (no
// shared grid dependency).
function cornerHash(gx, gy) {
  let s = (gx * 374761393 + gy * 1103515245) | 0
  s = Math.imul((s ^ (s >>> 16)), 0x45d9f3b)
  s = Math.imul((s ^ (s >>> 16)), 0x45d9f3b)
  return ((s ^ (s >>> 16)) & 0xffff) / 0xffff
}

// Bilinear value noise at continuous coords (nx, ny) with given frequency
// scale -- identical algorithm to gen_all_maps.mjs's valueNoise.
function valueNoise(nx, ny, scale) {
  const gx0 = Math.floor(nx * scale), gy0 = Math.floor(ny * scale)
  const gx1 = gx0 + 1,               gy1 = gy0 + 1
  const fx  = nx * scale - gx0,      fy  = ny * scale - gy0
  const sfx = fx * fx * (3 - 2 * fx)
  const sfy = fy * fy * (3 - 2 * fy)
  return (
    cornerHash(gx0, gy0) * (1 - sfx) * (1 - sfy) +
    cornerHash(gx1, gy0) *      sfx  * (1 - sfy) +
    cornerHash(gx0, gy1) * (1 - sfx) *      sfy  +
    cornerHash(gx1, gy1) *      sfx  *      sfy
  )
}

/**
 * Generates a heightMap sized (width+1) x (height+1) -- one value per
 * tile CORNER (vertex), matching PGR's _vertexH expectation. Adjacent
 * tiles within this single map share corners naturally (no seams within
 * the map); this generator does NOT attempt seamless edges with any
 * OTHER map, since testForest is a standalone prototype, not part of the
 * 4x4 shared-grid system gen_all_maps.mjs's overworld maps use.
 */
export function generateForestHeightMap(width, height) {
  const vw = width + 1, vh = height + 1
  const heightMap = []

  for (let vy = 0; vy < vh; vy++) {
    const row = []
    for (let vx = 0; vx < vw; vx++) {
      let v = 0
      for (const { scale, amp } of OCTAVES) {
        v += (valueNoise(vx, vy, scale) * 2 - 1) * amp
      }
      v /= TOTAL_AMP   // [-1, 1]

      const vShifted = v + BASELINE_SHIFT
      const h = Math.max(0, Math.min(HEIGHT_AMP, vShifted * HEIGHT_AMP))
      row.push(+h.toFixed(4))
    }
    heightMap.push(row)
  }

  return heightMap
}

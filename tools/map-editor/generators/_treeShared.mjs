// _treeShared.mjs
// Location: tools/map-editor/generators/_treeShared.mjs
//
// ── Purpose ───────────────────────────────────────────────────────────────────
// Single source of truth for the trunk-position/root-peak logic that used to
// be hand-copied in THREE places (forest_scatter_gen.mjs, migrate_oryx_trees.mjs,
// and duplicated again conceptually in ForestEffects._bakeTrunkShapesFromMask).
// Those copies used identical hash functions and gaussian-with-plateau maths,
// with comments warning they'd drift out of sync if one was tuned without the
// others. This module exists so there's exactly one place that knows how a
// wallMask cell becomes a trunk position, and how a trunk position raises the
// heightMap around it.
//
// Any generator or migration script that produces wallMask + heightMap output
// consumed by ForestEffects should import from here rather than re-implement.
//
// NOTE: ForestEffects._bakeTrunkShapesFromMask() (js/game/effects/forestEffects.js)
// still has its OWN copy of the keep-chance hash and border-check logic, because
// it runs client-side at render time and can't import a Node/ESM tools file.
// If TRUNK_KEEP_CHANCE, the hash function, or the bordersOpen rule ever change
// here, ForestEffects' runtime copy must be updated to match, or generated
// root-peak bumps will drift out of alignment with where trunks actually render.

// Deterministic hash, same family used game-wide for per-tile hashed variation
// (tintManager.js, forestEffects.js, forest_scatter_gen.mjs all use this shape).
export function cellKeepValue(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = (h ^ (h >>> 16)) >>> 0
  return h / 0xffffffff
}

// Root-peak gaussian-with-plateau constants. Must match
// ForestEffects.ROOT_PEAK_* values (currently inlined at render time there,
// since terrain peaks are baked in at generation time, not mutated at runtime --
// see forest_scatter_gen.mjs header note on why runtime mutation doesn't work).
export const ROOT_PEAK_SIGMA   = 0.9
export const ROOT_PEAK_AMP     = 0.75
export const ROOT_PEAK_MAX_ADD = 1.1
export const ROOT_PEAK_PLATEAU = 0.5

const DEFAULT_TRUNK_KEEP_CHANCE = 0.45  // matches ForestEffects.TRUNK_KEEP_CHANCE default

/**
 * Given a wallMask (H x W, 1 = tree cell) return trunk anchor positions in
 * VERTEX space (matches ForestEffects' [tx+0.5, ty+1.0] anchoring for
 * generation-time baking -- ForestEffects itself uses ty+0.5 at render time
 * since it works from tile-space directly; the +1.0 here accounts for
 * generation-time positions being pre-offset the same way
 * migrate_oryx_trees.mjs's kept cells were).
 *
 * Only wallMask cells that border at least one open (non-wall) cell are
 * considered -- interior-of-mass cells never surface a trunk, keeping trunk
 * density from scaling with mass size. Thinned further by keepChance so not
 * every bordering cell becomes a trunk.
 *
 * @param {number[][]} wallMask
 * @param {number} W
 * @param {number} H
 * @param {object} [opts]
 * @param {number} [opts.keepChance] -- defaults to ForestEffects' own default
 * @param {(x:number,y:number)=>boolean} [opts.isWater] -- optional water exclusion
 * @returns {[number,number][]} array of [tx, ty] vertex-space anchor positions
 */
export function buildTrunkPositions(wallMask, W, H, opts = {}) {
  const keepChance = opts.keepChance ?? DEFAULT_TRUNK_KEEP_CHANCE
  const isWater    = opts.isWater ?? (() => false)
  const isWall     = (x, y) => (x >= 0 && x < W && y >= 0 && y < H) ? wallMask[y][x] === 1 : true

  const positions = []
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      if (!isWall(tx, ty)) continue
      if (isWater(tx, ty)) continue
      const bordersOpen =
        !isWall(tx + 1, ty) || !isWall(tx - 1, ty) ||
        !isWall(tx, ty + 1) || !isWall(tx, ty - 1)
      if (!bordersOpen) continue
      if (cellKeepValue(tx, ty) > keepChance) continue
      positions.push([tx + 0.5, ty + 1.0])
    }
  }
  return positions
}

/**
 * Mutates heightMap (a (W+1) x (H+1) vertex grid) in place, raising vertices
 * near each trunk position with a gaussian-with-plateau bump -- flat top near
 * the trunk (plateau radius), falling off smoothly beyond it (sigma). Additive
 * across overlapping trunks, capped per-vertex at ROOT_PEAK_MAX_ADD so dense
 * clusters don't spike unrealistically.
 *
 * @param {number[][]} heightMap -- mutated in place
 * @param {[number,number][]} positions -- vertex-space [tx, ty] pairs
 * @returns {number} count of vertices actually raised (for logging)
 */
export function applyRootPeaksToHeightMap(heightMap, positions) {
  const vertsH = heightMap.length
  const vertsW = heightMap[0]?.length ?? 0
  const sigma   = ROOT_PEAK_SIGMA
  const amp     = ROOT_PEAK_AMP
  const maxAdd  = ROOT_PEAK_MAX_ADD
  const plateau = ROOT_PEAK_PLATEAU
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

  let mutated = 0
  for (let vy = 0; vy < vertsH; vy++) {
    for (let vx = 0; vx < vertsW; vx++) {
      if (add[vy][vx] > 0) {
        heightMap[vy][vx] = Number((heightMap[vy][vx] + Math.min(add[vy][vx], maxAdd)).toFixed(4))
        mutated++
      }
    }
  }
  return mutated
}

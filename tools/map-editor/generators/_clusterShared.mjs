// _clusterShared.mjs
// Location: tools/map-editor/generators/_clusterShared.mjs
//
// ── Purpose ───────────────────────────────────────────────────────────────────
// Cross-map tree-cluster continuity, using the SAME pattern gen_all_maps.mjs
// already proved for elevation: buildSharedHeightMap() generates one
// continuous noise field across the whole grid, and each map slices its own
// window out of it -- which is why elevation already lines up seamlessly at
// every seam. This module does the equivalent for tree clusters: generate
// ONE set of cluster centres in GLOBAL tile coordinates across the forest
// region, then each map samples whichever clusters overlap its own window.
// A cluster near a seam naturally straddles it and continues into the
// neighbouring map, instead of two independent per-map cluster fields
// coincidentally meeting (or not) at the edge.
//
// Scope (as agreed): applies to the 7 non-river, non-fields forest maps in
// the a1-d3 12-map region -- a1, c1, d1, a2, b2, c2, d2. b1 stays untouched
// (fields/future farmland, no clusters). The river row (a3-d3) keeps its
// own water-avoiding forestCA for now -- blending a global cluster field
// with per-map water placement is a separate problem, not solved here.
//
// ── Usage ─────────────────────────────────────────────────────────────────────
//   import { buildSharedClusterField, sampleLocalWallMask } from './_clusterShared.mjs'
//   const field = buildSharedClusterField({ ... })          // once, module-level
//   const wallMask = sampleLocalWallMask(field, gridX, gridY, cfg, rng)  // per map

const make2D = (w, h, v = 0) => Array.from({ length: h }, () => new Array(w).fill(v))

// Deterministic hash of a GLOBAL tile coordinate -- same family used
// elsewhere in this codebase (tintManager.js, forestEffects.js,
// _treeShared.mjs) for per-tile hashed variation. Using a coordinate-keyed
// hash here (rather than a sequential rng() draw) is what actually
// guarantees seam agreement: any map -- or the padding ring sampled by a
// NEIGHBOURING map -- evaluating the same global (gx,gy) gets the
// IDENTICAL tree/no-tree result, since the result depends only on the
// coordinate, not on which map's rng sequence happened to reach it first.
function _globalCellHash(gx, gy) {
  let h = (gx * 374761393 + gy * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = (h ^ (h >>> 16)) >>> 0
  return h / 0xffffffff
}

/**
 * Build one continuous set of cluster centres in GLOBAL tile coordinates,
 * covering gridCols x gridRows maps of mapW x mapH tiles each.
 *
 * @param {object} cfg
 * @param {number} cfg.gridCols
 * @param {number} cfg.gridRows
 * @param {number} cfg.mapW
 * @param {number} cfg.mapH
 * @param {number} cfg.clustersPerMap   -- average cluster count per single
 *                                          map's worth of area (clusters
 *                                          are placed across the FULL
 *                                          global area, scaled up from
 *                                          this so density-per-map stays
 *                                          comparable to the old
 *                                          per-map-only version)
 * @param {number} cfg.clusterMinRadius
 * @param {number} cfg.clusterMaxRadius
 * @param {() => number} rng            -- shared seeded RNG (deterministic
 *                                          across the whole grid, NOT
 *                                          per-map, or continuity breaks)
 * @returns {{ clusters: {cx:number, cy:number, radius:number}[] }}
 */
export function buildSharedClusterField(cfg, rng) {
  const totalMapsArea = cfg.gridCols * cfg.gridRows
  const totalClusters = Math.round(cfg.clustersPerMap * totalMapsArea)

  const globalW = cfg.gridCols * cfg.mapW
  const globalH = cfg.gridRows * cfg.mapH

  const clusters = []
  for (let i = 0; i < totalClusters; i++) {
    clusters.push({
      cx: 3 + rng() * (globalW - 6),
      cy: 3 + rng() * (globalH - 6),
      radius: cfg.clusterMinRadius + rng() * (cfg.clusterMaxRadius - cfg.clusterMinRadius),
    })
  }
  return { clusters }
}

/**
 * Sample the shared cluster field for ONE map's local wallMask.
 *
 * @param {{clusters: object[]}} field   -- from buildSharedClusterField()
 * @param {number} gridX                 -- 0=a 1=b 2=c 3=d
 * @param {number} gridY                 -- 0=row1 1=row2 2=row3
 * @param {object} cfg
 * @param {number} cfg.mapW
 * @param {number} cfg.mapH
 * @param {number} cfg.clusterPeakChance
 * @param {number} cfg.strayTreeChance
 * @returns {number[][]} local wallMask, mapH x mapW, values 0/1
 */
export function sampleLocalWallMask(field, gridX, gridY, cfg) {
  const { mapW: W, mapH: H } = cfg
  const offsetX = gridX * W
  const offsetY = gridY * H

  // IMPORTANT: sample a 1-tile PADDED border around the local window
  // before thinning. The "borders open" check below needs each edge
  // cell's TRUE neighbour state -- if it only looked within this map's
  // own W x H window, every edge cell would see "out of bounds" and be
  // treated as bordering open ground, incorrectly thinning it even when
  // a forest mass genuinely continues into the next map. That would
  // hollow out every map's edge and reintroduce exactly the seam break
  // this module exists to prevent. Sampling one extra ring from the SAME
  // global field (rather than treating it as "no data") avoids that.
  const PAD = 1
  const paddedW = W + PAD * 2
  const paddedH = H + PAD * 2
  const padded = make2D(paddedW, paddedH, false)

  for (let py = 0; py < paddedH; py++) {
    for (let px = 0; px < paddedW; px++) {
      const gx = offsetX + (px - PAD)
      const gy = offsetY + (py - PAD)

      let chance = 0
      for (const c of field.clusters) {
        const dx = gx - c.cx, dy = gy - c.cy
        if (Math.abs(dx) > c.radius || Math.abs(dy) > c.radius) continue
        const d = Math.hypot(dx, dy)
        if (d > c.radius) continue
        const t = 1 - d / c.radius
        chance = Math.max(chance, t * cfg.clusterPeakChance)
      }
      if (chance === 0) chance = cfg.strayTreeChance

      if (_globalCellHash(gx, gy) < chance) padded[py][px] = true
    }
  }

  // Thin solid cluster interiors using TRUE neighbour state from the
  // padded array -- same rationale as the single-map version
  // (gen_c1_test.mjs): a cell with no open neighbour never surfaces as a
  // rendered trunk anyway (ForestEffects only draws wallMask cells that
  // border open ground), so clearing it here removes dead collision
  // weight without changing what's visible.
  const isOpenPadded = (px, py) =>
    px < 0 || px >= paddedW || py < 0 || py >= paddedH || !padded[py][px]
  const thinned = make2D(paddedW, paddedH, false)
  for (let py = 0; py < paddedH; py++) {
    for (let px = 0; px < paddedW; px++) {
      if (!padded[py][px]) continue
      const bordersOpen = isOpenPadded(px+1,py) || isOpenPadded(px-1,py) ||
                           isOpenPadded(px,py+1) || isOpenPadded(px,py-1)
      thinned[py][px] = bordersOpen   // KEEP cells that border open ground (cluster edges); clear solid interior
    }
  }

  // Crop back to the local W x H window (drop the padding ring).
  const mask = make2D(W, H, 0)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      mask[y][x] = thinned[y + PAD][x + PAD] ? 1 : 0
    }
  }
  return mask
}

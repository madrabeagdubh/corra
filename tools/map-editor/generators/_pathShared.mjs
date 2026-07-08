// _pathShared.mjs
// Location: tools/map-editor/generators/_pathShared.mjs
//
// ── Purpose ───────────────────────────────────────────────────────────────────
// Generates a wandering "suggested route" corridor between two points on a
// map (typically an entry edge midpoint and an exit edge midpoint), used to:
//   1. Clear wallMask along the corridor (no trees on the path)
//   2. Provide a per-tile pathDist value for TintManager's mud-tint blend
//
// Deliberately more general than forest_path_gen.mjs's original approach
// (a single sine wave wandering north-south while running strictly west to
// east) -- that shape only works when a path enters and exits on OPPOSITE
// edges of the same map. The village->river route turns partway (e.g. c1
// enters from the west but must exit south toward c2, not continue east),
// so this builds a wandering polyline between two arbitrary points instead:
// a straight reference line with perpendicular sine wobble, sampled into
// waypoints, then a nearest-segment distance check per tile.
//
// No new tiles: the path is expressed purely as tree-clearance + a distance
// field for tinting, not as a tile ID choice. See TintManager.getGroundTint's
// existing height/slope blending for the analogous mechanism this borrows.

const make2D = (w, h, v = 0) => Array.from({ length: h }, () => new Array(w).fill(v))

/**
 * Build a wandering polyline of waypoints from (x0,y0) to (x1,y1).
 *
 * @param {number} x0,y0  start point (tile coords)
 * @param {number} x1,y1  end point (tile coords)
 * @param {object} [opts]
 * @param {number} [opts.wobbleAmp]   max perpendicular offset, in tiles
 * @param {number} [opts.wobbleFreq]  how many wobble cycles along the route
 * @param {number} [opts.samples]     waypoint count (more = smoother distance checks)
 * @param {number} [opts.seed]        deterministic phase offset
 * @returns {[number,number][]} waypoints along the path
 */
export function buildPathWaypoints(x0, y0, x1, y1, opts = {}) {
  const wobbleAmp  = opts.wobbleAmp  ?? 4
  const wobbleFreq = opts.wobbleFreq ?? 1.5
  const samples    = opts.samples    ?? 24
  const seed       = opts.seed       ?? 0

  const dx = x1 - x0, dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  // Perpendicular unit vector to the straight reference line
  const px = -dy / len, py = dx / len

  const waypoints = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const baseX = x0 + dx * t
    const baseY = y0 + dy * t
    // Wobble tapers to zero at both ends so the path meets the entry/exit
    // points cleanly rather than wandering off the map edge.
    const taper = Math.sin(t * Math.PI)  // 0 at t=0 and t=1, 1 at t=0.5
    const wobble = Math.sin(t * wobbleFreq * Math.PI * 2 + seed) * wobbleAmp * taper
    waypoints.push([baseX + px * wobble, baseY + py * wobble])
  }
  return waypoints
}

// Shortest distance from point (x,y) to segment (ax,ay)-(bx,by)
function pointToSegmentDist(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-9) return Math.hypot(x - ax, y - ay)
  let t = ((x - ax) * dx + (y - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const projX = ax + dx * t, projY = ay + dy * t
  return Math.hypot(x - projX, y - projY)
}

/**
 * Given waypoints, compute a per-tile distance-to-path grid (in tiles).
 * Cheap for typical 36x36 maps -- checks every tile against every segment.
 *
 * @param {[number,number][]} waypoints
 * @param {number} W, H
 * @returns {number[][]} distGrid[y][x] = distance in tiles to nearest path segment
 */
export function buildPathDistGrid(waypoints, W, H) {
  const grid = make2D(W, H, Infinity)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cx = x + 0.5, cy = y + 0.5
      let best = Infinity
      for (let i = 0; i < waypoints.length - 1; i++) {
        const [ax, ay] = waypoints[i]
        const [bx, by] = waypoints[i + 1]
        const d = pointToSegmentDist(cx, cy, ax, ay, bx, by)
        if (d < best) best = d
      }
      grid[y][x] = best
    }
  }
  return grid
}

/**
 * Clear wallMask cells within halfWidth tiles of the path (in place) and
 * return a normalised pathDist grid (0 = path centre, 1 = at/beyond
 * clearWidth*2, for tint blending -- see TintManager).
 *
 * @param {number[][]} wallMask -- mutated in place
 * @param {number[][]} distGrid -- from buildPathDistGrid
 * @param {number} W, H
 * @param {object} [opts]
 * @param {number} [opts.halfWidth]     tiles cleared of trees each side of centre
 * @param {number} [opts.tintFalloff]   distance (tiles) beyond halfWidth where tint fades to 0
 * @returns {number[][]} normalised pathDist grid, 0..1
 */
export function carvePathCorridor(wallMask, distGrid, W, H, opts = {}) {
  const halfWidth   = opts.halfWidth   ?? 3
  const tintFalloff = opts.tintFalloff ?? halfWidth * 2

  const pathDist = make2D(W, H, 1)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = distGrid[y][x]
      if (d <= halfWidth) wallMask[y][x] = 0
      const t = Math.max(0, Math.min(1, d / tintFalloff))
      pathDist[y][x] = t
    }
  }
  return pathDist
}

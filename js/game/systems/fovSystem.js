// FovSystem.js
//
// Recursive shadowcasting field-of-view.
// Produces a Set of visible tile keys ("x,y") each turn.
// Maintains a persistent visited Set across moves.
//
// Usage:
//   const fov = new FovSystem(walkabilityGrid, { radius: 8 })
//   fov.compute(playerTileX, playerTileY)
//   fov.isVisible(tx, ty)   // currently lit
//   fov.isVisited(tx, ty)   // seen at some point

export default class FovSystem {

  // ── Tunable constants ─────────────────────────────────────────────────────
  static FOV_RADIUS = 5   // tiles the player can see in any direction

  constructor(walkGrid, config = {}) {
    // walkGrid[y][x] = true if passable / transparent
    this._grid   = walkGrid
    this._height = walkGrid.length
    this._width  = walkGrid[0]?.length ?? 0
    this._radius = config.radius ?? FovSystem.FOV_RADIUS

    // Currently visible tile keys
    this._visible = new Set()
    // All tiles ever seen
    this._visited = new Set()
  }

  // ── Public API ────────────────────────────────────────────────────────────

  isVisible(tx, ty) { return this._visible.has(`${tx},${ty}`) }
  isVisited(tx, ty) { return this._visited.has(`${tx},${ty}`) }
  isHidden(tx, ty)  { return !this._visited.has(`${tx},${ty}`) }

  get visibleSet() { return this._visible }
  get visitedSet() { return this._visited }

  // Recompute FOV from (originX, originY).
  // Call this every time the player moves.
  compute(originX, originY) {
    this._visible.clear()

    // Origin tile is always visible
    this._markVisible(originX, originY)

    // Eight octants
    for (let octant = 0; octant < 8; octant++) {
      this._castLight(originX, originY, 1, 1.0, 0.0, this._radius,
        OCTANT_TRANSFORMS[octant])
    }
  }

  // ── Shadowcasting ─────────────────────────────────────────────────────────
  //
  // Classic recursive shadowcasting by Björn Bergström.
  // Each octant is a transform of the (+x, +y) quadrant.

  _castLight(cx, cy, row, startSlope, endSlope, radius, transform) {
    if (startSlope < endSlope) return

    let nextStartSlope = startSlope

    for (let i = row; i <= radius; i++) {
      let blocked = false

      for (let dx = -i, dy = -i; dx <= 0; dx++) {
        // Map local (dx, dy) to world coords via octant transform
        const lSlope = (dx - 0.5) / (dy + 0.5)
        const rSlope = (dx + 0.5) / (dy - 0.5)

        if (startSlope < rSlope) continue
        if (endSlope > lSlope)  break

        const wx = cx + dx * transform.xx + dy * transform.xy
        const wy = cy + dx * transform.yx + dy * transform.yy

        if (this._inBounds(wx, wy)) {
          const r2 = dx * dx + dy * dy
          if (r2 <= radius * radius) {
            this._markVisible(wx, wy)
          }
        }

        if (blocked) {
          if (!this._isTransparent(wx, wy)) {
            nextStartSlope = rSlope
            continue
          } else {
            blocked = false
            startSlope = nextStartSlope
          }
        } else if (!this._isTransparent(wx, wy) && i < radius) {
          blocked = true
          this._castLight(cx, cy, i + 1, startSlope, lSlope, radius, transform)
          nextStartSlope = rSlope
        }
      }

      if (blocked) break
    }
  }

  _markVisible(tx, ty) {
    const key = `${tx},${ty}`
    this._visible.add(key)
    this._visited.add(key)
  }

  _isTransparent(tx, ty) {
    if (!this._inBounds(tx, ty)) return false
    return !!this._grid[ty]?.[tx]
  }

  _inBounds(tx, ty) {
    return tx >= 0 && tx < this._width && ty >= 0 && ty < this._height
  }

  // Rebuild walkability grid (call if map changes)
  updateGrid(walkGrid) {
    this._grid   = walkGrid
    this._height = walkGrid.length
    this._width  = walkGrid[0]?.length ?? 0
  }

  // Reset all fog (new map/game)
  reset() {
    this._visible.clear()
    this._visited.clear()
  }
}

// ── Octant transform table ────────────────────────────────────────────────────
// Maps the 8 octants onto the single (+x, +y) quadrant algorithm.
// Each entry is a 2×2 rotation/reflection matrix: {xx, xy, yx, yy}

const OCTANT_TRANSFORMS = [
  { xx:  1, xy:  0, yx:  0, yy:  1 },
  { xx:  1, xy:  0, yx:  0, yy: -1 },
  { xx: -1, xy:  0, yx:  0, yy:  1 },
  { xx: -1, xy:  0, yx:  0, yy: -1 },
  { xx:  0, xy:  1, yx:  1, yy:  0 },
  { xx:  0, xy:  1, yx: -1, yy:  0 },
  { xx:  0, xy: -1, yx:  1, yy:  0 },
  { xx:  0, xy: -1, yx: -1, yy:  0 },
]


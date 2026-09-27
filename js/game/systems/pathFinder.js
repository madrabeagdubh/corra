// PathFinder.js
//
// A* pathfinding on the tile grid.
// FOV-aware but gracefully handles null fovSystem (outdoor maps).
// Returns an array of {dx, dy} steps from origin to destination.
//
// Also provides screenToTile() — converts a screen touch position back
// through the perspective projection to a tile coordinate.
//
// Usage:
//   const pf = new PathFinder(walkGrid, fovSystem)  // fovSystem can be null
//   const path = pf.findPath(fromX, fromY, toX, toY)
//   // path = [{dx:0,dy:-1}, {dx:1,dy:0}, ...] or [] if unreachable

export default class PathFinder {
// Diagonal moves cost slightly more than cardinal
  constructor(walkGrid, fovSystem) {
    this._grid = walkGrid
    this._fov  = fovSystem ?? null  // null = no FOV restriction
    this._h    = walkGrid.length
    this._w    = walkGrid[0]?.length ?? 0
  }

  updateGrid(walkGrid) {
    this._grid = walkGrid
    this._h    = walkGrid.length
    this._w    = walkGrid[0]?.length ?? 0
  }

  // ── A* ────────────────────────────────────────────────────────────────────

  findPath(fromX, fromY, toX, toY) {
    // Can't path to hidden tiles (only when FOV is active)
    if (this._fov?.isHidden(toX, toY)) return []

    // Can't path to unwalkable tiles -- try adjacent
    if (!this._walkable(toX, toY)) {
      const adj = this._walkableNeighbours(toX, toY)
        .filter(n => !this._fov?.isHidden(n.x, n.y))
      if (!adj.length) return []
      adj.sort((a, b) =>
        this._heuristic(a.x, a.y, fromX, fromY) -
        this._heuristic(b.x, b.y, fromX, fromY)
      )
      toX = adj[0].x
      toY = adj[0].y
    }

    if (fromX === toX && fromY === toY) return []

    const open     = new MinHeap()
    const closed   = new Set()
    const cameFrom = new Map()
    const gScore   = new Map()
    const fScore   = new Map()

    const startKey = `${fromX},${fromY}`
    gScore.set(startKey, 0)
    fScore.set(startKey, this._heuristic(fromX, fromY, toX, toY))
    open.push({ x: fromX, y: fromY, f: fScore.get(startKey) })

    while (!open.isEmpty()) {
      const current    = open.pop()
      const { x: cx, y: cy } = current
      const currentKey = `${cx},${cy}`

      if (cx === toX && cy === toY) {
        return this._reconstructPath(cameFrom, cx, cy, fromX, fromY)
      }

      if (closed.has(currentKey)) continue
      closed.add(currentKey)

      for (const nb of this._neighbours(cx, cy)) {
        const nbKey = `${nb.x},${nb.y}`
        if (closed.has(nbKey)) continue
        // Only skip hidden tiles when FOV is active
        if (this._fov?.isHidden(nb.x, nb.y)) continue
const moveCost   = (nb.x !== cx && nb.y !== cy) ? 1.4 : 1.0
const tentativeG = (gScore.get(currentKey) ?? Infinity) + moveCost
        if (tentativeG < (gScore.get(nbKey) ?? Infinity)) {
          cameFrom.set(nbKey, { x: cx, y: cy })
          gScore.set(nbKey, tentativeG)
          const f = tentativeG + this._heuristic(nb.x, nb.y, toX, toY)
          fScore.set(nbKey, f)
          open.push({ x: nb.x, y: nb.y, f })
        }
      }
    }

    return []
  }

  _reconstructPath(cameFrom, tx, ty, fromX, fromY) {
    const steps = []
    let cx = tx, cy = ty
    while (!(cx === fromX && cy === fromY)) {
      const prev = cameFrom.get(`${cx},${cy}`)
      if (!prev) break
      steps.unshift({ dx: cx - prev.x, dy: cy - prev.y })
      cx = prev.x
      cy = prev.y
    }
    return steps
  }


_heuristic(ax, ay, bx, by) {
  const dx = Math.abs(ax - bx)
  const dy = Math.abs(ay - by)
  // Chebyshev + small nudge to prefer straight lines
  return Math.max(dx, dy) + 0.001 * (dx + dy)
}

  _neighbours(x, y) {
    const dirs = [
      { dx:  0, dy: -1 }, { dx: 0, dy:  1 },
      { dx: -1, dy:  0 }, { dx: 1, dy:  0 },
      { dx: -1, dy: -1 }, { dx: 1, dy: -1 },
      { dx: -1, dy:  1 }, { dx: 1, dy:  1 },
    ]
    return dirs
      .map(d => ({ x: x + d.dx, y: y + d.dy }))
      .filter(n => this._inBounds(n.x, n.y) && this._walkable(n.x, n.y))
  }

  _walkableNeighbours(x, y) {
    const dirs = [
      { dx:  0, dy: -1 }, { dx: 0, dy:  1 },
      { dx: -1, dy:  0 }, { dx: 1, dy:  0 },
    ]
    return dirs
      .map(d => ({ x: x + d.dx, y: y + d.dy }))
      .filter(n => this._inBounds(n.x, n.y) && this._walkable(n.x, n.y))
  }

  _walkable(x, y) {
    return this._inBounds(x, y) && !!this._grid[y]?.[x]
  }

  _inBounds(x, y) {
    return x >= 0 && x < this._w && y >= 0 && y < this._h
  }

  // ── Screen → tile projection ──────────────────────────────────────────────

  static screenToTile(screenX, screenY, pgr, tileSize) {
    // Inverts PGR's OWN projection (its _perspCamRow / _scaleAtRow /
    // _colToScreenX), so a tap maps to exactly the tile drawn under the
    // finger. The previous version re-derived the maths independently and
    // disagreed with the renderer in three ways:
    //   • camera row taken from the PLAYER, but PGR draws from the CAMERA,
    //     which trails the player (follow lerp) and is CLAMPED at the map
    //     edges -- near the north edge of a map taps landed rows off;
    //   • the static HORIZON_Y_FRAC instead of the scene's own horizon;
    //   • terrain height ignored, so on rising ground taps landed too far.
    // tileSize is unused (kept for call-site compatibility).
    const horizonPx = pgr._horizonPx()
    if (screenY <= horizonPx) return null
    const flatRow = pgr._screenYToWorldRow(screenY)
    if (flatRow == null) return null

    const camCol = pgr._perspCamCol()
    const sw     = pgr._sw
    const colAt  = (row) => {
      const sc = pgr._scaleAtRow(row + 0.5)
      return sc < 0.001 ? null : Math.floor((screenX - sw / 2) / sc + camCol)
    }

    // Raised ground is drawn lifted toward the horizon, where a FARTHER
    // flat row would be -- so the tile actually under the finger is at
    // flatRow or nearer. Nearer rows draw over farther ones, so walk from
    // near to far and take the first tile whose lifted span holds screenY.
    const r0 = Math.floor(flatRow)
    const H  = pgr._hmH ? pgr._hmH - 1 : Infinity
    for (let row = Math.min(r0 + 12, H - 1); row >= r0; row--) {
      const col = colAt(row)
      if (col == null) continue
      const yTop = pgr._rowToScreenY(row)
      const yBot = pgr._rowToScreenY(row + 1)
      if (yTop == null || yBot == null) continue
      const lift = (r) => ((pgr._vertexH(col, r) + pgr._vertexH(col + 1, r)) * 0.5) * pgr._scaleAtRow(r)
      const top = yTop - lift(row)
      const bot = yBot - lift(row + 1)
      if (screenY >= top && screenY < bot) return { tx: col, ty: row }
    }
    const col = colAt(r0)
    return col == null ? null : { tx: col, ty: r0 }
  }
}

// ── Minimal binary min-heap for A* open set ──────────────────────────────────

class MinHeap {
  constructor() { this._data = [] }

  push(item) {
    this._data.push(item)
    this._bubbleUp(this._data.length - 1)
  }

  pop() {
    const top  = this._data[0]
    const last = this._data.pop()
    if (this._data.length > 0) {
      this._data[0] = last
      this._siftDown(0)
    }
    return top
  }

  isEmpty() { return this._data.length === 0 }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this._data[parent].f <= this._data[i].f) break
      ;[this._data[parent], this._data[i]] = [this._data[i], this._data[parent]]
      i = parent
    }
  }

  _siftDown(i) {
    const n = this._data.length
    while (true) {
      let smallest = i
      const l = 2 * i + 1, r = 2 * i + 2
      if (l < n && this._data[l].f < this._data[smallest].f) smallest = l
      if (r < n && this._data[r].f < this._data[smallest].f) smallest = r
      if (smallest === i) break
      ;[this._data[smallest], this._data[i]] = [this._data[i], this._data[smallest]]
      i = smallest
    }
  }
}
 

// PathFinder.js
//
// A* pathfinding on the tile grid.
// Only traverses tiles that are visible or visited (fog-of-war aware).
// Returns an array of {dx, dy} steps from origin to destination.
//
// Also provides screenToTile() — converts a screen touch position back
// through the perspective projection to a tile coordinate.
//
// Usage:
//   const pf = new PathFinder(walkGrid, fovSystem)
//   const path = pf.findPath(fromX, fromY, toX, toY)
//   // path = [{dx:0,dy:-1}, {dx:1,dy:0}, ...] or [] if unreachable

export default class PathFinder {

  constructor(walkGrid, fovSystem) {
    this._grid = walkGrid
    this._fov  = fovSystem
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
    // Can't path to hidden tiles
    if (this._fov.isHidden(toX, toY)) return []

    // Can't path to unwalkable tiles (unless it's the destination — allow
    // pathing toward solid targets, stop one tile before)
    if (!this._walkable(toX, toY)) {
      // Try to find a walkable tile adjacent to target
      const adj = this._walkableNeighbours(toX, toY)
        .filter(n => !this._fov.isHidden(n.x, n.y))
      if (!adj.length) return []
      // Pick the adjacent tile closest to the player
      adj.sort((a, b) =>
        this._heuristic(a.x, a.y, fromX, fromY) -
        this._heuristic(b.x, b.y, fromX, fromY)
      )
      toX = adj[0].x
      toY = adj[0].y
    }

    if (fromX === toX && fromY === toY) return []

    const open   = new MinHeap()
    const closed  = new Set()
    const cameFrom = new Map()
    const gScore   = new Map()
    const fScore   = new Map()

    const startKey = `${fromX},${fromY}`
    gScore.set(startKey, 0)
    fScore.set(startKey, this._heuristic(fromX, fromY, toX, toY))
    open.push({ x: fromX, y: fromY, f: fScore.get(startKey) })

    while (!open.isEmpty()) {
      const current = open.pop()
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
        // Only traverse visible or visited tiles
        if (this._fov.isHidden(nb.x, nb.y)) continue

        const tentativeG = (gScore.get(currentKey) ?? Infinity) + 1
        if (tentativeG < (gScore.get(nbKey) ?? Infinity)) {
          cameFrom.set(nbKey, { x: cx, y: cy })
          gScore.set(nbKey, tentativeG)
          const f = tentativeG + this._heuristic(nb.x, nb.y, toX, toY)
          fScore.set(nbKey, f)
          open.push({ x: nb.x, y: nb.y, f })
        }
      }
    }

    return [] // no path found
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
    // Chebyshev distance — allows diagonal movement
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by))
  }

  _neighbours(x, y) {
    const dirs = [
      { dx: 0, dy: -1 }, { dx: 0, dy:  1 },
      { dx:-1, dy:  0 }, { dx: 1, dy:  0 },
      { dx:-1, dy: -1 }, { dx: 1, dy: -1 },
      { dx:-1, dy:  1 }, { dx: 1, dy:  1 },
    ]
    return dirs
      .map(d => ({ x: x + d.dx, y: y + d.dy }))
      .filter(n => this._inBounds(n.x, n.y) && this._walkable(n.x, n.y))
  }

  _walkableNeighbours(x, y) {
    const dirs = [
      { dx: 0, dy: -1 }, { dx: 0, dy:  1 },
      { dx:-1, dy:  0 }, { dx: 1, dy:  0 },
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
  //
  // Inverts PGR's perspective projection to find which tile was tapped.
  // Works by inverting the row-from-screenY formula and then finding the
  // closest column using the horizontal scale at that row.
  //
  // pgr: PerspectiveGroundRenderer instance
  // screenX/Y: touch position in screen pixels (pointer.x / pointer.y)
  // tileSize: scene.tileSize (pixels per tile in world space)
  //
  // Returns { tx, ty } tile coords, or null if tap is above the horizon.

  static screenToTile(screenX, screenY, pgr, tileSize) {
    const horizonPx  = pgr._horizonPx()
    if (screenY <= horizonPx) return null   // tapped sky

    const groundH    = pgr._groundH()
    const FL         = pgr.constructor.FOCAL_LENGTH
    const perspCamRow = pgr._perspCamRow()
    const ts         = pgr.tileDisplaySize

    // Invert: screenY = horizonPx + groundH * FL / (FL + d)
    // where d = perspCamRow - tileRow
    // → tileRow = perspCamRow - (FL * groundH / (screenY - horizonPx) - FL)
    const denom    = screenY - horizonPx
    if (denom <= 0) return null
    const d        = FL * groundH / denom - FL
    const worldRow = perspCamRow - d

    // Use round not floor — gives the tile whose centre is closest to the tap
    const ty = Math.round(worldRow - 0.5)

    // Find column: invert colToScreenX
    // screenX = sw/2 + (worldCol - camCol) * scaleAtRow
    // where tiles are projected at their bottom edge (worldRow + 1 scale)
    const camCol = pgr._perspCamCol()
    const scale  = pgr._scaleAtRow(worldRow)
    if (scale < 0.001) return null

    const worldCol = (screenX - pgr._sw / 2) / scale + camCol
    const tx       = Math.round(worldCol - 0.5)

    return { tx, ty }
  }
}

// ── Minimal binary min-heap for A* open set ───────────────────────────────────

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


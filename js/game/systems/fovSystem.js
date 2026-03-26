// FovSystem.js  (v4)
//
// Tracks both enter and exit timestamps so FogRenderer can animate:
//   - Fog fade OUT when tiles enter FOV  (_enterTimes)
//   - Tint fade IN when tiles leave FOV  (_exitTimes)

export default class FovSystem {

  static FOV_RADIUS = 8
  static FADE_MS    = 1600  // fog dissolve duration (enter)
  static TINT_MS    = 800   // tint appear duration (exit)

  constructor(walkGrid, config = {}) {
    this._grid   = walkGrid
    this._height = walkGrid.length
    this._width  = walkGrid[0]?.length ?? 0
    this._radius = config.radius ?? FovSystem.FOV_RADIUS

    this._visible    = new Set()
    this._visited    = new Set()
    this._enterTimes      = new Map()  // tile → time it last entered visible set
    this._exitTimes       = new Map()  // tile → time it last left visible set
    this._firstVisitTimes = new Map()  // tile → time it was FIRST EVER visited
  }

  // ── Public API ────────────────────────────────────────────────────────────

  isVisible(tx, ty) { return this._visible.has(`${tx},${ty}`) }
  isVisited(tx, ty) { return this._visited.has(`${tx},${ty}`) }
  isHidden(tx, ty)  { return !this._visited.has(`${tx},${ty}`) }

  get visibleSet() { return this._visible }
  get visitedSet() { return this._visited }

  // 0→1: how far the fog has faded out (0=just revealed, 1=fully clear)
  getFadeProgress(tx, ty) {
    const t = this._enterTimes.get(`${tx},${ty}`)
    if (t == null) return 1
    return Math.min(1, (performance.now() - t) / FovSystem.FADE_MS)
  }

  // 0→1: how far the visited tint has faded in (0=just left FOV, 1=fully tinted)
  getTintProgress(tx, ty) {
    const t = this._exitTimes.get(`${tx},${ty}`)
    if (t == null) return 1  // no exit time = always tinted (old visited tile)
    return Math.min(1, (performance.now() - t) / FovSystem.TINT_MS)
  }

  // True if tile was visited before its most recent FOV entry.
  // FogRenderer uses this to skip fog fade-in on re-entering known tiles.
  wasVisitedBeforeCurrentEntry(tx, ty) {
    const key        = `${tx},${ty}`
    const firstVisit = this._firstVisitTimes.get(key)
    const lastEnter  = this._enterTimes.get(key)
    if (firstVisit == null || lastEnter == null) return false
    // 50ms grace handles simultaneous setting on first discovery
    return firstVisit < lastEnter - 50
  }

  hasActiveFades() {
    const now = performance.now()
    for (const key of this._visible) {
      const t = this._enterTimes.get(key)
      if (t != null && now - t < FovSystem.FADE_MS) return true
    }
    return false
  }

  hasActiveTints() {
    const now = performance.now()
    for (const [, t] of this._exitTimes) {
      if (now - t < FovSystem.TINT_MS) return true
    }
    return false
  }

  compute(originX, originY) {
    const prevVisible = this._visible
    this._visible     = new Set()

    this._markVisible(originX, originY, prevVisible)

    for (let octant = 0; octant < 8; octant++) {
      this._castLight(originX, originY, 1, 1.0, 0.0, this._radius,
        OCTANT_TRANSFORMS[octant], prevVisible)
    }

    // Record exit time for tiles that just left the visible set
    const now = performance.now()
    for (const key of prevVisible) {
      if (!this._visible.has(key)) {
        this._exitTimes.set(key, now)
      }
    }
  }

  // ── Shadowcasting ─────────────────────────────────────────────────────────

  _castLight(cx, cy, row, startSlope, endSlope, radius, transform, prevVisible) {
    if (startSlope < endSlope) return
    let nextStartSlope = startSlope

    for (let i = row; i <= radius; i++) {
      let blocked = false

      for (let dx = -i, dy = -i; dx <= 0; dx++) {
        const lSlope = (dx - 0.5) / (dy + 0.5)
        const rSlope = (dx + 0.5) / (dy - 0.5)

        if (startSlope < rSlope) continue
        if (endSlope > lSlope)   break

        const wx = cx + dx * transform.xx + dy * transform.xy
        const wy = cy + dx * transform.yx + dy * transform.yy

        if (this._inBounds(wx, wy)) {
          if (dx * dx + dy * dy <= radius * radius)
            this._markVisible(wx, wy, prevVisible)
        }

        if (blocked) {
          if (!this._isTransparent(wx, wy)) {
            nextStartSlope = rSlope
            continue
          } else {
            blocked    = false
            startSlope = nextStartSlope
          }
        } else if (!this._isTransparent(wx, wy) && i < radius) {
          blocked = true
          this._castLight(cx, cy, i + 1, startSlope, lSlope, radius, transform, prevVisible)
          nextStartSlope = rSlope
        }
      }
      if (blocked) break
    }
  }

  _markVisible(tx, ty, prevVisible) {
    const key = `${tx},${ty}`
    this._visible.add(key)
    const isNewDiscovery = !this._visited.has(key)
    this._visited.add(key)
    if (isNewDiscovery) {
      // First time ever seen — record for wasVisitedBeforeCurrentEntry()
      this._firstVisitTimes.set(key, performance.now())
    }
    if (!prevVisible || !prevVisible.has(key)) {
      this._enterTimes.set(key, performance.now())
    }
  }

  _isTransparent(tx, ty) {
    if (!this._inBounds(tx, ty)) return false
    return !!this._grid[ty]?.[tx]
  }

  _inBounds(tx, ty) {
    return tx >= 0 && tx < this._width && ty >= 0 && ty < this._height
  }

  updateGrid(walkGrid) {
    this._grid   = walkGrid
    this._height = walkGrid.length
    this._width  = walkGrid[0]?.length ?? 0
  }

  reset() {
    this._visible.clear()
    this._visited.clear()
    this._enterTimes.clear()
    this._exitTimes.clear()
    this._firstVisitTimes.clear()
    this._firstVisitTimes.clear()
  }
}

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


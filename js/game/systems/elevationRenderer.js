// ElevationRenderer.js — patched: added gidHeights support
// Drop-in replacement for js/game/systems/elevationRenderer.js
//
// New config option: gidHeights: { [gid]: tileHeightUnits, ... }
// GIDs in this map use their own height instead of the global cliffHeight.
// Use for ridge tiles (taller), eave tiles (shorter), etc.
//
// All other behaviour unchanged from the original.

export default class ElevationRenderer {

  constructor(pgr, config = {}) {
    this.pgr = pgr

    this.cliffGids    = config.cliffGids    ?? new Set([740])
    this.cliffFaceGid = config.cliffFaceGid ?? 740
    this.elevatedGids = config.elevatedGids ?? new Set([839, 840])
    this.cliffSouth   = config.cliffSouth   ?? new Set([731, 1625, 1679])
    this.cliffHeight  = config.cliffHeight  ?? 1.0

    /**
     * Per-GID height overrides (optional).
     * Keys = GID numbers, values = height in tile-height units.
     * GIDs not listed fall back to this.cliffHeight.
     *
     * Example (buildings):
     *   gidHeights: { 3002: 2.1, 3001: 1.5, 3011: 1.5 }
     */
    this.gidHeights = config.gidHeights ?? null

    this.sideColorOverride = config.sideColor ?? null

    this._elev      = null
    this._elevMapId = null
  }

  update(mapData) {
    if (!mapData?.hasCliffs) return
    const layer0 = mapData.layers?.[0]
    if (!layer0) return

    if (this._elevMapId !== layer0) {
      this._buildElevationMap(layer0)
      this._elevMapId = layer0
      this.pgr._elev = this._elev
    }
  }

  getElevationScreenOffset(tileX, tileY) {
    const elev = this._elev?.[tileY]?.[tileX] ?? 0
    if (!elev) return 0
    const pxPerTile = this.pgr._scaleAtRow(tileY + 1)
    return -(elev * pxPerTile)
  }

  getElevation(tileX, tileY) {
    return this._elev?.[tileY]?.[tileX] ?? 0
  }

  destroy() {
    this._elev      = null
    this._elevMapId = null
    this.pgr._elev  = null
  }

  _buildElevationMap(layer0) {
    const mapH = layer0.length
    const mapW = layer0[0].length
    const CH   = this.cliffHeight

    // ── North plateau cliff edge detection ───────────────────────────────────
    const firstCliffRow = new Array(mapW).fill(Infinity)
    for (let c = 0; c < mapW; c++) {
      for (let r = mapH - 2; r >= 0; r--) {
        if (this.elevatedGids.has(layer0[r][c]) &&
            this.cliffSouth.has(layer0[r + 1]?.[c] ?? 0)) {
          firstCliffRow[c] = r
          break
        }
      }
    }

    // ── South plateau cliff edge detection ───────────────────────────────────
    const lastCliffRow = new Array(mapW).fill(-Infinity)
    for (let c = 0; c < mapW; c++) {
      for (let r = 1; r < mapH; r++) {
        if (this.elevatedGids.has(layer0[r][c]) &&
            this.cliffSouth.has(layer0[r - 1]?.[c] ?? 0)) {
          lastCliffRow[c] = r
          break
        }
      }
    }

    // ── Build elevation grid ─────────────────────────────────────────────────
    // Per-GID heights: if gidHeights is provided, look up each tile's GID
    // to determine its individual height. Falls back to cliffHeight.
    this._elev = []
    for (let r = 0; r < mapH; r++) {
      this._elev[r] = new Float32Array(mapW)
      for (let c = 0; c < mapW; c++) {
        if (!this.elevatedGids.has(layer0[r][c])) continue
        if (firstCliffRow[c] < Infinity && r <= firstCliffRow[c]) {
          const gid = layer0[r][c]
          this._elev[r][c] = this.gidHeights?.[gid] ?? CH
        }
      }
    }

    console.log('[ElevationRenderer] map built',
      mapH + 'x' + mapW,
      '| N cliffs:', firstCliffRow.filter(v => v < Infinity).length,
      '| S cliffs:', lastCliffRow.filter(v => v > -Infinity).length,
      '| gidHeights:', this.gidHeights ? Object.keys(this.gidHeights).length + ' entries' : 'none')
  }
}


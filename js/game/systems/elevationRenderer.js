// ElevationRenderer.js
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS MODULE DOES
// ─────────────────────────────────────────────────────────────────────────────
// Adds chunky 3D elevated terrain to any PerspectiveGroundRenderer map.
// It reads the map's layer data, builds an elevation lookup, and draws:
//
//   • North plateau  — cliff faces (rock texture), grass caps, staircase sides
//   • South plateau  — elevated grass tiles (layer 3), back faces, side fills
//
// The walk grid is NOT modified — elevation is purely visual.
// All drawing goes through the PGR's own canvas contexts and projection methods.
//
// ─────────────────────────────────────────────────────────────────────────────
// HOW TO USE ON A NEW MAP  (e.g. a dungeon, castle, hilltop ruins)
// ─────────────────────────────────────────────────────────────────────────────
//
//   1. In your map JSON, set  "hasCliffs": true
//
//   2. Structure your layers:
//        Layer 0 — ground tiles (grass, stone, water, etc.)
//        Layer 1 — north-facing cliff edge markers (GID 740 or your own)
//        Layer 2 — north plateau grass/stone caps
//        Layer 3 — south plateau elevated tiles (same GIDs as layer 0)
//
//   3. In your scene's drawTilemap(), after creating the PGR:
//        this.elevationRenderer = new ElevationRenderer(this.perspectiveGround, {
//          cliffGids:    new Set([740]),      // GID(s) marking cliff edges in layer 1
//          cliffFaceGid: 740,                 // sprite used to texture the vertical face
//          elevatedGids: new Set([839, 840]), // GIDs that sit on the plateau surface
//          cliffSouth:   new Set([731, 1625, 1679]), // GIDs that form the cliff's toe
//          cliffHeight:  1.0,                 // cliff height in tile-height units
//          sideColor:    null,                // null = derive from tint; or e.g. '#4a3020'
//        })
//
//   4. In your scene's update():
//        if (this.elevationRenderer) this.elevationRenderer.update(this.mapData)
//        // Call this BEFORE perspectiveGround.update() so elevation data is fresh.
//
//   5. In your scene's drawTilemap() skip layers 1-3 for Phaser:
//        if (this.usePerspective && li <= 3) continue
//
//   6. In your scene's shutdown():
//        if (this.elevationRenderer) { this.elevationRenderer.destroy(); this.elevationRenderer = null }
//
// ─────────────────────────────────────────────────────────────────────────────
// DUNGEON / ENEMY NOTES
// ─────────────────────────────────────────────────────────────────────────────
//
// For a dungeon map with raised walkways and pits:
//   • Use a stone floor GID (e.g. 500) as the elevatedGid
//   • Use a void/pit GID (e.g. 0 or a dark tile) as the cliffSouth equivalent
//   • cliffFaceGid should be a stone wall sprite
//   • cliffHeight: 1.5 gives taller dungeon walls
//
// For enemies on elevated ground:
//   • Enemy logical positions work as normal (walk grid is 2D)
//   • To render an enemy billboard AT the elevated height, use:
//       pgr.perspectiveProject(enemy.tileX, enemy.tileY)
//     and then offset screenY upward by:
//       elevationRenderer.getElevationScreenOffset(enemy.tileX, enemy.tileY)
//   • getElevationScreenOffset() returns 0 for sea-level tiles and a negative
//     pixel value (upward shift) for elevated tiles.
//
// For south-plateau enemies (behind camera, near rows):
//   • These tiles can't use standard perspective projection.
//   • Render them as billboards using yTopClamped from the tile loop,
//     offset upward by cliffHeight * scaleAtRow(tileRow+1).
//
// ─────────────────────────────────────────────────────────────────────────────

export default class ElevationRenderer {

  /**
   * @param {PerspectiveGroundRenderer} pgr  — the host renderer
   * @param {object} config                  — elevation configuration (see above)
   */
  constructor(pgr, config = {}) {
    this.pgr = pgr

    // ── Configuration ────────────────────────────────────────────────────────
    // These can all be overridden per-map in the config object.

    /** GIDs in layer 1 that mark the south-facing cliff edge */
    this.cliffGids    = config.cliffGids    ?? new Set([740])

    /** The sprite GID used to texture the vertical cliff face quad */
    this.cliffFaceGid = config.cliffFaceGid ?? 740

    /** GIDs that sit on the elevated plateau surface */
    this.elevatedGids = config.elevatedGids ?? new Set([839, 840])

    /** GIDs that form the cliff's toe (shore, water, void) */
    this.cliffSouth   = config.cliffSouth   ?? new Set([731, 1625, 1679])

    /** Cliff height in tile-height units. 1.0 = one full tile tall. */
    this.cliffHeight  = config.cliffHeight  ?? 1.0

    /**
     * Override side/back face fill colour.
     * null = derive from the tile's own tint (recommended for outdoors).
     * String = fixed CSS colour (e.g. '#1a1a2e' for dungeon stone).
     */
    this.sideColorOverride = config.sideColor ?? null

    // ── Internal state ───────────────────────────────────────────────────────
    /** Per-tile elevation map. Built lazily in update(). Float32Array per row. */
    this._elev      = null
    /** Cache key — rebuilt when layer0 reference changes (new map load) */
    this._elevMapId = null
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Call once per frame, BEFORE perspectiveGround.update().
   * Rebuilds the elevation map if the map has changed.
   * The PGR reads this._elev via pgr._elev (set by this method).
   *
   * @param {object} mapData — scene.mapData
   */
  update(mapData) {
    if (!mapData?.hasCliffs) return
    const layer0 = mapData.layers?.[0]
    if (!layer0) return

    if (this._elevMapId !== layer0) {
      this._buildElevationMap(layer0)
      this._elevMapId = layer0
      // Expose to PGR so its tile loop can read elevation values
      this.pgr._elev = this._elev
    }
  }

  /**
   * Returns the screen-pixel upward offset for a tile at elevated height.
   * Use this to position enemy/NPC sprites on elevated ground:
   *
   *   const proj   = pgr.perspectiveProject(enemy.tileX, enemy.tileY)
   *   const offset = elevRenderer.getElevationScreenOffset(enemy.tileX, enemy.tileY)
   *   const screenY = proj.screenY + offset   // negative = upward
   *
   * Returns 0 for sea-level tiles.
   */
  getElevationScreenOffset(tileX, tileY) {
    const elev = this._elev?.[tileY]?.[tileX] ?? 0
    if (!elev) return 0
    const pxPerTile = this.pgr._scaleAtRow(tileY + 1)
    return -(elev * pxPerTile)
  }

  /**
   * Returns the raw elevation value (in tile-height units) for a tile.
   * 0 = sea level. 1.0 = one full cliff height above sea level.
   */
  getElevation(tileX, tileY) {
    return this._elev?.[tileY]?.[tileX] ?? 0
  }

  destroy() {
    this._elev      = null
    this._elevMapId = null
    this.pgr._elev  = null
  }

  // ── Elevation map ─────────────────────────────────────────────────────────

  /**
   * Scans layer 0 to find cliff edge positions per column and marks all
   * plateau tiles with their elevation value.
   *
   * North plateau: tiles at or north of the southernmost grass→shore boundary.
   * South plateau: tiles at or south of the northernmost grass→shore boundary.
   *                (These are behind the camera and handled differently in drawing.)
   */
  _buildElevationMap(layer0) {
    const mapH = layer0.length
    const mapW = layer0[0].length
    const CH   = this.cliffHeight

    // ── North plateau cliff edge detection ───────────────────────────────────
    // Per column: find the southernmost elevated tile whose south neighbour
    // is a cliff-toe tile (shore, water, void).
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
    // Per column: find the northernmost elevated tile whose north neighbour
    // is a cliff-toe tile.
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
    this._elev = []
    for (let r = 0; r < mapH; r++) {
      this._elev[r] = new Float32Array(mapW)
      for (let c = 0; c < mapW; c++) {
        if (!this.elevatedGids.has(layer0[r][c])) continue
        // North plateau only — south plateau is handled via layer 3 drawing
        if (firstCliffRow[c] < Infinity && r <= firstCliffRow[c]) {
          this._elev[r][c] = CH
        }
      }
    }

    console.log('[ElevationRenderer] map built',
      mapH + 'x' + mapW,
      '| N cliffs:', firstCliffRow.filter(v => v < Infinity).length,
      '| S cliffs:', lastCliffRow.filter(v => v > -Infinity).length)
  }
}


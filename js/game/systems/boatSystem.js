// BoatSystem.js
//
// Manages the player's boat state on river maps.
//
// Responsibilities:
//   - Track inBoat state on player
//   - Apply eastward drift when idle (current)
//   - Override walk grid so water + shore are walkable while in boat
//   - Filter tap targets: land tiles rejected, shore tiles allowed (disembark)
//   - Half-speed on shore tiles, no drift
//   - Disembark: auto when player steps onto shore tile
//   - Boat sprite: signals PGR to render boat below player
//
// Usage (from scene.create, after initializeLocation()):
//   this.boatSystem = new BoatSystem(this)
//   this.boatSystem.activate()   // call once at river entry
//
// Then in scene.update(time, delta):
//   if (this.boatSystem) this.boatSystem.update(delta)
//
// And in scene.shutdown():
//   if (this.boatSystem) { this.boatSystem.destroy(); this.boatSystem = null }

// Shore GIDs from oryxCatalogue
const SHORE_GIDS = new Set([
  1472, 1473, 1474,   // west+north, north, north+east shore
  1526, 1528,          // west shore, east shore
  1580, 1581, 1582,   // west+south, south, south+east shore
  1635, 1636,          // shore west+north+east, shore north+east+south
  1689, 1690,          // shore west+south+north, shore north+west+south
  1742, 1743,          // shore west+north tiny, shore east+north tiny
  1796, 1797,          // shore west+south tiny, shore south+east tiny
  1852,                // north+south shore
  1906,                // east+west shore
  1958, 1959, 1960,   // points of shore
  2012, 2013,          // points of land
])

const WATER_GIDS = new Set([1625, 1679])

// Pixels per second the current pulls the boat east when fully idle
const DRIFT_SPEED_PX_S = 18

// Shore tiles slow the boat to this fraction of normal speed
const SHORE_SPEED_MULT = 0.5

export default class BoatSystem {

  constructor(scene) {
    this.scene   = scene
    this.active  = false
    this._boatLost = false

    // Fractional pixel accumulator for sub-pixel drift
    this._driftAccum = 0
  }

  // ── Activation ────────────────────────────────────────────────────────────


activate() {
  if (this.active) return
  this.active = true

  const p = this.scene.player
  if (!p) { console.warn('[BoatSystem] no player'); return }

  p.inBoat = true

  // Stop any damage timer and water effects already running
  const tm = this.scene.terrainManager
  if (tm?.damageTimer) {
    tm.damageTimer.remove()
    tm.damageTimer = null
  }
  if (tm?._waterSinkInterval) {
    clearInterval(tm._waterSinkInterval)
    tm._waterSinkInterval = null
  }
  tm?._stopBubbles()

  this._rebuildWalkGrid()

    // Tell PGR to render boat under player
    if (this.scene.perspectiveGround) {
      this.scene.perspectiveGround.setBoatActive(true)
    }

    // Apply shore speed if spawning on a shore tile
    this._applyTerrainModifiers()

    console.log('[BoatSystem] activated -- player in boat')
  }

  deactivate() {
    if (!this.active) return
    this.active = false

    const p = this.scene.player
    if (p) {
      p.inBoat = false
      p.setTerrainSpeedModifier(1.0)
    }

    // Restore normal walk grid
    if (this.scene.walkGrid && this.scene._originalWalkGrid) {
      this.scene.walkGrid = this.scene._originalWalkGrid.map(r => [...r])
      this.scene.pathFinder?.updateGrid(this.scene.walkGrid)
    }

    // Keep boat visible briefly then fade -- it drifts away with the current
    if (this.scene.perspectiveGround) {
      const pgr = this.scene.perspectiveGround
      // Check if disembarked on shore -- boat stays still, no drift
      const p      = this.scene.player
      const ts     = this.scene.tileSize
      const layer0 = this.scene.mapData.layers[0]
      const tileX  = Math.floor((p?.logicalX ?? 0) / ts)
      const tileY  = Math.floor((p?.logicalY ?? 0) / ts)
      const gid    = layer0[tileY]?.[tileX] ?? 0
      const onShore = [1472,1473,1474,1526,1528,1580,1581,1582,
        1635,1636,1689,1690,1742,1743,1796,1797,1852,1906,
        1958,1959,1960,2012,2013].includes(gid)
      pgr._boatDrifting = !onShore
      // Capture screen position before boatActive is cleared
      pgr._boatDriftStartX = pgr._boatLastScreenX ?? pgr._boatScreenX ?? (pgr._sw / 2)
      pgr._boatDriftStartY = pgr._boatLastScreenY ?? pgr._boatScreenY ?? (pgr._sh / 2)
      pgr._boatDriftT = 0
      // After 4 seconds, fully deactivate
      this.scene.time.delayedCall(4000, () => {
        pgr.setBoatActive(false)
        pgr._boatDrifting = false
      })
    }

    console.log('[BoatSystem] deactivated -- player disembarked')
  }

  // ── Walk grid ─────────────────────────────────────────────────────────────

  _rebuildWalkGrid() {
    const scene    = this.scene
    const mapData  = scene.mapData
    const ts       = scene.tileSize
    const layer0   = mapData.layers[0]
    const mapH     = layer0.length
    const mapW     = layer0[0].length

    // Save original grid so we can restore on deactivate
    scene._originalWalkGrid = scene.walkGrid.map(r => [...r])

    const newGrid = []
    for (let y = 0; y < mapH; y++) {
      newGrid[y] = []
      for (let x = 0; x < mapW; x++) {
        const gid = layer0[y]?.[x] ?? 0
        // In boat: water and shore tiles are walkable; land tiles are not
        // Shore tiles are the disembark destination -- reachable but trigger exit
        const isWaterOrShore = WATER_GIDS.has(gid) || SHORE_GIDS.has(gid)
        // Preserve border/wall collisions from original grid
        const originallyWalkable = scene.walkGrid[y]?.[x] ?? false
        if (isWaterOrShore) {
          newGrid[y][x] = true
        } else {
          // Land tile: only allow if it's an exit corridor tile
          // (so the player can walk off the map edge to transition)
          const border = mapData.border
          const onExitCorridor = border && (
            ((x === 0 || x === mapW-1) && border.openRows?.includes(y)) ||
            ((y === 0 || y === mapH-1) && border.openCols?.includes(x))
          )
          newGrid[y][x] = onExitCorridor
        }
      }
    }

    scene.walkGrid = newGrid
    scene.pathFinder?.updateGrid(newGrid)
    console.log('[BoatSystem] walk grid rebuilt for water traversal')
  }

  // ── Per-frame update ──────────────────────────────────────────────────────

  update(delta) {
    if (!this.active) return
    const p = this.scene.player
    if (!p) return

    const ts      = this.scene.tileSize
    const mapData = this.scene.mapData
    const layer0  = mapData.layers[0]

    // Current tile under player
    const tileX = Math.floor(p.logicalX / ts)
    const tileY = Math.floor(p.logicalY / ts)
    const gid   = layer0[tileY]?.[tileX] ?? 0

    const onShore = SHORE_GIDS.has(gid)
    const onWater = WATER_GIDS.has(gid)
    const onLand  = !onShore && !onWater

    // ── Auto-disembark on shore ───────────────────────────────────────────
    if (onShore && !p.isMoving && p.pathQueue.length === 0) {
      this._triggerDisembark()
      return
    }

    // ── Auto-disembark on land collision (boat hits bank carelessly) ──────
    if (onLand && !p.isMoving) {
      this._triggerDisembark(true)  // true = boat lost to current
      return
    }

    // ── Speed modifier ────────────────────────────────────────────────────
    // Shore: half speed, no drift; Water: normal speed, drift when idle
    if (onShore) {
      if (p.terrainSpeedModifier !== SHORE_SPEED_MULT) {
        p.setTerrainSpeedModifier(SHORE_SPEED_MULT)
      }
    } else {
      if (p.terrainSpeedModifier !== 1.0) {
        p.setTerrainSpeedModifier(1.0)
      }
    }

    // ── East drift ────────────────────────────────────────────────────────
    // Only when on water, not moving, and not on shore
    if (onWater && !p.isMoving && p.pathQueue.length === 0) {
      this._applyDrift(delta, ts, mapData)
    }
  }

  _applyDrift(delta, ts, mapData) {
    const p = this.scene.player

    this._driftAccum += DRIFT_SPEED_PX_S * (delta / 1000)

    if (this._driftAccum < 1) return   // sub-pixel, wait

    const pixels = Math.floor(this._driftAccum)
    this._driftAccum -= pixels

    const newX = p.logicalX + pixels

    // Clamp at east edge of map (one tile from border)
    const mapMaxX = (mapData.width - 2) * ts + ts / 2
    if (newX >= mapMaxX) {
      // Stopped at east edge -- future: trigger estuary transition
      p.logicalX = mapMaxX
      p.targetX  = mapMaxX
      p.startX   = mapMaxX
      this._driftAccum = 0
      return
    }

    // Collision check: is the tile to the east walkable (water/shore)?
    const targetTileX = Math.floor(newX / ts)
    const targetTileY = Math.floor(p.logicalY / ts)
    const layer0      = mapData.layers[0]
    const targetGid   = layer0[targetTileY]?.[targetTileX] ?? 0

    if (!WATER_GIDS.has(targetGid) && !SHORE_GIDS.has(targetGid)) {
      // Hit the bank -- stop drift
      this._driftAccum = 0
      return
    }

    // Apply drift directly to logical position (no step animation for drift)
    p.logicalX = newX
    p.targetX  = newX
    p.startX   = newX
  }

  // ── Disembark ─────────────────────────────────────────────────────────────

  _triggerDisembark(boatLost = false) {
    const p = this.scene.player

    if (boatLost) {
      // Player lands on bank without using shore tiles -- boat drifts away
      console.log('[BoatSystem] boat lost to current')
      this._boatLost = true
      // TODO: animate abandoned boat drifting east, then destroy
    } else {
      console.log('[BoatSystem] clean disembark on shore')
    }

    this.deactivate()

    // Brief narrative beat
    if (this.scene.textPanel) {
      const text = boatLost
        ? { ga: 'Imigh an bád leis an sruth.', en: 'The boat drifted away with the current.' }
        : { ga: 'Chuala mé an abhainn fúm.', en: 'I felt the riverbed beneath me.' }
      this.scene.time.delayedCall(300, () => {
        this.scene.textPanel.show({ ...text, type: 'notification' })
      })
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _applyTerrainModifiers() {
    const p      = this.scene.player
    const ts     = this.scene.tileSize
    const layer0 = this.scene.mapData.layers[0]
    const tileX  = Math.floor(p.logicalX / ts)
    const tileY  = Math.floor(p.logicalY / ts)
    const gid    = layer0[tileY]?.[tileX] ?? 0
    if (SHORE_GIDS.has(gid)) p.setTerrainSpeedModifier(SHORE_SPEED_MULT)
    else p.setTerrainSpeedModifier(1.0)
  }

  // ── Tap filter (called from scene._setupTapToPath) ────────────────────────
  // Returns true if the tapped tile is a valid boat destination.
  // Shore tiles are valid (disembark destination).
  // Land tiles are rejected.

  isValidBoatTarget(tx, ty) {
    const layer0 = this.scene.mapData.layers[0]
    const gid    = layer0[ty]?.[tx] ?? 0
    return WATER_GIDS.has(gid) || SHORE_GIDS.has(gid)
  }

  destroy() {
    this.deactivate()
    console.log('[BoatSystem] destroyed')
  }
}


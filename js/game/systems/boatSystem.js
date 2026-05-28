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

import { GameState } from './gameState.js'
import { createItem } from '../ui/inventory/itemDefinitions.js'

// Reed GIDs -- marshy buffer between river and land.
// GID 731 ("waterside") is the only reed tile on current river maps.
// Boat navigates freely here; no current drift; player can wade on foot.
const REED_GIDS  = new Set([731])
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

    // Momentum: velocity in logical pixels per second
    this._vx = 0
    this._vy = 0
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
      const pgr = this.scene.perspectiveGround
      // Load boat image if not already loaded (first activation or after scene restart)
      if (!pgr._boatCanvas && this.scene.textures.exists('boat')) {
        pgr.loadBoatImage(this.scene.textures.get('boat').getSourceImage())
      }
      pgr.setBoatActive(true)
    }

    // Apply shore speed if spawning on a shore tile
    this._applyTerrainModifiers()

    this._activatedAt = Date.now()
  // Add currach to inventory while aboard
  const _inv = this.scene.player?.inventory
  if (_inv) {
    const _slot = _inv.findEmptyInventorySlot()
    if (_slot !== -1) _inv.setItem(_slot, createItem('currach'))
  }
  // this._startRipples()  // TODO: ripple polish
  console.log('[BoatSystem] activated -- player in boat')
  }

  deactivate() {
    if (!this.active) return
    this.active = false
    this._deactivatedAt = Date.now()
    this._vx = 0
    this._vy = 0

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
      const onShore = REED_GIDS.has(gid)   // reeds = safe moor, no drift
      pgr._boatDrifting = !onShore
      // Store world (logical pixel) coords for drift -- NOT screen coords
      // Screen coords shift with camera; world coords are stable
      pgr._boatWorldX = (p?.logicalX ?? 0)
      pgr._boatWorldY = (p?.logicalY ?? 0)
      pgr._boatDriftSpeed = 18   // logical pixels per second, matches current speed
      pgr._boatDriftT = 0
      // Deactivate player-attached rendering -- boat drifts independently
      pgr.setBoatActive(false)
      // Boat drifts indefinitely, no fade -- recoverable later
    }

    // Remove currach from inventory on disembark
    const _inv2 = this.scene.player?.inventory
    if (_inv2) {
      for (let i = 0; i < 25; i++) {
        const item = _inv2.getItem(i)
        if (item?.id === 'currach') { _inv2.setItem(i, null); break }
      }
    }
    this._stopRipples()
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
        // In boat: water and reed tiles are walkable; land tiles block the boat
        const isBoatPassable = WATER_GIDS.has(gid) || REED_GIDS.has(gid)
        if (isBoatPassable) {
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
    const p = this.scene.player
    if (!p) return

    if (!this.active) {
      const pgr = this.scene.perspectiveGround
      if (pgr?._boatWorldX != null) {
        const ts   = this.scene.tileSize
        const dist = Math.hypot(p.logicalX - pgr._boatWorldX, p.logicalY - pgr._boatWorldY)
        const sinceDisembark = Date.now() - (this._deactivatedAt ?? 0)
        if (dist < ts * 0.8 && !p.isMoving && sinceDisembark > 1500) {
          this._reboard(p, pgr)
        }
      }
      return
    }

    const ts      = this.scene.tileSize
    const mapData = this.scene.mapData
    const layer0  = mapData.layers[0]

    // Current tile under player
    const tileX = Math.floor(p.logicalX / ts)
    const tileY = Math.floor(p.logicalY / ts)
    const gid   = layer0[tileY]?.[tileX] ?? 0

    const onReed  = REED_GIDS.has(gid)
    const onWater = WATER_GIDS.has(gid)
    const onLand  = !onReed && !onWater
    if (this._lastGid !== gid) { this._lastGid = gid; console.log('[boat] tile gid:', gid, 'onReed:', onReed, 'onWater:', onWater, 'onLand:', onLand) }

    // Cancel mid-step if heading onto land (belt-and-suspenders guard)
    if (onLand && p.isMoving) {
      p.isMoving = false
      p.logicalX = p.startX
      p.logicalY = p.startY
      p.targetX  = p.startX
      p.targetY  = p.startY
      p.moveProgress = 0
    }

    // ── Auto-disembark on land only (reeds are safe, no auto-disembark) ──
    if (onLand && !p.isMoving) {
      if (Date.now() - (this._activatedAt ?? 0) < 800) return
      this._triggerDisembark(true)   // boat lost to current
      return
    }

    // ── Momentum-based movement ──────────────────────────────────────────
    const dt = delta / 1000   // seconds

    // Joystick impulse
    const joystick = this.scene.joystick
    const force    = joystick?.force ?? 0
    const angle    = joystick?.angle ?? 0

    // Max speed: slower in reeds, full in water
    const maxSpeed  = onReed ? 80 : 160   // logical px/s
    const impulse   = onReed ? 320 : 600  // px/s² acceleration
    const friction  = onReed ? 6.0 : 3.5  // multiplier per second (exponential)

    if (force > 10) {
      const rad = angle * Math.PI / 180
      const ix  = Math.cos(rad) * impulse * dt
      const iy  = Math.sin(rad) * impulse * dt
      this._vx += ix
      this._vy += iy
      // Clamp to max speed
      const spd = Math.hypot(this._vx, this._vy)
      if (spd > maxSpeed) {
        this._vx = this._vx / spd * maxSpeed
        this._vy = this._vy / spd * maxSpeed
      }
      p.isMoving = true
    } else {
      p.isMoving = Math.hypot(this._vx, this._vy) > 4
    }

    // Apply friction first, then add drift so it always accumulates
    const fric = Math.pow(friction, -dt)
    this._vx *= fric
    this._vy *= fric

    // Dead stop below threshold -- but only for Y, not X (drift keeps X alive)
    if (Math.abs(this._vy) < 0.5) this._vy = 0

    // East drift: always present on water, bypasses friction dead-stop
    if (onWater) {
      this._vx += DRIFT_SPEED_PX_S * dt
      // Let drift accumulate -- no dead-stop on X when on water
    } else {
      if (Math.abs(this._vx) < 0.5) this._vx = 0
    }

    // Move player
    if (this._vx !== 0 || this._vy !== 0) {
      const newX = p.logicalX + this._vx * dt
      const newY = p.logicalY + this._vy * dt

      // Collision check for X
      const txNew = Math.floor(newX / ts)
      const tyNew = Math.floor(newY / ts)
      const gidX  = mapData.layers[0]?.[Math.floor(p.logicalY / ts)]?.[txNew] ?? 0
      const gidY  = mapData.layers[0]?.[tyNew]?.[Math.floor(p.logicalX / ts)] ?? 0
      const passX = gidX === 1625 || gidX === 1679 || gidX === 731
      const passY = gidY === 1625 || gidY === 1679 || gidY === 731

      if (passX) { p.logicalX = newX } else { this._vx *= -0.3 }
      if (passY) { p.logicalY = newY } else { this._vy *= -0.3 }

      // Keep logical position snapped to map bounds
      const mapMaxX = (mapData.width  - 1) * ts
      const mapMaxY = (mapData.height - 1) * ts
      p.logicalX = Math.max(ts * 0.5, Math.min(mapMaxX, p.logicalX))
      p.logicalY = Math.max(ts * 0.5, Math.min(mapMaxY, p.logicalY))

      // Sync player step coords so reboard/disembark checks work
      p.targetX = p.logicalX
      p.targetY = p.logicalY
      p.startX  = p.logicalX
      p.startY  = p.logicalY
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

    if (!WATER_GIDS.has(targetGid) && !REED_GIDS.has(targetGid)) {
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

    // Save or clear boat position in GameState
    const _p  = this.scene.player
    const _ts = this.scene.tileSize
    const _mapKey = this.scene.getMapKey?.() ?? this.scene.scene.key
    if (boatLost) {
      GameState.clearBoatPosition()
    } else {
      const _tx = Math.floor((_p?.logicalX ?? 0) / _ts)
      const _ty = Math.floor((_p?.logicalY ?? 0) / _ts)
      GameState.setBoatPosition(_mapKey, _tx, _ty)
    }

    this.deactivate()

    // Disembark is a silent action -- no textPanel notification
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _applyTerrainModifiers() {
    const p      = this.scene.player
    const ts     = this.scene.tileSize
    const layer0 = this.scene.mapData.layers[0]
    const tileX  = Math.floor(p.logicalX / ts)
    const tileY  = Math.floor(p.logicalY / ts)
    const gid    = layer0[tileY]?.[tileX] ?? 0
    if (REED_GIDS.has(gid)) p.setTerrainSpeedModifier(SHORE_SPEED_MULT)
    else p.setTerrainSpeedModifier(1.0)
  }

  // ── Tap filter (called from scene._setupTapToPath) ────────────────────────
  // Returns true if the tapped tile is a valid boat destination.
  // Shore tiles are valid (disembark destination).
  // Land tiles are rejected.

  isValidBoatTarget(tx, ty) {
    const layer0 = this.scene.mapData.layers[0]
    const gid    = layer0[ty]?.[tx] ?? 0
    return WATER_GIDS.has(gid) || REED_GIDS.has(gid)
  }

  _reboard(p, pgr) {
    const ts = this.scene.tileSize
    const boatTX = Math.round(pgr._boatWorldX / ts)
    const boatTY = Math.round(pgr._boatWorldY / ts)
    p.logicalX = boatTX * ts + ts / 2
    p.logicalY = boatTY * ts + ts / 2
    p.targetX  = p.logicalX
    p.targetY  = p.logicalY
    p.startX   = p.logicalX
    p.startY   = p.logicalY
    pgr._boatDrifting = false
    pgr._boatWorldX   = null
    pgr._boatWorldY   = null
    if (this.scene.textures.exists('boat')) {
      pgr.loadBoatImage(this.scene.textures.get('boat').getSourceImage())
    }
    this.activate()
    console.log('[BoatSystem] reboarded')
  }

  // ── Ripples ───────────────────────────────────────────────────────────────

  _startRipples() {
    if (this._rippleInterval) return
    this._rippleInterval = setInterval(() => this._spawnRipple(), 120)
  }

  _stopRipples() {
    if (this._rippleInterval) {
      clearInterval(this._rippleInterval)
      this._rippleInterval = null
    }
  }

  _spawnRipple() {
    const p   = this.scene.player
    const pgr = this.scene.perspectiveGround
    if (!p || !pgr) return

    const spd = Math.hypot(this._vx ?? 0, this._vy ?? 0)
    if (spd < 8) return   // no ripples when nearly still

    // Spawn behind the boat -- opposite to velocity direction
    const normX = spd > 0 ? (this._vx ?? 0) / spd : 0
    const normY = spd > 0 ? (this._vy ?? 0) / spd : 0
    const ts    = this.scene.tileSize

    // Offset behind boat in logical space, with slight random spread
    const spread = 6
    const ox = -normX * ts * 0.4 + (Math.random() - 0.5) * spread
    const oy = -normY * ts * 0.4 + (Math.random() - 0.5) * spread

    const proj = pgr._projectLogical(p.logicalX + ox, p.logicalY + oy, true)
    if (!proj) return

    // Size scales with speed
    const size  = 4 + Math.min(spd / 20, 3) + Math.random() * 3
    const alpha = 0.5 + Math.min(spd / 120, 0.4)

    const el = document.createElement('div')
    el.style.cssText = [
      'position:fixed',
      `left:${proj.screenX - size}px`,
      `top:${proj.screenY - size * 0.35}px`,
      `width:${size * 2}px`,
      `height:${size * 0.7}px`,
      'border-radius:50%',
      `border:1.5px solid rgba(140,210,255,${alpha.toFixed(2)})`,
      'background:transparent',
      'pointer-events:none',
      'z-index:9',
      'transition:transform 0.7s ease-out, opacity 0.7s ease-out',
    ].join(';')
    document.body.appendChild(el)

    // Expand outward and fade
    setTimeout(() => {
      el.style.transform = `scale(${1.8 + Math.random() * 0.8})`
      el.style.opacity = '0'
    }, 20)
    setTimeout(() => el.remove(), 800)
  }

  destroy() {
    this._stopRipples()
    this.deactivate()
    console.log('[BoatSystem] destroyed')
  }
}


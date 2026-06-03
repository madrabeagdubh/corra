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
const REED_GIDS  = new Set([731])
const WATER_GIDS = new Set([1625, 1679])

// Pixels per second the current pulls the boat east when fully idle
const DRIFT_SPEED_PX_S = 18

// Shore tiles slow the boat to this fraction of normal speed
const SHORE_SPEED_MULT = 0.5

export default class BoatSystem {

  constructor(scene) {
    this.scene     = scene
    this.active    = false
    this._boatLost = false

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

    // Clear any queued path steps — they're tile-based and invalid in boat
    p.pathQueue = []

    // Cancel any in-progress tile-step tween immediately
    // so we don't carry over a half-completed step into boat physics
    p.isMoving    = false
    p.moveProgress = 0
    p.logicalX    = p.targetX ?? p.logicalX
    p.logicalY    = p.targetY ?? p.logicalY
    p.startX      = p.logicalX
    p.startY      = p.logicalY
    p.targetX     = p.logicalX
    p.targetY     = p.logicalY

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
      if (!pgr._boatCanvas && this.scene.textures.exists('boat')) {
        pgr.loadBoatImage(this.scene.textures.get('boat').getSourceImage())
      }
      pgr.setBoatActive(true)
    }

    this._applyTerrainModifiers()
    this._activatedAt = Date.now()

    // Add currach to inventory while aboard
    const _inv = this.scene.player?.inventory
    if (_inv) {
      const _slot = _inv.findEmptyInventorySlot()
      if (_slot !== -1) _inv.setItem(_slot, createItem('currach'))
    }

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
      p.inBoat   = false
      p.isMoving = false
      p.setTerrainSpeedModifier(1.0)
    }

    // Restore normal walk grid
    if (this.scene.walkGrid && this.scene._originalWalkGrid) {
      this.scene.walkGrid = this.scene._originalWalkGrid.map(r => [...r])
      this.scene.pathFinder?.updateGrid(this.scene.walkGrid)
    }

    if (this.scene.perspectiveGround) {
      const pgr    = this.scene.perspectiveGround
      const ts     = this.scene.tileSize
      const layer0 = this.scene.mapData.layers[0]
      const tileX  = Math.floor((p?.logicalX ?? 0) / ts)
      const tileY  = Math.floor((p?.logicalY ?? 0) / ts)
      const gid    = layer0[tileY]?.[tileX] ?? 0
      const onShore = REED_GIDS.has(gid)
      pgr._boatDrifting   = !onShore
      pgr._boatWorldX     = (p?.logicalX ?? 0)
      pgr._boatWorldY     = (p?.logicalY ?? 0)
      pgr._boatDriftSpeed = 18
      pgr._boatDriftT     = 0
      pgr.setBoatActive(false)
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
    this._noDrift = false
    console.log('[BoatSystem] deactivated -- player disembarked')
  }

  // ── Walk grid ─────────────────────────────────────────────────────────────

  _rebuildWalkGrid() {
    const scene   = this.scene
    const mapData = scene.mapData
    const layer0  = mapData.layers[0]
    const mapH    = layer0.length
    const mapW    = layer0[0].length

    scene._originalWalkGrid = scene.walkGrid.map(r => [...r])

    const newGrid = []
    for (let y = 0; y < mapH; y++) {
      newGrid[y] = []
      for (let x = 0; x < mapW; x++) {
        const gid = layer0[y]?.[x] ?? 0
        const isBoatPassable = WATER_GIDS.has(gid) || REED_GIDS.has(gid)
        if (isBoatPassable) {
          newGrid[y][x] = true
        } else {
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
        const ts             = this.scene.tileSize
        const dist           = Math.hypot(p.logicalX - pgr._boatWorldX, p.logicalY - pgr._boatWorldY)
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

    const tileX = Math.floor(p.logicalX / ts)
    const tileY = Math.floor(p.logicalY / ts)
    const gid   = layer0[tileY]?.[tileX] ?? 0

    const onReed  = REED_GIDS.has(gid)
    const onWater = WATER_GIDS.has(gid)
    const onLand  = !onReed && !onWater

    if (this._lastGid !== gid) {
      this._lastGid = gid
      console.log('[boat] tile gid:', gid, 'onReed:', onReed, 'onWater:', onWater, 'onLand:', onLand)
    }

    // Clear ALL tile-step state every frame — boat owns all movement.
    // Must clear pathQueue here AND after physics so tap-to-path
    // can never queue steps that fire when inBoat.
    p.pathQueue    = []
    p.moveProgress = 0
    p.isMoving     = false  // will be re-set below from velocity

    // Auto-disembark on land
    if (onLand) {
      if (Date.now() - (this._activatedAt ?? 0) < 800) return
      this._triggerDisembark(true)
      return
    }

    // ── Momentum physics ─────────────────────────────────────────────────
    const dt = Math.min(delta / 1000, 0.05)  // cap at 50ms

    const joystick = this.scene.joystick
    const force    = joystick?.force ?? 0
    const angle    = joystick?.angle ?? 0

    const baseMaxSpeed = onReed ? 80 : 160
        const eastCap = (this._vx > 0 && this._eastSpeedCap != null) ? this._eastSpeedCap : baseMaxSpeed
        const maxSpeed = Math.min(baseMaxSpeed, eastCap)   // logical px/s
    const impulse  = onReed ? 240 : 400   // acceleration
    const friction = onReed ? 4.0 : 2.2   // ~3s glide on water

    if (force > 10) {
      const rad = angle * Math.PI / 180
      this._vx += Math.cos(rad) * impulse * dt
      this._vy += Math.sin(rad) * impulse * dt
      const spd = Math.hypot(this._vx, this._vy)
      if (spd > maxSpeed) {
        this._vx = this._vx / spd * maxSpeed
        this._vy = this._vy / spd * maxSpeed
      }
    }

    // Hard east cap
    const _eCap = this._eastSpeedCap

    // Apply friction (exponential decay)
    const fric = Math.pow(friction, -dt)
    this._vx *= fric
    this._vy *= fric

    // Dead-stop thresholds
    if (Math.abs(this._vy) < 1.5) this._vy = 0

    // East drift on open water




if (onWater && !this._noDrift) {
  const driftSpeed = this.scene._currentDriftOverride ?? DRIFT_SPEED_PX_S
  this._vx += driftSpeed * dt





    } else {
      if (Math.abs(this._vx) < 0.5) this._vx = 0
    }

    // Integrate position
    if (this._vx !== 0 || this._vy !== 0) {
      if (Math.random() < 0.02) console.log('[boat physics] vx:', this._vx.toFixed(2), 'vy:', this._vy.toFixed(2), 'x:', p.logicalX.toFixed(1))

      const newX  = p.logicalX + this._vx * dt
      const newY  = p.logicalY + this._vy * dt
      const txNew = Math.floor(newX / ts)
      const tyNew = Math.floor(newY / ts)
      const gidX  = layer0[Math.floor(p.logicalY / ts)]?.[txNew] ?? 0
      const gidY  = layer0[tyNew]?.[Math.floor(p.logicalX / ts)] ?? 0
      const passX = WATER_GIDS.has(gidX) || REED_GIDS.has(gidX)
      const passY = WATER_GIDS.has(gidY) || REED_GIDS.has(gidY)

      if (passX) { p.logicalX = newX } else { this._vx *= -0.3 }
      if (passY) { p.logicalY = newY } else { this._vy *= -0.3 }

      const mapMaxX = (mapData.width  - 1) * ts
      const mapMaxY = (mapData.height - 1) * ts
      p.logicalX = Math.max(ts * 0.5, Math.min(mapMaxX, p.logicalX))
      p.logicalY = Math.max(ts * 0.5, Math.min(mapMaxY, p.logicalY))

      // Keep all step coords in sync — prevents tween system picking up stale values
      p.targetX    = p.logicalX
      p.targetY    = p.logicalY
      p.startX     = p.logicalX
      p.startY     = p.logicalY
      p.moveProgress = 0

      // Drive isMoving from speed for PGR animation, not from tile steps
      p.isMoving = Math.hypot(this._vx, this._vy) > 8
    } else {
      p.isMoving = false
    }

    // Final clear — ensures nothing queued during this frame survives to next
    p.pathQueue    = []
    p.moveProgress = 0
  }

  _applyDrift(delta, ts, mapData) {} // legacy, unused

  // ── Disembark ─────────────────────────────────────────────────────────────

  _triggerDisembark(boatLost = false) {
    const p = this.scene.player

    if (boatLost) {
      console.log('[BoatSystem] boat lost to current')
      this._boatLost = true
    } else {
      console.log('[BoatSystem] clean disembark on shore')
    }

    const _p      = this.scene.player
    const _ts     = this.scene.tileSize
    const _mapKey = this.scene.getMapKey?.() ?? this.scene.scene.key
    if (boatLost) {
      GameState.clearBoatPosition()
    } else {
      const _tx = Math.floor((_p?.logicalX ?? 0) / _ts)
      const _ty = Math.floor((_p?.logicalY ?? 0) / _ts)
      GameState.setBoatPosition(_mapKey, _tx, _ty)
    }

    this.deactivate()
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
    p.moveProgress = 0
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
    if (spd < 8) return

    const normX  = spd > 0 ? (this._vx ?? 0) / spd : 0
    const normY  = spd > 0 ? (this._vy ?? 0) / spd : 0
    const ts     = this.scene.tileSize
    const spread = 6
    const ox = -normX * ts * 0.4 + (Math.random() - 0.5) * spread
    const oy = -normY * ts * 0.4 + (Math.random() - 0.5) * spread

    const proj = pgr._projectLogical(p.logicalX + ox, p.logicalY + oy, true)
    if (!proj) return

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


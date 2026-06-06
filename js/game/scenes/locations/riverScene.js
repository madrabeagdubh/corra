// riverScene.js
// Location: js/game/scenes/locations/riverScene.js
//
// ── Purpose ───────────────────────────────────────────────────────────────────
// Extends PerspectiveScene with boat/river-specific behaviour.
// Use as the base class for any map where the player can board a boat.
//
// ── What lives here ───────────────────────────────────────────────────────────
//   • BoatSystem lifecycle (create, update, shutdown)
//   • Water-aware walk grid override
//   • _doDisembark() — find nearest land tile, snap player
//   • _restoreBoatOnEnter() — restore moored boat from GameState
//   • Tap validation (reject land tiles when in boat)
//   • isColliding() override — water + reeds passable in boat
//   • Disembark badge UI
//
// ── Usage ─────────────────────────────────────────────────────────────────────
//   export default class D3SeaScene extends RiverScene {
//     getMapKey()          { return 'd3_sea' }
//     getSkyImage()        { return '/assets/skies/estuary_sky.png' }
//     getMountainImage()   { return '/assets/estruaryMountains.png' }
//     getElevationConfig() { return { cliffGids: new Set([740]), ... } }
//     onEnter()            { this._restoreBoatOnEnter({ activateIfNoSave: true }) }
//   }

import BogScene from './bogScene.js'
import PathFinder from '../../systems/pathFinder.js'
import BoatSystem from '../../systems/boatSystem.js'
import { GameState } from '../../systems/gameState.js'

const WATER_GIDS = new Set([1625, 1679])
const REED_GIDS  = new Set([731])

export default class RiverScene extends BogScene {






preload() {
  super.preload()
  this.load.image('boat', '/assets/boat.png')  // adjust path from grep result
}


  async create() {
    // BoatSystem must exist BEFORE super.create() because super.create()
    // calls onEnter() at the end, and onEnter() may call boatSystem.activate().
    this.boatSystem = new BoatSystem(this)
    await super.create()
  }

  update(time, delta) {
    this._tickBoatPath()
    // Boat physics before PGR so position is current when renderer reads it
    if (this.boatSystem) this.boatSystem.update(delta)
    super.update(time, delta)
  }

  shutdown() {
    if (this.boatSystem) { this.boatSystem.destroy(); this.boatSystem = null }
    super.shutdown()
  }

  // ── Tap intercept ─────────────────────────────────────────────────────────
  // Prevent pathfinding to land tiles while in boat.
  // Also allow reboarding by tapping the drifting boat tile.

  _onTapBeforePath(canvasX, canvasY) {
    const tile = this._screenToTile(canvasX, canvasY)
    if (!tile) return false

    if (this.player?.inBoat && this.boatSystem) {
      if (!this.boatSystem.isValidBoatTarget(tile.tx, tile.ty)) return false
      // Boat tap-to-navigate
      const fromTX = Math.floor(this.player.logicalX / this.tileSize)
      const fromTY = Math.floor(this.player.logicalY / this.tileSize)
      const path   = this.pathFinder.findPath(fromTX, fromTY, tile.tx, tile.ty)

      if (path.length > 0) {
        this._setBoatPath(path)
        this._flashTargetTile(tile.tx, tile.ty)
      }
      return false
    }

    // Allow reboarding: make boat's current tile walkable
    if (!this.player?.inBoat) {
      const pgr = this.perspectiveGround
      const ts  = this.tileSize
      if (pgr?._boatWorldX != null) {
        const boatTX = Math.round(pgr._boatWorldX / ts)
        const boatTY = Math.round(pgr._boatWorldY / ts)
        if (tile.tx === boatTX && tile.ty === boatTY) {
          if (this.walkGrid[boatTY]) this.walkGrid[boatTY][boatTX] = true
        }
      }
    }
    return true
  }

  _setBoatPath(steps) {
    this._boatPath      = steps
    this._boatPathIndex = 0
    if (this.boatSystem) {
      this.boatSystem._pathTargetX = null
      this.boatSystem._pathTargetY = null
    }
  }

  _clearBoatPath() {
    this._boatPath      = null
    this._boatPathIndex = 0
    if (this.boatSystem) {
      this.boatSystem._pathTargetX = null
      this.boatSystem._pathTargetY = null
      this.boatSystem._pathForce   = 0
    }
  }

  _tickBoatPath() {
    if (!this._boatPath?.length || !this.boatSystem || !this.player) return

    const ts = this.tileSize
    const px = this.player.logicalX
    const py = this.player.logicalY

    // Check if we have a current target and whether we've reached it
    const tx = this.boatSystem._pathTargetX
    const ty = this.boatSystem._pathTargetY
    if (tx != null && ty != null) {
      const dx   = tx - px
      const dy   = ty - py
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > ts * 0.5) {
        // Still en route — keep steering
        const angle = Math.atan2(dy, dx) * 180 / Math.PI
        const isLast = this._boatPathIndex >= this._boatPath.length
        this.boatSystem._pathAngle = angle
        this.boatSystem._pathForce = isLast ? Math.min(100, dist * 1.5) : 100
        return
      }
    }

    // Reached waypoint or no target yet — advance
    if (this._boatPathIndex >= this._boatPath.length) {
      this._clearBoatPath()
      return
    }

    const step   = this._boatPath[this._boatPathIndex++]
    const fromTX = Math.floor(px / ts)
    const fromTY = Math.floor(py / ts)
    this.boatSystem._pathTargetX = (fromTX + step.dx) * ts + ts * 0.5
    this.boatSystem._pathTargetY = (fromTY + step.dy) * ts + ts * 0.5
  }

  _screenToTile(canvasX, canvasY) {
    if (!this.perspectiveGround) return null
    // PathFinder imported at top of file
    return PathFinder.screenToTile(canvasX, canvasY, this.perspectiveGround, this.tileSize)
  }

  // ── Collision override ────────────────────────────────────────────────────
  // In boat: water and reeds are passable; land blocks.

  isColliding(x, y) {
    const tx = Math.floor(x / this.tileSize)
    const ty = Math.floor(y / this.tileSize)
    if (ty < 0 || ty >= this.mapData.height || tx < 0 || tx >= this.mapData.width) return true
    if (this.player?.inBoat) {
      const g = this.mapData.layers[0]?.[ty]?.[tx]
      return !(WATER_GIDS.has(g) || REED_GIDS.has(g))
    }
    return super.isColliding(x, y)
  }

  // ── Disembark ─────────────────────────────────────────────────────────────

  _doDisembark() {
    const p   = this.player
    const ts  = this.tileSize
    const map = this.mapData.layers[0]
    const pgr = this.perspectiveGround

    // Use boat hull position, not player logical position
    const bx    = pgr?._boatWorldX ?? p.logicalX
    const by    = pgr?._boatWorldY ?? p.logicalY
    const tileX = Math.floor(bx / ts)
    const tileY = Math.floor(by / ts)

    const isWater = (g) => g === 1625 || g === 1679 || g === 731 || g === 0

    // Search expanding rings for nearest land tile
    let landTile = null
    outer: for (let r = 1; r <= 5; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
          const ttx = tileX + dx, tty = tileY + dy
          if (tty < 0 || tty >= this.mapData.height) continue
          if (ttx < 0 || ttx >= this.mapData.width)  continue
          if (!isWater(map[tty]?.[ttx] ?? 0)) { landTile = { tx: ttx, ty: tty }; break outer }
        }
      }
    }

    const boatLX = bx, boatLY = by
    const lx = landTile ? landTile.tx * ts + ts / 2 : p.logicalX
    const ly = landTile ? landTile.ty * ts + ts / 2 : p.logicalY

    this.boatSystem._triggerDisembark(false)

    // Keep boat moored at hull position, not player position
    if (pgr) {
      pgr._boatWorldX   = boatLX
      pgr._boatWorldY   = boatLY
      pgr._boatDrifting = true
      pgr._boatDriftSpeed = 0
    }

    const mapKey = this.getMapKey()
    GameState.setBoatPosition(mapKey, Math.floor(boatLX / ts), Math.floor(boatLY / ts))
    console.log(`[disembark] boat saved at [${Math.floor(boatLX/ts)},${Math.floor(boatLY/ts)}]`)

    this.time.delayedCall(500, () => {
      if (!this.player) return
      this.player.logicalX = this.player.targetX = this.player.startX = lx
      this.player.logicalY = this.player.targetY = this.player.startY = ly
      this.player.isMoving  = false
      this.player.pathQueue = []
    })
  }

  // ── Boat restore ──────────────────────────────────────────────────────────
  // Call from onEnter() to restore a previously moored boat.
  //
  //   onEnter() { this._restoreBoatOnEnter({ activateIfNoSave: true }) }
  //
  // activateIfNoSave: true  — activate boat immediately if no saved position
  //                           (use for maps where the player always arrives by boat)
  // activateIfNoSave: false — show boat as moored object only (default)

  _restoreBoatOnEnter({ activateIfNoSave = false } = {}) {
    const mapKey = this.getMapKey()
    this.time.delayedCall(500, () => {
      const saved = GameState.getBoatPosition(mapKey)
      console.log(`[_restoreBoatOnEnter] mapKey=${mapKey} saved=`, saved)
      if (!this.boatSystem || !this.perspectiveGround) return

      if (this.textures.exists('boat')) {
        this.perspectiveGround.loadBoatImage(this.textures.get('boat').getSourceImage())
      }

      if (saved) {
        const ts  = this.tileSize
        const pgr = this.perspectiveGround
        pgr._boatWorldX   = saved.tileX * ts + ts / 2
        pgr._boatWorldY   = saved.tileY * ts + ts / 2
        pgr._boatDrifting = true
        pgr._boatDriftSpeed = 0
        // Activate immediately if player spawns on boat tile
        const pTX = Math.floor(this.player.logicalX / ts)
        const pTY = Math.floor(this.player.logicalY / ts)
        if (pTX === saved.tileX && pTY === saved.tileY) this.boatSystem.activate()
        console.log(`[${mapKey}] boat restored at [${saved.tileX},${saved.tileY}]`)
      } else if (activateIfNoSave) {
        this.boatSystem.activate()
      }
    })
  }
}


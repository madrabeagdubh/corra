#!/usr/bin/env python3
"""
Run from ~/Corra:
  python3 ~/Downloads/patch_disembark2.py
"""
import sys
from pathlib import Path

# ── 1. bogLocationScene._doDisembark ─────────────────────────────────────────
# - Search from BOAT position not player position
# - Use only water+reeds as non-land (drop the old SHORE_GIDS list)
# - Add reboard cooldown flag so update() doesn't immediately reboard

BOG = Path('js/game/scenes/locations/bog/bogLocationScene.js')
txt = BOG.read_text()

old = """  _doDisembark() {
    const p   = this.player
    const ts  = this.tileSize
    const map = this.mapData.layers[0]
    const tileX = Math.floor(p.logicalX / ts)
    const tileY = Math.floor(p.logicalY / ts)
    const water = new Set([1625,1679])
    const shore = new Set([1472,1473,1474,1526,1528,1580,1581,1582,
      1635,1636,1689,1690,1742,1743,1796,1797,1852,1906,
      1958,1959,1960,2012,2013,731])

    // Search expanding rings for nearest dry land tile
    let landTile = null
    outer: for (let r = 1; r <= 4; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
          const tx = tileX + dx, ty = tileY + dy
          if (ty < 0 || ty >= this.mapData.height) continue
          if (tx < 0 || tx >= this.mapData.width) continue
          const gid = map[ty]?.[tx] ?? 0
          if (!water.has(gid) && !shore.has(gid) && gid !== 0) {
            landTile = { tx, ty }
            break outer
          }
        }
      }
    }

    if (landTile) {
      // Trigger disembark and snap player to land tile
      this.boatSystem._triggerDisembark(false)
      const lx = landTile.tx * ts + ts / 2
      const ly = landTile.ty * ts + ts / 2
      this.time.delayedCall(50, () => {
        if (!this.player) return
        this.player.logicalX = lx
        this.player.logicalY = ly
        this.player.targetX  = lx
        this.player.targetY  = ly
        this.player.startX   = lx
        this.player.startY   = ly
      })
    } else {
      // No land nearby -- just disembark in place
      this.boatSystem._triggerDisembark(false)
    }
  }"""

new = """  _doDisembark() {
    const p   = this.player
    const ts  = this.tileSize
    const map = this.mapData.layers[0]

    // Search from boat world position, not player logical position
    const pgr   = this.perspectiveGround
    const bx    = (pgr?._boatWorldX != null) ? pgr._boatWorldX : p.logicalX
    const by    = (pgr?._boatWorldY != null) ? pgr._boatWorldY : p.logicalY
    const tileX = Math.floor(bx / ts)
    const tileY = Math.floor(by / ts)

    // Land = anything that is not water (1625,1679) or reeds (731)
    const isPassable = (g) => g === 1625 || g === 1679 || g === 731 || g === 0

    // Search expanding rings for nearest land tile
    let landTile = null
    outer: for (let r = 1; r <= 5; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
          const tx = tileX + dx, ty = tileY + dy
          if (ty < 0 || ty >= this.mapData.height) continue
          if (tx < 0 || tx >= this.mapData.width) continue
          const gid = map[ty]?.[tx] ?? 0
          if (!isPassable(gid)) {
            landTile = { tx, ty }
            break outer
          }
        }
      }
    }

    // Prevent reboard: stop the drifting boat from triggering reboard check
    if (pgr) {
      pgr._boatWorldX = null
      pgr._boatWorldY = null
      pgr._boatDrifting = false
    }

    this.boatSystem._triggerDisembark(false)

    const lx = landTile
      ? landTile.tx * ts + ts / 2
      : p.logicalX
    const ly = landTile
      ? landTile.ty * ts + ts / 2
      : p.logicalY

    // Snap player to land after deactivate settles
    this.time.delayedCall(80, () => {
      if (!this.player) return
      this.player.logicalX = lx
      this.player.logicalY = ly
      this.player.targetX  = lx
      this.player.targetY  = ly
      this.player.startX   = lx
      this.player.startY   = ly
      this.player.isMoving = false
      this.player.pathQueue = []
    })
  }"""

if old in txt:
    txt = txt.replace(old, new, 1)
    print('[bogLocationScene.js] patched: _doDisembark')
else:
    print('[bogLocationScene.js] WARNING: _doDisembark not found', file=sys.stderr)

BOG.write_text(txt)

# ── 2. boatSystem.update() -- reboard check: require player to be still
#    and add a minimum time after disembark before reboard is possible
BOAT = Path('js/game/systems/boatSystem.js')
txt = BOAT.read_text()

old = """    if (!this.active) {
      const pgr = this.scene.perspectiveGround
      if (pgr?._boatWorldX != null) {
        const ts     = this.scene.tileSize
        const dist = Math.hypot(p.logicalX - pgr._boatWorldX, p.logicalY - pgr._boatWorldY)
        if (dist < ts * 0.8 && !p.isMoving) {
          this._reboard(p, pgr)
        }
      }
      return
    }"""

new = """    if (!this.active) {
      const pgr = this.scene.perspectiveGround
      if (pgr?._boatWorldX != null) {
        const ts   = this.scene.tileSize
        const dist = Math.hypot(p.logicalX - pgr._boatWorldX, p.logicalY - pgr._boatWorldY)
        // Reboard only if: player walked back onto boat tile, not moving,
        // and at least 1.5s since last disembark (prevents snap-back)
        const sinceDisembark = Date.now() - (this._deactivatedAt ?? 0)
        if (dist < ts * 0.6 && !p.isMoving && sinceDisembark > 1500) {
          this._reboard(p, pgr)
        }
      }
      return
    }"""

if old in txt:
    txt = txt.replace(old, new, 1)
    print('[boatSystem.js] patched: reboard cooldown')
else:
    print('[boatSystem.js] WARNING: reboard check not found', file=sys.stderr)

# Record deactivation time so reboard cooldown works
old2 = """  deactivate() {
    if (!this.active) return
    this.active = false"""

new2 = """  deactivate() {
    if (!this.active) return
    this.active = false
    this._deactivatedAt = Date.now()"""

if old2 in txt:
    txt = txt.replace(old2, new2, 1)
    print('[boatSystem.js] patched: _deactivatedAt timestamp')
else:
    print('[boatSystem.js] WARNING: deactivate() header not found', file=sys.stderr)

BOAT.write_text(txt)

# ── 3. perspectiveGroundRenderer -- tile highlight uses player.logicalX/Y
#    always (not _boatWorldX/Y which is null while active and stale after)
PGR = Path('js/game/effects/perspectiveGroundRenderer.js')
txt = PGR.read_text()

old3 = """      const _hlLX = (this._boatActive && this._boatScreenX != null)
        ? this._boatWorldX ?? p.logicalX
        : p.logicalX
      const _hlLY = (this._boatActive && this._boatScreenY != null)
        ? this._boatWorldY ?? p.logicalY
        : p.logicalY"""

new3 = """      // Highlight always tracks player logical position (canonical world coords)
      const _hlLX = p.logicalX
      const _hlLY = p.logicalY"""

if old3 in txt:
    txt = txt.replace(old3, new3, 1)
    print('[perspectiveGroundRenderer.js] patched: tile highlight position')
else:
    print('[perspectiveGroundRenderer.js] WARNING: highlight block not found', file=sys.stderr)

PGR.write_text(txt)

print('\nDone.')

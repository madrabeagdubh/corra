#!/usr/bin/env python3
"""
Run from ~/Corra:
  python3 ~/Downloads/patch_boat_pos.py
"""
import sys
from pathlib import Path

BOG = Path('js/game/scenes/locations/bog/bogLocationScene.js')
txt = BOG.read_text()

old = """    // Trigger disembark -- deactivate() uses pgr._boatWorldX/Y to set drift position
    // so we must NOT null them before calling it. Clear them after.
    this.boatSystem._triggerDisembark(false)

    // Now prevent immediate reboard by clearing the drift world position
    // (deactivate has already stored it; PGR drift rendering uses _boatDrifting flag)
    this.time.delayedCall(200, () => {
      // Leave _boatWorldX/Y intact so drift animation runs.
      // Reboard cooldown (_deactivatedAt) already prevents snap-back.
    })

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
    })"""

new = """    // Capture boat's reed position BEFORE deactivate() overwrites it with player pos
    const boatLX = bx
    const boatLY = by

    const lx = landTile
      ? landTile.tx * ts + ts / 2
      : p.logicalX
    const ly = landTile
      ? landTile.ty * ts + ts / 2
      : p.logicalY

    // Trigger disembark (deactivate sets pgr._boatWorldX/Y from player pos)
    this.boatSystem._triggerDisembark(false)

    // Override boat world position to the reed tile where the hull actually is
    const pgr2 = this.perspectiveGround
    if (pgr2) {
      pgr2._boatWorldX  = boatLX
      pgr2._boatWorldY  = boatLY
      pgr2._boatDrifting = false   // moored in reeds, no drift
    }

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
    })"""

if old in txt:
    txt = txt.replace(old, new, 1)
    print('[bogLocationScene.js] patched: boat position fixed at disembark')
else:
    print('[bogLocationScene.js] WARNING: not found', file=sys.stderr)

BOG.write_text(txt)
print('Done.')

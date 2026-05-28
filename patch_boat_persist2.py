#!/usr/bin/env python3
"""
Run from ~/Corra:
  python3 ~/Downloads/patch_boat_persist2.py
"""
import sys
from pathlib import Path

# ── 1. bogLocationScene._doDisembark -- actually save boat position ───────────
BOG = Path('js/game/scenes/locations/bog/bogLocationScene.js')
txt = BOG.read_text()

# Find the pgr2 block and add save after it
old = """      pgr2._boatDrifting = true    // keeps draw condition true
      pgr2._boatDriftSpeed = 0     // moored in reeds -- visible but no movement
    }

    // Snap player to land after deactivate settles"""

new = """      pgr2._boatDrifting = true    // keeps draw condition true
      pgr2._boatDriftSpeed = 0     // moored in reeds -- visible but no movement
    }

    // Persist boat's reed tile so it survives map transitions
    const _mapKey = this.getMapKey?.() ?? this.scene.key
    const _btx = Math.floor(boatLX / ts)
    const _bty = Math.floor(boatLY / ts)
    GameState.setBoatPosition(_mapKey, _btx, _bty)
    console.log(`[disembark] boat saved at [${_btx},${_bty}] on ${_mapKey}`)

    // Snap player to land after deactivate settles"""

if old in txt:
    txt = txt.replace(old, new, 1)
    print('[bogLocationScene.js] patched: setBoatPosition saved')
else:
    print('[bogLocationScene.js] WARNING: pgr2 block not found', file=sys.stderr)

BOG.write_text(txt)

# ── 2. d3.js onEnter -- fix restore (_boatDrifting true + speed 0) ──────────
D3 = Path('js/game/scenes/locations/bog/d3.js')
txt = D3.read_text()

old = """      if (saved) {
        // Restore moored boat at saved position
        const ts = this.tileSize
        const pgr = this.perspectiveGround
        pgr._boatWorldX  = saved.tileX * ts + ts / 2
        pgr._boatWorldY  = saved.tileY * ts + ts / 2
        pgr._boatDrifting = false
        // If player is on the same tile, board it
        const pTX = Math.floor(this.player.logicalX / ts)
        const pTY = Math.floor(this.player.logicalY / ts)
        if (pTX === saved.tileX && pTY === saved.tileY) {
          this.boatSystem.activate()
        }
        console.log(`[d3] boat restored at [${saved.tileX},${saved.tileY}]`)
      } else if (fromEast) {
        // Fresh arrival -- player starts in boat
        this.boatSystem.activate()
      }"""

new = """      if (saved) {
        // Restore moored boat at saved reed position
        const ts  = this.tileSize
        const pgr = this.perspectiveGround
        pgr._boatWorldX   = saved.tileX * ts + ts / 2
        pgr._boatWorldY   = saved.tileY * ts + ts / 2
        pgr._boatDrifting = true   // visible
        pgr._boatDriftSpeed = 0    // moored -- no movement
        // If player is on the same tile, board it
        const pTX = Math.floor(this.player.logicalX / ts)
        const pTY = Math.floor(this.player.logicalY / ts)
        if (pTX === saved.tileX && pTY === saved.tileY) {
          this.boatSystem.activate()
        }
        console.log(`[d3] boat restored at [${saved.tileX},${saved.tileY}]`)
      } else if (fromEast) {
        // Fresh arrival from east -- player starts in boat
        this.boatSystem.activate()
      } else if (edge === 'west' || edge === 'north' || edge === 'south') {
        // Arrived by walking -- check if boat should be drifting in from east
        // (player left by land, boat drifts with current)
        // No boat on arrival unless saved position exists
      }"""

if old in txt:
    txt = txt.replace(old, new, 1)
    print('[d3.js] patched: boat restore uses drifting=true/speed=0')
else:
    print('[d3.js] WARNING: onEnter saved block not found', file=sys.stderr)

D3.write_text(txt)

# ── 3. bogLocationScene -- add _restoreBoat() helper for all river maps ──────
# Insert a shared onEnter boat-restore method into bogLocationScene
# so any river map (c3, d2, d4 etc) can call this._restoreBoatOnEnter()
BOG = Path('js/game/scenes/locations/bog/bogLocationScene.js')
txt = BOG.read_text()

HELPER = """
  // ── Shared boat restore for all river maps ───────────────────────────────
  // Call from onEnter() in any river map scene.
  // Restores moored boat from GameState, or activates if arriving by boat.
  _restoreBoatOnEnter(opts = {}) {
    const { activateIfNoSave = false } = opts
    const mapKey = this.getMapKey?.() ?? this.scene.key
    const saved  = GameState.getBoatPosition(mapKey)
    this.time.delayedCall(80, () => {
      if (!this.boatSystem || !this.perspectiveGround) return
      if (this.textures.exists('boat')) {
        this.perspectiveGround.loadBoatImage(
          this.textures.get('boat').getSourceImage()
        )
      }
      if (saved) {
        const ts  = this.tileSize
        const pgr = this.perspectiveGround
        pgr._boatWorldX   = saved.tileX * ts + ts / 2
        pgr._boatWorldY   = saved.tileY * ts + ts / 2
        pgr._boatDrifting = true
        pgr._boatDriftSpeed = 0
        const pTX = Math.floor(this.player.logicalX / ts)
        const pTY = Math.floor(this.player.logicalY / ts)
        if (pTX === saved.tileX && pTY === saved.tileY) {
          this.boatSystem.activate()
        }
        console.log(`[${mapKey}] boat restored at [${saved.tileX},${saved.tileY}]`)
      } else if (activateIfNoSave) {
        this.boatSystem.activate()
      }
    })
  }

"""

# Insert before the closing of the class (before last })
if '_restoreBoatOnEnter' not in txt:
    # Insert before checkExits or shutdown
    target = '  // ── Exits'
    if target in txt:
        txt = txt.replace(target, HELPER + '  // ── Exits', 1)
        print('[bogLocationScene.js] patched: _restoreBoatOnEnter() helper added')
    else:
        print('[bogLocationScene.js] WARNING: insertion point not found', file=sys.stderr)
else:
    print('[bogLocationScene.js] _restoreBoatOnEnter already present')

BOG.write_text(txt)

print('\nDone.')

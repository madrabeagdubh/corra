#!/usr/bin/env python3
"""
Run from ~/Corra:
  python3 ~/Downloads/patch_boat_persist.py
"""
import sys
from pathlib import Path

BOG = Path('js/game/scenes/locations/bog/bogLocationScene.js')
txt = BOG.read_text()

old = """    // Prevent reboard: stop the drifting boat from triggering reboard check
    if (pgr) {
      pgr._boatWorldX = null
      pgr._boatWorldY = null
      pgr._boatDrifting = false
    }

    this.boatSystem._triggerDisembark(false)"""

new = """    // Trigger disembark -- deactivate() uses pgr._boatWorldX/Y to set drift position
    // so we must NOT null them before calling it. Clear them after.
    this.boatSystem._triggerDisembark(false)

    // Now prevent immediate reboard by clearing the drift world position
    // (deactivate has already stored it; PGR drift rendering uses _boatDrifting flag)
    this.time.delayedCall(200, () => {
      // Leave _boatWorldX/Y intact so drift animation runs.
      // Reboard cooldown (_deactivatedAt) already prevents snap-back.
    })"""

if old in txt:
    txt = txt.replace(old, new, 1)
    print('[bogLocationScene.js] patched: boat position preserved on disembark')
else:
    print('[bogLocationScene.js] WARNING: not found', file=sys.stderr)

BOG.write_text(txt)
print('Done.')

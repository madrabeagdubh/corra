#!/usr/bin/env python3
"""
Run from ~/Corra:
  python3 ~/Downloads/patch_disembark.py
"""
import sys
from pathlib import Path

# ── 1. boatSystem.js -- remove textPanel notification ────────────────────────
f = Path('js/game/systems/boatSystem.js')
txt = f.read_text()

old = """    // Brief narrative beat
    if (this.scene.textPanel) {
      const text = boatLost
        ? { irish: 'Imigh an bád leis an sruth.', english: 'The boat drifted away with the current.' }
        : { irish: 'Chuala mé an abhainn fúm.', english: 'I felt the riverbed beneath me.' }
      this.scene.time.delayedCall(300, () => {
        this.scene.textPanel.show({ ...text, type: 'notification' })
      })
    }"""

new = """    // Disembark is a silent action -- no textPanel notification"""

if old in txt:
    txt = txt.replace(old, new, 1)
    print('[boatSystem.js] patched: removed textPanel notification')
else:
    print('[boatSystem.js] WARNING: notification block not found', file=sys.stderr)

f.write_text(txt)

# ── 2. bogLocationScene.js -- _onMoonTap no longer double-fires ──────────────
f2 = Path('js/game/scenes/locations/bog/bogLocationScene.js')
txt2 = f2.read_text()

old2 = """  if (this._encounterPanel?._card?.id === 'disembark') {
    this._encounterPanel.clearNotify()
    this._disembarkBadgeShown = false
    if (this.boatSystem) this._doDisembark()
    return
  }"""

new2 = """  if (this._encounterPanel?._card?.id === 'disembark') {
    // encounterPanel badge pointerdown already called _doDisembark -- just clear state
    this._encounterPanel.clearNotify()
    this._disembarkBadgeShown = false
    return
  }"""

if old2 in txt2:
    txt2 = txt2.replace(old2, new2, 1)
    print('[bogLocationScene.js] patched: _onMoonTap no longer double-fires _doDisembark')
else:
    print('[bogLocationScene.js] WARNING: _onMoonTap disembark block not found', file=sys.stderr)

f2.write_text(txt2)

print('\nDone.')

#!/usr/bin/env python3
"""
Run from ~/Corra:
  python3 ~/Downloads/patch_polish1.py

Quick wins:
  1. Deboard badge icon: GID 1625 -> 1411
  2. Tile highlight hidden when inBoat
  3. Player sits higher on boat (Y offset adjustment)
"""
import sys
from pathlib import Path

def patch(path, old, new, label):
    f = Path(path)
    txt = f.read_text()
    if old in txt:
        f.write_text(txt.replace(old, new, 1))
        print(f'[{f.name}] patched: {label}')
    else:
        print(f'[{f.name}] WARNING not found: {label}', file=sys.stderr)

# ── 1. Deboard badge icon ─────────────────────────────────────────────────────
patch(
    'js/game/scenes/locations/baseLocationScene.js',
    "{ id: 'disembark', visual: { gid: 1625, flat: true },",
    "{ id: 'disembark', visual: { gid: 1411, flat: true },",
    'deboard badge icon GID 1625 -> 1411'
)

# ── 2. Hide tile highlight when inBoat ───────────────────────────────────────
patch(
    'js/game/effects/perspectiveGroundRenderer.js',
    """    // Highlight always tracks player logical position (canonical world coords)
      const _hlLX = p.logicalX
      const _hlLY = p.logicalY""",
    """    // Highlight hidden when in boat (boat hull covers it)
      // Only show when on foot
      if (this._boatActive) return
      const _hlLX = p.logicalX
      const _hlLY = p.logicalY""",
    'hide tile highlight when inBoat'
)

# ── 3. Player sits higher on boat ────────────────────────────────────────────
# _boatSinkOverride controls how much of the player legs are hidden behind hull
# Currently 0.55 -- reduce to 0.35 so player rides higher / more visible above gunwale
patch(
    'js/game/effects/perspectiveGroundRenderer.js',
    """    if (active) {
      this._boatSinkOverride = 0.55
    } else {
      this._boatSinkOverride = 0
    }""",
    """    if (active) {
      this._boatSinkOverride = 0.32   // player sits higher -- waist at gunwale
    } else {
      this._boatSinkOverride = 0
    }""",
    'player sits higher on boat (sinkOverride 0.55 -> 0.32)'
)

print('\nDone.')

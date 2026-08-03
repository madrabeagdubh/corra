#!/usr/bin/env python3
"""
fix_walker_shadow.py -- Corra: ReferenceError in _updateWalkers.

  ReferenceError: cannot access 'px' before initialization

_updateWalkers() declared the player's position as `px`/`py` outside the
loop, and further down INSIDE the loop body declared `const px = tx * ts +
ts / 2` for the zone's pixel position. `const` is block-scoped and hoisted
into a temporal dead zone, so the inner declaration shadows the outer one
for the entire block -- including the proximity check that runs before it.
Reading px there throws.

Renames the player's coordinates to playerX / playerY. No behaviour change.

Run from the repo root:  python3 fix_walker_shadow.py
Idempotent; reports and exits cleanly if already fixed.
"""
import io, os, sys

P = os.path.join(os.getcwd(), 'js/game/scenes/locations/bogScene.js')
src = io.open(P, encoding='utf-8').read()

OLD_DECL = """    const px = this.player?.logicalX
    const py = this.player?.logicalY"""
NEW_DECL = """    // NOT px/py: the loop body below declares its own `const px` for the
    // zone position, which shadows this for the whole block and puts the
    // proximity check in a temporal dead zone.
    const playerX = this.player?.logicalX
    const playerY = this.player?.logicalY"""

OLD_USE = """        if (px == null) continue
        const d = Phaser.Math.Distance.Between(px, py, w.zone.x, w.zone.y)"""
NEW_USE = """        if (playerX == null) continue
        const d = Phaser.Math.Distance.Between(playerX, playerY, w.zone.x, w.zone.y)"""

if 'const playerX = this.player?.logicalX' in src:
    print('Nothing to fix -- already using playerX/playerY.')
    sys.exit(0)

missing = [n for n, t in (('declaration', OLD_DECL), ('usage', OLD_USE)) if t not in src]
if missing:
    print('! Could not find: %s' % ', '.join(missing))
    print('  Check _updateWalkers() in js/game/scenes/locations/bogScene.js by hand:')
    print('  the player coords must not be named px/py, because the loop body')
    print('  declares its own px/py for the zone position.')
    sys.exit(1)

src = src.replace(OLD_DECL, NEW_DECL, 1).replace(OLD_USE, NEW_USE, 1)
io.open(P, 'w', encoding='utf-8').write(src)
print('Fixed: player coords renamed to playerX / playerY.')

#!/usr/bin/env python3
"""
patch_tiltshift_follow.py — make the sharp band follow the player, and keep
near buildings sharp.

Run AFTER patch_tiltshift.py and patch_tiltshift_all.py, and AFTER replacing
js/game/effects/tiltShift.js with the v1.1 module. Idempotent.

Fixes the village-map problem: a tall building close to the player still
occupies rows near the top of the screen, so a fixed top-of-screen blur band
left it permanently soft.

Edits:
  js/game/effects/perspectiveGroundRenderer.js
    1. reset pgr._tsSpans at the start of each frame

  js/game/effects/pgr/pgrBuildings.js
    2. record each drawn building's screen top + base into pgr._tsSpans
       (reuses the `boundary` polygon the tint pass already computes, so
        there is no extra geometry work)

  js/game/scenes/locations/perspectiveScene.js
    3. call tiltShift.update() each frame, after perspectiveGround.update()

Run from the repo root:  python3 patch_tiltshift_follow.py
"""

import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PGR = os.path.join(ROOT, 'js/game/effects/perspectiveGroundRenderer.js')
BLD = os.path.join(ROOT, 'js/game/effects/pgr/pgrBuildings.js')
PS  = os.path.join(ROOT, 'js/game/scenes/locations/perspectiveScene.js')

applied = []
already = []

for p in (PGR, BLD, PS):
    if not os.path.exists(p):
        sys.exit('!! missing: %s\n   run this from the repo root (~/Corra)' % p)


def edit(path, label, anchor, replacement, marker):
    with open(path, 'r', encoding='utf-8') as f:
        src = f.read()

    if marker in src:
        already.append(label)
        return

    if anchor not in src:
        sys.exit('!! anchor not found for %s\n   looked for: %r' % (label, anchor[:80]))

    if src.count(anchor) > 1:
        sys.exit('!! anchor is ambiguous for %s (%d matches)' % (label, src.count(anchor)))

    with open(path, 'w', encoding='utf-8') as f:
        f.write(src.replace(anchor, replacement, 1))
    applied.append(label)


# -- 1. per-frame reset ------------------------------------------------------
A = """    const p = this._player
    let playerTileRow = -1
    let playerScreenX = sw / 2"""
B = """    // Screen extents of buildings drawn this frame, consumed by TiltShift so
    // it can keep near buildings out of the distance blur. Cleared each frame.
    this._tsSpans = []

    const p = this._player
    let playerTileRow = -1
    let playerScreenX = sw / 2"""
edit(PGR, 'PGR: reset _tsSpans each frame', A, B, marker="this._tsSpans = []")


# -- 2. record building spans ------------------------------------------------
A = """    if (boundary && boundary.length) {
      const bTint = pgr.tintManager.getTint(b.tintGid ?? 197, b.x, b.y)"""
B = """    if (boundary && boundary.length) {
      // Screen extent for TiltShift. `top` is the roofline, `base` the
      // footprint row -- distance is judged by base, sharpness applied to top.
      let _tsTop = Infinity
      for (let _i = 0; _i < boundary.length; _i++) {
        if (boundary[_i].y < _tsTop) _tsTop = boundary[_i].y
      }
      if (pgr._tsSpans) pgr._tsSpans.push({ top: _tsTop, base: yBase })

      const bTint = pgr.tintManager.getTint(b.tintGid ?? 197, b.x, b.y)"""
edit(BLD, 'pgrBuildings: record screen spans', A, B, marker="pgr._tsSpans.push")


# -- 3. drive update ---------------------------------------------------------
A = "if (this.perspectiveGround) this.perspectiveGround.update()"
B = ("if (this.perspectiveGround) this.perspectiveGround.update()\n"
     "    if (this.tiltShift) this.tiltShift.update(this.perspectiveGround)")
edit(PS, 'perspectiveScene: drive tiltShift.update()', A, B,
     marker="this.tiltShift.update(")


print('\n=== patch_tiltshift_follow.py ===')
for c in applied:
    print('  applied : %s' % c)
for s in already:
    print('  already : %s' % s)
if not applied:
    print('  nothing to do -- already patched')
print()

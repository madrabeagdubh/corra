#!/usr/bin/env python3
"""
patch_tiltshift.py — wire TiltShift into PerspectiveScene, opt-in per map.

Idempotent: safe to run repeatedly.

Edits:
  js/game/scenes/locations/perspectiveScene.js
    1. import TiltShift
    2. getTiltShift() hook — returns false by default (effect OFF everywhere)
    3. construct it inside the usePerspective block, after the PGR exists
    4. destroy it in shutdown()

  js/game/scenes/locations/bog/d3Sea.js
    5. getTiltShift() override — turns the effect ON for the estuary only

Every map except d3_sea is left behaviourally identical: getTiltShift() returns
false, so no DOM elements are created at all.

Run from the repo root:  python3 patch_tiltshift.py
"""

import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PS = os.path.join(ROOT, 'js/game/scenes/locations/perspectiveScene.js')
D3 = os.path.join(ROOT, 'js/game/scenes/locations/bog/d3Sea.js')

applied = []
already = []

for p in (PS, D3):
    if not os.path.exists(p):
        sys.exit('!! missing: %s\n   run this from the repo root (~/Corra)' % p)


def edit(path, label, anchor, replacement, marker):
    """Replace `anchor` with `replacement`. Skips if `marker` already present."""
    with open(path, 'r', encoding='utf-8') as f:
        src = f.read()

    if marker in src:
        already.append(label)
        return

    if anchor not in src:
        sys.exit('!! anchor not found for %s\n   looked for: %r' % (label, anchor[:70]))

    with open(path, 'w', encoding='utf-8') as f:
        f.write(src.replace(anchor, replacement, 1))
    applied.append(label)


# -- 1. import ---------------------------------------------------------------
A = "import ForestEffects         from '../../effects/forestEffects.js'"
edit(PS, 'perspectiveScene: import',
     A,
     A + "\nimport { TiltShift }         from '../../effects/tiltShift.js'",
     marker="effects/tiltShift.js")


# -- 2. hook, default OFF ----------------------------------------------------
# Mirrors usesSwallows() / getSkyImage(): a map opts in by overriding this.
A = "  applyEntryPosition() {"
HOOK = """  // Tilt-shift / depth-of-field. Off by default; a map opts in by overriding
  // this to return an options object (full list in effects/tiltShift.js).
  // Returning false creates no DOM elements at all.
  getTiltShift() { return false }

"""
edit(PS, 'perspectiveScene: getTiltShift() hook',
     A, HOOK + A,
     marker="getTiltShift()")


# -- 3. construction ---------------------------------------------------------
A = """        this.perspectiveGround.setMountainImage(mtnUrl, mtnPos)
      }
    }
  }"""
B = """        this.perspectiveGround.setMountainImage(mtnUrl, mtnPos)
      }

      // Tilt-shift overlays sit at z:5-6 -- above every PGR world canvas
      // (sky z:0, ground z:2, objects z:3, light z:4) and below the Phaser
      // canvas at z:10, so the UI is never blurred.
      if (this.tiltShift) { this.tiltShift.destroy(); this.tiltShift = null }
      const tsOpts = this.getTiltShift?.()
      if (tsOpts) {
        this.tiltShift = new TiltShift(this, {
          pgr: this.perspectiveGround,
          ...tsOpts
        })
      }
    }
  }"""
edit(PS, 'perspectiveScene: construct TiltShift',
     A, B,
     marker="new TiltShift(this")


# -- 4. shutdown -------------------------------------------------------------
# NOTE: this marker must be distinct from anything step 3 inserts, or the step
# gets silently skipped on a fresh run.
A = "    if (this.forestEffects)     { this.forestEffects.destroy();         this.forestEffects    = null }"
edit(PS, 'perspectiveScene: shutdown cleanup',
     A,
     A + "\n    if (this.tiltShift)         { this.tiltShift.destroy();             this.tiltShift        = null }",
     marker="this.tiltShift        = null")


# -- 5. d3Sea opts in --------------------------------------------------------
A = "  getMountainPosition()    { return '50% 100%' }"
B = A + """

  // Estuary: wide water and a far horizon, so this map shows depth cues best.
  // Tune live in the console:
  //   game.scene.getScene('d3_sea').tiltShift.configure({ farBlur: 6 })
  getTiltShift() {
    return {
      focusY:      0.62,
      focusHeight: 0.20,
      farBlur:     4,
      nearBlur:    2,
      hazeAmount:  0.16,
      hazeColor:   '#9fb2c4',
      vignette:    0.22
    }
  }"""
edit(D3, 'd3Sea: getTiltShift() override',
     A, B,
     marker="getTiltShift()")


print('\n=== patch_tiltshift.py ===')
for c in applied:
    print('  applied : %s' % c)
for s in already:
    print('  already : %s' % s)
if not applied:
    print('  nothing to do -- already patched')
print()

#!/usr/bin/env python3
"""
patch_tiltshift_all.py — turn the tilt-shift on for every perspective map.

Run AFTER patch_tiltshift.py. Idempotent.

Edits:
  js/game/scenes/locations/perspectiveScene.js
    1. getTiltShift() now returns default options instead of false, so every
       map that doesn't override it gets the effect.

  js/game/scenes/locations/bog/d3Sea.js
    2. Removes the per-map override, which now just duplicates the base
       defaults. One source of truth.

To switch a single map back off, add to that scene:

    getTiltShift() { return false }

To tweak one map rather than disable it, spread the base and override:

    getTiltShift() { return { ...super.getTiltShift(), farBlur: 7 } }

Run from the repo root:  python3 patch_tiltshift_all.py
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
    with open(path, 'r', encoding='utf-8') as f:
        src = f.read()

    if marker in src:
        already.append(label)
        return

    if anchor not in src:
        sys.exit('!! anchor not found for %s\n'
                 '   looked for: %r\n'
                 '   (did patch_tiltshift.py run first?)' % (label, anchor[:70]))

    with open(path, 'w', encoding='utf-8') as f:
        f.write(src.replace(anchor, replacement, 1))
    applied.append(label)


# -- 1. base default: on ------------------------------------------------------
A = """  // Tilt-shift / depth-of-field. Off by default; a map opts in by overriding
  // this to return an options object (full list in effects/tiltShift.js).
  // Returning false creates no DOM elements at all.
  getTiltShift() { return false }"""

B = """  // Tilt-shift / depth-of-field. On by default for every perspective map.
  // Full option list in effects/tiltShift.js.
  //
  // A map turns it off with:      getTiltShift() { return false }
  // A map tweaks it with:         getTiltShift() { return { ...super.getTiltShift(), farBlur: 7 } }
  //
  // Enclosed maps (forest interiors, indoor scenes) have little real distance
  // for the haze to describe -- if it reads as a flat wash there, override
  // hazeAmount down or return false.
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

edit(PS, 'perspectiveScene: default ON',
     A, B,
     marker="On by default for every perspective map")


# -- 2. drop the now-redundant d3Sea override --------------------------------
A = """
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
  }
"""

with open(D3, 'r', encoding='utf-8') as f:
    _d3 = f.read()

if 'getTiltShift()' not in _d3:
    already.append('d3Sea: override removed')
elif A in _d3:
    with open(D3, 'w', encoding='utf-8') as f:
        f.write(_d3.replace(A, '', 1))
    applied.append('d3Sea: override removed')
else:
    print('  note: d3Sea getTiltShift() was edited by hand -- left alone')


print('\n=== patch_tiltshift_all.py ===')
for c in applied:
    print('  applied : %s' % c)
for s in already:
    print('  already : %s' % s)
if not applied:
    print('  nothing to do -- already patched')
print()

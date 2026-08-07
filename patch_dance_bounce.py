#!/usr/bin/env python3
"""
patch_dance_bounce.py

Adds squash-and-stretch to the portrait dance. Your removal of the rotation and
the hop at 14px are kept exactly as they are.

Run from the repo root:

    python3 patch_dance_bounce.py

Idempotent. One file: js/game/ui/textPanel.js

WHY THIS AND NOT ROTATION

Your note in _dance is right and this doesn't touch it. What's missing is the
part that reads as jolly: a hop alone is a lift, whereas a hop with a crouch
before it and a stretch at the top is a jump.

The top-centre origin turns out to be an advantage here rather than the
obstacle it was for rotation. Scaling Y down keeps the head still and brings the
feet up, so a squash looks like a crouch instead of the figure being flattened
-- which is how a jump gets drawn.

The base scale is captured at build time, not read at the start of each dance:
setDisplaySize has already scaled the image, so reading scaleY off a portrait
mid-dance would compound a little further out of true on every hop.
"""

import io, os, sys

UI = os.path.join('js', 'game', 'ui', 'textPanel.js')
MARKER = 'baseScaleY'

def die(m):
    print('  !! ' + m); sys.exit(1)

def once(s, old, new, label):
    if s.count(old) != 1:
        die('expected 1 match for %s, found %d' % (label, s.count(old)))
    print('  -- ' + label)
    return s.replace(old, new, 1)

OLD_C = """const CARD_DANCE_HOP_PX    = 14"""
NEW_C = """const CARD_DANCE_HOP_PX    = 14
// A hop alone is a lift; a hop with a crouch under it is a jump. With the
// origin at top-centre a squash keeps the head still and brings the feet up,
// so it reads as crouching rather than as being flattened -- the same anchor
// that made rotation useless makes this work.
const CARD_DANCE_CROUCH    = 0.90    // scaleY multiplier on the ground
const CARD_DANCE_STRETCH   = 1.06    // scaleY multiplier at the apex"""

OLD_P = """          isPortrait: true, isHero: !!row.isHero, bob: 0,
        })"""
NEW_P = """          isPortrait: true, isHero: !!row.isHero, bob: 0,
          // Captured now, not read at the start of each dance: setDisplaySize
          // has already scaled the image, and tweening from whatever scaleY
          // happens to be mid-dance compounds out of true every hop.
          baseScaleY: img.scaleY,
        })"""

OLD_D = """    const hops = Math.max(1, Math.round(durationMs / stepMs))
    item.bob = 0"""
NEW_D = """    const hops = Math.max(1, Math.round(durationMs / stepMs))
    const half = Math.round(stepMs / 2)
    const base = item.baseScaleY || item.obj.scaleY || 1
    item.bob = 0"""

OLD_R = """        if (item.obj?.active) item.obj.setFlipX(false)
        this._applyScroll()
      },
    }))"""
NEW_R = """        if (item.obj?.active) {
          item.obj.setFlipX(false)
          item.obj.scaleY = base
        }
        this._applyScroll()
      },
    }))

    // Crouch on the ground, stretch at the apex.
    this._revealTweens.push(this.scene.tweens.add({
      targets: item.obj,
      scaleY: { from: base * CARD_DANCE_CROUCH, to: base * CARD_DANCE_STRETCH },
      duration: half,
      yoyo: true,
      repeat: hops - 1,
      ease: 'Sine.easeInOut',
    }))"""

def main():
    if not os.path.isfile(UI):
        die('%s not found -- run from the repo root.' % UI)
    s = io.open(UI, encoding='utf-8').read()
    if MARKER in s:
        print('Already patched -- nothing to do.'); return
    if 'CARD_DANCE_HOP_PX    = 14' not in s:
        die('expected your hop value of 14 -- adjust OLD_C if you have changed it again.')
    print('Patching ' + UI)
    s = once(s, OLD_C, NEW_C, 'crouch/stretch constants')
    s = once(s, OLD_P, NEW_P, 'capture the base scale')
    s = once(s, OLD_D, NEW_D, 'dance locals')
    s = once(s, OLD_R, NEW_R, 'squash tween')
    io.open(UI, 'w', encoding='utf-8').write(s)
    print('Done.')

main()

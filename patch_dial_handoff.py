#!/usr/bin/env python3
"""
patch_dial_handoff.py — hand the ogham dial's moon straight to the moon widget.

Prerequisites: introOghamDial.js (v6) in js/, patch_ogham_intro.py and
patch_moonphase_seed.py already run.
Idempotent.

WHAT CHANGES
  The Amergin opening — a random looping line, a moon parked at 35vh, and a
  swipe that unlocked audio, went fullscreen and drifted the moon down — is
  replaced by the dial. The dial has already done the poem and already taken
  the first touch, so by the time the scene starts:

    - the player has set a moon phase, which arrives as startPhase
    - audio has been unlocked (the dial's first touch did it)
    - the dial's moon has been pulled back to exactly the widget's rest
      position and size, so the widget appears where the moon already is

  The scene therefore skips its own opening: no Amergin overlay, no lyric
  interval, no drift tween. The moon is created AT REST and the druid's speech
  about reading the stars follows immediately.

  Nothing is deleted. The old path still runs when startPhase is absent, so
  the scene works standalone exactly as before.

WHY THE HANDOFF LOOKS SEAMLESS
  The dial computes its target from the same numbers moonWidget and introModal
  use — moonR = max(24, round(min(vw,vh)*0.055)), wrapperH = moonD + 36, rest
  centre = H - 120 - wrapperH/2. Measured on a 400x800 screen: the moon lands
  at (200, 638) at 48px, which is where createMoonWidget puts it, to the pixel.

Edits:
  js/introModal.js
    1. _dialRan flag from the registry
    2. skip the Amergin overlay and its interval when the dial ran
    3. create the moon at rest instead of at 35vh, and treat the swipe as done

Run from the repo root:  python3 patch_dial_handoff.py
"""

import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
IM = os.path.join(ROOT, 'js/introModal.js')

if not os.path.exists(IM):
    sys.exit('!! missing: %s\n   run this from the repo root (~/Corra)' % IM)

with open(IM, 'r', encoding='utf-8') as f:
    src = f.read()

if '_dialRan' in src:
    print('\n=== patch_dial_handoff.py ===')
    print('  already : dial handoff wired\n')
    sys.exit(0)

applied = []

# -- 1. know whether the dial ran -------------------------------------------
A = "        const _seed = this.registry.get('startPhase');\n        if (typeof _seed === 'number') this.moonPhase = _seed;"
B = (A + "\n        // The dial ran, so it has already shown the poem, taken the first\n"
         "        // touch (unlocking audio) and left its moon at the widget's rest\n"
         "        // position. This scene must not replay the opening.\n"
         "        this._dialRan = (typeof _seed === 'number');")
if A not in src:
    sys.exit('!! seed block not found -- run patch_moonphase_seed.py first')
src = src.replace(A, B, 1)
applied.append('_dialRan flag')

# -- 2. the moon starts where the dial left it -------------------------------
A = """            wrapper.style.bottom    = 'auto';
            wrapper.style.top       = Math.round(H * 0.35) + 'px';"""
B = """            wrapper.style.bottom    = 'auto';
            // With the dial, the moon is ALREADY at rest — its pull-back landed
            // on this exact spot. Starting at 35vh and drifting down would move
            // a moon the player has just watched arrive.
            wrapper.style.top       = (this._dialRan ? this._moonFinalTopPx
                                                     : Math.round(H * 0.35)) + 'px';"""
if A not in src:
    sys.exit('!! moon placement anchor not found')
src = src.replace(A, B, 1)
applied.append('moon created at rest')

# -- 3. the swipe has already happened ---------------------------------------
A = """                if (!this._moonSwipeDone && phase > 0.5) {"""
B = """                if (!this._moonSwipeDone && !this._dialRan && phase > 0.5) {"""
if A not in src:
    sys.exit('!! onChange swipe branch not found')
src = src.replace(A, B, 1)
applied.append('swipe branch skipped when the dial ran')

# -- 4. no Amergin line, no lyric interval -----------------------------------
A = "        let currentLyricIndex = Math.floor(Math.random() * AMERGIN_LINES.length);"
B = ("        // The dial's poem has replaced the looping Amergin line. Kept behind\n"
     "        // the flag so the scene still stands alone without the dial.\n"
     "        let currentLyricIndex = Math.floor(Math.random() * AMERGIN_LINES.length);")
if A in src:
    src = src.replace(A, B, 1)

A = "            currentLyricIndex = (currentLyricIndex + 1) % AMERGIN_LINES.length;"
if A in src:
    src = src.replace(A, "            if (this._dialRan) return;\n" + A, 1)
    applied.append('lyric rotation stopped')

with open(IM, 'w', encoding='utf-8') as f:
    f.write(src)

print('\n=== patch_dial_handoff.py ===')
for c in applied:
    print('  applied : %s' % c)
print("""
The Amergin overlay element itself is still created — it is what displays the
English gloss during the constellation phase, driven by moonPhase. Only its
looping Amergin CONTENT and the drift are suppressed.

If the moon visibly jumps at the handoff, the two places to compare are
MOON_REST_FROM_BOTTOM (introModal, 120) and moonTileTarget() in
introOghamDial.js -- they must agree.
""")

#!/usr/bin/env python3
"""
patch_dial_in_scene.py — ConstellationScene owns the dial.

Prerequisites: introOghamDial.js (v6) in js/; patch_ogham_intro.py,
patch_moonphase_seed.py and patch_dial_handoff.py already run.
Idempotent.

WHAT CHANGES
  The dial was being run by heroSelect BEFORE the scene existed, and the phase
  handed across as an argument. Now ConstellationScene mounts it in create()
  and waits for it. One owner, one lifecycle.

HOW THE WAIT WORKS
  create() cannot be async, and half-building the scene behind the dial would
  mean two states to keep straight. So on the first pass create() mounts the
  dial and RETURNS, building nothing. When the poem finishes it stores the
  phase in the registry and restarts the scene; the second pass sees the phase,
  sets _dialRan, and builds normally.

  That reuses the path patch_dial_handoff.py already established rather than
  adding a second one: a scene started with a phase in the registry is exactly
  a scene whose dial has run. The restart is invisible — nothing had been drawn.

  registry 'dialSeen' guards against the restart re-running it.

THE STARFIELD
  index.html already runs a real starfield beneath #gameContainer, and it has
  been going since the page loaded. The dial no longer draws its own; its
  backdrop simply fades during the pull-back and the real one is revealed.

Edits:
  js/heroSelect.js   stop running the dial; call the scene plainly again
  js/introModal.js   mount and await the dial in create()

Run from the repo root:  python3 patch_dial_in_scene.py
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
HS = os.path.join(ROOT, 'js/heroSelect.js')
IM = os.path.join(ROOT, 'js/introModal.js')

for p in (HS, IM):
    if not os.path.exists(p):
        sys.exit('!! missing: %s\n   run this from the repo root (~/Corra)' % p)

applied, already = [], []

# -- 1. heroSelect goes back to calling the scene directly -------------------
with open(HS, 'r', encoding='utf-8') as f:
    hs = f.read()

if 'runOghamDial' in hs:
    hs = re.sub(r"import \{ runOghamDial \}.*?\n", "", hs)
    hs = re.sub(r"\n?\s*// The dial teaches the moon.*?\n\s*runOghamDial\(\)\.then\(startPhase => \{\n",
                "\n", hs, flags=re.S)
    hs = hs.replace("""    }, startPhase);
    });
}""", """    });
}""")
    with open(HS, 'w', encoding='utf-8') as f:
        f.write(hs)
    applied.append('heroSelect: dial removed, scene called plainly')
else:
    already.append('heroSelect: dial removed')

# -- 2. the scene mounts and awaits it --------------------------------------
with open(IM, 'r', encoding='utf-8') as f:
    im = f.read()

if 'dialSeen' in im:
    already.append('introModal: dial mounted in create()')
else:
    A = "import { createMoonWidget, getMoonBottomOffset } from './game/ui/moonWidget.js';"
    if A not in im:
        sys.exit('!! moonWidget import not found')
    im = im.replace(A, A + "\nimport { runOghamDial } from './introOghamDial.js';", 1)

    A = """    create() {
        this.initAudio();"""
    B = """    create() {
        /* First pass: show the dial and build nothing.
           create() cannot be async, and half-building the scene behind the dial
           would leave two states to keep straight. So this pass mounts the dial
           and returns; when the poem ends it stores the phase and restarts the
           scene, and the second pass builds normally with _dialRan set.

           The restart is invisible — nothing has been drawn yet. And it reuses
           the path that was already there: a scene started with a phase in the
           registry IS a scene whose dial has run. */
        if (!this.registry.get('dialSeen')) {
            this.registry.set('dialSeen', true);
            runOghamDial({ parent: 'gameContainer' })
                .then(phase => {
                    this.registry.set('startPhase', phase);
                    this.scene.restart();
                })
                .catch(() => this.scene.restart());   // never strand the player
            return;
        }

        this.initAudio();"""
    if A not in im:
        sys.exit('!! create() opening not found')
    im = im.replace(A, B, 1)

    with open(IM, 'w', encoding='utf-8') as f:
        f.write(im)
    applied.append('introModal: dial mounted and awaited in create()')

print('\n=== patch_dial_in_scene.py ===')
for c in applied:
    print('  applied : %s' % c)
for s in already:
    print('  already : %s' % s)
print("""
Consequences worth watching, since this is the first time the scene owns it:

  * The scene now restarts once, between the dial and the stars. Anything the
    scene set up before create() would run twice — it does not at present, but
    keep it in mind.
  * initAudio() now happens AFTER the dial. The dial unlocks audio on its own
    first touch, so the ordering is fine, but they are two different unlocks.
  * If the dial ever throws, the catch restarts the scene anyway, so a broken
    dial costs you the poem and not the game.
""")

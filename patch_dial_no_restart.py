#!/usr/bin/env python3
"""
patch_dial_no_restart.py — stop restarting the scene to get past the dial.

Idempotent. Run after patch_dial_in_scene.py.

THE BUG
  I had create() mount the dial and then call this.scene.restart() when the
  poem finished. That was too blunt:

    Failed to process file: image "naomhog"      preload() runs AGAIN on a
    Failed to process file: image "cuirt"        restart, and the loader trips
                                                 over keys it already has
    Cannot read properties of null ('clear')     update() runs every frame from
                                                 the moment the scene is active,
                                                 including the pass where
                                                 create() returned early and
                                                 built nothing

  A restart re-runs the whole scene lifecycle. All that was actually wanted was
  to defer the second half of create().

THE FIX
  create() splits in two. create() decides; _build() constructs. The dial runs,
  and on resolve _build() is called directly — preload never re-runs, no objects
  are torn down, nothing doubles.

  update() gets a guard, because Phaser drives it as soon as the scene is
  active whether or not anything has been built yet.

Edits:
  js/introModal.js

Run from the repo root:  python3 patch_dial_no_restart.py
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
IM = os.path.join(ROOT, 'js/introModal.js')

if not os.path.exists(IM):
    sys.exit('!! missing: %s\n   run this from the repo root (~/Corra)' % IM)

with open(IM, 'r', encoding='utf-8') as f:
    src = f.read()

if '_build()' in src:
    print('\n=== patch_dial_no_restart.py ===')
    print('  already : deferred build in place\n')
    sys.exit(0)

# -- 1. replace the restart guard with a deferred build ---------------------
OLD = re.search(
    r"    create\(\) \{\n(?:.*?\n)*?        \}\n\n        this\.initAudio\(\);", src)
if not OLD:
    sys.exit('!! create() guard not found -- run patch_dial_in_scene.py first')

NEW = """    create() {
        /* The dial runs first, then the scene builds. create() decides; _build()
           constructs.

           This used to call this.scene.restart() once the poem finished, which
           was far too blunt: a restart re-runs preload(), so the image loader
           tripped over keys it already had ("Failed to process file: naomhog"),
           and update() had already been running against a scene that create()
           had returned from without building anything. All that was wanted was
           to defer the second half of create(). */
        if (!this.registry.get('dialSeen')) {
            this.registry.set('dialSeen', true);
            runOghamDial({ parent: 'gameContainer' })
                .then(phase => { this._dialPhase = phase; this._build(); })
                .catch(() => this._build());     // never strand the player
            return;
        }
        this._build();
    }

    _build() {
        this._built = true;
        this.initAudio();"""

src = src[:OLD.start()] + NEW + src[OLD.end():]

# -- 2. the seed can come from the dial directly ----------------------------
src = src.replace(
    "        const _seed = this.registry.get('startPhase');",
    "        // From the dial we just awaited, or from the registry if the scene\n"
    "        // was started with one.\n"
    "        const _seed = (typeof this._dialPhase === 'number')\n"
    "            ? this._dialPhase : this.registry.get('startPhase');")

# -- 3. update() must not run before anything is built ----------------------
A = "    update(time, delta) { this.updateSpin(delta); this.drawScene(); }"
B = ("    update(time, delta) {\n"
     "        // Phaser drives update() from the moment the scene is active, which\n"
     "        // includes the whole time the dial is up and nothing has been built.\n"
     "        if (!this._built) return;\n"
     "        this.updateSpin(delta); this.drawScene();\n"
     "    }")
if A not in src:
    sys.exit('!! update() not found')
src = src.replace(A, B, 1)

with open(IM, 'w', encoding='utf-8') as f:
    f.write(src)

print('\n=== patch_dial_no_restart.py ===')
print('  applied : create() splits into create() + _build()')
print('  applied : seed read from the dial directly')
print('  applied : update() guarded until the scene is built')
print()

#!/usr/bin/env python3
# skye_step11.py -- Training now goes to Skye.
# Run from the repo root, after skye_step10.py:
#   python3 skye_step11.py
#
# tutorialOrAdventure.js: the Oiliúint / Training button still plays the
# dawn crossing, then starts skye_cladach instead of BowTutorial -- the
# player steps off the boat at the Skye jetty. BowTutorial stays
# registered (main.js's default) until Scáthach's archery is ported.
# Idempotent.

import pathlib, sys

FILES = {}

PATCHES = {
 "js/tutorialOrAdventure.js": [
  [
   "                cleanupHeroSelect();\n                initDawnCrossing(champion, GameSettings.englishOpacity, () => {\n",
   "                cleanupHeroSelect();\n                // Training = the Isle of Skye: the dawn crossing rows the\n                // player over and they step off at the Skye jetty (the old\n                // BowTutorial stays registered until Scathach's archery is\n                // ported to the dún).\n                initDawnCrossing(champion, GameSettings.englishOpacity, () => {\n"
  ],
  [
   "                    window.startGame\n                        ? window.startGame(champion, { startScene: 'BowTutorial' })\n                        : console.error('[TutorialOrAdventure] window.startGame not found!');\n",
   "                    window.startGame\n                        ? window.startGame(champion, { startScene: 'skye_cladach' })\n                        : console.error('[TutorialOrAdventure] window.startGame not found!');\n"
  ]
 ]
}

MARKERS = {
 "js/tutorialOrAdventure.js": "startScene: 'skye_cladach'"
}

if not pathlib.Path('js/main.js').exists():
    sys.exit('Run from the repo root.')
if not pathlib.Path('js/game/scenes/locations/skye/skyeLoch.js').exists():
    sys.exit('Run skye_step10.py first.')

plan = {}
for path, hs in PATCHES.items():
    s = pathlib.Path(path).read_text()
    if MARKERS[path] in s:
        plan[path] = 'skip'; continue
    for old, new in hs:
        if s.count(old) != 1:
            sys.exit(f'ABORT: anchor not found in {path} -- nothing written')
    plan[path] = 'patch'

for path, text in FILES.items():
    p = pathlib.Path(path); p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text); print('wrote   ', path)

for path, hs in PATCHES.items():
    if plan[path] == 'skip':
        print('skip    ', path, '(already applied)'); continue
    p = pathlib.Path(path); s = p.read_text()
    for old, new in hs: s = s.replace(old, new)
    p.write_text(s); print('patched ', path)

print('\nDone.')

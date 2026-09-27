#!/usr/bin/env python3
# skye_step9.py -- one call, one step.
# Run from the repo root, after skye_step8.py:
#   python3 skye_step9.py
#
# Fix: holding the d-pad a moment too long on a call took two tiles (up a
# stair AND onto the ledge); the drill judged the first and ignored the
# second, so the next "forward" pointed into the wall. Now a held button
# is dropped as soon as a step is judged, and any extra step taken between
# calls is walked back automatically, like a wrong step.
# Idempotent (rewrites stepDrill.js).

import pathlib, sys

FILES = {
 "js/game/scenes/locations/skye/stepDrill.js": "// stepDrill.js\n// Location: js/game/scenes/locations/skye/stepDrill.js\n//\n// Uathach's drill: she calls a step in Irish, the called d-pad button\n// glows, the player's next tile move is judged. The glow fades over the\n// sequence so the last calls are understood from the Irish alone -- the\n// drill is a listening exercise wearing a movement lesson's clothes.\n//\n// Never fails the player: a wrong step earns a dry correction, the player\n// is stepped back automatically, and the same call comes again -- so the\n// calls always trace the route exactly. One call, one step: a held button\n// is dropped as soon as a step is judged, and any extra step taken between\n// calls is walked back too (on the Skye headland, one extra tile puts the\n// next \"forward\" into a wall).\n//\n//   const drill = new StepDrill(scene, { caption, steps, female, onDone })\n//   drill.start();  drill.update() every frame;  drill.destroy()\n\nconst DIRS = {\n  forward: { dx:  0, dy: -1, btn: 'up',\n             fixGa: 'Ar aghaidh',  fixEn: 'Forward' },\n  back:    { dx:  0, dy:  1, btn: 'down',\n             fixGa: 'Ar gcúl',     fixEn: 'Back' },\n  left:    { dx: -1, dy:  0, btn: 'left',\n             fixGa: 'Do chlé',     fixEn: 'Your left' },\n  right:   { dx:  1, dy:  0, btn: 'right',\n             fixGa: 'Do dheis',    fixEn: 'Your right' },\n}\n\n// Her insult of choice, by the champion's grammatical gender.\nconst VOC = {\n  f: { ga: 'a óinseach',        en: 'you fool' },\n  m: { ga: 'a chinn chabáiste', en: 'cabbage-head' },\n}\n\nconst GAP_MS = 650      // pause after a correct step before the next call\nconst FIX_MS = 1500     // how long a correction shows before the call returns\nconst UNDO_MS = 450     // after a wrong step, when she walks them back\n\nexport default class StepDrill {\n  constructor(scene, { caption, steps, female = false, onDone }) {\n    this.scene   = scene\n    this.caption = caption\n    this.steps   = steps\n    this.voc     = female ? VOC.f : VOC.m\n    this.onDone  = onDone\n    this.i       = 0\n    this._awaiting = false\n    this._lastTile = null\n    this._timers = []\n  }\n\n  _later(ms, fn) { this._timers.push(this.scene.time.delayedCall(ms, fn)) }\n\n  _tile() {\n    const p = this.scene.player, ts = this.scene.tileSize\n    return p ? [Math.floor(p.logicalX / ts), Math.floor(p.logicalY / ts)] : null\n  }\n\n  start(intro) {\n    this._lastTile = this._tile()\n    if (intro) {\n      this.caption.show(intro.ga, intro.en)\n      this._later(intro.holdMs ?? 2600, () => this._call())\n    } else {\n      this._call()\n    }\n  }\n\n  _call() {\n    const step = this.steps[this.i]\n    if (!step) return this._finish()\n    this.caption.show(step.ga, step.en)\n    this.scene.joystick?.highlight?.(DIRS[step.dir].btn, step.glow ?? 1)\n    this._lastTile = this._tile()\n    this._awaiting = true\n  }\n\n  update() {\n    const t = this._tile()\n    if (!t) return\n    if (!this._lastTile) { this._lastTile = t; return }\n    const [dx, dy] = [t[0] - this._lastTile[0], t[1] - this._lastTile[1]]\n    if (!dx && !dy) return\n    this._lastTile = t\n\n    if (!this._awaiting) {\n      if (this._expectUndo) { this._expectUndo = false; return }   // our own walk-back\n      this._walkBack(dx, dy, 0)                                    // an extra step\n      return\n    }\n\n    const want = DIRS[this.steps[this.i].dir]\n    this._awaiting = false\n    this.scene.joystick?.reset?.()          // one call, one step\n    if (dx === want.dx && dy === want.dy) {\n      this.scene.joystick?.highlight?.(null)\n      this.i++\n      this._later(GAP_MS, () => this._call())\n    } else {\n      this.caption.show(`${want.fixGa}, ${this.voc.ga}!`, `${want.fixEn}, ${this.voc.en}!`)\n      // Undo the wrong step, so every call stays true and the route always\n      // ends where it should (after a beat, so the correction is read).\n      this._walkBack(dx, dy, UNDO_MS)\n      this._later(FIX_MS, () => this._call())\n    }\n  }\n\n  // Step the player back one tile (reversing dx, dy), after delayMs. The\n  // resulting tile change is recognised as ours and not judged.\n  _walkBack(dx, dy, delayMs) {\n    this.scene.joystick?.reset?.()\n    const go = () => {\n      this._expectUndo = true\n      this.scene.player?.setPath?.([{ dx: -dx, dy: -dy }])\n    }\n    delayMs ? this._later(delayMs, go) : go()\n  }\n\n  _finish() {\n    this.scene.joystick?.highlight?.(null)\n    this.onDone?.()\n  }\n\n  destroy() {\n    this._timers.forEach(t => t.remove?.())\n    this._timers = []\n    this.scene.joystick?.highlight?.(null)\n  }\n}\n"
}

PATCHES = {}

MARKERS = {}

if not pathlib.Path('js/main.js').exists():
    sys.exit('Run from the repo root.')
if not pathlib.Path('js/game/scenes/locations/skye/harbourWall.js').exists():
    sys.exit('Run skye_step8.py first.')

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

print('\nDone. Now: node tools/map-editor/generators/skye_gen.mjs')

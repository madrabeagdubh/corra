#!/usr/bin/env python3
"""
apply_dream2.py -- step 2 of the cabin opening. Run AFTER apply_dream.py (and the _cabinRain rename).

  * the brooch is thrown mid-rescue, when "the mark of a student of Dún Scáthach" closes
  * the old clothes/stew talk and the door/brooch talk are no longer played (the rescue replaces them)

Run from the Corra repo root:   python3 apply_dream2.py
Safe to run twice.
"""
import re, sys, pathlib

SCENE = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve() / 'js/game/scenes/locations/skye/tighConaill.js'
if not SCENE.exists():
    sys.exit(f'missing {SCENE} -- run this from the Corra repo root')
src = SCENE.read_text()
if '_talk(3, 3)' in src:
    sys.exit('already patched')
if '_dream()' not in src:
    sys.exit('run apply_dream.py first (the _dream() method is missing)')


def sub_once(text, pattern, repl, label):
    new, n = re.subn(pattern, lambda m: repl, text, count=1)
    if n != 1:
        sys.exit(f'ANCHOR NOT FOUND ({label}) -- nothing written; tell Claude what is there instead')
    return new


src = sub_once(
    src,
    r"    await this\._talk\(3, 1\)[^\n]*\n    this\._rainHandle\?\.stop\(4000\)\n",
    "    await this._talk(3, 1)                                  // half-woken: \"where is this place\", \"I am Conall\"\n"
    "    if (this._dead) return\n"
    "    await this._talk(3, 2)                                  // \"the mark of a student of Dún Scáthach. It is thine.\"\n"
    "    if (this._dead) return\n"
    "    await this._throwBrooch()                               // ...and the brooch is thrown, onto the clothes\n"
    "    if (this._dead) return\n"
    "    await this._talk(3, 3)                                  // no cattle, no silver; the path of the blade\n"
    "    this._rainHandle?.stop(4000)\n",
    'scene: _dream tail')
src = sub_once(
    src,
    r"    await this\._walk\(MAP\.clothes\)[^\n]*\n    await this\._talk\(1\)\n    await this\.wait\(300\)\n\n",
    "", 'scene: clothes talk')
src = sub_once(
    src,
    r"    await this\._talk\(2\)[^\n]*\n    await this\._throwBrooch\(\)\n    await this\.wait\(900\)\n",
    "    await this.wait(900)                                  // (the brooch was thrown in the rescue, _dream)\n",
    'scene: door talk + brooch')
SCENE.write_text(src)
print('scene: patched. Now:')
print('  cp tighConaill.dlg tighConaillRescue.dlg tools/dialogue/drafts/')
print('  node tools/dialogue/compile.mjs tools/dialogue/drafts/tighConaill.dlg')
print('  node tools/dialogue/compile.mjs tools/dialogue/drafts/tighConaillRescue.dlg')

#!/usr/bin/env python3
"""Corra patch, round 10: a press on the pin's side has time to become a turn (apply after corra_brooch_spring.py).

  joystick.js   a press in the upper-right sector (where the pin sits) waits PEND_NE_MS (260 ms) before it steers, instead of
                80 ms, so a hand taking hold of the pin can begin turning the hoop without first taking a step north east.
                A tap there still steps (on lifting); a hold there steers once the wait is over.

Run from the repo root. Idempotent: a second run changes nothing.
"""
import os, sys

EDITS = {'js/game/input/joystick.js': [('// TURN TO RELEASE: slide a finger round the ring in one direction '
                                '(SPIN_ENTER\n'
                                '// degrees) and steering lets go while the hoop turns with the finger -- a '
                                'press\n'
                                '// waits PEND_MS before it steers, to see; the gap carried round to the '
                                "pin's\n"
                                '// point (a half turn, from a thumb set opposite the gap) lifts the pin '
                                'and\n'
                                '// calls onRingRelease(). The gap is kept\n',
                                '// TURN TO RELEASE: slide a finger round the ring in one direction '
                                '(SPIN_ENTER\n'
                                '// degrees) and steering lets go while the hoop turns with the finger -- a '
                                'press\n'
                                "// waits PEND_MS before it steers, to see (PEND_NE_MS on the pin's side); "
                                "the gap carried round to the pin's\n"
                                '// point (a half turn, from a thumb set opposite the gap) lifts the pin '
                                'and\n'
                                '// calls onRingRelease(). The gap is kept\n'),
                               ('const SPIN_WINDOW = 800  // ms: the turning must come within this\n'
                                'const PEND_MS = 80       // a press on the ring waits this long before it '
                                'steers, to see if it is a turn\n'
                                'const SPIN_MIN = 150     // degrees: the least turning that frees the pin '
                                "(whatever the thumb's start)\n"
                                "const PIN_MS = 750       // the pin's lift, and the stone's light, after "
                                'the release\n',
                                'const SPIN_WINDOW = 800  // ms: the turning must come within this\n'
                                'const PEND_MS = 80       // a press on the ring waits this long before it '
                                'steers, to see if it is a turn\n'
                                "const PEND_NE_MS = 260   // ... and longer on the pin's side (the upper "
                                "right, STONE_AT's sector): a hand taking hold of the pin\n"
                                '                         // to turn the hoop has time to begin turning '
                                'before a step is taken. A tap there still steps (on lifting)\n'
                                '                         // and a hold there steers once this has passed.\n'
                                'const SPIN_MIN = 150     // degrees: the least turning that frees the pin '
                                "(whatever the thumb's start)\n"
                                "const PIN_MS = 750       // the pin's lift, and the stone's light, after "
                                'the release\n'),
                               ('        this._spin = { last: a, f0: a, acc: 0, t0: performance.now(), on: '
                                'false, dir: 0 }\n'
                                '        clearTimeout(this._padPendT)\n'
                                '        this._padPendT = setTimeout(() => this._padCommit(), PEND_MS)\n'
                                '        return\n'
                                '      }\n',
                                '        this._spin = { last: a, f0: a, acc: 0, t0: performance.now(), on: '
                                'false, dir: 0 }\n'
                                '        clearTimeout(this._padPendT)\n'
                                '        this._padPendT = setTimeout(() => this._padCommit(), '
                                'this._sector(p.x, p.y) === STONE_AT ? PEND_NE_MS : PEND_MS)\n'
                                '        return\n'
                                '      }\n')]}

NEW_FILES = {}

def main():
    root = os.getcwd()
    bad = 0
    for path, content in NEW_FILES.items():
        full = os.path.join(root, path)
        if os.path.isfile(full):
            with open(full, "r", encoding="utf-8", newline="") as fh:
                same = fh.read() == content
            print(("ok      " if same else "DIFFERS (left alone) ") + path)
            bad += 0 if same else 1
        else:
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, "w", encoding="utf-8", newline="") as fh:
                fh.write(content)
            print("created " + path)
    for path, pairs in EDITS.items():
        full = os.path.join(root, path)
        if not os.path.isfile(full):
            print("MISSING", path); bad += 1; continue
        with open(full, "r", encoding="utf-8", newline="") as fh:
            text = fh.read()
        changed = 0
        for old, new in pairs:
            if new in text:
                pass                                   # already applied (checked first: a pure insertion's context outlives it)
            elif old in text:
                if text.count(old) != 1:
                    print("AMBIGUOUS in", path, repr(old[:60])); bad += 1; continue
                text = text.replace(old, new); changed += 1
            else:
                print("NO MATCH in", path, repr(old[:70])); bad += 1
        if changed:
            with open(full, "w", encoding="utf-8", newline="") as fh:
                fh.write(text)
        print(("patched " if changed else "ok      ") + path + (" (%d edits)" % changed if changed else ""))
    sys.exit(1 if bad else 0)

main()

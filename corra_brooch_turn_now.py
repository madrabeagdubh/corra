#!/usr/bin/env python3
"""Corra patch, round 8: the brooch turns at once (apply after corra_brooch_half_turn.py).

  joystick.js   the pin goes back to the upper right with its point toward the lower left (the gap is also at the upper
                right, so at rest the needle's head sits in the opening); the pin comes free when the gap is carried
                half way round to the needle's point.
                The ring now follows a turning finger at once: a press on the ring waits PEND_MS (80 ms) before it steers;
                turning SPIN_ENTER (30 degrees) takes over from steering, and the hoop shows the turn from the first
                few degrees. Turn it back and forth and nothing walks. Sliding round the ring to change direction no
                longer works while this is on (it is a turn).

Run from the repo root. Idempotent: a second run changes nothing.
"""
import os, sys

EDITS = {'js/game/input/joystick.js': [('//   THE HOOP     a thin ring, open at the upper right (the gap), its two '
                                'ends\n'
                                '//                flattened into small enamelled plates.\n'
                                '//   THE PIN      fixed on the diagonal, its head (the stone) at the lower\n'
                                '//                left, its point out through the gap: fastened.\n'
                                '//   THE RING     stays fastened while you steer (it no longer swings round '
                                'to\n'
                                '//                follow the direction of travel). It turns only under a\n',
                                '//   THE HOOP     a thin ring, open at the upper right (the gap), its two '
                                'ends\n'
                                '//                flattened into small enamelled plates.\n'
                                '//   THE PIN      fixed on the diagonal, its head (the stone) at the upper\n'
                                '//                right, in the gap, its point out toward the lower left.\n'
                                '//   THE RING     stays fastened while you steer (it no longer swings round '
                                'to\n'
                                '//                follow the direction of travel). It turns only under a\n'),
                               ('//\n'
                                '// TURN TO RELEASE: slide a finger round the ring in one direction '
                                '(SPIN_ENTER\n'
                                '// degrees, quickly) and steering lets go while the hoop turns with the '
                                'finger;\n'
                                "// the gap carried round to the pin's head (a half turn, from a thumb set\n"
                                '// opposite the gap) lifts the pin and calls onRingRelease(). The gap is '
                                'kept\n'
                                '// opposite the finger as it turns, so the turning is seen. Let go early '
                                'and\n'
                                '// the hoop turns back. Only where onRingRelease is given, and not\n',
                                '//\n'
                                '// TURN TO RELEASE: slide a finger round the ring in one direction '
                                '(SPIN_ENTER\n'
                                '// degrees) and steering lets go while the hoop turns with the finger -- a '
                                'press\n'
                                '// waits PEND_MS before it steers, to see; the gap carried round to the '
                                "pin's\n"
                                '// point (a half turn, from a thumb set opposite the gap) lifts the pin '
                                'and\n'
                                '// calls onRingRelease(). The gap is kept\n'
                                '// opposite the finger as it turns, so the turning is seen. Let go early '
                                'and\n'
                                '// the hoop turns back. Only where onRingRelease is given, and not\n'),
                               ('  BAND:   0.075,  // hoop thickness\n'
                                '  GAP:    22,     // half-angle of the opening, degrees\n'
                                "  GAP_AT: 315,    // where the opening is: upper right (the pin's head is "
                                'opposite, lower left)\n'
                                '  PIN:    0.058,  // pin shaft width\n'
                                "  TIP:    1.18,   // how far past the centre the pin's point reaches\n",
                                '  BAND:   0.075,  // hoop thickness\n'
                                '  GAP:    22,     // half-angle of the opening, degrees\n'
                                "  GAP_AT: 315,    // where the opening is: upper right (the pin's head in "
                                'it; its point at the lower left)\n'
                                '  PIN:    0.058,  // pin shaft width\n'
                                "  TIP:    1.18,   // how far past the centre the pin's point reaches\n"),
                               ('  DEAD:   0.30,   // while steering, ignore angle changes this close to the '
                                'centre\n'
                                '}\n'
                                'const SPIN_ENTER = 120   // degrees of quick turning round the ring before '
                                'it stops steering and turns the hoop\n'
                                'const SPIN_WINDOW = 800  // ms: the turning must come within this\n'
                                'const SPIN_MIN = 150     // degrees: the least turning that frees the pin '
                                "(whatever the thumb's start)\n"
                                "const PIN_MS = 750       // the pin's lift, and the stone's light, after "
                                'the release\n'
                                "const STONE_AT = G.GAP_AT + 180          // lower left; the pin's head "
                                'rests here\n'
                                'const DIR_DEG  = { right: 0, down: 90, left: 180, up: 270 }\n'
                                '\n',
                                '  DEAD:   0.30,   // while steering, ignore angle changes this close to the '
                                'centre\n'
                                '}\n'
                                'const SPIN_ENTER = 30    // degrees of turning round the ring before it '
                                'stops steering and turns the hoop (the ring starts to show it before that)\n'
                                'const SPIN_WINDOW = 800  // ms: the turning must come within this\n'
                                'const PEND_MS = 80       // a press on the ring waits this long before it '
                                'steers, to see if it is a turn\n'
                                'const SPIN_MIN = 150     // degrees: the least turning that frees the pin '
                                "(whatever the thumb's start)\n"
                                "const PIN_MS = 750       // the pin's lift, and the stone's light, after "
                                'the release\n'
                                "const STONE_AT = 315                     // upper right; the pin's head "
                                'rests here (in the gap at rest; its point is at the lower left)\n'
                                'const DIR_DEG  = { right: 0, down: 90, left: 180, up: 270 }\n'
                                '\n'),
                               ('      // wait a moment to see which this is before steering\n'
                                '      if (this._ringGestures?.() && this._onSwipeVertical) {\n'
                                "        this._padMode = 'pend'\n"
                                '        this._padDown = { x: e.clientX, y: e.clientY }\n'
                                '        this._padLast = { x: p.x, y: p.y }\n'
                                '        clearTimeout(this._padPendT)\n'
                                '        this._padPendT = setTimeout(() => this._padCommit(), 70)\n'
                                '        return\n'
                                '      }\n',
                                '      // wait a moment to see which this is before steering\n'
                                '      if (this._ringGestures?.() && this._onSwipeVertical) {\n'
                                '        this._pendSpin = false\n'
                                "        this._padMode = 'pend'\n"
                                '        this._padDown = { x: e.clientX, y: e.clientY }\n'
                                '        this._padLast = { x: p.x, y: p.y }\n'
                                '        clearTimeout(this._padPendT)\n'
                                '        this._padPendT = setTimeout(() => this._padCommit(), 70)\n'
                                '        return\n'
                                '      }\n'
                                '      if (this._onRingRelease) {          // it might be a turn of the '
                                'hoop: wait a moment before steering\n'
                                "        this._padMode = 'pend'; this._pendSpin = true\n"
                                '        this._padDown = { x: e.clientX, y: e.clientY }\n'
                                '        this._padLast = { x: p.x, y: p.y }\n'
                                '        const a = Math.atan2(p.y, p.x) * 180 / Math.PI\n'
                                '        this._spin = { last: a, f0: a, acc: 0, t0: performance.now(), on: '
                                'false, dir: 0 }\n'
                                '        clearTimeout(this._padPendT)\n'
                                '        this._padPendT = setTimeout(() => this._padCommit(), PEND_MS)\n'
                                '        return\n'
                                '      }\n'),
                               ("      if (this._padMode === 'gesture' || this._padMode === 'spent') return\n"
                                "      if (this._padMode === 'spin') { this._turn(p); return }\n"
                                "      if (this._padMode === 'pend') {\n"
                                '        const dx = e.clientX - this._padDown.x, dy = e.clientY - '
                                'this._padDown.y\n',
                                "      if (this._padMode === 'gesture' || this._padMode === 'spent') return\n"
                                "      if (this._padMode === 'spin') { this._turn(p); return }\n"
                                "      if (this._padMode === 'pend' && this._pendSpin) {\n"
                                '        this._padLast = { x: p.x, y: p.y }\n'
                                '        if (p.d >= G.DEAD && this._watchTurn(p)) { '
                                'clearTimeout(this._padPendT); this._padPendT = null }\n'
                                '        return\n'
                                '      }\n'
                                "      if (this._padMode === 'pend') {\n"
                                '        const dx = e.clientX - this._padDown.x, dy = e.clientY - '
                                'this._padDown.y\n'),
                               ('        this._padCommit()\n'
                                '        this._padMode = null\n'
                                '        setTimeout(() => { if (!this._padMode) this._setDir(null) }, 90)\n'
                                '        return\n'
                                '      }\n'
                                '      this._padMode = null\n'
                                '      this._spin = null\n'
                                '      clearTimeout(this._padPendT); this._padPendT = null\n'
                                '      this._setDir(null)\n',
                                '        this._padCommit()\n'
                                '        this._padMode = null\n'
                                '        this._spin = null; this._pendSpin = false\n'
                                '        setTimeout(() => { if (!this._padMode) this._setDir(null) }, 90)\n'
                                '        return\n'
                                '      }\n'
                                '      this._padMode = null\n'
                                '      this._spin = null; this._pendSpin = false\n'
                                '      clearTimeout(this._padPendT); this._padPendT = null\n'
                                '      this._setDir(null)\n'),
                               ('  _ringTarget() {\n'
                                '    const s = this._spin\n'
                                '    return s?.on ? s.f0 + 180 - G.GAP_AT + s.acc : 0          // the gap '
                                'sits opposite the finger\n'
                                '  }\n'
                                '\n',
                                '  _ringTarget() {\n'
                                '    const s = this._spin\n'
                                '    return s && (s.on || Math.abs(s.acc) >= 6) ? s.f0 + 180 - G.GAP_AT + '
                                's.acc : 0          // the gap sits opposite the finger\n'
                                '  }\n'
                                '\n'),
                               ('    // turn the hoop toward its target: briskly while held, gently back to '
                                'fastened\n'
                                '    const d = this._ringTarget() - this._ringRot\n'
                                '    this._ringRot += d * (this._spin?.on ? 0.5 : 0.12)\n'
                                '    const gapAt = G.GAP_AT + this._ringRot\n'
                                '\n',
                                '    // turn the hoop toward its target: briskly while held, gently back to '
                                'fastened\n'
                                '    const d = this._ringTarget() - this._ringRot\n'
                                '    this._ringRot += d * (this._ringTarget() !== 0 ? 0.5 : 0.12)\n'
                                '    const gapAt = G.GAP_AT + this._ringRot\n'
                                '\n')]}

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

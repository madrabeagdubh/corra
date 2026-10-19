#!/usr/bin/env python3
"""Corra patch, round 7: the brooch's half turn (apply after corra_duel_brooch.py).

  joystick.js   the gap is now at the UPPER RIGHT at rest (the pin's head, with its stone, opposite at the lower left).
                Turning the ring keeps the gap opposite your finger, so you see it turn. Carry the gap down to the pin's
                head -- a half turn, from a thumb set opposite the gap -- and the pin comes free. (SPIN_MIN 150 degrees
                is the least turning that counts, whatever the thumb's start.)

Run from the repo root. Idempotent: a second run changes nothing.
"""
import os, sys

EDITS = {'js/game/input/joystick.js': [('// browser bar showing/hiding.\n'
                                '//\n'
                                '//   THE HOOP     a thin ring, open at the lower left (the gap), its two '
                                'ends\n'
                                '//                flattened into small enamelled plates.\n'
                                '//   THE PIN      fixed on the diagonal, its head (the stone) at the upper\n'
                                '//                right, its point out through the gap: fastened.\n'
                                '//   THE RING     stays fastened while you steer (it no longer swings round '
                                'to\n'
                                '//                follow the direction of travel). It turns only under a\n'
                                '//                circling finger: turn it a full round and the pin comes '
                                'free,\n'
                                '//                which opens the menu (config.onRingRelease; see TURN TO '
                                'RELEASE).\n'
                                "//   THE STONE    the pin's jewelled head, on the hoop. It lights (cyan) "
                                'when\n',
                                '// browser bar showing/hiding.\n'
                                '//\n'
                                '//   THE HOOP     a thin ring, open at the upper right (the gap), its two '
                                'ends\n'
                                '//                flattened into small enamelled plates.\n'
                                '//   THE PIN      fixed on the diagonal, its head (the stone) at the lower\n'
                                '//                left, its point out through the gap: fastened.\n'
                                '//   THE RING     stays fastened while you steer (it no longer swings round '
                                'to\n'
                                '//                follow the direction of travel). It turns only under a\n'
                                '//                circling finger: turn it half round, the gap carried down '
                                'to\n'
                                "//                the pin's head, and the pin comes free,\n"
                                '//                which opens the menu (config.onRingRelease; see TURN TO '
                                'RELEASE).\n'
                                "//   THE STONE    the pin's jewelled head, on the hoop. It lights (cyan) "
                                'when\n'),
                               ('// TURN TO RELEASE: slide a finger round the ring in one direction '
                                '(SPIN_ENTER\n'
                                '// degrees, quickly) and steering lets go while the hoop turns with the '
                                'finger;\n'
                                '// a full turn (SPIN_FULL) lifts the pin and calls onRingRelease(). Let go\n'
                                '// early and the hoop turns back. Only where onRingRelease is given, and '
                                'not\n'
                                "// while the ring is the moon's (a sword drawn: ringGestures).\n"
                                '//\n',
                                '// TURN TO RELEASE: slide a finger round the ring in one direction '
                                '(SPIN_ENTER\n'
                                '// degrees, quickly) and steering lets go while the hoop turns with the '
                                'finger;\n'
                                "// the gap carried round to the pin's head (a half turn, from a thumb set\n"
                                '// opposite the gap) lifts the pin and calls onRingRelease(). The gap is '
                                'kept\n'
                                '// opposite the finger as it turns, so the turning is seen. Let go early '
                                'and\n'
                                '// the hoop turns back. Only where onRingRelease is given, and not\n'
                                "// while the ring is the moon's (a sword drawn: ringGestures).\n"
                                '//\n'),
                               ('  BAND:   0.075,  // hoop thickness\n'
                                '  GAP:    22,     // half-angle of the opening, degrees\n'
                                '  GAP_AT: 135,    // where the opening is: lower left\n'
                                '  PIN:    0.058,  // pin shaft width\n'
                                "  TIP:    1.18,   // how far past the centre the pin's point reaches\n",
                                '  BAND:   0.075,  // hoop thickness\n'
                                '  GAP:    22,     // half-angle of the opening, degrees\n'
                                "  GAP_AT: 315,    // where the opening is: upper right (the pin's head is "
                                'opposite, lower left)\n'
                                '  PIN:    0.058,  // pin shaft width\n'
                                "  TIP:    1.18,   // how far past the centre the pin's point reaches\n"),
                               ('const SPIN_ENTER = 120   // degrees of quick turning round the ring before '
                                'it stops steering and turns the hoop\n'
                                'const SPIN_WINDOW = 800  // ms: the turning must come within this\n'
                                'const SPIN_FULL = 330    // degrees: the pin comes free\n'
                                "const PIN_MS = 750       // the pin's lift, and the stone's light, after "
                                'the release\n'
                                "const STONE_AT = G.GAP_AT + 180          // upper right; the pin's head "
                                'rests here\n'
                                'const DIR_DEG  = { right: 0, down: 90, left: 180, up: 270 }\n'
                                '\n',
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
                                '\n'),
                               ('  _watchTurn(p) {\n'
                                '    const now = performance.now()\n'
                                '    if (!this._spin) { this._spin = { last: Math.atan2(p.y, p.x) * 180 / '
                                'Math.PI, acc: 0, t0: now, on: false, dir: 0 }; return false }\n'
                                '    const s = this._spin, d = this._turnBy(p)\n'
                                '    if (!d) return false\n'
                                '    if (s.acc && Math.sign(d) !== Math.sign(s.acc)) { s.acc = 0; s.t0 = now '
                                '}          // turned back: start again\n'
                                '    if (!s.acc) s.t0 = now\n'
                                '    if (now - s.t0 > SPIN_WINDOW) { s.acc = 0; s.t0 = now '
                                '}                              // too slow to be a turn: it is steering\n'
                                '    s.acc += d\n'
                                '    if (Math.abs(s.acc) < SPIN_ENTER) return false\n'
                                '    s.on = true; s.dir = Math.sign(s.acc)\n'
                                "    this._padMode = 'spin'\n"
                                '    '
                                'this._setDir(null)                                                                    '
                                '// the feet let go\n',
                                '  _watchTurn(p) {\n'
                                '    const now = performance.now()\n'
                                '    if (!this._spin) { const a = Math.atan2(p.y, p.x) * 180 / Math.PI; '
                                'this._spin = { last: a, f0: a, acc: 0, t0: now, on: false, dir: 0 }; return '
                                'false }\n'
                                '    const s = this._spin, d = this._turnBy(p)\n'
                                '    if (!d) return false\n'
                                '    if (s.acc && Math.sign(d) !== Math.sign(s.acc)) { s.acc = 0; s.t0 = '
                                'now; s.f0 = s.last - d }     // turned back: start again\n'
                                '    if (!s.acc) { s.t0 = now; s.f0 = s.last - d }\n'
                                '    if (now - s.t0 > SPIN_WINDOW) { s.acc = 0; s.t0 = now; s.f0 = s.last - '
                                'd }                         // too slow to be a turn: it is steering\n'
                                '    s.acc += d\n'
                                '    if (Math.abs(s.acc) < SPIN_ENTER) return false\n'
                                '    s.on = true; s.dir = Math.sign(s.acc)\n'
                                '    // how far the gap (kept opposite the finger) must still be carried, in '
                                "this direction, to reach the pin's head\n"
                                '    const d0 = ((s.dir * (s.f0 + 180 - G.GAP_AT)) % 360 + 360) % 360\n'
                                '    s.need = Math.max(SPIN_MIN, d0 <= 180 ? 180 - d0 : 540 - d0)\n'
                                "    this._padMode = 'spin'\n"
                                '    '
                                'this._setDir(null)                                                                    '
                                '// the feet let go\n'),
                               ('    s.acc += this._turnBy(p)\n'
                                '    const done = s.acc * s.dir\n'
                                '    if (done >= SPIN_FULL) '
                                '{                                                              // the pin '
                                'is free\n'
                                "      this._padMode = 'spent'\n"
                                '      this._spin = null\n',
                                '    s.acc += this._turnBy(p)\n'
                                '    const done = s.acc * s.dir\n'
                                '    if (done >= s.need) '
                                '{                                                              // the pin '
                                'is free\n'
                                "      this._padMode = 'spent'\n"
                                '      this._spin = null\n'),
                               ('  // Where the hoop should be turned to: fastened (0), or as far round as a '
                                'circling finger has taken it.\n'
                                '  _ringTarget() {\n'
                                '    return this._spin?.on ? Math.max(0, this._spin.acc * this._spin.dir) * '
                                'this._spin.dir : 0\n'
                                '  }\n'
                                '\n',
                                '  // Where the hoop should be turned to: fastened (0), or as far round as a '
                                'circling finger has taken it.\n'
                                '  _ringTarget() {\n'
                                '    const s = this._spin\n'
                                '    return s?.on ? s.f0 + 180 - G.GAP_AT + s.acc : 0          // the gap '
                                'sits opposite the finger\n'
                                '  }\n'
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

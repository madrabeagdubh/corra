#!/usr/bin/env python3
"""Corra patch, round 9: the brooch springs open; the pin stands proud (apply after corra_brooch_turn_now.py).

  joystick.js   when the pin comes free the hoop springs open to the half turn, with a little overshoot, whichever way it
                was turned (left or right), and stays open until the finger lifts. The pin's head (the blue stone) stands
                out further (G.HEAD 0.94 of the radius, was on the hoop at 0.82), a touch above the two red enamel ends
                when closed; the needle is longer by as much.

Run from the repo root. Idempotent: a second run changes nothing.
"""
import os, sys

EDITS = {'js/game/input/joystick.js': [('  GAP:    22,     // half-angle of the opening, degrees\n'
                                "  GAP_AT: 315,    // where the opening is: upper right (the pin's head in "
                                'it; its point at the lower left)\n'
                                '  PIN:    0.058,  // pin shaft width\n'
                                "  TIP:    1.18,   // how far past the centre the pin's point reaches\n",
                                '  GAP:    22,     // half-angle of the opening, degrees\n'
                                "  GAP_AT: 315,    // where the opening is: upper right (the pin's head in "
                                'it; its point at the lower left)\n'
                                "  HEAD:   0.94,   // how far out the pin's head stands (a little proud of "
                                'the hoop and its enamel ends)\n'
                                '  PIN:    0.058,  // pin shaft width\n'
                                "  TIP:    1.18,   // how far past the centre the pin's point reaches\n"),
                               ('    this._dirDeg     = null       // held direction, 0..360 (0 right, 90 '
                                'down), or null\n'
                                '    this._ringRot    = 0          // how far the hoop has turned from '
                                'fastened, degrees\n'
                                '    this._spin       = null       // { last, acc, t0, on, dir }: a finger '
                                'circling the ring (TURN TO RELEASE)\n'
                                '    this._pinT       = -1e9       // when the pin last came free\n',
                                '    this._dirDeg     = null       // held direction, 0..360 (0 right, 90 '
                                'down), or null\n'
                                '    this._ringRot    = 0          // how far the hoop has turned from '
                                'fastened, degrees\n'
                                '    this._ringVel    = 0          // ... and how fast it is springing (once '
                                'the pin is free)\n'
                                '    this._open       = 0          // +-180 once the pin is free and the '
                                'hoop has sprung open, until the finger lifts\n'
                                '    this._spin       = null       // { last, acc, t0, on, dir }: a finger '
                                'circling the ring (TURN TO RELEASE)\n'
                                '    this._pinT       = -1e9       // when the pin last came free\n'),
                               ('\n'
                                '  _onStone(x, y) {\n'
                                '    const sx = Math.cos(rad(STONE_AT)) * G.RING, sy = '
                                'Math.sin(rad(STONE_AT)) * G.RING\n'
                                '    return Math.hypot(x - sx, y - sy) < G.STONE * 1.8\n'
                                '  }\n',
                                '\n'
                                '  _onStone(x, y) {\n'
                                '    const sx = Math.cos(rad(STONE_AT)) * G.HEAD, sy = '
                                'Math.sin(rad(STONE_AT)) * G.HEAD\n'
                                '    return Math.hypot(x - sx, y - sy) < G.STONE * 1.8\n'
                                '  }\n'),
                               ('        this._padCommit()\n'
                                '        this._padMode = null\n'
                                '        this._spin = null; this._pendSpin = false\n'
                                '        setTimeout(() => { if (!this._padMode) this._setDir(null) }, 90)\n'
                                '        return\n'
                                '      }\n'
                                '      this._padMode = null\n'
                                '      this._spin = null; this._pendSpin = false\n'
                                '      clearTimeout(this._padPendT); this._padPendT = null\n'
                                '      this._setDir(null)\n',
                                '        this._padCommit()\n'
                                '        this._padMode = null\n'
                                '        this._spin = null; this._pendSpin = false; this._open = 0\n'
                                '        setTimeout(() => { if (!this._padMode) this._setDir(null) }, 90)\n'
                                '        return\n'
                                '      }\n'
                                '      this._padMode = null\n'
                                '      this._spin = null; this._pendSpin = false; this._open = 0\n'
                                '      clearTimeout(this._padPendT); this._padPendT = null\n'
                                '      this._setDir(null)\n'),
                               ('    if (done >= s.need) '
                                '{                                                              // the pin '
                                'is free\n'
                                "      this._padMode = 'spent'\n"
                                '      this._spin = null\n'
                                '      this._pinT = performance.now()\n',
                                '    if (done >= s.need) '
                                '{                                                              // the pin '
                                'is free\n'
                                "      this._padMode = 'spent'\n"
                                '      this._open = s.dir * 180; this._ringVel = '
                                '0                                        // the hoop springs open, '
                                'whichever way it was turned\n'
                                '      this._spin = null\n'
                                '      this._pinT = performance.now()\n'),
                               ('  // Where the hoop should be turned to: fastened (0), or as far round as a '
                                'circling finger has taken it.\n'
                                '  _ringTarget() {\n'
                                '    const s = this._spin\n'
                                '    return s && (s.on || Math.abs(s.acc) >= 6) ? s.f0 + 180 - G.GAP_AT + '
                                's.acc : 0          // the gap sits opposite the finger\n',
                                '  // Where the hoop should be turned to: fastened (0), or as far round as a '
                                'circling finger has taken it.\n'
                                '  _ringTarget() {\n'
                                '    if (this._open) return this._open\n'
                                '    const s = this._spin\n'
                                '    return s && (s.on || Math.abs(s.acc) >= 6) ? s.f0 + 180 - G.GAP_AT + '
                                's.acc : 0          // the gap sits opposite the finger\n'),
                               ('  _animating() {\n'
                                '    const off = Math.abs(this._ringTarget() - this._ringRot)\n'
                                '    return off > 0.3 || !!this._hint || this._stoneLit || this._badgeGlow '
                                '|| this._charge > 0 || (this._now || 0) - this._pinT < PIN_MS\n'
                                '  }\n'
                                '\n',
                                '  _animating() {\n'
                                '    const off = Math.abs(this._ringTarget() - this._ringRot)\n'
                                '    return off > 0.3 || Math.abs(this._ringVel) > 0.05 || !!this._hint || '
                                'this._stoneLit || this._badgeGlow || this._charge > 0 || (this._now || 0) - '
                                'this._pinT < PIN_MS\n'
                                '  }\n'
                                '\n'),
                               ('    // turn the hoop toward its target: briskly while held, gently back to '
                                'fastened\n'
                                '    const d = this._ringTarget() - this._ringRot\n'
                                '    this._ringRot += d * (this._ringTarget() !== 0 ? 0.5 : 0.12)\n'
                                '    const gapAt = G.GAP_AT + this._ringRot\n'
                                '\n',
                                '    // turn the hoop toward its target: briskly while held, gently back to '
                                'fastened\n'
                                '    const d = this._ringTarget() - this._ringRot\n'
                                '    const dtf = Math.min(2.5, (t - (this._lastT || t)) / 16.7); this._lastT '
                                '= t\n'
                                '    if (this._open) {                                                    // '
                                'sprung open: a little overshoot, settling\n'
                                '      this._ringVel += (d * 0.2 - this._ringVel * 0.42) * dtf\n'
                                '      this._ringRot += this._ringVel * dtf\n'
                                '    } else {\n'
                                '      this._ringVel = 0\n'
                                '      this._ringRot += d * (this._ringTarget() !== 0 ? 0.5 : 0.12)\n'
                                '    }\n'
                                '    const gapAt = G.GAP_AT + this._ringRot\n'
                                '\n'),
                               ('  // out past the far side.\n'
                                '  _pin(ctx, R, ha, m) {\n'
                                '    const hx = Math.cos(rad(ha)) * G.RING * R, hy = Math.sin(rad(ha)) * '
                                'G.RING * R\n'
                                '    const ta = ha + 180\n'
                                '    const tx = Math.cos(rad(ta)) * G.TIP * R, ty = Math.sin(rad(ta)) * '
                                'G.TIP * R\n',
                                '  // out past the far side.\n'
                                '  _pin(ctx, R, ha, m) {\n'
                                '    const hx = Math.cos(rad(ha)) * G.HEAD * R, hy = Math.sin(rad(ha)) * '
                                'G.HEAD * R\n'
                                '    const ta = ha + 180\n'
                                '    const tx = Math.cos(rad(ta)) * G.TIP * R, ty = Math.sin(rad(ta)) * '
                                'G.TIP * R\n'),
                               ('\n'
                                '  _stone(ctx, R, m, t, free = false) {\n'
                                '    const x = Math.cos(rad(STONE_AT)) * G.RING * R, y = '
                                'Math.sin(rad(STONE_AT)) * G.RING * R\n'
                                '    const cr = G.STONE * R, lit = this._stoneLit || this._badgeGlow || '
                                'free\n'
                                '    if (lit) {\n',
                                '\n'
                                '  _stone(ctx, R, m, t, free = false) {\n'
                                '    const x = Math.cos(rad(STONE_AT)) * G.HEAD * R, y = '
                                'Math.sin(rad(STONE_AT)) * G.HEAD * R\n'
                                '    const cr = G.STONE * R, lit = this._stoneLit || this._badgeGlow || '
                                'free\n'
                                '    if (lit) {\n')]}

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

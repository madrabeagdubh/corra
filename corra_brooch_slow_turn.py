#!/usr/bin/env python3
"""Corra patch, round 11: a slowly turned ring still frees the pin (apply after corra_brooch_ne_grace.py).

  joystick.js   the turn is now tallied from the press on (net, either way, never reset): the hoop shows it, and the pin comes
                free when the gap reaches the needle's point however slowly it got there, and whichever way (turn one way,
                back, and on the other way works). Before, a slow turn kept resetting its count (it was judged "steering"),
                so the gap could cross the pin without freeing it. SPIN_WINDOW (when a turn takes over from steering) is now
                2.5 s, not 0.8 s.

Run from the repo root. Idempotent: a second run changes nothing.
"""
import os, sys

EDITS = {'js/game/input/joystick.js': [('}\n'
                                'const SPIN_ENTER = 30    // degrees of turning round the ring before it '
                                'stops steering and turns the hoop (the ring starts to show it before that)\n'
                                'const SPIN_WINDOW = 800  // ms: the turning must come within this\n'
                                'const PEND_MS = 80       // a press on the ring waits this long before it '
                                'steers, to see if it is a turn\n'
                                "const PEND_NE_MS = 260   // ... and longer on the pin's side (the upper "
                                "right, STONE_AT's sector): a hand taking hold of the pin\n",
                                '}\n'
                                'const SPIN_ENTER = 30    // degrees of turning round the ring before it '
                                'stops steering and turns the hoop (the ring starts to show it before that)\n'
                                'const SPIN_WINDOW = 2500 // ms: the turning must come within this\n'
                                'const PEND_MS = 80       // a press on the ring waits this long before it '
                                'steers, to see if it is a turn\n'
                                "const PEND_NE_MS = 260   // ... and longer on the pin's side (the upper "
                                "right, STONE_AT's sector): a hand taking hold of the pin\n"),
                               ('        this._padDown = { x: e.clientX, y: e.clientY }\n'
                                '        this._padLast = { x: p.x, y: p.y }\n'
                                '        const a = Math.atan2(p.y, p.x) * 180 / Math.PI\n'
                                '        this._spin = { last: a, f0: a, acc: 0, t0: performance.now(), on: '
                                'false, dir: 0 }\n'
                                '        clearTimeout(this._padPendT)\n'
                                '        this._padPendT = setTimeout(() => this._padCommit(), '
                                'this._sector(p.x, p.y) === STONE_AT ? PEND_NE_MS : PEND_MS)\n',
                                '        this._padDown = { x: e.clientX, y: e.clientY }\n'
                                '        this._padLast = { x: p.x, y: p.y }\n'
                                '        this._spin = this._newSpin(p)\n'
                                '        clearTimeout(this._padPendT)\n'
                                '        this._padPendT = setTimeout(() => this._padCommit(), '
                                'this._sector(p.x, p.y) === STONE_AT ? PEND_NE_MS : PEND_MS)\n'),
                               ("    pad.addEventListener('lostpointercapture', () => { if (this._padMode) "
                                'end() })\n'
                                '  }\n'
                                "  // TURN TO RELEASE. The finger's angle round the centre, and how far it "
                                'has turned (signed) since it began turning one way.\n'
                                '  _turnBy(p) {\n'
                                '    const s = this._spin, a = Math.atan2(p.y, p.x) * 180 / Math.PI\n'
                                '    let d = a - s.last; if (d > 180) d -= 360; else if (d < -180) d += 360\n'
                                '    s.last = a\n'
                                '    return d\n'
                                '  }\n'
                                '  // while steering: has this become a turn of the hoop? (true: yes, '
                                'steering lets go)\n'
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
                                '// the feet let go\n',
                                "    pad.addEventListener('lostpointercapture', () => { if (this._padMode) "
                                'end() })\n'
                                '  }\n'
                                "  // TURN TO RELEASE. The finger's angle round the centre, and how far it "
                                'has turned. Two tallies:\n'
                                '  //   tot  the net turn since the press began, either way, never reset: it '
                                'carries the hoop on screen and frees the pin\n'
                                '  //        (however slowly it was turned, and whichever way)\n'
                                '  //   acc  turning one way within SPIN_WINDOW: when it reaches SPIN_ENTER '
                                'the turn takes over from steering\n'
                                '  _newSpin(p) {\n'
                                '    const a = Math.atan2(p.y, p.x) * 180 / Math.PI\n'
                                '    return { last: a, a0: a, tot: 0, acc: 0, t0: performance.now(), on: '
                                'false }\n'
                                '  }\n'
                                '  _turnBy(p) {\n'
                                '    const s = this._spin, a = Math.atan2(p.y, p.x) * 180 / Math.PI\n'
                                '    let d = a - s.last; if (d > 180) d -= 360; else if (d < -180) d += 360\n'
                                '    s.last = a\n'
                                '    s.tot += d\n'
                                '    return d\n'
                                '  }\n'
                                '  // while steering: has this become a turn of the hoop? (true: yes, '
                                'steering lets go)\n'
                                '  _watchTurn(p) {\n'
                                '    const now = performance.now()\n'
                                '    if (!this._spin) { this._spin = this._newSpin(p); return false }\n'
                                '    const s = this._spin, d = this._turnBy(p)\n'
                                '    if (!d) return false\n'
                                '    if (this._free()) return true\n'
                                '    if (s.acc && Math.sign(d) !== Math.sign(s.acc)) { s.acc = 0; s.t0 = now '
                                '}          // turned back: start again\n'
                                '    if (!s.acc || now - s.t0 > SPIN_WINDOW) { s.acc = 0; s.t0 = now '
                                '}                    // too slow to be a turn: it is steering\n'
                                '    s.acc += d\n'
                                '    if (Math.abs(s.acc) < SPIN_ENTER) return false\n'
                                '    s.on = true\n'
                                "    this._padMode = 'spin'\n"
                                '    '
                                'this._setDir(null)                                                                    '
                                '// the feet let go\n'),
                               ('  _turn(p) {\n'
                                '    if (p.d < G.DEAD) return\n'
                                '    const s = this._spin\n'
                                '    s.acc += this._turnBy(p)\n'
                                '    const done = s.acc * s.dir\n'
                                '    if (done >= s.need) '
                                '{                                                              // the pin '
                                'is free\n'
                                "      this._padMode = 'spent'\n"
                                '      this._open = s.dir * 180; this._ringVel = '
                                '0                                        // the hoop springs open, '
                                'whichever way it was turned\n'
                                '      this._spin = null\n'
                                '      this._pinT = performance.now()\n'
                                '      try { navigator.vibrate?.([20, 40, 30]) } catch (_) {}\n'
                                '      this._dirty = true\n'
                                '      this._onRingRelease?.()\n'
                                '    }\n'
                                '    this._dirty = true\n'
                                '  }\n'
                                '\n',
                                '  _turn(p) {\n'
                                '    if (p.d < G.DEAD) return\n'
                                '    this._turnBy(p)\n'
                                '    this._free()\n'
                                '    this._dirty = true\n'
                                '  }\n'
                                "  // Has the gap (kept opposite the finger) been carried to the needle's "
                                'point? Then the pin is free.\n'
                                '  _free() {\n'
                                '    const s = this._spin\n'
                                '    if (!s || !s.tot) return false\n'
                                '    const dir = Math.sign(s.tot)\n'
                                '    const d0 = ((dir * (s.a0 + 180 - G.GAP_AT)) % 360 + 360) % '
                                '360                       // how far round the gap already is, this way\n'
                                '    const need = Math.max(SPIN_MIN, d0 <= 180 ? 180 - d0 : 540 - d0)\n'
                                '    if (Math.abs(s.tot) < need) return false\n'
                                "    this._padMode = 'spent'\n"
                                '    this._open = dir * 180; this._ringVel = '
                                '0                                              // the hoop springs open, '
                                'whichever way it was turned\n'
                                '    this._spin = null\n'
                                '    this._pinT = performance.now()\n'
                                '    try { navigator.vibrate?.([20, 40, 30]) } catch (_) {}\n'
                                '    this._dirty = true\n'
                                '    this._onRingRelease?.()\n'
                                '    return true\n'
                                '  }\n'
                                '\n'),
                               ('    if (this._open) return this._open\n'
                                '    const s = this._spin\n'
                                '    return s && (s.on || Math.abs(s.acc) >= 6) ? s.f0 + 180 - G.GAP_AT + '
                                's.acc : 0          // the gap sits opposite the finger\n'
                                '  }\n'
                                '\n',
                                '    if (this._open) return this._open\n'
                                '    const s = this._spin\n'
                                '    return s && Math.abs(s.tot) >= 6 ? s.a0 + 180 - G.GAP_AT + s.tot : '
                                '0          // the gap sits opposite the finger\n'
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

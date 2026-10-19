#!/usr/bin/env python3
"""Corra patch, round 6: the duel ends on one valid blow; the brooch stops spinning to travel, and turns to release
(apply after corra_catch_salute_shove.py).

  faicheCourse.js     the duel ends on the first blow of yours that lands or is turned aside (not only on a hit in the slow);
                      Conall's speech about the moment follows. If you never entered the slow, a `= won` slot in the draft
                      is said instead when it has one (none yet: it is the moment's speech then)
  joystick.js         the hoop no longer swings round to face the direction you walk. NEW: slide a finger round the ring
                      (SPIN_ENTER 120 degrees within SPIN_WINDOW 800 ms) and steering lets go while the hoop turns with the
                      finger; a full turn (SPIN_FULL 330) lifts the pin free (a buzz, the stone lights) and calls
                      onRingRelease. Let go early and the hoop turns back. Off while a sword is drawn (the ring is the
                      moon's then) and wherever onRingRelease isn't given.
  perspectiveScene.js onRingRelease opens the menu, as the long press does (both kept, to compare)

Run from the repo root. Idempotent: a second run changes nothing.
"""
import os, sys

EDITS = {'js/game/input/joystick.js': [('//   THE PIN      fixed on the diagonal, its head (the stone) at the upper\n'
                                '//                right, its point out through the gap: fastened.\n'
                                '//   THE RING     turns under the pin while a direction is held, swinging\n'
                                '//                the gap to the side AWAY from the thumb, so the thumb is\n'
                                '//                always on solid metal; it turns back to fastened on '
                                'release.\n'
                                '//                (As on a real penannular brooch, where the ring turns\n'
                                "//                through the pin's head loop.)\n"
                                "//   THE STONE    the pin's jewelled head, on the hoop. It lights (cyan) "
                                'when\n'
                                "//                there's something to interact with, and a tap on it "
                                'then\n',
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
                                'when\n'
                                "//                there's something to interact with, and a tap on it "
                                'then\n'),
                               ('// still steer. The stone claims a press only while lit, and a press that\n'
                                '// starts on it and slides becomes steering, so no direction is ever lost.\n'
                                '//\n'
                                '// Centre hub (moon) interactions -- unchanged:\n',
                                '// still steer. The stone claims a press only while lit, and a press that\n'
                                '// starts on it and slides becomes steering, so no direction is ever lost.\n'
                                '//\n'
                                '// TURN TO RELEASE: slide a finger round the ring in one direction '
                                '(SPIN_ENTER\n'
                                '// degrees, quickly) and steering lets go while the hoop turns with the '
                                'finger;\n'
                                '// a full turn (SPIN_FULL) lifts the pin and calls onRingRelease(). Let go\n'
                                '// early and the hoop turns back. Only where onRingRelease is given, and '
                                'not\n'
                                "// while the ring is the moon's (a sword drawn: ringGestures).\n"
                                '//\n'
                                '// Centre hub (moon) interactions -- unchanged:\n'),
                               ('  DEAD:   0.30,   // while steering, ignore angle changes this close to the '
                                'centre\n'
                                '}\n'
                                "const STONE_AT = G.GAP_AT + 180          // upper right; the pin's head "
                                'rests here\n'
                                'const DIR_DEG  = { right: 0, down: 90, left: 180, up: 270 }\n',
                                '  DEAD:   0.30,   // while steering, ignore angle changes this close to the '
                                'centre\n'
                                '}\n'
                                'const SPIN_ENTER = 120   // degrees of quick turning round the ring before '
                                'it stops steering and turns the hoop\n'
                                'const SPIN_WINDOW = 800  // ms: the turning must come within this\n'
                                'const SPIN_FULL = 330    // degrees: the pin comes free\n'
                                "const PIN_MS = 750       // the pin's lift, and the stone's light, after "
                                'the release\n'
                                "const STONE_AT = G.GAP_AT + 180          // upper right; the pin's head "
                                'rests here\n'
                                'const DIR_DEG  = { right: 0, down: 90, left: 180, up: 270 }\n'),
                               ('    this._ringGestures        = config.ringGestures         ?? null     // '
                                "() => true: swipes on the ring are the moon's gestures\n"
                                '    this._onRingDrag          = config.onRingDrag           ?? null     // '
                                '(pointerId) a drag from above the brooch onto it: swallow it\n'
                                '\n'
                                '    const R = this.radius\n',
                                '    this._ringGestures        = config.ringGestures         ?? null     // '
                                "() => true: swipes on the ring are the moon's gestures\n"
                                '    this._onRingDrag          = config.onRingDrag           ?? null     // '
                                '(pointerId) a drag from above the brooch onto it: swallow it\n'
                                '    this._onRingRelease       = config.onRingRelease        ?? null     // '
                                '() the hoop turned a full round: the pin is free (the menu)\n'
                                '\n'
                                '    const R = this.radius\n'),
                               ('    this._dirDeg     = null       // held direction, 0..360 (0 right, 90 '
                                'down), or null\n'
                                '    this._ringRot    = 0          // how far the hoop has turned from '
                                'fastened, degrees\n'
                                '    this._hint       = null       // { deg, strength } from highlight()\n'
                                '    this._charge     = 0          // long-press progress 0..1\n',
                                '    this._dirDeg     = null       // held direction, 0..360 (0 right, 90 '
                                'down), or null\n'
                                '    this._ringRot    = 0          // how far the hoop has turned from '
                                'fastened, degrees\n'
                                '    this._spin       = null       // { last, acc, t0, on, dir }: a finger '
                                'circling the ring (TURN TO RELEASE)\n'
                                '    this._pinT       = -1e9       // when the pin last came free\n'
                                '    this._hint       = null       // { deg, strength } from highlight()\n'
                                '    this._charge     = 0          // long-press progress 0..1\n'),
                               ('      }\n'
                                "      this._padMode = 'dir'\n"
                                '      this._setDir(this._sector(p.x, p.y))\n'
                                '    }, { passive: false })\n',
                                '      }\n'
                                "      this._padMode = 'dir'\n"
                                '      this._spin = null\n'
                                '      this._setDir(this._sector(p.x, p.y))\n'
                                '    }, { passive: false })\n'),
                               ('      if (!this._padMode) return\n'
                                '      const p = this._local(e)\n'
                                "      if (this._padMode === 'gesture') return\n"
                                "      if (this._padMode === 'pend') {\n"
                                '        const dx = e.clientX - this._padDown.x, dy = e.clientY - '
                                'this._padDown.y\n',
                                '      if (!this._padMode) return\n'
                                '      const p = this._local(e)\n'
                                "      if (this._padMode === 'gesture' || this._padMode === 'spent') return\n"
                                "      if (this._padMode === 'spin') { this._turn(p); return }\n"
                                "      if (this._padMode === 'pend') {\n"
                                '        const dx = e.clientX - this._padDown.x, dy = e.clientY - '
                                'this._padDown.y\n'),
                               ('      }\n'
                                '      if (p.d < G.DEAD) return           // too near the centre to read an '
                                'angle\n'
                                '      this._setDir(this._sector(p.x, p.y))\n'
                                '    })\n',
                                '      }\n'
                                '      if (p.d < G.DEAD) return           // too near the centre to read an '
                                'angle\n'
                                '      if (this._onRingRelease && !this._ringGestures?.() && '
                                'this._watchTurn(p)) return\n'
                                '      this._setDir(this._sector(p.x, p.y))\n'
                                '    })\n'),
                               ('      }\n'
                                '      this._padMode = null\n'
                                '      clearTimeout(this._padPendT); this._padPendT = null\n'
                                '      this._setDir(null)\n',
                                '      }\n'
                                '      this._padMode = null\n'
                                '      this._spin = null\n'
                                '      clearTimeout(this._padPendT); this._padPendT = null\n'
                                '      this._setDir(null)\n'),
                               ("    pad.addEventListener('lostpointercapture', () => { if (this._padMode) "
                                'end() })\n'
                                '  }\n'
                                '  // it was not a gesture: steer, from where the finger is now\n'
                                '  _padCommit() {\n',
                                "    pad.addEventListener('lostpointercapture', () => { if (this._padMode) "
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
                                '// the feet let go\n'
                                '    try { navigator.vibrate?.(8) } catch (_) {}\n'
                                '    this._dirty = true\n'
                                '    return true\n'
                                '  }\n'
                                '  _turn(p) {\n'
                                '    if (p.d < G.DEAD) return\n'
                                '    const s = this._spin\n'
                                '    s.acc += this._turnBy(p)\n'
                                '    const done = s.acc * s.dir\n'
                                '    if (done >= SPIN_FULL) '
                                '{                                                              // the pin '
                                'is free\n'
                                "      this._padMode = 'spent'\n"
                                '      this._spin = null\n'
                                '      this._pinT = performance.now()\n'
                                '      try { navigator.vibrate?.([20, 40, 30]) } catch (_) {}\n'
                                '      this._dirty = true\n'
                                '      this._onRingRelease?.()\n'
                                '    }\n'
                                '    this._dirty = true\n'
                                '  }\n'
                                '\n'
                                '  // it was not a gesture: steer, from where the finger is now\n'
                                '  _padCommit() {\n'),
                               ('  }\n'
                                '\n'
                                '  // Where the hoop should be turned to: the gap opposite the held '
                                'direction,\n'
                                '  // or 0 (fastened) when nothing is held. Shortest way round.\n'
                                '  _ringTarget() {\n'
                                '    if (this._dirDeg === null) return 0\n'
                                '    return ((this._dirDeg + 180 - G.GAP_AT + 540) % 360) - 180\n'
                                '  }\n'
                                '\n'
                                '  _animating() {\n'
                                '    const off = Math.abs(this._ringTarget() - this._ringRot)\n'
                                '    return off > 0.3 || !!this._hint || this._stoneLit || this._badgeGlow '
                                '|| this._charge > 0\n'
                                '  }\n'
                                '\n',
                                '  }\n'
                                '\n'
                                '  // Where the hoop should be turned to: fastened (0), or as far round as a '
                                'circling finger has taken it.\n'
                                '  _ringTarget() {\n'
                                '    return this._spin?.on ? Math.max(0, this._spin.acc * this._spin.dir) * '
                                'this._spin.dir : 0\n'
                                '  }\n'
                                '\n'
                                '  _animating() {\n'
                                '    const off = Math.abs(this._ringTarget() - this._ringRot)\n'
                                '    return off > 0.3 || !!this._hint || this._stoneLit || this._badgeGlow '
                                '|| this._charge > 0 || (this._now || 0) - this._pinT < PIN_MS\n'
                                '  }\n'
                                '\n'),
                               ('    // turn the hoop toward its target: briskly while held, gently back to '
                                'fastened\n'
                                '    const d = this._ringTarget() - this._ringRot\n'
                                '    this._ringRot += d * (this._dirDeg === null ? 0.12 : 0.25)\n'
                                '    const gapAt = G.GAP_AT + this._ringRot\n'
                                '\n',
                                '    // turn the hoop toward its target: briskly while held, gently back to '
                                'fastened\n'
                                '    const d = this._ringTarget() - this._ringRot\n'
                                '    this._ringRot += d * (this._spin?.on ? 0.5 : 0.12)\n'
                                '    const gapAt = G.GAP_AT + this._ringRot\n'
                                '\n'),
                               ('    }\n'
                                '\n'
                                '    this._pin(ctx, R, STONE_AT, m)\n'
                                '    this._stone(ctx, R, m, t)\n'
                                '\n'
                                '    // thin metal bezel round the moon hub (the hub itself is DOM, on '
                                'top)\n',
                                '    }\n'
                                '\n'
                                '    // the pin comes free: lifted out along its own line and set back, the '
                                'stone alight\n'
                                '    const kp = (t - this._pinT) / PIN_MS, free = kp >= 0 && kp < 1 ? '
                                'Math.sin(Math.PI * kp) : 0\n'
                                '    ctx.save(); ctx.translate(Math.cos(rad(STONE_AT)) * R * 0.3 * free, '
                                'Math.sin(rad(STONE_AT)) * R * 0.3 * free)\n'
                                '    this._pin(ctx, R, STONE_AT, m)\n'
                                '    this._stone(ctx, R, m, t, free > 0.05)\n'
                                '    ctx.restore()\n'
                                '\n'
                                '    // thin metal bezel round the moon hub (the hub itself is DOM, on '
                                'top)\n'),
                               ('  }\n'
                                '\n'
                                '  _stone(ctx, R, m, t) {\n'
                                '    const x = Math.cos(rad(STONE_AT)) * G.RING * R, y = '
                                'Math.sin(rad(STONE_AT)) * G.RING * R\n'
                                '    const cr = G.STONE * R, lit = this._stoneLit || this._badgeGlow\n'
                                '    if (lit) {\n'
                                '      const k = 0.55 + 0.45 * Math.sin(t / 260)\n',
                                '  }\n'
                                '\n'
                                '  _stone(ctx, R, m, t, free = false) {\n'
                                '    const x = Math.cos(rad(STONE_AT)) * G.RING * R, y = '
                                'Math.sin(rad(STONE_AT)) * G.RING * R\n'
                                '    const cr = G.STONE * R, lit = this._stoneLit || this._badgeGlow || '
                                'free\n'
                                '    if (lit) {\n'
                                '      const k = 0.55 + 0.45 * Math.sin(t / 260)\n')],
 'js/game/scenes/locations/perspectiveScene.js': [('        this._menuHub?.open()\n'
                                                   '      },\n'
                                                   '      onLongPressCancel: () => {\n'
                                                   '        this.joystick?.drawChargeGlow(0)\n',
                                                   '        this._menuHub?.open()\n'
                                                   '      },\n'
                                                   '      // turn the hoop a full round, the pin comes free: '
                                                   'the menu (as the long press does; both are kept, to '
                                                   'compare)\n'
                                                   '      onRingRelease: () => {\n'
                                                   '        if (this._moonOwner?.claimsLongPress?.()) '
                                                   'return\n'
                                                   '        if (Date.now() - (this._lastMenuClose ?? 0) < '
                                                   '400) return\n'
                                                   '        this._menuHub?.open()\n'
                                                   '      },\n'
                                                   '      onLongPressCancel: () => {\n'
                                                   '        this.joystick?.drawChargeGlow(0)\n')],
 'js/game/scenes/locations/skye/faicheCourse.js': [('    const S = SCRIPT.duel\n'
                                                    '    this._atMark(() => {\n'
                                                    '      this.tells = 0; this.hitsMade = 0; this.coachAt = '
                                                    '0; this.saluted = true; this.reads = 0; this.plainHits '
                                                    '= 0; this.slowHit = false\n'
                                                    '      const open = go => (again || this.repeating === '
                                                    "'duel') ? go() : this._speech(S.intro, go)\n"
                                                    '      open(() => {\n',
                                                    '    const S = SCRIPT.duel\n'
                                                    '    this._atMark(() => {\n'
                                                    '      this.tells = 0; this.hitsMade = 0; this.coachAt = '
                                                    '0; this.saluted = true; this.reads = 0; this.plainHits '
                                                    '= 0; this.slowHit = false; this.slowSeen = false\n'
                                                    '      const open = go => (again || this.repeating === '
                                                    "'duel') ? go() : this._speech(S.intro, go)\n"
                                                    '      open(() => {\n'),
                                                   ('        need: 1, hint: again ? S.hint : (S.focusHint || '
                                                    'S.hint), after: this._holdOf(S.go) + '
                                                    'this._holdOf(S.focusHint), giveUp: DUEL_GIVE_UP_MS,\n'
                                                    '        on: (name, d) => {\n'
                                                    "          if (!again && name === 'hit' && d.on === "
                                                    "'foe' && slowed()) { this.slowHit = true; return true "
                                                    '}    // the moment: his speech about it is earned\n'
                                                    "          return name === 'boutOver' && d.won\n"
                                                    '        },\n',
                                                    '        need: 1, hint: again ? S.hint : (S.focusHint || '
                                                    'S.hint), after: this._holdOf(S.go) + '
                                                    'this._holdOf(S.focusHint), giveUp: DUEL_GIVE_UP_MS,\n'
                                                    '        on: (name, d) => {\n'
                                                    "          if (name === 'focus' && d?.on) this.slowSeen "
                                                    '= true                       // you went into the slow '
                                                    'at some point\n'
                                                    '          if (!again) {\n'
                                                    '            // one valid blow ends it, however it '
                                                    'fares: it lands (in the slow or not), or he turns it '
                                                    'aside (not the salute reminder,\n'
                                                    '            // which has no wind-up)\n'
                                                    "            if (name === 'hit' && d.on === 'foe') { if "
                                                    '(slowed()) this.slowHit = true; return true }\n'
                                                    "            if (name === 'parried' && d.by === 'foe' && "
                                                    'd.wind !== undefined) return true\n'
                                                    '          }\n'
                                                    "          return name === 'boutOver' && d.won\n"
                                                    '        },\n'),
                                                   ('            this._boutOff()\n'
                                                    "            if (again) return this._finish('duel', 0)\n"
                                                    '            // "There! Thou wert in the moment..." -- '
                                                    'only if you were (a blow landed in the slow); won '
                                                    "another way, the draft's\n"
                                                    '            // `= won` (if it has one) is said instead '
                                                    '-- then the end of the lesson\n'
                                                    '            const after = S.after\n'
                                                    '            const said = this.slowHit ? asList(S.moment '
                                                    '|| []) : asList(S.won || [])\n'
                                                    "            this._wrapUp('duel', { say: [...said, "
                                                    '...asList(after?.say ?? after ?? [])].filter(Boolean), '
                                                    'ask: after?.ask })\n'
                                                    '          })\n',
                                                    '            this._boutOff()\n'
                                                    "            if (again) return this._finish('duel', 0)\n"
                                                    '            // "There! Thou wert in the moment..." -- '
                                                    'then the end of the lesson. If you never went into the '
                                                    "slow, the draft's\n"
                                                    '            // `= won` is said instead, when it has one '
                                                    "(it is the moment's speech otherwise: a blow, landed or "
                                                    'turned aside, is enough)\n'
                                                    '            const after = S.after\n'
                                                    '            const won = asList(S.won || [])\n'
                                                    '            const said = (this.slowSeen || !won.length) '
                                                    '? asList(S.moment || []) : won\n'
                                                    "            this._wrapUp('duel', { say: [...said, "
                                                    '...asList(after?.say ?? after ?? [])].filter(Boolean), '
                                                    'ask: after?.ask })\n'
                                                    '          })\n')]}

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

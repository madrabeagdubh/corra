#!/usr/bin/env python3
"""Corra patch, round 5: the salute text, the shove, the catch (apply after corra_bullet_time.py).

  faicheCourse.dlg + courseLines.js   the salute card redrafted, in the order of the gesture (brow, sky, earth); three
                                      small fixes to the Irish in it (déanaim, le súile, intinn ghlan)
  faicheCourse.js   the shove: a pressed-on push is no longer "blocked" after the first shove; the sword lands at your
                    face and is caught (_catchSword: a knock, held, lowered, a sheathe sound), then the draw drill begins
  meleeView.js      the catch pose (CATCH_*), catchSword(), catching()
  meleeBout.js      keeps drawing while the catch plays

Run from the repo root. Idempotent: a second run changes nothing.
"""
import os, sys

EDITS = {'js/game/combat/meleeBout.js': [('  }\n'
                                  "  // PGR skips idle redraws; the fight must keep drawing while it's live\n"
                                  '  animating() { const m = this.melee; return !!this.lens?.active || '
                                  'm.enGarde || m.combat || m.bout.over || m.foes.some(f => f.from || '
                                  "f.state !== 'idle') || this.focus.k < 1 || !!this.view._punch || "
                                  'this.view.now() - this.view.a.ease < 1000 }\n'
                                  '\n'
                                  '  _onEvent(name, d) {\n',
                                  '  }\n'
                                  "  // PGR skips idle redraws; the fight must keep drawing while it's live\n"
                                  '  animating() { const m = this.melee; return !!this.lens?.active || '
                                  'm.enGarde || m.combat || m.bout.over || m.foes.some(f => f.from || '
                                  "f.state !== 'idle') || this.focus.k < 1 || !!this.view._punch || "
                                  'this.view.catching() || this.view.now() - this.view.a.ease < 1000 }\n'
                                  '\n'
                                  '  _onEvent(name, d) {\n')],
 'js/game/combat/meleeView.js': [('export const DRAW_MS = 900, SHEATHE_MS = 900\n'
                                  'export const SALUTE_MS = 1600\n'
                                  'const clamp01 = u => Math.max(0, Math.min(1, u))\n'
                                  'const easeOut = u => 1 - (1 - clamp01(u)) ** 3\n',
                                  'export const DRAW_MS = 900, SHEATHE_MS = 900\n'
                                  'export const SALUTE_MS = 1600\n'
                                  '// A sword thrown to you and caught: held up before the face a moment '
                                  '(hilt in the hand, blade upright), lowered to the\n'
                                  '// scabbard, slid home. catchSword() begins it; weaponPose() plays it; '
                                  'faicheCourse.js waits CATCH_MS before going on.\n'
                                  'export const CATCH_HOLD_MS = 1100, CATCH_LOWER_MS = 650\n'
                                  'export const CATCH_MS = CATCH_HOLD_MS + CATCH_LOWER_MS + 0.45 * '
                                  'SHEATHE_MS\n'
                                  'const clamp01 = u => Math.max(0, Math.min(1, u))\n'
                                  'const easeOut = u => 1 - (1 - clamp01(u)) ** 3\n'),
                                 ('        break\n'
                                  "      case 'swing': buzz(d.flip ? 7 : 12); break\n"
                                  "      case 'enGarde': A.garde = now; A.spent = false; break\n"
                                  "      case 'atEase': A.ease = now; break\n"
                                  "      case 'salute': if (d.by === 'player') A.salute = now; break   // "
                                  'yours only when you choose to (swipe up again)\n',
                                  '        break\n'
                                  "      case 'swing': buzz(d.flip ? 7 : 12); break\n"
                                  "      case 'enGarde': A.garde = now; A.spent = false; A.catchT = -1e9; "
                                  'break\n'
                                  "      case 'atEase': A.ease = now; break\n"
                                  "      case 'salute': if (d.by === 'player') A.salute = now; break   // "
                                  'yours only when you choose to (swipe up again)\n'),
                                 ('  }\n'
                                  '  saluting(start) { const ms = this.now() - start; return ms >= 0 && ms < '
                                  'SALUTE_MS }\n'
                                  '\n'
                                  '  // How your body stands this frame (PGR asks, through the scene), as '
                                  'a\n',
                                  '  }\n'
                                  '  saluting(start) { const ms = this.now() - start; return ms >= 0 && ms < '
                                  'SALUTE_MS }\n'
                                  '  /** the sword has just been caught (thrown to you): see CATCH_MS */\n'
                                  '  catchSword() { this.a.catchT = this.now() }\n'
                                  '  catching() { return this.now() - (this.a.catchT ?? -1e9) < CATCH_MS }\n'
                                  '\n'
                                  '  // How your body stands this frame (PGR asks, through the scene), as '
                                  'a\n'),
                                 ('    // hand brought to its mouth -- then the blade slid home.\n'
                                  '    if (!m.enGarde) {\n'
                                  '      const ke = (now - A.ease) / SHEATHE_MS\n'
                                  '      if (ke >= 1) return null\n',
                                  '    // hand brought to its mouth -- then the blade slid home.\n'
                                  '    if (!m.enGarde) {\n'
                                  '      // caught: held up before the face, then lowered to the scabbard '
                                  'and slid home\n'
                                  '      const kc = now - (A.catchT ?? -1e9)\n'
                                  '      if (kc >= 0 && kc < CATCH_MS) {\n'
                                  '        const hw = (this.pgr._playerHeightMult ?? 1.8) * '
                                  '(this.pgr.constructor.PLAYER_SCALE ?? 1)\n'
                                  '        const up = this._saluteAngle(0.3 * SALUTE_MS, side, guard), h = '
                                  "this._saluteHand(0.3 * SALUTE_MS, side)      // the salute's brow pose\n"
                                  '        if (kc < CATCH_HOLD_MS) return { angle: up, hand: [h[0] * hw, '
                                  'h[1] * hw] }\n'
                                  '        const kl = (kc - CATCH_HOLD_MS) / CATCH_LOWER_MS\n'
                                  '        if (kl < 1) {\n'
                                  '          const u = easeIO(kl), end = R.gripAt(1)\n'
                                  '          return { angle: lerp(up, R.axisDeg + side * 360, u), hand: '
                                  '[lerp(h[0] * hw, end[0], u), lerp(h[1] * hw, end[1], u)] }\n'
                                  '        }\n'
                                  '        return { sheath: 1 - easeIO((kc - CATCH_HOLD_MS - CATCH_LOWER_MS) '
                                  '/ (0.45 * SHEATHE_MS)) }\n'
                                  '      }\n'
                                  '      const ke = (now - A.ease) / SHEATHE_MS\n'
                                  '      if (ke >= 1) return null\n')],
 'js/game/scenes/locations/skye/courseLines.js': [('    "intro": [\n'
                                                   '      {\n'
                                                   '        "en": "Now we salute",\n'
                                                   '        "ga": "Anois, beannaímid"\n'
                                                   '      },\n'
                                                   '      {\n',
                                                   '    "intro": [\n'
                                                   '      {\n'
                                                   '        "en": "Now we salute.",\n'
                                                   '        "ga": "Anois, beannaímid"\n'
                                                   '      },\n'
                                                   '      {\n'
                                                   '        "en": "Hilt to the brow. Blade to the sky. Point '
                                                   'to the earth.",\n'
                                                   '        "ga": "Hilt to the brow. Blade to the sky. Point '
                                                   'to the earth."\n'
                                                   '      },\n'
                                                   '      {\n'),
                                                  ('      },\n'
                                                   '      {\n'
                                                   '        "en": "I enter with clean intent.",\n'
                                                   '        "ga": "Ar aghaidh liom le intinn glan."\n'
                                                   '      },\n'
                                                   '      {\n'
                                                   '        "en": "What blood I spill here, I do so with '
                                                   'open eyes.",\n'
                                                   '        "ga": "Cibé fuil a dhoirtim anseo, deanaim sin '
                                                   'le shúile oscailte."\n'
                                                   '      }\n'
                                                   '    ],\n',
                                                   '      },\n'
                                                   '      {\n'
                                                   '        "en": "What blood I spill here, I do so with '
                                                   'open eyes.",\n'
                                                   '        "ga": "Cibé fuil a dhoirtim anseo, déanaim sin '
                                                   'le súile oscailte."\n'
                                                   '      },\n'
                                                   '      {\n'
                                                   '        "en": "I enter with clean intent.",\n'
                                                   '        "ga": "Ar aghaidh liom le intinn ghlan."\n'
                                                   '      }\n'
                                                   '    ],\n')],
 'js/game/scenes/locations/skye/faicheCourse.js': [('import { prepareSword, SWORD_ID } from '
                                                    "'../../../combat/meleeBout.js'\n"
                                                    'import { figureAt } from '
                                                    "'../../../combat/figureSword.js'\n"
                                                    'import { SALUTE_MS, DRAW_MS } from '
                                                    "'../../../combat/meleeView.js'\n"
                                                    'import { DialogueHarp } from '
                                                    "'../../../systems/music/dialogueHarp.js'\n"
                                                    'import { Bodhran } from '
                                                    "'../../../systems/music/bodhran.js'\n",
                                                    'import { prepareSword, SWORD_ID } from '
                                                    "'../../../combat/meleeBout.js'\n"
                                                    'import { figureAt } from '
                                                    "'../../../combat/figureSword.js'\n"
                                                    'import { SALUTE_MS, DRAW_MS, CATCH_MS, CATCH_HOLD_MS, '
                                                    "CATCH_LOWER_MS } from '../../../combat/meleeView.js'\n"
                                                    'import { DialogueHarp } from '
                                                    "'../../../systems/music/dialogueHarp.js'\n"
                                                    'import { Bodhran } from '
                                                    "'../../../systems/music/bodhran.js'\n"),
                                                   ('        this.throwFx = null\n'
                                                    '        this._giveSword()\n'
                                                    '        this._later(700, () => this._speech(S.caught, '
                                                    '() => this._drawNow()))\n'
                                                    '      })\n'
                                                    '    })\n'
                                                    '  }\n'
                                                    '  /** The draw, drilled: "Draw." / what he makes of it '
                                                    '/ "Put it away." -- DRAWS times, ending drawn.\n',
                                                    '        this.throwFx = null\n'
                                                    '        this._giveSword()\n'
                                                    '        this._catchSword()\n'
                                                    '        this._later(CATCH_MS + 400, () => '
                                                    'this._speech(S.caught, () => this._drawNow()))\n'
                                                    '      })\n'
                                                    '    })\n'
                                                    '  }\n'
                                                    '  /** it arrives at your face: caught with a clap on '
                                                    'the hilt, held up a moment, then lowered to the '
                                                    'scabbard and slid home.\n'
                                                    '   *  (meleeView.js: weaponPose / CATCH_MS.) A '
                                                    'significant moment: nothing else moves while it lasts. '
                                                    '*/\n'
                                                    '  _catchSword() {\n'
                                                    '    const sc = this.scene\n'
                                                    '    this._lock(true)\n'
                                                    '    this.scene._melee?.view?.catchSword?.()\n'
                                                    "    SoundBoard.playWeb('BLADE_KNOCK', sc, { material: "
                                                    "'wood', hard: 0.45, volume: 0.42 })        // the hilt "
                                                    'in the palm\n'
                                                    "    SoundBoard.playWeb('BLADE_THUD', sc, { hard: 0.12, "
                                                    'volume: 0.22 })\n'
                                                    '    this._later(CATCH_HOLD_MS + CATCH_LOWER_MS * 0.75, '
                                                    "() => SoundBoard.playWeb('SWORD_SHEATHE', sc, { "
                                                    "material: 'wood', volume: 0.1 }))\n"
                                                    '  }\n'
                                                    '  /** The draw, drilled: "Draw." / what he makes of it '
                                                    '/ "Put it away." -- DRAWS times, ending drawn.\n'),
                                                   ('    }\n'
                                                    '  }\n'
                                                    '  /** walked into him: a shoulder (the scene calls '
                                                    'this). It only counts in the shoving half. */\n'
                                                    '  _spaceShove(dx, dy) {\n'
                                                    '    const sp = this.space, m = this.m\n'
                                                    "    if (!sp || sp.kind !== 'shove' || sp.phase === "
                                                    "'end' || sp.down) return true\n"
                                                    '    if (this.t - (this.lastShove || -1e9) < 450) return '
                                                    'true\n'
                                                    '    this.lastShove = this.t\n'
                                                    '    const f = m.foe, S = SCRIPT.space\n',
                                                    '    }\n'
                                                    '  }\n'
                                                    '  /** A step into a figure leans and is then "blocked" '
                                                    'until the press is let go (player.js: a held press '
                                                    "doesn't bump twice).\n"
                                                    '   *  For a shove that is wrong: he is thrown back, the '
                                                    'way is clear, and a press held on should carry on after '
                                                    'him\n'
                                                    '   *  (it felt like the next shove waited on a timer). '
                                                    'So the block is lifted at once. */\n'
                                                    '  _pressOn() { try { this.scene.player._blockedKey = '
                                                    'null } catch (_) {} }\n'
                                                    '  /** walked into him: a shoulder (the scene calls '
                                                    'this). It only counts in the shoving half. */\n'
                                                    '  _spaceShove(dx, dy) {\n'
                                                    '    const sp = this.space, m = this.m\n'
                                                    '    this._pressOn()\n'
                                                    "    if (!sp || sp.kind !== 'shove' || sp.phase === "
                                                    "'end' || sp.down) return true\n"
                                                    '    if (this.t - (this.lastShove || -1e9) < 250) return '
                                                    'true\n'
                                                    '    this.lastShove = this.t\n'
                                                    '    const f = m.foe, S = SCRIPT.space\n'),
                                                   ('    const k = Math.min(1, (this.t - fx.t0) / fx.ms)\n'
                                                    '    const x = a.x + (b.x - a.x) * k\n'
                                                    '    const y = a.y - a.h * 0.6 + ((b.y - b.h * 0.6) - '
                                                    '(a.y - a.h * 0.6)) * k - Math.sin(Math.PI * k) * a.h * '
                                                    '0.7\n'
                                                    '    const size = Math.max(14, b.w * 0.7 + (a.w - b.w) * '
                                                    '(1 - k) * 0.5)\n'
                                                    '    const img = sc.itemSheet?.getCanvas?.(2492)\n',
                                                    '    const k = Math.min(1, (this.t - fx.t0) / fx.ms)\n'
                                                    '    const x = a.x + (b.x - a.x) * k\n'
                                                    '    const y = a.y - a.h * 0.6 + ((b.y - b.h * 0.85) - '
                                                    '(a.y - a.h * 0.6)) * k - Math.sin(Math.PI * k) * a.h * '
                                                    '0.7      // lands at your face\n'
                                                    '    const size = Math.max(14, b.w * 0.7 + (a.w - b.w) * '
                                                    '(1 - k) * 0.5)\n'
                                                    '    const img = sc.itemSheet?.getCanvas?.(2492)\n')],
 'tools/dialogue/drafts/faicheCourse.dlg': [('\n'
                                             '= intro\n'
                                             '\n'
                                             'Now we salute\n'
                                             '% Anois, beannaímid\n'
                                             '\n'
                                             'Salute inward, salute in the heart.\n'
                                             '% Beannaigh go hinmheánach, beannaigh sa chroí.\n'
                                             '\n'
                                             'I enter with clean intent.\n'
                                             '% Ar aghaidh liom le intinn glan.\n'
                                             'What blood I spill here, I do so with open eyes.\n'
                                             '% Cibé fuil a dhoirtim anseo, deanaim sin le shúile oscailte.\n'
                                             '\n'
                                             '# the first call\n',
                                             '\n'
                                             '= intro\n'
                                             '# In the order of the gesture, so that it can be said along '
                                             'with it: the hilt to the brow (the eyes: what he says to\n'
                                             '# his own heart), the blade to the sky, the point down and out '
                                             '(the clean intent).\n'
                                             '\n'
                                             'Now we salute.\n'
                                             '% Anois, beannaímid\n'
                                             '\n'
                                             'Hilt to the brow. Blade to the sky. Point to the earth.\n'
                                             '%\n'
                                             '\n'
                                             'Salute inward, salute in the heart.\n'
                                             '% Beannaigh go hinmheánach, beannaigh sa chroí.\n'
                                             '\n'
                                             'What blood I spill here, I do so with open eyes.\n'
                                             '% Cibé fuil a dhoirtim anseo, déanaim sin le súile oscailte.\n'
                                             '\n'
                                             'I enter with clean intent.\n'
                                             '% Ar aghaidh liom le intinn ghlan.\n'
                                             '\n'
                                             '# the first call\n')]}

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

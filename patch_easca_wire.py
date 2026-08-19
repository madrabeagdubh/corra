#!/usr/bin/env python3
"""
Wire the Easca keyboard into dialogue.

    * Give your name
    @easca playerName
    @note gave_name
    > [[ the player types it ]]
    < And {playerName}. I shall remember it.

An option carrying @easca opens the keyboard when chosen and waits. What the
player types goes into the Phaser registry under the given key — the same
place selectedChampion lives — and {key} in any reply is replaced with it.

Closing the keyboard without sending is not a dead end: the exchange
continues with the token left as-is, so write the reply to survive it, or
gate on the note if it matters.

Idempotent. Run from repo root, after patch_easca_prompt.py.
"""

import sys, pathlib

PANEL   = pathlib.Path('js/game/ui/encounterPanel.js')
COMPILE = pathlib.Path('tools/dialogue/compile.mjs')
SCENE   = pathlib.Path('js/game/scenes/locations/perspectiveScene.js')


# ── compiler ─────────────────────────────────────────────────────────────

C1_A = "    case 'silent': target.silent = true; return\n"
C1_P = ("    case 'silent': target.silent = true; return\n"
        "    case 'easca':  target.easca = rest || 'playerName'; return\n")

C2_A = """  'exit', 'silent', 'ga', 'en', 'say', 'sayEn', 'replyGa', 'replyEn',
  'exchange', 'again',
"""
C2_P = """  'exit', 'silent', 'easca', 'ga', 'en', 'say', 'sayEn', 'replyGa', 'replyEn',
  'exchange', 'again',
"""

C3_A = "      if (o.silent) L.push('@silent')\n"
C3_P = ("      if (o.silent) L.push('@silent')\n"
        "      if (o.easca)  L.push('@easca ' + o.easca)\n")

C4_A = "//   @silent                         no reply card\n"
C4_P = ("//   @silent                         no reply card\n"
        "//   @easca playerName               (options) type a word; {playerName}\n"
        "//                                   in any reply is replaced with it\n")


# ── panel ────────────────────────────────────────────────────────────────

P1_A = """  _resolveOption(opt, d, idx, stateKey, total, zone) {
    this._applyEffects(opt)
"""

P1_P = """  /**
   * Substitute {key} with whatever is in the registry under that key, so a
   * reply can use a word the player typed. An unknown key is left alone
   * rather than blanked -- a visible {name} in a card is a bug you can see,
   * where a silent gap is one you can't.
   */
  _fill(text) {
    if (!text || String(text).indexOf('{') < 0) return text
    return String(text).replace(/\\{(\\w+)\\}/g, (m, k) => {
      try {
        const v = this._scene?.registry?.get(k)
        if (v) return v
      } catch (e) {}
      return m
    })
  }

  _resolveOption(opt, d, idx, stateKey, total, zone) {
    // The keyboard comes up BEFORE any of this option's effects land, so a
    // player who backs out hasn't already set its notes. Re-entered once the
    // player is done, with the flag stopping it prompting a second time.
    if (opt.easca && !this._eascaDone && this._scene?.promptEasca) {
      this._scene.promptEasca((text) => {
        if (!this._isOpen) return
        if (text) {
          try { this._scene.registry?.set(opt.easca, String(text).trim()) } catch (e) {}
        }
        this._eascaDone = true
        try { this._resolveOption(opt, d, idx, stateKey, total, zone) }
        finally { this._eascaDone = false }
      })
      return
    }

    this._applyEffects(opt)
"""


P2_A = """      this._chainShow({
        exchange:   opt.exchange,
        irish:      '',
        english:    '',
"""

P2_P = """      this._chainShow({
        exchange:   opt.exchange.map(t => ({
          say:      this._fill(t.say),
          sayEn:    this._fill(t.sayEn),
          replyGa:  this._fill(t.replyGa),
          replyEn:  this._fill(t.replyEn),
        })),
        irish:      '',
        english:    '',
"""


P3_A = """      this._chainShow({
        irish:      opt.replyGa || '',
        english:    opt.replyEn || '',
        heroGa:     this._heroLines(opt).ga,
        heroEn:     this._heroLines(opt).en,
"""

P3_P = """      this._chainShow({
        irish:      this._fill(opt.replyGa || ''),
        english:    this._fill(opt.replyEn || ''),
        heroGa:     this._fill(this._heroLines(opt).ga),
        heroEn:     this._fill(this._heroLines(opt).en),
"""


P4_A = "    this._ladder      = null\n    this._seenNodes   = null\n"
P4_P = "    this._ladder      = null\n    this._eascaDone   = false\n    this._seenNodes   = null\n"


COMPILE_EDITS = [(C4_A, C4_P), (C1_A, C1_P), (C2_A, C2_P), (C3_A, C3_P)]
PANEL_EDITS   = [(P1_A, P1_P), (P2_A, P2_P), (P3_A, P3_P), (P4_A, P4_P)]


def apply(path, edits, marker, name):
    src = path.read_text()
    if marker in src:
        print(f'{name} already patched')
        return
    for i, (a, _) in enumerate(edits, 1):
        if a not in src:
            sys.exit(f'{name} anchor {i} not found — the file has moved on')
    for a, p in edits:
        src = src.replace(a, p, 1)
    path.write_text(src)
    print(f'patched {path}')


def main():
    for p in (PANEL, COMPILE, SCENE):
        if not p.exists():
            sys.exit(f'not found: {p} — run from repo root')
    if 'promptEasca' not in SCENE.read_text():
        sys.exit('run patch_easca_prompt.py first')

    apply(COMPILE, COMPILE_EDITS, "case 'easca'", 'compile.mjs')
    apply(PANEL,   PANEL_EDITS,   '_fill(text)',  'encounterPanel.js')


if __name__ == '__main__':
    main()

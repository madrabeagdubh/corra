#!/usr/bin/env python3
"""
patch_silence_rule.py -- a dialogue line that is nothing but dots is
SILENCE. The card still holds its beat, but no harp plays over it.

Run from repo root. Idempotent.

WHY
    d3 node 0 answers the player's first two hails with "..." -- Odhrán is
    lying on the bank and will not respond. But the harp scheduler gates
    purely on how much text a beat carries:

        if (!(chars[g] > 0)) continue          // textPanel ~1142

    "..." is three characters, so it scores as speech and gets a fragment
    of the champion's theme played over it. A melody under a refusal to
    speak reads as the game filling the gap the character is refusing to
    fill -- which is precisely backwards. The silence is the line.

WHAT IT DOES NOT DO
    The beat's LENGTH is untouched. _revealChars still counts those three
    characters, so the pause after a "..." is sized exactly as before and
    the player still sits in it. Only the harp fragment is suppressed.
    Muting and shortening are different things; shortening would throw the
    pause away, which is the opposite of what is wanted.

    The bodhrán is untouched too. It is driven by the option buttons
    arriving (Bodhran.soloBeats, ~1102), not by spoken beats, so the
    options still land on the drum after a silent card. That is right: the
    drum is the player being handed the choice, not the NPC speaking.

WHAT COUNTS AS SILENCE
    A row whose Irish AND English are both empty or made only of dots,
    ellipses and whitespace -- and which is not entirely empty. So "...",
    "…", ". . ." all qualify, in either language or both. A beat is silent
    only if every non-portrait row in it is silent, so a card mixing "..."
    with a real line still gets its music.

    Portrait rows are skipped, as they already are for character counting;
    a beat that is only a portrait scores zero characters and was already
    silent by the existing gate.
"""

import os, sys

TARGET = 'js/game/ui/textPanel.js'


def main():
    if not os.path.exists(TARGET):
        sys.exit(f'{TARGET} not found -- run from repo root')
    src = open(TARGET).read()

    if '_revealSilent' in src:
        print('  [skip] silence rule already applied')
        return

    # ── 1. the test ──────────────────────────────────────────────────────
    anchor = "import { Bodhran }      from '../systems/music/bodhran.js'"
    if anchor not in src:
        sys.exit('  [FAIL] Bodhran import not found')
    src = src.replace(anchor, anchor + '''

// A line made only of dots is SILENCE, not speech. The card still holds its
// beat -- the pause is the point -- but no harp fragment is played over it.
// Without this, "..." scores three characters, reads as speech to the harp
// scheduler, and gets a phrase of the champion's theme laid over a character
// who is pointedly refusing to answer.
//
// Matches "...", "…", ". . ." in either language. The empty string matches
// too, which is what lets a row with Irish still blank count as silent when
// its English is dots.
const SILENCE_RE = /^[.\\u2026\\s]*$/

// True only when there IS something there and all of it is dots. A row with
// nothing in either language is not a beat of silence, it is an empty row.
function rowIsSilence(r) {
  const ga = (r.ga || '').trim()
  const en = (r.en || '').trim()
  if (!ga && !en) return false
  return SILENCE_RE.test(ga) && SILENCE_RE.test(en)
}''', 1)

    # ── 2. per-beat accumulation ─────────────────────────────────────────
    old = """    const _chars = new Array(_present.length).fill(0)
    const _hero  = new Array(_present.length).fill(false)
    const _syll  = new Array(_present.length).fill(0)"""
    if old not in src:
        sys.exit('  [FAIL] per-beat accumulator block not found')
    src = src.replace(old, old + """
    // Starts true and is cleared by the first row carrying real words, so a
    // beat is silent only if EVERYTHING in it is. A card mixing "..." with a
    // spoken line still gets its music.
    const _silent = new Array(_present.length).fill(true)""", 1)

    old = "      if (r.isHero) _hero[r.group] = true"
    if old not in src:
        sys.exit('  [FAIL] isHero accumulation line not found')
    src = src.replace(old, old + """
      if (!rowIsSilence(r)) _silent[r.group] = false""", 1)

    old = "    this._revealChars = _chars"
    if old not in src:
        sys.exit('  [FAIL] _revealChars assignment not found')
    src = src.replace(old, old + """
    this._revealSilent = _silent""", 1)

    # ── 3. the harp gate ─────────────────────────────────────────────────
    old = "        if (!(chars[g] > 0)) continue"
    if old not in src:
        sys.exit('  [FAIL] harp per-beat gate not found')
    src = src.replace(old, """        if (!(chars[g] > 0)) continue
        // Silence gets no melody. Note this skips the harp ONLY -- the beat
        // keeps the full length _revealChars gave it, so the pause is still
        // felt. Muting and shortening are different things.
        if (this._revealSilent?.[g]) continue""", 1)

    open(TARGET, 'w').write(src)
    print('  [ok]   SILENCE_RE + rowIsSilence added')
    print('  [ok]   _revealSilent accumulated per beat')
    print('  [ok]   harp skips silent beats (length unchanged)')


if __name__ == '__main__':
    print('silence rule:')
    main()
    print('done. rebuild with:')
    print('  NODE_OPTIONS=--max-old-space-size=3072 npm run build')

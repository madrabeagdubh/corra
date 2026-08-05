#!/usr/bin/env python3
"""
patch_dialogue_hero_beat.py

Closes the long gap between the player's line and the NPC's reply.

Run from the repo root, AFTER patch_dialogue_beats.py:

    python3 patch_dialogue_hero_beat.py

Idempotent. One file: js/game/ui/textPanel.js

THE GAP
-------

The player's own line was being held for its full syllable-paced reading time --
around 4.2s for a ten-syllable line -- plus the NPC's portrait beat, which is
where the five or six seconds came from.

That's a regression I introduced. CARD_READ_HERO_WEIGHT existed for exactly this
reason and I removed it in the read-along patch, on the grounds that pacing the
player's line differently would put the melody out of step with the text. True
while notes were tracking syllables; meaningless the moment they stopped. The
player has already read their own line -- it was the button they pressed.

It's back, at 0.25. A ten-syllable line now holds about 1.3s, and with the
portrait beat the reply lands about 1.6s after it.

THE HARP GOES QUIET ON THE PLAYER'S LINES
-----------------------------------------

Shortening the block alone wouldn't have worked: a motif is roughly 2.2s, so it
would have run straight over the NPC's next phrase and muddied both.

So hero blocks no longer take a motif. The division that leaves is cleaner than
what it replaces, and worth stating plainly:

    the harp is the NPC's voice
    the bodhrán is the player's

You tap, the drum answers, your words appear, and then she speaks. The
octave-up harp phrase on hero lines was doing the same job the drum now does,
less clearly, and at the cost of four seconds a turn.

It also means consecutive motifs are all hers, so the tune's question-and-answer
shape runs across HER lines without the player's interleaved into it -- which
should make the call-and-response read more clearly, not less.
"""

import io
import os
import sys

UI_PATH = os.path.join('js', 'game', 'ui', 'textPanel.js')

MARKER = 'CARD_READ_HERO_WEIGHT'


def die(msg):
    print('  !! %s' % msg)
    sys.exit(1)


def replace_once(src, old, new, label):
    n = src.count(old)
    if n != 1:
        die('expected 1 match for %s, found %d' % (label, n))
    print('  -- %s' % label)
    return src.replace(old, new, 1)


OLD_CONST = """const CARD_READ_TAIL_BEATS = 2       // breath after the last note of a block"""

NEW_CONST = """const CARD_READ_TAIL_BEATS = 2       // breath after the last note of a block
// The player has already read their own line -- it was the button they pressed.
// Holding it for full reading time put five or six seconds between a choice and
// the reply to it.
const CARD_READ_HERO_WEIGHT = 0.25"""


OLD_READ = """      const readMs = (g) => {
        const s   = syll[g] || 0
        const raw = (s <= 0)
          ? CARD_READ_MIN_MS
          : Math.min(CARD_READ_MAX_MS, s * SYLLABLE_MS + tail)
        return Math.max(unit, Math.round(raw / unit) * unit)
      }"""

NEW_READ = """      const hero   = this._revealHero || []
      const readMs = (g) => {
        const s = (syll[g] || 0) * (hero[g] ? CARD_READ_HERO_WEIGHT : 1)
        const raw = (s <= 0)
          ? CARD_READ_MIN_MS
          : Math.min(CARD_READ_MAX_MS, s * SYLLABLE_MS + tail)
        return Math.max(unit, Math.round(raw / unit) * unit)
      }"""


OLD_SOUND = """      for (let g = 0; g < beats; g++) {
        if (!(chars[g] > 0)) continue
        const isHero = !!(this._revealHero && this._revealHero[g])"""

NEW_SOUND = """      for (let g = 0; g < beats; g++) {
        if (!(chars[g] > 0)) continue
        const isHero = !!(this._revealHero && this._revealHero[g])
        // The harp is the NPC's voice; the bodhrán is the player's. A motif
        // runs about 2.2s and the player's line is now held for barely more
        // than a second, so a phrase here would run straight over hers. The
        // drum has already marked the choice, which is the same job done more
        // clearly -- and it leaves every consecutive motif hers, so the tune's
        // question-and-answer shape runs across her lines uninterrupted.
        if (isHero) continue"""


def main():
    if not os.path.isfile(UI_PATH):
        die('%s not found -- run this from the repo root.' % UI_PATH)

    with io.open(UI_PATH, encoding='utf-8') as fh:
        src = fh.read()

    if MARKER in src:
        print('Already patched -- nothing to do.')
        return

    if 'CARD_READ_TAIL_BEATS' not in src:
        die('run patch_dialogue_beats.py first -- this builds on it.')

    print('Patching %s' % UI_PATH)
    src = replace_once(src, OLD_CONST, NEW_CONST, 'hero reading weight')
    src = replace_once(src, OLD_READ, NEW_READ, 'shorter hold on the player line')
    src = replace_once(src, OLD_SOUND, NEW_SOUND, 'harp sits out the player line')

    with io.open(UI_PATH, 'w', encoding='utf-8') as fh:
        fh.write(src)

    print('Done.')


if __name__ == '__main__':
    main()

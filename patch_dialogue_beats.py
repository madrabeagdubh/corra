#!/usr/bin/env python3
"""
patch_dialogue_beats.py

Turns the pauses between blocks from arbitrary milliseconds into beats of the
tune that's playing.

Run from the repo root, AFTER patch_moon_peek_fix.py:

    python3 patch_dialogue_beats.py

Idempotent. One file: js/game/ui/textPanel.js

WHAT CHANGES
------------

1. The lead-ins shrink, and stop being magic numbers.

   CARD_OPEN_LEAD_MS was 950ms and CARD_CHOICE_LEAD_MS 340ms -- silence
   inserted to keep the opening flourish and the choice stroke from being
   stepped on. They did that job and then overstayed: a full second of nothing
   at the head of a conversation reads as the game hesitating.

   Both are now counted in the harp's own beats -- two beats after the
   flourish, one after a choice. At the current tempo that's 360ms and 180ms.
   A beat, as asked.

2. Block lengths snap to the beat grid.

   This is the part that should help the music more than the shortening does.
   A block used to last syllables x SYLLABLE_MS + a tail, which is an arbitrary
   number of milliseconds, so every phrase started at a random offset against
   the previous one. Rounding each block to a whole number of beats means the
   next motif begins ON the grid the last one was played on.

   The gap between two lines then reads as a rest IN the music rather than a
   hole in it -- which is, I think, most of what made the pauses feel
   disruptive rather than merely long.

Everything is derived from DialogueHarp.unitMs(), so changing the tempo moves
the pauses with it and they stay in proportion.
"""

import io
import os
import sys

UI_PATH = os.path.join('js', 'game', 'ui', 'textPanel.js')

MARKER = 'CARD_OPEN_LEAD_BEATS'


def die(msg):
    print('  !! %s' % msg)
    sys.exit(1)


def replace_once(src, old, new, label):
    n = src.count(old)
    if n != 1:
        die('expected 1 match for %s, found %d' % (label, n))
    print('  -- %s' % label)
    return src.replace(old, new, 1)


OLD_LEADS = """const CARD_OPEN_LEAD_MS    = 950     // after the opening flourish
const CARD_CHOICE_LEAD_MS  = 340     // after a choice touch"""

NEW_LEADS = """// Counted in the harp's beats rather than milliseconds, so they stay in
// proportion if the tempo moves -- and so a pause is a rest in the music
// instead of a gap beside it. These were 950ms and 340ms, which did the job of
// keeping the flourish from being stepped on and then overstayed: a full
// second at the head of a conversation reads as the game hesitating.
const CARD_OPEN_LEAD_BEATS   = 2     // after the opening flourish
const CARD_CHOICE_LEAD_BEATS = 1     // after a choice stroke"""


OLD_TAIL = """const CARD_READ_TAIL_MS    = 650"""
NEW_TAIL = """const CARD_READ_TAIL_BEATS = 2       // breath after the last note of a block"""


OLD_READ = """      // A block lasts as long as its melody: one note per syllable, plus a
      // breath. A portrait beat has no syllables and gets the floor.
      const syll   = this._revealSyll || []
      const readMs = (g) => {
        const s = syll[g] || 0
        if (s <= 0) return CARD_READ_MIN_MS
        return Math.min(CARD_READ_MAX_MS, s * SYLLABLE_MS + CARD_READ_TAIL_MS)
      }
      const beats  = Math.max(1, this._revealBeats ?? 1)
      const chars  = this._revealChars || []
      const lead   = this._cardIsFirst ? CARD_OPEN_LEAD_MS : CARD_CHOICE_LEAD_MS
      const starts = [lead]"""

NEW_READ = """      // A block lasts as long as its melody: one note per syllable, plus a
      // breath. A portrait beat has no syllables and gets the floor.
      //
      // Then it's rounded to a whole number of the harp's beats. Without that,
      // every block started at an arbitrary offset from the last one and each
      // motif began wherever it happened to land -- which is most of why the
      // pauses felt disruptive rather than merely long. On the grid, the gap
      // between two lines is a rest in the music instead of a hole in it.
      const unit   = DialogueHarp.unitMs() || 180
      const tail   = CARD_READ_TAIL_BEATS * unit
      const syll   = this._revealSyll || []
      const readMs = (g) => {
        const s   = syll[g] || 0
        const raw = (s <= 0)
          ? CARD_READ_MIN_MS
          : Math.min(CARD_READ_MAX_MS, s * SYLLABLE_MS + tail)
        return Math.max(unit, Math.round(raw / unit) * unit)
      }
      const beats  = Math.max(1, this._revealBeats ?? 1)
      const chars  = this._revealChars || []
      const lead   = unit * (this._cardIsFirst
        ? CARD_OPEN_LEAD_BEATS
        : CARD_CHOICE_LEAD_BEATS)
      const starts = [lead]"""


# `unit` is now in scope from the top of the branch; drop the inner shadow.
OLD_SHADOW = """        const unit  = DialogueHarp.unitMs()
        // Metre of the tune actually playing, so a jig gets a jig"""

NEW_SHADOW = """        // Metre of the tune actually playing, so a jig gets a jig"""


def main():
    if not os.path.isfile(UI_PATH):
        die('%s not found -- run this from the repo root.' % UI_PATH)

    with io.open(UI_PATH, encoding='utf-8') as fh:
        src = fh.read()

    if MARKER in src:
        print('Already patched -- nothing to do.')
        return

    if 'CARD_OPEN_LEAD_MS' not in src:
        die('expected constants missing -- is the patch chain up to date?')

    print('Patching %s' % UI_PATH)
    src = replace_once(src, OLD_LEADS, NEW_LEADS, 'lead-ins counted in beats')
    src = replace_once(src, OLD_TAIL, NEW_TAIL, 'tail counted in beats')
    src = replace_once(src, OLD_READ, NEW_READ, 'blocks snap to the beat grid')
    src = replace_once(src, OLD_SHADOW, NEW_SHADOW, 'reuse the hoisted unit')

    with io.open(UI_PATH, 'w', encoding='utf-8') as fh:
        fh.write(src)

    print('Done.')


if __name__ == '__main__':
    main()

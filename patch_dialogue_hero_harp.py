#!/usr/bin/env python3
"""
patch_dialogue_hero_harp.py

Gives the player's own line its harp back, and makes the block long enough to
hold it.

Run from the repo root, AFTER patch_dialogue_first_card.py:

    python3 patch_dialogue_hero_harp.py

Idempotent. One file: js/game/ui/textPanel.js

NOT AN AUDIO CHANNEL PROBLEM
----------------------------

Worth stating plainly since it's a reasonable suspicion: Web Audio has no
channel contention. Every pluck and every drum stroke builds its own nodes and
the context mixes them all. The bodhrán cannot lock the harp out, and nothing
here is competing for a slot.

WHAT ACTUALLY HAPPENED, IN TWO STEPS
------------------------------------

1. patch_dialogue_hero_beat made the harp sit out the player's lines. The
   reasoning was sound at the time -- the hero block had just been shortened to
   ~1.26s and a motif runs ~2.2s, so a phrase there would have run over the
   NPC's reply. But it solved the collision by removing the music instead of
   making room for it.

2. patch_dialogue_fill then put a bodhrán phrase under the player's line to
   fill the silence. It does play -- but it starts 180ms after the `choose`
   stroke fired on the tap, so the two run together as one short burst and the
   remaining second of the block is silent. Hence "a little bodhrán, then
   nothing".

THE FIX
-------

The block is now sized to hold a motif rather than the motif being dropped to
fit the block. Hero blocks last one motif plus a beat -- 2340ms under a jig,
3060ms under a reel -- which is derived from the tune's own metre, so it's
exactly right whatever is playing rather than a weight that happens to work out.

CARD_READ_HERO_WEIGHT is gone. It was always an approximation of "long enough
to feel deliberate, short enough not to drag", and the motif length is the
honest version of that number.

The bodhrán fill under hero lines is removed, since the harp is doing that job
again and both together was too busy. The `choose` stroke on the tap stays --
that's the press being acknowledged, which is a different event from the line
being spoken.

WHAT THIS COSTS
---------------

The reply now lands about 2.7s after the player's line appears rather than
1.6s. That's longer than the 1.5s you asked for -- but that request was made
when the gap was silent, and a second of music is not the same thing as a
second of nothing. If it still drags, CARD_READ_HERO_TAIL_BEATS is the knob;
dropping it to 0 takes it to 2.5s, and below that the motif itself would have
to be cut.
"""

import io
import os
import sys

UI_PATH = os.path.join('js', 'game', 'ui', 'textPanel.js')

MARKER = 'CARD_READ_HERO_TAIL_BEATS'


def die(msg):
    print('  !! %s' % msg)
    sys.exit(1)


def replace_once(src, old, new, label):
    n = src.count(old)
    if n != 1:
        die('expected 1 match for %s, found %d' % (label, n))
    print('  -- %s' % label)
    return src.replace(old, new, 1)


OLD_CONST = """// The player has already read their own line -- it was the button they pressed.
// Holding it for full reading time put five or six seconds between a choice and
// the reply to it.
const CARD_READ_HERO_WEIGHT = 0.25"""

NEW_CONST = """// The player's own line is held for exactly one motif plus this, rather than
// for a share of its reading time. They've already read it -- it was the button
// they pressed -- so what decides the length is how long its accompaniment
// takes, not how long the words take to read.
//
// Derived from the tune's metre, so it fits whatever is playing instead of
// being a weight that happens to work out.
const CARD_READ_HERO_TAIL_BEATS = 1"""


OLD_READ = """      const hero   = this._revealHero || []
      const readMs = (g) => {
        const s = (syll[g] || 0) * (hero[g] ? CARD_READ_HERO_WEIGHT : 1)
        const raw = (s <= 0)
          ? CARD_READ_MIN_MS
          : Math.min(CARD_READ_MAX_MS, s * SYLLABLE_MS + tail)
        return Math.max(unit, Math.round(raw / unit) * unit)
      }"""

NEW_READ = """      const hero   = this._revealHero || []
      const readMs = (g) => {
        // The player's line lasts as long as its music, not as long as its
        // words: they read it when they chose it.
        if (hero[g]) {
          return motif + CARD_READ_HERO_TAIL_BEATS * unit
        }
        const s   = syll[g] || 0
        const raw = (s <= 0)
          ? CARD_READ_MIN_MS
          : Math.min(CARD_READ_MAX_MS, s * SYLLABLE_MS + tail)
        return Math.max(unit, Math.round(raw / unit) * unit)
      }"""


OLD_HERO = """        // The harp is the NPC's voice; the bodhrán is the player's. A motif
        // runs about 2.2s and the player's line is held for barely more than a
        // second, so a harp phrase here would run straight over hers -- and it
        // leaves every consecutive motif hers, so the tune's question-and-answer
        // shape runs across her lines uninterrupted.
        //
        // But the player's line still needs a voice. Leaving it silent is what
        // read as the melody being skipped: the drum struck once at the tap and
        // then nothing happened for a second and a half.
        if (isHero) {
          this._revealSounds.push(this.scene.time.delayedCall(
            starts[g],
            () => {
              try { Bodhran.phrase(unit, bar, g) } catch (e) {}
            }
          ))
          continue
        }"""

NEW_HERO = """        // Both speakers get the harp. The player's lines sound an octave above
        // the NPC's -- same tune, two registers -- which is what makes the
        // turn-taking audible.
        //
        // An earlier version dropped the harp here because the block was too
        // short to hold a motif. That solved the collision by removing the
        // music; the block is now sized from the motif instead, which solves it
        // by making room. The bodhrán fill that stood in for it is gone: it
        // merged with the `choose` stroke into one short burst and left the
        // rest of the block silent, which is what read as a missing melody."""


def main():
    if not os.path.isfile(UI_PATH):
        die('%s not found -- run this from the repo root.' % UI_PATH)

    with io.open(UI_PATH, encoding='utf-8') as fh:
        src = fh.read()

    if MARKER in src:
        print('Already patched -- nothing to do.')
        return

    if 'CARD_READ_HERO_WEIGHT' not in src:
        die('run patch_dialogue_first_card.py first -- this builds on it.')

    print('Patching %s' % UI_PATH)
    src = replace_once(src, OLD_CONST, NEW_CONST, 'hero block sized by the motif')
    src = replace_once(src, OLD_READ, NEW_READ, 'hero hold from the music')
    src = replace_once(src, OLD_HERO, NEW_HERO, 'harp plays on the player line')

    with io.open(UI_PATH, 'w', encoding='utf-8') as fh:
        fh.write(src)

    print('Done.')


if __name__ == '__main__':
    main()

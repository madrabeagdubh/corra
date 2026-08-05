#!/usr/bin/env python3
"""
patch_dialogue_fill.py

Fills the silence under the player's line, and stops the options waiting so
long after the melody ends.

Run from the repo root, AFTER patch_dialogue_hero_beat.py:

    python3 patch_dialogue_fill.py

Idempotent. Two files:

    js/game/systems/music/bodhran.js
    js/game/ui/textPanel.js

1. THE "SKIPPED" MELODY
-----------------------

Nothing is being skipped -- that's the harp sitting out the player's line, which
the last patch did deliberately so a 2.2s motif wouldn't run over the NPC's
reply. But it left silence there, and silence in the middle of an exchange reads
as something failing to happen.

The stated division was that the harp is the NPC's voice and the bodhrán is the
player's. It just wasn't being honoured: the drum played once at the tap and
then stopped, so the player's own line had no voice at all.

So the drum now plays a phrase UNDER the player's line, in the metre of the
tune, for as long as the line is up. The tap stroke and this run together as one
continuous fill rather than a hit followed by a hole.

2. THE OPTIONS WAITED TOO LONG
------------------------------

Buttons arrived at a fraction of the block's reading time -- CARD_BTN_AT of it --
which had nothing to do with when the music actually stopped. On a long line
the motif finished after ~2.2s and the options came at 4.5s, so the gap grew
with the length of the line for no reason connected to anything the player
could hear.

They're now timed off the MELODY: the length of a motif plus a couple of beats.
That's a fixed, musical relationship -- the phrase ends, a beat passes, the drum
picks it up -- and it no longer stretches on longer speeches.

The block's own reading time still governs how long the text stays before the
next one; only the options' arrival is decoupled from it. Options appearing
early costs nothing, since they don't interrupt reading.
"""

import io
import os
import sys

BOD_PATH = os.path.join('js', 'game', 'systems', 'music', 'bodhran.js')
UI_PATH  = os.path.join('js', 'game', 'ui', 'textPanel.js')

MARKER = 'CARD_BTN_GAP_BEATS'


def die(msg):
    print('  !! %s' % msg)
    sys.exit(1)


def replace_once(src, old, new, label):
    n = src.count(old)
    if n != 1:
        die('expected 1 match for %s, found %d' % (label, n))
    print('  -- %s' % label)
    return src.replace(old, new, 1)


# ======================================================== bodhran.js edits

B_OLD = """  /** takka clicka takka tap. */
  choose(unitMs = FALLBACK_UNIT) { this._play(CHOOSE, unitMs) }"""

B_NEW = """  /** takka clicka takka tap. */
  choose(unitMs = FALLBACK_UNIT) { this._play(CHOOSE, unitMs) }

  /**
   * One phrase, no closing stroke -- for playing underneath the player's own
   * line while the harp is silent. `variant` alternates the figure so repeated
   * turns in a conversation don't all sound identical.
   */
  phrase(unitMs = FALLBACK_UNIT, barUnits = 8, variant = 0) {
    const { bars } = figuresFor(barUnits)
    this._play(bars[Math.abs(variant) % bars.length], unitMs)
  }"""


# ======================================================== textPanel.js edits

U_OLD_CONST = """const CARD_BTN_AT          = 0.6
const CARD_BTN_MIN_MS      = 900"""

U_NEW_CONST = """// The options used to arrive at a fraction of the block's reading time, which
// had nothing to do with when the music stopped -- so on a long line the motif
// ended at ~2.2s and the buttons came at 4.5s, the gap growing with the length
// of the speech for no reason the player could hear.
//
// They're timed off the melody now: a motif, then a couple of beats, then the
// drum picks it up. A fixed musical relationship that doesn't stretch.
const CARD_BTN_GAP_BEATS   = 2
const CARD_BTN_MIN_MS      = 700"""


U_OLD_UNIT = """      const unit   = DialogueHarp.unitMs() || 180
      const tail   = CARD_READ_TAIL_BEATS * unit"""

U_NEW_UNIT = """      const unit   = DialogueHarp.unitMs() || 180
      // Metre of the tune actually playing -- 6 to a bar for a jig, 8 for a
      // reel. Hoisted because the drum fill, the option timing and the solo
      // all need it.
      const bar    = DialogueHarp.barUnits() || 8
      const motif  = bar * 2 * unit          // PHRASE_BARS worth, i.e. one motif
      const tail   = CARD_READ_TAIL_BEATS * unit"""


U_OLD_BTNBEAT = """      const btnBeat = starts[beats - 1] + Math.max(
        CARD_BTN_MIN_MS,
        Math.round(readMs(beats - 1) * CARD_BTN_AT)
      )"""

U_NEW_BTNBEAT = """      const btnBeat = starts[beats - 1] + Math.max(
        CARD_BTN_MIN_MS,
        motif + CARD_BTN_GAP_BEATS * unit
      )"""


U_OLD_HERO = """        // The harp is the NPC's voice; the bodhrán is the player's. A motif
        // runs about 2.2s and the player's line is now held for barely more
        // than a second, so a phrase here would run straight over hers. The
        // drum has already marked the choice, which is the same job done more
        // clearly -- and it leaves every consecutive motif hers, so the tune's
        // question-and-answer shape runs across her lines uninterrupted.
        if (isHero) continue"""

U_NEW_HERO = """        // The harp is the NPC's voice; the bodhrán is the player's. A motif
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


U_OLD_SHADOW = """        // Metre of the tune actually playing, so a jig gets a jig
        // accompaniment and the buttons land on its downbeats rather than a
        // reel's.
        const bar   = DialogueHarp.barUnits()
        const marks = Bodhran.soloBeats("""

U_NEW_SHADOW = """        // `bar` is hoisted above -- the buttons land on the downbeats of the
        // tune's own metre.
        const marks = Bodhran.soloBeats("""


def main():
    for p in (BOD_PATH, UI_PATH):
        if not os.path.isfile(p):
            die('%s not found -- run this from the repo root.' % p)

    with io.open(BOD_PATH, encoding='utf-8') as fh:
        bod = fh.read()
    with io.open(UI_PATH, encoding='utf-8') as fh:
        ui = fh.read()

    if MARKER in ui:
        print('Already patched -- nothing to do.')
        return

    if 'CARD_READ_HERO_WEIGHT' not in ui:
        die('run patch_dialogue_hero_beat.py first -- this builds on it.')

    print('Patching %s' % BOD_PATH)
    bod = replace_once(bod, B_OLD, B_NEW, 'phrase() without a closing stroke')

    print('Patching %s' % UI_PATH)
    ui = replace_once(ui, U_OLD_CONST, U_NEW_CONST, 'options timed off the melody')
    ui = replace_once(ui, U_OLD_UNIT, U_NEW_UNIT, 'hoist metre and motif length')
    ui = replace_once(ui, U_OLD_BTNBEAT, U_NEW_BTNBEAT, 'button arrival')
    ui = replace_once(ui, U_OLD_HERO, U_NEW_HERO, 'drum under the player line')
    ui = replace_once(ui, U_OLD_SHADOW, U_NEW_SHADOW, 'reuse the hoisted metre')

    with io.open(BOD_PATH, 'w', encoding='utf-8') as fh:
        fh.write(bod)
    with io.open(UI_PATH, 'w', encoding='utf-8') as fh:
        fh.write(ui)

    print('Done.')


if __name__ == '__main__':
    main()

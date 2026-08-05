#!/usr/bin/env python3
"""
patch_dialogue_skip_arm.py

Stops the gesture that opens a card from immediately skipping it.

Run from the repo root, AFTER patch_dialogue_fill.py:

    python3 patch_dialogue_skip_arm.py

Idempotent. One file: js/game/ui/textPanel.js

THE BUG
-------

The first card of a conversation had no harp, and neither did the card you get
back when you return to the options by swipe. Every other card was fine.

Not a scheduling fault -- the phrase was being scheduled and then cancelled.
_beginScroll registers the tap-to-skip listener the moment the card is built,
and _completeReveal() fires the bodhrán solo while killing the harp timers. So a
skipped card sounds exactly like the symptom: drum, no harp.

Which cards skip themselves depends entirely on how they were opened:

  mid-conversation -- built from a button's onTap, which fires BUTTON.flashMs
                      (180ms) after the finger has already lifted. No pointer
                      event is in flight, nothing skips, harp plays.

  first card       -- built from the badge tap.
  menu return      -- built from a swipe.
                      In both, the gesture is still in progress when the
                      listener arms, so the card instantly completes its own
                      reveal.

THE FIX
-------

The skip listener is armed but ignores anything arriving in the first
CARD_SKIP_ARM_MS. A skip is meant to be a deliberate second gesture -- "I've
read this, move on" -- and no such intention can exist 20ms after the card
appeared, before a single word has been shown.

Timestamp guard rather than a delayed registration, so there's no window where a
genuine early tap is dropped on the floor instead of being ignored on purpose.
The distinction matters if the arm time is ever raised: an ignored tap does
nothing, whereas an unregistered one would leave the player tapping a card that
can't respond yet.
"""

import io
import os
import sys

UI_PATH = os.path.join('js', 'game', 'ui', 'textPanel.js')

MARKER = 'CARD_SKIP_ARM_MS'


def die(msg):
    print('  !! %s' % msg)
    sys.exit(1)


def replace_once(src, old, new, label):
    n = src.count(old)
    if n != 1:
        die('expected 1 match for %s, found %d' % (label, n))
    print('  -- %s' % label)
    return src.replace(old, new, 1)


OLD_CONST = """const CARD_BTN_GAP_BEATS   = 2"""

NEW_CONST = """// How long after a card appears before tap-to-skip will listen. The gesture
// that OPENS a card -- the badge tap, or the swipe back to the options -- is
// often still in flight when the listener arms, and without this guard the card
// instantly skips itself: the drum fires, the harp timers are cancelled, and
// the line arrives in silence. A skip is a deliberate second gesture, and no
// such intention can exist before the first word is on screen.
const CARD_SKIP_ARM_MS     = 350

const CARD_BTN_GAP_BEATS   = 2"""


OLD_SKIP = """      if (btnBeat > 0) {
        this._revealSkip = () => this._completeReveal()
        this.scene.input.on('pointerdown', this._revealSkip)
      }"""

NEW_SKIP = """      if (btnBeat > 0) {
        // Guarded by timestamp rather than by registering late: an early tap is
        // then ignored on purpose rather than falling into a window where no
        // listener exists at all. Matters if the arm time is ever raised.
        const armAt = performance.now() + CARD_SKIP_ARM_MS
        this._revealSkip = () => {
          if (performance.now() < armAt) return
          this._completeReveal()
        }
        this.scene.input.on('pointerdown', this._revealSkip)
      }"""


def main():
    if not os.path.isfile(UI_PATH):
        die('%s not found -- run this from the repo root.' % UI_PATH)

    with io.open(UI_PATH, encoding='utf-8') as fh:
        src = fh.read()

    if MARKER in src:
        print('Already patched -- nothing to do.')
        return

    if 'CARD_BTN_GAP_BEATS' not in src:
        die('run patch_dialogue_fill.py first -- this builds on it.')

    print('Patching %s' % UI_PATH)
    src = replace_once(src, OLD_CONST, NEW_CONST, 'arm delay constant')
    src = replace_once(src, OLD_SKIP, NEW_SKIP, 'skip ignores the opening gesture')

    with io.open(UI_PATH, 'w', encoding='utf-8') as fh:
        fh.write(src)

    print('Done.')


if __name__ == '__main__':
    main()

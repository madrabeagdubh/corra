#!/usr/bin/env python3
"""
patch_dialogue_first_card.py

The first card's melody was being buried inside the opening flourish. Also
removes the diagnostic logging.

Run from the repo root, AFTER patch_harp_trace.py:

    python3 patch_dialogue_first_card.py

Idempotent. Three files:

    js/game/ui/textPanel.js
    js/game/systems/music/dialogueHarp.js
    (the [trace] logging added by patch_harp_trace.py is removed)

WHAT THE TRACE SHOWED
---------------------

Not silence. The harp was playing all along:

    [trace] card beats=1 ... starts=[360]      first=true      <- first build
    [EncounterPanel] portrait loaded
    [trace] card beats=2 ... starts=[180,540]  first=false     <- rebuild
    [trace] phrase: playing 10 notes npc=true

Portraits load asynchronously and the card is rebuilt when the image arrives. On
that rebuild _keepChrome is true, so _cardIsFirst becomes FALSE and the
conversation's opening lead collapses from two beats to one. The melody starts
540ms in -- while the opening flourish, which rings for 2.4 seconds, is still
sounding. Same instrument, overlapping register, so the tune is buried inside
its own fanfare. Audible in the logs, inaudible in the ear.

The swipe-return to the options is the same story: short lead, same overlap.

THE FIX, IN TWO PARTS
---------------------

1. _cardIsFirst stops meaning "the chrome was rebuilt" and starts meaning what
   it was always supposed to mean: the harp hasn't played yet in this
   conversation. DialogueHarp.hasSounded() answers that directly, and it's
   immune to however many times a card gets rebuilt while portraits and other
   assets arrive.

   This is the general form of a bug that has now bitten three times in this
   file -- graphicKey being null on the first build, the NPC tune not resolving,
   and now this. Anything derived from "is this the first build of a card" is
   wrong, because the first build is not the only build.

2. The flourish gets out of the way. OPEN_SECS 2.4 -> 1.2 so it decays rather
   than hanging over the entrance, and the opening lead goes to four beats
   (720ms), by which point it has. Both together, because either alone still
   leaves them overlapping.
"""

import io
import os
import sys

UI_PATH   = os.path.join('js', 'game', 'ui', 'textPanel.js')
HARP_PATH = os.path.join('js', 'game', 'systems', 'music', 'dialogueHarp.js')

MARKER = 'hasSounded'


def die(msg):
    print('  !! %s' % msg)
    sys.exit(1)


def replace_once(src, old, new, label):
    n = src.count(old)
    if n != 1:
        die('expected 1 match for %s, found %d' % (label, n))
    print('  -- %s' % label)
    return src.replace(old, new, 1)


# -------------------------------------------------- remove the trace logging

T_UI_1_OLD = """      console.log('[trace] card beats=' + beats,
                  'chars=' + JSON.stringify(chars.map(c => Math.round(c || 0))),
                  'hero=' + JSON.stringify(this._revealHero || []),
                  'starts=' + JSON.stringify(starts),
                  'btn=' + btnBeat,
                  'first=' + this._cardIsFirst)

      for (let g = 0; g < beats; g++) {"""

T_UI_1_NEW = """      for (let g = 0; g < beats; g++) {"""


T_UI_2_OLD = """        const fire = () => {
          console.log('[trace] fired harp beat=' + g)
          try { DialogueHarp.phrase({ isHero, blockMs }) } catch (e) {
            console.log('[trace] phrase threw:', e?.message)
          }
        }
        console.log('[trace] scheduled harp beat=' + g + ' at=' + starts[g] + 'ms')"""

T_UI_2_NEW = """        const fire = () => {
          try { DialogueHarp.phrase({ isHero, blockMs }) } catch (e) {}
        }"""


T_H_OLD = """    if (!frag.length) { console.log('[trace] phrase: empty fragment'); return }
    console.log('[trace] phrase: playing', frag.length, 'notes',
                'npc=' + (this.npc.notes.length > 0))"""

T_H_NEW = """    if (!frag.length) return"""


# ------------------------------------------------------------- the real fix

H_OLD_SOUNDED = """  /** Whether a conversation is already under way. */
  isStarted() { return this._started }"""

H_NEW_SOUNDED = """  /** Whether a conversation is already under way. */
  isStarted() { return this._started }

  /**
   * Whether any melody has sounded yet in this conversation. Used instead of
   * "is this the first build of the card", which is a different and much less
   * reliable question -- cards are rebuilt whenever a portrait or other asset
   * finishes loading, and anything derived from build order is wrong the moment
   * that happens.
   */
  hasSounded() { return this.played > 0 }"""


H_OLD_OPEN = """const OPEN_SECS     = 2.4    // the long ring when a conversation begins"""

H_NEW_OPEN = """// Shortened from 2.4: at that length the flourish was still ringing when the
// first melody started, and the tune was buried inside its own fanfare. It
// needs to announce the conversation and then get out of the way.
const OPEN_SECS     = 1.2"""


U_OLD_FIRST = """    // Which lead-in this card gets: the long one at the head of a conversation,
    // the short one after a choice.
    if (type === 'encounter_card') this._cardIsFirst = !_keepChrome"""

U_NEW_FIRST = """    // Which lead-in this card gets: the long one at the head of a conversation,
    // the short one after a choice.
    //
    // Deliberately NOT `!_keepChrome`. Cards are rebuilt when the portrait
    // finishes loading, and on that rebuild the chrome is kept -- so the
    // opening card lost its lead a few hundred milliseconds after gaining it,
    // and the melody started underneath the flourish. What actually matters is
    // whether any melody has played yet, which no amount of rebuilding changes.
    if (type === 'encounter_card') {
      this._cardIsFirst = !DialogueHarp.hasSounded()
    }"""


U_OLD_LEAD = """const CARD_OPEN_LEAD_BEATS   = 2     // after the opening flourish"""
U_NEW_LEAD = """const CARD_OPEN_LEAD_BEATS   = 4     // after the opening flourish"""


def main():
    for p in (UI_PATH, HARP_PATH):
        if not os.path.isfile(p):
            die('%s not found -- run this from the repo root.' % p)

    with io.open(UI_PATH, encoding='utf-8') as fh:
        ui = fh.read()
    with io.open(HARP_PATH, encoding='utf-8') as fh:
        harp = fh.read()

    if MARKER in harp:
        print('Already patched -- nothing to do.')
        return

    if '[trace]' in ui:
        print('Removing diagnostic logging')
        ui = replace_once(ui, T_UI_1_OLD, T_UI_1_NEW, 'card trace')
        ui = replace_once(ui, T_UI_2_OLD, T_UI_2_NEW, 'schedule/fire trace')
    if '[trace]' in harp:
        harp = replace_once(harp, T_H_OLD, T_H_NEW, 'phrase trace')

    print('Patching %s' % HARP_PATH)
    harp = replace_once(harp, H_OLD_SOUNDED, H_NEW_SOUNDED, 'hasSounded()')
    harp = replace_once(harp, H_OLD_OPEN, H_NEW_OPEN, 'flourish gets out of the way')

    print('Patching %s' % UI_PATH)
    ui = replace_once(ui, U_OLD_LEAD, U_NEW_LEAD, 'opening lead to four beats')
    ui = replace_once(ui, U_OLD_FIRST, U_NEW_FIRST, 'first card survives the rebuild')

    with io.open(UI_PATH, 'w', encoding='utf-8') as fh:
        fh.write(ui)
    with io.open(HARP_PATH, 'w', encoding='utf-8') as fh:
        fh.write(harp)

    print('Done.')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
patch_harp_trace.py

Diagnostic only. Adds logging to find why the first card's harp is silent.
Nothing about behaviour changes.

Run from the repo root:

    python3 patch_harp_trace.py

Idempotent. Remove it later with patch_harp_trace_off.py, or just search for
[trace] and delete those lines.

WHAT IT LOGS
------------

Four points along the path a phrase takes, so the break shows up as the last
line that prints:

  [trace] card beats=N chars=[...] hero=[...] starts=[...] btn=N
      -- what _beginScroll computed. If chars[] is 0 for the NPC's beat, the
         loop skips it and nothing else will print.

  [trace] scheduled harp beat=N at=Nms
      -- a phrase was queued for that beat.

  [trace] fired harp beat=N
      -- the timer actually ran. If "scheduled" appears without "fired", the
         timer was cancelled -- _killRevealTweens, from a skip or a rebuild.

  [trace] phrase: <reason>
      -- from inside DialogueHarp.phrase(), saying whether it played or which
         guard sent it home: no context, no tune, or an empty fragment.

READING IT
----------

Open a conversation and compare the first card against a later one. The first
line that differs between them is the fault. In particular:

  scheduled but never fired      -> something is cancelling it; look for a
                                    second [trace] card line right after, which
                                    would mean the card was rebuilt
  fired but "phrase: no tune"    -> begin() hasn't run or ran with no champion
  never scheduled                -> chars[] is empty for that beat, so the
                                    problem is in _buildEncounterCard, not here
  two [trace] card lines per card -> the async portrait re-show is rebuilding
                                    and the second build is the one that counts
"""

import io
import os
import sys

UI_PATH   = os.path.join('js', 'game', 'ui', 'textPanel.js')
HARP_PATH = os.path.join('js', 'game', 'systems', 'music', 'dialogueHarp.js')

MARKER = '[trace]'


def die(msg):
    print('  !! %s' % msg)
    sys.exit(1)


def replace_once(src, old, new, label):
    n = src.count(old)
    if n != 1:
        die('expected 1 match for %s, found %d' % (label, n))
    print('  -- %s' % label)
    return src.replace(old, new, 1)


U_OLD_LOOP = """      for (let g = 0; g < beats; g++) {
        if (!(chars[g] > 0)) continue
        const isHero = !!(this._revealHero && this._revealHero[g])"""

U_NEW_LOOP = """      console.log('[trace] card beats=' + beats,
                  'chars=' + JSON.stringify(chars.map(c => Math.round(c || 0))),
                  'hero=' + JSON.stringify(this._revealHero || []),
                  'starts=' + JSON.stringify(starts),
                  'btn=' + btnBeat,
                  'first=' + this._cardIsFirst)

      for (let g = 0; g < beats; g++) {
        if (!(chars[g] > 0)) continue
        const isHero = !!(this._revealHero && this._revealHero[g])"""


U_OLD_FIRE = """        const blockMs = readMs(g)
        const fire = () => {
          try { DialogueHarp.phrase({ isHero, blockMs }) } catch (e) {}
        }"""

U_NEW_FIRE = """        const blockMs = readMs(g)
        const fire = () => {
          console.log('[trace] fired harp beat=' + g)
          try { DialogueHarp.phrase({ isHero, blockMs }) } catch (e) {
            console.log('[trace] phrase threw:', e?.message)
          }
        }
        console.log('[trace] scheduled harp beat=' + g + ' at=' + starts[g] + 'ms')"""


H_OLD = """    if (!ctx || !this.notes.length) return

    const frag = this._takeFragment(blockMs)"""

H_NEW = """    if (!ctx) { console.log('[trace] phrase: no audio context'); return }
    if (!this.notes.length) { console.log('[trace] phrase: no tune'); return }

    const frag = this._takeFragment(blockMs)"""


H_OLD2 = """    const v    = this._voice()
    const frag = this._takeFragment(blockMs, v)
    this._saveVoice(v)
    if (!frag.length) return"""

H_NEW2 = """    const v    = this._voice()
    const frag = this._takeFragment(blockMs, v)
    this._saveVoice(v)
    if (!frag.length) { console.log('[trace] phrase: empty fragment'); return }
    console.log('[trace] phrase: playing', frag.length, 'notes',
                'npc=' + (this.npc.notes.length > 0))"""


def main():
    for p in (UI_PATH, HARP_PATH):
        if not os.path.isfile(p):
            die('%s not found -- run this from the repo root.' % p)

    with io.open(UI_PATH, encoding='utf-8') as fh:
        ui = fh.read()
    with io.open(HARP_PATH, encoding='utf-8') as fh:
        harp = fh.read()

    if MARKER in ui:
        print('Already patched -- nothing to do.')
        return

    print('Patching %s' % UI_PATH)
    ui = replace_once(ui, U_OLD_LOOP, U_NEW_LOOP, 'log what the card computed')
    ui = replace_once(ui, U_OLD_FIRE, U_NEW_FIRE, 'log schedule and fire')

    print('Patching %s' % HARP_PATH)
    if H_OLD in harp:
        harp = replace_once(harp, H_OLD, H_NEW, 'log the early guards')
    harp = replace_once(harp, H_OLD2, H_NEW2, 'log the fragment')

    with io.open(UI_PATH, 'w', encoding='utf-8') as fh:
        fh.write(ui)
    with io.open(HARP_PATH, 'w', encoding='utf-8') as fh:
        fh.write(harp)

    print('Done. Play one conversation and send the [trace] lines.')


if __name__ == '__main__':
    main()

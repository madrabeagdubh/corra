#!/usr/bin/env python3
"""
patch_dial_to_druid.py — after the dial, go straight to the druid's speech.

Idempotent. Run after patch_dial_no_restart.py.

THE BUG
  patch_dial_handoff.py skipped the moon-swipe branch when the dial had run:

      if (!this._moonSwipeDone && !this._dialRan && phase > 0.5) {
          ...
          this._driftMoonToBottom();
          this.settleMoon();
      }

  But that branch is not only the swipe response — it is the ONLY thing that
  calls settleMoon(), which pans the camera and then runs
  _startPostSettleSequence(), which is the druid's speech and the constellation
  texts. Skipping it left the scene sitting on the Amergin line forever.

  I removed the trigger along with the thing it triggered.

THE FIX
  When the dial has run, do at once what the swipe would have done, minus the
  parts the dial already handled:

    - no Amergin line: it is blank rather than a random quote
    - no lyric interval
    - no _driftMoonToBottom(): the moon is ALREADY at rest, having been placed
      there by the dial's pull-back. Drifting it again would move a moon the
      player just watched arrive.
    - settleMoon() straight away, which leads to
      'Tríd oichí fada gan codladh a bhanríonn,'

Edits:
  js/introModal.js

Run from the repo root:  python3 patch_dial_to_druid.py
"""

import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
IM = os.path.join(ROOT, 'js/introModal.js')

if not os.path.exists(IM):
    sys.exit('!! missing: %s\n   run this from the repo root (~/Corra)' % IM)

with open(IM, 'r', encoding='utf-8') as f:
    src = f.read()

if '_beginAfterDial' in src:
    print('\n=== patch_dial_to_druid.py ===')
    print('  already : dial hands straight to the druid\n')
    sys.exit(0)

applied = []

# -- 1. no Amergin line when the dial has spoken ----------------------------
A = """        let currentLyricIndex = Math.floor(Math.random() * AMERGIN_LINES.length);
        let line              = AMERGIN_LINES[currentLyricIndex];
        this._frozenAmerginLine = line;"""
B = """        let currentLyricIndex = Math.floor(Math.random() * AMERGIN_LINES.length);
        // The dial's poem has replaced the looping Amergin line. With the dial,
        // the overlay starts empty and is reused by the constellation texts.
        let line = this._dialRan ? { ga: '', en: '' }
                                 : AMERGIN_LINES[currentLyricIndex];
        this._frozenAmerginLine = line;"""
if A not in src:
    sys.exit('!! Amergin line assignment not found')
src = src.replace(A, B, 1)
applied.append('Amergin line blank when the dial ran')

# -- 2. go straight on ------------------------------------------------------
A = """        if (wrapper) {
            const moonD    = this._moonWidget.moonD;"""
B = """        /* The dial has said the poem, taken the first touch and left its moon at
           rest. Everything the swipe used to do still has to happen — it was
           the only caller of settleMoon(), which pans the camera and then runs
           _startPostSettleSequence(): the druid's speech and the constellation
           texts. Skipping the branch skipped the trigger too, which is why the
           scene sat on the Amergin line. */
        if (this._dialRan) this._beginAfterDial();

        if (wrapper) {
            const moonD    = this._moonWidget.moonD;"""
if A not in src:
    sys.exit('!! moon wrapper block not found')
src = src.replace(A, B, 1)
applied.append('_beginAfterDial() called')

# -- 3. the method ----------------------------------------------------------
A = "    // ── settleMoon ────────────────────────────────────────────────────────────"
B = """    /* What the moon swipe used to do, minus what the dial already did.

       No _driftMoonToBottom(): the moon is already at its rest position,
       placed there by the dial's pull-back. Drifting it again would move a
       moon the player has just watched arrive. */
    _beginAfterDial() {
        if (this._afterDialDone) return;
        this._afterDialDone = true;
        this._moonSwipeDone = true;
        if (this._lyricInterval) { clearInterval(this._lyricInterval); this._lyricInterval = null; }
        // One frame's grace so the moon widget is laid out before the pan.
        setTimeout(() => this.settleMoon(), 0);
    }

    // ── settleMoon ────────────────────────────────────────────────────────────"""
if A not in src:
    sys.exit('!! settleMoon header not found')
src = src.replace(A, B, 1)
applied.append('_beginAfterDial() added')

with open(IM, 'w', encoding='utf-8') as f:
    f.write(src)

print('\n=== patch_dial_to_druid.py ===')
for c in applied:
    print('  applied : %s' % c)
print("""
Sequence now: poem -> pull-back leaves the moon at rest -> scene builds ->
settleMoon() pans -> _startPostSettleSequence() ->
'Tríd oichí fada gan codladh a bhanríonn,'

Without the dial nothing changes: the Amergin line and the swipe still work.
""")

#!/usr/bin/env python3
"""
Merge short NPC utterances back into one beat.

Since the per-line change, every NPC line got its own beat, including the
first one right after the portrait arrives -- so a single sentence merely
wrapped across two display lines played as three separate pauses (portrait,
line one, line two) instead of one. That is the "note too short, gap too
long" feeling.

The fix keeps the per-line split for what it was built for -- a genuine
monologue, several distinct spoken lines -- and merges anything shorter.
A run of NPC lines (between one portrait and the next) merges into a single
beat when it has NPC_MERGE_MAX lines or fewer; longer runs still get one
beat per line, so the tune still tracks a long speech.

The hero's own run is untouched: portrait and words already share one beat.

Credit for the sustaining harp is computed AFTER beats are assigned, from
per-group syllable totals -- so a merged beat automatically gets more notes
to spend in its one pause, rather than a separate change being needed.

Idempotent. Run from repo root, after patch_perline_queue.py.
"""

import sys, pathlib

TEXT = pathlib.Path('js/game/ui/textPanel.js')

A = """    // Beats are assigned by walking the rows in order, which both compacts
    // them (no gaps when a hero block is absent) and splits the NPC a line
    // at a time.
    //
    //   hero portrait + all the hero's lines   one beat
    //   NPC portrait                           one beat
    //   each NPC line                          a beat of its own
    //
    // The asymmetry is the point. The player's line is already known to
    // them, while the NPC's is being told -- so hers arrives at the pace of
    // speech and keeps the harp going for as long as she is speaking.
    let _beat    = -1
    let _heroRun = false
    rows.forEach((r) => {
      if (r.portrait) {
        _beat += 1
        r.group  = _beat
        _heroRun = !!r.isHero        // a hero portrait shares with its words
        return
      }
      const _empty = !((r.ga || '').trim() || (r.en || '').trim())
      if (_empty) { r.group = Math.max(0, _beat); return }
      if (r.isHero) {
        if (!_heroRun) { _beat += 1; _heroRun = true }
        r.group = _beat
        return
      }
      _heroRun = false
      _beat   += 1
      r.group  = _beat
    })
    this._revealBeats = Math.max(1, _beat + 1)"""

P = """    // Beats are assigned per RUN -- a portrait and the lines that follow it,
    // up to the next portrait.
    //
    //   hero run                  portrait + all lines share ONE beat
    //   NPC run, short            portrait gets a beat, then its few lines
    //                             share ONE beat together (one sentence,
    //                             however it wrapped, is one pause)
    //   NPC run, long             portrait, then one beat PER LINE -- a
    //                             real monologue, which is what keeps the
    //                             tune moving through a long speech
    //
    // NPC_MERGE_MAX is the line count where "short" becomes "long".
    const NPC_MERGE_MAX = 2
    let _beat = -1
    let _ri = 0
    while (_ri < rows.length) {
      const r = rows[_ri]
      if (!r.portrait) {              // no leading portrait: stand alone
        _beat += 1
        r.group = _beat
        _ri += 1
        continue
      }
      _beat += 1
      r.group = _beat
      const isHeroRun = !!r.isHero
      let _rj = _ri + 1
      while (_rj < rows.length && !rows[_rj].portrait) _rj += 1
      const run = rows.slice(_ri + 1, _rj)
      if (isHeroRun) {
        run.forEach(rr => { rr.group = _beat })
      } else {
        const nonEmpty = run.filter(rr => (rr.ga || '').trim() || (rr.en || '').trim())
        if (nonEmpty.length <= NPC_MERGE_MAX) {
          _beat += 1
          run.forEach(rr => { rr.group = _beat })
        } else {
          run.forEach(rr => {
            const empty = !((rr.ga || '').trim() || (rr.en || '').trim())
            if (empty) { rr.group = Math.max(0, _beat); return }
            _beat += 1
            rr.group = _beat
          })
        }
      }
      _ri = _rj
    }
    this._revealBeats = Math.max(1, _beat + 1)"""


def main():
    if not TEXT.exists():
        sys.exit(f'not found: {TEXT} — run from repo root')
    src = TEXT.read_text()
    if 'NPC_MERGE_MAX' in src:
        print('already patched — nothing to do')
        return
    if A not in src:
        sys.exit('anchor not found — run patch_perline_queue.py first, '
                 'or textPanel.js has moved on since')
    TEXT.write_text(src.replace(A, P, 1))
    print('patched js/game/ui/textPanel.js')


if __name__ == '__main__':
    main()

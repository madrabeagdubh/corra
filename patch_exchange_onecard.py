#!/usr/bin/env python3
"""
Render a scripted exchange as ONE card.

The transcript renderer already loops over a list of speaker blocks, staging
their reveal, giving each its own portrait, harp phrase and dance. It has only
ever been handed two blocks: the hero's line and the NPC's answer.

This passes the whole `exchange` array in, so a multi-turn exchange becomes
hero/NPC/hero/NPC down a single scrollable card. The player can read forward
at their own pace and scroll back over anything they missed, and the card ends
where any card ends -- options, exit, or back to the question list.

Replaces the card-per-turn approach from patch_exchange.py, whose _playExchange
is removed here.

Idempotent. Run from repo root, after the other two patches.
"""

import sys, pathlib

PANEL = pathlib.Path('js/game/ui/encounterPanel.js')
TEXT  = pathlib.Path('js/game/ui/textPanel.js')


# ── textPanel: accept an exchange and push a block per turn ──────────────

T1_A = "      heroGa    = '',\n"
T1_P = "      exchange  = null,\n      heroGa    = '',\n"

T2_A = ("      this._buildEncounterCard(irish, english, options, onChoice, "
        "bgKey, graphicKey, sw, sh, heroGa, heroEn, heroGraphicKey)")
T2_P = ("      this._buildEncounterCard(irish, english, options, onChoice, "
        "bgKey, graphicKey, sw, sh, heroGa, heroEn, heroGraphicKey, exchange)")

T3_A = ("  _buildEncounterCard(irish, english, options, onChoice, bgKey, "
        "graphicKey, sw, sh, heroGa = '', heroEn = '', heroGraphicKey = null) {")
T3_P = ("  _buildEncounterCard(irish, english, options, onChoice, bgKey, "
        "graphicKey, sw, sh, heroGa = '', heroEn = '', heroGraphicKey = null, "
        "exchange = null) {")

T4_A = """pushBlock(heroGa, heroEn, heroGraphicKey, true,  0, 0)   // the player's character
    pushBlock(irish,  english, graphicKey,    false, 1, 2)   // the NPC
"""

T4_P = """if (Array.isArray(exchange) && exchange.length) {
      // A scripted exchange is one card, not a run of them. Every turn adds
      // another pair of blocks to the same transcript, so the whole thing
      // scrolls as one -- forward at the reader's pace, and back over
      // anything they want to read again. Three beats per turn: the hero
      // speaks, the NPC's face arrives, the NPC answers.
      exchange.forEach((turn, k) => {
        const g = k * 3
        pushBlock(turn.say   ?? (k === 0 ? heroGa : ''),
                  turn.sayEn ?? (k === 0 ? heroEn : ''),
                  heroGraphicKey, true,  g,     g)
        pushBlock(turn.replyGa, turn.replyEn, graphicKey, false, g + 1, g + 2)
      })
    } else {
      pushBlock(heroGa, heroEn, heroGraphicKey, true,  0, 0)   // the player's character
      pushBlock(irish,  english, graphicKey,    false, 1, 2)   // the NPC
    }
"""


# ── encounterPanel: one show(), and drop the per-turn walker ─────────────

P1_A = """      this._playExchange(opt, 0, zone, after)
      return"""

P1_P = """      this._chainShow({
        exchange:   opt.exchange,
        irish:      '',
        english:    '',
        heroGa:     this._heroLines(opt).ga,
        heroEn:     this._heroLines(opt).en,
        heroGraphicKey: this._resolveHeroGraphicKey(),
        type:       'encounter_card',
        bgKey:      this._resolveBgKey(),
        graphicKey: this._resolveNpcGraphicKey(zone),
        options:    null,
        keepChromeOnHide: true,
        onDismiss:  after,
      })
      return"""

P2_A = """  /**
   * One turn of a scripted exchange, then the next on dismissal.
   *
   * The first turn's hero line falls back to the button text, matching
   * _heroLines, so an exchange whose opening line IS the button need not
   * repeat itself in the data.
   */
  _playExchange(opt, i, zone, after) {
    const turns = opt.exchange || []
    const turn  = turns[i]
    if (!turn) { after(); return }

    const heroGa = turn.say ?? (i === 0 ? (opt.say   ?? opt.ga ?? '') : '')
    const heroEn = turn.sayEn ?? (i === 0 ? (opt.sayEn ?? opt.en ?? '') : '')

    this._chainShow({
      irish:      turn.replyGa || '',
      english:    turn.replyEn || '',
      heroGa,
      heroEn,
      heroGraphicKey: this._resolveHeroGraphicKey(),
      type:       'encounter_card',
      bgKey:      this._resolveBgKey(),
      graphicKey: this._resolveNpcGraphicKey(zone),
      options:    null,
      keepChromeOnHide: true,
      onDismiss:  () => this._playExchange(opt, i + 1, zone, after),
    })
  }

"""

P3_A = """    // A scripted back-and-forth: several turns, each its own card. The
    // single say/reply pair below is the one-turn case of this."""

P3_P = """    // A scripted back-and-forth: one card holding every turn, which the
    // transcript renderer stages block by block. The single say/reply pair
    // below is the one-turn case of this."""


def edit(path, pairs, marker, done_msg):
    if not path.exists():
        sys.exit(f'not found: {path} — run from repo root')
    src = path.read_text()
    if marker in src:
        print(f'{path.name} already patched')
        return
    for i, (anchor, _) in enumerate(pairs, 1):
        if anchor not in src:
            sys.exit(f'{path.name} anchor {i} not found — the file has moved on')
    for anchor, patch in pairs:
        src = src.replace(anchor, patch, 1)
    path.write_text(src)
    print(done_msg)


if __name__ == '__main__':
    edit(TEXT,
         [(T1_A, T1_P), (T2_A, T2_P), (T3_A, T3_P), (T4_A, T4_P)],
         'Array.isArray(exchange)',
         'patched js/game/ui/textPanel.js')

    if not PANEL.exists():
        sys.exit('js/game/ui/encounterPanel.js not found')
    src = PANEL.read_text()
    if '_playExchange' not in src:
        print('encounterPanel.js already patched')
    else:
        for i, a in enumerate((P1_A, P2_A, P3_A), 1):
            if a not in src:
                sys.exit(f'encounterPanel.js anchor {i} not found — '
                         'run patch_exchange.py and patch_exchange_compiler.py first')
        src = src.replace(P1_A, P1_P, 1)
        src = src.replace(P2_A, '', 1)
        src = src.replace(P3_A, P3_P, 1)
        PANEL.write_text(src)
        print('patched js/game/ui/encounterPanel.js')

#!/usr/bin/env python3
"""
Add multi-turn `exchange` support to encounterPanel.js.

An option may carry:

    exchange: [
      { sayGa, sayEn, replyGa, replyEn },
      { sayGa, sayEn, replyGa, replyEn },
    ]

Each entry is one hero line and one NPC answer, shown as its own card with
portraits, harp and dance as usual. Dismissing a card advances to the next
turn; the last one lands wherever the option would have landed anyway.

Inert until data provides `exchange`. Options using say/reply are untouched.

Idempotent. Run from repo root.
"""

import sys, pathlib

PATH = pathlib.Path('js/game/ui/encounterPanel.js')

CALL_ANCHOR = "    const _hero = this._heroLines(opt)\n"

CALL_PATCH = """    // A scripted back-and-forth: several turns, each its own card. The
    // single say/reply pair below is the one-turn case of this.
    if (!opt.exit && Array.isArray(opt.exchange) && opt.exchange.length) {
      this._playExchange(opt, 0, zone, after)
      return
    }

"""

METHOD_ANCHOR = """  /**
   * Re-resolve and re-show whichever dialogue node currently applies, without
   * closing the panel."""

METHOD_PATCH = """  /**
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

    const heroGa = turn.sayGa ?? (i === 0 ? (opt.say   ?? opt.ga ?? '') : '')
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


def main():
    if not PATH.exists():
        sys.exit(f'not found: {PATH} — run from repo root')

    src = PATH.read_text()

    if '_playExchange' in src:
        print('already patched — nothing to do')
        return

    if CALL_ANCHOR not in src:
        sys.exit('call anchor not found; encounterPanel.js has moved on')
    if METHOD_ANCHOR not in src:
        sys.exit('method anchor not found; encounterPanel.js has moved on')

    src = src.replace(CALL_ANCHOR, CALL_PATCH + CALL_ANCHOR, 1)
    src = src.replace(METHOD_ANCHOR, METHOD_PATCH + METHOD_ANCHOR, 1)

    PATH.write_text(src)
    print('patched js/game/ui/encounterPanel.js')


if __name__ == '__main__':
    main()

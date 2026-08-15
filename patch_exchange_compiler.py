#!/usr/bin/env python3
"""
Teach tools/dialogue/compile.mjs to emit multi-turn exchanges.

At present `>` lines all pile into sayEn and `<` lines all pile into replyEn,
so an option can only ever be "player speaks, NPC answers" no matter how the
draft was written. This makes a `>` following a `<` start a NEW turn, and
emits:

    exchange: [
      { say, sayEn, replyGa, replyEn },
      { say, sayEn, replyGa, replyEn },
    ]

An option with a single turn still compiles to say/sayEn/replyGa/replyEn
exactly as before, so every existing .dlg produces identical output.

Also corrects the key name in the earlier encounterPanel patch: turns use
`say` for the Irish hero line, matching the rest of the codebase, not `sayGa`.

Idempotent. Run from repo root, after patch_exchange.py.
"""

import sys, pathlib

COMPILE = pathlib.Path('tools/dialogue/compile.mjs')
PANEL   = pathlib.Path('js/game/ui/encounterPanel.js')


# ── 1. a turn accumulator next to addLine ────────────────────────────────

A1 = r"""const addLine = (obj, key, text) => {
  obj[key] = obj[key] ? obj[key] + '\n' + text : text
}
"""

P1 = r"""const addLine = (obj, key, text) => {
  obj[key] = obj[key] ? obj[key] + '\n' + text : text
}

// One turn is one hero line and one NPC answer. A `>` arriving after a `<`
// has already landed starts a NEW turn -- which is what lets an exchange
// alternate on screen instead of stacking all the player's lines above all
// the NPC's. Options that never alternate collect a single turn and are
// flattened back to say/reply below, so nothing existing changes.
const currentTurn = (o, isHero) => {
  o.__turns = o.__turns || []
  let t = o.__turns[o.__turns.length - 1]
  if (!t || (isHero && (t.replyEn || t.replyGa))) { t = {}; o.__turns.push(t) }
  return t
}
"""


# ── 2. route > and < through it ──────────────────────────────────────────

A2 = r"""  // ---- player line
  if (t.startsWith('>')) {
    if (!opt) { fail(ln, '> player line outside an option'); return }
    addLine(opt, 'sayEn', t.slice(1).trim())
    last = { obj: opt, key: 'say' }
    return
  }

  // ---- npc reply
  if (t.startsWith('<')) {
    if (!opt) { fail(ln, '< reply line outside an option'); return }
    addLine(opt, 'replyEn', t.slice(1).trim())
    last = { obj: opt, key: 'replyGa' }
    return
  }
"""

P2 = r"""  // ---- player line
  if (t.startsWith('>')) {
    if (!opt) { fail(ln, '> player line outside an option'); return }
    const turn = currentTurn(opt, true)
    addLine(turn, 'sayEn', t.slice(1).trim())
    last = { obj: turn, key: 'say' }
    return
  }

  // ---- npc reply
  if (t.startsWith('<')) {
    if (!opt) { fail(ln, '< reply line outside an option'); return }
    const turn = currentTurn(opt, false)
    addLine(turn, 'replyEn', t.slice(1).trim())
    last = { obj: turn, key: 'replyGa' }
    return
  }
"""


# ── 3. flatten single turns, keep the rest as an exchange ────────────────

A3 = "if (!header.file) errors.push('no @file directive"

P3 = r"""// One turn is the ordinary case and stays flat, so every draft written
// before exchanges existed compiles byte-for-byte as it did. More than one
// becomes an exchange the panel walks card by card.
for (const n of nodes) {
  for (const o of n.options) {
    const turns = o.__turns || []
    delete o.__turns
    if (turns.length === 1) Object.assign(o, turns[0])
    else if (turns.length > 1) o.exchange = turns
  }
}

if (!header.file) errors.push('no @file directive"""


# ── 4. check the line pairing per turn ───────────────────────────────────

A4 = r"""    check(o, 'say', 'sayEn', `node ${i} option ${j} (player line)`)
    check(o, 'replyGa', 'replyEn', `node ${i} option ${j} (reply)`)
"""

P4 = r"""    check(o, 'say', 'sayEn', `node ${i} option ${j} (player line)`)
    check(o, 'replyGa', 'replyEn', `node ${i} option ${j} (reply)`)
    ;(o.exchange || []).forEach((tn, k) => {
      check(tn, 'say', 'sayEn', `node ${i} option ${j} turn ${k} (player line)`)
      check(tn, 'replyGa', 'replyEn', `node ${i} option ${j} turn ${k} (reply)`)
    })
"""


# ── 5. emit it ───────────────────────────────────────────────────────────

A5 = r"""  'exit', 'silent', 'ga', 'en', 'say', 'sayEn', 'replyGa', 'replyEn', 'again',
"""

P5 = r"""  'exit', 'silent', 'ga', 'en', 'say', 'sayEn', 'replyGa', 'replyEn',
  'exchange', 'again',
"""

A6 = r"""    } else if (k === 'again') {
"""

P6 = r"""    } else if (k === 'exchange') {
      out.push(`${pad}exchange: [`)
      for (const tn of v) {
        out.push(`${pad}  {`)
        out.push(...emitObj(tn, indent + 4))
        out.push(`${pad}  },`)
      }
      out.push(`${pad}],`)
    } else if (k === 'again') {
"""


# ── 6. --export writes the alternation back out ──────────────────────────

A7 = r"""      if (o.sayEn)   pair(o.sayEn, o.say, '> ')
      if (o.replyEn) pair(o.replyEn, o.replyGa, '< ')
"""

P7 = r"""      ;(o.exchange || []).forEach(tn => {
        if (tn.sayEn)   pair(tn.sayEn, tn.say, '> ')
        if (tn.replyEn) pair(tn.replyEn, tn.replyGa, '< ')
      })
      if (o.sayEn)   pair(o.sayEn, o.say, '> ')
      if (o.replyEn) pair(o.replyEn, o.replyGa, '< ')
"""


COMPILE_EDITS = [(A1, P1), (A2, P2), (A3, P3), (A4, P4),
                 (A5, P5), (A6, P6), (A7, P7)]


def patch_compile():
    if not COMPILE.exists():
        sys.exit(f'not found: {COMPILE} — run from repo root')
    src = COMPILE.read_text()
    if 'currentTurn' in src:
        print('compile.mjs already patched')
        return
    for i, (anchor, _) in enumerate(COMPILE_EDITS, 1):
        if anchor not in src:
            sys.exit(f'compile.mjs anchor {i} not found — the file has moved on')
    for anchor, patch in COMPILE_EDITS:
        src = src.replace(anchor, patch, 1)
    COMPILE.write_text(src)
    print('patched tools/dialogue/compile.mjs')


def patch_panel_keys():
    """Turns use `say` for Irish, not `sayGa`. Fix the earlier patch."""
    if not PANEL.exists():
        print(f'skipped: {PANEL} not found')
        return
    src = PANEL.read_text()
    if '_playExchange' not in src:
        print('encounterPanel.js has no _playExchange — run patch_exchange.py first')
        return
    if 'turn.sayGa' not in src:
        print('encounterPanel.js key names already correct')
        return
    src = src.replace('turn.sayGa ??', 'turn.say ??')
    PANEL.write_text(src)
    print('corrected turn key names in js/game/ui/encounterPanel.js')


if __name__ == '__main__':
    patch_compile()
    patch_panel_keys()

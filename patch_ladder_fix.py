#!/usr/bin/env python3
"""
patch_ladder_fix.py -- Corra: fix ladder dispatch + missing stack.

TypeError: Cannot read properties of undefined (reading 'push')

Two bugs, one root cause:

1. _showDialogue() tested `if (d.ladder)` BEFORE looking at d.options, so a
   node carrying both (node 0: four opening replies, one of which enters the
   duel) jumped straight into the ladder. The four opening options were
   unreachable. A ladder should only auto-start when the node has no options
   of its own -- otherwise it is entered deliberately, via enterLadder.

2. _showLadderRung()'s lazy init built { depth, used } with no `stack`, so
   the first pool entry carrying a `frag` threw on stack.push(). Only the
   enterLadder path initialised it correctly.

Run from the repo root:  python3 patch_ladder_fix.py
Idempotent; aborts without writing if expected text is missing.
"""
import io, os, sys

ROOT = os.getcwd()
def read(p):
    with io.open(os.path.join(ROOT, p), encoding='utf-8') as f: return f.read()
def write(p, s):
    with io.open(os.path.join(ROOT, p), 'w', encoding='utf-8') as f: f.write(s)

def sub_once(src, old, new, label):
    added = [ln for ln in new.split('\n') if ln.strip() and ln not in old]
    sentinel = max(added, key=len) if added else None
    if sentinel and sentinel in src:
        print('  = already applied: %s' % label); return src
    if old not in src:
        print('  ! NOT FOUND: %s\n    aborting, nothing written' % label); sys.exit(1)
    if src.count(old) != 1:
        print('  ! AMBIGUOUS (%d matches): %s' % (src.count(old), label)); sys.exit(1)
    print('  + %s' % label)
    return src.replace(old, new, 1)

P = 'js/game/ui/encounterPanel.js'
src = read(P)
print(P)

OLD = """    // Greeting-ladder nodes build their own options each rung.
    if (d.ladder) { this._showLadderRung(d, idx, stateKey, total, zone); return }"""
NEW = """    // Greeting-ladder nodes build their own options each rung -- but only
    // auto-start when the node has none of its own. A node that carries BOTH
    // (opening replies, one of which is enterLadder) must show its options
    // first; the duel is entered deliberately, not fallen into. Once the
    // ladder is running, this._ladder keeps us in it.
    if (d.ladder && (this._ladder || !d.options?.length)) {
      this._showLadderRung(d, idx, stateKey, total, zone); return
    }"""
src = sub_once(src, OLD, NEW, 'ladder no longer pre-empts a node\'s own options')

OLD = """    const st    = this._ladder || (this._ladder = { depth: 0, used: [] })"""
NEW = """    // `stack` holds the accumulated fragments. It was missing from this lazy
    // init (only the enterLadder path built it), so the first frag threw.
    const st    = this._ladder || (this._ladder = { depth: 0, used: [], stack: [] })
    if (!st.stack) st.stack = []"""
src = sub_once(src, OLD, NEW, 'lazy init includes stack')
write(P, src)

print('\nDone.')

#!/usr/bin/env python3
"""
patch_beats.py -- Corra: conversations stop repeating themselves.

THE PROBLEM
A node that loops (free questions the player can ask more than once)
re-printed its full opening line every time. Muireann kept re-asking "are
you rowing?" after it had been answered, so the player could answer yes,
then no, and nothing felt like it was moving.

THE FIX
Nodes gain an `again` line: what the speaker says on RETURN to a node
already visited in this conversation. Content writes the full hail once and
a short "anything else?" for the loop. Visited-set is per conversation, not
per save, so a later visit hails you properly again.

Also adds `first: true` on an option -- shown only until it has been used
once in this conversation. For answers that stop making sense the second
time round.

Run from the repo root:  python3 patch_beats.py
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

# ---------------------------------------------------------------- visited set
OLD = """  _openFixedEncounter(zone) {
    this._isOpen     = true
    this._choiceMade = false"""
NEW = """  _openFixedEncounter(zone) {
    this._isOpen     = true
    this._choiceMade = false
    // Which nodes and options this conversation has already used. Per
    // conversation, not per save -- come back tomorrow and she hails you
    // properly again.
    this._seenNodes   = new Set()
    this._usedOptions = new Set()"""
src = sub_once(src, OLD, NEW, 'per-conversation visited sets')

# -------------------------------------------------------------- use it in show
OLD = """    const opts = Array.isArray(d.options)
      ? d.options.filter(o => this._requiresMet(o.requires))
      : []"""
NEW = """    // Second time through this node, she does not re-deliver the whole hail.
    // This is what stops an NPC re-asking a question the player has already
    // answered every time they loop back for another question.
    const seen  = this._seenNodes?.has(idx)
    const line  = (seen && d.again) ? d.again : d
    if (this._seenNodes) this._seenNodes.add(idx)

    const opts = Array.isArray(d.options)
      ? d.options.filter(o => this._requiresMet(o.requires))
                 .filter(o => !(o.first && this._usedOptions?.has(this._optKey(idx, o))))
      : []"""
src = sub_once(src, OLD, NEW, 'again-line + first-only options')

OLD = """    if (opts.length) {
      this._scene.textPanel.show({
        irish:   d.ga || d.irish   || '',
        english: d.en || d.english || '',
        type:    'encounter_card',
        bgKey,
        graphicKey,
        options: opts.map(o => ({ ga: o.ga || '', en: o.en || '' })),"""
NEW = """    if (opts.length) {
      this._scene.textPanel.show({
        irish:   line.ga || line.irish   || '',
        english: line.en || line.english || '',
        type:    'encounter_card',
        bgKey,
        graphicKey,
        options: opts.map(o => ({ ga: o.ga || '', en: o.en || '' })),"""
src = sub_once(src, OLD, NEW, 'options card uses the again-line')

OLD = """      irish:   d.ga || d.irish   || '',
      english: d.en || d.english || '',
      type:    'encounter_card',
      bgKey,
      graphicKey,
      options: null,
      onDismiss: () => {
        if (!d.hold) GameState.setNPCProgress(stateKey, (idx + 1) % total)"""
NEW = """      // again-line applies to option-less nodes too
      irish:   line.ga || line.irish   || '',
      english: line.en || line.english || '',
      type:    'encounter_card',
      bgKey,
      graphicKey,
      options: null,
      onDismiss: () => {
        if (!d.hold) GameState.setNPCProgress(stateKey, (idx + 1) % total)"""
src = sub_once(src, OLD, NEW, 'plain card uses the again-line')

# ------------------------------------------------------------- record usage
OLD = """  _resolveOption(opt, d, idx, stateKey, total, zone) {
    this._applyEffects(opt)"""
NEW = """  /** Stable identity for an option, for the used-once set. */
  _optKey(idx, opt) { return idx + '|' + (opt.id || opt.ga || opt.en || '') }

  _resolveOption(opt, d, idx, stateKey, total, zone) {
    this._applyEffects(opt)
    this._usedOptions?.add(this._optKey(idx, opt))"""
src = sub_once(src, OLD, NEW, 'record used options')

# ----------------------------------------------------------------- cleanup
OLD = """    // Ladder depth is per-conversation, not per-save: the duel is playable
    // again on a later visit. Notes it set (invoked_heron etc.) persist.
    this._ladder = null"""
NEW = """    // Ladder depth is per-conversation, not per-save: the duel is playable
    // again on a later visit. Notes it set (invoked_heron etc.) persist.
    this._ladder      = null
    this._seenNodes   = null
    this._usedOptions = null"""
src = sub_once(src, OLD, NEW, 'clear visited sets on close')
write(P, src)

print('\nDone.')

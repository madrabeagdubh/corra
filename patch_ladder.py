#!/usr/bin/env python3
"""
patch_ladder.py -- Corra: greeting-ladder dialogue nodes.

Adds a `ladder` node type to EncounterPanel. A ladder node is a LOOP with a
depth counter, not a tree: each rung offers a few invocations drawn from a
pool, the NPC answers with one of her own, depth increments, and the same
node re-renders. Adding a thirteenth invocation is one line of content; the
code never changes. No combinatorial explosion.

Node shape:

  {
    ga, en,                       -- her opening hail (rung 0 only)
    ladder: {
      pool:  [ { id, tier, ga, en, replyGa, replyEn, note } ],
      hers:  [ { ga, en } ],      -- her line when re-entering at depth N
      exit:  { ga, en },          -- the graceful step out of the form
      offer: 3,                   -- invocations shown per rung (default 3)
    },
    ...effects, requires, hold as normal
  }

Pool entry `tier` is a rough register:
    0 domestic/safe   1 land+water   2 sky+dead   3 absurd
Rungs offer mostly tier === depth, topped up from adjacent tiers, so the
exchange escalates on its own without anyone hand-authoring a tree.

Ladder state (depth, which invocations are spent) lives on the panel and is
cleared when the conversation ends -- it is deliberately NOT persisted, so
the game is playable again on a second visit. Notes set by pool entries
(e.g. invoked_heron) DO persist, via the normal effects path.

Run from the repo root:  python3 patch_ladder.py
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

# ---------------------------------------------------------------- dispatch in
OLD = """  _showDialogue(d, idx, stateKey, total, zone) {
    const bgKey      = this._resolveBgKey()
    const graphicKey = this._resolveGraphicKey(zone.getData('visual'))

    this._applyEffects(d)
    this._choiceMade = false

    const opts = Array.isArray(d.options)"""
NEW = """  _showDialogue(d, idx, stateKey, total, zone) {
    const bgKey      = this._resolveBgKey()
    const graphicKey = this._resolveGraphicKey(zone.getData('visual'))

    this._applyEffects(d)
    this._choiceMade = false

    // Greeting-ladder nodes build their own options each rung.
    if (d.ladder) { this._showLadderRung(d, idx, stateKey, total, zone); return }

    const opts = Array.isArray(d.options)"""
src = sub_once(src, OLD, NEW, 'dispatch ladder nodes')

# --------------------------------------------------------------- the ladder
OLD = """  _resolveOption(opt, d, idx, stateKey, total, zone) {"""
NEW = """  // -- Greeting ladder --------------------------------------------------------

  /**
   * One rung. Re-entered after every exchange with depth + 1 until the player
   * steps out of the form. Because this re-renders the SAME node rather than
   * walking to a new one, the card chrome stays up throughout and the whole
   * duel reads as one continuous conversation.
   */
  _showLadderRung(d, idx, stateKey, total, zone) {
    const L     = d.ladder
    const pool  = L.pool || []
    const st    = this._ladder || (this._ladder = { depth: 0, used: [] })
    const depth = st.depth

    // Her line: the node's own ga/en opens the exchange, then `hers` takes
    // over. Runs out gracefully -- last entry repeats rather than going blank.
    const herLine = depth === 0
      ? { ga: d.ga || '', en: d.en || '' }
      : (L.hers?.[Math.min(depth - 1, (L.hers?.length || 1) - 1)] || { ga: '', en: '' })

    // Candidates: unspent, and preferring this rung's register. Topped up
    // from neighbouring tiers so a thin pool still fills the card.
    const unused = pool.filter(p => !st.used.includes(p.id))
    const byDist = [...unused].sort((a, b) =>
      Math.abs((a.tier ?? 0) - depth) - Math.abs((b.tier ?? 0) - depth))
    const offer  = byDist.slice(0, L.offer || 3)

    // The step out of the form is itself part of the form, so it is written
    // content, not a bare 'Goodbye'. Marked exitLadder rather than exit: it
    // ends the DUEL, not the conversation -- she still has to give directions.
    const exitOpt = { ...(L.exit || { ga: 'Go raibh maith agat.', en: 'Thank you.' }),
                      exitLadder: true }
    const opts = [...offer, exitOpt]

    this._scene.textPanel.show({
      irish:   herLine.ga,
      english: herLine.en,
      type:    'encounter_card',
      bgKey:      this._resolveBgKey(),
      graphicKey: this._resolveGraphicKey(zone.getData('visual')),
      options: opts.map(o => ({ ga: o.ga || '', en: o.en || '' })),
      onChoice: (i) => {
        this._choiceMade = true
        SoundBoard.playWeb('ENCOUNTER_CHOICE')
        this._resolveLadderChoice(opts[i], d, idx, stateKey, total, zone)
      },
      onDismiss: () => { if (!this._choiceMade) this._onPanelClosed() },
    })
  }

  _resolveLadderChoice(opt, d, idx, stateKey, total, zone) {
    this._applyEffects(opt)          // pool entries may set notes (invoked_heron)

    if (opt.exitLadder) {
      // Leave the duel and move to the next node -- typically the one that
      // actually gives directions. The panel does not close.
      this._ladder = null
      if (!d.hold) GameState.setNPCProgress(stateKey, (idx + 1) % total)
      if (opt.replyGa || opt.replyEn) {
        this._chainShow({
          irish:   opt.replyGa || '', english: opt.replyEn || '',
          type:    'encounter_card',
          bgKey:      this._resolveBgKey(),
          graphicKey: this._resolveGraphicKey(zone.getData('visual')),
          options: null,
          keepChromeOnHide: true,
          onDismiss: () => this._reopenDialogue(zone),
        })
      } else {
        this._reopenDialogue(zone)
      }
      return
    }

    // Spend the invocation and climb.
    if (opt.id) this._ladder.used.push(opt.id)
    this._ladder.depth += 1

    // The hero's own line back, if the content gives one, then next rung.
    if (opt.replyGa || opt.replyEn) {
      this._chainShow({
        irish:   opt.replyGa || '', english: opt.replyEn || '',
        type:    'encounter_card',
        bgKey:      this._resolveBgKey(),
        graphicKey: this._resolveGraphicKey(zone.getData('visual')),
        options: null,
        keepChromeOnHide: true,
        onDismiss: () => this._showLadderRung(d, idx, stateKey, total, zone),
      })
    } else {
      this._showLadderRung(d, idx, stateKey, total, zone)
    }
  }

  _resolveOption(opt, d, idx, stateKey, total, zone) {"""
src = sub_once(src, OLD, NEW, 'ladder rung + choice resolution')

# ------------------------------------------------------------- state cleanup
OLD = """  _onPanelClosed() {
    if (this._chainTimer) { clearTimeout(this._chainTimer); this._chainTimer = null }"""
NEW = """  _onPanelClosed() {
    if (this._chainTimer) { clearTimeout(this._chainTimer); this._chainTimer = null }
    // Ladder depth is per-conversation, not per-save: the duel is playable
    // again on a later visit. Notes it set (invoked_heron etc.) persist.
    this._ladder = null"""
src = sub_once(src, OLD, NEW, 'clear ladder state on close')
write(P, src)

print('\nDone.')

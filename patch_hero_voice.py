#!/usr/bin/env python3
"""
patch_hero_voice.py -- Corra: the hero speaks.

Three related changes.

1. textPanel.js -- encounter cards accept heroGa/heroEn: a paragraph shown
   ABOVE the NPC's line, in the speaker colour, for what the player's
   character just said. Buttons stay short ("Is ea" / "Ní hea"); the line
   the hero actually speaks can be as long and as literary as the writing
   wants. It also means a player running high English opacity still SEES
   their own character speaking Irish -- the button gloss no longer
   replaces the Irish, it only labels it.

2. encounterPanel.js -- options gain `say` / `sayEn`, rendered through that
   new slot on the reply card. Options also gain `enterLadder`, so a normal
   node can hand off into the greeting ladder.

3. encounterPanel.js -- the ladder now ACCUMULATES. Each rung contributes a
   fragment and the hero re-speaks the whole chain:
       Bail na habhann ort
       Bail na habhann is na taoide ort
       Bail na habhann is na taoide is na gcorr réisc ort
   Built from ladder.stackPrefix + fragments joined by ladder.stackJoin +
   ladder.stackSuffix, so the pattern is content's to choose, not the
   code's.

Run from the repo root:  python3 patch_hero_voice.py
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

# ================================================================== textPanel
P = 'js/game/ui/textPanel.js'
src = read(P)
print(P)

OLD = """      keepChromeOnHide = false,
    } = config"""
NEW = """      keepChromeOnHide = false,
      // What the player's character just said, shown above the NPC's line
      // in the speaker colour. Short buttons, long spoken lines.
      heroGa    = '',
      heroEn    = '',
    } = config"""
src = sub_once(src, OLD, NEW, 'show() accepts heroGa/heroEn')

OLD = """      this._buildEncounterCard(irish, english, options, onChoice, bgKey, graphicKey, sw, sh)"""
NEW = """      this._buildEncounterCard(irish, english, options, onChoice, bgKey, graphicKey, sw, sh, heroGa, heroEn)"""
src = sub_once(src, OLD, NEW, 'pass hero lines through')

OLD = """  _buildEncounterCard(irish, english, options, onChoice, bgKey, graphicKey, sw, sh) {"""
NEW = """  _buildEncounterCard(irish, english, options, onChoice, bgKey, graphicKey, sw, sh, heroGa = '', heroEn = '') {"""
src = sub_once(src, OLD, NEW, '_buildEncounterCard signature')

OLD = """    const gaLines = (irish   || '').split('\\n')
    const enLines = (english || '').split('\\n')
    const count   = Math.max(gaLines.length, enLines.length)

    let cy = 0

    for (let i = 0; i < count; i++) {
      const ga = (gaLines[i] || '').trim()
      const en = (enLines[i] || '').trim()
      if (!ga && !en) { cy += 12; continue }"""
NEW = """    // The hero's own line goes in first, in the speaker colour, followed by
    // a blank line. Everything after it is the NPC as usual. Tracked by
    // index rather than a separate render pass so it scrolls, masks, clips
    // and fades exactly like the rest of the body.
    const heroGaLines = heroGa ? String(heroGa).split('\\n') : []
    const heroEnLines = heroEn ? String(heroEn).split('\\n') : []
    const heroCount   = Math.max(heroGaLines.length, heroEnLines.length)

    const gaLines = [...heroGaLines, ...(heroCount ? [''] : []), ...(irish   || '').split('\\n')]
    const enLines = [...heroEnLines, ...(heroCount ? [''] : []), ...(english || '').split('\\n')]
    const count   = Math.max(gaLines.length, enLines.length)

    let cy = 0

    for (let i = 0; i < count; i++) {
      const ga = (gaLines[i] || '').trim()
      const en = (enLines[i] || '').trim()
      const isHero = i < heroCount
      if (!ga && !en) { cy += 12; continue }"""
src = sub_once(src, OLD, NEW, 'hero lines prepended to card body')

OLD = """          fontFamily: TYPE.cardBody.font,
          color:      IRISH_COLOR,
          wordWrap:   { width: textW },"""
NEW = """          fontFamily: TYPE.cardBody.font,
          color:      isHero ? SPEAKER_COLOR : IRISH_COLOR,
          wordWrap:   { width: textW },"""
src = sub_once(src, OLD, NEW, 'hero Irish in speaker colour')
write(P, src)

# ============================================================== encounterPanel
P = 'js/game/ui/encounterPanel.js'
src = read(P)
print(P)

# -- helper ---------------------------------------------------------------
OLD = """  /** Side effects declared on a dialogue node, option, or outcome. Idempotent. */"""
NEW = """  /**
   * Build the card that follows a choice: the hero's spoken line on top,
   * the NPC's answer below. `say`/`sayEn` on an option is the full literary
   * version of whatever the button said in shorthand.
   */
  _replyCard(opt, zone, onDismiss, heroGa, heroEn) {
    this._chainShow({
      irish:   opt.replyGa || '',
      english: opt.replyEn || '',
      heroGa:  heroGa ?? opt.say   ?? '',
      heroEn:  heroEn ?? opt.sayEn ?? '',
      type:    'encounter_card',
      bgKey:      this._resolveBgKey(),
      graphicKey: this._resolveGraphicKey(zone.getData('visual')),
      options: null,
      keepChromeOnHide: true,
      onDismiss,
    })
  }

  /** Side effects declared on a dialogue node, option, or outcome. Idempotent. */"""
src = sub_once(src, OLD, NEW, '_replyCard helper')

# -- normal options carry say/sayEn + enterLadder --------------------------
OLD = """  _resolveOption(opt, d, idx, stateKey, total, zone) {
    this._applyEffects(opt)

    const hold = (opt.hold !== undefined) ? opt.hold : d.hold"""
NEW = """  _resolveOption(opt, d, idx, stateKey, total, zone) {
    this._applyEffects(opt)

    // An option can hand off into the greeting ladder on the same node.
    if (opt.enterLadder && d.ladder) {
      this._ladder = { depth: 0, used: [], stack: [] }
      if (opt.replyGa || opt.replyEn || opt.say) {
        this._replyCard(opt, zone, () => this._showLadderRung(d, idx, stateKey, total, zone))
      } else {
        this._showLadderRung(d, idx, stateKey, total, zone)
      }
      return
    }

    const hold = (opt.hold !== undefined) ? opt.hold : d.hold"""
src = sub_once(src, OLD, NEW, 'options can enter the ladder')

OLD = """    if (opt.replyGa || opt.replyEn) {
      this._chainShow({
        irish:      opt.replyGa || '',
        english:    opt.replyEn || '',
        type:       'encounter_card',
        bgKey:      this._resolveBgKey(),
        graphicKey: this._resolveGraphicKey(zone.getData('visual')),
        options:    null,
        // Unless this option ends the exchange, the reply is a step on the
        // way back to the question list -- so its dismissal must not take
        // the card's background with it.
        keepChromeOnHide: !opt.exit,
        onDismiss:  after,
      })
    } else {
      after()
    }
  }"""
NEW = """    if (opt.replyGa || opt.replyEn || opt.say || opt.sayEn) {
      this._chainShow({
        irish:      opt.replyGa || '',
        english:    opt.replyEn || '',
        heroGa:     opt.say   || '',
        heroEn:     opt.sayEn || '',
        type:       'encounter_card',
        bgKey:      this._resolveBgKey(),
        graphicKey: this._resolveGraphicKey(zone.getData('visual')),
        options:    null,
        // Unless this option ends the exchange, the reply is a step on the
        // way back to the question list -- so its dismissal must not take
        // the card's background with it.
        keepChromeOnHide: !opt.exit,
        onDismiss:  after,
      })
    } else {
      after()
    }
  }"""
src = sub_once(src, OLD, NEW, 'reply cards show the hero line')

# -- ladder accumulation ---------------------------------------------------
OLD = """    const unused = pool.filter(p => !st.used.includes(p.id))"""
NEW = """    // Fragments already spoken -- shown so the player can see the chain they
    // are building before they add to it.
    const unused = pool.filter(p => !st.used.includes(p.id))"""
src = sub_once(src, OLD, NEW, 'ladder comment')

OLD = """  _resolveLadderChoice(opt, d, idx, stateKey, total, zone) {
    this._applyEffects(opt)          // pool entries may set notes (invoked_heron)

    if (opt.exitLadder) {"""
NEW = """  /**
   * The hero re-speaks the whole accumulated chain, the way a real greeting
   * ladder does -- each rung repeats what came before and adds one:
   *     Bail na habhann ort
   *     Bail na habhann is na taoide ort
   *     Bail na habhann is na taoide is na gcorr réisc ort
   * Shape comes from the content (stackPrefix / stackJoin / stackSuffix),
   * not from the code, so a different formula needs no code change.
   */
  _ladderSay(L, stack, key) {
    const frags = stack.map(f => f[key]).filter(Boolean)
    if (!frags.length) return ''
    const join   = (key === 'ga' ? L.stackJoin   : L.stackJoinEn)   ?? ' is '
    const prefix = (key === 'ga' ? L.stackPrefix : L.stackPrefixEn) ?? ''
    const suffix = (key === 'ga' ? L.stackSuffix : L.stackSuffixEn) ?? ''
    return [prefix, frags.join(join), suffix].filter(Boolean).join(' ')
  }

  _resolveLadderChoice(opt, d, idx, stateKey, total, zone) {
    this._applyEffects(opt)          // pool entries may set notes (invoked_heron)

    if (opt.exitLadder) {"""
src = sub_once(src, OLD, NEW, '_ladderSay accumulator')

OLD = """    // Spend the invocation and climb.
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
  }"""
NEW = """    // Spend the invocation and climb.
    if (opt.id) this._ladder.used.push(opt.id)
    if (opt.frag) this._ladder.stack.push(opt.frag)
    this._ladder.depth += 1

    // An explicit `say` overrides the accumulator, for rungs that break the
    // pattern on purpose.
    const L      = d.ladder
    const heroGa = opt.say   || this._ladderSay(L, this._ladder.stack, 'ga')
    const heroEn = opt.sayEn || this._ladderSay(L, this._ladder.stack, 'en')

    this._replyCard(opt, zone,
      () => this._showLadderRung(d, idx, stateKey, total, zone),
      heroGa, heroEn)
  }"""
src = sub_once(src, OLD, NEW, 'ladder accumulates and speaks the chain')
write(P, src)

print('\nDone.')

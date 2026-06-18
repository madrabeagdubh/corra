// bardAccompaniment.js
// Location: js/game/systems/music/bardAccompaniment.js
//
// A SEPARATE harp-driving engine from harpPhrasePlayer.js, for the
// "bard accompaniment" mode: the player strums their way through a
// tune at their OWN pace, and each successful gesture reveals the next
// chunk of a story (the Maebh/Táin poem) rather than scoring a hit.
//
// Why a separate file rather than another mode bolted onto
// HarpPhrasePlayer (the way autoPlay was): HarpPhrasePlayer's whole
// internal model is built around a CLOCK — beats have an atMs, orbs
// fly for travelMs, hits are scored by how close to atMs they landed.
// None of that exists here. There is no clock, no window, no score, no
// miss. The only state that matters is "which strings are lit right
// now, and has the player plucked all of them yet." Cramming that into
// HarpPhrasePlayer would mean either an awkward atMs=Infinity hack or a
// second code path branching through every clocked method — both worse
// than a small, honest, separate state machine.
//
// What's reused from the existing harp system, unchanged:
//   - corraHarp.js's actual sound engine (_strike via real plucks)
//   - corraHarp.js's automatic-sharp hint mechanism (setSharpHintFn)
//   - corraHarp.js's highlightString (already supports a `pulse` glow,
//     originally built "for guided prompts later" — this IS that later)
//   - the 'pluck' event corraHarp emits on real player input
// abcToPhrase.js's parsing is also reused upstream of this file (to
// build the `groups` this module is handed), but THIS file doesn't
// parse ABC itself — see GROUP FORMAT below. The actual chord/melodic-
// run grouping and diatonic harmonization algorithm is a separate,
// not-yet-built step; this engine is intentionally agnostic to how
// groups were produced so that work can proceed independently.
//
// ── GROUP FORMAT ─────────────────────────────────────────────────────
// A BardSequence is just an array of Group objects:
//   Group = {
//     strings:    number[]   // harp string indices, in play order.
//     ordered?:   boolean    // false/absent (default) = CHORD mode: all
//                             // strings light up together; any pluck
//                             // order satisfies the group. true = RUN
//                             // mode: strings light up ONE AT A TIME in
//                             // array order — the player must pluck
//                             // them in that exact order, each pluck
//                             // revealing the next light, before the
//                             // group completes. This is what makes a
//                             // "3-note run" actually feel like a
//                             // melodic run rather than a 3-note chord
//                             // in disguise (per explicit design call —
//                             // a same-time-lit group reads as "a
//                             // chord" regardless of how the notes were
//                             // chosen, so sequence has to be expressed
//                             // structurally, not just by note choice).
//     sharps?:    boolean[]  // parallel to `strings` — whether each
//                             // string should sound sharp when plucked
//                             // as part of this group. Optional; missing
//                             // entries default to false (natural).
//     ornament?:  {type,count}|null   // optional, applies to the WHOLE
//                             // group as a single flourish on the
//                             // FIRST string struck (chord mode) or the
//                             // first string in sequence (run mode) —
//                             // same shape/meaning as HarpPhrasePlayer's
//                             // beat.ornament, reused as-is since
//                             // corraHarp.playOrnament already knows
//                             // how to play it.
//     text?:      any        // opaque payload handed back via
//                             // onGroupComplete — typically the next
//                             // chunk of poem (bilingual lines, etc.)
//                             // but this module never reads or
//                             // interprets it, just passes it through.
//     reveal?:    any        // opaque payload for non-text "unlocks"
//                             // (illustration id, SFX cue, instrument
//                             // layer to bring in) — same pass-through
//                             // treatment as `text`.
//   }
// A single melody note is just a Group with one string (ordered is
// irrelevant when there's only one string to hit). A "2 notes and a
// chord" gesture (per the brief: varying gesture shapes pass to pass)
// is naturally just Groups of different sizes AND different `ordered`
// values back to back — this engine doesn't hardcode "chord" vs "run"
// as separate concepts beyond this one flag, which keeps the engine
// itself simple regardless of how varied the musical content is.

export class BardAccompaniment {
  // `corraHarp`: the CorraHarp instance (same one HarpPhrasePlayer uses).
  // `sequence`: a BardSequence (see GROUP FORMAT above).
  // `opts.onGroupComplete(group, groupIndex)`: fired once a group
  //   resolves — for a chord, that's the moment ANY one of its strings
  //   is plucked correctly (see _onChordPluck); for a run, once the
  //   full ordered sequence completes. Receives the ORIGINAL group
  //   object (so callers can read .text/.reveal directly) and its
  //   index in the sequence.
  // `opts.onSequenceComplete()`: fired after the last group completes.
  // `opts.loop`: if true, wraps back to group 0 after the last group
  //   completes instead of firing onSequenceComplete and stopping —
  //   for the "tune loops while the poem keeps advancing underneath it"
  //   pattern discussed for pairing a short tune to a long text. Off by
  //   default since that pairing decision belongs to the caller, not
  //   baked into this engine.
  constructor(corraHarp, sequence, opts = {}) {
    this._harp     = corraHarp
    this._sequence = sequence
    this._opts = {
      onGroupComplete:  opts.onGroupComplete  ?? (() => {}),
      onSequenceComplete: opts.onSequenceComplete ?? (() => {}),
      loop: !!opts.loop,
    }

    this._running    = false
    this._groupIndex = 0
    // For RUN-mode (ordered) groups: how many of the group's strings,
    // in order, have been correctly plucked so far. The only string
    // considered "live"/lit at any moment is strings[orderedCursor] —
    // see _lightCurrentGroup/_onPluck. (CHORD-mode groups need no
    // equivalent progress state — per design, any one correct pluck
    // resolves the whole chord immediately, so there's no partial-chord
    // state to track between plucks at all.)
    this._orderedCursor = 0
  }

  // ── Lifecycle ──────────────────────────────────────────────────────
  start() {
    if (this._running) return
    this._running = true
    this._groupIndex   = 0
    this._orderedCursor = 0

    this._pluckHandler = ({ stringIndex }) => this._onPluck(stringIndex)
    this._harp.on('pluck', this._pluckHandler)

    // Automatic sharps for the CURRENT group's strings, same mechanism
    // HarpPhrasePlayer uses — asks "does the string the player just hit
    // belong to the current group, and if so should IT sound sharp,"
    // falling back to natural for any string outside the current group
    // (free exploration plucks — see file header on off-target input —
    // should sound their plain, natural pitch, not borrow whatever
    // sharp state happened to apply to a different group).
    this._sharpHintFn = (stringIndex) => {
      const group = this._sequence[this._groupIndex]
      if (!group) return false
      const pos = group.strings.indexOf(stringIndex)
      if (pos === -1) return false
      return !!group.sharps?.[pos]
    }
    this._harp.setSharpHintFn?.(this._sharpHintFn)

    // Ornament hint: only the FIRST string of the current group carries
    // the group's ornament (if any) — see GROUP FORMAT. Subsequent
    // strings in the same group play as plain strikes even if plucked
    // before the first, since a flourish only makes sense once, not
    // once per string in the chord.
    this._ornamentHintFn = (stringIndex) => {
      const group = this._sequence[this._groupIndex]
      if (!group?.ornament) return null
      return group.strings[0] === stringIndex ? group.ornament : null
    }
    this._harp.setOrnamentHintFn?.(this._ornamentHintFn)

    this._lightCurrentGroup()
  }

  stop() {
    if (!this._running) return
    this._running = false
    if (this._pluckHandler) this._harp.off('pluck', this._pluckHandler)
    this._harp.setSharpHintFn?.(null)
    this._harp.setOrnamentHintFn?.(null)
    // Un-light whatever was lit when stopped, so the harp doesn't carry
    // stale prompts into whatever uses it next (e.g. switching back to
    // the orb rhythm-game on the same harp instance).
    const group = this._sequence[this._groupIndex]
    group?.strings.forEach(idx => this._harp.highlightString(idx, false))
  }

  // Jump directly to a specific group (e.g. resuming a saved position,
  // or a "skip ahead" debug control) — relights accordingly and clears
  // any in-progress run-mode cursor state, since that belongs to
  // whichever group was previously active.
  jumpTo(groupIndex) {
    if (groupIndex < 0 || groupIndex >= this._sequence.length) return
    this._unlightCurrentGroup()
    this._groupIndex = groupIndex
    this._orderedCursor = 0
    if (this._running) this._lightCurrentGroup()
  }

  // ── Internals ─────────────────────────────────────────────────────
  _currentGroup() {
    return this._sequence[this._groupIndex] ?? null
  }

  _lightCurrentGroup() {
    const group = this._currentGroup()
    if (!group) return
    // `pulse: true` — the existing breathing-glow highlight, originally
    // built (per its own comment in corraHarp.js) "for guided prompts
    // later." This is exactly that: a calm, inviting cue rather than an
    // urgent one, matching the unhurried tone of this mode.
    if (group.ordered) {
      // RUN mode: only the next string in sequence is lit. The rest
      // stay dark until their turn — lighting all of them at once would
      // just be a chord with extra steps, defeating the point of
      // marking this group as a sequence at all.
      const idx = group.strings[this._orderedCursor]
      if (idx !== undefined) this._harp.highlightString(idx, true, true)
    } else {
      group.strings.forEach(idx => this._harp.highlightString(idx, true, true))
    }
  }

  _unlightCurrentGroup() {
    const group = this._currentGroup()
    group?.strings.forEach(idx => this._harp.highlightString(idx, false))
  }

  _onPluck(stringIndex) {
    if (!this._running) return
    const group = this._currentGroup()
    if (!group) return

    if (group.ordered) {
      this._onOrderedPluck(group, stringIndex)
    } else {
      this._onChordPluck(group, stringIndex)
    }
  }

  // CHORD mode (group.ordered is false/absent): per explicit design,
  // ANY one of the group's strings being plucked correctly auto-
  // completes the WHOLE chord — the other strings sound too (via
  // corraHarp.demoStrike, the same "play this string without going
  // through real-player-input machinery" path used for autoplay/demo
  // playback) and the group advances immediately. The player only ever
  // needs one accurate touch per chord, not all of them landed
  // together. This also means there's no such thing as a "partial"
  // chord attempt anymore — earlier versions had a whole reset-timer
  // mechanism for "some but not all strings hit, then abandoned," which
  // no longer applies: with one-pluck-completes, that in-between state
  // simply can't exist.
  _onChordPluck(group, stringIndex) {
    // Off-target pluck (not part of the current group): per design,
    // this is NOT an error state. The harp already sounded the note
    // for real (corraHarp's own _fire/_strike handles that regardless
    // of what this module does) — there is nothing further for THIS
    // module to do except decline to advance.
    if (!group.strings.includes(stringIndex)) return

    // Sound every OTHER string in the chord (the touched one already
    // sounded for real, via the player's actual pluck — corraHarp
    // handles that independently of this engine). Each gets its own
    // sharp flag from group.sharps, matching how the harmonizer built
    // the chord; default velocity matches demoStrike's own default.
    group.strings.forEach((idx, i) => {
      if (idx === stringIndex) return
      this._harp.demoStrike?.(idx, !!group.sharps?.[i])
    })

    this._advance()
  }

  // RUN mode (group.ordered is true): only ONE string is ever lit at a
  // time — strings[_orderedCursor]. A pluck on that exact string
  // advances the cursor and lights the next one; ANY other pluck
  // (including a later, not-yet-due string in the same run, or a
  // string from outside the group entirely) is just free exploration —
  // same "no penalty" treatment as chord mode's off-target plucks, not
  // a wrong-order penalty. This keeps the "no failure state" promise
  // intact: jumping ahead in a run doesn't punish you, it just doesn't
  // count, and the run waits for you to come back to the right note.
  _onOrderedPluck(group, stringIndex) {
    const dueIdx = group.strings[this._orderedCursor]
    if (stringIndex !== dueIdx) return

    this._harp.highlightString(stringIndex, false)
    this._orderedCursor++

    if (this._orderedCursor >= group.strings.length) {
      this._advance()
    } else {
      this._lightCurrentGroup()   // light the next string in sequence
    }
  }

  _advance() {
    const completedGroup = this._currentGroup()
    const completedIndex = this._groupIndex

    // Un-light ALL strings of the completing group before advancing.
    // Without this, any strings NOT physically touched (e.g. the other
    // 2 strings in a 3-string chord that auto-completed on one pluck)
    // remain gold-highlighted while the NEXT group's strings also light
    // up — giving 4+ simultaneously lit strings. _onChordPluck used to
    // manually un-light the touched string itself before calling here,
    // but since advance now handles full cleanup, that's no longer
    // needed either (see _onChordPluck).
    completedGroup?.strings.forEach(idx => this._harp.highlightString(idx, false))

    this._orderedCursor = 0
    this._groupIndex++

    if (this._groupIndex >= this._sequence.length) {
      if (this._opts.loop) {
        this._groupIndex = 0
      } else {
        this._opts.onGroupComplete(completedGroup, completedIndex)
        this._opts.onSequenceComplete()
        return
      }
    }

    this._opts.onGroupComplete(completedGroup, completedIndex)
    this._lightCurrentGroup()
  }
}


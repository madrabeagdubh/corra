// dialogueHarp.js
//
// The champion's theme tune, plucked a fragment at a time as dialogue is
// revealed. One fragment per block of text; the pointer runs forward through
// the tune for the length of a conversation and resets when the next one
// starts.
//
// The effect this is for: a player who works through a long exchange in Irish
// hears more of their own theme than one who works through a short one. It is
// never explained and never counted. It should feel like the Zelda secret-door
// sting -- mysterious, and satisfying because you weren't told it was coming.
//
// Deliberately quiet. This sits UNDER the reading, not over it.
//
// AUDIO CONTEXT: this creates none of its own. The project already builds
// AudioContexts in a dozen modules and browsers cap how many can exist at once,
// so this borrows the Phaser one via SoundBoard.ctx() -- which is already
// unlocked by normal play, and therefore actually audible.

import { allTunes } from './allTunes.js'

// The NPC's tune carries the conversation; the champion's lines are the same
// tune an octave up. Alternating two different melodies was tried and was
// disjointed -- the switching was the problem, not the tunes.
//
// false falls back to the champion's tune for everything, which is what this
// did originally.
const NPC_LEADS = true

// Deliberate assignments, keyed by the NPC's portrait texture key. Anyone not
// listed gets a tune by hash -- see npcTuneKeyFor(). Promote tunes you like
// into here.
const NPC_TUNES = {
  // 'muireann': 'theButterfly',
}
import { getTuneKeyForChampion } from './championTuneMapping.js'
import { parseAbcToNotes } from './abcToPhrase.js'
import { SoundBoard } from '../soundBoard.js'

// -- Tuning knobs -------------------------------------------------------------

// The tempo that matters again. The tune's own relative rhythm is played at
// this scale -- 230 sits between the 130 that was too fast and the 300 that
// was too slow, both of which were judged when this governed a continuous line
// rather than a short phrase followed by silence.
const MS_PER_UNIT   = 180    // ABC duration unit -> ms
const VEL           = 0.35   // pluck velocity. Also shapes timbre, not just level:
                             // to make it louder, raise GAIN_BASE first.
const GAIN_BASE     = 0.16   // output gain floor
const GAIN_VEL      = 0.30   // output gain scaled by velocity
const HERO_SHIFT    = 12     // the player's lines pluck an octave above the NPC's,
                             // so the turn-taking is audible as well as visible
const MIN_NOTES     = 2      // a fragment is never a lone note...
const MAX_NOTES     = 48     // ...and never more than a couple of motifs

// The grid the tune is actually built on. Irish dance tunes come in two-bar
// motifs -- pose, echo, pose, answer across an eight-bar strain -- so a phrase
// that ends on an odd bar line has been cut between a question and its reply.
// Four would give longer, more complete statements at the cost of much longer
// blocks; it's a constant so that's one number to try.
const PHRASE_BARS   = 2

// The motif length is fixed at PHRASE_BARS now, so nothing decides how MUCH is
// played -- the silence after the motif is the reading room, and it grows with
// the line all by itself.
const ORNAMENT_MS   = 55     // how far ahead of the beat a cut/roll grace sits
const CADENCE_AFTER = 4      // notes of conversation before an ending earns a sign-off
const CADENCE_NOTES = 8      // most of the champion's theme quoted at the close
// Held back so the NPC's last phrase has decayed before the player's theme
// answers it. Harp notes ring for over a second, and without this the sign-off
// started underneath the tail of her motif -- which is why it sounded like her
// tune rather than a reply to it.
const CADENCE_LEAD_MS = 420

// Gestures that are OF the tune but don't consume it -- see the note in
// open()/touch(). The pointer only ever moves on text actually revealed.
// Shortened from 2.4: at that length the flourish was still ringing when the
// first melody started, and the tune was buried inside its own fanfare. It
// needs to announce the conversation and then get out of the way.
const OPEN_SECS     = 1.2
const OPEN_VEL      = 0.30
const OPEN_ROLL_MS  = 90     // spacing of the opening arpeggio's three notes
const TOUCH_SECS    = 0.26   // short and damped: a tap, not a note
const TOUCH_VEL     = 0.16

// -- A small Karplus-Strong pluck ---------------------------------------------
// The DSP duplicates corraHarp's HarpAudio._ks rather than importing it,
// because that module also defines a Phaser Scene and importing it here would
// drag the whole harp-duel instrument into the UI layer. The tidier fix is to
// lift HarpAudio into its own module and have both call it.

function ksBuffer(ctx, freq, vel, secs) {
  const sr  = ctx.sampleRate
  // Default is short -- this is punctuation, not a solo. `secs` overrides it
  // for the two gestures that want a different envelope: the long open ring
  // and the damped tap.
  const dur = secs ?? (1.1 + vel * 1.4)
  const tot = Math.floor(sr * dur)
  const buf = ctx.createBuffer(1, tot, sr)
  const out = buf.getChannelData(0)
  // Fractional delay so the high strings don't all collapse onto one pitch.
  const NkFloat = sr / freq
  const Nk      = Math.max(8, Math.floor(NkFloat))
  const frac    = NkFloat - Nk
  const lineLen = Nk + 1
  const dl = new Float32Array(lineLen)
  for (let i = 0; i < lineLen; i++) {
    const w = 0.5 * (1 - Math.cos(2 * Math.PI * i / lineLen))
    dl[i] = (Math.random() * 2 - 1) * w * vel
  }
  const decay = 0.988 + vel * 0.009
  let pos = 0
  for (let n = 0; n < tot; n++) {
    const nx     = (pos + 1) % lineLen
    const nx2    = (pos + 2) % lineLen
    const interp = dl[nx] + frac * (dl[nx2] - dl[nx])
    const avg    = (dl[pos] + interp) * 0.5 * decay
    out[n] = avg; dl[pos] = avg; pos = nx
  }
  return buf
}

// -- Tune cache ---------------------------------------------------------------

const _noteCache = new Map()

/**
 * The first bar that is a whole bar. Nearly a third of the tunes in allTunes
 * open with a pickup, and a pickup's bar is short -- so anchoring the motif
 * grid to the first note's barIndex would put every phrase boundary a bar out
 * and cut every motif in half.
 *
 * The pickup notes still get played. They just don't define the grid, which is
 * exactly what an anacrusis is: notes before the count starts.
 *
 * Computed once per tune and cached with the notes.
 */
function firstFullBar(notes) {
  if (!notes.length) return 0
  const dur = new Map()
  for (const n of notes) {
    const d = Number.isFinite(n.duration) && n.duration > 0 ? n.duration : 1
    dur.set(n.barIndex, (dur.get(n.barIndex) || 0) + d)
  }
  const bars = [...dur.keys()].sort((a, b) => a - b)
  if (bars.length < 3) return bars[0] ?? 0

  // Modal bar length, ignoring the first and last -- either can be partial.
  const counts = new Map()
  for (const b of bars.slice(1, -1)) {
    const v = dur.get(b)
    counts.set(v, (counts.get(v) || 0) + 1)
  }
  let full = null
  for (const [v, c] of counts) {
    if (full === null || c > counts.get(full)) full = v
  }
  if (full === null) return bars[0]

  for (const b of bars) if (dur.get(b) >= full) return b
  return bars[0]
}

function notesForTuneKey(key) {
  if (!key) return []
  if (_noteCache.has(key)) return _noteCache.get(key)
  let notes = []
  try {
    const abc = allTunes[key]
    if (abc) notes = parseAbcToNotes(abc).filter(n => Number.isFinite(n.midi))
  } catch (e) {
    console.warn('[DialogueHarp] could not parse tune:', key, e?.message)
    notes = []
  }
  // Stashed on the array so it travels with the cached notes.
  notes.baseBar = firstFullBar(notes)
  _noteCache.set(key, notes)
  return notes
}

function notesForChampion(champion) {
  let key = null
  try { key = getTuneKeyForChampion(champion) } catch (e) { key = null }
  return notesForTuneKey(key)
}

/**
 * Which tune belongs to an NPC. Deliberate assignments win; everyone else gets
 * one by hash, which is stable -- the same character has the same tune across
 * sessions and playthroughs, with no content work and nothing to migrate.
 */
function npcTuneKeyFor(npcKey) {
  if (!npcKey) return null
  const named = NPC_TUNES[npcKey]
  if (named && allTunes[named]) return named
  const keys = Object.keys(allTunes)
  if (!keys.length) return null
  let h = 0
  const s = String(npcKey)
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return keys[h % keys.length]
}

// Transposition used to exist here, to keep the NPC's tune from colliding with
// the champion's when the two alternated. With one tune per conversation there
// is nothing to collide with, so each NPC now speaks in their own tune's key --
// which means keys vary between characters as well as melodies.

// -- The harp -----------------------------------------------------------------

class DialogueHarpImpl {
  constructor() {
    this.scene    = null
    this.notes    = []
    this.idx      = 0
    this.played   = 0
    this.on       = true
    this._baseBar = null
    this._started = false
    this._npcId   = null
    // The NPC's voice: its own tune, its own place in it, transposed into the
    // champion's key so the two trade phrases instead of colliding.
    this.npc      = { notes: [], idx: 0, baseBar: null, shift: 0 }
    this._logged  = false
  }

  setEnabled(v) { this.on = !!v }

  /**
   * Start of a conversation: load this champion's tune and rewind to its
   * opening. Resetting per conversation is what makes depth audible -- the
   * first bars become the sound of a conversation beginning, and only a long
   * exchange gets past them.
   *
   * `scene` is kept so plucks can borrow the Phaser AudioContext.
   */
  begin(champion, scene = null, npcKey = null) {
    if (scene) this.scene = scene
    this._started = true
    this.notes    = notesForChampion(champion)
    this.idx      = 0
    this.played   = 0
    this._baseBar = null

    // Deliberately does NOT touch the NPC voice. That's setNpc()'s business,
    // and keeping them separate is what makes call order irrelevant -- this
    // used to reset the NPC a moment after it had been resolved.
    if (npcKey) this.setNpc(npcKey)
    else if (this._npcId) this._resolveNpc()
  }

  /**
   * Give the NPC their own voice. Idempotent per character, so the card-build
   * path can call it on every card without churn.
   */
  setNpc(npcId) {
    if (!NPC_LEADS || !npcId) return
    if (npcId === this._npcId && this.npc.notes.length) return
    this._npcId = npcId
    this._resolveNpc()
  }

  _resolveNpc() {
    this.npc = { notes: [], idx: 0, baseBar: null, shift: 0 }
    if (!NPC_LEADS || !this._npcId || !this.notes.length) return
    const key   = npcTuneKeyFor(this._npcId)
    const notes = notesForTuneKey(key)
    if (!notes.length) return
    this.npc = { notes, idx: 0, baseBar: null, shift: 0 }
    console.log('[DialogueHarp] npc', this._npcId, '->', key)
  }

  _ctx() {
    try { return SoundBoard.ctx(this.scene) } catch (e) { return null }
  }

  _pluck(ctx, midi, vel, delayMs, secs) {
    try {
      const when = ctx.currentTime + Math.max(0, delayMs) / 1000
      const freq = 440 * Math.pow(2, (midi - 69) / 12)
      const v    = Math.max(0.08, vel)
      const src  = ctx.createBufferSource()
      src.buffer = ksBuffer(ctx, freq, v, secs)
      const g = ctx.createGain()
      g.gain.setValueAtTime(GAIN_BASE + v * GAIN_VEL, when)
      src.connect(g); g.connect(ctx.destination)
      src.start(when)
    } catch (e) { /* audio is a nicety; never let it break a conversation */ }
  }

  /**
   * Take the next fragment: up to MAX_NOTES, breaking at a bar line once we
   * have at least MIN_NOTES, so fragments end where the tune breathes rather
   * than mid-figure.
   */
  /**
   * Whichever voice is speaking. Each keeps its own place in its own tune, so
   * a character's melody advances across their own lines rather than being
   * interleaved with the other's.
   */
  _voice() {
    // One tune for the whole conversation. The hero's octave shift is applied
    // in phrase(), so the two speakers are two registers of one melody rather
    // than two melodies -- which is what stopped it sounding disjointed.
    if (this.npc.notes.length) return this.npc
    return { notes: this.notes, idx: this.idx, baseBar: this._baseBar, shift: 0 }
  }

  _saveVoice(v) {
    if (this.npc.notes.length) {
      this.npc.idx = v.idx; this.npc.baseBar = v.baseBar
    } else {
      this.idx = v.idx; this._baseBar = v.baseBar
    }
  }

  _takeFragment(blockMs, v) {
    if (!v.notes.length) return []
    // Where the tune's own motif grid starts -- the first WHOLE bar, so a
    // pickup doesn't knock every boundary a bar out of true.
    if (v.baseBar === null) {
      v.baseBar = (v.notes.baseBar !== undefined)
        ? v.notes.baseBar
        : (v.notes[0].barIndex ?? 0)
    }

    // Exactly one motif, every time. Letting the length vary with the block
    // meant a long line took a question AND its answer while a short one took
    // only the question, so the four-bar shape never settled. Fixed at one,
    // consecutive blocks walk question, answer, question, answer -- and blocks
    // alternate speakers, so the tune's call-and-response and the dialogue's
    // turn-taking become the same thing.
    //
    // blockMs is no longer consulted: the silence after the motif is the
    // reading room, and it simply gets longer for longer lines.
    const frag = []
    while (frag.length < MAX_NOTES) {
      // Trad tunes are played in repeats, so wrap rather than fall silent.
      const n = v.notes[v.idx % v.notes.length]
      v.idx++
      frag.push(n)

      // Stop at the next point where the grid says a motif ends.
      const nxt    = v.notes[v.idx % v.notes.length]
      const atBar  = nxt && n.barIndex !== undefined &&
                     nxt.barIndex !== n.barIndex
      const onGrid = atBar &&
                     (((nxt.barIndex - v.baseBar) % PHRASE_BARS + PHRASE_BARS)
                        % PHRASE_BARS === 0)
      if (onGrid && frag.length >= MIN_NOTES) break
    }
    return frag
  }

  /**
   * Sound one block of revealed text. `isHero` lifts it an octave: same tune,
   * two voices, so who is speaking is audible as well as visible.
   */
  phrase({ isHero = false, blockMs = null } = {}) {
    if (!this.on) return
    const ctx = this._ctx()

    // Once per session, say what we've got. If the harp is silent, this line
    // is what tells you whether the context or the tune is missing.
    if (!this._logged) {
      this._logged = true
      console.log('[DialogueHarp] ctx:', ctx ? ctx.state : 'NONE',
                  '| tune notes:', this.notes.length)
    }

    if (!ctx || !this.notes.length) return

    const v    = this._voice()
    const frag = this._takeFragment(blockMs, v)
    this._saveVoice(v)
    if (!frag.length) return
    // The octave that keeps the player's own lines above the NPC's.
    const shift = isHero ? HERO_SHIFT : 0
    let t = 0
    frag.forEach((n, k) => {
      const midi = n.midi + shift
      // Ornaments come from the ABC and are invented nowhere. The grace pitch
      // is approximated a scale step above -- exact grace pitches are in the
      // parser's `grace.letters` if we ever export abcNoteToMidi for it.
      if (n.roll) {
        this._pluck(ctx, midi,     VEL * 0.8, t)
        this._pluck(ctx, midi + 2, VEL * 0.5, t + ORNAMENT_MS)
        this._pluck(ctx, midi,     VEL,       t + ORNAMENT_MS * 2)
      } else if (n.grace) {
        this._pluck(ctx, midi + 2, VEL * 0.45, t)
        this._pluck(ctx, midi,     VEL,        t + ORNAMENT_MS)
      } else {
        // Slight lift on the first note of a fragment so it reads as an
        // entrance rather than a continuation.
        this._pluck(ctx, midi, k === 0 ? VEL : VEL * 0.85, t)
      }
      // The tune's own rhythm. An even pulse was a metronome; this is playing.
      const dur = Number.isFinite(n.duration) && n.duration > 0 ? n.duration : 1
      t += dur * MS_PER_UNIT
    })
    this.played += frag.length
  }

  /**
   * The tune's home note. Approximated as its first note, which is right for
   * the modal tunes in allTunes (Drowsy Maggie opens on its own E) and close
   * enough elsewhere that nothing sounds wrong.
   */
  /**
   * The note unit the harp is currently playing at. The drum asks for this so
   * its figures land in the same tempo -- better than both files keeping their
   * own copy of a number that has to agree.
   */
  unitMs() { return MS_PER_UNIT }

  /**
   * Units in a bar of whatever tune is playing -- 6 for a jig, 8 for a reel.
   * The drum asks so it can play a figure that fits the metre instead of one
   * pattern for everything.
   */
  barUnits() {
    const v = this._voice()
    if (!v.notes.length) return 8
    const dur = new Map()
    for (const n of v.notes) {
      const d = Number.isFinite(n.duration) && n.duration > 0 ? n.duration : 1
      dur.set(n.barIndex, (dur.get(n.barIndex) || 0) + d)
    }
    const counts = new Map()
    for (const val of dur.values()) counts.set(val, (counts.get(val) || 0) + 1)
    let best = null
    for (const [val, c] of counts) {
      if (best === null || c > counts.get(best)) best = val
    }
    return best || 8
  }

  _root() {
    // Whatever is actually being played, so the opening flourish sets the key
    // the conversation is about to happen in.
    const v = this._voice()
    return v.notes.length ? v.notes[0].midi : null
  }

  /**
   * A conversation begins. Low, soft, long -- a harper touching the string
   * before playing. This sets the key so that every fragment afterwards is
   * heard in relation to something.
   *
   * Explicitly does NOT advance the pointer. Opening a panel is not reading,
   * and if it moved the tune then "a long exchange gets further into your
   * theme" would stop being true.
   */
  open(champion, scene = null) {
    this.begin(champion, scene)
    if (!this.on) return
    const ctx = this._ctx()
    const root = this._root()
    if (!ctx || root === null) return
    // A rolled arpeggio -- root, fifth, octave. An arpeggio is the most harpish
    // gesture there is, and because it isn't a melodic fragment it can't be
    // mistaken for the tune itself, which is the whole point of separating them.
    this._pluck(ctx, root - 12, OPEN_VEL,        0,               OPEN_SECS)
    this._pluck(ctx, root - 5,  OPEN_VEL * 0.85, OPEN_ROLL_MS,     OPEN_SECS)
    this._pluck(ctx, root,      OPEN_VEL * 0.7,  OPEN_ROLL_MS * 2, OPEN_SECS)
  }

  /**
   * The player commits to a line. A damped touch on the home note in their own
   * register -- the hero's block sounds its real fragment a moment later at
   * beat zero, so this reads as an anacrusis into it rather than as a separate
   * noise. Also does not advance the pointer: tapping isn't reading.
   */
  touch() {
    if (!this.on) return
    const ctx = this._ctx()
    const root = this._root()
    if (!ctx || root === null) return
    this._pluck(ctx, root + HERO_SHIFT, TOUCH_VEL, 0, TOUCH_SECS)
  }

  /** Whether a conversation is already under way. */
  isStarted() { return this._started }

  /**
   * Whether any melody has sounded yet in this conversation. Used instead of
   * "is this the first build of the card", which is a different and much less
   * reliable question -- cards are rebuilt whenever a portrait or other asset
   * finishes loading, and anything derived from build order is wrong the moment
   * that happens.
   */
  hasSounded() { return this.played > 0 }

  /**
   * Mark the conversation over, so the next begin() is treated as a fresh one.
   * Kept separate from cadence() because cadence declines to sound when it
   * wasn't earned, and the conversation still ended.
   */
  endConversation() {
    this._started = false
    this._npcId   = null
    this.npc      = { notes: [], idx: 0, baseBar: null, shift: 0 }
  }

  /**
   * End of a conversation. A bare fifth, allowed to ring -- the only moment
   * anything stacks, and only if the exchange got far enough in to have earned
   * it. A short brush-off ends on silence, which is its own comment.
   */
  cadence() {
    if (!this.on) return
    // Two routes end a conversation now -- the panel closing itself on an exit
    // option, and the player dismissing a card. Both call this; whichever runs
    // first wins, and endConversation() clears the flag so the other is a
    // no-op rather than a second sign-off on top of the first.
    if (!this._started) return
    // Says why it declined. The cadence going missing was invisible before
    // this, because every reason to skip it looked identical from outside:
    // silence.
    if (this.played < CADENCE_AFTER) {
      console.log('[DialogueHarp] cadence skipped: played',
                  this.played, '<', CADENCE_AFTER)
      return
    }
    if (!this.notes.length) {
      console.log('[DialogueHarp] cadence skipped: no champion tune')
      return
    }
    const ctx = this._ctx()
    if (!ctx) {
      console.log('[DialogueHarp] cadence skipped: no audio context')
      return
    }
    console.log('[DialogueHarp] cadence: closing motif')

    // The closing motif of whatever tune carried the conversation -- the NPC's.
    // Quoting the champion's theme here worked exactly as built and was simply
    // less pleasing than letting the tune that had been playing finish itself.
    //
    // Taken from the END of the tune rather than the pointer, because that's
    // where a tune's own cadence lives: the phrase it resolves on.
    const v = this._voice()
    const src = v.notes.length ? v.notes : this.notes
    if (!src.length) return

    const lastBar = src[src.length - 1].barIndex
    let start = src.length - 1
    while (start > 0 && (lastBar - src[start - 1].barIndex) < PHRASE_BARS) start--

    let t = 0
    for (let i = start; i < src.length && (i - start) < CADENCE_NOTES; i++) {
      const n = src[i]
      this._pluck(ctx, n.midi, VEL * 0.95, CADENCE_LEAD_MS + t)
      t += (Number.isFinite(n.duration) && n.duration > 0 ? n.duration : 1)
           * MS_PER_UNIT
    }
    this.played = 0
  }
}

export const DialogueHarp = new DialogueHarpImpl()

// abcToPhrase.js
// Location: js/game/systems/music/abcToPhrase.js
//
// Minimal ABC notation parser — extracts pitch, relative duration, AND
// effective accidental (sharp/natural) from an ABC tune body, mapping each
// pitch to the nearest available CorraHarp string. Intentionally simple:
// ignores ties, grace notes, chord brackets, and repeat structure. Handles
// the common (2/(3/(4 tuplet markers (see parseAbcToNotes) but not
// uncommon counts like (5/(7/(9, which are rare in this repertoire.
// Good enough to drive a timed Phrase for the harp mechanic; not a full ABC
// parser.
//
// ABC pitch letters: C D E F G A B (octave 4ish), lowercase = octave up,
// commas after a letter = octave down, apostrophes after = octave up.
// ABC duration: a digit after the note multiplies the default length
// (e.g. G2 = twice as long), a slash halves it (e.g. G/2 or G/ = half).
//
// ── Accidentals ─────────────────────────────────────────────────────────
// ABC accidentals are PERSISTENT within a measure once written, and the
// key signature sets the DEFAULT for every note of that letter for the
// whole tune (until a new K: line). This now covers the full circle of
// fifths (both sharp and flat keys), not just "is F sharped" — needed
// once tunes outside the original G-mixolydian-harp repertoire (e.g.
// Eb major) are in scope. The per-measure override mechanism below
// (explicit ^/=/_ accidentals temporarily overriding the key default)
// is UNCHANGED and already general — it always operated per-letter, it
// just only had F's default to look up before. Whether the HARP can
// actually sound a given accidental is a separate question, handled
// downstream by abcToTimedStringSequence/corraHarp's string layout —
// this section only answers "what does the key signature imply," not
// "can our 13 strings play it."

const NOTE_TO_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

// Circle of fifths: for each major key, which letters default to sharp
// vs flat. Built from the standard key-signature order of accidentals
// (sharps: F C G D A E B — flats: B E A D G C F) rather than hand-listing
// every mode, so adding a new key is "add one line," not "work out its
// accidental set from scratch." Modes (mixolydian, dorian, minor, etc.)
// share their relative major's key signature — e.g. Ddor has the same
// signature as C major (no accidentals), Edor same as D major (F#).
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const FLAT_ORDER   = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

// Major-key sharp/flat counts, keyed by tonic letter + accidental (the
// tonic as it would be written in ABC, e.g. "Eb" or "F#"). Covers the
// common keys likely to appear in this repertoire; unrecognized tonics
// fall back to "no accidentals" (same safe default as before).
const MAJOR_KEY_ACCIDENTAL_COUNT = {
  'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6, 'C#': 7,
  'F': -1, 'Bb': -2, 'Eb': -3, 'Ab': -4, 'Db': -5, 'Gb': -6, 'Cb': -7,
}

// Maps an ABC mode suffix to the semitone offset (in scale steps, not
// Resolves an ABC key token like "Eb", "Dmaj", "Ador", "Bmin", "Gmix",
// "F#min" into a signed accidental count (positive = sharps, negative =
// flats, per MAJOR_KEY_ACCIDENTAL_COUNT's convention), by finding the
// tonic's relative major and looking that up. Falls back to 0 (no
// accidentals) for anything unrecognized — same safe default the old
// F-only code used, so unfamiliar tunes degrade gracefully rather than
// crashing or guessing wildly.
function resolveKeyAccidentalCount(keyToken) {
  if (!keyToken) return 0
  const m = keyToken.trim().match(/^([A-G])([#b]?)([A-Za-z]*)/)
  if (!m) return 0
  const [, letter, accidental, modeRaw] = m
  const mode = modeRaw.toLowerCase().slice(0, 3) || 'maj'

  // Build the literal tonic string ("Eb", "F#", "D") to look up directly
  // for major/ionian — covers the common case with no semitone math at
  // all, which is also the least error-prone path.
  const tonicStr = letter + accidental
  if (mode === 'maj' || mode === 'ion' || mode === '') {
    return MAJOR_KEY_ACCIDENTAL_COUNT[tonicStr] ?? 0
  }

  // For modes, find the relative major's accidental count directly. The
  // mode's tonic sits a fixed number of fifths ABOVE its relative major's
  // tonic (e.g. G is a fifth above C, and G mixolydian's relative major
  // IS C) — so relativeMajorCount = thisLetterAsIfMajor - thatManyFifths.
  // Derived from how many scale-degrees-as-fifths each mode's tonic is
  // from its relative major's tonic (verified against known key
  // signatures: Gmix→C(0), Edor→D(2), Bmin→D(2), Ddor→C(0), Amin→C(0)):
  //   Ionian (built on degree 1):    0 fifths above its own major
  //   Lydian (degree 4):            -1 fifth (i.e. ONE BELOW its major)
  //   Mixolydian (degree 5):        +1 fifth above its relative major
  //   Dorian (degree 2):            +2 fifths above
  //   Aeolian/minor (degree 6):     +3 fifths above
  //   Phrygian (degree 3):          +4 fifths above
  //   Locrian (degree 7):           +5 fifths above
  const MODE_FIFTH_SHIFT = { mix: -1, dor: -2, aeo: -3, min: -3, m: -3, phr: -4, lyd: 1, loc: -5 }
  const shift = MODE_FIFTH_SHIFT[mode] ?? 0
  const tonicAsMajor = MAJOR_KEY_ACCIDENTAL_COUNT[tonicStr] ?? 0
  return tonicAsMajor + shift
}

// Given a resolved accidental count (signed: + = sharps, - = flats),
// returns a Map from letter -> 1 (sharp) | -1 (flat) | 0 (natural) for
// all seven letters, by walking SHARP_ORDER/FLAT_ORDER the right number
// of steps. This is the actual per-letter default table that parsing
// uses — generalizes the old single-letter KEYS_WITH_FSHARP set.
function buildKeyAccidentalMap(count) {
  const map = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 }
  if (count > 0) {
    for (let i = 0; i < count && i < SHARP_ORDER.length; i++) map[SHARP_ORDER[i]] = 1
  } else if (count < 0) {
    for (let i = 0; i < -count && i < FLAT_ORDER.length; i++) map[FLAT_ORDER[i]] = -1
  }
  return map
}

// Convenience used by parseAbcToNotes: resolves a key token straight to
// its per-letter accidental-default map in one call.
function keySignatureAccidentalMap(keyToken) {
  return buildKeyAccidentalMap(resolveKeyAccidentalCount(keyToken))
}

const LETTER_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

// Returns the 7-note diatonic scale for a given ABC key token, starting
// on the tonic and walking up in letter order (NOT alphabetically from
// C) — e.g. K:Ador returns [A,B,C,D,E,F#,G], not [A,B,C#,D,E,F#,G#]
// (which would be A major) or [C,D,E,F,G,A,B] (which would ignore the
// tonic entirely). Each entry is { letter, accidental } where accidental
// is -1/0/1 (flat/natural/sharp), matching the convention used
// throughout this module. Exported because this is genuinely general
// music-theory infrastructure — useful for diatonic harmonization (e.g.
// bardAccompaniment's chord-building) on ANY future tune/key, not
// something specific to one mode or one tune.
export function keyToDiatonicScale(keyToken) {
  const m = (keyToken || '').trim().match(/^([A-G])([#b]?)/)
  const tonicLetter = m ? m[1] : 'C'
  const accMap = keySignatureAccidentalMap(keyToken)
  const startIdx = LETTER_ORDER.indexOf(tonicLetter)
  const scale = []
  for (let i = 0; i < 7; i++) {
    const letter = LETTER_ORDER[(startIdx + i) % 7]
    scale.push({ letter, accidental: accMap[letter] })
  }
  return scale
}

function abcNoteToMidi(letter, isLower, octaveMarks, accidental) {
  let base = NOTE_TO_SEMITONE[letter.toUpperCase()]
  base += accidental || 0   // -1 = flat, 0 = natural, +1 = sharp
  let octave = isLower ? 5 : 4
  for (const ch of octaveMarks) {
    if (ch === ',') octave--
    if (ch === "'") octave++
  }
  return (octave + 1) * 12 + base
}

// Parses a duration suffix like "2", "/2", "/", "3/2" into a relative
// length multiplier (default note length = 1).
function parseDurationSuffix(suffix) {
  if (!suffix) return 1
  if (suffix.includes('/')) {
    const parts = suffix.split('/')
    const num = parts[0] === '' ? 1 : parseInt(parts[0], 10)
    const den = parts[1] === '' || parts[1] === undefined ? 2 : parseInt(parts[1], 10)
    return num / den
  }
  return parseInt(suffix, 10) || 1
}

// Extracts the K: field value from a raw ABC tune (first occurrence —
// mid-tune key changes are out of scope for the F-only accidental tracking
// this module does; see file header). Exported since callers building on
// top of this module's output (e.g. diatonic harmonization) often need
// the key independent of re-parsing every note.
export function extractKeySig(abcTune) {
  const m = abcTune.match(/^K:\s*(\S+)/m)
  return m ? m[1] : null
}

// Parses an L: field value like "1/8" or "1/4" into a multiplier relative
// to the 1/8 reference unit the rest of this module (and unitMs in
// buildTimedPhraseFromDurations) assumes a bare duration-unit of "1"
// means. L:1/8 -> 1 (no change), L:1/4 -> 2 (quarter is twice an eighth),
// L:1/16 -> 0.5, etc. Falls back to 1 (i.e. assume 1/8) for anything
// malformed, matching the project's long-standing implicit assumption.
function parseLFieldToUnitScale(lValue) {
  const m = lValue.match(/(\d+)\s*\/\s*(\d+)/)
  if (!m) return 1
  const num = parseInt(m[1], 10), den = parseInt(m[2], 10)
  if (!den) return 1
  const writtenUnit = num / den   // e.g. 1/4 = 0.25
  return writtenUnit / (1 / 8)    // relative to the 1/8 reference
}

// Strip ABC header lines, leaving just the note-letter stream with
// duration suffixes attached. Returns { body, keySig }.
//
// L: (default note length) is NOT simply discarded as a header field —
// unlike K:, it's legal in ABC for L: to reappear MID-TUNE (this is rare
// but real; e.g. The Pretty Girl Milking Her Cow's session.org setting
// has L:1/8 in the header and ANOTHER L:1/4 right after K:, doubling
// every subsequent bare note's actual length). A bare `L:` line is left
// as an inline marker `\x01<scale>\x01` in the body stream (using \x01 —
// a control character that will never appear in real ABC text — as an
// unambiguous delimiter) so parseAbcToNotes can apply the right scale
// at the right position instead of using one tune-wide constant. Other
// header fields (T:, M:, R:, etc.) are still fully discarded — only L:
// needs positional tracking, since it's the only one this module's
// duration math depends on.
function stripHeaders(abcTune) {
  const keySig = extractKeySig(abcTune)
  const lines = abcTune.split('\n')
  const bodyParts = []
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    const lMatch = t.match(/^L:\s*(\S+)/)
    if (lMatch) {
      bodyParts.push(`\x01${parseLFieldToUnitScale(lMatch[1])}\x01`)
      continue
    }
    if (/^[A-Z]:/.test(t)) continue   // other header fields: discard, as before
    bodyParts.push(t)
  }
  return { body: bodyParts.join(' '), keySig }
}

// Parses the ABC body into notes with effective sharp state for F/f.
//
// Accidental resolution, simplified to the single letter we support:
//   - `^F` / `^f`  → explicit sharp, sets the in-measure override to sharp
//   - `=F` / `=f`  → explicit natural, sets the in-measure override to natural
//   - `_F` / `_f`  → explicit flat — not representable on this harp (no
//                    flat string variant); treated as natural with a console
//                    warning rather than silently mis-sounding as sharp.
//   - bare `F`/`f` → uses the in-measure override if one is active this
//                    measure, otherwise falls back to the key signature's
//                    default for F.
// The override resets at each bar line ('|'), matching standard ABC/CMN
// accidental scope (an accidental lasts to the end of the measure).
export function parseAbcToNotes(abcTune) {
  const { body, keySig } = stripHeaders(abcTune)
  const keyAccidentals = keySignatureAccidentalMap(keySig)   // {C,D,E,F,G,A,B} -> -1|0|1

  const notes = []
  // Per-measure override map: null = no override for that letter this
  // measure; -1/0/1 = forced flat/natural/sharp. Generalizes the old
  // single `fOverride` boolean to all seven letters, since key
  // signatures can now imply accidentals on any of them (not just F).
  let overrides = { C: null, D: null, E: null, F: null, G: null, A: null, B: null }
  let barIndex  = 0      // which bar we're currently in (0-based)
  let posInBar  = 0      // running duration-unit position within the current bar —
                          // used downstream to add a metric accent (louder on the
                          // first note of a bar) without needing a separate M:
                          // meter-parser; counting real bar-lines as they're hit
                          // is more robust than trusting M: against actual barring
                          // (pickup/anacrusis bars, irregular bars, etc.)
  let pendingRoll = false   // true if the NEXT note parsed was preceded by a ~ marker

  // Tuplet state: ABC's (N marker means "the next N notes occupy the time
  // normally taken by Q of them", where Q depends on N (and, technically,
  // the meter, but the standard simple-time ratios below cover the
  // overwhelming majority of real tunes and are what most ABC sources —
  // including thesession.org — assume):
  //   (2 → 2 notes in the time of 3   (ratio 3/2)
  //   (3 → 3 notes in the time of 2   (ratio 2/3)
  //   (4 → 4 notes in the time of 3   (ratio 3/4)
  // Without this, e.g. (3AAA was being parsed as 3 full-length notes
  // (taking 50% longer than the tune actually calls for) instead of 3
  // notes compressed into 2 notes' worth of time — which measurably
  // drags out every triplet passage and pushes everything after it later,
  // a real source of "this doesn't sound right" on tunes (like reels)
  // that use triplets often.
  const TUPLET_RATIO = { 2: 3/2, 3: 2/3, 4: 3/4 }
  let tupletRemaining = 0
  let tupletRatio      = 1
  let tupletGroupId     = 0   // increments each time a new (N marker starts a group
  let tupletGroupSize   = 0   // how many notes the CURRENT group has, total
  let tupletPos         = 0   // this note's 0-based position within its current group
  let pendingGrace = null     // null, or { letters: [...], count } from a {...} just consumed
  let lUnitScale = 1   // current L:-derived scale multiplier, relative to 1/8 — see stripHeaders

  // Captures: an inline L:-scale marker (see stripHeaders), OR a grace-
  // note bracket open, OR a tuplet marker, OR a bar line, OR a tie
  // marker, OR a roll ornament marker, OR a note (optional accidental,
  // letter, octave marks, duration suffix). Grace-note content is
  // handled specially below (scanned and skipped manually, not matched
  // token-by-token by this regex) since it has no duration of its own
  // and isn't a sequence of real beats.
  const re = /(\x01[\d.]+\x01)|(\{)|(\()(\d)|(\|)|(-)|(~)|([\^_=]?)([A-Ga-g])([,']*)(\d*\/\d*|\/+\d*|\d+)?/g
  let m
  while ((m = re.exec(body)) !== null) {
    if (m[1]) {
      // L:-scale change — applies to every note from here forward until
      // the next one (or end of tune). Does NOT reset posInBar/barIndex;
      // a default-length change isn't a bar boundary.
      lUnitScale = parseFloat(m[1].slice(1, -1))
      continue
    }
    if (m[2] === '{') {
      // Grace notes: ABC's {cd}e means "tiny ornamental notes c,d played
      // quickly before e" — they carry no duration of their own (real
      // notation programs draw them with no time value) and must NOT
      // become independent playable beats, or they'd silently corrupt
      // the beat count/timing exactly like un-handled triplets did
      // earlier. Scan forward to the matching `}` by hand (regex
      // alternation isn't a good fit for "everything until a delimiter"),
      // pull out just the letters (accidentals/octave marks on grace
      // notes are visual detail we don't need — we only care how many
      // grace notes there are and roughly their shape, to choose a
      // flourish), and advance the regex past the closing brace so its
      // content is never re-matched as real notes.
      const closeIdx = body.indexOf('}', re.lastIndex)
      if (closeIdx === -1) {
        // Unterminated brace — malformed input; bail out of grace-note
        // handling for this one rather than scanning to the end of the
        // tune and treating everything after it as a grace note.
        continue
      }
      const graceContent = body.slice(re.lastIndex, closeIdx)
      const graceLetters = (graceContent.match(/[A-Ga-g]/g) || [])
      pendingGrace = { letters: graceLetters, count: graceLetters.length }
      re.lastIndex = closeIdx + 1
      continue
    }
    if (m[3] === '(') {
      const n = parseInt(m[4], 10)
      if (TUPLET_RATIO[n]) {
        tupletRemaining = n
        tupletRatio     = TUPLET_RATIO[n]
        tupletGroupId++
        tupletGroupSize = n
        tupletPos       = 0
      }
      // Unsupported tuplet counts (5,7,9...) are rare in this repertoire;
      // silently ignored (notes play at full length, no group) rather
      // than guessing a ratio — same spirit as the existing flat/non-F-
      // accidental gaps.
      continue
    }
    if (m[5] === '|') {
      overrides = { C: null, D: null, E: null, F: null, G: null, A: null, B: null }
      barIndex++
      posInBar = 0
      continue
    }
    if (m[6] === '-') {
      // Tie: the PREVIOUS note continues into the next one of the same
      // pitch — these two ARE meant to merge into one longer sounded
      // note. Mark it on the last-pushed note; the merge step downstream
      // only combines notes where this flag is set, not on pitch-match
      // alone (see abcToTimedStringSequence for why pitch-match alone is
      // wrong — repeated same-pitch notes without a tie are repeated
      // ARTICULATIONS, like a triplet on one pitch, not one held note).
      if (notes.length) notes[notes.length - 1].tied = true
      continue
    }
    if (m[7] === '~') {
      // Roll ornament marker — ABC convention is it precedes the note it
      // decorates. Flag the NEXT note we parse as roll-marked; consumed
      // immediately below rather than stored as standing state, since it
      // only ever applies to the single following note.
      pendingRoll = true
      continue
    }
    const accidentalMark = m[8] || ''
    const letter      = m[9]
    const marks       = m[10] || ''
    const durSfx       = m[11] || ''
    const isLower      = letter === letter.toLowerCase()
    const L = letter.toUpperCase()

    // Resolve this note's actual accidental: an explicit marker (^/=/_)
    // sets (and persists for the rest of the measure via `overrides`)
    // this letter's accidental; otherwise fall back to whatever's
    // already overridden this measure, else the key signature's default
    // for this letter. This is the same logic the old F-only code used,
    // just generalized to operate on `overrides[L]` / `keyAccidentals[L]`
    // instead of a single hardcoded fOverride/keyDefaultSharp pair.
    let accidental
    if (accidentalMark === '^') { overrides[L] = 1; accidental = 1 }
    else if (accidentalMark === '=') { overrides[L] = 0; accidental = 0 }
    else if (accidentalMark === '_') { overrides[L] = -1; accidental = -1 }
    else { accidental = overrides[L] !== null ? overrides[L] : keyAccidentals[L] }

    // sharp: kept as a boolean for backward compatibility with code that
    // only ever asked "is this sharped" (the harp's original F-only
    // sharp-string model) — true only when accidental is +1. New code
    // should prefer the signed `accidental` field, which also captures
    // flats now that re-strung harps (e.g. Eb major) can have them.
    const sharp = accidental === 1

    // Apply the current L:-derived scale (see stripHeaders/lUnitScale
    // above) — a bare note's written multiplier is relative to whatever
    // L: is active AT THIS POINT in the tune, not a tune-wide constant.
    let duration = parseDurationSuffix(durSfx) * lUnitScale
    let inTuplet = false
    let tGroupId = null, tPos = 0, tSize = 0
    if (tupletRemaining > 0) {
      duration *= tupletRatio
      inTuplet = true
      tGroupId = tupletGroupId
      tPos     = tupletPos
      tSize    = tupletGroupSize
      tupletPos++
      tupletRemaining--
    }
    notes.push({
      midi:     abcNoteToMidi(letter, isLower, marks, accidental),
      duration,
      sharp,        // true only if accidental === 1 — see comment above
      accidental,   // -1 (flat), 0 (natural), or 1 (sharp) — the general form
      tied:     false,   // set to true retroactively if a following '-' ties it forward
      letter:   letter.toUpperCase(),
      barIndex,
      posInBar,
      roll:     pendingRoll,
      grace:    pendingGrace,   // null, or { letters, count } from a preceding {...}
      tupletGroupId: inTuplet ? tGroupId : null,
      tupletPos:     tPos,
      tupletSize:    tSize,
    })
    pendingRoll  = false
    pendingGrace = null
    posInBar += duration
  }
  return notes
}

// Backwards-compatible: just the MIDI sequence, no durations/accidentals.
export function parseAbcToMidiSequence(abcTune) {
  return parseAbcToNotes(abcTune).map(n => n.midi)
}

// Maps an arbitrary MIDI sequence onto CorraHarp's actual available
// strings, folding octaves as needed to stay in range. Sharp-aware: if a
// target MIDI matches a string's sharped pitch better than its natural
// pitch, the returned entry carries `needsSharp: true` so callers can
// flag that beat correctly (sharps are sounded automatically — see
// corraHarp.js — this flag just tells the harp which pitch is wanted).
export function midiSequenceToStringIndices(midiSeq, corraHarp, harpMidiRange) {
  const { min, max, available } = harpMidiRange
  return midiSeq.map(midi => {
    let target = midi
    while (target < min) target += 12
    while (target > max) target -= 12
    let best = available[0], bestDist = Infinity, bestSharp = false
    for (const entry of available) {
      const d = Math.abs(entry.m - target)
      if (d < bestDist) { bestDist = d; best = entry; bestSharp = false }
      if (entry.sharpM !== undefined) {
        const ds = Math.abs(entry.sharpM - target)
        if (ds < bestDist) { bestDist = ds; best = entry; bestSharp = true }
      }
    }
    return { idx: best.idx, needsSharp: bestSharp }
  })
}

// Convenience: full pipeline, pitches only, deduplicating consecutive
// repeats. Kept for callers that only care about pitch sequence.
export function abcToStringSequence(abcTune, corraHarp, harpMidiRange) {
  const midiSeq = parseAbcToMidiSequence(abcTune)
  const mapped  = midiSequenceToStringIndices(midiSeq, corraHarp, harpMidiRange)
  const collapsed = []
  for (const { idx } of mapped) {
    if (collapsed[collapsed.length - 1] !== idx) collapsed.push(idx)
  }
  return collapsed
}

// Finds the single best constant octave-shift (in multiples of 12) to
// apply to an ENTIRE note sequence so it sits as fully as possible inside
// the harp's range. Folding each note independently breaks melodic
// contour — a tune spanning more than the harp's range will have some
// notes octave-jump on their own, turning a descending phrase into a
// zigzag. Shifting the whole tune by one constant amount preserves the
// shape; only notes that still fall outside after the shift get folded
// individually (rare, usually just the tune's extreme outlier notes).
function findBestOctaveShift(midiSeq, min, max) {
  const mid = (min + max) / 2
  let bestShift = 0, bestScore = -Infinity
  for (let shift = -36; shift <= 36; shift += 12) {
    let inRange = 0
    let distSum = 0
    for (const m of midiSeq) {
      const shifted = m + shift
      if (shifted >= min && shifted <= max) inRange++
      distSum += Math.abs(shifted - mid)
    }
    // Prioritise notes-in-range, then minimise average distance from centre
    const score = inRange * 1000 - distSum
    if (score > bestScore) { bestScore = score; bestShift = shift }
  }
  return bestShift
}

// ── Full pipeline WITH durations, for timed phrase scheduling ────────────
// Returns { indices: [stringIdx,...], durations: [relativeLength,...],
//           sharps: [needsSharp,...], accents: [0..1,...],
//           ornaments: [null|{type,count},...] }
// Consecutive identical-pitch notes are merged (their durations summed)
// rather than dropped, so the tune's rhythm stays correct — two tied
// eighth-notes on the same string become one beat of double length,
// rather than vanishing or playing as two indistinguishable plucks.
// IMPORTANT: merging only happens when ABC explicitly ties two notes
// with a `-` marker — same-pitch notes WITHOUT a tie are repeated
// articulations (e.g. the AAA in a (3AAA triplet, or gage/fgfe-style
// repeated-note reel ornamentation) and must stay as separate beats, or
// they'd silently collapse into one long note with an audible "gap"
// where the other articulations should have sounded. An earlier version
// of this function merged on pitch-match alone, which broke exactly that
// case — see git history / changelog comment near the merge loop below.
// Two notes only merge if they also agree on needsSharp — a held string
// can't be "half natural, half sharp", so a sharp-state change always
// starts a new beat even if the string index is unchanged (and even if
// tied, though a tie across a sharp-state change shouldn't occur in
// well-formed ABC anyway).
//
// `accents`: a simple per-beat metric-strength value (0..1, higher =
// stronger) derived from each beat's position within its bar (posInBar
// 0 = downbeat = strongest). This is a coarse "where does this fall in
// the bar" signal, NOT a real meter analysis (no time-signature-aware
// subdivision, no syncopation detection) — intentionally simple, since
// its only consumer (buildTimedPhraseFromDurations' velocity humanizing)
// just needs "is this near the top of the bar" to sound less mechanical,
// not a full musicological accent model.
// `ornament`: beats that represent a same-pitch tuplet (e.g. the AAA in
// (3AAA) or an ABC roll marker (~) are collapsed/tagged into a SINGLE
// playable beat carrying `ornament: { type: 'triplet'|'roll', count }`
// instead of being split into several beats the player would have to hit
// individually. Rationale: a same-pitch tuplet or a roll is, musically,
// ornamentation OF one note, not a sequence of distinct melodic events —
// asking a player to hit 3 separate near-simultaneous orbs for what's
// really "play this note, fancily" doesn't test anything meaningful and
// is much harder than the tune actually calls for. A MIXED-pitch tuplet
// (e.g. (3BdB — B, D, B, three different notes) is NOT collapsed, since
// that genuinely is a melodic sequence the player should play through,
// not a single ornamented note. The harp plays the actual ornament sound
// (multiple quick plucks / a roll figure) automatically when the player
// hits that one beat — see corraHarp.js playOrnament / demoStrike.
export function abcToTimedStringSequence(abcTune, corraHarp, harpMidiRange) {
  const notes = parseAbcToNotes(abcTune)
  const { min, max, available } = harpMidiRange

  // Shift the WHOLE tune by one constant octave offset first, so melodic
  // contour is preserved — only individual outliers get folded after that.
  const midiSeq = notes.map(n => n.midi)
  const shift = findBestOctaveShift(midiSeq, min, max)

  const snapped = notes.map(n => {
    let target = n.midi + shift
    while (target < min) target += 12
    while (target > max) target -= 12
    let best = available[0], bestDist = Infinity, bestSharp = false
    for (const entry of available) {
      const d = Math.abs(entry.m - target)
      if (d < bestDist) { bestDist = d; best = entry; bestSharp = false }
      if (entry.sharpM !== undefined) {
        const ds = Math.abs(entry.sharpM - target)
        if (ds < bestDist) { bestDist = ds; best = entry; bestSharp = true }
      }
    }
    return {
      idx: best.idx, duration: n.duration, needsSharp: bestSharp,
      posInBar: n.posInBar, tied: n.tied, roll: n.roll, grace: n.grace,
      tupletGroupId: n.tupletGroupId, tupletPos: n.tupletPos, tupletSize: n.tupletSize,
    }
  })

  const indices  = []
  const durations = []
  const sharps    = []
  const accents   = []
  const ornaments = []   // parallel array: null, or { type, count }
  let prevTied = false   // was the PREVIOUS pushed beat tied forward into this one?
  let i = 0
  while (i < snapped.length) {
    const cur = snapped[i]

    // ── Same-pitch tuplet detection ──────────────────────────────────
    // Only collapse if this note STARTS a tuplet group (tupletPos === 0)
    // and every note in that group (by tupletGroupId) maps to the same
    // harp string AND the same sharp-state after snapping — i.e. it's
    // truly one repeated pitch, not a melodic tuplet that happens to
    // start on the same note it ends on.
    if (cur.tupletGroupId !== null && cur.tupletPos === 0) {
      const group = []
      let j = i
      while (j < snapped.length && snapped[j].tupletGroupId === cur.tupletGroupId) {
        group.push(snapped[j])
        j++
      }
      const samePitch = group.length === cur.tupletSize &&
        group.every(g => g.idx === cur.idx && g.needsSharp === cur.needsSharp)
      if (samePitch) {
        const totalDuration = group.reduce((s, g) => s + g.duration, 0)
        indices.push(cur.idx)
        durations.push(totalDuration)
        sharps.push(cur.needsSharp)
        ornaments.push({ type: 'triplet', count: group.length })
        let accent
        if (cur.posInBar === 0) accent = 1
        else if (cur.posInBar % 4 === 0) accent = 0.8
        else accent = 0.6
        accents.push(accent)
        prevTied = group[group.length - 1].tied
        i = j
        continue
      }
      // Mixed-pitch tuplet (e.g. (3BdB) — NOT collapsed. Fall through to
      // the normal per-note handling below for cur, then continue the
      // while loop naturally to the rest of the group on subsequent
      // iterations (each will hit this same branch but fail tupletPos
      // === 0, since only the FIRST note of a group has tupletPos 0, so
      // they'll fall through to normal handling directly).
    }

    // ── Normal (non-collapsed) beat ─────────────────────────────────
    const lastI = indices.length - 1
    if (prevTied && lastI >= 0 && indices[lastI] === cur.idx && sharps[lastI] === cur.needsSharp) {
      durations[lastI] += cur.duration   // explicit tie — genuinely one held note, extend it
    } else {
      indices.push(cur.idx)
      durations.push(cur.duration)
      sharps.push(cur.needsSharp)
      // Ornament priority: an explicit ~ roll marker wins if somehow both
      // are present (rare/malformed input); otherwise a grace-note
      // bracket maps to 'cut' (single grace note — the standard quick
      // grace-note flick onto the main note) or 'roll' (2+ grace notes —
      // closer to a written-out turn figure, reuse the roll flourish
      // shape). A bare ~ with no grace bracket is the classic shorthand
      // roll. See corraHarp.js playOrnament for what each actually plays.
      let ornament = null
      if (cur.roll) ornament = { type: 'roll', count: 1 }
      else if (cur.grace?.count === 1) ornament = { type: 'cut', count: 1 }
      else if (cur.grace?.count > 1) ornament = { type: 'roll', count: cur.grace.count }
      ornaments.push(ornament)
      // Simple metric accent, not tied to a specific bar width (which
      // varies by M:/L: and isn't tracked here): the downbeat (posInBar
      // === 0) is strongest; the next subdivision point gets a medium
      // accent; everything else is a soft, even floor. This is a coarse
      // "feel" signal for velocity humanizing, not a real meter model —
      // see function header.
      let accent
      if (cur.posInBar === 0) accent = 1
      else if (cur.posInBar % 4 === 0) accent = 0.8   // common mid-bar subdivision (e.g. beat 3 of 4/4 at L:1/8)
      else accent = 0.6
      accents.push(accent)
    }
    prevTied = cur.tied
    i++
  }
  return { indices, durations, sharps, accents, ornaments }
}


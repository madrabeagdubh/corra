// abcToPhrase.js
// Location: js/game/systems/music/abcToPhrase.js
//
// Minimal ABC notation parser — extracts pitch, relative duration, AND
// effective accidental (sharp/natural) from an ABC tune body, mapping each
// pitch to the nearest available CorraHarp string. Intentionally simple:
// ignores ties, grace notes, chord brackets, tuplets, and repeat structure.
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
// whole tune (until a new K: line). We don't need general key-signature
// support yet — CorraHarp's current string set only has one note with a
// playable sharp variant (F), so this module only tracks "is this F (or f)
// sharped right now" rather than building a full per-letter accidental
// table. That keeps this honest about what it actually supports: tunes
// whose only accidental is F#/F natural (e.g. tunes in D major against a
// G-major-strung harp). Extending to more letters later means generalizing
// `keySig` and the per-measure accidental map below to all seven letters,
// not just F.

const NOTE_TO_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

// Key signatures we recognise for the "does F default to sharp" question.
// Only the keys actually present in allTunes.js are listed; anything else
// defaults to F-natural (safe default — most of the harp's home keys have
// no sharps at all).
const KEYS_WITH_FSHARP = new Set([
  'Dmaj', 'Amaj', 'Emaj', 'Bmaj',
  // Relative minors/modes of the above also carry F# in their signature
  'Bmin', 'F#min', 'C#min',
])

function keySignatureHasFSharp(keyToken) {
  if (!keyToken) return false
  // keyToken arrives like "Dmaj", "Ador", "Bmin" — strip any trailing
  // mode-qualifier noise defensively, but otherwise match exactly since
  // ABC key tokens are already terse.
  return KEYS_WITH_FSHARP.has(keyToken.trim())
}

function abcNoteToMidi(letter, isLower, octaveMarks, sharp) {
  let base = NOTE_TO_SEMITONE[letter.toUpperCase()]
  if (sharp) base += 1
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
// this module does; see file header).
function extractKeySig(abcTune) {
  const m = abcTune.match(/^K:\s*(\S+)/m)
  return m ? m[1] : null
}

// Strip ABC header lines, leaving just the note-letter stream with
// duration suffixes attached. Returns { body, keySig }.
function stripHeaders(abcTune) {
  const keySig = extractKeySig(abcTune)
  const lines = abcTune.split('\n')
  const bodyLines = lines.filter(l => {
    const t = l.trim()
    if (!t) return false
    if (/^[A-Z]:/.test(t)) return false
    return true
  })
  return { body: bodyLines.join(' '), keySig }
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
  const keyDefaultSharp = keySignatureHasFSharp(keySig)

  const notes = []
  let fOverride = null   // null = no override this measure; true/false = forced

  // Captures: optional accidental marker, note letter, octave marks,
  // duration suffix. Bar lines are matched separately so we can reset
  // fOverride at each one while walking the string in order.
  const re = /(\|)|([\^_=]?)([A-Ga-g])([,']*)(\d*\/\d*|\/+\d*|\d+)?/g
  let m
  while ((m = re.exec(body)) !== null) {
    if (m[1] === '|') {
      fOverride = null
      continue
    }
    const accidental = m[2] || ''
    const letter      = m[3]
    const marks       = m[4] || ''
    const durSfx       = m[5] || ''
    const isLower      = letter === letter.toLowerCase()
    const isF          = letter.toUpperCase() === 'F'

    let sharp = false
    if (isF) {
      if (accidental === '^') { fOverride = true; sharp = true }
      else if (accidental === '=') { fOverride = false; sharp = false }
      else if (accidental === '_') {
        // Flat F has no string on this harp. Fall back to natural and
        // flag it loudly rather than silently producing F# (which would
        // be the wrong direction — flat, not sharp).
        console.warn('[abcToPhrase] F-flat encountered; harp has no flat variant, using F natural instead.')
        fOverride = false
        sharp = false
      } else {
        sharp = fOverride !== null ? fOverride : keyDefaultSharp
      }
    }
    // Other letters: accidentals on non-F notes aren't supported yet
    // (see file header) — they're parsed but ignored for pitch purposes,
    // same as the previous version of this module did for ALL letters.

    notes.push({
      midi:     abcNoteToMidi(letter, isLower, marks, sharp),
      duration: parseDurationSuffix(durSfx),
      sharp,
      letter:   letter.toUpperCase(),
    })
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
//           sharps: [needsSharp,...] }
// Consecutive identical-pitch notes are merged (their durations summed)
// rather than dropped, so the tune's rhythm stays correct — two tied
// eighth-notes on the same string become one beat of double length,
// rather than vanishing or playing as two indistinguishable plucks.
// Two notes only merge if they also agree on needsSharp — a held string
// can't be "half natural, half sharp", so a sharp-state change always
// starts a new beat even if the string index is unchanged.
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
    return { idx: best.idx, duration: n.duration, needsSharp: bestSharp }
  })

  const indices  = []
  const durations = []
  const sharps    = []
  for (const { idx, duration, needsSharp } of snapped) {
    const lastI = indices.length - 1
    if (lastI >= 0 && indices[lastI] === idx && sharps[lastI] === needsSharp) {
      durations[lastI] += duration   // merge repeated same-pitch-and-state notes
    } else {
      indices.push(idx)
      durations.push(duration)
      sharps.push(needsSharp)
    }
  }
  return { indices, durations, sharps }
}


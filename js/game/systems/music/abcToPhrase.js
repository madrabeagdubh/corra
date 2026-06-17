// abcToPhrase.js
// Location: js/game/systems/music/abcToPhrase.js
//
// Minimal ABC notation parser — extracts pitch AND relative duration from
// an ABC tune body, mapping each pitch to the nearest available CorraHarp
// string. Intentionally simple: ignores ornaments, ties, grace notes,
// chord brackets, tuplets, and repeat structure. Good enough to drive a
// timed Phrase for the harp mechanic; not a full ABC parser.
//
// ABC pitch letters: C D E F G A B (octave 4ish), lowercase = octave up,
// commas after a letter = octave down, apostrophes after = octave up.
// ABC duration: a digit after the note multiplies the default length
// (e.g. G2 = twice as long), a slash halves it (e.g. G/2 or G/ = half).

const NOTE_TO_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

function abcNoteToMidi(letter, isLower, octaveMarks) {
  const base = NOTE_TO_SEMITONE[letter.toUpperCase()]
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

// Strip ABC header lines, leaving just the note-letter stream with
// duration suffixes attached.
export function parseAbcToNotes(abcTune) {
  const lines = abcTune.split('\n')
  const bodyLines = lines.filter(l => {
    const t = l.trim()
    if (!t) return false
    if (/^[A-Z]:/.test(t)) return false
    return true
  })
  const body = bodyLines.join(' ')

  const notes = []
  // Captures: optional accidental, note letter, octave marks, duration suffix
  const re = /[\^_=]?([A-Ga-g])([,']*)(\d*\/\d*|\/+\d*|\d+)?/g
  let m
  while ((m = re.exec(body)) !== null) {
    const letter   = m[1]
    const marks    = m[2] || ''
    const durSfx   = m[3] || ''
    const isLower  = letter === letter.toLowerCase()
    notes.push({
      midi:     abcNoteToMidi(letter, isLower, marks),
      duration: parseDurationSuffix(durSfx),
    })
  }
  return notes
}

// Backwards-compatible: just the MIDI sequence, no durations.
export function parseAbcToMidiSequence(abcTune) {
  return parseAbcToNotes(abcTune).map(n => n.midi)
}

// Maps an arbitrary MIDI sequence onto CorraHarp's actual available
// strings, folding octaves as needed to stay in range.
export function midiSequenceToStringIndices(midiSeq, corraHarp, harpMidiRange) {
  const { min, max, available } = harpMidiRange
  return midiSeq.map(midi => {
    let target = midi
    while (target < min) target += 12
    while (target > max) target -= 12
    let best = available[0], bestDist = Infinity
    for (const entry of available) {
      const d = Math.abs(entry.m - target)
      if (d < bestDist) { bestDist = d; best = entry }
    }
    return best.idx
  })
}

// Convenience: full pipeline, pitches only, deduplicating consecutive
// repeats. Kept for callers that only care about pitch sequence.
export function abcToStringSequence(abcTune, corraHarp, harpMidiRange) {
  const midiSeq = parseAbcToMidiSequence(abcTune)
  const indices = midiSequenceToStringIndices(midiSeq, corraHarp, harpMidiRange)
  const collapsed = []
  for (const idx of indices) {
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
// Returns { indices: [stringIdx,...], durations: [relativeLength,...] }
// Consecutive identical-pitch notes are merged (their durations summed)
// rather than dropped, so the tune's rhythm stays correct — two tied
// eighth-notes on the same string become one beat of double length,
// rather than vanishing or playing as two indistinguishable plucks.
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
    let best = available[0], bestDist = Infinity
    for (const entry of available) {
      const d = Math.abs(entry.m - target)
      if (d < bestDist) { bestDist = d; best = entry }
    }
    return { idx: best.idx, duration: n.duration }
  })

  const indices = []
  const durations = []
  for (const { idx, duration } of snapped) {
    const lastI = indices.length - 1
    if (lastI >= 0 && indices[lastI] === idx) {
      durations[lastI] += duration   // merge repeated same-pitch notes
    } else {
      indices.push(idx)
      durations.push(duration)
    }
  }
  return { indices, durations }
}


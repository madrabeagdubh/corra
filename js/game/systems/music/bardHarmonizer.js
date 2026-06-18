// bardHarmonizer.js
// Location: js/game/systems/music/bardHarmonizer.js
//
// Turns a melody (already parsed via abcToPhrase.js) into a BardSequence
// — the Group[] format bardAccompaniment.js's player-paced engine
// consumes (see that file's GROUP FORMAT doc). This is the missing
// piece between "here's a tune's notes" and "here's something the bard
// engine can light up and wait on."
//
// Two things happen here that didn't exist anywhere else in the music
// system before:
//   1. GROUPING — deciding how many consecutive melody notes become one
//      playable gesture, and whether that gesture is a CHORD (notes +
//      added harmony, all lit together) or a RUN (the melody notes
//      themselves, lit one at a time in sequence) or a single note.
//      Per explicit design direction: gesture variety across a short,
//      repeating tune matters more than uniform chunking, and group
//      boundaries are allowed to cross the tune's notated bar lines
//      when that groups the melody more musically (bar lines are a
//      notational artifact, not a phrasing rule).
//   2. HARMONIZATION — for chord gestures, building a real diatonic
//      triad rather than just clustering whatever melody notes happen
//      to be adjacent. Arbitrary clustering risks genuinely bad-
//      sounding intervals (stacked 2nds etc), which would undermine the
//      "satisfying sound" goal of this mode. The rule used: the melody
//      note in question becomes the chord's ROOT, and the triad is
//      built upward from it using the tune's OWN diatonic scale (via
//      abcToPhrase.js's keyToDiatonicScale) — so every chord is
//      guaranteed in-key, regardless of which tune this runs on.
//
// This file does NOT know anything about poem text, illustrations, or
// reveal payloads — it only builds the musical Group.strings/sharps/
// ordered shape. The caller (e.g. tavern.js) is expected to zip the
// resulting groups together with whatever narrative content accompanies
// each one (see buildBardSequenceWithText below for a convenience that
// does exactly that zipping).

import { parseAbcToNotes, extractKeySig, keyToDiatonicScale, abcToTimedStringSequence } from './abcToPhrase.js'

const NOTE_TO_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

// Builds a 7-entry array of pitch classes (0-11) for the tune's
// diatonic scale, in scale-degree order (index 0 = tonic), from
// abcToPhrase.js's keyToDiatonicScale output.
function scalePitchClasses(diatonicScale) {
  return diatonicScale.map(({ letter, accidental }) =>
    (NOTE_TO_SEMITONE[letter] + accidental + 12) % 12
  )
}

// Given a MIDI pitch and the scale's pitch classes, returns the closest
// scale degree (0-6) that pitch belongs to. "Closest" matters because
// the melody may occasionally pass through a pitch the snapping/octave-
// fold process altered slightly, or (rarely) a genuine chromatic
// passing tone — rather than throw, just find the nearest in-scale
// degree so harmonization always has SOMETHING sensible to build on.
function nearestScaleDegree(midi, pitchClasses) {
  const pc = ((midi % 12) + 12) % 12
  let best = 0, bestDist = Infinity
  pitchClasses.forEach((spc, degree) => {
    // Circular distance on the 12-pitch-class wheel, since degree 6
    // (e.g. F#=6) and degree 0 (e.g. A=9, wrapping) are close around
    // the wheel even though their raw numeric difference is large.
    const d = Math.min(Math.abs(pc - spc), 12 - Math.abs(pc - spc))
    if (d < bestDist) { bestDist = d; best = degree }
  })
  return best
}

// Builds a diatonic triad (3 pitch classes) rooted at the given scale
// degree, by stacking the scale's own 3rd and 5th above it — i.e.
// degrees [root, root+2, root+4] (mod 7), each converted to a real
// pitch class via the scale's pitch-class table. This is what
// guarantees every harmonized chord stays in-key: the triad is built
// FROM the scale, never from chromatic alterations.
function diatonicTriadPitchClasses(rootDegree, pitchClasses) {
  return [0, 2, 4].map(offset => pitchClasses[(rootDegree + offset) % 7])
}

// Snaps a target pitch class to the nearest ACTUAL playable string,
// searching outward in both directions from a given anchor MIDI pitch
// so the chosen string lands close to the melody note it's harmonizing
// (rather than, say, two octaves away just because that's where the
// pitch class first occurs in the available range). Returns
// { idx, needsSharp } or null if nothing matches within a reasonable
// search radius (shouldn't normally happen on a fully diatonic harp,
// but this stays defensive rather than assuming).
function findStringForPitchClass(targetPc, anchorMidi, available) {
  let best = null, bestDist = Infinity
  for (const entry of available) {
    const natPc = ((entry.m % 12) + 12) % 12
    if (natPc === targetPc) {
      const d = Math.abs(entry.m - anchorMidi)
      if (d < bestDist) { bestDist = d; best = { idx: entry.idx, needsSharp: false } }
    }
    if (entry.sharpM !== undefined) {
      const sharpPc = ((entry.sharpM % 12) + 12) % 12
      if (sharpPc === targetPc) {
        const d = Math.abs(entry.sharpM - anchorMidi)
        if (d < bestDist) { bestDist = d; best = { idx: entry.idx, needsSharp: true } }
      }
    }
  }
  return best
}

// True if any two ADJACENT entries in the array are equal — used to
// detect a run chunk where two consecutive melody notes happened to
// snap to the same harp string, which would make an ordered run ask
// for an awkward "pluck the same string twice in a row" step. Only
// adjacent duplicates matter (non-adjacent repeats, e.g. a melody that
// returns to an earlier pitch later in the run, are completely normal
// and not a problem for sequencing).
function hasConsecutiveDuplicate(arr) {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === arr[i - 1]) return true
  }
  return false
}

// ── Grouping ─────────────────────────────────────────────────────────
// Decides gesture shapes across the melody. Walks the resolved beat
// sequence in chunks that CYCLE through a small palette of shapes
// (chord, single, run, chord, run, single, ...) so a short, repeating
// tune doesn't read as the same gesture over and over even though the
// underlying notes repeat. A "chord" gesture always consumes exactly
// ONE melody note — it harmonizes AROUND that note by adding extra
// diatonic harmony strings, it does not fold multiple melody notes
// together (see the size override in buildBardSequence below for why).
// A "run" gesture keeps 2-3 melody notes as a literal ordered sequence;
// a "single" gesture is just the next melody note on its own. Group
// boundaries are decided purely by this rotation, with no reference to
// the tune's original bar lines at all — this is what lets gestures
// cross bar lines freely, per explicit design direction.
// purely by this rotation, with no reference to the original barring
// at all.
const GESTURE_PATTERN = [
  { shape: 'chord',  size: 1 },   // size ignored for 'chord' (always 1 melody note) — see grouping comment above
  { shape: 'single', size: 1 },
  { shape: 'run',    size: 3 },
  { shape: 'chord',  size: 1 },
  { shape: 'run',    size: 2 },
  { shape: 'single', size: 1 },
  { shape: 'chord',  size: 1 },
  { shape: 'run',    size: 3 },
]

// Builds a BardSequence (Group[], musical fields only — no text/reveal)
// from a tune's ABC source and a harp's MIDI range (same shape as
// corraHarp.getMidiRange()'s output).
//
// `opts.gesturePattern`: override GESTURE_PATTERN for a different
//   variety palette (e.g. a longer or differently-weighted rotation).
export function buildBardSequence(abcTune, harpMidiRange, opts = {}) {
  const pattern = opts.gesturePattern ?? GESTURE_PATTERN
  const keySig = extractKeySig(abcTune)
  const diatonicScale = keyToDiatonicScale(keySig)
  const pitchClasses = scalePitchClasses(diatonicScale)

  // Reuse the EXISTING, already-tested melody->string pipeline rather
  // than re-deriving snapping/octave-fold logic here. This also means
  // ornaments (rolls/cuts/triplets) detected upstream survive into the
  // bard sequence for free — a "single" gesture that happens to land on
  // an ornamented beat will carry that ornament through unchanged.
  const { indices, sharps, ornaments } = abcToTimedStringSequence(abcTune, null, harpMidiRange)

  // We also need each beat's actual sounded MIDI pitch (for
  // harmonization's scale-degree lookup) — abcToTimedStringSequence
  // doesn't return that directly, but it's cheap to recover: look up
  // the string's natural or sharp MIDI from harpMidiRange.available
  // using the index+sharp flag abcToTimedStringSequence already chose.
  const availableByIdx = new Map(harpMidiRange.available.map(e => [e.idx, e]))
  const midiForBeat = indices.map((idx, i) => {
    const entry = availableByIdx.get(idx)
    if (!entry) return null
    return sharps[i] && entry.sharpM !== undefined ? entry.sharpM : entry.m
  })

  const groups = []
  let i = 0
  let patternPos = 0
  while (i < indices.length) {
    const { shape, size: patternSize } = pattern[patternPos % pattern.length]
    patternPos++

    // IMPORTANT: a 'chord' gesture harmonizes AROUND a single melody
    // note (adds harmony notes on top of it) — it does not, and must
    // not, consume multiple melody beats just because the gesture
    // pattern's `size` field says so. An earlier version of this
    // function used chunkIndices[0] as the chord's root but still
    // advanced the melody pointer by the full chunk size, which
    // silently discarded the other 1-2 melody notes in that chunk
    // entirely (lost ~47 of 166 real melody notes on this tune — a
    // serious bug, not a cosmetic one). 'run' and 'single' chunks are
    // unaffected: they genuinely consume one melody beat per string.
    const size = shape === 'chord' ? 1 : patternSize
    const chunkEnd = Math.min(i + size, indices.length)
    const chunkIndices  = indices.slice(i, chunkEnd)
    const chunkSharps   = sharps.slice(i, chunkEnd)
    const chunkMidi     = midiForBeat.slice(i, chunkEnd)
    const chunkOrnament = ornaments.slice(i, chunkEnd).find(Boolean) ?? null
    i = chunkEnd

    if (chunkIndices.length === 0) break

    if (shape === 'chord') {
      groups.push(buildChordGroup(chunkIndices[0], chunkSharps[0], chunkMidi[0], pitchClasses, harpMidiRange.available, chunkOrnament))
    } else if (shape === 'run' && chunkIndices.length >= 2 && !hasConsecutiveDuplicate(chunkIndices)) {
      groups.push({
        strings: chunkIndices,
        sharps:  chunkSharps,
        ordered: true,
        ornament: chunkOrnament,
      })
    } else if (chunkIndices.length === 1) {
      // The genuine 'single' shape, or any other shape truncated to one
      // note by running out of melody (e.g. the very last beat of the
      // tune) — a single note doesn't benefit from harmonization OR
      // sequencing, since there's nothing else in the gesture to
      // harmonize against or sequence with.
      groups.push({
        strings: [chunkIndices[0]],
        sharps:  [chunkSharps[0]],
        ordered: false,
        ornament: chunkOrnament,
      })
    } else {
      // Fallback for a 'run' chunk that had a consecutive-duplicate
      // string (two melody notes snapped to the same harp string,
      // which would make an ordered run ask for an awkward "pluck the
      // same string twice in a row" step — see file header) — or any
      // other shape/size combination not handled above. Rather than
      // drop the extra notes (a real bug an earlier version of this
      // function had: it only ever kept chunkIndices[0]), emit them as
      // separate single-note groups so every melody note still gets
      // its own gesture, just without the run's sequencing.
      chunkIndices.forEach((idx, k) => {
        groups.push({
          strings: [idx],
          sharps:  [chunkSharps[k]],
          ordered: false,
          ornament: k === 0 ? chunkOrnament : null,
        })
      })
    }
  }

  return groups
}

// Builds one CHORD-shape group: the melody note at `rootIdx` (string
// index) becomes the chord's root; a diatonic triad is built upward
// from its scale degree (see diatonicTriadPitchClasses), and each
// triad tone is snapped to the nearest actual playable string near the
// melody note's own pitch. The melody note's own string is always
// included (it's degree 0 of the triad by construction); the other two
// triad tones are added IF a playable string is found for them — on a
// fully diatonic 13-string harp this should basically always succeed,
// but the check stays defensive rather than assuming.
function buildChordGroup(rootIdx, rootSharp, rootMidi, pitchClasses, available, ornament) {
  const rootEntry = available.find(e => e.idx === rootIdx)
  const rootDegree = nearestScaleDegree(rootMidi, pitchClasses)
  const triadPcs = diatonicTriadPitchClasses(rootDegree, pitchClasses)

  const strings = [rootIdx]
  const stringSharps = [rootSharp]
  const usedIndices = new Set([rootIdx])

  // Skip triadPcs[0] (the root itself, already included) — only need
  // to find strings for the 3rd and 5th above it.
  for (const pc of triadPcs.slice(1)) {
    const found = findStringForPitchClass(pc, rootMidi, available)
    if (found && !usedIndices.has(found.idx)) {
      strings.push(found.idx)
      stringSharps.push(found.needsSharp)
      usedIndices.add(found.idx)
    }
    // If no playable string is found, or it collides with an
    // already-used string (can happen near the harp's range edges),
    // the chord just plays with fewer notes rather than forcing a
    // bad/duplicate choice — a 2-note dyad is still musically valid,
    // unlike a wrong pitch class would be.
  }

  return { strings, sharps: stringSharps, ordered: false, ornament }
}

// ── Convenience: zip a musical BardSequence with narrative content ───
// Most callers won't want JUST the musical groups — they'll have a
// parallel list of text/reveal chunks to pace alongside the music (the
// Maebh/Táin poem, broken into lines or stanzas). This helper does the
// zipping so callers don't have to repeat it: pairs each group with the
// next available text chunk, cycling the MUSIC if there's more text
// than music (the "tune loops while the poem keeps advancing
// underneath it" pattern) or cycling nothing if there's more music than
// text (extra trailing groups just get no text — callers can choose to
// trim `groups` first if that's not wanted for a given tune/text pair).
//
// `textChunks`: array of opaque payloads (whatever shape the caller's
//   text-display code expects — e.g. {ga, en} bilingual pairs).
// Returns a new Group[] with `.text` set; does not mutate the input.
export function zipBardSequenceWithText(groups, textChunks) {
  if (!textChunks?.length) return groups.map(g => ({ ...g }))
  if (!groups?.length) return []
  // Output length is the LONGER of the two — whichever side is shorter
  // cycles to fill the gap. This is what makes both directions of the
  // "tune loops under a longer poem" / "poem chunk repeats under more
  // music" pairing work from the same function, rather than always
  // truncating to whichever array happens to be passed second. An
  // earlier version of this function used textChunks.map(...), which
  // silently truncated the OUTPUT to textChunks.length regardless of
  // how many musical groups existed — i.e. it threw away every
  // musical group beyond the text count instead of cycling the music,
  // the exact opposite of the documented behavior. Fixed here.
  const length = Math.max(groups.length, textChunks.length)
  const result = []
  for (let i = 0; i < length; i++) {
    result.push({ ...groups[i % groups.length], text: textChunks[i % textChunks.length] })
  }
  return result
}


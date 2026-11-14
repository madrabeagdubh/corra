// abcOrnaments.js -- how a harper plays the ornaments a tune's ABC marks, as notes.
//
// parseAbcToNotes (abcToPhrase.js) reads the marks but leaves the note single: `~G3` (a roll) comes out as one dotted
// crotchet G with roll: true, `{a}G` as one G with grace: { letters: ['a'] }. Played as written, a roll is a long flat
// note where the tune wants a figure. This turns each into the notes a harp plays for it (a harp has no cuts and taps, so
// rolls are played as triplets, the way banjo and harp players do):
//
//   a long roll (three quavers or more, ~G3 in a jig):  G, then a triplet A G F in the second quaver, then G   G (3AGF G
//   a short roll (two quavers, ~G2 in a reel):          a triplet G A G in the first quaver, then G             (3GAG G
//   a roll on one quaver:                               the triplet alone                                       (3GAG
//   grace notes ({a}G, {DE}F):                          each a flick just before the note, taking its time from the
//                                                       note before
//
// The neighbours above and below are the tune's own scale (the pitch classes the tune uses), so a roll in G on an A-B-C
// tune never reaches for a note the tune doesn't have.
//
//   import { ornamentPlan, tunePitchClasses } from './abcOrnaments.js'
//   const pcs = tunePitchClasses(notes)
//   ornamentPlan(note, pcs)  -> null (play the note as it is) or [{ o, m, v, trip }]
//       o: when, in quavers from the note's own start (a grace is a little before it, negative)
//       m: the MIDI note; v: how hard, as a share of the note's own; trip: [start, k, span] for a note of a triplet (the
//       triplet begins `start` quavers in, lasts `span`, and this is its k-th note of three), so a player that swings its
//       quavers can place the triplet's notes evenly between its swung start and end

export const GRACE_Q = 0.16      // a grace note's length, in quavers (some 30ms at a session pace)

const NATURAL = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export function tunePitchClasses(notes) {
  const s = new Set()
  for (const n of notes) if (Number.isFinite(n.midi)) s.add(((n.midi % 12) + 12) % 12)
  return s
}
// the tune's next note up or down from m (a step of the scale; a tone if the tune gives nothing nearer)
function step(m, dir, pcs) {
  for (let d = 1; d <= 3; d++) { const x = m + d * dir; if (pcs.has(((x % 12) + 12) % 12)) return x }
  return m + 2 * dir
}
// a grace note's letter as a pitch: the ABC octave (C = middle C, c the one above), sharpened or flattened as the tune is
function graceMidi(letter, pcs) {
  const L = letter.toUpperCase(), base = (letter === L ? 60 : 72) + NATURAL[L], pc = NATURAL[L]
  if (pcs.has(pc)) return base
  if (pcs.has((pc + 1) % 12)) return base + 1
  if (pcs.has((pc + 11) % 12)) return base - 1
  return base
}

export function ornamentPlan(n, pcs) {
  if (!n || !Number.isFinite(n.midi)) return null
  const D = Number.isFinite(n.duration) && n.duration > 0 ? n.duration : 1, m = n.midi
  let out = null
  if (n.roll) {
    const up = step(m, 1, pcs), dn = step(m, -1, pcs)
    if (D >= 2.5) out = [{ o: 0, m, v: 1 }, { o: 1, m: up, v: 0.6, trip: [1, 0, 1] }, { o: 1 + 1 / 3, m, v: 0.75, trip: [1, 1, 1] }, { o: 1 + 2 / 3, m: dn, v: 0.6, trip: [1, 2, 1] }, { o: 2, m, v: 0.9 }]
    else {
      const q = Math.min(1, D) / 3
      out = [{ o: 0, m, v: 1, trip: [0, 0, 3 * q] }, { o: q, m: up, v: 0.6, trip: [0, 1, 3 * q] }, { o: 2 * q, m, v: 0.8, trip: [0, 2, 3 * q] }]
      if (D >= 1.5) out.push({ o: 1, m, v: 0.9 })
    }
  }
  if (n.grace && n.grace.letters?.length) {
    const g = n.grace.letters.map((l, k, a) => ({ o: -(a.length - k) * GRACE_Q, m: graceMidi(l, pcs), v: 0.5 }))
    out = [...g, ...(out || [{ o: 0, m, v: 1 }])]
  }
  return out
}

// bodhranSkin.js -- a second bodhrán, kept for when one is wanted. Not used anywhere yet.
//
// Built for the champion sky (where it was tried and taken out again: the sky wanted no drum), from the dialogue drum's
// player (bodhran.js): the same figures, the same weights -- a dead-steady pulse, the groove all in the dynamics. What is
// new is the skin:
//   - a drumhead rings at several pitches that aren't multiples of each other: about 1, 1.59 and 2.14 times its note;
//     three sines at those ratios, each dying faster the higher it is
//   - its pitch falls only a little as it dies (6%), not by half (which reads as an electronic tom)
//   - the tipper's slap is band-passed noise
//   - a phone can't sound the low thud at all, so the upper rings and the slap carry it there
//   - the player's hand on the back of the skin raises its pitch a little; moving it from phrase to phrase (`hand`) is a
//     large part of what makes it sound played
//
// In the sky it played the turning: silent at rest; as the sky turned, the accents alone (a heartbeat), then the whole
// figure, then (flung hard) the triplet pickups -- each stroke's `lv` says from what level it plays; and a roll into
// the bar line at every change of tune (rollInto).
//
//   import { strike, FIGURES, rollInto } from './bodhranSkin.js'
//   strike(ctx, ctx.destination, 'dum', 0.2, ctx.currentTime + 0.1, 1.04)

// each stroke: `f` the skin's note for it, `ms` how long it rings, the share of noise (slap) and body (ring), and how
// bright the slap is
export const SKIN = {
  click: { f: 560, ms: 26, noise: 0.95, body: 0.12, bright: 4600 },
  tak: { f: 310, ms: 70, noise: 0.6, body: 0.5, bright: 2300 },
  tap: { f: 190, ms: 140, noise: 0.42, body: 0.85, bright: 1300 },
  dum: { f: 104, ms: 260, noise: 0.3, body: 1.15, bright: 800 },
}
export const ACCENT = 1.6, GHOST = 0.35

// the figures: `at` in quavers from the phrase's start; a: accent, g: ghost; lv: the least intensity it plays at (1 the
// accents alone, 2 the whole figure, 3 with the pickups). Two phrases each, to alternate; `span` the phrase's length
export const FIGURES = {
  jig: { span: 3, bars: [
    [{ at: 0, k: 'dum', a: 1, lv: 1 }, { at: 1, k: 'click', g: 1, lv: 2 }, { at: 2, k: 'tak', lv: 2 }],
    [{ at: 0, k: 'tap', a: 1, lv: 1 }, { at: 1, k: 'click', g: 1, lv: 2 }, { at: 2, k: 'tak', lv: 2 }, { at: 2.33, k: 'click', g: 1, lv: 3 }, { at: 2.66, k: 'click', g: 1, lv: 3 }]] },
  reel: { span: 4, bars: [
    [{ at: 0, k: 'dum', a: 1, lv: 1 }, { at: 1, k: 'click', g: 1, lv: 2 }, { at: 2, k: 'tak', lv: 2 }, { at: 3, k: 'click', g: 1, lv: 2 }],
    [{ at: 0, k: 'tap', a: 1, lv: 1 }, { at: 1, k: 'click', g: 1, lv: 2 }, { at: 2, k: 'tak', lv: 2 }, { at: 3, k: 'click', g: 1, lv: 2 }, { at: 3.5, k: 'click', g: 1, lv: 3 }]] },
  waltz: { span: 6, bars: [
    [{ at: 0, k: 'dum', a: 1, lv: 1 }, { at: 1, k: 'click', g: 1, lv: 3 }, { at: 2, k: 'tak', lv: 2 }, { at: 3, k: 'click', g: 1, lv: 3 }, { at: 4, k: 'tak', lv: 2 }, { at: 5, k: 'click', g: 1, lv: 3 }],
    [{ at: 0, k: 'tap', a: 1, lv: 1 }, { at: 2, k: 'tak', lv: 2 }, { at: 4, k: 'tak', lv: 2 }, { at: 5, k: 'click', g: 1, lv: 3 }, { at: 5.5, k: 'click', g: 1, lv: 3 }]] },
}

// the strokes of a whole bar of `bar` quavers (6 or 9 or 12 a jig's, 6 in three-time a waltz's, else a reel's), the
// two phrases alternating; each with its place in the bar
export function barFigure(bar, compound) {
  const fig = compound ? FIGURES.jig : bar === 6 ? FIGURES.waltz : FIGURES.reel, out = []
  for (let k = 0, at = 0; at < bar - 1e-3; k++, at += fig.span) for (const q of fig.bars[k % 2]) if (at + q.at < bar - 1e-3) out.push({ ...q, at: at + q.at })
  return out
}

const noiseFor = new WeakMap()
// one stroke of kind `k` at loudness `v`, at audio time `when`; `hand` raises the skin's pitch (1 none, ~1.12 pressed)
export function strike(ctx, dest, k, v, when, hand = 1) {
  try {
    const sk = SKIN[k], dur = sk.ms / 1000, f0 = sk.f * hand * (1 + (Math.random() - 0.5) * 0.02)
    for (const [m, a] of [[1, 1], [1.59, 0.55], [2.14, 0.3]]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), d = dur / Math.sqrt(m)
      o.type = 'sine'; o.frequency.setValueAtTime(f0 * m, when); o.frequency.exponentialRampToValueAtTime(f0 * m * 0.94, when + d)
      g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v * sk.body * a), when + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, when + d)
      o.connect(g); g.connect(dest); o.start(when); o.stop(when + d + 0.02)
    }
    let nb = noiseFor.get(ctx)
    if (!nb) { const n = ctx.sampleRate; nb = ctx.createBuffer(1, n, n); const o = nb.getChannelData(0); for (let i = 0; i < n; i++) o[i] = Math.random() * 2 - 1; noiseFor.set(ctx, nb) }
    const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), nd = Math.max(0.012, dur * 0.35)
    src.buffer = nb; bp.type = 'bandpass'; bp.frequency.value = sk.bright * hand; bp.Q.value = 0.9
    g.gain.setValueAtTime(v * sk.noise, when); g.gain.exponentialRampToValueAtTime(0.0001, when + nd)
    src.connect(bp); bp.connect(g); g.connect(dest); src.start(when, Math.random() * 0.8); src.stop(when + nd + 0.02)
  } catch (e) { /* no drum, no matter */ }
}

// a roll into a bar line at audio time `end`, across the beat before it (`span` seconds): rising, then the dum on it
export function rollInto(ctx, dest, end, span, v, hand = 1) {
  for (const [u, k, a] of [[0, 'click', 0.45], [1 / 3, 'click', 0.6], [2 / 3, 'tak', 0.85], [5 / 6, 'click', 0.7]]) {
    const when = end - span * (1 - u)
    if (when > ctx.currentTime) strike(ctx, dest, k, v * a, when, hand)
  }
  strike(ctx, dest, 'dum', v * ACCENT, end, 1)
}

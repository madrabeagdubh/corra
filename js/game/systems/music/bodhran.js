// bodhran.js
//
// The interface's instrument. The harp carries the language; this carries the
// buttons.
//
// Two wrong turns are worth recording, because both are easy to repeat.
//
// FIRST: timbre is not the problem. An early version had four convincing drum
// sounds and still sounded mechanical.
//
// SECOND, and less obvious: the fix for "this sounds like footsteps" is NOT to
// make the strokes irregular. Irregular strokes sound like someone unsure where
// the beat is. A bodhrán player is rock steady -- the groove lives entirely in
// the DYNAMICS. Accent the downbeat, brush everything between, keep the pulse
// dead even underneath. Ghost strokes at a third of the accent's weight are
// what the ear reads as playing; moving notes around is not.
//
// So: pulse on every unit, music in the weights.
//
// Borrows the Phaser AudioContext through SoundBoard rather than opening one of
// its own -- see the note in dialogueHarp.js.

import { SoundBoard } from '../soundBoard.js'

// Four strokes that differ in kind. Length decides whether a stroke carries
// audible pitch at all: a click is nearly pure transient, a dum is long enough
// for its pitch to arrive.
const CLICK = { tone: 900, bright: 5200, ms:  14, noise: 0.9,  body: 0.15 }
const TAK   = { tone: 380, bright: 2300, ms:  45, noise: 0.7,  body: 0.55 }
const TAP   = { tone: 260, bright: 1300, ms:  95, noise: 0.5,  body: 0.85 }
const DUM   = { tone: 130, bright:  700, ms: 170, noise: 0.35, body: 1.2  }

const VOL    = 0.17
const ACCENT = 1.6
const GHOST  = 0.35    // the whole groove is this number's distance from ACCENT

const FALLBACK_UNIT = 180

// -- Figures ------------------------------------------------------------------
// `at` is in units. The pulse is even; `a` accents and `g` brushes.

// Jig: three units to the phrase. DUM . ki . ta
const JIG_A = [
  { at: 0, v: DUM,   a: 1 },
  { at: 1, v: CLICK, g: 1 },
  { at: 2, v: TAK          },
]
const JIG_B = [
  { at: 0,    v: TAP,   a: 1 },
  { at: 1,    v: CLICK, g: 1 },
  { at: 2,    v: TAK          },
  // Triplet pickup into the next downbeat -- an answer, not a new idea.
  { at: 2.33, v: CLICK, g: 1 },
  { at: 2.66, v: CLICK, g: 1 },
]

// Reel: four units. DUM . ki . ta . ki
const REEL_A = [
  { at: 0, v: DUM,   a: 1 },
  { at: 1, v: CLICK, g: 1 },
  { at: 2, v: TAK          },
  { at: 3, v: CLICK, g: 1 },
]
const REEL_B = [
  { at: 0,    v: TAP,   a: 1 },
  { at: 1,    v: CLICK, g: 1 },
  { at: 2,    v: TAK          },
  { at: 3,    v: CLICK, g: 1 },
  { at: 3.5,  v: CLICK, g: 1 },
]

// A triplet roll into a dum: an ending rather than a stopping.
const CLOSE = [
  { at: 0,    v: CLICK, g: 1 },
  { at: 0.25, v: CLICK, g: 1 },
  { at: 0.5,  v: TAK          },
  { at: 1,    v: DUM,   a: 1 },
]

// takka clicka takka tap -- when an option is taken.
const CHOOSE = [
  { at: 0,    v: TAK          },
  { at: 0.25, v: CLICK, g: 1 },
  { at: 0.5,  v: TAK          },
  { at: 0.85, v: DUM,   a: 1 },
]

function figuresFor(barUnits) {
  // 6 units to a bar is a jig, 8 a reel. Anything odd falls in with the reel,
  // whose figure is the more neutral of the two.
  return (barUnits === 6 || barUnits === 9)
    ? { span: 3, bars: [JIG_A, JIG_B] }
    : { span: 4, bars: [REEL_A, REEL_B] }
}

class BodhranImpl {
  constructor() {
    this.scene = null
    this.on    = true
  }

  setScene(scene) { if (scene) this.scene = scene }
  setEnabled(v)   { this.on = !!v }

  _ctx() {
    try { return SoundBoard.ctx(this.scene) } catch (e) { return null }
  }

  /**
   * A struck skin: noise for the tipper over a pitch that drops. `body` weights
   * the tone against the stick, which is how a click and a dum sound like
   * different actions rather than one action at two volumes.
   */
  _hit(ctx, voice, vol, delayMs) {
    try {
      const when = ctx.currentTime + Math.max(0, delayMs) / 1000
      const dur  = voice.ms / 1000

      if (voice.body > 0) {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(voice.tone, when)
        osc.frequency.exponentialRampToValueAtTime(voice.tone * 0.5, when + dur)
        const og = ctx.createGain()
        og.gain.setValueAtTime(vol * voice.body, when)
        og.gain.exponentialRampToValueAtTime(0.0001, when + dur)
        osc.connect(og); og.connect(ctx.destination)
        osc.start(when); osc.stop(when + dur + 0.02)
      }

      const n   = Math.max(1, Math.floor(ctx.sampleRate * dur * 0.4))
      const buf = ctx.createBuffer(1, n, ctx.sampleRate)
      const d   = buf.getChannelData(0)
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n)
      const src = ctx.createBufferSource()
      src.buffer = buf
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.setValueAtTime(voice.bright, when)
      bp.Q.setValueAtTime(1.1, when)
      const ng = ctx.createGain()
      ng.gain.setValueAtTime(vol * voice.noise, when)
      ng.gain.exponentialRampToValueAtTime(0.0001, when + dur * 0.5)
      src.connect(bp); bp.connect(ng); ng.connect(ctx.destination)
      src.start(when)
    } catch (e) { /* the interface still works without a drum */ }
  }

  _play(events, unitMs, offsetMs = 0) {
    if (!this.on) return
    const ctx = this._ctx()
    if (!ctx) return
    const u = (Number.isFinite(unitMs) && unitMs > 0) ? unitMs : FALLBACK_UNIT
    for (const e of events) {
      const w = e.a ? ACCENT : (e.g ? GHOST : 1)
      this._hit(ctx, e.v, VOL * w, offsetMs + e.at * u)
    }
  }

  /**
   * Where each button should land, in ms -- the accented downbeat of its
   * phrase. Handed to the caller so the visual reveal and the drum run off one
   * set of numbers and can't drift.
   */
  soloBeats(count, unitMs = FALLBACK_UNIT, barUnits = 8) {
    const u = (Number.isFinite(unitMs) && unitMs > 0) ? unitMs : FALLBACK_UNIT
    const { span } = figuresFor(barUnits)
    const out = []
    for (let i = 0; i < Math.max(0, count); i++) out.push(i * span * u)
    return out
  }

  /** The groove under options arriving: a phrase per button, alternating. */
  solo(count, unitMs = FALLBACK_UNIT, barUnits = 8) {
    const u = (Number.isFinite(unitMs) && unitMs > 0) ? unitMs : FALLBACK_UNIT
    const { span, bars } = figuresFor(barUnits)
    const n = Math.max(1, count)
    for (let i = 0; i < n; i++) this._play(bars[i % bars.length], u, i * span * u)
    this._play(CLOSE, u, n * span * u)
  }

  /** takka clicka takka tap. */
  choose(unitMs = FALLBACK_UNIT) { this._play(CHOOSE, unitMs) }

  /**
   * One phrase, no closing stroke -- for playing underneath the player's own
   * line while the harp is silent. `variant` alternates the figure so repeated
   * turns in a conversation don't all sound identical.
   */
  phrase(unitMs = FALLBACK_UNIT, barUnits = 8, variant = 0) {
    const { bars } = figuresFor(barUnits)
    this._play(bars[Math.abs(variant) % bars.length], unitMs)
  }

  /** A single stroke, for anything that isn't a gesture. */
  tip(delayMs = 0) {
    const ctx = this._ctx()
    if (ctx && this.on) this._hit(ctx, TAK, VOL, delayMs)
  }

  /** Back-compatible with the earlier two-figure API. */
  flourish(kind = 'stroke', unitMs = FALLBACK_UNIT) {
    if (kind === 'roll') this.solo(3, unitMs)
    else this.choose(unitMs)
  }
}

export const Bodhran = new BodhranImpl()

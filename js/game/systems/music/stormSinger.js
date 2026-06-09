// stormSinger.js
// Location: js/game/systems/music/stormSinger.js
//
// Port a beul synthesiser for the storm crossing scene.
// The champion sings their theme tune as mouth music — "dee dum diddle dee" —
// to keep their spirits up while rowing into Manannán's storm.
//
// Usage:
//   import { StormSinger } from './stormSinger.js'
//   import * as abcjs from 'abcjs'
//   import { allTunes } from './allTunes.js'
//
//   const singer = new StormSinger(stormAudio.ac)
//   singer.start(tuneKey, allTunes, abcjs)   // begin singing
//   singer.setIntensity(0.0 - 1.0)           // storm strain on voice
//   singer.stop()                             // fade out
//   singer.destroy()                          // full teardown
//
// Architecture:
//   - Each ABC note becomes one syllable event — a percussive "d" onset
//     followed by a short vowel sustain.
//   - Syllables are chosen by a small rotating vocabulary weighted by
//     note duration and position in the phrase.
//   - The "d" consonant is a ~15ms burst of filtered low noise — the
//     characteristic tap of Irish lilting.
//   - Pitch follows the ABC note sequence exactly.
//   - Storm intensity gradually adds pitch wobble and rhythmic stumbles
//     — the champion fighting the weather but still singing.

import * as abcjs from 'abcjs'
import { allTunes } from './allTunes.js'

// ── ABC note name → semitone offset from middle C (C4 = 0) ─────────────────
// ABC uses C,D,E,F,G,A,B for octave 3, c,d,e,f,g,a,b for octave 4
// Commas lower by octave, apostrophes raise by octave
const NOTE_SEMITONES = {
  C: -9, D: -7, E: -5, F: -4, G: -2, A: 0,  B: 2,
  c:  3, d:  5, e:  7, f:  8, g: 10, a: 12, b: 14,
}
const A4_HZ = 440
const A4_SEMITONE = 9  // A4 is 9 semitones above C4

function semitoneToHz(st) {
  // st = semitones from C4; A4 (st=9) = 440Hz
  return A4_HZ * Math.pow(2, (st - A4_SEMITONE) / 12)
}

// ── Syllable vocabulary ──────────────────────────────────────────────────────
// Weighted by note length and phrase position.
// Short notes (<= 1 unit): light flaps — "dl", "di", "de"
// Medium notes (2 units):  the core — "dee", "dum", "dil"
// Long notes (>= 3 units): phrase anchors — "doo", "da", "dum"
// Phrase starts:           opener sounds — "doo", "da", "dee"
//
// Each entry: { v: vowel character 0-1 (0=dark/back, 1=bright/front) }
// v controls the formant peak — higher = brighter

const SYLLABLES = {
  short: [
    { label: 'dl',  v: 0.4 },
    { label: 'di',  v: 0.9 },
    { label: 'de',  v: 0.7 },
    { label: 'dil', v: 0.8 },
    { label: 'dle', v: 0.5 },
  ],
  medium: [
    { label: 'dee', v: 1.0 },
    { label: 'dum', v: 0.1 },
    { label: 'dil', v: 0.8 },
    { label: 'del', v: 0.6 },
    { label: 'dim', v: 0.7 },
    { label: 'did', v: 0.8 },
  ],
  long: [
    { label: 'doo', v: 0.0 },
    { label: 'da',  v: 0.3 },
    { label: 'dum', v: 0.1 },
    { label: 'daa', v: 0.3 },
    { label: 'dool',v: 0.0 },
  ],
  phraseStart: [
    { label: 'doo', v: 0.0 },
    { label: 'da',  v: 0.3 },
    { label: 'dee', v: 1.0 },
  ],
}

// ── Formant frequencies for vowel brightness ─────────────────────────────────
// v=0 (dark/back: "oo", "aw"): F1≈300, F2≈700
// v=1 (bright/front: "ee", "i"): F1≈300, F2≈2200
// Linear interpolation between these poles
function formantFreqs(v) {
  const f1 = 300                            // chest resonance — relatively fixed
  const f2 = 700 + v * 1500                 // presence — sweeps with vowel brightness
  return { f1, f2 }
}

// ── ABC parser ────────────────────────────────────────────────────────────────
// Extracts [ { hz, duration } ] from an ABC string using abcjs.parseOnly.
// duration is in beats (1 = one unit note as defined by L: header).
// We normalise so that 1 beat = the ABC default unit length.

function parseTuneNotes(abcString, abcjsLib) {
  const notes = []
  try {
    const parsed = abcjsLib.parseOnly(abcString)
    if (!parsed || !parsed[0]) return notes

    const tune = parsed[0]

    // Walk the tune structure: lines → staff → voices → notes
    for (const line of (tune.lines || [])) {
      for (const staff of (line.staff || [])) {
        for (const voice of (staff.voices || [])) {
          for (const item of voice) {
            if (item.el_type !== 'note') continue
            if (item.rest) continue
            if (!item.pitches || item.pitches.length === 0) continue

            // Use the first pitch (top note of chord)
            const pitch = item.pitches[0]
            const noteName = pitch.name  // e.g. "D", "g", "B,"

            // Parse octave modifiers from the note name
            let baseName = noteName.replace(/[,']/g, '')
            if (!baseName) continue

            // abcjs gives pitch.pitch as a MIDI-ish number
            // More reliable: use pitch.pitch directly
            // pitch.pitch: 0=C, 1=D, 2=E, 3=F, 4=G, 5=A, 6=B per octave
            // pitch.octave: 4 = middle octave in abcjs convention
            const PITCH_TO_ST = [0, 2, 4, 5, 7, 9, 11]  // C D E F G A B
            const pitchIdx = pitch.pitch
            if (pitchIdx === undefined || pitchIdx === null) continue

            // abcjs pitch.pitch is chromatic from C4
            // Actually abcjs stores it differently — let's use the garland approach
            // pitch.pitch is 0-6 (diatonic), pitch.accidental adjusts
            const baseSt = PITCH_TO_ST[((pitchIdx % 7) + 7) % 7]
            const octave  = Math.floor(pitchIdx / 7)
            let st = baseSt + octave * 12

            // Apply accidentals
            if (pitch.accidental === 'sharp')        st += 1
            else if (pitch.accidental === 'flat')    st -= 1
            else if (pitch.accidental === 'dsharp')  st += 2
            else if (pitch.accidental === 'dflat')   st -= 2

            const hz = semitoneToHz(st)
            if (hz < 80 || hz > 2000) continue  // sanity check

            // Duration: item.duration is in beats
            const dur = item.duration || 0.5
            notes.push({ hz, duration: dur })
          }
        }
      }
    }
  } catch(e) {
    console.warn('[StormSinger] ABC parse error:', e)
  }
  return notes
}

// ── Syllable selector ─────────────────────────────────────────────────────────
// Deterministic-ish rotation with some randomness for naturalness.
// Tracks position within the phrase (resets after rests/bar lines).

class SyllableStream {
  constructor() {
    this._idx    = { short: 0, medium: 0, long: 0, phraseStart: 0 }
    this._noteCount = 0
    this._phrasePos = 0
  }

  next(duration) {
    const isPhrase = this._phrasePos === 0
    this._phrasePos++
    if (this._phrasePos > 6 + Math.floor(Math.random() * 4)) {
      this._phrasePos = 0  // reset phrase — irregular lengths feel natural
    }

    if (isPhrase) {
      const pool = SYLLABLES.phraseStart
      const s = pool[this._idx.phraseStart % pool.length]
      this._idx.phraseStart++
      return s
    }

    let pool, key
    if (duration <= 0.375) {
      pool = SYLLABLES.short; key = 'short'
    } else if (duration <= 0.75) {
      pool = SYLLABLES.medium; key = 'medium'
    } else {
      pool = SYLLABLES.long; key = 'long'
    }

    // Small random skip — avoids mechanical repetition
    if (Math.random() < 0.15) this._idx[key]++

    const s = pool[this._idx[key] % pool.length]
    this._idx[key]++
    return s
  }

  reset() {
    this._phrasePos = 0
    this._noteCount = 0
  }
}

// ── Main class ────────────────────────────────────────────────────────────────

export class StormSinger {

  constructor(audioContext) {
    this.ac        = audioContext
    this.intensity = 0         // 0-1, set by d3OpenSea as storm builds
    this._running  = false
    this._gain     = null      // master output gain
    this._nodes    = []        // all created nodes, for teardown
    this._loopId   = null
    this._notes    = []        // parsed note sequence
    this._syllables = new SyllableStream()
    this._cursor   = 0         // position in note array
    this._nextNoteTime = 0     // absolute AC time of next note
    this._scheduleAhead = 0.12 // seconds to schedule ahead
    this._tempo    = 1.0       // seconds per beat (set from tune type)
    this._volume   = 0.0       // current volume, ramped in/out
    this._targetVolume = 0.28  // full singing volume
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  start(tuneKey, tunesMap, abcjsLib) {
    if (this._running) this.stop()
    if (!this.ac) return

    const abcString = tunesMap[tuneKey]
    if (!abcString) {
      console.warn('[StormSinger] tune not found:', tuneKey)
      return
    }

    // Determine tempo from tune type
    const rhythmMatch = abcString.match(/^R:\s*(.+)$/m)
    const rhythmType  = rhythmMatch ? rhythmMatch[1].trim().toLowerCase() : 'reel'
    this._tempo = this._tempoFromType(rhythmType)

    // Parse notes
    this._notes = parseTuneNotes(abcString, abcjsLib)
    if (this._notes.length === 0) {
      console.warn('[StormSinger] no notes parsed for', tuneKey)
      return
    }
    console.log(`[StormSinger] ${this._notes.length} notes for ${tuneKey} (${rhythmType})`)

    // Build audio graph
    this._buildGraph()

    // Fade in
    this._running = true
    this._cursor  = 0
    this._syllables.reset()
    this._nextNoteTime = this.ac.currentTime + 0.3

    // Ramp volume in over 2 seconds
    this._gain.gain.setValueAtTime(0, this.ac.currentTime)
    this._gain.gain.linearRampToValueAtTime(
      this._targetVolume, this.ac.currentTime + 2.0)

    this._scheduleTick()
    console.log('[StormSinger] started')
  }

  setIntensity(v) {
    this.intensity = Math.max(0, Math.min(1, v))
  }

  stop() {
    this._running = false
    if (this._loopId) { clearTimeout(this._loopId); this._loopId = null }
    if (this._gain && this.ac) {
      const now = this.ac.currentTime
      this._gain.gain.cancelScheduledValues(now)
      this._gain.gain.setValueAtTime(this._gain.gain.value, now)
      this._gain.gain.linearRampToValueAtTime(0, now + 1.5)
    }
    // Teardown after fade
    setTimeout(() => this._teardown(), 2000)
  }

  destroy() {
    this._running = false
    if (this._loopId) { clearTimeout(this._loopId); this._loopId = null }
    this._teardown()
  }

  // ── Graph construction ──────────────────────────────────────────────────────

  _buildGraph() {
    // Master gain — all syllable nodes route here → ac.destination
    this._gain = this.ac.createGain()
    this._gain.gain.value = 0
    this._gain.connect(this.ac.destination)
    this._nodes.push(this._gain)
  }

  _teardown() {
    for (const n of this._nodes) {
      try { n.disconnect() } catch(e) {}
      try { if (n.stop) n.stop() } catch(e) {}
    }
    this._nodes = []
    this._gain  = null
  }

  // ── Scheduler ───────────────────────────────────────────────────────────────
  // Runs on a setTimeout loop, scheduling notes slightly ahead of playback.
  // This is the standard Web Audio lookahead pattern — avoids glitches
  // without consuming CPU on every audio frame.

  _scheduleTick() {
    if (!this._running) return

    const now      = this.ac.currentTime
    const horizon  = now + this._scheduleAhead

    while (this._nextNoteTime < horizon) {
      const note = this._notes[this._cursor]
      if (!note) {
        // Loop: restart tune
        this._cursor = 0
        this._syllables.reset()
        continue
      }

      const durSec = note.duration * this._tempo
      this._scheduleSyllable(note.hz, this._nextNoteTime, durSec)

      this._nextNoteTime += durSec
      this._cursor++
    }

    // Run again in ~50ms
    this._loopId = setTimeout(() => this._scheduleTick(), 50)
  }

  // ── Single syllable synthesis ────────────────────────────────────────────────
  //
  // Each syllable has two parts:
  //   1. "D" onset — 12-18ms burst of bandpass noise (the consonant tap)
  //   2. Vowel sustain — oscillator bank with two formant filters
  //
  // The onset and sustain share the same gain envelope:
  //   - Attack: 8ms (hard, percussive — port a beul is crisp, not breathy)
  //   - Sustain: most of the note duration
  //   - Release: 25ms (clean cut, instrument-like)
  //
  // Storm intensity adds:
  //   - Pitch wobble (random ±semitones scaled by intensity)
  //   - Occasional note drops (intensity > 0.6: ~15% chance skip)
  //   - Slight tempo drag (handled in _tempo, not here)

  _scheduleSyllable(baseHz, when, durSec) {
    if (!this.ac || !this._gain) return
    if (durSec < 0.04) return  // too short to bother

    // Storm: occasionally drop a note (champion gasping/struggling)
    if (this.intensity > 0.55 && Math.random() < this.intensity * 0.20) return

    // Storm: pitch wobble — increases with intensity
    const wobbleSt = (Math.random() - 0.5) * this.intensity * 1.8
    const hz = baseHz * Math.pow(2, wobbleSt / 12)

    // Choose syllable
    const syl = this._syllables.next(durSec / this._tempo)
    const { f1, f2 } = formantFreqs(syl.v)

    const ac      = this.ac
    const attack  = 0.008
    const release = 0.025
    const sustain = Math.max(0.03, durSec - attack - release)

    // ── "D" consonant onset — filtered noise burst ────────────────────────
    // Very short (12ms), bandpass centred around 150Hz + upper partial.
    // This is what makes it sound like a consonant rather than a pure tone.
    {
      const onsetDur = 0.012
      const buf      = this._makeNoiseBuf(onsetDur + 0.005)
      const src      = ac.createBufferSource()
      src.buffer     = buf

      const bp   = ac.createBiquadFilter()
      bp.type    = 'bandpass'
      bp.frequency.value = 160
      bp.Q.value = 3.5

      // Second bandpass for upper partial of the "d" — adds click character
      const bp2  = ac.createBiquadFilter()
      bp2.type   = 'bandpass'
      bp2.frequency.value = 800
      bp2.Q.value = 4.0

      const g = ac.createGain()
      g.gain.setValueAtTime(0.0, when)
      g.gain.linearRampToValueAtTime(0.55, when + 0.003)
      g.gain.exponentialRampToValueAtTime(0.001, when + onsetDur)

      src.connect(bp);  bp.connect(g)
      src.connect(bp2); bp2.connect(g)
      g.connect(this._gain)

      src.start(when)
      src.stop(when + onsetDur + 0.005)
      this._nodes.push(src, bp, bp2, g)
    }

    // ── Vowel sustain — oscillator bank ──────────────────────────────────
    // Three oscillators: triangle (warm body) + detuned triangle (chorus)
    // + low sawtooth (harmonic richness, the glottal pulse quality)
    // Routed through two bandpass filters in parallel (the two formants)
    // then through a lowpass to smooth the result.

    const vowelStart = when + attack

    // Oscillators
    const osc1 = ac.createOscillator()
    osc1.type  = 'triangle'
    osc1.frequency.value = hz

    const osc2 = ac.createOscillator()
    osc2.type  = 'triangle'
    osc2.frequency.value = hz
    osc2.detune.value    = 9  // chorus — slightly sharp

    const osc3 = ac.createOscillator()
    osc3.type  = 'sawtooth'
    osc3.frequency.value = hz

    // Storm pitch instability — LFO wobble on the note
    // At low intensity: steady. At high intensity: wavering.
    if (this.intensity > 0.2) {
      const lfo = ac.createOscillator()
      lfo.type  = 'sine'
      // Irregular wobble rate — not a clean vibrato, more of a strain
      lfo.frequency.value = 3.5 + this.intensity * 4.0 + Math.random() * 2.0

      const lfoG = ac.createGain()
      // Wobble depth: small at low intensity, quite pronounced at high
      lfoG.gain.value = hz * (0.004 + this.intensity * 0.025)

      lfo.connect(lfoG)
      lfoG.connect(osc1.frequency)
      lfoG.connect(osc2.frequency)
      lfoG.connect(osc3.frequency)

      lfo.start(vowelStart)
      lfo.stop(vowelStart + sustain + release + 0.01)
      this._nodes.push(lfo, lfoG)
    }

    // Mix gains for oscillators
    const gOsc1 = ac.createGain(); gOsc1.gain.value = 0.50
    const gOsc2 = ac.createGain(); gOsc2.gain.value = 0.35
    const gOsc3 = ac.createGain(); gOsc3.gain.value = 0.15

    osc1.connect(gOsc1)
    osc2.connect(gOsc2)
    osc3.connect(gOsc3)

    // Formant 1 — chest/body (relatively fixed)
    const filt1 = ac.createBiquadFilter()
    filt1.type  = 'bandpass'
    filt1.frequency.value = f1
    filt1.Q.value = 2.8

    // Formant 2 — presence/brightness (vowel identity)
    const filt2 = ac.createBiquadFilter()
    filt2.type  = 'bandpass'
    filt2.frequency.value = f2
    filt2.Q.value = 2.2

    // Subtle formant sweep: opens at onset, settles to steady state
    // This is the vowel "blooming" — the mouth opening after the consonant
    const f2Start = f2 * 0.55
    filt2.frequency.setValueAtTime(f2Start, vowelStart)
    filt2.frequency.linearRampToValueAtTime(f2, vowelStart + 0.045)

    // Lowpass to smooth the combined formant signal
    const lp = ac.createBiquadFilter()
    lp.type  = 'lowpass'
    lp.frequency.value = 3800
    lp.Q.value = 0.6

    // Formant output gains
    const gF1 = ac.createGain(); gF1.gain.value = 0.55
    const gF2 = ac.createGain(); gF2.gain.value = 1.00

    // Route: oscs → both filters → lowpass → envelope
    gOsc1.connect(filt1); gOsc2.connect(filt1); gOsc3.connect(filt1)
    gOsc1.connect(filt2); gOsc2.connect(filt2); gOsc3.connect(filt2)
    filt1.connect(gF1);   filt1.connect(lp)
    filt2.connect(gF2);   filt2.connect(lp)

    // Volume envelope for the vowel sustain
    const env = ac.createGain()
    env.gain.setValueAtTime(0.0, vowelStart)
    env.gain.linearRampToValueAtTime(1.0, vowelStart + attack)
    env.gain.setValueAtTime(1.0, vowelStart + sustain)
    env.gain.linearRampToValueAtTime(0.0, vowelStart + sustain + release)

    gF1.connect(env)
    gF2.connect(env)
    lp.connect(env)
    env.connect(this._gain)

    osc1.start(vowelStart); osc1.stop(vowelStart + sustain + release + 0.01)
    osc2.start(vowelStart); osc2.stop(vowelStart + sustain + release + 0.01)
    osc3.start(vowelStart); osc3.stop(vowelStart + sustain + release + 0.01)

    this._nodes.push(
      osc1, osc2, osc3,
      gOsc1, gOsc2, gOsc3,
      filt1, filt2, gF1, gF2, lp, env
    )
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  _makeNoiseBuf(duration) {
    const samples = Math.ceil(this.ac.sampleRate * Math.min(duration, 2.0))
    const buf     = this.ac.createBuffer(1, samples, this.ac.sampleRate)
    const data    = buf.getChannelData(0)
    for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  // Seconds per beat for each tune type.
  // These match TradSessionPlayer's TEMPO_SETTINGS (ms per measure),
  // converted to seconds per beat.
  // Reel: 4 beats/measure, 1300ms/measure → 0.325s/beat
  // Jig:  6 beats/measure, 1550ms/measure → 0.258s/beat  etc.
  _tempoFromType(type) {
    const tempoMap = {
      reel:      0.325,
      jig:       0.172,   // jig beat = dotted quarter = 3 eighth notes
      slipjig:   0.183,
      hornpipe:  0.375,
      polka:     0.275,
      waltz:     0.333,
      march:     0.350,
      slide:     0.167,
      barndance: 0.300,
    }
    return tempoMap[type] ?? 0.325
  }
}


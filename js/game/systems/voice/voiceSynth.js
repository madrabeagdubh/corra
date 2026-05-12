// voiceSynth.js — Okami-style syllabic voice synthesiser for Corra
// Place at: js/game/systems/voice/voiceSynth.js

// ─────────────────────────────────────────────────────────────────────────────
// IRISH SYLLABLE SPLITTER
// ─────────────────────────────────────────────────────────────────────────────

const IRISH_DIPHTHONGS = [
  'aoi','iai','uai',
  'ao','ia','ua','ui','ai','ei','oi','ío','ói','úi','ái','éi','ae',
]
const LENITED_PAIRS = ['bh','mh','fh','gh','ch','ph','sh','th','dh','nh']
const VOWEL_SET     = new Set([...'aeiouáéíóúàèìòùâêîôûäëïöü'])

export function irishSyllables(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-záéíóúàèìòùâêîôûäëïöü\s'-]/g, '')
    .split(/\s+/)
    .filter(Boolean)

  const syllables = []
  for (const word of words) {
    syllables.push(...splitWordToSyllables(word))
    syllables.push(null)   // inter-word pause marker
  }
  if (syllables[syllables.length - 1] === null) syllables.pop()
  return syllables
}

function splitWordToSyllables(word) {
  if (!word) return []
  const result = []
  let i = 0, current = ''

  while (i < word.length) {
    const pair = word.slice(i, i + 2)
    if (LENITED_PAIRS.includes(pair)) { current += pair; i += 2; continue }

    let matchedDiphthong = false
    for (const diphthong of IRISH_DIPHTHONGS) {
      if (word.slice(i, i + diphthong.length) === diphthong) {
        current += diphthong
        i += diphthong.length
        // Collect following consonants up to the next vowel
        while (i < word.length && !VOWEL_SET.has(word[i])) {
          const nextPair = word.slice(i, i + 2)
          if (LENITED_PAIRS.includes(nextPair)) { current += nextPair; i += 2 }
          else { current += word[i]; i++ }
          if (i < word.length && VOWEL_SET.has(word[i])) break
        }
        if (current) { result.push(current); current = '' }
        matchedDiphthong = true
        break
      }
    }
    if (matchedDiphthong) continue

    if (VOWEL_SET.has(word[i])) {
      current += word[i]; i++
      while (i < word.length && !VOWEL_SET.has(word[i])) {
        const nextPair = word.slice(i, i + 2)
        if (LENITED_PAIRS.includes(nextPair)) { current += nextPair; i += 2 }
        else { current += word[i]; i++ }
        if (i < word.length && VOWEL_SET.has(word[i])) break
      }
      if (current) { result.push(current); current = '' }
    } else {
      current += word[i]; i++
    }
  }

  if (current) {
    if (result.length) result[result.length - 1] += current
    else result.push(current)
  }
  return result.length ? result : [word]
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTE → HZ  (ABC notation, D major key signature)
// Uppercase letter = octave 4, lowercase = octave 5.
// D major applies sharps to F and C automatically.
// ─────────────────────────────────────────────────────────────────────────────

const NOTE_SEMITONES = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 }

function abcLetterToHz(letter) {
  const upper   = letter.toUpperCase()
  const semitone = NOTE_SEMITONES[upper] ?? 0
  const octave  = letter === upper ? 4 : 5
  // D major key signature: raise F and C by a semitone
  const keySharp = (upper === 'F' || upper === 'C') ? 1 : 0
  // A4 = 440Hz, so offset from A4 in semitones:
  const semiFromA4 = (octave - 4) * 12 + semitone - 9 + keySharp
  return 440 * Math.pow(2, semiFromA4 / 12)
}

// ─────────────────────────────────────────────────────────────────────────────
// DING DONG DEDERÓ — melodic pitch pool
//
// ABC source:
//   X:1  T:Ding Dong Dederó  R:hornpipe  M:4/4  K:Dmaj
//   d2 A2 BG G2 | A2 A2 c2 d2 | d2 A2 BG AF | G2 F2 G2 A2  (repeated)
//
// One Hz value per melodic note. Syllables draw from this pool in order,
// cycling back to the start when exhausted.
// ─────────────────────────────────────────────────────────────────────────────

const phrase1 = ['d','d','A','A','B','G','G','G'].map(abcLetterToHz)  // d2 A2 BG G2
const phrase2 = ['A','A','A','A','c','c','d','d'].map(abcLetterToHz)  // A2 A2 c2 d2
const phrase3 = ['d','d','A','A','B','G','A','F'].map(abcLetterToHz)  // d2 A2 BG AF
const phrase4 = ['G','G','F','F','G','G','A','A'].map(abcLetterToHz)  // G2 F2 G2 A2

export const DING_DONG_PITCHES = [
  ...phrase1, ...phrase2, ...phrase3, ...phrase4,
  ...phrase1, ...phrase2, ...phrase3, ...phrase4,
]

// ─────────────────────────────────────────────────────────────────────────────
// SPEECH CONTOUR GENERATOR
// Returns an array of Hz values, one per syllable (null slots get 0).
// ─────────────────────────────────────────────────────────────────────────────

export function speechContour(syllables, fundamental, opts = {}) {
  const { style = 'statement', variance = 0.18 } = opts
  const nonNullCount = syllables.filter(s => s !== null).length
  let index = 0

  return syllables.map(syllable => {
    if (syllable === null) return 0
    const t = index++ / Math.max(1, nonNullCount - 1)
    let semitoneOffset = 0

    if      (style === 'statement')   semitoneOffset = 2 - t * 5
    else if (style === 'question')    semitoneOffset = -3 + Math.pow(t * 2 - 1, 2) * 5
    else if (style === 'exclamation') semitoneOffset = 4 - t * 3
    else if (style === 'whisper')     semitoneOffset = (Math.random() - 0.5) * 2

    semitoneOffset += (Math.random() - 0.5) * variance * 12
    return fundamental * Math.pow(2, semitoneOffset / 12)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// VOICE PRESETS
// ─────────────────────────────────────────────────────────────────────────────

export const VOICES = {

  // Otherworldly, high, slightly breathy — for supernatural female characters
  banshee: {
    name: 'Banshee',
    fundamental: 420,
    formants: [
      { freq: 800,  Q: 6,  gain: 14 },
      { freq: 2200, Q: 8,  gain: 10 },
      { freq: 3800, Q: 12, gain: 6  },
    ],
    oscillators: [
      { type: 'sine',     gain: 0.55 },
      { type: 'triangle', gain: 0.20 },
      { type: 'sine',     gain: 0.10, detune: 7 },
    ],
    breathiness: 0.22,
    vibrato:     { rate: 4.8, depth: 0.025, delay: 0.06 },
    attack: 0.035, decay: 0.22, sustain: 0.55,
    sylDuration: 0.16, sylGap: 0.04, pauseDuration: 0.12,
    volume: 0.38,
  },

  // Resonant chest voice, slightly rough — for the blacksmith
  blacksmith: {
    name: 'Blacksmith',
    fundamental: 140,
    formants: [
      { freq: 500,  Q: 5,  gain: 16 },
      { freq: 1500, Q: 7,  gain: 12 },
      { freq: 2500, Q: 10, gain: 8  },
    ],
    oscillators: [
      { type: 'sawtooth', gain: 0.40 },
      { type: 'square',   gain: 0.10 },
      { type: 'sine',     gain: 0.35 },
      { type: 'sawtooth', gain: 0.08, detune: -5 },
    ],
    breathiness: 0.08,
    vibrato:     { rate: 5.5, depth: 0.018, delay: 0.08 },
    attack: 0.025, decay: 0.30, sustain: 0.62,
    // At 120 BPM a quaver = 0.25s — one syllable per quaver
    sylDuration: 0.25, sylGap: 0.01, pauseDuration: 0.25,
    volume: 0.44,
  },

  // Clear, lyrical — for young hero types
  youngHero: {
    name: 'Young Hero',
    fundamental: 260,
    formants: [
      { freq: 700,  Q: 5,  gain: 12 },
      { freq: 2000, Q: 8,  gain: 9  },
      { freq: 3200, Q: 11, gain: 5  },
    ],
    oscillators: [
      { type: 'sine',     gain: 0.60 },
      { type: 'triangle', gain: 0.25 },
      { type: 'sine',     gain: 0.08, detune: 4 },
    ],
    breathiness: 0.06,
    vibrato:     { rate: 5.0, depth: 0.022, delay: 0.07 },
    attack: 0.018, decay: 0.20, sustain: 0.58,
    sylDuration: 0.13, sylGap: 0.025, pauseDuration: 0.09,
    volume: 0.40,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// VOICE FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export function createVoice(config) {
  let audioContext = null
  let masterGain   = null
  let cancelFns    = []   // cleanup callbacks for active timeouts

  function ensureAudioContext() {
    if (audioContext) return true
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) return false
      audioContext = new AudioContextClass()
      masterGain   = audioContext.createGain()
      masterGain.gain.value = config.volume ?? 0.4
      masterGain.connect(audioContext.destination)
      return true
    } catch(e) { return false }
  }

  function makeNoiseBuffer(duration) {
    const buffer = audioContext.createBuffer(
      1,
      Math.ceil(audioContext.sampleRate * duration),
      audioContext.sampleRate
    )
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const source = audioContext.createBufferSource()
    source.buffer = buffer
    return source
  }

  function scheduleSyllable(pitchHz, startTime, duration) {
    if (!audioContext || pitchHz <= 0) return

    const now     = audioContext.currentTime + startTime
    const attack  = config.attack  ?? 0.02
    const sustain = config.sustain ?? 0.55
    const breath  = config.breathiness ?? 0.10

    // Amplitude envelope for this syllable
    const envelope = audioContext.createGain()
    envelope.gain.setValueAtTime(0, now)
    envelope.gain.linearRampToValueAtTime(1.0, now + attack)
    envelope.gain.setValueAtTime(1.0, now + duration * sustain)
    envelope.gain.exponentialRampToValueAtTime(0.001, now + Math.max(duration, attack + 0.01))

    // Oscillator bank
    for (const oscDef of (config.oscillators ?? [{ type: 'sine', gain: 0.7 }])) {
      const osc = audioContext.createOscillator()
      osc.type  = oscDef.type ?? 'sine'
      osc.frequency.setValueAtTime(pitchHz, now)
      if (oscDef.detune) osc.detune.value = oscDef.detune

      // Vibrato LFO
      const vibrato = config.vibrato
      if (vibrato) {
        const lfo     = audioContext.createOscillator()
        lfo.type      = 'sine'
        lfo.frequency.value = vibrato.rate ?? 5
        const lfoGain = audioContext.createGain()
        lfoGain.gain.setValueAtTime(0, now)
        lfoGain.gain.linearRampToValueAtTime(
          pitchHz * (vibrato.depth ?? 0.02),
          now + (vibrato.delay ?? 0.07) + attack
        )
        lfo.connect(lfoGain)
        lfoGain.connect(osc.frequency)
        lfo.start(now)
        lfo.stop(now + duration + 0.05)
      }

      const oscLevel = audioContext.createGain()
      oscLevel.gain.value = oscDef.gain ?? 0.5
      osc.connect(oscLevel)
      oscLevel.connect(envelope)
      osc.start(now)
      osc.stop(now + duration + 0.05)
    }

    // Formant filter chain (series peaking EQs)
    let node = envelope
    for (const formant of (config.formants ?? [])) {
      const filter = audioContext.createBiquadFilter()
      filter.type  = 'peaking'
      filter.frequency.value = formant.freq
      filter.Q.value         = formant.Q    ?? 6
      filter.gain.value      = formant.gain ?? 12
      node.connect(filter)
      node = filter
    }
    node.connect(masterGain)

    // Breathiness — bandpass-filtered noise mixed under the tone
    if (breath > 0.01) {
      const noise     = makeNoiseBuffer(duration)
      const bandpass  = audioContext.createBiquadFilter()
      bandpass.type   = 'bandpass'
      bandpass.frequency.value = pitchHz * 1.8
      bandpass.Q.value = 1.2
      const breathGain = audioContext.createGain()
      breathGain.gain.setValueAtTime(0, now)
      breathGain.gain.linearRampToValueAtTime(breath * 0.28, now + attack)
      breathGain.gain.exponentialRampToValueAtTime(0.001, now + Math.max(duration, attack + 0.01))
      noise.connect(bandpass)
      bandpass.connect(breathGain)
      breathGain.connect(masterGain)
      noise.start(now)
      noise.stop(now + duration)
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function stop() {
    for (const cancel of cancelFns) { try { cancel() } catch(e) {} }
    cancelFns = []
  }

  // speak(text, opts)
  //
  //   opts.mode     'speech' | 'song'
  //   opts.style    'statement' | 'question' | 'exclamation' | 'whisper'
  //   opts.pitches  Hz[] — cycling pitch pool for song mode
  //   opts.tempo    BPM  — overrides config.sylDuration in song mode
  //   opts.onSyl    fn(syllableText, index, timeMs) — fires as each syllable plays
  //   opts.onDone   fn() — fires when the utterance completes

  function speak(text, opts = {}) {
    stop()
    if (!ensureAudioContext()) return

    const syllables    = irishSyllables(text)
    const mode         = opts.mode ?? 'speech'
    const sylDuration  = (mode === 'song' && opts.tempo)
      ? (60 / opts.tempo) * 0.5
      : (config.sylDuration ?? 0.15)
    const sylGap       = config.sylGap       ?? 0.03
    const pauseDuration = config.pauseDuration ?? 0.10

    // Build pitch array — one value per syllable slot (including nulls)
    let pitches
    if (mode === 'song' && opts.pitches?.length) {
      let pitchIndex = 0
      pitches = syllables.map(syl =>
        syl === null ? 0 : opts.pitches[pitchIndex++ % opts.pitches.length]
      )
    } else {
      pitches = speechContour(syllables, config.fundamental, {
        style:    opts.style    ?? 'statement',
        variance: opts.variance ?? 0.18,
      })
    }

    let cursor   = 0.02   // small initial offset so AudioContext has time to settle
    let sylIndex = 0

    for (let i = 0; i < syllables.length; i++) {
      const syllable = syllables[i]
      if (syllable === null) { cursor += pauseDuration; continue }

      scheduleSyllable(pitches[i] ?? 0, cursor, sylDuration)

      if (opts.onSyl) {
        const capturedSyl  = syllable
        const capturedIdx  = sylIndex
        const capturedTime = cursor
        const timerId = setTimeout(
          () => opts.onSyl(capturedSyl, capturedIdx, capturedTime * 1000),
          capturedTime * 1000
        )
        cancelFns.push(() => clearTimeout(timerId))
      }

      cursor += sylDuration + sylGap
      sylIndex++
    }

    if (opts.onDone) {
      const timerId = setTimeout(opts.onDone, cursor * 1000 + 80)
      cancelFns.push(() => clearTimeout(timerId))
    }

    if (audioContext.state === 'suspended') audioContext.resume()
  }

  function destroy() {
    stop()
    try { if (audioContext) audioContext.close() } catch(e) {}
    audioContext = null
    masterGain   = null
  }

  return { speak, stop, destroy, config }
}


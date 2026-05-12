// voiceSynth.js — Okami-style syllabic voice synthesiser for Corra
// v4 — proper formant synthesis, harmonic additive source, genuine voice quality
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
    syllables.push(null)
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
    let hit = false
    for (const diphthong of IRISH_DIPHTHONGS) {
      if (word.slice(i, i + diphthong.length) === diphthong) {
        current += diphthong; i += diphthong.length
        while (i < word.length && !VOWEL_SET.has(word[i])) {
          const np = word.slice(i, i + 2)
          if (LENITED_PAIRS.includes(np)) { current += np; i += 2 }
          else { current += word[i]; i++ }
          if (i < word.length && VOWEL_SET.has(word[i])) break
        }
        if (current) { result.push(current); current = '' }
        hit = true; break
      }
    }
    if (hit) continue
    if (VOWEL_SET.has(word[i])) {
      current += word[i]; i++
      while (i < word.length && !VOWEL_SET.has(word[i])) {
        const np = word.slice(i, i + 2)
        if (LENITED_PAIRS.includes(np)) { current += np; i += 2 }
        else { current += word[i]; i++ }
        if (i < word.length && VOWEL_SET.has(word[i])) break
      }
      if (current) { result.push(current); current = '' }
    } else { current += word[i]; i++ }
  }
  if (current) {
    if (result.length) result[result.length - 1] += current
    else result.push(current)
  }
  return result.length ? result : [word]
}

// ─────────────────────────────────────────────────────────────────────────────
// VOWEL FORMANTS
// F1, F2, F3 — resonant peaks that define vowel identity.
// These are the frequencies a human vocal tract resonates at for each vowel.
// Values scaled for a low male voice (multiply by 0.85 vs. female reference).
// ─────────────────────────────────────────────────────────────────────────────

const VOWEL_FORMANTS = {
  'a':  [ 650,  1100, 2550 ],
  'á':  [ 620,  1050, 2500 ],
  'e':  [ 470,  1700, 2530 ],
  'é':  [ 430,  1900, 2650 ],
  'i':  [ 320,  2100, 2900 ],
  'í':  [ 300,  2200, 3000 ],
  'o':  [ 500,   800, 2450 ],
  'ó':  [ 460,   760, 2400 ],
  'u':  [ 380,   700, 2300 ],
  'ú':  [ 350,   650, 2200 ],
  'ao': [ 500,   800, 2450 ],
  'ai': [ 650,  1100, 2550 ],
  'ei': [ 470,  1700, 2530 ],
  'ui': [ 320,  2100, 2900 ],
  'ia': [ 320,  2100, 2900 ],
  'ua': [ 380,   700, 2300 ],
}
const DEFAULT_VOWEL = [ 550, 1100, 2500 ]

function getVowelFormants(syllable) {
  if (!syllable) return DEFAULT_VOWEL
  const s = syllable.toLowerCase()
  for (const key of Object.keys(VOWEL_FORMANTS)) {
    if (key.length > 1 && s.includes(key)) return VOWEL_FORMANTS[key]
  }
  for (const ch of s) {
    if (VOWEL_FORMANTS[ch]) return VOWEL_FORMANTS[ch]
  }
  return DEFAULT_VOWEL
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTE → HZ  (ABC notation, D major, octave 2-3 for low male voice)
// Uppercase = octave 2, lowercase = octave 3.
// This puts the blacksmith's melody in the 73-196Hz range — proper bass-baritone.
// ─────────────────────────────────────────────────────────────────────────────

const NOTE_SEMITONES = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 }

function abcLetterToHz(letter) {
  const upper    = letter.toUpperCase()
  const semitone = NOTE_SEMITONES[upper] ?? 0
  const octave   = letter === upper ? 2 : 3
  const keySharp = (upper === 'F' || upper === 'C') ? 1 : 0
  const semiFromA4 = (octave - 4) * 12 + semitone - 9 + keySharp
  return 440 * Math.pow(2, semiFromA4 / 12)
}

// ─────────────────────────────────────────────────────────────────────────────
// DING DONG DEDERÓ — pitch pool, bass-baritone range
// ─────────────────────────────────────────────────────────────────────────────

const phrase1 = ['d','d','A','A','B','G','G','G'].map(abcLetterToHz)
const phrase2 = ['A','A','A','A','c','c','d','d'].map(abcLetterToHz)
const phrase3 = ['d','d','A','A','B','G','A','F'].map(abcLetterToHz)
const phrase4 = ['G','G','F','F','G','G','A','A'].map(abcLetterToHz)

export const DING_DONG_PITCHES = [
  ...phrase1, ...phrase2, ...phrase3, ...phrase4,
  ...phrase1, ...phrase2, ...phrase3, ...phrase4,
]

// ─────────────────────────────────────────────────────────────────────────────
// SPEECH CONTOUR
// ─────────────────────────────────────────────────────────────────────────────

export function speechContour(syllables, fundamental, opts = {}) {
  const { style = 'statement', variance = 0.10 } = opts
  const nonNullCount = syllables.filter(s => s !== null).length
  let index = 0
  return syllables.map(syl => {
    if (syl === null) return 0
    const t = index++ / Math.max(1, nonNullCount - 1)
    let st = 0
    if      (style === 'statement')   st = 1.5 - t * 4
    else if (style === 'question')    st = -2 + Math.pow(t * 2 - 1, 2) * 4
    else if (style === 'exclamation') st = 3 - t * 2.5
    else if (style === 'whisper')     st = (Math.random() - 0.5) * 1.5
    st += (Math.random() - 0.5) * variance * 12
    return fundamental * Math.pow(2, st / 12)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// VOICE PRESETS
// ─────────────────────────────────────────────────────────────────────────────

export const VOICES = {

  // Low, resonant, slightly rough — blacksmith, bass-baritone
  blacksmith: {
    name:        'Blacksmith',
    fundamental: 98,          // G2 — low baritone speaking fundamental
    // Harmonic weights: shape the timbre of the voice source.
    // Real voice has strong odd harmonics with a gradual rolloff.
    // We build from sine partials rather than sawtooth to avoid electronic buzz.
    harmonics: [
      { ratio: 1,  gain: 0.70 },   // fundamental
      { ratio: 2,  gain: 0.45 },   // octave
      { ratio: 3,  gain: 0.30 },   // fifth above octave
      { ratio: 4,  gain: 0.20 },   // two octaves
      { ratio: 5,  gain: 0.14 },   // major third above two octaves
      { ratio: 6,  gain: 0.09 },
      { ratio: 7,  gain: 0.06 },
      { ratio: 8,  gain: 0.04 },
    ],
    // Noise: just a whisper of breath — not much for a singing voice
    breathiness:   0.06,
    // Vibrato: singing voice has more vibrato than speech
    vibrato:       { rate: 5.4, depth: 0.022, delay: 0.10 },
    // Envelope
    attack:        0.04,
    sustain:       0.80,      // hold most of the syllable duration
    // Timing — singing is slower and more legato than speech
    sylDuration:   0.30,      // 300ms per syllable at ~100bpm
    sylGap:        0.002,     // almost no gap — legato singing
    pauseDuration: 0.22,      // line break
    // Formant filter quality — higher Q = more vowel-like resonance
    formantQ:      [ 9, 11, 13 ],
    formantGain:   [ 22, 18, 12 ],
    formantScale:  0.88,      // scale all formant freqs down for low male voice
    volume:        0.46,
  },

  // Otherworldly, high, breathy — supernatural female
  banshee: {
    name:        'Banshee',
    fundamental: 220,         // A3 — low female / countertenor
    harmonics: [
      { ratio: 1, gain: 0.65 },
      { ratio: 2, gain: 0.30 },
      { ratio: 3, gain: 0.18 },
      { ratio: 4, gain: 0.10 },
      { ratio: 5, gain: 0.06 },
    ],
    breathiness:   0.32,      // breathy, aspirated quality
    vibrato:       { rate: 4.6, depth: 0.030, delay: 0.06 },
    attack:        0.05,
    sustain:       0.65,
    sylDuration:   0.20,
    sylGap:        0.02,
    pauseDuration: 0.14,
    formantQ:      [ 7, 9, 11 ],
    formantGain:   [ 18, 14, 9 ],
    formantScale:  1.05,
    volume:        0.36,
  },

  // Clear, lyrical mid-range — young male
  youngHero: {
    name:        'Young Hero',
    fundamental: 165,         // E3
    harmonics: [
      { ratio: 1, gain: 0.60 },
      { ratio: 2, gain: 0.38 },
      { ratio: 3, gain: 0.22 },
      { ratio: 4, gain: 0.13 },
      { ratio: 5, gain: 0.07 },
      { ratio: 6, gain: 0.04 },
    ],
    breathiness:   0.07,
    vibrato:       { rate: 5.1, depth: 0.018, delay: 0.08 },
    attack:        0.025,
    sustain:       0.72,
    sylDuration:   0.17,
    sylGap:        0.012,
    pauseDuration: 0.11,
    formantQ:      [ 8, 10, 12 ],
    formantGain:   [ 20, 16, 10 ],
    formantScale:  0.94,
    volume:        0.40,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// VOICE FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export function createVoice(config) {
  let audioContext  = null
  let masterGain    = null
  let cancelFns     = []

  // Persistent graph nodes — retuned per syllable rather than recreated
  let harmonicOscs  = []     // { osc, gainNode, ratio }
  let vibratoLfo    = null
  let vibratoGain   = null
  let formantF1     = null
  let formantF2     = null
  let formantF3     = null
  let voiceGain     = null   // master amplitude envelope node
  let graphBuilt    = false

  function ensureAudioContext() {
    if (audioContext) return true
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return false
      audioContext = new AC()
      masterGain   = audioContext.createGain()
      masterGain.gain.value = config.volume ?? 0.4
      masterGain.connect(audioContext.destination)
      return true
    } catch(e) { return false }
  }

  function makeNoiseBuffer(duration) {
    const buf = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * duration), audioContext.sampleRate)
    const d   = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const src = audioContext.createBufferSource()
    src.buffer = buf
    return src
  }

  // Build the persistent voice graph once per voice instance.
  // After this, speaking only moves parameters — no node creation.
  function buildGraph() {
    if (graphBuilt) return

    const fScale   = config.formantScale ?? 1.0
    const fQ       = config.formantQ     ?? [ 8, 10, 12 ]
    const fGain    = config.formantGain  ?? [ 20, 16, 10 ]
    const harmonics = config.harmonics   ?? [ { ratio: 1, gain: 0.7 }, { ratio: 2, gain: 0.3 } ]

    // Amplitude gate — controls syllable on/off
    voiceGain = audioContext.createGain()
    voiceGain.gain.value = 0

    // Three resonant bandpass filters — F1, F2, F3
    // Bandpass (not peaking EQ) creates resonant formant peaks like a vocal tract
    const makeFormant = (freq, q, gainDb) => {
      const bp = audioContext.createBiquadFilter()
      bp.type  = 'bandpass'
      bp.frequency.value = freq * fScale
      bp.Q.value = q
      // Bandpass gain compensation — boost output since bandpass attenuates
      const g = audioContext.createGain()
      // Convert dB gain to linear, scaled by Q (narrower = more boost needed)
      g.gain.value = Math.pow(10, gainDb / 20) * (q / 8)
      bp.connect(g)
      return { filter: bp, gainNode: g }
    }

    const [f1Freq, f2Freq, f3Freq] = DEFAULT_VOWEL
    formantF1 = makeFormant(f1Freq, fQ[0], fGain[0])
    formantF2 = makeFormant(f2Freq, fQ[1], fGain[1])
    formantF3 = makeFormant(f3Freq, fQ[2], fGain[2])

    // Additive harmonic source — sine waves at integer multiples of F0
    // This is a warm, non-buzzy voice source
    const fund = config.fundamental ?? 130
    harmonicOscs = harmonics.map(({ ratio, gain }) => {
      const osc  = audioContext.createOscillator()
      osc.type   = 'sine'
      osc.frequency.value = fund * ratio
      const g    = audioContext.createGain()
      g.gain.value = gain
      osc.connect(g)
      // Each harmonic feeds all three formant filters in parallel
      g.connect(voiceGain)
      g.connect(formantF1.filter)
      g.connect(formantF2.filter)
      g.connect(formantF3.filter)
      osc.start()
      return { osc, gainNode: g, ratio }
    })

    // Formant outputs all merge into master
    // voiceGain also connects directly (unfiltered fundamental body)
    const directGain = audioContext.createGain()
    directGain.gain.value = 0.15   // small amount of unfiltered signal for body
    voiceGain.connect(directGain)
    directGain.connect(masterGain)

    formantF1.gainNode.connect(masterGain)
    formantF2.gainNode.connect(masterGain)
    formantF3.gainNode.connect(masterGain)

    // Vibrato LFO — runs continuously, depth is ramped per syllable
    const vib = config.vibrato
    if (vib) {
      vibratoLfo = audioContext.createOscillator()
      vibratoLfo.type = 'sine'
      vibratoLfo.frequency.value = vib.rate ?? 5.2
      vibratoGain = audioContext.createGain()
      vibratoGain.gain.value = 0
      vibratoLfo.connect(vibratoGain)
      // Connect to all harmonic oscillators' frequency
      harmonicOscs.forEach(({ osc, ratio }) => {
        // Each harmonic needs its own vibrato gain scaled by ratio
        // so all partials track pitch modulation correctly
        const vg = audioContext.createGain()
        vg.gain.value = ratio
        vibratoGain.connect(vg)
        vg.connect(osc.frequency)
      })
      vibratoLfo.start()
    }

    graphBuilt = true
  }

  function teardownGraph() {
    harmonicOscs.forEach(({ osc }) => { try { osc.stop() } catch(e) {} })
    if (vibratoLfo) { try { vibratoLfo.stop() } catch(e) {} }
    harmonicOscs = []
    vibratoLfo   = null
    vibratoGain  = null
    formantF1    = null
    formantF2    = null
    formantF3    = null
    voiceGain    = null
    graphBuilt   = false
  }

  // Schedule one syllable — only parameter changes, no node creation
  function scheduleSyllable(pitchHz, syllable, tStart, duration) {
    if (!audioContext || pitchHz <= 0 || !graphBuilt) return

    const now      = audioContext.currentTime + tStart
    const attack   = config.attack  ?? 0.03
    const sustain  = config.sustain ?? 0.78
    const fScale   = config.formantScale ?? 1.0
    const vib      = config.vibrato

    // Retune all harmonics to new pitch
    harmonicOscs.forEach(({ osc, ratio }) => {
      osc.frequency.setTargetAtTime(pitchHz * ratio, now, 0.018)
    })

    // Vibrato depth scaled to new pitch
    if (vib && vibratoGain) {
      const depth = pitchHz * (vib.depth ?? 0.020)
      vibratoGain.gain.cancelScheduledValues(now)
      vibratoGain.gain.setTargetAtTime(0, now, 0.01)
      // Vibrato kicks in after attack settles — natural singing technique
      vibratoGain.gain.setTargetAtTime(depth, now + (vib.delay ?? 0.10) + attack, 0.05)
    }

    // Amplitude envelope
    voiceGain.gain.cancelScheduledValues(now)
    voiceGain.gain.setTargetAtTime(1.0, now, attack * 0.35)
    // Hold through sustain portion, then decay
    const decayStart = now + duration * sustain
    const decayTime  = duration * (1 - sustain) * 0.6
    voiceGain.gain.setTargetAtTime(0.001, decayStart, Math.max(decayTime, 0.01))

    // Update formant frequencies for this syllable's vowel
    // Use setTargetAtTime with a ~25ms time constant so formants glide
    // smoothly from the previous syllable — this is what creates vowel transitions
    const [f1, f2, f3] = getVowelFormants(syllable)
    const glide = 0.025
    formantF1.filter.frequency.setTargetAtTime(f1 * fScale, now, glide)
    formantF2.filter.frequency.setTargetAtTime(f2 * fScale, now, glide)
    formantF3.filter.frequency.setTargetAtTime(f3 * fScale, now, glide)

    // Breath noise on attack — tuned to F1 of the vowel
    const breath = config.breathiness ?? 0.06
    if (breath > 0.01) {
      const noiseDur = Math.min(duration * 0.4, 0.12)
      const noise    = makeNoiseBuffer(noiseDur)
      const bp       = audioContext.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = f1 * fScale
      bp.Q.value = 1.4
      const bg = audioContext.createGain()
      bg.gain.setValueAtTime(0, now)
      bg.gain.linearRampToValueAtTime(breath * 0.18, now + 0.012)
      bg.gain.exponentialRampToValueAtTime(0.001, now + noiseDur)
      noise.connect(bp); bp.connect(bg); bg.connect(masterGain)
      noise.start(now); noise.stop(now + noiseDur)
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function stop() {
    for (const cancel of cancelFns) { try { cancel() } catch(e) {} }
    cancelFns = []
    if (voiceGain && audioContext) {
      voiceGain.gain.cancelScheduledValues(audioContext.currentTime)
      voiceGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.05)
    }
    if (vibratoGain && audioContext) {
      vibratoGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.03)
    }
  }

  function speak(text, opts = {}) {
    stop()
    if (!ensureAudioContext()) return
    buildGraph()

    const syllables     = irishSyllables(text)
    const mode          = opts.mode ?? 'speech'
    const sylDuration   = (mode === 'song' && opts.tempo)
      ? (60 / opts.tempo) * 0.5
      : (config.sylDuration ?? 0.20)
    const sylGap        = config.sylGap        ?? 0.008
    const pauseDuration = config.pauseDuration ?? 0.18

    let pitches
    if (mode === 'song' && opts.pitches?.length) {
      let pi = 0
      pitches = syllables.map(s => s === null ? 0 : opts.pitches[pi++ % opts.pitches.length])
    } else {
      pitches = speechContour(syllables, config.fundamental, {
        style: opts.style ?? 'statement', variance: opts.variance ?? 0.10,
      })
    }

    let cursor   = 0.02
    let sylIndex = 0

    for (let i = 0; i < syllables.length; i++) {
      const syllable = syllables[i]
      if (syllable === null) { cursor += pauseDuration; continue }
      scheduleSyllable(pitches[i] ?? 0, syllable, cursor, sylDuration)
      if (opts.onSyl) {
        const cs = syllable, ci = sylIndex, ct = cursor
        const id = setTimeout(() => opts.onSyl(cs, ci, ct * 1000), ct * 1000)
        cancelFns.push(() => clearTimeout(id))
      }
      cursor += sylDuration + sylGap
      sylIndex++
    }

    if (opts.onDone) {
      const id = setTimeout(opts.onDone, cursor * 1000 + 80)
      cancelFns.push(() => clearTimeout(id))
    }

    if (audioContext.state === 'suspended') audioContext.resume()
  }

  function destroy() {
    stop()
    teardownGraph()
    try { if (audioContext) audioContext.close() } catch(e) {}
    audioContext = null
    masterGain   = null
  }

  return { speak, stop, destroy, config }
}


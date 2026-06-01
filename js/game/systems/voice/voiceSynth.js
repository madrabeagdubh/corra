// voiceSynth.js — Irish-inflected syllabic voice synthesiser for Corra
// v5 — stress-aware timing, seannós ornament, Irish prosody contour,
//       wax-cylinder tonal character
// Place at: js/game/systems/voice/voiceSynth.js

// ── Backward-compat re-exports (v1/v2 named exports still referenced elsewhere)
// DING_DONG_PITCHES: the melodic pitch pool from the old Ding Dong Dederó tune.
// Kept so any scene that imports it doesn't break.  Generate the Hz values
// from the same ABC source as before (D major, octave 4/5).
const _NS = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 }
const _abc = (l, oct) => { const u=l.toUpperCase(); const sh=(u==='F'||u==='C')?1:0; return 440*Math.pow(2,((oct-4)*12+(_NS[u]??0)-9+sh)/12) }
const _p1 = ['d','d','A','A','B','G','G','G'].map(l=>_abc(l,l===l.toUpperCase()?4:5))
const _p2 = ['A','A','A','A','c','c','d','d'].map(l=>_abc(l,l===l.toUpperCase()?4:5))
const _p3 = ['d','d','A','A','B','G','A','F'].map(l=>_abc(l,l===l.toUpperCase()?4:5))
const _p4 = ['G','G','F','F','G','G','A','A'].map(l=>_abc(l,l===l.toUpperCase()?4:5))
export const DING_DONG_PITCHES = [..._p1,..._p2,..._p3,..._p4,..._p1,..._p2,..._p3,..._p4]

// speechContour: old name, aliased after irishProsodyContour is defined below
// (exported at the bottom of this file)

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
    const syls = splitWordToSyllables(word)
    // Mark first syllable of each word as stressed (default Irish rule)
    syls.forEach((s, i) => syllables.push({ text: s, stressed: i === 0 }))
    syllables.push(null)  // inter-word pause marker
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
        while (i < word.length && !VOWEL_SET.has(word[i])) {
          const np = word.slice(i, i + 2)
          if (LENITED_PAIRS.includes(np)) { current += np; i += 2 }
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
        const np = word.slice(i, i + 2)
        if (LENITED_PAIRS.includes(np)) { current += np; i += 2 }
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
// VOWEL FORMANTS
// F1/F2/F3 for Irish vowels, scaled toward a characterful oral-tradition voice.
// ─────────────────────────────────────────────────────────────────────────────

const VOWEL_FORMANTS = {
  'a':  [ 680, 1100, 2550 ],
  'á':  [ 640, 1050, 2500 ],
  'e':  [ 480, 1720, 2530 ],
  'é':  [ 440, 1900, 2650 ],
  'i':  [ 330, 2100, 2900 ],
  'í':  [ 310, 2200, 3000 ],
  'o':  [ 510,  820, 2450 ],
  'ó':  [ 470,  770, 2400 ],
  'u':  [ 390,  710, 2300 ],
  'ú':  [ 360,  660, 2200 ],
  'ao': [ 510,  820, 2450 ],
  'aoi':[ 330, 2100, 2900 ],
  'ai': [ 680, 1100, 2550 ],
  'ei': [ 480, 1720, 2530 ],
  'ui': [ 330, 2100, 2900 ],
  'ia': [ 330, 2100, 2900 ],
  'ua': [ 390,  710, 2300 ],
}
const DEFAULT_VOWEL = [ 560, 1100, 2500 ]

function getVowelFormants(syllableText) {
  if (!syllableText) return DEFAULT_VOWEL
  const s = syllableText.toLowerCase()
  // Longest match first
  for (const key of Object.keys(VOWEL_FORMANTS).sort((a,b) => b.length - a.length)) {
    if (s.includes(key)) return VOWEL_FORMANTS[key]
  }
  return DEFAULT_VOWEL
}

// ─────────────────────────────────────────────────────────────────────────────
// IRISH PROSODY CONTOUR
// Produces Hz values per syllable slot, with:
//   - phrase-level arc: starts mid, falls to final syllable
//   - stressed syllables pitched higher than unstressed (approx +2 semitones)
//   - question: final syllable rises ~3 semitones
//   - exclamation: front-loaded high energy, sharp fall
//   - wax cylinder flutter: slow random drift simulating wow/flutter
// ─────────────────────────────────────────────────────────────────────────────

export function irishProsodyContour(syllables, fundamental, opts = {}) {
  const { style = 'statement', variance = 0.06 } = opts
  const nonNull = syllables.filter(s => s !== null)
  const n = nonNull.length
  let ni = 0

  // Slow random walk for wax-cylinder pitch instability
  let flutter = 0

  return syllables.map(syl => {
    if (syl === null) return 0

    const t = ni++ / Math.max(1, n - 1)
    const isLast = ni === n
    const stressed = syl.stressed ?? false

    // Phrase-level contour (semitones from fundamental)
    let st = 0
    if (style === 'statement') {
      // Irish statement: starts ~+2st, gently falls to -3st, final syllable dips further
      st = 2 - t * 5
      if (isLast) st -= 1.5
    } else if (style === 'question') {
      // Falls through phrase, final syllable rises sharply — Irish question shape
      st = 1.5 - t * 3
      if (isLast) st += 3.5
    } else if (style === 'exclamation') {
      // Front-loaded: high start, rapid fall
      st = 3.5 * Math.pow(1 - t, 1.4) - 0.5
    } else if (style === 'whisper') {
      st = (Math.random() - 0.5) * 2
    }

    // Stress boost: +2st on stressed, -0.5st on unstressed
    st += stressed ? 2.0 : -0.5

    // Small random variance
    st += (Math.random() - 0.5) * variance * 8

    // Wax-cylinder wow/flutter: slow random walk, ±0.3 semitones
    flutter = flutter * 0.85 + (Math.random() - 0.5) * 0.15
    st += flutter

    return fundamental * Math.pow(2, st / 12)
  })
}

// Backward-compat alias
export const speechContour = irishProsodyContour

// ─────────────────────────────────────────────────────────────────────────────
// NOTE → HZ  (ABC notation, specified octave)
// ─────────────────────────────────────────────────────────────────────────────

const NOTE_SEMITONES = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 }

function abcLetterToHz(letter, octave = 3) {
  const upper    = letter.toUpperCase()
  const semitone = NOTE_SEMITONES[upper] ?? 0
  const keySharp = (upper === 'F' || upper === 'C') ? 1 : 0
  const semiFromA4 = (octave - 4) * 12 + semitone - 9 + keySharp
  return 440 * Math.pow(2, semiFromA4 / 12)
}

// ─────────────────────────────────────────────────────────────────────────────
// VOICE PRESETS
// ─────────────────────────────────────────────────────────────────────────────

export const VOICES = {

  // Old woman of the sea — low female, breathy, wax-cylinder character
  // Connacht Irish speaker, measured and unhurried
  seanBhean: {
    name:        'Seanbhean na Mara',
    fundamental: 175,           // F3 — low female speaking pitch
    harmonics: [
      { ratio: 1, gain: 0.72 },
      { ratio: 2, gain: 0.38 },
      { ratio: 3, gain: 0.22 },
      { ratio: 4, gain: 0.12 },
      { ratio: 5, gain: 0.07 },
      { ratio: 6, gain: 0.04 },
      { ratio: 7, gain: 0.02 },
    ],
    breathiness:    0.28,       // breathy — worn, oral-tradition quality
    breathBandMult: 1.2,        // breath noise pitched around F1
    // Seannós ornament: enabled — grace-note flutter on stressed syllables
    ornament: {
      enabled:   true,
      semitones: 1.8,           // grace note interval above target
      duration:  0.055,         // seconds for each grace step
      steps:     2,             // number of grace notes before settling
    },
    vibrato:     { rate: 4.2, depth: 0.016, delay: 0.12 },
    attack:      0.055,
    sustain:     0.82,
    // Stressed vs unstressed duration (seconds)
    stressedDur: 0.30,
    unstressedDur: 0.12,
    sylGap:      0.008,
    pauseDuration: 0.20,
    formantQ:    [ 10, 12, 14 ],
    formantGain: [ 24, 18, 11 ],
    formantScale: 1.04,         // slight upscale for female formants
    // Wax-cylinder EQ: subtle narrow bandpass on final output to add nasal warmth
    waxFilter:   { freq: 1800, Q: 0.7, gain: 4 },
    volume:      0.42,
  },

  // Blacksmith — bass-baritone, resonant chest voice
  blacksmith: {
    name:        'Blacksmith',
    fundamental: 98,
    harmonics: [
      { ratio: 1, gain: 0.70 },
      { ratio: 2, gain: 0.45 },
      { ratio: 3, gain: 0.30 },
      { ratio: 4, gain: 0.20 },
      { ratio: 5, gain: 0.14 },
      { ratio: 6, gain: 0.09 },
      { ratio: 7, gain: 0.05 },
      { ratio: 8, gain: 0.03 },
    ],
    breathiness:    0.06,
    breathBandMult: 1.4,
    ornament: {
      enabled:   true,
      semitones: 2.2,
      duration:  0.045,
      steps:     2,
    },
    vibrato:     { rate: 5.4, depth: 0.020, delay: 0.10 },
    attack:      0.04,
    sustain:     0.80,
    stressedDur: 0.32,
    unstressedDur: 0.13,
    sylGap:      0.005,
    pauseDuration: 0.24,
    formantQ:    [ 9, 11, 13 ],
    formantGain: [ 22, 17, 11 ],
    formantScale: 0.88,
    waxFilter:   { freq: 1200, Q: 0.6, gain: 3 },
    volume:      0.44,
  },

  // Young hero — clear mid-range, minimal ornament
  youngHero: {
    name:        'Young Hero',
    fundamental: 165,
    harmonics: [
      { ratio: 1, gain: 0.60 },
      { ratio: 2, gain: 0.38 },
      { ratio: 3, gain: 0.22 },
      { ratio: 4, gain: 0.13 },
      { ratio: 5, gain: 0.07 },
      { ratio: 6, gain: 0.04 },
    ],
    breathiness:    0.07,
    breathBandMult: 1.3,
    ornament: {
      enabled:   true,
      semitones: 1.5,
      duration:  0.038,
      steps:     1,
    },
    vibrato:     { rate: 5.1, depth: 0.016, delay: 0.09 },
    attack:      0.028,
    sustain:     0.74,
    stressedDur: 0.22,
    unstressedDur: 0.10,
    sylGap:      0.010,
    pauseDuration: 0.14,
    formantQ:    [ 8, 10, 12 ],
    formantGain: [ 20, 15, 10 ],
    formantScale: 0.94,
    waxFilter:   { freq: 1600, Q: 0.65, gain: 3 },
    volume:      0.40,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// VOICE FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export function createVoice(config) {
  let audioContext = null
  let masterGain   = null
  let waxEq        = null
  let cancelFns    = []

  // Persistent graph nodes
  let harmonicOscs = []
  let vibratoLfo   = null
  let vibratoGain  = null
  let formantF1    = null
  let formantF2    = null
  let formantF3    = null
  let voiceGain    = null
  let graphBuilt   = false

  function ensureAudioContext() {
    if (audioContext) return true
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return false
      audioContext = new AC()
      masterGain   = audioContext.createGain()
      masterGain.gain.value = config.volume ?? 0.4

      // Optional wax-cylinder peaking EQ on final output
      if (config.waxFilter) {
        waxEq = audioContext.createBiquadFilter()
        waxEq.type = 'peaking'
        waxEq.frequency.value = config.waxFilter.freq
        waxEq.Q.value         = config.waxFilter.Q
        waxEq.gain.value      = config.waxFilter.gain
        masterGain.connect(waxEq)
        waxEq.connect(audioContext.destination)
      } else {
        masterGain.connect(audioContext.destination)
      }
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

  function buildGraph() {
    if (graphBuilt) return
    const fScale    = config.formantScale ?? 1.0
    const fQ        = config.formantQ     ?? [8, 10, 12]
    const fGain     = config.formantGain  ?? [20, 16, 10]
    const harmonics = config.harmonics    ?? [{ ratio: 1, gain: 0.7 }, { ratio: 2, gain: 0.3 }]
    const fund      = config.fundamental  ?? 130

    voiceGain = audioContext.createGain()
    voiceGain.gain.value = 0

    // Three resonant bandpass formants
    const makeFormant = (freq, q, gainDb) => {
      const bp = audioContext.createBiquadFilter()
      bp.type  = 'bandpass'
      bp.frequency.value = freq * fScale
      bp.Q.value = q
      const g = audioContext.createGain()
      g.gain.value = Math.pow(10, gainDb / 20) * (q / 8)
      bp.connect(g)
      return { filter: bp, gainNode: g }
    }

    const [f1, f2, f3] = DEFAULT_VOWEL
    formantF1 = makeFormant(f1, fQ[0], fGain[0])
    formantF2 = makeFormant(f2, fQ[1], fGain[1])
    formantF3 = makeFormant(f3, fQ[2], fGain[2])

    // Additive harmonic source
    harmonicOscs = harmonics.map(({ ratio, gain }) => {
      const osc = audioContext.createOscillator()
      osc.type  = 'sine'
      osc.frequency.value = fund * ratio
      const g = audioContext.createGain()
      g.gain.value = gain
      osc.connect(g)
      g.connect(voiceGain)
      g.connect(formantF1.filter)
      g.connect(formantF2.filter)
      g.connect(formantF3.filter)
      osc.start()
      return { osc, gainNode: g, ratio }
    })

    // Unfiltered body (small amount)
    const directGain = audioContext.createGain()
    directGain.gain.value = 0.12
    voiceGain.connect(directGain)
    directGain.connect(masterGain)

    formantF1.gainNode.connect(masterGain)
    formantF2.gainNode.connect(masterGain)
    formantF3.gainNode.connect(masterGain)

    // Vibrato LFO
    const vib = config.vibrato
    if (vib) {
      vibratoLfo = audioContext.createOscillator()
      vibratoLfo.type = 'sine'
      vibratoLfo.frequency.value = vib.rate ?? 5
      vibratoGain = audioContext.createGain()
      vibratoGain.gain.value = 0
      vibratoLfo.connect(vibratoGain)
      harmonicOscs.forEach(({ osc, ratio }) => {
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
    harmonicOscs = []; vibratoLfo = null; vibratoGain = null
    formantF1 = null; formantF2 = null; formantF3 = null
    voiceGain = null; graphBuilt = false
  }

  // Schedule one syllable.
  // If stressed and ornament is enabled, schedule grace notes before the main pitch.
  function scheduleSyllable(pitchHz, syl, tStart, duration) {
    if (!audioContext || pitchHz <= 0 || !graphBuilt) return

    const fScale  = config.formantScale ?? 1.0
    const attack  = config.attack  ?? 0.035
    const sustain = config.sustain ?? 0.78
    const vib     = config.vibrato
    const orn     = config.ornament

    // ── Seannós ornament: grace notes above target pitch, then resolve ──
    // Only on stressed syllables with sufficient duration
    let ornDuration = 0
    if (orn?.enabled && syl?.stressed && duration > 0.18) {
      const steps    = orn.steps ?? 2
      const stepDur  = orn.duration ?? 0.05
      ornDuration    = steps * stepDur

      for (let s = 0; s < steps; s++) {
        // Each grace step: pitch descends toward target
        const gracePitch = pitchHz * Math.pow(2,
          (orn.semitones * (1 - s / steps)) / 12
        )
        const graceStart = tStart + s * stepDur

        harmonicOscs.forEach(({ osc, ratio }) => {
          osc.frequency.setTargetAtTime(gracePitch * ratio,
            audioContext.currentTime + graceStart, 0.010)
        })
      }
    }

    // ── Main pitch: resolve after ornament ──
    const pitchStart = tStart + ornDuration
    const now = audioContext.currentTime + pitchStart

    harmonicOscs.forEach(({ osc, ratio }) => {
      osc.frequency.setTargetAtTime(pitchHz * ratio, now, 0.018)
    })

    // ── Vibrato ──
    if (vib && vibratoGain) {
      const depth = pitchHz * (vib.depth ?? 0.018)
      vibratoGain.gain.cancelScheduledValues(audioContext.currentTime + tStart)
      vibratoGain.gain.setTargetAtTime(0, audioContext.currentTime + tStart, 0.01)
      vibratoGain.gain.setTargetAtTime(depth,
        now + (vib.delay ?? 0.10) + attack, 0.05)
    }

    // ── Amplitude envelope ──
    const envStart   = audioContext.currentTime + tStart
    const mainDur    = duration - ornDuration
    voiceGain.gain.cancelScheduledValues(envStart)
    voiceGain.gain.setTargetAtTime(1.0, envStart, attack * 0.40)
    const decayStart = envStart + mainDur * sustain
    const decayTime  = mainDur * (1 - sustain) * 0.55
    voiceGain.gain.setTargetAtTime(0.001, decayStart, Math.max(decayTime, 0.012))

    // ── Formant update: glide to new vowel ──
    const [f1, f2, f3] = getVowelFormants(syl?.text)
    const glide = syl?.stressed ? 0.030 : 0.018
    formantF1.filter.frequency.setTargetAtTime(f1 * fScale, now, glide)
    formantF2.filter.frequency.setTargetAtTime(f2 * fScale, now, glide)
    formantF3.filter.frequency.setTargetAtTime(f3 * fScale, now, glide)

    // ── Breath noise on attack ──
    const breath = config.breathiness ?? 0.06
    if (breath > 0.01) {
      const noiseDur  = Math.min(duration * 0.45, 0.14)
      const noise     = makeNoiseBuffer(noiseDur)
      const bp        = audioContext.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = f1 * fScale * (config.breathBandMult ?? 1.3)
      bp.Q.value = 1.5
      const bg = audioContext.createGain()
      bg.gain.setValueAtTime(0, envStart)
      bg.gain.linearRampToValueAtTime(breath * 0.22, envStart + 0.015)
      bg.gain.exponentialRampToValueAtTime(0.001, envStart + noiseDur)
      noise.connect(bp); bp.connect(bg); bg.connect(masterGain)
      noise.start(envStart); noise.stop(envStart + noiseDur)
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function stop() {
    for (const cancel of cancelFns) { try { cancel() } catch(e) {} }
    cancelFns = []
    if (voiceGain && audioContext) {
      voiceGain.gain.cancelScheduledValues(audioContext.currentTime)
      voiceGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.04)
    }
    if (vibratoGain && audioContext) {
      vibratoGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.03)
    }
  }

  // speak(text, opts)
  //
  //   opts.mode     'speech' | 'song'
  //   opts.style    'statement' | 'question' | 'exclamation' | 'whisper'
  //   opts.pitches  Hz[] — cycling pitch pool for song mode
  //   opts.tempo    BPM  — overrides stressedDur in song mode
  //   opts.onSyl    fn(syllableText, index, timeMs)
  //   opts.onDone   fn()

  function speak(text, opts = {}) {
    stop()
    if (!ensureAudioContext()) return
    buildGraph()

    const syllables    = irishSyllables(text)
    const mode         = opts.mode ?? 'speech'
    const style        = opts.style ?? 'statement'

    // Detect style from punctuation if not supplied
    const trimmed      = text.trim()
    const detectedStyle = opts.style
      ?? (trimmed.endsWith('?') ? 'question'
        : trimmed.endsWith('!') ? 'exclamation'
        : 'statement')

    const stressedDur   = config.stressedDur   ?? 0.26
    const unstressedDur = config.unstressedDur ?? 0.11
    const sylGap        = config.sylGap        ?? 0.008
    const pauseDuration = config.pauseDuration ?? 0.18

    // Build pitch array
    let pitches
    if (mode === 'song' && opts.pitches?.length) {
      let pi = 0
      pitches = syllables.map(s => s === null ? 0 : opts.pitches[pi++ % opts.pitches.length])
    } else {
      pitches = irishProsodyContour(syllables, config.fundamental, {
        style:    detectedStyle,
        variance: opts.variance ?? 0.06,
      })
    }

    let cursor   = 0.025
    let sylIndex = 0

    for (let i = 0; i < syllables.length; i++) {
      const syl = syllables[i]
      if (syl === null) { cursor += pauseDuration; continue }

      // Duration varies with stress
      const dur = syl.stressed ? stressedDur : unstressedDur

      scheduleSyllable(pitches[i] ?? 0, syl, cursor, dur)

      if (opts.onSyl) {
        const cs = syl.text, ci = sylIndex, ct = cursor
        const id = setTimeout(() => opts.onSyl(cs, ci, ct * 1000), ct * 1000)
        cancelFns.push(() => clearTimeout(id))
      }

      cursor += dur + sylGap
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
    audioContext = null; masterGain = null; waxEq = null
  }

  return { speak, stop, destroy, config }
}


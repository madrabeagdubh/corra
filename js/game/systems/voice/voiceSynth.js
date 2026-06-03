// voiceSynth.js — Prosodic hum synthesiser
// A warm triangle-wave tone that follows the pitch contour and rhythm
// of the text. Like speech heard through a wall, or what humans sound
// like to a dog. No phonemes, no formants — just the shape of meaning.
// Place at: js/game/systems/voice/voiceSynth.js

// ── Backward-compat stubs ──────────────────────────────────────────────────
const _NS = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 }
const _abc = (l, oct) => { const u=l.toUpperCase(); const sh=(u==='F'||u==='C')?1:0; return 440*Math.pow(2,((oct-4)*12+(_NS[u]??0)-9+sh)/12) }
const _p1 = ['d','d','A','A','B','G','G','G'].map(l=>_abc(l,l===l.toUpperCase()?4:5))
const _p2 = ['A','A','A','A','c','c','d','d'].map(l=>_abc(l,l===l.toUpperCase()?4:5))
const _p3 = ['d','d','A','A','B','G','A','F'].map(l=>_abc(l,l===l.toUpperCase()?4:5))
const _p4 = ['G','G','F','F','G','G','A','A'].map(l=>_abc(l,l===l.toUpperCase()?4:5))
export const DING_DONG_PITCHES = [..._p1,..._p2,..._p3,..._p4,..._p1,..._p2,..._p3,..._p4]
export const speechContour = () => []
export const irishProsodyContour = () => []
export function irishSyllables(text) { return [] }
export function listVoices() {}

// ── Punctuation-aware word tokeniser ──────────────────────────────────────
// Returns [ { word, stressed, pause } ] — one entry per word.
// pause is the silence that follows the word (in seconds).

const PAUSE = {
  word:     0.10,
  comma:    0.32,
  sentence: 0.62,
  line:     0.75,
}

// ── Vowel character table ─────────────────────────────────────────────────
// Each vowel maps to:
//   filterPeak  — lowpass cutoff at vowel open (Hz)
//   pitchNudge  — semitone offset (high front vowels sit higher)
// Diphthongs checked first (longest match wins).
const VOWEL_CHAR = [
  { v: 'aoi', filterPeak: 2800, pitchNudge:  0.4 },
  { v: 'ao',  filterPeak: 1600, pitchNudge: -0.2 },
  { v: 'ia',  filterPeak: 2400, pitchNudge:  0.3 },
  { v: 'ua',  filterPeak: 1200, pitchNudge: -0.4 },
  { v: 'ai',  filterPeak: 2200, pitchNudge:  0.2 },
  { v: 'ei',  filterPeak: 2600, pitchNudge:  0.5 },
  { v: 'oi',  filterPeak: 1800, pitchNudge:  0.1 },
  { v: 'ui',  filterPeak: 2500, pitchNudge:  0.4 },
  { v: 'í',   filterPeak: 3200, pitchNudge:  0.8 },
  { v: 'i',   filterPeak: 2900, pitchNudge:  0.6 },
  { v: 'é',   filterPeak: 2400, pitchNudge:  0.5 },
  { v: 'e',   filterPeak: 2100, pitchNudge:  0.3 },
  { v: 'á',   filterPeak: 2200, pitchNudge:  0.1 },
  { v: 'a',   filterPeak: 2000, pitchNudge:  0.0 },
  { v: 'ó',   filterPeak: 1300, pitchNudge: -0.3 },
  { v: 'o',   filterPeak: 1500, pitchNudge: -0.2 },
  { v: 'ú',   filterPeak:  950, pitchNudge: -0.6 },
  { v: 'u',   filterPeak: 1100, pitchNudge: -0.4 },
]
const DEFAULT_VOWEL_CHAR = { filterPeak: 1800, pitchNudge: 0 }

function getVowelChar(word) {
  if (!word) return DEFAULT_VOWEL_CHAR
  const w = word.toLowerCase()
  for (const entry of VOWEL_CHAR) {
    if (w.includes(entry.v)) return entry
  }
  return DEFAULT_VOWEL_CHAR
}

function tokeniseWords(text) {
  const tokens = []
  const lines  = text.split(/\n/)

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li].trim()
    if (!line) continue

    const wordRe = /([a-záéíóúàèìòùâêîôûäëïöü'''-]+)([,;:!?.]*)/gi
    let m, lineTokens = []
    while ((m = wordRe.exec(line)) !== null) {
      const word  = m[1]
      const punct = m[2]
      let pause = PAUSE.word
      if (/[.!?]/.test(punct))      pause = PAUSE.sentence
      else if (/[,;:]/.test(punct)) pause = PAUSE.comma
      lineTokens.push({ word, pause, vowelChar: getVowelChar(word) })
    }

    // Mark first word of each phrase (after sentence pause) as phrase-start
    lineTokens.forEach((t, i) => { t.phraseStart = i === 0 })
    tokens.push(...lineTokens)

    if (li < lines.length - 1) {
      // Extend last word's pause to line-break duration
      if (tokens.length) tokens[tokens.length - 1].pause = PAUSE.line
    }
  }

  // Remove trailing pause
  if (tokens.length) tokens[tokens.length - 1].pause = 0
  return tokens
}

// ── Prosody: pitch per word ────────────────────────────────────────────────
// Generates a Hz value for each word token based on:
//   - phrase-level arc (statement falls, question rises at end)
//   - word stress (first word of phrase = highest)
//   - small natural variance

// Filler sounds injected between phrases — em, eh, a, mhaise etc.
// Breaks up sing-song regularity; feels like actual thinking.
// Fillers are longer than normal words and rendered distinctly low and flat.
const FILLERS = ['em', 'ehhh', 'aaa', 'mmm', 'ehh', 'aaa', 'emm', 'mmm']
let _fillerIdx = 0

function maybeInjectFiller(tokens) {
  const out = []
  for (let i = 0; i < tokens.length; i++) {
    out.push(tokens[i])
    // After a sentence or line pause, ~50% chance of a filler
    if (tokens[i].pause >= PAUSE.sentence && Math.random() < 0.50) {
      const filler = FILLERS[_fillerIdx++ % FILLERS.length]
      out.push({
        word:        filler,
        // Fillers get a noticeable pre-pause before the next phrase starts
        pause:       PAUSE.comma,
        phraseStart: false,
        isFiller:    true,
        // Force duration: longer than a normal short word
        forceDur:    0.45,
      })
    }
  }
  return out
}

function prosodyPitches(tokens, fundamental, style) {
  const n = tokens.length

  // Track position within each phrase; assign arc direction at phrase start
  let phrasePos = 0
  let arcDir    = Math.random() < 0.5 ? 1 : -1
  const stressLevels = tokens.map((t) => {
    if (phrasePos === 0) {
      arcDir = Math.random() < 0.5 ? 1 : -1
      t._arcDir = arcDir
    } else {
      t._arcDir = arcDir
    }
    const s = phrasePos
    if (t.pause >= PAUSE.sentence || t.pause >= PAUSE.comma) phrasePos = 0
    else phrasePos++
    return s
  })

  return tokens.map((t, i) => {
    const progress = i / Math.max(1, n - 1)
    const isLast   = i === n - 1
    const pos      = stressLevels[i]

    let st = 0

    // Filler words: noticeably lower than speech, slow wobble, no lilt
    // Should sound like a genuine thinking-pause, clearly distinct from words
    if (t.isFiller) {
      st = -4.5 + (Math.random() - 0.5) * 0.6
      return fundamental * Math.pow(2, st / 12)
    }

    if (style === 'statement') {
      // Arc direction randomised per phrase-start — sometimes rises, sometimes falls.
      // Stored on the token so all words in a phrase share the same direction.
      const dir = t._arcDir ?? 1   // +1 = rise, -1 = fall
      const phraseArc = dir * pos * 1.4
      const lilt      = Math.sin(pos * Math.PI * 0.8) * 1.8
      st = dir * -2.5 + phraseArc + lilt
      st += Math.sin(progress * Math.PI) * 2.0
      if (isLast) st -= 2.5
    } else if (style === 'question') {
      // Start low-mid, gentle rise, big lift on final word
      const lilt = Math.sin(pos * Math.PI * 0.8) * 1.5
      st = -1.5 + pos * 0.8 + lilt
      if (isLast) st += 5.5
    } else if (style === 'exclamation') {
      // Burst of energy early, settles quickly
      st = 4.0 * Math.pow(1 - progress, 0.7)
      st += Math.sin(pos * Math.PI) * 1.5
    }

    // Phrase-start: comes in slightly low — builds from there
    if (t.phraseStart) st -= 1.0

    // Natural drift — enough to feel human, not so much it's random
    st += (Math.random() - 0.5) * 1.2

    // Clamp: ±7 semitones — expressive but not absurd
    st = Math.max(-7, Math.min(7, st))

    return fundamental * Math.pow(2, st / 12)
  })
}

// ── Voice presets ──────────────────────────────────────────────────────────

export const VOICES = {

  // Warm, lilting — Munster-flavoured NPC voice
  cailin: {
    name:        'Cailin',
    fundamental: 220,       // A3
    waveform:    'triangle',
    filterFreq:  1100,      // slightly brighter — more presence
    filterQ:     0.9,
    msPerChar:   72,        // slower — more time on each word
    minDur:      0.18,
    maxDur:      0.70,
    attack:      0.035,
    release:     0.090,     // longer release — words melt into each other
    volume:      0.38,
    variance:    1.8,       // wide variance — musical, expressive
  },

  // Lower, slower — gravitas
  seanBhean: {
    name:        'Seanbhean na Mara',
    fundamental: 155,
    waveform:    'triangle',
    filterFreq:  700,
    filterQ:     1.0,
    msPerChar:   72,
    minDur:      0.18,
    maxDur:      0.70,
    attack:      0.045,
    release:     0.080,
    volume:      0.34,
    variance:    0.4,
  },

  // Deep — blacksmith
  blacksmith: {
    name:        'Blacksmith',
    fundamental: 105,
    waveform:    'triangle',
    filterFreq:  550,
    filterQ:     1.2,
    msPerChar:   80,
    minDur:      0.20,
    maxDur:      0.80,
    attack:      0.050,
    release:     0.090,
    volume:      0.38,
    variance:    0.35,
  },

  // Higher, lighter — young hero
  youngHero: {
    name:        'Young Hero',
    fundamental: 260,
    waveform:    'triangle',
    filterFreq:  1100,
    filterQ:     0.7,
    msPerChar:   50,
    minDur:      0.10,
    maxDur:      0.45,
    attack:      0.022,
    release:     0.045,
    volume:      0.34,
    variance:    0.6,
  },

  // Volatile, forceful — angry chieftain
  // Fast and clipped, lurching pitch, hard onset, aggressive projection
  chieftain: {
    name:        'Angry Chieftain',
    fundamental: 130,
    filterFreq:  2800,
    filterQ:     1.4,
    msPerChar:   42,
    minDur:      0.09,
    maxDur:      0.38,
    attack:      0.010,
    release:     0.030,
    volume:      0.50,
    variance:    2.8,
    vibratoRate:  6.8,
    vibratoDepth: 0.028,
    breathMult:   2.2,
  },

  // Measured, deep, unhurried — wise old druid
  // Words chosen carefully, long silences, resonant chest tone
  druid: {
    name:        'Wise Druid',
    fundamental: 95,
    filterFreq:  1400,
    filterQ:     0.6,
    msPerChar:   95,
    minDur:      0.28,
    maxDur:      0.90,
    attack:      0.065,
    release:     0.140,
    volume:      0.42,
    variance:    0.5,
    vibratoRate:  3.8,
    vibratoDepth: 0.008,
    breathMult:   0.3,
  },

  // Ancient, vast, inhuman — tree monster
  // Sub-bass, lurching pitch, creaking onset, slow swaying vibrato
  treeMonster: {
    name:        'Tree Monster',
    fundamental: 58,
    filterFreq:  600,
    filterQ:     2.2,
    msPerChar:   140,
    minDur:      0.40,
    maxDur:      1.40,
    attack:      0.120,
    release:     0.220,
    volume:      0.48,
    variance:    4.5,
    vibratoRate:  1.4,
    vibratoDepth: 0.055,
    breathMult:   3.5,
  },
}

// ── Voice factory ──────────────────────────────────────────────────────────

export function createVoice(config) {
  let audioContext = null
  let masterGain   = null
  let osc          = null   // single persistent oscillator
  let filter       = null
  let envGain      = null
  let graphBuilt   = false
  let cancelFns    = []

  function ensureAudioContext() {
    if (audioContext) return true
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return false
      audioContext = new AC()
      return true
    } catch(e) { return false }
  }

  // Graph nodes
  let osc2         = null   // detuned second oscillator — vocal fold thickness
  let oscSaw       = null   // low-level sawtooth — adds harmonic edge/presence
  let vibratoLfo   = null
  let vibratoGain  = null
  let filterLo     = null   // lower resonance peak — chest/body
  let filterHi     = null   // upper resonance peak — head/presence
  let noiseSource  = null   // breath noise — rebuilt per word onset
  let breathGain   = null

  function buildGraph() {
    if (graphBuilt) return

    const fund = config.fundamental ?? 220

    // ── Oscillator bank ───────────────────────────────────────────────────
    // Primary: triangle — warm, soft harmonics
    osc = audioContext.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = fund

    // Second: triangle, 7 cents sharp — vocal fold chorus thickness
    osc2 = audioContext.createOscillator()
    osc2.type = 'triangle'
    osc2.frequency.value = fund
    osc2.detune.value = 7

    // Third: sawtooth at low level — adds harmonic richness and edge
    // Real voices have a sawtooth-like glottal pulse; this hints at that
    oscSaw = audioContext.createOscillator()
    oscSaw.type = 'sawtooth'
    oscSaw.frequency.value = fund

    const g1   = audioContext.createGain(); g1.gain.value   = 0.55
    const g2   = audioContext.createGain(); g2.gain.value   = 0.35
    const gSaw = audioContext.createGain(); gSaw.gain.value = 0.12  // subtle edge

    osc.connect(g1)
    osc2.connect(g2)
    oscSaw.connect(gSaw)

    // ── Vibrato LFO ───────────────────────────────────────────────────────
    // Starts at zero, kicks in mid-word via scheduleWord.
    // Slightly irregular rate via a second LFO modulating the vibrato rate.
    vibratoLfo  = audioContext.createOscillator()
    vibratoLfo.type = 'sine'
    vibratoLfo.frequency.value = config.vibratoRate ?? 4.6

    // Slow LFO on vibrato rate — makes it feel unsteady, human
    const vibratoRateLfo  = audioContext.createOscillator()
    vibratoRateLfo.type   = 'sine'
    vibratoRateLfo.frequency.value = 0.3   // very slow — subtle
    const vibratoRateGain = audioContext.createGain()
    vibratoRateGain.gain.value = 0.4       // ±0.4Hz wobble on vibrato rate
    vibratoRateLfo.connect(vibratoRateGain)
    vibratoRateGain.connect(vibratoLfo.frequency)

    vibratoGain = audioContext.createGain()
    vibratoGain.gain.value = 0   // starts silent, ramped per word
    // store depth for scheduleWord
    vibratoGain._depth = config.vibratoDepth ?? 0.018
    vibratoLfo.connect(vibratoGain)
    vibratoGain.connect(osc.frequency)
    vibratoGain.connect(osc2.frequency)
    vibratoGain.connect(oscSaw.frequency)

    // ── Two resonant bandpass filters in parallel ─────────────────────────
    // filterLo: body/chest resonance — stays relatively fixed
    // filterHi: head/presence resonance — sweeps with vowel
    // Together they create a sense of resonant space without full formant synthesis
    filterLo = audioContext.createBiquadFilter()
    filterLo.type = 'bandpass'
    filterLo.frequency.value = 380   // chest resonance
    filterLo.Q.value = 2.5

    filterHi = audioContext.createBiquadFilter()
    filterHi.type = 'bandpass'
    filterHi.frequency.value = 1800  // presence — swept per vowel
    filterHi.Q.value = 1.8

    // Lowpass after both bandpass — smooths the combined signal
    filter = audioContext.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = config.filterFreq ?? 3200
    filter.Q.value = 0.7

    // Mix oscillators into both filters
    const oscMix = audioContext.createGain()
    oscMix.gain.value = 1.0
    g1.connect(oscMix); g2.connect(oscMix); gSaw.connect(oscMix)

    const loGain = audioContext.createGain(); loGain.gain.value = 0.6
    const hiGain = audioContext.createGain(); hiGain.gain.value = 1.0

    oscMix.connect(filterLo); filterLo.connect(loGain)
    oscMix.connect(filterHi); filterHi.connect(hiGain)

    // Amplitude envelope
    envGain = audioContext.createGain()
    envGain.gain.value = 0

    loGain.connect(filter)
    hiGain.connect(filter)
    filter.connect(envGain)

    // ── Breath noise channel ──────────────────────────────────────────────
    // Persistent noise node — gated by breathGain per word onset
    const bufLen = audioContext.sampleRate * 2
    const noiseBuf = audioContext.createBuffer(1, bufLen, audioContext.sampleRate)
    const nd = noiseBuf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) nd[i] = Math.random() * 2 - 1
    noiseSource = audioContext.createBufferSource()
    noiseSource.buffer = noiseBuf
    noiseSource.loop = true

    const noiseFilt = audioContext.createBiquadFilter()
    noiseFilt.type = 'bandpass'
    noiseFilt.frequency.value = 2400   // breath sits in upper-mid
    noiseFilt.Q.value = 0.8

    breathGain = audioContext.createGain()
    breathGain.gain.value = 0

    noiseSource.connect(noiseFilt)
    noiseFilt.connect(breathGain)

    // Master volume
    masterGain = audioContext.createGain()
    masterGain.gain.value = config.volume ?? 0.36

    envGain.connect(masterGain)
    breathGain.connect(masterGain)
    masterGain.connect(audioContext.destination)

    osc.start(); osc2.start(); oscSaw.start()
    vibratoLfo.start(); vibratoRateLfo.start()
    noiseSource.start()
    graphBuilt = true
  }

  function teardown() {
    [osc, osc2, oscSaw, vibratoLfo, noiseSource].forEach(n => {
      if (n) { try { n.stop() } catch(e) {} }
    })
    osc = null; osc2 = null; oscSaw = null
    vibratoLfo = null; vibratoGain = null
    filterLo = null; filterHi = null; filter = null
    envGain = null; breathGain = null; noiseSource = null
    masterGain = null; graphBuilt = false
  }

  // Schedule one word: pitch arc, dual resonant filter sweep, breath onset, vibrato, dynamics
  function scheduleWord(pitchHz, tStart, duration, isPhraseFinal, isFiller, vowelChar) {
    if (!audioContext || !osc) return

    const attack  = config.attack  ?? 0.030
    const release = config.release ?? 0.060
    const vol     = config.volume  ?? 0.36

    // Micro timing nudge — ±20ms, human imprecision
    const nudge = (Math.random() - 0.5) * 0.04
    const t     = audioContext.currentTime + tStart + nudge

    // Vowel pitch nudge — front vowels sit higher in the voice
    const pitchNudgeSt = isFiller ? 0 : (vowelChar?.pitchNudge ?? 0)
    pitchHz = pitchHz * Math.pow(2, pitchNudgeSt / 12)

    // ── Micro pitch arc ───────────────────────────────────────────────────
    const arcDepth  = isFiller ? 0.2 : 1.4
    const pitchLow  = pitchHz * Math.pow(2, -arcDepth / 12)
    const pitchHigh = pitchHz * Math.pow(2,  arcDepth * 0.55 / 12)
    const pitchTail = pitchHz * Math.pow(2, -arcDepth * 0.35 / 12)
    const peakTime  = t + duration * 0.36
    const tailTime  = t + duration * 0.72

    ;[osc, osc2, oscSaw].forEach(o => {
      if (!o) return
      o.frequency.setValueAtTime(pitchLow, t)
      o.frequency.linearRampToValueAtTime(pitchHigh, peakTime)
      o.frequency.linearRampToValueAtTime(pitchTail, tailTime)
      o.frequency.linearRampToValueAtTime(pitchLow, t + duration)
    })

    // ── Dual resonant filter sweep ────────────────────────────────────────
    // filterLo (chest): gentle sweep anchored low — body of the voice
    // filterHi (presence): sweeps to vowel-specific peak — the timbral colour
    const vowelPeak = isFiller ? 900 : (vowelChar?.filterPeak ?? 1800)

    filterLo.frequency.setValueAtTime(320, t)
    filterLo.frequency.linearRampToValueAtTime(460, peakTime)
    filterLo.frequency.linearRampToValueAtTime(380, tailTime)
    filterLo.frequency.linearRampToValueAtTime(320, t + duration)

    filterHi.frequency.setValueAtTime(600, t)
    filterHi.frequency.linearRampToValueAtTime(vowelPeak, peakTime)
    filterHi.frequency.linearRampToValueAtTime(1200, tailTime)
    filterHi.frequency.linearRampToValueAtTime(600, t + duration)

    // ── Vibrato — kicks in after attack, depth tied to intensity ──────────
    const vibDepth = pitchHz * (isFiller ? 0.004 : (vibratoGain?._depth ?? 0.018))
    const vibDelay = t + attack + 0.04
    vibratoGain.gain.setValueAtTime(0, t)
    vibratoGain.gain.linearRampToValueAtTime(0, vibDelay)
    vibratoGain.gain.linearRampToValueAtTime(vibDepth, vibDelay + 0.06)
    vibratoGain.gain.linearRampToValueAtTime(0, t + duration)

    // ── Breath noise onset ────────────────────────────────────────────────
    // Short burst at word start — throat initiating sound.
    // More breath on phrase starts for theatrical projection.
    const breathMult = config.breathMult ?? 1.0
    const breathAmt = isFiller      ? 0.018 * breathMult
                    : isPhraseFinal ? 0.035 * breathMult
                    : 0.065 * breathMult
    if (breathGain) {
      breathGain.gain.setValueAtTime(0, t)
      breathGain.gain.linearRampToValueAtTime(breathAmt, t + 0.018)
      breathGain.gain.linearRampToValueAtTime(0, t + 0.055)
    }

    // ── Volume envelope — theatrical dynamic range ────────────────────────
    // Fillers: murmured, withdrawn
    // Phrase-final: trail off gently
    // Normal words: full voice
    const peakVol = isFiller      ? vol * 0.40
                  : isPhraseFinal ? vol * 0.72
                  : vol
    envGain.gain.setValueAtTime(0, t)
    envGain.gain.linearRampToValueAtTime(Math.min(1, peakVol), t + attack)
    envGain.gain.setValueAtTime(Math.min(1, peakVol), t + duration - release)
    envGain.gain.linearRampToValueAtTime(0, t + duration)
  }


  function stop() {
    for (const fn of cancelFns) { try { fn() } catch(e) {} }
    cancelFns = []
    if (envGain && audioContext) {
      envGain.gain.cancelScheduledValues(audioContext.currentTime)
      envGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.02)
    }
  }

  function speak(text, opts = {}) {
    stop()
    if (!ensureAudioContext()) return
    if (audioContext.state === 'suspended') audioContext.resume()
    buildGraph()

    const trimmed = text.trim()
    const style   = opts.style
      ?? (trimmed.endsWith('?') ? 'question'
        : trimmed.endsWith('!') ? 'exclamation'
        : 'statement')

    const rawTokens = tokeniseWords(text)
    const tokens    = maybeInjectFiller(rawTokens)
    const pitches   = prosodyPitches(tokens, config.fundamental ?? 220, style)

    const msPerChar = config.msPerChar ?? 58
    const minDur    = config.minDur    ?? 0.13
    const maxDur    = config.maxDur    ?? 0.55

    let cursor = 0.02

    tokens.forEach((token, i) => {
      // Word duration: use forceDur for fillers, otherwise scale by char count
      const isPhraseFinal = token.pause >= PAUSE.sentence
      const durScale      = isPhraseFinal ? 1.25 : 1.0
      const dur = token.forceDur
        ? token.forceDur
        : Math.min(maxDur,
            Math.max(minDur, token.word.length * msPerChar / 1000 * durScale))

      scheduleWord(pitches[i], cursor, dur, isPhraseFinal, !!token.isFiller, token.vowelChar)
      cursor += dur + token.pause
    })

    if (opts.onDone) {
      const id = setTimeout(opts.onDone, cursor * 1000 + 80)
      cancelFns.push(() => clearTimeout(id))
    }
  }

  function destroy() {
    stop()
    teardown()
    try { if (audioContext) audioContext.close() } catch(e) {}
    audioContext = null
  }

  return { speak, stop, destroy, config }
}


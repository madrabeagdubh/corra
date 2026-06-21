/**
 * voiceSynth.js
 * Port a beul speech synthesis for Corra.
 *
 * Usage:
 *   import { VoiceSynth } from './voiceSynth.js'
 *
 *   const synth = new VoiceSynth({ audioContext, masterGain })
 *   synth.speak(gaText, { voice: 'ronnie', tuneKey: 'Edor' })
 *   synth.speak(gaText, { voice: 'peig',   tuneKey: 'Dmix', onDone: () => {} })
 *   synth.interject('hmm',  { voice: 'ronnie', tuneKey: 'Edor' })
 *   synth.interject('laugh',{ voice: 'peig',   tuneKey: 'Dmix' })
 *   synth.stop()
 *
 * No emotion tag required. Emotion is derived automatically from the
 * Irish text using lexical and grammatical features plus the tune's
 * modal darkness. Voice is 'ronnie' (male) or 'peig' (female).
 * tuneKey is an ABC K: field string, e.g. 'Edor', 'Dmix', 'Gmaj', 'Bmin'.
 */

// ─────────────────────────────────────────────────────────────────────────────
// KEY / MODE SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

const ROOT_ABOVE_C = {
    C:0, D:2, E:4, F:5, G:7, A:9, B:11,
    Cb:-1, Db:1, Eb:3, Fb:4, Gb:6, Ab:8, Bb:10,
    'C#':1, 'D#':3, 'E#':5, 'F#':6, 'G#':8, 'A#':10, 'B#':12,
}

const MODE_INTERVALS = {
    major:      [0,2,4,5,7,9,11],
    ionian:     [0,2,4,5,7,9,11],
    dorian:     [0,2,3,5,7,9,10],
    phrygian:   [0,1,3,5,7,8,10],
    lydian:     [0,2,4,6,7,9,11],
    mixolydian: [0,2,4,5,7,9,10],
    minor:      [0,2,3,5,7,8,10],
    aeolian:    [0,2,3,5,7,8,10],
    locrian:    [0,1,3,5,6,8,10],
}

const MODE_DARKNESS = {
    major:.10, ionian:.10, lydian:.05,
    mixolydian:.25, dorian:.55,
    minor:.72, aeolian:.72, phrygian:.88, locrian:.95,
}

function parseKey(k) {
    if (!k) return { rac:2, dark:.1, root:'D', mode:'major' }
    const s  = String(k).trim()
    const rm = s.match(/^([A-G][b#]?)/)
    if (!rm) return parseKey('D')
    const rootStr = rm[1]
    const rest = s.slice(rootStr.length).toLowerCase()
        .replace(/^maj/, 'major').replace(/^min$|^m$/, 'minor')
        .replace(/^mix/, 'mixolydian').replace(/^dor/, 'dorian')
        .replace(/^phr/, 'phrygian').replace(/^lyd/, 'lydian')
        .replace(/^aeo/, 'aeolian').replace(/^ion/, 'ionian')
    const mode = Object.keys(MODE_INTERVALS).find(m => rest.startsWith(m)) || 'major'
    return {
        rac:  ROOT_ABOVE_C[rootStr] ?? 2,
        dark: MODE_DARKNESS[mode]   ?? .4,
        root: rootStr,
        mode,
    }
}

const A4 = 440
const st2hz = st => A4 * Math.pow(2, (st - 9) / 12)

function rootHzForVoice(rac, voiceId) {
    // Ronnie has octaveShift -1.3 applied inside synthesis, so pre-shift
    // we place him at octave 5 so he lands around 200-380Hz after shift.
    // Peig has no shift, so octave 4 gives female speaking range 262-494Hz.
    // 'bard' is a deep ronnie (octaveShift -2.0) — same octave-5 placement
    // so its larger shift still lands in a sensible (low) male range.
    const oct = voiceId === 'ronnie' ? 5 : 4
    return st2hz(rac + (oct - 4) * 12)
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTOMATIC EMOTION DERIVATION
// No manual tag needed — derived from Irish text + tune modal darkness.
// Returns one of: 'sorrowful' | 'defiant' | 'prophetic' | 'questioning' |
//                 'incantatory'
// ─────────────────────────────────────────────────────────────────────────────

function deriveEmotion(gaText, tuneDark) {
    const t = gaText.toLowerCase().trim()
    let sorrow    = tuneDark * 0.6
    let defiant   = 0
    let prophetic = 0

    // Terminal punctuation — checked before other features
    if (t.endsWith('!'))         defiant   += 0.55
    if (/\.\.\.$/.test(t))     { sorrow    += 0.25; prophetic += 0.15 }

    // Negatives → resigned, away from defiance
    if (/\b(ní|níl|chan|nár|nach)\b/.test(t)) { sorrow += 0.20; defiant -= 0.15 }

    // Vocative particle → softer, intimate, slightly sorrowful
    if (/\ba [a-záéíóú]/.test(t))             { sorrow += 0.12; defiant -= 0.10 }

    // Dark / night / cold lexicon
    if (/\b(dorcha|báis|oíche|uaigneas|brón|tuirse|fuar|ciúin|ceo|bás|uaigneach)\b/.test(t))
        sorrow += 0.30

    // Motion / journey / sea — melancholic but purposeful
    if (/\b(fágaim|turas|bád|uisce|cladach|farraige|snámh)\b/.test(t))
        sorrow += 0.15

    // Beloved / cherished — tender, sorrowful
    if (/\b(ionúin|ansa|grá|cara)\b/.test(t))
        sorrow += 0.20

    // Battle / strength → assertive
    if (/\b(cath|neart|claíomh|buaigh|laoch|arm|cogaí?r|cathair|lann)\b/.test(t))
        defiant += 0.25

    // Oracular / seeing / stars → prophetic
    if (/\b(feicim|chím|léim|tuar|réalt|spéir|réaltaí|léamh)\b/.test(t))
        prophetic += 0.35

    // Repeated opening word → incantatory
    const fw = t.match(/^\w+/)?.[0]
    if (fw && (t.match(new RegExp('\\b' + fw + '\\b', 'g')) || []).length >= 2)
        return 'incantatory'

    // Question mark → questioning contour regardless of other weights
    if (t.endsWith('?')) return 'questioning'

    // Resolve by dominant weight
    if (defiant   > sorrow && defiant   > prophetic) return 'defiant'
    if (prophetic > sorrow)                           return 'prophetic'
    return 'sorrowful'
}

// ─────────────────────────────────────────────────────────────────────────────
// IRISH WORD-STRESS SYLLABLE BUILDER
// Splits on word boundaries. First syllable of each word is stressed.
// Returns [{stressed: bool}] — one entry per syllable.
// ─────────────────────────────────────────────────────────────────────────────

function irishSyllables(text) {
    const words = text
        .replace(/[.,!?;:'"()…]/g, '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
    const result = []
    for (const word of words) {
        const sylCount = Math.max(1,
            (word.match(/[aeiouáéíóúAEIOUÁÉÍÓÚ]+/g) || []).length)
        for (let s = 0; s < sylCount; s++) {
            result.push({ stressed: s === 0 })
        }
    }
    return result.length > 0 ? result : [{ stressed: true }]
}

// Syllable count for a line (vowel-groups per word). Exported so callers
// laying melody notes against syllables (e.g. bard sing mode) can size
// their note slice without re-counting.
export function syllableCount(text) {
    return irishSyllables(text).length
}

// ─────────────────────────────────────────────────────────────────────────────
// PUNCTUATION PAUSE INJECTION
// Scans the text for punctuation marks and inserts gap notes at the
// appropriate positions in the note sequence. Weights:
//   comma      →  0.25 × note dur
//   semicolon  →  0.35 × note dur
//   full stop  →  0.55 × note dur
//   ellipsis   →  0.85 × note dur  (also pitch drift)
//   exclaim    →  0.40 × note dur  (after peak)
//   newline    →  0.60 × note dur  (treated as full stop)
// These multipliers are applied to the stressed note duration (~0.40s),
// giving audible but not excessive pauses. Multiply by PAUSE_SCALE (=3)
// as requested to make them very noticeable.
// ─────────────────────────────────────────────────────────────────────────────

const PAUSE_SCALE = 3.0  // exaggerate pauses × 3

function buildPauseMap(text) {
    // Returns array of {afterWord: N, pauseDurMultiplier: M}
    // afterWord is 0-indexed word position in the cleaned word array.
    const pauses = []
    // Split text into tokens keeping punctuation
    const tokens = text.split(/(\s+)/)
    let wordIdx = -1
    for (const tok of tokens) {
        if (/\S/.test(tok)) wordIdx++
        // Check for punctuation embedded in or following a word token
        if (/[,،]/.test(tok))          pauses.push({ afterWord: wordIdx, mult: 0.25 * PAUSE_SCALE })
        if (/[;]/.test(tok))            pauses.push({ afterWord: wordIdx, mult: 0.35 * PAUSE_SCALE })
        if (/[.!？。](?!\.)/.test(tok)) pauses.push({ afterWord: wordIdx, mult: 0.55 * PAUSE_SCALE })
        if (/!/.test(tok))              pauses.push({ afterWord: wordIdx, mult: 0.40 * PAUSE_SCALE })
        if (/\.{2,}|…/.test(tok))       pauses.push({ afterWord: wordIdx, mult: 0.85 * PAUSE_SCALE })
    }
    return pauses
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTE SEQUENCE BUILDER
// Combines: word-stress timing, emotional pitch contour, punctuation pauses,
// mandatory final cadence.
// Returns [{hz, dur, stressed, type}]
//   type: 'syl' | 'gap'
// ─────────────────────────────────────────────────────────────────────────────

function buildNotesWithRoot(gaText, tuneKey, voiceId) {
    const ki      = parseKey(tuneKey)
    const emotion = deriveEmotion(gaText, ki.dark)
    const rHz     = rootHzForVoice(ki.rac, voiceId)

    const sylInfo  = irishSyllables(gaText)
    const n        = sylInfo.length
    if (n === 0) return []

    // Duration: target total ~2.0-3.2s, stressed syllables 1.5× unstressed
    const targetTotal  = Math.max(1.6, n * 0.29)
    const stressCount  = sylInfo.filter(s => s.stressed).length
    const unstressCount = n - stressCount
    const baseDur  = targetTotal / (stressCount * 1.5 + unstressCount)
    const stressDur = baseDur * 1.5

    // Build pause map — keyed to word index
    // We need to map syllables back to words to know after which syllable
    // to insert a pause.
    const words    = gaText.replace(/[.,!?;:'"()…]/g,'').trim().split(/\s+/).filter(Boolean)
    const pauseMap = buildPauseMap(gaText)
    // Build a lookup: syllable index → pause multiplier (or 0)
    // First, figure out which syllable corresponds to the last syllable of each word
    const sylWordBoundaries = []  // sylWordBoundaries[i] = word index for syllable i
    let sylIdx = 0
    for (let wi = 0; wi < words.length; wi++) {
        const sc = Math.max(1, (words[wi].match(/[aeiouáéíóúAEIOUÁÉÍÓÚ]+/g)||[]).length)
        for (let s = 0; s < sc; s++) {
            sylWordBoundaries[sylIdx++] = wi
        }
    }
    // For each syllable, what pause (if any) follows it?
    // A pause follows the LAST syllable of the word that has a pause mark.
    const pauseAfterSyl = new Array(n).fill(0)
    for (const p of pauseMap) {
        // Find last syllable of word p.afterWord
        let lastSyl = -1
        for (let i = 0; i < n; i++) {
            if (sylWordBoundaries[i] === p.afterWord) lastSyl = i
        }
        if (lastSyl >= 0) {
            // Take the maximum pause if multiple marks follow same word
            pauseAfterSyl[lastSyl] = Math.max(pauseAfterSyl[lastSyl], p.mult)
        }
    }

    const notes = []
    for (let i = 0; i < n; i++) {
        const t      = i / (n - 1 || 1)
        const info   = sylInfo[i]
        const dur    = info.stressed ? stressDur : baseDur
        const isFinal = i === n - 1

        let st  // semitone offset from root
        if (isFinal) {
            // Mandatory cadence — always falls regardless of emotion
            const prevSt = notes.length > 0
                ? 12 * Math.log2(notes[notes.length - 1].hz / rHz)
                : 0
            st = prevSt - (1.8 + Math.random() * 0.8)
        } else {
            switch (emotion) {
                case 'sorrowful':
                    st = 1.2 - t * 3.2 + (Math.random() - .5) * .7
                    if (info.stressed) st += .4
                    break
                case 'defiant': {
                    const arc = t < .6 ? t / .6 : 1 - (t - .6) / .4
                    st = -1 + arc * 5.5 + (Math.random() - .5) * .6
                    if (info.stressed) st += .5
                    break
                }
                case 'prophetic': {
                    const drop = t > .72 ? (t - .72) / .28 : 0
                    st = .8 - drop * 4.5 + (Math.random() - .5) * .4
                    if (info.stressed) st += .3
                    break
                }
                case 'questioning':
                    st = -1.2 + t * 4.0 + (Math.random() - .5) * .6
                    if (info.stressed) st += .4
                    break
                case 'incantatory': {
                    const swell = Math.sin(t * Math.PI) * .8
                    st = swell + (Math.random() - .5) * .3
                    if (info.stressed) st += .2
                    break
                }
                default:
                    st = (Math.random() - .5) * 2
            }
        }

        notes.push({
            hz:      rHz * Math.pow(2, st / 12),
            dur,
            stressed: info.stressed,
            type:    'syl',
        })

        // Insert pause after this syllable if punctuation demands it
        if (pauseAfterSyl[i] > 0) {
            notes.push({
                hz:   0,
                dur:  baseDur * pauseAfterSyl[i],
                stressed: false,
                type: 'gap',
            })
        }
    }
    return notes
}

// ─────────────────────────────────────────────────────────────────────────────
// MELODY NOTE BUILDER (bard sing mode)
// Like buildNotesWithRoot, but the PITCH of each syllable comes from the
// MELODY — `melodyOffsets[i]` is a semitone offset from the tune's tonic,
// one per syllable, supplied by the caller (which walks the tune note by
// note across the poem). This is what makes the voice SING the actual tune
// rather than an invented emotional contour. The duration / stress / pause
// logic is identical to buildNotesWithRoot, so the sung line keeps the same
// readable pacing the spoken read-along already had. There is deliberately
// NO forced final cadence here — the melody itself supplies the ending, so
// overriding the last note would fight the tune.
// ─────────────────────────────────────────────────────────────────────────────

function buildNotesFromMelody(gaText, melodyOffsets, tuneKey, voiceId) {
    const ki   = parseKey(tuneKey)
    const rHz  = rootHzForVoice(ki.rac, voiceId)
    const sylInfo = irishSyllables(gaText)
    const n = sylInfo.length
    if (n === 0) return []

    const targetTotal   = Math.max(1.6, n * 0.29)
    const stressCount   = sylInfo.filter(s => s.stressed).length
    const unstressCount = n - stressCount
    const baseDur   = targetTotal / (stressCount * 1.5 + unstressCount)
    const stressDur = baseDur * 1.5

    const words    = gaText.replace(/[.,!?;:'"()…]/g,'').trim().split(/\s+/).filter(Boolean)
    const pauseMap = buildPauseMap(gaText)
    const sylWordBoundaries = []
    let sylIdx = 0
    for (let wi = 0; wi < words.length; wi++) {
        const sc = Math.max(1, (words[wi].match(/[aeiouáéíóúAEIOUÁÉÍÓÚ]+/g)||[]).length)
        for (let s = 0; s < sc; s++) sylWordBoundaries[sylIdx++] = wi
    }
    const pauseAfterSyl = new Array(n).fill(0)
    for (const p of pauseMap) {
        let lastSyl = -1
        for (let i = 0; i < n; i++) if (sylWordBoundaries[i] === p.afterWord) lastSyl = i
        if (lastSyl >= 0) pauseAfterSyl[lastSyl] = Math.max(pauseAfterSyl[lastSyl], p.mult)
    }

    const notes = []
    for (let i = 0; i < n; i++) {
        const info = sylInfo[i]
        const dur  = info.stressed ? stressDur : baseDur
        // Pitch straight from the melody — fall back to the last supplied
        // offset (then the tonic) if the caller under-supplied offsets.
        const off  = melodyOffsets[i] ?? melodyOffsets[melodyOffsets.length - 1] ?? 0
        notes.push({
            hz: rHz * Math.pow(2, off / 12),
            dur, stressed: info.stressed, type: 'syl',
        })
        if (pauseAfterSyl[i] > 0) {
            notes.push({ hz: 0, dur: baseDur * pauseAfterSyl[i], stressed: false, type: 'gap' })
        }
    }
    return notes
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERJECTION BUILDERS
// Returns a note sequence for a short expressive sound.
// All pitches relative to rootHz (will be shifted by voice octaveShift).
// ─────────────────────────────────────────────────────────────────────────────

const INTERJECTIONS = {
    hmm: (rHz) => {
        const n = 5
        return Array.from({ length: n }, (_, i) => ({
            hz:  rHz * Math.pow(2, (i / (n-1)) * 1.5 / 12),
            dur: 0.55 / n, stressed: i === 0, type: 'syl',
        }))
    },
    oh: (rHz) => [
        { hz: rHz * Math.pow(2, -2/12), dur: .06, stressed: true,  type: 'syl' },
        { hz: rHz * Math.pow(2,  4/12), dur: .14, stressed: false, type: 'syl' },
        { hz: rHz * Math.pow(2,  5/12), dur: .20, stressed: false, type: 'syl' },
        { hz: rHz * Math.pow(2,  2/12), dur: .10, stressed: false, type: 'syl' },
    ],
    laugh: (rHz, rhythm) => {
        const pace = ['reel','polka','jig'].includes(rhythm) ? .13 : .21
        return [0,1,2,3].flatMap(i => [
            { hz: rHz * Math.pow(2, (.5 - i * .14) / 12 * 12), dur: pace * .65, stressed: i===0, type: 'syl' },
            { hz: 0, dur: pace * .35, stressed: false, type: 'gap' },
        ])
    },
    distress: (rHz) => [
        { hz: rHz * Math.pow(2, 2/12),  dur: .22, stressed: true,  type: 'syl' },
        { hz: 0,                         dur: .10, stressed: false, type: 'gap' },
        { hz: rHz * Math.pow(2, -3/12), dur: .28, stressed: false, type: 'syl' },
        { hz: rHz * Math.pow(2, -8/12), dur: .22, stressed: false, type: 'syl' },
    ],
    mhm: (rHz) => {
        const n = 6
        return Array.from({ length: n }, (_, i) => ({
            hz:  rHz * Math.pow(2, (i / (n-1)) * 1.8 / 12),
            dur: 0.5 / n, stressed: i === 0, type: 'syl',
        }))
    },
    eist: (rHz) => [
        // "Éist!" — silence — sharp commanding burst
        { hz: rHz * Math.pow(2, 3/12),  dur: .08, stressed: true,  type: 'syl' },
        { hz: rHz * Math.pow(2, 5/12),  dur: .20, stressed: false, type: 'syl' },
        { hz: rHz * Math.pow(2, 1/12),  dur: .12, stressed: false, type: 'syl' },
    ],
    sigh: (rHz) => {
        const n = 8
        return Array.from({ length: n }, (_, i) => ({
            hz:  rHz * Math.pow(2, (1.2 - i / (n-1) * 4.0) / 12),
            dur: 1.0 / n, stressed: i === 0, type: 'syl',
        }))
    },
}

// ─────────────────────────────────────────────────────────────────────────────
// VOICE PRESETS
// ─────────────────────────────────────────────────────────────────────────────

const VOICES = {
    // The tavern bard — a deep, gravelly storyteller in the register of
    // Ronnie Drew: low pitch + a big dark resonating cavity + heavy rasp.
    // (Formerly two presets, 'ronnie' and a separate deep 'bard'; merged
    // into one since this voice is only used for the bard now.) The four
    // levers that make the character, with how far they're pushed:
    //   os  — octave shift. Low, but NOT chased past intelligibility (the
    //         read-along has to stay legible); the darkness comes from fs/lp.
    //   fs  — formant scale / cavity size. The big one: low = a large, dark
    //         vocal tract, which is most of what reads as "deep" vs just "low".
    //   lp  — resonance lid (per-voice lowpass, see schedSyl). Rolls off the
    //         bright top so the energy sits low and chesty.
    //   mix.r + the saw-heavy oscillator blend — the audible GRAVEL, Drew's
    //         signature; sawtooth carries grit better than the smooth triangle.
    // To go even deeper/grittier: lower os toward -2.4, fs toward 0.30, lp
    // toward 1800, raise mix.r toward 0.8 — at the cost of clarity.
    ronnie: {
        os:  -2.2,   // low, but intelligible — darkness is carried by fs/lp
        fs:   0.32,  // big dark cavity (was 0.48) — the main "deep" knob
        lp:   2200,  // resonance lid (default 3600) — rolls off the bright top
        mix:  { t: 0.08, s: 0.46, r: 0.68 },  // saw-heavy + heavy gravel
        br:   0.0,
        cv:   1.00,
        ck:   0.08,
        vf:   0.78,
        on:   45,
        cl:   55,
        wv:   0.72,
        ns:   0.0,
    },
    peig: {
        os:   0.0,
        fs:   1.02,
        mix:  { t: 0.44, s: 0.30, r: 0.26 },
        br:   0.022,
        cv:   0.32,
        ck:   0.14,
        vf:   0.80,
        on:   40,
        cl:   52,
        wv:   0.70,
        ns:   0.70,
    },
}

// ─────────────────────────────────────────────────────────────────────────────
// SYLLABLE STREAM (port a beul vocable picker)
// ─────────────────────────────────────────────────────────────────────────────

const SYLL = {
    strong: [
        {v:.62},{v:.35},{v:.55},{v:.65},{v:.65},{v:.15},{v:.35},{v:.35},
    ],
    weak: [
        {v:.15},{v:.90},{v:1.0},{v:.15},{v:.45},{v:.05},{v:.15},
    ],
    long:  [{v:.35},{v:.65},{v:.55},{v:.35}],
    term:  [{v:.40},{v:.10},{v:.30}],
    open:  [{v:.35},{v:.62},{v:.15},{v:.65}],
}

class SyllableStream {
    constructor() {
        this._i   = { s:0, w:0, l:0, o:0, t:0 }
        this._pos = 0
        this._wk  = false
        this._len = 8 + Math.floor(Math.random() * 4)
    }
    next(units, isTerminal) {
        const op = this._pos === 0
        this._pos++
        if (this._pos >= this._len) {
            this._pos = 0; this._wk = false
            this._len = 8 + Math.floor(Math.random() * 4)
        }
        if (isTerminal) { this._wk = false; return SYLL.term[(this._i.t++) % SYLL.term.length] }
        if (op)         { this._wk = true;  return SYLL.open[(this._i.o++) % SYLL.open.length] }
        if (units > 2)  { this._wk = false; return SYLL.long[(this._i.l++) % SYLL.long.length] }
        if (this._wk)   {
            this._wk = false
            if (Math.random() < .10) this._i.w++
            return SYLL.weak[(this._i.w++) % SYLL.weak.length]
        }
        this._wk = true
        if (Math.random() < .10) this._i.s++
        return SYLL.strong[(this._i.s++) % SYLL.strong.length]
    }
    reset() {
        this._pos = 0; this._wk = false
        this._len = 8 + Math.floor(Math.random() * 4)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE SYNTHESIS — schedules one syllable into the AudioContext
// ─────────────────────────────────────────────────────────────────────────────

const ffq = v => ({ f1: 300 + (1-v)*400, f2: 900 + v*2300 })

function schedSyl(ac, dest, bHz, when, dur, fromHz, v, ss, spu, stressBoost) {
    if (!ac || !dest || dur < .03) return

    const hz  = bHz  * Math.pow(2, v.os || 0)
    const fhs = fromHz ? fromHz * Math.pow(2, v.os || 0) : 0
    const u   = dur / spu
    const iT  = u >= 3
    const sy  = ss.next(u, iT)
    const { f1: fb, f2: f2b } = ffq(sy.v)
    const f1  = fb  * v.fs
    const f2  = f2b * v.fs
    const vb  = stressBoost ? 1.25 : 1.0

    const cd = .012
    const vf = v.vf * (sy.v < .3 ? .88 : 1.0)
    const vd = dur * vf
    const on = Math.min(v.on / 1000, vd * .20)
    const cl = Math.min(v.cl / 1000, vd * .32)
    const rd = .012
    const st = Math.max(.015, vd - cd - on - cl - rd)
    const t0=when, t1=t0+cd, t2=t1+on, t3=t2+st, t4=t3+cl, t5=t4+rd

    const mkNoise = d => {
        const s = Math.ceil(ac.sampleRate * Math.min(d, 2.0))
        const b = ac.createBuffer(1, s, ac.sampleRate)
        const dt = b.getChannelData(0)
        for (let i = 0; i < s; i++) dt[i] = Math.random() * 2 - 1
        return b
    }

    // Consonant tap — two layers: body thud + tongue-tip click
    const iw = sy.v <= .25
    const th = (iw ? v.cv * .55 : v.cv) * vb
    const ck = (iw ? v.ck * 1.15 : v.ck) * vb

    const nb1 = mkNoise(cd+.004), ns1 = ac.createBufferSource(); ns1.buffer = nb1
    const bp1 = ac.createBiquadFilter()
    bp1.type = 'bandpass'; bp1.frequency.value = Math.min(650, hz*1.1); bp1.Q.value = 7
    const g1 = ac.createGain()
    g1.gain.setValueAtTime(0, t0)
    g1.gain.linearRampToValueAtTime(th, t0+.002)
    g1.gain.exponentialRampToValueAtTime(.001, t0+cd)
    ns1.connect(bp1); bp1.connect(g1); g1.connect(dest)
    ns1.start(t0); ns1.stop(t0+cd+.004)

    const nb2 = mkNoise(.007), ns2 = ac.createBufferSource(); ns2.buffer = nb2
    const bp2 = ac.createBiquadFilter()
    bp2.type = 'bandpass'; bp2.frequency.value = Math.min(3800, f2*1.5); bp2.Q.value = 9
    const g2 = ac.createGain()
    g2.gain.setValueAtTime(ck, t0+.001)
    g2.gain.exponentialRampToValueAtTime(.001, t0+.008)
    ns2.connect(bp2); bp2.connect(g2); g2.connect(dest)
    ns2.start(t0+.001); ns2.stop(t0+.010)

    // Oscillators
    const mx = v.mix
    const o1 = ac.createOscillator(); o1.type = 'triangle'
    const o2 = ac.createOscillator(); o2.type = 'sawtooth'
    let pf = hz
    if (fhs > 0) {
        const sd = Math.abs(12 * Math.log2(hz / fhs))
        pf = sd <= 4 ? fhs : hz * Math.pow(2, (Math.random() > .5 ? .4 : -.4) / 12)
    }
    const pc = hz * Math.pow(2, -.08/12)
    ;[o1, o2].forEach(o => {
        o.frequency.setValueAtTime(pf, t1)
        o.frequency.exponentialRampToValueAtTime(hz, t2)
        o.frequency.setValueAtTime(hz, t3)
        o.frequency.linearRampToValueAtTime(pc, t4)
    })
    const go1 = ac.createGain(); go1.gain.value = mx.t * vb
    const go2 = ac.createGain(); go2.gain.value = mx.s * vb
    o1.connect(go1); o2.connect(go2)
    const om = ac.createGain(); om.gain.value = 1.0
    go1.connect(om); go2.connect(om)

    // Roughness — amplitude-modulated noise (Ronnie's gravel)
    if (mx.r > .05) {
        const rd2 = t5 - t1 + .02
        const fb2 = mkNoise(rd2), fs = ac.createBufferSource(); fs.buffer = fb2
        const fbp = ac.createBiquadFilter(); fbp.type = 'lowpass'; fbp.frequency.value = 14
        const fsc = ac.createGain(); fsc.gain.value = mx.r * .55
        fs.connect(fbp); fbp.connect(fsc); fsc.connect(om.gain)
        fs.start(t1); fs.stop(t5+.02)

        const rb = mkNoise(rd2), rs = ac.createBufferSource(); rs.buffer = rb
        const rbp = ac.createBiquadFilter(); rbp.type = 'bandpass'
        rbp.frequency.value = Math.min(160, hz * .55); rbp.Q.value = .6
        const rg = ac.createGain()
        rg.gain.setValueAtTime(0, t1)
        rg.gain.linearRampToValueAtTime(mx.r * .75, t2)
        rg.gain.setValueAtTime(mx.r * .75, t3)
        rg.gain.linearRampToValueAtTime(0, t5)
        rs.connect(rbp); rbp.connect(rg); rg.connect(dest)
        rs.start(t1); rs.stop(t5+.02)
    }

    // Breath
    if (sy.v > .4 && st > .025 && v.br > .005) {
        const bl  = Math.min(st * .6, .04)
        const bb  = mkNoise(bl + .005), bs = ac.createBufferSource(); bs.buffer = bb
        const bh  = ac.createBiquadFilter(); bh.type = 'highpass'; bh.frequency.value = hz * 4
        const bg  = ac.createGain()
        bg.gain.setValueAtTime(v.br, t2)
        bg.gain.linearRampToValueAtTime(0, t2 + bl)
        bs.connect(bh); bh.connect(bg); bg.connect(dest)
        bs.start(t2); bs.stop(t2 + bl + .005)
    }

    // Formant filters
    const fp = sy.v < .25
        ? f1 * (.85 + v.wv * 1.4)
        : f2 * (.85 + sy.v * .18)
    const fc = f1 * .52

    const fl1 = ac.createBiquadFilter(); fl1.type = 'bandpass'; fl1.Q.value = 6.0
    fl1.frequency.setValueAtTime(f1 * .6, t1)
    fl1.frequency.linearRampToValueAtTime(f1, t2)
    fl1.frequency.setValueAtTime(f1, t3)
    fl1.frequency.exponentialRampToValueAtTime(f1 * .55, t5)

    const fl2 = ac.createBiquadFilter(); fl2.type = 'bandpass'; fl2.Q.value = 4.5
    fl2.frequency.setValueAtTime(f2 * .22, t1)
    fl2.frequency.exponentialRampToValueAtTime(fp, t2)
    fl2.frequency.setValueAtTime(fp, t3)
    fl2.frequency.exponentialRampToValueAtTime(fc, t5)

    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = .4; lp.frequency.value = v.lp ?? 3600
    const gf1 = ac.createGain(); gf1.gain.value = .55
    const gf2 = ac.createGain(); gf2.gain.value = 1.0

    // Nasality (Peig)
    let ng = null, ng2 = null
    if (v.ns > .05) {
        const nf1 = ac.createBiquadFilter(); nf1.type = 'bandpass'
        nf1.frequency.value = 1050; nf1.Q.value = 2.5
        ng = ac.createGain()
        ng.gain.setValueAtTime(0, t1)
        ng.gain.linearRampToValueAtTime(v.ns * .9, t2)
        ng.gain.setValueAtTime(v.ns * .9, t3)
        ng.gain.linearRampToValueAtTime(0, t5)
        om.connect(nf1); nf1.connect(ng)

        const nf2 = ac.createBiquadFilter(); nf2.type = 'bandpass'
        nf2.frequency.value = 2500; nf2.Q.value = 3.0
        ng2 = ac.createGain(); ng2.gain.value = v.ns * .25
        om.connect(nf2); nf2.connect(ng2)

        gf1.gain.value = .55 * (1 - v.ns * .45)
        gf2.gain.value = 1.0 * (1 - v.ns * .35)
    }

    om.connect(fl1); om.connect(fl2)
    fl1.connect(gf1); fl2.connect(gf2)
    gf1.connect(lp); gf2.connect(lp)

    const env = ac.createGain()
    env.gain.setValueAtTime(0, t1)
    env.gain.linearRampToValueAtTime(1.0, t2)
    env.gain.setValueAtTime(1.0, t3)
    env.gain.linearRampToValueAtTime(.55, t4)
    env.gain.linearRampToValueAtTime(0, t5)

    lp.connect(env)
    if (ng)  ng.connect(env)
    if (ng2) ng2.connect(env)
    env.connect(dest)

    o1.start(t1); o1.stop(t5 + .008)
    o2.start(t1); o2.stop(t5 + .008)
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYER — sequences notes against the AudioContext clock
// ─────────────────────────────────────────────────────────────────────────────

class Player {
    constructor(ac, dest) {
        this._ac   = ac
        this._dest = dest
        this._ss   = new SyllableStream()
        this._nt   = 0     // next note time
        this._ph   = 0     // previous Hz (for portamento)
        this._spu  = .25   // seconds per unit (set from first note dur)
        this._lid  = null
        this._run  = false
    }

    stop() {
        this._run = false
        if (this._lid) { clearTimeout(this._lid); this._lid = null }
    }

    play(notes, voiceId, onDone) {
        this.stop()
        this._ss.reset()
        const v    = VOICES[voiceId] || VOICES.peig
        this._nt   = this._ac.currentTime + 0.06
        this._ph   = 0
        this._spu  = notes.find(n => n.type === 'syl')?.dur || .25
        this._run  = true

        const tick = idx => {
            if (!this._run) return
            if (idx >= notes.length) {
                this._run = false
                if (onDone) onDone()
                return
            }
            const horizon = this._ac.currentTime + 0.65
            let i = idx
            while (this._nt < horizon && i < notes.length) {
                const n = notes[i]
                if (n.type === 'gap') {
                    // Silent gap — just advance time
                    this._nt += n.dur
                } else {
                    schedSyl(
                        this._ac, this._dest,
                        n.hz, this._nt, n.dur,
                        this._ph, v, this._ss, this._spu,
                        n.stressed
                    )
                    this._ph = n.hz
                    this._nt += n.dur
                }
                i++
            }
            this._lid = setTimeout(() => tick(i), 40)
        }
        tick(0)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// VoiceSynth — public class
// ─────────────────────────────────────────────────────────────────────────────

export class VoiceSynth {
    /**
     * @param {object} opts
     * @param {AudioContext}  opts.audioContext  — existing AC to share
     * @param {AudioNode}     [opts.masterGain]  — node to connect output to
     *                                             (defaults to AC.destination)
     * @param {number}        [opts.volume]      — output gain, default 0.72
     */
    constructor({ audioContext, masterGain, volume = 0.72 } = {}) {
        // Create our own AC if none provided (standalone use / testing)
        if (audioContext) {
            this._ac  = audioContext
            this._own = false
        } else {
            this._ac  = new (window.AudioContext || window.webkitAudioContext)()
            this._own = true
        }

        this._out = this._ac.createGain()
        this._out.gain.value = volume
        this._out.connect(masterGain || this._ac.destination)

        this._player = new Player(this._ac, this._out)
    }

    /**
     * Speak a line of Irish text.
     * @param {string} gaText   — Irish language text
     * @param {object} opts
     * @param {string} opts.voice    — 'ronnie' | 'bard' | 'peig'
     * @param {string} opts.tuneKey  — ABC K: field, e.g. 'Edor', 'Dmix', 'Gmaj'
     * @param {Function} [opts.onDone] — called when speech ends
     * @param {number[]} [opts.melodyOffsets] — if supplied, the voice SINGS
     *        the melody: each entry is a semitone offset from the tune's
     *        tonic, one per syllable (see buildNotesFromMelody). Absent →
     *        the original spoken emotional contour (buildNotesWithRoot).
     */
    speak(gaText, { voice = 'peig', tuneKey = 'D', onDone, melodyOffsets } = {}) {
        if (this._ac.state === 'suspended') this._ac.resume()
        const voiceId = VOICES[voice] ? voice : 'peig'
        const notes   = (melodyOffsets && melodyOffsets.length)
            ? buildNotesFromMelody(gaText, melodyOffsets, tuneKey, voiceId)
            : buildNotesWithRoot(gaText, tuneKey, voiceId)
        this._out.gain.cancelScheduledValues(this._ac.currentTime)
        this._out.gain.setValueAtTime(this._out.gain.value, this._ac.currentTime)
        this._out.gain.linearRampToValueAtTime(0.72, this._ac.currentTime + 0.08)
        this._player.play(notes, voiceId, onDone)
    }

    /**
     * Play a short non-lexical interjection.
     * @param {string} type  — 'hmm' | 'oh' | 'laugh' | 'distress' | 'mhm' | 'eist' | 'sigh'
     * @param {object} opts
     * @param {string} opts.voice    — 'ronnie' | 'bard' | 'peig'
     * @param {string} opts.tuneKey  — for root pitch
     * @param {string} [opts.rhythm] — 'reel'|'jig'|'waltz' etc. affects laugh pace
     */
    interject(type, { voice = 'peig', tuneKey = 'D', rhythm = 'reel' } = {}) {
        if (this._ac.state === 'suspended') this._ac.resume()
        const voiceId = VOICES[voice] ? voice : 'peig'
        const ki      = parseKey(tuneKey)
        const rHz     = rootHzForVoice(ki.rac, voiceId)
        const builder = INTERJECTIONS[type] || INTERJECTIONS.hmm
        const notes   = builder(rHz, rhythm)
        this._player.play(notes, voiceId, null)
    }

    /**
     * Stop all speech immediately.
     */
    stop() {
        this._player.stop()
    }

    /**
     * Fade out and stop.
     * @param {number} [ms=500]
     */
    fadeOut(ms = 500) {
        const t = this._ac.currentTime
        this._out.gain.cancelScheduledValues(t)
        this._out.gain.setValueAtTime(this._out.gain.value, t)
        this._out.gain.linearRampToValueAtTime(0, t + ms / 1000)
        setTimeout(() => this.stop(), ms + 100)
    }

    /**
     * Derive what emotion the synth would assign to a line,
     * without playing it. Useful for debugging.
     * @param {string} gaText
     * @param {string} tuneKey
     * @returns {string}
     */
    debugEmotion(gaText, tuneKey = 'D') {
        return deriveEmotion(gaText, parseKey(tuneKey).dark)
    }

    destroy() {
        this.stop()
        if (this._own) {
            try { this._ac.close() } catch(e) {}
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: derive voice from champion gender
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns 'ronnie' (male) or 'peig' (female) from a champion object.
 * Reads champion.pronouns.en.subject or .ga.subject.
 * Defaults to 'ronnie' if pronouns are absent or unrecognised.
 */
export function championVoice(champion) {
    const subject = (
        champion?.pronouns?.en?.subject ||
        champion?.pronouns?.ga?.subject ||
        ''
    ).toLowerCase().trim()
    // Irish: sí = she.  English: she/her.  Everything else → male.
    if (/^she$|^sí$/.test(subject)) return 'peig'
    return 'ronnie'
}

/**
 * Returns the ABC K: field string from a champion object.
 * Tries champion.tuneKey (fast path, if pre-computed at hero select time).
 * Otherwise derives from champion.themeTuneTitle via allTunes lookup.
 * Falls back to 'D' (D major) if nothing found.
 *
 * Title normalisation: "Swallowtail, The" → "swallowtailThe"
 * Matches the camelCase key format used in allTunes.js.
 */
export function championTuneKey(champion, allTunes) {
    // Fast path — pre-computed key stored on champion
    if (champion?.tuneKey) return champion.tuneKey

    if (!allTunes || !champion?.themeTuneTitle) return 'D'

    // Normalise title to camelCase allTunes key
    const words = champion.themeTuneTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')   // strip punctuation inc. commas
        .trim()
        .split(/\s+/)
        .filter(Boolean)
    const key = words
        .map((w, i) => i === 0 ? w : w[0].toUpperCase() + w.slice(1))
        .join('')

    const abc = allTunes[key]
    if (!abc) {
        console.warn(`[VoiceSynth] tune not found for "${champion.themeTuneTitle}" (key: "${key}")`)
        return 'D'
    }

    const m = abc.match(/^K:\s*(.+)$/m)
    if (m) return m[1].trim()

    console.warn(`[VoiceSynth] no K: field in tune "${key}"`)
    return 'D'
}


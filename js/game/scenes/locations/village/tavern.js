// tavern.js
// Location: js/game/scenes/locations/village/tavern.js

import VillageScene from '../villageScene.js'
import { HarpPhrasePlayer, buildTimedPhraseFromDurations } from '../../../systems/music/harpPhrasePlayer.js'
import { abcToTimedStringSequence } from '../../../systems/music/abcToPhrase.js'
import { allTunes } from '../../../systems/music/allTunes.js'
import { BardAccompaniment } from '../../../systems/music/bardAccompaniment.js'
import { buildBardSequence } from '../../../systems/music/bardHarmonizer.js'
import { VoiceSynth, syllableCount } from '../../../systems/voice/voiceSynth.js'

// ── Bard text pacing ─────────────────────────────────────────────────
// A text line is no longer pinned 1:1 to a single musical group. Instead
// each line carries a NOTE BUDGET: gestures are played under the line
// until the budget runs out, then the text advances. This is what gives
// "several notes of the tune per line" rather than one pluck per line —
// without it the melody never gets a chance to be heard before the text
// turns over. Budget is spent per gesture by _bardGroupWeight:
//   single  → 1   (one melody note)
//   run(K)  → K   (K melody notes, in order)
//   chord   → 2   (one melody note but a full triad — weighted heavier
//                  so chord lines turn over in fewer plucks: "fewer
//                  notes per line when chords are involved")
// With a target of 3, lines land around 3-5 notes (runs can overflow a
// little, which is the "sometimes 4" variety). Tune freely.
const BARD_LINE_NOTE_TARGET = 3
// Breath between gestures WITHIN one text line — how long after
// completing a gesture the NEXT group's strings light. Short, because
// these are part of one musical phrase under one line; the long pause
// happens only at text boundaries (see READING_BEAT in _showBardLine).
// Roughly matches the gold fade-in so the next string eases in rather
// than snapping.
const BARD_FLOW_DELAY = 250

// ── Bard read-along voice ────────────────────────────────────────────
// The voice synth speaks each Irish line AS IT TYPES — a reading guide,
// the purpose voiceSynth.js was originally built for (it rode the
// character-bio typewriter the same way). It uses its own emotional
// contour derived from the line + the tune's modal key; it does NOT sing
// the harp melody (that's a separate, harder feature). One voicing per
// text line, started when the line begins typing.
//   BARD_VOICE_ENABLED — flip to false to silence it entirely (kept as a
//     single switch since this whole feature is experimental and the
//     voice may not suit every taste).
//   BARD_VOICE — 'ronnie' (male) suits the two old bards' bickering;
//     'peig' (female) is the alternative. Per-character voicing (narrator
//     vs Tigernach vs Dallán) is a future editorial layer, not done here.
//   BARD_VOICE_TUNE_KEY — the waltz's key, for the synth's pitch + the
//     modal-darkness input to its automatic emotion derivation.
const BARD_VOICE_ENABLED  = true
const BARD_VOICE          = 'ronnie'  // the deep gravelly storyteller voice (see voiceSynth VOICES)
const BARD_VOICE_TUNE_KEY = 'Ador'
// Stage-1 sing mode: the voice sings the actual waltz melody (one note per
// syllable, walked across the poem) instead of speaking on an invented
// contour. Flip to false for the plain spoken read-along (deep voice kept).
const BARD_SING           = true

// "The Pretty Girl Milking Her Cow" — K:Ador waltz, thesession.org —
// chosen for the bard-accompaniment mode (see design discussion). Lives
// here inline rather than in allTunes.js only because allTunes.js
// wasn't available to edit directly in this pass; move it alongside
// silverSpearThe/southWindThe there for consistency once convenient —
// nothing about how it's used here depends on where the string lives.
const PRETTY_GIRL_MILKING_HER_COW = `X: 1
T: The Pretty Girl Milking Her Cow
R: waltz
M: 3/4
L: 1/8
K: Ador
L:1/4
A/B/|cee/d/|Bdd/B/|A/B/G2-|G2A/B/|cee/d/|Bdd/B/|A3-|A>B A/B/|
cee/d/|Bgd/B/|A/B/G2-|G>f g/f/|e/d/ c/B/ A/G/|EA>B|A3-|A2:|A/B/|
cc/d/ e/f/|gg/e/ d/B/|A/B/G2-|G2A/B/|cc/d/ e/f/|geg|a3-|a>a b/a/|
gg/e/d/c/|d/g/ G/B/ d/B/|A/4B/4A/G2-|G>f g/f/|e/d/ c/B/ A/G/|EA>B|A3-|A2A/B/||
cc/d/ e/f/|gg/e/ d/B/|A/B/G2-|G2A/B/|cc/d/ e/f/|gc'>b|a3-|a>a b/a/|
gg/e/d/c/|d/g/ G/B/ d/B/|A/4B/4A/^G2-|^G>f g/f/|e/d/ c/B/ A/G/|EA>B|A3|A2||`

// Maebh/Táin poem content — full bilingual text. One couplet (one ga/en
// pair) per array entry. Lines are now paced by note-budget (see
// BARD_LINE_NOTE_TARGET above) rather than mapped 1:1 to musical groups,
// so the line index advances independently of the group index — driven
// straight from this array, cycling if the tune outlasts the poem.
const BARD_PLACEHOLDER_TEXT = [
  {
    en: "Then the hall was all uproar.",
    ga: "Le rírá agus rúille búille."
  },
  {
    en: "Ulster's poets rose up shouting",
    ga: "Sheas filí Uladh suas le béic"
  },
  {
    en: "Munster's poets rose up answering",
    ga: "Sheas filí na Mumhan mar freaga"
  },
  {
    en: "One man hit another sharply",
    ga: "Bhuail fear amháin fear eile go docht"
  },
  {
    en: "One man caught another's collar",
    ga: "Rug fear amháin ar gheansaí eile"
  },
  {
    en: "Tore the fine brooch from his shoulder",
    ga: "Ag straceadh dealg bhreá dá ghualainn"
  },
  {
    en: "Three harps fell and none would right them",
    ga: "Fágadh trí chruit áit ar thuit síad"
  },
  {
    en: "Hear me now, ye thick-skulled lords",
    ga: "Éistigí liom anois, a thiarnaí thiubh"
  },
  {
    en: "I am queen over Connacht's chieftains",
    ga: "Mise an bhanríon thar thaoisigh na Chonnachta"
  },
  {
    en: "My wars called men's quarrels",
    ga: "Mo cogaí tuighta mar achrann fear"
  },
  {
    en: "I who stood astride the chariot, reins in hand",
    ga: "Mise a sheas ard sa charbaid, úim sa lámh"
  },
  {
    en: "I Shall speak the truth",
    ga: "Inseoidh mise an fhírine"
  },
  {
    en: "Hear me now.",
    ga: "Chlois anois mé."
  }
];
export default class TavernScene extends VillageScene {
  constructor() { super({ key: 'tavern' }) }

  getMapKey()      { return 'tavern' }
  getAmbient()     { return 0x1a0e08 }
  getPlayerLight() { return { color: 0xffcc88, intensity: 2.2, radius: 280 } }
  getMusicTrack()  { return 'village_slow' }

  getWisps() {
    return [
      { rx: 6/20, ry: 1/12, color: 0xff6622, intensity: 1.8, radius: 220 }
    ]
  }

  onEnter() {
    this.time.delayedCall(800, () => {
      this.textPanel?.show({
        ga: 'Tá teas ann. Tá fuaim ann. Tá daoine ann.',
        en: 'There is warmth. There is sound. There are people.',
        type: 'notification',
      })
    })
  }

  _onJoystickTap() {
    const now = Date.now()
    if (now - (this._lastJoyTap || 0) < 700) return
    this._lastJoyTap = now

    const card = this._encounterPanel?._card
    if (card?._isHarp) {
      this._encounterPanel.clearNotify()
      this._openHarpOverlay()
      return
    }

    if (card?._isDoor) {
      this._triggerDoor(card._door)
      return
    }

    if (card?._isNPC) {
      this._encounterPanel.clearNotify()
      this._talkToNPCVillage(card._npc)
      return
    }

    super._onJoystickTap()
  }

  // ── Override: hook the phrase player onto the harp once it's open ──────
  _openHarpOverlay() {
    super._openHarpOverlay()
    this._corraHarp?.on('ready', () => {
      this._addDemoButton()
      this._addBardModeButton()
      this._startTainPhrase()
    })
  }

  // TEST UI: a small "hear it" button so you can listen to the tune
  // played exactly correctly, independent of your own timing/aim — useful
  // both as a preview and as a sanity check when something sounds off
  // (tells you whether the problem is the tune data or just difficulty).
  // Plain DOM, appended straight to the harp's overlay element — this is
  // dev/test scaffolding alongside the rest of _startTainPhrase, not a
  // permanent part of CorraHarp's own UI.
  _addDemoButton() {
    const overlay = this._corraHarp?._overlay
    if (!overlay || this._demoBtn) return
    const btn = document.createElement('button')
    btn.textContent = '▶ demo'
    btn.style.cssText = [
      'position:absolute;bottom:18px;left:50%;transform:translateX(-50%);',
      'background:rgba(20,14,8,0.55);border:1px solid rgba(200,190,170,0.35);',
      'color:rgba(220,210,190,0.85);font-size:0.75rem;letter-spacing:0.05em;',
      'padding:6px 16px;border-radius:14px;cursor:pointer;',
      'font-family:Georgia,serif;z-index:10;touch-action:none;',
    ].join('')
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this._startDemoPlayback()
    })
    overlay.appendChild(btn)
    this._demoBtn = btn
  }

  // TEST UI: a second small button to switch into the bard-accompaniment
  // mode — player-paced chord/run strumming that reveals story text,
  // as opposed to the timed orb rhythm-game. Plain DOM, same scaffolding
  // spirit as _addDemoButton; positioned to the side of it rather than
  // overlapping.
  _addBardModeButton() {
    const overlay = this._corraHarp?._overlay
    if (!overlay || this._bardBtn) return
    const btn = document.createElement('button')
    btn.textContent = '🎙 bard'
    btn.style.cssText = [
      'position:absolute;bottom:18px;left:50%;transform:translateX(72px);',
      'background:rgba(20,14,8,0.55);border:1px solid rgba(200,190,170,0.35);',
      'color:rgba(220,210,190,0.85);font-size:0.75rem;letter-spacing:0.05em;',
      'padding:6px 16px;border-radius:14px;cursor:pointer;',
      'font-family:Georgia,serif;z-index:10;touch-action:none;',
    ].join('')
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this._startBardAccompaniment()
    })
    overlay.appendChild(btn)
    this._bardBtn = btn
  }

  // Builds the Phrase data for the current TUNE_KEY — shared by both the
  // real playable rhythm-game (_startTainPhrase) and the exact-playback
  // demo (_startDemoPlayback), so they're always playing identical notes.
  _buildTainPhrase() {
    const harp = this._corraHarp
    const TUNE_KEY = 'silverSpearThe'   // or 'southWindThe'

    const range = harp.getMidiRange()
    const { indices, durations, sharps, accents, ornaments } = abcToTimedStringSequence(
      allTunes[TUNE_KEY], harp, range
    )

    console.log('[TavernScene] phrase —', TUNE_KEY, 'note count:', indices.length)
    console.log('[TavernScene] string indices:', indices)
    console.log('[TavernScene] durations:', durations)
    console.log('[TavernScene] sharps:', sharps)
    console.log('[TavernScene] accents:', accents)
    console.log('[TavernScene] ornaments:', ornaments.filter(Boolean).length, 'flourish beats out of', ornaments.length)

    const unitMs = 600  // half the previous tempo (was 300) — the tune was
                         // genuinely too fast to play along with at full
                         // speed. Easy to retune again; this is the single
                         // knob that controls overall playback speed.
    const phrase = buildTimedPhraseFromDurations(indices, durations, {
      unitMs,
      // travelMs history: 1800 (way too slow) -> several retuning passes
      // as bugs got fixed (lilt wobble, triplet duration, wrongly-merged
      // repeated notes, ornament collapsing) -> 350 at full tempo. Now
      // that the WHOLE TUNE plays at half speed (unitMs 300->600, per
      // explicit request — it was too fast to play along with), there's
      // much more breathing room: 460ms gives a longer, more readable
      // flight AND zero same-string overlap (verified against the real
      // tune), versus 350 which also hits zero but with less margin
      // before the next tempo/lilt tweak reopens it. Re-measure if
      // unitMs, lilt, or the tune changes — overlap creeps back in
      // starting around travelMs=600 at this tempo.
      travelMs:     460,
      windowMs:     420,   // forgiveness window around exact arrival
      startDelayMs: 1200,  // grace period before first orb arrives
      sharps,
      accents,
      ornaments,
      // A gentle, deterministic timing wobble (see buildTimedPhraseFromDurations
      // header) so notes don't land on a perfectly rigid grid — that
      // rigidity, combined with every note being struck at identical
      // volume, was the main reason the tune sounded "mechanical" rather
      // than played. 0.5 is a SUBTLE amount, not full swing — raise
      // toward 1 if it should feel more pronounced, or back to 0 for a
      // perfectly metronomic reference. windowMs (420) already comfortably
      // covers the resulting wobble for real play.
      lilt: 0.5,
    })
    return { phrase, unitMs }
  }

  // Builds the musical BardSequence (groups only — text is paced
  // separately now, see _startBardAccompaniment / BARD_LINE_NOTE_TARGET).
  // Separate from _buildTainPhrase since this mode needs no
  // atMs/travelMs/windowMs scheduling at all — see bardAccompaniment.js's
  // file header for why that's a different engine entirely.
  _buildBardSequence() {
    const harp = this._corraHarp
    const range = harp.getMidiRange()
    const groups = buildBardSequence(PRETTY_GIRL_MILKING_HER_COW, range)
    console.log('[TavernScene] bard sequence — group count:', groups.length,
      '(chord:', groups.filter(g => !g.ordered && g.strings.length > 1).length,
      'run:', groups.filter(g => g.ordered).length,
      'single:', groups.filter(g => g.strings.length === 1).length, ')')
    return groups
  }

  // Build the per-note melodic line the bard voice sings (stage-1 sing
  // mode). Returns semitone offsets from the tune's tonic, one per melody
  // note, walked continuously across text lines via _bardMelodyCursor so
  // the voice traverses the actual waltz over the poem (independent of the
  // player's plucks — that harp-sync was the declined stage 2). Tonic is A
  // (pitch class 9) because the tune is K:Ador; update if the key changes.
  _buildBardMelodyOffsets() {
    const harp = this._corraHarp
    const range = harp.getMidiRange()
    const { indices, sharps } = abcToTimedStringSequence(PRETTY_GIRL_MILKING_HER_COW, null, range)
    const byIdx = new Map(range.available.map(e => [e.idx, e]))
    const midis = indices
      .map((idx, i) => {
        const e = byIdx.get(idx)
        if (!e) return null
        return (sharps[i] && e.sharpM !== undefined) ? e.sharpM : e.m
      })
      .filter(m => m != null)
    if (!midis.length) return [0]
    // Anchor offsets to the A nearest the melody's average pitch, so the
    // sung contour sits centred on the voice's root rather than an octave off.
    const avg = midis.reduce((a, b) => a + b, 0) / midis.length
    let anchor = Math.round(avg)
    while ((((anchor % 12) + 12) % 12) !== 9) anchor--   // walk down to an A
    return midis.map(m => m - anchor)
  }

  // How much of a text line's note-budget one completed gesture spends.
  // See BARD_LINE_NOTE_TARGET for the rationale on the chord weighting.
  _bardGroupWeight(group) {
    if (!group) return 1
    if (group.ordered) return group.strings.length   // run — K melody notes
    if (group.strings.length > 1) return 2            // chord — weighted heavier
    return 1                                          // single
  }

  // Lazily create the read-along voice synth on first use. Lets the synth
  // create its own AudioContext (we don't have a handle on the game's
  // here) — the bard button tap is a user gesture, so speak()'s own
  // resume() can start it under autoplay policy. Wrapped in try/catch so a
  // synth failure (no Web Audio, etc.) silently disables the voice rather
  // than breaking bard mode. Returns null when disabled or unavailable.
  _ensureBardVoice() {
    if (!BARD_VOICE_ENABLED) return null
    if (this._bardVoice !== undefined) return this._bardVoice
    try {
      this._bardVoice = new VoiceSynth({ volume: 0.6 })
    } catch (e) {
      console.warn('[Táin/bard] voice synth unavailable:', e)
      this._bardVoice = null
    }
    return this._bardVoice
  }

  // Speak one line's Irish text. speak() interrupts any line already in
  // progress (its player.stop() runs first), so a fast player advancing
  // lines cleanly cuts the previous voicing rather than overlapping.
  _speakBardLine(line) {
    if (!line?.ga) return
    const v = this._ensureBardVoice()
    if (!v) return
    const opts = { voice: BARD_VOICE, tuneKey: BARD_VOICE_TUNE_KEY }
    // Sing mode: hand the synth the next run of melody notes (one per
    // syllable), advancing the cursor so the tune progresses line to line.
    if (BARD_SING && this._bardMelodyOffsets?.length) {
      const n = Math.max(1, syllableCount(line.ga))
      const offs = []
      for (let i = 0; i < n; i++) {
        offs.push(this._bardMelodyOffsets[(this._bardMelodyCursor + i) % this._bardMelodyOffsets.length])
      }
      this._bardMelodyCursor = (this._bardMelodyCursor + n) % this._bardMelodyOffsets.length
      opts.melodyOffsets = offs
    }
    v.speak(line.ga, opts)
  }

  // ── Bard accompaniment mode ─────────────────────────────────────────
  // Player-paced: strings light up, the player plucks them (any order
  // for a chord, in sequence for a run — see bardAccompaniment.js), and
  // the story text advances as gestures are played. No clock, no score,
  // no miss — see bardAccompaniment.js's file header for the full
  // reasoning on why this is a separate engine.
  //
  // Text display: pinned in the top third of the screen, composited
  // ABOVE the harp overlay (z-index beats the overlay's so the text sits
  // over the strings). The Irish line TYPES IN one glyph at a time
  // (matching characterModal.js's bio typewriter); the English gloss
  // fades in softly under it once the Irish finishes. The replaced line
  // drifts upward and fades out, "smoke-like." No background box — the
  // per-glyph glow and the English's dark backing stroke carry
  // legibility on their own.
  //
  // PACING + GATING: a text line is NOT one musical group. Each line
  // carries a note-budget (BARD_LINE_NOTE_TARGET) spent down by
  // _bardGroupWeight per completed gesture. WITHIN a line (budget not
  // yet spent), the next group's strings light after a short breath
  // (BARD_FLOW_DELAY) so the tune flows as a little phrase under the
  // text. When the budget runs out the line ADVANCES, and the gate is
  // held (via the bard engine's gateLighting) until the new line's Irish
  // has finished typing plus a reading beat — so a fast player can't
  // blow past a line they haven't read. Both the within-line release and
  // the boundary release go through bardPlayer.readyForNextGroup().
  //
  // Each line gets its OWN element in a shared GRID container; every line
  // is pinned to the same grid cell (grid-area:1/1) so incoming and
  // outgoing lines share a constant width and the outgoing line doesn't
  // reflow as it floats up.
  _ensureBardTextContainer() {
    if (this._bardTextContainer) return this._bardTextContainer
    const el = document.createElement('div')
    el.style.cssText = [
      'position:fixed;left:50%;top:14%;transform:translateX(-50%);',
      'width:88%;max-width:580px;text-align:center;',
      // Above the harp overlay (which is z-index:2000000) so the text
      // composites over the strings rather than behind them.
      'pointer-events:none;z-index:2000001;',
      // CSS grid so every line stacks into one cell at a constant width —
      // keeps the outgoing line from reflowing as it floats.
      'display:grid;',
      // No background box — just the text. A little padding so the grid
      // cell has breathing room; the glow bleeds beyond it freely since
      // the container doesn't clip overflow.
      'padding:4px;',
    ].join('')
    document.body.appendChild(el)
    this._bardTextContainer = el
    return el
  }

  // Inject the per-glyph reveal keyframe once. Each typed character gets
  // its own <span> animating with this, the same shape characterModal.js
  // uses for its Irish-bio typewriter (a small rise + fade-in per letter).
  _ensureBardKeyframes() {
    if (document.getElementById('bard-kf')) return
    const s = document.createElement('style')
    s.id = 'bard-kf'
    s.textContent = '@keyframes bardLetterIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}'
    document.head.appendChild(s)
  }

  _destroyBardTextEl() {
    // Kill any in-flight typewriter / gate-release / voice jobs so a
    // teardown mid-type doesn't leave a dangling timer appending glyphs to
    // a removed element, releasing a gate on a stopped player, or speaking
    // a line that's gone. Stops the voice but keeps the synth instance
    // (and its AudioContext) for reuse — full disposal is in
    // _destroyHarpOverlay.
    clearTimeout(this._bardTypeTimer)
    clearTimeout(this._bardGateTimer)
    clearTimeout(this._bardVoiceTimer)
    this._bardTypeTimer = null
    this._bardGateTimer = null
    this._bardVoiceTimer = null
    this._bardVoice?.stop?.()
    this._bardTextContainer?.remove()
    this._bardTextContainer = null
    this._bardCurrentLineEl = null
  }

  _showBardLine(line) {
    if (!line) return
    const container = this._ensureBardTextContainer()
    this._ensureBardKeyframes()

    // The line currently on screen (if any) becomes the OUTGOING line —
    // let it drift upward and fade out slowly, "smoke-like," rather than
    // removing it immediately. It removes itself from the DOM once its
    // own transition finishes. No position change — grid keeps it
    // stacked at a constant width, so it doesn't reflow as it floats.
    const outgoing = this._bardCurrentLineEl
    if (outgoing) {
      outgoing.style.transition = 'opacity 1400ms ease-in, transform 1400ms ease-in'
      outgoing.style.opacity = '0'
      outgoing.style.transform = 'translateY(-46px)'
      setTimeout(() => outgoing.remove(), 1500)
    }

    // The new line shares the same grid cell as the outgoing one.
    const wrap = document.createElement('div')
    wrap.style.cssText = [
      'grid-area:1/1;opacity:0;transform:translateY(0);',
      'transition:opacity 450ms ease-out;',
    ].join('')

    const ga = document.createElement('div')
    ga.style.cssText = [
      // Pure white fill — against a dim, warm-toned tavern scene, pure
      // white reads as categorically brighter than anything else.
      'font-family:Urchlo,serif;font-size:1.85rem;color:#ffffff;',
      // Strong multi-layer glow + near-solid dark backing stroke close
      // to the glyph edges, for legibility against busy/bright scene
      // content without the backing reading as a flat outline — this is
      // what lets us drop the background box entirely.
      'text-shadow:',
      '0 0 2px rgba(0,0,0,0.95),',
      '0 0 5px rgba(0,0,0,0.85),',
      '0 0 10px rgba(255,221,140,1),',
      '0 0 20px rgba(255,200,90,0.95),',
      '0 0 38px rgba(255,180,60,0.85),',
      '0 0 64px rgba(255,160,40,0.6);',
      'line-height:1.4;font-weight:700;',
      // Reserve the first line's height before any glyphs exist, so the
      // English gloss doesn't sit jammed under an empty box and then get
      // shoved down as the Irish types in.
      'min-height:1.4em;',
      // Left-aligned so the Irish grows rightward like a real typewriter
      // (centred would drift left as each glyph lands).
      'text-align:left;',
    ].join('')

    const en = document.createElement('div')
    en.textContent = line.en || ''
    en.style.cssText = [
      'font-family:"Courier New",monospace;font-size:1.2rem;color:#d8f0d8;',
      'text-shadow:0 0 2px rgba(0,0,0,0.9),0 0 6px rgba(0,0,0,0.7),0 0 12px rgba(170,220,170,0.7),0 0 22px rgba(150,210,150,0.45);',
      'line-height:1.3;margin-top:10px;font-weight:500;',
      // English starts invisible and fades in only after the Irish has
      // finished typing — keeps the Irish as the hero line.
      'opacity:0;transition:opacity 500ms ease-out;',
    ].join('')

    wrap.appendChild(ga)
    wrap.appendChild(en)
    container.appendChild(wrap)
    this._bardCurrentLineEl = wrap

    // The wrap becomes visible (glyphs animate individually below); HOLD
    // gives the outgoing line a beat to start clearing before this one
    // arrives, so they don't both sit bright at once.
    const HOLD = 1750, CHAR_MS = 52, READING_BEAT = 200
    setTimeout(() => { wrap.style.opacity = '1' }, HOLD)

    // Read-along voice: speak the Irish line when it begins typing, so
    // voice and text appear together (both run ~2-3s, close enough for a
    // reading guide). Tracked + cleared so a fast advance cancels a
    // pending speak before it fires on a now-outgoing line.
    clearTimeout(this._bardVoiceTimer)
    this._bardVoiceTimer = setTimeout(() => this._speakBardLine(line), HOLD)

    // Type the Irish one glyph at a time, then fade the English under it
    // and — after a reading beat — release the engine's lighting gate so
    // the NEXT line's first group lights (this is the text-BOUNDARY
    // release; within-line releases happen in onGroupComplete). Cancel
    // any in-flight jobs first so a teardown/restart can't leave timers
    // appending glyphs to a removed element or releasing a gate on a
    // stopped player.
    clearTimeout(this._bardTypeTimer)
    clearTimeout(this._bardGateTimer)
    const text = line.ga || ''
    // Split into [word, space, word, ...] (keeping separators) so each
    // WORD stays un-breakable while spaces remain line-break points —
    // typing bare inline-block glyphs let the line-breaker split words
    // mid-glyph (e.g. "bhróna" / "ch").
    const tokens = text.split(/(\s+)/)
    let ti = 0, ci = 0
    let wordSpan = null   // current nowrap word container being filled
    const typeNext = () => {
      // Skip empty tokens (split can yield ''), then we're done.
      while (ti < tokens.length && tokens[ti] === '') ti++
      if (ti >= tokens.length) {
        // Irish finished: fade English in shortly after, then release
        // the gate after the reading beat so the next line's strings light.
        setTimeout(() => { en.style.opacity = '1' }, 400)
        this._bardGateTimer = setTimeout(() => {
          this._bardPlayer?.readyForNextGroup()
        }, READING_BEAT)
        return
      }
      const token = tokens[ti]
      if (/^\s+$/.test(token)) {
        // Whitespace run: emit as one breakable span (a legal line-break
        // point, so NOT inside a nowrap word). pre-wrap preserves the
        // space AND allows a wrap here.
        const sp = document.createElement('span')
        sp.textContent = token
        sp.style.whiteSpace = 'pre-wrap'
        ga.appendChild(sp)
        ti++; ci = 0; wordSpan = null
        this._bardTypeTimer = setTimeout(typeNext, CHAR_MS)
        return
      }
      // Start a new nowrap word container on the first glyph of a word.
      if (ci === 0) {
        wordSpan = document.createElement('span')
        wordSpan.style.whiteSpace = 'nowrap'
        ga.appendChild(wordSpan)
      }
      const span = document.createElement('span')
      span.textContent = token[ci]
      span.style.cssText = 'display:inline-block;opacity:0;animation:bardLetterIn 300ms ease both;'
      wordSpan.appendChild(span)
      ci++
      if (ci >= token.length) { ti++; ci = 0; wordSpan = null }
      this._bardTypeTimer = setTimeout(typeNext, CHAR_MS)
    }
    this._bardTypeTimer = setTimeout(typeNext, HOLD)
  }

  _startBardAccompaniment() {
    const harp = this._corraHarp
    if (!harp) return

    // Stop whichever orb-game player might be running — both modes
    // drive the same CorraHarp instance's sharp/ornament hints and
    // 'pluck' listener, and only one should be active at a time.
    this._phrasePlayer?.stop()
    this._phrasePlayer = null
    this._demoPlayer?.stop()
    this._demoPlayer = null
    this._bardPlayer?.stop()
    this._destroyBardTextEl()

    const sequence = this._buildBardSequence()
    if (!sequence.length) return

    // Text pacing state: line index into BARD_PLACEHOLDER_TEXT and the
    // remaining note-budget for the current line. Driven independently
    // of the group index now (see BARD_LINE_NOTE_TARGET).
    this._bardLineIdx    = 0
    this._bardLineBudget = BARD_LINE_NOTE_TARGET

    // Melodic line + cursor for sing mode (null/unused when BARD_SING is off).
    this._bardMelodyOffsets = (BARD_SING && BARD_VOICE_ENABLED) ? this._buildBardMelodyOffsets() : null
    this._bardMelodyCursor  = 0

    // Show the FIRST line immediately, before any plucking — per design.
    // With gateLighting on, the first group's strings won't light until
    // this line's typewriter finishes and releases the gate.
    this._showBardLine(BARD_PLACEHOLDER_TEXT[0])

    this._bardPlayer = new BardAccompaniment(harp, sequence, {
      gateLighting: true,   // hold each group's lights/interactivity
                            // until we release via readyForNextGroup
      onGroupComplete: (group, idx) => {
        // Spend this gesture's weight from the current line's budget.
        this._bardLineBudget -= this._bardGroupWeight(group)

        if (this._bardLineBudget > 0) {
          // Still within the current line — keep the tune flowing: light
          // the next group's strings after a short breath, WITHOUT
          // advancing the text. (readyForNextGroup is a no-op until the
          // engine has actually advanced + gated, which it does right
          // after this callback returns; the delay clears that ordering.)
          clearTimeout(this._bardGateTimer)
          this._bardGateTimer = setTimeout(() => {
            this._bardPlayer?.readyForNextGroup()
          }, BARD_FLOW_DELAY)
        } else {
          // Budget spent — advance to the next text line and gate until
          // it's been read (the typewriter completion in _showBardLine
          // releases the gate). Cycle the poem if the tune outlasts it.
          this._bardLineIdx++
          this._bardLineBudget = BARD_LINE_NOTE_TARGET
          const nextLine = BARD_PLACEHOLDER_TEXT[this._bardLineIdx % BARD_PLACEHOLDER_TEXT.length]
          this._showBardLine(nextLine)
        }
      },
      onSequenceComplete: () => {
        console.log('[Táin/bard] sequence complete')
        this._showBardLine({ ga: 'Tá an scéal críochnaithe.', en: 'The tale is finished.' })
      },
    })
    this._bardPlayer.start()
  }

  // ── TEST: play a full tune, missile-command style ─────────────────────
  // The whole tune is scheduled up front on a master clock. Orbs launch
  // and arrive at a centred hit-line at the tune's actual rhythm. Missing
  // a note doesn't stop anything — the tune just keeps playing, like a
  // real tune would.
  //
  // Two test tunes are available:
  //   - South Wind, The   — Gmaj, no accidentals at all, 3/4.
  //   - Silver Spear, The — Dmaj reel, 4/4 (per thesession.org source —
  //                          NOT 3/4, an earlier wrong assumption is fixed
  //                          below). Every F needs to sound as F#, and
  //                          nothing else in the tune needs an accidental
  //                          (verified by inspection — no C/c appears in
  //                          its body at all). Sharps are automatic now
  //                          (see corraHarp.js / harpPhrasePlayer.js), so
  //                          this just plays correctly with no player
  //                          toggle to manage.
  // Swap TUNE_KEY in _buildTainPhrase() above to switch which one plays.
  _startTainPhrase() {
    const harp = this._corraHarp
    if (!harp) return

    this._phrasePlayer?.stop()
    const { phrase, unitMs } = this._buildTainPhrase()

    this._phrasePlayer = new HarpPhrasePlayer(harp, phrase, {
      hitLineFrac: 0.5,   // centre of screen
      tempoMs: unitMs,    // scales ornament flourish timing — see corraHarp.js setTempoMs
      // Bodhrán click every quarter-note-equivalent (4 ABC duration-units
      // at L:1/8 is one quarter note) — gives a steady felt pulse under
      // the tune, independent of the note orbs themselves.
      bodhranBeatMs: unitMs * 4,
      // Silver Spear is 4/4 (per its M: field) — accent every 4th click,
      // not 3rd. (3 was a wrong leftover assumption from when only the
      // 3/4 South Wind had been checked; fix this back to 3 if you swap
      // TUNE_KEY to southWindThe.)
      bodhranAccentEvery: 4,
      onBeatResult: (i, { hit, accuracy }) => {
        console.log(`[Táin] beat ${i}: ${hit ? 'hit' : 'missed'}`, accuracy?.toFixed?.(2))
      },
      onPhraseComplete: (tally) => {
        console.log('[Táin] phrase complete — tally:', tally)
        this.textPanel?.show({
          ga: 'Tá an scéal críochnaithe.',
          en: 'The tale is finished.',
          type: 'notification',
        })
      },
    })
    this._phrasePlayer.start()
  }

  // ── TEST: exact playback, no rhythm-game involved ──────────────────────
  // Reuses HarpPhrasePlayer itself (autoPlay: true) instead of a separate
  // player class — this is the SAME draw loop, SAME orb visuals as real
  // play, just with every beat striking itself exactly on time instead of
  // waiting for player input. An earlier version used a separate no-orb
  // implementation; that was a mistake (it looked like orbs were broken)
  // and has been removed — see harpPhrasePlayer.js.
  //
  // Stops the real phrase player first so the two don't both drive harp
  // audio at once, and hands control back to a fresh _startTainPhrase()
  // once the demo finishes (no pause/resume mid-tune exists, so restarting
  // from the top is the simplest correct behaviour).
  _startDemoPlayback() {
    const harp = this._corraHarp
    if (!harp || this._demoPlayer) return

    this._phrasePlayer?.stop()
    this._phrasePlayer = null

    const { phrase, unitMs } = this._buildTainPhrase()
    this._demoPlayer = new HarpPhrasePlayer(harp, phrase, {
      hitLineFrac: 0.5,
      autoPlay: true,
      tempoMs: unitMs,
      bodhranBeatMs: unitMs * 4,
      bodhranAccentEvery: 4,
      onPhraseComplete: () => {
        this._demoPlayer = null
        this._startTainPhrase()   // hand control back to the real rhythm-game
      },
    })
    this._demoPlayer.start()
  }

  _destroyHarpOverlay() {
    this._phrasePlayer?.stop()
    this._phrasePlayer = null
    this._demoPlayer?.stop()
    this._demoPlayer = null
    this._bardPlayer?.stop()
    this._bardPlayer = null
    this._destroyBardTextEl()
    // Fully dispose the voice synth (closes its AudioContext if it owns
    // one). _destroyBardTextEl only stops playback; this releases the
    // instance so it isn't held across harp opens.
    this._bardVoice?.destroy?.()
    this._bardVoice = undefined
    this._demoBtn = null
    this._bardBtn = null
    super._destroyHarpOverlay()
  }
}


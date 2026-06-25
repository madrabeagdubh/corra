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
// IMPORTANT: one note-budget cycle still spans a full {ga,en} PAIR (one
// entry from this._tainPoem, fetched at runtime — see _fetchTainPoem),
// exactly as before — the fixed 4-slot text display (see _showBardLine)
// is purely a rendering/audio-pacing change *within* that same per-pair
// contract. onGroupComplete / _bardLineIdx / _bardLineBudget below are
// therefore unchanged.
const BARD_LINE_NOTE_TARGET = 3
// Breath between gestures WITHIN one text line — how long after
// completing a gesture the NEXT group's strings light. Short, because
// these are part of one musical phrase under one line; the long pause
// happens only at text boundaries (see READING_BEAT in _revealNextBardPairs).
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
//   BARD_SPEAKER_VOICE — per-character voicing, keyed by each tain.json
//     entry's `speaker` field. tigernach uses 'seanchai' (a lower,
//     firmer female-register narrator voice). muirenn uses 'peig' (the
//     original soft/warm female preset). forgall has his own preset —
//     anxious, reedy, stammering — rather than sharing 'ronnie' with the
//     narrator, which an earlier pass left him on by default. dallan and
//     maebh keep their own distinct presets — maebh's is bright,
//     melodic, and ethereal/ghostly (per explicit design call: in this
//     telling she's something like a ghost). Falls back to 'ronnie' for
//     any unrecognised/missing speaker tag, via _voiceForSpeaker.
//   BARD_SPEAKER_COLOR — per-character FILL colour for the Irish line.
//     Per explicit design call, the original fully-saturated per-speaker
//     colours (moss-green, amber, lavender, etc.) looked "muddy" as a
//     fill — the plain white fill was what actually looked good, with
//     its warm glow. So differentiation moved to the GLOW instead (see
//     BARD_SPEAKER_GLOW below); fills are now all subtle near-white
//     "chalk" tones — each nudged toward its character's hue family for
//     a little personality, but never far enough from white to look
//     muddy or hurt legibility. Falls back to plain white for any
//     unrecognised/missing speaker tag, via _colorForSpeaker.
//   BARD_SPEAKER_GLOW — per-character text-shadow GLOW colour for the
//     Irish line, replacing the single fixed warm-amber glow every
//     speaker used to share. Each entry is the 3 glow-layer colours
//     (innermost to outermost, matching the original layer/blur/alpha
//     structure) — the 2 dark backing-stroke layers stay fixed for
//     every speaker (pure legibility, not characterisation). Looked up
//     via _glowForSpeaker, which assembles the full text-shadow string;
//     falls back to the original warm-amber glow for any unrecognised/
//     missing speaker tag.
//   BARD_VOICE_TUNE_KEY — the waltz's key, for the synth's pitch + the
//     modal-darkness input to its automatic emotion derivation.
const BARD_VOICE_ENABLED  = true
const BARD_SPEAKER_VOICE = {
    narrator:  'ronnie',
    forgall:   'forgall',
    muirenn:   'peig',
    tigernach: 'seanchai',
    dallan:    'dallan',
    maebh:     'maebh',
}
// Subtle near-white "chalk" fills — each a few degrees warmer/cooler
// than pure white, in the direction of that speaker's glow family,
// never saturated enough to look tinted at a glance.
const BARD_SPEAKER_COLOR = {
    narrator:  '#fffaf0',   // warm chalk (matches the original amber-glow family)
    forgall:   '#f6f8ec',   // pale sallow chalk — anxious, slightly sickly undertone
    muirenn:   '#ebf2f5',   // silvery chalk
    tigernach: '#f0f8e8',   // mossy chalk
    dallan:    '#fff4e0',   // warm amber-chalk
    maebh:     '#fff0ee',   // pale rose-chalk — just enough warmth toward crimson to hint
                            // at her glow without the fill itself looking tinted/muddy
}
// The 3 glow layers (innermost → outermost), reusing the ORIGINAL
// amber glow's blur radii and alpha values exactly — only the hue
// changes per speaker, so every speaker's glow has the same shape/
// intensity "feel," just a different colour family.
const BARD_SPEAKER_GLOW = {
    narrator:  ['255,221,140', '255,200,90', '255,180,60'],   // original warm amber/gold
    forgall:   ['230,235,150', '210,220,110', '190,205,80'],  // pale, sickly yellow-green —
                                                                // anxious, distinct from
                                                                // tigernach's mossier green
    muirenn:   ['190,225,255', '150,205,255', '120,180,255'], // cool silvery-blue
    tigernach: ['190,230,160', '150,210,120', '120,190,90'],  // mossy green
    dallan:    ['255,190,150', '255,160,110', '255,130,70'],  // hotter amber/red — more "indignant"
    maebh:     ['230,90,90', '210,55,55', '170,30,35'],       // deep crimson — fierce
                                                                // battle-queen, replacing the
                                                                // earlier pale-violet ethereal
                                                                // glow that suited her OLD
                                                                // voice (now 'bird1') but not
                                                                // her current forceful one
}
const BARD_VOICE_TUNE_KEY = 'Ador'
// Stage-1 sing mode: the voice sings the actual waltz melody (one note per
// syllable, walked across the poem) instead of speaking on an invented
// contour. Flip to false for the plain spoken read-along (deep voice kept).
const BARD_SING           = true

// ── Bard text display pacing (fixed 3-slot layout) ───────────────────
// Gap between the Irish line finishing TYPING and the English gloss
// appearing. Short and fixed — NOT tied to estimated speech length.
// Tying it to speech duration meant the PREVIOUS pair's English was
// often still the one on screen when the NEXT Irish line started
// typing, which read as "this English is the translation of the new
// Irish" — exactly backwards. A short fixed beat after typing finishes
// keeps the English tightly bound to the Irish line it actually
// belongs to, regardless of how long that line's audio runs underneath.
const BARD_AUDIO_GAP_MS = 350
// How long the English gloss takes to fade fully in (must match the
// transition duration set on the English slot's own CSS — see
// _buildBardEnglishSlotEl). Pulled out as a named constant so the
// pacing logic below can wait for the fade to ACTUALLY finish before
// counting reading time, rather than the two drifting out of sync.
const BARD_EN_FADE_MS = 700
// Pause AFTER the English gloss has fully faded in, before the SECOND
// pair's Irish begins to type/speak, when one budget-exhaustion advances
// text by 2 pairs (see onGroupComplete). This is real reading time, not
// padding around the fade itself — onPairDone now fires only once the
// fade-in transition has genuinely completed (see _showBardLine), so
// this number is purely "how long should both lines sit fully visible
// before we move on." Raised from 900 to 1800: at 900, including the
// 700ms the fade itself was still consuming, the first pair's English
// was gone well before there was time to read both lines.
const BARD_PAIR_BREATH_MS = 1800

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

// Maebh/Táin poem content now lives externally at public/data/tain.json
// (one {en, ga} object per array entry, fetched at runtime — see
// _fetchTainPoem). Cached on this._tainPoem once loaded. NOTE: the entry
// "Hear me you who name me war-bringer" / "you who lay the slaughter at
// my door" has no corresponding Irish line in the source text it was
// drawn from — ga is null in the JSON rather than guessed. Fill in or
// remove in tain.json before shipping.

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

  // ── Hearth flame ─────────────────────────────────────────────────────────
  // Animated fire for the back-wall hearth: rising flame particles, a few
  // drifting embers, and a breathing amber glow that spills onto the floor.
  // Drawn straight onto the PGR canvas via onPGRDrawComplete -- chained in
  // FRONT of the NPC draw so the flame renders first (behind the NPCs, which is
  // correct for a back-wall hearth) -- and positioned every frame through
  // pgr._projectLogical so it stays locked to the hearth as the camera follows
  // the player. Tune via HEARTH_FLAME.
  static HEARTH_FLAME = {
    ROW_OFFSET:  2,   // tiles below the hearth building's y to the firebox
    GLOW_RADIUS: 30,   // glow radius in px at scale 1
    PARTICLES:   16,    // flame + ember population
  }

  createNPCs() {
    super.createNPCs()
    const prev = this.onPGRDrawComplete   // the NPC draw set by VillageScene
    this.onPGRDrawComplete = (ctx) => { this._drawHearthFlame(ctx); if (prev) prev(ctx) }
  }

  _ensureHearthAnchor() {
    if (this._hearthAnchor !== undefined) return this._hearthAnchor
    const b = (this.mapData?.buildings || []).find(x => x.id === 'hearth')
    if (!b) { this._hearthAnchor = null; return null }
    const F = TavernScene.HEARTH_FLAME
    this._hearthAnchor = {
      x: (b.x + (b.fw ?? 2) / 2) * this.tileSize,   // horizontal centre of the hearth
      y: (b.y + F.ROW_OFFSET) * this.tileSize,       // down into the firebox
    }
    return this._hearthAnchor
  }

  _drawHearthFlame(ctx) {
    const pgr = this.perspectiveGround
    if (!pgr || !pgr._projectLogical) return
    const anchor = this._ensureHearthAnchor()
    if (!anchor) return
    const proj = pgr._projectLogical(anchor.x, anchor.y)
    if (!proj) return
    const { screenX, screenY, scale } = proj
    const F = TavernScene.HEARTH_FLAME
    const now = performance.now()
    const dt = Math.min(now - (this._flameLastT || now), 64)
    this._flameLastT = now
    const unit = scale * pgr.tileDisplaySize     // on-screen px per tile at this depth
    if (!this._flameParticles) this._flameParticles = []
    const parts = this._flameParticles
    while (parts.length < F.PARTICLES) {
      const ember = Math.random() < 0.16
      parts.push({
        ox: (Math.random() - 0.5) * 0.30, oy: 0,
        vx: (Math.random() - 0.5) * 0.00020,
        vy: -(0.00075 + Math.random() * 0.00065) * (ember ? 0.6 : 1),
        life: 0, max: ember ? 1500 + Math.random() * 900 : 420 + Math.random() * 520,
        ember, seed: Math.random() * 6.28,
      })
    }
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    // Breathing glow.
    const flick = 0.78 + 0.14 * Math.sin(now * 0.013) + 0.08 * Math.sin(now * 0.041 + 1.3)
    const R = F.GLOW_RADIUS * scale * flick
    if (R > 1) {
      const g = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, R)
      g.addColorStop(0,    `rgba(255,180,90,${(0.30 * flick).toFixed(3)})`)
      g.addColorStop(0.45, `rgba(255,120,45,${(0.14 * flick).toFixed(3)})`)
      g.addColorStop(1,    'rgba(255,90,25,0)')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(screenX, screenY, R, 0, Math.PI * 2); ctx.fill()
    }
    // Particles: recycled in place to keep a constant population.
    for (const p of parts) {
      p.life += dt; p.ox += p.vx * dt; p.oy += p.vy * dt; p.vx *= 0.98
      if (p.life >= p.max) {
        p.life = 0; p.oy = 0; p.ox = (Math.random() - 0.5) * 0.30
        p.vy = -(0.00075 + Math.random() * 0.00065); continue
      }
      const t = p.life / p.max
      const px = screenX + p.ox * unit + Math.sin(now * 0.006 + p.seed) * unit * 0.04
      const py = screenY + p.oy * unit
      const fade = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85
      const a = Math.max(0, fade) * (p.ember ? 0.5 : 0.85)
      if (a < 0.02) continue
      let r, gg, b
      if (t < 0.4) { r = 255; gg = Math.round(220 - t * 180); b = Math.round(120 - t * 200) }
      else { r = Math.round(255 - (t - 0.4) * 110); gg = Math.round(110 - (t - 0.4) * 120); b = 30 }
      const size = (p.ember ? 0.05 : 0.12 * (1 - t * 0.6)) * unit
      if (size < 0.4) continue
      ctx.fillStyle = `rgba(${r},${Math.max(0, gg)},${Math.max(0, b)},${a.toFixed(3)})`
      ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
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
    // Start loading the poem now, as early as possible — well before the
    // player can reach the bard button — so it's already cached by the
    // time _startBardAccompaniment needs it. Fire-and-forget here
    // deliberately: _fetchTainPoem caches its own promise, so this is
    // just a head start, not something this call site needs to await.
    this._fetchTainPoem()
    this._corraHarp?.on('ready', () => {
      this._addDemoButton()
      this._addBardModeButton()
      this._startTainPhrase()
    })
  }

  // Fetches and caches the Táin poem from public/data/tain.json. Safe to
  // call multiple times — the underlying fetch only ever happens once;
  // subsequent calls return the SAME cached promise (whether still
  // pending or already resolved), so concurrent callers (e.g. the
  // fire-and-forget head-start in _openHarpOverlay racing a fast tap on
  // the bard button) never trigger duplicate network requests. Resolves
  // to an array of {en, ga} objects, or null on failure (logged, not
  // thrown) so a fetch error degrades to "bard mode silently can't
  // start" rather than an unhandled rejection breaking the harp overlay.
  _fetchTainPoem() {
    if (this._tainPoemPromise) return this._tainPoemPromise
    // Fetches as TEXT first (rather than res.json() directly) so a parse
    // failure can be diagnosed precisely — logging the actual length and
    // first/last characters received, plus the real JSON.parse error
    // message and the exact character index it failed at. The earlier
    // version used res.json() directly, which on failure only surfaces
    // an opaque "SyntaxError {}" with no detail about WHAT was actually
    // received — unhelpful for diagnosing a mismatch between a clean
    // file on disk/over curl and a failing in-app fetch. This is
    // temporary diagnostic instrumentation; safe to simplify back to a
    // plain res.json() once the actual cause is found.
    this._tainPoemPromise = fetch('/data/tain.json')
      .then(res => {
        if (!res.ok) throw new Error(`tain.json fetch failed: ${res.status}`)
        return res.text()
      })
      .then(text => {
        console.log('[Táin/bard] tain.json fetched — length:', text.length)
        console.log('[Táin/bard] first 20 chars:', JSON.stringify(text.slice(0, 20)))
        console.log('[Táin/bard] last 20 chars:', JSON.stringify(text.slice(-20)))
        try {
          const data = JSON.parse(text)
          this._tainPoem = data
          return data
        } catch (parseErr) {
          console.warn('[Táin/bard] JSON.parse failed:', parseErr.message)
          // Most JS engines include the failing character position in
          // the message (e.g. "...at position 1234") — extract it and
          // print the actual text around that point so the exact bad
          // byte/character is visible, not just its numeric offset.
          const m = parseErr.message.match(/position (\d+)/)
          if (m) {
            const pos = parseInt(m[1], 10)
            const start = Math.max(0, pos - 30)
            console.warn('[Táin/bard] context around failure position', pos, ':',
              JSON.stringify(text.slice(start, pos + 30)))
          }
          throw parseErr
        }
      })
      .catch(err => {
        console.warn('[Táin/bard] failed to load tain.json:', err)
        this._tainPoem = null
        return null
      })
    return this._tainPoemPromise
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

  // ── Bard text display: fixed 3-slot layout ─────────────────────────
  // Replaces an earlier 4-line dynamic scroll (Irish/English/Irish/
  // English, each independently pushed/retired) — that produced visible
  // jitter/flicker, because every push or retire was its own DOM
  // insertion/removal causing its own reflow, and with English arriving
  // on its own delay relative to Irish, these reflows landed staggered
  // and out of sync rather than as one coordinated step.
  //
  // Per explicit design call: the typical reader takes in the English
  // gloss at a glance and doesn't need it to linger once they've moved
  // on — so only the CURRENT pair needs a gloss at all. Layout is now
  // exactly 3 persistent DOM elements, never inserted/removed in the
  // steady state, just updated in place each time a new pair shows:
  //   [0] previous Irish  — the prior pair's Irish line, no gloss
  //   [1] current Irish   — this pair's Irish line, typed in
  //   [2] current English — this pair's gloss, fades in after the gap
  // Advancing to a new pair is one coordinated update: slot 1's old
  // content moves into slot 0 (a quick crossfade, not a DOM move),
  // slot 2 clears, then slot 1 gets the new Irish (typed) and slot 2
  // gets the new English (faded in after BARD_AUDIO_GAP_MS) — all 3
  // slots updating together rather than N independent elements each
  // animating on their own schedule.
  _ensureBardTextContainer() {
    if (this._bardTextContainer) return this._bardTextContainer
    const el = document.createElement('div')
    el.style.cssText = [
      'position:fixed;left:50%;top:14%;transform:translateX(-50%);',
      'width:88%;max-width:580px;text-align:left;',
      // Above the harp overlay (which is z-index:2000000) so the text
      // composites over the strings rather than behind them.
      'pointer-events:none;z-index:2000001;',
      'display:flex;flex-direction:column;gap:6px;',
      'padding:4px;',
    ].join('')
    document.body.appendChild(el)
    this._bardTextContainer = el

    // The 4 persistent slots, created once and reused for every cycle:
    // previous Irish (dim, no gloss), current Irish, English-A, English-B.
    // English now ACCUMULATES across a 2-pair cycle (per explicit design
    // call) rather than being cleared/replaced at every pair transition —
    // English-A stays put while Pair B plays out, and English-B appears
    // below it once Pair B's Irish finishes. Both clear together only at
    // the START of the next cycle (see _revealNextBardPairs), not at the
    // pair-A→pair-B handoff.
    this._bardPrevEl = this._buildBardIrishSlotEl()
    this._bardPrevEl.style.opacity = '0.55'   // demoted — quieter than current
    this._bardCurEl  = this._buildBardIrishSlotEl()
    this._bardEnAEl  = this._buildBardEnglishSlotEl()
    this._bardEnBEl  = this._buildBardEnglishSlotEl()
    el.appendChild(this._bardPrevEl)
    el.appendChild(this._bardCurEl)
    el.appendChild(this._bardEnAEl)
    el.appendChild(this._bardEnBEl)

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
    // Kill any in-flight typewriter / gate-release / English-reveal /
    // voice jobs so a teardown mid-sequence doesn't leave a dangling
    // timer touching a removed element, releasing a gate on a stopped
    // player, or speaking a line that's gone. Stops the voice but keeps
    // the synth instance (and its AudioContext) for reuse — full
    // disposal is in _destroyHarpOverlay.
    clearTimeout(this._bardTypeTimer)
    clearTimeout(this._bardGateTimer)
    clearTimeout(this._bardEnTimer)
    clearTimeout(this._bardEnDoneTimer)
    clearTimeout(this._bardPairBreathTimer)
    clearTimeout(this._bardPrevFadeTimer)
    this._bardTypeTimer = null
    this._bardGateTimer = null
    this._bardEnTimer   = null
    this._bardEnDoneTimer = null
    this._bardPairBreathTimer = null
    this._bardPrevFadeTimer = null
    this._bardVoice?.stop?.()
    this._bardTextContainer?.remove()
    this._bardTextContainer = null
    this._bardPrevEl = null
    this._bardCurEl  = null
    this._bardEnAEl  = null
    this._bardEnBEl  = null
    this._bardCurSpeaker = null
  }

  // Shared empty-shell builder for the two Irish-styled slots (previous
  // and current) — same glow/shadow/font treatment either way; only the
  // demoted opacity (set once on _bardPrevEl, see _ensureBardTextContainer)
  // and whether a slot's content is typed vs swapped instantly differ.
  _buildBardIrishSlotEl() {
    const ga = document.createElement('div')
    ga.style.cssText = [
      // Initial shell fill/glow — overwritten per-line by
      // _colorForSpeaker/_glowForSpeaker the moment the first real line
      // is shown (see startTypingNewLine in _showBardLine). These
      // starting values just mirror the narrator/default look so there's
      // no flash-of-wrong-color before that first write.
      'font-family:Urchlo,serif;font-size:1.85rem;color:#fffaf0;',
      // Strong multi-layer glow + near-solid dark backing stroke close to
      // the glyph edges, for legibility against busy/bright scene content
      // without the backing reading as a flat outline. The 2 dark layers
      // stay fixed across every speaker; only the glow hue (the 3 warm
      // layers here) changes per-line — see _glowForSpeaker.
      'text-shadow:',
      '0 0 2px rgba(0,0,0,0.95),',
      '0 0 5px rgba(0,0,0,0.85),',
      '0 0 10px rgba(255,221,140,1),',
      '0 0 20px rgba(255,200,90,0.95),',
      '0 0 38px rgba(255,180,60,0.85),',
      '0 0 64px rgba(255,160,40,0.6);',
      // Reserved height for up to 2 lines (1.4 line-height × 2 = 2.8em).
      // Same reasoning as the English slot's min-height fix: without a
      // fixed reservation, a longer Irish line wrapping to 2 lines where
      // the previous one was 1 line (or vice versa) changes this slot's
      // box height, which can ripple into the demote slide's distance
      // measurement landing slightly off. A constant height removes that
      // trigger regardless of how long any given poem line happens to be.
      'line-height:1.4;font-weight:700;min-height:2.8em;',
      'opacity:1;transition:opacity 300ms ease-out;',
    ].join('')
    return ga
  }

  _buildBardEnglishSlotEl() {
    const en = document.createElement('div')
    en.style.cssText = [
      'font-family:"Courier New",monospace;font-size:1.2rem;color:#d8f0d8;',
      'text-shadow:0 0 2px rgba(0,0,0,0.9),0 0 6px rgba(0,0,0,0.7),0 0 12px rgba(170,220,170,0.7),0 0 22px rgba(150,210,150,0.45);',
      'line-height:1.3;font-weight:500;',
      // Reserved height for up to 2 lines (1.3 line-height × 2 = 2.6em),
      // regardless of whether the current gloss text is short, long, or
      // empty. Without this, the slot's box height changed every time
      // its textContent was cleared/repopulated (going from "however
      // tall the previous English line was" down to near-zero, then back
      // up once new text arrived) — and even though this slot sits BELOW
      // both Irish slots in the flex column, that collapse/expand cycle
      // was the suspected source of the subtle Irish-line position jump
      // reported during the demote animation: a reflow ripple from this
      // slot's height changing, landing right as the measurement/slide
      // for the Irish slots above it was happening. Fixing the height to
      // a constant removes that reflow trigger entirely, regardless of
      // the exact mechanism.
      'min-height:2.6em;',
      `opacity:0;transition:opacity ${BARD_EN_FADE_MS}ms ease-out;`,
    ].join('')
    return en
  }

  // Types Irish text glyph-by-glyph into an ALREADY-EXISTING slot element
  // (rather than building a new element each time, per the fixed-slot
  // model). Clears any prior content first. Word-splitting (whitespace
  // as separate breakable spans, each word as one nowrap span) prevents
  // the line-breaker from splitting a word mid-glyph.
  _typeBardIrishInto(slotEl, gaText, onDone) {
    slotEl.textContent = ''
    const tokens = (gaText || '').split(/(\s+)/)
    let ti = 0, ci = 0, wordSpan = null
    const step = () => {
      while (ti < tokens.length && tokens[ti] === '') ti++
      if (ti >= tokens.length) { onDone?.(); return }
      const token = tokens[ti]
      if (/^\s+$/.test(token)) {
        const sp = document.createElement('span')
        sp.textContent = token
        sp.style.whiteSpace = 'pre-wrap'
        slotEl.appendChild(sp)
        ti++; ci = 0; wordSpan = null
        this._bardTypeTimer = setTimeout(step, 52)
        return
      }
      if (ci === 0) {
        wordSpan = document.createElement('span')
        wordSpan.style.whiteSpace = 'nowrap'
        slotEl.appendChild(wordSpan)
      }
      const span = document.createElement('span')
      span.textContent = token[ci]
      span.style.cssText = 'display:inline-block;opacity:0;animation:bardLetterIn 300ms ease both;'
      wordSpan.appendChild(span)
      ci++
      if (ci >= token.length) { ti++; ci = 0; wordSpan = null }
      this._bardTypeTimer = setTimeout(step, 52)
    }
    step()
  }

  // Speak one line's Irish text. speak() interrupts any line already in
  // progress (its player.stop() runs first), so a fast player advancing
  // lines cleanly cuts the previous voicing rather than overlapping.
  // `speaker` is the tain.json entry's speaker tag (narrator/forgall/
  // muirenn/tigernach/dallan/maebh) — looked up via _voiceForSpeaker to
  // pick the right voiceSynth preset; falls back to 'ronnie' for any
  // unrecognised or missing tag (e.g. the closing "Tá an scéal
  // críochnaithe" line, which has no speaker of its own).
  _speakBardLine(gaText, speaker) {
    if (!gaText) return
    const v = this._ensureBardVoice()
    if (!v) return
    const opts = { voice: this._voiceForSpeaker(speaker), tuneKey: BARD_VOICE_TUNE_KEY }
    // Sing mode: hand the synth the next run of melody notes (one per
    // syllable), advancing the cursor so the tune progresses line to line.
    if (BARD_SING && this._bardMelodyOffsets?.length) {
      const n = Math.max(1, syllableCount(gaText))
      const offs = []
      for (let i = 0; i < n; i++) {
        offs.push(this._bardMelodyOffsets[(this._bardMelodyCursor + i) % this._bardMelodyOffsets.length])
      }
      this._bardMelodyCursor = (this._bardMelodyCursor + n) % this._bardMelodyOffsets.length
      opts.melodyOffsets = offs
    }
    v.speak(gaText, opts)
  }

  // Looks up the voiceSynth preset for a tain.json speaker tag, falling
  // back to 'ronnie' if the tag is missing or unrecognised.
  _voiceForSpeaker(speaker) {
    return BARD_SPEAKER_VOICE[speaker] ?? 'ronnie'
  }

  // Looks up the Irish-line FILL colour for a tain.json speaker tag,
  // falling back to white if the tag is missing or unrecognised.
  _colorForSpeaker(speaker) {
    return BARD_SPEAKER_COLOR[speaker] ?? '#ffffff'
  }

  // Assembles the full text-shadow for a tain.json speaker tag: the 2
  // dark backing-stroke layers stay FIXED for every speaker (pure
  // legibility against busy scene content, not characterisation), while
  // the 3 glow layers take their hue from BARD_SPEAKER_GLOW — same blur
  // radii/alpha as the original single amber glow, just recoloured.
  // Falls back to the original warm-amber glow for any unrecognised/
  // missing speaker tag.
  _glowForSpeaker(speaker) {
    const [inner, mid, outer] = BARD_SPEAKER_GLOW[speaker] ?? ['255,221,140', '255,200,90', '255,180,60']
    return [
      '0 0 2px rgba(0,0,0,0.95)',
      '0 0 5px rgba(0,0,0,0.85)',
      `0 0 10px rgba(${inner},1)`,
      `0 0 20px rgba(${mid},0.95)`,
      `0 0 38px rgba(${outer},0.85)`,
      `0 0 64px rgba(${outer},0.6)`,
    ].join(',')
  }

  // Rough estimate of how long a spoken line takes. Currently UNUSED
  // (English reveal timing is a fixed beat after typing — see
  // BARD_AUDIO_GAP_MS) but kept in case speech-length-aware pacing is
  // wanted again later.
  _estimateSpeechMs(gaText) {
    const n = Math.max(1, syllableCount(gaText || ''))
    return Math.round(n * 290) + 200
  }

  // Advances the display to a new {ga,en} pair using the fixed 4-slot
  // layout (see _ensureBardTextContainer):
  //   1. Demote: the previous slot's OLD text fades out quickly, then
  //      the CURRENT slot's existing Irish text slides + fades down into
  //      the previous slot's row — a real, short vertical animation
  //      between the two fixed row positions (there are only ever 2
  //      coordinates involved here, current-row and previous-row, since
  //      this is a fixed-slot layout rather than an N-element list).
  //   2. Once the demote animation finishes, the current slot is typed
  //      with the NEW Irish text, spoken at the same moment typing
  //      begins.
  //   3. Once typing finishes, after BARD_AUDIO_GAP_MS the English text
  //      fades into `enSlot` — whichever of the two English slots the
  //      CALLER designates for this pair (English-A or English-B; see
  //      _revealNextBardPairs). Once that fade genuinely completes,
  //      onPairDone fires.
  // Per explicit design call, English now ACCUMULATES across a 2-pair
  // cycle: this method does NOT clear any English slot itself anymore —
  // an earlier version cleared "the" English slot at the top of every
  // call, which meant Pair A's gloss vanished the instant Pair B's Irish
  // started typing, so both glosses were never visible together. Clearing
  // is now the CALLER's responsibility, done once at the START of a
  // cycle (both slots at once) — see _revealNextBardPairs — not at each
  // individual pair handoff.
  //
  // This method also does NOT release the harp's lighting gate — same
  // reasoning as before: one harp budget-exhaustion reveals TWO pairs
  // back to back, so gate release must happen only once, after BOTH
  // pairs have finished — see _revealNextBardPairs.
  _showBardLine(line, enSlot, onPairDone) {
    if (!line) return
    this._ensureBardTextContainer()
    this._ensureBardKeyframes()

    const PREV_FADE_OUT_MS = 200   // old previous-line text fading away
    const DEMOTE_SLIDE_MS  = 320   // demoted line sliding+fading into place

    clearTimeout(this._bardTypeTimer)
    clearTimeout(this._bardEnTimer)
    clearTimeout(this._bardEnDoneTimer)
    clearTimeout(this._bardPrevFadeTimer)

    const outgoingGa      = this._bardCurEl.textContent
    const outgoingSpeaker = this._bardCurSpeaker
    const startTypingNewLine = () => {
      // Apply this pair's speaker fill colour AND glow to the CURRENT
      // slot before typing begins, and remember the speaker so a later
      // demote (when this line becomes the "previous" one) carries the
      // right look with it rather than defaulting back to the fallback.
      this._bardCurEl.style.color = this._colorForSpeaker(line.speaker)
      this._bardCurEl.style.textShadow = this._glowForSpeaker(line.speaker)
      this._bardCurSpeaker = line.speaker

      // Type the new Irish into the current slot, speaking it
      // concurrently (per explicit direction — heard while it's being
      // read, not after), in this line's speaker's voice.
      this._speakBardLine(line.ga, line.speaker)
      this._typeBardIrishInto(this._bardCurEl, line.ga || '', () => {
        this._bardEnTimer = setTimeout(() => {
          enSlot.textContent = line.en || ''
          void enSlot.offsetHeight
          requestAnimationFrame(() => {
            requestAnimationFrame(() => { enSlot.style.opacity = '1' })
          })
          this._bardEnDoneTimer = setTimeout(() => {
            onPairDone?.()
          }, BARD_EN_FADE_MS)
        }, BARD_AUDIO_GAP_MS)
      })
    }

    if (!outgoingGa) {
      // Nothing to demote (e.g. the very first pair) — go straight to
      // typing the new line, no animation needed.
      startTypingNewLine()
      return
    }

    // Step 1: fade out whatever's currently sitting in the previous
    // slot, so the slide-in below isn't competing with old leftover text.
    this._bardPrevEl.style.transition = `opacity ${PREV_FADE_OUT_MS}ms ease-in`
    this._bardPrevEl.style.opacity = '0'
    this._bardPrevFadeTimer = setTimeout(() => {
      // Step 2: set the demoted text (and ITS speaker's fill+glow — not
      // the new line's) into the previous slot FIRST, so its box
      // reflects the REAL height of the incoming content before we
      // measure anything — see header comment history on this exact
      // sequencing for why order matters here.
      this._bardPrevEl.style.transition = 'none'
      this._bardPrevEl.style.color = this._colorForSpeaker(outgoingSpeaker)
      this._bardPrevEl.style.textShadow = this._glowForSpeaker(outgoingSpeaker)
      this._bardPrevEl.textContent = outgoingGa
      this._bardPrevEl.style.opacity = '0'

      const curRect  = this._bardCurEl.getBoundingClientRect()
      const prevRect = this._bardPrevEl.getBoundingClientRect()
      const dy = curRect.top - prevRect.top   // negative: current sits above previous

      this._bardPrevEl.style.transform = `translateY(${dy}px)`
      void this._bardPrevEl.offsetHeight   // flush before re-enabling transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this._bardPrevEl.style.transition =
            `transform ${DEMOTE_SLIDE_MS}ms ease-out, opacity ${DEMOTE_SLIDE_MS}ms ease-out`
          this._bardPrevEl.style.transform = 'translateY(0)'
          this._bardPrevEl.style.opacity = '0.55'
        })
      })

      // Start typing the new current line once the demote slide is
      // under way — overlapping slightly with its tail end reads as one
      // continuous gesture rather than two fully sequential waits.
      setTimeout(startTypingNewLine, Math.round(DEMOTE_SLIDE_MS * 0.4))
    }, PREV_FADE_OUT_MS)
  }

  // Reveals the next TWO pairs of poem text, one after the other with a
  // breathing pause between their recitations (BARD_PAIR_BREATH_MS).
  // Called once per harp budget-exhaustion (see onGroupComplete in
  // _startBardAccompaniment) — including the FIRST exhaustion, which is
  // what makes text wait for the player's first pluck rather than
  // appearing immediately on mode-start.
  //
  // ENGLISH ACCUMULATION (per explicit design call): both pairs' English
  // glosses stay visible together for the WHOLE cycle — English-A fades
  // in after Pair A's Irish, then English-B fades in below it after Pair
  // B's Irish, and both remain on screen (along with both Irish lines)
  // until the player plucks again. Both English slots are therefore
  // cleared together ONCE, here, at the START of a new cycle — not at
  // the pair-A→pair-B handoff inside _showBardLine, which would erase
  // English-A the instant Pair B started typing.
  //
  // GATE RELEASE: fires exactly ONCE here, after pair B's onPairDone —
  // i.e. only once BOTH pairs of the cycle have fully recited.
  //
  // Index wrap uses ((n % len) + len) % len, NOT a plain n % len — with
  // _bardLineIdx starting at -2 (see _startBardAccompaniment), the first
  // call here increments it to -1, and JS's % preserves the sign of the
  // dividend (-1 % 47 === -1, not 46 like Python). A plain modulo here
  // indexed this._tainPoem[-1], which is undefined — and
  // _showBardLine(undefined, ...) hits its `if (!line) return` guard and
  // silently does nothing: exactly the "first pluck does nothing" bug.
  _bardWrapIdx(i) {
    const len = this._tainPoem.length
    return ((i % len) + len) % len
  }

  _revealNextBardPairs() {
    const READING_BEAT = 200

    // _showBardLine normally creates the slots on first use, but this
    // method touches _bardEnAEl/_bardEnBEl directly BEFORE ever calling
    // _showBardLine (to clear both at cycle-start) — on the very first
    // pluck, those slots don't exist yet (still null), so without this
    // call the forEach below throws "Cannot read properties of null
    // (reading 'style')" immediately after the first chord.
    this._ensureBardTextContainer()

    // Clear BOTH English slots once, at the start of this new cycle —
    // not per-pair. This is what makes English-A still be visible while
    // Pair B plays out, instead of vanishing the instant Pair B's Irish
    // starts typing.
    clearTimeout(this._bardEnTimer)
    clearTimeout(this._bardEnDoneTimer)
    ;[this._bardEnAEl, this._bardEnBEl].forEach(el => {
      el.style.transition = 'none'
      el.style.opacity = '0'
      el.textContent = ''
      void el.offsetHeight
      el.style.transition = `opacity ${BARD_EN_FADE_MS}ms ease-out`
    })

    this._bardLineIdx++
    const lineA = this._tainPoem[this._bardWrapIdx(this._bardLineIdx)]
    this._showBardLine(lineA, this._bardEnAEl, () => {
      clearTimeout(this._bardPairBreathTimer)
      this._bardPairBreathTimer = setTimeout(() => {
        this._bardLineIdx++
        // POEM-END DETECTION: _bardLineIdx only ever increments (it's
        // wrapped into a real array index via _bardWrapIdx, never reset
        // except at _startBardAccompaniment). Once it reaches the poem's
        // length, every line has now been shown exactly once across this
        // playthrough — per explicit design call, that's the point the
        // whole bard experience should end and hand control back to the
        // player, rather than wrapping around and reciting the poem
        // again. Checked here (after incrementing for pair B, the LAST
        // line shown in this cycle) rather than after pair A, since pair
        // B is always the later of the two lines in the cycle.
        const poemFinished = this._bardLineIdx >= this._tainPoem.length
        const lineB = this._tainPoem[this._bardWrapIdx(this._bardLineIdx)]
        this._showBardLine(lineB, this._bardEnBEl, () => {
          if (poemFinished) {
            // One full pass through the poem is complete — stop the
            // music/gating machinery and close the harp overlay entirely,
            // returning control to the player, rather than releasing the
            // gate for another pluck.
            console.log('[Táin/bard] poem complete — closing harp')
            clearTimeout(this._bardGateTimer)
            this._bardGateTimer = setTimeout(() => {
              this._bardPlayer?.stop()
              this._corraHarp?.close()
            }, READING_BEAT)
            return
          }
          // Pair B has now fully finished too — release the gate after
          // one short reading beat, same beat duration as before.
          clearTimeout(this._bardGateTimer)
          this._bardGateTimer = setTimeout(() => {
            this._bardPlayer?.readyForNextGroup()
          }, READING_BEAT)
        })
      }, BARD_PAIR_BREATH_MS)
    })
  }

  async _startBardAccompaniment() {
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

    // The poem fetch is normally already resolved by now — it's kicked
    // off as soon as the harp overlay opens (see _openHarpOverlay), well
    // before the player can reach the bard button — but awaiting here
    // too means this method is correct even if bard mode is somehow
    // entered before that fetch settles (e.g. a very fast tap, or the
    // fetch being slow on a poor connection). _fetchTainPoem caches its
    // result/promise, so this is a no-op await once already loaded.
    this._tainPoem = await this._fetchTainPoem()
    if (!this._tainPoem?.length) {
      console.warn('[Táin/bard] poem failed to load — aborting bard mode')
      return
    }

    const sequence = this._buildBardSequence()
    if (!sequence.length) return

    // Text pacing state: line index into this._tainPoem and the
    // remaining note-budget for the current line. Driven independently
    // of the group index (see BARD_LINE_NOTE_TARGET). Started at -1 (not
    // 0) and with budget pre-exhausted (0, not BARD_LINE_NOTE_TARGET) so
    // that NOTHING is shown until the player's first pluck resolves a
    // gesture — the first onGroupComplete call below sees budget already
    // <= 0 and immediately runs the same "reveal 2 pairs" path every
    // later exhaustion uses. _revealNextBardPairs increments BEFORE
    // indexing, so starting at -1 makes the first two reveals land on
    // indices 0 and 1, as intended (starting at -2 was tried first and
    // was wrong: -1 wraps via _bardWrapIdx to the LAST poem entry, not
    // 0, since the increment happens before the wrap — verified by
    // direct calculation, not assumed). This replaces an earlier version
    // that showed the very first pair eagerly at start() — that
    // pre-pluck reveal was inconsistent with every later reveal (1 pair
    // instead of 2) and meant text was cluttering the screen before the
    // player had done anything.
    this._bardLineIdx    = -1
    this._bardLineBudget = 0

    // Melodic line + cursor for sing mode (null/unused when BARD_SING is off).
    this._bardMelodyOffsets = (BARD_SING && BARD_VOICE_ENABLED) ? this._buildBardMelodyOffsets() : null
    this._bardMelodyCursor  = 0

    this._bardPlayer = new BardAccompaniment(harp, sequence, {
      gateLighting: true,   // hold each group's lights/interactivity
                            // until we release via readyForNextGroup
      // The musical sequence (built from one short waltz) is FAR shorter
      // than the poem (131 lines). Without loop:true, BardAccompaniment
      // fires onSequenceComplete the moment the tune's own gestures run
      // out — completely independent of how much of the poem has been
      // shown — which is exactly what was cutting the recitation short
      // partway through with "Tá an scéal críochnaithe," several lines
      // before the poem itself was actually finished. Looping the music
      // lets the tune keep cycling under the player's plucking for as
      // long as it takes the (separately-cycling) poem to finish.
      loop: true,
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
          // Budget spent (including the pre-exhausted state set above,
          // which makes the FIRST pluck land here too) — reveal the next
          // TWO pairs of text. Note: nothing here lights the harp gate
          // directly — that still happens inside _showBardLine itself,
          // on each pair's own Irish-typing-finish.
          this._bardLineBudget = BARD_LINE_NOTE_TARGET
          this._revealNextBardPairs()
        }
      },
      // With loop:true, this should now only ever fire if the ENGINE
      // itself is stopped/torn down mid-loop rather than from the tune
      // naturally running out — kept as a safety net, not the poem's
      // real ending. The poem's own ending is reached when
      // _bardWrapIdx's cycling brings it back to the start; that's not
      // currently surfaced as a distinct "the poem is done" event (it
      // just keeps cycling for as long as the player keeps plucking, by
      // design, same as the tune does) — flagged here in case a real
      // "stop after N full passes of the poem" behaviour is wanted later.
      onSequenceComplete: () => {
        console.log('[Táin/bard] musical sequence loop ended unexpectedly')
        this._showBardLine({ ga: 'Tá an scéal críochnaithe.', en: 'The tale is finished.' }, this._bardEnAEl)
      },
    })
    this._bardPlayer.start()
    // Light the FIRST group immediately, independent of any text reveal.
    // With text now deferred until the player's first pluck (see
    // _bardLineIdx/_bardLineBudget above), nothing calls _showBardLine —
    // and therefore nothing calls readyForNextGroup() — until
    // onGroupComplete fires for the first time. But onGroupComplete can
    // only fire once the player plucks a LIT string, and with
    // gateLighting on, group 0 starts gated dark by start() itself. Left
    // alone that's a deadlock: no group ever lights, so no pluck can ever
    // resolve one, so text/gate-release never happens. This one
    // unconditional release just for group 0 breaks that — every
    // subsequent group's release still happens inside _showBardLine
    // exactly as before.
    this._bardPlayer.readyForNextGroup()
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
    // this._tainPoem / this._tainPoemPromise are deliberately NOT cleared
    // here — the poem's content is static for the lifetime of the scene,
    // so keeping it cached across harp opens/closes avoids a redundant
    // re-fetch every time the player reopens the harp.
    super._destroyHarpOverlay()
  }
}


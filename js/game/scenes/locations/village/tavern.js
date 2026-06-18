// tavern.js
// Location: js/game/scenes/locations/village/tavern.js

import VillageScene from '../villageScene.js'
import { HarpPhrasePlayer, buildTimedPhraseFromDurations } from '../../../systems/music/harpPhrasePlayer.js'
import { abcToTimedStringSequence } from '../../../systems/music/abcToPhrase.js'
import { allTunes } from '../../../systems/music/allTunes.js'
import { BardAccompaniment } from '../../../systems/music/bardAccompaniment.js'
import { buildBardSequence, zipBardSequenceWithText } from '../../../systems/music/bardHarmonizer.js'

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

// Maebh/Táin poem content — full bilingual text. Chunked one couplet
// (one ga/en pair) per array entry, which zipBardSequenceWithText then
// maps one-to-one onto musical groups (cycling whichever side is
// shorter — see that function's own comment). This chunking-by-couplet
// choice can be revisited; it was the most direct mapping of what was
// provided, not a deeply considered editorial decision on its own.
const BARD_PLACEHOLDER_TEXT = [
  { ga: 'Ansin a chruinnigh na filí,', en: 'Then it was the poets gathered,' },
  { ga: 'Agus go deimhin, bhrónach an scéal', en: 'Then indeed it was a sorrow,' },
  { ga: 'Óir dáimsigh síad go raibh an Táin caillte.', en: 'For they found the Táin had perished.' },
  { ga: '"Cá bhfuil sé anois?" a diar Forgall Stadach', en: '"Where is it now?" cried Forgall the Stammerer' },
  { ga: 'Cá bhfuil ár Táin Cúailnge?', en: 'Where is our Raid of Cooley?' },
  { ga: 'Cá bhfuil na tairbh, Donn Cuailnge,', en: 'Where the bulls, the Brown of Cooley,' },
  { ga: 'Cá bhfuil fianas an áth?', en: 'Where the deeds done at the ford-crossing?' },
  { ga: 'Agus thit tost ar gach duine acu', en: 'Then it was they each fell silent' },
  { ga: 'imithe, arsa Muireann liath,', en: 'gone, said grey Muirenn,' },
  { ga: 'Níl líne fágtha gur fiú an insint.', en: 'Not one line fit for the telling.' },
  { ga: 'Ba mhór an t-uafás orthú', en: 'Then indeed it was a sorrow' },
  { ga: 'd’éirigh Tiarnach Cham Bhéil,', en: 'Twisted-Mouth Tigernach rose,' },
  { ga: 'Ag chraitha maide chaorthainn,', en: 'shaking his rowan staff,' },
  { ga: 'Ag chraitha fhéasog fhiáin', en: 'shaking his wild beard' },
  { ga: 'Éist liom', en: 'Listen to me' },
  { ga: 'Éistigí liom cé nach dtaitneoidh sé libh.', en: 'Listen to me though ye will not like it.' },
  { ga: 'Tá Táin léite agamsa', en: 'I have read a Táin' },
  { ga: 'ag lobhadh faoi Chluain Mhic Nóis,', en: 'That rotted under Clonmacnoise,' },
  { ga: 'An téacs a d’ith na péiste buí.', en: 'The book the yellow worms had eaten.' },
  { ga: 'Sna scéalta sin', en: 'In those tellings' },
  { ga: 'Ní raibh Cú Chulainn ánn', en: 'Cú Chulainn was not there' },
  { ga: 'Deabhail Cú ar an teorainn!', en: 'No Hound upon the border!' },
  { ga: 'Sáite isteach mar cuach sa Táin,', en: 'He was set there later like the cuckoo,' },
  { ga: 'I neid éanlaith bocht éigin,', en: "Set in some poor warbler's nesthole," },
  { ga: 'Ag ithe na scalltán,', en: 'Eating up the rightful nestlings,' },
  { ga: 'Ag sciobadh grá agus clú.', en: 'Taking all the warmth and honour.' },
  { ga: 'Cleasaí éigin a chuir án é,', en: 'He was put there by some schemer,' },
  { ga: 'Ag scríobadh mainistreach éiginn,', en: 'By some monastery-scratching' },
  { ga: 'Manach caolghéagach le cuspóir fuar', en: 'Thin-armed monk with cold ambitions' },
  { ga: 'ar thóir ghlóir an laoich mhoir', en: "Who desired a hero's glory" },
  { ga: 'a bhronnadh ar ríocht a pátrún', en: 'For the province of his patron' },
  { ga: 'Tá lámh Laighean ann, a bhráithre,', en: "Leinster's hand is in it, brothers," },
  { ga: 'Muintir Laighean mar is de gnáth!', en: "Leinster's hand has always stirred it!" },
  { ga: 'Léim Dallán Forgaill ina sheasamh, an lasair ina ghruanna', en: 'Up leapt red-faced Dallán Forgaill,' },
  { ga: 'Ag leaga triúr suíthe,', en: 'Knocking over three men seated,' },
  { ga: 'Ag doirteadh cupáin na Chonnachtaí,', en: 'Upsetting the cups of Connacht,' },
  { ga: 'Ag stealladh meá ar dhá bhrat breá fhilíochta.', en: 'Slopping mead on two good bard-cloaks.' },
  { ga: 'Tá tú ag insint bréag trí do chuid fiacla liatha!', en: 'Thou art lying through thy grey teeth!' },
  { ga: 'Tá tú ag insint bréag trí do bhachall chaorthainn!', en: 'Thou art lying through thy rowan-staff!' },
  // NOTE: kept "Te Hound" exactly as provided rather than silently
  // "fixing" it to "The Hound" — could be an intentional dialect/voice
  // choice (Tigernach's speech, mid-laughter) rather than a typo. Flag
  // for your own pass; easy one-word edit either way if not intended.
  { ga: 'Bhí an Cú ar an teorainn go deimhin,', en: 'Te Hound was there upon the border,' },
  { ga: 'Sheas sé leis féin in aghaidh sluaite,', en: 'There he stood alone against armies,' },
  { ga: 'Chosain sé an tír ó áth go háth reoite,', en: 'There he fought from ford to cold ford,' },
  { ga: 'Dhoirt sé fuil as créachtaí thar chomhaireamh!', en: 'There he bled from wounds uncountable!' },
  { ga: 'Tá a fhios sin ag gach leanbh in Éirinn,', en: 'Every child of Erin knows it,' },
  { ga: 'Ó gach buime a chan go ciúin!', en: 'Every nurse who ever sang low!' },
  { ga: 'Buimeanna! arsa Tiarnach', en: 'Nurses! cried Tigernach' },
  { ga: 'Ag gáire go dtí go rith deora,', en: 'Laughing till his eyes ran water,' },
  { ga: 'Taispeáin dom an seanscríbh,', en: 'Show me now the old manuscript,' },
  { ga: 'Áit a bhfuil a ainm curtha,', en: 'Where his name is set,' },
  { ga: 'Curtha roimh ruathar an Donn!', en: "Set before the Brown Bull's driving!" },
  { ga: 'Ní féidir leat. Ní ánn dó a mhic.', en: 'Thou canst not. It is not there, man.' },
  { ga: 'Sáitheadh isteach ar ball é.', en: 'He was thrust in, later.' },
  { ga: 'Cuach. Cuach.', en: 'Cuckoo. Cuckoo.' },
]

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

  // Builds the musical BardSequence for the bard-accompaniment mode and
  // zips it with text. Separate from _buildTainPhrase since this mode
  // needs no atMs/travelMs/windowMs scheduling at all — see
  // bardAccompaniment.js's file header for why that's a different
  // engine entirely, not a variant of the orb player's data.
  _buildBardSequence() {
    const harp = this._corraHarp
    const range = harp.getMidiRange()
    const groups = buildBardSequence(PRETTY_GIRL_MILKING_HER_COW, range)
    console.log('[TavernScene] bard sequence — group count:', groups.length,
      '(chord:', groups.filter(g => !g.ordered && g.strings.length > 1).length,
      'run:', groups.filter(g => g.ordered).length,
      'single:', groups.filter(g => g.strings.length === 1).length, ')')

    // See BARD_PLACEHOLDER_TEXT's comment above — this pairs the short
    // placeholder text with the musical groups for now (cycling the
    // MUSIC, since there's currently more music than placeholder text;
    // once the real ~200-line poem replaces this, the relationship will
    // likely flip — more text than one pass of the tune — at which
    // point zipBardSequenceWithText's existing "cycle the shorter side"
    // behavior handles that direction too, with no change needed here).
    return zipBardSequenceWithText(groups, BARD_PLACEHOLDER_TEXT)
  }

  // ── Bard accompaniment mode ─────────────────────────────────────────
  // Player-paced: strings light up, the player plucks them (any order
  // for a chord, in sequence for a run — see bardAccompaniment.js), and
  // each completed gesture reveals the NEXT chunk of story text. No
  // clock, no score, no miss — see bardAccompaniment.js's file header
  // for the full reasoning on why this is a separate engine.
  //
  // Text display: pinned in the top third of the screen. New lines fade
  // in quickly; the line being REPLACED fades out slowly while drifting
  // upward — "smoke-like," per explicit request — rather than either
  // swapping instantly or using a symmetric crossfade. Earlier attempts
  // used TextPanel's 'notification' type (wrong API shape — it expects
  // {irish, english}, not {ga, en} — and auto-dismisses on its own
  // fixed 3s timer regardless of player progress) and then
  // ScrollingTextPlayer (built entirely around continuous multi-second
  // scroll-in-from-the-bottom motion, with no way to spawn already in
  // place) — neither fit this mode's actual needs, so this is a small
  // purpose-built DOM layer instead (see _ensureBardTextContainer).
  //
  // Per explicit design: the FIRST line is visible immediately when bard
  // mode starts (before any plucking), and stays up until the first
  // gesture completes — only then does it advance to the next line.
  // This means onGroupComplete(group, idx) must show sequence[idx+1]'s
  // text (the line for what's now current), NOT group.text (group
  // idx's own line, which was already on screen while the player was
  // busy completing it) — showing group.text again on completion would
  // just redisplay the same line the player had already been reading.
  //
  // Bard-mode text display: each line gets its OWN element appended to
  // a shared container, rather than one fixed pair of elements whose
  // content is swapped in place. This is what allows the "smoke"
  // effect — the outgoing line needs to keep existing on screen,
  // fading out and drifting upward, for ~1.4s AFTER the new line has
  // already faded in, rather than being replaced instantly. A
  // single-element swap can't show two lines' worth of independent
  // animation at once.
  _ensureBardTextContainer() {
    if (this._bardTextContainer) return this._bardTextContainer
    const el = document.createElement('div')
    el.style.cssText = [
      'position:fixed;left:50%;top:14%;transform:translateX(-50%);',
      'width:88%;max-width:580px;text-align:center;',
      'pointer-events:none;z-index:9997;',
      // Dark backing panel — without this, the text sits directly over
      // whatever scene content happens to be behind it (string lines,
      // gradient overlays, character sprites), which can either compete
      // visually with the text or appear to dim it. A semi-transparent
      // dark panel behind the text ensures it reads clearly regardless
      // of what the scene is doing, without looking like a hard opaque
      // box. Rounded corners + moderate padding keep it feeling light.
      'background:rgba(0,4,0,0.62);',
      'border-radius:12px;padding:18px 20px 16px;',
      'backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);',
    ].join('')
    document.body.appendChild(el)
    this._bardTextContainer = el
    return el
  }

  _destroyBardTextEl() {
    this._bardTextContainer?.remove()
    this._bardTextContainer = null
    this._bardCurrentLineEl = null
  }

  _showBardLine(line) {
    if (!line) return
    const container = this._ensureBardTextContainer()

    // The line currently on screen (if any) becomes the OUTGOING line —
    // let it drift upward and fade out slowly, "smoke-like," rather
    // than removing it immediately. It removes itself from the DOM once
    // its own transition finishes.
    const outgoing = this._bardCurrentLineEl
    if (outgoing) {
      outgoing.style.transition = 'opacity 1400ms ease-in, transform 1400ms ease-in'
      outgoing.style.opacity = '0'
      outgoing.style.transform = 'translateY(-46px)'
      setTimeout(() => outgoing.remove(), 1500)
    }

    // The new line: appears in place, fades in FAST (per request —
    // quick in, slow out is the intended asymmetry, not a symmetric
    // crossfade).
    const wrap = document.createElement('div')
    wrap.style.cssText = [
      'position:relative;opacity:0;transform:translateY(0);',
      'transition:opacity 180ms ease-out;',
    ].join('')

    const ga = document.createElement('div')
    ga.textContent = line.ga || ''
    ga.style.cssText = [
      // Pure white fill (was a warm-tinted off-white, #fff3d6) — against
      // a dim, warm-toned tavern scene, a warm-tinted fill blends into
      // the background palette instead of standing apart from it. Pure
      // white reads as categorically brighter than anything else in the
      // scene, the same way the glow needs to.
      'font-family:Urchlo,serif;font-size:1.85rem;color:#ffffff;',
      // MUCH stronger glow than before — per direct feedback that the
      // first pass was still too faint. More layers, higher opacity at
      // every radius, and a near-solid dark backing stroke close to the
      // glyph edges for legibility against busy/bright scene content
      // (character sprites, string lines) without that backing stroke
      // reading as a flat outline.
      'text-shadow:',
      '0 0 2px rgba(0,0,0,0.95),',
      '0 0 5px rgba(0,0,0,0.85),',
      '0 0 10px rgba(255,221,140,1),',
      '0 0 20px rgba(255,200,90,0.95),',
      '0 0 38px rgba(255,180,60,0.85),',
      '0 0 64px rgba(255,160,40,0.6);',
      'line-height:1.4;font-weight:700;',
    ].join('')

    const en = document.createElement('div')
    en.textContent = line.en || ''
    en.style.cssText = [
      'font-family:"Courier New",monospace;font-size:1.2rem;color:#d8f0d8;',
      'text-shadow:0 0 2px rgba(0,0,0,0.9),0 0 6px rgba(0,0,0,0.7),0 0 12px rgba(170,220,170,0.7),0 0 22px rgba(150,210,150,0.45);',
      'line-height:1.3;margin-top:10px;font-weight:500;',
    ].join('')

    wrap.appendChild(ga)
    wrap.appendChild(en)
    container.appendChild(wrap)
    this._bardCurrentLineEl = wrap

    // Trigger the fade-in on the next frame (so the transition actually
    // animates from opacity:0 rather than snapping straight to 1).
    requestAnimationFrame(() => { wrap.style.opacity = '1' })
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

    // Show the FIRST line immediately, before any plucking — per design.
    this._showBardLine(sequence[0].text)

    this._bardPlayer = new BardAccompaniment(harp, sequence, {
      onGroupComplete: (group, idx) => {
        console.log('[Táin/bard] group', idx, 'complete')
        // Advance to the line for the NEW current group (idx + 1), not
        // the line for the group that just finished — that one was
        // already showing. zipBardSequenceWithText cycles text across
        // however many groups exist, so idx + 1 is always in range as
        // long as the sequence itself has any length; only the very
        // last group has no "next" line to show, which is exactly when
        // onSequenceComplete (below) takes over instead.
        const nextLine = sequence[idx + 1]?.text
        if (nextLine) this._showBardLine(nextLine)
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
    this._demoBtn = null
    this._bardBtn = null
    super._destroyHarpOverlay()
  }
}


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
// BARD_PLACEHOLDER_TEXT entry), exactly as before — the new 4-line
// scroll display (see _showBardLine) is purely a rendering/audio-pacing
// change *within* that same per-pair contract. onGroupComplete /
// _bardLineIdx / _bardLineBudget below are therefore unchanged.
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

// Maebh/Táin poem content — full bilingual text. One Irish line and its
// English line per array entry (REVERTED from an earlier doubled-up
// version that joined 2 poem-lines per entry with \n — that doubling is
// no longer used now that the display shows one language-line at a time;
// see _showBardLine). Lines are paced by note-budget across each
// {en,ga} PAIR (see BARD_LINE_NOTE_TARGET above), cycling if the tune
// outlasts the poem.
//
// NOTE: the entry "Hear me you who name me war-bringer" / "you who lay
// the slaughter at my door" has no corresponding Irish line in the
// source text it was drawn from — ga is left null here rather than
// guessed. Fill in or remove before shipping.
const BARD_PLACEHOLDER_TEXT = [
  { en: "Then it was the poets gathered", ga: "Ansin a chruinnigh na filí" },
  { en: "Then indeed it was a sorrow", ga: "Agus go deimhin bhrónach an scéal" },
  { en: "For they found the Táin had perished", ga: "Óir dáimsigh síad go raibh an Táin caillte" },
  { en: "\"Where is it now?\" cried Forgall the Stammerer", ga: "\"Cá bhfuil sé anois?\" a diar Forgall Stadach" },
  { en: "\"Where is our Raid of Cooley?", ga: "Cá bhfuil ár Táin Cúailnge?" },
  { en: "gone said grey Muirenn", ga: "imithe arsa Muireann liath" },
  { en: "Not one line fit for the telling", ga: "Níl líne fágtha gur fiú an insint" },
  { en: "Then indeed it was a sorrow", ga: "Ba mhór an t-uafás orthú" },
  { en: "Twisted-Mouth Tigernach rose", ga: "d'éirigh Tiarnach Cham Bhéil" },
  { en: "shaking his rowan staff", ga: "Ag chraitha maide chaorthainn" },
  { en: "Listen to me", ga: "Éist liom" },
  { en: "Listen to me though ye will not like it", ga: "Éistigí liom cé nach dtaitneoidh sé libh" },
  { en: "I have read the Táin", ga: "Tá an Táin léite agamsa" },
  { en: "That rotted under Clonmacnoise", ga: "a lobhadh faoi Chluain Mhic Nóis" },
  { en: "In a book the yellow worms had eaten", ga: "I téacs a d'ith na péiste buí" },
  { en: "In that telling", ga: "Sna scéalta sin" },
  { en: "Cú Chulainn was not there", ga: "Ní raibh Cú Chulainn ánn" },
  { en: "No Hound upon the border!", ga: "Deabhail Cú ar an teorainn!" },
  { en: "Thrust in like a cuckoo", ga: "Sádh isteach mar cuach sa Táin é" },
  { en: "Taking all the warmth and honour", ga: "Ag sciobadh grá agus clú" },
  { en: "By some thin-armed monk", ga: "Ag manach caolghéagach éiginn" },
  { en: "For the province of his patron", ga: "a bhronnadh ar ríocht a pátrún" },
  { en: "Leinster's hand is in it brothers", ga: "Tá lámh Laighean ann a bhráithre" },
  { en: "Leinster's hand has always stirred it!", ga: "Muintir Laighean mar is de gnáth!" },
  { en: "Up leapt red-faced Dallán Forgaill", ga: "Léim Dallán Forgaill ina sheasamh an lasair ina ghruanna" },
  { en: "Knocking over three men seated", ga: "Ag leaga triúr suíthe" },
  { en: "Thou art lying through thy grey teeth!", ga: "Tá tú ag insint bréag trí do chuid fiacla liatha!" },
  { en: "Te Hound was there upon the border", ga: "Bhí an Cú ar an teorainn go deimhin" },
  { en: "There he stood alone against armies", ga: "Sheas sé leis féin in aghaidh sluaite" },
  { en: "Show me then the old manuscript", ga: "Taispeáin dom an seanscríbh mar sin" },
  { en: "Where his name is set", ga: "Áit a bhfuil a ainm curtha" },
  { en: "Set before the Brown Bull's driving", ga: "Curtha roimh ruathar an Donn" },
  { en: "Thou canst not. It is not there man", ga: "Ní féidir leat. Ní ánn dó a mhic" },
  { en: "He was thrust in later", ga: "Sáitheadh isteach ar ball é" },
  { en: "Cuckoo Cuckoo!", ga: "Cuach Cuach!" },
  { en: "Then the hall was all confusion", ga: "Bhí an halla bun os cionn an uair sin" },
  { en: "Then the hall was all uproar", ga: "Le rírá agus rúille búille" },
  { en: "Ulster's poets rose up shouting", ga: "Sheas filí Uladh suas le béic" },
  { en: "Munster's poets rose up answering", ga: "Sheas filí na Mumhan le freaga" },
  { en: "One man hit another sharply", ga: "Bhuail fear amháin fear eile go docht" },
  { en: "Tore the fine brooch from his shoulder", ga: "Ag straceadh dealg bhreá dá ghualainn" },
  { en: "Three harps fell and none would right them", ga: "Fágadh trí chruit áit ar thuit síad" },
  { en: "And still old Tigernach kept shouting", ga: "Agus lean sean Tiarnach síar ag béicigh" },
  { en: "Cuckoo! Cuckoo! He was planted!", ga: "An chuach! An chuach! Sáithe isteach!" },
  { en: "Find the older text!", ga: "Aimsigh an seantéacs!" },
  { en: "Ha! Text?", ga: "Áh! Téacs an ea?" },
  { en: "Hear me now ye thick-skulled lords", ga: "Éistigí liom anois a thiarnaí thiubh" },
  { en: "Who weigh a queen's worth by her husband's hoard", ga: "Ag comhríonn fiúntas ríon i saibhreas rí" },
  { en: "I'll not be reckoned so!", ga: "Ní mheasfar mise mar sin!" },
  { en: "Who speaks thus?", ga: "Cé hé seo atá ag caint?" },
  { en: "With voice like a blade", ga: "Le guth le faobhar" },
  { en: "That silences bards mid-quarrel?", ga: "A chuireann tost ar filí i lár rac?" },
  { en: "I am the lightning in the blood of Connacht", ga: "Mise an splanc i cúisle na Chonnachta" },
  { en: "I am the sword-gleam on the western water", ga: "Mise lonradh lainne ar uiscí an iarthair" },
  { en: "I am queen over Connacht's chieftains", ga: "Banríonn thaoisaigh Chonnacht mé" },
  { en: "as the storm is queen over the sea!", ga: "Mar stoirm thar an bhfairraige mhóir!" },
  { en: "My wars called men's quarrels", ga: "Mo cogaí tuighta mar achrann na fir" },
  { en: "My rule  unmade!", ga: "Mo fhlaitheas scriosta!" },
  { en: "I who stood astride the chariot reins in hand", ga: "Mise a sheas ard sa charbaid úim sa lámh" },
  { en: "I shall speak the truth", ga: "Inseoidh mise an fhírinne" },
  { en: "To reclaim every warrior-queen", ga: "Chun gach ríon chogaidh" },
  { en: "You have buried out of sight", ga: "A chuir sibh as radharc a tairtháil" },
  { en: "O bright and fierce queen", ga: "A bhanríon gheal fhiáin" },
  { en: "What would you undo", ga: "Cad a cheartfá" },
  { en: "That learned men have twisted crooked?", ga: "Atá stangtha ag insint na saoi?" },
  { en: "The truth the Táin you kept from telling", ga: "Fírinne an Táin a d'fhág sibh síar" },
  { en: "is the tale of what a sovereignty costs", ga: "Is ea, scéal an phraghais ar bhflaitheas" },
  { en: "They tell it thus:", ga: "Seo mar a insíonn siad é:" },
  { en: "Maeve had her wealth", ga: "Bhí a saibhreas féin ag Meadhbh" },
  { en: "had her cattle", ga: "A cuid bó aici" },
  { en: "had her gold", ga: "Bhí ór aici" },
  { en: "had great halls loud with feasting", ga: "Is a hallaí glóracha fleáúla aici" },
  { en: "had all things but one thing", ga: "Is gach uile ní ach aon ní amháin aici:" },
  { en: "The Brown Bull of Cooley", ga: "Tarbh Donn Cúailnge" },
  { en: "That she must borrow or seize", ga: "Nach mór di a iasacht nó a gabháil" },
  { en: "to make her tally true.", ga: "Go seasfadh a ríomh." },
  { en: "Ailill did boast his white-horned bull", ga: "Mhaíomh Ailill a tharbh fionn-adharcach" },
  { en: "And my bull was compared to his", ga: "Agus cuireadh mo tharbh i gcomparáid leis" },
  { en: "But my captains rode beside his", ga: "Ach mharcaigh mo thaoiseach in aice a chuid-se" },
  { en: "And my dreaming stood as tall as his", ga: "Agus sheas mo thoil go cothrom leis" },
  { en: "Hear me you who name me war-bringer", ga: null },
  { en: "you who lay the slaughter at my door", ga: null },
  { en: "I knew sovereignty's worth", ga: "Thuig mé fhlaitheas" },
  { en: "No woman should lie sleeping", ga: "Níor cheart d'aon bhean codladh" },
  { en: "While a man beside her counts", ga: "Agus fear in aice léi ag comhaireamh" },
  { en: "What is hers as though his own", ga: "An méid gur léi mar a chuid féin" },
  { en: "In Cuailnge stood the great dark marvel", ga: "I gCuailnge a sheas an t-iontas dorcha" },
  { en: "I asked as queen I asked as equal", ga: "D'iarr mé mar bhanríon, díarr mé mar chomhchéim" },
  { en: "I named fair terms", ga: "Thairg mé tearmaí chothrom" },
  { en: "I did not stay to be corrected", ga: "Níor fhan mé le go gceartófaí mé" },
  { en: "In haste I called my armies to me", ga: "Brostaigh mé mo shluaite chugam" },
  { en: "I followed the old true road", ga: "Lean mé an sean bhóthar" },
  { en: "As well as any king might", ga: "Chomh maith le rí ar bith" },
  { en: "Cú Chulainn was at the fording-place", ga: "Bhí Cú Chulainn ag an áth" },
  { en: "He stood there young and bright", ga: "Sheas sé ansin óg agus glé" },
  { en: "While Ulster lay in Macha's pangs", ga: "Fhad is a bhí Uladh sínte faoi malacht Mhacha" },
  { en: "O hear me well I'll tell it plain", ga: "Éist liom go maith beidh mé soiléir" },
  { en: "I did not fear him", ga: "Ní raibh eagla orm roimhe" },
  { en: "I walked to him I spoke to him", ga: "Shiúil mé chuige labhair mé leis" },
  { en: "I offered terms as queen to warrior", ga: "Thairg mé téarmaí ó banríon go ghaiscíoch" },
  { en: "And used the tools that queens must use", ga: "D'úsáid mé neart an banríon" },
  { en: "Call it wisdom call it cunning", ga: "Tabhair gliceas air nó gaois más mian" },
  { en: "The host of Connacht crossed the border", ga: "Thrasnaigh slua Chonnacht an teorainn" },
  { en: "And I was she who brought them through", ga: "Agus mise a thug an ceannaireacht" },
  { en: "My raid was the balancing of the world", ga: "Meá na saolta mo tháin" },
  { en: "When the Dun Bull found his strength;", ga: "Nuair a fuair an Donn a neart" },
  { en: "Then did I see my triumph turn", ga: "Ansin a chonaic mé mo bua ag chasadh" },
  { en: "He gored the White through flank and side", ga: "Sáith sé an fionn tríd lár agus easna" },
  { en: "They tore the hillside from the hill", ga: "Bhain siad an talamh den sliabh" },
  { en: "Drove rivers from their beds;", ga: "Thiomáin siad aibhneacha as a gcursaí;" },
  { en: "Then did the White Bull stagger back", ga: "Ansin thit an Tarbh Bán ar gcúl" },
  { en: "His red blood blackened the plain;", ga: "Dhuibhigh an fhuil dhearg an mhá;" },
  { en: "He fell to the the broken ground", ga: "Thit sé ar an gcré dhubh bhriste" },
  { en: "And did not rise again", ga: "Agus níor éirigh sé arís" },
  { en: "The Dun Bull stood above the slain", ga: "Sheas an Donn os cionn an mhairbh" },
  { en: "His dreadful roar was heard", ga: "Chualathas a bhúir uafásach" },
  { en: "Then wandered off and died alone", ga: "Ansin d'imigh sé chun bás leis féin" },
  { en: "They say I started all of it for a bull", ga: "Deirtar gur mhaithe le tarbh a chúsaigh mé seo" },
  { en: "Not for Donn Cuailnge's broad brown back", ga: "Ní ar son dhroim leathan  Dhonn Chuailnge" },
  { en: "Not for Ailill's white-horned pride", ga: "Ní ar son uabhair adharcbháin Ailealla" },
  { en: "But this:", ga: "Ach seo:" },
  { en: "A queen who will not reckon is no queen", ga: "Ní banríon í gan a cóir" },
  { en: "They will ask what Medb was truly", ga: "Fiafróidh siad cearbh í Meadhbh í féin" },
  { en: "Was she reckless was she ruinous?", ga: "An raibh sí místuama an raibh sí creachach?" },
  { en: "Answer them with plainness:", ga: "Freagair iad go soiléir:" },
  { en: "One woman stood on a hill", ga: "Sheas bean amháin ar chnoc" },
  { en: "And set the land trembling", ga: "Is chuir an saol ar crith" },
  { en: "every daughter of Ireland O!", ga: "gach iníon in Éireann ó!" },
  { en: "Call upon her yet and hear her", ga: "Glaoigh uirthi fós agus éist léi" },
  { en: "She was equal in her asking;", ga: "Bhí sí comhionann ina éilimh;" },
  { en: "She has not ceased her answering.", ga: "Níor stop sí ag freagairt." },
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
  }

  // Shared empty-shell builder for the two Irish-styled slots (previous
  // and current) — same glow/shadow/font treatment either way; only the
  // demoted opacity (set once on _bardPrevEl, see _ensureBardTextContainer)
  // and whether a slot's content is typed vs swapped instantly differ.
  _buildBardIrishSlotEl() {
    const ga = document.createElement('div')
    ga.style.cssText = [
      // Pure white fill — against a dim, warm-toned tavern scene, pure
      // white reads as categorically brighter than anything else.
      'font-family:Urchlo,serif;font-size:1.85rem;color:#ffffff;',
      // Strong multi-layer glow + near-solid dark backing stroke close to
      // the glyph edges, for legibility against busy/bright scene content
      // without the backing reading as a flat outline.
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
  _speakBardLine(gaText) {
    if (!gaText) return
    const v = this._ensureBardVoice()
    if (!v) return
    const opts = { voice: BARD_VOICE, tuneKey: BARD_VOICE_TUNE_KEY }
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

    const outgoingGa = this._bardCurEl.textContent
    const startTypingNewLine = () => {
      // Type the new Irish into the current slot, speaking it
      // concurrently (per explicit direction — heard while it's being
      // read, not after).
      this._speakBardLine(line.ga)
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
      // Step 2: set the demoted text into the previous slot FIRST, so
      // its box reflects the REAL height of the incoming content before
      // we measure anything — see header comment history on this exact
      // sequencing for why order matters here.
      this._bardPrevEl.style.transition = 'none'
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
  // indexed BARD_PLACEHOLDER_TEXT[-1], which is undefined — and
  // _showBardLine(undefined, ...) hits its `if (!line) return` guard and
  // silently does nothing: exactly the "first pluck does nothing" bug.
  _bardWrapIdx(i) {
    const len = BARD_PLACEHOLDER_TEXT.length
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
    const lineA = BARD_PLACEHOLDER_TEXT[this._bardWrapIdx(this._bardLineIdx)]
    this._showBardLine(lineA, this._bardEnAEl, () => {
      clearTimeout(this._bardPairBreathTimer)
      this._bardPairBreathTimer = setTimeout(() => {
        this._bardLineIdx++
        const lineB = BARD_PLACEHOLDER_TEXT[this._bardWrapIdx(this._bardLineIdx)]
        this._showBardLine(lineB, this._bardEnBEl, () => {
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
      onSequenceComplete: () => {
        console.log('[Táin/bard] sequence complete')
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
    super._destroyHarpOverlay()
  }
}


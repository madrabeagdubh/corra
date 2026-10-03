// faicheLesson.js
// Location: js/game/scenes/locations/skye/faicheLesson.js
//
// The first lessons on the green: falling in, the salute, and the form (a
// kata the whole line does together).
//
//   MILL      people stand about chatting (about 20 s). You can talk, look
//             round, take a sword from a rack.
//   GATHER    Uathach walks to the dais and climbs it, slowly, and waits.
//             Seven students fall in, in two rows of four facing her, one
//             place left empty (marked on the ground); the eighth wanders
//             off. The Warden -- her second for this -- takes his place out
//             in front of them.
//   FALL IN   until you're standing in the empty place with a sword in your
//             pack. Now and then the Warden comes over: "Fall in." -- or,
//             without a sword, "Get a sword and fall in."
//   READY     "Ready swords!" One by one, scabbards at hips. Yours too: the
//             sword in your hand (a hint: hold the moon for your pack).
//   SALUTE    "Raise blades!" The Warden salutes the dais; two or three do
//             with him, raggedly. "Again. Together. On three." One, two,
//             three -- and all together. Again until you're with them
//             (swipe up to draw, up again to salute -- a hint if you're not).
//   REPLY     Uathach returns the salute, with a bright steel sword.
//   SHEATHE   "Sheathe!" -- swipe down. A word from her.
//             Note: faiche_salute_done
//   THE FORM  "Swords!" -- en garde, all of you. Then the Warden counts and
//             the line moves as one: step forward, cut, step back, cut,
//             step left, cut, step right, cut, cut, cut, gather, release.
//             Twelve beats; nobody tells you the moves after the first two
//             rounds -- watch the others. Each round he scores you; nine
//             beats of twelve and he's satisfied (or after six rounds he
//             lets it go). Note: faiche_kata_done
//   PAIR OFF  the students pair off and practise at the edges of the green.
//   THE DUMMY the Warden fetches a dummy and carries it out to you. Hit it:
//             cuts (2), strong blows (6), shoves -- walk into it -- (3), to
//             fifty. A tally over it; the camera closes in. Note faiche_dummy_done
//   FOOTWORK  "Draw your path with a finger, and cut as you pass": three cuts
//             at the dummy while walking a drawn route. Note faiche_footwork_done
//   SPAR      he carries the dummy back, the students come back to watch, and
//             he fights you: one bout, win or lose. Then Uathach: the
//             tournament, when you're ready. Note faiche_spar_done
//
// Come back after the salute is done and the gathering leads straight into
// the form. Come back after the form and the Warden waits in the ring: walk
// up to him and he picks up where you left off.
//
// Wander off mid-drill and he calls you back into line; nothing goes on
// without you. Leave the green and it starts again from the gathering.
//
// PLACEHOLDER lines: English in both slots except where the Irish was given.

import { GameState } from '../../../systems/gameState.js'
import { SoundBoard } from '../../../systems/soundBoard.js'
import { SKYE_GID } from './skyeScene.js'
import FigureSword, { figureAt } from '../../../combat/figureSword.js'
import { SALUTE_MS, DRAW_MS } from '../../../combat/meleeView.js'
import { SWORD_ID } from '../../../combat/meleeBout.js'
import { VoiceSynth } from '../../../systems/voice/voiceSynth.js'

// Who speaks with what voice (voiceSynth.js), and in what key. The caption's
// Irish line is what's spoken.
const VOICE = { warden: ['ronnie', 'Ador'], uathach: ['seanchai', 'Dmix'] }

export const LESSON_DONE = 'faiche_salute_done'
export const KATA_DONE = 'faiche_kata_done'
export const DUMMY_DONE = 'faiche_dummy_done'
export const FOOT_DONE = 'faiche_footwork_done'
export const SPAR_DONE = 'faiche_spar_done'           // all the lessons: the tournament is open
const BEGUN = 'faiche_salute_begun'

const MILL_MS = 20000, MILL_AGAIN_MS = 6000
const U_START = [24, 10], U_TOP = [18, 7]
const U_PATH = [[23, 10], [22, 10], [21, 10], [20, 10], [19, 10], [18, 10], [18, 9], [18, 8], [18, 7]]
const U_STEP = 1100, U_CLIMB = 1700                    // ms a step; slower on the stair
const WARDEN_ASIDE = [14, 11], WARDEN_FRONT = [18, 13]
// two rows of four, three tiles apart: room for the form's steps
const GRID = [[13, 16], [16, 16], [19, 16], [22, 16], [13, 20], [16, 20], [22, 20]]
export const GAP = [19, 20]
const AWAY = [29, 26]                                  // where the one who isn't training goes
const NUDGE_EVERY = 11000
const WINDOW_AFTER = 2200                              // after "three", how long a salute still counts

// The form: twelve beats. move: what the line does (and what counts for you).
const BEAT_MS = 1150, KATA_PASS = 9, KATA_ROUNDS = 6
const KATA = [
  ['forward', 'A haon', 'One', 'step forward'],      ['strike', 'A dó', 'Two', 'cut'],
  ['back', 'A trí', 'Three', 'step back'],           ['strike', 'A ceathair', 'Four', 'cut'],
  ['left', 'A cúig', 'Five', 'step left'],           ['strike', 'A sé', 'Six', 'cut'],
  ['right', 'A seacht', 'Seven', 'step right'],      ['strike', 'A hocht', 'Eight', 'cut'],
  ['strike', 'A naoi', 'Nine', 'cut'],               ['strike', 'A deich', 'Ten', 'cut'],
  ['gather', 'A haon déag', 'Eleven', 'hold: gather a strong blow'], ['release', 'A dó dhéag', 'Twelve', 'let it go'],
].map(([move, ga, en, name]) => ({ move, ga, en, name }))
const STEP = { forward: [0, -1], back: [0, 1], left: [-1, 0], right: [1, 0] }
// where the pairs go to practise, out of the way
const PAIRS = [[[7, 27], [9, 27]], [[27, 27], [29, 27]], [[28, 11], [30, 11]]]

// the dummy he brings out: from its post on the east side to the middle of the line
const DUMMY_I = 1, DUMMY_AT = [19, 17], DUMMY_ALT = [17, 17]
const DUMMY_GOAL = 50, PTS = { cut: 2, strong: 6, shove: 3 }, PASSES = 3
const WARDEN_WATCH = [23, 15]

const L = (en, ga = en) => ({ ga, en })
const LINES = {
  attention:  L('Attention!'),
  fallIn:     L('Fall in.', 'Luí isteach.'),
  getSword:   L('Get a sword from the rack, and fall in.'),
  ready:      L('Ready swords!'),
  raise:      L('Raise blades!'),
  again:      L('Again. Together. On three.', 'Arís. Le chéile. Ar trí.'),
  againShort: L('Again.', 'Arís.'),
  onThree:    L('On three!', 'Ar trí!'),
  one:        L('One.', 'A haon.'),
  two:        L('Two.', 'A dó.'),
  three:      L('Three!', 'A trí!'),
  good:       L('Good.'),
  sheathe:    L('Sheathe!'),
  sheatheSaid: L('Sheathe, I said.'),
  backInLine: L('Back in line!'),
  uathachEnd: L('Well enough. That is how we begin, every day. Now, to work.'),
  form:       L('The form. Watch the others, and follow.'),
  swords:     L('Swords!'),
  formAgain:  L('Again. Watch the others.'),
  formBetter: L('Better. Again.'),
  formGood:   L('Good. That is the form.'),
  formEnough: L('It will come. Enough for now.'),
  pairOff:    L('Pair off, and practise. You -- stay.'),
  placeAgain: L('Back to your place.'),
  fetch:      L('Stay there. I will bring you something that hits back less.'),
  dummy:      L('Hit it. Cut, strong blows -- and walk into it, to shove. Fifty.'),
  dummyDone:  L('Enough. It has had enough.'),
  feet:       L('Now your feet. Draw your path with a finger, and cut as you pass.'),
  passOne:    L('One.'),
  passTwo:    L('Two.'),
  feetDone:   L('Good. Like that.'),
  spar:       L('Now. With me. Swords up, and come at me.'),
  sparWon:    L('Well struck.'),
  sparLost:   L('Up. You will learn.'),
  uathachSpar: L('Good. Rest a while. When you are ready -- the tournament.'),
  backAgain:  L('Back again. Good.'),
  notReady:   L('Not yet. The garden first: west of the shore, the ráth. I will teach you there.'),
}
const HINTS = {
  pack:   L('Hold the moon to open your pack, and put the sword in your hand.'),
  salute: L('Swipe up on the moon to draw. Swipe up again to salute.'),
  sheathe: L('Swipe down on the moon to put your sword away.'),
  garde:  L('Swipe up on the moon to draw your sword.'),
  form:   L('Step with the brooch; tap the moon to cut; hold it and let go for a strong blow.'),
  feet:   L('Drag a finger from yourself across the grass, past the dummy. Tap the moon as you go by.'),
}
const WARDEN_COLOR = '#c6d4ea', UATHACH_COLOR = '#ffb25c', HINT_COLOR = '#a9b3bd'

const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]))

export default class FaicheLesson {
  constructor(scene, { crowd, grounds }) {
    this.scene = scene
    this.crowd = crowd
    this.grounds = grounds
    this.t = 0
    this.saluteDone = GameState.hasNote(LESSON_DONE)
    this.done = GameState.hasNote(KATA_DONE)               // the line's lessons are done
    this.allDone = GameState.hasNote(SPAR_DONE)            // and yours with him
    this.phase = this.allDone ? 'done' : this.done ? 'waitWarden' : 'notReady'
    this.points = 0; this.passes = 0; this.floats = []
    this.millMs = GameState.hasNote(BEGUN) ? MILL_AGAIN_MS : MILL_MS
    this.at = 0                                        // when the current phase began
    this.queue = []                                    // timed steps: { at, fn }
    this.salutes = []                                  // your salutes (lesson time)
    this.acts = []                                     // your moves in the form: { t, move }
    // Uathach: a figure on the PGR, walking, with a bright sword
    this.u = { c: U_START[0], r: U_START[1], from: null, t0: 0, ms: 0, path: [], face: -1,
               sword: new FigureSword({ gid: 2496, head: 0.9, rest: 0.42, shine: true }) }
    // Uathach stays up on the dais, a distant figure, until the tournament
    this.u.c = U_TOP[0]; this.u.r = U_TOP[1]
    // the class is cut: the students stay away until the tournament calls them
    if (!this.allDone) for (const s of crowd.students) crowd.withdraw(s)
    this.u.flag = { tileX: this.u.c, tileY: this.u.r, visual: { gid: SKYE_GID.UATHACH, flat: false }, offset: [0, 0], pose: null }
    const pgr = scene.perspectiveGround
    pgr?.setEncounterFlags([...(pgr._encounterFlags || []), this.u.flag])
    if (!this.allDone) { this.m.peaceful = true; this.m.HOME = this.done ? [...scene._wardenHome] : [...WARDEN_ASIDE]; scene.boutCaptions = false }
  }

  get bout() { return this.scene._melee }
  get m() { return this.scene._melee.melee }

  // ── helpers ──────────────────────────────────────────────────────────────
  _playerTile() {
    const p = this.scene.player, ts = this.scene.tileSize
    return [Math.floor(p.logicalX / ts), Math.floor(p.logicalY / ts)]
  }
  _onGap() { const [c, r] = this._playerTile(); return c === GAP[0] && r === GAP[1] && !this.scene.player.isMoving }
  _hasSword() { return !!this.scene.player?.inventory?.slots?.some(it => it?.id === SWORD_ID) }
  // a line on the caption, spoken: who = 'warden' | 'uathach' | null (a hint: silent)
  _say(line, ms = 2200, color = WARDEN_COLOR, who = color === UATHACH_COLOR ? 'uathach' : color === WARDEN_COLOR ? 'warden' : null) {
    const cap = this.scene._caption
    if (!cap) return
    cap.setColor(color); cap.show(line.ga, line.en, ms)
    if (who) this._speak(who, line.ga)
  }
  _speak(who, text) {
    const v = this._voice(who), [voice, tuneKey] = VOICE[who] || VOICE.warden
    try { v?.stop(); v?.speak(text, { voice, tuneKey }) } catch (_) {}
  }
  _voice(who) {
    this.voices = this.voices || {}
    if (!this.voices[who]) {
      const ac = SoundBoard.ctx(this.scene)
      this.voices[who] = ac ? new VoiceSynth({ audioContext: ac, volume: 0.55 }) : null
    }
    return this.voices[who]
  }
  // a war cry from the line: a few voices, not quite together
  _kiai() {
    const dr = this._drilled().slice(0, 4)
    dr.forEach((s, i) => this._later(i * 40 + Math.random() * 60, () => {
      const v = this._voice('crowd' + i)
      try { v?.interject('kiai', { voice: s.voice || 'dallan', tuneKey: ['D', 'E', 'G', 'A'][i % 4] }) } catch (_) {}
    }))
  }
  _hint(h) { this._say(h, 4200, HINT_COLOR) }
  _later(ms, fn) { this.queue.push({ at: this.t + ms, fn }) }
  _go(phase) { this.phase = phase; this.at = this.t; this.queue = [] }
  _drilled() { return this.crowd.students.filter(s => s.drill) }
  _now() { return performance.now() }

  // the Warden draws and salutes the dais (his sword stays out after: foeReady)
  _wardenSalute() {
    const m = this.m, foe = m.foe
    const drawn = m.foeReady
    m.foeReady = true
    foe.face = -90
    m._setFoe('salute', SALUTE_MS + (drawn ? 0 : DRAW_MS))
    m.emit('salute', { by: 'foe', draw: !drawn })
  }

  // ── events ───────────────────────────────────────────────────────────────
  onMeleeEvent(name, d = {}) {
    if (name === 'salute' && d.by === 'player') this.salutes.push(this.t)
    if (name === 'swing' && d.air) this.acts.push({ t: this.t, move: 'strike', charged: !!d.charged })
    if (name === 'chargeStart') this.acts.push({ t: this.t, move: 'gather' })
    if (name === 'swing' && d.air) this._swingAtDummy(d)
    if (name === 'boutOver' && this.phase === 'spar') this._sparOver(d.won)
  }

  // ── the frame ────────────────────────────────────────────────────────────
  update(dt) {
    this.t += Math.min(50, dt)
    this._walkUathach()
    for (const q of this.queue.slice()) if (this.t >= q.at) { this.queue.splice(this.queue.indexOf(q), 1); q.fn() }
    const el = this.t - this.at
    if (this.m.pa.onRoute()) this.routeT = this.t
    // your steps, for the form
    const pt = this._playerTile()
    if (this._lastTile && (pt[0] !== this._lastTile[0] || pt[1] !== this._lastTile[1])) {
      const d = [Math.sign(pt[0] - this._lastTile[0]), Math.sign(pt[1] - this._lastTile[1])]
      for (const [k, v] of Object.entries(STEP)) if (v[0] === d[0] && v[1] === d[1]) this.acts.push({ t: this.t, move: k })
    }
    this._lastTile = pt
    switch (this.phase) {
      case 'notReady':
        // the crash course (in the garden) comes first
        if (GameState.hasNote(KATA_DONE)) { this.done = true; this._go('waitWarden'); break }
        if (cheb(this._playerTile(), [this.m.foe.c, this.m.foe.r]) <= 4 && this.t >= (this.tellAt || 0)) {
          this.tellAt = this.t + 18000
          this._say(LINES.notReady, 4200)
        }
        break
      case 'mill':
        if (el >= this.millMs) this._gather()
        break
      case 'gather':
        if (!this.u.path.length && !this.u.from) { this._go('fallIn'); this.grounds.marker = GAP; this.nudgeAt = this.t + 3000 }
        break
      case 'fallIn': this._fallIn(); break
      case 'ready': this._ready(el); break
      case 'waitLine':
        if (this._onGap()) { this._go('count'); this._later(900, () => this._count()) }
        else this._backInLine()
        break
      case 'count': case 'raise': case 'reply': case 'sheathe':
        this._inLine()
        if (this.phase === 'sheathe') this._sheathe(el)
        break
      case 'swords': this._swords(el); break
      case 'formPlace': this._formPlace(); break
      case 'paired': case 'fetch': case 'carry': case 'dummy': case 'footwork': case 'carryBack': case 'return':
        this._paired()
        this._carry()
        if (this.phase === 'dummy' && el > 6000 && !this.m.enGarde && this.t > (this.gardeHintAt || 0)) { this._hint(HINTS.garde); this.gardeHintAt = this.t + 12000 }
        break
      case 'waitWarden':
        if (cheb(this._playerTile(), [this.m.foe.c, this.m.foe.r]) <= 3) this._resume()
        break
    }
  }

  // ── gather ───────────────────────────────────────────────────────────────
  _gather() {
    this._go('gather')
    GameState.addNote(BEGUN)
    this.u.path = this.saluteDone ? [] : U_PATH.slice()
    this._say(LINES.attention, 2000)
    this.crowd.formation = true
    this.m.HOME = [...WARDEN_FRONT]
    // seven fall in, nearest place first; the rest wander off
    const ss = this.crowd.students.slice()
    const slots = GRID.slice()
    for (const s of ss) { s.drill = false }
    for (const slot of slots) {
      let best = null, bd = 1e9
      for (const s of ss) { if (s.drill) continue; const d = Math.hypot(s.c - slot[0], s.r - slot[1]); if (d < bd) { bd = d; best = s } }
      if (!best) break
      best.drill = true; best.goal = slot; best.slot = slot; best.off = [0, 0]; best.faceGoal = slot[0] < 18.5 ? 1 : -1
    }
    let k = 0
    for (const s of ss) if (!s.drill) { s.goal = [AWAY[0] - (k % 2), AWAY[1] + k]; s.faceGoal = -1; k++ }
  }

  _walkUathach() {
    const u = this.u, t = this.t
    if (u.from && t - u.t0 >= u.ms) u.from = null
    if (!u.from && u.path.length) {
      const [c, r] = u.path.shift()
      u.from = [u.c, u.r]; u.t0 = t; u.ms = U_STEP
      u.face = c < u.c ? -1 : c > u.c ? 1 : u.face
      // a climb: where the ground under her feet rises (or falls) a good way
      const g = this.scene.perspectiveGround
      const hv = (cc, row) => g ? (g._vertexH(cc, row) + g._vertexH(cc + 1, row)) / 2 : 0
      u.climb = Math.abs(hv(c, r + 1) - hv(u.c, u.r + 1)) > 0.2
      if (u.climb) u.ms = U_CLIMB * 1.6
      u.c = c; u.r = r
      // a footfall as she lands each step; on the stair, three: step, step, step
      if (u.climb) [0.25, 0.55, 0.85].forEach(f => this._later(u.ms * f, () => SoundBoard.playWeb('FOOTSTEP_WOOD', this.scene, { volume: 0.12 })))
      else this._later(u.ms * 0.5, () => SoundBoard.playWeb('FOOTSTEP_GRASS', this.scene, { volume: 0.06 }))
    }
    let k = u.from ? Math.min(1, (t - u.t0) / u.ms) : 1, bob = 0
    if (u.from && u.climb) {
      // up the stair a step at a time: three lifts and settles, a pause on each
      const n = 3, seg = Math.min(n - 1e-6, k * n), i = Math.floor(seg), f = seg - i
      const mv = Math.min(1, f / 0.6)                       // moving for the first 60% of each step, then still
      k = (i + (1 - (1 - mv) * (1 - mv))) / n
      bob = Math.sin(Math.PI * mv) * 0.07
    } else if (u.from) bob = Math.abs(Math.sin(Math.PI * 2 * k)) * 0.03
    const x = u.from ? u.from[0] + (u.c - u.from[0]) * k : u.c, y = u.from ? u.from[1] + (u.r - u.from[1]) * k : u.r
    u.flag.tileX = u.c; u.flag.tileY = u.r; u.flag.offset[0] = x - u.c; u.flag.offset[1] = y - u.r
    // PGR lifts a figure by the ground at its tile's edge, all at once when
    // the tile changes; on the stair that's a jump. Lift her by the ground
    // where her feet actually are, step by step, instead.
    const g = this.scene.perspectiveGround
    if (g && u.from) {
      const hv = row => (g._vertexH(u.c, row) + g._vertexH(u.c + 1, row)) / 2
      const fr = y + 1, r0 = Math.floor(fr), f = fr - r0
      bob += (hv(r0) * (1 - f) + hv(r0 + 1) * f) - hv(u.r + 1)
    }
    u.flag.pose = { dy: -bob, rot: 0, sx: u.face, sy: 1 + Math.sin(t / 1300) * 0.008 }
    u.x = x; u.y = y
  }

  // ── fall in ──────────────────────────────────────────────────────────────
  _fallIn() {
    const m = this.m
    if (this._onGap() && this._hasSword()) {
      m.HOME = [...WARDEN_FRONT]; this.nudging = false
      this._go('ready'); this.grounds.marker = null
      this._say(LINES.ready, 2400)
      this._drilled().forEach((s, i) => this._later(700 + i * 380, () => { s.kit.show(this._now()); SoundBoard.playWeb('FOOT_SHUFFLE', this.scene, { volume: 0.03 }) }))
      this.readyHintAt = this.t + 9000
      return
    }
    // the Warden comes over now and then
    if (!this.nudging && this.t >= this.nudgeAt) { this.nudging = true; this.nudgeT = this.t; m.HOME = this._playerTile() }
    if (this.nudging) {
      m.HOME = this._playerTile()
      const near = cheb([m.foe.c, m.foe.r], this._playerTile()) <= 1
      if (near || this.t - this.nudgeT > 8000) {
        this._say(this._hasSword() ? LINES.fallIn : LINES.getSword, 2600)
        this.nudging = false; this.nudgeAt = this.t + NUDGE_EVERY
        this._later(1500, () => { if (this.phase === 'fallIn') m.HOME = [...WARDEN_FRONT] })
      }
    }
  }

  // ── ready swords ─────────────────────────────────────────────────────────
  _ready(el) {
    if (!this._onGap()) return this._backInLine()
    if (this.bout.swordInHand()) {
      if (!this.readySince) this.readySince = this.t
      if (this.t - this.readySince > 1400) { this.readySince = 0; if (this.saluteDone) this._formIntro(); else this._raise(true) }
      return
    }
    this.readySince = 0
    if (this.t >= this.readyHintAt) { this._hint(HINTS.pack); this.readyHintAt = this.t + 15000 }
  }

  // ── raise blades: the first time ragged, then on a count ────────────────
  _raise(first) {
    this._go(first ? 'raise' : 'count')
    if (first) {
      this._say(LINES.raise, 2000)
      this._later(500, () => this._wardenSalute())
      this._later(300, () => this._uathachSalute())
      const dr = this._drilled()
      dr.forEach((s, i) => this._later(400 + Math.random() * 900, () => s.kit.draw(this._now())))
      // two or three manage it, raggedly
      dr.filter(() => Math.random() < 0.4).slice(0, 3).forEach(s => this._later(1500 + Math.random() * 900, () => s.kit.salute(this._now())))
      this.windowFrom = this.t; this.windowTo = this.t + 5000
      this._later(5200, () => this._judge(true))
    } else this._count()
  }

  _count() {
    this._go('count')
    this._say(LINES.again, 2400)
    this._later(2800, () => { this._say(LINES.one, 900); this.countFrom = this.t })
    this._later(3700, () => { this._say(LINES.two, 900); this.windowFrom = this.t })
    this._later(4600, () => {
      this._say(LINES.three, 1200)
      this.windowTo = this.t + WINDOW_AFTER
      this._wardenSalute()
      this._uathachSalute()
      this._drilled().forEach(s => s.kit.salute(this._now()))
    })
    this._later(4600 + WINDOW_AFTER + 200, () => this._judge(false))
  }

  _judge(first) {
    const early = this.salutes.some(t => t >= (this.countFrom ?? 1e12) && t < this.windowFrom)
    const ok = this.salutes.some(t => t >= this.windowFrom && t <= this.windowTo) && !early
    this.salutes = []; this.countFrom = null
    if (!first && ok) return this._reply()
    if (!ok && !this.saluteHinted) { this.saluteHinted = true; this._later(2600, () => this._hint(HINTS.salute)) }
    if (first) { this._count(); return }
    this._go('count')
    this._say(early ? LINES.onThree : LINES.againShort, 1600)
    this._later(early ? 1800 : 2400, () => this._count())
  }

  // ── she returns it ───────────────────────────────────────────────────────
  // she salutes with them, from the dais: her sword drawn the first time
  _uathachSalute() {
    const sw = this.u.sword, drawn = sw.state === 'drawn'
    sw.salute(this._now())
    if (!drawn) SoundBoard.playWeb('SWORD_DRAW', this.scene, { volume: 0.12 })
    this._later((drawn ? 0 : DRAW_MS) + 0.62 * SALUTE_MS, () => SoundBoard.playWeb('SWORD_SWISH', this.scene, { pitch: 1.35, dur: 0.16, volume: 0.24 }))
  }

  _reply() {
    this._go('reply')
    this._say(LINES.good, 1400)
    this._later(SALUTE_MS + 300, () => {
      this._go('sheathe')
      this._say(LINES.sheathe, 2000)
      this.m.foeReady = false
      this._drilled().forEach((s, i) => this._later(200 + i * 120 + Math.random() * 300, () => s.kit.sheathe(this._now())))
      this._later(300, () => { this.u.sword.sheathe(this._now()); SoundBoard.playWeb('SWORD_SHEATHE', this.scene, { volume: 0.1 }) })
    })
  }

  _sheathe(el) {
    if (!this.m.enGarde && el > 400) return this._finish()
    if (el > 4500 && !this.sheatheSaid) { this.sheatheSaid = true; this._say(LINES.sheatheSaid, 2000); this._later(2200, () => this._hint(HINTS.sheathe)) }
    if (el > 12000) this._finish()
  }

  _finish() {
    this._go('done')
    this._later(600, () => this._say(LINES.uathachEnd, 4200, UATHACH_COLOR))
    this._later(5200, () => {
      GameState.addNote(LESSON_DONE)
      this.saluteDone = true
      this._formIntro()
    })
  }

  // ── the form ─────────────────────────────────────────────────────────────
  _formIntro() {
    this._go('swords')
    this.round = 0
    this._say(LINES.form, 2600)
    this._later(2900, () => {
      this._say(LINES.swords, 1600)
      this.m.foeReady = true
      this._drilled().forEach(s => this._later(200 + Math.random() * 500, () => s.kit.draw(this._now())))
    })
    this.gardeHintAt = this.t + 9000
  }

  // everyone en garde, you too; then the first round
  _swords(el) {
    if (el < 3200) return
    if (this.m.enGarde) {
      // the first time: how the moves are done, before the count starts
      this._go('formWait')
      this._hint(HINTS.form)
      this._later(4600, () => this._go('formPlace'))
      return
    }
    if (this.t >= this.gardeHintAt) { this._hint(HINTS.garde); this.gardeHintAt = this.t + 12000 }
  }

  // in (or near) your place before a round starts
  _formPlace() {
    if (cheb(this._playerTile(), GAP) <= 1) { this._round(); return }
    this._backInLine()
  }

  _round() {
    this._go('form')
    this.round++
    this.acts = []
    const t0 = this.t + 600
    this.beats = KATA.map((b, i) => ({ ...b, at: t0 + i * BEAT_MS }))
    this.beats.forEach((b, i) => this._later(b.at - this.t, () => this._beat(b, i)))
    this._later(t0 + KATA.length * BEAT_MS + 300 - this.t, () => this._scoreRound())
  }

  // one beat: the count, and the line moves
  _beat(b, i) {
    const named = this.round <= 2
    const cap = this.scene._caption
    if (cap) { cap.setColor(WARDEN_COLOR); cap.show(b.ga + '!', named ? `${b.en}: ${b.name}` : b.en + '!', BEAT_MS - 100) }
    this._speak('warden', b.ga)
    if (b.move === 'release') this._later(120, () => this._kiai())
    const dr = this._drilled()
    for (const s of dr) {
      const lag = Math.random() * 90
      this._later(lag, () => {
        const st = STEP[b.move]
        if (st) { s.off = [(s.off?.[0] || 0) + st[0], (s.off?.[1] || 0) + st[1]]; s.goal = [s.slot[0] + s.off[0], s.slot[1] + s.off[1]] }
        else if (b.move === 'strike') s.kit.swing(this._now())
        else if (b.move === 'gather') s.kit.gather(this._now())
        else if (b.move === 'release') s.kit.release(this._now())
      })
    }
    // the line, as one: feet on the turf, or the blades through the air
    if (STEP[b.move]) { SoundBoard.playWeb('FOOT_SHUFFLE', this.scene, { volume: 0.06 }); this._later(60, () => SoundBoard.playWeb('FOOT_SHUFFLE', this.scene, { volume: 0.05, pitch: 0.85 })) }
    else if (b.move === 'strike') this._later(150, () => SoundBoard.playWeb('SWORD_SWISH', this.scene, { pitch: 0.95, dur: 0.2, volume: 0.2 }))
    else if (b.move === 'release') this._later(180, () => SoundBoard.playWeb('SWORD_SWISH', this.scene, { pitch: 0.75, dur: 0.26, volume: 0.26 }))
  }

  // how many beats you had: the right move, in its beat
  _scoreRound() {
    let got = 0
    for (const b of this.beats) {
      const from = b.at - 250, to = b.at + BEAT_MS - 150
      const mine = this.acts.filter(a => a.t >= from && a.t < to)
      let ok
      if (b.move === 'release') ok = mine.some(a => a.move === 'strike')
      else if (b.move === 'gather') ok = mine.some(a => a.move === 'gather') || (!!this.m.charge && this.m.charge.t0 <= this.m.t)
      else ok = mine.some(a => a.move === b.move)
      if (ok) got++
    }
    this.lastScore = got
    const pass = got >= KATA_PASS, last = this.round >= KATA_ROUNDS
    this._say(pass ? LINES.formGood : last ? LINES.formEnough : got >= 5 ? LINES.formBetter : LINES.formAgain, 2200)
    // the line steps back into place
    for (const s of this._drilled()) { s.off = [0, 0]; s.goal = s.slot }
    if (pass || last) { this._later(2600, () => this._pairOff()); return }
    this._go('formWait')
    this._later(2600, () => this._go('formPlace'))
  }

  // ── pair off ─────────────────────────────────────────────────────────────
  _pairOff() {
    GameState.addNote(KATA_DONE)
    this.done = true
    this._go('paired')
    this._say(LINES.pairOff, 2600)
    const dr = this._drilled()
    dr.forEach((s, i) => {
      const pair = PAIRS[Math.floor(i / 2) % PAIRS.length], spot = pair[i % 2]
      const extra = i >= PAIRS.length * 2 ? 1 : 0                   // the odd one out joins the last pair
      s.goal = [spot[0], spot[1] + extra]; s.faceGoal = i % 2 ? -1 : 1
    })
    this.m.foeReady = false
    this._later(2800, () => this._fetch())
  }

  // the pairs at practice: a cut now and then at each other
  _paired() {
    if (!this.crowd.formation || this.t < (this.nextPairCut || 0)) return
    this.nextPairCut = this.t + 700 + Math.random() * 1400
    const dr = this._drilled().filter(s => s.c === s.goal?.[0] && s.r === s.goal?.[1])
    const s = dr[Math.floor(Math.random() * dr.length)]
    if (s) { if (s.kit.state !== 'drawn') s.kit.draw(this._now()); else s.kit.swing(this._now()) }
  }

  // ── the dummy ────────────────────────────────────────────────────────────
  // where the dummy's post is, and the tile he stands on to lift it
  get L() { return this.scene.mapData.faiche || {} }

  _fetch(next = 'dummy') {
    this.after = next
    this._go('fetch')
    this._say(LINES.fetch, 2600)
    const [px, py] = this.L.dummies[DUMMY_I]
    this.m.HOME = [px - 1, py]
  }

  // he walks to it, lifts it, carries it out, sets it down; or back again
  _carry() {
    const m = this.m, foe = m.foe, at = (p) => foe.c === p[0] && foe.r === p[1] && !foe.from
    const [px, py] = this.L.dummies[DUMMY_I]
    if (this.phase === 'fetch' && at([px - 1, py])) {
      this._go('carry'); this.carried = true
      const spot = cheb(this._playerTile(), DUMMY_AT) === 0 ? DUMMY_ALT : DUMMY_AT
      this.dropAt = spot
      m.HOME = [spot[0] + 1, spot[1]]
    }
    if (this.phase === 'carryBack' && at([this.dummy[0] + 1, this.dummy[1]])) {
      this._go('return'); this.carried = true; this.dummy = null
      m.HOME = [px - 1, py]
    }
    if (this.carried) {
      const [x, y] = m.foeDrawPos()
      this.grounds.placeDummy(DUMMY_I, x - 0.45, y + 0.02, true)
    }
    if (this.phase === 'carry' && at(m.HOME)) {
      this.carried = false
      this.dummy = [...this.dropAt]
      this.grounds.placeDummy(DUMMY_I, this.dummy[0], this.dummy[1], false)
      SoundBoard.playWeb('BODY_FALL', this.scene, { volume: 0.25 })
      m.HOME = [...WARDEN_WATCH]
      this.after === 'footwork' ? this._feet() : this._dummyStart()
    }
    if (this.phase === 'return' && at(m.HOME)) {
      this.carried = false
      this.grounds.placeDummy(DUMMY_I, px, py, false)
      SoundBoard.playWeb('BODY_FALL', this.scene, { volume: 0.2 })
      this._spar()
    }
  }

  _dummyStart() {
    this._go('dummy')
    this.points = 0
    this._say(LINES.dummy, 3200)
  }

  // a cut at the air, beside the dummy: it hits the dummy
  _swingAtDummy(d) {
    if (!this.dummy || (this.phase !== 'dummy' && this.phase !== 'footwork')) return
    const me = this._playerTile()
    if (cheb(me, this.dummy) !== 1) return
    const m = this.m
    if (m.swing) m.swing.tile = [...this.dummy]                     // the cut goes at it, whichever way you last walked
    const moving = !!m.pa.onRoute() || this.t - (this.routeT ?? -1e9) < 600   // on a drawn path, or just off the end of one
    this._later(160, () => {
      this.grounds.hitDummy(DUMMY_I, me[0] <= this.dummy[0] ? 1 : -1)
      SoundBoard.playWeb('BLADE_THUD', this.scene, { hard: d.charged ? 0.9 : 0.35 })
      if (this.phase === 'dummy') this._score(d.charged ? PTS.strong : PTS.cut)
      else if (this.phase === 'footwork' && moving) this._pass()
    })
  }

  // walked into it, en garde: a shove
  bumpDummy(dx) {
    if (!this.dummy || (this.phase !== 'dummy' && this.phase !== 'footwork')) return false
    const m = this.m
    if (!m.enGarde || this.t - (this.lastShove || -1e9) < 450) return true
    this.lastShove = this.t
    if (m.winded() || m.breath < 1) { m.emit('spent', { lastHeart: m.pa.hp() <= 1 }); return true }
    m.spend(1)
    this.grounds.hitDummy(DUMMY_I, dx >= 0 ? 1 : -1)
    SoundBoard.playWeb('BLADE_THUD', this.scene, { hard: 0.25, volume: 0.45 })
    SoundBoard.playWeb('FOOT_SHUFFLE', this.scene, {})
    if (this.phase === 'dummy') this._score(PTS.shove)
    return true
  }

  _score(n) {
    this.points += n
    this.floats.push({ text: '+' + n, t0: this._now() })
    if (this.points >= DUMMY_GOAL) {
      GameState.addNote(DUMMY_DONE)
      this._go('footIntro')
      this._say(LINES.dummyDone, 2000)
      this._later(2400, () => this._feet())
    }
  }

  _feet() {
    this._go('footwork')
    this.passes = 0
    this._say(LINES.feet, 3400)
    this._later(3800, () => { if (this.phase === 'footwork' && this.passes < PASSES) this._hint(HINTS.feet) })
  }

  // a cut at the dummy while walking a drawn path
  _pass() {
    this.passes++
    this.floats.push({ text: '\u2713', t0: this._now() })
    if (this.passes < PASSES) { this._say(this.passes === 1 ? LINES.passOne : LINES.passTwo, 1200); return }
    GameState.addNote(FOOT_DONE)
    this._say(LINES.feetDone, 1800)
    this._later(1600, () => { this._go('carryBack'); this.m.HOME = [this.dummy[0] + 1, this.dummy[1]] })
  }

  // ── sparring ─────────────────────────────────────────────────────────────
  _spar() {
    this._go('spar')
    const m = this.m
    m.HOME = [...this.scene._wardenHome]; m.peaceful = false
    this.scene.boutCaptions = true
    // the students come back to watch
    this.crowd.formation = false
    for (const s of this.crowd.students) { s.goal = null; s.drill = false; s.kit.hide() }
    this._say(LINES.spar, 2600)
  }

  _sparOver(won) {
    this._go('sparDone')
    this._later(2600, () => this._say(won ? LINES.sparWon : LINES.sparLost, 2200))
    this._later(5200, () => {
      GameState.addNote(SPAR_DONE)
      this.allDone = true
      this._say(LINES.uathachSpar, 4200, UATHACH_COLOR)
      this._go('done')
    })
  }

  // come back after the form: he picks up where you left off
  _resume() {
    this._say(LINES.backAgain, 1600)
    this.crowd.formation = true
    if (!GameState.hasNote(DUMMY_DONE)) this._later(1800, () => this._fetch('dummy'))
    else if (!GameState.hasNote(FOOT_DONE)) this._later(1800, () => this._fetch('footwork'))
    else this._later(1800, () => { this.crowd.formation = false; this._spar() })
    this._go('resuming')
  }

  // the camera closes in on you and the dummy (FightLens)
  lensFocus() {
    if (!this.dummy || (this.phase !== 'dummy' && this.phase !== 'footwork')) return null
    return cheb(this._playerTile(), this.dummy) <= 4 ? this.dummy : null
  }
  occupies(tx, ty) { return !!this.dummy && this.dummy[0] === tx && this.dummy[1] === ty }

  // a tap on the dummy: beside it, en garde, a cut; further off, walk up to it
  tapDummy(x, y) {
    if (!this.dummy || (this.phase !== 'dummy' && this.phase !== 'footwork')) return false
    const b = figureAt(this.scene, this.dummy[0], this.dummy[1] - 0.5)
    if (!b || Math.abs(x - b.x) > b.w * 0.6 || y < b.y - b.h * 1.15 || y > b.y + b.w * 0.35) return false
    const me = this._playerTile(), m = this.m
    if (cheb(me, this.dummy) === 1) { if (m.enGarde) m.act(() => m.strike(), 'strike'); return true }
    // the nearest free tile beside it
    const sc = this.scene, ts = sc.tileSize
    let best = null, bd = 1e9
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const c = this.dummy[0] + dx, r = this.dummy[1] + dy
      if ((!dx && !dy) || sc.isColliding(c * ts + ts / 2, r * ts + ts / 2) || sc.isOccupied(c * ts + ts / 2, r * ts + ts / 2)) continue
      const d = Math.hypot(c - me[0], r - me[1]); if (d < bd) { bd = d; best = [c, r] }
    }
    const path = best && sc.pathFinder?.findPath?.(me[0], me[1], best[0], best[1])
    if (path?.length) sc.player.setPath(path.map(st => ({ dx: st.dx, dy: st.dy })))
    return true
  }

  // ── wandered off ─────────────────────────────────────────────────────────
  _inLine() {
    if (this.phase === 'reply') return
    if (this._onGap()) return
    this._backInLine()
    // the count waits for you
    if (this.phase === 'count' || this.phase === 'raise') { this.salutes = []; this._go('waitLine') }
  }
  _backInLine() {
    if (this.t - (this.lastBack || -1e9) > 7000) { this.lastBack = this.t; this._say(LINES.backInLine, 1800) }
  }

  // ── drawing ──────────────────────────────────────────────────────────────
  // her sword, on the overlay after PGR has drawn the figures
  draw(ctx) {
    const u = this.u, box = figureAt(this.scene, u.x ?? u.c, u.y ?? u.r)
    // her blade on the side she's turned to (she faces the green: her right)
    u.sword.paint(ctx, this.scene, box, 1, u.flag.pose, this._now())
    // the tally over the dummy, and what each blow added
    if (this.dummy && (this.phase === 'dummy' || this.phase === 'footwork')) {
      // beside it, en garde: its tile outlined in gold, as your target in a bout
      if (this.m.enGarde && cheb(this._playerTile(), this.dummy) === 1) this.bout.view.tileQuad(ctx, this.dummy, 'rgba(245,208,96,0.12)', 'rgba(245,208,96,0.7)', 1.5)
      const b = figureAt(this.scene, this.dummy[0], this.dummy[1] - 0.5)
      if (!b) return
      const now = this._now(), fs = Math.max(11, b.w * 0.22)
      ctx.save()
      ctx.textAlign = 'center'; ctx.font = `bold ${fs}px 'Courier Prime','Courier New',monospace`
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.fillStyle = '#f3e6c4'
      const label = this.phase === 'dummy' ? `${Math.min(this.points, DUMMY_GOAL)} / ${DUMMY_GOAL}` : `${this.passes} / ${PASSES}`
      const ty = b.y - b.h * 1.25
      ctx.strokeText(label, b.x, ty); ctx.fillText(label, b.x, ty)
      this.floats = this.floats.filter(f => now - f.t0 < 900)
      for (const f of this.floats) {
        const k = (now - f.t0) / 900
        ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ffd36b'
        const y = ty - fs * (1 + k * 1.6)
        ctx.strokeText(f.text, b.x + fs, y); ctx.fillText(f.text, b.x + fs, y)
      }
      ctx.restore()
    }
  }

  destroy() {
    const pgr = this.scene.perspectiveGround
    if (pgr?._encounterFlags) pgr.setEncounterFlags(pgr._encounterFlags.filter(f => f !== this.u.flag))
    if (this.grounds) this.grounds.marker = null
    for (const v of Object.values(this.voices || {})) { try { v?.stop() } catch (_) {} }
  }
}

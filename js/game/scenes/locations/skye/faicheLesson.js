// faicheLesson.js
// Location: js/game/scenes/locations/skye/faicheLesson.js
//
// The first lesson on the green: falling in, and the salute.
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
//   SHEATHE   "Sheathe!" -- swipe down.
//   DONE      a word from her; the students go back to standing about, and
//             the Warden is a sparring partner again. Note: faiche_salute_done
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

export const LESSON_DONE = 'faiche_salute_done'
const BEGUN = 'faiche_salute_begun'

const MILL_MS = 20000, MILL_AGAIN_MS = 6000
const U_START = [24, 10], U_TOP = [18, 7]
const U_PATH = [[23, 10], [22, 10], [21, 10], [20, 10], [19, 10], [18, 10], [18, 9], [18, 8], [18, 7]]
const U_STEP = 1100, U_CLIMB = 1700                    // ms a step; slower on the stair
const WARDEN_ASIDE = [14, 11], WARDEN_FRONT = [18, 14]
const GRID = [[15, 16], [17, 16], [19, 16], [21, 16], [15, 18], [17, 18], [21, 18]]
export const GAP = [19, 18]
const AWAY = [29, 26]                                  // where the one who isn't training goes
const NUDGE_EVERY = 11000
const WINDOW_AFTER = 2200                              // after "three", how long a salute still counts

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
}
const HINTS = {
  pack:   L('Hold the moon to open your pack, and put the sword in your hand.'),
  salute: L('Swipe up on the moon to draw. Swipe up again to salute.'),
  sheathe: L('Swipe down on the moon to put your sword away.'),
}
const WARDEN_COLOR = '#c6d4ea', UATHACH_COLOR = '#ffb25c', HINT_COLOR = '#a9b3bd'

const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]))

export default class FaicheLesson {
  constructor(scene, { crowd, grounds }) {
    this.scene = scene
    this.crowd = crowd
    this.grounds = grounds
    this.t = 0
    this.done = GameState.hasNote(LESSON_DONE)
    this.phase = this.done ? 'done' : 'mill'
    this.millMs = GameState.hasNote(BEGUN) ? MILL_AGAIN_MS : MILL_MS
    this.at = 0                                        // when the current phase began
    this.queue = []                                    // timed steps: { at, fn }
    this.salutes = []                                  // your salutes (lesson time)
    // Uathach: a figure on the PGR, walking, with a bright sword
    this.u = { c: U_START[0], r: U_START[1], from: null, t0: 0, ms: 0, path: [], face: -1,
               sword: new FigureSword({ gid: 2496, head: 0.9, rest: 0.42, shine: true }) }
    if (this.done) { this.u.c = U_TOP[0]; this.u.r = U_TOP[1] }
    this.u.flag = { tileX: this.u.c, tileY: this.u.r, visual: { gid: SKYE_GID.UATHACH, flat: false }, offset: [0, 0], pose: null }
    const pgr = scene.perspectiveGround
    pgr?.setEncounterFlags([...(pgr._encounterFlags || []), this.u.flag])
    if (!this.done) { this.m.peaceful = true; this.m.HOME = [...WARDEN_ASIDE]; scene.boutCaptions = false }
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
  _say(line, ms = 2200, color = WARDEN_COLOR) {
    const cap = this.scene._caption
    if (!cap) return
    cap.setColor(color); cap.show(line.ga, line.en, ms)
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
  }

  // ── the frame ────────────────────────────────────────────────────────────
  update(dt) {
    this.t += Math.min(50, dt)
    this._walkUathach()
    for (const q of this.queue.slice()) if (this.t >= q.at) { this.queue.splice(this.queue.indexOf(q), 1); q.fn() }
    const el = this.t - this.at
    switch (this.phase) {
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
    }
  }

  // ── gather ───────────────────────────────────────────────────────────────
  _gather() {
    this._go('gather')
    GameState.addNote(BEGUN)
    this.u.path = U_PATH.slice()
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
      best.drill = true; best.goal = slot; best.faceGoal = slot[0] < 18.5 ? 1 : -1
    }
    let k = 0
    for (const s of ss) if (!s.drill) { s.goal = [AWAY[0] - (k % 2), AWAY[1] + k]; s.faceGoal = -1; k++ }
  }

  _walkUathach() {
    const u = this.u, t = this.t
    if (u.from && t - u.t0 >= u.ms) u.from = null
    if (!u.from && u.path.length) {
      const [c, r] = u.path.shift()
      u.from = [u.c, u.r]; u.t0 = t; u.ms = r < 10 ? U_CLIMB : U_STEP
      u.face = c < u.c ? -1 : c > u.c ? 1 : u.face
      u.c = c; u.r = r
    }
    const k = u.from ? Math.min(1, (t - u.t0) / u.ms) : 1
    const x = u.from ? u.from[0] + (u.c - u.from[0]) * k : u.c, y = u.from ? u.from[1] + (u.r - u.from[1]) * k : u.r
    u.flag.tileX = u.c; u.flag.tileY = u.r; u.flag.offset[0] = x - u.c; u.flag.offset[1] = y - u.r
    const step = u.from ? Math.abs(Math.sin(Math.PI * 2 * k)) * 0.025 : 0
    u.flag.pose = { dy: -step, rot: 0, sx: u.face, sy: 1 + Math.sin(t / 1300) * 0.008 }
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
      if (this.t - this.readySince > 1400) { this.readySince = 0; this._raise(true) }
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
  _reply() {
    this._go('reply')
    this._say(LINES.good, 1400)
    this._later(900, () => {
      this.u.sword.salute(this._now())
      SoundBoard.playWeb('SWORD_DRAW', this.scene, { volume: 0.12 })
      this._later(DRAW_MS + 0.62 * SALUTE_MS, () => SoundBoard.playWeb('SWORD_SWISH', this.scene, { pitch: 1.35, dur: 0.16, volume: 0.24 }))
    })
    this._later(900 + DRAW_MS + SALUTE_MS + 500, () => {
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
      this.done = true
      this.crowd.formation = false
      for (const s of this.crowd.students) { s.goal = null; s.drill = false; s.kit.hide() }
      const m = this.m
      m.HOME = [...this.scene._wardenHome]; m.peaceful = false
      this.scene.boutCaptions = true
    })
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
  }

  destroy() {
    const pgr = this.scene.perspectiveGround
    if (pgr?._encounterFlags) pgr.setEncounterFlags(pgr._encounterFlags.filter(f => f !== this.u.flag))
    if (this.grounds) this.grounds.marker = null
  }
}

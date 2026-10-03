// faicheCourse.js
// Location: js/game/scenes/locations/skye/faicheCourse.js
//
// The crash course: Conall, alone with you in the garden (skyeGairdin.js: the
// ráth, with its board of stones), one lesson after another. When it is done
// the notes the green waits for are set, so the green meets you with the
// class in session (Uathach on the dais) and then the tournament.
//
// THE WORDS are all in courseScript.js. This file is the LOGIC: it runs the
// lessons in ORDER, each one asking for something and watching for it.
//
//   meet      he introduces himself; stand on the mark
//   dirs      forward / left / back / right, one step each, the brooch glowing
//   tap       tap-to-move: four marks near you (switches taps on: lesson_movement)
//   drag      he draws a line on the ground and walks it; then you draw yours
//   sword     he throws you a practice sword; you catch it (it's yours, equipped)
//   calls     draw / salute / sheathe, called one at a time
//   cuts      the cut, again, faster
//   fatigue   cut until you're winded; stand still till it passes
//   strong    hold the moon for a strong blow
//   dummy     he carries the training dummy out; cut it, strike it, shove it
//   feet      cut it while walking a drawn path, three passes
//   duel      a brief, gentle bout, Conall coaching as it goes
//   end       the green is open: join the others across the loch
//
// Progress is kept in notes (faiche_course_<id>; tap uses lesson_movement), so
// coming back picks up at the first lesson not yet done.
//
// VOICE: Conall's Irish is spoken aloud only for calls the player must act on
// (_call: a step, a draw, a cut). His longer speeches are musical dialogue --
// the harp card (_speech) -- with the d-pad put away and the camera racked
// onto him; short asides are silent captions.
//
// The duel is a real bout with a safety net: a blow that hurts you heals at
// once (you cannot lose), a stalled lesson gets a plain hint, and a lesson
// that goes on too long is let go (courseScript HINT_AFTER_MS, GIVE_UP_MS).

import { GameState } from '../../../systems/gameState.js'
import { SoundBoard } from '../../../systems/soundBoard.js'
import { VoiceSynth } from '../../../systems/voice/voiceSynth.js'
import { PRESETS } from '../../../combat/melee.js'
import { prepareSword, SWORD_ID } from '../../../combat/meleeBout.js'
import { figureAt } from '../../../combat/figureSword.js'
import { DialogueHarp } from '../../../systems/music/dialogueHarp.js'
import StepDrill from './stepDrill.js'
import SkyeCaption from './skyeCaption.js'
import GardenDummy from './gardenDummy.js'
import { figureBox } from './dustDash.js'
import { DUMMY_DONE, FOOT_DONE, SPAR_DONE } from './faicheLesson.js'
import { SCRIPT, HINT_AFTER_MS, GIVE_UP_MS } from './courseScript.js'

// the host scene (skyeGairdin.js) provides: _caption, _melee (Conall's bout),
// _routeDraw, player, tileSize, and
//   courseMarker(tile|null)   a pulsing ring on a tile
//   courseLit(tile)           light a stone of the board (null clears them all)
const VOICE = ['ronnie', 'Ador']
const WARDEN_COLOR = '#c6d4ea', HINT_COLOR = '#a9b3bd'

export const WARDEN_NAME = 'Conall'
export const MET = 'faiche_course_met'
export const DIRS_DONE = 'faiche_course_dirs'
export const TAP_DONE = 'lesson_movement'
export const COURSE_DONE = 'faiche_kata_done'      // the whole course (the green waits for it)

export const ORDER = ['meet', 'dirs', 'tap', 'drag', 'sword', 'calls', 'cuts', 'fatigue', 'strong', 'dummy', 'feet', 'duel', 'end']
const NOTE = { meet: MET, dirs: DIRS_DONE, tap: TAP_DONE }
const noteOf = id => NOTE[id] || `faiche_course_${id}`

const START = [18, 18]                     // the lár, the board's centre stone
export const LEDGE_AT = [18, 7]            // where he waits: the ledge built into the earthen ring
export const FIGHT_AT = [18, 14]           // where he stands to teach, and fights
const TAP_SPOTS = [[20, 17], [16, 16], [16, 19], [18, 18]]   // four marks, all close and on screen from the lár
const NEAR_FIGHT = 4                       // a bout starts within 5 tiles of him

// the line he draws, and walks (waypoints; the tiles between are filled in)
const DEMO_FROM = [18, 12]
const DEMO_PTS = [[18, 12], [21, 12], [21, 15], [19, 16], [16, 16], [15, 13], [18, 12]]   // all within four columns of the lár: on screen
const DRAW_STEP_MS = 120                   // the line grows a tile this often

// the dummy: out of the store, down into the garden
const STORE = [26, 14]                     // where it stands when it is put away
const DUMMY_AT = [18, 15]                  // where he sets it down
const WATCH = [22, 16]                     // where he stands to watch
const DUMMY_GOAL = 30, PTS = { cut: 2, strong: 6, shove: 3 }, PASSES = 3

// the gentle duel: a novice, slowed right down, who goes down in three blows
const DUEL_F = { ...PRESETS.novice, hp: 3, windMs: 1100, recoverMs: 1400, restMin: 1600, restMax: 2800 }
const DUEL_GIVE_UP_MS = 180000

// the brooch calls. glow: 1 = lit. One step each.
const D = (dir, ga, en, glow) => ({ dir, ga, en, glow })
const DIR_CALLS = [
  D('forward', 'Ar aghaidh', 'Forward', 1),
  D('left',    'Ar chlé',    'Left',    1),
  D('back',    'Ar gcúl',    'Back',    1),
  D('right',   'Ar dheis',   'Right',   1),
]

const same = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1]
const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]))
const asList = x => (Array.isArray(x) ? x : [x])
// king-move tiles through a list of waypoints (as a finger would draw them)
const expand = pts => {
  const out = [[...pts[0]]]
  for (let i = 1; i < pts.length; i++) {
    let [c, r] = out[out.length - 1]
    const [tc, tr] = pts[i]
    while (c !== tc || r !== tr) { c += Math.sign(tc - c); r += Math.sign(tr - r); out.push([c, r]) }
  }
  return out
}
const DEMO_LINE = expand(DEMO_PTS)
const DUMMY_LESSONS = ['dummy', 'feet']

export default class FaicheCourse {
  constructor(scene) {
    this.scene = scene
    this.t = 0
    this.queue = []
    this.finished = false
    this.id = null            // the lesson now running
    this.drill = null
    this.goal = null
    this.tapped = false
    this.tapsDone = 0
    this.throwFx = null
    this.demo = null          // the line he draws: { shown, idx }
    this.dragStage = null
    this.speaking = false     // a musical dialogue is up
    this.dragUnlocked = false
    this.carry = null         // the dummy on his shoulder
    this.dummyMode = null     // 'score' | 'pass' while it is there to be hit
    this.points = 0
    this.floats = []
    this.dummy = new GardenDummy(scene, STORE)
    this._wrapSetPath()
    this._wrapDrag()
    this._next()
  }

  get m() { return this.scene._melee.melee }

  /** Tap-to-move works from the tap lesson on (or if it was learned before). */
  tapsOn() { return GameState.hasNote(TAP_DONE) || this.id === 'tap' }
  /** Drawing a route works from the drag lesson on. */
  dragsOn() { return this.dragUnlocked || GameState.hasNote(noteOf('drag')) }

  // ── plumbing ─────────────────────────────────────────────────────────────
  _later(ms, fn) { this.queue.push({ at: this.t + ms, fn }) }
  _say(line, ms, color = WARDEN_COLOR, voiced = false) {
    const cap = this.scene._caption
    if (!cap || !line) return
    cap.setColor(color)
    cap.show(line.ga, line.en, ms ?? line.ms ?? SkyeCaption.holdFor(line.en))
    if (!voiced || line.ga === line.en) return                // English-only placeholders aren't voiced
    try {
      this._voice = this._voice || (() => { const ac = SoundBoard.ctx(this.scene); return ac ? new VoiceSynth({ audioContext: ac, volume: 0.55 }) : null })()
      this._voice?.stop(); this._voice?.speak(line.ga, { voice: VOICE[0], tuneKey: VOICE[1] })
    } catch (_) {}
  }
  /** a call the player must act on: spoken aloud in Irish */
  _call(line, ms) { this._say(line, ms, WARDEN_COLOR, true) }
  _hint(line) { this._say(line, 4200, HINT_COLOR, false) }
  _holdOf(line) { return line.ms ?? SkyeCaption.holdFor(line.en) }
  _lengthOf(lines) { return asList(lines).reduce((a, l) => a + this._holdOf(l) + 350, 0) }

  /** Say a list of lines one after another, then go on. Returns the time it takes. */
  _seq(lines, then, gap = 350) {
    let at = 0
    for (const line of asList(lines)) {
      const l = line, when = at
      this._later(when, () => this._say(l))
      at += this._holdOf(l) + gap
    }
    if (then) this._later(at, then)
    return at
  }

  _mark(tile) { this.scene.courseMarker?.(tile) }
  _tile() {
    const p = this.scene.player, ts = this.scene.tileSize
    return [Math.floor(p.logicalX / ts), Math.floor(p.logicalY / ts)]
  }
  _onTile(p) { return same(this._tile(), p) && !this.scene.player.isMoving }
  _heal() { const p = this.scene.player; if (p && p.currentHP < p.maxHP) p.heal?.(p.maxHP - p.currentHP) }
  _foeAt(p) { const f = this.m.foe; return f.c === p[0] && f.r === p[1] && !f.from }

  // a tapped route goes through player.setPath; remember that one was used
  _wrapSetPath() {
    const p = this.scene.player
    if (!p || p._courseWrapped) return
    const orig = p.setPath.bind(p)
    p._courseOrigSetPath = orig
    p._courseWrapped = true
    p.setPath = (steps) => {
      // a step drill's walk-back is a route too: only count taps
      if (steps?.length && this.id === 'tap' && !this.drill) this.tapped = true
      return orig(steps)
    }
  }

  // a drawn route: ignored until the drag lesson; counted in it
  _wrapDrag() {
    const rd = this.scene._routeDraw
    if (!rd || rd._courseWrapped) return
    const orig = rd._commit.bind(rd)
    rd._courseOrigCommit = orig
    rd._courseWrapped = true
    rd._commit = (list) => {
      if (!this.dragsOn()) return
      orig(list)
      if (this.id === 'drag' && this.dragStage === 'you' && list.length >= 3) this._goalAdd(1)
    }
    // before it is your turn a drag does nothing at all: no line, no walk, and
    // not a tap where the finger lifts
    const move = rd.move.bind(rd), end = rd.end.bind(rd)
    rd._courseOrigMove = move; rd._courseOrigEnd = end
    rd.move = (x, y) => {
      if (this.dragsOn()) return move(x, y)
      if (rd.p0 && Math.hypot(x - rd.p0.x, y - rd.p0.y) >= 14) rd._swallow = true
    }
    rd.end = (cancelled) => {
      if (rd._swallow) { rd._swallow = false; rd.p0 = null; rd.trail = null; return true }
      return end(cancelled)
    }
  }

  // the caption as Conall's, for StepDrill
  _drillCaption() {
    return { show: (ga, en, ms) => this._say({ ga, en }, ms ?? 2200, WARDEN_COLOR, true) }
  }

  // ── musical dialogue: a long speech as the harp card ─────────────────────
  // The d-pad goes away (as in any conversation), the camera closes in on him
  // and the world blurs round him (tilt-shift), and the reader plays the tune
  // as they scroll. `then` runs when it is dismissed.
  _speech(lines, then) {
    const sc = this.scene, tp = sc.textPanel
    lines = asList(lines)
    if (!tp) return this._seq(lines, then)
    const real = lines.filter(l => l.ga && l.ga !== l.en)
    const card = sc.conallCard?.() || {}
    try { sc.joystick?.reset(); sc.player.isMoving = false; sc.joystick?.hideDirections?.() } catch (_) {}
    try { DialogueHarp.open(sc.registry?.get('selectedChampion') || window.selectedChampion || null, sc, card.portrait || 'conall') } catch (_) {}
    if (this.m.enGarde) this.m.setEnGarde(false)        // blade away: the moon is for the English now
    this.speaking = true
    let done = false
    const finish = () => {
      if (done) return
      done = true
      this.speaking = false
      try { sc.joystick?.showDirections?.() } catch (_) {}
      then?.()
    }
    tp.show({
      irish: real.map(l => l.ga).join('\n\n'),
      english: lines.map(l => l.en).join('\n\n'),
      type: 'encounter_card', bgKey: card.bgKey ?? null, graphicKey: card.graphicKey ?? null,
      options: null, onDismiss: finish,
    })
    // rack the focus onto him
    try {
      const m = this.m, box = figureBox(sc, m.foe.c, m.foe.r), pgr = sc.perspectiveGround
      if (box && pgr?._sh) sc.tiltShift?.setDialogueMode(true, (box.y - box.h * 0.5) / pgr._sh)
    } catch (_) {}
  }

  // ── goals: "do this", watched through the bout's events ─────────────────
  //   on(name, d) -> true (or a number) to count it     need  how many
  //   hint        a plain instruction if you stall      done()  when met
  //   tick()      each frame (optional)    other(name, d)  any other event
  _goal(g) {
    // listening starts now, while he is still talking: hints only after he has finished (g.after)
    this.goal = { need: 1, n: 0, ...g, t0: this.t, hintAt: this.t + (g.after || 0) + HINT_AFTER_MS }
  }
  _goalAdd(k = 1) {
    const g = this.goal
    if (!g) return
    g.n += k; g.t0 = this.t; g.hintAt = this.t + HINT_AFTER_MS
    g.onCount?.(g.n)
    if (g.n >= g.need && this.goal === g) this._goalDone()
  }
  _goalDone() {
    const g = this.goal; this.goal = null
    this.queue = []                       // a pending word of praise must not talk over what comes next
    this._later(0, () => g.done?.())
  }
  onMeleeEvent(name, d) {
    if (name === 'swing' && d?.air && this.dummy.at && this.dummyMode) this._swingAtDummy(d)
    const g = this.goal
    if (!g) return
    const w = g.on?.(name, d)
    if (w) { this._goalAdd(w === true ? 1 : w); if (this.goal !== g) return }
    g.other?.(name, d)
  }

  // ── which lesson next ────────────────────────────────────────────────────
  _next() {
    this.goal = null
    const id = ORDER.find(i => i !== 'end' && !GameState.hasNote(noteOf(i))) || 'end'
    this.id = id
    if (!DUMMY_LESSONS.includes(id) && !this.carry && this.dummy.visible) this.dummy.hide()
    this._lesson(id)
  }
  _finish(id, delay = 600) {
    GameState.addNote(noteOf(id))
    this.goal = null
    this._later(delay, () => this._next())
  }
  _lesson(id) { this[`_${id}`]?.() }

  // ── meet ─────────────────────────────────────────────────────────────────
  _meet() {
    const S = SCRIPT.meet
    this.m.HOME = [...LEDGE_AT]
    this._later(2500, () => this._speech(S.intro, () => { GameState.addNote(MET); this._toMark(() => this._next()) }))
  }

  // stand on the mark, then go on
  _toMark(then) {
    this.id = 'mark'
    this._mark([...START])
    this._say(SCRIPT.meet.stand, 2600)
    this._afterMark = then
    this._markHintAt = this.t + HINT_AFTER_MS
  }

  // ── directions: four calls, one step each ────────────────────────────────
  _dirs() {
    if (!this._onTile(START)) return this._toMark(() => { this.id = 'dirs'; this._dirs() })
    const S = SCRIPT.dirs
    this._mark(null)
    this._say(S.intro)
    this.drill = new StepDrill(this.scene, {
      caption: this._drillCaption(), steps: DIR_CALLS, onCorrect: (st, tile) => this.scene.courseLit?.(tile),
      onDone: () => this._drillDone('dirs', S.done),
    })
    this._later(this._holdOf(S.intro) + 400, () => this.drill?.start())
  }

  _drillDone(id, doneLines) {
    this.drill?.destroy(); this.drill = null
    this.scene.courseLit?.(null)
    GameState.addNote(noteOf(id))
    this.id = 'between'
    this._later(500, () => this._seq(doneLines, () => this._next()))
  }

  // ── tap-to-move: four marks near you ─────────────────────────────────────
  _tap() {
    this._mark(null)
    this.round = 0
    this.tapsDone = 0
    this._call(SCRIPT.tap.intro)
    this._later(this._holdOf(SCRIPT.tap.intro) + 300, () => this._tapRound())
  }
  _tapRound() {
    this.tapped = false
    // never ask for the tile you are standing on
    if (same(this._tile(), TAP_SPOTS[this.round])) this.round = (this.round + 1) % TAP_SPOTS.length
    this._mark([...TAP_SPOTS[this.round]])
    this.tapHintAt = this.t + HINT_AFTER_MS
    this.tapWait = true
  }
  _tapReached() {
    const S = SCRIPT.tap
    this.tapWait = false
    this._mark(null)
    this._say(this.tapped ? S.tapped : S.walked, 2400)
    this.tapsDone++
    this.round = (this.round + 1) % TAP_SPOTS.length
    if (this.tapsDone >= TAP_SPOTS.length) {
      GameState.addNote(TAP_DONE)
      this.id = 'between'
      this._later(2800, () => this._seq(S.done, () => this._next()))
      return
    }
    this._later(2800, () => { this._say(this.tapsDone === 1 ? S.again : S.further, 1600); this._later(1800, () => this._tapRound()) })
  }

  // ── drag: he draws a line on the ground and walks it; then you ───────────
  _drag() {
    this._mark(null)
    this.demo = { shown: 0, idx: 0 }
    this.dragStage = 'walk'
    this.m.HOME = [...DEMO_FROM]
    this._seq(SCRIPT.drag.intro)
  }
  _dragTick() {
    const S = SCRIPT.drag, m = this.m, d = this.demo, st = this.dragStage
    if (st === 'walk') {
      if (this._foeAt(DEMO_FROM)) { this.dragStage = 'draw'; d.t0 = this.t; this._say(S.drawing) }
    } else if (st === 'draw') {
      d.shown = Math.min(DEMO_LINE.length, Math.floor((this.t - d.t0) / DRAW_STEP_MS) + 1)
      if (d.shown >= DEMO_LINE.length) { this.dragStage = 'pause'; d.t1 = this.t }
    } else if (st === 'pause') {
      if (this.t - d.t1 > 1000) {
        this.dragStage = 'follow'; d.idx = 1; d.stepAt = this.t
        m.HOME = [...DEMO_LINE[1]]
        this._say(S.following)
      }
    } else if (st === 'follow') {
      if (this._foeAt(m.HOME) || this.t - d.stepAt > 2600) {
        d.idx++; d.stepAt = this.t
        if (d.idx >= DEMO_LINE.length) { this.dragStage = 'back'; d.t2 = this.t; m.HOME = [...FIGHT_AT] }
        else m.HOME = [...DEMO_LINE[d.idx]]
      }
    } else if (st === 'back') {
      if (this._foeAt(FIGHT_AT) || this.t - d.t2 > 6000) this._dragInvite()
    }
  }
  _dragInvite() {
    const S = SCRIPT.drag
    this.dragStage = 'you'
    this.demo = null
    this.dragUnlocked = true
    this._say(S.you)
    this._goal({
      need: 2, hint: S.hint, after: this._holdOf(S.you),
      onCount: n => { if (n < 2) this._say(S.good, 2600) },
      done: () => { this._seq(S.done, () => { this.dragStage = null; this._finish('drag', 200) }) },
    })
  }

  // ── the sword: thrown, caught, yours ─────────────────────────────────────
  _sword() {
    const S = SCRIPT.sword
    this.m.HOME = [...FIGHT_AT]
    this._speech(S.intro, () => {
      this._say(S.throw, 1400)
      this.throwFx = { t0: this.t, ms: 900 }
      this._later(950, () => {
        this.throwFx = null
        this._giveSword()
        this._speech([S.caught, S.done], () => this._finish('sword', 200))
      })
    })
  }
  _giveSword() {
    const sc = this.scene
    try {
      prepareSword(sc, true)
      const inv = sc.player.inventory
      const i = inv.slots.findIndex(it => it?.id === SWORD_ID)
      if (i >= 0 && inv.getEquippedItem?.('rightHand')?.id !== SWORD_ID) inv.equipItem(i, 'rightHand')
    } catch (e) { console.warn('[course] sword', e) }
  }

  // ── the moon's gesture, shown (as the stars are in the constellation scene) ─
  _prompt(kind) { this.scene.moonPrompt?.(kind) }
  /** show `kind` on the moon while the blade is out, a swipe up while it is not */
  _promptFor(kind) { this._prompt(this.m.enGarde ? kind : 'up') }

  // ── calls: how the blade is carried ──────────────────────────────────────
  // draw, salute, sheathe, (good), draw: each said, the gesture shown on the
  // moon, and done when you do it. He listens from the moment he says it.
  _calls() {
    const S = SCRIPT.calls, m = this.m
    m.HOME = [...FIGHT_AT]
    if (m.enGarde) m.setEnGarde(false)             // start with the blade away
    const is = {
      draw: n => n === 'enGarde',
      salute: (n, d) => n === 'salute' && d?.by === 'player',
      sheathe: n => n === 'atEase',
    }
    const STEPS = [
      { k: 'draw', ...S.draw, p: 'up' }, { k: 'salute', ...S.salute, p: 'up' },
      { k: 'sheathe', ...S.sheathe, p: 'down' }, { k: 'good', good: true },
      { k: 'draw', ...S.drawAgain, p: 'up' },
    ]
    const run = i => {
      if (i >= STEPS.length) { this._prompt(null); return this._finish('calls', 300) }
      const st = STEPS[i]
      if (st.good) { this._say(S.good); return this._later(1600, () => run(i + 1)) }
      this._call(st.say); this._prompt(st.p)
      this._goal({
        hint: st.hint, on: is[st.k],
        done: () => { this._prompt(null); this._later(700, () => run(i + 1)) },
      })
    }
    this._seq(S.intro, null)
    this._later(this._holdOf(S.intro) + 500, () => run(0))
  }

  // ── cuts: attack, again, again, faster ───────────────────────────────────
  _cuts() {
    const S = SCRIPT.cuts
    this._heal()
    this._call(S.intro)
    this._goal({
      need: 4, hint: S.hint, after: 2000,
      on: (name, d) => name === 'swing' && !d.charged,
      onCount: n => { if (n === 1 || n === 2) this._call(S.again); else if (n === 3) this._call(S.faster) },
      tick: () => this._promptFor('tap'),
      done: () => { this._prompt(null); this._say(S.good); this._later(1700, () => this._seq(S.hardWork, () => this._finish('cuts', 300))) },
    })
  }

  // ── fatigue: when to give everything, when to hold back ──────────────────
  _fatigue() {
    const S = SCRIPT.fatigue
    this._speech(S.intro[0], () => {
      this._say(S.intro[1])
      this._goal({
        after: this._holdOf(S.intro[1]), hint: S.hint,
        on: name => name === 'winded',
        tick: () => this._promptFor('tap'),
        done: () => {
          this._prompt(null)
          this._seq(S.winded, () => {
            this._say(S.rest)
            this._goal({
              hint: S.rest, on: name => name === 'unwinded',
              done: () => this._speech([S.rested, S.done], () => this._finish('fatigue', 300)),
            })
          })
        },
      })
    })
  }

  // ── strong: ready a strong attack ────────────────────────────────────────
  _strong() {
    const S = SCRIPT.strong
    this._heal()
    this._say(S.intro)
    this._goal({
      need: 2, hint: S.hint, after: this._holdOf(S.intro),
      on: (name, d) => name === 'swing' && d.charged,
      onCount: () => this._say(S.good),
      tick: () => {
        const g = this.goal, m = this.m
        this._promptFor('hold')
        if (g && (m.breath < 2 || m.winded()) && this.t >= (g.breatheAt || 0)) { g.breatheAt = this.t + 9000; this._say(S.breathe) }
      },
      done: () => { this._prompt(null); this._later(2300, () => this._seq(S.done, () => this._finish('strong', 300))) },
    })
  }

  // ── the dummy: carried out, cut, shoved, passed ──────────────────────────
  // He walks to the pick-up spot, lifts it onto his shoulder, carries it to the
  // stand spot and sets it on the grass at `dropTile`.
  _carry(pick, stand, dropTile, then, hideAfter = false) {
    this.carry = { stage: 'go', pick, stand, dropTile, then, hideAfter, t0: this.t }
    this.m.HOME = [...pick]
  }
  _carryTick() {
    const c = this.carry, m = this.m
    if (!c) return
    if (c.stage === 'go' && (this._foeAt(c.pick) || this.t - c.t0 > 16000)) {
      c.stage = 'bring'; c.t0 = this.t
      this.dummy.show()
      m.HOME = [...c.stand]
    }
    if (c.stage === 'bring') {
      const [x, y] = m.foeDrawPos()
      this.dummy.place(x - 0.45, y + 0.02, true)
      if (this._foeAt(c.stand) || this.t - c.t0 > 16000) {
        // wait if you are standing where it goes
        if (same(this._tile(), c.dropTile) && this.t - c.t0 < 40000) {
          if (this.t >= (c.sayAt || 0)) { c.sayAt = this.t + 5000; this._say(SCRIPT.dummy.clear, 2400) }
          return
        }
        this.dummy.place(c.dropTile[0], c.dropTile[1], false)
        if (c.hideAfter) this.dummy.hide()
        SoundBoard.playWeb('BODY_FALL', this.scene, { volume: 0.25 })
        this.carry = null
        c.then?.()
      }
    }
  }
  /** the dummy standing in the garden, whatever it takes */
  _withDummy(then) {
    if (same(this.dummy.at, DUMMY_AT)) return then()
    this._say(SCRIPT.dummy.fetch, 3000)
    this._carry([STORE[0] - 1, STORE[1]], [DUMMY_AT[0] + 1, DUMMY_AT[1]], DUMMY_AT, () => {
      this.m.HOME = [...WATCH]
      then()
    })
  }
  _carryAway(then) {
    this._carry([DUMMY_AT[0] + 1, DUMMY_AT[1]], [STORE[0] - 1, STORE[1]], STORE, () => {
      this.m.HOME = [...FIGHT_AT]
      then?.()
    }, true)
  }

  _dummy() {
    const S = SCRIPT.dummy
    this.points = 0
    this._withDummy(() => {
      this._speech(S.intro, () => {
        this.dummyMode = 'score'
        this._goal({
          need: DUMMY_GOAL, hint: S.hint, after: 1500,
          tick: () => this._dummyPrompt(),
          done: () => { this.dummyMode = null; this._prompt(null); this._speech(S.done, () => this._finish('dummy', 200)) },
        })
      })
    })
  }
  _dummyPrompt() {
    if (!this.m.enGarde && cheb(this._tile(), this.dummy.at || DUMMY_AT) <= 2) this._prompt('up'); else this._prompt(null)
  }

  _feet() {
    const S = SCRIPT.feet
    this._withDummy(() => {
      this._speech(S.intro[0], () => {
        this._say(S.intro[1])
        this.dummyMode = 'pass'
        this._goal({
          need: PASSES, hint: S.hint, after: this._holdOf(S.intro[1]),
          tick: () => this._dummyPrompt(),
          onCount: n => { if (n < PASSES) this._say(n === 1 ? S.passOne : S.passTwo, 1400) },
          done: () => {
            this.dummyMode = null; this._prompt(null)
            this._seq(S.done, () => this._carryAway(() => this._finish('feet', 200)))
          },
        })
      })
    })
  }

  // a cut at the air, beside the dummy: it hits the dummy
  _swingAtDummy(d) {
    const at = this.dummy.at
    if (!at || !this.dummyMode) return
    const me = this._tile()
    if (cheb(me, at) !== 1) return
    const m = this.m
    if (m.swing) m.swing.tile = [...at]                              // the cut goes at it, whichever way you last walked
    const moving = !!m.pa.onRoute() || this.t - (this.routeT ?? -1e9) < 600   // on a drawn path, or just off the end of one
    this._later(160, () => {
      if (!this.dummyMode) return
      this.dummy.hit(me[0] <= at[0] ? 1 : -1)
      SoundBoard.playWeb('BLADE_THUD', this.scene, { hard: d.charged ? 0.9 : 0.35 })
      if (this.dummyMode === 'score') this._score(d.charged ? PTS.strong : PTS.cut)
      else if (this.dummyMode === 'pass' && moving) { this.floats.push({ text: '✓', t0: this.t }); this._goalAdd(1) }
    })
  }
  _score(n) {
    this.points += n
    this.floats.push({ text: '+' + n, t0: this.t })
    this._goalAdd(n)
  }

  /** walked into it, en garde: a shove (the scene calls this) */
  bumpDummy(dx) {
    if (!this.dummy.at || !this.dummyMode) return false
    const m = this.m
    if (!m.enGarde || this.t - (this.lastShove || -1e9) < 450) return true
    this.lastShove = this.t
    if (m.winded() || m.breath < 1) { m.emit('spent', { lastHeart: m.pa.hp() <= 1 }); return true }
    m.spend(1)
    this.dummy.hit(dx >= 0 ? 1 : -1)
    SoundBoard.playWeb('BLADE_THUD', this.scene, { hard: 0.25, volume: 0.45 })
    SoundBoard.playWeb('FOOT_SHUFFLE', this.scene, {})
    if (this.dummyMode === 'score') this._score(PTS.shove)
    return true
  }

  // what the scene asks about the dummy
  occupies(tx, ty) { return this.dummy.occupies(tx, ty) }
  /** the camera closes in on you and the dummy (FightLens) */
  lensFocus() {
    if (this.speaking) { const f = this.m.foe; return [f.c, f.r] }       // in on him while he speaks
    const at = this.dummy.at
    if (!at || !this.dummyMode) return null
    return cheb(this._tile(), at) <= 4 ? at : null
  }
  /** a tap on the dummy: beside it, en garde, a cut; further off, walk up to it */
  tapDummy(x, y) {
    const at = this.dummy.at
    if (!at || !this.dummyMode) return false
    const b = figureAt(this.scene, at[0], at[1] - 0.5)
    if (!b || Math.abs(x - b.x) > b.w * 0.6 || y < b.y - b.h * 1.15 || y > b.y + b.w * 0.35) return false
    const me = this._tile(), m = this.m
    if (cheb(me, at) === 1) { if (m.enGarde) m.act(() => m.strike(), 'strike'); return true }
    const sc = this.scene, ts = sc.tileSize
    let best = null, bd = 1e9
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const c = at[0] + dx, r = at[1] + dy
      if ((!dx && !dy) || sc.isColliding(c * ts + ts / 2, r * ts + ts / 2) || sc.isOccupied(c * ts + ts / 2, r * ts + ts / 2)) continue
      const dd = Math.hypot(c - me[0], r - me[1]); if (dd < bd) { bd = dd; best = [c, r] }
    }
    const path = best && sc.pathFinder?.findPath?.(me[0], me[1], best[0], best[1])
    if (path?.length) sc.player.setPath(path.map(st => ({ dx: st.dx, dy: st.dy })))
    return true
  }

  // ── the duel: brief, slow, gentle; he coaches as it goes ─────────────────
  // A real bout, but a blow that lands heals at once: you can't lose.
  _boutOn(F) {
    const m = this.m
    m.F = { ...F }
    m.foe.hp = F.hp
    m.HOME = [...FIGHT_AT]
    m.peaceful = false
    this._heal()
  }
  _boutOff() {
    const m = this.m
    m.peaceful = true
    m._endCombat?.()
    m.bout = { over: false, until: 0, needLeave: false }
    m.p.lost = false
    m._setFoe?.('idle', 0)
    m.F = { ...PRESETS.warden }
    m.foe.hp = m.F.hp
    m.HOME = [...FIGHT_AT]
    this._prompt(null)
    this._heal()
  }
  /** A bout starts only when you're within a few tiles of him: be on the mark first. */
  _atMark(fn) {
    const [c, r] = this._tile()
    if (Math.max(Math.abs(c - FIGHT_AT[0]), Math.abs(r - FIGHT_AT[1])) <= NEAR_FIGHT) return fn()
    const id = this.id
    this._toMark(() => { this.id = id; fn() })
  }
  /** a word of coaching, not more often than every few seconds */
  _coach(line, gap = 4200) {
    if (this.t < (this.coachAt || 0)) return
    this.coachAt = this.t + gap
    this._call(line, 2800)
  }

  _duel() {
    const S = SCRIPT.duel
    this._atMark(() => {
      this.tells = 0; this.hitsMade = 0; this.coachAt = 0
      this._speech(S.intro[0], () => {
      this._call(S.intro[1])
      this._boutOn(DUEL_F)
      this._goal({
        need: 1, hint: S.hint, after: this._holdOf(S.intro[1]), giveUp: DUEL_GIVE_UP_MS,
        on: (name, d) => name === 'boutOver' && d.won,
        tick: () => { if (!this.m.enGarde) this._prompt('up'); else this._prompt(null) },
        other: (name, d) => {
          if (name === 'hit' && d.on === 'player') { this._heal(); this._coach(S.coach.hurt) }
          else if (name === 'boutOver' && !d.won) this._heal()
          else if (name === 'tell') { if (this.tells++ < 3) this._coach(S.coach.tell, 2500) }
          else if (name === 'dodge' || (name === 'miss' && d.by === 'foe')) this._coach(S.coach.miss)
          else if (name === 'hit' && d.on === 'foe') this._coach(S.coach.hit[this.hitsMade++ % S.coach.hit.length])
          else if (name === 'shove') this._coach(S.coach.shove)
          else if (name === 'disarm') this._say(S.disarm, 3600)
          else if (name === 'swordReturned') this._say(S.returned, 3000)
          else if (name === 'struckUnarmed') this._say(S.struck, 3600)
        },
        done: () => { this._boutOff(); this._speech(S.won, () => this._finish('duel', 200)) },
      })
      })
    })
  }

  // ── the end: across the loch, to the class ───────────────────────────────
  _end() {
    this.id = 'end'
    this._mark(null)
    this.m.HOME = [...LEDGE_AT]
    this._speech(SCRIPT.end.intro, () => {
      // the green meets you with the class in session, and then the tournament
      for (const n of [COURSE_DONE, DUMMY_DONE, FOOT_DONE, SPAR_DONE]) GameState.addNote(n)
      this.finished = true
    })
  }

  // ── drawn over the figures (from the scene's onPGRDrawComplete) ──────────
  draw(ctx) {
    this._drawThrow(ctx)
    this._drawLines(ctx)
    this._drawDummy(ctx)
  }

  /** the sword in flight */
  _drawThrow(ctx) {
    const fx = this.throwFx
    if (!fx) return
    const sc = this.scene, m = this.m
    const a = figureBox(sc, m.foe.c, m.foe.r)
    const [pc, pr] = this._tile()
    const b = figureBox(sc, pc, pr)
    if (!a || !b) return
    const k = Math.min(1, (this.t - fx.t0) / fx.ms)
    const x = a.x + (b.x - a.x) * k
    const y = a.y - a.h * 0.6 + ((b.y - b.h * 0.6) - (a.y - a.h * 0.6)) * k - Math.sin(Math.PI * k) * a.h * 0.7
    const size = Math.max(14, b.w * 0.7 + (a.w - b.w) * (1 - k) * 0.5)
    const img = sc.itemSheet?.getCanvas?.(2492)
    ctx.save()
    ctx.translate(x, y); ctx.rotate(k * Math.PI * 6)
    if (img) { ctx.imageSmoothingEnabled = false; ctx.drawImage(img, -size / 2, -size / 2, size, size) }
    else { ctx.strokeStyle = '#d8d4c8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-size / 2, 0); ctx.lineTo(size / 2, 0); ctx.stroke() }
    ctx.restore()
  }

  /** the line he draws (gold, as yours will be) */
  _drawLines(ctx) {
    const rd = this.scene._routeDraw
    if (!rd?._line) return
    ctx.save()
    const d = this.demo
    if (d && d.shown > 0) {
      const from = this.dragStage === 'follow' ? Math.max(0, d.idx - 1) : 0
      const tiles = DEMO_LINE.slice(from, d.shown)
      rd._line(ctx, tiles, 'rgba(245,208,96,0.8)', 3, [2, 6])
      if (this.dragStage === 'draw') {           // the fingertip, at the head of the line
        const h = tiles[tiles.length - 1], p = h && rd._ground(h[0] + 0.5, h[1] + 0.5)
        if (p) {
          ctx.beginPath(); ctx.arc(p[0], p[1], 9, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(255,244,205,0.85)'; ctx.fill(); ctx.strokeStyle = 'rgba(245,208,96,0.95)'; ctx.lineWidth = 3; ctx.stroke()
        }
      }
    }
    ctx.restore()
  }

  /** the tally over the dummy, what each blow added, the tile you strike at */
  _drawDummy(ctx) {
    const at = this.dummy.at
    if (!at || !this.dummyMode) return
    const view = this.scene._melee?.view
    if (this.m.enGarde && cheb(this._tile(), at) === 1) view?.tileQuad?.(ctx, at, 'rgba(245,208,96,0.12)', 'rgba(245,208,96,0.7)', 1.5)
    const b = figureAt(this.scene, at[0], at[1] - 0.5)
    if (!b) return
    const fs = Math.max(11, b.w * 0.22)
    ctx.save()
    ctx.textAlign = 'center'; ctx.font = `bold ${fs}px 'Courier Prime','Courier New',monospace`
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.fillStyle = '#f3e6c4'
    const label = this.dummyMode === 'score' ? `${Math.min(this.points, DUMMY_GOAL)} / ${DUMMY_GOAL}` : `${this.goal?.n ?? PASSES} / ${PASSES}`
    const ty = b.y - b.h * 1.25
    ctx.strokeText(label, b.x, ty); ctx.fillText(label, b.x, ty)
    this.floats = this.floats.filter(f => this.t - f.t0 < 900)
    for (const f of this.floats) {
      const k = (this.t - f.t0) / 900
      ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ffd36b'
      const y = ty - fs * (1 + k * 1.6)
      ctx.strokeText(f.text, b.x + fs, y); ctx.fillText(f.text, b.x + fs, y)
    }
    ctx.restore()
  }

  // ── the frame ────────────────────────────────────────────────────────────
  update(dt) {
    this.t += Math.min(50, dt)
    for (const q of this.queue.slice()) if (this.t >= q.at) { this.queue.splice(this.queue.indexOf(q), 1); q.fn() }
    this.drill?.update()
    this._carryTick()
    if (this.m.pa.onRoute()) this.routeT = this.t
    if (this.id === 'drag' && this.demo) this._dragTick()
    if (this.id === 'mark') {
      if (this._onTile(START)) { const f = this._afterMark; this._afterMark = null; this.id = 'markDone'; this._mark(null); f?.() }
      else if (this.t >= this._markHintAt) { this._say(SCRIPT.meet.standAgain, 2400); this._markHintAt = this.t + HINT_AFTER_MS }
    }
    if (this.id === 'tap' && this.tapWait) {
      if (this._onTile(TAP_SPOTS[this.round])) this._tapReached()
      else if (this.t >= this.tapHintAt) { this._hint(SCRIPT.tap.hint); this.tapHintAt = this.t + HINT_AFTER_MS }
    }
    const g = this.goal
    if (g && this.speaking) { g.t0 = this.t; g.hintAt = this.t + HINT_AFTER_MS }
    if (g) {
      g.tick?.()
      if (this.goal === g && g.hint && this.t >= g.hintAt) { this._hint(g.hint); g.hintAt = this.t + HINT_AFTER_MS }
      if (this.goal === g && this.t - g.t0 >= (g.giveUp ?? GIVE_UP_MS)) {         // let it go
        this.goal = null
        this._prompt(null)
        this.dummyMode = null
        this._say(SCRIPT.generic.giveUp, 3000)
        if (this.id === 'duel') this._boutOff()
        const id = this.id
        this._later(3200, () => {
          if (id === 'feet') this._carryAway(() => this._finish(id, 0))
          else this._finish(id, 0)
        })
      }
    }
  }

  destroy() {
    this.drill?.destroy(); this.drill = null
    const p = this.scene.player
    if (p?._courseWrapped) { p.setPath = p._courseOrigSetPath; p._courseWrapped = false }
    const rd = this.scene._routeDraw
    if (rd?._courseWrapped) { rd._commit = rd._courseOrigCommit; rd.move = rd._courseOrigMove; rd.end = rd._courseOrigEnd; rd._courseWrapped = false }
    if (this.id === 'duel') { try { this._boutOff() } catch (_) {} }
    try { this.dummy.destroy() } catch (_) {}
    this._mark(null)
    this._prompt(null)
    try { this._voice?.stop() } catch (_) {}
  }
}

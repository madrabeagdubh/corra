// faicheCourse.js
// Location: js/game/scenes/locations/skye/faicheCourse.js
//
// The crash course: Conall, alone with you in the garden (skyeGairdin.js: the
// ráth, with its board of stones), one lesson after another. The green is for
// the dummy, the spar and the tournament afterwards.
//
// THE WORDS are all in courseScript.js. This file is the LOGIC: it runs the
// lessons in ORDER, each one asking for something and watching for it.
//
//   meet      he introduces himself; stand on the mark
//   dirs      forward / back / left / right, called in Irish, the brooch glowing
//   compass   north / south / east / west
//   tap       tap-to-move (switches taps on: note lesson_movement)
//   sword     he throws you a practice sword; you catch it (it's yours, equipped)
//   calls     draw / sheathe / salute / strike / steps, called at random
//   cuts      the cut, then the strong blow (hold the moon)
//   fatigue   cut until you're winded; stand still till it passes
//   dodge     a real bout (a novice): step back from his blow
//   counter   step back, he misses, step in and cut
//   charge    a strong blow on his guard; his sword flies; give it back
//   shove     walk into him
//   end       COURSE_DONE: the green is open
//
// Progress is kept in notes (faiche_course_<id>; tap uses lesson_movement), so
// coming back picks up at the first lesson not yet done.
//
// The combat lessons are real bouts with a safety net: a blow that hurts you
// heals at once (you cannot lose), a stalled lesson gets a plain hint, and a
// lesson that goes on too long is let go (courseScript HINT_AFTER_MS, GIVE_UP_MS).

import { GameState } from '../../../systems/gameState.js'
import { SoundBoard } from '../../../systems/soundBoard.js'
import { VoiceSynth } from '../../../systems/voice/voiceSynth.js'
import { PRESETS } from '../../../combat/melee.js'
import { prepareSword, SWORD_ID } from '../../../combat/meleeBout.js'
import StepDrill from './stepDrill.js'
import SkyeCaption from './skyeCaption.js'
import { figureBox } from './dustDash.js'
import { SCRIPT, HINT_AFTER_MS, GIVE_UP_MS } from './courseScript.js'

// the host scene (skyeGairdin.js) provides: _caption, _melee (Conall's bout),
// player, tileSize, and
//   courseMarker(tile|null)   a pulsing ring on a tile
//   courseLit(tile)           light a stone of the board (null clears them all)
const VOICE = ['ronnie', 'Ador']
const WARDEN_COLOR = '#c6d4ea', HINT_COLOR = '#a9b3bd'

export const WARDEN_NAME = 'Conall'
export const MET = 'faiche_course_met'
export const DIRS_DONE = 'faiche_course_dirs'
export const COMPASS_DONE = 'faiche_course_compass'
export const TAP_DONE = 'lesson_movement'
export const COURSE_DONE = 'faiche_kata_done'      // the whole course (the green waits for it)

export const ORDER = ['meet', 'dirs', 'compass', 'tap', 'sword', 'calls', 'cuts', 'fatigue', 'strong', 'dodge', 'counter', 'charge', 'shove', 'end']
const NOTE = { meet: MET, dirs: DIRS_DONE, compass: COMPASS_DONE, tap: TAP_DONE }
const noteOf = id => NOTE[id] || `faiche_course_${id}`

const START = [18, 18]                     // the lár, the board's centre stone
export const LEDGE_AT = [18, 7]            // where he teaches from: the ledge built into the earthen ring
export const FIGHT_AT = [18, 14]           // where he comes down to, for a bout
const TAP_SPOTS = [[21, 17], [15, 19], [18, 14]]   // the three marks for the tap lesson: all on screen from the lár
const COUNTER_WINDOW_MS = 3500             // a cut this soon after his miss is a counter
const NEAR_FIGHT = 4                       // a bout starts within 5 tiles of him

// the brooch calls. glow: 1 = lit, fading to 0 = only the word.
const D = (dir, ga, en, glow, count) => ({ dir, ga, en, glow, count })
const DIR_CALLS = [
  D('forward', 'Ar aghaidh', 'Forward', 1),
  D('right',   'Ar dheis',   'Right',   1),
  D('back',    'Ar gcúl',    'Back',    1),
  D('left',    'Ar chlé',    'Left',    1),
  D('forward', 'Ar aghaidh', 'Forward', 0.55, 2),
  D('right',   'Ar dheis',   'Right',   0.35),
  D('back',    'Ar gcúl',    'Back',    0.2, 2),
  D('left',    'Ar chlé',    'Left',    0),
]
// north is up the screen, towards the dais
const COMPASS_CALLS = [
  D('forward', 'Ó thuaidh', 'North', 0.6, 2),
  D('right',   'Soir',      'East',  0.4),
  D('back',    'Ó dheas',   'South', 0.25, 2),
  D('left',    'Siar',      'West',  0),
  D('right',   'Soir',      'East',  0, 2),
  D('forward', 'Ó thuaidh', 'North', 0),
  D('left',    'Siar',      'West',  0, 2),
  D('back',    'Ó dheas',   'South', 0),
]
// what a step looks like, by the word for it

const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1]
const asList = x => (Array.isArray(x) ? x : [x])

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
    this.throwFx = null
    this._wrapSetPath()
    this._next()
  }

  get m() { return this.scene._melee.melee }

  /** Tap-to-move works from the tap lesson on (or if it was learned before). */
  tapsOn() { return GameState.hasNote(TAP_DONE) || this.id === 'tap' }

  // ── plumbing ─────────────────────────────────────────────────────────────
  _later(ms, fn) { this.queue.push({ at: this.t + ms, fn }) }
  _say(line, ms, color = WARDEN_COLOR, voiced = true) {
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
  _hint(line) { this._say(line, 4200, HINT_COLOR, false) }
  _holdOf(line) { return line.ms ?? SkyeCaption.holdFor(line.en) }

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

  // the caption as Conall's, for StepDrill
  _drillCaption() {
    return { show: (ga, en, ms) => this._say({ ga, en }, ms ?? 2200) }
  }

  // ── goals: "do this", watched through the bout's events ─────────────────
  //   on(name, d) -> true to count it       need  how many
  //   hint        a plain instruction if you stall      done()  when met
  //   tick()      each frame (optional)    other(name, d)  any other event
  _goal(g) {
    // listening starts now, while he is still talking: hints only after he has finished (g.after)
    this.goal = { need: 1, n: 0, ...g, t0: this.t, hintAt: this.t + (g.after || 0) + HINT_AFTER_MS }
  }
  _goalDone() {
    const g = this.goal; this.goal = null
    this.queue = []                       // a pending word of praise must not talk over what comes next
    this._later(0, () => g.done?.())
  }
  onMeleeEvent(name, d) {
    const g = this.goal
    if (!g) return
    if (g.on?.(name, d)) {
      g.n++; g.t0 = this.t; g.hintAt = this.t + HINT_AFTER_MS
      g.onCount?.(g.n)
      if (g.n >= g.need) return this._goalDone()
    }
    g.other?.(name, d)
  }

  // ── which lesson next ────────────────────────────────────────────────────
  _next() {
    this.goal = null
    const id = ORDER.find(i => i !== 'end' && !GameState.hasNote(noteOf(i))) || 'end'
    this.id = id
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
    this._later(2500, () => this._seq(S.intro, () => { GameState.addNote(MET); this._toMark(() => this._next()) }))
  }

  // stand on the mark, then go on
  _toMark(then) {
    this.id = 'mark'
    this._mark([...START])
    this.m.HOME = [...LEDGE_AT]
    this._say(SCRIPT.meet.stand, 2600)
    this._afterMark = then
    this._markHintAt = this.t + HINT_AFTER_MS
  }

  // ── directions ───────────────────────────────────────────────────────────
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

  // ── compass ──────────────────────────────────────────────────────────────
  _compass() {
    if (!this._onTile(START)) return this._toMark(() => { this.id = 'compass'; this._compass() })
    const S = SCRIPT.compass
    this._mark(null)
    this._seq(S.intro, () => {
      this.drill = new StepDrill(this.scene, {
        caption: this._drillCaption(), steps: COMPASS_CALLS, onCorrect: (st, tile) => this.scene.courseLit?.(tile),
        onDone: () => this._drillDone('compass', S.done),
      })
      this._later(600, () => this.drill?.start())
    })
  }

  _drillDone(id, doneLines) {
    this.drill?.destroy(); this.drill = null
    this.scene.courseLit?.(null)
    GameState.addNote(noteOf(id))
    this.id = 'between'
    this._later(500, () => this._seq(doneLines, () => this._next()))
  }

  // ── tap-to-move ──────────────────────────────────────────────────────────
  _tap() {
    this._mark(null)
    this.round = 0
    this.m.HOME = [...LEDGE_AT]
    const S = SCRIPT.tap
    this._seq(S.intro, () => this._tapRound())
  }
  _tapRound() {
    this.tapped = false
    this._mark([...TAP_SPOTS[this.round]])
    this.tapHintAt = this.t + HINT_AFTER_MS
    this.tapWait = true
  }
  _tapReached() {
    const S = SCRIPT.tap
    this.tapWait = false
    this._mark(null)
    this._say(this.tapped ? S.tapped : S.walked, 2400)
    this.round++
    if (this.round >= TAP_SPOTS.length) {
      GameState.addNote(TAP_DONE)
      this.id = 'between'
      this._later(2800, () => this._seq(S.done, () => this._next()))
      return
    }
    this._later(2800, () => { this._say(this.round === 1 ? S.again : S.further, 1600); this._later(1800, () => this._tapRound()) })
  }

  // ── the sword: thrown, caught, yours ─────────────────────────────────────
  _sword() {
    const S = SCRIPT.sword
    this.m.HOME = [...LEDGE_AT]
    this._seq(S.intro, () => {
      this._say(S.throw, 1400)
      this.throwFx = { t0: this.t, ms: 900 }
      this._later(950, () => {
        this.throwFx = null
        this._giveSword()
        this._seq(S.caught, () => this._seq(S.done, () => this._finish('sword', 200)))
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
  /** The sword in flight, from the scene's onPGRDrawComplete. */
  draw(ctx) {
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

  // ── the moon's gesture, shown (as the stars are in the constellation scene) ─
  _prompt(kind) { this.scene.moonPrompt?.(kind) }
  /** show `kind` on the moon while the blade is out, a swipe up while it is not */
  _promptFor(kind) { this._prompt(this.m.enGarde ? kind : 'up') }

  // ── calls: how the blade is carried ──────────────────────────────────────
  // draw, salute, sheathe, (good), draw: each said, the gesture shown on the
  // moon, and done when you do it. He listens from the moment he says it.
  _calls() {
    const S = SCRIPT.calls, m = this.m
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
      this._say(st.say); this._prompt(st.p)
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
    this._say(S.intro)
    this._goal({
      need: 4, hint: S.hint, after: 2000,
      on: (name, d) => name === 'swing' && !d.charged,
      onCount: n => { if (n === 1 || n === 2) this._say(S.again); else if (n === 3) this._say(S.faster) },
      tick: () => this._promptFor('tap'),
      done: () => { this._prompt(null); this._say(S.good); this._later(1700, () => this._seq(S.hardWork, () => this._finish('cuts', 300))) },
    })
  }

  // ── fatigue: when to give everything, when to hold back ──────────────────
  _fatigue() {
    const S = SCRIPT.fatigue
    this._goal({
      after: this._seq(S.intro), hint: S.hint,
      on: name => name === 'winded',
      tick: () => this._promptFor('tap'),
      done: () => {
        this._prompt(null)
        this._seq(S.winded, () => {
          this._say(S.rest)
          this._goal({
            hint: S.rest, on: name => name === 'unwinded',
            done: () => this._seq([S.rested, S.done], () => this._finish('fatigue', 300)),
          })
        })
      },
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

  // ── bouts: dodge, counter, charge, shove ─────────────────────────────────
  // Conall comes down off the ledge and fights in earnest, but a blow that
  // lands heals at once: you can't lose.
  _boutOn(preset) {
    const m = this.m
    m.F = { ...PRESETS[preset], hp: 40 }
    m.foe.hp = 40
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
    m.HOME = [...LEDGE_AT]                          // back up to the ledge
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
  /** events every bout lesson wants: heal when hit; a yield or loss is just a restart */
  _boutOther(S) {
    return (name, d) => {
      if (name === 'hit' && d.on === 'player') { this._heal(); if (S?.hurt) this._say(S.hurt, 2600) }
      if (name === 'boutOver' && !d.won) this._heal()
    }
  }

  _dodge() {
    const S = SCRIPT.dodge
    this._atMark(() => {
      const after = this._seq(S.intro)
      this._boutOn('novice')
      this._goal({
        need: 2, hint: S.hint, after,
        on: (name, d) => name === 'dodge' || (name === 'miss' && d.by === 'foe'),
        onCount: n => { if (n < 2) this._seq(S.good) },
        tick: () => { if (!this.m.enGarde) this._prompt('up'); else this._prompt(null) },
        other: this._boutOther(S),
        done: () => { this._boutOff(); this._seq(S.done, () => this._finish('dodge', 200)) },
      })
    })
  }

  _counter() {
    const S = SCRIPT.counter
    this._atMark(() => {
      const after = this._seq(S.intro)
      this._boutOn('novice')
      let missAt = -1e9
      this._goal({
        need: 2, hint: S.hint, after,
        on: (name, d) => {
          if (name === 'dodge' || (name === 'miss' && d.by === 'foe')) missAt = this.t
          return name === 'hit' && d.on === 'foe' && this.t - missAt <= COUNTER_WINDOW_MS
        },
        onCount: n => { if (n < 2) this._say(S.good[0], 1600) },
        tick: () => { if (!this.m.enGarde) this._prompt('up'); else this._prompt(null) },
        other: this._boutOther(S),
        done: () => { this._say(S.good[1], 2200); this._boutOff(); this._later(2400, () => this._seq(S.done, () => this._finish('counter', 200))) },
      })
    })
  }

  _charge() {
    const S = SCRIPT.charge, m = this.m
    this._atMark(() => {
      const after = this._seq(S.intro)
      this._boutOn('warden')
      this._goal({
        need: 1, hint: S.hint, after,
        on: (name) => name === 'disarm',
        tick: () => this._promptFor('hold'),
        other: (name, d) => {
          this._boutOther(S)(name, d)
          // a strong blow against his guard: the blades meet hard, and his sword flies
          const strong = (name === 'parried' && d.by === 'foe') || (name === 'hit' && d.on === 'foe' && d.charged) || name === 'clash'
          if (strong && this.lastCharged && m.foe.armed && !m.dropped) this._later(250, () => { if (!m.dropped) m._disarmFoe?.() })
          if (name === 'swing' && !d.air) this.lastCharged = !!d.charged
          if (name === 'struckUnarmed') { this.goal = null; this._boutOff(); this._seq(S.struck, () => this._finish('charge', 200)) }
        },
        done: () => {
          this._prompt(null)
          this._say(S.disarmed, 4200)
          this._goal({
            need: 1, hint: S.giveBack,
            on: name => name === 'swordReturned',
            other: (name) => {
              if (name === 'swordRecovered') this._say(S.giveBack, 3000, HINT_COLOR, false)
              if (name === 'struckUnarmed') { this.goal = null; this._boutOff(); this._seq(S.struck, () => this._finish('charge', 200)) }
            },
            done: () => { this._boutOff(); this._seq([S.returned, S.done], () => this._finish('charge', 200)) },
          })
        },
      })
    })
  }

  _shove() {
    const S = SCRIPT.shove
    this._atMark(() => {
      const after = this._seq(S.intro)
      this._boutOn('warden')
      this._goal({
        need: 2, hint: S.hint, after,
        on: (name, d) => name === 'shove' && !d.by,
        onCount: n => { if (n < 2) this._say(S.good[0]) },
        tick: () => { if (!this.m.enGarde) this._prompt('up'); else this._prompt(null) },
        other: this._boutOther(S),
        done: () => { this._boutOff(); this._seq(S.done, () => this._finish('shove', 200)) },
      })
    })
  }

  // ── the end: the green is open ───────────────────────────────────────────
  _end() {
    this.id = 'end'
    this._mark(null)
    this._seq(SCRIPT.end.intro, () => { GameState.addNote(COURSE_DONE); this.finished = true })
  }

  // ── the frame ────────────────────────────────────────────────────────────
  update(dt) {
    this.t += Math.min(50, dt)
    for (const q of this.queue.slice()) if (this.t >= q.at) { this.queue.splice(this.queue.indexOf(q), 1); q.fn() }
    this.drill?.update()
    if (this.id === 'mark') {
      if (this._onTile(START)) { const f = this._afterMark; this._afterMark = null; this.id = 'markDone'; this._mark(null); f?.() }
      else if (this.t >= this._markHintAt) { this._say(SCRIPT.meet.standAgain, 2400); this._markHintAt = this.t + HINT_AFTER_MS }
    }
    if (this.id === 'tap' && this.tapWait) {
      if (this._onTile(TAP_SPOTS[this.round])) this._tapReached()
      else if (this.t >= this.tapHintAt) { this._hint(SCRIPT.tap.hint); this.tapHintAt = this.t + HINT_AFTER_MS }
    }
    const g = this.goal
    if (g) {
      g.tick?.()
      if (this.goal === g && g.hint && this.t >= g.hintAt) { this._hint(g.hint); g.hintAt = this.t + HINT_AFTER_MS }
      if (this.goal === g && this.t - g.t0 >= GIVE_UP_MS) {         // let it go
        this.goal = null
        this._prompt(null)
        this._say(this.id === 'charge' ? SCRIPT.charge.giveUp : SCRIPT.generic.giveUp, 3000)
        if (['dodge', 'counter', 'charge', 'shove'].includes(this.id)) this._boutOff()
        this._later(3200, () => this._finish(this.id, 0))
      }
    }
  }

  destroy() {
    this.drill?.destroy(); this.drill = null
    const p = this.scene.player
    if (p?._courseWrapped) { p.setPath = p._courseOrigSetPath; p._courseWrapped = false }
    if (['dodge', 'counter', 'charge', 'shove'].includes(this.id)) { try { this._boutOff() } catch (_) {} }
    this._mark(null)
    this._prompt(null)
    try { this._voice?.stop() } catch (_) {}
  }
}

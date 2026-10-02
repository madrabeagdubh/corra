// faicheTournament.js
// Location: js/game/scenes/locations/skye/faicheTournament.js
//
// The tournament on the green, once the lessons are done (faiche_spar_done).
//
//   The Warden referees from the north side of the ring. Your place is
//   marked at the south edge: stand on it and he calls the next student in.
//   They walk out to the middle; go en garde and fight. Easiest first:
//
//     Ciarán   a beginner (novice)       Fial      fast, no guard (brawler)
//     Bearach  reads your route (spar)   Laoise    stands firm (warden)
//     Fer Diad the best of them (master)
//
//   Win and they yield; your hearts come back, a few more students come to
//   watch, and the next is waiting. Lose (or yield) and it's the same one
//   again when you're ready. Each win is kept: faiche_tourney_<n>.
//
//   Beat Fer Diad and Uathach comes down from the dais, steel in her hand:
//   the first live blade you've faced. Nothing you do lands; she never cuts
//   you; she throws you, three times. Then she salutes, sheathes, and tosses
//   you a coin -- and the brooch turns silver (note brooch_silver). Note
//   faiche_tournament_done; the Warden is your sparring partner again.
//
// PLACEHOLDER lines: English in both slots.

import { GameState } from '../../../systems/gameState.js'
import { SoundBoard } from '../../../systems/soundBoard.js'
import { VoiceSynth } from '../../../systems/voice/voiceSynth.js'
import { SKYE_GID } from './skyeScene.js'
import MeleeBout from '../../../combat/meleeBout.js'

export const TOURNEY_DONE = 'faiche_tournament_done'
const WON = i => `faiche_tourney_${i}`

const OPPONENTS = [
  { id: 'ciaran',  kind: 'novice',  name: 'Ciarán' },
  { id: 'fial',    kind: 'brawler', name: 'Fial' },
  { id: 'bearach', kind: 'spar',    name: 'Bearach' },
  { id: 'laoise',  kind: 'warden',  name: 'Laoise' },
  { id: 'ferdiad', kind: 'master',  name: 'Fer Diad' },
]
const REF_AT = [18, 11]                 // the Warden, refereeing from the north edge
const MARK = [18, 25]                   // your place, at the south edge
const U_DOWN = [[18, 8], [18, 9], [18, 10], [18, 11], [18, 12], [18, 13], [18, 14], [18, 15]]
const U_UP = [[18, 14], [18, 13], [18, 12], [18, 11], [18, 10], [18, 9], [18, 8], [18, 7]]
const COIN_MS = 900

const L = (en, ga = en) => ({ ga, en })
const LINES = {
  open:     L('The tournament. Take your place when you are ready.'),
  call:     n => L(`${n}! Into the ring.`),
  begin:    L('Begin!'),
  yields:   n => L(`${n} yields. Well fought.`),
  again:    L('Again, when you are ready.'),
  uathach:  L('Uathach!'),
  uDraw:    L('No wood, this time. Come.'),
  uAgain:   L('Again.'),
  coin:     L('Keep it. You will do.'),
  done:     L('That is the tournament. The green is yours, whenever you want it.'),
}
const WARDEN_COLOR = '#c6d4ea', UATHACH_COLOR = '#ffb25c'
const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]))

export default class FaicheTournament {
  constructor(scene, { crowd, lesson, grounds }) {
    this.scene = scene; this.crowd = crowd; this.lesson = lesson; this.grounds = grounds
    this.t = 0
    this.queue = []
    this.round = OPPONENTS.findIndex((_, i) => !GameState.hasNote(WON(i)))
    if (this.round < 0) this.round = OPPONENTS.length                  // Uathach next
    this.phase = 'wait'
    this.coin = null
    // the Warden steps out of the fight to referee: a figure of his own
    scene._melee?.destroy()
    scene._melee = new MeleeBout(scene)                                // your sword, no one to fight
    this.ref = { tileX: REF_AT[0], tileY: REF_AT[1], visual: { gid: SKYE_GID.WARDEN, flat: false }, offset: [0, 0], pose: { sx: 1 } }
    const pgr = scene.perspectiveGround
    pgr?.setEncounterFlags([...(pgr._encounterFlags || []), this.ref])
    // the crowd's grown with every win so far
    for (let i = 0; i < Math.min(this.round, 2); i++) crowd.addStudent()
    grounds.marker = MARK
    this._say(LINES.open, 3200)
  }

  // ── speech ───────────────────────────────────────────────────────────────
  _say(line, ms = 2400, who = 'warden') {
    const cap = this.scene._caption
    if (cap) { cap.setColor(who === 'uathach' ? UATHACH_COLOR : WARDEN_COLOR); cap.show(line.ga, line.en, ms) }
    if (!this.voices) this.voices = {}
    if (!this.voices[who]) { const ac = SoundBoard.ctx(this.scene); this.voices[who] = ac ? new VoiceSynth({ audioContext: ac, volume: 0.55 }) : null }
    const [voice, tuneKey] = who === 'uathach' ? ['seanchai', 'Dmix'] : ['ronnie', 'Ador']
    try { this.voices[who]?.stop(); this.voices[who]?.speak(line.ga, { voice, tuneKey }) } catch (_) {}
  }
  _later(ms, fn) { this.queue.push({ at: this.t + ms, fn }) }
  _playerTile() { const p = this.scene.player, ts = this.scene.tileSize; return [Math.floor(p.logicalX / ts), Math.floor(p.logicalY / ts)] }
  _onMark() { const [c, r] = this._playerTile(); return c === MARK[0] && r === MARK[1] && !this.scene.player.isMoving }
  _heal() { const p = this.scene.player; if (p) p.heal(p.maxHP) }
  get home() { return [...this.scene._wardenHome] }

  // ── the frame ────────────────────────────────────────────────────────────
  update(dt) {
    this.t += Math.min(50, dt)
    for (const q of this.queue.slice()) if (this.t >= q.at) { this.queue.splice(this.queue.indexOf(q), 1); q.fn() }
    if (this.phase === 'wait' && this._onMark() && this.t > (this.readyAt || 0)) this._next()
    if (this.phase === 'uWalk') this._uathachArrives()
  }

  // ── a bout ───────────────────────────────────────────────────────────────
  _next() {
    if (this.round >= OPPONENTS.length) return this._callUathach()
    const o = OPPONENTS[this.round], s = this.crowd.byId(o.id)
    this.phase = 'bout'
    this.grounds.marker = null
    this._say(LINES.call(o.name), 2200)
    // they step out of the crowd into the middle of the ring
    const from = s ? [s.c, s.r] : [this.home[0], this.home[1] - 3]
    if (s) this.crowd.withdraw(s)
    this.scene._melee?.destroy()
    const b = this.scene._melee = new MeleeBout(this.scene, { kind: o.kind, home: this.home, gid: s?.gid || SKYE_GID.WARDEN, voice: s?.voice || 'dallan' })
    b.melee.foe.c = from[0]; b.melee.foe.r = from[1]
    this.opp = { o, s }
    this._later(2600, () => this._say(LINES.begin, 1200))
  }

  onMeleeEvent(name, d = {}) {
    if (name === 'boutOver' && this.phase === 'bout') this._boutOver(!!d.won)
    if (name === 'thrownOut' && this.phase === 'uFight') this._thrown()
    if (name === 'boutOver' && this.phase === 'uFight') this._later(2800, () => { if (!this.thrownDone) this._say(LINES.uAgain, 1600, 'uathach') })
  }

  _boutOver(won) {
    this.phase = 'after'
    const { o, s } = this.opp
    if (won) {
      GameState.addNote(WON(this.round))
      this._later(1800, () => this._say(LINES.yields(o.name), 2400))
      this.round++
    } else this._later(2200, () => this._say(LINES.again, 2000))
    // hearts back; they walk back to the crowd; a few more come to watch
    this._later(4200, () => {
      this._heal()
      const at = this.scene._melee?.melee?.foe
      if (s) this.crowd.restore(s, at ? [at.c, at.r] : s.home)
      this.scene._melee?.destroy()
      this.scene._melee = new MeleeBout(this.scene)
      if (won && this.round <= 2) this.crowd.addStudent()
      this.grounds.marker = MARK
      this.phase = 'wait'
      this.readyAt = this.t + 800
    })
  }

  // ── Uathach ──────────────────────────────────────────────────────────────
  _callUathach() {
    this.phase = 'uWalk'
    this.grounds.marker = null
    this._say(LINES.uathach, 2000)
    const u = this.lesson.u
    u.path = U_DOWN.slice()
  }

  _uathachArrives() {
    const u = this.lesson.u
    if (u.path.length || u.from) return
    this.phase = 'uFight'
    this.thrownDone = false
    u.flag.hidden = true
    this.scene._melee?.destroy()
    const b = this.scene._melee = new MeleeBout(this.scene, { kind: 'uathach', home: this.home, gid: SKYE_GID.UATHACH, voice: 'seanchai' })
    b.melee.foe.c = u.c; b.melee.foe.r = u.r
    this._say(LINES.uDraw, 2400, 'uathach')
  }

  // the third throw: a salute (the bout's end), her sword away, and a coin
  _thrown() {
    this.thrownDone = true
    this.phase = 'coin'
    this._later(4400, () => {
      const b = this.scene._melee
      const from = b?.view?.foeFigure?.(), to = b?.view?.playerFigure?.()
      this.coin = { t0: performance.now(), from, to }
      SoundBoard.playWeb('SWORD_SWISH', this.scene, { pitch: 2.2, dur: 0.1, volume: 0.08 })
    })
    this._later(4400 + COIN_MS, () => {
      SoundBoard.playWeb('BLADE_KNOCK', this.scene, { hard: 0.05, pitch: 2.6, volume: 0.35 })
      this._later(120, () => SoundBoard.playWeb('BLADE_KNOCK', this.scene, { hard: 0.03, pitch: 2.9, volume: 0.2 }))
      this.coin = null
      GameState.addNote('brooch_silver')
      this.scene.joystick?.setMetal?.('silver')
      SoundBoard.playWeb('CROWD_CLAP', this.scene, { n: this.crowd.students.length, dur: 2.6, warmth: 1 })
      this._say(LINES.coin, 2600, 'uathach')
    })
    this._later(4400 + COIN_MS + 3400, () => this._finish())
  }

  _finish() {
    GameState.addNote(TOURNEY_DONE)
    this.phase = 'done'
    // she goes back up; the Warden is a sparring partner again
    const u = this.lesson.u, f = this.scene._melee?.melee?.foe
    if (f) { u.c = f.c; u.r = f.r }
    u.flag.hidden = false
    u.path = U_UP.slice()
    this.scene._melee?.destroy()
    this.scene._melee = new MeleeBout(this.scene, { kind: 'warden', home: this.home, gid: SKYE_GID.WARDEN })
    this.scene._melee.melee.foe.c = REF_AT[0]; this.scene._melee.melee.foe.r = REF_AT[1]
    const pgr = this.scene.perspectiveGround
    if (pgr?._encounterFlags) pgr.setEncounterFlags(pgr._encounterFlags.filter(fl => fl !== this.ref))
    this._later(2000, () => this._say(LINES.done, 3200))
  }

  // ── drawing ──────────────────────────────────────────────────────────────
  // the coin, tossed: a little gold disc turning over in the air
  draw(ctx) {
    const c = this.coin
    if (!c?.from || !c?.to) return
    const k = Math.min(1, (performance.now() - c.t0) / COIN_MS)
    const x = c.from.x + (c.to.x - c.from.x) * k
    const y = c.from.y - c.from.h * 0.6 + (c.to.y - c.to.h * 0.5 - (c.from.y - c.from.h * 0.6)) * k - Math.sin(Math.PI * k) * c.from.h * 1.6
    const r = Math.max(3, c.from.w * 0.09), turn = Math.abs(Math.cos(k * Math.PI * 7))
    ctx.save()
    ctx.fillStyle = '#e8c45a'; ctx.strokeStyle = '#8a6a1c'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.ellipse(x, y, r * Math.max(0.15, turn), r, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.globalAlpha = 0.6 * turn; ctx.fillStyle = '#fff6d0'
    ctx.beginPath(); ctx.ellipse(x - r * 0.25 * turn, y - r * 0.3, r * 0.25 * turn, r * 0.25, 0, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  destroy() {
    const pgr = this.scene.perspectiveGround
    if (pgr?._encounterFlags) pgr.setEncounterFlags(pgr._encounterFlags.filter(fl => fl !== this.ref))
    for (const v of Object.values(this.voices || {})) { try { v?.stop() } catch (_) {} }
  }
}

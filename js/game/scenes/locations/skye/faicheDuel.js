// faicheDuel.js
// Location: js/game/scenes/locations/skye/faicheDuel.js
//
// Two students fencing for show while you are at your lesson. Scripted, not the melee engine (that is built round
// one player and one foe): faicheTournament.js calls them in by name, and this walks them out, salutes, waits to
// be let go, trades a run of cuts that quicken as they go (chaka-ta-chaka-ta: the rhythm of the parry lesson),
// salutes again, sheathes and sends them home.
//
//   const d = new StagedDuel(scene, crowd, a, b, [c, r], { onDone })   a, b: crowd students; [c, r] is a's tile, b stands east of it
//   d.update(dt)        every frame
//   d.ready             both stand saluted in the ring, waiting
//   d.release()         let them fight (once, when ready)
//   d.paused = true     everything holds where it is (someone walked into the ring)
//   d.abort()           swords away, off home
//
// The swords are the crowd's own (student.kit, a FigureSword); the lean of a cut is crowd.kick(s).

import { SoundBoard } from '../../../systems/soundBoard.js'
import { SALUTE_MS, DRAW_MS, SHEATHE_MS } from '../../../combat/meleeView.js'

const CUTS = 9                    // blows traded, a and b in turn
const FIRST_MS = 1150             // the gap before the next cut: starts here...
const QUICKEN_MS = 80             // ...shortens by this with every cut...
const MIN_MS = 480                // ...down to this
const HIT_AT = 150                // a cut's blade meets the other's this long after it starts

export default class StagedDuel {
  constructor(scene, crowd, a, b, at, { onDone } = {}) {
    this.scene = scene; this.crowd = crowd; this.a = a; this.b = b
    this.onDone = onDone || (() => {})
    this.t = 0; this.q = []
    this.phase = 'walk'              // walk -> guard -> ready -> trade -> bow -> away -> done
    this.paused = false
    this.released = false
    this.cut = 0; this.nextCut = 0; this.until = 0; this.mark = 0
    a.goal = [at[0], at[1]]; a.faceGoal = 1
    b.goal = [at[0] + 1, at[1]]; b.faceGoal = -1
  }

  get ready() { return this.phase === 'ready' }
  get done() { return this.phase === 'done' }
  release() { this.released = true }

  _after(ms, fn) { this.q.push({ at: this.t + ms, fn }) }
  _both(fn) { fn(this.a); fn(this.b) }
  _arrived() {
    const at = (s) => s.goal && s.c === s.goal[0] && s.r === s.goal[1] && !s.from
    return at(this.a) && at(this.b)
  }

  update(dt) {
    if (this.paused || this.phase === 'done') return
    this.t += Math.min(50, dt)
    for (const e of this.q.slice()) if (this.t >= e.at) { this.q.splice(this.q.indexOf(e), 1); e.fn() }
    const now = performance.now()
    switch (this.phase) {
      case 'walk':
        if (this._arrived()) { this._both(s => s.kit.salute(now)); this.mark = this.t; this.phase = 'guard' }
        break
      case 'guard':                                              // the draw and the salute play out
        if (this.t - this.mark >= DRAW_MS + SALUTE_MS + 300) this.phase = 'ready'
        break
      case 'ready':
        if (this.released) { this.phase = 'trade'; this.nextCut = this.t + 300 }
        break
      case 'trade':
        if (this.t >= this.nextCut) this._cut()
        break
      case 'bow':
        if (this.t >= this.until) {
          this._both(s => s.kit.sheathe(performance.now()))
          this.until = this.t + SHEATHE_MS + 400; this.phase = 'away'
        }
        break
      case 'away':
        if (this.t >= this.until) { this._home(); this.phase = 'done'; this.onDone() }
        break
    }
  }

  _cut() {
    const att = this.cut % 2 ? this.b : this.a, def = att === this.a ? this.b : this.a
    const n = this.cut
    att.kit.swing(performance.now(), 300); this.crowd.kick(att)
    this._after(HIT_AT, () => {                                  // and it is turned, a little higher each time
      SoundBoard.playWeb('BLADE_KNOCK', this.scene, { hard: 0.7, pitch: (0.9 + Math.random() * 0.25) * (1 + 0.03 * n), volume: 0.26 })
      this.crowd.kick(def)
    })
    this.cut++
    this.nextCut = this.t + Math.max(MIN_MS, FIRST_MS - QUICKEN_MS * this.cut)
    if (this.cut >= CUTS) {                                      // the last is turned; a breath; they salute
      this.phase = 'bow'
      this._after(700, () => this._both(s => s.kit.salute(performance.now())))
      this.until = this.t + 700 + SALUTE_MS + 300
    }
  }

  _home() {
    this._both(s => { s.kit.hide(); s.goal = null; s.faceGoal = null })
  }

  // out of the way at once (the scene is leaving, or the tournament has moved on)
  abort() {
    if (this.phase === 'done') return
    this.q = []; this.phase = 'done'; this._home()
  }
}

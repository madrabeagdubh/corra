// stepDrill.js
// Location: js/game/scenes/locations/skye/stepDrill.js
//
// Uathach's drill: she calls a step in Irish, the called d-pad button
// glows, the player's next tile move is judged. The glow fades over the
// sequence so the last calls are understood from the Irish alone -- the
// drill is a listening exercise wearing a movement lesson's clothes.
//
// Never fails the player: a wrong step earns a dry correction, the player
// is stepped back automatically, and the same call comes again -- so the
// calls always trace the route exactly. One call, one step: a held button
// is dropped as soon as a step is judged, and any extra step taken between
// calls is walked back too (on the Skye headland, one extra tile puts the
// next "forward" into a wall).
//
//   const drill = new StepDrill(scene, { caption, steps, female, onDone, onCorrect })
//   onCorrect(step, [tx, ty]) -- after each correct step (e.g. light a stone)
//   step.count                -- steps for one call ("trí chéim ar aghaidh");
//                                a mistake mid-count undoes the whole call
//   drill.mistakes            -- wrong + extra steps so far
//   drill.start();  drill.update() every frame;  drill.destroy()

const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1]

const DIRS = {
  forward: { dx:  0, dy: -1, btn: 'up',
             fixGa: 'Ar aghaidh',  fixEn: 'Forward' },
  back:    { dx:  0, dy:  1, btn: 'down',
             fixGa: 'Ar gcúl',     fixEn: 'Back' },
  left:    { dx: -1, dy:  0, btn: 'left',
             fixGa: 'Do chlé',     fixEn: 'Your left' },
  right:   { dx:  1, dy:  0, btn: 'right',
             fixGa: 'Do dheis',    fixEn: 'Your right' },
}

// Her insult of choice, by the champion's grammatical gender.
const VOC = {
  f: { ga: 'a óinseach',        en: 'you fool' },
  m: { ga: 'a chinn chabáiste', en: 'cabbage-head' },
}

const GAP_MS = 650      // pause after a correct step before the next call
const FIX_MS = 1500     // how long a correction shows before the call returns
const UNDO_MS = 450     // after a wrong step, when she walks them back

export default class StepDrill {
  constructor(scene, { caption, steps, female = false, onDone, onCorrect }) {
    this.onCorrect = onCorrect
    this.mistakes  = 0
    this.scene   = scene
    this.caption = caption
    this.steps   = steps
    this.voc     = female ? VOC.f : VOC.m
    this.onDone  = onDone
    this.i       = 0
    this._awaiting = false
    this._lastTile = null
    this._timers = []
  }

  _later(ms, fn) { this._timers.push(this.scene.time.delayedCall(ms, fn)) }

  _tile() {
    const p = this.scene.player, ts = this.scene.tileSize
    return p ? [Math.floor(p.logicalX / ts), Math.floor(p.logicalY / ts)] : null
  }

  // POSITION, NOT DIRECTION. The drill keeps an ANCHOR: the tile the player
  // should be standing on before the current call. A correct step moves
  // along from it; anything else -- a wrong step, an extra step between
  // calls, a slip partway through "trí chéim" -- is walked back to the
  // anchor by the pathfinder. If a walk-back is interrupted (the player
  // pressing while it runs), it simply re-routes. The route can't drift.
  // (The old version judged each step's direction and counted its own
  // pending walk-backs; a press that cancelled a walk-back threw the count
  // off, and the next "forward" pointed into a wall.)

  start(intro) {
    this._anchor = this._tile()
    this._last = this._anchor
    if (intro) {
      this.caption.show(intro.ga, intro.en)
      this._later(intro.holdMs ?? 2600, () => this._call())
    } else {
      this._call()
    }
  }

  _call() {
    const step = this.steps[this.i]
    if (!step) return this._finish()
    this.caption.show(step.ga, step.en)
    this._done = 0
    this.scene.joystick?.highlight?.(DIRS[step.dir].btn, step.glow ?? 1)
    this._awaiting = true
  }

  update() {
    const t = this._tile()
    if (!t || !this._anchor) return
    const moved = !this._last || t[0] !== this._last[0] || t[1] !== this._last[1]
    this._last = t

    if (this._returning) {
      if (same(t, this._anchor)) { this._returning = false; return }
      // an interrupted walk-back: once the player is idle off the anchor,
      // route home again
      const p = this.scene.player
      if (!p.isMoving && !(p.pathQueue?.length)) this._goHome(0)
      return
    }
    // Between calls (and during the intro) the feet wait: pressing ahead of
    // a call used to take a step that had to be walked back, and a press
    // landing mid-walk-back could leave the drill a step out of sync.
    if (!this._awaiting) this.scene.joystick?.reset?.()
    if (!moved) return

    // Where a correct step would land now: the anchor, plus the steps of
    // this call already taken, plus one.
    const step = this.steps[this.i]
    const want = step && DIRS[step.dir]
    const expect = want && [this._anchor[0] + want.dx * (this._done + 1),
                            this._anchor[1] + want.dy * (this._done + 1)]

    if (this._awaiting && expect && same(t, expect)) {
      this.scene.joystick?.reset?.()                 // one press, one step
      this.onCorrect?.(step, t)
      this._done++
      if (this._done < (step.count || 1)) return     // more steps in this call
      this._awaiting = false
      this._anchor = t
      this.scene.joystick?.highlight?.(null)
      this.i++
      this._later(GAP_MS, () => this._call())
      return
    }

    // Anything else is a mistake: back to the anchor (undoing any steps of
    // a multi-step call too, so the call stays true when it comes again).
    this.mistakes++
    console.warn('[stepDrill] step judged wrong --', JSON.stringify({
      call: step?.ga, count: step?.count || 1, done: this._done, anchor: this._anchor,
      expected: expect, got: t, awaiting: this._awaiting }))
    if (this._awaiting && want) {
      this._awaiting = false
      this.caption.show(`${want.fixGa}, ${this.voc.ga}!`, `${want.fixEn}, ${this.voc.en}!`)
      this._goHome(UNDO_MS)
      this._later(FIX_MS, () => this._call())
    } else {
      this._goHome(0)                                // an extra step between calls
    }
  }

  // Walk the player back to the anchor (after delayMs), by the pathfinder
  // if they've strayed more than a step.
  _goHome(delayMs) {
    this._returning = true
    this.scene.joystick?.reset?.()
    const go = () => {
      const t = this._tile(), a = this._anchor
      if (!t || same(t, a)) { this._returning = false; return }
      let path
      if (Math.abs(t[0] - a[0]) + Math.abs(t[1] - a[1]) === 1) {
        path = [{ dx: a[0] - t[0], dy: a[1] - t[1] }]
      } else {
        path = this.scene.pathFinder?.findPath?.(t[0], t[1], a[0], a[1]) || []
      }
      if (path.length) this.scene.player?.setPath?.(path)
    }
    delayMs ? this._later(delayMs, go) : go()
  }

  _finish() {
    this.scene.joystick?.highlight?.(null)
    this.onDone?.()
  }

  destroy() {
    this._timers.forEach(t => t.remove?.())
    this._timers = []
    this.scene.joystick?.highlight?.(null)
  }
}

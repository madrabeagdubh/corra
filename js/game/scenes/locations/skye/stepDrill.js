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
//   const drill = new StepDrill(scene, { caption, steps, female, onDone })
//   drill.start();  drill.update() every frame;  drill.destroy()

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
  constructor(scene, { caption, steps, female = false, onDone }) {
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

  start(intro) {
    this._lastTile = this._tile()
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
    this.scene.joystick?.highlight?.(DIRS[step.dir].btn, step.glow ?? 1)
    this._lastTile = this._tile()
    this._awaiting = true
  }

  update() {
    const t = this._tile()
    if (!t) return
    if (!this._lastTile) { this._lastTile = t; return }
    const [dx, dy] = [t[0] - this._lastTile[0], t[1] - this._lastTile[1]]
    if (!dx && !dy) return
    this._lastTile = t

    if (!this._awaiting) {
      if (this._expectUndo) { this._expectUndo = false; return }   // our own walk-back
      this._walkBack(dx, dy, 0)                                    // an extra step
      return
    }

    const want = DIRS[this.steps[this.i].dir]
    this._awaiting = false
    this.scene.joystick?.reset?.()          // one call, one step
    if (dx === want.dx && dy === want.dy) {
      this.scene.joystick?.highlight?.(null)
      this.i++
      this._later(GAP_MS, () => this._call())
    } else {
      this.caption.show(`${want.fixGa}, ${this.voc.ga}!`, `${want.fixEn}, ${this.voc.en}!`)
      // Undo the wrong step, so every call stays true and the route always
      // ends where it should (after a beat, so the correction is read).
      this._walkBack(dx, dy, UNDO_MS)
      this._later(FIX_MS, () => this._call())
    }
  }

  // Step the player back one tile (reversing dx, dy), after delayMs. The
  // resulting tile change is recognised as ours and not judged.
  _walkBack(dx, dy, delayMs) {
    this.scene.joystick?.reset?.()
    const go = () => {
      this._expectUndo = true
      this.scene.player?.setPath?.([{ dx: -dx, dy: -dy }])
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

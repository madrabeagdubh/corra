// skyeLoch.js
// Location: js/game/scenes/locations/skye/skyeLoch.js
//
// The loch: the second half of Uathach's movement lesson -- tap-to-move.
// Two pools of stepping stones in a row, a strip of bank between.
//
//   ROUND A  She waits across the first pool: "Tar chugam." Stepping by
//            d-pad, she mutters "Ná féach ar do chosa." now and then; after
//            a while, "Féach ormsa." and a pulsing ring appears at her feet
//            -- the same marker a tap leaves -- suggesting "touch here".
//            Reach her by tap: "Sin é." Step all the way: "Bhí tú ag
//            féachaint ar do chosa an t-am ar fad."
//   ROUND B  She dashes across the second pool: one more go (ring already
//            showing if round A was walked). Then a line about there being
//            more to learn, and she's off to the machaire.
//
// THE DUNK  Loch water is walkable for the d-pad but blocked for the
//           pathfinder (_buildWalkGrid), so stepping off a stone puts you
//           in, while a tapped route only ever lands on stones. A dunk:
//           splash, fade, back to the start of that pool, a dry remark --
//           and the hint gets stronger each time. After the lesson a dunk
//           just puts you back on your last dry footing.
//
// Tap-to-move is ON here: this is where it's introduced.
// NOTES: sets lesson_movement at the end of round B.
//
// Layout (stones, her spots, pool starts) comes from the map JSON --
// see skye_gen.mjs (skye_loch).

import SkyeScene, { SKYE_GID } from './skyeScene.js'
import { GameState } from '../../../systems/gameState.js'
import SkyeCaption from './skyeCaption.js'
import LochStones from './lochStones.js'
import { dash, dustPuff, figureBox, moveFigure, splash } from './dustDash.js'

const LOCH = 1679
const NUDGE_EVERY = 4        // d-pad steps between nudges
const RING_AFTER  = 6        // d-pad steps before "look at me" + the ring

const LINES = {
  come:      { ga: 'Tar chugam.', en: 'Come to me.' },
  feet:      { ga: 'Ná féach ar do chosa.', en: 'Don\'t look at your feet.' },
  lookAtMe:  { ga: 'Féach ormsa.', en: 'Look at me.' },
  explicit:  { ga: 'Féach ormsa. Leag do mhéar orm.', en: 'Look at me. Put your finger on me.' },
  wet:       { ga: 'Fliuch?', en: 'Wet?' },
  wetAgain:  { ga: 'Bhí tú ag féachaint ar do chosa arís.', en: 'You were looking at your feet again.' },
  tappedA:   { ga: 'Sin é. Féach ar an áit a bhfuil tú ag dul.', en: 'That\'s it. Look where you\'re going.' },
  walkedA:   { ga: 'Bhí tú ag féachaint ar do chosa an t-am ar fad.', en: 'You were looking at your feet the whole time.' },
  againB:    { ga: 'Arís.', en: 'Again.' },
  againBHint:{ ga: 'Arís. Féach ormsa an uair seo.', en: 'Again. Look at me this time.' },
  tappedB:   { ga: 'Sin é. Tá sé agat.', en: 'That\'s it. You have it.' },
  walkedB:   { ga: 'Bhuel. Tiocfaidh sé leat.', en: 'Well. It\'ll come to you.' },
  more:      { ga: 'Tá tuilleadh le foghlaim fós. Neart.', en: 'There\'s more to learn yet. Plenty.' },
}

export class SkyeLoch extends SkyeScene {
  constructor() { super({ key: 'skye_loch' }) }
  getMapKey() { return 'skye_loch' }

  // Loch water: walkable (you can step in -- and get dunked)...
  getExtraUnwalkableGIDs() {
    const s = super.getExtraUnwalkableGIDs()
    s.delete(LOCH)
    return s
  }

  // ...but never part of a tapped route: the pathfinder sees only stones.
  _buildWalkGrid() {
    const g = super._buildWalkGrid()
    const L0 = this.mapData.layers[0]
    for (let y = 0; y < g.length; y++) {
      for (let x = 0; x < g[y].length; x++) {
        if (L0[y]?.[x] === LOCH && !this._isStone(x, y)) g[y][x] = false
      }
    }
    return g
  }

  _isStone(x, y) {
    if (!this._stoneSet) this._stoneSet = new Set((this.mapData?.stones || []).map(([a, b]) => `${a},${b}`))
    return this._stoneSet.has(`${x},${y}`)
  }

  async create(data) {
    await super.create(data)
    if (!this.player) return

    this._caption = new SkyeCaption()
    this._uathach = this._findFigure(SKYE_GID.UATHACH)
    this.perspectiveGround?.setStructures(new LochStones(this, this.mapData.stones))
    this._spots  = this.mapData.uathachSpots      // [A, B]
    this._starts = this.mapData.poolStarts        // { A, B }
    this._dunks  = 0

    // A stone sits on a water tile; stood on, it's ground, not water (no
    // wading slow-down or sink).
    const tm = this.terrainManager
    if (tm?.getTerrainByTileType) {
      const orig = tm.getTerrainByTileType.bind(tm)
      tm.getTerrainByTileType = (t) => this._onStone() ? tm.terrainTypes.normal : orig(t)
    }

    // Tapped arrivals: setPath is how tap-to-move walks.
    const origSetPath = this.player.setPath.bind(this.player)
    this.player.setPath = (steps) => {
      if (steps?.length) { this._tapped = true; this._pathSteps = steps.length }
      return origSetPath(steps)
    }

    this._ring = this.add.graphics().setScrollFactor(0).setDepth(15)

    if (GameState.hasNote('lesson_movement')) {
      this._vanishUathach(false)
      this._phase = 'free'
    } else {
      this._beginRound('A', 1200)
    }

    this.events.once('shutdown', () => this._teardownLesson())
  }

  update(time, delta) {
    if (this._dunking) this.joystick?.reset?.()          // no moving while under
    super.update(time, delta)
    if (!this.player || !this._caption) return

    const ts = this.tileSize
    const tx = Math.floor(this.player.logicalX / ts), ty = Math.floor(this.player.logicalY / ts)
    const moved = !this._lastTile || this._lastTile[0] !== tx || this._lastTile[1] !== ty
    this._lastTile = [tx, ty]

    const inWater = this.mapData.layers[0][ty]?.[tx] === LOCH && !this._isStone(tx, ty)
    if (!inWater && !this._dunking) this._lastSafe = [tx, ty]
    if (inWater && !this._dunking) this._dunk()           // always: lesson or not

    if (this._phase === 'crossing') {
      if (moved && !inWater && !this._dunking) this._countStep()
      const spot = this._spots[this._round === 'A' ? 0 : 1]
      if (!this._dunking && this._near(spot, 1.6)) this._roundDone()
    }
    this._drawRing(time)
  }

  // Taps work here (this is the lesson), just not mid-dunk.
  _onTapBeforePath() { return !this._dunking }

  // ── rounds ───────────────────────────────────────────────────────────────
  _beginRound(round, delayMs, line = LINES.come) {
    this._round = round
    this._tapped = false
    this._pathSteps = 0
    this._padSteps = 0
    this._phase = 'crossing'
    this.time.delayedCall(delayMs, () => this._say(line, 3000))
  }

  // A d-pad step (not one of a tapped route's): nudge now and then; after
  // a while, the stronger hint and the ring.
  _countStep() {
    if (this._pathSteps > 0) { this._pathSteps--; return }
    this._padSteps++
    if (!this._ringOn && this._padSteps >= RING_AFTER) {
      this._ringOn = true
      this._say(this._dunks >= 2 ? LINES.explicit : LINES.lookAtMe, 3200)
    } else if (this._padSteps % NUDGE_EVERY === 0) {
      // once the ring is up, point the words at it too
      this._nudgeFlip = !this._nudgeFlip
      this._say(this._ringOn && this._nudgeFlip ? LINES.lookAtMe : LINES.feet, 2400)
    }
  }

  _roundDone() {
    this._phase = 'talk'
    const tapped = this._tapped
    if (this._round === 'A') {
      this._say(tapped ? LINES.tappedA : LINES.walkedA, 3400)
      this.time.delayedCall(3200, () => this._dashTo(this._spots[1], () => {
        if (!tapped) this._ringOn = true
        this._beginRound('B', 400, tapped ? LINES.againB : LINES.againBHint)
      }))
    } else {
      GameState.addNote('lesson_movement')
      this._ringOn = false
      this._say(tapped ? LINES.tappedB : LINES.walkedB, 3000)
      this.time.delayedCall(3000, () => this._say(LINES.more, 3200))
      this.time.delayedCall(5600, () => this._dashTo([22, 1], () => {
        this.time.delayedCall(400, () => { this._vanishUathach(true); this._phase = 'free' })
      }))
    }
  }

  _dashTo(to, onArrive) {
    if (!this._uathach) { onArrive?.(); return }
    dash(this, { flag: this._uathach.flag, zone: this._uathach.zone, to, onArrive })
  }

  // ── the dunk ─────────────────────────────────────────────────────────────
  // During the lesson: back to the start of the pool, with a remark and a
  // stronger hint. Any other time: quietly back to the last dry footing.
  _dunk() {
    const lesson = this._phase === 'crossing'
    this._dunking = true
    this.player.clearPath?.()
    this._pathSteps = 0
    const ts = this.tileSize
    splash(this, figureBox(this, Math.floor(this.player.logicalX / ts), Math.floor(this.player.logicalY / ts)))
    if (lesson) this._dunks++
    const back = lesson ? this._starts[this._round] : (this._lastSafe || this._starts.A)
    this.time.delayedCall(450, () => this._fade(1, 260))
    this.time.delayedCall(800, () => {
      this._teleport(back)
      this._fade(0, 320)
      if (lesson) {
        this._padSteps = 0
        this._ringOn = true                                // the hint grows
        this._say(this._dunks === 1 ? LINES.wet : this._dunks === 2 ? LINES.explicit : LINES.wetAgain, 3000)
      }
      this.time.delayedCall(350, () => { this._dunking = false })
    })
  }

  _teleport([tx, ty]) {
    const ts = this.tileSize, px = tx * ts + ts / 2, py = ty * ts + ts / 2
    const p = this.player
    p.clearPath?.()
    p.isMoving = false
    p.logicalX = p.targetX = p.startX = px
    p.logicalY = p.targetY = p.startY = py
    this._camProxy?.setPosition(px, py)
    this.cameras.main.centerOn(px, py)
    this._lastTile = [tx, ty]
    this.perspectiveGround?.forceRedraw?.()
  }

  // A black veil over everything but the d-pad and captions (PGR's canvases
  // are DOM layers, so a Phaser camera fade wouldn't cover them).
  _fade(to, ms) {
    if (!this._veil) {
      const v = document.createElement('div')
      v.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:1000002;transition:opacity 0.25s linear'
      document.body.appendChild(v)
      this._veil = v
    }
    this._veil.style.transitionDuration = ms + 'ms'
    this._veil.style.opacity = String(to)
  }

  // ── the ring: "touch here" ───────────────────────────────────────────────
  _drawRing(time) {
    const g = this._ring
    if (!g) return
    g.clear()
    const u = this._uathach
    if (!this._ringOn || !u || u.flag.hidden || this._phase !== 'crossing') return
    const box = figureBox(this, u.flag.tileX, u.flag.tileY)
    if (!box) return
    const t = (Math.sin(time / 260) + 1) / 2
    g.lineStyle(Math.max(2, box.w * 0.06), 0xf5d060, 0.45 + 0.45 * t)
    g.strokeEllipse(box.x, box.y, box.w * (1.3 + 0.35 * t), box.w * (0.45 + 0.12 * t))
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  _say(line, ms) { this._caption?.show(line.ga, line.en, ms) }

  _onStone() {
    const p = this.player, ts = this.tileSize
    if (!p) return false
    const bx = p.isMoving ? p.startX : p.logicalX, by = p.isMoving ? p.startY : p.logicalY
    return this._isStone(Math.floor(bx / ts), Math.floor(by / ts))
  }

  _near([tx, ty], tiles) {
    const ts = this.tileSize
    return Math.hypot(this.player.logicalX - (tx + 0.5) * ts,
                      this.player.logicalY - (ty + 0.5) * ts) <= ts * tiles
  }

  _vanishUathach(puff) {
    const u = this._uathach
    if (!u) return
    if (puff) {
      const box = figureBox(this, u.flag.tileX, u.flag.tileY)
      if (box) dustPuff(this, box, 0.4)
    }
    u.flag.hidden = true
    moveFigure(this, u.flag, u.zone, [-20, -20])
  }

  _findFigure(gid) {
    const flag = this.perspectiveGround?._encounterFlags?.find(f => f.visual?.gid === gid)
    if (!flag) return null
    const ts = this.tileSize
    const zone = this.interactables?.find(z =>
      z.getData('type') === 'fixed_encounter' &&
      Math.floor((z.getData('logicalX') ?? z.x) / ts) === flag.tileX &&
      Math.floor((z.getData('logicalY') ?? z.y) / ts) === flag.tileY)
    if (!zone) return null
    return { flag, zone }
  }

  _teardownLesson() {
    this._ring?.destroy()
    this._ring = null
    this._veil?.remove()
    this._veil = null
    this._caption?.destroy()
    this._caption = null
    this._phase = 'free'
  }
}

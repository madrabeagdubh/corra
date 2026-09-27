// skyeCladach.js
// Location: js/game/scenes/locations/skye/skyeCladach.js
//
// The shore: the first half of Uathach's movement lesson. (The second
// half -- tap-to-move -- is at the loch: skyeLoch.js.)
//
//   0. ARRIVAL -- the player stands on the quay at the foot of a stepped
//      harbour wall, jetty and boat behind them, Uathach on the top. After
//      a few seconds, or on the first tap / d-pad press, her conversation
//      opens by itself: starting a conversation isn't something to
//      discover yet.
//   1. THE CLIMB -- she calls steps in Irish (forward, left, right only);
//      the called d-pad button glows, fading over the sequence
//      (stepDrill.js); a wrong or extra step is corrected and undone. Each
//      riser of the wall is solid but for one carved stair; her calls walk
//      the player up them, ending beside her on the top. Starts when the
//      dialogue sets `drill_start`.
//   2. OFF TO THE LOCH -- "Maith go leor. Chuig an loch!" and she dashes
//      off north and vanishes. The player follows, over the map edge.
//
// Tap-to-move is OFF on this map until `lesson_movement` (set at the loch):
// the loch is where it's introduced.
//
// THE BOAT at the jetty head asks whether to leave the island (the exit
// from the tutorial to the main adventure). Its dialogue sets
// `leave_skye`, a one-off trigger the scene clears as it acts on it.
//
// Her lines are captions (skyeCaption.js), not cards: cards hide the
// d-pad, and here the player moves while she talks.
//
// NOTES: drill_start (dialogue) -> drill_done -> [loch] lesson_movement
//
// Layout constants must match skye_gen.mjs (skye_cladach).

import SkyeScene, { SKYE_GID } from './skyeScene.js'
import { GameState } from '../../../systems/gameState.js'
import SkyeCaption from './skyeCaption.js'
import StepDrill from './stepDrill.js'
import { dash, dustPuff, figureBox, moveFigure } from './dustDash.js'
import ShoreProps from './shoreProps.js'
import HarbourWall, { combineStructures } from './harbourWall.js'
import SteepFaceRenderer from '../../../effects/steepFaceRenderer.js'
import { initReturnCrossing } from '../../returnCrossing.js'
import { GameSettings } from '../../../settings/gameSettings.js'

const TOP = { x0: 1, x1: 34, y0: 0, y1: 21 }        // the headland top
const EXIT_DASH = [18, 3]                           // where she dashes before vanishing
const INTRO_DELAY_MS = 5000
const NUDGE_MS = 6000

// From the landing (18,28): through the stairs at (17,26), (19,24) and
// (16,22) to (16,21) on the top, beside her. A wrong or extra step is
// undone, so the route is always exact.
const DRILL = [
  { dir: 'forward', ga: 'Céim ar aghaidh.', en: 'A step forward.',      glow: 1 },
  { dir: 'left',    ga: 'Céim ar chlé.',    en: 'A step to the left.',  glow: 1 },
  { dir: 'forward', ga: 'Céim ar aghaidh.', en: 'A step forward.',      glow: 1 },
  { dir: 'forward', ga: 'Ar aghaidh arís.', en: 'Forward again.',       glow: 1 },
  { dir: 'right',   ga: 'Céim ar dheis.',   en: 'A step to the right.', glow: 1 },
  { dir: 'right',   ga: 'Ar dheis arís.',   en: 'Right again.',         glow: 0.5 },
  { dir: 'forward', ga: 'Ar aghaidh.',      en: 'Forward.',             glow: 0.5 },
  { dir: 'forward', ga: 'Arís.',            en: 'Again.',               glow: 0.25 },
  { dir: 'left',    ga: 'Ar chlé.',         en: 'Left.',                glow: 0.25 },
  { dir: 'left',    ga: 'Ar chlé.',         en: 'Left.',                glow: 0 },
  { dir: 'left',    ga: 'Arís.',            en: 'Again.',               glow: 0 },
  { dir: 'forward', ga: 'Ar aghaidh.',      en: 'Forward.',             glow: 0 },
  { dir: 'forward', ga: 'Suas leat!',       en: 'Up you come!',         glow: 0 },
]

const LINES = {
  intro:  { ga: 'Éist liom, agus déan mar a deirim.',
            en: 'Listen to me, and do as I say.' },
  comeUp: { ga: 'Tar aníos anseo.', en: 'Come up here.' },
  nudge:  { ga: 'Aníos!', en: 'Up!' },
  done:   { ga: 'Maith go leor. Chuig an loch!',
            en: 'Good enough. To the loch!' },
}

const inBox = (b, x, y) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1

export class SkyeCladach extends SkyeScene {
  constructor() { super({ key: 'skye_cladach' }) }
  getMapKey() { return 'skye_cladach' }

  preload() {
    super.preload()
    this.load.image('boat', '/assets/boat.png')
  }

  async create(data) {
    await super.create(data)
    if (!this.player) return                    // base create failed (logged)

    this._caption = new SkyeCaption()
    this._uathach = this._findFigure(SKYE_GID.UATHACH)
    this._boat    = this._findFigure(SKYE_GID.BOAT)
    if (this._boat) this._boat.flag.hidden = true   // ShoreProps draws the boat; the flag is just for talking
    this._phase   = 'free'

    // The wall is dressed as harbour stonework (harbourWall.js); the
    // generic stone overlay handles any other steep face.
    const wall = new HarbourWall(this, this.mapData.wall)
    this.steepFaces = new SteepFaceRenderer(this, { skip: (tx, ty) => wall.ownsRow(ty) })
    this.perspectiveGround?.setStructures(combineStructures(
      new ShoreProps(this, { jetty: this.mapData.jetty, boat: this.mapData.boat }),
      wall,
    ))

    if (GameState.hasNote('drill_done')) {
      this._vanishUathach(false)                  // she's gone on to the loch
    } else if (!GameState.hasNote('drill_start')) {
      this._phase = 'arrival'
      this._introTimer = this.time.delayedCall(INTRO_DELAY_MS, () => this._openIntro())
    }

    this.events.once('shutdown', () => this._teardownLesson())
  }

  update(time, delta) {
    this.steepFaces?.update()
    // Arrival: the first d-pad press opens her conversation instead of
    // walking. Checked before super.update() so the press never moves.
    if (this._phase === 'arrival' && this.joystick?.force > 10) {
      this.joystick.reset?.()
      this._openIntro()
    }
    super.update(time, delta)
    if (!this.player || !this._caption) return
    const panelOpen = !!this._encounterPanel?._isOpen

    if (this._phase === 'free' && GameState.hasNote('drill_start') &&
        !GameState.hasNote('drill_done') && !panelOpen) {
      this._startDrill()
    }
    if (this._phase === 'drill' && !panelOpen) this._drill?.update()
    if (this._phase === 'comeUp') this._checkClimb(time)
    if (GameState.hasNote('leave_skye') && !panelOpen) this._leaveSkye()
  }

  // Taps: during arrival a tap opens her conversation; otherwise tap-to-
  // move doesn't exist here until the loch has taught it.
  _onTapBeforePath(canvasX, canvasY) {
    if (this._phase === 'arrival') { this._openIntro(); return false }
    return GameState.hasNote('lesson_movement')
  }

  // ── 0. arrival ───────────────────────────────────────────────────────────
  _openIntro() {
    if (this._phase !== 'arrival') return
    this._phase = 'free'
    this._introTimer?.remove?.()
    const panel = this._encounterPanel
    if (!panel || !this._uathach) return
    panel.notify({ id: 'fixed:uathach', visual: this._uathach.flag.visual }, this._uathach.zone)
    panel._openPanel()
  }

  // ── 1. the climb ─────────────────────────────────────────────────────────
  _startDrill() {
    this._phase = 'drill'
    const champ = this.registry.get('selectedChampion') || window.selectedChampion
    const female = champ?.pronouns?.ga?.subject === 'sí'
    this._drill = new StepDrill(this, {
      caption: this._caption, steps: DRILL, female,
      onDone: () => this._drillDone(),
    })
    this._drill.start({ ...LINES.intro, holdMs: 2600 })
  }

  _drillDone() {
    this._drill?.destroy()
    this._drill = null
    GameState.addNote('drill_done')
    if (this._onTop()) return this._offToLoch()
    this._phase = 'comeUp'
    this._nextNudge = null
    this._caption.show(LINES.comeUp.ga, LINES.comeUp.en)
  }

  // Fallback only: the undo keeps the calls exact, so the climb normally
  // ends on the top. If it doesn't, wait for them to get up there, nudging
  // now and then, alternating the short and the full call.
  _checkClimb(time) {
    if (this._onTop()) return this._offToLoch()
    if (this._nextNudge == null) this._nextNudge = time + NUDGE_MS
    if (time < this._nextNudge) return
    this._nextNudge = time + NUDGE_MS
    this._nudgeFlip = !this._nudgeFlip
    const line = this._nudgeFlip ? LINES.nudge : LINES.comeUp
    this._caption.show(line.ga, line.en, 2500)
  }

  // ── 2. off to the loch ───────────────────────────────────────────────────
  _offToLoch() {
    this._phase = 'dash'
    this._caption.show(LINES.done.ga, LINES.done.en, 3000)
    this.time.delayedCall(1400, () => {
      if (!this._uathach) { this._phase = 'free'; return }
      dash(this, {
        flag: this._uathach.flag, zone: this._uathach.zone, to: EXIT_DASH,
        onArrive: () => this.time.delayedCall(500, () => {
          this._vanishUathach(true)
          this._phase = 'free'
        }),
      })
    })
  }

  // Gone: flag hidden, zone moved off the map so her badge can't appear.
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

  // ── the boat: leaving the island ─────────────────────────────────────────
  _leaveSkye() {
    GameState.removeNote('leave_skye')
    if (this._leaving) return
    this._leaving = true
    const champ = this.registry.get('selectedChampion') || window.selectedChampion
    this.cameras.main.fadeOut(700, 0, 0, 0)
    this.time.delayedCall(750, () => {
      const container = document.getElementById('gameContainer')
      if (container) container.style.background = '#000'
      initReturnCrossing(champ, GameSettings.englishOpacity, () => {
        if (window.startGame) window.startGame(champ, { startScene: 'd3_sea' })
        else this.scene.start('d3_sea')
      })
    })
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  _onTop() {
    const ts = this.tileSize
    return inBox(TOP, Math.floor(this.player.logicalX / ts), Math.floor(this.player.logicalY / ts))
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
    this.steepFaces?.destroy?.()
    this.steepFaces = null
    this._introTimer?.remove?.()
    this._drill?.destroy()
    this._drill = null
    this._phase = 'free'
    this._caption?.destroy()
    this._caption = null
  }
}

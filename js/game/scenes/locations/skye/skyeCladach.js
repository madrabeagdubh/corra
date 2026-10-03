// skyeCladach.js
// Location: js/game/scenes/locations/skye/skyeCladach.js
//
// The shore: where Conall, the Warden, welcomes you and sends you up the
// wall. (Movement is taught in the garden: skyeGairdin.js, faicheCourse.js.)
//
//   0. ARRIVAL -- the player stands on the jetty (the sea is in: the quay,
//      the first riser and the first terrace are under water) at the foot of a stepped harbour wall, Conall on the
//      top. After a few seconds, or on the first tap / d-pad press, his
//      conversation opens by itself: starting a conversation isn't
//      something to discover yet. He welcomes them and invites them up.
//   1. THE CLIMB -- no orders, no drill: the player finds the carved stairs
//      (one per riser) and climbs. If they stall a while, the brooch
//      flashes toward the next stair -- help, never a requirement. Carved
//      ogham on standing stones (oghamMarks.js), each word
//      a moon tile that can be read again, rewards wandering along the
//      terraces.
//   2. THE PEP TALK -- on the top his conversation opens by itself: welcome
//      to Skye, not many come this way, you did. Then the choice: on to the
//      loch, or to the garden (skyeGairdin.js, west) to practise first.
//   3. OFF -- to the loch he dashes away north and vanishes. To the
//      garden he says "Lean mé", walks a few steps west, quickens, then
//      dashes the rest -- so the player sees the way. Wildflowers thicken
//      toward the west edge of the headland top, pointing the same way.
//
// THE TIDE. Two maps, one scene: skye_cladach (sea in, quay under water)
// and skye_cladach_ebb (sea out: quay, strand and weed laid bare, three
// more words carved on the quay -- the foundations under the warriors'
// fury, courage and strength). getMapKey() picks the ebb once the training
// is done (faiche_tournament_done / brooch_silver). Sea, swell, weed and
// carving: tideWater.js, oghamMarks.js.
//
// Tap-to-move is OFF on this map until `lesson_movement` (set by the tap
// lesson in the garden).
//
// THE BOAT at the jetty head asks whether to leave the island (the exit
// from the tutorial to the main adventure). Its dialogue sets
// `leave_skye`, a one-off trigger the scene clears as it acts on it.
//
// Her lines are captions (skyeCaption.js), not cards: cards hide the
// d-pad, and here the player moves while she talks.
//
// NOTES: climb_started (dialogue) -> climb_top -> pep_done; [garden] lesson_movement
//        tide_out_seen  the ebb tide's one-off caption has been shown
//
// Layout constants must match skye_gen.mjs (skye_cladach).

import SkyeScene, { SKYE_GID } from './skyeScene.js'
import { GameState } from '../../../systems/gameState.js'
import SkyeCaption from './skyeCaption.js'
import { dash, dustPuff, figureBox, moveFigure } from './dustDash.js'
import ShoreProps from './shoreProps.js'
import TideWater from './tideWater.js'
import OghamMarks, { WORDS } from './oghamMarks.js'
import HarbourWall, { combineStructures } from './harbourWall.js'
import SteepFaceRenderer from '../../../effects/steepFaceRenderer.js'
import { initReturnCrossing } from '../../returnCrossing.js'
import { GameSettings } from '../../../settings/gameSettings.js'

const TOP = { x0: 1, x1: 34, y0: 0, y1: 21 }        // the headland top
const EXIT_DASH   = [18, 3]                         // north, toward the loch
const GARDEN_DASH = [2, 19]                         // west, toward the garden
const LEAD = { slow: 4, slowMs: 520, quick: 4, quickMs: 260 }   // her walk before the dash
const INTRO_DELAY_MS = 5000
const STALL_MS = 10000                              // standing still this long, the brooch helps
// The carved stairs, bottom to top: [riser row, stair column].
const STAIRS = [[26, 17], [24, 19], [22, 16]]

const LINES = {
  done:   { ga: 'Maith go leor. Chuig an loch!',
            en: 'Good enough. To the loch!' },
  follow: { ga: 'Lean mé. Siar linn, go dtí an gairdín.',
            en: 'Follow me. West, to the garden.' },
  tide:   { ga: 'Tá an taoide amuigh.', en: 'The tide is out.' },
}

const inBox = (b, x, y) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1

export class SkyeCladach extends SkyeScene {
  constructor() { super({ key: 'skye_cladach' }) }
  // Two tides, two maps: the high one on arrival, and once the training is
  // done (the tournament fought, the brooch silver) the sea has drawn back.
  getMapKey() { return GameState.hasNote('faiche_tournament_done') || GameState.hasNote('brooch_silver') ? 'skye_cladach_ebb' : 'skye_cladach' }

  // The jetty's tiles are grass only so the player can stand on them; they must not
  // be painted with a bank of earth down to the water (pgrWaterBanks.js).
  noElevationFaces(tx, ty) { return this.noWaterBank(tx, ty) }
  noWaterBank(tx, ty) {
    const J = this.mapData?.jetty
    return !!J && tx >= J.x0 && tx <= J.x1 && ty >= J.y0 && ty <= J.y1
  }

  preload() {
    super.preload()
    this.load.image('boat', '/assets/boat.png')
  }

  async create(data) {
    await super.create(data)
    if (!this.player) return                    // base create failed (logged)

    this._caption = new SkyeCaption({ scene: this, focusOn: () => this._speakerAt(), color: '#c6d4ea' })
    this._conall = this._findFigure(SKYE_GID.WARDEN)
    this._boat    = this._findFigure(SKYE_GID.BOAT)
    if (this._boat) this._boat.flag.hidden = true   // ShoreProps draws the boat; the flag is just for talking
    this._phase   = 'free'

    // The wall is dressed as harbour stonework (harbourWall.js); the
    // generic stone overlay handles any other steep face.
    const wall = new HarbourWall(this, this.mapData.wall)
    // (the jetty's raised deck makes steep slopes at its edges that aren't rock)
    const J = this.mapData.jetty
    const nearJetty = (tx, ty) => !!J && tx >= J.x0 - 1 && tx <= J.x1 + 1 && ty >= J.y0 - 1 && ty <= J.y1 + 1
    this.steepFaces = new SteepFaceRenderer(this, { skip: (tx, ty) => wall.ownsRow(ty) || nearJetty(tx, ty) })
    this._ogham = new OghamMarks(this)
    this._setUpOgham()
    // back to front within each row: the wall, then the tide over it (weed
    // or water), then the carving, then the jetty and boat
    this.perspectiveGround?.setStructures(combineStructures(
      wall,
      this.mapData.tide ? new TideWater(this, this.mapData.tide, { ogham: this._ogham }) : null,
      this._ogham,
      new ShoreProps(this, { jetty: this.mapData.jetty, boat: this.mapData.boat }),
    ))

    if (GameState.hasNote('pep_done')) {
      this._vanishConall(false)                  // he's gone on ahead
      // sea out: the first time, say so (and so tell them to look down)
      if (this.mapData.tide?.state === 'low' && !GameState.hasNote('tide_out_seen')) {
        GameState.addNote('tide_out_seen')
        this.time.delayedCall(1800, () => this._caption?.show(LINES.tide.ga, LINES.tide.en, 3500))
      }
    } else if (GameState.hasNote('climb_top')) {
      this._phase = 'pep'                         // up top, waiting to talk
    } else if (!GameState.hasNote('climb_started')) {
      this._phase = 'arrival'
      this._introTimer = this.time.delayedCall(INTRO_DELAY_MS, () => this._openIntro())
    }
    this._stillSince = null

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

    // The climb is free. Arriving on top opens the pep talk; standing about
    // at the foot of the wall for a while makes the brooch flash the way.
    if (panelOpen) this._stillSince = time           // a conversation isn't standing about
    if (!panelOpen) this._readOgham()
    if (this._phase === 'free' && !GameState.hasNote('pep_done') && !panelOpen) {
      if (this._onTop()) this._pepTalk()
      else this._brooch(time)
    }
    if (!panelOpen && GameState.hasNote('go_loch'))   this._pepChoice('go_loch')
    if (!panelOpen && GameState.hasNote('go_garden')) this._pepChoice('go_garden')
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
    if (!panel || !this._conall) return
    panel.notify({ id: 'fixed:conall', visual: this._conall.flag.visual }, this._conall.zone)
    panel._openPanel()
  }

  // ── 1. the climb ─────────────────────────────────────────────────────────
  // Optional help. Still for STALL_MS (and not in a conversation), the
  // brooch pulses toward the next stair: sideways until they're in line
  // with it, then forward. Any movement puts it out again.
  _brooch(time) {
    const joy = this.joystick
    if (!joy?.highlight) return
    const ts = this.tileSize
    const tx = Math.floor(this.player.logicalX / ts), ty = Math.floor(this.player.logicalY / ts)
    const key = tx + ',' + ty
    if (key !== this._stillKey || joy.force > 10) {
      this._stillKey = key; this._stillSince = time
      if (this._hinting) { joy.highlight(null); this._hinting = false }
      return
    }
    if (this._hinting || time - this._stillSince < STALL_MS) return
    // the next stair up: the first whose riser is north of them
    const T = this.mapData.tide
    const afloat = T?.state === 'high' ? T.seaTop : 99          // stairs under the sea don't count
    const next = STAIRS.find(([row]) => row < ty && row < afloat)
    if (!next) return
    const dir = tx < next[1] ? 'right' : tx > next[1] ? 'left' : 'up'
    joy.highlight(dir, 1)
    this._hinting = true
  }

  // ── 2. the pep talk ──────────────────────────────────────────────────────
  _pepTalk() {
    this._phase = 'pep'
    GameState.addNote('climb_top')
    if (this._hinting) { this.joystick?.highlight?.(null); this._hinting = false }
    this.time.delayedCall(700, () => {
      const panel = this._encounterPanel
      if (!panel || !this._conall || panel._isOpen) return
      panel.notify({ id: 'fixed:conall', visual: this._conall.flag.visual }, this._conall.zone)
      panel._openPanel()
    })
  }

  _pepChoice(note) {
    GameState.removeNote(note)
    if (this._phase !== 'pep') return
    GameState.addNote('pep_done')
    if (note === 'go_garden') this._leadToGarden()
    else this._offToLoch()
  }

  // ── 3. off ───────────────────────────────────────────────────────────────
  _offToLoch() { this._offTo(EXIT_DASH, LINES.done) }

  // "Lean mé": a few unhurried steps west, a few quicker ones, then the
  // dash -- the player sees which way she's going before she's gone.
  _leadToGarden() {
    this._phase = 'dash'
    const u = this._conall
    this._caption.speak(LINES.follow.ga, LINES.follow.en, 3200)
    if (!u) { this._phase = 'free'; return }
    let t = 1600
    const n = LEAD.slow + LEAD.quick
    for (let i = 1; i <= n; i++) {
      t += i <= LEAD.slow ? LEAD.slowMs : LEAD.quickMs
      this.time.delayedCall(t, () => {
        const x = Math.max(GARDEN_DASH[0] + 1, u.flag.tileX - 1)
        moveFigure(this, u.flag, u.zone, [x, GARDEN_DASH[1]])
      })
    }
    this.time.delayedCall(t + 300, () => dash(this, {
      flag: u.flag, zone: u.zone, to: GARDEN_DASH,
      onArrive: () => this.time.delayedCall(500, () => {
        this._vanishConall(true)
        this._phase = 'free'
      }),
    }))
  }

  // Wildflowers on the headland top, thickening toward its west edge: a
  // quiet pointer to the garden. On the ground canvas, like the ráth's.
  getVegetation() {
    const toX = 16                                   // none east of here
    return {
      species: ['mearacan', 'noinin', 'minscoth', 'crobhein'],
      density: 1, clumpBias: 0, perTile: 2, scaleJitter: 0.35, onGround: true,
      allowAt: (key, col, row) => {
        if (row > 21 || col >= toX) return false
        const want = Math.pow((toX - col) / toX, 1.4) * 0.85   // 0 -> 0.85 going west
        const h = Math.abs(Math.sin(col * 12.9898 + row * 78.233) * 43758.5453) % 1
        return h < want
      },
      isWater: () => false,
    }
  }

  _offTo(to, line) {
    this._phase = 'dash'
    this._caption.speak(line.ga, line.en, 3000)
    this.time.delayedCall(1400, () => {
      if (!this._conall) { this._phase = 'free'; return }
      dash(this, {
        flag: this._conall.flag, zone: this._conall.zone, to,
        onArrive: () => this.time.delayedCall(500, () => {
          this._vanishConall(true)
          this._phase = 'free'
        }),
      })
    })
  }

  // Gone: flag hidden, zone moved off the map so her badge can't appear.
  _vanishConall(puff) {
    const u = this._conall
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

    // A DOM veil, not a camera fade: PGR's layers, the moon and the d-pad
    // are DOM elements a Phaser fade doesn't cover.
    const veil = document.createElement('div')
    veil.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;' +
      'pointer-events:all;z-index:1000010;transition:opacity 0.6s linear'
    document.body.appendChild(veil)
    requestAnimationFrame(() => { veil.style.opacity = '1' })

    setTimeout(() => {
      const container = document.getElementById('gameContainer')
      if (container) container.style.background = '#000'
      // Stop this scene BEFORE the crossing starts: its shutdown removes the
      // moon, badge, d-pad and PGR layers. Left running, they sat on top of
      // the crossing (which draws beneath them) -- a second moon, still
      // wearing the boat badge.
      this.scene.stop()
      initReturnCrossing(champ, GameSettings.englishOpacity, () => {
        if (window.startGame) window.startGame(champ, { startScene: 'd3_sea' })
      })
      setTimeout(() => {
        veil.style.opacity = '0'
        setTimeout(() => veil.remove(), 700)
      }, 60)
    }, 650)
  }

  // The carved words are read by walking up to their stones: the word's ogham
  // appears over the moon (clear ground, so the moon still shows and swipes pass
  // through); a tap brings the word up as a caption (skyeCaption.js), and the
  // icon goes until you step away and come back.
  _setUpOgham() { this._oghamNear = {} }

  _readOgham() {
    if (!this._ogham || !this.player || this._phase === 'arrival') return
    const panel = this._encounterPanel
    if (!panel) return
    const ts = this.tileSize, px = this.player.logicalX / ts, py = this.player.logicalY / ts
    const spent = this._oghamNear
    let near = null, best = 2.2
    for (const w of WORDS) {
      const d = Math.hypot(px - (w.at[0] + 0.5), py - (w.at[1] + 0.5))
      if (d > 3.2) spent[w.id] = false                       // stepped away: it can be read again
      if (!this._ogham.isShown(w) || spent[w.id]) continue
      if (d < best) { best = d; near = w }
    }
    const mine = panel._card?.id?.startsWith('ogham:')
    if (near) {
      if (panel._card && !mine) return                        // someone else's badge (Conall's)
      if (panel._card?.id === 'ogham:' + near.id && panel._badgeVisible) return
      panel.notify({
        id: 'ogham:' + near.id,
        visual: { glyph: this._ogham.icon[near.id] },
        onActivate: () => {
          spent[near.id] = true
          this._caption?.setColor('#d6cdb4')
          this._caption?.show(near.ga, near.en, 4200)
        },
      }, null)
    } else if (mine) panel.clearNotify()
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  // Where Conall is standing, for the caption's focus -- or null.
  _speakerAt() {
    const f = this._conall?.flag
    return f && !f.hidden ? [f.tileX, f.tileY] : null
  }

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
    this.joystick?.highlight?.(null)
    this._phase = 'free'
    this._caption?.destroy()
    this._caption = null
  }
}

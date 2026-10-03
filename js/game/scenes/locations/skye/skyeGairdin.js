// skyeGairdin.js
// Location: js/game/scenes/locations/skye/skyeGairdin.js
//
// The ráth: a gentle ringfort (a ripple in the land, like Tara) with a
// gaming-board floor -- 13 x 13 stones inlaid in four colours around the
// lár, the centre stone. Clear, quiet ground: the Warden's crash course
// happens here, one to one (faicheCourse.js).
//
//   lessons  directions, tap-to-move, drawing a route (Conall demonstrates),
//            the sword, the calls, cuts, fatigue, the strong blow, the training
//            dummy (carried out into the garden), a gentle practice duel
//            (faicheCourse.js runs them; courseScript.js has the words)
//   board    the stones light as you step on the called ones
//   after    Conall sends you across the loch to the green, where Uathach is
//            taking a class
//
// Uathach is not here: she is up on the green's dais.
// (public/data/skye/skyeGairdin.js still lists her; the scene sends her away.)
//
// Taps and drawn routes: none until the course teaches them (or the loch did).

import SkyeScene, { SKYE_GID } from './skyeScene.js'
import { GameState } from '../../../systems/gameState.js'
import SkyeCaption from './skyeCaption.js'
import LochStones from './lochStones.js'
import StandingStones from './standingStones.js'
import { combineStructures } from './harbourWall.js'
import { figureBox, moveFigure } from './dustDash.js'
import FaicheCourse, { COURSE_DONE, LEDGE_AT } from './faicheCourse.js'
import MoonPrompt from './moonPrompt.js'
import MeleeBout, { prepareSword } from '../../../combat/meleeBout.js'

const PULSE_MS = 300

export class SkyeGairdin extends SkyeScene {
  constructor() { super({ key: 'skye_gairdin' }) }
  getMapKey() { return 'skye_gairdin' }

  async create(data) {
    await super.create(data)
    if (!this.player) return

    this._caption = new SkyeCaption({ scene: this })
    this._lit = new Set()
    this._marker = null
    this.perspectiveGround?.setStructures(combineStructures(
      new LochStones(this, this.mapData.stones, {
        water: false,
        isLit: (x, y) => this._lit.has(`${x},${y}`),
      }),
      new StandingStones(this, this.mapData.standingStones),
    ))
    this._ring = this.add.graphics().setScrollFactor(0).setDepth(15)
    this._moonPrompt = new MoonPrompt(this)

    // Uathach stays on the green
    const u = this._findFigure(SKYE_GID.UATHACH)
    if (u) { u.flag.hidden = true; moveFigure(this, u.flag, u.zone, [-20, -20]) }

    // the Warden, in a bout that never begins
    this._melee?.destroy()
    this._melee = new MeleeBout(this, { kind: 'warden', home: [...LEDGE_AT], gid: SKYE_GID.WARDEN })
    this._melee.melee.peaceful = true
    this.boutCaptions = false
    prepareSword(this)                      // a sword you've been given is in your pack

    if (!GameState.hasNote(COURSE_DONE)) this._course = new FaicheCourse(this)

    this.events.once('shutdown', () => this._teardown())
  }

  // Wildflowers and gorse beyond the bank, grown on the ground canvas so the
  // bank hides what's behind it. The ráth itself is kept clear.
  getVegetation() {
    const from = this.mapData?.floraFrom
    if (!from) return false
    const c = this.mapData.lar
    return {
      species: ['mearacan', 'noinin', 'minscoth', 'crobhein', 'aiteanntor'],
      density: 0.4, perTile: 2, scaleJitter: 0.35, onGround: true,
      allowAt: (key, col, row) => Math.hypot(col - c[0], row - c[1]) >= from,
      isWater: () => false,
    }
  }

  update(time, delta) {
    super.update(time, delta)
    if (!this.player || !this._caption) return
    const panelOpen = !!this._encounterPanel?._isOpen
    if (!panelOpen && this._course) {
      this._course.update(delta)
      if (this._course.finished) { this._course.destroy(); this._course = null }
    }
    this._drawRing(time)
  }

  // Taps come with the tap lesson; a tap on the training dummy is a cut or a walk up to it.
  _onTapBeforePath(canvasX, canvasY) {
    if (this._course?.tapDummy?.(canvasX, canvasY)) return false
    if (this._course) return this._course.tapsOn()
    return true
  }

  // ── the training dummy, when the course has it out ───────────────────────
  figureAt(tx, ty) { return !!this._course?.occupies?.(tx, ty) }
  isOccupied(x, y) {
    const tx = Math.floor(x / this.tileSize), ty = Math.floor(y / this.tileSize)
    return super.isOccupied(x, y) || this.figureAt(tx, ty)
  }
  lensFocus() { return this._course?.lensFocus?.() ?? super.lensFocus() }
  lensSolo() { return !!this._course?.speaking || super.lensSolo() }
  // walked into the dummy: a shove at it; into anyone else (Conall): the fight's business
  onBumpFigure(dx, dy) {
    const p = this.player, ts = this.tileSize
    const tx = Math.floor(p.logicalX / ts) + dx, ty = Math.floor(p.logicalY / ts) + dy
    if (this._course?.occupies?.(tx, ty)) { this._course.bumpDummy(dx); return }
    super.onBumpFigure(dx, dy)
  }

  onMeleeEvent(name, d) { this._course?.onMeleeEvent?.(name, d) }

  // the sword in flight (the lesson draws it)
  onPGRDrawComplete(ctx) { this._course?.draw?.(ctx) }

  // Conall's card for a musical dialogue (portrait, background), if the panel can give it
  conallCard() {
    try {
      const f = this._findFigure(SKYE_GID.WARDEN), ep = this._encounterPanel
      return {
        portrait: f?.zone.getData('portrait') || null,
        graphicKey: f && ep ? ep._resolveNpcGraphicKey(f.zone) : null,
        bgKey: ep?._resolveBgKey?.() ?? null,
      }
    } catch (_) { return {} }
  }

  // ── what the course asks of the scene ─────────────────────────────────────
  courseMarker(tile) { this._marker = tile }
  moonPrompt(kind) { this._moonPrompt?.set(kind) }
  courseLit(tile) {
    if (!tile) this._lit.clear()
    else this._lit.add(`${tile[0]},${tile[1]}`)
    this.perspectiveGround?.forceRedraw?.()
  }

  // ── a ring on the marked tile: "stand here" / "touch here" ───────────────
  // If the tile is off the screen, an arrow at the edge points the way to it.
  _drawRing(time) {
    const g = this._ring
    if (!g) return
    g.clear()
    if (!this._marker) return
    const W = this.scale.width, H = this.scale.height
    const t = (Math.sin(time / PULSE_MS) + 1) / 2
    const box = figureBox(this, this._marker[0], this._marker[1])
    if (box && box.x > 24 && box.x < W - 24 && box.y > 24 && box.y < H - 150) {
      g.lineStyle(Math.max(2, box.w * 0.05), 0xf5d060, 0.35 + 0.4 * t)
      g.strokeEllipse(box.x, box.y - box.w * 0.08, box.w * 0.95, box.w * 0.34)
      return
    }
    // off screen: which way? (north is up the screen)
    const ts = this.tileSize
    const dx = this._marker[0] - this.player.logicalX / ts, dy = this._marker[1] - this.player.logicalY / ts
    const vx = dx, vy = dy * 0.55
    const len = Math.hypot(vx, vy) || 1
    const ux = vx / len, uy = vy / len
    const cx = W / 2, cy = H * 0.5, mx = W / 2 - 40, my = Math.min(cy - 60, H - 170 - cy)
    const k = Math.min(Math.abs(ux) > 1e-3 ? mx / Math.abs(ux) : 1e9, Math.abs(uy) > 1e-3 ? (uy < 0 ? cy - 60 : H - 170 - cy) / Math.abs(uy) : 1e9)
    const ax = cx + ux * k, ay = cy + uy * k, sz = 22 + 5 * t
    const px = -uy, py = ux
    g.fillStyle(0xf5d060, 0.55 + 0.4 * t)
    g.fillTriangle(ax + ux * sz, ay + uy * sz, ax - ux * sz * 0.4 + px * sz * 0.8, ay - uy * sz * 0.4 + py * sz * 0.8,
                   ax - ux * sz * 0.4 - px * sz * 0.8, ay - uy * sz * 0.4 - py * sz * 0.8)
    g.lineStyle(2, 0x2a2410, 0.6)
    g.strokeTriangle(ax + ux * sz, ay + uy * sz, ax - ux * sz * 0.4 + px * sz * 0.8, ay - uy * sz * 0.4 + py * sz * 0.8,
                     ax - ux * sz * 0.4 - px * sz * 0.8, ay - uy * sz * 0.4 - py * sz * 0.8)
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

  _teardown() {
    this._course?.destroy(); this._course = null
    this._ring?.destroy(); this._ring = null
    this._moonPrompt?.destroy(); this._moonPrompt = null
    this._caption?.destroy(); this._caption = null
  }
}

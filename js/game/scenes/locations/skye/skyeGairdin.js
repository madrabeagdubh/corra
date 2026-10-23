// skyeGairdin.js
// Location: js/game/scenes/locations/skye/skyeGairdin.js
//
// Conall's training ground: a raised plateau of beaten earth (so the rain never floods it) with a
// gaming-board floor -- 13 x 13 stones inlaid in four colours around the lár, the centre stone. Clear,
// quiet ground: the Warden's crash course happens here, one to one (faicheCourse.js). He waits at the
// plateau's north edge, looking out over the lake: a few rows of water in the garden itself, then the view north
// (the vista map skye_gairdin_n: the lake, its far shore and the hills behind it; Conall's cottage on the near west
// bank, gairdinFar.js; the sea beyond the hills, getFarBackdrop). A path comes in from the north-west corner
// (arrival from the cottage's yard), round the foot of the lake's west lobe through the marsh, and climbs onto
// the plateau from the west.
//
//   lessons  drawing a route (Conall demonstrates), the sword (he faces you
//            from the left), draw / salute / swish / sheathe, fatigue, the
//            strong blow, Conall as the training dummy, a gentle practice duel
//            (faicheCourse.js runs them; courseScript.js has the words)
//   board    the stones light as you step on the called ones
//   after    Conall sends you across the loch to the green, where Uathach is
//            taking a class
//
// Uathach is not here: she is up on the green's dais.
// (public/data/skye/skyeGairdin.js still lists her; the scene sends her away.)
//
// Taps and drawn routes: none until the course teaches them (or the loch did).

import { DawnLight } from './dawnLight.js'
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
import GairdinFar from './gairdinFar.js'

const PULSE_MS = 300

// The still water and the far sea to the north: painted in screen space, under the tiles (effects/pgr/pgrFarBackdrop.js).
// The lake's near edge is the garden's own water rows (skye_gen.mjs); the shores and hills are the vista map.
const FAR_LAKE = {
  sea: { horizon: '#c9d0cb', mid: '#8497a3', near: '#576a82', glint: '#eef3ee' },
  land: '#586f50',
  lift: 0.08,
  glintDensity: 3,
  hazeAlpha: 0.6,
  layers: [
    { d: 300, h: 5.0,  freq: 0.02, cut: 0.42, sharp: 1.1, fog: 0.66, seed: 79 },     // a far coast, beyond the sea beyond the hills
    { d: 520, h: 9.0,  freq: 0.012, cut: 0.36, sharp: 1.2, fog: 0.80, seed: 83 },
  ],
}

// the dawn of the heron set piece: rose haze at the horizon, violet water near
const FAR_DAWN = {
  sea: { horizon: '#f2cfc8', mid: '#d3a6bf', near: '#996a9c', glint: '#fff0ee' },
  land: '#4a4a74',
}
const toRGB = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
const hex = v => '#' + v.map(x => Math.round(x).toString(16).padStart(2, '0')).join('')
const mixHex = (a, b, t) => { const A = toRGB(a), B = toRGB(b); return hex(A.map((v, i) => v + (B[i] - v) * t)) }

// The set piece's camera (see lensLook): looking at the pair of you at the north edge, the camera stepped forward to
// stand just behind you. col/row: the point between you and him; dolly: rows forward; horizon: where the horizon sits
// (fraction of the screen); mag: a magnification on top.
const PIECE_LENS = { col: 17, row: 7.5, dolly: 10, horizon: 0.1, mag: 1.2 }
// ...and where it ends as the picture pushes in on the heron (see heronZoom): the horizon drops, so the garden, and the two of
// you on it, slide down to the bottom edge of the screen and shrink, while the lake and the heron grow (a tilt up with a zoom)
const PIECE_PUSH = { dolly: 14, horizon: 0.44, mag: 1.2 }

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
      new LochStones(this, this.mapData.marshStones, { water: false }),       // flagstones laid through the marsh by the shore path
    ))
    this._ring = this.add.graphics().setScrollFactor(0).setDepth(15)
    this._moonPrompt = new MoonPrompt(this)
    this._far = new GairdinFar()
    this._pc = { w: 0, want: 0, mood: 1, moodWant: 1, live: false, k: 0, kWant: 0, kMs: 3000, moodMs: 7800, grey: 1, greyWant: 1, greyMs: 3000 }                // the set piece: how far in (0..1) and where it is going
    this._light = new DawnLight(this)           // the dawn's light, carried on from the cottage and the yard (dawnLight.js)

    // Uathach stays on the green
    const u = this._findFigure(SKYE_GID.UATHACH)
    if (u) { u.flag.hidden = true; moveFigure(this, u.flag, u.zone, [-20, -20]) }

    // the Warden, in a bout that never begins
    this._melee?.destroy()
    this._melee = new MeleeBout(this, { kind: 'warden', home: [...LEDGE_AT], gid: SKYE_GID.WARDEN })
    this._melee.melee.peaceful = true
    this.boutCaptions = false
    prepareSword(this)                      // a sword you've been given is in your pack

    // testing: ?course=<lesson> replays the course even on a save that has finished it
    try { if (new URLSearchParams(window.location.search).get('course')) GameState.removeNote(COURSE_DONE) } catch (_) {}
    this._course = new FaicheCourse(this, { practice: GameState.hasNote(COURSE_DONE) })      // finished: he only offers more practice
    if (!GameState.hasNote(COURSE_DONE)) {                    // the dawn is already on the picture as you come down from the cottage; it drains to grey through the opening
      this._pc.live = true
      this._pc.mood = this._pc.moodWant = (!this._course.id || this._course.id === 'meet') ? 1 : 0
      this._pc.grey = this._pc.greyWant = (!this._course.id || this._course.id === 'meet') ? 1 : 0.35        // (the grey morning fades out slowly through the lessons: see setGrey)
    }
    this._far.fog = this._far.fogWant = (this._pc.live && this._pc.mood > 0.5) ? 1 : 0.3      // the lake is in fog before the chat, just as in it; a thin mist stays after

    this.events.once('shutdown', () => this._teardown())
  }

  // the lake to the north: its still water and the sea beyond the hills are painted here (the land is the vista map
  // skye_gairdin_n), and Conall's cottage on the west bank
  getFarBackdrop() {
    const w = this._dawn()
    if (w < 0.002) return FAR_LAKE
    const mixSea = k => mixHex(FAR_LAKE.sea[k], FAR_DAWN.sea[k], w)
    return { ...FAR_LAKE, sea: { horizon: mixSea('horizon'), mid: mixSea('mid'), near: mixSea('near'), glint: mixSea('glint') }, land: mixHex(FAR_LAKE.land, FAR_DAWN.land, w) }
  }
  drawFarHost(ctx, pgr) { if (this._far) { this._far.dawn = this._dawn(); this._far.show = true } this._far?.draw(ctx, pgr) }
  _dawn() { const s = this._pc; return s?.live ? s.mood : 0 }       // how much of the dawn is on the picture: all of it from the cottage on, draining to grey through the set piece

  // ── the heron set piece ──────────────────────────────────────────────────
  // setPiece(true): the camera steps forward to stand behind you both, looking out over the lake, and the light turns
  // to dawn; setPiece(false): it eases back out and the ground fills the screen again.
  setPiece(on, look) { if (this._pc) { if (on && look) this._pc.look = look; this._pc.want = on ? 1 : 0; if (on) { this._pc.live = true; this._pc.mood = this._pc.moodWant = 1 } } }
  /** the dawn's colour: 1 the pink dawn, 0 the grey morning it settles into (eased) */
  setMood(v, ms = 7800) { if (this._pc) { this._pc.moodWant = v; this._pc.moodMs = Math.max(1, ms) } }
  /** the grey morning's cast over the garden: 1 on, 0 clear day; eased over ms (minutes, for a change nobody notices) */
  setGrey(v, ms = 3000) { if (this._pc) { this._pc.greyWant = v; this._pc.greyMs = Math.max(1, ms) } }
  /** how thick the fog lies between us and the heron: 1 hides her, 0 is clear */
  setFog(v, ms) { this._far?.setFog(v, ms) }
  get inPiece() { return !!this._pc && (this._pc.want > 0 || this._pc.w > 0.01) }
  heronPlay(name) { this._far?.play(name) }
  heronVis(v, ms) { this._far?.setVis(v, ms) }
  /** push in on the heron (1: as she stands in the distance, about 2.4: close) */
  heronZoom(v, ms) { this._far?.setZoom(v, ms); if (this._pc) { this._pc.kWant = Math.max(0, Math.min(1, (v - 1) / 1.4)); this._pc.kMs = Math.max(1, ms) } }
  lensLook(dt) {
    const s = this._pc
    if (!s) return null
    const k = 1 - Math.exp(-Math.min(100, dt) / (s.want ? 1100 : 800))
    s.w += (s.want - s.w) * k
    s.k += (s.kWant - s.k) * (1 - Math.exp(-Math.min(100, dt) / Math.max(1, s.kMs / 2.2)))
    s.mood += (s.moodWant - s.mood) * (1 - Math.exp(-Math.min(100, dt) / Math.max(1, s.moodMs / 3)))
    s.grey += (s.greyWant - s.grey) * (1 - Math.exp(-Math.min(100, dt) / Math.max(1, s.greyMs / 3)))
    this._drawWash()
    if (!s.want && s.w < 0.003) { s.w = 0; return null }
    const T = { ...PIECE_LENS, ...(s.look || {}) }                  // (framed on the pair of you, wherever you happen to stand)
    const Z = this.PUSH || PIECE_PUSH, e = s.k * s.k * (3 - 2 * s.k), lp = (a, b) => a + (b - a) * e
    return { col: T.col, row: T.row, w: s.w, dolly: lp(T.dolly, Z.dolly) * s.w, horizon: lp(T.horizon, Z.horizon), mag: 1 + (lp(T.mag, Z.mag) - 1) * s.w }
  }
  // the garden's own water: the pgr asks each water tile for its tint. At the north edge it is exactly the far haze
  // (so the join with the far lake is seamless, whatever the state); the dawn pink comes in over the next few rows.
  waterTint(prev, row = 0) {
    const f = this._far, d = this._dawn(), u = Math.min(1, Math.max(0, row / 6))
    const hz = f?.hazeColor?.() ?? [200, 200, 210]
    const [r, g, b] = hz.map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dl = mx - mn
    let h = 0, s = 0
    if (dl > 1e-6) { s = dl / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / dl + 6) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4; h *= 60 }
    const pink = { h: 322, s: 78, l: 82, a: 0.85 * d }, haze = { h, s: s * 100, l: l * 100, a: 0.9 }
    const m = k => haze[k] + (pink[k] - haze[k]) * u
    return { h: m('h'), s: m('s'), l: m('l'), alpha: m('a') }
  }
  _drawWash() { const s = this._pc; if (s && this._light) this._light.set(this._dawn(), s.live ? s.grey : 0) }

  // Wildflowers and gorse beyond the bank, grown on the ground canvas so the
  // bank hides what's behind it. The ráth itself is kept clear.
  getVegetation() {
    const from = this.mapData?.floraFrom
    if (!from) return false
    const c = this.mapData.lar
    return {
      species: ['mearacan', 'noinin', 'minscoth', 'crobhein', 'aiteanntor'],
      density: 0.4, perTile: 2, scaleJitter: 0.35, onGround: true,
      allowAt: (key, col, row) => Math.hypot(col - c[0], row - c[1]) >= from && (this.mapData?.pathDist?.[row]?.[col] ?? 1) >= 0.55   // not on the paths
        && row >= 4 && this.mapData?.layers?.[0]?.[row]?.[col] !== 1625,                                                                // nor in the lake or on its edge
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
    if (this._course?.speaking) return false   // a tap that scrolls his words is not a step
    if (this._course?.tapDummy?.(canvasX, canvasY)) return false
    return true  // tap-to-walk is always on; Conall's lesson still teaches it
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
    if (this._course?.occupies?.(tx, ty)) { this._course.bumpDummy(dx, dy); return }
    super.onBumpFigure(dx, dy)
  }

  onMeleeEvent(name, d) { this._course?.onMeleeEvent?.(name, d) }
  onDialogueEvent(ev) { this._course?.onTalkEvent?.(ev) }
  // squared up to Conall for the sword lessons: you look at him, not the way you last walked
  playerFacing() { return this._melee?.view?.spinFacing?.() ?? this._course?.facing?.() ?? super.playerFacing() }

  // the sword in flight (the lesson draws it)
  onPGRDrawComplete(ctx) { this._drawMarkTile(ctx); this._course?.draw?.(ctx) }
  hasContinuousAnimation() { return !!this._marker || (super.hasContinuousAnimation?.() ?? false) }   // the mark pulses

  // the marked tile, flat on the ground: the same projection and terrain lift as the fight's red tiles
  _drawMarkTile(ctx) {
    const mk = this._marker, v = this._melee?.view
    if (!mk || !v?.pgr) return
    const t = (Math.sin(performance.now() / PULSE_MS) + 1) / 2
    v.tileQuad(ctx, mk, `rgba(245,208,96,${0.12 + 0.2 * t})`, `rgba(245,208,96,${0.55 + 0.4 * t})`, 3)
  }

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
      return                                    // on screen: drawn with the ground (onPGRDrawComplete), so it sits on the tile
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
    this._light?.destroy(); this._light = null
  }
}

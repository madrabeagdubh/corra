// landfall.js
// Location: js/game/scenes/locations/skye/landfall.js
//
// The opening set piece at the cladach: a cut-scene, not a lesson. The
// champion has just rowed to Skye and stands on the jetty, midway along its deck.
// Conall, on the ledge by the stair, hails them; a short exchange; the champion
// is told to come to the fire -- and staggers three steps up the jetty, and falls.
// Conall comes down and stands over them, lifts their head and shoulders (they
// lie propped at about 45 degrees against him), then steps back, dragging
// them: step, drag, step, drag -- and we fade to black.
//
//   1. THE HAIL    -- Conall's own conversation (skyeCladach.dlg, node 3,
//                     opened by this module): cards, at the reader's own pace
//                     (tap to skip ahead, hold the moon to peek the English).
//                     It ends on "Then come."
//   2. THE FALL    -- no words: the champion staggers up the jetty (down the middle of the deck)
//                     and falls
//   3. THE DRAG    -- he comes down, kneels, props them up ("I am coming," they
//                     mutter), and steps back up the stair, dragging them:
//                     "I see that thou art." / "There is no need to narrate it."
//                     as the black comes in. Captions (no dialogue mode: the
//                     picture is the point), in the player's and Conall's colours.
//
// While it plays the player has NO control: the brooch (the d-pad hoop) is
// hidden and kept hidden, taps and drawn routes do nothing, and the champion
// moves only by the script's own steps. It is never given back: the next thing
// is a new scene (Conall's cabin), and onDone() is where that begins.
//
// SKIP: hold the moon (outside the conversation, where the hold is the English
// peek) and a Scip button comes up, as in the crossings. It goes straight to
// onDone(), the same place the cut-scene ends.
//
// How the pieces are drawn:
//   * the champion: the usual PGR player, walked with the real step machinery
//     (slowed), plus a pose (scene.playerPose(): sway, slump, fall, dragged)
//   * Conall: his fixed-encounter flag, moved by hand (tile + pose, so he
//     glides between tiles). While the cut-scene runs his proximity zone is
//     parked off the map so no badge can open; it opens the hail itself.
//   * the drag: the champion's logical position trails Conall's along the
//     route, LAG tiles behind (so PGR draws them in front of him), still
//     propped at their angle. (Dust only where they fall.)

import { GameState } from '../../../systems/gameState.js'
import { GameSettings } from '../../../settings/gameSettings.js'
import { createDomButton } from '../../../systems/gameTypography.js'
import { moveFigure, figureBox, dustPuff } from './dustDash.js'

const CONALL = '#c6d4ea'
const PLAYER = '#e8cf8a'

// The last exchange: muttered and answered while Conall drags them off.
export const LINES = {
  coming:  { ga: 'Tá mé ag teacht anois.', en: 'I am coming.' },
  see:     { ga: 'Feicim go bhfuil.',      en: 'I see that thou art.' },
  narrate: { ga: 'Ní gá é a rá',           en: 'There is no need to narrate it.' },
}

// Tiles (skye_gen.mjs: the jetty is cols 18-19, rows 25-33, the last two rows
// being the boat's; the stairs are at (17,26), (19,24) and (16,22); the
// ledges are rows 25 and 23)
const CONALL_AT = [18, 23]                              // where he waits (skyeCladach.js data)
const START   = [18.5, 29]                              // the champion begins on the jetty, between its two
                                                        // planks of tiles (x 18.5 -> the middle of the deck)
const STAGGER_STEPS = 3                                 // three wobbly steps up the jetty, to row 26
const DOWN    = [[19, 23], [19, 24], [19, 25], [19, 26]] // Conall, to stand over the fallen
// Where he steps back to: up the stair at (19,24), the champion dragged behind.
const ROUTE = [[19, 26], [19, 25], [19, 24], [19, 23], [19, 22]]
const DRAGS = 3                                         // step, drag, step, drag, ...
const STEP_MS = 520                                     // one step
const PAUSE_MS = 480                                    // the drag catches up
const LAG = 1.1                                         // the champion trails him by this much route
const FADE_AT = 3                                       // the black starts as this drag begins (1-based)
const PROP = 0.8                                        // head and shoulders lifted: about 45 degrees (radians)
const FADE_MS = 1800
const HOLD_BLACK_MS = 1300

const lerp = (a, b, k) => a + (b - a) * k

// where along the route (a distance in tiles from its start)
function routeAt(s) {
  const i = Math.max(0, Math.min(ROUTE.length - 2, Math.floor(s)))
  const f = Math.max(0, Math.min(1, s - i))
  return [lerp(ROUTE[i][0], ROUTE[i + 1][0], f), lerp(ROUTE[i][1], ROUTE[i + 1][1], f)]
}

// figureBox() for a fractional tile: the screen point a figure there is
// drawn at (the lift interpolated between the four tiles around it).
function boxAt(scene, fx, fy) {
  const pgr = scene.perspectiveGround
  if (!pgr) return null
  const ts = pgr.tileDisplaySize
  const proj = pgr._projectLogical((fx + 0.5) * ts, (fy + 0.5) * ts, true)
  if (!proj) return null
  const x0 = Math.floor(fx), y0 = Math.floor(fy), u = fx - x0, v = fy - y0
  const lift = (tx, ty) => ((pgr._vertexH(tx, ty + 1) + pgr._vertexH(tx + 1, ty + 1)) * 0.5) * pgr._scaleAtRow(ty + 1)
  const L = lerp(lerp(lift(x0, y0), lift(x0 + 1, y0), u), lerp(lift(x0, y0 + 1), lift(x0 + 1, y0 + 1), u), v)
  const w = proj.scale * ts
  return { x: proj.screenX, y: proj.screenY - L, w, h: w * 1.2 }
}

export default class Landfall {
  /**
   * @param scene   the cladach scene
   * @param conall  { flag, zone } -- his fixed-encounter figure
   * @param onDone  called once the screen is black and held (or on skip)
   */
  constructor(scene, conall, onDone) {
    this.scene = scene
    this.conall = conall
    this.onDone = onDone
    this.alive = true
    this.skipped = false
    this.finished = false
    this.q = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 }     // the champion's pose
    this.sway = 0                                         // how drunk the walk is (0 = not at all)
    this.cpose = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 }  // Conall's own pose (kneeling)
    this.c = null                                         // Conall's float tile position
    this.carrying = false
    this.s = 1                                            // how far along ROUTE he is
    this.blend = 0                                        // 0 = the champion where they fell, 1 = on the route behind him
    this.from = null
    this._half = -1
  }

  // ── start ────────────────────────────────────────────────────────────────
  start() {
    const sc = this.scene
    // No control from here on.
    const joy = sc.joystick
    if (joy) {
      joy.hideDirections?.()
      joy.showDirections = () => {}                       // e.g. the end of a conversation gives it back
      // The hold on the moon is the skip (the conversation's own hold, the
      // English peek, saves and restores these: systems/moonPeek.js)
      joy._onLongPress         = () => this._openSkip()
      joy._onLongPressProgress = (p) => this._skipProgress(p)
      joy._onLongPressCancel   = () => this._skipProgress(0)
    }
    sc._moonOwner = { tap: () => (this._skipEl ? (this._closeSkip(), true) : false) }
    const r = sc._routeDraw
    if (r) { r.begin = () => {}; r.move = () => {}; r.end = () => false }
    sc.player?.cancelMove?.()

    // The champion starts on the jetty, in the middle of its two-tile deck (x 19.0), so that
    // when they fall they lie on the deck rather than over its edge.
    const p = sc.player, ts = sc.tileSize
    if (p) {
      p.logicalX = p.targetX = p.startX = (START[0] + 0.5) * ts
      p.logicalY = p.targetY = p.startY = (START[1] + 0.5) * ts
      sc.cameras.main.centerOn(p.logicalX, p.logicalY)
    }

    // Conall waits where the data puts him
    const { flag } = this.conall
    this.c = { x: CONALL_AT[0], y: CONALL_AT[1] }
    flag.tileX = this.c.x; flag.tileY = this.c.y
    flag.hidden = false

    this._script().catch(e => {
      console.error('[landfall] script failed:', e)
      this._toBlack().then(() => this._done())
    })
  }

  // (The veil is left up if the scene ended the way it should have, on black:
  // the scene's next create() lifts it. Any other way out takes it down.)
  destroy() {
    this.alive = false
    this._closeSkip()
    if (!this.finished) document.getElementById('landfall-veil')?.remove()
  }

  // ── per frame (before the scene's own update) ────────────────────────────
  tick() {
    if (!this.alive) return
    const sc = this.scene, p = sc.player, ts = sc.tileSize
    if (sc.joystick && !sc.joystick._dirsHidden) sc.joystick.hideDirections()   // e.g. after a trip through the menu
    sc.joystick?.reset?.()

    const f = this.conall.flag, c = this.c
    if (this.carrying) {
      const [cx, cy] = routeAt(this.s)
      c.x = cx; c.y = cy
    }
    if (c) {
      const tx = Math.round(c.x), ty = Math.round(c.y)
      f.tileX = tx; f.tileY = ty
      const pose = { ...this.cpose }
      if (this.carrying) {                                 // leaning back into the drag, a dip with each step
        pose.rot -= 0.07 * this.blend
        pose.dy -= 0.03 * Math.sin((this.s % 1) * Math.PI) * this.blend
      }
      const a = boxAt(sc, c.x, c.y), b = boxAt(sc, tx, ty)
      if (a && b) { pose.dx += (a.x - b.x) / b.w; pose.dy += (a.y - b.y) / b.w }   // glide between tiles
      f.pose = pose
    }
    if (this.carrying && p) {
      const [px, py] = routeAt(Math.max(0, this.s - LAG))
      p.logicalX = lerp(this.from.x, (px + 0.5) * ts, this.blend)
      p.logicalY = lerp(this.from.y, (py + 0.5) * ts, this.blend)
    }
  }

  // scene.playerPose(): how the champion stands this frame
  pose() {
    if (!this.alive) return null
    const sc = this.scene, p = sc.player, q = this.q
    let { dx, dy, rot, sx, sy } = q
    if (this.sway) {
      const walking = p?.isMoving
      const s = walking ? Math.sin(p.moveProgress * Math.PI * 2) : Math.sin(sc.time.now / 380) * 0.4
      rot += s * 0.11 * this.sway
      dx += s * 0.05 * this.sway
      sy -= 0.05 * Math.min(1, this.sway)                // slumped
    }
    if (this.carrying) rot += 0.05 * Math.sin(this.s * Math.PI * 2) * this.blend      // the head lolls
    return { dx, dy, rot, sx, sy }
  }

  // ── the script ───────────────────────────────────────────────────────────
  async _script() {
    const sc = this.scene
    await this._wait(1500)
    await this._talk()

    // "I am coming" (it comes later, muttered): the legs have other ideas, the length of the jetty
    await this._wait(300)
    for (let i = 0; i < STAGGER_STEPS; i++) {
      this.sway = 0.8 + 1.2 * i / (STAGGER_STEPS - 1)
      await this._step(0, -1)
      await this._wait(i % 2 ? 500 : 300)
    }
    await this._collapse()

    await this._wait(1200)
    await this._down()
    await this._wait(250)

    // kneel, lift their head and shoulders; they lie propped against him
    const p = sc.player
    await this._tw(this.cpose, { sy: 0.84, dy: 0.03 }, 350)
    await Promise.all([
      this._tw(this.q, { rot: PROP, dx: -0.05, dy: 0.02, sy: 0.95 }, 900, 'Sine.easeInOut'),
      this._tw(this.cpose, { sy: 0.92, dy: 0.02 }, 900, 'Sine.easeInOut'),
    ])
    this._say('player', LINES.coming, 2600)             // muttered, as they are lifted
    await this._wait(2000)
    await this._tw(this.cpose, { sy: 1, dy: 0 }, 350, 'Sine.easeOut')

    // step back, dragging them
    this.from = { x: p.logicalX, y: p.logicalY }
    this.s = 0
    this.carrying = true
    await this._haul()
    await this._wait(HOLD_BLACK_MS)
    this._done()
  }

  // The hail: Conall's own conversation (skyeCladach.dlg node 3, which the
  // note landfall_talk lets in), opened from here. The cards are the reader's.
  async _talk() {
    const sc = this.scene, panel = sc._encounterPanel
    const { flag, zone } = this.conall
    if (panel) {
      const dialogues = zone.getData('dialogues') || []
      GameState.setNPCProgress(zone.getData('stateKey'), Math.max(0, dialogues.length - 1))   // start at the landfall node
      GameState.addNote('landfall_talk')
      panel.notify({ id: 'fixed:conall', visual: flag.visual }, zone)
      panel._openPanel()
      await this._until(() => !panel._isOpen)
      GameState.removeNote('landfall_talk')
      panel.clearNotify?.()
    }
    // From here no conversation or badge can open: his zone goes off the map (his flag stays)
    const fx = flag.tileX, fy = flag.tileY
    moveFigure(sc, flag, zone, [-20, -20])
    flag.tileX = fx; flag.tileY = fy
  }

  // A caption in his colour or theirs. No dialogue mode: the picture is the point.
  _say(who, line, hold) {
    const cap = this.scene._caption
    if (!cap || this.skipped) return
    cap.setColor(who === 'conall' ? CONALL : PLAYER)
    cap.show(line.ga, line.en, hold)
  }

  // One step of the real step machinery, slowed to a stagger.
  async _step(dx, dy) {
    const p = this.scene.player
    p.stepDuration = 900
    p.setPath([{ dx, dy }])
    await this._until(() => !p.isMoving && !p.pathQueue.length)
  }

  // Knees, then over onto the side, and a little dust.
  async _collapse() {
    const sc = this.scene, q = this.q
    await Promise.all([this._tw(q, { sy: 0.8, dy: 0.04 }, 200, 'Quad.easeOut'), this._tw(this, { sway: 0 }, 200)])
    await this._tw(q, { rot: 1.45, dx: -0.9, dy: 0.06, sy: 1 }, 380, 'Quad.easeIn')   // onto the back, head toward the east
    const ts = sc.tileSize, p = sc.player
    dustPuff(sc, figureBox(sc, Math.floor(p.logicalX / ts), Math.floor(p.logicalY / ts)), 0.2, 8)
    await this._wait(500)
  }

  // Conall down the stair, to stand over the fallen.
  async _down() {
    for (const [x, y] of DOWN) await this._tw(this.c, { x, y }, 420)
  }

  // Step, drag, step, drag: he takes a step back and the champion slides after, heels
  // in the dirt. The black comes in as the second drag begins.
  async _haul() {
    this._tw(this, { blend: 1 }, STEP_MS * 1.5, 'Sine.easeInOut')
    let fade = null
    this._say('conall', LINES.see, 2200)
    this._after(2 * (STEP_MS + PAUSE_MS) - 200, () => this._say('conall', LINES.narrate, 3200))
    for (let i = 0; i < DRAGS; i++) {
      if (i === FADE_AT - 1) fade = this._toBlack()
      await this._tw(this, { s: i + 1 }, STEP_MS, 'Sine.easeInOut')
      await this._wait(PAUSE_MS)
    }
    await fade
  }

  // ── fade to black ────────────────────────────────────────────────────────
  // A DOM veil, not a camera fade: PGR's layers and the moon are DOM elements
  // a Phaser fade doesn't cover. (skyeCladach.js's _afterLandfall holds it.)
  _toBlack(ms = FADE_MS) {
    let v = document.getElementById('landfall-veil')
    if (!v) {
      v = document.createElement('div')
      v.id = 'landfall-veil'
      v.style.cssText = `position:fixed;inset:0;background:#000;opacity:0;pointer-events:all;z-index:1000002;transition:opacity ${ms}ms ease-in`
      document.body.appendChild(v)
      requestAnimationFrame(() => requestAnimationFrame(() => { v.style.opacity = '1' }))
    }
    return this._wait(ms + 100, true)
  }

  _done() {
    if (this.finished) return
    this.alive = false
    this.finished = true
    this.onDone?.()
  }

  // ── skip ─────────────────────────────────────────────────────────────────
  // Hold the moon: the screen dims as the hold builds, and at the end of it a
  // Scip button comes up (the crossings do the same). A tap on the moon or
  // anywhere on the dim puts it away.
  _skipProgress(p) {
    this.scene.joystick?.drawChargeGlow?.(p)
    if (this._skipEl) return
    const b = this._backdrop()
    b.style.display = 'block'
    b.style.opacity = p > 0.12 ? String(Math.min((p - 0.12) * 0.8, 0.4)) : '0'
  }

  _backdrop() {
    if (!this._skipBack) {
      const b = document.createElement('div')
      b.style.cssText = 'position:fixed;inset:0;z-index:1000001;background:rgba(2,4,8,0.7);opacity:0;' +
        'pointer-events:none;transition:opacity 0.25s ease;display:none'
      document.body.appendChild(b)
      this._skipBack = b
    }
    return this._skipBack
  }

  _openSkip() {
    if (this._skipEl || this.skipped || !this.alive) return
    this.scene.joystick?.drawChargeGlow?.(0)
    const back = this._backdrop()
    back.style.display = 'block'; back.style.pointerEvents = 'all'
    requestAnimationFrame(() => { back.style.opacity = '0.7' })
    const card = document.createElement('div')
    card.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'background:rgba(2,4,8,0.96);border:1px solid rgba(212,175,55,0.35);border-radius:18px;' +
      'padding:2rem 1.5rem 1.5rem;width:min(340px,85vw);display:flex;flex-direction:column;' +
      'gap:1rem;align-items:center;z-index:1000002;box-shadow:0 8px 40px rgba(0,0,0,0.8);' +
      'opacity:0;transition:opacity 0.25s ease'
    document.body.appendChild(card)
    requestAnimationFrame(() => { card.style.opacity = '1' })
    const btn = createDomButton({
      ga: 'Scip', en: 'Skip', opacity: GameSettings.englishOpacity,
      onClick: () => this._skip(),
    })
    btn.el.style.width = '100%'
    card.appendChild(btn.el)
    this._skipEl = card
    back.addEventListener('pointerdown', this._onBack = () => this._closeSkip(), { once: true })
  }

  _closeSkip() {
    const card = this._skipEl, back = this._skipBack
    this._skipEl = null
    if (back) {
      back.style.opacity = '0'; back.style.pointerEvents = 'none'
      setTimeout(() => { back.style.display = 'none' }, 280)
      if (this._onBack) back.removeEventListener('pointerdown', this._onBack)
    }
    if (card) { card.style.opacity = '0'; setTimeout(() => card.remove(), 280) }
    if (!this.alive) { this._skipBack?.remove(); this._skipBack = null }
  }

  // Straight to what comes next: a quick black, then onDone().
  _skip() {
    if (this.skipped) return
    this.skipped = true
    this._closeSkip()
    this.scene._caption?.hide()
    this._toBlack(700).then(() => this._done())
  }

  // ── tiny helpers ─────────────────────────────────────────────────────────
  // (once skipped, the script simply stops: nothing it waits for ever resolves)
  _wait(ms, always = false) {
    return new Promise(r => this.scene.time.delayedCall(ms, () => { if (always || !this.skipped) r() }))
  }
  _after(ms, fn) {
    return new Promise(r => this.scene.time.delayedCall(ms, () => { if (!this.skipped) Promise.resolve(fn()).then(r) }))
  }
  _until(fn) {
    return new Promise(r => {
      const ev = this.scene.time.addEvent({ delay: 50, loop: true, callback: () => { if (!this.skipped && fn()) { ev.remove(); r() } } })
    })
  }
  _tw(target, props, duration, ease = 'Linear') {
    return new Promise(r => this.scene.tweens.add({ targets: target, ...props, duration, ease, onComplete: () => { if (!this.skipped) r() } }))
  }
}

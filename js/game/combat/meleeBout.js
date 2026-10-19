// meleeBout.js
// Location: js/game/combat/meleeBout.js
//
// One sparring partner in one scene: joins Melee (logic) and MeleeView
// (drawing) to the real Player, the brooch and PGR.
//
//   const bout = new MeleeBout(scene, { kind: 'warden', home: [18, 13], gid: 9203 })
//   const bout = new MeleeBout(scene, { F: GARBHAN, home: [18, 13], gid })   (enemies.js; bout.melee.engage() when he charges)
//   bout.update(delta)            every frame, after super.update()
//   bout.draw(ctx)                from onPGRDrawComplete(ctx)
//   bout.occupies(tx, ty)         for Player.startNewStep (scene.isOccupied)
//   bout.fieldTap(canvasX, canvasY) -> true if it was a strike/lunge on the foe
//   bout.destroy()
//
// The moon: while this is the scene's _moonOwner, perspectiveScene passes
// it the moon's presses. Swipe up stands you en garde (wooden sword in the
// right hand only); swipe down stands you at ease, and mid-bout that is
// yielding; swipe up again, en garde, and you salute. En garde, a tap
// strikes and a hold gathers a charged blow, so
// the long-press menu waits until you're at ease.

import Melee, { ENGAGE } from './melee.js'
import MeleeView from './meleeView.js'
import MeleeAudio from './meleeAudio.js'
import StaminaMoon from './staminaMoon.js'
import FightLens from './fightLens.js'
import { backViewCanvas } from '../effects/backView.js'
import PathFinder from '../systems/pathFinder.js'
import { SoundBoard } from '../systems/soundBoard.js'
import { WorldBus } from '../systems/worldBus.js'
import { GameState } from '../systems/gameState.js'
import { createItem } from '../ui/inventory/itemDefinitions.js'

export const SWORD_ID = 'wooden_sword'
const EDGED_IDS = ['bronze_sword']
export const SWORD_NOTE = 'got_wooden_sword'     // GameState note: the sword is yours, in every scene
export const STRONG_NOTE = 'strong_blow_taught'  // GameState note: the long hold (the strong blow) is yours: taught in the tournament, not before

/** The long hold is learned in the tournament (a student uses it, then shows you). Call this then. */
export function unlockStrong(scene) {
  GameState.addNote(STRONG_NOTE)
  try { if (scene?._melee?.melee) scene._melee.melee.noCharge = false } catch (_) {}
}

// Focus (bullet time): a line drawn in a bout slows the world, more the nearer you are to him: nothing at `far`
// tiles, down to `scale` at blade range. ONCE PER LINE: it comes on when the line (drawing it, or walking it)
// brings you inside `far`; from then on it only DEEPENS as you come nearer, never lifts, until the line is done
// (or he is `release` tiles off, or YOU run out: winded, the stillness goes first -- and a new line is needed
// to find it again). It costs BREATH while it holds -- one every `drainMs` of real time at full depth, less when
// shallower -- so the moon empties as you hold the slow, and seeing clearly competes with cutting. It used to follow the distance both ways, frame by frame, so a
// line that wandered in and out sped the world up and slowed it down over and over.
//   gapMs     a pause this short between drawing a line and walking it is still the same line
//   drainMs   real ms of full-depth slow that cost one breath (a foe's preset may set its own: F.drainMs)
// A foe's preset with F.flow (the otherside's ghouls) lets it play out: being struck does not end the line, and nor does the
// line's last step: the slow holds until your breath is gone, he is `release` tiles off, or the fight is over.
//   ghosts    YOUR afterimages as you move in it: how many, how often one is left (world ms), how strong the newest is, their colour
const FOCUS = { scale: 0.18, far: 4, release: 7, gapMs: 180, drainMs: 1500, grade: true,
                ghosts: 8, ghostEvery: 45, ghostAlpha: 0.6, ghostTint: 'rgb(110,185,255)' }

// The pack is rebuilt with every scene, so a sword you've been given is put
// back in it on arrival. Also makes its inventory icon (no art yet: the
// Oryx short sword from the item sheet).
export function prepareSword(scene, give = false) {
  const key = 'item_' + SWORD_ID
  if (!scene.textures.exists(key)) {
    const src = scene.itemSheet?.getCanvas?.(2492)          // TILES.SHORTSWORD
    if (src) {
      const c = document.createElement('canvas'); c.width = c.height = 32
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(src, 0, 0, 32, 32)
      scene.textures.addCanvas(key, c)
    }
  }
  if (give) GameState.addNote(SWORD_NOTE)
  const inv = scene.player?.inventory
  if (!inv || !GameState.hasNote(SWORD_NOTE)) return
  if (inv.slots.some(it => it?.id === SWORD_ID)) return
  inv.addItem?.(createItem(SWORD_ID))
}

const ANGLE_D8 = a => {
  if (a >= -22.5 && a < 22.5) return [1, 0]
  if (a >= 22.5 && a < 67.5) return [1, 1]
  if (a >= 67.5 && a < 112.5) return [0, 1]
  if (a >= 112.5 && a < 157.5) return [-1, 1]
  if (a >= 157.5 || a < -157.5) return [-1, 0]
  if (a >= -157.5 && a < -112.5) return [-1, -1]
  if (a >= -112.5 && a < -67.5) return [0, -1]
  return [1, -1]
}
const NOJOY = { force: 0, angle: 0 }

export default class MeleeBout {
  // kind null (the default): no sparring partner -- just your sword, in any scene
  // lens false: the camera does not close in on this bout (the otherside's fights come at you without a jump cut)
  constructor(scene, { kind = null, F = null, home, gid, voice, lens = true } = {}) {
    this.scene = scene
    const player = scene.player, ts = scene.tileSize
    const tileOf = (x, y) => [Math.floor(x / ts), Math.floor(y / ts)]
    const W = scene.mapData.width, H = scene.mapData.height

    // how the fight sees the real Player
    const pa = this.pa = {
      tile: () => player.isMoving ? tileOf(player.targetX, player.targetY) : tileOf(player.logicalX, player.logicalY),
      fromTile: () => player.isMoving ? tileOf(player.startX, player.startY) : pa.tile(),
      stepMs: () => player.stepDuration || 165,
      // the way you last walked: a cut at the air goes that way
      facing: () => {
        // en garde, still, with him near: you are looking at him (as the figure is drawn), so the cut goes there
        const m = this.melee
        if (m && m.enGarde && !m.noFoe && m.foe.hp > 0 && !player.isMoving && m.cheb() <= 5) {
          const [pc, pr] = pa.tile(), dx = Math.sign(m.foe.c - pc), dy = Math.sign(m.foe.r - pr)
          if (dx || dy) return [dx, dy]
        }
        const d = player.moveDirection; return d && (d.x || d.y) ? [d.x, d.y] : [0, -1]
      },
      onRoute: () => (player.pathQueue?.length || 0) > 0,
      held: () => !this.melee?.rooted && (scene.joystick?.force ?? 0) > 10 ? ANGLE_D8(scene.joystick.angle) : null,
      ahead: (n) => {
        let [c, r] = pa.tile()
        const held = pa.held(), q = player.pathQueue || []
        for (let i = 0; i < n; i++) {
          const s = q[i] ? [q[i].dx, q[i].dy] : held
          if (!s) break
          c += s[0]; r += s[1]
        }
        return [Math.max(0, Math.min(W - 1, c)), Math.max(0, Math.min(H - 1, r))]
      },
      // one step now, from wherever the player is (a step in progress is finished at once)
      forceStep: ([dx, dy]) => {
        if (!dx && !dy) return false
        if (player.isMoving) { player.logicalX = player.targetX; player.logicalY = player.targetY }
        player.isMoving = false; player.moveProgress = 0; player.pathQueue = []; player._waitUntil = 0
        player.startNewStep({ force: 100, angle: Math.atan2(dy, dx) * 180 / Math.PI })
        return player.isMoving
      },
      stopRoute: () => { player.pathQueue = []; player._waitUntil = 0 },
      atk: () => player.stats?.attack ?? 5,                  // Neart
      def: () => player.stats?.defense ?? 5,                 // Cosaint
      hp: () => player.currentHP,
      maxHp: () => player.maxHP,
      hurt: (n) => { const k = Math.min(n, player.currentHP - 1); if (k > 0) player.takeDamage(k, 'wooden sword') },
      free: (c, r) => c >= 0 && r >= 0 && c < W && r < H && !scene.isColliding(c * ts + ts / 2, r * ts + ts / 2) && !scene.figureAt?.(c, r),
      wet: (c, r) => !!scene.isWet?.(c, r),                  // water you'd drown in (skyeLoch)
      kill: () => { if (player.currentHP > 0) player.takeDamage(player.currentHP, 'knife') },
      // an edged blade in the right hand (the bronze sword): it cuts. The wooden one bruises.
      edged: () => { const it = player.inventory?.getEquippedItem?.('rightHand'); return !!it && (it.edged === true || EDGED_IDS.includes(it.id)) },
    }

    this.melee = new Melee({ kind, F, home, pa, emit: (n, d) => this._onEvent(n, d) })
    this.melee.noCharge = !GameState.hasNote(STRONG_NOTE)      // until it is taught, a hold is only a cut
    this.view = new MeleeView(scene, this.melee)
    this.audio = new MeleeAudio(scene, this.melee, { material: 'wood', ...(voice ? { foeVoice: voice } : {}) })
    this.moon = new StaminaMoon()                    // en garde, the brooch's moon shows your stamina
    this.lens = this.melee.noFoe || !lens ? null : new FightLens(scene, this.melee)   // the camera closes in on a bout
    this.gid = gid; this.flags = []

    // the foe is a PGR billboard, sorted with the player like any figure
    if (!this.melee.noFoe) this.flag = this._makeFlag(this.melee.foe, home)

    // While a hop or a blow is still settling, the feet wait. The Player
    // walks itself; this only stops it starting the next step too soon.
    this._origUpdate = player.update.bind(player)
    player.update = (joy, delta) => {
      delta *= this.focus?.k ?? 1                           // your feet slow with the world
      // rooted (a drill for the draw or the salute): no step starts, and no route waits to be walked later
      if (this.melee.rooted) { player.pathQueue = []; return this._origUpdate(NOJOY, delta) }
      if (!this.melee.feetHeld()) return this._origUpdate(joy, delta)
      const q = player.pathQueue; player.pathQueue = []
      this._origUpdate(NOJOY, delta)
      if (!player.pathQueue.length) player.pathQueue = q
    }

    scene._moonOwner = this
    this._last = performance.now()
    this.focus = { k: 1, on: false, latched: false, used: false, gap: Infinity, depth: 1 }
    // your afterimages while time is slow: [{ x, y, t }], each drawn by a figure of its own on the map (PGR sorts
    // them with everything else, so a ghost behind you is behind you)
    this.ghosts = []
    this.ghostFlags = Array.from({ length: FOCUS.ghosts }, (_, i) => {
      const fl = { tileX: 0, tileY: 0, visual: { flat: false }, offset: [0, 0], hidden: true }
      fl.draw = (ctx, x, y, w, pgr) => this._drawGhost(ctx, x, y, w, pgr, fl.alpha || 0)
      return fl
    })
    { const pgr = scene.perspectiveGround; pgr?.setEncounterFlags([...(pgr._encounterFlags || []), ...this.ghostFlags]) }
    this.melee.clock = performance.now()                   // the look's clock: real time, slowed with the world
  }

  // One foe's billboard. PGR calls its draw in the depth-sorted pass: his figure, then his sword with it (so you can stand in front
  // of either). The fight looks at one foe at a time (melee.foe), so his draw turns it to him for the moment.
  _makeFlag(foe, home) {
    const gid = this.gid
    const flag = { tileX: home[0], tileY: home[1], visual: { gid, flat: false }, offset: [0, 0], foe }
    flag.draw = (ctx, x, y, w, pgr) => {
      const m = this.melee, keep = m.foe
      m.foe = foe
      try {
        let img = pgr._getTileCanvas(gid)
        // He faces you; when he stands nearer the camera than you, we are looking at his back (generated, once per sprite)
        if (img) {
          const pf = this.view.playerFigure()
          if (pf && y > pf.y + 6) {
            this._backs = this._backs || new WeakMap()
            if (!this._backs.has(img)) { let c = null; try { c = backViewCanvas(img) } catch (_) {} this._backs.set(img, c) }
            img = this._backs.get(img) || img
          }
          pgr._drawBillboard(ctx, img, x, y, w, 1.2)
        }
        this.view.foeSword(ctx, { x, y, w, h: w * 1.2 })
      } finally { m.foe = keep }
    }
    this.flags.push(flag)
    const pgr = this.scene.perspectiveGround
    pgr?.setEncounterFlags([...(pgr._encounterFlags || []), flag])
    return flag
  }
  // another foe joins the fight at (c, r); returns his flag (flag.foe is his state)
  addFoe(c, r, delay = 0) { return this._makeFlag(this.melee.addFoe(c, r, delay), [c, r]) }

  get enGarde() { return this.melee.enGarde }
  swordInHand() { return this.scene.player?.inventory?.getEquippedItem?.('rightHand')?.subtype === 'sword' }
  // a conversation card is up: the moon is for the words
  _talking() { const s = this.scene; return !!(s._course?.speaking || s._encounterPanel?._isOpen || s.textPanel?.isVisible) }

  // ── the moon (called by perspectiveScene) ────────────────────────────────
  tap() { return this.melee.enGarde || this._talking() }                 // en garde, a tap is the strike: claimed here, done in pressEnd
  claimsLongPress() { return this.melee.enGarde }
  pressStart() { if (this._talking()) return; this.melee.pressStart() }
  pressEnd(info = {}) { this.melee.pressEnd(!!info.dragged || this._talking()) }
  swipeVertical(dir) {
    if (this._talking()) return                              // a gesture that scrolls his words is not a stance
    if (this.melee.bare) return                              // bare-handed (the space lesson): the stance is the lesson's
    if (dir === 'up') {
      if (!this.swordInHand()) return
      if (this.melee.enGarde) this.melee.salute()            // up again: a salute
      else this.melee.setEnGarde(true)
    } else if (this.melee.enGarde && !this.melee.noSheathe) this.melee.setEnGarde(false)
  }

  // ── the field ────────────────────────────────────────────────────────────
  fieldTap(canvasX, canvasY) {
    if (!this.melee.combat) return false
    // his figure stands up from his tile, so a tap on his body is over the
    // ground BEHIND him: test the figure on screen, with a little slack,
    // and fall back to the tile he stands on. Of several, the one nearest the camera gets it.
    const tile = PathFinder.screenToTile(canvasX, canvasY, this.scene.perspectiveGround, this.scene.tileSize)
    let hit = null
    for (const foe of this.melee.foes) {
      if (foe.hp <= 0 && this.melee.foes.length > 1) continue
      const f = this.view.foeFigure(foe)
      const onBody = f && Math.abs(canvasX - f.x) <= f.w * 0.65 && canvasY <= f.y + f.w * 0.3 && canvasY >= f.y - f.h * 1.1
      const onTile = !onBody && !!tile && tile.tx === foe.c && tile.ty === foe.r
      if ((onBody || onTile) && (!hit || foe.r > hit.r)) hit = foe
    }
    return hit ? this.melee.tapFoe(hit) : false
  }
  // Bullet time: a line drawn in a bout slows the world (FOCUS, above); lifting the finger, you walk it in the slow.
  // Returns the (scaled) time the fight and the view live by this frame.
  _focusStep(real) {
    const m = this.melee, f = this.focus, rd = this.scene._routeDraw
    const p = this.scene.player
    const onRoute = !!(rd?.route && (m.pa.onRoute() || p?.isMoving))        // still walking the line you drew: the slow holds, and you can fight in it
    // a LINE runs from the finger going down to the last step of it walked
    const drawing = !!(m.combat && m.enGarde && (rd?.trail || onRoute))
    f.gap = drawing ? 0 : f.gap + real
    const inLine = drawing || f.gap < FOCUS.gapMs
    if (!inLine) f.used = false                                             // that line is over: the next may slow time again
    // the nearer he is, the slower: smoothstep from nothing at `far` tiles to full depth beside him
    const s = Math.max(0, Math.min(1, (FOCUS.far - m.cheb()) / (FOCUS.far - 1))), e = s * s * (3 - 2 * s)
    const near = 1 - e * (1 - FOCUS.scale)
    const spent = m.winded() || m.breath < 1                                // out of breath: no slow
    if (!f.latched) {
      if (drawing && !f.used && !spent && near < 1) { f.latched = true; f.used = true; f.depth = near }   // once per line
    } else if ((!inLine && !m.F.flow) || spent || !m.combat || !m.enGarde || m.cheb() > FOCUS.release) f.latched = false      // flow: the line's end does not end the slow
    if (f.latched) f.depth = Math.min(f.depth, near)                        // deepens as you close, never lifts mid-line
    const target = f.latched ? f.depth : 1
    if (target < 1) m.spend(real / (m.F.drainMs ?? FOCUS.drainMs) * (1 - target) / (1 - FOCUS.scale))   // the slow costs breath (and holds its refilling off)
    f.k += (target - f.k) * Math.min(1, real / (target < f.k ? 110 : 190))        // in quickly, out in one smooth ramp
    if (Math.abs(f.k - target) < 0.005) f.k = target
    if (f.latched !== f.on) { f.on = f.latched; m.emit('focus', { on: f.on }) }   // one entry, one exit, per line
    this._grade((1 - f.k) / (1 - FOCUS.scale))
    WorldBus.setDepth(Math.round(Math.max(0, Math.min(1, (1 - f.k) / (1 - FOCUS.scale))) * 20) / 20)    // the world's sound is pushed away as time slows (kept up by this call, every frame)
    SoundBoard.slowK = f.k                                                  // and footsteps come down heavy
    m.focusK = f.k
    try { this.scene.tweens.timeScale = f.k } catch (_) {}
    const dt = real * f.k
    m.clock += dt
    this._ghostStep()
    return dt
  }
  /** how deep the slow is now: 0 (none) .. 1 (full) */
  _focusU() { return Math.max(0, Math.min(1, (1 - this.focus.k) / (1 - FOCUS.scale))) }

  // your afterimages: while time is slow and you move, a trail of you (on the world's clock)
  _ghostStep() {
    const g = this.ghosts, now = this.melee.clock, p = this.scene.player, ts = this.scene.tileSize
    while (g.length && now - g[0].t > FOCUS.ghostEvery * FOCUS.ghosts) g.shift()
    if (p && this._focusU() >= 0.3) {
      const x = p.logicalX / ts - 0.5, y = p.logicalY / ts - 0.5, last = g[g.length - 1]
      const here = this._ghostHere
      this._ghostHere = [x, y]
      const moved = here && Math.hypot(x - here[0], y - here[1]) > 0.002
      if (moved && (!last || now - last.t >= FOCUS.ghostEvery)) g.push({ x, y, t: now })
    }
    // put the figures where the ghosts are (the newest last)
    const span = FOCUS.ghostEvery * FOCUS.ghosts, u = this._focusU()
    this.ghostFlags.forEach((fl, i) => {
      const gh = g[g.length - 1 - i]
      if (!gh || u <= 0) { fl.hidden = true; return }
      const c = Math.round(gh.x), r = Math.round(gh.y)
      fl.tileX = c; fl.tileY = r; fl.offset[0] = gh.x - c; fl.offset[1] = gh.y - r
      fl.alpha = FOCUS.ghostAlpha * u * Math.max(0, 1 - (now - gh.t) / span)
      fl.hidden = fl.alpha <= 0.01
    })
  }
  // one afterimage: your figure as it is now, in one cool colour, flipped the way you face
  _drawGhost(ctx, x, y, w, pgr, alpha) {
    const img = pgr._playerCanvas
    if (!img?.width || alpha <= 0) return
    const tint = this._tintFrame(img, pgr)
    const PS = pgr.constructor.PLAYER_SCALE ?? 1, W = w * PS, H = W * img.height / img.width
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.imageSmoothingEnabled = false
    ctx.translate(x, y)
    if (pgr._facingLeft) ctx.scale(-1, 1)
    ctx.drawImage(tint, -W / 2, -H, W, H)
    ctx.restore()
  }
  // the current frame of you, tinted (once per frame drawn, shared by every ghost)
  _tintFrame(img, pgr) {
    const key = pgr._animT
    if (this._tint && this._tint.key === key && this._tint.src === img) return this._tint.c
    let c = this._tint?.c
    try {
      if (!c || c.width !== img.width || c.height !== img.height) { c = document.createElement('canvas'); c.width = img.width; c.height = img.height }
      const g = c.getContext('2d')
      g.globalCompositeOperation = 'copy'; g.drawImage(img, 0, 0)
      g.globalCompositeOperation = 'source-in'; g.fillStyle = FOCUS.ghostTint; g.fillRect(0, 0, c.width, c.height)
    } catch (_) { return img }
    this._tint = { key, src: img, c }
    return c
  }

  // the whole picture goes cool, drained and a little dark while time is slow
  _grade(u) {
    if (!FOCUS.grade) return
    u = Math.round(Math.max(0, Math.min(1, u)) * 20) / 20           // in 5% steps, so the style is only touched when it visibly changes
    if (u === this._gradeU) return
    this._gradeU = u
    try {
      const cv = this.scene.game?.canvas
      if (!cv) return
      cv.style.transition = ''
      cv.style.filter = u > 0 ? `saturate(${(1 - 0.6 * u).toFixed(2)}) contrast(${(1 + 0.15 * u).toFixed(2)}) brightness(${(1 - 0.12 * u).toFixed(2)}) hue-rotate(${(-10 * u).toFixed(1)}deg)` : ''
    } catch (_) {}
  }

  // the Player walked into him (Player.startNewStep -> scene.onBumpFigure)
  bump(dx, dy) { this.melee.bump([dx, dy]) }
  occupies(tx, ty) { const m = this.melee; return !m.noFoe && m.foes.some(f => (f.hp > 0 || m.foes.length < 2) && f.c === tx && f.r === ty) }

  // ── the frame ────────────────────────────────────────────────────────────
  update(delta) {
    const m = this.melee
    if (m.enGarde && !m.bare && !this.swordInHand()) m.setEnGarde(false)     // the sword was put away in the menu
    // en garde, or in a fight (from engage() to endFight()), you step at fighting pace (as the fights
    // were tuned); otherwise, walking
    this.scene.player?.setWalkPace?.(m.enGarde || m.fight || m.combat ? 1 : null)
    if (this.scene._encounterPanel?._isOpen) return               // a conversation: the fight holds its breath
    delta = this._focusStep(delta)
    m.update(delta)
    for (const fl of this.flags) {
      const foe = fl.foe, [x, y] = m.foeDrawPos(foe)
      fl.tileX = foe.c; fl.tileY = foe.r
      fl.offset[0] = x - foe.c; fl.offset[1] = y - foe.r
      m.foe = foe
      try { fl.pose = this.view.flagPose = this.view.foePose() } finally { m.foe = m.tgt }
    }
    this.audio.update()
    this.moon.update(m, this.scene.player, this._talking())
    this.lens?.update(delta)
    this._dt = delta
  }
  draw(ctx) { this.view.draw(ctx, this._dt || 16) }
  // how opaque the player may be drawn (perspectiveScene's occlusion fade asks)
  playerFade() { return this.view.playerFade() }
  // how the sword is held (PGR's weapon overlay asks); null = at ease, point lowered
  weaponPose() { return this.view.weaponPose() }
  // how the body stands (PGR asks): crouch, footwork, lean, falls; null = as normal
  playerPose() { return this.view.playerPose() }
  // En garde with him near, you face him: your back to the camera when he's
  // further off than you, your front when he's nearer, turned to his side.
  // Otherwise null, and the way you walk decides (PGR).
  playerFacing() {
    const spin = this.view.spinFacing()                       // turning through all four views
    if (spin) return spin
    const m = this.melee
    if (!m.enGarde || m.foe.hp <= 0 || m.cheb() > 5) return null
    const [pc, pr] = m.pa.tile(), f = m.foe
    return { away: f.r < pr ? true : f.r > pr ? false : null, left: f.c < pc ? true : f.c > pc ? false : null }
  }
  // PGR skips idle redraws; the fight must keep drawing while it's live
  animating() { const m = this.melee; return !!this.lens?.active || m.enGarde || m.combat || m.bout.over || m.foes.some(f => f.from || f.state !== 'idle') || this.focus.k < 1 || !!this.view._punch || this.view.catching() || this.view.now() - this.view.a.ease < 1000 }

  _onEvent(name, d) {
    this.view.onEvent(name, d)
    this.audio.onEvent(name, d)
    if (name === 'focus') this.lens?.kick(d.on ? 1 : -1)             // the camera punches in as bullet time begins, out as it ends
    this.scene.onMeleeEvent?.(name, d)                        // e.g. the crowd on the green
    // for the story: you struck a man without his sword
    if (name === 'struckUnarmed') GameState.addNote(`struck_unarmed_${this.melee.kind}`)
    if (name === 'cheapShot') GameState.addNote(`cheap_shot_${this.melee.kind}`)       // struck him as he saluted
    const cap = this.scene.boutCaptions === false ? null : this.scene._caption   // a lesson does its own talking
    if (name === 'enGarde') cap?.show('Ar aire!', 'On guard!', 1200)
    if (name === 'atEase') cap?.show('Seas ar ais', 'At ease', 1200)
    if (name === 'boutOver' && !d.how) {                      // a fight that ends its own way (d.how) is the scene's to tell
      if (d.won) cap?.show('Bua!', 'Victory! He yields.', 2400)
      else cap?.show(d.ga || 'Buaileadh thú', d.en || 'You were beaten', 2400)
    }
    if (name === 'winded') cap?.show('Tuirse', 'Winded', 900)
  }

  destroy() {
    const p = this.scene.player
    if (this.melee.owed > 0) this.melee.pa.hurt(this.melee.owed)       // the fight is over: what you were still owed is paid (never your last heart)
    p?.setWalkPace?.(null)
    if (p && this._origUpdate) p.update = this._origUpdate
    const pgr = this.scene.perspectiveGround
    if (pgr?._encounterFlags) pgr.setEncounterFlags(pgr._encounterFlags.filter(f => !this.flags.includes(f) && !this.ghostFlags?.includes(f)))
    if (this.scene._moonOwner === this) this.scene._moonOwner = null
    this.view.destroy()
    this.audio.destroy()
    try { this.scene.tweens.timeScale = 1 } catch (_) {}
    this._grade(0)
    WorldBus.setDepth(0); SoundBoard.slowK = 1
    this.moon.destroy()
    this.lens?.destroy()
  }
}

export { ENGAGE }

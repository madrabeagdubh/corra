// meleeBout.js
// Location: js/game/combat/meleeBout.js
//
// One sparring partner in one scene: joins Melee (logic) and MeleeView
// (drawing) to the real Player, the brooch and PGR.
//
//   const bout = new MeleeBout(scene, { kind: 'warden', home: [18, 13], gid: 9203 })
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
import PathFinder from '../systems/pathFinder.js'
import { GameState } from '../systems/gameState.js'
import { createItem } from '../ui/inventory/itemDefinitions.js'

export const SWORD_ID = 'wooden_sword'
export const SWORD_NOTE = 'got_wooden_sword'     // GameState note: the sword is yours, in every scene

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
  constructor(scene, { kind = null, home, gid } = {}) {
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
      facing: () => { const d = player.moveDirection; return d && (d.x || d.y) ? [d.x, d.y] : [0, -1] },
      onRoute: () => (player.pathQueue?.length || 0) > 0,
      held: () => (scene.joystick?.force ?? 0) > 10 ? ANGLE_D8(scene.joystick.angle) : null,
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
      hp: () => player.currentHP,
      maxHp: () => player.maxHP,
      hurt: (n) => { const k = Math.min(n, player.currentHP - 1); if (k > 0) player.takeDamage(k, 'wooden sword') },
      free: (c, r) => c >= 0 && r >= 0 && c < W && r < H && !scene.isColliding(c * ts + ts / 2, r * ts + ts / 2) && !scene.figureAt?.(c, r),
    }

    this.melee = new Melee({ kind, home, pa, emit: (n, d) => this._onEvent(n, d) })
    this.view = new MeleeView(scene, this.melee)
    this.audio = new MeleeAudio(scene, this.melee, { material: 'wood' })
    this.moon = new StaminaMoon()                    // en garde, the brooch's moon shows your stamina
    this.lens = this.melee.noFoe ? null : new FightLens(scene, this.melee)   // the camera closes in on a bout

    // the foe is a PGR billboard, sorted with the player like any figure
    if (!this.melee.noFoe) {
      this.flag = { tileX: home[0], tileY: home[1], visual: { gid, flat: false }, offset: [0, 0] }
      const pgr = scene.perspectiveGround
      pgr?.setEncounterFlags([...(pgr._encounterFlags || []), this.flag])
    }

    // While a hop or a blow is still settling, the feet wait. The Player
    // walks itself; this only stops it starting the next step too soon.
    this._origUpdate = player.update.bind(player)
    player.update = (joy, delta) => {
      if (!this.melee.feetHeld()) return this._origUpdate(joy, delta)
      const q = player.pathQueue; player.pathQueue = []
      this._origUpdate(NOJOY, delta)
      if (!player.pathQueue.length) player.pathQueue = q
    }

    scene._moonOwner = this
    this._last = performance.now()
  }

  get enGarde() { return this.melee.enGarde }
  swordInHand() { return this.scene.player?.inventory?.getEquippedItem?.('rightHand')?.subtype === 'sword' }

  // ── the moon (called by perspectiveScene) ────────────────────────────────
  tap() { return this.melee.enGarde }                 // en garde, a tap is the strike: claimed here, done in pressEnd
  claimsLongPress() { return this.melee.enGarde }
  pressStart() { this.melee.pressStart() }
  pressEnd(info = {}) { this.melee.pressEnd(!!info.dragged) }
  swipeVertical(dir) {
    if (dir === 'up') {
      if (!this.swordInHand()) return
      if (this.melee.enGarde) this.melee.salute()            // up again: a salute
      else this.melee.setEnGarde(true)
    } else if (this.melee.enGarde) this.melee.setEnGarde(false)
  }

  // ── the field ────────────────────────────────────────────────────────────
  fieldTap(canvasX, canvasY) {
    if (!this.melee.combat) return false
    const foe = this.melee.foe
    // his figure stands up from his tile, so a tap on his body is over the
    // ground BEHIND him: test the figure on screen, with a little slack,
    // and fall back to the tile he stands on
    const f = this.view.foeFigure()
    const onBody = f && Math.abs(canvasX - f.x) <= f.w * 0.65 && canvasY <= f.y + f.w * 0.3 && canvasY >= f.y - f.h * 1.1
    let onTile = false
    if (!onBody) {
      const tile = PathFinder.screenToTile(canvasX, canvasY, this.scene.perspectiveGround, this.scene.tileSize)
      onTile = !!tile && tile.tx === foe.c && tile.ty === foe.r
    }
    return onBody || onTile ? this.melee.tapFoe() : false
  }
  // the Player walked into him (Player.startNewStep -> scene.onBumpFigure)
  bump(dx, dy) { this.melee.bump([dx, dy]) }
  occupies(tx, ty) { return !this.melee.noFoe && tx === this.melee.foe.c && ty === this.melee.foe.r }

  // ── the frame ────────────────────────────────────────────────────────────
  update(delta) {
    const m = this.melee
    if (m.enGarde && !this.swordInHand()) m.setEnGarde(false)     // the sword was put away in the menu
    if (this.scene._encounterPanel?._isOpen) return               // a conversation: the fight holds its breath
    m.update(delta)
    if (this.flag) {
      const [x, y] = m.foeDrawPos()
      this.flag.tileX = m.foe.c; this.flag.tileY = m.foe.r
      this.flag.offset[0] = x - m.foe.c; this.flag.offset[1] = y - m.foe.r
      this.flag.pose = this.view.flagPose = this.view.foePose()
    }
    this.audio.update()
    this.moon.update(m, this.scene.player)
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
    const m = this.melee
    if (!m.enGarde || m.foe.hp <= 0 || m.cheb() > 5) return null
    const [pc, pr] = m.pa.tile(), f = m.foe
    return { away: f.r < pr ? true : f.r > pr ? false : null, left: f.c < pc ? true : f.c > pc ? false : null }
  }
  // PGR skips idle redraws; the fight must keep drawing while it's live
  animating() { const m = this.melee; return !!this.lens?.active || m.enGarde || m.combat || m.bout.over || !!m.foe.from || m.foe.state !== 'idle' || performance.now() - this.view.a.ease < 1000 }

  _onEvent(name, d) {
    this.view.onEvent(name, d)
    this.audio.onEvent(name, d)
    this.scene.onMeleeEvent?.(name, d)                        // e.g. the crowd on the green
    // for the story: you struck a man without his sword
    if (name === 'struckUnarmed') GameState.addNote(`struck_unarmed_${this.melee.kind}`)
    if (name === 'cheapShot') GameState.addNote(`cheap_shot_${this.melee.kind}`)       // struck him as he saluted
    const cap = this.scene.boutCaptions === false ? null : this.scene._caption   // a lesson does its own talking
    if (name === 'enGarde') cap?.show('Ar aire!', 'On guard!', 1200)
    if (name === 'atEase') cap?.show('Seas ar ais', 'At ease', 1200)
    if (name === 'boutOver') {
      if (d.won) cap?.show('Bua!', 'Victory! He yields.', 2400)
      else cap?.show(d.ga || 'Buaileadh thú', d.en || 'You were beaten', 2400)
    }
    if (name === 'winded') cap?.show('Tuirse', 'Winded', 900)
  }

  destroy() {
    const p = this.scene.player
    if (p && this._origUpdate) p.update = this._origUpdate
    const pgr = this.scene.perspectiveGround
    if (this.flag && pgr?._encounterFlags) pgr.setEncounterFlags(pgr._encounterFlags.filter(f => f !== this.flag))
    if (this.scene._moonOwner === this) this.scene._moonOwner = null
    this.view.destroy()
    this.audio.destroy()
    this.moon.destroy()
    this.lens?.destroy()
  }
}

export { ENGAGE }

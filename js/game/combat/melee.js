// melee.js
// Location: js/game/combat/melee.js
//
// Sword fighting on the tile grid, ported from the Practice Yard
// (combat.html). Logic only: no drawing, no sound, no DOM. meleeView.js
// draws it; meleeBout.js joins it to a scene.
//
// WOODEN BLADES ONLY (Skye). Nobody dies: the blow that would take a
// fighter's last heart ends the bout instead -- they yield on one heart.
// Steel mode (dice, the toll, wounds, blood) stays in the yard for now.
//
// Foes: the sword family only -- 'spar' (Swordsman), 'warden', 'master',
// 'brawler'. Axe, spear and shield need their own visuals and come later.
//
// The player is NOT moved by this module. The real Player walks itself;
// this reads where it is through an adapter (`pa`) and asks it to take a
// forced step for a lunge or a knock back:
//
//   pa.tile()          [c, r]  the tile it stands on, or is stepping onto
//   pa.fromTile()      [c, r]  the tile a step started from (or tile())
//   pa.stepMs()        how long one step takes
//   pa.facing()        [dx, dy] the way they last walked (for a swing at the air)
//   pa.onRoute()       true while following a tapped path
//   pa.held()          [dx, dy] while a brooch direction is held, else null
//   pa.ahead(n)        [c, r] where they'll be n steps along route / held dir
//   pa.forceStep(d)    take one step along d now; true if it went
//   pa.stopRoute()     drop any tapped path
//   pa.hp(), pa.maxHp()
//   pa.hurt(n)         lose n hearts (never below 1)
//   pa.free(c, r)      walkable, ignoring fighters
//
// Its own clock: update(dt) is the only thing that moves time, so a
// paused scene (dialogue, menu) pauses the fight.

// He becomes a threat only when you stand en garde within ENGAGE tiles; the
// bout is over when you're beyond DISENGAGE (or at ease). Your sword is yours
// to swing anywhere -- out of a bout it costs nothing and hits nothing.
export const ENGAGE = 5, DISENGAGE = 6, LEASH = 3
const SALUTE_MS = 1600, DOWN_MS = 1300, PLAYER_DOWN_MS = 1700
const DISARM_CHANCE = 0.45, SHAMED_DOWN_MS = 5200, SWORD_FLIGHT_MS = 650     // SALUTE_MS: keep in step with meleeView.js

const P = { hopRest: 110, swingMs: 150, strikeRecover: 320, reelMs: 200, hurtMs: 650 }
const BR = { regenMs: 700, idleMs: 450, windedMs: 1200, windedBack: 2, lungeRecover: 140 }
const BUFFER_MS = 200
export const CHARGE = { startMs: 250, fullMs: 700, breath: 2 }
// a patient cut is hauled from the shoulder; a quick backhand is shorter, lighter, and lands sooner
const SW = { full: { vis: 380, hitAt: 215, rec: 300 }, quick: { vis: 250, hitAt: 141, rec: 240 } }

const BASE = {
  hp: 6, dmg: 1, stepMs: 330, windMs: 650, strikeMs: 120, recoverMs: 750, reelMs: 480, staggerMs: 400,
  counterWind0: 560, counterWindStep: 50, counterWindMin: 380,
  parryBase: 0.4, parryReel0: 0.3, parryReelStep: 0.12, parryMax: 0.8, restMin: 500, restMax: 1200,
  lead: 0, combo: 0, followWind: 400, rushWind: 330, ambush: false, style: null,
}
export const PRESETS = {
  // reads your route, aims where you're going, follows a miss at once
  spar:    { ...BASE, lead: 1, combo: 1, followWind: 380, ambush: true },
  // holds his ground, parries, answers a cut that finds nothing
  warden:  { ...BASE, style: 'warden', hp: 7, stepMs: 420, windMs: 560, recoverMs: 650, staggerMs: 500, followWind: 360,
             parryBase: 0.55, parryReel0: 0.4, parryReelStep: 0.1, parryMax: 0.85, restMin: 600, restMax: 1100 },
  // keeps two tiles off, circles, feints, lunges
  master:  { ...BASE, style: 'master', stepMs: 300, windMs: 620, recoverMs: 650, followWind: 320, combo: 1, lead: 1, ambush: true,
             rushWind: 380, parryBase: 0.45, restMin: 300, restMax: 700 },
  // no guard, fast, three cuts, wide open afterwards
  brawler: { ...BASE, style: 'brawler', hp: 5, stepMs: 250, windMs: 400, strikeMs: 110, recoverMs: 800, staggerMs: 120,
             followWind: 280, combo: 2, parryBase: 0, parryReel0: 0, parryReelStep: 0, parryMax: 0, restMin: 120, restMax: 350 },
}

const D8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
const sign = v => (v > 0) - (v < 0)
const deg = (y, x) => Math.atan2(y, x) * 180 / Math.PI
const toD8 = a => D8[((Math.round(a / 45) % 8) + 8) % 8]

export default class Melee {
  // kind: a PRESETS key, or null for no foe at all -- just you and your
  // sword (every scene has one of these; see perspectiveScene).
  constructor({ kind = 'warden', home = [-99, -99], pa, emit = () => {} }) {
    this.noFoe = !PRESETS[kind]
    this.F = { ...(PRESETS[kind] || BASE) }
    this.kind = kind
    this.HOME = home
    this.pa = pa
    this.emit = emit
    this.t = 0
    this.practice = 0                      // dodges grow with every blow slipped or sidestepped
    this.enGarde = false
    this.foe = { c: home[0], r: home[1], from: null, t0: 0, ms: 0, face: 90, hurtUntil: 0 }
    this._resetFoe()
    this.p = { busyUntil: 0, busyKind: 'other', cancelAt: 0, hurtUntil: 0, lost: false, downUntil: 0 }
    this.combat = false
    this.exchange = 0
    this.breath = pa.maxHp()
    this.lastSpend = 0
    this.windedUntil = 0
    this.swing = null
    this.queued = null
    this.lastSwing = { t: -1e9, flip: false }
    this.charge = null                     // { t0 } while gathering
    this.splutterUntil = 0
    this.press = null                      // { t0 } while a finger is on the moon
    this.hitStop = 0
    this.bout = { over: false, until: 0, needLeave: false }
    this._lastTile = null
    this.peaceful = false                  // true: no bout starts, whatever you do (a lesson on the green)
  }

  // ── small helpers ────────────────────────────────────────────────────────
  now() { return this.t }
  cheb() { const [c, r] = this.pa.tile(); return Math.max(Math.abs(this.foe.c - c), Math.abs(this.foe.r - r)) }
  towardFoe() { const [c, r] = this.pa.tile(); return [sign(this.foe.c - c), sign(this.foe.r - r)] }
  targetTile() { const [c, r] = this.pa.tile(), d = this.towardFoe(); return [c + d[0], r + d[1]] }
  winded() { return this.t < this.windedUntil }
  cap() { return Math.max(1, this.pa.hp()) }                       // breath can't exceed your hearts
  desperate() { return this.combat && this.pa.hp() <= 1 }           // last heart: the moon glows red
  chargeK() { return this.charge ? Math.min(1, (this.t - this.charge.t0) / CHARGE.fullMs) : 0 }
  moving() { return this.pa.onRoute() || !!this.pa.held() }
  foeMax() { return this.F.hp }
  // is (c, r) taken by the player, mid-step included?
  playerOn(c, r) {
    const a = this.pa.tile(), b = this.pa.fromTile()
    return (a[0] === c && a[1] === r) || (b[0] === c && b[1] === r)
  }
  foeFree(c, r) { return this.pa.free(c, r) && !this.playerOn(c, r) }

  // a foe on the ground only matters in a bout; your sword is yours to swing anywhere
  canAct() { const p = this.p; return !p.lost && !this.charge && this.t >= p.busyUntil && (this.foe.hp > 0 || !this.combat) }
  // a hop may cut into the tail of a strike, so strike-hop-strike flows
  canMove() {
    const p = this.p
    if (p.lost || this.charge) return false
    return this.t >= p.busyUntil || (p.busyKind === 'strike' && this.t >= p.cancelAt)
  }
  // a strike may start mid-hop, so you can cut as you pass
  canStrike() {
    return this.canAct() || (!this.p.lost && !this.charge && (this.foe.hp > 0 || !this.combat) &&
      (this.p.busyKind === 'hop' || (this.swing && this.swing.hitDone)))
  }
  // Should the Player's feet wait this frame? Only ever while swords are out.
  feetHeld() { return !!this.charge || this.p.downUntil > this.t || (this.combat && !this.canMove()) }

  act(fn, kind = 'full') {
    const ok = kind === 'move' ? this.canMove() : kind === 'strike' ? this.canStrike() : this.canAct()
    if (ok) return fn()
    const p = this.p
    if (!p.lost && !this.charge && (p.busyUntil - this.t <= BUFFER_MS || (kind === 'strike' && this.swing && !this.swing.hitDone)))
      this.queued = { fn, kind, until: this.t + BUFFER_MS + 100 }
  }

  spend(n) {
    this.breath = Math.max(0, this.breath - n); this.lastSpend = this.t
    if (this.breath < 1 && !this.winded()) { this.windedUntil = this.t + BR.windedMs; this.splutterUntil = this.t + 2600; this.emit('winded') }
  }
  refund() { this.breath = Math.min(this.cap(), this.breath + 1) }

  // ── stance ───────────────────────────────────────────────────────────────
  setEnGarde(on) {
    if (on === this.enGarde) return
    this.enGarde = on
    if (!on) {
      if (this.combat && !this.bout.over) this._playerYields('Ghéill tú', 'You yielded', false)
      this._spoilCharge()
      this._endCombat()
    }
    this.emit(on ? 'enGarde' : 'atEase')
  }

  // ── the moon ─────────────────────────────────────────────────────────────
  // A press begins; held past CHARGE.startMs it starts gathering (in update).
  pressStart() { this.press = this.enGarde ? { t0: this.t } : null }
  // The finger lifts. dragged: it swiped instead, so nothing is struck.
  pressEnd(dragged = false) {
    const pr = this.press; this.press = null
    if (!this.enGarde || !pr) return
    if (dragged) { this._spoilCharge(); return }
    if (this.charge) return this._releaseCharge()
    this.act(() => this.strike(), 'strike')
  }

  // ── the player's actions ─────────────────────────────────────────────────
  // A salute (swipe up again, en garde). Between blows, at a distance, he
  // returns it. It takes the time it takes: you're open while you do it.
  salute() {
    if (!this.enGarde || !this.canAct() || this.p.downUntil > this.t) return false
    this.p.busyUntil = this.t + SALUTE_MS; this.p.busyKind = 'salute'
    this.emit('salute', { by: 'player' })
    const foe = this.foe
    if (this.combat && foe.armed && this.cheb() >= 2 && ['idle', 'approach', 'rest'].includes(foe.state)) {
      this._setFoe('salute', SALUTE_MS)
      this.emit('salute', { by: 'foe', reply: true })
    }
    return true
  }

  _nextFlip() { const f = this.t - this.lastSwing.t < 550 ? !this.lastSwing.flip : false; this.lastSwing = { t: this.t, flip: f }; return f }

  strike(opts = {}) {
    if (!this.enGarde || this.p.lost || this.p.downUntil > this.t) return
    const charged = !!opts.charged
    // every swing costs breath, in a bout or out of one: you feel your stamina
    if (this.winded() || this.breath < 1) {
      if (this.pa.hp() <= 1) this.splutterUntil = Math.max(this.splutterUntil, this.t + 2200)   // nothing left: it chokes you
      this.emit('spent', { lastHeart: this.pa.hp() <= 1 }); return
    }
    if (!this.combat) return this._airSwing(charged)
    const desperate = this.pa.hp() <= 1                      // last heart: one blow that cannot be turned aside
    const inFlurry = !charged && this.t - this.lastSwing.t < 550
    const flip = charged ? (this.lastSwing = { t: this.t, flip: false }, false) : this._nextFlip()
    const base = flip ? SW.quick : SW.full
    const k0 = inFlurry ? 0.3 : 0, toHit = base.hitAt - k0 * base.vis, rec = inFlurry ? 140 : base.rec
    this.swing = { tile: this.targetTile(), t0: this.t - k0 * base.vis, hitDone: false, desperate, charged, flip,
                   vis: base.vis, hitAt: base.hitAt }
    // on the move, the cut rides on the stride: no recovery, the walk carries on
    const p = this.p
    if (!(this.moving() && p.busyKind === 'hop')) {
      p.busyUntil = this.t + toHit + rec; p.busyKind = 'strike'; p.cancelAt = this.t + toHit + 40
      if (this.moving()) p.cancelAt = this.t
    }
    this.spend(desperate ? this.breath : charged ? CHARGE.breath : 1)
    this.emit('swing', { flip, desperate, charged, patient: !flip && !inFlurry })
  }

  // A cut at the air, anywhere: practice, a flourish. Hits nothing, but it
  // costs breath like any other.
  _airSwing(charged) {
    const [c, r] = this.pa.tile(), d = this.pa.facing()
    const flip = charged ? (this.lastSwing = { t: this.t, flip: false }, false) : this._nextFlip()
    const base = flip ? SW.quick : SW.full
    this.swing = { tile: [c + d[0], r + d[1]], t0: this.t, hitDone: true, air: true, desperate: false, charged, flip,
                   vis: base.vis, hitAt: base.hitAt }
    const p = this.p
    if (!(this.moving() && p.busyKind === 'hop')) { p.busyUntil = this.t + base.hitAt + base.rec * 0.7; p.busyKind = 'strike'; p.cancelAt = this.t + base.hitAt }
    this.spend(charged ? CHARGE.breath : 1)
    this.emit('swing', { flip, charged, air: true })
  }

  // from two tiles off: hop in and strike, for two breath
  lunge() {
    if (!this.combat || this.cheb() !== 2) return
    const d = this.towardFoe()
    if (this.winded() || this.breath < 2) return this.act(() => this.pa.forceStep(d), 'move')
    if (!this.pa.forceStep(d)) return
    const step = this.pa.stepMs()
    this.swing = { tile: [this.foe.c, this.foe.r], t0: this.t + step, hitDone: false, desperate: false, lunge: true, flip: false,
                   vis: SW.full.vis, hitAt: SW.full.hitAt }
    this.lastSwing = { t: this.t, flip: false }
    const p = this.p
    p.busyUntil = this.t + step + SW.full.hitAt + SW.full.rec + BR.lungeRecover; p.busyKind = 'other'
    this.spend(2)
    this.emit('swing', { lunge: true })
  }

  // tapping the foe on the field
  tapFoe() {
    if (!this.combat) return false
    const d = this.cheb()
    if (this.carrying && d <= 1) { this._returnSword(); return true }     // hand it back
    if (d === 1) { this.act(() => this.strike(), 'strike'); return true }
    if (d === 2) { this.pa.stopRoute(); this.act(() => this.lunge()); return true }
    return false
  }

  _beginCharge() {
    if (this.charge || !this.enGarde || this.p.lost || this.p.downUntil > this.t) return
    if (this.winded() || this.breath < CHARGE.breath) return
    if (this.combat ? !this.canAct() : this.t < this.p.busyUntil) return
    this.charge = { t0: this.t }; this.pa.stopRoute(); this.queued = null
    this.emit('chargeStart', { ms: CHARGE.fullMs })
  }
  _releaseCharge() {
    const full = this.chargeK() >= 1
    this.charge = null; this.p.busyUntil = this.t; this.p.busyKind = 'other'
    this.strike({ charged: full })                            // let go early and it's an ordinary cut
  }
  _spoilCharge() {                                            // struck while gathering: it's gone, and so is the hold
    if (!this.charge) return
    this.charge = null; this.p.busyUntil = this.t; this.p.busyKind = 'other'
    this.press = null
  }

  // the player started a step (seen as the tile changing)
  _onPlayerStep() {
    if (!this.combat) return
    const p = this.p
    if (p.busyKind === 'strike' && this.t < p.busyUntil) return   // a hop cut into a strike's tail: keep its timing
    p.busyKind = 'hop'
    p.busyUntil = this.t + this.pa.stepMs() + (this.pa.onRoute() ? 40 : P.hopRest)
  }

  // ── your blow arrives ────────────────────────────────────────────────────
  _playerStrikeLands() {
    if (!this.combat || this.swing.air) return
    const foe = this.foe, F = this.F, sw = this.swing
    const [tc, tr] = sw.tile
    if (foe.hp > 0 && (foe.c !== tc || foe.r !== tr)) foe.whiffAt = this.t        // a swing at nothing: a patient man notices
    if (foe.hp <= 0 || foe.c !== tc || foe.r !== tr || this.t < foe.hurtUntil) return
    if (foe.state === 'strike' && !foe.hitDone) return this._clash()               // both blows at once
    if (!foe.armed) return this._struckUnarmed()
    const open = ['wind', 'reel'].includes(foe.state)       // caught mid-move: a clean hit, and a breath back
    const cheap = foe.state === 'salute'                     // struck as he salutes you: it lands, and everyone saw
    const chance = sw.desperate || sw.charged || cheap ? 0
                 : foe.state === 'recover' || foe.state === 'stagger' ? 0
                 : foe.state === 'reel' ? Math.min(F.parryMax, F.parryReel0 + F.parryReelStep * this.exchange)
                 : foe.state === 'wind' ? 0 : F.parryBase
    if (Math.random() < chance) return this._foeParries()
    const dmg = sw.desperate ? 2 : 1, exchange = this.exchange
    foe.hurtUntil = this.t + 300; this.exchange = 0
    if (open) this.refund()
    this.hitStop = sw.desperate ? 140 : 80
    this.emit('hit', { on: 'foe', dmg, desperate: sw.desperate, charged: sw.charged, exchange, fresh: this.breath / this.cap() >= 0.75 && !cheap })
    if (cheap) this.emit('cheapShot')
    if (foe.hp - dmg <= 0) { foe.hp = 0; return this._foeYields() }
    foe.hp -= dmg
    if (sw.charged) {                                         // a full charged cut puts him on the ground
      this._setFoe('down', DOWN_MS); foe.hurtUntil = this.t + DOWN_MS
      const [pc, pr] = this.pa.tile(); this._knockFoe([sign(foe.c - pc), sign(foe.r - pr)])
      this.emit('knockdown', { who: 'foe' }); return
    }
    if (foe.state === 'wind') this._setFoe('stagger', F.staggerMs)
    else if (foe.state === 'reel') this._setFoe('recover', 500)
    const [pc, pr] = this.pa.tile()
    this._knockFoe([sign(foe.c - pc), sign(foe.r - pr)])
  }

  // they turn your blow aside, and come straight back, a little faster each time
  _foeParries() {
    const F = this.F, foe = this.foe
    this.exchange++; this.hitStop = 70
    this.p.busyUntil = this.t + P.reelMs; this.queued = null
    foe.target = [...this.pa.tile()]; foe.targets = [foe.target]
    foe.wind = Math.max(F.counterWindMin, F.counterWind0 - F.counterWindStep * this.exchange)
    this._setFoe('wind', foe.wind)
    this.emit('parried', { by: 'foe', exchange: this.exchange, wind: foe.wind })
  }

  _clash() {
    const foe = this.foe, charged = !!this.swing?.charged
    this.exchange++; this.hitStop = 100
    const [pc, pr] = this.pa.tile()
    const d = [sign(pc - foe.c), sign(pr - foe.r)]
    this.pa.forceStep(d); this._foeStepTo(foe.c - d[0], foe.r - d[1], 140)
    this.swing = null; foe.hitDone = true
    this.p.busyUntil = this.t + 260
    this._setFoe('rest', 500)
    this.emit('clash', { exchange: this.exchange })
    // blades meeting hard -- your charged cut, or a long exchange -- can tear his from his hand
    if (foe.armed && (charged || this.exchange >= 3) && Math.random() < DISARM_CHANCE) this._disarmFoe()
  }

  // ── his sword, flying ───────────────────────────────────────────────────
  _disarmFoe() {
    const foe = this.foe, [pc, pr] = this.pa.tile()
    const away = [sign(foe.c - pc), sign(foe.r - pr)]
    const opts = []
    for (let dc = -3; dc <= 3; dc++) for (let dr = -3; dr <= 3; dr++) {
      const c = foe.c + dc, r = foe.r + dr, d = Math.max(Math.abs(dc), Math.abs(dr))
      if (d < 2 || !this.pa.free(c, r) || this.playerOn(c, r)) continue
      opts.push([c, r, dc * away[0] + dr * away[1] + Math.random() * 2.5])   // away from you, but not exactly
    }
    if (!opts.length) return
    opts.sort((a, b) => b[2] - a[2])
    const [c, r] = opts[0]
    this.dropped = { c, r, from: [foe.c, foe.r], t0: this.t, ms: SWORD_FLIGHT_MS }
    foe.armed = false; foe.nextStep = 0
    this._setFoe('unarmed', 900)                              // a moment of shock, then he goes for it
    this.emit('disarm', { tile: [c, r] })
  }
  swordLanded() { return this.dropped && this.t - this.dropped.t0 >= this.dropped.ms }

  // you hand it back: he takes it, and salutes you
  _returnSword() {
    const foe = this.foe
    this.carrying = false; foe.armed = true
    this._setFoe('salute', SALUTE_MS)
    this.emit('swordReturned')
    this.emit('salute', { by: 'foe', honour: true })
  }

  // You struck a man with no sword. He can't defend; he goes down, and stays
  // down a long while. The bout is over. Nobody salutes.
  _struckUnarmed() {
    const foe = this.foe, [pc, pr] = this.pa.tile()
    this.hitStop = 160; this.exchange = 0
    this.emit('hit', { on: 'foe', dmg: 1, desperate: true, unarmed: true })
    foe.hp = Math.max(1, foe.hp - 1); foe.shamed = true
    this._knockFoe([sign(foe.c - pc), sign(foe.r - pr)])
    this._setFoe('down', SHAMED_DOWN_MS); foe.hurtUntil = this.t + SHAMED_DOWN_MS
    this.bout = { over: true, until: this.t + SHAMED_DOWN_MS, needLeave: true, won: true, shamed: true }
    this.combat = false
    this.emit('knockdown', { who: 'foe', final: true, hard: true })
    this.emit('struckUnarmed')
  }

  // ── walking into him: a shove ───────────────────────────────────────────
  // In a bout, a step into him shoves him back a tile, for a breath. Caught
  // off balance (winding up, recovering, staggered) he may go down;
  // otherwise he staggers, open for a moment. Carrying his sword, it's
  // handed back instead.
  bump([dx, dy]) {
    const foe = this.foe
    if (!this.combat || foe.hp <= 0 || this.p.lost) return
    if (this.carrying && this.cheb() <= 1) return this._returnSword()
    if (!this.canMove() || ['down', 'beaten', 'pickup'].includes(foe.state)) return     // feet free, as for a step
    if (this.winded() || this.breath < 1) { this.emit('spent', { lastHeart: this.pa.hp() <= 1 }); return }
    this.spend(1)
    const offBalance = ['wind', 'recover', 'stagger', 'reel', 'unarmed'].includes(foe.state)
    const moved = this._foeStepTo(foe.c + dx, foe.r + dy, 160)
    const down = Math.random() < (offBalance ? 0.5 : 0.15) + (moved ? 0 : 0.1)
    this.p.busyUntil = this.t + 320; this.p.busyKind = 'other'
    this.exchange = 0
    if (down) { this._setFoe('down', DOWN_MS); foe.hurtUntil = this.t + DOWN_MS; this.emit('knockdown', { who: 'foe' }) }
    else if (foe.armed) this._setFoe('stagger', this.F.staggerMs * 1.4)
    this.emit('shove', { down, dir: [dx, dy] })
  }

  // ── their blow arrives ───────────────────────────────────────────────────
  _foeStrikeLands() {
    const foe = this.foe, F = this.F, p = this.p
    const [pc, pr] = this.pa.tile()
    if (!foe.targets.some(([c, r]) => c === pc && r === pr)) {                       // fell short
      foe.rush = 0; this._foeAfterBlow(1); this.exchange = 0
      this.practice++; this.emit('miss', { by: 'foe' }); return
    }
    if (this.swing && !this.swing.hitDone && this.swing.tile[0] === foe.c && this.swing.tile[1] === foe.r) return this._clash()
    if (this.t < p.hurtUntil || p.lost) { this._foeAfterBlow(0.6); return }
    if (Math.random() < this.dodgeP()) {                                              // slipped: no harm, nobody moves
      this.practice++; this.exchange = 0
      this.emit('dodge', { dir: deg(pr - foe.r, pc - foe.c) })
      this._foeAfterBlow(1); return
    }
    this.pa.stopRoute(); this._spoilCharge()
    const dmg = F.dmg
    p.hurtUntil = this.t + P.hurtMs; this.exchange = 0
    this.hitStop = 110
    this.swing = null; this.queued = null; p.busyUntil = Math.max(p.busyUntil, this.t + 300); p.busyKind = 'other'
    this.emit('hit', { on: 'player', dmg, tired: !!this.breathState() })
    if (this.pa.hp() - dmg <= 0) return this._playerYields('Buaileadh thú', 'You were beaten')
    this.pa.hurt(dmg)
    this.pa.forceStep([sign(pc - foe.c), sign(pr - foe.r)])                            // a hit throws you back a tile
    this._foeAfterBlow(0.6)
  }
  dodgeP() { return Math.min(0.4, 0.05 + 0.01 * this.practice) }
  // How you're breathing: null (fine), 'pant' (a good workout), or 'gasp'
  // (all-out: winded, nearly out of breath, or fighting on your last heart).
  // It carries on after you stand at ease, until your breath is back.
  // How you're breathing, as you come back from having nothing left:
  //   'splutter'  just winded, or reaching for a swing on your last heart
  //               with nothing in you -- like coming up from near-drowning
  //   'gasp'      ragged, all-out (short of breath, or a bout on your last heart)
  //   'pant'      a good workout
  //   null        fine
  // It carries on after you stand at ease, until your breath is back.
  breathState() {
    const k = this.breath / this.cap()
    if (this.winded() || this.t < this.splutterUntil) return 'splutter'
    if (k < 0.3 || (this.combat && this.pa.hp() <= 1)) return 'gasp'
    if (k < 0.6) return 'pant'
    return null
  }
  effort() { return 1 - Math.min(1, this.breath / this.cap()) }
  panting() { return !!this.breathState() }

  // ── the bout ends ────────────────────────────────────────────────────────
  // He's down, then up on one knee, then on his feet to salute (update()).
  _foeYields() {
    this._setFoe('beaten', 1e9)
    this.bout = { over: true, until: this.t + 2600, needLeave: true, won: true }
    this.combat = false
    this.emit('knockdown', { who: 'foe', final: true })
    this.emit('boutOver', { won: true })
  }
  // knocked: down on the grass if his blow ended it; a yield (swipe down) stays on your feet
  _playerYields(ga, en, knocked = true) {
    this.p.lost = true
    if (knocked) { this.p.downUntil = this.t + PLAYER_DOWN_MS; this.emit('knockdown', { who: 'player', final: true }) }
    this.bout = { over: true, until: this.t + 2600, needLeave: true, won: false }
    this._spoilCharge(); this.swing = null; this.queued = null
    this.combat = false
    this._setFoe('idle', 0)
    this.emit('boutOver', { won: false, ga, en })
  }
  _endCombat() {
    if (!this.combat) return
    this.combat = false; this.exchange = 0; this._spoilCharge()
    this.emit('sheathe')
  }

  // ── the foe ──────────────────────────────────────────────────────────────
  _resetFoe() {
    const foe = this.foe
    Object.assign(foe, { c: this.HOME[0], r: this.HOME[1], from: null, hp: this.noFoe ? 0 : this.F.hp, state: 'idle', st0: 0, until: 0,
      target: null, targets: [], hitDone: false, nextStep: 0, wind: 0, eye: 0, whiffAt: 0, feint: false, lungeNow: false,
      comboN: 0, rush: 0, hurtUntil: 0, armed: true, shamed: false })
    this.dropped = null        // his sword on the ground: { c, r, from: [c, r], t0, ms } (it flies first)
    this.carrying = false      // you've picked it up
  }
  _setFoe(state, ms) {
    const foe = this.foe
    foe.state = state; foe.st0 = this.t; foe.until = this.t + ms; foe.hitDone = false
    if (state !== 'wind' && state !== 'strike') { foe.comboN = 0; foe.rush = 0; foe.feint = false }
  }
  _foeStepTo(c, r, ms) {
    const foe = this.foe
    if (!this.foeFree(c, r)) return false
    foe.from = [foe.c, foe.r]; foe.t0 = this.t; foe.ms = ms; foe.c = c; foe.r = r
    this.emit('foeStep')
    return true
  }
  _fromHome([c, r]) { return Math.max(Math.abs(c - this.HOME[0]), Math.abs(r - this.HOME[1])) }
  _foeStep(goal, side = false, leashed = true) {
    const foe = this.foe, F = this.F
    const opts = D8.map(d => [foe.c + d[0], foe.r + d[1]])
      .filter(([c, r]) => this.foeFree(c, r) && (!leashed || this._fromHome([c, r]) <= LEASH))
    if (!opts.length) return
    const dist = ([c, r]) => Math.max(Math.abs(c - goal[0]), Math.abs(r - goal[1]))
    const here = dist([foe.c, foe.r])
    let pick = null
    if (side) {
      const same = opts.filter(o => dist(o) === here && dist(o) > 1)
      if (same.length) pick = same[Math.floor(Math.random() * same.length)]
    } else {
      opts.sort((a, b) => dist(a) - dist(b) || Math.hypot(a[0] - goal[0], a[1] - goal[1]) - Math.hypot(b[0] - goal[0], b[1] - goal[1]))
      if (dist(opts[0]) < here) pick = opts[0]
    }
    if (pick) this._foeStepTo(pick[0], pick[1], F.stepMs * 0.6)
  }
  _stepIn(ms) {
    const foe = this.foe, [pc, pr] = this.pa.tile()
    return this._foeStepTo(foe.c + sign(pc - foe.c), foe.r + sign(pr - foe.r), ms)
  }
  _foeRetreat() {                                   // back out of reach
    const foe = this.foe, here = this.cheb(), [pc, pr] = this.pa.tile()
    const opts = D8.map(v => [foe.c + v[0], foe.r + v[1]]).filter(([c, r]) => this.foeFree(c, r))
      .map(o => [o, Math.max(Math.abs(o[0] - pc), Math.abs(o[1] - pr))]).filter(([, d]) => d > here)
    if (!opts.length) return false
    const best = opts.sort((a, b) => b[1] - a[1])[0][0]
    return this._foeStepTo(best[0], best[1], this.F.stepMs * 0.6)
  }
  _knockFoe(d) {                                    // a hit throws him back a tile, so nobody trades toe to toe
    const foe = this.foe
    return this._foeStepTo(foe.c + d[0], foe.r + d[1], 145)
  }

  // where you'll be: n steps along your route, or the way the brooch is held
  _aimPoint(n = this.F.lead || 0) { return n ? this.pa.ahead(n) : [...this.pa.tile()] }
  _aimAttack(at) {
    const foe = this.foe, F = this.F, [pc, pr] = this.pa.tile()
    const [ac, ar] = at || this._aimPoint()
    foe.face = deg(ar - foe.r, ac - foe.c)
    let tx = sign(ac - foe.c), ty = sign(ar - foe.r)
    if (!F.lead || (!tx && !ty)) { tx = sign(pc - foe.c); ty = sign(pr - foe.r) }
    foe.target = at ? at : F.lead ? [foe.c + tx, foe.r + ty] : [pc, pr]; foe.targets = [foe.target]
  }
  // an ambusher reads your route: if you'll be beside him when his blow would land, he starts now
  _ambushTile() {
    const F = this.F, foe = this.foe
    const [c, r] = this._aimPoint(Math.max(1, Math.min(5, Math.round((F.windMs + F.strikeMs * 0.5) / this.pa.stepMs()))))
    return Math.max(Math.abs(c - foe.c), Math.abs(r - foe.r)) === 1 ? [c, r] : null
  }
  _startWind(ms = this.F.windMs) { this.foe.wind = ms; this._setFoe('wind', ms); this.emit('tell', { ms }) }
  // after a blow: a combo's next cut, or the long recovery that leaves them open
  _foeAfterBlow(mult) {
    const foe = this.foe, F = this.F
    if (!this.p.lost && F.combo && foe.comboN < F.combo && this.cheb() <= 2) {     // follows you in, even if the blow knocked you back
      if (this.cheb() > 1) this._stepIn(120)
      if (this.cheb() <= 1) { foe.comboN++; this._aimAttack(); this._startWind(F.followWind); return }
    }
    this._setFoe('recover', F.recoverMs * mult)
  }

  // Disarmed: a moment's shock, a step back from you, then off to his sword
  // -- unless you've got it, when he waits for you to hand it back.
  _unarmedThink(t) {
    const foe = this.foe, d = this.dropped, F = this.F
    if (foe.state === 'pickup') {
      if (t >= foe.until) { foe.armed = true; this.dropped = null; this._setFoe('nod', 700); this.emit('swordRecovered', { by: 'foe' }) }
      return
    }
    if (foe.state === 'nod') { if (t >= foe.until) this._setFoe(this.combat ? 'rest' : 'idle', 400); return }
    if (t < foe.until || this.carrying || !d || !this.swordLanded()) return
    if (foe.c === d.c && foe.r === d.r) { this._setFoe('pickup', 750); return }
    if (t >= foe.nextStep) {
      foe.nextStep = t + F.stepMs * (foe.shamed ? 2.2 : 1.4)
      this._foeStep([d.c, d.r], false, false)
      if (this.cheb() <= 1 && Math.random() < 0.4) this._foeRetreat()     // wary of you as he goes
    }
  }

  // the Warden: stands his ground, watches, and answers any cut that finds nothing
  _wardenThink(t) {
    const foe = this.foe, F = this.F, d = this.cheb()
    if (foe.whiffAt && t - foe.whiffAt < 700 && d <= 2) {
      foe.whiffAt = 0
      if (d === 2 && !this._stepIn(100)) return
      this._aimAttack(); this._startWind(F.followWind); return
    }
    if (d <= 1) { if (!foe.eye) foe.eye = t + 800; if (t >= foe.eye) { foe.eye = 0; this._aimAttack(); this._startWind() } return }
    foe.eye = 0
    if (d <= 3 && t >= foe.nextStep) { foe.nextStep = t + 2600; this._foeStep(this.pa.tile()) }     // his patience runs out, slowly
  }
  // the Master: keeps two tiles off, circles, feints, and lunges when you commit
  _masterThink(t) {
    const foe = this.foe, F = this.F
    if (foe.lungeNow) { foe.lungeNow = false; if (this.cheb() === 2 && this._stepIn(100)) { this._aimAttack(); this._startWind(F.rushWind); return } }
    if (t < foe.nextStep) return
    foe.nextStep = t + F.stepMs
    const d = this.cheb()
    if (d <= 1) { if (Math.random() < 0.6 && this._foeRetreat()) return; this._aimAttack(); this._startWind(F.followWind); return }
    if (d === 2) {
      const r = Math.random()
      if (r < 0.2) { this._aimAttack(); this._startWind(560); foe.feint = true }      // shows the cut, then thinks better of it
      else if (r < 0.4 && this._stepIn(100)) { this._aimAttack(); this._startWind(F.rushWind) }
      else this._foeStep(this.pa.tile(), true, false)
      return
    }
    this._foeStep(this.pa.tile(), false, false)
  }

  _foeThink() {
    const t = this.t, foe = this.foe, F = this.F
    const locked = ['wind', 'strike', 'recover', 'reel', 'down', 'salute', 'unarmed', 'pickup', 'nod'].includes(foe.state)
    const [pc, pr] = this.pa.tile()
    if (!locked && foe.state !== 'beaten') foe.face = deg(pr - foe.r, pc - foe.c)
    // without his sword, getting it back comes first, in a bout or out of one
    if (!foe.armed && !['down', 'beaten', 'pickup', 'salute', 'nod', 'unarmed'].includes(foe.state)) this._setFoe('unarmed', 0)
    if (!foe.armed && foe.state === 'unarmed') return this._unarmedThink(t)
    if (foe.state === 'pickup' || foe.state === 'nod') return this._unarmedThink(t)
    if (!this.combat && !locked && foe.state !== 'beaten') {
      // out of the fight: back to their place, and wait there
      if ((foe.c !== this.HOME[0] || foe.r !== this.HOME[1]) && t >= foe.nextStep) { foe.nextStep = t + F.stepMs * (foe.shamed ? 2.2 : 1); this._foeStep(this.HOME, false, false) }
      if (foe.state !== 'idle') this._setFoe('idle', 0)
      return
    }
    switch (foe.state) {
      case 'idle': this._setFoe('approach', 5000); break
      case 'salute': if (t >= foe.until) this._setFoe('approach', 5000); break
      case 'down': if (t >= foe.until) { this._setFoe('rest', 600); this.emit('rise', { who: 'foe' }) } break
      case 'rest':
        if (t >= foe.nextStep) { foe.nextStep = t + F.stepMs * 1.6; if (Math.random() < 0.5) this._foeStep(this.pa.tile(), true) }
        if (t >= foe.until) this._setFoe('approach', 5000)
        break
      case 'approach': {
        const onTheMove = this.moving()
        const amb = F.ambush && onTheMove ? this._ambushTile() : null
        if (amb) { this._aimAttack(amb); this._startWind() }
        else if (F.style === 'warden') this._wardenThink(t)
        else if (F.style === 'master') this._masterThink(t)
        else if (this.cheb() <= 1) { this._aimAttack(); this._startWind() }
        else if (F.ambush && onTheMove) { /* hold ground and let the route come to him */ }
        else if (t >= foe.nextStep) { foe.nextStep = t + F.stepMs; this._foeStep(this.pa.tile(), false, F.style !== 'brawler') }
        if (foe.state === 'approach' && t >= foe.until) this._setFoe('rest', 500)
        break
      }
      case 'wind':
        if (foe.feint && t - foe.st0 >= foe.wind * 0.5) { foe.feint = false; this._setFoe('approach', 5000); foe.nextStep = t + 200; foe.lungeNow = true; break }
        if (t >= foe.until) { this._setFoe('strike', F.strikeMs); this.emit('foeSwing') }
        break
      case 'strike':
        if (!foe.hitDone && t - foe.st0 >= F.strikeMs * 0.5) { foe.hitDone = true; this._foeStrikeLands() }
        break
      case 'reel':
        if (t >= foe.until) { this.exchange = 0; this._setFoe('rest', F.restMin) }
        break
      case 'recover': case 'stagger':
        if (t >= foe.until) this._setFoe('rest', F.restMin + Math.random() * (F.restMax - F.restMin))
        break
    }
  }

  // ── the frame ────────────────────────────────────────────────────────────
  update(dtRaw) {
    let dt = Math.min(50, dtRaw)
    if (this.hitStop > 0) { this.hitStop -= dt; return }              // the blow lands: everything holds for a beat
    this.t += dt
    const t = this.t, foe = this.foe

    // the end of a bout: after a pause they go home and recover; you must step away before the next
    if (this.bout.over && t >= this.bout.until) {
      const won = this.bout.won, shamed = this.bout.shamed
      if (this.carrying) { this.carrying = false; this.dropped = null; foe.armed = true }   // the bout's over: you give it back
      const keepDropped = this.dropped
      this.bout.over = false
      this.p.lost = false
      if (won) { const keep = [foe.c, foe.r]; this._resetFoe(); foe.c = keep[0]; foe.r = keep[1]; this.dropped = keepDropped; if (keepDropped || shamed) foe.armed = !keepDropped }
      else foe.hp = this.F.hp
      this.bout.shamed = shamed
      if (this.bout.shamed) {                                   // no salute: he gets up, slowly, and goes for his sword
        foe.shamed = true; foe.armed = !this.dropped
        this._setFoe(foe.armed ? 'idle' : 'unarmed', 600); this.emit('rise', { who: 'foe', slow: true })
      } else {
        this._setFoe('salute', SALUTE_MS)                       // win or lose, he salutes before he goes
        this.emit('salute', { by: 'foe', end: true })
      }
    }
    if (this.p.downUntil && t >= this.p.downUntil) { this.p.downUntil = 0; this.emit('rise', { who: 'player' }) }
    // you step onto his sword: you pick it up
    if (this.dropped && !this.carrying && this.swordLanded() && this.enGarde) {
      const [pc, pr] = this.pa.tile()
      if (pc === this.dropped.c && pr === this.dropped.r) { this.carrying = true; this.dropped = null; this.emit('swordRecovered', { by: 'player' }) }
    }
    if (foe.state === 'salute' && !this.combat && t >= foe.until) this._setFoe('idle', 0)
    const d = this.cheb()
    if (this.bout.needLeave && (d > ENGAGE || !this.enGarde)) this.bout.needLeave = false

    // swords drawn within ENGAGE tiles while en garde; put away beyond DISENGAGE
    if (!this.combat && !this.peaceful && this.enGarde && !this.bout.over && !this.bout.needLeave && foe.hp > 0 && d <= ENGAGE) {
      this.combat = true; this.exchange = 0
      foe.shamed = false
      this._setFoe('salute', SALUTE_MS + 900); this.emit('boutStart')       // + his draw (meleeView DRAW_MS)
    } else if (this.combat && d > DISENGAGE) this._endCombat()

    // the player started a step
    const tile = this.pa.tile()
    if (!this._lastTile || tile[0] !== this._lastTile[0] || tile[1] !== this._lastTile[1]) { this._lastTile = [...tile]; this._onPlayerStep() }

    if (this.queued) {
      const q = this.queued
      if (t > q.until) this.queued = null
      else {
        const ok = q.kind === 'move' ? this.canMove() : q.kind === 'strike' ? this.canStrike() : this.canAct()
        if (ok) { this.queued = null; q.fn() }
      }
    }

    if (this.press && !this.charge && t - this.press.t0 >= CHARGE.startMs) this._beginCharge()
    if (this.charge && (this.p.lost || !this.enGarde)) this._spoilCharge()

    // breath: comes back while you rest; none left and you're winded
    if (this.windedUntil && t >= this.windedUntil) {
      this.windedUntil = 0; this.breath = Math.max(this.breath, Math.min(this.cap(), BR.windedBack)); this.lastSpend = t
      this.emit('unwinded')
    } else if (!this.winded() && !this.charge && this.breath < this.cap() && t - this.lastSpend > BR.idleMs) {
      this.breath = Math.min(this.cap(), this.breath + dt / BR.regenMs)
    }
    this.breath = Math.min(this.breath, this.cap())

    if (this.swing) {
      const el = t - this.swing.t0
      if (el >= this.swing.hitAt && !this.swing.hitDone) { this.swing.hitDone = true; this._playerStrikeLands() }
      if (this.swing && el >= this.swing.vis) this.swing = null
    }
    if (this.noFoe) { /* no one to fight */ }
    else if (!this.bout.over || (!foe.armed && foe.state !== 'down')) this._foeThink()
    else if (foe.state !== 'beaten' && !locked(foe.state) && (foe.c !== this.HOME[0] || foe.r !== this.HOME[1]) && t >= foe.nextStep) {
      foe.nextStep = t + this.F.stepMs; this._foeStep(this.HOME, false, false)        // a beaten player watches him walk back
    }
    if (foe.from && t - foe.t0 >= foe.ms) foe.from = null
  }

  // where the foe is drawn, in tiles (smooth between steps)
  foeDrawPos() {
    const foe = this.foe
    if (!foe.from) return [foe.c, foe.r]
    const k = Math.min(1, (this.t - foe.t0) / foe.ms), e = 1 - (1 - k) * (1 - k)
    return [foe.from[0] + (foe.c - foe.from[0]) * e, foe.from[1] + (foe.r - foe.from[1]) * e]
  }
}

const locked = s => ['wind', 'strike', 'recover', 'reel', 'down', 'salute'].includes(s)

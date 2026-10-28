// melee.js
// Location: js/game/combat/melee.js
//
// Sword fighting on the tile grid, ported from the Practice Yard
// (combat.html). Logic only: no drawing, no sound, no DOM. meleeView.js
// draws it; meleeBout.js joins it to a scene.
//
// WOODEN BLADES ONLY (Skye). Nobody dies: the blow that would take a
// fighter's last heart ends the bout instead -- they yield on one heart.
// Steel mode (dice, the toll, wounds, blood) stays in the yard for now. The one
// exception is a foe with F.lethal (Garbhán's knife, enemies.js): his last blow kills.
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
//   pa.wet(c, r)       water you'd drown in (optional; a foe never steps into it)
//   pa.kill()          a lethal blow (F.lethal): the Player dies
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
// Live blades. A wooden blade bruises: one heart a blow, nobody dies. An edged one (yours: pa.edged(); his: F.edged) rolls dice, and a
// deep blow is not paid at once -- it is OWED, a heart a second (TOLL_MS), and you fight on while it comes due. A blow of 3+ opens a
// WOUND that drips a heart every 12 s (faster with more); stand still PRESS_MS without being hit and you steady yourself: the wound
// stops and so does any blow still owed. Bleeding slows your breath. The last blow owed that takes your last heart ends it.
const TOLL_MS = 1000, PRESS_MS = 2500
const BUFFER_MS = 200
// A foe with F.leap (a student showing off the spinning leap you will be taught): his first attack in a bout is a leap: a long tell
// (leapWind ms: crouching), then he is in the air LEAP_AIR ms, and where he lands everyone beside him is thrown two tiles. It cannot be
// parried or cut short at the last; step away (cheb >= 2) while he is in the air and it falls on nothing, and he is open for a breath.
export const LEAP_AIR = 520
// The dash (taught: tech.dash): hold the blow to full, then flick the moon in any of eight ways. You are gone along the line (up to `tiles`, through
// anyone in it), and stand there a long moment with the blade at your hip, pointing back the way you came. Then, `cutAt` ms after you arrive,
// everyone you passed is cut (parry-proof, a hard blow, thrown on along your line). A foe with F.dashOnly does it to you: his lane shows red
// while he gathers himself; step out of it before the cut and it falls on nothing, and he is left open.
export const DASH = { tiles: 4, msPer: 60, pose: 950, cutAt: 280, rec: 220 }
export const FOE_DASH = { glide: 300, cut: 340, pose: 1000 }
// An archer (F.archer): she keeps her distance (backing off as you come in, as far as her leash lets her), draws (drawMs: the bow comes back, and
// that is all the warning there is: no red tile), and looses an arrow at where you stand (or will, if you are walking). It flies a tile every
// msPer ms. Be off the line when it comes; or have a blow of yours land within deflectMs of its reaching you, and it is batted aside, spinning.
// Close with her and she must fight with what she has. (An arrow cannot touch you in a dash, or in the breath after a hit.)
export const ARROW = { msPer: 105, deflectMs: 150, over: 3, sheathe: 900, unsling: 700, arc: 0.11 }       // sheathe/unsling: her opening, after the salute: the wooden sword away, the bow off her back
export const CHARGE = { startMs: 250, fullMs: 700, breath: 2 }
// The timed parry (taught: tech.parry). When both blows land together (a clash), how far apart in time they land decides it: within
// the window it is a PARRY -- his blow turned aside, no knockback, a breath back, and he is open to a RIPOSTE for riposteMs (it
// cannot be parried and bites harder) -- and outside it is the ordinary clash. Your Cosaint widens the window (perDef ms a point
// above 5, between minMs and maxMs).
export const PARRY = { baseMs: 90, perDef: 8, minMs: 60, maxMs: 150, riposteMs: 650 }
// a patient cut is hauled from the shoulder; a quick backhand is shorter, lighter, and lands sooner
const SW = { full: { vis: 380, hitAt: 215, rec: 300 }, quick: { vis: 250, hitAt: 141, rec: 240 },
             spin: { vis: 640, hitAt: 400, rec: 300, biteAt: 120 } }   // a fully charged blow: a spinning leap (it comes down at hitAt), but everyone beside you is cut at the start of it (biteAt)

export const BASE = {
  hp: 6, dmg: 1, atk: 5, def: 5, stepMs: 330, windMs: 650, strikeMs: 120, recoverMs: 750, reelMs: 480, staggerMs: 400,
  counterWind0: 560, counterWindStep: 50, counterWindMin: 380,
  parryBase: 0.4, parryReel0: 0.3, parryReelStep: 0.12, parryMax: 0.8, restMin: 500, restMax: 1200,
  lead: 0, combo: 0, followWind: 400, rushWind: 330, ambush: false, style: null,
  reads: false,           // true: when you're on the move he cuts, and ripostes, where you'll be when the blow lands
  mercy: true,            // wooden swords: never below one heart -- the last heart is a knockdown, and the contest is over
}
export const PRESETS = {
  // reads your route, aims where you're going, follows a miss at once
  spar:    { ...BASE, lead: 1, combo: 1, followWind: 380, ambush: true, reads: true },
  // holds his ground, parries, answers a cut that finds nothing
  warden:  { ...BASE, style: 'warden', reads: true, hp: 7, stepMs: 420, windMs: 560, recoverMs: 650, staggerMs: 500, followWind: 360,
             parryBase: 0.55, parryReel0: 0.4, parryReelStep: 0.1, parryMax: 0.85, restMin: 600, restMax: 1100 },
  // keeps two tiles off, circles, feints, lunges
  master:  { ...BASE, style: 'master', reads: true, stepMs: 300, windMs: 620, recoverMs: 650, followWind: 320, combo: 1, lead: 1, ambush: true,
             rushWind: 380, parryBase: 0.45, restMin: 300, restMax: 700 },
  // a beginner: slow to start, slow to recover, rarely turns a blow
  novice:  { ...BASE, hp: 4, stepMs: 440, windMs: 820, recoverMs: 950, staggerMs: 520, followWind: 520,
             parryBase: 0.12, parryReel0: 0.1, parryReelStep: 0.05, parryMax: 0.35, restMin: 900, restMax: 1600 },
  // Uathach with a live blade: nothing you do lands -- she turns every blow --
  // and she never cuts you. She throws you down, and after the third time it's over.
  uathach: { ...BASE, style: 'shover', hp: 99, stepMs: 300, windMs: 420, recoverMs: 700, restMin: 300, restMax: 700,
             untouchable: true, throws: 3, swordGid: 2496, liveBlade: true },
  // Conall: a patient teacher, very hard to get past (def 9), who turns two blows in three aside
  // (a master: `guard` is the chance he turns a blow aside in each state -- about 1 in 10 gets through;
  //  `steady`: he can't be knocked down, shoved over or disarmed; `reminders`: salutes he'll offer before he attacks in earnest)
  conall:  { ...BASE, style: 'warden', reads: true, hp: 8, atk: 6, def: 9, stepMs: 420, windMs: 1000, strikeMs: 120, recoverMs: 1100, staggerMs: 520,
             followWind: 700, counterWind0: 520, counterWindStep: 60, counterWindMin: 300, parryBase: 0.5, parryReel0: 0.35, parryReelStep: 0.1, parryMax: 0.72, restMin: 1200, restMax: 1900,
             steady: true, mercy: true, keepBout: true, moveWindow: 600, match: false, reminders: 3, guard: { base: 0.55, wind: 0.5, reel: 0.4, recover: 0.3, stagger: 0.3 } },
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
  constructor({ kind = 'warden', F = null, home = [-99, -99], pa, emit = () => {} }) {
    this.noFoe = !F && !PRESETS[kind]                   // F: a preset object (enemies.js) instead of a kind
    this.F = { ...(F || PRESETS[kind] || BASE) }
    this.kind = kind
    this.HOME = home
    this.pa = pa
    this.emit = emit
    this.t = 0
    this.practice = 0                      // dodges grow with every blow slipped or sidestepped
    this.enGarde = false
    this.foe = { c: home[0], r: home[1], from: null, t0: 0, ms: 0, face: 90, hurtUntil: 0 }
    this._resetFoe()
    // A pack (addFoe): every foe has a state of his own, and `foe` is the one the fight is looking at -- his own while his turn is
    // being thought, the one you are addressing (tgt) the rest of the time. You, your breath and your blade are one.
    this.foes = [this.foe]; this.tgt = this.foe; this.tgtLock = 0
    this.owed = 0; this.tollAt = 0; this.wounds = 0; this.bleedAt = 0; this.steady = 0     // live blades (yours alone, whoever cuts you); steady = ms stood still pressing a wound shut
    // A pack (addFoe): every foe has a state of his own, and `foe` is the one the fight is looking at -- his own while his turn is
    // being thought, the one you are addressing (tgt) the rest of the time. You, your breath and your blade are one.
    this.foes = [this.foe]; this.tgt = this.foe; this.tgtLock = 0
    this.p = { busyUntil: 0, busyKind: 'other', cancelAt: 0, hurtUntil: 0, lost: false, downUntil: 0 }
    this.combat = false
    this.exchange = 0
    this.breath = pa.maxHp()
    this.lastSpend = 0
    this.windedUntil = 0
    this.swing = null
    this.dash = null                       // the dash in progress (see DASH)
    this.arrows = []                       // arrows in the air (and a moment after): { c0, r0, ux, uy, t0, len, end, endT }
    this.queued = null
    this.lastSwing = { t: -1e9, flip: false }
    this.charge = null                     // { t0 } while gathering
    this.splutterUntil = 0
    this.press = null                      // { t0 } while a finger is on the moon
    this.hitStop = 0
    this.bout = { over: false, until: 0, needLeave: false }
    this.saluted = false      // you have saluted this bout
    this.matchPause = false   // between touches of a match: the fighters part and regroup
    this.resume = false       // the next bout start is the match going on (no salute)
    this.touches = 0
    this.eager = false        // a drawn sword is enough: he starts a bout without waiting for you to step away
    this._lastTile = null
    this.peaceful = false                  // true: no bout starts, whatever you do (a lesson on the green)
    this.returnsSalute = false             // true: out of a bout too, an idle partner returns your salute (the garden course)
    this.bare = false                      // true: the stance without a blade (the space lesson): no cuts, no charge
    this.stay = false                      // true: no steps and no routes, but the cuts and the long hold are free (the spin lesson)
    this.rooted = false                    // true: your feet are held (no steps, no routes) and there are no cuts: a drill for the draw / the salute
    this.noSheathe = false                 // true: a swipe down does not put the blade away (the salute drill)
    this.noCharge = false                  // true: the long hold is not yet yours (see STRONG_NOTE in meleeBout): a hold is only a cut
    this.tech = { parry: false, dash: false }           // techniques taught so far (meleeBout.syncTechniques): parry = the timed parry and riposte
    this.riposte = null                    // { until } after a timed parry: the next cut inside it is the riposte
  }

  // ── small helpers ────────────────────────────────────────────────────────
  now() { return this.t }
  cheb() { const [c, r] = this.pa.tile(); return Math.max(Math.abs(this.foe.c - c), Math.abs(this.foe.r - r)) }
  towardFoe() { const [c, r] = this.pa.tile(); return [sign(this.foe.c - c), sign(this.foe.r - r)] }
  targetTile() { const [c, r] = this.pa.tile(), d = this.towardFoe(); return [c + d[0], r + d[1]] }
  winded() { return this.t < this.windedUntil }
  cap() { return Math.max(1, this.pa.hp()) }                       // breath can't exceed your hearts
  desperate() { return this.combat && this.eff() <= (this.steel() ? 2 : 1) }           // last heart (two, with live blades): the moon glows red
  chargeK() { return this.charge ? Math.min(1, (this.t - this.charge.t0) / CHARGE.fullMs) : 0 }
  moving() { return this.pa.onRoute() || !!this.pa.held() }
  foeMax() { return this.F.hp }
  // is (c, r) taken by the player, mid-step included?
  playerOn(c, r) {
    const a = this.pa.tile(), b = this.pa.fromTile()
    return (a[0] === c && a[1] === r) || (b[0] === c && b[1] === r)
  }
  foeFree(c, r) {
    return this.pa.free(c, r) && !this.playerOn(c, r) && !this.pa.wet?.(c, r) &&
      !(this.foes.length > 1 && this.foes.some(f => f !== this.foe && f.hp > 0 && f.state !== 'beaten' && f.c === c && f.r === r))     // nor on another of them
  }

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
  feetHeld() { return !!this.charge || !!this.dash || this.p.downUntil > this.t || (this.combat && !this.canMove()) }

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
    if (!on && this.matchPause) { this.matchPause = false; this.resume = false; this.foeReady = false; this.foe.hp = this.F.hp }   // the match is dropped
    if (!on && this.F.aggressor && this.fight) this._spoilCharge()       // his fight: at ease is fleeing, never yielding
    else if (!on) {
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
    if (this.noSalute) return false                         // a lesson that hasn't taught it yet (the draw drill)
    if (!this.enGarde || !this.canAct() || this.p.downUntil > this.t) return false
    this.p.busyUntil = this.t + SALUTE_MS; this.p.busyKind = 'salute'
    this.saluted = true
    this.emit('salute', { by: 'player' })
    const foe = this.foe
    const inBout = this.combat && foe.armed && this.F.salutes !== false && this.cheb() >= 2 && ['idle', 'approach', 'rest'].includes(foe.state)
    // in a lesson he returns it too, drawing first if his sword is away
    const inLesson = !this.combat && this.returnsSalute && foe.armed && foe.state === 'idle'
    if (inBout || inLesson) {
      const draw = inLesson && !this.foeReady
      this._setFoe('salute', SALUTE_MS + (draw ? 900 : 0))
      this.emit('salute', { by: 'foe', reply: true, draw })
    }
    return true
  }

  // After a bout, blades still out: he offers a salute (you may return it: the player's salute() above)
  offerSalute() {
    const foe = this.foe
    if (this.combat || !foe.armed || foe.hp <= 0 || !['idle', 'rest', 'nod'].includes(foe.state)) return false
    this._setFoe('salute', SALUTE_MS + 600)
    this.emit('salute', { by: 'foe', offer: true })
    return true
  }

  _nextFlip() { const f = this.t - this.lastSwing.t < 550 ? !this.lastSwing.flip : false; this.lastSwing = { t: this.t, flip: f }; return f }

  strike(opts = {}) {
    if (!this.enGarde || this.bare || this.rooted || this.p.lost || this.p.downUntil > this.t) return
    const charged = !!opts.charged
    // every swing costs breath, in a bout or out of one: you feel your stamina
    if (this.winded() || this.breath < 1) {
      if (this.pa.hp() <= 1) this.splutterUntil = Math.max(this.splutterUntil, this.t + 2200)   // nothing left: it chokes you
      this.emit('spent', { lastHeart: this.pa.hp() <= 1 }); return
    }
    if (!this.combat) return this._airSwing(charged)
    const desperate = this.eff() <= (this.steel() ? 2 : 1)   // last heart: one blow that cannot be turned aside
    const inFlurry = !charged && this.t - this.lastSwing.t < 550
    const flip = charged ? (this.lastSwing = { t: this.t, flip: false }, false) : this._nextFlip()
    const base = charged ? SW.spin : flip ? SW.quick : SW.full
    const k0 = inFlurry ? 0.3 : 0, toHit = base.hitAt - k0 * base.vis, rec = inFlurry ? 140 : base.rec
    const riposte = !!(this.riposte && this.t < this.riposte.until); this.riposte = null          // the opening is spent on the cut that begins inside it
    this.swing = { tile: this.targetTile(), t0: this.t - k0 * base.vis, born: this.t, hitDone: false, desperate, charged, flip, riposte,
                   vis: base.vis, hitAt: base.hitAt, biteAt: charged ? base.biteAt : undefined,
                   power: (flip ? -1 : inFlurry ? 0 : 2) + (this.moving() && this.p.busyKind === 'hop' ? -1 : 0) }      // a patient cut bites; on the move, or a backhand, it is lighter
    // on the move, the cut rides on the stride: no recovery, the walk carries on
    const p = this.p
    if (!(this.moving() && p.busyKind === 'hop')) {
      p.busyUntil = this.t + toHit + rec; p.busyKind = 'strike'; p.cancelAt = this.t + toHit + 40
      if (this.moving()) p.cancelAt = this.t
    }
    this.spend(desperate ? this.breath : charged ? CHARGE.breath : 1)
    // F.spinDodge: the first spin of a bout lands; after that she may see it coming, step out of reach, and cut back as you land
    if (charged && this.F.spinDodge && !this.foe.leap) {
      const foe = this.foe; this.spins = (this.spins || 0) + 1
      if (this.spins > 1 && Math.random() < this.F.spinDodge && this.cheb() <= 1 && ['idle', 'approach', 'rest'].includes(foe.state) && this._foeRetreat()) { this.swing.dodged = true; foe.spinCounterAt = this.t + toHit + 160; this.emit('foeDodge') }
    }
    this.emit('swing', { flip, desperate, charged, patient: !flip && !inFlurry })
  }

  // A cut at the air, anywhere: practice, a flourish. Hits nothing, but it
  // costs breath like any other.
  _airSwing(charged) {
    const [c, r] = this.pa.tile(), d = this.pa.facing()
    const flip = charged ? (this.lastSwing = { t: this.t, flip: false }, false) : this._nextFlip()
    const base = charged ? SW.spin : flip ? SW.quick : SW.full
    this.swing = { tile: [c + d[0], r + d[1]], t0: this.t, born: this.t, hitDone: true, air: true, desperate: false, charged, flip,
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
    this.swing = { tile: [this.foe.c, this.foe.r], t0: this.t + step, born: this.t + step, hitDone: false, desperate: false, lunge: true, flip: false,
                   vis: SW.full.vis, hitAt: SW.full.hitAt, power: 1 }
    this.lastSwing = { t: this.t, flip: false }
    const p = this.p
    p.busyUntil = this.t + step + SW.full.hitAt + SW.full.rec + BR.lungeRecover; p.busyKind = 'other'
    this.spend(2)
    this.emit('swing', { lunge: true })
  }

  // tapping the foe on the field
  tapFoe(f) {
    if (!this.combat) return false
    if (f && f !== this.tgt && f.hp > 0 && f.state !== 'beaten') { this.tgt = this.foe = f; this.tgtLock = this.t + 1800 }      // a tap picks him
    const d = this.cheb()
    if (this.carrying && d <= 1) { this._returnSword(); return true }     // hand it back
    if (d === 1) { this.act(() => this.strike(), 'strike'); return true }
    if (d === 2) { this.pa.stopRoute(); this.act(() => this.lunge()); return true }
    return false
  }

  _beginCharge() {
    if (this.charge || !this.enGarde || this.bare || this.rooted || this.noCharge || this.p.lost || this.p.downUntil > this.t) return
    if (this.winded() || this.breath < CHARGE.breath) return
    if (this.combat ? !this.canAct() : this.t < this.p.busyUntil) return
    this.charge = { t0: this.t }; this.pa.stopRoute(); this.queued = null
    this.emit('chargeStart', { ms: CHARGE.fullMs })
  }
  // ── the dash ─────────────────────────────────────────────────────────────
  dashReady() { return !!(this.tech.dash && this.enGarde && !this.bare && !this.rooted && this.charge && this.chargeK() >= 1 && !this.dash && !this.p.lost && this.p.downUntil <= this.t) }
  startDash(d) {
    if (!this.dashReady() || (!d[0] && !d[1])) return false
    const [pc, pr] = this.pa.tile(), live = this.foes.filter(f => f.hp > 0 && f.state !== 'beaten')
    const onFoe = (c, r) => live.some(f => f.c === c && f.r === r)
    const path = []
    for (let k = 1; k <= DASH.tiles; k++) {
      const c = pc + d[0] * k, r = pr + d[1] * k
      if (!(onFoe(c, r) || (this.pa.free(c, r) && !this.pa.wet?.(c, r)))) break
      path.push([c, r])
    }
    while (path.length && onFoe(...path[path.length - 1])) path.pop()                  // never ends inside him
    if (!path.length) return false
    this.charge = null; this.press = null; this.queued = null
    this.spend(CHARGE.breath)
    const to = path[path.length - 1], glide = DASH.msPer * path.length + 40
    const hits = this.combat ? live.filter(f => path.some(([c, r]) => Math.max(Math.abs(f.c - c), Math.abs(f.r - r)) <= 1)) : []
    for (const f of hits) { const keep = this.foe; this.foe = f; this._setFoe('rest', glide + DASH.cutAt + 60); f.holdUntil = this.t + glide + DASH.cutAt + 60; this.foe = keep }      // he stands there, and sees nothing
    this.dash = { t0: this.t, from: [pc, pr], to, dir: [...d], n: path.length, glide, cutAt: glide + DASH.cutAt, end: glide + DASH.pose, hits, cut: false }
    this.p.busyUntil = this.t + glide + DASH.pose + DASH.rec; this.p.busyKind = 'dash'; this.p.hurtUntil = this.t + glide + DASH.pose
    this.swing = null
    this.emit('dashStart', { from: [pc, pr], to, dir: [...d], ms: glide, n: path.length })
    return true
  }
  // ── the bow ──────────────────────────────────────────────────────────────
  _foeDrawBow(quick) {
    const foe = this.foe, F = this.F, [pc, pr] = this.pa.tile()
    const ms = quick ? (F.quickDraw || 450) : (F.drawMs || 850)
    foe.face = deg(pr - foe.r, pc - foe.c)
    foe.target = null; foe.targets = []                        // (no red tile: the bow is all the warning)
    foe.engaged = true; foe.wind = ms; foe.shootAt = this.t
    this._setFoe('wind', ms); foe.shoot = true
    this.emit('tell', { ms, shoot: true })
  }
  _foeLoose() {
    const foe = this.foe, F = this.F
    let [tc, tr] = this.pa.tile()
    const d = Math.hypot(tc - foe.c, tr - foe.r) || 1
    if (F.reads && this.moving()) { const at = this._leadTile(ARROW.msPer * d); if (at) [tc, tr] = at }        // she leads a walking target
    const dd = Math.hypot(tc - foe.c, tr - foe.r) || 1
    this.arrows.push({ c0: foe.c, r0: foe.r, ux: (tc - foe.c) / dd, uy: (tr - foe.r) / dd, t0: this.t, len: dd + ARROW.over, dd, end: null, endT: 0 })
    foe.shots = (foe.shots || 0) + 1
    foe.shoot = false; foe.looseAt = this.t
    this._setFoe('recover', F.shootRecover ?? 420)
    this.emit('arrowLoose')
  }
  // each arrow along its line; reaching you it is turned aside (your blow landing within deflectMs), or it hits, or you are not there
  _arrowTick() {
    const t = this.t, p = this.p, [pc, pr] = this.pa.tile()
    for (const a of this.arrows) {
      if (a.end) continue
      const s = (t - a.t0) / ARROW.msPer
      if (!this.combat || s > a.len) { a.end = 'gone'; a.endT = t; continue }
      const x = a.c0 + a.ux * s, y = a.r0 + a.uy * s
      if (s < 0.8 || Math.round(x) !== pc || Math.round(y) !== pr) continue
      if (this.dash || this.t < p.hurtUntil || p.lost) continue                      // through you, as through air
      const sw = this.swing
      if (sw && Math.abs(sw.t0 + (sw.biteAt ?? sw.hitAt) - t) <= ARROW.deflectMs) {
        a.end = 'deflect'; a.endT = t; a.x = x; a.y = y; a.vx = (Math.random() - 0.5) * 1.6; a.spin = (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 4)
        this.hitStop = 60; this.practice++
        this.emit('arrowDeflect')
      } else if (Math.random() < this.playerParryP(this.F.arrowAtk ?? this.F.atk)) {                    // your own defence turns it, by instinct (free)
        a.end = 'deflect'; a.endT = t; a.x = x; a.y = y; a.vx = (Math.random() - 0.5) * 1.6; a.spin = (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 4)
        this.hitStop = 60; this.practice++
        this.emit('arrowDeflect', { auto: true })
      } else { a.end = 'hit'; a.endT = t; a.x = x; a.y = y; this._arrowHits() }
      break
    }
    this.arrows = this.arrows.filter(a => !a.end || t - a.endT < 900)
  }
  // ── your bow ─────────────────────────────────────────────────────────────
  // His defence against a shot: none when he is caught busy (drawing, reeling, down); otherwise 10% + 8% per point of his Cosaint over your
  // Neart, 0..75%. A post or dummy has none (def 0 or less): it is not asked.
  shotGuardP() {
    const foe = this.foe, F = this.F
    if (!(F.def > 0) || ['wind', 'reel', 'recover', 'stagger', 'down', 'salute'].includes(foe.state)) return 0
    return Math.max(0, Math.min(0.75, 0.1 + 0.08 * (F.def - this.pa.atk())))
  }
  // your arrow reaches him: 'turned' (he knocks it aside), 'hit' (it lands: a heart, or a touch in a match), or null (nothing to hit)
  playerArrowStrikes({ dmg = 1 } = {}) {
    const foe = this.foe, F = this.F
    if (!this.combat || foe.hp <= 0 || this.t < foe.hurtUntil) return null
    if (F.untouchable || Math.random() < this.shotGuardP()) { this.emit('arrowTurned', { on: 'foe' }); return 'turned' }
    foe.hurtUntil = this.t + 300; foe.engaged = true
    this.emit('hit', { on: 'foe', dmg, arrow: true })
    if (foe.hp - dmg <= 0) { foe.hp = 0; this._foeYields(); return 'hit' }
    foe.hp -= dmg
    if (!['recover', 'stagger'].includes(foe.state)) this._setFoe('stagger', F.staggerMs)
    if (F.match) this._touch('player')
    return 'hit'
  }
  _arrowHits() {
    const F = this.F, p = this.p
    if (!F.flow) this.pa.stopRoute()
    this._spoilCharge()
    const dmg = F.arrowDmg ?? F.dmg
    p.hurtUntil = this.t + P.hurtMs; this.exchange = 0
    this.hitStop = 90
    this.swing = null; this.queued = null; p.busyUntil = Math.max(p.busyUntil, this.t + 250); p.busyKind = 'other'
    this.emit('hit', { on: 'player', dmg, arrow: true, tired: !!this.breathState() })
    if (this.pa.hp() - dmg <= 0 && F.lethal) return this._playerKilled()
    if (this.pa.hp() - dmg <= 0 && !F.mercy) return this._playerYields('Buaileadh thú', 'You were beaten')
    const hurt = F.mercy ? Math.min(dmg, this.pa.hp() - 1) : dmg
    if (hurt > 0) this.pa.hurt(hurt)
    if (F.mercy && hurt < dmg) return this._playerYields('Buaileadh thú', 'You were beaten')
  }
  _dashTick() {
    const D = this.dash, el = this.t - D.t0
    const k = Math.min(1, el / D.glide), e = 1 - (1 - k) * (1 - k)
    this.pa.place?.(D.from[0] + (D.to[0] - D.from[0]) * e, D.from[1] + (D.to[1] - D.from[1]) * e)
    if (!D.cut && el >= D.cutAt) { D.cut = true; this._dashCut() }
    if (el >= D.end) { this.dash = null; this.emit('dashEnd') }
  }
  _dashCut() {
    const D = this.dash
    this.emit('dashCut', { foes: D.hits.map(f => [f.c, f.r]), dir: [...D.dir] })
    for (const f of D.hits) {
      if (f.hp <= 0 || f.state === 'beaten' || !this.combat) continue
      this.foe = f; f.hurtUntil = 0
      this.swing = { tile: [f.c, f.r], t0: this.t, born: this.t, hitDone: true, desperate: true, charged: true, flip: false, riposte: false, power: 4, vis: 1, hitAt: 0, dash: true, dir: [...D.dir] }
      try { this._playerStrikeLands() } finally { this.swing = null; this.foe = this.tgt }
    }
    this.hitStop = Math.max(this.hitStop, 170)
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
    if (!this.combat || this.dash) return
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
    if (F.untouchable) return this._foeParries()                                  // she turns everything
    if (foe.state === 'strike' && !foe.hitDone) return this._clash(foe.st0 + F.strikeMs * 0.5 - this.t)    // both blows at once (gap: ms until his lands)
    if (!foe.armed) return this._struckUnarmed()
    if (foe.phase === 'shove') this._escalate()                          // you struck at him: the wooden sword comes out
    const open = ['wind', 'reel'].includes(foe.state)       // caught mid-move: a clean hit, and a breath back
    const cheap = foe.state === 'salute' && !F.steady                     // struck as he salutes you: it lands, and everyone saw
    const rip = !!sw.riposte                                                      // on the heels of a timed parry: nothing turns it aside
    const chance = sw.desperate || sw.charged || cheap || foe.blown || rip ? 0
                 : foe.state === 'recover' || foe.state === 'stagger' ? 0
                 : foe.state === 'reel' ? Math.min(F.parryMax, F.parryReel0 + F.parryReelStep * this.exchange)
                 : foe.state === 'wind' ? 0 : F.parryBase
    const guard = F.guard && !cheap && !rip ? (F.guard[foe.state] ?? F.guard.base) : 0        // a master's floor: he turns most blows, whatever state he's in
    const base = Math.max(chance, guard)
    const edge = base > 0 ? 0.05 * (F.def - this.pa.atk()) : 0                    // his defence against your strength
    let pp = Math.max(0, Math.min(F.parryMax, base + edge))
    if (F.moveWindow && this.t - foe.movedAt < F.moveWindow) pp *= 0.35         // caught on the move
    if (Math.random() < pp) return this._foeParries()
    const dmg = this.edged() ? this.roll(1, 8, (sw.power || 0) + (open ? 2 : 0) + (sw.charged ? 2 : 0) + (rip ? 2 : 0)) * (sw.desperate ? 2 : 1)
      : (sw.desperate || rip) && !F.match ? 2 : 1, exchange = this.exchange
    foe.hurtUntil = this.t + 300; this.exchange = 0; foe.engaged = true
    if (open) this.refund()
    this.hitStop = sw.desperate ? 140 : 80
    this.emit('hit', { on: 'foe', dmg, desperate: sw.desperate, charged: sw.charged, riposte: rip, exchange, fresh: this.breath / this.cap() >= 0.75 && !cheap })
    if (cheap) this.emit('cheapShot')
    if (foe.hp - dmg <= 0) { foe.hp = 0; return this._foeYields() }
    foe.hp -= dmg
    if (sw.charged && !F.steady) {                                         // a full charged cut puts him on the ground
      this._setFoe('down', DOWN_MS); foe.hurtUntil = this.t + DOWN_MS
      const [pc, pr] = this.pa.tile(), d = sw.dir || [sign(foe.c - pc), sign(foe.r - pr)]
      if (this._knockFoe(d)) this._knockFoe(d)                              // the slam throws him two tiles, if there is room
      this.emit('knockdown', { who: 'foe' }); return
    }
    if (F.poise && !foe.blown) return                                    // fresh, he takes it and keeps coming
    if (foe.state === 'wind') this._setFoe('stagger', F.staggerMs)
    else if (foe.state === 'reel') this._setFoe('recover', 500)
    else if (!['recover', 'stagger'].includes(foe.state)) this._setFoe('stagger', F.staggerMs * 1.2)    // the rhythm is broken: step in
    const [pc, pr] = this.pa.tile()
    this._knockFoe(sw.dir || [sign(foe.c - pc), sign(foe.r - pr)])
    if (F.match) this._touch('player')
  }

  // they turn your blow aside, and come straight back, a little faster each time
  _foeParries() {
    const F = this.F, foe = this.foe
    this.exchange++; this.hitStop = 70
    this.p.busyUntil = this.t + P.reelMs; this.queued = null
    if (this._remind()) { this.emit('parried', { by: 'foe', exchange: this.exchange }); return }     // not saluted: he steps back and reminds you, instead of countering
    foe.engaged = true
    foe.target = [...this.pa.tile()]; foe.targets = [foe.target]
    foe.wind = Math.max(F.counterWindMin, F.counterWind0 - F.counterWindStep * this.exchange)
    if (F.reads && this.moving()) { const at = this._leadTile(foe.wind + F.strikeMs * 0.5); if (at) { foe.target = at; foe.targets = [at] } }
    if (F.style === 'shover') { foe.shoving = true; foe.wind = 380 }               // her answer: a throw
    this._setFoe('wind', foe.wind)
    this.emit('parried', { by: 'foe', exchange: this.exchange, wind: foe.wind })
  }

  // how far apart (ms) two blows may land and still be a parry: your Cosaint widens it
  parryWindow() { return Math.max(PARRY.minMs, Math.min(PARRY.maxMs, PARRY.baseMs + PARRY.perDef * (this.pa.def() - 5))) }

  // A blow met on the beat: his is turned aside, you are not thrown back, a breath returns, and he is open (see PARRY).
  _parryFoe() {
    const foe = this.foe, F = this.F
    this.exchange++; this.hitStop = 110
    this.swing = null; this.queued = null; foe.hitDone = true
    this.p.busyUntil = this.t + 120; this.p.busyKind = 'other'          // short: the riposte is the next tap
    this.riposte = { until: this.t + PARRY.riposteMs }
    this.refund()
    this._setFoe('reel', F.reelMs)
    this.emit('parried', { by: 'player', timed: true, exchange: this.exchange })
    // a long exchange, and blades bound on the beat, can tear his from his hand (as in a clash)
    if (foe.armed && !F.steady && !F.aggressor && this.exchange >= 3 && Math.random() < DISARM_CHANCE) this._disarmFoe()
  }

  _clash(gap) {
    if (this.tech.parry && gap != null && Math.abs(gap) <= this.parryWindow()) return this._parryFoe()     // on the beat: a parry
    const foe = this.foe, charged = !!this.swing?.charged
    this.exchange++; this.hitStop = 100
    const [pc, pr] = this.pa.tile()
    const d = [sign(pc - foe.c), sign(pr - foe.r)]
    this._knockPlayer(d); this._foeStepTo(foe.c - d[0], foe.r - d[1], 140)
    this.swing = null; foe.hitDone = true
    this.p.busyUntil = this.t + 260
    this._setFoe('rest', 500)
    this.emit('clash', { exchange: this.exchange })
    // blades meeting hard -- your charged cut, or a long exchange -- can tear his from his hand
    if (foe.armed && !this.F.steady && !this.F.aggressor && (charged || this.exchange >= 3) && Math.random() < DISARM_CHANCE) this._disarmFoe()
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
  // the archer's opening: the wooden sword thrown a few tiles aside, behind her; she does not go for it until the fight is over (or the quiver is)
  _dropSword() {
    const foe = this.foe, [pc, pr] = this.pa.tile()
    const away = [sign(foe.c - pc), sign(foe.r - pr)], opts = []
    for (let dc = -3; dc <= 3; dc++) for (let dr = -3; dr <= 3; dr++) {
      const c = foe.c + dc, r = foe.r + dr, d = Math.max(Math.abs(dc), Math.abs(dr))
      if (d < 2 || !this.pa.free(c, r) || this.playerOn(c, r)) continue
      opts.push([c, r, dc * away[0] + dr * away[1] + Math.random() * 1.5])
    }
    if (!opts.length) return
    opts.sort((a, b) => b[2] - a[2])
    this.dropped = { c: opts[0][0], r: opts[0][1], from: [foe.c, foe.r], t0: this.t, ms: SWORD_FLIGHT_MS }
    this.emit('archerDrop', { tile: [opts[0][0], opts[0][1]] })
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
    if (this.foes.length > 1) {
      const [pc, pr] = this.pa.tile(), f = this.foes.find(o => o.hp > 0 && o.state !== 'beaten' && o.c === pc + dx && o.r === pr + dy)
      if (f && f !== this.foe) { try { this.foe = f; return this.bump([dx, dy]) } finally { this.foe = this.tgt } }
    }
    const foe = this.foe
    if (!this.combat || foe.hp <= 0 || this.p.lost) return
    if (this.carrying && this.cheb() <= 1) return this._returnSword()
    if (!this.canMove() || ['down', 'beaten', 'pickup'].includes(foe.state)) return     // feet free, as for a step
    if (this.F.untouchable) {                                  // she doesn't budge; she answers
      if (foe.state !== 'wind') { foe.shoving = true; this._setFoe('wind', 300); this.emit('tell', { ms: 300 }) }
      return
    }
    if (this.winded() || this.breath < 1) { this.emit('spent', { lastHeart: this.pa.hp() <= 1 }); return }
    this.spend(1)
    if (this.F.dunkable && this.pa.wet?.(foe.c + dx, foe.r + dy)) return this._foeDunked([dx, dy])   // off the edge: into the loch
    const offBalance = ['wind', 'recover', 'stagger', 'reel', 'unarmed'].includes(foe.state)
    const moved = this._foeStepTo(foe.c + dx, foe.r + dy, 160)
    const down = !this.F.steady && Math.random() < (offBalance ? 0.5 : 0.15) + (moved ? 0 : 0.1)
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
    const dash = !!foe.dash; foe.dash = false
    foe.quickWas = foe.quickNow; foe.quickNow = false
    const leap = !!foe.leap || dash; if (!F.spinStay) foe.leap = false          // (his spin goes on turning after it has bitten)
    const kd = dash ? foe.dashDir : [sign(pc - foe.c), sign(pr - foe.r)]       // a cut from a dash throws you on along his line
    if (dash) { foe.targets = (foe.lane || []).some(([c, r]) => c === pc && r === pr) ? [[pc, pr]] : []; this.emit('foeCut', { hit: foe.targets.length > 0 }) }
    else if (leap) { if (F.spinStay) { foe.spinT0 = foe.st0; foe.spinUntil = foe.st0 + LEAP_AIR }       // (the turn goes on for the view's sake, though the blow has landed)
      this.emit('foeLand'); foe.targets = this.cheb() <= 1 ? [[pc, pr]] : []; if (foe.targets.length) foe.leapDone = true }       // the landing: everyone beside him
    if (!foe.targets.some(([c, r]) => c === pc && r === pr)) {                       // fell short
      foe.rush = 0; this._foeAfterBlow(1); this.exchange = 0
      if (leap) this._setFoe('recover', foe.quickWas ? 400 : 1100)                      // landed on nothing: open (an opening spin, hardly)
      this.practice++; this.emit('miss', { by: 'foe', leap }); return
    }
    if (!leap && this.swing && !this.swing.hitDone && this.swing.tile[0] === foe.c && this.swing.tile[1] === foe.r) return this._clash(this.swing.t0 + this.swing.hitAt - this.t)    // (gap: ms until yours lands)
    if (this.t < p.hurtUntil || p.lost) { this._foeAfterBlow(0.6); return }
    if (!leap && Math.random() < this.dodgeP()) {                                              // slipped: no harm, nobody moves
      this.practice++; this.exchange = 0
      this.emit('dodge', { dir: deg(pr - foe.r, pc - foe.c) })
      this._foeAfterBlow(1); return
    }
    if (!leap && Math.random() < this.playerParryP()) {                                       // you turn it aside, by instinct
      this.exchange++; this.hitStop = 70; this.practice++
      this.emit('parried', { by: 'player', exchange: this.exchange })
      this.spend(0.5)                                                           // staying in the fray tires you
      this._setFoe('reel', F.reelMs)
      return
    }
    if (!F.flow) this.pa.stopRoute()                       // (flow: a blow does not end the line you are walking, nor the slow it holds)
    this._spoilCharge()
    const dmg = F.edged ? this.roll(...(F.dice || [1, 8, 0])) : F.dmg
    p.hurtUntil = this.t + P.hurtMs; this.exchange = 0
    this.hitStop = 110
    this.swing = null; this.queued = null; p.busyUntil = Math.max(p.busyUntil, this.t + 300); p.busyKind = 'other'
    this.emit('hit', { on: 'player', dmg, tired: !!this.breathState() })
    if (F.edged) {                                                  // a live blade: the blow is owed, and a deep one opens a wound
      this.steady = 0
      if (!(this.owed > 0)) this.tollAt = this.t + TOLL_MS
      this.owed = Math.min(this.pa.hp(), this.owed + dmg)
      if (dmg >= 3 && this.eff() > 0) { this.wounds = Math.min(3, this.wounds + 1); if (this.wounds === 1) this.bleedAt = this.t + this._bleedMs() }
      const away = kd
      this._knockPlayer(away); if (dmg >= 5 || leap) this._knockPlayer(away)       // any wound throws you back, a heavy one two tiles
      this._foeAfterBlow(0.6); return
    }
    if (this.pa.hp() - dmg <= 0 && F.lethal) return this._playerKilled()
    if (this.pa.hp() - dmg <= 0 && !F.mercy) return this._playerYields('Buaileadh thú', 'You were beaten')
    const hurt = F.mercy ? Math.min(dmg, this.pa.hp() - 1) : dmg          // a master never takes you below one heart
    if (hurt > 0) this.pa.hurt(hurt)
    this._knockPlayer(kd); if (leap) this._knockPlayer(kd)      // a hit throws you back a tile (a leap, two)
    if (F.mercy && hurt < dmg) return this._playerYields('Buaileadh thú', 'You were beaten')     // the blow that would take your last heart: he salutes, sheathes (you fight on one heart: the red moon)
    this._foeAfterBlow(0.6)
    if (this.F.match) this._touch('foe')
  }
  dodgeP() { return Math.min(0.4, 0.05 + 0.01 * this.practice) }
  // your own defence turning his blow aside: 20% + 6% per point of Cosaint over his Neart, 3..60% (half, winded)
  playerParryP(atk = this.F.atk) {
    const p = Math.max(0.03, Math.min(0.6, 0.2 + 0.06 * (this.pa.def() - atk)))
    return this.winded() ? p / 2 : p
  }
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
    if (this.F.next) return this._nextPhase()
    if (this.F.aggressor) {
      this._setFoe('beaten', 1e9)
      if (!this.F.flees) this.emit('knockdown', { who: 'foe', final: !this._othersLive() })
      if (this._othersLive()) { this.emit('foeDown', { left: this.foes.filter(f => f.hp > 0 && f.state !== 'beaten').length - (this.foe.hp > 0 ? 1 : 0) }); this._retarget(); return }   // the rest fight on
      return this._fightOver({ won: true, how: this.F.flees ? 'fled' : 'beaten' })   // fled: he drops it and runs (the scene)
    }
    const steady = !!this.F.steady                     // a master doesn't fall: he lowers his blade and bows
    this._setFoe(steady ? 'nod' : 'beaten', steady ? 2200 : 1e9)
    this.bout = { over: true, until: this.t + 2600, needLeave: true, won: true }
    this.combat = false
    this.emit('knockdown', { who: 'foe', final: true, steady })
    this.emit('boutOver', { won: true })
  }
  // knocked: down on the grass if his blow ended it; a yield (swipe down) stays on your feet
  _playerYields(ga, en, knocked = true) {
    if (this.F.aggressor) {                                      // his fight: a knockout, and the scene takes it from here (the cabin)
      if (knocked) { this.p.downUntil = this.t + PLAYER_DOWN_MS; this.emit('knockdown', { who: 'player', final: true }) }
      this._setFoe('rest', 1e9)
      return this._fightOver({ won: false, how: 'ko', ga, en })
    }
    this.p.lost = true
    if (knocked) { this.p.downUntil = this.t + PLAYER_DOWN_MS; this.emit('knockdown', { who: 'player', final: true }) }
    this.bout = { over: true, until: this.t + 2600, needLeave: true, won: false }
    this._spoilCharge(); this.swing = null; this.queued = null
    this.combat = false
    this._setFoe('idle', 0)
    this.emit('boutOver', { won: false, ga, en })
  }
  // ── his fight (F.aggressor) ──────────────────────────────────────────────
  // It starts when the scene says (he charges), whatever your stance. It ends for good: boutOver carries
  // how it ended, and the scene takes over (the cabin, his flight, the swim). endFight() stops the drowning.
  engage() {
    if (this.noFoe || this.fight) return
    const foe = this.foe, F = this.F
    this.fight = true; this.combat = true; this.exchange = 0; this.saluted = true; this.drowned = false; this.drown = null
    Object.assign(foe, { phase: F.shoves ? 'shove' : 'wood', sheathed: !!F.shoves, pushes: 0, stam: F.stamina || 0, stamAt: this.t, blown: false, engaged: true, nextStep: 0 })
    this._setFoe('approach', 5000)
    this.emit('charge', { phase: foe.phase })
  }
  endFight() { this.fight = false; this.drown = null }
  _fightOver(d) {
    this.combat = false; this.exchange = 0; this._spoilCharge(); this.swing = null; this.queued = null
    { const keep = this.foe; for (const f of this.foes) if (f.state !== 'beaten') { this.foe = f; this._setFoe('rest', 1e9) } this.foe = keep }   // they stand where it ended; the scene moves them
    this.bout = { over: true, until: Infinity, needLeave: true, won: !!d.won, how: d.how }
    if (!d.won) this.p.lost = true
    this.emit('boutOver', d)
  }
  _playerKilled() {
    this.pa.stopRoute(); this._spoilCharge()
    this.p.downUntil = this.t + PLAYER_DOWN_MS
    this.emit('knockdown', { who: 'player', final: true })
    this._setFoe('rest', 1e9)
    this._fightOver({ won: false, how: 'killed' })
    this.pa.kill?.()
  }
  // his last wooden heart: the wooden sword goes, and F.next (the knife) comes out
  _nextPhase() {
    const foe = this.foe, next = this.F.next
    this.F = { ...next }
    Object.assign(foe, { hp: next.hp, stam: next.stamina || 0, blown: false, phase: next.phase || 'next', sheathed: false, pushing: false })
    this.exchange = 0
    this._setFoe('recover', 1400); foe.hurtUntil = this.t + 1200         // a moment: his hand going to his belt
    this.emit('phase', { to: foe.phase })
  }
  // his first phase is over: the wooden sword comes out
  _escalate() {
    const foe = this.foe
    if (foe.phase !== 'shove') return
    foe.phase = 'wood'; foe.sheathed = false
    this.emit('phase', { to: 'wood' })
  }
  // you shoved him off the edge (F.dunkable): into the loch, and his fight is over
  _foeDunked([dx, dy]) {
    const foe = this.foe
    foe.from = [foe.c, foe.r]; foe.t0 = this.t; foe.ms = 200; foe.c += dx; foe.r += dy
    this.p.busyUntil = this.t + 320; this.p.busyKind = 'other'
    this._setFoe('beaten', 1e9)
    this.emit('shove', { down: true, dir: [dx, dy], dunk: true })
    this._fightOver({ won: true, how: 'dunked' })
  }
  // In the water (pa.wet) during his fight: after graceMs a heart every everyMs; the heart that would take
  // your last puts you under (emit 'drowned': the scene wakes you in the cabin). With the knife out the
  // water is a way out: he won't follow (boutOver how: 'escaped'), but you still have to get out.
  _drownTick(t) {
    const D = this.F.drown, [c, r] = this.pa.tile()
    if (this.drowned || !this.pa.wet?.(c, r)) { if (this.drown) { this.drown = null; this.emit('ashore') } return }
    if (!this.drown) {
      this.drown = { next: t + D.graceMs }
      this.emit('inWater')
      if (this.combat && this.F.lethal) this._fightOver({ won: false, how: 'escaped' })
    }
    if (t < this.drown.next) return
    this.drown.next = t + D.everyMs
    if (this.pa.hp() <= 1) {
      this.drowned = true; this.emit('drowned')
      if (this.combat) this._fightOver({ won: false, how: 'drowned' })
      return
    }
    this.pa.hurt(1); this.emit('drowning', { hp: this.pa.hp() })
  }
  // his shove: a blue tile, F.shoveWind to land; then F.shoveGap before the next. At the edge it puts you in.
  _startPush() {
    const foe = this.foe, F = this.F
    foe.shoveAt = this.t + (F.shoveGap || 1500)
    foe.pushing = true
    this._aimAttack(); foe.target = [...this.pa.tile()]; foe.targets = [foe.target]
    this._startWind(F.shoveWind || 450)
  }
  _foePushes() {
    const foe = this.foe, F = this.F, [pc, pr] = this.pa.tile()
    foe.pushing = false
    foe.shoveAt = this.t + (F.shoveGap || 1500)
    if (!foe.targets.some(([c, r]) => c === pc && r === pr) || this.p.downUntil > this.t) { this._setFoe('rest', 500); this.emit('miss', { by: 'foe', shove: true }); return }
    const away = [sign(pc - foe.c), sign(pr - foe.r)]
    this._spoilCharge(); this.swing = null; this.queued = null
    this.pa.forceStep(away)
    this.p.busyUntil = this.t + 350; this.p.busyKind = 'other'
    foe.pushes++
    const [nc, nr] = this.pa.tile()
    this.emit('shove', { by: 'foe', dir: away, wet: !!this.pa.wet?.(nc, nr) })
    if (foe.phase === 'shove' && foe.pushes >= (F.shoves || 0)) this._escalate()
    this._setFoe('rest', 600)
  }
  // stamina (F.stamina): back while he isn't swinging; run dry and he's blown until blownMs has passed and he has 60% back
  _stamina(t) {
    const foe = this.foe, F = this.F, dt = t - (foe.stamAt || t), busy = ['wind', 'strike'].includes(foe.state)
    foe.stamAt = t
    if (!busy) foe.stam = Math.min(F.stamina, foe.stam + dt / 1000 * (F.stamRegen || 1))
    if (!foe.blown && foe.stam < 1 && !busy) { foe.blown = true; foe.blownUntil = t + (F.blownMs || 2000); this.emit('blown') }
    else if (foe.blown && t >= foe.blownUntil && foe.stam >= F.stamina * 0.6) { foe.blown = false; this.emit('recovered') }
  }
  // is the tile behind you (away from him) water?
  _backToWater() { const foe = this.foe, [pc, pr] = this.pa.tile(); return !!this.pa.wet?.(pc + sign(pc - foe.c), pr + sign(pr - foe.r)) }
  // Garbhán: no circling. Fresh, straight at you and swinging, two and three at a time; blown, he backs off,
  // or shoves you if you crowd him (not with the knife). In his first phase every blow is a shove, and later
  // he shoves rather than cuts whenever your back is to the water.
  _rusherThink(t) {
    const foe = this.foe, F = this.F, d = this.cheb()
    if (t < foe.nextStep) return
    if (foe.blown) {
      foe.nextStep = t + F.stepMs * 2.5
      if (d <= 1) { if (!F.noShove && t >= foe.shoveAt) this._startPush(); else this._foeRetreat() }
      return
    }
    foe.nextStep = t + F.stepMs
    if (d <= 1) {
      if (foe.phase === 'shove') { if (t >= foe.shoveAt) this._startPush(); return }
      if (!F.noShove && t >= foe.shoveAt && this._backToWater()) { this._startPush(); return }   // your back to the loch: in you go
      this._aimAttack(); this._startWind(); return
    }
    const at = foe.c + ',' + foe.r
    this._foeStep(this.pa.tile(), false, false)
    if (F.stamina && foe.c + ',' + foe.r !== at) foe.stam -= F.stamStep || 0
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
      comboN: 0, rush: 0, hurtUntil: 0, armed: true, shamed: false, reminded: 0, startPending: false, returning: false, engaged: false, movedAt: -1e9, footAt: 0, readAt: 0,
      phase: null, sheathed: false, pushes: 0, pushing: false, shoveAt: 0, stam: this.F.stamina || 0, stamAt: 0, blown: false, blownUntil: 0, leap: false, leapAt: -1e9, leapDone: false, dash: false, dashAt: -1e9, dashUntil: 0, shoot: false, shootAt: -1e9, looseAt: -1e9 })
    this.dropped = null        // his sword on the ground: { c, r, from: [c, r], t0, ms } (it flies first)
    this.carrying = false      // you've picked it up
  }
  _setFoe(state, ms) {
    const foe = this.foe
    foe.state = state; foe.st0 = this.t; foe.until = this.t + ms; foe.hitDone = false; foe.follow = false
    if (state !== 'wind' && state !== 'strike') { foe.leap = false; foe.dash = false; foe.shoot = false; foe.comboN = 0; foe.rush = 0; foe.feint = false; foe.pushing = false }
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
  _foeRetreat(leashed = false) {                    // back out of reach (leashed: not far from where he belongs)
    const foe = this.foe, here = this.cheb(), [pc, pr] = this.pa.tile()
    const opts = D8.map(v => [foe.c + v[0], foe.r + v[1]]).filter(([c, r]) => this.foeFree(c, r) && (!leashed || this._fromHome([c, r]) <= LEASH + 1))
      .map(o => [o, Math.max(Math.abs(o[0] - pc), Math.abs(o[1] - pr))]).filter(([, d]) => d > here)
    if (!opts.length) return false
    const best = opts.sort((a, b) => b[1] - a[1])[0][0]
    return this._foeStepTo(best[0], best[1], this.F.stepMs * 0.6)
  }
  _knockPlayer(d) {                                 // a blow throws you back a tile, but never into the water (pa.wet): only his shove does that
    const [c, r] = this.pa.tile()
    if (this.pa.wet?.(c + d[0], r + d[1])) return false
    return this.pa.forceStep(d)
  }
  _knockFoe(d) {                                    // a hit throws him back a tile, so nobody trades toe to toe
    const foe = this.foe
    return this._foeStepTo(foe.c + d[0], foe.r + d[1], 145)
  }

  // where you'll be: n steps along your route, or the way the brooch is held
  _aimPoint(n = this.F.lead || 0) { return n ? this.pa.ahead(n) : [...this.pa.tile()] }
  // the steps you'll start before a blow begun now lands (in a bout a step is the step, then a short rest:
  // 40 ms on a drawn line, P.hopRest on the brooch -- see _onPlayerStep)
  _stepsBefore(ms) { const per = this.pa.stepMs() + (this.pa.onRoute() ? 40 : P.hopRest); return Math.max(0, Math.min(6, Math.floor(ms / per))) }
  // where you'll be when it lands, if that's within his reach (else null: he keeps his aim)
  _leadTile(ms) {
    const foe = this.foe, n = this._stepsBefore(ms)
    for (let k = n; k >= 1; k--) { const [c, r] = this.pa.ahead(k); if (Math.max(Math.abs(c - foe.c), Math.abs(r - foe.r)) === 1) return [c, r] }
    return null
  }
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
    const [c, r] = this._aimPoint(Math.max(1, this._stepsBefore(F.windMs + F.strikeMs * 0.5)))
    return Math.max(Math.abs(c - foe.c), Math.abs(r - foe.r)) === 1 ? [c, r] : null
  }
  // ── his dash: the lane (up to four tiles, you somewhere in it, a free tile beyond you), and the go ──
  _foeDashPlan(c0, c1) {
    const [pc, pr] = this.pa.tile()
    for (const d of D8) {
      const lane = []
      for (let k = 1; k <= DASH.tiles; k++) {
        const c = c0 + d[0] * k, r = c1 + d[1] * k
        if (!(this.foeFree(c, r) || (c === pc && r === pr))) break
        lane.push([c, r])
      }
      const at = lane.findIndex(([c, r]) => c === pc && r === pr)
      if (at < 0) continue
      if (!lane.slice(at + 1).some(([c, r]) => this.foeFree(c, r))) continue          // nowhere to come out
      return { d, lane }
    }
    return null
  }
  _foeDashGo() {
    const foe = this.foe, lane = foe.lane || [], [pc, pr] = this.pa.tile()
    const free = lane.filter(([c, r]) => this.foeFree(c, r))
    const to = free[free.length - 1]
    foe.dashT0 = this.t; foe.dashFrom = [foe.c, foe.r]
    this._setFoe('strike', FOE_DASH.glide + FOE_DASH.cut + 200)
    foe.dash = true                                                   // (set after: entering a state clears it)
    if (to) this._foeStepTo(to[0], to[1], FOE_DASH.glide)
    foe.dashUntil = this.t + FOE_DASH.glide + FOE_DASH.pose
    this.emit('foeSwing', { dash: true })
  }
  // the leap carries him through the air to land beside you: up to four tiles from where he crouched
  _leapJump() {
    const foe = this.foe, [pc, pr] = this.pa.tile()
    if (this.F.spinStay) return                                             // your own spin: on the spot, everyone beside him
    if (this.cheb() <= 1) { foe.targets = [[pc, pr]]; return }
    const near = D8.map(v => [pc + v[0], pr + v[1]]).filter(([c, r]) => this.foeFree(c, r))
      .map(o => [o, Math.max(Math.abs(o[0] - foe.c), Math.abs(o[1] - foe.r))]).filter(([, d]) => d <= 4).sort((a, b) => a[1] - b[1])
    if (near.length) return void this._foeStepTo(near[0][0][0], near[0][0][1], LEAP_AIR * 0.85)
    for (let n = 4; n >= 1; n--) {                                       // too far: as far as he can go the right way
      const c = foe.c + Math.sign(pc - foe.c) * Math.min(n, Math.abs(pc - foe.c)), r = foe.r + Math.sign(pr - foe.r) * Math.min(n, Math.abs(pr - foe.r))
      if (this.foeFree(c, r) && this._foeStepTo(c, r, LEAP_AIR * 0.85)) return
    }
  }
  _startWind(ms = this.F.windMs, quick = false) {
    const foe = this.foe, F = this.F
    // F.pattern: his moves in a fixed round, so he can be learned (and feared): 'cut' is the ordinary blow; 'spin' turns on the spot; 'dash' goes through you down a red lane
    if (F.pattern && !foe.shoving && !foe.pushing && !foe.leap) {
      const mv = F.pattern[(foe.patN = (foe.patN || 0) + 1) % F.pattern.length]
      if (mv === 'spin') { foe.leap = true; foe.leapAt = this.t; ms = F.leapWind || 800 }
      else if (mv === 'dash') {
        const plan = this._foeDashPlan(foe.c, foe.r)
        if (plan) {
          foe.lane = plan.lane; foe.dashDir = plan.d; foe.dashAt = this.t; foe.engaged = true; foe.target = plan.lane[0]; foe.targets = plan.lane
          foe.wind = F.dashWind || 900; this._setFoe('wind', foe.wind); foe.dash = true
          this.emit('tell', { ms: foe.wind, dash: true }); return
        }
      }
    }
    if (this.F.leap && !foe.shoving && !foe.pushing && (this.F.leapOnly || !foe.leapDone || (this.cheb() <= 1 && this.t - foe.leapAt > (this.F.leapEvery || 24000)))) { foe.leap = true; foe.leapAt = this.t; ms = quick ? (this.F.leapQuick || 300) : (this.F.leapWind || 1000) }
    if (this.F.reads && this.moving() && !foe.shoving) { const at = this._leadTile(ms + this.F.strikeMs * 0.5); if (at) { foe.target = at; foe.targets = [at] } }
    if (this.F.stamina && !foe.pushing) foe.stam -= this.F.stamCut || 1
    if (foe.leap && F.spinStay) { foe.targets = D8.map(v => [foe.c + v[0], foe.r + v[1]]); foe.target = foe.targets[0] }       // the spin on the spot: all eight beside him show red
    foe.engaged = true; foe.wind = ms; this._setFoe('wind', ms); this.emit('tell', { ms, leap: foe.leap })
  }
  // after a blow: a combo's next cut, or the long recovery that leaves them open
  _foeAfterBlow(mult) {
    const foe = this.foe, F = this.F
    if (!this.p.lost && F.combo && foe.comboN < F.combo && this.cheb() <= 2) {     // follows you in, even if the blow knocked you back
      if (this.cheb() > 1) this._stepIn(120)
      if (this.cheb() <= 1) { foe.comboN++; this._aimAttack(); this._startWind(F.followWind); return }
    }
    this._setFoe('recover', F.recoverMs * mult)
    foe.follow = true                                            // he follows the cut through before he comes back to guard
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

  // a master's courtesy: you haven't saluted, so he steps back and salutes you again (a few times) before he comes in earnest
  _remind() {
    const F = this.F, foe = this.foe
    if (!(F.reminders > 0) || this.saluted || foe.engaged || (foe.reminded || 0) >= F.reminders) return false     // only before the fight is on
    foe.reminded = (foe.reminded || 0) + 1
    this._foeDash(); foe.nextStep = 0; foe.returning = true
    this._setFoe('salute', SALUTE_MS)
    this.emit('salute', { by: 'foe', reminder: true })
    return true
  }

  // a touch in a match: the action stops, the fighters part (the scene walks you to your mark; he walks to his),
  // and it goes on when resumeBout() is called
  _touch(scorer) {
    this.touches++
    this.emit('touch', { scorer, n: this.touches })
    this.combat = false; this.exchange = 0; this._spoilCharge(); this.swing = null; this.queued = null
    this.p.busyUntil = this.t; this.p.busyKind = 'other'
    this.matchPause = true; this.foeReady = true              // his blade stays out
    this._setFoe('idle', 0)
  }
  resumeBout() { this.matchPause = false; this.resume = true }

  // he zooms off two or three tiles (dust and speed lines: meleeView), to salute you pointedly
  _foeDash(far = false) {
    const foe = this.foe, [pc, pr] = this.pa.tile()
    let ax = sign(foe.c - pc), ay = sign(foe.r - pr)
    if (!ax && !ay) ax = 1
    const dirs = [[ax, ay]]
    if (!ax) dirs.push([1, ay], [-1, ay]); else if (!ay) dirs.push([ax, 1], [ax, -1]); else dirs.push([ax, 0], [0, ay])
    for (const k of far ? [6, 5, 4, 3] : [3, 2]) for (const [dx, dy] of dirs) {
      const c = foe.c + dx * k, r = foe.r + dy * k
      if (this.foeFree(c, r) && this._fromHome([c, r]) <= (far ? 9 : 6)) {
        const from = [foe.c, foe.r]
        this._foeStepTo(c, r, 190); this.emit('dash', { from, to: [c, r] }); return true
      }
    }
    return this._foeRetreat()
  }

  // the Warden: stands his ground, watches, and answers any cut that finds nothing
  _wardenThink(t) {
    const foe = this.foe, F = this.F, d = this.cheb()
    if (foe.whiffAt && t - foe.whiffAt < 700 && d <= 2) {
      foe.whiffAt = 0
      if (this._remind()) return
      if (d === 2 && !this._stepIn(100)) return
      this._aimAttack(); this._startWind(F.followWind); return
    }
    if (F.mobile && this.combat && !foe.returning) { if (this._footwork(t, d) || d >= 2) return }     // no old approach timer: he is always working round you
    if (d <= 1) { foe.returning = false; if (!foe.eye) foe.eye = t + 800; if (t >= foe.eye) { foe.eye = 0; if (this._remind()) return; this._aimAttack(); this._startWind() } return }
    foe.eye = 0
    if (d <= 5 && t >= foe.nextStep) { foe.nextStep = t + (foe.returning ? F.stepMs : 2600); this._foeStep(this.pa.tile(), false, !foe.returning) }     // his patience runs out, slowly
  }
  // Footwork v2 (F.mobile 1..3). He never just stands: closes on a curve beyond two tiles, circles at two (turning the same way
  // for a while), backs off a tile when crowded, and now and then lunges (1: rarely, 2-3: often). 3 also slips away from the end of
  // the line you have drawn. Returns true when it took the turn.
  _footwork(t, d) {
    const foe = this.foe, F = this.F
    if (foe.returning || !this.combat || foe.from || t < foe.footAt) return false
    const done = pause => { foe.movedAt = t; foe.footAt = t + pause; return true }
    const home = () => this._fromHome([foe.c, foe.r])
    const [pc, pr] = this.pa.tile()
    const cheb = ([c, r]) => Math.max(Math.abs(c - pc), Math.abs(r - pr))
    const free = ([c, r]) => this.foeFree(c, r) && this._fromHome([c, r]) <= LEASH + 1
    if (F.mobile >= 3 && d >= 2 && t >= foe.readAt && this.pa.onRoute()) {
      const [ec, er] = this.pa.ahead(8)
      if (Math.max(Math.abs(ec - foe.c), Math.abs(er - foe.r)) <= 1) {
        foe.readAt = t + 1800
        const opts = D8.map(v => [foe.c + v[0], foe.r + v[1]]).filter(free)
          .map(o => [o, Math.max(Math.abs(o[0] - ec), Math.abs(o[1] - er))]).filter(([, e]) => e >= 2)
        if (opts.length) {
          const best = opts.sort((a, b) => b[1] - a[1] || Math.random() - 0.5)[0][0]
          if (this._foeStepTo(best[0], best[1], F.stepMs * 0.5)) return done(900)
        }
      }
    }
    if (d <= 1) {
      foe.footAt = t + 900
      if (Math.random() < 0.55 && home() <= LEASH + 1 && this._foeRetreat()) return done(900)
      return false                                                   // not this time: he stands and cuts as before
    }
    // round you: keep the ring you are on, turning the same way (the way turns over now and then)
    const circle = () => {
      if (!foe.orbit || Math.random() < 0.12) foe.orbit = Math.random() < 0.5 ? 1 : -1
      for (let tries = 0; tries < 2; tries++) {
        let best = null, bs = 0
        for (const v of D8) {
          const o = [foe.c + v[0], foe.r + v[1]]
          if (!free(o) || cheb(o) !== d) continue
          const cross = ((foe.c - pc) * (o[1] - pr) - (foe.r - pr) * (o[0] - pc)) * foe.orbit
          if (cross > bs) { bs = cross; best = o }
        }
        if (best) return this._foeStepTo(best[0], best[1], F.stepMs * 0.5)
        foe.orbit = -foe.orbit
      }
      return false
    }
    if (d === 2) {
      const lungeP = F.mobile >= 2 ? 0.4 : 0.22
      if (Math.random() < lungeP) {
        if (this._remind()) return true
        if (this._stepIn(100)) { foe.movedAt = t; foe.footAt = t + 700; this._aimAttack(); this._startWind(F.followWind); return true }
      }
      circle()
      return done(450 + Math.random() * 450)
    }
    // further off: close in, now straight, now round
    if (Math.random() < 0.3 && circle()) return done(F.stepMs * 0.8)
    const opts = D8.map(v => [foe.c + v[0], foe.r + v[1]]).filter(free).map(o => [o, cheb(o)]).filter(([, e]) => e < d)
    if (opts.length) {
      const least = Math.min(...opts.map(o => o[1])), pick = opts.filter(o => o[1] === least)
      const o = pick[Math.floor(Math.random() * pick.length)][0]
      this._foeStepTo(o[0], o[1], F.stepMs * 0.6)
    } else circle()
    return done(F.stepMs * 0.8)
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

  // Uathach: walks you down, and when she's beside you, a moment's look -- then
  // she throws you
  _shoverThink(t) {
    const foe = this.foe, F = this.F, d = this.cheb()
    if (d <= 1) {
      if (!foe.eye) foe.eye = t + 450 + Math.random() * 500
      if (t >= foe.eye) { foe.eye = 0; foe.shoving = true; this._startWind(F.windMs) }
      return
    }
    foe.eye = 0
    if (t >= foe.nextStep) { foe.nextStep = t + F.stepMs; this._foeStep(this.pa.tile(), false, false) }
  }
  // she throws you: off your feet, a tile back. The third time, it's over.
  _foeThrows() {
    const foe = this.foe, [pc, pr] = this.pa.tile()
    foe.shoving = false
    if (this.cheb() > 1 || this.p.downUntil > this.t) { this._setFoe('rest', 400); return }
    const away = [sign(pc - foe.c), sign(pr - foe.r)]
    this.pa.forceStep(away)
    this.throws = (this.throws || 0) + 1
    this._spoilCharge(); this.swing = null; this.queued = null
    this.emit('shove', { by: 'foe', down: true, dir: away })
    if (this.throws >= (this.F.throws || 3)) {
      this.throws = 0
      this._playerYields('Buaileadh thú', 'Thrown, three times.', true)
      this.emit('thrownOut')
      return
    }
    this.p.downUntil = this.t + PLAYER_DOWN_MS
    this.emit('knockdown', { who: 'player' })
    this._setFoe('recover', 900)
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
    if (F.stamina) this._stamina(t)
    // you are saluting: he holds off (a blow he has begun finishes)
    if (this.combat && this.F.salutes !== false && this.p.busyKind === 'salute' && t < this.p.busyUntil && ['idle', 'approach', 'rest'].includes(foe.state)) return
    // a leaper's first move is the leap: as soon as the bout is on and you are within two tiles
    // (and again and again, near or far, until it lands on you or you hit him)
    if (F.leap && !foe.leapDone && (foe.hp < (foe.leapHp ?? foe.hp) || ['stagger', 'reel', 'down'].includes(foe.state))) foe.leapDone = true
    foe.leapHp = foe.hp
    if (this.combat && F.leap && !F.spinStay && !foe.leapDone && foe.hp > 0 && ['idle', 'approach', 'rest'].includes(foe.state) && !(foe.from && t - foe.t0 < foe.ms)) { this._aimAttack(); this._startWind(); return }
    // F.archer: she keeps off, draws, looses, and moves a little between; only when she is caught is she a swordswoman
    if (this.combat && F.archer && foe.hp > 0 && ['idle', 'approach', 'rest'].includes(foe.state)) {
      if (F.arrows && (foe.shots || 0) >= F.arrows) {          // the quiver is empty: she goes for her sword, and is a swordswoman after all
        F.archer = false
        if (this.carrying) this._returnSword()
        else if (this.dropped) { foe.armed = false; this._setFoe('unarmed', 500) }
        this.emit('quiverEmpty'); return
      }
      if (!((foe.from && t - foe.t0 < foe.ms) || t < (foe.thinkAt || 0))) {
        foe.thinkAt = t + 180
        const d0 = this.cheb()
        if (foe.openShot == null) foe.openShot = F.openShots || 0
        if (!F.stay && d0 < (F.keep || 3) && this._foeRetreat(true)) return
        if (d0 >= 2) {
          const quick = foe.openShot > 0
          if (t - foe.shootAt > (quick ? 300 : (F.shootGap || 1100))) { if (quick) foe.openShot--; this._foeDrawBow(quick); return }
          if (!F.stay && Math.random() < 0.3) {                         // not still: a step to one side
            const opts = D8.map(v => [foe.c + v[0], foe.r + v[1]]).filter(([c, r]) => this.foeFree(c, r) && this._fromHome([c, r]) <= LEASH + 1 && Math.max(Math.abs(c - this.pa.tile()[0]), Math.abs(r - this.pa.tile()[1])) >= 2)
            if (opts.length) { const o = opts[Math.floor(Math.random() * opts.length)]; this._foeStepTo(o[0], o[1], F.stepMs * 0.7) }
          }
          return
        }
      } else return
    }
    // F.dashOnly: this is all he does. He finds a line to you (shifting to one), gathers himself while the lane shows red, and is through you
    if (this.combat && F.dashOnly && foe.hp > 0 && ['idle', 'approach', 'rest'].includes(foe.state)) {
      if ((foe.from && t - foe.t0 < foe.ms) || t < (foe.thinkAt || 0)) return
      foe.thinkAt = t + 220
      const plan = t - foe.dashAt > (F.dashGap || 700) ? this._foeDashPlan(foe.c, foe.r) : null
      if (plan) {
        foe.dash = false; foe.lane = plan.lane; foe.dashDir = plan.d; foe.dashAt = t; foe.engaged = true
        if (foe.openDash == null) foe.openDash = F.openDashes || 0
        foe.target = plan.lane[0]; foe.targets = plan.lane; foe.wind = foe.openDash > 0 ? (foe.openDash--, F.dashQuick || 450) : (F.dashWind || 900)       // the first, a free shot: hardly a gather, so you see he has it
        this._setFoe('wind', foe.wind); foe.dash = true
        this.emit('tell', { ms: foe.wind, dash: true }); return
      }
      const d0 = this.cheb()
      const opts = D8.map(v => [foe.c + v[0], foe.r + v[1]]).filter(([c, r]) => this.foeFree(c, r) && this._fromHome([c, r]) <= LEASH + 1)
      const lined = opts.filter(([c, r]) => this._foeDashPlan(c, r))
      const pick = lined.length ? lined[Math.floor(Math.random() * lined.length)] : null
      if (pick) this._foeStepTo(pick[0], pick[1], F.stepMs * 0.6)
      else if (d0 > 4) this._stepIn(F.stepMs * 0.7)
      else if (d0 < 2) this._foeRetreat(true)
      else if (opts.length) { const o = opts[Math.floor(Math.random() * opts.length)]; this._foeStepTo(o[0], o[1], F.stepMs * 0.7) }
      return
    }
    // F.leapOnly: this is all he does. He backs off to a few tiles, gathers himself (the crouch), and leaps again, and again
    if (this.combat && F.leapOnly && foe.hp > 0 && ['idle', 'approach', 'rest'].includes(foe.state)) {
      if (foe.from && t - foe.t0 < foe.ms) return
      if (F.spinStay) {                                                   // the spin you will be taught, on the spot (he never leaps at you with it)
        if (foe.openLeft == null) foe.openLeft = F.openSpins || 0
        if (foe.openLeft > 0) {                                           // at the start, a few with hardly a gather, whoever is near: so you see he has it
          if (t - foe.leapAt > (F.openGap || 450)) { foe.openLeft--; foe.quickNow = true; this._aimAttack(); this._startWind(undefined, true) }
          return
        }
        if (this.cheb() < (F.safeDist || 3) && this._foeRetreat(true)) return      // then: back off to a safe distance, to gather the whole of it
        if (t - foe.leapAt > (F.leapGap || 700)) { this._aimAttack(); this._startWind() }
        return
      }
      if (this.cheb() < 3 && this._foeRetreat(true)) return
      if (t - foe.leapAt > (F.leapGap || 700)) { this._aimAttack(); this._startWind() }
      return
    }
    // she slipped your spin: now she steps back in and cuts while you recover
    if (foe.spinCounterAt && t >= foe.spinCounterAt) {
      foe.spinCounterAt = 0
      if (this.combat && foe.hp > 0 && ['idle', 'approach', 'rest'].includes(foe.state)) { if (this.cheb() > 1) this._stepIn(110); if (this.cheb() <= 1) { this._aimAttack(); this._startWind(F.followWind); return } }
    }
    // winded within his reach: he comes for you (at most every 1.5 s). Breath is yours to manage.
    if (this.combat && this.winded() && foe.armed && !F.untouchable && foe.phase !== 'shove' && !foe.blown && ['rest', 'approach'].includes(foe.state) && this.cheb() <= 2 && t >= (foe.pressAt || 0)) {
      foe.pressAt = t + 1500
      if (this.cheb() === 2) this._stepIn(100)
      if (this.cheb() <= 1) { if (this._remind()) return; this._aimAttack(); this._startWind(F.followWind); return }
    }
    switch (foe.state) {
      case 'idle': this._setFoe('approach', 5000); break
      case 'salute':
        if (foe.startPending && F.dropSword && !this.dropped && t - foe.st0 >= SALUTE_MS + 900) this._dropSword()       // the salute made, the wooden sword is thrown aside: the bow comes next
        if (foe.startPending && this.cheb() <= 1) foe.until = t           // you came in on him as he opened the bout: guard up, no free blow
        if (t >= foe.until) { this._setFoe('approach', 5000); if (foe.startPending) { foe.startPending = false; this.emit('go') } }
        break
      case 'down': if (t >= foe.until) { this._setFoe('rest', 600); this.emit('rise', { who: 'foe' }) } break
      case 'rest':
        if (t >= foe.nextStep) { foe.nextStep = t + F.stepMs * 1.6; if (Math.random() < 0.5 && !(foe.holdUntil > t)) this._foeStep(this.pa.tile(), true) }
        if (t >= foe.until) this._setFoe('approach', 5000)
        break
      case 'approach': {
        const onTheMove = this.moving()
        const amb = F.ambush && onTheMove ? this._ambushTile() : null
        if (amb) { this._aimAttack(amb); this._startWind() }
        else if (F.style === 'warden') this._wardenThink(t)
        else if (F.style === 'master') this._masterThink(t)
        else if (F.style === 'shover') this._shoverThink(t)
        else if (F.style === 'rusher') this._rusherThink(t)
        else if (this.cheb() <= 1) { this._aimAttack(); this._startWind() }
        else if (F.ambush && onTheMove) { /* hold ground and let the route come to him */ }
        else if (t >= foe.nextStep) { foe.nextStep = t + F.stepMs; this._foeStep(this.pa.tile(), false, F.style !== 'brawler') }
        if (foe.state === 'approach' && t >= foe.until) this._setFoe('rest', 500)
        break
      }
      case 'wind':
        if (foe.feint && t - foe.st0 >= foe.wind * 0.5) { foe.feint = false; this._setFoe('approach', 5000); foe.nextStep = t + 200; foe.lungeNow = true; break }
        if (t >= foe.until && foe.shoving) { this._foeThrows(); break }
        if (t >= foe.until && foe.pushing) { this._foePushes(); break }
        if (t >= foe.until && foe.shoot) { this._foeLoose(); break }
        if (t >= foe.until) { if (foe.leap) this._leapJump(); if (foe.dash) return void this._foeDashGo(); this._setFoe('strike', foe.leap ? LEAP_AIR : F.strikeMs); this.emit('foeSwing', { leap: foe.leap }) }
        break
      case 'strike':
        if (!foe.hitDone && t - foe.st0 >= (foe.dash ? FOE_DASH.glide + FOE_DASH.cut : foe.leap ? LEAP_AIR * (F.spinStay ? 0.2 : 0.9) : F.strikeMs * 0.5)) { foe.hitDone = true; this._foeStrikeLands() }
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
    if (this.dash) this._dashTick()
    if (this.arrows.length) this._arrowTick()

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
      if (!this.bout.shamed && this.dropped && this.F.dropSword) {        // the archer's sword is still in the grass: she goes for it before the salute
        foe.armed = false; this._setFoe('unarmed', 500); this.emit('rise', { who: 'foe' })
      } else if (this.bout.shamed) {                                   // no salute: he gets up, slowly, and goes for his sword
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
    if (!this.combat && !this.F.aggressor && !this.peaceful && !this.matchPause && this.enGarde && !this.bout.over && (!this.bout.needLeave || (this.eager && this.bout.won && foe.state === 'idle')) && !(this.F.mercy && this.pa.hp() <= 1) && foe.hp > 0 && d <= ENGAGE) {
      this.combat = true; this.exchange = 0
      if (this.resume) { this.resume = false; this.foeReady = false; this._setFoe('rest', 700); this.emit('boutResume') }     // the match goes on: no salute
      else {
        foe.shamed = false; this.saluted = false; foe.reminded = 0; foe.engaged = false; this.touches = 0; foe.startPending = true
        this._setFoe('salute', SALUTE_MS + 900 + (this.F.archer ? (this.F.dropSword ? 0 : ARROW.sheathe) + ARROW.unsling : 0)); this.emit('boutStart') }       // + his draw (meleeView DRAW_MS)
    } else if (this.combat && d > (this.F.keepBout ? 14 : DISENGAGE)) { if (this.F.aggressor) this._fightOver({ won: false, how: 'fled' }); else this._endCombat() }

    // he will not fight a wounded man: if you keep coming at him with your blade out, he zooms off
    if (this.F.mercy && !this.F.aggressor && !this.combat && !this.bout.over && this.enGarde && this.pa.hp() <= 1 && foe.hp > 0 && foe.armed && foe.state === 'idle' && d <= 2 && t >= (this.vanishAt || 0)) {
      this.vanishAt = t + 2500; this._foeDash(true)
    }

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
      this.breath = Math.min(this.cap(), this.breath + dt / (BR.regenMs * (this.wounds ? 2 : 1)))     // a wound slows it
    }
    this.breath = Math.min(this.breath, this.cap())
    this._tollTick(dt)

    if (this.fight && this.F.drown) this._drownTick(t)
    if (this.swing) {
      const el = t - this.swing.t0
      if (el >= (this.swing.biteAt ?? this.swing.hitAt) && !this.swing.hitDone) { this.swing.hitDone = true; this._strikeAt() }
      if (this.swing && el >= this.swing.vis) this.swing = null
    }
    try {
      for (const f of this.foes) {
        this.foe = f
        if (this.noFoe) { /* no one to fight */ }
        else if (this.foes.length > 1 && f.state === 'beaten') { /* down for good */ }
        else if (!this.bout.over || (!f.armed && f.state !== 'down')) this._foeThink()
        else if (!this.F.aggressor && f.state !== 'beaten' && !locked(f.state) && (f.c !== this.HOME[0] || f.r !== this.HOME[1]) && t >= f.nextStep) {
          f.nextStep = t + this.F.stepMs; this._foeStep(this.HOME, false, false)        // a beaten player watches him walk back
        }
        if (f.from && t - f.t0 >= f.ms) f.from = null
      }
    } finally { this.foe = this.tgt }
    this._retarget()
  }

  // ── live blades ──────────────────────────────────────────────────────────
  edged() { return !!this.pa.edged?.() }                         // the blade in your hand cuts
  steel() { return this.edged() || !!this.F.edged }              // somebody here is fighting with an edge
  eff() { return this.pa.hp() - this.owed }                      // your hearts less what you are owed to pay
  roll(n, sides, bonus = 0) { let t = bonus; for (let i = 0; i < n; i++) t += 1 + Math.floor(Math.random() * sides); return Math.max(1, t) }
  _bleedMs(w = this.wounds) { return 12000 / (1 + Math.max(0, w - 1) * 0.6) }
  // what you are owed comes due a heart a second; a wound drips; standing still presses it shut
  _tollTick(dt) {
    const t = this.t
    if (this.p.lost || this.bout.over || !(this.owed > 0 || this.wounds > 0)) { this.steady = 0; return }
    if (this.owed > 0 && t >= this.tollAt) {
      this.tollAt = t + TOLL_MS; this.owed--; this.emit('bleed', { toll: true })
      if (this.pa.hp() <= 1) return this._steelDown('The blow caught up with you')
      this.pa.hurt(1)
    }
    if (this.wounds > 0 && t >= this.bleedAt) {
      this.bleedAt = t + this._bleedMs(); this.emit('bleed', { drip: true })
      if (this.pa.hp() <= 1) return this._steelDown('You bled out')
      this.pa.hurt(1)
    }
    const still = !this.moving() && !this.swing && !this.charge && t >= this.p.busyUntil && t >= this.p.hurtUntil &&
      this.pa.tile()[0] === this.pa.fromTile()[0] && this.pa.tile()[1] === this.pa.fromTile()[1]
    this.steady = still ? this.steady + dt : 0
    if (this.steady >= PRESS_MS) { this.wounds = 0; this.owed = 0; this.steady = 0; this.bleedAt = 0; this.emit('steady') }
  }
  _steelDown(en) {
    this.owed = 0; this.wounds = 0; this.steady = 0
    if (this.F.lethal) return this._playerKilled()
    this._playerYields('Buaileadh thú', en, true)
  }

  // ── a pack ───────────────────────────────────────────────────────────────
  // another foe joins at (c, r). In a fight already on he is engaged at once (but holds his first step for `delay` ms).
  addFoe(c, r, delay = 0) {
    const f = { c, r, from: null, t0: 0, ms: 0, face: 90, hurtUntil: 0 }
    this.foes.push(f)
    try {
      this.foe = f; this._resetFoe(); f.c = c; f.r = r
      if (this.fight) {
        const F = this.F
        Object.assign(f, { phase: F.shoves ? 'shove' : 'wood', sheathed: !!F.shoves, pushes: 0, stam: F.stamina || 0, stamAt: this.t, blown: false, engaged: true, nextStep: this.t + delay })
        this._setFoe('approach', 5000)
        this.emit('charge', { phase: f.phase })
      }
    } finally { this.foe = this.tgt }
    return f
  }
  _othersLive() { return this.foes.some(f => f !== this.foe && f.hp > 0 && f.state !== 'beaten') }
  // Your blow arrives at the tile it was aimed at: whoever stands there takes it.
  _strikeAt() {
    const sw = this.swing
    if (!sw) return
    if (sw.charged && this.combat && !sw.air) return this._slam()
    const f = this.foes.length > 1 ? this.foes.find(o => o.hp > 0 && o.state !== 'beaten' && o.c === sw.tile[0] && o.r === sw.tile[1]) : null
    try { if (f) this.foe = f; this._playerStrikeLands() } finally { this.foe = this.tgt }
  }
  // The spinning leap comes down: everyone beside you takes the blow (parry-proof, knocked down and thrown back two tiles)
  _slam() {
    const sw = this.swing, [pc, pr] = this.pa.tile(), keep = sw.tile
    const near = this.foes.filter(o => o.hp > 0 && o.state !== 'beaten' && Math.max(Math.abs(o.c - pc), Math.abs(o.r - pr)) === 1)
    this.emit('slam', { n: near.length })
    if (!near.length) { try { this._playerStrikeLands() } finally { this.foe = this.tgt }; return }    // lands on nothing: the usual whiff
    try {
      for (const o of near) { this.foe = o; sw.tile = [o.c, o.r]; this._playerStrikeLands(); if (!this.swing) break }
    } finally { sw.tile = keep; this.foe = this.tgt }
  }
  // Who you are addressing: the nearest, or -- on a line you are walking -- the one nearest the line's end; one winding up to cut you
  // counts a little nearer; you keep whom you have unless another is plainly nearer (a tap keeps him longer).
  _retarget() {
    if (this.foes.length > 1) {
      const live = this.foes.filter(f => f.hp > 0 && f.state !== 'beaten')
      if (live.length && !(this.t < this.tgtLock && live.includes(this.tgt))) {
        const [pc, pr] = this.pa.tile(), ch = (f, c, r) => Math.max(Math.abs(f.c - c), Math.abs(f.r - r))
        let pool = live
        if (this.pa.onRoute()) { const [ac, ar] = this.pa.ahead(8), near = live.filter(f => ch(f, ac, ar) <= 2); if (near.length) pool = near }
        const score = f => ch(f, pc, pr) - (f.state === 'wind' || f.state === 'strike' ? 0.3 : 0) - (f === this.tgt ? 0.45 : 0)
        this.tgt = pool.reduce((a, b) => score(b) < score(a) ? b : a)
      }
    }
    this.foe = this.tgt
  }

  // where the foe is drawn, in tiles (smooth between steps)
  foeDrawPos(foe = this.foe) {
    if (!foe.from) return [foe.c, foe.r]
    const k = Math.min(1, (this.t - foe.t0) / foe.ms), e = 1 - (1 - k) * (1 - k)
    return [foe.from[0] + (foe.c - foe.from[0]) * e, foe.from[1] + (foe.r - foe.from[1]) * e]
  }
}

const locked = s => ['wind', 'strike', 'recover', 'reel', 'down', 'salute'].includes(s)

// meleeView.js
// Location: js/game/combat/meleeView.js
//
// Draws a Melee fight onto PGR's overlay canvas, from the scene's
// onPGRDrawComplete(ctx): target tiles, the foe's blade, the swing arcs,
// hearts and breath over the fighters' heads, the charge ring, sparks and
// floating words. And the body language: how both fighters stand, lean,
// fall and salute (playerPose / foePose / weaponPose, applied by PGR).
// Sound is meleeAudio.js.
//
// Placeholder look, on purpose: everything here is drawn in screen space
// over the finished frame, so it sits on top of figures. The foe himself is
// a real PGR billboard (meleeBout.js), sorted with the player as normal.

import { rig, SWORD_SCALE, drawHeldSword } from './swordRig.js'
import { figureBox, dustPuff, speedLines, whoosh } from '../scenes/locations/skye/dustDash.js'
// the Skye figures are billboards 1.2 tiles tall with the hand ~0.42 up; this
// scale puts swordRig's hand and sword where they belong on them
const FOE_PS = 0.7

const rad = a => a * Math.PI / 180
const easeIO = u => (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, u)))) / 2
// the cut: back over the shoulder, whip through, follow through and settle
// Hearts and breath drawn over the fighters' heads: hidden for now (it read
// as clutter); the floating numbers and your body tell the story instead.
const SHOW_HUD = false
export const DRAW_MS = 900, SHEATHE_MS = 900
export const SALUTE_MS = 1600
const clamp01 = u => Math.max(0, Math.min(1, u))
const easeOut = u => 1 - (1 - clamp01(u)) ** 3
const wrap180 = a => ((a % 360) + 540) % 360 - 180
const lerp = (a, b, k) => a + (b - a) * k
// the spin: how far round the blade has come (0..1), whipping through the middle; it starts SPIN_FROM degrees
// short of the direction of the blow, so it crosses it about when the blow lands
const spinS = k => { const u = clamp01(k); return easeIO(u) * 0.3 + u * 0.7 }       // nearly even: a slash, not a drift
const SPIN_FROM = -110
const SQ = 0.42                       // the spin's ellipse, squashed into perspective
const CUT_SQ = 0.55                   // and the cuts': the ground's circle seen from the camera
const SPIN_TURNS = 2                  // the body goes through its four views this many times
// clockwise from the front: [away, left] -- front-left, back-left, back-right, front-right
const SPIN_VIEWS = [[false, true], [true, true], [true, false], [false, false]]
const swingPos = k => k < 0.4 ? -0.35 * easeIO(k / 0.4)
  : k < 0.62 ? -0.35 + 1.5 * Math.pow((k - 0.4) / 0.22, 2)
  : 1.15 + 0.07 * (1 - Math.pow(1 - (k - 0.62) / 0.38, 3))

export default class MeleeView {
  constructor(scene, melee) {
    this.scene = scene
    this.m = melee
    this.sparks = []
    this.floats = []
    this.flash = 0
    this.sparky = false     // sparks where blades meet: for steel. The wooden blades only knock.
    // animation clocks, in performance.now() ms (the look runs on real time;
    // the fight's own clock is m.t)
    this.a = { garde: -1e9, ease: -1e9, flourish: -1e9, nextFlourish: 0, salute: -1e9, hurt: -1e9, fall: -1e9, rise: -1e9,
               foeHurt: -1e9, foeFall: -1e9, foeRise: -1e9, idleSince: 0, shove: -1e9, shoveDir: [0, 0],
               foeDrawn: false, foeDrawT: -1e9, foeSheatheT: -1e9, foeShoveT: -1e9, foeShoveDir: [0, 0], tellT0: -1e9, tellMs: 0, foeParryT: -1e9, foeParryHigh: true, pParryT: -1e9, pParryHigh: true, crossHigh: false, spinSeen: -1e9, spinT0: null, spinFrom: 0, parryT: null, parrySide: 1 }
  }
  now() { return this.m.clock ?? performance.now() }          // real time, slowed with the world when you focus (meleeBout._focusStep)
  // the player's facing side on screen: -1 left, 1 right (as PGR flips the sprite)
  side() { return this.pgr?._facingLeft ? -1 : 1 }
  // the foe faces the player
  foeSide() { const pf = this.playerFigure(), ff = this.foeFigure(); return pf && ff && pf.x < ff.x ? -1 : 1 }

  // ── projection ───────────────────────────────────────────────────────────
  get pgr() { return this.scene.perspectiveGround }
  // a ground point in tile units (col, row) -> screen, lifted by terrain
  ground(col, row) {
    const g = this.pgr
    const y0 = g._rowToScreenY(row)
    if (y0 == null) return null
    const lift = g._vertexH(Math.round(col), Math.round(row)) * g._scaleAtRow(row)
    return [g._colToScreenX(col, row), y0 - lift]
  }
  // where a figure standing on tile (x, y) (fractional allowed) is drawn: foot, width, height
  figure(x, y, tall = 1.2) {
    const g = this.pgr, ts = g.tileDisplaySize
    const proj = g._projectLogical((x + 0.5) * ts, (y + 0.5) * ts, true)
    if (!proj) return null
    const cx = Math.round(x), cy = Math.round(y)
    const lift = (g._vertexH(cx, cy + 1) + g._vertexH(cx + 1, cy + 1)) * 0.5 * g._scaleAtRow(y + 1)
    const w = proj.scale * ts
    return { x: proj.screenX, y: proj.screenY - lift, w, h: w * tall }
  }
  playerFigure() {
    const p = this.scene.player, ts = this.scene.tileSize
    const PS = this.pgr.constructor.PLAYER_SCALE ?? 1
    return this.figure(p.logicalX / ts - 0.5, p.logicalY / ts - 0.5, (this.pgr._playerHeightMult ?? 1.8) * PS)
  }
  foeFigure() { const [x, y] = this.m.foeDrawPos(); return this.figure(x, y) }
  // screen angle from tile a to tile b (centres)
  screenAngle([ac, ar], [bc, br]) {
    const a = this.ground(ac + 0.5, ar + 0.5), b = this.ground(bc + 0.5, br + 0.5)
    return a && b ? Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI : 0
  }

  // His sword, painted WITH his billboard in PGR's depth-sorted pass (meleeBout sets flag.draw), so it sorts against you like any
  // figure: behind you when you are nearer the camera, in front when he is. ff: his box {x, y (feet), w, h}; PGR has already applied
  // his body pose. Out of a bout it's in his scabbard; when a bout starts he draws it (slid clear, then up) before his salute, and
  // after the closing salute he puts it away again. In a bout it's in the hand on your side of him. Same rig as yours (swordRig.js).
  foeSword(ctx, ff) {
    const m = this.m, foe = m.foe, t = m.t
    if (!ff || m.noFoe || !(foe.hp > 0 || m.F.steady) || foe.state === 'beaten') return
    const pf = this.playerFigure()
    const now = this.now(), A = this.a
    const fs = pf && pf.x < ff.x ? -1 : 1
    const drawnNow = m.combat || m.bout.over || foe.state === 'salute' || !!m.foeReady    // foeReady: held out, a drill
    if (drawnNow !== A.foeDrawn) { A.foeDrawn = drawnNow; if (drawnNow) A.foeDrawT = now; else A.foeSheatheT = now }
    const aim = foe.target ? this.screenAngle([foe.c, foe.r], foe.target) : this.screenAngle([foe.c, foe.r], m.pa.tile())
    const raised = -90 + Math.max(-45, Math.min(45, ((aim + 90 + 540) % 360) - 180)) * 0.5
    const R = rig(fs, FOE_PS)
    let pose = null
    if (!foe.armed) pose = 'none'                                                 // it's in the grass, or in your hand
    else if (!drawnNow) {
      const ke = (now - A.foeSheatheT) / SHEATHE_MS
      if (ke < 0.55) { const k = easeOut(ke / 0.55), e = R.gripAt(1); pose = { angle: lerp(raised, R.axisDeg + fs * 360, k), hand: [e[0] * k, e[1] * k] } }
      else if (ke < 1) pose = { sheath: 1 - easeIO((ke - 0.55) / 0.45) }
      else pose = null                                                            // sheathed
    } else if (now - A.foeDrawT < DRAW_MS) {
      const kg = (now - A.foeDrawT) / DRAW_MS
      if (kg < 0.35) pose = { sheath: easeOut(kg / 0.35) }
      else { const k = easeOut((kg - 0.35) / 0.65), st = R.gripAt(1); pose = { angle: lerp(R.axisDeg, raised - fs * 360, k), hand: [st[0] * (1 - k), st[1] * (1 - k)] } }
    } else {
      let ang
      if (foe.state === 'wind') {                                                // the tile is red: the blade comes up and back to the cutting position
        const tgt = aim + 150 * fs, k = easeOut(clamp01((t - foe.st0) / Math.max(1, (foe.until - foe.st0) * 0.5)))
        ang = raised + wrap180(tgt - raised) * k
      }
      else if (foe.state === 'strike') ang = this.swingAngle(aim, 0.4 + 0.6 * Math.min(1, (t - foe.st0) / m.F.strikeMs), false)
      else if (foe.state === 'recover' && foe.follow) {                           // the cut carried through, held a moment, then back to guard
        const end = this.swingAngle(aim, 1, false), k = clamp01((t - foe.st0) / Math.max(1, foe.until - foe.st0))
        ang = end + wrap180(raised - end) * easeIO(clamp01((k - 0.3) / 0.5))
      }
      else if (foe.state === 'recover' || foe.state === 'stagger') ang = 90 + fs * 30   // dropped: open
      else if (foe.state === 'reel') ang = m.foeGuard ? this._parryAngle(foe, raised) : aim + 120 * fs   // turned aside; as a target, a parry
      else if (foe.state === 'salute') ang = this._saluteAngle(now - A.foeSaluteT, fs, raised)
      else if (foe.state === 'down') ang = 90 + fs * 60                           // on the ground with him
      else ang = m.combat || m.foeGuard ? raised : 90 + fs * 20
      const pk = (now - A.foeParryT) / 260                                          // turning your blow aside
      if (pk >= 0 && pk < 1) ang = this._cross(raised, fs, pk, A.foeParryHigh)
      const sh = foe.state === 'salute' ? this._saluteHand(now - A.foeSaluteT, fs, 0.9, 0.42) : [0, 0]
      pose = { angle: ang, hand: [sh[0] * ff.h / ff.w, sh[1] * ff.h / ff.w] }      // the rig takes the hand in tile widths
    }
    const img = this.scene.itemSheet?.getCanvas?.(m.F.swordGid || 2492)
    if (pose !== 'none' && img) drawHeldSword(ctx, img, { x: ff.x, y: ff.y, w: ff.w, ps: FOE_PS, side: fs, pose })
  }

  // focus: the edges of the screen darken and cool, in step with how slow time is
  focusVeil(ctx) {
    const m = this.m, W = ctx.canvas.width, H = ctx.canvas.height
    const u = Math.min(1, (1 - m.focusK) / 0.82)
    const g = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.25, W / 2, H * 0.55, Math.hypot(W, H) * 0.6)
    g.addColorStop(0, 'rgba(6,14,34,0)'); g.addColorStop(1, `rgba(6,14,34,${0.85 * u})`)
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = `rgba(30,60,120,${0.12 * u})`; ctx.fillRect(0, 0, W, H)           // a cool wash over everything
  }

  // ── events from the fight ────────────────────────────────────────────────
  onEvent(name, d = {}) {
    const buzz = ms => { try { navigator.vibrate?.(ms) } catch (_) {} }, A = this.a, now = this.now()
    if (['swing', 'chargeStart', 'enGarde', 'atEase'].includes(name)) A.idleSince = now
    switch (name) {
      case 'swing': buzz(d.flip ? 7 : 12); break
      case 'enGarde': A.garde = now; A.nextFlourish = now + 5000 + Math.random() * 4000; break
      case 'atEase': A.ease = now; break
      case 'salute': if (d.by === 'player') A.salute = now; break   // yours only when you choose to (swipe up again)
      case 'knockdown': if (d.steady) break; if (d.who === 'player') A.fall = now; else A.foeFall = now; buzz(60); break
      case 'rise': if (d.who === 'player') A.rise = now; else A.foeRise = now; break
      case 'parried':
        A.crossHigh = !A.crossHigh                                       // the exchange alternates: crossing high, crossing low
        if (this.sparky) { this._spray('both', '255,230,140', 12); (this.clangs = this.clangs || []).push({ t0: now, rot: Math.random() }) }
        if (d.by === 'player') { A.pParryT = now; A.pParryHigh = A.crossHigh }
        else if (!this.m.foeGuard) { A.foeParryT = now; A.foeParryHigh = A.crossHigh }
        break
      case 'clash':
        A.crossHigh = !A.crossHigh
        A.pParryT = A.foeParryT = now; A.pParryHigh = A.foeParryHigh = A.crossHigh      // both blades meet at the same height
        if (this.sparky) { this._spray('both', '255,240,180', 14); (this.clangs = this.clangs || []).push({ t0: now, rot: Math.random() }) }
        break
      case 'hit':
        buzz(d.on === 'player' ? 45 : d.desperate ? 45 : 25)
        if (d.on === 'player') A.hurt = now; else A.foeHurt = now
        this._spray(d.on, d.on === 'player' ? '240,120,100' : d.desperate || d.charged ? '255,210,90' : '240,225,190')
        this._float(d.on, '−' + d.dmg, d.on === 'player' ? '#ff8a7a' : '#f5d060')
        if (d.on === 'player') this.flash = 1
        break
      case 'shove': if (d.by === 'foe') { A.foeShoveT = now; A.foeShoveDir = d.dir || [0, 0]; buzz(40); break }   // his shoulder: a slide (a throw shows in the knockdown too)
        A.shove = now; A.shoveDir = d.dir; buzz(30); if (!d.down) A.foeHurt = now; break
      case 'spent': this._float('player', 'tuirse', '#9fb7c4'); break
      case 'dodge': buzz(10); this._spray('player', '160,220,240', 6); this._float('player', 'seachain', '#bfefff'); break
      case 'float': this._float(d.who, d.text, d.color); break
      case 'dash': A.foeDashT = now; this._dashFx(d); break
    }
  }
  // he zooms off: a cloud of dust where he stood, speed lines along the way, dust where he lands
  _dashFx(d) {
    try {
      const sc = this.scene, b0 = figureBox(sc, d.from[0], d.from[1]), b1 = figureBox(sc, d.to[0], d.to[1])
      if (!b0 || !b1) return
      const dx = b1.x - b0.x, dy = b1.y - b0.y, mg = Math.hypot(dx, dy) || 1, ux = dx / mg, uy = dy / mg
      whoosh(sc, 0.2, 0.28)
      speedLines(sc, b0, ux, uy)
      dustPuff(sc, b0, -ux * 0.6, 12)
      setTimeout(() => { try { dustPuff(sc, b1, ux * 0.7, 8) } catch (_) {} }, 170)
    } catch (_) {}
  }
  _anchor(who) {
    const f = who === 'player' ? this.playerFigure() : this.foeFigure()
    return f ? [f.x, f.y - f.h * 0.55, f.w] : null
  }
  _spray(who, rgb, n = 9) {
    const at = who === 'both'
      ? (() => { const a = this._anchor('player'), b = this._anchor('foe'); return a && b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, a[2]] : null })()
      : this._anchor(who)
    if (!at) return
    const sp0 = Math.max(40, at[2] * 3)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = sp0 * (0.5 + Math.random())
      this.sparks.push({ x: at[0], y: at[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, rgb })
    }
  }
  _float(who, text, color = '#f5d060') {
    const at = this._anchor(who)
    if (at) this.floats.push({ x: at[0], y: at[1] - at[2] * 0.6, text, color, life: 1 })
  }

  // ── drawing ──────────────────────────────────────────────────────────────
  tileQuad(ctx, [c, r], fill, stroke, lw = 2) {
    const pts = [this.ground(c, r), this.ground(c + 1, r), this.ground(c + 1, r + 1), this.ground(c, r + 1)]
    if (pts.some(p => !p)) return
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath()
    if (fill) { ctx.fillStyle = fill; ctx.fill() }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke() }
  }
  blade(ctx, [x, y], dirDeg, from, len, col, w = 3) {
    ctx.beginPath(); ctx.moveTo(x + Math.cos(rad(dirDeg)) * from, y + Math.sin(rad(dirDeg)) * from)
    ctx.lineTo(x + Math.cos(rad(dirDeg)) * len, y + Math.sin(rad(dirDeg)) * len)
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke()
  }
  // The sword itself (the equipped item's art, the Oryx short sword for
  // now), held by the grip at hand = [x, y], pointing angDeg (screen; -90 up).
  // Same drawing as PGR's weapon overlay, so his sword and yours match.
  sword(ctx, [x, y], angDeg, tileW) {
    const img = this.scene.itemSheet?.getCanvas?.(2492)
    if (!img) return
    const s = tileW * SWORD_SCALE / img.width, gx = img.width * 0.75, gy = img.height * 0.75
    ctx.save(); ctx.translate(x, y); ctx.rotate(rad(angDeg + 135))
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, -gx * s, -gy * s, img.width * s, img.height * s)
    ctx.restore()
  }
  // where the blade points k of the way through a cut toward dir: the arc is swept on the ground, then seen from the camera
  swingAngle(dir, k, flip) {
    const arc = flip ? 42 : 60, pos = swingPos(clamp01(k)), g = this._unsquash(dir, CUT_SQ)
    return this._squash(flip ? g + arc - 2 * arc * pos : g - arc + 2 * arc * pos, CUT_SQ)
  }
  // the crescent a cut leaves in the air (a flat ellipse of ground, in perspective); with blade false, only the smear
  // (the real sword is drawn by whoever holds it)
  swingArc(ctx, p, dir, k, reach, flip, blade = true) {
    const arc = flip ? 42 : 60, g = this._unsquash(dir, CUT_SQ), at = q => flip ? g + arc - 2 * arc * q : g - arc + 2 * arc * q
    const pt = (q, r) => { const a = rad(at(q)); return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r * CUT_SQ] }
    const pos = swingPos(k), sp = Math.abs(swingPos(Math.min(1, k + 0.012)) - swingPos(Math.max(0, k - 0.012))) / 0.024
    const fade = 1 - Math.max(0, (k - 0.72) / 0.28), trail = Math.min(0.8, sp * 0.055)
    if (trail > 0.1) {
      const N = 16, outer = [], inner = []
      for (let i = 0; i <= N; i++) {
        const u = i / N, q = pos - trail * (1 - u), ro = reach * (0.86 + 0.14 * u), th = reach * 0.3 * Math.sin(Math.PI * Math.pow(u, 0.7))
        outer.push(pt(q, ro)); inner.push(pt(q, ro - th))
      }
      const al = Math.min(1, sp / 7) * fade
      ctx.beginPath(); outer.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); inner.reverse().forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath()
      ctx.fillStyle = `rgba(245,232,200,${0.3 * al})`; ctx.fill()
    }
    if (blade) this.blade(ctx, p, this._squash(at(pos), CUT_SQ), reach * 0.15, reach, `rgba(214,178,118,${0.3 + 0.7 * fade})`)
  }
  // a full turn at speed: a tight, bright crescent behind the blade, on an ellipse squashed into perspective
  spinSmear(ctx, c, dir, k, reach) {
    const s = spinS(k), N = 36
    const alpha = Math.min(1, k / 0.06) * (1 - Math.max(0, (k - 0.8) / 0.2))
    if (s <= 0.005 || alpha <= 0) return
    const trail = Math.min(s, 0.55)
    const pt = (q, r) => { const a = rad(dir + SPIN_FROM + 360 * q); return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r * SQ] }
    const outer = [], inner = []
    for (let i = 0; i <= N; i++) {
      const u = i / N, q = s - trail * (1 - u), ro = reach * (0.94 + 0.06 * u), th = reach * 0.34 * Math.pow(u, 1.3)
      outer.push(pt(q, ro)); inner.push(pt(q, ro - th))
    }
    ctx.beginPath(); outer.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); inner.slice().reverse().forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath()
    ctx.fillStyle = `rgba(245,232,200,${0.42 * alpha})`; ctx.fill()
    ctx.beginPath(); outer.slice(Math.floor(N * 0.4)).forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
    ctx.strokeStyle = `rgba(255,250,235,${0.8 * alpha})`; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke()
  }
  hearts(ctx, x, y, n, of, size, desperate = false) {
    const gap = size * 1.25, x0 = x - of * gap / 2, t = performance.now()
    for (let i = 0; i < of; i++) {
      const cx = x0 + i * gap + size / 2, s = size / 2
      ctx.beginPath(); ctx.moveTo(cx, y + s * 0.9)
      ctx.bezierCurveTo(cx - s * 1.4, y - s * 0.1, cx - s * 0.6, y - s * 1.1, cx, y - s * 0.35)
      ctx.bezierCurveTo(cx + s * 0.6, y - s * 1.1, cx + s * 1.4, y - s * 0.1, cx, y + s * 0.9)
      const lit = i < n
      ctx.fillStyle = lit ? (desperate ? `rgba(255,70,50,${0.6 + 0.4 * Math.sin(t / 110)})` : '#e0443a') : 'rgba(255,255,255,0.15)'
      ctx.fill()
    }
  }
  pips(ctx, x, y, breath, of, hp, winded, r = 3.2) {
    const gap = r * 2.8, x0 = x - (of - 1) * gap / 2
    for (let i = 0; i < of; i++) {
      const cx = x0 + i * gap, k = Math.max(0, Math.min(1, breath - i))
      ctx.beginPath(); ctx.arc(cx, y, r, 0, Math.PI * 2)
      if (i >= hp) { ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.stroke(); continue }
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill()
      if (k > 0) { ctx.beginPath(); ctx.arc(cx, y, r * (0.35 + 0.65 * k), 0, Math.PI * 2); ctx.fillStyle = winded ? '#6f8794' : '#e9d98a'; ctx.fill() }
    }
  }

  draw(ctx, dtMs = 16) {
    const m = this.m, foe = m.foe, t = m.t, s = dtMs / 1000
    if (!this.pgr) return
    ctx.save()
    if (m.focusK < 0.97) this.focusVeil(ctx)

    // your target: a quiet gold outline
    if (m.combat) this.tileQuad(ctx, m.targetTile(), null, 'rgba(245,208,96,0.6)', 1.5)
    // their target: red, deepening through the wind-up
    if (foe.state === 'wind' || foe.state === 'strike') {
      const k = foe.state === 'strike' ? 1 : Math.min(1, (t - foe.st0) / Math.max(1, foe.wind))
      for (const tg of foe.targets) this.tileQuad(ctx, tg, `rgba(220,60,50,${0.12 + 0.35 * k})`, `rgba(255,90,70,${0.4 + 0.6 * k})`)
    }

    const ff = this.foeFigure(), pf = this.playerFigure()
    // (his sword is painted with his billboard -- foeSword, from flag.draw -- so it sorts against you; here only the smear of his cut)
    if (ff && !m.noFoe && (foe.hp > 0 || m.F.steady) && foe.state === 'strike' && foe.armed && this.a.foeDrawn && this.now() - this.a.foeDrawT >= DRAW_MS) {
      const fs = pf && pf.x < ff.x ? -1 : 1
      const hand = [ff.x + fs * ff.w * 0.14, ff.y - ff.h * 0.42]
      const aim = foe.target ? this.screenAngle([foe.c, foe.r], foe.target) : this.screenAngle([foe.c, foe.r], m.pa.tile())
      this.swingArc(ctx, hand, aim, 0.4 + 0.6 * Math.min(1, (t - foe.st0) / m.F.strikeMs), ff.w * 1.1, false, false)
    }
    // his sword: flying, spinning, from his hand to where it lands -- then lying in the grass
    if (m.dropped) {
      const d = m.dropped, k = clamp01((t - d.t0) / d.ms)
      const at = (c, r) => this.ground(c + 0.5, r + 0.5)
      const a = at(...d.from), b = at(d.c, d.r)
      if (a && b) {
        const tw = this.pgr._scaleAtRow(d.r + 0.5)
        if (k < 1) {
          const hgt = Math.sin(Math.PI * k) * tw * 1.6 + (1 - k) * tw * 0.6        // up out of his hand, down into the grass
          const x = lerp(a[0], b[0], k), y = lerp(a[1], b[1], k) - hgt
          this.sword(ctx, [x, y], 720 * k * (d.c >= d.from[0] ? 1 : -1), tw)
        } else {
          ctx.save(); ctx.translate(b[0], b[1]); ctx.scale(1, 0.45)                 // flat on the ground, foreshortened
          this.sword(ctx, [0, 0], d.c >= d.from[0] ? 20 : 160, tw)
          ctx.restore()
        }
      }
    }
    // carrying his: in your other hand, point down
    if (m.carrying && pf) {
      const side = this.side(), PS = this.pgr.constructor.PLAYER_SCALE ?? 1
      this.sword(ctx, [pf.x - side * pf.w * 0.22 * PS, pf.y - pf.h * 0.38], 90 - side * 12, pf.w * PS)
    }
    // your cut: the smear only -- PGR draws your sword, posed by weaponPose()
    if (m.swing && pf) {
      const k = Math.max(0, Math.min(1, (t - m.swing.t0) / m.swing.vis))
      const sdir = this.screenAngle(m.pa.tile(), m.swing.tile)
      if (m.swing.charged) this.spinSmear(ctx, [pf.x, pf.y - pf.h * 0.4], sdir, k, pf.w * 0.95)      // a full turn: a ring round you
      else this.swingArc(ctx, this.playerHand(pf), sdir, k, pf.w * 1.15, m.swing.flip, false)
    }
    this._drawClangs(ctx, pf, ff)
    // the charge: a ring round your feet, white and pulsing when full
    if (m.charge && pf) {
      const k = m.chargeK(), full = k >= 1
      ctx.beginPath(); ctx.ellipse(pf.x, pf.y, pf.w * 0.75, pf.w * 0.3, 0, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * k)
      ctx.strokeStyle = full ? `rgba(255,250,235,${0.6 + 0.4 * Math.sin(performance.now() / 70)})` : 'rgba(245,208,96,0.9)'
      ctx.lineWidth = full ? 4 : 3; ctx.lineCap = 'round'; ctx.stroke()
    }
    // hearts over the foe while it matters
    if (SHOW_HUD && ff && !m.noFoe && (m.combat || m.bout.over || foe.hp < m.foeMax())) this.hearts(ctx, ff.x, ff.y - ff.h - 8, foe.hp, m.foeMax(), Math.max(6, ff.w * 0.16))
    // yours, and your breath, under your feet while en garde (over your head
    // they'd collide with his: he's usually the figure just beyond you)
    if (SHOW_HUD && pf && m.enGarde && (m.combat || m.bout.over)) {
      const p = this.scene.player, hy = pf.y + Math.max(9, pf.w * 0.22)
      this.hearts(ctx, pf.x, hy, p.currentHP, p.maxHP, Math.max(7, pf.w * 0.17), m.desperate())
      this.pips(ctx, pf.x, hy + Math.max(10, pf.w * 0.2), m.breath, p.maxHP, p.currentHP, m.winded())
    }
    // the exchange count, while one is going
    if (m.exchange >= 2 && ff && pf) {
      ctx.font = 'bold 14px "Courier Prime", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#bfefff'
      ctx.fillText('× ' + m.exchange, (ff.x + pf.x) / 2 + pf.w, (ff.y + pf.y) / 2 - pf.h * 0.5)
    }

    for (const p of this.sparks) { p.x += p.vx * s; p.y += p.vy * s; p.vx *= 0.9; p.vy *= 0.9; p.life -= s * 1.7 }
    for (const f of this.floats) { f.y -= 30 * s; f.life -= s * 1.3 }
    this.sparks = this.sparks.filter(p => p.life > 0)
    this.floats = this.floats.filter(f => f.life > 0)
    for (const p of this.sparks) { ctx.fillStyle = `rgba(${p.rgb},${p.life})`; ctx.fillRect(p.x - 2, p.y - 1, 4, 2) }
    ctx.textAlign = 'center'; ctx.font = 'bold 16px "Courier Prime", monospace'
    for (const f of this.floats) {
      ctx.globalAlpha = Math.max(0, f.life); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'
      ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); ctx.globalAlpha = 1
    }
    // struck: the edges go red for a moment
    if (this.flash > 0) {
      const W = ctx.canvas.width, H = ctx.canvas.height, e = Math.min(W, H) * 0.2
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.5 - e, W / 2, H / 2, Math.max(W, H) * 0.75)
      g.addColorStop(0, 'rgba(170,20,15,0)'); g.addColorStop(1, `rgba(170,20,15,${0.45 * this.flash})`)
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      this.flash = Math.max(0, this.flash - s * 3)
    }
    ctx.restore()
  }

  // a parry as the blades cross: from the guard toward the other fighter, high (blade up) or low (blade down)
  _cross(from, side, k, high) {
    const to = side > 0 ? (high ? -50 : 55) : (high ? -130 : 125)
    const out = k < 0.22 ? easeOut(k / 0.22) : 1 - easeIO((k - 0.22) / 0.78)
    return from + wrap180(to - from) * out
  }
  // a parry's sweep: the blade from its guard across toward the other, and back (k 0..1)
  _sweep(base, side, k, deg) {
    const out = k < 0.25 ? easeOut(k / 0.25) : 1 - easeIO((k - 0.25) / 0.75)
    return base + side * deg * out
  }
  // where the blades meet: a flash of crossing lines
  _drawClangs(ctx, pf, ff) {
    const now = this.now()
    this.clangs = (this.clangs || []).filter(c => now - c.t0 < 240)
    if (!pf || !ff || !this.clangs.length) return
    const fs = pf.x < ff.x ? -1 : 1
    const a = this.playerHand(pf), b = [ff.x + fs * ff.w * 0.14, ff.y - ff.h * 0.42]
    const x = a[0] * 0.4 + b[0] * 0.6, y = a[1] * 0.4 + b[1] * 0.6 - ff.h * 0.08
    for (const c of this.clangs) {
      const k = (now - c.t0) / 240, r = ff.w * (0.18 + 0.32 * easeOut(k)), al = 1 - k
      ctx.save(); ctx.translate(x, y); ctx.rotate(c.rot); ctx.lineCap = 'round'
      ctx.strokeStyle = `rgba(255,248,215,${al})`; ctx.lineWidth = 3 * al + 1
      for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(r * 0.35, 0); ctx.lineTo(r, 0); ctx.stroke() }
      ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,236,170,${0.7 * al})`; ctx.fill()
      ctx.restore()
    }
  }

  // a screen angle on the squashed circle of the spin
  _squash(deg, q = SQ) { const a = rad(deg); return Math.atan2(q * Math.sin(a), Math.cos(a)) * 180 / Math.PI }
  _unsquash(deg, q = SQ) { const a = rad(deg); return Math.atan2(Math.sin(a) / q, Math.cos(a)) * 180 / Math.PI }
  // The spin turns you through the four views, fast: PGR asks the scene for it ({ away, left }), null when not spinning.
  spinFacing() {
    const m = this.m, A = this.a
    if (!m.swing?.charged) { A.spinT0 = null; return null }
    if (A.spinT0 !== m.swing.t0) {                                  // the first frame: from the way you were looking
      A.spinT0 = m.swing.t0
      const g = this.pgr, a = !!g?._facingAway, l = !!g?._facingLeft
      A.spinFrom = Math.max(0, SPIN_VIEWS.findIndex(v => v[0] === a && v[1] === l))
    }
    const k = clamp01((m.t - m.swing.t0) / m.swing.vis)
    const n = Math.floor(spinS(k) * 4 * SPIN_TURNS + 1e-6)          // whole turns end where they began
    const v = SPIN_VIEWS[(A.spinFrom + n) % 4]
    return { away: v[0], left: v[1] }
  }
  // As his target: the blade sweeps across, side to side with each parry; narrow for a shoulder, wide for a strong blow.
  _parryAngle(foe, raised) {
    const A = this.a, m = this.m
    if (A.parryT !== foe.st0) { A.parryT = foe.st0; A.parrySide = -A.parrySide }
    const ms = Math.max(1, foe.until - foe.st0), k = clamp01((m.t - foe.st0) / ms)
    const reach = ms > 500 ? 85 : ms < 300 ? 25 : 62
    const out = k < 0.22 ? easeOut(k / 0.22) : 1 - easeIO((k - 0.22) / 0.78)
    return raised + A.parrySide * reach * out
  }

  // a tile direction as a screen offset, in tile widths (for a figure sliding toward its next square)
  _tileVec([c, r], [a, b], w) {
    const p0 = this.ground(c + 0.5, r + 0.5), p1 = this.ground(c + 0.5 + a, r + 0.5 + b)
    return p0 && p1 && w ? [(p1[0] - p0[0]) / w, (p1[1] - p0[1]) / w] : [a * 0.5, 0]
  }
  // a lean back as he gathers himself to lunge (the course tells it, in ms)
  foeTell(ms) { this.a.tellT0 = this.now(); this.a.tellMs = ms }

  // The sword hand, as PGR's weapon overlay places it.
  playerHand(pf = this.playerFigure()) {
    const PS = this.pgr.constructor.PLAYER_SCALE ?? 1, side = this.pgr._facingLeft ? -1 : 1
    return [pf.x + side * pf.w * 0.2 * PS, pf.y - pf.h * 0.4]
  }
  // the same transform PGR applies to a posed figure, about its feet
  applyPose(ctx, x, y, pose, w) {
    ctx.translate(x + (pose.dx || 0) * w, y + (pose.dy || 0) * w)
    if (pose.rot) ctx.rotate(pose.rot)
    if (pose.sx || pose.sy) ctx.scale(pose.sx || 1, pose.sy || 1)
    ctx.translate(-x, -y)
  }
  // A salute, in steps (ms since it began; side = the sword hand's side;
  // guard = the angle to finish on):
  //   hilt to the forehead, blade upright -- a moment, head bowed --
  //   the sword raised high overhead -- swept down and out to the side,
  //   point to the ground -- held -- and back to guard.
  _saluteAngle(ms, side, guard = -90) {
    const k = ms / SALUTE_MS, low = 90 + side * 50
    if (k < 0.18) return lerp(90 + side * 20, -90, easeOut(k / 0.18))
    if (k < 0.52) return -90 + side * 6 * easeOut((k - 0.38) / 0.14) * (k > 0.38)
    if (k < 0.62) return -90 + side * 6
    if (k < 0.74) return lerp(-90 + side * 6, low, easeIO((k - 0.62) / 0.12))
    if (k < 0.88) return low
    return lerp(low, guard, easeOut((k - 0.88) / 0.12))
  }
  // The hand's offset from where it rests, as fractions of the figure's drawn
  // height. head: how far up its box the top of the head is (the champion
  // sprites have room above them: ~0.56; the Skye figures fill theirs: ~0.9);
  // rest: how far up the hand rests. The brow is just under the top of the
  // head; an arm raised overhead puts the hand a quarter-head above it.
  _saluteHand(ms, side, head = 0.56, rest = 0.4) {
    const k = ms / SALUTE_MS
    const forehead = [-side * 0.09 * head, -(head * 0.9 - rest)], aloft = [side * 0.05 * head, -(head * 1.12 - rest)]
    const out = [side * 0.22 * head, 0.02], restAt = [0, 0]
    const mix = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)]
    if (k < 0.18) return mix(restAt, forehead, easeOut(k / 0.18))
    if (k < 0.38) return forehead
    if (k < 0.52) return mix(forehead, aloft, easeOut((k - 0.38) / 0.14))
    if (k < 0.62) return aloft
    if (k < 0.74) return mix(aloft, out, easeIO((k - 0.62) / 0.12))
    if (k < 0.88) return out
    return mix(out, restAt, easeOut((k - 0.88) / 0.12))
  }
  saluting(start) { const ms = this.now() - start; return ms >= 0 && ms < SALUTE_MS }

  // How your body stands this frame (PGR asks, through the scene), as a
  // transform about your feet: { dx, dy } in tile widths, rot in radians,
  // sx/sy scale. null when there's nothing to add.
  playerPose() {
    const m = this.m, A = this.a, now = this.now(), side = this.side()
    const pose = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 }
    let any = false
    // knocked down: over onto your side, then back up
    if (m.p.downUntil > m.t || now - A.rise < 350) {
      const kf = easeOut((now - A.fall) / 260), kr = m.p.downUntil > m.t ? 0 : easeOut((now - A.rise) / 350)
      const k = kf * (1 - kr)
      pose.rot = -side * 1.45 * k; pose.dy = 0.02 * k; return pose
    }
    if (m.enGarde || now - A.ease < SHEATHE_MS) {
      any = true
      // going en garde: up on the toes, then down into a crouch
      const kg = (now - A.garde) / DRAW_MS, ke = (now - A.ease) / SHEATHE_MS
      let crouch = m.enGarde ? (kg < 1 ? (kg < 0.35 ? -0.6 * Math.sin(Math.PI * kg / 0.35) : easeOut((kg - 0.35) / 0.65)) : 1) : 1 - easeOut(ke)
      if (m.charge) crouch += 0.6 * m.chargeK()
      pose.sy = 1 - 0.06 * crouch; pose.sx = 1 + 0.04 * Math.max(0, crouch)
      // footwork: a boxer's bounce in a bout, a slow settle of weight out of one
      if (m.enGarde && !m.charge) {
        const bout = m.combat, per = bout ? 420 : 1600
        pose.dy -= (bout ? 0.035 : 0.012) * Math.abs(Math.sin(Math.PI * now / per))
        pose.dx += (bout ? 0.03 : 0.015) * Math.sin(Math.PI * now / (per * 2))
      }
      if (m.charge) pose.rot += -side * 0.07 * m.chargeK()          // drawn back, coiled
    }
    // into the cut: lean and step toward it, the body following the blade
    if (m.swing) {
      any = true
      const k = clamp01((m.t - m.swing.t0) / m.swing.vis), push = Math.sin(Math.PI * k)
      if (m.swing.charged) {
        // the spin: the body turns through its four views (spinFacing), here only a lean into it and a lift
        A.spinSeen = now
        pose.dy -= 0.05 * push; pose.sy *= 1 - 0.03 * push
        pose.rot += side * 0.08 * Math.sin(Math.PI * k)
      } else {
        const dir = rad(this.screenAngle(m.pa.tile(), m.swing.tile)), big = m.swing.flip ? 0.6 : 1
        pose.rot += Math.cos(dir) * 0.13 * push * big
        pose.dx += Math.cos(dir) * 0.07 * push * big
      }
    }
    // turning his blow aside: a step into it
    if (now - A.pParryT < 260) {
      any = true
      const k = Math.sin(Math.PI * (now - A.pParryT) / 260), toward = this.foeSide() > 0 ? 1 : -1
      pose.dx += toward * 0.06 * k; pose.rot += toward * 0.1 * k; pose.sy *= 1 - 0.03 * k
    }
    // after the spin: the body's own weight carries it past upright, and it settles
    const ur = (now - A.spinSeen) / 340
    if (!m.swing && ur >= 0 && ur < 1) {
      any = true
      const d = 1 - ur, w = Math.cos(ur * Math.PI * 2.2)
      pose.rot += side * 0.16 * d * w; pose.dx += side * 0.03 * d * w
      pose.sy *= 1 - 0.07 * Math.sin(Math.PI * Math.min(1, ur * 1.5))               // dipping to take the momentum
    }
    // a shove: lean and slide hard to the front edge of your square, then back
    if (now - A.shove < 380) {
      any = true
      const u = (now - A.shove) / 380, s = u < 0.3 ? easeOut(u / 0.3) : 1 - easeIO((u - 0.3) / 0.7)
      const sx = Math.sign(A.shoveDir[0]) || (this.foeSide() > 0 ? 1 : -1), pf = this.playerFigure()
      const [vx, vy] = this._tileVec(this.m.pa.tile(), A.shoveDir, pf?.w)
      pose.dx += vx * 0.5 * s; pose.dy += vy * 0.5 * s
      pose.rot += sx * 0.22 * s; pose.sy *= 1 - 0.06 * s
    }
    // struck: thrown back from the blow
    if (now - A.hurt < 300) {
      any = true
      const k = 1 - (now - A.hurt) / 300, away = this.foeSide() > 0 ? -1 : 1   // he's that side: you go the other
      pose.rot += away * 0.2 * k; pose.dx += away * 0.05 * k
    }
    // short of breath: the chest heaves
    const bs = m.breathState()                                      // the chest heaves; an all-out gasp heaves harder
    if (bs) { any = true; pose.sy *= 1 - (bs === 'gasp' ? 0.03 : 0.015) * (1 + Math.sin(now / (bs === 'gasp' ? 130 : 95))) }
    // a salute: a small bow of the head and shoulders
    if (this.saluting(A.salute) && m.enGarde) {
      any = true
      const k = (now - A.salute) / SALUTE_MS, tall = Math.sin(Math.PI * Math.min(1, k / 0.9))
      pose.sy = lerp(pose.sy, 1.0, tall); pose.sx = lerp(pose.sx, 1.0, tall)        // out of the crouch, standing straight
      if (k > 0.18 && k < 0.38) pose.sy *= 1 - 0.03 * Math.sin(Math.PI * (k - 0.18) / 0.2)   // the bow
      pose.dx = lerp(pose.dx, 0, tall); pose.dy = lerp(pose.dy, 0, tall)
    }
    return any ? pose : null
  }

  // The foe's body, the same way: written onto his PGR flag each frame.
  foePose() {
    const m = this.m, foe = m.foe, A = this.a, now = this.now(), fs = this.foeSide()
    const pose = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 }
    if (foe.state === 'salute' && this.a.foeSaluteState !== foe.st0) {
      this.a.foeSaluteState = foe.st0
      this.a.foeSaluteT = this.a.foeDrawn ? now : now + DRAW_MS                    // sheathed: he draws first
    }
    // stooping for his sword; a nod as he straightens with it
    if (foe.state === 'pickup') { const k = easeOut((m.t - foe.st0) / 300); pose.sy = lerp(1, 0.72, k); pose.rot = fs * 0.15 * k; return pose }
    if (now - (A.foeDashT || -1e9) < 230) { pose.sx = 0.78; pose.sy = 1.22; pose.rot = fs * -0.12; return pose }      // the zoom: stretched along the way
    if (foe.state === 'nod') { const len = Math.max(700, foe.until - foe.st0), k = clamp01((m.t - foe.st0) / len); pose.sy = 1 - (len > 1000 ? 0.12 : 0.04) * Math.sin(Math.PI * k); return pose }   // the long one is his bow
    // down: over, away from you
    if (foe.state === 'down' || foe.state === 'beaten') {
      const k = easeOut((now - A.foeFall) / 260)
      if ((foe.state === 'beaten' || foe.shamed) && now - A.foeFall > 1300) {        // up on one knee, waiting
        const kk = easeOut((now - A.foeFall - 1300) / 400)
        pose.rot = lerp(-fs * 1.45, 0, kk); pose.sy = lerp(1, 0.72, kk)
      } else pose.rot = -fs * 1.45 * k
      return pose
    }
    if (now - A.foeRise < 350) { const k = 1 - easeOut((now - A.foeRise) / 350); pose.rot = -fs * 1.45 * k; return pose }
    // after he was struck without his sword: head down, shoulders low, all the way home
    if (foe.shamed && !m.combat) { pose.sy = 0.92; pose.rot = fs * 0.05; return pose }
    // disarmed: arms out, wary, a little crouched
    if (foe.state === 'unarmed') { pose.sy = 0.94; pose.sx = 1.05 }
    if (m.combat || m.foeGuard || foe.state === 'salute') {
      pose.sy = 0.95; pose.sx = 1.03                                  // his guard: low and wide
      const per = 470
      pose.dy -= 0.03 * Math.abs(Math.sin(Math.PI * (now + 170) / per))
      pose.dx += 0.025 * Math.sin(Math.PI * (now + 170) / (per * 2))
    }
    const k = clamp01((m.t - foe.st0) / Math.max(1, foe.until - foe.st0))
    if (foe.state === 'wind') { pose.rot += -fs * 0.1 * easeOut(k); pose.sy *= 0.97 }     // drawing back
    else if (foe.state === 'strike') { pose.rot += fs * 0.13; pose.dx += fs * 0.08 }     // into it
    else if (foe.state === 'recover' || foe.state === 'stagger') { pose.rot += fs * 0.06; pose.sy *= 0.95 }   // overcommitted
    else if (foe.state === 'reel') pose.rot += -fs * 0.12 * (1 - k)
    else if (foe.state === 'salute') {
      const kk = (now - this.a.foeSaluteT) / SALUTE_MS
      pose.sy = 1; pose.sx = 1; pose.dx = 0; pose.dy = 0                              // he stands straight for it
      if (kk > 0.18 && kk < 0.38) pose.sy = 1 - 0.03 * Math.sin(Math.PI * (kk - 0.18) / 0.2)
    }
    if (now - A.foeHurt < 300) { const kk = 1 - (now - A.foeHurt) / 300; pose.rot += -fs * 0.22 * kk; pose.dx += -fs * 0.05 * kk }
    // his blade met yours: a little recoil
    if (now - A.foeParryT < 260) { const kk = Math.sin(Math.PI * (now - A.foeParryT) / 260); pose.dx += -fs * 0.03 * kk; pose.rot += -fs * 0.08 * kk }
    // gathering to lunge: leaning back
    if (now - A.tellT0 < A.tellMs) { const kk = easeOut((now - A.tellT0) / Math.max(1, A.tellMs)); pose.rot += -fs * 0.12 * kk; pose.sy *= 1 - 0.04 * kk }
    // his shove: leans and slides hard to the front edge of his square, then back
    if (now - A.foeShoveT < 380) {
      const u = (now - A.foeShoveT) / 380, s = u < 0.3 ? easeOut(u / 0.3) : 1 - easeIO((u - 0.3) / 0.7), ff = this.foeFigure()
      const [vx, vy] = this._tileVec([m.foe.c, m.foe.r], A.foeShoveDir, ff?.w)
      pose.dx += vx * 0.5 * s; pose.dy += vy * 0.5 * s
      pose.rot += (Math.sign(A.foeShoveDir[0]) || fs) * 0.22 * s; pose.sy *= 1 - 0.06 * s
    }
    return pose
  }

  // How your sword is held this frame (PGR asks, through the scene):
  // at ease nothing (PGR lowers the point); en garde the point up, leaning
  // toward him; gathering a charge, drawn back over the shoulder; in a cut,
  // wherever the cut has got to.
  weaponPose() {
    const m = this.m, A = this.a, now = this.now(), side = this.side()
    const R = rig(side, this.pgr?.constructor.PLAYER_SCALE ?? 1)
    const lowered = 90 + side * 20
    const [fc, fr] = [m.foe.c, m.foe.r]
    const toFoe = this.screenAngle(m.pa.tile(), [fc, fr])
    const guard = m.combat ? -90 + Math.max(-45, Math.min(45, wrap180(toFoe + 90))) * 0.45 : -90 + side * 15
    // Putting it away: the point turned down onto the scabbard's line, the
    // hand brought to its mouth -- then the blade slid home.
    if (!m.enGarde) {
      const ke = (now - A.ease) / SHEATHE_MS
      if (ke >= 1) return null
      if (ke < 0.55) {
        const k = easeOut(ke / 0.55), end = R.gripAt(1)
        return { angle: lerp(guard, R.axisDeg + side * 360, k), hand: [end[0] * k, end[1] * k] }
      }
      return { sheath: 1 - easeIO((ke - 0.55) / 0.45) }
    }
    if (m.p.downUntil > m.t) return { angle: lowered + side * 40 }
    const pk = (now - A.pParryT) / 260                                              // turning his blow aside
    if (pk >= 0 && pk < 1 && !m.swing) return { angle: this._cross(guard, this.foeSide() > 0 ? 1 : -1, pk, A.pParryHigh), hand: [0, (A.pParryHigh ? -0.04 : 0.1) * Math.sin(Math.PI * Math.min(1, pk * 1.4))] }
    if (m.swing) {
      const k = (m.t - m.swing.t0) / m.swing.vis
      const dir = this.screenAngle(m.pa.tile(), m.swing.tile)
      // the spin: the blade right round, its hand brought in to the middle of the body
      if (m.swing.charged) return { angle: this._squash(dir + SPIN_FROM + 360 * spinS(k)), hand: [-side * 0.2 * (this.pgr?.constructor.PLAYER_SCALE ?? 1), 0] }
      return { angle: this.swingAngle(dir, k, m.swing.flip) }
    }
    if (m.charge) return { angle: -90 - side * (35 + 35 * m.chargeK()) }
    // Drawing it: the blade slid clear of the scabbard first, then swept up
    // through a full turn into guard.
    const kg = (now - A.garde) / DRAW_MS
    if (kg < 0.35) return { sheath: easeOut(kg / 0.35) }
    if (kg < 1) {
      const k = easeOut((kg - 0.35) / 0.65), start = R.gripAt(1)
      return { angle: lerp(R.axisDeg, guard - side * 360, k), hand: [start[0] * (1 - k), start[1] * (1 - k)] }
    }
    // a salute
    if (this.saluting(A.salute)) {
      const ms = now - A.salute, h = this._saluteHand(ms, side), hw = (this.pgr._playerHeightMult ?? 1.8) * (this.pgr.constructor.PLAYER_SCALE ?? 1)
      return { angle: this._saluteAngle(ms, side, guard), hand: [h[0] * hw, h[1] * hw] }     // PGR takes the hand in tile widths
    }
    if (m.winded()) return { angle: 90 - side * 30 }                            // point drooping
    // standing en garde out of a bout a while: now and then, a flourish
    if (!m.combat && !m.charge && now >= A.nextFlourish && now - A.idleSince > 3500 && !m.moving()) { A.flourish = now; A.nextFlourish = now + 6000 + Math.random() * 5000 }
    const kf = (now - A.flourish) / 650
    if (kf < 1) return { angle: guard + side * 360 * easeIO(kf) }
    return { angle: guard }
  }

  // The camera sits behind you, so a foe straight ahead is hidden by your
  // own figure. When his figure is behind yours on screen, fade yours.
  playerFade() {
    const m = this.m
    if (!m.combat) return 1                                            // only in a bout; out of one he's scenery
    const pf = this.playerFigure(), ff = this.foeFigure()
    if (!pf || !ff) return 1
    const [, fy] = m.foeDrawPos(), pRow = this.scene.player.logicalY / this.scene.tileSize - 0.5
    if (fy >= pRow) return 1                                           // he's nearer the camera: he's in front, not hidden
    const overlapX = Math.abs(ff.x - pf.x) < (pf.w + ff.w) * 0.5 * 0.7
    const overlapY = ff.y - ff.h < pf.y && ff.y > pf.y - pf.h
    return overlapX && overlapY ? 0.6 : 1
  }

  destroy() { this.sparks = []; this.floats = [] }
}

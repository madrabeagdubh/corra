// figureSword.js
// Location: js/game/combat/figureSword.js
//
// A sword on a figure that isn't fighting: a student in a drill, a teacher
// on the dais. It walks through the same motions as yours and the Warden's
// (same rig and salute: swordRig.js, meleeView.js), on cue:
//
//   const k = new FigureSword({ gid: 2492 })     2496: a bright steel one
//   k.show(now)      the scabbard appears at the hip (fades in)
//   k.draw(now)      slid clear, swept up into guard
//   k.salute(now)    hilt to the brow, blade aloft, swept down, back to guard
//   k.sheathe(now)   swept round, slid home
//   k.hide()         no sword at all
//   k.paint(ctx, scene, box, side, flagPose, now)
//       box: the figure on screen { x, y (feet), w (tile width), h }
//       side: -1 facing left, 1 right; flagPose: the figure's PGR pose
//
// opts.head / opts.rest: where the head and the hand are, as fractions of the
// figure's drawn height (champion sprites ~0.56 / 0.4; the Skye figures,
// which fill their box, ~0.9 / 0.42). opts.shine: a glint runs up the blade.

import { rig, drawHeldSword } from './swordRig.js'
import MeleeView, { SALUTE_MS, DRAW_MS, SHEATHE_MS } from './meleeView.js'

const lerp = (a, b, k) => a + (b - a) * k
const clamp01 = k => Math.max(0, Math.min(1, k))
const easeOut = k => 1 - (1 - clamp01(k)) ** 2
const easeIO = k => { k = clamp01(k); return k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2 }
const V = MeleeView.prototype                                // the salute's steps, shared

const FIG_PS = 0.7                                           // a billboard figure's scale (as the Warden's)

// A figure standing on (x, y) (fractional tiles), on screen: feet, width, height.
export function figureAt(scene, x, y) {
  const g = scene.perspectiveGround
  if (!g) return null
  const ts = g.tileDisplaySize
  const proj = g._projectLogical((x + 0.5) * ts, (y + 0.5) * ts, true)
  if (!proj) return null
  const c = Math.round(x), r = Math.round(y)
  const lift = ((g._vertexH(c, r + 1) + g._vertexH(c + 1, r + 1)) * 0.5) * g._scaleAtRow(r + 1)
  const w = proj.scale * ts
  return { x: proj.screenX, y: proj.screenY - lift, w, h: w * 1.2 }
}

export default class FigureSword {
  constructor({ gid = 2492, head = 0.56, rest = 0.4, shine = false } = {}) {
    this.gid = gid; this.head = head; this.rest = rest; this.shine = shine
    this.state = 'none'
    this.t = { show: -1e9, draw: -1e9, salute: -1e9, sheathe: -1e9 }
  }

  show(now) { if (this.state === 'none') { this.state = 'sheathed'; this.t.show = now } }
  draw(now) { if (this.state !== 'drawn') { this.show(now); this.state = 'drawn'; this.t.draw = now; this.t.salute = -1e9 } }
  salute(now) { if (this.state !== 'drawn') this.draw(now); this.t.salute = Math.max(now, this.t.draw + DRAW_MS) }
  sheathe(now) { if (this.state === 'drawn') { this.state = 'sheathed'; this.t.sheathe = now } }
  hide() { this.state = 'none' }
  saluting(now) { const ms = now - this.t.salute; return ms >= 0 && ms < SALUTE_MS }
  busy(now) { return this.saluting(now) || now - this.t.draw < DRAW_MS || now - this.t.sheathe < SHEATHE_MS }

  _pose(now, side, box) {
    const R = rig(side, FIG_PS), guard = -90 + side * 15
    if (this.state === 'sheathed') {
      const ke = (now - this.t.sheathe) / SHEATHE_MS
      if (ke < 0.55) { const k = easeOut(ke / 0.55), e = R.gripAt(1); return { angle: lerp(guard, R.axisDeg + side * 360, k), hand: [e[0] * k, e[1] * k] } }
      if (ke < 1) return { sheath: 1 - easeIO((ke - 0.55) / 0.45) }
      return null
    }
    const kg = (now - this.t.draw) / DRAW_MS
    if (kg < 0.35) return { sheath: easeOut(kg / 0.35) }
    if (kg < 1) { const k = easeOut((kg - 0.35) / 0.65), st = R.gripAt(1); return { angle: lerp(R.axisDeg, guard - side * 360, k), hand: [st[0] * (1 - k), st[1] * (1 - k)] } }
    if (this.saluting(now)) {
      const ms = now - this.t.salute, h = V._saluteHand(ms, side, this.head, this.rest)
      return { angle: V._saluteAngle(ms, side, guard), hand: [h[0] * box.h / box.w, h[1] * box.h / box.w] }
    }
    return { angle: guard, hand: [0, 0] }
  }

  paint(ctx, scene, box, side, flagPose, now) {
    if (this.state === 'none' || !box || box.w < 3) return
    const img = scene.itemSheet?.getCanvas?.(this.gid)
    if (!img) return
    const pose = this._pose(now, side, box)
    const g = scene.perspectiveGround
    ctx.save()
    ctx.globalAlpha *= clamp01((now - this.t.show) / 250)
    // the figure's bob and lean, but not its mirroring (side already does that)
    if (flagPose) g._applyPose(ctx, box.x, box.y, { ...flagPose, sx: Math.abs(flagPose.sx || 1) }, box.w)
    drawHeldSword(ctx, img, { x: box.x, y: box.y, w: box.w, ps: FIG_PS, side, pose })
    // a glint running up a drawn steel blade, now and then
    if (this.shine && pose && pose.sheath == null) {
      const ph = ((now / 1000) % 2.6) / 0.5
      if (ph < 1) {
        const R = rig(side, FIG_PS), H = box.w * 1.8 * FIG_PS
        const hx = box.x + side * box.w * 0.2 * FIG_PS + (pose.hand?.[0] || 0) * box.w
        const hy = box.y - H * 0.4 + (pose.hand?.[1] || 0) * box.w
        const a = pose.angle * Math.PI / 180, L = R.bladeLen * box.w * (0.3 + 0.7 * ph)
        const gx = hx + Math.cos(a) * L, gy = hy + Math.sin(a) * L, r = Math.max(1.5, box.w * 0.07) * Math.sin(Math.PI * ph)
        ctx.globalAlpha = 0.9 * Math.sin(Math.PI * ph)
        ctx.fillStyle = '#fffbe8'
        ctx.beginPath()
        ctx.moveTo(gx, gy - r * 2); ctx.lineTo(gx + r * 0.4, gy); ctx.lineTo(gx, gy + r * 2); ctx.lineTo(gx - r * 0.4, gy); ctx.closePath()
        ctx.moveTo(gx - r * 2, gy); ctx.lineTo(gx, gy - r * 0.4); ctx.lineTo(gx + r * 2, gy); ctx.lineTo(gx, gy + r * 0.4); ctx.closePath()
        ctx.fill()
      }
    }
    ctx.restore()
  }
}

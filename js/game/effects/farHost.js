// farHost.js — the host at training, seen far off across the water
// Location: js/game/effects/farHost.js
//
// A background-only copy of the warband school's training (hostField.js): ~260 tiny
// figures drilling on a flat headland in the vista map (skye_farraige). It is drawn
// by the perspective ground renderer's own projection, so it parallaxes and
// foreshortens with the ground, and it is built to cost very little:
//
//   - the simulation steps at simHz, at `speed` of normal time (everything moves slowly)
//   - the field is re-drawn into a list of drawing ops only `fps` times a second; each
//     frame replays the latest list re-projected for the current camera, so the camera
//     moves smoothly while the host steps (crossfade: true blends from the previous list,
//     but it makes figures shimmer, so it is off)
//   - figures are two shapes, tinted toward the haze
//   - sweeps of fog roll across, hiding part or all of it; one is timed to cover each
//     scene change
//   - nothing runs while the headland is off-screen or a panel is open
//   - it is normally misty, with banks drifting through and now and then a clear glimpse;
//     what you can hear (distant clashes, shouts, cheers, carnyx calls on changes of
//     formation: farHostAudio.js) follows how much of it you can see
//
// A scene opts in with  new FarHost(this, cfg)  and  drawFarHost(ctx, pgr) -> farHost.draw(...)
// (see skyeFaiche.js); PGR calls drawFarHost once per frame, after the north-preview rows
// and before the first real map row. Geometry here must match the headland in
// tools/map-editor/generators/skye_gen.mjs (skye_farraige).

import { createField } from './hostField.js'
import FarHostAudio from './farHostAudio.js'

const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t) }
const STRIDE = 12     // anchorX, anchorY, type, ox, oy, w|ox2, h|oy2, colour, alpha

export default class FarHost {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} cfg
   *   col0,row0   vista-map LOCAL tile where the field's (0,0) corner sits
   *   unit        tiles per field unit across (field is 360 x 250 units); unitY the same for depth
   *   top         terrain height (tiles) of the headland's flat top, as the map's heightMap has it
   *   figScale    figure size multiplier on top of `unit`
   *   haze        0..1 how far colours are mixed toward hazeColor
   *   hazeColor, fogColor   '#rrggbb'
   */
  constructor(scene, cfg = {}) {
    this.scene = scene
    this.cfg = {
      col0: 9, row0: 10.75, unit: 0.05, unitY: 0.07, top: 0.5, figScale: 1.5,
      seed: 5, count: 130, fps: 20, simHz: 20, speed: 0.9, haze: 0.3, crossfade: false, sound: true, volume: 0.55,
      fogImage: 'assets/fog01.png', hazeColor: '#bcc4c1', fogColor: '#d3dbd8', ...cfg,
    }
    this.audio = this.cfg.sound ? new FarHostAudio({ volume: this.cfg.volume }) : null
    this.field = createField({ seed: this.cfg.seed, count: this.cfg.count, far: true, shortMurmur: true, squash: 0.75, speedScale: this.cfg.speed, onEvent: (n, d) => this._onEvent(n, d) })
    this.W = this.field.width; this.D = this.field.depth; this.S = this.field.squash
    this.haze = this._rgb(this.cfg.hazeColor); this.fogRGB = this._rgb(this.cfg.fogColor)
    this.colCache = new Map()
    this.cur = { n: 0, d: new Float32Array(STRIDE * 5000) }
    this.prev = { n: 0, d: new Float32Array(STRIDE * 5000) }
    this.hasPrev = false
    this.last = performance.now(); this.simAcc = 0; this.recAcc = 1; this.t = 0
    this.boost = 0; this.sinceScene = 99; this.gl = null; this.nextGlimpse = 8 + Math.random() * 14; this.ph = Math.random() * 100
    // Fog banks (public/assets/fog01.png), all drifting west -> east, nearer ones faster (parallax).
    //  far: behind the host, over the distant hills; huge, slow, dense, never fading
    //  near: between the host and the walkable map, hiding the old water; they fade in and out as they cross
    const rr = (a, b) => a + Math.random() * (b - a), W = this.W, D = this.D
    this.banks = []
    for (let k = 0; k < 5; k++) this.banks.push({ far: true, back: true, gy: rr(-190, -90), w: W * rr(1.0, 1.4), sp: rr(0.18, 0.4), span: W * 2.6, x0: (k + Math.random() * 0.6) / 5 * W * 2.6, flip: k % 2 === 0, a: rr(0.85, 0.95), hk: 1.0 })
    for (let k = 0; k < 6; k++) { const gy = D * rr(1.15, 1.7) - 30 /* two rows nearer the camera */; this.banks.push({ far: false, back: false, gy, w: W * rr(0.9, 1.3), sp: 2 + (gy / D - 1) * 4 + rr(0, 1), span: W * 1.9, x0: (k + Math.random() * 0.6) / 6 * W * 1.9, flip: k % 2 === 1, a: rr(0.6, 0.85), hk: 0.55 }) }
    this.fogImg = null
    try {
      const im = new Image()
      im.onload = () => {
        const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height
        const x = cv.getContext('2d'); x.drawImage(im, 0, 0)
        x.globalCompositeOperation = 'source-atop'
        x.fillStyle = `rgba(${this.fogRGB[0]},${this.fogRGB[1]},${this.fogRGB[2]},0.5)`; x.fillRect(0, 0, cv.width, cv.height)
        // feather every edge so the banks have no visible rectangle
        x.globalCompositeOperation = 'destination-in'
        const hg = x.createLinearGradient(0, 0, cv.width, 0)
        hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(0.22, 'rgba(0,0,0,1)'); hg.addColorStop(0.78, 'rgba(0,0,0,1)'); hg.addColorStop(1, 'rgba(0,0,0,0)')
        x.fillStyle = hg; x.fillRect(0, 0, cv.width, cv.height)
        const vg = x.createLinearGradient(0, 0, 0, cv.height)
        for (let i = 0; i <= 10; i++) { const u = i / 10, a = u < 0.3 ? u / 0.3 : u > 0.5 ? 1 - (u - 0.5) / 0.5 : 1; vg.addColorStop(u, `rgba(0,0,0,${(a * a * (3 - 2 * a)).toFixed(3)})`) }   // soft all round: no flat edge anywhere
        x.fillStyle = vg; x.fillRect(0, 0, cv.width, cv.height)
        this.fogImg = cv
      }
      im.src = this.cfg.fogImage
    } catch (e) { /* no fog image: the host simply shows */ }
    this.paused = false
    this._ax = 0; this._ay = 0
    const self = this
    this.recorder = {
      anchor: (x, y) => { self._ax = x; self._ay = y == null ? null : y; self._anch = x != null },
      rect: (px, py, w, h, c, a) => self._rec(0, px, py, w, h, c, a),
      line: (x1, y1, x2, y2, c, a) => self._rec(1, x1, y1, x2, y2, c, a),
    }
    this._anch = false
  }

  _rgb(c) { return [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)) }

  _rec(type, a, b, c, d, col, al) {
    const buf = this.rec; if (buf.n >= 5000) return
    const o = buf.n * STRIDE, S = this.S, v = buf.d
    let ax, ay
    if (this._anch) { ax = this._ax; ay = this._ay; v[o + 3] = a - ax; v[o + 4] = b - ay * S }
    else { ax = a; ay = b / S; v[o + 3] = 0; v[o + 4] = 0 }
    v[o] = ax; v[o + 1] = ay; v[o + 2] = type
    if (type === 0) { v[o + 5] = c; v[o + 6] = d }
    else { v[o + 5] = c - a; v[o + 6] = d - b }          // a line: its (dx, dy) from its start
    v[o + 7] = col; v[o + 8] = al
    buf.n++
  }

  setPaused(p) { this.paused = !!p }

  _project(pgr, nb, gx, gy, out) {
    const c = this.cfg
    const col = c.col0 - nb.columnOffset + gx * c.unit, row = c.row0 - nb.height + gy * c.unitY
    const s = pgr._scaleAtRow(row)
    out.x = pgr._colToScreenX(col, row)
    const y = pgr._rowToScreenY(row)
    out.y = y == null ? -9999 : y - c.top * s
    out.k = s * c.unit * c.figScale
    out.s = s
  }

  // is any part of the field on screen (with a margin)?
  _onScreen(pgr, nb) {
    const p = {}, m = 80
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9
    for (const [gx, gy] of [[0, 0], [this.W, 0], [0, this.D], [this.W, this.D]]) {
      this._project(pgr, nb, gx, gy, p)
      minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); miny = Math.min(miny, p.y - 12 * p.k); maxy = Math.max(maxy, p.y)
    }
    return maxx > -m && minx < pgr._sw + m && maxy > -m && miny < pgr._sh + m
  }

  _colour(c) {
    let s = this.colCache.get(c)
    if (s === undefined) {
      const h = this.haze, t = this.cfg.haze
      const r = Math.round(((c >> 16) & 255) * (1 - t) + h[0] * t), g = Math.round(((c >> 8) & 255) * (1 - t) + h[1] * t), b = Math.round((c & 255) * (1 - t) + h[2] * t)
      s = `rgb(${r},${g},${b})`; this.colCache.set(c, s)
    }
    return s
  }

  _onEvent(name, d) {
    if (name === 'scene') this.sinceScene = 0
    if (this.audio && d) {
      if (name === 'chariots') d = { ...d, lead: (d.lead || 0) / this.cfg.speed, dur: (d.dur || 25) / this.cfg.speed }
      this.audio.event(name, d)
    }
  }

  // position along its drift, west to east, wrapping; u 0..1 is how far through the crossing it is
  _bankU(b) { const m = (this.t * b.sp + b.x0) / b.span; return m - Math.floor(m) }
  _bankX(b) { return -b.w * 0.5 - this.W * 0.2 + this._bankU(b) * b.span }
  _bankA(b) {
    if (b.far) return b.a
    const u = this._bankU(b)
    return Math.min(1, b.a + this.boost) * smooth(Math.min(u / 0.4, (1 - u) / 0.4, 1))
  }

  // How much fog is across the field at ground x (0 clear .. 1 solid), from the drifting banks.
  cover(gx) {
    let keep = 1
    for (const b of this.banks) {
      const u = 1 - Math.abs(gx - this._bankX(b)) / (b.w * 0.5)
      if (u <= 0) continue
      keep *= 1 - this._bankA(b) * smooth(u * 1.6) * (b.far ? 0.5 : 1)
    }
    return 1 - keep
  }

  _updateFog(dt) {
    this.sinceScene += dt
    const left = this.field.sceneLeft
    const want = (left > 0 && left < 999 && left / this.cfg.speed < 9 && this.field.scene !== 'murmur') || this.sinceScene < 3.5 ? 1 : 0
    this.boost += (want - this.boost) * Math.min(1, dt * 0.7)
  }

  _replay(ctx, pgr, nb, buf, weight) {
    if (weight <= 0.004) return
    const v = buf.d, c = this.cfg, p = { x: 0, y: 0, k: 0, s: 0 }
    let lx = NaN, ly = NaN
    for (let i = 0; i < buf.n; i++) {
      const o = i * STRIDE, ax = v[o], ay = v[o + 1]
      if (ax !== lx || ay !== ly) { this._project(pgr, nb, ax, ay, p); lx = ax; ly = ay }
      const k = p.k, al = v[o + 8] * weight
      if (al < 0.01) continue
      ctx.globalAlpha = al
      const col = this._colour(v[o + 7])
      if (v[o + 2] === 0) {
        const w = Math.max(1, v[o + 5] * k), h = Math.max(1, v[o + 6] * k)
        ctx.fillStyle = col
        ctx.fillRect(p.x + v[o + 3] * k, p.y + v[o + 4] * k, w, h)
      } else {
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, k * 0.5)
        ctx.beginPath()
        ctx.moveTo(p.x + v[o + 3] * k, p.y + v[o + 4] * k)
        ctx.lineTo(p.x + (v[o + 3] + v[o + 5]) * k, p.y + (v[o + 4] + v[o + 6]) * k)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
  }

  // The far banks ride the horizon (lifted with the far sea, so they veil the far hills against the sky
  // painting) instead of sitting wherever the host's depth would put them.
  _farY(pgr, y) {
    const hz = pgr._horizonPx(), gh = pgr._sh - hz, lift = (this.scene?.getFarBackdrop?.()?.lift ?? 0.1) * gh
    return hz - lift + 0.45 * (y - hz)
  }

  // One bank, its base `drop` of its height below its anchor. alpha scales the bank's own.
  _bank(ctx, im, b, x, yAnchor, w, h, al, drop) {
    ctx.globalAlpha = al
    const y = yAnchor - h + h * drop
    if (b.flip) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(im, -w / 2, y, w, h); ctx.restore() }
    else ctx.drawImage(im, x - w / 2, y, w, h)
  }

  // back=true: the far banks, behind the host, on the ground canvas (the terrain draws over them).
  // back=false: the near banks, drawn from drawOverlay over the terrain, so nothing cuts their lower edge.
  _drawFog(ctx, pgr, nb, back) {
    const im = this.fogImg; if (!im) return
    const p = {}
    // the higher the camera climbs, the lower the near banks sit (in the gap between the walkable ground
    // and the training ground); at the normal view they keep their place behind the stage
    const f0 = pgr._horizonYFrac ?? pgr.constructor.HORIZON_Y_FRAC ?? 0.22
    const tilt = Math.max(0, Math.min(1, (f0 - pgr._horizonPx() / pgr._sh) / 0.35))
    for (const b of this.banks) {
      if (b.back !== back) continue
      const al = this._bankA(b)
      if (al < 0.01) continue
      this._project(pgr, nb, this._bankX(b), b.gy, p)
      const w = b.w * this.cfg.unit * p.s, h = w * 0.5 * b.hk
      if (p.y < -9000 || w < 4) continue
      if (back) p.y = this._farY(pgr, p.y)
      // near banks sit low, rolling in the gap between the walkable ground and the training ground
      this._bank(ctx, im, b, p.x, p.y, w, h, al, back ? 0.5 : 0.28 + 0.3 * tilt)
    }
    ctx.globalAlpha = 1
  }

  // When the camera climbs, the horizon (and the distant mountains with it) leaves the top of the screen
  // and the far banks with it. They carry on along the top edge instead, over the terrain, drifting the
  // same way, so the far mountains stay veiled.
  _topMist(ctx, pgr, nb) {
    const im = this.fogImg; if (!im) return
    const sh = pgr._sh, sw = pgr._sw, p = {}
    for (const b of this.banks) {
      if (!b.far) continue
      this._project(pgr, nb, this._bankX(b), b.gy, p)
      const w = Math.max(sw * 1.1, b.w * this.cfg.unit * p.s), h = w * 0.5 * b.hk * 0.9
      const nat = p.y < -9000 ? -1e4 : this._farY(pgr, p.y) + 0.12 * h  // where it would naturally end
      const k = Math.max(0, Math.min(1, (sh * 0.2 - nat) / (sh * 0.12)))
      if (k <= 0) continue
      // its x drifts with the bank, wrapped across the screen so it is always passing
      const u = this._bankU(b), x = -w * 0.3 + u * (sw + w * 0.6)
      this._bank(ctx, im, b, x, sh * 0.1, w, h, Math.min(1, b.a * 0.95) * k, 0.12)
    }
    ctx.globalAlpha = 1
  }

  /** The scene's onPGRDrawComplete: the near banks, and the far ones' top-of-screen mist. */
  drawOverlay(ctx, pgr) {
    const nb = pgr?._northNeighbor
    if (!nb || !this.fogImg || !pgr._cameraReady?.()) return
    ctx.save()
    this._drawFog(ctx, pgr, nb, true)   // the far banks: drawn here, as the ground canvas is clipped at the horizon
    this._topMist(ctx, pgr, nb)
    this._drawFog(ctx, pgr, nb, false)
    ctx.restore()
  }

  /** Called once per frame by the ground renderer, on its ground canvas. */
  draw(ctx, pgr, panelOpen = false) {
    const nb = pgr?._northNeighbor
    const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000); this.last = now
    if (!nb || !pgr._cameraReady?.()) return
    if (!this._onScreen(pgr, nb)) { this.audio?.setLevel(0); this.audio?.update(dt); return }
    const run = !this.paused && !panelOpen
    if (run) {
      this.t += dt
      this._updateFog(dt)
      const step = 1 / this.cfg.simHz
      this.simAcc += dt
      let n = 0
      while (this.simAcc >= step && n < 3) { this.field.step(step * this.cfg.speed); this.simAcc -= step; n++ }
      if (n === 3) this.simAcc = 0
      this.recAcc += dt
    }
    const iv = 1 / this.cfg.fps
    if (this.recAcc >= iv) {
      this.recAcc = this.recAcc > 2 * iv ? 0 : this.recAcc - iv
      const t = this.prev; this.prev = this.cur; this.cur = t
      this.hasPrev = true
      this.rec = this.cur; this.cur.n = 0; this._anch = false
      this.field.render(this.recorder)
    }
    if (!this.rec) return
    const k = this.cfg.crossfade && this.hasPrev ? Math.min(1, this.recAcc / iv) : 1
    ctx.save()
    this._replay(ctx, pgr, nb, this.prev, this.cfg.crossfade && this.hasPrev ? 1 - k : 0)
    this._replay(ctx, pgr, nb, this.cur, k)
    ctx.restore()
    if (this.audio) {
      let clear = 0; for (let i = 0; i < 5; i++) clear += 1 - this.cover(this.W * (i + 0.5) / 5)
      this.audio.setLevel(run ? 0.3 + 0.7 * clear / 5 : 0); this.audio.update(dt)
    }
  }

  destroy() { this.audio?.destroy(); this.field = null; this.cur = this.prev = this.rec = null }
}

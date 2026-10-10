// weatherRain.js  (v7 -- diffuse weather, and the ground doing the work)
// Location: js/game/effects/weatherRain.js
//
// No falling lines. Rain on these maps is something you are standing IN, and
// the thing that sells it is what it does to the ground. Five layers, all
// pre-drawn sprites stamped with drawImage onto one half-resolution canvas:
//
//   RINGS     the star of the show. Hundreds of rings opening on the ground,
//             bigger toward the camera, some doubled, the nearest throwing up
//             a crown of droplets as they land. Their density follows the
//             curtains, so the heavy band of a shower visibly sweeps across the
//             ground, and it swells with every gust. They are brighter as the
//             ground gets wetter.
//   SIZZLE    the far ground glittering: a few dozen specks that re-scatter
//             about 14 times a second.
//   CURTAINS  big, soft, low-contrast veils of heavier rain, nearer than they
//             used to be, so you drift in and out of them. One sprite each,
//             leaning with the wind (the top carried further), thinning toward
//             the ground. Inside, a shimmer that flickers rather than falls.
//   GRAIN     a very faint flicker of fine vertical grain over the whole view:
//             eight tiny pre-baked frames, stretched to the screen, swapped at
//             random about 14 times a second. This is the "rain in the air".
//   SPRAY     pale mist where a curtain meets the ground.
//
// ── Cost ─────────────────────────────────────────────────────────────────────
// Per frame in a downpour: up to ~380 small ring stamps, ~6 curtain sprites
// (two draws each), one full-view grain draw, and two batched fills. The canvas
// is half resolution. Lower tuning.ringMax if a phone struggles. Below rain
// 0.02 the canvas is hidden and nothing runs.
//
// Sits at z-index 9: above the veil and tilt-shift layers, below the Phaser
// canvas (10) so the HUD, joystick and inventory are never rained on.

import { weather } from './weather.js'
import { wind } from './wind.js'

const SCALE = 0.5
const MAX_CURTAINS = 6
const FRAMES = 8
const FLICKER = 0.07                 // seconds per grain frame (~14 Hz)

const DARK  = [30, 36, 46]
const LIGHT = [222, 230, 240]

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const rnd = (a, b) => a + Math.random() * (b - a)

function sprite(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  draw(c.getContext('2d'), w, h)
  return c
}

// per-pixel baking: fn(x, y, w, h) -> alpha 0..1, painted in colour rgb
function bake(w, h, rgb, fn) {
  return sprite(w, h, (g) => {
    const img = g.createImageData(w, h)
    const d = img.data
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]
        d[i + 3] = Math.round(clamp(fn(x, y, w, h), 0, 1) * 255)
      }
    }
    g.putImageData(img, 0, 0)
  })
}

// soft at both sides, no plateau: a diffuse veil, not a column
// How much of the ground is hidden by fog at a height dy (screen heights below
// the horizon). Mirrors the veil's fog band (weatherVeil.js: opaque at the
// horizon, thinning to nothing about 0.64 of a screen down), so a ring is lost
// in the fog exactly where the ground it is on is.
const FOG_Y = [0, 0.14, 0.40, 0.64], FOG_A = [0.95, 0.60, 0.25, 0]
function fogProfile(dy) {
  if (dy <= 0) return FOG_A[0]
  for (let i = 1; i < 4; i++) {
    if (dy <= FOG_Y[i]) return FOG_A[i - 1] + (FOG_A[i] - FOG_A[i - 1]) * (dy - FOG_Y[i - 1]) / (FOG_Y[i] - FOG_Y[i - 1])
  }
  return 0
}
// Nothing lands on ground that isn't drawn: the terrain itself fades out over
// the first HORIZON_FADE_PX of its depth (perspectiveGroundRenderer.js), so
// rings, specks and droplets fade in over the same stretch, a little beyond it.
function farFade(pgr, dyScreenPx) {
  const fp = pgr?.constructor?.HORIZON_FADE_PX ?? 60
  return smoothstep(fp * 0.9, fp * 2.6, dyScreenPx)
}
const FOG_LEVELS = 4                 // rings are drawn in this many visibility steps

const bell = u => smoothstep(0, 0.5, u) * smoothstep(1, 0.5, u)
// fades in at the top, thins out toward the foot
const tall = v => smoothstep(0, 0.08, v) * (1 - 0.8 * smoothstep(0.5, 1, v))

export class WeatherRain {
  constructor(pgr) {
    this.pgr = pgr
    this._canvas = null
    this._ctx = null
    this._visible = null
    this._frame = 0
    this._t = 0
    this._rings = []
    this._ringAcc = 0
    this._curtains = []
    this._specks = []
    this._speckT = 0
    this._flickT = 0
    this._grainFrame = 0

    const container = pgr?._groundCanvas?.parentNode
    if (!container) return

    const stale = document.getElementById('pgr-wx-rain')
    if (stale) stale.parentNode?.removeChild(stale)

    const c = document.createElement('canvas')
    c.id = 'pgr-wx-rain'
    c.style.cssText = [
      'position:absolute', 'left:0', 'top:0', 'width:100%', 'height:100%',
      'z-index:9', 'pointer-events:none', 'display:none',
    ].join(';')
    container.appendChild(c)
    this._canvas = c
    this._ctx = c.getContext('2d')
    this._container = container
    this._fit()

    // ring: a thin oval outline in three weights, plus a doubled one
    this._ringSprites = [0.7, 0.95, 1.25].map(lw => sprite(32, 32, (g) => {
      g.strokeStyle = 'rgb(228,236,244)'
      g.lineWidth = lw
      g.beginPath(); g.ellipse(16, 16, 14 - lw, 14 - lw, 0, 0, Math.PI * 2); g.stroke()
    }))
    this._dblSprite = sprite(32, 32, (g) => {
      g.strokeStyle = 'rgb(228,236,244)'
      g.lineWidth = 0.9
      g.beginPath(); g.ellipse(16, 16, 13.4, 13.4, 0, 0, Math.PI * 2); g.stroke()
      g.lineWidth = 0.7
      g.beginPath(); g.ellipse(16, 16, 7.4, 7.4, 0, 0, Math.PI * 2); g.stroke()
    })

    // curtain body: one soft sprite, bell-shaped across, thinning toward the foot
    this._body = bake(128, 256, DARK, (x, y, w, h) =>
      Math.pow(bell(x / (w - 1)), 0.85) * tall(y / (h - 1)))

    // curtain shimmer: frames of fine streaky grain inside the same shape.
    // Columns are correlated (so it reads as vertical) and every frame differs.
    this._shimmer = []
    for (let f = 0; f < FRAMES; f++) {
      const col = Float32Array.from({ length: 64 }, () => Math.random())
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < 64; i++) col[i] = (col[(i + 63) % 64] + col[i] * 2 + col[(i + 1) % 64]) / 4
      }
      const lo = Math.min(...col), hi = Math.max(...col)
      this._shimmer.push(bake(64, 128, LIGHT, (x, y, w, h) => {
        const n = ((col[x] - lo) / (hi - lo + 1e-6)) * 0.7 + Math.random() * 0.5
        const streak = Math.pow(clamp((n - 0.45) * 2.2, 0, 1), 1.4)
        return streak * Math.pow(bell(x / (w - 1)), 0.85) * tall(y / (h - 1))
      }))
    }

    // fine grain for the whole view: wide and short, stretched tall, so each
    // texel becomes a soft vertical dash
    this._grain = []
    for (let f = 0; f < FRAMES; f++) {
      const col = Float32Array.from({ length: 96 }, () => Math.random())
      for (let i = 0; i < 96; i++) col[i] = (col[(i + 95) % 96] + col[i] * 2 + col[(i + 1) % 96]) / 4
      const lo = Math.min(...col), hi = Math.max(...col)
      this._grain.push(bake(96, 14, LIGHT, (x) => {
        const n = ((col[x] - lo) / (hi - lo + 1e-6)) * 0.6 + Math.random() * 0.6
        return Math.pow(clamp((n - 0.5) * 2.4, 0, 1), 1.8)
      }))
    }

    // spray at a curtain's foot: a soft oval, faded on every side
    this._mist = sprite(64, 32, (g, w, h) => {
      g.save()
      g.translate(w / 2, h / 2); g.scale(1, h / w)
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, w / 2)
      gr.addColorStop(0, `rgba(${LIGHT.join(',')},1)`)
      gr.addColorStop(1, `rgba(${LIGHT.join(',')},0)`)
      g.fillStyle = gr
      g.beginPath(); g.arc(0, 0, w / 2, 0, Math.PI * 2); g.fill()
      g.restore()
    })

    for (let i = 0; i < MAX_CURTAINS; i++) this._curtains.push(this._newCurtain(true))
  }

  _fit() {
    const W = Math.max(2, Math.round((this._container.clientWidth  || this.pgr._sw || 400) * SCALE))
    const H = Math.max(2, Math.round((this._container.clientHeight || this.pgr._sh || 800) * SCALE))
    if (this._canvas.width !== W || this._canvas.height !== H) {
      this._canvas.width = W
      this._canvas.height = H
    }
  }

  _newCurtain(scatter) {
    // depth s: 0 at the horizon, 1 at the bottom of the screen. Mostly NEAR now,
    // so the veils are big and you drift through them.
    const s = 0.22 + 0.68 * Math.pow(Math.random(), 1.2)
    return {
      s,
      w: rnd(0.8, 1.6),                    // width, in screen-widths at s = 1
      xw: scatter ? (Math.random() - 0.5) * 1.4 / s : null,
      a: rnd(0.6, 1),
      bend: rnd(0.6, 1.4),
      shimmer: Math.floor(Math.random() * FRAMES),
      born: this._t,
    }
  }

  update(dt) {
    if (!this._canvas) return
    const r = weather.state.rain

    if (r < 0.02) {
      if (this._visible !== false) {
        this._canvas.style.display = 'none'
        this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height)
        this._visible = false
        this._rings.length = 0
        this._specks.length = 0
      }
      return
    }
    if (this._visible !== true) {
      this._canvas.style.display = 'block'
      this._visible = true
    }

    if ((this._frame++ & 31) === 0) this._fit()
    this._t += dt

    // the flicker: a different grain frame about 14 times a second
    this._flickT += dt
    if (this._flickT >= FLICKER) {
      this._flickT = 0
      let f
      do { f = Math.floor(Math.random() * FRAMES) } while (f === this._grainFrame)
      this._grainFrame = f
    }

    const ctx = this._ctx
    const W = this._canvas.width
    const H = this._canvas.height
    ctx.clearRect(0, 0, W, H)
    ctx.imageSmoothingEnabled = true

    const hz = (this.pgr._horizonPx?.() ?? (this.pgr._sh || 0) * 0.4) * SCALE

    const live = this._curtainShapes(dt, r, W, H, hz)
    this._drawCurtains(ctx, r, live)
    this._drawRings(ctx, dt, r, W, H, hz, live)
    this._drawSpecks(ctx, dt, r, W, H, hz)
    this._drawGrain(ctx, r, W, H)
    ctx.globalAlpha = 1
  }

  // ── curtains: move them, work out where each one is this frame ─────────────
  _curtainShapes(dt, r, W, H, hz) {
    const T = weather.tuning
    const n = Math.min(MAX_CURTAINS, Math.round(1 + 4 * Math.pow(r, 0.9)))
    const dir = wind.dirX >= 0 ? 1 : -1
    const drift = T.curtainSpeed * (0.5 + 0.9 * wind.strength) * dir
    const out = []

    for (let i = 0; i < n; i++) {
      const c = this._curtains[i]
      const s = c.s
      const wpx = Math.max(8, c.w * s * W)
      if (c.xw == null) c.xw = -dir * ((0.5 * W + wpx * 0.5 + 20) / (s * W))
      c.xw += drift * dt
      const cx = W * 0.5 + c.xw * s * W

      // gone off the downwind side: come back as a new one, upwind, new depth
      if ((dir > 0 && cx - wpx * 0.5 > W + 12) || (dir < 0 && cx + wpx * 0.5 < -12)) {
        this._curtains[i] = this._newCurtain(false)
        continue
      }

      const yf = hz + s * (H - hz)                                   // foot, on the ground
      const top = Math.min(hz - H * 0.3, yf - H * (0.3 + 0.9 * s))   // up into the cloud
      // no popping: fade in on arrival; nearer ones are also more diffuse
      const vis = smoothstep(0, 1.8, this._t - c.born) * (1 - smoothstep(0.84, 0.98, s))
      const k = T.curtainAlpha * c.a * vis * (0.25 + 0.75 * r) * (1.15 - 0.55 * s) * smoothstep(0.08, 0.30, r)
      out.push({ c, cx, wpx, yf, hh: yf - top, k, dir })
    }
    return out
  }

  _drawCurtains(ctx, r, live) {
    const T = weather.tuning
    for (const L of live) {
      if (L.k < 0.008 || L.hh < 6) continue
      const lean = L.dir * (0.05 + 0.10 * wind.strength) * L.c.bend
      ctx.save()
      ctx.translate(L.cx, L.yf)
      // the top is carried further than the foot: a lean, not a column
      ctx.transform(1, 0, -lean, 1, 0, 0)
      ctx.globalAlpha = L.k
      ctx.drawImage(this._body, -L.wpx / 2, -L.hh, L.wpx, L.hh)
      // the shimmer flickers through the same frames as the grain
      const f = (this._grainFrame + L.c.shimmer) % FRAMES
      ctx.globalAlpha = L.k * T.curtainGrain * 2.2
      ctx.drawImage(this._shimmer[f], -L.wpx / 2, -L.hh, L.wpx, L.hh)
      ctx.restore()

      // spray where it meets the ground
      const rx = L.wpx * 0.42, ry = Math.max(3, L.wpx * 0.08)
      ctx.globalAlpha = 0.20 * L.c.a * (L.k / Math.max(0.001, T.curtainAlpha))
      ctx.drawImage(this._mist, L.cx - rx, L.yf - ry * 1.4, rx * 2, ry * 2)
    }
  }

  // ── rings: the star ────────────────────────────────────────────────────────
  // How hard it is raining AT a point on the ground: a baseline everywhere,
  // plus a bump under each curtain, so the heavy band of a shower sweeps over.
  _density(x, y, live, hz, H) {
    let d = 0.35
    const sigY = 0.3 * (H - hz) + 6
    for (const L of live) {
      const u = (x - (L.cx - L.wpx * 0.5)) / L.wpx
      if (u <= 0 || u >= 1) continue
      const dy = (y - L.yf) / sigY
      d += 0.9 * bell(u) * Math.exp(-dy * dy) * (L.k > 0.01 ? 1 : 0)
    }
    return d < 1.6 ? d : 1.6
  }

  // The ground's projection for this frame, taken from the renderer once so each
  // ring costs a few multiplies. Null if the renderer doesn't offer it (rings
  // then stay in screen space, as before).
  _proj() {
    const g = this.pgr
    if (!g || !g._perspCamRow || !g._rowToScreenY) return null
    const C = g.constructor
    try {
      const FL = C.FOCAL_LENGTH, PD = C.PLAYER_DIST_TILES
      const camRow = g._perspCamRow(), camCol = g._perspCamCol()
      const ppt = g._pxPerTileAtPlayer()
      if (![FL, PD, camRow, camCol, ppt].every(Number.isFinite)) return null
      return { FL, PD, camRow, camCol, ppt, hor: g._horizonPx(), gh: g._groundH(), sw: g._sw }
    } catch (e) { return null }
  }

  _drawRings(ctx, dt, r, W, H, hz, live) {
    const T = weather.tuning
    const rings = this._rings
    const wet = weather.wet || 0
    // every gust brings a swell of new rings
    const gust = 0.8 + 0.5 * clamp(wind.strength, 0, 1.4)
    const rate = T.ringRate * Math.pow(r, 1.2) * (0.5 + 0.5 * r) * gust
    this._ringAcc = Math.min(this._ringAcc + rate * dt, 12)
    const ground = H - hz - 2
    const P = this._proj()

    let tries = 0
    while (this._ringAcc >= 1 && rings.length < T.ringMax && ground > 4 && tries++ < 70) {
      const x = Math.random() * W
      const y = hz + 2 + Math.pow(Math.random(), 0.9) * ground
      let col = 0, row = 0
      if (Math.random() * 1.6 > this._density(x, y, live, hz, H)) continue
      // pin the ring to a spot on the ground, so that walking carries it past
      // you like the ground itself instead of dragging it along with the camera
      if (P) {
        const ys = y / SCALE, xs = x / SCALE
        const d = P.FL * P.gh / Math.max(0.5, ys - P.hor) - P.FL
        row = P.camRow - d
        col = P.camCol + (xs - P.sw / 2) / (P.ppt * (P.FL + P.PD) / (P.FL + d))
      }
      this._ringAcc -= 1
      const s = clamp((y - hz) / Math.max(1, H - hz), 0.02, 1)
      rings.push({
        x, y, s, col, row,
        k: rnd(0.35, 1.2),
        v: Math.floor(Math.random() * 3),
        dbl: s > 0.3 && Math.random() < 0.35,
        crown: s > 0.5 && Math.random() < 0.55,
        age: 0,
        life: rnd(0.6, 1.05),
        sq: rnd(0.8, 1.2),
      })
    }
    if (tries >= 70) this._ringAcc = Math.min(this._ringAcc, 4)

    // fog: how opaque the veil's mist band and haze are right now
    const st = weather.state
    const mistOp = Math.min(1, st.mist) * T.mist
    const haze = Math.min(0.6, st.mist * T.fogHaze + st.gloom * T.gloomHaze)
    const fogK = clamp(mistOp, 0, 1)
    const screenH = H                  // canvas height; dy is a fraction of it
    const bins = []
    for (let i = 0; i < 3 * FOG_LEVELS; i++) bins.push([])
    const crowns = []
    for (let i = rings.length - 1; i >= 0; i--) {
      const m = rings[i]
      m.age += dt
      const a = m.age / m.life
      if (a >= 1) { rings.splice(i, 1); continue }
      if (P) {
        // where this bit of ground is on the screen NOW
        const d = P.camRow - m.row
        if (d <= 0.05) { rings.splice(i, 1); continue }
        const k = 1 / (P.FL + d)
        m.y = (P.hor + P.gh * P.FL * k) * SCALE
        m.x = (P.sw / 2 + (m.col - P.camCol) * P.ppt * (P.FL + P.PD) * k) * SCALE
        m.s = clamp((m.y - hz) / Math.max(1, H - hz), 0.02, 1)
        if (m.y > H + 24 || m.x < -40 || m.x > W + 40) continue
      }
      const s = m.s
      // distant rings keep a minimum size: the far ground glitters too
      const rx = Math.max(1.1, m.k * (0.25 + 1.1 * a) * s * W * T.ringSize * m.sq)
      const flat = 0.18 + 0.5 * s
      // how much fog sits between the eye and this bit of ground
      const fog = 1 - (1 - fogK * fogProfile((m.y - hz) / screenH)) * (1 - haze * 0.6)
      const far = farFade(this.pgr, (m.y - hz) / SCALE)
      const lvl = Math.round((1 - fog) * far * (FOG_LEVELS - 1))
      if (lvl <= 0) continue
      if (m.crown && m.age < 0.24 && lvl >= FOG_LEVELS - 1) crowns.push(m.x, m.y, rx, m.age / 0.24)
      bins[Math.min(2, Math.floor(a * 3)) * FOG_LEVELS + lvl].push([m.dbl ? this._dblSprite : this._ringSprites[m.v], m.x, m.y, rx, rx * flat])
    }

    const gain = T.ringAlpha * (0.55 + 0.45 * r) * (1 + 0.6 * wet)
    for (let b = 0; b < bins.length; b++) {
      const list = bins[b]
      if (!list.length) continue
      const ageBin = Math.floor(b / FOG_LEVELS), lvl = b % FOG_LEVELS
      ctx.globalAlpha = clamp(gain * (1 - ageBin / 3) * (lvl / (FOG_LEVELS - 1)), 0, 1)
      for (const [spr, x, y, rx, ry] of list) ctx.drawImage(spr, x - rx, y - ry, rx * 2, ry * 2)
    }

    // the crown: three droplets thrown up as a near ring lands
    if (crowns.length) {
      ctx.globalAlpha = clamp(gain * 0.9, 0, 1)
      ctx.fillStyle = 'rgb(232,240,248)'
      ctx.beginPath()
      for (let q = 0; q < crowns.length; q += 4) {
        const x = crowns[q], y = crowns[q + 1], rx = crowns[q + 2], t = crowns[q + 3]
        for (let j = -1; j <= 1; j++) {
          const px = x + j * rx * (0.5 + 0.9 * t)
          const py = y - Math.sin(Math.PI * t) * rx * (1.0 + 0.45 * (j & 1))
          ctx.rect(px, py, 0.9, 1.1)
        }
      }
      ctx.fill()
    }
  }

  // far ground sizzle: specks that re-scatter ~14 times a second
  _drawSpecks(ctx, dt, r, W, H, hz) {
    const T = weather.tuning
    this._speckT -= dt
    if (this._speckT <= 0) {
      this._speckT = FLICKER
      const n = Math.round(T.speckMax * r * r * 2.2)   // many are thinned by farFade
      const ground = H - hz - 2
      const out = this._specks
      out.length = 0
      for (let i = 0; i < n; i++) {
        const y = hz + 2 + Math.pow(Math.random(), 2.2) * ground * 0.6
        // thin out toward the horizon, where there is no ground to hit
        if (Math.random() > farFade(this.pgr, (y - hz) / SCALE)) continue
        out.push(Math.random() * W, y)
      }
    }
    const sp = this._specks
    if (!sp.length) return
    // they sit near the horizon, where fog is thickest
    const st = weather.state
    const fog = 1 - (1 - clamp(Math.min(1, st.mist) * T.mist, 0, 1) * fogProfile(0.10)) *
                    (1 - Math.min(0.6, st.mist * T.fogHaze + st.gloom * T.gloomHaze) * 0.6)
    ctx.globalAlpha = clamp(0.5 * (0.5 + 0.5 * r) * (1 - fog), 0, 1)
    ctx.fillStyle = 'rgb(226,234,244)'
    ctx.beginPath()
    for (let i = 0; i < sp.length; i += 2) ctx.rect(sp[i], sp[i + 1], 0.9, 0.7)
    ctx.fill()
  }

  // rain in the air: a faint, fast flicker of vertical grain over everything
  _drawGrain(ctx, r, W, H) {
    const T = weather.tuning
    const a = T.grainAlpha * (0.3 + 0.7 * r)
    if (a < 0.004) return
    const off = Math.floor(Math.random() * 32)
    ctx.globalAlpha = a
    ctx.drawImage(this._grain[this._grainFrame], off, 0, 64, 14, 0, 0, W, H)
  }

  destroy() {
    if (this._canvas?.parentNode) this._canvas.parentNode.removeChild(this._canvas)
    this._canvas = null
    this._ctx = null
    this._rings = []
    this._curtains = []
    this._specks = []
  }
}

export default WeatherRain

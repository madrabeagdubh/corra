// weatherRainbow.js
// Location: js/game/effects/weatherRainbow.js
//
// When the rain gives way to sun: now and then, a swirl of rainbow light
// passes across the edges of the screen and is gone. Not a bow in the sky --
// an abstract herald of the sunny spell, in the manner of the other veils.
//
// ── When ─────────────────────────────────────────────────────────────────────
// It ARMS once it has rained (a drizzle will do: state.rain >= ARM_RAIN). It FIRES when the
// rain has stopped and the sun has come through (rain < DRY_RAIN, sun >=
// SUN_IN) -- with weather.tuning.rainbowChance (1: every time; lower it to make them rarer).
// It disarms until the next rain. It waits out a dialogue card or bullet time
// (and gives up if they go on long), so it never talks over either.
//
// ── How it looks ─────────────────────────────────────────────────────────────
// Seven broad, hazy spectral bands, curled into a great spiral bigger than the
// screen, drifting dead slow -- its centre creeps a little way across, and it
// turns a fraction of a turn -- while it fades in (15 s), holds (10 s) and fades
// out (15 s): weather.tuning.rainbowIn / Hold / Out. The middle of the screen is
// kept clear (a vignette), and the whole is screen-blended over the world.
// Drawn small and blurred, then upscaled by the browser: soft, and cheap.
//
// ── Testing ──────────────────────────────────────────────────────────────────
//   ?rainbow             one, a few seconds after the map loads
//   weather.rainbow()    one now (the console)
//
// Owned by WeatherVeil (created, updated, destroyed with it), so every outdoor
// map has it. Like the veil's grey layer it is a direct child of the map
// container: a blend only sees what lies beneath it in the same stacking context.

import { weather } from './weather.js'

const ARM_RAIN = 0.05, DRY_RAIN = 0.02, SUN_IN = 0.15     // a drizzle (0.09) arms it
const WAIT_MAX = 30            // seconds it will wait for a card or bullet time to end
const SCALE = 0.25             // canvas resolution, of the screen's (small: the upscale is part of the haze)
const BAND = 0.042              // one band's width, as a fraction of the screen's diagonal (all seven: ~0.3)
const INNER = 0.3               // the spiral's inner edge, from its centre (fraction of the diagonal)
const HAZE = 0.018              // blur, likewise (much past half a band, the colours wash to grey)
const BANDS = 7

const smooth = t => t * t * (3 - 2 * t)
const clamp01 = u => Math.max(0, Math.min(1, u))

export class WeatherRainbow {
  constructor(pgr, scene) {
    this.pgr = pgr
    this.scene = scene
    this.container = pgr?._groundCanvas?.parentNode || null
    this.armed = false
    this.run = null            // { t, dur, from, to, spin }
    this.pending = null        // seconds waited for a quiet moment
    if (!this.container) return

    document.getElementById('pgr-wx-rainbow')?.remove()
    const c = document.createElement('canvas')
    c.id = 'pgr-wx-rainbow'
    c.style.cssText = [
      'position:absolute', 'left:0', 'top:0', 'width:100%', 'height:100%',
      'z-index:5', 'pointer-events:none', 'opacity:0', 'display:none',
      'mix-blend-mode:screen', 'will-change:opacity',
    ].join(';')
    this.container.appendChild(c)
    this.canvas = c
    this.ctx = c.getContext('2d')

    weather.rainbow = () => { this.pending = 0 }        // the console, and ?rainbow
    try { if (new URLSearchParams(location.search).has('rainbow')) setTimeout(() => { this.pending = 0 }, 3000) } catch (_) {}
  }

  /** Per frame (WeatherVeil.update): dt in seconds. */
  update(dt) {
    if (!this.canvas) return
    const s = weather.state, T = weather.tuning

    // rain arms it; sun after rain fires it (now and then)
    if (s.rain >= ARM_RAIN && weather.name !== 'fogbank') this.armed = true      // (a fog bank's 0.10 is not rain)
    else if (this.armed && s.rain < DRY_RAIN && s.sun >= SUN_IN) {
      this.armed = false
      if (Math.random() < (T.rainbowChance ?? 1)) this.pending = 0
    }

    // wait for a quiet moment: no card up, no bullet time
    if (this.pending != null && !this.run) {
      const busy = !!(this.scene?.textPanel?.isVisible || this.scene?._melee?.focus?.on)
      if (!busy) { this.pending = null; this._start() }
      else if ((this.pending += dt) > WAIT_MAX) this.pending = null
    }

    if (this.run) this._draw(dt)
  }

  _start() {
    const left = Math.random() < 0.5, T = weather.tuning   // which side it leans from
    const fin = T.rainbowIn ?? 15, hold = T.rainbowHold ?? 10, fout = T.rainbowOut ?? 15
    this.run = {
      t: 0, dur: fin + hold + fout, fin, fout,
      from: left ? [0.15, 0.75] : [0.85, 0.75],        // its centre, in screen fractions: it only creeps
      to:   left ? [0.45, 0.45] : [0.55, 0.45],
      spin: (left ? 1 : -1) * (0.12 + Math.random() * 0.06),  // a fraction of a turn over its whole life
      hue0: Math.random() * 360,
    }
    this.canvas.style.display = 'block'
  }

  _draw(dt) {
    const r = this.run, c = this.canvas, ctx = this.ctx
    r.t += dt
    const k = r.t / r.dur
    if (k >= 1) {
      this.run = null
      c.style.opacity = '0'
      c.style.display = 'none'
      return
    }
    // size the canvas to the container (at SCALE)
    const W = Math.max(8, Math.round((this.container.clientWidth || 400) * SCALE))
    const H = Math.max(8, Math.round((this.container.clientHeight || 800) * SCALE))
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H }

    // in, hold, out (seconds from the tuning)
    const env = smooth(clamp01(r.t / r.fin)) * smooth(clamp01((r.dur - r.t) / r.fout))
    c.style.opacity = (env * (weather.tuning.rainbowAlpha ?? 0.6)).toFixed(3)

    // its centre creeps along a gentle curve; the spiral turns, slowly, as it goes
    const cx = (r.from[0] + (r.to[0] - r.from[0]) * k) * W
    const cy = (r.from[1] + (r.to[1] - r.from[1]) * k) * H - Math.sin(Math.PI * k) * 0.05 * H
    const diag = Math.hypot(W, H)
    const rot = r.spin * Math.PI * 2 * k

    ctx.clearRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'source-over'
    ctx.lineCap = 'round'
    ctx.filter = `blur(${Math.max(1, Math.round(diag * HAZE))}px)`   // haze: the bands bleed into one another
    const bw = diag * BAND                               // narrow enough that the whole spectrum fits on screen
    for (let i = 0; i < BANDS; i++) {
      const hue = (r.hue0 + i * (300 / BANDS)) % 360
      ctx.strokeStyle = `hsla(${hue},85%,62%,0.75)`
      ctx.lineWidth = bw * 1.15
      ctx.beginPath()
      // a spiral arm, bigger than the screen: the radius grows as it winds, so the bands curl rather than ring
      const r0 = diag * INNER + i * bw, span = Math.PI * 1.6
      for (let j = 0; j <= 40; j++) {
        const q = j / 40, a = rot + i * 0.06 + q * span
        const rad = r0 + q * diag * 0.15
        const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad * 0.8
        j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
      }
      ctx.stroke()
    }
    ctx.filter = 'none'
    // the vignette: the middle of the screen stays clear
    ctx.globalCompositeOperation = 'destination-in'
    const g = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.28, W / 2, H * 0.55, diag * 0.6)
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.45, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,1)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'source-over'
  }

  destroy() {
    if (weather.rainbow) weather.rainbow = null
    this.canvas?.remove()
    this.canvas = null
  }
}

export default WeatherRainbow

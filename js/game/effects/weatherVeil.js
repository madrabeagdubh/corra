// weatherVeil.js  (v5)
// Location: js/game/effects/weatherVeil.js
//
// Everything the weather paints over a perspective map, owned by one object so
// PerspectiveScene only has to create it, update it and destroy it.
//
//   WeatherSky   overcast sky replacing the painted one   (weatherSky.js)
//   the grade    this file: haze, slate, mist and wet-ground sheen, z-index 4
//   WeatherRain  rings and curtains of rain               (weatherRain.js)
//
// ── The grade: grey day vs fog ───────────────────────────────────────────────
// Two different looks, driven by two different numbers:
//
//   FOG (mist)     a light, washed-out veil that lifts the darks and lowers
//                  contrast, thickest in a band at the horizon.
//   GREY (gloom)   a dark, cool slate that dims and desaturates but keeps the
//                  contrast. It is heavier toward the horizon and about half
//                  strength in the foreground, the way a dull day loses colour
//                  with distance. This is the overcast / drizzle / rain look.
//
// ── The vignette ─────────────────────────────────────────────────────────────
// Colour drains from the world toward the edges of the screen and stays most
// alive at the centre, like a lantern's circle on a grey night. Two parts:
//
//   pgr-wx-grey   a radial layer using mix-blend-mode:saturation with a plain
//                 grey. That blend keeps each pixel's brightness and replaces
//                 its colourfulness, so it is a true desaturation, not a grey
//                 wash. It must be a DIRECT child of the map container, not
//                 inside the veil's root: a blend only sees what is beneath it
//                 in the same stacking context.
//   frame         a soft cool darkening at the edges (normal blend, in root).
//
// If blending is ever too heavy for a device: ?weatherblend=0 swaps in a plain
// grey gradient (a wash rather than a true desaturation).
//
// Why DOM layers and not a CSS filter on the canvases: a filter makes the
// browser re-process a full-screen canvas every time it redraws, a real cost
// on a phone. These are flat colours and gradients that are never restyled;
// only `opacity` and a `transform` change, and the GPU does both unaided.
//
// Known limit: the Phaser canvas (player, NPCs, UI) sits at z-index 10, above
// all of this, so characters are not greyed with the world.
//
// A map opts out with:  getWeatherVeil() { return false }
// Maps with getCloudShadows() === false (interiors) never get one.

import { weather } from './weather.js'
import { WeatherSky } from './weatherSky.js'
import { WeatherRain } from './weatherRain.js'

const ROOT_ID = 'pgr-wx-veil'
const EPS = 0.003

export class WeatherVeil {
  constructor(scene, opts = {}) {
    this.scene = scene
    this.pgr = opts.pgr || scene.perspectiveGround || null
    this.container = this.pgr?._groundCanvas?.parentNode || null
    this._root = null
    this._last = { haze: -1, slate: -1, mist: -1, grey: -1, frame: -1, sheen: -1 }
    this._ty = null
    this._clock = null
    this.sky = null
    this.rain = null

    if (!this.container) return

    const stale = document.getElementById(ROOT_ID)
    if (stale) stale.parentNode?.removeChild(stale)

    const root = document.createElement('div')
    root.id = ROOT_ID
    root.style.cssText = [
      'position:absolute', 'left:0', 'top:0', 'width:100%', 'height:100%',
      'z-index:4', 'pointer-events:none', 'overflow:hidden',
    ].join(';')

    // fog: a flat light veil
    this._haze = this._layer(root, 'rgb(168,176,184)',
      'top:0;height:100%')

    // grey: dark slate, strongest at the horizon, about half in the foreground.
    // The element is twice the container's height with the horizon at its
    // middle, and is slid so that middle sits on the real horizon.
    const g = 'rgba(46,56,72,'
    this._slate = this._layer(root,
      `linear-gradient(to bottom,${g}0.85) 0%,${g}0.90) 30%,${g}1) 50%,` +
      `${g}0.75) 62%,${g}0.52) 80%,${g}0.50) 100%)`,
      'top:0;height:200%')

    // wet ground: the sky mirrored in it. Brightest where the ground is far
    // (it meets the eye at a grazing angle), thinning toward the camera. Only
    // below the horizon; fades in with weather.wet as rain soaks the ground.
    const sh = 'rgba(206,218,232,'
    this._sheen = this._layer(root,
      `linear-gradient(to bottom,${sh}0) 49.5%,${sh}0.34) 50.5%,${sh}0.22) 62%,` +
      `${sh}0.10) 80%,${sh}0.04) 100%)`,
      'top:0;height:200%')

    // soft frame: cool and dark toward the edges, clear in the middle
    this._frame = this._layer(root,
      'radial-gradient(ellipse 75% 70% at 50% 58%,rgba(22,28,40,0) 45%,' +
      'rgba(22,28,40,0.55) 80%,rgba(22,28,40,0.9) 100%)',
      'top:0;height:100%')

    // fog band at the horizon, same trick
    const m = 'rgba(196,204,210,'
    this._mist = this._layer(root,
      `linear-gradient(to bottom,${m}0) 22%,${m}0.55) 42%,` +
      `${m}0.95) 50%,${m}0.6) 57%,${m}0.25) 70%,${m}0) 82%)`,
      'top:0;height:200%')

    this.container.appendChild(root)
    this._root = root

    // the vignette's desaturation (see the header: direct child of container)
    const T0 = weather.tuning
    const staleGrey = document.getElementById('pgr-wx-grey')
    if (staleGrey) staleGrey.parentNode?.removeChild(staleGrey)
    const grey = document.createElement('div')
    grey.id = 'pgr-wx-grey'
    const gc = T0.blend ? '128,128,128' : '120,126,134'
    const aK = T0.blend ? 1 : 0.45
    const aC = (T0.desatCentre * aK).toFixed(3)
    const aM = (((T0.desatCentre + T0.desatEdge) / 2) * aK).toFixed(3)
    const aE = (T0.desatEdge * aK).toFixed(3)
    grey.style.cssText = [
      'position:absolute', 'left:0', 'top:0', 'width:100%', 'height:100%',
      'z-index:4', 'pointer-events:none', 'opacity:0', 'will-change:opacity',
      T0.blend ? 'mix-blend-mode:saturation' : '',
      `background:radial-gradient(ellipse 80% 72% at 50% 58%,` +
      `rgba(${gc},${aC}) 0%,rgba(${gc},${aM}) 55%,rgba(${gc},${aE}) 100%)`,
    ].filter(Boolean).join(';')
    this.container.appendChild(grey)
    this._grey = grey

    this.sky = new WeatherSky(this.pgr)
    this.rain = new WeatherRain(this.pgr)
    this.update()
  }

  _layer(root, bg, geometry) {
    const d = document.createElement('div')
    d.style.cssText = [
      'position:absolute', 'left:0', 'width:100%', geometry,
      `background:${bg}`, 'opacity:0', 'will-change:transform,opacity',
    ].join(';')
    root.appendChild(d)
    return d
  }

  /** Per frame. Writes a style only when its value has actually moved. */
  update() {
    if (!this._root) return

    const now = performance.now()
    const dt = this._clock == null ? 0 : Math.min(0.1, (now - this._clock) / 1000)
    this._clock = now

    const s = weather.state
    const T = weather.tuning

    const haze  = Math.min(0.6, s.mist * T.fogHaze + s.gloom * T.gloomHaze)
    const slate = Math.min(0.9, s.gloom * T.slate)
    const mist  = Math.min(1, s.mist) * T.mist
    const grey  = Math.min(1, s.gloom * T.desat)
    const frame = Math.min(1, s.gloom * T.frame)
    const sheen = Math.min(1, (weather.wet || 0) * T.sheen)

    if (Math.abs(haze - this._last.haze) > EPS) {
      this._haze.style.opacity = haze.toFixed(3)
      this._last.haze = haze
    }
    if (Math.abs(slate - this._last.slate) > EPS) {
      this._slate.style.opacity = slate.toFixed(3)
      this._last.slate = slate
    }
    if (Math.abs(mist - this._last.mist) > EPS) {
      this._mist.style.opacity = mist.toFixed(3)
      this._last.mist = mist
    }
    if (this._grey && Math.abs(grey - this._last.grey) > EPS) {
      this._grey.style.opacity = grey.toFixed(3)
      this._last.grey = grey
    }
    if (Math.abs(frame - this._last.frame) > EPS) {
      this._frame.style.opacity = frame.toFixed(3)
      this._last.frame = frame
    }

    if (Math.abs(sheen - this._last.sheen) > EPS) {
      this._sheen.style.opacity = sheen.toFixed(3)
      this._last.sheen = sheen
    }

    const H = this.pgr?._sh || this.container.clientHeight || 0
    const hy = this.pgr?._horizonPx?.() ?? H * 0.5
    const ty = Math.round(hy - H)
    if (ty !== this._ty) {
      const t = `translate3d(0,${ty}px,0)`
      this._mist.style.transform = t
      this._slate.style.transform = t
      this._sheen.style.transform = t
      this._ty = ty
    }

    this.sky?.update(dt)
    this.rain?.update(dt)
  }

  destroy() {
    this.sky?.destroy(); this.sky = null
    this.rain?.destroy(); this.rain = null
    if (this._grey?.parentNode) this._grey.parentNode.removeChild(this._grey)
    this._grey = null
    if (this._root?.parentNode) this._root.parentNode.removeChild(this._root)
    this._root = null
  }
}

export default WeatherVeil

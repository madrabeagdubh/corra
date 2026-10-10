// weather.js
// Location: js/game/effects/weather.js
//
// One sky, shared by everything. Like wind.js this is a single exported
// instance that effects READ and a scene UPDATES; it holds no drawing code.
// It survives map changes because it is module state, so the weather you walk
// out of a map in is the weather you walk into the next one in.
//
// ── The six numbers ──────────────────────────────────────────────────────────
//   cloud  0..1   0.5 is the look the game had before weather existed
//                 (broken cloud, patches of sun). Above that the gaps close up
//                 towards solid overcast; below it the cloud thins out.
//   gloom  0..1   how grey and dim the day is. Drives the grey veil and how
//                 dark the cloud shadows are.
//   mist   0..1   distance haze, thickest at the horizon.
//   rain   0..1   how hard it is raining. Drizzle is ~0.25, a downpour 1.
//                 Drawn by weatherRain.js.
//   wind   0..1.4 becomes wind.base while driveWind is true.
//   sun    0..1   warm tint on lit ground. 0 is a sunless day.
//
// ── Two ways to drive it ─────────────────────────────────────────────────────
//   The DIRECTOR (default). Wanders between the moody presets on its own, a
//   minute or two at a time with long slow fades, so it is never still. The
//   bright preset ("fine") is deliberately kept out of its reach until
//   weather.allowFine = true.
//
//   STORY BEATS. A scene pins the weather for as long as it needs:
//       weather.lock('downpour', { fade: 6 })   // or a partial object:
//       weather.lock({ gloom: 0.9, mist: 1, wind: 0.05, rain: 0.8 })
//       weather.unlock()                        // director takes over again
//
// ── Testing on a phone ───────────────────────────────────────────────────────
//   ?weather=fogbank      pins a preset from page load
//   ?weatherspeed=10      runs the director ten times faster
//   ?weatherblend=0       plain grey instead of the saturation blend (if slow)
//
// Usage:
//   import { weather } from './weather.js'
//   weather.update(delta)       // once per frame, by the scene (harmless if
//                               // called twice: it keeps its own clock)
//   weather.state.gloom         // read anywhere

import { wind } from './wind.js'

export const WEATHER_KEYS = ['cloud', 'gloom', 'mist', 'rain', 'wind', 'sun']

export const WEATHER_PRESETS = {
  //             cloud  gloom  mist   rain   wind   sun
  fine:     { cloud: 0.50, gloom: 0.00, mist: 0.00, rain: 0.00, wind: 0.55, sun: 1.00 },
  bright:   { cloud: 0.70, gloom: 0.12, mist: 0.04, rain: 0.00, wind: 0.60, sun: 0.50 },
  soft:     { cloud: 0.82, gloom: 0.28, mist: 0.06, rain: 0.00, wind: 0.50, sun: 0.22 },
  overcast: { cloud: 0.96, gloom: 0.48, mist: 0.12, rain: 0.00, wind: 0.50, sun: 0.05 },
  mist:     { cloud: 0.92, gloom: 0.52, mist: 0.55, rain: 0.00, wind: 0.30, sun: 0.00 },
  drizzle:  { cloud: 0.98, gloom: 0.62, mist: 0.35, rain: 0.09, wind: 0.45, sun: 0.00 },
  rain:     { cloud: 1.00, gloom: 0.76, mist: 0.30, rain: 0.60, wind: 0.65, sun: 0.00 },
  downpour: { cloud: 1.00, gloom: 0.92, mist: 0.40, rain: 1.00, wind: 0.80, sun: 0.00 },
  fogbank:  { cloud: 1.00, gloom: 0.66, mist: 1.00, rain: 0.10, wind: 0.22, sun: 0.00 },
}

// Where the director may go from each preset, and how likely each hop is.
// Neighbours only, so the day changes gradually the way it does outdoors.
const GRAPH = {
  fine:     { bright: 1, soft: 2 },
  bright:   { soft: 3, overcast: 1 },
  soft:     { overcast: 3, bright: 3, mist: 1.5, drizzle: 1.5 },
  overcast: { soft: 2, mist: 2, drizzle: 3, rain: 1, bright: 1 },
  mist:     { overcast: 2, drizzle: 2, fogbank: 1.2, soft: 1.5 },
  fogbank:  { mist: 3, overcast: 1.5 },
  drizzle:  { rain: 2.5, overcast: 2.5, mist: 1.5, soft: 1.5 },
  rain:     { downpour: 1.2, drizzle: 3, overcast: 1.5 },
  downpour: { rain: 4, drizzle: 1 },
}

// Seconds spent at a preset before moving on, and seconds taken to get there.
const DWELL = {
  bright:   [25, 50],
  downpour: [30, 60],
  fogbank:  [60, 120],
  default:  [55, 110],
}
const FADE = [22, 40]

const rand   = (a, b) => a + Math.random() * (b - a)
const smooth = t => t * t * (3 - 2 * t)

class Weather {
  constructor() {
    this.name   = 'soft'
    this.state  = { ...WEATHER_PRESETS.soft }

    this.locked    = false
    this.allowFine = false      // let the director reach "fine" (via bright)
    this.driveWind = true       // write state.wind into wind.base
    this.timeScale = 1          // director speed, for testing

    // Looks of the things that read the weather. Live-editable.
    this.tuning = {
      // ── the grade (weatherVeil.js) ──────────────────────────────────────
      fogHaze:        0.34,   // light washed-out veil at mist 1 (fog only)
      gloomHaze:      0.04,   // a touch of it on grey days, so they are not crisp
      slate:          0.40,   // dark cool grade at gloom 1 (the grey day)
      mist:           0.90,   // horizon fog band opacity at mist 1
      shadowBoost:    0.90,   // cloud shadows get this much darker at gloom 1
      // ── the sky (weatherSky.js) ─────────────────────────────────────────
      skyCover:       0.88,   // most the overcast sheet covers the painted sky
      skyFrom:        0.78,   // cloud level where the sheet starts to appear
      skyTo:          0.96,   // ...and where it is fully in
      skyDark:        0.60,   // extra darkening of the sky in heavy gloom
      skyBank:        0.50,   // opacity of the drifting cloud banks
      // ── the vignette (weatherVeil.js) ───────────────────────────────────
      blend:          true,   // true saturation blend; false = plain grey wash
      desat:          1.35,   // vignette strength = gloom x this (max 1)
      desatCentre:    0.35,   // desaturation at the middle of the screen
      desatEdge:      0.95,   // ...and at the edges (1 = black and white)
      frame:          0.45,   // cool darkening at the edges at gloom 1
      // ── the rain (weatherRain.js) ───────────────────────────────────────
      ringRate:       330,    // new rings per second in a downpour
      ringMax:        380,    // rings alive at once (lower this first if slow)
      ringSize:       0.05,   // ring radius at the screen bottom, x screen width
      ringAlpha:      0.55,   // ring brightness
      speckMax:       150,    // far-ground sizzle specks in a downpour
      curtainAlpha:   0.20,   // darkness of the rain curtains (soft, near)
      curtainSpeed:   0.05,   // drift, in screen-widths per second at depth 1
      curtainGrain:   0.40,   // flicker inside the curtains
      grainAlpha:     0.07,   // flicker of fine grain over the whole view
      sheen:          0.80,   // wet-ground sheen once the ground is soaked
    }

    this._from    = { ...this.state }
    this._to      = { ...this.state }
    this._fadeT   = 1
    this._fadeDur = 1
    this._dwell   = rand(DWELL.default[0], DWELL.default[1])
    this._clock   = null
    this.wet        = 0         // 0..1: how soaked the ground is (rain builds it)

    this._readUrl()
  }

  /** Per frame. Keeps its own clock, so calling it twice in a frame is fine. */
  update(/* delta */) {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    let dt = this._clock == null ? 0 : (now - this._clock) / 1000
    this._clock = now
    // A paused scene or a hidden tab must not make the sky leap.
    dt = Math.min(dt, 0.25) * this.timeScale

    if (this._fadeT < 1) {
      this._fadeT = Math.min(1, this._fadeT + dt / this._fadeDur)
      const k = smooth(this._fadeT)
      for (const key of WEATHER_KEYS) {
        this.state[key] = this._from[key] + (this._to[key] - this._from[key]) * k
      }
    } else if (!this.locked) {
      this._dwell -= dt
      if (this._dwell <= 0) this._advance()
    }

    // the ground soaks up rain in about a minute and dries over about three
    const rn = this.state.rain
    this.wet = rn > 0.2
      ? Math.min(1, this.wet + dt * (rn - 0.1) / 50)
      : Math.max(0, this.wet - dt / 180)

    if (this.driveWind) wind.base = this.state.wind
    return this
  }

  /**
   * Pin the weather. Takes a preset name or a partial state; anything left
   * out stays as it is right now. fade is in seconds (0 = snap).
   */
  lock(target, { fade = 10 } = {}) {
    const to = typeof target === 'string' ? WEATHER_PRESETS[target] : target
    if (!to) {
      console.warn('[Weather] unknown preset:', target)
      return this
    }
    this._begin({ ...this.state, ...to }, fade)
    if (typeof target === 'string') this.name = target
    this.locked = true
    return this
  }

  /** Hand control back to the director. */
  unlock() {
    this.locked = false
    this._dwell = rand(...(DWELL[this.name] || DWELL.default))
    return this
  }

  _begin(to, fadeSec) {
    this._from = { ...this.state }
    this._to   = { ...to }
    if (fadeSec > 0) {
      this._fadeT   = 0
      this._fadeDur = fadeSec
    } else {
      this._fadeT = 1
      Object.assign(this.state, to)
    }
  }

  _advance() {
    const next = this._pickNext()
    this.name = next
    this._begin(WEATHER_PRESETS[next], rand(FADE[0], FADE[1]))
    this._dwell = rand(...(DWELL[next] || DWELL.default))
  }

  _pickNext() {
    const edges = { ...(GRAPH[this.name] || GRAPH.soft) }
    if (this.allowFine && this.name === 'bright') edges.fine = 1.5
    let total = 0
    for (const k in edges) total += edges[k]
    let r = Math.random() * total
    for (const k in edges) {
      r -= edges[k]
      if (r <= 0) return k
    }
    return 'soft'
  }

  _readUrl() {
    try {
      if (typeof location === 'undefined') return
      const q = new URLSearchParams(location.search)
      const w = q.get('weather')
      if (w && WEATHER_PRESETS[w]) this.lock(w, { fade: 0 })
      const sp = parseFloat(q.get('weatherspeed'))
      if (sp > 0) this.timeScale = sp
      if (q.get('weatherblend') === '0') this.tuning.blend = false
    } catch (e) { /* no URL to read */ }
  }
}

// Shared instance. Scenes update it; effects only read.
export const weather = new Weather()

if (typeof window !== 'undefined') window.weather = weather   // console access

export default weather

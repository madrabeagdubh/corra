// quality.js
// Location: js/game/systems/quality.js
//
// How much the game asks of the device. One place decides, and the effects ask it.
//
// WHY: a phone froze outright in the rain, in a conversation: the tilt-shift (four masked backdrop-filter layers over canvases that
// redraw all the time), the weather veil's saturation blend, the rain canvas and the layered rain audio were all on at once. There was
// nothing that scaled any of it down. Now there are four tiers, an automatic way down, and switches to find what a given phone hates.
//
// TIERS            high  desktop, or a strong phone: everything as designed
//                  med   a typical phone: lighter tilt-shift (no follow animation, two layers), a still blurred picture under conversation
//                        instead of a live blur, fewer raindrops
//                  low   a weak phone: no backdrop blur at all (haze and vignette only), a dim under conversation, light rain, no rainbow,
//                        no saturation blend
//                  min   the least: as low, with hardly any rain
//
// HOW IT IS CHOSEN (first that applies)
//   ?q=high|med|low|min   in the address: kept for next time (?q=auto forgets it)
//   a tier saved by a previous ?q=
//   automatic: a desktop is high; a phone is low if it has little memory or few cores, high if it has plenty, med otherwise.
//              While playing, a watchdog watches the frame times; a sustained crawl steps the tier down (and remembers it for next time).
//              The watchdog does nothing when the tier was forced by ?q= .
//
// FINDING THE CULPRIT on a phone that struggles (any combination, comma separated):
//   ?fx=notilt,norain,noveil,norainbow,nosound,nodialogueblur
//   ?perf=1   a small readout: tier, frames per second, switches. Tap it to step the tier down.
//
// IN CODE
//   import { quality } from '../systems/quality.js'
//   quality.get()          the current tier's table (see TABLE)
//   quality.fx('tilt')     false if switched off with ?fx=notilt
//   quality.onChange(fn)   called with (tier) when it changes
//   quality.set('low')     (the console: window.quality)

const KEY = 'corra_quality', KEY_AUTO = 'corra_quality_auto'
export const TIERS = ['high', 'med', 'low', 'min']

// tilt:  'live' the original (three far layers + near, animated follow)
//        'light' one far layer + near, no animation (it jumps, rather than glides, when the focus moves)
//        'off' no backdrop blur at all: the haze and the vignette stay (they are only gradients)
// dlg:   what a conversation does to the world. 'live' the blur ramps up; 'still' a blurred picture of the world is laid over it
//        (made once when the words come up); 'dim' it is darkened and vignetted, nothing is blurred
// ground: the intro's live ground (introLevel.js) is redrawn [idleMs, idleFrames, moveFrames]: while the camera is still (only the flowers'
//        sway) not before idleMs have passed and idleFrames frames (Infinity = never); while it moves, every moveFrames-th frame. The world
//        is a still picture between redraws, and counting frames as well as time means a slow phone redraws less, not just later.
// fps:    the intro's Phaser game (stars, the figures, the poem) is held to this many frames a second (0 = as fast as the screen)
//        and has this share of its stars; loaderMs: the starfield behind it (index.html) is redrawn no oftener than this
// rain:  multiplies the rain's counts (rings, specks); rainScale the rain canvas's resolution
const TABLE = {
  high: { tilt: 'live',  dlg: 'live',  ground: [0, 1, 1],        fps: 0,  stars: 1.00, loaderMs: 0,   rain: 1.00, rainScale: 0.50, veilBlend: true,  rainbow: true,  rainSound: 1.0 },
  med:  { tilt: 'light', dlg: 'still', ground: [33, 2, 1],       fps: 30, stars: 0.70, loaderMs: 33,  rain: 0.60, rainScale: 0.40, veilBlend: true,  rainbow: true,  rainSound: 0.8 },
  low:  { tilt: 'off',   dlg: 'dim',   ground: [100, 6, 2],      fps: 24, stars: 0.45, loaderMs: 66,  rain: 0.30, rainScale: 0.33, veilBlend: false, rainbow: false, rainSound: 0.5 },
  min:  { tilt: 'off',   dlg: 'dim',   ground: [Infinity, 1, 3], fps: 20, stars: 0.30, loaderMs: 100, rain: 0.12, rainScale: 0.25, veilBlend: false, rainbow: false, rainSound: 0.3 },
}

const read = (k) => { try { return localStorage.getItem(k) } catch (_) { return null } }
const write = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch (_) {} }

function detect() {
  try {
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
    if (!coarse) return 'high'
    const mem = navigator.deviceMemory || 0, cores = navigator.hardwareConcurrency || 4
    if ((mem && mem <= 3) || cores <= 4) return 'low'
    if (mem >= 6 && cores >= 8) return 'high'
    return 'med'
  } catch (_) { return 'med' }
}

class Quality {
  constructor() {
    this.listeners = new Set()
    this.off = new Set()              // ?fx=no... switches
    this.forced = false
    this.tier = 'med'
    this.slow = 0
    this._init()
  }

  _init() {
    let q = null, fx = '', perf = false
    try {
      const p = new URLSearchParams(location.search)
      q = p.get('q'); fx = p.get('fx') || ''; perf = p.has('perf')
    } catch (_) {}
    fx.split(',').map(s => s.trim().toLowerCase()).filter(Boolean).forEach(s => this.off.add(s.replace(/^no/, '')))
    if (q === 'auto') write(KEY, null)
    else if (TIERS.includes(q)) write(KEY, q)
    if (this.off.has('sound') && typeof window !== 'undefined') {            // ?fx=nosound: no audio at all (every context stays suspended)
      for (const C of [window.AudioContext, window.webkitAudioContext]) if (C?.prototype) C.prototype.resume = function () { return Promise.resolve() }
    }
    const saved = read(KEY)
    if (TIERS.includes(saved)) { this.tier = saved; this.forced = true }
    else {
      const d = detect(), a = this._autoTier()
      // an earlier slowdown on this device: do not start above it
      this.tier = TIERS.includes(a) && TIERS.indexOf(a) > TIERS.indexOf(d) ? a : d
    }
    if (typeof window !== 'undefined') {
      window.quality = this
      window.__starfieldMs = this.get().loaderMs
      this.onChange(() => { window.__starfieldMs = this.get().loaderMs })
      this._since = performance.now()
      if (!this.forced) this._watch()
      if (perf) this._overlay()
    }
  }

  // a tier the watchdog chose on an earlier visit, if it is under three days old (one bad moment must not stick for ever)
  _autoTier() {
    const [t, at] = (read(KEY_AUTO) || '').split('|')
    return TIERS.includes(t) && Date.now() - Number(at || 0) < 3 * 864e5 ? t : null
  }

  get() { return TABLE[this.tier] }
  // is this feature allowed? (false only when the address switched it off)
  fx(name) { return !this.off.has(name) }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn) }

  set(tier, { auto = false } = {}) {
    if (!TIERS.includes(tier) || tier === this.tier) return
    this.tier = tier; this._since = performance.now()
    if (auto) write(KEY_AUTO, tier + '|' + Date.now()); else { write(KEY, tier); this.forced = true }
    console.log('[quality] tier:', tier, auto ? '(automatic)' : '')
    for (const fn of [...this.listeners]) { try { fn(tier) } catch (e) { console.warn(e) } }
  }

  // back to automatic: forget ?q= and any earlier slowdown, pick by the device, and let the watchdog watch again
  auto() {
    write(KEY, null); write(KEY_AUTO, null)
    this.forced = false
    const d = detect()
    if (d !== this.tier) { this.tier = d; this._since = performance.now(); for (const fn of [...this.listeners]) { try { fn(d) } catch (e) { console.warn(e) } } }
    this._watch()
  }

  // the watchdog: every 3 s, if most frames took longer than 50 ms the tier steps down one (never faster than every 8 s)
  _watch() {
    if (this._watching) return
    this._watching = true
    let last = 0, frames = 0, slow = 0, winStart = 0
    const tick = (t) => {
      if (this.forced) { this._watching = false; return }
      if (last && !document.hidden) {
        const d = t - last
        if (d < 1000) { frames++; if (d > 50) slow++ }
      }
      last = t
      if (!winStart) winStart = t
      if (t - winStart >= 3000) {
        const settled = performance.now() - this._since > 8000
        if (settled && frames > 20 && slow / frames > 0.5) {
          const i = TIERS.indexOf(this.tier)
          if (i < TIERS.length - 1) this.set(TIERS[i + 1], { auto: true })
        }
        this.slow = frames ? slow / frames : 0
        frames = slow = 0; winStart = t
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  _overlay() {
    const el = document.createElement('div')
    el.style.cssText = 'position:fixed;left:6px;top:6px;z-index:99999;font:11px monospace;color:#fff;background:rgba(0,0,0,.6);padding:3px 6px;border-radius:4px;white-space:pre'
    document.body.appendChild(el)
    let last = performance.now(), n = 0, fps = 0
    const loop = (t) => {
      n++
      if (t - last >= 500) { fps = Math.round(n * 1000 / (t - last)); n = 0; last = t; el.textContent = `${this.tier}${this.forced ? '*' : ''}  ${fps} fps${this.off.size ? '\noff: ' + [...this.off].join(',') : ''}` }
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); const i = TIERS.indexOf(this.tier); this.set(TIERS[(i + 1) % TIERS.length]) })
  }
}

export const quality = new Quality()
export default quality

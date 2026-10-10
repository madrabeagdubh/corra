// weatherSky.js
// Location: js/game/effects/weatherSky.js
//
// An overcast sky that takes over from the painted one as the cloud thickens.
//
// The painted sky (pgr-sky-img) is a fair-weather picture with its own
// cumulus, and a grey veil laid over it can dim those clouds but never remove
// them. So this layer is slid into the DOM directly above the painting and
// below the mountains and terrain, and it builds the weather's sky itself:
//
//   sheet   a slate gradient, darker overhead and paler at the horizon. Fades
//           in over cloud 0.78..0.96 and tops out below full opacity, so the
//           painting's paper grain still shows through and the sky does not
//           look flat beside the painted style.
//   dark    a deeper gradient that only comes up as gloom does (rain).
//   banks   soft stratus streaks drifting with the wind. They arrive one by
//           one as cloud rises through 0.62..0.9, which is what makes the
//           in-between days read as broken cloud with patches of painted sky
//           showing between them.
//
// It covers the sky and runs well PAST the horizon (EXTEND), because the
// painted sky shows as a pale band between the horizon line and where the far
// hills actually begin. The two gradients simply thin out as they descend, along
// one long eased curve, so there is no edge anywhere: the grey fades away
// behind the terrain. The banks are tall and round, not streaks. Cost: a dozen
// gradient divs; per frame only transform and opacity change.

import { weather } from './weather.js'
import { wind } from './wind.js'

const BANKS = 9
const EXTEND = 1.8        // layer height as a multiple of the horizon height

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = t => { t = clamp01(t); return t * t * (3 - 2 * t) }

// small seeded generator so the banks are the same on every load
function rng(seed) {
  let a = seed
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class WeatherSky {
  constructor(pgr) {
    this.pgr = pgr
    this._root = null
    this._h = -1
    this._shown = null
    this._last = { sheet: -1, dark: -1 }
    this._banks = []

    const skyImg = pgr?._skyImg
    if (!skyImg?.parentNode) return

    const stale = document.getElementById('pgr-wx-sky')
    if (stale) stale.parentNode?.removeChild(stale)

    const root = document.createElement('div')
    root.id = 'pgr-wx-sky'
    root.style.cssText = [
      'position:absolute', 'left:0', 'top:0', 'width:100%', 'height:0px',
      'z-index:0', 'pointer-events:none', 'overflow:hidden', 'display:none',
    ].join(';')

    // The layer runs well past the horizon (EXTEND x its height) and fades out
    // along an eased curve over the whole of that extra stretch, so there is no
    // line to see anywhere: it just thins to nothing as it goes down.
    this._sheet = this._fill(root, this._fade([
      [0, [104, 114, 126]], [0.42, [142, 152, 162]], [1, [176, 184, 192]]]))
    this._dark = this._fill(root, this._fade([
      [0, [46, 54, 68]], [0.5, [84, 94, 108]], [1, [118, 127, 138]]]))

    const rnd = rng(4242)
    for (let i = 0; i < BANKS; i++) {
      const el = document.createElement('div')
      const yFrac = 0.08 + rnd() * 0.40            // keep the banks well above the fade
      const wFrac = 0.8 + rnd() * 0.8
      const hFrac = 0.22 + rnd() * 0.20          // tall and round: no stripes
      const tone = 150 + Math.round(rnd() * 22)
      const c = `${tone},${tone + 8},${tone + 18}`
      el.style.cssText = [
        'position:absolute', 'left:0', 'top:0', 'opacity:0',
        'will-change:transform,opacity',
        `background:radial-gradient(ellipse at 50% 55%,rgba(${c},0.8) 0%,` +
        `rgba(${c},0.38) 35%,rgba(${c},0.1) 62%,rgba(${c},0) 80%)`,
      ].join(';')
      root.appendChild(el)
      this._banks.push({
        el, yFrac, wFrac, hFrac,
        thr: 0.62 + i * 0.035,                 // cloud level it arrives at
        x: rnd(),                              // 0..1 across the wrap range
        speed: 18 + 30 * (1 - yFrac),          // px/s at wind 1: high cloud is quicker
      })
    }

    // Straight after the painted sky, so DOM order puts it above the sky and
    // below the mountain image and the ground canvases.
    skyImg.insertAdjacentElement('afterend', root)
    this._root = root
  }

  // Vertical gradient through the colour stops [pos 0..1 down the sky, rgb],
  // solid down to the horizon, then alpha falls 1 -> 0 along a smooth curve.
  _fade(cols) {
    const hz = 1 / EXTEND
    const at = (p) => {
      for (let i = 1; i < cols.length; i++) {
        if (p <= cols[i][0] || i === cols.length - 1) {
          const [p0, c0] = cols[i - 1], [p1, c1] = cols[i]
          const t = clamp01((p - p0) / (p1 - p0))
          return c0.map((v, k) => Math.round(v + (c1[k] - v) * t))
        }
      }
    }
    const stops = []
    for (let i = 0; i <= 12; i++) {
      const pos = i / 12 * 100
      const p = Math.min(1, (i / 12) / hz)               // colour position (0..1 to the horizon)
      const u = clamp01((i / 12 - hz) / (1 - hz))        // 0 at the horizon, 1 at the foot
      const a = 1 - smooth(u)
      const e = a * a * (3 - 2 * a)                      // eased twice: long soft tail
      const c = at(p)
      stops.push(`rgba(${c[0]},${c[1]},${c[2]},${e.toFixed(3)}) ${pos.toFixed(1)}%`)
    }
    return `linear-gradient(to bottom,${stops.join(',')})`
  }

  _fill(root, bg) {
    const d = document.createElement('div')
    d.style.cssText = [
      'position:absolute', 'left:0', 'top:0', 'width:100%', 'height:100%',
      `background:${bg}`, 'opacity:0', 'will-change:opacity',
    ].join(';')
    root.appendChild(d)
    return d
  }

  update(dt) {
    if (!this._root) return
    const pgr = this.pgr

    // Maps with no painted sky have nothing to replace.
    const skyImg = pgr._skyImg
    const hasSky = !!(skyImg && skyImg.src && skyImg.style.opacity !== '0')
    if (hasSky !== this._shown) {
      this._root.style.display = hasSky ? 'block' : 'none'
      this._shown = hasSky
    }
    if (!hasSky) return

    const s = weather.state
    const T = weather.tuning

    // size to the sky: top of screen down to a little below the horizon
    const hy = Math.round((pgr._horizonPx?.() ?? (pgr._sh || 0) * 0.4) * EXTEND + 2)
    if (hy !== this._h) {
      this._root.style.height = hy + 'px'
      this._h = hy
    }
    const W = pgr._sw || this._root.clientWidth || 0

    const sheetA = T.skyCover * smooth((s.cloud - T.skyFrom) / (T.skyTo - T.skyFrom))
    const darkA  = T.skyDark * smooth((s.gloom - 0.5) / 0.45) *
                   smooth((s.cloud - T.skyFrom) / (T.skyTo - T.skyFrom))
    if (Math.abs(sheetA - this._last.sheet) > 0.003) {
      this._sheet.style.opacity = sheetA.toFixed(3)
      this._last.sheet = sheetA
    }
    if (Math.abs(darkA - this._last.dark) > 0.003) {
      this._dark.style.opacity = darkA.toFixed(3)
      this._last.dark = darkA
    }

    const drift = wind.strength * wind.dirX
    for (const b of this._banks) {
      const w = W * b.wFrac
      const h = hy * b.hFrac
      const range = W + w * 2
      b.x = (((b.x + (drift * b.speed * dt) / range) % 1) + 1) % 1

      const a = clamp01((s.cloud - b.thr) / 0.10) * T.skyBank
      // a bank is no use once the sheet is solid; ease it out so it does not
      // sit as a darker smear on top of the overcast
      const o = a * (1 - sheetA * 0.8)
      const st = b.el.style
      if (Math.abs(o - (b._o ?? -1)) > 0.004) {
        st.opacity = o.toFixed(3)
        b._o = o
      }
      if (b._w !== Math.round(w) || b._h !== Math.round(h)) {
        st.width = Math.round(w) + 'px'
        st.height = Math.round(h) + 'px'
        b._w = Math.round(w); b._h = Math.round(h)
      }
      const tx = Math.round(b.x * range - w)
      const ty = Math.round(hy * b.yFrac - h * 0.5)
      st.transform = `translate3d(${tx}px,${ty}px,0)`
    }
  }

  destroy() {
    if (this._root?.parentNode) this._root.parentNode.removeChild(this._root)
    this._root = null
    this._banks = []
  }
}

export default WeatherSky

// tiltShift.js  (v1.1 — focus follows player, buildings stay sharp)
// Location: js/game/effects/tiltShift.js
//
// ── What this is ─────────────────────────────────────────────────────────────
// Depth-of-field, aerial haze and vignette for the PGR, done entirely with DOM
// overlays. No per-frame canvas work — the browser compositor does the blur.
//
// ── Why DOM and not Phaser postFX ────────────────────────────────────────────
// The PGR renders the world onto its own DOM canvases (pgr-sky-img z:0,
// pgr-ground z:2, pgr-objects z:3, pgr-light z:4). The Phaser canvas sits above
// at z:10 and holds ONLY the UI. A Phaser camera pipeline would therefore blur
// the HUD and leave the world sharp. Overlays at z:5–6 sit above every world
// layer and below all UI.
//
// ── The screen-row assumption, and where it breaks ───────────────────────────
// The effect is screen-space: it has no per-object depth, and treats screen row
// as a proxy for distance. That holds for GROUND pixels. It does not hold for
// anything TALL — a roundhouse standing right next to the player still occupies
// rows near the top of the screen, so a naive top-of-screen blur band leaves it
// permanently soft no matter how close you walk.
//
// Two mechanisms compensate, both driven from update():
//
//   1. follow — the sharp band tracks pgr.playerScreenY, so walking north into
//      the distance carries focus with you instead of leaving you in the blur.
//
//   2. building-aware clamp — pgrBuildings records each drawn building's screen
//      extent on pgr._tsSpans. Any building whose BASE sits inside or below the
//      sharp band is near enough to deserve full sharpness, so the far band is
//      pushed up above that building's roofline. Buildings whose base is above
//      the band are genuinely distant and stay blurred.
//
// Trees, cliffs and other tall billboards are NOT clamped — only buildings are
// recorded. On forest maps prefer a low farBlur over trying to extend this.
//
// ── Layers created ───────────────────────────────────────────────────────────
//   pgr-ts-far     z:5  backdrop blur, top of screen, masked to fade into focus
//   pgr-ts-near    z:5  backdrop blur, bottom of screen, weaker
//   pgr-ts-haze    z:5  aerial perspective tint, horizon downward
//   pgr-ts-vig     z:6  vignette
//
// ── Usage ────────────────────────────────────────────────────────────────────
//   Wired by PerspectiveScene. A map opts out with getTiltShift() { return false }
//   Tune live:
//     game.scene.getScene('b0').tiltShift.configure({ farBlur: 6 })
//     game.scene.getScene('b0').tiltShift.setEnabled(false)

const IDS = ['pgr-ts-far', 'pgr-ts-near', 'pgr-ts-haze', 'pgr-ts-vig']

export const TILT_SHIFT_DEFAULTS = {
  enabled: true,

  // ── Focus band ────────────────────────────────────────────────────────────
  // Fractions of screen height, 0 = top. Used as the starting value, and as a
  // fixed value when follow is off.
  focusY: 0.62,
  focusHeight: 0.20,

  // ── Follow ────────────────────────────────────────────────────────────────
  // Track pgr.playerScreenY. Clamped so the band can never collapse against
  // either screen edge.
  follow: true,
  followMin: 0.30,
  followMax: 0.80,
  // Minimum change (screen fractions) before the DOM is touched. Below this we
  // skip the write entirely — the CSS transition covers the gaps.
  followThreshold: 0.01,
  // Transition applied to the band geometry, so focus glides rather than steps.
  followEase: '0.35s linear',

  // ── Blur ──────────────────────────────────────────────────────────────────
  farBlur: 4,
  nearBlur: 2,
  // Fraction of each blur band held at full strength before fading into the
  // sharp zone. Lower = softer, longer transition.
  farHold: 0.45,
  nearHold: 0.40,

  // ── Aerial perspective ────────────────────────────────────────────────────
  hazeAmount: 0.16,
  hazeColor: '#9fb2c4',
  // Where haze begins. Defaults to the PGR horizon so the sky is left alone.
  hazeTop: null,

  // ── Vignette ──────────────────────────────────────────────────────────────
  vignette: 0.22,
  vignetteColor: '#000000',
}

function backdropSupported() {
  if (typeof CSS === 'undefined' || !CSS.supports) return false
  return CSS.supports('backdrop-filter', 'blur(2px)') ||
         CSS.supports('-webkit-backdrop-filter', 'blur(2px)')
}

function hexToRgb(hex) {
  const h = String(hex).replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}

const clamp01 = v => Math.max(0, Math.min(1, v))

export class TiltShift {
  constructor(scene, opts = {}) {
    this.scene = scene
    this.pgr   = opts.pgr || scene.perspectiveGround || scene.pgr || null
    this.cfg   = { ...TILT_SHIFT_DEFAULTS, ...opts }

    // Live band state, in screen fractions.
    this._focusY    = this.cfg.focusY
    this._farBottom = clamp01(this.cfg.focusY - this.cfg.focusHeight * 0.5)

    this.hasBackdrop = backdropSupported()
    if (!this.hasBackdrop) {
      console.log('[TiltShift] backdrop-filter unavailable — haze + vignette only')
    }

    const canvas = scene.game?.canvas
    if (!canvas || !canvas.parentNode) {
      console.warn('[TiltShift] no Phaser canvas parent; effect not created')
      this.container = null
      return
    }
    this.container = canvas.parentNode

    this._removeExisting()
    this._build()
    this.apply()
  }

  _removeExisting() {
    IDS.forEach(id => {
      const el = document.getElementById(id)
      if (el) el.parentNode?.removeChild(el)
    })
  }

  _makeDiv(id, zIndex, eased) {
    const d = document.createElement('div')
    d.id = id
    // Percentage sizing means resize and fullscreen are handled for free.
    const css = [
      'position:absolute', 'left:0', 'width:100%',
      `z-index:${zIndex}`, 'pointer-events:none',
    ]
    if (eased && this.cfg.follow) {
      css.push(`transition:top ${this.cfg.followEase},height ${this.cfg.followEase}`)
    }
    d.style.cssText = css.join(';')
    this.container.appendChild(d)
    return d
  }

  _build() {
    this.far  = this.hasBackdrop ? this._makeDiv('pgr-ts-far', 5, true)  : null
    this.near = this.hasBackdrop ? this._makeDiv('pgr-ts-near', 5, true) : null
    this.haze = this._makeDiv('pgr-ts-haze', 5, true)
    this.vig  = this._makeDiv('pgr-ts-vig', 6, false)
  }

  configure(opts = {}) {
    Object.assign(this.cfg, opts)
    if (opts.focusY !== undefined) this._focusY = opts.focusY
    this.apply()
    return this
  }

  setFocus(focusY, focusHeight) {
    this._focusY = focusY
    this.cfg.focusY = focusY
    if (focusHeight !== undefined) this.cfg.focusHeight = focusHeight
    return this.apply()
  }

  setEnabled(on) {
    this.cfg.enabled = !!on
    return this.apply()
  }

  /**
   * Per-frame. Cheap: computes two numbers and returns without touching the
   * DOM unless the band actually moved past followThreshold.
   * Called by PerspectiveScene.update() after perspectiveGround.update().
   */
  update(pgr) {
    if (!this.container || !this.cfg.enabled || !this.cfg.follow) return
    const g = pgr || this.pgr
    if (!g) return

    const h = g._sh || this.container.clientHeight
    const py = g.playerScreenY
    if (!h || py == null) return

    const focusY = Math.max(this.cfg.followMin,
                            Math.min(this.cfg.followMax, py / h))

    // Far band normally ends at the top of the sharp band...
    let farBottom = clamp01(focusY - this.cfg.focusHeight * 0.5)

    // ...but no building whose base is at or below that line may be clipped by
    // it. Such a building is near enough to be in focus, and blurring its upper
    // half would look exactly like the bug this fixes.
    const spans = g._tsSpans
    if (spans && spans.length) {
      const cutPx = farBottom * h
      for (let i = 0; i < spans.length; i++) {
        const s = spans[i]
        if (s.base >= cutPx && s.top < cutPx) farBottom = clamp01(s.top / h)
      }
    }

    const t = this.cfg.followThreshold
    if (Math.abs(focusY - this._focusY) < t &&
        Math.abs(farBottom - this._farBottom) < t) return

    this._focusY    = focusY
    this._farBottom = farBottom
    this.apply()
  }

  /** Writes current state to the DOM. */
  apply() {
    if (!this.container) return this
    const c = this.cfg
    const off = !c.enabled

    const half        = c.focusHeight * 0.5
    const focusY      = c.follow ? this._focusY : c.focusY
    const focusTop    = clamp01(focusY - half)
    const focusBottom = clamp01(focusY + half)
    const farBottom   = c.follow ? Math.min(this._farBottom, focusTop) : focusTop

    // ── Far blur ────────────────────────────────────────────────────────────
    if (this.far) {
      const hPct = farBottom * 100
      const hold = Math.round(c.farHold * 100)
      // The mask fades the blurred layer out toward the sharp band. Partial
      // opacity over the sharp original reads as a lighter blur, giving a
      // smooth falloff for free.
      const mask = `linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) ${hold}%, rgba(0,0,0,0) 100%)`
      this._style(this.far, {
        top: '0',
        height: hPct + '%',
        display: (off || hPct <= 0 || c.farBlur <= 0) ? 'none' : 'block',
        backdropFilter: `blur(${c.farBlur}px)`,
        WebkitBackdropFilter: `blur(${c.farBlur}px)`,
        maskImage: mask,
        WebkitMaskImage: mask,
      })
    }

    // ── Near blur ───────────────────────────────────────────────────────────
    if (this.near) {
      const hPct = (1 - focusBottom) * 100
      const hold = Math.round(c.nearHold * 100)
      const mask = `linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,1) ${hold}%, rgba(0,0,0,0) 100%)`
      this._style(this.near, {
        top: (focusBottom * 100) + '%',
        height: hPct + '%',
        display: (off || hPct <= 0 || c.nearBlur <= 0) ? 'none' : 'block',
        backdropFilter: `blur(${c.nearBlur}px)`,
        WebkitBackdropFilter: `blur(${c.nearBlur}px)`,
        maskImage: mask,
        WebkitMaskImage: mask,
      })
    }

    // ── Aerial haze ─────────────────────────────────────────────────────────
    if (this.haze) {
      const horizon = c.hazeTop != null
        ? c.hazeTop
        : (this.pgr?.constructor?.HORIZON_Y_FRAC ?? 0.28)
      const hPct = Math.max(0, focusBottom - horizon) * 100
      this._style(this.haze, {
        top: (horizon * 100) + '%',
        height: hPct + '%',
        display: (off || hPct <= 0 || c.hazeAmount <= 0) ? 'none' : 'block',
        background: `linear-gradient(to bottom, ${rgba(c.hazeColor, c.hazeAmount)} 0%, ${rgba(c.hazeColor, 0)} 100%)`,
      })
    }

    // ── Vignette ────────────────────────────────────────────────────────────
    if (this.vig) {
      this._style(this.vig, {
        top: '0',
        height: '100%',
        display: (off || c.vignette <= 0) ? 'none' : 'block',
        background: `radial-gradient(ellipse at center, ${rgba(c.vignetteColor, 0)} 45%, ${rgba(c.vignetteColor, c.vignette)} 100%)`,
      })
    }

    return this
  }

  _style(el, props) {
    for (const k in props) el.style[k] = props[k]
  }

  destroy() {
    this._removeExisting()
    this.far = this.near = this.haze = this.vig = null
    this.container = null
  }
}

export default TiltShift

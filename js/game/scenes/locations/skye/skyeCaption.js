// skyeCaption.js
// Location: js/game/scenes/locations/skye/skyeCaption.js
//
// A spoken line that is NOT a dialogue card. Cards hide the d-pad (so a
// mistap can't walk the player off mid-sentence), which is exactly wrong
// for lines the player must act on while moving: drill calls, a shout
// from across the lane. These sit at the top of the screen instead.
//
// Irish always shown; English beneath at the moon slider's opacity, and
// follows the slider live.

import { GameSettings } from '../../../settings/gameSettings.js'
import { FONTS, COLORS } from '../../../systems/gameTypography.js'

export default class SkyeCaption {
  constructor() {
    document.getElementById('skye-caption')?.remove()
    const el = document.createElement('div')
    el.id = 'skye-caption'
    el.style.cssText = [
      'position:fixed', 'left:50%', 'top:13%', 'transform:translateX(-50%)',
      'max-width:88vw', 'text-align:center', 'pointer-events:none',
      'z-index:1000003', 'opacity:0', 'transition:opacity 0.25s ease',
      'text-shadow:0 0 6px #000, 0 0 12px #000',
    ].join(';')
    this._ga = document.createElement('div')
    this._ga.style.cssText = `font-family:${FONTS.irish};font-size:26px;line-height:1.25;color:${COLORS?.irish || '#f3e6c4'};white-space:pre-line`
    this._en = document.createElement('div')
    this._en.style.cssText = `font-family:${FONTS.english};font-size:14px;margin-top:6px;color:#e8e0cc;white-space:pre-line;transition:opacity 0.2s`
    el.append(this._ga, this._en)
    document.body.appendChild(el)
    this._el = el

    this._onOpacity = (e) => { this._en.style.opacity = String(e.detail.opacity) }
    window.addEventListener('englishOpacityChange', this._onOpacity)
  }

  /** Show a line. holdMs = null keeps it up until the next show()/hide(). */
  show(ga, en, holdMs = null) {
    clearTimeout(this._timer)
    this._ga.textContent = ga
    this._en.textContent = en
    this._en.style.opacity = String(GameSettings.englishOpacity)
    this._el.style.opacity = '1'
    if (holdMs) this._timer = setTimeout(() => this.hide(), holdMs)
  }

  hide() {
    clearTimeout(this._timer)
    if (this._el) this._el.style.opacity = '0'
  }

  /** Reading time for a line, roughly. */
  static holdFor(text) { return 2200 + text.length * 55 }

  destroy() {
    clearTimeout(this._timer)
    window.removeEventListener('englishOpacityChange', this._onOpacity)
    this._el?.remove()
    this._el = null
  }
}

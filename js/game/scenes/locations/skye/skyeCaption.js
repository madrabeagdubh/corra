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
//
// Two kinds of line:
//   show(ga, en, ms)   a movement call (drill steps, nudges) -- the world
//                      stays as it is, focused on the player
//   speak(ga, en, ms)  a spoken moment -- the tilt-shift goes into dialogue
//                      mode (softer, page-like) with its sharp band racked
//                      onto the speaker (opts.focusOn -> [tx, ty])
// No backing box: the dialogue blur is what makes the page readable.

import { GameSettings } from '../../../settings/gameSettings.js'
import { TYPE, FONTS } from '../../../systems/gameTypography.js'
import { createContrast } from '../../../ui/textContrast.js'
import { figureBox } from './dustDash.js'

// Speaker colours for the Irish line: each Skye teacher gets one vivid,
// readable colour so you know who's calling before you've read a word.
export const SPEAKER = {
  uathach: '#ffb25c',      // warm amber -- quick, bright, a little fierce
}

export default class SkyeCaption {
  // opts.color:   the Irish line's colour (default Uathach's)
  // opts.scene:   the scene (for its tilt-shift and PGR)
  // opts.focusOn: () => [tx, ty] of the speaker, or null if not visible
  constructor(opts = {}) {
    this._scene = opts.scene || null
    this._focusOn = opts.focusOn || null
    document.getElementById('skye-caption')?.remove()
    const el = document.createElement('div')
    el.id = 'skye-caption'
    el.style.cssText = [
      'position:fixed', 'left:50%', 'top:12%', 'transform:translateX(-50%)',
      'max-width:90vw', 'text-align:center', 'pointer-events:none',
      'z-index:1000003', 'opacity:0', 'transition:opacity 0.25s ease',
    ].join(';')
    this._color = opts.color || SPEAKER.uathach
    this._ga = document.createElement('div')
    this._ga.style.cssText = `font-family:${TYPE.cardBody.font};font-size:${TYPE.cardBody.size};` +
      `line-height:1.25;color:${opts.color || SPEAKER.uathach};white-space:pre-line;` +
      'text-shadow:0 1px 2px #000, 0 0 6px rgba(0,0,0,0.9), 0 0 14px rgba(0,0,0,0.6)'
    this._en = document.createElement('div')
    // The English line is the return crossing's: its size, crisp (no shadow or
    // outline), and an ink that picks itself against what's behind it.
    this._en.style.cssText = `font-family:${FONTS.english};font-size:${TYPE.domBodyEn.sizePx}px;` +
      'line-height:1.3;margin-top:6px;color:rgb(230,237,245);white-space:pre-line;text-shadow:none'
    this._contrast = createContrast()
    this._inkTimer = setInterval(() => this._ink(), 220)
    el.append(this._ga, this._en)
    document.body.appendChild(el)
    this._el = el

    this._onOpacity = (e) => { this._en.style.opacity = String(e.detail.opacity) }
    window.addEventListener('englishOpacityChange', this._onOpacity)
  }

  // what is behind the English line: the game's canvases, back to front
  _ink() {
    if (!this._el || this._el.style.opacity === '0') return
    const pgr = this._scene?.perspectiveGround
    const src = [pgr?._skyImg, pgr?._groundCanvas, pgr?._objectCanvas].filter(Boolean)
    const el = this._en
    this._contrast.update(el, src, () => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } })
  }

  /** A movement call. holdMs = null keeps it up until the next show()/hide(). */
  show(ga, en, holdMs = null) {
    this._unfocus()
    this._put(ga, en, holdMs)
  }

  /** A spoken moment: dialogue-mode blur, focus racked onto the speaker. */
  speak(ga, en, holdMs = null) {
    this._put(ga, en, holdMs)
    const ts = this._scene?.tiltShift, pgr = this._scene?.perspectiveGround
    const at = this._focusOn?.()
    const box = at && figureBox(this._scene, at[0], at[1])
    const y = box && pgr?._sh ? (box.y - box.h * 0.5) / pgr._sh : null
    ts?.setDialogueMode?.(true, y)
    this._speaking = !!ts
    if (this._scene) this._scene._speakTile = at ? [at[0], at[1]] : null         // the camera comes in on the speaker
  }

  // For a moment the English line reads something else, then corrects
  // itself. Only a player reading both lines can catch it.
  flickerEnglish(fake, ms = 450) {
    const real = this._en.textContent
    this._en.textContent = fake
    clearTimeout(this._flick)
    this._flick = setTimeout(() => { if (this._en) this._en.textContent = real }, ms)
  }

  _unfocus() {
    if (!this._speaking) return
    this._speaking = false
    if (this._scene) this._scene._speakTile = null
    this._scene?.tiltShift?.setDialogueMode?.(false)
  }

  /** The next line only, in another speaker's colour (a student, say). */
  setColor(c) { this._nextColor = c }

  _put(ga, en, holdMs) {
    clearTimeout(this._timer)
    this._ga.style.color = this._nextColor || this._color
    this._nextColor = null
    this._ga.textContent = ga
    this._en.textContent = en
    this._en.style.opacity = String(GameSettings.englishOpacity)
    this._el.style.opacity = '1'
    if (holdMs) this._timer = setTimeout(() => this.hide(), holdMs)
  }

  hide() {
    clearTimeout(this._timer)
    this._unfocus()
    if (this._el) this._el.style.opacity = '0'
  }

  /** Reading time for a line, roughly. */
  static holdFor(text) { return 2200 + text.length * 55 }

  destroy() {
    clearTimeout(this._timer)
    clearInterval(this._inkTimer)
    this._unfocus()
    window.removeEventListener('englishOpacityChange', this._onOpacity)
    this._el?.remove()
    this._el = null
  }
}

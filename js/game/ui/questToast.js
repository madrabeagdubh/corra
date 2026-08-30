// questToast.js
//
// Small notification card that rises above the status bar footer strip when
// a quest starts or completes. Deliberately not part of the status bar
// element itself -- that div is pointer-events:none and shared/recreated
// per scene (see statusBar.js) -- this mounts its own element into
// #gameContainer, positioned off STATUS_BAR_HEIGHT, and tears itself down
// after its animation regardless of scene transitions.
//
// Usage:
//   import { showQuestToast } from '/js/game/ui/questToast.js'
//   showQuestToast({ status: 'active', titleGa, titleEn, hint: true })

import { FONTS, COLORS } from '../systems/gameTypography.js'
import { STATUS_BAR_HEIGHT } from './statusBar.js'

const HOLD_MS   = 3200
const FADE_MS   = 350
const HEADER_FONT = "'IrishPenny', serif"

let _active = null   // one at a time; a second call replaces the first

export function showQuestToast({ status, titleGa, titleEn, hint = false }) {
  const container = document.getElementById('gameContainer') || document.body
  if (!container) return

  if (_active) {
    clearTimeout(_active._timers[0])
    clearTimeout(_active._timers[1])
    _active.remove()
    _active = null
  }

  const headerGa = status === 'complete' ? 'Misean Críochnaithe!' : 'Misean Nua!'
  const headerEn = status === 'complete' ? 'Objective Complete!'  : 'New Quest!'
  const gold     = COLORS.queen

  const el = document.createElement('div')
  el.style.cssText = [
    'position:absolute',
    `bottom:${STATUS_BAR_HEIGHT + 10}px`,
    'left:50%',
    'transform:translateX(-50%) translateY(8px)',
    'max-width:88%',
    'z-index:60',
    'pointer-events:none',
    'padding:0.55rem 1rem',
    'border-radius:8px',
    'background:rgba(8,6,2,0.92)',
    `border:1px solid ${gold}66`,
    'text-align:center',
    'opacity:0',
    `transition:opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
  ].join(';')

  const header = document.createElement('div')
  header.style.cssText = `font-family:${HEADER_FONT};font-size:1rem;color:${gold};letter-spacing:0.02em;`
  header.textContent = `${headerGa} / ${headerEn}`
  el.appendChild(header)

  const title = document.createElement('div')
  title.style.cssText = `font-family:${FONTS.irish};font-size:0.95rem;color:${COLORS.irish};margin-top:0.15rem;`
  title.textContent = titleGa
  el.appendChild(title)

  const titleEnEl = document.createElement('div')
  titleEnEl.style.cssText = `font-family:${FONTS.english};font-size:0.72rem;color:${COLORS.english};margin-top:0.1rem;`
  titleEnEl.textContent = titleEn
  el.appendChild(titleEnEl)

  if (hint) {
    const hintEl = document.createElement('div')
    hintEl.style.cssText = `font-family:${FONTS.ui};font-size:0.68rem;color:${COLORS.uiDim};margin-top:0.3rem;`
    hintEl.textContent = 'coinnigh do mhéar ar an ngealach — Dialann / hold the moon — Log'
    el.appendChild(hintEl)
  }

  container.appendChild(el)
  requestAnimationFrame(() => {
    el.style.opacity = '1'
    el.style.transform = 'translateX(-50%) translateY(0)'
  })

  const t1 = setTimeout(() => {
    el.style.opacity = '0'
    el.style.transform = 'translateX(-50%) translateY(8px)'
  }, HOLD_MS)
  const t2 = setTimeout(() => {
    el.remove()
    if (_active === el) _active = null
  }, HOLD_MS + FADE_MS)

  el._timers = [t1, t2]
  _active = el
}

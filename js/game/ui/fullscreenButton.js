/**
 * fullscreenButton.js
 *
 * Floating fullscreen-restore button, overlaid exactly on the moon widget.
 * Only shown when the main game is active — i.e. #heroSelect is gone and
 * #gameContainer is visible. This excludes introModal and hero select screens.
 *
 * Hidden on iOS (no Fullscreen API).
 *
 * Call once at module load time in main.js:
 *   import { initFullscreenButton } from './ui/fullscreenButton.js'
 *   initFullscreenButton()
 */

import { requestFullscreenWithFade } from './fullscreenFade.js'

export function initFullscreenButton() {
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return

  const btn = document.createElement('button')
  btn.id = 'pgr-fullscreen-btn'
  // [fsIcon] the whole tile is the tap target; the icon is four bare white corners, wide apart, with a dark halo so they read on any moon
  const ico = document.createElement('span')
  ico.style.cssText = 'position:absolute;left:50%;top:50%;width:62%;height:62%;transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;pointer-events:none'
  ico.innerHTML = '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 1.5px rgba(0,0,0,0.95)) drop-shadow(0 0 4px rgba(0,0,0,0.6))"><path d="M2 7V2h5M17 2h5v5M22 17v5h-5M7 22H2v-5"/></svg>'
  btn.appendChild(ico)
  btn.style.cssText = [
    'position:fixed',
    'z-index:2147483647',     // max z-index — guaranteed on top of everything
    'background:none',
    'border:none',
    'border-radius:50%',
    'cursor:pointer',
    'display:none',
    'pointer-events:auto',
    'transform:translate(-50%,-50%)',
    'padding:0',
    'line-height:1',
  ].join(';')

  const isGameActive = () => {
    // Must not be in introModal / hero select phase
    const heroSelect = document.getElementById('heroSelect')
    if (heroSelect && heroSelect.style.display !== 'none' && heroSelect.style.opacity !== '0') return false

    // gameContainer must be present and visible
    const gc = document.getElementById('gameContainer')
    return gc && gc.style.display !== 'none'
  }

  // Returns true if position was found and applied, false if moon not ready yet
  const tryPositionOverMoon = () => {
    const moon =
      document.querySelector('[style*="ciorcal-glass-bg"]') ??
      document.getElementById('moon-widget')

    if (!moon) return false

    const r = moon.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return false

    btn.style.left   = `${r.left + r.width  / 2}px`
    btn.style.top    = `${r.top  + r.height / 2}px`
    btn.style.width  = `${r.width}px`
    btn.style.height = `${r.height}px`
    return true
  }

  btn.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault() })
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    requestFullscreenWithFade()
  })

  const update = () => {
    const inFS = !!(document.fullscreenElement || document.webkitFullscreenElement)

    // Hide when fullscreen or pre-game screens are showing
    if (inFS || !isGameActive()) {
      btn.style.display = 'none'
      return
    }

    // Position first — only show once we know where it goes
    if (tryPositionOverMoon()) {
      btn.style.display = 'block'
    } else {
      btn.style.display = 'none'
    }
  }

  document.addEventListener('fullscreenchange',       update)
  document.addEventListener('webkitfullscreenchange', update)
  window.addEventListener('resize', update)

  // Poll so the button appears as soon as gameContainer becomes visible
  // and stays correctly positioned as the moon widget may move (e.g. resize)
  setInterval(update, 600)

  update()
  document.body.appendChild(btn)
}


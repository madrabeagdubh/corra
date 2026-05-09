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

export function initFullscreenButton() {
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return

  const btn = document.createElement('button')
  btn.id = 'pgr-fullscreen-btn'
  btn.textContent = '⛶'
  btn.style.cssText = [
    'position:fixed',
    'z-index:2147483647',     // max z-index — guaranteed on top of everything
    'font-size:20px',
    'background:rgba(0,0,0,0.45)',
    'color:white',
    'border:1px solid rgba(255,255,255,0.25)',
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
    const el = document.documentElement
    if      (el.requestFullscreen)       el.requestFullscreen()
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
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


/**
 * fullscreenButton.js
 *
 * Floating fullscreen-restore button, overlaid exactly on the moon widget.
 * Appears only when not in fullscreen AND the main game is running
 * (i.e. #gameContainer is visible). This naturally excludes introModal,
 * which hides #gameContainer while it runs.
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
    'z-index:1000004',        // above moon widget (1000003)
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
    const gc = document.getElementById('gameContainer')
    return gc && gc.style.display !== 'none' && gc.style.display !== ''
  }

  const positionOverMoon = () => {
    const moon =
      document.querySelector('[style*="ciorcal-glass-bg"]') ??
      document.getElementById('moon-widget')

    if (!moon) {
      setTimeout(positionOverMoon, 200)
      return
    }

    const r = moon.getBoundingClientRect()
    if (r.width === 0) {
      setTimeout(positionOverMoon, 200)
      return
    }

    btn.style.left   = `${r.left + r.width  / 2}px`
    btn.style.top    = `${r.top  + r.height / 2}px`
    btn.style.width  = `${r.width}px`
    btn.style.height = `${r.height}px`
  }

  btn.addEventListener('click', () => {
    const el = document.documentElement
    if      (el.requestFullscreen)       el.requestFullscreen()
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
  })

  const update = () => {
    const inFS = !!(document.fullscreenElement || document.webkitFullscreenElement)
    // Only show when: not fullscreen AND the main game (not introModal) is active
    if (inFS || !isGameActive()) {
      btn.style.display = 'none'
      return
    }
    positionOverMoon()
    btn.style.display = 'block'
  }

  document.addEventListener('fullscreenchange',       update)
  document.addEventListener('webkitfullscreenchange', update)
  window.addEventListener('resize', update)

  // Poll so the button appears as soon as gameContainer becomes visible
  // (e.g. after introModal completes and startGame() is called)
  setInterval(update, 600)

  update()
  document.body.appendChild(btn)
}


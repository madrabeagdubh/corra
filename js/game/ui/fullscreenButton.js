/**
 * fullscreenButton.js
 *
 * Floating fullscreen-restore button, overlaid exactly on the moon widget.
 * Appears only when not in fullscreen. Hidden on iOS (no Fullscreen API).
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

  const positionOverMoon = () => {
    // Find moon widget by its background image — unique to that element
    const moon =
      document.querySelector('[style*="ciorcal-glass-bg"]') ??
      document.getElementById('moon-widget')

    if (!moon) {
      // Not in DOM yet — retry shortly
      setTimeout(positionOverMoon, 200)
      return
    }

    const r = moon.getBoundingClientRect()
    if (r.width === 0) {
      // Not laid out yet
      setTimeout(positionOverMoon, 200)
      return
    }

    const cx = r.left + r.width  / 2
    const cy = r.top  + r.height / 2

    btn.style.left   = `${cx}px`
    btn.style.top    = `${cy}px`
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
    if (!inFS) positionOverMoon()
    btn.style.display = inFS ? 'none' : 'block'
  }

  document.addEventListener('fullscreenchange',       update)
  document.addEventListener('webkitfullscreenchange', update)

  // Re-position whenever window resizes (browser bar appearing/disappearing)
  window.addEventListener('resize', () => {
    const inFS = !!(document.fullscreenElement || document.webkitFullscreenElement)
    if (!inFS) positionOverMoon()
  })

  update()
  document.body.appendChild(btn)
}


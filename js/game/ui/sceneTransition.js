import { SoundBoard } from '../systems/soundBoard.js'
/**
 * sceneTransition.js
 * Global fade+spinner overlay for scene transitions.
 * Usage:
 *   import { transitionOut, transitionIn } from './sceneTransition.js'
 *   await transitionOut()   // fade to black + show spinner
 *   // ... start new scene ...
 *   transitionIn()          // fade back in
 */

let _overlay = null

function _getOverlay() {
  if (_overlay) return _overlay
  _overlay = document.createElement('div')
  _overlay.id = 'scene-transition-overlay'
  _overlay.style.cssText = [
    'position:fixed;inset:0;',
    'background:#000;',
    'z-index:9999999;',
    'opacity:0;',
    'pointer-events:none;',
    'transition:opacity 0.4s ease;',
    'display:block;',  // spinner positioned absolutely over moon
  ].join('')

  // Celtic knot spinner -- positioned over moon hub
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '80')
  svg.setAttribute('height', '80')
  svg.setAttribute('viewBox', '0 0 80 80')
  svg.style.cssText = [
    'position:fixed;',
    'width:80px;height:80px;',
    'opacity:0;transition:opacity 0.2s ease 0.2s;',
    'pointer-events:none;',
  ].join('')
  svg.innerHTML = `
    <circle cx="40" cy="40" r="30" fill="none" stroke="#d4af37" stroke-width="2" stroke-opacity="0.3"/>
    <circle cx="40" cy="40" r="30" fill="none" stroke="#d4af37" stroke-width="2.5"
      stroke-dasharray="47 141" stroke-linecap="round">
      <animateTransform attributeName="transform" type="rotate"
        from="0 40 40" to="360 40 40" dur="1.2s" repeatCount="indefinite"/>
    </circle>
    <circle cx="40" cy="40" r="18" fill="none" stroke="#d4af37" stroke-width="1.5"
      stroke-dasharray="28 84" stroke-linecap="round">
      <animateTransform attributeName="transform" type="rotate"
        from="360 40 40" to="0 40 40" dur="0.9s" repeatCount="indefinite"/>
    </circle>
  `
  _overlay.appendChild(svg)
  _overlay._spinner = svg
  document.body.appendChild(_overlay)
  return _overlay
}

export function transitionOut(duration = 400) {
  console.log('[transitionOut] called from:', new Error().stack.split('\n')[2])
  SoundBoard.playWeb('SCENE_TRANSITION')
  return new Promise(resolve => {
    const overlay = _getOverlay()
    // Position spinner over moon hub
    const moonEl = document.getElementById('dpad-moon-hub')
    const spinner = overlay._spinner
    if (moonEl && spinner) {
      const r = moonEl.getBoundingClientRect()
      spinner.style.left = (r.left + r.width/2 - 40) + 'px'
      spinner.style.top  = (r.top  + r.height/2 - 40) + 'px'
    } else if (spinner) {
      spinner.style.left = (window.innerWidth/2 - 40) + 'px'
      spinner.style.top  = (window.innerHeight - 120) + 'px'
    }
    overlay.style.pointerEvents = 'all'
    overlay.style.opacity = '1'
    if (spinner) spinner.style.opacity = '1'
    setTimeout(resolve, duration)
  })
}

export function transitionIn(duration = 400) {
  const overlay = _getOverlay()
  setTimeout(() => {
    if (overlay._spinner) overlay._spinner.style.opacity = '0'
    overlay.style.opacity = '0'
    overlay.style.pointerEvents = 'none'
  }, 100)
}

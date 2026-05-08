/**
 * statusBar.js
 *
 * Minimal status bar — solid opaque strip at the bottom of the screen.
 * No icons, no content. Primary purpose: mask the browser navigation area.
 *
 * Usage:
 *   import { createStatusBar, STATUS_BAR_HEIGHT } from '/js/game/ui/statusBar.js'
 *
 *   this._statusBar = createStatusBar(document.getElementById('gameContainer'))
 *   // returns the div element directly (same API as bogLocationScene used)
 *
 *   // cleanup:
 *   if (this._statusBar?.parentNode) {
 *     this._statusBar.parentNode.removeChild(this._statusBar)
 *     this._statusBar = null
 *   }
 */

export const STATUS_BAR_HEIGHT = 42

export function createStatusBar(container) {
  // Remove any existing bar
  document.getElementById('status-bar')?.remove()

  const bar = document.createElement('div')
  bar.id = 'status-bar'
  bar.style.cssText = [
    'position:absolute',
    'bottom:0',
    'left:0',
    'right:0',
    `height:${STATUS_BAR_HEIGHT}px`,
    'z-index:50',
    'pointer-events:none',
    'background:rgba(45,35,20,1)',   // solid opaque — matches bog scene
  ].join(';')

  const parent = container ?? document.getElementById('gameContainer') ?? document.body
  parent.appendChild(bar)

  return bar   // return the element directly, matching bogLocationScene's usage
}


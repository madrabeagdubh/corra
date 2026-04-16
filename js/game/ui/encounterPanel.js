/**
 * encounterPanel.js
 *
 * Encounter UI for Corra.
 *
 * Proximity flow:
 *   1. scene calls notify(card, zoneObj) -- badge appears on moon, no movement lock
 *   2. Player walks away -- badge fades, clearNotify() called automatically
 *   3. Player taps moon while badge is showing -- panel opens
 *
 * Panel:
 *   - Fullscreen dark overlay (z-index below moon so opacity slider still works)
 *   - Object graphic large at top centre
 *   - ScrollingTextPlayer for bilingual narrative
 *   - Action buttons appear after text reaches ceiling
 *   - English opacity responds to moon in real time via getMoonPhase
 *
 * Card shape:
 *   {
 *     id:      'enc_chest',
 *     visual:  { gid: 255, flat: false },
 *     ga:      '...',
 *     en:      '...',
 *     actions: [
 *       {
 *         labelGa: 'Oscail',
 *         labelEn: 'Open',
 *         outcome: {
 *           type:       'loot' | 'persist' | 'dismiss',
 *           visualSwap: { gid: 197, flat: false },
 *           sound:      'creak1',
 *           textGa:     '...',
 *           textEn:     '...',
 *         }
 *       }
 *     ]
 *   }
 */

import { ScrollingTextPlayer } from './scrollingTextPlayer.js'
import { GameSettings }        from '../settings/gameSettings.js'

const BADGE_FADE_MS = 400

export class EncounterPanel {

  constructor(scene, moonWidget) {
    this._scene       = scene
    this._moonWidget  = moonWidget
    this._active      = null
    this._card        = null
    this._isOpen      = false
    this._textPlayer  = null
    this._buttonTimer = null
    this._overlayEl   = null
    this._graphicEl   = null
    this._buttonsEl   = null
    this._tapDismiss  = null

    this._buildBadge()
    this._buildOverlay()
  }

  // ── Badge ─────────────────────────────────────────────────────────────────
  // Sits centred over the moon canvas, same size as the moon.

  _buildBadge() {
    const moonCanvas = this._moonWidget.element.querySelector('canvas')
    const size       = moonCanvas ? (moonCanvas.offsetWidth || moonCanvas.width || 48) : 48

    const badge = document.createElement('canvas')
    badge.width  = size
    badge.height = size
    badge.style.cssText = [
      'position:absolute',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%)',
      `width:${size}px`,
      `height:${size}px`,
      'border-radius:50%',
      'cursor:pointer',
      'display:none',
      'opacity:0',
      `transition:opacity ${BADGE_FADE_MS}ms ease`,
      'z-index:2',
      'pointer-events:all',
    ].join(';')

    badge.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      this._openPanel()
    })

    this._moonWidget.element.appendChild(badge)
    this._badgeEl = badge
  }

  // ── Overlay ───────────────────────────────────────────────────────────────
  // Full screen dark panel, sits under moon (z-index 1000002).

  _buildOverlay() {
    const overlay = document.createElement('div')
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:1000002',
      'display:none',
      'flex-direction:column',
      'align-items:center',
      'background:rgba(6,4,18,0.96)',
      'pointer-events:all',
    ].join(';')

    // Graphic canvas -- top centre, large
    const graphic = document.createElement('canvas')
    graphic.width  = 96
    graphic.height = 96
    graphic.style.cssText = [
      'margin-top:18%',
      'width:96px',
      'height:96px',
      'image-rendering:pixelated',
      'flex-shrink:0',
    ].join(';')
    this._graphicEl = graphic

    overlay.appendChild(graphic)
    document.body.appendChild(overlay)
    this._overlayEl = overlay

    // Buttons row -- fixed at bottom, above overlay
    const buttons = document.createElement('div')
    buttons.style.cssText = [
      'position:fixed',
      'bottom:0',
      'left:0',
      'right:0',
      'display:flex',
      'gap:10px',
      'padding:16px 20px 32px',
      'background:linear-gradient(to top,rgba(6,4,18,1) 60%,transparent)',
      'opacity:0',
      'transition:opacity 0.4s ease',
      'pointer-events:none',
      'z-index:1000003',
    ].join(';')
    document.body.appendChild(buttons)
    this._buttonsEl = buttons
  }

  // ── Notify ────────────────────────────────────────────────────────────────

notify(card, zoneObj) {
  if (this._isOpen) return
  if (this._clearTimer) { clearTimeout(this._clearTimer); this._clearTimer = null }
  if (this._card?.id === card.id) return
  this._card   = card
  this._active = zoneObj
  this._showBadge(card.visual)
}


clearNotify() {
  if (this._isOpen) return
  if (this._clearTimer) clearTimeout(this._clearTimer)
  this._clearTimer = setTimeout(() => {
    this._hideBadge()
    this._card   = null
    this._active = null
    this._clearTimer = null
  }, 300)
}



  // ── Badge helpers ─────────────────────────────────────────────────────────

  _showBadge(visual) {
    const badge = this._badgeEl
    badge.style.display = 'block'

    if (visual?.gid) {
      const src = this._scene.perspectiveGround?._getTileCanvas(visual.gid)
      if (src) {
        const ctx = badge.getContext('2d')
        ctx.clearRect(0, 0, badge.width, badge.height)
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(src, 0, 0, badge.width, badge.height)
      }
    }

    requestAnimationFrame(() => { badge.style.opacity = '1' })
  }

  _hideBadge() {
    const badge = this._badgeEl
    badge.style.opacity = '0'
    setTimeout(() => { badge.style.display = 'none' }, BADGE_FADE_MS)
  }

  // ── Open panel ────────────────────────────────────────────────────────────

  _openPanel() {
    if (!this._card || this._isOpen) return
    this._isOpen = true
    this._hideBadge()

    const card = this._card

    // Draw large graphic
    const src = this._scene.perspectiveGround?._getTileCanvas(card.visual?.gid)
    if (src) {
      const ctx = this._graphicEl.getContext('2d')
      ctx.clearRect(0, 0, 96, 96)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(src, 0, 0, 96, 96)
    }

    // Show overlay
    this._overlayEl.style.display = 'flex'

    // Clear old buttons
    this._buttonsEl.innerHTML         = ''
    this._buttonsEl.style.opacity     = '0'
    this._buttonsEl.style.pointerEvents = 'none'

    // Stop player
    if (this._scene.joystick) this._scene.joystick.reset()
    if (this._scene.player)   this._scene.player.isMoving = false

    // Build lines for scrolling text
    const lines = this._buildLines(card)

    // Launch ScrollingTextPlayer into the overlay
    if (this._textPlayer) { this._textPlayer.destroy(); this._textPlayer = null }
    this._textPlayer = new ScrollingTextPlayer({
      lines,
      getMoonPhase: () => this._scene._moonWidget?.getPhase() ?? GameSettings.englishOpacity,
      container:    this._overlayEl,
      onComplete:   () => this._onTextComplete(card),
    })
    this._textPlayer.start()
  }

  _buildLines(card) {
    const gaLines = (card.ga || '').split('\n').filter(Boolean)
    const enLines = (card.en || '').split('\n').filter(Boolean)
    const count   = Math.max(gaLines.length, enLines.length)
    const lines   = []
    for (let i = 0; i < count; i++) {
      const line = { ga: gaLines[i] || '' }
      if (enLines[i]) line.en = enLines[i]
      lines.push(line)
    }
    return lines
  }

  _onTextComplete(card) {
    const hasActions = card.actions?.length > 0

    if (hasActions) {
      const english = this._scene._moonWidget?.getPhase() ?? GameSettings.englishOpacity
      card.actions.forEach(action => {
        this._buttonsEl.appendChild(this._makeButton(action, english))
      })
      this._buttonsEl.style.opacity     = '1'
      this._buttonsEl.style.pointerEvents = 'all'
    } else {
      // No actions -- tap overlay to dismiss
      this._overlayEl.addEventListener('pointerdown', this._tapDismiss = () => {
        this._finalDismiss()
      }, { once: true })
    }
  }

  _makeButton(action, englishOpacity) {
    const btn   = document.createElement('button')
    const useEn = englishOpacity > 0.5
    btn.textContent = useEn ? action.labelEn : action.labelGa
    btn.style.cssText = [
      'flex:1',
      'min-width:80px',
      'padding:12px 16px',
      'background:rgba(60,40,100,0.85)',
      'border:1px solid rgba(180,160,255,0.4)',
      'border-radius:8px',
      'color:#e8e0d0',
      'font-family:serif',
      'font-size:17px',
      'cursor:pointer',
      'touch-action:manipulation',
      '-webkit-tap-highlight-color:transparent',
    ].join(';')

    btn.addEventListener('pointerdown', () => this._resolveAction(action))
    return btn
  }

  // ── Language update ───────────────────────────────────────────────────────

  updateLanguageOpacity() {
    if (!this._isOpen || !this._card?.actions) return
    const english = this._scene._moonWidget?.getPhase() ?? GameSettings.englishOpacity
    const useEn   = english > 0.5
    Array.from(this._buttonsEl.children).forEach((btn, i) => {
      const action = this._card.actions[i]
      if (action) btn.textContent = useEn ? action.labelEn : action.labelGa
    })
  }

  // ── Resolve action ────────────────────────────────────────────────────────

  _resolveAction(action) {
    const outcome = action?.outcome
    if (!outcome) { this._finalDismiss(); return }

    switch (outcome.type) {

      case 'loot': {
        if (outcome.sound) {
          try { this._scene.sound.play(outcome.sound) } catch(e) {}
        }
        if (outcome.visualSwap && this._active) {
          const tx = this._active.getData('flagTileX')
          const ty = this._active.getData('flagTileY')
          if (tx != null && this._scene.perspectiveGround) {
            this._scene.perspectiveGround.swapEncounterFlagVisual(tx, ty, outcome.visualSwap)
            this._scene.perspectiveGround.forceRedraw()
          }
        }
        if (outcome.textGa || outcome.textEn) {
          this._buttonsEl.style.opacity     = '0'
          this._buttonsEl.style.pointerEvents = 'none'
          this._buttonsEl.innerHTML         = ''
          if (this._textPlayer) { this._textPlayer.destroy(); this._textPlayer = null }
          const lines = []
          if (outcome.textGa) lines.push({ ga: outcome.textGa, en: outcome.textEn || '' })
          this._textPlayer = new ScrollingTextPlayer({
            lines,
            getMoonPhase: () => this._scene._moonWidget?.getPhase() ?? GameSettings.englishOpacity,
            container:    this._overlayEl,
            onComplete:   () => this._finalDismiss(),
          })
          this._textPlayer.start()
        } else {
          this._finalDismiss()
        }
        break
      }

      case 'persist':
        this._closePanel()
        break

      case 'dismiss':
      default:
        this._finalDismiss()
        break
    }
  }

  // ── Dismiss helpers ───────────────────────────────────────────────────────

  _finalDismiss() {
    const obj      = this._active
    const stateKey = obj?.getData('stateKey')

    if (stateKey && window.GameState) window.GameState.setCollected(stateKey)

    const tx = obj?.getData('flagTileX')
    const ty = obj?.getData('flagTileY')
    if (tx != null && this._scene.perspectiveGround) {
      this._scene.perspectiveGround.clearEncounterFlag(tx, ty)
      this._scene.perspectiveGround.forceRedraw()
    }

    if (obj && this._scene.interactables) {
      const idx = this._scene.interactables.indexOf(obj)
      if (idx > -1) this._scene.interactables.splice(idx, 1)
    }

    this._closePanel()
  }

  _closePanel() {
    if (this._textPlayer) { this._textPlayer.destroy(); this._textPlayer = null }
    if (this._buttonTimer) { clearTimeout(this._buttonTimer); this._buttonTimer = null }
    if (this._tapDismiss) {
      this._overlayEl?.removeEventListener('pointerdown', this._tapDismiss)
      this._tapDismiss = null
    }

    if (this._overlayEl) this._overlayEl.style.display = 'none'
    if (this._buttonsEl) {
      this._buttonsEl.style.opacity     = '0'
      this._buttonsEl.style.pointerEvents = 'none'
      this._buttonsEl.innerHTML         = ''
    }

    this._isOpen  = false
    this._card    = null
    this._active  = null

    if (this._scene?.perspectiveGround) this._scene.perspectiveGround.forceRedraw()
  }

  // ── Destroy ───────────────────────────────────────────────────────────────

  destroy() {
    if (this._textPlayer) { this._textPlayer.destroy(); this._textPlayer = null }
    if (this._buttonTimer) clearTimeout(this._buttonTimer)
    if (this._overlayEl?.parentNode)  this._overlayEl.parentNode.removeChild(this._overlayEl)
    if (this._buttonsEl?.parentNode)  this._buttonsEl.parentNode.removeChild(this._buttonsEl)
    if (this._badgeEl?.parentNode)    this._badgeEl.parentNode.removeChild(this._badgeEl)
    this._scene = null

if (this._clearTimer) clearTimeout(this._clearTimer)
  

  }
}


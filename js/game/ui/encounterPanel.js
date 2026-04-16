/**
 * encounterPanel.js
 *
 * Handles all encounter UI for Corra.
 *
 * Flow:
 *   1. scene calls encounterPanel.notify(encounter) when player is in proximity
 *   2. A badge appears on the moon widget — tap moon to open
 *   3. Panel opens with bilingual text
 *   4. After a beat, action buttons appear
 *   5. Player chooses — outcome fires, panel closes
 *
 * Encounter card shape:
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
 *           items:      [],          // optional item keys to drop
 *           visualSwap: { gid: 197 }, // optional — replace graphic
 *           sound:      'creak1',    // optional sound key
 *           textGa:     '...',       // optional followup text
 *           textEn:     '...',
 *         }
 *       }
 *     ]
 *   }
 *
 * If no actions are defined, panel shows text only and dismisses on tap.
 */

import { GameSettings } from '../settings/gameSettings.js'

const BUTTON_DELAY_MS = 900

export class EncounterPanel {

  constructor(scene, moonWidget) {
    this._scene      = scene
    this._moonWidget = moonWidget
    this._active     = null   // current encounter zone obj
    this._card       = null   // current card data
    this._panelEl    = null
    this._badgeEl    = null
    this._buttonsEl  = null
    this._buttonTimer = null
    this._isOpen     = false

    this._buildBadge()
    this._buildPanel()
  }

  // ── Badge — sits on the moon wrapper ──────────────────────────────────────

  _buildBadge() {
    const badge = document.createElement('canvas')
    badge.width  = 24
    badge.height = 24
    badge.style.cssText = [
      'position:absolute',
      'bottom:2px',
      'left:2px',
      'width:24px',
      'height:24px',
      'border-radius:4px',
      'background:rgba(0,0,0,0.55)',
      'cursor:pointer',
      'display:none',
      'z-index:2',
    ].join(';')

    badge.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      this._openPanel()
    })

    this._moonWidget.element.style.position = 'relative'
    this._moonWidget.element.appendChild(badge)
    this._badgeEl = badge
  }

  // ── Panel — full encounter UI ─────────────────────────────────────────────

  _buildPanel() {
    const panel = document.createElement('div')
    panel.style.cssText = [
      'position:fixed',
      'bottom:0',
      'left:0',
      'right:0',
      'max-height:55vh',
      'background:rgba(12,10,24,0.96)',
      'border-top:1px solid rgba(180,160,255,0.25)',
      'z-index:1000010',
      'display:none',
      'flex-direction:column',
      'align-items:stretch',
      'padding:16px 20px 28px',
      'gap:12px',
      'font-family:serif',
      'color:#e8e0d0',
      'touch-action:none',
    ].join(';')

    // Graphic + text row
    const topRow = document.createElement('div')
    topRow.style.cssText = 'display:flex;gap:14px;align-items:flex-start;'

    // Tile graphic canvas
    const tileCanvas = document.createElement('canvas')
    tileCanvas.width  = 48
    tileCanvas.height = 48
    tileCanvas.style.cssText = [
      'width:48px',
      'height:48px',
      'image-rendering:pixelated',
      'flex-shrink:0',
      'border-radius:4px',
      'background:rgba(0,0,0,0.4)',
    ].join(';')
    this._tileCanvas = tileCanvas

    // Text block
    const textBlock = document.createElement('div')
    textBlock.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:6px;'

    const gaText = document.createElement('p')
    gaText.style.cssText = 'margin:0;font-size:15px;line-height:1.5;color:#e8e0d0;'

    const enText = document.createElement('p')
    enText.style.cssText = 'margin:0;font-size:13px;line-height:1.4;font-style:italic;'

    this._gaText = gaText
    this._enText = enText

    textBlock.appendChild(gaText)
    textBlock.appendChild(enText)
    topRow.appendChild(tileCanvas)
    topRow.appendChild(textBlock)

    // Buttons row — hidden initially
    const buttonsRow = document.createElement('div')
    buttonsRow.style.cssText = [
      'display:flex',
      'gap:10px',
      'flex-wrap:wrap',
      'opacity:0',
      'transition:opacity 0.4s ease',
    ].join(';')
    this._buttonsEl = buttonsRow

    // Dismiss hint (no-action encounters)
    const hint = document.createElement('p')
    hint.style.cssText = 'margin:0;font-size:11px;color:rgba(200,190,220,0.5);text-align:center;display:none;'
    hint.textContent = '✕'
    hint.addEventListener('pointerdown', () => this._dismiss())
    this._hintEl = hint

    panel.appendChild(topRow)
    panel.appendChild(buttonsRow)
    panel.appendChild(hint)

    // Tap panel background to dismiss if no actions
    panel.addEventListener('pointerdown', (e) => {
      if (e.target === panel && !this._card?.actions?.length) this._dismiss()
    })

    document.body.appendChild(panel)
    this._panelEl = panel
  }

  // ── Notify — call when player enters proximity ────────────────────────────

  notify(card, zoneObj) {
    if (this._isOpen) return
    if (this._card?.id === card.id) return
    this._card   = card
    this._active = zoneObj
    this._showBadge(card.visual)
  }

  clearNotify() {
    if (this._isOpen) return
    this._hideBadge()
    this._card   = null
    this._active = null
  }

  // ── Badge helpers ─────────────────────────────────────────────────────────

  _showBadge(visual) {
    if (!visual?.gid) { this._badgeEl.style.display = 'block'; return }
    const src = this._scene.perspectiveGround?._getTileCanvas(visual.gid)
    if (src) {
      const ctx = this._badgeEl.getContext('2d')
      ctx.clearRect(0, 0, 24, 24)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(src, 0, 0, 24, 24)
    }
    this._badgeEl.style.display = 'block'
  }

  _hideBadge() {
    this._badgeEl.style.display = 'none'
  }

  // ── Open panel ────────────────────────────────────────────────────────────

  _openPanel() {
    if (!this._card) return
    this._isOpen = true
    this._hideBadge()

    const card    = this._card
    const english = GameSettings.englishOpacity

    // Draw tile graphic
    const src = this._scene.perspectiveGround?._getTileCanvas(card.visual?.gid)
    if (src) {
      const ctx = this._tileCanvas.getContext('2d')
      ctx.clearRect(0, 0, 48, 48)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(src, 0, 0, 48, 48)
    }

    // Text
    this._gaText.textContent = card.ga || ''
    this._enText.textContent = card.en || ''
    this._enText.style.opacity = english.toFixed(2)
    this._enText.style.display = english < 0.05 ? 'none' : 'block'

    // Clear old buttons
    this._buttonsEl.innerHTML = ''
    this._buttonsEl.style.opacity = '0'

    const hasActions = card.actions?.length > 0

    if (hasActions) {
      this._hintEl.style.display = 'none'
      // Build buttons — delayed
      if (this._buttonTimer) clearTimeout(this._buttonTimer)
      this._buttonTimer = setTimeout(() => {
        card.actions.forEach(action => {
          const btn = this._makeButton(action, english)
          this._buttonsEl.appendChild(btn)
        })
        this._buttonsEl.style.opacity = '1'
      }, BUTTON_DELAY_MS)
    } else {
      // No actions — show dismiss hint after beat
      this._hintEl.style.display = 'none'
      if (this._buttonTimer) clearTimeout(this._buttonTimer)
      this._buttonTimer = setTimeout(() => {
        this._hintEl.style.display = 'block'
      }, BUTTON_DELAY_MS)
    }

    // Show panel
    this._panelEl.style.display = 'flex'

    // Stop player movement
    if (this._scene.joystick) this._scene.joystick.reset()
    if (this._scene.player)   this._scene.player.isMoving = false
  }

  _makeButton(action, englishOpacity) {
    const btn   = document.createElement('button')
    const useEn = englishOpacity > 0.5
    btn.textContent = useEn ? action.labelEn : action.labelGa
    btn.style.cssText = [
      'flex:1',
      'min-width:80px',
      'padding:10px 14px',
      'background:rgba(80,60,120,0.7)',
      'border:1px solid rgba(180,160,255,0.35)',
      'border-radius:6px',
      'color:#e8e0d0',
      'font-family:serif',
      'font-size:15px',
      'cursor:pointer',
      'touch-action:manipulation',
    ].join(';')

    btn.addEventListener('pointerdown', () => this._resolveAction(action))
    return btn
  }

  // ── Resolve action ────────────────────────────────────────────────────────

  _resolveAction(action) {
    const outcome = action.outcome
    if (!outcome) { this._dismiss(); return }

    switch (outcome.type) {

      case 'loot': {
        // Drop items at player position
        if (outcome.items?.length && this._scene.spawnItemOnMap) {
          outcome.items.forEach(itemKey => {
            const item = this._scene.itemDefinitions?.[itemKey]
            if (item) {
              this._scene.spawnItemOnMap(
                item,
                this._scene.player.logicalX,
                this._scene.player.logicalY
              )
            }
          })
        }
        // Play sound
        if (outcome.sound && this._scene.sound?.add) {
          this._scene.sound.play(outcome.sound)
        }
        // Swap graphic
        if (outcome.visualSwap && this._active) {
          const tx = this._active.getData('flagTileX')
          const ty = this._active.getData('flagTileY')
          if (tx != null && ty != null && this._scene.perspectiveGround) {
            this._scene.perspectiveGround.swapEncounterFlagVisual(tx, ty, outcome.visualSwap)
            this._scene.perspectiveGround.forceRedraw()
          }
        }
        // Show followup text then dismiss
        if (outcome.textGa || outcome.textEn) {
          this._gaText.textContent = outcome.textGa || ''
          this._enText.textContent = outcome.textEn || ''
          this._buttonsEl.innerHTML = ''
          this._buttonsEl.style.opacity = '0'
          this._buttonTimer = setTimeout(() => this._dismiss(), 2200)
        } else {
          this._finalDismiss()
        }
        break
      }

      case 'persist':
        // Leave encounter on map, just close panel
        this._closePanel()
        break

      case 'dismiss':
      default:
        this._finalDismiss()
        break
    }
  }

  // ── Dismiss helpers ───────────────────────────────────────────────────────

  // Tap-to-dismiss for no-action encounters
  _dismiss() {
    this._finalDismiss()
  }

  // Full resolution — mark collected, remove from map
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

  // Just close panel, leave encounter on map
  _closePanel() {
    if (this._buttonTimer) { clearTimeout(this._buttonTimer); this._buttonTimer = null }
    this._panelEl.style.display = 'none'
    this._buttonsEl.innerHTML   = ''
    this._hintEl.style.display  = 'none'
    this._isOpen  = false
    this._card    = null
    this._active  = null

    if (this._scene.perspectiveGround) this._scene.perspectiveGround.forceRedraw()
  }

  // ── Destroy ───────────────────────────────────────────────────────────────

  destroy() {
    if (this._buttonTimer) clearTimeout(this._buttonTimer)
    if (this._panelEl?.parentNode) this._panelEl.parentNode.removeChild(this._panelEl)
    if (this._badgeEl?.parentNode) this._badgeEl.parentNode.removeChild(this._badgeEl)
    this._scene = null
  }
}


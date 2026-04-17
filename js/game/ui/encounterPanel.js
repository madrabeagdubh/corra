/**
 * encounterPanel.js
 *
 * Encounter UI for Corra.
 *
 * Uses the existing TextPanel for all text display -- bilingual scrolling,
 * swipe-to-dismiss, English opacity, all handled consistently with the rest
 * of the game.
 *
 * Flow:
 *   1. notify(card, zone) -- badge appears on moon, no movement lock
 *   2. Player walks away -- badge fades (clearNotify)
 *   3. Player taps moon while badge showing -- panel opens
 *   4. Encounter graphic shown briefly at top of screen
 *   5. TextPanel shows bilingual text, swipe up to dismiss
 *   6. If card has actions: chat_options panel with bilingual buttons
 *   7. Outcome fires, flag removed from world
 */

import { GameSettings } from '../settings/gameSettings.js'

const BADGE_FADE_MS  = 400
const GRAPHIC_DEPTH  = 1999  // just below TextPanel (depth 2000)

export class EncounterPanel {

  constructor(scene, moonWidget) {
    this._scene      = scene
    this._moonWidget = moonWidget
    this._active     = null
    this._card       = null
    this._isOpen     = false
    this._graphicImg = null  // Phaser image shown during text
    this._clearTimer = null

    this._buildBadge()
  }

  // ── Badge ─────────────────────────────────────────────────────────────────
  // Centred over the moon canvas, same size as the moon.

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
      this._card       = null
      this._active     = null
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
    this._badgeEl.style.opacity = '0'
    setTimeout(() => { this._badgeEl.style.display = 'none' }, BADGE_FADE_MS)
  }

  // ── Open panel ────────────────────────────────────────────────────────────

  _openPanel() {
    if (!this._card || this._isOpen) return
    this._isOpen = true
    this._hideBadge()

    const card = this._card

    // Stop player
    if (this._scene.joystick) this._scene.joystick.reset()
    if (this._scene.player)   this._scene.player.isMoving = false

    // Show encounter graphic as a Phaser image at top-centre
    this._showGraphic(card.visual)

    const hasActions = card.actions?.length > 0

    if (hasActions) {
      // Build chat_options from card actions
      const options = card.actions.map(a => ({
        ga: a.labelGa,
        en: a.labelEn,
        irish:   a.labelGa,
        english: a.labelEn,
      }))

      this._scene.textPanel.show({
        irish:    card.ga || '',
        english:  card.en || '',
        type:     'chat_options',
        options,
        onChoice: (i) => this._resolveAction(card.actions[i]),
        onDismiss: () => this._onPanelClosed(),
      })
    } else {
      // No actions -- plain examine panel, swipe up to dismiss
      this._scene.textPanel.show({
        irish:   card.ga || '',
        english: card.en || '',
        type:    'examine',
        onDismiss: () => {
          this._finalDismiss()
        },
      })
    }
  }

  // ── Graphic ───────────────────────────────────────────────────────────────
  // Small oryx tile shown in top-right corner while text panel is open.
  // Drawn directly onto the Phaser canvas so it sits naturally in the scene.

  _showGraphic(visual) {
    if (!visual?.gid) return
    this._hideGraphic()

    const src = this._scene.perspectiveGround?._getTileCanvas(visual.gid)
    if (!src) return

    // Create a Phaser texture from the canvas and display it
    const key = `enc_graphic_${visual.gid}`
    if (!this._scene.textures.exists(key)) {
      this._scene.textures.addCanvas(key, src)
    }

    const sw = this._scene.scale.width
    const size = 48

    this._graphicImg = this._scene.add.image(sw - size, size, key)
      .setScrollFactor(0)
      .setDepth(GRAPHIC_DEPTH)
      .setDisplaySize(size, size)
      .setOrigin(1, 0)
  }

  _hideGraphic() {
    if (this._graphicImg) {
      this._graphicImg.destroy()
      this._graphicImg = null
    }
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
          // Show followup text then dismiss
          this._scene.textPanel.show({
            irish:   outcome.textGa || '',
            english: outcome.textEn || '',
            type:    'examine',
            onDismiss: () => this._finalDismiss(),
          })
        } else {
          this._finalDismiss()
        }
        break
      }

      case 'persist':
        // Leave flag on map, just close
        this._onPanelClosed()
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

    this._onPanelClosed()
  }

  _onPanelClosed() {
    this._hideGraphic()
    this._isOpen = false
    this._card   = null
    this._active = null
if (this._scene) this._scene._lastWasFar = false
    if (this._scene?.perspectiveGround) this._scene.perspectiveGround.forceRedraw()
  }

  // ── Language update ───────────────────────────────────────────────────────
  // TextPanel handles this itself via GameSettings -- nothing needed here.

  updateLanguageOpacity() {}

  // ── Destroy ───────────────────────────────────────────────────────────────

  destroy() {
    if (this._clearTimer) clearTimeout(this._clearTimer)
    this._hideGraphic()
    if (this._badgeEl?.parentNode) this._badgeEl.parentNode.removeChild(this._badgeEl)
    this._scene = null
  }
}


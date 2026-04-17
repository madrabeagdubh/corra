/**
 * encounterPanel.js
 *
 * Encounter UI for Corra.
 *
 * Proximity flow:
 *   1. notify(card, zone) -- badge appears on moon, no movement lock
 *   2. Player walks away -- badge fades after grace period
 *   3. Player taps moon while badge showing -- panel opens
 *
 * The panel itself is now rendered by TextPanel's `encounter_card` type:
 *   - background image (panelBG.png if loaded, else solid fill)
 *   - graphic banner inside the card (no more floating top-of-screen sprite)
 *   - bilingual scrollable body
 *   - docked single-language buttons (Irish OR English, controlled by moon)
 *
 * Choice flow:
 *   - hasActions:  encounter_card with options. Choice triggers chained
 *                  followup (also an encounter_card, no options) for outcome text.
 *   - no actions:  encounter_card with no options, swipe-up to dismiss.
 *
 * Outcome types:
 *   loot     -- play sound, show outcome text, mark collected, clear flag
 *   persist  -- close panel, leave flag on map (chest stays for next visit)
 *   dismiss  -- show outcome text (if any), mark collected, clear flag
 */

import { GameSettings } from '../settings/gameSettings.js'

const BADGE_FADE_MS   = 400
const CLEAR_DELAY_MS  = 800
const CHAIN_BUFFER_MS = 60

// Texture key the scene should preload for the card background.
// Falls back to solid fill if not present.
const CARD_BG_KEY     = 'encounterPanelBG'

export class EncounterPanel {

  constructor(scene, moonWidget) {
    this._scene      = scene
    this._moonWidget = moonWidget
    this._active     = null
    this._card       = null
    this._isOpen     = false
    this._choiceMade = false
    this._clearTimer = null
    this._chainTimer = null

    this._buildBadge()
  }

  // -- Badge --

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

  // -- Notify --

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
    }, CLEAR_DELAY_MS)
  }

  // -- Badge helpers --

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

  // -- Graphic key resolution --
  // Registers the card's gid as a Phaser texture (one-time per gid) so the
  // encounter_card layout can render it as an image. Returns the texture key
  // or null if the visual isn't available.
  _resolveGraphicKey(visual) {
    if (!visual?.gid) return null
    const src = this._scene.perspectiveGround?._getTileCanvas(visual.gid)
    if (!src) return null
    const key = `enc_graphic_${visual.gid}`
    if (!this._scene.textures.exists(key)) {
      this._scene.textures.addCanvas(key, src)
    }
    return this._scene.textures.exists(key) ? key : null
  }

  _resolveBgKey() {
    return this._scene.textures.exists(CARD_BG_KEY) ? CARD_BG_KEY : null
  }

  // -- Open panel --

  _openPanel() {
    if (!this._card || this._isOpen) return
    this._isOpen     = true
    this._choiceMade = false
    this._hideBadge()

    if (this._scene.textPanel?.isVisible) this._scene.textPanel.hide()

    const card       = this._card
    const hasActions = card.actions?.length > 0

    if (this._scene.joystick) this._scene.joystick.reset()
    if (this._scene.player)   this._scene.player.isMoving = false

    const bgKey      = this._resolveBgKey()
    const graphicKey = this._resolveGraphicKey(card.visual)

    if (hasActions) {
      const options = card.actions.map(a => ({
        ga: a.labelGa || '',
        en: a.labelEn || '',
      }))

      this._scene.textPanel.show({
        irish:    card.ga || '',
        english:  card.en || '',
        type:     'encounter_card',
        bgKey,
        graphicKey,
        options,
        onChoice:  (i) => {
          this._choiceMade = true
          this._resolveAction(card.actions[i])
        },
        onDismiss: () => { if (!this._choiceMade) this._onPanelClosed() },
      })
    } else {
      this._scene.textPanel.show({
        irish:   card.ga || '',
        english: card.en || '',
        type:    'encounter_card',
        bgKey,
        graphicKey,
        options: null,
        onDismiss: () => this._finalDismiss(),
      })
    }
  }

  // -- Chained show --

  _chainShow(config) {
    const tp = this._scene.textPanel
    if (!tp) return

    if (this._chainTimer) { clearTimeout(this._chainTimer); this._chainTimer = null }

    const wait = (typeof tp.getFadeRemaining === 'function') ? tp.getFadeRemaining() : 0

    if (wait <= 0) {
      tp.show(config)
      return
    }

    this._chainTimer = setTimeout(() => {
      this._chainTimer = null
      if (!this._isOpen) return
      tp.show(config)
    }, wait + CHAIN_BUFFER_MS)
  }

  // -- Resolve action --

  _resolveAction(action) {
    const outcome = action?.outcome
    if (!outcome) { this._finalDismiss(); return }

    const card       = this._card
    const bgKey      = this._resolveBgKey()
    const graphicKey = this._resolveGraphicKey(card?.visual)

    switch (outcome.type) {

      case 'loot': {
        if (outcome.sound) {
          try { this._scene.sound.play(outcome.sound) } catch(e) {}
        }
        if (outcome.textGa || outcome.textEn) {
          this._chainShow({
            irish:    outcome.textGa || '',
            english:  outcome.textEn || '',
            type:     'encounter_card',
            bgKey,
            graphicKey,
            options:  null,
            onDismiss: () => this._finalDismiss(),
          })
        } else {
          this._finalDismiss()
        }
        break
      }

      case 'persist':
        this._onPanelClosed()
        break

      case 'dismiss':
      default:
        if (outcome.textGa || outcome.textEn) {
          this._chainShow({
            irish:    outcome.textGa || '',
            english:  outcome.textEn || '',
            type:     'encounter_card',
            bgKey,
            graphicKey,
            options:  null,
            onDismiss: () => this._finalDismiss(),
          })
        } else {
          this._finalDismiss()
        }
        break
    }
  }

  // -- Dismiss helpers --

  _finalDismiss() {
    const obj      = this._active
    const stateKey = obj?.getData('stateKey')

    if (stateKey && window.GameState) window.GameState.setCollected(stateKey)

    const lx = obj?.getData('logicalX')
    const ly = obj?.getData('logicalY')
    if (lx != null && this._scene.perspectiveGround) {
      const ftx = Math.round((lx - this._scene.tileSize / 2) / this._scene.tileSize)
      const fty = Math.round((ly - this._scene.tileSize / 2) / this._scene.tileSize)
      this._scene.perspectiveGround.clearEncounterFlag(ftx, fty)
      this._scene.perspectiveGround.forceRedraw()
    }

    if (obj && this._scene.interactables) {
      const idx = this._scene.interactables.indexOf(obj)
      if (idx > -1) this._scene.interactables.splice(idx, 1)
    }

    this._onPanelClosed()
  }

  _onPanelClosed() {
    if (this._chainTimer) { clearTimeout(this._chainTimer); this._chainTimer = null }
    this._isOpen     = false
    this._choiceMade = false
    this._card       = null
    this._active     = null
    if (this._scene) this._scene._lastWasFar = false
    if (this._scene?.perspectiveGround) this._scene.perspectiveGround.forceRedraw()
  }

  updateLanguageOpacity() {
    // Forward to TextPanel so it can re-pick languages on its buttons
    if (this._scene?.textPanel?.updateEnglishOpacity) {
      this._scene.textPanel.updateEnglishOpacity()
    }
  }

  // -- Destroy --

  destroy() {
    if (this._clearTimer) clearTimeout(this._clearTimer)
    if (this._chainTimer) clearTimeout(this._chainTimer)
    if (this._badgeEl?.parentNode) this._badgeEl.parentNode.removeChild(this._badgeEl)
    this._scene = null
  }
}


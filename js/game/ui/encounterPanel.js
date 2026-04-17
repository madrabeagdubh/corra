/**
 * encounterPanel.js
 *
 * Encounter UI for Corra.
 *
 * Proximity flow:
 *   1. notify(card, zone) -- badge appears on moon, no movement lock
 *   2. Player walks away -- badge fades after 800ms grace period
 *   3. Player taps moon while badge showing -- panel opens
 *
 * Uses TextPanel for all text display -- bilingual, swipe-to-dismiss,
 * English opacity, consistent with the rest of the game.
 *
 * Observe cards (no actions): examine type, swipe up to dismiss.
 * Choice cards (with actions): chat_options type, bilingual buttons.
 */

import { GameSettings } from '../settings/gameSettings.js'

const BADGE_FADE_MS  = 400
const CLEAR_DELAY_MS = 800
const GRAPHIC_DEPTH  = 2005

export class EncounterPanel {

  constructor(scene, moonWidget) {
    this._scene      = scene
    this._moonWidget = moonWidget
    this._active     = null
    this._card       = null
    this._isOpen     = false
    this._graphicImg = null
    this._clearTimer = null

    this._buildBadge()
  }

  // ── Badge ─────────────────────────────────────────────────────────────────

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
    }, CLEAR_DELAY_MS)
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

    // Force-close any existing text panel
    if (this._scene.textPanel?.isVisible) this._scene.textPanel.hide()

    const card = this._card
    const hasActions = card.actions?.length > 0

    if (this._scene.joystick) this._scene.joystick.reset()
    if (this._scene.player)   this._scene.player.isMoving = false

    // Show encounter graphic top-centre
    this._showGraphic(card.visual)

    if (hasActions) {
      const options = card.actions.map(a => ({
        irish:   a.labelGa || '',
        english: a.labelEn || '',
        ga:      a.labelGa || '',
        en:      a.labelEn || '',
      }))

      this._scene.textPanel.show({
        irish:    card.ga || '',
        english:  card.en || '',
        type:     'chat_options',
        options,
        onChoice:  (i) => this._resolveAction(card.actions[i]),
        onDismiss: () => this._onPanelClosed(),
      })
    } else {
      this._scene.textPanel.show({
        irish:   card.ga || '',
        english: card.en || '',
        type:    'examine',
        onDismiss: () => this._finalDismiss(),
      })
    }
  }

  // ── Graphic ───────────────────────────────────────────────────────────────

  _showGraphic(visual) {
    if (!visual?.gid) return
    this._hideGraphic()

    const src = this._scene.perspectiveGround?._getTileCanvas(visual.gid)
    if (!src) return

    const key = `enc_graphic_${visual.gid}`
    if (!this._scene.textures.exists(key)) {
      this._scene.textures.addCanvas(key, src)
    }
    if (!this._scene.textures.exists(key)) return

    const sw   = this._scene.scale.width
    const size = 96

    this._graphicImg = this._scene.add.image(sw / 2, 12, key)
      .setScrollFactor(0)
      .setDepth(GRAPHIC_DEPTH)
      .setDisplaySize(size, size)
      .setOrigin(0.5, 0)
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
        if (outcome.textGa || outcome.textEn) {
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
        this._onPanelClosed()
        break

      case 'dismiss':
      default:
        if (outcome.textGa || outcome.textEn) {
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
  }

  // ── Dismiss helpers ───────────────────────────────────────────────────────

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
    this._hideGraphic()
    this._isOpen  = false
    this._card    = null
    this._active  = null
    if (this._scene) this._scene._lastWasFar = false
    if (this._scene?.perspectiveGround) this._scene.perspectiveGround.forceRedraw()
  }

  updateLanguageOpacity() {}

  // ── Destroy ───────────────────────────────────────────────────────────────

  destroy() {
    if (this._clearTimer) clearTimeout(this._clearTimer)
    this._hideGraphic()
    if (this._badgeEl?.parentNode) this._badgeEl.parentNode.removeChild(this._badgeEl)
    this._scene = null
  }
}


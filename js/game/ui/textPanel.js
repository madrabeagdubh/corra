/**
 * TextPanel — Bilingual scrolling text panel for Fenians.baby
 *
 * Panel sits in TOP 40% of screen — joystick remains usable below.
 * Irish text starts at vertical CENTRE of panel, scrolls upward.
 * Gestures handled via Phaser input (not DOM) so canvas doesn't block.
 *
 * Gestures (within panel bounds):
 *   Tap       → pause scroll for PAUSE_MS then resume
 *   Drag down → rewind content
 *   Fling up  → accelerate scroll
 *   Fast swipe up → dismiss immediately
 *
 * Auto-dismisses HOLD_MS after content reaches top.
 * COOLDOWN_MS prevents immediate re-trigger after dismiss.
 */

import Phaser from 'phaser'
import { GameSettings } from '../settings/gameSettings.js'

// ── Tuning ─────────────────────────────────────────────────────────────────
const SCROLL_PX_PER_SEC = 28
const PAUSE_MS          = 4000
const HOLD_MS           = 3000
const FADE_OUT_MS       = 500
const COOLDOWN_MS       = 1200
const DISMISS_VEL       = 8       // px/frame upward fling to trigger instant dismiss

// ── Colours ─────────────────────────────────────────────────────────────────
const IRISH_COLOR   = '#e8dfc0'
const ENGLISH_COLOR = '#a0c8a0'
const SPEAKER_COLOR = '#d4af37'
const PANEL_FILL    = 0x111a11
const PANEL_BORDER  = 0xb0b0b0
const PANEL_ALPHA   = 0.97

export default class TextPanel {
  constructor(scene) {
    this.scene              = scene
    this.container          = null
    this.isVisible          = false
    this.currentPanelType   = null
    this.onDismiss          = null
    this.englishOptionTexts = []
    this.englishTextObject  = null
    this.irishTextObject    = null

    this._cooldown          = false
    this._lastTriggerId     = null   // id of last object that triggered show
    this._cooldownId        = null   // id cooling down (only this id is blocked)

    // Scroll
    this._scrollY           = 0
    this._startOffset       = 0
    this._maxScroll         = 0
    this._velocity          = 0
    this._naturalVel        = SCROLL_PX_PER_SEC / 60
    this._paused            = false
    this._pauseTimer        = null
    this._atTop             = false
    this._holdTimer         = null
    this._rafId             = null
    this._scrolling         = false

    // Drag (Phaser pointer coords)
    this._dragging          = false
    this._dragStartY        = 0
    this._dragStartScroll   = 0
    this._lastDragY         = 0
    this._lastDragTime      = 0
    this._dragVelocity      = 0
    this._tapStartY         = 0
    this._tapStartTime      = 0

    // Panel bounds (Phaser coords) for hit testing
    this._panelBounds       = null   // { x, y, w, h }

    // Content
    this._contentContainer  = null
    this._maskGraphics      = null
    this._contentBaseY      = 0

    // Cursor
    this.readingCursor      = null
    this.cursorParticles    = []
    this.cursorAnchor       = { x: 0, y: 0 }
    this.cursorTime         = 0

    // Phaser input handlers (stored for cleanup)
    this._phaserDown        = null
    this._phaserMove        = null
    this._phaserUp          = null
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  show(config) {
    const {
      irish, english,
      type      = 'dialogue',
      speaker   = null,
      onDismiss = null,
      options   = null,
      onChoice  = null,
      id        = null
    } = config

    // Only block if this exact object is cooling down
    if (id && this._cooldownId === id) return

    this._lastTriggerId = id

    // Recycle for consecutive dialogue
    if (
      this.isVisible && this.container &&
      type === 'dialogue' && this.currentPanelType === 'dialogue'
    ) {
      this.onDismiss = onDismiss
      if (this.irishTextObject)   this.irishTextObject.setText(irish)
      if (this.englishTextObject) {
        this.englishTextObject.setText(english)
        this.englishTextObject.setAlpha(GameSettings.englishOpacity)
      }
      this._beginScroll()
      return
    }

    if (this.isVisible) this._destroyPanel()

    this.onDismiss        = onDismiss
    this.isVisible        = true
    this.currentPanelType = type

    this.container = this.scene.add.container(0, 0).setDepth(2000).setScrollFactor(0)

    const sw = this.scene.scale.width
    const sh = this.scene.scale.height

    if (type === 'dialogue' || type === 'examine') {
      this._createScrollPanel(irish, english, speaker, sw, sh)
    } else if (type === 'notification') {
      this._createNotificationPanel(irish, english, sw, sh)
    } else if (type === 'chat_options') {
      this._createChatOptionsPanel(irish, english, options, onChoice, speaker, sw, sh)
    } else if (type === 'archery_prompt') {
      this._createArcheryPromptPanel(irish, english, sw, sh)
    }

    // Note: joystick stays ENABLED — panel is in top half, player can keep moving
  }

  hide() {
    if (!this.isVisible) return
    this._stopScroll()
    this._unbindPhaserInput()
    this._destroyCursor()
    this._startCooldown()

    if (this.container) {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: FADE_OUT_MS,
        ease: 'Power2',
        onComplete: () => {
          this._destroyPanel()
          if (this.onDismiss) this.onDismiss()
        }
      })
    } else {
      this._destroyPanel()
      if (this.onDismiss) this.onDismiss()
    }
  }

  updateEnglishOpacity() {
    if (this.englishTextObject) {
      this.englishTextObject.setAlpha(GameSettings.englishOpacity)
    }
    this.englishOptionTexts.forEach(t => {
      if (t && t.active) t.setAlpha(GameSettings.englishOpacity)
    })
  }

  update(time, delta) {
    this._updateCursor(delta)
  }

  // ── Scroll panel ────────────────────────────────────────────────────────────

  _createScrollPanel(irish, english, speaker, sw, sh) {
    const panelW  = sw * 0.92
    const panelH  = sh * 0.40
    const panelX  = sw / 2
    const panelY  = panelH / 2 + 10
    const padding = 20
    const textW   = panelW - padding * 2

    this._panelBounds = {
      x: panelX - panelW/2,
      y: panelY - panelH/2,
      w: panelW,
      h: panelH
    }

    // Background
    const bg = this.scene.add.graphics()
    bg.fillStyle(PANEL_FILL, PANEL_ALPHA)
    bg.lineStyle(3, PANEL_BORDER, 0.85)
    bg.fillRoundedRect(panelX - panelW/2, panelY - panelH/2, panelW, panelH, 10)
    bg.strokeRoundedRect(panelX - panelW/2, panelY - panelH/2, panelW, panelH, 10)
    this.container.add(bg)

    // Make bg interactive so Phaser receives pointer events within panel
    bg.setInteractive(
      new Phaser.Geom.Rectangle(panelX - panelW/2, panelY - panelH/2, panelW, panelH),
      Phaser.Geom.Rectangle.Contains
    )

    // Hint
    const hint = this.scene.add.text(panelX, panelY + panelH/2 - 8,
      '↑ swipe up to dismiss', {
        fontSize: '10px', fontFamily: 'monospace', color: '#445544'
      }
    ).setOrigin(0.5, 1).setScrollFactor(0).setAlpha(0.45)
    this.container.add(hint)

    // Content container
    const contentX     = panelX - panelW/2 + padding
    const panelTop     = panelY - panelH/2
    const panelCentreY = panelTop + panelH / 2
    this._contentBaseY = panelCentreY   // content base = centre of panel

    this._contentContainer = this.scene.add.container(contentX, this._contentBaseY)
    this._contentContainer.setDepth(2001).setScrollFactor(0)

    let cy = 0

    if (speaker) {
      const spEl = this.scene.add.text(0, cy, speaker, {
        fontSize: '16px', fontFamily: 'Urchlo',
        color: SPEAKER_COLOR, fontStyle: 'bold',
        wordWrap: { width: textW }
      }).setOrigin(0, 0)
      this._contentContainer.add(spEl)
      cy += spEl.height + 8
    }

    this.irishTextObject = this.scene.add.text(0, cy, irish, {
      fontSize: '20px', fontFamily: 'Urchlo',
      color: IRISH_COLOR,
      wordWrap: { width: textW }, lineSpacing: 6
    }).setOrigin(0, 0)
    this._contentContainer.add(this.irishTextObject)
    cy += this.irishTextObject.height + 14

    this.englishTextObject = this.scene.add.text(0, cy, english, {
      fontSize: '15px', fontFamily: 'monospace',
      color: ENGLISH_COLOR,
      wordWrap: { width: textW }, lineSpacing: 4
    }).setOrigin(0, 0).setAlpha(GameSettings.englishOpacity)
    this._contentContainer.add(this.englishTextObject)
    cy += this.englishTextObject.height

    // scrollY=0: content starts at panel centre (startOffset=0)
    // scrollY=maxScroll: content top edge sits at panel top + padding
    const contentH    = cy + padding
    const visibleH    = panelH - padding * 2
    // How far content needs to scroll to reach top of panel
    this._startOffset = 0   // content begins at panel centre
    this._maxScroll   = panelH / 2 + Math.max(0, contentH - visibleH)

    // Mask
    const maskGfx = this.scene.add.graphics()
    maskGfx.fillStyle(0xffffff)
    maskGfx.fillRect(
      panelX - panelW/2 + 2, panelTop + 2,
      panelW - 4, panelH - 4
    )
    maskGfx.setScrollFactor(0)
    this._contentContainer.setMask(maskGfx.createGeometryMask())
    this._maskGraphics = maskGfx

    this.container.add(this._contentContainer)

    this._beginScroll()
    this._bindPhaserInput()
  }

  _beginScroll() {
    this._stopScroll()
    this._scrollY  = 0
    this._atTop    = false
    this._paused   = false
    this._velocity = this._naturalVel
    this._scrolling = true
    this._applyScroll()
    this._rafId = requestAnimationFrame(this._loop.bind(this))
  }

  _loop() {
    if (!this._scrolling) return
    if (!this._dragging && !this._paused) {
      this._scrollY += this._velocity
    }
    if (this._scrollY >= this._maxScroll) {
      this._scrollY = this._maxScroll
      this._applyScroll()
      this._onReachTop()
      return
    }
    if (this._scrollY < 0) {
      this._scrollY = 0
      this._velocity = this._naturalVel
    }
    this._applyScroll()
    this._rafId = requestAnimationFrame(this._loop.bind(this))
  }

  _applyScroll() {
    if (!this._contentContainer) return
    this._contentContainer.y = this._contentBaseY - this._scrollY
  }

  _onReachTop() {
    if (this._atTop) return
    this._atTop    = true
    this._velocity = 0
    this._holdTimer = setTimeout(() => {
      this._holdTimer = null
      this.hide()
    }, HOLD_MS)
  }

  _stopScroll() {
    this._scrolling = false
    if (this._rafId)      { cancelAnimationFrame(this._rafId); this._rafId = null }
    if (this._pauseTimer) { clearTimeout(this._pauseTimer);   this._pauseTimer = null }
    if (this._holdTimer)  { clearTimeout(this._holdTimer);    this._holdTimer  = null }
  }

  // ── Phaser pointer input ────────────────────────────────────────────────────

  _bindPhaserInput() {
    this._unbindPhaserInput()

    this._phaserDown = (pointer) => {
      if (!this._inPanel(pointer)) {
        this._dragStartedInPanel = false
        return
      }
      this._dragStartedInPanel  = true
      this._dragging        = true
      this._paused          = false
      this._tapStartY       = pointer.y
      this._tapStartTime    = performance.now()
      this._dragStartY      = pointer.y
      this._dragStartScroll = this._scrollY
      this._lastDragY       = pointer.y
      this._lastDragTime    = performance.now()
      this._dragVelocity    = 0
      if (this._holdTimer) { clearTimeout(this._holdTimer); this._holdTimer = null }
      this._atTop = false
      if (!this._rafId && this._scrolling) {
        this._rafId = requestAnimationFrame(this._loop.bind(this))
      }
    }

    this._phaserMove = (pointer) => {
      if (!this._dragging || !pointer.isDown || !this._dragStartedInPanel) return
      const now = performance.now()
      const dt  = now - this._lastDragTime
      const dy  = pointer.y - this._lastDragY
      if (dt > 0) this._dragVelocity = this._dragVelocity * 0.6 + (dy / dt) * 0.4
      let s = this._dragStartScroll + (this._dragStartY - pointer.y)
      s = Math.max(0, Math.min(this._maxScroll, s))
      this._scrollY = s
      this._applyScroll()
      this._lastDragY    = pointer.y
      this._lastDragTime = now
    }

    this._phaserUp = (pointer) => {
      if (!this._dragging || !this._dragStartedInPanel) return
      this._dragging   = false
      const dy         = Math.abs(pointer.y - this._tapStartY)
      const dt         = performance.now() - this._tapStartTime
      const wasTap     = dy < 12 && dt < 300

      if (wasTap) {
        this._paused = true
        if (this._pauseTimer) clearTimeout(this._pauseTimer)
        this._pauseTimer = setTimeout(() => {
          this._paused     = false
          this._pauseTimer = null
          this._velocity   = this._naturalVel
          if (this._atTop) this._onReachTop()
          else if (!this._rafId && this._scrolling) {
            this._rafId = requestAnimationFrame(this._loop.bind(this))
          }
        }, PAUSE_MS)
        return
      }

      // Fast upward fling → dismiss
      // dragVelocity is px/ms, negative = upward
      if (this._dragVelocity < -(DISMISS_VEL / 60)) {
        this._stopScroll()
        this.hide()
        return
      }

      // Apply fling
      const flingVel = -(this._dragVelocity * (1000 / 60))
      this._velocity = Math.max(-this._naturalVel * 2, Math.min(this._naturalVel * 14, flingVel))
      if (!this._rafId && this._scrolling) {
        this._rafId = requestAnimationFrame(this._loop.bind(this))
      }
    }

    this.scene.input.on('pointerdown', this._phaserDown)
    this.scene.input.on('pointermove', this._phaserMove)
    this.scene.input.on('pointerup',   this._phaserUp)
  }

  _unbindPhaserInput() {
    if (this._phaserDown) this.scene.input.off('pointerdown', this._phaserDown)
    if (this._phaserMove) this.scene.input.off('pointermove', this._phaserMove)
    if (this._phaserUp)   this.scene.input.off('pointerup',   this._phaserUp)
    this._phaserDown = null
    this._phaserMove = null
    this._phaserUp   = null
  }

  _inPanel(pointer) {
    if (!this._panelBounds) return false
    const { x, y, w, h } = this._panelBounds
    return pointer.x >= x && pointer.x <= x + w &&
           pointer.y >= y && pointer.y <= y + h
  }

  // ── Cooldown ────────────────────────────────────────────────────────────────

  _startCooldown() {
    if (this._lastTriggerId) {
      this._cooldownId = this._lastTriggerId
      setTimeout(() => { this._cooldownId = null }, COOLDOWN_MS)
    }
  }

  // ── Other panel types ───────────────────────────────────────────────────────

  _createNotificationPanel(irish, english, sw, sh) {
    const panelW = sw * 0.88
    const panelH = 80
    const panelX = sw / 2
    const panelY = sh * 0.18

    const bg = this.scene.add.graphics()
    bg.fillStyle(0x0a1a0a, 0.95)
    bg.lineStyle(2, 0x6a9a6a, 0.9)
    bg.fillRoundedRect(panelX - panelW/2, panelY - panelH/2, panelW, panelH, 6)
    bg.strokeRoundedRect(panelX - panelW/2, panelY - panelH/2, panelW, panelH, 6)
    this.container.add(bg)

    const irishEl = this.scene.add.text(panelX, panelY - 12, irish, {
      fontSize: '18px', fontFamily: 'Urchlo', color: IRISH_COLOR,
      wordWrap: { width: panelW * 0.85 }
    }).setOrigin(0.5, 0)
    this.container.add(irishEl)

    this.englishTextObject = this.scene.add.text(panelX, panelY + irishEl.height - 8, english, {
      fontSize: '13px', fontFamily: 'monospace', color: ENGLISH_COLOR,
      wordWrap: { width: panelW * 0.85 }
    }).setOrigin(0.5, 0).setAlpha(GameSettings.englishOpacity)
    this.container.add(this.englishTextObject)

    this.scene.time.delayedCall(3000, () => { if (this.isVisible) this.hide() })
  }

  _createChatOptionsPanel(irish, english, options, onChoice, speaker, sw, sh) {
    this.englishOptionTexts = []
    const panelW = sw * 0.9
    const panelH = sh * 0.5
    const panelX = sw / 2
    const panelY = sh - panelH / 2

    const bg = this.scene.add.graphics()
    bg.fillStyle(PANEL_FILL, PANEL_ALPHA)
    bg.lineStyle(4, PANEL_BORDER, 1)
    bg.fillRoundedRect(panelX - panelW/2, panelY - panelH/2, panelW, panelH, 8)
    bg.strokeRoundedRect(panelX - panelW/2, panelY - panelH/2, panelW, panelH, 8)
    this.container.add(bg)

    let textY  = panelY - panelH/2 + 28
    const textX = sw * 0.07

    if (speaker) {
      const spEl = this.scene.add.text(textX, textY, speaker, {
        fontSize: '18px', fontFamily: 'Urchlo', color: SPEAKER_COLOR, fontStyle: 'bold'
      }).setOrigin(0, 0)
      this.container.add(spEl)
      textY += spEl.height + 8
    }

    const irishEl = this.scene.add.text(textX, textY, irish, {
      fontSize: '20px', fontFamily: 'Urchlo', color: IRISH_COLOR,
      wordWrap: { width: sw * 0.82 }, lineSpacing: 4
    }).setOrigin(0, 0)
    this.container.add(irishEl)

    this.englishTextObject = this.scene.add.text(textX, textY + irishEl.height + 10, english, {
      fontSize: '15px', fontFamily: 'monospace', color: ENGLISH_COLOR,
      wordWrap: { width: sw * 0.82 }, lineSpacing: 4
    }).setOrigin(0, 0).setAlpha(GameSettings.englishOpacity)
    this.container.add(this.englishTextObject)

    let optY = textY + irishEl.height + this.englishTextObject.height + 30
    options.forEach((option, i) => {
      const btnBg = this.scene.add.rectangle(sw/2, optY, sw * 0.8, 64, 0x1b2a1b, 1)
      btnBg.setStrokeStyle(2, 0xd4af37).setInteractive({ useHandCursor: true })
      this.container.add(btnBg)
      const optIrish = this.scene.add.text(sw/2, optY - 12, option.irish, {
        fontSize: '18px', fontFamily: 'Urchlo', color: IRISH_COLOR,
        wordWrap: { width: sw * 0.72 }
      }).setOrigin(0.5, 0)
      this.container.add(optIrish)
      const optEng = this.scene.add.text(sw/2, optY + optIrish.height - 8, option.english, {
        fontSize: '14px', fontFamily: 'monospace', color: ENGLISH_COLOR,
        wordWrap: { width: sw * 0.72 }
      }).setOrigin(0.5, 0).setAlpha(GameSettings.englishOpacity)
      this.container.add(optEng)
      this.englishOptionTexts.push(optEng)
      btnBg.on('pointerover', () => { btnBg.setFillStyle(0x2a3a2a); btnBg.setStrokeStyle(3, 0xffd700) })
      btnBg.on('pointerout',  () => { btnBg.setFillStyle(0x1b2a1b); btnBg.setStrokeStyle(2, 0xd4af37) })
      btnBg.on('pointerdown', () => {
        this.hide()
        this.scene.time.delayedCall(100, () => { if (onChoice) onChoice(i, option) })
      })
      optY += 80
    })
  }

  _createArcheryPromptPanel(irish, english, sw, sh) {
    const panelW = sw * 0.9
    const panelH = 100
    const panelX = sw / 2
    const panelY = panelH / 2 + 20

    const bg = this.scene.add.graphics()
    bg.fillStyle(0x1a2a3a, 0.95)
    bg.lineStyle(4, PANEL_BORDER, 1)
    bg.fillRoundedRect(panelX - panelW/2, panelY - panelH/2, panelW, panelH, 8)
    bg.strokeRoundedRect(panelX - panelW/2, panelY - panelH/2, panelW, panelH, 8)
    this.container.add(bg)

    const irishEl = this.scene.add.text(sw/2, 35, irish, {
      fontSize: '22px', fontFamily: 'Aonchlo', color: IRISH_COLOR, fontStyle: 'bold',
      wordWrap: { width: panelW * 0.8 }
    }).setOrigin(0.5, 0)
    this.container.add(irishEl)

    this.englishTextObject = this.scene.add.text(sw/2, 35 + irishEl.height + 6, english, {
      fontSize: '16px', fontFamily: 'monospace', color: ENGLISH_COLOR,
      wordWrap: { width: panelW * 0.8 }
    }).setOrigin(0.5, 0).setAlpha(GameSettings.englishOpacity)
    this.container.add(this.englishTextObject)
  }

  // ── Cursor ──────────────────────────────────────────────────────────────────

  _updateCursor(delta) {
    if (!this.readingCursor || !this.isVisible) return
    this.cursorTime += (delta || 16) * 0.002
    const glow = 0.6 + Math.sin(this.cursorTime * 3) * 0.3
    this.readingCursor.setAlpha(glow).setScale(0.35 + glow * 0.12)
    this.readingCursor.x = this.cursorAnchor.x + Math.cos(this.cursorTime * 1.2) * 6
    this.readingCursor.y = this.cursorAnchor.y + Math.sin(this.cursorTime * 2.5) * 4
  }

  _destroyCursor() {
    if (this.readingCursor) { this.readingCursor.destroy(); this.readingCursor = null }
    this.cursorParticles.forEach(p => p.destroy())
    this.cursorParticles = []
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  _destroyPanel() {
    this._stopScroll()
    this._unbindPhaserInput()
    this._destroyCursor()
    if (this._maskGraphics)    { this._maskGraphics.destroy();   this._maskGraphics    = null }
    if (this.container)        { this.container.destroy();       this.container        = null }
    this._contentContainer  = null
    this._panelBounds       = null
    this._dragging          = false
    this._dragStartedInPanel = false
    this.irishTextObject    = null
    this.englishTextObject  = null
    this.englishOptionTexts = []
    this.isVisible          = false
    this.currentPanelType   = null
  }
}


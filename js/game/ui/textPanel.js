/**
 * TextPanel -- Bilingual scrolling text panel for Fenians.baby
 *
 * Panel types:
 *   dialogue        -- scrolls, holds at top for HOLD_MS, then auto-dismisses
 *   examine         -- scrolls, holds at top INDEFINITELY, dismisses only on swipe-up
 *   notification    -- short auto-dismiss banner
 *   chat_options    -- legacy buttons panel (kept for back-compat)
 *   archery_prompt  -- top banner, persistent
 *   encounter_card  -- card layout: bg image, graphic banner, scrollable bilingual
 *                      body, docked single-language buttons. Used by EncounterPanel.
 */

import Phaser from 'phaser'
import { GameSettings } from '../settings/gameSettings.js'
import {
  COLORS, FONTS, SIZES, TYPE, BUTTON,
  textStyle, createButton, pickLanguage,
} from '../systems/gameTypography.js'

// -- Tuning --
const SCROLL_PX_PER_SEC = 28
const PAUSE_MS          = 4000
const HOLD_MS           = 3000
const FADE_MS           = 400
const COOLDOWN_MS       = 4500
const DISMISS_VEL       = 0.5

// -- Style --
const PANEL_H_FRAC  = 0.60
const IRISH_COLOR   = COLORS.irish
const ENGLISH_COLOR = COLORS.english
const SPEAKER_COLOR = COLORS.speaker
const PANEL_FILL    = COLORS.panelFill
const PANEL_BORDER  = COLORS.panelBorder
const PANEL_ALPHA   = COLORS.panelAlpha
const IRISH_SIZE    = SIZES.irish
const ENGLISH_SIZE  = SIZES.english
const IRISH_FONT    = FONTS.irish
const ENGLISH_FONT  = FONTS.english

// -- Encounter card layout --
const CARD_H_FRAC          = 0.78    // taller than dialogue
const CARD_W_FRAC          = 0.92
const CARD_GRAPHIC_SIZE    = 96
const CARD_GRAPHIC_TOP     = 18      // gap from card top to graphic
const CARD_BODY_TOP_PAD    = 22      // gap below graphic
const CARD_BODY_BOTTOM_PAD = 22      // gap above buttons
const CARD_PADDING_X       = 24

export default class TextPanel {
  constructor(scene) {
    this.scene              = scene
    this.isVisible          = false
    this.isFading           = false
    this._fadeStartTime     = 0
    this.currentPanelType   = null
    this.onDismiss          = null
    this.englishOptionTexts = []
    this.irishTextObject    = null
    this.englishTextObject  = null

    this._cooldownId        = null
    this._lastTriggerId     = null

    this._objects           = []
    this._enObjects         = []
    this._maskGfx           = null

    // Scroll state
    this._scrolling         = false
    this._scrollY           = 0
    this._maxScroll         = 0
    this._velocity          = SCROLL_PX_PER_SEC / 60
    this._paused            = false
    this._pauseTimer        = null
    this._atTop             = false
    this._holdTimer         = null
    this._rafId             = null

    this._isExamine         = false

    // Content positioning
    this._contentX          = 0
    this._contentBaseY      = 0
    this._contentItems      = []

    // Buttons created via createButton (need updateOpacity on lang change)
    this._buttons           = []

    // Gesture state
    this._dragging          = false
    this._inPanelDrag       = false
    this._tapStartY         = 0
    this._tapStartTime      = 0
    this._dragStartY        = 0
    this._dragStartScroll   = 0
    this._lastDragY         = 0
    this._lastDragTime      = 0
    this._dragVelocity      = 0

    this._bounds         = null
    this._clipTop        = 0
    this._clipBottom     = 9999

    this._onDown            = null
    this._onMove            = null
    this._onUp              = null
  }

  // -- Public --

  show(config) {
    const {
      irish     = '',
      english   = '',
      type      = 'dialogue',
      speaker   = null,
      onDismiss = null,
      options   = null,
      onChoice  = null,
      id        = null,
      // Encounter card extras:
      bgKey     = null,         // Phaser texture key for background image
      graphicKey= null,         // Phaser texture key for graphic banner
    } = config

    if (id && this._cooldownId === id) return
    this._lastTriggerId = id

    if (this.isVisible) this._destroyAll()

    this.onDismiss        = onDismiss
    this.isVisible        = true
    this.isFading         = false
    this.currentPanelType = type
    this._isExamine       = (type === 'examine' || type === 'encounter_card')

    const sw = this.scene.scale.width
    const sh = this.scene.scale.height

    if (type === 'dialogue' || type === 'examine') {
      this._buildScrollPanel(irish, english, speaker, sw, sh)
    } else if (type === 'notification') {
      this._buildNotification(irish, english, sw, sh)
    } else if (type === 'chat_options') {
      this._buildChatOptions(irish, english, options, onChoice, speaker, sw, sh)
    } else if (type === 'archery_prompt') {
      this._buildArcheryPrompt(irish, english, sw, sh)
    } else if (type === 'encounter_card') {
      this._buildEncounterCard(irish, english, options, onChoice, bgKey, graphicKey, sw, sh)
    }
  }

  hide() {
    if (!this.isVisible || this.isFading) return
    this.isFading = true
    this._fadeStartTime = performance.now()
    this._stopScroll()
    this._unbindInput()
    this._startCooldown()

    const targets = [...this._objects]
    if (targets.length) {
      this.scene.tweens.add({
        targets,
        alpha: 0,
        duration: FADE_MS,
        ease: 'Linear',
        onComplete: () => {
          const cb = this.onDismiss
          this._destroyAll()
          if (cb) cb()
        }
      })
    } else {
      const cb = this.onDismiss
      this._destroyAll()
      if (cb) cb()
    }
  }

  getFadeRemaining() {
    if (!this.isFading) return 0
    const elapsed = performance.now() - this._fadeStartTime
    return Math.max(0, FADE_MS - elapsed)
  }

  update() {}

  updateEnglishOpacity() {
    const a = GameSettings.englishOpacity
    if (this._contentItems) {
      this._contentItems.forEach(item => {
        if (this._enObjects.includes(item.obj)) {
          item.baseAlpha = a
        }
      })
    }
    this._enObjects.forEach(o => {
      if (o?.active && !this._contentItems?.find(i => i.obj === o)) {
        o.setAlpha(a)
      }
    })
    // Update single-language buttons (encounter_card uses these)
    this._buttons.forEach(b => b.updateOpacity(a))
    this._applyScroll()
  }

  // -- Encounter card layout --

  _buildEncounterCard(irish, english, options, onChoice, bgKey, graphicKey, sw, sh) {
    const panelW   = Math.round(sw * CARD_W_FRAC)
    const panelH   = Math.round(sh * CARD_H_FRAC)
    const panelX   = Math.round(sw / 2)
    const panelTop = Math.round((sh - panelH) / 2)
    const depth    = 2000

    this._bounds = { x: panelX - panelW/2, y: panelTop, w: panelW, h: panelH }

    // -- Background: image if available, else solid fill --
    if (bgKey && this.scene.textures.exists(bgKey)) {
      const bgImg = this.scene.add.image(panelX, panelTop + panelH/2, bgKey)
        .setDisplaySize(panelW, panelH)
        .setScrollFactor(0)
        .setDepth(depth)
      this._objects.push(bgImg)

      // Subtle dark overlay so text remains readable on busy bg images
      const overlay = this.scene.add.graphics().setDepth(depth + 1).setScrollFactor(0)
      overlay.fillStyle(0x000000, 0.35)
      overlay.fillRoundedRect(panelX - panelW/2, panelTop, panelW, panelH, 10)
      this._objects.push(overlay)
    } else {
      const bg = this.scene.add.graphics().setDepth(depth).setScrollFactor(0)
      bg.fillStyle(PANEL_FILL, PANEL_ALPHA)
      bg.fillRoundedRect(panelX - panelW/2, panelTop, panelW, panelH, 10)
      this._objects.push(bg)
    }

    // -- Border on top of background --
    const border = this.scene.add.graphics().setDepth(depth + 2).setScrollFactor(0)
    border.lineStyle(BUTTON.borderWidth, COLORS.buttonBorder, 0.85)
    border.strokeRoundedRect(panelX - panelW/2, panelTop, panelW, panelH, 10)
    this._objects.push(border)

    // -- Graphic banner (top of card, inside panel) --
    let bodyTop
    if (graphicKey && this.scene.textures.exists(graphicKey)) {
      const gfx = this.scene.add.image(panelX, panelTop + CARD_GRAPHIC_TOP, graphicKey)
        .setDisplaySize(CARD_GRAPHIC_SIZE, CARD_GRAPHIC_SIZE)
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(depth + 3)
      this._objects.push(gfx)
      bodyTop = panelTop + CARD_GRAPHIC_TOP + CARD_GRAPHIC_SIZE + CARD_BODY_TOP_PAD
    } else {
      bodyTop = panelTop + CARD_GRAPHIC_TOP + CARD_BODY_TOP_PAD
    }

    // -- Calculate body region --
    const buttonCount  = options?.length || 0
    const buttonsBlock = buttonCount > 0
      ? buttonCount * BUTTON.height + (buttonCount - 1) * BUTTON.gap + CARD_BODY_BOTTOM_PAD
      : 0
    const bodyBottom = panelTop + panelH - buttonsBlock - CARD_BODY_BOTTOM_PAD
    const bodyH      = Math.max(60, bodyBottom - bodyTop)

    // -- Mask for body region (clips scrolling text) --
    const maskGfx = this.scene.add.graphics().setScrollFactor(0).setDepth(depth - 1)
    maskGfx.fillStyle(0xffffff)
    maskGfx.fillRect(panelX - panelW/2 + CARD_PADDING_X, bodyTop, panelW - CARD_PADDING_X * 2, bodyH)
    this._maskGfx = maskGfx
    this._objects.push(maskGfx)
    const mask = maskGfx.createGeometryMask()

    // -- Body content (bilingual, both visible, scrolls if overflow) --
    const startX = panelX - panelW/2 + CARD_PADDING_X
    const textW  = panelW - CARD_PADDING_X * 2
    this._contentX     = startX
    this._contentBaseY = bodyTop                          // start at TOP of body, not centre
    this._contentItems = []
    this._clipTop      = bodyTop
    this._clipBottom   = bodyTop + bodyH
    this._enObjects    = []

    const gaLines = (irish   || '').split('\n')
    const enLines = (english || '').split('\n')
    const count   = Math.max(gaLines.length, enLines.length)

    let cy = 0

    for (let i = 0; i < count; i++) {
      const ga = (gaLines[i] || '').trim()
      const en = (enLines[i] || '').trim()
      if (!ga && !en) { cy += 12; continue }

      if (ga) {
        const el = this.scene.add.text(startX, bodyTop + cy, ga, {
          fontSize:   TYPE.cardBody.size,
          fontFamily: TYPE.cardBody.font,
          color:      IRISH_COLOR,
          wordWrap:   { width: textW },
          lineSpacing: TYPE.cardBody.lineSpacing,
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(depth + 4).setAlpha(0)
        el.setMask(mask)
        this._objects.push(el)
        this._contentItems.push({ obj: el, localY: cy, baseAlpha: 1 })
        if (!this.irishTextObject) this.irishTextObject = el
        cy += el.height + 4
      }

      if (en) {
        const el = this.scene.add.text(startX, bodyTop + cy, en, {
          fontSize:   TYPE.cardBodyEn.size,
          fontFamily: TYPE.cardBodyEn.font,
          color:      ENGLISH_COLOR,
          wordWrap:   { width: textW },
          lineSpacing: TYPE.cardBodyEn.lineSpacing,
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(depth + 4).setAlpha(0)
        el.setMask(mask)
        this._objects.push(el)
        this._enObjects.push(el)
        this._contentItems.push({
          obj: el,
          localY: cy,
          baseAlpha: GameSettings.englishOpacity,
        })
        if (!this.englishTextObject) this.englishTextObject = el
        cy += el.height + 14
      }
    }

    // Determine scrollability: only scroll if content overflows body region
    const overflow = Math.max(0, cy - bodyH)
    this._maxScroll = overflow > 0 ? overflow + bodyH : 0

    // -- Buttons (single-language, docked at bottom) --
    this._buttons = []
    if (options?.length) {
      const btnW = Math.round(panelW - CARD_PADDING_X * 2)

      // Stack from bottom up
      const positions = []
      let by = panelTop + panelH - CARD_BODY_BOTTOM_PAD - BUTTON.height/2
      for (let i = options.length - 1; i >= 0; i--) {
        positions.unshift(by)
        by -= BUTTON.height + BUTTON.gap
      }

      options.forEach((opt, i) => {
        const btn = createButton(this.scene, {
          x: panelX,
          y: positions[i],
          width: btnW,
          labelGa: opt.ga || opt.irish || '',
          labelEn: opt.en || opt.english || '',
          depth: depth + 5,
          opacity: GameSettings.englishOpacity,
          onTap: () => {
            this.hide()
            this.scene.time.delayedCall(60, () => {
              if (onChoice) onChoice(i, opt)
            })
          },
        })
        this._buttons.push(btn)
        this._objects.push(btn.bg)
        this._objects.push(btn.text)
      })
    }

    // -- Hint (only show if scrollable) --
    if (this._maxScroll > 0) {
      const hint = this.scene.add.text(
        panelX, bodyTop + bodyH - 4, '↕',
        { fontSize: '12px', fontFamily: FONTS.ui, color: COLORS.hint }
      ).setOrigin(0.5, 1).setScrollFactor(0).setDepth(depth + 6).setAlpha(0.4)
      this._objects.push(hint)
    }

    this._beginScroll()
    this._bindInput()
  }

  // -- Scroll panel (dialogue/examine) --

  _buildScrollPanel(irish, english, speaker, sw, sh) {
    const panelW   = Math.round(sw * 0.92)
    const panelH   = Math.round(sh * PANEL_H_FRAC)
    const panelX   = Math.round(sw / 2)
    const panelTop = 10
    const padding  = 22
    const textW    = panelW - padding * 2
    const depth    = 2000

    this._bounds = { x: panelX - panelW/2, y: panelTop, w: panelW, h: panelH }

    const bg = this.scene.add.graphics().setDepth(depth).setScrollFactor(0)
    bg.fillStyle(PANEL_FILL, PANEL_ALPHA)
    bg.fillRoundedRect(panelX - panelW/2, panelTop, panelW, panelH, 10)
    bg.lineStyle(2, PANEL_BORDER, 0.5)
    bg.strokeRoundedRect(panelX - panelW/2, panelTop, panelW, panelH, 10)
    this._objects.push(bg)

    const fadeH = Math.round(panelH * 0.35)
    const fadeY = panelTop + panelH - fadeH
    const fade = this.scene.add.graphics().setDepth(depth + 3).setScrollFactor(0)
    fade.fillGradientStyle(PANEL_FILL, PANEL_FILL, PANEL_FILL, PANEL_FILL,
      0, 0, PANEL_ALPHA, PANEL_ALPHA)
    fade.fillRect(panelX - panelW/2, fadeY, panelW, fadeH)
    this._objects.push(fade)

    const hint = this.scene.add.text(panelX, panelTop + panelH - 6, '↑ swipe up to dismiss', {
      fontSize: SIZES.hint, fontFamily: FONTS.english, color: COLORS.hint
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(depth + 2).setAlpha(0.4)
    this._objects.push(hint)

    const maskGfx = this.scene.add.graphics().setScrollFactor(0).setDepth(depth - 1)
    maskGfx.fillStyle(0xffffff)
    maskGfx.fillRect(panelX - panelW/2, panelTop, panelW, panelH)
    this._maskGfx = maskGfx
    this._objects.push(maskGfx)
    const mask = maskGfx.createGeometryMask()

    const startX     = panelX - panelW/2 + padding
    const centreY    = panelTop + panelH / 2
    this._contentX   = startX
    this._contentBaseY = centreY
    this._contentItems = []
    this._clipTop    = panelTop + padding / 2
    this._clipBottom = panelTop + panelH - padding

    const gaLines = (irish   || '').split('\n')
    const enLines = (english || '').split('\n')
    const count   = Math.max(gaLines.length, enLines.length)
    this._enObjects = []

    let cy = 0

    if (speaker) {
      const el = this.scene.add.text(startX, centreY + cy, speaker, {
        fontSize: SIZES.speaker, fontFamily: FONTS.irish,
        color: SPEAKER_COLOR, fontStyle: 'bold',
        wordWrap: { width: textW }
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(depth + 1).setAlpha(0)
      el.setMask(mask)
      this._objects.push(el)
      this._contentItems.push({ obj: el, localY: cy, baseAlpha: 1 })
      cy += el.height + 10
    }

    for (let i = 0; i < count; i++) {
      const ga = (gaLines[i] || '').trim()
      const en = (enLines[i] || '').trim()
      if (!ga && !en) { cy += 10; continue }

      if (ga) {
        const el = this.scene.add.text(startX, centreY + cy, ga, {
          fontSize: IRISH_SIZE, fontFamily: IRISH_FONT,
          color: IRISH_COLOR,
          wordWrap: { width: textW }, lineSpacing: 4
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(depth + 1).setAlpha(0)
        el.setMask(mask)
        this._objects.push(el)
        this._contentItems.push({ obj: el, localY: cy, baseAlpha: 1 })
        if (!this.irishTextObject) this.irishTextObject = el
        cy += el.height + 2
      }

      if (en) {
        const el = this.scene.add.text(startX, centreY + cy, en, {
          fontSize: ENGLISH_SIZE, fontFamily: ENGLISH_FONT,
          color: ENGLISH_COLOR,
          wordWrap: { width: textW }, lineSpacing: 3
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(depth + 1).setAlpha(0)
        el.setMask(mask)
        this._objects.push(el)
        this._enObjects.push(el)
        this._contentItems.push({ obj: el, localY: cy, baseAlpha: GameSettings.englishOpacity })
        if (!this.englishTextObject) this.englishTextObject = el
        cy += el.height + 10
      }
    }

    const visibleH  = panelH - padding * 2
    const overflow  = Math.max(0, cy - visibleH)
    this._maxScroll = panelH / 2 + overflow

    this._beginScroll()
    this._bindInput()
  }

  // -- Scroll logic --

  _applyScroll() {
    if (!this._contentItems) return
    const clipTop    = this._clipTop    || 0
    const clipBottom = this._clipBottom || 9999
    const fadeZone   = 24

    this._contentItems.forEach(({ obj, localY, baseAlpha }) => {
      if (!obj?.active) return
      const y = this._contentBaseY + localY - this._scrollY
      obj.y = y

      const bottom = y + (obj.height || 20)
      let a = baseAlpha
      if (y < clipTop) {
        a = Math.max(0, Math.min(a, (y - (clipTop - fadeZone)) / fadeZone))
      }
      if (bottom > clipBottom) {
        a = Math.max(0, Math.min(a, (clipBottom - y) / fadeZone))
      }
      obj.setAlpha(Math.max(0, a))
    })
  }

  _beginScroll() {
    this._stopScroll()
    this._scrollY   = 0
    this._atTop     = false
    this._paused    = false
    this._velocity  = SCROLL_PX_PER_SEC / 60
    this._scrolling = true
    this._applyScroll()

    // For encounter cards: don't auto-scroll; just fade content in
    if (this.currentPanelType === 'encounter_card') {
      this._contentItems.forEach(({ obj, baseAlpha }) => {
        if (!obj?.active) return
        this.scene.tweens.add({
          targets: obj,
          alpha: baseAlpha,
          duration: 320,
          ease: 'Linear',
        })
      })
      // Still run a light tick so drag-to-scroll works when content overflows
      this._rafId = requestAnimationFrame(this._tick.bind(this))
      return
    }

    this._rafId = requestAnimationFrame(this._tick.bind(this))
  }

  _tick() {
    if (!this._scrolling) return

    // Encounter card: passive -- don't auto-advance scrollY
  // Encounter card: apply momentum/inertia, no auto-advance
if (this.currentPanelType === 'encounter_card') {
  if (!this._dragging && Math.abs(this._velocity) > 0.01) {
    this._scrollY += this._velocity
    this._velocity *= 0.88  // friction
    this._scrollY = Math.max(0, Math.min(this._maxScroll, this._scrollY))
  }
  this._applyScroll()
  // Keep ticking only while there's still momentum
  if (Math.abs(this._velocity) > 0.01 || this._dragging) {
    this._rafId = requestAnimationFrame(this._tick.bind(this))
  } else {
    this._rafId = null
  }
  return
} 
    if (!this._dragging && !this._paused) {
      this._scrollY += this._velocity
      if (this._velocity < SCROLL_PX_PER_SEC / 60) {
        this._velocity += (SCROLL_PX_PER_SEC / 60 - this._velocity) * 0.05
      }
    }
    if (this._scrollY >= this._maxScroll) {
      this._scrollY = this._maxScroll
      this._applyScroll()
      this._onReachTop()
      return
    }
    if (this._scrollY < 0) {
      this._scrollY = 0
      this._velocity = SCROLL_PX_PER_SEC / 60
    }
    this._applyScroll()
    this._rafId = requestAnimationFrame(this._tick.bind(this))
  }

  _onReachTop() {
    if (this._atTop) return
    this._atTop    = true
    this._velocity = 0
    if (this._isExamine) return
    this._holdTimer = setTimeout(() => { this._holdTimer = null; this.hide() }, HOLD_MS)
  }

  _stopScroll() {
    this._scrolling = false
    if (this._rafId)      { cancelAnimationFrame(this._rafId); this._rafId      = null }
    if (this._pauseTimer) { clearTimeout(this._pauseTimer);    this._pauseTimer = null }
    if (this._holdTimer)  { clearTimeout(this._holdTimer);     this._holdTimer  = null }
  }

  // -- Input --

  _bindInput() {
    this._unbindInput()

    this._onDown = (p) => {
      const inside = this._inBounds(p)
      this._inPanelDrag = inside
      this._dragging    = inside
      if (!inside) {
        this._dragVelocity = 0
        return
      }
      this._tapStartY       = p.y
      this._tapStartTime    = performance.now()
      this._dragStartY      = p.y
      this._dragStartScroll = this._scrollY
      this._lastDragY       = p.y
      this._lastDragTime    = performance.now()
      this._dragVelocity    = 0
      this._atTop           = false
      if (this._holdTimer) { clearTimeout(this._holdTimer); this._holdTimer = null }
      if (!this._rafId && this._scrolling) {
        this._rafId = requestAnimationFrame(this._tick.bind(this))
      }
    }

    this._onMove = (p) => {
      if (!this._dragging || !this._inPanelDrag || !p.isDown) return
      const now = performance.now()
      const dt  = now - this._lastDragTime
      const dy  = p.y - this._lastDragY
      if (dt > 0) this._dragVelocity = this._dragVelocity * 0.6 + (dy / dt) * 0.4

      // For encounter cards, only scroll body when content overflows
      if (this.currentPanelType === 'encounter_card' && this._maxScroll === 0) {
        // Track velocity for swipe-up dismiss but don't scroll content
      } else {
        this._scrollY = Math.max(0, Math.min(this._maxScroll,
          this._dragStartScroll + (this._dragStartY - p.y)))
        this._applyScroll()
      }

      this._lastDragY    = p.y
      this._lastDragTime = now
    }

    this._onUp = (p) => {
      const wasInPanel   = this._dragging && this._inPanelDrag
      const savedVel     = this._dragVelocity
      this._dragging     = false
      this._inPanelDrag  = false
      this._dragVelocity = 0

      if (!wasInPanel) {
        if (this._scrolling && !this._paused && !this._atTop && !this._rafId) {
          this._rafId = requestAnimationFrame(this._tick.bind(this))
        }
        return
      }

      const dy   = Math.abs(p.y - this._tapStartY)
      const dt   = performance.now() - this._tapStartTime
      const tap  = dy < 12 && dt < 300

      // Encounter cards have buttons handle their own taps.
      // Swipe-up only dismisses cards WITHOUT buttons (pure examine).
  



if (this.currentPanelType === 'encounter_card') {
  if (tap) return
  const hasButtons     = this._buttons.length > 0
  const fullyScrolled  = this._maxScroll <= 0 || this._scrollY >= this._maxScroll
  if (!hasButtons && savedVel < -DISMISS_VEL && fullyScrolled) {
    this.hide()
    return
  }
  // Feed swipe velocity into the scroll tick for momentum
  if (Math.abs(savedVel) > 0.05) {
    const fv = -(savedVel * (1000 / 60))
    this._velocity = Math.max(-(SCROLL_PX_PER_SEC / 60) * 2,
                    Math.min((SCROLL_PX_PER_SEC / 60) * 14, fv))
    if (!this._rafId && this._scrolling)
      this._rafId = requestAnimationFrame(this._tick.bind(this))
  }
  return
}





      if (tap) {
        this._paused = true
        if (this._pauseTimer) clearTimeout(this._pauseTimer)
        this._pauseTimer = setTimeout(() => {
          this._paused = false; this._pauseTimer = null
          this._velocity = SCROLL_PX_PER_SEC / 60
          if (this._atTop) this._onReachTop()
          else if (!this._rafId && this._scrolling)
            this._rafId = requestAnimationFrame(this._tick.bind(this))
        }, PAUSE_MS)
        return
      }

      if (savedVel < -DISMISS_VEL) { this.hide(); return }

      const fv = -(savedVel * (1000 / 60))
      this._velocity = Math.max(-(SCROLL_PX_PER_SEC / 60) * 2,
                        Math.min((SCROLL_PX_PER_SEC / 60) * 14, fv))
      if (!this._rafId && this._scrolling)
        this._rafId = requestAnimationFrame(this._tick.bind(this))
    }

    this.scene.input.on('pointerdown', this._onDown)
    this.scene.input.on('pointermove', this._onMove)
    this.scene.input.on('pointerup',   this._onUp)
  }

  _unbindInput() {
    if (this._onDown) { this.scene.input.off('pointerdown', this._onDown); this._onDown = null }
    if (this._onMove) { this.scene.input.off('pointermove', this._onMove); this._onMove = null }
    if (this._onUp)   { this.scene.input.off('pointerup',   this._onUp);   this._onUp   = null }
  }

  _inBounds(p) {
    if (!this._bounds) return false
    const { x, y, w, h } = this._bounds
    return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h
  }

  // -- Cooldown --

  _startCooldown() {
    if (this._lastTriggerId) {
      this._cooldownId = this._lastTriggerId
      setTimeout(() => { this._cooldownId = null }, COOLDOWN_MS)
    }
  }

  // -- Other panel types --

  _buildNotification(irish, english, sw, sh) {
    const pw = sw * 0.88, ph = 90
    const px = sw / 2,   py = sh * 0.18
    const bg = this.scene.add.graphics().setScrollFactor(0).setDepth(2000)
    bg.fillStyle(0x0a1a0a, 0.95); bg.lineStyle(2, 0x6a9a6a, 0.9)
    bg.fillRoundedRect(px - pw/2, py - ph/2, pw, ph, 6)
    bg.strokeRoundedRect(px - pw/2, py - ph/2, pw, ph, 6)
    this._objects.push(bg)

    const ga = this.scene.add.text(px, py - 14, irish, {
      fontSize: '18px', fontFamily: IRISH_FONT, color: IRISH_COLOR,
      wordWrap: { width: pw * 0.85 }
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2001)
    this._objects.push(ga)
    this.irishTextObject = ga

    const en = this.scene.add.text(px, py + ga.height - 8, english, {
      fontSize: '14px', fontFamily: ENGLISH_FONT, color: ENGLISH_COLOR,
      wordWrap: { width: pw * 0.85 }
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2001).setAlpha(GameSettings.englishOpacity)
    this._objects.push(en); this._enObjects.push(en)
    this.englishTextObject = en

    this.scene.time.delayedCall(3000, () => { if (this.isVisible) this.hide() })
  }

  _buildChatOptions(irish, english, options, onChoice, speaker, sw, sh) {
    this.englishOptionTexts = []
    const pw = sw * 0.9, ph = sh * 0.5
    const px = sw / 2,   py = sh - ph / 2

    const bg = this.scene.add.graphics().setScrollFactor(0).setDepth(2000)
    bg.fillStyle(PANEL_FILL, PANEL_ALPHA); bg.lineStyle(4, PANEL_BORDER, 1)
    bg.fillRoundedRect(px - pw/2, py - ph/2, pw, ph, 8)
    bg.strokeRoundedRect(px - pw/2, py - ph/2, pw, ph, 8)
    this._objects.push(bg)

    let ty = py - ph/2 + 28
    const tx = sw * 0.07

    if (speaker) {
      const sp = this.scene.add.text(tx, ty, speaker, {
        fontSize: '18px', fontFamily: IRISH_FONT, color: SPEAKER_COLOR, fontStyle: 'bold'
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(2001)
      this._objects.push(sp); ty += sp.height + 8
    }

    const ga = this.scene.add.text(tx, ty, irish, {
      fontSize: '20px', fontFamily: IRISH_FONT, color: IRISH_COLOR,
      wordWrap: { width: sw * 0.82 }, lineSpacing: 4
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(2001)
    this._objects.push(ga); this.irishTextObject = ga

    const en = this.scene.add.text(tx, ty + ga.height + 10, english, {
      fontSize: '15px', fontFamily: ENGLISH_FONT, color: ENGLISH_COLOR,
      wordWrap: { width: sw * 0.82 }, lineSpacing: 4
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(2001).setAlpha(GameSettings.englishOpacity)
    this._objects.push(en); this._enObjects.push(en); this.englishTextObject = en

    let oy = ty + ga.height + en.height + 30
    options.forEach((opt, i) => {
      const btn = this.scene.add.rectangle(sw/2, oy, sw * 0.8, 64, 0x1b2a1b, 1)
        .setScrollFactor(0).setDepth(2001)
        .setStrokeStyle(2, 0xd4af37).setInteractive({ useHandCursor: true })
      this._objects.push(btn)

      const oga = this.scene.add.text(sw/2, oy - 12, opt.irish || opt.ga || '', {
        fontSize: '18px', fontFamily: IRISH_FONT, color: IRISH_COLOR,
        wordWrap: { width: sw * 0.72 }
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002)
      this._objects.push(oga)

      const oen = this.scene.add.text(sw/2, oy + oga.height - 8, opt.english || opt.en || '', {
        fontSize: '14px', fontFamily: ENGLISH_FONT, color: ENGLISH_COLOR,
        wordWrap: { width: sw * 0.72 }
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002).setAlpha(GameSettings.englishOpacity)
      this._objects.push(oen); this._enObjects.push(oen)
      this.englishOptionTexts.push(oen)

      btn.on('pointerover', () => btn.setFillStyle(0x2a3a2a).setStrokeStyle(3, 0xffd700))
      btn.on('pointerout',  () => btn.setFillStyle(0x1b2a1b).setStrokeStyle(2, 0xd4af37))
      btn.on('pointerdown', () => {
        this.hide()
        this.scene.time.delayedCall(100, () => { if (onChoice) onChoice(i, opt) })
      })
      oy += 80
    })
  }

  _buildArcheryPrompt(irish, english, sw, sh) {
    const pw = sw * 0.9, ph = 100
    const px = sw / 2,   py = ph / 2 + 20

    const bg = this.scene.add.graphics().setScrollFactor(0).setDepth(2000)
    bg.fillStyle(0x1a2a3a, 0.95); bg.lineStyle(4, PANEL_BORDER, 1)
    bg.fillRoundedRect(px - pw/2, py - ph/2, pw, ph, 8)
    bg.strokeRoundedRect(px - pw/2, py - ph/2, pw, ph, 8)
    this._objects.push(bg)

    const ga = this.scene.add.text(sw/2, 35, irish, {
      fontSize: '22px', fontFamily: IRISH_FONT, color: IRISH_COLOR,
      fontStyle: 'bold', wordWrap: { width: pw * 0.8 }
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2001)
    this._objects.push(ga); this.irishTextObject = ga

    const en = this.scene.add.text(sw/2, 35 + ga.height + 6, english, {
      fontSize: '16px', fontFamily: ENGLISH_FONT, color: ENGLISH_COLOR,
      wordWrap: { width: pw * 0.8 }
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2001).setAlpha(GameSettings.englishOpacity)
    this._objects.push(en); this._enObjects.push(en); this.englishTextObject = en
  }

  // -- Cleanup --

  _destroyAll() {
    this._stopScroll()
    this._unbindInput()
    if (this._maskGfx) { this._maskGfx.destroy(); this._maskGfx = null }
    // createButton-managed objects: destroy via their own destroy method
    this._buttons.forEach(b => b.destroy())
    this._buttons = []
    this._objects.forEach(o => { if (o?.active) o.destroy() })
    this._objects         = []
    this._enObjects       = []
    this._contentItems    = []
    this.englishOptionTexts = []
    this.irishTextObject  = null
    this.englishTextObject = null
    this._dragging        = false
    this._inPanelDrag     = false
    this._dragVelocity    = 0
    this._bounds          = null
    this._clipTop         = 0
    this._clipBottom      = 9999
    this.isVisible        = false
    this.isFading         = false
    this._fadeStartTime   = 0
    this.currentPanelType = null
    this._isExamine       = false
  }
}


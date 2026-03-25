/**
 * TextPanel — Bilingual scrolling text panel for Fenians.baby
 * Interleaved Irish/English lines, scrolling upward from panel centre.
 * Gestures via Phaser input. Plain fade in/out, no mask flash.
 */

import Phaser from 'phaser'
import { GameSettings } from '../settings/gameSettings.js'
import { COLORS, FONTS, SIZES } from '../systems/gameTypography.js'

// ── Tuning ──────────────────────────────────────────────────────────────────
const SCROLL_PX_PER_SEC = 28
const PAUSE_MS          = 4000
const HOLD_MS           = 3000
const FADE_MS           = 400
const COOLDOWN_MS       = 4500
const DISMISS_VEL       = 0.5

// ── Style — sourced from gameTypography ─────────────────────────────────────
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

export default class TextPanel {
  constructor(scene) {
    this.scene              = scene
    this.isVisible          = false
    this.currentPanelType   = null
    this.onDismiss          = null
    this.englishOptionTexts = []
    this.irishTextObject    = null    // first Irish text (legacy ref)
    this.englishTextObject  = null    // first English text (legacy ref)

    // Per-object cooldown
    this._cooldownId        = null
    this._lastTriggerId     = null

    // All Phaser objects created for current panel (for bulk destroy/fade)
    this._objects           = []      // everything except _maskGfx
    this._enObjects         = []      // English lines only (for opacity)
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

    // Content container position
    this._contentX          = 0
    this._contentBaseY      = 0
    this._contentItems      = []      // { obj, localY } for scroll positioning

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

    // Panel bounds for hit test and clip
    this._bounds         = null
    this._clipTop        = 0
    this._clipBottom     = 9999

    // Phaser input refs
    this._onDown            = null
    this._onMove            = null
    this._onUp              = null
  }

  // ── Public ──────────────────────────────────────────────────────────────────

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
    } = config

    if (id && this._cooldownId === id) return
    this._lastTriggerId = id

    if (this.isVisible) this._destroyAll()

    this.onDismiss        = onDismiss
    this.isVisible        = true
    this.currentPanelType = type

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
    }
  }

  hide() {
    if (!this.isVisible) return
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
          this._destroyAll()
          if (this.onDismiss) this.onDismiss()
        }
      })
    } else {
      this._destroyAll()
      if (this.onDismiss) this.onDismiss()
    }
  }

  update() { /* cursor removed for simplicity — add back if needed */ }

  updateEnglishOpacity() {
    const a = GameSettings.englishOpacity
    // Update baseAlpha on English content items so clip calculation respects it
    if (this._contentItems) {
      this._contentItems.forEach(item => {
        if (this._enObjects.includes(item.obj)) {
          item.baseAlpha = a
        }
      })
    }
    // Also update non-scroll English objects (chat_options etc)
    this._enObjects.forEach(o => {
      if (o?.active && !this._contentItems?.find(i => i.obj === o)) {
        o.setAlpha(a)
      }
    })
    this._applyScroll()
  }

  // ── Scroll panel ─────────────────────────────────────────────────────────────

  _buildScrollPanel(irish, english, speaker, sw, sh) {
    const panelW   = Math.round(sw * 0.92)
    const panelH   = Math.round(sh * PANEL_H_FRAC)
    const panelX   = Math.round(sw / 2)
    const panelTop = 10
    const padding  = 22
    const textW    = panelW - padding * 2
    const depth    = 2000

    this._bounds = { x: panelX - panelW/2, y: panelTop, w: panelW, h: panelH }

    // ── Gradient background — dark panel, fade to transparent at bottom ──
    const bg = this.scene.add.graphics()
      .setDepth(depth).setScrollFactor(0)
    // Solid fill first
    bg.fillStyle(PANEL_FILL, PANEL_ALPHA)
    bg.fillRoundedRect(panelX - panelW/2, panelTop, panelW, panelH, 10)
    bg.lineStyle(2, PANEL_BORDER, 0.5)
    bg.strokeRoundedRect(panelX - panelW/2, panelTop, panelW, panelH, 10)
    this._objects.push(bg)

    // Fade overlay — transparent at top, semi-opaque dark at bottom
    // This softens the bottom edge so text fades into the game world
    const fadeH = Math.round(panelH * 0.35)
    const fadeY = panelTop + panelH - fadeH
    const fade = this.scene.add.graphics()
      .setDepth(depth + 3).setScrollFactor(0)
    fade.fillGradientStyle(PANEL_FILL, PANEL_FILL, PANEL_FILL, PANEL_FILL,
      0, 0, PANEL_ALPHA, PANEL_ALPHA)
    fade.fillRect(panelX - panelW/2, fadeY, panelW, fadeH)
    this._objects.push(fade)

    // ── Hint ──
    const hint = this.scene.add.text(panelX, panelTop + panelH - 6, '↑ swipe up to dismiss', {
      fontSize: SIZES.hint, fontFamily: FONTS.english, color: COLORS.hint
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(depth + 2).setAlpha(0.4)
    this._objects.push(hint)

    // ── Geometry mask — clips text hard to panel bounds ──
    const maskGfx = this.scene.add.graphics().setScrollFactor(0).setDepth(depth - 1)
    maskGfx.fillStyle(0xffffff)
    maskGfx.fillRect(panelX - panelW/2, panelTop, panelW, panelH)
    this._maskGfx = maskGfx
    this._objects.push(maskGfx)   // include in _objects so it fades and destroys with panel
    const mask = maskGfx.createGeometryMask()

    // ── Content items ──
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

  // ── Scroll logic ──────────────────────────────────────────────────────────

  _applyScroll() {
    if (!this._contentItems) return
    const clipTop    = this._clipTop    || 0
    const clipBottom = this._clipBottom || 9999
    const fadeZone   = 24   // px over which lines fade in/out at edges

    this._contentItems.forEach(({ obj, localY, baseAlpha }) => {
      if (!obj?.active) return
      const y = this._contentBaseY + localY - this._scrollY
      obj.y = y

      // Fade in as line enters from bottom, fade out as it exits top
      const bottom = y + (obj.height || 20)
      let a = baseAlpha
      if (y < clipTop) {
        // Above top edge — fade out
        a = Math.max(0, Math.min(a, (y - (clipTop - fadeZone)) / fadeZone))
      }
      if (bottom > clipBottom) {
        // Below bottom edge — fade out
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
    this._rafId = requestAnimationFrame(this._tick.bind(this))
  }

  _tick() {
    if (!this._scrolling) return
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
    this._holdTimer = setTimeout(() => { this._holdTimer = null; this.hide() }, HOLD_MS)
  }

  _stopScroll() {
    this._scrolling = false
    if (this._rafId)      { cancelAnimationFrame(this._rafId); this._rafId      = null }
    if (this._pauseTimer) { clearTimeout(this._pauseTimer);    this._pauseTimer = null }
    if (this._holdTimer)  { clearTimeout(this._holdTimer);     this._holdTimer  = null }
  }

  // ── Input ────────────────────────────────────────────────────────────────

  _bindInput() {
    this._unbindInput()

    this._onDown = (p) => {
      const inside = this._inBounds(p)
      this._inPanelDrag = inside
      this._dragging    = inside
      if (!inside) {
        // Reset velocity so stale drag state can't affect scroll
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
      this._scrollY = Math.max(0, Math.min(this._maxScroll,
        this._dragStartScroll + (this._dragStartY - p.y)))
      this._applyScroll()
      this._lastDragY    = p.y
      this._lastDragTime = now
    }

    this._onUp = (p) => {
      // Always clear drag state — prevents slider/joystick bleeding into scroll
      const wasInPanel   = this._dragging && this._inPanelDrag
      const savedVel     = this._dragVelocity
      this._dragging     = false
      this._inPanelDrag  = false
      this._dragVelocity = 0

      if (!wasInPanel) {
        // Not our gesture — but ensure scroll resumes if it should be running
        if (this._scrolling && !this._paused && !this._atTop && !this._rafId) {
          this._rafId = requestAnimationFrame(this._tick.bind(this))
        }
        return
      }

      const dy   = Math.abs(p.y - this._tapStartY)
      const dt   = performance.now() - this._tapStartTime
      const tap  = dy < 12 && dt < 300

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

      // Fast upward fling → dismiss
      if (savedVel < -DISMISS_VEL) { this.hide(); return }

      // Regular fling
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

  // ── Cooldown ─────────────────────────────────────────────────────────────

  _startCooldown() {
    if (this._lastTriggerId) {
      this._cooldownId = this._lastTriggerId
      setTimeout(() => { this._cooldownId = null }, COOLDOWN_MS)
    }
  }

  // ── Other panel types ─────────────────────────────────────────────────────

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

  // ── Cleanup ──────────────────────────────────────────────────────────────

  _destroyAll() {
    this._stopScroll()
    this._unbindInput()
    if (this._maskGfx) { this._maskGfx.destroy(); this._maskGfx = null }
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
    this.currentPanelType = null
  }
}


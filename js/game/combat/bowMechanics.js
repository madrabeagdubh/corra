import Phaser from 'phaser';
import PathFinder from '../systems/pathFinder.js';

/**
 * BowMechanics — perspective-aware bow and arrow system.
 *
 * Trigger: tap+drag on the player character. Drag 30px+ to fire.
 * Short drags cancel. Tap alone does nothing.
 *
 * Arrow physics run in logical world-pixel space, projected to screen
 * each frame via PGR. Arrows are simple white lines.
 *
 * Aiming visuals (pull-back line + arc dots) are rendered in a full-screen
 * SVG element that sits above every DOM layer, so PGR overlays and the moon
 * widget can never obscure or intercept the drag.
 */
export default class BowMechanics {
  constructor(scene, player) {
    this.scene  = scene
    this.player = player

    this.isAiming       = false
    this.aimLine        = null   // kept for API compat — not used for rendering during aim
    this.arrows         = []
    this.creakSound     = null
    this.creakIsPlaying = false

    this.maxDrawDistance = 180   // screen pixels max drag
    this.minDistance     = 96    // world-pixel minimum travel (~2 tiles)
    this.maxDistance     = 800   // world-pixel maximum travel
    this.flightTime      = 600   // ms at full force
    this.arcHeight       = 120   // max screen-pixel arc

    this._aimStartPointer = null
    this._aimOverlay      = null   // SVG element
    this._svgPullLine     = null
    this._svgDots         = null

    this._setupInput()
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  _setupInput() {
    this.scene.input.on('pointerdown', pointer => {
      if (this._isUIZone(pointer)) return
      if (!this._isTapOnPlayer(pointer)) return
      this._startAiming(pointer)
    })

    // Phaser pointermove/up only fire when SVG overlay is absent (fallback)
    this.scene.input.on('pointermove', pointer => {
      if (this.isAiming && !this._aimOverlay) this._updateAimLine(pointer)
    })
    this.scene.input.on('pointerup', pointer => {
      if (this.isAiming && !this._aimOverlay) this._shootArrow(pointer)
    })

    this.scene.input.on('pointercancel', () => {
      if (this.isAiming) this._cancelAiming()
    })

    this._blurHandler = () => { if (this.isAiming) this._cancelAiming() }
    window.addEventListener('blur', this._blurHandler)
    document.addEventListener('visibilitychange', this._blurHandler)
  }

  _isUIZone(pointer) {
    const W = this.scene.scale.width
    const H = this.scene.scale.height
    if (pointer.x < 220 && pointer.y > H - 220) return true
    if (pointer.x > W - 120 && pointer.y < 150) return true
    return false
  }

  _isTapOnPlayer(pointer) {
    const TAP_RADIUS = 52
    const pos = this._playerScreenPos()
    if (!pos) return false
    const dx = pointer.x - pos.x
    const dy = pointer.y - pos.y
    return dx * dx + dy * dy <= TAP_RADIUS * TAP_RADIUS
  }

  // ── Player screen position ────────────────────────────────────────────────

  _playerScreenPos() {
    const pgr = this.scene.perspectiveGround
    if (!pgr) {
      const sprite = this.player.sprite
      if (!sprite) return null
      return { x: sprite.x, y: sprite.y - (sprite.displayHeight ?? 64) * 0.3 }
    }

    const proj = pgr._projectLogical(this.player.logicalX, this.player.logicalY)
    if (!proj) return null

    const ts      = pgr.tileDisplaySize
    const tileRow = this.player.logicalY / ts - 0.5
    const scaledW = pgr._scaleAtRow(tileRow + 1)
    const hm      = pgr.constructor.HEIGHT_MULTIPLIER ?? 1.6
    const spriteH = scaledW * hm

    return {
      x: proj.screenX,
      y: proj.screenY - spriteH * 0.5
    }
  }

  // ── Inventory ─────────────────────────────────────────────────────────────

  hasArrows() {
    const inv = this.player.inventory
    for (let i = 0; i < inv.totalSlots; i++) {
      const item = inv.getItem(i)
      if (item?.id === 'arrows' && item.quantity > 0) return true
    }
    return false
  }

  consumeArrow() {
    const inv = this.player.inventory
    for (let i = 0; i < inv.totalSlots; i++) {
      const item = inv.getItem(i)
      if (item?.id === 'arrows' && item.quantity > 0) {
        item.quantity--
        if (item.quantity <= 0) inv.removeItem(i)
        if (this.scene.worldMenu?.isOpen) this.scene.worldMenu.refreshGridDisplay()
        return true
      }
    }
    return false
  }

  // ── SVG aim overlay ───────────────────────────────────────────────────────
  // A full-screen SVG sits above every DOM element (PGR layers, moon widget,
  // everything) for the duration of a bow draw.
  // It owns all pointer events AND renders the aim line + arc dots itself,
  // bypassing the Phaser canvas entirely so z-index stacking is never an issue.

  _createAimOverlay() {
    if (this._aimOverlay) return

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.style.cssText = [
      'position:fixed;',
      'top:0;left:0;',
      `width:${window.innerWidth}px;`,
      `height:${window.innerHeight}px;`,
      'z-index:9999999;',
      'pointer-events:all;',
      'touch-action:none;',
      'overflow:visible;',
    ].join('')

    // Pull-back line (drag direction, yellow)
    const pullLine = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    pullLine.setAttribute('stroke', '#ffcc44')
    pullLine.setAttribute('stroke-width', '2')
    pullLine.setAttribute('stroke-opacity', '0.8')
    pullLine.setAttribute('x1', '0'); pullLine.setAttribute('y1', '0')
    pullLine.setAttribute('x2', '0'); pullLine.setAttribute('y2', '0')
    svg.appendChild(pullLine)

    // Arc dots group (fire direction, white)
    const dotsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    svg.appendChild(dotsGroup)

    const mkPtr = e => ({ x: e.clientX, y: e.clientY })

    svg.addEventListener('pointermove', e => {
      e.preventDefault()
      if (!this.isAiming) return
      this._updateAimLine(mkPtr(e))
    }, { passive: false })

    svg.addEventListener('pointerup', e => {
      e.preventDefault()
      if (this.isAiming) this._shootArrow(mkPtr(e))
      this._removeAimOverlay()
    }, { passive: false })

    svg.addEventListener('pointercancel', () => {
      if (this.isAiming) this._cancelAiming()
      this._removeAimOverlay()
    }, { passive: false })

    document.body.appendChild(svg)
    this._aimOverlay  = svg
    this._svgPullLine = pullLine
    this._svgDots     = dotsGroup
  }

  _removeAimOverlay() {
    if (this._aimOverlay) {
      this._aimOverlay.remove()
      this._aimOverlay  = null
      this._svgPullLine = null
      this._svgDots     = null
    }
  }

  // Render pull-back line + arc dots into the SVG (called each frame during aim)
  _renderAimSVG(pos, dragAngle, fireAngle, force, clampedDist) {
    if (!this._svgPullLine || !this._svgDots) return

    // Pull-back line endpoint
    const endX = pos.x + Math.cos(dragAngle) * clampedDist
    const endY = pos.y + Math.sin(dragAngle) * clampedDist
    this._svgPullLine.setAttribute('x1', pos.x)
    this._svgPullLine.setAttribute('y1', pos.y)
    this._svgPullLine.setAttribute('x2', endX)
    this._svgPullLine.setAttribute('y2', endY)

    // Rebuild arc dots
    while (this._svgDots.firstChild) this._svgDots.removeChild(this._svgDots.firstChild)

    const pgr = this.scene.perspectiveGround
    if (!pgr) return

    const worldDist = this.minDistance + force * (this.maxDistance - this.minDistance)

    for (let i = 1; i <= 8; i++) {
      const t   = i / 8
      const arc = -4 * this.arcHeight * force * force * t * (t - 1)
      const lx  = this.player.logicalX + Math.cos(fireAngle) * worldDist * t
      const ly  = this.player.logicalY + Math.sin(fireAngle) * worldDist * t

      const proj = pgr._projectLogical(lx, ly)
      if (!proj || proj.screenY < pgr._horizonPx()) continue

      const dotR   = Math.max(1, 3.5 * (1 - t * 0.6))
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      circle.setAttribute('cx',   proj.screenX)
      circle.setAttribute('cy',   proj.screenY - arc)
      circle.setAttribute('r',    dotR)
      circle.setAttribute('fill', 'rgba(255,255,255,0.6)')
      this._svgDots.appendChild(circle)
    }
  }

  // ── Aiming ────────────────────────────────────────────────────────────────

  _startAiming(pointer) {
    const equippedRight = this.player.inventory?.getEquippedItem('rightHand')
    if (equippedRight?.id !== 'simple_bow') return
    if (!this.hasArrows()) return

    const pos = this._playerScreenPos()
    if (!pos) return

    if (this.aimLine) { this.aimLine.destroy(); this.aimLine = null }

    this.scene.sound.unlock()
    this.scene._bowAiming = true
    this.player.clearPath()

    this._aimStartPointer = { x: pointer.x, y: pointer.y }
    this.isAiming   = true
    this._aimOrigin = pos

    // SVG overlay created first — owns the full pointer stream immediately,
    // nothing underneath (moon widget etc.) can intercept
    this._createAimOverlay()
  }

  _updateAimLine(pointer) {
    if (!this.isAiming) return

    const pos = this._playerScreenPos()
    if (!pos) return

    const dx   = pointer.x - pos.x
    const dy   = pointer.y - pos.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    const drawStrength = Math.min(dist / this.maxDrawDistance, 1)
    if (drawStrength >= 0.7 && !this.creakIsPlaying) {
      this.creakSound = this.scene.sound.add('creak1')
      this.creakSound.play({ volume: 0.6 })
      this.creakIsPlaying = true
    }

    const clampedDist = Math.min(dist, this.maxDrawDistance)
    const dragAngle   = Math.atan2(dy, dx)
    const fireAngle   = Math.atan2(-dy, -dx)
    const force       = clampedDist / this.maxDrawDistance
    this._currentAimAngle = fireAngle

    this._lastPointerX = pointer.x
    this._lastPointerY = pointer.y

    // All rendering goes through the SVG overlay — always on top, never blocked
    this._renderAimSVG(pos, dragAngle, fireAngle, force, clampedDist)
  }

  // ── Shooting ──────────────────────────────────────────────────────────────

  _shootArrow(pointer) {
    if (!this.isAiming) return

    const pos   = this._playerScreenPos()
    const start = this._aimStartPointer

    if (!pos || !start) { this._cancelAiming(); return }

    const ddx      = pointer.x - start.x
    const ddy      = pointer.y - start.y
    const dragDist = Math.sqrt(ddx * ddx + ddy * ddy)

    if (dragDist < 15) {
      this._cancelAiming()
      return
    }

    if (!this.consumeArrow()) { this._cancelAiming(); return }

    if (this.creakSound) {
      this.creakSound.stop(); this.creakSound.destroy()
      this.creakSound = null; this.creakIsPlaying = false
    }

    const sounds = ['arrowShoot1', 'arrowShoot2', 'arrowShoot3']
    this.scene.sound.play(Phaser.Math.RND.pick(sounds), { volume: 0.7 })

    const dx    = pointer.x - pos.x
    const dy    = pointer.y - pos.y
    const dist  = Math.sqrt(dx * dx + dy * dy)
    const force = Math.min(dist / this.maxDrawDistance, 1)
    const angle = this._currentAimAngle ?? Math.atan2(-dy, -dx)
    const worldDist = this.minDistance + force * (this.maxDistance - this.minDistance)

    this._createArrow(angle, force, worldDist)
    this._cancelAiming()
  }

  // ── Predict landing point (used by tutorial) ──────────────────────────────
  predictLandingPoint() {
    if (!this.isAiming) return null
    const pos   = this._playerScreenPos()
    const start = this._aimStartPointer
    if (!pos || !start) return null

    const dx   = pos.x - (this._lastPointerX ?? pos.x)
    const dy   = pos.y - (this._lastPointerY ?? pos.y)
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 5) return null

    const force     = Math.min(dist / this.maxDrawDistance, 1)
    const angle     = Math.atan2(-dy, -dx)
    const worldDist = this.minDistance + force * (this.maxDistance - this.minDistance)

    return {
      x: this.player.logicalX + Math.cos(angle) * worldDist,
      y: this.player.logicalY + Math.sin(angle) * worldDist
    }
  }

  // ── Arrow creation ────────────────────────────────────────────────────────

  _createArrow(angle, force, worldDist) {
    const arrowGfx = this.scene.add.graphics()
    arrowGfx.setDepth(150)
    arrowGfx.setScrollFactor(0)

    const trail = this.scene.add.graphics()
    trail.setDepth(140)
    trail.setScrollFactor(0)

    const initPos = this._playerScreenPos()

    arrowGfx.setData({
      startLX:        this.player.logicalX,
      startLY:        this.player.logicalY,
      angle,
      force,
      worldDist,
      elapsed:        0,
      active:         true,
      hasLanded:      false,
      hitTarget:      false,
      trail,
      trailPositions: [],
      prevScreenX:    initPos?.x ?? null,
      prevScreenY:    initPos?.y ?? null,
    })

    this.arrows.push(arrowGfx)

    const flightMs = this.flightTime * (0.4 + force * 0.6)
    this.scene.time.delayedCall(flightMs + 2000, () => this._destroyArrow(arrowGfx))
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(delta) {
    const pgr = this.scene.perspectiveGround
    if (!pgr) return

    this.arrows.forEach(arrow => {
      if (!arrow.getData('active') && !arrow.getData('hasLanded')) return

      const elapsed  = arrow.getData('elapsed') + delta
      arrow.setData('elapsed', elapsed)

      const force    = arrow.getData('force')
      const flightMs = this.flightTime * (0.4 + force * 0.6)
      const progress = Math.min(elapsed / flightMs, 1)

      const startLX   = arrow.getData('startLX')
      const startLY   = arrow.getData('startLY')
      const angle     = arrow.getData('angle')
      const worldDist = arrow.getData('worldDist')

      const lx = startLX + Math.cos(angle) * worldDist * progress
      const ly = startLY + Math.sin(angle) * worldDist * progress

      const dynamicArc = this.arcHeight * force * force
      const arcOffset  = -4 * dynamicArc * progress * (progress - 1)

      const proj = pgr._projectLogical(lx, ly)
      if (!proj || proj.screenY < pgr._horizonPx()) {
        if (!arrow.getData('landScreenX')) {
          const endProj = pgr._projectLogical(
            startLX + Math.cos(angle) * worldDist,
            startLY + Math.sin(angle) * worldDist
          )
          if (endProj) {
            arrow.setData('landScreenX', endProj.screenX)
            arrow.setData('landScreenY', endProj.screenY)
          } else {
            const endTileX  = (startLX + Math.cos(angle) * worldDist) / pgr.tileDisplaySize
            const horizonSX = pgr._colToScreenX(endTileX, pgr._perspCamRow())
            arrow.setData('landScreenX', horizonSX)
            arrow.setData('landScreenY', pgr._horizonPx())
          }
        }
        arrow.clear()
        arrow.setData('active', false)
        arrow.setData('hasLanded', true)
        arrow.setData('landTime', Date.now())
        const tr = arrow.getData('trail')
        if (tr) tr.clear()
        return
      }

      const ts2      = pgr.tileDisplaySize
      const scaledW  = pgr._scaleAtRow(pgr._perspCamRow() - (this.player.logicalY / ts2 - 0.5))
      const heightPx = scaledW * 1.8 * 0.5

      const sx = proj.screenX
      const sy = proj.screenY - arcOffset - heightPx

      const scale  = pgr._scaleAtRow(pgr._perspCamRow() - (pgr.constructor.PLAYER_DIST_TILES))
      const arrowL = Math.max(2, scale * 0.4)

      const lookAhead = Math.min(progress + 0.05, 1)
      const lxA   = startLX + Math.cos(angle) * worldDist * lookAhead
      const lyA   = startLY + Math.sin(angle) * worldDist * lookAhead
      const arcA  = -4 * dynamicArc * lookAhead * (lookAhead - 1)
      const projA = pgr._projectLogical(lxA, lyA)
      let rot
      if (projA && projA.screenY >= pgr._horizonPx()) {
        const aheadSX = projA.screenX
        const aheadSY = projA.screenY - arcA - heightPx
        rot = Math.atan2(aheadSY - sy, aheadSX - sx)
      } else {
        rot = angle
      }

      arrow.clear()
      if (!arrow.getData('hasLanded')) {
        arrow.lineStyle(1.5, 0xffffff, 0.95)
        arrow.beginPath()
        arrow.moveTo(sx - Math.cos(rot) * arrowL * 0.5, sy - Math.sin(rot) * arrowL * 0.5)
        arrow.lineTo(sx + Math.cos(rot) * arrowL * 0.5, sy + Math.sin(rot) * arrowL * 0.5)
        arrow.strokePath()
      }

      const trailPositions = arrow.getData('trailPositions')
      trailPositions.push({ x: sx, y: sy, alpha: 0.5 })
      if (trailPositions.length > 10) trailPositions.shift()

      const trail = arrow.getData('trail')
      if (trail && !arrow.getData('hasLanded') && trailPositions.length > 1) {
        trail.clear()
        for (let i = 1; i < trailPositions.length; i++) {
          const p1 = trailPositions[i - 1]
          const p2 = trailPositions[i]
          p1.alpha *= 0.85
          trail.lineStyle(1, 0xffffff, p2.alpha * 0.4)
          trail.beginPath()
          trail.moveTo(p1.x, p1.y)
          trail.lineTo(p2.x, p2.y)
          trail.strokePath()
        }
      }

      if (progress >= 1 && !arrow.getData('hasLanded')) {
        arrow.setData('hasLanded', true)
        arrow.setData('active', false)
        arrow.setData('landTime', Date.now())
        const endProj = pgr._projectLogical(
          startLX + Math.cos(angle) * worldDist,
          startLY + Math.sin(angle) * worldDist
        )
        arrow.setData('landScreenX', endProj?.screenX ?? sx)
        arrow.setData('landScreenY', endProj?.screenY ?? sy)
        if (trail) trail.clear()
        this._createImpactEffect(sx, sy, force)
        arrow.lineStyle(1.5, 0xffffff, 0.7)
        arrow.beginPath()
        arrow.moveTo(sx, sy - arrowL * 0.4)
        arrow.lineTo(sx, sy + arrowL * 0.4)
        arrow.strokePath()
      }
    })
  }

  // ── Impact ────────────────────────────────────────────────────────────────

  _createImpactEffect(screenX, screenY, force) {
    const ring = this.scene.add.circle(screenX, screenY, 6, 0xFFFFFF, 0)
    ring.setStrokeStyle(1.5, 0xffffff, 0.7)
    ring.setDepth(199)
    ring.setScrollFactor(0)
    this.scene.tweens.add({
      targets: ring, radius: 20, alpha: 0,
      duration: 300, ease: 'Power2',
      onComplete: () => ring.destroy()
    })
  }

  // ── Cancel / destroy ──────────────────────────────────────────────────────

  _cancelAiming() {
    this.isAiming         = false
    this.scene._bowAiming = false
    this._aimStartPointer = null
    this._currentAimAngle = null

    this._removeAimOverlay()

    if (this.aimLine) { this.aimLine.destroy(); this.aimLine = null }

    if (this.creakSound) {
      this.creakSound.stop(); this.creakSound.destroy()
      this.creakSound = null
    }
    this.creakIsPlaying = false
  }

  cancelAiming() { this._cancelAiming() }

  _destroyArrow(arrow) {
    const i = this.arrows.indexOf(arrow)
    if (i !== -1) this.arrows.splice(i, 1)
    const trail = arrow.getData('trail')
    if (trail) trail.destroy()
    arrow.destroy()
  }

  // ── Hit detection ─────────────────────────────────────────────────────────

  checkHit(target, radius = 48) {
    for (const arrow of this.arrows) {
      if (!arrow.getData('hasLanded')) continue
      if (arrow.getData('hitTarget'))  continue

      const startLX     = arrow.getData('startLX')
      const startLY     = arrow.getData('startLY')
      const angle       = arrow.getData('angle')
      const worldDist   = arrow.getData('worldDist')
      const landX       = startLX + Math.cos(angle) * worldDist
      const landY       = startLY + Math.sin(angle) * worldDist
      const landScreenX = arrow.getData('landScreenX')
      const landScreenY = arrow.getData('landScreenY')

      const landTime = arrow.getData('landTime')
      if (landTime && Date.now() - landTime > 400) continue

      const useScreen = (target.logicalX == null) && landScreenX != null
      const d = useScreen
        ? Phaser.Math.Distance.Between(landScreenX, landScreenY, target.x, target.y)
        : Phaser.Math.Distance.Between(landX, landY, target.logicalX ?? target.x, target.logicalY ?? target.y)

      if (d < radius) {
        arrow.setData('hitTarget', true)
        this.scene.sound.play('pumpkin_break_01', { volume: 0.8 })
        return { arrow, force: arrow.getData('force'), distance: d, landX, landY, landScreenX, landScreenY }
      }
    }
    return null
  }

  destroy() {
    this._cancelAiming()
    this._removeAimOverlay()
    if (this._blurHandler) {
      window.removeEventListener('blur', this._blurHandler)
      document.removeEventListener('visibilitychange', this._blurHandler)
    }
    this.arrows.forEach(a => {
      const t = a.getData('trail')
      if (t) t.destroy()
      a.destroy()
    })
    this.arrows = []
  }
}


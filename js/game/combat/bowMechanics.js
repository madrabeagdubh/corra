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
 */
export default class BowMechanics {
  constructor(scene, player) {
    this.scene  = scene
    this.player = player

    this.isAiming       = false
    this.aimLine        = null   // single Graphics object, recreated each aim
    this.arrows         = []
    this.creakSound     = null
    this.creakIsPlaying = false

    this.maxDrawDistance = 180   // screen pixels max drag
    this.minDistance     = 96    // world-pixel minimum travel (~2 tiles)
    this.maxDistance     = 800   // world-pixel maximum travel
    this.flightTime      = 600   // ms at full force
    this.arcHeight       = 120   // max screen-pixel arc

    this._aimStartPointer = null

    this._setupInput()
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  _setupInput() {
    this.scene.input.on('pointerdown', pointer => {
      if (this._isUIZone(pointer)) return
      if (!this._isTapOnPlayer(pointer)) return
      this._startAiming(pointer)
    })
    this.scene.input.on('pointermove', pointer => {
      if (this.isAiming) this._updateAimLine(pointer)
    })
    this.scene.input.on('pointerup', pointer => {
      if (this.isAiming) this._shootArrow(pointer)
    })

    // Cancel aim if pointer is interrupted (tab switch, incoming call, etc.)
    this.scene.input.on('pointercancel', () => {
      if (this.isAiming) this._cancelAiming()
    })

    // Also catch window-level blur
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
  // The player billboard foot is at _projectLogical(logicalX, logicalY).
  // The sprite is drawn HEIGHT_MULTIPLIER tile-widths tall above the foot.
  // We want the visual centre — foot position minus half the rendered height.

  _playerScreenPos() {
    const pgr = this.scene.perspectiveGround
    // Fallback for scenes without PGR (tutorial) — use sprite position
    if (!pgr) {
      const sprite = this.player.sprite
      if (!sprite) return null
      return { x: sprite.x, y: sprite.y - (sprite.displayHeight ?? 64) * 0.3 }
    }

    const proj = pgr._projectLogical(this.player.logicalX, this.player.logicalY)
    if (!proj) return null

    // Rendered height = scaleAtRow * HEIGHT_MULTIPLIER
    const ts      = pgr.tileDisplaySize
    const tileRow = this.player.logicalY / ts - 0.5
    const scaledW = pgr._scaleAtRow(tileRow + 1)
    const hm      = pgr.constructor.HEIGHT_MULTIPLIER ?? 1.6
    const spriteH = scaledW * hm

    return {
      x: proj.screenX,
      y: proj.screenY - spriteH * 0.5   // move up to sprite centre
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

  // ── Aiming ────────────────────────────────────────────────────────────────

  _startAiming(pointer) {
    const equippedRight = this.player.inventory?.getEquippedItem('rightHand')
    if (equippedRight?.id !== 'simple_bow') return
    if (!this.hasArrows()) return

    const pos = this._playerScreenPos()
    if (!pos) return

    // Always destroy any old aimLine before creating a new one
    if (this.aimLine) { this.aimLine.destroy(); this.aimLine = null }

    this.scene.sound.unlock()
    this.scene._bowAiming = true
    this.player.clearPath()

    this._aimStartPointer = { x: pointer.x, y: pointer.y }
    this.isAiming   = true
    this._aimOrigin = pos

    this.aimLine = this.scene.add.graphics()
    this.aimLine.setDepth(200)
    this.aimLine.setScrollFactor(0)
  }

  _updateAimLine(pointer) {
    if (!this.aimLine || !this.isAiming) return

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
    const fireAngle   = Math.atan2(-dy, -dx)  // opposite of drag = fire direction
    const force       = clampedDist / this.maxDrawDistance
    this._currentAimAngle = fireAngle

    const endX = pos.x + Math.cos(dragAngle) * clampedDist
    const endY = pos.y + Math.sin(dragAngle) * clampedDist

    this._lastPointerX = pointer.x
    this._lastPointerY = pointer.y
    this.aimLine.clear()

    // Draw pull-back line in drag direction (opposite to fire)
    this.aimLine.lineStyle(2, 0xffcc44, 0.8)
    this.aimLine.beginPath()
    this.aimLine.moveTo(pos.x, pos.y)
    this.aimLine.lineTo(endX, endY)
    this.aimLine.strokePath()

    // Trajectory dots in fire direction
    this._drawArcDots(pos, fireAngle, force)
  }

  _drawArcDots(pos, angle, force) {
    if (!this.aimLine) return
    const pgr = this.scene.perspectiveGround
    if (!pgr) return

    const worldDist = this.minDistance + force * (this.maxDistance - this.minDistance)
    this.aimLine.fillStyle(0xffffff, 0.6)

    for (let i = 1; i <= 8; i++) {
      const t   = i / 8
      const arc = -4 * this.arcHeight * force * force * t * (t - 1)
      const lx  = this.player.logicalX + Math.cos(angle) * worldDist * t
      const ly  = this.player.logicalY + Math.sin(angle) * worldDist * t

      const proj = pgr._projectLogical(lx, ly)
      if (!proj || proj.screenY < pgr._horizonPx()) continue

      const dotR = Math.max(1, 3.5 * (1 - t * 0.6))
      this.aimLine.fillCircle(proj.screenX, proj.screenY - arc, dotR)
    }
  }

  // ── Shooting ──────────────────────────────────────────────────────────────

  _shootArrow(pointer) {
    if (!this.isAiming) return

    const pos   = this._playerScreenPos()
    const start = this._aimStartPointer

    // Always clean up aim graphics
    if (this.aimLine) { this.aimLine.destroy(); this.aimLine = null }

    if (!pos || !start) { this._cancelAiming(); return }

    const ddx      = pointer.x - start.x
    const ddy      = pointer.y - start.y
    const dragDist = Math.sqrt(ddx * ddx + ddy * ddy)

    if (dragDist < 15) {
      // Tiny tap — cancel, no arrow consumed
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
    // Use angle from last updateAimLine call (negated drag direction)
    const angle = this._currentAimAngle ?? Math.atan2(-dy, -dx)
    const worldDist = this.minDistance + force * (this.maxDistance - this.minDistance)

    this._createArrow(angle, force, worldDist)
    this._cancelAiming()
  }

  // ── Predict landing point (used by tutorial) ────────────────────────────────
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

    // Capture screen-space start from sprite centre for accurate visual origin
    const startScreenPos = this._playerScreenPos()

    // Store initial screen position so off-screen arrows still have a landing pos
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

      const startLX  = arrow.getData('startLX')
      const startLY  = arrow.getData('startLY')
      const angle    = arrow.getData('angle')
      const worldDist = arrow.getData('worldDist')

      const lx = startLX + Math.cos(angle) * worldDist * progress
      const ly = startLY + Math.sin(angle) * worldDist * progress

      const dynamicArc = this.arcHeight * force * force
      const arcOffset  = -4 * dynamicArc * progress * (progress - 1)

      const proj = pgr._projectLogical(lx, ly)
      if (!proj || proj.screenY < pgr._horizonPx()) {
        // Arrow left visible area — project the logical endpoint for hit detection
        // so the landing position matches where the arc dots predicted it would go
        if (!arrow.getData('landScreenX')) {
          const endProj = pgr._projectLogical(
            startLX + Math.cos(angle) * worldDist,
            startLY + Math.sin(angle) * worldDist
          )
          if (endProj) {
            arrow.setData('landScreenX', endProj.screenX)
            arrow.setData('landScreenY', endProj.screenY)
          } else {
            // Endpoint is above horizon — clamp to horizon line
            const camCol = pgr._perspCamCol()
            const endTileX = (startLX + Math.cos(angle) * worldDist) / pgr.tileDisplaySize
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

      // Keep arrow at a consistent height above the ground projection.
      // proj.screenY is the ground point — offset upward by perspective scale
      // to keep the arrow floating at a natural flight height above ground.
      const ts2      = pgr.tileDisplaySize
      const scaledW  = pgr._scaleAtRow(pgr._perspCamRow() - (this.player.logicalY / ts2 - 0.5))
      const heightPx = scaledW * 1.8 * 0.5  // constant half-sprite height above ground

      const sx = proj.screenX
      const sy = proj.screenY - arcOffset - heightPx

      // Arrow size scales with perspective
      const scale  = pgr._scaleAtRow(pgr._perspCamRow() - (pgr.constructor.PLAYER_DIST_TILES))
      const arrowL = Math.max(2, scale * 0.4)  // half size

      // Rotate arrow based on actual trajectory direction in screen space.
      // Project a point slightly ahead along the flight path to get direction,
      // rather than using noisy frame-to-frame delta which flips on flat shots.
      const lookAhead  = Math.min(progress + 0.05, 1)
      const lxA = startLX + Math.cos(angle) * worldDist * lookAhead
      const lyA = startLY + Math.sin(angle) * worldDist * lookAhead
      const arcA = -4 * dynamicArc * lookAhead * (lookAhead - 1)
      const projA = pgr._projectLogical(lxA, lyA)
      let rot
      if (projA && projA.screenY >= pgr._horizonPx()) {
        const aheadSX = projA.screenX
        const aheadSY = projA.screenY - arcA - heightPx
        rot = Math.atan2(aheadSY - sy, aheadSX - sx)
      } else {
        rot = angle  // fallback to world angle if projection fails
      }

      arrow.clear()
      if (!arrow.getData('hasLanded')) {
        // Simple white line arrow
        arrow.lineStyle(1.5, 0xffffff, 0.95)
        arrow.beginPath()
        arrow.moveTo(sx - Math.cos(rot) * arrowL * 0.5, sy - Math.sin(rot) * arrowL * 0.5)
        arrow.lineTo(sx + Math.cos(rot) * arrowL * 0.5, sy + Math.sin(rot) * arrowL * 0.5)
        arrow.strokePath()
      }

      // Fading trail
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

      // Landing
      if (progress >= 1 && !arrow.getData('hasLanded')) {
        arrow.setData('hasLanded', true)
        arrow.setData('active', false)
        arrow.setData('landTime', Date.now())  // timestamp for hit window
        // Project the logical endpoint for accurate hit detection
        const endProj = pgr._projectLogical(
          startLX + Math.cos(angle) * worldDist,
          startLY + Math.sin(angle) * worldDist
        )
        arrow.setData('landScreenX', endProj?.screenX ?? sx)
        arrow.setData('landScreenY', endProj?.screenY ?? sy)
        if (trail) trail.clear()
        this._createImpactEffect(sx, sy, force)
        // Draw stuck arrow
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
    this.isAiming          = false
    this.scene._bowAiming  = false
    this._aimStartPointer  = null
    this._currentAimAngle  = null

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

      // Screen-space comparison for tutorial targets (no logicalX set)
      // Only valid within 400ms of landing — moving targets can't be hit by old arrows
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


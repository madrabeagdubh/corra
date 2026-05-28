#!/usr/bin/env python3
"""
Run from ~/Corra:
  python3 ~/Downloads/patch_tilt_bob.py

Hooks boat tilt/bob/stroke to velocity vector instead of tile steps.
"""
import sys
from pathlib import Path

PGR = Path('js/game/effects/perspectiveGroundRenderer.js')
txt = PGR.read_text()

# ── Replace tile-step driven stroke/facing with velocity-driven version ───────
old = """    // ── Rowing stroke cycle (currach style) ──────────────────────────
    // Track tile steps -- used for both boat stroke and land walk
    const curTileX = p ? Math.floor(p.logicalX / this.tileDisplaySize) : 0
    const curTileY = p ? Math.floor(p.logicalY / this.tileDisplaySize) : 0
    const vx = curTileX - (this._prevTileX ?? curTileX)
    const vy = curTileY - (this._prevTileY ?? curTileY)
    const stepped = vx !== 0 || vy !== 0
    this._prevTileX = curTileX
    this._prevTileY = curTileY

    if (vx < 0)      this._facingLeft = true
    else if (vx > 0) this._facingLeft = false

    if (stepped) {
      this._moveDir = Math.abs(vx) > 0 ? 'ew' : 'ns'
      this._nextSwaySign = vx !== 0 ? (vx > 0 ? 1 : -1) : (this._swaySign ?? 1)
      const st = this._stepT ?? 1
      if (st > 0.85 || st === 0) {
        this._stepT    = 0
        this._swaySign = this._nextSwaySign
      }
      // Advance stroke counter every 2 tiles for currach rhythm
      if (this._boatActive && p?.isMoving) {
        this._strokeTiles = ((this._strokeTiles ?? 0) + 1)
        // New stroke every 2 tiles
        if (this._strokeTiles % 2 === 0) {
          this._strokeT  = 0
          this._strokePhase = 'drive'
        }
      }
    }

    const moving = p?.isMoving ?? false
    if (moving) {
      this._stepT = (this._stepT || 0) + 0.09
      if (this._stepT >= 1.0) {
        this._stepT    = 0
        this._swaySign = this._nextSwaySign ?? this._swaySign ?? 1
      }
      // Advance stroke animation
      if (this._boatActive) {
        this._strokeT = Math.min(1.0, (this._strokeT ?? 0) + 0.018)
      }
    } else if (this._boatActive) {
      // Recovery glide back to neutral when stopping
      this._strokeT = Math.max(0, (this._strokeT ?? 0) - 0.012)
    }"""

new = """    // ── Stroke/facing driven by velocity when in boat, tile steps otherwise ──
    const boatVX = this._boatActive ? (this.scene?.boatSystem?._vx ?? 0) : 0
    const boatVY = this._boatActive ? (this.scene?.boatSystem?._vy ?? 0) : 0
    const boatSpd = Math.hypot(boatVX, boatVY)

    // Tile-step tracking for land movement
    const curTileX = p ? Math.floor(p.logicalX / this.tileDisplaySize) : 0
    const curTileY = p ? Math.floor(p.logicalY / this.tileDisplaySize) : 0
    const dvx = curTileX - (this._prevTileX ?? curTileX)
    const dvy = curTileY - (this._prevTileY ?? curTileY)
    const stepped = dvx !== 0 || dvy !== 0
    this._prevTileX = curTileX
    this._prevTileY = curTileY

    // Facing: velocity when in boat, tile step otherwise
    if (this._boatActive) {
      if (boatVX < -4)      this._facingLeft = true
      else if (boatVX > 4)  this._facingLeft = false
    } else {
      if (dvx < 0)      this._facingLeft = true
      else if (dvx > 0) this._facingLeft = false
    }

    if (!this._boatActive && stepped) {
      this._moveDir = Math.abs(dvx) > 0 ? 'ew' : 'ns'
      this._nextSwaySign = dvx !== 0 ? (dvx > 0 ? 1 : -1) : (this._swaySign ?? 1)
      const st = this._stepT ?? 1
      if (st > 0.85 || st === 0) {
        this._stepT    = 0
        this._swaySign = this._nextSwaySign
      }
    }

    const moving = this._boatActive ? boatSpd > 8 : (p?.isMoving ?? false)

    if (this._boatActive) {
      // Stroke advances with speed, retreats when still
      const strokeRate = Math.min(boatSpd / 80, 1.0) * 0.025
      if (boatSpd > 8) {
        this._strokeT = Math.min(1.0, (this._strokeT ?? 0) + strokeRate)
        if (this._strokeT >= 1.0) this._strokeT = 0  // loop stroke
      } else {
        this._strokeT = Math.max(0, (this._strokeT ?? 0) - 0.015)
      }
    } else if (moving) {
      this._stepT = (this._stepT || 0) + 0.09
      if (this._stepT >= 1.0) {
        this._stepT    = 0
        this._swaySign = this._nextSwaySign ?? this._swaySign ?? 1
      }
    }"""

if old in txt:
    txt = txt.replace(old, new, 1)
    print('[PGR] patched: velocity-driven stroke/facing')
else:
    print('[PGR] WARNING: stroke block not found', file=sys.stderr)

# ── Replace idle bob/tilt with velocity-enhanced version ─────────────────────
old2 = """    // Idle bob/roll when in boat and not moving
    const idleBob  = (this._boatActive && !moving)
      ? Math.sin(t * 1.1) * scaledTileW * 0.018
      : 0
    const idleRock = (this._boatActive && !moving)
      ? Math.sin(t * 0.65) * 0.03
      : 0

    const totalBob  = rowBob + idleBob
    const totalLean = rowLean + idleRock"""

new2 = """    // Bob: idle sine wave + speed-based chop
    const idleBob  = this._boatActive
      ? Math.sin(t * 1.1) * scaledTileW * 0.022
      : 0
    // Chop: faster bob at speed, calmer when still
    const chopAmt  = this._boatActive
      ? Math.sin(t * (2.2 + boatSpd * 0.015)) * scaledTileW * Math.min(boatSpd / 200, 0.018)
      : 0

    // Rock: idle roll + velocity-driven tilt
    // Turning left/right tilts the boat into the turn
    // Going fast tilts bow down slightly
    const idleRock = this._boatActive
      ? Math.sin(t * 0.65) * 0.025
      : 0
    const velTiltX = this._boatActive ? boatVX * 0.0003 : 0   // lean into direction
    const velTiltY = this._boatActive ? boatVY * 0.0002 : 0   // bow dips going fast

    // Acceleration tilt: boat tips back when surging forward
    const prevVX   = this._prevBoatVX ?? boatVX
    const accelX   = boatVX - prevVX
    this._prevBoatVX = boatVX
    const accelTilt = this._boatActive ? -accelX * 0.004 : 0

    const totalBob  = rowBob + idleBob + chopAmt
    const totalLean = rowLean + idleRock + velTiltX + accelTilt"""

if old2 in txt:
    txt = txt.replace(old2, new2, 1)
    print('[PGR] patched: velocity-driven tilt/bob')
else:
    print('[PGR] WARNING: idle bob block not found', file=sys.stderr)

# ── Apply velTiltY to boat draw (forward/backward pitch) ─────────────────────
old3 = """        const _idleRock = (this._boatActive && !moving) ? Math.sin((this._animT||0) * 0.65) * 0.03 : 0
        if (Math.abs(_idleRock) > 0.001) {
          ctx.save()
          ctx.translate(Math.round(bx), Math.round(by))
          ctx.rotate(_idleRock)
          ctx.drawImage(bc, -Math.round(boatW / 2), Math.round(boatTop - by), boatW, boatH)
          ctx.restore()
        } else {
          ctx.drawImage(bc, Math.round(bx - boatW / 2), Math.round(boatTop), boatW, boatH)
        }"""

new3 = """        // Full tilt: idle rock + velocity lean + acceleration tip
        const _boatRock = idleRock + velTiltX + accelTilt
        const _boatPitch = velTiltY  // bow dips on north/south movement
        if (Math.abs(_boatRock) > 0.001 || Math.abs(_boatPitch) > 0.001) {
          ctx.save()
          ctx.translate(Math.round(bx), Math.round(by + totalBob))
          ctx.rotate(_boatRock)
          // Pitch: skew Y slightly for bow-up/bow-down feel
          ctx.transform(1, _boatPitch * 0.3, 0, 1, 0, 0)
          ctx.drawImage(bc, -Math.round(boatW / 2), Math.round(boatTop - by - totalBob), boatW, boatH)
          ctx.restore()
        } else {
          ctx.drawImage(bc, Math.round(bx - boatW / 2), Math.round(boatTop + totalBob), boatW, boatH)
        }"""

if old3 in txt:
    txt = txt.replace(old3, new3, 1)
    print('[PGR] patched: boat draw uses full tilt/bob')
else:
    print('[PGR] WARNING: boat draw tilt block not found', file=sys.stderr)

PGR.write_text(txt)
print('\nDone.')

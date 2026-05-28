#!/usr/bin/env python3
"""
Run from ~/Corra:
  python3 ~/Downloads/patch_boat_momentum.py

Adds Asteroids-style momentum to boat movement:
- Joystick adds impulse to velocity vector
- Friction bleeds velocity each frame
- Position updated sub-tile (smooth, not tile-stepped)
- player.update() is bypassed when inBoat
"""
import sys
from pathlib import Path

# ── 1. player.js -- bypass tile-step system when inBoat ──────────────────────
PLAYER = Path('js/game/player/player.js')
txt = PLAYER.read_text()

old = """  update(joystick) {
    if (!joystick)       return;
    if (!this.isAlive()) return;

    const force = joystick.force;

    if (this.isMoving) {"""

new = """  update(joystick) {
    if (!joystick)       return;
    if (!this.isAlive()) return;

    // Boat momentum is handled entirely by BoatSystem -- skip tile-step logic
    if (this.inBoat) return;

    const force = joystick.force;

    if (this.isMoving) {"""

if old in txt:
    txt = txt.replace(old, new, 1)
    print('[player.js] patched: inBoat bypasses tile-step system')
else:
    print('[player.js] WARNING: not found', file=sys.stderr)

PLAYER.write_text(txt)

# ── 2. boatSystem.js -- add velocity/momentum system ─────────────────────────
BOAT = Path('js/game/systems/boatSystem.js')
txt = BOAT.read_text()

# Add velocity fields to constructor
old = """    // Fractional pixel accumulator for sub-pixel drift
    this._driftAccum = 0"""

new = """    // Fractional pixel accumulator for sub-pixel drift
    this._driftAccum = 0

    // Momentum: velocity in logical pixels per second
    this._vx = 0
    this._vy = 0"""

if old in txt:
    txt = txt.replace(old, new, 1)
    print('[boatSystem.js] patched: velocity fields added to constructor')
else:
    print('[boatSystem.js] WARNING: constructor not found', file=sys.stderr)

# Replace the update() drift/speed block with momentum system
old2 = """    // ── Speed modifier ────────────────────────────────────────────────────
    // Water: full speed + drift when idle
    // Reeds: half speed, no drift (wading feel)
    if (onReed) {
      if (p.terrainSpeedModifier !== SHORE_SPEED_MULT) {
        p.setTerrainSpeedModifier(SHORE_SPEED_MULT)
      }
    } else {
      if (p.terrainSpeedModifier !== 1.0) {
        p.setTerrainSpeedModifier(1.0)
      }
    }

    // ── East drift ────────────────────────────────────────────────────────
    // Only on open water, not reeds, not moving
    if (onWater && !p.isMoving && p.pathQueue.length === 0) {
      this._applyDrift(delta, ts, mapData)
    }"""

new2 = """    // ── Momentum-based movement ──────────────────────────────────────────
    const dt = delta / 1000   // seconds

    // Joystick impulse
    const joystick = this.scene.joystick
    const force    = joystick?.force ?? 0
    const angle    = joystick?.angle ?? 0

    // Max speed: slower in reeds, full in water
    const maxSpeed  = onReed ? 80 : 160   // logical px/s
    const impulse   = onReed ? 320 : 600  // px/s² acceleration
    const friction  = onReed ? 6.0 : 3.5  // multiplier per second (exponential)

    if (force > 10) {
      const rad = angle * Math.PI / 180
      const ix  = Math.cos(rad) * impulse * dt
      const iy  = Math.sin(rad) * impulse * dt
      this._vx += ix
      this._vy += iy
      // Clamp to max speed
      const spd = Math.hypot(this._vx, this._vy)
      if (spd > maxSpeed) {
        this._vx = this._vx / spd * maxSpeed
        this._vy = this._vy / spd * maxSpeed
      }
      p.isMoving = true
    } else {
      p.isMoving = Math.hypot(this._vx, this._vy) > 4
    }

    // East drift adds to velocity when on water
    if (onWater) {
      this._vx += DRIFT_SPEED_PX_S * dt
    }

    // Apply friction
    const fric = Math.pow(friction, -dt)
    this._vx *= fric
    this._vy *= fric

    // Dead stop below threshold
    if (Math.abs(this._vx) < 0.5) this._vx = 0
    if (Math.abs(this._vy) < 0.5) this._vy = 0

    // Move player
    if (this._vx !== 0 || this._vy !== 0) {
      const newX = p.logicalX + this._vx * dt
      const newY = p.logicalY + this._vy * dt

      // Collision check for X
      const txNew = Math.floor(newX / ts)
      const tyNew = Math.floor(newY / ts)
      const gidX  = mapData.layers[0]?.[Math.floor(p.logicalY / ts)]?.[txNew] ?? 0
      const gidY  = mapData.layers[0]?.[tyNew]?.[Math.floor(p.logicalX / ts)] ?? 0
      const passX = gidX === 1625 || gidX === 1679 || gidX === 731
      const passY = gidY === 1625 || gidY === 1679 || gidY === 731

      if (passX) { p.logicalX = newX } else { this._vx *= -0.3 }
      if (passY) { p.logicalY = newY } else { this._vy *= -0.3 }

      // Keep logical position snapped to map bounds
      const mapMaxX = (mapData.width  - 1) * ts
      const mapMaxY = (mapData.height - 1) * ts
      p.logicalX = Math.max(ts * 0.5, Math.min(mapMaxX, p.logicalX))
      p.logicalY = Math.max(ts * 0.5, Math.min(mapMaxY, p.logicalY))

      // Sync player step coords so reboard/disembark checks work
      p.targetX = p.logicalX
      p.targetY = p.logicalY
      p.startX  = p.logicalX
      p.startY  = p.logicalY
    }"""

if old2 in txt:
    txt = txt.replace(old2, new2, 1)
    print('[boatSystem.js] patched: momentum movement system')
else:
    print('[boatSystem.js] WARNING: speed/drift block not found', file=sys.stderr)

# Reset velocity on deactivate
old3 = """    this._deactivatedAt = Date.now()"""
new3 = """    this._deactivatedAt = Date.now()
    this._vx = 0
    this._vy = 0"""

if old3 in txt:
    txt = txt.replace(old3, new3, 1)
    print('[boatSystem.js] patched: velocity reset on deactivate')
else:
    print('[boatSystem.js] WARNING: deactivate timestamp not found', file=sys.stderr)

BOAT.write_text(txt)

print('\nDone.')

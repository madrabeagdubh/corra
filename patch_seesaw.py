#!/usr/bin/env python3
"""
Run from ~/Corra:
  python3 ~/Downloads/patch_seesaw.py
"""
import sys
from pathlib import Path

PGR = Path('js/game/effects/perspectiveGroundRenderer.js')
txt = PGR.read_text()

old = """    // Bob: idle sine wave + speed-based chop
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

new = """    // ── Boat instability system ──────────────────────────────────────────────
    if (this._boatActive) {
      // _wobblePhase drives the see-saw oscillation
      // Frequency and amplitude both scale with speed
      const wobbleFreq = 1.8 + boatSpd * 0.04   // faster rocking at speed
      this._wobblePhase = ((this._wobblePhase ?? 0) + wobbleFreq * 0.016) % (Math.PI * 2)

      // Target amplitude: big when moving, tiny when still
      const targetAmp = boatSpd > 8
        ? 0.04 + Math.min(boatSpd / 120, 0.10)   // up to ~0.14 rad at full speed
        : 0.012                                    // gentle idle
      // Smooth amplitude transitions
      this._wobbleAmp = this._wobbleAmp ?? 0.012
      this._wobbleAmp += (targetAmp - this._wobbleAmp) * 0.04
    } else {
      this._wobblePhase = 0
      this._wobbleAmp   = 0
    }

    const wobbleRoll = this._boatActive
      ? Math.sin(this._wobblePhase) * (this._wobbleAmp ?? 0)
      : 0

    // Bob: follows wobble phase offset by 90deg (roll and bob in sync)
    const idleBob = this._boatActive
      ? Math.sin((this._wobblePhase ?? 0) + Math.PI * 0.5) * scaledTileW * (this._wobbleAmp ?? 0) * 0.8
      : 0

    // Velocity-driven lean: tip into the direction of travel
    const velTiltX  = this._boatActive ? boatVX * 0.00025 : 0
    const velTiltY  = this._boatActive ? boatVY * 0.00018 : 0

    // Acceleration tilt: boat tips back on surge
    const prevVX    = this._prevBoatVX ?? boatVX
    const accelX    = boatVX - prevVX
    this._prevBoatVX = boatVX
    const accelTilt = this._boatActive ? -accelX * 0.005 : 0

    const idleRock  = wobbleRoll   // wobble IS the rock now
    const chopAmt   = 0            // absorbed into wobble bob

    const totalBob  = rowBob + idleBob
    const totalLean = rowLean + wobbleRoll + velTiltX + accelTilt"""

if old in txt:
    txt = txt.replace(old, new, 1)
    print('[PGR] patched: see-saw wobble system')
else:
    print('[PGR] WARNING: bob/rock block not found', file=sys.stderr)

PGR.write_text(txt)
print('\nDone.')

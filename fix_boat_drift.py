#!/usr/bin/env python3
# fix_boat_drift.py
# Run from ~/Corra: python3 fix_boat_drift.py

import re

# ── Fix 1: boatSystem.js -- store world coords for drift, not screen coords ──

f1 = 'js/game/systems/boatSystem.js'
s1 = open(f1).read()

old1 = """      pgr._boatDrifting = !onShore
      // Capture screen position before boatActive is cleared
      pgr._boatDriftStartX = pgr._boatLastScreenX ?? pgr._boatScreenX ?? (pgr._sw / 2)
      pgr._boatDriftStartY = pgr._boatLastScreenY ?? pgr._boatScreenY ?? (pgr._sh / 2)
      pgr._boatDriftT = 0
      pgr._boatDriftSpeed = 28
      // Deactivate player-attached rendering -- boat drifts independently
      pgr.setBoatActive(false)
      // Boat drifts indefinitely, no fade -- recoverable later"""

new1 = """      pgr._boatDrifting = !onShore
      // Store world (logical pixel) coords for drift -- NOT screen coords
      // Screen coords shift with camera; world coords are stable
      pgr._boatWorldX = (p?.logicalX ?? 0)
      pgr._boatWorldY = (p?.logicalY ?? 0)
      pgr._boatDriftSpeed = 18   // logical pixels per second, matches current speed
      pgr._boatDriftT = 0
      // Deactivate player-attached rendering -- boat drifts independently
      pgr.setBoatActive(false)
      // Boat drifts indefinitely, no fade -- recoverable later"""

if old1 in s1:
    s1 = s1.replace(old1, new1)
    open(f1, 'w').write(s1)
    print('boatSystem.js: done')
else:
    print('boatSystem.js: NO MATCH')

# ── Fix 2: perspectiveGroundRenderer.js -- project world coords to screen ──

f2 = 'js/game/effects/perspectiveGroundRenderer.js'
s2 = open(f2).read()

old2 = """      if (this._boatDrifting) {
        this._boatDriftT = (this._boatDriftT ?? 0) + 0.012
        const driftX = (this._boatDriftStartX ?? screenX) + this._boatDriftT * (this._boatDriftSpeed ?? 28)
        const driftY = (this._boatDriftStartY ?? screenY)
        const alpha  = 1.0
        const bc     = this._boatCanvas
        const boatW  = Math.round(scaledTileW * 1.6 * ps)
        const boatH  = Math.round(boatW * (bc.height / bc.width))
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.drawImage(bc, Math.round(driftX - boatW / 2), Math.round(driftY - H * 0.55), boatW, boatH)
        ctx.restore()"""

new2 = """      if (this._boatDrifting) {
        // Advance world position eastward at drift speed
        const driftPxPerFrame = (this._boatDriftSpeed ?? 18) / 60
        this._boatWorldX = (this._boatWorldX ?? screenX) + driftPxPerFrame

        // Project world position to screen each frame -- camera-stable
        const driftProj = this._projectLogical(this._boatWorldX, this._boatWorldY ?? screenY, true)
        if (!driftProj) return   // off screen, skip draw

        const driftScreenX = driftProj.screenX
        const driftScreenY = driftProj.screenY
        // Use drift projection scale for boat size -- stays perspective-correct
        const driftScale   = driftProj.scale * this.tileDisplaySize
        const bc    = this._boatCanvas
        const boatW = Math.round(driftScale * 1.6 * ps)
        const boatH = Math.round(boatW * (bc.height / bc.width))
        ctx.save()
        ctx.globalAlpha = 1.0
        ctx.drawImage(bc, Math.round(driftScreenX - boatW / 2), Math.round(driftScreenY - boatH * 0.8), boatW, boatH)
        ctx.restore()"""

if old2 in s2:
    s2 = s2.replace(old2, new2)
    open(f2, 'w').write(s2)
    print('perspectiveGroundRenderer.js: done')
else:
    print('perspectiveGroundRenderer.js: NO MATCH')

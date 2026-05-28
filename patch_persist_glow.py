#!/usr/bin/env python3
"""
Run from ~/Corra:
  python3 ~/Downloads/patch_persist_glow.py

Fixes:
  1. bogLocationScene._doDisembark -- saves correct boat tile to GameState
  2. joystick.js -- adds drawBadgeGlow() method (cyan pulse for disembark prompt)
  3. baseLocationScene.update() -- pulses badge glow when disembark badge active
"""
import sys
from pathlib import Path

# ── 1. Save correct boat tile coords in _doDisembark ─────────────────────────
BOG = Path('js/game/scenes/locations/bog/bogLocationScene.js')
txt = BOG.read_text()

old = """    // Override boat world position to the reed tile where the hull actually is
    const pgr2 = this.perspectiveGround
    if (pgr2) {
      pgr2._boatWorldX   = boatLX
      pgr2._boatWorldY   = boatLY
      pgr2._boatDrifting = true    // keeps draw condition true
      pgr2._boatDriftSpeed = 0     // moored in reeds -- no movement
    }"""

new = """    // Override boat world position to the reed tile where the hull actually is
    const pgr2 = this.perspectiveGround
    if (pgr2) {
      pgr2._boatWorldX   = boatLX
      pgr2._boatWorldY   = boatLY
      pgr2._boatDrifting = true    // keeps draw condition true
      pgr2._boatDriftSpeed = 0     // moored in reeds -- no movement
    }

    // Save correct boat tile (reed position) to GameState for map re-entry
    const _mapKey = this.getMapKey?.() ?? this.scene.key
    const _btx = Math.floor(boatLX / ts)
    const _bty = Math.floor(boatLY / ts)
    GameState.setBoatPosition(_mapKey, _btx, _bty)
    console.log(`[disembark] boat saved at [${_btx},${_bty}] on ${_mapKey}`)"""

if old in txt:
    txt = txt.replace(old, new, 1)
    print('[bogLocationScene.js] patched: boat tile saved to GameState')
else:
    print('[bogLocationScene.js] WARNING: pgr2 block not found', file=sys.stderr)

# Ensure GameState is imported in bogLocationScene
if "import { GameState }" not in txt:
    txt = txt.replace(
        "import { GameState } from '../../../systems/gameState.js'",
        "import { GameState } from '../../../systems/gameState.js'"
    )
    # Check if it already exists under a different path
    if "GameState" not in txt:
        txt = "import { GameState } from '../../../systems/gameState.js'\n" + txt
        print('[bogLocationScene.js] added GameState import')

BOG.write_text(txt)

# ── 2. joystick.js -- add drawBadgeGlow() ────────────────────────────────────
JOY = Path('js/game/input/joystick.js')
txt = JOY.read_text()

old = """  getMoonCanvas() { return this._moonCanvas }"""

new = """  // Pulsing cyan ring shown when a badge prompt is active (e.g. disembark)
  // Call with progress=1 to show, progress=0 to hide.
  // Animates a slow breathing pulse when shown.
  drawBadgeGlow(progress) {
    const ctx = this._glowCtx
    const R   = this.radius
    if (!ctx) return
    ctx.clearRect(0, 0, R * 2, R * 2)
    if (progress <= 0) {
      this._glowCanvas.style.opacity = '0'
      return
    }
    this._glowCanvas.style.opacity = '1'
    const outerR = R * 0.98
    const pulse  = 0.55 + 0.45 * Math.sin(Date.now() * 0.004)  // breathing 0.1-1.0
    const grad   = ctx.createRadialGradient(R, R, outerR * 0.6, R, R, outerR)
    grad.addColorStop(0,   'rgba(0,220,255,0)')
    grad.addColorStop(0.5, `rgba(0,200,255,${(pulse * 0.25).toFixed(3)})`)
    grad.addColorStop(0.85,`rgba(0,230,255,${(pulse * 0.55).toFixed(3)})`)
    grad.addColorStop(1,   `rgba(100,245,255,${(pulse * 0.75).toFixed(3)})`)
    ctx.beginPath()
    ctx.arc(R, R, outerR, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
    // Bright cyan ring
    ctx.beginPath()
    ctx.arc(R, R, outerR * 0.97, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(0,240,255,${(pulse * 0.9).toFixed(3)})`
    ctx.lineWidth = 2.5
    ctx.stroke()
  }

  getMoonCanvas() { return this._moonCanvas }"""

if old in txt:
    txt = txt.replace(old, new, 1)
    print('[joystick.js] patched: drawBadgeGlow() added')
else:
    print('[joystick.js] WARNING: getMoonCanvas not found', file=sys.stderr)

JOY.write_text(txt)

# ── 3. baseLocationScene.update() -- drive the badge glow each frame ─────────
BASE = Path('js/game/scenes/locations/baseLocationScene.js')
txt = BASE.read_text()

old = """        const _onLand = !_isPassable(_gid) || _neighbours.some(g => !_isPassable(g))
        if (_onLand && !this.player.isMoving) {
          if (!this._disembarkBadgeShown) {
            this._disembarkBadgeShown = true
            this._encounterPanel?.notify(
              { id: 'disembark', visual: { gid: 1625, flat: true },
                ga: 'Téigh i dtír', en: 'Go ashore' },
              null
            )
          }
        } else {
          if (this._disembarkBadgeShown) {
            this._disembarkBadgeShown = false
            this._encounterPanel?.clearNotify()
          }
        }"""

new = """        const _onLand = !_isPassable(_gid) || _neighbours.some(g => !_isPassable(g))
        if (_onLand && !this.player.isMoving) {
          if (!this._disembarkBadgeShown) {
            this._disembarkBadgeShown = true
            this._encounterPanel?.notify(
              { id: 'disembark', visual: { gid: 1625, flat: true },
                ga: 'Téigh i dtír', en: 'Go ashore' },
              null
            )
          }
          // Pulse cyan glow on joystick ring to draw attention to badge
          this.joystick?.drawBadgeGlow?.(1)
        } else {
          if (this._disembarkBadgeShown) {
            this._disembarkBadgeShown = false
            this._encounterPanel?.clearNotify()
            this.joystick?.drawBadgeGlow?.(0)
          }
        }"""

if old in txt:
    txt = txt.replace(old, new, 1)
    print('[baseLocationScene.js] patched: badge glow driven each frame')
else:
    print('[baseLocationScene.js] WARNING: _onLand block not found', file=sys.stderr)

BASE.write_text(txt)
print('\nDone.')

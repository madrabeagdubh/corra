#!/usr/bin/env python3
"""
Run from ~/Corra:
  python3 ~/Downloads/patch_ripples.py
"""
import sys
from pathlib import Path

BOAT = Path('js/game/systems/boatSystem.js')
txt = BOAT.read_text()

# ── Add ripple methods before destroy() ──────────────────────────────────────
old = """  destroy() {
    this.deactivate()
    console.log('[BoatSystem] destroyed')
  }"""

new = """  // ── Ripples ───────────────────────────────────────────────────────────────

  _startRipples() {
    if (this._rippleInterval) return
    this._rippleInterval = setInterval(() => this._spawnRipple(), 120)
  }

  _stopRipples() {
    if (this._rippleInterval) {
      clearInterval(this._rippleInterval)
      this._rippleInterval = null
    }
  }

  _spawnRipple() {
    const p   = this.scene.player
    const pgr = this.scene.perspectiveGround
    if (!p || !pgr) return

    const spd = Math.hypot(this._vx ?? 0, this._vy ?? 0)
    if (spd < 8) return   // no ripples when nearly still

    // Spawn behind the boat -- opposite to velocity direction
    const normX = spd > 0 ? (this._vx ?? 0) / spd : 0
    const normY = spd > 0 ? (this._vy ?? 0) / spd : 0
    const ts    = this.scene.tileSize

    // Offset behind boat in logical space, with slight random spread
    const spread = 6
    const ox = -normX * ts * 0.4 + (Math.random() - 0.5) * spread
    const oy = -normY * ts * 0.4 + (Math.random() - 0.5) * spread

    const proj = pgr._projectLogical(p.logicalX + ox, p.logicalY + oy, true)
    if (!proj) return

    // Size scales with speed
    const size  = 4 + Math.min(spd / 20, 3) + Math.random() * 3
    const alpha = 0.5 + Math.min(spd / 120, 0.4)

    const el = document.createElement('div')
    el.style.cssText = [
      'position:fixed',
      `left:${proj.screenX - size}px`,
      `top:${proj.screenY - size * 0.35}px`,
      `width:${size * 2}px`,
      `height:${size * 0.7}px`,
      'border-radius:50%',
      `border:1.5px solid rgba(140,210,255,${alpha.toFixed(2)})`,
      'background:transparent',
      'pointer-events:none',
      'z-index:9',
      'transition:transform 0.7s ease-out, opacity 0.7s ease-out',
    ].join(';')
    document.body.appendChild(el)

    // Expand outward and fade
    setTimeout(() => {
      el.style.transform = `scale(${1.8 + Math.random() * 0.8})`
      el.style.opacity = '0'
    }, 20)
    setTimeout(() => el.remove(), 800)
  }

  destroy() {
    this._stopRipples()
    this.deactivate()
    console.log('[BoatSystem] destroyed')
  }"""

if old in txt:
    txt = txt.replace(old, new, 1)
    print('[boatSystem.js] patched: ripple methods added')
else:
    print('[boatSystem.js] WARNING: destroy() not found', file=sys.stderr)

# ── Start/stop ripples with boat activation ───────────────────────────────────
old2 = """    console.log('[BoatSystem] activated -- player in boat')"""
new2 = """    this._startRipples()
    console.log('[BoatSystem] activated -- player in boat')"""

if old2 in txt:
    txt = txt.replace(old2, new2, 1)
    print('[boatSystem.js] patched: ripples start on activate')
else:
    print('[boatSystem.js] WARNING: activate log not found', file=sys.stderr)

old3 = """    console.log('[BoatSystem] deactivated -- player disembarked')"""
new3 = """    this._stopRipples()
    console.log('[BoatSystem] deactivated -- player disembarked')"""

if old3 in txt:
    txt = txt.replace(old3, new3, 1)
    print('[boatSystem.js] patched: ripples stop on deactivate')
else:
    print('[boatSystem.js] WARNING: deactivate log not found', file=sys.stderr)

BOAT.write_text(txt)
print('\nDone.')

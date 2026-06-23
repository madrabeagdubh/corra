#!/usr/bin/env python3
# tavern_hearth_flame.py
# Run from anywhere:  python3 tavern_hearth_flame.py
#
#  1. tavern.js  -- animated hearth fire: rising flame particles + drifting
#     embers + a breathing amber glow that spills onto the floor. Drawn on the
#     PGR canvas via onPGRDrawComplete (behind the NPCs) and locked to the
#     hearth each frame through pgr._projectLogical, so it tracks the camera.
#  2. b0.js      -- defensively strip the tavern's interior overlay
#     (#pgr-ceiling / #pgr-blackmask) when the village exterior loads, so a
#     missed teardown on exit can't leave the outside dark.

import os, sys

def find_root():
    for c in (os.getcwd(), os.path.expanduser("~/Corra")):
        if os.path.exists(os.path.join(c, "js/game/scenes/locations/village/tavern.js")):
            return c
    return None

ROOT = find_root()
if not ROOT:
    print("XX  run from the Corra root."); sys.exit(1)

# ──────────────────────────────────────────────────────────────────────────
# 1. tavern.js  -- hearth flame
# ──────────────────────────────────────────────────────────────────────────
TJ = os.path.join(ROOT, "js/game/scenes/locations/village/tavern.js")
s = open(TJ, encoding="utf-8").read()

FLAME = r'''  // ── Hearth flame ─────────────────────────────────────────────────────────
  // Animated fire for the back-wall hearth: rising flame particles, a few
  // drifting embers, and a breathing amber glow that spills onto the floor.
  // Drawn straight onto the PGR canvas via onPGRDrawComplete -- chained in
  // FRONT of the NPC draw so the flame renders first (behind the NPCs, which is
  // correct for a back-wall hearth) -- and positioned every frame through
  // pgr._projectLogical so it stays locked to the hearth as the camera follows
  // the player. Tune via HEARTH_FLAME.
  static HEARTH_FLAME = {
    ROW_OFFSET:  1.6,   // tiles below the hearth building's y to the firebox
    GLOW_RADIUS: 230,   // glow radius in px at scale 1
    PARTICLES:   26,    // flame + ember population
  }

  createNPCs() {
    super.createNPCs()
    const prev = this.onPGRDrawComplete   // the NPC draw set by VillageScene
    this.onPGRDrawComplete = (ctx) => { this._drawHearthFlame(ctx); if (prev) prev(ctx) }
  }

  _ensureHearthAnchor() {
    if (this._hearthAnchor !== undefined) return this._hearthAnchor
    const b = (this.mapData?.buildings || []).find(x => x.id === 'hearth')
    if (!b) { this._hearthAnchor = null; return null }
    const F = TavernScene.HEARTH_FLAME
    this._hearthAnchor = {
      x: (b.x + (b.fw ?? 2) / 2) * this.tileSize,   // horizontal centre of the hearth
      y: (b.y + F.ROW_OFFSET) * this.tileSize,       // down into the firebox
    }
    return this._hearthAnchor
  }

  _drawHearthFlame(ctx) {
    const pgr = this.perspectiveGround
    if (!pgr || !pgr._projectLogical) return
    const anchor = this._ensureHearthAnchor()
    if (!anchor) return
    const proj = pgr._projectLogical(anchor.x, anchor.y)
    if (!proj) return
    const { screenX, screenY, scale } = proj
    const F = TavernScene.HEARTH_FLAME
    const now = performance.now()
    const dt = Math.min(now - (this._flameLastT || now), 64)
    this._flameLastT = now
    const unit = scale * pgr.tileDisplaySize     // on-screen px per tile at this depth
    if (!this._flameParticles) this._flameParticles = []
    const parts = this._flameParticles
    while (parts.length < F.PARTICLES) {
      const ember = Math.random() < 0.16
      parts.push({
        ox: (Math.random() - 0.5) * 0.30, oy: 0,
        vx: (Math.random() - 0.5) * 0.00020,
        vy: -(0.00075 + Math.random() * 0.00065) * (ember ? 0.6 : 1),
        life: 0, max: ember ? 1500 + Math.random() * 900 : 420 + Math.random() * 520,
        ember, seed: Math.random() * 6.28,
      })
    }
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    // Breathing glow.
    const flick = 0.78 + 0.14 * Math.sin(now * 0.013) + 0.08 * Math.sin(now * 0.041 + 1.3)
    const R = F.GLOW_RADIUS * scale * flick
    if (R > 1) {
      const g = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, R)
      g.addColorStop(0,    `rgba(255,180,90,${(0.30 * flick).toFixed(3)})`)
      g.addColorStop(0.45, `rgba(255,120,45,${(0.14 * flick).toFixed(3)})`)
      g.addColorStop(1,    'rgba(255,90,25,0)')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(screenX, screenY, R, 0, Math.PI * 2); ctx.fill()
    }
    // Particles: recycled in place to keep a constant population.
    for (const p of parts) {
      p.life += dt; p.ox += p.vx * dt; p.oy += p.vy * dt; p.vx *= 0.98
      if (p.life >= p.max) {
        p.life = 0; p.oy = 0; p.ox = (Math.random() - 0.5) * 0.30
        p.vy = -(0.00075 + Math.random() * 0.00065); continue
      }
      const t = p.life / p.max
      const px = screenX + p.ox * unit + Math.sin(now * 0.006 + p.seed) * unit * 0.04
      const py = screenY + p.oy * unit
      const fade = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85
      const a = Math.max(0, fade) * (p.ember ? 0.5 : 0.85)
      if (a < 0.02) continue
      let r, gg, b
      if (t < 0.4) { r = 255; gg = Math.round(220 - t * 180); b = Math.round(120 - t * 200) }
      else { r = Math.round(255 - (t - 0.4) * 110); gg = Math.round(110 - (t - 0.4) * 120); b = 30 }
      const size = (p.ember ? 0.05 : 0.12 * (1 - t * 0.6)) * unit
      if (size < 0.4) continue
      ctx.fillStyle = `rgba(${r},${Math.max(0, gg)},${Math.max(0, b)},${a.toFixed(3)})`
      ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }

'''

if "_drawHearthFlame" in s:
    print("OK  tavern.js already has the hearth flame -- skipping.")
else:
    anchor = "  onEnter() {"
    if anchor in s:
        s = s.replace(anchor, FLAME + anchor, 1)
        open(TJ, "w", encoding="utf-8").write(s)
        print("OK  tavern.js: hearth flame added (createNPCs wrap + _drawHearthFlame)")
    else:
        print("XX  tavern.js: couldn't find 'onEnter() {' anchor -- not saved.")
        print("    Paste tavern.js and I'll recut."); sys.exit(1)

# ──────────────────────────────────────────────────────────────────────────
# 2. b0.js  -- strip leftover tavern overlay on village load
# ──────────────────────────────────────────────────────────────────────────
BJ = os.path.join(ROOT, "js/game/scenes/locations/bog/b0.js")
b = open(BJ, encoding="utf-8").read()

if "pgr-ceiling" in b:
    print("OK  b0.js already strips the tavern overlay -- skipping.")
else:
    anchor = "  constructor() { super({ key: 'b0' }) }"
    add = anchor + r'''

  // Defensive: the tavern's interior overlay (#pgr-ceiling gradient +
  // #pgr-blackmask) is raw DOM that the tavern is meant to tear down on exit.
  // If that teardown is missed on the door-exit path it would leave the village
  // dark, so strip any leftovers here -- the exterior never creates them itself.
  create() {
    super.create()
    document.getElementById('pgr-ceiling')?.remove()
    document.getElementById('pgr-blackmask')?.remove()
    const c = this.game?.canvas?.parentNode
    if (c) c.style.background = ''
  }'''
    if anchor in b:
        b = b.replace(anchor, add, 1)
        open(BJ, "w", encoding="utf-8").write(b)
        print("OK  b0.js: clears tavern overlay leftovers on load")
    else:
        print("XX  b0.js: couldn't find the constructor anchor -- not saved.")
        print("    Paste b0.js and I'll recut."); sys.exit(1)

print("\nDone. Reload, step near the hearth: you should see flames + embers and a")
print("warm glow on the floor that tracks as you walk. Exit to the village: it")
print("should no longer be left dark. Tune flames via HEARTH_FLAME in tavern.js")
print("(ROW_OFFSET to sit the fire in the hearth mouth, GLOW_RADIUS, PARTICLES).")

path = '/data/data/com.termux/files/home/Corra/js/game/effects/waveRenderer.js'
with open(path, 'r') as f:
    content = f.read()

changes = 0

# Replace _spawnDiveBurst, _spawnFountain, _spawnBottomSpray, _updateSpray, _drawSpray
# with a clean returnCrossing-style system

import re
old = re.search(r'  // ── Dive burst spray.*?  // ── Manannan Mac Lir', content, re.DOTALL)
if not old:
    print('ERROR: could not find spray section')
else:
    new_section = '''  // ── Spray system ────────────────────────────────────────────────────────
  // All positions in screen pixels. Velocities in px/ms. Gravity in px/ms^2.
  // Matches returnCrossing.js splash approach.

  _spawnDiveBurst(h) {
    const pgr     = this.pgr
    const ts      = pgr.tileDisplaySize
    const tileX   = h.worldX / ts
    const tileY   = h.worldY / ts
    const screenY = pgr._rowToScreenY(tileY + 1)
    if (!screenY || !isFinite(screenY)) return
    const scaledW = pgr._scaleAtRow(tileY + 1)
    if (!scaledW || !isFinite(scaledW)) return
    const screenX = pgr._colToScreenX(tileX + 0.5, tileY)
    if (!isFinite(screenX)) return

    const localI = this._localIntensity(h.worldX)
    if (localI < 0.05) return

    const sw = this.pgr._sw || 400
    const sh = this.pgr._sh || 700

    const count    = Math.floor(12 + localI * 30)
    const speed    = scaledW * 0.004 * (0.8 + localI * 1.2)   // px/ms

    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 1.6
      const angle  = -Math.PI / 2 + spread - 0.2
      const spd    = speed * (0.5 + Math.random() * 0.8)
      this._spray.push({
        x:      screenX + (Math.random() - 0.5) * scaledW * 1.2,
        y:      screenY,
        vx:     Math.cos(angle) * spd,
        vy:     Math.sin(angle) * spd,
        life:   0,
        maxLife: 800 + Math.random() * 1000 * localI,
        r:      Math.max(1.5, scaledW * (0.03 + Math.random() * 0.06)),
        bright: 215 + Math.floor(Math.random() * 40),
        floor:  screenY,   // falls back to waterline
      })
    }
    if (this._spray.length > 500) this._spray.splice(0, 60)
  }

  _spawnFountain() {
    const pgr = this.pgr
    const ts  = pgr.tileDisplaySize
    const activeCount = Math.min(WaveRenderer.HORSE_COUNT,
      Math.floor(Math.max(0, this.intensity + 0.15) * WaveRenderer.HORSE_COUNT))
    if (activeCount === 0) return
    const idx = Math.floor(Math.random() * activeCount)
    const h   = this._horses[idx]
    if (!h || h.worldX === undefined) return

    const tileX   = h.worldX / ts
    const tileY   = h.worldY / ts
    const screenY = pgr._rowToScreenY(tileY + 1)
    if (!screenY || !isFinite(screenY)) return
    const scaledW = pgr._scaleAtRow(tileY + 1)
    if (!scaledW || !isFinite(scaledW)) return
    const screenX = pgr._colToScreenX(tileX + 0.5, tileY)
    if (!isFinite(screenX)) return

    const localI = this._localIntensity(h.worldX)
    if (localI < 0.08) return

    const count = Math.floor(4 + localI * 18)
    const speed = scaledW * 0.003 * (0.6 + localI * 1.0)

    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2
      const spd   = speed * (0.4 + Math.random() * 0.8)
      this._spray.push({
        x: screenX + (Math.random() - 0.5) * scaledW,
        y: screenY,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 0, maxLife: 400 + Math.random() * 600 * localI,
        r: Math.max(1, scaledW * (0.02 + Math.random() * 0.05)),
        bright: 215 + Math.floor(Math.random() * 40),
        floor: screenY,
      })
    }
    if (this._spray.length > 500) this._spray.splice(0, 60)
  }

  _spawnBottomSpray() {
    const sw = this.pgr._sw
    const sh = this.pgr._sh
    if (!isFinite(sw) || !isFinite(sh) || sw < 10 || sh < 10) return

    const localI   = this.intensity
    const count    = Math.floor(6 + localI * 20)
    const clusterX = sw * (0.05 + Math.random() * 0.90)
    // Speed in px/ms — needs to reach ~30% up screen in ~400ms
    const speed    = sh * 0.0012 * (0.8 + localI * 1.0)

    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.9
      const spd   = speed * (0.6 + Math.random() * 0.8)
      this._spray.push({
        x: clusterX + (Math.random() - 0.5) * sw * 0.05,
        y: sh + 5,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 0, maxLife: 500 + Math.random() * 600 * localI,
        r: Math.max(2, sw * (0.003 + Math.random() * 0.005)),
        bright: 210 + Math.floor(Math.random() * 45),
        floor: null,   // fades by life only — no floor clip
      })
    }
    if (this._spray.length > 500) this._spray.splice(0, 60)
  }

  _updateSpray(dt) {
    // dt in ms. gravity in px/ms^2 — same scale as returnCrossing (0.0000018 * dt^2 equiv)
    const gravity = 0.0000018 * dt
    for (let i = this._spray.length - 1; i >= 0; i--) {
      const s = this._spray[i]
      s.x    += s.vx * dt
      s.y    += s.vy * dt
      s.vy   += gravity * dt   // accumulate velocity
      s.life += dt
      if (s.life >= s.maxLife || (s.floor !== null && s.floor !== undefined && s.y > s.floor + 4)) {
        this._spray.splice(i, 1)
      }
    }
  }

  _drawSpray(ctx) {
    const sw = this._canvas?.width  || 400
    const sh = this._canvas?.height || 700
    for (const s of this._spray) {
      if (!isFinite(s.x) || !isFinite(s.y) || !isFinite(s.r)) continue
      if (s.x < -20 || s.x > sw + 20 || s.y < -sh * 0.5 || s.y > sh + 20) continue
      const lifeT = s.life / s.maxLife
      const alpha = lifeT < 0.12 ? lifeT / 0.12 : 1 - Math.pow(lifeT, 1.6)
      if (alpha < 0.01) continue
      ctx.save()
      ctx.globalAlpha = alpha * 0.80
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      const bright = s.bright ?? 225
      ctx.fillStyle = `rgb(${bright},${bright},${Math.min(255, bright + 12)})`
      ctx.fill()
      ctx.restore()
    }
  }

  // ── Manannan Mac Lir'''

    content = content[:old.start()] + new_section + content[old.end() - len('  // ── Manannan Mac Lir'):]
    changes += 1
    print('spray system rewritten')

with open(path, 'w') as f:
    f.write(content)
print(f'done — {changes} changes')

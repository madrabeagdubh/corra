path = '/data/data/com.termux/files/home/Corra/js/game/effects/waveRenderer.js'
with open(path, 'r') as f:
    content = f.read()

changes = 0

# 1. Fix gravity — it's using dt in seconds but spray update gets delta in ms
# gravity = 0.0000018 * dt where dt is ms (~16) = 0.0000288 per frame
# That's way too small. Use 0.00018 * dt for proper arc
old = '    // dt in ms. gravity in px/ms^2 — same scale as returnCrossing (0.0000018 * dt^2 equiv)\n    const gravity = 0.0000018 * dt\n    for (let i = this._spray.length - 1; i >= 0; i--) {\n      const s = this._spray[i]\n      s.x    += s.vx * dt\n      s.y    += s.vy * dt\n      s.vy   += gravity * dt   // accumulate velocity'
new = '''    // dt in ms (~16ms/frame). vx/vy in px/ms. gravity accumulates vy.
    // gravity = 0.0014 px/ms per ms = ~1400px/s^2 (strong, visible arc)
    for (let i = this._spray.length - 1; i >= 0; i--) {
      const s = this._spray[i]
      const grav = s.gravity ?? 0.0014
      s.x    += s.vx * dt
      s.y    += s.vy * dt
      s.vy   += grav * dt   // accumulate downward velocity'''
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('gravity fixed')
else:
    print('WARN: gravity not found')

# 2. Fix dive burst — stronger upward velocity, proper px/ms scale
old = '''    const count    = Math.floor(12 + localI * 30)
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
    }'''
new = '''    // Speed scales with local intensity — eastern horses throw bigger bursts
    const count    = Math.floor(8 + localI * 28)
    const speed    = scaledW * 0.12 * (0.6 + localI * 1.4)   // px/ms — fast enough to arc

    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 1.8
      const angle  = -Math.PI / 2 + spread - 0.15
      const spd    = speed * (0.4 + Math.random() * 0.9)
      this._spray.push({
        x:       screenX + (Math.random() - 0.5) * scaledW * 1.4,
        y:       screenY,
        vx:      Math.cos(angle) * spd,
        vy:      Math.sin(angle) * spd,
        life:    0,
        maxLife: 600 + Math.random() * 800 * localI,
        r:       Math.max(1.5, scaledW * (0.025 + Math.random() * 0.07)),
        bright:  215 + Math.floor(Math.random() * 40),
        floor:   screenY,
        gravity: 0.0016,   // strong arc
      })
    }'''
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('dive burst velocity fixed')
else:
    print('WARN: dive burst not found')

# 3. Fix bottom spray — randomized clusters, varied angles, less frequent
old = '''  _spawnBottomSpray() {
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
  }'''
new = '''  _spawnBottomSpray() {
    const sw = this.pgr._sw
    const sh = this.pgr._sh
    if (!isFinite(sw) || !isFinite(sh) || sw < 10 || sh < 10) return

    const localI = this.intensity
    if (localI < 0.1) return

    // Randomise: sometimes one big cluster, sometimes scattered smaller ones
    const roll = Math.random()
    const numClusters = roll < 0.4 ? 1 : roll < 0.7 ? 2 : 3

    for (let c = 0; c < numClusters; c++) {
      const clusterX = sw * (0.05 + Math.random() * 0.88)
      // Varied count per cluster
      const count    = Math.floor(3 + localI * (8 + Math.random() * 12))
      // Speed varies — some clusters are violent, some gentle
      const speedMult = 0.4 + Math.random() * 0.8
      const speed     = sh * 0.10 * speedMult * (0.6 + localI * 0.8)
      // Angle bias — mostly upward but lean left or right randomly
      const angleBias = (Math.random() - 0.5) * 0.8

      for (let i = 0; i < count; i++) {
        const spread = (Math.random() - 0.5) * 1.2
        const angle  = -Math.PI / 2 + angleBias + spread
        const spd    = speed * (0.5 + Math.random() * 0.8)
        // Vary particle size — mix of large foam chunks and fine mist
        const sizeFrac = Math.random()
        const r = sizeFrac < 0.2
          ? Math.max(4, sw * (0.008 + Math.random() * 0.008))   // large chunk
          : Math.max(1.5, sw * (0.002 + Math.random() * 0.004)) // fine mist
        this._spray.push({
          x:       clusterX + (Math.random() - 0.5) * sw * 0.04,
          y:       sh + 5 + Math.random() * 10,
          vx:      Math.cos(angle) * spd,
          vy:      Math.sin(angle) * spd,
          life:    0,
          maxLife: 400 + Math.random() * 700 * localI,
          r,
          bright:  205 + Math.floor(Math.random() * 50),
          floor:   null,
          gravity: 0.0010 + Math.random() * 0.0008,  // varied gravity
        })
      }
    }
    if (this._spray.length > 500) this._spray.splice(0, 60)
  }'''
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('bottom spray reworked')
else:
    print('WARN: bottom spray not found')

# 4. Make bottom spray less frequent — longer interval, more randomised
old = '    const bottomInterval = Math.max(200, 1500 - this.intensity * 1200)'
new = '    const bottomInterval = Math.max(800, 3000 - this.intensity * 2000) + Math.random() * 1000'
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('bottom spray interval increased')
else:
    print('WARN: bottomInterval not found')

with open(path, 'w') as f:
    f.write(content)
print(f'done — {changes} changes')

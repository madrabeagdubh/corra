path = '/data/data/com.termux/files/home/Corra/js/game/effects/waveRenderer.js'
with open(path, 'r') as f:
    content = f.read()

changes = 0

# 1. EPIC dive burst — enormous plumes, raining down everywhere
old = '''    // Speed scales with local intensity — eastern horses throw bigger bursts
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
new = '''    // EPIC plume — supernatural creatures diving face-first
    // Three layers: core column, wide scatter, fine mist
    const baseCount = Math.floor(25 + localI * 60)
    const baseSpeed = scaledW * 0.35 * (0.8 + localI * 1.6)

    for (let i = 0; i < baseCount; i++) {
      const layer = Math.random()
      let spread, spd, r, grav, maxLife

      if (layer < 0.25) {
        // Core column — shoots straight up very fast
        spread  = (Math.random() - 0.5) * 0.5
        spd     = baseSpeed * (1.2 + Math.random() * 0.8)
        r       = Math.max(3, scaledW * (0.06 + Math.random() * 0.08))
        grav    = 0.0010
        maxLife = 1200 + Math.random() * 600
      } else if (layer < 0.65) {
        // Wide scatter — fans out dramatically
        spread  = (Math.random() - 0.5) * 2.4
        spd     = baseSpeed * (0.6 + Math.random() * 1.0)
        r       = Math.max(2, scaledW * (0.03 + Math.random() * 0.06))
        grav    = 0.0014
        maxLife = 800 + Math.random() * 800 * localI
      } else {
        // Fine mist — drifts and rains down slowly
        spread  = (Math.random() - 0.5) * 3.0
        spd     = baseSpeed * (0.2 + Math.random() * 0.5)
        r       = Math.max(1, scaledW * (0.01 + Math.random() * 0.03))
        grav    = 0.0006
        maxLife = 1500 + Math.random() * 1000 * localI
      }

      const angle = -Math.PI / 2 + spread
      this._spray.push({
        x:       screenX + (Math.random() - 0.5) * scaledW * 2.5,
        y:       screenY - scaledW * 0.2,
        vx:      Math.cos(angle) * spd,
        vy:      Math.sin(angle) * spd,
        life:    0,
        maxLife,
        r,
        bright:  210 + Math.floor(Math.random() * 45),
        floor:   screenY + scaledW * 2,  // can rain well below waterline
        gravity: grav,
      })
    }'''
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('epic dive burst applied')
else:
    print('WARN: dive burst not found')

# 2. Fix bottom spray — was broken, restore it properly
old = '    const bottomInterval = Math.max(800, 3000 - this.intensity * 2000) + Math.random() * 1000'
new = '    const bottomInterval = Math.max(600, 2500 - this.intensity * 1800)'
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('bottom interval restored')
else:
    print('WARN: bottomInterval not found')

# 3. Spread horses out — use a wider, more uniform distribution
old = '''    for (let i = 0; i < WaveRenderer.HORSE_COUNT; i++) {
      const frac    = i / Math.max(1, WaveRenderer.HORSE_COUNT - 1)
      const tileX   = mapW * (0.42 + frac * 0.48) + Math.random() * 6
      const rowFrac = frac * frac
      const tileY   = 4 + rowFrac * (mapH - 10) + (Math.random() - 0.5) * 2'''
new = '''    for (let i = 0; i < WaveRenderer.HORSE_COUNT; i++) {
      const frac    = i / Math.max(1, WaveRenderer.HORSE_COUNT - 1)
      // Spread horses more evenly — use golden ratio to avoid clumping
      const goldenFrac = ((i * 0.618033) % 1.0)
      const tileX   = mapW * (0.30 + goldenFrac * 0.62) + (Math.random() - 0.5) * 4
      // Rows spread linearly not squared — more uniform vertical distribution
      const tileY   = 3 + frac * (mapH - 8) + (Math.random() - 0.5) * 3'''
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('horse spread fixed')
else:
    print('WARN: horse spread not found')

# 4. Also spread recycle positions using golden ratio
old = '''        h.worldX    = playerX + ts * (8 + Math.random() * 28)
        h.worldY    = (4 + Math.random() * (mapW * 0.4)) * ts'''
new = '''        // Spread recycle positions evenly across visible east band
        const _gfrac = Math.random()
        h.worldX    = playerX + ts * (6 + _gfrac * 32)
        h.worldY    = (3 + Math.random() * (mapH - 8)) * ts'''
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('recycle spread fixed')
else:
    print('WARN: recycle spread not found')

with open(path, 'w') as f:
    f.write(content)
print(f'done — {changes} changes')

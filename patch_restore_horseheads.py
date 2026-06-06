path = '/data/data/com.termux/files/home/Corra/js/game/effects/waveRenderer.js'
with open(path, 'r') as f:
    content = f.read()

changes = 0

# 1. Restore horse image loading
old = '''    // Single trefoil sprite — three horse heads, spins as it travels
    this._trefoilImg = new Image()
    this._trefoilImg.src = '/assets/3horses.png'
    // Keep old horseImgs array pointing to same sprite for compatibility
    this._horseImgs = [this._trefoilImg, this._trefoilImg, this._trefoilImg, this._trefoilImg]'''
new = '''    this._horseImgs = []
    for (let i = 1; i <= 4; i++) {
      const img = new Image()
      img.src = `/assets/horse${i}.png`
      this._horseImgs.push(img)
    }'''
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('image loading restored')
else:
    print('WARN: image loading not found')

# 2. Remove spinAngle/spinDir from horse factory, restore original heightMult
old = '''      horses.push({
        worldX:      tileX * ts,
        worldY:      tileY * ts,
        risePhase:   Math.random() * Math.PI * 2,
        prevSin:     0,
        riseFreq:    0.7 + Math.random() * 0.5,
        gallopMult:  0.9 + Math.random() * 0.4,
        heightMult:  1.3 + Math.random() * 0.5,   // slightly larger for trefoil
        spriteIndex: i % 4,
        spinAngle:   Math.random() * Math.PI * 2,  // trefoil spin
        spinDir:     -1,  // all counter-clockwise — horses lunging forward
      })'''
new = '''      horses.push({
        worldX:      tileX * ts,
        worldY:      tileY * ts,
        risePhase:   Math.random() * Math.PI * 2,
        prevSin:     0,
        riseFreq:    0.7 + Math.random() * 0.5,
        gallopMult:  0.9 + Math.random() * 0.4,
        heightMult:  1.1 + Math.random() * 0.4,
        spriteIndex: i % 4,
      })'''
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('factory restored')
else:
    print('WARN: factory not found')

# 3. Remove spin from update loop
old = '''      h.risePhase += h.riseFreq * dt * (1 + this.intensity * 0.6)
      const _prevX = h.worldX
      h.worldX    -= driftSpeed * dt
      // Spin driven by forward movement — one rotation per tile width
      // Counter-clockwise, so as it moves left the top head lunges forward
      const _dx = _prevX - h.worldX   // positive = moved west
      const _tileW = ts
      h.spinAngle = (h.spinAngle ?? 0) - (_dx / _tileW) * Math.PI * 2 * 0.08'''
new = '''      h.risePhase += h.riseFreq * dt * (1 + this.intensity * 0.6)
      h.worldX    -= driftSpeed * dt'''
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('spin removed from update')
else:
    print('WARN: spin update not found')

# 4. Restore _drawHorses with individual heads
old = content[content.find('  _drawHorses(ctx) {'):content.find('  _drawHorseProcedural(')]
new_drawhorses = '''  _drawHorses(ctx) {
    const pgr       = this.pgr
    const ts        = pgr.tileDisplaySize
    const horizonPx = pgr._horizonPx()
    const activeCount = Math.min(
      WaveRenderer.HORSE_COUNT,
      Math.floor(Math.max(0, this.intensity + 0.15) * WaveRenderer.HORSE_COUNT)
    )

    for (let i = 0; i < activeCount; i++) {
      const h = this._horses[i]
      if (!h) continue

      const tileX = h.worldX / ts
      const tileY = h.worldY / ts
      if (!isFinite(tileX) || !isFinite(tileY)) continue

      const screenY = pgr._rowToScreenY(tileY + 1)
      if (screenY === null || !isFinite(screenY) || screenY < horizonPx + 4) continue

      const scaledW = pgr._scaleAtRow(tileY + 1)
      if (!scaledW || !isFinite(scaledW)) continue

      const fullH = scaledW * h.heightMult * (0.7 + this.intensity * 0.5)
      if (!isFinite(fullH) || fullH < 1) continue

      const centerX = pgr._colToScreenX(tileX + 0.5, tileY)
      if (!isFinite(centerX)) continue

      const localI = this._localIntensity(h.worldX)

      // Dolphin curve — asymmetric rise/fall
      const { surfaceT, velT } = this._dolphinCurve(h.risePhase)
      const bobAmp    = scaledW * (0.05 + localI * 1.8)
      const cappedBob = Math.min(fullH * 0.85, surfaceT * bobAmp * localI)
      if (cappedBob < 0.5) continue

      // Lean: back on rise, nose-forward on dive
      const maxRotation = 0.22
      const rotation    = velT * surfaceT * maxRotation

      const spriteW = scaledW * 2.6
      const sx      = centerX - spriteW * 0.5
      const sy      = screenY - cappedBob
      if (!isFinite(sy)) continue

      ctx.save()
      ctx.globalAlpha = 1.0

      // Waterline clip
      ctx.beginPath()
      ctx.rect(-9999, horizonPx, 99999, screenY - horizonPx)
      ctx.clip()

      const img = this._horseImgs[h.spriteIndex]
      if (img?.complete && img.naturalWidth > 0) {
        ctx.translate(centerX, screenY)
        ctx.rotate(rotation)
        ctx.translate(-centerX, -screenY)
        ctx.drawImage(img, sx, sy, spriteW, fullH)
      } else {
        this._drawHorseProcedural(ctx, centerX, screenY, scaledW, fullH, cappedBob, rotation)
      }

      ctx.restore()
    }
  }

'''

if '  _drawHorses(ctx) {' in content and '  _drawHorseProcedural(' in content:
    start = content.find('  _drawHorses(ctx) {')
    end   = content.find('  _drawHorseProcedural(')
    content = content[:start] + new_drawhorses + content[end:]
    changes += 1
    print('_drawHorses restored')
else:
    print('WARN: _drawHorses boundaries not found')

# 5. Restore image log
old = '''      console.log('[WaveRenderer] 3horses.png complete:',
        this._trefoilImg?.complete, 'w:', this._trefoilImg?.naturalWidth)'''
new = '''      this._horseImgs.forEach((img, idx) =>
        console.log(`[WaveRenderer] horse${idx+1}.png complete:`,
          img.complete, 'w:', img.naturalWidth))'''
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('log restored')
else:
    print('WARN: log not found')

with open(path, 'w') as f:
    f.write(content)
print(f'done — {changes} changes')

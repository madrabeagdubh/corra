path = '/data/data/com.termux/files/home/Corra/js/game/effects/waveRenderer.js'
with open(path, 'r') as f:
    content = f.read()

changes = 0

# 1. Fix z-order — insert wave canvas AFTER pgr-objects so boat renders on top
old = '''    const objectsCanvas = document.getElementById('pgr-objects')
    if (objectsCanvas) container.insertBefore(this._canvas, objectsCanvas)
    else container.appendChild(this._canvas)'''
new = '''    // Insert after pgr-objects so the boat (on pgr-objects) renders on top of waves
    const lightCanvas2 = document.getElementById('pgr-light')
    const objCanvas    = document.getElementById('pgr-objects')
    if (lightCanvas2) container.insertBefore(this._canvas, lightCanvas2)
    else if (objCanvas) objCanvas.after(this._canvas)
    else container.appendChild(this._canvas)'''
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('z-order fixed')
else:
    print('WARN: z-order not found')

# 2. Replace the crest highlight + belly with textured, varied version
old = '''      // ── Crest highlight ────────────────────────────────────────────────
      ctx.globalAlpha = baseAlpha * 0.9
      ctx.beginPath()
      pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y))
      ctx.strokeStyle = `rgba(228,242,255,${(baseAlpha * 0.85).toFixed(2)})`
      ctx.lineWidth   = Math.max(1.2, crestH * 0.35)
      ctx.stroke()

      // ── Lit belly — bright south face ──────────────────────────────────
      const bellyH = crestH * 0.55
      const gradY0 = screenY - crestH
      const gradY1 = screenY - crestH * 0.5 + bellyH
      if (isFinite(gradY0) && isFinite(gradY1) && Math.abs(gradY1 - gradY0) > 1) {
        ctx.beginPath()
        pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y))
        for (let i = pts.length - 1; i >= 0; i--) {
          ctx.lineTo(pts[i].x, pts[i].y + bellyH)
        }
        ctx.closePath()
        try {
          const lg = ctx.createLinearGradient(0, gradY0, 0, gradY1)
          lg.addColorStop(0,   `rgba(205,228,255,${(baseAlpha * 0.40).toFixed(2)})`)
          lg.addColorStop(0.5, `rgba(160,205,242,${(baseAlpha * 0.18).toFixed(2)})`)
          lg.addColorStop(1,   'rgba(90,150,210,0)')
          ctx.fillStyle = lg
          ctx.fill()
        } catch(e) {}
      }

      ctx.restore()'''

new = '''      // ── Crest highlight — varies in brightness along its length ──────────
      // Draw as short segments with varying width/alpha for organic look
      ctx.globalAlpha = baseAlpha
      for (let pi = 0; pi < pts.length - 1; pi++) {
        const pt0 = pts[pi], pt1 = pts[pi + 1]
        if (!pt0 || !pt1) continue
        // Brightness varies with wave height at this point
        const heightFrac = Math.max(0, (screenY - pt0.y) / crestH)
        const brightness = 0.4 + heightFrac * 0.6
        const lw = Math.max(0.8, crestH * 0.30 * (0.5 + heightFrac * 0.8))
        ctx.beginPath()
        ctx.moveTo(pt0.x, pt0.y)
        ctx.lineTo(pt1.x, pt1.y)
        ctx.strokeStyle = `rgba(228,242,255,${(baseAlpha * brightness).toFixed(2)})`
        ctx.lineWidth   = lw
        ctx.stroke()
      }

      // ── Lit belly — textured south face ────────────────────────────────
      const bellyH = crestH * 0.60
      const gradY0 = screenY - crestH
      const gradY1 = screenY - crestH * 0.5 + bellyH
      if (isFinite(gradY0) && isFinite(gradY1) && Math.abs(gradY1 - gradY0) > 1) {
        ctx.beginPath()
        pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y))
        for (let i = pts.length - 1; i >= 0; i--) {
          ctx.lineTo(pts[i].x, pts[i].y + bellyH)
        }
        ctx.closePath()

        // Base water tile texture underneath
        const waterTile = this.pgr._getTileCanvas?.(1625)
        if (waterTile) {
          try {
            ctx.save()
            ctx.clip()
            // Tile the water texture across the belly region
            const tileW = waterTile.width * (scaledW / ts) * 1.5
            const tileH = waterTile.height * (scaledW / ts) * 1.5
            const startX = pts[0]?.x ?? 0
            ctx.globalAlpha = baseAlpha * 0.22
            for (let tx = startX - tileW; tx < (pts[pts.length-1]?.x ?? pgr._sw) + tileW; tx += tileW) {
              ctx.drawImage(waterTile, tx, gradY0, tileW, tileH)
            }
            ctx.restore()
            ctx.beginPath()
            pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y))
            for (let i = pts.length - 1; i >= 0; i--) {
              ctx.lineTo(pts[i].x, pts[i].y + bellyH)
            }
            ctx.closePath()
          } catch(e) {}
        }

        try {
          const lg = ctx.createLinearGradient(0, gradY0, 0, gradY1)
          lg.addColorStop(0,   `rgba(210,232,255,${(baseAlpha * 0.42).toFixed(2)})`)
          lg.addColorStop(0.4, `rgba(165,208,245,${(baseAlpha * 0.20).toFixed(2)})`)
          lg.addColorStop(1,   'rgba(90,150,210,0)')
          ctx.fillStyle = lg
          ctx.fill()
        } catch(e) {}
      }

      ctx.restore()'''

if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('crest + belly replaced')
else:
    print('WARN: crest block not found')

# 3. Expose composite wave value at player position for boat riding
# Add after the boat sync section
old = '    if (!this._horseImgsLogged) {'
new = '''    // Wave riding — expose composite wave height at player position
    // PGR reads this to rock the boat in sync with passing waves
    if (p) {
      const playerCol = p.logicalX / ts
      let waveSum = 0, wAmpSum = 0
      for (const w of this._waves) {
        waveSum  += Math.sin(w.phase - playerCol / w.wavelength * Math.PI * 2) * w.amplitude
        wAmpSum  += w.amplitude
      }
      const normalised = wAmpSum > 0 ? waveSum / wAmpSum : 0
      const sharpened  = Math.sign(normalised) * Math.pow(Math.abs(normalised), 0.6)
      // waveRideT: -1 to 1, positive = crest under boat, negative = trough
      this.waveRideT        = sharpened
      this.waveRideAmp      = (0.15 + this.intensity * 0.85)
      // Also expose for camera
      this.wavePhaseAtPlayer = this._waves[0].phase -
        playerCol / this._waves[0].wavelength * Math.PI * 2
    }

    if (!this._horseImgsLogged) {'''
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('wave ride exposed')
else:
    print('WARN: horseImgsLogged not found')

with open(path, 'w') as f:
    f.write(content)
print(f'done — {changes} changes')

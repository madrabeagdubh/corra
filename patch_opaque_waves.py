path = '/data/data/com.termux/files/home/Corra/js/game/effects/waveRenderer.js'
with open(path, 'r') as f:
    content = f.read()

changes = 0

# Replace the belly drawing to be opaque (solid base + gradient overlay)
old = '''      // ── Lit belly — textured south face ────────────────────────────────
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
      }'''

new = '''      // ── Lit belly — opaque south face, hides boat behind wave ────────────
      // Storm intensity shifts colour toward darker grey-green
      const stormT   = this.intensity
      const waterR   = Math.round(45  + stormT * 15)
      const waterG   = Math.round(65  + stormT * 10)
      const waterB   = Math.round(105 - stormT * 25)
      const crestR   = Math.round(160 - stormT * 40)
      const crestG   = Math.round(195 - stormT * 30)
      const crestB   = Math.round(230 - stormT * 20)

      const bellyH = crestH * 0.75
      const gradY0 = screenY - crestH * 0.85
      const gradY1 = gradY0 + bellyH
      if (isFinite(gradY0) && isFinite(gradY1) && Math.abs(gradY1 - gradY0) > 1) {
        ctx.beginPath()
        pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y))
        for (let i = pts.length - 1; i >= 0; i--) {
          ctx.lineTo(pts[i].x, pts[i].y + bellyH)
        }
        ctx.closePath()

        try {
          // Opaque gradient: bright at crest fading to solid water colour
          const lg = ctx.createLinearGradient(0, gradY0, 0, gradY1)
          lg.addColorStop(0,    `rgba(${crestR},${crestG},${crestB},${(baseAlpha * 0.95).toFixed(2)})`)
          lg.addColorStop(0.25, `rgba(${crestR-20},${crestG-20},${crestB-10},${(baseAlpha * 0.92).toFixed(2)})`)
          lg.addColorStop(0.6,  `rgba(${waterR+20},${waterG+20},${waterB+10},${(baseAlpha * 0.88).toFixed(2)})`)
          lg.addColorStop(1,    `rgba(${waterR},${waterG},${waterB},${(baseAlpha * 0.85).toFixed(2)})`)
          ctx.fillStyle = lg
          ctx.fill()
        } catch(e) {}

        // Subtle water tile texture overlay on top of solid base
        const waterTile = this.pgr._getTileCanvas?.(1625)
        if (waterTile) {
          try {
            ctx.save()
            ctx.beginPath()
            pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y))
            for (let i = pts.length - 1; i >= 0; i--) {
              ctx.lineTo(pts[i].x, pts[i].y + bellyH)
            }
            ctx.closePath()
            ctx.clip()
            const tileW = waterTile.width * (scaledW / ts) * 1.5
            const tileH = waterTile.height * (scaledW / ts) * 1.5
            const startX = pts[0]?.x ?? 0
            ctx.globalAlpha = baseAlpha * 0.12
            ctx.globalCompositeOperation = 'overlay'
            for (let tx = startX - tileW; tx < (pts[pts.length-1]?.x ?? pgr._sw) + tileW; tx += tileW) {
              ctx.drawImage(waterTile, tx, gradY0, tileW, tileH)
            }
            ctx.restore()
          } catch(e) {}
        }
      }'''

if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('opaque belly applied')
else:
    print('WARN: belly not found')

with open(path, 'w') as f:
    f.write(content)
print(f'done — {changes} changes')

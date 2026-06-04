path = '/data/data/com.termux/files/home/Corra/js/game/effects/waveRenderer.js'
with open(path, 'r') as f:
    content = f.read()

changes = 0

# Replace the entire _drawWaves method with a composite wave approach
import re

old_method = re.search(r'  // ── Wave crests.*?  // ── White Horses', content, re.DOTALL)
if not old_method:
    print('ERROR: could not find _drawWaves method')
else:
    new_method = '''  // ── Wave crests ───────────────────────────────────────────────────────────
  // Single composite wave per row — sums all wave trains into one shape.
  // No crossing possible. Shadow trough above crest, lit belly below.

  _drawWaves(ctx) {
    const pgr       = this.pgr
    const mapH      = this.scene.mapData?.layers?.[0]?.length ?? 36
    const mapW      = this.scene.mapData?.layers?.[0]?.[0]?.length ?? 72
    const ts        = pgr.tileDisplaySize
    const horizonPx = pgr._horizonPx()
    const eff       = 0.45 + this.intensity * 0.55

    // Advance all wave phases
    // (already done in update() — just read here)

    // Draw one composite crest per row band
    // Step size grows with intensity — fewer rows at peak
    const baseStep  = 2.2
    const rowStep   = baseStep + this.intensity * 2.5
    const maxAmp    = ts * eff * 0.55   // max crest height in tile units

    for (let tileRow = 2; tileRow < mapH - 2; tileRow += rowStep) {

      const screenY = pgr._rowToScreenY(tileRow + 1)
      if (screenY === null || !isFinite(screenY)) continue
      if (screenY < horizonPx + 4 || screenY > pgr._sh + 20) continue

      const scaledW = pgr._scaleAtRow(tileRow + 1)
      if (!scaledW || !isFinite(scaledW)) continue

      // Depth-based amplitude — closer rows (larger scaledW) have taller crests
      const depthScale = scaledW / ts
      const crestH     = maxAmp * depthScale * (1 + this.intensity * 0.6)
      if (crestH < 0.8) continue

      // Build composite crest by summing all wave trains
      const pts = []
      for (let c = -2; c <= mapW + 4; c++) {
        const screenX = pgr._colToScreenX(c + 0.5, tileRow)
        if (!isFinite(screenX)) continue

        // Sum contributions from all wave trains
        let sum = 0
        let weightSum = 0
        for (const w of this._waves) {
          const contribution = Math.sin(w.phase - c / w.wavelength * Math.PI * 2)
          sum       += contribution * w.amplitude
          weightSum += w.amplitude
        }
        // Normalise to [-1, 1]
        const normalised = weightSum > 0 ? sum / weightSum : 0

        // Sharpen peaks — power curve, capped so it doesn't over-spike
        const sharpPow = Math.max(0.5, 0.7 - this.intensity * 0.2)
        const sharp    = Math.sign(normalised) *
                         Math.pow(Math.abs(normalised), sharpPow)

        const cy = screenY - crestH * 0.5 * (1 + sharp)
        if (isFinite(cy)) pts.push({ x: screenX, y: cy })
      }
      if (pts.length < 2) continue

      // Alpha fades near horizon
      const distFromHorizon = screenY - horizonPx
      const horizonFade = distFromHorizon < 40
        ? Math.max(0, distFromHorizon / 40) : 1.0
      const baseAlpha = eff * horizonFade

      ctx.save()

      // ── Shadow trough — dark north face ────────────────────────────────
      const shadowH = crestH * (0.45 + this.intensity * 0.35)
      if (shadowH > 1) {
        ctx.beginPath()
        pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y))
        for (let i = pts.length - 1; i >= 0; i--) {
          ctx.lineTo(pts[i].x, pts[i].y - shadowH)
        }
        ctx.closePath()
        try {
          const sg = ctx.createLinearGradient(0, screenY - crestH - shadowH, 0, screenY - crestH * 0.3)
          sg.addColorStop(0,   'rgba(6,14,32,0)')
          sg.addColorStop(0.4, `rgba(8,18,42,${(baseAlpha * 0.25).toFixed(2)})`)
          sg.addColorStop(1,   `rgba(12,24,52,${(baseAlpha * 0.45).toFixed(2)})`)
          ctx.fillStyle = sg
          ctx.fill()
        } catch(e) {}
      }

      // ── Crest highlight ────────────────────────────────────────────────
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

      ctx.restore()
    }
  }

  // ── White Horses'''

    content = content[:old_method.start()] + new_method + content[old_method.end() - len('  // ── White Horses'):]
    changes += 1
    print('composite wave method inserted')

with open(path, 'w') as f:
    f.write(content)
print(f'done — {changes} changes')

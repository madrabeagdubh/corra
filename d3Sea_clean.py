path = '/data/data/com.termux/files/home/Corra/js/game/scenes/locations/bog/d3Sea.js'
with open(path) as f:
    content = f.read()

import re, subprocess

# 1. Remove duplicate onPGRDrawComplete (keep neither — not needed)
content = re.sub(r'\n  onPGRDrawComplete\(oCtx\) \{[^}]*\}\n', '\n', content)

# 2. Fix double _updateEstuaryWaves call in update()
content = re.sub(
    r'    this\._updateEstuaryWaves\(delta\)\n    // Update estuary waves\n    if \(this\._estWaves\?\.length\) this\._updateEstuaryWaves\(delta\)',
    '    // Update estuary waves\n    if (this._estWaves?.length) this._updateEstuaryWaves(delta)',
    content)

# 3. Replace entire _updateEstuaryWaves with clean version
old = re.search(r'  _updateEstuaryWaves\(delta\) \{.*?^  \}', content, re.DOTALL | re.MULTILINE)
if not old:
    print('ERROR: method not found'); exit()

NEW = '''  _updateEstuaryWaves(delta) {
    if (!this._estWaves?.length) return
    if (!this._estWaveCanvas || !this._estWaveCtx) return
    const pgr = this.perspectiveGround
    if (!pgr) return

    for (const w of this._estWaves) w.phase += w.speed

    const ctx = this._estWaveCtx
    const sw  = pgr._sw || window.innerWidth
    const sh  = pgr._sh || window.innerHeight
    const cw  = Math.round(sw), ch = Math.round(sh)
    if (this._estWaveCanvas.width !== cw || this._estWaveCanvas.height !== ch) {
      this._estWaveCanvas.width = cw; this._estWaveCanvas.height = ch
    }

    if ((this._estWaveHideFrames ?? 0) > 0) {
      this._estWaveHideFrames--
      ctx.clearRect(0, 0, sw, sh)
      if (this._estWaveHideFrames === 0) this._estWaveCanvas.style.opacity = '1'
      return
    }

    ctx.clearRect(0, 0, sw, sh)

    const mapH      = this.mapData?.layers?.[0]?.length ?? 36
    const mapW      = this.mapData?.layers?.[0]?.[0]?.length ?? 36
    const ts        = this.tileSize
    const horizonPx = pgr._horizonPx?.() ?? sh * 0.28
    const eff       = 0.35
    const rowStep   = 3.5
    const maxAmp    = ts * eff * 0.55
    const layer0    = this.mapData?.layers?.[0]

    ctx.save()
    ctx.beginPath()
    ctx.rect(0, horizonPx + 4, sw, sh - horizonPx - 4)
    ctx.clip()

    for (let tileRow = 2; tileRow < mapH - 2; tileRow += rowStep) {
      const screenY = pgr._rowToScreenY?.(tileRow + 1)
      if (screenY === null || !isFinite(screenY)) continue
      if (screenY < horizonPx + 4 || screenY > sh + 20) continue

      const scaledW = pgr._scaleAtRow?.(tileRow + 1)
      if (!scaledW || !isFinite(scaledW)) continue

      const crestH = maxAmp * (scaledW / ts)
      if (crestH < 0.5) continue

      const rowPhaseOffset = (tileRow * 0.618) % (Math.PI * 2)
      const rowData = layer0?.[Math.round(tileRow)]

      // Build wave point segments — break on non-water tiles
      const segments = []
      let seg = []
      for (let c = 0; c <= mapW; c++) {
        const gid     = rowData?.[c] ?? 0
        const isWater = gid === 1625 || gid === 1679
        const screenX = pgr._colToScreenX?.(c + 0.5, tileRow)
        if (!isFinite(screenX) || !isWater) {
          if (seg.length >= 2) segments.push(seg)
          seg = []; continue
        }
        let sum = 0, wsum = 0
        for (const w of this._estWaves) {
          sum  += Math.sin(w.phase + c / w.wavelength * Math.PI * 2 + rowPhaseOffset * w.speed * 8) * w.amplitude
          wsum += w.amplitude
        }
        const norm  = wsum > 0 ? sum / wsum : 0
        const sharp = Math.sign(norm) * Math.pow(Math.abs(norm), 0.6)
        const cy    = screenY - crestH * 0.5 * (1 + sharp)
        if (isFinite(cy)) seg.push({ x: screenX, y: cy })
      }
      if (seg.length >= 2) segments.push(seg)
      if (segments.length === 0) continue

      const horizonFade = Math.max(0, Math.min(1, (screenY - horizonPx) / 40))
      const baseAlpha   = eff * horizonFade

      ctx.save()

      // Shadow trough
      const shadowH = crestH * 0.45
      if (shadowH > 1) {
        for (const s of segments) {
          if (s.length < 2) continue
          ctx.beginPath()
          s.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y))
          for (let i = s.length - 1; i >= 0; i--) ctx.lineTo(s[i].x, s[i].y - shadowH)
          ctx.closePath()
          try {
            const sg = ctx.createLinearGradient(0, screenY - crestH - shadowH, 0, screenY - crestH * 0.3)
            sg.addColorStop(0,   'rgba(6,14,32,0)')
            sg.addColorStop(0.4, `rgba(8,18,42,${(baseAlpha * 0.28).toFixed(2)})`)
            sg.addColorStop(1,   `rgba(12,24,52,${(baseAlpha * 0.45).toFixed(2)})`)
            ctx.fillStyle = sg; ctx.fill()
          } catch(e) {}
        }
      }

      // Crest highlight
      ctx.globalAlpha = baseAlpha
      for (const s of segments) {
        for (let pi = 0; pi < s.length - 1; pi++) {
          const pt0 = s[pi], pt1 = s[pi + 1]
          if (!pt0 || !pt1) continue
          const hf = Math.max(0, (screenY - pt0.y) / crestH)
          const lw = Math.max(0.6, crestH * 0.28 * (0.5 + hf * 0.8))
          ctx.beginPath(); ctx.moveTo(pt0.x, pt0.y); ctx.lineTo(pt1.x, pt1.y)
          ctx.strokeStyle = `rgba(220,238,255,${(baseAlpha * (0.4 + hf * 0.6)).toFixed(2)})`
          ctx.lineWidth = lw; ctx.stroke()
        }
      }

      // Belly gradient
      const bellyH = crestH * 0.75
      const gradY0 = screenY - crestH * 0.85
      const gradY1 = gradY0 + bellyH
      if (isFinite(gradY0) && isFinite(gradY1) && Math.abs(gradY1 - gradY0) > 1) {
        for (const s of segments) {
          if (s.length < 2) continue
          ctx.beginPath()
          s.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y))
          for (let i = s.length - 1; i >= 0; i--) ctx.lineTo(s[i].x, s[i].y + bellyH)
          ctx.closePath()
          try {
            const lg = ctx.createLinearGradient(0, gradY0, 0, gradY1)
            lg.addColorStop(0,    `rgba(160,195,230,${(baseAlpha * 0.82).toFixed(2)})`)
            lg.addColorStop(0.25, `rgba(140,175,215,${(baseAlpha * 0.65).toFixed(2)})`)
            lg.addColorStop(0.6,  `rgba(65,95,130,${(baseAlpha * 0.45).toFixed(2)})`)
            lg.addColorStop(1,    `rgba(45,70,110,${(baseAlpha * 0.28).toFixed(2)})`)
            ctx.fillStyle = lg; ctx.fill()
          } catch(e) {}
        }
      }

      ctx.restore()
    }
    ctx.restore()
  }'''

content = content[:old.start()] + NEW + '\n' + content[old.end():]

with open(path, 'w') as f:
    f.write(content)

r = subprocess.run(['node', '--input-type=module'], input=content, capture_output=True, text=True)
print('syntax OK' if r.returncode == 0 else 'ERROR: ' + r.stderr.split('\n')[0])

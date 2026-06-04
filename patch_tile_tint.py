# Fix: _applyStormTint must run AFTER PGR renders each frame
# PGR draws to _gCtx in its own update, called via super.update()
# Our _applyStormTint runs after super.update() so timing should be fine
# The real issue: 'source-atop' only paints where pixels exist
# but the tiles may be drawn with transparency or on a different canvas

# Let's check by using 'multiply' blend mode instead which darkens existing pixels
path = '/data/data/com.termux/files/home/Corra/js/game/scenes/locations/bog/d3OpenSea.js'
with open(path, 'r') as f:
    content = f.read()

import re
old = re.search(r'  _applyStormTint\(intensity\) \{.*?^  \}', content, re.DOTALL | re.MULTILINE)
if old:
    new_method = '''  _applyStormTint(intensity) {
    if (intensity < 0.02) return
    const pgr = this.perspectiveGround
    if (!pgr?._gCtx) return
    const horizonPx = pgr._horizonPx?.() ?? 0
    const sw = pgr._sw, sh = pgr._sh
    if (!sw || !sh) return
    const t   = intensity
    const ctx = pgr._gCtx
    ctx.save()
    // 'multiply' darkens existing tile pixels — works regardless of alpha
    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = 0.6 + t * 0.3
    // Cold grey-green — desaturates blue tiles toward stormy ocean
    const r = Math.round(60  - t * 20)
    const g = Math.round(75  - t * 15)
    const b = Math.round(90  - t * 10)
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(0, horizonPx, sw, sh - horizonPx)
    ctx.restore()
  }'''
    content = content[:old.start()] + new_method + '\n' + content[old.end():]
    with open(path, 'w') as f:
        f.write(content)
    print('tint method updated')
else:
    print('WARN: _applyStormTint not found')

# Patch _applyStormTint to use a greyer, colder colour
# and also create a d3Sea tint patch

import os

# d3OpenSea tint — already exists, just tune the colour
path_sea = '/dev/null'  # placeholder — will write to outputs

tint_code = '''
  _applyStormTint(intensity) {
    if (intensity < 0.02) return
    const pgr = this.perspectiveGround
    if (!pgr?._gCtx) return
    const horizonPx = pgr._horizonPx?.() ?? 0
    const sw = pgr._sw, sh = pgr._sh
    if (!sw || !sh) return

    const t = intensity
    // Shift from clear blue toward cold grey-green storm water
    // At t=0: no tint. At t=1: heavy dark grey-green overlay
    const ctx = pgr._gCtx
    ctx.save()
    ctx.globalCompositeOperation = 'source-atop'
    // Cool grey-green — desaturates the blue tiles toward stormy ocean
    ctx.globalAlpha = t * 0.45
    ctx.fillStyle = `rgb(28,38,42)`
    ctx.fillRect(0, horizonPx, sw, sh - horizonPx)
    ctx.restore()
  }
'''

# Write a patch that replaces the existing _applyStormTint
path = '/data/data/com.termux/files/home/Corra/js/game/scenes/locations/bog/d3OpenSea.js'
with open(path, 'r') as f:
    content = f.read()

import re
old = re.search(r'  _applyStormTint\(intensity\) \{.*?^  \}', content, re.DOTALL | re.MULTILINE)
if old:
    content = content[:old.start()] + tint_code.strip() + '\n' + content[old.end():]
    with open(path, 'w') as f:
        f.write(content)
    print('storm tint colour updated')
else:
    print('WARN: _applyStormTint not found')


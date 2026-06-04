# Simpler approach: draw a tint overlay directly on the PGR ground canvas
# d3OpenSea calls this each frame after PGR renders

path = '/data/data/com.termux/files/home/Corra/js/game/scenes/locations/bog/d3OpenSea.js'
with open(path, 'r') as f:
    content = f.read()

changes = 0

old = '  _applyStormTint(intensity) {\n    const tm = this.perspectiveGround?.tintManager\n    if (!tm) return\n\n    // At intensity 0: normal water blues\n    // At intensity 1: dark desaturated grey-green\n    // We override the tint for water GIDs directly each frame\n    const t = intensity\n\n    // Interpolate hue from blue (210) toward grey-green (165)\n    const h = Math.round(210 - t * 45)\n    // Saturation drops from 35% to 8%\n    const s = Math.round(35  - t * 27)\n    // Lightness drops from 55% to 35%\n    const l = Math.round(55  - t * 20)\n    const alpha = 0.35 + t * 0.25\n\n    // Override tint for both water GIDs\n    for (const gid of [1625, 1679]) {\n      if (!tm._overrides) tm._overrides = new Map()\n      tm._overrides.set(gid, { h, s, l, alpha })\n    }\n  }'
new = '''  _applyStormTint(intensity) {
    if (intensity < 0.05) return
    const pgr = this.perspectiveGround
    if (!pgr?._gCtx) return

    const horizonPx = pgr._horizonPx?.() ?? 0
    const sw = pgr._sw
    const sh = pgr._sh
    if (!sw || !sh) return

    // Dark desaturated grey-green overlay on the water area
    // Blends over the tile texture to shift toward storm palette
    const t = intensity
    // Colour shifts from transparent blue toward dark grey-green
    const r = Math.round(20 + t * 10)
    const g = Math.round(30 + t * 15)
    const b = Math.round(45 - t * 15)
    const alpha = t * 0.38

    const ctx = pgr._gCtx
    ctx.save()
    ctx.globalCompositeOperation = 'source-atop'
    ctx.globalAlpha = alpha
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(0, horizonPx, sw, sh - horizonPx)
    ctx.restore()
  }'''

if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('storm tint updated to canvas overlay')
else:
    print('WARN: old method not found — adding fresh')
    # Just add it before _applyStormCamera if not there yet
    if '_applyStormTint' not in content:
        old2 = '  _applyStormCamera(delta, intensity) {'
        new2 = '''  _applyStormTint(intensity) {
    if (intensity < 0.05) return
    const pgr = this.perspectiveGround
    if (!pgr?._gCtx) return
    const horizonPx = pgr._horizonPx?.() ?? 0
    const sw = pgr._sw, sh = pgr._sh
    if (!sw || !sh) return
    const t = intensity
    const r = Math.round(20 + t * 10)
    const g = Math.round(30 + t * 15)
    const b = Math.round(45 - t * 15)
    const ctx = pgr._gCtx
    ctx.save()
    ctx.globalCompositeOperation = 'source-atop'
    ctx.globalAlpha = t * 0.38
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(0, horizonPx, sw, sh - horizonPx)
    ctx.restore()
  }

  _applyStormCamera(delta, intensity) {'''
        if old2 in content:
            content = content.replace(old2, new2, 1); changes += 1
            print('storm tint added fresh')

with open(path, 'w') as f:
    f.write(content)
print(f'done — {changes} changes')

path = '/data/data/com.termux/files/home/Corra/js/game/effects/waveRenderer.js'
with open(path, 'r') as f:
    content = f.read()

changes = 0

# 1. Reverse wave direction — east to west (negate column term)
old = '          const contribution = Math.sin(w.phase - c / w.wavelength * Math.PI * 2)'
new = '          const contribution = Math.sin(w.phase + c / w.wavelength * Math.PI * 2)'
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('wave direction reversed')
else:
    print('WARN: wave direction not found')

# Also reverse in the wave ride calculation
old = 'waveSum  += Math.sin(w.phase - playerCol / w.wavelength * Math.PI * 2) * w.amplitude'
new = 'waveSum  += Math.sin(w.phase + playerCol / w.wavelength * Math.PI * 2) * w.amplitude'
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('wave ride direction reversed')
else:
    print('WARN: wave ride direction not found')

# Also reverse in wavePhaseAtPlayer
old = "      this.wavePhaseAtPlayer = this._waves[0].phase -\n        playerCol / this._waves[0].wavelength * Math.PI * 2"
new = "      this.wavePhaseAtPlayer = this._waves[0].phase +\n        playerCol / this._waves[0].wavelength * Math.PI * 2"
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('wavePhaseAtPlayer direction reversed')
else:
    print('WARN: wavePhaseAtPlayer not found')

# 2. Stagger waves — add per-row phase offset so crests dont align
old = '      // Build composite crest by summing all wave trains\n      const pts = []\n      for (let c = -2; c <= mapW + 4; c++) {'
new = '''      // Per-row phase stagger — each row has a unique offset
      // so crests don't all peak at the same horizontal position
      const rowPhaseOffset = (tileRow * 0.618) % (Math.PI * 2)  // golden ratio spread

      // Build composite crest by summing all wave trains
      const pts = []
      for (let c = -2; c <= mapW + 4; c++) {'''
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('row stagger added')
else:
    print('WARN: pts loop not found')

# Apply the row offset in the sum
old = '          const contribution = Math.sin(w.phase + c / w.wavelength * Math.PI * 2)'
new = '          const contribution = Math.sin(w.phase + c / w.wavelength * Math.PI * 2 + rowPhaseOffset * (w.speed * 8))'
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('row offset applied to sum')
else:
    print('WARN: contribution line not found after direction fix')

# 3. Expose actual crest height at player row for accurate boat riding
# Add to the wave ride section
old = '      this.waveRideT        = sharpened\n      this.waveRideAmp      = (0.15 + this.intensity * 0.85)'
new = '''      this.waveRideT        = sharpened
      // Expose actual screen-space crest height at player row
      // PGR uses this for accurate vertical boat displacement
      const _pRow    = p.logicalY / ts
      const _scaledW = this.pgr._scaleAtRow(_pRow + 1) ?? ts
      const _crestH  = ts * eff * 0.55 * (_scaledW / ts) * (1 + this.intensity * 0.6)
      this.waveRideAmp      = _crestH   // actual screen pixels'''
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('accurate ride amp exposed')
else:
    print('WARN: waveRideT not found')

# 4. Cut out boat row from wave canvas — clip out a band around player screenY
# Add a clearRect around the player position after all drawing
old = '    this._updateFoam(dt)\n    this._drawFoam(ctx)\n    this._updateSpray(dt)\n    this._drawSpray(ctx)'
new = '''    this._updateFoam(dt)
    this._drawFoam(ctx)
    this._updateSpray(dt)
    this._drawSpray(ctx)

    // Cut a band around the player row so the boat always shows through
    if (p) {
      const _pTileY  = p.logicalY / ts
      const _pScreenY = this.pgr._rowToScreenY(_pTileY + 1)
      const _pScaledW = this.pgr._scaleAtRow(_pTileY + 1) ?? ts
      if (_pScreenY && isFinite(_pScreenY)) {
        const _bandH = _pScaledW * 2.2
        ctx.clearRect(0, _pScreenY - _bandH, this._canvas.width, _bandH * 1.4)
      }
    }'''
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('boat band cutout added')
else:
    print('WARN: foam/spray calls not found')

with open(path, 'w') as f:
    f.write(content)
print(f'done — {changes} changes')

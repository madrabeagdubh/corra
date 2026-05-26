#!/usr/bin/env python3
# fix_pgr3.py
# Run from ~/Corra: python3 fix_pgr3.py

f = 'js/game/effects/perspectiveGroundRenderer.js'
s = open(f).read()

# ── 1. Add loadBoatImage and setBoatActive before _drawWeaponOverlay ─────

old1 = '  _drawWeaponOverlay(playerScreenX, playerScreenY, scaledTileW, aimAngle) {'
new1 = '''  loadBoatImage(imgElement) {
    const c   = document.createElement('canvas')
    c.width   = imgElement.naturalWidth  || imgElement.width
    c.height  = imgElement.naturalHeight || imgElement.height
    const ctx = c.getContext('2d')
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(imgElement, 0, 0)
    this._boatCanvas = c
    console.log('[PGR] boat canvas ready -', c.width, 'x', c.height)
  }

  setBoatActive(active) {
    this._boatActive  = !!active
    this._boatScreenX = null
    this._boatScreenY = null
    if (active) {
      this._boatSinkOverride = 0.55
    } else {
      this._boatSinkOverride = 0
    }
    this._playerFrameKey = null
  }

  _drawWeaponOverlay(playerScreenX, playerScreenY, scaledTileW, aimAngle) {'''

if old1 in s:
    s = s.replace(old1, new1)
    print('loadBoatImage + setBoatActive added: done')
else:
    print('ERROR: _drawWeaponOverlay anchor not found')
    exit(1)

# ── 2. Fix ns branch: use terrainSinkOffset not _boatSinkOverride ─────────

old2 = '''        // Crop: hide legs behind boat hull
        const sinkFrac = this._boatSinkOverride ?? 0
        const _sink    = H * sinkFrac
        const _cropH   = H - _sink
        ctx.drawImage(img, 0, 0, img.width, img.height * (_cropH / H), -W/2, -H + _sink, W, _cropH)
        ctx.restore()
        return'''

new2 = '''        // Crop: use boat override when in boat, terrain sink otherwise
        const _sink0ns = this._boatActive
          ? H * (this._boatSinkOverride ?? 0)
          : Math.min(H * 1.1, (p?.terrainSinkOffset ?? 0) * scaledTileW / 48)
        const _cropH0ns = H - _sink0ns
        ctx.drawImage(img, 0, 0, img.width, img.height * (_cropH0ns / H), -W/2, -H + _sink0ns, W, _cropH0ns)
        ctx.restore()
        return'''

if old2 in s:
    s = s.replace(old2, new2)
    print('ns branch sink fix: done')
else:
    print('ERROR: ns branch crop block not found')
    exit(1)

# ── 3. Remove stale end-of-patch comment if present ───────────────────────

old3 = '\n// ── END OF PGR PATCH ─────────────────────────────────────────────────────\n\n\n\n'
if old3 in s:
    s = s.replace(old3, '\n')
    print('stale comment removed: done')
else:
    print('(no stale comment to remove)')

open(f, 'w').write(s)
print('file written -- all done')

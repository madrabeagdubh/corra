path = '/data/data/com.termux/files/home/Corra/js/game/effects/perspectiveGroundRenderer.js'
with open(path, 'r') as f:
    content = f.read()

changes = 0

# Fix ride amplitude — waveRideAmp is now actual screen pixels, not a fraction
old = '''        // Vertical ride — boat rises on crests, dips in troughs
        const rideT   = waveRenderer.waveRideT ?? 0
        const rideAmp = (waveRenderer.waveRideAmp ?? 0) * scaledTileW * 0.18
        this._waveRideOffset = this._waveRideOffset ?? 0
        this._waveRideOffset += (rideT * rideAmp - this._waveRideOffset) * 0.08'''
new = '''        // Vertical ride — boat rises on crests, dips in troughs
        // waveRideAmp is actual screen pixels (crest height at player row)
        const rideT   = waveRenderer.waveRideT ?? 0
        const rideAmp = waveRenderer.waveRideAmp ?? 0
        this._waveRideOffset = this._waveRideOffset ?? 0
        this._waveRideOffset += (rideT * rideAmp * 0.85 - this._waveRideOffset) * 0.06'''
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('ride amplitude fixed')
else:
    print('WARN: ride amp not found')
    # show context
    idx = content.find('waveRideOffset')
    if idx >= 0:
        print('context:', repr(content[idx-50:idx+200]))

with open(path, 'w') as f:
    f.write(content)
print(f'done — {changes} changes')

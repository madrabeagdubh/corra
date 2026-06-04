path = '/data/data/com.termux/files/home/Corra/js/game/effects/perspectiveGroundRenderer.js'
with open(path, 'r') as f:
    content = f.read()

changes = 0

# Find and replace the ride offset calculation
old = '''        // Vertical ride — boat rises on crests, dips in troughs
        const rideT   = waveRenderer.waveRideT ?? 0
        const rideAmp = waveRenderer.waveRideAmp ?? 0
        this._waveRideOffset = this._waveRideOffset ?? 0
        this._waveRideOffset += (rideT * rideAmp * 0.85 - this._waveRideOffset) * 0.06'''
new = '''        // Vertical ride — boat tossed by waves
        const rideT    = waveRenderer.waveRideT ?? 0
        const rideAmp  = waveRenderer.waveRideAmp ?? 0
        // Add secondary chop — smaller faster oscillation for roughness
        const chopAmp  = rideAmp * 0.35 * (waveRenderer.intensity ?? 0)
        const chopT    = Math.sin((this._animT ?? 0) * 4.2) * chopAmp
        const targetOff = rideT * rideAmp * 1.4 + chopT
        this._waveRideOffset = this._waveRideOffset ?? 0
        // Faster lerp for more responsive tossing
        this._waveRideOffset += (targetOff - this._waveRideOffset) * 0.12'''
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('boat toss cranked up')
else:
    print('WARN: ride offset not found')
    idx = content.find('waveRideOffset')
    if idx >= 0:
        print('context:', repr(content[idx-100:idx+200]))

with open(path, 'w') as f:
    f.write(content)
print(f'done — {changes} changes')

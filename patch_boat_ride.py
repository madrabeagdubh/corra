path = '/data/data/com.termux/files/home/Corra/js/game/effects/perspectiveGroundRenderer.js'
with open(path, 'r') as f:
    content = f.read()

changes = 0

# Feed waveRideT into boat wobble — in the _boatActive wobble section
old = '''    if (this._boatActive) {
      const waveRenderer = this.scene._waveRenderer
      if (waveRenderer) {
        // Sync boat rock to wave phase passing under player
        this._wobblePhase = waveRenderer.wavePhaseAtPlayer
        const waveTargetAmp = waveRenderer.waveAmpAtPlayer / (scaledTileW || 1) * 0.10
        const boatTargetAmp = boatSpd > 8
          ? 0.04 + Math.min(boatSpd / 120, 0.10)
          : 0.012
        const targetAmp = Math.max(boatTargetAmp, waveTargetAmp)
        this._wobbleAmp = this._wobbleAmp ?? 0.012
        this._wobbleAmp += (targetAmp - this._wobbleAmp) * 0.04
      } else {
        const wobbleFreq = 1.8 + boatSpd * 0.04
        this._wobblePhase = ((this._wobblePhase ?? 0) + wobbleFreq * 0.016) % (Math.PI * 2)
        const targetAmp = boatSpd > 8
          ? 0.04 + Math.min(boatSpd / 120, 0.10)
          : 0.012
        this._wobbleAmp = this._wobbleAmp ?? 0.012
        this._wobbleAmp += (targetAmp - this._wobbleAmp) * 0.04
      }
    }'''
new = '''    if (this._boatActive) {
      const waveRenderer = this.scene._waveRenderer
      if (waveRenderer) {
        // Sync boat rock AND vertical ride to composite wave under player
        this._wobblePhase = waveRenderer.wavePhaseAtPlayer
        const waveTargetAmp = waveRenderer.waveAmpAtPlayer / (scaledTileW || 1) * 0.12
        const boatTargetAmp = boatSpd > 8
          ? 0.04 + Math.min(boatSpd / 120, 0.10)
          : 0.012
        const targetAmp = Math.max(boatTargetAmp, waveTargetAmp)
        this._wobbleAmp = this._wobbleAmp ?? 0.012
        this._wobbleAmp += (targetAmp - this._wobbleAmp) * 0.04
        // Vertical ride — boat rises on crests, dips in troughs
        const rideT   = waveRenderer.waveRideT ?? 0
        const rideAmp = (waveRenderer.waveRideAmp ?? 0) * scaledTileW * 0.18
        this._waveRideOffset = (this._waveRideOffset ?? 0)
        this._waveRideOffset += (rideT * rideAmp - this._waveRideOffset) * 0.08
      } else {
        const wobbleFreq = 1.8 + boatSpd * 0.04
        this._wobblePhase = ((this._wobblePhase ?? 0) + wobbleFreq * 0.016) % (Math.PI * 2)
        const targetAmp = boatSpd > 8
          ? 0.04 + Math.min(boatSpd / 120, 0.10)
          : 0.012
        this._wobbleAmp = this._wobbleAmp ?? 0.012
        this._wobbleAmp += (targetAmp - this._wobbleAmp) * 0.04
        this._waveRideOffset = 0
      }
    } else {
      this._waveRideOffset = 0
    }'''
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('wobble section updated')
else:
    print('WARN: wobble section not found')

# Apply waveRideOffset to the boat's screen position
# Find where playerScreenY is used for boat drawing and offset it
old = '        const _drawX = playerScreenX\n        const _drawY = playerScreenY'
new = '''        const _drawX = playerScreenX
        // Offset Y by wave ride — boat rises and falls with the sea
        const _waveOff = this._boatActive ? (this._waveRideOffset ?? 0) : 0
        const _drawY = playerScreenY - _waveOff'''
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('wave ride offset applied to draw position')
else:
    print('WARN: _drawX/_drawY not found')

with open(path, 'w') as f:
    f.write(content)
print(f'done — {changes} changes')

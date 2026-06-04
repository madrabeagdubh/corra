path = '/data/data/com.termux/files/home/Corra/js/game/scenes/locations/bog/d3OpenSea.js'
with open(path, 'r') as f:
    content = f.read()

changes = 0

# 1. Add import
old = "import WaveRenderer from '../../../effects/waveRenderer.js'"
new = "import WaveRenderer from '../../../effects/waveRenderer.js'\nimport { StormAudio } from '../../../systems/music/stormAudio.js'"
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('import added')
else:
    print('WARN: import not found')

# 2. Replace old audio init with new StormAudio
old = """    // Storm audio
    this._stormAC       = null
    this._stormMaster   = null
    this._windGain      = null
    this._windNoise     = null
    this._waveGain      = null
    this._sprayGain     = null
    this._lastWaveCrash = 0
    this._initStormAudio()"""
new = """    // Storm audio
    this._stormAudio = new StormAudio()
    this._stormAudio.start()"""
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('audio init replaced')
else:
    print('WARN: old audio init not found')

# 3. Replace audio update call
old = "    // Storm audio\n    this._updateStormAudio(intensity, delta)"
new = "    // Storm audio\n    this._stormAudio?.setIntensity(intensity)"
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('audio update replaced')
else:
    print('WARN: audio update not found')

# 4. Replace cleanup
old = "    this._stopStormAudio()"
new = "    this._stormAudio?.stop()\n    this._stormAudio = null"
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('cleanup replaced')
else:
    print('WARN: cleanup not found')

# 5. Remove old audio methods (everything from _initStormAudio to _applyStormTint)
import re
old_methods = re.search(
    r'  // ── Storm audio ─+\n.*?(?=  _applyStormTint)',
    content, re.DOTALL)
if old_methods:
    content = content[:old_methods.start()] + content[old_methods.end():]
    changes += 1
    print('old audio methods removed')
else:
    print('WARN: old audio methods not found')

with open(path, 'w') as f:
    f.write(content)
print(f'done — {changes} changes')

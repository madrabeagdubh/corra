# Part 2 — call _tickBoatPath from riverScene update
path2 = '/data/data/com.termux/files/home/Corra/js/game/scenes/locations/riverScene.js'
with open(path2, 'r') as f:
    content2 = f.read()

# Find update method
old2 = '  update(time, delta) {\n    super.update(time, delta)'
new2 = '  update(time, delta) {\n    super.update(time, delta)\n    this._tickBoatPath()'
if old2 in content2:
    content2 = content2.replace(old2, new2, 1)
    print('tickBoatPath called in update')
else:
    print('WARN: update not found — checking...')
    idx = content2.find('update(time, delta)')
    print('context:', repr(content2[idx:idx+80]) if idx >= 0 else 'not found')

with open(path2, 'w') as f:
    f.write(content2)

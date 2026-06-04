path = '/data/data/com.termux/files/home/Corra/js/game/effects/waveRenderer.js'
with open(path, 'r') as f:
    content = f.read()

changes = 0

# 1. Double the row step so half as many wave lines
old = '    const baseStep  = 2.2\n    const rowStep   = baseStep + this.intensity * 2.5'
new = '    const baseStep  = 4.5\n    const rowStep   = baseStep + this.intensity * 3.5'
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('row step doubled')
else:
    print('WARN: rowStep not found')

# 2. Make belly fully opaque — raise alpha stops to 1.0
old = '''          lg.addColorStop(0,    `rgba(${crestR},${crestG},${crestB},${(baseAlpha * 0.95).toFixed(2)})`)
          lg.addColorStop(0.25, `rgba(${crestR-20},${crestG-20},${crestB-10},${(baseAlpha * 0.92).toFixed(2)})`)
          lg.addColorStop(0.6,  `rgba(${waterR+20},${waterG+20},${waterB+10},${(baseAlpha * 0.88).toFixed(2)})`)
          lg.addColorStop(1,    `rgba(${waterR},${waterG},${waterB},${(baseAlpha * 0.85).toFixed(2)})`)'''
new = '''          lg.addColorStop(0,    `rgba(${crestR},${crestG},${crestB},1.0)`)
          lg.addColorStop(0.25, `rgba(${crestR-20},${crestG-20},${crestB-10},0.98)`)
          lg.addColorStop(0.6,  `rgba(${waterR+20},${waterG+20},${waterB+10},0.96)`)
          lg.addColorStop(1,    `rgba(${waterR},${waterG},${waterB},0.95)`)'''
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('belly fully opaque')
else:
    print('WARN: belly alpha not found')

# 3. Also make shadow fully opaque
old = '''          sg.addColorStop(0,   'rgba(6,14,32,0)')
          sg.addColorStop(0.4, `rgba(8,18,42,${(baseAlpha * 0.25).toFixed(2)})`)
          sg.addColorStop(1,   `rgba(12,24,52,${(baseAlpha * 0.45).toFixed(2)})`)'''
new = '''          sg.addColorStop(0,   'rgba(6,14,32,0)')
          sg.addColorStop(0.4, `rgba(8,18,42,0.55)`)
          sg.addColorStop(1,   `rgba(12,24,52,0.80)`)'''
if old in content:
    content = content.replace(old, new, 1); changes += 1
    print('shadow opaque')
else:
    print('WARN: shadow alpha not found')

with open(path, 'w') as f:
    f.write(content)
print(f'done — {changes} changes')

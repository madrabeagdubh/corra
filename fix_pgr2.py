#!/usr/bin/env python3
# fix_pgr2.py
# Run from ~/Corra: python3 fix_pgr2.py

f = 'js/game/effects/perspectiveGroundRenderer.js'
s = open(f).read()

# Find both occurrences of _drawPlayerAnimated
first  = s.find('_drawPlayerAnimated(ctx, img, screenX, screenY, scaledTileW, heightMult)')
second = s.find('_drawPlayerAnimated(ctx, img, screenX, screenY, scaledTileW, heightMult)', first + 1)

if first == -1:
    print('ERROR: _drawPlayerAnimated not found at all')
    exit(1)

if second == -1:
    print('Only one _drawPlayerAnimated found -- nothing to fix')
    print('First occurrence at char:', first)
    exit(0)

print(f'First  _drawPlayerAnimated at char: {first}')
print(f'Second _drawPlayerAnimated at char: {second}')

# The first one (without boat code) needs to be removed.
# It starts at 'first' (actually a few chars back to include '  ')
# and ends just before the second one's method definition.
# We find the start of the first method (the '  _drawPlayer...' line)
# and the start of the second method, and delete everything between.

# Find start of first method (go back to find the newline before it)
start_of_first = s.rfind('\n', 0, first) + 1

# Find start of second method
start_of_second = s.rfind('\n', 0, second) + 1

# Also need to remove any comment lines immediately before the second method
# Look back from start_of_second for comment lines
pre_second = s.rfind('\n', 0, start_of_second - 1)
# Check what's between start_of_first and start_of_second
block = s[start_of_first:start_of_second]
print(f'\nRemoving block of {len(block)} chars')
print('Block starts with:', repr(block[:80]))
print('Block ends with:  ', repr(block[-80:]))

# Do the removal
new_s = s[:start_of_first] + s[start_of_second:]

# Verify only one _drawPlayerAnimated remains
count = new_s.count('_drawPlayerAnimated(ctx, img, screenX')
print(f'\nAfter removal: {count} _drawPlayerAnimated definition(s) remain')

if count == 1:
    open(f, 'w').write(new_s)
    print('done -- file written')
else:
    print('ERROR: unexpected count, file not written')

#!/usr/bin/env python3
"""
patch_hall_door.py -- give the chieftain's hall a working door, point it
at the tavern interior, and make village walls fully opaque.

Run from repo root. Idempotent: every edit checks for its own result
first and skips if already applied.

(1) THE HALL'S DOOR NEVER DREW
    _collectDoorway derives doorY = cy + r * 0.96 from whatever centre
    and radius it is handed. The longhall passed cy = y1 - 0.001 (19.599)
    and r = w * 0.15 (1.05), so doorY came out at 20.607 -- row 21. But
    that call sits inside `if (Math.round(y1) === tileRow)`, which is
    only ever true on row 20, so the guard `Math.round(doorY) !==
    tileRow` rejected it every frame. And getEntriesForRow's span for the
    longhall is d/2 + 1 = 2.6, so row 21 is never collected at all --
    the door was unreachable by two independent routes.

    Fixed by having callers pass the final doorY and half-width rather
    than a centre and radius for _collectDoorway to guess from. The huts'
    call reproduces the old derivation exactly, so their doors are
    untouched; the hall now places its door ON its south wall, which is
    where it should have been.

(2) TAVERN AND HALL MERGED
    The door zone lived at the tavern hut (36,26) while its own label
    already read "Isteach sa halla" / "Into the hall" -- the intent was
    always the hall. Moved to the hall's frontage at (28,21), just south
    of the portico (posts at y=20.8), so the badge sits outside the
    canopy rather than under it.

    house.door is decorative -- nothing reads it; the door system is
    driven entirely by mapData.doors (see PerspectiveScene
    _registerDoorZones). Moved anyway so the data does not lie.

(3) OPAQUE WALLS
    KIND_STYLE's wall colours carried alpha 0.96/0.97. _blend
    interpolates alpha along with rgb, so every derived wall tone
    inherited it and the whole village was faintly see-through. Setting
    both endpoints to 1 fixes all of them at once.

    DOOR_COLOR is deliberately left at 0.9 -- it reads as a dark opening
    rather than a painted panel, and it is not a wall. Say the word if
    you want it solid too.
"""

import json, os, sys

RHOUSE = 'js/game/effects/roundhouseRenderer.js'
MAP    = 'public/maps/bogMaps/b0.json'

# Hall frontage. y1 (south wall) is 18 + 3.2/2 = 19.6; the portico runs
# out to y = 19.6 + 1.2 = 20.8. 21 puts the badge just clear of it.
DOOR_X, DOOR_Y = 28, 21
# Where the player lands coming back out of the tavern interior -- one
# tile further south again, so they do not re-trigger the door instantly.
RETURN_X, RETURN_Y = 28, 22


def patch_renderer():
    src = open(RHOUSE).read()

    # ── opaque walls ─────────────────────────────────────────────────────
    if "'rgba(188,168,132,0.97)'" in src:
        for old, new in [
            ("wallLight: 'rgba(188,168,132,0.97)', wallDark: 'rgba(118,102,74,0.97)'",
             "wallLight: 'rgba(188,168,132,1)', wallDark: 'rgba(118,102,74,1)'"),
            ("wallLight: 'rgba(192,174,138,0.96)', wallDark: 'rgba(126,110,80,0.96)'",
             "wallLight: 'rgba(192,174,138,1)', wallDark: 'rgba(126,110,80,1)'"),
            ("wallLight: 'rgba(188,170,134,0.96)', wallDark: 'rgba(120,104,76,0.96)'",
             "wallLight: 'rgba(188,170,134,1)', wallDark: 'rgba(120,104,76,1)'"),
        ]:
            if old not in src:
                sys.exit(f'  [FAIL] wall colour not found: {old[:40]}')
            src = src.replace(old, new, 1)
        print('  [ok]   wall colours opaque (alpha 1)')
    else:
        print('  [skip] wall colours already opaque')

    # ── taller door for the hall ─────────────────────────────────────────
    if 'doorH:' not in src:
        old = "    trim: 'rgba(54,40,26,0.95)',\n"
        if old not in src:
            sys.exit('  [FAIL] longhall trim line not found')
        src = src.replace(old, old +
            "    // Overrides the Math.min(1.3, wallH * 0.7) default below: the\n"
            "    // hall's door should read as grander than a dwelling's, and the\n"
            "    // 1.3 cap otherwise made every door in the village the same\n"
            "    // height regardless of the wall it sits in.\n"
            "    doorH: 1.7,\n", 1)
        print('  [ok]   longhall gets doorH: 1.7')
    else:
        print('  [skip] doorH already present')

    # ── _collectDoorway takes an explicit position ───────────────────────
    old_sig = """  _collectDoorway(house, tileRow, entries, cx, cy, r, style) {
    const doorY = cy + r * 0.96
    if (Math.round(doorY) !== tileRow) return
    const doorHalf = Math.min(0.6, r * 0.28)"""
    new_sig = """  // Callers pass the FINAL doorY and half-width. This used to derive both
  // from a centre and radius, which silently broke the longhall: it
  // handed in y1 - 0.001 and w * 0.15, so doorY landed on row 21 while
  // the call itself only ever ran on row 20, and the guard below rejected
  // it every frame.
  _collectDoorway(house, tileRow, entries, cx, doorY, doorHalf, style) {
    if (Math.round(doorY) !== tileRow) return"""
    if old_sig in src:
        src = src.replace(old_sig, new_sig, 1)
        old_h = "const doorH = Math.min(1.3, style.wallH * 0.7)"
        if old_h not in src:
            sys.exit('  [FAIL] doorH derivation not found')
        src = src.replace(old_h,
                          "const doorH = style.doorH ?? Math.min(1.3, style.wallH * 0.7)", 1)

        # Hut call site -- reproduces the old derivation exactly.
        old_hut = "this._collectDoorway(house, tileRow, entries, cx, cy, r, style)"
        if old_hut not in src:
            sys.exit('  [FAIL] hut _collectDoorway call not found')
        src = src.replace(old_hut,
            "this._collectDoorway(house, tileRow, entries, cx, "
            "cy + r * 0.96, Math.min(0.6, r * 0.28), style)", 1)

        # Longhall call site -- door sits ON the south wall now, and is
        # wider than a hut's (0.75 half vs 0.6) to match its status.
        old_hall = ("this._collectDoorway(house, tileRow, entries, cx, "
                    "y1 - 0.001, w * 0.15, style)")
        if old_hall not in src:
            sys.exit('  [FAIL] longhall _collectDoorway call not found')
        src = src.replace(old_hall,
            "this._collectDoorway(house, tileRow, entries, cx, "
            "y1 - 0.001, Math.min(0.75, w * 0.11), style)", 1)
        print('  [ok]   _collectDoorway takes explicit doorY/doorHalf')
        print('  [ok]   hall door now draws on its south wall')
    else:
        print('  [skip] _collectDoorway already takes explicit position')

    open(RHOUSE, 'w').write(src)


def patch_map():
    data = json.load(open(MAP))
    changed = []

    houses = {h['id']: h for h in data.get('houses', [])}
    if 'door' in houses.get('tavern', {}):
        del houses['tavern']['door']
        changed.append('tavern hut loses door')
    if houses.get('longhall', {}).get('door') != 'tavern':
        houses['longhall']['door'] = 'tavern'
        changed.append('longhall gains door: tavern')

    for d in data.get('doors', []):
        if d['id'] == 'tavern_door' and (d['x'], d['y']) != (DOOR_X, DOOR_Y):
            d['x'], d['y'] = DOOR_X, DOOR_Y
            changed.append(f'door zone -> ({DOOR_X},{DOOR_Y})')

    ent = data.get('entries', {}).get('fromTavern')
    if ent and (ent['x'], ent['y']) != (RETURN_X, RETURN_Y):
        ent['x'], ent['y'] = RETURN_X, RETURN_Y
        changed.append(f'fromTavern -> ({RETURN_X},{RETURN_Y})')

    if not changed:
        print('  [skip] b0.json already merged')
        return
    json.dump(data, open(MAP, 'w'), indent=2)
    for c in changed:
        print(f'  [ok]   {c}')


if __name__ == '__main__':
    for p in (RHOUSE, MAP):
        if not os.path.exists(p):
            sys.exit(f'{p} not found -- run from repo root')
    print('hall door + opaque walls:')
    patch_renderer()
    patch_map()
    print('done. rebuild with:')
    print('  NODE_OPTIONS=--max-old-space-size=3072 npm run build')

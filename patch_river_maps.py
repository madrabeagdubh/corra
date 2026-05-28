#!/usr/bin/env python3
"""
Run from ~/Corra:
  python3 ~/Downloads/patch_river_maps.py
"""
from pathlib import Path

MAPS = ['a3', 'b3', 'c3']

for key in MAPS:
    f = Path(f'js/game/scenes/locations/bog/{key}.js')
    if not f.exists():
        print(f'[{key}.js] not found, skipping')
        continue

    txt = f.read_text()

    # Add GameState import if missing
    if 'GameState' not in txt:
        txt = "import { GameState } from '../../../systems/gameState.js'\n" + txt
        print(f'[{key}.js] added GameState import')

    # Add boat preload if missing
    if "'boat'" not in txt:
        old = '  preload() {\n    super.preload()\n  }'
        new = '  preload() {\n    super.preload()\n    this.load.image(\'boat\', \'/assets/boat.png\')\n  }'
        if old in txt:
            txt = txt.replace(old, new, 1)
            print(f'[{key}.js] added boat preload')
        else:
            # No preload at all -- add one before onEnter or closing brace
            closing = '\n}'
            insert = '\n\n  preload() {\n    super.preload()\n    this.load.image(\'boat\', \'/assets/boat.png\')\n  }'
            txt = txt.rstrip()
            # Insert before final closing brace
            txt = txt[:-1] + insert + '\n}'
            print(f'[{key}.js] inserted preload block')

    # Add onEnter if missing
    if 'onEnter' not in txt:
        # For c3 (east of d3) -- player rows west INTO c3, so arriving from east = in boat
        # For b3, a3 -- same rule, arriving from east means in boat
        insert_enter = f"""
  onEnter() {{
    const edge = this.entryData?.entryEdge
    const fromEast = !edge || edge === 'east'
    this._restoreBoatOnEnter({{ activateIfNoSave: fromEast }})
  }}
"""
        txt = txt.rstrip()
        txt = txt[:-1] + insert_enter + '}'
        print(f'[{key}.js] added onEnter with _restoreBoatOnEnter')
    else:
        print(f'[{key}.js] onEnter already present, skipping')

    f.write_text(txt)

print('\nDone.')

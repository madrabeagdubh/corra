#!/usr/bin/env python3
"""
patch_rename_village_hall.py -- rename the tavern location to villageHall
throughout, delete the outdoor firepit, and move the two NPCs that the
door relocation stranded.

Run from repo root. Idempotent. Uses `git mv` when the repo is clean
enough, otherwise falls back to a plain move.

(1) RENAME
    Files      public/maps/village/tavern.json -> villageHall.json
               js/game/scenes/locations/village/tavern.js -> villageHall.js
    Class      TavernScene -> VillageHallScene
    Scene key  'tavern' -> 'villageHall'   (tavern.js AND villageScene.js,
               which carries the same getMapKey default)
    Const      TAVERN_BARD_MODE -> HALL_BARD_MODE
    Entry      entries.fromTavern -> entries.fromVillageHall, and the
               matching entryEdge on the hall's exit door. These two are a
               matched pair -- rename one without the other and stepping
               outside drops the player at the map's default spawn.
    Door ids   tavern_door -> hall_door, tavern_exit -> hall_exit

    Comment-only mentions of "tavern.js" in storyVisuals, corraHarp,
    voiceSynth, bardAccompaniment, bardHarmonizer and harpPhrasePlayer are
    repointed too, since they name a file that no longer exists.

(2) KIND TAXONOMY -- a judgement call, easily reversed
    KIND_STYLE's kinds are build types, not uses: 'tavern' was only ever
    "roundhouse slightly larger than a dwelling" (wallH 2.1 vs 1.8).
    Nothing in the ráth is a tavern now, so the kind is renamed
    'roundhouse' and the two huts get use-names as their ids: kitchen
    (the larger, was 'tavern') and forge (was 'house_1').

    Both lookups fall back to KIND_STYLE.dwelling, so a mismatch degrades
    to a smaller hut rather than throwing -- but the fallback is silent,
    which is exactly why this patch changes KIND_STYLE and b0.json in the
    same commit. Revert both together or neither.

    The forge is a dwelling-shaped hut for now. It should probably read
    differently once it has art -- smaller, darker, a smoke vent.

(3) OUTDOOR FIREPIT DELETED
    features[] loses the firepit at (28,24). The hearth is inside now,
    and the fire particle effect already lives in the hall scene.
    The well and the pen stay.

(4) STRANDED NPCS
    Moving the door to the hall left two placements wrong:

    Mór was at (34,26), positioned beside the OLD tavern-hut door at
    (36,26) which no longer exists. Parked at (30,23) -- inside the ráth,
    near the hall's frontage, clear of the door zone -- as a holding
    position only. She belongs inside the hall, greeting on entry, once
    that mechanism exists.

    Cormac was at (28,21), which became the hall's door tile exactly. The
    comment above his own definition in b0.js warns about this:
    checkProximityInteractions returns early when a door is in range, so
    an NPC on a door tile can never be spoken to. Moved to (24,25), well
    outside DOOR_RADIUS_TILES (2.0).
"""

import json, os, re, shutil, subprocess, sys

RENAMES = [
    ('public/maps/village/tavern.json',
     'public/maps/village/villageHall.json'),
    ('js/game/scenes/locations/village/tavern.js',
     'js/game/scenes/locations/village/villageHall.js'),
]

# (path, [(old, new), ...]) -- applied only if `old` is still present.
EDITS = {
    'js/game/scenes/locations/village/villageHall.js': [
        ('// tavern.js\n// Location: js/game/scenes/locations/village/tavern.js',
         '// villageHall.js\n// Location: js/game/scenes/locations/village/villageHall.js'),
        ('const TAVERN_BARD_MODE = false', 'const HALL_BARD_MODE = false'),
        ('export default class TavernScene extends VillageScene',
         'export default class VillageHallScene extends VillageScene'),
        ("constructor() { super({ key: 'tavern' }) }",
         "constructor() { super({ key: 'villageHall' }) }"),
        ("getMapKey()      { return 'tavern' }",
         "getMapKey()      { return 'villageHall' }"),
        ('TavernScene.HEARTH_FLAME', 'VillageHallScene.HEARTH_FLAME'),
        ('!TAVERN_BARD_MODE', '!HALL_BARD_MODE'),
        ("'[tavern] bard mode held back (TAVERN_BARD_MODE = false)'",
         "'[villageHall] bard mode held back (HALL_BARD_MODE = false)'"),
    ],
    'js/game/scenes/locations/villageScene.js': [
        ("getMapKey()      { return 'tavern' }",
         "getMapKey()      { return 'villageHall' }"),
    ],
    'js/main.js': [
        ("import Tavern from './game/scenes/locations/village/tavern.js'",
         "import VillageHall from './game/scenes/locations/village/villageHall.js'"),
        ('Tavern,TestForest', 'VillageHall,TestForest'),
    ],
    'js/game/effects/roundhouseRenderer.js': [
        ("  tavern:   { wallH: 2.1,", "  roundhouse: { wallH: 2.1,"),
        ("// Round huts (tavern/dwelling):",
         "// Round huts (roundhouse/dwelling):"),
    ],
    'tools/map-editor/generators/gen_village_map.mjs': [
        ("//   mapData.houses   -- great hall at the crown, tavern-house, dwellings",
         "//   mapData.houses   -- great hall at the crown, kitchen, forge"),
        ("  { id: 'tavern',   kind: 'tavern',   x: 36, y: 23, r: 2.6, door: 'tavern' },",
         "  { id: 'kitchen',  kind: 'roundhouse', x: 36, y: 23, r: 2.0 },"),
    ],
}

# Comment-only mentions of a filename that will no longer exist.
COMMENT_FILES = [
    'js/game/scenes/locations/bog/b0.js',
    'js/game/scenes/locations/baseLocationScene.js',
    'js/game/effects/storyVisuals.js',
    'js/game/scenes/locations/village/corraHarp.js',
    'js/game/systems/voice/voiceSynth.js',
    'js/game/systems/music/bardAccompaniment.js',
    'js/game/systems/music/bardHarmonizer.js',
    'js/game/systems/music/harpPhrasePlayer.js',
]

MOR_POS    = (30, 23)
CORMAC_POS = (24, 25)


def move(src, dst):
    if os.path.exists(dst):
        return False
    if not os.path.exists(src):
        sys.exit(f'  [FAIL] neither {src} nor {dst} exists')
    try:
        subprocess.run(['git', 'mv', src, dst], check=True,
                       capture_output=True)
    except Exception:
        shutil.move(src, dst)
    return True


def apply_edits(path, pairs):
    if not os.path.exists(path):
        return 0
    src = open(path).read()
    n = 0
    for old, new in pairs:
        if old in src:
            src = src.replace(old, new)
            n += 1
    if n:
        open(path, 'w').write(src)
    return n


def main():
    if not os.path.exists('js/main.js'):
        sys.exit('run from repo root')

    for a, b in RENAMES:
        print(f'  [{"ok" if move(a, b) else "skip"}]   {os.path.basename(a)}'
              f' -> {os.path.basename(b)}')

    for path, pairs in EDITS.items():
        n = apply_edits(path, pairs)
        print(f'  [{"ok" if n else "skip"}]   {path} ({n} edits)')

    n = 0
    for path in COMMENT_FILES:
        n += apply_edits(path, [('tavern.js', 'villageHall.js'),
                                ("the tavern's interior", "the hall's interior"),
                                ('the tavern is meant to', 'the hall is meant to'),
                                ("the tavern's", "the hall's"),
                                ('the tavern', 'the village hall'),
                                ('tavern scene', 'village hall scene'),
                                ('The tavern bard', 'The hall bard'),
                                ('tavern + one dwelling hut', 'kitchen + one forge hut'),
                                ('longhall / tavern / dwelling', 'longhall / roundhouse / dwelling')])
    print(f'  [{"ok" if n else "skip"}]   comment references ({n} files)')

    # ── hall map ─────────────────────────────────────────────────────────
    p = 'public/maps/village/villageHall.json'
    d = json.load(open(p))
    ch = []
    if d.get('name') != 'villageHall':
        d['name'] = 'villageHall'; ch.append('name')
    for door in d.get('doors', []):
        if door.get('id') == 'tavern_exit':
            door['id'] = 'hall_exit'; ch.append('exit id')
        if door.get('entryEdge') == 'fromTavern':
            door['entryEdge'] = 'fromVillageHall'; ch.append('entryEdge')
    if ch:
        json.dump(d, open(p, 'w'), indent=2)
    print(f'  [{"ok" if ch else "skip"}]   villageHall.json ({", ".join(ch) or "already"})')

    # ── b0 ───────────────────────────────────────────────────────────────
    p = 'public/maps/bogMaps/b0.json'
    d = json.load(open(p))
    ch = []

    for h in d.get('houses', []):
        if h.get('door') == 'tavern':
            h['door'] = 'villageHall'; ch.append('longhall door')
        if h.get('id') == 'tavern':
            h['id'] = 'kitchen'; h['kind'] = 'roundhouse'; ch.append('kitchen')
        elif h.get('id') == 'house_1':
            h['id'] = 'forge'; ch.append('forge')

    for door in d.get('doors', []):
        if door.get('destination') == 'tavern':
            door['destination'] = 'villageHall'; ch.append('destination')
        if door.get('id') == 'tavern_door':
            door['id'] = 'hall_door'; ch.append('door id')

    if 'fromTavern' in d.get('entries', {}):
        d['entries']['fromVillageHall'] = d['entries'].pop('fromTavern')
        ch.append('fromVillageHall')

    feats = d.get('features', [])
    if any(f.get('id') == 'firepit' for f in feats):
        d['features'] = [f for f in feats if f.get('id') != 'firepit']
        ch.append('firepit deleted')

    if ch:
        json.dump(d, open(p, 'w'), indent=2)
    print(f'  [{"ok" if ch else "skip"}]   b0.json ({", ".join(ch) or "already"})')

    # ── b0 content: stranded NPCs ────────────────────────────────────────
    p = 'public/data/bog/b0.js'
    src = open(p).read()
    n = 0
    src = src.replace(
        '      // BESIDE the tavern door, not on it.',
        '      // BESIDE the hall door, not on it.', 1)
    src = src.replace('tavern-hut door at (36,26)', 'hut door at (36,26)', 1)
    old_mor = "      x: 34, y: 26,\n      radius: 3,"
    if old_mor in src:
        src = src.replace(old_mor,
            f"      // HOLDING POSITION. She was at (34,26), beside the old\n"
            f"      // hut door at (36,26), which no longer exists. She\n"
            f"      // belongs inside the hall greeting on entry -- this is just\n"
            f"      // somewhere reachable until that mechanism is built.\n"
            f"      x: {MOR_POS[0]}, y: {MOR_POS[1]},\n      radius: 3,", 1)
        n += 1
    old_cormac = "      name: 'Cormac',\n      x: 28, y: 21,"
    if old_cormac in src:
        src = src.replace(old_cormac,
            f"      name: 'Cormac',\n"
            f"      // Was (28,21) -- which became the hall's door tile exactly,\n"
            f"      // so the door badge won every frame and he could never be\n"
            f"      // spoken to. See the note on Mór above about door proximity\n"
            f"      // taking precedence. DOOR_RADIUS_TILES is 2.0.\n"
            f"      x: {CORMAC_POS[0]}, y: {CORMAC_POS[1]},", 1)
        n += 1
    if n:
        open(p, 'w').write(src)
    print(f'  [{"ok" if n else "skip"}]   b0.js NPC placements ({n} moved)')


if __name__ == '__main__':
    print('rename tavern -> villageHall:')
    main()
    print('done. rebuild with:')
    print('  NODE_OPTIONS=--max-old-space-size=3072 npm run build')

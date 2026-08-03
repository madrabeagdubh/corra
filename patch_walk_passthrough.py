#!/usr/bin/env python3
"""
patch_walk_passthrough.py -- Corra: `walk` survives content loading.

THE BUG: _loadContent() does not pass fixedEncounter entries through -- it
builds a NEW object with an explicit whitelist of fields (id, type, x, y,
stateKey, visual, portrait, radius, dialogues). Anything not on that list is
silently dropped. `walk` was not on it, so createObjects() never saw a walk
path, no walker was ever registered, and the figure stood still no matter
what the content said.

This is the third time this whitelist has bitten: `radius` and `portrait`
both had to be added to it. Rather than add `walk` and wait for a fourth,
the mapping now spreads the whole encounter and overrides only the fields
it genuinely needs to compute. New content properties then work without a
code change.

Run from the repo root:  python3 patch_walk_passthrough.py
Idempotent; aborts without writing if expected text is missing.
"""
import io, os, sys

ROOT = os.getcwd()
def read(p):
    with io.open(os.path.join(ROOT, p), encoding='utf-8') as f: return f.read()
def write(p, s):
    with io.open(os.path.join(ROOT, p), 'w', encoding='utf-8') as f: f.write(s)

def sub_once(src, old, new, label, sentinel=None):
    if sentinel is None:
        added = [ln for ln in new.split('\n') if ln.strip() and ln not in old]
        sentinel = max(added, key=len) if added else None
    if sentinel and sentinel in src:
        print('  = already applied: %s' % label); return src
    if old not in src:
        print('  ! NOT FOUND: %s\n    aborting, nothing written' % label); sys.exit(1)
    if src.count(old) != 1:
        print('  ! AMBIGUOUS (%d matches): %s' % (src.count(old), label)); sys.exit(1)
    print('  + %s' % label)
    return src.replace(old, new, 1)

P = 'js/game/scenes/locations/bogScene.js'
src = read(P)
print(P)

OLD = """        this.mapData.objects.push({
          id:        enc.id,
          type:      'fixed_encounter',
          x:         enc.x,
          y:         enc.y,
          stateKey:  `${mapKey}.${enc.id}`,
          visual:    enc.visual || { gid: 255, flat: false },
          portrait:  enc.portrait,          // card portrait URL (see encounterPanel)
          radius:    enc.radius,
          dialogues: enc.dialogues || [],
        })"""
NEW = """        // Spread the whole encounter, then override only what has to be
        // computed. The previous version listed fields explicitly, which
        // meant every new content property was silently dropped until
        // someone remembered to add it here -- `radius`, `portrait` and
        // `walk` were all lost that way in turn. Spreading makes the
        // default "content passes through", which is the safer direction
        // for a data-driven format.
        this.mapData.objects.push({
          ...enc,
          type:      'fixed_encounter',
          stateKey:  `${mapKey}.${enc.id}`,
          visual:    enc.visual || { gid: 255, flat: false },
          dialogues: enc.dialogues || [],
        })"""
src = sub_once(src, OLD, NEW, 'fixed encounters pass through whole')
write(P, src)

print('\nDone.')

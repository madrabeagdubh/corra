#!/usr/bin/env python3
"""
patch_northpreview_crash.py -- Corra: fix north-preview trunk crash.

TypeError: Cannot read properties of undefined (reading '_rowToScreenY')
on entering any map that has forest trunks AND a north neighbour with a
wallMask (e.g. rowing d3_sea -> d3, whose north neighbour is d2).

pgrNorthPreview.js is one of the modules split out of PGR as plain
exported functions -- there is no instance, so `this` is undefined in an
ES module. The trunk draw call passed `this` where drawTrunk() expects
the PGR instance. Every other call in the file correctly uses `pgr`.

_computeTrunkAnchor() reads pgr._rowToScreenY?.(row): the ?. guards the
CALL, not the property read on an undefined object -- hence the error.

Pre-existing bug, unrelated to the quest/dialogue work.

Also adds a defensive guard in drawTrunk() so a bad pgr argument returns
quietly instead of taking the render loop down with it.

Run from the repo root:  python3 patch_northpreview_crash.py
Idempotent; aborts without writing if expected text is missing.
"""
import io, os, sys

ROOT = os.getcwd()
def read(p):
    with io.open(os.path.join(ROOT, p), encoding='utf-8') as f: return f.read()
def write(p, s):
    with io.open(os.path.join(ROOT, p), 'w', encoding='utf-8') as f: f.write(s)

def sub_once(src, old, new, label):
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

# ------------------------------------------------------------- the actual fix
P = 'js/game/effects/pgr/pgrNorthPreview.js'
src = read(P)
print(P)
OLD = """        pgr._forestEffects.drawTrunk(pgr._gCtx, trunk, this, playerTileRow, edgeAlpha)"""
NEW = """        // `pgr`, not `this` -- this module is plain exported functions, so
        // `this` is undefined here (ES module strict mode) and drawTrunk()
        // needs the PGR instance to project rows to screen space.
        pgr._forestEffects.drawTrunk(pgr._gCtx, trunk, pgr, playerTileRow, edgeAlpha)"""
src = sub_once(src, OLD, NEW, 'pass pgr instead of this to drawTrunk')
write(P, src)

# ------------------------------------------------------------ defensive guard
P = 'js/game/effects/forestEffects.js'
src = read(P)
print(P)
OLD = """  _computeTrunkAnchor(trunk, pgr) {
    const anchorRow = trunk.ty + ForestEffects.TRUNK_ROW_ANCHOR_OFFSET"""
NEW = """  _computeTrunkAnchor(trunk, pgr) {
    // A missing pgr should not take the whole render loop down -- the
    // existing ?. calls below guard the CALLS but not the property reads,
    // so an undefined pgr still threw. One frame of missing trunks is a
    // far better failure than a dead scene.
    if (!pgr || !trunk) return null
    const anchorRow = trunk.ty + ForestEffects.TRUNK_ROW_ANCHOR_OFFSET"""
src = sub_once(src, OLD, NEW, 'guard _computeTrunkAnchor against a missing pgr')
write(P, src)

print('\nDone.')

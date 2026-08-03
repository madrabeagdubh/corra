#!/usr/bin/env python3
"""
patch_walker_trigger.py -- Corra: walkers start when the player can see them.

PROBLEM: a walker begins the moment the map loads. An eight-tile path at
1100ms a tile is finished in under nine seconds, which is less time than it
takes to row in from the map edge -- so by the time the figure is on screen
he has already arrived and is standing still. The motion, which is the whole
point of him, is never witnessed.

FIX: two new options on `walk`.

    startWhenNear: 14     // tiles. Hold at the first tile until the player
                          // is within this distance, then walk.
    pauseInDialogue: true // default. Do not stroll out of range mid-
                          // conversation.

startWhenNear is the important one. It converts "he walked before you got
here" into "he is walking as you arrive", which is what a player actually
reads as a living world. Leave it unset for a patrol that should be in
motion regardless.

Run from the repo root:  python3 patch_walker_trigger.py
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

OLD = """            elapsed: -(obj.walk.startDelayMs || 0),
            i: 0,
            dir: 1,"""
NEW = """            elapsed: -(obj.walk.startDelayMs || 0),
            i: 0,
            dir: 1,
            // Hold at the first tile until the player is this close, in
            // tiles. Without it a short path completes before the walker is
            // ever on screen, and the player only ever sees him standing.
            startWhenNear: obj.walk.startWhenNear ?? 0,
            started: !(obj.walk.startWhenNear > 0),
            pauseInDialogue: obj.walk.pauseInDialogue !== false,"""
src = sub_once(src, OLD, NEW, 'startWhenNear / pauseInDialogue options')

OLD = """    for (const w of this._walkers) {
      w.elapsed += delta
      if (w.elapsed < w.stepMs) continue
      w.elapsed -= w.stepMs"""
NEW = """    const px = this.player?.logicalX
    const py = this.player?.logicalY

    for (const w of this._walkers) {
      // Do not stroll out of range in the middle of a conversation.
      if (w.pauseInDialogue && this._encounterPanel?._isOpen) continue

      // Wait for the player to be close enough to witness the walk.
      if (!w.started) {
        if (px == null) continue
        const d = Phaser.Math.Distance.Between(px, py, w.zone.x, w.zone.y)
        if (d > w.startWhenNear * ts) continue
        w.started = true
      }

      w.elapsed += delta
      if (w.elapsed < w.stepMs) continue
      w.elapsed -= w.stepMs"""
src = sub_once(src, OLD, NEW, 'gate the walk on proximity and dialogue')
write(P, src)

print('\nDone.')

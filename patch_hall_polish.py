#!/usr/bin/env python3
"""
patch_hall_polish.py -- portico/door clearance, a lintel for the hall,
and the fix for the shadow going solid black when the player stands
still.

Run from repo root, AFTER patch_hall_door.py. Idempotent.

(1) DOOR TALLER THAN ITS PORTICO
    My fault, from the previous patch: doorH was set to 1.7 for the hall,
    but the portico canopy sits at style.wallH * 0.68 = 1.496, so the
    doorway punched up through its own lintel.

    Rather than a second hardcoded height that can drift out of step with
    doorH the way this just did, the canopy now takes whichever is
    greater: its old proportional height, or the door plus clearance. It
    cannot be shorter than its own doorway by construction. For the hall
    that lands at 2.05, comfortably under wallH 2.2, so the canopy still
    tucks below the eaves.

(2) SHADOW GOES SOLID BLACK WHEN IDLE
    PGR skips its whole redraw -- including _gCtx.clearRect() -- once the
    player has been stationary 8s with a static camera, unless the scene
    declares hasContinuousAnimation() (see the idle-skip block in
    perspectiveGroundRenderer update()). b0's update() calls
    super.update() and then drawOverlay() UNCONDITIONALLY, so on those
    skipped frames the overlay kept painting onto a canvas that was never
    cleared. SHADOW_COLOR is rgba(...,0.30), so it composited over itself
    every frame: 0.30, 0.51, 0.66, 0.83 ... effectively solid inside 0.2s
    at 60fps.

    The roofs escaped it because opaque thatch repaints that area each
    frame. The ground under the shadow is not repainted at all when PGR
    skips, so only the shadows accumulated -- which is exactly the
    symptom.

    Fixed by gating the overlay on whether PGR actually drew. NOT by
    giving b0 hasContinuousAnimation() -- that would defeat the battery
    saving to work around a bookkeeping problem, and the overlay genuinely
    has nothing to do on a frame where nothing else was drawn.

    Note onPGRDrawComplete is unaffected: PGR calls it from inside its own
    update, after the early return, so it already never fires on a skipped
    frame. b0's update() override was the only unguarded caller.

(3) PRESTIGE, LIGHTLY
    A lintel beam over the hall's door, in the trim colour already used
    for the gable ornaments, and slightly heavier portico posts. Gated on
    style.trim, which only the longhall defines, so the huts are
    untouched. Deliberately restrained -- a chieftain's hall, not a
    cathedral.
"""

import os, sys

RHOUSE = 'js/game/effects/roundhouseRenderer.js'
PGR    = 'js/game/effects/perspectiveGroundRenderer.js'
B0     = 'js/game/scenes/locations/bog/b0.js'


def edit(path, pairs, label):
    src = open(path).read()
    applied = False
    for marker, old, new in pairs:
        if marker in src:
            continue
        if old not in src:
            sys.exit(f'  [FAIL] anchor not found in {path}: {old[:60]}')
        src = src.replace(old, new, 1)
        applied = True
    if applied:
        open(path, 'w').write(src)
        print(f'  [ok]   {label}')
    else:
        print(f'  [skip] {label} already applied')


def main():
    # ── 1. portico clears its own doorway ────────────────────────────────
    edit(RHOUSE, [(
        'Math.max(style.wallH * 0.68',
        "    const ph  = style.wallH * 0.68",
        "    // Never shorter than the doorway it shelters. A fixed second\n"
        "    // constant drifted out of step with doorH the moment doorH was\n"
        "    // raised for the hall; this cannot.\n"
        "    const doorH = style.doorH ?? Math.min(1.3, style.wallH * 0.7)\n"
        "    const ph  = Math.max(style.wallH * 0.68, doorH + 0.35)",
    )], 'portico canopy clears the doorway')

    # ── 2. heavier posts for the hall ────────────────────────────────────
    edit(RHOUSE, [(
        'style.postW ??',
        "    const postW = 0.12",
        "    const postW = style.postW ?? 0.12",
    )], 'portico post width is style-driven')

    edit(RHOUSE, [(
        'postW: 0.17',
        "    doorH: 1.7,\n",
        "    doorH: 1.7,\n    postW: 0.17,\n",
    )], 'longhall gets heavier portico posts')

    # ── 3. lintel over the hall door ─────────────────────────────────────
    edit(RHOUSE, [(
        'lintelHalf',
        "        this._fillQuad(ctx, gT0, gT1, gB1, gB0, DOOR_COLOR)",
        "        this._fillQuad(ctx, gT0, gT1, gB1, gB0, DOOR_COLOR)\n"
        "        // Lintel beam. Gated on style.trim, which only the longhall\n"
        "        // defines -- the dwellings keep their plain openings.\n"
        "        if (style.trim) {\n"
        "          const lintelHalf = doorHalf * 1.15, lintelH = 0.20\n"
        "          const lB0 = this._projectGround(pgr, cx - lintelHalf, doorY)\n"
        "          const lB1 = this._projectGround(pgr, cx + lintelHalf, doorY)\n"
        "          if (lB0 && lB1) {\n"
        "            this._fillQuad(ctx,\n"
        "              { x: lB0.x, y: lB0.y - (doorH + lintelH) * scale },\n"
        "              { x: lB1.x, y: lB1.y - (doorH + lintelH) * scale },\n"
        "              { x: lB1.x, y: lB1.y - doorH * scale },\n"
        "              { x: lB0.x, y: lB0.y - doorH * scale },\n"
        "              style.trim)\n"
        "          }\n"
        "        }",
    )], 'lintel beam over the hall door')

    # ── 4. PGR reports whether it drew ───────────────────────────────────
    edit(PGR, [(
        '_drewThisFrame',
        "        !bowAiming) return\n",
        "        !bowAiming) { this._drewThisFrame = false; return }\n",
    )], 'PGR records a skipped frame')

    edit(PGR, [(
        'this._drewThisFrame = true',
        "    if (this._player?.isMoving) this._lastMoveTime = now",
        "    // Read by scenes that draw their own overlay pass AFTER\n"
        "    // super.update() returns (b0's roundhouse roofs/shadows). Those\n"
        "    // run outside this function, so unlike onPGRDrawComplete they get\n"
        "    // no signal that the redraw -- and its clearRect -- was skipped,\n"
        "    // and painted translucent shadows onto an uncleared canvas until\n"
        "    // they went solid black.\n"
        "    this._drewThisFrame = true\n\n"
        "    if (this._player?.isMoving) this._lastMoveTime = now",
    )], 'PGR records a drawn frame')

    # ── 5. b0 gates its overlay ──────────────────────────────────────────
    edit(B0, [(
        '_drewThisFrame',
        "    if (this.roundhouses) this.roundhouses.drawOverlay(this.perspectiveGround, "
        "this.forestEffects._sw, this.forestEffects._sh)",
        "    // Only when PGR actually redrew this frame -- it skips entirely\n"
        "    // (clearRect included) after 8s idle with a static camera, and\n"
        "    // painting a 0.30-alpha ground shadow onto an uncleared canvas\n"
        "    // composites it toward solid black in a fraction of a second.\n"
        "    if (this.roundhouses && this.perspectiveGround?._drewThisFrame) {\n"
        "      this.roundhouses.drawOverlay(this.perspectiveGround, "
        "this.forestEffects._sw, this.forestEffects._sh)\n"
        "    }",
    )], 'b0 overlay gated on PGR having drawn')


if __name__ == '__main__':
    for p in (RHOUSE, PGR, B0):
        if not os.path.exists(p):
            sys.exit(f'{p} not found -- run from repo root')
    print('hall polish:')
    main()
    print('done. rebuild with:')
    print('  NODE_OPTIONS=--max-old-space-size=3072 npm run build')

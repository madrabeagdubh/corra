#!/usr/bin/env python3
"""
Landfall: the champion's fall is a quiet impact ring on the wet planks, not a dust cloud
(it is pouring; dust made no sense and was far too much).

  dustDash.js   new export impactRing(scene, box, count = 2): thin rings spread flat along the
                ground and fade. dustPuff is untouched (Uathach's dash, Conall's vanish).
  landfall.js   _collapse() uses impactRing instead of dustPuff.

Tuning is in the constants at the top of impactRing (size, thickness, alpha, timing).

Run from the repo root:   python3 patch_landfall_ring.py
Idempotent: running it again changes nothing.
"""
import os, sys

RING_FN = """\
// A quiet impact on wet ground (the fall at the landfall, in the rain): thin rings spreading flat along the
// ground, each fainter and slower than the last. No dust -- nothing here to raise it.
const RING = 0xdfe5e6
export function impactRing(scene, box, count = 2) {
  if (!box) return
  const W = Math.max(10, box.w * 1.5), H = W * 0.3         // flat: the ground seen from the side
  const LW = Math.max(1, box.w * 0.025)                    // the stroke scales with the ring, so it thins in then thickens out
  for (let i = 0; i < count; i++) {
    scene.time.delayedCall(i * 170, () => {
      const e = scene.add.ellipse(box.x, box.y - box.h * 0.04, W, H)
        .setStrokeStyle(LW, RING, 1).setScrollFactor(0).setDepth(16).setScale(0.3).setAlpha(0.42 - i * 0.14)
      scene.tweens.add({
        targets: e, scale: 1.5 + i * 0.35, alpha: 0,
        duration: 950 + i * 250, ease: 'Sine.easeOut',
        onComplete: () => e.destroy(),
      })
    })
  }
}

"""

EDITS = {
    "js/game/scenes/locations/skye/dustDash.js": [
        # insert impactRing just before speedLines (anchor kept whole so a second run is a no-op)
        ("export function speedLines(scene, box, ux, uy, ahead = false) {",
         RING_FN + "export function speedLines(scene, box, ux, uy, ahead = false) {"),
    ],
    "js/game/scenes/locations/skye/landfall.js": [
        ("//     propped at their angle. (Dust only where they fall.)",
         "//     propped at their angle. (Only a quiet ring where they fall: it is raining.)"),
        ("import { moveFigure, figureBox, dustPuff } from './dustDash.js'",
         "import { moveFigure, figureBox, impactRing } from './dustDash.js'"),
        ("  // Knees, then over onto the side, and a little dust.",
         "  // Knees, then over onto the side, and a quiet ring in the wet."),
        ("    dustPuff(sc, figureBox(sc, Math.floor(p.logicalX / ts), Math.floor(p.logicalY / ts)), 0.2, 8)",
         "    impactRing(sc, figureBox(sc, Math.floor(p.logicalX / ts), Math.floor(p.logicalY / ts)))"),
    ],
}


def main():
    changed = skipped = 0
    for path, edits in EDITS.items():
        if not os.path.isfile(path):
            sys.exit(f"ERROR: {path} not found - run this from the repo root")
        with open(path, "r", encoding="utf-8", newline="") as f:
            src = f.read()
        out = src
        for old, new in edits:
            if new in out:
                skipped += 1
                continue
            if out.count(old) != 1:
                sys.exit(f"ERROR: {path}: expected exactly one match for:\n{old}\n(found {out.count(old)}) - file has drifted, nothing written for it")
            out = out.replace(old, new)
            changed += 1
        if out != src:
            with open(path, "w", encoding="utf-8", newline="") as f:
                f.write(out)
            print(f"patched  {path}")
        else:
            print(f"already  {path}")
    print(f"{changed} edit(s) applied, {skipped} already in place")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
patch_relayout_resize_race.py

Fixes overlapping/bunched Irish+English row pairs in the ogham dial's
poem column, seen after fullscreen now engages mid-dial (see
patch_early_fullscreen.py / patch_fullscreen_retry_every_touch.py).

WHY IT HAPPENED
relayout() stacks every row by measuring each one's real rendered height
via offsetHeight:

    const gh=r.ga.offsetHeight||34;
    const eh=r.en.offsetHeight||26;

It's re-run on the 'resize' event. A fullscreen transition fires resize,
but the DOM isn't guaranteed to have finished settling into its new
layout at the exact moment that event fires -- if relayout() measures
mid-transition, offsetHeight can still read 0 for every row, and every
single pair silently falls back to the same small hardcoded heights
(34/26px) instead of their true, often multi-line-wrapped heights. Since
relayout() only runs again on a FURTHER resize, and fullscreen settling
doesn't necessarily fire one, the botched stacking sticks for the rest of
the poem -- which is exactly the bunched-together text in the screenshot.

THE FIX, two parts:
  1. relayout() now checks whether measurement looks trustworthy (the
     reading frame itself has real height, and at least the first row
     measured something nonzero) before committing to it. If not, it
     retries on the next animation frame instead of baking in fallback
     numbers for the rest of the poem.
  2. The resize listener defers to a double requestAnimationFrame before
     calling relayout(), so the common case (an ordinary resize) measures
     after layout has actually settled, rather than relying solely on
     relayout()'s own retry to catch it.

Idempotent: guarded on relayout()'s new "not ready yet" check.
"""
import sys
from pathlib import Path

TARGET = Path("js/introOghamDial.js")

OLD_RELAYOUT = """      function relayout(){
        const H=$('read').clientHeight||300;
        let y=0;
        rows.forEach((r,i)=>{
          r.ga.style.top=y+'px';
          const gh=r.ga.offsetHeight||34;
          r.en.style.top=(y+gh+PAIR_GAP)+'px';
          const eh=r.en.offsetHeight||26;
          r.y=y+gh/2;                      // the pair's anchor, for scrolling
          y += gh + PAIR_GAP + eh + BLOCK_GAP;
        });
      }"""

NEW_RELAYOUT = """      function relayout(){
        /* A resize (fullscreen engaging, among other things) can fire before the
           DOM has actually settled into its new layout. Measuring at that exact
           moment reads offsetHeight as 0 for every row, and each one silently
           falls back to a small hardcoded height below -- bunching every pair
           together, since relayout() otherwise only re-runs on a FURTHER resize
           that may never come. If the reading frame itself has no real height
           yet, or the first row measures nothing, this isn't a real 34px line --
           it's an unmeasured one. Retry next frame instead of committing to it. */
        const rawH = $('read').clientHeight;
        if(!rawH || (rows.length && !rows[0].ga.offsetHeight)){
          requestAnimationFrame(relayout);
          return;
        }
        const H=rawH||300;
        let y=0;
        rows.forEach((r,i)=>{
          r.ga.style.top=y+'px';
          const gh=r.ga.offsetHeight||34;
          r.en.style.top=(y+gh+PAIR_GAP)+'px';
          const eh=r.en.offsetHeight||26;
          r.y=y+gh/2;                      // the pair's anchor, for scrolling
          y += gh + PAIR_GAP + eh + BLOCK_GAP;
        });
      }"""

OLD_RESIZE = "addEventListener('resize',()=>relayout());"
NEW_RESIZE = ("addEventListener('resize',()=>{\n"
              "        // Two frames' grace: the same mid-transition race relayout() itself\n"
              "        // now guards against, but caught here too so the common case (an\n"
              "        // ordinary resize, not just fullscreen) measures post-settle on the\n"
              "        // first try rather than relying on relayout()'s own retry.\n"
              "        requestAnimationFrame(()=>requestAnimationFrame(relayout));\n"
              "      });")


def patch(text):
    changed = False

    if "isn't a real 34px line" in text:
        print("  - relayout(): already made resize-safe, skipping")
    elif OLD_RELAYOUT not in text:
        print("  ! relayout() marker not found -- check by hand")
    else:
        text = text.replace(OLD_RELAYOUT, NEW_RELAYOUT, 1)
        changed = True
        print("  - relayout(): now retries instead of committing zero-height measurements")

    if "Two frames' grace" in text:
        print("  - resize listener: already deferred, skipping")
    elif OLD_RESIZE not in text:
        print("  ! resize listener marker not found -- check by hand")
    else:
        text = text.replace(OLD_RESIZE, NEW_RESIZE, 1)
        changed = True
        print("  - resize listener: now waits two frames before calling relayout()")

    return text, changed


def main():
    if not TARGET.exists():
        print(f"Can't find {TARGET} -- run this from the repo root.")
        sys.exit(1)

    original = TARGET.read_text()
    patched, changed = patch(original)

    if changed:
        TARGET.write_text(patched)
        print(f"Patched {TARGET}")
    else:
        print("Nothing to do -- already applied.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
patch_relayout_culled_rows.py

Follow-up to patch_relayout_resize_race.py. That patch fixed relayout()
measuring mid-transition, before the DOM had settled after a resize. This
fixes a separate, more general problem with the same symptom (bunched-up
pairs): rows far from the current reading position are set display:none
by the carving loop in frame() as a perf optimisation --

    const vis = Math.abs(r.y - _mid) < _rh*1.25 ? '' : 'none';
    if(r._vis!==vis){ r._vis=vis; r.ga.style.display=vis; ... }

-- and a display:none element always reports offsetHeight 0, by
definition, regardless of whether the browser has "settled." So if
relayout() reruns on ANY resize (not just a fullscreen one -- a phone
rotation, any ordinary window resize) while several rows are legitimately
culled partway through the poem, it measures those rows as 0-height and
they fall back to the same small hardcoded numbers, corrupting spacing
for the rest of the poem -- independent of fullscreen entirely.

Fix: relayout() now forces every row visible before measuring, then
invalidates each row's cached _vis so the very next frame() tick
recomputes and reapplies the CORRECT visibility from scratch, rather than
trusting a stale comparison against a state relayout() just overwrote out
from under it.

Idempotent: guarded on the new "force visible before measuring" comment.
"""
import sys
from pathlib import Path

TARGET = Path("js/introOghamDial.js")

OLD = """      function relayout(){
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
          r.y=y+gh/2;                      // the pair's anchor, for scrolling"""

NEW = """      function relayout(){
        /* A resize (fullscreen engaging, among other things) can fire before the
           DOM has actually settled into its new layout. Measuring at that exact
           moment reads offsetHeight as 0 for every row, and each one silently
           falls back to a small hardcoded height below -- bunching every pair
           together, since relayout() otherwise only re-runs on a FURTHER resize
           that may never come. If the reading frame itself has no real height
           yet, or the first row measures nothing, this isn't a real 34px line --
           it's an unmeasured one. Retry next frame instead of committing to it. */
        const rawH = $('read').clientHeight;
        if(!rawH){
          requestAnimationFrame(relayout);
          return;
        }
        /* Separately: rows far from the current reading position are
           display:none, culled by the carving loop below as a perf
           optimisation -- and a display:none element always reports
           offsetHeight 0, on principle, not because anything is unsettled.
           relayout() can rerun mid-poem on ANY resize, fullscreen or not, by
           which point several rows are legitimately culled -- so force
           everything visible for the measurement, regardless of the reading
           position at the moment this runs. */
        rows.forEach(r=>{ r.ga.style.display=''; r.en.style.display=''; });
        if(rows.length && !rows[0].ga.offsetHeight){
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
          /* Invalidate the cached visibility so the carving loop's own
             culling (frame(), below) is FORCED to recompute and reapply the
             real display for this row on its very next tick, rather than
             comparing against a value relayout() just overwrote without its
             knowledge and concluding (wrongly) that nothing changed. */
          r._vis=null;"""


def patch(text):
    if "regardless of the reading\n           position at the moment this runs" in text:
        print("  - relayout(): already immune to culled rows, skipping")
        return text, False

    if OLD not in text:
        print("  ! marker not found -- has patch_relayout_resize_race.py "
              "been applied first? check by hand")
        return text, False

    text = text.replace(OLD, NEW, 1)
    print("  - relayout(): now forces rows visible before measuring, "
          "and invalidates cached visibility afterward")
    return text, True


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

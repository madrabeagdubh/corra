#!/usr/bin/env python3
"""
patch_fullscreen_retry_every_touch.py  (v2)

Same intent as before: stop gating the onFirstTouch hook to only the very
first touch, and call it on every down() instead, since the very first
touch's fullscreen request was observed getting rejected ("Permissions
check failed") for reasons that don't reproduce on later touches.
_requestFullscreen()/_unlockAudio() are already safe to call repeatedly.

v2 fixes a marker mismatch: patch_fullscreen_diagnostics.py (if applied)
wraps the onFirstTouch call in console.log/console.warn, and v1 of this
script only matched the undiagnosed line. This version matches BOTH the
diagnosed and undiagnosed forms, so it works regardless of which order
patch_early_fullscreen.py / patch_fullscreen_diagnostics.py were applied
in, or whether diagnostics were applied at all.

Idempotent: guarded on the post-patch call site being outside the
`if(!started)` block.
"""
import sys
from pathlib import Path

TARGET = Path("js/introOghamDial.js")

HEAD = """        if(!started){ started=true;
          /* Held at 0 the whole time they were watching, so this changes nothing
             today. Left in as a guarantee: whatever moves arc in future, the poem
             still begins at the beginning. */
          arc=0;
          if(audioCtx&&audioCtx.state==='suspended') audioCtx.resume();
          tone(174,.09,1.8);
          /* Fullscreen (and anything else gated on a first real gesture) wants to
             happen HERE, not on whatever later touch first reaches the Phaser
             canvas -- #ogd-root covers the whole viewport and catches every touch
             while the dial is up, so a canvas-level listener can't fire until this
             module is gone. Calling the hook synchronously, inside the same
             touchstart/pointerdown this handler is itself responding to, keeps it
             inside a real user gesture, which the Fullscreen API requires. */
          """

# The two forms the final line can take: with diagnostics, or without.
LINE_PLAIN = "if(opts.onFirstTouch){ try{ opts.onFirstTouch() }catch(x){} } }"
LINE_DIAGNOSED = ("if(opts.onFirstTouch){ console.log('[ogd] dial: first touch, calling onFirstTouch'); "
                   "try{ opts.onFirstTouch() }catch(x){ console.warn('[ogd] onFirstTouch threw:', x) } } }")

REASON_COMMENT = """/* Fullscreen (and anything else gated on a first real gesture) wants to
           happen HERE, not on whatever later touch first reaches the Phaser
           canvas -- #ogd-root covers the whole viewport and catches every touch
           while the dial is up, so a canvas-level listener can't fire until this
           module is gone.

           Called on EVERY down(), not just the first: field testing found the
           very first touch's fullscreen request gets rejected ("Permissions
           check failed" -- Chromium's error for missing transient user
           activation) for reasons that don't reproduce on later touches, even
           though this call is synchronous inside a real touchstart/pointerdown
           handler. Rather than chase that down further, the hook itself
           (_requestFullscreen/_unlockAudio on the introModal side) is already
           safe to call repeatedly -- it no-ops once it has succeeded -- so
           retrying on every press costs nothing and gives several chances to
           land inside a request the browser actually honours, still far
           earlier than waiting for the dial to be gone entirely. */"""


def build_old_new(line_variant):
    old = HEAD + line_variant + "\n      }"
    inner_call = line_variant[:-2]  # strip the trailing " }" that closed the if(!started) block
    new = ("""        if(!started){ started=true;
          /* Held at 0 the whole time they were watching, so this changes nothing
             today. Left in as a guarantee: whatever moves arc in future, the poem
             still begins at the beginning. */
          arc=0;
          if(audioCtx&&audioCtx.state==='suspended') audioCtx.resume();
          tone(174,.09,1.8);
        }
        """ + REASON_COMMENT + "\n        " + inner_call + "\n      }")
    return old, new


def patch(text):
    if "Called on EVERY down(), not just the first" in text:
        print("  - retry-every-touch: already applied, skipping")
        return text, False

    for variant_name, line_variant in (("diagnosed", LINE_DIAGNOSED), ("plain", LINE_PLAIN)):
        old, new = build_old_new(line_variant)
        if old in text:
            text = text.replace(old, new, 1)
            print(f"  - onFirstTouch hook ({variant_name} form): now retried on every touch")
            return text, True

    print("  ! marker not found in either diagnosed or plain form -- "
          "has patch_early_fullscreen.py been applied? check by hand")
    return text, False


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
        print("Nothing to do.")


if __name__ == "__main__":
    main()

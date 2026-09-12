#!/usr/bin/env python3
"""
patch_page_load_fade.py

Smooths the very first thing the player sees. The page background is
already a consistent dark colour from the first paint (`html { background:
#070b0a }`), so there's no white-flash problem to fix -- what actually
happens is the starfield and hero-select UI appear instantly, fully
populated and already twinkling/animating, with no reveal at all.

Adds a solid #070b0a cover, the FIRST element in <body> so it is already
opaque before anything else paints, held through 'load' plus a couple of
animation frames (so the starfield has actually rendered at least once
underneath before the reveal starts), then faded to transparent over
1.1s and removed. The colour matches the background exactly, so nothing
about the initial dark screen changes -- only the moment the already-
running starfield and hero-select content becomes visible does.

Idempotent: guarded on the #page-load-fade element's presence.
"""
import sys
from pathlib import Path

TARGET = Path("index.html")

OLD = """<body>


	<div style="font-family: 'Aonchlo'; visibility: hidden; position: absolute;">
		</div>
  <div id="starfieldLoader">"""

NEW = """<body>

  <!-- Held opaque until the starfield/hero-select content underneath has
       actually rendered, then faded away -- see patch_page_load_fade.py.
       Same colour as the page background, so the initial dark screen looks
       identical; only the reveal of what's running underneath changes. -->
  <div id="page-load-fade" style="position:fixed;inset:0;z-index:2147483647;
    background:#070b0a;pointer-events:none;opacity:1;
    transition:opacity 1.1s ease;"></div>
  <script>
    window.addEventListener('load', () => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = document.getElementById('page-load-fade');
        if (!el) return;
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 1200);
      }));
    });
  </script>

	<div style="font-family: 'Aonchlo'; visibility: hidden; position: absolute;">
		</div>
  <div id="starfieldLoader">"""


def patch(text):
    if "page-load-fade" in text:
        print("  - page-load fade: already applied, skipping")
        return text, False

    if OLD not in text:
        print("  ! marker not found -- check by hand")
        return text, False

    text = text.replace(OLD, NEW, 1)
    print("  - page-load fade: added")
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

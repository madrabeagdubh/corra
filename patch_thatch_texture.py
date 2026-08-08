#!/usr/bin/env python3
"""
patch_thatch_texture.py -- swap the thatch PNGs for the generated
seamless swatches in js/game/effects/thatchTexture.js.

Run from repo root, AFTER dropping thatchTexture.js into
js/game/effects/. Idempotent: every edit checks for its own result first.

WHY
  assets/buildings/thatch1.png and thatch2.png were never swatches. They
  are Oryx-style roof STAMPS -- thatch1 is a chevron, thatch2 a hip-roof
  shape -- each with a hard dark outline baked into the image.
  _drawTiledQuad repeats its texture up to five times across the
  longhall (repU = round(w / TILE_TARGET) = round(7 / 1.3) = 5), so those
  stamps tiled into a grid of chevrons with the outlines colliding into
  the grey blotches visible on the roofs.

  The replacements are generated at construction rather than shipped as
  PNGs: the parameters are tunable in an editor with no image tool in the
  loop, the result is seamless by construction, and it draws
  synchronously so roofs are textured on frame one instead of popping in
  when an <img> load resolves.

NOTE
  thatch1.png and thatch2.png become unreferenced after this. They are
  left on disk deliberately -- delete them once you are happy with the
  generated look, not before. wall1/2/3.png were already unreferenced
  (walls are flat rgba fills); this does not change that either way.
"""

import os, sys

RHOUSE = 'js/game/effects/roundhouseRenderer.js'
TEXMOD = 'js/game/effects/thatchTexture.js'


def main():
    if not os.path.exists(RHOUSE):
        sys.exit(f'{RHOUSE} not found -- run from repo root')
    if not os.path.exists(TEXMOD):
        sys.exit(f'{TEXMOD} not found -- add the generator module first')

    with open(RHOUSE) as f:
        src = f.read()

    if 'thatchTexture.js' in src:
        print('  [skip] roundhouseRenderer.js already uses the generator')
        return

    # ── 1. header comment ────────────────────────────────────────────────
    old_doc = ("// thatch1/2.png are small (~110px) swatches, meant to repeat. "
               "_drawTiledQuad")
    if old_doc not in src:
        sys.exit('  [FAIL] thatch tiling doc block not found')
    src = src.replace(old_doc, (
        "// Swatches come from thatchTexture.js, generated seamless at\n"
        "// construction. They REPLACED thatch1/2.png, which were roof stamps\n"
        "// with baked-in outlines, not tileable swatches. _drawTiledQuad"), 1)

    # ── 2. import ────────────────────────────────────────────────────────
    anchor = "const THATCH_SRCS ="
    if anchor not in src:
        sys.exit('  [FAIL] THATCH_SRCS declaration not found')
    line_start = src.index(anchor)
    line_end = src.index('\n', line_start) + 1
    src = (src[:line_start]
           + "import { makeThatchCanvas, THATCH_VARIANTS } "
             "from './thatchTexture.js'\n"
           + src[line_end:])
    # Move it below the file's header comment block, matching how
    # pgrNorthPreview.js and the rest of the tree are laid out -- ES
    # imports hoist regardless, so this is purely for readability.
    imp = ("import { makeThatchCanvas, THATCH_VARIANTS } "
           "from './thatchTexture.js'\n")
    src = src.replace(imp, '', 1)
    lines = src.split('\n')
    i = 0
    while i < len(lines) and (lines[i].startswith('//') or not lines[i].strip()):
        i += 1
    lines.insert(i, imp.rstrip('\n'))
    lines.insert(i + 1, '')
    src = '\n'.join(lines)

    # ── 3. construction ──────────────────────────────────────────────────
    old_ctor = "this._thatch = THATCH_SRCS.map(src => this._loadTexture(src))"
    if old_ctor not in src:
        sys.exit('  [FAIL] _thatch construction line not found')
    src = src.replace(old_ctor, (
        "// Same { canvas } entry shape _loadTexture returned, so every\n"
        "    // `if (thatch.canvas)` call site below is untouched -- but built\n"
        "    // synchronously, so there is no null-canvas window on frame one.\n"
        "    this._thatch = THATCH_VARIANTS.map(v => "
        "({ canvas: makeThatchCanvas(v) }))"), 1)

    # ── 4. drop the now-dead loader ──────────────────────────────────────
    lo = src.index('  _loadTexture(src) {')
    hi = src.index('  _hashStr(s) {')
    src = src[:lo] + src[hi:]

    with open(RHOUSE, 'w') as f:
        f.write(src)

    print('  [ok]   roundhouseRenderer.js uses generated thatch')
    print('  [ok]   _loadTexture removed (was thatch-only, now dead)')


if __name__ == '__main__':
    print('thatch texture patch:')
    main()
    print('done. rebuild with:')
    print('  NODE_OPTIONS=--max-old-space-size=3072 npm run build')

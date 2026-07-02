#!/usr/bin/env python3
# apply_occlusion_fade.py
# Applies the three globalAlpha edits to perspectiveGroundRenderer.js's
# _drawPlayerAnimated method. Each replacement is checked to occur EXACTLY
# ONCE before any file write happens -- if any anchor is missing or
# duplicated, the script aborts with no changes made, rather than guessing.

import sys
from pathlib import Path

path = Path("js/game/effects/perspectiveGroundRenderer.js")

if not path.exists():
    print(f"ERROR: {path} not found. Run this from your project root (~/Corra).")
    sys.exit(1)

text = path.read_text()

edits = [
    (
        "  _drawPlayerAnimated(ctx, img, screenX, screenY, scaledTileW, heightMult) {\n    if (!img) return\n",
        "  _drawPlayerAnimated(ctx, img, screenX, screenY, scaledTileW, heightMult) {\n    if (!img) return\n    ctx.globalAlpha = this._playerOcclusionAlpha ?? 1\n",
    ),
    (
        "        ctx.drawImage(img, 0, 0, img.width, img.height * (_cropH0ns / H), -W/2, -H + _sink0ns, W, _cropH0ns)\n        ctx.restore()\n        return\n",
        "        ctx.drawImage(img, 0, 0, img.width, img.height * (_cropH0ns / H), -W/2, -H + _sink0ns, W, _cropH0ns)\n        ctx.restore()\n        ctx.globalAlpha = 1\n        return\n",
    ),
    (
        "    ctx.drawImage(img, 0, 0, img.width, img.height * (_cropH / H), -W/2, -H + _sink, W, _cropH)\n    ctx.restore()\n  }\n",
        "    ctx.drawImage(img, 0, 0, img.width, img.height * (_cropH / H), -W/2, -H + _sink, W, _cropH)\n    ctx.restore()\n    ctx.globalAlpha = 1\n  }\n",
    ),
]

# Verify every anchor appears exactly once BEFORE writing anything.
for i, (old, _new) in enumerate(edits, 1):
    count = text.count(old)
    if count != 1:
        print(f"ABORT: edit {i} anchor found {count} time(s), expected exactly 1. No changes written.")
        print("----- anchor text -----")
        print(old)
        sys.exit(1)

for old, new in edits:
    text = text.replace(old, new, 1)

backup = path.with_suffix(path.suffix + ".bak")
backup.write_text(path.read_text())
path.write_text(text)

print(f"Applied 3 edits to {path}")
print(f"Backup saved to {backup} (delete once you've confirmed it works)")

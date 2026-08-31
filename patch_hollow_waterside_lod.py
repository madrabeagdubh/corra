#!/usr/bin/env python3
"""
patch_hollow_waterside_lod.py

Fixes elevated/shoreline terrain appearing "hollow" (a visible green/blue
checkerboard) as the player moves away from it.

Root cause, confirmed by extracting the actual tile from the tileset image
(public/assets/oryx/oryx_16bit_fantasy_world_trans.png) rather than
guessing from rendering logic alone: gid 731 -- labelled "waterside" in
the map's own legend, the sloping bank tile where grass meets water -- has
a source texture that's a fine PER-PIXEL dither blend of green and blue,
not the coarser blocky colour regions most tiles use. Under this game's
deliberate nearest-neighbour rendering (pixelArt: true, needed for the art
style everywhere else), that fine dither aliases into a visible chunky
checkerboard as soon as the tile is minified below its native size --
i.e. as soon as the player is more than a few tiles away, well before the
existing LOD system's flat-fill fallback kicks in.

The engine already has an LOD system built for exactly this class of
problem (_lodFillQuad in perspectiveGroundRenderer.js: swap to a flat
average-colour fill once a row's on-screen height drops below
LOD_MIN_ROW_PX, "where the texture couldn't be seen anyway"). That
default threshold (6px) is calibrated for normal tiles, whose coarser
detail doesn't alias until genuinely tiny on-screen. gid 731's much finer
detail needs a substantially higher threshold to flatten before it
aliases. This patch gives gid 731 its own 40px threshold at both call
sites (the phantom-tile branch and the main ground-tile branch) while
leaving every other GID's behaviour completely unchanged.

NOT YET VISUALLY CONFIRMED -- this is a well-evidenced hypothesis (the
bank-face drawing module was checked and ruled out; it does no texture
sampling at all, only solid gradient fills), but please test against the
same idle-boat-moving-away scenario from the recording before considering
this closed.

Idempotent: safe to run more than once.

Run from the repo root:
    python3 patch_hollow_waterside_lod.py
"""
from pathlib import Path

ROOT = Path.cwd()
TARGET = "js/game/effects/perspectiveGroundRenderer.js"


def patch(old: str, new: str, label: str, text: str) -> str:
    if new in text:
        print(f"• {label}: already applied, skipping")
        return text
    if old not in text:
        print(f"✗ {label}: expected text not found -- file has drifted, "
              f"apply by hand (see patch source for the exact block)")
        return text
    count = text.count(old)
    if count > 1:
        print(f"✗ {label}: match is not unique ({count}x) -- apply by hand")
        return text
    print(f"✓ {label}")
    return text.replace(old, new, 1)


path = ROOT / TARGET
if not path.exists():
    print(f"✗ {TARGET} does not exist -- run this from the repo root")
    raise SystemExit(1)

text = path.read_text(encoding="utf-8")

# ---------------------------------------------------------------------------
# 1. Phantom-tile branch (mGid)
# ---------------------------------------------------------------------------

OLD_PHANTOM = """              this._gCtx.globalAlpha = horizonFade
              // LOD: phantom tiles are the single biggest contributor to
              // the distant-row column explosion (they fill everything
              // beyond the map edge), so the flat-fill path matters most
              // here. Falls back to the textured draw if the average
              // colour isn't ready yet.
              if (!lodRow || !this._lodFillQuad(this._gCtx, mGid, mTint, horizonFade, _pTL, _pTR, _pBL, _pBR)) {
                this._drawTrapezoidTinted(this._gCtx, mGid, _pTL, _pTR, _pBL, _pBR, mTint)
              }
              this._gCtx.globalAlpha = 1.0
            }
          }"""

NEW_PHANTOM = """              this._gCtx.globalAlpha = horizonFade
              // LOD: phantom tiles are the single biggest contributor to
              // the distant-row column explosion (they fill everything
              // beyond the map edge), so the flat-fill path matters most
              // here. Falls back to the textured draw if the average
              // colour isn't ready yet.
              //
              // gid 731 ("waterside" sloping bank) gets its own, much
              // higher threshold: its source texture is a fine per-pixel
              // dither blend (confirmed by inspecting the tileset image
              // directly) rather than the coarser blocky colour regions
              // most tiles use, so nearest-neighbour minification aliases
              // it into a visible checkerboard well before it's small
              // enough to trip the general LOD_MIN_ROW_PX cutoff -- the
              // "hollow"-looking terrain reported at a distance. A flat
              // average-colour fill is visually equivalent to this tile's
              // intended soft blend look, so flattening it sooner costs
              // nothing.
              {
                const _rowPxHere = yBotClamped - yTopClamped
                const _lodMinHere = mGid === 731 ? 40 : PerspectiveGroundRenderer.LOD_MIN_ROW_PX
                const _lodRowHere = lodRow || _rowPxHere < _lodMinHere
                if (!_lodRowHere || !this._lodFillQuad(this._gCtx, mGid, mTint, horizonFade, _pTL, _pTR, _pBL, _pBR)) {
                  this._drawTrapezoidTinted(this._gCtx, mGid, _pTL, _pTR, _pBL, _pBR, mTint)
                }
              }
              this._gCtx.globalAlpha = 1.0
            }
          }"""

text = patch(OLD_PHANTOM, NEW_PHANTOM, "perspectiveGroundRenderer.js: phantom-tile branch", text)

# ---------------------------------------------------------------------------
# 2. Main ground-tile branch (gid0)
# ---------------------------------------------------------------------------

OLD_GROUND = """            // LOD: same corner coords either way, so terrain contours
            // and elevation offsets are preserved -- only the interior
            // texture (invisible at this size) is replaced.
            if (!lodRow || !this._lodFillQuad(this._gCtx, gid0, tint0, tileAlpha, _qTL, _qTR, _qBL, _qBR)) {
              this._drawTrapezoidTinted(this._gCtx, gid0, _qTL, _qTR, _qBL, _qBR, tint0)
            }"""

NEW_GROUND = """            // LOD: same corner coords either way, so terrain contours
            // and elevation offsets are preserved -- only the interior
            // texture (invisible at this size) is replaced.
            //
            // gid 731 ("waterside" sloping bank) gets its own, much
            // higher threshold -- see the matching comment in the
            // phantom-tile branch above for why: its source texture is a
            // fine per-pixel dither that aliases into a visible
            // checkerboard ("hollow" terrain) at a distance well before
            // it's small enough to trip the general LOD cutoff.
            const _rowPxHere2 = yBotClamped - yTopClamped
            const _lodMinHere2 = gid0 === 731 ? 40 : PerspectiveGroundRenderer.LOD_MIN_ROW_PX
            const _lodRowHere2 = lodRow || _rowPxHere2 < _lodMinHere2
            if (!_lodRowHere2 || !this._lodFillQuad(this._gCtx, gid0, tint0, tileAlpha, _qTL, _qTR, _qBL, _qBR)) {
              this._drawTrapezoidTinted(this._gCtx, gid0, _qTL, _qTR, _qBL, _qBR, tint0)
            }"""

text = patch(OLD_GROUND, NEW_GROUND, "perspectiveGroundRenderer.js: main ground-tile branch", text)

path.write_text(text, encoding="utf-8")

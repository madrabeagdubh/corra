#!/usr/bin/env python3
"""
patch_cloak_fit.py -- Corra: cloak sized and pivoted explicitly.

PROBLEM: the cloak's height was derived from the source image's aspect
ratio (w * img.height / img.width). cape.png is a 162-byte placeholder, so
whatever odd aspect it happens to have was being multiplied up into a long
banner -- and once the shape is that long, the wind rotation about its top
edge swings the far end a long way sideways, which reads as "off centre"
even though the pivot is central.

FIX: the cloak is now sized as a fraction of the FIGURE's box, not the
image's. Two independent knobs, both in units of her sprite:

    widthFrac   0.8  -> cloak is 80% as wide as she is
    heightFrac  0.55 -> and 55% as tall

The source image is stretched to fit. A placeholder with a silly aspect now
looks wrong in colour only, not in size, and swapping in real art changes
nothing about the placement.

Pivot is stated explicitly rather than implied:
    pivotX  0.5 -> rotate about the horizontal centre of the cloak
    pivotY  0.0 -> and about its top edge, so it swings from the shoulders

And `debugAnchor: true` draws a small cross at the anchor point plus an
outline of the figure's box, which makes positioning a two-minute job
instead of a guessing game. Turn it off when you are happy.

Run from the repo root:  python3 patch_cloak_fit.py
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

# ----------------------------------------------------------------- npcCloak
P = 'js/game/effects/npcCloak.js'
src = read(P)
print(P)

OLD = """    this.shoulderX = opts.shoulderX ?? 0.5
    this.shoulderY = opts.shoulderY ?? 0.28"""
NEW = """    this.shoulderX = opts.shoulderX ?? 0.5
    this.shoulderY = opts.shoulderY ?? 0.28

    // Size as a fraction of HER box, not the image's aspect ratio. The
    // source is stretched to fit, so a placeholder with an odd aspect is
    // wrong in colour only, and real art drops in without re-tuning.
    this.widthFrac  = opts.widthFrac  ?? 0.80
    this.heightFrac = opts.heightFrac ?? 0.55

    // Pivot within the cloak itself: 0.5/0 = top centre, so it swings from
    // the shoulders rather than about its middle or a corner.
    this.pivotX = opts.pivotX ?? 0.5
    this.pivotY = opts.pivotY ?? 0.0

    this.debugAnchor = !!opts.debugAnchor"""
src = sub_once(src, OLD, NEW, 'explicit size and pivot options')

OLD = """    // shoulderX / shoulderY are fractions of the figure's own box.
    const x = rect.x + rect.w * this.shoulderX
    const y = rect.y + rect.h * this.shoulderY
    const w = rect.w * this.scale

    ctx.save()
    ctx.globalAlpha = this.alpha
    ctx.translate(x, y)
    ctx.rotate(rotation)
    ctx.scale(scaleX, scaleY)
    ctx.imageSmoothingEnabled = false
    // Hung from the top-centre of the cloak, so it swings from the shoulders
    // rather than pivoting about its middle.
    ctx.drawImage(this._img, -w / 2, 0, w, w * (this._img.height / this._img.width))
    ctx.restore()
  }"""
NEW = """    // Anchor: where on HER the cloak hangs from.
    const x = rect.x + rect.w * this.shoulderX
    const y = rect.y + rect.h * this.shoulderY

    // Size: fractions of her box. Aspect of the source image is ignored on
    // purpose -- see the constructor note.
    const w = rect.w * this.widthFrac
    const h = rect.h * this.heightFrac

    ctx.save()
    ctx.globalAlpha = this.alpha
    ctx.translate(x, y)
    ctx.rotate(rotation)
    ctx.scale(scaleX, scaleY)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(this._img, -w * this.pivotX, -h * this.pivotY, w, h)
    ctx.restore()

    if (this.debugAnchor) {
      ctx.save()
      ctx.strokeStyle = 'rgba(0,255,255,0.9)'; ctx.lineWidth = 1
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)      // her box
      ctx.beginPath()
      ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y)
      ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5)
      ctx.strokeStyle = 'rgba(255,0,255,0.95)'
      ctx.stroke()                                        // the anchor point
      ctx.restore()
    }
  }"""
src = sub_once(src, OLD, NEW, 'size from her box, explicit pivot, debug overlay')
write(P, src)

# -------------------------------------------------------------------- d3Sea
P = 'js/game/scenes/locations/bog/d3Sea.js'
src = read(P)
print(P)
OLD = """      shoulderX: 0.5,     // centred on her
      shoulderY: 0.30,    // shoulder height, as a fraction of her sprite
      scale:     0.80,    // cloak width relative to her width"""
NEW = """      // Anchor on her: fractions of her sprite's box.
      shoulderX:  0.50,   // centred
      shoulderY:  0.30,   // shoulder height
      // Size: fractions of her sprite's box, NOT the image's aspect ratio.
      widthFrac:  0.80,
      heightFrac: 0.55,
      // Pivot within the cloak: top centre, so it swings from the shoulders.
      pivotX:     0.50,
      pivotY:     0.00,
      // Set true to draw her bounding box and the anchor cross. Makes
      // positioning a two-minute job; turn it off when happy.
      debugAnchor: false,"""
src = sub_once(src, OLD, NEW, 'cloak geometry in the scene config')
write(P, src)

print('\nDone.')

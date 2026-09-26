#!/usr/bin/env python3
"""patch_muted_plainpan_pixelwater.py -- three last touches.

1. A MUTED, WASHED-OUT PALETTE (nightPalette.js). One knob, NOCTURNE.wash (0..1, default 0.6;
   live override ?wash=), applied on top of the warm nocturne: blacks lifted and whites
   pulled in (lower contrast), saturation down on the land, flowers and figures, the moon
   road paled toward a warm grey, the glow a little fainter. ?wash=0 is the palette as it was.

2. A PLAIN PAN TO THE DRUID (introModal.js). The east-west-overhead "casting about" before
   the druid constellation is gone: one long, gentle move there instead, however far.

3. AN OLD-SCHOOL MOON ROAD (riverLayer.js). RIVER_STYLE = 'pixel' (the default now):
     - the road is short, hard-edged horizontal dashes on a chunky pixel grid (PIX), in two
       flat tones, with gaps -- no gradients, no soft edges
     - they change in hard steps, each dash on its own offset, every PIXEL_STEP_S seconds,
       and the pattern still creeps downstream a row at a time
     - the water itself steps through WATER_BANDS flat bands of colour from near to far
       instead of a smooth blend
   RIVER_STYLE = 'smooth' gives back the gradient road exactly as it was.

Idempotent. Run from the repo root:  python3 patch_muted_plainpan_pixelwater.py
"""
import sys, pathlib
PAL   = pathlib.Path('js/game/systems/nightPalette.js')
MODAL = pathlib.Path('js/introModal.js')
RIVER = pathlib.Path('js/game/effects/riverLayer.js')

def patch(path, pairs, mark):
    src = path.read_text(encoding='utf-8')
    if mark in src:
        print(f'{path}: already patched'); return
    for old, new in pairs:
        if src.count(old) != 1:
            sys.exit(f'{path}: expected 1 match:\n{old[:140]}')
        src = src.replace(old, new)
    path.write_text(src, encoding='utf-8')
    print('patched', path)

# ---- 1. the wash ---------------------------------------------------------------------------------
patch(PAL, [(
"""/* The figures' filter lives in the document once, for nightScape to point at. */
export function ensureNocturneFilters() {""",
"""/* [wash] A MUTED, WASHED-OUT LOOK, laid over everything above. wash 0 = the palette exactly as
   written; 1 = fully washed. Blacks lift and whites come in (less contrast), saturation drops on
   the land, flowers and figures, the moon road pales toward a warm grey, and the glow fades a
   little. Because the river's water is graded by the land's own curve, it washes with it.
   Live override: ?wash=0..1. */
{
    const q = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('wash');
    const W = Math.max(0, Math.min(1, q != null && q !== '' && isFinite(+q) ? +q : 0.6));
    const N = NOCTURNE;
    N.wash = W;
    const lo = 0.07 * W, hi = 1 - 0.10 * W;                   // where 0 and 1 now land
    const flatten = (tab) => tab.map(v => +(lo + v * (hi - lo)).toFixed(4));
    for (const ch of ['r', 'g', 'b']) {
        N.groundTone[ch] = flatten(N.groundTone[ch]);
        N.figureTone[ch] = flatten(N.figureTone[ch]);
    }
    N.groundSat *= 1 - 0.40 * W;
    N.figureSat *= 1 - 0.40 * W;
    N.flora = {
        sat:   N.flora.sat * (1 - 0.45 * W),
        slope: N.flora.slope.map(v => +(v * (1 - 0.12 * W)).toFixed(4)),
        lift:  N.flora.lift.map(v => +(v + 0.06 * W).toFixed(4)),
    };
    const grey = [228, 222, 204];
    N.glint = N.glint.map((v, i) => Math.round(v + (grey[i] - v) * 0.6 * W));
    N.glow = { ...N.glow, alpha: N.glow.alpha * (1 - 0.25 * W), minAlpha: N.glow.minAlpha * (1 - 0.25 * W) };
}

/* The figures' filter lives in the document once, for nightScape to point at. */
export function ensureNocturneFilters() {""")], '[wash]')

# ---- 2. the plain pan -----------------------------------------------------------------------------
patch(MODAL, [(
"""    draoi:      { ms: 6800, ease: 'Sine.easeInOut',                              // east, west, overhead
                  via: [[1.9, 0.8], [-1.6, 0.2]] },""",
"""    draoi:      { ms: 4800, ease: 'Sine.easeInOut',  arc:  0.20 },               // [plainPan] one long move""")],
'[plainPan]')

# ---- 3. the old-school road --------------------------------------------------------------------------
patch(RIVER, [
("""const ROAD_DRIFT_S   = 14     // seconds per row of downstream drift (0 = no drift)
""", """const ROAD_DRIFT_S   = 14     // seconds per row of downstream drift (0 = no drift)
// [pixelWater] The look. 'pixel': old-school -- the road as short, hard-edged dashes on a
// chunky pixel grid, two flat tones, with gaps, changing in hard steps; the water in a few
// flat bands. 'smooth': the soft gradient road (all the ROAD_* values above).
const RIVER_STYLE    = 'pixel'
const PIX            = 2      // the pixel grid, in canvas px
const PIXEL_STEP_S   = 1.2    // each dash changes, in one hard step, this often (own offset)
const PIXEL_GAP      = 0.35   // chance a dash is left out, so the road is broken
const PIXEL_DIM      = 0.5    // the dimmer of the two tones, as an alpha
const WATER_BANDS    = 3      // flat bands of water colour from near to far (pixel style)
"""),
("""    this._tw = 0        // [riverSlow] continuous: variant steps, and rows of drift
""", """    this._tw = 0        // [riverSlow] continuous: variant steps, and rows of drift
    this._tp = 0        // [pixelWater] the pixel road's hard steps
"""),
("""        this._tw = t / ROAD_STEP_S
""", """        this._tw = t / ROAD_STEP_S
        this._tp = t / PIXEL_STEP_S                              // [pixelWater]
"""),
("""      const t = smooth((camRow - tileRow - 0.5) / WATER_FAR_D)
""", """      let t = smooth((camRow - tileRow - 0.5) / WATER_FAR_D)
      if (RIVER_STYLE === 'pixel') t = Math.round(t * (WATER_BANDS - 1)) / Math.max(1, WATER_BANDS - 1)   // [pixelWater]
"""),
("""    const c = GLINT_RGB.join(',')
    // [riverLook] One ripple highlight per slice.""", """    const c = GLINT_RGB.join(',')
    if (RIVER_STYLE === 'pixel') return this._glintPixel(ctx, path, tileRow, y0, y1, mx, w0, bottom, c)
    // [riverLook] One ripple highlight per slice."""),
("""  // [riverSlow] One ripple's shape for a slice of pattern-row `row`""", """  // [pixelWater] The old-school road: per slice of the row, one short dash on the PIX grid, in
  // one of two flat tones, or a gap. Each dash's shape is picked afresh in a hard step every
  // PIXEL_STEP_S (on its own offset), and the whole pattern steps a row downstream every
  // ROAD_DRIFT_S. Clipped to the water, like the smooth road.
  _glintPixel(ctx, path, tileRow, y0, y1, mx, w0, bottom, c) {
    const snap = (v) => Math.round(v / PIX) * PIX
    const row = tileRow - Math.floor(this._dr)
    const n = Math.max(1, Math.min(4, Math.round((y1 - y0) / (PIX * 2))))
    for (let k = 0; k < n; k++) {
      const y = snap(y0 + (y1 - y0) * k / n)
      if (y >= bottom || y + PIX <= y0) continue   // thin far rows still get their dash
      const v  = hash(row, k, 7) < ROAD_TWINKLE
        ? Math.floor(this._tp + hash(row, k, 8) * ROAD_FRAMES) % ROAD_FRAMES : 0
      const sv = 10 * v
      if (hash(row, k, 3 + sv) < PIXEL_GAP) continue
      const w  = w0 * (0.35 + 0.65 * hash(row, k, 1 + sv))
      const cx = mx + w0 * ROAD_SHIFT * (hash(row, k, 2 + sv) * 2 - 1)
      const x0 = snap(cx - w), x1 = Math.max(x0 + PIX, snap(cx + w))
      ctx.save()
      ctx.beginPath()
      ctx.rect(x0, y, x1 - x0, Math.min(PIX, bottom - y))   // never below the ground in front
      ctx.clip()
      ctx.fillStyle = `rgba(${c},${hash(row, k, 4 + sv) > 0.4 ? GLINT_ALPHA : PIXEL_DIM})`
      ctx.fill(path, 'nonzero')
      ctx.restore()
    }
  }

  // [riverSlow] One ripple's shape for a slice of pattern-row `row`"""),
], '[pixelWater]')

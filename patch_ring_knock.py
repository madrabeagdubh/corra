#!/usr/bin/env python3
"""
patch_ring_knock.py

The ogham ring's tick was 30ms of white noise (Math.random) through a bandpass,
fired every 9 degrees of turn, up to 8 per move event 15ms apart. Spin it fast
and those random bursts merge into radio static.

This replaces ringTick() with a soft wooden knock:
  - a sine body whose pitch drops fast (the wood), ~90ms decay
  - a brief quiet upper partial on top (the strike)
  - a few percent random pitch per tick, so a run reads as hand on wood
  - a floor on the gap between ticks, enforced on the SCHEDULED time, so a fast
    swipe's staggered run is thinned (2-3 survive) rather than silenced or
    stacked into a rattle. Max ~25 knocks per second.

Touches ONE file: js/introOghamDial.js
  1. the comment above RING_TICK_STEP  (says "reuses the noise-burst recipe")
  2. the comment + function ringTick() (whole block replaced)

The call site in move() is unchanged. Idempotent (marker: RING_TICK_MIN_GAP).
Usage:  python3 patch_ring_knock.py [path/to/repo]
"""
import sys, pathlib

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
path = root / 'js/introOghamDial.js'
src = path.read_text()

if 'RING_TICK_MIN_GAP' in src:
    print('introOghamDial.js: already patched, nothing to do')
    sys.exit(0)


def replace_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        sys.exit(f'ABORT: "{label}" found {n} times (expected 1). File left untouched.')
    return text.replace(old, new)


# ── 1. the stale comment above RING_TICK_STEP ────────────────────────────────
OLD1 = (
    "         below, which reuses the short highpassed-noise-burst recipe the\n"
    "         moon used to use. That recipe suits the ring better than it ever\n"
    "         suited the moon: a carved stone wheel turning is a mechanical\n"
    "         thing, where the moon is closer to an instrument. ringRotAcc is\n"
)
NEW1 = (
    "         below, which is a soft wooden knock. A carved stone wheel turning\n"
    "         is a mechanical thing, where the moon is closer to an instrument,\n"
    "         but it must not be NOISE: random bursts at a spinning wheel's tick\n"
    "         rate merge into radio static. ringRotAcc is\n"
)
src = replace_once(src, OLD1, NEW1, 'RING_TICK_STEP comment')


# ── 2. the comment + function ringTick() ─────────────────────────────────────
START = "      /* The ring's own tick -- the noise-burst click the moon used to use,\n"
END   = "        src.start(t0);\n      }\n"
i = src.find(START)
if i < 0 or src.count(START) != 1:
    sys.exit('ABORT: ringTick comment start marker not found exactly once. File left untouched.')
j = src.find(END, i)
if j < 0:
    sys.exit('ABORT: ringTick end marker not found. File left untouched.')
block = src[i:j + len(END)]
if 'function ringTick(offset=0){' not in block or 'Math.random()*2-1' not in block:
    sys.exit('ABORT: block between markers is not the expected old ringTick. '
             'File left untouched.')

NEW2 = r"""      /* The ring's own tick: a soft wooden knock. It used to be a 30ms burst of
         Math.random() through a bandpass, and that is exactly what a fast spin
         turned into radio static -- random bursts at this tick rate merge into
         a hiss, whatever the filter. A knock is tonal instead: a sine whose
         pitch falls fast (the body of the wood) with a brief, quiet upper
         partial on top (the strike), gone in ~90ms. Short and dry, so it sits
         under the moon's plucked notes rather than being mistaken for them.
         RING_KNOCK_HZ is 260 rather than something lower because a phone
         speaker gives up somewhere below 250Hz -- a deeper knock would lose
         its body and leave only the click.
         Two things keep a fast spin from becoming a rattle even so:
           - RING_TICK_MIN_GAP, a floor on the gap between ticks, enforced on
             the SCHEDULED time. A fast swipe asks for a staggered run (see
             move()); this thins that run to two or three rather than
             silencing it or stacking eight, and caps the whole thing at ~25
             knocks a second however fast the wheel is thrown.
           - a few percent of random pitch on each, so a run of them reads as
             a hand on wood rather than one sample retriggered. */
      const RING_KNOCK_HZ=260, RING_TICK_MIN_GAP=0.04;
      let lastRingTickAt=-1;
      function ringTick(offset=0){
        if(!audioCtx||!started) return;
        const t0=audioCtx.currentTime+offset;
        if(t0-lastRingTickAt<RING_TICK_MIN_GAP) return;
        lastRingTickAt=t0;
        const f=RING_KNOCK_HZ*(1+(Math.random()*2-1)*0.06);
        // The body. A 2ms ramp in rather than an instant step: a gain that
        // jumps is itself a click.
        const bo=audioCtx.createOscillator(), bg=audioCtx.createGain();
        bo.type='sine';
        bo.frequency.setValueAtTime(f,t0);
        bo.frequency.exponentialRampToValueAtTime(f*0.5,t0+0.045);
        bg.gain.setValueAtTime(0.0001,t0);
        bg.gain.linearRampToValueAtTime(0.06,t0+0.002);
        bg.gain.exponentialRampToValueAtTime(0.0001,t0+0.09);
        bo.connect(bg); bg.connect(audioCtx.destination);
        bo.start(t0); bo.stop(t0+0.1);
        // The strike.
        const so=audioCtx.createOscillator(), sg=audioCtx.createGain();
        so.type='sine'; so.frequency.setValueAtTime(f*3,t0);
        sg.gain.setValueAtTime(0.0001,t0);
        sg.gain.linearRampToValueAtTime(0.022,t0+0.001);
        sg.gain.exponentialRampToValueAtTime(0.0001,t0+0.02);
        so.connect(sg); sg.connect(audioCtx.destination);
        so.start(t0); so.stop(t0+0.03);
      }
"""
src = src[:i] + NEW2 + src[j + len(END):]

path.write_text(src)
print('introOghamDial.js: patched OK')

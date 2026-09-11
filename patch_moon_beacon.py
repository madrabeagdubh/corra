#!/usr/bin/env python3
"""
patch_moon_beacon.py — run from the repo root. Idempotent.

MAKING IT FINDABLE WITHOUT TELLING ANYONE ANYTHING.

At phase 0 the moon is a dark disc on a dark sky, and it is the one thing the
player has to touch for any of the intro to happen. The dial's whole argument is
against instruction text, so the moon has to advertise itself by behaving like
the only living thing on screen.

#ogd-halo already exists — a blurred circle at r=98 behind the moon, sitting at
opacity 0.07 until the phase lifts it. It now breathes while `revealed` is false,
and stops the instant the player first moves the moon. Nobody who engages ever
sees it for long.

Two rhythms, not one. Under HINT_URGE seconds of stillness it is a slow, shallow
swell — presence, not a prompt. Past that it deepens and the halo's radius
breathes with it, which is a different KIND of motion from the constant drift of
the ring and the stars, and difference is what the eye catches.

The idle clock resets on any touch anywhere, so a player scrubbing the poem is
never nagged for not having found the moon yet. Only genuine stillness escalates.

On the frame `revealed` flips, the halo is handed back to setPhase's formula —
otherwise it would freeze at whatever the breath last wrote.
"""

import io, os, sys

PATH = 'js/introOghamDial.js'

EDITS = [
    ("      let creepEnd=null, creepCx=0, creepCy=0, creepK0=1, creepDx=0, creepDy=0;",
     "      let creepEnd=null, creepCx=0, creepCy=0, creepK0=1, creepDx=0, creepDy=0;\n"
     "      /* Seconds of stillness before the moon starts asking more insistently,\n"
     "         and the breath's two amplitudes. hintWas tracks the frame `revealed`\n"
     "         flips so the halo can be handed back cleanly. */\n"
     "      const HINT_URGE=9;\n"
     "      let hintT=0, idleT=0, hintWas=false;"),

    ("""        if(dragging && zone==='ring'){""",
     """        /* ── the moon asks to be found ─────────────────────────────────────
           Only until it has been. `revealed` flips on the first movement of the
           moon, and after that this never runs again. */
        if(!revealed){
          hintT+=dt; idleT+=dt;
          const urgent = idleT>HINT_URGE;
          const period = urgent ? 2.2 : 3.8;
          const swell  = 0.5-0.5*Math.cos(hintT*2*Math.PI/period);
          const base   = 0.07+phase*0.36;
          $('halo').setAttribute('opacity',(base+swell*(urgent?0.26:0.11)).toFixed(3));
          // Radius only moves once it is urgent: a change of KIND, not degree,
          // against a screen where everything else drifts at a constant rate.
          $('halo').setAttribute('r',(98+(urgent?swell*7:0)).toFixed(1));
        } else if(!hintWas){
          hintWas=true;
          $('halo').setAttribute('r','98');
          $('halo').setAttribute('opacity',(0.07+phase*0.36).toFixed(3));
        }

        if(dragging && zone==='ring'){"""),

    ("""        dragging=true; lastX=t.clientX; lastT=performance.now(); vel=0; angVel=0; textVel=0; spinVel=0;""",
     """        dragging=true; lastX=t.clientX; lastT=performance.now(); vel=0; angVel=0; textVel=0; spinVel=0;
        idleT=0;   // reading the poem is not idling; only stillness escalates"""),
]


def main():
    if not os.path.isfile(PATH):
        sys.exit('! %s not found — run this from the repo root.' % PATH)
    src = io.open(PATH, encoding='utf-8').read()
    changed = 0
    for old, new in EDITS:
        label = old.strip().splitlines()[0][:56]
        if new in src:
            print('  = already applied: %s' % label); continue
        if src.count(old) != 1:
            sys.exit('! anchor matched %d times, expected 1. Nothing written.\n%s'
                     % (src.count(old), old))
        src = src.replace(old, new, 1); changed += 1
        print('  + patched: %s' % label)
    if not changed:
        print('Nothing to do.'); return
    io.open(PATH, 'w', encoding='utf-8').write(src)
    print('Wrote %s (%d edits).' % (PATH, changed))


if __name__ == '__main__':
    main()

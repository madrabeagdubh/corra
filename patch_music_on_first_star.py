#!/usr/bin/env python3
"""
patch_music_on_first_star.py

Music (the harp) previously started automatically in settleMoon(), right
after the intro poem hands off -- before the player has done anything in
the constellation scene at all. This defers it to the player's first
real attempt to connect a constellation (onPointerDown()'s star-hit
branch), so the music genuinely starts because of something the player
did.

This isn't a plain revert to "start on first star touch", though --
there's a comment already in the code (_startHarpOnSwipe()) explaining
that exact behavior was tried before and reverted, because freezing the
background sky's rotation at the same moment as the harp starting made
the player's first touch look like it had accidentally broken something.
That's still true if the freeze and the harp move together. So this
patch splits the two apart instead:

  - The sky-freeze (`_bgWheelsPaused = true`) stays where it already is,
    automatic, in settleMoon() -- unconditionally now, rather than
    bundled inside the harp-starting call.
  - Only the actual audio (_startHarpOnSwipe(), loading and playing the
    tune) moves to the star touch.

One knock-on fix was needed: _startPostSettleSequence() had a fallback
that un-froze the sky if the harp "hadn't started yet" a second or so
after settleMoon() -- reasonable when harp-starting was expected to
follow almost immediately, but wrong now that "hasn't started yet" is
the normal, expected state while waiting for the player. That fallback
is removed; the sky is meant to stay still through this whole phase
regardless of when the music itself gets going.

Usage:
    python3 patch_music_on_first_star.py [path/to/introModal.js]

Defaults to js/introModal.js relative to the current directory.
Independent of every other patch in this project's stack that touches
introModal.js (patch_intro_blank_leadin.py adds an unrelated isObscured
wire-up elsewhere in the file) -- can be applied before or after it in
either order. Idempotent: running it twice is a no-op the second time.
"""
import sys
from pathlib import Path

DEFAULT_PATH = "js/introModal.js"

EDITS = [
    (
        "    // ── settleMoon ────────────────────────────────────────────────────────────\n"
        "    settleMoon() {\n"
        "        if (!this._harpSilentStarted) {\n"
        "            this._initAudioContext();\n"
        "            this._startHarpOnSwipe();\n"
        "        }\n"
        "\n",
        "    // ── settleMoon ────────────────────────────────────────────────────────────\n"
        "    settleMoon() {\n"
        "        // Audio context warms up here (cheap, silent) so the first star touch\n"
        "        // doesn't also pay setup cost -- but playback itself now waits for\n"
        "        // that touch (see onPointerDown()), so the music genuinely starts\n"
        "        // because the player reached for a star, not automatically once the\n"
        "        // poem ends.\n"
        "        this._initAudioContext();\n"
        "        // The sky still stills here, same moment as before: freezing it at\n"
        "        // the first star touch instead reads as the player's own touch\n"
        "        // having broken something (tried and reverted once already -- see\n"
        "        // the note in _startHarpOnSwipe()). Decoupled from the harp actually\n"
        "        // starting, which no longer happens at this point.\n"
        "        this._bgWheelsPaused = true;\n"
        "\n",
    ),
    (
        "    // ── _startPostSettleSequence ──────────────────────────────────────────────\n"
        "    _startPostSettleSequence(baseScrollY) {\n"
        "        this.tweens.add({\n"
        "            targets: this.worldG, alpha: 1, duration: 1200, ease: 'Sine.easeIn',\n"
        "            // Only restart the turn if the harp never got going — a blocked or\n"
        "            // refused audio context should not leave the sky frozen.\n"
        "            onStart: () => { if (!this._harpSilentStarted) this._bgWheelsPaused = false; },\n"
        "            onComplete: () => {",
        "    // ── _startPostSettleSequence ──────────────────────────────────────────────\n"
        "    _startPostSettleSequence(baseScrollY) {\n"
        "        this.tweens.add({\n"
        "            targets: this.worldG, alpha: 1, duration: 1200, ease: 'Sine.easeIn',\n"
        "            // This used to check \"did the harp actually start\" here and\n"
        "            // un-freeze the sky if not, on the assumption that harp-starting\n"
        "            // followed settleMoon() almost immediately -- so \"hasn't started\n"
        "            // yet\" reliably meant \"audio was blocked or refused\". Now that\n"
        "            // starting the harp deliberately waits for the player's first\n"
        "            // star touch (see onPointerDown()), \"hasn't started yet\" is the\n"
        "            // normal waiting-for-the-player state, not a failure, and this\n"
        "            // check would un-freeze the sky within about a second of it\n"
        "            // settling — well before the player has done anything. The sky\n"
        "            // is meant to stay still through this whole phase regardless of\n"
        "            // when (or whether) the music itself gets going.\n"
        "            onComplete: () => {",
    ),
    (
        "                this.trailPts=[this.screenToRotated(pointer.x,pointer.y)];\n"
        "                star.lit=true; this.tweens.killTweensOf(star); star.brightness=2.0;\n"
        "                // Belt and braces: the wheels are normally already stilled by\n"
        "                // _startHarpOnSwipe(). This only matters if a path reaches the\n"
        "                // stars without the harp having started.\n"
        "                this.spawnRipple(star.wx,star.wy); this._setBgWheelPaused(true); break;",
        "                this.trailPts=[this.screenToRotated(pointer.x,pointer.y)];\n"
        "                star.lit=true; this.tweens.killTweensOf(star); star.brightness=2.0;\n"
        "                // The music begins now, on the player's first real attempt to\n"
        "                // connect the constellation -- not automatically once the\n"
        "                // poem ends (see settleMoon()). The sky was already stilled\n"
        "                // there too, well before this, so this doesn't also read as\n"
        "                // the touch itself having done that; it's just sound\n"
        "                // arriving into a scene that was already quiet and still.\n"
        "                this._startHarpOnSwipe();\n"
        "                // Belt and braces: the wheels are normally already stilled by\n"
        "                // settleMoon(), well before this point. This only matters if\n"
        "                // a path reaches the stars without that having run.\n"
        "                this.spawnRipple(star.wx,star.wy); this._setBgWheelPaused(true); break;",
    ),
    (
        "        mg.gain.exponentialRampToValueAtTime(0.85, now + 2.5);\n"
        "\n"
        "        /* The sky settles as the music arrives. This used to happen on the first\n"
        "           touch of a star, which made the player's opening move look like they\n"
        "           had stopped the heavens by accident.\n"
        "\n"
        "           Set directly, NOT through _setBgWheelPaused(): that helper refuses to\n"
        "           pause while _interactionStarted is false, which is true for everything\n"
        "           before startSequencePulse() — including here. Its guard is about not\n"
        "           freezing a scene that is not yet interactive, which is a different\n"
        "           question from this one. */\n"
        "        this._bgWheelsPaused = true;\n"
        "\n"
        "    } catch(e) { console.warn('[audio] _startHarpOnSwipe error:', e); }\n"
        "} ",
        "        mg.gain.exponentialRampToValueAtTime(0.85, now + 2.5);\n"
        "\n"
        "        /* The sky freeze that used to live here (set the moment the harp\n"
        "           actually started) moved to settleMoon(), which now runs\n"
        "           unconditionally and well before this does -- see the note there.\n"
        "           Freezing it here instead, at the first star touch, is exactly what\n"
        "           made the player's opening move look like they had stopped the\n"
        "           heavens by accident; that's the whole reason this got split. */\n"
        "\n"
        "    } catch(e) { console.warn('[audio] _startHarpOnSwipe error:', e); }\n"
        "} ",
    ),
]


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(DEFAULT_PATH)
    if not path.exists():
        sys.exit(f"error: {path} not found (pass the path as an argument if it's elsewhere)")

    text = path.read_text(encoding="utf-8")

    if "The music begins now, on the player's first real attempt" in text:
        print(f"skip: {path} already patched, nothing to do")
        return

    applied = 0
    for old, new in EDITS:
        if old not in text:
            sys.exit(
                f"error: expected text not found in {path} (has the file changed since this "
                f"patch was written?):\n\n{old[:200]}..."
            )
        count = text.count(old)
        if count != 1:
            sys.exit(f"error: expected exactly one match in {path}, found {count}:\n\n{old[:200]}...")
        text = text.replace(old, new, 1)
        applied += 1

    path.write_text(text, encoding="utf-8")
    print(f"ok: applied {applied}/{len(EDITS)} edits to {path}")


if __name__ == "__main__":
    main()

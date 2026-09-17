#!/usr/bin/env python3
"""
patch_harp_instant_start.py

Fixes two problems with music-on-first-star-touch (patch_music_on_first_
star.py): there was a perceptible delay between the touch and any sound,
and once audible, the tune had already advanced past its own opening
notes.

Root causes, both inside _startHarpOnSwipe():

1. loadTune() fetches soundfont samples from a remote CDN
   (paulrosen.github.io / gleitz.github.io) -- easily hundreds of
   milliseconds to a few seconds, especially uncached. Doing this AT the
   star touch is exactly the delay the touch felt disconnected from.

2. A 2.5-second exponential gain ramp from near-silence. play() starts
   the tune's own internal clock immediately, regardless of the gain
   ramp -- so the tune had already been running silently for a couple of
   seconds by the time it became audible, meaning what the player
   actually heard had already skipped past the true beginning.

Fix: split loading from playing.

  - _prepareHarp() (new): does the slow part -- create the player,
    loadTune(), mute the unused tracks -- and nothing else. Does NOT
    call play(), since starting playback here would start the tune's
    clock immediately, running silently until the eventual touch, same
    problem as the long gain ramp. Called from settleMoon(), well before
    the player can realistically reach a star, so this network cost is
    hidden inside the pan/settle sequence.
  - _startHarpOnSwipe() now awaits the (normally already-finished) prep
    promise, then calls play() and ramps gain over 60ms -- just enough
    to avoid an audible click, not a fade. The prewarmed champion theme
    is stopped here too, not in _prepareHarp(), so whatever was playing
    during the poem continues right up until the harp genuinely starts.

Requires patch_music_on_first_star.py to already be applied.

Usage:
    python3 patch_harp_instant_start.py [path/to/introModal.js]

Defaults to js/introModal.js relative to the current directory.
Idempotent: running it twice is a no-op the second time.
"""
import sys
from pathlib import Path

DEFAULT_PATH = "js/introModal.js"

EDITS = [
    (
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
        "        this._bgWheelsPaused = true;",
        "        // Audio context warms up here (cheap, silent) so the first star touch\n"
        "        // doesn't also pay setup cost -- but actually starting playback\n"
        "        // still waits for that touch (see onPointerDown()), so the music\n"
        "        // genuinely starts because the player reached for a star, not\n"
        "        // automatically once the poem ends.\n"
        "        this._initAudioContext();\n"
        "        // The slow part (fetching soundfont samples over the network) starts\n"
        "        // now too, well ahead of time, so it's normally long finished by the\n"
        "        // time the player reaches a star -- see the note on _prepareHarp()\n"
        "        // for why loading and starting are split like this.\n"
        "        this._harpPrepPromise = this._prepareHarp();\n"
        "        // The sky still stills here, same moment as before: freezing it at\n"
        "        // the first star touch instead reads as the player's own touch\n"
        "        // having broken something (tried and reverted once already -- see\n"
        "        // the note in _startHarpOnSwipe()). Decoupled from the harp actually\n"
        "        // starting, which no longer happens at this point.\n"
        "        this._bgWheelsPaused = true;",
    ),
    (
        "        this._harpPlayer=null; this._harpStarted=false; this._harpSilentStarted=false;\n"
        "    }",
        "        this._harpPlayer=null; this._harpStarted=false; this._harpSilentStarted=false;\n"
        "        this._harpPrepared=false; this._harpPrepPromise=null;\n"
        "    }",
    ),
    (
        "  async _startHarpOnSwipe() {\n"
        "    if (this._harpSilentStarted) return;\n"
        "    this._harpSilentStarted = true;\n"
        "    this._harpStarted = true;\n"
        "    try {\n"
        "        // Stop prewarmed champion theme\n"
        "        if (_prewarmedPlayer) {\n"
        "            try { await _prewarmedPlayer.stop(); } catch(e) {}\n"
        "            _prewarmedPlayer = null;\n"
        "        }\n"
        "\n"
        "        const player = new TradSessionPlayer();\n"
        "        allTunes['myLaganLove'] = levelTunes.myLaganLove;\n"
        "\n"
        "        const loaded = await player.loadTune('myLaganLove');\n"
        "        if (!loaded) { console.warn('[audio] Harp load failed'); return; }\n"
        "\n"
        "        if (player.tracks[1]) { player.tracks[1].gain.gain.value = 0; player.tracks[1].active = false; }\n"
        "        if (player.tracks[2]) { player.tracks[2].gain.gain.value = 0; player.tracks[2].active = false; }\n"
        "\n"
        "        player.engine.masterGain.gain.value = 0.0001;\n"
        "        this._harpPlayer = player;\n"
        "        await player.play();\n"
        "\n"
        "        const ac = player.audioContext;\n"
        "        if (ac && ac.state === 'suspended') await ac.resume();\n"
        "\n"
        "        const mg = player.engine.masterGain, now = ac.currentTime;\n"
        "        mg.gain.cancelScheduledValues(now);\n"
        "        mg.gain.setValueAtTime(0.0001, now);\n"
        "        mg.gain.exponentialRampToValueAtTime(0.85, now + 2.5);\n"
        "\n"
        "        mg.gain.exponentialRampToValueAtTime(0.85, now + 2.5);",
        "    /* The slow part -- loadTune() fetches soundfont samples from a remote CDN\n"
        "       (paulrosen.github.io / gleitz.github.io), which can easily be hundreds\n"
        "       of milliseconds to a few seconds, especially uncached. Splitting this\n"
        "       out and calling it early (see settleMoon()) means that cost is paid\n"
        "       automatically, hidden inside the pan/settle sequence, rather than\n"
        "       showing up as a gap between the player's first star touch and any\n"
        "       sound actually starting. This does NOT call play() -- starting\n"
        "       playback here would begin the tune's own clock immediately, and by\n"
        "       the time the player actually touched a star some seconds later, the\n"
        "       audible portion would already have advanced past its opening notes.\n"
        "       Loading is silent regardless of timing; starting playback is not, so\n"
        "       only starting playback needs to wait for the touch. */\n"
        "    async _prepareHarp() {\n"
        "        if (this._harpPrepared) return;\n"
        "        this._harpPrepared = true;\n"
        "        try {\n"
        "            const player = new TradSessionPlayer();\n"
        "            allTunes['myLaganLove'] = levelTunes.myLaganLove;\n"
        "\n"
        "            const loaded = await player.loadTune('myLaganLove');\n"
        "            if (!loaded) { console.warn('[audio] Harp load failed'); return; }\n"
        "\n"
        "            if (player.tracks[1]) { player.tracks[1].gain.gain.value = 0; player.tracks[1].active = false; }\n"
        "            if (player.tracks[2]) { player.tracks[2].gain.gain.value = 0; player.tracks[2].active = false; }\n"
        "\n"
        "            player.engine.masterGain.gain.value = 0.0001;\n"
        "            this._harpPlayer = player;\n"
        "        } catch(e) { console.warn('[audio] _prepareHarp error:', e); }\n"
        "    }\n"
        "\n"
        "  async _startHarpOnSwipe() {\n"
        "    if (this._harpSilentStarted) return;\n"
        "    this._harpSilentStarted = true;\n"
        "    this._harpStarted = true;\n"
        "    try {\n"
        "        // Stop prewarmed champion theme -- held until the actual gesture\n"
        "        // rather than moved into _prepareHarp(), so whatever was playing\n"
        "        // during the poem carries on right up until the harp genuinely\n"
        "        // starts instead of leaving an early silent gap.\n"
        "        if (_prewarmedPlayer) {\n"
        "            try { await _prewarmedPlayer.stop(); } catch(e) {}\n"
        "            _prewarmedPlayer = null;\n"
        "        }\n"
        "\n"
        "        // Normally already resolved by now -- loading started well before\n"
        "        // this touch, during settleMoon(). Only waits for real if the\n"
        "        // player reached a star unusually fast.\n"
        "        if (this._harpPrepPromise) await this._harpPrepPromise;\n"
        "        const player = this._harpPlayer;\n"
        "        if (!player) { console.warn('[audio] Harp not available'); return; }\n"
        "\n"
        "        await player.play();\n"
        "\n"
        "        const ac = player.audioContext;\n"
        "        if (ac && ac.state === 'suspended') await ac.resume();\n"
        "\n"
        "        /* 2.5s used to live here. On automatic, pre-touch playback that read\n"
        "           as music gradually arriving; on a deliberate touch it read as two\n"
        "           separate problems at once -- a delay before anything is audible,\n"
        "           and, once audible, already well past the tune's own opening notes\n"
        "           (play() started the tune's clock immediately; the long ramp just\n"
        "           kept it inaudible while that clock ran). 60ms is enough to avoid\n"
        "           an audible click on the initial ramp and nothing more -- the\n"
        "           point is for this to sound like it started because of the touch,\n"
        "           at the touch, from the beginning. */\n"
        "        const mg = player.engine.masterGain, now = ac.currentTime;\n"
        "        mg.gain.cancelScheduledValues(now);\n"
        "        mg.gain.setValueAtTime(0.0001, now);\n"
        "        mg.gain.exponentialRampToValueAtTime(0.85, now + 0.06);",
    ),
]


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(DEFAULT_PATH)
    if not path.exists():
        sys.exit(f"error: {path} not found (pass the path as an argument if it's elsewhere)")

    text = path.read_text(encoding="utf-8")

    if "_prepareHarp" in text:
        print(f"skip: {path} already has _prepareHarp -- patch already applied, nothing to do")
        return

    applied = 0
    for old, new in EDITS:
        if old not in text:
            sys.exit(
                f"error: expected text not found in {path} (has the file changed since this "
                f"patch was written, or is patch_music_on_first_star.py not applied yet?):\n\n{old[:200]}..."
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

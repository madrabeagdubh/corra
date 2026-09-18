#!/usr/bin/env python3
"""
patch_star_hint.py

If the player hasn't started drawing after a few seconds, a shooting star crosses
the sky along a REAL stroke: from one star of the current constellation to the
next to the next, each star flaring as it arrives and a faint line laid behind
it that lingers and fades. That is what the player is meant to do, done for them.

Behaviour (all tunable, constants below):
  - FIRST CONSTELLATION ONLY (HINT_LAST_INDEX = 0): it is there to teach the
    gesture, and after that the player knows it. Raise HINT_LAST_INDEX to bring
    it back for later constellations
  - streak after HINT_FIRST_MS (6s) of no star touched
  - repeats every HINT_REPEAT_MS (14s) until the player touches a star
  - if the player draws something that doesn't finish the constellation, it
    re-arms after HINT_RETRY_MS (9s)
  - it shows at most HINT_MAX_STARS (3) stars -- two legs. The first
    constellation is a four-star chain; showing all of it would leave the
    player nothing to do
  - SILENT. The existing star pulse keeps running alongside, untouched.

The path is built from the constellation's own pending connections (chained
end to start), so it is always a stroke evaluateStroke() would accept.

Drawn in WORLD space, so it rides the camera's slow drift with the sky it is
crossing. Objects made after _build() are not on the UI camera's ignore list,
so the graphics is ignored there explicitly (otherwise it would be drawn a
second time, unscrolled, in the wrong place).

Touches ONE file: js/introModal.js. Independent of patch_wheels_ease_out.py.
Idempotent (marker: starHint). Re-running it on an install of an older version of
this patch upgrades that install in place.
Usage:  python3 patch_star_hint.py [path/to/repo]
"""
import sys, pathlib

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
path = root / 'js/introModal.js'
src = path.read_text()

def replace_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        sys.exit(f'ABORT: anchor "{label}" found {n} times (expected 1). File left untouched.')
    return text.replace(old, new)


if 'starHint' in src:
    if 'HINT_LAST_INDEX' in src:
        print('introModal.js: already patched, nothing to do')
        sys.exit(0)
    # An earlier version of this patch is installed: it hinted on EVERY
    # constellation (20s idle on later ones). Upgrade it in place to
    # first-constellation-only. Aborts, touching nothing, if it isn't the
    # version this expects.
    print('older starHint found -- upgrading to first-constellation-only')
    src = replace_once(src,
        "const HINT_FIRST_MS  = 6000;    // idle before the FIRST constellation's streak\n"
        "const HINT_LATER_MS  = 20000;   // idle before later constellations' streak\n",
        "const HINT_LAST_INDEX = 0;      // hint runs for constellations 0..this (0 = the first only)\n"
        "const HINT_FIRST_MS  = 6000;    // idle before the streak\n",
        'upgrade: constants')
    src = replace_once(src,
        "        this._armHint(this.currentIndex === 0 ? HINT_FIRST_MS : HINT_LATER_MS);\n",
        "        this._armHint(HINT_FIRST_MS);\n",
        'upgrade: arm site')
    src = replace_once(src,
        "    _armHint(ms) {\n        if (this._hintTimer)",
        "    _armHint(ms) {\n"
        "        if (this.currentIndex > HINT_LAST_INDEX) return;   // taught once; that's enough\n"
        "        if (this._hintTimer)",
        'upgrade: guard')
    path.write_text(src)
    print('introModal.js: upgraded OK')
    sys.exit(0)


# 1. constants ───────────────────────────────────────────────────────────────
A = "const RIPPLE_MS = 900, RIPPLE_MAX_R = 55, RIPPLE_ALPHA = 0.75;\n"
src = replace_once(src, A, A + r"""/* [starHint] The idle hint: a shooting star that traces a real stroke. */
const HINT_LAST_INDEX = 0;      // hint runs for constellations 0..this (0 = the first only)
const HINT_FIRST_MS  = 6000;    // idle before the streak
const HINT_REPEAT_MS = 14000;   // between streaks while the player is still idle
const HINT_RETRY_MS  = 9000;    // after a stroke that didn't finish the constellation
const HINT_MAX_STARS = 3;       // stars shown: 3 = two legs, "one, to the next, to the next"
const HINT_SPEED     = 0.18;    // world px per ms along a leg
const HINT_LEG_MIN_MS = 550, HINT_LEG_MAX_MS = 1000;
const HINT_TAIL_PX   = 70;
""", 'constants')


# 2. arm it when a constellation's interaction begins ────────────────────────
src = replace_once(src,
    "            this.showWaitingTexts(this.constellations[this.currentIndex], ()=>{});\n"
    "        this.runPulseStep();\n",
    "            this.showWaitingTexts(this.constellations[this.currentIndex], ()=>{});\n"
    "        this.runPulseStep();\n"
    "        // [starHint] the streak is a second, slower prompt on top of the pulse.\n"
    "        this._armHint(HINT_FIRST_MS);\n",
    'startSequencePulse')

# 3. the player touching a star ends it ──────────────────────────────────────
src = replace_once(src,
    "this.spawnRipple(star.wx,star.wy); this._setBgWheelPaused(true); break;",
    "this.spawnRipple(star.wx,star.wy); this._setBgWheelPaused(true);\n"
    "                this._cancelHint();   // [starHint] they're doing it themselves\n"
    "                break;",
    'onPointerDown')

# 4. a stroke that didn't finish it: try again later ─────────────────────────
src = replace_once(src,
    "        if (c) this.evaluateStroke(c);\n",
    "        if (c) this.evaluateStroke(c);\n"
    "        // [starHint] still not done? show them again after a while.\n"
    "        if (c && !c.completed) this._armHint(HINT_RETRY_MS);\n",
    'onPointerUp')

# 5. finishing it ends it ────────────────────────────────────────────────────
src = replace_once(src,
    "        c.completed=true; this.canInteract=false;\n        if (this.pulseTimer) this.pulseTimer.remove();\n",
    "        c.completed=true; this.canInteract=false;\n        if (this.pulseTimer) this.pulseTimer.remove();\n"
    "        this._cancelHint();   // [starHint]\n",
    'onConstellationComplete')


# 6. the hint itself ─────────────────────────────────────────────────────────
NEW_METHODS = r"""    /* ── [starHint] the idle hint ───────────────────────────────────────────
       A shooting star that does what the player is supposed to do. Silent;
       runs alongside runPulseStep(), which it does not touch. */
    _armHint(ms) {
        if (this.currentIndex > HINT_LAST_INDEX) return;   // taught once; that's enough
        if (this._hintTimer) { this._hintTimer.remove(); this._hintTimer = null; }
        if (this._hintTween) return;     // one is running; it re-arms itself when done
        this._hintTimer = this.time.delayedCall(ms, () => this._playStarHint());
    }

    _cancelHint() {
        if (this._hintTimer) { this._hintTimer.remove(); this._hintTimer = null; }
        if (this._hintTween) { this._hintTween.stop(); this._hintTween = null; }
        if (this._hintG) {
            const g = this._hintG; this._hintG = null;
            this.tweens.killTweensOf(g);
            this.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() });
        }
    }

    // Up to HINT_MAX_STARS stars along a chain of PENDING connections, each leg
    // starting where the last ended -- a stroke evaluateStroke() would accept.
    // Every pending connection is tried as the opening leg, in both directions,
    // and the longest chain wins: the first connection in the data can be a dead
    // end (draoi's is), which would otherwise show a single leg.
    _hintPath(c) {
        const pending = c.connections.filter(cn => !cn.completed);
        let best = [];
        for (let s = 0; s < pending.length && best.length < HINT_MAX_STARS; s++) {
            for (const [a, b] of [[pending[s].from, pending[s].to], [pending[s].to, pending[s].from]]) {
                const path = [a, b], used = new Set([s]);
                while (path.length < HINT_MAX_STARS) {
                    const end = path[path.length - 1];
                    const i = pending.findIndex((cn, k) => !used.has(k) &&
                        ((cn.from === end && !path.includes(cn.to)) ||
                         (cn.to === end && !path.includes(cn.from))));
                    if (i < 0) break;
                    used.add(i);
                    path.push(pending[i].from === end ? pending[i].to : pending[i].from);
                }
                if (path.length > best.length) best = path;
                if (best.length >= HINT_MAX_STARS) break;
            }
        }
        return best.map(i => c.stars[i]).filter(Boolean);
    }

    _playStarHint() {
        this._hintTimer = null;
        const c = this.constellations[this.currentIndex];
        if (!c || c.completed || !this.canInteract || this.isDrawing || this._hintTween) return;
        if (this._skipMenuOpen) { this._armHint(3000); return; }
        const path = this._hintPath(c);
        if (path.length < 2) return;

        const legs = []; let total = 0;
        for (let i = 0; i < path.length - 1; i++) {
            const a = path[i], b = path[i + 1];
            const len = Math.hypot(b.wx - a.wx, b.wy - a.wy);
            const dur = Phaser.Math.Clamp(len / HINT_SPEED, HINT_LEG_MIN_MS, HINT_LEG_MAX_MS);
            legs.push({ a, b, len, dur, t0: total }); total += dur;
        }

        // World space, so it rides the camera's drift. Made after _build(), so
        // the UI camera must be told to ignore it or it is drawn twice.
        const g = this.add.graphics().setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
        this.uiCamera?.ignore(g);
        this._hintG = g;

        const flare = star => {
            this.spawnRipple(star.wx, star.wy);
            this.tweens.killTweensOf(star);
            this.tweens.add({ targets: star, brightness: 2.4, duration: 300, ease: 'Sine.easeOut',
                yoyo: true, onComplete: () => { star.brightness = 1; } });
        };
        // The line laid behind the head, in the same two-pass glow the real
        // connections use but fainter -- a suggestion, not a completed line.
        const seg = (a, b) => {
            g.lineStyle(4.5, 0x99ccff, 0.10); g.lineBetween(a.wx, a.wy, b.wx, b.wy);
            g.lineStyle(1.4, 0xddeeff, 0.32); g.lineBetween(a.wx, a.wy, b.wx, b.wy);
        };
        const draw = (li, u, head) => {
            g.clear();
            for (let i = 0; i < li; i++) seg(legs[i].a, legs[i].b);
            const L = legs[li];
            const hx = L.a.wx + (L.b.wx - L.a.wx) * u, hy = L.a.wy + (L.b.wy - L.a.wy) * u;
            seg(L.a, { wx: hx, wy: hy });
            if (!head) return;
            const dx = (L.b.wx - L.a.wx) / L.len, dy = (L.b.wy - L.a.wy) / L.len;
            const tail = Math.min(HINT_TAIL_PX, u * L.len), N = 6;
            for (let k = 0; k < N; k++) {
                const f = 1 - k / N;
                g.lineStyle(0.6 + 2.4 * f, NIGHT.starHex, 0.9 * f);
                g.lineBetween(hx - dx * tail * k / N,       hy - dy * tail * k / N,
                              hx - dx * tail * (k + 1) / N, hy - dy * tail * (k + 1) / N);
            }
            g.fillStyle(NIGHT.starHex, 0.22); g.fillCircle(hx, hy, 7);
            g.fillStyle(NIGHT.starHex, 1);    g.fillCircle(hx, hy, 2.4);
        };

        let arrived = 0;
        flare(path[0]);
        const prog = { ms: 0 };
        this._hintTween = this.tweens.add({
            targets: prog, ms: total, duration: total, ease: 'Linear',
            onUpdate: () => {
                const ms = prog.ms;
                while (arrived + 1 < path.length && ms >= legs[arrived].t0 + legs[arrived].dur) {
                    arrived++; flare(path[arrived]);
                }
                let li = legs.findIndex(L => ms < L.t0 + L.dur);
                if (li < 0) li = legs.length - 1;
                draw(li, Math.min(1, (ms - legs[li].t0) / legs[li].dur), true);
            },
            onComplete: () => {
                this._hintTween = null;
                // The head is gone; the line it laid stays a moment, then fades.
                draw(legs.length - 1, 1, false);
                this.tweens.add({ targets: g, alpha: 0, duration: 1400, delay: 500, ease: 'Sine.easeIn',
                    onComplete: () => { g.destroy(); if (this._hintG === g) this._hintG = null; } });
                this._armHint(HINT_REPEAT_MS);
            },
        });
    }

"""
src = replace_once(src, "    getStarSeq(c) {\n", NEW_METHODS + "    getStarSeq(c) {\n", 'insert methods')

path.write_text(src)
print('introModal.js: patched OK')

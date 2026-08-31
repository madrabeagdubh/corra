#!/usr/bin/env python3
"""
patch_narrative_replay_flag.py

Adds a ?resetIntro=1 URL flag that bypasses showIntroNarrative()'s
once-per-champion check for that single page load, without touching
localStorage. Useful for screen recording or repeat-testing the intro text
on a normal (non-incognito) browser session -- incognito blocks screen
recording on some devices, and there was previously no other way to see
the intro narrative a second time.

Usage: load the game as normal, then add ?resetIntro=1 to the URL (e.g.
append it after any existing ?scene=... param with &resetIntro=1) and
reload. A plain reload afterward goes back to the normal seen/unseen
behaviour -- this doesn't mark anything as unseen or seen differently than
it otherwise would.

Idempotent: safe to run more than once.

Run from the repo root:
    python3 patch_narrative_replay_flag.py
"""
from pathlib import Path

ROOT = Path.cwd()
TARGET = "js/game/scenes/locations/perspectiveScene.js"

OLD = """  showIntroNarrative() {
    const champion = this.registry.get('selectedChampion') || window.selectedChampion
    if (!champion) return
    const seenKey = `${this.scene.key}_intro_${champion.id}`
    if (localStorage.getItem(seenKey)) return"""

NEW = """  showIntroNarrative() {
    const champion = this.registry.get('selectedChampion') || window.selectedChampion
    if (!champion) return
    const seenKey = `${this.scene.key}_intro_${champion.id}`
    // ?resetIntro=1 in the URL bypasses the once-per-champion check for this
    // load only -- doesn't touch localStorage, so a normal reload afterward
    // goes back to its usual seen/unseen state. For recording/testing this
    // without needing incognito (which blocks screen recording on some
    // devices).
    const forceReplay = new URLSearchParams(window.location.search).get('resetIntro') === '1'
    if (localStorage.getItem(seenKey) && !forceReplay) return"""

path = ROOT / TARGET
if not path.exists():
    print(f"✗ {TARGET} does not exist -- run this from the repo root")
    raise SystemExit(1)

text = path.read_text(encoding="utf-8")

if NEW in text:
    print("• already applied, skipping")
elif OLD not in text:
    print(f"✗ expected text not found in {TARGET} -- file has drifted, "
          f"apply by hand: add a ?resetIntro=1 URL check before the "
          f"seenKey early-return in showIntroNarrative(), see patch "
          f"source for the exact block.")
else:
    count = text.count(OLD)
    if count > 1:
        print(f"✗ match is not unique ({count}x) -- apply by hand")
    else:
        path.write_text(text.replace(OLD, NEW, 1), encoding="utf-8")
        print(f"✓ added ?resetIntro=1 replay flag to showIntroNarrative()")

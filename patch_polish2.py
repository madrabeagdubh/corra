#!/usr/bin/env python3
"""
Four fixes.

1. PORTRAIT HEAD CROPPED
   The dance hop moves a portrait up by subtracting `bob` from its y, but
   the clip mask starts exactly at the body's top edge with no headroom.
   At the peak of a hop the head goes above the mask and is cut off. Fix:
   give the whole row layout a small top margin equal to the hop's own
   amplitude, so the hop has room to happen inside the mask.

2. MUSIC DURING EASCA
   The sustaining harp schedules its own setTimeout chain independent of
   the text panel, so dismissing a card for the keyboard doesn't stop it —
   a note can still land while the player is typing. Paused around both
   places an @easca prompt is opened, resumed on the callback regardless
   of outcome.

3. {playerVoc} WITH NO MATCH
   Previously left as a literal token when nothing was in the registry.
   Now falls back to "a chara" — unisex, ordinary, and correct for anyone
   the roster's vocative rules don't cover either.

4. TWO LINES REVEALING AT ONCE
   Merging a short run into one beat (patch_beat_merge.py) fixed the long
   gap BETWEEN beats, but every row in a merged beat used the same reveal
   delay, so they now arrive together instead of one after the other. This
   adds a small stagger between rows sharing a beat, so a two-line sentence
   still reads as one breath but not as one instant.

Idempotent. Run from repo root, after patch_beat_merge.py and
patch_vocative_wire.py and patch_flow.py.
"""

import sys, pathlib

TEXT  = pathlib.Path('js/game/ui/textPanel.js')
HARP  = pathlib.Path('js/game/systems/music/dialogueHarp.js')
PANEL = pathlib.Path('js/game/ui/encounterPanel.js')


# ── 1. portrait headroom ──────────────────────────────────────────────────

T1_A = """    const blockW = Math.round(textW * CARD_BLOCK_W_FRAC)

    let cy = 0

    for (const row of rows) {"""

T1_P = """    const blockW = Math.round(textW * CARD_BLOCK_W_FRAC)

    // Headroom equal to the dance hop's own amplitude. Without it, a
    // portrait hopping at the very top of the body rises above the clip
    // mask at its peak and the head is cut off mid-hop.
    let cy = CARD_DANCE_HOP_PX

    for (const row of rows) {"""


# ── 4. intra-beat stagger ─────────────────────────────────────────────────

T4_A = """      this._contentItems.forEach((item) => {
        if (!item.obj?.active) return
        const beat = item.group ?? 0
        item.reveal = 0
        if (this._scrollReveal.has(beat)) return
        this._revealTweens.push(this.scene.tweens.add({
          targets: item,
          reveal: 1,
          delay: starts[beat] ?? 0,
          duration: CARD_REVEAL_FADE_MS,
          ease: 'Linear',
          onUpdate: () => this._applyScroll(),
        }))
      })"""

T4_P = """      // Rows sharing a beat (a short run merged into one pause) still get
      // a small stagger between them, so "one breath" doesn't mean "one
      // instant" -- only full beats are spaced far enough apart to need
      // their own delay; this is the space WITHIN one.
      const _groupSeen = {}
      this._contentItems.forEach((item) => {
        if (!item.obj?.active) return
        const beat = item.group ?? 0
        item.reveal = 0
        if (this._scrollReveal.has(beat)) return
        const within = item.isPortrait ? 0
          : (_groupSeen[beat] = (_groupSeen[beat] || 0) + 1) - 1
        this._revealTweens.push(this.scene.tweens.add({
          targets: item,
          reveal: 1,
          delay: (starts[beat] ?? 0) + within * CARD_INTRA_BEAT_STAGGER_MS,
          duration: CARD_REVEAL_FADE_MS,
          ease: 'Linear',
          onUpdate: () => this._applyScroll(),
        }))
      })"""

T4_CONST_A = "const CARD_DANCE_HOP_PX    = 9\n"
T4_CONST_P = ("const CARD_DANCE_HOP_PX    = 9\n"
              "// Gap between rows that share one merged beat. Smaller than a full\n"
              "// beat's own spacing -- this is a breath, not a pause.\n"
              "const CARD_INTRA_BEAT_STAGGER_MS = 220\n")


# ── 2. harp pause/resume ───────────────────────────────────────────────────

H_A = """  sustain({ isHero = false, notes = 4 } = {}) {
    if (!this.on) return
    const ctx = this._ctx()
    if (!ctx || !this.notes.length) return"""

H_P = """  /**
   * Stop the sustain chain where it stands, without losing what it was
   * owed. The card that was funding it is gone -- typing a name is not
   * reading -- so the tune should stop with the card, not run on under
   * something else. resume() picks the same credit back up.
   */
  pause() {
    clearTimeout(this._sustainTimer)
    this._sustainTimer = null
    this._sustaining = false
  }

  resume() {
    if (this._credit && this._credit.length && !this._sustaining) this._runSustain()
  }

  sustain({ isHero = false, notes = 4 } = {}) {
    if (!this.on) return
    const ctx = this._ctx()
    if (!ctx || !this.notes.length) return"""

H2_A = """  _runSustain() {
    const c = this._credit && this._credit[0]
    if (!c) { this._sustaining = false; return }

    const ctx = this._ctx()
    if (!ctx) { this._sustaining = false; return }"""

H2_P = """  _runSustain() {
    if (!this.on) { this._sustaining = false; return }   // paused: stop here, credit intact
    const c = this._credit && this._credit[0]
    if (!c) { this._sustaining = false; return }

    const ctx = this._ctx()
    if (!ctx) { this._sustaining = false; return }"""


# ── 2 (continued) + 3: encounterPanel ──────────────────────────────────────

P1_A = """    if (opt.easca && !this._eascaDone && this._scene?.promptEasca) {
      this._scene.promptEasca((text) => {
        if (!this._isOpen) return
        if (text) {"""

P1_P = """    if (opt.easca && !this._eascaDone && this._scene?.promptEasca) {
      try { DialogueHarp.pause() } catch (e) {}
      this._scene.promptEasca((text) => {
        try { DialogueHarp.resume() } catch (e) {}
        if (!this._isOpen) return
        if (text) {"""

P2_A = """        if (d.easca && this._scene?.promptEasca) {
          this._scene.promptEasca((text) => {
            if (!this._isOpen) return
            if (text) {"""

P2_P = """        if (d.easca && this._scene?.promptEasca) {
          try { DialogueHarp.pause() } catch (e) {}
          this._scene.promptEasca((text) => {
            try { DialogueHarp.resume() } catch (e) {}
            if (!this._isOpen) return
            if (text) {"""

P3_A = """  _fill(text) {
    if (!text || String(text).indexOf('{') < 0) return text
    return String(text).replace(/\\{(\\w+)\\}/g, (m, k) => {
      try {
        const v = this._scene?.registry?.get(k)
        if (v) return v
      } catch (e) {}
      return m
    })
  }"""

P3_P = """  _fill(text) {
    if (!text || String(text).indexOf('{') < 0) return text
    return String(text).replace(/\\{(\\w+)\\}/g, (m, k) => {
      try {
        const v = this._scene?.registry?.get(k)
        if (v) return v
      } catch (e) {}
      // {playerVoc} with nothing to fill it: a name that wasn't given, or
      // was given but didn't match, or matched a roster entry with no
      // vocative worked out yet. "a chara" is unisex and always correct --
      // never a guess at a form the data doesn't have.
      if (k === 'playerVoc') return 'a chara'
      return m
    })
  }"""


TEXT_EDITS = [(T1_A, T1_P), (T4_CONST_A, T4_CONST_P), (T4_A, T4_P)]
HARP_EDITS = [(H_A, H_P), (H2_A, H2_P)]
PANEL_EDITS = [(P1_A, P1_P), (P2_A, P2_P), (P3_A, P3_P)]


def apply(path, edits, marker, name):
    if not path.exists():
        sys.exit(f'not found: {path} — run from repo root')
    src = path.read_text()
    if marker in src:
        print(f'{name} already patched')
        return
    for i, (a, _) in enumerate(edits, 1):
        if a not in src:
            sys.exit(f'{name} anchor {i} not found — run the earlier patches first, '
                     'or the file has moved on since')
    for a, p in edits:
        src = src.replace(a, p, 1)
    path.write_text(src)
    print(f'patched {path}')


if __name__ == '__main__':
    apply(TEXT,  TEXT_EDITS,  'CARD_INTRA_BEAT_STAGGER_MS', 'textPanel.js')
    apply(HARP,  HARP_EDITS, 'pause() {', 'dialogueHarp.js')
    apply(PANEL, PANEL_EDITS, "k === 'playerVoc'", 'encounterPanel.js')

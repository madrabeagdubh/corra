#!/usr/bin/env python3
"""
Two fixes.

1. ACTUALLY SILENCE RINGING NOTES ON PAUSE
   pause() stopped the sustain chain from scheduling further notes, but a
   note already plucked keeps ringing on its own -- Karplus-Strong decay
   takes up to 2.5 seconds regardless of anything called afterward. This
   tracks each pluck's gain node and, on pause(), ramps anything still
   ringing down to silence over 50ms rather than letting it decay under
   the keyboard.

2. PERSIST CARD CHROME THROUGH THE WHOLE OPENING
   _chainShow (used for option replies) has always set keepChromeOnHide,
   so a chosen answer doesn't refade the card. The plain show() calls in
   _showDialogue never did -- and the whole opening (nodes 0-2) is now
   built from those, so every one of them faded independently. Adding the
   same flag there makes the opening read as one continuous card, same as
   the hub already did.

Idempotent. Run from repo root.
"""

import sys, pathlib

HARP  = pathlib.Path('js/game/systems/music/dialogueHarp.js')
PANEL = pathlib.Path('js/game/ui/encounterPanel.js')


# ── 1. silence ringing notes ──────────────────────────────────────────────

H1_A = """function ksBuffer(ctx, freq, vel, secs) {
  const sr  = ctx.sampleRate
  // Default is short -- this is punctuation, not a solo. `secs` overrides it
  // for the two gestures that want a different envelope: the long open ring
  // and the damped tap.
  const dur = secs ?? (1.1 + vel * 1.4)"""

H1_P = """function ksBuffer(ctx, freq, vel, secs) {
  const sr  = ctx.sampleRate
  // Default is short -- this is punctuation, not a solo. `secs` overrides it
  // for the two gestures that want a different envelope: the long open ring
  // and the damped tap.
  const dur = secs ?? (1.1 + vel * 1.4)
  ksBuffer._lastDur = dur   // read by _pluck right after the call, see below"""

H2_A = """  _pluck(ctx, midi, vel, delayMs, secs) {
    try {
      const when = ctx.currentTime + Math.max(0, delayMs) / 1000
      const freq = 440 * Math.pow(2, (midi - 69) / 12)
      const v    = Math.max(0.08, vel)
      const src  = ctx.createBufferSource()
      src.buffer = ksBuffer(ctx, freq, v, secs)
      const g = ctx.createGain()
      g.gain.setValueAtTime(GAIN_BASE + v * GAIN_VEL, when)
      src.connect(g); g.connect(ctx.destination)
      src.start(when)
    } catch (e) { /* audio is a nicety; never let it break a conversation */ }
  }"""

H2_P = """  _pluck(ctx, midi, vel, delayMs, secs) {
    try {
      const when = ctx.currentTime + Math.max(0, delayMs) / 1000
      const freq = 440 * Math.pow(2, (midi - 69) / 12)
      const v    = Math.max(0.08, vel)
      const src  = ctx.createBufferSource()
      src.buffer = ksBuffer(ctx, freq, v, secs)
      const dur  = ksBuffer._lastDur ?? 1.5
      const g = ctx.createGain()
      g.gain.setValueAtTime(GAIN_BASE + v * GAIN_VEL, when)
      src.connect(g); g.connect(ctx.destination)
      src.start(when)
      // Tracked so pause() can silence this if it's still ringing when a
      // conversation is interrupted -- a Karplus-Strong pluck otherwise
      // decays on its own schedule no matter what's called afterward.
      this._activeGains = this._activeGains || []
      this._activeGains.push({ gain: g, endAt: when + dur })
      const now = ctx.currentTime
      this._activeGains = this._activeGains.filter(e => e.endAt > now - 0.5)
    } catch (e) { /* audio is a nicety; never let it break a conversation */ }
  }

  /** Ramp anything still ringing down to silence over 50ms. */
  _silenceRinging() {
    const ctx = this._ctx()
    if (!ctx || !this._activeGains) return
    const now = ctx.currentTime
    this._activeGains.forEach(({ gain, endAt }) => {
      if (endAt <= now) return
      try {
        gain.gain.cancelScheduledValues(now)
        gain.gain.setValueAtTime(gain.gain.value, now)
        gain.gain.linearRampToValueAtTime(0.0001, now + 0.05)
      } catch (e) {}
    })
    this._activeGains = []
  }"""

H3_A = """  pause() {
    clearTimeout(this._sustainTimer)
    this._sustainTimer = null
    this._sustaining = false
  }"""

H3_P = """  pause() {
    clearTimeout(this._sustainTimer)
    this._sustainTimer = null
    this._sustaining = false
    this._silenceRinging()
  }"""


# ── 2. persist chrome through the opening ─────────────────────────────────

P1_A = """        options: shown.map(o => ({ ga: this._fill(o.ga || ''), en: this._fill(o.en || '') })),
        onChoice: (i) => {"""

P1_P = """        keepChromeOnHide: true,
        options: shown.map(o => ({ ga: this._fill(o.ga || ''), en: this._fill(o.en || '') })),
        onChoice: (i) => {"""

P2_A = """      options: null,
      onDismiss: () => {"""

P2_P = """      keepChromeOnHide: true,
      options: null,
      onDismiss: () => {"""


HARP_EDITS  = [(H1_A, H1_P), (H2_A, H2_P), (H3_A, H3_P)]
PANEL_EDITS = [(P1_A, P1_P), (P2_A, P2_P)]


def apply(path, edits, marker, name):
    if not path.exists():
        sys.exit(f'not found: {path} — run from repo root')
    src = path.read_text()
    if marker in src:
        print(f'{name} already patched')
        return
    for i, (a, _) in enumerate(edits, 1):
        if a not in src:
            sys.exit(f'{name} anchor {i} not found — the file has moved on '
                     'since the last patch; paste the relevant section and '
                     "I'll re-anchor it")
    for a, p in edits:
        src = src.replace(a, p, 1)
    path.write_text(src)
    print(f'patched {path}')


if __name__ == '__main__':
    apply(HARP,  HARP_EDITS,  '_silenceRinging', 'dialogueHarp.js')
    apply(PANEL, PANEL_EDITS, 'keepChromeOnHide: true,\n        options: shown',
          'encounterPanel.js')

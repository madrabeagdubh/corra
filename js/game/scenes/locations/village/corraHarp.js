// corraHarp.js
// Location: js/game/scenes/locations/village/corraHarp.js
//
// Self-contained harp overlay module for Corra.
// Mounts a DOM overlay with a Phaser harp instance on top of the game canvas.
// Designed to be imported and driven from VillageScene or any future scene.
//
// Usage:
//   import { CorraHarp } from './corraHarp.js'
//   const harp = new CorraHarp(scene)
//   harp.open()
//   harp.on('pluck', ({ midi, string }) => { ... })
//   harp.on('close', () => { ... })
//   harp.close()
//
// Events emitted:
//   'pluck'       — { midi, stringIndex, velocity, sharp } when player plucks a string
//   'close'       — when overlay is dismissed
//   'ready'       — when Phaser instance is fully initialised
//
// ── Sharps ──────────────────────────────────────────────────────────────
// Sharps are AUTOMATIC, not player-controlled. There is no toggle/lever/
// badge. When a scripted phrase (see harpPhrasePlayer.js) is playing and
// a beat needs a sharped pitch on some string, the harp scene is told
// "the next pluck on this string should sound sharp" via a small hint
// hook (`setSharpHint` / the `getSharpHint` callback below) just before
// that beat arrives. Free, unscripted plucking (no tune driving it) has
// no hint registered and always sounds the natural pitch. This replaces
// an earlier design with a global manual toggle + mismatch badge, which
// playtesting showed was hard to use and easy to get wrong — see git
// history if that design needs to be revisited.
//
// ── Moon widget on top of the harp ────────────────────────────────────
// The harp overlay sits at z-index:2000000 — above the joystick's
// z-index:1000004, which normally means the moon widget (embedded in
// the joystick's hub) is invisible behind it. Per explicit design call,
// open()/close() now call joystick.js's elevateMoon()/restoreMoon() so
// the SAME moon widget instance (same GameSettings.englishOpacity
// wiring, same swipe/tap/long-press physics) temporarily escapes the
// joystick's normal stacking context and renders/works on top of this
// overlay instead — letting the player fade English text (and, per the
// bard-mode design this enables, dim non-gold strings / intensify
// ghostly stage visuals) without leaving the harp. hideDirections()/
// showDirections() hide just the 4 cardinal d-pad buttons, which have
// no use here — only the moon hub itself elevates.

import Phaser from 'phaser'

// ── The 9 pitches the song uses ────────────────────────────────────────────
// G mixolydian, octave + fifth: G4 to D6 (13 strings).
// Ordered HIGH→LOW in the array so index 0 (top of screen) = highest note,
// matching a harp stood upright: treble at the top, bass at the bottom.
// Colour convention: G=white (tonic, every octave), C=red, F=blue (b7)
// `sharpM` (optional): MIDI pitch this string sounds when a scripted
// phrase flags the upcoming beat as needing the sharp. Only F strings
// have one for now — see file header.
const STR = [
  { m: 86, l: 'D', c: '#c8c0aa' },                       // D6  — top (highest)
  { m: 84, l: 'C', c: '#ff4422' },                       // C6  — red
  { m: 83, l: 'B', c: '#c8c0aa' },                       // B5
  { m: 81, l: 'A', c: '#c8c0aa' },                       // A5
  { m: 79, l: 'G', c: '#ffffff' },                       // G5  — white (tonic)
  { m: 77, l: 'F', c: '#5588ff', sharpM: 78, sl: 'F♯' },  // F5  — blue (b7)
  { m: 76, l: 'E', c: '#c8c0aa' },                       // E5
  { m: 74, l: 'D', c: '#c8c0aa' },                       // D5
  { m: 72, l: 'C', c: '#ff4422' },                       // C5  — red
  { m: 71, l: 'B', c: '#c8c0aa' },                       // B4
  { m: 69, l: 'A', c: '#c8c0aa' },                       // A4
  { m: 67, l: 'G', c: '#ffffff' },                       // G4  — white (tonic)
  { m: 65, l: 'F', c: '#5588ff', sharpM: 66, sl: 'F♯' },  // F4  — blue, bottom (lowest)
]
const N = STR.length

// ── Geometry ───────────────────────────────────────────────────────────────
// 20° from horizontal — strings run mostly left-right across screen.
// Pluck direction is nearly vertical (up/down finger motion), which is
// natural and gives a wide draw range on a phone screen.
//
// Each string tilts HIGH-on-the-left, LOW-on-the-right (per explicit
// request) — SY is positive here, meaning y INCREASES (moves down the
// screen) as you move in the positive-SX direction (left to right).
// This is independent of the harp's overall sweep (highest-pitched
// string at the top, lowest at the bottom), which is set separately by
// the AX1/AY1 → AX2/AY2 anchor progression in _buildStrings and is
// NOT changed by this constant.
//
// IMPORTANT: (PX,PY) MUST stay perpendicular to (SX,SY). _nearStr's hit
// detection (px-ax)*PX + (py-ay)*PY is only a valid "distance from this
// touch point to the string's actual line" measure when that holds —
// it's the standard point-to-line projection formula, and it being
// correct for ALL touch points along the string's length (not just
// near the anchor) depends entirely on PX/PY being the true unit
// perpendicular to the string's real direction. When SY's sign was
// first flipped (to reverse the string tilt) without ALSO flipping
// PX/PY to match, the dot product of the two vectors went from 0 to
// ~0.64 — no longer perpendicular at all — which silently broke hit
// detection for any touch far from a string's anchor point (i.e.
// anywhere away from screen center, which on a phone is most of the
// usable surface). That's a real, separate bug from the visual tilt
// change itself: the strings LOOKED right but couldn't be reliably
// plucked away from center, exactly matching "hit area is off" reports
// after the angle reversal.
const ANG = 20 * Math.PI / 180
const SX  =  Math.cos(ANG)   //  0.940 — mostly horizontal
const SY  =  Math.sin(ANG)   //  0.342 — slight DOWNWARD tilt left-to-right
const PX  = -Math.sin(ANG)   // -0.342 — true perpendicular to (SX,SY) above
const PY  =  Math.cos(ANG)   //  0.940 — (downward drag still reads as positive perp, unchanged feel)
const STRUM_CD = 30

// ── Karplus-Strong audio ───────────────────────────────────────────────────
class HarpAudio {
  constructor() { this.ctx = null; this.rev = null; this._rp = null }

  async _ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)()
      const ac = this.ctx, r = ac.sampleRate, l = Math.floor(r * 2.0)
      const b  = ac.createBuffer(2, l, r)
      for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c)
        for (let i = 0; i < l; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / l, 1.9)
      }
      const cv = ac.createConvolver(); cv.buffer = b
      const wg = ac.createGain();      wg.gain.value = 0.2
      cv.connect(wg); wg.connect(ac.destination)
      this.rev = cv
    }
    if (this.ctx.state !== 'running') {
      if (!this._rp) this._rp = this.ctx.resume().then(() => { this._rp = null })
      await this._rp
    }
  }

  _ks(freq, vel) {
    const sr  = this.ctx.sampleRate
    const dur = 1.4 + vel * 5.5
    const tot = Math.floor(sr * dur)
    const buf = this.ctx.createBuffer(1, tot, sr)
    const out = buf.getChannelData(0)
    // Nk floor of 64 silently clamps any freq above sr/64 (~689Hz at 44.1kHz)
    // to the same pitch — our harp's top strings (G5–D6, 784–1175Hz) all
    // collapsed onto one note. Use fractional delay (linear interpolation
    // between two integer taps) so high frequencies stay accurate instead
    // of needing a higher integer floor.
    const NkFloat = sr / freq
    const Nk      = Math.max(8, Math.floor(NkFloat))
    const frac     = NkFloat - Nk
    // Delay line sized Nk+1 so we always have a clean "next" tap even
    // when using fractional interpolation below.
    const lineLen = Nk + 1
    const dl = new Float32Array(lineLen)
    for (let i = 0; i < lineLen; i++) {
      const w = 0.5 * (1 - Math.cos(2 * Math.PI * i / lineLen))
      dl[i] = (Math.random() * 2 - 1) * w * vel
    }
    const decay = 0.988 + vel * 0.009
    let pos = 0
    for (let n = 0; n < tot; n++) {
      const nx = (pos + 1) % lineLen
      // Linear-interpolated tap for the fractional part of the period —
      // keeps pitch accurate even for short (high-frequency) delay lines.
      const nx2  = (pos + 2) % lineLen
      const tap1 = dl[nx]
      const tap2 = dl[nx2]
      const interp = tap1 + frac * (tap2 - tap1)
      const avg  = (dl[pos] + interp) * 0.5 * decay
      out[n] = avg; dl[pos] = avg; pos = nx
    }
    return buf
  }

  async play(midi, vel, when) {
    await this._ensure()
    const ac   = this.ctx, now = when ?? ac.currentTime
    const freq = 440 * Math.pow(2, (midi - 69) / 12)
    const v    = Math.max(0.2, vel)
    const src  = ac.createBufferSource()
    src.buffer = this._ks(freq, v)
    const g = ac.createGain(); g.gain.setValueAtTime(0.35 + v * 0.65, now)
    src.connect(g); g.connect(ac.destination); g.connect(this.rev)
    src.start(now)
  }

  // A short, low percussive thump — bodhrán-style click track, used to
  // help the player feel the tune's beat independent of the visual orbs.
  // `accent` (0..1) makes downbeats louder/lower than off-beats.
  async playClick(accent = 0.6, when) {
    await this._ensure()
    const ac  = this.ctx, now = when ?? ac.currentTime
    const dur = 0.09
    const tot = Math.floor(ac.sampleRate * dur)
    const buf = ac.createBuffer(1, tot, ac.sampleRate)
    const out = buf.getChannelData(0)
    for (let i = 0; i < tot; i++) {
      const env = Math.pow(1 - i / tot, 3.2)
      out[i] = (Math.random() * 2 - 1) * env
    }
    const src = ac.createBufferSource()
    src.buffer = buf

    // Low-pass to give it body/thump rather than a sharp click
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 280 + accent * 180   // accented beats a touch brighter
    lp.Q.value = 0.7

    const g = ac.createGain()
    g.gain.setValueAtTime(0.18 + accent * 0.22, now)

    src.connect(lp); lp.connect(g); g.connect(ac.destination)
    src.start(now)
  }

  destroy() {
    if (this.ctx) { this.ctx.close(); this.ctx = null }
  }
}

// ── Phaser scene ───────────────────────────────────────────────────────────
class HarpScene extends Phaser.Scene {
  constructor(onPluck, onReady) {
    super('CorraHarpScene')
    this._onPluck = onPluck
    this._onReady = onReady
    // Optional callback: (stringIndex) => boolean. Asked at the moment a
    // string fires; if it returns true and that string has a sharpM, the
    // pluck sounds sharp. Registered by HarpPhrasePlayer while a scripted
    // tune is running; left null during free play, so untouched strings
    // always sound natural. See file header.
    this._getSharpHint = null
    // Optional callback: (stringIndex) => {type,count}|null. Same idea as
    // _getSharpHint — asked at the moment a string fires, tells the harp
    // whether THIS pluck should play as an ornamented flourish instead of
    // a plain strike, and which kind. Registered by HarpPhrasePlayer while
    // a scripted tune is running; null during free play, so untouched
    // strings always play as plain single strikes. See playOrnament.
    this._getOrnamentHint = null
    // Current tune tempo (ms per duration-unit) — used only to scale
    // ornament internal timing (see playOrnament). Set once per phrase
    // via setTempoMs; defaults to a sane value for free play / before
    // any tune has set it.
    this._tempoMs = 300
  }

  // Register the current tune's tempo (ms per duration-unit), so
  // ornament flourishes scale proportionally instead of always playing
  // at a fixed speed regardless of how fast/slow the tune itself is.
  setTempoMs(ms) { if (ms > 0) this._tempoMs = ms }

  // Register (or clear, by passing null) the ornament-hint callback.
  setOrnamentHintFn(fn) { this._getOrnamentHint = fn || null }

  // Register (or clear, by passing null) the sharp-hint callback. See
  // constructor comment and file header for the model this implements.
  setSharpHintFn(fn) { this._getSharpHint = fn || null }

  create() {
    this.audio   = new HarpAudio()
    this.strings = []
    this._ptrs   = {}

    this._bg()
    this._buildStrings()
    this._input()

    this._onReady?.()
  }

  _bg() {
    // Transparent — tavern scene shows through the overlay.
    // Just a subtle dark vignette at edges to help strings read against
    // complex backgrounds.
    const { width: W, height: H } = this.scale
    const g = this.add.graphics()
    // Dark edge vignette
    g.fillStyle(0x000000, 0.18)
    g.fillRect(0, 0, W * 0.08, H)   // left edge
    g.fillRect(W * 0.92, 0, W * 0.08, H)  // right edge
  }

  _buildStrings() {
    const { width: W, height: H } = this.scale
    // Strings spread top-to-bottom by PITCH (highest-pitched string near
    // the top, lowest near the bottom — via the AX1/AY1 → AX2/AY2 anchor
    // progression below; unchanged from before). Each individual string
    // is ALSO tilted ~20°, but slanting HIGH-on-the-left to LOW-on-the-
    // right (see SY's sign above) — i.e. each string's own left end sits
    // higher on screen than its right end. This was an explicit reversal
    // from an earlier version where each string tilted the other way
    // (low-left/high-right); only the per-string tilt direction changed,
    // the overall top-to-bottom pitch sweep was deliberately left as-is.
    const MARGIN  = H * 0.08
    const AX1 = W * 0.55, AY1 = MARGIN
    const AX2 = W * 0.45, AY2 = H - MARGIN
    const DAX = (AX2 - AX1) / (N - 1)
    const DAY = (AY2 - AY1) / (N - 1)
    const EXT = W * 1.1   // extend past screen edges horizontally

    STR.forEach((s, i) => {
      const ax = AX1 + i * DAX, ay = AY1 + i * DAY
      const x1 = ax - SX * EXT, y1 = ay - SY * EXT
      const x2 = ax + SX * EXT, y2 = ay + SY * EXT
      const isBlue = s.c === '#5588ff', isRed = s.c === '#ff4422', isWht = s.c === '#ffffff'
      const thick  = isWht ? 2.5 : (isRed || isBlue) ? 1.8 : 1.2
      const baseA  = isRed ? 0.65 : isBlue ? 0.7 : isWht ? 0.7 : 0.35
      const maxDraw = 50 + (i / (N - 1)) * 20  // 50-70px — generous, consistent draw range
      const decay   = 0.11 + (1 - i / (N - 1)) * 0.22
      const col     = Phaser.Display.Color.HexStringToColor(s.c)

      const gfx = this.add.graphics().setDepth(2)
      const vfx = this.add.graphics().setDepth(3)
      const lbl = this.add.text(ax + PX * 28, ay + PY * 28, s.l, {
        fontSize: '9px', color: s.c, fontFamily: 'Georgia'
      }).setOrigin(0.5).setAlpha(0.6).setDepth(5)

      gfx.lineStyle(thick, col.color, baseA)
      gfx.beginPath(); gfx.moveTo(x1, y1); gfx.lineTo(x2, y2); gfx.strokePath()

      this.strings.push({
        i, midi: s.m, sharpMidi: s.sharpM, label: s.l, sharpLabel: s.sl, colour: s.c,
        ci: col.color, thick, baseA, maxDraw,
        ax, ay, x1, y1, x2, y2,
        gfx, vfx, lbl,
        st: { amp: 0, vel: 0, decay }
      })
    })
  }

  // (Pitch resolution for a given sharp-want now lives in _strike, shared
  // between real input and demo mode — see below.)

  // Brief visual cue that THIS pluck sounded sharp — a quick tint/label
  // flash on the string itself, not a persistent mode change (there is
  // no mode). Settles back to the natural label/colour on its own once
  // the string's vibration decays past the redraw threshold in update().
  _flashSharpCue(s) {
    if (!s.sharpLabel) return
    s.lbl.setText(s.sharpLabel)
    s.gfx.clear()
    s.gfx.lineStyle(s.thick, 0xb47bff, Math.min(1, s.baseA + 0.25))
    s.gfx.beginPath(); s.gfx.moveTo(s.x1, s.y1); s.gfx.lineTo(s.x2, s.y2); s.gfx.strokePath()
    // Revert label once the vibration has settled (mirrors the existing
    // redraw-on-settle branch in update(), so this doesn't fight it).
    s._sharpCueActive = true
  }

  _nearStr(px, py) {
    let b = 0, bd = Infinity
    for (let i = 0; i < N; i++) {
      const { ax, ay } = this.strings[i]
      const d = Math.abs((px - ax) * PX + (py - ay) * PY)
      if (d < bd) { bd = d; b = i }
    }
    return b
  }

  _fire(idx, vel) {
    if (vel < 0.04) return
    const s = this.strings[idx]; if (!s) return
    // Debounce: ignore if this string fired within 40ms (was 80ms).
    // This exists to absorb accidental double-fires from one physical
    // touch (sensor jitter), NOT to block two genuinely separate,
    // deliberate plucks. 80ms turned out to be long enough to do both —
    // bard mode can legitimately need the same string plucked twice in
    // a row for two different consecutive gestures (e.g. two
    // back-to-back single-note groups that both land on string 6), and
    // a player moving at a normal pace could easily land the second
    // pluck within that old window, which silently swallowed it
    // entirely (this function returns BEFORE emitting the 'pluck'
    // event, so bardAccompaniment.js never even learned a pluck
    // happened) — exactly matching "ran out of gold strings to pluck"
    // even though the string was lit and the player was hitting it.
    // 40ms is still comfortably longer than any plausible jitter-only
    // double-fire, while leaving enough room for fast deliberate replay.
    const now = Date.now()
    if (s._lastFired && now - s._lastFired < 40) return
    s._lastFired = now
    const wantsSharp = !!this._getSharpHint?.(idx)
    const ornament   = this._getOrnamentHint?.(idx) ?? null
    const playedSharp = this.playOrnament(idx, vel, wantsSharp, ornament, this._tempoMs)
    const playMidi = playedSharp ? s.sharpMidi : s.midi

    // Emit pluck event to CorraHarp — only real player input does this;
    // demo mode (see demoStrike) intentionally skips it, since there's no
    // rhythm-game state to resolve when notes are playing automatically.
    this._onPluck?.({ midi: playMidi, stringIndex: idx, velocity: vel, sharp: playedSharp })
  }

  // Shared visual+audio playback for one string: vibration, particles,
  // sharp flash (if applicable), and the actual synth note. Used by both
  // real player input (_fire, via the sharp-hint callback) and demo mode
  // (demoStrike, via an explicit sharp flag — no hint needed since demo
  // mode already knows ground truth from the tune data). Returns whether
  // it actually played sharp (false if this string has no sharp variant
  // regardless of what was requested).
  _strike(idx, vel, wantsSharp) {
    const s = this.strings[idx]; if (!s) return false
    s.st.amp = s.maxDraw * vel
    s.st.vel = vel
    const canSharp = s.sharpMidi !== undefined
    const playedSharp = canSharp && wantsSharp
    const playMidi = playedSharp ? s.sharpMidi : s.midi
    if (playedSharp) this._flashSharpCue(s)
    this.audio.play(playMidi, vel)

    // Particles
    if (vel > 0.12) {
      const cnt = Math.round(1 + vel * 5)
      for (let p = 0; p < cnt; p++) {
        const d = this.add.graphics().setDepth(6)
        d.fillStyle(s.ci, 0.4 + vel * 0.45)
        d.fillCircle(0, 0, 0.6 + vel * 1.6)
        d.x = s.ax + (Math.random() - 0.5) * 16
        d.y = s.ay + (Math.random() - 0.5) * 16
        this.tweens.add({
          targets: d,
          x: d.x + (Math.random() - 0.5) * 28 * vel,
          y: d.y + (Math.random() - 0.5) * 28 * vel,
          alpha: 0, duration: 90 + vel * 180, ease: 'Power2',
          onComplete: () => d.destroy()
        })
      }
    }
    return playedSharp
  }

  // ── Demo mode ─────────────────────────────────────────────────────────
  // Strikes a string with a known, explicit sharp flag and ornament (no
  // hint lookup, no debounce, no 'pluck' event) — used by HarpPhrasePlayer's
  // autoPlay mode to play a tune's notes exactly as written, ornaments
  // included, so the player can hear what it's supposed to sound like
  // independent of their own timing/aim.
  demoStrike(idx, sharp, vel = 0.55, ornament = null) {
    this.playOrnament(idx, vel, !!sharp, ornament, this._tempoMs)
  }

  // ── Ornaments ────────────────────────────────────────────────────────
  // Plays a short, scripted flourish in place of a single strike — used
  // for beats that represent ornamentation rather than one plain note
  // (see abcToTimedStringSequence's `ornaments` output). The PLAYER still
  // only does one pluck for the whole beat; this is what the harp plays
  // back automatically in response, same idea as a real trad musician
  // adding rolls/triplet ornaments on top of the tune's actual notes.
  //
  // `ornament` shape: { type: 'triplet'|'roll'|'cut', count }
  //   Sources, from abcToTimedStringSequence: same-pitch (N tuplets become
  //   'triplet'; a ~ marker or a multi-note {..} grace cluster becomes
  //   'roll'; a single-note {x} grace cut becomes 'cut'.
  //   triplet — rapid same-string re-strikes (the classic "same note,
  //             three times, fast" ornamental triplet), decreasing
  //             velocity so it reads as one decorated gesture rather than
  //             three equally-weighted notes. Spaced across a window that
  //             SCALES with the tune's tempo (tempoMs, typically the
  //             phrase's unitMs) rather than a fixed constant — at a
  //             slower tempo a triplet flourish should breathe a bit
  //             more too, or it ends up feeling MORE rushed relative to
  //             everything around it as the tune slows down, not less.
  //   roll    — the standard trad "cut" turn: main note, quick upper
  //             neighbour (the string one step up — strings are stored
  //             high-to-low and adjacent-by-step, see STR comment, so
  //             that's simply idx-1), back to main note. Very fast and
  //             quiet on the middle note, like a finger-flick rather than
  //             a deliberate pluck — also scales with tempoMs, though
  //             less aggressively than a triplet (a roll's grace note is
  //             always brisk relative to the main note, even in a slow air).
  // `tempoMs`: the tune's current ms-per-duration-unit (i.e. its unitMs).
  // Used only to scale ornament internal timing — defaults to a sane
  // value if omitted so callers that don't pass it don't break.
  // Returns the same playedSharp boolean _strike does, for the FIRST
  // (main) note — that's what matters for the 'pluck' event's sharp flag.
  playOrnament(idx, vel, wantsSharp, ornament, tempoMs = 300) {
    if (!ornament) return this._strike(idx, vel, wantsSharp)

    if (ornament.type === 'triplet') {
      const n = Math.max(2, ornament.count || 3)
      // Scales with tempo: roughly 45% of one duration-unit's time,
      // clamped to a sane range so it's never so fast it's inaudible as
      // distinct notes, nor so slow it stops feeling like ornamentation
      // and starts feeling like the actual melody.
      const totalMs = Math.max(140, Math.min(420, tempoMs * 0.45))
      // Velocities taper down across the group, mirroring the natural
      // decay of a quick repeated pluck rather than N equal hits.
      let playedSharp = false
      for (let k = 0; k < n; k++) {
        const v = vel * (1 - k * 0.18)
        const fire = () => { const ps = this._strike(idx, Math.max(0.15, v), wantsSharp); if (k === 0) playedSharp = ps }
        if (k === 0) fire()
        else this.time.delayedCall((totalMs / n) * k, fire)
      }
      const canSharp = this.strings[idx]?.sharpMidi !== undefined
      return wantsSharp && canSharp
    }

    if (ornament.type === 'cut') {
      // A cut: a single quick grace note (the standard ABC {x}note
      // single-grace-note cut) played just BEFORE the main note, rather
      // than the roll's after-and-back figure. Uses the same adjacent-
      // string convention as roll (see roll's comment) since we don't
      // carry the grace note's actual written pitch through — only how
      // many grace notes there were. Quiet and very brief.
      const upperIdx = Math.max(0, idx - 1)
      const cutMs = Math.max(30, Math.min(110, tempoMs * 0.14))
      this._strike(upperIdx, vel * 0.45, false)
      this.time.delayedCall(cutMs, () => this._strike(idx, vel, wantsSharp))
      // The main note plays slightly AFTER the cut, so its actual
      // playedSharp result arrives via a delayed closure — but the
      // 'pluck' event (in _fire) needs a same-tick boolean. Compute it
      // directly here instead of threading the delayed result back out.
      const canSharp = this.strings[idx]?.sharpMidi !== undefined
      return wantsSharp && canSharp
    }

    if (ornament.type === 'roll') {
      const upperIdx = Math.max(0, idx - 1)
      const playedSharp = this._strike(idx, vel, wantsSharp)
      // Scales more gently than the triplet — a roll's grace notes stay
      // brisk even when the tune itself is slow, but shouldn't feel
      // exactly tempo-independent either.
      const graceMs = Math.max(40, Math.min(140, tempoMs * 0.18))
      const closeMs = Math.max(80, Math.min(260, tempoMs * 0.35))
      // Upper neighbour: quick, quiet, natural pitch (rolls conventionally
      // don't carry the sharp through to the grace note) — then back to
      // the main note to close the figure.
      this.time.delayedCall(graceMs, () => this._strike(upperIdx, vel * 0.5, false))
      this.time.delayedCall(closeMs, () => this._strike(idx, vel * 0.85, wantsSharp))
      return playedSharp
    }

    // Unknown ornament type — fall back to a plain strike rather than
    // silently doing nothing.
    return this._strike(idx, vel, wantsSharp)
  }

  // Registry for external modules (e.g. HarpPhrasePlayer) to draw on top
  // of the harp's own canvas, in the same coordinate space as the strings.
  _overlayDraws = []
  registerOverlayDraw(fn)   { this._overlayDraws.push(fn) }
  unregisterOverlayDraw(fn) { this._overlayDraws = this._overlayDraws.filter(f => f !== fn) }

  update() {
    const ap = {}
    Object.values(this._ptrs).forEach(p => { if (p.si !== null && !p.strum) ap[p.si] = p.da })

    this.strings.forEach((s, i) => {
      const st = s.st
      s.vfx.clear()

      // V-kink while drawing
      if (ap[i] !== undefined && Math.abs(ap[i]) > 0.8) {
        const da = ap[i], pull = Math.abs(da) / s.maxDraw
        const kx = s.ax + PX * da, ky = s.ay + PY * da
        s.gfx.clear()
        // Use gold if the string is currently bard-highlighted, so the
        // draw-back visual stays gold throughout the gesture rather than
        // reverting to native color while the player holds the string.
        const drawColor = s._goldHighlighted ? 0xffcc33 : s.ci
        const drawAlpha = s._goldHighlighted ? (0.5 + pull * 0.5) : (0.3 + pull * 0.6)
        s.gfx.lineStyle(s.thick + pull * 2.4, drawColor, drawAlpha)
        s.gfx.beginPath(); s.gfx.moveTo(s.x1, s.y1); s.gfx.lineTo(kx, ky); s.gfx.lineTo(s.x2, s.y2); s.gfx.strokePath()
        s.vfx.fillStyle(s._goldHighlighted ? 0xffcc33 : s.ci, 0.1 + pull * 0.12)
        s.vfx.fillCircle(kx, ky, 3 + pull * 11)
        return
      }

      // Vibration
      if (st.amp > 0.2) {
        const A = st.amp, v = st.vel, AMB = 0xffcc44
        const oA = (0.09 + v * 0.2) * (A / s.maxDraw)
        s.vfx.lineStyle(1, AMB, oA)
        s.vfx.beginPath(); s.vfx.moveTo(s.x1 + PX * A, s.y1 + PY * A); s.vfx.lineTo(s.x2 + PX * A, s.y2 + PY * A); s.vfx.strokePath()
        s.vfx.beginPath(); s.vfx.moveTo(s.x1 - PX * A, s.y1 - PY * A); s.vfx.lineTo(s.x2 - PX * A, s.y2 - PY * A); s.vfx.strokePath()
        const steps = Math.max(2, Math.ceil(A / 2))
        for (let k = 0; k <= steps; k++) {
          const oa = Phaser.Math.Linear(-A, A, k / steps)
          const ef = 1 - Math.abs(k / steps - 0.5) * 1.8
          s.vfx.lineStyle(1, AMB, (0.04 + v * 0.09) * (A / s.maxDraw) * Math.max(0, ef))
          s.vfx.beginPath(); s.vfx.moveTo(s.x1 + PX * oa, s.y1 + PY * oa); s.vfx.lineTo(s.x2 + PX * oa, s.y2 + PY * oa); s.vfx.strokePath()
        }
        const fl = (Math.random() - 0.5) * A * 0.16
        s.vfx.lineStyle(s.thick + 0.5, s.ci, 0.6 + v * 0.32)
        s.vfx.beginPath(); s.vfx.moveTo(s.x1 + PX * fl, s.y1 + PY * fl); s.vfx.lineTo(s.x2 + PX * fl, s.y2 + PY * fl); s.vfx.strokePath()
        st.amp = Math.max(0, st.amp - st.decay * (1.4 - v * 0.55))
        if (st.amp < 0.2) {
          st.amp = 0
          s.gfx.clear()
          // Restore whichever appearance is CURRENTLY correct for this
          // string — gold if it's still meant to be highlighted (see
          // highlightString's s._goldHighlighted tracking), otherwise
          // its plain native color. Previously this unconditionally
          // reset to native color, which silently erased gold highlights
          // any time a highlighted string's own pluck-wobble finished
          // decaying — independent of whatever bardAccompaniment.js's
          // actual light/unlight calls were doing.
          if (s._goldHighlighted) {
            s.gfx.lineStyle(s.thick + 2.5, 0xffcc33, 0.95)
          } else {
            s.gfx.lineStyle(s.thick, s.ci, s.baseA)
          }
          s.gfx.beginPath(); s.gfx.moveTo(s.x1, s.y1); s.gfx.lineTo(s.x2, s.y2); s.gfx.strokePath()
          if (s._sharpCueActive) {
            s.lbl.setText(s.label)
            s._sharpCueActive = false
          }
        }
      }
    })

    // Draw any registered overlays (phrase player fill-bars, etc.)
    if (this._overlayDraws.length) {
      const ctx = this.game.canvas.getContext('2d')
      // Phaser uses its own renderer; for canvas overlays we draw via a
      // dedicated graphics object refreshed each frame instead of raw ctx,
      // since Phaser WebGL/Canvas renderer owns the actual canvas context.
      if (!this._overlayGfx) this._overlayGfx = this.add.graphics().setDepth(20)
      this._overlayGfx.clear()
      this._overlayDraws.forEach(fn => fn(this._overlayGfx))
    }
  }

  _shl(idx, on) {
    const s = this.strings[idx]; if (!s) return
    s.gfx.clear()
    if (on) {
      s.gfx.lineStyle(s.thick + 1.5, s.ci, 0.65)
      s.gfx.beginPath(); s.gfx.moveTo(s.x1, s.y1); s.gfx.lineTo(s.x2, s.y2); s.gfx.strokePath()
      s.vfx.clear(); s.vfx.fillStyle(s.ci, 0.4); s.vfx.fillCircle(s.ax, s.ay, 6)
    } else {
      // Restore whichever appearance is correct: gold if currently
      // highlighted by bard mode, otherwise native color. Without this,
      // releasing a touch after drawing back a gold string would
      // immediately stomp it back to native color (via s.ci) before the
      // wobble animation even started — same class of bug as in the
      // wobble-decay-end code above.
      if (s._goldHighlighted) {
        s.gfx.lineStyle(s.thick + 2.5, 0xffcc33, 0.95)
      } else {
        s.gfx.lineStyle(s.thick, s.ci, s.baseA)
      }
      s.gfx.beginPath(); s.gfx.moveTo(s.x1, s.y1); s.gfx.lineTo(s.x2, s.y2); s.gfx.strokePath()
    }
  }

  _input() {
    this.input.addPointer(9)

    const dn = p => {
      if (p.y < 20) return
      this.audio._ensure()
      const i = this._nearStr(p.x, p.y)
      this._shl(i, true)
      // Measure draw-back from the ACTUAL touch point (p.x,p.y), not the
      // string's fixed anchor — otherwise touching far from the anchor
      // gives inconsistent draw amounts for the same physical finger motion.
      this._ptrs[p.id] = {
        si: i, sax: p.x, say: p.y,   // touch-down point is the reference
        da: 0, pd: 0, fired: false,
        strum: false,
        lx: p.x, ly: p.y, lt: Date.now(), cd: {}
      }
    }

    const mv = p => {
      const q = this._ptrs[p.id]; if (!q) return
      const now = Date.now(), dt = Math.max(1, now - q.lt)
      const dx  = p.x - q.sax, dy = p.y - q.say

      // Perpendicular displacement = draw-back amount
      const perp  = dx * PX + dy * PY
      // Along-string motion = strum trigger
      const along = Math.abs(dx * SX + dy * SY)

      if (q.si !== null && !q.strum) {
        q.da = perp
        if (Math.abs(perp) > Math.abs(q.pd)) q.pd = perp
      }

      // Strum: finger slides along string direction past threshold
      if (q.strum) {
        const cur = this._nearStr(p.x, p.y)
        const lf  = q.cd[cur] || 0
        const spd = Math.sqrt((p.x - q.lx) ** 2 + (p.y - q.ly) ** 2) / dt
        if (now - lf > STRUM_CD) {
          q.cd[cur] = now
          this._fire(cur, Math.min(1, 0.25 + spd * 0.18))
        }
      } else if (q.si !== null) {
        // Decide strum vs draw based on which axis dominates, not an
        // absolute threshold. A draw can have some along-string drift —
        // what matters is whether the gesture is CLEARLY more sideways
        // than perpendicular. Require both a minimum along distance AND
        // a ratio showing sideways motion dominates.
        const absAlong = Math.abs(along)
        const absPerp  = Math.abs(perp)
        if (absAlong > 30 && absAlong > absPerp * 1.6) {
          this._shl(q.si, false)
          q.strum = true; q.si = null
        }
      }

      q.lx = p.x; q.ly = p.y; q.lt = now
    }

    const up = p => {
      const q = this._ptrs[p.id]; if (!q) return
      if (q.si !== null && !q.strum) {
        const s = this.strings[q.si]
        if (s) {
          this._shl(q.si, false)
          const drawVel = Math.abs(q.da) / s.maxDraw
          if (drawVel > 0.12) {
            // Drawn back — fire at draw velocity
            this._fire(q.si, Math.min(1, drawVel * 1.4))
          } else {
            // Quick tap — fire at medium velocity
            this._fire(q.si, 0.45)
          }
        }
      }
      delete this._ptrs[p.id]
    }

    this.input.on('pointerdown',     dn)
    this.input.on('pointermove',     mv)
    this.input.on('pointerup',       up)
    this.input.on('pointerupoutside', up)
  }

  // Highlight a specific string. Two distinct looks depending on
  // `pulse`:
  //   pulse=false — the ORIGINAL look (native string color, slightly
  //     thicker), used by harpPhrasePlayer.js to mark which string a
  //     launched orb is heading for. Left exactly as it was; the orb
  //     game already has its own tuned visual language (queue colors,
  //     sharp halos, ornament rings) and changing this would bleed into
  //     that unintentionally.
  //   pulse=true — bard-accompaniment mode's "pluck this" cue. Uses a
  //     fixed GOLD color rather than the string's own native color
  //     (white/red/blue, see STR's color convention): using the native
  //     color made the highlight read as "this string got slightly
  //     thicker," not "this string wants attention" — a white string
  //     highlighted in white barely changes. Gold is distinct from
  //     every existing string color and from the violet sharp-pluck
  //     flash / teal ornament halo used elsewhere, so it reads
  //     unambiguously as its own cue. SOLID, no breathing/pulse
  //     animation — an earlier version animated alpha here, but per
  //     explicit feedback the animation added visual noise without
  //     adding clarity; plain solid gold is enough on its own. This also
  //     removes an entire class of Phaser-tween-lifecycle bugs (stacked
  //     tweens, killTweensOf race conditions) that only existed because
  //     there was a tween to manage in the first place.
  highlightString(idx, on, pulse = false) {
    const s = this.strings[idx]; if (!s) return
    // Still defensively stop any leftover tween from an OLDER version of
    // this method that might have left one running on a string (e.g.
    // hot-reload during development) — harmless no-op otherwise now
    // that nothing here creates new tweens.
    if (s._pulseTween) {
      s._pulseTween.stop()
      s._pulseTween = null
    }
    // Track gold-highlight state PERSISTENTLY on the string, not just as
    // a one-off draw. This matters because the per-frame wobble/vibration
    // render loop (see the "Vibration" block further down) redraws s.gfx
    // from scratch whenever a string's pluck-decay animation finishes —
    // and until this flag existed, that code always reset the string back
    // to its plain native color, with no way to know a gold highlight
    // should be restored instead. That's what caused "strings stopped
    // showing gold after only a few notes": plucking ANY string (including
    // via demoStrike, used to auto-sound the rest of a chord — see
    // bardAccompaniment.js) plays its wobble animation, and once that
    // decayed, this is the code that was silently erasing gold highlights
    // out from under the bard engine, independent of the engine's own
    // light/unlight calls.
    s._goldHighlighted = pulse && on
    if (on) {
      const color = pulse ? 0xffcc33 : s.ci
      const alpha = pulse ? 0.95 : 0.85
      s.gfx.setAlpha(1)
      s.gfx.clear()
      s.gfx.lineStyle(s.thick + 2.5, color, alpha)
      s.gfx.beginPath(); s.gfx.moveTo(s.x1, s.y1); s.gfx.lineTo(s.x2, s.y2); s.gfx.strokePath()
    } else {
      s.gfx.setAlpha(1)
      s.gfx.clear()
      s.gfx.lineStyle(s.thick, s.ci, s.baseA)
      s.gfx.beginPath(); s.gfx.moveTo(s.x1, s.y1); s.gfx.lineTo(s.x2, s.y2); s.gfx.strokePath()
    }
  }

  destroy() {
    this.audio?.destroy()
    super.destroy()
  }
}

// (Sharp badge removed — sharps are automatic now, see file header.
// If a per-string lever UI is ever wanted, this is roughly where it'd go.)

// ── Public API ─────────────────────────────────────────────────────────────
export class CorraHarp {
  constructor(parentScene) {
    this._scene    = parentScene
    this._overlay  = null
    this._game     = null
    this._harpScene = null
    this._listeners = {}
  }

  // Open the harp overlay
  open() {
    if (this._overlay) return
    if (this._scene.joystick) this._scene.joystick.reset()
    if (this._scene.player)   this._scene.player.isMoving = false

    // Bring the SAME moon widget (not a second instance) up above this
    // overlay's own z-index:2000000, so the player can still see/use it
    // while the harp is open — see joystick.js's elevateMoon() and this
    // file's header comment. Only the moon hub elevates; the 4 cardinal
    // d-pad buttons stay hidden via the existing hideDirections(), since
    // they have no use here.
    this._scene.joystick?.hideDirections()
    this._scene.joystick?.elevateMoon(2000001)

    // Dim wrapper
    const overlay = document.createElement('div')
    overlay.id = 'corra-harp-overlay'
    overlay.style.cssText = [
      'position:fixed;inset:0;',
      'z-index:2000000;',
      'background:rgba(3,8,16,0.0);',
      'display:flex;flex-direction:column;',
      'align-items:center;justify-content:center;',
      'transition:background 0.6s ease;',
      'touch-action:none;',
    ].join('')

    // Close button
    const closeBtn = document.createElement('button')
    closeBtn.textContent = '✕'
    closeBtn.style.cssText = [
      'position:absolute;top:16px;right:20px;',
      'background:none;border:none;',
      'color:rgba(200,190,170,0.5);font-size:1.4rem;',
      'cursor:pointer;z-index:10;font-family:Georgia,serif;',
      'transition:color 0.2s;',
    ].join('')
    closeBtn.addEventListener('pointerdown', () => this.close())
    overlay.appendChild(closeBtn)

    // Label
    const label = document.createElement('div')
    label.textContent = 'Cláirseach'
    label.style.cssText = [
      'position:absolute;top:20px;left:50%;transform:translateX(-50%);',
      'font-family:Georgia,serif;font-size:0.7rem;',
      'letter-spacing:0.2em;color:rgba(200,190,170,0.0);',
      'text-transform:uppercase;',
      'transition:color 0.8s ease;',
      'pointer-events:none;',
    ].join('')
    overlay.appendChild(label)

    // Canvas container for Phaser
    const container = document.createElement('div')
    container.style.cssText = [
      'position:absolute;inset:0;',
      'opacity:0;transition:opacity 0.5s ease;',
    ].join('')
    overlay.appendChild(container)

    document.body.appendChild(overlay)
    this._overlay   = overlay
    this._container = container
    this._label     = label

    // Boot Phaser inside the container — use actual viewport dimensions and
    // RESIZE mode so the internal coordinate space exactly matches the
    // screen pixels. FIT mode with a capped width caused a mismatch between
    // the scene's logical height (used for string geometry) and the actual
    // rendered/touch-mapped height, which made strings near one edge cluster
    // together and register as the same touch target.
    const W = window.innerWidth
    const H = window.innerHeight

    this._game = new Phaser.Game({
      type:            Phaser.AUTO,
      width:           W,
      height:          H,
      backgroundColor: 'transparent',
      parent:          container,
      transparent:     true,
      scene:           new HarpScene(
        (pluckData) => this._emit('pluck', pluckData),
        ()          => this._onHarpReady()
      ),
      input:  { touch: { capture: true }, activePointers: 10 },
      render: { pixelArt: false },
      audio:  { disableWebAudio: false },
      scale:  { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH }
    })

    // Keep canvas in sync with viewport changes (orientation, resize)
    this._resizeHandler = () => {
      this._game?.scale.resize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', this._resizeHandler)

    // Fade in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.style.background = 'rgba(3,8,16,0.55)'
      })
    })
  }

  _onHarpReady() {
    if (this._container) this._container.style.opacity = '1'
    if (this._label)     this._label.style.color = 'rgba(200,190,170,0.4)'
    this._harpScene = this._game?.scene?.getScene('CorraHarpScene')
    this._emit('ready', {})
  }

  // Register (or clear, by passing null) the sharp-hint callback that
  // HarpPhrasePlayer uses to flag "the next pluck on string X should
  // sound sharp." Proxies straight to the underlying HarpScene. Safe to
  // call before the scene exists — see HarpPhrasePlayer's start(), which
  // calls this after waiting for the 'ready' event, so this should always
  // have a live scene in practice, but the optional-chain keeps it safe
  // either way.
  setSharpHintFn(fn) { this._harpScene?.setSharpHintFn(fn) }

  // Register (or clear) the ornament-hint callback. See HarpScene's
  // constructor comment and playOrnament for what this drives.
  setOrnamentHintFn(fn) { this._harpScene?.setOrnamentHintFn(fn) }

  // Tell the harp the tune's current tempo (ms per duration-unit), so
  // ornament flourishes (triplets/rolls) scale their internal timing
  // proportionally instead of always playing at a fixed speed. See
  // HarpScene.setTempoMs / playOrnament.
  setTempoMs(ms) { this._harpScene?.setTempoMs(ms) }

  // Close and destroy
  close() {
    const overlay = this._overlay
    if (!overlay) return
    overlay.style.background = 'rgba(3,8,16,0)'
    if (this._container) this._container.style.opacity = '0'

    // Restore the joystick to its normal state — moon hub back to its
    // usual position:absolute-in-_root spot (restoreMoon() also forces a
    // fresh _reposition() pass), direction buttons visible again.
    this._scene.joystick?.restoreMoon()
    this._scene.joystick?.showDirections()

    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler)
      this._resizeHandler = null
    }
    setTimeout(() => {
      this._game?.destroy(true)
      this._game = null
      this._harpScene = null
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
      if (this._overlay === overlay) this._overlay = null
      this._emit('close', {})
    }, 500)
  }

  // Highlight a string by index (0-8) for guided prompts
  // pulse=true makes it glow rhythmically
  highlightString(idx, on, pulse = false) {
    this._harpScene?.highlightString(idx, on, pulse)
  }

  // Get string index for a given MIDI note (matches NATURAL pitches only —
  // sharped pitches aren't distinct STR entries, they're a modifier on the
  // same string, so this intentionally doesn't search sharpM values).
  stringForMidi(midi) {
    return STR.findIndex(s => s.m === midi)
  }

  // ── Overlay draw registration (for HarpPhrasePlayer and similar) ───────
  // fn receives a Phaser.GameObjects.Graphics instance each frame, already
  // cleared, in the same coordinate space as the strings.
  _registerOverlayDraw(fn)   { this._harpScene?.registerOverlayDraw(fn) }
  _unregisterOverlayDraw(fn) { this._harpScene?.unregisterOverlayDraw(fn) }

  // Exposes this harp's tuning range in the shape abcToPhrase.js expects:
  // { min, max, available: [{m, idx, sharpM?}, ...] } sorted by MIDI ascending.
  // Bodhrán-style click for external timing aids (e.g. HarpPhrasePlayer's
  // beat track). accent 0..1: higher = louder/brighter (downbeat feel).
  playClick(accent = 0.6) { this._harpScene?.audio?.playClick(accent) }

  // Strikes a string for demo playback — exact pitch, no rhythm-game
  // state, no visual orb. See HarpScene.demoStrike / HarpDemoPlayer.
  demoStrike(idx, sharp, vel, ornament) { this._harpScene?.demoStrike(idx, sharp, vel, ornament) }

  getMidiRange() {
    const available = STR
      .map((s, idx) => ({ m: s.m, idx, sharpM: s.sharpM }))
      .sort((a, b) => a.m - b.m)
    return {
      min: available[0].m,
      max: available[available.length - 1].m,
      available,
    }
  }

  // String direction unit vector (SX,SY) — lets external modules (like
  // HarpPhrasePlayer) draw fill-bars that run ALONG the actual string,
  // rather than at some disconnected offset.
  getStringDirection() { return { sx: SX, sy: SY } }

  // ── Event emitter ─────────────────────────────────────────────────────────
  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = []
    this._listeners[event].push(fn)
    return this  // chainable
  }

  off(event, fn) {
    if (!this._listeners[event]) return
    this._listeners[event] = this._listeners[event].filter(f => f !== fn)
  }

  _emit(event, data) {
    this._listeners[event]?.forEach(fn => fn(data))
  }

  get isOpen() { return !!this._overlay }
}


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
const ANG = 20 * Math.PI / 180
const SX  =  Math.cos(ANG)   //  0.940 — mostly horizontal
const SY  = -Math.sin(ANG)   // -0.342 — slight upward tilt left-to-right
const PX  =  Math.sin(ANG)   //  0.342 — pluck direction: mostly vertical
const PY  =  Math.cos(ANG)   //  0.940
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
  }

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
    // Strings spread top-to-bottom with slight right tilt (20° angle)
    // Each string anchor is spaced vertically — strings fill the screen height
    const MARGIN  = H * 0.08
    const AX1 = W * 0.45, AY1 = MARGIN
    const AX2 = W * 0.55, AY2 = H - MARGIN
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

  // Effective MIDI pitch this string sounds for THIS pluck, given the
  // current sharp-hint callback (if any). Strings with no sharpM are
  // always natural, regardless of the hint.
  _effectiveMidi(s, idx) {
    if (s.sharpMidi === undefined) return s.midi
    const wantsSharp = !!this._getSharpHint?.(idx)
    return wantsSharp ? s.sharpMidi : s.midi
  }

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
    // Debounce: ignore if this string fired within 80ms
    const now = Date.now()
    if (s._lastFired && now - s._lastFired < 80) return
    s._lastFired = now
    s.st.amp = s.maxDraw * vel
    s.st.vel = vel
    const playMidi = this._effectiveMidi(s, idx)
    const playedSharp = playMidi === s.sharpMidi
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

    // Emit pluck event to CorraHarp
    this._onPluck?.({ midi: playMidi, stringIndex: idx, velocity: vel, sharp: playedSharp })
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
        s.gfx.lineStyle(s.thick + pull * 2.4, s.ci, 0.3 + pull * 0.6)
        s.gfx.beginPath(); s.gfx.moveTo(s.x1, s.y1); s.gfx.lineTo(kx, ky); s.gfx.lineTo(s.x2, s.y2); s.gfx.strokePath()
        s.vfx.fillStyle(s.ci, 0.1 + pull * 0.12)
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
          s.gfx.lineStyle(s.thick, s.ci, s.baseA)
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
    s.gfx.lineStyle(on ? s.thick + 1.5 : s.thick, s.ci, on ? 0.65 : s.baseA)
    s.gfx.beginPath(); s.gfx.moveTo(s.x1, s.y1); s.gfx.lineTo(s.x2, s.y2); s.gfx.strokePath()
    if (on) { s.vfx.clear(); s.vfx.fillStyle(s.ci, 0.4); s.vfx.fillCircle(s.ax, s.ay, 6) }
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

  // Highlight a specific string (for guided prompts later)
  highlightString(idx, on, pulse = false) {
    const s = this.strings[idx]; if (!s) return
    if (on) {
      s.gfx.clear()
      s.gfx.lineStyle(s.thick + 2.5, s.ci, 0.85)
      s.gfx.beginPath(); s.gfx.moveTo(s.x1, s.y1); s.gfx.lineTo(s.x2, s.y2); s.gfx.strokePath()
      if (pulse) {
        this.tweens.add({ targets: s.gfx, alpha: 0.55, duration: 280, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      }
    } else {
      this.tweens.killTweensOf(s.gfx); s.gfx.setAlpha(1)
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

  // Close and destroy
  close() {
    const overlay = this._overlay
    if (!overlay) return
    overlay.style.background = 'rgba(3,8,16,0)'
    if (this._container) this._container.style.opacity = '0'
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


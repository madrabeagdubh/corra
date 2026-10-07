/**
 * soundBoard.js
 *
 * Centralised sound event system for Corra.
 *
 * Usage:
 *   import { SoundBoard } from './soundBoard.js'
 *   SoundBoard.play('ARROW_SHOOT', this)       // Phaser scene as second arg
 *   SoundBoard.playWeb('NOCK', audioCtx)       // Web Audio for synthesised sounds
 *   SoundBoard.test()                          // console test of all synths
 *
 * Non-Phaser files (heroSelect, moonWidget, tutorialOrAdventure) reach the
 * AudioContext via SoundBoard.ctx() which checks window._phaserAudioContext.
 * Set it once in any Phaser scene's create():
 *   window._phaserAudioContext = this.sound.context
 */

// ── Phaser audio keys ─────────────────────────────────────────────────────────
const SOUNDS = {
  ARROW_SHOOT:        ['arrowShoot1', 'arrowShoot2', 'arrowShoot3'],
  ARROW_HIT_TARGET:   'pumpkin_break_01',
  ARROW_HIT_CREATURE: null,
  BOW_DRAW:           'creak1',
  PARRY:              'parrySound',
  ITEM_EQUIP:         'equipJewelry',
  LOOT_COLLECT:       'equipJewelry',
  MENU_OPEN:          'synth',
  MENU_CLOSE:         'synth',
  INVENTORY_OPEN:     'synth',
  ENCOUNTER_OPEN:     'synth',
  ENCOUNTER_DISMISS:  'synth',
  ENCOUNTER_CHOICE:   'synth',
  FOOTSTEP_BOG:       'synth',
  FOOTSTEP_WOOD:      'synth',
  SCENE_TRANSITION:   'synth',
}

const VOLUMES = {
  ARROW_SHOOT:      0.7,
  ARROW_HIT_TARGET: 0.8,
  BOW_DRAW:         0.6,
  PARRY:            0.8,
  ITEM_EQUIP:       0.7,
  LOOT_COLLECT:     0.7,
  DEFAULT:          0.7,
}

// ── Main API ──────────────────────────────────────────────────────────────────

export const SoundBoard = {

  /**
   * Get a ready AudioContext from any source.
   * Tries: passed-in ctx → scene.sound.context → window._phaserAudioContext
   */
  ctx(ctxOrScene) {
    let c = null
    if (ctxOrScene && typeof ctxOrScene.currentTime === 'number') {
      c = ctxOrScene                        // raw AudioContext
    } else if (ctxOrScene?.sound?.context) {
      c = ctxOrScene.sound.context          // Phaser scene
    } else {
      c = window._phaserAudioContext ?? null
    }
    if (!c) return null
    // Resume if suspended (browser autoplay policy)
    if (c.state === 'suspended') {
      c.resume().catch(() => {})
    }
    return c.state === 'running' || c.state === 'suspended' ? c : null
  },

  /**
   * Play a named Phaser sound event.
   */
  play(key, scene, opts = {}) {
    const val = SOUNDS[key]
    if (!val) return

    const audioKey = Array.isArray(val)
      ? val[Math.floor(Math.random() * val.length)]
      : val

    const volume = opts.volume ?? VOLUMES[key] ?? VOLUMES.DEFAULT

    try {
      scene.sound.play(audioKey, { volume, ...opts })
    } catch (e) {
      console.warn(`[SoundBoard] Failed to play "${audioKey}":`, e.message)
    }
  },

  /**
   * Play a synthesised Web Audio sound.
   * ctxOrScene can be an AudioContext, a Phaser scene, or omitted (uses global).
   */
  playWeb(key, ctxOrScene, opts = {}) {
    const fn = SYNTH[key]
    if (!fn) {
      console.warn(`[SoundBoard] No synth for key "${key}"`)
      return
    }
    const c = this.ctx(ctxOrScene)
    if (!c) {
      // silently skip — context not ready yet
      return
    }
    try {
      fn(c, opts)
    } catch (e) {
      console.warn(`[SoundBoard] Synth error for "${key}":`, e.message)
    }
  },

  /**
   * Quick console test — plays every synth in sequence.
   * Call from browser console: SoundBoard.test()
   */
  test() {
    const c = this.ctx()
    if (!c) {
      // Create a throwaway context just for testing
      const testCtx = new AudioContext()
      console.log('[SoundBoard] No global context found — using throwaway AudioContext for test')
      let t = 0
      for (const key of Object.keys(SYNTH)) {
        setTimeout(() => {
          console.log(`[SoundBoard] Playing: ${key}`)
          try { SYNTH[key](testCtx, {}) } catch(e) { console.warn(e) }
        }, t)
        t += 800
      }
      return
    }
    let t = 0
    for (const key of Object.keys(SYNTH)) {
      setTimeout(() => {
        console.log(`[SoundBoard] Playing: ${key}`)
        try { SYNTH[key](c, {}) } catch(e) { console.warn(e) }
      }, t)
      t += 800
    }
  },

}

// ── Synthesised sounds ────────────────────────────────────────────────────────

const SYNTH = {

  NOCK(ctx, opts = {}) {
    const now    = ctx.currentTime
    const vol    = opts.volume ?? 0.35
    const master = ctx.createGain()
    master.gain.setValueAtTime(vol, now)
    master.connect(ctx.destination)

    ;[0, 0.03].forEach((offset, i) => {
      const buf  = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let s = 0; s < data.length; s++) {
        const t = s / ctx.sampleRate
        data[s] = (Math.random() * 2 - 1) * Math.exp(-t * 280)
      }
      const src = ctx.createBufferSource()
      src.buffer = buf
      const bpf = ctx.createBiquadFilter()
      bpf.type = 'bandpass'
      bpf.frequency.value = i === 0 ? 1800 : 1200
      bpf.Q.value = 1.2
      const g = ctx.createGain()
      g.gain.setValueAtTime(i === 0 ? 1 : 0.55, now + offset)
      src.connect(bpf); bpf.connect(g); g.connect(master)
      src.start(now + offset)
    })
  },

  TAP_TO_PATH(ctx, opts = {}) {
    // Bodhrán tap — noise burst shaped like a drum hit
    const now  = ctx.currentTime
    const vol  = opts.volume ?? 0.22
    // Noise burst
    const bufLen = ctx.sampleRate * 0.12
    const buf  = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) {
      const t = i / ctx.sampleRate
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 28)
    }
    const src  = ctx.createBufferSource()
    src.buffer = buf
    // Bandpass to give bodhrán woody thump character
    const bpf  = ctx.createBiquadFilter()
    bpf.type   = 'bandpass'
    bpf.frequency.value = 180
    bpf.Q.value = 0.8
    const ng   = ctx.createGain()
    ng.gain.setValueAtTime(vol, now)
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
    // Sub thump
    const osc  = ctx.createOscillator()
    const og   = ctx.createGain()
    osc.type   = 'sine'
    osc.frequency.setValueAtTime(110, now)
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.07)
    og.gain.setValueAtTime(vol * 0.8, now)
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
    src.connect(bpf); bpf.connect(ng); ng.connect(ctx.destination)
    osc.connect(og); og.connect(ctx.destination)
    src.start(now)
    osc.start(now); osc.stop(now + 0.12)
  },

  HIT_TRACKER_TICK(ctx, opts = {}) {
    const now  = ctx.currentTime
    const vol  = opts.volume ?? 0.25
    const freq = opts.freq   ?? 880
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now)
    osc.frequency.exponentialRampToValueAtTime(freq * 1.3, now + 0.04)
    gain.gain.setValueAtTime(vol, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(now); osc.stop(now + 0.2)
  },

  HIT_TRACKER_COMPLETE(ctx, opts = {}) {
    const now    = ctx.currentTime
    const vol    = opts.volume ?? 0.3
    const master = ctx.createGain()
    master.gain.setValueAtTime(vol, now)
    master.connect(ctx.destination)
    const freqs = [523, 659, 784, 1047]
    freqs.forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      const t    = now + i * 0.07
      osc.type = 'triangle'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.9, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
      osc.connect(gain); gain.connect(master)
      osc.start(t); osc.stop(t + 0.28)
    })
  },

  // A soft harp chord, plucked low to high: what rings when something can be looked at.
  // Three voicings (all of one pentatonic family) take turns, so it never tires.
  HARP_CHIME(ctx, opts = {}) {
    const CHORDS = [[293.66, 440.0, 587.33, 659.25], [329.63, 493.88, 659.25, 783.99], [246.94, 369.99, 493.88, 587.33]]
    const notes = CHORDS[SYNTH._chimeIx = ((SYNTH._chimeIx ?? -1) + 1) % CHORDS.length]
    const vol = opts.volume ?? 0.085, now = ctx.currentTime + 0.01
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200
    lp.connect(ctx.destination)
    notes.forEach((f, i) => {
      const t = now + i * 0.075
      for (const [mult, type, k, dur] of [[1, 'triangle', 1, 1.7], [2, 'sine', 0.3, 0.9]]) {
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.type = type; o.frequency.setValueAtTime(f * mult, t)
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * k, t + 0.006)
        g.gain.exponentialRampToValueAtTime(0.0008, t + dur)
        o.connect(g); g.connect(lp); o.start(t); o.stop(t + dur + 0.05)
      }
    })
  },

  BADGE_APPEAR(ctx, opts = {}) {
    const now  = ctx.currentTime
    const vol  = opts.volume ?? 0.2
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(320, now)
    osc.frequency.linearRampToValueAtTime(440, now + 0.08)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(vol, now + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(now); osc.stop(now + 0.52)
  },

  MENU_OPEN(ctx, opts = {}) {
    // Single resonant harp chord — open fifth
    const now    = ctx.currentTime
    const vol    = opts.volume ?? 0.16
    const master = ctx.createGain()
    master.gain.setValueAtTime(vol, now)
    master.connect(ctx.destination)
    ;[220, 330, 440, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const g   = ctx.createGain()
      osc.type  = 'triangle'
      osc.frequency.value = freq
      g.gain.setValueAtTime(0, now)
      g.gain.linearRampToValueAtTime(i === 0 ? 1 : 0.6, now + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.4)
      osc.connect(g); g.connect(master)
      osc.start(now); osc.stop(now + 1.5)
    })
  },

  MENU_CLOSE(ctx, opts = {}) {
    // Single soft harp chord — lower, settling
    const now    = ctx.currentTime
    const vol    = opts.volume ?? 0.12
    const master = ctx.createGain()
    master.gain.setValueAtTime(vol, now)
    master.connect(ctx.destination)
    ;[165, 247, 330].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const g   = ctx.createGain()
      osc.type  = 'triangle'
      osc.frequency.value = freq
      g.gain.setValueAtTime(0, now)
      g.gain.linearRampToValueAtTime(i === 0 ? 1 : 0.5, now + 0.008)
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.8)
      osc.connect(g); g.connect(master)
      osc.start(now); osc.stop(now + 0.9)
    })
  },

  INVENTORY_OPEN(ctx, opts = {}) {
    // Bodhrán single tap — dry woody thud
    const now = ctx.currentTime
    const vol = opts.volume ?? 0.3
    const buf  = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 35)
    }
    const src  = ctx.createBufferSource()
    src.buffer = buf
    const lpf  = ctx.createBiquadFilter()
    lpf.type   = 'lowpass'
    lpf.frequency.value = 280
    const osc  = ctx.createOscillator()
    const og   = ctx.createGain()
    osc.type   = 'sine'
    osc.frequency.setValueAtTime(120, now)
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.08)
    og.gain.setValueAtTime(vol, now)
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
    const ng = ctx.createGain()
    ng.gain.value = vol * 0.6
    src.connect(lpf); lpf.connect(ng); ng.connect(ctx.destination)
    osc.connect(og); og.connect(ctx.destination)
    src.start(now); osc.start(now); osc.stop(now + 0.15)
  },

  ENCOUNTER_OPEN(ctx, opts = {}) {
    // Low uilleann pipe drone swell
    const now    = ctx.currentTime
    const vol    = opts.volume ?? 0.15
    const master = ctx.createGain()
    master.gain.setValueAtTime(0, now)
    master.gain.linearRampToValueAtTime(vol, now + 0.3)
    master.gain.exponentialRampToValueAtTime(0.001, now + 1.2)
    master.connect(ctx.destination)
    ;[110, 220, 330].forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const g    = ctx.createGain()
      osc.type   = 'sawtooth'
      osc.frequency.value = freq
      // Slight detune for pipe character
      osc.detune.value = i * 4 + Math.random() * 3
      g.gain.value = i === 0 ? 1 : 0.4 - i * 0.1
      osc.connect(g); g.connect(master)
      osc.start(now); osc.stop(now + 1.3)
    })
    // Add breathy noise
    const buf  = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.08
    const src  = ctx.createBufferSource()
    src.buffer = buf
    const bpf  = ctx.createBiquadFilter()
    bpf.type   = 'bandpass'
    bpf.frequency.value = 220
    bpf.Q.value = 0.8
    src.connect(bpf); bpf.connect(master)
    src.start(now)
  },

  ENCOUNTER_DISMISS(ctx, opts = {}) {
    // Whistle breath — airy release
    const now  = ctx.currentTime
    const vol  = opts.volume ?? 0.12
    const buf  = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 8)
    }
    const src  = ctx.createBufferSource()
    src.buffer = buf
    const bpf  = ctx.createBiquadFilter()
    bpf.type   = 'bandpass'
    bpf.frequency.setValueAtTime(1800, now)
    bpf.frequency.exponentialRampToValueAtTime(800, now + 0.3)
    bpf.Q.value = 2.5
    const g    = ctx.createGain()
    g.gain.setValueAtTime(vol, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
    src.connect(bpf); bpf.connect(g); g.connect(ctx.destination)
    src.start(now)
  },

  ENCOUNTER_CHOICE(ctx, opts = {}) {
    // Fiddle string pluck — decisive
    const now    = ctx.currentTime
    const vol    = opts.volume ?? 0.2
    const master = ctx.createGain()
    master.gain.setValueAtTime(vol, now)
    master.connect(ctx.destination)
    const freq = opts.freq ?? 440
    ;[freq, freq * 1.5].forEach((f, i) => {
      const t   = now + i * 0.03
      const osc = ctx.createOscillator()
      const g   = ctx.createGain()
      osc.type  = 'sawtooth'
      osc.frequency.setValueAtTime(f, t)
      osc.frequency.exponentialRampToValueAtTime(f * 0.98, t + 0.1)
      g.gain.setValueAtTime(0.9, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
      const lpf = ctx.createBiquadFilter()
      lpf.type  = 'lowpass'
      lpf.frequency.value = 2200
      osc.connect(lpf); lpf.connect(g); g.connect(master)
      osc.start(t); osc.stop(t + 0.38)
    })
  },

  FOOTSTEP_GRASS(ctx, opts = {}) {
    // Soft earth thump — sub-bass sine, very short, barely audible
    const now  = ctx.currentTime
    const vol  = opts.volume ?? 0.12
    const osc  = ctx.createOscillator()
    const g    = ctx.createGain()
    osc.type   = 'sine'
    osc.frequency.setValueAtTime(70, now)
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.06)
    g.gain.setValueAtTime(vol, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.07)
    osc.connect(g); g.connect(ctx.destination)
    osc.start(now); osc.stop(now + 0.08)
  },

  FOOTSTEP_FOREST(ctx, opts = {}) {
    // Same soft thump, slightly duller — damp forest floor
    const now  = ctx.currentTime
    const vol  = opts.volume ?? 0.1
    const osc  = ctx.createOscillator()
    const g    = ctx.createGain()
    const lpf  = ctx.createBiquadFilter()
    lpf.type   = 'lowpass'
    lpf.frequency.value = 120
    osc.type   = 'sine'
    osc.frequency.setValueAtTime(60, now)
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.07)
    g.gain.setValueAtTime(vol, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09)
    osc.connect(lpf); lpf.connect(g); g.connect(ctx.destination)
    osc.start(now); osc.stop(now + 0.1)
  },

  FOOTSTEP_SPLASH(ctx, opts = {}) {
    // Wading splash — shore tiles
    const now  = ctx.currentTime
    const vol  = opts.volume ?? 0.18
    // Splash noise
    const buf  = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 18)
    }
    const src  = ctx.createBufferSource()
    src.buffer = buf
    const bpf  = ctx.createBiquadFilter()
    bpf.type   = 'bandpass'
    bpf.frequency.value = 1200
    bpf.Q.value = 0.6
    const g    = ctx.createGain()
    g.gain.setValueAtTime(vol, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
    // Low water thud
    const osc  = ctx.createOscillator()
    const og   = ctx.createGain()
    osc.type   = 'sine'
    osc.frequency.setValueAtTime(180, now)
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08)
    og.gain.setValueAtTime(vol * 0.5, now)
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
    src.connect(bpf); bpf.connect(g); g.connect(ctx.destination)
    osc.connect(og); og.connect(ctx.destination)
    src.start(now); osc.start(now); osc.stop(now + 0.13)
  },

  FOOTSTEP_WADE(ctx, opts = {}) {
    // Deep water wade — heavier, bubbly
    const now  = ctx.currentTime
    const vol  = opts.volume ?? 0.15
    // Water displacement
    const buf  = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 12)
    }
    const src  = ctx.createBufferSource()
    src.buffer = buf
    const lpf  = ctx.createBiquadFilter()
    lpf.type   = 'lowpass'
    lpf.frequency.value = 600
    const g    = ctx.createGain()
    g.gain.setValueAtTime(vol, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
    // Bubble blurp
    const osc  = ctx.createOscillator()
    const og   = ctx.createGain()
    osc.type   = 'sine'
    osc.frequency.setValueAtTime(300 + Math.random() * 200, now + 0.05)
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.15)
    og.gain.setValueAtTime(0, now + 0.04)
    og.gain.linearRampToValueAtTime(vol * 0.4, now + 0.07)
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.16)
    src.connect(lpf); lpf.connect(g); g.connect(ctx.destination)
    osc.connect(og); og.connect(ctx.destination)
    src.start(now); osc.start(now + 0.04); osc.stop(now + 0.17)
  },

  FOOTSTEP_SUBMERGED(ctx, opts = {}) {
    // Fully submerged — muffled thud, bubbles
    const now  = ctx.currentTime
    const vol  = opts.volume ?? 0.12
    // Muffled thud
    const osc  = ctx.createOscillator()
    const og   = ctx.createGain()
    osc.type   = 'sine'
    osc.frequency.setValueAtTime(60, now)
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.1)
    og.gain.setValueAtTime(vol, now)
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
    const lpf  = ctx.createBiquadFilter()
    lpf.type   = 'lowpass'
    lpf.frequency.value = 200
    osc.connect(lpf); lpf.connect(og); og.connect(ctx.destination)
    osc.start(now); osc.stop(now + 0.13)
    // Rising bubble
    const osc2 = ctx.createOscillator()
    const og2  = ctx.createGain()
    osc2.type  = 'sine'
    osc2.frequency.setValueAtTime(200 + Math.random() * 150, now + 0.02)
    osc2.frequency.exponentialRampToValueAtTime(600, now + 0.12)
    og2.gain.setValueAtTime(vol * 0.3, now + 0.02)
    og2.gain.exponentialRampToValueAtTime(0.001, now + 0.13)
    osc2.connect(og2); og2.connect(ctx.destination)
    osc2.start(now + 0.02); osc2.stop(now + 0.14)
  },

  FOOTSTEP_BOG(ctx, opts = {}) {
    // Soft wet thud with squelch
    const now  = ctx.currentTime
    const vol  = opts.volume ?? 0.18
    // Thud
    const osc  = ctx.createOscillator()
    const og   = ctx.createGain()
    osc.type   = 'sine'
    osc.frequency.setValueAtTime(90, now)
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.06)
    og.gain.setValueAtTime(vol, now)
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
    osc.connect(og); og.connect(ctx.destination)
    osc.start(now); osc.stop(now + 0.12)
    // Squelch
    const buf  = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 60) * 0.4
    }
    const src  = ctx.createBufferSource()
    src.buffer = buf
    const bpf  = ctx.createBiquadFilter()
    bpf.type   = 'bandpass'
    bpf.frequency.value = 600
    bpf.Q.value = 1.5
    const g    = ctx.createGain()
    g.gain.value = vol * 0.5
    src.connect(bpf); bpf.connect(g); g.connect(ctx.destination)
    src.start(now + 0.03)
  },

  FOOTSTEP_WOOD(ctx, opts = {}) {
    // Hollow wooden knock
    const now  = ctx.currentTime
    const vol  = opts.volume ?? 0.2
    const osc  = ctx.createOscillator()
    const g    = ctx.createGain()
    osc.type   = 'sine'
    osc.frequency.setValueAtTime(200, now)
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.04)
    g.gain.setValueAtTime(vol, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
    const buf  = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 120)
    }
    const src  = ctx.createBufferSource()
    src.buffer = buf
    const ng   = ctx.createGain()
    ng.gain.value = vol * 0.3
    osc.connect(g); g.connect(ctx.destination)
    src.connect(ng); ng.connect(ctx.destination)
    osc.start(now); osc.stop(now + 0.1)
    src.start(now)
  },

  SCENE_TRANSITION(ctx, opts = {}) {
    // Low resonant threshold tone — ambiguous, modal, slightly eerie
    const now    = ctx.currentTime
    const vol    = opts.volume ?? 0.14
    const master = ctx.createGain()
    master.gain.setValueAtTime(vol, now)
    master.gain.exponentialRampToValueAtTime(0.001, now + 2.2)
    master.connect(ctx.destination)

    // Low fundamental
    ;[
      { freq: 110, type: 'sine',     t: 0.00, vol: 1.0, dur: 2.0 },
      { freq: 165, type: 'triangle', t: 0.08, vol: 0.6, dur: 1.8 },
      { freq: 440, type: 'sine',     t: 0.15, vol: 0.3, dur: 1.5 },
    ].forEach(({ freq, type, t, vol: v, dur }) => {
      const osc = ctx.createOscillator()
      const g   = ctx.createGain()
      osc.type  = type
      osc.frequency.value = freq
      g.gain.setValueAtTime(0, now + t)
      g.gain.linearRampToValueAtTime(v, now + t + 0.04)
      g.gain.exponentialRampToValueAtTime(0.001, now + t + dur)
      osc.connect(g); g.connect(master)
      osc.start(now + t); osc.stop(now + t + dur + 0.1)
    })
  },

  ARROW_HIT_CREATURE(ctx, opts = {}) {
    // Thwack with bodhrán resonance
    const now    = ctx.currentTime
    const vol    = opts.volume ?? 0.3
    const master = ctx.createGain()
    master.gain.setValueAtTime(vol, now)
    master.connect(ctx.destination)
    // Impact thwack
    const buf  = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 50)
    }
    const src  = ctx.createBufferSource()
    src.buffer = buf
    const lpf  = ctx.createBiquadFilter()
    lpf.type   = 'lowpass'
    lpf.frequency.value = 800
    const ng   = ctx.createGain()
    ng.gain.value = 0.8
    src.connect(lpf); lpf.connect(ng); ng.connect(master)
    src.start(now)
    // Bodhrán resonance
    const osc  = ctx.createOscillator()
    const og   = ctx.createGain()
    osc.type   = 'sine'
    osc.frequency.setValueAtTime(140, now)
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.12)
    og.gain.setValueAtTime(0.9, now)
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
    osc.connect(og); og.connect(master)
    osc.start(now); osc.stop(now + 0.2)
  },

  SWALLOW_CALL(ctx, opts = {}) {
    if (window._noSwallowSounds) return
    const now    = ctx.currentTime
    const vol    = opts.volume ?? 0.12
    const master = ctx.createGain()
    master.gain.setValueAtTime(vol, now)
    master.connect(ctx.destination)
    // 2-3 rapid sharp chirps
    const chirps = 2 + Math.floor(Math.random() * 2)
    for (let i = 0; i < chirps; i++) {
      const t    = now + i * 0.055
      const freq = 3200 + Math.random() * 1800
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq * 0.7, t)
      osc.frequency.exponentialRampToValueAtTime(freq, t + 0.02)
      osc.frequency.exponentialRampToValueAtTime(freq * 1.3, t + 0.045)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(1, t + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.055)
      osc.connect(gain); gain.connect(master)
      osc.start(t); osc.stop(t + 0.06)
    }
  },

  MOON_SWIPE(ctx, opts = {}) {
    const now  = ctx.currentTime
    const vol  = opts.volume ?? 0.06
    const buf  = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let s = 0; s < data.length; s++) {
      const t = s / ctx.sampleRate
      data[s] = (Math.random() * 2 - 1) * Math.exp(-t * 120)
    }
    const src  = ctx.createBufferSource()
    src.buffer = buf
    const hpf  = ctx.createBiquadFilter()
    hpf.type   = 'highpass'
    hpf.frequency.value = 2000
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(vol, now)
    src.connect(hpf); hpf.connect(gain); gain.connect(ctx.destination)
    src.start(now)
  },

  // ── Blades and bodies (melee) ─────────────────────────────────────────────
  // opts.material: 'wood' (training blades, the default) or 'metal'.
  // opts.volume scales each; opts.pitch (around 1) varies them so repeats
  // don't sound stamped out.

  SWORD_SWISH(ctx, opts = {}) {
    // A blade cutting air: a band of noise sweeping up and away.
    // opts.dur (s) -- a patient cut is longer than a backhand.
    const now = ctx.currentTime, p = opts.pitch ?? 1, dur = opts.dur ?? 0.16
    const vol = opts.volume ?? 0.32
    const n = _bladeNoise(ctx, dur), f = ctx.createBiquadFilter(), g = ctx.createGain()
    f.type = 'bandpass'; f.Q.value = 1.4
    f.frequency.setValueAtTime(600 * p, now); f.frequency.exponentialRampToValueAtTime(2600 * p, now + dur * 0.8)
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(vol, now + dur * 0.35)
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    n.connect(f).connect(g).connect(ctx.destination); n.start(now)
  },

  BLADE_KNOCK(ctx, opts = {}) {
    // Blade on blade. Wood: a hollow knock, two short resonances of the
    // ash staves and a click. Metal: bright partials that ring on.
    // opts.hard (0..1): a parry is lighter than a full clash.
    const now = ctx.currentTime, p = opts.pitch ?? 1, hard = opts.hard ?? 0.6
    const vol = (opts.volume ?? 0.5) * (0.6 + 0.4 * hard)
    const metal = opts.material === 'metal'
    const partials = metal ? [[2150, 0.9], [3420, 0.6], [5230, 0.35], [7600, 0.2]] : [[540, 1], [1310, 0.55], [2380, 0.18]]
    const ring = metal ? 0.9 + 0.5 * hard : 0.09 + 0.05 * hard
    for (const [hz, a] of partials) {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = metal ? 'sine' : 'triangle'
      o.frequency.setValueAtTime(hz * p, now); o.frequency.exponentialRampToValueAtTime(hz * p * (metal ? 0.995 : 0.93), now + ring)
      g.gain.setValueAtTime(vol * a * 0.5, now); g.gain.exponentialRampToValueAtTime(0.0001, now + ring * (metal ? 1 : 1 / a ** 0.3))
      o.connect(g).connect(ctx.destination); o.start(now); o.stop(now + ring * 1.5 + 0.05)
    }
    const n = _bladeNoise(ctx, 0.04), f = ctx.createBiquadFilter(), g = ctx.createGain()
    f.type = 'bandpass'; f.frequency.value = metal ? 6000 : 2200 * p; f.Q.value = 0.8
    g.gain.setValueAtTime(vol * 0.7, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.04)
    n.connect(f).connect(g).connect(ctx.destination); n.start(now)
  },

  BLADE_THUD(ctx, opts = {}) {
    // Blade on a body: a dull blow through cloth. Deeper and longer for a
    // heavy one (opts.hard 0..1). Metal adds a short bright scrape.
    const now = ctx.currentTime, hard = opts.hard ?? 0.5, vol = (opts.volume ?? 0.6) * (0.7 + 0.3 * hard)
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(140 - 40 * hard, now); o.frequency.exponentialRampToValueAtTime(48, now + 0.12 + 0.08 * hard)
    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16 + 0.1 * hard)
    o.connect(g).connect(ctx.destination); o.start(now); o.stop(now + 0.3)
    const n = _bladeNoise(ctx, 0.09), f = ctx.createBiquadFilter(), gn = ctx.createGain()
    f.type = 'lowpass'; f.frequency.value = 700
    gn.gain.setValueAtTime(vol * 0.6, now); gn.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)
    n.connect(f).connect(gn).connect(ctx.destination); n.start(now)
    if (opts.material === 'metal') SYNTH.SWORD_SWISH(ctx, { pitch: 2.2, dur: 0.07, volume: vol * 0.25 })
  },

  SWORD_DRAW(ctx, opts = {}) {
    // Drawing the blade. Wood: out of a leather loop, a dry rasp and a tap.
    // Metal: the long rising shing of a scabbard.
    const now = ctx.currentTime, vol = opts.volume ?? 0.14, metal = opts.material === 'metal'
    const dur = metal ? 0.42 : 0.26
    const n = _bladeNoise(ctx, dur), f = ctx.createBiquadFilter(), g = ctx.createGain()
    f.type = metal ? 'highpass' : 'bandpass'; f.Q.value = metal ? 0.7 : 2.2
    f.frequency.setValueAtTime(metal ? 2400 : 700, now); f.frequency.exponentialRampToValueAtTime(metal ? 6800 : 1500, now + dur)
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(vol, now + dur * 0.6)
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    n.connect(f).connect(g).connect(ctx.destination); n.start(now)
    if (metal) SYNTH.BLADE_KNOCK(ctx, { material: 'metal', hard: 0.15, volume: vol * 1.2 })
    else {
      const o = ctx.createOscillator(), go = ctx.createGain(), t = now + dur * 0.9
      o.type = 'triangle'; o.frequency.setValueAtTime(820, t)
      go.gain.setValueAtTime(vol * 0.9, t); go.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
      o.connect(go).connect(ctx.destination); o.start(t); o.stop(t + 0.07)
    }
  },

  SWORD_SHEATHE(ctx, opts = {}) {
    // Putting it away: the draw, falling instead of rising, and softer.
    const now = ctx.currentTime, vol = opts.volume ?? 0.09, dur = 0.3
    const n = _bladeNoise(ctx, dur), f = ctx.createBiquadFilter(), g = ctx.createGain()
    f.type = 'bandpass'; f.Q.value = 1.6
    f.frequency.setValueAtTime(opts.material === 'metal' ? 5200 : 1500, now); f.frequency.exponentialRampToValueAtTime(600, now + dur)
    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    n.connect(f).connect(g).connect(ctx.destination); n.start(now)
  },

  BREATH(ctx, opts = {}) {
    // One breath: air, not a voice. Noise through the throat and mouth, the
    // way real breath sounds -- no oscillators in it, so nothing hums. What
    // makes it read as alive:
    //   - it gets BRIGHTER as it gets louder (a lowpass that opens with the
    //     airflow), and duller as it dies away;
    //   - the mouth's shape (its resonances) is a little different every
    //     breath, and drifts while it's going;
    //   - the airflow wavers (slow random flutter), never a clean ramp.
    //   opts.kind     'pant'     a good workout: a quick sip in, a soft "hhah" out
    //                 'gasp'     all-out: a sharp, rasping pull in, a long ragged "haaah" out
    //                 'splutter' coming up from near-drowning: a longer, whooping,
    //                            wet pull in, a wheezy, bubbling breath out
    //   opts.inhale   true = in, false = out
    //   opts.voice    'male' | 'female'
    //   opts.effort   0..1;  opts.wheeze, opts.wet 0..1 (defaults by kind)
    //   opts.volume, opts.pitch (around 1)
    const now = ctx.currentTime, inh = !!opts.inhale, kind = opts.kind || 'pant'
    const fem = opts.voice === 'female', p = opts.pitch ?? 1, fs = (fem ? 1.15 : 1) * p
    const effort = Math.max(0, Math.min(1, opts.effort ?? 0.5))
    const hard = kind !== 'pant', whoop = kind === 'splutter' && inh
    const wheeze = opts.wheeze ?? (kind === 'splutter' ? 0.7 : kind === 'gasp' ? 0.2 : 0)
    const wet = opts.wet ?? (kind === 'splutter' ? 0.6 : 0)
    const rnd = (a, b) => a + Math.random() * (b - a)
    const base = inh ? (kind === 'pant' ? 0.2 : kind === 'gasp' ? 0.34 : 0.55) : (kind === 'pant' ? 0.3 : kind === 'gasp' ? 0.6 : 0.65)
    const dur = base * rnd(0.85, 1.15), end = now + dur
    // level: a pant is mostly heard going out; a gasp, coming in
    const lvl = kind === 'pant' ? (inh ? 0.5 : 1.1) : kind === 'gasp' ? (inh ? 1.1 : 1.7) : (inh ? 1.25 : 1.7)
    const vol = (opts.volume ?? 0.08) * 0.35 * lvl * (0.7 + 0.5 * effort) * rnd(0.85, 1.1)

    // The airflow: in, a swell that is cut off (hard: snatched -- up at
    // once); out, a burst that tails away.
    const flow = ctx.createGain(), g = flow.gain
    const peakAt = inh ? (hard ? 0.18 : 0.55) : (hard ? 0.08 : 0.12)
    g.setValueAtTime(0.0001, now)
    g.exponentialRampToValueAtTime(vol, now + dur * peakAt)
    if (inh) { g.setValueAtTime(vol * rnd(0.8, 0.95), end - dur * 0.12); g.exponentialRampToValueAtTime(0.0001, end) }
    else { g.exponentialRampToValueAtTime(vol * 0.3, now + dur * 0.6); g.exponentialRampToValueAtTime(0.0001, end) }

    // brighter with the airflow: the lid opens as it peaks and closes as it goes
    const lid = ctx.createBiquadFilter(); lid.type = 'lowpass'; lid.Q.value = 0.4
    const open = (inh ? (hard ? 6500 : 4200) : (hard ? 4500 : 3000)) * fs, shut = open * 0.35
    lid.frequency.setValueAtTime(shut, now)
    lid.frequency.exponentialRampToValueAtTime(open, now + dur * peakAt)
    lid.frequency.exponentialRampToValueAtTime(shut, end)
    // flutter: a slow random waver in the airflow (noise, low-passed, riding
    // a second gain so it scales with the breath and dies with it)
    const wob = ctx.createGain(); wob.gain.value = 1
    flow.connect(wob).connect(lid).connect(ctx.destination)
    const fl = _bladeNoise(ctx, dur + 0.05), flp = ctx.createBiquadFilter(), flg = ctx.createGain()
    flp.type = 'lowpass'; flp.frequency.value = hard ? 24 : 14; flp.Q.value = 0.7
    flg.gain.value = hard ? 9 : 6                     // low-passed noise is faint: this makes it about +-30%
    fl.connect(flp).connect(flg).connect(wob.gain); fl.start(now)

    // the air itself, through the mouth's resonances: an "hh" in, "hah" out,
    // each placed a little differently every breath and drifting as it goes
    const src = _bladeNoise(ctx, dur + 0.05)
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = inh ? 380 : 180
    src.connect(hp)
    const F = inh
      ? [[rnd(1100, 1500), 1.6, 1], [rnd(2300, 2900), 2.2, 0.8], [rnd(3800, 4600), 3, 0.45]]
      : [[rnd(600, 850), 1.4, 1], [rnd(1150, 1450), 1.8, 0.75], [rnd(2400, 2900), 2.5, 0.35]]
    for (const [hz, q, a] of F) {
      const bp = ctx.createBiquadFilter(), ga = ctx.createGain()
      bp.type = 'bandpass'; bp.Q.value = q
      bp.frequency.setValueAtTime(hz * fs, now)
      bp.frequency.linearRampToValueAtTime(hz * fs * rnd(0.88, 1.1), end)
      ga.gain.value = a * 2.4
      hp.connect(bp).connect(ga).connect(flow)
    }
    // and a little of the breath unshaped: the hiss that makes it air
    const hiss = ctx.createGain(); hiss.gain.value = inh ? 0.5 : 0.3
    hp.connect(hiss).connect(flow)
    src.start(now)

    // the throat, when it's hard: a rasp. Air tearing past a tight throat --
    // noise chopped at a rough, uneven rate, not a tone.
    if (hard) {
      const rs = _bladeNoise(ctx, dur + 0.05), am = ctx.createGain(), chop = _bladeNoise(ctx, dur + 0.05)
      const cf = ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = (inh ? 90 : 70) * fs; cf.Q.value = 2.5
      const cg = ctx.createGain(); cg.gain.value = 22
      am.gain.value = 0
      chop.connect(cf).connect(cg).connect(am.gain)
      const rb = ctx.createBiquadFilter(); rb.type = 'bandpass'; rb.frequency.value = (inh ? (whoop ? 1300 : 1700) : 900) * fs; rb.Q.value = 1.2
      const rg = ctx.createGain(); rg.gain.value = (inh ? 0.9 : 1.1) * (0.4 + 0.6 * effort)
      rs.connect(am).connect(rb).connect(rg).connect(flow)
      rs.start(now); chop.start(now)
    }

    // a wheeze: a thin whistle of air, riding the breath (narrow-band noise,
    // sliding as the airway gives)
    if (wheeze > 0) {
      const wn = _bladeNoise(ctx, dur + 0.05), wb = ctx.createBiquadFilter(), wg = ctx.createGain()
      const fw = (fem ? 1150 : 950) * p * (inh ? 1.2 : 1) * rnd(0.9, 1.1)
      wb.type = 'bandpass'; wb.Q.value = 30
      wb.frequency.setValueAtTime(fw * (inh ? 0.85 : 1.05), now)
      wb.frequency.linearRampToValueAtTime(fw * (inh ? 1.15 : 0.9), end)
      wg.gain.value = 9 * wheeze
      wn.connect(wb).connect(wg).connect(flow); wn.start(now)
    }

    // water in the airway: a crackle of bubbles
    if (wet > 0) {
      const c = _crackle(ctx, dur, 45), bp = ctx.createBiquadFilter(), cg = ctx.createGain()
      bp.type = 'bandpass'; bp.frequency.value = 520 * fs; bp.Q.value = 1.3; cg.gain.value = 1.4 * wet
      c.connect(bp).connect(cg).connect(flow); c.start(now)
    }
  },

  COUGH(ctx, opts = {}) {
    // One cough. The glottis shut for an instant, then blown open: a burst
    // with weight in it, a thump from the chest, and a rough voiced "uh" of
    // air driven out through an open throat. opts.weak (0..1) for one
    // further into a fit; opts.wet (0..1) for water in it.
    //   opts.voice 'male' | 'female', opts.volume, opts.pitch (around 1)
    const fem = opts.voice === 'female', p = opts.pitch ?? 1, fs = (fem ? 1.17 : 1) * p
    const weak = Math.max(0, Math.min(1, opts.weak ?? 0)), wet = opts.wet ?? 0
    const vol = (opts.volume ?? 0.16) * (1 - 0.3 * weak)
    const t = ctx.currentTime + 0.025                    // the closure: a held instant of nothing
    const body = 0.3 + 0.08 * weak, end = t + body
    const out = ctx.createGain(), lid = ctx.createBiquadFilter()
    lid.type = 'lowpass'; lid.frequency.value = 3600 * fs
    out.connect(lid).connect(ctx.destination)
    const g = out.gain
    g.setValueAtTime(0.0001, t)
    g.exponentialRampToValueAtTime(vol, t + 0.012)       // blown open...
    g.exponentialRampToValueAtTime(vol * 0.85, t + 0.06)  // ...and the air keeps coming: a held "uh", not a click
    g.exponentialRampToValueAtTime(vol * 0.7, t + 0.14)
    g.exponentialRampToValueAtTime(vol * 0.4, t + 0.24)
    g.exponentialRampToValueAtTime(0.0001, end)
    // air through the throat: broad "uh" resonances, not a hiss
    const n = _bladeNoise(ctx, body + 0.03)
    for (const [hz, q, a] of [[600, 2, 1], [1150, 2.5, 0.8], [2400, 3.5, 0.4]]) {
      const bp = ctx.createBiquadFilter(), ga = ctx.createGain()
      bp.type = 'bandpass'; bp.frequency.value = hz * fs; bp.Q.value = q; ga.gain.value = a * 1.8
      n.connect(bp).connect(ga).connect(out)
    }
    n.start(t)
    // the voice in it: rough, with the rattle of vocal fry, falling
    const f0 = (fem ? 255 : 145) * p
    const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), vg = ctx.createGain(), fry = ctx.createGain()
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.7, end)
    const jit = ctx.createOscillator(), jg = ctx.createGain(); jit.frequency.value = 35; jg.gain.value = f0 * 0.1
    jit.connect(jg).connect(o.frequency)
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.type = 'square'; lfo.frequency.value = 38; lg.gain.value = 0.5
    fry.gain.value = 0.5; lfo.connect(lg).connect(fry.gain)                // the rattle
    lp.type = 'lowpass'; lp.frequency.value = 1500 * fs
    vg.gain.setValueAtTime(0.0001, t); vg.gain.exponentialRampToValueAtTime(0.32 * (1 - 0.4 * weak), t + 0.02); vg.gain.exponentialRampToValueAtTime(0.0001, end)
    o.connect(lp).connect(fry).connect(vg).connect(out)
    for (const x of [o, jit, lfo]) { x.start(t); x.stop(end + 0.02) }
    // the chest
    const k = ctx.createOscillator(), kg = ctx.createGain()
    k.type = 'sine'; k.frequency.setValueAtTime(120, t); k.frequency.exponentialRampToValueAtTime(65, t + 0.12)
    kg.gain.setValueAtTime(0.0001, t); kg.gain.exponentialRampToValueAtTime(vol * 0.6, t + 0.012); kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.13)
    k.connect(kg).connect(ctx.destination); k.start(t); k.stop(t + 0.14)
    if (wet > 0) {                                       // water in it: bubbles
      const c = _crackle(ctx, body, 55), bp = ctx.createBiquadFilter(), cg = ctx.createGain()
      bp.type = 'bandpass'; bp.frequency.value = 480 * fs; bp.Q.value = 1.2; cg.gain.value = 1.6 * wet
      c.connect(bp).connect(cg).connect(out); c.start(t)
    }
  },

  BODY_FALL(ctx, opts = {}) {
    // Someone going down on grass: a heavy low thump, a second smaller one
    // (the shoulder after the hip), and the rustle of the turf.
    const now = ctx.currentTime, vol = opts.volume ?? 0.55
    for (const [dt, a] of [[0, 1], [0.13, 0.5]]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = now + dt
      o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.2)
      g.gain.setValueAtTime(vol * a, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24)
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.28)
    }
    const n = _bladeNoise(ctx, 0.35), f = ctx.createBiquadFilter(), g = ctx.createGain()
    f.type = 'highpass'; f.frequency.value = 1800
    g.gain.setValueAtTime(vol * 0.12, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35)
    n.connect(f).connect(g).connect(ctx.destination); n.start(now)
  },

  FOOT_SHUFFLE(ctx, opts = {}) {
    // Light feet on the turf -- a brush, not a step.
    const now = ctx.currentTime, vol = opts.volume ?? 0.035
    const n = _bladeNoise(ctx, 0.06), f = ctx.createBiquadFilter(), g = ctx.createGain()
    f.type = 'bandpass'; f.frequency.value = 2400 * (opts.pitch ?? 1); f.Q.value = 0.9
    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06)
    n.connect(f).connect(g).connect(ctx.destination); n.start(now)
  },

  CROWD_CLAP(ctx, opts = {}) {
    // A smattering of applause: n people clapping, each at their own pace
    // and with their own hands (a cupped clap is lower, a flat one sharper),
    // starting raggedly, thinning out at the end.
    //   opts.n (people), opts.dur (s), opts.volume, opts.warmth 0..1 (how keen)
    const now = ctx.currentTime, n = opts.n ?? 6, dur = opts.dur ?? 2.2, warm = opts.warmth ?? 0.7
    const vol = (opts.volume ?? 0.24) / Math.sqrt(n)
    const sr = ctx.sampleRate
    for (let p = 0; p < n; p++) {
      const len = Math.round(sr * (dur + 0.3)), buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0)
      const rate = 3.2 + Math.random() * 2.2 * (0.6 + warm)          // claps per second
      const start = Math.random() * 0.35 * (1.3 - warm)
      const stop = dur * (0.55 + Math.random() * 0.45)
      for (let t = start; t < stop; t += (1 / rate) * (0.85 + Math.random() * 0.3)) {
        const fade = Math.min(1, (t - start) / 0.25) * Math.min(1, (stop - t) / 0.5)
        const i0 = Math.round(t * sr), clen = Math.round(sr * 0.03), a = (0.6 + Math.random() * 0.4) * fade
        for (let i = 0; i < clen && i0 + i < len; i++) d[i0 + i] += (Math.random() * 2 - 1) * a * Math.exp(-i / (sr * 0.006))
      }
      const s = ctx.createBufferSource(); s.buffer = buf
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900 + Math.random() * 1400; bp.Q.value = 1.1
      const g = ctx.createGain(); g.gain.value = vol * 3
      s.connect(bp).connect(g).connect(ctx.destination); s.start(now)
    }
  },

  CROWD_BOO(ctx, opts = {}) {
    // A few voices, together: 'boo' -- a long, sinking "oooh" of disapproval;
    // 'ooh' -- a short one that rises and falls, for a fall or a near thing.
    //   opts.kind 'boo' | 'ooh', opts.n (voices), opts.volume
    const now = ctx.currentTime, kind = opts.kind || 'boo', n = opts.n ?? 5
    const boo = kind === 'boo'
    const vol = (opts.volume ?? (boo ? 0.1 : 0.08)) / Math.sqrt(n)
    const out = ctx.createGain(); out.gain.value = 1; out.connect(ctx.destination)
    // the vowel: "oo" for a boo, rounder "oh" for an ooh
    const F = boo ? [[320, 6, 1], [800, 8, 0.5], [2400, 10, 0.12]] : [[450, 6, 1], [850, 8, 0.6], [2500, 10, 0.12]]
    for (let v = 0; v < n; v++) {
      const fem = Math.random() < 0.4
      const f0 = (fem ? 200 : 105) * (0.88 + Math.random() * 0.25)
      const t0 = now + Math.random() * (boo ? 0.4 : 0.15)
      const len = boo ? 1.1 + Math.random() * 0.6 : 0.45 + Math.random() * 0.2
      const o = ctx.createOscillator(); o.type = 'sawtooth'
      if (boo) { o.frequency.setValueAtTime(f0 * 1.05, t0); o.frequency.exponentialRampToValueAtTime(f0 * 0.82, t0 + len) }
      else { o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f0 * 1.35, t0 + len * 0.35); o.frequency.exponentialRampToValueAtTime(f0 * 0.9, t0 + len) }
      const vib = ctx.createOscillator(), vg = ctx.createGain()
      vib.frequency.value = 5 + Math.random() * 2; vg.gain.value = f0 * 0.025
      vib.connect(vg).connect(o.frequency)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(vol, t0 + (boo ? 0.18 : 0.06))
      g.gain.setValueAtTime(vol, t0 + len * 0.7)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + len)
      for (const [hz, q, a] of F) {
        const bp = ctx.createBiquadFilter(), ga = ctx.createGain()
        bp.type = 'bandpass'; bp.frequency.value = hz * (fem ? 1.12 : 1); bp.Q.value = q; ga.gain.value = a * 4
        o.connect(bp).connect(ga).connect(g)
      }
      g.connect(out)
      o.start(t0); o.stop(t0 + len + 0.05); vib.start(t0); vib.stop(t0 + len + 0.05)
    }
  },

}

export { SYNTH }

// White noise, dur seconds, for the blade and breath synths.
function _bladeNoise(ctx, dur) {
  const b = ctx.createBuffer(1, Math.max(1, Math.round(ctx.sampleRate * dur)), ctx.sampleRate), d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const s = ctx.createBufferSource(); s.buffer = b; return s
}

// Sparse random clicks, rate per second, for bubbles (wet breath, a wet cough).
function _crackle(ctx, dur, rate) {
  const n = Math.max(1, Math.round(ctx.sampleRate * dur)), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0)
  const each = ctx.sampleRate / rate
  for (let i = Math.floor(Math.random() * each); i < n; i += Math.floor(each * (0.4 + Math.random() * 1.2))) {
    const a = (Math.random() * 2 - 1) * (0.5 + Math.random()), len = 40 + Math.floor(Math.random() * 120)
    for (let j = 0; j < len && i + j < n; j++) d[i + j] += a * Math.exp(-j / (len * 0.3)) * Math.sin(j * (0.25 + Math.random() * 0.1))
  }
  const s = ctx.createBufferSource(); s.buffer = b; return s
}


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
    // Harp shimmer fade
    const now    = ctx.currentTime
    const vol    = opts.volume ?? 0.15
    const master = ctx.createGain()
    master.gain.setValueAtTime(vol, now)
    master.gain.exponentialRampToValueAtTime(0.001, now + 2.0)
    master.connect(ctx.destination)
    const scale = [392, 494, 587, 740, 880, 1047, 1175, 1397]
    scale.forEach((freq, i) => {
      const t   = now + i * 0.06 + Math.random() * 0.02
      const osc = ctx.createOscillator()
      const g   = ctx.createGain()
      osc.type  = 'triangle'
      osc.frequency.value = freq
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.8, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.5)
      osc.connect(g); g.connect(master)
      osc.start(t); osc.stop(t + 1.6)
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

}

export { SYNTH }


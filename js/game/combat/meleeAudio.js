// meleeAudio.js
// Location: js/game/combat/meleeAudio.js
//
// The fight's sound, made from the game's own synths: blades, bodies and
// breath from SoundBoard (SWORD_SWISH, BLADE_KNOCK, BLADE_THUD, SWORD_DRAW,
// SWORD_SHEATHE, BREATH, BODY_FALL, FOOT_SHUFFLE), voices from VoiceSynth
// (the interjections kiai, grunt, oof, ha, fall). One VoiceSynth each for
// you and him, so his shout never cuts yours off.
//
//   const audio = new MeleeAudio(scene, melee, { material: 'wood', foeVoice: 'ronnie' })
//   audio.onEvent(name, data)   from Melee's emit
//   audio.update()              every frame (breathing, footwork)

import { SoundBoard } from '../systems/soundBoard.js'
import { VoiceSynth, championVoice } from '../systems/voice/voiceSynth.js'
import { SALUTE_MS, DRAW_MS } from './meleeView.js'

// Who sounds like whom. 'ronnie' is the hall bard's gravel, 'dallan' a
// younger man, 'peig' a woman. Change freely.
export const VOICES = { foe: 'ronnie', playerMale: 'dallan', playerFemale: 'peig' }

// Your breathing (panting, gasping, spluttering) and coughing are OFF until
// there are recordings: the synthesised versions don't read as breath. His
// tell stays (the sharp breath he draws before a blow). Set true to hear the
// synths again.
export const BREATHING = false

export default class MeleeAudio {
  constructor(scene, melee, { material = 'wood', foeVoice = VOICES.foe, foeKey = 'Ador' } = {}) {
    this.scene = scene
    this.m = melee
    this.material = material
    const ac = SoundBoard.ctx(scene)
    this.ac = ac
    this.pv = ac ? new VoiceSynth({ audioContext: ac, volume: 0.5 }) : null
    this.fv = ac ? new VoiceSynth({ audioContext: ac, volume: 0.5 }) : null
    const female = championVoice(scene.player?.champion) === 'peig'      // from the champion's pronouns
    this.pVoice = female ? VOICES.playerFemale : VOICES.playerMale
    this.pBreath = female ? 'female' : 'male'
    this.pKey = scene.player?.champion?.tuneKey || 'D'
    this.fVoice = foeVoice
    this.fKey = foeKey
    this._said = { player: 0, foe: 0 }
    this._breath = { next: 0, inhale: true }
    this._feet = { player: 0, foe: 0 }
    this._timers = new Set()
  }

  sfx(key, opts = {}) { SoundBoard.playWeb(key, this.scene, { material: this.material, ...opts }) }
  breath(opts) { if (BREATHING) this.sfx('BREATH', opts) }
  cough(opts) { if (BREATHING) this.sfx('COUGH', opts) }
  // a voice, never more than one every ~280 ms per fighter
  say(who, type, chance = 1) {
    if (Math.random() > chance) return
    const now = performance.now()
    if (now - this._said[who] < 280) return
    this._said[who] = now
    const v = who === 'player' ? this.pv : this.fv
    try { v?.interject(type, { voice: who === 'player' ? this.pVoice : this.fVoice, tuneKey: who === 'player' ? this.pKey : this.fKey }) } catch (_) {}
  }
  jitter(a = 0.08) { return 1 + (Math.random() * 2 - 1) * a }

  onEvent(name, d = {}) {
    switch (name) {
      case 'swing':
        this.sfx('SWORD_SWISH', { pitch: (d.flip ? 1.3 : d.charged ? 0.8 : 1) * this.jitter(), dur: d.flip ? 0.12 : d.charged ? 0.22 : 0.17,
                                  volume: d.air ? 0.24 : 0.32 })
        if (d.charged || d.lunge) this.say('player', 'kiai')
        else if (d.patient && !d.air) this.say('player', 'grunt', 0.35)
        break
      case 'foeSwing': this.sfx('SWORD_SWISH', { pitch: 0.9 * this.jitter(), dur: 0.15, volume: 0.3 }); this.say('foe', 'ha', 0.5); break
      case 'tell': this.sfx('BREATH', { inhale: true, kind: 'gasp', voice: 'male', effort: 0.5, volume: 0.15, wheeze: 0, pitch: 0.85 }); break   // he draws breath: the tell
      case 'chargeStart': this.breath({ inhale: true, kind: 'pant', voice: this.pBreath, effort: 0.6, volume: 0.2 }); break
      case 'enGarde': this.sfx('SWORD_DRAW'); this._later(520, () => this.breath({ kind: 'pant', voice: this.pBreath, effort: 0.3, volume: 0.1 }), 520); break
      case 'atEase': this.sfx('SWORD_SHEATHE'); break
      case 'parried': this.sfx('BLADE_KNOCK', { hard: 0.35, pitch: this.jitter() * (1 + 0.04 * (d.exchange || 0)) }); break
      case 'clash': this.sfx('BLADE_KNOCK', { hard: 1, pitch: this.jitter() }); this.say('player', 'grunt', 0.5); break
      case 'hit':
        this.sfx('BLADE_THUD', { hard: d.charged || d.desperate ? 1 : 0.5 })
        if (d.unarmed) { this.say('foe', 'distress'); break }
        this.say(d.on === 'player' ? 'player' : 'foe', 'oof', 0.85)
        // a good one, with breath to spare: a laugh. His, when he catches you tired.
        if (d.on === 'foe' && d.fresh && (d.exchange >= 2 || d.charged)) this._later(260, () => this.say('player', 'haha', 0.6))
        if (d.on === 'player' && d.tired) this._later(240, () => this.say('foe', 'haha', 0.35))
        break
      case 'spent':                                            // you reach for a swing that isn't there
        if (d.lastHeart) { this.coughFit(2 + (Math.random() < 0.5 ? 1 : 0)); this._breath.next = performance.now() + 900 }   // the splutter follows
        else this.breath({ kind: 'gasp', voice: this.pBreath, effort: 1, volume: 0.13 })
        break
      case 'shove':
        this.sfx('BLADE_THUD', { hard: 0.25, volume: 0.45 }); this.say('player', 'grunt')
        this._later(90, () => this.say('foe', 'oof', 0.7))
        break
      case 'disarm':
        this.say('foe', 'oh')
        this.sfx('SWORD_SWISH', { pitch: 1.8, dur: 0.22, volume: 0.2 }); this._later(230, () => this.sfx('SWORD_SWISH', { pitch: 1.6, dur: 0.22, volume: 0.16 }))
        this._later(660, () => this.sfx('BLADE_KNOCK', { hard: 0.25, pitch: 0.7 }))          // it lands, and clatters
        this._later(760, () => this.sfx('BLADE_KNOCK', { hard: 0.1, pitch: 0.75 }))
        break
      case 'swordRecovered':
        this.sfx('FOOT_SHUFFLE'); this._later(180, () => this.sfx('BLADE_KNOCK', { hard: 0.08, pitch: 0.8, volume: 0.3 }))
        break
      case 'dodge': this.sfx('SWORD_SWISH', { pitch: 1.7, dur: 0.08, volume: 0.16 }); break
      case 'knockdown':
        this._later(120, () => this.sfx('BODY_FALL', { volume: d.hard ? 0.7 : 0.55 }))
        if (!d.hard) this.say(d.who === 'player' ? 'player' : 'foe', 'fall')
        if (d.who === 'foe' && !d.final && this.m.breath / this.m.cap() > 0.5) this._later(420, () => this.say('player', 'haha', 0.5))
        if (d.who === 'player' && d.final) this._later(700, () => this.say('foe', 'laugh', 0.6))   // a teacher's laugh: not unkind
        break
      case 'rise': this.sfx('FOOT_SHUFFLE'); this._later(140, () => this.sfx('FOOT_SHUFFLE', { pitch: 0.8 })); break
      // the salute's swish comes as the sword is swept down (62% through: meleeView.js)
      // he draws and salutes you; yours is up to you (swipe up again)
      case 'boutStart':
        this.sfx('SWORD_DRAW', { volume: 0.11 })
        this._later(DRAW_MS + 0.62 * SALUTE_MS, () => this.sfx('SWORD_SWISH', { pitch: 1.1, dur: 0.14, volume: 0.22 }))
        break
      // one salute, one swish as the blade is swept down; d.draw: drawn first
      case 'salute': {
        const mine = d.by === 'player', at = (d.draw ? DRAW_MS : 0) + 0.62 * SALUTE_MS + (d.reply ? 90 : 0)
        if (d.draw) this.sfx('SWORD_DRAW', { volume: 0.11 })
        this._later(at, () => this.sfx('SWORD_SWISH', { pitch: mine ? 1.2 : 1.1, dur: 0.14, volume: 0.22 }))
        if (d.end) this._later(SALUTE_MS + 0.55 * 900, () => this.sfx('SWORD_SHEATHE', { volume: 0.08 }))   // and puts it away
        break
      }
      case 'cheapShot': this._later(200, () => this.say('foe', 'oh')); break
      case 'winded': this._breath.next = performance.now(); break                 // the splutter starts at once
    }
  }

  // a fit of coughing: n coughs, each a little weaker
  coughFit(n = 2) {
    for (let i = 0; i < n; i++) this._later(i * (310 + Math.random() * 70), () => this.cough({ voice: this.pBreath, weak: 0.2 + 0.25 * i, wet: 0.3, pitch: this.jitter(0.05) }))
  }

  _later(ms, fn) { const id = setTimeout(() => { this._timers.delete(id); fn() }, ms); this._timers.add(id) }

  update() {
    const m = this.m, now = performance.now()
    // Breathing. A workout pant is steady -- in, a soft "hah" out -- and
    // quickens as you tire. An all-out gasp is ragged: a snatched, rasping
    // breath in, a long groan out, uneven gaps, now and then a second
    // snatch before the breath goes out again.
    const bs = m.breathState()
    if (bs) {
      if (now >= this._breath.next) {
        const e = m.effort(), inh = this._breath.inhale, v = this.pBreath, j = () => this.jitter(0.04)
        if (bs === 'splutter') {
          // Coming up from nothing: a whooping in-breath, a burst of wet
          // coughs, a wheezy groan out -- a beat -- again. Wetter and more
          // coughs the deeper in you are; it eases as breath comes back.
          const deep = m.winded() ? 1 : Math.max(0.35, 1 - m.breath / Math.max(1, m.cap()))
          const n = 1 + Math.round(deep * 1.6 + Math.random() * 0.8)
          this.breath({ kind: 'splutter', inhale: true, voice: v, effort: 1, volume: 0.13, wet: 0.6 * deep, wheeze: 0.9 * deep, pitch: j() })
          let at = 540
          for (let i = 0; i < n; i++) { const w = i; this._later(at, () => this.cough({ voice: v, weak: 0.15 + 0.22 * w, wet: 0.7 * deep, pitch: j() })); at += 300 + Math.random() * 70 }
          this._later(at + 40, () => this.breath({ kind: 'splutter', inhale: false, voice: v, effort: 1, volume: 0.13, wet: 0.4 * deep, wheeze: 0.7 * deep, pitch: j() }))
          this._breath.next = now + at + 640 + Math.random() * 250
          this._breath.inhale = true
        } else if (bs === 'gasp') {
          // ragged: snatched in, groaned out, uneven gaps; the wheeze fading, now and then a cough
          const again = inh && Math.random() < 0.2                  // a second snatch of air
          this.breath({ kind: 'gasp', inhale: inh, voice: v, effort: Math.max(0.7, e), volume: 0.13, wheeze: 0.3 * e, pitch: j() })
          this._breath.next = now + (inh ? (again ? 150 : 360) : 560 + Math.random() * 320)
          this._breath.inhale = again ? true : !inh
          if (!inh && Math.random() < 0.12) { this._breath.next += 380; this._later(500, () => this.cough({ voice: v, weak: 0.4, pitch: j() })) }
        } else {
          // a good workout: steady, in and a soft "hah" out, quicker as you tire
          this.breath({ kind: 'pant', inhale: inh, voice: v, effort: e, volume: 0.1, pitch: j() })
          const period = 600 - 200 * e
          this._breath.next = now + period * (inh ? 0.4 : 0.6) * this.jitter(0.08)
          this._breath.inhale = !inh
        }
      }
    } else { this._breath.next = now; this._breath.inhale = true }
    // footwork in a bout: light feet on the turf, in time with the bounce (meleeView)
    if (m.combat) {
      const pb = Math.floor(now / 840), fb = Math.floor((now + 170) / 940)
      if (pb !== this._feet.player && !m.moving() && !m.charge) this.sfx('FOOT_SHUFFLE', { pitch: this.jitter(0.15) })
      if (fb !== this._feet.foe && ['approach', 'rest'].includes(m.foe.state)) this.sfx('FOOT_SHUFFLE', { pitch: 0.8 * this.jitter(0.15), volume: 0.025 })
      this._feet.player = pb; this._feet.foe = fb
    }
  }

  destroy() {
    for (const id of this._timers) clearTimeout(id)
    this._timers.clear()
    try { this.pv?.stop(); this.fv?.stop() } catch (_) {}
  }
}

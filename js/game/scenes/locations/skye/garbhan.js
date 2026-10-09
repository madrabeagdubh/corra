// garbhan.js
// Location: js/game/scenes/locations/skye/garbhan.js
//
// Garbhán, the bully on the loch's middle bank (skyeLoch.js hosts him). He is a MeleeBout with
// the GARBHAN preset (combat/enemies.js); this runs everything around the fight:
//
//   wait    he stands on the bank; come within TALK_AT tiles (on dry ground) and
//   talk    he speaks, on the game's conversation card (_talk below). Having been here before, he only sneers. Then
//   fight   m.engage(): he shoves you (at the water's edge, into the loch), then the wooden sword,
//           then, on his last wooden heart, a knife. Draw your sword or run: nothing is drawn for you.
//   over    boutOver carries how it ended:
//             ko, drowned   you wake in Conall's cabin (tighConaill.js, data.wake), and he is still here
//             killed        the knife: the hero is deleted, back to the hero slots
//             fled (lost)   you ran: he stays, the talk starts again if you come back
//             fled (won)    you beat him to his last knife heart: he drops it and runs for the loch
//             escaped       you jumped into the loch to get away from the knife: once ashore, he goes
//             dunked        you shoved him in at the water's edge: he swims off
//           After the last three he is gone from the bank (note garbhan_gone), with garbhan_ambush
//           set and garbhan_end_<how> for the story: he comes back later, with his gang (not built).
//
// The loch's own _dunk teleport and the terrain's drowning are off while he fights
// (skyeLoch.js: this.fighting): the engine drowns you, a heart a second after a second's grace.
//
// All the words are PLACEHOLDERS: English in both fields until an Irish speaker has been at them.
// His fight barks (L below) are one-line captions; the conversation is the card.

import MeleeBout from '../../../combat/meleeBout.js'
import { GARBHAN, GARBHAN_KNIFE } from '../../../combat/enemies.js'
import { GameState } from '../../../systems/gameState.js'
import { SKYE_GID } from './skyeScene.js'
import { figureBox, splash, dustPuff } from './dustDash.js'

// the knife is drawn as the Oryx knife (TILES.KNIFE); the fight's numbers are enemies.js's
const F = { ...GARBHAN, next: { ...GARBHAN_KNIFE, swordGid: 2495 } }
export const HOME = [18, 14]            // the map's own (mapData.garbhanHome) wins
export const NOTES = { met: 'garbhan_met', ko: 'garbhan_ko', gone: 'garbhan_gone', ambush: 'garbhan_ambush' }
const DATA_DIR = 'skye', DATA_KEY = 'skyeLoch'      // public/data/skye/skyeLoch.js (a template, so vite leaves it be)
const TALK_AT = 4            // tiles
const REARM = 6              // after you ran, he talks again once you've been this far off
const RUN_MS = 150           // one of his steps, running off
const INK = { garbhan: '#e0876a' }

const both = (s) => ({ ga: s, en: s })

const L = {
  wood:   { en: 'Fine.',
            ga: 'Go brea.' },
  knife:  { en: "Here is my knife for you",
            ga: "Seo dhuit mo scían" },
  escape: { en: 'Swim! Swim home',
            ga: 'Snámh! Snámh abhaile' },
  flee:   { en: "I'll be back! me and the lads",
            ga: "Beidh mé ar ais! Mise agus na leaids" },
  dunked: { en: "You'll pay for that d'you hear? You'll pay dearly",
            ga: "Íocfaidh tú as sin a dtigeann tú?Íocfaidh tú go daor" },
  ran:    { en: "That's it, flee!",
            ga: "Sin é, teith!" },
}




export default class Garbhan {
  constructor(scene) {
    this.scene = scene
    this.state = 'gone'            // wait | talk | fight | gone
    this.fighting = false          // from the charge to the end: the loch's rules are his (skyeLoch.js)
    this._t = []
    if (GameState.hasNote(NOTES.gone)) return
    this._spawn()
  }

  get talking() { return this.state === 'talk' }
  // where the caption's focus goes while he talks
  speakerTile() { return this.state === 'talk' && this.m ? [this.m.foe.c, this.m.foe.r] : null }

  _spawn() {
    const s = this.scene
    s._melee?.destroy()
    this.bout = s._melee = new MeleeBout(s, { F, home: [...(s.mapData?.garbhanHome || HOME)], gid: SKYE_GID.GARBHAN, voice: 'dallan' })
    this.m = this.bout.melee
    this.state = 'wait'
    this._ending = null; this._waking = false; this._cool = 0; this._armed = true
  }

  _later(ms, fn) { const t = this.scene.time.delayedCall(ms, fn); this._t.push(t); return t }
  _clearTimers() { for (const t of this._t) t.remove?.(false); this._t = [] }

  // ── the frame ────────────────────────────────────────────────────────────
  update(delta) {
    if (this.state !== 'wait' || !this.m) return
    const s = this.scene, m = this.m
    if (s._phase !== 'free' || s._dunking || s.player.isMoving) return
    const [pc, pr] = m.pa.tile()
    if (s.isWet(pc, pr)) return
    const d = m.cheb()
    if (!this._armed) { if (d > REARM) this._armed = true; return }
    this._cool = Math.max(0, this._cool - delta)
    if (this._cool > 0) return
    if (d <= TALK_AT) this._talk()
  }

  // ── the talk ─────────────────────────────────────────────────────────────
  // The game's own conversation card (encounterPanel.js / textPanel.js): his portrait and tune, the
  // reader's pace. The words are in public/data/skye/skyeLoch.js (from tools/dialogue/drafts/skyeLoch.dlg);
  // the panel is opened here by hand, as tighConaill.js does. When the last card is read, the fight begins.
  async _talk() {
    const s = this.scene, panel = s._encounterPanel
    this.state = 'talk'
    s.joystick?.reset?.()
    s.player.clearPath?.()
    if (!panel) return this._charge()
    let enc
    try {
      const mod = await import(/* @vite-ignore */ `/data/${DATA_DIR}/${DATA_KEY}.js`)
      enc = mod.skyeLochContent.fixedEncounters.find(e => e.id === 'garbhan')
    } catch (e) { console.warn('[garbhan] no conversation:', e.message) }
    if (this.state !== 'talk') return                       // the scene went while it loaded
    if (!enc) return this._charge()
    const stateKey = 'skye_loch.garbhan'
    const d = { type: 'fixed_encounter', stateKey, dialogues: enc.dialogues, portrait: enc.portrait, logicalX: 0, logicalY: 0 }
    const zone = { getData: k => d[k], setData() {} }
    GameState.setNPCProgress(stateKey, 0)
    panel._card = { id: 'fixed:garbhan', visual: enc.visual }
    panel._active = zone
    panel._openPanel()
    let idle = 0
    const poll = () => {
      if (this.state !== 'talk') return
      if (!panel._isOpen) return this._charge()
      // Safety net (as in tighConaill.js): a card gone and no next one coming -- show it ourselves
      const tp = s.textPanel
      idle = (!tp.isVisible && !tp.isFading && !panel._chainTimer) ? idle + 200 : 0
      if (idle >= 1500) { idle = 0; console.warn('[garbhan] dialogue stalled: showing the next card'); panel._reopenDialogue(zone) }
      this._later(200, poll)
    }
    this._later(200, poll)
  }

  _charge() {
    GameState.addNote(NOTES.met)
    this.state = 'fight'; this.fighting = true
    this._ending = null; this._waking = false
    this.scene._caption?.hide?.()
    this.scene.joystick?.showDirections?.()
    this.m.engage()
  }

  // ── events from the fight (skyeLoch.onMeleeEvent) ────────────────────────
  onMeleeEvent(name, d = {}) {
    if (!this.fighting) return
    switch (name) {
      case 'phase': this._say(d.to === 'knife' ? L.knife : L.wood, 2400, false); break
      case 'inWater': this._splashPlayer(); break
      case 'ashore': this._ashore(); break
      case 'drowned': this._wake('drowned'); break
      case 'boutOver': this._boutOver(d); break
    }
  }

  _boutOver(d) {
    if (this._ending) return
    this._ending = d.how
    if (!this._playerWet()) this.m.endFight()               // in the water, the drowning goes on until you're out
    switch (d.how) {
      case 'ko': case 'drowned': return this._wake(d.how)
      case 'killed': return this._die()
      case 'dunked': return this._swimOff()
      case 'escaped': return this._say(L.escape, 2600, false)       // the rest waits for 'ashore'
      case 'fled': return d.won ? this._runOff(false) : this._ran()
      default: return this._ran()
    }
  }

  _ashore() {
    this.m.endFight()
    if (this._ending === 'escaped') this._later(1500, () => this._runOff(true))
  }

  _playerWet() { const [c, r] = this.m.pa.tile(); return this.scene.isWet(c, r) }
  _splashPlayer() { const [c, r] = this.m.pa.tile(); splash(this.scene, figureBox(this.scene, c, r)) }

  // ── endings ──────────────────────────────────────────────────────────────
  // knocked out or under: black, and the cabin (which takes the black over, as after the landfall)
  _wake(how) {
    if (this._waking) return
    this._waking = true
    this._clearTimers()
    const s = this.scene
    GameState.addNote(NOTES.ko)
    s.joystick?.hideDirections?.()
    this._later(900, () => this._veil(700))
    this._later(1800, () => {
      this.m?.endFight()
      s.scene.start('skye_tigh_conaill', { champion: s.registry.get('selectedChampion') || window.selectedChampion, wake: 'garbhan', how })
    })
  }

  // the knife: Player.onDeath has already begun (pa.kill); the hero is gone for good
  _die() {
    this._clearTimers()
    const id = GameState._championId
    this._later(3200, () => this._veil(1200))
    this._later(4600, () => {
      try { GameState.deleteHero(id) } catch (_) {}
      try { window.location.assign(window.location.pathname) } catch (_) {}      // the hero slots
    })
  }

  // you ran: he stays where he was; come back and he starts again
  _ran() {
    this._say(L.ran, 2200, false)
    this.fighting = false
    this._later(60, () => {                                 // not inside the engine's own update
      this.m.endFight()
      this._spawn()
      this._cool = 3500; this._armed = false
    })
  }

  // he drops the knife (won) or keeps it (you swam off), and runs for the loch
  _runOff(armed) {
    const m = this.m, foe = m.foe
    this._say(L.flee, 2600, false)
    m._setFoe('rest', 1e9)
    if (!armed) foe.armed = false
    const path = this._pathToWater()
    const go = (i) => {
      if (i >= path.length) return this._done()
      const [c, r] = path[i]
      foe.from = [foe.c, foe.r]; foe.t0 = m.t; foe.ms = RUN_MS; foe.c = c; foe.r = r
      this._later(RUN_MS + 10, () => {
        if (i === path.length - 1) splash(this.scene, figureBox(this.scene, c, r))
        go(i + 1)
      })
    }
    this._later(1200, () => go(0))
  }

  // you shoved him in: he's in the loch already
  _swimOff() {
    const foe = this.m.foe
    this.m._setFoe('rest', 1e9)
    foe.armed = false
    this._say(L.dunked, 2600, false)
    splash(this.scene, figureBox(this.scene, foe.c, foe.r))
    this._later(1800, () => { splash(this.scene, figureBox(this.scene, foe.c, foe.r)); this._done() })
  }

  // he's off the bank for good (for now): notes, a checkpoint, and your sword alone
  _done() {
    const s = this.scene, how = this._ending
    if (this.bout.flag) this.bout.flag.hidden = true
    dustPuff(s, figureBox(s, this.m.foe.c, this.m.foe.r), 0, 6)
    GameState.addNote(NOTES.gone); GameState.addNote(NOTES.ambush); GameState.addNote(`garbhan_end_${how}`)
    this._later(300, () => {
      s._melee?.destroy()
      s._melee = new MeleeBout(s)
      this.bout = this.m = null
      this.state = 'gone'; this.fighting = false
      const [c, r] = [Math.floor(s.player.logicalX / s.tileSize), Math.floor(s.player.logicalY / s.tileSize)]
      if (!s.isWet(c, r)) GameState.saveSpot('skye_loch', [c, r])
      s.joystick?.showDirections?.()
    })
  }

  // the way he runs: across dry ground (stones too) to the nearest water, and in
  _pathToWater() {
    const s = this.scene, m = this.m, W = s.mapData.width, H = s.mapData.height
    const key = (c, r) => c + ',' + r
    const from = [m.foe.c, m.foe.r], prev = new Map([[key(...from), null]]), q = [from]
    for (let i = 0; i < q.length && q.length < 2000; i++) {
      const [c, r] = q[i]
      for (const [dx, dy] of [[0, -1], [1, 0], [-1, 0], [0, 1]]) {
        const nc = c + dx, nr = r + dy
        if (nc < 0 || nr < 0 || nc >= W || nr >= H || prev.has(key(nc, nr))) continue
        if (s.isWet(nc, nr)) {                                 // the first water: that's the end
          prev.set(key(nc, nr), [c, r])
          const path = []
          for (let n = [nc, nr]; n && !(n[0] === from[0] && n[1] === from[1]); n = prev.get(key(...n))) path.unshift(n)
          return path
        }
        if (!m.foeFree(nc, nr)) continue
        prev.set(key(nc, nr), [c, r]); q.push([nc, nr])
      }
    }
    return []
  }

  // ── words ────────────────────────────────────────────────────────────────
  _say(line, ms, focus = true) {
    const c = this.scene._caption
    if (!c) return
    c.setColor(INK.garbhan)
    focus ? c.speak(line.ga, line.en, ms) : c.show(line.ga, line.en, ms)
  }

  // a black veil held over the scene, which the cabin's waking takes over (like #landfall-veil after the landing)
  _veil(ms) {
    if (document.getElementById('landfall-veil')) return
    const v = document.createElement('div')
    v.id = 'landfall-veil'
    v.style.cssText = `position:fixed;inset:0;background:#000;opacity:0;pointer-events:all;z-index:1000002;transition:opacity ${ms}ms ease-in`
    document.body.appendChild(v)
    requestAnimationFrame(() => requestAnimationFrame(() => { v.style.opacity = '1' }))
  }

  destroy() {
    this._clearTimers()
  }
}

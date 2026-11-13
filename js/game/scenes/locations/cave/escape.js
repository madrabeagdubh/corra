// escape.js
// Location: js/game/scenes/locations/cave/escape.js
//
// The escape from the underworld: the action road's opening (design doc: "The action road"). You are the ghost,
// at the height of your strength, deep under the ground at the Well of Segais. Géaga will not let you go back up
// to the living -- and then she looks away. Climb: follow the stream, which runs uphill, through the deeps, the
// galleries, the hall under the hill and the crossing, to the source of the Boyne and the night air.
//
// The maps are tools/map-editor/generators/escape_gen.mjs (public/maps/cave/escape_*.json, drawn by hewnRock.js);
// each says, in its `escape` block, where its ways go, where they wait for you, and who is there. The words are
// public/data/underworld/escape.js (from tools/dialogue/drafts/escape_*.dlg: placeholders for now).
//
//   ?scene=escape                    from the start, at the well
//   &map=escape_sidh                 any stage (escape_tobar, _doimhne, _gailearai, _balor, _sidh, _droichead, _foinse)
//   &at=12,30                        on this tile
//   &explore=1                       explorer mode: wander and talk, nothing comes at you
//   &water=blue                      the pure water deep blue instead of near black (to compare)
//   &packs=0  &eyes=0  &sound=0      no ambushes / no eyes in the dark / no sound
//   &ferry=0                         past the sea-door (escape_donn): she does not come
//   &ts=0                            no tilt-shift
//   &reset=1                         forget the escape so far (the notes it set: Géaga, the púcaí, the fights won)
//
// The fights: where a map's `packs` say, ghouls come at you out of the dark when you step into the box (once:
// beaten, they stay beaten, a note each). Elsewhere, where the map asks, eyes open in the dark while you stand
// still (effects/watchers.js), as in the cave's otherside. Deep down they are strong; near the top there are more
// of them, weaker, and quick to run. Balor's guards, astray, are beyond you. Beaten, you wake where you came in
// (in Balor's hall: at the well, where she found you).
//
// The ghost: the champion picked among the stars, dead and at full strength -- hearts, Neart and Cosaint
// doubled and more, a little see-through. The light it carries comes from its sword: cold and clear, and further-reaching
// with the blade drawn. Every technique is its own already (the
// strong blow, the timed parry, the dash: on Skye the living learn them one by one), for these bouts only: nothing
// is written to the save. In its hand its own sword (combat/ghostBlade.js), cold light coming off it; never kept in
// the pack.

import HewnTest from './hewnTest.js'
import { HewnFigures, HewnCave } from '../../../effects/hewnFigures.js'
import { drawPuca, drawGeagaFace } from '../../../effects/puca.js'
import { sigilGlyph, figureGlyph } from '../../../effects/statues.js'
import { SIGILS } from '../../../effects/hewnExtras.js'
import Watchers from '../../../effects/watchers.js'
import UnderworldAudio from '../../../systems/underworldAudio.js'
import MeleeBout from '../../../combat/meleeBout.js'
import { GHOUL, GHOUL_GID, registerGhoul } from '../../../combat/ghoul.js'
import { stats } from '../../../combat/enemies.js'
import { GHOST_BLADE_ID, prepareGhostBlade, drawGhostBladeLight } from '../../../combat/ghostBlade.js'
import { createItem } from '../../../ui/inventory/itemDefinitions.js'
import { GameState } from '../../../systems/gameState.js'
import SkyeCaption from '../skye/skyeCaption.js'
import ThornHarp from './thornHarp.js'
import BalorSlot from './balorSlot.js'
import WellMirror from './wellMirror.js'

const Q = new URLSearchParams(window.location.search)
const FIRST = 'escape_tobar'
const EXPLORE = Q.get('explore') === '1'                // wander: no ambushes, no eyes in the dark
const DATA = { dir: 'underworld', key: 'escape' }     // public/data/underworld/escape.js
const REVEAL_MS = 900          // a ghoul stands seen this long before it charges
const JOIN_MS = 1100           // the rest of a pack come this far apart
const REST_AFTER = 40          // seconds of no eyes after a fight
const GHOST_ALPHA = 0.78       // how solid the ghost is
const COLD = [0.86, 0.95, 1.12]   // the light it carries: its sword's, cold and clear
const LIGHT = 7.0, LIGHT_DRAWN = 8.6   // how far that light reaches (tiles); further with the blade out of the scabbard
// what waits for you, by how deep you are
const FOES = {
  deep:    { ...GHOUL, ...stats({ health: 5, attack: 8, defense: 3, speed: 4, stamina: 5 }), stepMs: 360 },
  mid:     { ...GHOUL },
  shallow: { ...GHOUL, ...stats({ health: 2, attack: 4, defense: 1, speed: 5, stamina: 3 }), stepMs: 320, flees: true },
  fomor:   { ...GHOUL, ...stats({ health: 9, attack: 12, defense: 6, speed: 5, stamina: 7 }), stepMs: 300, combo: 3, windMs: 300 },
}
const EYES = { fomor: [255, 90, 60] }                // their eyes' colour, if not the ghouls' green
const BOOST = { health: 3, attack: 2, defense: 2 }   // the ghost's strength: the champion's own, times these

const tileOf = (p, ts) => [Math.floor(p.logicalX / ts), Math.floor(p.logicalY / ts)]
const inBox = ([x, y], b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1

export default class Escape extends HewnTest {
  static _ferryT = {}             // how far she has come, by map (for this sitting)
  constructor() { super('escape') }

  getMapKey() { return this.entryData?.map || Q.get('map') || FIRST }

  // the ghost's light: cold, and a little shorter than a torch's
  hewnOptions() { return { warm: COLD, torch: Q.has('torch') ? Number(Q.get('torch')) : LIGHT, water: Q.get('water') || 'dark' } }

  async _loadContent() {
    await super._loadContent()
    const md = this.mapData, E = this.esc = md.escape || { ways: [], packs: [], npcs: [] }
    { const ch = this.registry.get('selectedChampion') || window.selectedChampion, cid = GameState.heroIdOf(ch); if (cid) GameState.init(cid) }   // (create does this too, later: the notes are needed now)
    if (Q.get('reset') === '1' && !Escape._resetDone) { Escape._resetDone = true; this._forget() }
    const t = this.entryData?.tile
    if (Array.isArray(t)) md.spawns.player = { x: t[0], y: t[1] }
    this._entry = [md.spawns.player.x, md.spawns.player.y]
    // Géaga's roots across the stair: shut until she looks away
    this._gate = E.gate && !GameState.hasNote(E.gate.note) ? new Set(E.gate.tiles.map(([x, y]) => x + ',' + y)) : null
    try {
      const mod = await import(/* @vite-ignore */ `/data/${DATA.dir}/${DATA.key}.js`)
      this._content = mod.escapeContent
    } catch (e) { console.warn('[escape] no words:', e.message); this._content = { fixedEncounters: [] } }
    // who is here: their zones (talked to as anyone is: the badge on the moon), drawn by this scene
    md.objects = []
    for (const n of E.npcs) {
      const enc = this._content.fixedEncounters.find(f => f.id === n.id)
      if (!enc || this._gone(n)) continue
      // the icon on the moon when you come near: a gate's own sigil, Géaga's leaf, the face of the dead
      const glyph = n.kind === 'gate' && n.sigil ? sigilGlyph(n.sigil, n.rgb || [230, 220, 190], (g, R) => SIGILS[n.sigil](g, R, 0))
        : n.kind === 'geaga' || n.kind === 'shade' ? figureGlyph(n.kind) : null
      md.objects.push({ id: n.id, x: Math.floor(n.x), y: Math.floor(n.y), type: 'fixed_encounter', radius: n.radius, dialogues: enc.dialogues, stateKey: 'escape.' + n.id, glyph })
    }
  }

  // forget the escape (for trying it again): every note it set
  _forget() {
    for (const n of [...(GameState._state?.notes || [])]) if (/^escape_/.test(n)) GameState.removeNote(n)
  }

  // a púca let go before is gone from here
  _gone(n) { return n.kind === 'puca' && GameState.hasNote(`escape_${n.id}_free`) }

  // the zones, as the bog's scenes make them (no figure for PGR to draw: this scene draws its own)
  createObjects() {
    this.interactables = []
    for (const obj of this.mapData.objects || []) {
      const ts = this.tileSize, px = obj.x * ts + ts / 2, py = obj.y * ts + ts / 2
      const zone = this.add.zone(px, py, ts, ts)
      zone.setData('id', obj.id); zone.setData('type', obj.type); zone.setData('stateKey', obj.stateKey)
      zone.setData('logicalX', px); zone.setData('logicalY', py)
      zone.setData('flagVisual', obj.glyph ? { glyph: obj.glyph } : { gid: 255, flat: false }); zone.setData('visual', {})
      zone.setData('dialogues', obj.dialogues || []); zone.setData('actions', [])
      if (obj.radius) zone.setData('radius', obj.radius * ts)
      this.interactables.push(zone)
    }
  }

  // the gate: its tiles are no way through while it stands
  walkZ(c, r) {
    if (this._gate?.has(c + ',' + r)) return null
    return super.walkZ(c, r)
  }

  onEnter() {
    super.onEnter()
    this.fighting = false; this._waking = false; this._leaving = false; this._reveal = null; this._joins = []; this._pack = null
    this._arrived = 0
    const h = this.hewn
    this.figures = new HewnFigures(this, h)
    this.cave = new HewnCave(h)
    registerGhoul(this.perspectiveGround)
    this._ghost()
    this.joystick?.setMetal?.('gold')                 // the brooch of a champion at full strength (the escape only: no note)
    // who is drawn here: Géaga's face, the púcaí
    this._npcs = (this.esc.npcs || []).filter(n => !this._gone(n)).map(n => ({ ...n, z: h.walkZ(Math.floor(n.x), Math.floor(n.y)) ?? h.surfZ(Math.floor(n.x), Math.floor(n.y)) ?? 0, wake: 0, t: 0 }))
    for (const n of this._npcs) if (n.kind === 'geaga') n.z = 4.2
    h.rowHooks.push((ctx, r) => this._drawNpcs(ctx, r))
    if (!this._gate && this.esc.gate) this._dropGateProp(true)
    if (Q.get('sound') !== '0') this.audio = new UnderworldAudio(this)
    if (Q.get('eyes') !== '0' && !EXPLORE && this.esc.watchers) {
      this.watchers = new Watchers(this, this.cave, { count: this.esc.watchers, audio: this.audio, onAttack: (w, p) => this._eyesAttack(p) })
      this.watchers.rest = 20
    }
    this._cap = new SkyeCaption({ scene: this })
    this._wetT = 0
    this._seaT = 8000 + Math.random() * 8000
    this._ferry = null
    const FE = this.esc.ferry, fp = FE && Q.get('ferry') !== '0' && h.props.find(o => o.id === 'ferry'), fw = fp && h.props.find(o => o.id === 'wraith')
    if (fp && fw) {
      const pts = FE.path, len = [0]
      for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
      const was = Escape._ferryT[this.getMapKey()] || { stage: 'wait', t: 0 }
      // come back after she came over and she is in her boat again, stood at the bow, as if nothing had happened
      this._ferry = { p: fp, w: fw, pts, len, t: was.t, stage: was.stage === 'wait' || was.stage === 'paddle' ? was.stage : 'stand', s: 0, grace: FE.grace, strokeT: 0 }
      if (this._ferry.stage === 'stand') { this._ferry.t = 1; this._fStage('stand') }
      this._ferryPose()
    }
    this._thornHarp = this.esc.harp ? new ThornHarp(this, this.esc.harp) : null      // the harp at the thorn's hill, and the thorn's answer
    this._slot = this.esc.slot ? new BalorSlot(this, this.esc.slot) : null                // Balor's gate: the banners' slot machine, and the nuts it eats
    this._well = this.esc.well ? new WellMirror(this, this.esc.well) : null           // the steps down into the well: your reflection, the depths, the salmon's nuts, Géaga
    this.cameras.main.fadeIn(700, 0, 0, 0)
    // (Géaga no longer wakes to you as you come: she speaks to you on the steps down into the well -- update)
  }

  _entryWasAWay() { return !!this.entryData?.from }

  // A light tilt-shift (effects/tiltShift.js), unlike the other hewn places: no blur toward the top of the screen (the
  // far walls and the gates stay sharp, the hall stays big) and no haze (it greys the dark); only the foreground, the cut
  // rock nearest the camera, a little soft, and a vignette. A conversation narrows it and dims the edges. ?ts=0: none
  getTiltShift() {
    if (Q.get('ts') === '0') return false
    return {
      focusY: 0.6, focusHeight: 0.34, follow: true, followMin: 0.4, followMax: 0.75,
      farBlur: 0, nearBlur: 2.2, nearHold: 0.35, hazeAmount: 0, vignette: 0.3, saturate: 1,
      dialogue: { focusHeight: 0.14, farBlur: 5, nearBlur: 5, farHold: 0.6, nearHold: 0.6, vignette: 0.42, dim: 0.22, saturate: 1.05, follow: true },
      combat: { focusHeight: 0.3, farBlur: 0, nearBlur: 2.5, farHold: 0.5, nearHold: 0.45, vignette: 0.32, dim: 0, saturate: 1, follow: true },
    }
  }

  // ── the ghost ───────────────────────────────────────────────────────────
  _ghost() {
    const p = this.player
    if (!p) return
    if (!p._ghosted) {
      p._ghosted = true
      const b = p.baseStats || p.stats
      p.baseStats = { ...b, health: Math.round((b.health || 5) * BOOST.health), attack: Math.round((b.attack || 5) * BOOST.attack), defense: Math.round((b.defense || 5) * BOOST.defense) }
    }
    // its own sword in its hand (whatever the living carry goes back in the pack); its picture once the sheet is ready
    const inv = p.inventory
    if (inv && inv.getEquippedItem?.('rightHand')?.id !== GHOST_BLADE_ID) {
      if (inv.getEquippedItem?.('rightHand')) { try { inv.unequipItem('rightHand') } catch (_) {} }
      if (!inv.slots.some(it => it?.id === GHOST_BLADE_ID)) inv.addItem?.(createItem(GHOST_BLADE_ID))
      const i = inv.slots.findIndex(it => it?.id === GHOST_BLADE_ID)
      if (i >= 0) { try { inv.equipItem(i, 'rightHand') } catch (e) { console.warn('[escape] sword:', e.message) } }
    }
    if (!prepareGhostBlade(this)) this.time.addEvent({ delay: 250, repeat: 20, callback: () => prepareGhostBlade(this) })
    p.updateStatsFromEquipment?.()
    p.currentHP = p.maxHP
    this.events.emit('playerHPChanged', p.currentHP, p.maxHP)
  }

  // every technique, in every bout here (a bout is made new for each fight): for these bouts only, not the save
  _fullPower(m) {
    if (!m || m._ghost) return
    m._ghost = true
    m.noCharge = false
    m.tech = { ...(m.tech || {}), parry: true, dash: true }
  }

  // the light off the ghost's blade, when it is out of the scabbard (PGR asks, after drawing the sword in your hand)
  onHeldSword(ctx, r, w, item, pose) {
    if (item?.id !== GHOST_BLADE_ID || !r) return
    if (pose == null || pose.sheath != null) return
    drawGhostBladeLight(ctx, r, w, performance.now() / 1000)
  }

  // see-through, whatever is in front of it
  _updatePlayerOcclusionFade() {
    const pgr = this.perspectiveGround
    if (pgr) { pgr._playerOcclusionAlpha = GHOST_ALPHA * (this.playerOcclusionCap?.() ?? 1); pgr._playerOcclusionCropPx = 0 }
  }

  // ── each frame ──────────────────────────────────────────────────────────
  update(time, delta) {
    this._fullPower(this._melee?.melee)
    if (this.hewn && !Q.has('torch')) {          // the light is the sword's: it grows when the blade is out
      const want = this._melee?.melee?.enGarde ? LIGHT_DRAWN : LIGHT
      this.hewn.torchR += (want - this.hewn.torchR) * Math.min(1, delta / 400)
    }
    this.figures?.update()
    super.update(time, delta)
    if (!this.hewn || !this.player) return
    this._arrived += delta
    this.watchers?.update(delta)
    if (this._reveal && ((this._reveal.t -= delta) <= 0)) {
      const b = this._reveal.bout; this._reveal = null
      if (this._melee === b) b.melee.engage()
    }
    for (const fl of this._melee?.flags || []) if (fl.fadeIn > 0) fl.fadeIn = Math.max(0, fl.fadeIn - delta)
    if (this._joins.length && this.fighting && !this._reveal) {
      const j = this._joins[0]
      if ((j.t -= delta) <= 0) { this._joins.shift(); this._ghoulJoins(j.at) }
    }
    const here = tileOf(this.player, this.tileSize)
    this._packCheck(here)
    this._wayCheck(here)
    this._ferryUpdate(delta, here)
    this._seaSounds(delta, here)
    this._notes(delta)
    this._thornHarp?.update(delta)
    this._well?.update(delta)
    // Géaga's eyes, seen in the water from the well's step (the pool draws them: hewn.inWater)
    { const st = Math.min(1, this._well?.settle || 0), gn = st > 0.01 ? (this._npcs || []).find(o => o.kind === 'geaga') : null, wk = gn ? gn.wake * st * st * (3 - 2 * st) : 0; this.hewn.inWater = gn && wk > 0.01 ? { x: gn.x, y: gn.y, wake: wk } : null }
    // at the well: the first time you come down onto the steps this visit, with her roots still across the stair, she wakes to you
    if (this._well?.arrived && this._gate && !this._encounterPanel?._isOpen) this.time.delayedCall(900, () => { if (this._well?.onStep) this._talk('geaga') })
    for (const n of this._npcs || []) {
      if (n.kind === 'geaga') {
        const talking = this._encounterPanel?._isOpen && this._encounterPanel?._card?.id?.includes('geaga')
        const want = GameState.hasNote('escape_geaga_blind_eye') && !talking ? 0 : talking ? 1 : this._well?._been ? 0.3 : 0
        n.wake += (want - n.wake) * (1 - Math.exp(-delta / 600))
      }
      if (n.state === 'leaving') n.t += delta / 1000
    }
    if (this.audio) {
      this.audio.update(delta)
      if ((this._wetT -= delta) <= 0) {
        this._wetT = 300
        let w = 0
        for (let y = here[1] - 4; y <= here[1] + 4; y++) for (let x = here[0] - 4; x <= here[0] + 4; x++) if (this.hewn.isWater(x, y)) w++
        this.audio.setWater(Math.min(1, w / 25))
      }
    }
  }

  // the harp's badge, when you stand by it, before anyone else's
  // (and the nuts on the well's step; and Géaga's only while you stand on the step)
  checkProximityInteractions() {
    if (this._thornHarp?.badge()) return
    if (this._slot?.badge()) return
    if (this._well?.badge()) return
    if (this._well && !this._well.onStep) {
      const all = this.interactables
      this.interactables = (all || []).filter(z => z.getData?.('id') !== 'geaga')
      if (this._encounterPanel?._card?.id?.includes?.('geaga') && !this._encounterPanel._isOpen) this._encounterPanel.clearNotify?.()
      try { super.checkProximityInteractions() } finally { this.interactables = all }
      return
    }
    super.checkProximityInteractions()
  }

  shutdown() { this._thornHarp?.close(); this._thornHarp = null; this._slot?.close(); this._slot = null; this._well?.destroy(); this._well = null; super.shutdown() }

  // what the words set: the roots part, a púca goes
  _notes() {
    if (this._gate && GameState.hasNote(this.esc.gate.note)) this._openGate()
    for (const n of this._npcs || []) {
      if (n.kind !== 'puca' || n.state === 'leaving') continue
      if (GameState.hasNote(`escape_${n.id}_free`) && !this._encounterPanel?._isOpen) {
        n.state = 'leaving'; n.t = 0
        this.interactables = (this.interactables || []).filter(z => z.getData('id') !== n.id)
        this._encounterPanel?.clearNotify?.()
        if (n.id === 'puca_ring') {          // the toadstool kicked out of the ring
          const ring = this.hewn.props.filter(p => p.type === 'mite' && p.h < 0.2 && Math.hypot(p.x - n.x, p.y - n.y) < 2.5)
          const one = ring.sort((a, b) => b.y - a.y)[0]
          if (one) this.hewn.props = this.hewn.props.filter(p => p !== one)
        }
      }
    }
    if (this.esc.end && GameState.hasNote('escape_done') && !this._finished && !this._encounterPanel?._isOpen) this._finish()
  }

  _openGate() {
    const tiles = [...this._gate].map(k => k.split(',').map(Number))
    this._gate = null
    for (const [x, y] of tiles) if (this.walkGrid?.[y]) this.walkGrid[y][x] = true
    this._dropGateProp(false)
  }

  // the roots draw back up into the dark
  _dropGateProp(now) {
    const id = this.esc.gate?.prop, h = this.hewn
    const p = h?.props.find(o => o.id === id)
    if (!p) return
    if (now) { h.props = h.props.filter(o => o !== p); return }
    const dz0 = p.dz
    this.tweens.addCounter({ from: 1, to: 0, duration: 1800, ease: 'Sine.easeIn', onUpdate: (t) => { p.dz = Math.max(0.05, dz0 * t.getValue()) }, onComplete: () => { h.props = h.props.filter(o => o !== p) } })
  }

  _drawNpcs(ctx, r) {
    for (const n of this._npcs || []) {
      if (Math.floor(n.y) !== r) continue
      // (Geaga is seen only in the water, as reflections: hewnExtras.js drawPool -- no eyes in the roots)
      if (n.kind === 'puca') drawPuca(this.hewn, ctx, n)
    }
  }

  // ── past the sea-door: the ferrywoman ───────────────────────────────────
  // She comes out of the fog while you are out on the landing (after a grace, and not while words are up), paddling with
  // her hands; a way out she stops, stands at the bow, and the boat drifts still. She stays like that. Speak to her and,
  // when the words are done, she steps over the side; a ring comes along under the water to the foot of the steps, she
  // comes up out of it, and crawls at you. If she reaches you, it is back to the start of the escape. Go back in and she
  // stops where she is (paddling) or is in her boat again (after).
  _fStage(name) {
    const F = this._ferry, E = this.esc.ferry
    F.stage = name; F.s = 0
    if (name === 'stand') {
      const [ex, ey] = F.pts[F.pts.length - 1], [px, py] = F.pts[F.pts.length - 2], a = Math.atan2(ey - py, ex - px)
      F.bx = ex + Math.cos(a) * E.drift; F.by = ey + Math.sin(a) * E.drift; F.ba = a
      F.spoke = false
      if (!F.zone) F.zone = this._zoneAt('ferrywoman', F.bx, F.by, 14)
    }
    if (name === 'fall') {
      if (F.zone) { this.interactables = (this.interactables || []).filter(z => z !== F.zone); F.zone.destroy?.(); F.zone = null; this._encounterPanel?.clearNotify?.() }
      this._fSound(1.0); this.time.delayedCall(260, () => this._fSound(0.8))
    }
    if (name === 'climb') this._fSound(0.6)
    if (name === 'crawl') { F.wx = E.foot[0]; F.wy = E.foot[1] + 0.4; F.ls = 0 }
  }

  _fSound(near) {
    if (!this.audio || !this._ferry) return
    const ts = this.tileSize, F = this._ferry, x = F.stage === 'crawl' ? F.wx : F.w.x
    this.audio.paddle(Math.max(-1, Math.min(1, (x - this.player.logicalX / ts) / 9)), near)
  }

  _ferryUpdate(delta, here) {
    const F = this._ferry
    if (!F || F.stage === 'caught') return
    const E = this.esc.ferry, dt = delta / 1000, panel = this._encounterPanel, talking = !!panel?._isOpen
    const out = inBox(here, E.zone) && !this._leaving
    F.s += dt
    switch (F.stage) {
      case 'wait': if (out && !talking && (F.grace -= dt) <= 0) this._fStage('paddle'); break
      case 'paddle':
        if (out && !talking) {
          F.t = Math.min(1, F.t + dt / E.secs)
          if ((F.strokeT -= delta) <= 0) {
            F.strokeT = 800
            const ts = this.tileSize, dx = F.p.x - this.player.logicalX / ts, dy = F.p.y - this.player.logicalY / ts
            this.audio?.paddle(Math.max(-1, Math.min(1, dx / 9)), Math.max(0.05, 1 - Math.hypot(dx, dy) / 30))
          }
        }
        if (F.t >= 1) this._fStage('drift')
        break
      case 'drift': if (F.s >= 4.5) this._fStage('stand'); break
      case 'stand':
        if (talking && /(^|:)ferrywoman$/.test(panel?._card?.id || '')) F.spoke = true      // (her badge's card is 'ferrywoman'; one the scene opens, 'fixed:ferrywoman')
        else if (F.spoke && !talking) this._fStage('fall')
        break
      case 'fall': if (F.s >= 1.6) this._fStage('under'); break
      case 'under': if (F.s >= 5.5) this._fStage('climb'); break
      case 'climb': if (F.s >= 2.4) this._fStage('crawl'); break
      case 'crawl': {
        const ts = this.tileSize, px = this.player.logicalX / ts, py = this.player.logicalY / ts
        const dx = px - F.wx, dy = py - F.wy, d = Math.hypot(dx, dy)
        if (d < 0.6 && !this._leaving) { this._caught(); return }
        const ph = F.s * 4.2, v = 1.75 * (0.3 + 1.3 * Math.max(0, Math.sin(ph))) * dt
        if (Math.sin(ph) > 0 && F.ls <= 0) this._fSound(Math.max(0.15, 0.7 - d / 20))      // a wet slap, each lunge
        F.ls = Math.sin(ph)
        const ok = (x, y) => this.walkZ(Math.floor(x), Math.floor(y)) != null || y < E.foot[1] + 0.5
        let nx = F.wx + dx / (d || 1) * v, ny = F.wy + dy / (d || 1) * v
        if (!ok(nx, ny)) { if (ok(nx, F.wy)) ny = F.wy; else if (ok(F.wx, ny)) nx = F.wx; else { nx = F.wx; ny = F.wy } }
        F.wx = nx; F.wy = ny; F.wa = Math.atan2(dy, dx)
        break
      }
    }
    Escape._ferryT[this.getMapKey()] = { stage: F.stage, t: F.t }
    this._ferryPose()
  }

  // where the boat and she are, and how, for this moment
  _ferryPose() {
    const F = this._ferry, E = this.esc.ferry, b = F.p, w = F.w
    b.z = E.z; w.wz = E.z
    if (F.stage === 'wait' || F.stage === 'paddle') {
      const total = F.len[F.len.length - 1], d = F.t * total
      let i = 1; while (i < F.len.length - 1 && F.len[i] < d) i++
      const [ax, ay] = F.pts[i - 1], [bx, by] = F.pts[i], u = Math.min(1, Math.max(0, (d - F.len[i - 1]) / ((F.len[i] - F.len[i - 1]) || 1)))
      b.x = ax + (bx - ax) * u; b.y = ay + (by - ay) * u; b.a = Math.atan2(by - ay, bx - ax)
      b.woman = 'paddle'; b.still = F.stage === 'wait' || !inBox(tileOf(this.player, this.tileSize), E.zone) || !!this._encounterPanel?._isOpen
      w.pose = 'none'
      return
    }
    if (F.stage === 'drift') {
      const [ex, ey] = F.pts[F.pts.length - 1], [px, py] = F.pts[F.pts.length - 2], a = Math.atan2(ey - py, ex - px), u = Math.min(1, F.s / 4.5), e = 1 - (1 - u) ** 2
      b.x = ex + Math.cos(a) * E.drift * e; b.y = ey + Math.sin(a) * E.drift * e; b.a = a
      b.woman = 'stand'; b.u = Math.min(1, Math.max(0, (F.s - 0.8) / 2.5)); b.still = true
      w.pose = 'none'
      return
    }
    b.x = F.bx; b.y = F.by; b.a = F.ba + Math.sin(this.hewn.t * 0.13) * 0.04
    const bow = [F.bx + Math.cos(F.ba) * 0.68, F.by + Math.sin(F.ba) * 0.68]
    if (F.stage === 'stand') { b.woman = 'stand'; b.u = 1; w.pose = 'none'; return }
    b.woman = 'none'
    if (F.stage === 'fall') { Object.assign(w, { x: bow[0], y: bow[1], z: E.z, a: F.ba, pose: 'fall', u: Math.min(1, F.s / 1.6) }); return }
    if (F.stage === 'under') {
      const u = Math.min(1, F.s / 5.5), e = u * u * (3 - 2 * u)
      Object.assign(w, { x: bow[0] + (E.foot[0] - bow[0]) * e, y: bow[1] + (E.foot[1] - bow[1]) * e, z: E.z, a: Math.PI / 2, pose: 'under', u })
      return
    }
    if (F.stage === 'climb') { const u = Math.min(1, F.s / 2.4); Object.assign(w, { x: E.foot[0], y: E.foot[1], z: E.z - 0.6 + u * 0.75, a: Math.PI / 2, pose: 'climb', u }); return }
    if (F.stage === 'crawl') {
      const z = this.walkZ(Math.floor(F.wx), Math.floor(F.wy)) ?? E.z
      w.z += (z - w.z) * 0.25
      Object.assign(w, { x: F.wx, y: F.wy, a: F.wa ?? Math.PI / 2, pose: 'crawl', ph: F.s * 4.2 })
    }
  }

  // a zone to speak to someone this scene puts somewhere itself (as createObjects makes them), x, y in tiles
  _zoneAt(id, x, y, radius) {
    const enc = this._content?.fixedEncounters.find(f => f.id === id)
    if (!enc) return null
    const ts = this.tileSize, px = x * ts, py = y * ts
    const zone = this.add.zone(px, py, ts, ts)
    zone.setData('id', id); zone.setData('type', 'fixed_encounter'); zone.setData('stateKey', 'escape.' + id)
    zone.setData('logicalX', px); zone.setData('logicalY', py)
    zone.setData('flagVisual', { glyph: figureGlyph('shade') }); zone.setData('visual', {})
    zone.setData('dialogues', enc.dialogues || []); zone.setData('actions', [])
    zone.setData('radius', radius * ts)
    ;(this.interactables || (this.interactables = [])).push(zone)
    return zone
  }

  // she has you: back to the start of the escape (at the well, Géaga waking; what the escape had set, forgotten)
  _caught() {
    const F = this._ferry
    F.stage = 'caught'; this._leaving = true
    this.player.pathQueue = []; this.player.setPath?.([])
    this.player.canMove = false
    this.cameras.main.fadeOut(1400, 0, 0, 0)
    this.time.delayedCall(1500, () => this._cap?.show('[Gaeilge le teacht]', '[PLACEHOLDER] Her hands are cold. She takes you down with her.'))
    this.time.delayedCall(6500, () => { Escape._ferryT = {}; this._forget(); this.scene.start('escape', { map: FIRST, champion: this.registry.get('selectedChampion') || window.selectedChampion }) })
  }

  // in the hall, near the sea-door: now and then, hands slapping water somewhere beyond it
  _seaSounds(delta, here) {
    const sea = this.esc.sea
    if (!sea || !this.audio || (this._seaT -= delta) > 0) return
    this._seaT = 18000 + Math.random() * 17000
    const d = Math.hypot(here[0] + 0.5 - sea.x, here[1] + 0.5 - sea.y)
    if (d > 15) return
    const near = 0.12 * (1 - d / 15) + 0.03, pan = Math.max(-1, Math.min(1, (sea.x - here[0]) / 8))
    const n = 3 + Math.floor(Math.random() * 3)
    for (let i = 0; i < n; i++) this.time.delayedCall(i * 800, () => this.audio?.paddle(pan, near))
  }

  // ── the ways on ─────────────────────────────────────────────────────────
  _wayCheck(here) {
    if (this._leaving || this.fighting || this._arrived < 900 || (this._entry && here[0] === this._entry[0] && here[1] === this._entry[1])) return
    if (this._entry && !this._movedOff) { this._movedOff = true }
    for (const w of this.esc.ways || []) {
      if (!inBox(here, w)) continue
      if (!w.to) { if (this.esc.end) this._out(); return }
      this._go(w.to, w.at)
      return
    }
  }

  _go(map, at) {
    if (this._leaving) return
    this._leaving = true
    this.player.pathQueue = []
    this.cameras.main.fadeOut(450, 0, 0, 0)
    this.time.delayedCall(480, () => this.scene.start('escape', { map, tile: at, from: this.getMapKey(), champion: this.registry.get('selectedChampion') || window.selectedChampion }))
  }

  // the top of the last stair: the night air
  _out() {
    if (this._outDone) return
    this._outDone = true
    this.player.pathQueue = []
    this._talk('end')
  }

  _finish() {
    this._finished = true
    this.cameras.main.fadeOut(2600, 0, 0, 0)
    this.time.delayedCall(2700, () => this._cap?.show('[Le leanúint]', '[To be continued]'))
  }

  // ── a conversation the scene opens itself (as tighConaill.js does) ──────
  _talk(id) {
    const panel = this._encounterPanel, enc = this._content?.fixedEncounters.find(e => e.id === id)
    if (!panel || !enc || panel._isOpen) return
    const n = (this.esc.npcs || []).find(o => o.id === id), ts = this.tileSize
    const d = { type: 'fixed_encounter', id, stateKey: 'escape.' + id, dialogues: enc.dialogues, portrait: null,
      logicalX: ((n?.x ?? this.player.logicalX / ts)) * ts, logicalY: ((n?.y ?? this.player.logicalY / ts)) * ts }
    const zone = { getData: k => d[k], setData() {} }
    GameState.setNPCProgress(d.stateKey, 0)
    panel._card = { id: 'fixed:' + id, visual: null }
    panel._active = zone
    delete panel._openPanel
    panel._openPanel()
  }

  // ── the fights ──────────────────────────────────────────────────────────
  _packKey(i) { return `escape_pack_${this.getMapKey()}_${i}` }

  _packCheck(here) {
    if (EXPLORE || Q.get('packs') === '0' || this.fighting || this._waking || this._leaving || this._encounterPanel?._isOpen) return
    const packs = this.esc.packs || []
    for (let i = 0; i < packs.length; i++) {
      if (GameState.hasNote(this._packKey(i)) || !inBox(here, packs[i])) continue
      this._startPack(i, packs[i])
      return
    }
  }

  _startPack(i, pk) {
    // the nearest of their places first, unless it is right on you
    const p = tileOf(this.player, this.tileSize)
    const spots = [...pk.spots].map(s => this._freeNear(s[0], s[1])).filter(Boolean)
      .sort((a, b) => Math.hypot(a[0] - p[0], a[1] - p[1]) - Math.hypot(b[0] - p[0], b[1] - p[1]))
    const first = spots.find(s => Math.max(Math.abs(s[0] - p[0]), Math.abs(s[1] - p[1])) >= 2) || spots[0]
    if (!first) return
    this._pack = i
    this._fight(pk.foe || 'deep', first, spots.filter(s => s !== first))
  }

  // eyes in the dark: the light reached them (or you saluted them); the nearest open pair is the first
  _eyesAttack(post) {
    const at = this._freeNear(post.x, post.y)
    if (!at || this.fighting) return
    const others = this.watchers ? this.watchers.recruit(this.esc.foe === 'shallow' ? 3 : 1).map(o => this._freeNear(o.x, o.y)).filter(Boolean) : []
    this._pack = null
    this._fight(this.esc.foe || 'deep', at, others)
  }

  _fight(kind, at, rest) {
    this.fighting = true
    if (this.watchers) this.watchers.busy = true
    const F = FOES[kind] || FOES.deep
    this._eyes = EYES[kind] || [120, 255, 140]
    const garde = !!this._melee?.melee?.enGarde
    this._melee?.destroy()
    const bout = this._melee = new MeleeBout(this, { F, home: at, gid: GHOUL_GID, lens: false })
    if (garde) bout.melee.setEnGarde(true)
    bout.melee.foe.c = at[0]; bout.melee.foe.r = at[1]
    bout.flag.fadeIn = REVEAL_MS
    this._dimFigure(bout, bout.flag)
    this._reveal = { t: REVEAL_MS, bout }
    this._joins = rest.map((s, k) => ({ t: k === 0 ? 600 : JOIN_MS, at: s }))
    this.audio?.ghoulHiss(Math.max(-1, Math.min(1, (at[0] - this.hewn.px) / 8)))
  }

  _ghoulJoins(at) {
    const bout = this._melee
    if (!bout || !this.fighting || bout.melee.bout.over || !bout.melee.fight) return
    if (this._nearPlayer(at, 2)) { const s = this._freeNear(at[0], at[1] - 2); if (s) at = s }
    const fl = bout.addFoe(at[0], at[1], REVEAL_MS)
    fl.fadeIn = REVEAL_MS
    this._dimFigure(bout, fl)
    this.audio?.ghoulHiss(Math.max(-1, Math.min(1, (at[0] - this.hewn.px) / 8)))
  }

  _freeNear(x, y) {
    const c = Math.floor(x), r = Math.floor(y), ts = this.tileSize
    for (const [dx, dy] of [[0, 0], [0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      if (!this.isColliding((c + dx + 0.5) * ts, (r + dy + 0.5) * ts) && !this.figureAt?.(c + dx, r + dy)) return [c + dx, r + dy]
    }
    return null
  }

  _nearPlayer([c, r], d) {
    const [pc, pr] = tileOf(this.player, this.tileSize)
    return Math.max(Math.abs(c - pc), Math.abs(r - pr)) < d
  }

  // seen as far as your light shows it; in the dark, only the eyes
  _dimFigure(bout, f) {
    const orig = f.draw, cave = this.cave, eyes = this._eyes
    f.draw = (ctx, x, y, w, pgr) => {
      const [fx, fy] = bout.melee.foeDrawPos(f.foe)
      const lit = cave.brightSmooth(fx + 0.5, fy + 0.5)
      let k = 0.1 + 0.9 * Math.max(0, Math.min(1, (lit - 0.02) / 0.36))
      if (f.fadeIn > 0) k = Math.max(k, Math.min(1, 1 - f.fadeIn / REVEAL_MS * 1.2 + 0.2))
      ctx.save(); ctx.globalAlpha *= k; orig(ctx, x, y, w, pgr); ctx.restore()
      if (f.foe.hp <= 0 || f.foe.state === 'beaten') return
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      const hy = y - w * 1.2 * 0.74, rad = w * 0.045
      for (const sx of [-0.09, 0.09]) {
        const gx = x + w * sx
        const gr = ctx.createRadialGradient(gx, hy, 0, gx, hy, rad * 2.6)
        gr.addColorStop(0, `rgba(${eyes},0.32)`); gr.addColorStop(1, `rgba(${eyes},0)`)
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gx, hy, rad * 2.6, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = `rgba(${eyes},0.95)`; ctx.beginPath(); ctx.arc(gx, hy, rad, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
    }
  }

  onMeleeEvent(name, d = {}) {
    if (name === 'salute' && d.by === 'player' && !this.fighting && !this._waking) { this.watchers?.challenge(); return }
    if (!this.fighting || name !== 'boutOver') return
    if (d.won || d.how === 'fled') {
      if (d.won && this._pack != null) GameState.addNote(this._packKey(this._pack))
      this.time.delayedCall(1500, () => this._fightOver())
    } else {
      // beaten: you wake where you came in (in Balor's hall, at the well)
      if (this._waking) return
      this._waking = true
      const wake = this.esc.wake
      this.time.delayedCall(900, () => this.cameras.main.fadeOut(800, 0, 0, 0))
      this.time.delayedCall(1900, () => this.scene.start('escape', wake ? { map: wake.map, tile: wake.at, from: 'wake' } : { map: this.getMapKey(), tile: this._entry, from: 'wake' }))
    }
  }

  _fightOver() {
    this._reveal = null; this._joins = []; this._pack = null
    const garde = !!this._melee?.melee?.enGarde
    this._melee?.destroy()
    this._melee = new MeleeBout(this)
    if (garde) this._melee.melee.setEnGarde(true)
    this.fighting = false
    if (this.watchers) { this.watchers.busy = false; this.watchers.rest = REST_AFTER }
  }

  _cleanup() {
    this.watchers?.destroy(); this.watchers = null
    this.figures?.destroy(); this.figures = null
    this.cave?.destroy?.(); this.cave = null
    this.audio?.destroy(); this.audio = null
    this._cap?.destroy?.(); this._cap = null
    super._cleanup()
  }
}

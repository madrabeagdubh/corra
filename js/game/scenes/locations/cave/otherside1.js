// otherside1.js
// Location: js/game/scenes/locations/cave/otherside1.js
//
// The other side, first layer: the web of passages from tools/map-editor/generators/otherside_gen.mjs, in the
// cave's own light and rock (CaveTest), with eyes in the dark (effects/watchers.js) and its own sounds
// (systems/underworldAudio.js). You wake in a drowned ring that is the cave's ring; the walls are not all wall.
//
//   ?scene=otherside1           same knobs as ?scene=caveTest (torch, knee, wallH ...)
//   &eyes=0                     no ghouls        &count=4   how many watchers at most
//   &sound=0                    no sound
//   &sword=1                    put the wooden sword in your pack (you'd have it from Skye)
//   &at=57,54                   start on this tile
//   &bronze=1                   have the bronze sword already (else it lies in the northern east crypt, tile 89,21)
//
// The ghouls: green eyes that open while you stand still (effects/watchers.js). Salute them (sword ready, swipe up again)
// and the nearest pair steps forward; or walk at one so that your light reaches it. Either way it shows itself: a moment (REVEAL_MS) of it standing in the light, hissing, and then it charges:
// a MeleeBout with GHOUL (combat/ghoul.js), a placeholder figure, seen only as far as your light shows it. The camera does not close in on it (lens: false). Beat it and it is gone; be beaten and you wake in the ring again.

import CaveTest from './caveTest.js'
import Watchers from '../../../effects/watchers.js'
import UnderworldAudio from '../../../systems/underworldAudio.js'
import MeleeBout, { prepareSword } from '../../../combat/meleeBout.js'
import { GHOUL, GHOUL_GID, registerGhoul } from '../../../combat/ghoul.js'
import { BRONZE_ID, BRONZE_GID, BRONZE_NOTE, prepareBronze } from '../../../combat/bronzeSword.js'
import { createItem } from '../../../ui/inventory/itemDefinitions.js'
import { GameState } from '../../../systems/gameState.js'
import SkyeCaption from '../skye/skyeCaption.js'

const Q = new URLSearchParams(window.location.search)
const REVEAL_MS = 1000      // a ghoul stands seen this long before it charges
const RELIC_AT = [89, 21.5] // the bronze sword lies in the northern east crypt, north of the passage that leads in (the chamber round [88, 22])

export default class Otherside1 extends CaveTest {
  constructor() { super('otherside1') }

  getMapKey() { return 'otherside1' }

  onEnter() {
    super.onEnter()
    this.fighting = false; this._waking = false; this._reveal = null     // the scene object is reused when you wake in the ring again
    const md = this.mapData
    if (Q.get('sound') !== '0') {
      this.audio = new UnderworldAudio(this)
      // a drop that falls near you is heard whether you see it or not
      this.cave.onDrip = (x, y, wet) => {
        const dx = x - this.cave.px, dy = y - this.cave.py
        const d = Math.hypot(dx, dy)
        this.audio?.drip(Math.max(-1, Math.min(1, dx / 6)), Math.max(0, 1 - d / 12), wet)
      }
    }
    if (Q.get('sword') === '1') prepareSword(this, true)
    registerGhoul(this.perspectiveGround)
    this._placeRelic()
    if (Q.get('eyes') !== '0') {
      this.watchers = new Watchers(this, this.cave, { count: Number(Q.get('count') || 4), audio: this.audio, onAttack: (w, p) => this._ghoulAttack(p) })
    }
    this._wetT = 0
  }

  update(time, delta) {
    super.update(time, delta)
    this.watchers?.update(delta)
    this._takeRelic(delta)
    if (this._reveal && ((this._reveal.t -= delta) <= 0)) {          // seen long enough: it charges
      const b = this._reveal.bout; this._reveal = null
      if (this._melee === b) b.melee.engage()
    }
    if (this.audio) {
      this.audio.update(delta)
      // the trickle comes up as the wet gets near
      if ((this._wetT -= delta) <= 0) {
        this._wetT = 250
        const wm = this.mapData.waterMask, p = this.player
        if (wm && p) {
          const tx = Math.floor(p.logicalX / this.tileSize), ty = Math.floor(p.logicalY / this.tileSize)
          let n = 0
          for (let y = ty - 4; y <= ty + 4; y++) for (let x = tx - 4; x <= tx + 4; x++) if (wm[y]?.[x]) n++
          this.audio.setWater(Math.min(1, n / 30))
        }
      }
    }
  }

  // ── the bronze sword ────────────────────────────────────────────────────
  // It lies in the dust of a crypt, gleaming a little, and is yours when you walk to it. Taken once (a GameState note).
  _placeRelic() {
    this._relic = null
    prepareBronze(this)
    if (Q.get('bronze') === '1') { GameState.addNote(BRONZE_NOTE); if (!this.player?.inventory?.slots.some(it => it?.id === BRONZE_ID)) this.player?.inventory?.addItem?.(createItem(BRONZE_ID)) }
    if (GameState.hasNote(BRONZE_NOTE)) return
    const at = this._freeNear(RELIC_AT[0], RELIC_AT[1])
    if (!at) return
    this._relic = { x: at[0] + 0.5, y: at[1] + 0.5, wait: 0 }
    this.cave.rows[at[1]].push({ draw: (ctx, pgr) => this._drawRelic(ctx, pgr) })
    this._relicCap = this._relicCap || new SkyeCaption({ scene: this })
  }

  _drawRelic(ctx, pgr) {
    const r = this._relic, c = this.cave, img = this.itemSheet?.getCanvas?.(BRONZE_GID)
    if (!r || !img) return
    const pt = c._G(pgr, r.x, r.y, 0.03)
    if (!pt) return
    const lit = c.brightSmooth(r.x, r.y), k = 0.35 + 0.65 * Math.max(0, Math.min(1, (lit - 0.02) / 0.38))
    const w = pgr._scaleAtRow(r.y) * 0.75
    ctx.save()
    ctx.globalAlpha *= k; ctx.imageSmoothingEnabled = false
    ctx.translate(pt.x, pt.y - w * 0.12); ctx.rotate(-0.55)
    ctx.drawImage(img, -w / 2, -w / 2, w, w)
    ctx.restore()
    // a glint that comes and goes, so it is seen from a way off
    const g = 0.55 + 0.45 * Math.sin(performance.now() / 650), gx = pt.x + w * 0.12, gy = pt.y - w * 0.3, rad = w * 0.8
    const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, rad)
    gr.addColorStop(0, `rgba(255,200,110,${(0.6 * g * (0.7 + 0.3 * k)).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,200,110,0)')
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr
    ctx.beginPath(); ctx.arc(gx, gy, rad, 0, Math.PI * 2); ctx.fill(); ctx.restore()
  }

  _takeRelic(dt) {
    const r = this._relic
    if (!r || this.fighting || this._waking || !this.cave || this.cave.px === undefined) return
    if ((r.wait -= dt) > 0 || Math.hypot(r.x - this.cave.px, r.y - this.cave.py) > 1.1) return
    const inv = this.player?.inventory
    if (inv?.addItem?.(createItem(BRONZE_ID)) === false) { r.wait = 3000; return }       // a full pack: it waits
    GameState.addNote(BRONZE_NOTE)
    this._relic = null
    this._relicCap?.show('Claíomh cré-umha', 'A bronze sword. It will cut.', 3200)
  }

  // ── the ghoul's fight ───────────────────────────────────────────────────
  _freeNear(x, y) {
    const c = Math.floor(x), r = Math.floor(y), ts = this.tileSize
    for (const [dx, dy] of [[0, 0], [0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1]]) {
      if (!this.isColliding((c + dx + 0.5) * ts, (r + dy + 0.5) * ts)) return [c + dx, r + dy]
    }
    return null
  }

  _ghoulAttack(p) {
    const at = this._freeNear(p.x, p.y)
    if (!at || this.fighting) { return }
    this.fighting = true
    if (this.watchers) this.watchers.busy = true
    const garde = !!this._melee?.melee?.enGarde                // the sword you have ready stays ready (the new bout starts at ease)
    this._melee?.destroy()
    const bout = this._melee = new MeleeBout(this, { F: GHOUL, home: at, gid: GHOUL_GID, lens: false })
    if (garde) bout.melee.setEnGarde(true)
    bout.melee.foe.c = at[0]; bout.melee.foe.r = at[1]
    this._dimFigure(bout)
    this._reveal = { t: REVEAL_MS, bout }                  // it shows itself first; update() sends it
    this.audio?.ghoulHiss(Math.max(-1, Math.min(1, (at[0] - this.cave.px) / 8)))
  }

  // the figure is seen as far as your light shows it: in the dark it is only two green points
  _dimFigure(bout) {
    const f = bout.flag, orig = f.draw, cave = this.cave
    f.draw = (ctx, x, y, w, pgr) => {
      const [fx, fy] = bout.melee.foeDrawPos()
      const lit = cave.brightSmooth(fx + 0.5, fy + 0.5)
      let k = 0.08 + 0.92 * Math.max(0, Math.min(1, (lit - 0.02) / 0.38))
      const rv = this._reveal
      if (rv && rv.bout === bout) k = Math.max(k, Math.min(1, 1 - rv.t / REVEAL_MS * 1.2 + 0.2))        // it steps into view
      ctx.save(); ctx.globalAlpha *= k; orig(ctx, x, y, w, pgr); ctx.restore()
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      const hy = y - w * 1.2 * 0.74, rad = w * 0.045
      for (const sx of [-0.09, 0.09]) {
        const gx = x + w * sx
        const gr = ctx.createRadialGradient(gx, hy, 0, gx, hy, rad * 2.6)
        gr.addColorStop(0, 'rgba(120,255,140,0.32)'); gr.addColorStop(1, 'rgba(120,255,140,0)')
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gx, hy, rad * 2.6, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = 'rgba(150,255,160,0.95)'; ctx.beginPath(); ctx.arc(gx, hy, rad, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
    }
  }

  onMeleeEvent(name, d = {}) {
    if (name === 'salute' && d.by === 'player' && !this.fighting && !this._waking) { this.watchers?.challenge(); return }     // salute the eyes: it steps forward
    if (!this.fighting || name !== 'boutOver') return
    if (d.won || d.how === 'fled') {
      this.time.delayedCall(1800, () => this._ghoulGone())
    } else {                                                // beaten: you wake in the ring again
      if (this._waking) return
      this._waking = true
      this.time.delayedCall(900, () => this.cameras.main.fadeOut(800, 0, 0, 0))
      this.time.delayedCall(1900, () => this.scene.start('otherside1', { champion: this.registry.get('selectedChampion') || window.selectedChampion }))
    }
  }

  _ghoulGone() {
    this._reveal = null
    const garde = !!this._melee?.melee?.enGarde
    this._melee?.destroy()
    this._melee = new MeleeBout(this)
    if (garde) this._melee.melee.setEnGarde(true)
    this.fighting = false
    if (this.watchers) this.watchers.busy = false
  }

  _cleanup() {
    this.watchers?.destroy(); this.watchers = null
    this._relicCap?.destroy(); this._relicCap = null; this._relic = null
    this.audio?.destroy(); this.audio = null
    super._cleanup()
  }
}

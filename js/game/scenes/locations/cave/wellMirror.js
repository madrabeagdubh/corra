// wellMirror.js
// Location: js/game/scenes/locations/cave/wellMirror.js
//
// The steps down into the well, from the dais under the great arch (escape_gen.mjs: esc.well; the pool's `dais`, `steps`).
// Stand on the last dry step:
//   - your reflection is there in the water at its foot, looking up at you, never still (hewnExtras.js drawMirror)
//   - at its middle the view tips down into the well (the map's zone there: hewnTest.js, zone.square), and the well goes
//     down further than any well can, swaying, turning, light going down it (hewnExtras.js paintDeep, from h.deep); your
//     reflection grows over all of it, a great faint face you see the well through
//   - stand there quietly a while, and the salmon come out of the arch in the deep together, each to a nut afloat on the
//     water, and nose them across to the foot of the step; up out of the water they come, onto the step, and lie there
//     (the pool's `lying`) for you to take (the badge on the moon). You hold no more than three; eat one, and they'll
//     bring you another
//   - Géaga speaks to you here, and only here: the first time you come to the step (escape.js), and after, from her
//     badge on the moon while you stand on it.

import { startPoolGifts } from '../../../effects/hewnExtras.js'
import { createItem } from '../../../ui/inventory/itemDefinitions.js'
import { saveInventory } from '../../../ui/inventory/inventoryStore.js'
import { SoundBoard } from '../../../systems/soundBoard.js'

const QUIET = 6            // s standing still on the step before the salmon come
const MAX_NUTS = 3
const NUT = 'hazelnut'

export default class WellMirror {
  constructor(scene, cfg) {
    this.scene = scene
    this.cfg = cfg
    this.h = scene.hewn
    this.pool = this.h?.props.find(p => p.type === 'pool' && p.steps) || null
    if (this.pool) this.pool.lying = []
    this.alpha = 0
    this.deep = 0
    this.still = 0
    this.settle = 0                  // 0..1: how settled you are on the step (Geaga's eyes, as reflections, wait for it)
    this.gifts = null
    this.lifting = 0
    this.onStep = false
    this.arrived = false          // (true for the one frame you first set foot on the step, this visit)
    this._been = false
    this._glyph = nutGlyph()
  }

  _in(P, R) {
    if (!R) return false
    const ts = this.scene.tileSize, tx = Math.floor(P.logicalX / ts), ty = Math.floor(P.logicalY / ts)
    return tx >= R.x0 && tx <= R.x1 && ty >= R.y0 && ty <= R.y1
  }

  _nuts() {
    const inv = this.scene.player?.inventory
    if (!inv) return MAX_NUTS
    let n = 0
    for (const s of inv.slots) if (s?.id === NUT) n += s.quantity || 1
    return n
  }

  update(delta) {
    const sc = this.scene, h = this.h, P = sc.player, g = sc.perspectiveGround
    if (!h || !this.pool || !P || !g) return
    const on = this._in(P, this.cfg.step), deep = this._in(P, this.cfg.deep), dt = delta / 1000
    this.arrived = on && !this._been
    if (on) this._been = true
    this.onStep = on
    this.settle = !on ? Math.max(0, (this.settle || 0) - delta / 400) : (!P.isMoving ? Math.min(1, (this.settle || 0) + delta / 900) : (this.settle || 0))

    // the well, going down, as the view tips down into it (the same pace as the camera's: hewnTest.js)
    this.deep += ((deep ? 1 : 0) - this.deep) * (1 - Math.exp(-delta / 900))
    h.deep = this.deep > 0.01 ? this.deep : 0
    // your reflection, at the foot of the step, under you
    this.alpha += ((on ? 1 : 0) - this.alpha) * (1 - Math.exp(-delta / (on ? 500 : 300)))
    const steps = this.pool.steps.filter(S => S.z > (this.pool.z ?? 0.75) - 0.22), S = steps[steps.length - 1], ts = sc.tileSize
    h.mirror = this.alpha > 0.01 && S ? {
      img: g._playerCanvas, left: !!g._facingLeft, alpha: this.alpha, deep: h.deep,
      x: Math.max(S.x0 + 0.3, Math.min(S.x1 - 0.3, P.logicalX / ts)), y: S.y1 + 0.04,
      ps: g.constructor.PLAYER_SCALE ?? 1, hm: (g._playerHeightMult ?? 1.8) * (g.constructor.PLAYER_SCALE ?? 1),
    } : null

    // the salmon, when you've stood still a while, and there's room for what they bring (in your keeping, or on the step)
    this.still = on && !P.isMoving ? this.still + dt : 0
    if (!this.gifts && this.still > QUIET) {
      const want = MAX_NUTS - this._nuts() - this.pool.lying.length
      if (want > 0) {
        const T = this.cfg.tips                                              // (one to the middle, two either side, three along)
        this.gifts = startPoolGifts(h, this.pool, want >= 3 ? T : want === 2 ? [T[0], T[2]] : [T[1]])
        this.lifting = 0
      }
    }
    // there at the step: up out of the water onto it, one by one (if you've gone, they wait in the water for you)
    for (const g2 of this.gifts || []) if (g2.lift != null && !g2.landed && h.t - g2.lift > 0.7) { g2.taken = g2.landed = true; this.pool.lying.push({ x: g2.rest[0], y: g2.rest[1] }); this._drop(this.pool.lying.length) }
    if (this.gifts && on && h.t >= this.gifts[0].ready) {
      this.lifting -= dt
      if (this.lifting <= 0) {
        const g2 = this.gifts.find(x => x.lift == null)
        if (g2) {
          const free = this.cfg.rest.filter(r => !this.pool.lying.some(n => Math.abs(n.x - r[0]) < 0.1) && !this.gifts.some(o => o.rest && Math.abs(o.rest[0] - r[0]) < 0.1))
          const r = free.sort((a, b) => Math.abs(a[0] - g2.T[0]) - Math.abs(b[0] - g2.T[0]))[0] || this.cfg.rest[1]
          g2.rest = [r[0], r[1], S.z]; g2.lift = h.t; this.lifting = 0.5
        } else if (this.gifts.every(x => x.landed)) { this.gifts = null; this.still = 0 }
      }
    }
  }

  // the nuts on the step: the badge on the moon, while you stand there (escape.js checkProximityInteractions)
  badge() {
    const sc = this.scene, panel = sc._encounterPanel
    if (!panel || !this.pool) return false
    const any = this.onStep && this.pool.lying.length > 0
    if (!any) { if (panel._card?.id === 'well_nuts') panel.clearNotify(); return false }
    panel.notify({ id: 'well_nuts', visual: { glyph: this._glyph }, ga: '', en: '', onActivate: () => this._take() }, null)
    return true
  }

  _take() {
    const sc = this.scene, inv = sc.player?.inventory, lying = this.pool?.lying || []
    if (!inv || !lying.length) return
    let n = 0
    while (lying.length && this._nuts() < MAX_NUTS) {
      const it = createItem(NUT)
      if (!it || inv.addItem(it) === false) break
      lying.pop(); n++
    }
    sc._encounterPanel?.clearNotify?.()
    if (!n) { sc._cap?.show?.('Níl slí agam do thuilleadh.', 'I have no room for more.', 3000); return }
    try { saveInventory(inv) } catch (_) {}
    const ga = n === 1 ? 'Thóg mé an cnó coill a d’fhág na bradáin dom.' : `Thóg mé na cnónna coill a d’fhág na bradáin dom.`
    const en = n === 1 ? 'I took the hazelnut the salmon left for me.' : 'I took the hazelnuts the salmon left for me.'
    sc._cap?.show?.(ga, en, 3600)
  }

  // a small water-drop of a note as each comes up onto the step, a little higher each time
  _drop(i) {
    const ctx = SoundBoard.ctx?.(this.scene)
    if (!ctx) return
    try {
      const now = ctx.currentTime + 0.01, f = 880 * Math.pow(2, (i - 1) * 4 / 12)
      const o = ctx.createOscillator(), gn = ctx.createGain()
      o.type = 'sine'; o.frequency.setValueAtTime(f, now); o.frequency.exponentialRampToValueAtTime(f * 1.5, now + 0.08)
      gn.gain.setValueAtTime(0, now); gn.gain.linearRampToValueAtTime(0.05, now + 0.01); gn.gain.exponentialRampToValueAtTime(0.0006, now + 0.6)
      o.connect(gn); gn.connect(ctx.destination); o.start(now); o.stop(now + 0.65)
    } catch (_) {}
  }

  destroy() {
    if (this.h) { this.h.mirror = null; this.h.deep = 0 }
    for (const g of this.gifts || []) g.taken = true
    this.gifts = null
  }
}

// the badge's icon: three hazelnuts in gold lines, as the harp's is drawn
function nutGlyph() {
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d'); g.strokeStyle = 'rgb(224,190,120)'; g.lineCap = 'round'; g.lineJoin = 'round'
  const nut = (x, y, r, a) => {
    g.save(); g.translate(x, y); g.rotate(a)
    g.lineWidth = 3.2; g.beginPath(); g.moveTo(0, -r * 1.25); g.bezierCurveTo(r * 1.05, -r * 0.9, r * 1.1, r * 0.75, 0, r); g.bezierCurveTo(-r * 1.1, r * 0.75, -r * 1.05, -r * 0.9, 0, -r * 1.25); g.stroke()
    g.lineWidth = 2; g.beginPath(); g.moveTo(-r * 0.62, -r * 0.55); g.quadraticCurveTo(0, -r * 0.25, r * 0.62, -r * 0.55); g.stroke()       // the scar where it sat in its husk
    g.restore()
  }
  nut(22, 38, 8, -0.35); nut(42, 38, 8, 0.35); nut(32, 24, 8, 0)
  return c
}

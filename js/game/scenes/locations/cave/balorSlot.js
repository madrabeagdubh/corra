// balorSlot.js
// Location: js/game/scenes/locations/cave/balorSlot.js
//
// Balor's gate (escape_tobar, north-west): a Fomorian machine that wants to be fed, and does not want anything for it. It
// has never been seen by anyone who knew what a machine was, so it is built like a mouth: lips of black iron, grinding
// wheels where the teeth should be, a belt for a tongue. Armoured, as little of it exposed as can be. Above, a panel
// window with a face in it, and pipes and whistles to say what the face means.
//
// Stand at the foot of the door and its badge comes up on the moon; press it and the machine is over the top two-thirds of
// the screen (the strip above and the third below are free: click off the machine to leave).
//
//   1. An eyelid of iron is down over the reels. On the moon: the next thing in your keeping it can have -- hazelnuts first,
//      then whatever else is in your pack, in the order it lies there. Press, and it is put in the mouth. Press again,
//      and the next. (Nothing you wear is taken, nor the currach, nor anything marked quest or keep. The rest goes, one at
//      a time, for good, and the machine gives nothing for it: that is the joke, and the player is the one who does it.)
//   2. The belt takes it to the wheels, which grind it (three times), the eyelid lifts, and the reels are let go.
//   3. The reels turn downward on fixed strips of the 64 banners, running for SPRING seconds, the same however much it was
//      fed. The moon now holds a pawl: each press drops it on the next reel, left to right. It does not bite at once: the
//      reel carries on a little before the ratchet takes it, so aim early. A reel not stopped in time stops itself.
//   4. A pull wins only if all three banners that come to rest are ones you hold (those show in colour, the rest dark).
//      A win sets the note and it is done. A loss: the lid comes down, the face sneers, the pipes jeer.
//
//   held banners: GameState's list if there is one (none yet: nothing earns a banner), else the test param
//     ?banners=N        the first N banners
//     ?banners=3,7,12   exactly those
//   (what opens beyond the gate is for later: for now the note is all it sets)

import { GameState } from '../../../systems/gameState.js'
import { saveInventory } from '../../../ui/inventory/inventoryStore.js'
import { SoundBoard } from '../../../systems/soundBoard.js'
import { itemArt } from '../../../ui/inventory/itemArt.js'
import { PACK_START, PACK_END } from '../../../ui/inventory/inventory.js'

export const BALOR_NOTE = 'escape_balor_open'
const NUT = 'hazelnut'
const COUNT = 64
const REELS = 3
const ASPECT = 256 / 416                                  // (the banners)

// the feel of it (cells are banners; a reel shows about one and a half)
const VMAX = 7                                            // cells a second
const SPIN = 15                                           // seconds the reels run, whatever was fed
const WIND_DOWN = 1.5                                     // s of slowing at the very end
const HURRY = 3                                           // s left when it starts to hurry you
const RAMP = 0.45                                         // s to get the reels up to speed (and no stopping before)
const MULT = [1, 1.13, 0.9]                               // the reels do not turn alike
const BITE = 0.09                                         // s of carry before the pawl takes a reel

const bannerUrl = (n) => `${import.meta.env?.BASE_URL ?? './'}assets/banners/${String(n).padStart(2, '0')}.png`
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const mod = (n, m) => ((n % m) + m) % m
const R = (a, b) => a + Math.random() * (b - a)
const seeded = (s) => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
const shuffled = (seed) => { const r = seeded(seed), a = Array.from({ length: COUNT }, (_, i) => i); for (let i = COUNT - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
const STRIPS = [shuffled(11), shuffled(23), shuffled(37)]  // (fixed for good: learn them, if you can bear to)

// iron and bronze
const C = {
  ironL: '#4a4753', ironM: '#2a2830', ironD: '#141318', ironK: '#0b0a0d',
  bronL: '#e3b768', bronM: '#a8702a', bronD: '#4a2c0d', verd: '#2f7d6c',
  steel: '#9c98a4', flesh: '#8f4350', fleshD: '#4a1a24', line: '#c89a4e', hi: '#ecc878',
}
// what the window shows: a pinwheel of signs behind the glass, in a fixed ring, so every change is a turn of the wheel and
// the signs just happen to be in the right order. No words: a sign is a picture. These are placeholders, drawn here (an eye,
// then a face each); to put your own art on one, put its image url against its name in CARD_SRC.
const CARDS = ['closed', 'peek', 'left', 'right', 'closed', 'sneer', 'leer', 'glee', 'scorn', 'fury', 'pain']   // (the first five are the eye's own run: it can look about and shut again)
const CARD_SRC = {}                                       // name -> image url (optional)
const MOOD = { idle: 'taunt', nut: 'glee', item: 'taunt', gear: 'glee', spin: 'sneer', lose: 'laugh', win: 'rage', empty: 'sigh', hurry: 'hurry' }
const FACE = { idle: ['leer', 'sneer'], nut: ['glee'], item: ['scorn'], gear: ['glee'], spin: ['leer'], lose: ['sneer', 'leer'], win: ['pain'], empty: ['scorn'], hurry: ['fury'] }
const pick = (a) => a[Math.floor(Math.random() * a.length)]
const BELT = 110                                          // px a second, the pink belt (rightward only)

// the banners the player holds, as a Set of 0..63
export function heldBanners() {
  const own = GameState._state?.banners
  if (Array.isArray(own)) return new Set(own)
  const q = new URLSearchParams(location.search).get('banners')
  if (!q) return new Set()
  if (q.includes(',')) return new Set(q.split(',').map(Number).filter(n => n >= 0 && n < COUNT))
  const n = clamp(parseInt(q, 10) || 0, 0, COUNT)
  return new Set(Array.from({ length: n }, (_, i) => i))
}

// what it will not take: the boat, and anything the game marks quest or keep (nothing you wear is in the pack to take)
const spare = (it) => it && it.type !== 'boat' && !it.quest && !it.keep

export default class BalorSlot {
  constructor(scene, spot) {
    this.scene = scene
    this.spot = spot                                      // { x, y, radius } in tiles
    this.done = GameState.hasNote(BALOR_NOTE)
    this.el = null
    this.phase = 'idle'                                   // idle | feeding | chewing | spinning | settling | win
    this._glyphs = new Map()
    this._stopGlyph = pawlGlyph()
    this._glyph = slotGlyph()
  }

  get busy() { return this.phase !== 'idle' }

  // ── what is in the player's keeping that it can have: nuts first, then the rest as they lie ────────────────────
  _queue() {
    const inv = this.scene.player?.inventory
    if (!inv) return []
    const out = []
    for (let i = PACK_START; i < PACK_END; i++) { const it = inv.slots[i]; if (it && spare(it)) out.push({ i, it }) }
    return out.sort((a, b) => (b.it.id === NUT) - (a.it.id === NUT))
  }

  // ── a picture of an item: its own art, its tile, or a lump of its colour ───────────────────────────────────────
  _pic(it) {
    const art = itemArt(it.art || it.id)
    if (art) return art
    try { const t = it.itemGid && this.scene.perspectiveGround?._getTileCanvas?.(it.itemGid); if (t) return t } catch (_) {}
    const c = document.createElement('canvas'); c.width = c.height = 16
    const g = c.getContext('2d'), col = '#' + ((it.color ?? 0xb0903a) & 0xffffff).toString(16).padStart(6, '0')
    g.fillStyle = col; g.beginPath(); g.arc(8, 8, 6, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(6, 6, 2, 0, 7); g.fill()
    return c
  }

  _feedGlyph(it) {
    let c = this._glyphs.get(it.id)
    if (c) return c
    if (it.id === NUT) c = nutGlyph()
    else {
      c = document.createElement('canvas'); c.width = c.height = 64
      const g = c.getContext('2d'), p = this._pic(it), k = Math.min(46 / p.width, 46 / p.height)
      g.imageSmoothingEnabled = false
      g.drawImage(p, (64 - p.width * k) / 2, (64 - p.height * k) / 2, p.width * k, p.height * k)
    }
    this._glyphs.set(it.id, c)
    return c
  }

  // ── the moon's badge (true: it has the moon, nothing else is offered) ───────
  // at the door: the machine's. With the machine up: the next thing it can eat, then the pawl for the reels.
  // (the cards are `repeat`: a press does not disarm them, so the next press is as good as the first; and `quiet`)
  badge() {
    const s = this.scene, panel = s._encounterPanel, p = s.player
    if (this.done || !panel || !p || !this.spot) return false
    if (this.el) {
      const q = this.phase === 'idle' ? this._queue() : null
      if (q && q.length) panel.notify({ id: 'balor_feed_' + q[0].it.id, visual: { glyph: this._feedGlyph(q[0].it) }, ga: '', en: '', repeat: true, quiet: true, onActivate: () => this._feed() }, null)
      else if (this.phase === 'spinning' && this._canStop()) panel.notify({ id: 'balor_stop', visual: { glyph: this._stopGlyph }, ga: '', en: '', repeat: true, quiet: true, onActivate: () => this._stop() }, null)
      else if (/^balor_(feed|stop)/.test(panel._card?.id || '')) panel.clearNotify()
      return true
    }
    const ts = s.tileSize, d = Math.hypot(p.logicalX / ts - this.spot.x, p.logicalY / ts - this.spot.y)
    if (d > (this.spot.radius ?? 1.1)) { if (panel._card?.id === 'balor_slot') panel.clearNotify(); return false }
    panel.notify({ id: 'balor_slot', visual: { glyph: this._glyph }, ga: '', en: '', onActivate: () => this.open() }, null)
    return true
  }

  // ── the machine ────────────────────────────────────────────────────────────
  open() {
    if (this.el || this.done) return
    this.held = heldBanners()
    const vw = window.innerWidth, vh = window.innerHeight
    const W = this.W = vw, H = this.H = Math.round(vh * 0.66), top = Math.round(vh * 0.03)
    const dpr = this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    const el = this.el = document.createElement('div')
    el.style.cssText = 'position:fixed;inset:0;z-index:1000001;background:rgba(3,1,1,0.62);touch-action:none;user-select:none;-webkit-user-select:none'
    const cv = this.cv = document.createElement('canvas')
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
    cv.style.cssText = `position:absolute;left:0;top:${top}px;width:${W}px;height:${H}px`
    el.appendChild(cv)
    this.ctx = cv.getContext('2d')
    el.addEventListener('pointerdown', (e) => { if (e.target === el) this.close() })
    document.body.appendChild(el)

    // the banners, once each, at the size a reel shows them (dark if not held)
    this.imgs = Array.from({ length: COUNT }, (_, n) => { const im = new Image(); im.src = bannerUrl(n); return im })
    this.cells = new Map()
    this._layout()
    this._bake()
    this.reels = Array.from({ length: REELS }, () => ({ pos: Math.floor(Math.random() * COUNT), v: 0, mode: 'still', brake: null, last: 0 }))
    for (const r of this.reels) r.last = Math.floor(r.pos)

    this.phase = 'idle'
    this.t = 0; this.last = performance.now()
    this.lid = 1; this.lidT = 1; this.lidV = 0                       // the eyelid: 1 is down over the reels
    this.grind = 0; this.wheelA = 0; this.beltT = 0; this.beltPh = 0
    this.nut = null; this.puffs = []; this.chips = []; this.glow = [0, 0, 0, 0, 0, 0]
    this.shake = 0
    this.wa = 0; this.wt = 0; this.waLast = 0; this.restT = 0; this.eyeQ = []; this.say = null     // the pinwheel: where it is, where it is going
    this.idleT = -1.5
    this._timers = []
    this._raf = requestAnimationFrame((n) => this._frame(n))
  }

  close() {
    if (this.busy && this.phase !== 'win') return              // (a pull is not walked away from: the nut is eaten)
    cancelAnimationFrame(this._raf)
    this._timers?.forEach(clearTimeout)
    this._timers = []
    this.el?.remove()
    this.el = null
    this.phase = 'idle'
    this.scene._encounterPanel?.clearNotify?.()
  }

  _later(fn, ms) { this._timers.push(setTimeout(fn, ms)) }

  // ── the geometry, once ──────────────────────────────────────────────────────
  _layout() {
    const { W, H } = this
    const L = this.L = {}
    L.crest = Math.round(H * 0.27)
    const gap = Math.round(W * 0.025), pad = Math.round(W * 0.055)
    const rw = Math.floor((W - 2 * pad - 2 * gap) / 3), cellH = Math.min(Math.round(rw / ASPECT * 0.92), Math.round(H * 0.26))
    L.rw = rw; L.cellH = cellH; L.winH = Math.round(cellH * 1.4); L.gap = gap; L.pad = pad
    L.wy = L.crest + 6
    L.my = L.wy + L.winH + Math.round(H * 0.04)            // the mouth's top
    L.mh = H - L.my - Math.round(H * 0.05)
    L.mw = Math.round(W * 0.8)
    L.Rw = L.mh * 0.15
    L.cx = W / 2
    // the round window, up top, and the wheel of signs behind it
    const ry = Math.round((L.crest - 40) / 2), rx = Math.round(ry * 1.8)
    L.oval = { cx: W / 2, cy: 28 + ry, rx, ry }
    L.cw = 2 * rx + 10; L.ch = 2 * ry + 10
    L.wheelR = L.cw * 1.9; L.wheelStep = L.cw * 1.1 / L.wheelR
    // the pipes, three each side, low to high: tall ones outside
    const hs = [0.95, 0.72, 0.5], base = L.crest - 8
    L.pipes = []
    for (let k = 0; k < 3; k++) for (const s of [-1, 1]) L.pipes.push({ x: s < 0 ? 44 + k * 13 : W - 44 - k * 13, w: 9, top: base - (base - 28) * hs[k], base })
    const r = seeded(31)
    L.verd = Array.from({ length: 10 }, () => [r(), r(), 5 + r() * 12])
  }

  _canvas(w, h) {
    const c = document.createElement('canvas'), d = this.dpr
    c.width = Math.max(1, Math.round(w * d)); c.height = Math.max(1, Math.round(h * d))
    const g = c.getContext('2d'); g.scale(d, d)
    return [c, g]
  }

  _geo() {
    const { W, L } = this, cx = W / 2
    return { cx, x0: cx - L.mw / 2, y0: L.my, mw: L.mw, mh: L.mh, ym: L.my + L.mh * 0.5, Rw: L.Rw, sp: L.Rw * 1.84 }
  }

  // the floor of the opening, where the belt lies: y at an x
  _floor(x) {
    const G = this._geo()
    return G.y0 + this.mf.loIn(clamp((x - G.x0) / G.mw, 0, 1))
  }

  // ── what does not move, drawn once (the phone has enough to do) ─────────────
  _bake() {
    const { W, H, L } = this
    const [bg, g] = this._canvas(W, H); this.bg = bg
    const r = seeded(7)
    g.fillStyle = iron(g, 0, 0, 0, H); g.fillRect(0, 0, W, H)
    for (let y = 0, row = 0; y < H; y += 44, row++) {                                   // courses of plate, riveted
      let x = -((row * 53) % 130)
      while (x < W) {
        const w = 110 + r() * 60
        const pg = g.createLinearGradient(0, y, 0, y + 44); pg.addColorStop(0, '#34323b'); pg.addColorStop(0.12, '#25232b'); pg.addColorStop(1, '#131217')
        g.fillStyle = pg; g.fillRect(x, y, w - 2, 43)
        g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x, y, w - 2, 1.5)
        g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x + w - 2, y, 2, 44); g.fillRect(x, y + 43, w, 1.5)
        for (const [rx, ry] of [[x + 7, y + 8], [x + w - 11, y + 8], [x + 7, y + 36], [x + w - 11, y + 36]]) rivet(g, rx, ry, 2.2, 'iron')
        if (r() < 0.5) { g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 1; g.beginPath(); const sx = x + 14 + r() * (w - 40), sy = y + 12 + r() * 20; g.moveTo(sx, sy); g.lineTo(sx + 14 + r() * 22, sy + r() * 6 - 3); g.stroke() }
        x += w
      }
    }
    for (let k = 0; k < 14; k++) { const x = r() * W, y = r() * H, rr = 16 + r() * 36, rg = g.createRadialGradient(x, y, 0, x, y, rr); rg.addColorStop(0, 'rgba(70,24,10,0.3)'); rg.addColorStop(1, 'rgba(70,24,10,0)'); g.fillStyle = rg; g.fillRect(x - rr, y - rr, rr * 2, rr * 2) }
    // each reel window set deep in an armoured recess
    for (let i = 0; i < REELS; i++) {
      const x = L.pad + i * (L.rw + L.gap), y = L.wy
      g.fillStyle = '#050405'; g.fillRect(x - 9, y - 9, L.rw + 18, L.winH + 18)
      g.lineWidth = 5; g.strokeStyle = bronze(g, x, y, x + L.rw, y + L.winH); g.strokeRect(x - 5.5, y - 5.5, L.rw + 11, L.winH + 11)
      g.lineWidth = 1.5; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeRect(x - 8.5, y - 8.5, L.rw + 17, L.winH + 17)
      for (const [rx, ry] of [[x - 5.5, y - 5.5], [x + L.rw + 5.5, y - 5.5], [x - 5.5, y + L.winH + 5.5], [x + L.rw + 5.5, y + L.winH + 5.5]]) rivet(g, rx, ry, 2.4, 'bronze')
    }
    // the round window: a bronze bezel, riveted all round
    const O = L.oval
    g.fillStyle = '#050405'; g.beginPath(); g.ellipse(O.cx, O.cy, O.rx + 9, O.ry + 9, 0, 0, Math.PI * 2); g.fill()
    g.lineWidth = 7; g.strokeStyle = bronze(g, O.cx - O.rx, O.cy - O.ry, O.cx + O.rx, O.cy + O.ry); g.beginPath(); g.ellipse(O.cx, O.cy, O.rx + 5.5, O.ry + 5.5, 0, 0, Math.PI * 2); g.stroke()
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.beginPath(); g.ellipse(O.cx, O.cy, O.rx + 9, O.ry + 9, 0, 0, Math.PI * 2); g.stroke()
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; rivet(g, O.cx + Math.cos(a) * (O.rx + 5.5), O.cy + Math.sin(a) * (O.ry + 5.5), 2.4, 'bronze') }
    // the pipes: bronze, banded, each with its mouth cut in it
    for (const p of L.pipes) {
      const gr = g.createLinearGradient(p.x - p.w / 2, 0, p.x + p.w / 2, 0); gr.addColorStop(0, C.bronD); gr.addColorStop(0.3, C.bronL); gr.addColorStop(0.6, C.bronM); gr.addColorStop(1, C.bronD)
      g.fillStyle = gr; g.fillRect(p.x - p.w / 2, p.top, p.w, p.base - p.top)
      g.fillStyle = '#0a0709'; g.fillRect(p.x - p.w / 2 + 1.5, p.base - (p.base - p.top) * 0.3, p.w - 3, 5)
      g.fillStyle = bronze(g, p.x - p.w, 0, p.x + p.w, 0); g.fillRect(p.x - p.w * 0.62, p.top - 2, p.w * 1.24, 4); g.fillRect(p.x - p.w * 0.62, p.base - 4, p.w * 1.24, 5)
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(p.x - p.w / 2, p.top + (p.base - p.top) * 0.45, p.w, 1.5)
    }
    // the plait, top and bottom; bosses at the corners
    plait(g, 24, 4, W - 48, 15); plait(g, 24, H - 19, W - 48, 15)
    g.lineWidth = 10; g.strokeStyle = iron(g, 0, 0, W, H); g.strokeRect(5, 5, W - 10, H - 10)
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,0.14)'; g.strokeRect(0.75, 0.75, W - 1.5, H - 1.5); g.strokeStyle = 'rgba(0,0,0,0.9)'; g.strokeRect(10.5, 10.5, W - 21, H - 21)
    for (const [x, y] of [[20, 20], [W - 20, 20], [20, H - 20], [W - 20, H - 20]]) boss(g, x, y, 17)
    for (let y = 40; y < H - 30; y += 36) { rivet(g, 5, y, 2.4, 'bronze'); rivet(g, W - 5, y, 2.4, 'bronze') }

    this._lips()
    // the glass over the window, and the signs behind it
    const gw = O.rx * 2 + 16, gh = O.ry * 2 + 16, [gc, gg] = this._canvas(gw, gh); this.glass = gc
    gg.beginPath(); gg.ellipse(gw / 2, gh / 2, O.rx, O.ry, 0, 0, Math.PI * 2); gg.clip()
    gg.save(); gg.translate(gw / 2, gh / 2); gg.scale(1, O.ry / O.rx)
    const vg = gg.createRadialGradient(0, 0, O.rx * 0.5, 0, 0, O.rx); vg.addColorStop(0, 'rgba(120,200,170,0.03)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)')
    gg.fillStyle = vg; gg.fillRect(-O.rx, -O.rx, O.rx * 2, O.rx * 2); gg.restore()
    gg.fillStyle = 'rgba(255,255,255,0.15)'; gg.beginPath(); gg.moveTo(gw * 0.14, gh * 0.55); gg.quadraticCurveTo(gw * 0.18, gh * 0.2, gw * 0.46, gh * 0.1); gg.quadraticCurveTo(gw * 0.3, gh * 0.24, gw * 0.24, gh * 0.55); gg.closePath(); gg.fill()
    gg.fillStyle = 'rgba(255,255,255,0.08)'; gg.beginPath(); gg.ellipse(gw * 0.78, gh * 0.8, gw * 0.06, gh * 0.04, -0.5, 0, Math.PI * 2); gg.fill()
    const made = {}
    this.cardCv = CARDS.map((n) => made[n] || (made[n] = this._card(n)))
  }

  // one sign of the pinwheel
  _card(name) {
    const { cw, ch } = this.L, [c, g] = this._canvas(cw, ch)
    drawCard(g, name, cw, ch)
    const src = CARD_SRC[name]
    if (src) {
      const im = new Image()
      im.onload = () => { const k = Math.max(cw / im.naturalWidth, ch / im.naturalHeight); g.drawImage(im, (cw - im.naturalWidth * k) / 2, (ch - im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k) }
      im.src = src
    }
    return c
  }

  // the mouth: two sculpted lips (a cupid's bow above, a fuller lip below) round a lens of an opening, and the grinding
  // wheels and the belt that go inside it. None of it moves of itself.
  _lips() {
    const { mw, mh, Rw } = this.L, ox = 8, LW = mw + 16, ym = mh * 0.5, oh = Rw, lipU = mh * 0.2, lipL = mh * 0.28
    const fo = (u) => Math.pow(Math.sin(Math.PI * u), 0.75)
    const gs = (u, m, s) => Math.exp(-(((u - m) / s) ** 2))
    const X = (u) => ox + u * mw
    const upOut = (u) => ym - (oh + lipU) * fo(u) * (1 + 0.14 * (gs(u, 0.36, 0.1) + gs(u, 0.64, 0.1))) + lipU * 0.42 * gs(u, 0.5, 0.05)
    const upIn = (u) => ym - oh * fo(u) + oh * 0.2 * gs(u, 0.5, 0.08)
    const loIn = (u) => ym + oh * 0.9 * fo(u)
    const loOut = (u) => ym + (oh + lipL) * Math.pow(fo(u), 0.9)
    this.mf = { upIn, loIn, X, ym }
    const path = (g, fa, fb) => { const n = 64; g.beginPath(); for (let i = 0; i <= n; i++) g.lineTo(X(i / n), fa(i / n)); for (let i = n; i >= 0; i--) g.lineTo(X(i / n), fb(i / n)); g.closePath() }
    const [lips, g] = this._canvas(LW, mh); this.lips = lips
    const lip = (fa, fb, top) => {
      const y0 = top ? ym - oh - lipU : ym, y1 = top ? ym : ym + oh + lipL
      path(g, fa, fb); g.save(); g.clip()
      const gr = g.createLinearGradient(0, y0, 0, y1)
      if (top) { gr.addColorStop(0, C.ironL); gr.addColorStop(0.55, C.ironM); gr.addColorStop(1, C.ironD) }
      else { gr.addColorStop(0, C.ironD); gr.addColorStop(0.35, C.ironL); gr.addColorStop(0.7, C.ironM); gr.addColorStop(1, C.ironD) }
      g.fillStyle = gr; g.fillRect(0, y0 - 2, LW, y1 - y0 + 4)
      const hy = top ? ym - oh - lipU * 0.45 : ym + oh + lipL * 0.38
      g.save(); g.translate(LW / 2, hy); g.scale(1, 0.2)
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, mw * 0.36); rg.addColorStop(0, 'rgba(255,255,255,0.22)'); rg.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = rg; g.fillRect(-mw * 0.4, -mw * 0.4, mw * 0.8, mw * 0.8); g.restore()
      for (let k = 1; k < 28; k++) {                                         // the creases of a lip, cut in
        const u = k / 28, a = fb(u), b = a + (fa(u) - a) * 0.6
        g.beginPath(); g.moveTo(X(u), a); g.lineTo(X(u), b); g.lineWidth = 1.3; g.strokeStyle = 'rgba(0,0,0,0.42)'; g.stroke()
        g.beginPath(); g.moveTo(X(u) + 1.4, a); g.lineTo(X(u) + 1.4, b); g.lineWidth = 0.8; g.strokeStyle = 'rgba(255,255,255,0.07)'; g.stroke()
      }
      g.fillStyle = 'rgba(47,125,108,0.45)'
      for (const [a, b, rr] of this.L.verd) { const u = 0.1 + a * 0.8, yy = fb(u) + (fa(u) - fb(u)) * (0.3 + 0.6 * b); g.beginPath(); g.ellipse(X(u), yy, rr, rr * 0.4, 0, 0, 7); g.fill() }
      g.restore()
      g.lineWidth = 4.5; g.strokeStyle = bronze(g, 0, y0, 0, y1); g.beginPath()                                // the bronze rim, edge of the opening
      for (let i = 0; i <= 64; i++) g.lineTo(X(i / 64), fb(i / 64))
      g.stroke()
      path(g, fa, fb); g.lineWidth = 1.6; g.strokeStyle = '#000'; g.stroke()
    }
    lip(upOut, upIn, true); lip(loOut, loIn, false)
    boss(g, X(0) + 3, ym, 10); boss(g, X(1) - 3, ym, 10)                                                          // the dimples at the corners
    // the wheel (one picture, turned and turned)
    const [wheel, wg] = this._canvas(Rw * 2 + 8, Rw * 2 + 8); this.wheel = wheel
    wg.translate(Rw + 4, Rw + 4)
    wg.beginPath()
    for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, rr = i % 2 ? Rw * 0.8 : Rw; wg.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) }
    wg.closePath()
    const wgr = wg.createRadialGradient(-Rw * 0.3, -Rw * 0.3, 1, 0, 0, Rw); wgr.addColorStop(0, '#b4b0bc'); wgr.addColorStop(0.7, '#5c5966'); wgr.addColorStop(1, '#25232b')
    wg.fillStyle = wgr; wg.fill(); wg.lineWidth = 1.6; wg.strokeStyle = '#000'; wg.stroke()
    wg.strokeStyle = 'rgba(0,0,0,0.55)'; wg.lineWidth = 1.4; wg.beginPath(); wg.arc(0, 0, Rw * 0.62, 0, 7); wg.stroke()
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; wg.fillStyle = '#0a090c'; wg.beginPath(); wg.arc(Math.cos(a) * Rw * 0.5, Math.sin(a) * Rw * 0.5, Rw * 0.1, 0, 7); wg.fill() }
    wg.fillStyle = bronze(wg, -Rw * 0.3, -Rw * 0.3, Rw * 0.3, Rw * 0.3); wg.beginPath(); wg.arc(0, 0, Rw * 0.3, 0, 7); wg.fill(); wg.lineWidth = 1.2; wg.strokeStyle = '#000'; wg.stroke()
    rivet(wg, 0, 0, Rw * 0.1, 'iron')
    // the dark inside
    const [inner, ig] = this._canvas(mw, mh); this.inner = inner
    const igr = ig.createLinearGradient(0, ym - oh, 0, ym + oh); igr.addColorStop(0, '#050203'); igr.addColorStop(0.55, '#2a070d'); igr.addColorStop(1, '#4e0d17')
    ig.fillStyle = igr; ig.fillRect(0, 0, mw, mh)
  }

  // ── a pull ──────────────────────────────────────────────────────────────────
  _feed() {
    if (this.phase !== 'idle' || this.done || !this.el) return
    const q = this._queue()
    if (!q.length) return                                      // (nothing to give: the mouth only waits)
    const { i, it } = q[0], inv = this.scene.player.inventory
    inv.removeOne(i)
    try { saveInventory(inv) } catch (_) {}
    const kind = it.id === NUT ? 'nut' : /weapon|sword|bow|armor/.test(it.type || '') ? 'gear' : 'item'
    this.nut = { it, kind, pic: this._pic(it), col: '#' + ((it.color ?? 0xa8702c) & 0xffffff).toString(16).padStart(6, '0'), x: this.W / 2, y: this.H + 12, sx: this.W / 2, t: 0, rot: 0, stage: 'fly' }
    this.phase = 'feeding'
    this.idleT = -99
    this._snd('clank', 150)
    this._speak(kind === 'nut' ? 'nut' : kind)
  }

  // it is on the wheels: three grindings, the belt carries the leavings off to the right, and the plate lifts
  _chew() {
    const n = this.nut; this.nut = null; this.phase = 'chewing'
    this.lidT = 0; this.lidV = 0; this._snd('clank', 240)
    const grind = (k) => {
      this.grind = 1; this._snd('grind'); this.shake = Math.max(this.shake, 0.7)
      const G = this._geo()
      for (let j = 0; j < 9; j++) this.chips.push({ x: G.cx + R(-G.sp * 2, G.sp * 2), y: G.ym - G.Rw * 0.2, vx: R(-40, 40), vy: R(-70, -10), onBelt: false, life: 9, col: n.col })
      this.beltT = this.t + 2.6
      this._puff(this.W / 2, this.L.my + this.L.mh * 0.3, 2)
      if (k > 1) this._later(() => grind(k - 1), 360)
      else this._later(() => { this.grind = 0; this._spin() }, 450)
    }
    grind(3)
  }

  _spin() {
    this.phase = 'spinning'
    this.t0 = performance.now()
    this.reels.forEach((r) => { r.mode = 'spin'; r.v = 0; r.last = Math.floor(r.pos) })
    this._snd('ratchet')
    this._said = false
    this._say('spin')
  }

  _canStop() { return performance.now() - this.t0 > RAMP * 1000 && this.reels.some(r => r.mode === 'spin') }

  // the pawl, on the next reel along
  _stop() {
    if (this.phase !== 'spinning' || !this._canStop()) return
    const r = this.reels.find(q => q.mode === 'spin')
    if (r) this._brake(r)
  }

  _brake(r) {
    const n1 = Math.ceil(r.pos + r.v * BITE)
    const D = clamp(2 * (n1 - r.pos) / Math.max(r.v, 0.5), 0.16, 0.5)
    r.mode = 'brake'; r.brake = { p0: r.pos, p1: n1, t0: performance.now(), D: D * 1000 }
  }

  _settle() {
    const ids = this.reels.map((r, i) => STRIPS[i][mod(Math.round(r.pos), COUNT)])
    const win = ids.every(id => this.held.has(id))
    if (!win) {
      // it does not like you: the lid comes down, the face sneers, the pipes laugh
      this._say('lose'); this._puff(this.W / 2, this.L.my + this.L.mh * 0.5, 4)
      this._later(() => { this.lidT = 1; this.lidV = 0 }, 1300)
      this._later(() => {
        this.phase = 'idle'; this.idleT = 0
        if (!this._queue().length) this._say('empty')
      }, 2300)
      return
    }
    this.done = true; this.phase = 'win'
    GameState.addNote(BALOR_NOTE)
    this.shake = 1.5; this.lidT = 0; this._snd('clank', 240)
    this._say('win')
    for (let k = 0; k < 6; k++) this._later(() => { this._puff(this.W * (0.15 + 0.7 * Math.random()), this.H * (0.15 + 0.5 * Math.random()), 5); this.glow = this.glow.map(() => 1) }, k * 250)
    this._later(() => {
      this.phase = 'idle'; this.close()
      this.scene._cap?.show?.('[Gaeilge le teacht]', '[PLACEHOLDER] The great eye over the door opens.', 4200)
    }, 2600)
  }

  // ── what it says: a face in the window, a line under it, and the pipes ──────
  _say(cat) {
    this.eyeQ = []; this._gotoName(pick(FACE[cat]))
    this.say = { until: performance.now() + 3400 }
    this._speak(MOOD[cat] || 'taunt')
  }

  // the pinwheel: turn to a sign by the shortest way round (through whatever lies between: that is what a wheel does)
  _gotoIdx(i) { const N = CARDS.length; this.wt += mod(i - this.wt + N / 2, N) - N / 2 }
  _gotoName(name) {
    const N = CARDS.length; let best = null
    CARDS.forEach((n, i) => { if (n !== name) return; const d = mod(i - this.wt + N / 2, N) - N / 2; if (best === null || Math.abs(d) < Math.abs(best)) best = d })
    if (best !== null) this.wt += best
  }
  // the eye wakes: peeks, looks one way, the other, and shuts (forward round the first five signs, and back the next time)
  _eye() {
    const cur = mod(Math.round(this.wt), CARDS.length), path = cur === 0 ? [1, 2, 3, 4] : [3, 2, 1, 0]
    this.eyeQ = path.map((i, k) => ({ i, wait: [0, 0.8, 0.9, 0.8][k] }))
  }

  // a mean little droid, in pipes and whistles: chirps, glides and a raspberry, a puff of steam from the pipe for each note
  _speak(mood) {
    const notes = []
    const n = (f0, f1, d, vol = 0.05, type) => notes.push({ f0, f1, d, vol, type })
    if (mood === 'taunt') { let f = R(500, 900); for (let i = 0, m = 5 + Math.floor(Math.random() * 4); i < m; i++) { const f2 = R(500, 2400); n(f, f2, R(0.05, 0.13)); f = f2 } n(1500, 300, 0.35, 0.05, 'vib') }
    else if (mood === 'laugh') { for (const f of [900, 700, 960, 700, 1040, 640, 1100, 600]) n(f, f * 0.92, 0.07, 0.05) }
    else if (mood === 'sneer') { n(1700, 380, 0.7, 0.05, 'vib'); n(90, 60, 0.25, 0.06, 'rasp') }
    else if (mood === 'rage') { n(220, 90, 0.4, 0.07, 'rasp'); for (let i = 0; i < 7; i++) n(R(1200, 2600), R(300, 900), 0.06, 0.05); n(2400, 120, 0.6, 0.06, 'vib') }
    else if (mood === 'glee') { for (let i = 0, f = 600; i < 6; i++, f *= 1.22) n(f, f * 1.3, 0.07, 0.05); n(2400, 1900, 0.2, 0.04, 'vib') }
    else if (mood === 'sigh') { n(1100, 260, 0.8, 0.045, 'vib') }
    else if (mood === 'hurry') { for (let i = 0, f = 700; i < 4; i++, f *= 1.25) n(f, f * 1.15, 0.05, 0.05) }
    let at = 0
    for (const nt of notes) {
      const a = at, pipe = clamp(Math.floor((nt.f1 - 250) / 2300 * 6), 0, 5)
      this._later(() => { this.glow[pipe] = 1; const p = this.L.pipes[pipe]; this.puffs.push({ x: p.x, y: p.top - 2, vx: R(-8, 8), vy: -R(30, 55), r: 4, a: 0.5, g: 12 }) }, a * 1000)
      at += nt.d + 0.025
    }
    try {
      const ctx = SoundBoard.ctx?.(this.scene); if (!ctx) return
      const t = ctx.currentTime + 0.02; let tt = 0
      notes.forEach((nt, k) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), s = t + tt
        o.type = nt.type === 'rasp' ? 'sawtooth' : (k % 3 === 2 ? 'square' : k % 2 ? 'triangle' : 'sine')
        o.frequency.setValueAtTime(nt.f0, s); o.frequency.exponentialRampToValueAtTime(Math.max(30, nt.f1), s + nt.d)
        if (nt.type === 'vib' || nt.type === 'rasp') {
          const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = nt.type === 'rasp' ? 38 : 24; lg.gain.value = nt.type === 'rasp' ? nt.f0 * 0.5 : nt.f0 * 0.03
          l.connect(lg); lg.connect(o.frequency); l.start(s); l.stop(s + nt.d + 0.02)
        }
        g.gain.setValueAtTime(0.0001, s); g.gain.linearRampToValueAtTime(nt.vol * (o.type === 'square' ? 0.5 : 1), s + 0.012); g.gain.exponentialRampToValueAtTime(0.0005, s + nt.d)
        o.connect(g); g.connect(ctx.destination); o.start(s); o.stop(s + nt.d + 0.03)
        tt += nt.d + 0.025
      })
    } catch (_) {}
  }

  _cell(id) {
    let c = this.cells.get(id)
    if (c) return c
    const im = this.imgs[id]
    if (!im.complete || !im.naturalWidth) return null
    const { rw, cellH } = this.L, d = this.dpr, pad = 4
    c = document.createElement('canvas'); c.width = Math.round((rw - 2 * pad) * d); c.height = Math.round((cellH - 2 * pad) * d)
    const g = c.getContext('2d'), s = Math.min(c.width / im.naturalWidth, c.height / im.naturalHeight)
    const w = im.naturalWidth * s, h = im.naturalHeight * s
    g.drawImage(im, (c.width - w) / 2, (c.height - h) / 2, w, h)
    if (!this.held.has(id)) {
      const px = g.getImageData(0, 0, c.width, c.height), a = px.data
      for (let i = 0; i < a.length; i += 4) { const l = (a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11) * 0.42; a[i] = a[i + 1] = a[i + 2] = l }
      g.putImageData(px, 0, 0)
    }
    this.cells.set(id, c)
    return c
  }

  _puff(x, y, n) { for (let k = 0; k < n; k++) this.puffs.push({ x: x + (Math.random() - 0.5) * 24, y, vx: (Math.random() - 0.5) * 50, vy: -30 - Math.random() * 50, r: 8 + Math.random() * 10, a: 0.5, g: 22 + Math.random() * 18 }) }

  // ── the frame ───────────────────────────────────────────────────────────────
  _frame(now) {
    if (!this.el) return
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt
    this._step(dt, now)
    this._draw()
    this._raf = requestAnimationFrame((n) => this._frame(n))
  }

  _step(dt, now) {
    const G = this._geo()
    this.shake = Math.max(0, this.shake - dt * 3)
    for (let i = 0; i < 6; i++) this.glow[i] = Math.max(0, this.glow[i] - dt * 5)
    // the pinwheel turns toward the sign it is to show
    const dA = this.wt - this.wa
    if (Math.abs(dA) > 0.003) { this.wa += Math.sign(dA) * Math.min(Math.abs(dA), (Math.abs(dA) * 6 + 0.6) * dt); this.restT = 0 } else { this.wa = this.wt; this.restT += dt }
    const ri = Math.round(this.wa); if (ri !== this.waLast) { this.waLast = ri; this._snd('tick') }
    if (this.wa === this.wt) {
      if (this.eyeQ.length && this.restT >= this.eyeQ[0].wait) this._gotoIdx(this.eyeQ.shift().i)
      else if (!this.eyeQ.length && this.say && now > this.say.until) { this.say = null; this._gotoName('closed') }
    }
    // the wheels
    this.grind = this.phase === 'chewing' ? this.grind : Math.max(0, this.grind - dt * 2)
    this.wheelA += dt * this.grind * 16                  // (still, but when it works)
    const beltOn = this.t < this.beltT
    if (beltOn) this.beltPh += BELT * dt / (G.mw / 36)
    // the eyelid: it drops with weight (and bounces, once), and lifts the way a lid does
    if (this.lidT >= 1) {
      if (this.lid < 1 || this.lidV !== 0) {
        this.lidV += 26 * dt; this.lid += this.lidV * dt
        if (this.lid >= 1) { this.lid = 1; if (this.lidV > 1.6) { this.lidV = -this.lidV * 0.2; this._snd('clunk'); this.shake = Math.max(this.shake, 0.8) } else this.lidV = 0 }
      }
    } else { this.lid += (0 - this.lid) * Math.min(1, dt * 6); if (this.lid < 0.002) this.lid = 0 }
    // the thing it was given, on its way in: up from the moon, into the mouth, onto the wheels
    const n = this.nut
    if (n && n.stage === 'fly') {
      n.t = Math.min(1, n.t + dt / 0.55); n.rot += dt * 12
      const e = 1 - (1 - n.t) * (1 - n.t), y0 = this.H + 12
      n.x = n.sx + (G.cx - n.sx) * e; n.y = y0 + (G.ym - y0) * e
      if (n.t >= 1) { n.stage = 'ground'; this._snd('tick'); this._chew() }
    }
    // the leavings: they fall onto the belt, and the belt takes them to the right and out
    for (const c of this.chips) {
      c.life -= dt
      if (!c.onBelt) { c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 420 * dt; if (c.y >= this._floor(c.x) - 3) c.onBelt = true }
      if (c.onBelt) { if (beltOn) c.x += BELT * dt; c.y = this._floor(c.x) - 3 }
    }
    this.chips = this.chips.filter(c => c.life > 0 && c.x < G.x0 + G.mw * 0.96)
    // the reels
    const age = (now - (this.t0 || now)) / 1000, left = SPIN - age
    let moving = false
    for (let i = 0; i < REELS; i++) {
      const r = this.reels[i]
      if (r.mode === 'spin') {
        const slow = left >= WIND_DOWN ? 1 : Math.pow(Math.max(left, 0) / WIND_DOWN, 0.7)
        r.v = VMAX * MULT[i] * Math.min(1, age / RAMP) * slow
        r.pos += r.v * dt
        if (left <= 0) this._brake(r)                          // (out of time)
      } else if (r.mode === 'brake') {
        const b = r.brake, u = clamp((now - b.t0) / b.D, 0, 1), p = b.p0 + (b.p1 - b.p0) * (1 - (1 - u) * (1 - u))
        r.v = (p - r.pos) / Math.max(dt, 0.001); r.pos = p
        if (u >= 1) { r.pos = b.p1; r.mode = 'stopped'; r.v = 0; this._snd('clunk'); this.shake = Math.max(this.shake, 0.55); try { navigator.vibrate?.(18) } catch (_) {} }
      }
      if (r.mode === 'spin' || r.mode === 'brake') {
        moving = true
        const c = Math.floor(r.pos); if (c !== r.last) { r.last = c; if (r.mode === 'brake' || Math.abs(r.v) < 5) this._snd('tick') }
      }
    }
    // it hurries you, near the end
    if (this.phase === 'spinning' && left < HURRY && !this._hurried && this.reels.some(r => r.mode === 'spin')) { this._hurried = true; this._say('hurry') }
    if (this.phase !== 'spinning') this._hurried = false
    if (this.phase === 'spinning' && !moving && this.reels.every(r => r.mode === 'stopped')) { this.phase = 'settling'; this._later(() => this._settle(), 350) }
    // while it waits: the eye now and then peeks about, and now and then it calls you
    if (this.phase === 'idle' && this.lid >= 1 && !this.say && !this.eyeQ.length && this.wa === this.wt && [0, 4].includes(mod(Math.round(this.wt), CARDS.length))) {
      this.idleT += dt
      if (this.idleT > 7) { this.idleT = R(0, 3); if (Math.random() < 0.7) this._eye(); else this._say('idle') }
    }
    // steam
    for (const p of this.puffs) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 8 * dt; p.r += p.g * dt; p.a -= dt * 0.45 }
    this.puffs = this.puffs.filter(p => p.a > 0)
  }

  // ── sounds (a little tin and grease: made as they are needed) ───────────────
  _snd(kind, f0) {
    try {
      const ctx = SoundBoard.ctx?.(this.scene); if (!ctx) return
      const t = ctx.currentTime + 0.01, out = ctx.destination
      const tone = (type, f, f2, len, vol, at = 0) => {
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.type = type; o.frequency.setValueAtTime(f, t + at); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + at + len)
        g.gain.setValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(0.0005, t + at + len)
        o.connect(g); g.connect(out); o.start(t + at); o.stop(t + at + len + 0.02)
      }
      const noise = (len, f, vol, at = 0) => {
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate), d = buf.getChannelData(0)
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
        const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain()
        s.buffer = buf; fl.type = 'bandpass'; fl.frequency.value = f; g.gain.value = vol
        s.connect(fl); fl.connect(g); g.connect(out); s.start(t + at)
      }
      if (kind === 'clank') { tone('square', f0 || 180, (f0 || 180) * 0.6, 0.18, 0.05); tone('triangle', (f0 || 180) * 1.51, null, 0.25, 0.05) }
      else if (kind === 'grind') { noise(0.35, 500, 0.22); tone('sawtooth', 70, 45, 0.35, 0.05); tone('square', 150, 90, 0.2, 0.04); noise(0.12, 2200, 0.1, 0.05) }
      else if (kind === 'tick') tone('square', 800, 500, 0.025, 0.018)
      else if (kind === 'clunk') { tone('triangle', 190, 65, 0.2, 0.1); tone('square', 950, 400, 0.04, 0.05); noise(0.08, 1500, 0.08) }
      else if (kind === 'ratchet') { for (let k = 0; k < 10; k++) tone('square', 700 + (k % 2) * 90, 500, 0.03, 0.02, k * 0.06) }
    } catch (_) {}
  }

  // ── drawing ─────────────────────────────────────────────────────────────────
  _draw() {
    const g = this.ctx, { W, H, L } = this, d = this.dpr, t = this.t
    g.setTransform(d, 0, 0, d, 0, 0)
    g.clearRect(0, 0, W, H)
    const sx = this.shake ? (Math.random() - 0.5) * 5 * this.shake : 0, sy = this.shake ? (Math.random() - 0.5) * 5 * this.shake : 0
    g.save(); g.translate(sx, sy)
    g.drawImage(this.bg, 0, 0, W, H)
    this._window(g)
    this._pipes(g)
    for (let i = 0; i < REELS; i++) this._reel(g, i, L.pad + i * (L.rw + L.gap), L.wy)
    this._lid(g)
    this._payline(g)
    this._mouth(g)
    for (const p of this.puffs) {
      const rg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r)
      rg.addColorStop(0, `rgba(225,222,215,${p.a})`); rg.addColorStop(1, 'rgba(225,222,215,0)')
      g.fillStyle = rg; g.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2)
    }
    const n = this.nut
    if (n && n.stage !== 'ground') {
      const sz = 26 * (1 - 0.4 * n.t * n.t), k = Math.min(sz / n.pic.width, sz / n.pic.height)
      g.save(); g.translate(n.x, n.y); g.rotate(n.rot)
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(1, 3, sz * 0.4, sz * 0.4, 0, 0, 7); g.fill()
      g.imageSmoothingEnabled = false; g.drawImage(n.pic, -n.pic.width * k / 2, -n.pic.height * k / 2, n.pic.width * k, n.pic.height * k)
      g.restore()
    }
    if (this.phase === 'win') { g.fillStyle = `rgba(255,170,60,${0.08 + 0.06 * Math.sin(t * 30)})`; g.fillRect(0, 0, W, H) }
    g.restore()
  }

  // the pipes: a glint on whichever is sounding
  _pipes(g) {
    for (let i = 0; i < 6; i++) {
      const gl = this.glow[i]; if (gl < 0.02) continue
      const p = this.L.pipes[i]
      g.fillStyle = `rgba(255,225,150,${0.5 * gl})`; g.fillRect(p.x - p.w / 2, p.top, p.w, p.base - p.top)
    }
  }

  // the round window: the signs on their wheel behind the glass
  _window(g) {
    const { cx, cy, rx, ry } = this.L.oval, dw = this.L.cw, dh = this.L.ch, N = CARDS.length, R0 = this.L.wheelR, step = this.L.wheelStep
    g.save(); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.clip()
    g.fillStyle = '#070405'; g.fillRect(cx - rx, cy - ry, rx * 2, ry * 2)
    for (let i = 0; i < N; i++) {
      const d = mod(i - this.wa + N / 2, N) - N / 2
      if (Math.abs(d) > 1.7) continue
      const phi = d * step
      g.save(); g.translate(cx + R0 * Math.sin(phi), cy + R0 * (1 - Math.cos(phi))); g.rotate(phi)
      g.drawImage(this.cardCv[i], -dw / 2, -dh / 2, dw, dh); g.restore()
    }
    g.restore()
    g.drawImage(this.glass, cx - rx - 8, cy - ry - 8, rx * 2 + 16, ry * 2 + 16)
  }

  _reel(g, i, x, y) {
    const { rw, cellH, winH } = this.L, r = this.reels[i], strip = STRIPS[i]
    if (this.lid >= 1) return                                    // (shut: the lid is all there is to see)
    g.save()
    g.beginPath(); g.rect(x, y, rw, winH); g.clip()
    g.fillStyle = '#d9caa0'; g.fillRect(x, y, rw, winH)
    const n = Math.floor(r.pos), cyC = y + winH / 2
    for (let k = n - 1; k <= n + 2; k++) {
      const cy = cyC + (r.pos - k) * cellH, c = this._cell(strip[mod(k, COUNT)])
      g.fillStyle = (k & 1) ? 'rgba(120,80,20,0.2)' : 'rgba(255,255,255,0.1)'; g.fillRect(x, cy - cellH / 2, rw, cellH)
      g.fillStyle = 'rgba(40,24,6,0.7)'; g.fillRect(x, cy - cellH / 2, rw, 2)
      if (!c) continue
      const dw = c.width / this.dpr, dh = c.height / this.dpr
      g.drawImage(c, x + (rw - dw) / 2, cy - dh / 2, dw, dh)
    }
    // the turn of the drum: dark at top and bottom, and at the sides
    const sh = g.createLinearGradient(0, y, 0, y + winH); sh.addColorStop(0, 'rgba(10,3,0,0.85)'); sh.addColorStop(0.24, 'rgba(10,3,0,0.12)'); sh.addColorStop(0.5, 'rgba(0,0,0,0)'); sh.addColorStop(0.76, 'rgba(10,3,0,0.12)'); sh.addColorStop(1, 'rgba(10,3,0,0.85)')
    g.fillStyle = sh; g.fillRect(x, y, rw, winH)
    const sd = g.createLinearGradient(x, 0, x + rw, 0); sd.addColorStop(0, 'rgba(0,0,0,0.45)'); sd.addColorStop(0.14, 'rgba(0,0,0,0)'); sd.addColorStop(0.86, 'rgba(0,0,0,0)'); sd.addColorStop(1, 'rgba(0,0,0,0.45)')
    g.fillStyle = sd; g.fillRect(x, y, rw, winH)
    g.restore()
  }

  // the iron plate over the three reels: it drops with a clang and lifts away, and has a keyhole in it
  _lid(g) {
    const { L, W } = this, k = this.lid
    if (k < 0.004) return
    const x0 = L.pad - 10, x1 = W - L.pad + 10, top = L.wy - 10, bandH = L.winH + 20, cx = W / 2
    const ph = bandH + 8, ys = top + bandH * k, py = ys - ph
    g.save(); g.beginPath(); g.rect(x0, top - 2, x1 - x0, bandH + 4); g.clip()
    const lg = g.createLinearGradient(0, py, 0, ys); lg.addColorStop(0, C.ironL); lg.addColorStop(0.5, C.ironM); lg.addColorStop(1, C.ironD)
    g.fillStyle = lg; g.fillRect(x0, py, x1 - x0, ph)
    g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x0, py, x1 - x0, 2)
    for (const sx of [x0 + (x1 - x0) * 0.27, x0 + (x1 - x0) * 0.73]) {                       // the seams, and their rivets
      g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(sx - 1, py, 2, ph); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(sx + 1, py, 1.2, ph)
      for (let y = py + 14; y < ys - 10; y += 26) { rivet(g, sx - 7, y, 2, 'iron'); rivet(g, sx + 7, y, 2, 'iron') }
    }
    for (let x = x0 + 12; x < x1 - 6; x += 26) { rivet(g, x, py + 9, 2, 'iron'); rivet(g, x, ys - 15, 2, 'iron') }
    g.fillStyle = bronze(g, 0, ys - 8, 0, ys); g.fillRect(x0, ys - 8, x1 - x0, 8); g.fillStyle = '#000'; g.fillRect(x0, ys - 0.5, x1 - x0, 1.5); g.fillRect(x0, ys - 9, x1 - x0, 1)
    const ky = ys - ph * 0.5, kr = bandH * 0.19                                               // the keyhole, in a bronze boss
    const rg = g.createRadialGradient(cx - kr * 0.3, ky - kr * 0.35, 1, cx, ky, kr); rg.addColorStop(0, C.bronL); rg.addColorStop(0.6, C.bronM); rg.addColorStop(1, '#2e1a06')
    g.fillStyle = rg; g.beginPath(); g.arc(cx, ky, kr, 0, 7); g.fill(); g.lineWidth = 2; g.strokeStyle = '#000'; g.stroke()
    g.fillStyle = '#050405'; g.beginPath(); g.arc(cx, ky - kr * 0.2, kr * 0.26, 0, 7); g.moveTo(cx - kr * 0.13, ky); g.lineTo(cx + kr * 0.13, ky); g.lineTo(cx + kr * 0.24, ky + kr * 0.55); g.lineTo(cx - kr * 0.24, ky + kr * 0.55); g.closePath(); g.fill()
    g.restore()
  }

  // the payline's pointers: two bronze arrowheads
  _payline(g) {
    const { L, W } = this, cy = L.wy + L.winH / 2
    for (const [x, d] of [[L.pad - 12, 1], [W - L.pad + 12, -1]]) {
      g.beginPath(); g.moveTo(x, cy - 11); g.lineTo(x + d * 15, cy); g.lineTo(x, cy + 11); g.closePath()
      g.fillStyle = bronze(g, x, cy - 11, x + d * 15, cy + 11); g.fill(); g.lineWidth = 2; g.strokeStyle = '#000'; g.stroke()
    }
  }

  _mouth(g) {
    const G = this._geo(), { cx, x0, y0, mw, mh, ym, Rw, sp } = G, mf = this.mf, tb = Rw * 0.5
    const lensX = (i) => x0 + i / 64 * mw
    // inside the opening: the dark, the wheels, the belt, the leavings
    g.save(); g.beginPath()
    for (let i = 0; i <= 64; i++) g.lineTo(lensX(i), y0 + mf.upIn(i / 64))
    for (let i = 64; i >= 0; i--) g.lineTo(lensX(i), y0 + mf.loIn(i / 64))
    g.closePath(); g.clip()
    g.drawImage(this.inner, x0, y0, mw, mh)
    const wheel = (wx, wy, dir, ph) => { g.save(); g.translate(wx, wy); g.rotate(this.wheelA * dir + ph); g.drawImage(this.wheel, -Rw - 4, -Rw - 4, Rw * 2 + 8, Rw * 2 + 8); g.restore() }
    for (let k = 0; k < 6; k++) wheel(cx + (k - 2.5) * sp, ym - Rw * 0.75, (k & 1) ? -1 : 1, k * 0.7)
    for (let j = 0; j < 7; j++) wheel(cx + (j - 3) * sp, ym + Rw * 0.75, (j & 1) ? 1 : -1, j * 0.4)
    // the belt: pink, along the floor of the mouth, running one way (to the right)
    g.beginPath()
    for (let i = 0; i <= 64; i++) g.lineTo(lensX(i), y0 + mf.loIn(i / 64) - tb)
    for (let i = 64; i >= 0; i--) g.lineTo(lensX(i), y0 + mf.loIn(i / 64) + 2)
    g.closePath(); g.fillStyle = '#d8708c'; g.fill()
    const K = 36
    for (let k = 0; k < K; k++) {
      const u = ((k + this.beltPh) % K) / K, x = x0 + u * mw, y = y0 + mf.loIn(u)
      g.fillStyle = 'rgba(120,28,60,0.55)'; g.fillRect(x, y - tb, 2.6, tb + 2); g.fillStyle = 'rgba(255,205,220,0.4)'; g.fillRect(x + 3, y - tb + 1, 2, tb * 0.5)
    }
    g.beginPath(); for (let i = 0; i <= 64; i++) g.lineTo(lensX(i), y0 + mf.loIn(i / 64) - tb); g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,225,235,0.5)'; g.stroke()
    for (const c of this.chips) { g.globalAlpha = clamp(c.life * 2, 0, 1); g.fillStyle = c.col; g.fillRect(c.x - 1.8, c.y - 1.8, 3.6, 3.6) }
    g.globalAlpha = 1
    g.restore()
    g.drawImage(this.lips, x0 - 8, y0, mw + 16, mh)
  }
}

// ── small things to draw with ──────────────────────────────────────────────────
function iron(g, x0, y0, x1, y1) {
  const gr = g.createLinearGradient(x0, y0, x1 === x0 && y1 === y0 ? x1 + 1 : x1, y1)
  gr.addColorStop(0, C.ironL); gr.addColorStop(0.5, C.ironM); gr.addColorStop(1, C.ironD)
  return gr
}

function bronze(g, x0, y0, x1, y1) {
  const gr = g.createLinearGradient(x0, y0, x1 === x0 && y1 === y0 ? x1 + 1 : x1, y1)
  gr.addColorStop(0, C.bronL); gr.addColorStop(0.35, C.bronM); gr.addColorStop(0.6, C.bronD); gr.addColorStop(0.85, C.bronM); gr.addColorStop(1, C.bronL)
  return gr
}

function rivet(g, x, y, r, kind) {
  const rg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r)
  if (kind === 'bronze') { rg.addColorStop(0, '#f6d890'); rg.addColorStop(0.5, C.bronM); rg.addColorStop(1, '#2e1a06') }
  else { rg.addColorStop(0, '#8d8a96'); rg.addColorStop(0.5, '#3c3a44'); rg.addColorStop(1, '#0a090c') }
  g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill()
}

// a two-strand plait in bronze, over and under, along a band (x, y) .. (x + len, y + h)
function plait(g, x, y, len, h) {
  const yc = y + h / 2, amp = h * 0.32, k = Math.PI / 15, nseg = Math.floor(len / 15)
  g.save(); g.beginPath(); g.rect(x, y, len, h); g.clip()
  g.fillStyle = '#0a090c'; g.fillRect(x, y, len, h)
  g.lineCap = 'butt'
  for (const pass of [0, 1]) for (let m = 0; m < nseg; m++) for (let s = 0; s < 2; s++) {
    const over = (m + s) % 2 === 0
    if ((pass === 1) !== over) continue
    g.beginPath()
    for (let i = 0; i <= 10; i++) { const px = x + m * 15 + i * 1.5; g.lineTo(px, yc + (s ? -1 : 1) * amp * Math.sin(k * (px - x))) }
    g.lineWidth = h * 0.46; g.strokeStyle = '#050405'; g.stroke()
    g.lineWidth = h * 0.3; g.strokeStyle = bronze(g, 0, yc - amp, 0, yc + amp); g.stroke()
    g.lineWidth = 1; g.strokeStyle = 'rgba(255,235,170,0.5)'; g.stroke()
  }
  g.restore()
  g.lineWidth = 1.2; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeRect(x, y, len, h)
}

// a domed bronze boss with a triskele cut in it
function boss(g, x, y, Rr) {
  const rg = g.createRadialGradient(x - Rr * 0.3, y - Rr * 0.35, 1, x, y, Rr); rg.addColorStop(0, C.bronL); rg.addColorStop(0.55, C.bronM); rg.addColorStop(1, '#2e1a06')
  g.fillStyle = rg; g.beginPath(); g.arc(x, y, Rr, 0, 7); g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#000'; g.stroke()
  g.save(); g.translate(x, y); g.lineWidth = 1.7; g.strokeStyle = 'rgba(30,15,3,0.85)'; g.lineCap = 'round'
  for (let a = 0; a < 3; a++) {
    g.save(); g.rotate(a * Math.PI * 2 / 3); g.beginPath()
    for (let i = 0; i <= 24; i++) { const u = i / 24, th = u * Math.PI * 1.7, rr = Rr * 0.75 * u; g.lineTo(Math.cos(th) * rr * 0.5 + Rr * 0.28 * (1 - u * 0.2), Math.sin(th) * rr * 0.5) }
    g.stroke(); g.restore()
  }
  g.restore()
}

// the faces in the window: inlaid bronze on black, a mask each. The machine has never seen one; it is working from hearsay.
const FACES = {
  //          eyes open L,R   brows [inner, outer] L,R (+ down)      pupils dx,dy  mouth
  sleep: { e: [0, 0], bL: [-0.02, -0.03], bR: [-0.02, -0.03], p: [0, 0], m: 'flat' },
  sneer: { e: [0.5, 0.9], bL: [0.07, 0.02], bR: [-0.03, -0.12], p: [-0.3, 0], m: 'smirk' },
  frown: { e: [0.65, 0.65], bL: [0.1, -0.03], bR: [0.1, -0.03], p: [0, 0.1], m: 'down' },
  leer: { e: [0.5, 0.5], bL: [-0.07, -0.1], bR: [-0.07, -0.1], p: [-0.35, -0.1], m: 'grin' },
  glee: { e: [1, 1], bL: [-0.1, -0.12], bR: [-0.1, -0.12], p: [0, 0], m: 'open' },
  scorn: { e: [0.45, 0.45], bL: [-0.08, -0.1], bR: [0.02, 0.06], p: [0.1, -0.5], m: 'pout' },
  fury: { e: [0.7, 0.7], bL: [0.14, -0.05], bR: [0.14, -0.05], p: [0, 0], m: 'bared' },
  pain: { e: [0, 0], bL: [-0.12, 0.02], bR: [-0.12, 0.02], p: [0, 0], m: 'wave', x: true },
}

function drawFace(g, kind, cx, cy, s, t) {
  const F = FACES[kind] || FACES.sleep, w = s * 0.86
  g.save(); g.translate(cx, cy); g.lineJoin = 'round'; g.lineCap = 'round'
  // the mask: a helm of a face, with a chin
  g.beginPath(); g.roundRect(-w / 2, -s / 2, w, s * 0.74, [s * 0.3, s * 0.3, s * 0.08, s * 0.08])
  g.moveTo(-w * 0.4, s * 0.2); g.lineTo(-w * 0.17, s / 2); g.lineTo(w * 0.17, s / 2); g.lineTo(w * 0.4, s * 0.2)
  const fg = g.createLinearGradient(-w / 2, -s / 2, w / 2, s / 2); fg.addColorStop(0, '#3a2410'); fg.addColorStop(1, '#150c05')
  g.fillStyle = fg; g.fill(); g.lineWidth = 2; g.strokeStyle = C.line; g.stroke()
  g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -s * 0.1); g.lineTo(-s * 0.03, s * 0.07); g.lineTo(s * 0.03, s * 0.07); g.stroke()       // the nose
  // eyes, brows
  for (const side of [-1, 1]) {
    const ex = side * w * 0.21, ey = -s * 0.14, op = F.e[side < 0 ? 0 : 1], b = side < 0 ? F.bL : F.bR
    const ew = w * 0.17
    g.strokeStyle = C.line; g.lineWidth = 1.8
    if (op <= 0.02) {
      g.beginPath()
      if (F.x) { g.moveTo(ex - ew * 0.8, ey - ew * 0.5); g.lineTo(ex + ew * 0.8, ey + ew * 0.5); g.moveTo(ex - ew * 0.8, ey + ew * 0.5); g.lineTo(ex + ew * 0.8, ey - ew * 0.5) }
      else { g.moveTo(ex - ew, ey); g.quadraticCurveTo(ex, ey + ew * 0.5, ex + ew, ey) }
      g.stroke()
    } else {
      const eh = ew * 0.9 * op
      g.beginPath(); g.moveTo(ex - ew, ey); g.quadraticCurveTo(ex, ey - eh * 1.4, ex + ew, ey); g.quadraticCurveTo(ex, ey + eh * 1.1, ex - ew, ey); g.closePath()
      g.fillStyle = '#e8dfc0'; g.fill(); g.stroke()
      g.fillStyle = '#1a0b05'; g.beginPath(); g.arc(ex + F.p[0] * ew, ey + F.p[1] * ew * 0.6, ew * (kind === 'glee' ? 0.5 : 0.36), 0, 7); g.fill()
    }
    // brow: from the inner end (by the nose) to the outer
    g.lineWidth = 2.6; g.strokeStyle = C.hi; g.beginPath()
    g.moveTo(ex - side * ew * 1.1, ey - s * 0.12 + b[0] * s); g.lineTo(ex + side * ew * 1.2, ey - s * 0.12 + b[1] * s); g.stroke()
  }
  // the mouth
  g.lineWidth = 2.2; g.strokeStyle = C.line; const my = s * 0.28, mw = w * 0.4
  const teeth = (n, y0, y1, x0, x1) => { g.lineWidth = 1.2; for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke() } }
  g.beginPath()
  switch (F.m) {
    case 'flat': g.moveTo(-mw * 0.7, my); g.lineTo(mw * 0.7, my); g.stroke(); break
    case 'smirk': g.moveTo(-mw, my - s * 0.04); g.quadraticCurveTo(0, my + s * 0.06, mw * 0.8, my + s * 0.02); g.stroke(); g.fillStyle = '#e8dfc0'; g.fillRect(-mw * 0.55, my, 3.5, 5); break
    case 'down': g.moveTo(-mw, my + s * 0.06); g.quadraticCurveTo(0, my - s * 0.07, mw, my + s * 0.06); g.stroke(); break
    case 'pout': g.ellipse(mw * 0.15, my, mw * 0.28, s * 0.05, 0, 0, 7); g.stroke(); break
    case 'wave': for (let i = 0; i <= 20; i++) { const x = -mw + 2 * mw * i / 20; g.lineTo(x, my + Math.sin(i * 1.3 + t * 8) * s * 0.03) } g.stroke(); break
    case 'grin': g.moveTo(-mw * 1.1, my - s * 0.02); g.quadraticCurveTo(0, my + s * 0.2, mw * 1.1, my - s * 0.02); g.closePath(); g.fillStyle = '#0a0405'; g.fill(); g.stroke(); g.save(); g.clip(); g.strokeStyle = '#e8dfc0'; teeth(8, my - s * 0.03, my + s * 0.04, -mw, mw); g.restore(); break
    case 'open': g.ellipse(0, my + s * 0.02, mw * 0.85, s * 0.11, 0, 0, 7); g.fillStyle = '#0a0405'; g.fill(); g.stroke(); g.save(); g.clip(); g.strokeStyle = '#e8dfc0'; teeth(7, my - s * 0.1, my - s * 0.02, -mw, mw); g.restore(); break
    case 'bared': g.moveTo(-mw, my - s * 0.02); g.lineTo(mw, my - s * 0.02); g.lineTo(mw * 0.8, my + s * 0.07); g.lineTo(-mw * 0.8, my + s * 0.07); g.closePath(); g.fillStyle = '#0a0405'; g.fill(); g.stroke(); g.save(); g.clip(); g.strokeStyle = '#e8dfc0'; teeth(6, my - s * 0.02, my + s * 0.07, -mw, mw); g.restore(); break
  }
  g.restore()
}

// the badge's icon while the machine has this to eat: a hazelnut, in gold lines
function nutGlyph() {
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d'); g.strokeStyle = 'rgb(224,190,120)'; g.fillStyle = 'rgba(176,122,58,0.5)'; g.lineWidth = 3.5; g.lineJoin = 'round'
  g.beginPath(); g.ellipse(32, 36, 14, 16, 0, 0, Math.PI * 2); g.fill(); g.stroke()
  g.beginPath(); g.ellipse(32, 23, 11, 6, 0, 0, Math.PI * 2); g.stroke()                                   // the cup
  g.beginPath(); g.moveTo(32, 17); g.lineTo(34, 9); g.stroke()
  return c
}

// the badge's icon while the reels run: a ratchet wheel with its pawl dropped in, in gold lines
function pawlGlyph() {
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d'); g.strokeStyle = 'rgb(224,190,120)'; g.lineWidth = 3.2; g.lineJoin = 'round'; g.lineCap = 'round'
  g.beginPath()
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + 0.3, b = (i + 0.8) / 10 * Math.PI * 2 + 0.3; g.lineTo(32 + Math.cos(a) * 13, 38 + Math.sin(a) * 13); g.lineTo(32 + Math.cos(a) * 19, 38 + Math.sin(a) * 19); g.lineTo(32 + Math.cos(b) * 13, 38 + Math.sin(b) * 13) }
  g.closePath(); g.stroke()
  g.beginPath(); g.arc(32, 38, 4, 0, 7); g.stroke()
  g.beginPath(); g.moveTo(52, 8); g.lineTo(38, 15); g.lineTo(34, 22); g.stroke()                         // the pawl, coming down
  return c
}

// the badge's icon at the door: three reels in a frame, red lines, all of it well inside the moon's round
function slotGlyph() {
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d'); g.strokeStyle = 'rgb(255,110,80)'; g.lineCap = 'round'; g.lineJoin = 'round'
  g.lineWidth = 3.5; g.beginPath(); g.roundRect(14, 13, 36, 28, 4); g.stroke()                      // the frame
  g.lineWidth = 2.5; for (const x of [26, 38]) { g.beginPath(); g.moveTo(x, 13); g.lineTo(x, 41); g.stroke() }   // the reels
  g.lineWidth = 3; g.beginPath(); g.ellipse(32, 49, 8, 4, 0, 0, Math.PI * 2); g.stroke()             // the mouth, under
  return c
}

// ── the signs (placeholders) ───────────────────────────────────────────────────
function drawCard(g, name, w, h) {
  const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#1a0f08'); bg.addColorStop(1, '#0a0605')
  g.fillStyle = bg; g.fillRect(0, 0, w, h)
  g.save(); g.translate(w / 2, h / 2); g.strokeStyle = 'rgba(200,150,70,0.09)'; g.lineWidth = 3                       // a sunburst behind it, for the 1950s
  for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * h * 0.2, Math.sin(a) * h * 0.2); g.lineTo(Math.cos(a) * w, Math.sin(a) * w); g.stroke() }
  g.restore()
  g.lineWidth = 3; g.strokeStyle = C.line; g.strokeRect(5, 5, w - 10, h - 10)
  if (['closed', 'peek', 'left', 'right'].includes(name)) drawEye(g, name, w / 2, h * 0.52, Math.min(w * 0.62, h * 1.5))
  else drawFace(g, name, w / 2, h / 2, h * 0.86, 0)
  g.font = '9px monospace'; g.textAlign = 'center'; g.fillStyle = 'rgba(200,150,70,0.5)'; g.fillText('[PLACEHOLDER: ' + name + ']', w / 2, h - 20)
}

function drawEye(g, kind, cx, cy, w) {
  const open = { closed: 0, peek: 0.12, left: 0.36, right: 0.36 }[kind], look = kind === 'left' ? -1 : kind === 'right' ? 1 : 0
  g.save(); g.translate(cx, cy); g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = C.line
  if (open === 0) {                                                                           // shut: a heavy lid, lashes hanging
    const sag = w * 0.2
    g.beginPath(); g.moveTo(-w / 2, 0); g.quadraticCurveTo(0, sag * 2, w / 2, 0); g.lineWidth = 5; g.stroke()
    for (let i = -5; i <= 5; i++) { const u = 0.5 + i / 12, y = 2 * (1 - u) * u * sag * 2, x = -w / 2 + u * w; g.beginPath(); g.moveTo(x, y); g.lineTo(x + i * 1.4, y + w * 0.07); g.lineWidth = 2; g.stroke() }
  } else {
    const h = w * open, a = () => { g.beginPath(); g.moveTo(-w / 2, 0); g.quadraticCurveTo(0, -h * 2.4, w / 2, 0); g.quadraticCurveTo(0, h * 2, -w / 2, 0); g.closePath() }
    g.save(); a(); g.clip()
    g.fillStyle = '#e8dfc0'; g.fillRect(-w / 2, -h * 2, w, h * 4)
    g.fillStyle = '#7a3a10'; g.beginPath(); g.arc(look * w * 0.17, 0, w * 0.15, 0, 7); g.fill()
    g.fillStyle = '#0a0405'; g.beginPath(); g.arc(look * w * 0.17, 0, w * 0.07, 0, 7); g.fill()
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(look * w * 0.17 - w * 0.04, -w * 0.045, w * 0.025, 0, 7); g.fill()
    g.restore()
    a(); g.lineWidth = 4; g.stroke()
    g.beginPath(); g.moveTo(-w * 0.5, -h * 1.9 - 4); g.quadraticCurveTo(0, -h * 3.6 - 6, w * 0.5, -h * 1.9 - 4); g.lineWidth = 3; g.strokeStyle = C.hi; g.stroke()      // the brow
  }
  g.restore()
}

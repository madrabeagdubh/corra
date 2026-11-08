// js/game/ui/inventory/inventoryView.js
//
// The pack, drawn in the DOM under the menu hub's tab bar: the champion with
// six slots about them (Orm), the brat spread edge to edge below with the pack
// laid out on it (Agam), and a strip of ground either side of the brooch
// (Ar an talamh).
//
// Tap a thing: a small card rises with its name, what it does and a button
// or two. Drag a thing: onto a slot to put it on, about the brat to arrange it,
// onto the ground to drop it, onto the champion to wear it or drink it.
// Whatever is done is said back in one short Irish line ("Tá an bogha agam."),
// so the player handles orm / agam / i mo... by moving things, not by being told.
//
// Laid out on a fixed 390-wide stage scaled to the phone; the brat is then
// stretched to the screen's full width, and the ground strip follows the real
// brooch at the bottom.

import { GameSettings } from '../../settings/gameSettings.js'
import { SoundBoard } from '../../systems/soundBoard.js'
import { FONTS } from '../../systems/gameTypography.js'
import { PACK_START, PACK_COLS, PACK_ROWS } from './inventory.js'
import { saveInventory } from './inventoryStore.js'
import { itemArt } from './itemArt.js'

// ── Words ────────────────────────────────────────────────────────────────────
// The slot names and the phrase each one makes. Change them here.
export const SLOT_WORDS = {
  head:      { ga: 'Ceann',   en: 'head',       onGa: 'ar mo cheann',   onEn: 'on my head' },
  neck:      { ga: 'Muineál', en: 'neck',       onGa: 'ar mo mhuineál', onEn: 'on my neck' },
  armor:     { ga: 'Corp',    en: 'body',       onGa: 'orm',            onEn: 'on me' },
  finger:    { ga: 'Méar',    en: 'finger',     onGa: 'ar mo mhéar',    onEn: 'on my finger' },
  rightHand: { ga: 'Deasóg',  en: 'right hand', onGa: 'i mo dheasóg',   onEn: 'in my right hand' },
  leftHand:  { ga: 'Ciotóg',  en: 'left hand',  onGa: 'i mo chiotóg',   onEn: 'in my left hand' },
}
const SECTION = {
  orm:    { ga: 'Orm',          en: 'on me' },
  agam:   { ga: 'Agam',         en: 'with me' },
  talamh: { ga: 'Ar an talamh', en: 'on the ground' },
}
const BUTTONS = {
  equip:   { ga: 'Feisteáil', en: 'Equip' },
  unequip: { ga: 'Bain díom', en: 'Take off' },
  drink:   { ga: 'Ól',        en: 'Drink' },
  eat:     { ga: 'Ith',       en: 'Eat' },
  drop:    { ga: 'Scaoil',    en: 'Drop' },
  take:    { ga: 'Tóg',       en: 'Take' },
}
const STAT_WORDS = { health: 'Sláinte', attack: 'Ionsaí', defense: 'Cosaint', healAmount: 'Sláinte' }
const NO_ROOM = { ga: 'Níl spás sa bhrat.', en: "There's no room in the cloak." }

// ── Look ─────────────────────────────────────────────────────────────────────
const CLOTH  = '#5a1e1a'          // madder red; woad #1f3550, moss #34442a, saffron #6b5631
const GOLD   = '#d4af37'
const IRISH  = '#e8dfc0'
const ENG    = '#a0c8a0'
const GOOD   = '#b8e09a'
const BAD    = '#e0a090'

// type sizes on the stage (scaled with it)
const T = { section: 23, slot: 19, slotEn: 12, stat: 18, statLabel: 13, line: 22, lineEn: 13, qty: 15 }

const STAGE_W = 390
const SLOT = 60
const SLOT_ROWS = [4, 99, 194]
const SLOT_X = { L: 10, R: STAGE_W - 10 - SLOT }
const SLOT_POS = {                                  // [x, y, side]
  head:      [SLOT_X.L, SLOT_ROWS[0], 'L'], neck:     [SLOT_X.R, SLOT_ROWS[0], 'R'],
  armor:     [SLOT_X.L, SLOT_ROWS[1], 'L'], finger:   [SLOT_X.R, SLOT_ROWS[1], 'R'],
  rightHand: [SLOT_X.L, SLOT_ROWS[2], 'L'], leftHand: [SLOT_X.R, SLOT_ROWS[2], 'R'],
}
const FIG = { x: 80, y: 30, w: 230, h: 214 }       // the champion stands in here (and things dropped on it are worn)
const STATS_Y = 248
const AGAM_Y = 294
const BRAT_Y = 322
const BAND = 13                                     // the woven border at the brat's top and bottom
const CELL_H = 68
const BRAT_H = BAND + PACK_ROWS * CELL_H + BAND
const LINE_Y = BRAT_Y + BRAT_H + 14
const STAGE_H = LINE_Y + 52

// where each slot's thread meets the champion, as a fraction of the sprite box
const BODY = {
  head: [0.5, 0.2], neck: [0.5, 0.33], armor: [0.5, 0.5],
  finger: [0.64, 0.64], rightHand: [0.35, 0.64], leftHand: [0.65, 0.67],
}
// each slot rings its own harp note when something goes on (D pentatonic)
const NOTE = { rightHand: 293.66, leftHand: 369.99, armor: 440, neck: 493.88, head: 587.33, finger: 659.25 }
const GLYPH = {
  head:   'M12 4a5 5 0 1 1 0 10a5 5 0 1 1 0-10z M5 21c1-4 4-6 7-6s6 2 7 6',
  neck:   'M5 8c0 6.5 3 10 7 10s7-3.5 7-10 M3.5 8h3 M17.5 8h3',
  armor:  'M8 4l4 2 4-2 3 3-2 3v10H7V10L5 7z',
  finger: 'M12 10a5 5 0 1 1 0 10a5 5 0 1 1 0-10z M10 7l2-2.5 2 2.5',
  rightHand: 'M9 20v-7l-2-3 1-1 2 2V5a1 1 0 0 1 2 0v5-6a1 1 0 0 1 2 0v6-5a1 1 0 0 1 2 0v6-4a1 1 0 0 1 2 0v8c0 3-2 5-5 5z',
  leftHand:  'M15 20v-7l2-3-1-1-2 2V5a1 1 0 0 0-2 0v5-6a1 1 0 0 0-2 0v6-5a1 1 0 0 0-2 0v6-4a1 1 0 0 0-2 0v8c0 3 2 5 5 5z',
}
const STAT_ICON = {
  health:  'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  attack:  'M5 19l10-10 M13 5h6v6 M7 14l3 3',
  defense: 'M12 3l7 3v5c0 5-3.5 8-7 10c-3.5-2-7-5-7-10V6z',
}
const SCROLL_ICON = 'M7 4h10v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M9 8h6 M9 12h6 M9 16h3'

// grey slate behind it all
const SLATE_CSS = 'background-color:#1b1d1e;background-image:radial-gradient(ellipse at 30% 12%,rgba(255,255,255,0.05),transparent 60%),repeating-linear-gradient(12deg,rgba(255,255,255,0.025) 0 1px,transparent 1px 7px),repeating-linear-gradient(-28deg,rgba(0,0,0,0.2) 0 1px,transparent 1px 11px);'
const SLOT_CSS = 'background:rgba(0,0,0,0.32);border:1px solid rgba(212,175,55,0.4);box-shadow:inset 0 2px 6px rgba(0,0,0,0.6);'
const GROUND_IDLE = 'rgba(0,0,0,0.22)'
const GROUND_HOT  = 'rgba(212,175,55,0.10)'

const SVGNS = 'http://www.w3.org/2000/svg'
const ROOT_ID = 'corra-inventory'

function el(tag, css = '', parent = null, attrs = null) {
  const e = document.createElement(tag)
  if (css) e.style.cssText = css
  if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  if (parent) parent.appendChild(e)
  return e
}
function svgIcon(d, size, stroke, width = 1.6, opacity = 1) {
  const s = document.createElementNS(SVGNS, 'svg')
  s.setAttribute('width', size); s.setAttribute('height', size)
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true')
  s.style.cssText = 'display:block;flex-shrink:0;pointer-events:none;'
  const p = document.createElementNS(SVGNS, 'path')
  p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', stroke)
  p.setAttribute('stroke-width', width); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round')
  p.setAttribute('stroke-opacity', opacity)
  s.appendChild(p)
  return s
}
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s
const englishOpacity = () => GameSettings.englishOpacity ?? 0.5

export default class InventoryView {
  constructor(scene, { player, onChange = null }) {
    this.scene    = scene
    this.player   = player
    this.onChange = onChange
    this.isOpen   = false
    this._icons   = new Map()
    this._drag    = null
    this._card    = null
    this.cellW    = 72

    document.getElementById(ROOT_ID)?.remove()      // one left behind by an earlier scene
    this._build()

    this._onLang   = () => this.applyLanguage()
    this._onResize = () => { if (this.isOpen) { this._layout(); this.render() } }
    // a phone put away or a page closed mid-scene keeps what is in the pack
    this._onHide   = () => { if (document.visibilityState !== 'visible') saveInventory(this.inv) }
    window.addEventListener('englishOpacityChange', this._onLang)
    window.addEventListener('resize', this._onResize)
    window.addEventListener('pagehide', this._onHide)
    document.addEventListener('visibilitychange', this._onHide)
    scene.events?.once?.('shutdown', () => this.destroy())
    scene.events?.once?.('destroy', () => this.destroy())
  }

  get inv() { return this.player?.inventory }

  // ── Building ───────────────────────────────────────────────────────────────

  _build() {
    const root = this.root = el('div', [
      'position:fixed;left:0;top:54px;width:100%;bottom:0;',
      'z-index:1000001;display:none;opacity:0;transition:opacity 0.18s ease;',
      'overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;',
      `font-family:${FONTS.irish};color:${IRISH};`,
      SLATE_CSS,
    ].join(''), document.body, { id: ROOT_ID })
    root.addEventListener('contextmenu', e => e.preventDefault())

    const stage = this.stage = el('div', `position:absolute;left:0;top:0;width:${STAGE_W}px;height:${STAGE_H}px;transform-origin:0 0;`, root)

    // Orm, over the champion's head
    const orm = this._sectionLabel(stage, SECTION.orm, 0, 2, T.section)
    orm.style.left = '0'; orm.style.width = `${STAGE_W}px`; orm.style.justifyContent = 'center'

    // the champion, with a shadow at their feet; the whole box takes things dropped on it
    this.figure = el('div', `position:absolute;left:${FIG.x}px;top:${FIG.y}px;width:${FIG.w}px;height:${FIG.h}px;`, stage)
    this.feet = el('div', 'position:absolute;width:120px;height:22px;border-radius:50%;background:radial-gradient(ellipse at center,rgba(0,0,0,0.55),rgba(0,0,0,0) 70%);pointer-events:none;', stage)
    this.champImg = el('img', [
      'position:absolute;image-rendering:pixelated;pointer-events:none;',
      'filter:drop-shadow(0 4px 4px rgba(0,0,0,0.5));',
    ].join(''), stage, { alt: '' })

    this.leaders = document.createElementNS(SVGNS, 'svg')
    this.leaders.setAttribute('width', STAGE_W); this.leaders.setAttribute('height', 300)
    this.leaders.setAttribute('aria-hidden', 'true')
    this.leaders.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;'
    stage.appendChild(this.leaders)

    // the six slots
    this.slotEls = {}
    for (const [name, [x, y]] of Object.entries(SLOT_POS)) {
      const box = el('div', [
        `position:absolute;left:${x}px;top:${y}px;width:${SLOT}px;height:${SLOT}px;box-sizing:border-box;`,
        'display:flex;align-items:center;justify-content:center;border-radius:12px;',
        SLOT_CSS,
        'transition:box-shadow 0.12s,opacity 0.12s,background 0.12s;',
      ].join(''), stage, { 'data-slot': name })
      const label = el('div', `position:absolute;left:${x + SLOT / 2 - 55}px;top:${y + SLOT + 2}px;width:110px;text-align:center;pointer-events:none;transition:opacity 0.12s;`, stage)
      el('div', `font-size:${T.slot}px;line-height:1.05;color:${IRISH};`, label).textContent = SLOT_WORDS[name].ga
      el('div', `font-family:${FONTS.english};font-size:${T.slotEn}px;line-height:1.15;color:${ENG};`, label, { 'data-en': '1' }).textContent = SLOT_WORDS[name].en
      this.slotEls[name] = { box, label }
      box.addEventListener('pointerdown', e => this._press(e, { kind: 'slot', name }))
    }

    // stats, under the champion's feet
    this.statsRow = el('div', `position:absolute;left:${FIG.x + 14}px;top:${STATS_Y}px;width:${FIG.w - 28}px;display:flex;justify-content:space-around;pointer-events:none;`, stage)

    this._sectionLabel(stage, SECTION.agam, 14, AGAM_Y, T.section)

    // the brat: its width is set in _layout, edge to edge
    const cloth = this.cloth = el('div', [
      `position:absolute;top:${BRAT_Y}px;height:${BRAT_H}px;box-sizing:border-box;`,
      `background-color:${CLOTH};`,
      'background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.05) 0 2px,transparent 2px 5px),repeating-linear-gradient(-45deg,rgba(0,0,0,0.14) 0 2px,transparent 2px 5px),radial-gradient(ellipse at 38% 28%,rgba(255,240,210,0.10),transparent 70%);',
      'box-shadow:0 10px 18px rgba(0,0,0,0.55),0 -2px 8px rgba(0,0,0,0.35),inset 0 0 34px rgba(0,0,0,0.4);',
    ].join(''), stage)
    const band = `position:absolute;left:0;right:0;height:${BAND - 5}px;background:repeating-linear-gradient(90deg,rgba(212,175,55,0.55) 0 3px,transparent 3px 7px),linear-gradient(rgba(0,0,0,0.25),rgba(0,0,0,0.25));`
    el('div', band + 'top:3px;', cloth)
    el('div', band + 'bottom:3px;', cloth)
    this.fringe = el('div', `position:absolute;top:${BRAT_Y + BRAT_H}px;height:10px;background:repeating-linear-gradient(90deg,${CLOTH} 0 2px,transparent 2px 5px);opacity:0.9;`, stage)

    this.pack = el('div', `position:absolute;top:${BRAT_Y + BAND}px;height:${PACK_ROWS * CELL_H}px;`, stage)
    this.cellEls = []
    for (let i = 0; i < PACK_ROWS * PACK_COLS; i++) {
      this.cellEls.push(el('div', [
        'position:absolute;box-sizing:border-box;',
        'border:1px dashed rgba(240,220,180,0.22);border-radius:3px;transition:background 0.08s,border-color 0.08s;',
      ].join(''), this.pack))
    }
    this.packItems = el('div', 'position:absolute;inset:0;', this.pack)
    this.pack.addEventListener('pointerdown', e => {
      if (e.target === this.pack || this.cellEls.includes(e.target) || e.target === this.packItems) this.closeCard()
    })

    // the line that says what happened
    this.line = el('div', `position:absolute;left:12px;top:${LINE_Y}px;width:${STAGE_W - 24}px;text-align:center;pointer-events:none;transition:opacity 0.25s;`, stage)
    this.lineGa = el('div', `font-size:${T.line}px;line-height:1.15;color:${IRISH};`, this.line)
    this.lineEn = el('div', `font-family:${FONTS.english};font-size:${T.lineEn}px;color:${ENG};margin-top:3px;`, this.line, { 'data-en': '1' })

    // the ground, either side of the brooch
    this.ground = el('div', `position:absolute;left:0;width:100%;bottom:0;border-top:1px solid rgba(255,255,255,0.06);background:${GROUND_IDLE};transition:background 0.1s;`, root)
    this._sectionLabel(this.ground, SECTION.talamh, 14, 6, 19, 0.9)
    this.groundItems = el('div', 'position:absolute;inset:0;', this.ground)

    // the card
    this.cardShade = el('div', 'position:absolute;inset:0;background:rgba(0,0,0,0.3);display:none;', root)
    this.cardShade.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.closeCard() })
    this.cardEl = el('div', [
      'position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;padding:12px 18px 16px;',
      'background:#121314;border-top:1px solid rgba(212,175,55,0.55);border-bottom:1px solid rgba(212,175,55,0.25);border-radius:16px 16px 0 0;',
      'box-shadow:0 -10px 24px rgba(0,0,0,0.6);display:none;flex-direction:column;gap:12px;',
      'transform:translateY(30%);opacity:0;transition:transform 0.2s ease-out,opacity 0.15s;overflow-y:auto;',
    ].join(''), root)
    this.cardEl.addEventListener('pointerdown', e => e.stopPropagation())
  }

  _sectionLabel(parent, words, x, y, size, alpha = 1) {
    const w = el('div', `position:absolute;left:${x}px;top:${y}px;display:flex;align-items:baseline;gap:7px;pointer-events:none;opacity:${alpha};`, parent)
    el('span', `font-size:${size}px;color:${GOLD};`, w).textContent = words.ga
    el('span', `font-family:${FONTS.english};font-size:${Math.round(size * 0.55)}px;color:${ENG};`, w, { 'data-en': '1' }).textContent = words.en
    return w
  }

  // ── Opening and closing ───────────────────────────────────────────────────

  open() {
    this.isOpen = true
    this.root.style.display = 'block'
    this._layout()
    this.render()
    const hand = this.inv?.getEquippedItem('rightHand')
    if (hand) this._say(this._sentence(hand, { kind: 'slot', name: 'rightHand' }))
    else this._say(null)
    requestAnimationFrame(() => { this.root.style.opacity = '1' })
  }

  close() {
    this.isOpen = false
    this._cancelDrag()
    this.closeCard(true)
    saveInventory(this.inv)
    this.root.style.opacity = '0'
    setTimeout(() => { if (!this.isOpen) this.root.style.display = 'none' }, 200)
  }

  destroy() {
    if (this._destroyed) return
    this._destroyed = true
    this._cancelDrag()
    window.removeEventListener('englishOpacityChange', this._onLang)
    window.removeEventListener('resize', this._onResize)
    window.removeEventListener('pagehide', this._onHide)
    document.removeEventListener('visibilitychange', this._onHide)
    this.root?.remove()
  }

  // Fit the stage between the tab bar and the brooch; the ground takes the
  // brooch's band down to the status bar. The brat runs to both screen edges.
  _layout() {
    const tabs   = document.getElementById('gameMenuHub')?.firstElementChild?.getBoundingClientRect()
    const status = document.getElementById('status-bar')?.getBoundingClientRect()
    const brooch = document.getElementById('dpad-root')?.getBoundingClientRect()
    const top    = tabs && tabs.height ? tabs.bottom : 54
    const bottom = status && status.height ? status.top : window.innerHeight
    this.root.style.top = `${top}px`
    this.root.style.bottom = `${window.innerHeight - bottom}px`
    this.root.style.height = 'auto'

    const W = window.innerWidth
    const H = bottom - top
    let groundTop = brooch && brooch.height ? brooch.top - top : H - 130
    groundTop = Math.max(H * 0.62, Math.min(H - 70, groundTop))
    this.ground.style.top = `${groundTop}px`
    this._broochSpan = brooch && brooch.width ? [brooch.left - 6, brooch.right + 6] : [W / 2 - 60, W / 2 + 60]
    // the card rises from the top of the ground, so the brooch never covers it
    this.cardEl.style.bottom = `${H - groundTop}px`
    this.cardEl.style.maxHeight = `${Math.round(groundTop * 0.9)}px`

    const s = Math.min(W / STAGE_W, (groundTop - 2) / STAGE_H)
    this.scale = s
    const offX = Math.max(0, (W - STAGE_W * s) / 2)
    this.stage.style.transform = `scale(${s})`
    this.stage.style.left = `${offX}px`

    // the brat, in stage units, from the screen's left edge to its right
    const bl = -offX / s, bw = W / s
    Object.assign(this.cloth.style, { left: `${bl}px`, width: `${bw}px` })
    Object.assign(this.fringe.style, { left: `${bl + 4}px`, width: `${bw - 8}px` })
    const pad = 10
    const packW = bw - pad * 2
    this.cellW = packW / PACK_COLS
    Object.assign(this.pack.style, { left: `${bl + pad}px`, width: `${packW}px` })
    this.cellEls.forEach((c, i) => {
      const row = Math.floor(i / PACK_COLS), col = i % PACK_COLS
      Object.assign(c.style, {
        left: `${col * this.cellW + 3}px`, top: `${row * CELL_H + 3}px`,
        width: `${this.cellW - 6}px`, height: `${CELL_H - 6}px`,
      })
    })
  }

  // ── Drawing ────────────────────────────────────────────────────────────────

  render() {
    if (!this.inv) return
    this._renderChampion()
    this._renderSlots()
    this._renderPack()
    this._renderGround()
    this._renderStats()
    this.applyLanguage()
  }

  _renderChampion() {
    const spr = this.player?.sprite
    const frame = spr?.frame
    const src = frame?.source?.image
    if (!src || !frame.cutWidth) return
    const box = { w: FIG.w - 10, h: FIG.h - 20 }
    const k = Math.max(1, Math.floor(Math.min(box.w / frame.cutWidth, box.h / frame.cutHeight)))
    const w = frame.cutWidth * k, h = frame.cutHeight * k
    const key = `champ|${spr.texture.key}|${frame.name}|${k}`
    if (this._champKey !== key) {
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false
      g.drawImage(src, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, w, h)
      this.champImg.src = c.toDataURL()
      this._champKey = key
    }
    const x = FIG.x + (FIG.w - w) / 2, y = Math.max(FIG.y - 6, FIG.y + (FIG.h - 30 - h) / 2)
    Object.assign(this.champImg.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` })
    Object.assign(this.feet.style, { left: `${x + w / 2 - 60}px`, top: `${y + h - 14}px` })
    this._champRect = { x, y, w, h }
    this._renderLeaders()
  }

  _renderLeaders() {
    const r = this._champRect
    if (!r) return
    this.leaders.innerHTML = ''
    for (const [name, [x, y, side]] of Object.entries(SLOT_POS)) {
      const [fx, fy] = BODY[name]
      const bx = r.x + r.w * fx, by = r.y + r.h * fy
      const sx = side === 'L' ? x + SLOT : x, sy = y + SLOT / 2
      const mx = side === 'L' ? sx + 22 : sx - 22
      const p = document.createElementNS(SVGNS, 'path')
      p.setAttribute('d', `M${sx} ${sy} L${mx} ${sy} L${bx} ${by}`)
      p.setAttribute('fill', 'none'); p.setAttribute('stroke', GOLD); p.setAttribute('stroke-opacity', '0.3'); p.setAttribute('stroke-width', '1')
      this.leaders.appendChild(p)
      const dot = document.createElementNS(SVGNS, 'circle')
      dot.setAttribute('cx', bx); dot.setAttribute('cy', by); dot.setAttribute('r', '2.5')
      dot.setAttribute('fill', GOLD); dot.setAttribute('fill-opacity', '0.55')
      this.leaders.appendChild(dot)
    }
  }

  _renderSlots() {
    const inv = this.inv
    const right = inv.getEquippedItem('rightHand')
    for (const [name, { box }] of Object.entries(this.slotEls)) {
      box.innerHTML = ''
      let item = inv.getEquippedItem(name)
      let echo = false
      if (!item && name === 'leftHand' && right?.twoHanded) { item = right; echo = true }
      if (item) {
        const ic = this._icon(item)
        const k = Math.min(48 / ic.w, 48 / ic.h)
        el('img', `width:${ic.w * k}px;height:${ic.h * k}px;image-rendering:pixelated;pointer-events:none;filter:drop-shadow(0 2px 2px rgba(0,0,0,0.6));${echo ? 'opacity:0.3;' : ''}`, box, { src: ic.url, alt: '' })
      } else {
        box.appendChild(svgIcon(GLYPH[name], 28, IRISH, 1.4, 0.25))
      }
      box.setAttribute('aria-label', SLOT_WORDS[name].onGa + (item && !echo ? ': ' + (item.nameGa || '') : ''))
    }
  }

  _renderPack() {
    const inv = this.inv
    const cw = this.cellW
    this.packItems.innerHTML = ''
    this._packEls = {}
    for (let i = PACK_START; i < PACK_START + PACK_COLS * PACK_ROWS; i++) {
      const item = inv.slots[i]
      if (!item) continue
      const { row, col } = inv.packCell(i)
      const h = item.h === 2 ? 2 : 1
      const wrap = el('div', [
        `position:absolute;left:${col * cw}px;top:${row * CELL_H}px;width:${cw}px;height:${h * CELL_H}px;`,
        'display:flex;align-items:center;justify-content:center;border-radius:6px;transition:opacity 0.1s;',
      ].join(''), this.packItems, { 'data-index': i, 'aria-label': item.nameGa || item.id })
      const ic = this._icon(item)
      const k = this._packScale(item, ic)
      el('img', `width:${ic.w * k}px;height:${ic.h * k}px;image-rendering:pixelated;pointer-events:none;filter:drop-shadow(0 3px 2px rgba(0,0,0,0.55));`, wrap, { src: ic.url, alt: '' })
      if (item.stackable && (item.quantity || 1) > 1) {
        el('span', [
          'position:absolute;right:7px;bottom:3px;pointer-events:none;',
          `font-family:${FONTS.english};font-size:${T.qty}px;font-weight:700;color:#f2ead0;`,
          'text-shadow:0 0 3px #000,0 1px 0 #000;',
        ].join(''), wrap).textContent = item.quantity
      }
      if (this._card?.src?.kind === 'pack' && this._card.src.index === i) {
        wrap.style.boxShadow = `inset 0 0 0 2px ${GOLD},0 0 18px rgba(212,175,55,0.5)`
        wrap.style.background = 'rgba(212,175,55,0.12)'
      }
      wrap.addEventListener('pointerdown', e => this._press(e, { kind: 'pack', index: i }))
      this._packEls[i] = wrap
    }
  }

  _packScale(item, ic) {
    return item.h === 2
      ? Math.min((2 * CELL_H - 14) / ic.h, (this.cellW - 12) / ic.w)
      : Math.min(52 / ic.w, 52 / ic.h, (CELL_H - 10) / ic.h)
  }

  // things lying within a step of the champion
  _nearbyGround() {
    const sc = this.scene, p = this.player
    const ts = sc.tileSize ?? 48
    if (!sc.droppedItems?.length || !p) return []
    const px = Math.floor(p.logicalX / ts), py = Math.floor(p.logicalY / ts)
    return sc.droppedItems.filter(d => d?.active && d.itemData &&
      Math.abs(Math.floor(d._logicalX / ts) - px) <= 1 && Math.abs(Math.floor(d._logicalY / ts) - py) <= 1)
  }

  _renderGround() {
    this.groundItems.innerHTML = ''
    const near = this._nearbyGround()
    const W = window.innerWidth
    const [bl, br] = this._broochSpan || [W / 2 - 60, W / 2 + 60]
    const zones = [[12, bl - 4], [br + 4, W - 12]]
    const bandH = this.ground.getBoundingClientRect().height || 120
    const size = Math.max(36, Math.min(54, bandH * 0.42))
    let n = 0
    near.forEach((d, i) => {
      const z = zones[i % 2]
      const slot = Math.floor(i / 2)
      const x = i % 2 === 0 ? z[1] - (slot + 1) * (size + 8) : z[0] + slot * (size + 8)
      if (x < z[0] - 1 || x + size > z[1] + 1) return
      const ic = this._icon(d.itemData)
      const k = Math.min(size / ic.w, size / ic.h)
      const wrap = el('div', [
        `position:absolute;left:${x}px;top:${Math.max(30, bandH * 0.5 - size / 2 + 8)}px;width:${size}px;height:${size}px;`,
        'display:flex;align-items:center;justify-content:center;',
        `transform:rotate(${[-14, 9, -6, 12][n++ % 4]}deg);`,
      ].join(''), this.groundItems, { 'aria-label': d.itemData.nameGa || '' })
      el('img', `width:${ic.w * k}px;height:${ic.h * k}px;image-rendering:pixelated;pointer-events:none;filter:drop-shadow(0 3px 2px rgba(0,0,0,0.6));`, wrap, { src: ic.url, alt: '' })
      wrap.addEventListener('pointerdown', e => this._press(e, { kind: 'ground', ref: d }))
    })
  }

  // icon and number, the Irish word under it
  _renderStats(preview = null) {
    const p = this.player
    this.statsRow.innerHTML = ''
    const rows = [
      ['health', `${Math.round(p?.currentHP ?? 0)}/${Math.round(p?.maxHP ?? 0)}`],
      ['attack', `${p?.stats?.attack ?? 0}`],
      ['defense', `${p?.stats?.defense ?? 0}`],
    ]
    for (const [k, v] of rows) {
      const col = el('div', 'display:flex;flex-direction:column;align-items:center;gap:1px;', this.statsRow)
      const top = el('div', 'display:flex;align-items:center;gap:5px;', col)
      top.appendChild(svgIcon(STAT_ICON[k], 17, GOLD, 1.8))
      el('span', `font-family:${FONTS.english};font-size:${T.stat}px;font-weight:700;color:${IRISH};`, top).textContent = v
      const dv = preview?.[k]
      if (dv) el('span', `font-family:${FONTS.english};font-size:${T.stat - 2}px;font-weight:700;color:${dv > 0 ? GOOD : BAD};`, top).textContent = (dv > 0 ? '+' : '−') + Math.abs(dv)
      el('div', `font-size:${T.statLabel + 2}px;line-height:1;color:${IRISH};opacity:0.85;`, col).textContent = STAT_WORDS[k]
    }
  }

  applyLanguage() {
    const op = englishOpacity()
    this.root.querySelectorAll('[data-en]').forEach(e => {
      e.style.opacity = op
      e.style.visibility = op > 0.05 ? 'visible' : 'hidden'
    })
    this.root.querySelectorAll('[data-btn-ga]').forEach(b => {
      const en = op >= 0.5
      b.textContent = en ? b.dataset.btnEn : b.dataset.btnGa
      b.style.fontFamily = en ? FONTS.english : FONTS.irish
      b.style.fontSize = en ? '18px' : '23px'
    })
  }

  // ── Icons ──────────────────────────────────────────────────────────────────

  // A data URL for an item's art: from the item sheet by itemGid, else from a
  // loaded texture; tall items stood upright (the sheet draws them diagonal).
  _icon(item) {
    const tall = item.h === 2
    const key = `${item.itemGid}|${item.spriteKey}|${item.art}|${item.tint}|${tall}`
    if (this._icons.has(key)) return this._icons.get(key)
    let src = item.itemGid ? this.scene.itemSheet?.getCanvas?.(item.itemGid) : null
    if (!src && item.spriteKey && this.scene.textures?.exists(item.spriteKey)) src = this.scene.textures.get(item.spriteKey).getSourceImage()
    if (!src && item.art) src = itemArt(item.art)
    let out
    if (!src) {
      const c = document.createElement('canvas'); c.width = c.height = 16
      const g = c.getContext('2d'); g.fillStyle = '#' + (item.color ?? 0x888888).toString(16).padStart(6, '0'); g.fillRect(3, 3, 10, 10)
      src = c
    }
    const sw = src.width, sh = src.height
    const S = Math.max(1, Math.round(48 / Math.max(sw, sh)))
    if (tall) {
      const d = Math.ceil(Math.hypot(sw, sh) * S) + 2
      const c = document.createElement('canvas'); c.width = c.height = d
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false
      g.translate(d / 2, d / 2); g.rotate(((item.tallRotate ?? 45) * Math.PI) / 180)
      g.drawImage(src, -sw * S / 2, -sh * S / 2, sw * S, sh * S)
      out = this._crop(c)
    } else {
      const c = document.createElement('canvas'); c.width = sw * S; c.height = sh * S
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false
      g.drawImage(src, 0, 0, sw * S, sh * S)
      out = { canvas: c }
    }
    if (item.tint) this._tint(out.canvas, item.tint)
    const res = { url: out.canvas.toDataURL(), w: out.canvas.width, h: out.canvas.height }
    this._icons.set(key, res)
    return res
  }

  _crop(c) {
    const g = c.getContext('2d')
    const { data, width, height } = g.getImageData(0, 0, c.width, c.height)
    let x0 = width, y0 = height, x1 = -1, y1 = -1
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
    }
    if (x1 < 0) return { canvas: c }
    const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1
    o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height)
    return { canvas: o }
  }

  _tint(c, tint) {
    const g = c.getContext('2d')
    const im = g.getImageData(0, 0, c.width, c.height), d = im.data
    const tr = (tint >> 16) & 255, tg = (tint >> 8) & 255, tb = tint & 255
    for (let i = 0; i < d.length; i += 4) { d[i] = d[i] * tr / 255; d[i + 1] = d[i + 1] * tg / 255; d[i + 2] = d[i + 2] * tb / 255 }
    g.putImageData(im, 0, 0)
  }

  // ── Words for what happened ────────────────────────────────────────────────

  _def(item) {
    const many = item.stackable && (item.quantity || 1) > 1
    const ga = (many && item.defGaPl) || item.defGa || item.nameGa || ''
    const en = (many && item.defEnPl) || item.defEn || (item.nameEn ? 'the ' + item.nameEn.toLowerCase() : '')
    return { ga, en }
  }

  _sentence(item, where) {
    const d = this._def(item)
    if (where.kind === 'slot') {
      const w = SLOT_WORDS[where.name]
      const verbEn = d.en.startsWith('the ') && d.en.endsWith('s') && item.stackable ? 'are' : 'is'
      return { ga: `Tá ${d.ga} ${w.onGa}.`, en: `${cap(d.en)} ${verbEn} ${w.onEn}.` }
    }
    if (where.kind === 'ground') {
      const plural = item.stackable && (item.quantity || 1) > 1
      return { ga: `Tá ${d.ga} ar an talamh.`, en: `${cap(d.en)} ${plural ? 'are' : 'is'} on the ground.` }
    }
    return { ga: `Tá ${d.ga} agam.`, en: `I have ${d.en}.` }
  }

  _say(s) {
    clearTimeout(this._sayT)
    if (!s) { this.lineGa.textContent = ''; this.lineEn.textContent = ''; return }
    this.lineGa.textContent = s.ga
    this.lineEn.textContent = s.en
    // a long line steps down a size rather than wrap into the ground
    this.lineGa.style.fontSize = `${s.ga.length > 32 ? T.line - 3 : T.line}px`
    this.line.style.opacity = '0.35'
    this._sayT = setTimeout(() => { this.line.style.opacity = '1' }, 30)
  }

  // ── Sound ──────────────────────────────────────────────────────────────────

  _pluck(freq, vol = 0.09) {
    const ctx = SoundBoard.ctx(this.scene)
    if (!ctx) return
    try {
      const now = ctx.currentTime + 0.005
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000; lp.connect(ctx.destination)
      for (const [mult, type, k, dur] of [[1, 'triangle', 1, 1.4], [2, 'sine', 0.3, 0.7]]) {
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.type = type; o.frequency.setValueAtTime(freq * mult, now)
        g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(vol * k, now + 0.006)
        g.gain.exponentialRampToValueAtTime(0.0008, now + dur)
        o.connect(g); g.connect(lp); o.start(now); o.stop(now + dur + 0.05)
      }
    } catch (_) {}
  }

  // cloth: a short soft thump; lower for the ground
  _thump(low = false) {
    const ctx = SoundBoard.ctx(this.scene)
    if (!ctx) return
    try {
      const now = ctx.currentTime, len = Math.floor(ctx.sampleRate * 0.09)
      const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / ctx.sampleRate * (low ? 45 : 70))
      const src = ctx.createBufferSource(); src.buffer = buf
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low ? 380 : 900
      const g = ctx.createGain(); g.gain.value = low ? 0.5 : 0.32
      src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(now)
    } catch (_) {}
  }

  _lift() { SoundBoard.playWeb('HIT_TRACKER_TICK', this.scene, { volume: 0.12, freq: 640 }) }

  // ── Pressing: a tap opens the card, a drag moves the thing ──────────────────

  _itemAt(src) {
    if (src.kind === 'pack') return this.inv.slots[src.index]
    if (src.kind === 'slot') {
      const it = this.inv.getEquippedItem(src.name)
      if (!it && src.name === 'leftHand') {
        const r = this.inv.getEquippedItem('rightHand')
        if (r?.twoHanded) { src.name = 'rightHand'; return r }
      }
      return it
    }
    if (src.kind === 'ground') return src.ref?.itemData
    return null
  }

  _press(e, src) {
    if (this._drag || e.button > 0) return
    e.stopPropagation()
    const item = this._itemAt(src)
    if (!item) { this.closeCard(); return }
    const target = e.currentTarget
    try { target.setPointerCapture(e.pointerId) } catch (_) {}
    const st = { src, item, target, x0: e.clientX, y0: e.clientY, moved: false, id: e.pointerId }
    const move = (ev) => {
      if (ev.pointerId !== st.id) return
      if (!st.moved && Math.hypot(ev.clientX - st.x0, ev.clientY - st.y0) > 9) { st.moved = true; this._startDrag(st) }
      if (st.moved) this._dragMove(ev.clientX, ev.clientY)
    }
    const up = (ev) => {
      if (ev.pointerId !== st.id) return
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', up)
      if (ev.type === 'pointercancel') { this._cancelDrag(); return }
      if (st.moved) this._dragEnd(ev.clientX, ev.clientY)
      else this._toggleCard(src, item)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
  }

  _startDrag(st) {
    this.closeCard()
    const ic = this._icon(st.item)
    const k = this._packScale(st.item, ic) * (this.scale || 1) * 1.1
    const fw = ic.w * k, fh = ic.h * k
    const float = el('img', [
      'position:fixed;left:0;top:0;z-index:1000009;pointer-events:none;image-rendering:pixelated;',
      `width:${fw}px;height:${fh}px;`,
      'filter:drop-shadow(0 16px 10px rgba(0,0,0,0.65));transform-origin:50% 80%;',
    ].join(''), document.body, { src: ic.url, alt: '' })
    this._drag = { ...st, float, fw, fh, hover: null }
    st.target.style.opacity = '0.2'
    this._lift()
    this._markTargets(st.item)
  }

  // light the slots this item can go to; dim the rest
  _markTargets(item) {
    for (const [name, { box, label }] of Object.entries(this.slotEls)) {
      const ok = item.equipSlot === name
      box.style.opacity = ok ? '1' : '0.32'
      label.style.opacity = ok ? '1' : '0.32'
      box.style.boxShadow = ok ? '0 0 0 1px rgba(212,175,55,0.7)' : ''
    }
  }

  _clearTargets() {
    for (const { box, label } of Object.values(this.slotEls)) {
      box.style.opacity = ''; label.style.opacity = ''; box.style.boxShadow = ''; box.style.background = ''
    }
    this.cellEls.forEach(c => { c.style.background = ''; c.style.borderColor = 'rgba(240,220,180,0.22)' })
    this.ground.style.background = GROUND_IDLE
    this.figure.style.background = ''
  }

  // What is under the finger: a slot, a pack cell, the figure, the ground, or nothing.
  _hit(x, y) {
    const pad = 10 * (this.scale || 1)
    for (const [name, { box }] of Object.entries(this.slotEls)) {
      const r = box.getBoundingClientRect()
      if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) return { kind: 'slot', name }
    }
    const pr = this.pack.getBoundingClientRect()
    if (x >= pr.left && x < pr.right && y >= pr.top && y < pr.bottom) {
      const col = Math.min(PACK_COLS - 1, Math.floor((x - pr.left) / (pr.width / PACK_COLS)))
      const row = Math.min(PACK_ROWS - 1, Math.floor((y - pr.top) / (pr.height / PACK_ROWS)))
      return { kind: 'pack', cell: this.inv.packIndex(row, col) }
    }
    const fr = this.figure.getBoundingClientRect()
    if (x >= fr.left && x <= fr.right && y >= fr.top && y <= fr.bottom) return { kind: 'figure' }
    const gr = this.ground.getBoundingClientRect()
    if (y >= gr.top) {
      const [bl, br] = this._broochSpan || [0, 0]
      if (x < bl || x > br || y < gr.top + 20) return { kind: 'ground' }
    }
    return null
  }

  _dragMove(x, y) {
    const d = this._drag
    if (!d) return
    // held a little above the finger, so the finger doesn't hide it
    d.float.style.transform = `translate(${x - d.fw / 2}px, ${y - d.fh * 0.85 - 18 * (this.scale || 1)}px) rotate(8deg)`
    d.hover = this._hit(x, y - d.fh * 0.35)
    this._clearTargetsHover()
    const h = d.hover, item = d.item
    let preview = null
    if (h?.kind === 'slot' && item.equipSlot === h.name) {
      this.slotEls[h.name].box.style.boxShadow = `0 0 0 2px ${GOLD},0 0 22px rgba(212,175,55,0.6)`
      this.slotEls[h.name].box.style.background = 'rgba(212,175,55,0.14)'
      preview = this._statDelta(item, h.name)
    } else if (h?.kind === 'figure' && (item.equipSlot || item.actions?.includes('drink'))) {
      this.figure.style.background = 'radial-gradient(ellipse at 50% 55%,rgba(212,175,55,0.16),rgba(212,175,55,0) 65%)'
      if (item.equipSlot) preview = this._statDelta(item, item.equipSlot)
    } else if (h?.kind === 'pack') {
      const fits = this._packTarget(h.cell)
      const cells = fits.cells || [h.cell]
      for (const c of cells) {
        const ce = this.cellEls[c - PACK_START]
        if (!ce) continue
        ce.style.background = fits.ok ? 'rgba(184,224,154,0.14)' : 'rgba(224,160,144,0.14)'
        ce.style.borderColor = fits.ok ? 'rgba(184,224,154,0.6)' : 'rgba(224,160,144,0.5)'
      }
    } else if (h?.kind === 'ground' && d.src.kind !== 'ground') {
      this.ground.style.background = GROUND_HOT
    }
    if (JSON.stringify(preview) !== JSON.stringify(d.preview)) { d.preview = preview; this._renderStats(preview) }
  }

  _clearTargetsHover() {
    const d = this._drag
    for (const [name, { box }] of Object.entries(this.slotEls)) {
      const ok = d && d.item.equipSlot === name
      box.style.boxShadow = ok ? '0 0 0 1px rgba(212,175,55,0.7)' : ''
      box.style.background = ''
    }
    this.cellEls.forEach(c => { c.style.background = ''; c.style.borderColor = 'rgba(240,220,180,0.22)' })
    this.ground.style.background = GROUND_IDLE
    this.figure.style.background = ''
  }

  // Would the dragged item go in at this cell? (and which cells it would cover)
  _packTarget(cell) {
    const d = this._drag, inv = this.inv, item = d.item
    const from = d.src.kind === 'pack' ? inv.anchorAt(d.src.index) : (d.src.kind === 'slot' ? inv.equipSlots[d.src.name] : -1)
    const ignore = from >= 0 ? [from] : []
    const at = inv.canPlace(item, cell, ignore) ? cell : (item.h === 2 && inv.canPlace(item, cell - PACK_COLS, ignore) ? cell - PACK_COLS : -1)
    if (at !== -1) return { ok: true, cells: inv.cellsFor(item, at) }
    const there = inv.anchorAt(cell)
    if (there !== -1 && d.src.kind === 'pack') {
      const other = inv.slots[there]
      if (other?.stackable && other.id === item.id) return { ok: other.quantity < other.maxStack, cells: inv.cellsFor(other, there) }
      return { ok: true, cells: inv.cellsFor(other, there) }        // a swap; moveItem decides
    }
    return { ok: false, cells: [cell] }
  }

  _statDelta(item, slotName) {
    const inv = this.inv
    const now = inv.calculateEquippedStats()
    const eq = inv.getEquippedItems()
    eq[slotName] = item
    if (item.twoHanded) eq.leftHand = null
    if (slotName === 'leftHand' && eq.rightHand?.twoHanded) eq.rightHand = null
    const then = inv.calculateEquippedStats(eq)
    const out = {}
    for (const k of ['health', 'attack', 'defense']) if ((then[k] || 0) !== (now[k] || 0)) out[k] = (then[k] || 0) - (now[k] || 0)
    return Object.keys(out).length ? out : null
  }

  _dragEnd(x, y) {
    const d = this._drag
    if (!d) return
    this._dragMove(x, y)
    const h = d.hover
    let done = false
    if (h?.kind === 'slot') done = this._equip(d.src, d.item, h.name)
    else if (h?.kind === 'figure') {
      if (d.item.equipSlot) done = this._equip(d.src, d.item, d.item.equipSlot)
      else if (d.item.actions?.includes('drink')) done = this._drink(d.src, d.item)
    }
    else if (h?.kind === 'pack') done = this._toPack(d.src, d.item, h.cell)
    else if (h?.kind === 'ground') done = d.src.kind === 'ground' ? false : this._drop(d.src, d.item)

    if (done) {
      d.float.remove()
      this._drag = null
      this._clearTargets()
      this._changed()
    } else {
      // back where it came from
      const r = d.target.getBoundingClientRect()
      d.float.style.transition = 'transform 0.16s ease-in'
      d.float.style.transform = `translate(${r.left + r.width / 2 - d.fw / 2}px, ${r.top + r.height / 2 - d.fh / 2}px)`
      const dd = d
      this._drag = null
      setTimeout(() => { dd.float.remove(); dd.target.style.opacity = '' }, 170)
      this._clearTargets()
      this._renderStats()
    }
  }

  _cancelDrag() {
    const d = this._drag
    if (!d) return
    d.float.remove()
    d.target.style.opacity = ''
    this._drag = null
    this._clearTargets()
  }

  // ── Doing things ───────────────────────────────────────────────────────────

  _equip(src, item, slotName) {
    const inv = this.inv
    if (item.equipSlot !== slotName) return false
    let ok = false
    if (src.kind === 'slot') ok = src.name === slotName
    else if (src.kind === 'pack') ok = inv.equipFrom(item, slotName, inv.anchorAt(src.index))
    else if (src.kind === 'ground') {
      ok = inv.equipFrom(item, slotName, -1)
      if (ok) this._takeFromGround(src.ref)
    }
    if (!ok) { this._say(NO_ROOM); return false }
    this._pluck(NOTE[slotName] || 440)
    this._say(this._sentence(item, { kind: 'slot', name: slotName }))
    return true
  }

  _toPack(src, item, cell) {
    const inv = this.inv
    let ok = false
    if (src.kind === 'pack') {
      ok = inv.moveItem(src.index, cell)
      if (ok && inv.anchorAt(src.index) === inv.anchorAt(cell)) return true    // dropped where it was: nothing said
    } else if (src.kind === 'slot') ok = inv.unequipItem(src.name, cell)
    else if (src.kind === 'ground') {
      const land = inv.canPlace(item, cell) ? cell : (item.h === 2 && inv.canPlace(item, cell - PACK_COLS) ? cell - PACK_COLS : -1)
      ok = inv.addItem(item, land) !== false
      if (ok) this._takeFromGround(src.ref)
    }
    if (!ok) return false
    this._thump()
    this._say(this._sentence(item, { kind: 'pack' }))
    return true
  }

  _drink(src, item) {
    const inv = this.inv
    if (src.kind === 'ground') return false
    const at = src.kind === 'pack' ? inv.anchorAt(src.index) : inv.equipSlots[src.name]
    const heal = item.stats?.healAmount || 0
    if (heal) this.player.heal?.(heal)
    inv.removeOne(at)
    this._pluck(392, 0.07)
    const d = this._def({ ...item, quantity: 1 })
    this._say({ ga: `D'ól mé ${d.ga}.`, en: `I drank ${d.en}.` })
    return true
  }

  // eaten: one from the stack (what a hazelnut from the well does for you is still to come)
  _eat(src, item) {
    const inv = this.inv
    if (src.kind === 'ground') return false
    const at = src.kind === 'pack' ? inv.anchorAt(src.index) : inv.equipSlots[src.name]
    inv.removeOne(at)
    this._pluck(330, 0.06)
    const d = this._def({ ...item, quantity: 1 })
    this._say({ ga: `D'ith mé ${d.ga}.`, en: `I ate ${d.en}.` })
    this.scene.events?.emit?.('itemEaten', item.id)
    return true
  }

  _drop(src, item) {
    const inv = this.inv
    if (!this.scene.spawnItemOnMap) return false
    if (!item.actions?.includes('drop') && !item.actions?.includes('throw')) return false   // the currach, and the like
    let taken = null
    if (src.kind === 'pack') taken = inv.removeItem(src.index)
    else if (src.kind === 'slot') {
      taken = inv.getEquippedItem(src.name)
      inv.slots[inv.equipSlots[src.name]] = null
    }
    if (!taken) return false
    this.scene.spawnItemOnMap(taken)
    this._thump(true)
    this._say(this._sentence(taken, { kind: 'ground' }))
    return true
  }

  _takeFromGround(dropped) {
    const list = this.scene.droppedItems
    const i = list?.indexOf(dropped)
    if (i > -1) list.splice(i, 1)
    dropped?.destroy?.()
  }

  _pickUp(dropped) {
    const item = dropped.itemData
    if (this.inv.addItem(item) === false) { this._say(NO_ROOM); return false }
    this._takeFromGround(dropped)
    this._thump()
    this._say(this._sentence(item, { kind: 'pack' }))
    return true
  }

  // after anything changes: stats, the champion's look, the save, the screen
  _changed() {
    this.player?.updateStatsFromEquipment?.()
    this.scene.perspectiveGround?.forceRedraw?.()
    saveInventory(this.inv)
    this.onChange?.()
    this.render()
  }

  // ── The card ───────────────────────────────────────────────────────────────

  get cardOpen() { return !!this._card }

  _toggleCard(src, item) {
    if (this._card && this._card.item === item) { this.closeCard(); return }
    this.openCard(src, item)
  }

  openCard(src, item) {
    this._card = { src, item }
    const c = this.cardEl
    c.innerHTML = ''
    el('div', 'align-self:center;width:40px;height:4px;border-radius:2px;background:rgba(232,223,192,0.25);flex-shrink:0;', c)

    // head: picture, names, what it gives
    const head = el('div', 'display:flex;gap:14px;align-items:center;', c)
    const frame = el('div', 'width:68px;height:68px;flex-shrink:0;border-radius:10px;border:1px solid rgba(212,175,55,0.45);background:rgba(212,175,55,0.06);display:flex;align-items:center;justify-content:center;', head)
    const ic = this._icon(item)
    const k = Math.min(56 / ic.w, 56 / ic.h)
    el('img', `width:${ic.w * k}px;height:${ic.h * k}px;image-rendering:pixelated;`, frame, { src: ic.url, alt: '' })
    const names = el('div', 'display:flex;flex-direction:column;gap:3px;min-width:0;', head)
    el('div', `font-size:28px;line-height:1.05;color:${IRISH};`, names).textContent = item.nameGa || ''
    el('div', `font-family:${FONTS.english};font-size:15px;color:${ENG};`, names, { 'data-en': '1' }).textContent = item.nameEn || ''
    const chips = el('div', 'display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:2px;', names)
    for (const [k2, v] of Object.entries(item.stats || {})) {
      if (!STAT_WORDS[k2] || !v) continue
      const ch = el('div', 'display:flex;align-items:center;gap:5px;', chips)
      ch.appendChild(svgIcon(STAT_ICON[k2 === 'healAmount' ? 'health' : k2], 16, GOLD, 1.8))
      el('span', `font-size:17px;color:${IRISH};`, ch).textContent = STAT_WORDS[k2]
      el('span', `font-family:${FONTS.english};font-size:16px;font-weight:700;color:${GOOD};`, ch).textContent = (v > 0 ? '+' : '') + v
    }

    // the sentence
    const where = src.kind === 'slot' ? { kind: 'slot', name: src.name } : { kind: src.kind }
    const s = this._sentence(item, where)
    const sw = el('div', '', c)
    el('div', `font-size:22px;line-height:1.2;color:${IRISH};`, sw).textContent = s.ga
    el('div', `font-family:${FONTS.english};font-size:14px;color:${ENG};margin-top:2px;`, sw, { 'data-en': '1' }).textContent = s.en

    // buttons
    const acts = []
    if (src.kind === 'ground') acts.push('take')
    else {
      if (item.equipSlot) acts.push(src.kind === 'slot' ? 'unequip' : 'equip')
      if (item.actions?.includes('drink')) acts.push('drink')
      if (item.actions?.includes('eat')) acts.push('eat')
      if (item.actions?.includes('drop') || item.actions?.includes('throw')) acts.push('drop')
    }
    const row = el('div', 'display:flex;gap:10px;', c)
    acts.forEach((a, i) => {
      const b = el('button', [
        'flex:1;height:52px;border-radius:8px;cursor:pointer;touch-action:none;',
        i === 0 ? `border:1.5px solid ${GOLD};background:rgba(212,175,55,0.16);color:#f2e6b8;` : `border:1px solid rgba(212,175,55,0.45);background:transparent;color:${IRISH};`,
      ].join(''), row, { 'data-btn-ga': BUTTONS[a].ga, 'data-btn-en': BUTTONS[a].en })
      b.addEventListener('pointerup', (e) => { e.stopPropagation(); this._act(a) })
    })
    const hasDesc = !!(item.descGa || item.descEn)
    if (hasDesc) {
      const more = el('button', 'width:58px;height:52px;flex-shrink:0;border-radius:8px;border:1px solid rgba(212,175,55,0.3);background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;', row, { 'aria-label': 'Tuilleadh' })
      more.appendChild(svgIcon(SCROLL_ICON, 24, GOLD, 1.6))
      const desc = el('div', 'display:none;overflow-y:auto;touch-action:pan-y;max-height:38vh;padding-right:4px;', c)
      const gaL = (item.descGa || '').split('\n'), enL = (item.descEn || '').split('\n')
      for (let i = 0; i < Math.max(gaL.length, enL.length); i++) {
        if (gaL[i]?.trim()) el('div', `font-size:20px;line-height:1.3;color:${IRISH};margin-top:${i ? 10 : 0}px;`, desc).textContent = gaL[i].trim()
        if (enL[i]?.trim()) el('div', `font-family:${FONTS.english};font-style:italic;font-size:15px;line-height:1.3;color:${ENG};`, desc, { 'data-en': '1' }).textContent = enL[i].trim()
      }
      more.addEventListener('pointerup', (e) => {
        e.stopPropagation()
        desc.style.display = desc.style.display === 'none' ? 'block' : 'none'
      })
    }

    this.cardShade.style.display = 'block'
    this.line.style.visibility = 'hidden'
    c.style.display = 'flex'
    requestAnimationFrame(() => { c.style.transform = 'translateY(0)'; c.style.opacity = '1' })
    SoundBoard.playWeb('HIT_TRACKER_TICK', this.scene, { volume: 0.12, freq: 520 })
    this._renderPack()
    this.applyLanguage()
  }

  closeCard(instant = false) {
    if (!this._card) return
    this._card = null
    this.cardShade.style.display = 'none'
    this.line.style.visibility = ''
    this.cardEl.style.transform = 'translateY(30%)'
    this.cardEl.style.opacity = '0'
    const hide = () => { if (!this._card) this.cardEl.style.display = 'none' }
    if (instant) hide(); else setTimeout(hide, 200)
    if (this.isOpen) this._renderPack()
  }

  _act(action) {
    const card = this._card
    if (!card) return
    const { src, item } = card
    let ok = false
    if (action === 'equip') ok = this._equip(src, item, item.equipSlot)
    else if (action === 'unequip') {
      ok = this.inv.unequipItem(src.name)
      if (ok) { this._thump(); this._say(this._sentence(item, { kind: 'pack' })) }
      else this._say(NO_ROOM)
    }
    else if (action === 'drink') ok = this._drink(src, item)
    else if (action === 'eat') ok = this._eat(src, item)
    else if (action === 'drop') ok = this._drop(src, item)
    else if (action === 'take') ok = this._pickUp(src.ref)
    this.closeCard()
    if (ok) this._changed()
  }
}

// thornHarp.js
// Location: js/game/scenes/locations/cave/thornHarp.js
//
// The harp at the foot of the thorn's hill (escape_tobar), and the thorn's answer to it.
//
// Stand by the harp and its badge comes up on the moon; press it and the strings are over the screen (CorraHarp). Play.
// Nothing is said. If the notes you pluck are your own tune -- the champion's theme, the one the dialogue harp has been
// plucking a fragment at a time all along -- the thorn answers: each of the first five notes draws back a twig from the
// weave across its arch, then each five after that a little more, and the light behind grows and the tree comes into
// flower. The whole of the first part, and the arch stands open (a note: it stays open). One wrong note and it all
// snaps shut again.
//
//   pitch only, any rhythm; any octave (the same letter on either string counts)
//   a repeat of the note just played is let pass (the tune's repeated notes are collapsed, as abcToStringSequence does)
//   sharps: free plucking sounds the natural, so while you are on track the harp is told to sharpen the next string if
//   your tune wants it -- a right note sounds right, a wrong one plainly wrong
//
// Where the open thorn leads (back to Tír na nÓg) is for later: for now it only stands open.

import { CorraHarp } from '../village/corraHarp.js'
import { allTunes } from '../../../systems/music/allTunes.js'
import { getTuneKeyForChampion } from '../../../systems/music/championTuneMapping.js'
import { parseAbcToMidiSequence, midiSequenceToStringIndices } from '../../../systems/music/abcToPhrase.js'
import { GameState } from '../../../systems/gameState.js'

export const THORN_NOTE = 'escape_thorn_open'
// For trying the puzzle: a row of dots over the strings, one for each note of the tune, green as each is played right
// (red, a moment, when a wrong one closes it). On for now; ?harpdots=0 hides it. Set DOTS false for the real thing.
const DOTS = true
const FIRST = 5                 // the first notes, each its own step
const STEP = 5                  // then this many to a step
const PART = 30                 // how many notes make "the first part" (a reel's A part is about this; shorter tunes: all of it)

export default class ThornHarp {
  constructor(scene, spot) {
    this.scene = scene
    this.spot = spot                                      // { x, y, radius } in tiles
    this.harp = null
    this.pos = 0                                          // notes right so far
    this.lastPc = null
    this.done = GameState.hasNote(THORN_NOTE)
    const props = scene.hewn?.props || []
    this.thorn = props.find(p => p.type === 'thorn')
    this.harpProp = props.find(p => p.type === 'harp')
    if (this.thorn) this.thorn.open = this.done ? 1 : 0
    this.want = this.thorn?.open ?? 0
    this.snapT = 0
    this.tune = this._tune()
    this._glyph = harpGlyph()
  }

  // the tune: the champion's theme, as notes on this harp's strings (each its letter, and whether it wants the sharp)
  _tune() {
    try {
      const ch = this.scene.registry?.get('selectedChampion') || window.selectedChampion
      const key = getTuneKeyForChampion(ch) || 'drowsyMaggie', abc = allTunes[key]
      if (!abc) return []
      const range = new CorraHarp(this.scene).getMidiRange()
      this._pcOf = new Map(range.available.map(e => [e.idx, e.m % 12]))
      const mapped = midiSequenceToStringIndices(parseAbcToMidiSequence(abc), null, range)
      const out = []
      for (const { idx, needsSharp } of mapped) {
        const pc = this._pcOf.get(idx), last = out[out.length - 1]
        if (last && last.pc === pc && last.sharp === needsSharp) continue
        out.push({ pc, sharp: !!needsSharp })
      }
      return out.slice(0, Math.min(PART, out.length))
    } catch (e) { console.warn('[thornHarp] no tune:', e.message); return [] }
  }

  // how far open, for so many notes right: the first five each a little, then a step for each five
  _openFor(n) {
    const T = this.tune.length; if (!T) return 0
    if (n >= T) return 1
    if (n <= FIRST) return 0.3 * n / FIRST
    const steps = Math.ceil((T - FIRST) / STEP)
    return 0.3 + 0.7 * Math.floor((n - FIRST) / STEP) / steps
  }

  _pluck({ stringIndex }) {
    if (this.done || !this.tune.length) return
    const pc = this._pcOf.get(stringIndex), want = this.tune[this.pos]
    if (pc === want.pc) {
      this.pos++; this.lastPc = pc
      this.want = this._openFor(this.pos)
      if (this.pos >= this.tune.length) { this.done = true; this.want = 1; GameState.addNote(THORN_NOTE) }
      this._dots()
    } else if (this.pos > 0 && pc === this.lastPc) {
      // the note just played, again: let it pass
    } else if (this.pos > 0) {
      this.pos = 0; this.lastPc = null; this.want = 0; this.snapT = 1        // it all snaps shut
      this.harp?.playClick?.(1)
      this._dots(true)
    }
  }

  open() {
    if (this.harp) return
    this.harp = new CorraHarp(this.scene)
    this.harp.on('pluck', (d) => this._pluck(d)).on('close', () => { this.harp = null; this._dotsEl?.remove(); this._dotsEl = null })
    this.harp.on('ready', () => this.harp?.setSharpHintFn((idx) => {
      if (this.done || !this.tune.length) return false
      const w = this.tune[this.pos]; return !!w && w.sharp && this._pcOf.get(idx) === w.pc
    }))
    this.harp.open()
    this._dots()
  }

  close() { this.harp?.close(); this.harp = null; this._dotsEl?.remove(); this._dotsEl = null }

  // the playtest dots (see DOTS)
  _dots(wrong) {
    if (!DOTS || new URLSearchParams(location.search).get('harpdots') === '0' || !this.harp) return
    let el = this._dotsEl
    if (!el) {
      el = this._dotsEl = document.createElement('div')
      el.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:1000010;display:flex;flex-wrap:wrap;justify-content:center;gap:5px;max-width:90vw;padding:6px 8px;border-radius:10px;background:rgba(0,0,0,0.35);pointer-events:none;transition:background 0.25s'
      document.body.appendChild(el)
    }
    const T = this.tune.length, on = this.done ? T : this.pos
    el.innerHTML = Array.from({ length: T }, (_, i) => `<span style="width:11px;height:11px;border-radius:50%;display:inline-block;background:${i < on ? '#3ddc5a' : 'rgba(255,255,255,0.22)'};${i === FIRST - 1 || (i >= FIRST && (i - FIRST + 1) % STEP === 0) ? 'margin-right:5px;' : ''}"></span>`).join('')
    if (wrong) { el.style.background = 'rgba(200,30,20,0.7)'; setTimeout(() => { if (this._dotsEl) this._dotsEl.style.background = 'rgba(0,0,0,0.35)' }, 450) }
  }

  // the badge on the moon while you stand by it (true: it has the moon, nothing else is offered)
  badge() {
    const s = this.scene, panel = s._encounterPanel, p = s.player
    if (!panel || !p || !this.spot) return false
    if (this.harp) return true
    const ts = s.tileSize, d = Math.hypot(p.logicalX / ts - this.spot.x, p.logicalY / ts - this.spot.y)
    if (d > (this.spot.radius ?? 2.4)) { if (panel._card?.id === 'thorn_harp') panel.clearNotify(); return false }
    panel.notify({ id: 'thorn_harp', visual: { glyph: this._glyph }, ga: '', en: '', onActivate: () => this.open() }, null)
    return true
  }

  update(delta) {
    const t = this.thorn
    if (t) {
      const tau = this.snapT > 0 ? 160 : 900
      t.open += (this.want - t.open) * (1 - Math.exp(-delta / tau))
      if (this.snapT > 0 && t.open < 0.02) this.snapT = 0
    }
    if (this.harpProp) this.harpProp.lit = (this.harpProp.lit ?? 0) + ((this.harp ? 1 : 0) - (this.harpProp.lit ?? 0)) * (1 - Math.exp(-delta / 400))
  }
}

// the badge's icon: a small harp, in gold lines -- a closed triangle on a little base, all of it well inside the moon's round
function harpGlyph() {
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d'); g.strokeStyle = 'rgb(224,190,120)'; g.lineCap = 'round'; g.lineJoin = 'round'
  g.lineWidth = 4.5; g.beginPath(); g.moveTo(38, 46); g.lineTo(19, 16); g.stroke()                       // the soundbox, leaning back from its foot
  g.lineWidth = 3.5; g.beginPath(); g.moveTo(19, 16); g.quadraticCurveTo(30, 22, 41, 13); g.stroke()     // the neck
  g.beginPath(); g.moveTo(41, 13); g.quadraticCurveTo(46, 31, 38, 46); g.stroke()                        // the forepillar, down to the foot
  // the strings, up from the soundbox to the neck, fanning a little forward: across the whole of the frame
  const neckY = (x) => { let best = 99, by = 16; for (let s = 0; s <= 1; s += 0.02) { const nx = (1 - s) ** 2 * 19 + 2 * s * (1 - s) * 30 + s * s * 41, ny = (1 - s) ** 2 * 16 + 2 * s * (1 - s) * 22 + s * s * 13; if (Math.abs(nx - x) < best) { best = Math.abs(nx - x); by = ny } } return by }
  g.lineWidth = 1.3; for (let i = 1; i <= 6; i++) { const t = i / 7, x = 19 + (38 - 19) * t, y = 16 + 30 * t, x2 = Math.min(38, x + 1 + 3 * t); g.beginPath(); g.moveTo(x, y); g.lineTo(x2, neckY(x2) + 2); g.stroke() }
  g.lineWidth = 3; g.beginPath(); g.moveTo(27, 47.5); g.lineTo(49, 47.5); g.stroke()                     // the pedestal, under the foot
  return c
}

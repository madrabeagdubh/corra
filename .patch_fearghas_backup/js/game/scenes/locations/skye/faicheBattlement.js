// faicheBattlement.js — the end-of-level sequence on the Faiche.
// Location: js/game/scenes/locations/skye/faicheBattlement.js
//
// The tournament is won. The camera climbs and draws back (the ground renderer's own view, so the
// green, the ring and the far host all stay live), and as it rises a stone parapet comes up into the
// bottom of the screen. In extreme close-up on either side of it Scáthach and Uathach look down and
// talk about the new warrior. Then the camera settles back to where it was.
//
// PLACEHOLDERS: the two portraits are crops of public/assets/npcs sprites (muireann = Scáthach,
// fearghus = Uathach) and the lines are English in both slots. Swap PORTRAITS / LINES when the
// art and the Irish exist.
//
// It is a DOM overlay (above the game canvas, below the caption), so it needs nothing from the
// ground renderer and cannot upset the scene underneath. Tapping does nothing until it ends.

import { GameState } from '../../../systems/gameState.js'
import { INK } from '../../../ui/speakers.js'
import { DialogueHarp } from '../../../systems/music/dialogueHarp.js'

export const BATTLEMENT_SEEN = 'faiche_battlement_seen'

const PORTRAITS = {
  scathach: { src: 'assets/npcs/muireann.png', crop: [14, 6, 42, 34], side: 'left',  color: '#c8a8ff', voice: ['dallan', 'Ador'] },
  uathach:  { src: 'assets/npcs/fearghus.png', crop: [14, 6, 42, 34], side: 'right', color: INK.uathach, voice: ['seanchai', 'Dmix'] },
}
// the whole talk is played to the advisor's tune: one portrait key decides the tune, whoever is speaking
const ADVISOR_TUNE = '/assets/npcs/fearghus.png'
const RISE_MS = 4600, FALL_MS = 2400, RIG_H = 0.18
const CAM = { z: 0.5, py: -0.2 }      // how far the camera climbs (the ground view's zoom out, and its look to the north)
const L = (en, ga = en) => ({ ga, en })
// ONE conversation, read as one continuous piece in the game's own dialogue scroll (which marks who is speaking):
// a single node of scripted turns. Replace with the real dialogue when it is written: any node list the encounter
// panel understands works here (see tighConaill.js's data for the format).
const DIALOGUES = name => [{
  exchange: [
    { say: 'Who is that warrior down there?', sayEn: 'Who is that warrior down there?', replyGa: `Why, that is ${name}, madam.`, replyEn: `Why, that is ${name}, madam.` },
    { say: 'Hm. Keep your eyes on them.', sayEn: 'Hm. Keep your eyes on them.', replyGa: 'Yes, madam.', replyEn: 'Yes, madam.' },
  ],
}]

export default class FaicheBattlement {
  constructor(scene, opts = {}) {
    this.scene = scene
    this.onDone = opts.onDone || (() => {})
    this.alive = true
    this.timers = []
    this.voices = {}
    if (!opts.force && GameState.hasNote(BATTLEMENT_SEEN)) { this._end(); return }
    GameState.addNote(BATTLEMENT_SEEN)
    this._build()
  }

  _later(ms, fn) { this.timers.push(setTimeout(() => this.alive && fn(), ms)) }

  get pv() { return this.scene._pgrView }

  _build() {
    const root = this.root = document.createElement('div')
    root.id = 'faiche-battlement'
    root.style.cssText = 'position:fixed;inset:0;z-index:1000001;overflow:hidden;pointer-events:none'
    const style = document.createElement('style')
    style.textContent = `
      #faiche-battlement .bt-rig { position:absolute; left:0; right:0; bottom:0; height:18%; }
      #faiche-battlement .bt-stone { position:absolute; inset:0; width:100%; height:100%; image-rendering:pixelated; will-change:transform; filter:drop-shadow(0 -5px 9px rgba(10,14,12,.45)); }
      #faiche-battlement .bt-face { position:absolute; bottom:-8%; width:66vmin; height:66vmin; image-rendering:pixelated; will-change:transform; transition: filter .6s; filter:drop-shadow(0 -3px 7px rgba(10,14,12,.5)); }
      #faiche-battlement .bt-face.left  { left:-14vmin; }
      #faiche-battlement .bt-face.right { right:-14vmin; }
    `
    root.appendChild(style)
    const rig = document.createElement('div'); rig.className = 'bt-rig'
    rig.appendChild(this._stoneWork())
    this.faces = {}
    for (const [id, p] of Object.entries(PORTRAITS)) {          // in front of the wall, leaning on it and looking over
      const cv = document.createElement('canvas'); cv.width = p.crop[2]; cv.height = p.crop[3]
      cv.className = `bt-face ${p.side}`
      const img = new Image()
      img.onload = () => { const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(img, ...p.crop, 0, 0, cv.width, cv.height) }
      img.src = p.src
      rig.appendChild(cv); this.faces[id] = cv
    }
    root.appendChild(rig)
    document.body.appendChild(root)

    // you stand still while it plays (the moon stays: it is how the talk is read)
    const sc = this.scene, pl = sc.player
    try { sc.joystick?.reset?.() } catch (_) {}
    if (pl) { this._canMove = pl.canMove; pl.canMove = false }
    sc._caption?.hide()

    // up and back: the camera climbs while the wall and the two upon it glide up from the bottom of the screen.
    // They are at different depths, so they travel different distances on slightly different beats, and they
    // keep a slow, opposed drift between them afterwards.
    this.t0 = performance.now(); this.phase = 'up'
    const ease = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
    const wall = rig.querySelector('.bt-stone')
    this._cam = () => {
      if (!this.alive) return
      const now = performance.now(), pv = this.pv
      const k = this.phase === 'up' ? Math.min(1, (now - this.t0) / RISE_MS) : 1 - Math.min(1, (now - this.t1) / FALL_MS)
      const e = ease(k)
      if (pv) { pv.zT = 1 + (CAM.z - 1) * e; pv.pyT = CAM.py * e; pv.pxT = 0; pv.touch = 0 }
      const H = window.innerHeight, rigH = H * RIG_H, faceH = Math.min(window.innerWidth, H) * 0.66
      const kw = ease(Math.max(0, Math.min(1, (k - 0.04) / 0.96))), kf = ease(Math.max(0, Math.min(1, (k - 0.0) / 0.9)))   // the near ones lead
      const sw = Math.sin(now / 2700), bob = Math.sin(now / 1900)
      const settle = Math.min(k, 1)
      if (wall) wall.style.transform = `translate(${(sw * 2 * settle).toFixed(2)}px, ${((1 - kw) * rigH * 1.15).toFixed(1)}px)`
      for (const [id, cv] of Object.entries(this.faces)) {
        const right = PORTRAITS[id].side === 'right', dir = right ? 1 : -1
        cv.style.transform = `translate(${(-sw * 6 * settle * dir * -1).toFixed(2)}px, ${((1 - kf) * (faceH + rigH) + bob * 2 * settle).toFixed(1)}px)${right ? ' scaleX(-1)' : ''}`
      }
      if (this.phase === 'down' && k <= 0) return
      this._raf = requestAnimationFrame(this._cam)
    }
    this._raf = requestAnimationFrame(this._cam)

    // the talk, once the camera has mostly arrived: the game's own dialogue cards, read at the player's pace
    this._later(RISE_MS * 0.7, () => this._run())
  }

  async _run() {
    // one tune for the whole exchange: the harp picks its tune from the speaker's portrait, so tell it it is always her advisor
    const open = DialogueHarp.open.bind(DialogueHarp), setNpc = DialogueHarp.setNpc.bind(DialogueHarp), orig = { open: DialogueHarp.open, setNpc: DialogueHarp.setNpc }
    this._harp = orig
    DialogueHarp.open = (champ, sc, key) => open(champ, sc, key ? ADVISOR_TUNE : key)
    DialogueHarp.setNpc = (id) => setNpc(id ? ADVISOR_TUNE : id)
    const name = this.scene.player?.nameGa || 'the new one'
    if (this.alive) await this._talk(DIALOGUES(name))
    if (this.alive) this._finish()
  }

  _restoreHarp() { if (this._harp) { DialogueHarp.open = this._harp.open; DialogueHarp.setNpc = this._harp.setNpc; this._harp = null } }

  // the whole conversation, in the encounter panel, until the player has read to the end
  async _talk(dialogues) {
    const sc = this.scene, panel = sc._encounterPanel, p = PORTRAITS.uathach
    if (!panel) return
    const key = 'battlement.talk'
    const d = { type: 'fixed_encounter', stateKey: key, dialogues, portrait: '/' + p.src, logicalX: sc.player?.logicalX ?? 0, logicalY: sc.player?.logicalY ?? 0 }
    const zone = { getData: k => d[k], setData() {} }
    GameState.setNPCProgress(key, 0)
    panel._card = { id: 'fixed:' + key, visual: { gid: 9201, flat: false } }
    panel._active = zone
    panel._openPanel()
    // as the Conall scenes do: if a card goes and no next one comes, show it rather than wait on an empty field
    const tp = sc.textPanel
    let idle = 0
    while (this.alive && panel._isOpen) {
      await new Promise(r => setTimeout(r, 200))
      idle = (tp && !tp.isVisible && !tp.isFading && !panel._chainTimer) ? idle + 200 : 0
      if (idle >= 1500) { idle = 0; panel._reopenDialogue(zone) }
    }
  }

  // The parapet, in perspective like the wooden stage on the green: the camera is above and behind it, so
  // the wall's face is flat to us, the walkway's top and each merlon's top lean away up toward a vanishing point
  // above the screen, and the merlons on either side show the inner face that looks toward the middle.
  // Drawn at a quarter of screen resolution and scaled up with hard edges; stone is laid in running bond.
  _stoneWork() {
    const Q = 3, cw = Math.ceil(window.innerWidth / Q), ch = Math.ceil(window.innerHeight * RIG_H / Q)
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; cv.className = 'bt-stone'
    const x = cv.getContext('2d')
    let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647
    const PAL = [[139, 134, 123], [125, 120, 110], [147, 142, 130], [118, 114, 106], [132, 124, 112]]
    const rgb = (c, k) => `rgb(${Math.max(0, Math.min(255, c[0] * k)) | 0},${Math.max(0, Math.min(255, c[1] * k)) | 0},${Math.max(0, Math.min(255, c[2] * k)) | 0})`
    const MORTAR = '#34312c'
    const vx = cw / 2, vy = -ch * 0.5                                  // the vanishing point, above the screen
    const P = (px, py, s) => [vx + (px - vx) * s, vy + (py - vy) * s]  // a point of the front plane, pushed back to scale s
    const poly = (pts, fill) => { x.fillStyle = fill; x.beginPath(); pts.forEach(([a, b], k) => k ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.fill() }
    // a wall of blocks over a flat rectangle, blocks bw x bh, each course stepped half a block along
    const bricks = (x0, y0, x1, y1, bw, bh, dark = 1) => {
      x.save(); x.beginPath(); x.rect(x0, y0, x1 - x0, y1 - y0); x.clip()
      x.fillStyle = MORTAR; x.fillRect(x0, y0, x1 - x0, y1 - y0)
      let row = 0
      for (let y = y1 - bh; y > y0 - bh; y -= bh, row++) {            // courses counted up from the bottom
        const off = (row & 1) ? -bw / 2 : 0
        for (let bx = x0 + off; bx < x1; bx += bw) {
          const c = PAL[(rnd() * PAL.length) | 0], v = (0.9 + rnd() * 0.18) * dark, w = bw - 1, h = bh - 1
          x.fillStyle = rgb(c, v); x.fillRect(bx, y, w, h)
          x.fillStyle = rgb(c, v * 1.22); x.fillRect(bx, y, w, 1)
          x.fillStyle = rgb(c, v * 1.1); x.fillRect(bx, y, 1, h)
          x.fillStyle = rgb(c, v * 0.72); x.fillRect(bx, y + h - 1, w, 1); x.fillRect(bx + w - 1, y, 1, h)
          if (rnd() < 0.35) { x.fillStyle = rgb(c, v * 0.82); x.fillRect(bx + 2 + ((rnd() * (w - 5)) | 0), y + 2 + ((rnd() * (h - 4)) | 0), 2, 1) }
        }
      }
      x.restore()
    }
    // lines of mortar across a receding face, between two edges
    const courses = (a0, a1, b0, b1, n) => {                           // a0->a1 the near edge (top to bottom), b0->b1 the far edge
      x.strokeStyle = MORTAR; x.lineWidth = 1
      for (let k = 1; k < n; k++) { const t = k / n; x.beginPath(); x.moveTo(a0[0] + (a1[0] - a0[0]) * t, a0[1] + (a1[1] - a0[1]) * t); x.lineTo(b0[0] + (b1[0] - b0[0]) * t, b0[1] + (b1[1] - b0[1]) * t); x.stroke() }
    }
    const BW = 16, BH = 7
    const Ly = Math.round(ch * 0.46)                                   // the wall's top edge, on the front plane
    // 1. the wall's face
    bricks(0, Ly, cw, ch, BW, BH, 0.92)
    // 2. the walkway's top: a lit slab leaning away from the wall's top edge
    const sLedge = 0.74
    poly([[0, Ly], [cw, Ly], P(cw, Ly, sLedge), P(0, Ly, sLedge)], rgb(PAL[2], 1.12))
    // slab joints, running back toward the vanishing point
    x.strokeStyle = 'rgba(52,49,44,.8)'; x.lineWidth = 1
    for (let gx = 0; gx <= cw; gx += 22) { const [a, b] = P(gx, Ly, sLedge); x.beginPath(); x.moveTo(gx, Ly); x.lineTo(a, b); x.stroke() }
    x.fillStyle = rgb(PAL[0], 0.62); x.fillRect(0, Ly - 1, cw, 2)      // the lip's shadow line
    // 3. the merlons: boxes standing back from the wall's edge
    const s0 = 0.92, s1 = 0.82, Hm = ch * 0.30, mw = cw / 6.4
    const boxes = []
    for (let k = -2; k < 9; k++) boxes.push(k * mw * 2 - mw * 0.2)
    boxes.sort((a, b) => Math.abs(b + mw / 2 - vx) - Math.abs(a + mw / 2 - vx))      // the middle ones last
    for (const bx of boxes) {
      const L = bx, R = bx + mw, top = Ly - Hm
      const fl = P(L, top, s0), fr = P(R, top, s0), bl = P(L, Ly, s0), br = P(R, Ly, s0)         // the front face's corners
      const tl = P(L, top, s1), tr = P(R, top, s1), bbl = P(L, Ly, s1), bbr = P(R, Ly, s1)       // and the back's
      if (R < vx) {                                                    // left of centre: the right-hand side shows
        poly([fr, tr, bbr, br], rgb(PAL[1], 0.55)); courses(fr, br, tr, bbr, 4)
      } else if (L > vx) {                                             // right of centre: the left-hand side shows
        poly([fl, tl, bbl, bl], rgb(PAL[1], 0.62)); courses(fl, bl, tl, bbl, 4)
      }
      poly([fl, fr, tr, tl], rgb(PAL[2], 1.28))                        // the top, lit
      x.strokeStyle = 'rgba(52,49,44,.7)'; x.lineWidth = 1; x.beginPath(); x.moveTo((fl[0] + fr[0]) / 2, (fl[1] + fr[1]) / 2); x.lineTo((tl[0] + tr[0]) / 2, (tl[1] + tr[1]) / 2); x.stroke()
      // the front face, in running bond (flat rectangle, scaled by s0)
      const x0 = Math.round(fl[0]), x1 = Math.round(fr[0]), y0 = Math.round(fl[1]), y1 = Math.round(bl[1])
      bricks(x0, y0, x1, y1, 10, BH, 1)
      x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(x0, y1 - 1, x1 - x0, 1)
    }
    // a finish over all of it, so it sits in the misty air of the rest of the scene: cool light from above, depth below
    x.globalCompositeOperation = 'source-atop'
    const g = x.createLinearGradient(0, 0, 0, ch)
    g.addColorStop(0, 'rgba(205,220,225,0.16)'); g.addColorStop(0.45, 'rgba(120,135,140,0.06)'); g.addColorStop(1, 'rgba(10,14,16,0.42)')
    x.fillStyle = g; x.fillRect(0, 0, cw, ch)
    x.globalCompositeOperation = 'source-over'
    return cv
  }

  // down again, and the camera back where it was
  _finish() {
    this.phase = 'down'; this.t1 = performance.now()
    this._later(FALL_MS + 200, () => this._end())
  }

  _end() {
    this.destroy()
    this.onDone()
  }

  destroy() {
    this.alive = false
    this._restoreHarp()
    cancelAnimationFrame(this._raf)
    this.timers.forEach(clearTimeout)
    try { for (const v of Object.values(this.voices)) v?.stop() } catch (_) {}
    const sc = this.scene, pv = this.pv
    if (pv) { pv.zT = 1; pv.pyT = 0 }
    try { sc.joystick?.showRing?.() } catch (_) {}
    if (sc.player && this._canMove !== undefined) sc.player.canMove = this._canMove
    this.root?.remove(); this.root = null
  }
}

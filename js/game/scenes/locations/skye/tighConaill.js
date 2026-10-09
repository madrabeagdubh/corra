// tighConaill.js
// Location: js/game/scenes/locations/skye/tighConaill.js
//
// Tigh Chonaill -- Conall's cabin, where the champion wakes after the landing.
//
// An OFFICIAL map, like every other place: public/maps/skyeMaps/skye_tigh.json, drawn by the
// perspective ground (the walls are 'wallplane' buildings, the furniture and hearth 'cuboid'
// ones: effects/pgr/pgrBuildings.js; the painted textures are tighRoom.js -> public/assets/tigh/).
// So the hoop, the tap-to-path marker, the examine panel and the conversation cards are the
// game's own.
//
// The scripted morning (step 2):
//   the champion wakes (a slow blink); Conall talks (conversation cards, at the reader's pace),
//   draws the curtain, shows the clothes on the chest, opens the door and throws the brooch
//   onto the clothes, then leaves, closing the door. The champion gets up (in his shirt); the
//   hoop is not his yet. Walking to the clothes puts them on, and the brooch flies to him:
//   the hoop fades in.
//
// ?script=0 skips the morning (the champion is up at once, hoop and all); ?eyes=0 skips the blink.
// ?zoom=1.4 comes in or out.
// Things are looked at from the moonTile: stand by one and a ? shows over the moon; tap it and the words
// come up as a caption (no dialogue, no blur, nothing locked).
//
// The dialogue is tools/dialogue/drafts/tighConaill*.dlg -> public/data/skye/tighConaill.js
// (three conversations: hello; the clothes; the door). What can be looked at is
// public/data/skye/skyeTigh.js.

import Phaser from 'phaser'
import SkyeScene from './skyeScene.js'
import PerspectiveGroundRenderer from '../../../effects/perspectiveGroundRenderer.js'
import { GameState } from '../../../systems/gameState.js'
import SkyeCaption from './skyeCaption.js'
import { setupTapOnly } from './skyeTapOnly.js'
import { checkLook, lookIcon, LOOK_KINDS } from './skyeLook.js'
import { hearthFire } from './skyeFx.js'

const DATA_DIR = 'skye', DATA_KEY = 'tighConaill'
const TS = 48                                           // the map's tile, in logical px
const mid = (c) => c * TS + TS / 2
const STEP_MS = 300

const MAP = {
  floor: { x0: 2, x1: 7, y0: 3, y1: 10 },               // the room's cells (inclusive): 6 wide, 8 deep
  bed: [3, 5],                                          // where the champion wakes and stands up: beside the bed
  conall: [3, 5],                                       // he begins beside the bed, facing it
  window: [6, 3],                                       // the small window; Conall stands below it
  door: [4, 10],                                        // the Oryx door tile, on the south edge
  clothes: [3, 6],                                      // by the chest at the foot of the bed
  block: [[2, 3], [3, 3], [7, 3], [4, 3], [5, 3], [2, 4], [2, 5], [6, 6], [7, 6], [2, 6]],  // the corners, woodpile, hearth, bed, table, chest
  chest: { col: 2.5, row: 6.65, up: 0.5 },              // where the brooch lies: on the cloak, on the chest's lid
}
const DOOR_OPEN = 138, DOOR_CLOSED = 137
const HERO_SCALE = 0.98                                 // the champion (and Conall) are big beside a low cottage's furniture
const CONALL_SCALE = 1.5
const CAM_ROWS = 5
const FOCAL = 6
const HORIZON = 0.06
// What Conall says when you wake here after Garbhán (garbhan.js): knocked out, or half drowned. PLACEHOLDERS: English in both fields.
const w2 = (s) => ({ ga: s, en: s })
const WAKE = {
  ko: [w2('There you are. Face down in the grass, and Garbhán\'s boots going the other way.'),
       w2('No shame in it. He has three years on you and no manners at all.'),
       w2('Hearts come back. Rest, eat, think about your feet. Then go and have another look at him.'),
       w2('He\'ll still be there. He always is.')],
  drowned: [w2('There you are. Half the loch came home with you.'),
            w2('Water is no friend to a man with a sword in his hand. Mind where he stands.'),
            w2('And mind where you stand. Rest. When you\'re ready, he\'ll still be there.')],
}
const ZOOM = 1.3                                        // a small room: come in close, so the champion is not a child in it

export class TighConaill extends SkyeScene {
  constructor() { super({ key: 'skye_tigh_conaill' }) }
  getMapKey() { return 'skye_tigh' }
  getSkyImage() { return null }
  getCloudShadows() { return false }
  getAmbient() { return 0x4a4038 }

  // Where the champion can walk: the floor, less the bed, table, chest, the hearth and the two cut corners.
  // (Not the map's wallMask: a mask cell is drawn as a tree trunk.) Nothing beyond the door tile either:
  // the wall is a wall.
  isColliding(x, y) {
    const c = Math.floor(x / TS), r = Math.floor(y / TS), f = MAP.floor
    if (c < f.x0 || c > f.x1 || r < f.y0 || r > f.y1) return true
    return MAP.block.some(([bc, br]) => bc === c && br === r)
  }

  // while the morning plays, a tap does nothing
  _onTapBeforePath() { return !this._locked }

  async create(data) {
    // walls rise above the horizon in here; the renderer's settings are put back when we leave
    PerspectiveGroundRenderer.CLIP_TOP_FRAC = 0
    const across = PerspectiveGroundRenderer.TILES_ACROSS, focal = PerspectiveGroundRenderer.FOCAL_LENGTH
    PerspectiveGroundRenderer._psDefault ??= PerspectiveGroundRenderer.PLAYER_SCALE
    this.events.once('shutdown', () => { PerspectiveGroundRenderer.PLAYER_SCALE = PerspectiveGroundRenderer._psDefault; this._teardown(across, focal) })
    await super.create(data)
    const pgr = this.perspectiveGround
    if (!pgr || !this.player) return
    this._q = new URLSearchParams(location.search)
    PerspectiveGroundRenderer.PLAYER_SCALE = Number(this._q.get('ps')) || HERO_SCALE      // set after the await: an earlier shutdown must not undo it
    this._dead = false

    // anything outside the room's floor is darkness, not the clay's brown
    const tm = pgr.tintManager
    if (tm) {
      const orig = tm.getTint.bind(tm), f = MAP.floor
      tm.getTint = (g, x, y) => (g !== 197 && (x < f.x0 || x > f.x1 || y < f.y0 || y > f.y1)) ? { h: 28, s: 20, l: 3, alpha: 1 } : orig(g, x, y)
    }
    // come in by narrowing what the screen spans (the camera's own zoom would throw the follow off)
    const z = Number(this._q.get('zoom')) || ZOOM
    PerspectiveGroundRenderer.TILES_ACROSS = across / z
    PerspectiveGroundRenderer.FOCAL_LENGTH = Number(this._q.get('fl')) || FOCAL                // a wide lens: near things loom, far things shrink
    pgr._cameraRowOffset = Number(this._q.get('cam')) || CAM_ROWS            // the camera close behind us: the little room is deep, not a far-off box
    pgr._horizonYFrac = Number(this._q.get('hz')) || HORIZON
    pgr._lastCamX = null
    this._shadowEdges()

    // the pieces this scene changes
    this._bld = (id) => pgr._buildings.find(b => b.id === id)
    this._img = (src) => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.src = '/' + src })
    this._conall = (pgr._encounterFlags || []).find(f => f.visual?.gid === 9203)
    if (this._conall) {                                   // Conall, as big as the champion
      const cs = Number(this._q.get('cs')) || CONALL_SCALE
      this._conall.draw = (ctx, x, y, w, g) => { const cv = g._getTileCanvas(9203); if (cv) g._drawBillboard(ctx, cv, x, y, w * cs, 1.2) }
    }
    this._fire = hearthFire(this)                          // the little fire
    this._sleeper(true)
    this._caption = new SkyeCaption({ scene: this, color: '#e6dcc0' })
    this._spent = {}
    this._clothesZone()

    this.player.setArmorVisible?.(false)                  // he sleeps in his shirt
    const done = GameState.hasNote('tigh_done')            // he has been out of the door: coming back, the morning is over
    if (data?.wake === 'garbhan' && this._conall) return this._wakeUp(data.how)      // carried home from the loch
    const scripted = (this._q.get('script') === '1' || (this._q.get('script') !== '0' && !done)) && !!this._conall
    if (!scripted) {
      this._sleeper(false)
      if (done) {                                          // back inside: dressed, the clothes gone from the chest, the bed empty
        this.player.setArmorVisible?.(true)
        const i = this.interactables.indexOf(this._clothes); if (i > -1) this.interactables.splice(i, 1)
        this._clothes?.destroy(); this._clothes = null
        this._setTop('seat', 'assets/tigh/seatTopEmpty.png'); this._setTop('bed', 'assets/tigh/bedTopEmpty.png')
      }
      this._placePlayer(done ? [MAP.door[0], MAP.door[1] - 1] : MAP.bed)
      this._conallGone = true; this._hideConall()
      this._giveBrooch()
      return
    }
    // asleep: the bed holds him, so the player himself is not drawn
    this._locked = true
    this.narrativeInProgress = true
    pgr._playerHidden = true
    this._placePlayer(MAP.bed)
    this._lockBrooch()
    this._conall.tileX = MAP.conall[0]; this._conall.tileY = MAP.conall[1]
    this._conall.pose = { dy: 0, sy: 1, sx: -1 }            // turned to the bed (to the west)
    this._camBias = { x: -0.9 * TS, y: 0, k: 1 }            // the camera between him and the bed, so both are seen
    this._paintHead()
    if (this._q.get('eyes') === '0') { document.getElementById('landfall-veil')?.remove(); this._run() }
    else this._openEyes(() => this._run())
  }

  // Knocked out or half drowned on the loch (garbhan.js, which holds the black over the screen): Conall has carried
  // you home. You wake dressed, he has a few words, and then the door is yours.
  _wakeUp(how) {
    this._sleeper(false)
    this.player.setArmorVisible?.(true)
    const i = this.interactables.indexOf(this._clothes); if (i > -1) this.interactables.splice(i, 1)
    this._clothes?.destroy(); this._clothes = null
    this._setTop('seat', 'assets/tigh/seatTopEmpty.png'); this._setTop('bed', 'assets/tigh/bedTopEmpty.png')
    this._placePlayer(MAP.bed)
    this._conall.tileX = MAP.bed[0] + 1; this._conall.tileY = MAP.bed[1]
    this._conall.pose = { dy: 0, sy: 1, sx: -1 }
    this._giveBrooch()
    this.joystick?.hideDirections?.()
    const lines = WAKE[how] || WAKE.ko
    this._openEyes(async () => {
      for (const l of lines) { if (this._dead) return; this._caption?.show(l.ga, l.en, 3400); await this.wait(3700) }
      if (!this._dead) this.joystick?.showDirections?.()
    })
  }

  _teardown(across, focal) {
    this._dead = true
    PerspectiveGroundRenderer.FOCAL_LENGTH = focal
    PerspectiveGroundRenderer.CLIP_TOP_FRAC = null
    PerspectiveGroundRenderer.TILES_ACROSS = across
    if (this.perspectiveGround) this.perspectiveGround._playerHidden = false
    for (const id of ['tigh-eyes', 'tigh-fade']) document.getElementById(id)?.remove()
    const box = document.getElementById('gameContainer'); if (box) { box.style.filter = ''; box.style.transition = '' }
    this._brooch?.parts.forEach(o => o.destroy()); this._brooch = null
    this._caption?.destroy(); this._caption = null
    this._day?.glow?.destroy(); this._day = null
    for (const el of [this.perspectiveGround?._groundCanvas, this.perspectiveGround?._objectCanvas]) if (el) { el.style.filter = ''; el.style.transition = '' }
    this._tapOff?.()
  }

  // A tap walks; a drag does nothing here (skyeTapOnly.js). Drawing a route is learned later, in the garden, with the dummy.
  _setupTapToPath() { this._tapOff = setupTapOnly(this) }

  // dark edges: the room fades to shadow at the sides, so the cut corners never show
  _shadowEdges() {
    const w = this.scale.width, h = this.scale.height
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const x = c.getContext('2d')
    x.translate(w / 2, h * 0.52); x.scale(1, h / w)         // an ellipse, wider than the screen is tall
    const g = x.createRadialGradient(0, 0, w * 0.16, 0, 0, w * 0.54)
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0.95)')
    x.fillStyle = g; x.fillRect(-2 * w, -2 * w, 4 * w, 4 * w)
    if (this.textures.exists('tigh_edges')) this.textures.remove('tigh_edges')
    this.textures.addCanvas('tigh_edges', c)
    this._edges = this.add.image(w / 2, h / 2, 'tigh_edges').setScrollFactor(0).setDepth(40)
  }

  // ── little helpers ─────────────────────────────────────────────────────────
  wait(ms) { return new Promise(r => this.time.delayedCall(ms, r)) }
  until(fn) { return new Promise(res => { const t = () => { if (this._dead || fn()) res(); else this.time.delayedCall(80, t) }; t() }) }
  _placePlayer([c, r]) { this.player.logicalX = mid(c); this.player.logicalY = mid(r); this.player.isMoving = false }
  _redraw() { if (this.perspectiveGround) this.perspectiveGround._lastCamX = null }
  // a screen point for a place in the room: tile column, row (the ground's own, so fractions are fine) and height in tiles
  _scr(col, row, up = 0) {
    const g = this.perspectiveGround
    return { x: g._colToScreenX(col, row), y: g._rowToScreenY(row) - up * g._scaleAtRow(row), s: g._scaleAtRow(row) }
  }

  // swap a box's top texture (the bed with and without its sleeper, the chest with and without the clothes)
  async _setTop(id, src) {
    const b = this._bld(id); if (!b) return
    b.topCanvas = await this._img(src); this._redraw()
  }
  _setDoor(gid) { this.mapData.layers[1][MAP.door[1]][MAP.door[0]] = gid; this._redraw(); this._doorSound(gid === DOOR_OPEN) }

  // ── sounds, made here (a creak, a latch, a thump): no files ───────────────
  _audio() { const c = this.sound?.context; if (c?.state === 'suspended') c.resume?.(); return c || null }
  _noise(c, ms) {
    const n = Math.floor(c.sampleRate * ms / 1000), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
    const src = c.createBufferSource(); src.buffer = buf; return src
  }
  _tone(c, type, f0, f1, t0, dur, vol) {
    const o = c.createOscillator(), g = c.createGain(); o.type = type
    o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur)
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.05)
  }
  _doorSound(open) {
    try {
      const c = this._audio(); if (!c) return
      const t = c.currentTime + 0.02
      const thump = (at, vol) => { this._tone(c, 'sine', 120, 38, at, 0.2, vol); const n = this._noise(c, 120), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'lowpass'; f.frequency.value = 380; g.gain.setValueAtTime(vol * 0.5, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.12); n.connect(f); f.connect(g); g.connect(c.destination); n.start(at) }
      const click = (at) => this._tone(c, 'square', 2100, 1500, at, 0.035, 0.05)
      if (open) {                                          // the latch, then a long hinge-creak, then the leaf comes to rest
        click(t); thump(t + 0.04, 0.25)
        const o = c.createOscillator(), g = c.createGain(), bp = c.createBiquadFilter(), lfo = c.createOscillator(), lg = c.createGain()
        o.type = 'sawtooth'; o.frequency.setValueAtTime(95, t + 0.12); o.frequency.linearRampToValueAtTime(190, t + 0.55); o.frequency.linearRampToValueAtTime(120, t + 0.95)
        lfo.frequency.value = 23; lg.gain.value = 14; lfo.connect(lg); lg.connect(o.frequency)
        bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 5
        g.gain.setValueAtTime(0.0001, t + 0.12); g.gain.exponentialRampToValueAtTime(0.09, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0)
        o.connect(bp); bp.connect(g); g.connect(c.destination); o.start(t + 0.12); lfo.start(t + 0.12); o.stop(t + 1.05); lfo.stop(t + 1.05)
        thump(t + 1.0, 0.12)
      } else {                                             // swung to: a short creak, a heavy thump, the latch drops
        this._tone(c, 'sawtooth', 150, 90, t, 0.35, 0.05)
        thump(t + 0.32, 0.45); click(t + 0.42)
      }
    } catch (_) {}
  }

  // the sleeper: a head and four blanket steps on the bed (boxes of the map), shown while he sleeps
  _sleeper(show) { if (!this.perspectiveGround) return; for (const id of ['sl_pillow', 'sl_head', 'sl_n', 'sl_a', 'sl_b', 'sl_c', 'sl_d', 'sl_foot1', 'sl_foot2']) { const b = this._bld(id); if (b) b.hidden = !show } this._redraw() }
  // the box that is his head wears the hero's own sprite: its top face is the head and shoulders of his unarmoured frame
  _paintHead() {
    const pgr = this.perspectiveGround, b = this._bld('sl_head'), src = pgr?._playerCanvas
    if (!b || !src) { if (!this._dead && b) this.time.delayedCall(300, () => this._paintHead()); return }
    const w = src.width, h = src.height, px = src.getContext('2d').getImageData(0, 0, w, h).data
    let x0 = w, x1 = -1, y0 = h, y1 = -1
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
    if (x1 < 0) return
    const bw = x1 - x0 + 1, bh = Math.round((y1 - y0 + 1) * 0.3)
    const c = document.createElement('canvas'); c.width = 14; c.height = 14
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false
    g.drawImage(src, x0 + bw * 0.22, y0, bw * 0.56, bh, 0, 0, 14, 14)      // just the head: his own sprite, on the box's face
    b.canvas = c; this._redraw()
    return
  }

  // the clothes: a thing to take. One zone, made here (a content object would stay "collected" for good);
  // it is offered on the moonTile like everything else here, with a tunic for its icon.
  _clothesZone() {
    const [c, r] = MAP.clothes
    const zone = this.add.zone(mid(c), mid(r), TS, TS)
    zone.setData('id', 'clothes'); zone.setData('type', 'clothes')
    zone.setData('text', { ga: 'Do chuid éadaigh', en: 'Your clothes' })
    zone.setData('logicalX', mid(c)); zone.setData('logicalY', mid(r))
    this.interactables.push(zone)
    this._clothes = zone
  }

  // ── looking at things (skyeLook.js): the moonTile offers a ? (a tunic for the clothes); a tap shows the words as a caption ──
  checkProximityInteractions() {                          // nothing happens by itself here: it is offered, not forced
    if (!this.player || this._locked || this._dead || !this._spent) return
    if (this._dressed && this._checkDoorProximity()) return      // the door, once he is dressed
    checkLook(this, {
      types: ['examine', 'clothes'],
      icon: (id) => lookIcon(LOOK_KINDS[id] || 'look'),
      onLook: (id, zone) => {
        if (id !== 'clothes') return false
        const i = this.interactables.indexOf(zone); if (i > -1) this.interactables.splice(i, 1)
        zone.destroy(); this._wear()
        return true
      },
    })
  }

  // out of the door: the morning is over for good, and the way is lit
  _triggerDoor(door) {
    if (this._exiting) return
    try { GameState.addNote('tigh_done') } catch (_) {}
    this._doorSound(true)
    super._triggerDoor(door)
  }

  // no tilt-shift blur in here, indoors or in talk: the room is already close (a dimming under the words stays)
  getTiltShift() {
    const t = super.getTiltShift()
    return { ...t, combat: { ...t.combat, farBlur: 0, nearBlur: 0, vignette: 0 }, dialogue: { ...t.dialogue, farBlur: 0, nearBlur: 0, vignette: 0 } }
  }

  // ── the hoop is Conall's brooch: it is not the champion's until it is pinned on ──────
  _lockBrooch() {
    const j = this.joystick
    if (!j || this._hoopGiven) return
    j.showDirections = () => {}
    j.hideDirections()
  }
  _giveBrooch() {
    const j = this.joystick
    this._hoopGiven = true
    this._dressed = true
    if (!j) return
    delete j.showDirections
    if (j._canvas) j._canvas.style.transition = 'opacity 1.6s ease'
    j.showDirections()
  }

  // ── Conall on the floor ────────────────────────────────────────────────────
  // cells, 8 ways, no cutting a corner; the room's own collision decides what is free
  _free(c, r) { return !this.isColliding(mid(c), mid(r)) }
  _route(from, to) {
    const key = (c, r) => c + ',' + r, prev = new Map([[key(...from), null]]), q = [from]
    const ok = (c, r) => this._free(c, r) || (c === to[0] && r === to[1])
    const D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]
    for (let i = 0; i < q.length; i++) {
      const [c, r] = q[i]
      if (c === to[0] && r === to[1]) break
      for (const [dx, dy] of D) {
        const nc = c + dx, nr = r + dy
        if (!ok(nc, nr) || prev.has(key(nc, nr))) continue
        if (dx && dy && !(ok(c + dx, r) && ok(c, r + dy))) continue
        prev.set(key(nc, nr), [c, r]); q.push([nc, nr])
      }
    }
    if (!prev.has(key(...to))) return []
    const path = []
    for (let n = to; n && !(n[0] === from[0] && n[1] === from[1]); n = prev.get(key(...n))) path.unshift(n)
    return path
  }
  async _walk(to) {
    const f = this._conall
    for (const [c, r] of this._route([f.tileX, f.tileY], to)) { if (this._dead) return; await this._step(f, c, r) }
  }
  // one hopping step, as the real player's: a little squash and stretch, locked to the grid
  _step(f, c, r) {
    return new Promise(res => {
      const dx = c - f.tileX, dy = r - f.tileY
      f.tileX = c; f.tileY = r
      this.tweens.addCounter({
        from: 0, to: 1, duration: STEP_MS,
        onUpdate: t => {
          const v = t.getValue(), a = Math.sin(Math.PI * v)
          f.offset = [-dx * (1 - v), -dy * (1 - v)]
          f.pose = { dy: -0.16 * a, sy: 1 + 0.08 * a, sx: (dy === 0 && dx < 0 ? -1 : 1) * (1 - 0.04 * a) }
          this._redraw()
        },
        onComplete: () => { f.offset = [0, 0]; f.pose = null; this._redraw(); res() },
      })
    })
  }

  // ── a conversation of the game's own: the card is the reader's ─────────────
  async _talk(which) {
    const panel = this._encounterPanel
    const { tighConaillContent } = await import(/* @vite-ignore */ `/data/${DATA_DIR}/${DATA_KEY}.js`)
    const enc = tighConaillContent.fixedEncounters[which]
    const stateKey = 'tigh.' + enc.id
    const f = this._conall
    const d = { type: 'fixed_encounter', stateKey, dialogues: enc.dialogues, portrait: enc.portrait, logicalX: mid(f.tileX), logicalY: mid(f.tileY) }
    const zone = { getData: k => d[k], setData() {} }
    GameState.setNPCProgress(stateKey, 0)
    panel._card = { id: 'fixed:' + enc.id, visual: enc.visual }
    panel._active = zone
    panel._openPanel()
    // Safety net. If a card has gone and the next never comes (the chrome standing with nothing on it), show the
    // next one ourselves rather than wait on a swipe at an empty field.
    const tp = this.textPanel
    let idle = 0
    while (!this._dead && panel._isOpen) {
      await this.wait(200)
      idle = (!tp.isVisible && !tp.isFading && !panel._chainTimer) ? idle + 200 : 0
      if (idle >= 1500) { idle = 0; console.warn('[tigh] dialogue stalled: showing the next card'); panel._reopenDialogue(zone) }
    }
    this._lockBrooch()                                    // the panel gives the hoop back: not yet
  }

  // ── the morning ────────────────────────────────────────────────────────────
  async _run() {
    GameState.removeNote('tigh_brooch')
    await this.wait(700)

    await this._talk(0)                                   // hello
    this._camBias = { x: 0, y: 0 }
    await this._walk([MAP.window[0], MAP.window[1] + 1])
    await this._openCurtain(2200)
    await this.wait(900)

    await this._walk(MAP.clothes)                         // the clothes, the stew, the training grounds
    await this._talk(1)
    await this.wait(300)

    await this._walk([MAP.door[0], MAP.door[1] - 1])      // to the door, and open it
    this._setDoor(DOOR_OPEN)
    await this.wait(700)

    await this._talk(2)                                   // one thing more: the brooch
    await this._throwBrooch()
    await this.wait(900)

    await this._walk(MAP.door)                            // out, and the door shut behind him
    this._conall.hidden = true
    const z = this.interactables.findIndex(o => o.getData?.('id') === 'conall')
    if (z > -1) { this.interactables[z].destroy(); this.interactables.splice(z, 1) }
    await this.wait(250)
    this._setDoor(DOOR_CLOSED)
    await this.wait(1300)

    this._getUp()
  }

  // the curtain is drawn: it goes from shut to open, and the day comes into the room
  async _openCurtain(ms) {
    const b = this._bld('curtain'); if (!b) return
    const [shut, open] = await Promise.all([this._img('assets/tigh/curtain8Closed.png'), this._img('assets/tigh/curtain8Open.png')])
    const c = document.createElement('canvas'); c.width = shut.width; c.height = shut.height
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false
    b.canvas = c
    this._daylight(ms)
    await new Promise(res => this.tweens.addCounter({
      from: 0, to: 1, duration: ms, ease: 'Sine.easeInOut',
      onUpdate: t => { const v = t.getValue(); x.clearRect(0, 0, c.width, c.height); x.globalAlpha = 1 - v; x.drawImage(shut, 0, 0); x.globalAlpha = v; x.drawImage(open, 0, 0); this._redraw() },
      onComplete: () => { b.canvas = open; this._redraw(); res() },
    }))
  }

  // The curtain is drawn and the day comes in: the room brightens (a filter on the two world canvases), the dark
  // edges draw back, and a patch of sun lies across the floor from the little window, its mullions casting bars.
  _daylight(ms) {
    const pgr = this.perspectiveGround
    for (const el of [pgr._groundCanvas, pgr._objectCanvas]) if (el) { el.style.transition = `filter ${ms}ms ease-in-out`; el.style.filter = 'brightness(1.55) contrast(1.06) saturate(1.12)' }
    if (this._edges) this.tweens.add({ targets: this._edges, alpha: 0.28, scale: 1.45, duration: ms, ease: 'Sine.easeInOut' })
    const glow = this.add.graphics().setScrollFactor(0).setDepth(39)
    this._day = { glow, k: 0 }
    this.tweens.add({ targets: this._day, k: 1, duration: ms * 1.2, ease: 'Sine.easeInOut' })
  }
  // the sun patch: a quad from the window on the back wall, down across the floor, in four panes (the mullions are the gaps)
  _drawSun() {
    const D = this._day; if (!D) return
    const g = D.glow; g.clear()
    if (D.k < 0.02) return
    const P = (col, row, up) => this._scr(col, row, up)
    // wall quad (the window, lit) and floor quad (where the light falls)
    const wall = [[6.42, 3, 1.7], [6.92, 3, 1.7], [6.92, 3, 1.04], [6.42, 3, 1.04]]
    const floor = [[6.1, 3.15, 0], [6.95, 3.15, 0], [5.3, 6.6, 0], [3.75, 6.6, 0]]
    const lerp = (a, b, t) => a + (b - a) * t
    const paneQuad = (q, i, j, n, m, gap) => {
      const pt = (u, v) => {                              // bilinear on the quad: u across, v from the near edge to the far
        const top = [lerp(q[0][0], q[1][0], u), lerp(q[0][1], q[1][1], u), lerp(q[0][2], q[1][2], u)]
        const bot = [lerp(q[3][0], q[2][0], u), lerp(q[3][1], q[2][1], u), lerp(q[3][2], q[2][2], u)]
        return P(lerp(top[0], bot[0], v), lerp(top[1], bot[1], v), lerp(top[2], bot[2], v))
      }
      const u0 = i / n + gap, u1 = (i + 1) / n - gap, v0 = j / m + gap, v1 = (j + 1) / m - gap
      return [pt(u0, v0), pt(u1, v0), pt(u1, v1), pt(u0, v1)]
    }
    const fill = (pts, col, a) => { g.fillStyle(col, a); g.fillPoints(pts, true) }
    for (const [q, n, m, gap] of [[floor, 2, 2, 0.035]]) {
      fill(paneQuad(floor, 0, 0, 1, 1, -0.06), 0xfff0b0, 0.07 * D.k)      // a soft spread behind the panes
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) fill(paneQuad(q, i, j, n, m, gap), 0xfff2b8, 0.3 * D.k)
    }
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) fill(paneQuad(wall, i, j, 2, 2, 0.03), 0xfff8d8, 0.55 * D.k)   // the window itself, blazing
  }

  // The brooch: a small bronze square, tossed from Conall's hand across the room onto the clothes on the
  // chest (a low underarm throw), spinning and glinting. It stays there, pinned to them, winking now and then.
  async _throwBrooch() {
    const f = this._conall
    const edge = this.add.rectangle(0, 0, 8, 8, 0x3d2210).setScrollFactor(0).setDepth(60)
    const gem = this.add.rectangle(0, 0, 5, 5, 0xc27a34).setScrollFactor(0).setDepth(61)
    const glint = this.add.graphics().setScrollFactor(0).setDepth(62).setBlendMode(Phaser.BlendModes.ADD)
    const B = this._brooch = { edge, gem, glint, parts: [edge, gem, glint], landed: false }
    const ch = MAP.chest
    const start = () => this._scr(f.tileX + 0.5, f.tileY + 0.5, 0.95)
    const end = () => this._scr(ch.col, ch.row, ch.up)
    this._camPoint = { x: (f.tileX + 0.5 + ch.col) / 2 * TS, y: (f.tileY + 0.5 + ch.row) / 2 * TS }      // the camera between his hand and the chest: the whole flight is seen
    edge.setVisible(false); gem.setVisible(false)
    await this.wait(750)
    edge.setVisible(true); gem.setVisible(true)
    await new Promise(res => this.tweens.addCounter({
      from: 0, to: 1, duration: 1050, ease: 'Linear',
      onUpdate: t => {
        const v = t.getValue(), a = start(), b = end()
        const x = a.x + (b.x - a.x) * v, y = a.y + (b.y - a.y) * v - 1.15 * ((a.s + b.s) / 2) * 4 * v * (1 - v)
        const rot = v * Math.PI * 7
        edge.setPosition(x, y).setRotation(rot); gem.setPosition(x, y).setRotation(rot)
        glint.clear(); const g = Math.pow(Math.max(0, Math.sin(rot * 2)), 10)
        if (g > 0.05) this._cross(glint, x, y, g, 7)
      },
      onComplete: res,
    }))
    edge.setRotation(0.4); gem.setRotation(0.4)
    B.landed = true; B.t = 0
    try { const c = this._audio(); if (c) this._tone(c, 'triangle', 1900, 1200, c.currentTime, 0.12, 0.04) } catch (_) {}
    await this.wait(900)
    this._camPoint = null
  }
  _cross(g, x, y, a, k = 5) {
    g.fillStyle(0xffd8a8, a)
    g.fillRect(x - k, y - 0.5, k * 2, 1); g.fillRect(x - 0.5, y - k, 1, k * 2)
    g.fillStyle(0xffffff, a * 0.6); g.fillCircle(x, y, k * 0.4)
  }

  hasContinuousAnimation() { return true }                // the fire never stands still

  // Conall has gone out ahead of us: every flag of his (the map can hold a second one) and his card
  _hideConall() {
    for (const f of this.perspectiveGround?._encounterFlags || []) if (f.visual?.gid === 9203) f.hidden = true
    const z = (this.interactables || []).filter(o => o.getData?.('type') === 'fixed_encounter')
    for (const o of z) { const i = this.interactables.indexOf(o); if (i > -1) this.interactables.splice(i, 1); o.destroy?.() }
  }

  update(time, delta) {
    super.update(time, delta)
    if (!this.perspectiveGround || this._dead) return
    if (this._conallGone) this._hideConall()
    if (this._locked) {
      this.joystick?.reset?.()
      const f = this._conall                              // the camera goes with Conall while he has the room
      if (f && !f.hidden) {
        const cb = this._camBias || { x: 0, y: 0 }
        let tx = mid(f.tileX) + (f.offset?.[0] || 0) * TS + cb.x, ty = mid(f.tileY) + (f.offset?.[1] || 0) * TS + cb.y
        if (this._camPoint) { tx = this._camPoint.x; ty = this._camPoint.y }
        const F = this._focus ||= { x: tx, y: ty }
        const k = Math.min(1, delta / 260); F.x += (tx - F.x) * k; F.y += (ty - F.y) * k
        this.player.logicalX = F.x; this.player.logicalY = F.y
      }
    }
    this._drawSun()
    const B = this._brooch
    if (B?.landed && !B.flying) {                         // it lies on the clothes, winking now and then
      const p = this._scr(MAP.chest.col, MAP.chest.row, MAP.chest.up)
      B.edge.setPosition(p.x, p.y); B.gem.setPosition(p.x, p.y)
      B.t += delta
      B.glint.clear(); const g = Math.pow(Math.max(0, Math.sin(B.t / 380)), 14)
      if (g > 0.05) this._cross(B.glint, p.x, p.y, g, 8)
    }
  }

  // ── getting up, and getting dressed ────────────────────────────────────────
  _getUp() {
    const pgr = this.perspectiveGround
    this._setTop('bed', 'assets/tigh/bedTopEmpty.png')
    this._sleeper(false)
    pgr._playerHidden = false
    this._placePlayer(MAP.bed)
    this._locked = false
    this.narrativeInProgress = false
    this._redraw()
  }

  // the clothes go on (the sprite changes) and leave the chest; the brooch lifts to him, flares, and the hoop comes in
  _wear() {
    this.player.setArmorVisible?.(true)
    this._setTop('seat', 'assets/tigh/seatTopEmpty.png')
    this._caption?.show('Mo chuid éadaigh, tirim agus glan.', 'My clothes, dry and clean.', 3400)
    try { GameState.addNote('tigh_dressed') } catch (_) {}
    this.events.emit('tigh-wear', 'clothes')
    const B = this._brooch
    if (!B) return this._giveBrooch()
    this.time.delayedCall(1100, () => { if (!this._dead) this._broochToHim(B) })        // a beat: dressed first, then the brooch
  }
  _broochToHim(B) {
    B.flying = true
    const from = this._scr(MAP.chest.col, MAP.chest.row, MAP.chest.up)
    const me = () => {
      const p = this.perspectiveGround._projectLogical(this.player.logicalX, this.player.logicalY, true)
      return p ? { x: p.screenX, y: p.screenY - p.scale * TS * 1.3 } : from
    }
    B.glint.clear()
    this.tweens.addCounter({
      from: 0, to: 1, duration: 650, ease: 'Sine.easeOut',
      onUpdate: t => { const v = t.getValue(), m = me(); const x = from.x + (m.x - from.x) * v, y = from.y + (m.y - from.y) * v - 30 * (this.perspectiveGround._scaleAtRow(6) || 1) / 4 * Math.sin(Math.PI * v); B.edge.setPosition(x, y); B.gem.setPosition(x, y) },
      onComplete: () => {
        this.tweens.add({ targets: [B.edge, B.gem], scale: 2.6, alpha: 0, duration: 650, ease: 'Sine.easeOut',
          onComplete: () => { B.parts.forEach(o => o.destroy()); this._brooch = null } })
        this._giveBrooch()
        this._caption?.show('Agus dealg. Is dalta anois mé, is dócha!', 'And a brooch. A student now, I suppose!', 4800)
      },
    })
  }

  // ── waking: an eyelid, opened a little, shut, opened again ─────────────────
  // An SVG with an almond-shaped hole in a black sheet, its edge blurred, redrawn as the slit grows.
  // The first things the champion sees are blurred; the focus returns.
  _openEyes(done) {
    document.getElementById('tigh-eyes')?.remove()
    const NS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(NS, 'svg')
    svg.id = 'tigh-eyes'
    svg.setAttribute('style', 'position:fixed;inset:0;width:100vw;height:100vh;z-index:1000002;pointer-events:none;filter:blur(4px)')
    const path = document.createElementNS(NS, 'path')
    path.setAttribute('fill', '#000'); path.setAttribute('fill-rule', 'evenodd')
    svg.appendChild(path)
    document.body.appendChild(svg)
    const box = document.getElementById('gameContainer') || this.game.canvas
    box.style.transition = 'none'; box.style.filter = 'blur(9px)'

    const draw = (h) => {                                 // h: the slit's half-height in px
      const W = window.innerWidth, H = window.innerHeight, cy = H * 0.48, m = 60
      const outer = `M${-m},${-m} H${W + m} V${H + m} H${-m} Z`
      const hole = h < 0.5 ? '' : ` M${-m},${cy} Q${W / 2},${cy - 2 * h} ${W + m},${cy} Q${W / 2},${cy + 2 * h} ${-m},${cy} Z`
      path.setAttribute('d', outer + hole)
    }
    draw(0)
    document.getElementById('landfall-veil')?.remove()    // the eyelid is black too: no seam

    const H = window.innerHeight
    const beats = [                                       // [half-height, ms, ease, then wait]: quick as a blink
      [H * 0.035, 260, 'Sine.easeOut', 40],
      [0,         150, 'Sine.easeIn',  170],
      [H * 0.10,  240, 'Sine.easeOut', 30],
      [0,         140, 'Sine.easeIn',  0],
    ]
    let cur = 0, i = 0
    const finish = () => {
      const veil = document.createElement('div')          // black for a beat; then the world fades in, the focus returning
      veil.id = 'tigh-fade'
      veil.style.cssText = 'position:fixed;inset:0;background:#000;z-index:1000002;pointer-events:none;opacity:1'
      document.body.appendChild(veil)
      svg.remove()
      this.time.delayedCall(450, () => {
        box.style.transition = 'filter 800ms ease-out'; box.style.filter = 'blur(0px)'
        veil.style.transition = 'opacity 650ms ease-in'; veil.style.opacity = '0'
        this.time.delayedCall(800, () => { veil.remove(); done?.() })
      })
    }
    const next = () => {
      if (i >= beats.length) { finish(); return }
      const [to, ms, ease, wait] = beats[i++], from = cur
      this.tweens.addCounter({
        from, to, duration: ms, ease,
        onUpdate: t => { cur = t.getValue(); draw(cur) },
        onComplete: () => { cur = to; draw(cur); this.time.delayedCall(wait, next) },
      })
    }
    this.time.delayedCall(350, next)                      // a moment of black first
  }
}

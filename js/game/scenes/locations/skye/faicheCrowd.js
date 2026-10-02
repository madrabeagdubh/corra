// faicheCrowd.js
// Location: js/game/scenes/locations/skye/faicheCrowd.js
//
// The students on the practice green. They stand in a loose ring round the
// fighting ring, shifting their weight, watching. When a fight comes their
// way they jump back out of it, and drift back to their places once it's
// moved off. They clap a win, boo a dishonourable blow (striking a man
// without his sword), and go "ooh" at a fall.
//
// Talking: like anyone else in the game. Come close and their face shows on
// the moon; tap it for a card. Only with your sword put away: en garde,
// they're watching the fight, not chatting.
//
// Each student is a PGR figure (a champion sprite from the atlas), sorted
// with you and the Warden by row, and solid: you can't walk through them.
// Their conversation is an ordinary fixed encounter (a zone in
// scene.interactables) that moves with them.
//
//   const crowd = new FaicheCrowd(scene, { ring, count: 6 })
//   crowd.update(delta, melee)          every frame
//   crowd.onMeleeEvent(name, data)      from MeleeBout
//   crowd.occupies(tx, ty)  crowd.at(tx, ty)  crowd.byId(id)
//   crowd.withdraw(s) / crowd.restore(s, [c, r])   out of the crowd (into the
//                                       ring, to fight you) and back again
//   crowd.addStudent()                  one more comes to watch
//   crowd.drawSwords(ctx)               their swords, after PGR draws (a drill)
//   crowd.destroy()
//
// A drill (faicheLesson.js): crowd.formation = true, and each student's
// s.goal = [c, r] (where to stand) and s.faceGoal (-1 / 1). In formation
// they walk to their places, don't jump back from your sword, and don't
// chat. s.kit is their sword (FigureSword): show / draw / salute / sheathe.
//
// PLACEHOLDER lines: English in both the Irish and English slots, to be
// replaced. Students' names stay out of the lines until they're settled.

import { SoundBoard } from '../../../systems/soundBoard.js'
import { GameState } from '../../../systems/gameState.js'
import FigureSword, { figureAt } from '../../../combat/figureSword.js'
import { VoiceSynth } from '../../../systems/voice/voiceSynth.js'

const GID0 = 9210                    // 9210-9229: the students (SKYE_GID is 92xx)

// Where they stand, in the order they arrive: round the fighting ring a
// little outside its line, by angle (0 = east, -90 = north), leaving the way
// in from the west and the foot of the dais stair clear.
const ANGLES = [-125, 20, -55, 100, 145, -15, 60, -150, 120, -35]
const SPOT_OUT = 1.4                 // tiles beyond the ring's edge

// Placeholder lines. ga = en until the Irish is written.
const L = (en) => ({ ga: en, en })
const COMMON = [
  L('Strike when he draws breath. You can hear it coming.'),
  L('Mind the Warden. He is slow, until he is not.'),
  L('Hold the blow and it lands harder. It costs you, mind.'),
  L('Walk into him and you might put him on his back.'),
  L('Knock the sword from his hand and the choice is yours.'),
  L('Hand a man his sword back and he will salute you for it.'),
  L('Swords are in the racks by the gate, if you have none.'),
  L('My arm is black and blue from yesterday.'),
  L('Uathach will be up on the platform before long.'),
  L('Yield cleanly if you must. Nobody here respects a sulker.'),
]
const COLD = [      // once you've struck a man without his sword
  L('We saw what you did. A man without his sword.'),
  L('Leave me be.'),
  L('There is no honour in that, and you know it.'),
]
// a card per line; the cold ones only once you've earned them
const N = (l, requires) => ({ ga: l.ga, en: l.en, ...(requires ? { requires } : {}) })
const dialoguesFor = (lines, i) => {
  const out = []
  lines.forEach((l, k) => { out.push(N(l)); if (k % 2 === 1) out.push(N(COLD[(i + k) % COLD.length], { note: 'struck_unarmed_warden' })) })
  return out
}
const STARTLED = [L('Mind yourself!'), L('Careful with that!'), L('Watch it!'), L('Ho there!')]

export const STUDENTS = [
  { id: 'ferdiad', frame: '038.png', color: '#9fd3ff', voice: 'dallan', lines: [
    L('Fer Diad. You will be the new one.'),
    L('Watch his feet, not his sword. The sword goes where the feet say.'),
    L('Two winters I have been here. I still cannot touch Scáthach.'),
    L('Uathach likes new ones. For about a week.'),
  ] },
  { id: 'ciaran', frame: '006.png', voice: 'dallan' },
  { id: 'eibhleann', frame: '035.png', voice: 'peig' },
  { id: 'fial', frame: '067.png', voice: 'peig' },
  { id: 'bearach', frame: '044.png', voice: 'ronnie' },
  { id: 'laoise', frame: '084.png', voice: 'peig' },
  { id: 'meallan', frame: '061.png', voice: 'dallan' },
  { id: 'saorla', frame: '041.png', voice: 'peig' },
  { id: 'cassan', frame: '076.png', voice: 'ronnie' },
  { id: 'eabhinn', frame: '080.png', voice: 'peig' },
]
const SPARE_FRAMES = ['005.png', '022.png', '036.png', '083.png']   // if one of theirs is yours
const STUDENT_COLOR = '#d9e6b0'
const TALK_RADIUS = 1.6              // tiles: next to them, diagonals included

const HOP_MS = 280, STEP_MS = 420, HOME_AFTER = 1600
const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]))

export default class FaicheCrowd {
  constructor(scene, { ring, count = 6 } = {}) {
    this.scene = scene
    this.ring = ring || { cx: 18.5, cy: 19.5, r: 7 }
    this.t = 0
    this.react = { kind: null, t0: -1e9 }
    this._lastHit = 0
    const pgr = scene.perspectiveGround
    const mine = scene.player?.champion?.spriteKey
    const spare = SPARE_FRAMES.filter(f => f !== mine)
    this._mine = mine; this._spare = spare
    const spots = this._spots(Math.min(count, STUDENTS.length))
    this.students = spots.map(([c, r], i) => this._make(i, c, r))
    pgr?.setEncounterFlags([...(pgr._encounterFlags || []), ...this.students.map(s => s.flag)])
    this._talkable = null
  }

  _make(i, c, r) {
      const s = STUDENTS[i]
      const frame = s.frame === this._mine ? this._spare.shift() : s.frame
      const gid = GID0 + i
      this._registerArt(gid, frame)
      const st = {
        ...s, gid, home: [c, r], c, r, from: null, t0: 0, ms: 0, hop: false,
        face: c + 0.5 < this.ring.cx ? 1 : -1,
        phase: Math.random() * 6.28, nextShift: 3000 + Math.random() * 9000, awayAt: 0,
        startleAt: -1e9, goal: null, faceGoal: null,
        kit: new FigureSword({ gid: 2492 }),
        lines: s.lines || COMMON.slice(i % 3).concat(COMMON.slice(0, i % 3)),
      }
      st.flag = { tileX: c, tileY: r, visual: { gid, flat: false }, offset: [0, 0], pose: null, student: st }
      st.zone = this._zoneFor(st, i)
      return st
  }

  byId(id) { return this.students.find(s => s.id === id) || null }

  // out of the crowd: hidden, not in anyone's way (they're in the ring, as a fighter)
  withdraw(s) { s.out = true; s.flag.hidden = true; s.from = null }
  // back among the others, at (c, r)
  restore(s, [c, r] = s.home) { s.out = false; s.flag.hidden = false; s.c = c; s.r = r; s.from = null; s.goal = null }

  // one more comes to watch (the tournament draws a crowd)
  addStudent() {
    const i = this.students.length
    if (i >= STUDENTS.length) return null
    const spot = this._spots(i + 1)[i]
    if (!spot) return null
    const st = this._make(i, spot[0], spot[1])
    this.students.push(st)
    const pgr = this.scene.perspectiveGround
    pgr?.setEncounterFlags([...(pgr._encounterFlags || []), st.flag])
    if (this._talkable && this.scene.interactables) this.scene.interactables.push(st.zone)
    return st
  }

  // their places round the ring: by angle, nudged outward off anything solid
  _spots(n) {
    const sc = this.scene, ts = sc.tileSize, g = this.ring, out = []
    for (const a of ANGLES) {
      if (out.length >= n) break
      for (let k = 0; k < 3; k++) {
        const R = g.r + SPOT_OUT + k * 0.7, rad = a * Math.PI / 180
        const c = Math.floor(g.cx + Math.cos(rad) * R), r = Math.floor(g.cy + Math.sin(rad) * R)
        if (sc.isColliding(c * ts + ts / 2, r * ts + ts / 2) || out.some(([x, y]) => x === c && y === r)) continue
        out.push([c, r]); break
      }
    }
    return out
  }

  // their conversation: an ordinary fixed encounter, so the moon shows their
  // face when you're close and a tap on it opens the card
  _zoneFor(st, i) {
    const sc = this.scene, ts = sc.tileSize
    const zone = sc.add.zone(0, 0, ts, ts)
    zone.setData('id', 'student_' + st.id)
    zone.setData('type', 'fixed_encounter')
    zone.setData('stateKey', `${sc.getMapKey?.() || 'skye_faiche'}.student_${st.id}`)
    zone.setData('flagVisual', { gid: st.gid, flat: false })
    zone.setData('visual', { gid: st.gid, flat: false })
    zone.setData('radius', TALK_RADIUS * ts)
    zone.setData('dialogues', dialoguesFor(st.lines, i))
    zone.setData('actions', [])
    return zone
  }

  // where the zones are, and whether they're there at all: not while your
  // sword is out
  _syncZones(melee) {
    const sc = this.scene, ts = sc.tileSize
    const talk = !(melee && (melee.enGarde || melee.combat)) && !this.formation
    if (!sc.interactables) return
    for (const s of this.students) {
      const [x, y] = s.out ? [-999, -999] : this._drawPos(s)
      const px = (x + 0.5) * ts, py = (y + 0.5) * ts
      s.zone.x = px; s.zone.y = py
      s.zone.setData('logicalX', px); s.zone.setData('logicalY', py)
    }
    if (talk === this._talkable) return
    this._talkable = talk
    const zones = this.students.map(s => s.zone)
    sc.interactables = sc.interactables.filter(z => !zones.includes(z))
    if (talk) sc.interactables.push(...zones)
  }

  // a champion sprite from the atlas, as a PGR tile for this student
  _registerArt(gid, frame) {
    const pgr = this.scene.perspectiveGround
    const img = this.scene.textures.get('championSheet_armored')?.getSourceImage?.()
    const atlas = this.scene.cache.json.get('championAtlas')
    const f = atlas?.textures?.[0]?.frames?.find(x => x.filename === frame)?.frame
    if (!pgr || !img || !f) return
    const c = document.createElement('canvas'); c.width = f.w; c.height = f.h
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false
    g.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h)
    pgr.registerCustomTile(gid, c.toDataURL())
  }

  occupies(tx, ty) { return !!this.at(tx, ty) }
  at(tx, ty) { return this.students.find(s => !s.out && s.c === tx && s.r === ty) || null }

  // ── the frame ────────────────────────────────────────────────────────────
  update(dt, melee) {
    this.t += Math.min(50, dt)
    const t = this.t
    const swords = melee && (melee.enGarde || melee.combat)
    const fighters = this._fighters(melee)
    for (const s of this.students) {
      if (s.out) continue
      if (s.from && t - s.t0 >= s.ms) { s.from = null; s.hop = false }
      if (!s.from && (this.formation || s.goal)) {
        // a drill: to their place, and stand there
        const g = s.goal || s.home
        if (s.c !== g[0] || s.r !== g[1]) this._stepToward(s, g, STEP_MS)
        else if (s.faceGoal) s.face = s.faceGoal
      } else if (!s.from) {
        const near = swords ? fighters.filter(f => cheb(f, [s.c, s.r]) <= 1) : []
        if (near.length) this._jumpBack(s, fighters)
        else if (s.c !== s.home[0] || s.r !== s.home[1]) {
          const clear = !fighters.length || !swords || fighters.every(f => cheb(f, [s.c, s.r]) >= 3 && cheb(f, s.home) >= 2)
          if (!clear) s.awayAt = t
          else if (t - s.awayAt > HOME_AFTER) this._stepToward(s, s.home, STEP_MS)
        } else if (t >= s.nextShift && !swords) {
          // a small shuffle on the spot now and then: turn about
          s.nextShift = t + 6000 + Math.random() * 10000
          s.face = -s.face
        }
      }
      // who they watch: the fight, if there is one; else the ring
      if (!this.formation && (melee?.combat || (swords && fighters.length))) {
        const mid = this._fightMid(melee)
        if (Math.abs(mid[0] - s.c) > 0.3) s.face = mid[0] < s.c ? -1 : 1
      }
      const [x, y] = this._drawPos(s)
      s.flag.tileX = s.c; s.flag.tileY = s.r
      s.flag.offset[0] = x - s.c; s.flag.offset[1] = y - s.r
      s.flag.pose = this._pose(s, melee)
    }
    this._syncZones(melee)
  }

  _playerTile() {
    const p = this.scene.player, ts = this.scene.tileSize
    if (!p) return [-99, -99]
    const x = p.isMoving ? p.targetX : p.logicalX, y = p.isMoving ? p.targetY : p.logicalY
    return [Math.floor(x / ts), Math.floor(y / ts)]
  }
  _fighters(m) {
    const out = [this._playerTile()]
    if (m?.pa) out.push(m.pa.fromTile())
    if (m && !m.noFoe) out.push([m.foe.c, m.foe.r])
    return out
  }
  _fightMid(m) {
    const p = this._playerTile()
    if (!m || m.noFoe || !m.combat) return p
    return [(p[0] + m.foe.c) / 2, (p[1] + m.foe.r) / 2]
  }

  _free(c, r, fighters) {
    const sc = this.scene, ts = sc.tileSize
    if (c < 1 || r < 1 || c >= sc.mapData.width - 1 || r >= sc.mapData.height - 1) return false
    if (sc.isColliding(c * ts + ts / 2, r * ts + ts / 2)) return false
    if (this.at(c, r)) return false
    if (fighters.some(f => f[0] === c && f[1] === r)) return false
    if (sc._melee?.occupies?.(c, r)) return false
    return true
  }

  // Out of the way: the free tile next to them furthest from the fighters,
  // not too far from home. A startled word now and then.
  _jumpBack(s, fighters) {
    let best = null, bestScore = -1
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue
      const c = s.c + dx, r = s.r + dy
      if (!this._free(c, r, fighters) || cheb([c, r], s.home) > 3) continue
      const score = Math.min(...fighters.map(f => cheb(f, [c, r]))) * 10 - cheb([c, r], s.home) + Math.random()
      if (score > bestScore) { best = [c, r]; bestScore = score }
    }
    s.awayAt = this.t
    if (!best) return
    s.from = [s.c, s.r]; s.t0 = this.t; s.ms = HOP_MS; s.hop = true
    s.c = best[0]; s.r = best[1]
    SoundBoard.playWeb('FOOT_SHUFFLE', this.scene, { pitch: 0.9, volume: 0.04 })
    if (this.t - s.startleAt > 6000 && Math.random() < 0.5) {
      s.startleAt = this.t
      const line = STARTLED[Math.floor(Math.random() * STARTLED.length)]
      this.scene._caption?.setColor?.(s.color || STUDENT_COLOR)
      this.scene._caption?.show(line.ga, line.en, 1100)
      this._speak(s, line.ga)
    }
  }

  _stepToward(s, goal, ms) {
    const fighters = this._fighters(this.scene._melee?.melee)
    const dx = Math.sign(goal[0] - s.c), dy = Math.sign(goal[1] - s.r)
    const tries = [[s.c + dx, s.r + dy], [s.c + dx, s.r], [s.c, s.r + dy]]
    // blocked straight on: any step that doesn't take them further away
    const d0 = cheb([s.c, s.r], goal)
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) if (cheb([s.c + ox, s.r + oy], goal) <= d0) tries.push([s.c + ox, s.r + oy])
    for (const [c, r] of tries) {
      if ((c === s.c && r === s.r) || !this._free(c, r, fighters)) continue
      s.from = [s.c, s.r]; s.t0 = this.t; s.ms = ms; s.hop = false
      if (c !== s.c) s.face = c < s.c ? -1 : 1
      s.c = c; s.r = r
      return
    }
  }

  _drawPos(s) {
    if (!s.from) return [s.c, s.r]
    const k = Math.min(1, (this.t - s.t0) / s.ms), e = s.hop ? 1 - (1 - k) * (1 - k) : k
    return [s.from[0] + (s.c - s.from[0]) * e, s.from[1] + (s.r - s.from[1]) * e]
  }

  // How each one stands: breathing, a weight shift, leaning in to watch,
  // hopping for joy, recoiling at a boo.
  _pose(s, melee) {
    const t = this.t / 1000, ph = s.phase, R = this.react, el = this.t - R.t0
    let dy = 0, rot = Math.sin(t * 0.5 + ph) * 0.025, sy = 1 + Math.sin(t * 2.1 + ph) * 0.012
    if (melee?.combat) rot += s.face * 0.05 + Math.sin(t * 3 + ph) * 0.015       // leaning in
    if (s.from && s.hop) dy -= Math.sin(Math.PI * Math.min(1, (this.t - s.t0) / s.ms)) * 0.22
    else if (s.from) dy -= Math.abs(Math.sin(Math.PI * 2 * (this.t - s.t0) / s.ms)) * 0.03
    const lag = (ph / 6.28) * 300                                                    // not all at once
    const k = (el - lag) / 1000
    if (k > 0) {
      if (R.kind === 'cheer' && k < 1.6) dy -= Math.abs(Math.sin(k * 9 + ph)) * 0.09 * (1 - k / 1.6)
      if (R.kind === 'boo' && k < 1.8) rot -= s.face * 0.09 * Math.sin(Math.min(1, k * 3) * Math.PI / 2) * (1 - k / 1.8)
      if (R.kind === 'ooh' && k < 0.8) rot += s.face * 0.08 * Math.sin(k / 0.8 * Math.PI)
    }
    return { dy, rot, sx: s.face, sy }
  }

  // ── reactions to the fight ───────────────────────────────────────────────
  onMeleeEvent(name, d = {}) {
    const sfx = (k, o) => SoundBoard.playWeb(k, this.scene, o)
    const n = this.students.length
    switch (name) {
      case 'boutOver':
        if (d.won) { this.react = { kind: 'cheer', t0: this.t }; sfx('CROWD_CLAP', { n: Math.max(3, n), dur: 2.4, warmth: 0.9 }) }
        else { this.react = { kind: 'ooh', t0: this.t }; setTimeout(() => sfx('CROWD_CLAP', { n: Math.max(2, Math.round(n / 2)), dur: 1.4, warmth: 0.3, volume: 0.15 }), 900) }
        break
      case 'cheapShot':
      case 'struckUnarmed':
        this.react = { kind: 'boo', t0: this.t }
        setTimeout(() => sfx('CROWD_BOO', { kind: 'boo', n: Math.max(3, n) }), 350)
        break
      case 'knockdown':
        if (d.final || d.hard) break
        if (this.t - this._lastHit < 1500) break
        this._lastHit = this.t
        this.react = { kind: 'ooh', t0: this.t }
        sfx('CROWD_BOO', { kind: 'ooh', n: Math.max(3, Math.round(n * 0.7)), volume: 0.06 })
        break
      case 'disarm':
        this.react = { kind: 'ooh', t0: this.t }
        sfx('CROWD_BOO', { kind: 'ooh', n: Math.max(3, Math.round(n * 0.6)), volume: 0.05 })
        break
      case 'swordReturned':
        this.react = { kind: 'cheer', t0: this.t }
        sfx('CROWD_CLAP', { n: Math.max(2, Math.round(n / 2)), dur: 1.2, warmth: 0.6, volume: 0.14 })
        break
    }
  }

  // a word out loud, in their own voice (voiceSynth.js)
  _speak(s, text) {
    if (!this.voice) { const ac = SoundBoard.ctx(this.scene); this.voice = ac ? new VoiceSynth({ audioContext: ac, volume: 0.5 }) : null }
    try { this.voice?.stop(); this.voice?.speak(text, { voice: s.voice || 'dallan', tuneKey: 'G' }) } catch (_) {}
  }

  // their swords, drawn over the figures (as the Warden's is)
  drawSwords(ctx) {
    const now = performance.now()
    for (const s of this.students) {
      if (s.out || s.kit.state === 'none') continue
      const [x, y] = this._drawPos(s)
      s.kit.paint(ctx, this.scene, figureAt(this.scene, x, y), s.face, s.flag.pose, now)
    }
  }

  animating() { return true }

  destroy() {
    const pgr = this.scene.perspectiveGround
    if (pgr?._encounterFlags) pgr.setEncounterFlags(pgr._encounterFlags.filter(f => !f.student))
    const zones = this.students.map(s => s.zone)
    if (this.scene.interactables) this.scene.interactables = this.scene.interactables.filter(z => !zones.includes(z))
    zones.forEach(z => z?.destroy?.())
    try { this.voice?.stop() } catch (_) {}
    this.students = []
  }
}

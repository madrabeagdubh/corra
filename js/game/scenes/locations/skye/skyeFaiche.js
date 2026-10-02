// skyeFaiche.js
// Location: js/game/scenes/locations/skye/skyeFaiche.js
//
// The practice green: a marked ring of worn ground for drills and bouts,
// a raised platform (the dais) to the north for the teacher, weapon racks
// either side of it, dummies along the east side, banners round
// the ring (faicheGrounds.js), and the students standing round it in a
// loose ring (faicheCrowd.js). Layout comes from the map (mapData.faiche,
// written by skye_gen.mjs).
//
// The first lesson runs here (faicheLesson.js): falling in, and the salute,
// with Uathach on the dais and the Warden as her second. Until it's done the
// Warden can't be fought; afterwards he's back in the middle of the ring as
// a sparring partner.
//
// Then the tournament (faicheTournament.js): the students one at a time,
// easiest first, the Warden refereeing; and last, Uathach with a live blade,
// and the coin that turns the brooch silver.
//
// Your sword comes from a rack: walk up to one, its picture shows on the
// moon, tap it. From then on the sword is yours, in every scene.
//
// Every perspective scene gives you your sword (perspectiveScene: _melee,
// a foe-less MeleeBout). Here that's swapped for one with the Warden in it.
// Equip the sword, swipe UP on the moon to stand en garde; up again is a
// salute. Come within five tiles en garde and he's a threat. Swipe DOWN to
// stand at ease (mid-bout, that's yielding). Nobody dies: the blow that
// would take a last heart ends the bout. See js/game/combat/meleeBout.js.
//
// Students talk the usual way: close by, sword away, their face on the moon.

import SkyeScene, { SKYE_GID } from './skyeScene.js'
import SkyeCaption from './skyeCaption.js'
import FaicheGrounds from './faicheGrounds.js'
import FaicheCrowd from './faicheCrowd.js'
import FaicheLesson, { SPAR_DONE } from './faicheLesson.js'
import FaicheTournament, { TOURNEY_DONE } from './faicheTournament.js'
import MeleeBout, { prepareSword, SWORD_NOTE } from '../../../combat/meleeBout.js'
import { GameState } from '../../../systems/gameState.js'
import { SoundBoard } from '../../../systems/soundBoard.js'

const STUDENTS = 8                    // seven fall in for the drill; more will come with the tournament
const RACK_GID0 = 9240                // the racks' pictures, for the moon's badge

// A rack's conversation: take a sword, once.
const L = (en, ga = en) => ({ ga, en })
const RACK_DIALOGUE = [
  { requires: { noteAbsent: SWORD_NOTE }, hold: true,
    ...L('A rack of practice swords: ash, worn smooth at the grip.'),
    options: [
      { ...L('Take one.'), note: SWORD_NOTE, exit: true },
      { ...L('Leave them.'), exit: true },
    ] },
  { requires: { note: SWORD_NOTE }, ...L('Practice swords. You have one already.') },
]

export class SkyeFaiche extends SkyeScene {
  constructor() { super({ key: 'skye_faiche' }) }
  getMapKey() { return 'skye_faiche' }

  async create(data) {
    await super.create(data)
    if (!this.player) return                    // base create failed (logged)
    const layout = this.mapData.faiche || {}
    const ring = layout.ring || { cx: 18.5, cy: 19.5, r: 7 }
    this._caption = new SkyeCaption({ scene: this })

    this._grounds = new FaicheGrounds(this, layout)
    const pgr = this.perspectiveGround
    pgr?.setStructures(this._grounds)
    pgr?.setEncounterFlags([...(pgr._encounterFlags || []), ...this._grounds.flags])
    this._makeRackZones()

    prepareSword(this)                          // yours already? then it's in your pack
    this._hadSword = GameState.hasNote(SWORD_NOTE)
    this._melee?.destroy()
    this._wardenHome = [Math.floor(ring.cx), Math.floor(ring.cy)]
    this._melee = new MeleeBout(this, { kind: 'warden', home: this._wardenHome, gid: SKYE_GID.WARDEN })
    this._crowd = new FaicheCrowd(this, { ring, count: STUDENTS })
    this._lesson = new FaicheLesson(this, { crowd: this._crowd, grounds: this._grounds })

    this.events.once('shutdown', () => {
      this._caption?.destroy(); this._caption = null
      this._tourney?.destroy(); this._tourney = null
      this._lesson?.destroy(); this._lesson = null
      this._crowd?.destroy(); this._crowd = null
      this._grounds = null
    })
  }

  // each rack shows on the moon when you're beside it; tap it to take a sword
  _makeRackZones() {
    const ts = this.tileSize, pgr = this.perspectiveGround
    this._grounds.racks.forEach((rk, i) => {
      const gid = RACK_GID0 + i
      pgr?.registerCustomTile?.(gid, this._grounds.rackIcon(i).toDataURL())
      const x = rk.x * ts + ts / 2, y = rk.y * ts + ts / 2
      const zone = this.add.zone(x, y, ts, ts)
      zone.setData('id', 'rack_' + i)
      zone.setData('type', 'fixed_encounter')
      zone.setData('stateKey', `skye_faiche.rack_${i}`)
      zone.setData('flagVisual', { gid, flat: false })
      zone.setData('visual', { gid, flat: false })
      zone.setData('radius', 1.6 * ts)
      zone.setData('dialogues', RACK_DIALOGUE)
      zone.setData('actions', [])
      zone.setData('logicalX', x); zone.setData('logicalY', y)
      this.interactables?.push(zone)
    })
  }

  update(time, delta) {
    super.update(time, delta)
    if (!this.player || !this._grounds) return                // not built yet (create is async)
    // a sword just taken from a rack: into your pack, and one fewer in the rack
    if (!this._hadSword && GameState.hasNote(SWORD_NOTE)) {
      this._hadSword = true
      prepareSword(this)
      const ts = this.tileSize, px = this.player.logicalX / ts, py = this.player.logicalY / ts
      let best = 0, bd = 1e9
      this._grounds.racks.forEach((r, i) => { const d = Math.hypot(r.x - px, r.y - py); if (d < bd) { bd = d; best = i } })
      this._grounds.takeSword(best)
      SoundBoard.playWeb('BLADE_KNOCK', this, { hard: 0.08, pitch: 0.8, volume: 0.3 })
    }
    if (this._encounterPanel?._isOpen) return
    this._crowd?.update(delta, this._melee?.melee)
    this._lesson?.update(delta)
    this._tourney?.update(delta)
    // the lessons are all done: a few moments later, the tournament
    if (!this._tourney && this._lesson?.phase === 'done' && GameState.hasNote(SPAR_DONE) && !GameState.hasNote(TOURNEY_DONE)) {
      this._tourneyIn = (this._tourneyIn || 0) + delta
      if (this._tourneyIn > 6000) this._tourney = new FaicheTournament(this, { crowd: this._crowd, lesson: this._lesson, grounds: this._grounds })
    }
  }

  // the students' swords and Uathach's, over the figures
  onPGRDrawComplete(ctx) {
    this._crowd?.drawSwords(ctx)
    this._lesson?.draw(ctx)
    this._tourney?.draw(ctx)
  }

  // ── the students ─────────────────────────────────────────────────────────
  onMeleeEvent(name, d) { this._crowd?.onMeleeEvent(name, d); this._lesson?.onMeleeEvent(name, d); this._tourney?.onMeleeEvent(name, d) }
  figureAt(tx, ty) { return !!this._crowd?.occupies(tx, ty) || this._uathachAt(tx, ty) || !!this._lesson?.occupies(tx, ty) }
  _uathachAt(tx, ty) { const u = this._lesson?.u; return !!u && u.c === tx && u.r === ty }
  isOccupied(x, y) {
    const tx = Math.floor(x / this.tileSize), ty = Math.floor(y / this.tileSize)
    return super.isOccupied(x, y) || this.figureAt(tx, ty)
  }
  // a tap on the training dummy: a cut, or a walk up to it
  _onTapBeforePath(canvasX, canvasY) {
    if (this._lesson?.tapDummy(canvasX, canvasY)) return false
    return super._onTapBeforePath?.(canvasX, canvasY) ?? true
  }
  // the training dummy, when it's out: the camera closes in on it with you
  lensFocus() { return this._lesson?.lensFocus() ?? null }
  // Walked into someone: a student (or Uathach) just stands their ground;
  // anyone else (the Warden) is the fight's business.
  onBumpFigure(dx, dy) {
    const p = this.player, ts = this.tileSize
    const tx = Math.floor(p.logicalX / ts) + dx, ty = Math.floor(p.logicalY / ts) + dy
    if (this._lesson?.occupies(tx, ty)) { this._lesson.bumpDummy(dx); return }   // a shove at the dummy
    if (this._crowd?.at(tx, ty) || this._uathachAt(tx, ty)) return
    super.onBumpFigure(dx, dy)
  }
}

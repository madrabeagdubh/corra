// gardenDummy.js
// Location: js/game/scenes/locations/skye/gardenDummy.js
//
// The training dummy, brought into the garden for the crash course. It is
// the green's own straw post (FaicheGrounds draws it, rocking when hit);
// this just owns one of them: hidden until the lesson, carried about by
// Conall, set down on a tile where it blocks like a figure.
//
//   const d = new GardenDummy(scene, [26, 14])
//   d.show(); d.hide()
//   d.place(x, y, carried)       fractional tiles while carried
//   d.hit(dir)                   set it rocking
//   d.at                         [c, r] when standing on the ground, else null
//   d.occupies(tx, ty)
//   d.destroy()

import FaicheGrounds from './faicheGrounds.js'

export default class GardenDummy {
  constructor(scene, tile) {
    this.scene = scene
    this.grounds = new FaicheGrounds(scene, { dummies: [[tile[0], tile[1]]] })
    this.flag = this.grounds.flags.find(f => f.prop === 'dummy')
    this.flag.hidden = true
    this.visible = false
    this.carried = false
    const pgr = scene.perspectiveGround
    pgr?.setEncounterFlags([...(pgr._encounterFlags || []), this.flag])
    this.place(tile[0], tile[1], false)
  }

  show() { this.visible = true; this.flag.hidden = false; this.scene.perspectiveGround?.forceRedraw?.() }
  hide() { this.visible = false; this.flag.hidden = true; this.scene.perspectiveGround?.forceRedraw?.() }

  place(x, y, carried = false) {
    this.carried = carried
    this.grounds.placeDummy(0, x, y, carried)
    this.tile = [Math.round(x), Math.round(y)]
  }
  hit(dir = 1) { this.grounds.hitDummy(0, dir) }

  /** the tile it stands on, if it is standing */
  get at() { return this.visible && !this.carried ? this.tile : null }
  occupies(tx, ty) { const a = this.at; return !!a && a[0] === tx && a[1] === ty }

  destroy() {
    const pgr = this.scene.perspectiveGround
    if (pgr?._encounterFlags) pgr.setEncounterFlags(pgr._encounterFlags.filter(f => f !== this.flag))
  }
}

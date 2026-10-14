// otherside1.js
// Location: js/game/scenes/locations/cave/otherside1.js
//
// The other side, first layer: the web of passages from tools/map-editor/generators/otherside_gen.mjs, in the
// cave's own light and rock (CaveTest), with eyes in the dark (effects/watchers.js) and its own sounds
// (systems/underworldAudio.js). You wake in a drowned ring that is the cave's ring; the walls are not all wall.
//
//   ?scene=otherside1           same knobs as ?scene=caveTest (torch, knee, wallH ...)
//   &eyes=0                     no watchers      &count=5   how many
//   &sound=0                    no sound
//   &at=57,54                   start on this tile

import CaveTest from './caveTest.js'
import Watchers from '../../../effects/watchers.js'
import UnderworldAudio from '../../../systems/underworldAudio.js'

const Q = new URLSearchParams(window.location.search)

export default class Otherside1 extends CaveTest {
  constructor() { super('otherside1') }

  getMapKey() { return 'otherside1' }

  onEnter() {
    super.onEnter()
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
    if (Q.get('eyes') !== '0') {
      this.watchers = new Watchers(this, this.cave, md.eyes || [], { count: Number(Q.get('count') || 5), audio: this.audio })
    }
    this._wetT = 0
  }

  update(time, delta) {
    super.update(time, delta)
    this.watchers?.update(delta)
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

  _cleanup() {
    this.watchers?.destroy(); this.watchers = null
    this.audio?.destroy(); this.audio = null
    super._cleanup()
  }
}

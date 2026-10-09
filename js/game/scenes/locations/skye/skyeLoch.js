// skyeLoch.js
// Location: js/game/scenes/locations/skye/skyeLoch.js
//
// The loch: a lake with an island in it, on the way to the tournament. Garbhán holds the island
// (garbhan.js runs him and the fight), and the way across is two lines of stepping stones.
//
//   south shore  you arrive from the cladach (spawn)
//   the lake     water right across the map at its waist: no walking round it
//   the island   an oval of dry ground in the middle, boulders on it; Garbhán waits at mapData.garbhanHome
//   north shore  hills in the corners; the exit to the machaire
//
// Water is LOCH (1679): walkable for the d-pad, blocked for the pathfinder (_buildWalkGrid), so a
// tapped route only ever lands on stones. Step into it and you are dunked: splash, a fade, and back
// to your last dry footing -- except in Garbhán's fight, when the lake drowns you by his rules
// (isWet / this.fighting; garbhan.js).
//
// Tap-to-move is ON here. ?garbhan=1 brings him back if he has gone (for testing).
//
// Layout (stones, the ruined standing stone, thickets, flowers, the island) comes from the map JSON -- see skye_gen.mjs (skye_loch).

import SkyeScene, { SKYE_GID } from './skyeScene.js'
import { GameState } from '../../../systems/gameState.js'
import SkyeCaption from './skyeCaption.js'
import LochStones from './lochStones.js'
import StandingStones from './standingStones.js'
import skyeFlora from './skyeFlora.js'
import { combineStructures } from './harbourWall.js'
import { figureBox, splash } from './dustDash.js'
import Garbhan, { NOTES as GARBHAN_NOTES } from './garbhan.js'

const LOCH = 1679

export class SkyeLoch extends SkyeScene {
  constructor() { super({ key: 'skye_loch' }) }
  getMapKey() { return 'skye_loch' }

  // Loch water: walkable (you can step in -- and get dunked)...
  getExtraUnwalkableGIDs() {
    const s = super.getExtraUnwalkableGIDs()
    s.delete(LOCH)
    return s
  }

  // ...but never part of a tapped route: the pathfinder sees only stones.
  _buildWalkGrid() {
    const g = super._buildWalkGrid()
    const L0 = this.mapData.layers[0]
    for (let y = 0; y < g.length; y++) {
      for (let x = 0; x < g[y].length; x++) {
        if (L0[y]?.[x] === LOCH && !this._isStone(x, y)) g[y][x] = false
      }
    }
    return g
  }

  _isStone(x, y) {
    if (!this._stoneSet) this._stoneSet = new Set((this.mapData?.stones || []).map(([a, b]) => `${a},${b}`))
    return this._stoneSet.has(`${x},${y}`)
  }

  // Water you'd drown in: loch water that is not a stone (a fight's pa.wet asks)
  // His conversation is opened by garbhan.js: the map's own zone and figure for it (the data file's
  // fixedEncounters entry, which is there for his words) are not wanted.
  _dropGarbhanCard() {
    for (const f of this.perspectiveGround?._encounterFlags || []) if (f.visual?.gid === SKYE_GID.GARBHAN) f.hidden = true
    const zs = (this.interactables || []).filter(o => o.getData?.('type') === 'fixed_encounter')
    for (const o of zs) { this.interactables.splice(this.interactables.indexOf(o), 1); o.destroy?.() }
  }

  isWet(x, y) { return this.mapData?.layers[0][y]?.[x] === LOCH && !this._isStone(x, y) }

  // Wildflowers by the shore, gorse and bramble thickets, harebells on the slopes (skyeFlora.js)
  getVegetation() { return skyeFlora(this) }

  async create(data) {
    await super.create(data)
    if (!this.player) return

    this._caption = new SkyeCaption({ scene: this, focusOn: () => this._speakerAt() })
    this.perspectiveGround?.setStructures(combineStructures(
      new LochStones(this, this.mapData.stones),
      new StandingStones(this, this.mapData.standingStones),
    ))
    this._phase = 'free'
    this._dropGarbhanCard()

    // A stone sits on a water tile; stood on, it's ground, not water (no
    // wading slow-down or sink).
    const tm = this.terrainManager
    if (tm?.getTerrainByTileType) {
      const orig = tm.getTerrainByTileType.bind(tm)
      const wet = { ...tm.terrainTypes.water, damagePerSecond: 0 }      // in his fight the engine drowns you (garbhan.js), not the terrain
      tm.getTerrainByTileType = (t) => {
        if (this._onStone()) return tm.terrainTypes.normal
        const terrain = orig(t)
        return this._garbhan?.fighting && terrain === tm.terrainTypes.water ? wet : terrain
      }
    }

    this._garbhanForced()
    this._garbhan = new Garbhan(this)

    this.events.once('shutdown', () => this._teardown())
  }

  update(time, delta) {
    if (this._dunking) this.joystick?.reset?.()          // no moving while under
    super.update(time, delta)
    if (!this.player || !this._caption) return

    const ts = this.tileSize
    const tx = Math.floor(this.player.logicalX / ts), ty = Math.floor(this.player.logicalY / ts)
    const inWater = this.isWet(tx, ty)
    if (!inWater && !this._dunking) this._lastSafe = [tx, ty]
    if (inWater && !this._dunking && !this._garbhan?.fighting) this._dunk()      // not in his fight: he drowns you himself
    if (!this._encounterPanel?._isOpen) this._garbhan?.update(delta)
  }

  // Taps work here, just not mid-dunk or while he talks.
  _onTapBeforePath() { return !this._dunking && !this._garbhan?.talking }

  // ── Garbhán (garbhan.js) ─────────────────────────────────────────────────
  onMeleeEvent(name, d) { this._garbhan?.onMeleeEvent(name, d) }
  // ?garbhan=1: meet him whatever the save says (he comes back if he had gone)
  _garbhanForced() {
    try {
      if (new URLSearchParams(window.location.search).get('garbhan')) GameState.removeNote(GARBHAN_NOTES.gone)
    } catch (_) {}
  }

  // ── the dunk ─────────────────────────────────────────────────────────────
  // Splash, a fade, and quietly back to your last dry footing.
  _dunk() {
    this._dunking = true
    this.player.clearPath?.()
    const ts = this.tileSize
    splash(this, figureBox(this, Math.floor(this.player.logicalX / ts), Math.floor(this.player.logicalY / ts)))
    const back = this._lastSafe || [this.mapData.spawns.player.x, this.mapData.spawns.player.y]
    this.time.delayedCall(450, () => this._fade(1, 260))
    this.time.delayedCall(800, () => {
      this._teleport(back)
      this._fade(0, 320)
      this.time.delayedCall(350, () => { this._dunking = false })
    })
  }

  _teleport([tx, ty]) {
    const ts = this.tileSize, px = tx * ts + ts / 2, py = ty * ts + ts / 2
    const p = this.player
    p.clearPath?.()
    p.isMoving = false
    p.logicalX = p.targetX = p.startX = px
    p.logicalY = p.targetY = p.startY = py
    this._camProxy?.setPosition(px, py)
    this.cameras.main.centerOn(px, py)
    this._lastTile = [tx, ty]
    this.perspectiveGround?.forceRedraw?.()
  }

  // A black veil over everything but the d-pad and captions (PGR's canvases
  // are DOM layers, so a Phaser camera fade wouldn't cover them).
  _fade(to, ms) {
    if (!this._veil) {
      const v = document.createElement('div')
      v.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:1000002;transition:opacity 0.25s linear'
      document.body.appendChild(v)
      this._veil = v
    }
    this._veil.style.transitionDuration = ms + 'ms'
    this._veil.style.opacity = String(to)
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  // Where the speaker is standing, for the caption's focus -- or null.
  _speakerAt() { return this._garbhan?.speakerTile() ?? null }

  _onStone() {
    const p = this.player, ts = this.tileSize
    if (!p) return false
    const bx = p.isMoving ? p.startX : p.logicalX, by = p.isMoving ? p.startY : p.logicalY
    return this._isStone(Math.floor(bx / ts), Math.floor(by / ts))
  }

  _teardown() {
    this._garbhan?.destroy()
    this._garbhan = null
    this._veil?.remove()
    this._veil = null
    this._caption?.destroy()
    this._caption = null
  }
}

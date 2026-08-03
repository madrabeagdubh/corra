import { GameState } from '../../../systems/gameState.js'
import RiverScene from '../riverScene.js'

// Synthetic GID for the briugu's sprite, registered in create() below.
// Must not collide with real tileset GIDs or with the others in use:
// 9001 harp (villageScene), 9101 Muireann (d3Sea).
// Keep in sync with visual.gid in public/data/bog/d3.js.
const BRIUGU_GID = 9102

export default class BogD3 extends RiverScene {
  constructor() { super({ key: 'd3' }) }

  // The shared forest deck strews a chest, a book and a fire across the map.
  // On a river map the player is in a boat and those cards read as debris,
  // competing with the one encounter that is meant to be noticed. Same
  // override d3Sea uses.
  _placeEncounterDeck() {}
  getMapKey()      { return 'd3' }
  getAmbient()     { return 0x1a2a2a }
  getPlayerLight() { return { color: 0xcceeee, intensity: 1.7, radius: 300 } }
  getWisps()       { return [] }
  getMusicTrack()  { return null }
  getSkyImage()    { return '/assets/skies/bog_threshold_sky.png' }
  getSkyPosition() { return '75% 50%' }
  getMountainPosition() { return '75% 60%' }

  preload() {
    super.preload()
    this.load.image('boat', '/assets/boat.png')
  }

  // NOTE the signature: the base create() is async and takes `data`, and
  // d3Sea does the same. Overriding it as a plain create() with no await
  // would run this before the ground renderer exists.
  async create(data) {
    await super.create(data)
    // Placeholder art: he is using Muireann's image until he has his own.
    // Swap the URL here and the sprite changes; swap `portrait` in
    // public/data/bog/d3.js and the dialogue card changes.
    this.perspectiveGround?.registerCustomTile?.(BRIUGU_GID, '/assets/npcs/muireann.png')
  }

  onEnter() {
    const edge = this.entryData?.entryEdge
    const fromEast = !edge || edge === 'east'
    // Restore moored boat from GameState, or activate if arriving from east
    this._restoreBoatOnEnter({ activateIfNoSave: fromEast })
  }
}


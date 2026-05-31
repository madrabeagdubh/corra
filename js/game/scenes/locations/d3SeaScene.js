// d3SeaScene.js
// Location: js/game/scenes/locations/d3SeaScene.js
//
// The estuary / sea crossing map.
// Extends RiverScene for boat support and ElevationRenderer for cliffs.

import RiverScene from './riverScene.js'

export default class D3SeaScene extends RiverScene {

  getMapKey()           { return 'd3_sea' }
  getAmbient()          { return 0x334422 }
  getPlayerLight()      { return { color: 0xfff2cc, intensity: 2.0, radius: 300 } }
  getSkyImage()         { return '/assets/skies/bog_threshold_sky.png' }
  getSkyPosition()      { return '50% 50%' }
  getMountainImage()    { return '/assets/thresholdMountains.png' }
  getMountainPosition() { return '50% 100%' }

  getElevationConfig() {
    return {
      cliffGids:    new Set([740]),
      cliffFaceGid: 740,
      elevatedGids: new Set([839, 840]),
      cliffSouth:   new Set([731, 1625, 1679]),
      cliffHeight:  1.0,
    }
  }

  onEnter() {
    // Restore boat from GameState, or activate immediately if no save.
    // activateIfNoSave:true means the player always arrives by boat on this map.
    this._restoreBoatOnEnter({ activateIfNoSave: true })
  }
}


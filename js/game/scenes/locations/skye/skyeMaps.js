// skyeMaps.js
// Location: js/game/scenes/locations/skye/skyeMaps.js
//
// One tiny subclass per Skye map. Per-map tuning (sky, light, music,
// onEnter hooks) goes here as each map gets real content.

import SkyeScene from './skyeScene.js'
import { SkyeCladach } from './skyeCladach.js'
import { SkyeLoch } from './skyeLoch.js'
import { SkyeGairdin } from './skyeGairdin.js'
import { SkyeFaiche } from './skyeFaiche.js'
import { TighConaill } from './tighConaill.js'
import { TighAmuigh } from './tighAmuigh.js'
import skyeFlora from './skyeFlora.js'
import FarShips from '../../../effects/farShips.js'

// SkyeCladach (the shore) and SkyeLoch carry Uathach's movement lesson:
// see skyeCladach.js and skyeLoch.js

// The sea to the north of the machaire (the vista skye_farraige_w, drawn beyond row 0): a far coast of
// highlands -- the shore of Dal Riata -- islets, and ships under sail (effects/farShips.js).
// pgrFarBackdrop.js paints the far water and hills; lift raises them against the sky painting.
const FAR_SEA_W = {
  sea:  { horizon: '#bcc4c1', mid: '#8fa9ac', near: '#4f7878', glint: '#eef3ee' },
  land: '#5a8456',
  lift: 0.1,
  layers: [
    { d: 90,  h: 1.6,  freq: 0.07,  cut: 0.60, sharp: 0.8, fog: 0.38, seed: 41 },     // a few low skerries
    { d: 140, h: 3.0,  freq: 0.04,  cut: 0.50, sharp: 1.0, fog: 0.50, seed: 47 },
    { d: 250, h: 6.5,  freq: 0.024, cut: 0.38, sharp: 1.1, fog: 0.62, seed: 53 },    // the coast across the water
    { d: 420, h: 10.5, freq: 0.014, cut: 0.32, sharp: 1.2, fog: 0.76, seed: 59 },
    { d: 650, h: 14.0, freq: 0.009, cut: 0.28, sharp: 1.2, fog: 0.86, seed: 61 },    // mountains at the edge of sight
  ],
}
// x, row (local to skye_farraige_w), heading: all in open water (no islet within a row or two)
const SHIPS_W = [[12, -30, 1], [27, -20, -1], [19.5, -46, 1]]

export class SkyeMachaire extends SkyeScene {
  constructor() { super({ key: 'skye_machaire' }) }
  getMapKey() { return 'skye_machaire' }
  getVegetation() { return skyeFlora(this) }
  getFarBackdrop() { return FAR_SEA_W }
  async create(data) { await super.create(data); this._ships = new FarShips({ ships: SHIPS_W }) }
  // PGR calls this once a frame, after the vista's tiles and before the machaire's own rows
  drawFarHost(ctx, pgr) { this._ships?.draw(ctx, pgr) }
}

// SkyeFaiche (the practice green, the Warden) is in skyeFaiche.js

export class SkyeDroichead extends SkyeScene {
  constructor() { super({ key: 'skye_droichead' }) }
  getMapKey() { return 'skye_droichead' }
}

export class SkyeDun extends SkyeScene {
  constructor() { super({ key: 'skye_dun' }) }
  getMapKey() { return 'skye_dun' }
}

export const SKYE_SCENES = [SkyeCladach, SkyeGairdin, SkyeLoch, SkyeMachaire, SkyeFaiche, SkyeDroichead, SkyeDun, TighConaill, TighAmuigh]

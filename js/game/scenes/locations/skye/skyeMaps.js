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

// SkyeCladach (the shore) and SkyeLoch carry Uathach's movement lesson:
// see skyeCladach.js and skyeLoch.js

export class SkyeMachaire extends SkyeScene {
  constructor() { super({ key: 'skye_machaire' }) }
  getMapKey() { return 'skye_machaire' }
  getVegetation() { return skyeFlora(this) }
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

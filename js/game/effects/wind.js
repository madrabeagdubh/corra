// wind.js
// Location: js/game/effects/wind.js
//
// One wind, shared by everything. A single exported instance that effects read
// rather than each inventing its own drift constant (distantRain has
// WIND_DRIFT, stormOverlay rolls its own — both can be pointed here later).
//
// The important property is that gusts TRAVEL. Effects sample phaseAt(worldX)
// instead of the raw clock, so a gust arrives at the left of a field before the
// right. That is the difference between "things are animated" and "there is
// weather here", and it costs one subtraction.
//
// Usage:
//   import { wind } from '../../effects/wind.js'
//   wind.update(delta)                       // once per frame, by the scene
//   wind.x, wind.y                           // unit vector * strength
//   wind.strength                            // 0..~1.4 including gust
//   wind.phaseAt(worldX)                     // seconds, for travelling gusts
//
// Prevailing Atlantic wind is southwesterly, so the default blows left to right
// and slightly away from the camera.

export class Wind {
  constructor(opts = {}) {
    // Direction the wind blows TOWARD, in screen space. x+ is right, y- is away.
    this.dirX = opts.dirX ?? 0.86
    this.dirY = opts.dirY ?? -0.51

    this.base      = opts.base ?? 0.55   // steady component, 0..1
    this.gustDepth = opts.gustDepth ?? 0.45
    this.gustRate  = opts.gustRate ?? 0.13

    // World px a gust front travels per second. Lower = you see it sweep.
    this.gustSpeed = opts.gustSpeed ?? 900

    this._t       = 0
    this.strength = this.base
    this.x = this.dirX * this.strength
    this.y = this.dirY * this.strength
  }

  /** @param {number} delta - milliseconds, as Phaser hands it to update() */
  update(delta) {
    this._t += (delta || 16) / 1000

    // Summed incommensurable sines: cheap, seamless, no noise table needed.
    const t = this._t * this.gustRate
    const g = (Math.sin(t * 6.283) * 0.55 +
               Math.sin(t * 2.731 + 1.7) * 0.30 +
               Math.sin(t * 11.19 + 4.1) * 0.15)

    this.strength = Math.max(0, this.base + g * this.gustDepth)
    this.x = this.dirX * this.strength
    this.y = this.dirY * this.strength
    return this
  }

  /**
   * Time as experienced at a given world x. Sample this instead of a global
   * clock and gusts sweep across the map rather than pulsing everywhere at once.
   */
  phaseAt(worldX = 0) {
    return this._t - (worldX / this.gustSpeed)
  }

  get time() { return this._t }

  /** Angle in radians, for anything that wants to slant (rain, smoke). */
  get angle() { return Math.atan2(this.dirY, this.dirX) }

  set(opts = {}) {
    Object.assign(this, opts)
    return this
  }
}

// Shared instance. Scenes update it; effects only read.
export const wind = new Wind()

export default wind

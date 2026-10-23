// dawnLight.js
// Location: js/game/scenes/locations/skye/dawnLight.js
//
// The dawn's light on a picture, carried from the cottage (the curtain drawn back, tighConaill.js) out into the yard
// (tighAmuigh.js) and down to the garden (skyeGairdin.js), so there is no sudden switch: a multiplied blue-violet tint
// over everything, and a rose glow from the horizon. As the dawn drains (d from 1 to 0) the colour settles into a flat
// grey morning (`grey`: it stays on, lightly).
//
//   const light = new DawnLight(scene)
//   light.set(d, grey)      d: 0..1 how much dawn; grey: 0..1 (or true = 1) the grey morning's cast, which can be faded out as slowly as you like
//   light.flash(a)          a flare of warm white over everything, a 0..1 (the sunburst)
//   light.destroy()

const MULTIPLY = 2
const lerp = (a, b, t) => [0, 8, 16].map(sh => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t))

export class DawnLight {
  constructor(scene, depth = 14) {
    this.scene = scene
    this.tint = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0xffffff, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(depth).setBlendMode(MULTIPLY)
    this.rose = scene.add.graphics().setScrollFactor(0).setDepth(depth)
    this.white = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0xfff2d8, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(depth + 1)
    this.key = ''
  }
  flash(a) { if (this.white) { this.white.setSize(this.scene.scale.width, this.scene.scale.height); this.white.setAlpha(Math.max(0, Math.min(1, a))) } }
  set(d, grey = 0) {
    if (!this.tint) return
    const g = grey === true ? 1 : Math.max(0, Math.min(1, +grey || 0))
    const alpha = 0.56 * g * (1 - d) + 0.95 * d
    if (alpha < 0.01) { this.tint.setAlpha(0); this.rose.clear(); this.key = ''; return }
    const W = this.scene.scale.width, H = this.scene.scale.height
    const c = lerp(0xa6b0c4, 0x8c7ad2, d)
    const key = W + 'x' + H + ':' + c.join(',') + ':' + alpha.toFixed(2) + ':' + d.toFixed(2)
    if (key === this.key) return
    this.key = key
    this.tint.setSize(W, H).setFillStyle((c[2] << 16) | (c[1] << 8) | c[0], alpha)
    const r = this.rose; r.clear()
    if (d > 0.02) {
      r.fillStyle(0x6a5aa8, 0.22 * d); r.fillRect(0, 0, W, H)                         // blue-violet over the greens
      r.fillGradientStyle(0xf2b8b0, 0xf2b8b0, 0xb89ac0, 0xb89ac0, 0.34 * d, 0.34 * d, 0.1 * d, 0.1 * d)
      r.fillRect(0, 0, W, H)                                                          // rose at the top, violet at the foot
    }
  }
  destroy() { this.tint?.destroy(); this.rose?.destroy(); this.white?.destroy(); this.tint = this.rose = this.white = null }
}

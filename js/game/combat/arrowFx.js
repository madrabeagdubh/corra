// arrowFx.js
// Location: js/game/combat/arrowFx.js
//
// An arrow turned aside, as in the bow tutorial (Scáthach's parry): a white shaft sent spinning up and away from where it struck, fading.
// Screen space; used where the arrow is a Phaser graphic (BowMechanics).

import Phaser from 'phaser'

export function arrowSpinAway(scene, x, y) {
  const g = scene.add.graphics()
  g.setDepth(200); g.setScrollFactor(0)
  const spread = Phaser.Math.DegToRad(60)
  const ang = -Math.PI / 2 + Phaser.Math.FloatBetween(-spread / 2, spread / 2)
  const dist = Phaser.Math.Between(120, 200), len = 12
  const ex = x + Math.cos(ang) * dist, ey = y + Math.sin(ang) * dist
  const spin = Math.PI * Phaser.Math.FloatBetween(3, 5)
  const k = { t: 0 }
  scene.tweens.add({
    targets: k, t: 1, duration: Phaser.Math.Between(700, 1000), ease: 'Cubic.easeOut',
    onUpdate: () => {
      const cx = x + (ex - x) * k.t, cy = y + (ey - y) * k.t, rot = ang + k.t * spin
      g.clear(); g.lineStyle(1.5, 0xffffff, 1 - k.t * 0.8); g.beginPath()
      g.moveTo(cx - Math.cos(rot) * len, cy - Math.sin(rot) * len); g.lineTo(cx + Math.cos(rot) * len, cy + Math.sin(rot) * len); g.strokePath()
    },
    onComplete: () => g.destroy()
  })
}

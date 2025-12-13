import Phaser from 'phaser';

/**
 * BowMechanics - Handles bow and arrow shooting mechanics
 * Touch player -> drag away -> release to shoot
 * Steep parabolic arc, restrained scale, locked rotation
 */
export default class BowMechanics {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.isAiming = false;
    this.aimLine = null;
    this.arrows = [];

    this.maxDrawDistance = 250;
    this.minDistance = 80;
    this.maxDistance = 600;
    this.flightTime = 1500;
    this.arcHeight = 250;

    this.setupInput();
  }

  setupInput() {
    if (this.player.sprite) {
      this.player.sprite.setInteractive();
      this.player.sprite.on('pointerdown', pointer => this.startAiming(pointer));
    }

    this.scene.input.on('pointermove', pointer => {
      if (this.isAiming) this.updateAimLine(pointer);
    });

    this.scene.input.on('pointerup', pointer => {
      if (this.isAiming) this.shootArrow(pointer);
    });
  }

  startAiming(pointer) {
    this.isAiming = true;
    this.aimStartX = this.player.sprite.x;
    this.aimStartY = this.player.sprite.y;

    this.aimLine = this.scene.add.graphics();
    this.aimLine.setDepth(100);
  }

  updateAimLine(pointer) {
    if (!this.aimLine) return;

    const px = this.player.sprite.x;
    const py = this.player.sprite.y;

    let dx = pointer.worldX - px;
    let dy = pointer.worldY - py;

    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > this.maxDrawDistance) {
      const s = this.maxDrawDistance / dist;
      dx *= s;
      dy *= s;
    }

    this.aimLine.clear();
    this.aimLine.lineStyle(4, 0xffff00, 0.8);
    this.aimLine.beginPath();
    this.aimLine.moveTo(px, py);
    this.aimLine.lineTo(px + dx, py + dy);
    this.aimLine.strokePath();

    const alpha = Math.min(dist / this.maxDrawDistance, 1);
    this.aimLine.fillStyle(0xff0000, alpha * 0.5);
    this.aimLine.fillCircle(px + dx, py + dy, 10);
  }

  shootArrow(pointer) {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;

    let dx = px - pointer.worldX;
    let dy = py - pointer.worldY;

    const dragDist = Math.sqrt(dx * dx + dy * dy);
    if (dragDist < 20) {
      this.cancelAiming();
      return;
    }

    const clamped = Math.min(dragDist, this.maxDrawDistance);
    const angle = Math.atan2(dy, dx);
    const force = clamped / this.maxDrawDistance;

    const travelDistance =
      this.minDistance + force * (this.maxDistance - this.minDistance);

    this.createArrow(px, py, angle, force, travelDistance);
    this.cancelAiming();
  }

  createArrow(x, y, angle, force, travelDistance) {
    const arrow = this.scene.add.image(x, y, 'arrowTexture');
    arrow.setOrigin(0.5);
    arrow.setDepth(50);
arrow.setTint(0xf5f5f5);
    const baseScale = 0.035;
    arrow.setScale(baseScale);
    arrow.setData('baseScale', baseScale);

    // Horizontal texture → rotate 90° clockwise
    const flightRotation = angle + Math.PI / 2;
    arrow.setRotation(flightRotation);
    arrow.setData('flightRotation', flightRotation);

    const shadow = this.scene.add.ellipse(x, y, 20, 10, 0x000000, 0.4);
    shadow.setDepth(5);

    arrow.setData({
      startX: x,
      startY: y,
      angle,
      force,
      travelDistance,
      elapsed: 0,
      active: true,
      hasLanded: false,
      shadow
    });

    this.arrows.push(arrow);

    this.scene.time.delayedCall(this.flightTime + 2000, () => {
      this.destroyArrow(arrow);
    });
  }

  cancelAiming() {
    this.isAiming = false;
    if (this.aimLine) {
      this.aimLine.destroy();
      this.aimLine = null;
    }
  }

  destroyArrow(arrow) {
    const i = this.arrows.indexOf(arrow);
    if (i !== -1) this.arrows.splice(i, 1);

    const shadow = arrow.getData('shadow');
    if (shadow) shadow.destroy();

    arrow.destroy();
  }

  update(delta) {
    this.arrows.forEach(arrow => {
      if (!arrow.getData('active')) return;

      const elapsed = arrow.getData('elapsed') + delta;
      arrow.setData('elapsed', elapsed);

      const progress = Math.min(elapsed / this.flightTime, 1);

      const sx = arrow.getData('startX');
      const sy = arrow.getData('startY');
      const angle = arrow.getData('angle');
      const dist = arrow.getData('travelDistance');

      const groundX = sx + Math.cos(angle) * dist * progress;
      const groundY = sy + Math.sin(angle) * dist * progress;

      const arc = -4 * this.arcHeight * progress * (progress - 1);

      arrow.x = groundX;
      arrow.y = groundY - arc;

      // LOCK rotation during flight
      arrow.rotation = arrow.getData('flightRotation');

      // Subtle scale modulation only
      const base = arrow.getData('baseScale');
      const scaleOffset = Math.sin(progress * Math.PI) * 0.02;
      arrow.setScale(base + scaleOffset);

      const shadow = arrow.getData('shadow');
      if (shadow) {
        shadow.x = groundX;
        shadow.y = groundY;
        shadow.setScale(1 + (arc / this.arcHeight) * 0.6);
        shadow.setAlpha(0.5 - (arc / this.arcHeight) * 0.3);
      }

      if (progress >= 1 && !arrow.getData('hasLanded')) {
        arrow.setData('hasLanded', true);
        arrow.setData('active', false);

        arrow.setRotation(Math.PI / 2);
        arrow.setScale(0.02);
        arrow.setAlpha(0.75);

        if (shadow) {
          this.scene.tweens.add({
            targets: shadow,
            alpha: 0,
            duration: 200
          });
        }
      }
    });
  }

  checkHit(target, radius = 30) {
    for (const arrow of this.arrows) {
      if (!arrow.getData('hasLanded')) continue;

      const d = Phaser.Math.Distance.Between(
        arrow.x,
        arrow.y,
        target.x,
        target.y
      );

      if (d < radius) {
        return {
          arrow,
          force: arrow.getData('force'),
          distance: arrow.getData('travelDistance'),
          landX: arrow.x,
          landY: arrow.y
        };
      }
    }
    return null;
  }

  destroy() {
    this.cancelAiming();
    this.arrows.forEach(a => {
      const s = a.getData('shadow');
      if (s) s.destroy();
      a.destroy();
    });
    this.arrows = [];

    if (this.player.sprite) {
      this.player.sprite.removeInteractive();
    }
  }
}

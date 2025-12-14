import Phaser from 'phaser';

/**
 * BowMechanics - Handles bow and arrow shooting mechanics
 * Touch player -> drag away -> release to shoot
 * Arrows follow parabolic arcs based on draw strength
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
    const baseScale = 0.085;
    arrow.setScale(baseScale);
    arrow.setData('baseScale', baseScale);

    const flightRotation = angle;
    arrow.setData('flightRotation', flightRotation);

    // Create shadow on ground
    const shadow = this.scene.add.ellipse(x, y, 20, 10, 0x000000, 0.4);
    shadow.setDepth(5);

    // Create elegant vapor trail - stored positions for afterimages
    const trailGraphics = this.scene.add.graphics();
    trailGraphics.setDepth(45);
    
    arrow.setData('trailGraphics', trailGraphics);
    arrow.setData('trailPositions', []); // Store recent positions

    arrow.setData({
      startX: x,
      startY: y,
      angle,
      force,
      travelDistance,
      elapsed: 0,
      active: true,
      hasLanded: false,
      shadow,
      trailGraphics,
      trailPositions: []
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

    const trail = arrow.getData('trailGraphics');
    if (trail) trail.destroy();

    arrow.destroy();
  }

  createImpactEffect(x, y, force) {
    // Dust/debris particles
    const particles = this.scene.add.particles(x, y, 'arrowTexture', {
      speed: { min: 50, max: 150 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.02, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: 400,
      quantity: 8,
      tint: [0x8B7355, 0xA0826D, 0x654321],
      blendMode: 'NORMAL'
    });

    // Impact flash
    const flash = this.scene.add.circle(x, y, 15, 0xFFFFFF, 0.6);
    flash.setDepth(100);
    this.scene.tweens.add({
      targets: flash,
      scale: 2,
      alpha: 0,
      duration: 150,
      ease: 'Power2',
      onComplete: () => flash.destroy()
    });

    // Stronger impact for powerful shots
    if (force > 0.7) {
      const shockwave = this.scene.add.circle(x, y, 20, 0xFFAA00, 0);
      shockwave.setStrokeStyle(2, 0xFFAA00, 0.8);
      shockwave.setDepth(99);
      this.scene.tweens.add({
        targets: shockwave,
        scale: 2.5,
        alpha: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: () => shockwave.destroy()
      });
    }

    this.scene.time.delayedCall(500, () => particles.destroy());
  }

  update(delta) {
    this.arrows.forEach(arrow => {
      if (!arrow.getData('active')) return;

      const elapsed = arrow.getData('elapsed') + delta;
      arrow.setData('elapsed', elapsed);

      const force = arrow.getData('force');
      const dynamicFlightTime = this.flightTime * (0.4 + force * 0.6);
      const progress = Math.min(elapsed / dynamicFlightTime, 1);

      const sx = arrow.getData('startX');
      const sy = arrow.getData('startY');
      const angle = arrow.getData('angle');
      const dist = arrow.getData('travelDistance');

      const groundX = sx + Math.cos(angle) * dist * progress;
      const groundY = sy + Math.sin(angle) * dist * progress;

      const dynamicArcHeight = this.arcHeight * (0.2 + force * 0.8);
      const arc = -4 * dynamicArcHeight * progress * (progress - 1);

      arrow.x = groundX;
      arrow.y = groundY - arc;

      // Store position for vapor trail
      const trailPositions = arrow.getData('trailPositions');
      trailPositions.push({ x: arrow.x, y: arrow.y, alpha: 1 });
      
      // Keep only last 15 positions
      if (trailPositions.length > 15) {
        trailPositions.shift();
      }
      
      // Draw elegant vapor trail
      const trailGraphics = arrow.getData('trailGraphics');
      if (trailGraphics && trailPositions.length > 1) {
        trailGraphics.clear();
        
        // Fade each position
        trailPositions.forEach((pos, i) => {
          pos.alpha *= 0.92; // Fade out
        });
        
        // Draw smooth gradient trail
        for (let i = 1; i < trailPositions.length; i++) {
          const p1 = trailPositions[i - 1];
          const p2 = trailPositions[i];
          
          const alpha = p2.alpha * 0.4;
          const width = 3 * (i / trailPositions.length);
          
          trailGraphics.lineStyle(width, 0xCCDDFF, alpha);
          trailGraphics.beginPath();
          trailGraphics.moveTo(p1.x, p1.y);
          trailGraphics.lineTo(p2.x, p2.y);
          trailGraphics.strokePath();
        }
      }

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
        shadow.setScale(1 + (arc / dynamicArcHeight) * 0.6);
        shadow.setAlpha(0.5 - (arc / dynamicArcHeight) * 0.3);
      }

      if (progress >= 1 && !arrow.getData('hasLanded')) {
        arrow.setData('hasLanded', true);
        arrow.setData('active', false);

        // Clear trail
        const trailGraphics = arrow.getData('trailGraphics');
        if (trailGraphics) {
          this.scene.tweens.add({
            targets: trailGraphics,
            alpha: 0,
            duration: 300,
            onComplete: () => trailGraphics.destroy()
          });
        }

        // Create impact effect
        this.createImpactEffect(groundX, groundY, force);

        arrow.setRotation(Math.PI / 2);
        arrow.setScale(0.12);
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
      const t = a.getData('trailGraphics');
      if (t) t.destroy();
      a.destroy();
    });
    this.arrows = [];

    if (this.player.sprite) {
      this.player.sprite.removeInteractive();
    }
  }
}

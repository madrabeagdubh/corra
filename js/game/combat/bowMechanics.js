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
    this.creakSound = null; // Track the creak sound

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
    
    this.scene.sound.unlock();
    console.log(this.scene.sound.context.state);
    
    // Play creak sound when starting to aim
    this.creakSound = this.scene.sound.play('creak1', { volume: 2 });
    
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

  predictLandingPoint() {
    if (!this.isAiming || !this.aimLine) return null;

    const px = this.player.sprite.x;
    const py = this.player.sprite.y;

    const pointer = this.scene.input.activePointer;

    let dx = px - pointer.worldX;
    let dy = py - pointer.worldY;

    const dragDist = Math.sqrt(dx * dx + dy * dy);
    if (dragDist < 20) return null;

    const clamped = Math.min(dragDist, this.maxDrawDistance);
    const angle = Math.atan2(dy, dx);
    const force = clamped / this.maxDrawDistance;

    const travelDistance =
      this.minDistance + force * (this.maxDistance - this.minDistance);

    const groundX = px + Math.cos(angle) * travelDistance;
    const groundY = py + Math.sin(angle) * travelDistance;

    return { x: groundX, y: groundY };
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

    // Stop creak sound and play random arrow shoot sound
    if (this.creakSound && this.creakSound.isPlaying) {
      this.creakSound.stop();
    }
    this.creakSound = null;

    // Play random arrow shoot sound
    const shootSounds = ['arrowShoot1', 'arrowShoot2', 'arrowShoot3'];
    const randomShoot = Phaser.Math.RND.pick(shootSounds);
    this.scene.sound.play(randomShoot, { volume: 1 });

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
    arrow.setData('trailPositions', []);

    arrow.setData({
      startX: x,
      startY: y,
      angle,
      force,
      travelDistance,
      elapsed: 0,
      active: true,
      hasLanded: false,
      hitTarget: false,
      shadow,
      trailGraphics,
      trailPositions: [],
      prevX: x,
      prevY: y
    });

    this.arrows.push(arrow);

    this.scene.time.delayedCall(this.flightTime + 2000, () => {
      this.destroyArrow(arrow);
    });
  }

  cancelAiming() {
    this.isAiming = false;
    
    // Stop creak sound if aiming is cancelled
    if (this.creakSound && this.creakSound.isPlaying) {
      this.creakSound.stop();
    }
    this.creakSound = null;
    
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
    // Multiple expanding rings
    const ringCount = force > 0.7 ? 3 : 2;

    for (let i = 0; i < ringCount; i++) {
      const ring = this.scene.add.circle(x, y, 10, 0xFFFFFF, 0);
      ring.setStrokeStyle(3 - i, 0xFFAA00, 0.8);
      ring.setDepth(99 + i);

      this.scene.tweens.add({
        targets: ring,
        radius: 40 + (i * 15),
        alpha: 0,
        duration: 400 + (i * 100),
        delay: i * 50,
        ease: 'Power2',
        onComplete: () => ring.destroy()
      });
    }

    // Central flash
    const flash = this.scene.add.circle(x, y, 8, 0xFFFFFF, 0.9);
    flash.setDepth(100);
    this.scene.tweens.add({
      targets: flash,
      scale: 3,
      alpha: 0,
      duration: 200,
      ease: 'Power3',
      onComplete: () => flash.destroy()
    });
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

      const prevX = arrow.getData('prevX');
      const prevY = arrow.getData('prevY');

      arrow.x = groundX;
      arrow.y = groundY - arc;

      // Arrow rotation based on movement
      const deltaX = arrow.x - prevX;
      const deltaY = arrow.y - prevY;
      if (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) {
        arrow.rotation = Math.atan2(deltaY, deltaX) + Math.PI / 2;
      }

      arrow.setData('prevX', arrow.x);
      arrow.setData('prevY', arrow.y);

      // Vapor trail
      const trailPositions = arrow.getData('trailPositions');
      trailPositions.push({ x: arrow.x, y: arrow.y, alpha: 1 });
      if (trailPositions.length > 15) trailPositions.shift();

      const trailGraphics = arrow.getData('trailGraphics');
      if (trailGraphics && trailPositions.length > 1) {
        trailGraphics.clear();
        trailPositions.forEach(pos => (pos.alpha *= 0.92));
        for (let i = 1; i < trailPositions.length; i++) {
          const p1 = trailPositions[i - 1];
          const p2 = trailPositions[i];
          trailGraphics.lineStyle(5 * (i / trailPositions.length), 0xCCDDFF, p2.alpha * 0.7);
          trailGraphics.beginPath();
          trailGraphics.moveTo(p1.x, p1.y);
          trailGraphics.lineTo(p2.x, p2.y);
          trailGraphics.strokePath();
        }
      }

      // Subtle scale modulation
      const base = arrow.getData('baseScale');
      arrow.setScale(base + Math.sin(progress * Math.PI) * 0.02);

      // Shadow follow
      const shadow = arrow.getData('shadow');
      if (shadow) {
        shadow.x = groundX;
        shadow.y = groundY;
        shadow.setScale(1 + (arc / dynamicArcHeight) * 0.6);
        shadow.setAlpha(0.5 - (arc / dynamicArcHeight) * 0.3);
      }

      // === Parry logic ===
      const scathach = this.scene.scathach;
      if (scathach && !arrow.getData('parried')) {
        const arrowY = arrow.y;
        const parryZoneHeight = 50;

        // Get her sprite bounds
        const scathachBounds = scathach.getBounds();

        // Check if arrow intersects her bounds
        const arrowX = arrow.x;

        // Optional margin if you want the parry zone slightly bigger
        const margin = 5;

        const isInParryZone =
          arrowX > scathachBounds.left - margin &&
          arrowX < scathachBounds.right + margin &&
          arrowY > scathachBounds.top - margin &&
          arrowY < scathachBounds.bottom + margin;

        // Only parry if arrow hasn't passed target yet
        const target = this.scene.target;
        const hasPassedTarget = target && arrow.y < target.y;
        if (isInParryZone && !hasPassedTarget) {
          this.scene.onScathachHit(arrow);
          return; // Arrow is parried, skip further processing
        }
      }

      // === Landing / impact ===
      if (progress >= 1 && !arrow.getData('hasLanded')) {
        arrow.setData('hasLanded', true);
        arrow.setData('active', false);

        if (trailGraphics) {
          this.scene.tweens.add({
            targets: trailGraphics,
            alpha: 0,
            duration: 300,
            onComplete: () => trailGraphics.destroy(),
          });
        }

        this.createImpactEffect(groundX, groundY, force);

        const stickAngle = Phaser.Math.DegToRad(Phaser.Math.Between(60, 75));
        arrow.setRotation(stickAngle);
        arrow.setScale(0.09);
        arrow.setAlpha(0.8);
        arrow.setOrigin(0.5, 0.3);

        if (shadow) {
          this.scene.tweens.add({
            targets: shadow,
            alpha: 0,
            duration: 200,
          });
        }
      }
    });
  }

  checkHit(target, radius = 30) {
    for (const arrow of this.arrows) {
      if (!arrow.getData('hasLanded')) continue;
      if (arrow.getData('hitTarget')) continue;

      const d = Phaser.Math.Distance.Between(
        arrow.x,
        arrow.y,
        target.x,
        target.y
      );

      if (d < radius) {
        arrow.setData('hitTarget', true);
        
        // Play pumpkin break sound on target hit
        this.scene.sound.play('pumpkin_break_01', { volume: 1 });
        
        return {
          arrow,
          force: arrow.getData('force'),
          distance: d,
          travelDistance: arrow.getData('travelDistance'),
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

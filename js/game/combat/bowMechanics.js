import Phaser from 'phaser';

/**
 * BowMechanics - Handles bow and arrow shooting mechanics
 * Now checks for arrows in inventory before firing
 */
export default class BowMechanics {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.isAiming = false;
    this.aimLine = null;
    this.arrows = [];
    this.creakSound = null;
    this.creakIsPlaying = false;

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

  /**
   * Check if player has arrows in inventory
   */
  hasArrows() {
    const inventory = this.player.inventory;
    for (let i = 0; i < inventory.totalSlots; i++) {
      const item = inventory.getItem(i);
      if (item && item.id === 'arrows' && item.quantity > 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Consume one arrow from inventory
   */
  consumeArrow() {
    const inventory = this.player.inventory;
    for (let i = 0; i < inventory.totalSlots; i++) {
      const item = inventory.getItem(i);
      if (item && item.id === 'arrows' && item.quantity > 0) {
        item.quantity--;
        
        // Remove item if quantity reaches 0
        if (item.quantity <= 0) {
          inventory.removeItem(i);
        }
        
        console.log(`Arrow consumed. Remaining: ${item.quantity || 0}`);
        
        // Update UI if menu is open
        if (this.scene.worldMenu && this.scene.worldMenu.isOpen) {
          this.scene.worldMenu.refreshGridDisplay();
        }
        
        return true;
      }
    }
    return false;
  }

  startAiming(pointer) {
    // 1. Equipment Check: Bow must be equipped
    const isBowEquipped = !!(this.player.bowOverlay && this.player.bowOverlay.visible);
    
    if (!isBowEquipped) {
      console.log("Archery blocked: Bow not equipped.");
      return; 
    }

    // 2. Arrow Check: Must have arrows
    if (!this.hasArrows()) {
      console.log("Archery blocked: No arrows in inventory!");
      // Optional: Play a "click" or "empty" sound here
      return;
    }

    // 3. Initialize Aiming State
    this.isAiming = true;
    this.aimStartX = this.player.sprite.x;
    this.aimStartY = this.player.sprite.y;
    
    this.scene.sound.unlock();
    
    this.aimLine = this.scene.add.graphics();
    this.aimLine.setDepth(100);
  }

  updateAimLine(pointer) {
    if (!this.aimLine) return;

    const px = this.player.sprite.x;
    const py = this.player.sprite.y;

    let dx = pointer.worldX - px;
    let dy = pointer.worldY - py;

    // Aiming Rotation with the -45 degree offset
    if (this.player.bowOverlay) {
      const angle = Math.atan2(dy, dx);
      this.player.bowOverlay.rotation = angle + (Math.PI / 2) - (Math.PI / 4);
    }

    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > this.maxDrawDistance) {
      const s = this.maxDrawDistance / dist;
      dx *= s;
      dy *= s;
    }

    const drawStrength = Math.min(dist / this.maxDrawDistance, 1);
    
    // Play creak sound at high draw
    if (drawStrength >= 0.7 && !this.creakIsPlaying) {
      this.creakSound = this.scene.sound.add('creak1');
      this.creakSound.play({ volume: 0.6 });
      this.creakIsPlaying = true;
    }

    // Render the visual Aim Line
    this.aimLine.clear();
    this.aimLine.lineStyle(4, 0xffff00, 0.8);
    this.aimLine.beginPath();
    this.aimLine.moveTo(px, py);
    this.aimLine.lineTo(px + dx, py + dy);
    this.aimLine.strokePath();
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

    const travelDistance = this.minDistance + force * (this.maxDistance - this.minDistance);
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

    // Consume arrow before shooting
    if (!this.consumeArrow()) {
      console.log("No arrows to shoot!");
      this.cancelAiming();
      return;
    }

    const clamped = Math.min(dragDist, this.maxDrawDistance);
    const angle = Math.atan2(dy, dx);
    const force = clamped / this.maxDrawDistance;

    const travelDistance = this.minDistance + force * (this.maxDistance - this.minDistance);

    // Stop creak sound
    if (this.creakSound && this.creakIsPlaying) {
      this.creakSound.stop();
      this.creakSound.destroy();
      this.creakSound = null;
      this.creakIsPlaying = false;
    }

    // Play random arrow shoot sound
    const shootSounds = ['arrowShoot1', 'arrowShoot2', 'arrowShoot3'];
    const randomShoot = Phaser.Math.RND.pick(shootSounds);
    this.scene.sound.play(randomShoot, { volume: 0.7 });

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

    const shadow = this.scene.add.ellipse(x, y, 20, 10, 0x000000, 0.4);
    shadow.setDepth(5);

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

    if (this.player.bowOverlay) {
      this.player.bowOverlay.rotation = 0;
      this.player.bowOverlay.setPosition(this.player.sprite.x, this.player.sprite.y);
    }

    if (this.creakSound) {
      this.creakSound.stop();
    }
    this.creakSound = null;
    this.creakIsPlaying = false;
    
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

      const base = arrow.getData('baseScale');
      arrow.setScale(base + Math.sin(progress * Math.PI) * 0.02);

      const shadow = arrow.getData('shadow');
      if (shadow) {
        shadow.x = groundX;
        shadow.y = groundY;
        shadow.setScale(1 + (arc / dynamicArcHeight) * 0.6);
        shadow.setAlpha(0.5 - (arc / dynamicArcHeight) * 0.3);
      }

      // Parry logic
      const scathach = this.scene.scathach;
      if (scathach && !arrow.getData('parried')) {
        const scathachBounds = scathach.getBounds();
        const arrowX = arrow.x;
        const arrowY = arrow.y;
        const margin = 5;

        const isInParryZone =
          arrowX > scathachBounds.left - margin &&
          arrowX < scathachBounds.right + margin &&
          arrowY > scathachBounds.top - margin &&
          arrowY < scathachBounds.bottom + margin;

        const target = this.scene.target;
        const hasPassedTarget = target && arrow.y < target.y;
        if (isInParryZone && !hasPassedTarget) {
          this.scene.onScathachHit(arrow);
          return;
        }
      }

      // Landing / impact
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

      const d = Phaser.Math.Distance.Between(arrow.x, arrow.y, target.x, target.y);

      if (d < radius) {
        arrow.setData('hitTarget', true);
        this.scene.sound.play('pumpkin_break_01', { volume: 0.8 });
        
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

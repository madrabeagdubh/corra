// js/game/player/player.js
import Inventory from '../ui/inventory/inventory.js';
import { createItem } from '../ui/inventory/itemDefinitions.js';

export default class Player {

  constructor(scene, x, y, champion) {
    if (!champion) {
      this.scene = scene;
      this.tileSize = 16;
      this.sprite = scene.add.rectangle(x, y, this.tileSize, this.tileSize, 0xff0000);
      this.nameGa = 'Unknown';
      this.stats = { health: 5, attack: 5, defense: 5 };
      this.baseStats = { ...this.stats };
      this.initializeInventory();
      return;
    }

    this.champion = champion;
    this.scene = scene;
    this.tileSize = 32;

    this.nameGa = champion.nameGa;
    this.stats = champion.stats;
    this.baseStats = { ...champion.stats };

    this.createSprite(x, y);

    this.isMoving = false;
    this.moveDirection = { x: 0, y: 0 };
    this.stepDuration = 150;

    this.targetX = x;
    this.targetY = y;
    this.startX = x;
    this.startY = y;
    this.moveProgress = 0;

    this.initializeInventory();
  }

  initializeInventory() {
    this.inventory = new Inventory({ rows: 5, cols: 5 });
    this.inventory.setItem(0, createItem('simple_bow'));      // Right hand
    this.inventory.setItem(1, null);
    this.inventory.setItem(2, createItem('leather_armor'));
    this.inventory.setItem(3, null);
    this.inventory.setItem(4, null);

    this.inventory.setItem(5, createItem('healing_potion'));
    this.inventory.setItem(6, createItem('arrows', 30));

    this.updateStatsFromEquipment();
  }

  updateStatsFromEquipment() {
    const equippedStats = this.inventory.calculateEquippedStats();
    this.stats = { ...this.baseStats };

    this.stats.defense = (this.stats.defense || 0) + (equippedStats.defense || 0);
    this.stats.attack = (this.stats.attack || 0) + (equippedStats.attack || 0);
    this.stats.health = (this.stats.health || 0) + (equippedStats.health || 0);

    // Visual Check: Update equipment overlays based on current inventory
    const weapon = this.inventory.getItem(0); // Right Hand slot
    this.setEquipmentVisible('weapon', !!(weapon && weapon.id === 'simple_bow'));

    console.log('Player stats updated:', this.stats);
  }

  createSprite(x, y) {
    try {
      console.log('=== createSprite: starting ===');
      const atlas = this.scene.cache.json.get('championAtlas');

      if (!atlas) {
        console.warn('Champion atlas not loaded');
        this.sprite = this.scene.add.rectangle(x, y, this.tileSize, this.tileSize, 0x00ff00);
        return;
      }

      const frameName = this.champion.spriteKey.endsWith('.png')
        ? this.champion.spriteKey
        : `${this.champion.spriteKey}.png`;

      if (!this.scene.textures.exists('championAtlas_texture')) {
        this.scene.textures.addAtlas('championAtlas_texture',
          this.scene.textures.get('championSheet').getSourceImage(),
          atlas);
      }

      this.sprite = this.scene.add.image(x, y, 'championAtlas_texture', frameName);
      this.sprite.setDisplaySize(this.tileSize * 2, this.tileSize * 2);
      this.sprite.setDepth(100);

      // --- ADDED: Bow Overlay ---
      this.bowOverlay = this.scene.add.image(x, y, 'item_simple_bow')
        .setOrigin(0.5)
        .setDisplaySize(this.tileSize * 1.2, this.tileSize * 1.2)
        .setDepth(101) // Just above player
        .setVisible(false);

      console.log('=== Sprite and Equipment Overlays created! ===');

    } catch (error) {
      console.error('Error in createSprite:', error);
      this.sprite = this.scene.add.rectangle(x, y, this.tileSize, this.tileSize, 0x00ff00);
    }
  }

  // --- ADDED: Toggle visibility ---
  setEquipmentVisible(slot, isVisible) {
    if (slot === 'weapon' && this.bowOverlay) {
        this.bowOverlay.setVisible(isVisible);
    }
  }

  update(joystick) {
    if (!joystick) return;

    const force = joystick.force;

    if (this.isMoving) {
      this.moveProgress += (1000 / 60) / this.stepDuration;

      if (this.moveProgress >= 1) {
        this.sprite.x = this.targetX;
        this.sprite.y = this.targetY;
        this.isMoving = false;
        this.moveProgress = 0;

        if (force > 10) {
          this.startNewStep(joystick);
        }
      } else {
        this.sprite.x = this.startX + (this.targetX - this.startX) * this.moveProgress;
        this.sprite.y = this.startY + (this.targetY - this.startY) * this.moveProgress;
      }
    } else if (force > 10) {
      this.startNewStep(joystick);
    }

    // --- ADDED: Sync Bow Position ---
    if (this.bowOverlay && this.bowOverlay.visible) {
        this.bowOverlay.setPosition(this.sprite.x, this.sprite.y);
        // Basic flip: if moving left, flip the bow
        if (this.moveDirection.x < 0) this.bowOverlay.setFlipX(true);
        if (this.moveDirection.x > 0) this.bowOverlay.setFlipX(false);
    }
  }

  startNewStep(joystick) {
    const angle = joystick.angle;
    let dx = 0, dy = 0;

    if (angle >= -22.5 && angle < 22.5) { dx = 1; }
    else if (angle >= 22.5 && angle < 67.5) { dx = 1; dy = 1; }
    else if (angle >= 67.5 && angle < 112.5) { dy = 1; }
    else if (angle >= 112.5 && angle < 157.5) { dx = -1; dy = 1; }
    else if (angle >= 157.5 || angle < -157.5) { dx = -1; }
    else if (angle >= -157.5 && angle < -112.5) { dx = -1; dy = -1; }
    else if (angle >= -112.5 && angle < -67.5) { dy = -1; }
    else if (angle >= -67.5 && angle < -22.5) { dx = 1; dy = -1; }

    this.startX = Math.round(this.sprite.x / this.tileSize) * this.tileSize;
    this.startY = Math.round(this.sprite.y / this.tileSize) * this.tileSize;
    this.sprite.x = this.startX;
    this.sprite.y = this.startY;

    this.targetX = this.startX + (dx * this.tileSize);
    this.targetY = this.startY + (dy * this.tileSize);

    this.isMoving = true;
    this.moveProgress = 0;
    this.moveDirection = { x: dx, y: dy };
  }

  canMoveTo(x, y) { return true; }

  cancelMove() {
    this.sprite.x = this.startX;
    this.sprite.y = this.startY;
    this.targetX = this.startX;
    this.targetY = this.startY;
    this.isMoving = false;
    this.moveProgress = 0;
  }
}


import Inventory from '../ui/inventory/inventory.js';
import { createItem } from '../ui/inventory/itemDefinitions.js';

export default class Player {

  constructor(scene, x, y, champion) {
    if (!champion) {
      this.scene = scene;
      this.tileSize = 16;
      this.sprite = scene.add.rectangle(x, y, this.tileSize, this.tileSize, 0xff0000);
      this.nameGa = 'Unknown';
      this.stats = { health: 5, attack: 5, defense: 5, speed: 5, magic: 5, luck: 5 };
      this.baseStats = { ...this.stats };
      this.initializeHP();
      this.initializeInventory();
      return;
    }

    this.champion = champion;
    this.scene = scene;
    this.tileSize = 32;

    this.nameGa = champion.nameGa;
    this.stats = champion.stats;
    this.baseStats = { ...champion.stats };

    // Initialize HP system
    this.initializeHP();

    this.createSprite(x, y);

    this.isMoving = false;
    this.moveDirection = { x: 0, y: 0 };
    
    // Base step duration (will be modified by speed stat and terrain)
    this.baseStepDuration = 150;
    this.stepDuration = this.calculateStepDuration();
    this.terrainSpeedModifier = 1.0; // 1.0 = normal, 0.5 = half speed, etc.
    this.terrainSinkOffset = 0; // How many pixels to sink (set by TerrainManager)

    this.targetX = x;
    this.targetY = y;
    this.startX = x;
    this.startY = y;
    this.moveProgress = 0;

    this.initializeInventory();
  }

  /**
   * Initialize HP system
   */
  initializeHP() {
    // Max HP is based on health stat (each point = 10 HP)
    this.maxHP = this.stats.health ;
    this.currentHP = this.maxHP;
    
    console.log(`${this.nameGa} initialized with ${this.currentHP}/${this.maxHP} HP`);
  }

  /**
   * Calculate step duration based on speed stat
   * Higher speed = faster movement (lower duration)
   * Speed 1 = 250ms, Speed 10 = 100ms
   */
  calculateStepDuration() {
    // Formula: base - (speed * modifier)
    // Speed 1: 250ms, Speed 5: 170ms, Speed 10: 100ms
    const baseDuration = 250;
    const speedModifier = 15;
    const duration = baseDuration - (this.stats.speed * speedModifier);
    
    // Apply terrain modifier
    return Math.max(50, duration / this.terrainSpeedModifier);
  }

  /**
   * Set terrain speed modifier (called by TerrainManager)
   * @param {number} modifier - 1.0 = normal, 0.5 = half speed, 2.0 = double speed
   */
  setTerrainSpeedModifier(modifier) {
    this.terrainSpeedModifier = modifier;
    this.stepDuration = this.calculateStepDuration();
  }

  /**
   * Take damage
   * @param {number} amount - Damage amount
   * @param {string} source - Source of damage (for logging/effects)
   */
  takeDamage(amount, source = 'unknown') {
    this.currentHP = Math.max(0, this.currentHP - amount);
    
    console.log(`${this.nameGa} took ${amount} damage from ${source}. HP: ${this.currentHP}/${this.maxHP}`);
    
    // Flash red when taking damage
    if (this.sprite && this.sprite.setTint) {
      this.sprite.setTint(0xff0000);
      this.scene.time.delayedCall(100, () => {
        if (this.sprite) this.sprite.clearTint();
      });
    }
    
    // Check for death
    if (this.currentHP <= 0) {
      this.onDeath();
    }
    
    // Notify UI to update
    if (this.scene.events) {
      this.scene.events.emit('playerHPChanged', this.currentHP, this.maxHP);
    }
  }

  /**
   * Heal HP
   * @param {number} amount - Heal amount
   */
  heal(amount) {
    const oldHP = this.currentHP;
    this.currentHP = Math.min(this.maxHP, this.currentHP + amount);
    const actualHeal = this.currentHP - oldHP;
    
    if (actualHeal > 0) {
      console.log(`${this.nameGa} healed ${actualHeal} HP. HP: ${this.currentHP}/${this.maxHP}`);
      
      // Flash green when healing
      if (this.sprite && this.sprite.setTint) {
        this.sprite.setTint(0x00ff00);
        this.scene.time.delayedCall(100, () => {
          if (this.sprite) this.sprite.clearTint();
        });
      }
      
      // Notify UI to update
      if (this.scene.events) {
        this.scene.events.emit('playerHPChanged', this.currentHP, this.maxHP);
      }
    }
  }

  /**
   * Handle player death
   */
  onDeath() {
    console.log(`${this.nameGa} has died!`);
    
    // Stop movement
    this.isMoving = false;
    
    // Visual effect - fade out
    if (this.sprite) {
      this.scene.tweens.add({
        targets: this.sprite,
        alpha: 0,
        duration: 1000,
        onComplete: () => {
          // TODO: Show death screen, respawn, etc.
          console.log('Player death sequence complete');
        }
      });
    }
    
    // Show death message
    if (this.scene.textPanel) {
      this.scene.textPanel.show({
        irish: 'Tá mé marbh...',
        english: 'I have died...',
        type: 'notification'
      });
    }
  }

  /**
   * Check if player is alive
   */
  isAlive() {
    return this.currentHP > 0;
  }

  initializeInventory() {
    this.inventory = new Inventory({ rows: 5, cols: 5 });
    this.inventory.setItem(0, createItem('simple_bow'));      // Right hand
    this.inventory.setItem(1, null);
    this.inventory.setItem(2, createItem('leather_armor'));
    this.inventory.setItem(3, null);
    this.inventory.setItem(4, null);

    this.inventory.setItem(5, createItem('healing_potion'));
    this.inventory.setItem(6, createItem('arrows', 50));

    this.updateStatsFromEquipment();
  }

  updateStatsFromEquipment() {
    const equippedStats = this.inventory.calculateEquippedStats();
    
    // Reset to base stats
    this.stats = { ...this.baseStats };

    // Add equipment bonuses
    this.stats.defense = (this.stats.defense || 0) + (equippedStats.defense || 0);
    this.stats.attack = (this.stats.attack || 0) + (equippedStats.attack || 0);
    this.stats.health = (this.stats.health || 0) + (equippedStats.health || 0);
    this.stats.speed = (this.stats.speed || 0) + (equippedStats.speed || 0);

    // Update max HP if health stat changed
    const newMaxHP = this.stats.health ;
    if (newMaxHP !== this.maxHP) {
      const hpDifference = newMaxHP - this.maxHP;
      this.maxHP = newMaxHP;
      this.currentHP = Math.min(this.maxHP, this.currentHP + hpDifference);
      
      // Notify UI
      if (this.scene.events) {
        this.scene.events.emit('playerHPChanged', this.currentHP, this.maxHP);
      }
    }

    // Recalculate movement speed
    this.stepDuration = this.calculateStepDuration();

    // Visual Check: Update equipment overlays based on current inventory
    const weapon = this.inventory.getItem(0); // Right Hand slot
    this.setEquipmentVisible('weapon', !!(weapon && weapon.id === 'simple_bow'));

    // UPDATE ARMOR VISUAL
    const armor = this.inventory.getItem(2); // Armor slot
    this.setArmorVisible(!!(armor && armor.type === 'armor'));

    console.log('Player stats updated:', this.stats);
    console.log(`HP: ${this.currentHP}/${this.maxHP}, Speed: ${this.stats.speed}, Step Duration: ${this.stepDuration}ms`);
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

      // Create BOTH texture atlases
      if (!this.scene.textures.exists('championAtlas_armored')) {
        this.scene.textures.addAtlas('championAtlas_armored',
          this.scene.textures.get('championSheet_armored').getSourceImage(),
          atlas);
      }

      if (!this.scene.textures.exists('championAtlas_unarmored')) {
        this.scene.textures.addAtlas('championAtlas_unarmored',
          this.scene.textures.get('championSheet_unarmored').getSourceImage(),
          atlas);
      }

      // Start with armored texture (since they begin with armor equipped)
      this.sprite = this.scene.add.image(x, y, 'championAtlas_armored', frameName);
      this.sprite.setDisplaySize(this.tileSize * 2, this.tileSize * 2);
      this.sprite.setDepth(100);

      // Store the frame name for texture swapping
      this.currentFrameName = frameName;

      // --- Bow Overlay ---
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

  /**
   * Set armor visibility - swaps between armored/unarmored textures
   */
  setArmorVisible(isVisible) {
    if (!this.sprite || !this.currentFrameName) return;

    const textureKey = isVisible ? 'championAtlas_armored' : 'championAtlas_unarmored';
    
    console.log(`Swapping to ${isVisible ? 'armored' : 'unarmored'} texture`);
    
    // Swap the texture while keeping the same frame
    this.sprite.setTexture(textureKey, this.currentFrameName);
  }

  // --- Toggle visibility for equipment overlays ---
  setEquipmentVisible(slot, isVisible) {
    if (slot === 'weapon' && this.bowOverlay) {
      this.bowOverlay.setVisible(isVisible);
    }
  }

  update(joystick) {
    if (!joystick) return;
    if (!this.isAlive()) return; // Don't update if dead

    const force = joystick.force;

    if (this.isMoving) {
      this.moveProgress += (1000 / 60) / this.stepDuration;

      if (this.moveProgress >= 1) {
        this.sprite.x = this.targetX;
        this.sprite.y = this.targetY + (this.terrainSinkOffset || 0);
        this.isMoving = false;
        this.moveProgress = 0;

        if (force > 10) {
          this.startNewStep(joystick);
        }
      } else {
        const baseX = this.startX + (this.targetX - this.startX) * this.moveProgress;
        const baseY = this.startY + (this.targetY - this.startY) * this.moveProgress;
        
        // Set position with sink offset applied
        this.sprite.x = baseX;
        this.sprite.y = baseY + (this.terrainSinkOffset || 0);
      }
    } else if (force > 10) {
      this.startNewStep(joystick);
    }

    // --- Sync Bow Position ---
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

    // Use the base position (without sink offset) for grid calculation
    const baseY = this.sprite.y - (this.terrainSinkOffset || 0);
    
    this.startX = Math.round(this.sprite.x / this.tileSize) * this.tileSize;
    this.startY = Math.round(baseY / this.tileSize) * this.tileSize;
    
    // Reset sprite to grid position (this removes any accumulated offset errors)
    this.sprite.x = this.startX;
    this.sprite.y = this.startY + (this.terrainSinkOffset || 0);

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


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
this.tileSize = scene.tileSize || 48;
    this.nameGa = champion.nameGa;
    this.stats = champion.stats;
    this.baseStats = { ...champion.stats };

    this.initializeHP();
    this.createSprite(x, y);

    this.isMoving = false;
    this.moveDirection = { x: 0, y: 0 };

    this.baseStepDuration = 150;
    this.stepDuration = this.calculateStepDuration();
    this.terrainSpeedModifier = 1.0;
    this.terrainSinkOffset = 0;

    // ── Logical position ──────────────────────────────────────────────────
    // These are the canonical world-pixel coords used for all game logic
    // (grid snapping, collision, camera follow, etc.).
    // sprite.x / sprite.y are ONLY for rendering and must not be read back
    // for logic when perspective projection is active.
    this.logicalX = x;
    this.logicalY = y;

    this.targetX = x;
    this.targetY = y;
    this.startX  = x;
    this.startY  = y;
    this.moveProgress = 0;

    this.initializeInventory();
  }

  // ── HP ────────────────────────────────────────────────────────────────────

  initializeHP() {
    this.maxHP     = this.stats.health;
    this.currentHP = this.maxHP;
    console.log(`${this.nameGa} initialized with ${this.currentHP}/${this.maxHP} HP`);
  }

  calculateStepDuration() {
    const baseDuration  = 250;
    const speedModifier = 15;
    const duration      = baseDuration - (this.stats.speed * speedModifier);
    return Math.max(50, duration / this.terrainSpeedModifier);
  }

  setTerrainSpeedModifier(modifier) {
    this.terrainSpeedModifier = modifier;
    this.stepDuration = this.calculateStepDuration();
  }

  takeDamage(amount, source = 'unknown') {
    this.currentHP = Math.max(0, this.currentHP - amount);
    console.log(`${this.nameGa} took ${amount} damage from ${source}. HP: ${this.currentHP}/${this.maxHP}`);

    if (this.sprite && this.sprite.setTint) {
      this.sprite.setTint(0xff0000);
      this.scene.time.delayedCall(100, () => { if (this.sprite) this.sprite.clearTint(); });
    }

    if (this.currentHP <= 0) this.onDeath();

    if (this.scene.events)
      this.scene.events.emit('playerHPChanged', this.currentHP, this.maxHP);
  }

  heal(amount) {
    const oldHP     = this.currentHP;
    this.currentHP  = Math.min(this.maxHP, this.currentHP + amount);
    const actualHeal = this.currentHP - oldHP;

    if (actualHeal > 0) {
      console.log(`${this.nameGa} healed ${actualHeal} HP. HP: ${this.currentHP}/${this.maxHP}`);

      if (this.sprite && this.sprite.setTint) {
        this.sprite.setTint(0x00ff00);
        this.scene.time.delayedCall(100, () => { if (this.sprite) this.sprite.clearTint(); });
      }

      if (this.scene.events)
        this.scene.events.emit('playerHPChanged', this.currentHP, this.maxHP);
    }
  }

  onDeath() {
    console.log(`${this.nameGa} has died!`);
    this.isMoving = false;

    if (this.sprite) {
      this.scene.tweens.add({
        targets: this.sprite,
        alpha: 0,
        duration: 1000,
        onComplete: () => { console.log('Player death sequence complete'); }
      });
    }

    if (this.scene.textPanel) {
      this.scene.textPanel.show({
        irish:   'Tá mé marbh...',
        english: 'I have died...',
        type:    'notification'
      });
    }
  }

  isAlive() { return this.currentHP > 0; }

  // ── Inventory ─────────────────────────────────────────────────────────────

  initializeInventory() {
    this.inventory = new Inventory({ rows: 5, cols: 5 });
    this.inventory.setItem(0, createItem('simple_bow'));
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

    this.stats = { ...this.baseStats };
    this.stats.defense = (this.stats.defense || 0) + (equippedStats.defense || 0);
    this.stats.attack  = (this.stats.attack  || 0) + (equippedStats.attack  || 0);
    this.stats.health  = (this.stats.health  || 0) + (equippedStats.health  || 0);
    this.stats.speed   = (this.stats.speed   || 0) + (equippedStats.speed   || 0);

    const newMaxHP = this.stats.health;
    if (newMaxHP !== this.maxHP) {
      const diff      = newMaxHP - this.maxHP;
      this.maxHP      = newMaxHP;
      this.currentHP  = Math.min(this.maxHP, this.currentHP + diff);
      if (this.scene.events)
        this.scene.events.emit('playerHPChanged', this.currentHP, this.maxHP);
    }

    this.stepDuration = this.calculateStepDuration();

    const weapon = this.inventory.getItem(0);
    this.setEquipmentVisible('weapon', !!(weapon && weapon.id === 'simple_bow'));

    const armor = this.inventory.getItem(2);
    this.setArmorVisible(!!(armor && armor.type === 'armor'));

    console.log('Player stats updated:', this.stats);
    console.log(`HP: ${this.currentHP}/${this.maxHP}, Speed: ${this.stats.speed}, Step Duration: ${this.stepDuration}ms`);
  }

  // ── Sprite creation ───────────────────────────────────────────────────────

  createSprite(x, y) {
    try {
      console.log('=== createSprite: starting ===');
      const atlas = this.scene.cache.json.get('championAtlas');

      if (!atlas) {
        console.warn('Champion atlas not loaded');
        this.sprite = this.scene.add.rectangle(x, y, this.tileSize, this.tileSize, 0x00ff00);
        // Fallback sprite: set origin to bottom-centre for perspective alignment
        this.sprite.setOrigin(0.5, 1);
        return;
      }

      const frameName = this.champion.spriteKey.endsWith('.png')
        ? this.champion.spriteKey
        : `${this.champion.spriteKey}.png`;

      if (!this.scene.textures.exists('championAtlas_armored')) {
        this.scene.textures.addAtlas('championAtlas_armored',
          this.scene.textures.get('championSheet_armored').getSourceImage(), atlas);
      }

      if (!this.scene.textures.exists('championAtlas_unarmored')) {
        this.scene.textures.addAtlas('championAtlas_unarmored',
          this.scene.textures.get('championSheet_unarmored').getSourceImage(), atlas);
      }

      this.sprite = this.scene.add.image(x, y, 'championAtlas_armored', frameName);

      // ── Origin: bottom-centre ─────────────────────────────────────────────
      // perspectiveProject returns the "feet" point (south edge of the tile).
      // Setting origin to (0.5, 1) means the sprite's bottom-centre aligns
      // with that projected ground point, so the character stands correctly.
      this.sprite.setOrigin(0.5, 1);

      // Store the natural display size so applyPerspective can scale correctly.
      // We no longer call setDisplaySize here — PGR drives the size every frame.

this.baseDisplaySize = this.tileSize;
this.sprite.setDisplaySize(this.baseDisplaySize, this.baseDisplaySize);
;
      this.sprite.setDepth(100);

      this.currentFrameName = frameName;

      this.bowOverlay = this.scene.add.image(x, y, 'item_simple_bow')
        .setOrigin(0.5, 1)           // match player origin
        .setDisplaySize(this.tileSize * 1.2, this.tileSize * 1.2)
        .setDepth(101)
        .setVisible(false);

      console.log('=== Sprite and Equipment Overlays created! ===');

    } catch (error) {
      console.error('Error in createSprite:', error);
      this.sprite = this.scene.add.rectangle(x, y, this.tileSize, this.tileSize, 0x00ff00);
      this.sprite.setOrigin(0.5, 1);
    }
  }

  setArmorVisible(isVisible) {
    if (!this.sprite || !this.currentFrameName) return;
    const textureKey = isVisible ? 'championAtlas_armored' : 'championAtlas_unarmored';
    console.log(`Swapping to ${isVisible ? 'armored' : 'unarmored'} texture`);
    this.sprite.setTexture(textureKey, this.currentFrameName);
  }

  setEquipmentVisible(slot, isVisible) {
    if (slot === 'weapon' && this.bowOverlay)
      this.bowOverlay.setVisible(isVisible);
  }

  // ── Update ────────────────────────────────────────────────────────────────
  //
  // All movement operates on logicalX / logicalY.
  // sprite.x / sprite.y are NOT written here — they are set by
  // PerspectiveGroundRenderer.applyPerspective() in the scene's update loop.
  // The camera follows logicalX/Y via a dummy object (see BogLocationScene).

  update(joystick) {
    if (!joystick)       return;
    if (!this.isAlive()) return;

    const force = joystick.force;

    if (this.isMoving) {
      this.moveProgress += (1000 / 60) / this.stepDuration;

      if (this.moveProgress >= 1) {
        // Snap logical position to target
        this.logicalX = this.targetX;
        this.logicalY = this.targetY;
        this.isMoving = false;
        this.moveProgress = 0;

        if (force > 10) this.startNewStep(joystick);

      } else {
        // Interpolate logical position
        this.logicalX = this.startX + (this.targetX - this.startX) * this.moveProgress;
        this.logicalY = this.startY + (this.targetY - this.startY) * this.moveProgress;
      }

    } else if (force > 10) {
      this.startNewStep(joystick);
    }

    // Bow overlay is repositioned by applyPerspective in the scene update.
    // Just handle the flip here.
    if (this.bowOverlay && this.bowOverlay.visible) {
      if (this.moveDirection.x < 0) this.bowOverlay.setFlipX(true);
      if (this.moveDirection.x > 0) this.bowOverlay.setFlipX(false);
    }
  }

  startNewStep(joystick) {
    const angle = joystick.angle;
    let dx = 0, dy = 0;

    if      (angle >= -22.5  && angle <  22.5)  { dx =  1;         }
    else if (angle >=  22.5  && angle <  67.5)  { dx =  1; dy =  1; }
    else if (angle >=  67.5  && angle < 112.5)  {          dy =  1; }
    else if (angle >= 112.5  && angle < 157.5)  { dx = -1; dy =  1; }
    else if (angle >=  157.5 || angle < -157.5) { dx = -1;          }
    else if (angle >= -157.5 && angle < -112.5) { dx = -1; dy = -1; }
    else if (angle >= -112.5 && angle <  -67.5) {          dy = -1; }
    else if (angle >=  -67.5 && angle <  -22.5) { dx =  1; dy = -1; }

    // Snap start to grid using logical position (never sprite.x/y)
    this.startX = Math.round(this.logicalX / this.tileSize) * this.tileSize;
    this.startY = Math.round(this.logicalY / this.tileSize) * this.tileSize;

    // Snap logical position to grid start (clears any sub-tile drift)
    this.logicalX = this.startX;
    this.logicalY = this.startY;

    this.targetX = this.startX + (dx * this.tileSize);
    this.targetY = this.startY + (dy * this.tileSize);

    this.isMoving     = true;
    this.moveProgress = 0;
    this.moveDirection = { x: dx, y: dy };
  }

  canMoveTo(x, y) { return true; }

  cancelMove() {
    this.logicalX = this.startX;
    this.logicalY = this.startY;
    this.targetX  = this.startX;
    this.targetY  = this.startY;
    this.isMoving = false;
    this.moveProgress = 0;
    // Sync sprite position back too
    if (this.sprite) {
      this.sprite.x = this.startX;
      this.sprite.y = this.startY;
    }
  }
}


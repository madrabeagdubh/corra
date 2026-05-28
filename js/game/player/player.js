import { SoundBoard } from '../systems/soundBoard.js'
import Inventory from '../ui/inventory/inventory.js';
import { createItem } from '../ui/inventory/itemDefinitions.js';

export default class Player {

  constructor(scene, x, y, champion) {
    if (!champion) {
      this.scene    = scene;
      this.tileSize = 16;
      this.sprite   = scene.add.rectangle(x, y, this.tileSize, this.tileSize, 0xff0000);
      this.sprite.setOrigin(0.5, 0.5);
      this.nameGa   = 'Unknown';
      this.stats     = { health: 5, attack: 5, defense: 5, speed: 5, magic: 5, luck: 5 };
      this.baseStats = { ...this.stats };
      this.initializeHP();
      this.initializeInventory();
      return;
    }

    this.champion  = champion;
    this.scene     = scene;
    this.tileSize  = scene.tileSize || 48;

    this.nameGa    = champion.nameGa;
    this.stats     = champion.stats;
    this.baseStats = { ...champion.stats };

    this.initializeHP();
    this.createSprite(x, y);

    this.isMoving      = false;
    this.moveDirection = { x: 0, y: 0 };

    this.baseStepDuration     = 150;
    this.stepDuration         = this.calculateStepDuration();
    this.terrainSpeedModifier = 1.0;
    this.terrainSinkOffset    = 0;

    // ── Logical position ──────────────────────────────────────────────────
    // Canonical world-pixel coords for all game logic.
    // sprite.x/y are owned by PerspectiveGroundRenderer — never read back.
    this.logicalX = x;
    this.logicalY = y;

    this.targetX = x;
    this.targetY = y;
    this.startX  = x;
    this.startY  = y;
    this.moveProgress = 0;

    // ── Path queue (tap-to-pathfind) ──────────────────────────────────────
    // Array of {dx, dy} steps produced by PathFinder.
    // Consumed one step at a time when the player is not moving.
    // Cleared immediately when joystick input is detected.
    this.pathQueue = [];

    // Screen-space interpolation state (north/south movement)
    this._screenStartY    = null;
    this._screenTargetY   = null;
    this._stepPerspCamRow = null;
    this._stepHorizonPx   = null;
    this._stepGroundH     = null;

    this.initializeInventory();
  }

  // ── HP ────────────────────────────────────────────────────────────────────

  initializeHP() {
    this.maxHP     = this.stats.health;
    this.currentHP = this.maxHP;
    console.log(`${this.nameGa} initialized with ${this.currentHP}/${this.maxHP} HP`);
  }

  calculateStepDuration() {
    const duration = 250 - (this.stats.speed * 15);
    return Math.max(50, duration / this.terrainSpeedModifier);
  }

  setTerrainSpeedModifier(modifier) {
    this.terrainSpeedModifier = modifier;
    this.stepDuration = this.calculateStepDuration();
  }

  takeDamage(amount, source = 'unknown') {
    this.currentHP = Math.max(0, this.currentHP - amount);
    console.log(`${this.nameGa} took ${amount} damage from ${source}. HP: ${this.currentHP}/${this.maxHP}`);
    if (this.sprite?.setTint) {
      this.sprite.setTint(0xff0000);
      this.scene.time.delayedCall(100, () => { if (this.sprite) this.sprite.clearTint(); });
    }
    if (this.currentHP <= 0) this.onDeath();
    if (this.scene.events) this.scene.events.emit('playerHPChanged', this.currentHP, this.maxHP);
  }

  heal(amount) {
    const old      = this.currentHP;
    this.currentHP = Math.min(this.maxHP, this.currentHP + amount);
    const gained   = this.currentHP - old;
    if (gained > 0) {
      console.log(`${this.nameGa} healed ${gained} HP. HP: ${this.currentHP}/${this.maxHP}`);
      if (this.sprite?.setTint) {
        this.sprite.setTint(0x00ff00);
        this.scene.time.delayedCall(100, () => { if (this.sprite) this.sprite.clearTint(); });
      }
      if (this.scene.events) this.scene.events.emit('playerHPChanged', this.currentHP, this.maxHP);
    }
  }

  onDeath() {
    console.log(`${this.nameGa} has died!`);
    this.isMoving  = false;
    this.pathQueue = [];
    if (this.sprite) {
      this.scene.tweens.add({
        targets: this.sprite, alpha: 0, duration: 1000,
        onComplete: () => console.log('Player death sequence complete')
      });
    }
    if (this.scene.textPanel) {
      this.scene.textPanel.show({
        irish: 'Tá mé marbh...', english: 'I have died...', type: 'notification'
      });
    }
  }

  isAlive() { return this.currentHP > 0; }

  // ── Inventory ─────────────────────────────────────────────────────────────

  initializeInventory() {
    this.inventory = new Inventory({ rows: 5, cols: 5 });
    // Place items directly in equipment slots (0=rightHand, 1=leftHand, 2=armor)
    // and inventory slots (5+). Using setItem so they're treated as equipped.
    this.inventory.setItem(0, null);                          // rightHand empty (bow in inventory)
    this.inventory.setItem(1, null);                          // leftHand empty
    this.inventory.setItem(2, createItem('leather_armor'));  // armor equipped
    this.inventory.setItem(3, null);
    this.inventory.setItem(4, null);
    this.inventory.setItem(5, createItem('simple_bow'));      // bow in inventory (unequipped)
    this.inventory.setItem(6, createItem('healing_potion'));
    this.inventory.setItem(7, createItem('arrows', 30));
    this.updateStatsFromEquipment();
  }

  updateStatsFromEquipment() {
    const eq   = this.inventory.calculateEquippedStats();
    this.stats = { ...this.baseStats };
    this.stats.defense = (this.stats.defense || 0) + (eq.defense || 0);
    this.stats.attack  = (this.stats.attack  || 0) + (eq.attack  || 0);
    this.stats.health  = (this.stats.health  || 0) + (eq.health  || 0);
    this.stats.speed   = (this.stats.speed   || 0) + (eq.speed   || 0);

    const newMax = this.stats.health;
    if (newMax !== this.maxHP) {
      const diff     = newMax - this.maxHP;
      this.maxHP     = newMax;
      this.currentHP = Math.min(this.maxHP, this.currentHP + diff);
      if (this.scene.events) this.scene.events.emit('playerHPChanged', this.currentHP, this.maxHP);
    }

    this.stepDuration = this.calculateStepDuration();

    const weapon = this.inventory.getItem(0);
    this.setEquipmentVisible('weapon', !!(weapon && weapon.id === 'simple_bow'));
    const armor = this.inventory.getItem(2);
    this.setArmorVisible(!!(armor && armor.type === 'armor'));

    console.log('Player stats updated:', this.stats);
    console.log(`HP: ${this.currentHP}/${this.maxHP}, Speed: ${this.stats.speed}, Step: ${this.stepDuration}ms`);
  }

  // ── Sprite ────────────────────────────────────────────────────────────────

  createSprite(x, y) {
    try {
      console.log('=== createSprite: starting ===');
      const atlas = this.scene.cache.json.get('championAtlas');

      if (!atlas) {
        console.warn('Champion atlas not loaded');
        this.sprite = this.scene.add.rectangle(x, y, this.tileSize, this.tileSize, 0x00ff00);
        this.sprite.setOrigin(0.5, 0.5);
        this.baseDisplaySize = this.tileSize;
        return;
      }

      const frameName = this.champion.spriteKey.endsWith('.png')
        ? this.champion.spriteKey : `${this.champion.spriteKey}.png`;

      if (!this.scene.textures.exists('championAtlas_armored')) {
        this.scene.textures.addAtlas('championAtlas_armored',
          this.scene.textures.get('championSheet_armored').getSourceImage(), atlas);
      }
      if (!this.scene.textures.exists('championAtlas_unarmored')) {
        this.scene.textures.addAtlas('championAtlas_unarmored',
          this.scene.textures.get('championSheet_unarmored').getSourceImage(), atlas);
      }

      this.sprite = this.scene.add.image(x, y, 'championAtlas_armored', frameName);
      this.sprite.setOrigin(0.5, 0.5);
      this.baseDisplaySize = this.tileSize;
      this.sprite.setDisplaySize(this.baseDisplaySize, this.baseDisplaySize);
      this.sprite.setDepth(100);
      this.sprite.setVisible(false);  // PGR owns all player rendering
      this.currentFrameName = frameName;

      this.bowOverlay = this.scene.add.image(x, y, 'item_simple_bow')
        .setOrigin(0.5, 0.5)
        .setDisplaySize(this.tileSize * 1.2, this.tileSize * 1.2)
        .setDepth(101)
        .setVisible(false);

      console.log('=== Sprite and Equipment Overlays created! ===');
    } catch (error) {
      console.error('Error in createSprite:', error);
      this.sprite = this.scene.add.rectangle(x, y, this.tileSize, this.tileSize, 0x00ff00);
      this.sprite.setOrigin(0.5, 0.5);
      this.sprite.setVisible(false);
      this.baseDisplaySize = this.tileSize;
    }
  }

  setArmorVisible(isVisible) {
    if (!this.sprite || !this.currentFrameName) return;
    this.sprite.setTexture(
      isVisible ? 'championAtlas_armored' : 'championAtlas_unarmored',
      this.currentFrameName
    );
    if (this.scene.perspectiveGround) {
      this.scene.perspectiveGround._playerFrameKey = null;
    }
  }

  setEquipmentVisible(slot, isVisible) {
    if (slot === 'weapon' && this.bowOverlay) this.bowOverlay.setVisible(false);
  }

  // ── Update ────────────────────────────────────────────────────────────────
  //
  // Priority order:
  //   1. Mid-step: finish the current step
  //   2. Joystick active: cancel path queue, start new joystick step
  //   3. Path queue has steps: consume next queued step
  //   (Nothing happens if all three are idle)

  update(joystick) {
    if (!joystick)       return;
    if (!this.isAlive()) return;

    const force = joystick.force;

    if (this.isMoving) {
      this.moveProgress += (1000 / 60) / this.stepDuration;

      if (this.moveProgress >= 1) {
        this.logicalX     = this.targetX;
        this.logicalY     = this.targetY;
        this.isMoving     = false;
        // Footstep sound based on terrain
        const terrain = this.scene?.terrainManager?.currentTerrain?.name
        const tm      = this.scene?.terrainManager
        const armor   = this.inventory?.getItem(2)
        const hasArmor = !!(armor && armor.type === 'armor')
        if (terrain === 'Water') {
          if (hasArmor) SoundBoard.playWeb('FOOTSTEP_SUBMERGED')
          else SoundBoard.playWeb('FOOTSTEP_WADE')
        } else if (terrain === 'Bog Shore') {
          // silent — wading
        } else if (terrain === 'Forest') {
          SoundBoard.playWeb('FOOTSTEP_FOREST')
        } else {
          SoundBoard.playWeb('FOOTSTEP_GRASS')
        }
        this.moveProgress = 0;
        if (force > 10) {
          this.pathQueue = [];
          this.startNewStep(joystick);
        } else if (this.pathQueue.length > 0) {
          this._consumePathStep();
        }
      } else {
        // X always linear
        this.logicalX = this.startX + (this.targetX - this.startX) * this.moveProgress;

        // Y: screen-space lerp for north/south, linear otherwise
        if (this.moveDirection.y !== 0 &&
            this._screenStartY  !== null &&
            this._screenTargetY !== null) {
          const screenY = this._screenStartY +
            (this._screenTargetY - this._screenStartY) * this.moveProgress;
          this.logicalY = this._screenYToWorldY(screenY);
        } else {
          this.logicalY = this.startY + (this.targetY - this.startY) * this.moveProgress;
        }
      }
    } else if (force > 10) {
      // Joystick input cancels pathfinding
      this.pathQueue = [];
      this.startNewStep(joystick);
    } else if (this.pathQueue.length > 0) {
      this._consumePathStep();
    }
  }

  // ── Path queue ────────────────────────────────────────────────────────────

  setPath(steps) {
    this.pathQueue = steps ?? [];
  }

  clearPath() {
    this.pathQueue = [];
  }

  _consumePathStep() {
    if (!this.pathQueue.length) return;
    const step = this.pathQueue.shift();
    const fakeJoystick = {
      force: 100,
      angle: Math.atan2(step.dy, step.dx) * (180 / Math.PI)
    };
    this.startNewStep(fakeJoystick);
  }

  // ── Perspective movement helpers ──────────────────────────────────────────

  _screenYToWorldY(screenY) {
    const pgr = this.scene.perspectiveGround;
    if (!pgr || this._stepPerspCamRow == null) {
      return this.startY + (this.targetY - this.startY) * this.moveProgress;
    }
    const horizonPx   = this._stepHorizonPx;
    const groundH     = this._stepGroundH;
    const FL          = pgr.constructor.FOCAL_LENGTH;
    const perspCamRow = this._stepPerspCamRow;
    const tileSize    = pgr.tileDisplaySize;

    const denom = screenY - horizonPx;
    if (denom <= 0) return this.logicalY;

    const d        = FL * groundH / denom - FL;
    const worldRow = perspCamRow - d - 1;
    return worldRow * tileSize;
  }

  startNewStep(joystick) {
    const angle = joystick.angle;
    let dx = 0, dy = 0;

    if      (angle >= -22.5  && angle <  22.5)  { dx =  1;           }
    else if (angle >=  22.5  && angle <  67.5)  { dx =  1;  dy =  1; }
    else if (angle >=  67.5  && angle < 112.5)  {            dy =  1; }
    else if (angle >= 112.5  && angle < 157.5)  { dx = -1;  dy =  1; }
    else if (angle >=  157.5 || angle < -157.5) { dx = -1;            }
    else if (angle >= -157.5 && angle < -112.5) { dx = -1;  dy = -1; }
    else if (angle >= -112.5 && angle <  -67.5) {            dy = -1; }
    else if (angle >=  -67.5 && angle <  -22.5) { dx =  1;  dy = -1; }

    this.startX   = Math.round(this.logicalX / this.tileSize) * this.tileSize;
    this.startY   = Math.round(this.logicalY / this.tileSize) * this.tileSize;
    this.logicalX = this.startX;
    this.logicalY = this.startY;

    this.targetX = this.startX + dx * this.tileSize;
    this.targetY = this.startY + dy * this.tileSize;

    // Final collision guard -- catches diagonal steps and path-queue steps
    // that bypass the pre-check in baseLocationScene.update().
    if (this.scene?.isColliding?.(this.targetX, this.targetY)) {
      this.targetX = this.startX;
      this.targetY = this.startY;
      this.isMoving = false;
      return;
    }

    const pgr = this.scene.perspectiveGround;
    if (pgr && dy !== 0) {
      const ts = pgr.tileDisplaySize;
      this._stepPerspCamRow = pgr._perspCamRow();
      this._stepHorizonPx   = pgr._horizonPx();
      this._stepGroundH     = pgr._groundH();

      const startRow  = this.startY  / ts + 0.5;
      const targetRow = this.targetY / ts + 0.5;

      this._screenStartY  = pgr._rowToScreenY(startRow);
      const rawTarget     = pgr._rowToScreenY(targetRow);
      this._screenTargetY = rawTarget ?? (this._stepHorizonPx + 1);
    } else {
      this._screenStartY    = null;
      this._screenTargetY   = null;
      this._stepPerspCamRow = null;
      this._stepHorizonPx   = null;
      this._stepGroundH     = null;
    }

    this.isMoving      = true;
    this.moveProgress  = 0;
    this.moveDirection = { x: dx, y: dy };
  }

  canMoveTo(x, y) { return true; }

  cancelMove() {
    this.logicalX     = this.startX;
    this.logicalY     = this.startY;
    this.targetX      = this.startX;
    this.targetY      = this.startY;
    this.isMoving     = false;
    this.moveProgress = 0;
    this.pathQueue    = [];
    this._screenStartY    = null;
    this._screenTargetY   = null;
    this._stepPerspCamRow = null;
    this._stepHorizonPx   = null;
    this._stepGroundH     = null;
  }
}


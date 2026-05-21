import Phaser from 'phaser';
import Player from '../../player/player.js';
import Joystick from '../../input/joystick.js';
import TextPanel from '../../ui/textPanel.js';
import TerrainManager from '../../systems/terrainManager.js'
import HPDisplay from '../../ui/HPDisplay.js'

/**
 * Base class for all location scenes.
 *
 * PERSPECTIVE NOTE:
 * player.sprite.x/y are owned by PerspectiveGroundRenderer for visual
 * placement only. All game logic must use player.logicalX / player.logicalY.
 */
export default class BaseLocationScene extends Phaser.Scene {
  constructor(config) {
    super(config);
  }

  // ── Preload ───────────────────────────────────────────────────────────────

  preload() {
    this.load.image('championSheet_armored',   'assets/champions/champions-with-kit.png');
    this.load.image('championSheet_unarmored', 'assets/champions/champions-no-kit.png');
    this.load.json('championAtlas', 'assets/champions/champions0.json');
    this.load.image('darkStone', 'assets/darkStone.png');
    this.load.image('slot_equipped',       '/assets/inventory/slot_equipped.png');
    this.load.image('slot_inventory',      '/assets/inventory/slot_inventory.png');
    this.load.image('panel_stone',         '/assets/inventory/panel_stone.png');
    this.load.image('item_leather_armor',  'assets/inventory/A_Armour02.png');
    this.load.image('item_simple_bow',     'assets/inventory/W_Bow02.png');
    this.load.image('item_healing_potion', 'assets/inventory/P_Blue04.png');
    this.load.image('item_arrows',         'assets/inventory/W_Bow17.png');
    this.load.image('glowCursor',          'assets/glowCursor.png');

    this.load.audio('creak1',           'assets/sounds/creak1.wav');
    this.load.audio('arrowShoot1',      'assets/sounds/arrowShoot1.wav');
    this.load.audio('arrowShoot2',      'assets/sounds/arrowShoot2.wav');
    this.load.audio('arrowShoot3',      'assets/sounds/arrowShoot3.wav');
    this.load.audio('pumpkin_break_01', 'assets/sounds/pumpkin_break_01.ogg');
    this.load.audio('parrySound',       'assets/sounds/parry.mp3');

    this.load.on('filecomplete', (key, type) => console.log('File loaded:', key, type));

    this.load.json(
      this.scene.key.toLowerCase() + 'Map',
      'data/maps/' + this.scene.key.toLowerCase() + '.json?v=' + Date.now()
    );
  }

  // ── Location init ─────────────────────────────────────────────────────────

  initializeLocation() {
    let champion = this.registry.get('selectedChampion') ||
                   window.selectedChampion ||
                   this.game.config.selectedChampion;

    console.log('Champion retrieved:', champion);
    if (!champion) {
      console.error('Champion is undefined! Check if startGame was called properly');
      return;
    }
    console.log('Champion loaded:', champion.nameGa);

    const spawn   = this.mapData.spawns.player;
    const playerX = spawn.x * this.tileSize + this.tileSize / 2;
    const playerY = spawn.y * this.tileSize + this.tileSize / 2;

    this.player = new Player(this, playerX, playerY, champion);

    this.hpDisplay = new HPDisplay(this, { x: 20, y: 50 });
    this.hpDisplay.updateDisplay(this.player.currentHP, this.player.maxHP);

    this.terrainManager = new TerrainManager(this, this.player);

    this._camProxy = this.add.rectangle(playerX, playerY, 1, 1).setVisible(false);
    this.cameras.main.centerOn(playerX, playerY);
    this.cameras.main.startFollow(this._camProxy, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight);







  if (!this.joystick) {  
	  this.joystick = new Joystick(this, { x: 100,     y: this.scale.height - 100, radius: 60 })            }






    this.textPanel = new TextPanel(this);

    this.createObjects();
    this.createNPCs();

    console.log(this.scene.key + ': initialized');
  }

  // ── Update ────────────────────────────────────────────────────────────────

  _updateDroppedItems() {
    if (!this.droppedItems?.length) return
    const pgr = this.perspectiveGround
    if (!pgr) return
    this.droppedItems.forEach(d => {
      if (!d.active) return
      const proj = pgr._projectLogical(d._logicalX, d._logicalY)
      if (proj) { d.setPosition(proj.screenX, proj.screenY) }
      // Scale by perspective
      const ts  = this.tileSize ?? 48
      const row = d._logicalY / ts - 0.5
      const sc  = pgr._scaleAtRow(row + 1) / ts * 1.5
      d.setScale(Math.max(0.3, Math.min(2, sc)))
    })
  }

  update(time, delta) {
    this._updateDroppedItems()
    if (this.textPanel) this.textPanel.update(time, delta);

    if (this.player && this.joystick) {
      if (this.textPanel && this.textPanel.isVisible &&
          this.textPanel.currentPanelType === 'chat_options') {
        if (this.terrainManager) this.terrainManager.update();
        return;
      }

      if (this.joystick.force > 10) {
        const angle = this.joystick.angle;
        let dx = 0, dy = 0;

        if      (angle >= -22.5  && angle <  22.5)  dx =  1;
        else if (angle >=  22.5  && angle <  67.5)  { dx =  1; dy =  1; }
        else if (angle >=  67.5  && angle < 112.5)  dy =  1;
        else if (angle >= 112.5  && angle < 157.5)  { dx = -1; dy =  1; }
        else if (angle >=  157.5 || angle < -157.5) dx = -1;
        else if (angle >= -157.5 && angle < -112.5) { dx = -1; dy = -1; }
        else if (angle >= -112.5 && angle <  -67.5) dy = -1;
        else if (angle >=  -67.5 && angle <  -22.5) { dx =  1; dy = -1; }

        const currentX = Math.floor(this.player.logicalX / this.player.tileSize) * this.player.tileSize + this.player.tileSize / 2;
        const currentY = Math.floor(this.player.logicalY / this.player.tileSize) * this.player.tileSize + this.player.tileSize / 2;
        const targetX  = currentX + dx * this.player.tileSize;
        const targetY  = currentY + dy * this.player.tileSize;

        if (this.isColliding(targetX, targetY)) {
          this.joystick.force = 0;
          if (this.player.isMoving) this.player.isMoving = false;
        }
      }

      this.player.update(this.joystick);

      if (this.terrainManager) this.terrainManager.update();

      this._flagInRange = false
      this.checkProximityInteractions()

      if (!this._flagInRange && this._encounterPanel) {
        if (!this._lastWasFar) {
          this._lastWasFar = true
          this._encounterPanel.clearNotify()
        }
      } else {
        this._lastWasFar = false
      }

      this.checkExits()
    }

    this.checkItemPickups();

    if (this._camProxy && this.player)
      this._camProxy.setPosition(this.player.logicalX, this.player.logicalY);
  }

  // ── Collision ─────────────────────────────────────────────────────────────

  isColliding(x, y) {
    const tileX = Math.floor(x / this.tileSize);
    const tileY = Math.floor(y / this.tileSize);

    if (tileY < 0 || tileY >= this.mapData.tiles.length ||
        tileX < 0 || tileX >= this.mapData.tiles[0].length) {
      return true;
    }

    const tileType = this.mapData.tiles[tileY][tileX];

    const deepBogTiles = [
      83, 84, 99, 100, 101, 102, 115, 116, 145, 146, 147, 148, 149, 150,
      177, 182, 214, 215, 248, 249, 281, 722, 723, 724, 752, 753, 754,
      784, 785, 817
    ];
    if (deepBogTiles.includes(tileType)) return false;

    return false;
  }

  // ── Objects ───────────────────────────────────────────────────────────────

  createObjects() {
    if (!this.mapData.objects) return;
    this.interactables = [];

    this.mapData.objects.forEach(obj => {
      const pixelX = obj.x * this.tileSize + this.tileSize / 2;
      const pixelY = obj.y * this.tileSize + this.tileSize / 2;

      const zone = this.add.zone(pixelX, pixelY, this.tileSize, this.tileSize);
      zone.setData('id',       obj.id);
      zone.setData('type',     obj.type);
      zone.setData('text',     obj.text);
      zone.setData('stateKey', obj.stateKey || `${this.scene.key}.${obj.id}`);
      zone.setData('item',     obj.item  || null);
      zone.setData('note',     obj.note  || null);
      zone.setData('logicalX', pixelX);
      zone.setData('logicalY', pixelY);
      zone.x = pixelX;
      zone.y = pixelY;

      this.interactables.push(zone);
    });

    console.log(this.scene.key + ': created', this.interactables.length, 'objects');
  }

  // ── NPCs ──────────────────────────────────────────────────────────────────

  createNPCs() {
    if (!this.mapData.npcs) return;
    this.npcs = [];

    this.mapData.npcs.forEach(npcData => {
      const pixelX = npcData.x * this.tileSize + this.tileSize / 2;
      const pixelY = npcData.y * this.tileSize + this.tileSize / 2;

      const color  = npcData.visual?.color ? parseInt(npcData.visual.color) : 0x4169e1;
      const radius = npcData.visual?.radius || 16;

      const sprite = this.add.circle(pixelX, pixelY, radius, color);
      sprite.setData('id',           npcData.id);
      sprite.setData('name',         npcData.name);
      sprite.setData('dialogues',    npcData.dialogues);
      sprite.setData('dialogueIndex', 0);
      sprite.setData('isNPC',        true);
      sprite.setData('logicalX',     pixelX);
      sprite.setData('logicalY',     pixelY);
      sprite.setDepth(10);
      sprite.setInteractive();

      this.add.text(pixelX, pixelY - radius - 6, npcData.name, {
        fontSize: '12px', fontFamily: 'Arial',
        color: '#ffffff', backgroundColor: '#000000',
        padding: { x: 4, y: 2 }
      }).setOrigin(0.5, 1).setDepth(11);

      sprite.on('pointerdown', () => this.talkToNPC(sprite));
      this.npcs.push(sprite);
    });

    console.log(this.scene.key + ': created', this.npcs.length, 'NPCs');
  }

  talkToNPC(npc) {
    const dialogues = npc.getData('dialogues');
    const index     = npc.getData('dialogueIndex') || 0;
    const dialogue  = dialogues[index];
    const stateKey  = npc.getData('stateKey');

    if (this.joystick) this.joystick.reset();
    if (this.player)   this.player.isMoving = false;

    this.textPanel.show({
      ...dialogue,
      irish:   dialogue.ga  || dialogue.irish   || '',
      english: dialogue.en  || dialogue.english || '',
      type: 'dialogue',
      speaker: npc.getData('name'),
      onDismiss: () => {
        const nextIndex = (index + 1) % dialogues.length;
        npc.setData('dialogueIndex', nextIndex);
        if (stateKey && window.GameState)
          window.GameState.setNPCProgress(stateKey, nextIndex);
      }
    });
  }

  // ── Proximity interactions ────────────────────────────────────────────────

 
  // -- Proximity interactions -----------------------------------------------
  // Replacement for BaseLocationScene.checkProximityInteractions()

  checkProximityInteractions() {
    if (this.narrativeInProgress) return;
    if (this.textPanel.isVisible || this.textPanelCooldown) return;

    const playerX = this.player.logicalX;
    const playerY = this.player.logicalY;

    // -- Find nearest encounter flag or fixed encounter within range --
    let nearestFlag = null;
    let nearestDist = Infinity;
    const FLAG_RADIUS = this.tileSize * 1;

    this.interactables.forEach(obj => {
      const t = obj.getData('type');
      if (t !== 'encounter_flag' && t !== 'fixed_encounter') return;
      const objX = obj.getData('logicalX') ?? obj.x;
      const objY = obj.getData('logicalY') ?? obj.y;
      const dist = Phaser.Math.Distance.Between(playerX, playerY, objX, objY);
      if (dist < FLAG_RADIUS && dist < nearestDist) {
        nearestDist = dist;
        nearestFlag = obj;
      }
    });

    if (nearestFlag) {
      this._flagInRange = true;
      if (this._encounterPanel) {
        const text   = nearestFlag.getData('text');
        const id     = nearestFlag.getData('id');
        const visual = nearestFlag.getData('flagVisual') || nearestFlag.getData('visual');
        this._encounterPanel.notify(
          {
            id,
            visual,
            ga:      text?.ga || '',
            en:      text?.en || '',
            actions: nearestFlag.getData('actions') || [],
            // Pass dialogues so EncounterPanel can distinguish fixed encounters
            dialogues: nearestFlag.getData('dialogues') || [],
          },
          nearestFlag
        );
      }
    }

    // -- All other interactables --
    this.interactables.forEach(obj => {
      const t = obj.getData('type');
      if (t === 'encounter_flag') return;   // handled above
      if (t === 'fixed_encounter') return;  // handled by EncounterPanel

      const objX = obj.getData('logicalX') ?? obj.x;
      const objY = obj.getData('logicalY') ?? obj.y;

      const dist = Phaser.Math.Distance.Between(playerX, playerY, objX, objY);
      if (dist >= 60) return;

      const text     = obj.getData('text');
      const id       = obj.getData('id');
      const type     = obj.getData('type');
      const stateKey = obj.getData('stateKey');
      const note     = obj.getData('note');

      if (this.joystick) this.joystick.reset();
      if (this.player)   this.player.isMoving = false;

      if (note && window.GameState) window.GameState.addNote(note);

      if (type === 'collectable') {
        this.textPanel.show({
          ...text,
          irish:   text?.ga || text?.irish   || '',
          english: text?.en || text?.english || '',
          id, type: 'examine',
          onDismiss: () => {
            if (stateKey && window.GameState) window.GameState.setCollected(stateKey);
            const item = obj.getData('item');
            if (item && this.player?.inventory) {
              const slot = this.player.inventory.findEmptyInventorySlot();
              if (slot !== -1) this.player.inventory.setItem(slot, item);
            }
            const idx = this.interactables.indexOf(obj);
            if (idx > -1) this.interactables.splice(idx, 1);
          }
        });
        return;
      }

      this.textPanel.show({
        ...text,
        irish:   text?.ga || text?.irish   || '',
        english: text?.en || text?.english || '',
        id, type: 'examine'
      });
    });
  }

  // ── Exits ─────────────────────────────────────────────────────────────────

  checkExits() {
    if (!this.mapData.exits) return
    const tileX = Math.floor(this.player.logicalX / this.tileSize);
    const tileY = Math.floor(this.player.logicalY / this.tileSize);

    for (const [, exitData] of Object.entries(this.mapData.exits)) {
      if (exitData.tiles.some(([ex, ey]) => ex === tileX && ey === tileY)) {
        console.log(`[${this.scene.key}] exit -> ${exitData.destination} at [${tileX},${tileY}]`)
        this.scene.start(exitData.destination, {
          entryEdge:  exitData.entryPoint,
          sourceTile: { x: tileX, y: tileY }
        });
        return;
      }
    }
  }

  // ── Item pickups ──────────────────────────────────────────────────────────

  checkItemPickups() {
    if (!this.droppedItems?.length) return
    const ts      = this.tileSize ?? 48
    const playerX = this.player.logicalX
    const playerY = this.player.logicalY
    const pTileX  = Math.floor(playerX / ts)
    const pTileY  = Math.floor(playerY / ts)

    for (let i = this.droppedItems.length - 1; i >= 0; i--) {
      const item = this.droppedItems[i]
      if (!item.active || item.justDropped) continue

      // Pickup when player walks onto same tile as item
      const iTileX = Math.floor(item._logicalX / ts)
      const iTileY = Math.floor(item._logicalY / ts)
      if (pTileX !== iTileX || pTileY !== iTileY) continue

      const slot = this.player.inventory.findEmptyInventorySlot()
      if (slot === -1) {
        if (this.textPanel) this.textPanel.show({
          irish: 'Tasc lan!', english: 'Inventory full!', type: 'notification'
        })
        continue
      }

      this.player.inventory.setItem(slot, item.itemData)
      if (this.textPanel) this.textPanel.show({
        irish:   `Fuair me ${item.itemData.nameGa}`,
        english: `I got the ${item.itemData.nameEn}`,
        type: 'notification'
      })

      this.droppedItems.splice(i, 1)
      item.destroy()
      if (this.worldMenu?.isOpen) this.worldMenu.refreshGridDisplay()
    }
  }

  // ── Item spawning ─────────────────────────────────────────────────────────

  spawnItemOnMap(item, x, y) {
    // Spawn one tile south of player, projected through PGR
    const pgr   = this.perspectiveGround
    const ts    = this.tileSize ?? 48
    const logX  = this.player.logicalX
    const logY  = this.player.logicalY + ts
    const proj  = pgr?._projectLogical(logX, logY)
    const sx    = proj?.screenX ?? (this.scale.width / 2)
    const sy    = proj?.screenY ?? (this.scale.height / 2)

    const dropped = this.add.image(sx, sy, item.spriteKey)
      .setDepth(50).setScrollFactor(0).setScale(0.4)

    dropped._logicalX   = logX
    dropped._logicalY   = logY
    dropped.itemData    = item.clone ? item.clone() : { ...item }
    dropped.justDropped = true

    if (!this.droppedItems) this.droppedItems = []
    this.droppedItems.push(dropped)

    this.time.delayedCall(2000, () => {
      if (dropped?.active) dropped.justDropped = false
    })
  }

  tryPickupItem(dropped, collider) {
    if (dropped.justDropped) return;

    const slot = this.player.inventory.findEmptyInventorySlot();
    if (slot === -1) return;

    this.player.inventory.setItem(slot, dropped.itemData);

    const idx = this.droppedItems.indexOf(dropped);
    if (idx > -1) this.droppedItems.splice(idx, 1);
    if (collider) collider.destroy();
    dropped.destroy();

    console.log('Picked up:', dropped.itemData.nameEn, 'into slot', slot);
    if (this.worldMenu?.isOpen) this.worldMenu.refreshGridDisplay();
  }
}


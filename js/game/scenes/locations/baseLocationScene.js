import Phaser from 'phaser';
import Player from '../../player/player.js';
import Joystick from '../../input/joystick.js';
import TextPanel from '../../ui/textPanel.js';

import TerrainManager from '../../systems/terrainManager.js'
import HPDisplay from  '../../ui/HPDisplay.js'
/**
 * Base class for all location scenes
 * Handles common functionality like player movement, collision, NPCs, objects
 */
export default class BaseLocationScene extends Phaser.Scene {
  constructor(config) {
    super(config);
  }



preload() {
  // Load champion spritesheet and atlas
  this.load.image('championSheet_armored', 'assets/champions/champions-with-kit.png');
  this.load.image('championSheet_unarmored', 'assets/champions/champions-no-kit.png');
  this.load.json('championAtlas', 'assets/champions/champions0.json');









// Slot backgrounds
  this.load.image('slot_equipped', 'public/images/ui/inventory/slot_equipped.png');
  this.load.image('slot_inventory', 'public/images/ui/inventory/slot_inventory.png');
  this.load.image('panel_stone', 'public/images/ui/inventory/panel_stone.png');
  
  // Items (use the item IDs from itemDefinitions.js)
  this.load.image('item_leather_armor', 'assets/inventory/A_Armour02.png');
  this.load.image('item_simple_bow', 'assets/inventory/W_Bow02.png');
  this.load.image('item_healing_potion', 'assets/inventory/P_Blue04.png');
  this.load.image('item_arrows', 'assets/inventory/W_Bow17.png');

this.load.image('glowCursor', 'assets/glowCursor.png');                                       this.load.audio('creak1', 'assets/sounds/creak1.wav');                                   this.load.audio('arrowShoot1', 'assets/sounds/arrowShoot1.wav');                          this.load.audio('arrowShoot2', 'assets/sounds/arrowShoot2.wav');                            this.load.audio('arrowShoot3', 'assets/sounds/arrowShoot3.wav');                            this.load.audio('pumpkin_break_01', 'assets/sounds/pumpkin_break_01.ogg');   this.load.audio('parrySound', 'assets/sounds/parry.mp3');


  // Add this to check if files loaded
  this.load.on('filecomplete', (key, type, data) => {
    console.log('File loaded:', key, type);
  });

  // Your existing map preload
  this.load.json(this.scene.key.toLowerCase() + 'Map', 'data/maps/' + this.scene.key.toLowerCase() + '.json?v=' + Date.now());
}





// 2. UPDATE initializeLocation() method
initializeLocation() {
  // Try multiple ways to get the champion
  let champion = this.registry.get('selectedChampion') ||
                 window.selectedChampion ||
                 this.game.config.selectedChampion;

  console.log('Champion retrieved:', champion);

  if (!champion) {
    console.error('Champion is undefined! Check if startGame was called properly');
    return;
  }

  console.log('Champion loaded:', champion.nameGa);

  // Create player at spawn point
  const spawn = this.mapData.spawns.player;
  const playerX = spawn.x * this.tileSize + this.tileSize / 2;
  const playerY = spawn.y * this.tileSize + this.tileSize / 2;

  this.player = new Player(this, playerX, playerY, champion);

  // === NEW: Create HP Display ===
  this.hpDisplay = new HPDisplay(this, { x: 20, y: 50 });
  this.hpDisplay.updateDisplay(this.player.currentHP, this.player.maxHP);

  // === NEW: Create Terrain Manager ===
  this.terrainManager = new TerrainManager(this, this.player);

  // Set up camera
  this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
  this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight);

  // Create joystick
  this.joystick = new Joystick(this, {
    x: 100,
    y: this.scale.height - 100,
    radius: 60
  });

  // Initialize text panel system
  this.textPanel = new TextPanel(this);

  // Load objects and NPCs from map data
  this.createObjects();
  this.createNPCs();

  console.log(this.scene.key + ': initialized');
}

  /**
   * Standard update loop - handles player movement and collision
   */



update() {
  if (this.player && this.joystick) {
    // NEW: Don't process movement if text panel is visible
    if (this.textPanel && this.textPanel.isVisible) {
      // Still update terrain manager even when text is showing
      if (this.terrainManager) {
        this.terrainManager.update();
      }
      return; // Block all movement during dialogue/notifications
    }

    // ALWAYS check collision before any movement
    if (this.joystick.force > 10) {
      // Player wants to move - check if target is valid
      const angle = this.joystick.angle;
      let dx = 0, dy = 0;

      // Calculate intended direction
      if (angle >= -22.5 && angle < 22.5) dx = 1;
      else if (angle >= 22.5 && angle < 67.5) { dx = 1; dy = 1; }
      else if (angle >= 67.5 && angle < 112.5) dy = 1;
      else if (angle >= 112.5 && angle < 157.5) { dx = -1; dy = 1; }
      else if (angle >= 157.5 || angle < -157.5) dx = -1;
      else if (angle >= -157.5 && angle < -112.5) { dx = -1; dy = -1; }
      else if (angle >= -112.5 && angle < -67.5) dy = -1;
      else if (angle >= -67.5 && angle < -22.5) { dx = 1; dy = -1; }

      // Snap to grid and calculate target
      const currentX = Math.round(this.player.sprite.x / this.player.tileSize) * this.player.tileSize;
      const currentY = Math.round(this.player.sprite.y / this.player.tileSize) * this.player.tileSize;
      const targetX = currentX + (dx * this.player.tileSize);
      const targetY = currentY + (dy * this.player.tileSize);

      // Block movement if target is not walkable
      if (this.isColliding(targetX, targetY)) {
        this.joystick.force = 0;
        // Also stop player if they're currently moving in this direction
        if (this.player.isMoving) {
          this.player.isMoving = false;
        }
      }
    }

    this.player.update(this.joystick);

    // Update terrain manager
    if (this.terrainManager) {
      this.terrainManager.update();
    }

    // Check for nearby interactable objects
    this.checkProximityInteractions();

    // Check for exits
    this.checkExits();
  }

  this.checkItemPickups();
}







checkItemPickups() {
  if (!this.droppedItems || this.droppedItems.length === 0) return;
  
  const playerX = this.player.sprite.x;
  const playerY = this.player.sprite.y;
  
  // Check each dropped item
  for (let i = this.droppedItems.length - 1; i >= 0; i--) {
    const droppedItem = this.droppedItems[i];
    
    // Skip if just dropped
    if (droppedItem.justDropped) continue;
    
    // Calculate distance
    const distance = Phaser.Math.Distance.Between(
      playerX, playerY,
      droppedItem.x, droppedItem.y
    );
    
    // If close enough, pick it up
    if (distance < 30) {
      console.log('🎯 Player close to item, picking up!');
      
      const emptySlot = this.player.inventory.findEmptyInventorySlot();
      
      if (emptySlot === -1) {
        console.log('❌ Inventory full!');
        
        // Show "inventory full" notification
        if (this.textPanel) {
          this.textPanel.show({
            irish: 'Tásc lán!',
            english: 'Inventory full!',
            type: 'notification'
          });
        }
        continue;
      }
      
      // Add to inventory
      this.player.inventory.setItem(emptySlot, droppedItem.itemData);
      
      // Show pickup notification
      if (this.textPanel) {
        this.textPanel.show({
          irish: `Fuair mé ${droppedItem.itemData.nameGa}`,
          english: `I got the ${droppedItem.itemData.nameEn}`,
          type: 'notification'
        });
      }
      
      // Clean up
      this.droppedItems.splice(i, 1);
      if (droppedItem.pickupCollider) {
        droppedItem.pickupCollider.destroy();
      }
      droppedItem.destroy();
      
      console.log('✅ Picked up:', droppedItem.itemData.nameEn);
      
      // Refresh inventory UI if open
      if (this.worldMenu && this.worldMenu.isOpen) {
        this.worldMenu.refreshGridDisplay();
      }
    }
  }
}






  /**
   * Override this in child scenes for custom collision logic
   */


// In BaseLocationScene.js - UPDATE isColliding()
isColliding(x, y) {
  const tileX = Math.floor(x / this.tileSize);
  const tileY = Math.floor(y / this.tileSize);

  // Check bounds
  if (tileY < 0 || tileY >= this.mapData.tiles.length ||
      tileX < 0 || tileX >= this.mapData.tiles[0].length) {
    return true;
  }

  const tileType = this.mapData.tiles[tileY][tileX];
  
  // Deep bog tiles are walkable (terrain manager handles effects)
  const deepBogTiles = [83, 84, 99, 100, 101, 102, 115, 116, 145, 146, 147, 148, 149, 150,
                        177, 182, 214, 215, 248, 249, 281, 722, 723, 724, 752, 753, 754,
                        784, 785, 817];
  
  if (deepBogTiles.includes(tileType)) {
    return false; // Allow walking, terrain manager handles effects
  }

  // Check regular unwalkable tiles
  return this.mapData.unwalkableTiles && this.mapData.unwalkableTiles.includes(tileType);
}




  createObjects() {
    if (!this.mapData.objects) return;
    
    this.interactables = [];
    
    this.mapData.objects.forEach(obj => {
      const pixelX = obj.x * this.tileSize + this.tileSize / 2;
      const pixelY = obj.y * this.tileSize + this.tileSize / 2;
      
      let sprite;
      
      if (obj.visual.shape === 'circle') {
        sprite = this.add.circle(
          pixelX,
          pixelY,
          obj.visual.radius,
          parseInt(obj.visual.color)
        );
      } else if (obj.visual.shape === 'rectangle') {
        sprite = this.add.rectangle(
          pixelX,
          pixelY,
          obj.visual.width,
          obj.visual.height,
          parseInt(obj.visual.color)
        );
      }
      
      if (sprite) {
        sprite.setData('id', obj.id);
        sprite.setData('type', obj.type);
        sprite.setData('text', obj.text);
        sprite.setDepth(10);
        
        this.interactables.push(sprite);
      }
    });
    
    console.log(this.scene.key + ': created', this.interactables.length, 'objects');
  }

  createNPCs() {
    if (!this.mapData.npcs) return;
    
    this.npcs = [];
    
    this.mapData.npcs.forEach(npcData => {
      const pixelX = npcData.x * this.tileSize + this.tileSize / 2;
      const pixelY = npcData.y * this.tileSize + this.tileSize / 2;
      
      let sprite;
      
      if (npcData.visual.shape === 'circle') {
        sprite = this.add.circle(
          pixelX,
          pixelY,
          npcData.visual.radius,
          parseInt(npcData.visual.color)
        );
      }
      
      if (sprite) {
        sprite.setData('id', npcData.id);
        sprite.setData('name', npcData.name);
        sprite.setData('dialogues', npcData.dialogues);
        sprite.setData('dialogueIndex', 0);
        sprite.setData('isNPC', true);
        sprite.setDepth(10);
        sprite.setInteractive();
        
        // Add name label above NPC
        const label = this.add.text(
          pixelX,
          pixelY - 25,
          npcData.name,
          {
            fontSize: '12px',
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 4, y: 2 }
          }
        ).setOrigin(0.5, 1);
        label.setDepth(11);
        
        sprite.on('pointerdown', () => {
          this.talkToNPC(sprite);
        });
        
        this.npcs.push(sprite);
      }
    });
    
    console.log(this.scene.key + ': created', this.npcs.length, 'NPCs');
  }

  talkToNPC(npc) {
    const dialogues = npc.getData('dialogues');
    const index = npc.getData('dialogueIndex') || 0;
    const dialogue = dialogues[index];
    
    this.textPanel.show({
      ...dialogue,
      type: 'dialogue',
      speaker: npc.getData('name'),
      onDismiss: () => {
        const nextIndex = (index + 1) % dialogues.length;
        npc.setData('dialogueIndex', nextIndex);
      }
    });
  }

checkProximityInteractions() {
  // Don't check proximity during narrative
  if (this.narrativeInProgress) return;
  

  // Check for cooldown
  if (this.textPanel.isVisible || this.textPanelCooldown) return;

  const playerX = this.player.sprite.x;
  const playerY = this.player.sprite.y;

  this.interactables.forEach(obj => {
    const dist = Phaser.Math.Distance.Between(
      playerX, playerY,
      obj.x, obj.y
    );

    if (dist < 25) {
      const text = obj.getData('text');
      this.textPanel.show({
        ...text,
        type: 'examine'
      });
    }
  });
}

  

  checkExits() {
    const tileX = Math.floor(this.player.sprite.x / this.tileSize);
    const tileY = Math.floor(this.player.sprite.y / this.tileSize);
    
    if (this.mapData.tiles[tileY] && this.mapData.tiles[tileY][tileX] === 2) {
      for (const [direction, exitData] of Object.entries(this.mapData.exits)) {
        const isOnExit = exitData.tiles.some(([ex, ey]) => ex === tileX && ey === tileY);
        if (isOnExit) {


this.scene.start(exitData.destination, {
  entryEdge: exitData.entryPoint,
  sourceTile: { x: tileX, y: tileY }
});


          return;
        }
      }
    }
  }





spawnItemOnMap(item, x, y) {
  console.log('Spawning item:', item.nameEn, 'at', x, y);
  
  // Create the dropped item sprite
  const droppedItem = this.physics.add.sprite(x, y, item.spriteKey)
    .setScale(1.0)
    .setDepth(5); // Above tiles, below UI
  
  // Configure physics body
  if (droppedItem.body) {
    droppedItem.body.setSize(32, 32);
    droppedItem.body.setAllowGravity(false);
    droppedItem.body.immovable = true;
  }
  
  // Store item data
  droppedItem.itemData = item.clone();
  droppedItem.justDropped = true;
  
  // Initialize dropped items array
  if (!this.droppedItems) {
    this.droppedItems = [];
  }
  this.droppedItems.push(droppedItem);
  
  // Clear justDropped flag
  this.time.delayedCall(500, () => {
    if (droppedItem && droppedItem.active) {
      droppedItem.justDropped = false;
      console.log('✅ Item ready for pickup:', item.nameEn);
    }
  });
  
  // Set up pickup collision
  const pickupCollider = this.physics.add.overlap(
    this.player.sprite,
    droppedItem,
    () => this.tryPickupItem(droppedItem, pickupCollider),
    null,
    this
  );
  
  droppedItem.pickupCollider = pickupCollider;
}

tryPickupItem(droppedItem, collider) {
  console.log('🎯 Overlap fired! justDropped:', droppedItem.justDropped);
  
  if (droppedItem.justDropped) {
    console.log('⏸️ Skipping - item just dropped');
    return;
  }
  
  // Find empty slot
  const emptySlot = this.player.inventory.findEmptyInventorySlot();
  
  if (emptySlot === -1) {
    console.log('❌ Inventory full!');
    return;
  }
  
  // Add to inventory
  this.player.inventory.setItem(emptySlot, droppedItem.itemData);
  
  // Clean up
  const index = this.droppedItems.indexOf(droppedItem);
  if (index > -1) {
    this.droppedItems.splice(index, 1);
  }
  
  if (collider) {
    collider.destroy();
  }
  droppedItem.destroy();
  
  console.log('✅ Picked up:', droppedItem.itemData.nameEn, 'into slot', emptySlot);
  
  // Refresh inventory UI if open
  if (this.worldMenu && this.worldMenu.isOpen) {
    this.worldMenu.refreshGridDisplay();
  }
}






















}

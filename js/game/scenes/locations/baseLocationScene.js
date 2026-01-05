import Phaser from 'phaser';
import Player from '../../player/player.js';
import Joystick from '../../input/joystick.js';
import TextPanel from '../../ui/textPanel.js';

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
  this.load.image('championSheet', 'assets/champions/champions-with-kit.png');
  this.load.json('championAtlas', 'assets/champions/champions0.json');



this.load.image('glowCursor', 'assets/glowCurs    or.png');                                       this.load.audio('creak1', 'assets/sounds/creak1.wav');                                   this.load.audio('arrowShoot1', 'assets/sounds/arrowShoot1.wav');                          this.load.audio('arrowShoot2', 'assets/sounds/arrowShoot2.wav');                            this.load.audio('arrowShoot3', 'assets/sounds/arrowShoot3.wav');                            this.load.audio('pumpkin_break_01', 'assets/sounds/pumpkin_break_01.ogg');   this.load.audio('parrySound', 'assets/sounds/parry.mp3');


  // Add this to check if files loaded
  this.load.on('filecomplete', (key, type, data) => {
    console.log('File loaded:', key, type);
  });

  // Your existing map preload
  this.load.json(this.scene.key.toLowerCase() + 'Map', 'data/maps/' + this.scene.key.toLowerCase() + '.json?v=' + Date.now());
}




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
    // ALWAYS check collision before any movement (remove the !this.player.isMoving condition)
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

    // Check for nearby interactable objects
    this.checkProximityInteractions();

    // Check for exits
    this.checkExits();
  }
}

  /**
   * Override this in child scenes for custom collision logic
   */


isColliding(x, y) {
  const tileX = Math.floor(x / this.tileSize);
  const tileY = Math.floor(y / this.tileSize);

  // Check bounds
  if (tileY < 0 || tileY >= this.mapData.tiles.length ||
      tileX < 0 || tileX >= this.mapData.tiles[0].length) {
    return true;
  }

  // Check if tile is unwalkable (using map's unwalkableTiles array)
  const tileType = this.mapData.tiles[tileY][tileX];
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
          console.log(`Transitioning to ${exitData.destination}`);
          this.scene.start(exitData.destination, { 
            entryPoint: exitData.entryPoint 
          });
          return;
        }
      }
    }
  }
}

// js/game/systems/terrainManager.js

/**
 * TerrainManager - Handles terrain-specific effects on the player
 * Supports: movement speed, sprite depth offset, damage over time, visual effects
 */
export default class TerrainManager {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    
    // Current terrain the player is standing on
    this.currentTerrain = null;
    this.previousTerrain = null;
    
    // Track sprite offset for sinking effect
    this.currentSinkDepth = 0; // How many pixels we've sunk
    this.targetSinkDepth = 0;
    
    // Create mask for cropping sprite from bottom
    this.createSpriteMask();
    
    // Damage over time tracking
    this.damageTimer = null;
    
    // Define terrain types and their properties
    this.terrainTypes = {
      normal: {
        ids: [], // Default for any unmatched tile
        name: 'Normal Ground',
        speedModifier: 1.0,
        spriteOffsetY: 0,
        damagePerSecond: 0,
        walkable: true
      },
      
      bogShore: {
        ids: [], // Add your bog shore tile IDs here if you have them
        name: 'Bog Shore',
        speedModifier: 0.5, // Half speed
        spriteOffsetY: -10, // Sink down 10 pixels
        damagePerSecond: 0, // No damage on shore
        walkable: true,
        onEnter: (player) => {
          console.log('Entered bog shore - sinking slightly');
          // Text notifications disabled for now
        }
      },
      
      deepBog: {
        ids: [83, 84, 99, 100, 101, 102, 115, 116, 145, 146, 147, 148, 149, 150,
              177, 182, 214, 215, 248, 249, 281, 722, 723, 724, 752, 753, 754,
              784, 785, 817],
        name: 'Deep Bog',
        speedModifier: 0.1, // Very slow (90% slower)
        spriteOffsetY: -50, // Sink down 20 pixels
        damagePerSecond: 1, // 1 HP per second (if wearing armor)
        walkable: true,
        requiresCheck: true, // Check armor before applying damage
        onEnter: (player) => {
          console.log('Entered deep bog');
          // Text notifications disabled for now
        },
        onExit: (player) => {
          console.log('Exited deep bog - stopping damage');
        }
      }
    };
    
    // Warning flags
    this.shoreWarningShown = false;
    this.deepBogArmorWarningShown = false;
    this.deepBogNoArmorShown = false;
  }
  
  /**
   * Create a mask that crops the sprite from the bottom
   */
  createSpriteMask() {
    if (!this.player.sprite) return;
    
    const spriteWidth = this.player.tileSize * 2;
    const spriteHeight = this.player.tileSize * 2;
    
    // Create a graphics object for the mask (invisible)
    this.maskGraphics = this.scene.add.graphics();
    this.maskGraphics.setDepth(99);
    this.maskGraphics.setVisible(false); // HIDE THE MASK GRAPHICS
    
    // Store the player's original Y position (ground level)
    this.playerGroundY = this.player.sprite.y;
    
    // Initially show full sprite (no cropping)
    this.updateMask(0);
    
    // Apply mask to player sprite
    const mask = this.maskGraphics.createGeometryMask();
    this.player.sprite.setMask(mask);
    
    // Also apply to bow overlay if it exists
    if (this.player.bowOverlay) {
      this.player.bowOverlay.setMask(mask);
    }
  }
  
  /**
   * Update the mask based on sink depth
   * @param {number} sinkDepth - How many pixels to hide from bottom
   */
  updateMask(sinkDepth) {
    if (!this.maskGraphics || !this.player.sprite) return;
    
    const spriteWidth = this.player.tileSize * 2;
    const spriteHeight = this.player.tileSize * 2;
    
    // Calculate ground level (where player would be without sinking)
    const groundY = this.player.sprite.y - sinkDepth;
    
    // Clear and redraw mask
    this.maskGraphics.clear();
    this.maskGraphics.fillStyle(0xffffff);
    
    // Mask is at ground level (water surface) - shows everything above water
    this.maskGraphics.fillRect(
      this.player.sprite.x - spriteWidth / 2,
      groundY - spriteHeight / 2,
      spriteWidth,
      spriteHeight
    );
  }
  
  /**
   * Update terrain effects based on player position
   * Call this every frame from the scene's update loop
   */
  update() {
    if (!this.player || !this.player.sprite) return;
    
    // Get current tile type based on GRID position (not visual sprite position)
    // Use targetY when moving, otherwise use sprite Y minus any sink offset
    const baseY = this.player.isMoving ? this.player.targetY : (this.player.sprite.y - (this.player.terrainSinkOffset || 0));
    const baseX = this.player.isMoving ? this.player.targetX : this.player.sprite.x;
    
    const tileX = Math.floor(baseX / this.scene.tileSize);
    const tileY = Math.floor(baseY / this.scene.tileSize);
    
    if (!this.scene.mapData || !this.scene.mapData.tiles) return;
    if (tileY < 0 || tileY >= this.scene.mapData.tiles.length) return;
    if (tileX < 0 || tileX >= this.scene.mapData.tiles[0].length) return;
    
    const tileType = this.scene.mapData.tiles[tileY][tileX];
    
    // Find matching terrain definition
    const terrain = this.getTerrainByTileType(tileType);
    
    // Check if terrain changed
    if (this.currentTerrain !== terrain) {
      this.onTerrainChange(terrain);
    }
    
    // Apply continuous effects (like damage over time)
    this.applyContinuousEffects(terrain);
    
    // Update sprite offset (sinking effect)
    this.updateSpriteOffset();
  }
  
  /**
   * Get terrain definition by tile type
   */
  getTerrainByTileType(tileType) {
    for (const terrain of Object.values(this.terrainTypes)) {
      // Check if this tile type matches this terrain's IDs
      if (terrain.ids && terrain.ids.includes(tileType)) {
        return terrain;
      }
    }
    return this.terrainTypes.normal; // Default to normal ground
  }
  
  /**
   * Handle terrain change
   */
  onTerrainChange(newTerrain) {
    console.log(`Terrain changed: ${this.currentTerrain?.name || 'none'} -> ${newTerrain.name}`);
    
    // Exit previous terrain
    if (this.currentTerrain && this.currentTerrain.onExit) {
      this.currentTerrain.onExit(this.player);
    }
    
    // Stop damage timer from previous terrain
    if (this.damageTimer) {
      this.damageTimer.remove();
      this.damageTimer = null;
    }
    
    this.previousTerrain = this.currentTerrain;
    this.currentTerrain = newTerrain;
    
    // Apply new terrain effects
    this.applyTerrainEffects(newTerrain);
    
    // Enter new terrain
    if (newTerrain.onEnter) {
      newTerrain.onEnter(this.player);
    }
  }
  
  /**
   * Apply terrain effects (speed, sprite offset)
   */
  applyTerrainEffects(terrain) {
    // Apply speed modifier
    this.player.setTerrainSpeedModifier(terrain.speedModifier);
    
    // Set target sink depth (negative values = sink down)
    this.targetSinkDepth = Math.abs(terrain.spriteOffsetY);
    
    console.log(`Applied terrain effects: speed=${terrain.speedModifier}x, sink=${this.targetSinkDepth}px`);
  }
  
  /**
   * Apply continuous effects like damage over time
   */
  applyContinuousEffects(terrain) {
    if (!terrain.damagePerSecond || terrain.damagePerSecond <= 0) return;
    
    // Check if we need to do armor check
    let shouldApplyDamage = true;
    
    if (terrain.requiresCheck) {
      const armor = this.player.inventory.getItem(2);
      const isWearingArmor = !!(armor && armor.type === 'armor');
      
      // Only take damage if wearing armor in deep bog
      shouldApplyDamage = isWearingArmor;
    }
    
    // Start damage timer if not already running
    if (shouldApplyDamage && !this.damageTimer) {
      console.log(`Starting damage timer: ${terrain.damagePerSecond} HP/sec`);
      
      // Apply damage every second
      this.damageTimer = this.scene.time.addEvent({
        delay: 1000,
        callback: () => {
          if (this.player.isAlive()) {
            this.player.takeDamage(terrain.damagePerSecond, terrain.name);
          }
        },
        loop: true
      });
    } else if (!shouldApplyDamage && this.damageTimer) {
      // Stop damage if conditions no longer met (e.g., removed armor)
      this.damageTimer.remove();
      this.damageTimer = null;
      console.log('Stopped damage timer - conditions no longer met');
    }
  }
  
  /**
   * Smoothly update sprite sinking effect with mask cropping
   */
  updateSpriteOffset() {
    if (!this.player.sprite || !this.maskGraphics) return;
    
    // Smoothly interpolate current sink depth to target
    if (Math.abs(this.currentSinkDepth - this.targetSinkDepth) > 0.5) {
      this.currentSinkDepth = Phaser.Math.Linear(
        this.currentSinkDepth, 
        this.targetSinkDepth, 
        0.15 // Smooth transition speed
      );
    }
    
    // Store the sink offset on the player so their movement system can use it
    this.player.terrainSinkOffset = this.currentSinkDepth;
    
    // Update mask position to follow player horizontally
    this.updateMask(this.currentSinkDepth);
  }
  
  /**
   * Force reset terrain (useful when changing scenes)
   */
  reset() {
    if (this.damageTimer) {
      this.damageTimer.remove();
      this.damageTimer = null;
    }
    
    this.currentTerrain = null;
    this.previousTerrain = null;
    this.currentSinkDepth = 0;
    this.targetSinkDepth = 0;
    
    // Reset mask to show full sprite
    if (this.maskGraphics) {
      this.updateMask(0);
    }
    
    // Reset sprite origin
    if (this.player.sprite) {
      this.player.sprite.setOrigin(0.5, 0.5);
    }
    if (this.player.bowOverlay) {
      this.player.bowOverlay.setOrigin(0.5, 0.5);
    }
    
    // Reset warning flags
    this.shoreWarningShown = false;
    this.deepBogArmorWarningShown = false;
    this.deepBogNoArmorShown = false;
  }
  
  /**
   * Clean up
   */
  destroy() {
    if (this.maskGraphics) {
      this.maskGraphics.destroy();
      this.maskGraphics = null;
    }
    this.reset();
  }
}

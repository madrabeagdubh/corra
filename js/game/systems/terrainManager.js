// js/game/systems/terrainManager.js
import FovSystem from './fovSystem.js'

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
      

      
      forest: {
        ids: [260,261,262,314,315,316,368,369,370, 263,264,265,317,318,319,371,372,373, 266,267,268,320,321,322,374,375,376],
        name: 'Forest',
        speedModifier: 0.8,
        spriteOffsetY: 0,
        damagePerSecond: 0,
        walkable: true,
        onEnter: (player) => {
          const scene = player.scene
          if (!scene) return
          scene.fovSystem._radius = 3
          if (scene.fogRenderer) scene.fogRenderer._canvas.style.display = 'block'
          console.log('[terrain] entered forest — fog on')
        },
        onExit: (player) => {
          const scene = player.scene
          if (!scene) return
          scene.fovSystem._radius = 6 // FovSystem.FOV_RADIUS default
          if (scene.fogRenderer) scene.fogRenderer._canvas.style.display = 'none'
          console.log('[terrain] left forest — fog off')
        },
      },

      bogShore: {
        ids: [1472,1473,1474,1526,1528,1580,1581,1582,
              1635,1636,1689,1690,1742,1743,1796,1797,1852,1906,1958,1959,1960,
              731], // waterside/shore tiles
        name: 'Bog Shore',
        speedModifier: 0.6,
        spriteOffsetY: -16,
        damagePerSecond: 0,
        walkable: true,
        onEnter: (player) => {
          console.log('[terrain] entered shore')
        },
      },

      water: {
        ids: [1625, 1679, 1634, 1688],
        name: 'Water',
        speedModifier: 0.3,
        spriteOffsetY: -24,
        damagePerSecond: 0,
        walkable: true,
        requiresCheck: true,
        damagePerSecond: 1,
        onEnter: (player) => {
          console.log('[terrain] entered water')
          if (player.inBoat) return
          const tm = player.scene.terrainManager
          tm._updateWaterSink(player)
          // Also set currentSinkDepth immediately -- don't wait for lerp
          const armor    = player.inventory?.getItem(2)
          const hasArmor = !!(armor && armor.type === 'armor')
          tm.currentSinkDepth = hasArmor ? 96 : 35
          tm._waterSinkInterval = setInterval(() => tm._updateWaterSink(player), 500)
        },
        onExit: (player) => {
          console.log('[terrain] left water')
          const tm = player.scene.terrainManager
          clearInterval(tm._waterSinkInterval)
          tm._stopBubbles()
        },
      },

      deepBog: {
        ids: [], // disabled until water/bog tiles properly defined
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
    // Use start of current step for terrain -- avoids mid-step tile boundary flicker
    const baseX = this.player.isMoving ? this.player.startX : this.player.logicalX
    const baseY = this.player.isMoving ? this.player.startY : this.player.logicalY


    
    const tileX = Math.floor(baseX / this.scene.tileSize);
    const tileY = Math.floor(baseY / this.scene.tileSize);
    
    const mapData = this.scene.mapData
    if (!mapData || !mapData.layers) return
    const layer0 = mapData.layers[0]
    const layer1 = mapData.layers[1]
    if (!layer0 || tileY < 0 || tileY >= layer0.length) return
    if (tileX < 0 || tileX >= layer0[0].length) return
    const forestIds = new Set([260,261,262,314,315,316,368,369,370,263,264,265,317,318,319,371,372,373,266,267,268,320,321,322,374,375,376])
    let nearForest = false
    for (let dy = -1; dy <= 1 && !nearForest; dy++) {
      for (let dx = -1; dx <= 1 && !nearForest; dx++) {
        if (forestIds.has(layer1?.[tileY+dy]?.[tileX+dx] ?? 0)) nearForest = true
      }
    }
    // For shore/water detection, layer0 takes priority over layer1
    const waterShoreIds = new Set([1625,1679,1634,1688,
      1472,1473,1474,1526,1528,1580,1581,1582,
      1635,1636,1689,1690,1742,1743,1796,1797,1852,1906,1958,1959,1960,731])
    const l0 = layer0[tileY][tileX]
    const l1 = layer1?.[tileY]?.[tileX] ?? 0
    const shoreIds = new Set([1472,1473,1474,1526,1528,1580,1581,1582,
      1635,1636,1689,1690,1742,1743,1796,1797,1852,1906,1958,1959,1960,731])
    // Shore takes priority over deep water beneath it
    const tileType = nearForest ? 315 : (shoreIds.has(l0) ? l0 : (waterShoreIds.has(l0) ? l0 : (l1 || l0)))
    
    // Find matching terrain definition
    if (this._lastDbgTile !== tileType) { this._lastDbgTile = tileType; console.log('[terrain] tileType:', tileType) }
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
    // Speed modifier: boat system manages its own speed, don't override
    if (!this.player?.inBoat) {
      this.player.setTerrainSpeedModifier(terrain.speedModifier)
    }
    // Sink depth always updates -- PGR ignores it when inBoat
    if (terrain.name !== 'Water') {
      this.targetSinkDepth = Math.abs(terrain.spriteOffsetY)
    }
    console.log(`Applied terrain effects: speed=${terrain.speedModifier}x, sink=${this.targetSinkDepth}px`)
  }
  
  /**
   * Apply continuous effects like damage over time
   */

applyContinuousEffects(terrain) {
  if (this.player?.inBoat) return
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
                if (!this.scene?.sys?.isActive()) return
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
  _updateWaterSink(player) {
    const armor    = player.inventory?.getItem(2)
    const hasArmor = !!(armor && armor.type === 'armor')
    this.targetSinkDepth = hasArmor ? 96 : 35
    console.log('[water] hasArmor:', hasArmor, 'sink:', this.targetSinkDepth)
    if (hasArmor) this._startBubbles()
    else this._stopBubbles()
  }

  _startBubbles() {
    if (this._bubbleInterval) return
    const scene = this.scene
    const pgr   = scene.perspectiveGround
    this._bubbleInterval = setInterval(() => {
      if (!pgr || !this.player) return
      const p    = this.player
      const proj = pgr._projectLogical(p.logicalX, p.logicalY)
      if (!proj) return
      // Spawn 2-4 bubble DOM elements at player position
      const count = 2 + Math.floor(Math.random() * 3)
      for (let i = 0; i < count; i++) {
        const el = document.createElement('div')
        const size = 3 + Math.random() * 4
        const ox   = (Math.random() - 0.5) * 20
        el.style.cssText = [
          'position:fixed',
          `left:${proj.screenX + ox - size/2}px`,
          `top:${proj.screenY - size}px`,
          `width:${size}px`,
          `height:${size}px`,
          'border-radius:50%',
          'border:1px solid rgba(150,210,255,0.8)',
          'background:rgba(180,230,255,0.3)',
          'pointer-events:none',
          'z-index:11',
          'transition:transform 0.8s ease-out, opacity 0.8s ease-out',
        ].join(';')
        document.body.appendChild(el)
        // Animate upward
        setTimeout(() => {
          el.style.transform = `translateY(-${20 + Math.random() * 20}px)`
          el.style.opacity = '0'
        }, 20)
        setTimeout(() => el.remove(), 900)
      }
    }, 300)
  }

  _stopBubbles() {
    if (this._bubbleInterval) {
      clearInterval(this._bubbleInterval)
      this._bubbleInterval = null
    }
  }

  destroy() {
    if (this.maskGraphics) {
      this.maskGraphics.destroy();
      this.maskGraphics = null;
    }
    this.reset();
  }
}

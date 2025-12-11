import Phaser from 'phaser';
import BaseLocationScene from './baseLocationScene.js';
import { GameSettings } from '../../settings/gameSettings.js';

export default class BogMeadow extends BaseLocationScene {
  constructor() {
    super({ key: 'BogMeadow' });
  }

  preload() {
    super.preload();
    console.log('BogMeadow: preload starting');
    this.load.json('bogMeadowMap', '/maps/bogMap10.json?v=' + Date.now());

    // Load the spritesheet
    this.load.spritesheet('bogTiles', '/assets/13.png', {
      frameWidth: 32,  // adjust to your actual tile size
      frameHeight: 32
    });

    this.load.on('complete', () => {
      console.log('BogMeadow: assets loaded');
    });

    this.load.on('loaderror', (file) => {
      console.error('BogMeadow: load error', file.src);
    });
  }

  create() {
    console.log('BogMeadow: create starting');

    // Load map data
    this.mapData = this.cache.json.get('bogMeadowMap');

    if (!this.mapData) {
      console.error('BogMeadow: Map data not found!');
      return;
    }

    // Set dimensions
    this.tileSize = this.mapData.tileSize;
    this.mapWidth = this.mapData.width * this.tileSize;
    this.mapHeight = this.mapData.height * this.tileSize;

    console.log('BogMeadow: map size', this.mapWidth, 'x', this.mapHeight);

    // Draw the tilemap
    this.drawTilemap();

    // Setup dynamic lighting
    this.setupLighting();

    // DEBUG: Check what's in the cache
    console.log('=== CACHE DEBUG ===');
    console.log('Cache has championAtlas?', this.cache.json.has('championAtlas'));
    console.log('Cache has championSheet?', this.textures.exists('championSheet'));
    console.log('All JSON keys:', this.cache.json.getKeys());
    console.log('All texture keys:', this.textures.getTextureKeys());
    console.log('===================');

    // Initialize common location features (player, joystick, NPCs, objects)
    this.initializeLocation();

    // DEBUG: Check player sprite
    console.log('Player sprite exists?', !!this.player.sprite);
    console.log('Player sprite position:', this.player.sprite.x, this.player.sprite.y);
    console.log('Player sprite texture:', this.player.sprite.texture.key);
    console.log('Player sprite depth:', this.player.sprite.depth);
    console.log('Player sprite visible?', this.player.sprite.visible);

    // Add settings slider (temporary UI)
    this.addSettingsSlider();

    console.log('BogMeadow: scene created successfully');
  }

  drawTilemap() {
    const tiles = this.mapData.tiles;
    const tileSize = this.tileSize;

    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[y].length; x++) {
        const tileType = tiles[y][x];
        const pixelX = x * tileSize;
        const pixelY = y * tileSize;

        // Use sprite from spritesheet instead of colored rectangle
        // tileType is the frame index in your spritesheet
        this.add.image(pixelX, pixelY, 'bogTiles', tileType)
          .setOrigin(0, 0)  // align to top-left
          .setDisplaySize(tileSize, tileSize)
          .setPipeline('Light2D');  // Make tiles respond to lighting
      }
    }
  }

 setupLighting() {
  // Enable lighting pipeline
  this.lights.enable();
  
  // Set a much brighter ambient light for daytime bog
  // Higher values = brighter (0xaaaaaa is pretty bright)
  this.lights.setAmbientColor(0x999999);
  
  // Softer player light - just a subtle glow
  this.playerLight = this.lights.addLight(0, 0, 120)
    .setIntensity(0.8);
  
  // Very subtle will-o'-the-wisp lights
  this.lights.addLight(400, 300, 100, 0x99ff99, 0.5); // Soft green
  this.lights.addLight(800, 600, 100, 0x99ff99, 0.5);
  this.lights.addLight(1200, 400, 100, 0x99ff99, 0.5);

  console.log('BogMeadow: lighting setup complete');
} 





  update() {
    // Call parent update for player movement, collision, etc.
    super.update();
    
    // Update player light position to follow player
    if (this.playerLight && this.player && this.player.sprite) {
      this.playerLight.setPosition(this.player.sprite.x, this.player.sprite.y);
    }
  }

  addSettingsSlider() {
    const sliderWidth = 200;
    const sliderHeight = 8;
    const sliderX = this.scale.width / 2 - sliderWidth / 2;
    const sliderY = 20;

    // Create background track (dark part)
    const trackBg = this.add.rectangle(
      sliderX + sliderWidth / 2,
      sliderY,
      sliderWidth,
      sliderHeight,
      0x444444
    ).setScrollFactor(0).setDepth(1500);

    // Create golden fill (updates based on opacity)
    const trackFill = this.add.rectangle(
      sliderX,
      sliderY,
      sliderWidth * GameSettings.englishOpacity,
      sliderHeight,
      0xd4af37
    ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(1501);

    // Create draggable thumb
    const thumb = this.add.circle(
      sliderX + (sliderWidth * GameSettings.englishOpacity),
      sliderY,
      15,
      0xffd700
    ).setScrollFactor(0).setDepth(1502).setInteractive();

    this.input.setDraggable(thumb);

    this.input.on('drag', (pointer, gameObject, dragX) => {
      if (gameObject === thumb) {
        const clampedX = Phaser.Math.Clamp(dragX, sliderX, sliderX + sliderWidth);
        thumb.x = clampedX;

        const opacity = (clampedX - sliderX) / sliderWidth;
        GameSettings.setEnglishOpacity(opacity);

        // Update golden fill width
        trackFill.width = sliderWidth * opacity;

        // Update any visible English text in real-time
        if (this.textPanel) {
          this.textPanel.updateEnglishOpacity();
        }
      }
    });
  }
}

import Phaser from 'phaser';
import BaseLocationScene from './baseLocationScene.js';
import { GameSettings } from '../../settings/gameSettings.js';
import BowMechanics from '../../combat/bowMechanics.js';
import WorldButton from '../../ui/worldButton.js';
import WorldMenu from '../../ui/worldMenu.js';

export default class BogMeadow extends BaseLocationScene {
  constructor() {
    super({ key: 'BogMeadow' });
  }

  preload() {
    super.preload();
    console.log('BogMeadow: preload starting');
    
    this.load.json('bogMeadowMap', '/maps/bogMap10.json?v=' + Date.now());
    this.load.spritesheet('bogTiles', '/assets/13.png', {
      frameWidth: 32,
      frameHeight: 32
    });

    this.load.on('complete', () => {
      console.log('BogMeadow: assets loaded');
    });

    this.load.on('loaderror', (file) => {
      console.error('BogMeadow: load error', file.src);
    });
  }

init(data) {
        console.log('[BogMeadow] *** INIT CALLED ***');
        console.trace();
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

    // --- LIGHTING ---
    this.lights.enable();
    this.lights.setAmbientColor(0x999999); // Bright daytime ambient

    // Draw the tilemap
    this.drawTilemap();

    // --- COMMON LOCATION SETUP ---
    this.initializeLocation();

    // Player light - using Light2D for soft realistic lighting
    this.playerLight = this.lights.addLight(
      this.player.sprite.x,
      this.player.sprite.y,
      170  // radius
    );
    this.playerLight.setIntensity(0.8);
    this.playerLight.setColor(0xfff2cc);

    // Optional: Subtle will-o'-the-wisp lights
    this.lights.addLight(400, 300, 100, 0x99ff99, 0.5);
    this.lights.addLight(800, 600, 100, 0x99ff99, 0.5);
    this.lights.addLight(1200, 400, 100, 0x99ff99, 0.5);

    // --- BOW MECHANICS ---
    this.bowMechanics = new BowMechanics(this, this.player);

    // --- WORLD MENU ---
    this.worldMenu = new WorldMenu(this, { player: this.player });

    
this.worldButton = new WorldButton(this, {
    x: this.scale.width - 50,
    y: 100, // Moved down to avoid slider
    size: 56,
    onClick: () => {
        // Just call the smart toggle
        this.worldMenu.toggle();
    }
});



    // --- SETTINGS SLIDER (on top) ---
    this.addSettingsSlider();

    // --- INTRO NARRATIVE ---
    this.showIntroNarrative();

    console.log('BogMeadow: scene created successfully');
  }

  drawTilemap() {
    if (!this.mapData?.tiles) return;

    for (let y = 0; y < this.mapData.tiles.length; y++) {
      for (let x = 0; x < this.mapData.tiles[y].length; x++) {
        const tileIndex = this.mapData.tiles[y][x];
        if (!tileIndex || tileIndex <= 0) continue;

        const tile = this.add.sprite(
          x * this.tileSize + this.tileSize / 2,
          y * this.tileSize + this.tileSize / 2,
          'bogTiles',
          tileIndex - 1
        );

        tile.setOrigin(0.5);
        tile.setDepth(0);
        tile.setPipeline('Light2D');
      }
    }

    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight);
  }

  showIntroNarrative() {
    const champion = this.registry.get('selectedChampion');
    const narrativeKey = `bog_intro_seen_${champion.id}`;

    if (localStorage.getItem(narrativeKey)) {
      console.log('BogMeadow: intro already seen');
      return;
    }

    const narrative = this.mapData.introNarrative;
    if (!narrative || narrative.length === 0) return;

    this.narrativeInProgress = true;
    this.narrativeQueue = [...narrative];

    const showNext = () => {
      if (this.narrativeQueue.length === 0) {
        localStorage.setItem(narrativeKey, 'true');
        this.narrativeInProgress = false;
        console.log('BogMeadow: intro narrative complete');
        return;
      }

      const entry = this.narrativeQueue.shift();
      console.log('Showing narrative entry, remaining:', this.narrativeQueue.length);

      this.textPanel.show({
        irish: entry.irish,
        english: entry.english,
        type: 'dialogue',
        onDismiss: () => {
          this.time.delayedCall(300, showNext);
        }
      });
    };

    showNext();
  }

  update(time, delta) {
    super.update(time, delta);

    // Bow mechanics
    if (this.bowMechanics) {
      this.bowMechanics.update(delta);
    }

    // Update player light position
    if (this.playerLight && this.player?.sprite) {
      this.playerLight.setPosition(
        this.player.sprite.x,
        this.player.sprite.y
      );
    }
  }

// In your BogMeadow.js (or wherever you have addSettingsSlider)

addSettingsSlider() {
  const padding = 40;
  const sliderWidth = this.scale.width - (padding * 2);
  const sliderHeight = 8;
  const sliderX = padding;
  const sliderY = 20;

  const trackBg = this.add.rectangle(
    sliderX + sliderWidth / 2,
    sliderY,
    sliderWidth,
    sliderHeight,
    0x444444
  ).setScrollFactor(0).setDepth(5000); // Updated depth

  const trackFill = this.add.rectangle(
    sliderX,
    sliderY,
    sliderWidth * GameSettings.englishOpacity,
    sliderHeight,
    0xd4af37
  ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(5001); // Updated depth

  const thumb = this.add.circle(
    sliderX + sliderWidth * GameSettings.englishOpacity,
    sliderY,
    15,
    0xffd700
  ).setScrollFactor(0).setDepth(5002).setInteractive(); // Updated depth

  this.input.setDraggable(thumb);

  this.input.on('drag', (pointer, gameObject, dragX) => {
    if (gameObject !== thumb) return;

    const clampedX = Phaser.Math.Clamp(
      dragX,
      sliderX,
      sliderX + sliderWidth
    );

    thumb.x = clampedX;

    const opacity = (clampedX - sliderX) / sliderWidth;
    GameSettings.setEnglishOpacity(opacity);

    trackFill.width = sliderWidth * opacity;

    // Update text panel
    if (this.textPanel) {
      this.textPanel.updateEnglishOpacity();
    }

    // NEW: Update item detail panel in worldMenu
    if (this.worldMenu && this.worldMenu.itemDetailPanel) {
      this.worldMenu.itemDetailPanel.updateLanguageOpacity();
    }
  });
}




  shutdown() {
    if (this.bowMechanics) {
      this.bowMechanics.destroy();
      this.bowMechanics = null;
    }

    super.shutdown();
  }
}

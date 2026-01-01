import Phaser from 'phaser';
import BaseLocationScene from './baseLocationScene.js';
import { GameSettings } from '../../settings/gameSettings.js';
import BowMechanics from '../../combat/bowMechanics.js';

export default class BogMeadow extends BaseLocationScene {
  constructor() {
    super({ key: 'BogMeadow' });
  }

  preload() {
    super.preload();

    this.load.json('bogMeadowMap', '/maps/bogMap10.json?v=' + Date.now());

    this.load.spritesheet('bogTiles', '/assets/13.png', {
      frameWidth: 32,
      frameHeight: 32
    });
  }

  create() {
    console.log('BogMeadow: create');

    this.mapData = this.cache.json.get('bogMeadowMap');
    if (!this.mapData) return;

    this.tileSize = this.mapData.tileSize;
    this.mapWidth = this.mapData.width * this.tileSize;
    this.mapHeight = this.mapData.height * this.tileSize;

    // --- ENABLE LIGHTING ---
    this.lights.enable();

    // Daytime bog ambience: slightly muted, not dark
    this.lights.setAmbientColor(0xb0b8a8);
    // (Think grey-green overcast daylight)

    this.drawTilemap();

    this.initializeLocation();

    // --- PLAYER LIGHT (subtle presence, not a torch) ---
    this.playerLight = this.lights.addLight(
      this.player.sprite.x,
      this.player.sprite.y,
      180
    );

    this.playerLight
      .setIntensity(0.6)
      .setColor(0xffddaa);

    // Bow mechanics
    this.bowMechanics = new BowMechanics(this, this.player);

    this.addSettingsSlider();

    if (this.mapData.introNarrative?.length) {
      this.time.delayedCall(500, () => {
        this.showNarrative(this.mapData.introNarrative);
      });
    }
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

        // ⭐ REQUIRED FOR LIGHTING ⭐
        tile.setPipeline('Light2D');
      }
    }

    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight);
  }

  update() {
    super.update();

    if (this.bowMechanics) {
      this.bowMechanics.update(this.game.loop.delta);
    }

    // Follow player with light
    if (this.playerLight && this.player?.sprite) {
      this.playerLight.x = this.player.sprite.x;
      this.playerLight.y = this.player.sprite.y;
    }
  }

  showNarrative(entries) {
    this.narrativeQueue = [...entries];

    const showNext = () => {
      if (!this.narrativeQueue.length) return;

      const entry = this.narrativeQueue.shift();

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

  addSettingsSlider() {
    const sliderWidth = 200;
    const sliderHeight = 8;
    const sliderX = this.scale.width / 2 - sliderWidth / 2;
    const sliderY = 20;

    const trackBg = this.add.rectangle(
      sliderX + sliderWidth / 2,
      sliderY,
      sliderWidth,
      sliderHeight,
      0x444444
    ).setScrollFactor(0).setDepth(1500);

    const trackFill = this.add.rectangle(
      sliderX,
      sliderY,
      sliderWidth * GameSettings.englishOpacity,
      sliderHeight,
      0xd4af37
    ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(1501);

    const thumb = this.add.circle(
      sliderX + (sliderWidth * GameSettings.englishOpacity),
      sliderY,
      15,
      0xffd700
    ).setScrollFactor(0).setDepth(1502).setInteractive();

    this.input.setDraggable(thumb);

    this.input.on('drag', (pointer, gameObject, dragX) => {
      if (gameObject !== thumb) return;

      const clampedX = Phaser.Math.Clamp(dragX, sliderX, sliderX + sliderWidth);
      thumb.x = clampedX;

      const opacity = (clampedX - sliderX) / sliderWidth;
      GameSettings.setEnglishOpacity(opacity);

      trackFill.width = sliderWidth * opacity;

      if (this.textPanel) {
        this.textPanel.updateEnglishOpacity();
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

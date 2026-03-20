import Phaser from 'phaser';
import BaseLocationScene from '../baseLocationScene.js';
import { GameSettings } from '../../../settings/gameSettings.js';
import BowMechanics from '../../../combat/bowMechanics.js';
import WorldButton from '../../../ui/worldButton.js';
import WorldMenu from '../../../ui/worldMenu.js';

const TW = 24, TH = 24, MG = 24, SHEET_COLS = 54
const SCALE = 2

const WATER_GIDS = new Set([1634, 1688])
const TREE_GIDS  = new Set([209, 321, 266, 267, 268, 320, 322, 374, 375, 376])

export default class BogMeadow extends BaseLocationScene {
  constructor() {
    super({ key: 'BogMeadow' });
  }

  preload() {
    super.preload();
    console.log('BogMeadow: preload starting');
    this.load.json('bogMeadowMap', '/maps/bogMaps/bog_threshold.json?v=' + Date.now());
    this.load.image('oryxTiles', '/assets/oryx/oryx_16bit_fantasy_world_trans.png');
    this.load.on('complete', () => console.log('BogMeadow: assets loaded'));
    this.load.on('loaderror', (file) => console.error('BogMeadow: load error', file.src));
  }

  init(data) {
    console.log('[BogMeadow] init', data);
  }

  create() {
    console.log('BogMeadow: create starting');

    this.mapData = this.cache.json.get('bogMeadowMap');
    if (!this.mapData) {
      console.error('BogMeadow: Map data not found!');
      return;
    }

    // Enable lighting BEFORE tiles are created
    this.lights.enable()
    this.lights.setAmbientColor(0x888888)

    // drawTilemap sets this.tileSize, this.mapWidth, this.mapHeight
    this.drawTilemap();

    // Patch mapData so baseLocationScene helpers don't crash
    this.mapData.tiles = this.mapData.layers[0].map(row =>
      row.map(gid => gid === 2 ? 733 : gid)
    )
    if (!this.mapData.spawns) {
      this.mapData.spawns = {
        player: {
          x: Math.floor(this.mapData.width  / 2),
          y: Math.floor(this.mapData.height / 2),
        }
      }
    }
    if (!this.mapData.objects)        this.mapData.objects        = []
    if (!this.mapData.npcs)           this.mapData.npcs           = []
    if (!this.mapData.exits)          this.mapData.exits          = {}
    if (!this.mapData.unwalkableTiles) this.mapData.unwalkableTiles = []

    console.log('BogMeadow: map size', this.mapWidth, 'x', this.mapHeight);

    // --- COMMON LOCATION SETUP ---
    this.initializeLocation();

    // Player light
    this.playerLight = this.lights.addLight(
      this.player.sprite.x,
      this.player.sprite.y,
      300
    );
    this.playerLight.setIntensity(2.0);
    this.playerLight.setColor(0xfff2cc);

    // Will-o'-the-wisp lights
    const mw = this.mapWidth, mh = this.mapHeight
    this.lights.addLight(mw * 0.25, mh * 0.30, 180, 0x99ff99, 0.6);
    this.lights.addLight(mw * 0.60, mh * 0.50, 180, 0x99ff99, 0.6);
    this.lights.addLight(mw * 0.80, mh * 0.75, 180, 0x99ff99, 0.6);

    // --- BOW MECHANICS ---
    this.bowMechanics = new BowMechanics(this, this.player);

    // --- WORLD MENU ---
    this.worldMenu = new WorldMenu(this, { player: this.player });

    this.worldButton = new WorldButton(this, {
      x: this.scale.width - 50,
      y: 100,
      size: 56,
      onClick: () => this.worldMenu.toggle()
    });

    this.addSettingsSlider();
    this.showIntroNarrative();

    console.log('BogMeadow: scene created successfully');
  }

  drawTilemap() {
    if (!this.mapData?.layers) {
      console.error('BogMeadow: no layers in map data')
      return
    }

    this.tileSize  = TW * SCALE
    this.mapWidth  = this.mapData.width  * TW * SCALE
    this.mapHeight = this.mapData.height * TH * SCALE
    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight)

    const tex = this.textures.get('oryxTiles')

    const ensureFrame = (gid) => {
      const key = `oryx_${gid}`
      if (tex.has(key)) return key
      const idx = gid - 1
      const col = idx % SHEET_COLS
      const row = Math.floor(idx / SHEET_COLS)
      tex.add(key, 0, MG + col * TW, MG + row * TH, TW, TH)
      return key
    }

    for (let li = 0; li < this.mapData.layers.length; li++) {
      const layer = this.mapData.layers[li]
      for (let y = 0; y < layer.length; y++) {
        const row = layer[y]
        for (let x = 0; x < row.length; x++) {
          const gid = row[x]
          if (!gid) continue
          this.add.image(
            x * TW * SCALE + (TW * SCALE) / 2,
            y * TH * SCALE + (TH * SCALE) / 2,
            'oryxTiles',
            ensureFrame(gid)
          )
            .setScale(SCALE)
            .setDepth(li)
            .setPipeline('Light2D')
        }
      }
    }
  }

  isColliding(x, y) {
    const tx = Math.floor(x / this.tileSize)
    const ty = Math.floor(y / this.tileSize)
    const layers = this.mapData.layers
    if (!layers) return false
    if (ty < 0 || ty >= this.mapData.height ||
        tx < 0 || tx >= this.mapData.width) return true
    if (WATER_GIDS.has(layers[3]?.[ty]?.[tx])) return true
    if (TREE_GIDS.has(layers[5]?.[ty]?.[tx])) return true
    return false
  }

  checkExits() { return }

  showIntroNarrative() {
    const champion = this.registry.get('selectedChampion') || window.selectedChampion;
    if (!champion) return
    const narrativeKey = `bog_intro_seen_${champion.id}`;
    if (localStorage.getItem(narrativeKey)) return;
    const narrative = this.mapData.introNarrative;
    if (!narrative || narrative.length === 0) return;
    this.narrativeInProgress = true;
    this.narrativeQueue = [...narrative];
    const showNext = () => {
      if (this.narrativeQueue.length === 0) {
        localStorage.setItem(narrativeKey, 'true');
        this.narrativeInProgress = false;
        return;
      }
      const entry = this.narrativeQueue.shift();
      this.textPanel.show({
        irish: entry.irish,
        english: entry.english,
        type: 'dialogue',
        onDismiss: () => this.time.delayedCall(300, showNext)
      });
    };
    showNext();
  }

  update(time, delta) {
    super.update(time, delta);
    if (this.bowMechanics) this.bowMechanics.update(delta);
    if (this.playerLight && this.player?.sprite) {
      this.playerLight.setPosition(
        this.player.sprite.x,
        this.player.sprite.y
      );
    }
  }

  addSettingsSlider() {
    const padding = 40;
    const sliderWidth = this.scale.width - padding * 2;
    const sliderX = padding, sliderY = 20;

    this.add.rectangle(
      sliderX + sliderWidth / 2, sliderY, sliderWidth, 8, 0x444444
    ).setScrollFactor(0).setDepth(5000);

    const trackFill = this.add.rectangle(
      sliderX, sliderY,
      sliderWidth * GameSettings.englishOpacity, 8, 0xd4af37
    ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(5001);

    const thumb = this.add.circle(
      sliderX + sliderWidth * GameSettings.englishOpacity,
      sliderY, 15, 0xffd700
    ).setScrollFactor(0).setDepth(5002).setInteractive();

    this.input.setDraggable(thumb);
    this.input.on('drag', (pointer, gameObject, dragX) => {
      if (gameObject !== thumb) return;
      const cx = Phaser.Math.Clamp(dragX, sliderX, sliderX + sliderWidth);
      thumb.x = cx;
      const opacity = (cx - sliderX) / sliderWidth;
      GameSettings.setEnglishOpacity(opacity);
      trackFill.width = sliderWidth * opacity;
      if (this.textPanel) this.textPanel.updateEnglishOpacity();
      if (this.worldMenu?.itemDetailPanel)
        this.worldMenu.itemDetailPanel.updateLanguageOpacity();
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


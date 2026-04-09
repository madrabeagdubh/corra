import Phaser from 'phaser'
import BaseLocationScene from '../baseLocationScene.js'
import { GameSettings } from '../../../settings/gameSettings.js'
import WorldMenu from '../../../ui/worldMenu.js'
import BowMechanics from '../../../combat/bowMechanics.js'
import { GameState } from '../../../systems/gameState.js'
import PerspectiveGroundRenderer from '../../../effects/perspectiveGroundRenderer.js'
import FovSystem       from '../../../systems/fovSystem.js'
import ItemSheetHelper from '../../../ui/inventory/itemSheetHelper.js'
import PathFinder from '../../../systems/pathFinder.js'
import FogRenderer from '../../../systems/fogRenderer.js'
import { createMoonWidget }  from '../../../ui/moonWidget.js'
import { createGameMenuHub } from '../../../ui/gameMenuHub.js'

// Expose globally so baseLocationScene can access without circular imports
window.GameState = GameState

const TW = 24, TH = 24, MG = 24, SHEET_COLS = 54
const SCALE = 2

const ALWAYS_UNWALKABLE = new Set([
  1634, 1688,           // water
  740,                  // cliff edge
  228, 231, 233, 234,   // bog walls
  235, 236, 226, 229,   // bog walls
  230, 232, 242, 243,   // bog walls
  217, 218, 219,        // bog blocks
  120, 121, 122, 123,   // clay walls
  124, 125, 126, 127,   // clay walls
  128, 129, 130, 131,   // clay walls
  132, 133, 134, 135,   // clay walls
])

export default class BogLocationScene extends BaseLocationScene {

  // -- Override in child scenes --------------------------------------

  getMapKey()              { return 'great_open_bog' }
  getAmbient()             { return 0x334422 }
  getPlayerLight()         { return { color: 0xfff2cc, intensity: 2.0, radius: 300 } }
  getWisps()               { return [] }
  getMusicTrack()          { return null }
  getExtraUnwalkableGIDs() { return new Set() }
  onEnter()                {}

  // -- Lifecycle -----------------------------------------------------

  init(data) {
    this.entryData = data || {}
    console.log(`[${this.scene.key}] init -- entryEdge: ${data?.entryEdge}`)
  }

  preload() {
    this.load.image('championSheet_armored',   'assets/champions/champions-with-kit.png')
    this.load.image('championSheet_unarmored', 'assets/champions/champions-no-kit.png')
    this.load.json('championAtlas', 'assets/champions/champions0.json')
    this.load.image('slot_equipped',      '/assets/inventory/slot_equipped.png')
    this.load.image('slot_inventory',     '/assets/inventory/slot_inventory.png')
    this.load.image('panel_stone',        '/assets/inventory/panel_stone.png')
    this.load.image('item_leather_armor', 'assets/inventory/A_Armour02.png')
    this.load.image('item_simple_bow',    'assets/inventory/W_Bow02.png')
    this.load.image('item_healing_potion','assets/inventory/P_Blue04.png')
    this.load.image('item_arrows',        'assets/inventory/W_Bow17.png')
    this.load.image('glowCursor',         'assets/glowCursor.png')
    this.load.audio('creak1',           'assets/sounds/creak1.wav')
    this.load.audio('arrowShoot1',      'assets/sounds/arrowShoot1.wav')
    this.load.audio('arrowShoot2',      'assets/sounds/arrowShoot2.wav')
    this.load.audio('arrowShoot3',      'assets/sounds/arrowShoot3.wav')
    this.load.audio('pumpkin_break_01', 'assets/sounds/pumpkin_break_01.ogg')
    this.load.audio('parrySound',       'assets/sounds/parry.mp3')
    const key = this.getMapKey()
    this.bogMapCacheKey = 'bogMap_' + key
    this.load.json(this.bogMapCacheKey, `/maps/bogMaps/${key}.json?v=` + Date.now())
    this.load.image('oryxTiles',   '/assets/oryx/oryx_16bit_fantasy_world_trans.png')
    this.load.image('fogTexture', '/assets/bg0.png')
    this.load.json('oryxCatalogue', '/assets/oryx/oryxCatalogue.json')
    this.load.image('oryxItems', '/assets/oryx/oryx_16bit_fantasy_items_trans.png')
  }

  async _loadContent() {
    const jsKey = this.getContentKey()
    try {
      const module  = await import(`../../../../../data/bog/${jsKey}.js`)
      const content = module[jsKey + 'Content'] || {}
      this.mapData.objects        = content.objects        || []
      this.mapData.npcs           = content.npcs           || []
      this.mapData.introNarrative = content.introNarrative || []
      console.log(`[${this.scene.key}] content loaded -- ${this.mapData.objects.length} objects, ${this.mapData.npcs.length} npcs`)
    } catch(e) {
      console.warn(`[${this.scene.key}] content file not found for ${jsKey}:`, e.message)
      this.mapData.objects        = []
      this.mapData.npcs           = []
      this.mapData.introNarrative = []
    }
  }

  getContentKey() {
    return this.getMapKey().replace(/_([a-z])/g, (_, c) => c.toUpperCase())
  }

  async create() {
    const key = this.getMapKey()
    this.mapData = this.cache.json.get(this.bogMapCacheKey)
    if (!this.mapData) {
      console.error(`[${this.scene.key}] Map not found at /maps/bogMaps/${key}.json`)
      return
    }

    await this._loadContent()

    this.lights.enable()
    this.lights.setAmbientColor(this.getAmbient())

    this.usePerspective = true
    this.drawTilemap()

    this.mapData.tiles           = this.mapData.layers[0]
    this.mapData.unwalkableTiles = []

    if (!this.mapData.spawns) this.mapData.spawns = { player: { x: Math.floor(this.mapData.width / 2), y: Math.floor(this.mapData.height / 2) } }
    if (!this.mapData.exits)  this.mapData.exits  = {}

    this.initializeLocation()

    // Register player with PGR
    if (this.perspectiveGround) {
      this.perspectiveGround.setPlayer(this.player)
    }

    // Item sheet helper
    this.itemSheet = new ItemSheetHelper(this)

    // Snap camera before lerp starts
    this.cameras.main.centerOn(this.player.logicalX, this.player.logicalY)

    // -- FOV + Pathfinding + Fog ---------------------------------------------
    this.walkGrid   = this._buildWalkGrid()
    this.fovSystem  = new FovSystem(this.walkGrid)
    this.pathFinder = new PathFinder(this.walkGrid, this.fovSystem)

    if (this.perspectiveGround) {
      this.fogRenderer = new FogRenderer(this.perspectiveGround)
    }

    this._lastFovKey = null
    this._recomputeFov()

    this._setupTapToPath()

    // GameState
    const champion = this.registry.get('selectedChampion') || window.selectedChampion
    if (champion?.id) GameState.init(champion.id)
    GameState.setVisited(this.scene.key)

    this.applyEntryPosition()

    const pl = this.getPlayerLight()
    this.playerLight = this.lights.addLight(
      this.player.logicalX, this.player.logicalY,
      pl.radius || 300
    ).setIntensity(pl.intensity || 2.0).setColor(pl.color || 0xfff2cc)

    const mw = this.mapWidth, mh = this.mapHeight
    this.getWisps().forEach(w => {
      this.lights.addLight(mw * w.rx, mh * w.ry, w.radius || 180, w.color || 0x99ff99, w.intensity || 0.6)
    })

    const track = this.getMusicTrack()
    if (track && window.tradConductor) window.tradConductor.playTrack(track)

    this._createWorldUI()
    this.bowMechanics = new BowMechanics(this, this.player)
    this.showIntroNarrative()
    this.onEnter()

    console.log(`[${this.scene.key}] ready -- ${this.mapData.width}x${this.mapData.height}`)
  }

  // -- FOV + Pathfinding helpers ---------------------------------------------

  _buildWalkGrid() {
    const tiles = this.mapData.layers[0]
    const h     = tiles.length
    const w     = tiles[0].length
    const grid  = []
    for (let y = 0; y < h; y++) {
      grid[y] = []
      for (let x = 0; x < w; x++) {
        grid[y][x] = !this.isColliding(
          x * this.tileSize + this.tileSize / 2,
          y * this.tileSize + this.tileSize / 2
        )
      }
    }
    return grid
  }

  _recomputeFov() {
    if (!this.fovSystem || !this.player) return
    const tx = Math.floor(this.player.logicalX / this.tileSize)
    const ty = Math.floor(this.player.logicalY / this.tileSize)
    this.fovSystem.compute(tx, ty)
    if (this.fogRenderer) this.fogRenderer.update(this.fovSystem)
  }

  _setupTapToPath() {
    this.input.on('pointerdown', (pointer) => {
      // Ignore taps in joystick zone (bottom-left)
      if (pointer.x < 220 && pointer.y > this.scale.height - 220) return
      // Ignore taps in moon widget zone (bottom-right)
      // Zone size matches moon wrapper: ~11% of screen + margin + padding
      const _moonZone = Math.round(Math.min(this.scale.width, this.scale.height) * 0.16)
      if (pointer.x > this.scale.width - _moonZone && pointer.y > this.scale.height - _moonZone) return
      // Ignore if text panel open
      if (this.textPanel?.isVisible) return
      // Ignore if no PGR
      if (!this.perspectiveGround) return
      // Ignore if player is aiming bow
      if (this._bowAiming) return
      // Ignore if menu is open
      if (this._menuHub?.isOpen()) return

      const tile = PathFinder.screenToTile(
        pointer.x, pointer.y,
        this.perspectiveGround,
        this.tileSize
      )
      if (!tile) return

      const fromTX = Math.floor(this.player.logicalX / this.tileSize)
      const fromTY = Math.floor(this.player.logicalY / this.tileSize)

      const path = this.pathFinder.findPath(fromTX, fromTY, tile.tx, tile.ty)
      if (path.length > 0) {
        this.player.setPath(path)
      }
    })
  }

  // -- UI ------------------------------------------------------------

  // -- UI state machine -------------------------------------------------
  _onMoonTap() {
    const now = Date.now()
    if (now - (this._lastMoonTap || 0) < 700) return
    this._lastMoonTap = now

    // Detail panel open: close detail only, keep inventory open
    if (this.worldMenu?.itemDetailPanel?.isVisible) {
      this.worldMenu.itemDetailPanel.hide()
      return
    }

    // Inventory open (no detail): close inventory only
    if (this.worldMenu?.isOpen) {
      this._closeWorldMenuSilently()
      return
    }

    // Hub open: close hub
    if (this._menuHub?.isOpen()) {
      this._menuHub.close()
      return
    }

    // Nothing open: open hub (goes straight to last panel)
    this._menuHub?.open()
  }

  _createWorldUI() {
    // WorldMenu still exists for any legacy NPC/item interactions that use it
    this.worldMenu = new WorldMenu(this, { player: this.player })

    // -- Menu hub -- swipeable panels (inventory, quests, stats, map, settings)
    this._menuHub = createGameMenuHub({
      onInventoryOpen:  () => {
        this.time.delayedCall(50, () => this.worldMenu?.open())
      },
      onInventoryClose: () => {
        if (this.worldMenu?.isOpen) this._closeWorldMenuSilently()
      },
    })


    // -- Moon widget -- top-right corner, swipe for English opacity, tap to toggle menu
    this._moonWidget = createMoonWidget({
      initialPhase: GameSettings.englishOpacity,
      showSlider:   false,
      corner:       'top-right',
      onChange: (phase) => {
        GameSettings.setEnglishOpacity(phase)
        if (this.textPanel)  this.textPanel.updateEnglishOpacity()
        if (this.worldMenu?.itemDetailPanel)
          this.worldMenu.itemDetailPanel.updateLanguageOpacity()
      },
      onTap: () => this._onMoonTap(),
    })
  }

  // Close WorldMenu without any hub side-effect
  _closeWorldMenuSilently() {
    if (!this.worldMenu) return
    // Use the proper close() which handles all children including ButtonBar
    this.worldMenu.close()
  }

  // -- Collision -----------------------------------------------------

  isColliding(x, y) {
    const tx = Math.floor(x / this.tileSize)
    const ty = Math.floor(y / this.tileSize)
    if (ty < 0 || ty >= this.mapData.height || tx < 0 || tx >= this.mapData.width) return true
    const extra = this.getExtraUnwalkableGIDs()
    const g0 = this.mapData.layers[0]?.[ty]?.[tx]
    if (ALWAYS_UNWALKABLE.has(g0) || extra.has(g0)) return true
    const g1 = this.mapData.layers[1]?.[ty]?.[tx]
    if (g1 && (ALWAYS_UNWALKABLE.has(g1) || extra.has(g1))) return true
    return false
  }

  // -- Entry positioning ---------------------------------------------

  applyEntryPosition() {
    const edge = this.entryData?.entryEdge
    if (!edge || !this.mapData.entries) return

    const entry = this.mapData.entries[edge]
    if (!entry) return

    const sourceY = this.entryData.sourceTile?.y
    const sourceH = this.entryData.sourceHeight || this.mapData.height
    const destH   = this.mapData.height
    const destW   = this.mapData.width

    let entryY
    if (entry.yFromSource && sourceY != null) {
      const fraction = sourceY / sourceH
      entryY = Math.round(fraction * destH)
      entryY = Math.max(1, Math.min(destH - 2, entryY))
    } else {
      entryY = entry.y ?? Math.floor(destH / 2)
    }

    const entryX = Math.max(1, Math.min(destW - 2, entry.x ?? Math.floor(destW / 2)))
    const px     = entryX * this.tileSize + this.tileSize / 2
    const py     = entryY * this.tileSize + this.tileSize / 2

    if (this.player) {
      this.player.logicalX = px
      this.player.logicalY = py
      this.player.targetX  = px
      this.player.targetY  = py
      this.player.startX   = px
      this.player.startY   = py
      this.cameras.main.centerOn(px, py)
    }

    console.log(`[${this.scene.key}] entry via ${edge} -- tile [${entryX}, ${entryY}]`)
  }

  // -- Narrative -----------------------------------------------------

  showIntroNarrative() {
    const champion = this.registry.get('selectedChampion') || window.selectedChampion
    if (!champion) return
    const seenKey = `${this.scene.key}_intro_${champion.id}`
    if (localStorage.getItem(seenKey)) return
    const narrative = this.mapData.introNarrative
    if (!narrative?.length) return
    this.narrativeInProgress = true
    this.narrativeQueue = [...narrative]
    this._narrativeSafetyTimer = this.time.delayedCall(30000, () => {
      this.narrativeInProgress = false
      if (this.textPanel) {
        this.textPanel._cooldown   = false
        this.textPanel._cooldownId = null
      }
    })
    const showNext = () => {
      if (!this.narrativeQueue.length) {
        localStorage.setItem(seenKey, 'true')
        this.narrativeInProgress = false
        return
      }
      if (this.joystick) this.joystick.reset()
      if (this.player)   this.player.isMoving = false
      const entry = this.narrativeQueue.shift()
      this.textPanel.show({
        irish:   entry.ga    || entry.irish   || '',
        english: entry.en    || entry.english || '',
        type: 'dialogue',
        onDismiss: () => this.time.delayedCall(300, showNext)
      })
    }
    showNext()
  }

  // -- Object & NPC creation -----------------------------------------

  createObjects() {
    if (!this.mapData.objects) return
    this.interactables = []

    this.mapData.objects.forEach(obj => {
      const stateKey = obj.stateKey || `${this.getMapKey()}.${obj.id}`
      if (obj.type === 'collectable' && GameState.isCollected(stateKey)) return
      if (obj.requiresQuest && !GameState.isQuestActive(obj.requiresQuest) &&
          !GameState.isQuestComplete(obj.requiresQuest)) return

      const pixelX = obj.x * this.tileSize + this.tileSize / 2
      const pixelY = obj.y * this.tileSize + this.tileSize / 2

      const zone = this.add.zone(pixelX, pixelY, this.tileSize * 2, this.tileSize * 2)
      zone.setData('id',       obj.id)
      zone.setData('type',     obj.type)
      zone.setData('text',     obj.text)
      zone.setData('stateKey', stateKey)
      zone.setData('item',     obj.item || null)
      zone.setData('note',     obj.note || null)
      zone.setData('logicalX', pixelX)
      zone.setData('logicalY', pixelY)
      zone.x = pixelX
      zone.y = pixelY

      this.interactables.push(zone)
    })

    console.log(`[${this.scene.key}] ${this.interactables.length} objects loaded`)
  }

  createNPCs() {
    if (!this.mapData.npcs) return
    this.npcs = []

    this.mapData.npcs.forEach(npcData => {
      const stateKey = npcData.stateKey || `${this.getMapKey()}.${npcData.id}`
      if (npcData.requiresQuest && !GameState.isQuestActive(npcData.requiresQuest) &&
          !GameState.isQuestComplete(npcData.requiresQuest)) return

      const pixelX = npcData.x * this.tileSize + this.tileSize / 2
      const pixelY = npcData.y * this.tileSize + this.tileSize / 2
      const color  = npcData.visual?.color ? parseInt(npcData.visual.color) : 0x4169e1
      const radius = npcData.visual?.radius || 16

      const sprite = this.add.circle(pixelX, pixelY, radius, color)
      sprite.setData('id',            npcData.id)
      sprite.setData('name',          npcData.name)
      sprite.setData('dialogues',     npcData.dialogues)
      sprite.setData('stateKey',      stateKey)
      sprite.setData('dialogueIndex', GameState.getNPCProgress(stateKey))
      sprite.setData('isNPC',         true)
      sprite.setData('logicalX',      pixelX)
      sprite.setData('logicalY',      pixelY)
      sprite.setDepth(10)
      sprite.setInteractive()

      this.add.text(pixelX, pixelY - radius - 6, npcData.name, {
        fontSize: '12px', fontFamily: 'Arial',
        color: '#ffffff', backgroundColor: '#000000',
        padding: { x: 4, y: 2 }
      }).setOrigin(0.5, 1).setDepth(11)

      sprite.on('pointerdown', () => this.talkToNPC(sprite))
      this.npcs.push(sprite)
    })

    console.log(`[${this.scene.key}] ${this.npcs.length} NPCs loaded`)
  }

  // -- Update --------------------------------------------------------

  update(time, delta) {
    if (this.perspectiveGround) this.perspectiveGround.update()
    super.update(time, delta)

    if (this.fovSystem && this.player) {
      const tx  = Math.floor(this.player.logicalX / this.tileSize)
      const ty  = Math.floor(this.player.logicalY / this.tileSize)
      const key = `${tx},${ty}`
      if (key !== this._lastFovKey) {
        this._lastFovKey = key
        this._recomputeFov()
      }
    }
    if (this.fogRenderer && this.fovSystem) {
      this.fogRenderer.update(this.fovSystem)
    }

    if (this.playerLight && this.player)
      this.playerLight.setPosition(this.player.logicalX, this.player.logicalY)
    if (this.bowMechanics) this.bowMechanics.update(delta)
  }

  // -- Shutdown ------------------------------------------------------

  shutdown() {
    if (this._moonWidget) { this._moonWidget.destroy(); this._moonWidget = null }
    if (this._menuHub)    { this._menuHub.destroy();    this._menuHub    = null }
    if (this.perspectiveGround) {
      this.perspectiveGround.destroy()
      this.perspectiveGround = null
    }
    if (this.fogRenderer) {
      this.fogRenderer.destroy()
      this.fogRenderer = null
    }
    if (this.itemSheet)  { this.itemSheet.clear(); this.itemSheet = null }
    if (this.fovSystem)  { this.fovSystem  = null }
    if (this.pathFinder) { this.pathFinder = null }
    if (this.bowMechanics) { this.bowMechanics.destroy(); this.bowMechanics = null }
    this.lights.destroy()
    if (super.shutdown) super.shutdown()
  }

  // -- Tilemap -------------------------------------------------------

  drawTilemap() {
    if (!this.mapData?.layers) { console.error(`[${this.scene.key}] No layers`); return }

    this.tileSize  = TW * SCALE
    this.mapWidth  = this.mapData.width  * TW * SCALE
    this.mapHeight = this.mapData.height * TH * SCALE
    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight)

    const tex = this.textures.get('oryxTiles')
    const ensureFrame = (gid) => {
      const key = `oryx_${gid}`
      if (tex.has(key)) return key
      const idx = gid - 1
      tex.add(key, 0, MG + (idx % SHEET_COLS) * TW, MG + Math.floor(idx / SHEET_COLS) * TH, TW, TH)
      return key
    }

    for (let li = 0; li < this.mapData.layers.length; li++) {
      if (this.usePerspective && (li === 0 || li === 1)) continue

      if (li === 0) {
        const grassFrame = ensureFrame(732)
        for (let y = 0; y < this.mapData.height; y++) {
          for (let x = 0; x < this.mapData.width; x++) {
            const img = this.add.image(
              x * TW * SCALE + (TW * SCALE) / 2,
              y * TH * SCALE + (TH * SCALE) / 2,
              'oryxTiles', grassFrame
            ).setScale(SCALE).setDepth(-1)
            if (this.game.renderer.type === Phaser.WEBGL) img.setPipeline('Light2D')
          }
        }
      }

      const layer = this.mapData.layers[li]
      for (let y = 0; y < layer.length; y++) {
        for (let x = 0; x < layer[y].length; x++) {
          const gid = layer[y][x]
          if (!gid) continue
          const img = this.add.image(
            x * TW * SCALE + (TW * SCALE) / 2,
            y * TH * SCALE + (TH * SCALE) / 2,
            'oryxTiles', ensureFrame(gid)
          ).setScale(SCALE).setDepth(li)
          if (this.game.renderer.type === Phaser.WEBGL) img.setPipeline('Light2D')
        }
      }
    }

    if (this.usePerspective) {
      this.perspectiveGround = new PerspectiveGroundRenderer(this)
    }
  }
}


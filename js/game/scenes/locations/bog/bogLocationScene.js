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
import { EncounterDeck } from '../../../../../data/encounters/encounterDeck.js'
import { forestDeck }    from '../../../../../data/encounters/forestDeck.js'
import { EncounterPanel } from '../../../ui/encounterPanel.js'

window.GameState = GameState

const TW = 24, TH = 24, MG = 24, SHEET_COLS = 54
const SCALE = 2

const ALWAYS_UNWALKABLE = new Set([
  1634, 1688,
  740,
  228, 231, 233, 234,
  235, 236, 226, 229,
  230, 232, 242, 243,
  217, 218, 219,
  120, 121, 122, 123,
  124, 125, 126, 127,
  128, 129, 130, 131,
  132, 133, 134, 135,
])

export default class BogLocationScene extends BaseLocationScene {

  getMapKey()              { return 'great_open_bog' }
  getAmbient()             { return 0x334422 }
  getPlayerLight()         { return { color: 0xfff2cc, intensity: 2.0, radius: 300 } }
  getWisps()               { return [] }
  getMusicTrack()          { return null }
  getExtraUnwalkableGIDs() { return new Set() }
  onEnter()                {}

  init(data) {
    this.entryData = data || {}
    console.log(`[${this.scene.key}] init -- entryEdge: ${data?.entryEdge}`)
  }





getSkyImage() { return null }


  preload() {
   
this.load.image('encounterPanelBG', '/assets/panelBG.png');
	  this.load.image('darkStone',            'assets/darkStone.png')
    this.load.image('championSheet_armored',   'assets/champions/champions-with-kit.png')
    this.load.image('championSheet_unarmored', 'assets/champions/champions-no-kit.png')
    this.load.json('championAtlas', 'assets/champions/champions0.json')
    this.load.image('slot_equipped',      'assets/moonTile.png')
    this.load.image('slot_inventory',     'assets/moonTile.png')
    this.load.image('panel_stone',        'assets/log1.png')
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
    this.load.image('fogTexture',  '/assets/bg0.png')
    this.load.json('oryxCatalogue', '/assets/oryx/oryxCatalogue.json')
    this.load.image('oryxItems',   '/assets/oryx/oryx_16bit_fantasy_items_trans.png')
  }

// REPLACEMENT for _loadContent() in bogLocationScene.js
// Drop this in place of the existing _loadContent() method.
//
// Changes from original:
//   1. Random encounters: saved layout is restored from GameState on re-entry
//      rather than re-drawing from the deck. Only draws fresh on first visit.
//   2. Fixed encounters: loaded from content.fixedEncounters and placed at
//      their exact tile positions, registered with PGR exactly like random flags.

  async _loadContent() {
    const jsKey  = this.getContentKey()
    const mapKey = this.getMapKey()

    try {
      const module  = await import(`/data/bog/${jsKey}.js`)
      const content = module[jsKey + 'Content'] || {}

      this.mapData.objects        = content.objects        || []
      this.mapData.npcs           = content.npcs           || []
      this.mapData.introNarrative = content.introNarrative || []

      // -- Fixed encounters -------------------------------------------------
      // Placed at exact narrative positions. Never consumed; dialogue cycles
      // via GameState.npcProgress. Registered with PGR for badge + perspective.

      const fixedEncounters = content.fixedEncounters || []
      fixedEncounters.forEach(enc => {
        this.mapData.objects.push({
          id:       enc.id,
          type:     'fixed_encounter',
          x:        enc.x,
          y:        enc.y,
          stateKey: `${mapKey}.${enc.id}`,
          visual:   enc.visual || { gid: 255, flat: false },
          dialogues: enc.dialogues || [],
        })
      })

      // -- Random encounters ------------------------------------------------
      // On first visit: draw from deck, save layout to GameState.
      // On re-entry: restore saved layout (same positions, skip collected).

      const occupied = new Set()
      this.mapData.objects.forEach(o => occupied.add(`${o.x},${o.y}`))
      this.mapData.npcs.forEach(n => occupied.add(`${n.x},${n.y}`))

      const savedLayout = GameState.getEncounterLayout(mapKey)

      if (savedLayout) {
        // Restore -- only place encounters not yet collected
        savedLayout.forEach(entry => {
          const stateKey = `${mapKey}.${entry.id}`
          if (GameState.isCollected(stateKey)) return

          // Find the card definition from the deck so we keep visual/text
          const card = forestDeck.find(c => c.id === entry.id)
          if (!card) return

          this.mapData.objects.push({
            id:       card.id,
            type:     'encounter_flag',
            x:        entry.x,
            y:        entry.y,
            stateKey: stateKey,
            visual:   card.visual,
            text:     { ga: card.ga, en: card.en },
            actions:  card.actions || [],
          })
        })

        console.log(`[${this.scene.key}] restored encounter layout (${savedLayout.length} cards)`)

      } else {
        // First visit -- draw, place, save layout

        const layer0   = this.mapData.layers[0]
        const mapH     = this.mapData.height
        const mapW     = this.mapData.width
        const walkable = []

        for (let y = 1; y < mapH - 1; y++) {
          for (let x = 1; x < mapW - 1; x++) {
            const gid = layer0[y]?.[x]
            if (!gid) continue
            if (ALWAYS_UNWALKABLE.has(gid)) continue
            if (occupied.has(`${x},${y}`)) continue
            walkable.push({ x, y })
          }
        }

        walkable.sort(() => Math.random() - 0.5)

        const deck      = new EncounterDeck(forestDeck)
        const drawn     = deck.draw(6)
        let   wi        = 0
        const placed    = []
        const layoutToSave = []
        const MIN_SPACING  = 6

        drawn.forEach(card => {
          const stateKey = `${mapKey}.${card.id}`
          if (GameState.isCollected(stateKey)) return

          let tile = null
          while (wi < walkable.length) {
            const candidate = walkable[wi++]
            const tooClose = placed.some(p =>
              Math.abs(candidate.x - p.x) + Math.abs(candidate.y - p.y) < MIN_SPACING
            )
            if (!tooClose) { tile = candidate; break }
          }
          if (!tile) return

          placed.push(tile)
          layoutToSave.push({ id: card.id, x: tile.x, y: tile.y })

          this.mapData.objects.push({
            id:       card.id,
            type:     'encounter_flag',
            x:        tile.x,
            y:        tile.y,
            stateKey: stateKey,
            visual:   card.visual,
            text:     { ga: card.ga, en: card.en },
            actions:  card.actions || [],
          })
        })

        GameState.setEncounterLayout(mapKey, layoutToSave)
        console.log(`[${this.scene.key}] new encounter layout saved (${layoutToSave.length} cards)`)
      }

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

    if (this.perspectiveGround) {
      this.perspectiveGround.setPlayer(this.player)
    }

    // Register encounter flags with PGR
    if (this._pendingFlags?.length && this.perspectiveGround) {
      this.perspectiveGround.setEncounterFlags(this._pendingFlags)
      this._pendingFlags = []
    }

    this.itemSheet = new ItemSheetHelper(this)

    this.cameras.main.centerOn(this.player.logicalX, this.player.logicalY)

    this.walkGrid   = this._buildWalkGrid()
    this.fovSystem  = new FovSystem(this.walkGrid)
    this.pathFinder = new PathFinder(this.walkGrid, this.fovSystem)

    if (this.perspectiveGround) {
      this.fogRenderer = new FogRenderer(this.perspectiveGround)
    }

    this._lastFovKey = null
    this._recomputeFov()

    this._setupTapToPath()

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
      if (pointer.x < 220 && pointer.y > this.scale.height - 220) return
      const _moonZone = Math.round(Math.min(this.scale.width, this.scale.height) * 0.16)
      if (pointer.x > this.scale.width - _moonZone && pointer.y > this.scale.height - _moonZone) return
      if (this.textPanel?.isVisible) return
      if (!this.perspectiveGround) return
      if (this._bowAiming) return
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

  _onMoonTap() {
    const now = Date.now()
    if (now - (this._lastMoonTap || 0) < 700) return
    this._lastMoonTap = now

    if (this._encounterPanel?._card) {
      this._encounterPanel._openPanel()
      return
    }

    if (this.worldMenu?.itemDetailPanel?.isVisible) {
      this.worldMenu.itemDetailPanel.hide()
      return
    }

    if (this.worldMenu?.isOpen) {
      this._closeWorldMenuSilently()
      return
    }

    if (this._menuHub?.isOpen()) {
      this._menuHub.close()
      return
    }

    this._menuHub?.open()
  }

  _createWorldUI() {
    this.worldMenu = new WorldMenu(this, { player: this.player })

    this._menuHub = createGameMenuHub({
      onInventoryOpen:  () => {
        this.time.delayedCall(50, () => this.worldMenu?.open())
      },
      onInventoryClose: () => {
        if (this.worldMenu?.isOpen) this._closeWorldMenuSilently()
      },
    })

    this._moonWidget = createMoonWidget({
      initialPhase: GameSettings.englishOpacity,
      showSlider:   false,
      corner:       'top-right',
      onChange: (phase) => {
        GameSettings.setEnglishOpacity(phase)
        if (this.textPanel)  this.textPanel.updateEnglishOpacity()
        if (this.worldMenu?.itemDetailPanel)
          this.worldMenu.itemDetailPanel.updateLanguageOpacity()
        if (this._encounterPanel) this._encounterPanel.updateLanguageOpacity()
      },
      onTap: () => this._onMoonTap(),
    })

    this._encounterPanel = new EncounterPanel(this, this._moonWidget)
  }

  _closeWorldMenuSilently() {
    if (!this.worldMenu) return
    this.worldMenu.close()
  }

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

  createObjects() {
    if (!this.mapData.objects) return
    this.interactables = []

    this.mapData.objects.forEach(obj => {
      const stateKey = obj.stateKey || `${this.getMapKey()}.${obj.id}`
  

if (obj.type === 'collectable'    && GameState.isCollected(stateKey)) return
if (obj.type === 'encounter_flag' && GameState.isCollected(stateKey)) return
// fixed_encounter is NEVER skipped -- always present

	    if (obj.type === 'encounter_flag' && GameState.isCollected(stateKey)) return
     





 if (obj.requiresQuest && !GameState.isQuestActive(obj.requiresQuest) &&
          !GameState.isQuestComplete(obj.requiresQuest)) return

      const pixelX = obj.x * this.tileSize + this.tileSize / 2
      const pixelY = obj.y * this.tileSize + this.tileSize / 2

      const zone = this.add.zone(pixelX, pixelY, this.tileSize, this.tileSize)
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



if (obj.type === 'encounter_flag' || obj.type === 'fixed_encounter') {
  zone.setData('flagVisual', obj.visual || { gid: 255, flat: false })
  zone.setData('actions',    obj.actions    || [])
  zone.setData('dialogues',  obj.dialogues  || [])
  zone.setData('visual',     obj.visual     || {})
  this._pendingFlags = this._pendingFlags || []
  this._pendingFlags.push({ tileX: obj.x, tileY: obj.y, visual: obj.visual || { gid: 255, flat: false } })
}






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
getSkyImage() { return '/assets/skies/bog_threshold_sky.png' }
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

  shutdown() {
    if (this._encounterPanel) { this._encounterPanel.destroy(); this._encounterPanel = null }
    if (this._moonWidget)     { this._moonWidget.destroy();     this._moonWidget     = null }
    if (this._menuHub)        { this._menuHub.destroy();        this._menuHub        = null }
    if (this.perspectiveGround) {
      this.perspectiveGround.destroy()
      this.perspectiveGround = null
    }
    if (this.fogRenderer) {
      this.fogRenderer.destroy()
      this.fogRenderer = null
    }
    if (this.itemSheet)    { this.itemSheet.clear();      this.itemSheet    = null }
    if (this.fovSystem)    { this.fovSystem  = null }
    if (this.pathFinder)   { this.pathFinder = null }
    if (this.bowMechanics) { this.bowMechanics.destroy(); this.bowMechanics = null }
    this.lights.destroy()
    if (super.shutdown) super.shutdown()
  }

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
   
const skyUrl = this.getSkyImage()
if (skyUrl) this.perspectiveGround.setSkyImage(skyUrl)


    }
  }
}


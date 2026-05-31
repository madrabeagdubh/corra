import Phaser from 'phaser'
import { createStatusBar } from '../../../ui/statusBar.js'
import BoatSystem from '../../../systems/boatSystem.js'
 
import BaseLocationScene from '../baseLocationScene.js'
import { GameSettings } from '../../../settings/gameSettings.js'
import WorldMenu from '../../../ui/worldMenu.js'
import BowMechanics from '../../../combat/bowMechanics.js'
import { GameState } from '../../../systems/gameState.js'
import { transitionIn } from '../../../ui/sceneTransition.js'
import PerspectiveGroundRenderer from '../../../effects/perspectiveGroundRenderer.js'
import { SwallowSystem } from '../../../effects/swallows.js'
import FovSystem       from '../../../systems/fovSystem.js'
import ItemSheetHelper from '../../../ui/inventory/itemSheetHelper.js'
import PathFinder from '../../../systems/pathFinder.js'
import FogRenderer from '../../../systems/fogRenderer.js'
import { createMoonWidget }  from '../../../ui/moonWidget.js'
import { createGameMenuHub } from '../../../ui/gameMenuHub.js'
import { SoundBoard } from '../../../systems/soundBoard.js'
import { EncounterDeck } from '../../../../../data/encounters/encounterDeck.js'
import { forestDeck }    from '../../../../../data/encounters/forestDeck.js'
import { EncounterPanel } from '../../../ui/encounterPanel.js'
import Easca3 from '../../../ui/easca3.js'
import Joystick from '../../../input/joystick.js'

window.GameState = GameState

const TW = 24, TH = 24, MG = 24, SHEET_COLS = 54
const SCALE = 2

const ALWAYS_UNWALKABLE = new Set([
  1634, 1688, 740,
  228, 231, 233, 234, 235, 236, 226, 229, 230, 232, 242, 243,
  217, 218, 219,
  120, 121, 122, 123, 124, 125, 126, 127,
  128, 129, 130, 131, 132, 133, 134, 135,
])

export default class BogLocationScene extends BaseLocationScene {

  getMapKey()              { return 'great_open_bog' }
  getAmbient()             { return 0x334422 }
  getPlayerLight()         { return { color: 0xfff2cc, intensity: 2.0, radius: 300 } }
  getWisps()               { return [] }
  getMusicTrack()          { return null }
  getExtraUnwalkableGIDs() { return new Set() }
  onEnter()                {}
  getSkyImage()            { return '/assets/skies/bog_threshold_sky.png' }
  getSkyPosition()         { return '50% 50%' }
  getMountainImage()       { return '/assets/thresholdMountains.png' }
  getMountainPosition()    { return '50% 100%' }
get _joyY() {
  const canvasRect = this.game?.canvas?.getBoundingClientRect()
  const statusRect = document.getElementById('status-bar')?.getBoundingClientRect()
  if (!canvasRect || !statusRect) return this.scale.height - 80
  const scaleY = this.scale.height / canvasRect.height
  return (statusRect.top - canvasRect.top) * scaleY - 60
}
  init(data) {
    this.entryData = data || {}
    this._exiting  = false
    console.log(`[${this.scene.key}] init -- entryEdge: ${data?.entryEdge}`)
  }

  preload() {
    this.load.image('encounterPanelBG', '/assets/panelBG.png')
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

  async _loadContent() {
    const jsKey  = this.getContentKey()
    const mapKey = this.getMapKey()

    try {
      const module  = await import(`/data/bog/${jsKey}.js`)
      const content = module[jsKey + 'Content'] || {}

      this.mapData.objects        = content.objects        || []
      this.mapData.npcs           = content.npcs           || []
      this.mapData.introNarrative = content.introNarrative || []

      const fixedEncounters = content.fixedEncounters || []
      fixedEncounters.forEach(enc => {
        this.mapData.objects.push({
          id:        enc.id,
          type:      'fixed_encounter',
          x:         enc.x,
          y:         enc.y,
          stateKey:  `${mapKey}.${enc.id}`,
          visual:    enc.visual || { gid: 255, flat: false },
          dialogues: enc.dialogues || [],
        })
      })

      const occupied = new Set()
      this.mapData.objects.forEach(o => occupied.add(`${o.x},${o.y}`))
      this.mapData.npcs.forEach(n => occupied.add(`${n.x},${n.y}`))

      const savedLayout = GameState.getEncounterLayout(mapKey)

      if (savedLayout) {
        savedLayout.forEach(entry => {
          const stateKey = `${mapKey}.${entry.id}`
          if (GameState.isCollected(stateKey)) return
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
        const layer0   = this.mapData.layers[0]
        const mapH     = this.mapData.height
        const mapW     = this.mapData.width
        const walkable = []
        for (let y = 1; y < mapH - 1; y++) {
          for (let x = 1; x < mapW - 1; x++) {
            const gid = layer0[y]?.[x]
            if (!gid || ALWAYS_UNWALKABLE.has(gid) || occupied.has(`${x},${y}`)) continue
            walkable.push({ x, y })
          }
        }
        walkable.sort(() => Math.random() - 0.5)

        const deck = new EncounterDeck(forestDeck)
        const drawn = deck.draw(6)
        let wi = 0
        const placed = [], layoutToSave = []
        const MIN_SPACING = 6

        drawn.forEach(card => {
          const stateKey = `${mapKey}.${card.id}`
          if (GameState.isCollected(stateKey)) return
          let tile = null
          while (wi < walkable.length) {
            const candidate = walkable[wi++]
            if (!placed.some(p => Math.abs(candidate.x - p.x) + Math.abs(candidate.y - p.y) < MIN_SPACING)) {
              tile = candidate; break
            }
          }
          if (!tile) return
          placed.push(tile)
          layoutToSave.push({ id: card.id, x: tile.x, y: tile.y })
          this.mapData.objects.push({
            id: card.id, type: 'encounter_flag',
            x: tile.x, y: tile.y, stateKey,
            visual: card.visual,
            text: { ga: card.ga, en: card.en },
            actions: card.actions || [],
          })
        })
        GameState.setEncounterLayout(mapKey, layoutToSave)
        console.log(`[${this.scene.key}] new encounter layout saved (${layoutToSave.length} cards)`)
      }

      console.log(`[${this.scene.key}] content loaded -- ${this.mapData.objects.length} objects, ${this.mapData.npcs.length} npcs`)
    } catch(e) {
      console.warn(`[${this.scene.key}] content file not found for ${jsKey}:`, e.message)
      this.mapData.objects = []
      this.mapData.npcs = []
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
	  window._phaserAudioContext = this.sound.context

    await this._loadContent()

    this.lights.enable()
    this.lights.setAmbientColor(this.getAmbient())

    this.usePerspective = true
    this.drawTilemap()

    this.mapData.tiles           = this.mapData.layers[0]
    this.mapData.unwalkableTiles = []

    if (!this.mapData.spawns) this.mapData.spawns = {
      player: { x: Math.floor(this.mapData.width / 2), y: Math.floor(this.mapData.height / 2) }
    }
    if (!this.mapData.exits) this.mapData.exits = {}

    // Input UI first -- creates this.joystick so base class skips its plain one
    this._createInputUI()

    // Creates player, uses this.joystick if it already exists
    this.initializeLocation()

    // Player UI -- needs player to exist
    this._createPlayerUI()

    if (this.perspectiveGround) {
      this.perspectiveGround.setPlayer(this.player)
    }

    if (this._pendingFlags?.length && this.perspectiveGround) {
      this.perspectiveGround.setEncounterFlags(this._pendingFlags)
      this._pendingFlags = []
    }

    this.itemSheet = new ItemSheetHelper(this)

    this.cameras.main.centerOn(this.player.logicalX, this.player.logicalY)
    this.cameras.main.startFollow(this._camProxy, true, 0.1, 0.1)
this.walkGrid   = this._buildWalkGrid()
    this.boatSystem = new BoatSystem(this)   // dormant until activate() called

    this.fovSystem  = new FovSystem(this.walkGrid)
this.pathFinder = new PathFinder(this.walkGrid, null)
    // this.fogRenderer = new FogRenderer(this.perspectiveGround)

    this._lastFovKey = null
    this._recomputeFov()
    this._setupTapToPath()

    const champion = this.registry.get('selectedChampion') || window.selectedChampion
    // Champions have no .id field -- use nameGa as unique identifier
    const _cid = champion?.id ?? champion?.nameGa ?? champion?.spriteKey
    if (_cid) GameState.init(_cid)
    GameState.setVisited(this.scene.key)

    this.applyEntryPosition()

    const pl = this.getPlayerLight()
    this.playerLight = this.lights.addLight(
      this.player.logicalX, this.player.logicalY, pl.radius || 300
    ).setIntensity(pl.intensity || 2.0).setColor(pl.color || 0xfff2cc)

    const mw = this.mapWidth, mh = this.mapHeight
    this.getWisps().forEach(w => {
      this.lights.addLight(mw * w.rx, mh * w.ry, w.radius || 180, w.color || 0x99ff99, w.intensity || 0.6)
    })

    const track = this.getMusicTrack()
    if (track && window.tradConductor) window.tradConductor.playTrack(track)

    this.bowMechanics = new BowMechanics(this, this.player)
    this.showIntroNarrative()
    this.onEnter()

    console.log(`[${this.scene.key}] ready -- ${this.mapData.width}x${this.mapData.height}`)
    transitionIn()
    this._drawExitDebug()
  }

  // ── Input UI -- no player needed -----------------------------------------
  _createInputUI() {
    this._easca = new Easca3(this, (text) => {
      console.log('[Labhair] Player said:', text)
    })

    this._menuHub = createGameMenuHub({
      onInventoryOpen:  () => { this.time.delayedCall(50, () => this.worldMenu?.open()); if (this.player) this.player.canMove = false; },
      onInventoryClose: () => { if (this.worldMenu?.itemDetailPanel?.isVisible) { this.worldMenu.itemDetailPanel.hide(); this.worldMenu.inventoryGrid.show(); } else { if (this.worldMenu?.isOpen) this._closeWorldMenuSilently(); if (this.player) this.player.canMove = true; } },
      onLabhairtOpen:   () => { this._easca?.showKeyboard() },
      onLabhairtClose:  () => { this._easca?.hideKeyboard() },
    })

    // Preview overlay -- completely separate from gameMenuHub
    const existingPreview = document.getElementById('menu-preview-overlay')
    if (existingPreview) existingPreview.parentNode?.removeChild(existingPreview)

    this._menuPreview = document.createElement('div')
    this._menuPreview.id = 'menu-preview-overlay'
    this._menuPreview.style.cssText = [
      'position:fixed;inset:0;',
      'background:rgba(8,6,2,0.6);',
      'z-index:1000001;',
      'pointer-events:none;',
      'opacity:0;',
      'transition:opacity 0.3s ease;',
    ].join('')
    document.body.appendChild(this._menuPreview)

   this._statusBar = createStatusBar(document.getElementById('gameContainer'))
//
    // -- Calculate joyY from status bar position in canvas coords ------------
    const canvas     = this.game.canvas
    const canvasRect = canvas.getBoundingClientRect()
    const scaleY     = this.scale.height / canvasRect.height
    const statusRect = this._statusBar?.getBoundingClientRect()
    const statusTopInCanvas = statusRect
      ? (statusRect.top - canvasRect.top) * scaleY
      : this.scale.height - 42

    const joyX = this.scale.width / 2
    const joyY = statusTopInCanvas - 60  // 60 = joystick radius, bottom of dpad touches status bar top
    const joyR = 60

    this.joystick = new Joystick(this, {
      x:      joyX,
      y:      joyY,
      radius: joyR,

      onTap: () => this._onMoonTap(),

      onLongPressProgress: (p) => {
        this.joystick?.drawChargeGlow(p)
        if (p < 0.15) return
        this._menuPreview.style.display = 'block'
        this._menuPreview.style.opacity = ((p - 0.15) * 1.2).toFixed(2)
      },

      onLongPress: () => {
        if (Date.now() - (this._lastMenuClose ?? 0) < 400) return
        this.joystick?.drawChargeGlow(0)
        this._menuPreview.style.transition = 'opacity 0.2s ease'
        this._menuPreview.style.opacity = '0'
        this._menuHub?.open()
      },

      onLongPressCancel: () => {
        this.joystick?.drawChargeGlow(0)
        this._menuPreview.style.opacity = '0'
      },

      onSwipe: (dx) => { this._moonWidget?.nudgePhase(dx); const _mn = performance.now(); if (!this._lastMoonSwipe || _mn - this._lastMoonSwipe > 80) { this._lastMoonSwipe = _mn; SoundBoard.playWeb("MOON_SWIPE", this) } },
    })

    this._moonWidget = createMoonWidget({
      initialPhase:   GameSettings.englishOpacity,
      embeddedCanvas: this.joystick.getMoonCanvas(),
      embeddedRadius: this.joystick.getMoonRadius(),
      swipeRange:     150,
      onChange: (phase) => {
        GameSettings.setEnglishOpacity(phase)
        if (this.textPanel)  this.textPanel.updateEnglishOpacity()
        if (this.worldMenu?.itemDetailPanel)
          this.worldMenu.itemDetailPanel.updateLanguageOpacity()
        if (this._encounterPanel) this._encounterPanel.updateLanguageOpacity()
      },
    })
  }


  // ── Player UI -- needs player ---------------------------------------------

  _createPlayerUI() {
    this.worldMenu       = new WorldMenu(this, { player: this.player, onClose: () => { if (this._menuHub?.isOpen()) this._menuHub.close(); this._lastMenuClose = Date.now() } })
    this._encounterPanel = new EncounterPanel(this, this._moonWidget)
  }

  // ── Tap to path ----------------------------------------------------------
_setupTapToPath() {
  const canvas = this.game.canvas
  canvas.addEventListener('pointerdown', (e) => {
    const rect    = canvas.getBoundingClientRect()
    const scaleX  = canvas.width  / rect.width
    const scaleY  = canvas.height / rect.height
    const canvasX = (e.clientX - rect.left) * scaleX
    const canvasY = (e.clientY - rect.top)  * scaleY

    // Circular deadzone around dpad
    const joyX = this.scale.width / 2
    const joyY = this._joyY
    const joyR = 100
    const dx   = canvasX - joyX
    const dy   = canvasY - joyY
    if (dx * dx + dy * dy < joyR * joyR) return

    if (this.textPanel?.isVisible) return
    if (this._menuHub?.isOpen() || this.worldMenu?.isOpen) return
    if (!this.perspectiveGround) return
    if (this._bowAiming) return




const tile = PathFinder.screenToTile(
      canvasX, canvasY,
      this.perspectiveGround,
      this.tileSize
    )
    if (!tile) return

    // In boat: reject taps on land tiles; only water + shore are valid
    if (this.player?.inBoat && this.boatSystem) {
      if (!this.boatSystem.isValidBoatTarget(tile.tx, tile.ty)) return
    }
    if (!this.player?.inBoat) {
      const pgr = this.perspectiveGround
      const ts  = this.tileSize
      if (pgr?._boatWorldX != null) {
        const boatTX = Math.round(pgr._boatWorldX / ts)
        const boatTY = Math.round(pgr._boatWorldY / ts)
        if (tile.tx === boatTX && tile.ty === boatTY) {
          if (this.walkGrid[boatTY]) this.walkGrid[boatTY][boatTX] = true
        }
      }
    }



    const _dbgRow = this.perspectiveGround._perspCamRow()
    console.log('[tap] tile:', tile.tx, tile.ty, 'canvasXY:', Math.round(canvasX), Math.round(canvasY), 'camRow:', _dbgRow.toFixed(2), 'horizPx:', this.perspectiveGround._horizonPx())
    const fromTX = Math.floor(this.player.logicalX / this.tileSize)
    const fromTY = Math.floor(this.player.logicalY / this.tileSize)
    const path   = this.pathFinder.findPath(fromTX, fromTY, tile.tx, tile.ty)
    if (path.length > 0) {
      this.player.setPath(path)
      this._flashTargetTile(tile.tx, tile.ty)
    }
  })
}

  // ── Moon tap -------------------------------------------------------------

_flashTargetTile(tx, ty) {
    const _c = this.sound?.context
    if (_c) SoundBoard.playWeb("TAP_TO_PATH", _c)
    if (!this.perspectiveGround) return
    const ts   = this.tileSize
    const lx   = tx * ts + ts / 2
    const ly   = ty * ts + ts / 2
    const proj = this.perspectiveGround._projectLogical(lx, ly)
    if (!proj) return
    if (this._tapMarker) { this._tapMarker.destroy(); this._tapMarker = null }
    const g = this.add.graphics().setScrollFactor(0).setDepth(15)
    this._tapMarker = g
    // Snap to tile centre — project the exact tile centre
    const snapLx  = tx * ts + ts / 2
    const snapLy  = ty * ts + ts / 2
    const snapProj = this.perspectiveGround._projectLogical(snapLx, snapLy)
    if (!snapProj) { g.destroy(); return }
    const cx = snapProj.screenX
    const cy = snapProj.screenY
    const r  = Math.round(ts * snapProj.scale * 0.5)
    let alpha = 0.85, scale = 0.3
    const expand = this.time.addEvent({
      delay: 16, repeat: 18,
      callback: () => {
        g.clear()
        scale = Math.min(1, scale + 0.05)
        alpha = Math.max(0, alpha - 0.045)
        // Squash ellipse to match ground plane perspective
        const squash = snapProj.scale ? Math.min(0.45, snapProj.scale * 0.8) : 0.35
        g.lineStyle(2, 0xffd700, alpha)
        g.strokeEllipse(cx, cy, r * scale * 2, r * scale * squash * 2)
        g.lineStyle(1, 0xffffff, alpha * 0.5)
        g.strokeEllipse(cx, cy, r * scale * 1.2, r * scale * squash * 1.2)
        if (alpha <= 0) { g.destroy(); this._tapMarker = null; expand.remove() }
      }
    })
  }

  _onMoonTap() {
  const now = Date.now()
  if (now - (this._lastMoonTap || 0) < 700) return
  this._lastMoonTap = now

  // Disembark takes priority when badge is showing
  if (this._encounterPanel?._card?.id === 'disembark') {
    // encounterPanel badge pointerdown already called _doDisembark -- just clear state
    this._encounterPanel.clearNotify()
    this._disembarkBadgeShown = false
    return
  }

  // Encounter panel takes priority
  if (this._encounterPanel?._card) {
    this._encounterPanel._openPanel()
    return
  }

  // Close menu if open
  if (this._menuHub?.isOpen()) {
    this._menuHub.close()
    return
  }

  // Tap does NOT open menu -- use long press for that
} 

  _doDisembark() {
    const p   = this.player
    const ts  = this.tileSize
    const map = this.mapData.layers[0]

    // Search from boat world position, not player logical position
    const pgr   = this.perspectiveGround
    const bx    = (pgr?._boatWorldX != null) ? pgr._boatWorldX : p.logicalX
    const by    = (pgr?._boatWorldY != null) ? pgr._boatWorldY : p.logicalY
    const tileX = Math.floor(bx / ts)
    const tileY = Math.floor(by / ts)

    // Land = anything that is not water (1625,1679) or reeds (731)
    const isPassable = (g) => g === 1625 || g === 1679 || g === 731 || g === 0

    // Search expanding rings for nearest land tile
    let landTile = null
    outer: for (let r = 1; r <= 5; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
          const tx = tileX + dx, ty = tileY + dy
          if (ty < 0 || ty >= this.mapData.height) continue
          if (tx < 0 || tx >= this.mapData.width) continue
          const gid = map[ty]?.[tx] ?? 0
          if (!isPassable(gid)) {
            landTile = { tx, ty }
            break outer
          }
        }
      }
    }

    // Capture boat's reed position BEFORE deactivate() overwrites it with player pos
    const boatLX = bx
    const boatLY = by

    const lx = landTile
      ? landTile.tx * ts + ts / 2
      : p.logicalX
    const ly = landTile
      ? landTile.ty * ts + ts / 2
      : p.logicalY

    // Trigger disembark (deactivate sets pgr._boatWorldX/Y from player pos)
    this.boatSystem._triggerDisembark(false)

    // Override boat world position to the reed tile where the hull actually is
    const pgr2 = this.perspectiveGround
    if (pgr2) {
      pgr2._boatWorldX  = boatLX
      pgr2._boatWorldY  = boatLY
      pgr2._boatDrifting = true
      pgr2._boatDriftSpeed = 0     // moored in reeds -- visible but no movement
    }

    // Persist boat reed position so it survives map transitions
    const _mapKey = this.getMapKey?.() ?? this.scene.key
    const _btx = Math.floor(boatLX / ts)
    const _bty = Math.floor(boatLY / ts)
    GameState.setBoatPosition(_mapKey, _btx, _bty)
    console.log(`[disembark] boat saved at [${_btx},${_bty}] on ${_mapKey}`)

    // Snap player to land after deactivate settles
    this.time.delayedCall(500, () => {
      if (!this.player) return
      this.player.logicalX = lx
      this.player.logicalY = ly
      this.player.targetX  = lx
      this.player.targetY  = ly
      this.player.startX   = lx
      this.player.startY   = ly
      this.player.isMoving = false
      this.player.pathQueue = []
    })
  }

  _closeWorldMenuSilently() {
    if (!this.worldMenu) return
    this.worldMenu.close()
    this._lastMenuClose = Date.now()
  }

  // ── Walk grid / FOV -------------------------------------------------------

  _buildWalkGrid() {
    const tiles = this.mapData.layers[0]
    const h = tiles.length, w = tiles[0].length
    const grid = []
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

  isColliding(x, y) {
    const tx = Math.floor(x / this.tileSize)
    const ty = Math.floor(y / this.tileSize)
    if (ty < 0 || ty >= this.mapData.height || tx < 0 || tx >= this.mapData.width) return true
    // In boat: only water (1625,1679) and reeds (731) are passable
    if (this.player?.inBoat) {
      const _g = this.mapData.layers[0]?.[ty]?.[tx]
      if (_g === 1625 || _g === 1679 || _g === 731) return false
      return true   // land blocks boat
    }
    const extra = this.getExtraUnwalkableGIDs()
    const g0 = this.mapData.layers[0]?.[ty]?.[tx]
    if (ALWAYS_UNWALKABLE.has(g0) || extra.has(g0)) return true
    const g1 = this.mapData.layers[1]?.[ty]?.[tx]
    if (g1 && (ALWAYS_UNWALKABLE.has(g1) || extra.has(g1))) return true
    // Map edge collision
    const W = this.mapData.width, H = this.mapData.height
    const border = this.mapData.border
    // Outer border: void tiles, only passable at exit corridor
    const onOuter = tx===0 || tx===W-1 || ty===0 || ty===H-1
    if (onOuter) {
      if (!border) return true
      const inCorridor =
        ((tx===0||tx===W-1) && border.openRows?.includes(ty)) ||
        ((ty===0||ty===H-1) && border.openCols?.includes(tx))
      if (!inCorridor) return true
    }
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
      entryY = Math.max(1, Math.min(destH - 2, Math.round(fraction * destH)))
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
    }

    const cam = this.cameras.main
    cam.centerOn(px, py)
    cam.fadeIn(180, 0, 0, 0)
    import('../../../ui/sceneTransition.js').then(m => m.transitionIn(180))
    this.time.delayedCall(180, () => {
      cam.startFollow(this._camProxy, true, 0.1, 0.1)
    })
    // arrivedAt timestamp in entryData handles the exit cooldown
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
      if (this.textPanel) { this.textPanel._cooldown = false; this.textPanel._cooldownId = null }
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
      if (obj.requiresQuest && !GameState.isQuestActive(obj.requiresQuest) &&
          !GameState.isQuestComplete(obj.requiresQuest)) return

      const pixelX = obj.x * this.tileSize + this.tileSize / 2
      const pixelY = obj.y * this.tileSize + this.tileSize / 2
      const zone   = this.add.zone(pixelX, pixelY, this.tileSize, this.tileSize)
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
        zone.setData('actions',    obj.actions   || [])
        zone.setData('dialogues',  obj.dialogues || [])
        zone.setData('visual',     obj.visual    || {})
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
      sprite.setDepth(10).setInteractive()

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

 



update(time, delta) {
    if (this.perspectiveGround) this.perspectiveGround.update()
    if (this.boatSystem) this.boatSystem.update(delta)
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

    if (this.fogRenderer && this.fovSystem) this.fogRenderer.update(this.fovSystem)
    if (this.playerLight && this.player) this.playerLight.setPosition(this.player.logicalX, this.player.logicalY)
    if (this.bowMechanics) this.bowMechanics.update(delta)
  }

  shutdown() {
    if (this._encounterPanel) { this._encounterPanel.destroy(); this._encounterPanel = null }
    if (this._moonWidget)     { this._moonWidget.destroy();     this._moonWidget     = null }
    if (this._menuHub)        { this._menuHub.destroy();        this._menuHub        = null }
    if (this._easca)          { this._easca.destroy();          this._easca          = null }
    if (this.joystick)        { this.joystick.destroy();        this.joystick        = null }
    if (this._menuPreview?.parentNode) {
      this._menuPreview.parentNode.removeChild(this._menuPreview)
      this._menuPreview = null
    }
    if (this._swallows) { this._swallows.stop(); this._swallows = null }
    if (this.perspectiveGround) { this.perspectiveGround.destroy(); this.perspectiveGround = null }
    if (this.fogRenderer)    { this.fogRenderer.destroy();   this.fogRenderer   = null }
    if (this.itemSheet)      { this.itemSheet.clear();       this.itemSheet     = null }
    if (this.bowMechanics)   { this.bowMechanics.destroy();  this.bowMechanics  = null }
  
if (this.boatSystem)     { this.boatSystem.destroy();    this.boatSystem    = null }


  if (this._statusBar?.parentNode) {
      this._statusBar.parentNode.removeChild(this._statusBar)
      this._statusBar = null
    }
    this.fovSystem  = null
    this.pathFinder = null
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

if (this.usePerspective && li <= 3) continue

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
      if (skyUrl) this.perspectiveGround.setSkyImage(skyUrl, this.getSkyPosition())
      // Always recreate swallows with current map key
      if (this._swallows) { this._swallows.stop(); this._swallows = null }
      this._swallows = new SwallowSystem(
        () => PerspectiveGroundRenderer.HORIZON_Y_FRAC,
        this.scene.key
      )
      this._swallows.start()
      const mtnUrl = this.getMountainImage()
      if (mtnUrl) {
        const mtnPos = this.getMountainPosition()
        const parts  = mtnPos.split(' ')
        this.perspectiveGround._mountainBaseX = parseFloat(parts[0])
        this.perspectiveGround._mountainBaseY = parseFloat(parts[1])
        this.perspectiveGround._tileSize      = this.tileSize
        this.perspectiveGround.setMountainImage(mtnUrl, mtnPos)
      }
    }
  }
  _drawExitDebug() {
    if (!window._devExits) return
    if (!this.mapData?.exits) return
    const T = this.tileSize
    const COLOURS = { north: 0x00ffff, south: 0xff8800, west: 0xffff00, east: 0xff00ff }
    for (const [dir, exitData] of Object.entries(this.mapData.exits)) {
      const col = COLOURS[dir] ?? 0xffffff
      exitData.tiles.forEach(([tx, ty]) => {
        this.add.rectangle(tx*T + T/2, ty*T + T/2, T-2, T-2, col, 0.45).setDepth(200)
        this.add.text(tx*T + 2, ty*T + 2, exitData.destination,
          { fontSize: '9px', fontFamily: 'monospace', color: '#ffffff' }).setDepth(201)
      })
    }
    if (this.mapData.entries) {
      for (const [dir, entry] of Object.entries(this.mapData.entries)) {
        const ex = (entry.x ?? 18)*T + T/2, ey = (entry.y ?? 18)*T + T/2
        this.add.rectangle(ex, ey, T, T, 0xffffff, 0.3).setDepth(200)
        this.add.text(ex - T/2 + 2, ey - T/2 + 2, 'in:'+dir,
          { fontSize: '9px', fontFamily: 'monospace', color: '#00ff00' }).setDepth(201)
      }
    }
  }



  // ── Shared boat restore for all river maps ───────────────────────────────
  // Call from onEnter() in any river map scene.
  // Restores moored boat from GameState, or activates if arriving by boat.
  _restoreBoatOnEnter(opts = {}) {
    const { activateIfNoSave = false } = opts
    const mapKey = this.getMapKey?.() ?? this.scene.key
    this.time.delayedCall(500, () => {
      // Read INSIDE the delay so GameState.init() has already run
      const saved = GameState.getBoatPosition(mapKey)
      console.log(`[_restoreBoatOnEnter] mapKey=${mapKey} saved=`, saved)
      if (!this.boatSystem || !this.perspectiveGround) return
      if (this.textures.exists('boat')) {
        this.perspectiveGround.loadBoatImage(
          this.textures.get('boat').getSourceImage()
        )
      }
      if (saved) {
        const ts  = this.tileSize
        const pgr = this.perspectiveGround
        pgr._boatWorldX   = saved.tileX * ts + ts / 2
        pgr._boatWorldY   = saved.tileY * ts + ts / 2
        pgr._boatDrifting = true
        pgr._boatDriftSpeed = 0
        const pTX = Math.floor(this.player.logicalX / ts)
        const pTY = Math.floor(this.player.logicalY / ts)
        if (pTX === saved.tileX && pTY === saved.tileY) {
          this.boatSystem.activate()
        }
        console.log(`[${mapKey}] boat restored at [${saved.tileX},${saved.tileY}]`)
      } else if (activateIfNoSave) {
        this.boatSystem.activate()
      }
    })
  }

  // ── Exits ─────────────────────────────────────────────────────────────────
  checkExits() {
    if (!this.mapData?.exits) return
    if (this._exiting) return
    if (this.entryData?.arrivedAt && Date.now() - this.entryData.arrivedAt < 900) return
    const tileX = Math.floor(this.player.logicalX / this.tileSize)
    const tileY = Math.floor(this.player.logicalY / this.tileSize)
    if (tileX >= this.mapData.width - 2) console.log('[exit] tileX:', tileX, 'tileY:', tileY, 'logicalX:', this.player.logicalX, 'tileSize:', this.tileSize)
    for (const [dir, exitData] of Object.entries(this.mapData.exits)) {
      if (exitData.tiles.some(([ex, ey]) => ex === tileX && ey === tileY)) {
        console.log(`[${this.scene.key}] exit -> ${exitData.destination} via ${dir}`)
        this._triggerExit(dir, exitData)
        return
      }
    }
  }

  _triggerExit(dir, exitData) {
    if (this._exiting) return
    this._exiting = true
    if (this.joystick) this.joystick.reset()

    const T  = this.tileSize
    const px = this.player.logicalX
    const py = this.player.logicalY

    // Capture source tile BEFORE walk-off moves the player
    const sourceTileX = Math.floor(px / T)
    const sourceTileY = Math.floor(py / T)

    const WALK = T * 3
    const DUR  = 320

    let tx = px, ty = py
    if (dir === 'west')  tx = px - WALK
    if (dir === 'east')  tx = px + WALK
    if (dir === 'north') ty = py - WALK
    if (dir === 'south') ty = py + WALK

    this.player.isMoving = true
    this.tweens.add({
      targets:  this.player,
      logicalX: tx,
      logicalY: ty,
      duration: DUR,
      ease:     'Sine.easeIn',
      onUpdate: () => {
        this.player.targetX = this.player.logicalX
        this.player.targetY = this.player.logicalY
      },
      onComplete: () => {
        this.player.isMoving = false
        this.cameras.main.fadeOut(180, 0, 0, 0)
        import('../../../ui/sceneTransition.js').then(m => m.transitionOut(180))
        this.time.delayedCall(200, () => {
          this.scene.start(exitData.destination, {
            entryEdge:    exitData.entryPoint,
            sourceTile:   { x: sourceTileX, y: sourceTileY },
            sourceHeight: this.mapData.height,
            sourceWidth:  this.mapData.width,
            entryDir:     dir,
          })
        })
      }
    })
  }

  _addExitBlooms() {
    if (!this.mapData?.exits) return
    if (!this.perspectiveGround) return

    // Build arrow canvases and register with PGR as billboard markers
    const exitMarkers = []
    for (const [dir, exitData] of Object.entries(this.mapData.exits)) {
      const tiles  = exitData.tiles
      const mid    = tiles[Math.floor(tiles.length / 2)]
      // Place marker ON the exit tile (the visible protruding tile)
      let tx = mid[0], ty = mid[1]

      exitMarkers.push({ tileX: tx, tileY: ty, dir })
    }

    this.perspectiveGround.setExitMarkers(exitMarkers)
  }
}


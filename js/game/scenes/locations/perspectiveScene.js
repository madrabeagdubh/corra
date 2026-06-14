// perspectiveScene.js
// Location: js/game/scenes/locations/perspectiveScene.js
//
// ── Purpose ───────────────────────────────────────────────────────────────────
// Middle layer between BaseLocationScene and all perspective-rendered map scenes.
// Owns everything that requires PerspectiveGroundRenderer but is generic across
// ALL perspective maps (bog, river, dungeon, castle, etc.).
//
// ── What lives here ───────────────────────────────────────────────────────────
//   • PGR + ElevationRenderer setup and update
//   • drawTilemap() — oryx tile rendering + PGR canvas
//   • FOV system + fog renderer
//   • Tap-to-path (PathFinder)
//   • Joystick + moon widget + menu hub + encounter panel (full input UI)
//   • applyEntryPosition, showIntroNarrative
//   • Exit handling (checkExits, _triggerExit)
//   • Walk grid building
//   • BowMechanics
//
// ── What does NOT live here ───────────────────────────────────────────────────
//   • Boat system → RiverScene
//   • Encounter deck placement → BogScene
//   • Map-specific content loading → individual scene subclasses
//   • Map-specific GIDs, sky images, music → override hooks (getSkyImage etc.)
//
// ── Override hooks (implement in subclasses) ──────────────────────────────────
//   getMapKey()              — required — e.g. 'great_open_bog'
//   getMapPath()             — optional — default: /maps/bogMaps/${key}.json
//   getAmbient()             — optional — default: 0x334422
//   getPlayerLight()         — optional — { color, intensity, radius }
//   getWisps()               — optional — array of wisp light configs
//   getMusicTrack()          — optional — track key for tradConductor
//   getExtraUnwalkableGIDs() — optional — Set of additional unwalkable GIDs
//   getSkyImage()            — optional — URL string or null
//   getSkyPosition()         — optional — CSS position string
//   getMountainImage()       — optional — URL string or null
//   getMountainPosition()    — optional — CSS position string
//   getElevationConfig()     — optional — returns ElevationRenderer config or null
//   onEnter()                — optional — called after scene is fully ready
//   _loadContent()           — optional — override to load map-specific objects/NPCs

import Phaser from 'phaser'
import BaseLocationScene from './baseLocationScene.js'
import { GameSettings }      from '../../settings/gameSettings.js'
import { GameState }         from '../../systems/gameState.js'
import { SoundBoard }        from '../../systems/soundBoard.js'
import { transitionIn }      from '../../ui/sceneTransition.js'
import WorldMenu             from '../../ui/worldMenu.js'
import BowMechanics          from '../../combat/bowMechanics.js'
import ItemSheetHelper       from '../../ui/inventory/itemSheetHelper.js'
import PathFinder            from '../../systems/pathFinder.js'
import FovSystem             from '../../systems/fovSystem.js'
import FogRenderer           from '../../systems/fogRenderer.js'
import ElevationRenderer     from '../../systems/elevationRenderer.js'
import PerspectiveGroundRenderer from '../../effects/perspectiveGroundRenderer.js'
import { SwallowSystem }     from '../../effects/swallows.js'
import { EncounterPanel }    from '../../ui/encounterPanel.js'
import { createMoonWidget }  from '../../ui/moonWidget.js'
import { createGameMenuHub } from '../../ui/gameMenuHub.js'
import { createStatusBar }   from '../../ui/statusBar.js'
import Easca3                from '../../ui/easca3.js'
import Joystick              from '../../input/joystick.js'

window.GameState = GameState

// Oryx tileset constants
const TW = 24, TH = 24, MG = 24, SHEET_COLS = 54, SCALE = 2

// GIDs that are never walkable regardless of map
const ALWAYS_UNWALKABLE = new Set([
  1634, 1688, 740,
  228, 231, 233, 234, 235, 236, 226, 229, 230, 232, 242, 243,
  217, 218, 219,
  120, 121, 122, 123, 124, 125, 126, 127,
  128, 129, 130, 131, 132, 133, 134, 135,
])

export default class PerspectiveScene extends BaseLocationScene {

  // ── Override hooks ────────────────────────────────────────────────────────
  getMapKey()              { return 'unnamed_map' }
  getMapPath()             { return `/maps/bogMaps/${this.getMapKey()}.json?v=${Date.now()}` }
  getAmbient()             { return 0x334422 }
  getPlayerLight()         { return { color: 0xfff2cc, intensity: 2.0, radius: 300 } }
  getWisps()               { return [] }
  getMusicTrack()          { return null }
  getExtraUnwalkableGIDs() { return new Set() }
  getSkyImage()            { return null }
  getSkyPosition()         { return '50% 50%' }
  getMountainImage()       { return null }
  getMountainPosition()    { return '50% 100%' }
  onEnter()                {}

  getElevationConfig() {
    const cfg = this.mapData?.elevationConfig
    if (!cfg) return null
    return {
      cliffFaceGid: cfg.cliffFaceGid ?? 740,
      elevatedGids: new Set(cfg.elevatedGids ?? [839, 840]),
      cliffSouth:   new Set(cfg.cliffSouth   ?? [731, 1625, 1679]),
      cliffHeight:  cfg.cliffHeight  ?? 1.0,
    }
  }

  async _loadContent() {}

  // ── Joystick Y position ───────────────────────────────────────────────────

  get _joyY() {
    const canvasRect = this.game?.canvas?.getBoundingClientRect()
    const statusRect = document.getElementById('status-bar')?.getBoundingClientRect()
    if (!canvasRect || !statusRect) return this.scale.height - 80
    const scaleY = this.scale.height / canvasRect.height
    return (statusRect.top - canvasRect.top) * scaleY - 60
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  init(data) {
    this.entryData = data || {}
    this._exiting  = false
    console.log(`[${this.scene.key}] init -- entryEdge: ${data?.entryEdge}`)
  }

  preload() {
    this.load.image('encounterPanelBG', '/assets/panelBG.png')
    this.load.image('darkStone',             'assets/darkStone.png')
    this.load.image('championSheet_armored',   'assets/champions/champions-with-kit.png')
    this.load.image('championSheet_unarmored', 'assets/champions/champions-no-kit.png')
    this.load.json('championAtlas',            'assets/champions/champions0.json')
    this.load.image('slot_equipped',       'assets/moonTile.png')
    this.load.image('slot_inventory',      'assets/moonTile.png')
    this.load.image('panel_stone',         'assets/log1.png')
    this.load.image('item_leather_armor',  'assets/inventory/A_Armour02.png')
    this.load.image('item_simple_bow',     'assets/inventory/W_Bow02.png')
    this.load.image('item_healing_potion', 'assets/inventory/P_Blue04.png')
    this.load.image('item_arrows',         'assets/inventory/W_Bow17.png')
    this.load.image('glowCursor',          'assets/glowCursor.png')
    this.load.audio('creak1',            'assets/sounds/creak1.wav')
    this.load.audio('arrowShoot1',       'assets/sounds/arrowShoot1.wav')
    this.load.audio('arrowShoot2',       'assets/sounds/arrowShoot2.wav')
    this.load.audio('arrowShoot3',       'assets/sounds/arrowShoot3.wav')
    this.load.audio('pumpkin_break_01',  'assets/sounds/pumpkin_break_01.ogg')
    this.load.audio('parrySound',        'assets/sounds/parry.mp3')
    this.load.image('oryxTiles',    '/assets/oryx/oryx_16bit_fantasy_world_trans.png')
    this.load.image('fogTexture',   '/assets/bg0.png')
    this.load.json('oryxCatalogue', '/assets/oryx/oryxCatalogue.json')
    this.load.image('oryxItems',    '/assets/oryx/oryx_16bit_fantasy_items_trans.png')

    const key = this.getMapKey()
    this._mapCacheKey = 'perspMap_' + key
    this.load.json(this._mapCacheKey, this.getMapPath())
  }

  async create() {
    this.mapData = this.cache.json.get(this._mapCacheKey)
    if (!this.mapData) {
      console.error(`[${this.scene.key}] Map not found: ${this.getMapPath()}`)
      return
    }
    window._phaserAudioContext = this.sound.context

    await this._loadContent()

    this.lights.enable()
    this.lights.setAmbientColor(this.getAmbient())

    this.usePerspective = true
    this.drawTilemap()

    const elevConfig = this.getElevationConfig()
    // If the map ships an explicit per-tile elevationGrid (e.g. generated river
    // banks), PGR loads it directly — do NOT also spin up an ElevationRenderer,
    // which would overwrite _elev via GID matching and re-introduce stray faces.
    if (this.mapData.hasCliffs && this.perspectiveGround && elevConfig
        && !this.mapData.elevationGrid) {
      this.elevationRenderer = new ElevationRenderer(this.perspectiveGround, elevConfig)
    }
    if (this.perspectiveGround) {
      this.perspectiveGround.setBuildings(this.mapData.buildings || [])
    }
    this.mapData.tiles           = this.mapData.layers[0]
    this.mapData.unwalkableTiles = []

    if (!this.mapData.spawns) this.mapData.spawns = {
      player: { x: Math.floor(this.mapData.width / 2), y: Math.floor(this.mapData.height / 2) }
    }
    if (!this.mapData.exits) this.mapData.exits = {}

    this._createInputUI()
    this.initializeLocation()
    this._createPlayerUI()

    if (this.perspectiveGround) {
      this.perspectiveGround.setPlayer(this.player)
      this.perspectiveGround.prewarmBillboardTints(this.mapData)
    }

    if (this._pendingFlags?.length && this.perspectiveGround) {
      this.perspectiveGround.setEncounterFlags(this._pendingFlags)
      this._pendingFlags = []
    }

    this.itemSheet  = new ItemSheetHelper(this)
    this.walkGrid   = this._buildWalkGrid()
    this.fovSystem  = new FovSystem(this.walkGrid)
    this.pathFinder = new PathFinder(this.walkGrid, null)

    this.cameras.main.centerOn(this.player.logicalX, this.player.logicalY)
    this.cameras.main.startFollow(this._camProxy, true, 0.1, 0.1)
    // Extend south bound by one screen height so the camera can follow the
    // player to the last map row without Phaser stopping it half a screen early.
    // The update() clamp below prevents it going further than the map edge.
    this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight + this.scale.height)

    this._lastFovKey = null
    this._recomputeFov()
    this._setupTapToPath()

    const champion = this.registry.get('selectedChampion') || window.selectedChampion
    const _cid = champion?.id ?? champion?.nameGa ?? champion?.spriteKey
    if (_cid) GameState.init(_cid)
    GameState.setVisited(this.scene.key)

    this.applyEntryPosition()

    const pl = this.getPlayerLight()
    this.playerLight = this.lights.addLight(
      this.player.logicalX, this.player.logicalY, pl.radius || 300
    ).setIntensity(pl.intensity || 2.0).setColor(pl.color || 0xfff2cc)

    this.getWisps().forEach(w => {
      this.lights.addLight(
        this.mapWidth * w.rx, this.mapHeight * w.ry,
        w.radius || 180, w.color || 0x99ff99, w.intensity || 0.6
      )
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

  update(time, delta) {
    // ElevationRenderer must run before PGR so _elev is current
    if (this.elevationRenderer) this.elevationRenderer.update(this.mapData)
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

    if (this.fogRenderer  && this.fovSystem) this.fogRenderer.update(this.fovSystem)
    if (this.playerLight  && this.player)    this.playerLight.setPosition(this.player.logicalX, this.player.logicalY)
    if (this.bowMechanics)                   this.bowMechanics.update(delta)

    // ── South camera clamp ────────────────────────────────────────────────
    // Pin the bottom edge of the last map row to the bottom of the screen.
    // PGR computes the exact scrollY using the perspective formula so the
    // south tile edge lands precisely at screen bottom — no gap, no overshoot.
    if (this.cameras?.main && this.perspectiveGround && this.mapData) {
      const _cam   = this.cameras.main
      const _zoom  = _cam.zoom || 1
      const _pgr   = this.perspectiveGround
      const _mapH  = this.mapData.height  // tile rows
      const _ts    = this.tileSize
      const _sh    = this.scale.height
      const _FL    = _pgr.constructor.FOCAL_LENGTH
      const _groundH = _pgr._groundH?.() ?? (_sh * (1 - _pgr.constructor.HORIZON_Y_FRAC))
      const _horizPx = _pgr._horizonPx?.() ?? (_sh * _pgr.constructor.HORIZON_Y_FRAC)
      const _camOff  = _pgr._cameraRowOffset ?? _pgr.constructor.CAMERA_ROW_OFFSET

      // Solve: _rowToScreenY(mapH) == sh
      // sh = horizonPx + groundH * FL / (FL + d)  where d = camRow - mapH
      // => d = FL * groundH / (sh - horizonPx) - FL
      // => camRow = mapH + d
      // => scrollY = (camRow - camOffset) * tileSize - sh / (2 * zoom)
      const _denom = _sh - _horizPx
      if (_denom > 0) {
        const _d      = _FL * _groundH / _denom - _FL
        const _camRow = _mapH + _d
        const _maxSY  = (_camRow - _camOff) * _ts - _sh / (2 * _zoom)
        if (_cam.scrollY > _maxSY) _cam.scrollY = _maxSY
      }
      if (_cam.scrollY < 0) _cam.scrollY = 0
    }
  }

  shutdown() {
    if (this._encounterPanel)   { this._encounterPanel.destroy();  this._encounterPanel  = null }
    if (this._moonWidget)       { this._moonWidget.destroy();      this._moonWidget      = null }
    if (this._menuHub)          { this._menuHub.destroy();         this._menuHub         = null }
    if (this._easca)            { this._easca.destroy();           this._easca           = null }
    if (this.joystick)          { this.joystick.destroy();         this.joystick         = null }
    if (this._menuPreview?.parentNode) {
      this._menuPreview.parentNode.removeChild(this._menuPreview)
      this._menuPreview = null
    }
    if (this._swallows)         { this._swallows.stop();                this._swallows        = null }
    if (this.elevationRenderer) { this.elevationRenderer.destroy();     this.elevationRenderer = null }
    if (this.perspectiveGround) { this.perspectiveGround.destroy();     this.perspectiveGround = null }
    if (this.fogRenderer)       { this.fogRenderer.destroy();           this.fogRenderer      = null }
    if (this.itemSheet)         { this.itemSheet.clear();               this.itemSheet        = null }
    if (this.bowMechanics)      { this.bowMechanics.destroy();          this.bowMechanics     = null }
    if (this._statusBar?.parentNode) {
      this._statusBar.parentNode.removeChild(this._statusBar)
      this._statusBar = null
    }
    this.fovSystem  = null
    this.pathFinder = null
    if (this.terrainManager?.damageTimer) {
      this.terrainManager.damageTimer.remove()
      this.terrainManager.damageTimer = null
    }
    this._clearBoatPath?.()
    if (this.boatSystem) {
      this.boatSystem._pathForce = 0
      this.boatSystem._pathAngle = 0
      this.boatSystem._pathTargetX = null
      this.boatSystem._pathTargetY = null
    }
    this.lights.destroy()
    if (super.shutdown) super.shutdown()
  }

  // ── Input UI ──────────────────────────────────────────────────────────────

  _createInputUI() {
    this._easca = new Easca3(this, (text) => {
      console.log('[Labhair] Player said:', text)
    })

    this._menuHub = createGameMenuHub({
      onInventoryOpen:  () => { this.time.delayedCall(50, () => this.worldMenu?.open()); if (this.player) this.player.canMove = false },
      onInventoryClose: () => {
        if (this.worldMenu?.itemDetailPanel?.isVisible) {
          this.worldMenu.itemDetailPanel.hide()
          this.worldMenu.inventoryGrid.show()
        } else {
          if (this.worldMenu?.isOpen) this._closeWorldMenuSilently()
          if (this.player) this.player.canMove = true
        }
      },
      onLabhairtOpen:  () => this._easca?.showKeyboard(),
      onLabhairtClose: () => this._easca?.hideKeyboard(),
    })

    const existingPreview = document.getElementById('menu-preview-overlay')
    if (existingPreview) existingPreview.parentNode?.removeChild(existingPreview)
    this._menuPreview = document.createElement('div')
    this._menuPreview.id = 'menu-preview-overlay'
    this._menuPreview.style.cssText = [
      'position:fixed;inset:0;',
      'background:rgba(8,6,2,0.6);',
      'z-index:1000001;pointer-events:none;',
      'opacity:0;transition:opacity 0.3s ease;',
    ].join('')
    document.body.appendChild(this._menuPreview)

    this._statusBar = createStatusBar(document.getElementById('gameContainer'))

    const canvas     = this.game.canvas
    const canvasRect = canvas.getBoundingClientRect()
    const scaleY     = this.scale.height / canvasRect.height
    const statusRect = this._statusBar?.getBoundingClientRect()
    const statusTop  = statusRect
      ? (statusRect.top - canvasRect.top) * scaleY
      : this.scale.height - 42

    this.joystick = new Joystick(this, {
      x: this.scale.width / 2,
      y: statusTop - 60,
      radius: 60,
      onTap: () => this._onJoystickTap(),
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
      onSwipe: (dx) => {
        this._moonWidget?.nudgePhase(dx)
        const now = performance.now()
        if (!this._lastMoonSwipe || now - this._lastMoonSwipe > 80) {
          this._lastMoonSwipe = now
          SoundBoard.playWeb('MOON_SWIPE', this)
        }
      },
    })

    this._moonWidget = createMoonWidget({
      initialPhase:   GameSettings.englishOpacity,
      embeddedCanvas: this.joystick.getMoonCanvas(),
      embeddedRadius: this.joystick.getMoonRadius(),
      swipeRange:     150,
      onChange: (phase) => {
        GameSettings.setEnglishOpacity(phase)
        if (this.textPanel) this.textPanel.updateEnglishOpacity()
        if (this.worldMenu?.itemDetailPanel) this.worldMenu.itemDetailPanel.updateLanguageOpacity()
        if (this._encounterPanel) this._encounterPanel.updateLanguageOpacity()
      },
    })
  }

  _createPlayerUI() {
    this.worldMenu = new WorldMenu(this, {
      player: this.player,
      onClose: () => {
        if (this._menuHub?.isOpen()) this._menuHub.close()
        this._lastMenuClose = Date.now()
      }
    })
    this._encounterPanel = new EncounterPanel(this, this._moonWidget)
  }

  _onJoystickTap() {
    const now = Date.now()
    if (now - (this._lastJoyTap || 0) < 700) return
    this._lastJoyTap = now
    if (this._encounterPanel?._card?.id === 'disembark') {
      this._encounterPanel.clearNotify()
      this._disembarkBadgeShown = false
      return
    }
    if (this._encounterPanel?._card) { this._encounterPanel._openPanel(); return }
    if (this._menuHub?.isOpen())     { this._menuHub.close();             return }
  }

  _closeWorldMenuSilently() {
    if (!this.worldMenu) return
    this.worldMenu.close()
    this._lastMenuClose = Date.now()
  }

  // ── Tap to path ───────────────────────────────────────────────────────────

  _setupTapToPath() {
    const canvas = this.game.canvas
    canvas.addEventListener('pointerdown', (e) => {
      const rect    = canvas.getBoundingClientRect()
      const scaleX  = canvas.width  / rect.width
      const scaleY  = canvas.height / rect.height
      const canvasX = (e.clientX - rect.left) * scaleX
      const canvasY = (e.clientY - rect.top)  * scaleY

      const joyX = this.scale.width / 2, joyY = this._joyY, joyR = 100
      if ((canvasX-joyX)**2 + (canvasY-joyY)**2 < joyR*joyR) return

      if (this.textPanel?.isVisible)                        return
      if (this._menuHub?.isOpen() || this.worldMenu?.isOpen) return
      if (!this.perspectiveGround)                          return
      if (this._bowAiming)                                  return

      if (this._onTapBeforePath?.(canvasX, canvasY) === false) return

      const tile = PathFinder.screenToTile(canvasX, canvasY, this.perspectiveGround, this.tileSize)
      if (!tile) return

      const fromTX = Math.floor(this.player.logicalX / this.tileSize)
      const fromTY = Math.floor(this.player.logicalY / this.tileSize)
      const path   = this.pathFinder.findPath(fromTX, fromTY, tile.tx, tile.ty)
      if (path.length > 0) {
        this.player.setPath(path)
        this._flashTargetTile(tile.tx, tile.ty)
      }
    })
  }

  _onTapBeforePath(canvasX, canvasY) { return true }

  _flashTargetTile(tx, ty) {
    SoundBoard.playWeb('TAP_TO_PATH', this.sound?.context)
    if (!this.perspectiveGround) return
    const ts       = this.tileSize
    const snapProj = this.perspectiveGround._projectLogical(tx * ts + ts / 2, ty * ts + ts / 2)
    if (!snapProj) return
    if (this._tapMarker) { this._tapMarker.destroy(); this._tapMarker = null }
    const g = this.add.graphics().setScrollFactor(0).setDepth(15)
    this._tapMarker = g
    const { screenX: cx, screenY: cy, scale } = snapProj
    const r = Math.round(ts * scale * 0.5)
    let alpha = 0.85, s = 0.3
    const ev = this.time.addEvent({
      delay: 16, repeat: 18,
      callback: () => {
        g.clear(); s = Math.min(1, s + 0.05); alpha = Math.max(0, alpha - 0.045)
        const sq = scale ? Math.min(0.45, scale * 0.8) : 0.35
        g.lineStyle(2, 0xffd700, alpha); g.strokeEllipse(cx, cy, r*s*2, r*s*sq*2)
        g.lineStyle(1, 0xffffff, alpha*0.5); g.strokeEllipse(cx, cy, r*s*1.2, r*s*sq*1.2)
        if (alpha <= 0) { g.destroy(); this._tapMarker = null; ev.remove() }
      }
    })
  }

  // ── FOV ───────────────────────────────────────────────────────────────────

  _recomputeFov() {
    if (!this.fovSystem || !this.player) return
    const tx = Math.floor(this.player.logicalX / this.tileSize)
    const ty = Math.floor(this.player.logicalY / this.tileSize)
    this.fovSystem.compute(tx, ty)
    if (this.fogRenderer) this.fogRenderer.update(this.fovSystem)
  }

  // ── Walk grid ─────────────────────────────────────────────────────────────

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

  isColliding(x, y) {
    const tx = Math.floor(x / this.tileSize)
    const ty = Math.floor(y / this.tileSize)
    if (ty < 0 || ty >= this.mapData.height || tx < 0 || tx >= this.mapData.width) return true
    const extra = this.getExtraUnwalkableGIDs()
    const g0 = this.mapData.layers[0]?.[ty]?.[tx]
    if (ALWAYS_UNWALKABLE.has(g0) || extra.has(g0)) return true
    const g1 = this.mapData.layers[1]?.[ty]?.[tx]
    if (g1 && (ALWAYS_UNWALKABLE.has(g1) || extra.has(g1))) return true
    const W = this.mapData.width, H = this.mapData.height
    const border = this.mapData.border
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

  // ── Tilemap ───────────────────────────────────────────────────────────────

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
      if (this._swallows) { this._swallows.stop(); this._swallows = null }
      document.getElementById('swallow-canvas')?.remove()
      console.log('[swallows] usesSwallows:', this.usesSwallows?.(), this.scene.key)
      if (this.usesSwallows?.() !== false) {
        this._swallows = new SwallowSystem(() => PerspectiveGroundRenderer.HORIZON_Y_FRAC, this.scene.key)
        this._swallows.start()
      }
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

  // ── Entry / exits ─────────────────────────────────────────────────────────

  applyEntryPosition() {
    const edge = this.entryData?.entryEdge
    if (!edge || !this.mapData.entries) return
    const entry = this.mapData.entries[edge]
    if (!entry) return

    const sourceY = this.entryData.sourceTile?.y
    const sourceH = this.entryData.sourceHeight || this.mapData.height
    const destH   = this.mapData.height
    const destW   = this.mapData.width

    let entryY = entry.yFromSource && sourceY != null
      ? Math.max(1, Math.min(destH - 2, Math.round(sourceY / sourceH * destH)))
      : (entry.y ?? Math.floor(destH / 2))
    const entryX = Math.max(1, Math.min(destW - 2, entry.x ?? Math.floor(destW / 2)))
    const px = entryX * this.tileSize + this.tileSize / 2
    const py = entryY * this.tileSize + this.tileSize / 2

    if (this.player) {
      this.player.logicalX = this.player.targetX = this.player.startX = px
      this.player.logicalY = this.player.targetY = this.player.startY = py
    }
    const cam = this.cameras.main
    cam.centerOn(px, py)
    cam.fadeIn(180, 0, 0, 0)
    import('../../ui/sceneTransition.js').then(m => m.transitionIn(180))
    this.time.delayedCall(180, () => cam.startFollow(this._camProxy, true, 0.1, 0.1))
    console.log(`[${this.scene.key}] entry via ${edge} -- tile [${entryX}, ${entryY}]`)
  }

  checkExits() {
    if (!this.mapData?.exits || this._exiting) return
    if (this.terrainManager?.damageTimer) {
      this.terrainManager.damageTimer.remove()
      this.terrainManager.damageTimer = null
    }
    if (this.entryData?.arrivedAt && Date.now() - this.entryData.arrivedAt < 900) return
    const tileX = Math.floor(this.player.logicalX / this.tileSize)
    const tileY = Math.floor(this.player.logicalY / this.tileSize)
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
    const T = this.tileSize
    const px = this.player.logicalX, py = this.player.logicalY
    const sourceTileX = Math.floor(px / T), sourceTileY = Math.floor(py / T)
    const WALK = T * 3, DUR = 320
    const tx = px + (dir === 'east' ? WALK : dir === 'west' ? -WALK : 0)
    const ty = py + (dir === 'south' ? WALK : dir === 'north' ? -WALK : 0)
    this.player.isMoving = true
    this.tweens.add({
      targets: this.player, logicalX: tx, logicalY: ty, duration: DUR, ease: 'Sine.easeIn',
      onUpdate:   () => { this.player.targetX = this.player.logicalX; this.player.targetY = this.player.logicalY },
      onComplete: () => {
        this.player.isMoving = false
        this.cameras.main.fadeOut(180, 0, 0, 0)
        import('../../ui/sceneTransition.js').then(m => m.transitionOut(180))
        this.time.delayedCall(200, () => {
          this.scene.start(exitData.destination, {
            entryEdge: exitData.entryPoint,
            sourceTile: { x: sourceTileX, y: sourceTileY },
            sourceHeight: this.mapData.height,
            sourceWidth:  this.mapData.width,
            entryDir: dir,
          })
        })
      }
    })
  }

  // ── Intro narrative ───────────────────────────────────────────────────────

  showIntroNarrative() {
    const champion = this.registry.get('selectedChampion') || window.selectedChampion
    if (!champion) return
    const seenKey = `${this.scene.key}_intro_${champion.id}`
    if (localStorage.getItem(seenKey)) return
    const narrative = this.mapData.introNarrative
    if (!narrative?.length) return
    this.narrativeInProgress = true
    this.narrativeQueue = [...narrative]
    this.time.delayedCall(30000, () => {
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
        irish: entry.ga || entry.irish || '', english: entry.en || entry.english || '',
        type: 'dialogue',
        onDismiss: () => this.time.delayedCall(300, showNext)
      })
    }
    showNext()
  }

  // ── Debug ─────────────────────────────────────────────────────────────────

  _drawExitDebug() {
    if (!window._devExits || !this.mapData?.exits) return
    const T = this.tileSize
    const COLOURS = { north: 0x00ffff, south: 0xff8800, west: 0xffff00, east: 0xff00ff }
    for (const [dir, exitData] of Object.entries(this.mapData.exits)) {
      const col = COLOURS[dir] ?? 0xffffff
      exitData.tiles.forEach(([tx, ty]) => {
        this.add.rectangle(tx*T+T/2, ty*T+T/2, T-2, T-2, col, 0.45).setDepth(200)
        this.add.text(tx*T+2, ty*T+2, exitData.destination, { fontSize:'9px', fontFamily:'monospace', color:'#ffffff' }).setDepth(201)
      })
    }
  }
}


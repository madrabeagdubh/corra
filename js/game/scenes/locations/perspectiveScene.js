// perspectiveScene.js
// Location: js/game/scenes/locations/perspectiveScene.js
//
// ── IMPORTANT: shutdown() wiring ───────────────────────────────────────────────
// Phaser dispatches 'shutdown' as an EVENT through this.events/this.sys.events
// -- it does NOT automatically invoke a plain method literally named
// shutdown() on a Scene subclass just because one exists (confirmed via
// Phaser's own docs: Scenes.Events.SHUTDOWN is "dispatched... Listen to it
// from a Scene using this.events.on('shutdown', listener)"). The shutdown()
// method below was very likely NEVER firing on its own in any scene that
// extends this class -- confirmed directly in a test scene (built on this
// same base) where no "shutdown() called" log ever appeared during a real
// scene.start() transition, which in turn caused a scene-specific overlay
// (a separate DOM canvas layered above PGR) to persist visually into the
// next scene because its own destroy() call -- made from inside shutdown()
// -- never ran.
//
// Fixed by also wiring the same cleanup through the real event, registered
// once in create(). The shutdown() method itself is left unchanged as a
// fallback in case anything elsewhere explicitly calls it directly.
//
// ── ForestEffects + wallMask collision (this pass) ────────────────────────────
// ForestEffects (rendered trees) and real tree collision (wallMask) are now
// wired at THIS shared level, not duplicated per subclass -- both RiverScene
// and BogScene (and anything else extending this class) get them for free.
// Guarded on this.mapData?.wallMask existing, so unmigrated maps (no
// wallMask) are completely unaffected -- no behaviour change, no extra
// canvas, no console spam.
//
// IMPORTANT: RiverScene previously had its OWN separate ForestEffects
// wiring (added before this was known to be needed at the shared level).
// That must be removed from riverScene.js now that it's here, or
// RiverScene (which extends BogScene which extends this class) will
// construct ForestEffects TWICE -- two overlapping canvases, duplicate
// trunks.
//
// ── Player occlusion fade now also considers trees ───────────────────────────
// See _updatePlayerOcclusionFade() below. Trunks now draw on PGR's _gCtx
// (same canvas cliffs use), which means the player (fixed on the higher
// _oCtx) always draws over any tree regardless of true depth -- correct
// when the player is genuinely in front of a tree, but with no counterpart
// for when the player should be HIDDEN behind one. Extended the existing
// terrain-occlusion fade (originally hills/cliffs only) to also treat any
// trunk a few rows south of the player, roughly in their own column, as
// occluding -- capping alpha at a flat 0.5 rather than a continuous
// per-pixel fade, since a tree canopy's shape makes pixel-precise overlap
// harder to justify than it is for terrain height, and a flat, recognisable
// dimming reads as "you're behind something" without looking like a
// rendering glitch.

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
import ForestEffects         from '../../effects/forestEffects.js'

// Above the conversation card, which sits around 2000.
const PROMPT_EASCA_DEPTH = 100000

window.GameState = GameState

const TW = 24, TH = 24, MG = 24, SHEET_COLS = 54, SCALE = 2

const ALWAYS_UNWALKABLE = new Set([
  1634, 1688, 740,
  228, 231, 233, 234, 235, 236, 226, 229, 230, 232, 242, 243,
  217, 218, 219,
  120, 121, 122, 123, 124, 125, 126, 127,
  128, 129, 130, 131, 132, 133, 134, 135,
])

export default class PerspectiveScene extends BaseLocationScene {

  getMapKey()              { return 'unnamed_map' }
  getMapPath()             { return `/maps/bogMaps/${this.getMapKey()}.json?v=${Date.now()}` }
  // Mirrors getMapPath()'s own default convention -- override alongside
  // getMapPath() if a subclass uses a different folder (e.g. testForest's
  // /maps/forest/). Used only for the north-preview neighbour fetch below.
  getNeighborMapPath(key)  { return `/maps/bogMaps/${key}.json?v=${Date.now()}` }
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
    this._registerDoorZones()

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

    // Rendered trees for any map migrated from dense Oryx tree stamps to
    // sparse wallMask-driven trunks (see tools/map-editor/migrate_oryx_trees.mjs).
    // Guarded on wallMask existing -- unmigrated maps get no ForestEffects
    // instance at all, so this is a pure no-op for them.
   this.forestEffects = new ForestEffects(this, this.getForestEffectsOptions())
    this.perspectiveGround.setForestEffects(this.forestEffects)

    // North-direction map preview (see PerspectiveGroundRenderer's
    // setNorthNeighbor/_drawNorthPreviewRow and ForestEffects'
    // setNorthNeighborWallMask) -- fetches just the north neighbour's
    // ground/height/tree data, not its NPCs/objects/content, so the
    // renderer can show a fading glimpse of what lies beyond the current
    // map's north edge. Purely visual: no collision, no interactivity.
    // Fire-and-forget -- if there's no north exit, or the fetch fails,
    // this silently does nothing and the renderer's existing flat-fill
    // fallback is unaffected.
    const _northDest = this.mapData.exits?.north?.destination
    if (_northDest) {
      fetch(this.getNeighborMapPath(_northDest))
        .then(r => r.ok ? r.json() : null)
        .then(neighborMapData => {
          if (!neighborMapData || !this.perspectiveGround) return
          // The preview was drawing the neighbour's raw column numbers as
          // if they lined up with THIS map's own columns -- true only by
          // coincidence. What actually needs to line up is: standing on
          // THIS map's own north-exit corridor and looking north should
          // show the neighbour's actual arrival point (its entries.south)
          // dead ahead, not whatever its column N happens to contain.
          // b1's exit corridor is x~17; b0's entries.south.x is 27 -- an
          // uncorrected 10-column gap, which is exactly "buildings appear
          // off to the left" when standing at the real crossing point.
          const exitTiles = this.mapData.exits?.north?.tiles
          const exitCenterX = exitTiles?.length
            ? exitTiles.reduce((sum, t) => sum + t[0], 0) / exitTiles.length
            : 0
          const neighborEntryX = neighborMapData.entries?.south?.x ?? exitCenterX
          const columnOffset = neighborEntryX - exitCenterX
          console.log(`[${this.scene.key}] north neighbour '${_northDest}' loaded --`,
            neighborMapData.width + 'x' + neighborMapData.height,
            'heightMap:', !!neighborMapData.heightMap,
            'columnOffset:', columnOffset)
          this.perspectiveGround.setNorthNeighbor({
            layer0:    neighborMapData.layers?.[0] ?? null,
            heightMap: neighborMapData.heightMap ?? null,
            pathDist:  neighborMapData.pathDist  ?? null,
            width:     neighborMapData.width,
            height:    neighborMapData.height,
            houses:    neighborMapData.houses ?? [],
            columnOffset,
          })
          // A neighbour whose wallMask is NOT trees (b0's is its palisade
          // ring) opts out with previewTrunks: false in its map JSON.
          // Trunks are baked with THIS scene's ForestEffects options, not
          // the neighbour's, so b0's bare-post overrides never applied and
          // the palisade came through as a ring of full oaks.
          this.forestEffects?.setNorthNeighborWallMask(
            neighborMapData.previewTrunks === false
              ? null
              : (neighborMapData.wallMask ?? null),
            neighborMapData.height
          )
        })
        .catch(e => console.warn(`[${this.scene.key}] north neighbour preview fetch failed:`, e.message))
    

} else if (this.perspectiveGround && (this.hasNorthFallback?.() ?? true)) {
      // No real north neighbour at all (world edge, e.g. a1/c1/d1) --
      // synthesize a plain flat "open fields" placeholder so the edge
      // fades into more world rather than stopping dead. Flattened to
      // match the CURRENT map's own row-0 vertex heights (repeated for
      // every row) so there's no jarring cliff right at the boundary.
      // Placeholder only -- Ribo intends to swap in actual wall/hedgerow
      // art here later, at which point this synthetic fallback can be
      // replaced or layered with that.
      const _fw = this.mapData.width
      const _fh = Math.max(PerspectiveGroundRenderer.NORTH_PREVIEW_DEPTH + 2, 20)
      const _edgeHeightRow = this.mapData.heightMap?.[0] ?? new Array(_fw + 1).fill(0)
      const _fields = {
        layer0: Array.from({ length: _fh }, (_, y) =>
          Array.from({ length: _fw }, (_, x) => (x + y) % 2 === 0 ? 839 : 840)),
        heightMap: Array.from({ length: _fh + 1 }, () => [..._edgeHeightRow]),
        width: _fw, height: _fh,
      }
      this.perspectiveGround.setNorthNeighbor(_fields)
      this.forestEffects?.setNorthNeighborWallMask(null, _fh)
    }

    this.showIntroNarrative()
    this.onEnter()

    // FIX: wire shutdown cleanup to the REAL Phaser shutdown event. See
    // header comment for why -- shutdown() below was very likely never
    // firing on its own. .once() so it can only fire one time per instance.
    this.events.once('shutdown', () => {
      console.log(`[${this.scene.key}] real Phaser shutdown EVENT fired -- running cleanup`)
      this.shutdown()
    })

    console.log(`[${this.scene.key}] ready -- ${this.mapData.width}x${this.mapData.height}`)
    transitionIn()
    this._drawExitDebug()
  }

  update(time, delta) {
    if (this.elevationRenderer) this.elevationRenderer.update(this.mapData)


if (this.perspectiveGround) this.perspectiveGround.update()
if (this.forestEffects) this.forestEffects.update()

this._updatePlayerOcclusionFade()
this._updateCameraTerrainAvoidance()
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

    if (this.cameras?.main && this.perspectiveGround && this.mapData) {
      const _cam   = this.cameras.main
      const _zoom  = _cam.zoom || 1
      const _pgr   = this.perspectiveGround
      const _mapH  = this.mapData.height
      const _ts    = this.tileSize
      const _sh    = this.scale.height
      const _FL    = _pgr.constructor.FOCAL_LENGTH
      const _groundH = _pgr._groundH?.() ?? (_sh * (1 - _pgr.constructor.HORIZON_Y_FRAC))
      const _horizPx = _pgr._horizonPx?.() ?? (_sh * _pgr.constructor.HORIZON_Y_FRAC)
      const _camOff  = _pgr._cameraRowOffset ?? _pgr.constructor.CAMERA_ROW_OFFSET

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


// ── Adaptive player fade: hide the player when terrain would occlude them ──
  // v3: camera repositioning (v1/v2) could never actually fix this, because
  // the player sprite and ground terrain are drawn on two SEPARATE DOM
  // canvases (_gCtx for ground, _oCtx for objects/player) stacked via fixed
  // CSS z-index -- the object canvas ALWAYS renders on top of the ground
  // canvas, at any camera angle, regardless of geometry. No amount of
  // camera math could change that hard compositing rule. This version uses
  // the same sightline-severity detection as before, but fades the player
  // sprite's own opacity (pgr._playerOcclusionAlpha, read by
  // _drawPlayerAnimated) instead of moving the camera -- directly hiding
  // the symptom rather than trying to prevent a geometric overlap that
  // was never actually the cause.
// ── Adaptive player fade: hide the player when terrain would occlude them ──
  // v4: v3 used a fixed world-space column window (playerCol ± 4) as a
  // proxy for "in front of the player on screen" -- but perspective means
  // a tile a few columns away can land almost anywhere on screen depending
  // on distance, so that heuristic was firing for hills nowhere near the
  // player's actual screen position (confirmed via screenshot: fade
  // triggered with no visible overlap at all). This version instead
  // projects each candidate tile to its REAL screen X (via the same
  // _colToScreenX the renderer itself uses) and only counts it as
  // occluding if that screen X genuinely falls within the player's own
  // on-screen width -- a true screen-space check, not a world-space guess.
  //
  // v5: trunks now draw on PGR's _gCtx (same canvas as terrain/cliffs),
  // which means the player -- always on the higher _oCtx -- now
  // unconditionally draws over any tree regardless of true depth. Correct
  // when the player is genuinely standing in front of a tree, but with no
  // counterpart for when a tree should be hiding the player. Added a
  // second check alongside the existing terrain scan: any trunk whose
  // REAL rendered screen silhouette (via ForestEffects.getTrunkScreenBounds,
  // mirroring drawTrunk()'s own geometry) overlaps the player's actual
  // screen position is treated as occluding, capping alpha at a flat 0.5
  // rather than blending continuously like the terrain case -- a tree
  // canopy's shape doesn't lend itself to the same pixel-precise partial-
  // overlap math terrain height does, so a flat, recognisable dim reads as
  // "you're behind something" without looking like a glitch. (An earlier
  // version of this check used coarse tile-space proximity instead of a
  // real screen-space test -- it flagged occlusion whenever a tree was
  // roughly nearby, not when it actually covered the player on screen;
  // replaced after that was visibly wrong in play.)
  _updatePlayerOcclusionFade() {
    const pgr = this.perspectiveGround
    if (!pgr) return
    // Two independent elevation systems can put terrain in front of the
    // player: _heightMapSrc (continuous vertex heightmap, rolling hills)
    // and _elev (ElevationRenderer's cliff/plateau grid, e.g. our new
    // estuary headland). This used to check _heightMapSrc alone, so on
    // any map using ONLY cliff-based elevation (no heightMap at all --
    // true for d3_sea), this bailed out immediately and the player never
    // faded behind cliffs no matter how solid the wall geometry was.
    if ((!pgr._heightMapSrc && !pgr._elev) || !this.player) { pgr._playerOcclusionAlpha = 1; pgr._playerOcclusionCropPx = 0; return }

    const ts = this.tileSize
    const playerCol = Math.floor(this.player.logicalX / ts)
    const playerRow = Math.floor(this.player.logicalY / ts)
    const camRow = pgr._perspCamRow()
    const playerScreenY = pgr.playerScreenY ?? pgr._rowToScreenY(playerRow + 1)
    const playerScreenX = pgr.playerScreenX ?? pgr._colToScreenX(playerCol + 0.5, playerRow + 1)

    // Half-width the occluder's screen X must fall within to count as
    // actually covering the player -- based on the player's own current
    // on-screen size, with a little slack (1.3x) since a hill doesn't
    // need to align PERFECTLY to visually clip the sprite's edge.
    const playerScaleAtRow = pgr._scaleAtRow(playerRow + 1)
    const playerHalfWidthPx = (playerScaleAtRow > 0 ? playerScaleAtRow : ts) * 0.65

    let worstHillOverlapPx  = 0   // from _heightMapSrc -- existing continuous fade-to-fully-invisible behaviour, unchanged
    let worstCliffOverlapPx = 0   // from _elev -- new; capped translucent like trees, see below
    if (playerScreenY != null && playerScreenX != null) {
      const LOOKAHEAD = 14
      const COL_SPREAD = 6   // widened since we now filter properly by real screen X, not relying on this to be tight
      for (let r = playerRow + 1; r < Math.min(camRow, playerRow + 1 + LOOKAHEAD); r++) {
        for (let dc = -COL_SPREAD; dc <= COL_SPREAD; dc++) {
          const col = playerCol + dc
          // Water tiles must read as flat here, matching the core
          // renderer's own rule (confirmed at its ground-drawing call
          // site: `_bIsWater ? 0 : this._tileHeightAt(...)`). The
          // continuous heightmap is a smooth surface that exists
          // EVERYWHERE, including under water -- water/land is a
          // separate GID-threshold decision layered on top (see the
          // map generator), so a water tile can have real nonzero
          // underlying height despite rendering perfectly flat.
          // _tileHeightAt itself has no water awareness at all -- it
          // just averages raw vertices -- so this scan was finding
          // phantom, invisible elevation under water and triggering
          // occlusion with nothing visibly there to cause it. Confirmed
          // directly: "sometimes the player and boat are obscured while
          // in the water."
          const _gid0 = this.mapData.tiles?.[r]?.[col]
          const _isWaterTile = _gid0 === 1625 || _gid0 === 1679 || _gid0 === 731
          const hHill  = _isWaterTile ? 0 : pgr._tileHeightAt(col, r)
          const hCliff = _isWaterTile ? 0 : (pgr._elev?.[r]?.[col] ?? 0)
          if (hHill <= 0 && hCliff <= 0) continue

          const occluderScreenX = pgr._colToScreenX(col + 0.5, r + 1)
          if (occluderScreenX == null) continue
          if (Math.abs(occluderScreenX - playerScreenX) > playerHalfWidthPx) continue   // real screen-space filter -- not actually in front of the player

          // Anchor at the tile's NORTH edge (row r, not r+1) -- the
          // side facing the player, the side that visually "rises into
          // view" first as they approach from the channel.
          //
          // REVERTED from a fully-flat (zero-height) version tried
          // here: that broke occlusion completely rather than just
          // shifting its timing. Proof: a tile south of the player
          // (r > playerRow) is geometrically closer to the camera, so
          // its FLAT projection is ALWAYS a larger screen-Y (lower on
          // screen) than the player's own position -- never smaller.
          // The only way a south tile can ever visually sit "above" the
          // player at all is its elevation pushing its projected top
          // edge upward past the player's position. That upward push
          // IS the entire mechanism; removing it makes overlapPx
          // provably negative for every south tile, always, so
          // worstOverlapPx (initialised to 0) never budges -- confirmed
          // directly: occlusion stopped happening at all. Restored to
          // the tile's own north-edge vertex height (smaller than the
          // tile's south edge or average, but still real) as the
          // working baseline while a better fix is worked out.
          const baseY = pgr._rowToScreenY(r)
          const scale = pgr._scaleAtRow(r)
          if (baseY == null || !(scale > 0)) continue

          if (hHill > 0) {
            const northEdgeH = (pgr._vertexH(col, r) + pgr._vertexH(col + 1, r)) / 2
            const overlapPx = playerScreenY - (baseY - northEdgeH * scale)
            if (overlapPx > worstHillOverlapPx) worstHillOverlapPx = overlapPx
          }
          if (hCliff > 0) {
            const overlapPx = playerScreenY - (baseY - hCliff * scale)
            if (overlapPx > worstCliffOverlapPx) worstCliffOverlapPx = overlapPx
          }
        }
      }
    }

    // Terrain occlusion (hills via _heightMapSrc + cliffs via _elev),
    // now UNIFIED and handled via TRUE PER-PIXEL CROPPING rather than a
    // whole-sprite alpha fade. The boolean alpha-fade approach (still
    // used for trees below, unchanged) reads fine once fully hidden,
    // but while only PARTIALLY behind a rising hill, an all-or-nothing
    // opacity switch can't show "half behind, half in front" -- it's
    // either translucent while still geometrically in front (reading as
    // ghostly, "sailing onto the hilltop") or fully opaque with no
    // depth cue at all. True cropping removes exactly the portion of
    // the sprite that's behind the terrain and lets the ALREADY-DRAWN
    // ground show through underneath -- the SAME technique the existing
    // water-sink mechanic already uses for wading (see _drawPlayerAnimated's
    // own _sink/_cropH), just driven by terrain overlap instead of water
    // depth. Capped short of 100% (TERRAIN_CROP_CAP) so a sliver always
    // remains once occlusion would otherwise erase the whole sprite --
    // at that point cropping stops and the translucent whole-sprite
    // treatment (already confirmed working well for "fully obscured")
    // takes over instead, so the player never vanishes as a position
    // marker.
    const playerH = pgr.playerSpriteH ?? (ts * 2)
    const EASE = 0.25
    const rawTerrainOverlapPx = Math.max(worstHillOverlapPx, worstCliffOverlapPx)
    // Threshold (as a fraction of the player's own sprite height) at
    // which we stop cropping and switch to the translucent WHOLE-sprite
    // treatment instead. Per direct feedback ("when fully occluded...
    // translucent player, included/unoccluded... so user never loses
    // sight of their avatar for long"): once fully hidden, show the
    // ENTIRE sprite (crop=0) at reduced alpha, like a ghost seen through
    // the hill -- NOT a capped sliver of the sprite at reduced alpha,
    // which was the previous behaviour and was too small/easy to miss
    // (often just the top of the head) to register as "the player,
    // translucent" at all.
    const TERRAIN_CROP_CAP = 0.6
    const cropCapPx = playerH * TERRAIN_CROP_CAP
    // REMOVED the grace offset that used to live here. In hindsight, the
    // original "should look like that, but ~2 tiles later" request was
    // very likely describing the BOTTOM-ANCHOR bug (head appearing to
    // sink into the ground at the player's own feet), not a genuine
    // request to delay when occlusion starts -- the grace offset
    // "fixed" that symptom by shifting the whole effect later, without
    // touching the actual cause. Now that the anchor itself is fixed
    // (head fixed at its normal position, bottom recedes to match the
    // coastline instead of the player's own feet -- see
    // pgrPlayerBoat.js), keeping the grace offset on top just adds an
    // unnecessary extra delay on a bug that no longer exists -- which
    // is exactly what "sails through the first two tiles, occluded two
    // tiles too late" describes. Removed so occlusion begins at its
    // natural trigger point again, matching the ORIGINAL, first request
    // ("should begin exactly where the edge meets the water") without
    // an artificial delay stacked on top of it.
    const terrainOverlapPx = rawTerrainOverlapPx
    const terrainFullyOccluded = terrainOverlapPx >= cropCapPx
    const terrainCropPxTarget = terrainFullyOccluded
      ? 0
      : Math.min(terrainOverlapPx, cropCapPx)
    // Ease crop toward its target, but ONLY when the change is a real
    // discontinuous jump (the fullyOccluded ternary above snapping the
    // target to exactly 0), not during ordinary continuous tracking.
    //
    // Reasoning for the jump-smoothing itself: crop's target has a
    // genuine discontinuity built in -- until this was added, that jump
    // was assigned directly/instantly, while alpha eased toward ITS new
    // target over several frames. That mismatch meant crop snapped to 0
    // (whole sprite restored) the same frame occlusion began, while
    // alpha hadn't faded yet -- a visible "pop" back to completely
    // normal right before fading translucent (and the same mismatch in
    // reverse exiting full occlusion). Confirmed via frame-by-frame
    // video review.
    //
    // BUT applying that easing UNCONDITIONALLY (every frame, not just at
    // the jump) turned out to reintroduce a smaller version of the
    // ORIGINAL lag bug: even a 0.5 rate means each frame only closes
    // half the gap to a target that's itself moving every frame during
    // the normal approach, compounding into a real fractional-tile delay
    // -- confirmed directly: occlusion now "about half a tile later than
    // it should be." Fixed by only easing when the jump is large enough
    // to be the actual discontinuity (a full jump to/from 0 happens in a
    // single frame; ordinary continuous movement, even fast, doesn't
    // produce anywhere near that big a per-frame change) -- otherwise
    // the target is tracked directly, with zero added lag.
    const CROP_EASE = 0.5
    const JUMP_THRESHOLD = cropCapPx * 0.3
    const curCropPx = pgr._playerOcclusionCropPx ?? 0
    const cropDelta = terrainCropPxTarget - curCropPx
    pgr._playerOcclusionCropPx = Math.abs(cropDelta) > JUMP_THRESHOLD
      ? curCropPx + cropDelta * CROP_EASE
      : terrainCropPxTarget

    // Trees: precise screen-space overlap test now, matching the terrain
    // check above -- NOT the coarse tile-proximity check this had at
    // first, which flagged the player as occluded whenever a tree was
    // roughly nearby in tile-space, regardless of whether it actually
    // covered the player on screen (confirmed: player was visibly fading
    // with no tree actually overlapping them). getTrunkScreenBounds()
    // mirrors drawTrunk()'s own geometry exactly (shared helper), so this
    // checks against the tree's REAL rendered silhouette. Left as a pure
    // alpha-fade, not cropping -- a trunk is a thin vertical obstruction,
    // not a flat ground surface the player sinks behind, so a partial
    // per-pixel crop doesn't read as sensibly here as it does for
    // terrain; unchanged from before.
    let treeOccluding = false
    if (this.forestEffects) {
      const TREE_LOOKAHEAD = 8   // generous row range -- the screen check itself is the real filter
      for (let r = playerRow + 1; r < playerRow + 1 + TREE_LOOKAHEAD && !treeOccluding; r++) {
        const trunks = this.forestEffects.getTrunksForRow(r)
        for (const trunk of trunks) {
          const bounds = this.forestEffects.getTrunkScreenBounds(trunk, pgr)
          if (!bounds) continue
          if (Math.abs(bounds.screenX - playerScreenX) > bounds.capRadius) continue
          if (playerScreenY > bounds.footY || playerScreenY < bounds.topY) continue
          treeOccluding = true
          break
        }
      }
    }

    const targetAlpha = Math.min(
      terrainFullyOccluded ? 0.5 : 1,
      treeOccluding         ? 0.5 : 1
    )

    const cur = pgr._playerOcclusionAlpha ?? 1
    pgr._playerOcclusionAlpha = cur + (targetAlpha - cur) * EASE
  }


// ── Camera terrain avoidance ──────────────────────────────────────────────
  // Raises/steepens the camera when tall terrain sits between the player
  // and the camera (the "camera passes through the hill" break in
  // solidity). Resurrects the earlier adaptive-camera infrastructure
  // (pgr._horizonYFrac / pgr._cameraRowOffset instance overrides), but
  // with a corrected detection: rather than comparing occluder screen
  // positions against the player (the old, wrong question), it simply
  // measures the max terrain height in the band of rows SOUTH of the
  // player (toward the camera), relative to the player's own ground
  // height. Measuring relative to the player's row rather than the
  // camera's row avoids a feedback loop -- adjusting CAMERA_ROW_OFFSET
  // moves the camera row itself, so a camera-row-relative measurement
  // would chase its own adjustments.
  _updateCameraTerrainAvoidance() {
    const pgr = this.perspectiveGround
    if (!pgr?._heightMapSrc || !this.player) return

    const base = this.getPGRConfig()
    const ts = this.tileSize
    const mapW = this.mapData?.width ?? 0
    const mapH = this.mapData?.height ?? 0
    const playerCol = Math.floor(this.player.logicalX / ts)
    const playerRow = Math.floor(this.player.logicalY / ts)
    const playerH = pgr._tileHeightAt(playerCol, playerRow)

    // Max terrain height in the band south of the player (between player
    // and camera), across columns near screen centre.
    const BAND_START = 2    // rows south of player where the band begins
    const BAND_ROWS  = 9    // how deep the band reaches toward the camera
    const COL_SPREAD = 5
    let maxForegroundH = 0
    for (let r = playerRow + BAND_START; r <= Math.min(mapH - 1, playerRow + BAND_START + BAND_ROWS); r++) {
      for (let dc = -COL_SPREAD; dc <= COL_SPREAD; dc++) {
        const c = playerCol + dc
        if (c < 0 || c >= mapW) continue
        const h = pgr._tileHeightAt(c, r)
        if (h > maxForegroundH) maxForegroundH = h
      }
    }

    // Severity: how far foreground terrain rises above the player's own
    // ground level, past a comfortable clearance. 0 = no adjustment
    // needed, 1 = maximum response.
    const CLEARANCE = 0.6   // height units of foreground rise tolerated before reacting
    const RANGE     = 2.0   // rise beyond clearance that maps to full response
    const foregroundSeverity = Math.max(0, Math.min(1, (maxForegroundH - playerH - CLEARANCE) / RANGE))

    // Second, independent contribution: the PLAYER'S OWN elevation.
    // The camera follows the player's flat/unelevated world position
    // (_camProxy.setPosition uses player.logicalX/logicalY directly,
    // confirmed in baseLocationScene.js -- it has no idea the player
    // might be standing on a tall hill). The foreground check above
    // only reacts when terrain AHEAD is taller than the player -- if
    // the player is standing on elevated ground themselves, looking
    // down their OWN gentle downslope (foreground height <= playerH),
    // that check stays at 0 regardless of how high the player actually
    // stands, and the render row-range cutoff (computed from that same
    // flat-assumption camera position) can end up clipping the near
    // portion of the very hill the player is standing on, since it
    // never gets the extra "room" a standing-elevation would need.
    // This adds that missing case: react to the player's own height
    // directly, independent of what's around them.
    const SELF_ELEV_RANGE = 3.0
    const selfSeverity = Math.max(0, Math.min(1, (playerH - CLEARANCE) / SELF_ELEV_RANGE))

    const severity = Math.max(foregroundSeverity, selfSeverity)

    const HORIZON_MIN    = 0.10
    const CAMOFF_MAX_ADD = 10.0
    const targetHorizon = base.HORIZON_Y_FRAC - (base.HORIZON_Y_FRAC - HORIZON_MIN) * severity
    const targetCamOff  = base.CAMERA_ROW_OFFSET + CAMOFF_MAX_ADD * severity

    const cur    = pgr._horizonYFrac    ?? base.HORIZON_Y_FRAC
    const curOff = pgr._cameraRowOffset ?? base.CAMERA_ROW_OFFSET

    // Asymmetric ease: react quickly when terrain looms, relax slowly --
    // avoids visible hunting near the threshold.
    const risingEase  = 0.15
    const fallingEase = 0.04
    const horizonEase = targetHorizon < cur    ? risingEase : fallingEase
    const camOffEase  = targetCamOff  > curOff ? risingEase : fallingEase

    pgr._horizonYFrac    = cur    + (targetHorizon - cur)    * horizonEase
    pgr._cameraRowOffset = curOff + (targetCamOff  - curOff) * camOffEase
  }




  // Unchanged. Now also invoked via the real 'shutdown' event wired in
  // create() above. Harmless to call more than once (every branch is
  // null-guarded), so leaving it directly callable here too is safe.
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
    if (this.forestEffects)     { this.forestEffects.destroy();         this.forestEffects    = null }
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

  /**
   * Ask the player to type something, and call back with it once.
   *
   * `onDone` receives the string, or null if they closed the keyboard
   * without sending. Only one prompt can be outstanding; a second replaces
   * the first, which is the right behaviour for a UI where the only way to
   * ask twice is to have lost track of the first ask.
   */
  promptEasca(onDone) {
    if (!this._easca) { onDone?.(null); return }

    this._eascaPending = (text) => {
      this._eascaPending = null
      this._eascaRestoreDepth()
      onDone?.(text)
    }
   



try { this.joystick?.reset?.(); if (this.player) { this._eascaCanMove = this.player.canMove; this.player.canMove = false; this.player.isMoving = false; this.player.setPath?.([]) } } catch (e) {}
    this._easca.bottomInset = 102
    this._easca.showKeyboard()
    this._eascaLiftDepth()




	  // sendMessage() hides the keyboard itself, so `visible` going false with
    // a prompt still outstanding means the player backed out.
    this._eascaWatch?.remove()
    this._eascaWatch = this.time.addEvent({
      delay: 200,
      loop:  true,
      callback: () => {
        if (!this._eascaPending) { this._eascaWatch?.remove(); this._eascaWatch = null; return }
        if (this._easca?.visible) return
        const done = this._eascaPending
        this._eascaWatch?.remove(); this._eascaWatch = null
        done(null)
      },
    })
  }

  /** Every object Easca draws, so depth can be moved as a set. */
  _eascaObjects() {
    const e = this._easca
    if (!e) return []
    return [
      e.bgPanel, e.textZoneBg, e.textDisplay,
      ...(e.controlObjects || []),
      ...(e.letterObjects  || []),
    ].filter(Boolean)
  }

  _eascaLiftDepth() {
    if (this._eascaDepths) return                 // already lifted
    this._eascaDepths = new Map()
    // ADD to each object's depth rather than setting it. Flattening them to
    // one value threw away Easca's own layering -- panel, keys, text zone
    // and accent menu all became coplanar and fell back to insertion order,
    // which is why the keys went dark on dark.
    this._eascaObjects().forEach((o) => {
      try {
        const d = o.depth ?? 0
        this._eascaDepths.set(o, d)
        o.setDepth(d + PROMPT_EASCA_DEPTH)
      } catch (e) {}
    })
// The accent menu is built on demand, long after this runs, at
    // this.DEPTH + 4/5. Raising the base carries it up too.
    try {
      this._eascaBaseDepth = this._easca.DEPTH
      this._easca.DEPTH = (this._easca.DEPTH ?? 0) + PROMPT_EASCA_DEPTH
    } catch (e) {}
    // The moon hub is DOM, at a z-index no canvas object can reach. Hide it
    // rather than fight it -- the same reason the d-pad goes away for a
    // conversation, and nothing needs translating while typing a name.
    try {
      const hub = document.getElementById('dpad-moon-hub')
      if (hub) {
        this._eascaHubDisplay = hub.style.display
        hub.style.display = 'none'
      }
    } catch (e) {}
  }

  _eascaRestoreDepth() {
    if (this._eascaDepths) {
      this._eascaDepths.forEach((d, o) => { try { o.setDepth(d) } catch (e) {} })
      this._eascaDepths = null
    }
    try {
      const hub = document.getElementById('dpad-moon-hub')
      if (hub) hub.style.display = this._eascaHubDisplay ?? ''
      this._eascaHubDisplay = undefined
    } catch (e) {}
try {
      if (this._eascaBaseDepth !== undefined) {
        this._easca.DEPTH = this._eascaBaseDepth
        this._eascaBaseDepth = undefined
      }
    } catch (e) {}
	  try { if (this._easca) this._easca.bottomInset = 0 } catch (e) {}
    try { if (this.player && this._eascaCanMove !== undefined) { this.player.canMove = this._eascaCanMove; this._eascaCanMove = undefined } } catch (e) {}
  }

  _createInputUI() {
    this._easca = new Easca3(this, (text) => {
      // A prompt is waiting for this one; the Labhair tab is not.
      if (this._eascaPending) { this._eascaPending(text); return }
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
    if (this._encounterPanel?._card?._isDoor) {
      this._triggerDoor(this._encounterPanel._card._door)
      return
    }
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
      if (this._eascaPending)                               return

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

  _recomputeFov() {
    if (!this.fovSystem || !this.player) return
    const tx = Math.floor(this.player.logicalX / this.tileSize)
    const ty = Math.floor(this.player.logicalY / this.tileSize)
    this.fovSystem.compute(tx, ty)
    if (this.fogRenderer) this.fogRenderer.update(this.fovSystem)
  }

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

    // Rendered-tree collision for maps migrated from Oryx tree stamps
    // (see tools/map-editor/migrate_oryx_trees.mjs). Absent on unmigrated
    // maps, so this is a no-op there. Added at THIS shared level (not
    // just RiverScene's override) so BogScene-based land maps also get
    // real tree collision, which they never had with the old decorative
    // Oryx trees.
    if (this.mapData?.wallMask?.[ty]?.[tx] >= 1) return true

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


// Max height GAIN (in heightMap units) allowed moving from one tile to
  // an adjacent one. Moving DOWN is never blocked by this -- only
  // climbing beyond this threshold is. Combined with terrain peaks/hills,
  // gradual gaussian tapers stay under this and are climbable; sharp
  // edges exceed it and become one-way drop-offs.
  static CLIMB_MAX_STEP = 0.6

  isSlopeBlocked(fromX, fromY, toX, toY) {
    const pgr = this.perspectiveGround
    if (!pgr?._heightMapSrc) return false   // no heightmap on this map -- nothing to check
    const ts = this.tileSize
    const fromCol = Math.floor(fromX / ts), fromRow = Math.floor(fromY / ts)
    const toCol   = Math.floor(toX   / ts), toRow   = Math.floor(toY   / ts)
    const fromH = pgr._tileHeightAt?.(fromCol, fromRow) ?? 0
    const toH   = pgr._tileHeightAt?.(toCol,   toRow)   ?? 0
    return (toH - fromH) > PerspectiveScene.CLIMB_MAX_STEP
  }




  drawTilemap() {
    if (!this.mapData?.layers) { console.error(`[${this.scene.key}] No layers`); return }
 this._applyPGRConfig()  
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

  applyEntryPosition() {
    const edge = this.entryData?.entryEdge
    if (!edge || !this.mapData.entries) return
    const entry = this.mapData.entries[edge]
    if (!entry) return

    const sourceY = this.entryData.sourceTile?.y
    const sourceX = this.entryData.sourceTile?.x
    const sourceH = this.entryData.sourceHeight || this.mapData.height
    const sourceW = this.entryData.sourceWidth  || this.mapData.width
    const destH   = this.mapData.height
    const destW   = this.mapData.width

    let entryY = entry.yFromSource && sourceY != null
      ? Math.max(1, Math.min(destH - 2, Math.round(sourceY / sourceH * destH)))
      : (entry.y ?? Math.floor(destH / 2))
    // xFromSource mirrors yFromSource -- needed now that north/south edges
    // can be fully open across their whole width (not just a narrow exit
    // slice near the middle), so a player crossing anywhere along that
    // edge needs to land at the CORRESPONDING point on the other side,
    // not be recentred to the map's middle column regardless of where
    // they actually crossed.
    let entryX = entry.xFromSource && sourceX != null
      ? Math.max(1, Math.min(destW - 2, Math.round(sourceX / sourceW * destW)))
      : Math.max(1, Math.min(destW - 2, entry.x ?? Math.floor(destW / 2)))
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

  // ── ForestEffects options hook ─────────────────────────────────────────
  // Default = the small overworld trees used across migrated bog/river maps.
  // Scenes wanting bigger/denser trees (e.g. the a4-d4 forest-threshold row)
  // override this and return their own options object.
  getForestEffectsOptions() {
    return {
      trunkKeepChance: 1.0,
      widthScale:  0.35,
      heightScale: 0.35,
      canopyHaze:  false,
      canopyFacetScale:  0.5,
      canopyLayerScale:  0.5,
      canopyRadiusScale: 0.55,
      branchScale: 0.4,
    }
  }

  _triggerExit(dir, exitData) {
    if (this._exiting) return
    // Destination scene not registered yet (e.g. a4's south exit before the
    // a5-d5 deep-forest maps are built): ignore the exit instead of
    // scene.start()ing into a crash + stuck black transition overlay.
    // Warn once per destination, not every frame the player stands there.
    if (!this.scene.manager.keys[exitData.destination]) {
      this._warnedMissingExits = this._warnedMissingExits || new Set()
      if (!this._warnedMissingExits.has(exitData.destination)) {
        this._warnedMissingExits.add(exitData.destination)
        console.warn(`[${this.scene.key}] exit destination '${exitData.destination}' is not a registered scene -- ignoring exit (map not built yet?)`)
      }
      return
    }
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

  static DOOR_RADIUS_TILES = 2.0
  static DOOR_VISUAL = { gid: 137, flat: false }

  _registerDoorZones() {
    this._doorZones = []
    const doors = this.mapData?.doors
    if (!doors?.length) return
    for (const d of doors) {
      const px = d.x * this.tileSize + this.tileSize / 2
      const py = d.y * this.tileSize + this.tileSize / 2
      const zone = this.add.zone(px, py, this.tileSize, this.tileSize)
      zone.setData('id', d.id)
      zone.setData('type', 'door')
      zone.setData('door', d)
      zone.setData('logicalX', px)
      zone.setData('logicalY', py)
      zone.x = px; zone.y = py
      this._doorZones.push(zone)
    }
  }

  _updateDoorProximity() {
    if (this._exiting || !this.player || !this._encounterPanel) return
    const zones = this._doorZones
    if (!zones?.length) return
    const px = this.player.logicalX, py = this.player.logicalY
    const R  = PerspectiveScene.DOOR_RADIUS_TILES * this.tileSize
    let nearest = null, nearestDist = Infinity
    for (const z of zones) {
      const dist = Phaser.Math.Distance.Between(px, py, z.getData('logicalX'), z.getData('logicalY'))
      if (dist < R && dist < nearestDist) { nearestDist = dist; nearest = z }
    }
    const panel = this._encounterPanel
    if (nearest) {
      const door   = nearest.getData('door')
      const cardId = 'door:' + door.id
      if ((!panel._card || panel._card._isDoor) && panel._card?.id !== cardId) {
        panel.notify({
          id:      cardId,
          visual:  door.visual || PerspectiveScene.DOOR_VISUAL,
          ga:      door.ga || 'An doras',
          en:      door.en || 'The door',
          _isDoor: true,
          _door:   door,
        }, nearest)
      }
      if (!panel._card || panel._card._isDoor) panel._openPanel = () => this._triggerDoor(door)
    } else if (panel._card?._isDoor) {
      panel.clearNotify()
    }
  }

  _triggerDoor(door) {
    if (!door || this._exiting) return
    this._exiting = true
    if (this.joystick) this.joystick.reset()
    if (this.player)   this.player.isMoving = false
    if (this._encounterPanel?._card?._isDoor) this._encounterPanel.clearNotify()
    console.log(`[${this.scene.key}] door -> ${door.destination} via ${door.entryEdge}`)
    this.cameras.main.fadeOut(220, 0, 0, 0)
    import('../../ui/sceneTransition.js').then(m => m.transitionOut(220))
    this.time.delayedCall(240, () => {
      this.scene.start(door.destination, {
        entryEdge: door.entryEdge,
        arrivedAt: Date.now(),
        fromDoor:  door.id,
      })
    })
  }

  checkProximityInteractions() {
    if (this._checkDoorProximity()) return
    super.checkProximityInteractions()
  }

  _checkDoorProximity() {
    if (this._exiting || !this.player || !this._encounterPanel) return false
    const zones = this._doorZones
    if (!zones?.length) return false
    const px = this.player.logicalX, py = this.player.logicalY
    const R  = PerspectiveScene.DOOR_RADIUS_TILES * this.tileSize
    let nearest = null, nearestDist = Infinity
    for (const z of zones) {
      const dist = Phaser.Math.Distance.Between(px, py, z.getData('logicalX'), z.getData('logicalY'))
      if (dist < R && dist < nearestDist) { nearestDist = dist; nearest = z }
    }
    if (!nearest) return false
    const door   = nearest.getData('door')
    const cardId = 'door:' + door.id
    this._flagInRange = true
    if (this._encounterPanel._card?.id !== cardId) {
      this._encounterPanel.notify({
        id:      cardId,
        visual:  door.visual || PerspectiveScene.DOOR_VISUAL,
        ga:      door.ga || 'An doras',
        en:      door.en || 'The door',
        _isDoor: true,
        _door:   door,
      }, nearest)
    }
    this._encounterPanel._openPanel = () => this._triggerDoor(door)
    return true
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




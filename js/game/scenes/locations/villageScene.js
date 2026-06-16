// villageScene.js
// Location: js/game/scenes/locations/villageScene.js
//
// Extends PerspectiveScene for village interiors.
// Suppresses outdoor features (sky, mountains, swallows, elevation, encounter deck).
// NPCs rendered directly onto PGR canvas via onPGRDrawComplete hook.

import PerspectiveScene from './perspectiveScene.js'
import PerspectiveGroundRenderer from '../../effects/perspectiveGroundRenderer.js'
import Phaser from 'phaser'

const NPC_SPRITES = ['poet', 'fearghus', 'sorcha']

export default class VillageScene extends PerspectiveScene {

  // ── Suppress outdoor features ─────────────────────────────────────────────
  getSkyImage()        { return null }
  getMountainImage()   { return null }
  getElevationConfig() { return null }
  usesSwallows()       { return false }

  // ── Interior defaults ─────────────────────────────────────────────────────
  getMapKey()      { return 'tavern' }
  getMapPath()     { return `/maps/village/${this.getMapKey()}.json?v=${Date.now()}` }
  getAmbient()     { return 0x3a2218 }
  getPlayerLight() { return { color: 0xffcc88, intensity: 1.6, radius: 220 } }
  getWisps()       { return [] }

  // ── Preload NPC sprites ───────────────────────────────────────────────────
  preload() {
    super.preload()
    NPC_SPRITES.forEach(key => {
      if (!this.textures.exists(`npc_${key}`)) {
        this.load.image(`npc_${key}`, `/assets/npcs/${key}.png`)
      }
    })
  }

  // ── PGR constants for interior rendering ─────────────────────────────────
  // Tuning:
  //   HORIZON_Y_FRAC    — fraction of screen above ground plane (0 = all floor)
  //   CAMERA_ROW_OFFSET — virtual camera distance above map (lower = closer/bigger)
  //   FOCAL_LENGTH      — perspective intensity (lower = flatter, less distortion)
  //   TILES_ACROSS      — tiles visible across screen width (lower = bigger tiles)
  //   PLAYER_SCALE      — player sprite height multiplier
  //   PLAYER_DIST_TILES — player distance from camera (lower = larger at all depths)
  static INTERIOR_PGR = {
    HORIZON_Y_FRAC:    0.02,
    CAMERA_ROW_OFFSET: 3.5,
    FOCAL_LENGTH:      4.5,
    TILES_ACROSS:      4.5,
  }

  _applyInteriorPGR() {
    this._savedPGR = {}
    for (const [k, v] of Object.entries(VillageScene.INTERIOR_PGR)) {
      this._savedPGR[k] = PerspectiveGroundRenderer[k]
      PerspectiveGroundRenderer[k] = v
    }
    this._savedPlayerScale      = PerspectiveGroundRenderer.PLAYER_SCALE
    this._savedPlayerDistTiles  = PerspectiveGroundRenderer.PLAYER_DIST_TILES
    PerspectiveGroundRenderer.PLAYER_SCALE      = 1
    PerspectiveGroundRenderer.PLAYER_DIST_TILES = 0.3
    console.log('[VillageScene] PGR interior constants applied')
  }

  _restoreInteriorPGR() {
    if (!this._savedPGR) return
    for (const [k, v] of Object.entries(this._savedPGR)) {
      PerspectiveGroundRenderer[k] = v
    }
    this._savedPGR = null
    if (this._savedPlayerScale != null) {
      PerspectiveGroundRenderer.PLAYER_SCALE      = this._savedPlayerScale
      PerspectiveGroundRenderer.PLAYER_DIST_TILES = this._savedPlayerDistTiles
      this._savedPlayerScale = null
    }
    console.log('[VillageScene] PGR constants restored')
  }

  // ── drawTilemap — SCALE=4 so interior map fills the phone screen ────────────
  // PerspectiveScene uses SCALE=2 (48px tiles). At 10 rows that's only 480px —
  // smaller than a phone screen, so the camera can't scroll and bottom rows are
  // unreachable. SCALE=4 (96px tiles, 960px map) gives the camera room to move.
  drawTilemap() {
    this._applyInteriorPGR()

    // Temporarily patch the module-level constants PerspectiveScene reads
    // by overriding tileSize/mapWidth/mapHeight after super.drawTilemap sets them.
    // We call super first (which sets tileSize=48), then immediately correct it.
    // PGR reads this.tileDisplaySize from tileSize at construction time.
    // So we must set the override BEFORE PGR is constructed inside super.drawTilemap.
    // 
    // Strategy: monkeypatch this.tileSize before super runs, restore after.
    const _origDraw = Object.getPrototypeOf(Object.getPrototypeOf(this)).drawTilemap
    if (_origDraw) {
      // Intercept tileSize assignment by overriding it temporarily
      const INTERIOR_SCALE = 4
      const TW = 24

      // Pre-set so PGR constructor picks it up
      Object.defineProperty(this, 'tileSize', {
        value: TW * INTERIOR_SCALE,
        writable: true, configurable: true
      })
      this.mapWidth  = this.mapData.width  * TW * INTERIOR_SCALE
      this.mapHeight = this.mapData.height * TW * INTERIOR_SCALE
    }

    super.drawTilemap()

    // Ensure tileSize stuck at 96 (super may have overwritten it)
    this.tileSize  = 96
    this.mapWidth  = this.mapData.width  * 96
    this.mapHeight = this.mapData.height * 96
    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight)
    this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight + this.scale.height)

    if (this.perspectiveGround) {
      this.perspectiveGround.tileDisplaySize = 96
      this.perspectiveGround._gcR = '#000000'
      this.perspectiveGround._groundColour = '#000000'
    }
    this._buildCeilingGradient()
  }

  // ── Ceiling gradient + black mask ─────────────────────────────────────────
  _buildCeilingGradient() {
    const container = this.game.canvas.parentNode
    if (container) container.style.background = '#000'

    document.getElementById('pgr-blackmask')?.remove()
    const mask = document.createElement('div')
    mask.id = 'pgr-blackmask'
    mask.style.cssText = [
      'position:absolute','top:0','left:0','right:0','bottom:0',
      'background:#000',
      'z-index:1',
      'pointer-events:none',
    ].join(';')
    if (container) container.insertBefore(mask, container.firstChild)

    document.getElementById('pgr-ceiling')?.remove()

    const sw = this.game.canvas.width
    const sh = this.game.canvas.height

    const c = document.createElement('canvas')
    c.id = 'pgr-ceiling'
    c.width  = sw
    c.height = sh
    c.style.cssText = [
      'position:absolute','top:0','left:0',
      'width:' + sw + 'px','height:' + sh + 'px',
      'z-index:5',
      'pointer-events:none',
    ].join(';')

    const ctx = c.getContext('2d')
    // Gradient extends to 65% of screen height — more gradual fade
    const gradH = sh * 0.65
    const grad  = ctx.createLinearGradient(0, 0, 0, gradH)
    grad.addColorStop(0,    'rgba(0,0,0,1)')
    grad.addColorStop(0.30, 'rgba(0,0,0,0.92)')
    grad.addColorStop(0.55, 'rgba(0,0,0,0.6)')
    grad.addColorStop(0.78, 'rgba(0,0,0,0.18)')
    grad.addColorStop(1,    'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, sw, gradH)

    const pgrLight = document.getElementById('pgr-light')
    if (pgrLight) container.insertBefore(c, pgrLight.nextSibling)
    else container.appendChild(c)

    this._ceilingCanvas = c
  }

  // ── No encounter deck ─────────────────────────────────────────────────────
  async _loadContent() {
    this.mapData.objects        = this.mapData.objects        || []
    this.mapData.npcs           = this.mapData.npcs           || []
    this.mapData.introNarrative = this.mapData.introNarrative || []
    console.log(`[${this.scene.key}] interior content --`,
      this.mapData.objects.length, 'objects,',
      this.mapData.npcs.length, 'npcs')
  }

  // ── createObjects ─────────────────────────────────────────────────────────
  createObjects() {
    super.createObjects()
    this._registerHarpZones()
  }

  // ── createNPCs — drawn directly onto PGR canvas ───────────────────────────
  createNPCs() {
    if (!this.mapData.npcs) return
    this.npcs     = []
    this._npcHits = []

    this.mapData.npcs.forEach(npcData => {
      const pixelX    = npcData.x * this.tileSize + this.tileSize / 2
      const pixelY    = npcData.y * this.tileSize + this.tileSize / 2
      const spriteKey = `npc_${npcData.sprite || npcData.id}`

      let imgCanvas = null
      if (this.textures.exists(spriteKey)) {
        try {
          const tex  = this.textures.get(spriteKey)
          const src  = tex.getSourceImage()
          const tc   = document.createElement('canvas')
          tc.width   = src.naturalWidth  || src.width
          tc.height  = src.naturalHeight || src.height
          const tctx = tc.getContext('2d')
          tctx.imageSmoothingEnabled = false
          tctx.drawImage(src, 0, 0)
          imgCanvas = tc
        } catch(e) {
          console.warn('[VillageScene] NPC canvas build failed:', e.message)
        }
      }

      this.npcs.push({
        id:            npcData.id,
        name:          npcData.name,
        dialogues:     npcData.dialogues || [],
        dialogueIndex: 0,
        logicalX:      pixelX,
        logicalY:      pixelY,
        imgCanvas,
        met:           false,
        screenX: 0, screenY: 0, screenW: 0, screenH: 0,
      })
    })

    this.onPGRDrawComplete = (ctx) => this._drawNPCsOnPGR(ctx)

    this._npcTapHandler = (e) => {
      const canvas = this.game.canvas
      const rect   = canvas.getBoundingClientRect()
      const scaleX = canvas.width  / rect.width
      const scaleY = canvas.height / rect.height
      const cx     = (e.clientX - rect.left) * scaleX
      const cy     = (e.clientY - rect.top)  * scaleY
      for (const npc of (this.npcs || [])) {
        const { screenX: sx, screenY: sy, screenW: sw, screenH: sh } = npc
        if (sw === 0) continue
        if (cx >= sx - sw/2 && cx <= sx + sw/2 && cy >= sy - sh && cy <= sy) {
          this._talkToNPCVillage(npc)
          break
        }
      }
    }
    this.game.canvas.addEventListener('pointerdown', this._npcTapHandler)

    console.log(`[${this.scene.key}] ${this.npcs.length} NPCs (PGR canvas mode)`)
  }

  // ── NPC size tuning ───────────────────────────────────────────────────────
  // NPC_HEIGHT_MULT: multiplier relative to player height at same depth.
  //   1.0 = same size as player, 2.0 = twice as tall, 0.5 = half.
  // NPC_ASPECT: width-to-height ratio of the sprite (narrower = more slender).
  static NPC_HEIGHT_MULT = 2.0
  static NPC_ASPECT      = 0.55

  _drawNPCsOnPGR(ctx) {
    if (!this.npcs?.length || !this.perspectiveGround) return
    const pgr = this.perspectiveGround
    const PGR = pgr.constructor

    for (const npc of this.npcs) {
      const proj = pgr._projectLogical(npc.logicalX, npc.logicalY)
      if (!proj) { npc.screenW = 0; continue }

      const { screenX, screenY, scale } = proj
      const scaledTileW = scale * pgr.tileDisplaySize

      const H = scaledTileW * PGR.PLAYER_SCALE * PGR.HEIGHT_MULTIPLIER * VillageScene.NPC_HEIGHT_MULT
      const W = H * VillageScene.NPC_ASPECT

      npc.screenX = screenX
      npc.screenY = screenY
      npc.screenW = W
      npc.screenH = H

      if (npc.imgCanvas) {
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(npc.imgCanvas,
          Math.round(screenX - W / 2),
          Math.round(screenY - H),
          Math.round(W), Math.round(H))
      } else {
        ctx.save()
        ctx.fillStyle = 'rgba(65,105,225,0.85)'
        ctx.beginPath()
        ctx.arc(screenX, screenY - H/2, W/2, 0, Math.PI*2)
        ctx.fill()
        ctx.restore()
      }

      if (npc.met) {
        ctx.save()
        ctx.font = '12px Georgia'
        const tw = ctx.measureText(npc.name).width
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fillRect(screenX - tw/2 - 4, screenY - H - 20, tw + 8, 18)
        ctx.fillStyle = '#e8dcc0'
        ctx.textAlign = 'center'
        ctx.fillText(npc.name, screenX, screenY - H - 6)
        ctx.restore()
      }
    }
  }

  _talkToNPCVillage(npc) {
    if (!npc.met) npc.met = true
    if (this.joystick) this.joystick.reset()
    if (this.player)   this.player.isMoving = false
    const dialogues = npc.dialogues
    const index     = npc.dialogueIndex || 0
    const dialogue  = dialogues[index]
    if (!dialogue) return
    this.textPanel?.show({
      irish:   dialogue.ga || '',
      english: dialogue.en || '',
      type: 'dialogue',
      speaker: npc.name,
      onDismiss: () => {
        npc.dialogueIndex = (index + 1) % dialogues.length
      }
    })
  }

  // ── Update — fix south camera clamp for small interior maps ──────────────
  update(time, delta) {
    super.update(time, delta)
    // Override PerspectiveScene south clamp for interiors.
    // With 96px tiles the map is 960px — larger than screen, camera can scroll freely.
    // Clamp so the south edge of the map aligns with the canvas bottom.
    if (this.cameras?.main && this.mapHeight) {
      const cam    = this.cameras.main
      const zoom   = cam.zoom || 1
      const sh     = this.scale.height
      const maxSY  = this.mapHeight - sh
      if (cam.scrollY > maxSY) cam.scrollY = maxSY
      if (cam.scrollY < 0)     cam.scrollY = 0
    }
  }

  // ── Collision ─────────────────────────────────────────────────────────────
  // INTERIOR_BLOCKING: GIDs in layer 1 that block movement.
  // Chairs (251) are intentionally excluded — remove from set to make anything passable.
  static INTERIOR_BLOCKING = new Set([
    201,   // barrel
    249,   // table
    250,   // table with papers
    252,   // throne
    253,   // weapons rack
    137,   // door — player exits via exit tile trigger, not by walking through
  ])

  isColliding(x, y) {
    const tx = Math.floor(x / this.tileSize)
    const ty = Math.floor(y / this.tileSize)

    // Block north wall row and above
    if (ty <= 1) return true

    // Block objects in layer 1
    const g1 = this.mapData?.layers?.[1]?.[ty]?.[tx]
    if (g1 && VillageScene.INTERIOR_BLOCKING.has(g1)) return true

    // Block NPC tiles
    if (this.npcs?.some(npc => {
      const nx = Math.floor(npc.logicalX / this.tileSize)
      const ny = Math.floor(npc.logicalY / this.tileSize)
      return nx === tx && ny === ty
    })) return true

    return super.isColliding(x, y)
  }

  // ── Proximity ─────────────────────────────────────────────────────────────
  checkProximityInteractions() {
    if (this.narrativeInProgress) return
    if (this.textPanel?.isVisible || this.textPanelCooldown) return

    const playerX = this.player.logicalX
    const playerY = this.player.logicalY
    const HARP_RADIUS = this.tileSize * 2.5

    let nearestHarp = null
    let nearestDist = Infinity

    this.interactables?.forEach(obj => {
      if (obj.getData('type') !== 'harp') return
      const objX = obj.getData('logicalX') ?? obj.x
      const objY = obj.getData('logicalY') ?? obj.y
      const dist = Phaser.Math.Distance.Between(playerX, playerY, objX, objY)
      if (dist < HARP_RADIUS && dist < nearestDist) {
        nearestDist = dist
        nearestHarp = obj
      }
    })

    if (nearestHarp) {
      this._flagInRange = true
      if (this._encounterPanel) {
        const text   = nearestHarp.getData('text')
        const id     = nearestHarp.getData('id')
        const visual = nearestHarp.getData('visual')
        this._pendingHarpZone = nearestHarp
        this._encounterPanel.notify(
          { id, visual, ga: text?.ga || '', en: text?.en || '', _isHarp: true },
          nearestHarp
        )
      }
      return
    }

    super.checkProximityInteractions()
  }

  // ── Harp zone registration ────────────────────────────────────────────────
  _registerHarpZones() {
    if (!this.mapData.objects) return
    this.mapData.objects.forEach(obj => {
      if (obj.type !== 'harp') return
      const pixelX = obj.x * this.tileSize + this.tileSize / 2
      const pixelY = obj.y * this.tileSize + this.tileSize / 2
      const zone = this.add.zone(pixelX, pixelY, this.tileSize * 2, this.tileSize * 2)
      zone.setData('id',       obj.id)
      zone.setData('type',     'harp')
      zone.setData('text',     obj.text)
      zone.setData('visual',   obj.visual || { gid: 255, flat: false })
      zone.setData('logicalX', pixelX)
      zone.setData('logicalY', pixelY)
      zone.x = pixelX
      zone.y = pixelY
      if (!this.interactables) this.interactables = []
      this.interactables.push(zone)
      console.log(`[${this.scene.key}] harp zone at [${obj.x}, ${obj.y}]`)
    })
  }

  // ── Harp overlay ──────────────────────────────────────────────────────────
  _openHarpOverlay() {
    if (this._harpOverlayEl) return
    if (this.joystick) this.joystick.reset()
    if (this.player)   this.player.isMoving = false

    const overlay = document.createElement('div')
    overlay.id = 'harp-overlay'
    overlay.style.cssText = [
      'position:fixed;inset:0;',
      'z-index:2000000;',
      'background:rgba(3,8,16,0.92);',
      'display:flex;flex-direction:column;',
      'align-items:center;justify-content:center;',
      'opacity:0;transition:opacity 0.4s ease;',
      'touch-action:none;',
    ].join('')

    const closeBtn = document.createElement('button')
    closeBtn.textContent = '✕'
    closeBtn.style.cssText = [
      'position:absolute;top:16px;right:20px;',
      'background:none;border:none;',
      'color:rgba(200,190,170,0.6);font-size:1.4rem;',
      'cursor:pointer;z-index:10;font-family:Georgia,serif;',
    ].join('')
    closeBtn.addEventListener('pointerdown', () => this._destroyHarpOverlay())
    overlay.appendChild(closeBtn)

    const label = document.createElement('div')
    label.textContent = 'Cláirseach'
    label.style.cssText = [
      'font-family:Georgia,serif;',
      'font-size:0.75rem;letter-spacing:0.18em;',
      'color:rgba(200,190,170,0.45);',
      'text-transform:uppercase;margin-bottom:24px;',
    ].join('')
    overlay.appendChild(label)

    const frame = document.createElement('iframe')
    frame.src = '/harp/corra-harp.html'
    frame.style.cssText = [
      'border:none;',
      'width:min(420px,100vw);',
      'height:min(820px,85vh);',
      'background:transparent;',
    ].join('')
    overlay.appendChild(frame)

    document.body.appendChild(overlay)
    this._harpOverlayEl = overlay
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { overlay.style.opacity = '1' })
    })
  }

  _destroyHarpOverlay() {
    const el = this._harpOverlayEl
    if (!el) return
    el.style.opacity = '0'
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el)
      if (this._harpOverlayEl === el) this._harpOverlayEl = null
    }, 400)
  }

  // ── Shutdown ──────────────────────────────────────────────────────────────
  shutdown() {
    this._destroyHarpOverlay()
    this._restoreInteriorPGR()
    document.getElementById('pgr-ceiling')?.remove()
    document.getElementById('pgr-blackmask')?.remove()
    this._ceilingCanvas = null
    const container = this.game?.canvas?.parentNode
    if (container) container.style.background = ''
    if (this._npcTapHandler) {
      this.game?.canvas?.removeEventListener('pointerdown', this._npcTapHandler)
      this._npcTapHandler = null
    }
    this.onPGRDrawComplete = null
    this.npcs = []
    super.shutdown()
  }
}


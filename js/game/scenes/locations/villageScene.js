// villageScene.js
// Location: js/game/scenes/locations/villageScene.js

import PerspectiveScene from './perspectiveScene.js'
import PerspectiveGroundRenderer from '../../effects/perspectiveGroundRenderer.js'
import Phaser from 'phaser'
import { CorraHarp } from './village/corraHarp.js'

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

  // ── PGR camera/perspective config ─────────────────────────────────────────
  // A complete, absolute config for interior scenes — layered on top of
  // BaseLocationScene's overworld baseline rather than mutating it. Applied
  // fresh on every entry (see drawTilemap -> _applyPGRConfig), so there is
  // nothing to save/restore on exit and no ordering dependency on shutdown().
  // Tuning knobs:
  //   HORIZON_Y_FRAC    — sky fraction (0.02 = near-zero, black void above)
  //   CAMERA_ROW_OFFSET — camera height above map (lower = closer/bigger tiles)
  //   FOCAL_LENGTH      — perspective intensity (lower = flatter)
  //   TILES_ACROSS      — tile count across screen (lower = bigger tiles)
  //   PLAYER_SCALE      — player sprite height
  //   PLAYER_DIST_TILES — player distance from camera (lower = larger at all depths)
  getPGRConfig() {
    return {
      ...super.getPGRConfig(),
      HORIZON_Y_FRAC:    0.02,
      CAMERA_ROW_OFFSET: 3.5,
      FOCAL_LENGTH:      4.5,
      TILES_ACROSS:      4.5,
      PLAYER_SCALE:      1,
      PLAYER_DIST_TILES: 0.3,
    }
  }

  // ── drawTilemap at SCALE=4 (96px tiles) ───────────────────────────────────
  // PGR hardcodes tileDisplaySize=48 in its constructor — we override it to 96
  // immediately after construction so all projection math uses the right size.
  drawTilemap() {
    if (!this.mapData?.layers) { console.error(`[${this.scene.key}] No layers`); return }

    this._applyPGRConfig()

    const TW = 24, TH = 24, MG = 24, SHEET_COLS = 54, SCALE = 4

    this.tileSize  = TW * SCALE   // 96px
    this.mapWidth  = this.mapData.width  * TW * SCALE
    this.mapHeight = this.mapData.height * TH * SCALE
    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight)

    this.usePerspective = true
    this.perspectiveGround = new PerspectiveGroundRenderer(this)
    this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight + this.scale.height)

    if (this.perspectiveGround) {
      this.perspectiveGround.tileDisplaySize = 96
      this.perspectiveGround._gcR = '#000000'
      this.perspectiveGround._groundColour = '#000000'
      // Register harp as a custom billboard tile (GID 9001)
      // Also add to _flatGids so PGR renders it as a billboard not a trapezoid
      this.perspectiveGround._flatGids.add(9001)
      // registerCustomTile loads async — retry badge draw once ready
      const _origRegister = this.perspectiveGround.registerCustomTile.bind(this.perspectiveGround)
      this.perspectiveGround.registerCustomTile = (gid, url) => {
        const _origCache = this.perspectiveGround._tileCache
        _origRegister(gid, url)
        // Poll until the tile canvas is available, then refresh badge
        const _retry = setInterval(() => {
          if (this.perspectiveGround?._tileCache?.get(gid)) {
            clearInterval(_retry)
            if (this._encounterPanel?._card?.visual?.gid === gid) {
              this._encounterPanel._showBadge(this._encounterPanel._card.visual)
            }
          }
        }, 100)
      }
      this.perspectiveGround.registerCustomTile(9001, '/assets/harp.png')
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
      'background:#000','z-index:1','pointer-events:none',
    ].join(';')
    if (container) container.insertBefore(mask, container.firstChild)

    document.getElementById('pgr-ceiling')?.remove()
    const sw = this.game.canvas.width
    const sh = this.game.canvas.height
    const c  = document.createElement('canvas')
    c.id = 'pgr-ceiling'
    c.width = sw; c.height = sh
    c.style.cssText = [
      'position:absolute','top:0','left:0',
      `width:${sw}px`,`height:${sh}px`,
      'z-index:5','pointer-events:none',
    ].join(';')
    const ctx  = c.getContext('2d')
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
  }

  // ── createObjects ─────────────────────────────────────────────────────────
  createObjects() {
    super.createObjects()
    this._registerHarpZones()
  }

  // ── createNPCs — drawn onto PGR canvas ────────────────────────────────────
  createNPCs() {
    if (!this.mapData.npcs) return
    this.npcs = []

    this.mapData.npcs.forEach(npcData => {
      const pixelX    = npcData.x * this.tileSize + this.tileSize / 2
      const pixelY    = npcData.y * this.tileSize + this.tileSize / 2
      const spriteKey = `npc_${npcData.sprite || npcData.id}`
      console.log('[VillageScene] NPC', npcData.id, 'spriteKey:', spriteKey, 'exists:', this.textures.exists(spriteKey))
      let imgCanvas   = null
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
      const npcZone = this.add.zone(pixelX, pixelY, this.tileSize, this.tileSize)
      npcZone.setData('id', npcData.id); npcZone.setData('type', 'npc')
      npcZone.setData('logicalX', pixelX); npcZone.setData('logicalY', pixelY)
      npcZone.x = pixelX; npcZone.y = pixelY
      this.npcs.push({
        id: npcData.id, name: npcData.name,
        dialogues: npcData.dialogues || [], dialogueIndex: 0,
        logicalX: pixelX, logicalY: pixelY,
        imgCanvas, met: false, zone: npcZone,
        triggerRadius: npcData.triggerRadius ?? null,
        screenX: 0, screenY: 0, screenW: 0, screenH: 0,
      })
    })

    this.onPGRDrawComplete = (ctx) => this._drawNPCsOnPGR(ctx)
  }

  // NPC_HEIGHT_MULT: size relative to player (2.0 = twice player height)
  // NPC_ASPECT: width/height ratio
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
      npc.screenX = screenX; npc.screenY = screenY
      npc.screenW = W;       npc.screenH = H
      if (npc.imgCanvas) {
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(npc.imgCanvas,
          Math.round(screenX - W/2), Math.round(screenY - H),
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
    const dialogue = npc.dialogues[npc.dialogueIndex || 0]
    if (!dialogue) return
    this.textPanel?.show({
      irish: dialogue.ga || '', english: dialogue.en || '',
      type: 'dialogue', speaker: npc.name,
      onDismiss: () => {
        npc.dialogueIndex = ((npc.dialogueIndex || 0) + 1) % npc.dialogues.length
      }
    })
  }

  // ── Collision ─────────────────────────────────────────────────────────────
  static INTERIOR_BLOCKING = new Set([
    201, 249, 250, 252, 253, 137,
  ])

  isColliding(x, y) {
    const tx = Math.floor(x / this.tileSize)
    const ty = Math.floor(y / this.tileSize)
    const mapH = this.mapData?.height ?? 14
    // Block north wall row and above, and south padding rows (row 10+)
    if (ty <= 1) return true
    if (ty >= 10) return true  // rows 10-13 are empty padding — impassable
    const g1 = this.mapData?.layers?.[1]?.[ty]?.[tx]
    if (g1 && VillageScene.INTERIOR_BLOCKING.has(g1)) return true
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
    const px = this.player.logicalX
    const py = this.player.logicalY

    const HARP_RADIUS = this.tileSize * 2.5
    const NPC_RADIUS  = this.tileSize * 1.8

    let nearestHarp = null, harpDist = Infinity
    this.interactables?.forEach(obj => {
      if (obj.getData('type') !== 'harp') return
      const d = Phaser.Math.Distance.Between(
        px, py, obj.getData('logicalX') ?? obj.x, obj.getData('logicalY') ?? obj.y)
      if (d < HARP_RADIUS && d < harpDist) { harpDist = d; nearestHarp = obj }
    })

    let nearestNPC = null, npcDist = Infinity
    ;(this.npcs || []).forEach(npc => {
      const r = npc.triggerRadius != null ? npc.triggerRadius * this.tileSize : NPC_RADIUS
      const d = Phaser.Math.Distance.Between(px, py, npc.logicalX, npc.logicalY)
      if (d < r && d < npcDist) { npcDist = d; nearestNPC = npc }
    })

    // Nearest in-range interactable claims the moon-tile badge (harp wins ties).
    if (nearestHarp && (!nearestNPC || harpDist <= npcDist)) {
      this._flagInRange = true
      this._showHarpBadge(nearestHarp)
      return
    }
    if (nearestNPC) {
      this._flagInRange = true
      this._showNPCBadge(nearestNPC)
      return
    }
    // Nothing in range: clear our own harp/NPC badge so it doesn't linger after
    // we step away (leave a door badge alone -- _updateDoorProximity owns that).
    if (this._encounterPanel?._card?._isHarp || this._encounterPanel?._card?._isNPC) {
      this._encounterPanel.clearNotify()
    }
    this._flagInRange = false
    super.checkProximityInteractions()
  }

  // Raise the harp badge on the moon tile; pressing it opens the harp overlay.
  _showHarpBadge(nearestHarp) {
    if (!this._encounterPanel) return
    const text   = nearestHarp.getData('text')
    const id     = nearestHarp.getData('id')
    const visual = nearestHarp.getData('visual')
    this._pendingHarpZone = nearestHarp
    this._encounterPanel._openPanel = () => {
      this._encounterPanel.clearNotify()
      this._openHarpOverlay()
    }
    this._encounterPanel.notify(
      { id, visual, ga: text?.ga || '', en: text?.en || '', _isHarp: true },
      nearestHarp)
    if (this.textures.exists('harp_sprite')) {
      const badge = this._encounterPanel._badgeEl
      if (badge) {
        const src = this.textures.get('harp_sprite').getSourceImage()
        const ctx = badge.getContext('2d')
        ctx.clearRect(0, 0, badge.width, badge.height)
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(src, 0, 0, badge.width, badge.height)
      }
    }
  }

  // Raise an NPC badge on the moon tile; pressing it opens that NPC's dialogue.
  // Replaces the old canvas-wide tap hit-test so dialogue is a deliberate press,
  // only available when the player is actually beside the NPC.
  _showNPCBadge(npc) {
    if (!this._encounterPanel) return
    this._encounterPanel._openPanel = () => {
      this._encounterPanel.clearNotify()
      this._talkToNPCVillage(npc)
    }
    this._encounterPanel.notify({
      id:     'npc:' + npc.id,
      visual: { gid: 255, flat: false },
      ga:     `Labhair le ${npc.name}`,
      en:     `Speak with ${npc.name}`,
      _isNPC: true,
      _npc:   npc,
    }, npc.zone || null)
    if (npc.imgCanvas) {
      const badge = this._encounterPanel._badgeEl
      if (badge) {
        const ctx = badge.getContext('2d')
        ctx.clearRect(0, 0, badge.width, badge.height)
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(npc.imgCanvas, 0, 0, badge.width, badge.height)
      }
    }
  }

  // ── Harp zones ────────────────────────────────────────────────────────────
  _registerHarpZones() {
    if (!this.mapData.objects) return
    this.mapData.objects.forEach(obj => {
      if (obj.type !== 'harp') return
      const pixelX = obj.x * this.tileSize + this.tileSize / 2
      const pixelY = obj.y * this.tileSize + this.tileSize / 2
      const zone = this.add.zone(pixelX, pixelY, this.tileSize * 2, this.tileSize * 2)
      zone.setData('id', obj.id).setData('type', 'harp')
        .setData('text', obj.text)
        .setData('visual', obj.visual || { gid: 255, flat: false })
        .setData('logicalX', pixelX).setData('logicalY', pixelY)
      zone.x = pixelX; zone.y = pixelY
      if (!this.interactables) this.interactables = []
      this.interactables.push(zone)
    })
  }

  // ── Harp overlay — powered by CorraHarp module ───────────────────────────
  _openHarpOverlay() {
    if (this._corraHarp?.isOpen) return
    this._corraHarp = new CorraHarp(this)
    this._corraHarp
      .on('pluck', ({ midi, stringIndex, velocity }) => {
        // Future: drive poem sequence, respond to melody
        console.log(`[CorraHarp] pluck: string ${stringIndex}, midi ${midi}, vel ${velocity.toFixed(2)}`)
      })
      .on('close', () => {
        this._corraHarp = null
      })
    this._corraHarp.open()
  }

  _destroyHarpOverlay() {
    this._corraHarp?.close()
  }

  // ── Shutdown ──────────────────────────────────────────────────────────────
  shutdown() {
    this._corraHarp?.close()
    this._corraHarp = null
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


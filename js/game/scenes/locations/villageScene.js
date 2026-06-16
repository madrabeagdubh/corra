// villageScene.js
// Location: js/game/scenes/locations/villageScene.js
//
// Extends PerspectiveScene for village interiors.
// Suppresses outdoor features (sky, mountains, swallows, elevation, encounter deck).
// Uses SCALE=4 tile rendering (vs outdoor SCALE=2) so the small interior map
// fills the screen naturally — no camera zoom, no UI scaling.
// NPCs rendered as perspective-correct sprites repositioned via PGR each frame.

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
  // Saved before overriding, restored on shutdown.
  // Interior: camera close to floor, minimal horizon, wider tile view.
  static INTERIOR_PGR = {
    HORIZON_Y_FRAC:    0.02,  // near-zero horizon — black void above
    CAMERA_ROW_OFFSET: 3.5,   // camera very close to the floor
    FOCAL_LENGTH:      4.5,   // flatter perspective reduces vertical stretch
    TILES_ACROSS:      4.5,   // fewer tiles across = wider apparent tiles
  }

  _applyInteriorPGR() {
    this._savedPGR = {}
    for (const [k, v] of Object.entries(VillageScene.INTERIOR_PGR)) {
      this._savedPGR[k] = PerspectiveGroundRenderer[k]
      PerspectiveGroundRenderer[k] = v
    }
    // Bigger player sprite — save and override
    this._savedPlayerScale  = PerspectiveGroundRenderer.PLAYER_SCALE
    this._savedPlayerDistTiles = PerspectiveGroundRenderer.PLAYER_DIST_TILES
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

  // ── drawTilemap — apply interior PGR before PGR is constructed ───────────
  drawTilemap() {
    this._applyInteriorPGR()
    super.drawTilemap()  // PGR constructed here, reads the overridden statics
    // Override PGR ground fill colour to black — prevents green bleed
    if (this.perspectiveGround) {
      this.perspectiveGround._gcR = '#000000'
      this.perspectiveGround._groundColour = '#000000'
    }
    this._buildCeilingGradient()
  }

  // Injects a DOM canvas above the PGR ground canvas that fades the top of
  // the back wall into blackness, and forces the background to pure black.
  _buildCeilingGradient() {
    const container = this.game.canvas.parentNode
    if (container) container.style.background = '#000'

    // Black mask behind everything — kills the green PGR ground bleed
    document.getElementById('pgr-blackmask')?.remove()
    const mask = document.createElement('div')
    mask.id = 'pgr-blackmask'
    mask.style.cssText = [
      'position:absolute','top:0','left:0','right:0','bottom:0',
      'background:#000',
      'z-index:1',          // below pgr-ground (z:2)
      'pointer-events:none',
    ].join(';')
    if (container) container.insertBefore(mask, container.firstChild)

    // Remove any stale ceiling canvas
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
      'z-index:5',          // above pgr-objects (z:3), below Phaser canvas (z:10)
      'pointer-events:none',
    ].join(';')

    const ctx = c.getContext('2d')
    // Gradient from solid black at top, fading to transparent ~40% down
    const grad = ctx.createLinearGradient(0, 0, 0, sh * 0.42)
    grad.addColorStop(0,    'rgba(0,0,0,1)')
    grad.addColorStop(0.55, 'rgba(0,0,0,0.85)')
    grad.addColorStop(0.80, 'rgba(0,0,0,0.3)')
    grad.addColorStop(1,    'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, sw, sh * 0.42)

    // Insert above pgr-light (z:4) so it sits just below Phaser canvas
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

  // ── createObjects — add harp zones on top of base ─────────────────────────
  createObjects() {
    super.createObjects()
    this._registerHarpZones()
  }

  // ── createNPCs — drawn directly onto PGR canvas via onPGRDrawComplete ──────
  // NPCs are not Phaser sprites — they're drawn in screen space alongside the
  // player each PGR frame, so they're perfectly anchored to the perspective.
  // Tap detection uses a hit-list of last-frame screen rects.
  createNPCs() {
    if (!this.mapData.npcs) return
    this.npcs      = []
    this._npcHits  = []   // [{id, x, y, w, h, npcData}] updated each draw

    this.mapData.npcs.forEach(npcData => {
      const pixelX    = npcData.x * this.tileSize + this.tileSize / 2
      const pixelY    = npcData.y * this.tileSize + this.tileSize / 2
      const spriteKey = `npc_${npcData.sprite || npcData.id}`

      // Build an offscreen canvas from the Phaser texture
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

      const npc = {
        id:            npcData.id,
        name:          npcData.name,
        dialogues:     npcData.dialogues || [],
        dialogueIndex: 0,
        logicalX:      pixelX,
        logicalY:      pixelY,
        imgCanvas,
        met:           false,
        // last drawn screen rect for tap detection
        screenX: 0, screenY: 0, screenW: 0, screenH: 0,
      }
      this.npcs.push(npc)
    })

    // Hook into PGR draw — called each frame with the object canvas ctx
    this.onPGRDrawComplete = (ctx) => this._drawNPCsOnPGR(ctx)

    // Tap detection on the Phaser canvas
    this._npcTapHandler = (e) => {
      const canvas  = this.game.canvas
      const rect    = canvas.getBoundingClientRect()
      const scaleX  = canvas.width  / rect.width
      const scaleY  = canvas.height / rect.height
      const cx      = (e.clientX - rect.left) * scaleX
      const cy      = (e.clientY - rect.top)  * scaleY
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

  // Drawn by PGR hook — same coordinate space as the player sprite
  _drawNPCsOnPGR(ctx) {
    if (!this.npcs?.length || !this.perspectiveGround) return
    const pgr  = this.perspectiveGround
    const PGR  = pgr.constructor

    for (const npc of this.npcs) {
      const proj = pgr._projectLogical(npc.logicalX, npc.logicalY)
      if (!proj) { npc.screenW = 0; continue }

      const { screenX, screenY, scale } = proj
      const scaledTileW = scale * pgr.tileDisplaySize

      // Match player formula exactly, doubled
      const H = scaledTileW * PGR.PLAYER_SCALE * PGR.HEIGHT_MULTIPLIER * 2
      const W = H * 0.55

      npc.screenX  = screenX
      npc.screenY  = screenY
      npc.screenW  = W
      npc.screenH  = H

      if (npc.imgCanvas) {
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(npc.imgCanvas,
          Math.round(screenX - W / 2),
          Math.round(screenY - H),
          Math.round(W), Math.round(H))
      } else {
        // Fallback coloured circle
        ctx.save()
        ctx.fillStyle = 'rgba(65,105,225,0.85)'
        ctx.beginPath()
        ctx.arc(screenX, screenY - H/2, W/2, 0, Math.PI*2)
        ctx.fill()
        ctx.restore()
      }

      // Name label if met
      if (npc.met) {
        ctx.save()
        ctx.font = '12px Georgia'
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        const tw = ctx.measureText(npc.name).width
        ctx.fillRect(screenX - tw/2 - 4, screenY - H - 20, tw + 8, 18)
        ctx.fillStyle = '#e8dcc0'
        ctx.textAlign = 'center'
        ctx.fillText(npc.name, screenX, screenY - H - 6)
        ctx.restore()
      }
    }
  }

  // Wraps talkToNPC — accepts plain npc data object (not Phaser sprite)
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

  update(time, delta) {
    super.update(time, delta)
  }

  // ── Collision — block north wall row and outer border ────────────────────
  isColliding(x, y) {
    const tx = Math.floor(x / this.tileSize)
    const ty = Math.floor(y / this.tileSize)

    // Hard block: north wall row (row 1) is behind the billboard wall
    if (ty <= 1) return true

    // Delegate everything else to PerspectiveScene
    return super.isColliding(x, y)
  }

  // ── Proximity — intercept harp before base handler ────────────────────────
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

  shutdown() {
    this._destroyHarpOverlay()
    this._restoreInteriorPGR()
    document.getElementById('pgr-ceiling')?.remove()
    document.getElementById('pgr-blackmask')?.remove()
    this._ceilingCanvas = null
    const container = this.game?.canvas?.parentNode
    if (container) container.style.background = ''  // restore for outdoor scenes
    if (this._npcTapHandler) {
      this.game?.canvas?.removeEventListener('pointerdown', this._npcTapHandler)
      this._npcTapHandler = null
    }
    this.onPGRDrawComplete = null
    this.npcs = []
    super.shutdown()
  }
}


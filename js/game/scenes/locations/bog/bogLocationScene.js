import Phaser from 'phaser'
import BaseLocationScene from '../baseLocationScene.js'

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

  // ── Override in child scenes ──────────────────────────────────────

  /** Basename of map JSON file in public/maps/bog/ */
  getMapKey()          { return 'great_open_bog' }
  getAmbient()         { return 0x334422 }
  getPlayerLight()     { return { color: 0xfff2cc, intensity: 2.0, radius: 300 } }
  getWisps()           { return [] }
  getMusicTrack()      { return null }
  getExtraUnwalkableGIDs() { return new Set() }
  onEnter()            {}

  // ── Lifecycle ─────────────────────────────────────────────────────

  init(data) {
    // Store transition data for use in create()
    this.entryData = data || {}
    console.log(`[${this.scene.key}] init — entryEdge: ${data?.entryEdge}`)
  }

  preload() {
    // Load champion and UI assets (replicated from BaseLocationScene to avoid
    // BaseLocationScene attempting to load our map from the wrong path)
    this.load.image('championSheet_armored', 'assets/champions/champions-with-kit.png')
    this.load.image('championSheet_unarmored', 'assets/champions/champions-no-kit.png')
    this.load.json('championAtlas', 'assets/champions/champions0.json')
    this.load.image('slot_equipped', '/assets/inventory/slot_equipped.png')
    this.load.image('slot_inventory', '/assets/inventory/slot_inventory.png')
    this.load.image('panel_stone', '/assets/inventory/panel_stone.png')
    this.load.image('item_leather_armor', 'assets/inventory/A_Armour02.png')
    this.load.image('item_simple_bow', 'assets/inventory/W_Bow02.png')
    this.load.image('item_healing_potion', 'assets/inventory/P_Blue04.png')
    this.load.image('item_arrows', 'assets/inventory/W_Bow17.png')
    this.load.image('glowCursor', 'assets/glowCursor.png')
    this.load.audio('creak1', 'assets/sounds/creak1.wav')
    this.load.audio('arrowShoot1', 'assets/sounds/arrowShoot1.wav')
    this.load.audio('arrowShoot2', 'assets/sounds/arrowShoot2.wav')
    this.load.audio('arrowShoot3', 'assets/sounds/arrowShoot3.wav')
    this.load.audio('pumpkin_break_01', 'assets/sounds/pumpkin_break_01.ogg')
    this.load.audio('parrySound', 'assets/sounds/parry.mp3')
    // Bog map
    const key = this.getMapKey()
    this.bogMapCacheKey = 'bogMap_' + key
    this.load.json(this.bogMapCacheKey, `/maps/bogMaps/${key}.json?v=` + Date.now())
    this.load.image('oryxTiles', '/assets/oryx/oryx_16bit_fantasy_world_trans.png')
  }

  create() {
    const key = this.getMapKey()
    this.mapData = this.cache.json.get(this.bogMapCacheKey)
    if (!this.mapData) {
      console.error(`[${this.scene.key}] Map not found at /maps/bogMaps/${key}.json`)
      return
    }

    this.lights.enable()
    this.lights.setAmbientColor(this.getAmbient())

    this.drawTilemap()

    this.mapData.tiles = this.mapData.layers[0]
    this.mapData.unwalkableTiles = []

    if (!this.mapData.spawns)  this.mapData.spawns  = { player: { x: Math.floor(this.mapData.width / 2), y: Math.floor(this.mapData.height / 2) } }
    if (!this.mapData.objects) this.mapData.objects  = []
    if (!this.mapData.npcs)    this.mapData.npcs     = []
    if (!this.mapData.exits)   this.mapData.exits    = {}

    this.initializeLocation()

    // Override spawn position based on which edge we entered from
    this.applyEntryPosition()

    const pl = this.getPlayerLight()
    this.playerLight = this.lights.addLight(
      this.player.sprite.x, this.player.sprite.y,
      pl.radius || 300
    ).setIntensity(pl.intensity || 2.0).setColor(pl.color || 0xfff2cc)

    const mw = this.mapWidth, mh = this.mapHeight
    this.getWisps().forEach(w => {
      this.lights.addLight(
        mw * w.rx, mh * w.ry,
        w.radius || 180,
        w.color  || 0x99ff99,
        w.intensity || 0.6
      )
    })

    const track = this.getMusicTrack()
    if (track && window.tradConductor) window.tradConductor.playTrack(track)

    this.showIntroNarrative()
    this.onEnter()

    console.log(`[${this.scene.key}] ready — ${this.mapData.width}x${this.mapData.height}`)
  }

  // ── Tilemap ───────────────────────────────────────────────────────

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
      // Before layer 0, flood fill with base grass so transparent tiles have something beneath
      if (li === 0) {
        const grassFrame = ensureFrame(732)
        for (let y = 0; y < this.mapData.height; y++) {
          for (let x = 0; x < this.mapData.width; x++) {
            const img = this.add.image(
              x * TW * SCALE + (TW * SCALE) / 2,
              y * TH * SCALE + (TH * SCALE) / 2,
              'oryxTiles', grassFrame
            ).setScale(SCALE).setDepth(-1)
            if (this.game.renderer.type === Phaser.WEBGL) {
              img.setPipeline('Light2D')
            }
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
          if (this.game.renderer.type === Phaser.WEBGL) {
            img.setPipeline('Light2D')
          }
        }
      }
    }
  }

  // ── Collision ─────────────────────────────────────────────────────

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

  // ── Entry positioning ─────────────────────────────────────────────

  applyEntryPosition() {
    const edge = this.entryData?.entryEdge
    if (!edge || !this.mapData.entries) return

    const entry = this.mapData.entries[edge]
    if (!entry) return

    const sourceY    = this.entryData.sourceTile?.y
    const sourceH    = this.entryData.sourceHeight || this.mapData.height
    const destH      = this.mapData.height
    const destW      = this.mapData.width

    // Calculate Y — carry fraction across if yFromSource and we have source data
    let entryY
    if (entry.yFromSource && sourceY != null) {
      const fraction = sourceY / sourceH
      entryY = Math.round(fraction * destH)
      // Clamp to safe range
      entryY = Math.max(1, Math.min(destH - 2, entryY))
    } else {
      entryY = entry.y ?? Math.floor(destH / 2)
    }

    // Calculate X — use entry.x, clamp to map bounds
    const entryX = Math.max(1, Math.min(destW - 2, entry.x ?? Math.floor(destW / 2)))

    // Move player
    const px = entryX * this.tileSize + this.tileSize / 2
    const py = entryY * this.tileSize + this.tileSize / 2
    if (this.player?.sprite) {
      this.player.sprite.setPosition(px, py)
      this.cameras.main.centerOn(px, py)
    }

    console.log(`[${this.scene.key}] entry via ${edge} → tile [${entryX}, ${entryY}]`)
  }

  // ── Exits ─────────────────────────────────────────────────────────

  checkExits() {
    if (!this.player || !this.mapData.exits) return
    const tx = Math.floor(this.player.sprite.x / this.tileSize)
    const ty = Math.floor(this.player.sprite.y / this.tileSize)
    for (const [dir, exit] of Object.entries(this.mapData.exits)) {
      if (exit.tiles.some(([ex, ey]) => ex === tx && ey === ty)) {
        console.log(`[${this.scene.key}] → ${exit.destination}`)
        this.scene.start(exit.destination, {
          entryEdge:    exit.entryPoint,
          sourceTile:   { x: tx, y: ty },
          sourceHeight: this.mapData.height,
          sourceWidth:  this.mapData.width,
        })
        return
      }
    }
  }

  // ── Narrative ─────────────────────────────────────────────────────

  showIntroNarrative() {
    const champion = this.registry.get('selectedChampion') || window.selectedChampion
    if (!champion) return
    const seenKey = `${this.scene.key}_intro_${champion.id}`
    if (localStorage.getItem(seenKey)) return
    const narrative = this.mapData.introNarrative
    if (!narrative?.length) return
    this.narrativeInProgress = true
    this.narrativeQueue = [...narrative]
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
        irish: entry.irish, english: entry.english,
        type: 'dialogue',
        onDismiss: () => this.time.delayedCall(300, showNext)
      })
    }
    showNext()
  }

  // ── Object & NPC creation (handles our format — no visual required) ─

  createObjects() {
    if (!this.mapData.objects) return
    this.interactables = []

    this.mapData.objects.forEach(obj => {
      const pixelX = obj.x * this.tileSize + this.tileSize / 2
      const pixelY = obj.y * this.tileSize + this.tileSize / 2

      // Invisible trigger zone — proximity detection handles interaction
      const zone = this.add.zone(pixelX, pixelY, this.tileSize, this.tileSize)
      zone.setData('id',   obj.id)
      zone.setData('type', obj.type)
      zone.setData('text', obj.text)
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
      const pixelX = npcData.x * this.tileSize + this.tileSize / 2
      const pixelY = npcData.y * this.tileSize + this.tileSize / 2

      // Visual — use provided color or default NPC blue
      const color = npcData.visual?.color
        ? parseInt(npcData.visual.color)
        : 0x4169e1
      const radius = npcData.visual?.radius || 16

      const sprite = this.add.circle(pixelX, pixelY, radius, color)
      sprite.setData('id',           npcData.id)
      sprite.setData('name',         npcData.name)
      sprite.setData('dialogues',    npcData.dialogues)
      sprite.setData('dialogueIndex', 0)
      sprite.setData('isNPC',        true)
      sprite.setDepth(10)
      sprite.setInteractive()

      // Name label
      this.add.text(pixelX, pixelY - radius - 6, npcData.name, {
        fontSize: '12px',
        fontFamily: 'Arial',
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 4, y: 2 }
      }).setOrigin(0.5, 1).setDepth(11)

      sprite.on('pointerdown', () => this.talkToNPC(sprite))
      this.npcs.push(sprite)
    })

    console.log(`[${this.scene.key}] ${this.npcs.length} NPCs loaded`)
  }

  // ── Update ────────────────────────────────────────────────────────

  update(time, delta) {
    super.update(time, delta)
    if (this.playerLight && this.player?.sprite)
      this.playerLight.setPosition(this.player.sprite.x, this.player.sprite.y)
  }

  shutdown() {
    this.lights.destroy()
    super.shutdown?.()
  }
}


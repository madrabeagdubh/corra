// bogScene.js
// Location: js/game/scenes/locations/bogScene.js
//
// ── Purpose ───────────────────────────────────────────────────────────────────
// Extends PerspectiveScene with bog/forest-specific behaviour.
// Use as the base class for all inland bog and forest maps.
//
// ── What lives here ───────────────────────────────────────────────────────────
//   • _loadContent() — encounter deck placement, fixed encounters, NPCs
//   • createObjects() / createNPCs() — bog-specific object zones
//   • Content cache key convention (bogMap_*)
//
// ── What does NOT live here ───────────────────────────────────────────────────
//   • Map-specific sky, music, GIDs — implement in subclass via override hooks
//   • Boat system — use RiverScene for water maps
//
// ── Usage ─────────────────────────────────────────────────────────────────────
//   export default class GreatOpenBogScene extends BogScene {
//     getMapKey()    { return 'great_open_bog' }
//     getSkyImage()  { return '/assets/skies/bog_threshold_sky.png' }
//     onEnter()      { /* any map-specific setup */ }
//   }

import PerspectiveScene from './perspectiveScene.js'
import { GameState }    from '../../systems/gameState.js'
import { EncounterDeck } from '../../../../data/encounters/encounterDeck.js'
import { forestDeck }    from '../../../../data/encounters/forestDeck.js'

const ALWAYS_UNWALKABLE = new Set([
  1634, 1688, 740,
  228, 231, 233, 234, 235, 236, 226, 229, 230, 232, 242, 243,
  217, 218, 219,
  120, 121, 122, 123, 124, 125, 126, 127,
  128, 129, 130, 131, 132, 133, 134, 135,
])

export default class BogScene extends PerspectiveScene {

  // ── Content loading ───────────────────────────────────────────────────────
  // Loads map objects, NPCs, and places/restores encounter deck cards.
  // Called by PerspectiveScene.create() before scene initialisation.

  async _loadContent() {
    const jsKey  = this._contentKey()
    const mapKey = this.getMapKey()

    try {
      const module  = await import(`/data/bog/${jsKey}.js`)
      const content = module[jsKey + 'Content'] || {}

      this.mapData.objects        = content.objects        || []
      this.mapData.npcs           = content.npcs           || []
      this.mapData.introNarrative = content.introNarrative || []

      // Fixed encounters (always present, not randomised)
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

      // Encounter deck — restore saved layout or place fresh
      this._placeEncounterDeck(mapKey, occupied)

      console.log(`[${this.scene.key}] content loaded -- ${this.mapData.objects.length} objects, ${this.mapData.npcs.length} npcs`)
    } catch(e) {
      console.warn(`[${this.scene.key}] content not found for ${jsKey}:`, e.message)
      this.mapData.objects        = []
      this.mapData.npcs           = []
      this.mapData.introNarrative = []
    }
  }

  /**
   * Place encounter cards on the map. Restores a saved layout if one exists,
   * otherwise draws from the forest deck and saves the new layout.
   *
   * To use a different deck for a specific map, override this method:
   *   _placeEncounterDeck(mapKey, occupied) {
   *     super._placeEncounterDeck(mapKey, occupied, myCustomDeck, 8)
   *   }
   */
  _placeEncounterDeck(mapKey, occupied, deck = forestDeck, drawCount = 6) {
    const savedLayout = GameState.getEncounterLayout(mapKey)

    if (savedLayout) {
      savedLayout.forEach(entry => {
        const stateKey = `${mapKey}.${entry.id}`
        if (GameState.isCollected(stateKey)) return
        const card = deck.find(c => c.id === entry.id)
        if (!card) return
        this.mapData.objects.push({
          id: card.id, type: 'encounter_flag',
          x: entry.x, y: entry.y, stateKey,
          visual: card.visual,
          text:   { ga: card.ga, en: card.en },
          actions: card.actions || [],
        })
      })
      console.log(`[${this.scene.key}] restored encounter layout (${savedLayout.length} cards)`)
      return
    }

    // Fresh placement — find walkable tiles and scatter cards
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

    const encDeck     = new EncounterDeck(deck)
    const drawn       = encDeck.draw(drawCount)
    let   wi          = 0
    const placed      = []
    const layoutToSave = []
    const MIN_SPACING  = 6

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

  // ── Objects / NPCs ────────────────────────────────────────────────────────

  createObjects() {
    if (!this.mapData.objects) return
    this.interactables = []
    this.mapData.objects.forEach(obj => {
      const stateKey = obj.stateKey || `${this.getMapKey()}.${obj.id}`
      if (obj.type === 'collectable'    && GameState.isCollected(stateKey)) return
      if (obj.type === 'encounter_flag' && GameState.isCollected(stateKey)) return
      if (obj.requiresQuest &&
          !GameState.isQuestActive(obj.requiresQuest) &&
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
      zone.x = pixelX; zone.y = pixelY

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
      if (npcData.requiresQuest &&
          !GameState.isQuestActive(npcData.requiresQuest) &&
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

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Converts getMapKey() snake_case to camelCase for content file import */
  _contentKey() {
    return this.getMapKey().replace(/_([a-z])/g, (_, c) => c.toUpperCase())
  }
}


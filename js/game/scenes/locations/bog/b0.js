import BogLocationScene from '../bogScene.js'
import RoundhouseRenderer from '../../../effects/roundhouseRenderer.js'
import { GameState } from '../../../systems/gameState.js'

// b0 -- the village: a working ráth on its hill.
// Terrain comes entirely from the heightMap written by gen_village_map.mjs
// (dome, bank, ditch, southern causeway); the old GID-driven elevationConfig
// is retired. The bank/ditch is a smooth earthwork with no genuine vertical
// cliff anywhere, so it deliberately does NOT use SteepFaceRenderer (its
// stone-facing threshold is tuned for real GID-cliff maps and kept its
// visual gate stubbornly under the ring's actual grade however high
// CLIMB_MAX_STEP was pushed -- simplest, most reliable fix is to just not
// run it here at all). The palisade is the map's wallMask ring rendered as
// bare timber poles via the ForestEffects options below (no canopy, no
// branches). House sites live in mapData.houses (a rectangular longhall +
// tavern + one dwelling hut) and render via RoundhouseRenderer below;
// mapData.features (firepit/well/pen) are still recorded but not yet
// rendered. NPCs load from /data/bog/b0.js.
export default class BogB0 extends BogLocationScene {
  constructor() { super({ key: 'b0' }) }

  // Defensive: the tavern's interior overlay (#pgr-ceiling gradient +
  // #pgr-blackmask) is raw DOM that the tavern is meant to tear down on exit.
  // If that teardown is missed on the door-exit path it would leave the village
  // dark, so strip any leftovers here -- the exterior never creates them itself.
  create() {
    super.create()
    document.getElementById('pgr-ceiling')?.remove()
    document.getElementById('pgr-blackmask')?.remove()
    const c = this.game?.canvas?.parentNode
    if (c) c.style.background = ''
  }

  getMapKey()      { return 'b0' }
  getAmbient()     { return 0x223322 }
  getPlayerLight() { return { color: 0xfff5dd, intensity: 2.0, radius: 320 } }
  getWisps()       { return [] }
  getMusicTrack()  { return null }
  getSkyImage()    { return '/assets/skies/bog_threshold_sky.png' }
  getSkyPosition() { return '42% 50%' }
  getMountainPosition() { return '42% 90%' }

  // Palisade: the wallMask ring renders as bare timber poles -- thin, short,
  // effectively no canopy, no branches. Tune widthScale/heightScale for
  // post heft; keep the canopy scales near zero or the fence sprouts leaves.
  getForestEffectsOptions() {
    return {
      trunkKeepChance: 1.0,
      widthScale:  0.18,
      heightScale: 0.30,
      canopyHaze:  false,
      canopyFacetScale:  0.1,
      canopyLayerScale:  0.1,
      canopyRadiusScale: 0.06,
      branchScale: 0.0,
    }
  }

  // Roundhouses (longhall / tavern / dwelling) from mapData.houses. Walls
  // draw via PGR's own per-row loop (setStructures) so they're correctly
  // interleaved with terrain/trunks and correctly occluded by the player
  // -- see roundhouseRenderer.js's header for why the old forestEffects.ctx
  // wiring got both of those wrong.
  onEnter() {
    super.onEnter?.()
    this.roundhouses = new RoundhouseRenderer(this.mapData.houses || [])
    this.perspectiveGround.setStructures(this.roundhouses)
  }

  // BogScene's createNPCs() (the shared base every other bog map still uses)
  // places NPCs as plain Phaser objects positioned once in world space, then
  // leaves them to Phaser's ordinary linear camera scroll. That's wrong for
  // any PGR scene: the ground and player are drawn every frame through PGR's
  // nonlinear perspective projection, so a linearly-scrolled NPC drifts out
  // of step with the ground as the player walks -- the "floating down the
  // screen" bug. This override is identical to BogScene.createNPCs() except
  // it also stashes 'radius' and a 'label' reference on each sprite so
  // _updateNPCPerspective() below can re-project them every frame. Scoped to
  // b0 only for now -- other bog maps still use the un-anchored version.
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
      sprite.setData('radius',        radius)
      sprite.setDepth(10).setInteractive()

      const label = this.add.text(pixelX, pixelY - radius - 6, npcData.name, {
        fontSize: '12px', fontFamily: 'Arial',
        color: '#ffffff', backgroundColor: '#000000',
        padding: { x: 4, y: 2 }
      }).setOrigin(0.5, 1).setDepth(11)
      sprite.setData('label', label)

      sprite.on('pointerdown', () => this.talkToNPC(sprite))
      this.npcs.push(sprite)
    })
    console.log(`[${this.scene.key}] ${this.npcs.length} NPCs loaded (perspective-anchored)`)
  }

  // Re-project every NPC (and its name label) through PGR's perspective
  // transform each frame, using the same applyPerspective() helper the
  // renderer already exposes for exactly this purpose -- it was written
  // but never actually called anywhere before this.
  _updateNPCPerspective() {
    if (!this.npcs?.length || !this.perspectiveGround) return
    for (const npc of this.npcs) {
      const radius = npc.getData('radius') || 16
      const visible = this.perspectiveGround.applyPerspective(
        npc, npc.getData('logicalX'), npc.getData('logicalY'),
        this.tileSize, radius * 2)
      const label = npc.getData('label')
      if (!label) continue
      label.setVisible(visible)
      if (visible) {
        label.setScale(npc.displayWidth / (radius * 2))
        label.setPosition(npc.x, npc.y - npc.displayHeight / 2 - 6)
      }
    }
  }

  onPGRDrawComplete() {
    super.onPGRDrawComplete?.()
    this._updateNPCPerspective()
  }

  // Roofs/portico/ornament/ground-shadow are a final overlay pass (they
  // sit above wall-top height, unlike the walls themselves, which draw
  // per-row inside PGR's own loop via setStructures). Also on _gCtx, so
  // must run after super.update() -- which is what actually runs PGR's
  // per-row loop -- has fully finished for this frame, not mid-loop.
  update(time, delta) {
    super.update(time, delta)
    if (this.roundhouses) this.roundhouses.drawOverlay(this.perspectiveGround, this.forestEffects._sw, this.forestEffects._sh)
  }

  shutdown() {
    if (this.roundhouses) { this.perspectiveGround?.setStructures(null); this.roundhouses.destroy(); this.roundhouses = null }
    super.shutdown()
  }

  // Buildings were purely visual until now -- RoundhouseRenderer draws
  // pixels but never registered any collision, so the player could walk
  // straight through a wall. Approximates each footprint with the same
  // shape the renderer uses (circle for huts, rectangle for the
  // longhall); doesn't carve out the doorway gaps, so doors aren't
  // actually walkable-through yet -- a reasonable first pass, not the
  // final word on it.
  isColliding(x, y) {
    if (super.isColliding(x, y)) return true
    const tx = x / this.tileSize, ty = y / this.tileSize
    for (const h of this.mapData.houses || []) {
      if (h.kind === 'longhall') {
        const hw = (h.w || 4) / 2, hd = (h.d || 3) / 2
        if (Math.abs(tx - h.x) < hw && Math.abs(ty - h.y) < hd) return true
      } else {
        const r = h.r || 2
        const dx = tx - h.x, dy = ty - h.y
        if (dx * dx + dy * dy < r * r) return true
      }
    }
    return false
  }
}



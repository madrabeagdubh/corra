import BogLocationScene from '../bogScene.js'
import Phaser from 'phaser'
import PortalTomb from '../../../effects/portalTomb.js'

export default class BogD2 extends BogLocationScene {
  constructor() { super({ key: 'd2' }) }
  getMapKey()      { return 'd2' }
  getAmbient()     { return 0x2a2a15 }
  getPlayerLight() { return { color: 0xfff0cc, intensity: 1.9, radius: 280 } }
  getWisps()       { return [] }
  getMusicTrack()  { return null }
  getSkyImage()    { return '/assets/skies/bog_threshold_sky.png' }
  getSkyPosition() { return '75% 50%' }
  getMountainPosition() { return '75% 75%' }

  // A few plants in the foreground and no more; none on the path, the terrace or at the door.
  getVegetation() {
    const m = this.mapData
    return {
      density: 0.16,
      clumpBias: 0.55,
      minScale: 22,
      heightTiles: 0.9,
      allowAt: (key, col, row) => {
        if ((m?.pathDist?.[row]?.[col] ?? 1) < 0.85) return false
        if (Math.hypot(col + 0.5 - 28.5, (row + 0.5 - 11.6) * 1.2) < 3.4) return false
        return true
      }
    }
  }

  // ── the passage: a look, then a choice ───────────────────────────────────────────────────────────
  // Standing by the doorway the moonTile offers a small glyph of it; a tap shows what you are looking at
  // (a card, in Irish with the English under the moon's translation) and two choices: Isteach, which fades
  // into the cave, or Siar, which leaves you be. The doorway tile itself is solid (mapData.tomb.blocked).
  _caveMouthGlyph() {
    const c = document.createElement('canvas'); c.width = c.height = 64
    const g = c.getContext('2d')
    const edge = '#1a1008'
    const poly = (pts, fill) => {
      g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath()
      g.lineWidth = 5; g.lineJoin = 'round'; g.strokeStyle = edge; g.stroke(); g.fillStyle = fill; g.fill()
    }
    poly([[10, 56], [10, 20], [17, 14], [24, 17], [24, 56]], '#a29e92')       // left stone, leaning a little
    poly([[40, 56], [41, 24], [47, 19], [54, 22], [55, 56]], '#8f8b80')       // right stone
    poly([[7, 22], [26, 9], [46, 11], [57, 20], [52, 26], [8, 29]], '#b4b0a3') // the lintel
    g.fillStyle = '#0a0b0e'; g.beginPath(); g.moveTo(25, 56); g.lineTo(25, 29); g.lineTo(38, 29); g.lineTo(40, 56); g.closePath(); g.fill()
    return c
  }

  _makeCaveMouth() {
    const t = this.mapData?.tomb
    if (!t) return
    const ts = this.tileSize, px = (t.x + 0.5) * ts, py = (t.y + 0.5) * ts
    const z = this.add.zone(px, py, ts, ts)
    z.setData('id', 'cave_mouth'); z.setData('type', 'fixed_encounter'); z.setData('stateKey', 'd2.cave_mouth')
    z.setData('logicalX', px); z.setData('logicalY', py)
    z.setData('visual', {})
    z.setData('dialogues', [{
      hold: true,
      ga: 'Doras cam sa chnoc glas, idir dhá chloch chlaon. Tá dorchadas istigh, agus aer fuar ag éirí as.',
      en: 'A crooked doorway in the green mound, between two leaning stones. Darkness inside, and cold air rising out of it.',
      options: [
        { ga: 'Isteach', en: 'Go in', exit: true, event: 'enterCave' },
        { ga: 'Siar', en: 'Turn back', exit: true, event: 'leaveCave' },
      ],
    }])
    this._caveMouth = z
  }

  checkProximityInteractions() {
    const panel = this._encounterPanel, z = this._caveMouth
    if (panel && z && this.player && !this._exiting && !this.narrativeInProgress && !this.textPanel?.isVisible && !this.textPanelCooldown) {
      const d = Phaser.Math.Distance.Between(this.player.logicalX, this.player.logicalY, z.getData('logicalX'), z.getData('logicalY'))
      const mine = panel._card?.id === 'cave_mouth'
      if (d < this.tileSize * 1.6 && !(this._caveMouthCool > this.time.now)) {
        if (!panel._card || mine) {
          this._flagInRange = true
          delete panel._openPanel
          if (!mine || !panel._badgeVisible) {
            panel.notify({
              id: 'cave_mouth',
              visual: { glyph: this._caveMouthGlyph() },
              onActivate: () => {
                panel.notify({ id: 'fixed:cave_mouth', visual: {} }, z)
                panel._openPanel()
              },
            }, z)
          }
          return
        }
      } else if (mine) {
        panel.clearNotify()
      }
    }
    super.checkProximityInteractions()
  }

  onDialogueEvent(ev) {
    if (ev === 'leaveCave') { this._caveMouthCool = this.time.now + 2500; return }
    if (ev === 'enterCave') {
      const e = this.mapData?.exits?.cave
      if (e) this._triggerExit('cave', { ...e, walk: [0, 0] })     // no walk: you go in where you stand, the screen fades
    }
  }

  // The portal tomb on the hill in the north-east (mapData.tomb): a PGR structure, drawn in its own row's
  // pass so the trees in front of it cover it as they should. The way in is exits.cave.
  onEnter() {
    super.onEnter?.()
    const t = this.mapData?.tomb
    if (t && this.perspectiveGround) {
      this.tomb = new PortalTomb(this, t)
      this.perspectiveGround.setStructures(this.tomb)
    }
    this._makeCaveMouth()
    this.events.once('shutdown', () => {
      if (this.perspectiveGround?._structures === this.tomb) this.perspectiveGround.setStructures(null)
      this.tomb = null
    })
  }

  // the tomb's stones are solid (mapData.tomb.blocked: tiles)
  isColliding(x, y) {
    if (super.isColliding(x, y)) return true
    const b = this.mapData?.tomb?.blocked
    if (!b?.length) return false
    const tx = Math.floor(x / this.tileSize), ty = Math.floor(y / this.tileSize)
    return b.some(([bx, by]) => bx === tx && by === ty)
  }
}

import RiverScene from '../riverScene.js'
import SteepFaceRenderer from '../../../effects/steepFaceRenderer.js'

import NpcCloak from '../../../effects/npcCloak.js'

// Synthetic GID for Muireann's sprite -- see registerCustomTile() in create().
// Keep in sync with visual.gid in public/data/bog/d3Sea.js.
const MUIREANN_GID = 9101

export default class BogD3Sea extends RiverScene {

  constructor() { super({ key: 'd3_sea' }) }

  // The estuary is the first thing a new player sees, and it is a boat map:
  // scattered chest/fire/bush/book cards from the shared forest deck read as
  // debris here and compete with Muireann for attention. Suppressing the deck
  // entirely leaves her as the only interactable on the map. (Any layout
  // already saved to GameState is simply never read -- harmless.)
  _placeEncounterDeck() {}
hasNorthFallback() { return false }
  usesSwallows()         { return false }
  getMapKey()              { return 'd3_sea' }
  getAmbient()             { return 0x223344 }
  getPlayerLight()         { return { color: 0xcce8ff, intensity: 1.8, radius: 320 } }
  getWisps()               { return [] }
  getMusicTrack()          { return null }
  getExtraUnwalkableGIDs() { return new Set([740, 1832]) }
  getSkyImage()            { return '/assets/skies/bog_threshold_sky.png' }
  getSkyPosition()         { return '50% 60%' }
  getMountainImage()       { return null }
  getMountainPosition()    { return '50% 100%' }

  // No getElevationConfig() override -- matches d3.js's own setup
  // exactly. This map now uses a continuous per-vertex heightMap (same
  // system d3 itself uses, and d3's cliffs/hills already render and
  // occlude correctly with it) rather than ElevationRenderer's discrete
  // GID-adjacency plateau system. Falling back to the base class's
  // default (returns null unless mapData.elevationConfig is set, which
  // it isn't) means ElevationRenderer never constructs for this scene,
  // exactly mirroring d3.js -- despite hasCliffs:true in the map JSON,
  // same as d3.json itself.

  preload() {
    super.preload()
    this.load.image('boat', '/assets/boat.png')
  }

  async create(data) {
    await super.create(data)
    // Prevent the phantom-mirror system (which extends the map visually
    // past its true edge) from bleeding real shoreline land past the
    // east/south borders -- those lead to open sea / map boundary, so
    // anything beyond should be water. The WEST edge is deliberately
    // excluded: it leads into d3 (a land map), so the shoreline there
    // should keep mirroring naturally past the border rather than
    // abruptly cutting to forced water -- an earlier blanket `true`
    // here created exactly that seam (confirmed via screenshot: the
    // real cliff ended at the true edge and forced-water began right
    // beside it, breaking the illusion of one continuous shore).
    if (this.perspectiveGround) this.perspectiveGround._phantomOceanOnly = new Set(['east', 'south'])

    // Muireann's portrait. registerCustomTile() caches an arbitrary image
    // under a synthetic GID, so one registration covers all three surfaces
    // that resolve through _getTileCanvas(): the billboard on the headland,
    // the badge on the moon, and the portrait on the encounter card.
    // 9101 is far outside the Oryx tileset's real GID range, so it can
    // never collide with a map tile.
    if (this.perspectiveGround) {
      this.perspectiveGround.registerCustomTile(MUIREANN_GID, '/assets/npcs/muireann.png')
    }
    // A druid on a headland at the mouth of the sea should have something
    // moving about her. Wind blows inland (negative x) and slightly down,
    // matching the original tutorial's setting.
    this.muireannCloak = new NpcCloak(this, {
      tileX: 13, tileY: 1,
      texture: '/assets/cape.png',
      // Anchor on her: fractions of her sprite's box.
      shoulderX:  0.4,   // centred
      shoulderY:  0.30,   // shoulder height
      // Size: fractions of her sprite's box, NOT the image's aspect ratio.
      widthFrac:  0.80,
      heightFrac: 0.55,
      // Pivot within the cloak: top centre, so it swings from the shoulders.
      pivotX:     0.50,
      pivotY:     0.00,
      // Set true to draw her bounding box and the anchor cross. Makes
      // positioning a two-minute job; turn it off when happy.
      debugAnchor: false,
      wind: { x: -15, y: 5 },
    })

    if (this.boatSystem) {
      this.boatSystem._triggerDisembark = () => {}
      this.boatSystem._reboard          = () => {}
    }
    this._doDisembark   = () => {}
    this._noDisembarkUI = true
  }

  update(time, delta) {
    super.update(time, delta)
    // Update estuary waves
    if (this._estWaves?.length) this._updateEstuaryWaves(delta)

    // Hard south camera clamp
    const _cam = this.cameras?.main
    if (_cam && this.player) {
      const _maxSY = 30 * this.tileSize - this.scale.height / (_cam.zoom || 1)
      if (_cam.scrollY > _maxSY) _cam.scrollY = _maxSY
    }
    if (this._disembarkBadgeShown) {
      this._disembarkBadgeShown = false
      this._encounterPanel?.clearNotify()
      this.joystick?.drawBadgeGlow?.(0)
    }
  }

  onEnter() {
    this._exitCooldown = 0
    // SteepFaceRenderer: renders grey stone texture on camera-facing
    // steep slopes, catching gaps the raw per-vertex heightmap terrain
    // can otherwise leave (the "hollow hill" bleed-through where distant
    // water shows through a foreground rise) -- same system already
    // proven in elevationMoatTest, now adopted here since this map
    // switched to the same continuous-heightmap approach d3 itself uses.
    this.steepFaces = new SteepFaceRenderer(this)
    this.time.delayedCall(50, () => {
      if (!this.boatSystem || !this.perspectiveGround) {
        console.warn('[d3Sea] onEnter: boatSystem or perspectiveGround missing')
        return
      }
      if (this.textures.exists('boat')) {
        this.perspectiveGround.loadBoatImage(this.textures.get('boat').getSourceImage())
      }
      this.boatSystem._noDrift = true
      this._destroyEstuaryWaves()
    if (this._swallows) { this._swallows.stop(); this._swallows = null }
      document.getElementById('swallow-canvas')?.remove()
      this.boatSystem.activate()
      this._initEstuaryWaves()
    })
  }


  _initEstuaryWaves() {
    // Always remove stale canvas first
    document.getElementById('estuary-waves')?.remove()
    this._estWaveCanvas = null
    this._estWaveCtx    = null
    const pgr = this.perspectiveGround
    if (!pgr) return

    const container = this.game.canvas.parentNode

    this._estWaveCanvas = document.createElement('canvas')
    this._estWaveCanvas.id = 'estuary-waves'
    this._estWaveCanvas.width  = pgr._sw
    this._estWaveCanvas.height = pgr._sh
    this._estWaveCanvas.style.cssText = [
      'position:absolute','top:0','left:0',
      'z-index:2','pointer-events:none',  // below objects layer so terrain draws over waves
      'image-rendering:pixelated',
    ].join(';')
    const lightCanvas = document.getElementById('pgr-light')
    if (lightCanvas) container.insertBefore(this._estWaveCanvas, lightCanvas)
    else container.appendChild(this._estWaveCanvas)

    this._estWaveCtx = this._estWaveCanvas.getContext('2d')

    // Resize canvas on window resize / fullscreen change
    this._estWaveResizeFn = () => {
      const pgr2 = this.perspectiveGround
      if (!pgr2 || !this._estWaveCanvas) return
      // PGR updates _sw/_sh on next frame — delay slightly
      setTimeout(() => {
        if (!this._estWaveCanvas || !pgr2) return
        this._estWaveCanvas.width  = pgr2._sw
        this._estWaveCanvas.height = pgr2._sh
      }, 100)
    }
    window.addEventListener('resize', this._estWaveResizeFn)
    document.addEventListener('fullscreenchange', this._estWaveResizeFn)
    document.addEventListener('webkitfullscreenchange', this._estWaveResizeFn)
    this._estWaveT   = 0
    this._ripples   = []
    this._buildRipples(pgr._sw, pgr._sh, pgr)

    // Six wave trains matching WaveRenderer style
    this._estWaves = []
    for (let i = 0; i < 6; i++) {
      this._estWaves.push({
        speed:      0.0016 + i * 0.001,  // slow — delta-independent
        amplitude:  0.20  + i * 0.07,
        wavelength: 4.0   + i * 1.3,
        phase:      Math.random() * Math.PI * 2,
      })
    }
  }

  _updateEstuaryWaves(delta) {
    if (!this._estWaves?.length) return
    if (!this._estWaveCanvas || !this._estWaveCtx) return
    const pgr = this.perspectiveGround
    if (!pgr) return

    for (const w of this._estWaves) w.phase += w.speed

    const ctx = this._estWaveCtx
    const sw  = pgr._sw || window.innerWidth
    const sh  = pgr._sh || window.innerHeight
    const cw  = Math.round(sw), ch = Math.round(sh)
    if (this._estWaveCanvas.width !== cw || this._estWaveCanvas.height !== ch) {
      this._estWaveCanvas.width = cw; this._estWaveCanvas.height = ch
    }

    if ((this._estWaveHideFrames ?? 0) > 0) {
      this._estWaveHideFrames--
      ctx.clearRect(0, 0, sw, sh)
      if (this._estWaveHideFrames === 0) this._estWaveCanvas.style.opacity = '1'
      return
    }

    ctx.clearRect(0, 0, sw, sh)

    const mapH      = this.mapData?.layers?.[0]?.length ?? 36
    const mapW      = this.mapData?.layers?.[0]?.[0]?.length ?? 36
    const ts        = this.tileSize
    const horizonPx = pgr._horizonPx?.() ?? sh * 0.28
    const eff       = 0.35
    const rowStep   = 3.5
    const maxAmp    = ts * eff * 0.55
    const layer0    = this.mapData?.layers?.[0]

    ctx.save()
    ctx.beginPath()
    ctx.rect(0, horizonPx + 4, sw, sh - horizonPx - 4)
    ctx.clip()

    for (let tileRow = 2; tileRow < mapH - 2; tileRow += rowStep) {
      const screenY = pgr._rowToScreenY?.(tileRow + 1)
      if (screenY === null || !isFinite(screenY)) continue
      if (screenY < horizonPx + 4 || screenY > sh + 20) continue

      const scaledW = pgr._scaleAtRow?.(tileRow + 1)
      if (!scaledW || !isFinite(scaledW)) continue

      const crestH = maxAmp * (scaledW / ts)
      if (crestH < 0.5) continue

      const rowPhaseOffset = (tileRow * 0.618) % (Math.PI * 2)
      const rowData = layer0?.[Math.round(tileRow)]

      // Build wave point segments — break on non-water tiles
      const segments = []
      let seg = []
      for (let c = 0; c <= mapW; c++) {
        const gid     = rowData?.[c] ?? 0
        const isWater = gid === 1625 || gid === 1679
        const screenX = pgr._colToScreenX?.(c + 0.5, tileRow)
        if (!isFinite(screenX) || !isWater) {
          if (seg.length >= 2) segments.push(seg)
          seg = []; continue
        }
        let sum = 0, wsum = 0
        for (const w of this._estWaves) {
          sum  += Math.sin(w.phase + c / w.wavelength * Math.PI * 2 + rowPhaseOffset * w.speed * 8) * w.amplitude
          wsum += w.amplitude
        }
        const norm  = wsum > 0 ? sum / wsum : 0
        const sharp = Math.sign(norm) * Math.pow(Math.abs(norm), 0.6)
        const cy    = screenY - crestH * 0.5 * (1 + sharp)
        if (isFinite(cy)) seg.push({ x: screenX, y: cy })
      }
      if (seg.length >= 2) segments.push(seg)
      if (segments.length === 0) continue

      const horizonFade = Math.max(0, Math.min(1, (screenY - horizonPx) / 40))
      const baseAlpha   = eff * horizonFade

      ctx.save()

      // Shadow trough
      const shadowH = crestH * 0.45
      if (shadowH > 1) {
        for (const s of segments) {
          if (s.length < 2) continue
          ctx.beginPath()
          s.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y))
          for (let i = s.length - 1; i >= 0; i--) ctx.lineTo(s[i].x, s[i].y - shadowH)
          ctx.closePath()
          try {
            const sg = ctx.createLinearGradient(0, screenY - crestH - shadowH, 0, screenY - crestH * 0.3)
            sg.addColorStop(0,   'rgba(6,14,32,0)')
            sg.addColorStop(0.4, `rgba(8,18,42,${(baseAlpha * 0.28).toFixed(2)})`)
            sg.addColorStop(1,   `rgba(12,24,52,${(baseAlpha * 0.45).toFixed(2)})`)
            ctx.fillStyle = sg; ctx.fill()
          } catch(e) {}
        }
      }

      // Crest highlight
      ctx.globalAlpha = baseAlpha
      for (const s of segments) {
        for (let pi = 0; pi < s.length - 1; pi++) {
          const pt0 = s[pi], pt1 = s[pi + 1]
          if (!pt0 || !pt1) continue
          const hf = Math.max(0, (screenY - pt0.y) / crestH)
          const lw = Math.max(0.6, crestH * 0.28 * (0.5 + hf * 0.8))
          ctx.beginPath(); ctx.moveTo(pt0.x, pt0.y); ctx.lineTo(pt1.x, pt1.y)
          ctx.strokeStyle = `rgba(220,238,255,${(baseAlpha * (0.4 + hf * 0.6)).toFixed(2)})`
          ctx.lineWidth = lw; ctx.stroke()
        }
      }

      // Belly gradient
      const bellyH = crestH * 0.75
      const gradY0 = screenY - crestH * 0.85
      const gradY1 = gradY0 + bellyH
      if (isFinite(gradY0) && isFinite(gradY1) && Math.abs(gradY1 - gradY0) > 1) {
        for (const s of segments) {
          if (s.length < 2) continue
          ctx.beginPath()
          s.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y))
          for (let i = s.length - 1; i >= 0; i--) ctx.lineTo(s[i].x, s[i].y + bellyH)
          ctx.closePath()
          try {
            const lg = ctx.createLinearGradient(0, gradY0, 0, gradY1)
            lg.addColorStop(0,    `rgba(160,195,230,${(baseAlpha * 0.82).toFixed(2)})`)
            lg.addColorStop(0.25, `rgba(140,175,215,${(baseAlpha * 0.65).toFixed(2)})`)
            lg.addColorStop(0.6,  `rgba(65,95,130,${(baseAlpha * 0.45).toFixed(2)})`)
            lg.addColorStop(1,    `rgba(45,70,110,${(baseAlpha * 0.28).toFixed(2)})`)
            ctx.fillStyle = lg; ctx.fill()
          } catch(e) {}
        }
      }

      ctx.restore()
    }
    ctx.restore()
  }



  _buildRipples(sw, sh, pgr) {
    const mapH = this.mapData?.layers?.[0]?.length ?? 36
    const mapW = this.mapData?.layers?.[0]?.[0]?.length ?? 36
    this._ripples = []
    // Scatter ~300 ripples across the map in varied directions
    for (let i = 0; i < 300; i++) {
      const tileRow = 2 + Math.random() * (mapH - 4)
      const tileCol = Math.random() * mapW
      // Mix of directions — mostly east-west with some diagonal
      const angleBase = Math.random() < 0.5
        ? (Math.random() - 0.5) * 0.4          // nearly horizontal
        : Math.PI * 0.25 * (Math.random() < 0.5 ? 1 : -1) + (Math.random() - 0.5) * 0.3  // diagonal
      this._ripples.push({
        tileRow,
        tileCol,
        angle:      angleBase,
        lenMult:    0.8 + Math.random() * 1.4,
        waveOffset: Math.random() * Math.PI * 2,
      })
    }
  }


  _destroyEstuaryWaves() {
    if (this._estWaveResizeFn) {
      window.removeEventListener('resize', this._estWaveResizeFn)
      document.removeEventListener('fullscreenchange', this._estWaveResizeFn)
      document.removeEventListener('webkitfullscreenchange', this._estWaveResizeFn)
      this._estWaveResizeFn = null
    }
    if (this._estWaveCanvas) {
      this._estWaveCanvas.remove()
      this._estWaveCanvas = null
      this._estWaveCtx    = null
    }
    // Also nuke any stale canvas by id
    document.getElementById('estuary-waves')?.remove()
  }

  checkExits() {
    // Destroy waves when exiting
    if (this.mapData?.exits && this.player) {
      const tileX = Math.floor(this.player.logicalX / this.tileSize)
      const tileY = Math.floor(this.player.logicalY / this.tileSize)
      for (const [, exitData] of Object.entries(this.mapData.exits)) {
        if (exitData.tiles.some(([ex, ey]) => ex === tileX && ey === tileY)) {
          this._destroyEstuaryWaves()
        }
      }
    }
    super.checkExits?.()
  }

  onPGRDrawComplete(ctx) {
    if (this.steepFaces) this.steepFaces.update()
  }

  /**
   * Fired by PGR immediately before it draws an encounter-flag billboard, so
   * whatever is painted here ends up BEHIND the figure. `rect` is the
   * sprite's exact destination box.
   */
  onPGRBeforeFlag(ctx, flag, rect) {
    if (flag?.visual?.gid === MUIREANN_GID) this.muireannCloak?.drawAtRect(ctx, rect)
  }

  shutdown() {
    if (this.muireannCloak) { this.muireannCloak.destroy(); this.muireannCloak = null }
    if (this.steepFaces) { this.steepFaces.destroy(); this.steepFaces = null }
    this._destroyEstuaryWaves()
    if (this._swallows) { this._swallows.stop(); this._swallows = null }
    // Also remove any lingering swallow canvas directly
    document.getElementById('swallow-canvas')?.remove()
    super.shutdown?.()
  }

}


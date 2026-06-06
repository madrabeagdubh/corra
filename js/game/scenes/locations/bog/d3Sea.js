import RiverScene from '../riverScene.js'

export default class BogD3Sea extends RiverScene {

  constructor() { super({ key: 'd3_sea' }) }

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

  getElevationConfig() {
    return {
      cliffGids:    new Set([740]),
      cliffFaceGid: 740,
      elevatedGids: new Set([839, 840]),
      cliffSouth:   new Set([731, 1625, 1679]),
      cliffHeight:  1.0,
    }
  }

  preload() {
    super.preload()
    this.load.image('boat', '/assets/boat.png')
  }

  async create(data) {
    await super.create(data)
    if (this.boatSystem) {
      this.boatSystem._triggerDisembark = () => {}
      this.boatSystem._reboard          = () => {}
    }
    this._doDisembark   = () => {}
    this._noDisembarkUI = true
  }

  update(time, delta) {
    super.update(time, delta)
    this._updateEstuaryWaves(delta)
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



      const champion = this.registry.get('selectedChampion')
      const seenKey  = `d3_sea_estuary_${champion?.id}`
      if (!localStorage.getItem(seenKey)) {
        localStorage.setItem(seenKey, 'true')
        this.time.delayedCall(800, () => {
          this.textPanel?.show({
            ga: 'An fharraige. Ag breathnu siar ar Albain den uair dheireanach.',
            en: 'The sea. Looking back at Scotland for the last time.',
            type: 'notification',
          })
        })
      }
    })
  }
  _initEstuaryWaves() {
    if (this._estWaveCanvas) return
    const pgr = this.perspectiveGround
    if (!pgr) return

    const container = this.game.canvas.parentNode
    const stale = document.getElementById('estuary-waves')
    if (stale) stale.remove()

    this._estWaveCanvas = document.createElement('canvas')
    this._estWaveCanvas.id = 'estuary-waves'
    this._estWaveCanvas.width  = pgr._sw
    this._estWaveCanvas.height = pgr._sh
    this._estWaveCanvas.style.cssText = [
      'position:absolute','top:0','left:0',
      'z-index:3','pointer-events:none',
      'image-rendering:pixelated',
    ].join(';')
    const lightCanvas = document.getElementById('pgr-light')
    if (lightCanvas) container.insertBefore(this._estWaveCanvas, lightCanvas)
    else container.appendChild(this._estWaveCanvas)

    this._estWaveCtx = this._estWaveCanvas.getContext('2d')
    this._estWaveT   = 0
    this._ripples   = []
    this._buildRipples(pgr._sw, pgr._sh, pgr)

    // Six wave trains matching WaveRenderer style
    this._estWaves = []
    for (let i = 0; i < 6; i++) {
      this._estWaves.push({
        speed:      0.010 + i * 0.006,
        amplitude:  0.20  + i * 0.07,
        wavelength: 4.0   + i * 1.3,
        phase:      Math.random() * Math.PI * 2,
      })
    }
  }

  _updateEstuaryWaves(delta) {
    if (!this._estWaveCanvas || !this._estWaveCtx) return
    const pgr = this.perspectiveGround
    if (!pgr) return

    const sw = pgr._sw, sh = pgr._sh
    if (this._estWaveCanvas.width !== sw || this._estWaveCanvas.height !== sh) {
      this._estWaveCanvas.width = sw
      this._estWaveCanvas.height = sh
    }

    // Advance wave phases
    for (const w of this._estWaves) {
      w.phase += w.speed
    }

    const ctx       = this._estWaveCtx
    const mapH      = this.mapData?.layers?.[0]?.length ?? 36
    const mapW      = this.mapData?.layers?.[0]?.[0]?.length ?? 36
    const ts        = this.tileSize
    const horizonPx = pgr._horizonPx?.() ?? sh * 0.28
    const eff       = 0.35   // fixed calm intensity for estuary
    const rowStep   = 3.5
    const maxAmp    = ts * eff * 0.55

    ctx.clearRect(0, 0, sw, sh)

    for (let tileRow = 2; tileRow < mapH - 2; tileRow += rowStep) {
      const screenY = pgr._rowToScreenY?.(tileRow + 1)
      if (screenY === null || !isFinite(screenY)) continue
      if (screenY < horizonPx + 4 || screenY > sh + 20) continue

      const scaledW = pgr._scaleAtRow?.(tileRow + 1)
      if (!scaledW || !isFinite(scaledW)) continue

      const crestH = maxAmp * (scaledW / ts)
      if (crestH < 0.5) continue

      const rowPhaseOffset = (tileRow * 0.618) % (Math.PI * 2)
      const pts = []
      for (let c = -2; c <= mapW + 4; c++) {
        const screenX = pgr._colToScreenX?.(c + 0.5, tileRow)
        if (!isFinite(screenX)) continue
        let sum = 0, weightSum = 0
        for (const w of this._estWaves) {
          sum       += Math.sin(w.phase + c / w.wavelength * Math.PI * 2
            + rowPhaseOffset * (w.speed * 8)) * w.amplitude
          weightSum += w.amplitude
        }
        const norm  = weightSum > 0 ? sum / weightSum : 0
        const sharp = Math.sign(norm) * Math.pow(Math.abs(norm), 0.6)
        const cy    = screenY - crestH * 0.5 * (1 + sharp)
        if (isFinite(cy)) pts.push({ x: screenX, y: cy })
      }
      if (pts.length < 2) continue

      const horizonFade = Math.max(0, Math.min(1, (screenY - horizonPx) / 40))
      const baseAlpha   = eff * horizonFade

      ctx.save()

      // Shadow trough
      const shadowH = crestH * 0.45
      if (shadowH > 1) {
        ctx.beginPath()
        pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y))
        for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].y - shadowH)
        ctx.closePath()
        try {
          const sg = ctx.createLinearGradient(0, screenY - crestH - shadowH, 0, screenY - crestH * 0.3)
          sg.addColorStop(0,   'rgba(6,14,32,0)')
          sg.addColorStop(0.4, `rgba(8,18,42,${(baseAlpha * 0.28).toFixed(2)})`)
          sg.addColorStop(1,   `rgba(12,24,52,${(baseAlpha * 0.45).toFixed(2)})`)
          ctx.fillStyle = sg; ctx.fill()
        } catch(e) {}
      }

      // Crest highlight — varies along length
      ctx.globalAlpha = baseAlpha
      for (let pi = 0; pi < pts.length - 1; pi++) {
        const pt0 = pts[pi], pt1 = pts[pi + 1]
        if (!pt0 || !pt1) continue
        const hf = Math.max(0, (screenY - pt0.y) / crestH)
        const lw = Math.max(0.6, crestH * 0.28 * (0.5 + hf * 0.8))
        ctx.beginPath(); ctx.moveTo(pt0.x, pt0.y); ctx.lineTo(pt1.x, pt1.y)
        ctx.strokeStyle = `rgba(220,238,255,${(baseAlpha * (0.4 + hf * 0.6)).toFixed(2)})`
        ctx.lineWidth = lw; ctx.stroke()
      }

      // Belly gradient
      const bellyH = crestH * 0.75
      const gradY0 = screenY - crestH * 0.85
      const gradY1 = gradY0 + bellyH
      if (isFinite(gradY0) && isFinite(gradY1) && Math.abs(gradY1 - gradY0) > 1) {
        ctx.beginPath()
        pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y))
        for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].y + bellyH)
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

      ctx.restore()
    }
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

  shutdown() {
    this._destroyEstuaryWaves()
    if (this._swallows) { this._swallows.stop(); this._swallows = null }
    // Also remove any lingering swallow canvas directly
    document.getElementById('swallow-canvas')?.remove()
    super.shutdown?.()
  }

}

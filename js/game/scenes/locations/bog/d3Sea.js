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
  onPGRDrawComplete(oCtx) { }

  onPGRDrawComplete(oCtx) {
    this._updateEstuaryWaves(0)
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
      'z-index:3','pointer-events:none',
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

    // Advance wave phases
    for (const w of this._estWaves) {
      w.phase += w.speed
    }

    const ctx = this._estWaveCtx
    // Always sync to actual window size — pgr._sw may lag after fullscreen
    const sw = pgr._sw || window.innerWidth
    const sh = pgr._sh || window.innerHeight
    const cw = Math.round(sw), ch = Math.round(sh)
    if (this._estWaveCanvas.width !== cw || this._estWaveCanvas.height !== ch) {
      this._estWaveCanvas.width  = cw
      this._estWaveCanvas.height = ch
    }
    ctx.clearRect(0, 0, sw, sh)
    const mapH      = this.mapData?.layers?.[0]?.length ?? 36
    const mapW      = this.mapData?.layers?.[0]?.[0]?.length ?? 36
    const ts        = this.tileSize
    const horizonPx = pgr._horizonPx?.() ?? sh * 0.28
    const eff       = 0.35   // fixed calm intensity for estuary
    const rowStep   = 3.5
    const maxAmp    = ts * eff * 0.55

    // Clip to below horizon
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
      if (segments.length === 0) continue

      // Find water tile extent for this row — clip waves to water only
      const _allPts = segments.flat()
      let rowMinX = _allPts[0]?.x ?? 0, rowMaxX = _allPts[_allPts.length - 1]?.x ?? sw
      // Check which columns have water tiles
      const layer0 = this.mapData?.layers?.[0]
      if (layer0?.[Math.round(tileRow)]) {
        const row = layer0[Math.round(tileRow)]
        let firstWater = -1, lastWater = -1
        for (let c = 0; c < row.length; c++) {
          if (row[c] === 1625 || row[c] === 1679) {
            if (firstWater < 0) firstWater = c
            lastWater = c
          }
        }
        if (firstWater >= 0) {
          rowMinX = pgr._colToScreenX?.(firstWater, tileRow) ?? rowMinX
          rowMaxX = pgr._colToScreenX?.(lastWater + 1, tileRow) ?? rowMaxX
        }
      }

      const horizonFade = Math.max(0, Math.min(1, (screenY - horizonPx) / 40))
      const baseAlpha   = eff * horizonFade

      ctx.save()
      // Clip to water tile extent for this row
      ctx.beginPath()
      ctx.rect(rowMinX, horizonPx, rowMaxX - rowMinX, sh - horizonPx)
      ctx.clip()

      // Shadow trough
      const shadowH = crestH * 0.45
      if (shadowH > 1) {
        for (const seg of segments) {
          if (seg.length < 2) continue
          ctx.beginPath()
          seg.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y))
          for (let i = seg.length - 1; i >= 0; i--) ctx.lineTo(seg[i].x, seg[i].y - shadowH)
        ctx.closePath()
        try {
          const sg = ctx.createLinearGradient(0, screenY - crestH - shadowH, 0, screenY - crestH * 0.3)
          sg.addColorStop(0,   'rgba(6,14,32,0)')
          sg.addColorStop(0.4, `rgba(8,18,42,${(baseAlpha * 0.28).toFixed(2)})`)
          sg.addColorStop(1,   `rgba(12,24,52,${(baseAlpha * 0.45).toFixed(2)})`)
          ctx.fillStyle = sg; ctx.fill()
        } catch(e) {}
      }

      // Crest highlight — draw each water segment
      ctx.globalAlpha = baseAlpha
      for (const seg of segments) {
        for (let pi = 0; pi < seg.length - 1; pi++) {
          const pt0 = seg[pi], pt1 = seg[pi + 1]
          if (!pt0 || !pt1) continue
          const hf = Math.max(0, (screenY - pt0.y) / crestH)
          const lw = Math.max(0.6, crestH * 0.28 * (0.5 + hf * 0.8))
          ctx.beginPath(); ctx.moveTo(pt0.x, pt0.y); ctx.lineTo(pt1.x, pt1.y)
          ctx.strokeStyle = `rgba(220,238,255,${(baseAlpha * (0.4 + hf * 0.6)).toFixed(2)})`
          ctx.lineWidth = lw; ctx.stroke()
        }
      }

      // Belly gradient — draw each water segment
      const bellyH = crestH * 0.75
      const gradY0 = screenY - crestH * 0.85
      const gradY1 = gradY0 + bellyH
      if (isFinite(gradY0) && isFinite(gradY1) && Math.abs(gradY1 - gradY0) > 1) {
        for (const seg of segments) {
          if (seg.length < 2) continue
          ctx.beginPath()
          seg.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y))
          for (let i = seg.length - 1; i >= 0; i--) ctx.lineTo(seg[i].x, seg[i].y + bellyH)
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
    ctx.restore()  // release outer horizon clip
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

  shutdown() {
    this._destroyEstuaryWaves()
    if (this._swallows) { this._swallows.stop(); this._swallows = null }
    // Also remove any lingering swallow canvas directly
    document.getElementById('swallow-canvas')?.remove()
    super.shutdown?.()
  }

}

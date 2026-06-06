// WaveRenderer.js
// Location: js/game/effects/waveRenderer.js
//
// Composite wave system for d3_open_sea.
// Horses use asymmetric dolphin-leap easing with rotation.
// Dive burst spray fires at the moment of re-entry.

export default class WaveRenderer {

  static WAVE_COUNT      = 6
  static HORSE_COUNT     = 22
  static MANANNAN_START  = 0.84

  constructor(scene, pgr) {
    this.scene        = scene
    this.pgr          = pgr
    this.intensity    = 0
    this.eastProgress = 0
    this._t           = 0

    this.wavePhaseAtPlayer = 0
    this.waveAmpAtPlayer   = 0
    this.waveRideT         = 0
    this.waveRideAmp       = 0

    this._manannánSurfaceT = 0
    this._manannánWorldX   = null
    this._manannánWorldY   = null
    this._manannánFixed    = false

    this._waves = []
    for (let i = 0; i < WaveRenderer.WAVE_COUNT; i++) {
      this._waves.push({
        speed:      0.010 + i * 0.006,
        amplitude:  0.20  + i * 0.07,
        wavelength: 4.0   + i * 1.3,
        rowOffset:  (i % 3) * 0.33,
        phase:      Math.random() * Math.PI * 2,
        alpha:      0.60  - i * 0.06,
      })
    }

    this._horses = this._buildHorses()
    this._foam   = []
    this._spray  = []
    this._lastFountain    = 0
    this._lastBottomSpray = 0

    this._horseImgs = []
    for (let i = 1; i <= 4; i++) {
      const img = new Image()
      img.src = `/assets/horse${i}.png`
      this._horseImgs.push(img)
    }
    this._manannánImg = new Image()
    this._manannánImg.src = '/assets/manannan.png'

    const container = scene.game.canvas.parentNode
    const stale = document.getElementById('pgr-waves')
    if (stale) stale.parentNode?.removeChild(stale)

    this._canvas = document.createElement('canvas')
    this._canvas.id = 'pgr-waves'
    this._canvas.width  = pgr._sw
    this._canvas.height = pgr._sh
    this._canvas.style.cssText = [
      'position:absolute', 'top:0', 'left:0',
      'z-index:3', 'pointer-events:none',
      'image-rendering:pixelated',
    ].join(';')
    const lightCanvas = document.getElementById('pgr-light')
    if (lightCanvas) container.insertBefore(this._canvas, lightCanvas)
    else container.appendChild(this._canvas)

    this._ctx = this._canvas.getContext('2d')
    this._ctx.imageSmoothingEnabled = false
    console.log('[WaveRenderer] constructed, mapW:',
      scene.mapData?.layers?.[0]?.[0]?.length ?? 'unknown')
  }

  // ── Horse factory ─────────────────────────────────────────────────────────

  _buildHorses() {
    const ts   = this.pgr.tileDisplaySize
    const mapW = this.scene.mapData?.layers?.[0]?.[0]?.length ?? 72
    const mapH = this.scene.mapData?.layers?.[0]?.length ?? 36
    const horses = []

    for (let i = 0; i < WaveRenderer.HORSE_COUNT; i++) {
      const frac    = i / Math.max(1, WaveRenderer.HORSE_COUNT - 1)
      // Spread horses more evenly — use golden ratio to avoid clumping
      const goldenFrac = ((i * 0.618033) % 1.0)
      const tileX   = mapW * (0.30 + goldenFrac * 0.62) + (Math.random() - 0.5) * 4
      // Rows spread linearly not squared — more uniform vertical distribution
      const tileY   = 3 + frac * (mapH - 8) + (Math.random() - 0.5) * 3

      horses.push({
        worldX:      tileX * ts,
        worldY:      tileY * ts,
        risePhase:   Math.random() * Math.PI * 2,
        prevSin:     0,
        riseFreq:    0.7 + Math.random() * 0.5,
        gallopMult:  0.9 + Math.random() * 0.4,
        heightMult:  1.1 + Math.random() * 0.4,
        spriteIndex: i % 4,
      })
    }
    return horses
  }

  _localIntensity(worldX) {
    const tileX = worldX / this.pgr.tileDisplaySize
    return Math.max(0, Math.min(1, tileX / 55))
  }

  setIntensity(v)    { this.intensity    = Math.max(0, Math.min(1, v)) }
  setEastProgress(v) { this.eastProgress = Math.max(0, Math.min(1, v)) }

  triggerHorseSequence() {
    for (const h of this._horses) h.risePhase = Math.PI * 0.5
  }

  triggerHorseSurround() {}

  spawnManannan() {
    const ts   = this.pgr.tileDisplaySize
    const mapH = this.scene.mapData?.layers?.[0]?.length ?? 36
    const p    = this.scene.player
    if (!p) return
    const mapW2      = this.scene.mapData?.width ?? 72
    const playerTileX = Math.floor(p.logicalX / ts)
    const manTileX   = Math.min(mapW2 - 2, playerTileX + 4)
    this._manannánWorldX   = manTileX * ts
    this._manannánWorldY   = Math.floor(p.logicalY / ts) * ts
    this._manannánSurfaceT = 0
    this._manannánFixed    = false
    console.log('[WaveRenderer] Manannan spawned at tileX:', manTileX)
  }

  // ── Dolphin leap curve ────────────────────────────────────────────────────
  // Asymmetric: slow graceful rise, faster nose-first dive.
  // Returns surfaceT (0=submerged, 1=peak) and velT (-1=diving fast, +1=rising)

  _dolphinCurve(risePhase) {
    const s = Math.sin(risePhase)
    const c = Math.cos(risePhase)   // velocity proxy

    // Only positive half emerges
    if (s <= 0) return { surfaceT: 0, velT: c }

    // Asymmetric easing:
    // Rising (c > 0): ease-out — starts fast, slows at peak
    // Falling (c < 0): ease-in — slow at peak, accelerates into dive
    let surfaceT
    if (c >= 0) {
      // Rising: power < 1 = ease-out (fast start)
      surfaceT = Math.pow(s, 0.7)
    } else {
      // Falling: power > 1 = ease-in (slow at top, fast into water)
      surfaceT = Math.pow(s, 0.5)
    }

    return { surfaceT, velT: c }
  }

  // ── Main update ───────────────────────────────────────────────────────────

  update(delta) {
    const dt = Math.min(delta / 1000, 0.05)
    this._t += dt

    if (!this._canvas || !this._ctx) return

    if (this._canvas.width  !== this.pgr._sw ||
        this._canvas.height !== this.pgr._sh) {
      this._canvas.width  = this.pgr._sw
      this._canvas.height = this.pgr._sh
    }

    for (const w of this._waves) {
      w.phase += w.speed * (1 + this.intensity * 2.2)
    }

    const driftSpeed = Math.abs(this.scene._currentDriftOverride ?? 18)
    const ts   = this.pgr.tileDisplaySize
    const mapW = this.scene.mapData?.layers?.[0]?.[0]?.length ?? 72
    const mapH = this.scene.mapData?.layers?.[0]?.length ?? 36

    const activeCount = Math.min(
      WaveRenderer.HORSE_COUNT,
      Math.floor(Math.max(0, this.intensity + 0.15) * WaveRenderer.HORSE_COUNT)
    )

    for (let i = 0; i < this._horses.length; i++) {
      const h = this._horses[i]
      const prevSin = h.prevSin ?? Math.sin(h.risePhase)
      if (!this._horseLogged && i === 0) {
        this._horseLogged = true
        console.log('[horse] i:0 prevSin:', prevSin.toFixed(3), 'activeCount:', activeCount, 'horses:', this._horses.length)
      }

      h.risePhase += h.riseFreq * dt * (1 + this.intensity * 0.6)
      h.worldX    -= driftSpeed * dt

      const curSin    = Math.sin(h.risePhase)
      const curCos    = Math.cos(h.risePhase)  // positive = rising, negative = falling
      h.prevSin       = curSin
      const submerged = curSin <= 0.02

      // Fire burst on emergence — horse breaking surface going up
      const wasUnder  = prevSin <= 0.08
      const nowRising = curSin > 0.08 && curCos > 0
      const diving    = wasUnder && nowRising && !h._diveFired
      if (diving) h._diveFired = true
      if (curSin < 0.02) h._diveFired = false  // reset when fully submerged
      if (diving && i < activeCount) {
        this._spawnDiveBurst(h)
        console.log('[spray] dive burst fired, spray len:', this._spray.length, 'localI:', this._localIntensity(h.worldX).toFixed(2))
      }

      // Recycle only when submerged
      if (h.worldX < -4 * ts && submerged) {
        const playerX = this.scene.player?.logicalX ?? mapW * ts * 0.5
        // Spread recycle positions evenly across visible east band
        const _gfrac = Math.random()
        h.worldX    = playerX + ts * (6 + _gfrac * 32)
        h.worldY    = (3 + Math.random() * (mapH - 8)) * ts
        h.risePhase = Math.random() * Math.PI * 2
      }
    }

    // Manannan
    if (this._manannánWorldX !== null) {
      if (!this._manannánFixed) {
        this._manannánSurfaceT = Math.min(1,
          this._manannánSurfaceT + dt * 0.18)
        if (this._manannánSurfaceT >= 1) {
          this._manannánFixed = true
        }
      }
      const p = this.scene.player
      if (p && !this._manannánFixed) {
        const mapW3       = this.scene.mapData?.width ?? 72
        const playerTileX = Math.floor(p.logicalX / ts)
        const manTileX2   = Math.min(mapW3 - 2, playerTileX + 4)
        this._manannánWorldX = manTileX2 * ts
        this._manannánWorldY = Math.floor(p.logicalY / ts) * ts
      }
    }

    // Boat sync
    const p = this.scene.player
    if (p) {
      const col  = p.logicalX / ts
      const w0   = this._waves[0]
      this.wavePhaseAtPlayer = w0.phase + col / w0.wavelength * Math.PI * 2
      const scaledW = this.pgr._scaleAtRow(p.logicalY / ts + 1)
      if (scaledW && isFinite(scaledW)) {
        const eff2 = 0.45 + this.intensity * 0.55
        let waveSum = 0, wAmpSum = 0
        for (const w of this._waves) {
          waveSum  += Math.sin(w.phase + col / w.wavelength * Math.PI * 2) * w.amplitude
          wAmpSum  += w.amplitude
        }
        const norm      = wAmpSum > 0 ? waveSum / wAmpSum : 0
        const sharpened = Math.sign(norm) * Math.pow(Math.abs(norm), 0.6)
        this.waveRideT   = sharpened
        const _pRow      = p.logicalY / ts
        const _scaledW2  = this.pgr._scaleAtRow(_pRow + 1) ?? ts
        const _eff2      = 0.45 + this.intensity * 0.55
        this.waveRideAmp = ts * _eff2 * 0.55 * (_scaledW2 / ts) * (1 + this.intensity * 0.6)
        this.waveAmpAtPlayer = w0.amplitude * eff2 * scaledW * 0.85
      }
    }

    if (!this._horseImgsLogged) {
      this._horseImgsLogged = true
      this._horseImgs.forEach((img, idx) =>
        console.log(`[WaveRenderer] horse${idx+1}.png complete:`,
          img.complete, 'w:', img.naturalWidth))
    }

    const fountainInterval = Math.max(150, 1200 - this.intensity * 1000)
    if (this._t * 1000 - this._lastFountain > fountainInterval) {
      this._lastFountain = this._t * 1000
      if (this.intensity > 0.25) this._spawnFountain()
    }

    const bottomInterval = Math.max(600, 2500 - this.intensity * 1800)
    if (this._t * 1000 - this._lastBottomSpray > bottomInterval) {
      this._lastBottomSpray = this._t * 1000
      if (this.intensity > 0.15) { this._spawnBottomSpray(); console.log('[bottom] fired, spray len:', this._spray.length, 'intensity:', this.intensity.toFixed(2)) }
    }

    const ctx = this._ctx
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height)
    // Clip entire wave canvas to below horizon + safety margin
    const _horizonPx = (this.pgr._horizonPx?.() ?? 0) + 4
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, _horizonPx, this._canvas.width, this._canvas.height - _horizonPx)
    ctx.clip()
    this._drawWaves(ctx)
    this._drawHorses(ctx)
    this._drawManannan(ctx)
    this._updateFoam(dt)
    this._drawFoam(ctx)
    if (this._spray.length > 0 && !this._sprayDrawLogged) {
      this._sprayDrawLogged = true
      console.log('[spray] drawing', this._spray.length, 'particles, first:', JSON.stringify(this._spray[0]))
    }
    this._updateSpray(delta)  // spray uses ms, not seconds
    this._drawSpray(ctx)
  }

  // ── Wave crests ───────────────────────────────────────────────────────────

  _drawWaves(ctx) {
    const pgr       = this.pgr
    const mapH      = this.scene.mapData?.layers?.[0]?.length ?? 36
    const mapW      = this.scene.mapData?.layers?.[0]?.[0]?.length ?? 72
    const ts        = pgr.tileDisplaySize
    const horizonPx = pgr._horizonPx()
    const eff       = 0.45 + this.intensity * 0.55

    const baseStep = 3.2
    const rowStep  = baseStep + this.intensity * 2.0

    const maxAmp = ts * eff * 0.55

    for (let tileRow = 2; tileRow < mapH - 2; tileRow += rowStep) {
      const screenY = pgr._rowToScreenY(tileRow + 1)
      if (screenY === null || !isFinite(screenY)) continue
      if (screenY < horizonPx + 4 || screenY > pgr._sh + 20) continue

      const scaledW = pgr._scaleAtRow(tileRow + 1)
      if (!scaledW || !isFinite(scaledW)) continue

      const depthScale = scaledW / ts
      const crestH     = maxAmp * depthScale * (1 + this.intensity * 0.6)
      if (crestH < 0.8) continue

      const rowPhaseOffset = (tileRow * 0.618) % (Math.PI * 2)

      const pts = []
      for (let c = -2; c <= mapW + 4; c++) {
        const screenX = pgr._colToScreenX(c + 0.5, tileRow)
        if (!isFinite(screenX)) continue
        let sum = 0, weightSum = 0
        for (const w of this._waves) {
          const contribution = Math.sin(w.phase + c / w.wavelength * Math.PI * 2
            + rowPhaseOffset * (w.speed * 8))
          sum       += contribution * w.amplitude
          weightSum += w.amplitude
        }
        const normalised = weightSum > 0 ? sum / weightSum : 0
        const sharpPow   = Math.max(0.5, 0.7 - this.intensity * 0.2)
        const sharp      = Math.sign(normalised) * Math.pow(Math.abs(normalised), sharpPow)
        const cy = screenY - crestH * 0.5 * (1 + sharp)
        if (isFinite(cy)) pts.push({ x: screenX, y: cy })
      }
      if (pts.length < 2) continue

      const distFromHorizon = screenY - horizonPx
      const horizonFade = distFromHorizon < 40 ? Math.max(0, distFromHorizon / 40) : 1.0
      const baseAlpha   = eff * horizonFade

      ctx.save()

      // Shadow trough
      const shadowH = crestH * (0.45 + this.intensity * 0.35)
      if (shadowH > 1) {
        ctx.beginPath()
        pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y))
        for (let i = pts.length - 1; i >= 0; i--) {
          ctx.lineTo(pts[i].x, pts[i].y - shadowH)
        }
        ctx.closePath()
        try {
          const sg = ctx.createLinearGradient(0, screenY - crestH - shadowH, 0, screenY - crestH * 0.3)
          sg.addColorStop(0,   'rgba(6,14,32,0)')
          sg.addColorStop(0.4, `rgba(8,18,42,${(baseAlpha * 0.28).toFixed(2)})`)
          sg.addColorStop(1,   `rgba(12,24,52,${(baseAlpha * 0.45).toFixed(2)})`)
          ctx.fillStyle = sg
          ctx.fill()
        } catch(e) {}
      }

      // Crest highlight — brightness varies along length
      ctx.globalAlpha = baseAlpha
      for (let pi = 0; pi < pts.length - 1; pi++) {
        const pt0 = pts[pi], pt1 = pts[pi + 1]
        if (!pt0 || !pt1) continue
        const heightFrac = Math.max(0, (screenY - pt0.y) / crestH)
        const brightness = 0.4 + heightFrac * 0.6
        const lw = Math.max(0.8, crestH * 0.30 * (0.5 + heightFrac * 0.8))
        ctx.beginPath()
        ctx.moveTo(pt0.x, pt0.y)
        ctx.lineTo(pt1.x, pt1.y)
        ctx.strokeStyle = `rgba(228,242,255,${(baseAlpha * brightness).toFixed(2)})`
        ctx.lineWidth   = lw
        ctx.stroke()
      }

      // Belly — semi-transparent, storm colour
      const stormT = this.intensity
      const waterR = Math.round(45 + stormT * 15)
      const waterG = Math.round(65 + stormT * 10)
      const waterB = Math.round(105 - stormT * 25)
      const crestR = Math.round(160 - stormT * 40)
      const crestG = Math.round(195 - stormT * 30)
      const crestB = Math.round(230 - stormT * 20)

      const bellyH = crestH * 0.75
      const gradY0 = screenY - crestH * 0.85
      const gradY1 = gradY0 + bellyH
      if (isFinite(gradY0) && isFinite(gradY1) && Math.abs(gradY1 - gradY0) > 1) {
        ctx.beginPath()
        pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y))
        for (let i = pts.length - 1; i >= 0; i--) {
          ctx.lineTo(pts[i].x, pts[i].y + bellyH)
        }
        ctx.closePath()
        try {
          const lg = ctx.createLinearGradient(0, gradY0, 0, gradY1)
          lg.addColorStop(0,    `rgba(${crestR},${crestG},${crestB},${(baseAlpha * 0.82).toFixed(2)})`)
          lg.addColorStop(0.25, `rgba(${crestR-20},${crestG-20},${crestB-10},${(baseAlpha * 0.72).toFixed(2)})`)
          lg.addColorStop(0.6,  `rgba(${waterR+20},${waterG+20},${waterB+10},${(baseAlpha * 0.55).toFixed(2)})`)
          lg.addColorStop(1,    `rgba(${waterR},${waterG},${waterB},${(baseAlpha * 0.35).toFixed(2)})`)
          ctx.fillStyle = lg
          ctx.fill()
        } catch(e) {}

        // Water tile texture overlay
        const waterTile = this.pgr._getTileCanvas?.(1625)
        if (waterTile) {
          try {
            ctx.save()
            ctx.beginPath()
            pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y))
            for (let i = pts.length - 1; i >= 0; i--) {
              ctx.lineTo(pts[i].x, pts[i].y + bellyH)
            }
            ctx.closePath()
            ctx.clip()
            const tileW  = waterTile.width * (scaledW / ts) * 1.5
            const tileH2 = waterTile.height * (scaledW / ts) * 1.5
            const startX = pts[0]?.x ?? 0
            ctx.globalAlpha = baseAlpha * 0.12
            ctx.globalCompositeOperation = 'overlay'
            for (let tx = startX - tileW; tx < (pts[pts.length-1]?.x ?? pgr._sw) + tileW; tx += tileW) {
              ctx.drawImage(waterTile, tx, gradY0, tileW, tileH2)
            }
            ctx.restore()
          } catch(e) {}
        }
      }

      ctx.restore()
    }
  }

  // ── White Horses ──────────────────────────────────────────────────────────
  // Asymmetric dolphin leap with rotation.
  // Leans back on rise, rotates nose-first into dive.
  // Rotation is capped so neck cutoff stays below waterline clip.

  _drawHorses(ctx) {
    const pgr       = this.pgr
    const ts        = pgr.tileDisplaySize
    const horizonPx = pgr._horizonPx()
    const activeCount = Math.min(
      WaveRenderer.HORSE_COUNT,
      Math.floor(Math.max(0, this.intensity + 0.15) * WaveRenderer.HORSE_COUNT)
    )

    for (let i = 0; i < activeCount; i++) {
      const h = this._horses[i]
      if (!h) continue

      const tileX = h.worldX / ts
      const tileY = h.worldY / ts
      if (!isFinite(tileX) || !isFinite(tileY)) continue

      const screenY = pgr._rowToScreenY(tileY + 1)
      if (screenY === null || !isFinite(screenY) || screenY < horizonPx + 4) continue

      const scaledW = pgr._scaleAtRow(tileY + 1)
      if (!scaledW || !isFinite(scaledW)) continue

      const fullH = scaledW * h.heightMult * (0.7 + this.intensity * 0.5)
      if (!isFinite(fullH) || fullH < 1) continue

      const centerX = pgr._colToScreenX(tileX + 0.5, tileY)
      if (!isFinite(centerX)) continue

      const localI = this._localIntensity(h.worldX)

      // Dolphin curve — asymmetric rise/fall
      const { surfaceT, velT } = this._dolphinCurve(h.risePhase)
      const bobAmp    = scaledW * (0.05 + localI * 1.8)
      const cappedBob = Math.min(fullH * 0.85, surfaceT * bobAmp * localI)
      if (cappedBob < 0.5) continue

      // Lean: back on rise, nose-forward on dive
      const maxRotation = 0.22
      const rotation    = velT * surfaceT * maxRotation

      const spriteW = scaledW * 2.6
      const sx      = centerX - spriteW * 0.5
      const sy      = screenY - cappedBob
      if (!isFinite(sy)) continue

      ctx.save()
      ctx.globalAlpha = 1.0

      // Waterline clip
      ctx.beginPath()
      ctx.rect(-9999, horizonPx, 99999, screenY - horizonPx)
      ctx.clip()

      const img = this._horseImgs[h.spriteIndex]
      if (img?.complete && img.naturalWidth > 0) {
        ctx.translate(centerX, screenY)
        ctx.rotate(rotation)
        ctx.translate(-centerX, -screenY)
        ctx.drawImage(img, sx, sy, spriteW, fullH)
      } else {
        this._drawHorseProcedural(ctx, centerX, screenY, scaledW, fullH, cappedBob, rotation)
      }

      ctx.restore()
    }
  }

  _drawHorseProcedural(ctx, centerX, screenY, scaledW, fullH, cappedBob, rotation) {
    if (!isFinite(centerX) || !isFinite(screenY)) return
    const crestW = scaledW * 2.2
    const left   = centerX - crestW * 0.5
    const right  = centerX + crestW * 0.5
    const headX  = centerX - crestW * 0.15
    const top    = screenY - cappedBob - fullH * 0.5
    const bottom = screenY - cappedBob + fullH * 0.5

    ctx.translate(centerX, screenY)
    ctx.rotate(rotation)
    ctx.translate(-centerX, -screenY)

    ctx.beginPath()
    ctx.moveTo(left, bottom)
    ctx.lineTo(left, top + fullH * 0.55)
    ctx.bezierCurveTo(
      left + crestW * 0.12, top + fullH * 0.18,
      headX - crestW * 0.22, top + fullH * 0.05,
      headX, top
    )
    ctx.bezierCurveTo(
      headX + crestW * 0.18, top + fullH * 0.10,
      right - crestW * 0.12, top + fullH * 0.45,
      right, top + fullH * 0.55
    )
    ctx.lineTo(right, bottom)
    ctx.closePath()

    try {
      const g = ctx.createLinearGradient(0, top, 0, bottom)
      g.addColorStop(0,    'rgba(248,252,255,0.96)')
      g.addColorStop(0.35, 'rgba(215,235,255,0.85)')
      g.addColorStop(0.7,  'rgba(160,205,245,0.55)')
      g.addColorStop(1,    'rgba(100,160,220,0.0)')
      ctx.fillStyle = g; ctx.fill()
    } catch(e) { ctx.fillStyle = 'rgba(220,235,255,0.7)'; ctx.fill() }
    ctx.strokeStyle = 'rgba(240,250,255,0.70)'
    ctx.lineWidth   = Math.max(1, scaledW * 0.035)
    ctx.stroke()
  }

  // ── Spray system ────────────────────────────────────────────────────────
  // All positions in screen pixels. Velocities in px/ms. Gravity in px/ms^2.
  // Matches returnCrossing.js splash approach.

  _spawnDiveBurst(h) {
    const pgr     = this.pgr
    const ts      = pgr.tileDisplaySize
    console.log('[diveburst] called, worldX:', h.worldX?.toFixed(0), 'localI:', this._localIntensity(h.worldX).toFixed(2))
    const tileX   = h.worldX / ts
    const tileY   = h.worldY / ts
    const screenY = pgr._rowToScreenY(tileY + 1)
    if (!screenY || !isFinite(screenY)) return
    const scaledW = pgr._scaleAtRow(tileY + 1)
    if (!scaledW || !isFinite(scaledW)) return
    const screenX = pgr._colToScreenX(tileX + 0.5, tileY)
    if (!isFinite(screenX)) return

    const localI = this._localIntensity(h.worldX)
    if (localI < 0.05) return

    const sw = this.pgr._sw || 400
    const sh = this.pgr._sh || 700

    // EPIC plume — supernatural creatures diving face-first
    // Three layers: core column, wide scatter, fine mist
    const baseCount = Math.floor(10 + localI * 25)
    const sh2 = this.pgr._sh || 700
    const baseSpeed = sh2 * 0.6 * (0.5 + localI * 1.2)  // px/s — screen-relative

    for (let i = 0; i < baseCount; i++) {
      const layer = Math.random()
      let spread, spd, r, grav, maxLife

      if (layer < 0.25) {
        // Core column — shoots straight up very fast
        spread  = (Math.random() - 0.5) * 0.5
        spd     = baseSpeed * (1.2 + Math.random() * 0.8)
        r       = Math.max(3, scaledW * (0.06 + Math.random() * 0.08))
        grav    = 400
        maxLife = 1200 + Math.random() * 600
      } else if (layer < 0.65) {
        // Wide scatter — fans out dramatically
        spread  = (Math.random() - 0.5) * 2.4
        spd     = baseSpeed * (0.6 + Math.random() * 1.0)
        r       = Math.max(2, scaledW * (0.03 + Math.random() * 0.06))
        grav    = 600
        maxLife = 800 + Math.random() * 800 * localI
      } else {
        // Fine mist — drifts and rains down slowly
        spread  = (Math.random() - 0.5) * 3.0
        spd     = baseSpeed * (0.2 + Math.random() * 0.5)
        r       = Math.max(1, scaledW * (0.01 + Math.random() * 0.03))
        grav    = 250
        maxLife = 1500 + Math.random() * 1000 * localI
      }

      // Bias westward (negative x) — horses travel west
      const westBias = -0.6 - localI * 0.4
      const angle = -Math.PI / 2 + spread + westBias
      this._spray.push({
        x:       screenX + (Math.random() - 0.5) * scaledW * 2.5,
        y:       screenY - scaledW * 0.2,
        vx:      Math.cos(angle) * spd,
        vy:      Math.sin(angle) * spd,
        life:    0,
        maxLife,
        r,
        bright:  210 + Math.floor(Math.random() * 45),
        floor:   screenY + scaledW * 2,  // can rain well below waterline
        gravity: grav,
      })
    }
    if (this._spray.length > 500) this._spray.splice(0, 60)
  }

  _spawnFountain() {
    const pgr = this.pgr
    const ts  = pgr.tileDisplaySize
    const activeCount = Math.min(WaveRenderer.HORSE_COUNT,
      Math.floor(Math.max(0, this.intensity + 0.15) * WaveRenderer.HORSE_COUNT))
    if (activeCount === 0) return
    const idx = Math.floor(Math.random() * activeCount)
    const h   = this._horses[idx]
    if (!h || h.worldX === undefined) return

    const tileX   = h.worldX / ts
    const tileY   = h.worldY / ts
    const screenY = pgr._rowToScreenY(tileY + 1)
    if (!screenY || !isFinite(screenY)) return
    const scaledW = pgr._scaleAtRow(tileY + 1)
    if (!scaledW || !isFinite(scaledW)) return
    const screenX = pgr._colToScreenX(tileX + 0.5, tileY)
    if (!isFinite(screenX)) return

    const localI = this._localIntensity(h.worldX)
    if (localI < 0.08) return

    const count = Math.floor(4 + localI * 18)
    const speed = scaledW * 0.003 * (0.6 + localI * 1.0)

    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2
      const spd   = speed * (0.4 + Math.random() * 0.8)
      this._spray.push({
        x: screenX + (Math.random() - 0.5) * scaledW,
        y: screenY,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 0, maxLife: 400 + Math.random() * 600 * localI,
        r: Math.max(1, scaledW * (0.02 + Math.random() * 0.05)),
        bright: 215 + Math.floor(Math.random() * 40),
        floor: screenY,
      })
    }
    if (this._spray.length > 500) this._spray.splice(0, 60)
  }

  _spawnBottomSpray() {
    const sw = this.pgr._sw
    const sh = this.pgr._sh
    if (!isFinite(sw) || !isFinite(sh) || sw < 10 || sh < 10) return

    const localI = this.intensity
    if (localI < 0.1) return

    // Randomise: sometimes one big cluster, sometimes scattered smaller ones
    const roll = Math.random()
    const numClusters = roll < 0.4 ? 1 : roll < 0.7 ? 2 : 3

    for (let c = 0; c < numClusters; c++) {
      const clusterX = sw * (0.05 + Math.random() * 0.88)
      // Varied count per cluster
      const count    = Math.floor(3 + localI * (8 + Math.random() * 12))
      // Speed varies — some clusters are violent, some gentle
      const speedMult = 0.4 + Math.random() * 0.8
      const speed     = sh * 0.9 * speedMult * (0.6 + localI * 0.8)  // px/s
      // Angle bias — mostly upward but lean left or right randomly
      const angleBias = (Math.random() - 0.5) * 0.8

      for (let i = 0; i < count; i++) {
        const spread = (Math.random() - 0.5) * 1.2
        const angle  = -Math.PI / 2 + angleBias + spread
        const spd    = speed * (0.5 + Math.random() * 0.8)
        // Vary particle size — mix of large foam chunks and fine mist
        const sizeFrac = Math.random()
        const r = sizeFrac < 0.2
          ? Math.max(4, sw * (0.008 + Math.random() * 0.008))   // large chunk
          : Math.max(1.5, sw * (0.002 + Math.random() * 0.004)) // fine mist
        this._spray.push({
          x:       clusterX + (Math.random() - 0.5) * sw * 0.04,
          y:       sh + 5 + Math.random() * 10,
          vx:      Math.cos(angle) * spd,
          vy:      Math.sin(angle) * spd,
          life:    0,
          maxLife: 1500 + Math.random() * 1500 * localI,
          r,
          bright:  205 + Math.floor(Math.random() * 50),
          floor:   null,
          gravity: 400 + Math.random() * 300,
        })
      }
    }
    if (this._spray.length > 500) this._spray.splice(0, 60)
  }

  _updateSpray(dt) {
    // dt in ms (~16ms/frame). vx/vy in px/ms. gravity accumulates vy.
    // gravity = 0.0014 px/ms per ms = ~1400px/s^2 (strong, visible arc)
    const dts = dt / 1000  // convert ms to seconds
    for (let i = this._spray.length - 1; i >= 0; i--) {
      const s = this._spray[i]
      const grav = s.gravity ?? 700
      s.x    += s.vx * dts
      s.y    += s.vy * dts
      s.vy   += grav * dts   // accumulate downward velocity
      s.life += dt
      if (s.life >= s.maxLife || (s.floor !== null && s.floor !== undefined && s.y > s.floor + 4)) {
        this._spray.splice(i, 1)
      }
    }
  }

  _drawSpray(ctx) {
    const sw = this._canvas?.width  || 400
    const sh = this._canvas?.height || 700
    for (const s of this._spray) {
      if (!isFinite(s.x) || !isFinite(s.y) || !isFinite(s.r)) continue
      if (s.x < -20 || s.x > sw + 20 || s.y < -sh * 0.5 || s.y > sh + 20) continue
      const lifeT = s.life / s.maxLife
      const alpha = lifeT < 0.12 ? lifeT / 0.12 : 1 - Math.pow(lifeT, 1.6)
      if (alpha < 0.01) continue
      ctx.save()
      ctx.globalAlpha = alpha * 0.80
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      const bright = s.bright ?? 225
      ctx.fillStyle = `rgb(${bright},${bright},${Math.min(255, bright + 12)})`
      ctx.fill()
      ctx.restore()
    }
  }

  // ── Manannan Mac Lir  // ── Manannan Mac Lir ──────────────────────────────────────────────────────

  _drawManannan(ctx) {
    if (this._manannánSurfaceT < 0.01 || this._manannánWorldX === null) return

    const pgr       = this.pgr
    const ts        = pgr.tileDisplaySize
    const horizonPx = pgr._horizonPx()

    const tileX   = this._manannánWorldX / ts
    const tileY   = this._manannánWorldY / ts
    const screenY = pgr._rowToScreenY(tileY + 1)
    if (screenY === null || !isFinite(screenY) || screenY < horizonPx + 4) return

    const scaledW = pgr._scaleAtRow(tileY + 1)
    if (!scaledW || !isFinite(scaledW)) return

    const fullH     = scaledW * 3.8
    const centerX   = pgr._colToScreenX(tileX + 0.5, tileY)
    if (!isFinite(centerX)) return

    const cappedBob = Math.min(fullH * 0.9, this._manannánSurfaceT * fullH * 0.9)
    const spriteW   = scaledW * 3.5
    const sx        = centerX - spriteW * 0.5
    const sy        = screenY - cappedBob

    if (!isFinite(sy)) return

    ctx.save()
    ctx.globalAlpha = this._manannánSurfaceT

    ctx.beginPath()
    ctx.rect(sx - 10, horizonPx, spriteW + 20, screenY - horizonPx)
    ctx.clip()

    const img = this._manannánImg
    if (img?.complete && img.naturalWidth > 0) {
      const spriteH = spriteW * (img.naturalHeight / img.naturalWidth)
      ctx.drawImage(img, sx, sy, spriteW, spriteH)
    } else {
      this._drawManannánGoldenWave(ctx, centerX, screenY, scaledW, fullH,
        this._manannánSurfaceT, cappedBob)
    }

    if (this._manannánSurfaceT > 0.3) {
      const glowY = sy + fullH * 0.3
      if (isFinite(glowY)) {
        try {
          const glow = ctx.createRadialGradient(centerX, glowY, 0, centerX, glowY, scaledW * 3.5)
          glow.addColorStop(0,   `rgba(255,215,70,${(this._manannánSurfaceT * 0.38).toFixed(2)})`)
          glow.addColorStop(0.5, `rgba(220,155,25,${(this._manannánSurfaceT * 0.16).toFixed(2)})`)
          glow.addColorStop(1,   'rgba(180,100,0,0)')
          ctx.globalAlpha = this._manannánSurfaceT * 0.9
          ctx.fillStyle   = glow
          ctx.beginPath()
          ctx.arc(centerX, glowY, scaledW * 3.5, 0, Math.PI * 2)
          ctx.fill()
        } catch(e) {}
      }
    }
    ctx.restore()
  }

  _drawManannánGoldenWave(ctx, centerX, screenY, scaledW, fullH, surfaceT, cappedBob) {
    if (!isFinite(centerX) || !isFinite(screenY)) return
    const crestW = scaledW * 3.5
    const left   = centerX - crestW * 0.5
    const right  = centerX + crestW * 0.5
    const top    = screenY - cappedBob - fullH * 0.5
    const bottom = screenY - cappedBob + fullH * 0.5

    ctx.beginPath()
    ctx.moveTo(left, bottom)
    ctx.bezierCurveTo(left + crestW * 0.15, top + fullH * 0.3, centerX - crestW * 0.15, top, centerX, top)
    ctx.bezierCurveTo(centerX + crestW * 0.15, top, right - crestW * 0.15, top + fullH * 0.3, right, bottom)
    ctx.closePath()
    try {
      const g = ctx.createLinearGradient(0, top, 0, bottom)
      g.addColorStop(0,    'rgba(255,225,80,0.96)')
      g.addColorStop(0.3,  'rgba(240,180,45,0.82)')
      g.addColorStop(0.65, 'rgba(200,135,25,0.48)')
      g.addColorStop(1,    'rgba(160,95,0,0.0)')
      ctx.fillStyle = g; ctx.fill()
    } catch(e) { ctx.fillStyle = 'rgba(220,170,40,0.8)'; ctx.fill() }
    ctx.strokeStyle = 'rgba(255,242,160,0.82)'
    ctx.lineWidth   = Math.max(2, scaledW * 0.05)
    ctx.stroke()
    for (let c = 0; c < 3; c++) {
      const cx = centerX + (c - 1) * scaledW * 0.42
      const cy = top - (c === 1 ? scaledW * 0.18 : scaledW * 0.06)
      if (!isFinite(cx) || !isFinite(cy)) continue
      ctx.beginPath()
      ctx.arc(cx, cy, scaledW * 0.09, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,235,100,0.92)'
      ctx.fill()
    }
  }

  // ── Fountains ─────────────────────────────────────────────────────────────



  _updateFoam(dt) {
    for (let i = this._foam.length - 1; i >= 0; i--) {
      const f = this._foam[i]
      f.x    += f.vx * dt * 60
      f.y    += f.vy * dt * 60
      f.vy   += 0.12 * dt * 60
      f.life -= f.decay
      if (f.life <= 0) this._foam.splice(i, 1)
    }
  }

  _drawFoam(ctx) {
    for (const f of this._foam) {
      if (!isFinite(f.x) || !isFinite(f.y) || !isFinite(f.r)) continue
      ctx.save()
      ctx.globalAlpha = f.life * 0.55 * this.intensity
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(235,245,255,1)'
      ctx.fill()
      ctx.restore()
    }
  }

  destroy() {
    this._canvas?.parentNode?.removeChild(this._canvas)
    this._canvas = null
    this._ctx    = null
    console.log('[WaveRenderer] destroyed')
  }
}


// WaveRenderer.js
// Location: js/game/effects/waveRenderer.js
//
// Horses gallop west through the waves, rising and plunging on their own
// sine cycle — independent of player progress. Intensity controls how many
// are active and how vigorous the gallop.
//
// Manannan rises from the waterline upward (bottom-anchored clip).
// He drifts in from east of screen, not fixed at map edge.

export default class WaveRenderer {

  static WAVE_COUNT      = 6
  static HORSE_COUNT     = 6
  static MANANNAN_START  = 0.84

  constructor(scene, pgr) {
    this.scene        = scene
    this.pgr          = pgr
    this.intensity    = 0
    this.eastProgress = 0
    this._t           = 0

    this.wavePhaseAtPlayer = 0
    this.waveAmpAtPlayer   = 0
    this._manannánSurfaceT = 0

    // Manannan world position — drifts in from east with current
    this._manannánWorldX = null   // set when triggered
    this._manannánWorldY = null

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
      'z-index:2', 'pointer-events:none',
      'image-rendering:pixelated',
    ].join(';')
    const objectsCanvas = document.getElementById('pgr-objects')
    if (objectsCanvas) container.insertBefore(this._canvas, objectsCanvas)
    else container.appendChild(this._canvas)

    this._ctx = this._canvas.getContext('2d')
    this._ctx.imageSmoothingEnabled = false
    console.log('[WaveRenderer] constructed, mapW:',
      scene.mapData?.layers?.[0]?.[0]?.length ?? 'unknown')
  }

  // ── Horse factory ─────────────────────────────────────────────────────────
  // Each horse has its own rise/plunge cycle via risePhase.
  // surfaceT = 0.5 + 0.5 * sin(risePhase) — continuously cycling.
  // Horses are spread across rows for perspective variety.

  _buildHorses() {
    const ts   = this.pgr.tileDisplaySize
    const mapW = this.scene.mapData?.layers?.[0]?.[0]?.length ?? 72
    const horses = []

    for (let i = 0; i < WaveRenderer.HORSE_COUNT; i++) {
      const frac  = i / Math.max(1, WaveRenderer.HORSE_COUNT - 1)
      // Spread starting X across east half, staggered
      const tileX = mapW * (0.40 + frac * 0.45) + Math.random() * 5
      // Spread rows across mid-band
      const tileY = 7 + frac * 20 + (Math.random() - 0.5) * 2

      horses.push({
        worldX:      tileX * ts,
        worldY:      tileY * ts,

        // Rise/plunge cycle — each horse on its own phase
        risePhase:   Math.random() * Math.PI * 2,
        riseFreq:    0.55 + Math.random() * 0.35,   // cycles per second
        riseAmp:     0.55 + Math.random() * 0.35,   // 0=never surfaces, 1=fully up

        // Gallop speed multiplier — varies per horse
        gallopMult:  0.85 + Math.random() * 0.35,

        heightMult:  1.3 + Math.random() * 0.5,
        spriteIndex: i % 4,
      })
    }
    return horses
  }

  setIntensity(v)    { this.intensity    = Math.max(0, Math.min(1, v)) }
  setEastProgress(v) { this.eastProgress = Math.max(0, Math.min(1, v)) }

  // ── Sequence triggers ─────────────────────────────────────────────────────

  triggerHorseSequence() {
    console.log('[WaveRenderer] horse sequence triggered')
    // Boost all horses to full rise immediately
    for (const h of this._horses) {
      h.risePhase = Math.PI * 0.5   // sin(π/2) = 1 → fully surfaced
    }
  }

  triggerHorseSurround() {
    console.log('[WaveRenderer] horse surround triggered')
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

    // How many horses are active scales with intensity
    // Below 0.2 intensity: no horses. At 1.0: all active.
    const activeCount = Math.floor(
      Math.max(0, (this.intensity - 0.15) / 0.85) * WaveRenderer.HORSE_COUNT
    )

    for (let i = 0; i < this._horses.length; i++) {
      const h = this._horses[i]

      if (i >= activeCount) {
        // Inactive — drift west but don't render (surfaceT will be 0)
        h.worldX -= driftSpeed * dt * h.gallopMult
        if (h.worldX < -4 * ts) {
          h.worldX = mapW * ts * (0.80 + Math.random() * 0.18)
        }
        continue
      }

      // Active — advance rise phase and drift
      h.risePhase += h.riseFreq * dt * (1 + this.intensity * 0.8)
      // Gallop: drift faster than pure current — they're charging
      h.worldX -= (driftSpeed + 20 + this.intensity * 40) * dt * h.gallopMult

      if (h.worldX < -4 * ts) {
        h.worldX    = mapW * ts * (0.75 + Math.random() * 0.20)
        h.risePhase = Math.random() * Math.PI * 2
      }

      // surfaceT: 0=submerged, 1=fully up. Clamp to [0,1].
      const raw      = 0.5 + 0.5 * Math.sin(h.risePhase)
      const surfaceT = Math.max(0, Math.min(1, raw * h.riseAmp / 0.5))

      // Foam when surfacing
      if (surfaceT > 0.3 && Math.random() < this.intensity * 0.25) {
        const tileY   = h.worldY / ts
        const scaledW = this.pgr._scaleAtRow(tileY + 1)
        if (scaledW && isFinite(scaledW)) {
          this._spawnFoamAt(
            h.worldX, h.worldY, surfaceT,
            scaledW * h.heightMult * (0.6 + this.intensity * 0.5)
          )
        }
      }
    }

    // Manannan — drifts in with current once triggered
    if (this._manannánWorldX !== null) {
      this._manannánWorldX -= driftSpeed * dt * 0.7  // drifts slower than horses
      const manTarget = this.eastProgress >= WaveRenderer.MANANNAN_START
        ? Math.min(1, (this.eastProgress - WaveRenderer.MANANNAN_START) / 0.08)
        : 0
      this._manannánSurfaceT += (manTarget - this._manannánSurfaceT) * 0.025
    }

    // Boat sync
    const p = this.scene.player
    if (p) {
      const col     = p.logicalX / ts
      const w0      = this._waves[0]
      this.wavePhaseAtPlayer = w0.phase - col / w0.wavelength * Math.PI * 2
      const scaledW = this.pgr._scaleAtRow(p.logicalY / ts + 1)
      if (scaledW && isFinite(scaledW)) {
        const eff = 0.15 + this.intensity * 0.85
        this.waveAmpAtPlayer = w0.amplitude * eff * scaledW * 0.85
      }
    }

    if (!this._horseImgsLogged) {
      this._horseImgsLogged = true
      this._horseImgs.forEach((img, i) =>
        console.log(`[WaveRenderer] horse${i+1}.png complete:`,
          img.complete, 'w:', img.naturalWidth))
      console.log('[WaveRenderer] manannan.png complete:',
        this._manannánImg.complete, 'w:', this._manannánImg.naturalWidth)
    }

    const ctx = this._ctx
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height)

    this._drawWaves(ctx)
    this._drawHorses(ctx)
    this._drawManannan(ctx)
    this._updateFoam(dt)
    this._drawFoam(ctx)
  }

  // Called by scene when player reaches Manannan trigger column
  spawnManannan() {
    const ts   = this.pgr.tileDisplaySize
    const mapW = this.scene.mapData?.layers?.[0]?.[0]?.length ?? 72
    const mapH = this.scene.mapData?.layers?.[0]?.length ?? 36
    // Spawn just off the right edge of the visible area — drifts in naturally
    const cam     = this.scene.cameras?.main
    const zoom    = cam?.zoom || 1
    const sw      = this.scene.scale?.width ?? 400
    const visibleCols = sw / (zoom * ts)
    const playerTileX = this.scene.player
      ? Math.floor(this.scene.player.logicalX / ts)
      : mapW * 0.85
    // Spawn ~12 tiles east of player — will drift into view
    this._manannánWorldX = (playerTileX + 12) * ts
    this._manannánWorldY = Math.floor(mapH / 2) * ts
    console.log('[WaveRenderer] Manannan spawned at tileX:',
      playerTileX + 12)
  }

  // ── Wave crests ───────────────────────────────────────────────────────────

  _drawWaves(ctx) {
    const pgr       = this.pgr
    const mapH      = this.scene.mapData?.layers?.[0]?.length ?? 36
    const mapW      = this.scene.mapData?.layers?.[0]?.[0]?.length ?? 72
    const ts        = pgr.tileDisplaySize
    const horizonPx = pgr._horizonPx()
    const eff       = 0.15 + this.intensity * 0.85

    for (const w of this._waves) {
      const amp = w.amplitude * eff * ts * 0.90
      if (amp < 0.5) continue

      for (let tileRow = 2; tileRow < mapH - 2; tileRow += w.wavelength * 0.5) {
        const row     = tileRow + w.rowOffset
        const screenY = pgr._rowToScreenY(row + 1)
        if (screenY === null || !isFinite(screenY)) continue
        if (screenY < horizonPx + 4) continue
        if (screenY > pgr._sh + 20)  continue

        const scaledW = pgr._scaleAtRow(row + 1)
        if (!scaledW || !isFinite(scaledW)) continue

        const crestH = amp * (scaledW / ts) * (1 + this.intensity * 1.2)
        if (!isFinite(crestH) || crestH < 0.5) continue

        const pts = []
        for (let c = -2; c <= mapW + 4; c++) {
          const screenX = pgr._colToScreenX(c + 0.5, row)
          if (!isFinite(screenX)) continue
          const sineVal = Math.sin(w.phase - c / w.wavelength * Math.PI * 2)
          const sharp   = Math.sign(sineVal) *
                          Math.pow(Math.abs(sineVal), 0.6 - this.intensity * 0.3)
          const cy = screenY - crestH * 0.5 - crestH * 0.5 * sharp
          if (isFinite(cy)) pts.push({ x: screenX, y: cy })
        }
        if (pts.length < 2) continue

        ctx.save()
        ctx.globalAlpha = w.alpha * (0.5 + eff * 0.5)

        ctx.beginPath()
        pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y))
        ctx.strokeStyle = `rgba(225,240,255,${(w.alpha * (0.4 + eff * 0.6)).toFixed(2)})`
        ctx.lineWidth   = Math.max(1.5, crestH * 0.45)
        ctx.stroke()

        const gradY0 = screenY - crestH
        const gradY1 = screenY + crestH * 0.4
        if (isFinite(gradY0) && isFinite(gradY1) && gradY0 !== gradY1) {
          ctx.beginPath()
          pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y))
          for (let i = pts.length - 1; i >= 0; i--) {
            ctx.lineTo(pts[i].x, pts[i].y + crestH * 0.65)
          }
          ctx.closePath()
          try {
            const grad = ctx.createLinearGradient(0, gradY0, 0, gradY1)
            grad.addColorStop(0,   `rgba(200,225,255,${(eff * 0.40).toFixed(2)})`)
            grad.addColorStop(0.4, `rgba(155,200,240,${(eff * 0.20).toFixed(2)})`)
            grad.addColorStop(1,   'rgba(90,150,210,0)')
            ctx.fillStyle = grad
            ctx.fill()
          } catch(e) {}
        }
        ctx.restore()
      }
    }
  }

  // ── White Horses ──────────────────────────────────────────────────────────

  _drawHorses(ctx) {
    const pgr       = this.pgr
    const ts        = pgr.tileDisplaySize
    const horizonPx = pgr._horizonPx()
    const activeCount = Math.floor(
      Math.max(0, (this.intensity - 0.15) / 0.85) * WaveRenderer.HORSE_COUNT
    )

    for (let i = 0; i < activeCount; i++) {
      const h = this._horses[i]

      // Compute surfaceT from rise cycle
      const raw      = 0.5 + 0.5 * Math.sin(h.risePhase)
      const surfaceT = Math.max(0, Math.min(1, raw * h.riseAmp / 0.5))
      if (surfaceT < 0.02) continue

      const tileX = h.worldX / ts
      const tileY = h.worldY / ts
      if (!isFinite(tileX) || !isFinite(tileY)) continue

      const screenY = pgr._rowToScreenY(tileY + 1)
      if (screenY === null || !isFinite(screenY)) continue
      if (screenY < horizonPx + 4) continue

      const scaledW = pgr._scaleAtRow(tileY + 1)
      if (!scaledW || !isFinite(scaledW)) continue

      const fullH   = scaledW * h.heightMult * (0.7 + this.intensity * 0.5)
      if (!isFinite(fullH) || fullH < 1) continue

      // Bottom-anchored: horse rises from waterline upward
      const visibleH = fullH * surfaceT
      const centerX  = pgr._colToScreenX(tileX + 0.5, tileY)
      if (!isFinite(centerX)) continue

      // Bob: small vertical oscillation at the waterline
      const bob = Math.sin(h.risePhase * 2.1) * scaledW * 0.03

      ctx.save()
      ctx.globalAlpha = 1.0

      const img = this._horseImgs[h.spriteIndex]
      if (img?.complete && img.naturalWidth > 0) {
        const spriteW = scaledW * 2.6
        const spriteH = spriteW * (img.naturalHeight / img.naturalWidth)
        const sx      = centerX - spriteW * 0.5

        // Clip from bottom upward — waterline is at screenY + bob
        const waterline = screenY + bob
        const clipTop   = waterline - visibleH
        ctx.beginPath()
        ctx.rect(sx - 4, clipTop, spriteW + 8, visibleH + 2)
        ctx.clip()

        // Sprite bottom anchored at waterline
        ctx.drawImage(img, sx, waterline - spriteH, spriteW, spriteH)

        // Foam at waterline
        if (surfaceT < 0.95 && isFinite(waterline) && isFinite(scaledW)) {
          try {
            const foamGrad = ctx.createLinearGradient(
              0, waterline - scaledW * 0.3, 0, waterline)
            foamGrad.addColorStop(0, 'rgba(210,232,255,0.0)')
            foamGrad.addColorStop(1, 'rgba(200,225,255,0.65)')
            ctx.fillStyle = foamGrad
            ctx.fillRect(sx - 4, waterline - scaledW * 0.28,
              spriteW + 8, scaledW * 0.28)
          } catch(e) {}
        }
      } else {
        this._drawHorseProcedural(ctx, centerX, screenY + bob,
          scaledW, fullH, surfaceT)
      }

      ctx.restore()
    }
  }

  _drawHorseProcedural(ctx, centerX, waterline, scaledW, fullH, surfaceT) {
    if (!isFinite(centerX) || !isFinite(waterline) || !isFinite(fullH)) return
    const visibleH = fullH * surfaceT
    const clipTop  = waterline - visibleH
    const crestW   = scaledW * 2.2
    const left     = centerX - crestW * 0.5
    const right    = centerX + crestW * 0.5
    const headX    = centerX - crestW * 0.15
    const top      = waterline - fullH   // full sprite top (may be clipped)

    ctx.beginPath()
    ctx.rect(left - 20, clipTop, crestW + 40, visibleH + 4)
    ctx.clip()

    ctx.beginPath()
    ctx.moveTo(left,  waterline)
    ctx.lineTo(left,  top + fullH * 0.55)
    ctx.bezierCurveTo(
      left  + crestW * 0.12, top + fullH * 0.18,
      headX - crestW * 0.22, top + fullH * 0.05,
      headX, top
    )
    ctx.bezierCurveTo(
      headX + crestW * 0.18, top + fullH * 0.10,
      right - crestW * 0.12, top + fullH * 0.45,
      right, top + fullH * 0.55
    )
    ctx.lineTo(right, waterline)
    ctx.closePath()

    try {
      const bodyGrad = ctx.createLinearGradient(0, top, 0, waterline)
      bodyGrad.addColorStop(0,    'rgba(248,252,255,0.96)')
      bodyGrad.addColorStop(0.35, 'rgba(215,235,255,0.85)')
      bodyGrad.addColorStop(0.7,  'rgba(160,205,245,0.55)')
      bodyGrad.addColorStop(1,    'rgba(100,160,220,0.0)')
      ctx.fillStyle = bodyGrad
      ctx.fill()
    } catch(e) { ctx.fillStyle = 'rgba(220,235,255,0.7)'; ctx.fill() }

    ctx.strokeStyle = 'rgba(240,250,255,0.70)'
    ctx.lineWidth   = Math.max(1, scaledW * 0.035)
    ctx.stroke()

    for (let m = 0; m < 4; m++) {
      const mx  = headX + scaledW * (0.2 + m * 0.38)
      const my  = top   + scaledW * (0.06 + m * 0.09)
      const mLen = scaledW * (0.5 - m * 0.08)
      if (!isFinite(mx) || !isFinite(my) || !isFinite(mLen)) continue
      ctx.beginPath()
      ctx.moveTo(mx, my)
      ctx.lineTo(mx + mLen, my + mLen * 0.14)
      ctx.strokeStyle = `rgba(228,242,255,${((1 - m / 4) * 0.55).toFixed(2)})`
      ctx.lineWidth   = Math.max(0.5, (4 - m) * 0.35)
      ctx.stroke()
    }
  }

  // ── Manannan Mac Lir ──────────────────────────────────────────────────────

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

    const fullH    = scaledW * 3.5
    const visibleH = fullH * this._manannánSurfaceT
    const bob      = Math.sin(this._t * 1.1) * scaledW * 0.05
    const waterline = screenY + bob
    const clipTop   = waterline - visibleH
    const centerX   = pgr._colToScreenX(tileX + 0.5, tileY)
    if (!isFinite(centerX) || !isFinite(waterline)) return

    ctx.save()
    ctx.globalAlpha = 1.0

    const img = this._manannánImg
    if (img?.complete && img.naturalWidth > 0) {
      const spriteW = scaledW * 3.2
      const spriteH = spriteW * (img.naturalHeight / img.naturalWidth)
      const sx      = centerX - spriteW * 0.5

      // Bottom-anchored — rises from waterline upward
      ctx.beginPath()
      ctx.rect(sx - 8, clipTop, spriteW + 16, visibleH + 4)
      ctx.clip()
      ctx.drawImage(img, sx, waterline - spriteH, spriteW, spriteH)
    } else {
      this._drawManannánGoldenWave(ctx, centerX, waterline,
        scaledW, fullH, this._manannánSurfaceT)
    }

    // Golden glow
    if (this._manannánSurfaceT > 0.25 && isFinite(clipTop)) {
      const glowY = clipTop + visibleH * 0.4
      if (isFinite(glowY)) {
        try {
          const glow = ctx.createRadialGradient(
            centerX, glowY, 0, centerX, glowY, scaledW * 3.2)
          glow.addColorStop(0,
            `rgba(255,215,70,${(this._manannánSurfaceT * 0.32).toFixed(2)})`)
          glow.addColorStop(0.5,
            `rgba(220,155,25,${(this._manannánSurfaceT * 0.14).toFixed(2)})`)
          glow.addColorStop(1, 'rgba(180,100,0,0)')
          ctx.globalAlpha = this._manannánSurfaceT * 0.85
          ctx.fillStyle   = glow
          ctx.beginPath()
          ctx.arc(centerX, glowY, scaledW * 3.2, 0, Math.PI * 2)
          ctx.fill()
        } catch(e) {}
      }
    }
    ctx.restore()
  }

  _drawManannánGoldenWave(ctx, centerX, waterline, scaledW, fullH, surfaceT) {
    if (!isFinite(centerX) || !isFinite(waterline) || !isFinite(fullH)) return
    const visibleH = fullH * surfaceT
    const clipTop  = waterline - visibleH
    const top      = waterline - fullH
    const crestW   = scaledW * 3.5
    const left     = centerX - crestW * 0.5
    const right    = centerX + crestW * 0.5

    ctx.beginPath()
    ctx.rect(left - 20, clipTop, crestW + 40, visibleH + 4)
    ctx.clip()

    ctx.beginPath()
    ctx.moveTo(left, waterline)
    ctx.bezierCurveTo(
      left  + crestW * 0.15, top + fullH * 0.3,
      centerX - crestW * 0.15, top,
      centerX, top
    )
    ctx.bezierCurveTo(
      centerX + crestW * 0.15, top,
      right - crestW * 0.15, top + fullH * 0.3,
      right, waterline
    )
    ctx.closePath()

    try {
      const goldGrad = ctx.createLinearGradient(0, top, 0, waterline)
      goldGrad.addColorStop(0,    'rgba(255,225,80,0.96)')
      goldGrad.addColorStop(0.3,  'rgba(240,180,45,0.82)')
      goldGrad.addColorStop(0.65, 'rgba(200,135,25,0.48)')
      goldGrad.addColorStop(1,    'rgba(160,95,0,0.0)')
      ctx.fillStyle = goldGrad
      ctx.fill()
    } catch(e) { ctx.fillStyle = 'rgba(220,170,40,0.8)'; ctx.fill() }

    ctx.strokeStyle = 'rgba(255,242,160,0.82)'
    ctx.lineWidth   = Math.max(2, scaledW * 0.05)
    ctx.stroke()

    // Crown
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

  // ── Foam ──────────────────────────────────────────────────────────────────

  _spawnFoamAt(worldX, worldY, surfaceT, fullH) {
    const pgr     = this.pgr
    const ts      = pgr.tileDisplaySize
    const tileY   = worldY / ts
    const tileX   = worldX / ts
    const screenY = pgr._rowToScreenY(tileY + 1)
    if (!screenY || !isFinite(screenY)) return
    const scaledW = pgr._scaleAtRow(tileY + 1)
    if (!scaledW || !isFinite(scaledW)) return
    const screenX = pgr._colToScreenX(tileX + 0.5, tileY)
    if (!isFinite(screenX)) return

    this._foam.push({
      x:     screenX + (Math.random() - 0.5) * scaledW * 1.6,
      y:     screenY - fullH * surfaceT * Math.random(),
      vx:    scaledW * (0.22 + Math.random() * 0.50),
      vy:   -scaledW * (0.04 + Math.random() * 0.10),
      life:  1.0,
      decay: 0.018 + Math.random() * 0.028,
      r:     Math.max(1, scaledW * (0.03 + Math.random() * 0.05)),
    })
    if (this._foam.length > 220) this._foam.splice(0, 30)
  }

  _updateFoam(dt) {
    for (let i = this._foam.length - 1; i >= 0; i--) {
      const f = this._foam[i]
      f.x    += f.vx * dt * 60
      f.y    += f.vy * dt * 60
      f.vy   += 0.18 * dt * 60
      f.life -= f.decay
      if (f.life <= 0) this._foam.splice(i, 1)
    }
  }

  _drawFoam(ctx) {
    for (const f of this._foam) {
      if (!isFinite(f.x) || !isFinite(f.y) || !isFinite(f.r)) continue
      ctx.save()
      ctx.globalAlpha = f.life * 0.65 * this.intensity
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(235,245,255,1)'
      ctx.fill()
      ctx.restore()
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  destroy() {
    this._canvas?.parentNode?.removeChild(this._canvas)
    this._canvas = null
    this._ctx    = null
    console.log('[WaveRenderer] destroyed')
  }
}


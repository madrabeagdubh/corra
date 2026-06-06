// stormOverlay.js
// Location: js/game/effects/stormOverlay.js
//
// Full storm atmosphere overlay for d3_open_sea.
// Sits above all game canvases as a DOM canvas.
// Lightning is triggered by StormAudio via triggerLightning().

export class StormOverlay {

  constructor(scene) {
    this.scene     = scene
    this.intensity = 0
    this._t        = 0

    this._lightningFlash = 0

    // Rain streaks
    this._rain = []
    for (let i = 0; i < 120; i++) {
      this._rain.push(this._makeRainDrop())
    }

    // Camera tilt
    this._tiltAngle  = 0
    this._tiltTarget = 0
    this._tiltPhase  = Math.random() * Math.PI * 2

    // Build canvas
    const container = scene.game.canvas.parentNode
    const stale = document.getElementById('storm-overlay')
    if (stale) stale.parentNode?.removeChild(stale)

    this._canvas = document.createElement('canvas')
    this._canvas.id = 'storm-overlay'
    this._canvas.width  = window.innerWidth
    this._canvas.height = window.innerHeight
    this._canvas.style.cssText = [
      'position:fixed', 'top:0', 'left:0',
      'width:100%', 'height:100%',
      'z-index:10', 'pointer-events:none',
    ].join(';')
    document.body.appendChild(this._canvas)
    this._ctx = this._canvas.getContext('2d')

    console.log('[StormOverlay] created')
  }

  _makeRainDrop() {
    const sw = window.innerWidth
    const sh = window.innerHeight
    return {
      x:     Math.random() * sw * 1.3 - sw * 0.15,
      y:     Math.random() * sh,
      len:   10 + Math.random() * 22,
      speed: 0.6 + Math.random() * 0.8,
      angle: -0.25 + (Math.random() - 0.5) * 0.15,
      alpha: 0.25 + Math.random() * 0.40,
    }
  }

  setIntensity(v) {
    this.intensity = Math.max(0, Math.min(1, v))
  }

  // Called by StormAudio when thunder fires — syncs lightning flash
  triggerLightning(size) {
    this._lightningFlash = 0.5 + (size ?? 0.5) * 0.5
    // Sometimes double flash
    if (Math.random() < 0.4) {
      setTimeout(() => {
        this._lightningFlash = Math.max(
          this._lightningFlash,
          0.4 + Math.random() * 0.3
        )
      }, 60 + Math.random() * 100)
    }
  }

  update(delta) {
    const dt = delta / 1000
    this._t += delta

    const sw = window.innerWidth
    const sh = window.innerHeight

    if (this._canvas.width  !== sw || this._canvas.height !== sh) {
      this._canvas.width  = sw
      this._canvas.height = sh
    }

    const ctx       = this._ctx
    const intensity = this.intensity
    const t         = intensity

    ctx.clearRect(0, 0, sw, sh)

    // ── Sky darkening ─────────────────────────────────────────────────────
    if (t > 0.05) {
      const horizonY = sh * 0.42
      try {
        const skyAlpha = t * t * 0.75
        const skyGrad  = ctx.createLinearGradient(0, 0, 0, horizonY)
        skyGrad.addColorStop(0,   `rgba(8,12,18,${skyAlpha.toFixed(2)})`)
        skyGrad.addColorStop(0.5, `rgba(12,18,28,${(skyAlpha * 0.6).toFixed(2)})`)
        skyGrad.addColorStop(1,   'rgba(0,0,0,0)')
        ctx.fillStyle = skyGrad
        ctx.fillRect(0, 0, sw, horizonY)
      } catch(e) {}

      if (t > 0.1) {
        try {
          const seaAlpha = (t - 0.1) * 0.45
          const seaGrad  = ctx.createLinearGradient(0, sh * 0.42, 0, sh)
          seaGrad.addColorStop(0, `rgba(18,28,32,${seaAlpha.toFixed(2)})`)
          seaGrad.addColorStop(1, `rgba(10,18,22,${(seaAlpha * 0.6).toFixed(2)})`)
          ctx.fillStyle = seaGrad
          ctx.fillRect(0, sh * 0.42, sw, sh - sh * 0.42)
        } catch(e) {}
      }
    }

    // ── Vignette ──────────────────────────────────────────────────────────
    if (t > 0.05) {
      try {
        const vigAlpha = 0.3 + t * 0.45
        const vig = ctx.createRadialGradient(
          sw * 0.5, sh * 0.5, sh * 0.1,
          sw * 0.5, sh * 0.5, sh * 0.9)
        vig.addColorStop(0,   'rgba(0,0,0,0)')
        vig.addColorStop(0.6, `rgba(0,0,0,${(vigAlpha * 0.3).toFixed(2)})`)
        vig.addColorStop(1,   `rgba(0,0,0,${vigAlpha.toFixed(2)})`)
        ctx.fillStyle = vig
        ctx.fillRect(0, 0, sw, sh)
      } catch(e) {}
    }

    // ── Rain ──────────────────────────────────────────────────────────────
    if (t > 0.1) {
      const rainAlpha = Math.max(0, (t - 0.1) / 0.9)
      const rainCount = Math.floor(rainAlpha * this._rain.length)
      const rainSpeed = sh * (0.4 + t * 0.8)

      ctx.save()
      ctx.strokeStyle = 'rgba(210,230,248,1)'

      for (let i = 0; i < rainCount; i++) {
        const r = this._rain[i]
        r.y += rainSpeed * r.speed * dt
        r.x += Math.tan(r.angle) * rainSpeed * r.speed * dt * 0.3

        if (r.y > sh + 20) {
          r.y = -r.len - Math.random() * sh * 0.3
          r.x = Math.random() * sw * 1.3 - sw * 0.15
        }

        const x2 = r.x + Math.sin(r.angle) * r.len
        const y2 = r.y + Math.cos(r.angle) * r.len

        ctx.globalAlpha = rainAlpha * r.alpha
        ctx.lineWidth   = 0.8 + t * 1.2
        ctx.beginPath()
        ctx.moveTo(r.x, r.y)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }
      ctx.restore()
    }

    // ── Lightning — driven by triggerLightning() only ─────────────────────
    if (this._lightningFlash > 0.005) {
      ctx.save()
      ctx.globalAlpha = this._lightningFlash * 0.65
      ctx.fillStyle   = 'rgba(210,225,255,1)'
      ctx.fillRect(0, 0, sw, sh)
      ctx.restore()
      this._lightningFlash *= Math.pow(0.04, dt)
    }

    // ── Camera tilt ───────────────────────────────────────────────────────
    this._updateCameraTilt(dt, t)
  }

  // Called by StormAudio when thunder fires
  triggerLightning(size) {
    this._lightningFlash = 0.5 + (size ?? 0.5) * 0.5
    // Sometimes double flash
    if (Math.random() < 0.4) {
      setTimeout(() => {
        this._lightningFlash = Math.max(this._lightningFlash, 0.4 + Math.random() * 0.3)
      }, 60 + Math.random() * 100)
    }
  }

  _updateCameraTilt(dt, intensity) {
    const scene = this.scene
    const cam   = scene.cameras?.main
    if (!cam || !scene.player) return

    this._tiltPhase += dt * 0.45

    const waveTilt = Math.sin(this._tiltPhase) * 0.018 * intensity
    const gustTilt = Math.sin(this._tiltPhase * 3.1) * 0.008 * intensity
    this._tiltTarget = waveTilt + gustTilt
    this._tiltAngle += (this._tiltTarget - this._tiltAngle) * Math.min(1, dt * 2.5)

    if (intensity < 0.02) {
      this._tiltAngle = 0
      cam.setRotation(0)
      return
    }

    try { cam.setRotation(this._tiltAngle) } catch(e) {}

    const wavePhase = scene._waveRenderer?.wavePhaseAtPlayer ?? 0
    const waveRise  = Math.sin(wavePhase) * 5 * intensity * intensity
    const sway      = Math.sin(this._tiltPhase * 0.55) * 2.5 * intensity
    const sw        = scene.scale.width
    const sh2       = scene.scale.height
    const zoom      = cam.zoom || 1

    cam.scrollX = scene.player.logicalX - sw  / 2 / zoom + sway
    cam.scrollY = scene.player.logicalY - sh2 / 2 / zoom + waveRise
  }

  destroy() {
    this._canvas?.parentNode?.removeChild(this._canvas)
    this._canvas = null
    this._ctx    = null
    const cam = this.scene.cameras?.main
    if (cam) { try { cam.setRotation(0) } catch(e) {} }
    console.log('[StormOverlay] destroyed')
  }
}


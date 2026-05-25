// swallows.js — fast swooping swallows hunting insects
import { SoundBoard } from '../systems/soundBoard.js'

export class SwallowSystem {
  constructor(horizonFracFn) {
    this._getHorizonFrac = horizonFracFn
    this._canvas = null
    this._ctx    = null
    this._birds  = []
    this._rafId  = null
    this._active = false
    this._lastTime = 0
    // Preload sprite frames
    this._frames = ['assets/swal1.png','assets/swal2.png','assets/swal3.png'].map(src => {
      const img = new Image()
      img.src = src
      return img
    })
    this._frameTime = 0
  }

  start() {
    if (this._active) return
    this._active = true
    this._canvas = document.createElement('canvas')
    this._canvas.id = 'swallow-canvas'
    this._canvas.style.cssText = [
      'position:fixed', 'top:0', 'left:0',
      'width:100%', 'height:100%',
      'pointer-events:none',
      'z-index:9',
    ].join(';')
    document.body.appendChild(this._canvas)
    this._resize()
    window.addEventListener('resize', () => this._resize())
    this._scheduleNext()
    this._loop()
  }

  stop() {
    this._active = false
    if (this._rafId) cancelAnimationFrame(this._rafId)
    if (this._spawnTimer) clearTimeout(this._spawnTimer)
    if (this._canvas) { this._canvas.remove(); this._canvas = null }
    this._birds = []
  }

  _resize() {
    if (!this._canvas) return
    this._canvas.width  = window.innerWidth
    this._canvas.height = window.innerHeight
    this._ctx = this._canvas.getContext('2d')
  }

  _scheduleNext() {
    if (!this._active) return
    const delay = 5000 + Math.random() * 12000
    this._spawnTimer = setTimeout(() => {
      this._spawnFlock()
      this._scheduleNext()
    }, delay)
  }

  _spawnFlock() {
    const W = window.innerWidth
    const H = window.innerHeight
    const horizonY = H * this._getHorizonFrac()
    const skyH = window.innerHeight * 0.9

    const fromLeft = Math.random() < 0.5
    // Usually 1-2, occasionally a burst of 5-8
    const burst = Math.random() < 0.15
    const count = burst ? 5 + Math.floor(Math.random() * 4) : 1 + Math.floor(Math.random() * 2)

    // Lead bird path — series of waypoints for erratic flight
    // Occasional call — not every flock
    if (Math.random() < 0.5) {
      const delay = 200 + Math.random() * 600
      setTimeout(() => SoundBoard.playWeb('SWALLOW_CALL'), delay)
    }

    const startX = fromLeft ? -150 : W + 150
    const startY = skyH * 0.2 + Math.random() * skyH * 0.6

    // Generate 4-6 waypoints across the screen
    const waypoints = [{ x: startX, y: startY }]
    const steps = 5 + Math.floor(Math.random() * 3)
    for (let i = 1; i <= steps; i++) {
      const prevX = waypoints[i-1].x
      const prevY = waypoints[i-1].y
      const dy = (Math.random() - 0.5) * skyH * 0.5
      // Force last waypoint well off the opposite screen edge
      const isLast = i === steps
      const x = isLast
        ? (fromLeft ? W + 200 : -200)
        : prevX + (fromLeft ? W / steps * (0.8 + Math.random() * 0.4) : -W / steps * (0.8 + Math.random() * 0.4))
      waypoints.push({
        x,
        y: Math.max(5, Math.min(window.innerHeight * 0.55, prevY + dy))
      })
    }

    for (let i = 0; i < count; i++) {
      // Each follower bird uses same waypoints but offset slightly
      const xOff = (Math.random() - 0.5) * 40
      const yOff = (Math.random() - 0.5) * 30
      const delay = i * 80 // slight chase delay between birds

      this._birds.push({
        waypoints: waypoints.map(p => ({ x: p.x + xOff, y: p.y + yOff })),
        seg: 0,         // current waypoint segment
        t: 0,           // progress along current segment
        speed: 0.035 + Math.random() * 0.015, // fast!
        delay,
        delayLeft: delay,
        size: 1.2 + Math.random() * 0.8,
        wingPhase: Math.random() * Math.PI * 2,
        bank: 0,
        prevY: 0,
        x: 0, y: 0,
        angle: 0,
        dead: false,
      })
    }
  }

  _loop() {
    if (!this._active) return
    this._rafId = requestAnimationFrame(() => this._loop())
    if (!this._loggedSize) { this._loggedSize = true; console.log('[swallow] canvas:', this._canvas?.width, this._canvas?.height, 'window:', window.innerWidth, window.innerHeight) }
    const ctx = this._ctx
    if (!ctx) return
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height)

    for (const b of this._birds) {
      if (b.delayLeft > 0) { b.delayLeft -= 16; continue }
      if (b.seg >= b.waypoints.length - 1) { b.dead = true; continue }

      // Advance along waypoint path
      const _sFrac = b.y / window.innerHeight
      b.t += b.speed * (_sFrac > 0.5 ? 1 + (_sFrac - 0.5) * 4 : 1)
      if (b.t >= 1) {
        b.t -= 1
        b.seg++
        if (b.seg >= b.waypoints.length - 1) { b.dead = true; continue }
      }

      const p0 = b.waypoints[b.seg]
      const p1 = b.waypoints[b.seg + 1]

      // Smooth catmull-rom through waypoints
      const prevP = b.waypoints[Math.max(0, b.seg - 1)]
      const nextP = b.waypoints[Math.min(b.waypoints.length - 1, b.seg + 2)]
      const t = b.t
      const t2 = t * t, t3 = t2 * t

      b.x = 0.5 * ((2*p0.x) + (-prevP.x+p1.x)*t + (2*prevP.x-5*p0.x+4*p1.x-nextP.x)*t2 + (-prevP.x+3*p0.x-3*p1.x+nextP.x)*t3)
      b.y = 0.5 * ((2*p0.y) + (-prevP.y+p1.y)*t + (2*prevP.y-5*p0.y+4*p1.y-nextP.y)*t2 + (-prevP.y+3*p0.y-3*p1.y+nextP.y)*t3)

      // Direction angle for body orientation
      const nx = 0.5 * ((-prevP.x+p1.x) + (2*prevP.x-5*p0.x+4*p1.x-nextP.x)*2*t + (-prevP.x+3*p0.x-3*p1.x+nextP.x)*3*t2)
      const ny = 0.5 * ((-prevP.y+p1.y) + (2*prevP.y-5*p0.y+4*p1.y-nextP.y)*2*t + (-prevP.y+3*p0.y-3*p1.y+nextP.y)*3*t2)
      const vertVel = b.y - b.prevY
      b.prevY = b.y
      b.bank += (vertVel * 0.15 - b.bank) * 0.12
      b.angle = Math.atan2(ny, nx)

      // Wing flap speed varies with vertical speed — faster in dives
      const vertSpeed = Math.abs(ny)
      b.wingPhase += 0.25 + vertSpeed * 0.01
      const wingSpread = Math.sin(b.wingPhase)

      this._drawSwallow(ctx, b, wingSpread)
    }

    this._birds = this._birds.filter(b => !b.dead)
  }

  _drawSwallow(ctx, b, wingSpread) {
    if (!this._frames?.length) return
    const horizonY = window.innerHeight * this._getHorizonFrac()
    const belowHorizon = Math.max(0, b.y - horizonY)
    const perspScale = 1 + belowHorizon / (window.innerHeight * 0.4)
    const size = b.size * perspScale * 20

    // Always flap — use angle change for speed variation
    b._flapPhase = ((b._flapPhase ?? (b.wingPhase * 6)) + 0.3)
    const cycle = [0,1,2,1,0,1,2,2,1,0]
    const frameIdx = cycle[Math.floor(b._flapPhase) % cycle.length]
    const img = this._frames[frameIdx]
    if (!img.complete || !img.naturalWidth) return

    const flyingLeft = Math.cos(b.angle) < 0
    const bank = b.bank || 0
    const scaleY = 1 - Math.abs(bank) * 0.4
    // Vertical component of angle gives the tilt we want
    const tilt = Math.sin(b.angle) * 0.5

    ctx.save()
    ctx.translate(b.x, b.y)
    // Apply flip FIRST, then tilt — so tilt is always in screen space
    if (flyingLeft) ctx.scale(-1, scaleY)
    else ctx.scale(1, scaleY)
    ctx.rotate(tilt)
    ctx.globalAlpha = 0.82
    ctx.drawImage(img, -size / 2, -size / 2, size, size)
    ctx.restore()
  }
}

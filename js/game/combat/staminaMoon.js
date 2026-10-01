// staminaMoon.js
// Location: js/game/combat/staminaMoon.js
//
// While you stand en garde the brooch's centre shows your stamina: a plain
// circle (not a moon -- the moon stays the language balance), laid on its
// own canvas over the moon, so the real moon and its swipe are untouched.
//
//   its size     your breath: it fills the centre when you're fresh and
//                shrinks as you spend it, growing back as you recover
//   its colour   your hearts: moon-white, warming to amber and then red on
//                your last heart
//   a red ring   winded, or fighting on your last heart
//
// Full and white, it reads as the moon at a glance; that's on purpose.
//
//   const sm = new StaminaMoon()
//   sm.update(melee, player)   every frame
//   sm.destroy()

const lerp = (a, b, k) => a + (b - a) * k
const mix = (c1, c2, k) => c1.map((v, i) => Math.round(lerp(v, c2[i], k)))

export default class StaminaMoon {
  constructor() {
    this.alpha = 0
    this.canvas = null
    this.shown = 1          // the drawn size eases toward the breath, so it breathes rather than jumps
  }

  _ensure() {
    if (this.canvas?.isConnected) return true
    const hub = document.getElementById('dpad-moon-hub')
    if (!hub) return false
    const c = document.createElement('canvas')
    c.id = 'dpad-stamina-moon'
    const d = hub.clientWidth || 62
    const dpr = window.devicePixelRatio || 1
    c.width = c.height = Math.round(d * dpr)
    c.style.cssText = `position:absolute;left:0;top:0;width:${d}px;height:${d}px;pointer-events:none;border-radius:50%;opacity:0;z-index:3;`
    hub.appendChild(c)
    this.canvas = c
    this.ctx = c.getContext('2d')
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.d = d
    return true
  }

  update(m, player) {
    const want = m.enGarde ? 1 : 0
    this.alpha += (want - this.alpha) * 0.12
    if (this.alpha < 0.01 && !want) { if (this.canvas) this.canvas.style.opacity = '0'; return }
    if (!this._ensure()) return
    const ctx = this.ctx, d = this.d, c = d / 2, now = performance.now()
    this.canvas.style.opacity = this.alpha.toFixed(3)
    ctx.clearRect(0, 0, d, d)
    ctx.fillStyle = '#05070d'; ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill()

    const hp = Math.max(0, player.currentHP), max = Math.max(1, player.maxHP)
    const winded = m.winded()
    const breath = winded ? 0 : Math.max(0, Math.min(1, m.breath / Math.max(1, max)))   // of your full breath, so hurt also shows smaller
    this.shown += (breath - this.shown) * 0.2
    const hurt = 1 - hp / max
    const col = hurt < 0.5 ? mix([236, 232, 214], [240, 178, 92], hurt / 0.5) : mix([240, 178, 92], [222, 62, 48], (hurt - 0.5) / 0.5)
    const rMax = c * 0.86, r = Math.max(1.5, rMax * Math.sqrt(this.shown))      // by area, so half the breath looks like half
    // where full would reach: a faint ring, so you see how much is missing
    ctx.strokeStyle = `rgba(${col.join(',')},0.22)`; ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(c, c, rMax, 0, Math.PI * 2); ctx.stroke()
    // the circle, with a soft glow
    const halo = ctx.createRadialGradient(c, c, r * 0.8, c, c, Math.min(c, r * 1.35 + 2))
    halo.addColorStop(0, `rgba(${col.join(',')},0.35)`); halo.addColorStop(1, `rgba(${col.join(',')},0)`)
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = `rgb(${col.join(',')})`; ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.fill()
    // winded, or on your last heart in a bout: a red ring that pulses
    if (winded || (hp <= 1 && m.combat)) {
      const p = 0.5 + 0.5 * Math.sin(now / (winded ? 140 : 220))
      ctx.strokeStyle = `rgba(230,50,40,${0.35 + 0.5 * p})`; ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.arc(c, c, rMax + 2, 0, Math.PI * 2); ctx.stroke()
    }
  }

  destroy() { this.canvas?.remove(); this.canvas = null }
}

// skyeFx.js
// Location: js/game/scenes/locations/skye/skyeFx.js
//
// Small living things for the Tigh Chonaill scenes, drawn straight onto the perspective renderer's object
// canvas (stateless: every position is a function of the clock, so nothing to keep or clean up):
//   hearthFire(scene)             the little fire in the cabin's hearth, a flag that sorts with the figures
//   chimneySmoke(ctx, pgr, t)     smoke from the cottage chimney (outside)
//   Critters                      butterflies and bumblebees over the garden

const now = () => performance.now() / 1000

// ── the hearth fire ─────────────────────────────────────────────────────────────────────
// After the tavern's hearth (village/villageHall.js _drawHearthFlame): a few soft round particles that rise,
// shrink and cool from white-yellow through orange to red, drawn additively, with a slow ember now and then and a
// breathing glow. The hearth front (tighRoom.js) is a plane at row 3.5, its opening centred on col 5.0; the logs top
// out about 0.66 tile above the hearth's foot. A flag, so it sorts with the figures.
const FIRE = { PARTICLES: 7, SPREAD: 0.14, GLOW: 0.55 }
export function hearthFire(scene, { col = 5.0, row = 3.5, z = 0.66, tileX = 4, tileY = 4 } = {}) {
  const pgr = scene.perspectiveGround
  if (!pgr) return null
  const parts = []; let last = 0
  const flag = {
    tileX, tileY, visual: { fire: true }, hidden: false,
    draw: (ctx, _x, _y, _w, g) => {
      const t = performance.now(), dt = Math.min(t - (last || t), 64); last = t
      const y0 = g._rowToScreenY(row), sc = g._scaleAtRow(row)
      if (y0 === null || !(sc > 0)) return
      const cx = g._colToScreenX(col, row), by = y0 - z * sc
      while (parts.length < FIRE.PARTICLES) {
        const ember = Math.random() < 0.16
        parts.push({ ox: (Math.random() - 0.5) * FIRE.SPREAD, oy: 0, vx: (Math.random() - 0.5) * 0.0002, vy: -(0.0004 + Math.random() * 0.0003) * (ember ? 0.6 : 1),
          life: Math.random() * 600, max: ember ? 1500 + Math.random() * 900 : 420 + Math.random() * 520, ember, seed: Math.random() * 6.28 })
      }
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      const flick = 0.78 + 0.14 * Math.sin(t * 0.013) + 0.08 * Math.sin(t * 0.041 + 1.3), R = FIRE.GLOW * sc * flick
      const gr = ctx.createRadialGradient(cx, by, 0, cx, by, R)
      gr.addColorStop(0, `rgba(255,180,90,${(0.18 * flick).toFixed(3)})`); gr.addColorStop(0.45, `rgba(255,120,45,${(0.11 * flick).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,90,25,0)')
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, by, R, 0, Math.PI * 2); ctx.fill()
      for (const p of parts) {
        p.life += dt; p.ox += p.vx * dt; p.oy += p.vy * dt; p.vx *= 0.98
        if (p.life >= p.max) {
          p.ember = Math.random() < 0.16; p.life = 0; p.oy = 0; p.ox = (Math.random() - 0.5) * FIRE.SPREAD
          p.vy = -(0.0004 + Math.random() * 0.0003) * (p.ember ? 0.6 : 1); p.max = p.ember ? 1500 + Math.random() * 900 : 420 + Math.random() * 520; continue
        }
        const k = p.life / p.max
        const px = cx + p.ox * sc + Math.sin(t * 0.006 + p.seed) * sc * 0.03, py = by + p.oy * sc
        const fade = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85, a = Math.max(0, fade) * (p.ember ? 0.5 : 0.85)
        if (a < 0.02) continue
        let r, gg, b
        if (k < 0.4) { r = 255; gg = Math.round(220 - k * 180); b = Math.round(120 - k * 200) } else { r = Math.round(255 - (k - 0.4) * 110); gg = Math.round(110 - (k - 0.4) * 120); b = 30 }
        const size = (p.ember ? 0.035 : 0.07 * (1 - k * 0.6)) * sc
        if (size < 0.4) continue
        ctx.fillStyle = `rgba(${r},${Math.max(0, gg)},${Math.max(0, b)},${a.toFixed(3)})`
        ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
    },
  }
  ;(pgr._encounterFlags ||= []).push(flag)
  return flag
}

// ── smoke ───────────────────────────────────────────────────────────────────────────────
// from the top of the chimney of the 'house' billboard (its texture's middle column, near the top)
export function chimneySmoke(ctx, pgr, t = now(), id = 'house') {
  const b = pgr._buildings?.find(o => o.id === id)
  if (!b?.canvas || b.hidden) return
  const row = b.anchorRow + 1, sc = pgr._scaleAtRow(row), yBase = pgr._rowToScreenY(row)
  if (!(sc > 0) || yBase === null) return
  const wF = b.fw * sc * (b.overscale ?? 1), k = wF / b.canvas.width
  const cx = pgr._colToScreenX(b.x + b.fw / 2, row), top = yBase - wF * (b.canvas.height / b.canvas.width) + 2 * k
  ctx.save()
  const N = 16
  for (let i = 0; i < N; i++) {
    const ph = (t / 7 + i / N) % 1
    const x = cx + (ph * ph * 40 + Math.sin(t * 0.7 + i * 2.1) * 3 * ph) * k, y = top - ph * 64 * k
    const r = k * (2.5 + ph * 8), a = 0.4 * Math.pow(1 - ph, 1.3) * Math.min(1, ph * 9)
    ctx.fillStyle = `rgba(226,222,214,${a})`
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

// ── butterflies and bumblebees ───────────────────────────────────────────────────────────
// list: [{ kind: 'butterfly'|'bee', home: [col, row], r: [rx, ry], colour: '#hex', seed }]
export class Critters {
  constructor(list) { this.list = list }
  draw(ctx, pgr, t = now()) {
    for (const c of this.list) {
      const p = c.seed, [hx, hy] = c.home, [rx, ry] = c.r
      let col, row, z
      if (c.kind === 'bee') {
        col = hx + rx * (Math.sin(t * 0.9 + p) + 0.4 * Math.sin(t * 2.3 + p * 2)) + 0.07 * Math.sin(t * 13 + p)
        row = hy + ry * (Math.sin(t * 0.7 + p * 1.3) + 0.4 * Math.sin(t * 1.9 + p)) + 0.07 * Math.cos(t * 11 + p)
        z = 0.3 + 0.2 * Math.sin(t * 1.7 + p) + 0.03 * Math.sin(t * 19)
      } else {
        col = hx + rx * (Math.sin(t * 0.31 + p) + 0.5 * Math.sin(t * 0.83 + p * 2))
        row = hy + ry * (Math.sin(t * 0.27 + p * 1.7) + 0.5 * Math.sin(t * 0.71 + p))
        z = 0.55 + 0.35 * Math.sin(t * 0.9 + p) + 0.18 * Math.sin(t * 2.3 + p * 3)
      }
      const sc = pgr._scaleAtRow(row), y0 = pgr._rowToScreenY(row)
      if (!(sc > 0) || y0 === null) continue
      const x = pgr._colToScreenX(col, row), y = y0 - z * sc
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.beginPath(); ctx.ellipse(x, y0, sc * 0.09, sc * 0.03, 0, 0, Math.PI * 2); ctx.fill()     // its shadow on the ground
      if (c.kind === 'bee') {
        const s = sc * 0.085
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        const w = 0.5 + 0.5 * Math.sin(t * 90 + p)
        ctx.beginPath(); ctx.ellipse(x - s * 0.2, y - s * 0.7, s * 0.7, s * (0.25 + 0.35 * w), -0.4, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.ellipse(x + s * 0.5, y - s * 0.7, s * 0.6, s * (0.25 + 0.3 * (1 - w)), 0.4, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#e8b52a'; ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.72, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#2a1c0e'; ctx.fillRect(x - s * 0.15, y - s * 0.7, s * 0.4, s * 1.4)
        ctx.beginPath(); ctx.arc(x - s * 0.95, y + s * 0.05, s * 0.4, 0, Math.PI * 2); ctx.fill()
      } else {
        const s = sc * 0.2, flap = Math.abs(Math.sin(t * 11 + p * 5)), w = s * (0.18 + 0.82 * flap)
        ctx.fillStyle = c.colour
        ctx.strokeStyle = 'rgba(30,20,10,0.55)'; ctx.lineWidth = Math.max(1, sc * 0.012)
        for (const sd of [-1, 1]) {
          ctx.beginPath(); ctx.ellipse(x + sd * w * 0.55, y - s * 0.12, w * 0.55, s * 0.5, sd * 0.35, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
          ctx.beginPath(); ctx.ellipse(x + sd * w * 0.4, y + s * 0.3, w * 0.38, s * 0.34, -sd * 0.4, 0, Math.PI * 2); ctx.fill()
        }
        ctx.fillStyle = '#2a1c0e'; ctx.fillRect(x - s * 0.04, y - s * 0.4, Math.max(1.5, s * 0.1), s * 0.8)
      }
      ctx.restore()
    }
  }
}

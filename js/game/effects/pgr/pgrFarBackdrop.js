// pgrFarBackdrop.js — a far sea, drawn in screen space
// Location: js/game/effects/pgr/pgrFarBackdrop.js
//
// For scenes that look out over open water (Skye's faiche). Tiles can only
// reach ~NORTH_PREVIEW_DEPTH rows past the map edge, which in this projection
// is still only ~13% of the way to the horizon -- real distance needs rows in
// the hundreds. So the far field is drawn directly, using the SAME projection
// as the ground so it parallaxes and foreshortens correctly:
//
//   a row d tiles from the camera sits at  horizon + groundH * FL / (FL + d)
//   and is  pxPerTile * (FL + PD) / (FL + d)  px per tile wide.
//
// Painted back to front: sea gradient, glints, island/highland layers (far ->
// near, each foggier than the last), then a haze band over the horizon.
// Called from PGR.update() right after the flat ground fill, before any tile,
// so the nearer preview tiles (islets) and the lawn draw over it.
//
// A scene opts in with  getFarBackdrop() -> cfg  (see skyeFaiche.js).

const hash = (a, b = 0) => {
  let h = (a * 374761393 + b * 668265263) | 0
  h = ((h ^ (h >>> 13)) * 1274126177) | 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}
const vnoise = (x, seed) => {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f)
  return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u
}
const toRGB = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
const css = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`

/**
 * @param {object} cfg  { sea:{horizon,mid,near,glint}, land, layers:[{d,h,freq,cut,sharp,fog,seed}], glints }
 * @param {object} g    { horizonPx, lipY, sw }
 */
export function drawFarBackdrop(pgr, ctx, cfg, g) {
  const { horizonPx, lipY, sw } = g
  if (lipY == null || lipY <= horizonPx + 2) return

  const K = pgr.constructor
  const FL = K.FOCAL_LENGTH, PD = K.PLAYER_DIST_TILES
  const groundH = pgr._groundH()
  const ppt = pgr._pxPerTileAtPlayer()
  const camCol = pgr._perspCamCol()
  const yAtD = d => horizonPx + groundH * FL / (FL + d)
  const sAtD = d => ppt * (FL + PD) / (FL + d)
  const t = performance.now() / 1000

  const cH = toRGB(cfg.sea.horizon), cM = toRGB(cfg.sea.mid), cN = toRGB(cfg.sea.near)
  const land = toRGB(cfg.land)

  ctx.save()

  // ── the sea: pale where it meets the sky, deeper toward us ──
  // run on past the lip: where the coast recedes the sea reaches nearer than row 0
  // (the lawn's tiles are drawn over the spare strip)
  const lipEnd = lipY + (cfg.coveReach ?? 48)
  const y0 = horizonPx - 1, y1 = lipEnd + 2
  const grad = ctx.createLinearGradient(0, y0, 0, y1)
  grad.addColorStop(0, css(cH)); grad.addColorStop(0.4, css(cM)); grad.addColorStop(1, css(cN))
  ctx.fillStyle = grad
  ctx.fillRect(0, y0, sw, y1 - y0)

  // ── glints: short streaks, rows bunched toward the horizon ──
  const rows = cfg.glintRows ?? 64
  const glint = toRGB(cfg.sea.glint ?? '#eef3ee')
  ctx.lineCap = 'round'
  for (let j = 0; j < rows; j++) {
    const f = Math.pow((j + 0.5) / rows, 1.7)
    const y = horizonPx + 3 + (lipEnd - horizonPx - 3) * f
    const d = FL * groundH / (y - horizonPx) - FL
    const s = sAtD(d)
    const per = Math.max(2, Math.round((cfg.glintDensity ?? 5) * (0.35 + f)))
    const near = 0.5 + 0.5 * f                                // fainter far off
    for (let k = 0; k < per; k++) {
      const wx = (hash(j, k * 7 + 1) * 90 - 45) + t * 0.18 * (0.5 + hash(j, 5))   // world cols, drifting
      let x = sw / 2 + (((wx - camCol) % 90 + 135) % 90 - 45) * s * 0.9
      const len = Math.max(2, s * (0.5 + 1.8 * hash(j, k * 7 + 2)))
      const a = (0.10 + 0.22 * hash(j, k * 7 + 3)) * near * (0.55 + 0.45 * Math.sin(t * 0.9 + j * 1.7 + k * 2.3))
      if (a <= 0.01 || x < -len || x > sw + len) continue
      ctx.strokeStyle = css(glint, a)
      ctx.lineWidth = Math.max(1, s * 0.07)
      ctx.beginPath(); ctx.moveTo(x - len / 2, y); ctx.lineTo(x + len / 2, y); ctx.stroke()
    }
  }

  // ── islands and highland coasts: far -> near, each less foggy ──
  const layers = [...cfg.layers].sort((a, b) => b.d - a.d)
  for (const L of layers) {
    const base = yAtD(L.d), s = sAtD(L.d)
    const col = mix(land, cH, L.fog)
    const foot = mix(col, cH, L.foot ?? 0.45)
    const top = base - L.h * s
    const step = 3
    ctx.beginPath()
    ctx.moveTo(-step, base)
    for (let x = -step; x <= sw + step; x += step) {
      const wc = camCol + (x - sw / 2) / s
      const v = vnoise(wc * L.freq, L.seed) * 0.68 + vnoise(wc * L.freq * 2.9, L.seed + 9) * 0.32
      const m = Math.max(0, (v - L.cut) / (1 - L.cut))
      ctx.lineTo(x, base - L.h * s * Math.pow(m, L.sharp ?? 1))
    }
    ctx.lineTo(sw + step, base)
    ctx.closePath()
    const lg = ctx.createLinearGradient(0, top, 0, base)
    lg.addColorStop(0, css(col)); lg.addColorStop(1, css(foot))
    ctx.fillStyle = lg
    ctx.fill()
  }

  // ── haze over the join with the sky ──
  const hz = ctx.createLinearGradient(0, horizonPx - 80, 0, horizonPx + 46)
  hz.addColorStop(0, css(cH, 0)); hz.addColorStop(0.62, css(cH, cfg.hazeAlpha ?? 0.6)); hz.addColorStop(1, css(cH, 0))
  ctx.fillStyle = hz
  ctx.fillRect(0, horizonPx - 80, sw, 126)

  ctx.restore()
}

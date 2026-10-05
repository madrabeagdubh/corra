// tideWater.js
// Location: js/game/scenes/locations/skye/tideWater.js
//
// The sea at the cladach, and the weed it leaves behind. A PGR structure
// provider (see harbourWall.js), drawn on top of the sea TILES so they
// still give the water its colour; this adds what tiles can't:
//
//   • a translucent, slightly deeper surface that stands `lift` above the
//     tile, so at high tide it floods the quay -- the flagstones show
//     through, and it climbs the foot of the first riser;
//   • swell: crests rolling in toward the shore, broken and drifting, the
//     whole surface breathing slowly;
//   • the wall (and everything above the shoreline) reflected, sliced and
//     wobbled -- the same trick as a real puddle;
//   • foam laid along the shore, and a surge that slides up the stone and
//     back again;
//   • at LOW tide, the exposed quay and strand: wet, darker, puddled and
//     strewn with weed.
//
// mapData.tide = { state: 'high'|'low', lift, seaTop, quay:[r0,r1], strand }
// Painted per row, so nearer rows (the jetty, the boat, the player's own
// canvas) correctly overlap it. Deliberately cheap: a handful of rects and
// strokes per visible row.

const hash = (a, b = 0, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0
  h = ((h ^ (h >>> 13)) * 1274126177) | 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

// weed palette: wet, dark, olive and rust-brown
const WEED = ['#2f3a1f', '#3c4a24', '#4a4a24', '#5a4426', '#27321c']
const MORE_ROWS = 10                                   // phantom rows past the map's edge

export default class TideWater {
  /**
   * @param tide   mapData.tide
   */
  constructor(scene, tide) {
    this.scene = scene
    this.tide = tide
    this.t0 = performance.now()
    const mapH = scene.mapData?.height ?? 36
    this.lastRow = mapH + MORE_ROWS
    this.span = this.lastRow - tide.seaTop              // rows of sea, for waves
    // rolling crests: one every few rows, each with its own phase and speed
    this.waves = Array.from({ length: Math.ceil(this.span / 2.4) }, (_, m) => ({
      off: (m * 2.4 + hash(m, 3) * 1.6) % this.span,
      speed: 0.30 + hash(m, 5) * 0.18,
      seed: m * 17 + 3,
    }))
  }

  getEntriesForRow(row) {
    const T = this.tide, out = []
    if (T.state === 'low' && (row === T.strand || (row >= T.quay[0] && row <= T.quay[1])))
      out.push({ draw: (ctx, pgr) => this._drawWeed(ctx, pgr, row) })
    if (row >= T.seaTop && row <= this.lastRow)
      out.push({ draw: (ctx, pgr) => this._drawWater(ctx, pgr, row) })
    return out
  }

  _time() { return (performance.now() - this.t0) / 1000 }

  // ── the sea ───────────────────────────────────────────────────────────────
  _drawWater(ctx, pgr, row) {
    const T = this.tide, lift = T.lift
    const s0 = pgr._scaleAtRow(row), s1 = pgr._scaleAtRow(row + 1)
    if (!s0 || !s1) return
    const sw = pgr._sw, t = this._time()
    const yT = pgr._rowToScreenY(row) - lift * s0
    const yB = pgr._rowToScreenY(row + 1) - lift * s1
    if (yB < 0 || yT > pgr._sh) return
    const k = Math.min(1, (row - T.seaTop) / Math.max(1, this.span - MORE_ROWS))
    const breathe = Math.sin(t * 0.85 + row * 0.6) * 0.5 + 0.5

    ctx.save()

    // surface: clear and green by the wall, deeper and bluer further out
    // murky: silt and weed in it, so what lies under the high water is only a suggestion
    const r = 84 - 58 * k, g = 112 - 50 * k, b = 106 - 36 * k
    const a = (T.state === 'high' ? 0.72 : 0.46) + 0.12 * k + 0.04 * breathe
    ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${a})`
    ctx.fillRect(0, yT - 0.5, sw, yB - yT + 1.5)

    // Sea TILES are always drawn at ground level whatever the vertex heights, while the
    // jetty's grass is drawn raised: below the last raised tile there is a gap, down to
    // where the sea tiles begin. Fill it with sea.
    const J = this.scene.mapData?.jetty
    if (J && T.state === 'high' && row === J.y1 - 1) {
      const x0 = pgr._colToScreenX(J.x0, row + 1), x1 = pgr._colToScreenX(J.x1 + 1, row + 1)
      const yBot = pgr._rowToScreenY(row + 1)
      ctx.fillStyle = '#38566f'
      ctx.fillRect(x0 - 1, yBot - T.lift * s1 - 2, x1 - x0 + 2, T.lift * s1 + 3)
    }

    // the first row: the reflection and the lapping at the stone
    if (row === T.seaTop) this._reflect(ctx, pgr, yT, s0, t)

    // sky sheen: a pale band that slides across with the swell
    const sx = ((t * 14 + row * 37) % (sw + 240)) - 120
    const sh = ctx.createLinearGradient(sx - 120, 0, sx + 120, 0)
    sh.addColorStop(0, 'rgba(220,235,235,0)'); sh.addColorStop(0.5, `rgba(220,235,235,${0.07 + 0.05 * breathe})`)
    sh.addColorStop(1, 'rgba(220,235,235,0)')
    ctx.fillStyle = sh
    ctx.fillRect(0, yT, sw, yB - yT)

    // rolling crests
    this._crests(ctx, pgr, row, yT, yB, s0, t)

    if (row === T.seaTop) this._foam(ctx, pgr, yT, s0, t)
    ctx.restore()

    // The renderer stops drawing rows at the camera, so a band of screen is
    // left under the last one (filled with plain ground colour). Carry the
    // sea down to the bottom of the screen, fading in so there is no seam.
    if (row === Math.floor(pgr._perspCamRow()) - 1 && yB < pgr._sh) {
      const g = ctx.createLinearGradient(0, yB - 14, 0, yB + 24)
      g.addColorStop(0, 'rgba(30,66,76,0)'); g.addColorStop(1, 'rgba(30,66,76,0.97)')
      ctx.fillStyle = g
      ctx.fillRect(0, yB - 14, sw, pgr._sh - yB + 15)
    }
  }

  // Everything above the shoreline, flipped into the water: horizontal
  // slices, each nudged sideways by the swell, fading with depth.
  _reflect(ctx, pgr, shoreY, s, t) {
    const sw = pgr._sw
    const depth = Math.min(110, s * 1.7)
    ctx.save()
    for (let j = 0; j < depth; j += 2) {
      const src = shoreY - 3 - j * 0.85
      if (src < 0 || shoreY + j > pgr._sh) break
      const wob = Math.sin(j * 0.42 + t * 1.5) * (0.8 + j * 0.05) + Math.sin(j * 0.17 - t * 0.9) * 1.2
      ctx.globalAlpha = 0.36 * Math.pow(1 - j / depth, 1.6)
      try { ctx.drawImage(ctx.canvas, 0, src, sw, 2, wob, shoreY + j, sw, 2) } catch (e) { return }
    }
    ctx.restore()
  }

  _crests(ctx, pgr, row, yT, yB, s, t) {
    const T = this.tide, sw = pgr._sw
    const camCol = pgr._perspCamCol()
    ctx.lineCap = 'round'
    for (const w of this.waves) {
      // position in rows from the shore, rolling toward it
      const p = ((w.off - t * w.speed) % this.span + this.span) % this.span
      const wr = T.seaTop + p
      if (Math.floor(wr) !== row) continue
      const f = wr - row
      const y = yT + (yB - yT) * f
      const life = Math.sin(Math.PI * Math.min(1, p / this.span)) * Math.min(1, p / 1.5)   // fade at the shore
      const cell = Math.max(10, s * 0.9)
      const c0 = Math.floor(camCol - sw / 2 / s) - 1, c1 = Math.ceil(camCol + sw / 2 / s) + 1
      ctx.lineWidth = Math.max(1, s * 0.05)
      for (let c = c0; c <= c1; c++) {
        const h = hash(c, Math.floor(w.seed), 7)
        if (h < 0.4) continue
        const x = sw / 2 + (c - camCol + h) * s
        const len = s * (0.55 + 0.9 * hash(c, w.seed, 9))
        const sag = Math.sin(t * 0.9 + c + w.seed) * s * 0.03
        ctx.strokeStyle = `rgba(214,234,236,${0.30 * life})`
        ctx.beginPath(); ctx.moveTo(x - len / 2, y + sag); ctx.quadraticCurveTo(x, y - s * 0.05 + sag, x + len / 2, y + sag); ctx.stroke()
        ctx.strokeStyle = `rgba(12,34,44,${0.20 * life})`                       // the trough behind it
        ctx.beginPath(); ctx.moveTo(x - len * 0.4, y + s * 0.07 + sag); ctx.lineTo(x + len * 0.4, y + s * 0.07 + sag); ctx.stroke()
      }
    }
  }

  // Foam on the shoreline and a surge that slides up the stone and back.
  _foam(ctx, pgr, shoreY, s, t) {
    const sw = pgr._sw
    const surge = (0.5 + 0.5 * Math.sin(t * 0.62)) * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.23 + 1)))
    const up = surge * s * (this.tide.state === 'high' ? 0.28 : 0.22)
    const camCol = pgr._perspCamCol()
    // the surge: a thin sheet of water running up the stone, ragged at its edge
    ctx.fillStyle = 'rgba(150,196,196,0.24)'
    ctx.beginPath(); ctx.moveTo(0, shoreY)
    const step = 6
    for (let x = 0; x <= sw; x += step) {
      const wc = camCol + (x - sw / 2) / s
      const rag = (hash(Math.floor(wc * 3), 11) - 0.5) * s * 0.06
      ctx.lineTo(x, shoreY - up - rag)
    }
    ctx.lineTo(sw, shoreY); ctx.closePath(); ctx.fill()
    // the foam at its leading edge
    ctx.fillStyle = `rgba(238,245,242,${0.42 + 0.2 * surge})`
    for (let x = 0; x <= sw; x += step) {
      const wc = camCol + (x - sw / 2) / s
      const n = hash(Math.floor(wc * 3), 13)
      if (n < 0.28) continue
      const hh = s * (0.015 + 0.035 * n) * (0.6 + surge)
      ctx.fillRect(x, shoreY - up - hh * 0.6, step + 0.5, hh)
    }
    // and a few bubbles left in the shallows
    ctx.fillStyle = 'rgba(238,245,242,0.3)'
    for (let x = 0; x < sw; x += 14) {
      const wc = camCol + (x - sw / 2) / s
      const n = hash(Math.floor(wc * 2), 17)
      if (n > 0.35) continue
      const yy = shoreY + s * 0.04 + n * s * 0.35
      ctx.fillRect(x + n * 10, yy, Math.max(1, s * 0.03), Math.max(1, s * 0.02))
    }
  }

  // ── low tide: the quay and strand laid bare ───────────────────────────────
  _drawWeed(ctx, pgr, row) {
    const s0 = pgr._scaleAtRow(row), s1 = pgr._scaleAtRow(row + 1)
    if (!s0 || !s1) return
    const T = this.tide, mapW = this.scene.mapData?.width ?? 36
    const sw = pgr._sw, camCol = pgr._perspCamCol()
    const half = Math.ceil(sw / 2 / s1) + 2
    const c0 = Math.max(0, Math.floor(camCol - half)), c1 = Math.min(mapW - 1, Math.ceil(camCol + half))
    const dens = row === T.strand ? 0.92 : row === T.quay[1] ? 0.5 : 0.17        // thickest at the water
    const wet = row === T.strand ? 0.2 : row === T.quay[1] ? 0.2 : 0.1

    ctx.save()
    for (let col = c0; col <= c1; col++) {
      const yT = pgr._rowToScreenY(row), yB = pgr._rowToScreenY(row + 1)
      const sT = pgr._scaleAtRow(row), sB = pgr._scaleAtRow(row + 1)
      const q = {
        tl: [pgr._colToScreenX(col, row),         yT - pgr._vertexH(col, row) * sT],
        tr: [pgr._colToScreenX(col + 1, row),     yT - pgr._vertexH(col + 1, row) * sT],
        bl: [pgr._colToScreenX(col, row + 1),     yB - pgr._vertexH(col, row + 1) * sB],
        br: [pgr._colToScreenX(col + 1, row + 1), yB - pgr._vertexH(col + 1, row + 1) * sB],
      }
      const at = (u, v) => {
        const tx = q.tl[0] + (q.tr[0] - q.tl[0]) * u, ty = q.tl[1] + (q.tr[1] - q.tl[1]) * u
        const bx = q.bl[0] + (q.br[0] - q.bl[0]) * u, by = q.bl[1] + (q.br[1] - q.bl[1]) * u
        return [tx + (bx - tx) * v, ty + (by - ty) * v]
      }
      const s = sB

      // wet: a cool darkening, deeper toward the sea
      ctx.fillStyle = `rgba(16,30,38,${wet})`
      ctx.beginPath(); ctx.moveTo(...q.tl); ctx.lineTo(...q.tr); ctx.lineTo(...q.br); ctx.lineTo(...q.bl); ctx.closePath(); ctx.fill()

      // a puddle holding the sky
      if (hash(col, row, 21) < 0.22) {
        const [px, py] = at(0.25 + 0.5 * hash(col, row, 22), 0.3 + 0.4 * hash(col, row, 23))
        ctx.fillStyle = 'rgba(176,206,210,0.2)'
        ctx.beginPath(); ctx.ellipse(px, py, s * (0.16 + 0.12 * hash(col, row, 24)), s * 0.045, 0, 0, Math.PI * 2); ctx.fill()
      }

      // weed
      let d = dens * (0.55 + 0.9 * hash(Math.floor(col / 2), row, 31))
      if (hash(col, row, 32) > d) continue
      const n = 2 + Math.floor(hash(col, row, 33) * 3)
      for (let i = 0; i < n; i++) {
        const u = 0.1 + 0.8 * hash(col, row, 40 + i), v = 0.15 + 0.7 * hash(col, row, 50 + i)
        const [bx, by] = at(u, v)
        const col1 = WEED[Math.floor(hash(col, row, 60 + i) * WEED.length)]
        // a slick mat lying on the stone
        ctx.fillStyle = col1
        ctx.globalAlpha = 0.85
        ctx.beginPath(); ctx.ellipse(bx, by, s * (0.1 + 0.16 * hash(col, row, 70 + i)), s * (0.03 + 0.03 * hash(col, row, 71 + i)), (hash(col, row, 72 + i) - 0.5) * 0.5, 0, Math.PI * 2); ctx.fill()
        // and a few strands lifting off it, bladders along them
        ctx.globalAlpha = 0.95
        ctx.strokeStyle = col1; ctx.lineWidth = Math.max(1, s * 0.035); ctx.lineCap = 'round'
        const m = 2 + Math.floor(hash(col, row, 80 + i) * 3)
        for (let j = 0; j < m; j++) {
          const dx = (hash(col, row, 90 + i * 7 + j) - 0.5) * s * 0.4
          const len = s * (0.1 + 0.18 * hash(col, row, 100 + i * 7 + j))
          ctx.beginPath(); ctx.moveTo(bx, by)
          ctx.quadraticCurveTo(bx + dx * 0.4, by - len * 0.6, bx + dx, by - len); ctx.stroke()
          if (hash(col, row, 110 + i * 7 + j) < 0.5) {
            ctx.fillStyle = '#6b5a2e'
            ctx.beginPath(); ctx.arc(bx + dx * 0.55, by - len * 0.55, Math.max(1, s * 0.025), 0, Math.PI * 2); ctx.fill()
          }
        }
        ctx.globalAlpha = 1
      }
    }
    ctx.restore()
  }
}

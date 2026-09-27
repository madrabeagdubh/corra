// dustDash.js
// Location: js/game/scenes/locations/skye/dustDash.js
//
// A figure crosses ground in one move, as if it were nothing: a little
// wind-up, a lunge that streaks and fades in the direction of travel with
// speed lines, dust left hanging in the air; then the same streak arriving
// at the far end, a skid, and a second puff. Used by Uathach to cross the
// hedge maze; available to any Skye teacher.
//
//   dash(scene, { flag, zone, to: [tx, ty], onArrive })
//
// flag/zone are the PGR flag record and proximity zone of a fixed
// encounter; they move together. The flag is hidden for the duration and
// a Phaser image of the same sprite plays the animation in screen space.

const DUST = [0xc9b89a, 0xb3a07e, 0xd8cdb4]

// Where PGR draws a figure standing on (tx, ty): same maths as its flag
// billboards -- foot on the tile's south edge, lifted by terrain height.
export function figureBox(scene, tx, ty) {
  const pgr = scene.perspectiveGround
  if (!pgr) return null
  const ts = pgr.tileDisplaySize
  const proj = pgr._projectLogical((tx + 0.5) * ts, (ty + 0.5) * ts, true)
  if (!proj) return null
  const lift = ((pgr._vertexH(tx, ty + 1) + pgr._vertexH(tx + 1, ty + 1)) * 0.5)
             * pgr._scaleAtRow(ty + 1)
  const w = proj.scale * ts
  return { x: proj.screenX, y: proj.screenY - lift, w, h: w * 1.2 }
}

// Dust that hangs, drifts and thins out rather than popping.
export function dustPuff(scene, box, drift = 0, count = 10) {
  if (!box) return
  const r = Math.max(3, box.w * 0.16)
  for (let i = 0; i < count; i++) {
    const c = scene.add.circle(
      box.x + (Math.random() - 0.5) * box.w * 0.9,
      box.y - Math.random() * box.h * 0.25,
      r * (0.7 + Math.random() * 0.7),
      DUST[i % DUST.length], 0.7
    ).setScrollFactor(0).setDepth(16)
    scene.tweens.add({
      targets: c,
      scale: 2.2 + Math.random() * 1.2,
      alpha: 0,
      x: c.x + drift * box.w * (0.6 + Math.random()) + (Math.random() - 0.5) * r * 3,
      y: c.y - r * (1 + Math.random() * 2),
      duration: 1100 + Math.random() * 700,
      ease: 'Sine.easeOut',
      onComplete: () => c.destroy(),
    })
  }
}

function speedLines(scene, box, ux, uy, ahead = false) {
  const g = scene.add.graphics().setScrollFactor(0).setDepth(17)
  g.lineStyle(Math.max(1, box.w * 0.04), 0xf3ead2, 0.9)
  for (let i = 0; i < 7; i++) {
    const off = (Math.random() - 0.5) * box.h * 0.9
    const len = box.w * (1.2 + Math.random() * 1.6)
    // perpendicular offset across the body, lines trail behind the motion
    const px = -uy * off, py = ux * off
    const sx = box.x + px - ux * (ahead ? -box.w * 0.3 : box.w * 0.3)
    const sy = box.y - box.h * 0.5 + py - uy * (ahead ? -box.w * 0.3 : box.w * 0.3)
    g.lineBetween(sx, sy, sx - ux * len, sy - uy * len)
  }
  scene.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() })
}

export function whoosh(scene, volume = 0.22, dur = 0.32, from = 2400, to = 350) {
  const ctx = scene.sound?.context
  if (!ctx || ctx.state === 'closed') return
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource(); src.buffer = buf
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2
  bp.frequency.setValueAtTime(from, ctx.currentTime)
  bp.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.03)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur)
  src.connect(bp).connect(g).connect(ctx.destination)
  src.start()
}

export function moveFigure(scene, flag, zone, [tx, ty]) {
  const ts = scene.tileSize
  flag.tileX = tx
  flag.tileY = ty
  const px = tx * ts + ts / 2, py = ty * ts + ts / 2
  zone.x = px; zone.y = py
  zone.setData('logicalX', px)
  zone.setData('logicalY', py)
}

function figureTexture(scene, gid) {
  const key = `skyeFigure_${gid}`
  if (scene.textures.exists(key)) return key
  const cv = scene.perspectiveGround?._getTileCanvas?.(gid)
  if (!cv) return null
  scene.textures.addCanvas(key, cv)
  return key
}

export function dash(scene, { flag, zone, to, onArrive }) {
  const from = [flag.tileX, flag.tileY]
  const b0 = figureBox(scene, ...from)
  const key = figureTexture(scene, flag.visual?.gid)

  const land = () => {
    moveFigure(scene, flag, zone, to)
    flag.hidden = false
    onArrive?.()
  }
  // Nothing to animate with (off screen, texture not ready): just move.
  if (!b0 || !key) { land(); return }

  const b1 = figureBox(scene, ...to)
  // Screen-space direction of travel.
  let ux = 0, uy = -1
  if (b1) { const dx = b1.x - b0.x, dy = b1.y - b0.y, m = Math.hypot(dx, dy) || 1; ux = dx / m; uy = dy / m }

  flag.hidden = true
  const img = scene.add.image(b0.x, b0.y, key).setOrigin(0.5, 1)
    .setDisplaySize(b0.w, b0.h).setScrollFactor(0).setDepth(18)
  const sx0 = img.scaleX, sy0 = img.scaleY

  // 1. wind-up: a squat and a lean away from the direction of travel
  scene.tweens.add({
    targets: img, scaleX: sx0 * 1.12, scaleY: sy0 * 0.86, angle: -ux * 10,
    duration: 170, ease: 'Quad.easeOut',
    onComplete: () => {
      // 2. the lunge: stretch, streak, gone
      whoosh(scene)
      speedLines(scene, b0, ux, uy)
      dustPuff(scene, b0, -ux * 0.6)
      scene.tweens.add({
        targets: img,
        x: b0.x + ux * b0.w * 2.2, y: b0.y + uy * b0.w * 2.2,
        scaleX: sx0 * 0.7, scaleY: sy0 * 1.35, angle: ux * 18, alpha: 0,
        duration: 130, ease: 'Quad.easeIn',
        onComplete: () => {
          img.destroy()
          scene.time.delayedCall(420, () => arrive())
        },
      })
    },
  })

  const arrive = () => {
    const b = figureBox(scene, ...to)
    if (!b) { land(); return }
    const im = scene.add.image(b.x - ux * b.w * 2.2, b.y - uy * b.w * 2.2, key)
      .setOrigin(0.5, 1).setDisplaySize(b.w, b.h).setScrollFactor(0).setDepth(18).setAlpha(0)
    const ax = im.scaleX, ay = im.scaleY
    im.setScale(ax * 0.7, ay * 1.35).setAngle(ux * 18)
    whoosh(scene, 0.16, 0.22, 900, 3000)
    speedLines(scene, b, ux, uy, true)
    scene.tweens.add({
      targets: im, x: b.x, y: b.y, alpha: 1, duration: 120, ease: 'Quad.easeOut',
      onComplete: () => {
        // 3. the skid: squash past the mark, settle, dust drifting on
        dustPuff(scene, b, ux * 0.8, 12)
        scene.tweens.add({
          targets: im, scaleX: ax * 1.18, scaleY: ay * 0.82, angle: -ux * 6,
          x: b.x + ux * b.w * 0.25, duration: 110, ease: 'Quad.easeOut', yoyo: true,
          onComplete: () => {
            scene.tweens.add({
              targets: im, scaleX: ax, scaleY: ay, angle: 0, x: b.x,
              duration: 180, ease: 'Back.easeOut',
              onComplete: () => { im.destroy(); land() },
            })
          },
        })
      },
    })
  }
}

// A dunk: spray thrown up and falling back, rings spreading on the water.
const SPRAY = [0xdfeef5, 0xb8d4e3, 0x8fb3c9]
export function splash(scene, box) {
  if (!box) return
  const r = Math.max(3, box.w * 0.12)
  for (let i = 0; i < 14; i++) {
    const c = scene.add.circle(box.x + (Math.random() - 0.5) * box.w * 0.5, box.y - box.h * 0.1,
      r * (0.5 + Math.random() * 0.6), SPRAY[i % SPRAY.length], 0.9).setScrollFactor(0).setDepth(17)
    const up = box.h * (0.5 + Math.random() * 0.7)
    const side = (Math.random() - 0.5) * box.w * 1.4
    scene.tweens.add({ targets: c, x: c.x + side, y: c.y - up, duration: 260, ease: 'Quad.easeOut',
      onComplete: () => scene.tweens.add({ targets: c, y: c.y + up * 1.1, alpha: 0, duration: 320,
        ease: 'Quad.easeIn', onComplete: () => c.destroy() }) })
  }
  for (let k = 0; k < 3; k++) {
    const g = scene.add.ellipse(box.x, box.y, box.w * 0.6, box.w * 0.22)
      .setStrokeStyle(Math.max(1, box.w * 0.04), 0xdfeef5, 0.8).setScrollFactor(0).setDepth(16)
    scene.tweens.add({ targets: g, scaleX: 2.6, scaleY: 2.6, alpha: 0, delay: k * 160,
      duration: 900, ease: 'Sine.easeOut', onComplete: () => g.destroy() })
  }
  whoosh(scene, 0.28, 0.4, 700, 200)
}

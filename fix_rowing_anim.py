#!/usr/bin/env python3
# fix_rowing_anim.py
# Run from ~/Corra: python3 fix_rowing_anim.py

f = 'js/game/effects/perspectiveGroundRenderer.js'
s = open(f).read()

# ── Replace the boat idle rock/bob block and the moving section ──────────
# We replace from "// ── Player bob" through to "ctx.translate(screenX + boatRock..."
# and the entire moving branch's boat suppression, with the full rowing animation.

old = """    // ── Player bob (boat rocking when idle) ────────────────────────────
    const boatRock = this._boatActive
      ? Math.sin(t * 0.7) * scaledTileW * 0.025   // gentle side-to-side
      : 0
    const boatBob  = this._boatActive
      ? Math.sin(t * 1.4) * scaledTileW * 0.012   // gentle up-down
      : 0

    // Track tile steps
    const curTileX = p ? Math.floor(p.logicalX / this.tileDisplaySize) : 0
    const curTileY = p ? Math.floor(p.logicalY / this.tileDisplaySize) : 0
    const vx = curTileX - (this._prevTileX ?? curTileX)
    const vy = curTileY - (this._prevTileY ?? curTileY)
    const stepped = vx !== 0 || vy !== 0
    this._prevTileX = curTileX
    this._prevTileY = curTileY

    if (vx < 0)      this._facingLeft = true
    else if (vx > 0) this._facingLeft = false

    if (stepped) {
      this._moveDir = Math.abs(vx) > 0 ? 'ew' : 'ns'
      this._nextSwaySign = vx !== 0 ? (vx > 0 ? 1 : -1) : (this._swaySign ?? 1)
      const st = this._stepT ?? 1
      if (st > 0.85 || st === 0) {
        this._stepT    = 0
        this._swaySign = this._nextSwaySign
      }
    }

    const moving = p?.isMoving ?? false
    if (moving) {
      this._stepT = (this._stepT || 0) + 0.09
      if (this._stepT >= 1.0) {
        this._stepT    = 0
        this._swaySign = this._nextSwaySign ?? this._swaySign ?? 1
      }
    }

    ctx.save()
    ctx.translate(screenX + boatRock, screenY + boatBob)

    if (moving) {
      const st     = this._stepT ?? 0
      const arc    = Math.sin(st * Math.PI)
      // In boat: no bounce, just a gentle row sway
      const inWater = !this._boatActive && (p?.terrainSinkOffset ?? 0) > 5
      const bounce = (this._boatActive || inWater) ? 0 : arc * scaledTileW * 0.18
      const scaleY = 1.0 + ((this._boatActive || inWater) ? 0 : arc * 0.09)
      const scaleX = 1.0 - ((this._boatActive || inWater) ? 0 : arc * 0.04)
      const dir    = this._moveDir ?? 'ew'

      let sway = 0, lean = 0
      if (dir === 'ew') {
        sway = (this._boatActive || inWater) ? 0 : (this._swaySign ?? 1) * arc * scaledTileW * 0.055
        lean = (this._boatActive || inWater) ? 0 : arc * 0.05 * (this._facingLeft ? 1 : -1)
      } else {
        const inWater2 = !this._boatActive && (p?.terrainSinkOffset ?? 0) > 5
        const nsBounce = (this._boatActive || inWater2) ? 0 : arc * scaledTileW * 0.07
        ctx.transform(
          1.0 * (this._facingLeft ? -1 : 1), 0,
          0, 1.0 + ((this._boatActive || inWater2) ? 0 : arc * 0.04),
          0, -nsBounce
        )
        // Crop: use boat override when in boat, terrain sink otherwise
        const _sink0ns = this._boatActive
          ? H * (this._boatSinkOverride ?? 0)
          : Math.min(H * 1.1, (p?.terrainSinkOffset ?? 0) * scaledTileW / 48)
        const _cropH0ns = H - _sink0ns
        ctx.drawImage(img, 0, 0, img.width, img.height * (_cropH0ns / H), -W/2, -H + _sink0ns, W, _cropH0ns)
        ctx.restore()
        return
      }

      ctx.transform(scaleX * (this._facingLeft ? -1 : 1), lean, 0, scaleY, sway, -bounce)"""

new = """    // ── Rowing stroke cycle (currach style) ──────────────────────────
    // Track tile steps -- used for both boat stroke and land walk
    const curTileX = p ? Math.floor(p.logicalX / this.tileDisplaySize) : 0
    const curTileY = p ? Math.floor(p.logicalY / this.tileDisplaySize) : 0
    const vx = curTileX - (this._prevTileX ?? curTileX)
    const vy = curTileY - (this._prevTileY ?? curTileY)
    const stepped = vx !== 0 || vy !== 0
    this._prevTileX = curTileX
    this._prevTileY = curTileY

    if (vx < 0)      this._facingLeft = true
    else if (vx > 0) this._facingLeft = false

    if (stepped) {
      this._moveDir = Math.abs(vx) > 0 ? 'ew' : 'ns'
      this._nextSwaySign = vx !== 0 ? (vx > 0 ? 1 : -1) : (this._swaySign ?? 1)
      const st = this._stepT ?? 1
      if (st > 0.85 || st === 0) {
        this._stepT    = 0
        this._swaySign = this._nextSwaySign
      }
      // Advance stroke counter every 2 tiles for currach rhythm
      if (this._boatActive) {
        this._strokeTiles = ((this._strokeTiles ?? 0) + 1)
        // New stroke every 2 tiles
        if (this._strokeTiles % 2 === 0) {
          this._strokeT  = 0
          this._strokePhase = 'drive'
        }
      }
    }

    const moving = p?.isMoving ?? false
    if (moving) {
      this._stepT = (this._stepT || 0) + 0.09
      if (this._stepT >= 1.0) {
        this._stepT    = 0
        this._swaySign = this._nextSwaySign ?? this._swaySign ?? 1
      }
      // Advance stroke animation
      if (this._boatActive) {
        this._strokeT = Math.min(1.0, (this._strokeT ?? 0) + 0.045)
      }
    } else if (this._boatActive) {
      // Recovery glide back to neutral when stopping
      this._strokeT = Math.max(0, (this._strokeT ?? 0) - 0.03)
    }

    // Currach stroke shape:
    // 0.0-0.15  catch    -- lean forward, reach
    // 0.15-0.6  drive    -- powerful pull back, body opens
    // 0.6-0.8   finish   -- lean back, maximum extension
    // 0.8-1.0   recovery -- return forward
    const strokeT = this._strokeT ?? 0
    let rowLean = 0, rowBob = 0, boatTilt = 0
    if (this._boatActive) {
      if (strokeT < 0.15) {
        // Catch: lean forward
        const k = strokeT / 0.15
        rowLean = -0.12 * k                         // forward lean (negative = forward)
        rowBob  = scaledTileW * 0.02 * k
      } else if (strokeT < 0.6) {
        // Drive: pull back strongly
        const k = (strokeT - 0.15) / 0.45
        rowLean = -0.12 + 0.28 * k                  // forward to back
        rowBob  = scaledTileW * 0.02 - scaledTileW * 0.03 * Math.sin(k * Math.PI)
        boatTilt = -0.06 * Math.sin(k * Math.PI)    // boat tilts opposite to lean
      } else if (strokeT < 0.8) {
        // Finish: lean back, brief pause
        const k = (strokeT - 0.6) / 0.2
        rowLean = 0.16 - 0.04 * k
        rowBob  = -scaledTileW * 0.01
      } else {
        // Recovery: return to neutral
        const k = (strokeT - 0.8) / 0.2
        rowLean = 0.12 - 0.12 * k
        rowBob  = -scaledTileW * 0.01 * (1 - k)
      }
    }

    // Idle bob/roll when in boat and not moving
    const idleBob  = (this._boatActive && !moving)
      ? Math.sin(t * 1.1) * scaledTileW * 0.018
      : 0
    const idleRock = (this._boatActive && !moving)
      ? Math.sin(t * 0.65) * 0.03
      : 0

    const totalBob  = rowBob + idleBob
    const totalLean = rowLean + idleRock

    ctx.save()
    ctx.translate(screenX, screenY + totalBob)

    if (moving) {
      const st     = this._stepT ?? 0
      const arc    = Math.sin(st * Math.PI)
      const inWater = !this._boatActive && (p?.terrainSinkOffset ?? 0) > 5
      const bounce = (this._boatActive || inWater) ? 0 : arc * scaledTileW * 0.18
      const scaleY = 1.0 + ((this._boatActive || inWater) ? 0 : arc * 0.09)
      const scaleX = 1.0 - ((this._boatActive || inWater) ? 0 : arc * 0.04)
      const dir    = this._moveDir ?? 'ew'

      let sway = 0, lean = 0
      if (dir === 'ew') {
        sway = (this._boatActive || inWater) ? 0 : (this._swaySign ?? 1) * arc * scaledTileW * 0.055
        lean = this._boatActive ? totalLean : (inWater ? 0 : arc * 0.05 * (this._facingLeft ? 1 : -1))
      } else {
        const inWater2 = !this._boatActive && (p?.terrainSinkOffset ?? 0) > 5
        const nsBounce = (this._boatActive || inWater2) ? 0 : arc * scaledTileW * 0.07
        ctx.transform(
          1.0 * (this._facingLeft ? -1 : 1), 0,
          0, 1.0 + ((this._boatActive || inWater2) ? 0 : arc * 0.04),
          0, -nsBounce
        )
        // Crop: use boat override when in boat, terrain sink otherwise
        const _sink0ns = this._boatActive
          ? H * (this._boatSinkOverride ?? 0)
          : Math.min(H * 1.1, (p?.terrainSinkOffset ?? 0) * scaledTileW / 48)
        const _cropH0ns = H - _sink0ns
        ctx.drawImage(img, 0, 0, img.width, img.height * (_cropH0ns / H), -W/2, -H + _sink0ns, W, _cropH0ns)
        ctx.restore()
        return
      }

      ctx.transform(scaleX * (this._facingLeft ? -1 : 1), lean, 0, scaleY, sway, -bounce)"""

if old in s:
    s = s.replace(old, new)
    open(f, 'w').write(s)
    print('rowing animation: done')
else:
    print('NO MATCH')

# ── Also add boat tilt to the boat draw block ─────────────────────────────
# The boat sprite itself should rock with boatTilt
# We patch the active-boat draw to apply a rotation

f2 = 'js/game/effects/perspectiveGroundRenderer.js'
s2 = open(f2).read()

old2 = """        const bx    = this._boatScreenX
        const by    = this._boatScreenY
        const bc    = this._boatCanvas
        const boatW = Math.round(scaledTileW * 1.6 * ps)
        const boatH = Math.round(boatW * (bc.height / bc.width))
        const boatTop = by - H * 0.55
        ctx.drawImage(bc, Math.round(bx - boatW / 2), Math.round(boatTop), boatW, boatH)"""

new2 = """        const bx    = this._boatScreenX
        const by    = this._boatScreenY
        const bc    = this._boatCanvas
        const boatW = Math.round(scaledTileW * 1.6 * ps)
        const boatH = Math.round(boatW * (bc.height / bc.width))
        const boatTop = by - H * 0.55
        // Apply tilt -- boat rocks opposite to player lean
        const _boatTilt = (typeof boatTilt !== 'undefined') ? boatTilt : 0
        const _idleRock = (this._boatActive && !moving) ? Math.sin((this._animT||0) * 0.65) * 0.03 : 0
        const _tilt = _boatTilt + _idleRock
        if (Math.abs(_tilt) > 0.001) {
          ctx.save()
          ctx.translate(Math.round(bx), Math.round(by - H * 0.3))
          ctx.rotate(_tilt)
          ctx.drawImage(bc, -Math.round(boatW / 2), Math.round(boatTop - (by - H * 0.3)), boatW, boatH)
          ctx.restore()
        } else {
          ctx.drawImage(bc, Math.round(bx - boatW / 2), Math.round(boatTop), boatW, boatH)
        }"""

if old2 in s2:
    s2 = s2.replace(old2, new2)
    open(f2, 'w').write(s2)
    print('boat tilt: done')
else:
    print('boat tilt: NO MATCH')

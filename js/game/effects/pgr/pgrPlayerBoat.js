// pgrPlayerBoat.js — player sprite, boat, and equipped-weapon rendering
// Location: js/game/effects/pgr/pgrPlayerBoat.js
//
// Split out of perspectiveGroundRenderer.js. Module pattern: plain
// functions taking the PGR instance as their first argument, reading
// and writing its fields directly -- all state stays on the instance,
// so behaviour is identical to the pre-split code and PGR.destroy()
// works untouched. Class statics are reached via pgr.constructor.

export function loadBoatImage(pgr, imgElement) {
    const c   = document.createElement('canvas')
    c.width   = imgElement.naturalWidth  || imgElement.width
    c.height  = imgElement.naturalHeight || imgElement.height
    const ctx = c.getContext('2d')
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(imgElement, 0, 0)
    pgr._boatCanvas = c
    console.log('[PGR] boat canvas ready -', c.width, 'x', c.height)
  }

export function setBoatActive(pgr, active) {
    pgr._boatActive  = !!active
    pgr._boatScreenX = null
    pgr._boatScreenY = null
    if (active) {
      pgr._boatSinkOverride = 0.32
    } else {
      pgr._boatSinkOverride = 0
    }
    pgr._playerFrameKey = null
  }

export function drawWeaponOverlay(pgr, playerScreenX, playerScreenY, scaledTileW, aimAngle) {
    const inv = pgr.scene.player?.inventory
    if (!inv) return
    const item = inv.getEquippedItem?.('rightHand')
    if (!item) return
    try {
      let itemImg = null
      if (item.itemGid && pgr.scene.itemSheet?.isReady) {
        itemImg = pgr.scene.itemSheet.getCanvas(item.itemGid)
      } else if (item.spriteKey) {
        const itemTex = pgr.scene.textures.get(item.spriteKey)
        if (itemTex && itemTex.key !== '__MISSING') {
          itemImg = itemTex.getSourceImage()
        }
      }
      if (!itemImg?.width) return
      const ctx  = pgr._oCtx
      const ps   = pgr.constructor.PLAYER_SCALE ?? 1.0
      const iw   = scaledTileW * 0.9 * ps
      const ih   = iw * (itemImg.height / itemImg.width)
      const REST_ANGLE    = (345 * Math.PI) / 180
      const angle         = aimAngle != null ? aimAngle + (Math.PI / 2) + (135 * Math.PI / 180) : REST_ANGLE
      const ps2  = pgr.constructor.PLAYER_SCALE ?? 1.0
      const spriteCentreY = playerScreenY - scaledTileW * 1.8 * ps2 * 0.5
      const offsetX       = scaledTileW * 0.12
      ctx.save()
      ctx.translate(playerScreenX + offsetX, spriteCentreY)
      ctx.rotate(angle)
      ctx.globalAlpha = 0.95
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(itemImg, -iw / 2, -ih / 2, iw, ih)
      ctx.globalAlpha = 1.0
      ctx.restore()
    } catch(e) {
      // non-fatal
    }
  }

export function drawPlayerAnimated(pgr, ctx, img, screenX, screenY, scaledTileW, heightMult) {
    if (!img) return
    ctx.globalAlpha = pgr._playerOcclusionAlpha ?? 1
    const t   = pgr._animT || 0
    const p   = pgr._player
    const ps  = pgr.constructor.PLAYER_SCALE ?? 1.0
    const hm  = (heightMult ?? 1.8) * ps
    const W   = Math.round(scaledTileW * ps)
    const H   = Math.round(scaledTileW * hm)

    const boatVX = pgr._boatActive ? (pgr.scene?.boatSystem?._vx ?? 0) : 0
    const boatVY = pgr._boatActive ? (pgr.scene?.boatSystem?._vy ?? 0) : 0
    const boatSpd = Math.hypot(boatVX, boatVY)
if (pgr._boatActive) {
  // Idle drift (boatSystem.js's east current) plus joystick noise near its
  // own deadzone can push boatVX back and forth across a narrow threshold
  // many times a second while the boat isn't actually being paddled --
  // each crossing used to flip the sprite, causing a visible left/right
  // twitch at rest. Real paddling moves the boat at 80-160 px/s, an order
  // of magnitude above this, so widening the deadzone costs nothing there.
  // Requiring the new direction to hold for several consecutive frames
  // before committing filters out any remaining single-frame noise.
  const FLIP_THRESHOLD    = 15
  const FLIP_HOLD_FRAMES  = 30
  const joystickActive = (pgr.scene?.joystick?.force ?? 0) > 10
  const pathActive     = (pgr.scene?.boatSystem?._pathForce ?? 0) > 10
  if (joystickActive || pathActive) {
    if (boatVX < -4)      pgr._facingLeft = true
    else if (boatVX > 4)  pgr._facingLeft = false
  } else {
    pgr._facingLeft = true   // fixed idle orientation
  }
} else if (p?.isMoving) {
  if (p.moveDirection.x < 0)      pgr._facingLeft = true
  else if (p.moveDirection.x > 0) pgr._facingLeft = false
}

if (!pgr._boatActive && p?.isMoving && (pgr._lastStepKeyX !== p.startX || pgr._lastStepKeyY !== p.startY)) {
  pgr._lastStepKeyX = p.startX
  pgr._lastStepKeyY = p.startY
  pgr._stepT    = 0
  pgr._moveDir  = p.moveDirection.x !== 0 ? 'ew' : 'ns'
  pgr._swaySign = p.moveDirection.x !== 0
    ? (p.moveDirection.x > 0 ? 1 : -1)
    : (p.moveDirection.y > 0 ? 1 : -1)
}
    const moving = pgr._boatActive ? boatSpd > 8 : (p?.isMoving ?? false)

    if (pgr._boatActive) {
      const joystickActive = (pgr.scene?.joystick?.force ?? 0) > 10
      const strokeRate = Math.min(boatSpd / 80, 1.0) * 0.025
      if (joystickActive && boatSpd > 8) {
        pgr._strokeT = Math.min(1.0, (pgr._strokeT ?? 0) + strokeRate)
        if (pgr._strokeT >= 1.0) pgr._strokeT = 0
      } else {
        pgr._strokeT = Math.max(0, (pgr._strokeT ?? 0) - 0.015)
      }
  } else if (moving) {
  const _refDuration = 150 // matches Player.baseStepDuration
  const _stepRate    = 0.09 * (_refDuration / (p?.stepDuration || _refDuration))
  pgr._stepT = (pgr._stepT || 0) + _stepRate
  if (pgr._stepT >= 1.0) pgr._stepT = 1.0
}


const strokeT = pgr._strokeT ?? 0
    let rowLean = 0, rowBob = 0, boatTilt = 0
    if (pgr._boatActive) {
      if (strokeT < 0.15) {
        const k = strokeT / 0.15
        rowLean = -0.07 * k
        rowBob  = scaledTileW * 0.01 * k
      } else if (strokeT < 0.6) {
        const k = (strokeT - 0.15) / 0.45
        rowLean = -0.07 + 0.16 * k
        rowBob  = scaledTileW * 0.01 - scaledTileW * 0.02 * Math.sin(k * Math.PI)
        boatTilt = -0.04 * Math.sin(k * Math.PI)
      } else if (strokeT < 0.8) {
        const k = (strokeT - 0.6) / 0.2
        rowLean = 0.09 - 0.03 * k
        rowBob  = -scaledTileW * 0.008
      } else {
        const k = (strokeT - 0.8) / 0.2
        rowLean = 0.06 - 0.06 * k
        rowBob  = -scaledTileW * 0.008 * (1 - k)
      }
    }

    if (pgr._boatActive) {
      const waveRenderer = pgr.scene._waveRenderer
      if (waveRenderer) {
        pgr._wobblePhase = waveRenderer.wavePhaseAtPlayer
        const waveTargetAmp = waveRenderer.waveAmpAtPlayer / (scaledTileW || 1) * 0.10
        const boatTargetAmp = boatSpd > 8
          ? 0.04 + Math.min(boatSpd / 120, 0.10)
          : 0.012
        const targetAmp = Math.max(boatTargetAmp, waveTargetAmp)
        pgr._wobbleAmp = pgr._wobbleAmp ?? 0.012
        pgr._wobbleAmp += (targetAmp - pgr._wobbleAmp) * 0.04
        const rideT   = waveRenderer.waveRideT ?? 0
        const rideAmp = waveRenderer.waveRideAmp ?? 0
        pgr._waveRideOffset = pgr._waveRideOffset ?? 0
        pgr._waveRideOffset += (rideT * rideAmp * 0.85 - pgr._waveRideOffset) * 0.06
      } else {
        pgr._waveRideOffset = 0
        const wobbleFreq = 1.8 + boatSpd * 0.04
        pgr._wobblePhase = ((pgr._wobblePhase ?? 0) + wobbleFreq * 0.016) % (Math.PI * 2)
        const targetAmp = boatSpd > 8
          ? 0.04 + Math.min(boatSpd / 120, 0.10)
          : 0.012
        pgr._wobbleAmp = pgr._wobbleAmp ?? 0.012
        pgr._wobbleAmp += (targetAmp - pgr._wobbleAmp) * 0.04
      }
    } else {
      pgr._wobblePhase = 0
      pgr._wobbleAmp   = 0
    }

    const wobbleRoll = pgr._boatActive
      ? Math.sin(pgr._wobblePhase) * (pgr._wobbleAmp ?? 0)
      : 0

    const idleBob = pgr._boatActive
      ? -Math.abs(Math.sin((pgr._wobblePhase ?? 0) + Math.PI * 0.5)) * scaledTileW * (pgr._wobbleAmp ?? 0) * 0.8
      : 0

    const velTiltX  = pgr._boatActive ? boatVX * 0.00025 : 0
    const velTiltY  = pgr._boatActive ? boatVY * 0.00018 : 0

    const prevVX    = pgr._prevBoatVX ?? boatVX
    const accelX    = boatVX - prevVX
    pgr._prevBoatVX = boatVX
    const accelTilt = pgr._boatActive ? -accelX * 0.005 : 0

    const totalBob  = rowBob + idleBob
    const totalLean = rowLean + wobbleRoll + velTiltX + accelTilt

    if ((pgr._boatActive || pgr._boatDrifting) && pgr._boatCanvas) {
      if (pgr._boatDrifting) {
        const _dTS = pgr.tileDisplaySize
        const _dTX = Math.floor((pgr._boatWorldX ?? 0) / _dTS)
        const _dTY = Math.floor((pgr._boatWorldY ?? 0) / _dTS)
        const _dGid = pgr.scene.mapData?.layers?.[0]?.[_dTY]?.[_dTX] ?? 0
        const _dShore = new Set([1472,1473,1474,1526,1528,1580,1581,1582,1635,1636,1689,1690,1742,1743,1796,1797,1852,1906,1958,1959,1960,2012,2013,731])
        const _dWater = new Set([1625,1679])
        const driftPxPerFrame = (_dShore.has(_dGid) || (!_dWater.has(_dGid) && _dGid !== 0)) ? 0 : (pgr._boatDriftSpeed ?? 18) / 60
        pgr._boatWorldX = (pgr._boatWorldX ?? 0) + driftPxPerFrame

        const driftProj = pgr._projectLogical(pgr._boatWorldX, pgr._boatWorldY ?? screenY, true)
        if (!driftProj) return

        const driftScreenX = driftProj.screenX
        const driftScreenY = driftProj.screenY
        const driftScale   = driftProj.scale * pgr.tileDisplaySize
        const bc    = pgr._boatCanvas
        const boatW = Math.round(driftScale * 1.6 * ps)
        const boatH = Math.round(boatW * (bc.height / bc.width))
        ctx.save()
        ctx.globalAlpha = 1.0
        ctx.drawImage(bc, Math.round(driftScreenX - boatW / 2), Math.round(driftScreenY - boatH * 0.8), boatW, boatH)
        ctx.restore()
      } else {
        if (pgr._boatScreenX == null) {
          pgr._boatScreenX = screenX
          pgr._boatScreenY = screenY
        } else {
          const lerpSpeed = 0.25
          pgr._boatScreenX += (screenX - pgr._boatScreenX) * lerpSpeed
          pgr._boatScreenY += (screenY - pgr._boatScreenY) * lerpSpeed
        }
        pgr._boatLastScreenX = pgr._boatScreenX
        pgr._boatLastScreenY = pgr._boatScreenY
        const bx    = pgr._boatActive ? (pgr._boatScreenX ?? screenX) : screenX
        const by    = pgr._boatActive ? (pgr._boatScreenY ?? screenY) : screenY
        const bc    = pgr._boatCanvas
        const boatW = Math.round(scaledTileW * 1.6 * ps)
        const boatH = Math.round(boatW * (bc.height / bc.width))
        const boatTop = by - boatH * 0.6
        const _boatRock = wobbleRoll + velTiltX + accelTilt
        const _boatPitch = velTiltY

        // ── Oars ────────────────────────────────────────────────────────
        // Hoisted ABOVE the branch below on purpose. These used to be defined
        // inside the transformed branch, which is only taken once the boat has
        // rocked or _facingLeft has been set -- and _facingLeft stays undefined
        // until the boat first moves horizontally. So a stationary or moored
        // boat took the other branch, where no oar code existed, and the oars
        // simply never appeared.
        //
        // cx/cy are the boat's centre in whatever space the caller is in:
        // local (0, top) inside the transform, absolute outside it.
        const OAR_LOCK_Y    = 0.30   // oarlock height, fraction of boat height
        const OAR_HANDLE_IN = 0.10   // handle reach inboard, fraction of width
        const OAR_HANDLE_UP = 0.14   // ... and how far above the lock
        const OAR_REACH     = 0.8   // blade reach along the hull
        const OAR_DIP       = 0.7   // blade drop below the lock
        const OAR_W         = Math.max(1, Math.round(boatW * 0.030))
        // Blade forward on the recovery, aft through the drive: always the
        // opposite end of the stroke from the rower. From rowLean rather than
        // strokeT, so retuning the stroke can't put them out of phase.
        const _oarDir = rowLean < 0 ? 1 : -1

        const _drawBoatOars = (cx, cy, far) => {
          const reach = OAR_REACH * (far ? 0.82 : 1)
          const lift  = far ? -boatH * 0.05 : 0
          const lockY = cy + boatH * OAR_LOCK_Y + lift
          ctx.save()
          ctx.lineCap = 'round'
          ctx.lineWidth = far ? Math.max(1, OAR_W - 1) : OAR_W
          ctx.strokeStyle = far
            ? 'rgba(58, 44, 30, 0.55)'
            : 'rgba(48, 36, 24, 0.95)'
          ctx.beginPath()
          ctx.moveTo(cx - _oarDir * boatW * OAR_HANDLE_IN,
                     lockY - boatH * OAR_HANDLE_UP)
          ctx.lineTo(cx + _oarDir * boatW * reach, lockY + boatH * OAR_DIP)
          ctx.stroke()
          ctx.restore()
        }
        if (Math.abs(_boatRock) > 0.001 || Math.abs(_boatPitch) > 0.001 || pgr._facingLeft !== undefined) {
          ctx.save()
          ctx.translate(Math.round(bx), Math.round(by + totalBob))
          ctx.rotate(_boatRock)
          ctx.transform(1, _boatPitch * 0.3, 0, 1, 0, 0)
          if (!pgr._facingLeft) ctx.scale(-1, 1)
          // Terrain-occlusion clip -- same raw pixel amount as the
          // player's own crop (perspectiveScene.js's
          // _updatePlayerOcclusionFade), since the boat sits at the
          // SAME world depth/screen position as the player standing in
          // it: whatever's hidden behind the terrain hides the same
          // number of screen pixels regardless of which sprite it's
          // covering. Clipped in this same LOCAL (post-transform)
          // coordinate space the drawImage call below already uses.
          const _boatCropPx = Math.min(boatH, pgr._playerOcclusionCropPx ?? 0)
          if (_boatCropPx > 0) {
            const _localTop = Math.round(boatTop - by - totalBob)
            ctx.beginPath()
            ctx.rect(-boatW, _localTop - 4, boatW * 2, boatH - _boatCropPx + 4)
            ctx.clip()
          }

          _drawBoatOars(0, Math.round(boatTop - by - totalBob), true)
          ctx.drawImage(bc, -Math.round(boatW / 2), Math.round(boatTop - by - totalBob), boatW, boatH)
          _drawBoatOars(0, Math.round(boatTop - by - totalBob), false)
          ctx.restore()
        } else {
          const _boatCropPx = Math.min(boatH, pgr._playerOcclusionCropPx ?? 0)
          if (_boatCropPx > 0) {
            ctx.save()
            ctx.beginPath()
            ctx.rect(bx - boatW, Math.round(boatTop + totalBob) - 4, boatW * 2, boatH - _boatCropPx + 4)
            ctx.clip()
            _drawBoatOars(bx, Math.round(boatTop + totalBob), true)
            ctx.drawImage(bc, Math.round(bx - boatW / 2), Math.round(boatTop + totalBob), boatW, boatH)
            _drawBoatOars(bx, Math.round(boatTop + totalBob), false)
            ctx.restore()
          } else {
            _drawBoatOars(bx, Math.round(boatTop + totalBob), true)
            ctx.drawImage(bc, Math.round(bx - boatW / 2), Math.round(boatTop + totalBob), boatW, boatH)
            _drawBoatOars(bx, Math.round(boatTop + totalBob), false)
          }
        }
      }
    }

    const _playerFacing = pgr._boatActive ? !pgr._facingLeft : pgr._facingLeft
    ctx.save()
    ctx.translate(screenX, screenY + (pgr._boatActive ? totalBob : idleBob))

    if (moving) {
      const st     = pgr._stepT ?? 0
      const arc    = Math.sin(st * Math.PI)
      const inWater = !pgr._boatActive && (p?.terrainSinkOffset ?? 0) > 5
      const bounce = (pgr._boatActive || inWater) ? 0 : arc * scaledTileW * 0.18
      const scaleY = 1.0 + ((pgr._boatActive || inWater) ? 0 : arc * 0.09)
      const scaleX = 1.0 - ((pgr._boatActive || inWater) ? 0 : arc * 0.04)
      const dir    = pgr._moveDir ?? 'ew'

      let sway = 0, lean = 0
      if (dir === 'ew') {
        sway = (pgr._boatActive || inWater) ? 0 : (pgr._swaySign ?? 1) * arc * scaledTileW * 0.055
        lean = pgr._boatActive ? 0 : (inWater ? 0 : arc * 0.05 * (pgr._facingLeft ? 1 : -1))
        if (pgr._boatActive) ctx.rotate(totalLean * (pgr._facingLeft ? -1 : 1))
      } else {
        const inWater2 = !pgr._boatActive && (p?.terrainSinkOffset ?? 0) > 5
        const nsBounce = (pgr._boatActive || inWater2) ? 0 : arc * scaledTileW * 0.07
        ctx.transform(
          1.0 * (pgr._facingLeft ? -1 : 1), 0,
          0, 1.0 + ((pgr._boatActive || inWater2) ? 0 : arc * 0.04),
          0, -nsBounce
        )
        const _sink0ns = pgr._boatActive
          ? H * (pgr._boatSinkOverride ?? 0)
          : Math.min(H * 1.1, (p?.terrainSinkOffset ?? 0) * scaledTileW / 48)
        // Terrain-occlusion crop needs a DIFFERENT anchor than water-sink,
        // not just a bigger/smaller version of the same thing -- fixed
        // per direct feedback ("player's head emerging from the land,
        // instead of from the coast"). Water-sink is correctly BOTTOM-
        // anchored (the water genuinely IS at the player's own foot
        // position, so their feet should vanish exactly there, with the
        // head descending slightly as they sink deeper). But terrain
        // occlusion was using that SAME bottom-anchored formula, which
        // keeps the bottom fixed at the player's own feet and lets the
        // TOP (head) descend as more gets cropped -- meaning the head
        // visibly sinks toward the ground at the player's own position,
        // reading as "swallowed by the earth right here" rather than
        // "hidden behind a ridge that's elsewhere on screen."
        // Fixed by keeping the head's screen position COMPLETELY FIXED
        // (top anchor unaffected by occlusion) and letting the BOTTOM of
        // the visible slice recede upward instead -- so the cutoff edge
        // tracks the hill's own silhouette line, not the player's feet.
        // Combined with water-sink as two independent constraints on the
        // same visible range (intersection), not a single "worse of the
        // two" value -- each affects a different end of the sprite.
        const _sinkNsClamped = Math.min(H, _sink0ns)
        const _occlusionCropNs = Math.min(H, pgr._playerOcclusionCropPx ?? 0)
        const _topNs    = -H + _sinkNsClamped              // sink affects the TOP
        const _bottomNs = -_occlusionCropNs                // occlusion affects the BOTTOM
        const _cropH0ns = Math.max(0, _bottomNs - _topNs)
        ctx.drawImage(img, 0, 0, img.width, img.height * (_cropH0ns / H), -W/2, _topNs, W, _cropH0ns)
        ctx.restore()
        ctx.globalAlpha = 1
        return
      }

      ctx.transform(scaleX * (_playerFacing ?? pgr._facingLeft ? -1 : 1), lean, 0, scaleY, sway, -bounce)
    } else if (pgr._boatActive) {
      // Idle sway/breathing (breathScale/shift/watch below) looks right for
      // a person standing on land but reads as unwanted twitch for a
      // seated figure in a boat -- disabled here per request. The boat's
      // own wobble/rock animation already provides idle motion in this
      // context, so this is just the facing flip with no added sway.
      ctx.transform((_playerFacing ?? pgr._facingLeft) ? -1 : 1, 0, 0, 1, 0, 0)
    } else {
      const breathScale = 1.0 + Math.sin(t * 1.1) * 0.014
      const shift       = Math.sin(t * 0.6) * scaledTileW * 0.018
      const watch       = Math.sin(t * 2.1 + 0.5) * scaledTileW * 0.007
      ctx.transform(
        breathScale * ((_playerFacing ?? pgr._facingLeft) ? -1 : 1), 0,
        0, breathScale,
        shift, watch
      )
    }

    const sinkFrac = pgr._boatActive ? (pgr._boatSinkOverride ?? 0) : 0
    const _sinkRaw = (p?.terrainSinkOffset ?? 0)
    const _sink = pgr._boatActive ? H * sinkFrac : Math.min(H * 1.1, _sinkRaw * scaledTileW / 48)
    // Same dual-anchor fix as the north-south branch above: sink stays
    // bottom-anchored, occlusion is now top-anchored (head fixed, visible
    // bottom recedes upward to the hill's own silhouette line instead of
    // the player's own feet).
    const _sinkClamped = Math.min(H, _sink)
    const _occlusionCrop = Math.min(H, pgr._playerOcclusionCropPx ?? 0)
    const _top    = -H + _sinkClamped
    const _bottom = -_occlusionCrop
    const _cropH  = Math.max(0, _bottom - _top)
    ctx.drawImage(img, 0, 0, img.width, img.height * (_cropH / H), -W/2, _top, W, _cropH)
    ctx.restore()
    ctx.globalAlpha = 1
  }



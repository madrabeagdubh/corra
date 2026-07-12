// pgrSky.js — sky, mountain, and ambient-light DOM layers for PGR
// Location: js/game/effects/pgr/pgrSky.js
//
// Split out of perspectiveGroundRenderer.js (modularisation, step 1).
// Owns the DOM elements that sit UNDER the ground canvases
// (pgr-sky-img z:0, pgr-mountain-img z:0), the radial light overlay
// above them (pgr-light z:4), the cloud-drift + mountain-parallax
// animation, and the palette extraction that feeds TintManager from
// the sky image.
//
// Module pattern (shared by all pgr/ modules): plain functions taking
// the PGR instance as their first argument and reading/writing its
// fields directly (pgr._skyImg, pgr._sw, ...). No module-local state --
// everything stays on the instance, exactly where it lived before the
// split, so behaviour is identical and PGR.destroy() keeps working
// untouched (it still finds pgr._skyImg / pgr._mountainImg /
// pgr._lightDiv / pgr._resizeHandler in the same places). Class
// statics are reached via pgr.constructor rather than importing the
// core file, which avoids a circular import.

// Creates pgr._skyImg + pgr._mountainImg and installs the shared
// resize/fullscreen handler (stored on pgr._resizeHandler so
// PGR.destroy() can remove it). Was PGR._buildSkyImage().
export function initSky(pgr, container) {
  const sw = pgr._sw
  const sh = pgr._sh
  const img = document.createElement('img')
  img.id  = 'pgr-sky-img'
  img.src = ''
  img.style.cssText = [
    'position:absolute', 'top:0', 'left:0',
    `width:${sw}px`, `height:${Math.floor(sh * 0.85)}px`,
    'z-index:0', 'pointer-events:none',
    'object-fit:cover', 'object-position:center top',
    'opacity:0',
  ].join(';')
  container.appendChild(img)
  pgr._skyImg = img

  const mtn = document.createElement('img')
  mtn.id  = 'pgr-mountain-img'
  mtn.src = ''
  mtn.style.cssText = [
    'position:absolute', 'left:0',
    'width:100%',
    'height:' + (pgr.constructor.HORIZON_Y_FRAC * 100).toFixed(2) + '%',
    'top:0',
    'z-index:0', 'pointer-events:none',
    'object-fit:none', 'object-position:50% 100%',
    'opacity:0',
  ].join(';')
  container.appendChild(mtn)
  pgr._mountainImg = mtn

  pgr._resizeHandler = () => {
    setTimeout(() => {
      const canvas = pgr.scene?.game?.canvas
      if (!canvas) return
      console.log('[PGR resize]', 'clientW/H:', canvas.clientWidth, canvas.clientHeight, '| backbuffer:', canvas.width, canvas.height, '| dpr:', window.devicePixelRatio)
      const nw = canvas.clientWidth || canvas.width
      const nh = canvas.clientHeight || canvas.height
      if (nw === pgr._sw && nh === pgr._sh) return
      pgr._sw = nw; pgr._sh = nh

      const newSkyH   = Math.floor(nh * 0.85)
      const horizonPx = Math.floor(nh * pgr.constructor.HORIZON_Y_FRAC)
      const newMtnH   = horizonPx
      const newMtnTop = horizonPx - Math.floor(newMtnH * 0.35)
      if (pgr._skyImg) {
        pgr._skyImg.style.width  = nw + 'px'
        pgr._skyImg.style.height = newSkyH + 'px'
      }
      if (pgr._mountainImg) {
        pgr._mountainImg.style.width  = nw + 'px'
        pgr._mountainImg.style.height = newMtnH + 'px'
        pgr._mountainImg.style.top    = newMtnTop + 'px'
      }
    }, 150)
  }
  window.addEventListener('resize', pgr._resizeHandler)
  document.addEventListener('fullscreenchange', pgr._resizeHandler)
  document.addEventListener('webkitfullscreenchange', pgr._resizeHandler)
}

// Creates the radial-gradient light overlay div (pgr-light z:4).
// Was inline in the PGR constructor.
export function initLight(pgr, container) {
  pgr._lightDiv = document.createElement('div')
  pgr._lightDiv.id = 'pgr-light'
  pgr._lightDiv.style.cssText = [
    'position:absolute', 'top:0', 'left:0',
    `width:${pgr._sw}px`, `height:${pgr._sh}px`,
    'z-index:4', 'pointer-events:none',
  ].join(';')
  container.appendChild(pgr._lightDiv)
}

export function setSkyImage(pgr, url, position = 'center top') {
  if (!pgr._skyImg) return
  if (url) {
    if (pgr._skyImg.src !== url) {
      pgr._skyImg.onload = () => extractPaletteFromImage(pgr, pgr._skyImg)
      pgr._skyImg.src = url
    }
    pgr._skyImg.style.opacity        = '1'
    pgr._skyImg.style.objectPosition = position
  } else {
    pgr._skyImg.src           = ''
    pgr._skyImg.style.opacity = '0'
    pgr.tintManager.setMood('default')
    pgr._gcR = null
  }
}

export function setMountainImage(pgr, url, position) {
  if (!pgr._mountainImg) return
  position = position || '50% 100%'
  if (url) {
    if (!pgr._mountainImg.src.endsWith(url.replace(/^.*\//, ''))) pgr._mountainImg.src = url
    pgr._mountainImg.style.opacity = '1'
    pgr._mountainImg.style.objectPosition = position
  } else {
    pgr._mountainImg.src = ''
    pgr._mountainImg.style.opacity = '0'
  }
}

export function updateMountainParallax(pgr, playerLogicalX, playerLogicalY, mapWidth, mapHeight) {
  if (!pgr._mountainImg || !pgr._mountainImg.src) return
  const baseX = pgr._mountainBaseX !== undefined ? pgr._mountainBaseX : 50
  const baseY = pgr._mountainBaseY !== undefined ? pgr._mountainBaseY : 100
  const ts    = pgr._tileSize || 48
  const fracX = mapWidth  > 0 ? playerLogicalX / (mapWidth  * ts) : 0.5
  const fracY = mapHeight > 0 ? playerLogicalY / (mapHeight * ts) : 0.5

  const easedX = fracX < 0.5
    ? 2 * fracX * fracX
    : 1 - Math.pow(-2 * fracX + 2, 2) / 2

  const mtnPx = baseX + (easedX - 0.5) * 8
  const mtnPy = baseY
  pgr._mountainImg.style.objectPosition = mtnPx.toFixed(2) + '% ' + mtnPy.toFixed(2) + '%'

  if (pgr._skyImg && pgr._skyImg.src) {
    pgr._skyParallaxX = (easedX - 0.5) * 3
  }
}

// Per-frame sky/mountain upkeep -- cloud drift, parallax, and the
// mountain/sky size refresh. Was inline at the top of PGR.update();
// called from there once per frame, BEFORE the idle-skip early return
// (same position as before, so the sky keeps drifting even when the
// ground redraw is skipped).
export function updateSkyAnimation(pgr) {
  pgr._cloudDrift = ((pgr._cloudDrift ?? 0) + 0.0004) % (Math.PI * 2)
  if (pgr._skyImg && pgr._skyImg.src) {
    const driftX = 50 + Math.sin(pgr._cloudDrift) * 12 + (pgr._skyParallaxX ?? 0)
    const currentPos = pgr._skyImg.style.objectPosition || '50% 50%'
    const currentY = currentPos.split(' ')[1] || '50%'
    pgr._skyImg.style.objectPosition = driftX.toFixed(3) + '% ' + currentY
  }
  if (pgr._mountainImg && pgr._mountainImg.src) {
    const p  = pgr.scene.player
    const md = pgr.scene.mapData
    if (p && md) updateMountainParallax(pgr, p.logicalX, p.logicalY, md.width, md.height)
    const _horizPx = pgr._horizonPx()
    if (!pgr._mtnLogTimer || Date.now() - pgr._mtnLogTimer > 2000) { pgr._mtnLogTimer = Date.now() }
    const _mtnH    = Math.floor(_horizPx * 3.0)
    const _mtnTop  = Math.floor(_horizPx * 0.55)
    pgr._mountainImg.style.height = _mtnH + 'px'
    pgr._mountainImg.style.top    = _mtnTop + 'px'
    pgr._mountainImg.style.width  = pgr._sw + 'px'
    if (pgr._skyImg) {
      pgr._skyImg.style.height = Math.floor(pgr._sh * 0.85) + 'px'
      pgr._skyImg.style.width  = pgr._sw + 'px'
    }
  }
}

// Repositions the radial player-glow gradient. Was PGR._updateLight(),
// called at the end of PGR.update() each frame.
export function updateLight(pgr, playerScreenX, playerScreenY) {
  const sw        = pgr._sw
  const sh        = pgr._sh
  const horizonPx = pgr._horizonPx()
  const groundH   = sh - horizonPx
  const K         = pgr.constructor
  const radius    = Math.sqrt(sw * sw + sh * sh) * (pgr._lightRadius ?? K.LIGHT_RADIUS)
  const dark      = pgr._lightDarkness ?? K.LIGHT_DARKNESS
  const glow      = K.LIGHT_COLOR
  const relativePlayerY = playerScreenY - horizonPx
  pgr._lightDiv.style.top    = `${horizonPx}px`
  pgr._lightDiv.style.height = `${groundH}px`
  pgr._lightDiv.style.background = [
    `radial-gradient(ellipse ${radius.toFixed(1)}px ${(radius * 0.6).toFixed(1)}px`,
    ` at ${playerScreenX.toFixed(1)}px ${relativePlayerY.toFixed(1)}px,`,
    ` ${glow} 0%, transparent 35%, rgba(0,0,0,${dark}) 100%)`
  ].join('')
}

// Samples the lower 40% of the sky image and hands averaged sky/mid/
// ground RGB bands to TintManager, which re-derives the whole map's
// tint palette from them. Was PGR._extractPaletteFromImage().
function extractPaletteFromImage(pgr, imgEl) {
  try {
    const c   = document.createElement('canvas')
    c.width   = 64
    c.height  = 64
    const ctx = c.getContext('2d')
    const imgH = imgEl.naturalHeight || imgEl.height || 1
    const imgW = imgEl.naturalWidth  || imgEl.width  || 1
    const srcY = Math.floor(imgH * 0.60)
    const srcH = Math.floor(imgH * 0.40)
    ctx.drawImage(imgEl, 0, srcY, imgW, srcH, 0, 0, 64, 64)

    const sky    = avgPixels(ctx.getImageData(0, 0,  64, 20))
    const mid    = avgPixels(ctx.getImageData(0, 20, 64, 22))
    const ground = avgPixels(ctx.getImageData(0, 42, 64, 22))

    console.log('[PGR] palette sampled -- sky:', sky, 'mid:', mid, 'ground:', ground)

    pgr.tintManager.setPaletteFromRGB({ sky, mid, ground })

    const gt = pgr.tintManager.getTint(733, 0, 0)
    if (gt) {
      pgr._gcR = `hsl(${gt.h},${Math.round(gt.s * 0.7)}%,${Math.max(gt.l - 8, 8)}%)`
    }

    pgr._lastCamX = null
  } catch(e) {
    console.warn('[PGR] palette extraction failed:', e.message)
  }
}

function avgPixels(imageData) {
  const d = imageData.data
  let r = 0, g = 0, b = 0, count = 0
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 10) continue
    r += d[i]; g += d[i+1]; b += d[i+2]
    count++
  }
  if (count === 0) return { r: 128, g: 128, b: 128 }
  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
  }
}


// textContrast.js
// Location: js/game/ui/textContrast.js
//
// English text that picks its own contrasting colour.
//
// The screen behind the text runs from bright to dark (dawn skies, night
// seas, sunlit grass), and the English line is often translucent (the moon
// slider). Outlines and drop shadows only made it smudgy. Instead: a few
// times a second, sample what's behind the text and choose an ink --
// deep slate on light ground, pale blue-white on dark ground -- easing
// between them with a little hysteresis so it never flickers.
//
// Cheap by design: the region behind a line is drawn, scaled down by the
// GPU, into an 8 x 3 canvas; only those 24 pixels are read back.
//
//   const contrast = createContrast()
//   contrast.update(el, sources, rect)   // throttled per element
//     el      -- the text element to recolour
//     sources -- canvases / images behind it, back to front (each drawn at
//                the same screen position as the text's rect)
//     rect    -- { x, y, w, h } in screen pixels, or a function returning it
//                (called only when a sample is due -- no layout read per frame)
//
// Every scene that shows English over a picture can use it: it only needs
// to say which canvases (or images) are behind the text.

export const INK = {
  onDark:  [230, 237, 245],     // pale blue-white
  onLight: [27, 34, 48],        // deep slate
}

export function createContrast({ everyMs = 220, easeMs = 600 } = {}) {
  const c = document.createElement('canvas')
  c.width = 8; c.height = 3
  const g = c.getContext('2d', { willReadFrequently: true })
  const state = new WeakMap()                      // el -> { last, dark }

  // Mean relative luminance (0..1) of the sources inside rect.
  function sample(sources, rect) {
    g.clearRect(0, 0, 8, 3)
    for (const src of sources) {
      if (!src) continue
      const b = src.getBoundingClientRect ? src.getBoundingClientRect() : { left: 0, top: 0, width: src.width, height: src.height }
      const sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight
      if (!sw || !sh || !b.width || !b.height) continue
      // screen rect -> the source's own pixel space
      const kx = sw / b.width, ky = sh / b.height
      const sx = (rect.x - b.left) * kx, sy = (rect.y - b.top) * ky
      try { g.drawImage(src, sx, sy, rect.w * kx, rect.h * ky, 0, 0, 8, 3) } catch (e) { /* not ready */ }
    }
    const d = g.getImageData(0, 0, 8, 3).data
    let sum = 0, n = 0
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue
      const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
      sum += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]); n++
    }
    return n ? sum / n : null
  }

  function update(el, sources, rect, now = performance.now()) {
    if (!el) return
    let s = state.get(el)
    if (!s) {
      s = { last: -1e9, dark: null }
      state.set(el, s)
      el.style.setProperty('transition', `color ${easeMs}ms ease, opacity 0.2s`)
    }
    if (now - s.last < everyMs) return
    s.last = now
    // rect may be a function, so layout is only read when it's time to sample
    const lum = sample(sources, typeof rect === 'function' ? rect() : rect)
    if (lum == null) return
    // hysteresis: switch to dark ink above 0.20, back to light below 0.14
    // (relative luminance: mid-grey is ~0.18)
    const darkInk = s.dark ? lum > 0.14 : lum > 0.20
    if (darkInk === s.dark) return
    s.dark = darkInk
    const [r, gg, b] = darkInk ? INK.onLight : INK.onDark
    el.style.setProperty('color', `rgb(${r},${gg},${b})`, 'important')
  }

  return { update, sample }
}

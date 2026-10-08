// heroSlots.js
// Location: js/heroSlots.js
//
// The saved heroes, as a strip along the bottom of the intro: up to MAX_HEROES
// portraits with names, fading in under the big moon. The moon is still the
// moon -- touching anything above the strip dismisses it and the intro goes on
// exactly as it always has (that IS "a new hero").
//
// Tap a portrait: it comes to rest over the moon (a full moon fading in, the
// hero standing on it, centred by their actual pixels) with "Ar aghaidh le
// <name>?" above, and tapping THAT goes on (resumes that hero where it left
// off, GameState.saveSpot) with a few bars of their tune -- or a chord or two
// if the tune isn't ready. The strip's end slots become two small buttons:
//   Ar ais  (arrow)       back to the strip      Scrios  (x, red)   delete ...
// ... which asks "Scrios?" (above the moon) with  Ná Scrios / Scrios  in the
// same two slots. Delete is for good; the champion stays on the roster and can
// be picked again, from the start.
//
// Any tap on a hero in the strip is a first gesture, like the moon: it asks for
// fullscreen and unlocks audio (and starts loading that hero's tune).
//
// Type is the game's own (gameTypography.js: TYPE / BUTTON / COLORS), no local sizes.
//
// With MAX_HEROES saved the intro is dimmed and cannot be touched: pick one
// or delete one first. With none saved nothing shows at all.
//
//   const slots = showHeroSlots()    call it as the intro starts
//   slots.resumed                    true: this load is a resume, don't start the intro
//   slots.dismiss()                  call when the intro ends (no-op if already gone)
//
// Going on takes the running intro down in place (abortIntro, introModal.js) so
// fullscreen and audio survive, then starts the game on the saved scene. If the
// intro cannot be taken down it falls back to a reload: a note is left and the
// next load goes straight into the saved scene.
//
// Dev shortcuts (?scene=..., ?crossing=...) skip it.
// IRISH IS A FIRST DRAFT -- check before shipping.

import { champions } from '../data/champions.js'
import { GameState } from './game/systems/gameState.js'
import { GameSettings } from './game/settings/gameSettings.js'
import { FONTS, COLORS, TYPE, BUTTON } from './game/systems/gameTypography.js'
import { NOCTURNE } from './game/systems/nightPalette.js'
import { waitForHeroAssets, getPreloadedAssets, unlockAudio, abortIntro } from './introModal.js'
import { requestFullscreenWithFade } from './game/ui/fullscreenFade.js'
import { TradSessionPlayer } from './game/systems/music/tradSessionPlayerScheduled.js'
import { getTuneKeyForChampion } from './game/systems/music/championTuneMapping.js'

export const MAX_HEROES = 3

const STRIP = 'heroSlotsStrip'     // the row along the bottom
const DIM = 'heroSlotsDim'         // the cover over the intro (all slots full, or a hero is chosen)
const FACE = 'heroSlotsFace'       // the chosen hero's portrait, over the moon: tap = go on
const TITLE = 'heroSlotsTitle'     // "Ar aghaidh le <name>?", above the moon
const STYLE_ID = 'heroSlotsStyle'
// the moon's own colour: what the ogham dial paints its moon with
const MOON_STOPS = NOCTURNE.on ? NOCTURNE.moon.stops : ['#f7f3e4', '#e0e7d8', '#bdccc0']
const MOON_LIGHT = NOCTURNE.on ? NOCTURNE.moon.light : '240,236,214'

const RESUME_KEY = 'corra_resume'  // { id, t } -- set by "Ar aghaidh", read once by the next load
const RESUME_FRESH_MS = 15000
const FADE_IN_DELAY_MS = 700

const ICON = {
  back: '<path d="M20 12H5M11 6l-6 6 6 6"/>',
  x:    '<path d="M6 6l12 12M18 6L6 18"/>',
}
function icon(kind) {
  const n = el('span', 'hs-ico')
  n.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[kind] + '</svg>'
  return n
}

// the dial listens on window; nothing that happens on our own bits may reach it
const SWALLOW = ['mousedown', 'mouseup', 'mousemove', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'pointerdown', 'pointerup']
function isolate(node) {
  for (const ev of SWALLOW) node.addEventListener(ev, e => e.stopPropagation(), { passive: true })
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = `
#${DIM}{position:fixed;inset:0;z-index:999998;background:rgba(3,3,8,0.78);opacity:0;pointer-events:none;
  transition:opacity .6s ease,background .4s ease;touch-action:none}
#${DIM}.on{opacity:1;pointer-events:auto}
#${DIM}.soft{background:rgba(3,3,8,0.5)}
#${STRIP}{position:fixed;left:0;right:0;bottom:0;z-index:999999;box-sizing:border-box;pointer-events:none;
  padding:34px 12px calc(env(safe-area-inset-bottom,0px) + 14px);color:${COLORS.irish};font-family:${FONTS.irish};
  background:linear-gradient(to top,rgba(4,4,9,.9) 0%,rgba(4,4,9,.6) 62%,rgba(4,4,9,0) 100%);
  opacity:0;transform:translateY(14px);transition:opacity .9s ease,transform .9s ease;-webkit-tap-highlight-color:transparent}
#${STRIP}.on{opacity:1;transform:none}
#${STRIP}.off{opacity:0;transition:opacity .45s ease}
#${STRIP} .hs-wrap{max-width:420px;margin:0 auto}
#${STRIP} .hs-row{display:flex;justify-content:center;gap:10px}
#${STRIP} .hs-card,#${STRIP} .hs-btn{pointer-events:auto;touch-action:manipulation;flex:1 1 0;max-width:122px;min-width:0;box-sizing:border-box;
  padding:${BUTTON.paddingY - 4}px 3px ${BUTTON.paddingY - 6}px;border:${BUTTON.borderWidth}px solid ${COLORS.domButtonBorder};border-radius:${BUTTON.borderRadius}px;
  background:${COLORS.domButtonFill};color:${COLORS.domButtonText};font:inherit;cursor:pointer;
  display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;outline:none}
#${STRIP} .hs-card:active,#${STRIP} .hs-btn:active{background:${COLORS.domButtonFillActive};border-color:${COLORS.domButtonBorderActive};color:${COLORS.domButtonTextActive}}
#${STRIP} .hs-btn{justify-content:center;gap:8px;font-family:${TYPE.button.font};font-size:${TYPE.button.size}}
#${STRIP} .hs-ico{display:block;line-height:0}
#${STRIP} .hs-ico svg{width:24px;height:24px;display:block}
#${STRIP} .hs-btn.red{background:none;border-color:#8a3d32;color:#e9b4a8}
#${STRIP} .hs-btn.red:active{background:#3a1713}
#${STRIP} .hs-btn.sure{background:#5a211a;border-color:#c9584a;color:#ffe3dc}
#${STRIP} .hs-gap{visibility:hidden;pointer-events:none}
#${STRIP} .hs-face{height:60px;width:auto;max-width:100%;image-rendering:pixelated}
#${STRIP} .hs-ga{font-family:${TYPE.button.font};font-size:${TYPE.button.size};line-height:1.15;overflow-wrap:anywhere}
#${STRIP} .hs-en{font-family:${FONTS.english};font-size:${TYPE.label.size};line-height:1.1;color:${COLORS.english}}
#${TITLE}{position:fixed;z-index:999999;transform:translate(-50%,-100%);width:max-content;max-width:min(88vw,420px);
  text-align:center;pointer-events:none;font-family:${TYPE.heading.font};font-size:${TYPE.heading.size};line-height:1.25;
  color:${COLORS.irish};text-shadow:0 0 16px rgba(0,0,0,.95),0 0 4px rgba(0,0,0,.8);opacity:0;transition:opacity .8s ease .2s}
#${TITLE}.on{opacity:1}
#${FACE}{position:fixed;z-index:999999;transform:translate(-50%,-50%);padding:0;overflow:hidden;border-radius:50%;border:0;
  background:radial-gradient(circle at 42% 38%,${MOON_STOPS[0]} 0%,${MOON_STOPS[1]} 70%,${MOON_STOPS[2]} 100%);
  cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;outline:none;
  opacity:0;filter:brightness(.25);transition:opacity 1s ease,filter 1.3s ease;
  box-shadow:0 0 34px rgba(${MOON_LIGHT},.5),0 0 90px rgba(${MOON_LIGHT},.22);animation:hsBreathe 3s ease-in-out infinite}
#${FACE}.on{opacity:1;filter:none}
#${FACE} canvas{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);image-rendering:pixelated}
@keyframes hsBreathe{0%,100%{box-shadow:0 0 28px rgba(${MOON_LIGHT},.4),0 0 80px rgba(${MOON_LIGHT},.16)}50%{box-shadow:0 0 44px rgba(${MOON_LIGHT},.65),0 0 110px rgba(${MOON_LIGHT},.3)}}
`
  document.head.appendChild(s)
}

function el(tag, cls, text) {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text != null) n.textContent = text
  return n
}

// Saved heroes that are still on the roster, newest first.
function loadHeroes() {
  const byId = new Map()
  for (const c of champions) if (c && c.spriteKey && c.nameGa) byId.set(GameState.heroIdOf(c), c)
  return GameState.listHeroes()
    .map(h => ({ ...h, champion: byId.get(h.id) }))
    .filter(h => h.champion)
}

// The champion's frame cropped to the figure itself. The frames carry empty
// space (and the figure is not centred in it), so a portrait centred by its
// frame looks off-centre; centred by its own pixels it isn't.
function portrait(champion) {
  const { spriteSheet, atlasData } = getPreloadedAssets()
  if (!spriteSheet || !atlasData || !champion?.spriteKey) return null
  const name = champion.spriteKey.endsWith('.png') ? champion.spriteKey : champion.spriteKey + '.png'
  const fd = atlasData.textures?.[0]?.frames?.find(f => f.filename === name)
  if (!fd) return null
  const { x, y, w, h } = fd.frame
  let sx = 0, sy = 0, sw = w, sh = h
  try {
    const probe = el('canvas')
    probe.width = w
    probe.height = h
    const pc = probe.getContext('2d', { willReadFrequently: true })
    pc.drawImage(spriteSheet, x, y, w, h, 0, 0, w, h)
    const px = pc.getImageData(0, 0, w, h).data
    let x0 = w, y0 = h, x1 = -1, y1 = -1
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (px[(j * w + i) * 4 + 3] > 8) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j }
    }
    if (x1 >= x0 && y1 >= y0) { sx = x0; sy = y0; sw = x1 - x0 + 1; sh = y1 - y0 + 1 }
  } catch (e) { /* the sheet can't be read back: use the whole frame */ }
  const cv = el('canvas', 'hs-face')
  cv.width = sw
  cv.height = sh
  cv.getContext('2d').drawImage(spriteSheet, x + sx, y + sy, sw, sh, 0, 0, sw, sh)
  return cv
}

// Where the intro's moon is on screen: the dial's own sums (see dialCentre in
// introOghamDial.js) -- an SVG 104vmin square, the moon at (0,0) of a 660 box
// whose centre is 70 units above it, 188 units across.
function moonGeometry() {
  const svg = document.getElementById('ogd-svg')
  let left, top, width
  if (svg) {
    const r = svg.getBoundingClientRect()
    left = r.left; top = r.top; width = r.width
  } else {
    width = Math.min(window.innerWidth, window.innerHeight) * 1.04
    left = (window.innerWidth - width) / 2
    top = (window.innerHeight - width) / 2
  }
  const k = width / 660
  return { cx: left + width / 2, cy: top + width / 2 + 70 * k, d: Math.max(96, 188 * k) }
}

// -- sound ------------------------------------------------------------------

// A tap on a hero in the strip is the first gesture, so it does what the moon's
// first touch does (fullscreen, audio unlock) and starts loading that hero's
// tune; going on then plays a few bars of it.
const snd = { ctx: null, heroId: null, player: null, loading: null }

function primeAudio(hero) {
  try { requestFullscreenWithFade() } catch (e) {}
  try { unlockAudio() } catch (e) {}
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!snd.ctx && AC) snd.ctx = new AC()
    if (snd.ctx && snd.ctx.state === 'suspended') snd.ctx.resume()
  } catch (e) {}
  if (snd.heroId === hero.id) return
  snd.heroId = hero.id
  try { snd.player?.stop?.() } catch (e) {}
  snd.player = null
  snd.loading = (async () => {
    try {
      const key = getTuneKeyForChampion(hero.champion)
      if (!key) return null
      const pl = new TradSessionPlayer()      // built inside the gesture
      snd.player = pl
      return (await pl.loadTune(key, false)) ? pl : null
    } catch (e) { return null }
  })()
}

// Two rolled chords, D then A: "yes, that one".
function chord() {
  const ctx = snd.ctx
  if (!ctx) return
  try {
    const t0 = ctx.currentTime + 0.05
    const master = ctx.createGain()
    master.gain.value = 0.22
    master.connect(ctx.destination)
    const play = (freqs, at, len) => freqs.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), s = t0 + at + i * 0.06
      o.type = 'triangle'
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, s)
      g.gain.linearRampToValueAtTime(0.5, s + 0.04)
      g.gain.exponentialRampToValueAtTime(0.001, s + len)
      o.connect(g).connect(master)
      o.start(s)
      o.stop(s + len + 0.05)
    })
    play([146.83, 220.0, 293.66, 369.99], 0, 1.8)
    play([220.0, 277.18, 329.63, 440.0], 0.85, 2.2)
  } catch (e) { console.warn('[HeroSlots] chord:', e) }
}

const TUNE_MS = 3800, TUNE_FADE_MS = 1800

// A few bars of the hero's own tune, fading out; the chord if it is not ready.
async function celebrate(hero) {
  const loading = snd.heroId === hero.id ? snd.loading : null
  const pl = loading ? await Promise.race([loading, new Promise(r => setTimeout(() => r(null), 700))]) : null
  if (pl) {
    try {
      await pl.play()
      const tracks = pl.tracks || []
      let i = tracks.findIndex(t => t && t.name === 'Piano')
      if (i < 0 && tracks.length > 1) i = 1
      if (i >= 0 && tracks[i] && !tracks[i].active) await pl.toggleInstrument(i)
      setTimeout(() => {
        try {
          const t = pl.audioContext.currentTime
          for (const tr of pl.tracks || []) if (tr?.gain) {
            tr.gain.gain.setValueAtTime(tr.gain.gain.value, t)
            tr.gain.gain.linearRampToValueAtTime(0, t + TUNE_FADE_MS / 1000)
          }
        } catch (e) {}
        setTimeout(() => { try { pl.stop() } catch (e) {} }, TUNE_FADE_MS + 200)
      }, TUNE_MS)
      return
    } catch (e) { console.warn('[HeroSlots] tune:', e) }
  }
  chord()
}

// -- going in -----------------------------------------------------------------

// "Ar aghaidh": leave a note and reload; the next load calls enter().
function go(hero) {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify({ id: hero.id, t: Date.now() }))
  } catch (e) {
    console.error('[HeroSlots] cannot leave the resume note:', e)
    return
  }
  location.reload()
}

// Read (and clear) the note a reload left behind.
function takeResumeNote() {
  let note = null
  try {
    note = JSON.parse(localStorage.getItem(RESUME_KEY) || 'null')
    localStorage.removeItem(RESUME_KEY)
  } catch (e) { return null }
  return note && note.id && Date.now() - (note.t || 0) < RESUME_FRESH_MS ? note.id : null
}

// Leave these screens the way the Training button does, then start the game on the saved spot.
function enter(hero) {
  window.stopStarfield?.()
  for (const id of ['starfieldLoader', 'heroSelect']) {
    const n = document.getElementById(id)
    if (n) n.style.display = 'none'
  }
  const gc = document.getElementById('gameContainer')
  if (gc) {
    gc.style.display = ''
    gc.style.opacity = '1'
    gc.style.position = 'fixed'
    gc.style.inset = '0'
    gc.style.zIndex = '999999'
  }
  const opts = { startScene: hero.scene }
  if (hero.tile) opts.tile = hero.tile
  // main.js sets window.startGame as its module finishes; this can run a touch earlier
  let tries = 0
  const start = () => {
    if (window.startGame) return window.startGame(hero.champion, opts)
    if (++tries > 100) return console.error('[HeroSlots] window.startGame not found!')
    setTimeout(start, 50)
  }
  start()
}

// -- the strip ----------------------------------------------------------------

export function showHeroSlots() {
  const handle = { resumed: false, dismiss() {} }
  const q = new URLSearchParams(location.search)
  if (q.has('scene') || q.has('crossing')) return handle

  let heroes = loadHeroes()

  // this load is "Ar aghaidh" coming back round
  const want = takeResumeNote()
  if (want) {
    const hero = heroes.find(h => h.id === want)
    if (hero && hero.scene) {
      handle.resumed = true
      enter(hero)
      return handle
    }
  }

  if (!heroes.length) return handle

  ensureStyle()
  const enOp = () => GameSettings.englishOpacity ?? 0.15
  let gone = false
  let strip = null
  let face = null
  let title = null
  let faceHero = null
  let going = false
  let view = { mode: 'list', hero: null }     // 'list' | 'hero' (chosen) | 'confirm' (Scrios?)
  let listH = 0                                // the list row's height, kept by the two-button rows

  // the cover over the intro: all slots full, or a hero chosen -- the intro is out of reach
  const dim = el('div')
  dim.id = DIM
  isolate(dim)
  dim.addEventListener('click', () => {         // a tap on the dim steps back, never forward
    if (view.mode === 'hero') show('list')
    else if (view.mode === 'confirm') show('hero', view.hero)
  })
  document.body.appendChild(dim)
  const syncDim = () => {
    // a frame later, so the very first one fades in
    requestAnimationFrame(() => {
      dim.classList.toggle('on', !gone && (heroes.length >= MAX_HEROES || view.mode !== 'list'))
      dim.classList.toggle('soft', view.mode !== 'list')
    })
  }
  syncDim()

  function dismiss() {
    if (gone) return
    gone = true
    window.removeEventListener('touchstart', onOutside, true)
    window.removeEventListener('mousedown', onOutside, true)
    window.removeEventListener('resize', onResize)
    dim.classList.remove('on')
    if (strip) { strip.classList.remove('on'); strip.classList.add('off') }
    face?.classList.remove('on')
    title?.classList.remove('on')
    setTimeout(() => { strip?.remove(); face?.remove(); title?.remove(); dim.remove() }, 700)
  }
  handle.dismiss = dismiss

  // Touching the intro itself (the moon, its ring, the poem) is how a new hero begins.
  function onOutside(e) {
    if (gone || view.mode !== 'list' || heroes.length >= MAX_HEROES) return
    const t = e.target
    if ((strip && strip.contains(t)) || dim.contains(t) || (face && face.contains(t))) return
    dismiss()
  }
  window.addEventListener('touchstart', onOutside, { capture: true, passive: true })
  window.addEventListener('mousedown', onOutside, { capture: true, passive: true })

  const button = (text, cls, ico, onClick) => {
    const b = el('button', 'hs-btn ' + cls)
    b.type = 'button'
    b.append(el('span', null, text), icon(ico))
    b.onclick = onClick
    return b
  }

  // the chosen hero, over the moon, with the question above it
  function placeFace() {
    if (!face) return
    const g = moonGeometry()
    face.style.left = g.cx + 'px'
    face.style.top = g.cy + 'px'
    face.style.width = face.style.height = g.d + 'px'
    const cv = face.querySelector('canvas')
    if (cv) {
      // the whole figure inside the disc: its diagonal is 86% of the moon's width
      const k = (0.86 * g.d) / Math.hypot(cv.width, cv.height)
      cv.style.width = Math.round(cv.width * k) + 'px'
      cv.style.height = Math.round(cv.height * k) + 'px'
    }
    if (title) {
      title.style.left = g.cx + 'px'
      title.style.top = (g.cy - g.d * 0.9) + 'px'
    }
  }
  // fullscreen resizes the screen and the dial re-lays itself out: follow it
  const onResize = () => requestAnimationFrame(() => requestAnimationFrame(placeFace))
  window.addEventListener('resize', onResize)

  function syncFace() {
    if (gone || view.mode === 'list') {
      face?.remove(); title?.remove()
      face = title = faceHero = null
      return
    }
    const hero = view.hero
    if (!face || faceHero !== hero) {            // Ar ais / Ná Scrios keep the same moon, no new fade
      face?.remove()
      faceHero = hero
      face = el('button')
      face.id = FACE
      face.type = 'button'
      const cv = portrait(hero.champion)
      if (cv) { cv.removeAttribute('class'); face.appendChild(cv) }
      else {
        face.textContent = hero.champion.nameGa
        face.style.fontFamily = TYPE.heading.font
        face.style.fontSize = TYPE.heading.size
        face.style.color = '#222'
      }
      face.onclick = () => proceed(hero)
      isolate(face)
      document.body.appendChild(face)
      requestAnimationFrame(() => face?.classList.add('on'))
    }
    if (!title) {
      title = el('div')
      title.id = TITLE
      document.body.appendChild(title)
      requestAnimationFrame(() => title?.classList.add('on'))
    }
    title.textContent = view.mode === 'confirm' ? 'Scrios?' : `Ar aghaidh le ${hero.champion.nameGa}?`
    placeFace()
  }

  // The face was tapped: go on. The intro is still running behind the strip;
  // take it down in place (fullscreen and audio stay), sound the hero, start the game.
  function proceed(hero) {
    if (going || gone) return
    going = true
    let down = false
    try { down = abortIntro() } catch (e) { console.warn('[HeroSlots] abortIntro:', e) }
    if (!down) return go(hero)                   // could not: reload into the saved scene instead
    celebrate(hero)
    dismiss()
    setTimeout(() => enter(hero), 150)           // let the intro's Phaser game finish going before the next one starts
  }

  function show(mode, hero = null) {
    if (gone || !strip) return
    const prev = view.mode
    const oldRow = strip.querySelector('.hs-row')
    if (prev === 'list' && oldRow) listH = oldRow.offsetHeight
    view = { mode, hero }

    const row = el('div', 'hs-row')
    if (mode === 'list') {
      for (const h of heroes) {
        const card = el('button', 'hs-card')
        card.type = 'button'
        const f = portrait(h.champion)
        if (f) card.appendChild(f)
        card.appendChild(el('div', 'hs-ga', h.champion.nameGa))
        const en = el('div', 'hs-en', h.champion.nameEn || '')
        en.style.opacity = String(enOp())
        card.appendChild(en)
        card.onclick = () => { primeAudio(h); show('hero', h) }
        row.appendChild(card)
      }
    } else {
      if (listH) row.style.height = listH + 'px'      // the end slots keep the cards' size
      const confirming = mode === 'confirm'
      row.append(
        button(confirming ? 'Ná Scrios' : 'Ar ais', '', 'back', () => show(confirming ? 'hero' : 'list', confirming ? hero : null)),
        el('div', 'hs-btn hs-gap'),
        confirming
          ? button('Scrios', 'red sure', 'x', () => { GameState.deleteHero(hero.id); refresh() })
          : button('Scrios', 'red', 'x', () => show('confirm', hero)),
      )
    }
    const wrap = el('div', 'hs-wrap')
    wrap.appendChild(row)
    strip.replaceChildren(wrap)
    syncFace()
    syncDim()
  }

  // after the list changes (a delete)
  function refresh() {
    heroes = loadHeroes()
    if (!heroes.length) { view = { mode: 'list', hero: null }; syncFace(); return dismiss() }
    show('list')
  }

  // the portraits come from the intro's preloaded sprite sheet; don't wait on it for long
  Promise.race([waitForHeroAssets(), new Promise(r => setTimeout(r, 4000))]).then(() => {
    if (gone) return
    strip = el('div')
    strip.id = STRIP
    isolate(strip)
    document.body.appendChild(strip)
    show('list')
    setTimeout(() => { if (!gone) strip.classList.add('on') }, FADE_IN_DELAY_MS)
  })

  return handle
}

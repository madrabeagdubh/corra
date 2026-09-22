// introLevel v8
//
// js/game/scenes/locations/bog/introLevel.js
//
// SPIKE, LEAN. A real level (the mountains-and-hilltop plates level) drawn BEHIND the intro
// by the game's own ground renderer, and nothing else. Dev-only: it runs only with ?level=1.
//
//   ?level=1                 the HILLTOP level, night-graded, dimmed by the moon
//   &fps=1                   a readout: frame rate, worst frame, load time (and any failure)
//   &dolly=1                 a slow pull-back over the poem (OFF by default: the druid and
//                            queen are still an overlay, and would slide over the ground)
//   &flora=0                 no wildflowers (isolates their cost)
//   &lit=1                   no moon dimming: the land at full brightness from the start
//   &horizon=0.74            where the horizon sits (0.02 - 0.9). LOW = a low camera: more
//                            sky, the land compressed into the bottom of the screen
//   &across=6.5              tiles across the screen at the camera's feet (bigger = the world
//                            looks farther away and finer-grained)
//   &clip=0.15               how far ABOVE the horizon terrain may rise (fraction of screen
//                            height from the top); needs the renderer's CLIP_TOP_FRAC flag
//   &haze=0.6                strength of the depth-haze band at the horizon (0 = none)
//   &fade=0                  the renderer's own horizon fade, in px (default 60 in the game, 0
//                            here). See "THE SEE-THROUGH MOUNTAINS" below.
//   &panTiles=4               how far the ground pans (in tiles) when the intro turns to look at
//                            another part of the sky. 0 = the ground does not pan at all.
//   &veil=1                   force the fullscreen grey veil on/off (1/0). Auto-detected by
//                            default: touch device, Fullscreen API present, not already
//                            fullscreen. See "THE VEIL" below.
//   &map=plates              the earlier mountains-and-hilltop test level instead
//   &band=far|mid|near       one of that level's single bands
//
// THE SEE-THROUGH MOUNTAINS (v5 -> v6)
//   The renderer fades every ground row whose FLAT position lies within 60 canvas px of the
//   horizon toward transparent. It was written for a tall ground area; with a low horizon on a
//   phone (the canvas is CSS px, ~850 tall, so the ground is ~210 px) that band swallows
//   everything beyond about 30 tiles, and the ridges and the far range were drawn 40-80% opaque,
//   with the stars showing through. HORIZON_FADE_PX (opt-in, default 60 = unchanged) is 0 here.
//
// THE FIGURES NO LONGER SLIDE; THE GROUND DOES ALL THE TURNING (v6 -> v7)
//   The intro's camera pan slid the druid and queen sideways to sell "turning to look at another
//   part of the sky" -- v6 kept them on screen but made the ground chase their feet in
//   compensation. That still read as the FIGURES sliding, with the ground catching up. v7 does
//   it the other way round: nightScape.setPan() no longer moves the figures at all (they stay
//   anchored on screen; see nightScape.js) and instead tells this scene the pan fraction
//   directly; the scene strafes the camera by up to panTiles. Nearer ground still moves more
//   than farther ground (parallax), which is what reads as depth -- but now the PEOPLE are the
//   fixed point and the WORLD turns around them, which is the more convincing version of the
//   same idea.
//
// THE TOAST, SIMPLIFIED (v6 -> v7)
//   v6's fullscreen-notice handling lifted the whole ground to match the old plates behaviour,
//   using nightScape's OWN toastFill/toastHaze elements -- sized and coloured for backdrop
//   plates that no longer exist here. Those elements sat ABOVE this level's ground (z 29-30
//   against the ground's 18-24), so instead of a subtle gap-filler they were a flat grey slab
//   laid over the real terrain for the whole ~20 s hold-and-settle. v7 leaves the ground alone:
//   it already reaches the bottom of the canvas, so Chrome's pill can simply sit over it. Only
//   the two small figure sprites still rise a little (nightScape.js) -- this scene had nothing
//   to do for the toast any more.
//
// THE VEIL (v7 -> v8)
//   v7 went too far the other way: the grey fade was part of the effect people liked, not just
//   a bug to remove. v8 brings it back, but as a VEIL rather than a structural lift: a soft grey
//   overlay across the land (this scene's own element, same colour family as the depth haze, so
//   it reads as part of the same misty air rather than a disconnected slab), which simply
//   dissolves once the browser settles into fullscreen (or after a short wait, if the person
//   never touches the fullscreen prompt). Nothing underneath it moves, so there is nothing for
//   it to line up WITH -- it only has to fade.
//   This is entirely self-contained (its own fullscreenchange listener, its own timing), not
//   coordinated with nightScape's separate, smaller figure-lift, because that cross-file
//   coordination is exactly what went wrong in v6.
//
// THE RESIZE JUMP (v7 -> v8)
//   Entering fullscreen changes the canvas's own pixel size (Chrome's toolbars leave), and the
//   camera's target position is computed directly from that size. Until now a resize was only
//   ever eased toward (FOLLOW, same as everything else), which reads as a smooth pan for a
//   deliberate camera move -- but a resize is not a pan, it is the screen changing shape, and
//   easing toward a suddenly-different target for several frames showed as a hard jump partway
//   through, with the ground and the (fixed) figures briefly out of step. A resize is now
//   detected and the camera snaps to the new target on that one frame instead of easing into it.
//
// THE HILLTOP (v4 -> v5)
//   The camera stands on a hilltop looking north; the druid and queen stand on its crown; the
//   land falls away past the crown's edge and rolls toward a far range. Two things make a low
//   camera possible, and both are small:
//     - the horizon param is no longer clamped at 0.45 (v4 silently treated 0.70 as 0.45,
//       and the "flat plane cut off in the air" it produced was that, plus no relief);
//     - PerspectiveGroundRenderer.CLIP_TOP_FRAC (opt-in, default null = unchanged) lets
//       terrain rise above the horizon line instead of being sliced off at it.
//   The map (public/maps/bogMaps/intro_hilltop.json, from intro_hilltop_gen.py, which has
//   its own tuning knobs at the top) is designed around what the renderer does: heights may
//   be NEGATIVE (0 is the camera's eye level), a drop-off hides its own near slope behind
//   the crown edge, and the far range falls away behind its own crest so the map's north
//   edge (a straight cut where nothing is drawn) is hidden behind the skyline. The renderer
//   already hill-shades by height and slope, so real relief shows form on its own; a soft
//   screen-space haze band (below) stands in for depth fog.
//
// WHY LEAN (v3 -> v4)
//   v1-v3 subclassed PerspectiveScene, which builds a whole GAME around the ground: a hero
//   with stats and a health bar, the D-pad and moon hub, bow mechanics, fog of war, a
//   pathfinder, Phaser's light pipeline, tap-to-walk, ~30 asset loads (champion sheets,
//   inventory icons, six sounds). It failed on the first thing it needed and it would have
//   cost frames on everything it did not. The ground renderer itself asks its host for very
//   little (checked in the source, not assumed):
//       scene.mapData     the map: layers, heightMap, width, height
//       scene.game.canvas the size to draw at, and where to attach its DOM canvases
//       scene.cameras.main   scrollX/scrollY = where it is looking from
//       scene.vegetation  (optional) the wildflowers; scene.onPGRDrawComplete (optional)
//   It loads its own tile art with an Image, treats a missing player as "draw none" and a
//   missing forest-effects object as "no trees". So this host provides exactly those, and
//   nothing else exists: no player, no HUD, no lights, no physics, no input.
//
//   What it loads: the map (one JSON). The renderer fetches the tileset image itself.
//
// HOW IT SITS IN THE PAGE
//   The intro is its OWN Phaser game (introModal.js builds it; the main game does not exist
//   until the intro ends), and this scene is registered in THAT game. The ground renderer
//   paints DOM canvases that normally sit BENEATH the Phaser canvas (z 2-3); in the intro
//   that canvas holds the STARS, so every pgr-* layer is lifted from z (0-6) to z (18-24):
//   above the stars, below the druid and queen (nightScape, z 30+) and the dial. The layers
//   are transparent above the horizon, so the stars still show.
//   When the intro ends it calls game.destroy(true), which removes the Phaser canvas but not
//   these DOM canvases: the scene cleans up on shutdown AND destroy, and is stopped first.
//
// FAILURE IS VISIBLE, AND CONTAINED
//   An error inside create() is an unhandled rejection in Phaser's eyes, and one thrown out
//   of update() ends its frame loop, so both are caught: the level says why on screen (red,
//   with &fps=1), removes what it added, and stops itself so the intro carries on.
import PerspectiveGroundRenderer from '../../../effects/perspectiveGroundRenderer.js'
import { Vegetation } from '../../../effects/vegetation.js'
import SteepFaceRenderer from '../../../effects/steepFaceRenderer.js'
import { wind } from '../../../effects/wind.js'

const TILE        = 48     // logical px per tile: the generated maps and the renderer both use it
// Per map: where the camera stands (col, PLAYER row: the renderer looks 14 rows beyond it), how far
// the optional dolly pulls it back, and the framing that suits the map.
const MAPS = {
  hilltop: { file: 'intro_hilltop', col: 48.0, row: 100, dollyRows: 5,  horizon: 0.75, across: 6.5, clip: 0.15, haze: 0.6, fade: 0,  panTiles: 4 },
  plates:  { file: 'plates',        col: 24.5, row: 44.5, dollyRows: 12, horizon: 0.10, across: 3.8, clip: null, haze: 0,   fade: 60, panTiles: 0 },
}
const HAZE_RGB   = '74,104,112'  // a cool, pale night-haze, chosen in the graded (post-filter) space
// The veil: how strong at most, how long it holds once fullscreen is confirmed, how long it takes
// to fade, and how long it waits before giving up on a fullscreen prompt that never resolves.
const VEIL_MAX_ALPHA  = 0.55
const VEIL_HOLD_MS    = 2600
const VEIL_FADE_MS    = 2400
const VEIL_GIVEUP_MS  = 9000
// Where the figures' feet stand, as a fraction of the page height (measured from a real screenshot
// of their resting pose). The pan is sized so the ground AT THIS HEIGHT moves with them.
const FOLLOW      = 0.1    // the camera eases toward its target like the game's own follow does
const DARK        = 0.30   // the moon's dimming at a new moon: the same number nightScape uses
const GRADED      = ['pgr-ground', 'steep-face-overlay', 'pgr-objects']
// The moonlit grade, as on the plates scene (tuned on a real capture of this level).
const NIGHT       = { sat: 0.55, slope: [0.30, 0.42, 0.62], lift: [0.010, 0.020, 0.055] }

export default class IntroLevelScene extends Phaser.Scene {
  // Read by SteepFaceRenderer through scene.constructor: stone only on slopes steeper than
  // 70% of this (0.84), so the mountains' upper faces are rock and the hilltop stays grass.
  static CLIMB_MAX_STEP = 1.2

  constructor() {
    super({ key: 'intro_level' })
    const q   = new URLSearchParams(window.location.search)
    const num = (k, d) => { const v = parseFloat(q.get(k)); return Number.isFinite(v) ? v : d }
    this._fpsOn   = q.get('fps') === '1'
    this._dolly   = q.get('dolly') === '1'
    this._flora   = q.get('flora') !== '0'
    this._night   = q.has('night') ? Math.max(0, Math.min(1, num('night', 1))) : 1
    // Which map: the hilltop by default; ?map=plates (or any ?band=) picks the earlier test level.
    const band    = q.get('band')
    const bandOk  = ['far', 'mid', 'near'].includes(band)
    this._mapKey  = (q.get('map') === 'plates' || bandOk) ? 'plates' : 'hilltop'
    const cfg     = MAPS[this._mapKey]
    this._cfg     = cfg
    this._mapUrl  = `/maps/bogMaps/${bandOk ? 'plates_' + band : cfg.file}.json`
    this._horizon = Math.max(0.02, Math.min(0.9, num('horizon', cfg.horizon)))
    this._across  = Math.max(0.8, Math.min(12, num('across', cfg.across)))
    this._clip    = q.has('clip') ? Math.max(0, Math.min(this._horizon, num('clip', 0))) : cfg.clip
    this._haze    = Math.max(0, Math.min(1, num('haze', cfg.haze)))
    this._fade    = Math.max(0, Math.min(200, num('fade', cfg.fade)))
    this._panTiles = Math.max(0, Math.min(20, num('panTiles', cfg.panTiles)))
    this._panFraction = 0     // -1..1, from nightScape.setPan(): how far the world has turned
    this._veilForce = q.has('veil') ? q.get('veil') === '1' : null   // null = auto-detect
    this._lastSw = null; this._lastSh = null   // last frame's canvas size, to catch a resize
    this._u       = 0                                          // the poem's progress, 0..1
    this._brightness = q.get('lit') === '1' ? 1 : DARK
    this._preExisting = null
  }

  preload() {
    this._t0 = performance.now()
    // What is on the page before this scene adds anything, so cleanup only removes ITS elements.
    this._preExisting = new Set(document.querySelectorAll('[id]'))
    if (this._fpsOn) this._status('introLevel: loading...')
    this.load.json('introMap', `${this._mapUrl}?v=${Date.now()}`)
  }

  create() {
    try {
      this._build()
    } catch (e) {
      this._fail(e)
    }
  }

  _build() {
    const map = this.cache.json.get('introMap')
    if (!map?.layers || !map?.heightMap) throw new Error(`the map did not load, or is malformed: ${this._mapUrl}`)
    this.mapData   = map
    this.tileSize  = TILE
    this.mapWidth  = map.width  * TILE
    this.mapHeight = map.height * TILE
    map.tiles = map.layers[0]
    map.unwalkableTiles = []
    map.spawns  = map.spawns  || { player: { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) } }
    map.exits   = map.exits   || {}

    // The renderer's settings live on the class as statics. Set the whole family, so what
    // this scene leaves behind is the baseline the game's own levels start from anyway.
    Object.assign(PerspectiveGroundRenderer, {
      HORIZON_Y_FRAC:    this._horizon,
      CAMERA_ROW_OFFSET: 14.0,
      FOCAL_LENGTH:      12.0,
      TILES_ACROSS:      this._across,
      PLAYER_SCALE:      0.7,
      PLAYER_DIST_TILES: 1.2,
      // Opt-in (see the header): let terrain rise above the horizon. Ignored by a renderer
      // without the flag; reset to null in _cleanup so no other level inherits it.
      CLIP_TOP_FRAC:     this._clip,
      // Opt-in too: the renderer's own fade of far rows toward transparent (60 px in the game).
      HORIZON_FADE_PX:   this._fade,
    })

    // Nothing here is drawn by Phaser; only this camera's scroll matters.
    this.cameras.main.visible = false

    this.perspectiveGround = new PerspectiveGroundRenderer(this)
    this.perspectiveGround.setBuildings([])
    if (this._flora) {
      this.vegetation = new Vegetation(this, {
        pgr: this.perspectiveGround, density: 0.34, clumpBias: 0.55, minScale: 22, heightTiles: 0.9,
      })
    }
    this.steepFaces = new SteepFaceRenderer(this)     // made BEFORE the grade looks for layers

    this._applyNight()
    this._raiseAboveStars()
    this._addHaze()                                   // after the lift: it sets its own z-index
    this._addVeil()                                    // after the haze: it sits just above it
    this._applyBrightness()

    // The intro's own clock drives this scene, through two hooks nightScape calls: the poem's
    // progress, and the moon's brightness.
    window.__introLevelProgress   = (u) => { this._u = Math.max(0, Math.min(1, u)) }
    window.__introLevelBrightness = (b) => { this._brightness = b; this._applyBrightness() }
    // The pan fraction (-1..1) from nightScape.setPan(): the figures stay put, and the ground
    // does all the turning (see the header). Clamp defensively; NaN must never reach the camera.
    window.__introLevelPan        = (f) => { this._panFraction = Number.isFinite(f) ? Math.max(-1, Math.min(1, f)) : 0 }

    this._readyMs = Math.round(performance.now() - this._t0)
    console.log(`[introLevel] ready ${this._readyMs} ms after preload began | map ${this._mapKey} horizon ${this._horizon} across ${this._across} clip ${this._clip} haze ${this._haze} fade ${this._fade} panTiles ${this._panTiles} dolly ${this._dolly} flora ${this._flora}`)
    if (this._fpsOn) { this._status('introLevel: ready'); this._startFps() }

    this.events.once('shutdown', () => this._cleanup())
    this.events.once('destroy',  () => this._cleanup())
  }

  // Called by the ground renderer after every frame it draws.
  onPGRDrawComplete() {
    if (this.steepFaces) this.steepFaces.update()
  }

  // The flora and canopy sway must keep animating with a still camera.
  hasContinuousAnimation() { return true }

  update(time, delta) {
    if (this._dead || !this.perspectiveGround) return
    try {
      wind.update(delta)
      // The camera looks FROM its centre: the renderer reads scrollX/scrollY as where the
      // "player" is. Ease toward the target the way the game's own follow does.
      const cam = this.cameras.main
      const sw = this.game.canvas.width, sh = this.game.canvas.height
      // A resize (entering fullscreen; the on-screen keyboard; rotating) is not a camera move --
      // easing toward the new target would show as a jump partway through. Snap to it instead.
      const resized = this._lastSw !== null && (sw !== this._lastSw || sh !== this._lastSh)
      this._lastSw = sw; this._lastSh = sh
      const u  = this._dolly ? this._u : 0
      const tx = this._cfg.col * TILE - sw / 2
      const ty = (this._cfg.row + u * this._cfg.dollyRows) * TILE - sh / 2
      if (!this._camPlaced || resized) { this._baseX = tx; cam.scrollY = ty; this._camPlaced = true }
      else { this._baseX += (tx - this._baseX) * FOLLOW; cam.scrollY += (ty - cam.scrollY) * FOLLOW }
      // The pan is NOT eased: the figures it must match move on the intro's own tween, and any lag
      // here would show as the ground trailing behind the people standing on it.
      cam.scrollX = this._baseX + this._panCols() * TILE
      this.perspectiveGround.update()
      if (this._fpsTick) this._fpsTick()
    } catch (e) {
      console.error('[introLevel] failed; stopping the level so the intro carries on:', e)
      this._fail(e)
    }
  }

  // The pan, in tiles: the fraction nightScape reports, scaled by this map's own panTiles.
  // No easing here (see update()): the world must not lag behind the moment the poem turns.
  _panCols() {
    return this._panFraction * this._panTiles
  }

  _fail(e) {
    if (this._dead) return
    console.error('[introLevel] FAILED; the intro carries on without it:', e)
    this._dead = true
    this._status(`introLevel FAILED: ${e?.message || e}`, true)
    this._cleanup(true)
    try { this.scene.stop() } catch (_) { /* already stopping */ }
  }

  // Everything this scene put on the page or on window. Runs on shutdown AND destroy: when the
  // intro ends, game.destroy(true) removes the Phaser canvas, but not the ground renderer's
  // DOM canvases, which would otherwise sit over the next screen.
  _cleanup(keepReadout = false) {
    if (this._cleaned) return
    this._cleaned = true
    delete window.__introLevelProgress
    delete window.__introLevelBrightness
    delete window.__introLevelPan
    if (this.steepFaces) { try { this.steepFaces.destroy() } catch (_) {} this.steepFaces = null }
    if (!keepReadout) { this._fpsEl?.remove(); this._fpsEl = null }
    this._fpsTick = null
    document.querySelectorAll('[id^="pgr-"], #steep-face-overlay').forEach(el => {
      if (!this._preExisting?.has(el)) el.remove()
    })
    if (this._nightSvg) { this._nightSvg.remove(); this._nightSvg = null }
    this._hazeEl = null
    if (this._veilAnim) { try { this._veilAnim.cancel() } catch (_) {} this._veilAnim = null }
    if (this._veilTimer) { clearTimeout(this._veilTimer); this._veilTimer = null }
    document.removeEventListener('fullscreenchange', this._onVeilFs)
    document.removeEventListener('webkitfullscreenchange', this._onVeilFs)
    this._veilEl = null
    PerspectiveGroundRenderer.CLIP_TOP_FRAC = null    // never leak the flags into the game's own levels
    PerspectiveGroundRenderer.HORIZON_FADE_PX = 60
  }

  // pgr-* layers sit at z 0-6, under the Phaser canvas (z 10). Lift them to z 18-24: above
  // the stars, still under nightScape (30+) and the dial.
  _raiseAboveStars() {
    document.querySelectorAll('[id^="pgr-"], #steep-face-overlay').forEach(el => {
      const z = parseInt(el.style.zIndex || '0', 10) || 0
      el.style.zIndex = String(18 + z)
    })
  }

  // A soft grey veil over the land, dissolving once fullscreen is confirmed (or given up on).
  // Self-contained: its own detection, its own timing, no coordination with nightScape's much
  // smaller figure-lift (see the header for why that coordination was the wrong idea in v6).
  _addVeil() {
    const inFs  = () => !!(document.fullscreenElement || document.webkitFullscreenElement)
    const auto  = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)
      && !inFs() && window.matchMedia && window.matchMedia('(pointer: coarse)').matches
    const on = this._veilForce !== null ? this._veilForce : auto
    if (!on) return
    const el = document.createElement('div')
    el.id = 'pgr-intro-veil'
    const hz = this._horizon * 100
    el.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:24;' +
      `opacity:${VEIL_MAX_ALPHA};` +
      `background:linear-gradient(to bottom,rgba(${HAZE_RGB},0) ${Math.max(0, hz - 6)}%,rgba(${HAZE_RGB},1) ${hz}%);`
    document.body.appendChild(el)
    this._veilEl = el
    this._onVeilFs = () => { if (inFs()) this._settleVeil() }
    document.addEventListener('fullscreenchange', this._onVeilFs)
    document.addEventListener('webkitfullscreenchange', this._onVeilFs)
    this._veilTimer = setTimeout(() => this._settleVeil(), VEIL_GIVEUP_MS)
  }

  _settleVeil() {
    if (!this._veilEl || this._veilAnim) return
    clearTimeout(this._veilTimer); this._veilTimer = null
    document.removeEventListener('fullscreenchange', this._onVeilFs)
    document.removeEventListener('webkitfullscreenchange', this._onVeilFs)
    const el = this._veilEl
    this._veilAnim = el.animate(
      [{ opacity: VEIL_MAX_ALPHA, offset: 0 }, { opacity: VEIL_MAX_ALPHA, offset: VEIL_HOLD_MS / (VEIL_HOLD_MS + VEIL_FADE_MS) }, { opacity: 0, offset: 1 }],
      { duration: VEIL_HOLD_MS + VEIL_FADE_MS, easing: 'cubic-bezier(.37,0,.63,1)', fill: 'both' })
    this._veilAnim.onfinish = () => { el.style.opacity = '0'; el.remove(); if (this._veilEl === el) this._veilEl = null }
  }

  // The moonlit grade: an SVG filter on the WORLD layers (saturation down, per-channel gain,
  // a small blue lift in the shadows). `night` (0..1) blends from "no change" to the full grade.
  _applyNight() {
    const t = this._night
    if (!t) return
    const lerp  = (v) => 1 + (v - 1) * t
    const sat   = lerp(NIGHT.sat)
    const slope = NIGHT.slope.map(lerp)
    const lift  = NIGHT.lift.map(v => v * t)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0')
    svg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none;'
    svg.innerHTML =
      `<filter id="plates-night" color-interpolation-filters="sRGB">` +
      `<feColorMatrix type="saturate" values="${sat.toFixed(4)}"/>` +
      `<feComponentTransfer>` +
      `<feFuncR type="linear" slope="${slope[0].toFixed(4)}" intercept="${lift[0].toFixed(4)}"/>` +
      `<feFuncG type="linear" slope="${slope[1].toFixed(4)}" intercept="${lift[1].toFixed(4)}"/>` +
      `<feFuncB type="linear" slope="${slope[2].toFixed(4)}" intercept="${lift[2].toFixed(4)}"/>` +
      `</feComponentTransfer></filter>`
    document.body.appendChild(svg)
    this._nightSvg = svg          // held, so cleanup never depends on finding it again
  }

  // Depth haze, standing in for fog: a soft band centred on the horizon, strongest there and
  // fading up into the sky and down the land. Rows map monotonically to screen height, so
  // "near the horizon" is "far away" and this reads as atmosphere. id starts with pgr-, so
  // _cleanup removes it with the rest; it dims with the moon like the land does.
  _addHaze() {
    if (!this._haze) return
    const hz  = this._horizon
    const top = Math.max(0, hz - 0.10) * 100, mid = hz * 100, bot = Math.min(100, (hz + 0.22) * 100)
    const el = document.createElement('div')
    el.id = 'pgr-intro-haze'
    el.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:23;' +
      `background:linear-gradient(to bottom,rgba(${HAZE_RGB},0) ${top}%,rgba(${HAZE_RGB},${this._haze}) ${mid}%,rgba(${HAZE_RGB},0) ${bot}%);`
    document.body.appendChild(el)
    this._hazeEl = el
  }

  // The night grade, then the moon's dimming on top. Only reference the grade's filter if it
  // exists: a url() to nothing can void the whole filter list.
  _applyBrightness() {
    const grade = this._night ? 'url(#plates-night) ' : ''
    const f = `${grade}brightness(${this._brightness.toFixed(3)})`
    for (const id of GRADED) {
      const el = document.getElementById(id)
      if (el) el.style.filter = f
    }
    if (this._hazeEl) this._hazeEl.style.filter = `brightness(${this._brightness.toFixed(3)})`
  }

  // The readout. Made on demand, so it can exist from preload; an error stays on screen.
  _status(text, isError = false) {
    if (!this._fpsEl) {
      const el = document.createElement('div')
      el.style.cssText = 'position:fixed;left:6px;top:calc(env(safe-area-inset-top,0px) + 6px);' +
        'z-index:2147483646;font:12px/1.35 monospace;color:#9f9;background:rgba(0,0,0,.6);' +
        'padding:3px 7px;border-radius:4px;pointer-events:none;white-space:pre-wrap;max-width:92vw;'
      document.body.appendChild(el)
      this._fpsEl = el
    }
    if (isError) { this._fpsErr = true; this._fpsEl.style.color = '#f88' }
    if (!this._fpsErr || isError) this._fpsEl.textContent = text
  }

  _startFps() {
    let frames = 0, acc = 0, worst = 0, last = performance.now()
    this._fpsTick = () => {
      const now = performance.now(), dt = now - last
      last = now; frames++; acc += dt; if (dt > worst) worst = dt
      if (acc >= 1000) {
        this._status(
          `level  ${Math.round(frames * 1000 / acc)} fps  worst ${worst.toFixed(0)} ms\n` +
          `${this._mapKey} | ready in ${this._readyMs} ms | ` +
          `${this._dolly ? 'dolly' : 'still'} | ${this._flora ? 'flora' : 'no flora'}`)
        frames = 0; acc = 0; worst = 0
      }
    }
  }
}

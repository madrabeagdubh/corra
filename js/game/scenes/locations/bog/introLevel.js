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
//   &bloom=1                 how full the meadow is: 0 = the old sparse scatter, 1 = a field
//                            in flower (default), up to 3 = as much as it will bear. Costs
//                            frames -- measure with &fps=1.
//   &lit=1                   no moon dimming: the land at full brightness from the start
//   &horizon=0.74            where the horizon sits (0.02 - 0.9). LOW = a low camera: more
//                            sky, the land compressed into the bottom of the screen
//   &across=6.5              tiles across the screen at the camera's feet (bigger = the world
//                            looks farther away and finer-grained)
//   &clip=0.15               how far ABOVE the horizon terrain may rise (fraction of screen
//                            height from the top); needs the renderer's CLIP_TOP_FRAC flag
//   &haze=0.6                strength of the depth-haze band at the horizon (0 = none)
//   &dark=0.42               the moon's dimming of the land (1 = undimmed). Colour knob.
//   &land=0.5                share of extra fullscreen height given to the land (rest stays
//                            sky). 1 = all of it, 0 = none. Lower means a lower horizon.
//   &fit=0                   don't hold the composition steady across a resize (compare the
//                            old behaviour, where fullscreen grew the figures but not the land)
//   &rock=0                  how much cliff stone: 0 = none (the default), 1 = as first built,
//                            2 = sparser. Scoped to this scene; the game's own levels are
//                            untouched.
//   &sat=0.78                how much hue survives the night grade (1 = untouched). Colour knob.
//   &glow=1.8                how much brighter the flowers are than the land (1 = same). [floraGlow]
//   &river=0                 no water drawn (the channel stays carved). [riverLayer]
//   &fade=0                  the renderer's own horizon fade, in px (default 60 in the game, 0
//                            here). See "THE SEE-THROUGH MOUNTAINS" below.
//   &panTiles=4               how far the ground pans (in tiles) when the intro turns to look at
//                            another part of the sky. 0 = the ground does not pan at all.
//   &map=valley              the V-shaped valley prototype: the moon rests in open sky in the
//                            notch between its walls. Generate it first with
//                            intro_hilltop_gen.py --shape valley
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
// THE VEIL (removed)
//   The veil that used to soften Chrome's fullscreen toast here is gone. That job now
//   belongs to js/game/ui/toastFog.js, owned by introModal.js.
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
import { RiverLayer } from '../../../effects/riverLayer.js'
import SteepFaceRenderer from '../../../effects/steepFaceRenderer.js'
import { wind } from '../../../effects/wind.js'
import { TiltShift } from '../../../effects/tiltShift.js'
import { NOCTURNE } from '../../../systems/nightPalette.js'

const TILE        = 48     // logical px per tile: the generated maps and the renderer both use it
// Per map: where the camera stands (col, PLAYER row: the renderer looks 14 rows beyond it), how far
// the optional dolly pulls it back, and the framing that suits the map.
const MAPS = {
  hilltop: { file: 'intro_hilltop', col: 48.0, row: 100, dollyRows: 5,  horizon: 0.75, across: 6.5, clip: 0.15, haze: 0.6, fade: 0,  panTiles: 4 },
  // The V-shaped valley (generator --shape valley). Its horizon is measured in PIXELS up from
  // the bottom, not as a fraction: the moon rests a fixed 120px up (introModal's
  // MOON_REST_FROM_BOTTOM), so a horizon 112px up sits just under the moon's ring at any
  // screen height and the moon always has sky behind it. `horizon` is only the first-frame
  // guess; _groundH() takes over from there. mistBreak: the bank lies low in the notch.
  valley:  { file: 'intro_valley',  col: 48.0, row: 100, dollyRows: 5,  horizon: 0.837, horizonFromBottom: 112, across: 6.5, clip: 0.15, haze: 0.45, fade: 0, panTiles: 1.5, mistBreak: 0.85, figureDepth: 12,
             // Heights here run to 20 tiles; shade over that range, and harder than the default,
             // so each hill has a lit face and a shadowed one rather than one flat colour.
             relief: { reliefRange: 9, reliefL: 15, slopeGain: 0.7, slopeL: 13 },
             // Flowers belong to the floor: full size there, fewer and smaller up the slopes,
             // gone by about this height (tiles).
             flowerHeight: 5,
             // Sharp on the figures, the far valley and the nearest flowers softened: the
             // miniature look. farTop keeps the blur off the stars. No haze of its own -- the
             // scene's mist does that job. followMax is high because the figures stand low.
             tiltShift: { focusHeight: 0.10, farTop: 0.55, farBlur: 3, nearBlur: 2.5,
                          farHold: 0.35, nearHold: 0.5, hazeAmount: 0, vignette: 0.2,
                          saturate: 1.05, followMin: 0.5, followMax: 0.97 } },
  plates:  { file: 'plates',        col: 24.5, row: 44.5, dollyRows: 12, horizon: 0.10, across: 3.8, clip: null, haze: 0,   fade: 60, panTiles: 0 },
}
// The depth-haze at the horizon, chosen in the graded (post-filter) space. Was '74,104,112', a
// flat slate grey that sat on the horizon like dirty glass; this is the same value swung toward
// the scene's green so the far air glows rather than dulls.
const HAZE_RGB   = '84,96,128'   // blue-slate night air (was a teal, '86,128,124', matched to the old green night)
// Where the figures' feet stand, as a fraction of the page height (measured from a real screenshot
// of their resting pose). The pan is sized so the ground AT THIS HEIGHT moves with them.
const FOLLOW      = 0.1    // the camera eases toward its target like the game's own follow does
// Where the figures' feet sit, up from the bottom of the screen. MUST match nightScape's
// LAYERS entries for druid and queen (foot: 12.4) -- it is their geometry, read from here only
// so the ground row under their feet can be found.
const FIGURE_FOOT_VH = 12.4
// Roughly where across the screen they stand (nightScape: druid left 56%, queen 63%) -- used
// only to look up the terrain height under them when a map pins them to a depth.
const FIGURE_X_FRAC = 0.595
// The clearing around the moon (see _moonFade). CLEAR_RING is its hard edge as a multiple of the
// moon widget's radius -- 1 is the widget's own outer edge, so nothing pokes out from under it;
// CLEAR_SOFT is how far beyond that the flowers take to come back, as a fraction of the ring.
const CLEAR_RING = 1.0
const CLEAR_SOFT = 0.6
// How far down the mountain range the mist's clear upper edge lies, as a share of the range's
// own height on screen (high peaks to lowest skyline). 0 = level with the peaks (they vanish
// into it), 1 = level with the lowest point (almost everything stands clear). Half: the upper
// half of the range breaks through a bank lying over its lower half.
const MIST_BREAK = 0.5
// The moon's dimming at a new moon. Was 0.30, which darkened a grade that had already darkened
// the land: the two multiplied out to a net gain of about R 0.09 / G 0.13 / B 0.19, so grass,
// rock and earth all landed within a few levels of each other and the land read as one flat
// blue-grey slab. Override live with ?dark=0.5 while tuning.
const DARK        = 0.42
const GRADED      = ['pgr-ground', 'steep-face-overlay', 'pgr-objects']
// The GROUND's night grade is a tone curve, not a straight multiply. A multiply shifts every
// tone the same way, so shadow, mid-tone and highlight all went teal together and the land
// read as one flat colour. Moonlit grass does not look like that: shadows fall to violet and
// indigo, mid-tones to blue-slate, and only lit surfaces keep a silvery sage green. So after a
// strong desaturation (the colour now comes from the curve, by brightness, not from the
// texture), each channel gets its own curve: red and blue held UP in the darks (violet), green
// held down there and rising fastest through the lights (sage). Values are before the moon's
// dimming. The flowers keep NIGHT's gentler grade below, so they stay colourful on it.
const GROUND_SAT  = 0.5    // keeps more of the grass's own green going into the curve (was 0.35)
const GROUND_TONE = {
  // Upper curve: less red and blue, so lit grass turns moonlit green rather than lavender;
  // lower curve keeps its blue, so shadows stay indigo and the relief keeps its depth.
  r: [0.07, 0.15, 0.26, 0.42, 0.54, 0.64],
  g: [0.03, 0.12, 0.34, 0.62, 0.78, 0.88],
  b: [0.17, 0.35, 0.50, 0.60, 0.66, 0.72],
}
const GROUND_LAYERS = ['pgr-ground', 'steep-face-overlay']
// The brightest the moon may make the land (1 = undimmed, daylight). See __introLevelBrightness.
const FULL_MOON_LAND = 0.7
// The moonlit grade. Night should drain colour, not all of it: at sat 0.55 with a steep blue
// bias the land had no hue left to be mystical WITH. Green now leads (it is the colour of the
// nebula, the ogham strokes and the stars, so the land belongs to the same night), blue still
// trails it for moonlight, and the small lift keeps the shadows as air rather than holes.
// Override live with ?sat=0.9.
const NIGHT       = { sat: 0.78, slope: [0.34, 0.52, 0.66], lift: [0.012, 0.030, 0.062] }
// [floraGlow] The flowers' own grade (pgr-objects holds nothing else in this scene). Much
// gentler than NIGHT: colour mostly kept, a cool silver lift so pale blooms catch the moon.
// Their brightness is the land's times FLORA_GLOW (capped at 1), so they still follow the
// moon but always sit above the grass. Override live with ?glow=.
const FLORA       = { sat: 0.92, slope: [0.72, 0.80, 0.90], lift: [0.030, 0.040, 0.065] }
const FLORA_GLOW  = 1.8
const FLORA_LAYER = 'pgr-objects'
// [foreFlowers] Close to the camera, beside the figures, only low flowers grow: tall ones
// there clutter the druid and the queen. Within FORE_D tiles, only FORE_LOW species; over the
// next FORE_BLEND tiles the rest return gradually; beyond that the meadow is untouched.
const FORE_D      = 6
const FORE_BLEND  = 4
const FORE_LOW    = ['noinin', 'crobhein', 'ceannbhan', 'airgead', 'odhrach']
// [moonGlow] The glow element's unscaled size in px; it is scaled to the moon every frame.
const GLOW_BOX    = 1000
// [nocturne] What is actually used: the shared warm palette (nightPalette.js), or with
// ?nocturne=0 this file's own previous values above.
const USE_GROUND_SAT  = NOCTURNE.on ? NOCTURNE.groundSat  : GROUND_SAT
const USE_GROUND_TONE = NOCTURNE.on ? NOCTURNE.groundTone : GROUND_TONE
const USE_FLORA       = NOCTURNE.on ? NOCTURNE.flora      : FLORA
const USE_HAZE        = NOCTURNE.on ? NOCTURNE.haze       : HAZE_RGB

export default class IntroLevelScene extends Phaser.Scene {
  // Read by SteepFaceRenderer through scene.constructor: stone only on slopes steeper than
  // 70% of this (0.84), so the mountains' upper faces are rock and the hilltop stays grass.
  // This is a static on THIS scene, and the renderer reads it per-scene, so changing it here
  // cannot affect the game's own levels (they use PerspectiveScene's 0.6, or the 0.6 fallback).
  // ?rock= rewrites it live: the number is the threshold multiplier, so ?rock=2 needs twice the
  // steepness before stone shows (much less rock), and ?rock=0 skips the stone pass entirely.
  static CLIMB_MAX_STEP = 1.2

  constructor() {
    super({ key: 'intro_level' })
    const q   = new URLSearchParams(window.location.search)
    const num = (k, d) => { const v = parseFloat(q.get(k)); return Number.isFinite(v) ? v : d }
    this._fpsOn   = q.get('fps') === '1'
    this._dolly   = q.get('dolly') === '1'
    this._flora   = q.get('flora') !== '0'
    // How full the meadow is. 0 = the sparse original scatter; 1 = a field in flower (the
    // default); up to 3 = as much as the renderer will bear. See _floraOpts().
    this._bloom   = Math.max(0, Math.min(3, num('bloom', 2)))
    // How much stone: 1 = as first built, higher = less rock, 0 = none at all. Defaults to 0:
    // the cliff-stone texture belongs on real cliff faces, and on this hill's rolling ridges it
    // just read as noise. ?rock=1 puts it back, ?rock=2 is a sparser version of it.
    this._rock    = Math.max(0, Math.min(8, num('rock', 0)))
    IntroLevelScene.CLIMB_MAX_STEP = 1.2 * (this._rock || 1)
    this._night   = q.has('night') ? Math.max(0, Math.min(1, num('night', 1))) : 1
    // Which map: the hilltop by default; ?map=plates (or any ?band=) picks the earlier test level.
    const band    = q.get('band')
    const bandOk  = ['far', 'mid', 'near'].includes(band)
    // The valley is the intro now; ?map=hilltop brings back the hill, ?map=plates the old test.
    this._mapKey  = (q.get('map') === 'plates' || bandOk) ? 'plates'
                  : (q.get('map') === 'hilltop') ? 'hilltop' : 'valley'
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
    this._lastSw = null; this._lastSh = null   // last frame's canvas size, to catch a resize
    // Hold the composition steady when the viewport changes shape -- see _fitAcross(). ?fit=0
    // to compare against the old behaviour.
    this._fit     = q.get('fit') !== '0'
    // Share of the extra fullscreen height given to the land (the rest stays sky). 1 put the
    // horizon so high that the moon sat among the tall near flowers; half is the settled value.
    this._landShare = Math.max(0, Math.min(1, num('land', 0.5)))
    this._baseSw  = null; this._baseSh = null  // the shape the composition was framed at
    this._acrossEff = null; this._horizonEff = null
    this._u       = 0                                          // the poem's progress, 0..1
    // Colour knobs, for tuning the night on a real screen instead of by argument: ?dark= is the
    // overall moon dimming, ?sat= how much hue survives the grade. ?lit=1 still bypasses both.
    this._brightness = q.get('lit') === '1' ? 1 : Math.max(0, Math.min(1, num('dark', DARK)))
    this._sat     = Math.max(0, Math.min(2, num('sat', NIGHT.sat)))
    this._glow    = Math.max(0, Math.min(4, num('glow', FLORA_GLOW)))   // [floraGlow]
    this._riverOn = q.get('river') !== '0'                             // [riverLayer]
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
    // Tilt-shift, the same DOM overlays the game's levels use. Made here, before the lift above
    // the stars (_raiseAboveStars), so its pgr-ts-* layers are lifted with the terrain.
    // ?tilt=0 turns it off.
    if (this._cfg.tiltShift && new URLSearchParams(location.search).get('tilt') !== '0') {
      this.tiltShift = new TiltShift(this, { pgr: this.perspectiveGround, ...this._cfg.tiltShift })
    }
    // Relief shading sized to this map's hills (see tintManager.getGroundTint).
    if (this._cfg.relief && this.perspectiveGround.tintManager) {
      Object.assign(this.perspectiveGround.tintManager, this._cfg.relief)
    }
    // [riverLayer] The river, if the map has one: drawn by the renderer's row loop (it finds
    // it as scene.riverLayer), its moon road centred on the moon _trackMoon() measures.
    this.riverLayer = (map.river && this._riverOn)
      ? new RiverLayer(map.river, { moonX: () => this._moonRoadX ?? this._moonClear?.x })   // [moonGlow]
      : null
    if (this._flora) {
      const river = this.riverLayer
      this.vegetation = new Vegetation(this, { pgr: this.perspectiveGround, ...this._floraOpts(),
        ...(river ? { isWater: (col, row) => river.isWaterTile(col, row) } : {}),
        allowAt: (key, col, row) => this._foreAllow(key, col, row) })   // [foreFlowers]
    }
    // ?rock=0 means no stone at all, so the renderer is never built (nothing to grade or update).
    this.steepFaces = this._rock ? new SteepFaceRenderer(this) : null   // made BEFORE the grade looks for layers

    this._applyNight()
    this._raiseAboveStars()
    this._addHaze()                                   // after the lift: it sets its own z-index
    this._addGlow()                                   // [nocturne] the moonlit air over the notch
    this._applyBrightness()

    // The intro's own clock drives this scene, through two hooks nightScape calls: the poem's
    // progress, and the moon's brightness.
    window.__introLevelProgress   = (u) => { this._u = Math.max(0, Math.min(1, u)) }
    // The moon brightens the land as it fills -- but only so far. nightScape sends up to 1.0 at
    // full moon, which is daylight: the grade's whole output, undimmed, and the valley washed out
    // to a pale lavender. Capped, the full moon still visibly lights the land and it stays night.
    window.__introLevelBrightness = (b) => {
      this._brightness = Math.min(b, FULL_MOON_LAND); this._applyBrightness()
    }
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
      this._fitAcross(sw, sh)
      const u  = this._dolly ? this._u : 0
      const tx = this._cfg.col * TILE - sw / 2
      const ty = (this._cfg.row + u * this._cfg.dollyRows) * TILE - sh / 2
      if (!this._camPlaced || resized) { this._baseX = tx; cam.scrollY = ty; this._camPlaced = true }
      else { this._baseX += (tx - this._baseX) * FOLLOW; cam.scrollY += (ty - cam.scrollY) * FOLLOW }
      // The pan is NOT eased: the figures it must match move on the intro's own tween, and any lag
      // here would show as the ground trailing behind the people standing on it.
      cam.scrollX = this._baseX + this._panCols() * TILE
      this._panFigures(sh)
      this._trackMoon()
      this.perspectiveGround.update()
      // The tilt-shift focuses on the player; the intro has none, so it is handed the figures'
      // measured centre instead (from _panFigures). The renderer clears playerScreenY at the
      // start of its own update when there is no player, so setting it here -- after that, just
      // before the tilt-shift reads it -- touches nothing else.
      if (this.tiltShift && this._figCentreY != null) {
        this.perspectiveGround.playerScreenY = this._figCentreY
        this.tiltShift.update(this.perspectiveGround)
      }
      this._drawFog(sw, sh)
      this._placeGlow()
      if (this._fpsTick) this._fpsTick()
    } catch (e) {
      console.error('[introLevel] failed; stopping the level so the intro carries on:', e)
      this._fail(e)
    }
  }

  // Hold the composition together when the viewport changes shape (entering fullscreen is the
  // one that matters: on a phone it adds height and no width).
  //
  // THE PROBLEM. This picture is drawn in two coordinate systems that only agree at the shape
  // it was framed in. Height-proportional: _horizonPx() = sh * horizonFrac, so the horizon,
  // groundH and every row's screen Y; the haze band (fractions of height); and the druid and
  // queen, who are sized and placed in vh by nightScape. Width-proportional: pixels per tile
  // is sw * zoom / TILES_ACROSS, and with it every sprite's size, the terrain's elevation
  // (drawn as height * scale) and how far back flora is worth drawing. Add 15% of height and
  // the figures grow 15% and the land band stretches 15% taller, while the hills stay exactly
  // as tall in pixels and the flowers stay exactly as big. Hence all of it at once: the
  // figures sitting oddly, the flowers covering less, and the hills no longer poking through a
  // haze band that just moved and grew.
  //
  // THE FIX. Put the ground on the same footing as everything else by making pixels per tile
  // track the land band's height rather than the screen's width. TILES_ACROSS is the only
  // lever needed: pxPerTile = sw / across, so holding pxPerTile / groundH constant means
  //     across = across0 * (sw / sw0) * (sh0 / sh)
  // (the horizon fraction is constant, so it cancels out of groundH). Fullscreen then
  // magnifies the land to match the figures, instead of leaving it behind.
  //
  // The baseline is simply the first frame's shape -- for the intro that is the windowed
  // viewport, which is what `across` was tuned against in the first place.
  // THE FIX, part two. The horizon is a FRACTION of height (0.75), so the land is always the
  // bottom quarter and extra fullscreen height is split in that same proportion -- three
  // quarters of it to sky, which is the part nobody was asking for more of. Measured on the
  // same device: fullscreen gave the land +60px and the sky +180px. Holding the SKY's pixel
  // height instead and giving the whole gain to the land is +240px of ground and no change
  // above the horizon: a 46% deeper field of flowers rather than 12%. The haze band is keyed
  // to the horizon, so it moves with it and keeps sitting on the skyline.
  _fitAcross(sw, sh) {
    if (!this._fit || !sw || !sh) return
    if (this._baseSw === null) { this._baseSw = sw; this._baseSh = sh }

    // Sky keeps most of its pixel height; _landShare of the gain goes to the land.
    const hz = Math.max(0.02, Math.min(0.9, 1 - this._groundH(sh) / sh))
    if (hz !== this._horizonEff) {
      this._horizonEff = hz
      PerspectiveGroundRenderer.HORIZON_Y_FRAC = hz
    }

    const across = Math.max(0.8, Math.min(12,
      this._across * (sw / this._baseSw) * (this._groundH(this._baseSh) / this._groundH(sh))))
    if (across === this._acrossEff) return
    this._acrossEff = across
    // No invalidation needed: the renderer reads this static and redraws every frame.
    PerspectiveGroundRenderer.TILES_ACROSS = across
  }

  // The land band in px: everything below the horizon. THE invariant for this scene -- terrain
  // relief (height * scale) has to stay in proportion to the band the rows are spread across,
  // or the hills sink relative to the horizon. Tying scale to screen height instead was my
  // earlier mistake: the band grew 61% (all the extra fullscreen height went to land) while
  // pixels-per-tile grew 15%, so the skyline dropped BELOW the horizon line and the haze,
  // which is centred on the horizon, ended up hanging in open sky above the mountains.
  _groundH(sh) {
    // A map that pins its horizon in px from the bottom (the valley) keeps that land band at
    // every screen height: the moon it is built around is pinned the same way.
    const hfb = this._cfg?.horizonFromBottom
    if (hfb) return Math.max(1, Math.min(sh * 0.98, hfb))
    const base = this._baseSh || sh
    const g0 = base * (1 - this._horizon)
    // How much of the extra viewport height the LAND takes; the rest stays sky. 1 = all of it
    // (the horizon climbs hard, which put the moon in among the tall near flowers), 0 = none
    // (land holds its pixel height). ?land= to tune.
    const land = Math.max(1, g0 + this._landShare * (sh - base))
    return Math.min(sh * 0.98, land)
  }

  // Walk the druid and queen with the ground they stand on. The terrain pans by _panCols()
  // tiles; on screen that is that many tiles times the scale AT THEIR OWN ROW -- a tile near
  // the camera covers far more pixels than one at the horizon, so the row matters. Their feet
  // sit FIGURE_FOOT_VH up from the bottom (nightScape's LAYERS foot: 12.4), which
  // _screenYToWorldRow turns into the row they are standing on.
  //
  // The camera's col rises by panCols, and _colToScreenX subtracts the camera col, so a fixed
  // point in the world travels LEFT by panCols * scale -- hence the minus.
  _panFigures(sh) {
    const fn = window.__introFigurePanPx
    if (!fn) return
    const pgr = this.perspectiveGround
    const footY = sh * (1 - FIGURE_FOOT_VH / 100)
    // Which ground the figures stand on. By default, whatever lies under their fixed screen
    // position -- right on the hilltop, where that is about 12 tiles out, consistent with their
    // size. But a map can pin them to a DEPTH instead (cfg.figureDepth, tiles from the camera).
    // The valley needs it: its land band is so foreshortened that their fixed screen position
    // lands on ground ~38 tiles away, so they panned with distant ground while the near floor
    // and flowers -- what the eye takes as their ground -- swept past four times faster, and
    // they looked like they were sliding. Pinned to the depth their size implies, their feet
    // are set on the actual terrain there each frame, and they move exactly as it does.
    const D = this._cfg.figureDepth
    let row, dy = 0
    if (D) {
      row = pgr._perspCamRow() - D
      const s0 = pgr._scaleAtRow(row)
      const sw = this.game.canvas.width
      // Their world column: fixed relative to the UNPANNED camera, so they travel with the land.
      const col = Math.round(this._cfg.col + (FIGURE_X_FRAC * sw - sw / 2) / (s0 || 1))
      const target = pgr._rowToScreenY(row) - (pgr._vertexH?.(col, Math.round(row)) ?? 0) * s0
      // nightScape positions them in CSS px; the renderer works in canvas px.
      const cv = this.game.canvas
      dy = (target - footY) * ((cv.clientHeight || cv.height) / cv.height)
    } else {
      row = pgr._screenYToWorldRow?.(footY)
    }
    // Pan with the ground at their ACTUAL feet, read from the page. The row above is where they
    // are MEANT to stand; measured on a recording, they were really standing on ground about 5
    // tiles out while panning as if at ~30, so they moved 40% as far as the grass at their feet.
    // Whatever the sprite's own layout does, the bottom of the druid's element is on screen where
    // it is, so the ground row there is the one to move with.
    const druid = this._druidEl?.isConnected ? this._druidEl
      : (this._druidEl = document.querySelector('[data-intro-figure="druid"]'))
    if (druid) {
      const cv = this.game.canvas
      const r = druid.getBoundingClientRect()
      const feet = r.bottom * (cv.height / (cv.clientHeight || cv.height))
      const seen = pgr._screenYToWorldRow?.(feet)
      if (Number.isFinite(seen)) row = seen
      this._figCentreY = (r.top + r.bottom) * 0.5 * (cv.height / (cv.clientHeight || cv.height))
    }
    const s = pgr._scaleAtRow(Number.isFinite(row) ? row : this._cfg.row + 1)
    // The figures are sized in vh, so they already grow with the viewport. The land now grows
    // with the LAND BAND, which is a different (larger) factor -- this is the remainder, so
    // the two end up the same size relative to each other at any viewport shape.
    let k = 1
    if (this._fit && this._baseSh) {
      k = (this._groundH(sh) / this._groundH(this._baseSh)) / (sh / this._baseSh)
    }
    // [figureSlide] s is canvas px per tile; the figures are placed in CSS px.
    const cvp = this.game.canvas
    const cssPerCanvas = (cvp.clientWidth || cvp.width) / cvp.width
    fn(-this._panCols() * (s || 0) * cssPerCanvas, k, dy)
  }

  // The moon rests low, below the horizon, so it is always seen against land -- and with a full
  // meadow that meant a thicket of stems crossing its edge. This keeps a soft clearing around
  // it: flowers whose footprint reaches inside the moon's ring are not drawn, and those just
  // outside it thin out gradually, so it reads as a clearing rather than a moon-shaped hole.
  //
  // The moon belongs to the intro scene, not this one, so it is found by the data-intro-moon
  // tag introModal puts on it, and its circle is re-read every frame: it drifts in and settles,
  // and the clearing follows it there. One getBoundingClientRect a frame; the test per plant is
  // a handful of arithmetic.
  _trackMoon() {
    if (!this._moonEl || !this._moonEl.isConnected) {
      this._moonEl = document.querySelector('[data-intro-moon]')
    }
    const el = this._moonEl
    if (!el) { this._moonClear = null; return }
    const r = el.getBoundingClientRect()
    if (!r.width) { this._moonClear = null; return }
    // Canvas px per CSS px: the renderer draws in the game canvas's own units.
    const cv = this.game.canvas
    const k = cv.width / (cv.clientWidth || window.innerWidth || cv.width)
    this._moonClear = {
      x: (r.left + r.width / 2) * k,
      y: (r.top + r.height / 2) * k,
      r: (Math.min(r.width, r.height) / 2) * k,
    }
  }

  // Alpha for a plant with this screen footprint: 0 inside the moon's ring, easing to 1 over
  // CLEAR_SOFT of its radius outside it. Distance is measured from the moon's centre to the
  // NEAREST point of the plant, so a tall stem is caught by its head, not just its foot.
  _moonFade(x, top, bottom, hw) {
    const m = this._moonClear
    if (!m) return 1
    const nx = Math.max(x - hw, Math.min(m.x, x + hw))
    const ny = Math.max(top, Math.min(m.y, bottom))
    const d = Math.hypot(nx - m.x, ny - m.y)
    const inner = m.r * CLEAR_RING, outer = inner * (1 + CLEAR_SOFT)
    if (d <= inner) return 0
    if (d >= outer) return 1
    const t = (d - inner) / (outer - inner)
    return t * t * (3 - 2 * t)
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
    if (this.tiltShift) { try { this.tiltShift.destroy() } catch (_) {} this.tiltShift = null }
    if (!keepReadout) { this._fpsEl?.remove(); this._fpsEl = null }
    this._fpsTick = null
    document.querySelectorAll('[id^="pgr-"], #steep-face-overlay').forEach(el => {
      if (!this._preExisting?.has(el)) el.remove()
    })
    if (this._nightSvg) { this._nightSvg.remove(); this._nightSvg = null }
    this._hazeEl = null
    this.riverLayer = null
    if (this._glowEl) { this._glowEl.remove(); this._glowEl = null }   // [nocturne]
    PerspectiveGroundRenderer.CLIP_TOP_FRAC = null    // never leak the flags into the game's own levels
    // _fitAcross() rewrites these per resize; put the map's own values back rather than
    // leaving whatever this viewport happened to need.
    PerspectiveGroundRenderer.TILES_ACROSS = this._across
    PerspectiveGroundRenderer.HORIZON_Y_FRAC = this._horizon
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

  // The moonlit grade: an SVG filter on the WORLD layers (saturation down, per-channel gain,
  // a small blue lift in the shadows). `night` (0..1) blends from "no change" to the full grade.
  _applyNight() {
    const t = this._night
    if (!t) return
    const lerp  = (v) => 1 + (v - 1) * t
    const sat   = lerp(this._sat)
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
      `</feComponentTransfer></filter>` +
      // The ground's own grade (see GROUND_TONE). Blended toward "no change" by t, like the rest.
      `<filter id="plates-night-ground" color-interpolation-filters="sRGB">` +
      `<feColorMatrix type="saturate" values="${lerp(USE_GROUND_SAT).toFixed(4)}"/>` +
      `<feComponentTransfer>` +
      ['r', 'g', 'b'].map(ch => {
        const tab = USE_GROUND_TONE[ch], n = tab.length - 1
        const vals = tab.map((v, i) => (i / n + (v - i / n) * t).toFixed(4)).join(' ')
        return `<feFunc${ch.toUpperCase()} type="table" tableValues="${vals}"/>`
      }).join('') +
      `</feComponentTransfer></filter>` +
      // [floraGlow] The flowers' grade. See FLORA.
      `<filter id="plates-night-flora" color-interpolation-filters="sRGB">` +
      `<feColorMatrix type="saturate" values="${lerp(USE_FLORA.sat).toFixed(4)}"/>` +
      `<feComponentTransfer>` +
      ['R', 'G', 'B'].map((ch, i) =>
        `<feFunc${ch} type="linear" slope="${lerp(USE_FLORA.slope[i]).toFixed(4)}" intercept="${(USE_FLORA.lift[i] * t).toFixed(4)}"/>`
      ).join('') +
      `</feComponentTransfer></filter>`
    document.body.appendChild(svg)
    this._nightSvg = svg          // held, so cleanup never depends on finding it again
  }

  // THE MIST. Replaces the old horizon-keyed haze band, which is gone.
  //
  // Why the old one never sat right: it was a full-width band centred on the HORIZON LINE. Since
  // the valley and the lowered horizon, the mountains no longer reach that line -- their crest
  // sits below it -- so the band hung in open sky above them. The attempts to re-anchor it
  // measured how far terrain rose ABOVE the horizon, which here is never; the measurement came
  // back zero and the band quietly fell back to the horizon line every time.
  //
  // This one never refers to the horizon. It finds the actual ridge line -- for every few pixels
  // across the screen, the highest point any terrain reaches -- and lays the mist along that
  // contour: a thin fade above the crest, densest just below it, thinning down over the far
  // slopes. So it follows the real peaks and passes, at any viewport shape, any seed, and as
  // the ground pans. Its depth is a share of the land band, so it scales with the terrain.
  //
  // Redrawn only when something that moves the ridge changes (viewport, camera, pan, fit);
  // on a still frame it costs nothing. ?haze= is its density, 0 turns it off.
  // [nocturne] [moonGlow] THE GLOW. The moon's light in the air around it, in the moon's own
  // colour (NOCTURNE.moon.light). One fixed element, above the stars (Phaser, z 10) and below
  // the land (pgr-*, z 18+), so the hills stand dark against it when the moon is low. Its
  // gradient is built once; following the moon is only a transform (translate + scale), so
  // it costs compositing and nothing else. _applyBrightness() sets its strength.
  _addGlow() {
    if (!NOCTURNE.on || this._glowEl) return
    const R = GLOW_BOX / 2
    const c = NOCTURNE.moon.light
    // A long, eased fall-off (roughly exponential), so there is no visible edge anywhere.
    const stops = [[0, 1], [5, 0.78], [12, 0.52], [22, 0.30], [35, 0.15], [50, 0.065],
                   [66, 0.024], [82, 0.007], [100, 0]]
      .map(([p, a]) => `rgba(${c},${a}) ${p}%`).join(',')
    const el = document.createElement('div')
    el.id = 'intro-moon-glow'
    el.style.cssText = `position:fixed;left:0;top:0;width:${GLOW_BOX}px;height:${GLOW_BOX}px;` +
      `pointer-events:none;z-index:16;opacity:0;transform-origin:${R}px ${R}px;` +
      `will-change:transform;background:radial-gradient(circle closest-side,${stops});`
    // [geeseInside] Inside #gameContainer (its own stacking context: see murmuration.js), so
    // z 16 really is above the stars (Phaser, 10) and below the geese (17) and the land (18+).
    ;(document.getElementById('gameContainer') || document.body).appendChild(el)
    this._glowEl = el
    this._glowKey = null
  }

  // Where the moon is on screen, in CSS px, whichever moon is showing: the moon widget once
  // it is up (the [data-intro-moon] tag), otherwise the ogham dial's moon (#ogd-corona, the
  // circle around it). null when neither is on screen.
  _moonOnScreen() {
    const w = this._moonEl?.isConnected ? this._moonEl : document.querySelector('[data-intro-moon]')
    let r = w?.getBoundingClientRect()
    if (!r?.width) {
      if (!this._dialMoonEl?.isConnected) this._dialMoonEl = document.getElementById('ogd-corona')
      r = this._dialMoonEl?.getBoundingClientRect()
    }
    if (!r?.width) return null
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.min(r.width, r.height) / 2 }
  }

  _placeGlow() {
    const m = this._moonOnScreen()
    // The moon road follows the same moon, in canvas px.
    const cv = this.game.canvas
    this._moonRoadX = m ? m.x * (cv.width / (cv.clientWidth || cv.width)) : null
    const el = this._glowEl
    if (!el || !m) return
    const R = GLOW_BOX / 2
    const s = (m.r * NOCTURNE.glow.radiusMoons) / R
    const key = `${m.x.toFixed(1)}|${m.y.toFixed(1)}|${s.toFixed(3)}`
    if (key === this._glowKey) return
    this._glowKey = key
    el.style.transform = `translate3d(${(m.x - R).toFixed(1)}px,${(m.y - R).toFixed(1)}px,0) scale(${s.toFixed(4)})`
  }

  _addHaze() {
    if (!this._haze) return
    const cv = document.createElement('canvas')
    cv.id = 'pgr-intro-fog'
    cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:23;'
    document.body.appendChild(cv)
    this._hazeEl = cv          // the name _applyBrightness() and _cleanup() already know
    this._fogKey = null
  }

  _drawFog(sw, sh) {
    const cv = this._hazeEl
    if (!cv || !this._haze || !this.mapData) return
    const P = PerspectiveGroundRenderer, cam = this.cameras.main
    const key = `${sw}x${sh}|${cam.scrollX.toFixed(1)}|${cam.scrollY.toFixed(1)}|${P.TILES_ACROSS}|${P.HORIZON_Y_FRAC}`
    if (key === this._fogKey) return
    this._fogKey = key
    if (cv.width !== sw || cv.height !== sh) { cv.width = sw; cv.height = sh }
    const ctx = cv.getContext('2d')
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, sw, sh)

    // 1. The ridge: per BIN-wide column of screen, the smallest y any terrain reaches.
    const pgr = this.perspectiveGround
    const BIN = 6, nb = Math.ceil(sw / BIN) + 1
    const crest = new Float32Array(nb).fill(Infinity)
    const W = this.mapData.width
    // Exactly the rows the renderer draws, no more: it stops at camRow - FL*8. Searching the
    // whole map found peaks that exist in the data but are never rendered, and put the mist's
    // top edge above the ridge you can actually see.
    const camRow = pgr._perspCamRow()
    const r0 = Math.max(0, Math.floor(camRow - P.FOCAL_LENGTH * 8))
    for (let r = r0; r < camRow; r++) {
      const y0 = pgr._rowToScreenY?.(r)
      if (y0 == null) continue
      const s = pgr._scaleAtRow(r)
      for (let c = 0; c <= W; c++) {
        const x = pgr._colToScreenX(c, r)
        if (!(x > -BIN && x < sw + BIN)) continue
        const y = y0 - (pgr._vertexH?.(c, r) ?? 0) * s
        const b = Math.round(x / BIN)
        if (b >= 0 && b < nb && y < crest[b]) crest[b] = y
      }
    }
    // Columns nothing landed in (the map's own edges) borrow their nearest neighbour.
    let last = Infinity
    for (let i = 0; i < nb; i++) { if (crest[i] < Infinity) last = crest[i]; else crest[i] = last }
    last = Infinity
    for (let i = nb - 1; i >= 0; i--) { if (crest[i] < Infinity) last = crest[i]; else crest[i] = last }
    if (!(crest[0] < Infinity)) return
    // Soften the line so the mist does not step with every tile edge.
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < nb - 1; i++) crest[i] = (crest[i - 1] + crest[i] * 2 + crest[i + 1]) / 4
    }
    // 2. The mist is FLAT. The ridge is only used to decide how high the bank lies: it hangs
    //    low across the whole view and the peaks break through it, rather than tracing their
    //    outline (the first version draped it along the contour, which read as a halo on every
    //    mountain). Percentiles, not the extremes, so one odd spike or the valley's notch does
    //    not drag the bank up or down.
    const ys = Array.from(crest).sort((a, b) => a - b)
    const pick = f => ys[Math.min(ys.length - 1, Math.max(0, Math.floor(f * (ys.length - 1))))]
    const peak = pick(0.10)          // the high peaks (smaller y is higher on screen)
    const base = pick(0.90)          // where the skyline sits lowest
    this._fogCrestTop = ys[0]
    const g = this._groundH(sh)
    const brk = this._cfg?.mistBreak ?? MIST_BREAK
    const yClear = peak + (base - peak) * brk          // above this, nothing: peaks stand clear
    const yDense = base + 0.04 * g                     // thickest just under the lowest skyline
    const yGone  = base + 0.45 * g                     // thinned out over the far slopes by here
    if (!(yGone > yClear)) return
    const grad = ctx.createLinearGradient(0, yClear, 0, yGone)
    grad.addColorStop(0, `rgba(${USE_HAZE},0)`)
    grad.addColorStop(Math.min(0.95, Math.max(0.05, (yDense - yClear) / (yGone - yClear))),
                      `rgba(${USE_HAZE},${this._haze})`)
    grad.addColorStop(1, `rgba(${USE_HAZE},0)`)
    ctx.fillStyle = grad
    ctx.fillRect(0, yClear, sw, yGone - yClear)
  }

  // The night grade, then the moon's dimming on top. Only reference the grade's filter if it
  // exists: a url() to nothing can void the whole filter list.
  _applyBrightness() {
    const b = `brightness(${this._brightness.toFixed(3)})`
    for (const id of GRADED) {
      const el = document.getElementById(id)
      if (!el) continue
      if (id === FLORA_LAYER) {    // [floraGlow]
        const fb = `brightness(${Math.min(1, this._brightness * this._glow).toFixed(3)})`
        el.style.filter = (this._night ? 'url(#plates-night-flora) ' : '') + fb
        continue
      }
      const grade = !this._night ? ''
        : GROUND_LAYERS.includes(id) ? 'url(#plates-night-ground) ' : 'url(#plates-night) '
      el.style.filter = grade + b
    }
    if (this._hazeEl) this._hazeEl.style.filter = `brightness(${this._brightness.toFixed(3)})`
    // [nocturne] The glow follows the moon: faint at new moon, full at the land's brightest.
    if (this._glowEl) {
      const G = NOCTURNE.glow
      const k = Math.max(0, Math.min(1, (this._brightness - DARK) / Math.max(0.01, FULL_MOON_LAND - DARK)))
      this._glowEl.style.opacity = (G.minAlpha + (G.alpha - G.minAlpha) * k).toFixed(3)
    }
  }

  // The hilltop's flora. ?bloom=0 is the original sparse scatter; the default is a field in
  // flower, and higher goes further. Three things held the old scatter back, and all three
  // have to give at once or it stays thin:
  //   1. a tile could hold at most ONE plant, whatever the density -- hence perTile.
  //   2. minScale 22 stopped plants well before the horizon, so the far field was bare grass.
  //   3. the habitat filter rejected any species whose `wet` missed the ground's wetness. The
  //      crown reads ~0.5 (flat ground, so height matches its neighbours), which happens to
  //      suit the flowering meadow species, and to exclude gorse, bog cotton and iris.
  //
  // Density alone made it repetitive rather than rich: four admitted species times three
  // silhouettes is not much to look at twelve deep. So the count is deliberately lower than
  // it could be, and the difference is spent on VARIETY instead -- the five upland meadow
  // flowers from MEADOW_SPECIES on top of the original seven, more baked silhouettes, and a
  // per-plant size scatter. It is a still night (wind: false), which bakes one sway phase
  // instead of twelve: that alone pays for the extra species and variants several times over.
  // [foreFlowers] Low flowers only near the camera (see FORE_D). Past FORE_D a tall plant's
  // chance of growing rises smoothly to 1 over FORE_BLEND tiles, decided per tile with a fixed
  // hash so nothing flickers as the view pans.
  _foreAllow(key, col, row) {
    if (FORE_LOW.includes(key)) return true
    const d = this.perspectiveGround._perspCamRow() - (row + 0.5)
    if (d >= FORE_D + FORE_BLEND) return true
    if (d <= FORE_D) return false
    const h = Math.sin(col * 12.9898 + row * 78.233) * 43758.5453
    return (h - Math.floor(h)) < (d - FORE_D) / FORE_BLEND
  }

  _floraOpts() {
    const b = this._bloom
    if (!b) return { density: 0.34, clumpBias: 0.55, minScale: 22, heightTiles: 0.9 }
    return {
      density: 1.0,               // with clumpBias low, effectively every tile rolls
      clumpBias: 0.12,            // few sparse blocks: clearings, not gaps
      perTile: Math.max(1, Math.round(b)),
      minScale: Math.max(9, 22 - 5 * b),    // flowers keep going toward the horizon
      fadeScale: Math.max(20, 46 - 10 * b),
      heightTiles: 0.95,
      wind: false,                // a still night -- and one baked phase instead of twelve
      // A soft clearing around the moon, so its edge is not crossed by stems. See _moonFade().
      fadeAt: (x, top, bottom, hw) => this._moonFade(x, top, bottom, hw),
      heightFade: this._cfg.flowerHeight ?? null,
      variants: 6,                // twice the silhouettes; affordable now the phases are gone
      scaleJitter: 0.35,          // no two plants quite the same height
      // The bog's own flora plus the upland meadow flowers. The crown's wetness admits most
      // of the meadow set and only the drier half of the bog set, which is the intent: a
      // hilltop in flower, with gorse and ragwort where the ground dries out.
      species: ['aiteann', 'ceannbhan', 'feileastram', 'creachtach', 'airgead', 'buachalan',
                'lusmor', 'mearacan', 'noinin', 'minscoth', 'crobhein', 'odhrach'],
      // A gentle meadow-damp field: two incommensurate waves so patches of one flower give
      // way to another, never a grid and never uniform.
      wetnessAt: (col, row) =>
        0.5 + 0.10 * Math.sin(col / 9.3 + row / 14.7) + 0.06 * Math.sin(col / 3.7 - row / 5.1),
    }
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
          `${this._dolly ? 'dolly' : 'still'} | ${this._flora ? 'flora' : 'no flora'}\n` +
          this._geomLine())
        frames = 0; acc = 0; worst = 0
      }
    }
  }

  // Where the horizon, the skyline and the haze band actually are, in screen px. The haze is
  // placed relative to the HORIZON, but what it needs to sit on is the SKYLINE -- the top of
  // the mountains, which is the horizon plus however many pixels the tallest terrain rises
  // above it, and that rise is a different function of the viewport. Comparing these numbers
  // windowed against fullscreen says whether the band needs re-keying to the skyline.
  _geomLine() {
    try {
      const pgr = this.perspectiveGround
      const sh  = this.game.canvas.height
      const hzF = this._horizonEff ?? this._horizon
      const hzPx = Math.round(sh * hzF)
      // Signed: negative means the ridge sits BELOW the horizon line -- the case that fooled
      // the old haze band, which only ever looked for terrain rising above it.
      const peak = Number.isFinite(this._fogCrestTop) ? hzPx - this._fogCrestTop : NaN
      const across = this._acrossEff ?? this._across
      const k = (this._fit && this._baseSh)
        ? (this._groundH(sh) / this._groundH(this._baseSh)) / (sh / this._baseSh) : 1
      return `sh ${sh} hz ${hzPx} (${hzF.toFixed(3)}) skyline ${peak >= 0 ? '+' : ''}${Math.round(peak)}px\n` +
             `land ${Math.round(this._groundH(sh))} across ${across.toFixed(2)} fig x${k.toFixed(2)}`
    } catch (e) { return 'geom: n/a' }
  }
}

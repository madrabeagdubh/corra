// skyeGairdin.js
// Location: js/game/scenes/locations/skye/skyeGairdin.js
//
// Uathach's ráth: a gentle ringfort (a ripple in the land, like Tara) with
// a gaming-board floor -- 13 x 13 stones inlaid in four colours around the
// lár, the centre stone. Imagined as the floor of a lost Gaelic footwork
// discipline, drilled like pieces on a fidchell board. A quiet place to
// practise movement in Irish for as long as you like; come back any time.
//
// KATA (public/data/skye/kata.js) run as a curriculum: stand on the lár
// and she calls the next one. Every kata starts there and is drawn on the
// shared board -- the stones light as you walk them, so finishing shows
// the figure. Calls grow from ar aghaidh / ar chlé to counts ("trí chéim")
// and compass words (ó thuaidh, soir...).
//
// SCAFFOLDING FADES PER PHRASE: each phrase's d-pad glow dims as the
// player follows it correctly (MASTERED_AFTER times = no glow).
//
// SOS: every second kata finished, she calls a break and talks about the
// discipline -- footwork, pattern, thought (skyeGairdin.dlg, sos_1..sos_3).
//
// COUNTING: for the first few multi-step calls she counts aloud ("a haon,
// a dó, a trí"), then stops -- by then, with luck, the player is counting.
//
// THE OMEN: some kata are constellations from the intro's night sky. One,
// "An Tonn", is Tethra's court. The first time it's completed its stars
// turn red (as the constellation is in the sky), wild geese are heard far
// off -- the same calls as when the druid tells the queen "ná caoin go
// fóil" -- she says "My mother never taught me that one", her next English
// line flickers "He is listening" before correcting itself, and the stars
// keep a dull red glow on later visits. Sets omen_tethra. Nothing is
// explained.
//
// Taps: none during a kata (the d-pad lesson); otherwise only once the
// loch has taught tap-to-move.

import SkyeScene, { SKYE_GID } from './skyeScene.js'
import { GameState } from '../../../systems/gameState.js'
import SkyeCaption from './skyeCaption.js'
import StepDrill from './stepDrill.js'
import LochStones from './lochStones.js'
import { figureBox } from './dustDash.js'
import StandingStones from './standingStones.js'
import { combineStructures } from './harbourWall.js'
import { playGeeseCall } from '../../../effects/murmuration.js'
import PerspectiveGroundRenderer from '../../../effects/perspectiveGroundRenderer.js'

const MASTERED_AFTER = 4     // correct follows of a phrase before its glow is gone
const SOS_EVERY = 2          // kata between breaks
const SOS_COUNT = 3          // chats written so far
const DIR_WORD = { F: 'forward', B: 'back', L: 'left', R: 'right' }
const PULSE_MS = 300
const COUNT_CALLS = 3        // multi-step calls she counts aloud, then stops
const COUNT = [['A haon.', 'One.'], ['A dó.', 'Two.'], ['A trí.', 'Three.'],
               ['A ceathair.', 'Four.'], ['A cúig.', 'Five.']]
// The reveal: when a constellation kata is finished the camera rises and
// pulls back over the lár until the whole board -- and the figure's stars --
// is in view, holds, then settles. Multipliers on the base PGR config at
// full crane (as on the old shore crane): focal flattens, across zooms out,
// the horizon lifts.
const CRANE = { focal: 1.8, across: 1.4, horizon: 0.5 }
const CRANE_RATE = 1.3
const REVEAL_MS = 5200
const REVEAL_SOUTH = 3       // look this many rows south of the lár, so the board sits mid-screen

const RED      = '#d8473a'   // Tethra's court, as in the sky
const RED_ECHO = '#7a3b35'   // ...and as it stays afterwards
const OMEN = {
  never:  { ga: 'Níor mhúin mo mháthair an ceann sin dom.', en: 'My mother never taught me that one.' },
  after:  { ga: 'Maith thú.', en: 'Well done.' },
  heard:  'He is listening.',
}

const LINES = {
  welcome: { ga: 'Seas sa lár, agus tosóimid.',
             en: 'Stand in the middle, and we\'ll begin.' },
  done:    [{ ga: 'Maith thú.', en: 'Well done.' },
            { ga: 'Go breá.', en: 'Grand.' },
            { ga: 'Sin é an chaoi.', en: 'That\'s the way.' }],
}

export class SkyeGairdin extends SkyeScene {
  constructor() { super({ key: 'skye_gairdin' }) }
  getMapKey() { return 'skye_gairdin' }

  async create(data) {
    await super.create(data)
    if (!this.player) return

    this._caption = new SkyeCaption({ scene: this, focusOn: () => this._speakerAt() })
    this._uathach = this._findFigure(SKYE_GID.UATHACH)
    this._lit = new Set()
    this._echo = new Set(GameState._state?.kataEcho || [])      // a figure that stays
    this._echoRed = GameState.hasNote('omen_tethra')
    this.perspectiveGround?.setStructures(combineStructures(
      new LochStones(this, this.mapData.stones, {
        water: false,
        isLit:  (x, y) => this._lit.has(`${x},${y}`),
        isEcho: (x, y) => this._echo.has(`${x},${y}`),
        colourAt: (x, y) => this._red?.has(`${x},${y}`) ? RED
                          : this._echoRed && this._echo.has(`${x},${y}`) ? RED_ECHO : null,
      }),
      new StandingStones(this, this.mapData.standingStones),
    ))
    this._ring = this.add.graphics().setScrollFactor(0).setDepth(15)
    this._phase = 'idle'

    try {
      // Exactly BogScene's content-loader form: a template-literal path.
      // A plain string gets pulled into Vite's dev module pipeline, which
      // refuses files in public/ ("should not be imported from source").
      const mod = await import(/* @vite-ignore */ `/data/${this.getContentDir()}/kata.js`)
      this._K = mod
    } catch (e) { console.error('[skye_gairdin] kata failed to load', e) }

    this.time.delayedCall(1200, () => this._say(LINES.welcome, 3500))
    this.events.once('shutdown', () => this._teardown())
  }

  // Wildflowers and gorse beyond the bank, grown on the ground canvas so the
  // bank hides what's behind it. The ráth itself is kept clear.
  getVegetation() {
    const from = this.mapData?.floraFrom
    if (!from) return false
    const c = this.mapData.lar
    return {
      species: ['mearacan', 'noinin', 'minscoth', 'crobhein', 'aiteanntor'],
      density: 0.4, perTile: 2, scaleJitter: 0.35, onGround: true,
      allowAt: (key, col, row) => Math.hypot(col - c[0], row - c[1]) >= from,
      isWater: () => false,
    }
  }

  // The crane lives here: PerspectiveScene eases the live horizon toward
  // this every frame (its terrain-avoidance pass), and _updateCrane writes
  // the statics it doesn't manage.
  getPGRConfig() {
    const b = super.getPGRConfig()
    const t = this._crane || 0
    if (!t) return b
    return {
      ...b,
      HORIZON_Y_FRAC: b.HORIZON_Y_FRAC * (1 - CRANE.horizon * t),
      FOCAL_LENGTH:   b.FOCAL_LENGTH   * (1 + CRANE.focal   * t),
      TILES_ACROSS:   b.TILES_ACROSS   * (1 + CRANE.across  * t),
    }
  }

  _updateCrane(delta) {
    const target = this._craneTarget || 0
    const cur = this._crane || 0
    if (Math.abs(target - cur) < 0.002) {
      if (cur === target) return
      this._crane = target
    } else {
      this._crane = cur + (target - cur) * Math.min(1, (delta / 1000) * CRANE_RATE)
    }
    const cfg = this.getPGRConfig()
    PerspectiveGroundRenderer.FOCAL_LENGTH = cfg.FOCAL_LENGTH
    PerspectiveGroundRenderer.TILES_ACROSS = cfg.TILES_ACROSS
    this.perspectiveGround?.forceRedraw?.()
  }

  // Rise over the lár for ms, then settle back onto the player.
  _reveal(ms) {
    this._craneTarget = 1
    this._lookAtLar = true
    this.time.delayedCall(ms, () => { this._craneTarget = 0; this._lookAtLar = false })
  }

  update(time, delta) {
    this._updateCrane(delta)
    super.update(time, delta)
    // the camera follows a proxy the base scene snaps to the player each
    // frame; during a reveal, point it at the lár instead
    if (this._lookAtLar && this._camProxy && this._K) {
      const ts = this.tileSize
      this._camProxy.setPosition((this._K.LAR[0] + 0.5) * ts, (this._K.LAR[1] + 0.5 + REVEAL_SOUTH) * ts)
    }
    if (!this.player || !this._caption) return
    const panelOpen = !!this._encounterPanel?._isOpen
    if (this._phase === 'kata' && !panelOpen) this._drill?.update()
    if (this._phase === 'idle' && !panelOpen && this._K) {
      const [tx, ty] = this._tile()
      const onLar = tx === this._K.LAR[0] && ty === this._K.LAR[1]
      if (onLar && !this._stillOnLar) this._startKata(this._nextKata())
      this._stillOnLar = onLar               // step off, and it can start again
    }
    this._drawRings(time)
  }

  _onTapBeforePath() {
    return this._phase !== 'kata' && GameState.hasNote('lesson_movement')
  }

  // ── kata ─────────────────────────────────────────────────────────────────
  // The curriculum: kata in order, then round again.
  _nextKata() {
    const st = GameState._state
    const i = st?.kataNext || 0
    return this._K.KATA[i % this._K.KATA.length]
  }

  _startKata(k) {
    this._phase = 'kata'
    this._stillOnLar = true
    const K = this._K
    const stars = k.stars ? new Set(k.stars.map(([dx, dy]) => `${K.LAR[0] + dx},${K.LAR[1] + dy}`)) : null
    this._lit = stars ? new Set() : new Set([K.LAR.join(',')])
    const mastery = this._mastery()
    let prev = null
    const steps = K.parseSteps(k).map((s, i) => {
      // "Arís" for a repeated call, every other time; otherwise one of the
      // token's wordings
      const opts = K.phrasesFor(s.token)
      const p = (s.token === prev && i % 2) ? K.AGAIN : opts[(i * 7 + k.id.length) % opts.length]
      prev = s.token
      const known = mastery[p.ga] || 0
      return { dir: DIR_WORD[s.move], count: s.count, ga: p.ga, en: p.en,
               glow: Math.max(0, 1 - known / MASTERED_AFTER) }
    })
    const champ = this.registry.get('selectedChampion') || window.selectedChampion
    this._drill = new StepDrill(this, {
      caption: this._caption, steps,
      female: champ?.pronouns?.ga?.subject === 'sí',
      onCorrect: (step, [x, y]) => {
        // a constellation lights only its stars; anything else, every stone
        if (!stars || stars.has(`${x},${y}`)) this._lit.add(`${x},${y}`)
        mastery[step.ga] = (mastery[step.ga] || 0) + 1
        this._countAloud(step)
        this.perspectiveGround?.forceRedraw?.()
      },
      onDone: () => this._kataDone(k, mastery),
    })
    this._drill.start({ ga: k.name.ga, en: k.name.en, holdMs: 1800 })
  }

  // "A haon, a dó, a trí" -- for the first few multi-step calls only.
  _countAloud(step) {
    const st = GameState._state
    if (!step.count || step.count < 2 || !st || (st.countedCalls || 0) >= COUNT_CALLS) return
    const n = (this._drill?._done ?? 0) + 1            // this step's number within the call
    const [ga, en] = COUNT[n - 1] || []
    if (ga) this._caption?.show(ga, en)
    if (n === step.count) st.countedCalls = (st.countedCalls || 0) + 1
  }

  _kataDone(k, mastery) {
    this._drill?.destroy()
    this._drill = null
    this._saveMastery(mastery)
    if (k.omen === 'tethra' && !GameState.hasNote('omen_tethra')) return this._omen(k)
    const st = GameState._state
    const done = st ? (st.kataDone = (st.kataDone || 0) + 1) : 1
    if (st) st.kataNext = (st.kataNext || 0) + 1
    GameState.save?.()
    const line = LINES.done[done % LINES.done.length]
    this._say(line, 2500)
    if (k.stars) this._reveal(REVEAL_MS)
    this.time.delayedCall(k.stars ? REVEAL_MS + 800 : 3500, () => { this._lit.clear(); this.perspectiveGround?.forceRedraw?.() })
    this._phase = 'idle'
    // a break every SOS_EVERY kata, while there are chats left to have
    const sos = done / SOS_EVERY
    if (Number.isInteger(sos) && sos <= SOS_COUNT) {
      GameState.addNote(`sos_${sos}`)
      this.time.delayedCall(2600, () => this._openChat())
    }
  }

  // ── the omen ──────────────────────────────────────────────────────────────
  _omen(k) {
    const st = GameState._state
    if (st) { st.kataDone = (st.kataDone || 0) + 1; st.kataNext = (st.kataNext || 0) + 1 }
    GameState.addNote('omen_tethra')
    // the figure stays, faintly, from now on
    const L = this._K.LAR
    const route = (k.stars || []).map(([dx, dy]) => `${L[0] + dx},${L[1] + dy}`)
    this._echo = new Set(route)
    if (st) st.kataEcho = route
    GameState.save?.()
    this._reveal(8200)
    this._phase = 'omen'
    // the stars go red, as they are in the sky; far off, the geese
    this._red = new Set(route)
    this.time.delayedCall(600, () => { this._lit.clear(); this.perspectiveGround?.forceRedraw?.() })
    playGeeseCall(this.sound?.context, { fadeInS: 3, peak: 1.3, totalMs: 14000 })
    this.time.delayedCall(1400, () => this._caption?.speak(OMEN.never.ga, OMEN.never.en, 3600))
    this.time.delayedCall(5600, () => {
      this._caption?.speak(OMEN.after.ga, OMEN.after.en, 3000)
      this.time.delayedCall(120, () => this._caption?.flickerEnglish(OMEN.heard, 450))
    })
    this.time.delayedCall(9000, () => {
      this._red = null
      this._echoRed = true                    // from now on the stars stay a dull red
      this.perspectiveGround?.forceRedraw?.()
      this._phase = 'idle'
    })
  }

  _openChat() {
    const panel = this._encounterPanel
    if (!panel || !this._uathach || panel._isOpen) return
    panel.notify({ id: 'fixed:uathach', visual: this._uathach.flag.visual }, this._uathach.zone)
    panel._openPanel()
  }

  // Per-champion phrase mastery, kept in the champion's GameState.
  _mastery() {
    const st = GameState._state
    return st ? (st.kataMastery = st.kataMastery || {}) : {}
  }
  _saveMastery() { GameState.save?.() }

  // ── a ring on the lár while nothing's running: "stand here" ────────────
  _drawRings(time) {
    const g = this._ring
    if (!g) return
    g.clear()
    if (this._phase !== 'idle' || !this._K) return
    const box = figureBox(this, this._K.LAR[0], this._K.LAR[1])
    if (!box) return
    const t = (Math.sin(time / PULSE_MS) + 1) / 2
    g.lineStyle(Math.max(2, box.w * 0.05), 0xf5d060, 0.35 + 0.4 * t)
    g.strokeEllipse(box.x, box.y - box.w * 0.08, box.w * 0.95, box.w * 0.34)
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  _say(line, ms) { this._caption?.speak(line.ga, line.en, ms) }     // all spoken moments here

  // Where Uathach is standing, for the caption's focus -- or null.
  _speakerAt() {
    const f = this._uathach?.flag
    return f && !f.hidden ? [f.tileX, f.tileY] : null
  }

  _tile() {
    const ts = this.tileSize
    return [Math.floor(this.player.logicalX / ts), Math.floor(this.player.logicalY / ts)]
  }

  _findFigure(gid) {
    const flag = this.perspectiveGround?._encounterFlags?.find(f => f.visual?.gid === gid)
    if (!flag) return null
    const ts = this.tileSize
    const zone = this.interactables?.find(z =>
      z.getData('type') === 'fixed_encounter' &&
      Math.floor((z.getData('logicalX') ?? z.x) / ts) === flag.tileX &&
      Math.floor((z.getData('logicalY') ?? z.y) / ts) === flag.tileY)
    if (!zone) return null
    return { flag, zone }
  }

  _teardown() {
    // the camera statics are class-wide and outlive the scene
    this._crane = 0; this._craneTarget = 0
    const cfg = this.getPGRConfig()
    PerspectiveGroundRenderer.FOCAL_LENGTH = cfg.FOCAL_LENGTH
    PerspectiveGroundRenderer.TILES_ACROSS = cfg.TILES_ACROSS
    PerspectiveGroundRenderer.HORIZON_Y_FRAC = cfg.HORIZON_Y_FRAC
    this._drill?.destroy()
    this._drill = null
    this._ring?.destroy()
    this._ring = null
    this._caption?.destroy()
    this._caption = null
  }
}

// faicheCourse.js
// Location: js/game/scenes/locations/skye/faicheCourse.js
//
// The crash course: Conall, alone with you in the garden (skyeGairdin.js: the
// ráth, with its board of stones), one lesson after another. When it is done
// the notes the green waits for are set, so the green meets you with the
// class in session (Uathach on the dais) and then the tournament.
//
// THE WORDS are all in tools/dialogue/drafts/faicheCourse.dlg (compiled into
// courseLines.js; see courseScript.js). This file is the LOGIC: it runs the
// lessons in ORDER, each one asking for something and watching for it. Conall
// says only what the draft gives him; plain instructions are the narrator's
// (the *Hint slots, grey). A slot left out of the draft is simply not said.
//
//   meet      "art thou ready?" -- "I am" (to the mark, how to stand) or "not yet"
//             (free to wander; he asks again when you come back to him)
//   space     bare-handed, on the d-pad: step off the red tile; then shove him till he kneels
//   sword     he throws you a practice sword: draw, sheathe, draw, sheathe, draw -- he
//             has something to say about every one (the salute is held back meanwhile)
//   calls     the salute, talked through with the blade out; then three of them
//   fatigue   he stands in as a target and turns everything aside till you're winded;
//             "Stop." -- and what it was for
//   strong    gather a strong blow, hold it, let it go (too soon is only a cut)
//   dummy     still standing in: what would have landed counts
//   feet      cut him as you pass, on the move
//   drag      only now, drawing a line to walk: he draws one and walks it; then you
//   duel      a bout: draw a line at him, time slows as you near him -- land a blow in
//             that slow, and he is done with you
//   end       the green is open: join the others across the loch
//
// Lesson ends are plain cards (no buttons) unless the draft gives them buttons
// (_wrapUp: courseScript `after`).
//
// Progress is kept in notes (faiche_course_<id>; tap uses lesson_movement), so
// coming back picks up at the first lesson not yet done.
//
// VOICE: Conall's Irish is spoken aloud only for calls the player must act on
// (_call: a step, a draw, a cut). His longer speeches are musical dialogue --
// the harp card (_converse / _speech) -- with the d-pad put away and the camera
// racked onto him; short asides are silent captions.
//
// The duel is a real bout with a safety net: lose it and you mend with your
// blade away (a heart every 1.2 s) and go again; a stalled lesson gets a plain
// hint, and a lesson that goes on too long is let go (courseScript
// HINT_AFTER_MS, GIVE_UP_MS).

import { GameState } from '../../../systems/gameState.js'
import { SoundBoard } from '../../../systems/soundBoard.js'
import { VoiceSynth } from '../../../systems/voice/voiceSynth.js'
import { PRESETS } from '../../../combat/melee.js'
import { prepareSword, SWORD_ID } from '../../../combat/meleeBout.js'
import { figureAt } from '../../../combat/figureSword.js'
import { SALUTE_MS, DRAW_MS } from '../../../combat/meleeView.js'
import { DialogueHarp } from '../../../systems/music/dialogueHarp.js'
import { Bodhran } from '../../../systems/music/bodhran.js'
import SkyeCaption from './skyeCaption.js'
import { SKYE_GID } from './skyeScene.js'
import { figureBox } from './dustDash.js'
import { DUMMY_DONE, FOOT_DONE, SPAR_DONE } from './faicheLesson.js'
import { SCRIPT, SALUTES, HINT_AFTER_MS, GIVE_UP_MS } from './courseScript.js'
import { INK } from '../../../ui/speakers.js'

// the host scene (skyeGairdin.js) provides: _caption, _melee (Conall's bout),
// _routeDraw, player, tileSize, and
//   courseMarker(tile|null)   a pulsing ring on a tile
//   courseLit(tile)           light a stone of the board (null clears them all)
const VOICE = ['ronnie', 'Ador']
const WARDEN_COLOR = INK.conall, HINT_COLOR = INK.narrator     // the same colours as his cards (ui/speakers.js)

export const WARDEN_NAME = 'Conall'
export const MET = 'faiche_course_met'
export const DIRS_DONE = 'faiche_course_dirs'
export const TAP_DONE = 'lesson_movement'
export const COURSE_DONE = 'faiche_kata_done'      // the whole course (the green waits for it)

export const ORDER = ['meet', 'space', 'sword', 'calls', 'fatigue', 'strong', 'dummy', 'feet', 'drag', 'duel', 'end']
const NOTE = { meet: MET, dirs: DIRS_DONE, tap: TAP_DONE }
const noteOf = id => NOTE[id] || `faiche_course_${id}`

const START = [18, 18]                     // the lár, the board's centre stone
export const LEDGE_AT = [18, 7]            // where he waits: the ledge built into the earthen ring
export const FIGHT_AT = [16, 18]           // where he stands to teach, and fights: two tiles west of the mark, facing you
// lessons that start with you on the mark: if you have wandered, you are walked back
const HOME_LESSONS = new Set(['space', 'sword', 'calls', 'duel'])   // (the target lessons start where you are: by him)
const MEET_RANGE = 6                       // or this near the lár, whatever the camera shows
const ASK_AGAIN_NEAR = 2, ASK_AGAIN_AWAY = 5   // "not yet": he asks again once you have been this far off, and come back this near
const STAND_IN = new Set(['fatigue', 'strong', 'dummy', 'feet'])   // lessons he stands in as a target for
const DRAWS = 3                             // the sword lesson: draw, (sheathe, draw) x2
const NEAR_FIGHT = 4                       // a bout starts within 5 tiles of him

// the line he draws, and walks (waypoints; the tiles between are filled in)
const DEMO_FROM = [18, 12]
// a wandering path (not a loop) that ends on the tile he teaches from next (FIGHT_AT), so he walks it and is there
const DEMO_PTS = [[18, 12], [21, 12], [21, 15], [18, 15], [15, 14], [14, 17], [16, 18]]   // all within four columns of the lár: on screen
const DODGES = 3, SHOVES = 3                // the space lesson: steps off the red tile, shoves back
const DRAW_STEP_MS = 120                   // the line grows a tile this often

// the dummy: Conall stands in for it (see _standIn)
const DUMMY_AT = [18, 15]                  // where he takes its place
const DUMMY_GOAL = 12, PTS = { cut: 2, strong: 6, shove: 3 }, PASSES = 2

// the gentle duel: a novice, slowed right down, who goes down in three blows
// three rounds against Conall: quicker and a little stronger each time
const DUEL_ROUNDS = [
  { ...PRESETS.conall, atk: 5, def: 8,  mobile: 1, windMs: 1000, recoverMs: 1100, restMin: 1200, restMax: 1900 },
  { ...PRESETS.conall, atk: 6, def: 9,  mobile: 2, windMs: 850,  recoverMs: 950,  restMin: 900,  restMax: 1500 },
  { ...PRESETS.conall, atk: 7, def: 10, mobile: 3, windMs: 700,  recoverMs: 800,  restMin: 600,  restMax: 1100 },
]
const DUEL_GIVE_UP_MS = 420000
const REMATCH_STAGE = 2                    // 'more practice' starts at his hardest

// what he says when the lessons are done and you talk to him (the dialogue panel's format; `event` is handed to onTalkEvent)
const CONALL_TALK = [
  { hold: true, ga: 'An mian leat tuilleadh cleachta?', en: 'Would you like more practice?',
    options: [
      { ga: 'Is mian.', en: 'Yes.', replyGa: 'Ar aire, mar sin.', replyEn: 'On guard, then.', last: true, event: 'rematch' },
      { ga: 'Níl, go raibh maith agat.', en: 'No, thank you.', replyGa: 'Ar aghaidh leat mar sin. Beir bua.', replyEn: 'Off you go, then. Victory be with you.', last: true },
    ] },
]

const same = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1]
const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]))
const asList = x => (Array.isArray(x) ? x : [x])
// king-move tiles through a list of waypoints (as a finger would draw them)
const expand = pts => {
  const out = [[...pts[0]]]
  for (let i = 1; i < pts.length; i++) {
    let [c, r] = out[out.length - 1]
    const [tc, tr] = pts[i]
    while (c !== tc || r !== tr) { c += Math.sign(tc - c); r += Math.sign(tr - r); out.push([c, r]) }
  }
  return out
}
const DEMO_LINE = expand(DEMO_PTS)

export default class FaicheCourse {
  constructor(scene, opts = {}) {
    this.scene = scene
    this.practice = !!opts.practice          // the lessons are done: he only offers more practice
    this.t = 0
    this.queue = []
    this.finished = false
    this.id = null            // the lesson now running
    this.drill = null
    this.goal = null
    this.tapped = false
    this.tapsDone = 0
    this.throwFx = null
    this.demo = null          // the line he draws: { shown, idx }
    this.dragStage = null
    this.speaking = false     // a musical dialogue is up
    this.dragUnlocked = false
    this.asDummy = false      // he stands where the dummy would, and parries
    this.squareUp = false     // you face him, he on your left (the sword and the calls)
    this.homing = null        // being walked back to the mark: { then, t0 }
    this.m.returnsSalute = true   // he returns your salute, in the lessons as in a bout
    this.standing = null      // walking to that place: { t0, then }
    this.dummyMode = null     // 'score' | 'pass' while it is there to be hit
    this.points = 0
    this.floats = []
    GameState.addNote(TAP_DONE)   // the tap lesson is gone: tap-to-move counts as known (skyeCladach waits on this note)
    if (this.practice) { this._talkMode(); return }
    this._wrapSetPath()
    this._wrapDrag()
    this._skipTo()
    this._next()
  }

  /** the lessons are over: he can be talked to, and will spar again if you ask */
  _talkMode() {
    this.practice = true
    this.id = 'talk'; this.goal = null
    this.m.HOME = [...LEDGE_AT]
    try { const z = this._conallZone(); z?.setData('dialogues', CONALL_TALK); z?.setData('radius', this.scene.tileSize * 1.8) } catch (_) {}
  }
  /** the zone the moon looks for. The map has none for him (the bout draws him), so one is made here; it goes where he goes. */
  _conallZone() {
    if (this._zone) return this._zone
    const sc = this.scene, ts = sc.tileSize, f = this.m.foe
    const x = f.c * ts + ts / 2, y = f.r * ts + ts / 2
    const z = sc.add.zone(x, y, ts, ts)
    z.setData('id', 'conall_talk'); z.setData('type', 'fixed_encounter'); z.setData('stateKey', 'skye_gairdin.conall_talk')
    z.setData('flagVisual', { gid: SKYE_GID.WARDEN, flat: false }); z.setData('visual', { gid: SKYE_GID.WARDEN, flat: false })
    z.setData('radius', ts * 1.8); z.setData('dialogues', CONALL_TALK); z.setData('actions', [])
    z.setData('logicalX', x); z.setData('logicalY', y)
    sc.interactables?.push(z)
    return (this._zone = z)
  }
  /** he can be talked to when nothing is going on: the zone is where he stands, and is put away (far off) while he is busy */
  _zoneTick() {
    if (!this.practice) return
    const z = this._conallZone(), f = this.m.foe, m = this.m
    const talk = this.id === 'talk' && !m.enGarde && !m.combat && !m.bout.over && !this.speaking && f.state === 'idle'
    const ts = this.scene.tileSize, c = talk ? f.c : -30, r = talk ? f.r : -30
    if (this._zc === c && this._zr === r) return
    this._zc = c; this._zr = r
    const px = c * ts + ts / 2, py = r * ts + ts / 2
    z.x = px; z.y = py; z.setData('logicalX', px); z.setData('logicalY', py)
  }
  onTalkEvent(ev) {
    if (ev !== 'rematch' || this.id !== 'talk') return
    this.id = 'duel'
    this._duel(true)
  }

  get m() { return this.scene._melee.melee }

  /** testing: ?course=<lesson> in the address starts there (earlier lessons done, this one and later reset) */
  _skipTo() {
    let id = null
    try { id = new URLSearchParams(window.location.search).get('course') } catch (_) {}
    const at = ORDER.indexOf(id)
    if (!id || at < 0) return
    ORDER.forEach((l, i) => {
      if (l === 'end') return
      if (i < at) GameState.addNote(noteOf(l)); else GameState.removeNote(noteOf(l))
    })
    if (at > ORDER.indexOf('sword')) this._giveSword()
  }

  /** Tap-to-move works from the tap lesson on (or if it was learned before). */
  tapsOn() { return GameState.hasNote(TAP_DONE) || this.id === 'tap' }
  /** Drawing a route works from the drag lesson on. */
  dragsOn() { return this.dragUnlocked || GameState.hasNote(noteOf('drag')) }

  // ── plumbing ─────────────────────────────────────────────────────────────
  _later(ms, fn) { this.queue.push({ at: this.t + ms, fn }) }
  _say(line, ms, color = WARDEN_COLOR, voiced = false) {
    if (this.speaking) return                                 // a card is up: no caption over it (it would sit on top of his words)
    const cap = this.scene._caption
    if (Array.isArray(line)) {                                // a slot: several lines run one after another
      if (line.length > 1) return this._seq(line, null, 350, color, voiced)
      line = line[0]
    }
    if (!cap || !line) return
    cap.setColor(color)
    cap.show(line.ga, line.en, ms ?? line.ms ?? SkyeCaption.holdFor(line.en))
    if (!voiced || line.ga === line.en) return                // English-only placeholders aren't voiced
    try {
      this._voice = this._voice || (() => { const ac = SoundBoard.ctx(this.scene); return ac ? new VoiceSynth({ audioContext: ac, volume: 0.55 }) : null })()
      this._voice?.stop(); this._voice?.speak(line.ga, { voice: VOICE[0], tuneKey: VOICE[1] })
    } catch (_) {}
  }
  /** a call the player must act on: spoken aloud in Irish */
  _call(line, ms) { this._say(line, ms, WARDEN_COLOR, true) }
  /** the narrator: a plain instruction, grey */
  _hint(line, ms) { this._say(line, ms ?? Math.max(4200, this._holdOf(line)), HINT_COLOR, false) }
  /** how long a line (or a slot) stays up; 0 for a slot that isn't there */
  _holdOf(line) {
    if (Array.isArray(line)) return line.length > 1 ? this._lengthOf(line) - 350 : this._holdOf(line[0])
    return line ? (line.ms ?? SkyeCaption.holdFor(line.en)) : 0
  }
  _lengthOf(lines) { return asList(lines).filter(Boolean).reduce((a, l) => a + this._holdOf(l) + 350, 0) }

  /** Say a list of lines one after another, then go on. Returns the time it takes. */
  _seq(lines, then, gap = 350, color, voiced) {
    let at = 0
    for (const line of asList(lines).filter(Boolean)) {
      const l = line, when = at
      this._later(when, () => this._say(l, undefined, color, voiced))
      at += this._holdOf(l) + gap
    }
    if (then) this._later(at, then)
    return at
  }

  _mark(tile) { this.scene.courseMarker?.(tile) }
  _tile() {
    const p = this.scene.player, ts = this.scene.tileSize
    return [Math.floor(p.logicalX / ts), Math.floor(p.logicalY / ts)]
  }
  _onTile(p) { return same(this._tile(), p) && !this.scene.player.isMoving }
  _heal() { const p = this.scene.player; if (p && p.currentHP < p.maxHP) p.heal?.(p.maxHP - p.currentHP) }
  _foeAt(p) { const f = this.m.foe; return f.c === p[0] && f.r === p[1] && !f.from }

  // a tapped route goes through player.setPath; remember that one was used
  _wrapSetPath() {
    const p = this.scene.player
    if (!p || p._courseWrapped) return
    const orig = p.setPath.bind(p)
    p._courseOrigSetPath = orig
    p._courseWrapped = true
    p.setPath = (steps) => {
      if (this.speaking) return                 // a touch that scrolls his words is not a step
      // a step drill's walk-back is a route too: only count taps
      if (steps?.length && this.id === 'tap' && !this.drill) this.tapped = true
      return orig(steps)
    }
  }

  // a drawn route: ignored until the drag lesson; counted in it
  _wrapDrag() {
    const rd = this.scene._routeDraw
    if (!rd || rd._courseWrapped) return
    const orig = rd._commit.bind(rd)
    rd._courseOrigCommit = orig
    rd._courseWrapped = true
    rd._commit = (list) => {
      if (!this.dragsOn() || this.speaking) return
      orig(list)
      if (this.id === 'drag' && this.dragStage === 'you' && list.length >= 3) this._goalAdd(1)
    }
    // before it is your turn a drag does nothing at all: no line, no walk, and
    // not a tap where the finger lifts
    const move = rd.move.bind(rd), end = rd.end.bind(rd)
    rd._courseOrigMove = move; rd._courseOrigEnd = end
    rd.move = (x, y) => {
      if (this.dragsOn() && !this.speaking) return move(x, y)
      if (rd.p0 && Math.hypot(x - rd.p0.x, y - rd.p0.y) >= 14) rd._swallow = true
    }
    rd.end = (cancelled) => {
      if (rd._swallow) { rd._swallow = false; rd.p0 = null; rd.trail = null; return true }
      return end(cancelled)
    }
  }

  // the caption as Conall's, for StepDrill
  _drillCaption() {
    return { show: (ga, en, ms) => this._say({ ga, en }, ms ?? 2200, WARDEN_COLOR, true) }
  }

  // ── musical dialogue: a long speech as the harp card ─────────────────────
  // The d-pad goes away (as in any conversation), the camera closes in on him
  // and the world blurs round him (tilt-shift), and the reader plays the tune
  // as they scroll. `then` runs when it is dismissed.
  _speech(lines, then, opts) { this._converse({ say: lines }, () => then?.(), opts) }

  // ── a conversation: his card, and your buttons ───────────────────────────
  // node: { say: [lines], ask: [O(...)] } (courseScript). A button with `next`
  // shows your words above his reply on the next card (which may ask again);
  // the cards are one conversation, chrome and harp kept between them.
  // then(value) when it ends: the value of the last button pressed (a card
  // with buttons that is swiped away counts as its first button).
  // opts.keepBlade: a drawn blade stays drawn through the card (the stamina circle steps aside for the moon meanwhile)
  _converse(node, then, opts = {}) {
    const sc = this.scene, tp = sc.textPanel
    if (Array.isArray(node) || !node) node = { say: node || [] }
    if (!node.say?.length && !node.ask?.length) { then?.(null); return }    // nothing written for it: go straight on
    if (!tp) return this._seq(node.say || [], () => then?.(node.ask?.[0]?.value ?? null))
    const card = sc.conallCard?.() || {}
    let hero = null
    try { hero = sc._encounterPanel?._resolveHeroGraphicKey?.() ?? null } catch (_) {}
    try { sc.joystick?.reset(); sc.player.isMoving = false; sc.joystick?.hideDirections?.() } catch (_) {}
    try { DialogueHarp.open(sc.registry?.get('selectedChampion') || window.selectedChampion || null, sc, card.portrait || 'conall') } catch (_) {}
    if (this.m.enGarde && !opts.keepBlade) { if (this.m.bare) this._bare(false); else this.m.setEnGarde(false) }   // blade away: the moon is for the English now
    sc._keepBladeInTalk = !!opts.keepBlade          // (the scene sheathes it for any words on screen, otherwise)
    // a caption still up (a word over the action): let it fade before the card comes, so the two never overlay
    const cap = sc._caption, wait = cap?.visible ? 320 : 0
    if (wait) cap.hide()
    tp.setSpeakerInk?.(INK.conall)
    this.speaking = true
    let value = null, ended = false
    // released: the last card closed the conversation itself (a plain dismiss);
    // otherwise (a button with nothing after it) the kept chrome is let go here
    const end = released => {
      if (ended) return
      ended = true
      if (!released) {
        try { DialogueHarp.cadence(); DialogueHarp.endConversation() } catch (_) {}
        try { tp.releaseChrome?.() } catch (_) {}
      }
      this.speaking = false
      sc._keepBladeInTalk = false
      tp.setSpeakerInk?.(null)
      try { sc.joystick?.showDirections?.() } catch (_) {}
      then?.(value)
    }
    // The next card goes up from this one's onDismiss, which textPanel calls once
    // the fade is over. (Not on a timer: hide() reads onDismiss when the fade
    // ENDS, so a card shown before then is torn down by it, on a slow frame.)
    const irishOf = l => (l && l.ga && l.ga !== l.en ? l.ga : '')     // English-only placeholders aren't shown as Irish
    const show = (n, said) => {
      const lines = asList(n.say || [])
      const ask = n.ask?.length ? n.ask : null
      let picked = null
      tp.show({
        irish: lines.map(irishOf).filter(Boolean).join('\n\n'),
        english: lines.map(l => l.en).join('\n\n'),
        heroGa: said ? irishOf(said) : '', heroEn: said ? said.en : '', heroGraphicKey: said ? hero : null,
        type: 'encounter_card', bgKey: card.bgKey ?? null, graphicKey: card.graphicKey ?? null,
        keepChromeOnHide: !!ask,           // a card with buttons hands on; the last card closes the conversation
        options: ask ? ask.map(o => ({ ga: o.ga, en: o.en })) : null,
        onChoice: i => {                     // the button's tap starts this card's fade; onDismiss follows it
          picked = ask[i]
          value = picked.value
          try { Bodhran.choose(DialogueHarp.unitMs()) } catch (_) {}
        },
        onDismiss: () => {
          if (picked) return picked.next ? show(picked.next, picked.speak || picked) : end(false)
          if (ask) { value = ask[0].value; end(false) } else end(true)
        },
      })
    }
    const begin = () => {
      show(node, null)
      // rack the focus onto him
      try {
        const m = this.m, box = figureBox(sc, m.foe.c, m.foe.r), pgr = sc.perspectiveGround
        if (box && pgr?._sh) sc.tiltShift?.setDialogueMode(true, (box.y - box.h * 0.5) / pgr._sh)
      } catch (_) {}
    }
    if (wait) sc.time.delayedCall(wait, begin); else begin()
  }

  /** The end of a lesson: his last word, and your answer. 'again' runs the lesson once more. */
  _wrapUp(id, node = SCRIPT[id]?.after) {
    if (this.practice || !node) return this._finish(id, 200)
    GameState.addNote(noteOf(id))             // done, even if you leave before answering
    this._converse(node, v => {
      if (v !== 'again') return this._finish(id, 200)
      GameState.removeNote(noteOf(id))
      this.repeating = id
      this._say(SCRIPT.generic?.again)
      this._later(900, () => this._next())
    })
  }

  // ── goals: "do this", watched through the bout's events ─────────────────
  //   on(name, d) -> true (or a number) to count it     need  how many
  //   hint        a plain instruction if you stall      done()  when met
  //   tick()      each frame (optional)    other(name, d)  any other event
  _goal(g) {
    // listening starts now, while he is still talking: hints only after he has finished (g.after)
    this.goal = { need: 1, n: 0, ...g, t0: this.t, hintAt: this.t + (g.after || 0) + HINT_AFTER_MS }
  }
  _goalAdd(k = 1) {
    const g = this.goal
    if (!g) return
    g.n += k; g.t0 = this.t; g.hintAt = this.t + HINT_AFTER_MS
    g.onCount?.(g.n)
    if (g.n >= g.need && this.goal === g) this._goalDone()
  }
  _goalDone() {
    const g = this.goal; this.goal = null
    this.queue = []                       // a pending word of praise must not talk over what comes next
    this._later(0, () => g.done?.())
  }
  onMeleeEvent(name, d) {
    if (name === 'swing' && d?.air && this._dummyAt() && this.dummyMode) this._swingAtDummy(d)
    const g = this.goal
    if (!g) return
    const w = g.on?.(name, d)
    if (w) { this._goalAdd(w === true ? 1 : w); if (this.goal !== g) return }
    g.other?.(name, d)
  }

  // ── back to the mark: walked there for you, between lessons ──────────────
  _goHome(then) {
    if (this._onTile(START)) return then()
    const sc = this.scene, p = sc.player, me = this._tile()
    let path = null
    try { path = sc.pathFinder?.findPath?.(me[0], me[1], START[0], START[1]) } catch (_) {}
    if (!path?.length || !p) return then()
    try { sc.joystick?.reset?.() } catch (_) {}
    this.m.pa.stopRoute?.()
    const walk = p._courseOrigSetPath || p.setPath.bind(p)     // past the guard that ignores your own touches
    walk(path.map(st => ({ dx: st.dx, dy: st.dy })))
    this.homing = { then, t0: this.t }
  }
  _homeTick() {
    const h = this.homing
    if (!h) return
    if (this._onTile(START) || this.t - h.t0 > 9000) { this.homing = null; h.then() }
  }

  // ── which lesson next ────────────────────────────────────────────────────
  _next() {
    this.goal = null
    const id = ORDER.find(i => i !== 'end' && !GameState.hasNote(noteOf(i))) || 'end'
    this.id = id
    this.squareUp = id !== 'meet' && id !== 'end'      // you face him whenever you stand still (facing())
    if (this.asDummy && !STAND_IN.has(id)) this._standDown()     // done standing in as a target
    if (HOME_LESSONS.has(id)) this._goHome(() => { this.id = id; this._lesson(id) })
    else this._lesson(id)
  }
  _finish(id, delay = 600) {
    GameState.addNote(noteOf(id))
    this.goal = null
    this.repeating = null
    if (this.practice) { this.id = 'talk'; return }
    this._later(delay, () => this._next())
  }
  _lesson(id) { this[`_${id}`]?.() }

  // ── meet ─────────────────────────────────────────────────────────────────
  _meet() {
    const S = SCRIPT.meet
    this.id = 'meet'
    this.m.HOME = [...LEDGE_AT]
    // he speaks when we come in sight of the ring, not while we are still a long way off.
    // "Art thou ready?" -- "I am": to the mark. "Not yet": you are free to go about the place;
    // he asks again when you have been away from him and come back (see _waitTick).
    this._meetWait = () => this._converse(S.intro, v => {
      if (v === 'wait') { this.id = 'waiting'; this._wandered = false; return }
      GameState.addNote(MET)
      this._toMark(() => this._speech(S.stance, () => this._next()))
    })
  }
  /** "not yet": once you have gone off and come back to him, he asks again */
  _waitTick() {
    if (this.id !== 'waiting' || this.speaking || this.scene._encounterPanel?._isOpen) return
    const f = this.m.foe, d = cheb(this._tile(), [f.c, f.r])
    if (d >= ASK_AGAIN_AWAY) this._wandered = true
    else if (this._wandered && d <= ASK_AGAIN_NEAR) { this._meet(); const go = this._meetWait; this._meetWait = null; this._later(300, go) }
  }

  // He speaks once he is on the screen (or we are well into the ring), not while we are still a long way off.
  _inSight() {
    const sc = this.scene, pgr = sc.perspectiveGround, p = sc.player
    if (!pgr || !p) return false
    const ts = sc.tileSize, c = sc.mapData?.lar ?? [18, 18]
    if (Math.hypot(p.logicalX / ts - c[0], p.logicalY / ts - c[1]) <= MEET_RANGE) return true
    const f = (pgr._encounterFlags || []).find(o => o.visual?.gid === SKYE_GID.WARDEN)
    if (!f) return true
    const pr = pgr._projectLogical((f.tileX + 0.5) * pgr.tileDisplaySize, (f.tileY + 0.5) * pgr.tileDisplaySize)
    if (!pr) return false
    const W = sc.scale.width, H = sc.scale.height
    return pr.screenX > 50 && pr.screenX < W - 50 && pr.screenY > H * 0.25 && pr.screenY < H * 0.8
  }

  // stand on the mark, then go on
  _toMark(then, quiet = false) {
    this.id = 'mark'
    this._mark([...START])
    if (!quiet) this._say(SCRIPT.meet.stand, 2600)
    this._afterMark = then
    this._markHintAt = this.t + HINT_AFTER_MS * (quiet ? 4 : 1)     // "take thy time": he doesn't nag
  }

  // ── drag: he draws a line on the ground and walks it; then you ───────────
  _drag() {
    this._mark(null)
    this.demo = { shown: 0, idx: 0 }
    this.dragStage = 'walk'
    this.m.HOME = [...DEMO_FROM]
    this._seq(SCRIPT.drag.intro)
  }
  _dragTick() {
    const S = SCRIPT.drag, m = this.m, d = this.demo, st = this.dragStage
    if (st === 'walk') {
      if (this._foeAt(DEMO_FROM)) { this.dragStage = 'draw'; d.t0 = this.t }
    } else if (st === 'draw') {
      d.shown = Math.min(DEMO_LINE.length, Math.floor((this.t - d.t0) / DRAW_STEP_MS) + 1)
      if (d.shown >= DEMO_LINE.length) { this.dragStage = 'pause'; d.t1 = this.t }
    } else if (st === 'pause') {
      if (this.t - d.t1 > 1000) {
        this.dragStage = 'follow'; d.idx = 1; d.stepAt = this.t
        m.HOME = [...DEMO_LINE[1]]
        this._say(S.following)
      }
    } else if (st === 'follow') {
      if (this._foeAt(m.HOME) || this.t - d.stepAt > 2600) {
        d.idx++; d.stepAt = this.t
        if (d.idx >= DEMO_LINE.length) this._dragInvite()      // the path ended where he teaches: nothing more to walk
        else m.HOME = [...DEMO_LINE[d.idx]]
      }
    }
  }
  _dragInvite() {
    const S = SCRIPT.drag
    this.dragStage = 'you'
    this.demo = null
    this.dragUnlocked = true
    this._say(S.you)
    this._later(this._holdOf(S.you) + 300, () => this._hint(S.hint))      // drawing a line isn't obvious: the narrator says how, at once
    this._goal({
      need: 2, hint: S.hint, after: this._holdOf(S.you) + this._holdOf(S.hint),
      onCount: n => { if (n < 2) this._say(S.good) },
      done: () => { this.dragStage = null; this._wrapUp('drag') },
    })
  }

  // ── the sword: thrown, caught, yours ─────────────────────────────────────
  // You stand on the mark and he stands facing you, two tiles to your left, so
  // your first cut at the air goes where you are looking: the tile between.
  _sword() {
    const S = SCRIPT.sword
    if (!this._onTile(START)) return this._toMark(() => { this.id = 'sword'; this._sword() })
    this._mark(null)
    this._faceLeft()
    this.m.HOME = [...FIGHT_AT]
    this._seq(S.intro, () => {
      this.throwFx = { t0: this.t, ms: 900 }
      this._later(950, () => {
        this.throwFx = null
        this._giveSword()
        this._later(700, () => this._speech(S.caught, () => this._drawNow()))
      })
    })
  }
  /** The draw, drilled: "Draw." / what he makes of it / "Put it away." -- DRAWS times, ending drawn.
   *  The salute is held back till the next lesson, so a second swipe up can't salute by accident. */
  _drawNow() {
    const S = SCRIPT.sword, m = this.m
    const call = asList(S.draw || [])[0], away = asList(S.sheathe || [])[0], said = asList(S.drawn || []).filter(Boolean)
    if (!call) return this._finish('sword', 200)
    m.noSalute = true
    const step = i => {
      if (i >= DRAWS) return this._finish('sword', 200)
      const last = i === DRAWS - 1
      this._faceLeft()
      if (m.enGarde) { m.setEnGarde(false) }                    // (only if you were ahead of him)
      this._call(call)
      this._prompt('up')
      this._goal({
        hint: S.drawHint, after: this._holdOf(call),
        on: n => n === 'enGarde',
        done: () => {
          this._prompt(null)
          // what he makes of it: the next of his words; the last draw gets all that is left
          const words = last ? said.slice(i) : said.slice(i, i + 1)
          const t = this._seq(words)
          if (last) return this._later(t + 200, () => step(i + 1))
          this._later(t + 300, () => {
            if (!away) return step(i + 1)
            this._call(away)
            this._prompt('down')
            this._goal({
              hint: S.sheatheHint, after: this._holdOf(away),
              on: n => n === 'atEase',
              done: () => { this._prompt(null); this._later(500, () => step(i + 1)) },
            })
          })
        },
      })
    }
    step(0)
  }
  _giveSword() {
    const sc = this.scene
    try {
      prepareSword(sc, true)
      const inv = sc.player.inventory
      const i = inv.slots.findIndex(it => it?.id === SWORD_ID)
      if (i >= 0 && inv.getEquippedItem?.('rightHand')?.id !== SWORD_ID) inv.equipItem(i, 'rightHand')
    } catch (e) { console.warn('[course] sword', e) }
  }

  /** you face him (he is on your left): the cut at the air goes that way, and so does the sprite */
  _faceLeft() {
    const p = this.scene.player
    if (p) p.moveDirection = { x: -1, y: 0 }
    this.squareUp = true
  }
  /** the scene asks (PGR) which way you stand when you are not walking; null: as you walked */
  facing() {
    if (!this.squareUp) return null
    const p = this.scene.player
    if (!p || p.isMoving || this.m.pa.onRoute() || this.t - (this.routeT ?? -1e9) < 250) return null   // walking: the way you walk
    const [pc, pr] = this._tile(), f = this.m.foe
    return { away: f.r < pr, left: f.c < pc ? true : f.c > pc ? false : null }
  }

  // ── the moon's gesture, shown (as the stars are in the constellation scene) ─
  _prompt(kind) { this.scene.moonPrompt?.(kind) }
  /** show `kind` on the moon while the blade is out, a swipe up while it is not */
  _promptFor(kind) { this._prompt(this.m.enGarde ? kind : 'up') }

  // ── calls: draw, then salute, and salute again ───────────────────────────
  // The salute is explained first (a card: the blade is away while he talks),
  // then one flow: draw (the narrator asks; he has no word for it), "Salute."
  // "Again." "Again." "Again." "It will do." Each is shown on the moon.
  // No buttons at the end: the blade stays out, and the fatigue lesson follows.
  _calls() {
    const S = SCRIPT.calls, m = this.m
    m.noSalute = false                               // now it is taught
    m.HOME = [...FIGHT_AT]
    this._faceLeft()
    const saluted = (n, d) => n === 'salute' && d?.by === 'player'
    // drawn in the sword lesson, it stays drawn; only if it isn't (coming back to the course here) is it asked for
    const STEPS = []
    if (!m.enGarde) STEPS.push({ say: S.draw || asList(SCRIPT.sword.draw || [])[0], hint: S.drawHint, p: 'up', on: n => n === 'enGarde', wait: 900 })
    for (let k = 0; k < SALUTES; k++) {
      // the next call waits out the salute (and his, returned), or the swipe would land while you are still busy
      STEPS.push({ say: k ? S.again : S.salute, hint: S.saluteHint, p: 'up', on: saluted, wait: SALUTE_MS + 300 })
    }
    const run = i => {
      if (i >= STEPS.length) { this._prompt(null); this._say(S.enough); return this._finish('calls', this._holdOf(S.enough)) }
      const st = STEPS[i]
      // if the last gesture carried you off the mark, you are walked back first
      this._goHome(() => {
        this._faceLeft()
        if (st.say) this._call(st.say); else this._hint(st.hint)     // no word of his: the narrator asks
        if (st.p) this._prompt(st.p)
        this._goal({
          need: 1, hint: st.hint, on: st.on, after: this._holdOf(st.say || st.hint),
          done: () => { this._prompt(null); this._later(st.wait, () => run(i + 1)) },
        })
      })
    }
    this._speech(S.intro, () => run(0), { keepBlade: true })
  }

  // ── fatigue: waste ───────────────────────────────────────────────────────
  // He stands in as a target and turns every cut aside, till you are winded.
  // "Stop." -- then what it was for (a card: no question, no buttons).
  _fatigue() {
    const S = SCRIPT.fatigue
    this._standIn(() => {
      this._faceLeft()
      this.dummyMode = 'parry'
      this._seq(S.intro)
      this._later(this._lengthOf(S.intro), () => this._hint(S.hint))
      this._goal({
        after: this._lengthOf(S.intro) + this._holdOf(S.hint), hint: S.hint,
        on: name => name === 'winded',
        tick: () => this._promptFor('tap'),
        done: () => {
          this.dummyMode = null
          this._prompt(null)
          this._call(S.stop)
          this._later(this._holdOf(S.stop) + 300, () => this._wrapUp('fatigue'))
        },
      })
    })
  }

  // ── strong: gather it, hold it, let it go ────────────────────────────────
  // His words first (a card, the blade kept out), then one strong blow at him.
  // Let go too soon and it is only a cut: he says so (tooSoon).
  _strong() {
    const S = SCRIPT.strong
    this._heal()
    this._standIn(() => {
      this._faceLeft()
      this.dummyMode = 'parry'
      this._speech(S.intro, () => {
        this._faceLeft()
        this._hint(S.hint)
        let gathering = false
        this._goal({
          hint: S.hint, after: this._holdOf(S.hint),
          on: (name, d) => name === 'swing' && d.charged && !this.speaking,
          other: (name, d) => {
            if (name === 'chargeStart') gathering = true
            else if (name === 'swing') { if (gathering && !d?.charged) this._say(S.tooSoon); gathering = false }
          },
          tick: () => this._promptFor('hold'),
          done: () => {
            this.dummyMode = null
            this._prompt(null)
            this._later(500, () => { this._say(S.good); this._later(this._holdOf(S.good) + 300, () => this._wrapUp('strong')) })
          },
        })
      }, { keepBlade: true })
    })
  }

  // ── space: the ground, before any blade ──────────────────────────────────
  // Both of you on guard, bare-handed (melee.bare). He steps up beside you, the
  // tile under you turns red, he lunges: be off it. Then he comes to shove you
  // about until you shove back (walk into him); the third shove puts him down.
  _bare(on) {
    const m = this.m, v = this.scene._melee?.view
    if (on) {
      if (this._peacefulWas === undefined) this._peacefulWas = m.peaceful
      m.peaceful = true; m.bare = true; m.foeGuard = true
      if (!m.enGarde) { m.enGarde = true; if (v) v.a.garde = v.now() - DRAW_MS * 2 }
    } else {
      m.bare = false; m.foeGuard = false
      if (m.enGarde && !this.scene._melee?.swordInHand?.()) m.enGarde = false
      if (this._peacefulWas !== undefined) { m.peaceful = this._peacefulWas; this._peacefulWas = undefined }
    }
  }
  _space() {
    const S = SCRIPT.space, m = this.m
    m.HOME = [...FIGHT_AT]
    this._speech(S.intro, () => {
      this._spaceRun('dodge', DODGES, S.dodgeHint, () => {
        this._speech(S.mid, () => this._goHome(() => {
          this._spaceRun('shove', SHOVES, S.shoveHint, () => {
            this._goHome(() => this._wrapUp('space'))      // a rest, and the Fianna if you ask
          })
        }))
      })
    })
  }
  _spaceRun(kind, need, hint, then) {
    const S = SCRIPT.space
    this._bare(true)
    this.space = { kind, need, n: 0, phase: 'approach', t0: this.t, tile: null, goal: null, hits: 0, down: false }
    if (kind === 'dodge') this._hint(S.dodgeHint); else this._say(S.shoveGo)
    this._goal({
      need, hint, after: 3500,
      done: () => {
        const down = this.space?.kind === 'shove'
        if (this.space) this.space.phase = 'end'
        this._later(down ? 2600 : 600, () => { this.space = null; this._bare(false); then() })
      },
    })
  }
  /** a free tile beside you, nearest to him */
  _besideMe() {
    const m = this.m, me = m.pa.tile(), f = m.foe
    let best = null, bd = 1e9
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const c = me[0] + dc, r = me[1] + dr
      if (!m.pa.free(c, r)) continue
      const d = Math.abs(c - f.c) + Math.abs(r - f.r) + Math.random() * 1.2
      if (d < bd) { bd = d; best = [c, r] }
    }
    return best
  }
  _spaceTick() {
    const sp = this.space, m = this.m, v = this.scene._melee?.view, S = SCRIPT.space
    if (!sp || sp.phase === 'end') return
    if (!m.enGarde) m.enGarde = true                     // the stance stays up (a swipe down must not drop it)
    const me = m.pa.tile(), f = m.foe, beside = cheb(me, [f.c, f.r]) === 1 && !f.from
    const dur = this.t - sp.t0
    if (sp.phase === 'approach') {
      if (beside && !m.pa.onRoute() && dur > 500) {
        sp.phase = 'tell'; sp.t0 = this.t; sp.ms = sp.kind === 'dodge' ? (sp.n < 2 ? 1500 : 1100) : 950
        sp.tile = [...me]; v?.foeTell?.(sp.ms)
      } else if (!sp.goal || cheb(sp.goal, me) !== 1 || dur > 7000) {
        sp.goal = this._besideMe(); if (sp.goal) m.HOME = [...sp.goal]; if (dur > 7000) sp.t0 = this.t - 600
      }
    } else if (sp.phase === 'tell') {
      if (dur >= sp.ms) {
        sp.phase = 'strike'; sp.t0 = this.t
        const dir = [Math.sign(sp.tile[0] - f.c), Math.sign(sp.tile[1] - f.r)]
        sp.dir = dir
        m.emit('shove', { by: 'foe', dir })
        SoundBoard.playWeb('FOOT_SHUFFLE', this.scene, {})
      }
    } else if (sp.phase === 'strike') {
      if (dur >= 140) {
        const hit = same(m.pa.tile(), sp.tile)
        if (hit) {                                       // still there: pushed back a tile, no harm
          m.pa.forceStep(sp.dir); sp.hits++
          if (v) v.a.hurt = v.now()
          SoundBoard.playWeb('BLADE_THUD', this.scene, { hard: 0.2, volume: 0.4 })
          if (sp.kind === 'dodge' && sp.hits === 2) { sp.hits = 0; this._hint(S.dodgeHint) }
        } else if (sp.kind === 'dodge') {
          const line = S.good?.[sp.n % S.good.length]
          this._goalAdd(1); if (this.space) { sp.n++; this._say(line) }
        }
        if (this.space && sp.phase !== 'end') { sp.phase = 'after'; sp.t0 = this.t; sp.goal = null }
      }
    } else if (sp.phase === 'after') {
      if (dur >= (sp.kind === 'dodge' ? 900 : 700)) { sp.phase = 'approach'; sp.t0 = this.t }
    } else if (sp.phase === 'stagger') {
      if (dur >= 1100) { sp.phase = 'approach'; sp.t0 = this.t; sp.goal = null }
    }
  }
  /** walked into him: a shoulder (the scene calls this). It only counts in the shoving half. */
  _spaceShove(dx, dy) {
    const sp = this.space, m = this.m
    if (!sp || sp.kind !== 'shove' || sp.phase === 'end' || sp.down) return true
    if (this.t - (this.lastShove || -1e9) < 450) return true
    this.lastShove = this.t
    const f = m.foe, S = SCRIPT.space
    sp.n++
    const last = sp.n >= sp.need
    m.emit('shove', { dir: [dx, dy], down: last })
    m._foeStepTo(f.c + dx, f.r + dy, 160)                // thrown back a tile
    SoundBoard.playWeb('BLADE_THUD', this.scene, { hard: 0.25, volume: 0.45 })
    SoundBoard.playWeb('FOOT_SHUFFLE', this.scene, {})
    if (last) {
      sp.down = true
      m._setFoe('down', 2200); f.hurtUntil = m.t + 2200
      m.emit('knockdown', { who: 'foe' })
    } else {
      m._setFoe('stagger', 700)
      this._say(S.shoved?.[(sp.n - 1) % S.shoved.length])
      sp.phase = 'stagger'; sp.t0 = this.t
    }
    this._goalAdd(1)
    return true
  }
  /** the tile he is about to strike, red, deepening (drawn over the figures) */
  _drawSpace(ctx) {
    const sp = this.space, v = this.scene._melee?.view
    if (!sp || !v || !sp.tile || (sp.phase !== 'tell' && sp.phase !== 'strike')) return
    const k = sp.phase === 'strike' ? 1 : Math.min(1, (this.t - sp.t0) / Math.max(1, sp.ms))
    v.tileQuad(ctx, sp.tile, `rgba(220,60,50,${0.12 + 0.35 * k})`, `rgba(255,90,70,${0.4 + 0.6 * k})`)
  }

  // ── the dummy: Conall stands in for it ───────────────────────────────────
  // He takes the dummy's place, blade out, and turns aside everything you throw.
  // He cannot be hurt, but he knows an effective blow when he sees one and counts
  // it as the straw post did. Nothing is shown: he is satisfied, or he is not.
  /** the tile he stands on, when he is standing in for the dummy */
  _dummyAt() {
    const f = this.m.foe
    return this.asDummy && !f.from ? [f.c, f.r] : null
  }
  _standIn(then) {
    const m = this.m
    if (this.asDummy && this._foeAt(DUMMY_AT)) return then()
    this.asDummy = true
    m.foeReady = true                       // his own blade comes out
    m.foeGuard = true                       // and he holds it as a guard, not hanging
    m.HOME = [...DUMMY_AT]
    this.standing = { t0: this.t, then, sayAt: 0 }
  }
  _standTick() {
    const s = this.standing
    if (!s) return
    const arrived = this._foeAt(DUMMY_AT)
    // you are standing where he needs to be: ask, and wait
    if (!arrived && same(this._tile(), DUMMY_AT) && this.t - s.t0 < 40000) {
      if (this.t >= s.sayAt) { s.sayAt = this.t + 5000; this._hint(SCRIPT.dummy.clearHint) }
      return
    }
    if (!arrived && this.t - s.t0 < 16000) return
    this.standing = null
    s.then()
  }
  _standDown() {
    this.asDummy = false; this.standing = null
    this.m.foeReady = false; this.m.foeGuard = false
    this.m.HOME = [...FIGHT_AT]
  }
  /** he turns a blow aside (a clack and a spark), and rocks back a little */
  _parry(ms, clack = true) {
    const m = this.m
    m._setFoe('reel', ms)
    if (clack) m.emit('parried', { by: 'foe', exchange: 0 })
  }

  _dummy() {
    const S = SCRIPT.dummy
    this.points = 0
    this.landedSaid = false
    this._standIn(() => {
      this._speech(S.intro, () => this._saluteFirst(() => {
        this.dummyMode = 'score'
        this._goal({
          need: DUMMY_GOAL, hint: S.hint, after: 1500,
          tick: () => this._dummyPrompt(),
          done: () => { this.dummyMode = null; this._prompt(null); this._later(900, () => this._wrapUp('dummy')) },
        })
      }))
    })
  }
  /** he draws and offers his salute; the lesson waits for yours (and goes on anyway after 30 s) */
  _saluteFirst(then) {
    const m = this.m, S = SCRIPT.dummy, t0 = this.t, drawn = m.foeReady
    m.foeReady = true
    m._setFoe('salute', SALUTE_MS + (drawn ? 0 : DRAW_MS))
    m.emit('salute', { by: 'foe', draw: !drawn })
    this._hint(S.saluteHint)
    this._goal({
      hint: S.saluteHint, after: this._holdOf(S.saluteHint),
      on: (n, d) => n === 'salute' && d?.by === 'player',
      tick: () => { this._prompt('up'); if (this.goal && this.t - t0 > 30000) this._goalDone() },
      done: () => { this._prompt(null); this._later(SALUTE_MS + 300, then) },
    })
  }
  _dummyPrompt() {
    if (!this.m.enGarde && cheb(this._tile(), this._dummyAt() || DUMMY_AT) <= 2) this._prompt('up'); else this._prompt(null)
  }

  _feet() {
    const S = SCRIPT.feet
    this._standIn(() => {
      this._speech(S.intro, () => {
        this._call(S.go)
        this._later(this._holdOf(S.go) + 200, () => this._hint(S.hint))
        this.dummyMode = 'pass'
        this._goal({
          need: PASSES, hint: S.hint, after: this._holdOf(S.go) + this._holdOf(S.hint),
          tick: () => this._dummyPrompt(),
          onCount: n => { if (n < PASSES && S.count?.length) this._call(S.count[Math.min(n, S.count.length) - 1]) },   // he counts ("Three." opens the card)
          done: () => {
            this.dummyMode = null; this._prompt(null)
            this._later(600, () => this._wrapUp('feet'))         // he stays put while he talks ("I have not retreated"); _next stands him down
          },
        })
      })
    })
  }

  // a cut at the air, beside him: he parries it, and counts it if it would have landed
  _swingAtDummy(d) {
    const at = this._dummyAt()
    if (!at || !this.dummyMode) return
    const me = this._tile()
    if (cheb(me, at) !== 1) return
    const m = this.m
    if (m.swing) m.swing.tile = [...at]                              // the cut goes at him, whichever way you last walked
    const moving = m.moving() || this.t - (this.routeT ?? -1e9) < 600   // walking (a drawn line or the d-pad), or just off the end of a line
    this._later(160, () => {
      if (!this.dummyMode) return
      this._parry(d.charged ? 600 : 380)
      if (this.dummyMode === 'score') this._score(d.charged ? PTS.strong : PTS.cut)
      else if (this.dummyMode === 'pass' && moving) this._goalAdd(1)
      // 'parry': he turns it aside, and that is all (fatigue, strong)
    })
  }
  _score(n) {
    this.points += n
    // the first blow that would have landed: "Thus. Dost thou see?" (said once, over the play)
    if (!this.landedSaid && this.id === 'dummy') { this.landedSaid = true; this._seq(SCRIPT.dummy.landed) }
    this._goalAdd(n)
  }

  /** walked into him, en garde: a shoulder. He plants his feet. (the scene calls this) */
  bumpDummy(dx, dy = 0) {
    if (this.space) return this._spaceShove(dx, dy)
    if (!this._dummyAt() || !this.dummyMode) return false
    const m = this.m
    if (!m.enGarde || this.t - (this.lastShove || -1e9) < 450) return true
    this.lastShove = this.t
    if (m.winded() || m.breath < 1) { m.emit('spent', { lastHeart: m.pa.hp() <= 1 }); return true }
    m.spend(1)
    this._parry(250, false)
    SoundBoard.playWeb('BLADE_THUD', this.scene, { hard: 0.25, volume: 0.45 })
    SoundBoard.playWeb('FOOT_SHUFFLE', this.scene, {})
    if (this.dummyMode === 'score') this._score(PTS.shove)
    return true
  }

  // what the scene asks about the dummy: his tile, while a lesson is counting
  occupies(tx, ty) {
    if (this.space) { const f = this.m.foe; return f.c === tx && f.r === ty }
    const a = this._dummyAt()
    return !!a && !!this.dummyMode && a[0] === tx && a[1] === ty
  }
  /** the camera closes in on you and him (FightLens) */
  lensFocus() {
    if (this.speaking) { const f = this.m.foe; return [f.c, f.r] }       // in on him while he speaks
    const at = this._dummyAt()
    if (!at || !this.dummyMode) return null
    return cheb(this._tile(), at) <= 4 ? at : null
  }
  /** a tap on him: beside him, en garde, a cut; further off, walk up to him */
  tapDummy(x, y) {
    const at = this._dummyAt()
    if (!at || !this.dummyMode) return false
    const b = this.scene._melee?.view?.foeFigure?.()
    if (!b || Math.abs(x - b.x) > b.w * 0.65 || y < b.y - b.h * 1.1 || y > b.y + b.w * 0.3) return false
    const me = this._tile(), m = this.m
    if (cheb(me, at) === 1) { if (m.enGarde) m.act(() => m.strike(), 'strike'); return true }
    const sc = this.scene, ts = sc.tileSize
    let best = null, bd = 1e9
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const c = at[0] + dx, r = at[1] + dy
      if ((!dx && !dy) || sc.isColliding(c * ts + ts / 2, r * ts + ts / 2) || sc.isOccupied(c * ts + ts / 2, r * ts + ts / 2)) continue
      const dd = Math.hypot(c - me[0], r - me[1]); if (dd < bd) { bd = dd; best = [c, r] }
    }
    const path = best && sc.pathFinder?.findPath?.(me[0], me[1], best[0], best[1])
    if (path?.length) sc.player.setPath(path.map(st => ({ dx: st.dx, dy: st.dy })))
    return true
  }

  // ── the duel: brief, slow, gentle; he coaches as it goes ─────────────────
  // A real bout: you can lose it (he stops on your last heart); you mend with your blade away and go again.
  _boutOn(F) {
    const m = this.m
    m.F = { ...F }
    m.foe.hp = F.hp
    m.HOME = [...FIGHT_AT]
    m.peaceful = false; m.eager = true      // sword drawn = the bout is on
    m.matchPause = false; m.resume = false; m.touches = 0
    this._heal()
  }
  _boutOff() {
    const m = this.m
    m.peaceful = true; m.eager = false
    m.matchPause = false; m.resume = false; m.foeReady = false
    m._endCombat?.()
    m.bout = { over: false, until: 0, needLeave: false }
    m.p.lost = false
    m._setFoe?.('idle', 0)
    m.F = { ...PRESETS.warden }
    m.foe.hp = m.F.hp
    m.HOME = [...FIGHT_AT]
    this._prompt(null)
    this._heal()
  }
  /** a touch: the action stops; you are walked back to your mark, he to his; and it goes on when you are both there */
  _touched(d) {
    const m = this.m
    if (d.scorer === 'player') this._duelStrength(m.F.hp - m.foe.hp)
    this._heal()
    this.regroup = null
    this._later(1500, () => {
      if (this.id !== 'duel') return
      this._goHome(() => { this.regroup = { t0: this.t } })
    })
  }
  /** three stages over his hearts: the longer you hold, the quicker and harder he gets (and he calls 'Arís!') */
  _phase() {
    const m = this.m, lost = m.F.hp - m.foe.hp
    const n = Math.max(this.floor || 0, lost >= Math.ceil(m.F.hp * 0.75) ? 2 : lost >= Math.ceil(m.F.hp * 0.375) ? 1 : 0)
    if (n === this.round || m.foe.hp <= 0) return
    this.round = n
    m.F = { ...DUEL_ROUNDS[n] }
    m.emit('phase', { n })
  }
  /** every touch you score, he steps up a little: quicker, and harder */
  _duelStrength(n) {
    this.round = n
    this.m.F = { ...DUEL_ROUNDS[Math.min(n, DUEL_ROUNDS.length - 1)] }
  }
  /** the duel is going on in your hands: blade out, a bout under way, or you are mending */
  _busyDuel() {
    const m = this.m, p = this.scene.player
    return m.enGarde || m.combat || m.bout.over || !!(p && p.currentHP < p.maxHP)
  }
  /** hurt, and with your blade away, you mend: a heart every 1.2 s */
  _healTick() {
    if (this.id !== 'duel' || this.m.enGarde || this.t < (this._healAt || 0)) return
    const p = this.scene.player
    if (p && p.currentHP < p.maxHP) { p.heal?.(1); this._healAt = this.t + 1200 }
  }
  _regroupTick() {
    const r = this.regroup, m = this.m
    if (!r || !m.enGarde) return                      // the prompt asks for your blade
    if ((this._foeAt(FIGHT_AT) && this._onTile(START)) || this.t - r.t0 > 6000) {
      this.regroup = null
      this._later(400, () => m.resumeBout())
    }
  }
  /** A bout starts only when you're within a few tiles of him: be on the mark first. */
  _atMark(fn) {
    const [c, r] = this._tile()
    if (Math.max(Math.abs(c - FIGHT_AT[0]), Math.abs(r - FIGHT_AT[1])) <= NEAR_FIGHT) return fn()
    const id = this.id
    this._toMark(() => { this.id = id; fn() })
  }
  /** a word of coaching, not more often than every few seconds */
  _coach(line, gap = 4200) {
    if (this.t < (this.coachAt || 0)) return
    this.coachAt = this.t + gap
    this._call(line, 2800)
  }

  // The course's last lesson: a bout, and his work is done the moment you land a
  // blow while time is slowed (bullet time: a line drawn at him, near him).
  // Winning the bout another way counts too. `again`: the rematch, after the
  // course -- win the bout, as it always was.
  _duel(again = false) {
    const S = SCRIPT.duel
    this._atMark(() => {
      this.tells = 0; this.hitsMade = 0; this.coachAt = 0; this.saluted = true; this.reads = 0; this.plainHits = 0
      const open = go => (again || this.repeating === 'duel') ? go() : this._speech(S.intro, go)
      open(() => {
      this._call(S.go)
      if (!again) this._later(this._holdOf(S.go) + 300, () => this._hint(S.focusHint))
      this.floor = again ? REMATCH_STAGE : 0
      this.round = this.floor
      this._boutOn(DUEL_ROUNDS[this.round])
      const slowed = () => !!this.scene._melee?.focus?.on
      this._goal({
        need: 1, hint: again ? S.hint : (S.focusHint || S.hint), after: this._holdOf(S.go) + this._holdOf(S.focusHint), giveUp: DUEL_GIVE_UP_MS,
        on: (name, d) => (name === 'boutOver' && d.won) || (!again && name === 'hit' && d.on === 'foe' && slowed()),
        tick: () => { const p = this.scene.player; if (!this.m.enGarde && !(p && p.currentHP < p.maxHP)) this._prompt('up'); else this._prompt(null) },     // no prompt while you mend
        other: (name, d) => {
          if (name === 'boutStart') this.saluted = false
          else if (name === 'salute' && d?.by === 'player') this.saluted = true
          // he says little in a bout: only what the draft gives him. The sword business is the narrator's.
          if (name === 'touch') this._touched(d)
          else if (name === 'hit' && d.on === 'foe') {
            this._later(0, () => this._phase())
            // landing blows without the slow: now and then, the narrator reminds you how to find it
            if (!again && !slowed() && ++this.plainHits % 2 === 0) this._hint(S.focusHint)
          }
          // your blow turned aside (not the salute reminder, which has no wind-up): "thy foot is telling me..." -- twice at most
          else if (name === 'parried' && d.by === 'foe' && d.wind !== undefined) { if (this.reads < 2 && Math.random() < 0.5) { this.reads++; this._coach(S.read, 6000) } }
          else if (name === 'disarm') this._hint(S.disarmHint)
        },
        done: () => {
          this.m.peaceful = true
          this._later(again ? 4600 : 1400, () => {
            this._boutOff()
            if (again) return this._finish('duel', 0)
            // "There! Thou wert in the moment..." -- then the end of the lesson
            const after = S.after
            this._wrapUp('duel', { say: [...asList(S.moment || []), ...asList(after?.say ?? after ?? [])].filter(Boolean), ask: after?.ask })
          })
        },
      })
      })
    })
  }

  // ── the end: across the loch, to the class ───────────────────────────────
  _end() {
    this.id = 'end'
    this._mark(null)
    this.m.HOME = [...LEDGE_AT]
    // the green meets you with the class in session, and then the tournament
    for (const n of [COURSE_DONE, DUMMY_DONE, FOOT_DONE, SPAR_DONE]) GameState.addNote(n)
    this._converse(SCRIPT.end.intro, () => {
      this._hint(SCRIPT.end.hint, 7000)
      this._talkMode()
    })
  }

  // ── drawn over the figures (from the scene's onPGRDrawComplete) ──────────
  draw(ctx) {
    this._drawThrow(ctx)
    this._drawLines(ctx)
    this._drawSpace(ctx)
    this._drawDummy(ctx)
  }

  /** the sword in flight */
  _drawThrow(ctx) {
    const fx = this.throwFx
    if (!fx) return
    const sc = this.scene, m = this.m
    const a = figureBox(sc, m.foe.c, m.foe.r)
    const [pc, pr] = this._tile()
    const b = figureBox(sc, pc, pr)
    if (!a || !b) return
    const k = Math.min(1, (this.t - fx.t0) / fx.ms)
    const x = a.x + (b.x - a.x) * k
    const y = a.y - a.h * 0.6 + ((b.y - b.h * 0.6) - (a.y - a.h * 0.6)) * k - Math.sin(Math.PI * k) * a.h * 0.7
    const size = Math.max(14, b.w * 0.7 + (a.w - b.w) * (1 - k) * 0.5)
    const img = sc.itemSheet?.getCanvas?.(2492)
    ctx.save()
    ctx.translate(x, y); ctx.rotate(k * Math.PI * 6)
    if (img) { ctx.imageSmoothingEnabled = false; ctx.drawImage(img, -size / 2, -size / 2, size, size) }
    else { ctx.strokeStyle = '#d8d4c8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-size / 2, 0); ctx.lineTo(size / 2, 0); ctx.stroke() }
    ctx.restore()
  }

  /** the line he draws (gold, as yours will be) */
  _drawLines(ctx) {
    const rd = this.scene._routeDraw
    if (!rd?._line) return
    ctx.save()
    const d = this.demo
    if (d && d.shown > 0 && this.dragStage !== 'back') {      // shown once: drawn, then walked, then gone
      const from = this.dragStage === 'follow' ? Math.max(0, d.idx - 1) : 0
      const tiles = DEMO_LINE.slice(from, d.shown)
      rd._line(ctx, tiles, 'rgba(245,208,96,0.8)', 3, [2, 6])
      if (this.dragStage === 'draw') {           // the fingertip, at the head of the line
        const h = tiles[tiles.length - 1], p = h && rd._ground(h[0] + 0.5, h[1] + 0.5)
        if (p) {
          ctx.beginPath(); ctx.arc(p[0], p[1], 9, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(255,244,205,0.85)'; ctx.fill(); ctx.strokeStyle = 'rgba(245,208,96,0.95)'; ctx.lineWidth = 3; ctx.stroke()
        }
      }
    }
    ctx.restore()
  }

  /** the tile you strike at, in gold, when you are beside him (no tally: he keeps it) */
  _drawDummy(ctx) {
    const at = this._dummyAt()
    if (!at || !this.dummyMode) return
    const view = this.scene._melee?.view
    if (this.m.enGarde && cheb(this._tile(), at) === 1) view?.tileQuad?.(ctx, at, 'rgba(245,208,96,0.12)', 'rgba(245,208,96,0.7)', 1.5)
  }

  // ── the frame ────────────────────────────────────────────────────────────
  update(dt) {
    this.t += Math.min(50, dt)
    this._zoneTick()
    for (const q of this.queue.slice()) if (this.t >= q.at) { this.queue.splice(this.queue.indexOf(q), 1); q.fn() }
    if (this._meetWait && !this.scene._encounterPanel?._isOpen && this._inSight()) { const f = this._meetWait; this._meetWait = null; this._later(700, f) }
    this._waitTick()
    this.drill?.update()
    this._standTick()
    this._homeTick()
    this._regroupTick()
    this._healTick()
    if (this.space && !this.speaking) this._spaceTick()
    if (this.m.pa.onRoute()) this.routeT = this.t
    if (this.id === 'drag' && this.demo) this._dragTick()
    if (this.id === 'mark') {
      if (this._onTile(START)) { const f = this._afterMark; this._afterMark = null; this.id = 'markDone'; this._mark(null); f?.() }
      else if (this.t >= this._markHintAt) { this._hint(SCRIPT.meet.standHint); this._markHintAt = this.t + HINT_AFTER_MS }
    }
    const g = this.goal
    if (g && this.speaking) { g.t0 = this.t; g.hintAt = this.t + HINT_AFTER_MS }
    if (g) {
      g.tick?.()
      if (this.id === 'duel' && this._busyDuel()) g.t0 = this.t         // a long fight is not a stall
      if (this.goal === g && g.hint && this.t >= g.hintAt) {
        if (this.id === 'duel' && this._busyDuel()) g.hintAt = this.t + HINT_AFTER_MS      // on guard, fighting or mending: no nagging
        else { this._hint(g.hint); g.hintAt = this.t + HINT_AFTER_MS }
      }
      if (this.goal === g && this.t - g.t0 >= (g.giveUp ?? GIVE_UP_MS)) {         // let it go
        this.goal = null
        this._prompt(null)
        this.dummyMode = null
        if (this.id === 'duel') this._boutOff()
        const id = this.id
        this._later(3200, () => {
          if (id === 'feet') this._standDown()
          this._finish(id, 0)
        })
      }
    }
  }

  destroy() {
    this.drill?.destroy(); this.drill = null
    const p = this.scene.player
    if (p?._courseWrapped) { p.setPath = p._courseOrigSetPath; p._courseWrapped = false }
    const rd = this.scene._routeDraw
    if (rd?._courseWrapped) { rd._commit = rd._courseOrigCommit; rd.move = rd._courseOrigMove; rd.end = rd._courseOrigEnd; rd._courseWrapped = false }
    if (this.id === 'duel') { try { this._boutOff() } catch (_) {} }
    try { this._bare(false) } catch (_) {}
    try { this.m.foeReady = false; this.m.foeGuard = false; this.m.returnsSalute = false } catch (_) {}
    this._mark(null)
    this._prompt(null)
    try { this._voice?.stop() } catch (_) {}
  }
}

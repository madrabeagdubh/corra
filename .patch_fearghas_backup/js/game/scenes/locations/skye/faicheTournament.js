// faicheTournament.js
// Location: js/game/scenes/locations/skye/faicheTournament.js
//
// The tournament on the green, once the lessons are done (faiche_spar_done).
//
//   The Warden referees from the north side of the ring. Your place is
//   marked at the south edge: stand on it and he calls the next student in.
//   They walk out to the middle; go en garde and fight. Easiest first:
//
//     Ciarán   a beginner (novice)       Laoise    stands firm (warden)
//     Bearach  reads your route (spar)   Fial      fast, no guard (brawler)
//     Fer Diad the best of them (master)
//
//   Win and they yield; your hearts come back, a few more students come to
//   watch, and the next is waiting. Lose (or yield) and it's the same one
//   again when you're ready. Each win is kept: faiche_tourney_<n>.
//
//   Some students have a technique to teach (TEACH). Win or lose, the teacher and you are walked to the training
//   posts (two of the three are left standing, wide apart), the cards open by themselves, and hearing the last one
//   unlocks the technique for good (technique_<id>, meleeBout.js). Then a drill: she cuts slowly (and harmlessly) and
//   you meet it on the beat; three timed parries and she walks back to the crowd. Skip the walk and it waits: the
//   lesson starts when you next take your place.
//
//   Uathach watches from the dais and calls the names: yours and your opponent's when it is your turn. While you are at the
//   posts she calls two other students in, who salute and wait; when your lesson is done they fence for show, quickening
//   as they go (faicheDuel.js). Standing in the ring where your bout ended is fine; walk in AFTER that, while they fence, and
//   they stop, the crowd jeers, and she says so. Then your turn.
//
//   Beat Fer Diad and Uathach comes down from the dais, steel in her hand:
//   the first live blade you've faced. Nothing you do lands; she never cuts
//   you; she throws you, three times. Then she salutes, sheathes, and tosses
//   you a coin -- and the brooch turns silver (note brooch_silver). Note
//   faiche_tournament_done; the Warden is your sparring partner again.
//
// PLACEHOLDER lines: English in both slots.

import { GameState } from '../../../systems/gameState.js'
import { SoundBoard } from '../../../systems/soundBoard.js'
import { VoiceSynth } from '../../../systems/voice/voiceSynth.js'
import { SKYE_GID } from './skyeScene.js'
import MeleeBout, { SWORD_NOTE, STRONG_NOTE, TECH_NOTE, hasTechnique, unlockTechnique } from '../../../combat/meleeBout.js'
import { LESSON_DONE, KATA_DONE, DUMMY_DONE, FOOT_DONE, SPAR_DONE } from './faicheLesson.js'
import StagedDuel from './faicheDuel.js'
import { PRESETS } from '../../../combat/melee.js'
import { INK } from '../../../ui/speakers.js'
import { createItem } from '../../../ui/inventory/itemDefinitions.js'
import { arrowSpinAway } from '../../../combat/arrowFx.js'

export const TOURNEY_DONE = 'faiche_tournament_done'
const WON = i => `faiche_tourney_${i}`

const OPPONENTS = [
  { id: 'ciaran',  kind: 'novice',  name: 'Ciarán', teach: 'strong', F: { leap: true, leapOnly: true, spinStay: true, openSpins: 3, openGap: 450, leapQuick: 300, leapWind: 950, leapGap: 500, safeDist: 3, hp: 3, recoverMs: 1500, stepMs: 300 } },     // in order of how hard they are for a casual player; the spin you will be taught, on the spot: three at the start with hardly a gather, then he backs off to gather it whole
  { id: 'laoise',  kind: 'spar',    name: 'Laoise', teach: 'bow', F: { archer: true, dropSword: true, keepBout: true, arrows: 50, arrowDmg: 2, combo: 0, openShots: 1, quickDraw: 350, drawMs: 600, shootGap: 300, shootRecover: 250, keep: 3, hp: 4, recoverMs: 1100, stepMs: 330 } },     // an archer: she keeps off and shoots; no red tile, only the bow drawn; close with her, or bat the arrow aside as it comes
  { id: 'fial',    kind: 'spar',    name: 'Fial', teach: 'dash', F: { dashOnly: true, combo: 0, openDashes: 1, dashQuick: 450, dashWind: 950, dashGap: 500, hp: 3, recoverMs: 1500, stepMs: 300 } },     // the dash, and only the dash: the first with hardly a gather, then again and again (a red lane, a gather, and he is through you)
  { id: 'tadhg',   kind: 'spar',    name: 'Tadhg', F: { pattern: ['cut', 'cut', 'spin', 'cut', 'dash', 'cut'], spinStay: true, leapWind: 800, dashWind: 900, hp: 6, recoverMs: 800,
                                                      parryBase: 0.55, parryReel0: 0.4, parryReelStep: 0.1, parryMax: 0.85 } },     // all of it: a good parry, and a round he can be learned by: two cuts, a spin, a cut, a dash. No lesson: a hard fight, and that is all
]
const REF_AT = [21, 9]                 // the Warden, refereeing from the north edge
const MARK = [18, 26]                   // your place, outside the ring at the south edge: step on it and the bout begins
const FOE_START = [18, 13], FOE_GUARD = [18, 17], FOE_HOME = [18, 18]     // he starts outside the ring at the north, walks in to his guard, and is leashed round FOE_HOME
const RING_R = 5.5                      // the ring is a little smaller for the tournament
const OUT_WARN_MS = 600, OUT_FORFEIT_MS = 7000     // outside the ring this long in a bout: Uathach calls you in and it holds; again, or this long, and it is lost
const SALUTE_OFFER_MS = 3300, SALUTE_WAIT_MS = 9000, SALUTE_DONE_MS = 1900     // after a bout: he offers a salute this long after, waits this long for yours, and it takes this long to finish
const U_DOWN = [[18, 8], [18, 9], [18, 10], [18, 11], [18, 12], [18, 13], [18, 14], [18, 15]]
const U_UP = [[18, 14], [18, 13], [18, 12], [18, 11], [18, 10], [18, 9], [18, 8], [18, 7]]
const COIN_MS = 900
const ARENA_INSET = 0.5                 // tiles in from the ring's line: inside this is "in the ring" for the pair's duel
const DUEL_WAIT_MS = 120000             // the pair wait this long for you to finish your lesson, and then they fence anyway
const SPOT = { p: [33, 19], t: [34, 19] }     // where you and the one you fought go to talk: the quiet strip past the two posts, you facing east
const BOW_RANGE_TILES = 13                                                   // a full draw sends the arrow this far (you pull back a screen's width at most)
const BOW_SPOT = { p: [31, 26], t: [33, 26], rack: [32, 26], post: 2 }     // the archery lesson: either side of the bow rack in the south, facing the nearest post (31,22), so every shot goes north
const WALK_MAX_MS = 26000              // walked to the posts for a lesson: if you are not there by now, you are set down there
const DRILL_WIN = 3, DRILL_MAX_MS = 150000     // timed parries to land in the drill (or this long, and it counts)

// Dev shortcut: ?scene=skye_faiche&tourney=N  (N = bouts already won: 0 the first, 4 straight to Uathach).
// Gives the sword, marks every lesson done, sets exactly N wins, and clears the tournament's end. Techniques are reset
// to match: the ones taught by the first N students are waiting to be learned (tap their face), unless &taught=1
// gives them to you. Nothing here runs unless the parameter is present.
export function seedTournament(n, taught = false) {
  const wins = Math.max(0, Math.min(OPPONENTS.length, Number.isFinite(n) ? Math.floor(n) : 0))
  for (const note of [SWORD_NOTE, LESSON_DONE, KATA_DONE, DUMMY_DONE, FOOT_DONE, SPAR_DONE]) GameState.addNote(note)
  GameState.removeNote(TOURNEY_DONE)
  OPPONENTS.forEach((o, i) => {
    if (i < wins) GameState.addNote(WON(i)); else GameState.removeNote(WON(i))
    if (o.teach) GameState.removeNote(TECH_NOTE(o.teach))
    if (o.teach === 'strong') GameState.removeNote(STRONG_NOTE)
    if (o.teach && taught && i < wins) { GameState.addNote(TECH_NOTE(o.teach)); if (o.teach === 'strong') GameState.addNote(STRONG_NOTE) }
  })
}

const L = (en, ga = en) => ({ ga, en })
const LINES = {
  open:     L('The tournament. Take your place when you are ready.'),
  callBout: (p, o) => L(`${[p, o].filter(Boolean).join('. ')}. Into the ring.`),      // Uathach, from the dais: your name, then your opponent's
  begin:    L('Begin!'),
  yields:   n => L(`${n} yields. Well fought.`),
  lost:     L('Well tried. Someone else, first.'),
  inRing:   L('In the ring! Keep to the ring.'),
  forfeit:  L('Out of the ring again. That bout is lost.'),
  foeInRing: n => L(`${n}! In the ring!`),
  foeForfeit: n => L(`${n} is out of the ring again. The bout is yours.`),
  uathach:  L('Uathach!'),
  uDraw:    L('No wood, this time. Come.'),
  uAgain:   L('Again.'),
  coin:     L('Keep it. You will do.'),
  done:     L('That is the tournament. The green is yours, whenever you want it.'),
  // a student after the bout, off to the side; then, the lesson heard
  teachCall: L('Walk with me, out past the posts.'),
  taught:    L('Good. Now do it to me.'),
  drillDraw: L('Draw, and salute. Then watch my blade.'),
  drillTip:  L('Wait for it. Tap as it lands.'),
  drillMiss: L('Not before it. Not after. On the beat.'),
  drillGood: [L('There! Hear that?'), L('Again. The same.'), L('Yes.')],
  drillDone: L('That is all of it. Do it to a master.'),
  slamTip:   L('Hold it. Do not tap. Let the ring fill, then let go.'),
  slamGood:  [L('Yes! Up, and round.'), L('Again.'), L('There.')],
  bowIntro:  L('Take it. Pull back, away from the post, and let go.'),
  bowTip:    L('Touch the screen and pull back, away from the post. Further for further. Then let go.'),
  bowGood:   [L('There! Straight in.'), L('Again. The same.'), L('Yes. You have it.')],
  bowMore:   L('Here. More arrows.'),
  spinIntro: L('Hold it. Let the ring fill, then let go.'),
  dashTip:   L('Hold it full, till the ring is white. Then flick the moon, any way you like, through me.'),
  dashGood:  [L('Gone! And I never saw you.'), L('Again. Further.'), L('There.')],
  // Uathach, when you walk into the ring while others are fencing
  intrude:      L('Out! The ring is not a thoroughfare.'),
  intrudeAgain: L('You again. Out.'),
  clearRing:    L('Clear the ring, if you please. They are waiting.'),
  resume:       L('Thank you. Continue.'),
}
// What a student teaches (their face, after the bout). One card per tap, two short sentences at most.
// PLACEHOLDER lines, as above: English in both slots.
const TEACH = {
  strong: { drill: 'spin', cards: [
    L('You saw me go up. It is only a hold, and a leap.'),
    L('Hold the blow. Let the ring fill, then let go.\nUp, round, and down on all beside you.'),
    L('It cannot be turned, and it throws them back.\nBut you are open while you rise. Choose your moment.'),
  ] },
  bow: { drill: 'bow', spot: BOW_SPOT, cards: [
    L('You thought I was a swordswoman. So did they all.'),
    L('A bow is pulled back, away from what you want to hit.\nThe further you pull, the further it flies.'),
    L('Three hits on the post. I will lend you mine.\nAnd when one is shot at you: swing as it arrives, and it is turned aside.'),
  ] },
  dash: { drill: 'dash', cards: [
    L('You saw it. The line, the breath, and I was behind you.'),
    L('Hold the blow to full, then flick the moon any way you like.\nYou are gone, through whoever stands in the line.'),
    L('Stand a moment. Let them know they are cut.\nThen they fall.'),
  ] },
  parry: { drill: 'parry', cards: [
    L('You cut when I was ready.\nSo I turned it, and cut back.'),
    L('Do not cut for him. Meet his blade.\nNot before it comes. Not after.'),
    L('On the beat it rings, and he is open.\nThen cut. He cannot turn that one.'),
  ] },
}
// And the ones with nothing to teach yet still walk out with you and say a word. PLACEHOLDER lines.
const CHAT = {}     // (none now: the ones with nothing to teach do not take you aside)
// said on the way out to the posts, a line or two, so the lesson is already begun when you arrive. PLACEHOLDER lines.
const WALK = {
  ciaran:  [L('Walk with me. Did you see me go up?'), L('Come. I will show you how.')],
  laoise:  [L('Walk with me. Did you see that? Nobody does.'), L('Come. I will show you how.')],
  fial:    [L('Walk with me, a chara.'), L('You never saw me move. I will show you.')],
}
const STUDENT_COLOR = '#d9e6b0'
const WARDEN_COLOR = INK.conall, UATHACH_COLOR = INK.uathach
const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]))

export default class FaicheTournament {
  constructor(scene, { crowd, lesson, grounds }) {
    this.scene = scene; this.crowd = crowd; this.lesson = lesson; this.grounds = grounds
    crowd.mute = true                                                  // the only voice in the tournament is the one from the dais
    this.t = 0
    this.met = new Set()                                               // who has already walked out with you after a bout (a rematch does not again)
    this.queue = []
    this.round = OPPONENTS.filter((_, i) => GameState.hasNote(WON(i))).length      // bouts won
    this.cur = -1; this._chooseNext(false)                             // who is called next (-1: none left, Uathach)
    if (crowd.ring) crowd.ring.r = RING_R                              // a smaller ring for the tournament (the grounds draw the same object)
    this.phase = 'wait'; this.readyAt = 3800                          // the welcome first; then the first call
    this.coin = null
    // the Warden steps out of the fight to referee: a figure of his own
    scene._melee?.destroy()
    scene._melee = new MeleeBout(scene)                                // your sword, no one to fight
    this.ref = { tileX: REF_AT[0], tileY: REF_AT[1], visual: { gid: SKYE_GID.WARDEN, flat: false }, offset: [0, 0], pose: { sx: 1 } }
    const pgr = scene.perspectiveGround
    pgr?.setEncounterFlags([...(pgr._encounterFlags || []), this.ref])
    // the class was cut, so the students have stayed away: they come now
    for (const s of crowd.students) if (s.out) crowd.restore(s)
    // the crowd's grown with every win so far
    for (let i = 0; i < Math.min(this.round, 2); i++) crowd.addStudent()
    grounds.marker = MARK
    // a lesson skipped last time is still waiting on its student
    this.tutor = null; this.les = null
    this.posts = grounds.flags.filter(f => f.prop === 'dummy' && f.dummyIndex === 1); for (const f of this.posts) f.hidden = true     // two posts, wide apart
    this.duel = null; this.intruding = false; this.intrusions = 0; this.inFor = 0; this.outFor = 0; this.duelReadyAt = null; this.cleared = false; this.nagged = false
    OPPONENTS.forEach((o, i) => { if (GameState.hasNote(WON(i)) && o.teach && !hasTechnique(o.teach)) this._setTutor(crowd.byId(o.id), o.teach) })
    this.salute = null; this.outT = 0; this.outs = 0; this.inEpisode = false; this.drums = []
    this._say(LINES.open, 3200)
  }

  // ── lessons ──────────────────────────────────────────────────────────────
  // The student's face carries the lesson's cards (its own place in the conversation, so nothing else is disturbed)
  // until the last one is read. The panel advances a card at a time and wraps to 0 after the last: that wrap is "heard".
  _setTutor(s, tech, def = TEACH[tech]) {                                  // tech null: a word only, nothing to learn
    if (!s?.zone || !def || this.tutor) return
    const key = `${this.scene.getMapKey?.() || 'skye_faiche'}.lesson_${tech || 'chat_' + s.id}`
    const orig = { key: s.zone.getData('stateKey'), dialogues: s.zone.getData('dialogues') }
    s.zone.setData('stateKey', key); s.zone.setData('dialogues', def.cards.map((c, i) => ({ ga: c.ga, en: c.en, continue: i < def.cards.length - 1 })))   // continue: one sitting, a card per swipe
    this.tutor = { s, tech, key, last: GameState.getNPCProgress(key) || 0, orig }
  }
  _pollTutor() {
    const t = this.tutor
    if (!t) return
    const p = GameState.getNPCProgress(t.key) || 0
    if (p < t.last) return this._taught()
    t.last = p
  }
  _taught() {
    const t = this.tutor
    this.tutor = null
    t.s.zone.setData('stateKey', t.orig.key); t.s.zone.setData('dialogues', t.orig.dialogues)
    GameState.setNPCProgress(t.key, 0)
    if (!t.tech) { if (this.les) this._endLesson(); return }           // a word only: back to the crowd
    unlockTechnique(this.scene, t.tech)
    SoundBoard.playWeb('BLADE_KNOCK', this.scene, { hard: 0.05, pitch: 2.2, volume: 0.25 })
    this._sayAs(t.s, LINES.taught)
    if (this.les) this._later(1600, () => this._beginDrill())
  }
  _sayAs(s, line, ms = 2400) {
    const cap = this.scene._caption
    if (cap) { cap.setColor(s.color || STUDENT_COLOR); cap.show(line.ga, line.en, ms) }
  }
  // Who is called next: the first not yet beaten; but after a loss, someone else first (you come back to him when you have learned something)
  _chooseNext(lost) {
    const left = OPPONENTS.map((_, i) => i).filter(i => !GameState.hasNote(WON(i)))
    if (!left.length) { this.cur = -1; return }
    if (lost && left.length > 1) this.cur = left.find(i => i > this.cur) ?? left.find(i => i !== this.cur)
    else this.cur = left[0]
  }
  // a roll on the bodhrán (the inventory's tap, quickening and swelling, then two hard ones): a bout somewhere that is not yours
  _drumroll(ms = 2200) {
    for (const h of this.drums) clearTimeout(h); this.drums = []
    let at = 0, gap = 190
    const tap = (vol, pitch = 1) => SoundBoard.playWeb('INVENTORY_OPEN', this.scene, { volume: vol, pitch })
    while (at < ms) { const k = at / ms, a = at; this.drums.push(setTimeout(() => tap(0.09 + 0.2 * k, 0.9 + Math.random() * 0.3), a)); at += gap; gap = Math.max(60, gap * 0.9) }
    this.drums.push(setTimeout(() => tap(0.42, 0.85), ms + 120), setTimeout(() => tap(0.5, 0.8), ms + 380))
  }
  _championName() { return this.scene.player?.champion?.nameGa || '' }
  _nameOf(s) { return OPPONENTS.find(o => o.id === s.id)?.name || s.id.charAt(0).toUpperCase() + s.id.slice(1) }

  // ── the lesson at the posts ──────────────────────────────────────────────
  // After a bout (or when you next take your place with a lesson waiting) the teacher and you are walked to the
  // posts, the cards open by themselves, and then she drills you: she cuts slowly, you meet it on the beat. Three
  // timed parries and it is yours to use; she walks back to the crowd and the pair she called fence.
  _startLesson(fromBout = false) {
    const t = this.tutor, spot = TEACH[t.tech]?.spot || SPOT
    this.phase = 'lesson'; this.grounds.marker = null
    this.les = { step: fromBout ? 'meet' : 'walk', t0: this.t, s: t.s, spot, tech: t.tech, parried: 0, missed: 0, slams: 0, lastSay: -1e9, prompt: null, lastWalk: this.t, trail: [], said: 0 }
    if (fromBout) t.s.goal = this._meetTile(t.s, this._playerTile()) || [...spot.t]      // from the bout: they come to you in the ring first, say their word, and then you go together
    else t.s.goal = [...spot.t]
    t.s.faceGoal = -1
    // while the lesson is on, they are not offered on the moon (it is a lesson, not a chat): the badge comes back afterwards
    try { this.les.zoneType = t.s.zone.getData('type'); t.s.zone.setData('type', 'lesson_hold'); this.scene._encounterPanel?.clearNotify?.() } catch (_) {}
    if (!this.duel) this._startPair()
  }
  // a free tile beside you, the nearest to them
  _meetTile(s, me) {
    const out = []
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) if (dc || dr) { const c = me[0] + dc, r = me[1] + dr; if (this.crowd._free(c, r, [me], true)) out.push([c, r]) }
    out.sort((a, b) => cheb(a, [s.c, s.r]) - cheb(b, [s.c, s.r]))
    return out[0] || null
  }
  // a tile beside them as they walk: abreast of them (above or below), or just behind that; the nearest to you
  _besideTile(s, me) {
    const ts = this.scene.tileSize, here = [s.c, s.r], out = []
    ;[[0, 1], [0, -1], [-1, 1], [-1, -1], [-1, 0]].forEach(([dc, dr], i) => {
      const c = s.c + dc, r = s.r + dr
      if (!this.scene.isColliding(c * ts + ts / 2, r * ts + ts / 2) && !this.crowd.at(c, r)) out.push([[c, r], cheb([c, r], me) + i * 0.4])
    })
    out.sort((a, b) => a[1] - b[1])
    return out[0] ? out[0][0] : null
  }
  _walkPlayer(tile) {
    const sc = this.scene, me = this._playerTile()
    let path = null
    try { path = sc.pathFinder?.findPath?.(me[0], me[1], tile[0], tile[1]) } catch (_) {}
    if (!path?.length) return false
    try { sc.joystick?.reset?.() } catch (_) {}
    this.scene._melee?.melee?.pa?.stopRoute?.()
    sc.player.setPath(path.map(st => ({ dx: st.dx, dy: st.dy })))
    return true
  }
  _lessonTick() {
    const L = this.les
    if (!L) return
    const s = L.s, pl = this.scene.player, me = this._playerTile(), m = this.scene._melee?.melee
    if (L.step === 'meet') {
      const words = WALK[s.id] || []
      const near = !s.from && cheb([s.c, s.r], me) <= 1
      if (!near && !s.from && s.goal && cheb(s.goal, me) > 1) s.goal = this._meetTile(s, me) || s.goal       // you have moved: they come to where you are now
      if (near && !pl.isMoving && !L.metAt) { L.metAt = this.t; if (words[0]) this._sayAs(s, words[0], 2600); L.said = 1 }
      if ((L.metAt && this.t - L.metAt > 2300) || this.t - L.t0 > 9000) {          // the invitation made: off they go, and you with them
        L.step = 'walk'; L.t0 = this.t; L.lastWalk = this.t; L.said = Math.max(L.said, words.length ? 1 : 0)
        s.goal = [...L.spot.t]; s.faceGoal = -1
      }
      return
    }
    if (L.step === 'walk') {
      const there = s.c === L.spot.t[0] && s.r === L.spot.t[1] && !s.from
      const at = me[0] === L.spot.p[0] && me[1] === L.spot.p[1] && !pl.isMoving
      if (L.trail.length === 0 || L.trail[L.trail.length - 1][0] !== s.c || L.trail[L.trail.length - 1][1] !== s.r) L.trail.push([s.c, s.r])
      const words = WALK[s.id] || []                                  // what she says on the way, one line after another
      if (L.said < words.length && this.t - L.t0 > 700 + L.said * 3200) this._sayAs(s, words[L.said++], 3000)
      if (there && at) { L.step = 'cards'; this.scene._encounterPanel?._openFixedEncounter?.(s.zone); return }     // arrived: the lesson goes on from where it was
      if (this.t - L.t0 > WALK_MAX_MS) {                              // dawdled: set down in place
        const ts = this.scene.tileSize
        s.c = L.spot.t[0]; s.r = L.spot.t[1]; s.from = null
        pl.logicalX = (L.spot.p[0] + 0.5) * ts; pl.logicalY = (L.spot.p[1] + 0.5) * ts; pl.isMoving = false; pl.setPath?.([])
        return
      }
      // side by side: the tile beside them as they go; once they are there, your own place
      const goal = there ? L.spot.p : this._besideTile(s, me)
      if (goal && !at && !pl.isMoving && !(pl.pathQueue?.length) && !(me[0] === goal[0] && me[1] === goal[1]) && this.t - L.lastWalk > 300) { L.lastWalk = this.t; this._walkPlayer(goal) }
    } else if (L.step === 'drill') {
      const dr = TEACH[L.tech]?.drill, el = this.t - L.dt0
      if (this.scene.textPanel?.isVisible || this.scene._encounterPanel?._isOpen) this._closeCards()     // nothing may hold the drill in "conversation"
      if (dr === 'bow') this._bowDrillTick(L, m)
      else {
        if (dr === 'spin') this._stepBack(L, me, m)
        // the blade comes out by itself; only if it will not is the moon asked to
        if (m && !m.enGarde && el > 800 && this.t > (L.drawTry || 0)) { L.drawTry = this.t + 1000; this.scene._melee?.swipeVertical?.('up') }
        const want = m && !m.enGarde && el > 4500 ? 'up' : null
        if (want !== L.prompt) { L.prompt = want; this.scene.moonPrompt?.(want) }
        if (['spin', 'slam', 'dash'].includes(dr) && m?.enGarde && this.t - L.lastSay > 14000) { L.lastSay = this.t; this._sayAs(s, dr === 'dash' ? LINES.dashTip : LINES.slamTip, 3600) }     // nothing yet: how
      }
      if (this.t - L.dt0 > DRILL_MAX_MS) this._drillWon(true)
    }
  }
  // the archery lesson: the bow is lent, the post is hers to shoot at; three arrows in it and it is yours (the old bow tutorial's pull-back, in the faiche)
  _bowDrillTick(L, m) {
    const sc = this.scene, bm = sc.bowMechanics
    if (!bm) return
    if (!bm.hasArrows()) {                                              // more, without asking
      if (!L.dry) L.dry = this.t
      if (this.t - L.dry > 1500) { L.dry = 0; this._giveArrows(); this._sayAs(L.s, LINES.bowMore, 1800) }
    }
    const post = this.grounds.dummies[BOW_SPOT.post], ts = sc.tileSize
    const hit = post && bm.checkHit({ logicalX: (post.x + 0.5) * ts, logicalY: (post.y + 0.5) * ts }, ts * 1.15)
    if (hit) {
      L.slams++; this.grounds.hitDummy(BOW_SPOT.post, 1); L.lastSay = this.t
      if (L.slams >= DRILL_WIN) return this._drillWon()
      this._sayAs(L.s, LINES.bowGood[L.slams - 1] || LINES.bowGood[0], 1600)
    } else if (this.t - L.lastSay > 12000) { L.lastSay = this.t; this._sayAs(L.s, LINES.bowTip, 3800) }
  }
  // he is not struck by your spin and does not stand in it: while you gather it or are in the air he steps out of reach, and comes back after
  _stepBack(L, me, m) {
    const s = L.s
    const spinning = !!m && (!!m.charge || (!!m.swing && m.swing.air && m.swing.charged))
    if (spinning) {
      L.calmAt = this.t + 1800
      if (!L.back && !s.from && cheb([s.c, s.r], me) <= 2) {
        let best = null
        for (let dc = -4; dc <= 4; dc++) for (let dr2 = -4; dr2 <= 4; dr2++) {
          const c = s.c + dc, r = s.r + dr2
          if (cheb([c, r], me) < 3 || !this.crowd._free(c, r, [me], true)) continue
          const sc = Math.max(Math.abs(dc), Math.abs(dr2))
          if (!best || sc < best[1]) best = [[c, r], sc]
        }
        if (best) { L.back = best[0]; s.goal = [...best[0]]; s.faceGoal = -1 }
      }
    } else if (L.back && this.t > (L.calmAt || 0)) { L.back = null; s.goal = [...L.spot.t]; s.faceGoal = -1 }
  }
  _giveArrows() {
    const inv = this.scene.player?.inventory; if (!inv) return
    for (let i = 0; i < inv.totalSlots; i++) { const it = inv.getItem(i); if (it?.id === 'training_arrows') { it.quantity = Math.max(it.quantity, 12); return } }
    inv.addItem(createItem('training_arrows', 12))
  }
  // the bow is lent for the lesson: it takes your sword's place, and the sword comes back after
  _lendBow() {
    const inv = this.scene.player?.inventory; if (!inv) return
    const hand = inv.equipSlots.rightHand
    this.lent = { sword: inv.getItem(hand), bowSlot: null }
    inv.setItem(hand, createItem('simple_bow'))
    this._giveArrows()
    this.scene.player.updateStatsFromEquipment?.()
    if (this.scene.bowMechanics) { this.scene.bowMechanics.disabled = false; this.scene.bowMechanics.maxDistance = BOW_RANGE_TILES * this.scene.tileSize }
  }
  _returnBow() {
    const L = this.lent; this.lent = null
    const inv = this.scene.player?.inventory
    this.scene.bowMechanics?.cancelAiming?.()
    if (!L || !inv) return
    inv.setItem(inv.equipSlots.rightHand, L.sword || null)
    const keep = hasTechnique('bow')                                   // taught: the bow stays in your pack (not in your hand), and the arrows
    for (let i = 0; i < inv.totalSlots; i++) { const it = inv.getItem(i); if (it && (it.subtype === 'arrow' || it.id === 'simple_bow') && i !== inv.equipSlots.rightHand && !keep) inv.removeItem(i) }
    if (keep && !inv.slots.some(it => it?.id === 'simple_bow')) inv.addItem(createItem('simple_bow'))
    this.scene.player?.updateStatsFromEquipment?.()
  }
  // his last card can still be up when the drill begins, and a card up means "in conversation": no blade. Close it.
  _closeCards() {
    const sc = this.scene
    try { if (sc.textPanel?.isVisible) sc.textPanel.hide() } catch (_) {}
    try { if (sc._encounterPanel?._isOpen) sc._encounterPanel._onPanelClosed() } catch (_) {}
    sc._keepBladeInTalk = false
  }
  _beginDrill() {
    const L = this.les
    if (!L || L.step === 'drill' || L.step === 'done') return
    const s = L.s, dr = TEACH[L.tech]?.drill
    L.step = 'drill'; L.dt0 = this.t
    this._closeCards()
    this.scene._melee?.destroy()
    if (dr === 'bow') {                                                  // she hands you a bow; the post is ahead of you, to the north
      this.scene._melee = new MeleeBout(this.scene)
      this._lendBow()
      this._later(900, () => this._sayAs(s, LINES.bowIntro, 3200))
      return
    }
    if (dr === 'spin') {                                                 // nobody to throw: the spin is as clear in the air. Three, and it is yours.
      this.scene._melee = new MeleeBout(this.scene)
      this.scene._melee.melee.stay = true                                // you stay where you are for it (no wandering off)
      this._later(900, () => this._sayAs(s, LINES.spinIntro, 3000))
      return
    }
    this.crowd.withdraw(s)                                              // the bout draws her now
    const slam = dr === 'dash'                                           // (a drill with a dummy that waits)
    const F = slam
      ? { ...PRESETS.novice, hp: 99, dmg: 0, keepBout: true, reminders: 0, reads: false, steady: false, windMs: 1e9, counterWind0: 1e9, counterWindMin: 1e9, followWind: 1e9,
          rushWind: 1e9, recoverMs: 500, staggerMs: 300, restMin: 300, restMax: 500, parryBase: 0, parryReel0: 0, parryReelStep: 0, parryMax: 0 }     // he stands and waits; you hold, and bring it down on him
      : { ...PRESETS.warden, hp: 99, dmg: 0, steady: true, keepBout: true, reminders: 0, reads: false,
          windMs: 950, counterWind0: 950, counterWindMin: 850, counterWindStep: 15, recoverMs: 900, restMin: 1200, restMax: 1800,
          parryBase: 0, parryReel0: 0, parryReelStep: 0, parryMax: 0 }   // she only cuts, slowly, and turns nothing; it cannot hurt
    const b = this.scene._melee = new MeleeBout(this.scene, { kind: 'warden', F, home: [...L.spot.t], gid: s.gid || SKYE_GID.WARDEN, voice: s.voice || 'dallan' })
    b.melee.foe.c = L.spot.t[0]; b.melee.foe.r = L.spot.t[1]
    this._later(900, () => this._sayAs(s, LINES.drillDraw, 3000))
  }
  _drillEvent(name, d) {
    const L = this.les
    if (L.step !== 'drill') return
    if (TEACH[L.tech]?.drill === 'bow') return                          // (counted by the post: _bowDrillTick)
    if (TEACH[L.tech]?.drill === 'spin') {
      if (name === 'swing' && d.charged) {
        L.slams++
        if (L.slams >= DRILL_WIN) return this._drillWon()
        this._sayAs(L.s, LINES.slamGood[L.slams - 1] || LINES.slamGood[0], 1500); L.lastSay = this.t
      }
      return
    }
    if (TEACH[L.tech]?.drill === 'dash') {
      if (name === 'dashCut' && d.foes?.length) {
        L.slams++
        if (L.slams >= DRILL_WIN) return this._drillWon()
        this._sayAs(L.s, LINES.dashGood[L.slams - 1] || LINES.dashGood[0], 1700); L.lastSay = this.t
      }
      return
    }
    if (TEACH[L.tech]?.drill === 'slam') {
      if (name === 'knockdown' && d.who === 'foe' && !d.final) {
        L.slams++
        if (L.slams >= DRILL_WIN) return this._drillWon()
        this._sayAs(L.s, LINES.slamGood[L.slams - 1] || LINES.slamGood[0], 1500); L.lastSay = this.t
      }
      return
    }
    if (name === 'parried' && d.by === 'player' && d.timed) {
      L.parried++
      if (L.parried >= DRILL_WIN) return this._drillWon()
      this._sayAs(L.s, LINES.drillGood[L.parried - 1] || LINES.drillGood[0], 1500); L.lastSay = this.t
    } else if ((name === 'hit' && d.on === 'player') || name === 'clash') {
      L.missed++
      if (this.t - L.lastSay > 3500) { L.lastSay = this.t; this._sayAs(L.s, L.missed % 2 ? LINES.drillTip : LINES.drillMiss, 2600) }
    }
  }
  _drillWon(quiet = false) {
    const L = this.les
    if (!L || L.step === 'done') return
    L.step = 'done'
    this.scene.moonPrompt?.(null)
    if (!quiet) SoundBoard.playWeb('BLADE_KNOCK', this.scene, { hard: 0.05, pitch: 2.2, volume: 0.25 })
    this._sayAs(L.s, LINES.drillDone, 2800)
    this._later(2800, () => this._endLesson())
  }
  // they walk back to the crowd; the pair, if they are waiting, fence; then you are called
  _endLesson() {
    const L = this.les
    if (!L) return
    this.scene._melee?.destroy()
    this.scene._melee = new MeleeBout(this.scene)
    this._returnBow()
    try { if (L.zoneType !== undefined) L.s.zone.setData('type', L.zoneType) } catch (_) {}      // they are offered on the moon again: to stay and chat
    this.crowd.restore(L.s, L.spot.t); L.s.goal = null
    this._heal()
    this.les = null
    if (this.duel) this.phase = 'rest'
    else { this.grounds.marker = MARK; this.phase = 'wait'; this.readyAt = this.t + 800 }
  }

  // ── the ring is busy ─────────────────────────────────────────────────────
  // Two students are fencing in it, so walking in is a faux pas: they stop where they are, the crowd jeers, Uathach says
  // so, and it all waits until you are out again.
  _inArena() {
    const [c, r] = this._playerTile(), g = this.crowd.ring
    return Math.hypot(c + 0.5 - g.cx, r + 0.5 - g.cy) < g.r - ARENA_INSET
  }
  _watchRing(dt) {
    const d = this.duel, step = Math.min(50, dt)
    if (this._inArena()) { this.outFor = 0; this.inFor += step } else { this.inFor = 0; this.outFor += step }
    if (!this.cleared) {                                      // still standing where the last bout ended: that is no insult, only make way
      if (this.outFor > 400) this.cleared = true
      else { if (d.ready && !this.nagged && this.t - this.duelReadyAt > 3500) { this.nagged = true; this._say(LINES.clearRing, 2600, 'uathach') } return }
    }
    if (!this.intruding && this.inFor > 500) {
      this.intruding = true; d.paused = true; this.intrusions++
      this.crowd.jeer()
      this._say(this.intrusions > 1 ? LINES.intrudeAgain : LINES.intrude, 2600, 'uathach')
    } else if (this.intruding && this.outFor > 700) {
      this.intruding = false; d.paused = false
      this._say(LINES.resume, 1400, 'uathach')
    }
  }
  // two students who are not yours to fight and not busy: the ones who are not in a lesson or next in line come first
  _pickPair() {
    const next = OPPONENTS[this.cur]
    const ok = s => s && !s.out && !s.flee && !s.goal && s !== this.tutor?.s && s.id !== next?.id
    const isOpp = s => OPPONENTS.some(o => o.id === s.id)
    const free = this.crowd.students.filter(ok)
    return [...free.filter(s => !isOpp(s)), ...free.filter(isOpp)].slice(0, 2)
  }
  _startPair() {
    const [a, b] = this._pickPair()
    if (!a || !b) return false
    this.inFor = this.outFor = 0; this.intruding = false; this.intrusions = 0; this.duelReadyAt = null; this.cleared = false; this.nagged = false
    this._later(2600, () => {
      this._drumroll()
      this.duel = new StagedDuel(this.scene, this.crowd, a, b, this.home, { onDone: () => this._endRest() })
    })
    return true
  }
  _endRest() {                                    // the pair are done: your turn when you are ready
    this.duel = null; this.intruding = false
    if (this.les) return                                          // still at the posts: the lesson sets the table when it ends
    this.grounds.marker = MARK
    this.phase = 'wait'; this.readyAt = this.t + 800
  }

  // ── speech ───────────────────────────────────────────────────────────────
  _say(line, ms = 2400, who = 'warden') {
    const cap = this.scene._caption
    if (cap) { cap.setColor(who === 'uathach' ? UATHACH_COLOR : WARDEN_COLOR); cap.show(line.ga, line.en, ms) }
    // one voice for every announcement (the colour of the caption says who speaks)
    if (!this.voices) this.voices = {}
    if (!this.voices.herald) { const ac = SoundBoard.ctx(this.scene); this.voices.herald = ac ? new VoiceSynth({ audioContext: ac, volume: 0.55 }) : null }
    try { this.voices.herald?.stop(); this.voices.herald?.speak(line.ga, { voice: 'peig', tuneKey: 'Dmix' }) } catch (_) {}
  }
  _later(ms, fn) { this.queue.push({ at: this.t + ms, fn }) }
  _playerTile() { const p = this.scene.player, ts = this.scene.tileSize; return [Math.floor(p.logicalX / ts), Math.floor(p.logicalY / ts)] }
  _onMark() { const [c, r] = this._playerTile(); return c === MARK[0] && r === MARK[1] && !this.scene.player.isMoving }
  _heal() { const p = this.scene.player; if (p) p.heal(p.maxHP) }
  get home() { return [...this.scene._wardenHome] }

  // ── the frame ────────────────────────────────────────────────────────────
  update(dt) {
    this.t += Math.min(50, dt)
    for (const q of this.queue.slice()) if (this.t >= q.at) { this.queue.splice(this.queue.indexOf(q), 1); q.fn() }
    this._pollTutor()
    this._lessonTick()
    if (this.duel) {
      const d = this.duel
      this._watchRing(dt)
      if (d.ready && this.duelReadyAt == null) this.duelReadyAt = this.t
      // they fence once the ring is clear and your lesson is heard (or you have kept them waiting long enough)
      if (d.ready && !d.released && !this.intruding && this.cleared && ((!this.tutor && !this.les) || this.t - this.duelReadyAt >= DUEL_WAIT_MS)) d.release()
      d.update(dt)
    }
    if (this.phase === 'wait' && this.t > (this.readyAt || 0)) this._callPlayer()
    if (this.phase === 'called' && this._onMark()) this._next()               // called first; then you step onto your tile
    if (this.phase === 'bout') { this._foeWalkIn(); this._autoDraw(); this._ringRule(dt) }
    this._boutBow()
    if (this.phase === 'after') this._saluteTick()
    if (this.phase === 'uWalk') this._uathachArrives()
  }

  // ── a bout ───────────────────────────────────────────────────────────────
  // Uathach calls you (and who you will face), and your tile lights: you step onto it and the bout begins
  _callPlayer() {
    if (this.tutor && !this.les) return this._startLesson()          // a lesson skipped last time comes first
    this.phase = 'called'; this.grounds.marker = MARK
    if (this.cur < 0) return                                         // the last: Uathach herself, when you take your place
    this._say(LINES.callBout(this._championName(), OPPONENTS[this.cur].name), 2800, 'uathach')
  }
  _next() {
    if (this.cur < 0) return this._callUathach()
    const o = OPPONENTS[this.cur], s = this.crowd.byId(o.id)
    this.duel?.abort(); this.duel = null
    this.phase = 'bout'
    this.grounds.marker = null
    this.outT = 0; this.outs = 0; this.inEpisode = false; this.foeOutT = 0; this.foeOuts = 0; this.foeIn = false
    // they come out of the crowd and start outside the ring at the north: they walk in to their guard, and you go in to meet them (draw, and salute)
    if (s) this.crowd.withdraw(s)
    this.scene._melee?.destroy()
    const F = o.F ? { ...PRESETS[o.kind], ...o.F } : null
    const b = this.scene._melee = new MeleeBout(this.scene, { kind: o.kind, F, home: [...FOE_HOME], gid: s?.gid || SKYE_GID.WARDEN, voice: s?.voice || 'dallan' })
    b.melee.foe.c = FOE_START[0]; b.melee.foe.r = FOE_START[1]
    this.opp = { o, s, guarded: false, stepAt: this.t + 1500 }
  }
  // you do not have to remember the blade: in the ring, with them on guard, it comes out by itself (and the salute and the rest follow)
  // your bow in a bout, once Laoise has taught it: slung on your back with the sword in hand, an arrow that lands on his tile is his to answer
  _boutBow() {
    const sc = this.scene, bm = sc.bowMechanics, m = sc._melee?.melee
    if (!bm) return
    const live = this.phase === 'bout' && !this.les && !!m?.combat && !m.bout.over && hasTechnique('bow')
    if (live !== !!bm.slung) {
      bm.slung = live
      if (live) { this._bmWas = { disabled: bm.disabled, max: bm.maxDistance }; bm.disabled = false; bm.maxDistance = BOW_RANGE_TILES * sc.tileSize }
      else if (this._bmWas && !this.lent) { bm.disabled = this._bmWas.disabled; bm.maxDistance = this._bmWas.max; this._bmWas = null }
    }
    if (!live || !bm.arrows.length) return
    const f = m.foe, ts = sc.tileSize
    const hit = bm.checkHit({ logicalX: (f.c + 0.5) * ts, logicalY: (f.r + 0.5) * ts }, ts * 0.8)
    if (!hit) return
    const r = m.playerArrowStrikes()
    if (r === 'turned') arrowSpinAway(sc, hit.landScreenX ?? hit.arrow.getData('prevScreenX'), hit.landScreenY ?? hit.arrow.getData('prevScreenY'))
    bm._destroyArrow(hit.arrow)
  }
  _autoDraw() {
    const O = this.opp, b = this.scene._melee, m = b?.melee
    if (!O || !m || m.enGarde || m.combat || m.bout.over || this.t < (this._drawAt || 0)) return
    const f = m.foe; if (f.from || cheb([f.c, f.r], FOE_HOME) > 1) return                              // he is in, and standing
    if (!this._inArena() || this.scene.textPanel?.isVisible || this.scene._encounterPanel?._isOpen) return
    this._drawAt = this.t + 1200
    b.swipeVertical('up')
  }
  // he walks in from outside the ring to his guard tile, before the bout (his steps are the engine's own)
  _foeWalkIn() {
    const O = this.opp, m = this.scene._melee?.melee
    if (!O || O.guarded || !m || m.combat || this.t < O.stepAt) return
    const f = m.foe
    if ((f.c === FOE_GUARD[0] && f.r === FOE_GUARD[1]) || (f.c === FOE_HOME[0] && f.r === FOE_HOME[1])) { O.guarded = true; return }     // (the engine settles him on his home tile when nobody is fighting: stop walking him past it, or he steps and is pulled back)
    if (f.from && this.t - f.t0 < f.ms) return
    m._foeStepTo(f.c + Math.sign(FOE_GUARD[0] - f.c), f.r + Math.sign(FOE_GUARD[1] - f.r), 380)
    O.stepAt = this.t + 430
  }
  // Stay in the ring while you fight: leave it and the bout holds and Uathach calls you in; leave it again (or stay out) and it is lost
  _ringRule(dt) {
    const m = this.scene._melee?.melee
    if (this.phase !== 'bout' || !m?.combat) { this.outT = 0; this.inEpisode = false; this.foeOutT = 0; this.foeIn = false; return }
    const [c, r] = this._playerTile(), g = this.crowd.ring
    this._foeRingRule(m, g, dt)
    const out = Math.hypot(c + 0.5 - g.cx, r + 0.5 - g.cy) > g.r + 0.9
    if (!out) { this.outT = 0; this.inEpisode = false; return }
    this.outT += Math.min(50, dt)
    if (this.outT < OUT_WARN_MS) return
    m.hitStop = Math.max(m.hitStop, 80)                               // the bout holds while you are out
    if (!this.inEpisode) {
      this.inEpisode = true; this.outs++
      if (this.outs > 1) { this._say(LINES.forfeit, 2600, 'uathach'); this.crowd.jeer(); m._playerYields('Ghéill tú', 'You left the ring', false); return }
      this._say(LINES.inRing, 2400, 'uathach')
    } else if (this.outT > OUT_FORFEIT_MS) { this._say(LINES.forfeit, 2600, 'uathach'); m._playerYields('Ghéill tú', 'You left the ring', false) }
  }

  // The same rule for him: pushed or thrown out of the ring he walks back in at once; if he is still out, he is called in once, and the second time (or if he stays out) the bout is yours
  _foeRingRule(m, g, dt) {
    const f = m.foe, down = ['down', 'beaten', 'stagger', 'reel'].includes(f.state)
    const out = f.hp > 0 && Math.hypot(f.c + 0.5 - g.cx, f.r + 0.5 - g.cy) > g.r + 0.9
    if (!out) { this.foeOutT = 0; this.foeIn = false; return }
    if (['idle', 'approach', 'rest'].includes(f.state) && !f.from) m._foeStepTo(f.c + Math.sign(Math.floor(g.cx) - f.c), f.r + Math.sign(Math.floor(g.cy) - f.r), 330)     // he walks back in
    if (down) return                                                  // (not while he is on the ground)
    this.foeOutT = (this.foeOutT || 0) + Math.min(50, dt)
    const name = OPPONENTS[this.cur]?.name || ''
    if (this.foeOutT < OUT_WARN_MS) return
    if (!this.foeIn) {
      this.foeIn = true; this.foeOuts = (this.foeOuts || 0) + 1
      if (this.foeOuts > 1) { this._say(LINES.foeForfeit(name), 2600, 'uathach'); this.crowd.jeer(); m._foeYields(); return }
      this._say(LINES.foeInRing(name), 2400, 'uathach')
    } else if (this.foeOutT > OUT_FORFEIT_MS) { this._say(LINES.foeForfeit(name), 2600, 'uathach'); m._foeYields() }
  }

  onMeleeEvent(name, d = {}) {
    if (this.les) this._drillEvent(name, d)
    if (name === 'boutStart' && this.phase === 'bout') this._later(2600, () => { if (this.phase === 'bout') this._say(LINES.begin, 1200) })
    if (name === 'salute' && d.by === 'player' && this.salute && !this.salute.answered && this.t - this.salute.t0 > 2600) { this.salute.answered = true; this.salute.answeredAt = this.t; this.salute.offered = true }
    if (name === 'boutOver' && this.phase === 'bout') this._boutOver(!!d.won)
    if (name === 'thrownOut' && this.phase === 'uFight') this._thrown()
    if (name === 'boutOver' && this.phase === 'uFight') this._later(2800, () => { if (!this.thrownDone) this._say(LINES.uAgain, 1600, 'uathach') })
  }

  // The bout is over. Blades stay out: after a moment he offers a salute (or answers yours, if you give it first); you have a
  // while to return it, then you sheathe, and they walk out with you.
  _boutOver(won) {
    this.phase = 'after'
    const { o, s } = this.opp
    if (won) {
      GameState.addNote(WON(this.cur))
      this._later(1800, () => this._say(LINES.yields(o.name), 2400))
      this.round++
    } else this._later(2200, () => this._say(LINES.lost, 2400))
    const m = this.scene._melee?.melee
    if (m) m.returnsSalute = true
    this.salute = { t0: this.t, offered: false, answered: false, won, o, s }
    this._chooseNext(!won)
  }
  _saluteTick() {
    const S = this.salute, m = this.scene._melee?.melee
    if (!S || !m) return
    const el = this.t - S.t0
    if (!S.offered && el > SALUTE_OFFER_MS && !m.combat && (m.offerSalute?.() !== false || el > SALUTE_OFFER_MS + 9000)) { S.offered = true; S.offerAt = this.t }       // (an archer is fetching her sword first: the offer waits for her)
    // you return it without having to: the salute, and then the blade goes away (_afterSalute)
    if (S.offered && !S.answered && this.t - S.offerAt > 900) {
      if (!m.enGarde) { S.answered = true; S.answeredAt = this.t }
      else m.salute()                                                  // (the 'salute' event marks it answered; if you cannot yet, it tries again)
    }
    if (S.answered ? this.t - S.answeredAt > SALUTE_DONE_MS : (S.offered && this.t - S.offerAt > SALUTE_WAIT_MS)) this._afterSalute()
  }
  _afterSalute() {
    const { o, s, won } = this.salute
    this.salute = null
    const m = this.scene._melee?.melee
    if (m?.enGarde) m.setEnGarde(false)                                // blades away
    this._later(700, () => {
      this._heal()
      const at = this.scene._melee?.melee?.foe
      if (s) this.crowd.restore(s, at ? [at.c, at.r] : s.home)
      const teach = !!(s && o.teach && !hasTechnique(o.teach))
      const lesson = !!(s && !this.tutor && (teach || (CHAT[o.id] && !this.met.has(o.id))))     // (a rematch: no second walk to the posts, only a lesson not yet learned)
      if (s) this.met.add(o.id)
      if (lesson) teach ? this._setTutor(s, o.teach) : this._setTutor(s, null, CHAT[o.id])     // win or lose: they walk out with you, to show you something or to say a word
      this.scene._melee?.destroy()
      this.scene._melee = new MeleeBout(this.scene)
      if (won && this.round <= 2) this.crowd.addStudent()
      if (lesson) { this._startLesson(true); return }                      // to the posts together; two others are called in meanwhile
      this.grounds.marker = MARK
      this.phase = 'wait'
      this.readyAt = this.t + 800
    })
  }

  // ── Uathach ──────────────────────────────────────────────────────────────
  _callUathach() {
    this.phase = 'uWalk'
    this.grounds.marker = null
    this._say(LINES.uathach, 2000)
    const u = this.lesson.u
    u.path = U_DOWN.slice()
  }

  _uathachArrives() {
    const u = this.lesson.u
    if (u.path.length || u.from) return
    this.phase = 'uFight'
    this.thrownDone = false
    u.flag.hidden = true
    this.scene._melee?.destroy()
    const b = this.scene._melee = new MeleeBout(this.scene, { kind: 'uathach', home: this.home, gid: SKYE_GID.UATHACH, voice: 'seanchai' })
    b.melee.foe.c = u.c; b.melee.foe.r = u.r
    this._say(LINES.uDraw, 2400, 'uathach')
  }

  // the third throw: a salute (the bout's end), her sword away, and a coin
  _thrown() {
    this.thrownDone = true
    this.phase = 'coin'
    this._later(4400, () => {
      const b = this.scene._melee
      const from = b?.view?.foeFigure?.(), to = b?.view?.playerFigure?.()
      this.coin = { t0: performance.now(), from, to }
      SoundBoard.playWeb('SWORD_SWISH', this.scene, { pitch: 2.2, dur: 0.1, volume: 0.08 })
    })
    this._later(4400 + COIN_MS, () => {
      SoundBoard.playWeb('BLADE_KNOCK', this.scene, { hard: 0.05, pitch: 2.6, volume: 0.35 })
      this._later(120, () => SoundBoard.playWeb('BLADE_KNOCK', this.scene, { hard: 0.03, pitch: 2.9, volume: 0.2 }))
      this.coin = null
      GameState.addNote('brooch_silver')
      this.scene.joystick?.setMetal?.('silver')
      SoundBoard.playWeb('CROWD_CLAP', this.scene, { n: this.crowd.students.length, dur: 2.6, warmth: 1 })
      this._say(LINES.coin, 2600, 'uathach')
    })
    this._later(4400 + COIN_MS + 3400, () => this._finish())
  }

  _finish() {
    GameState.addNote(TOURNEY_DONE)
    this.phase = 'done'
    // she goes back up; the Warden is a sparring partner again
    const u = this.lesson.u, f = this.scene._melee?.melee?.foe
    if (f) { u.c = f.c; u.r = f.r }
    u.flag.hidden = false
    u.path = U_UP.slice()
    this.scene._melee?.destroy()
    this.scene._melee = new MeleeBout(this.scene, { kind: 'warden', home: this.home, gid: SKYE_GID.WARDEN })
    this.scene._melee.melee.foe.c = REF_AT[0]; this.scene._melee.melee.foe.r = REF_AT[1]
    const pgr = this.scene.perspectiveGround
    if (pgr?._encounterFlags) pgr.setEncounterFlags(pgr._encounterFlags.filter(fl => fl !== this.ref))
    this._later(2000, () => this._say(LINES.done, 3200))
    this._later(6200, () => this.scene.startBattlement?.())
  }

  // ── drawing ──────────────────────────────────────────────────────────────
  // the coin, tossed: a little gold disc turning over in the air
  draw(ctx) {
    const c = this.coin
    if (!c?.from || !c?.to) return
    const k = Math.min(1, (performance.now() - c.t0) / COIN_MS)
    const x = c.from.x + (c.to.x - c.from.x) * k
    const y = c.from.y - c.from.h * 0.6 + (c.to.y - c.to.h * 0.5 - (c.from.y - c.from.h * 0.6)) * k - Math.sin(Math.PI * k) * c.from.h * 1.6
    const r = Math.max(3, c.from.w * 0.09), turn = Math.abs(Math.cos(k * Math.PI * 7))
    ctx.save()
    ctx.fillStyle = '#e8c45a'; ctx.strokeStyle = '#8a6a1c'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.ellipse(x, y, r * Math.max(0.15, turn), r, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.globalAlpha = 0.6 * turn; ctx.fillStyle = '#fff6d0'
    ctx.beginPath(); ctx.ellipse(x - r * 0.25 * turn, y - r * 0.3, r * 0.25 * turn, r * 0.25, 0, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  destroy() {
    this.duel?.abort()
    this._returnBow()
    for (const h of this.drums || []) clearTimeout(h)
    for (const f of this.posts || []) f.hidden = false
    this.scene.moonPrompt?.(null)
    const pgr = this.scene.perspectiveGround
    if (pgr?._encounterFlags) pgr.setEncounterFlags(pgr._encounterFlags.filter(fl => fl !== this.ref))
    for (const v of Object.values(this.voices || {})) { try { v?.stop() } catch (_) {} }
  }
}

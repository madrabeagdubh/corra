// tavern.js
// Location: js/game/scenes/locations/village/tavern.js

import VillageScene from '../villageScene.js'
import { HarpPhrasePlayer, buildTimedPhraseFromDurations } from '../../../systems/music/harpPhrasePlayer.js'
import { abcToTimedStringSequence } from '../../../systems/music/abcToPhrase.js'
import { allTunes } from '../../../systems/music/allTunes.js'

export default class TavernScene extends VillageScene {
  constructor() { super({ key: 'tavern' }) }

  getMapKey()      { return 'tavern' }
  getAmbient()     { return 0x1a0e08 }
  getPlayerLight() { return { color: 0xffcc88, intensity: 2.2, radius: 280 } }
  getMusicTrack()  { return 'village_slow' }

  getWisps() {
    return [
      { rx: 6/20, ry: 1/12, color: 0xff6622, intensity: 1.8, radius: 220 }
    ]
  }

  onEnter() {
    this.time.delayedCall(800, () => {
      this.textPanel?.show({
        ga: 'Tá teas ann. Tá fuaim ann. Tá daoine ann.',
        en: 'There is warmth. There is sound. There are people.',
        type: 'notification',
      })
    })
  }

  _onJoystickTap() {
    const now = Date.now()
    if (now - (this._lastJoyTap || 0) < 700) return
    this._lastJoyTap = now

    const card = this._encounterPanel?._card
    if (card?._isHarp) {
      this._encounterPanel.clearNotify()
      this._openHarpOverlay()
      return
    }

    super._onJoystickTap()
  }

  // ── Override: hook the phrase player onto the harp once it's open ──────
  _openHarpOverlay() {
    super._openHarpOverlay()
    this._corraHarp?.on('ready', () => this._startTainPhrase())
  }

  // ── TEST: play a full tune, missile-command style ─────────────────────
  // The whole tune is scheduled up front on a master clock. Orbs launch
  // and arrive at a centred hit-line at the tune's actual rhythm. Missing
  // a note doesn't stop anything — the tune just keeps playing, like a
  // real tune would.
  //
  // Two test tunes are available:
  //   - South Wind, The   — Gmaj, no accidentals at all.
  //   - Silver Spear, The — Dmaj, every F needs to sound as F#, and
  //                          nothing else in the tune needs an accidental
  //                          (verified by inspection — no C/c appears in
  //                          its body at all). Sharps are automatic now
  //                          (see corraHarp.js / harpPhrasePlayer.js), so
  //                          this just plays correctly with no player
  //                          toggle to manage.
  // Swap TUNE_KEY below to switch which one plays.
  _startTainPhrase() {
    const harp = this._corraHarp
    if (!harp) return

    const TUNE_KEY = 'silverSpearThe'   // or 'southWindThe'

    const range = harp.getMidiRange()
    const { indices, durations, sharps } = abcToTimedStringSequence(
      allTunes[TUNE_KEY], harp, range
    )

    console.log('[TavernScene] phrase —', TUNE_KEY, 'note count:', indices.length)
    console.log('[TavernScene] string indices:', indices)
    console.log('[TavernScene] durations:', durations)
    console.log('[TavernScene] sharps:', sharps)

    const unitMs = 300  // slower tempo to start — easier to track
    const phrase = buildTimedPhraseFromDurations(indices, durations, {
      unitMs,
      travelMs:     1800,  // how long each orb takes to fly in (readability)
      windowMs:     420,   // forgiveness window around exact arrival
      startDelayMs: 1200,  // grace period before first orb arrives
      sharps,
    })

    this._phrasePlayer = new HarpPhrasePlayer(harp, phrase, {
      hitLineFrac: 0.5,   // centre of screen
      // Bodhrán click every quarter-note-equivalent (4 ABC duration-units
      // at L:1/8 is one quarter note) — gives a steady felt pulse under
      // the tune, independent of the note orbs themselves.
      bodhranBeatMs: unitMs * 4,
      bodhranAccentEvery: 3,  // both test tunes are 3/4 waltzes — accent every 3rd click
      onBeatResult: (i, { hit, accuracy }) => {
        console.log(`[Táin] beat ${i}: ${hit ? 'hit' : 'missed'}`, accuracy?.toFixed?.(2))
      },
      onPhraseComplete: (tally) => {
        console.log('[Táin] phrase complete — tally:', tally)
        this.textPanel?.show({
          ga: 'Tá an scéal críochnaithe.',
          en: 'The tale is finished.',
          type: 'notification',
        })
      },
    })
    this._phrasePlayer.start()
  }

  _destroyHarpOverlay() {
    this._phrasePlayer?.stop()
    this._phrasePlayer = null
    super._destroyHarpOverlay()
  }
}


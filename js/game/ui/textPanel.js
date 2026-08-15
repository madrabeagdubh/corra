/**
 * TextPanel -- Bilingual scrolling text panel for Fenians.baby
 *
 * Panel types:
 *   dialogue        -- scrolls, holds at top for HOLD_MS, then auto-dismisses
 *   examine         -- scrolls, holds at top INDEFINITELY, dismisses only on swipe-up
 *   notification    -- short auto-dismiss banner
 *   chat_options    -- legacy buttons panel (kept for back-compat)
 *   archery_prompt  -- top banner, persistent
 *   encounter_card  -- card layout: bg image, graphic banner, scrollable bilingual
 *                      body, docked single-language buttons. Used by EncounterPanel.
 */

import Phaser from 'phaser'
import { GameSettings } from '../settings/gameSettings.js'
import { DialogueHarp } from '../systems/music/dialogueHarp.js'
import { Bodhran }      from '../systems/music/bodhran.js'

// A line made only of dots is SILENCE, not speech. The card still holds its
// beat -- the pause is the point -- but no harp fragment is played over it.
// Without this, "..." scores three characters, reads as speech to the harp
// scheduler, and gets a phrase of the champion's theme laid over a character
// who is pointedly refusing to answer.
//
// Matches "...", "…", ". . ." in either language. The empty string matches
// too, which is what lets a row with Irish still blank count as silent when
// its English is dots.
const SILENCE_RE = /^[.\u2026\s]*$/

// True only when there IS something there and all of it is dots. A row with
// nothing in either language is not a beat of silence, it is an empty row.
function rowIsSilence(r) {
  const ga = (r.ga || '').trim()
  const en = (r.en || '').trim()
  if (!ga && !en) return false
  return SILENCE_RE.test(ga) && SILENCE_RE.test(en)
}
import { MoonPeek }     from '../systems/moonPeek.js'
import {
  COLORS, FONTS, SIZES, TYPE, BUTTON,
  textStyle, createButton, pickLanguage,
} from '../systems/gameTypography.js'

// -- Tuning --
const SCROLL_PX_PER_SEC = 28
const PAUSE_MS          = 4000
const HOLD_MS           = 3000
const FADE_MS           = 400
const COOLDOWN_MS       = 4500
const DISMISS_VEL       = 0.5

// -- Style --
const PANEL_H_FRAC  = 0.60
const IRISH_COLOR   = COLORS.irish
const ENGLISH_COLOR = COLORS.english
const SPEAKER_COLOR = COLORS.speaker
const PANEL_FILL    = COLORS.panelFill
const PANEL_BORDER  = COLORS.panelBorder
const PANEL_ALPHA   = COLORS.panelAlpha
const IRISH_SIZE    = SIZES.irish
const ENGLISH_SIZE  = SIZES.english
const IRISH_FONT    = FONTS.irish
const ENGLISH_FONT  = FONTS.english

// -- Encounter card layout --
const CARD_H_FRAC          = 0.78    // taller than dialogue
const CARD_W_FRAC          = 0.92
const CARD_GRAPHIC_SIZE    = 96
const CARD_SPEAKER_SIZE    = 64      // inline speaker portrait (repeats down the card)
const CARD_SPEAKER_PAD     = 6       // gap below a speaker portrait
const CARD_SPEAKER_GAP     = 14      // gap above a speaker portrait (block separator)

// Staged reveal. A card used to be assembled whole and faded in as one piece,
// which put the NPC's reply on screen before the player's own line had a beat
// to land -- flattening a turn-by-turn exchange into a wall. Blocks now arrive
// one at a time, a beat apart.
const CARD_REVEAL_FADE_MS  = 240     // how long a single block takes to arrive

// How long a block is left to be read before the next one arrives. A fluent
// reader found a flat beat too fast on long lines and needlessly slow on short
// ones, so the pause is sized by the text rather than fixed. Tap-to-skip means
// erring long costs nothing: anyone who has finished reading can move on.
// A held beat before the first block of a card arrives, so the harp gesture
// that just fired -- the opening flourish, or the touch on a choice -- rings
// into an empty card instead of being stepped on by the tune. Visual as well as
// audible: the card stops repopulating the instant you tap it.
// Syllables, counted as maximal vowel runs. An Irish syllable is one vowel
// nucleus, and the broad/slender digraphs (ai, ea, eoi, aoi...) are contiguous,
// so each collapses to a single run -- which makes this crude rule accurate
// here in a way it would never be in English.
const GA_VOWEL_RUN = /[aeiouáéíóúAEIOUÁÉÍÓÚ]+/g
function syllablesGa(s) {
  if (!s) return 0
  const m = String(s).match(GA_VOWEL_RUN)
  return m ? m.length : 0
}

// Counted in the harp's beats rather than milliseconds, so they stay in
// proportion if the tempo moves -- and so a pause is a rest in the music
// instead of a gap beside it. These were 950ms and 340ms, which did the job of
// keeping the flourish from being stepped on and then overstayed: a full
// second at the head of a conversation reads as the game hesitating.
const CARD_OPEN_LEAD_BEATS   = 4     // after the opening flourish
const CARD_CHOICE_LEAD_BEATS = 1     // after a choice stroke

const CARD_READ_MIN_MS     = 340     // the whole of a portrait-only beat

// How long a block is held: a syllable of Irish worth of reading time each.
// The harp no longer plays one note per syllable -- that was a metronome -- but
// sizing the PAUSE this way is what stopped the hurrying, so it stays.
//
// Ordinary Irish speech runs 4-5 syllables a second. This is deliberately
// slower -- it's a reading pace, not a talking one.
const SYLLABLE_MS          = 380     // ~2.6 syllables a second
// A breath after each block. Set back when blocks were carrying a metronome
// and never revisited once they weren't -- lengthened because reaching the
// answering dialogue felt hurried, without giving a piece time to settle.
// Per block, so it accumulates across an exchange without stretching any one
// line much.
// Harp notes ring for one to two and a half seconds after they're struck, so a
// motif is still sounding well past its final note. Blocks sized flush to the
// motif put the next phrase on top of the last one's tail.
const CARD_READ_TAIL_BEATS = 3       // breath after the last note of a block

// The portrait dances while its owner's tune plays -- after championBoogie in
// heroSelect.js, but pinned to the tune's own dance beat rather than a fixed
// interval, so a jig NPC bounces quicker than a reel one.
const CARD_DANCE_HOP_PX    = 9
const CARD_DANCE_TILT      = 0.05    // radians at the top of a hop
// The player's own line is held for exactly one motif plus this, rather than
// for a share of its reading time. They've already read it -- it was the button
// they pressed -- so what decides the length is how long its accompaniment
// takes, not how long the words take to read.
//
// Derived from the tune's metre, so it fits whatever is playing instead of
// being a weight that happens to work out.
const CARD_READ_HERO_TAIL_BEATS = 3
const CARD_BTN_ROLL_MS     = 110     // (superseded: the drum sets the spacing)
// How far into the last block's reading time the options appear. Waiting out
// the whole of it meant that on a long line the melody finished and then
// seconds passed with nothing happening. Far enough in that the phrase has
// played; near enough that the silence doesn't stretch.
// The options used to arrive at a fraction of the block's reading time, which
// had nothing to do with when the music stopped -- so on a long line the motif
// ended at ~2.2s and the buttons came at 4.5s, the gap growing with the length
// of the speech for no reason the player could hear.
//
// They're timed off the melody now: a motif, then a couple of beats, then the
// drum picks it up. A fixed musical relationship that doesn't stretch.
// How long after a card appears before tap-to-skip will listen. The gesture
// that OPENS a card -- the badge tap, or the swipe back to the options -- is
// often still in flight when the listener arms, and without this guard the card
// instantly skips itself: the drum fires, the harp timers are cancelled, and
// the line arrives in silence. A skip is a deliberate second gesture, and no
// such intention can exist before the first word is on screen.
const CARD_SKIP_ARM_MS     = 350

const CARD_BTN_GAP_BEATS   = 2
const CARD_BTN_MIN_MS      = 700
const CARD_READ_MAX_MS     = 9000    // ceiling, so one huge speech can't stall the card
// English is the support text, read faster and only when shown -- this is
// scaled by GameSettings.englishOpacity at count time, so a dark moon buys no
// time for text that isn't on screen.
const CARD_READ_EN_WEIGHT  = 0.6
// Blocks wrap narrower than the body so the two speakers' columns are visibly
// different shapes, not just different colours -- colour is the first cue lost
// on a dim screen outdoors.
const CARD_BLOCK_W_FRAC    = 0.86
const CARD_GRAPHIC_TOP     = 18      // gap from card top to graphic
const CARD_BODY_TOP_PAD    = 22      // gap below graphic
const CARD_BODY_BOTTOM_PAD = 22      // gap above buttons
const CARD_MOON_CLEARANCE  = 14      // gap between lowest button and moon hub
const CARD_MOON_PAD        = 18      // card bottom edge, below the moon hub
const CARD_EDGE_PAD        = 6       // never touch the screen edge
const CARD_TOP_FRAC        = 0.03    // card top edge, as a fraction of screen height
const CARD_PADDING_X       = 24

export default class TextPanel {
  constructor(scene) {
    this.scene              = scene
    this.isVisible          = false
    this.isFading           = false
    this._fadeStartTime     = 0
    this.currentPanelType   = null
    this.onDismiss          = null
    this.englishOptionTexts = []
    this.irishTextObject    = null
    this.englishTextObject  = null

    this._cooldownId        = null
    this._lastTriggerId     = null

    this._objects           = []
    this._enObjects         = []
    this._maskGfx           = null

    // Scroll state
    this._scrolling         = false
    this._scrollY           = 0
    this._maxScroll         = 0
    this._velocity          = SCROLL_PX_PER_SEC / 60
    this._paused            = false
    this._pauseTimer        = null
    this._atTop             = false
    this._holdTimer         = null
    this._rafId             = null

    this._isExamine         = false

    // Content positioning
    this._contentX          = 0
    this._contentBaseY      = 0
    this._contentItems      = []

    // Buttons created via createButton (need updateOpacity on lang change)
    this._buttons           = []

    // Gesture state
    this._dragging          = false
    this._inPanelDrag       = false
    this._tapStartY         = 0
    this._tapStartTime      = 0
    this._dragStartY        = 0
    this._dragStartScroll   = 0
    this._lastDragY         = 0
    this._lastDragTime      = 0
    this._dragVelocity      = 0

    this._bounds         = null
    this._clipTop        = 0
    this._clipBottom     = 9999

    this._onDown            = null
    this._onMove            = null
    this._onUp              = null

    // Encounter-card chrome (background, overlay, border, portrait). Kept
    // alive across successive show() calls within one conversation so the
    // card does not blink out and back between choices -- only the body
    // text and buttons are rebuilt. Released by releaseChrome().
    this._chrome     = []
    this._chromeGeom = null
    this._lastCardConfig = null
  }

  // -- Public --

  show(config) {
    const {
      irish     = '',
      english   = '',
      type      = 'dialogue',
      speaker   = null,
      onDismiss = null,
      options   = null,
      onChoice  = null,
      id        = null,
      // Encounter card extras:
      bgKey     = null,         // Phaser texture key for background image
      graphicKey= null,         // Phaser texture key for graphic banner
      // True when this card is a step inside an ongoing exchange rather than
      // the end of one: dismissing it by gesture should leave the chrome
      // standing for whatever comes next, not tear the panel down.
      keepChromeOnHide = false,
      // What the player's character just said, shown above the NPC's line
      // in the speaker colour. Short buttons, long spoken lines.
      exchange  = null,
      heroGa    = '',
      heroEn    = '',
      // Champion portrait, shown beside the NPC's when the hero speaks.
      heroGraphicKey = null,
    } = config

    if (id && this._cooldownId === id) return
    this._lastTriggerId = id

    // Kept so a portrait that finishes loading after the card was built can
    // re-render it with the same content. Encounter cards only.
    if (type === 'encounter_card') this._lastCardConfig = { ...config }

    // Card-to-card within one conversation: keep the chrome, swap the body.
    const _keepChrome = (type === 'encounter_card') && this._chrome.length > 0

    // First card of an exchange: rewind the champion's theme to its opening.
    // Resetting per conversation is what makes depth audible -- see
    // dialogueHarp.js.
    // Which lead-in this card gets: the long one at the head of a conversation,
    // the short one after a choice.
    //
    // Deliberately NOT `!_keepChrome`. Cards are rebuilt when the portrait
    // finishes loading, and on that rebuild the chrome is kept -- so the
    // opening card lost its lead a few hundred milliseconds after gaining it,
    // and the melody started underneath the flourish. What actually matters is
    // whether any melody has played yet, which no amount of rebuilding changes.
    if (type === 'encounter_card') {
      this._cardIsFirst = !DialogueHarp.hasSounded()
    }

    if (type === 'encounter_card' && !_keepChrome) {
      const champ = this.scene.registry?.get('selectedChampion') ||
                    window.selectedChampion || null
      // The scene goes with it: plucks borrow the Phaser AudioContext rather
      // than opening one of their own.
      // Fallback only. encounterPanel starts the conversation and supplies the
      // NPC identity from the zone; this catches any path that shows an
      // encounter card without going through it. Guarding on isStarted()
      // matters: without it this ran a moment after open() and reset the NPC's
      // voice back to empty.
      // The moon becomes the English dial for the length of the conversation.
      try { MoonPeek.enter() } catch (e) {}

      if (!DialogueHarp.isStarted()) {
        DialogueHarp.begin(champ, this.scene, graphicKey || null)
      }
    }
    if (this.isVisible) this._destroyAll(_keepChrome)

    this.onDismiss          = onDismiss
    this._keepChromeOnHide  = keepChromeOnHide
    this.isVisible        = true
    this.isFading         = false
    this.currentPanelType = type
    this._isExamine       = (type === 'examine' || type === 'encounter_card')

    const sw = this.scene.scale.width
    const sh = this.scene.scale.height

    if (type === 'dialogue' || type === 'examine') {
      this._buildScrollPanel(irish, english, speaker, sw, sh)
    } else if (type === 'notification') {
      this._buildNotification(irish, english, sw, sh)
    } else if (type === 'chat_options') {
      this._buildChatOptions(irish, english, options, onChoice, speaker, sw, sh)
    } else if (type === 'archery_prompt') {
      this._buildArcheryPrompt(irish, english, sw, sh)
    } else if (type === 'encounter_card') {
      this._buildEncounterCard(irish, english, options, onChoice, bgKey, graphicKey, sw, sh, heroGa, heroEn, heroGraphicKey, exchange)
      // Mid-conversation card swap used to call _fadeInBody() here to stop the
      // new words popping. The staged reveal in _beginScroll() now covers that
      // for every card, first or not -- running both would double-fade, and
      // _fadeInBody's blanket alpha write would flatten the beats.
    }
  }

  /**
   * Everything that is NOT persistent chrome: body text plus the option
   * buttons' own game objects. createButton() hands back a plain handle
   * ({ bg, text, ... }), not a GameObject, so its parts have to be pulled
   * out by hand before a tween can touch them.
   */
  _bodyTargets() {
    const btnParts = []
    this._buttons.forEach(b => {
      if (b?.bg?.active)   btnParts.push(b.bg)
      if (b?.text?.active) btnParts.push(b.text)
    })
    return [...this._objects, ...btnParts]
  }

  _fadeInBody() {
    const targets = this._bodyTargets()
    if (!targets.length) return
    // English keeps its own opacity from the moon slider -- capture each
    // object's intended alpha first and tween back to that, not to 1.
    const goals = targets.map(o => o.alpha)
    targets.forEach(o => o.setAlpha(0))
    targets.forEach((o, i) => {
      this.scene.tweens.add({ targets: o, alpha: goals[i], duration: FADE_MS, ease: 'Linear' })
    })
  }

  /**
   * Stop any in-flight block reveal. Without this a card dismissed mid-reveal
   * leaves tweens still pushing `reveal` upward while hide() tweens alpha
   * down, and the two fight over the same objects.
   */
  _killRevealTweens() {
    if (this._revealTweens) {
      this._revealTweens.forEach(t => { if (t?.remove) t.remove() })
      this._revealTweens = []
    }
    if (this._revealTimer) {
      this._revealTimer.remove(false)
      this._revealTimer = null
    }
    if (this._revealSkip) {
      this.scene.input.off('pointerdown', this._revealSkip)
      this._revealSkip = null
    }
    // Pending plucks are cancelled rather than rushed: a skipped block doesn't
    // advance the theme. Reading gets you more of your tune, skipping doesn't.
    if (this._revealSounds) {
      this._revealSounds.forEach(t => { if (t?.remove) t.remove(false) })
      this._revealSounds = []
    }
    if (this._soloTimer) {
      this._soloTimer.remove(false)
      this._soloTimer = null
    }
  }

  /**
   * Bring the whole pending exchange in at once and hand the player their
   * choices. Called by the skip gesture; safe to call at any point, including
   * before the first block has arrived or after the last.
   */
  _completeReveal() {
    if (this.currentPanelType !== 'encounter_card') return
    // Grab the solo before the kill, then play it: the options are arriving
    // right now, so its moment is now rather than never.
    const solo = (!this._soloDone && this._soloFn) ? this._soloFn : null
    this._killRevealTweens()
    if (solo) solo()
    if (this._contentItems) {
      this._contentItems.forEach(item => { item.reveal = 1 })
    }
    this._buttons.forEach(b => {
      if (b?.bg?.active)   b.bg.setAlpha(1)
      if (b?.text?.active) b.text.setAlpha(1)
      if (b?.bg?.active && b.bg.input) b.bg.input.enabled = true
    })
    this._applyScroll()
  }

  hide(keepChrome = false) {
    if (!this.isVisible || this.isFading) return
    this.isFading = true
    const _wasCard = (this.currentPanelType === 'encounter_card')
    this._killRevealTweens()
    // The panel is coming down for good, so the conversation is over. The
    // cadence checks for itself whether it got far enough in to be earned.
    if (_wasCard && !keepChrome) {
      try {
        DialogueHarp.cadence()
        DialogueHarp.endConversation()
      } catch (e) {}
      // Give the moon its ordinary long press back.
      try { MoonPeek.exit() } catch (e) {}
    }
    this._fadeStartTime = performance.now()
    this._stopScroll()
    this._unbindInput()
    this._startCooldown()

    const targets = keepChrome
      ? this._bodyTargets()
      : [...this._bodyTargets(), ...this._chrome]
    if (targets.length) {
      this.scene.tweens.add({
        targets,
        alpha: 0,
        duration: FADE_MS,
        ease: 'Linear',
        onComplete: () => {
          const cb = this.onDismiss
          this._destroyAll(keepChrome)
          if (cb) cb()
        }
      })
    } else {
      const cb = this.onDismiss
      this._destroyAll(keepChrome)
      if (cb) cb()
    }
  }

  getFadeRemaining() {
    if (!this.isFading) return 0
    const elapsed = performance.now() - this._fadeStartTime
    return Math.max(0, FADE_MS - elapsed)
  }

  update() {}

  updateEnglishOpacity() {
    const a = GameSettings.englishOpacity
    if (this._contentItems) {
      this._contentItems.forEach(item => {
        if (this._enObjects.includes(item.obj)) {
          item.baseAlpha = a
        }
      })
    }
    this._enObjects.forEach(o => {
      if (o?.active && !this._contentItems?.find(i => i.obj === o)) {
        o.setAlpha(a)
      }
    })
    // Update single-language buttons (encounter_card uses these)
    this._buttons.forEach(b => b.updateOpacity(a))
    this._applyScroll()
  }

  // -- Encounter card layout --

  _buildEncounterCard(irish, english, options, onChoice, bgKey, graphicKey, sw, sh, heroGa = '', heroEn = '', heroGraphicKey = null, exchange = null) {
    const panelW = Math.round(sw * CARD_W_FRAC)
    const panelX = Math.round(sw / 2)
    const depth  = 2000
    const baseH  = Math.round(sh * CARD_H_FRAC)

    // -- Geometry: absorb the moon hub ---------------------------------------
    // The hub is the English-opacity control, so it must stay reachable while
    // a card is open -- it cannot be hidden or moved out from under the
    // player's thumb mid-conversation. Rather than dodge it, the card grows
    // DOWN past it, so the hub reads as part of the panel's own design
    // instead of straddling its bottom edge. Option buttons stack upward from
    // just above the hub. Measured live off the DOM, since the hub scales
    // with viewport. Frozen into _chromeGeom on the first card of an exchange
    // so later cards line up exactly with the persistent background.
    let panelTop  = Math.round((sh - baseH) / 2)
    let panelH    = baseH
    let btnBottom = panelTop + panelH - CARD_BODY_BOTTOM_PAD

    if (this._chromeGeom) {
      panelTop  = this._chromeGeom.panelTop
      panelH    = this._chromeGeom.panelH
      btnBottom = this._chromeGeom.btnBottom
    } else {
      const hubEl  = document.getElementById('dpad-moon-hub')
      const canvas = this.scene.game?.canvas
      if (hubEl && canvas) {
        const cRect = canvas.getBoundingClientRect()
        const hRect = hubEl.getBoundingClientRect()
        if (cRect.height > 0 && hRect.height > 0) {
          const scale     = sh / cRect.height          // CSS px -> game units
          const hubTop    = (hRect.top    - cRect.top) * scale
          const hubBottom = (hRect.bottom - cRect.top) * scale
          const wantBot   = Math.min(sh - CARD_EDGE_PAD, hubBottom + CARD_MOON_PAD)
          // Only grow, never shrink below a usable card.
          if (wantBot > panelTop + baseH * 0.5) {
            // Reclaim the top of the screen as well as the bottom. The card
            // was still being centred on its ORIGINAL height while extending
            // down past the hub, so it sat low with a dead band above it --
            // and with four options that band was being paid for out of the
            // body's text room. Order matters: panelTop moves first, then
            // panelH is measured from it.
            panelTop  = Math.round(sh * CARD_TOP_FRAC)
            panelH    = Math.round(wantBot - panelTop)
            btnBottom = Math.round(hubTop - CARD_MOON_CLEARANCE)
          }
        }
      }
      this._chromeGeom = { panelTop, panelH, btnBottom }
    }

    this._bounds = { x: panelX - panelW/2, y: panelTop, w: panelW, h: panelH }

    // (Portrait presence is now tested per block, in pushBlock() below.)

    // -- Chrome: built once per conversation, then reused ---------------------
    // Everything below goes into this._chrome rather than this._objects, so
    // _destroyAll(true) leaves it standing between choices. The result is that
    // only the words cross-fade; the card itself never blinks.
    if (!this._chrome.length) {
      if (bgKey && this.scene.textures.exists(bgKey)) {
        const bgImg = this.scene.add.image(panelX, panelTop + panelH/2, bgKey)
          .setDisplaySize(panelW, panelH)
          .setScrollFactor(0)
          .setDepth(depth)
        this._chrome.push(bgImg)

        // Subtle dark overlay so text remains readable on busy bg images
        const overlay = this.scene.add.graphics().setDepth(depth + 1).setScrollFactor(0)
        overlay.fillStyle(0x000000, 0.35)
        overlay.fillRoundedRect(panelX - panelW/2, panelTop, panelW, panelH, 10)
        this._chrome.push(overlay)
      } else {
        const bg = this.scene.add.graphics().setDepth(depth).setScrollFactor(0)
        bg.fillStyle(PANEL_FILL, PANEL_ALPHA)
        bg.fillRoundedRect(panelX - panelW/2, panelTop, panelW, panelH, 10)
        this._chrome.push(bg)
      }

      const border = this.scene.add.graphics().setDepth(depth + 2).setScrollFactor(0)
      border.lineStyle(BUTTON.borderWidth, COLORS.buttonBorder, 0.85)
      border.strokeRoundedRect(panelX - panelW/2, panelTop, panelW, panelH, 10)
      this._chrome.push(border)

    }

    // -- Portraits -----------------------------------------------------------
    // These live in _objects, not _chrome: the pairing changes from card to
    // card (she alone when she asks; both when the hero answers), so they
    // have to be rebuilt and cross-faded with the body rather than standing
    // still behind it.
    // No banner portrait any more -- portraits head their own speaker's block
    // inside the body (see the row builder below), so the body starts at the
    // top of the card and every speaker gets a face.
    const bodyTop = panelTop + CARD_GRAPHIC_TOP

    // -- Calculate body region --
    const buttonCount  = options?.length || 0
    const buttonsBlock = buttonCount > 0
      ? buttonCount * BUTTON.height + (buttonCount - 1) * BUTTON.gap + CARD_BODY_BOTTOM_PAD
      : 0
    // Measured up from btnBottom (just above the moon hub), not from the
    // panel's true bottom edge -- the card now extends past the hub.
    const bodyBottom = btnBottom - buttonsBlock - CARD_BODY_BOTTOM_PAD
    const bodyH      = Math.max(60, bodyBottom - bodyTop)

    // -- Mask for body region (clips scrolling text) --
    const maskGfx = this.scene.add.graphics().setScrollFactor(0).setDepth(depth - 1)
    maskGfx.fillStyle(0xffffff)
    maskGfx.fillRect(panelX - panelW/2 + CARD_PADDING_X, bodyTop, panelW - CARD_PADDING_X * 2, bodyH)
    this._maskGfx = maskGfx
    this._objects.push(maskGfx)
    const mask = maskGfx.createGeometryMask()

    // -- Body content (bilingual, both visible, scrolls if overflow) --
    const startX = panelX - panelW/2 + CARD_PADDING_X
    const textW  = panelW - CARD_PADDING_X * 2
    this._contentX     = startX
    this._contentBaseY = bodyTop                          // start at TOP of body, not centre
    this._contentItems = []
    this._clipTop      = bodyTop
    this._clipBottom   = bodyTop + bodyH
    this._enObjects    = []

    // The card body is a transcript: each speaker's block of text is headed
    // by that speaker's portrait, centred. Portraits are ordinary content
    // items, so they scroll, clip, mask and fade exactly like the text they
    // head -- and a third or fourth block is just another entry in this
    // list, which is what lets an exchange run long without a card refresh.
    const rows = []

    // Each row declares which reveal beat it belongs to. The hero's portrait
    // and words share a beat -- the player just tapped that line, they don't
    // need it doled out -- while the NPC's face arrives one beat ahead of her
    // words, so there's a moment of "she's about to speak" before she does.
    const pushBlock = (gaText, enText, key, isHero, portraitGroup, textGroup) => {
      const gl = (gaText || '').split('\n')
      const el = (enText || '').split('\n')
      const n  = Math.max(gl.length, el.length)
      if (!n || (!(gaText || '').trim() && !(enText || '').trim())) return
      if (key && this.scene.textures.exists(key)) {
        rows.push({ portrait: key, isHero, group: portraitGroup })
      }
      for (let i = 0; i < n; i++) {
        rows.push({ ga: gl[i], en: el[i], isHero, group: textGroup })
      }
    }

     if (Array.isArray(exchange) && exchange.length) {
      // A scripted exchange is one card, not a run of them. Every turn adds
      // another pair of blocks to the same transcript, so the whole thing
      // scrolls as one -- forward at the reader's pace, and back over
      // anything they want to read again. Three beats per turn: the hero
      // speaks, the NPC's face arrives, the NPC answers.
      exchange.forEach((turn, k) => {
        const g = k * 3
        pushBlock(turn.say   ?? (k === 0 ? heroGa : ''),
                  turn.sayEn ?? (k === 0 ? heroEn : ''),
                  heroGraphicKey, true,  g,     g)
        pushBlock(turn.replyGa, turn.replyEn, graphicKey, false, g + 1, g + 2)
      })
    } else {
      pushBlock(heroGa, heroEn, heroGraphicKey, true,  0, 0)   // the player's character
      pushBlock(irish,  english, graphicKey,    false, 1, 2)   // the NPC
    }

    // Groups are declared with gaps in them, because the hero's block is
    // absent on the first card of an exchange. Compact them so the beats
    // always run 0,1,2... -- otherwise an opening card would sit blank for a
    // beat waiting on a hero block that never comes.
    const _present = [...new Set(rows.map(r => r.group))].sort((a, b) => a - b)
    const _beatOf  = new Map(_present.map((g, i) => [g, i]))
    rows.forEach(r => { r.group = _beatOf.get(r.group) })
    this._revealBeats = _present.length

    // How much there is to read in each beat, which is what sizes the pause
    // AFTER it. Portrait rows contribute nothing, so a portrait beat comes out
    // at the floor -- a breath before she speaks, not a stall.
    const _enW = CARD_READ_EN_WEIGHT * (GameSettings.englishOpacity ?? 1)
    const _chars = new Array(_present.length).fill(0)
    const _hero  = new Array(_present.length).fill(false)
    const _syll  = new Array(_present.length).fill(0)
    // Starts true and is cleared by the first row carrying real words, so a
    // beat is silent only if EVERYTHING in it is. A card mixing "..." with a
    // spoken line still gets its music.
    const _silent = new Array(_present.length).fill(true)
    rows.forEach(r => {
      if (r.portrait) return
      const n = (r.ga || '').trim().length + (r.en || '').trim().length * _enW
      _chars[r.group] += n
      // Only the Irish is counted: the tune follows the language the game is
      // for, and since the tune now sets the pace, so does the Irish. A block
      // is held for as long as its own melody takes.
      _syll[r.group] += syllablesGa(r.ga)
      if (r.isHero) _hero[r.group] = true
      if (!rowIsSilence(r)) _silent[r.group] = false
    })
    this._revealChars = _chars
    this._revealSilent = _silent
    this._revealHero  = _hero
    this._revealSyll  = _syll

    // Narrower than the body: see CARD_BLOCK_W_FRAC.
    const blockW = Math.round(textW * CARD_BLOCK_W_FRAC)

    let cy = 0

    for (const row of rows) {
      if (row.portrait) {
        // Leading gap, except for the very first block.
        if (cy > 0) cy += CARD_SPEAKER_GAP
        // Each speaker's face sits at their own outer edge, so who is talking
        // reads from the shape of the card before a word is parsed.
        const px = row.isHero
          ? startX + textW - CARD_SPEAKER_SIZE / 2
          : startX + CARD_SPEAKER_SIZE / 2
        const img = this.scene.add.image(px, bodyTop + cy, row.portrait)
          .setDisplaySize(CARD_SPEAKER_SIZE, CARD_SPEAKER_SIZE)
          .setOrigin(0.5, 0).setScrollFactor(0).setDepth(depth + 4).setAlpha(0)
        img.setMask(mask)
        this._objects.push(img)
        this._contentItems.push({
          obj: img, localY: cy, baseAlpha: 1, group: row.group, reveal: 0,
          isPortrait: true, isHero: !!row.isHero, bob: 0,
        })
        cy += CARD_SPEAKER_SIZE + CARD_SPEAKER_PAD
        continue
      }
      const ga = (row.ga || '').trim()
      const en = (row.en || '').trim()
      const isHero = row.isHero
      if (!ga && !en) { cy += 12; continue }

      // The hero's words run down the right, the NPC's down the left. Origin
      // and align have to agree: origin alone would move the box while the
      // short lines inside it stayed left-ragged.
      const rowX     = isHero ? startX + textW : startX
      const rowOx    = isHero ? 1 : 0
      const rowAlign = isHero ? 'right' : 'left'

      if (ga) {
        const el = this.scene.add.text(rowX, bodyTop + cy, ga, {
          fontSize:   TYPE.cardBody.size,
          fontFamily: TYPE.cardBody.font,
          color:      isHero ? SPEAKER_COLOR : IRISH_COLOR,
          wordWrap:   { width: blockW },
          align:      rowAlign,
          lineSpacing: TYPE.cardBody.lineSpacing,
        }).setOrigin(rowOx, 0).setScrollFactor(0).setDepth(depth + 4).setAlpha(0)
        el.setMask(mask)
        this._objects.push(el)
        this._contentItems.push({
          obj: el, localY: cy, baseAlpha: 1, group: row.group, reveal: 0,
        })
        if (!this.irishTextObject) this.irishTextObject = el
        cy += el.height + 4
      }

      if (en) {
        const el = this.scene.add.text(rowX, bodyTop + cy, en, {
          fontSize:   TYPE.cardBodyEn.size,
          fontFamily: TYPE.cardBodyEn.font,
          color:      ENGLISH_COLOR,
          wordWrap:   { width: blockW },
          align:      rowAlign,
          lineSpacing: TYPE.cardBodyEn.lineSpacing,
        }).setOrigin(rowOx, 0).setScrollFactor(0).setDepth(depth + 4).setAlpha(0)
        el.setMask(mask)
        this._objects.push(el)
        this._enObjects.push(el)
        this._contentItems.push({
          obj: el,
          localY: cy,
          baseAlpha: GameSettings.englishOpacity,
          group: row.group,
          reveal: 0,
          isEn: true,          // lifted while the moon is held -- see setEnglishPeek
        })
        if (!this.englishTextObject) this.englishTextObject = el
        cy += el.height + 14
      }
    }

    // Determine scrollability: only scroll if content overflows body region
    const overflow = Math.max(0, cy - bodyH)
    this._maxScroll = overflow > 0 ? overflow + bodyH : 0

    // -- Buttons (single-language, docked at bottom) --
    this._buttons = []
    if (options?.length) {
      const btnW = Math.round(panelW - CARD_PADDING_X * 2)

      // Stack from bottom up
      const positions = []
      let by = btnBottom - BUTTON.height/2
      for (let i = options.length - 1; i >= 0; i--) {
        positions.unshift(by)
        by -= BUTTON.height + BUTTON.gap
      }

      options.forEach((opt, i) => {
        const btn = createButton(this.scene, {
          x: panelX,
          y: positions[i],
          width: btnW,
          labelGa: opt.ga || opt.irish || '',
          labelEn: opt.en || opt.english || '',
          depth: depth + 5,
          opacity: GameSettings.englishOpacity,
          onTap: () => {
            // keepChrome: the reply card (or the next node) reuses this
            // background, so only the body fades.
            this.hide(true)
            this.scene.time.delayedCall(60, () => {
              if (onChoice) onChoice(i, opt)
            })
          },
        })
        this._buttons.push(btn)
        this._objects.push(btn.bg)
        this._objects.push(btn.text)
      })
    }

    // -- Hint (only show if scrollable) --
    if (this._maxScroll > 0) {
      const hint = this.scene.add.text(
        panelX, bodyTop + bodyH - 4, '↕',
        { fontSize: '12px', fontFamily: FONTS.ui, color: COLORS.hint }
      ).setOrigin(0.5, 1).setScrollFactor(0).setDepth(depth + 6).setAlpha(0.4)
      this._objects.push(hint)
    }

    this._beginScroll()
    this._bindInput()
  }

  // -- Scroll panel (dialogue/examine) --

  _buildScrollPanel(irish, english, speaker, sw, sh) {
    const panelW   = Math.round(sw * 0.92)
    const panelH   = Math.round(sh * PANEL_H_FRAC)
    const panelX   = Math.round(sw / 2)
    const panelTop = 10
    const padding  = 22
    const textW    = panelW - padding * 2
    const depth    = 2000

    this._bounds = { x: panelX - panelW/2, y: panelTop, w: panelW, h: panelH }

    const bg = this.scene.add.graphics().setDepth(depth).setScrollFactor(0)
    bg.fillStyle(PANEL_FILL, PANEL_ALPHA)
    bg.fillRoundedRect(panelX - panelW/2, panelTop, panelW, panelH, 10)
    bg.lineStyle(2, PANEL_BORDER, 0.5)
    bg.strokeRoundedRect(panelX - panelW/2, panelTop, panelW, panelH, 10)
    this._objects.push(bg)

    const fadeH = Math.round(panelH * 0.35)
    const fadeY = panelTop + panelH - fadeH
    const fade = this.scene.add.graphics().setDepth(depth + 3).setScrollFactor(0)
    fade.fillGradientStyle(PANEL_FILL, PANEL_FILL, PANEL_FILL, PANEL_FILL,
      0, 0, PANEL_ALPHA, PANEL_ALPHA)
    fade.fillRect(panelX - panelW/2, fadeY, panelW, fadeH)
    this._objects.push(fade)

    const hint = this.scene.add.text(panelX, panelTop + panelH - 6, '↑ swipe up to dismiss', {
      fontSize: SIZES.hint, fontFamily: FONTS.english, color: COLORS.hint
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(depth + 2).setAlpha(0.4)
    this._objects.push(hint)

    const maskGfx = this.scene.add.graphics().setScrollFactor(0).setDepth(depth - 1)
    maskGfx.fillStyle(0xffffff)
    maskGfx.fillRect(panelX - panelW/2, panelTop, panelW, panelH)
    this._maskGfx = maskGfx
    this._objects.push(maskGfx)
    const mask = maskGfx.createGeometryMask()

    const startX     = panelX - panelW/2 + padding
    const centreY    = panelTop + panelH / 2
    this._contentX   = startX
    this._contentBaseY = centreY
    this._contentItems = []
    this._clipTop    = panelTop + padding / 2
    this._clipBottom = panelTop + panelH - padding

    const gaLines = (irish   || '').split('\n')
    const enLines = (english || '').split('\n')
    const count   = Math.max(gaLines.length, enLines.length)
    this._enObjects = []

    let cy = 0

    if (speaker) {
      const el = this.scene.add.text(startX, centreY + cy, speaker, {
        fontSize: SIZES.speaker, fontFamily: FONTS.irish,
        color: SPEAKER_COLOR, fontStyle: 'bold',
        wordWrap: { width: textW }
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(depth + 1).setAlpha(0)
      el.setMask(mask)
      this._objects.push(el)
      this._contentItems.push({ obj: el, localY: cy, baseAlpha: 1 })
      cy += el.height + 10
    }

    for (let i = 0; i < count; i++) {
      const ga = (gaLines[i] || '').trim()
      const en = (enLines[i] || '').trim()
      if (!ga && !en) { cy += 10; continue }

      if (ga) {
        const el = this.scene.add.text(startX, centreY + cy, ga, {
          fontSize: IRISH_SIZE, fontFamily: IRISH_FONT,
          color: IRISH_COLOR,
          wordWrap: { width: textW }, lineSpacing: 4
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(depth + 1).setAlpha(0)
        el.setMask(mask)
        this._objects.push(el)
        this._contentItems.push({ obj: el, localY: cy, baseAlpha: 1 })
        if (!this.irishTextObject) this.irishTextObject = el
        cy += el.height + 2
      }

      if (en) {
        const el = this.scene.add.text(startX, centreY + cy, en, {
          fontSize: ENGLISH_SIZE, fontFamily: ENGLISH_FONT,
          color: ENGLISH_COLOR,
          wordWrap: { width: textW }, lineSpacing: 3
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(depth + 1).setAlpha(0)
        el.setMask(mask)
        this._objects.push(el)
        this._enObjects.push(el)
        this._contentItems.push({ obj: el, localY: cy, baseAlpha: GameSettings.englishOpacity })
        if (!this.englishTextObject) this.englishTextObject = el
        cy += el.height + 10
      }
    }

    const visibleH  = panelH - padding * 2
    const overflow  = Math.max(0, cy - visibleH)
    this._maxScroll = panelH / 2 + overflow

    this._beginScroll()
    this._bindInput()
  }

  // -- Scroll logic --

  /**
   * Make a speaker's portrait dance for `durationMs`, hopping once per
   * `stepMs`. Hop, flip, hop, flip -- championBoogie's shape, at the tempo of
   * whatever tune is playing.
   *
   * Tweens `bob` rather than `y` for the reason given in _applyScroll.
   */
  _dance(isHero, durationMs, stepMs) {
    if (!this._contentItems || !(stepMs > 0)) return
    const item = this._contentItems.find(
      it => it.isPortrait && !!it.isHero === !!isHero
    )
    if (!item?.obj?.active) return

    const hops = Math.max(1, Math.round(durationMs / stepMs))
    item.bob = 0
    this._revealTweens.push(this.scene.tweens.add({
      targets: item,
      bob: CARD_DANCE_HOP_PX,
      duration: Math.round(stepMs / 2),
      yoyo: true,
      repeat: hops - 1,
      ease: 'Quad.easeOut',
      onUpdate: () => this._applyScroll(),
      onYoyo: () => {
        // The flip is what makes it read as a dance rather than a bounce.
        if (item.obj?.active) item.obj.toggleFlipX()
      },
      onComplete: () => {
        item.bob = 0
        if (item.obj?.active) { item.obj.setFlipX(false); item.obj.rotation = 0 }
        this._applyScroll()
      },
    }))

    this._revealTweens.push(this.scene.tweens.add({
      targets: item.obj,
      rotation: { from: -CARD_DANCE_TILT, to: CARD_DANCE_TILT },
      duration: Math.round(stepMs / 2),
      yoyo: true,
      repeat: hops - 1,
      ease: 'Sine.easeInOut',
    }))
  }

  /**
   * How far the English is lifted, 0 to 1, while the moon is held. Deliberately
   * NOT written to GameSettings: this is a display multiplier over the player's
   * own setting, so a peek can't quietly undo the difficulty they chose.
   *
   * The buttons follow too. Somebody stuck on a line is just as likely to be
   * stuck on the choices under it.
   */
  setEnglishPeek(p) {
    const v = Math.max(0, Math.min(1, p || 0))
    if (v === this._enPeek) return
    this._enPeek = v

    const base = GameSettings.englishOpacity ?? 0
    const eff  = base + (1 - base) * v
    this._buttons?.forEach(b => { try { b?.updateOpacity?.(eff) } catch (e) {} })

    this._applyScroll()
  }

  _applyScroll() {
    if (!this._contentItems) return
    const clipTop    = this._clipTop    || 0
    const clipBottom = this._clipBottom || 9999
    const fadeZone   = 24

    this._contentItems.forEach((item) => {
      const { obj, localY, baseAlpha } = item
      if (!obj?.active) return
      // The dance contributes here rather than writing obj.y itself: this
      // function rewrites the position every tick, so a tween on obj.y would
      // be undone the instant the player touched the card.
      const y = this._contentBaseY + localY - this._scrollY - (item.bob || 0)
      obj.y = y

      const bottom = y + (obj.height || 20)
      // Four inputs, one owner: the item's own intended alpha (which for
      // English is the moon slider), the peek lifting English while the moon is
      // held, how far its block has been revealed, and the clip fade at the
      // body's edges.
      const peek = item.isEn ? (this._enPeek || 0) : 0
      const base = peek > 0 ? baseAlpha + (1 - baseAlpha) * peek : baseAlpha
      let a = base * (item.reveal ?? 1)
      if (y < clipTop) {
        a = Math.max(0, Math.min(a, (y - (clipTop - fadeZone)) / fadeZone))
      }
      if (bottom > clipBottom) {
        a = Math.max(0, Math.min(a, (clipBottom - y) / fadeZone))
      }
      obj.setAlpha(Math.max(0, a))
    })
  }

  _beginScroll() {
    this._stopScroll()
    this._scrollY   = 0
    this._atTop     = false
    this._paused    = false
    this._velocity  = SCROLL_PX_PER_SEC / 60
    this._scrolling = true
    this._applyScroll()

    // For encounter cards: don't auto-scroll; reveal the exchange block by
    // block. Nothing here tweens obj.alpha directly -- alpha belongs to
    // _applyScroll, so each block's arrival is a tween on its `reveal`
    // multiplier with _applyScroll called on update.
    if (this.currentPanelType === 'encounter_card') {
      this._killRevealTweens()
      // Both lists are created here, before anything can push to either. The
      // roll under the options registers timers further up this function than
      // the per-beat harp does, so creating the list at first use put it after
      // its first writer.
      this._revealTweens = []
      this._revealSounds = []

      // Each beat's start is the previous beat's start plus however long the
      // previous beat's text takes to read. Cumulative, so a card of short
      // lines stays brisk and a card of long ones doesn't rush.
      // A block lasts as long as its melody: one note per syllable, plus a
      // breath. A portrait beat has no syllables and gets the floor.
      //
      // Then it's rounded to a whole number of the harp's beats. Without that,
      // every block started at an arbitrary offset from the last one and each
      // motif began wherever it happened to land -- which is most of why the
      // pauses felt disruptive rather than merely long. On the grid, the gap
      // between two lines is a rest in the music instead of a hole in it.
      const unit   = DialogueHarp.unitMs() || 180
      // Metre of the tune actually playing -- 6 to a bar for a jig, 8 for a
      // reel. Hoisted because the drum fill, the option timing and the solo
      // all need it.
      const bar    = DialogueHarp.barUnits() || 8
      const motif  = bar * 2 * unit          // PHRASE_BARS worth, i.e. one motif
      const tail   = CARD_READ_TAIL_BEATS * unit
      const syll   = this._revealSyll || []
      const hero   = this._revealHero || []
      const readMs = (g) => {
        // The player's line lasts as long as its music, not as long as its
        // words: they read it when they chose it.
        if (hero[g]) {
          return motif + CARD_READ_HERO_TAIL_BEATS * unit
        }
        const s   = syll[g] || 0
        const raw = (s <= 0)
          ? CARD_READ_MIN_MS
          : Math.min(CARD_READ_MAX_MS, s * SYLLABLE_MS + tail)
        return Math.max(unit, Math.round(raw / unit) * unit)
      }
      const beats  = Math.max(1, this._revealBeats ?? 1)
      const chars  = this._revealChars || []
      const lead   = unit * (this._cardIsFirst
        ? CARD_OPEN_LEAD_BEATS
        : CARD_CHOICE_LEAD_BEATS)
      const starts = [lead]
      for (let g = 1; g < beats; g++) starts[g] = starts[g - 1] + readMs(g - 1)

      this._contentItems.forEach((item) => {
        if (!item.obj?.active) return
        const beat = item.group ?? 0
        item.reveal = 0
        this._revealTweens.push(this.scene.tweens.add({
          targets: item,
          reveal: 1,
          delay: starts[beat] ?? 0,
          duration: CARD_REVEAL_FADE_MS,
          ease: 'Linear',
          onUpdate: () => this._applyScroll(),
        }))
      })

      // Options wait for the words: the last block's own reading time has to
      // pass before a choice is offered, with input off until they're up -- an
      // invisible button is still a tappable one, and a stray tap would skip a
      // line unread.
      const btnBeat = starts[beats - 1] + Math.max(
        CARD_BTN_MIN_MS,
        motif + CARD_BTN_GAP_BEATS * unit
      )
      const btnParts = []
      this._buttons.forEach(b => {
        if (b?.bg?.active)   btnParts.push(b.bg)
        if (b?.text?.active) btnParts.push(b.text)
        if (b?.bg?.input)    b.bg.input.enabled = false
      })
      if (btnParts.length) {
        // Options arrive one at a time on a bodhrán roll rather than all at
        // once. The old version left a gap with a sliver of text in it; this
        // carries the moment across instead of leaving a hole in it.
        Bodhran.setScene(this.scene)
        const goals = btnParts.map(o => o.alpha)
        btnParts.forEach(o => o.setAlpha(0))
        // The drum decides when the buttons land. soloBeats() returns the same
        // offsets the solo plays its accents on, so the options appear ON the
        // beat instead of merely while the drum is going -- and the two can't
        // drift, because it's one set of numbers driving both.
        // `bar` is hoisted above -- the buttons land on the downbeats of the
        // tune's own metre.
        const marks = Bodhran.soloBeats(
          Math.ceil(btnParts.length / 2), unit, bar
        )
        btnParts.forEach((o, i) => {
          // Two parts per button (background and label) share a beat.
          const step = marks[Math.floor(i / 2)] ?? 0
          this._revealTweens.push(this.scene.tweens.add({
            targets: o,
            alpha: goals[i],
            delay: btnBeat + step,
            duration: CARD_REVEAL_FADE_MS,
            ease: 'Linear',
          }))
        })
        const taps = Math.ceil(btnParts.length / 2)
        // Held apart from the harp timers on purpose. Skipping cancels the
        // harp -- that's reading music, and a skip means the reading is done --
        // but it must FIRE the drum rather than cancel it, because a skip means
        // "show me the options now" and the drum is part of them arriving.
        // Cancelling it here is why the solo kept going missing on any card the
        // player tapped ahead on.
        this._soloDone = false
        this._soloFn = () => {
          this._soloDone = true
          try { Bodhran.solo(taps, unit, bar) } catch (e) {}
        }
        this._soloTimer = this.scene.time.delayedCall(btnBeat, () => this._soloFn())
        this._revealTimer = this.scene.time.delayedCall(
          btnBeat + (marks[taps - 1] ?? 0) + CARD_REVEAL_FADE_MS,
          () => {
            this._buttons.forEach(b => {
              if (b?.bg?.active && b.bg.input) b.bg.input.enabled = true
            })
          }
        )
      }

      // One fragment of the champion's theme per beat that carries words. A
      // portrait beat is silent -- it's a face arriving, not a line.
      for (let g = 0; g < beats; g++) {
        if (!(chars[g] > 0)) continue
        // Silence gets no melody. Note this skips the harp ONLY -- the beat
        // keeps the full length _revealChars gave it, so the pause is still
        // felt. Muting and shortening are different things.
        if (this._revealSilent?.[g]) continue
        const isHero = !!(this._revealHero && this._revealHero[g])
        // Both speakers get the harp. The player's lines sound an octave above
        // the NPC's -- same tune, two registers -- which is what makes the
        // turn-taking audible.
        //
        // An earlier version dropped the harp here because the block was too
        // short to hold a motif. That solved the collision by removing the
        // music; the block is now sized from the motif instead, which solves it
        // by making room. The bodhrán fill that stood in for it is gone: it
        // merged with the `choose` stroke into one short burst and left the
        // rest of the block silent, which is what read as a missing melody.
        // How long this fragment has before the next block lands. The harp
        // fills it and stops -- so the amount of music is proportional to the
        // amount of Irish, line by line as well as across the conversation.
        // The harp gets the length of the block and plays a phrase into the
        // front of it, then stops. It doesn't track the syllables -- pinning
        // notes to syllables made a metronome, and a metronome fights the eye.
        // The block is still SIZED by syllables, which is what gives the
        // reader room; the silence after the phrase is that room.
        const blockMs = readMs(g)
        // The hop lands on the tune's dance beat -- three units under a jig,
        // four under a reel -- which is the same span the bodhrán phrases on.
        const step = (bar === 6 || bar === 9 ? 3 : 4) * unit
        const fire = () => {
          try { DialogueHarp.phrase({ isHero, blockMs }) } catch (e) {}
          try { this._dance(isHero, motif, step) } catch (e) {}
        }
        if (starts[g] <= 0) {
          fire()
        } else {
          this._revealSounds.push(this.scene.time.delayedCall(starts[g], fire))
        }
      }

      // Tap-to-skip. Anywhere on screen, any pointer, while blocks are still
      // pending: the rest arrive at once. Not a gate -- a short exchange never
      // overflows, so there'd be nothing to drag, and a tap per line would turn
      // reading into clicking. This is what makes a long pause safe to ship.
      if (btnBeat > 0) {
        // Guarded by timestamp rather than by registering late: an early tap is
        // then ignored on purpose rather than falling into a window where no
        // listener exists at all. Matters if the arm time is ever raised.
        const armAt = performance.now() + CARD_SKIP_ARM_MS
        this._revealSkip = () => {
          if (performance.now() < armAt) return
          this._completeReveal()
        }
        this.scene.input.on('pointerdown', this._revealSkip)
      }

      this._applyScroll()
      // Still run a light tick so drag-to-scroll works when content overflows
      this._rafId = requestAnimationFrame(this._tick.bind(this))
      return
    }

    this._rafId = requestAnimationFrame(this._tick.bind(this))
  }

  _tick() {
    if (!this._scrolling) return

    // Encounter card: passive -- don't auto-advance scrollY
  // Encounter card: apply momentum/inertia, no auto-advance
if (this.currentPanelType === 'encounter_card') {
  if (!this._dragging && Math.abs(this._velocity) > 0.01) {
    this._scrollY += this._velocity
    this._velocity *= 0.88  // friction
    this._scrollY = Math.max(0, Math.min(this._maxScroll, this._scrollY))
  }
  this._applyScroll()
  // Keep ticking only while there's still momentum
  if (Math.abs(this._velocity) > 0.01 || this._dragging) {
    this._rafId = requestAnimationFrame(this._tick.bind(this))
  } else {
    this._rafId = null
  }
  return
} 
    if (!this._dragging && !this._paused) {
      this._scrollY += this._velocity
      if (this._velocity < SCROLL_PX_PER_SEC / 60) {
        this._velocity += (SCROLL_PX_PER_SEC / 60 - this._velocity) * 0.05
      }
    }
    if (this._scrollY >= this._maxScroll) {
      this._scrollY = this._maxScroll
      this._applyScroll()
      this._onReachTop()
      return
    }
    if (this._scrollY < 0) {
      this._scrollY = 0
      this._velocity = SCROLL_PX_PER_SEC / 60
    }
    this._applyScroll()
    this._rafId = requestAnimationFrame(this._tick.bind(this))
  }

  _onReachTop() {
    if (this._atTop) return
    this._atTop    = true
    this._velocity = 0
    if (this._isExamine) return
    this._holdTimer = setTimeout(() => { this._holdTimer = null; this.hide() }, HOLD_MS)
  }

  _stopScroll() {
    this._scrolling = false
    if (this._rafId)      { cancelAnimationFrame(this._rafId); this._rafId      = null }
    if (this._pauseTimer) { clearTimeout(this._pauseTimer);    this._pauseTimer = null }
    if (this._holdTimer)  { clearTimeout(this._holdTimer);     this._holdTimer  = null }
  }

  // -- Input --

  _bindInput() {
    this._unbindInput()

    this._onDown = (p) => {
      const inside = this._inBounds(p)
      this._inPanelDrag = inside
      this._dragging    = inside
      if (!inside) {
        this._dragVelocity = 0
        return
      }
      this._tapStartY       = p.y
      this._tapStartTime    = performance.now()
      this._dragStartY      = p.y
      this._dragStartScroll = this._scrollY
      this._lastDragY       = p.y
      this._lastDragTime    = performance.now()
      this._dragVelocity    = 0
      this._atTop           = false
      if (this._holdTimer) { clearTimeout(this._holdTimer); this._holdTimer = null }
      if (!this._rafId && this._scrolling) {
        this._rafId = requestAnimationFrame(this._tick.bind(this))
      }
    }

    this._onMove = (p) => {
      if (!this._dragging || !this._inPanelDrag || !p.isDown) return
      const now = performance.now()
      const dt  = now - this._lastDragTime
      const dy  = p.y - this._lastDragY
      if (dt > 0) this._dragVelocity = this._dragVelocity * 0.6 + (dy / dt) * 0.4

      // For encounter cards, only scroll body when content overflows
      if (this.currentPanelType === 'encounter_card' && this._maxScroll === 0) {
        // Track velocity for swipe-up dismiss but don't scroll content
      } else {
        this._scrollY = Math.max(0, Math.min(this._maxScroll,
          this._dragStartScroll + (this._dragStartY - p.y)))
        this._applyScroll()
      }

      this._lastDragY    = p.y
      this._lastDragTime = now
    }

    this._onUp = (p) => {
      const wasInPanel   = this._dragging && this._inPanelDrag
      const savedVel     = this._dragVelocity
      this._dragging     = false
      this._inPanelDrag  = false
      this._dragVelocity = 0

      if (!wasInPanel) {
        if (this._scrolling && !this._paused && !this._atTop && !this._rafId) {
          this._rafId = requestAnimationFrame(this._tick.bind(this))
        }
        return
      }

      const dy   = Math.abs(p.y - this._tapStartY)
      const dt   = performance.now() - this._tapStartTime
      const tap  = dy < 12 && dt < 300

      // Encounter cards have buttons handle their own taps.
      // Swipe-up only dismisses cards WITHOUT buttons (pure examine).
  



if (this.currentPanelType === 'encounter_card') {
  if (tap) return
  const hasButtons     = this._buttons.length > 0
  const fullyScrolled  = this._maxScroll <= 0 || this._scrollY >= this._maxScroll
  if (!hasButtons && savedVel < -DISMISS_VEL && fullyScrolled) {
    // This is how a reply card gets dismissed. If the conversation loops
    // back afterwards, keep the background alive so only the text swaps.
    this.hide(this._keepChromeOnHide)
    return
  }
  // Feed swipe velocity into the scroll tick for momentum
  if (Math.abs(savedVel) > 0.05) {
    const fv = -(savedVel * (1000 / 60))
    this._velocity = Math.max(-(SCROLL_PX_PER_SEC / 60) * 2,
                    Math.min((SCROLL_PX_PER_SEC / 60) * 14, fv))
    if (!this._rafId && this._scrolling)
      this._rafId = requestAnimationFrame(this._tick.bind(this))
  }
  return
}





      if (tap) {
        this._paused = true
        if (this._pauseTimer) clearTimeout(this._pauseTimer)
        this._pauseTimer = setTimeout(() => {
          this._paused = false; this._pauseTimer = null
          this._velocity = SCROLL_PX_PER_SEC / 60
          if (this._atTop) this._onReachTop()
          else if (!this._rafId && this._scrolling)
            this._rafId = requestAnimationFrame(this._tick.bind(this))
        }, PAUSE_MS)
        return
      }

      if (savedVel < -DISMISS_VEL) { this.hide(); return }

      const fv = -(savedVel * (1000 / 60))
      this._velocity = Math.max(-(SCROLL_PX_PER_SEC / 60) * 2,
                        Math.min((SCROLL_PX_PER_SEC / 60) * 14, fv))
      if (!this._rafId && this._scrolling)
        this._rafId = requestAnimationFrame(this._tick.bind(this))
    }

    this.scene.input.on('pointerdown', this._onDown)
    this.scene.input.on('pointermove', this._onMove)
    this.scene.input.on('pointerup',   this._onUp)
  }

  _unbindInput() {
    if (this._onDown) { this.scene.input.off('pointerdown', this._onDown); this._onDown = null }
    if (this._onMove) { this.scene.input.off('pointermove', this._onMove); this._onMove = null }
    if (this._onUp)   { this.scene.input.off('pointerup',   this._onUp);   this._onUp   = null }
  }

  _inBounds(p) {
    if (!this._bounds) return false
    const { x, y, w, h } = this._bounds
    return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h
  }

  // -- Cooldown --

  _startCooldown() {
    if (this._lastTriggerId) {
      this._cooldownId = this._lastTriggerId
      setTimeout(() => { this._cooldownId = null }, COOLDOWN_MS)
    }
  }

  // -- Other panel types --

  _buildNotification(irish, english, sw, sh) {
    const pw = sw * 0.88, ph = 90
    const px = sw / 2,   py = sh * 0.18
    const bg = this.scene.add.graphics().setScrollFactor(0).setDepth(2000)
    bg.fillStyle(0x0a1a0a, 0.95); bg.lineStyle(2, 0x6a9a6a, 0.9)
    bg.fillRoundedRect(px - pw/2, py - ph/2, pw, ph, 6)
    bg.strokeRoundedRect(px - pw/2, py - ph/2, pw, ph, 6)
    this._objects.push(bg)

    const ga = this.scene.add.text(px, py - 14, irish, {
      fontSize: '18px', fontFamily: IRISH_FONT, color: IRISH_COLOR,
      wordWrap: { width: pw * 0.85 }
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2001)
    this._objects.push(ga)
    this.irishTextObject = ga

    const en = this.scene.add.text(px, py + ga.height - 8, english, {
      fontSize: '14px', fontFamily: ENGLISH_FONT, color: ENGLISH_COLOR,
      wordWrap: { width: pw * 0.85 }
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2001).setAlpha(GameSettings.englishOpacity)
    this._objects.push(en); this._enObjects.push(en)
    this.englishTextObject = en

    this.scene.time.delayedCall(3000, () => { if (this.isVisible) this.hide() })
  }

  _buildChatOptions(irish, english, options, onChoice, speaker, sw, sh) {
    this.englishOptionTexts = []
    const pw = sw * 0.9, ph = sh * 0.5
    const px = sw / 2,   py = sh - ph / 2

    const bg = this.scene.add.graphics().setScrollFactor(0).setDepth(2000)
    bg.fillStyle(PANEL_FILL, PANEL_ALPHA); bg.lineStyle(4, PANEL_BORDER, 1)
    bg.fillRoundedRect(px - pw/2, py - ph/2, pw, ph, 8)
    bg.strokeRoundedRect(px - pw/2, py - ph/2, pw, ph, 8)
    this._objects.push(bg)

    let ty = py - ph/2 + 28
    const tx = sw * 0.07

    if (speaker) {
      const sp = this.scene.add.text(tx, ty, speaker, {
        fontSize: '18px', fontFamily: IRISH_FONT, color: SPEAKER_COLOR, fontStyle: 'bold'
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(2001)
      this._objects.push(sp); ty += sp.height + 8
    }

    const ga = this.scene.add.text(tx, ty, irish, {
      fontSize: '20px', fontFamily: IRISH_FONT, color: IRISH_COLOR,
      wordWrap: { width: sw * 0.82 }, lineSpacing: 4
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(2001)
    this._objects.push(ga); this.irishTextObject = ga

    const en = this.scene.add.text(tx, ty + ga.height + 10, english, {
      fontSize: '15px', fontFamily: ENGLISH_FONT, color: ENGLISH_COLOR,
      wordWrap: { width: sw * 0.82 }, lineSpacing: 4
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(2001).setAlpha(GameSettings.englishOpacity)
    this._objects.push(en); this._enObjects.push(en); this.englishTextObject = en

    let oy = ty + ga.height + en.height + 30
    options.forEach((opt, i) => {
      const btn = this.scene.add.rectangle(sw/2, oy, sw * 0.8, 64, 0x1b2a1b, 1)
        .setScrollFactor(0).setDepth(2001)
        .setStrokeStyle(2, 0xd4af37).setInteractive({ useHandCursor: true })
      this._objects.push(btn)

      const oga = this.scene.add.text(sw/2, oy - 12, opt.irish || opt.ga || '', {
        fontSize: '18px', fontFamily: IRISH_FONT, color: IRISH_COLOR,
        wordWrap: { width: sw * 0.72 }
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002)
      this._objects.push(oga)

      const oen = this.scene.add.text(sw/2, oy + oga.height - 8, opt.english || opt.en || '', {
        fontSize: '14px', fontFamily: ENGLISH_FONT, color: ENGLISH_COLOR,
        wordWrap: { width: sw * 0.72 }
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002).setAlpha(GameSettings.englishOpacity)
      this._objects.push(oen); this._enObjects.push(oen)
      this.englishOptionTexts.push(oen)

      btn.on('pointerover', () => btn.setFillStyle(0x2a3a2a).setStrokeStyle(3, 0xffd700))
      btn.on('pointerout',  () => btn.setFillStyle(0x1b2a1b).setStrokeStyle(2, 0xd4af37))
      btn.on('pointerdown', () => {
        this.hide()
        this.scene.time.delayedCall(100, () => { if (onChoice) onChoice(i, opt) })
      })
      oy += 80
    })
  }

  _buildArcheryPrompt(irish, english, sw, sh) {
    const pw = sw * 0.9, ph = 100
    const px = sw / 2,   py = ph / 2 + 20

    const bg = this.scene.add.graphics().setScrollFactor(0).setDepth(2000)
    bg.fillStyle(0x1a2a3a, 0.95); bg.lineStyle(4, PANEL_BORDER, 1)
    bg.fillRoundedRect(px - pw/2, py - ph/2, pw, ph, 8)
    bg.strokeRoundedRect(px - pw/2, py - ph/2, pw, ph, 8)
    this._objects.push(bg)

    const ga = this.scene.add.text(sw/2, 35, irish, {
      fontSize: '22px', fontFamily: IRISH_FONT, color: IRISH_COLOR,
      fontStyle: 'bold', wordWrap: { width: pw * 0.8 }
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2001)
    this._objects.push(ga); this.irishTextObject = ga

    const en = this.scene.add.text(sw/2, 35 + ga.height + 6, english, {
      fontSize: '16px', fontFamily: ENGLISH_FONT, color: ENGLISH_COLOR,
      wordWrap: { width: pw * 0.8 }
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2001).setAlpha(GameSettings.englishOpacity)
    this._objects.push(en); this._enObjects.push(en); this.englishTextObject = en
  }

  // -- Cleanup --

  /**
   * Fade out and drop the persistent encounter-card chrome. Called by
   * EncounterPanel._onPanelClosed() -- i.e. once per conversation, not
   * once per card. Safe to call when there is no chrome.
   */
  releaseChrome() {
    if (!this._chrome.length) { this._chromeGeom = null; return }
    const targets = [...this._chrome]
    this._chrome     = []
    this._chromeGeom = null
    this.scene.tweens.add({
      targets,
      alpha: 0,
      duration: FADE_MS,
      ease: 'Linear',
      onComplete: () => targets.forEach(o => { if (o?.active) o.destroy() }),
    })
  }

  _destroyAll(keepChrome = false) {
    this._keepChromeOnHide = false
    if (!keepChrome) {
      this._chrome.forEach(o => { if (o?.active) o.destroy() })
      this._chrome     = []
      this._chromeGeom = null
    }
    this._stopScroll()
    this._unbindInput()
    if (this._maskGfx) { this._maskGfx.destroy(); this._maskGfx = null }
    // createButton-managed objects: destroy via their own destroy method
    this._buttons.forEach(b => b.destroy())
    this._buttons = []
    this._objects.forEach(o => { if (o?.active) o.destroy() })
    this._objects         = []
    this._enObjects       = []
    this._contentItems    = []
    this.englishOptionTexts = []
    this.irishTextObject  = null
    this.englishTextObject = null
    this._dragging        = false
    this._inPanelDrag     = false
    this._dragVelocity    = 0
    this._bounds          = null
    this._clipTop         = 0
    this._clipBottom      = 9999
    this.isVisible        = false
    this.isFading         = false
    this._fadeStartTime   = 0
    this.currentPanelType = null
    this._isExamine       = false
  }
}


/**
 * encounterPanel.js
 *
 * Encounter UI for Corra.
 *
 * Handles two encounter types:
 *
 *   encounter_flag  (random)
 *     Proximity flow: badge on moon -> tap moon -> panel opens -> choice ->
 *     outcome -> flag consumed (marked collected, cleared from map).
 *
 *   fixed_encounter (narrative)
 *     Same proximity/badge flow, but the flag is NEVER consumed.
 *     Dialogue cycles via GameState.npcProgress.
 *     Conditional dialogues (requires: { note } / { quest }) are skipped
 *     if the condition is not met.
 *
 * Panel rendering is delegated to TextPanel's `encounter_card` type.
 *
 * Outcome types (random encounters only):
 *   loot     -- play sound, show outcome text, mark collected, clear flag
 *   persist  -- close panel, leave flag on map
 *   dismiss  -- show outcome text (if any), mark collected, clear flag
 *
 * Voice synthesis: stripped — to be reconnected via voiceSynth.js later.
 */

import { GameSettings } from '../settings/gameSettings.js'
import { GameState }    from '../systems/gameState.js'
import { SoundBoard }   from '../systems/soundBoard.js'

const BADGE_FADE_MS   = 400
const CLEAR_DELAY_MS  = 800
const CHAIN_BUFFER_MS = 60

const CARD_BG_KEY = 'encounterPanelBG'

// Appended to any options list that doesn't declare its own exit, so a
// conversation that loops can always be left. Override per node by marking
// one of the node's own options `exit: true` (with whatever wording suits
// the speaker -- 'Slán agat.', 'Fágfaidh mé thú.', etc.)
const DEFAULT_EXIT_OPTION = { ga: 'Slán.', en: 'Goodbye.', exit: true }

export class EncounterPanel {

  constructor(scene, moonWidget) {
    this._scene      = scene
    this._moonWidget = moonWidget
    this._active     = null
    this._card       = null
    this._isOpen     = false
    this._choiceMade = false
    this._clearTimer = null
    this._chainTimer = null

    this._buildBadge()
  }

  // -- Badge -----------------------------------------------------------------

  _buildBadge() {
    const moonElement = this._moonWidget?.element

    const moonCanvas = this._moonWidget?.getCanvas?.()
      ?? moonElement?.querySelector('canvas')
      ?? null

    const size = moonCanvas
      ? (moonCanvas.offsetWidth || moonCanvas.width || 48)
      : 48

    const badge = document.createElement('canvas')
    badge.width  = size
    badge.height = size
    badge.style.cssText = [
      'position:absolute',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%)',
      `width:${size}px`,
      `height:${size}px`,
      'border-radius:50%',
      'cursor:pointer',
      'display:none',
      'opacity:0',
      `transition:opacity ${BADGE_FADE_MS}ms ease`,
      'z-index:2',
      'pointer-events:all',
    ].join(';')

    badge.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      if (this._card?.id === 'disembark') {
        this._scene.boatSystem && this._scene._doDisembark?.()
        this.clearNotify()
        if (this._scene) {
          this._scene._disembarkBadgeShown = false
          this._scene.joystick?.drawBadgeGlow?.(0)
        }
        return
      }
      this._openPanel()
    })

    const hubEl = document.getElementById('dpad-moon-hub')
    const parent = moonElement ?? hubEl

    if (parent) {
      parent.appendChild(badge)
    } else {
      document.body.appendChild(badge)
      console.warn('[EncounterPanel] could not find moon element to attach badge')
    }

    this._badgeEl = badge
  }

  // -- Notify ----------------------------------------------------------------

  notify(card, zoneObj) {
    if (this._isOpen) return
    if (this._clearTimer) { clearTimeout(this._clearTimer); this._clearTimer = null }
    if (this._card?.id === card.id) return
    this._card   = card
    this._active = zoneObj
    this._showBadge(card.visual)
  }

clearNotify() {
  if (this._isOpen) return
  if (this._clearTimer) return   // already counting down — let it finish
  this._clearTimer = setTimeout(() => {
    this._hideBadge()
    this._card       = null
    this._active     = null
    this._clearTimer = null
  }, CLEAR_DELAY_MS)
} 

  // -- Badge helpers ---------------------------------------------------------

  _showBadge(visual) {
    const badge = this._badgeEl
    badge.style.display = 'block'

    if (visual?.gid) {
      const src = this._scene.perspectiveGround?._getTileCanvas(visual.gid)
      if (src) {
        const ctx = badge.getContext('2d')
        ctx.clearRect(0, 0, badge.width, badge.height)
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(src, 0, 0, badge.width, badge.height)
      }
    }

    requestAnimationFrame(() => { badge.style.opacity = '1' })

    const audioCtx = this._scene?.sound?.context
    if (audioCtx) SoundBoard.playWeb('BADGE_APPEAR', audioCtx)
  }

  _hideBadge() {
    this._badgeEl.style.opacity = '0'
    setTimeout(() => { this._badgeEl.style.display = 'none' }, BADGE_FADE_MS)
  }

  // -- Graphic key resolution -----------------------------------------------

  _resolveGraphicKey(visual) {
    if (!visual?.gid) return null
    const src = this._scene.perspectiveGround?._getTileCanvas(visual.gid)
    if (!src) return null
    const key = `enc_graphic_${visual.gid}`
    if (!this._scene.textures.exists(key)) {
      this._scene.textures.addCanvas(key, src)
    }
    return this._scene.textures.exists(key) ? key : null
  }

  _resolveBgKey() {
    return this._scene.textures.exists(CARD_BG_KEY) ? CARD_BG_KEY : null
  }

  // -- Open panel ------------------------------------------------------------

  _openPanel() {
    SoundBoard.playWeb('ENCOUNTER_OPEN')
    if (!this._card || this._isOpen) return

    const zone = this._active
    const type = zone?.getData('type')

    if (type === 'fixed_encounter') {
      this._openFixedEncounter(zone)
    } else {
      this._openRandomEncounter()
    }
  }

  // -- Fixed encounter -------------------------------------------------------

  _openFixedEncounter(zone) {
    this._isOpen     = true
    this._choiceMade = false
    // Which nodes and options this conversation has already used. Per
    // conversation, not per save -- come back tomorrow and she hails you
    // properly again.
    this._seenNodes   = new Set()
    this._usedOptions = new Set()
    this._hideBadge()

    if (this._scene.textPanel?.isVisible) this._scene.textPanel.hide()
    if (this._scene.joystick) this._scene.joystick.reset()
    if (this._scene.player)   this._scene.player.isMoving = false

    // Conversation mode: the d-pad goes away for the duration. Its buttons
    // sit directly under the card and a mistap walks the player off across
    // the map mid-sentence. The moon hub stays -- it is the translation
    // control, and the card is now drawn around it. Same treatment the
    // harp overlay uses.
    this._scene.joystick?.hideDirections?.()

    const stateKey  = zone.getData('stateKey')
    const dialogues = zone.getData('dialogues') || []
    if (!dialogues.length) { this._onPanelClosed(); return }

    const baseIndex = GameState.getNPCProgress(stateKey)
    const total     = dialogues.length
    let chosen = null, chosenIdx = baseIndex

    for (let i = 0; i < total; i++) {
      const idx = (baseIndex + i) % total
      const d   = dialogues[idx]
      if (this._requiresMet(d.requires)) { chosen = d; chosenIdx = idx; break }
    }
    if (!chosen) { this._onPanelClosed(); return }

    this._showDialogue(chosen, chosenIdx, stateKey, total, zone)
  }

  /**
   * Render one dialogue node.
   *
   *   { ga, en,
   *     requires: { note, noteAbsent, quest, questActive, questComplete, questAbsent },
   *     note, setQuest, completeQuest,     -- effects, applied when the line shows
   *     hold: true,                        -- stay on this line, do not advance
   *     options: [ { ga, en, requires, note, setQuest, completeQuest,
   *                  replyGa, replyEn, hold, exit } ] }
   */
  _showDialogue(d, idx, stateKey, total, zone) {
    const bgKey      = this._resolveBgKey()
    const graphicKey = this._resolveGraphicKey(zone.getData('visual'))

    this._applyEffects(d)
    this._choiceMade = false

    // Greeting-ladder nodes build their own options each rung -- but only
    // auto-start when the node has none of its own. A node that carries BOTH
    // (opening replies, one of which is enterLadder) must show its options
    // first; the duel is entered deliberately, not fallen into. Once the
    // ladder is running, this._ladder keeps us in it.
    if (d.ladder && (this._ladder || !d.options?.length)) {
      this._showLadderRung(d, idx, stateKey, total, zone); return
    }

    // Second time through this node, she does not re-deliver the whole hail.
    // This is what stops an NPC re-asking a question the player has already
    // answered every time they loop back for another question.
    const seen  = this._seenNodes?.has(idx)
    const line  = (seen && d.again) ? d.again : d
    if (this._seenNodes) this._seenNodes.add(idx)

    const opts = Array.isArray(d.options)
      ? d.options.filter(o => this._requiresMet(o.requires))
                 .filter(o => !(o.first && this._usedOptions?.has(this._optKey(idx, o))))
      : []

    // A node with questions loops back to itself after each answer, so it
    // needs a way out. If the content didn't provide one, add it.
    if (opts.length && !opts.some(o => o.exit)) opts.push(DEFAULT_EXIT_OPTION)

    if (opts.length) {
      this._scene.textPanel.show({
        irish:   line.ga || line.irish   || '',
        english: line.en || line.english || '',
        type:    'encounter_card',
        bgKey,
        graphicKey,
        options: opts.map(o => ({ ga: o.ga || '', en: o.en || '' })),
        onChoice: (i) => {
          this._choiceMade = true
          SoundBoard.playWeb('ENCOUNTER_CHOICE')
          this._resolveOption(opts[i], d, idx, stateKey, total, zone)
        },
        onDismiss: () => { if (!this._choiceMade) this._onPanelClosed() },
      })
      return
    }

    this._scene.textPanel.show({
      // again-line applies to option-less nodes too
      irish:   line.ga || line.irish   || '',
      english: line.en || line.english || '',
      type:    'encounter_card',
      bgKey,
      graphicKey,
      options: null,
      onDismiss: () => {
        if (!d.hold) GameState.setNPCProgress(stateKey, (idx + 1) % total)
        this._onPanelClosed()
      }
    })
  }

  // -- Greeting ladder --------------------------------------------------------

  /**
   * One rung. Re-entered after every exchange with depth + 1 until the player
   * steps out of the form. Because this re-renders the SAME node rather than
   * walking to a new one, the card chrome stays up throughout and the whole
   * duel reads as one continuous conversation.
   */
  _showLadderRung(d, idx, stateKey, total, zone) {
    const L     = d.ladder
    const pool  = L.pool || []
    // `stack` holds the accumulated fragments. It was missing from this lazy
    // init (only the enterLadder path built it), so the first frag threw.
    const st    = this._ladder || (this._ladder = { depth: 0, used: [], stack: [] })
    if (!st.stack) st.stack = []
    const depth = st.depth

    // Her line: the node's own ga/en opens the exchange, then `hers` takes
    // over. Runs out gracefully -- last entry repeats rather than going blank.
    const herLine = depth === 0
      ? { ga: d.ga || '', en: d.en || '' }
      : (L.hers?.[Math.min(depth - 1, (L.hers?.length || 1) - 1)] || { ga: '', en: '' })

    // Candidates: unspent, and preferring this rung's register. Topped up
    // from neighbouring tiers so a thin pool still fills the card.
    // Fragments already spoken -- shown so the player can see the chain they
    // are building before they add to it.
    const unused = pool.filter(p => !st.used.includes(p.id))
    const byDist = [...unused].sort((a, b) =>
      Math.abs((a.tier ?? 0) - depth) - Math.abs((b.tier ?? 0) - depth))
    const offer  = byDist.slice(0, L.offer || 3)

    // The step out of the form is itself part of the form, so it is written
    // content, not a bare 'Goodbye'. Marked exitLadder rather than exit: it
    // ends the DUEL, not the conversation -- she still has to give directions.
    const exitOpt = { ...(L.exit || { ga: 'Go raibh maith agat.', en: 'Thank you.' }),
                      exitLadder: true }
    const opts = [...offer, exitOpt]

    this._scene.textPanel.show({
      irish:   herLine.ga,
      english: herLine.en,
      type:    'encounter_card',
      bgKey:      this._resolveBgKey(),
      graphicKey: this._resolveGraphicKey(zone.getData('visual')),
      options: opts.map(o => ({ ga: o.ga || '', en: o.en || '' })),
      onChoice: (i) => {
        this._choiceMade = true
        SoundBoard.playWeb('ENCOUNTER_CHOICE')
        this._resolveLadderChoice(opts[i], d, idx, stateKey, total, zone)
      },
      onDismiss: () => { if (!this._choiceMade) this._onPanelClosed() },
    })
  }

  /**
   * The hero re-speaks the whole accumulated chain, the way a real greeting
   * ladder does -- each rung repeats what came before and adds one:
   *     Bail na habhann ort
   *     Bail na habhann is na taoide ort
   *     Bail na habhann is na taoide is na gcorr réisc ort
   * Shape comes from the content (stackPrefix / stackJoin / stackSuffix),
   * not from the code, so a different formula needs no code change.
   */
  _ladderSay(L, stack, key) {
    const frags = stack.map(f => f[key]).filter(Boolean)
    if (!frags.length) return ''
    const join   = (key === 'ga' ? L.stackJoin   : L.stackJoinEn)   ?? ' is '
    const prefix = (key === 'ga' ? L.stackPrefix : L.stackPrefixEn) ?? ''
    const suffix = (key === 'ga' ? L.stackSuffix : L.stackSuffixEn) ?? ''
    return [prefix, frags.join(join), suffix].filter(Boolean).join(' ')
  }

  _resolveLadderChoice(opt, d, idx, stateKey, total, zone) {
    this._applyEffects(opt)          // pool entries may set notes (invoked_heron)

    if (opt.exitLadder) {
      // Leave the duel and move to the next node -- typically the one that
      // actually gives directions. The panel does not close.
      this._ladder = null
      if (!d.hold) GameState.setNPCProgress(stateKey, (idx + 1) % total)
      if (opt.replyGa || opt.replyEn) {
        this._chainShow({
          irish:   opt.replyGa || '', english: opt.replyEn || '',
          type:    'encounter_card',
          bgKey:      this._resolveBgKey(),
          graphicKey: this._resolveGraphicKey(zone.getData('visual')),
          options: null,
          keepChromeOnHide: true,
          onDismiss: () => this._reopenDialogue(zone),
        })
      } else {
        this._reopenDialogue(zone)
      }
      return
    }

    // Spend the invocation and climb.
    if (opt.id) this._ladder.used.push(opt.id)
    if (opt.frag) this._ladder.stack.push(opt.frag)
    this._ladder.depth += 1

    // An explicit `say` overrides the accumulator, for rungs that break the
    // pattern on purpose.
    const L      = d.ladder
    const heroGa = opt.say   || this._ladderSay(L, this._ladder.stack, 'ga')
    const heroEn = opt.sayEn || this._ladderSay(L, this._ladder.stack, 'en')

    this._replyCard(opt, zone,
      () => this._showLadderRung(d, idx, stateKey, total, zone),
      heroGa, heroEn)
  }

  /** Stable identity for an option, for the used-once set. */
  _optKey(idx, opt) { return idx + '|' + (opt.id || opt.ga || opt.en || '') }

  _resolveOption(opt, d, idx, stateKey, total, zone) {
    this._applyEffects(opt)
    this._usedOptions?.add(this._optKey(idx, opt))

    // An option can hand off into the greeting ladder on the same node.
    if (opt.enterLadder && d.ladder) {
      this._ladder = { depth: 0, used: [], stack: [] }
      if (opt.replyGa || opt.replyEn || opt.say) {
        this._replyCard(opt, zone, () => this._showLadderRung(d, idx, stateKey, total, zone))
      } else {
        this._showLadderRung(d, idx, stateKey, total, zone)
      }
      return
    }

    const hold = (opt.hold !== undefined) ? opt.hold : d.hold
    if (!hold) GameState.setNPCProgress(stateKey, (idx + 1) % total)

    // Where the reply's dismissal leads. An explicit exit ends the exchange;
    // anything else returns to the question list. Note this re-runs node
    // selection rather than re-showing the same node object: if this option
    // advanced npcProgress, or set a quest that opens a `requires` gate, the
    // player comes back to the NEXT node's questions without the panel ever
    // closing. That is what makes a chain of questions feel like one
    // conversation instead of several.
    const after = opt.exit
      ? () => this._onPanelClosed()
      : () => this._reopenDialogue(zone)

    if (opt.replyGa || opt.replyEn || opt.say || opt.sayEn) {
      this._chainShow({
        irish:      opt.replyGa || '',
        english:    opt.replyEn || '',
        heroGa:     opt.say   || '',
        heroEn:     opt.sayEn || '',
        type:       'encounter_card',
        bgKey:      this._resolveBgKey(),
        graphicKey: this._resolveGraphicKey(zone.getData('visual')),
        options:    null,
        // Unless this option ends the exchange, the reply is a step on the
        // way back to the question list -- so its dismissal must not take
        // the card's background with it.
        keepChromeOnHide: !opt.exit,
        onDismiss:  after,
      })
    } else {
      after()
    }
  }

  /**
   * Re-resolve and re-show whichever dialogue node currently applies, without
   * closing the panel. The card chrome is still standing (TextPanel keeps it
   * alive across an exchange), so this reads as the same conversation
   * continuing, not a new one starting.
   */
  _reopenDialogue(zone) {
    if (!this._isOpen) return

    const stateKey  = zone.getData('stateKey')
    const dialogues = zone.getData('dialogues') || []
    if (!dialogues.length) { this._onPanelClosed(); return }

    const baseIndex = GameState.getNPCProgress(stateKey)
    const total     = dialogues.length

    for (let i = 0; i < total; i++) {
      const idx = (baseIndex + i) % total
      if (this._requiresMet(dialogues[idx].requires)) {
        this._showDialogue(dialogues[idx], idx, stateKey, total, zone)
        return
      }
    }
    this._onPanelClosed()
  }

  /**
   * Build the card that follows a choice: the hero's spoken line on top,
   * the NPC's answer below. `say`/`sayEn` on an option is the full literary
   * version of whatever the button said in shorthand.
   */
  _replyCard(opt, zone, onDismiss, heroGa, heroEn) {
    this._chainShow({
      irish:   opt.replyGa || '',
      english: opt.replyEn || '',
      heroGa:  heroGa ?? opt.say   ?? '',
      heroEn:  heroEn ?? opt.sayEn ?? '',
      type:    'encounter_card',
      bgKey:      this._resolveBgKey(),
      graphicKey: this._resolveGraphicKey(zone.getData('visual')),
      options: null,
      keepChromeOnHide: true,
      onDismiss,
    })
  }

  /** Side effects declared on a dialogue node, option, or outcome. Idempotent. */
  _applyEffects(src) {
    if (!src) return
    if (src.note)          GameState.addNote(src.note)
    if (src.setQuest)      GameState.setQuest(src.setQuest, 'active')
    if (src.completeQuest) GameState.setQuest(src.completeQuest, 'complete')
  }

  _requiresMet(requires) {
    if (!requires) return true
    if (requires.note          && !GameState.hasNote(requires.note))                  return false
    if (requires.noteAbsent    &&  GameState.hasNote(requires.noteAbsent))            return false
    if (requires.quest         && !GameState.isQuestActive(requires.quest)
                               && !GameState.isQuestComplete(requires.quest))         return false
    if (requires.questActive   && !GameState.isQuestActive(requires.questActive))     return false
    if (requires.questComplete && !GameState.isQuestComplete(requires.questComplete)) return false
    if (requires.questAbsent   &&  GameState.getQuest(requires.questAbsent) !== 'inactive') return false
    return true
  }

  // -- Random encounter ------------------------------------------------------

  _openRandomEncounter() {
    this._isOpen     = true
    this._choiceMade = false
    this._hideBadge()

    if (this._scene.textPanel?.isVisible) this._scene.textPanel.hide()

    const card       = this._card
    const hasActions = card.actions?.length > 0

    if (this._scene.joystick) this._scene.joystick.reset()
    if (this._scene.player)   this._scene.player.isMoving = false

    const bgKey      = this._resolveBgKey()
    const graphicKey = this._resolveGraphicKey(card.visual)

    if (hasActions) {
      const options = card.actions.map(a => ({
        ga: a.labelGa || '',
        en: a.labelEn || '',
      }))

      this._scene.textPanel.show({
        irish:    card.ga || '',
        english:  card.en || '',
        type:     'encounter_card',
        bgKey,
        graphicKey,
        options,
        onChoice:  (i) => {
          this._choiceMade = true
          SoundBoard.playWeb('ENCOUNTER_CHOICE')
          this._resolveAction(card.actions[i])
        },
        onDismiss: () => { if (!this._choiceMade) this._onPanelClosed() },
      })
    } else {
      this._scene.textPanel.show({
        irish:   card.ga || '',
        english: card.en || '',
        type:    'encounter_card',
        bgKey,
        graphicKey,
        options: null,
        onDismiss: () => this._finalDismiss(),
      })
    }
  }

  // -- Chained show ----------------------------------------------------------

  _chainShow(config) {
    const tp = this._scene.textPanel
    if (!tp) return

    if (this._chainTimer) { clearTimeout(this._chainTimer); this._chainTimer = null }

    const wait = (typeof tp.getFadeRemaining === 'function') ? tp.getFadeRemaining() : 0

    if (wait <= 0) {
      tp.show(config)
      return
    }

    this._chainTimer = setTimeout(() => {
      this._chainTimer = null
      if (!this._isOpen) return
      tp.show(config)
    }, wait + CHAIN_BUFFER_MS)
  }

  // -- Resolve action (random encounters) ------------------------------------

  _resolveAction(action) {
    const outcome = action?.outcome
    this._applyEffects(action)
    this._applyEffects(outcome)
    if (!outcome) { this._finalDismiss(); return }

    const card       = this._card
    const bgKey      = this._resolveBgKey()
    const graphicKey = this._resolveGraphicKey(card?.visual)

    switch (outcome.type) {
      case 'loot': {
        SoundBoard.play('LOOT_COLLECT', this._scene)
        if (outcome.textGa || outcome.textEn) {
          this._chainShow({
            irish:    outcome.textGa || '',
            english:  outcome.textEn || '',
            type:     'encounter_card',
            bgKey,
            graphicKey,
            options:  null,
            onDismiss: () => this._finalDismiss(),
          })
        } else {
          this._finalDismiss()
        }
        break
      }
      case 'persist':
        this._onPanelClosed()
        break
      case 'dismiss':
      default:
        if (outcome.textGa || outcome.textEn) {
          this._chainShow({
            irish:    outcome.textGa || '',
            english:  outcome.textEn || '',
            type:     'encounter_card',
            bgKey,
            graphicKey,
            options:  null,
            onDismiss: () => this._finalDismiss(),
          })
        } else {
          this._finalDismiss()
        }
        break
    }
  }

  // -- Dismiss helpers -------------------------------------------------------

  _finalDismiss() {
    SoundBoard.playWeb('ENCOUNTER_DISMISS')
    const obj      = this._active
    const stateKey = obj?.getData('stateKey')

    if (stateKey && window.GameState) window.GameState.setCollected(stateKey)

    const lx = obj?.getData('logicalX')
    const ly = obj?.getData('logicalY')
    if (lx != null && this._scene.perspectiveGround) {
      const ftx = Math.round((lx - this._scene.tileSize / 2) / this._scene.tileSize)
      const fty = Math.round((ly - this._scene.tileSize / 2) / this._scene.tileSize)
      this._scene.perspectiveGround.clearEncounterFlag(ftx, fty)
      this._scene.perspectiveGround.forceRedraw()
    }

    if (obj && this._scene.interactables) {
      const idx = this._scene.interactables.indexOf(obj)
      if (idx > -1) this._scene.interactables.splice(idx, 1)
    }

    this._onPanelClosed()
  }

  _onPanelClosed() {
    if (this._chainTimer) { clearTimeout(this._chainTimer); this._chainTimer = null }
    // Ladder depth is per-conversation, not per-save: the duel is playable
    // again on a later visit. Notes it set (invoked_heron etc.) persist.
    this._ladder      = null
    this._seenNodes   = null
    this._usedOptions = null
    // End of the exchange: give the d-pad back and let the card's persistent
    // background fade out (it is deliberately kept alive between choices).
    this._scene?.joystick?.showDirections?.()
    this._scene?.textPanel?.releaseChrome?.()
    this._isOpen     = false
    this._choiceMade = false
    this._card       = null
    this._active     = null
    if (this._scene) this._scene._lastWasFar = false
    if (this._scene?.perspectiveGround) this._scene.perspectiveGround.forceRedraw()
  }

  // -- Language update -------------------------------------------------------

  updateLanguageOpacity() {
    if (this._scene?.textPanel?.updateEnglishOpacity) {
      this._scene.textPanel.updateEnglishOpacity()
    }
  }

  // -- Destroy ---------------------------------------------------------------

  destroy() {
    if (this._clearTimer) clearTimeout(this._clearTimer)
    if (this._chainTimer) clearTimeout(this._chainTimer)
    if (this._badgeEl?.parentNode) this._badgeEl.parentNode.removeChild(this._badgeEl)
    this._scene = null
  }
}


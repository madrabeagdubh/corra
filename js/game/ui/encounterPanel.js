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
 * Voice synthesis:
 *   Fixed encounters can have a voice assigned via ENCOUNTER_VOICES below.
 *   Voice instances are created lazily and destroyed with the panel.
 *   Add entries to ENCOUNTER_VOICES to assign voices to encounter ids.
 */

import { GameSettings } from '../settings/gameSettings.js'
import { GameState }    from '../systems/gameState.js'
import { createVoice, VOICES, DING_DONG_PITCHES } from '../systems/voice/voiceSynth.js'
import { SoundBoard } from '../systems/soundBoard.js'

const BADGE_FADE_MS   = 400
const CLEAR_DELAY_MS  = 800
const CHAIN_BUFFER_MS = 60

const CARD_BG_KEY = 'encounterPanelBG'

// ────────────────────────────────────────────────────────────────────────────
// VOICE REGISTRY
// Maps encounter id (from map content files) to a voice config and mode.
// mode: 'song'   -- pitch follows opts.pitches pool (cycling)
// mode: 'speech' -- pitch follows a generated speech contour
// ────────────────────────────────────────────────────────────────────────────

const ENCOUNTER_VOICES = {
  blacksmith_singing: {
    voiceDef: VOICES.blacksmith,
    mode:     'song',
    pitches:  DING_DONG_PITCHES,
  },

  seanbean_na_mara: {
    voiceDef: VOICES.cailin,
    mode:     'speech',
  },

  // Future entries:
  // skull_north: { voiceDef: VOICES.banshee,    mode: 'speech' },
  // skull_south: { voiceDef: VOICES.oldWarrior, mode: 'speech' },
}

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
    this._voices     = {}   // encounter id -> createVoice() instance, lazily created

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
    if (this._clearTimer) clearTimeout(this._clearTimer)
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

    // ── BADGE_APPEAR sound ────────────────────────────────────────────────
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
    this._isOpen = true
    this._hideBadge()

    if (this._scene.textPanel?.isVisible) this._scene.textPanel.hide()
    if (this._scene.joystick) this._scene.joystick.reset()
    if (this._scene.player)   this._scene.player.isMoving = false

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

    const bgKey      = this._resolveBgKey()
    const graphicKey = this._resolveGraphicKey(zone.getData('visual'))

    // -- Voice ---------------------------------------------------------------
    const encId     = zone.getData('id')
    const voiceSpec = ENCOUNTER_VOICES[encId]

    if (voiceSpec) {
      if (!this._voices[encId]) {
        this._voices[encId] = createVoice(voiceSpec.voiceDef)
        console.log(`[EncounterPanel] Voice created for encounter "${encId}"`)
      }
      const voice = this._voices[encId]
      const text  = chosen.ga || chosen.irish || ''

      let style = 'statement'
      if (text.trimEnd().endsWith('?')) style = 'question'
      if (text.trimEnd().endsWith('!')) style = 'exclamation'

      voice.speak(text, {
        mode:    voiceSpec.mode ?? 'speech',
        pitches: voiceSpec.pitches,
        style,
      })
    }
    // -- End voice -----------------------------------------------------------

    this._scene.textPanel.show({
      irish:    chosen.ga || chosen.irish   || '',
      english:  chosen.en || chosen.english || '',
      type:     'encounter_card',
      bgKey,
      graphicKey,
      options:  null,
      onDismiss: () => {
        if (voiceSpec) this._voices[encId]?.stop()
        const nextIdx = (chosenIdx + 1) % total
        GameState.setNPCProgress(stateKey, nextIdx)
        this._onPanelClosed()
      }
    })
  }

  _requiresMet(requires) {
    if (!requires) return true
    if (requires.note          && !GameState.hasNote(requires.note))                                          return false
    if (requires.quest         && !GameState.isQuestActive(requires.quest)
                               && !GameState.isQuestComplete(requires.quest))                                 return false
    if (requires.questComplete && !GameState.isQuestComplete(requires.questComplete))                         return false
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
    if (!outcome) { this._finalDismiss(); return }

    const card       = this._card
    const bgKey      = this._resolveBgKey()
    const graphicKey = this._resolveGraphicKey(card?.visual)

    switch (outcome.type) {
      case 'loot': {
        // ── LOOT_COLLECT sound ─────────────────────────────────────────────
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

    for (const voice of Object.values(this._voices)) {
      try { voice.destroy() } catch(e) {}
    }
    this._voices = {}

    this._scene = null
  }
}


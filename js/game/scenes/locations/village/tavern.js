// tavern.js
// Location: js/game/scenes/locations/village/tavern.js

import VillageScene from '../villageScene.js'
import { HarpPhrasePlayer, buildTimedPhraseFromDurations } from '../../../systems/music/harpPhrasePlayer.js'
import { abcToTimedStringSequence } from '../../../systems/music/abcToPhrase.js'
import { allTunes } from '../../../systems/music/allTunes.js'
import { BardAccompaniment } from '../../../systems/music/bardAccompaniment.js'
import { buildBardSequence } from '../../../systems/music/bardHarmonizer.js'
import { VoiceSynth, syllableCount } from '../../../systems/voice/voiceSynth.js'
import { StoryVisuals } from '../../../effects/storyVisuals.js'

const BARD_LINE_NOTE_TARGET = 3
const BARD_FLOW_DELAY = 250

const BARD_VOICE_ENABLED  = true
const BARD_SPEAKER_VOICE = {
    narrator:  'ronnie',
    forgall:   'forgall',
    muirenn:   'peig',
    tigernach: 'seanchai',
    dallan:    'dallan',
    maebh:     'maebh',
}
const BARD_SPEAKER_COLOR = {
    narrator:  '#fffaf0',
    forgall:   '#f6f8ec',
    muirenn:   '#ebf2f5',
    tigernach: '#f0f8e8',
    dallan:    '#fff4e0',
    maebh:     '#fff0ee',
}
const BARD_SPEAKER_GLOW = {
    narrator:  ['255,221,140', '255,200,90', '255,180,60'],
    forgall:   ['230,235,150', '210,220,110', '190,205,80'],
    muirenn:   ['190,225,255', '150,205,255', '120,180,255'],
    tigernach: ['190,230,160', '150,210,120', '120,190,90'],
    dallan:    ['255,190,150', '255,160,110', '255,130,70'],
    maebh:     ['230,90,90', '210,55,55', '170,30,35'],
}
const BARD_VOICE_TUNE_KEY = 'Ador'
const BARD_SING           = true

const BARD_AUDIO_GAP_MS = 350
const BARD_EN_FADE_MS = 700
const BARD_PAIR_BREATH_MS = 1800

const PRETTY_GIRL_MILKING_HER_COW = `X: 1
T: The Pretty Girl Milking Her Cow
R: waltz
M: 3/4
L: 1/8
K: Ador
L:1/4
A/B/|cee/d/|Bdd/B/|A/B/G2-|G2A/B/|cee/d/|Bdd/B/|A3-|A>B A/B/|
cee/d/|Bgd/B/|A/B/G2-|G>f g/f/|e/d/ c/B/ A/G/|EA>B|A3-|A2:|A/B/|
cc/d/ e/f/|gg/e/ d/B/|A/B/G2-|G2A/B/|cc/d/ e/f/|geg|a3-|a>a b/a/|
gg/e/d/c/|d/g/ G/B/ d/B/|A/4B/4A/G2-|G>f g/f/|e/d/ c/B/ A/G/|EA>B|A3-|A2A/B/||
cc/d/ e/f/|gg/e/ d/B/|A/B/G2-|G2A/B/|cc/d/ e/f/|gc'>b|a3-|a>a b/a/|
gg/e/d/c/|d/g/ G/B/ d/B/|A/4B/4A/^G2-|^G>f g/f/|e/d/ c/B/ A/G/|EA>B|A3|A2||`

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

  static HEARTH_FLAME = {
    ROW_OFFSET:  2,
    GLOW_RADIUS: 30,
    PARTICLES:   16,
  }

  createNPCs() {
    super.createNPCs()
    const prev = this.onPGRDrawComplete
    this.onPGRDrawComplete = (ctx) => { this._drawHearthFlame(ctx); if (prev) prev(ctx) }
  }

  _ensureHearthAnchor() {
    if (this._hearthAnchor !== undefined) return this._hearthAnchor
    const b = (this.mapData?.buildings || []).find(x => x.id === 'hearth')
    if (!b) { this._hearthAnchor = null; return null }
    const F = TavernScene.HEARTH_FLAME
    this._hearthAnchor = {
      x: (b.x + (b.fw ?? 2) / 2) * this.tileSize,
      y: (b.y + F.ROW_OFFSET) * this.tileSize,
    }
    return this._hearthAnchor
  }

  _drawHearthFlame(ctx) {
    const pgr = this.perspectiveGround
    if (!pgr || !pgr._projectLogical) return
    const anchor = this._ensureHearthAnchor()
    if (!anchor) return
    const proj = pgr._projectLogical(anchor.x, anchor.y)
    if (!proj) return
    const { screenX, screenY, scale } = proj
    const F = TavernScene.HEARTH_FLAME
    const now = performance.now()
    const dt = Math.min(now - (this._flameLastT || now), 64)
    this._flameLastT = now
    const unit = scale * pgr.tileDisplaySize
    if (!this._flameParticles) this._flameParticles = []
    const parts = this._flameParticles
    while (parts.length < F.PARTICLES) {
      const ember = Math.random() < 0.16
      parts.push({
        ox: (Math.random() - 0.5) * 0.30, oy: 0,
        vx: (Math.random() - 0.5) * 0.00020,
        vy: -(0.00075 + Math.random() * 0.00065) * (ember ? 0.6 : 1),
        life: 0, max: ember ? 1500 + Math.random() * 900 : 420 + Math.random() * 520,
        ember, seed: Math.random() * 6.28,
      })
    }
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const flick = 0.78 + 0.14 * Math.sin(now * 0.013) + 0.08 * Math.sin(now * 0.041 + 1.3)
    const R = F.GLOW_RADIUS * scale * flick
    if (R > 1) {
      const g = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, R)
      g.addColorStop(0,    `rgba(255,180,90,${(0.30 * flick).toFixed(3)})`)
      g.addColorStop(0.45, `rgba(255,120,45,${(0.14 * flick).toFixed(3)})`)
      g.addColorStop(1,    'rgba(255,90,25,0)')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(screenX, screenY, R, 0, Math.PI * 2); ctx.fill()
    }
    for (const p of parts) {
      p.life += dt; p.ox += p.vx * dt; p.oy += p.vy * dt; p.vx *= 0.98
      if (p.life >= p.max) {
        p.life = 0; p.oy = 0; p.ox = (Math.random() - 0.5) * 0.30
        p.vy = -(0.00075 + Math.random() * 0.00065); continue
      }
      const t = p.life / p.max
      const px = screenX + p.ox * unit + Math.sin(now * 0.006 + p.seed) * unit * 0.04
      const py = screenY + p.oy * unit
      const fade = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85
      const a = Math.max(0, fade) * (p.ember ? 0.5 : 0.85)
      if (a < 0.02) continue
      let r, gg, b
      if (t < 0.4) { r = 255; gg = Math.round(220 - t * 180); b = Math.round(120 - t * 200) }
      else { r = Math.round(255 - (t - 0.4) * 110); gg = Math.round(110 - (t - 0.4) * 120); b = 30 }
      const size = (p.ember ? 0.05 : 0.12 * (1 - t * 0.6)) * unit
      if (size < 0.4) continue
      ctx.fillStyle = `rgba(${r},${Math.max(0, gg)},${Math.max(0, b)},${a.toFixed(3)})`
      ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
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

    if (card?._isDoor) {
      this._triggerDoor(card._door)
      return
    }

    if (card?._isNPC) {
      this._encounterPanel.clearNotify()
      this._talkToNPCVillage(card._npc)
      return
    }

    super._onJoystickTap()
  }

  _openHarpOverlay() {
    super._openHarpOverlay()
    this._fetchTainPoem()
    this._corraHarp?.on('ready', () => {
      this._addDemoButton()
      this._addBardModeButton()
      this._startTainPhrase()
    })
  }

  _fetchTainPoem() {
    if (this._tainPoemPromise) return this._tainPoemPromise
    this._tainPoemPromise = fetch('/data/tain.json')
      .then(res => {
        if (!res.ok) throw new Error(`tain.json fetch failed: ${res.status}`)
        return res.text()
      })
      .then(text => {
        try {
          const data = JSON.parse(text)
          this._tainPoem = data
          return data
        } catch (parseErr) {
          console.warn('[Táin/bard] JSON.parse failed:', parseErr.message)
          throw parseErr
        }
      })
      .catch(err => {
        console.warn('[Táin/bard] failed to load tain.json:', err)
        this._tainPoem = null
        return null
      })
    return this._tainPoemPromise
  }

  _addDemoButton() {
    const overlay = this._corraHarp?._overlay
    if (!overlay || this._demoBtn) return
    const btn = document.createElement('button')
    btn.textContent = '▶ demo'
    btn.style.cssText = [
      'position:absolute;bottom:18px;left:50%;transform:translateX(-50%);',
      'background:rgba(20,14,8,0.55);border:1px solid rgba(200,190,170,0.35);',
      'color:rgba(220,210,190,0.85);font-size:0.75rem;letter-spacing:0.05em;',
      'padding:6px 16px;border-radius:14px;cursor:pointer;',
      'font-family:Georgia,serif;z-index:10;touch-action:none;',
    ].join('')
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this._startDemoPlayback()
    })
    overlay.appendChild(btn)
    this._demoBtn = btn
  }

  _addBardModeButton() {
    const overlay = this._corraHarp?._overlay
    if (!overlay || this._bardBtn) return
    const btn = document.createElement('button')
    btn.textContent = '🎙 bard'
    btn.style.cssText = [
      'position:absolute;bottom:18px;left:50%;transform:translateX(72px);',
      'background:rgba(20,14,8,0.55);border:1px solid rgba(200,190,170,0.35);',
      'color:rgba(220,210,190,0.85);font-size:0.75rem;letter-spacing:0.05em;',
      'padding:6px 16px;border-radius:14px;cursor:pointer;',
      'font-family:Georgia,serif;z-index:10;touch-action:none;',
    ].join('')
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this._startBardAccompaniment()
    })
    overlay.appendChild(btn)
    this._bardBtn = btn
  }

  _buildTainPhrase() {
    const harp = this._corraHarp
    const TUNE_KEY = 'silverSpearThe'

    const range = harp.getMidiRange()
    const { indices, durations, sharps, accents, ornaments } = abcToTimedStringSequence(
      allTunes[TUNE_KEY], harp, range
    )

    const unitMs = 600
    const phrase = buildTimedPhraseFromDurations(indices, durations, {
      unitMs,
      travelMs:     460,
      windowMs:     420,
      startDelayMs: 1200,
      sharps,
      accents,
      ornaments,
      lilt: 0.5,
    })
    return { phrase, unitMs }
  }

  _buildBardSequence() {
    const harp = this._corraHarp
    const range = harp.getMidiRange()
    const groups = buildBardSequence(PRETTY_GIRL_MILKING_HER_COW, range)
    return groups
  }

  _buildBardMelodyOffsets() {
    const harp = this._corraHarp
    const range = harp.getMidiRange()
    const { indices, sharps } = abcToTimedStringSequence(PRETTY_GIRL_MILKING_HER_COW, null, range)
    const byIdx = new Map(range.available.map(e => [e.idx, e]))
    const midis = indices
      .map((idx, i) => {
        const e = byIdx.get(idx)
        if (!e) return null
        return (sharps[i] && e.sharpM !== undefined) ? e.sharpM : e.m
      })
      .filter(m => m != null)
    if (!midis.length) return [0]
    const avg = midis.reduce((a, b) => a + b, 0) / midis.length
    let anchor = Math.round(avg)
    while ((((anchor % 12) + 12) % 12) !== 9) anchor--
    return midis.map(m => m - anchor)
  }

  _bardGroupWeight(group) {
    if (!group) return 1
    if (group.ordered) return group.strings.length
    if (group.strings.length > 1) return 2
    return 1
  }

  _ensureBardVoice() {
    if (!BARD_VOICE_ENABLED) return null
    if (this._bardVoice !== undefined) return this._bardVoice
    try {
      this._bardVoice = new VoiceSynth({ volume: 0.6 })
    } catch (e) {
      console.warn('[Táin/bard] voice synth unavailable:', e)
      this._bardVoice = null
    }
    return this._bardVoice
  }

  _ensureBardTextContainer() {
    if (this._bardTextContainer) return this._bardTextContainer
    const el = document.createElement('div')
    el.style.cssText = [
      'position:fixed;left:50%;top:14%;transform:translateX(-50%);',
      'width:88%;max-width:580px;text-align:left;',
      'pointer-events:none;z-index:2000001;',
      'display:flex;flex-direction:column;gap:6px;',
      'padding:4px;',
    ].join('')
    document.body.appendChild(el)
    this._bardTextContainer = el

    this._bardPrevEl = this._buildBardIrishSlotEl()
    this._bardPrevEl.style.opacity = '0.55'
    this._bardCurEl  = this._buildBardIrishSlotEl()
    this._bardEnAEl  = this._buildBardEnglishSlotEl()
    this._bardEnBEl  = this._buildBardEnglishSlotEl()
    el.appendChild(this._bardPrevEl)
    el.appendChild(this._bardCurEl)
    el.appendChild(this._bardEnAEl)
    el.appendChild(this._bardEnBEl)

    return el
  }

  _ensureBardKeyframes() {
    if (document.getElementById('bard-kf')) return
    const s = document.createElement('style')
    s.id = 'bard-kf'
    s.textContent = '@keyframes bardLetterIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}'
    document.head.appendChild(s)
  }

  _destroyBardTextEl() {
    clearTimeout(this._bardTypeTimer)
    clearTimeout(this._bardGateTimer)
    clearTimeout(this._bardEnTimer)
    clearTimeout(this._bardEnDoneTimer)
    clearTimeout(this._bardPairBreathTimer)
    clearTimeout(this._bardPrevFadeTimer)
    clearTimeout(this._bardEndTimer)
    this._bardTypeTimer = null
    this._bardGateTimer = null
    this._bardEnTimer   = null
    this._bardEnDoneTimer = null
    this._bardPairBreathTimer = null
    this._bardPrevFadeTimer = null
    this._bardEndTimer = null
    this._bardVoice?.stop?.()
    this._bardTextContainer?.remove()
    this._bardTextContainer = null
    this._bardPrevEl = null
    this._bardCurEl  = null
    this._bardEnAEl  = null
    this._bardEnBEl  = null
    this._bardCurSpeaker = null
  }

  _buildBardIrishSlotEl() {
    const ga = document.createElement('div')
    ga.style.cssText = [
      'font-family:Urchlo,serif;font-size:1.85rem;color:#fffaf0;',
      'text-shadow:',
      '0 0 2px rgba(0,0,0,0.95),',
      '0 0 5px rgba(0,0,0,0.85),',
      '0 0 10px rgba(255,221,140,1),',
      '0 0 20px rgba(255,200,90,0.95),',
      '0 0 38px rgba(255,180,60,0.85),',
      '0 0 64px rgba(255,160,40,0.6);',
      'line-height:1.4;font-weight:700;min-height:2.8em;',
      'opacity:1;transition:opacity 300ms ease-out;',
    ].join('')
    return ga
  }

  _buildBardEnglishSlotEl() {
    const en = document.createElement('div')
    en.style.cssText = [
      'font-family:"Courier New",monospace;font-size:1.2rem;color:#d8f0d8;',
      'text-shadow:0 0 2px rgba(0,0,0,0.9),0 0 6px rgba(0,0,0,0.7),0 0 12px rgba(170,220,170,0.7),0 0 22px rgba(150,210,150,0.45);',
      'line-height:1.3;font-weight:500;',
      'min-height:2.6em;',
      `opacity:0;transition:opacity ${BARD_EN_FADE_MS}ms ease-out;`,
    ].join('')
    return en
  }

  _typeBardIrishInto(slotEl, gaText, onDone) {
    slotEl.textContent = ''
    const tokens = (gaText || '').split(/(\s+)/)
    let ti = 0, ci = 0, wordSpan = null
    const step = () => {
      while (ti < tokens.length && tokens[ti] === '') ti++
      if (ti >= tokens.length) { onDone?.(); return }
      const token = tokens[ti]
      if (/^\s+$/.test(token)) {
        const sp = document.createElement('span')
        sp.textContent = token
        sp.style.whiteSpace = 'pre-wrap'
        slotEl.appendChild(sp)
        ti++; ci = 0; wordSpan = null
        this._bardTypeTimer = setTimeout(step, 52)
        return
      }
      if (ci === 0) {
        wordSpan = document.createElement('span')
        wordSpan.style.whiteSpace = 'nowrap'
        slotEl.appendChild(wordSpan)
      }
      const span = document.createElement('span')
      span.textContent = token[ci]
      span.style.cssText = 'display:inline-block;opacity:0;animation:bardLetterIn 300ms ease both;'
      wordSpan.appendChild(span)
      ci++
      if (ci >= token.length) { ti++; ci = 0; wordSpan = null }
      this._bardTypeTimer = setTimeout(step, 52)
    }
    step()
  }

  _speakBardLine(gaText, speaker) {
    if (!gaText) return
    const v = this._ensureBardVoice()
    if (!v) return
    const opts = { voice: this._voiceForSpeaker(speaker), tuneKey: BARD_VOICE_TUNE_KEY }
    if (BARD_SING && this._bardMelodyOffsets?.length) {
      const n = Math.max(1, syllableCount(gaText))
      const offs = []
      for (let i = 0; i < n; i++) {
        offs.push(this._bardMelodyOffsets[(this._bardMelodyCursor + i) % this._bardMelodyOffsets.length])
      }
      this._bardMelodyCursor = (this._bardMelodyCursor + n) % this._bardMelodyOffsets.length
      opts.melodyOffsets = offs
    }
    v.speak(gaText, opts)
  }

  _voiceForSpeaker(speaker) {
    return BARD_SPEAKER_VOICE[speaker] ?? 'ronnie'
  }

  _colorForSpeaker(speaker) {
    return BARD_SPEAKER_COLOR[speaker] ?? '#ffffff'
  }

  _glowForSpeaker(speaker) {
    const [inner, mid, outer] = BARD_SPEAKER_GLOW[speaker] ?? ['255,221,140', '255,200,90', '255,180,60']
    return [
      '0 0 2px rgba(0,0,0,0.95)',
      '0 0 5px rgba(0,0,0,0.85)',
      `0 0 10px rgba(${inner},1)`,
      `0 0 20px rgba(${mid},0.95)`,
      `0 0 38px rgba(${outer},0.85)`,
      `0 0 64px rgba(${outer},0.6)`,
    ].join(',')
  }

  _estimateSpeechMs(gaText) {
    const n = Math.max(1, syllableCount(gaText || ''))
    return Math.round(n * 290) + 200
  }

  _showBardLine(line, enSlot, onPairDone) {
    if (!line) return
    this._ensureBardTextContainer()
    this._ensureBardKeyframes()

    const PREV_FADE_OUT_MS = 200
    const DEMOTE_SLIDE_MS  = 320

    clearTimeout(this._bardTypeTimer)
    clearTimeout(this._bardEnTimer)
    clearTimeout(this._bardEnDoneTimer)
    clearTimeout(this._bardPrevFadeTimer)

    const outgoingGa      = this._bardCurEl.textContent
    const outgoingSpeaker = this._bardCurSpeaker
    const startTypingNewLine = () => {
      this._bardCurEl.style.color = this._colorForSpeaker(line.speaker)
      this._bardCurEl.style.textShadow = this._glowForSpeaker(line.speaker)
      this._bardCurSpeaker = line.speaker

      this._speakBardLine(line.ga, line.speaker)
      this._typeBardIrishInto(this._bardCurEl, line.ga || '', () => {
        this._bardEnTimer = setTimeout(() => {
          enSlot.textContent = line.en || ''
          void enSlot.offsetHeight
          requestAnimationFrame(() => {
            requestAnimationFrame(() => { enSlot.style.opacity = '1' })
          })
          this._bardEnDoneTimer = setTimeout(() => {
            onPairDone?.()
          }, BARD_EN_FADE_MS)
        }, BARD_AUDIO_GAP_MS)
      })
    }

    if (!outgoingGa) {
      startTypingNewLine()
      return
    }

    this._bardPrevEl.style.transition = `opacity ${PREV_FADE_OUT_MS}ms ease-in`
    this._bardPrevEl.style.opacity = '0'
    this._bardPrevFadeTimer = setTimeout(() => {
      this._bardPrevEl.style.transition = 'none'
      this._bardPrevEl.style.color = this._colorForSpeaker(outgoingSpeaker)
      this._bardPrevEl.style.textShadow = this._glowForSpeaker(outgoingSpeaker)
      this._bardPrevEl.textContent = outgoingGa
      this._bardPrevEl.style.opacity = '0'

      const curRect  = this._bardCurEl.getBoundingClientRect()
      const prevRect = this._bardPrevEl.getBoundingClientRect()
      const dy = curRect.top - prevRect.top

      this._bardPrevEl.style.transform = `translateY(${dy}px)`
      void this._bardPrevEl.offsetHeight
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this._bardPrevEl.style.transition =
            `transform ${DEMOTE_SLIDE_MS}ms ease-out, opacity ${DEMOTE_SLIDE_MS}ms ease-out`
          this._bardPrevEl.style.transform = 'translateY(0)'
          this._bardPrevEl.style.opacity = '0.55'
        })
      })

      setTimeout(startTypingNewLine, Math.round(DEMOTE_SLIDE_MS * 0.4))
    }, PREV_FADE_OUT_MS)
  }

  // ── Poem index wrap helper ───────────────────────────────────────────
  // Wraps a KNOWN-valid-range-target index back into [0, len) via
  // ((i % len) + len) % len rather than a plain i % len — JS's % keeps
  // the sign of the dividend (-1 % 47 === -1, not 46 like Python), which
  // matters if i is ever negative. POEM-END DETECTION does NOT happen
  // here — see _revealNextBardPairs, which checks finished-ness BEFORE
  // ever calling this, precisely so an out-of-range index is never
  // wrapped and displayed in the first place.
  _bardWrapIdx(i) {
    const len = this._tainPoem.length
    return ((i % len) + len) % len
  }

  // Reveals the next TWO pairs of poem text per harp budget-exhaustion.
  // POEM-END DETECTION: checked immediately after EVERY increment of
  // _bardLineIdx, BEFORE that line is ever looked up via _bardWrapIdx or
  // displayed. An earlier version only checked poemFinished after pair
  // B's increment, at the very end of the cycle — but pair A's OWN
  // increment could already cross the poem's length boundary first.
  // _bardWrapIdx wraps any out-of-range index back into a valid one via
  // modulo, so that earlier version would silently wrap back to line 0
  // and DISPLAY it for pair A, a full cycle before poemFinished was ever
  // even evaluated — exactly the reported "once the last chord is
  // played, we go right back to the beginning" bug. Checking right here,
  // before any lookup/display at all, means the poem can never wrap and
  // show a restarted line in the first place.
  _revealNextBardPairs() {
    const READING_BEAT = 200

    this._ensureBardTextContainer()

    clearTimeout(this._bardEnTimer)
    clearTimeout(this._bardEnDoneTimer)
    ;[this._bardEnAEl, this._bardEnBEl].forEach(el => {
      el.style.transition = 'none'
      el.style.opacity = '0'
      el.textContent = ''
      void el.offsetHeight
      el.style.transition = `opacity ${BARD_EN_FADE_MS}ms ease-out`
    })

    this._bardLineIdx++
    this._storyVisuals?.start()

    if (this._bardLineIdx >= this._tainPoem.length) {
      console.log('[Táin/bard] poem complete — ending sequence (at pair A)')
      this._endBardTale()
      return
    }

    const lineA = this._tainPoem[this._bardWrapIdx(this._bardLineIdx)]
    this._showBardLine(lineA, this._bardEnAEl, () => {
      clearTimeout(this._bardPairBreathTimer)
      this._bardPairBreathTimer = setTimeout(() => {
        this._bardLineIdx++

        if (this._bardLineIdx >= this._tainPoem.length) {
          console.log('[Táin/bard] poem complete — ending sequence (at pair B)')
          this._endBardTale()
          return
        }

        const lineB = this._tainPoem[this._bardWrapIdx(this._bardLineIdx)]
        this._showBardLine(lineB, this._bardEnBEl, () => {
          clearTimeout(this._bardGateTimer)
          this._bardGateTimer = setTimeout(() => {
            this._bardPlayer?.readyForNextGroup()
          }, READING_BEAT)
        })
      }, BARD_PAIR_BREATH_MS)
    })
  }

  // Runs the full end-of-tale sequence once the poem has been recited in
  // full: hold the final text on screen for a few seconds, then "the
  // lights come back up" (vignette fades out) while the text fades out
  // alongside it, and only once both fades have finished does the harp
  // overlay actually close — handing control back to the player.
  //
  // _bardPlayer?.stop() runs IMMEDIATELY here (no delay) — that's the
  // fix for an earlier looping bug where the underlying BardAccompaniment
  // engine (built with loop:true so the music wouldn't run out before
  // the poem did) was still fully live and gate-released for a window
  // after the poem's last line displayed, letting a pluck during that
  // window fire onGroupComplete once more and restart the poem. A
  // SEPARATE bug (now also fixed, in _revealNextBardPairs) meant the
  // restart could happen even earlier, in the text-display logic itself,
  // before this method was ever reached on the correct cycle — see that
  // method's header comment for the full trace.
  _endBardTale() {
    this._bardPlayer?.stop()
    clearTimeout(this._bardGateTimer)

    const HOLD_BEFORE_FADE_MS = 5000
    const FADE_OUT_MS = 1200

    clearTimeout(this._bardEndTimer)
    this._bardEndTimer = setTimeout(() => {
      this._storyVisuals?.fadeOut()
      if (this._bardTextContainer) {
        this._bardTextContainer.style.transition = `opacity ${FADE_OUT_MS}ms ease-out`
        this._bardTextContainer.style.opacity = '0'
      }

      clearTimeout(this._bardEndTimer)
      this._bardEndTimer = setTimeout(() => {
        this._corraHarp?.close()
      }, FADE_OUT_MS)
    }, HOLD_BEFORE_FADE_MS)
  }

  async _startBardAccompaniment() {
    const harp = this._corraHarp
    if (!harp) return

    this._phrasePlayer?.stop()
    this._phrasePlayer = null
    this._demoPlayer?.stop()
    this._demoPlayer = null
    this._bardPlayer?.stop()
    this._destroyBardTextEl()
    this._storyVisuals?.destroy()
    this._storyVisuals = null

    this._tainPoem = await this._fetchTainPoem()
    if (!this._tainPoem?.length) {
      console.warn('[Táin/bard] poem failed to load — aborting bard mode')
      return
    }

    const sequence = this._buildBardSequence()
    if (!sequence.length) return

    this._storyVisuals = new StoryVisuals()
    this._storyVisuals.mount()

    this._bardLineIdx    = -1
    this._bardLineBudget = 0

    this._bardMelodyOffsets = (BARD_SING && BARD_VOICE_ENABLED) ? this._buildBardMelodyOffsets() : null
    this._bardMelodyCursor  = 0

    this._bardPlayer = new BardAccompaniment(harp, sequence, {
      gateLighting: true,
      loop: true,
      onGroupComplete: (group, idx) => {
        this._bardLineBudget -= this._bardGroupWeight(group)

        if (this._bardLineBudget > 0) {
          clearTimeout(this._bardGateTimer)
          this._bardGateTimer = setTimeout(() => {
            this._bardPlayer?.readyForNextGroup()
          }, BARD_FLOW_DELAY)
        } else {
          this._bardLineBudget = BARD_LINE_NOTE_TARGET
          this._revealNextBardPairs()
        }
      },
      onSequenceComplete: () => {
        console.log('[Táin/bard] musical sequence loop ended unexpectedly')
        this._showBardLine({ ga: 'Tá an scéal críochnaithe.', en: 'The tale is finished.' }, this._bardEnAEl)
      },
    })
    this._bardPlayer.start()
    this._bardPlayer.readyForNextGroup()
  }

  _startTainPhrase() {
    const harp = this._corraHarp
    if (!harp) return

    this._phrasePlayer?.stop()
    const { phrase, unitMs } = this._buildTainPhrase()

    this._phrasePlayer = new HarpPhrasePlayer(harp, phrase, {
      hitLineFrac: 0.5,
      tempoMs: unitMs,
      bodhranBeatMs: unitMs * 4,
      bodhranAccentEvery: 4,
      onBeatResult: (i, { hit, accuracy }) => {},
      onPhraseComplete: (tally) => {
        this.textPanel?.show({
          ga: 'Tá an scéal críochnaithe.',
          en: 'The tale is finished.',
          type: 'notification',
        })
      },
    })
    this._phrasePlayer.start()
  }

  _startDemoPlayback() {
    const harp = this._corraHarp
    if (!harp || this._demoPlayer) return

    this._phrasePlayer?.stop()
    this._phrasePlayer = null

    const { phrase, unitMs } = this._buildTainPhrase()
    this._demoPlayer = new HarpPhrasePlayer(harp, phrase, {
      hitLineFrac: 0.5,
      autoPlay: true,
      tempoMs: unitMs,
      bodhranBeatMs: unitMs * 4,
      bodhranAccentEvery: 4,
      onPhraseComplete: () => {
        this._demoPlayer = null
        this._startTainPhrase()
      },
    })
    this._demoPlayer.start()
  }

  _destroyHarpOverlay() {
    this._phrasePlayer?.stop()
    this._phrasePlayer = null
    this._demoPlayer?.stop()
    this._demoPlayer = null
    this._bardPlayer?.stop()
    this._bardPlayer = null
    this._destroyBardTextEl()
    this._storyVisuals?.destroy()
    this._storyVisuals = null
    this._bardVoice?.destroy?.()
    this._bardVoice = undefined
    this._demoBtn = null
    this._bardBtn = null
    super._destroyHarpOverlay()
  }
}


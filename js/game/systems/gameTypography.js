/**
 * gameTypography.js -- Centralised text styles for Fenians.baby
 *
 * Import anywhere:
 *   import { TYPE, COLORS, textStyle } from '/data/gameTypography.js'
 *
 * Usage in Phaser:
 *   this.add.text(x, y, 'Dia dhuit', textStyle('body'))
 *   this.add.text(x, y, speaker, textStyle('speaker', { color: COLORS.queen }))
 *
 * Usage in DOM / ScrollingTextPlayer:
 *   el.style.fontSize  = TYPE.body.size
 *   el.style.color     = COLORS.irish
 *
 * Button language rule:
 *   Buttons show Irish OR English, never both.
 *   Use pickLanguage(opacity) to choose, or pass the opacity to createButton().
 */

// -- Fonts --
export const FONTS = {
  irish:   'Urchlo, serif',
  english: '"Courier New", monospace',
  ui:      'Arial, sans-serif',
  title:   'Uncial Antiqua, serif',
}

// -- Type scale --
// All size values live here. SIZES below are legacy aliases kept for
// back-compat with files that still import { SIZES } -- they all point
// into TYPE so there is one source of truth.
export const TYPE = {
  title:    { size: '28px', font: FONTS.title,   lineSpacing: 8  },
  heading:  { size: '25px', font: FONTS.irish,   lineSpacing: 6  },
  body:     { size: '25px', font: FONTS.irish,   lineSpacing: 5  },
  bodyEn:   { size: '22px', font: FONTS.english, lineSpacing: 4  },
  speaker:  { size: '16px', font: FONTS.irish,   lineSpacing: 4  },
  label:    { size: '13px', font: FONTS.ui,      lineSpacing: 2  },
  hint:     { size: '10px', font: FONTS.ui,      lineSpacing: 2  },

  // Card content (encounter_card panel -- larger, more breathable)
  cardBody:   { size: '26px', font: FONTS.irish,   lineSpacing: 7  },
  cardBodyEn: { size: '22px', font: FONTS.english, lineSpacing: 5  },

  // Button labels (single-language, large enough to tap confidently)
  button:     { size: '20px', font: FONTS.irish,   lineSpacing: 0  },
  buttonEn:   { size: '22px', font: FONTS.english, lineSpacing: 0  },

  // DOM (ScrollingTextPlayer / constellationScene -- rem-based)
  domBody:    { size: '1.8rem', sizePx: 29, font: FONTS.irish   },
  domBodyEn:  { size: '1.7rem', sizePx: 27, font: FONTS.english },
}

// -- SIZES: legacy aliases -- do not add new entries here, use TYPE --
export const SIZES = {
  irish:        TYPE.body.size,       // '25px'
  english:      TYPE.bodyEn.size,     // '22px'  (was '27px' -- corrected to match TYPE)
  speaker:      TYPE.speaker.size,    // '16px'
  label:        TYPE.label.size,      // '13px'
  hint:         TYPE.hint.size,       // '10px'
  title:        TYPE.title.size,      // '28px'
  notification: TYPE.label.size,      // '13px'
}

// -- Colours --
export const COLORS = {
  // Text content
  irish:        '#e8dfc0',    // warm parchment -- Irish lines
  english:      '#a0c8a0',    // muted sage -- English lines
  hint:         '#445544',    // dim hint text

  // Speakers
  hero:         '#e8dfc0',
  queen:        '#d4af37',
  druid:        '#a0a0b8',
  spirit:       '#ccccff',
  skull:        '#b8a898',
  villain:      '#cc6644',
  npc:          '#a8c4a8',

  // UI
  speaker:      '#d4af37',    // speaker name label (gold) -- same as queen
  ui:           '#ffffff',
  uiDim:        '#888888',
  border:       '#b0b0b0',

  // Panel
  panelFill:    0x111a11,
  panelBorder:  0xb0b0b0,
  panelAlpha:   0.97,

  // Buttons (Phaser hex for fills/strokes, css strings for text)
  buttonFill:         0x0a0e0a,    // very dark, near-black with green tint
  buttonFillActive:   0x1a2418,    // brief flash on tap
  buttonBorder:       0xd4af37,    // thin gold (= queen)
  buttonBorderActive: 0xffd700,    // brighter gold on tap
  buttonText:         '#e8dfc0',   // parchment, matches Irish body
  buttonTextActive:   '#fff4c2',   // brighter on tap
  buttonAlpha:        0.85,

  // DOM button equivalents (CSS strings for non-Phaser contexts)
  domButtonFill:         'rgba(10,14,10,0.92)',
  domButtonFillActive:   'rgba(26,36,24,0.98)',
  domButtonBorder:       '#d4af37',
  domButtonBorderActive: '#ffd700',
  domButtonText:         '#e8dfc0',
  domButtonTextActive:   '#fff4c2',
}

export const SPACING = {
  linePairGap:       42,
  lineInnerGap:      10,
  irishLineHeight:   1.45,
  englishLineHeight: 1.2,
}

// -- Button geometry constants (shared across the game) --
export const BUTTON = {
  height:        56,
  paddingX:      18,
  paddingY:      14,
  borderWidth:   1.5,
  borderRadius:  6,
  flashMs:       180,
  gap:           14,
  minWidthFrac:  0.7,
  maxWidthFrac:  0.86,
}

// -- Phaser text style factory --
export function textStyle(variant, overrides = {}) {
  const t = TYPE[variant] || TYPE.body
  return {
    fontSize:    t.size,
    fontFamily:  t.font,
    lineSpacing: t.lineSpacing || 4,
    color:       COLORS.irish,
    ...overrides,
  }
}

export function textStyleWrapped(variant, width, overrides = {}) {
  return {
    ...textStyle(variant, overrides),
    wordWrap: { width },
    fixedWidth: 0,
  }
}

// -- Speaker colour lookup --
export function speakerColor(speaker) {
  const map = {
    queen:          COLORS.queen,
    druid:          COLORS.druid,
    hero:           COLORS.hero,
    spirit:         COLORS.spirit,
    bean_si:        COLORS.spirit,
    skull:          COLORS.skull,
    skull_north:    COLORS.skull,
    skull_south:    COLORS.skull,
    villain:        COLORS.villain,
  }
  return map[speaker?.toLowerCase?.()] || COLORS.npc
}

export function speakerColorEn(speaker) {
  const map = {
    queen:          '#b8966a',
    druid:          '#9b8dbd',
    hero:           '#b8af90',
    spirit:         '#9b9bcc',
    bean_si:        '#9b9bcc',
    skull:          '#9a8878',
    skull_north:    '#9a8878',
    skull_south:    '#9a8878',
  }
  return map[speaker?.toLowerCase?.()] || COLORS.english
}

// -- Language picker --
/**
 * Returns 'en' if English opacity >= 0.5, else 'ga'.
 * Single source of truth for the moon threshold used by all button UI.
 *
 * @param {number} opacity -- typically GameSettings.englishOpacity
 * @returns {'en' | 'ga'}
 */
export function pickLanguage(opacity) {
  return (typeof opacity === 'number' && opacity >= 0.5) ? 'en' : 'ga'
}

// -- Phaser button factory --
/**
 * Creates a styled Phaser button (rectangle + text).
 * Buttons show Irish OR English only -- never both.
 * Call updateOpacity(opacity) whenever GameSettings.englishOpacity changes.
 *
 * @param {Phaser.Scene} scene
 * @param {object} cfg
 *   @param {number}   cfg.x
 *   @param {number}   cfg.y
 *   @param {number}   cfg.width
 *   @param {string}   cfg.labelGa
 *   @param {string}   cfg.labelEn
 *   @param {number}   cfg.depth        default 2002
 *   @param {number}   cfg.opacity      current English opacity
 *   @param {function} cfg.onTap        called after flash completes
 * @returns {{
 *   bg:             Phaser.GameObjects.Rectangle,
 *   text:           Phaser.GameObjects.Text,
 *   setLanguage:    (lang:'en'|'ga') => void,
 *   updateOpacity:  (opacity:number) => void,
 *   destroy:        () => void,
 * }}
 */
export function createButton(scene, cfg) {
  const {
    x, y, width,
    labelGa = '',
    labelEn = '',
    depth   = 2002,
    opacity = 1,
    onTap   = () => {},
  } = cfg

  const bg = scene.add.rectangle(x, y, width, BUTTON.height, COLORS.buttonFill, COLORS.buttonAlpha)
    .setScrollFactor(0)
    .setDepth(depth)
    .setStrokeStyle(BUTTON.borderWidth, COLORS.buttonBorder)
    .setInteractive({ useHandCursor: true })

  const initialLang  = pickLanguage(opacity)
  const initialStyle = initialLang === 'en' ? TYPE.buttonEn : TYPE.button

  const text = scene.add.text(x, y, initialLang === 'en' ? labelEn : labelGa, {
    fontSize:   initialStyle.size,
    fontFamily: initialStyle.font,
    color:      COLORS.buttonText,
    align:      'center',
    wordWrap:   { width: width - BUTTON.paddingX * 2 },
  }).setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(depth + 1)

  let currentLang = initialLang

  const setLanguage = (lang) => {
    if (lang === currentLang || !text.active) return
    currentLang = lang
    const style = lang === 'en' ? TYPE.buttonEn : TYPE.button
    text.setStyle({ fontSize: style.size, fontFamily: style.font, color: COLORS.buttonText })
    text.setText(lang === 'en' ? labelEn : labelGa)
  }

  const updateOpacity = (op) => setLanguage(pickLanguage(op))

  bg.on('pointerdown', () => {
    if (!bg.active) return
    bg.setFillStyle(COLORS.buttonFillActive, 1)
    bg.setStrokeStyle(BUTTON.borderWidth + 1, COLORS.buttonBorderActive)
    if (text.active) text.setColor(COLORS.buttonTextActive)
    scene.time.delayedCall(BUTTON.flashMs, () => {
      if (bg.active)   bg.setFillStyle(COLORS.buttonFill, COLORS.buttonAlpha)
                         .setStrokeStyle(BUTTON.borderWidth, COLORS.buttonBorder)
      if (text.active) text.setColor(COLORS.buttonText)
      onTap()
    })
  })

  bg.on('pointerover', () => { if (bg.active) bg.setStrokeStyle(BUTTON.borderWidth, COLORS.buttonBorderActive) })
  bg.on('pointerout',  () => { if (bg.active) bg.setStrokeStyle(BUTTON.borderWidth, COLORS.buttonBorder) })

  return {
    bg,
    text,
    setLanguage,
    updateOpacity,
    destroy: () => {
      if (bg.active)   bg.destroy()
      if (text.active) text.destroy()
    },
  }
}

// -- DOM button factory --
/**
 * Creates a styled DOM button consistent with the Phaser button aesthetic.
 * Dark fill, thin gold border, single-language label driven by moon opacity.
 * Use in non-Phaser screens (tutorialOrAdventure, heroSelect, etc).
 *
 * @param {object} cfg
 *   @param {string}   cfg.ga         Irish label
 *   @param {string}   cfg.en         English label
 *   @param {number}   cfg.opacity    initial GameSettings.englishOpacity
 *   @param {function} cfg.onClick
 * @returns {{
 *   el:             HTMLButtonElement,
 *   applyLanguage:  (opacity:number) => void,
 * }}
 */
// ── createDomButton replacement ───────────────────────────────────────────────
//
// Replace the entire existing createDomButton function in gameTypography.js
// with this. Everything that calls createDomButton stays unchanged.
//
// How it works:
//   Both language labels are always in the DOM, stacked via position:absolute
//   inside a relative wrapper. The wrapper sizes to whichever label is larger
//   on first render, then never changes size again. Language switching is a
//   pure opacity toggle -- no text swap, no reflow, no button resize.
// ─────────────────────────────────────────────────────────────────────────────

export function createDomButton(cfg) {
  const { ga = '', en = '', opacity = 0, onClick = () => {} } = cfg

  const btn = document.createElement('button')
  btn.style.cssText = [
    'width:100%;',
    `padding:${BUTTON.paddingY}px ${BUTTON.paddingX}px;`,
    `border-radius:${BUTTON.borderRadius}px;`,
    `background:${COLORS.domButtonFill};`,
    `border:${BUTTON.borderWidth}px solid ${COLORS.domButtonBorder};`,
    `color:${COLORS.domButtonText};`,
    'cursor:pointer;',
    'box-sizing:border-box;',
    `transition:background ${BUTTON.flashMs}ms ease, border-color ${BUTTON.flashMs}ms ease;`,
    'outline:none;',
    '-webkit-tap-highlight-color:transparent;',
  ].join('')

  // Wrapper: relative so the absolute children stack on top of each other.
  // Its own height comes from the invisible "ghost" layer which always takes
  // up space, ensuring the button height is always the max of both labels.
  const wrapper = document.createElement('span')
  wrapper.style.cssText = [
    'display:block;',
    'position:relative;',
    'pointer-events:none;',
  ].join('')

  // Ghost layer: both labels rendered invisibly, side by side, to force the
  // wrapper to be as wide as the widest label. Uses visibility:hidden not
  // display:none so it still occupies space.
  const ghost = document.createElement('span')
  ghost.setAttribute('aria-hidden', 'true')
  ghost.style.cssText = [
    'visibility:hidden;',
    'display:flex;',
    'flex-direction:column;',
    'align-items:center;',
    'gap:0;',
  ].join('')

  const ghostGa = document.createElement('span')
  ghostGa.textContent      = ga
  ghostGa.style.fontFamily = FONTS.irish
  ghostGa.style.fontSize   = TYPE.button.size
  ghostGa.style.display    = 'block'

  const ghostEn = document.createElement('span')
  ghostEn.textContent      = en
  ghostEn.style.fontFamily = FONTS.english
  ghostEn.style.fontSize   = TYPE.buttonEn.size
  ghostEn.style.display    = 'block'

  ghost.appendChild(ghostGa)
  ghost.appendChild(ghostEn)

  // Live layers: absolutely positioned over the ghost, only one visible at a time.
  const liveGa = document.createElement('span')
  liveGa.textContent      = ga
  liveGa.style.cssText = [
    'position:absolute;',
    'inset:0;',
    'display:flex;',
    'align-items:center;',
    'justify-content:center;',
    `font-family:${FONTS.irish};`,
    `font-size:${TYPE.button.size};`,
    'pointer-events:none;',
    'transition:opacity 120ms ease;',
  ].join('')

  const liveEn = document.createElement('span')
  liveEn.textContent      = en
  liveEn.style.cssText = [
    'position:absolute;',
    'inset:0;',
    'display:flex;',
    'align-items:center;',
    'justify-content:center;',
    `font-family:${FONTS.english};`,
    `font-size:${TYPE.buttonEn.size};`,
    'pointer-events:none;',
    'transition:opacity 120ms ease;',
  ].join('')

  wrapper.appendChild(ghost)
  wrapper.appendChild(liveGa)
  wrapper.appendChild(liveEn)
  btn.appendChild(wrapper)

  // Set initial language state
  let currentLang = pickLanguage(opacity)
  liveGa.style.opacity = currentLang === 'ga' ? '1' : '0'
  liveEn.style.opacity = currentLang === 'en' ? '1' : '0'

  function applyLanguage(op) {
    const lang = pickLanguage(op)
    if (lang === currentLang) return
    currentLang = lang
    liveGa.style.opacity = lang === 'ga' ? '1' : '0'
    liveEn.style.opacity = lang === 'en' ? '1' : '0'
  }

  // Tap feedback
  btn.addEventListener('pointerdown', () => {
    btn.style.background  = COLORS.domButtonFillActive
    btn.style.borderColor = COLORS.domButtonBorderActive
    btn.style.color       = COLORS.domButtonTextActive
    setTimeout(() => {
      btn.style.background  = COLORS.domButtonFill
      btn.style.borderColor = COLORS.domButtonBorder
      btn.style.color       = COLORS.domButtonText
    }, BUTTON.flashMs)
  })

  btn.addEventListener('pointerover', () => {
    btn.style.borderColor = COLORS.domButtonBorderActive
  })
  btn.addEventListener('pointerout', () => {
    btn.style.borderColor = COLORS.domButtonBorder
  })

  btn.onclick = onClick

  return { el: btn, applyLanguage }
}



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
 *   Use pickLanguage(opacity) to choose, or pass the opacity to a button factory.
 */

// -- Fonts --
export const FONTS = {
  irish:   'Urchlo, serif',
  english: '"Courier New", monospace',
  ui:      'Arial, sans-serif',
  title:   'Uncial Antiqua, serif',
}

// -- Sizes --
export const SIZES = {
  irish:       '24px',
  english:     '27px',
  speaker:     '16px',
  label:       '0px',
  hint:        '0px',
  title:       '28px',
  notification:'0px',
}

// -- Colours --
export const COLORS = {
  // Text content
  irish:        '#e8dfc0',    // warm parchment -- Irish lines
  english:      '#a0c8a0',    // muted sage -- English lines
  hint:         '#445544',    // dim hint text (swipe to dismiss etc)

  // Speakers
  hero:         '#e8dfc0',
  queen:        '#d4af37',
  druid:        '#a0a0b8',
  spirit:       '#ccccff',
  skull:        '#b8a898',
  villain:      '#cc6644',
  npc:          '#a8c4a8',

  // UI
  speaker:      '#d4af37',
  ui:           '#ffffff',
  uiDim:        '#888888',
  border:       '#b0b0b0',

  // Panel
  panelFill:    0x111a11,
  panelBorder:  0xb0b0b0,
  panelAlpha:   0.97,

  // -- Buttons (Phaser hex for fills/strokes, css for text) --
  buttonFill:         0x0a0e0a,    // very dark, near-black with green tint
  buttonFillActive:   0x1a2418,    // brief flash on tap
  buttonBorder:       0xd4af37,    // thin gold (queen)
  buttonBorderActive: 0xffd700,    // brighter gold on tap
  buttonGlow:         0xffe066,    // inner glow flash colour
  buttonText:         '#e8dfc0',   // parchment, matches Irish body
  buttonTextActive:   '#fff4c2',   // brighter on tap
  buttonAlpha:        0.85,        // fill alpha
}

export const SPACING = {
  linePairGap:       42,
  lineInnerGap:      10,
  irishLineHeight:   1.45,
  englishLineHeight: 1.2,
}

// -- Button geometry constants (shared across the game) --
export const BUTTON = {
  height:        56,    // pixels
  paddingX:      18,    // horizontal text padding
  borderWidth:   1.5,   // gold border thickness
  borderRadius:  6,     // corner radius
  flashMs:       180,   // tap feedback duration
  gap:           14,    // vertical gap between stacked buttons
  minWidthFrac:  0.7,   // minimum width as fraction of screen
  maxWidthFrac:  0.86,  // maximum width as fraction of screen
}

// -- Type scale --
export const TYPE = {
  title:    { size: '28px', font: FONTS.title,   lineSpacing: 8  },
  heading:  { size: '25px', font: FONTS.irish,   lineSpacing: 6  },
  body:     { size: '25px', font: FONTS.irish,   lineSpacing: 5  },
  bodyEn:   { size: '22px', font: FONTS.english, lineSpacing: 4  },
  speaker:  { size: '16px', font: FONTS.irish,   lineSpacing: 4  },
  label:    { size: '13px', font: FONTS.ui,      lineSpacing: 2  },
  hint:     { size: '10px', font: FONTS.ui,      lineSpacing: 2  },

  // Card content (slightly larger and more breathable than dialogue body)
  cardBody:   { size: '26px', font: FONTS.irish,   lineSpacing: 7  },
  cardBodyEn: { size: '20px', font: FONTS.english, lineSpacing: 5  },

  // Button labels (single-language, large enough to tap confidently)
  button:     { size: '22px', font: FONTS.irish,   lineSpacing: 0  },
  buttonEn:   { size: '17px', font: FONTS.english, lineSpacing: 0  },

  // DOM (ScrollingTextPlayer / constellationScene)
  domBody:    { size: '1.8rem', sizePx: 29, font: FONTS.irish   },
  domBodyEn:  { size: '1.7rem', sizePx: 27, font: FONTS.english },
}

// -- Phaser text style factory --
/**
 * Returns a Phaser-compatible text style object.
 * @param {string} variant -- key from TYPE
 * @param {object} overrides
 */
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

// -- Language picker (drives single-language UI like buttons) --
/**
 * Returns 'en' if the moon-controlled English opacity is >= 0.5,
 * else 'ga'. Used by buttons and any single-language UI elements
 * that should switch with the moon widget.
 *
 * @param {number} opacity -- typically GameSettings.englishOpacity
 * @returns {'en' | 'ga'}
 */
export function pickLanguage(opacity) {
  return (typeof opacity === 'number' && opacity >= 0.5) ? 'en' : 'ga'
}

// -- Button factory --
/**
 * Creates a styled button (rectangle + text) and returns refs for
 * mutation/destruction. Caller is responsible for adding to its own
 * object/cleanup arrays. Subscribes the text to language updates via
 * the returned setLanguage(lang) method.
 *
 * @param {Phaser.Scene} scene
 * @param {object} cfg
 *   @param {number}  cfg.x
 *   @param {number}  cfg.y
 *   @param {number}  cfg.width
 *   @param {string}  cfg.labelGa
 *   @param {string}  cfg.labelEn
 *   @param {number}  cfg.depth        default 2002
 *   @param {number}  cfg.opacity      current English opacity (drives initial language)
 *   @param {function} cfg.onTap       called after flash completes
 * @returns {{
 *   bg: Phaser.GameObjects.Rectangle,
 *   text: Phaser.GameObjects.Text,
 *   setLanguage: (lang:'en'|'ga') => void,
 *   updateOpacity: (opacity:number) => void,
 *   destroy: () => void,
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

  const h = BUTTON.height

  const bg = scene.add.rectangle(x, y, width, h, COLORS.buttonFill, COLORS.buttonAlpha)
    .setScrollFactor(0)
    .setDepth(depth)
    .setStrokeStyle(BUTTON.borderWidth, COLORS.buttonBorder)
    .setInteractive({ useHandCursor: true })

  const initialLang = pickLanguage(opacity)
  const initialText = (initialLang === 'en') ? labelEn : labelGa
  const initialStyle = (initialLang === 'en') ? TYPE.buttonEn : TYPE.button

  const text = scene.add.text(x, y, initialText, {
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
    if (lang === currentLang) return
    currentLang = lang
    const newText  = (lang === 'en') ? labelEn : labelGa
    const newStyle = (lang === 'en') ? TYPE.buttonEn : TYPE.button
    text.setStyle({
      fontSize:   newStyle.size,
      fontFamily: newStyle.font,
      color:      COLORS.buttonText,
    })
    text.setText(newText)
  }

  const updateOpacity = (op) => {
    setLanguage(pickLanguage(op))
  }

  // Tap feedback: brief flash, then fire callback
  bg.on('pointerdown', () => {
    bg.setFillStyle(COLORS.buttonFillActive, 1)
    bg.setStrokeStyle(BUTTON.borderWidth + 1, COLORS.buttonBorderActive)
    text.setColor(COLORS.buttonTextActive)
    scene.time.delayedCall(BUTTON.flashMs, () => {
      // Reset visuals (will be destroyed shortly by caller, but reset for safety)
      if (bg.active) {
        bg.setFillStyle(COLORS.buttonFill, COLORS.buttonAlpha)
        bg.setStrokeStyle(BUTTON.borderWidth, COLORS.buttonBorder)
      }
      if (text.active) text.setColor(COLORS.buttonText)
      onTap()
    })
  })

  // Hover (desktop only -- touch ignores)
  bg.on('pointerover', () => {
    if (!bg.active) return
    bg.setStrokeStyle(BUTTON.borderWidth, COLORS.buttonBorderActive)
  })
  bg.on('pointerout', () => {
    if (!bg.active) return
    bg.setStrokeStyle(BUTTON.borderWidth, COLORS.buttonBorder)
  })

  const destroy = () => {
    if (bg.active)   bg.destroy()
    if (text.active) text.destroy()
  }

  return { bg, text, setLanguage, updateOpacity, destroy }
}


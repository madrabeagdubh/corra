/**
 * gameTypography.js — Centralised text styles for Fenians.baby
 *
 * Import anywhere:
 *   import { TYPE, COLORS, textStyle } from '/data/gameTypography.js'
 *   // or from relative path:
 *   import { TYPE, COLORS, textStyle } from '../../data/gameTypography.js'
 *
 * Usage in Phaser:
 *   this.add.text(x, y, 'Dia dhuit', textStyle('body'))
 *   this.add.text(x, y, speaker, textStyle('speaker', { color: COLORS.queen }))
 *
 * Usage in DOM / ScrollingTextPlayer:
 *   el.style.fontSize  = TYPE.body.size
 *   el.style.color     = COLORS.irish
 */

// ── Fonts ────────────────────────────────────────────────────────────────────
export const FONTS = {
  irish:   'Urchlo, serif',
  english: '"Courier New", monospace',
  ui:      'Arial, sans-serif',
  title:   'Uncial Antiqua, serif',
}

// ── Sizes ─────────────────────────────────────────────────────────────────────
export const SIZES = {
  irish:       '23px',
  english:     '25px',
  speaker:     '16px',
  label:       '0px',
  hint:        '0px',
  title:       '28px',
  notification:'0px',
}

// ── Colours ──────────────────────────────────────────────────────────────────
export const COLORS = {
  // Text content
  irish:        '#e8dfc0',    // warm parchment — Irish lines
  english:      '#a0c8a0',    // muted sage — English lines
  hint:         '#445544',    // dim hint text (swipe to dismiss etc)

  // Speakers
  hero:         '#e8dfc0',    // same as irish — hero speaks as narrator
  queen:        '#d4af37',    // Dagda gold — queen / high status
  druid:        '#a0a0b8',    // grey-blue — druid / otherworldly wisdom
  spirit:       '#ccccff',    // pale violet — bean sí, spirits, ghosts
  skull:        '#b8a898',    // bone — skulls, the dead
  villain:      '#cc6644',    // rust — antagonists
  npc:          '#a8c4a8',    // neutral NPC green

  // UI
  speaker:      '#d4af37',    // speaker name label (gold)
  ui:           '#ffffff',    // general UI
  uiDim:        '#888888',    // secondary UI
  border:       '#b0b0b0',    // panel borders

  // Panel
  panelFill:    0x111a11,     // dark green-black (Phaser hex)
  panelBorder:  0xb0b0b0,     // silver (Phaser hex)
  panelAlpha:   0.97,
}

// ── Type scale ───────────────────────────────────────────────────────────────
// px values used in both Phaser text and DOM elements
export const TYPE = {
  title:    { size: '28px', font: FONTS.title,   lineSpacing: 8  },
  heading:  { size: '22px', font: FONTS.irish,   lineSpacing: 6  },
  body:     { size: '20px', font: FONTS.irish,   lineSpacing: 5  },
  bodyEn:   { size: '15px', font: FONTS.english, lineSpacing: 4  },
  speaker:  { size: '16px', font: FONTS.irish,   lineSpacing: 4  },
  label:    { size: '13px', font: FONTS.ui,      lineSpacing: 2  },
  hint:     { size: '10px', font: FONTS.ui,      lineSpacing: 2  },
  // ScrollingTextPlayer / constellationScene sizes (rem-based for DOM)
  domBody:  { size: '1.35rem', font: FONTS.irish   },
  domBodyEn:{ size: '1.05rem', font: FONTS.english },
}

// ── Phaser text style factory ────────────────────────────────────────────────
/**
 * Returns a Phaser-compatible text style object.
 * @param {string} variant — key from TYPE ('body', 'bodyEn', 'speaker', etc.)
 * @param {object} overrides — any style properties to override
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

/**
 * Returns a Phaser text style with word wrap set to a given width.
 */
export function textStyleWrapped(variant, width, overrides = {}) {
  return {
    ...textStyle(variant, overrides),
    wordWrap: { width },
    fixedWidth: 0,
  }
}

// ── Speaker colour lookup ────────────────────────────────────────────────────
/**
 * Returns the CSS/hex colour string for a given speaker id.
 * Used in ScrollingTextPlayer and TextPanel for coloured dialogue lines.
 */
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

// ── English sub-line colour (slightly dimmer variant of speaker) ──────────────
export function speakerColorEn(speaker) {
  const map = {
    queen:          '#b8966a',   // darker gold
    druid:          '#9b8dbd',   // darker grey-blue
    hero:           '#b8af90',   // darker parchment
    spirit:         '#9b9bcc',   // darker violet
    bean_si:        '#9b9bcc',
    skull:          '#9a8878',
    skull_north:    '#9a8878',
    skull_south:    '#9a8878',
  }
  return map[speaker?.toLowerCase?.()] || COLORS.english
}


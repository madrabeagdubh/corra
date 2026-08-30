#!/usr/bin/env python3
"""
patch_narrative_style.py

Gives showIntroNarrative() (the scrolling first-visit area text) its own
style tokens in gameTypography.js, separate from regular NPC dialogue --
so you can tune how it looks without touching spoken-conversation styling.

  - gameTypography.js: adds TYPE.narrative/narrativeEn and
    COLORS.narrative/narrativeEn. Both start identical to the existing
    body/bodyEn and irish/english tokens, so this is a no-op visually until
    you edit those four values.
  - textPanel.js: adds a 'narrative' panel type (same scroll/hold/dismiss
    behaviour as 'dialogue', different token source).
  - perspectiveScene.js: showIntroNarrative() now uses type: 'narrative'
    instead of type: 'dialogue'.

To change the look: edit TYPE.narrative / TYPE.narrativeEn (font, size,
line spacing) and COLORS.narrative / COLORS.narrativeEn (colour) in
js/game/systems/gameTypography.js. Nothing else needs to change.

Idempotent: safe to run more than once.

Run from the repo root:
    python3 patch_narrative_style.py
"""
from pathlib import Path

ROOT = Path.cwd()


def patch_file(rel_path: str, old: str, new: str, label: str) -> None:
    path = ROOT / rel_path
    if not path.exists():
        print(f"✗ {label}: {rel_path} does not exist -- skipping")
        return
    text = path.read_text(encoding="utf-8")
    if new in text:
        print(f"• {label}: already applied, skipping")
        return
    if old not in text:
        print(f"✗ {label}: expected text not found in {rel_path} -- "
              f"file has drifted, apply by hand")
        return
    count = text.count(old)
    if count > 1:
        print(f"✗ {label}: match is not unique ({count}x) in {rel_path} -- "
              f"apply by hand to avoid patching the wrong spot")
        return
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"✓ {label}")


# ---------------------------------------------------------------------------
# 1. gameTypography.js -- new narrative tokens
# ---------------------------------------------------------------------------

patch_file(
    "js/game/systems/gameTypography.js",
    old="""  // Card content (encounter_card panel -- larger, more breathable)
  cardBody:   { size: '26px', font: FONTS.irish,   lineSpacing: 7  },
  cardBodyEn: { size: '22px', font: FONTS.english, lineSpacing: 5  },""",
    new="""  // Card content (encounter_card panel -- larger, more breathable)
  cardBody:   { size: '26px', font: FONTS.irish,   lineSpacing: 7  },
  cardBodyEn: { size: '22px', font: FONTS.english, lineSpacing: 5  },

  // First-visit area narrative (showIntroNarrative / textPanel type
  // 'narrative') -- deliberately separate from body/bodyEn so this can be
  // tuned to feel distinct from spoken NPC dialogue without touching
  // regular conversation styling. Starts identical to body/bodyEn; change
  // these two (and COLORS.narrative/narrativeEn below) to give it its own
  // look.
  narrative:   { size: '25px', font: FONTS.irish,   lineSpacing: 6  },
  narrativeEn: { size: '22px', font: FONTS.english, lineSpacing: 4  },""",
    label="gameTypography.js: TYPE.narrative/narrativeEn",
)

patch_file(
    "js/game/systems/gameTypography.js",
    old="""  irish:        '#e8dfc0',    // warm parchment -- Irish lines
  english:      '#a0c8a0',    // muted sage -- English lines
  hint:         '#445544',    // dim hint text""",
    new="""  irish:        '#e8dfc0',    // warm parchment -- Irish lines
  english:      '#a0c8a0',    // muted sage -- English lines
  hint:         '#445544',    // dim hint text

  // First-visit area narrative text (see TYPE.narrative/narrativeEn above).
  // Starts identical to irish/english -- change these to give the
  // scrolling arrival text its own colour, separate from spoken dialogue.
  narrative:    '#e8dfc0',
  narrativeEn:  '#a0c8a0',""",
    label="gameTypography.js: COLORS.narrative/narrativeEn",
)

# ---------------------------------------------------------------------------
# 2. textPanel.js -- new 'narrative' panel type
# ---------------------------------------------------------------------------

patch_file(
    "js/game/ui/textPanel.js",
    old=""" *   dialogue        -- scrolls, holds at top for HOLD_MS, then auto-dismisses
 *   examine         -- scrolls, holds at top INDEFINITELY, dismisses only on swipe-up
 *   notification    -- short auto-dismiss banner""",
    new=""" *   dialogue        -- scrolls, holds at top for HOLD_MS, then auto-dismisses
 *   examine         -- scrolls, holds at top INDEFINITELY, dismisses only on swipe-up
 *   narrative       -- same scroll/hold/dismiss behaviour as dialogue, but
 *                       styled from TYPE.narrative[En]/COLORS.narrative[En]
 *                       instead of the regular Irish/English tokens, so
 *                       showIntroNarrative() can look distinct from spoken
 *                       NPC dialogue
 *   notification    -- short auto-dismiss banner""",
    label="textPanel.js: docstring",
)

patch_file(
    "js/game/ui/textPanel.js",
    old="""    if (type === 'dialogue' || type === 'examine') {
      this._buildScrollPanel(irish, english, speaker, sw, sh)
    } else if (type === 'notification') {""",
    new="""    if (type === 'dialogue' || type === 'examine' || type === 'narrative') {
      this._buildScrollPanel(irish, english, speaker, sw, sh, type === 'narrative')
    } else if (type === 'notification') {""",
    label="textPanel.js: route 'narrative' type",
)

patch_file(
    "js/game/ui/textPanel.js",
    old="""  _buildScrollPanel(irish, english, speaker, sw, sh) {
    const panelW   = Math.round(sw * 0.92)""",
    new="""  _buildScrollPanel(irish, english, speaker, sw, sh, isNarrative = false) {
    // Narrative gets its own font/size/colour tokens (TYPE.narrative[En],
    // COLORS.narrative[En] in gameTypography.js) so it can look distinct
    // from spoken NPC dialogue -- both start identical to the regular
    // Irish/English tokens, so this is a no-op until those are edited.
    const gaSize    = isNarrative ? TYPE.narrative.size   : IRISH_SIZE
    const gaFont    = isNarrative ? TYPE.narrative.font   : IRISH_FONT
    const gaColor   = isNarrative ? COLORS.narrative      : IRISH_COLOR
    const gaSpacing = isNarrative ? (TYPE.narrative.lineSpacing   ?? 4) : 4
    const enSize    = isNarrative ? TYPE.narrativeEn.size : ENGLISH_SIZE
    const enFont    = isNarrative ? TYPE.narrativeEn.font : ENGLISH_FONT
    const enColor   = isNarrative ? COLORS.narrativeEn    : ENGLISH_COLOR
    const enSpacing = isNarrative ? (TYPE.narrativeEn.lineSpacing ?? 3) : 3

    const panelW   = Math.round(sw * 0.92)""",
    label="textPanel.js: _buildScrollPanel accepts isNarrative",
)

patch_file(
    "js/game/ui/textPanel.js",
    old="""      if (ga) {
        const el = this.scene.add.text(startX, centreY + cy, ga, {
          fontSize: IRISH_SIZE, fontFamily: IRISH_FONT,
          color: IRISH_COLOR,
          wordWrap: { width: textW }, lineSpacing: 4
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(depth + 1).setAlpha(0)""",
    new="""      if (ga) {
        const el = this.scene.add.text(startX, centreY + cy, ga, {
          fontSize: gaSize, fontFamily: gaFont,
          color: gaColor,
          wordWrap: { width: textW }, lineSpacing: gaSpacing
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(depth + 1).setAlpha(0)""",
    label="textPanel.js: Irish line uses variant tokens",
)

patch_file(
    "js/game/ui/textPanel.js",
    old="""      if (en) {
        const el = this.scene.add.text(startX, centreY + cy, en, {
          fontSize: ENGLISH_SIZE, fontFamily: ENGLISH_FONT,
          color: ENGLISH_COLOR,
          wordWrap: { width: textW }, lineSpacing: 3
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(depth + 1).setAlpha(0)""",
    new="""      if (en) {
        const el = this.scene.add.text(startX, centreY + cy, en, {
          fontSize: enSize, fontFamily: enFont,
          color: enColor,
          wordWrap: { width: textW }, lineSpacing: enSpacing
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(depth + 1).setAlpha(0)""",
    label="textPanel.js: English line uses variant tokens",
)

# ---------------------------------------------------------------------------
# 3. perspectiveScene.js -- showIntroNarrative() uses the new type
# ---------------------------------------------------------------------------

patch_file(
    "js/game/scenes/locations/perspectiveScene.js",
    old="""      this.textPanel.show({
        irish: entry.ga || entry.irish || '', english: entry.en || entry.english || '',
        type: 'dialogue',
        onDismiss: () => this.time.delayedCall(300, showNext)
      })""",
    new="""      this.textPanel.show({
        irish: entry.ga || entry.irish || '', english: entry.en || entry.english || '',
        type: 'narrative',
        onDismiss: () => this.time.delayedCall(300, showNext)
      })""",
    label="perspectiveScene.js: showIntroNarrative uses type 'narrative'",
)

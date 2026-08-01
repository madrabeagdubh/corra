#!/usr/bin/env python3
"""
patch_two_portraits.py -- Corra: show both speakers on the card.

When a card carries a hero line (say/sayEn), the banner shows TWO
portraits -- the champion on the left, the NPC on the right -- so the card
reads immediately as an exchange between two people rather than a monologue
with a picture over it. Cards with only the NPC speaking are unchanged: one
portrait, centred, as before.

The champion portrait comes from PGR's existing _playerCanvas (the world
sprite, already cached and kept in sync with the current frame), registered
as a Phaser canvas texture. If a dedicated portrait asset appears later,
swap _resolveHeroGraphicKey() to point at it and nothing else changes.

CONSEQUENCE: the portrait moves out of the persistent chrome into the body,
because it now changes from card to card. It therefore cross-fades with the
text instead of standing still. Correct, since it genuinely is changing --
but it is a small step back from the earlier "nothing flickers" state, and
worth knowing.

Run from the repo root:  python3 patch_two_portraits.py
Idempotent; aborts without writing if expected text is missing.
"""
import io, os, sys

ROOT = os.getcwd()
def read(p):
    with io.open(os.path.join(ROOT, p), encoding='utf-8') as f: return f.read()
def write(p, s):
    with io.open(os.path.join(ROOT, p), 'w', encoding='utf-8') as f: f.write(s)

def sub_once(src, old, new, label):
    added = [ln for ln in new.split('\n') if ln.strip() and ln not in old]
    sentinel = max(added, key=len) if added else None
    if sentinel and sentinel in src:
        print('  = already applied: %s' % label); return src
    if old not in src:
        print('  ! NOT FOUND: %s\n    aborting, nothing written' % label); sys.exit(1)
    if src.count(old) != 1:
        print('  ! AMBIGUOUS (%d matches): %s' % (src.count(old), label)); sys.exit(1)
    print('  + %s' % label)
    return src.replace(old, new, 1)

# ================================================================== textPanel
P = 'js/game/ui/textPanel.js'
src = read(P)
print(P)

OLD = """      heroGa    = '',
      heroEn    = '',
    } = config"""
NEW = """      heroGa    = '',
      heroEn    = '',
      // Champion portrait, shown beside the NPC's when the hero speaks.
      heroGraphicKey = null,
    } = config"""
src = sub_once(src, OLD, NEW, 'show() accepts heroGraphicKey')

OLD = """      this._buildEncounterCard(irish, english, options, onChoice, bgKey, graphicKey, sw, sh, heroGa, heroEn)"""
NEW = """      this._buildEncounterCard(irish, english, options, onChoice, bgKey, graphicKey, sw, sh, heroGa, heroEn, heroGraphicKey)"""
src = sub_once(src, OLD, NEW, 'pass heroGraphicKey through')

OLD = """  _buildEncounterCard(irish, english, options, onChoice, bgKey, graphicKey, sw, sh, heroGa = '', heroEn = '') {"""
NEW = """  _buildEncounterCard(irish, english, options, onChoice, bgKey, graphicKey, sw, sh, heroGa = '', heroEn = '', heroGraphicKey = null) {"""
src = sub_once(src, OLD, NEW, '_buildEncounterCard signature')

OLD = """    const hasGraphic = !!(graphicKey && this.scene.textures.exists(graphicKey))"""
NEW = """    const hasGraphic = !!(graphicKey && this.scene.textures.exists(graphicKey))
    // Two portraits whenever the hero has a line on this card.
    const hasHeroGfx = !!(heroGraphicKey && this.scene.textures.exists(heroGraphicKey))
    const pairMode   = hasGraphic && hasHeroGfx"""
src = sub_once(src, OLD, NEW, 'pair-mode flag')

# The portrait leaves the chrome, because it now varies card to card.
OLD = """      if (hasGraphic) {
        const gfx = this.scene.add.image(panelX, panelTop + CARD_GRAPHIC_TOP, graphicKey)
          .setDisplaySize(CARD_GRAPHIC_SIZE, CARD_GRAPHIC_SIZE)
          .setOrigin(0.5, 0)
          .setScrollFactor(0)
          .setDepth(depth + 3)
        this._chrome.push(gfx)
      }
    }"""
NEW = """    }

    // -- Portraits -----------------------------------------------------------
    // These live in _objects, not _chrome: the pairing changes from card to
    // card (she alone when she asks; both when the hero answers), so they
    // have to be rebuilt and cross-faded with the body rather than standing
    // still behind it.
    if (pairMode) {
      const gap  = 16
      const half = CARD_GRAPHIC_SIZE / 2
      const heroX = panelX - half - gap / 2
      const npcX  = panelX + half + gap / 2
      const hero = this.scene.add.image(heroX, panelTop + CARD_GRAPHIC_TOP, heroGraphicKey)
        .setDisplaySize(CARD_GRAPHIC_SIZE, CARD_GRAPHIC_SIZE)
        .setOrigin(0.5, 0).setScrollFactor(0).setDepth(depth + 3)
      const npc = this.scene.add.image(npcX, panelTop + CARD_GRAPHIC_TOP, graphicKey)
        .setDisplaySize(CARD_GRAPHIC_SIZE, CARD_GRAPHIC_SIZE)
        .setOrigin(0.5, 0).setScrollFactor(0).setDepth(depth + 3)
      this._objects.push(hero, npc)
    } else if (hasGraphic) {
      const gfx = this.scene.add.image(panelX, panelTop + CARD_GRAPHIC_TOP, graphicKey)
        .setDisplaySize(CARD_GRAPHIC_SIZE, CARD_GRAPHIC_SIZE)
        .setOrigin(0.5, 0).setScrollFactor(0).setDepth(depth + 3)
      this._objects.push(gfx)
    }"""
src = sub_once(src, OLD, NEW, 'portraits move to body, paired when hero speaks')
write(P, src)

# ============================================================== encounterPanel
P = 'js/game/ui/encounterPanel.js'
src = read(P)
print(P)

OLD = """  _resolveBgKey() {"""
NEW = """  /**
   * Champion portrait for the card. Reuses PGR's _playerCanvas -- the world
   * sprite, already cached there and kept in sync with the current frame --
   * registered as a Phaser canvas texture. Refreshed each call because the
   * champion can change armour, and the canvas is swapped underneath.
   *
   * If a dedicated champion portrait asset arrives later, point this at it
   * and nothing else in the card code needs to change.
   */
  _resolveHeroGraphicKey() {
    const pgr = this._scene.perspectiveGround
    const src = pgr?._playerCanvas
    if (!src) return null
    const key = 'enc_graphic_hero'
    if (this._scene.textures.exists(key)) {
      if (this._heroCanvasRef === src) return key
      this._scene.textures.remove(key)
    }
    this._scene.textures.addCanvas(key, src)
    this._heroCanvasRef = src
    return this._scene.textures.exists(key) ? key : null
  }

  _resolveBgKey() {"""
src = sub_once(src, OLD, NEW, '_resolveHeroGraphicKey')

OLD = """      heroGa:  heroGa ?? opt.say   ?? '',
      heroEn:  heroEn ?? opt.sayEn ?? '',
      type:    'encounter_card',"""
NEW = """      heroGa:  heroGa ?? opt.say   ?? '',
      heroEn:  heroEn ?? opt.sayEn ?? '',
      heroGraphicKey: this._resolveHeroGraphicKey(),
      type:    'encounter_card',"""
src = sub_once(src, OLD, NEW, '_replyCard supplies the hero portrait')

OLD = """        heroGa:     opt.say   || '',
        heroEn:     opt.sayEn || '',
        type:       'encounter_card',"""
NEW = """        heroGa:     opt.say   || '',
        heroEn:     opt.sayEn || '',
        heroGraphicKey: this._resolveHeroGraphicKey(),
        type:       'encounter_card',"""
src = sub_once(src, OLD, NEW, '_resolveOption supplies the hero portrait')
write(P, src)

print('\nDone.')

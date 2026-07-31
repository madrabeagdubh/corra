#!/usr/bin/env python3
"""
patch_card_polish.py -- Corra: two dialogue-card refinements.

  1. textPanel.js -- the card reclaims the dead space at the top of the
     screen. It was still vertically centred on its ORIGINAL height while
     growing downward past the moon hub, so it drifted low and left a band
     of unused screen above. With four options the body was being squeezed
     for no reason. Now the top edge sits near the top of the screen and
     the bottom edge sits below the hub.

  2. textPanel.js + encounterPanel.js -- the chrome now also survives the
     dismissal of a REPLY card. Swiping a reply away called hide() with no
     argument, which tore the background down; _reopenDialogue() then built
     a fresh one, producing exactly the blink the previous patch removed
     from the button path. Cards that loop back now dismiss with
     keepChrome, so only the words cross-fade.

Run from the repo root:  python3 patch_card_polish.py
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

OLD = """const CARD_EDGE_PAD        = 6       // never touch the screen edge"""
NEW = """const CARD_EDGE_PAD        = 6       // never touch the screen edge
const CARD_TOP_FRAC        = 0.03    // card top edge, as a fraction of screen height"""
src = sub_once(src, OLD, NEW, 'CARD_TOP_FRAC')

OLD = """          // Only grow, never shrink below a usable card.
          if (wantBot > panelTop + baseH * 0.5) {
            panelH    = Math.round(wantBot - panelTop)
            btnBottom = Math.round(hubTop - CARD_MOON_CLEARANCE)
          }"""
NEW = """          // Only grow, never shrink below a usable card.
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
          }"""
src = sub_once(src, OLD, NEW, 'card reclaims the top of the screen')

OLD = """      // Encounter card extras:
      bgKey     = null,         // Phaser texture key for background image
      graphicKey= null,         // Phaser texture key for graphic banner
    } = config"""
NEW = """      // Encounter card extras:
      bgKey     = null,         // Phaser texture key for background image
      graphicKey= null,         // Phaser texture key for graphic banner
      // True when this card is a step inside an ongoing exchange rather than
      // the end of one: dismissing it by gesture should leave the chrome
      // standing for whatever comes next, not tear the panel down.
      keepChromeOnHide = false,
    } = config"""
src = sub_once(src, OLD, NEW, 'show() accepts keepChromeOnHide')

OLD = """    this.onDismiss        = onDismiss
    this.isVisible        = true"""
NEW = """    this.onDismiss          = onDismiss
    this._keepChromeOnHide  = keepChromeOnHide
    this.isVisible        = true"""
src = sub_once(src, OLD, NEW, 'store keepChromeOnHide')

OLD = """  const fullyScrolled  = this._maxScroll <= 0 || this._scrollY >= this._maxScroll
  if (!hasButtons && savedVel < -DISMISS_VEL && fullyScrolled) {
    this.hide()
    return
  }"""
NEW = """  const fullyScrolled  = this._maxScroll <= 0 || this._scrollY >= this._maxScroll
  if (!hasButtons && savedVel < -DISMISS_VEL && fullyScrolled) {
    // This is how a reply card gets dismissed. If the conversation loops
    // back afterwards, keep the background alive so only the text swaps.
    this.hide(this._keepChromeOnHide)
    return
  }"""
src = sub_once(src, OLD, NEW, 'reply dismissal honours keepChromeOnHide')

OLD = """  _destroyAll(keepChrome = false) {
    if (!keepChrome) {"""
NEW = """  _destroyAll(keepChrome = false) {
    this._keepChromeOnHide = false
    if (!keepChrome) {"""
src = sub_once(src, OLD, NEW, 'reset keepChromeOnHide on teardown')
write(P, src)

# ============================================================== encounterPanel
P = 'js/game/ui/encounterPanel.js'
src = read(P)
print(P)

OLD = """        graphicKey: this._resolveGraphicKey(zone.getData('visual')),
        options:    null,
        onDismiss:  after,
      })"""
NEW = """        graphicKey: this._resolveGraphicKey(zone.getData('visual')),
        options:    null,
        // Unless this option ends the exchange, the reply is a step on the
        // way back to the question list -- so its dismissal must not take
        // the card's background with it.
        keepChromeOnHide: !opt.exit,
        onDismiss:  after,
      })"""
src = sub_once(src, OLD, NEW, 'reply cards keep chrome when looping back')
write(P, src)

print('\nDone.')

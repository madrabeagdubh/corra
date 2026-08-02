#!/usr/bin/env python3
"""
patch_badge_race.py -- Corra: moon badge appears and disappears reliably.

TWO RACES, both in the badge's show/hide pair.

1. BADGE FAILS TO APPEAR.
   _hideBadge() sets opacity 0 immediately and then, via setTimeout, sets
   display:none once the fade has run. Nothing cancels that pending timeout.
   So if the player re-enters range during the fade, _showBadge() sets
   display:block and opacity 1 -- and a moment later the stale timeout fires
   and sets display:none on a badge that is supposed to be visible.

2. BADGE FAILS TO DISAPPEAR.
   notify() returns early when the incoming card id matches this._card.id.
   That is correct for avoiding repeat work, but it also means a badge that
   was hidden while _card was still set can never be re-shown -- and,
   symmetrically, a clearNotify() whose timer got cancelled by a re-entry
   leaves the badge up with no pending hide. With a 20-tile radius the
   player crosses the boundary slowly and repeatedly, so this fires often.

FIX: one timer handle, cancelled by both sides, plus an explicit
_badgeVisible flag so notify() can tell "same card, already showing" from
"same card, badge is down".

Run from the repo root:  python3 patch_badge_race.py
Idempotent; aborts without writing if expected text is missing.
"""
import io, os, sys

ROOT = os.getcwd()
def read(p):
    with io.open(os.path.join(ROOT, p), encoding='utf-8') as f: return f.read()
def write(p, s):
    with io.open(os.path.join(ROOT, p), 'w', encoding='utf-8') as f: f.write(s)

def sub_once(src, old, new, label, sentinel=None):
    if sentinel is None:
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

P = 'js/game/ui/encounterPanel.js'
src = read(P)
print(P)

OLD = """  notify(card, zoneObj) {
    if (this._isOpen) return
    if (this._clearTimer) { clearTimeout(this._clearTimer); this._clearTimer = null }
    if (this._card?.id === card.id) return
    this._card   = card
    this._active = zoneObj
    this._showBadge(card.visual)
  }"""
NEW = """  notify(card, zoneObj) {
    if (this._isOpen) return
    if (this._clearTimer) { clearTimeout(this._clearTimer); this._clearTimer = null }
    // Same card AND the badge is actually up -- nothing to do. The
    // _badgeVisible test matters: without it, a badge that went down while
    // _card was still set could never come back, because the id matched.
    if (this._card?.id === card.id && this._badgeVisible) return
    this._card   = card
    this._active = zoneObj
    this._showBadge(card.visual)
  }"""
src = sub_once(src, OLD, NEW, 'notify() re-shows a hidden badge for the same card')

OLD = """  _showBadge(visual) {
    const badge = this._badgeEl
    badge.style.display = 'block'"""
NEW = """  _showBadge(visual) {
    const badge = this._badgeEl
    if (!badge) return
    // Cancel any fade-out still in flight. Without this, a hide started a
    // moment ago fires its display:none AFTER this show and the badge
    // silently vanishes -- the "badge does not appear" bug.
    if (this._badgeHideTimer) { clearTimeout(this._badgeHideTimer); this._badgeHideTimer = null }
    this._badgeVisible = true
    badge.style.display = 'block'"""
src = sub_once(src, OLD, NEW, '_showBadge cancels a pending fade-out')

OLD = """  _hideBadge() {
    this._badgeEl.style.opacity = '0'
    setTimeout(() => { this._badgeEl.style.display = 'none' }, BADGE_FADE_MS)
  }"""
NEW = """  _hideBadge() {
    const badge = this._badgeEl
    if (!badge) return
    this._badgeVisible = false
    if (this._badgeHideTimer) clearTimeout(this._badgeHideTimer)
    badge.style.opacity = '0'
    this._badgeHideTimer = setTimeout(() => {
      this._badgeHideTimer = null
      // Re-check: the player may have come back into range during the fade,
      // in which case _showBadge has already put the badge up again and this
      // timeout must not pull it down.
      if (!this._badgeVisible) badge.style.display = 'none'
    }, BADGE_FADE_MS)
  }"""
src = sub_once(src, OLD, NEW, '_hideBadge re-checks before hiding')

# make sure a closed conversation always tears the badge down cleanly
OLD = """    this._ladder      = null
    this._seenNodes   = null
    this._usedOptions = null"""
NEW = """    this._ladder      = null
    this._seenNodes   = null
    this._usedOptions = null
    // Leaving a conversation must not leave a stale card id behind, or the
    // badge will not re-appear when the player walks back into range.
    this._badgeVisible = false"""
src = sub_once(src, OLD, NEW, 'clear badge state when a conversation ends')
write(P, src)

print('\nDone.')

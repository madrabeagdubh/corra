#!/usr/bin/env python3
"""
patch_option_cap.py -- Corra: at most 4 dialogue options on screen.

More than four buttons on a phone stops being a choice and becomes a list
to read, and the card's text loses room to the button stack. But a hub
node legitimately accumulates questions, so the answer is paging, not
truncation: the first three options show, and a fourth entry -- "Tuilleadh
/ More" -- reveals the next page without leaving the node or costing a
turn.

MAX_OPTIONS is the hard ceiling INCLUDING the More button, so with the
default of 4 the player sees three real choices at a time. Set it to 3 for
two-at-a-time if that reads better on the device.

Paging state is per node and per conversation: walking away and coming back
starts at page one.

Run from the repo root:  python3 patch_option_cap.py
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

OLD = """const DEFAULT_EXIT_OPTION = { ga: 'Slán.', en: 'Goodbye.', exit: true }"""
NEW = """const DEFAULT_EXIT_OPTION = { ga: 'Slán.', en: 'Goodbye.', exit: true }

// Hard ceiling on buttons per card, INCLUDING the More button. Beyond about
// four, a choice becomes a list to read, and the stack eats the room the
// card's text needs. Overflow pages rather than truncating, so a hub node
// can hold as many questions as the writing wants.
const MAX_OPTIONS  = 4
const MORE_OPTION  = { ga: 'Tuilleadh...', en: 'More...', _more: true }"""
src = sub_once(src, OLD, NEW, 'MAX_OPTIONS + More button')

OLD = """    // A node with questions loops back to itself after each answer, so it
    // needs a way out. If the content didn't provide one, add it.
    if (opts.length && !opts.some(o => o.exit)) opts.push(DEFAULT_EXIT_OPTION)"""
NEW = """    // A node with questions loops back to itself after each answer, so it
    // needs a way out. If the content didn't provide one, add it.
    if (opts.length && !opts.some(o => o.exit)) opts.push(DEFAULT_EXIT_OPTION)

    // Paging. `page` is per node, per conversation: leaving and returning
    // starts at the first page again.
    const shown = this._pageOptions(opts, idx)"""
src = sub_once(src, OLD, NEW, 'page the option list')

OLD = """      options: opts.map(o => ({ ga: o.ga || '', en: o.en || '' })),
        onChoice: (i) => {
          this._choiceMade = true
          SoundBoard.playWeb('ENCOUNTER_CHOICE')
          this._resolveOption(opts[i], d, idx, stateKey, total, zone)
        },"""
NEW = """      options: shown.map(o => ({ ga: o.ga || '', en: o.en || '' })),
        onChoice: (i) => {
          this._choiceMade = true
          SoundBoard.playWeb('ENCOUNTER_CHOICE')
          const picked = shown[i]
          // "More" is not a dialogue choice -- it turns the page and
          // re-renders the same node, costing the player nothing.
          if (picked?._more) {
            this._optionPage.set(idx, (this._optionPage.get(idx) || 0) + 1)
            this._showDialogue(d, idx, stateKey, total, zone)
            return
          }
          this._resolveOption(picked, d, idx, stateKey, total, zone)
        },"""
src = sub_once(src, OLD, NEW, 'More turns the page instead of answering')

OLD = """  /** Stable identity for an option, for the used-once set. */"""
NEW = """  /**
   * Slice the option list to one page. Wraps: paging past the end returns
   * to the first page, so the player can never get stuck on a short last
   * page with no way back to the option they wanted.
   */
  _pageOptions(opts, idx) {
    if (!this._optionPage) this._optionPage = new Map()
    if (opts.length <= MAX_OPTIONS) { this._optionPage.delete(idx); return opts }

    const per   = MAX_OPTIONS - 1              // one slot goes to More
    const pages = Math.ceil(opts.length / per)
    const page  = (this._optionPage.get(idx) || 0) % pages
    this._optionPage.set(idx, page)

    const slice = opts.slice(page * per, page * per + per)
    return [...slice, MORE_OPTION]
  }

  /** Stable identity for an option, for the used-once set. */"""
src = sub_once(src, OLD, NEW, '_pageOptions()')

OLD = """    this._seenNodes   = new Set()
    this._usedOptions = new Set()"""
NEW = """    this._seenNodes   = new Set()
    this._usedOptions = new Set()
    this._optionPage  = new Map()"""
src = sub_once(src, OLD, NEW, 'reset paging when a conversation opens')

OLD = """    this._seenNodes   = null
    this._usedOptions = null"""
NEW = """    this._seenNodes   = null
    this._usedOptions = null
    this._optionPage  = null"""
src = sub_once(src, OLD, NEW, 'clear paging when a conversation ends')
write(P, src)

print('\nDone.')

#!/usr/bin/env python3
"""
Two directives that let a conversation flow without buttons.

  @easca / @eascaMatch  ON A NODE (not an option)
      An option-less node that opens the keyboard when its card is
      dismissed. The player reads her question, swipes, and types. No
      button saying "I am..." — the card IS the question.

  @continue  ON A NODE
      An option-less node whose dismissal advances to the next node
      instead of closing the panel. Without it, every option-less node
      ends the conversation and the player has to walk back to hear the
      next line. With it, a run of them reads as continuous speech.

Together these let the opening of an encounter be pure dialogue, with
buttons appearing only where there is a real choice.

Idempotent. Run from repo root, after patch_vocative_wire.py.
"""

import sys, pathlib

PANEL   = pathlib.Path('js/game/ui/encounterPanel.js')
COMPILE = pathlib.Path('tools/dialogue/compile.mjs')


# ── compiler ─────────────────────────────────────────────────────────────

C1_A = "    case 'eascaMatch': target.eascaMatch = rest; return\n"
C1_P = ("    case 'eascaMatch': target.eascaMatch = rest; return\n"
        "    case 'continue': target.continue = true; return\n")

C2_A = "  'exit', 'silent', 'easca', 'eascaMatch', 'ga', 'en', 'say', 'sayEn',\n"
C2_P = ("  'exit', 'silent', 'easca', 'eascaMatch', 'continue', 'ga', 'en',\n"
        "  'say', 'sayEn',\n")

C3_A = "    if (n.hold)          L.push('@hold')\n"
C3_P = ("    if (n.hold)          L.push('@hold')\n"
        "    if (n.continue)      L.push('@continue')\n"
        "    if (n.easca)         L.push('@easca ' + n.easca)\n"
        "    if (n.eascaMatch)    L.push('@eascaMatch ' + n.eascaMatch)\n")

C4_A = "//   @eascaMatch knows_own_name      (options) set this note only if\n"
C4_P = ("//   @continue                       (nodes, no options) flow into the\n"
        "//                                   next node rather than closing\n"
        "//   @easca playerName               ON A NODE: open the keyboard when\n"
        "//                                   the card is dismissed\n"
        "//   @eascaMatch knows_own_name      (options) set this note only if\n")


# ── panel ────────────────────────────────────────────────────────────────

P_A = """      onDismiss: () => {
        if (!d.hold) GameState.setNPCProgress(stateKey, (idx + 1) % total)
        this._onPanelClosed()
      }
"""

P_P = """      onDismiss: () => {
        // Where an option-less node leads. @continue flows into the next
        // node with the panel still standing, so a run of them reads as one
        // person speaking rather than as several separate encounters.
        const go = () => {
          if (!d.hold) GameState.setNPCProgress(stateKey, (idx + 1) % total)
          if (d.continue) this._reopenDialogue(zone)
          else            this._onPanelClosed()
        }

        // A node can carry @easca itself, which opens the keyboard once the
        // player has read the card. That is what lets her ask a question and
        // be answered directly, with no button in between.
        if (d.easca && this._scene?.promptEasca) {
          this._scene.promptEasca((text) => {
            if (!this._isOpen) return
            if (text) {
              const typed = String(text).trim()
              try { this._scene.registry?.set(d.easca, typed) } catch (e) {}
              if (this._nameMatchesChampion(typed)) {
                const voc = this._championVocative()
                if (voc) { try { this._scene.registry?.set('playerVoc', voc) } catch (e) {} }
                if (d.eascaMatch) GameState.addNote(d.eascaMatch)
              }
            }
            go()
          })
          return
        }

        go()
      }
"""


COMPILE_EDITS = [(C4_A, C4_P), (C1_A, C1_P), (C2_A, C2_P), (C3_A, C3_P)]


def apply(path, edits, marker, name):
    src = path.read_text()
    if marker in src:
        print(f'{name} already patched')
        return
    for i, (a, _) in enumerate(edits, 1):
        if a not in src:
            sys.exit(f'{name} anchor {i} not found — run the earlier patches first')
    for a, p in edits:
        src = src.replace(a, p, 1)
    path.write_text(src)
    print(f'patched {path}')


def main():
    for p in (PANEL, COMPILE):
        if not p.exists():
            sys.exit(f'not found: {p} — run from repo root')
    apply(COMPILE, COMPILE_EDITS, "case 'continue'", 'compile.mjs')
    apply(PANEL, [(P_A, P_P)], 'd.continue', 'encounterPanel.js')


if __name__ == '__main__':
    main()

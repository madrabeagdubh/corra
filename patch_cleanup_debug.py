#!/usr/bin/env python3
"""
Run from ~/Corra:
  python3 ~/Downloads/patch_cleanup_debug.py
"""
import sys
from pathlib import Path

def clean(path, replacements):
    f = Path(path)
    if not f.exists():
        print(f'[{path}] not found', file=sys.stderr)
        return
    txt = f.read_text()
    for old, new, label in replacements:
        if old in txt:
            txt = txt.replace(old, new, 1)
            print(f'[{f.name}] cleaned: {label}')
        else:
            print(f'[{f.name}] WARNING: not found: {label}', file=sys.stderr)
    f.write_text(txt)

# ── bogLocationScene.js ───────────────────────────────────────────────────────
clean('js/game/scenes/locations/bog/bogLocationScene.js', [

    # GS-DEBUG pulse in update()
    ("""    // Temp debug: log GameState every 5s
    if (!this._gsDebugT) this._gsDebugT = 0
    this._gsDebugT += delta
    if (this._gsDebugT > 5000) {
      this._gsDebugT = 0
      console.log('[GS-DEBUG] championId:', GameState._championId, 'boatPosition:', GameState._state?.boatPosition)
    }""", '', 'GS-DEBUG pulse'),

    # localStorage debug in _restoreBoatOnEnter
    ("""      const _rawLS = localStorage.getItem('fenians_state_' + (GameState._championId ?? 'unknown'))
      const _parsed = _rawLS ? JSON.parse(_rawLS) : null
      console.log(`[_restoreBoatOnEnter] mapKey=${mapKey} saved=`, saved, 'localStorage.boatPosition=', _parsed?.boatPosition)""",
     """      console.log(`[_restoreBoatOnEnter] mapKey=${mapKey} saved=`, saved)""",
     'localStorage debug'),
])

# ── boatSystem.js ─────────────────────────────────────────────────────────────
clean('js/game/systems/boatSystem.js', [

    # reboard debug log
    ("""        const sinceDisembark = Date.now() - (this._deactivatedAt ?? 0)
        if (!this._lastReboardLog || Date.now() - this._lastReboardLog > 2000) {
          this._lastReboardLog = Date.now()
          console.log('[reboard] dist:', dist.toFixed(1), 'ts*0.6:', (ts*0.6).toFixed(1), 'since:', sinceDisembark, 'moving:', p.isMoving)
        }
        if (dist < ts * 0.8 && !p.isMoving && sinceDisembark > 1500) {""",
     """        const sinceDisembark = Date.now() - (this._deactivatedAt ?? 0)
        if (dist < ts * 0.8 && !p.isMoving && sinceDisembark > 1500) {""",
     'reboard debug log'),
])

# ── gameState.js ──────────────────────────────────────────────────────────────
clean('js/game/systems/gameState.js', [

    # setBoatPosition debug warnings
    ("""  setBoatPosition(mapKey, tileX, tileY) {
    if (!this._state) { console.warn('[GameState] setBoatPosition: no _state'); return }
    if (!this._championId) { console.warn('[GameState] setBoatPosition: no _championId, save will fail'); }
    this._state.boatPosition = { mapKey, tileX, tileY }
    this.save()
    console.log(`[GameState] boat moored at ${mapKey} [${tileX},${tileY}] championId=${this._championId}`)
  },""",
     """  setBoatPosition(mapKey, tileX, tileY) {
    if (!this._state) return
    this._state.boatPosition = { mapKey, tileX, tileY }
    this.save()
    console.log(`[GameState] boat moored at ${mapKey} [${tileX},${tileY}]`)
  },""",
     'setBoatPosition debug warnings'),
])

print('\nDone.')

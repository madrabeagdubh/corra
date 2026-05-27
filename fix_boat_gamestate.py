#!/usr/bin/env python3
# fix_boat_gamestate.py
# Run from ~/Corra: python3 fix_boat_gamestate.py

# ── 1. GameState: add boatPosition support ────────────────────────────────

f1 = 'js/systems/gameState.js'
import os
# Try both possible paths
if not os.path.exists(f1):
    f1 = 'data/gameState.js'
if not os.path.exists(f1):
    # Search for it
    for root, dirs, files in os.walk('.'):
        for file in files:
            if file == 'gameState.js':
                f1 = os.path.join(root, file)
                break

print(f'GameState path: {f1}')
s1 = open(f1).read()

# Add boatPosition to defaultState
old1 = """    encounterLayouts: {},   // { mapKey: [{id, x, y}, ...] }
  }
}"""
new1 = """    encounterLayouts: {},   // { mapKey: [{id, x, y}, ...] }
    boatPosition:     null,  // { mapKey, tileX, tileY } | null
  }
}"""
if old1 in s1:
    s1 = s1.replace(old1, new1)
    print('defaultState boatPosition: done')
else:
    print('defaultState boatPosition: NO MATCH')

# Add boatPosition methods before the closing }
old2 = """  clearEncounterLayout(mapKey) {
    if (!this._state) return
    delete this._state.encounterLayouts[mapKey]
    this.save()
  },
}"""
new2 = """  clearEncounterLayout(mapKey) {
    if (!this._state) return
    delete this._state.encounterLayouts[mapKey]
    this.save()
  },

  // -- Boat position --------------------------------------------------------
  // Saves where the player moored their boat so it persists across map visits.

  getBoatPosition(mapKey) {
    const bp = this._state?.boatPosition
    if (!bp || bp.mapKey !== mapKey) return null
    return bp
  },

  setBoatPosition(mapKey, tileX, tileY) {
    if (!this._state) return
    this._state.boatPosition = { mapKey, tileX, tileY }
    this.save()
    console.log(`[GameState] boat moored at ${mapKey} [${tileX},${tileY}]`)
  },

  clearBoatPosition() {
    if (!this._state) return
    this._state.boatPosition = null
    this.save()
    console.log('[GameState] boat position cleared')
  },
}"""
if old2 in s1:
    s1 = s1.replace(old2, new2)
    open(f1, 'w').write(s1)
    print('GameState boat methods: done')
else:
    print('GameState boat methods: NO MATCH')

# ── 2. boatSystem: save/clear position on disembark/lost ─────────────────

f2 = 'js/game/systems/boatSystem.js'
s2 = open(f2).read()

# Import GameState at top if not already there
if 'gameState' not in s2:
    old2a = "// Shore GIDs from oryxCatalogue"
    new2a = "import { GameState } from '../../../data/gameState.js'\n\n// Shore GIDs from oryxCatalogue"
    if old2a in s2:
        s2 = s2.replace(old2a, new2a)
        print('GameState import: done')
    else:
        print('GameState import: NO MATCH -- add manually')
else:
    print('GameState already imported')

# Save position on clean disembark (moored in reeds)
old2b = """    this.deactivate()

    // Brief narrative beat
    if (this.scene.textPanel) {
      const text = boatLost
        ? { ga: 'Imigh an bád leis an sruth.', en: 'The boat drifted away with the current.' }
        : { ga: 'Chuala mé an abhainn fúm.', en: 'I felt the riverbed beneath me.' }"""
new2b = """    // Save or clear boat position in GameState
    const _p  = this.scene.player
    const _ts = this.scene.tileSize
    const _mapKey = this.scene.getMapKey?.() ?? this.scene.scene.key
    if (boatLost) {
      GameState.clearBoatPosition()
    } else {
      const _tx = Math.floor((_p?.logicalX ?? 0) / _ts)
      const _ty = Math.floor((_p?.logicalY ?? 0) / _ts)
      GameState.setBoatPosition(_mapKey, _tx, _ty)
    }

    this.deactivate()

    // Brief narrative beat
    if (this.scene.textPanel) {
      const text = boatLost
        ? { ga: 'Imigh an bád leis an sruth.', en: 'The boat drifted away with the current.' }
        : { ga: 'Chuala mé an abhainn fúm.', en: 'I felt the riverbed beneath me.' }"""
if old2b in s2:
    s2 = s2.replace(old2b, new2b)
    open(f2, 'w').write(s2)
    print('boatSystem save position: done')
else:
    print('boatSystem save position: NO MATCH')

# ── 3. d3.js / c4.js: spawn boat from GameState on entry ─────────────────
# We patch the base onEnter logic in d3.js as the template

f3 = 'js/game/scenes/locations/bog/d3.js'
s3 = open(f3).read()

old3 = """  onEnter() {
    const edge = this.entryData?.entryEdge
    // Arrive by boat from the east (sea/estuary), or fresh start on this map
    const shouldBeInBoat = !edge || edge === 'east'
    if (shouldBeInBoat) {
      this.time.delayedCall(50, () => {
        if (!this.boatSystem) return
        if (this.perspectiveGround && this.textures.exists('boat')) {
          this.perspectiveGround.loadBoatImage(
            this.textures.get('boat').getSourceImage()
          )
        }
        this.boatSystem.activate()
      })
    }
  }"""
new3 = """  onEnter() {
    const edge    = this.entryData?.entryEdge
    const mapKey  = this.getMapKey()
    const saved   = GameState.getBoatPosition(mapKey)
    const fromEast = !edge || edge === 'east'

    this.time.delayedCall(50, () => {
      if (!this.boatSystem || !this.perspectiveGround) return
      if (this.textures.exists('boat')) {
        this.perspectiveGround.loadBoatImage(
          this.textures.get('boat').getSourceImage()
        )
      }

      if (saved) {
        // Restore moored boat at saved position
        const ts = this.tileSize
        const pgr = this.perspectiveGround
        pgr._boatWorldX  = saved.tileX * ts + ts / 2
        pgr._boatWorldY  = saved.tileY * ts + ts / 2
        pgr._boatDrifting = false
        // If player is on the same tile, board it
        const pTX = Math.floor(this.player.logicalX / ts)
        const pTY = Math.floor(this.player.logicalY / ts)
        if (pTX === saved.tileX && pTY === saved.tileY) {
          this.boatSystem.activate()
        }
        console.log(`[d3] boat restored at [${saved.tileX},${saved.tileY}]`)
      } else if (fromEast) {
        // Fresh arrival -- player starts in boat
        this.boatSystem.activate()
      }
    })
  }"""
if old3 in s3:
    s3 = s3.replace(old3, new3)
    open(f3, 'w').write(s3)
    print('d3.js onEnter: done')
else:
    print('d3.js onEnter: NO MATCH')

# Need to import GameState in d3.js
s3 = open(f3).read()
if 'GameState' not in s3:
    old3b = "import BogLocationScene from './bogLocationScene.js'"
    new3b = "import BogLocationScene from './bogLocationScene.js'\nimport { GameState } from '../../../../../data/gameState.js'"
    if old3b in s3:
        s3 = s3.replace(old3b, new3b)
        open(f3, 'w').write(s3)
        print('d3.js GameState import: done')
    else:
        print('d3.js GameState import: NO MATCH')

# ── 4. PGR: lerp the tile highlight ──────────────────────────────────────

f4 = 'js/game/effects/perspectiveGroundRenderer.js'
s4 = open(f4).read()

old4 = """    // Player tile highlight -- drawn once after tile loop
    if (p) {
      const _hlLX = (this._boatActive && this._boatWorldX != null) ? this._boatWorldX : p.logicalX
      const _hlLY = (this._boatActive && this._boatWorldY != null) ? this._boatWorldY : p.logicalY
      const pTileCol = Math.floor(_hlLX / this.tileDisplaySize)
      const pTileRow = Math.floor(_hlLY / this.tileDisplaySize)
      const hxTL = this._colToScreenX(pTileCol,     pTileRow)
      const hxTR = this._colToScreenX(pTileCol + 1, pTileRow)
      const hxBL = this._colToScreenX(pTileCol,     pTileRow + 1)
      const hxBR = this._colToScreenX(pTileCol + 1, pTileRow + 1)
      const hyT  = this._rowToScreenY(pTileRow)
      const hyB  = this._rowToScreenY(pTileRow + 1)
      if (hyT !== null && hyB !== null) {
        this._gCtx.save()
        this._gCtx.globalAlpha = 0.28
        this._gCtx.fillStyle = 'rgba(255,255,180,1)'
        this._gCtx.beginPath()
        this._gCtx.moveTo(hxTL, hyT); this._gCtx.lineTo(hxTR, hyT)
        this._gCtx.lineTo(hxBR, hyB); this._gCtx.lineTo(hxBL, hyB)
        this._gCtx.closePath(); this._gCtx.fill()

        this._gCtx.restore()
      }
    }"""
new4 = """    // Player tile highlight -- lerped for smooth tracking
    if (p) {
      // Target: boat world position when active, else player logical position
      const _hlLX = (this._boatActive && this._boatWorldX != null)
        ? this._boatWorldX
        : p.logicalX
      const _hlLY = (this._boatActive && this._boatWorldY != null)
        ? this._boatWorldY
        : p.logicalY

      // Lerp highlight logical position toward target
      if (this._hlX == null) { this._hlX = _hlLX; this._hlY = _hlLY }
      const hlLerp = p.isMoving ? 0.25 : 0.15
      this._hlX += (_hlLX - this._hlX) * hlLerp
      this._hlY += (_hlLY - this._hlY) * hlLerp

      // Project lerped position to screen
      const hlProj = this._projectLogical(this._hlX, this._hlY)
      if (hlProj) {
        const ts   = this.tileDisplaySize
        const hlW  = this._scaleAtRow(Math.floor(this._hlY / ts) + 1)
        const hlH  = hlW * 0.35  // squash to ground plane
        this._gCtx.save()
        this._gCtx.globalAlpha = 0.32
        this._gCtx.strokeStyle = 'rgba(255,255,180,1)'
        this._gCtx.lineWidth   = 1.5
        this._gCtx.beginPath()
        this._gCtx.ellipse(
          hlProj.screenX, hlProj.screenY,
          hlW * 0.55, hlH * 0.55,
          0, 0, Math.PI * 2
        )
        this._gCtx.stroke()
        this._gCtx.globalAlpha = 0.12
        this._gCtx.fillStyle = 'rgba(255,255,180,1)'
        this._gCtx.fill()
        this._gCtx.restore()
      }
    }"""
if old4 in s4:
    s4 = s4.replace(old4, new4)
    open(f4, 'w').write(s4)
    print('highlight lerp: done')
else:
    print('highlight lerp: NO MATCH')

# Reset highlight position on resize
f4b = 'js/game/effects/perspectiveGroundRenderer.js'
s4b = open(f4b).read()
old4b = """    if (_newSw !== this._sw || _newSh !== this._sh) {
      this._boatScreenX = null
      this._boatScreenY = null
    }"""
new4b = """    if (_newSw !== this._sw || _newSh !== this._sh) {
      this._boatScreenX = null
      this._boatScreenY = null
      this._hlX = null
      this._hlY = null
    }"""
if old4b in s4b:
    s4b = s4b.replace(old4b, new4b)
    open(f4b, 'w').write(s4b)
    print('highlight resize reset: done')
else:
    print('highlight resize reset: NO MATCH')

# ── 5. PGR: improve boarding hit area ─────────────────────────────────────
# Reboard check uses Math.round which can be off by half a tile.
# Use a distance check instead -- within 0.6 tiles = reboard.

f5 = 'js/game/systems/boatSystem.js'
s5 = open(f5).read()
old5 = """        const boatTX = Math.round(pgr._boatWorldX / ts)
        const boatTY = Math.round(pgr._boatWorldY / ts)
        const pTX    = Math.floor(p.logicalX / ts)
        const pTY    = Math.floor(p.logicalY / ts)
        if (pTX === boatTX && pTY === boatTY && !p.isMoving) {
          this._reboard(p, pgr)
        }"""
new5 = """        const dist = Math.hypot(p.logicalX - pgr._boatWorldX, p.logicalY - pgr._boatWorldY)
        if (dist < ts * 0.8 && !p.isMoving) {
          this._reboard(p, pgr)
        }"""
if old5 in s5:
    s5 = s5.replace(old5, new5)
    open(f5, 'w').write(s5)
    print('boarding distance check: done')
else:
    print('boarding distance check: NO MATCH')

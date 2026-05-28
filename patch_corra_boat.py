#!/usr/bin/env python3
"""
Corra boat system patch
Fixes:
  1. boatSystem.js      -- SHORE_GIDS -> REED_GIDS (731 only), correct 3-way logic
  2. bogLocationScene.js -- isColliding + disembark badge use correct GID sets
  3. baseLocationScene.js -- joystick step blocked before startNewStep when inBoat
  4. player.js            -- startNewStep checks scene.isColliding before committing
"""

import re, sys
from pathlib import Path

ROOT = Path('.')   # run from project root (~/Corra)

# ─────────────────────────────────────────────────────────────────────────────
# 1. boatSystem.js
# ─────────────────────────────────────────────────────────────────────────────

BOAT = ROOT / 'js/game/systems/boatSystem.js'

old_gids = r"""// Shore GIDs from oryxCatalogue
const SHORE_GIDS = new Set([
  1472, 1473, 1474,   // west+north, north, north+east shore
  1526, 1528,          // west shore, east shore
  1580, 1581, 1582,   // west+south, south, south+east shore
  1635, 1636,          // shore west+north+east, shore north+east+south
  1689, 1690,          // shore west+south+north, shore north+west+south
  1742, 1743,          // shore west+north tiny, shore east+north tiny
  1796, 1797,          // shore west+south tiny, shore south+east tiny
  1852,                // north+south shore
  1906,                // east+west shore
  1958, 1959, 1960,   // points of shore
  2012, 2013,          // points of land
  731,                  // waterside/shore
])

const WATER_GIDS = new Set([1625, 1679])"""

new_gids = r"""// Reed GIDs -- marshy buffer between river and land.
// GID 731 ("waterside") is the only reed tile on current river maps.
// Boat navigates freely here; no current drift; player can wade on foot.
const REED_GIDS  = new Set([731])
const WATER_GIDS = new Set([1625, 1679])"""

# update() -- onShore/onWater/onLand block
old_terrain = r"""    const onShore = SHORE_GIDS.has(gid)
    const onWater = WATER_GIDS.has(gid)
    const onLand  = !onShore && !onWater
    if (this._lastGid !== gid) { this._lastGid = gid; console.log('[boat] tile gid:', gid, 'onShore:', onShore, 'onWater:', onWater, 'onLand:', onLand) }

    // Stop and clear if on shore or land
    if (onShore || onLand) {
      p.pathQueue = []
      this._driftAccum = 0
      // Cancel mid-step if heading onto land
      if (onLand && p.isMoving) {
        p.isMoving = false
        p.logicalX = p.startX
        p.logicalY = p.startY
        p.targetX  = p.startX
        p.targetY  = p.startY
        p.moveProgress = 0
      }
    }

    // ── Auto-disembark on shore (safe mooring) or land (boat lost) ────────
    if (onShore && !p.isMoving && p.pathQueue.length === 0) {
      if (Date.now() - (this._activatedAt ?? 0) < 800) return
      this._triggerDisembark(false)
      return
    }
    if (onLand && !p.isMoving) {
      if (Date.now() - (this._activatedAt ?? 0) < 800) return
      this._triggerDisembark(true)
      return
    }

    // ── Speed modifier ────────────────────────────────────────────────────
    // Shore: half speed, no drift; Water: normal speed, drift when idle
    if (onShore) {
      if (p.terrainSpeedModifier !== SHORE_SPEED_MULT) {
        p.setTerrainSpeedModifier(SHORE_SPEED_MULT)
      }
    } else {
      if (p.terrainSpeedModifier !== 1.0) {
        p.setTerrainSpeedModifier(1.0)
      }
    }

    // ── East drift ────────────────────────────────────────────────────────
    // Only when on open water, not moving, not on shore
    if (onWater && !onShore && !p.isMoving && p.pathQueue.length === 0) {
      this._applyDrift(delta, ts, mapData)
    }"""

new_terrain = r"""    const onReed  = REED_GIDS.has(gid)
    const onWater = WATER_GIDS.has(gid)
    const onLand  = !onReed && !onWater
    if (this._lastGid !== gid) { this._lastGid = gid; console.log('[boat] tile gid:', gid, 'onReed:', onReed, 'onWater:', onWater, 'onLand:', onLand) }

    // Cancel mid-step if heading onto land (belt-and-suspenders guard)
    if (onLand && p.isMoving) {
      p.isMoving = false
      p.logicalX = p.startX
      p.logicalY = p.startY
      p.targetX  = p.startX
      p.targetY  = p.startY
      p.moveProgress = 0
    }

    // ── Auto-disembark on land only (reeds are safe, no auto-disembark) ──
    if (onLand && !p.isMoving) {
      if (Date.now() - (this._activatedAt ?? 0) < 800) return
      this._triggerDisembark(true)   // boat lost to current
      return
    }

    // ── Speed modifier ────────────────────────────────────────────────────
    // Water: full speed + drift when idle
    // Reeds: half speed, no drift (wading feel)
    if (onReed) {
      if (p.terrainSpeedModifier !== SHORE_SPEED_MULT) {
        p.setTerrainSpeedModifier(SHORE_SPEED_MULT)
      }
    } else {
      if (p.terrainSpeedModifier !== 1.0) {
        p.setTerrainSpeedModifier(1.0)
      }
    }

    // ── East drift ────────────────────────────────────────────────────────
    // Only on open water, not reeds, not moving
    if (onWater && !p.isMoving && p.pathQueue.length === 0) {
      this._applyDrift(delta, ts, mapData)
    }"""

# _rebuildWalkGrid -- isWaterOrShore line
old_grid = r"""        // In boat: water and shore tiles are walkable; land tiles are not
        // Shore tiles are the disembark destination -- reachable but trigger exit
        const isWaterOrShore = WATER_GIDS.has(gid) || SHORE_GIDS.has(gid)
        // Preserve border/wall collisions from original grid
        const originallyWalkable = scene.walkGrid[y]?.[x] ?? false
        if (isWaterOrShore) {"""

new_grid = r"""        // In boat: water and reed tiles are walkable; land tiles block the boat
        const isBoatPassable = WATER_GIDS.has(gid) || REED_GIDS.has(gid)
        if (isBoatPassable) {"""

# isValidBoatTarget
old_valid = r"""    return WATER_GIDS.has(gid) || SHORE_GIDS.has(gid)"""
new_valid = r"""    return WATER_GIDS.has(gid) || REED_GIDS.has(gid)"""

# deactivate() -- onShore check for drifting boat
old_deact = r"""      const onShore = SHORE_GIDS.has(gid)"""
new_deact = r"""      const onShore = REED_GIDS.has(gid)   // reeds = safe moor, no drift"""

txt = BOAT.read_text()
for old, new, label in [
    (old_gids,    new_gids,    'GID sets'),
    (old_terrain, new_terrain, 'update() terrain block'),
    (old_grid,    new_grid,    '_rebuildWalkGrid'),
    (old_valid,   new_valid,   'isValidBoatTarget'),
    (old_deact,   new_deact,   'deactivate onShore'),
]:
    if old in txt:
        txt = txt.replace(old, new, 1)
        print(f'[boatSystem.js] patched: {label}')
    else:
        print(f'[boatSystem.js] WARNING -- not found: {label}', file=sys.stderr)

BOAT.write_text(txt)

# ─────────────────────────────────────────────────────────────────────────────
# 2. bogLocationScene.js -- isColliding + disembark badge
# ─────────────────────────────────────────────────────────────────────────────

BOG = ROOT / 'js/game/scenes/locations/bog/bogLocationScene.js'

old_collide = r"""    // In boat: water and shore tiles are always passable
    if (this.player?.inBoat) {
      const _g = this.mapData.layers[0]?.[ty]?.[tx]
      const _water = new Set([1625,1679])
      const _shore = new Set([1472,1473,1474,1526,1528,1580,1581,1582,1635,1636,1689,1690,1742,1743,1796,1797,1852,1906,1958,1959,1960,2012,2013,731])
      if (_water.has(_g) || _shore.has(_g)) return false
      return true
    }"""

new_collide = r"""    // In boat: only water (1625,1679) and reeds (731) are passable
    if (this.player?.inBoat) {
      const _g = this.mapData.layers[0]?.[ty]?.[tx]
      if (_g === 1625 || _g === 1679 || _g === 731) return false
      return true   // land blocks boat
    }"""

# disembark badge in update() -- _shore set includes 731, should NOT
old_badge = r"""        const _water = new Set([1625,1679])
        const _shore = new Set([1472,1473,1474,1526,1528,1580,1581,1582,
          1635,1636,1689,1690,1742,1743,1796,1797,1852,1906,
          1958,1959,1960,2012,2013,731])
        const _onLand = !_water.has(_gid) && !_shore.has(_gid) && _gid !== 0"""

new_badge = r"""        // Land = anything that is not water or reeds
        const _onLand = _gid !== 1625 && _gid !== 1679 && _gid !== 731 && _gid !== 0"""

txt = BOG.read_text()
for old, new, label in [
    (old_collide, new_collide, 'isColliding boat branch'),
    (old_badge,   new_badge,   'disembark badge _onLand check'),
]:
    if old in txt:
        txt = txt.replace(old, new, 1)
        print(f'[bogLocationScene.js] patched: {label}')
    else:
        print(f'[bogLocationScene.js] WARNING -- not found: {label}', file=sys.stderr)

BOG.write_text(txt)

# ─────────────────────────────────────────────────────────────────────────────
# 3. baseLocationScene.js -- block joystick step onto land when inBoat
# ─────────────────────────────────────────────────────────────────────────────

BASE = ROOT / 'js/game/scenes/locations/baseLocationScene.js'

old_joy = r"""        if (this.isColliding(targetX, targetY)) {
          this.joystick.force = 0;
          if (this.player.isMoving) this.player.isMoving = false;
        }"""

new_joy = r"""        if (this.isColliding(targetX, targetY)) {
          this.joystick.force = 0;
          if (this.player.isMoving) this.player.isMoving = false;
          // Hard-stop: prevent startNewStep from running this frame
          dx = 0; dy = 0;
        }

        // Extra guard for boat: even if isColliding passed, double-check
        // that the target tile is water or reeds (731). This catches any
        // path that slips through isColliding on non-bog scenes.
        if (this.player?.inBoat && (dx !== 0 || dy !== 0)) {
          const _btx = Math.floor(targetX / this.player.tileSize)
          const _bty = Math.floor(targetY / this.player.tileSize)
          const _bg  = this.mapData?.layers?.[0]?.[_bty]?.[_btx] ?? 0
          if (_bg !== 1625 && _bg !== 1679 && _bg !== 731) {
            this.joystick.force = 0;
            dx = 0; dy = 0;
          }
        }"""

txt = BASE.read_text()
if old_joy in txt:
    txt = txt.replace(old_joy, new_joy, 1)
    print('[baseLocationScene.js] patched: joystick boat guard')
else:
    print('[baseLocationScene.js] WARNING -- not found: joystick boat guard', file=sys.stderr)

# dx/dy are computed above the block but joystick.force=0 alone doesn't
# prevent player.update() from calling startNewStep. We need to ensure
# dx/dy are in scope. Check if the block already declares them:
# (they are declared earlier in the same if-block, so dx=0;dy=0 is valid)

BOG.write_text(BOG.read_text())  # no-op flush
BASE.write_text(txt)

# ─────────────────────────────────────────────────────────────────────────────
# 4. player.js -- startNewStep collision guard
# ─────────────────────────────────────────────────────────────────────────────

PLAYER = ROOT / 'js/game/player/player.js'

old_step = r"""    this.targetX = this.startX + dx * this.tileSize;
    this.targetY = this.startY + dy * this.tileSize;

    const pgr = this.scene.perspectiveGround;"""

new_step = r"""    this.targetX = this.startX + dx * this.tileSize;
    this.targetY = this.startY + dy * this.tileSize;

    // Final collision guard -- catches diagonal steps and path-queue steps
    // that bypass the pre-check in baseLocationScene.update().
    if (this.scene?.isColliding?.(this.targetX, this.targetY)) {
      this.targetX = this.startX;
      this.targetY = this.startY;
      this.isMoving = false;
      return;
    }

    const pgr = this.scene.perspectiveGround;"""

txt = PLAYER.read_text()
if old_step in txt:
    txt = txt.replace(old_step, new_step, 1)
    print('[player.js] patched: startNewStep collision guard')
else:
    print('[player.js] WARNING -- not found: startNewStep collision guard', file=sys.stderr)

PLAYER.write_text(txt)

print('\nDone. All patches applied.')

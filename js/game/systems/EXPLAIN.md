# PGR Architecture — Perspective Ground Renderer System

## Overview

The perspective rendering system is split into three modules:

```
PerspectiveGroundRenderer.js   Core perspective engine (ground, billboards, sky)
ElevationRenderer.js           3D elevated terrain (cliffs, plateaus, side faces)
PlayerRenderer.js              Player/boat animation + enemy rendering guide
```

These work together but are independently optional. A simple forest map needs
only PerspectiveGroundRenderer. The estuary needs all three.

---

## Module Responsibilities

### PerspectiveGroundRenderer.js
- Canvas and DOM element management (sky, mountain, fog, lighting)
- Core projection math: `_rowToScreenY`, `_scaleAtRow`, `_colToScreenX`
- Ground tile rendering (trapezoid warping, water animation, tinting)
- Layer 1 billboard rendering (trees, encounter flags, exit markers)
- Player and boat rendering (`_drawPlayerAnimated`)
- Reads `this._elev` if set by ElevationRenderer

### ElevationRenderer.js
- Builds per-tile elevation lookup from layer 0 map data
- Exposes `getElevationScreenOffset(tileX, tileY)` for enemy/NPC rendering
- Sets `pgr._elev` so PGR tile loop applies north plateau elevation
- Does NOT draw — all drawing happens inside PGR's tile loop using the elev data

### PlayerRenderer.js
- Documents the animation state interface for multi-character support
- Provides `createAnimState()` and `buildCanvasFromTexture()` utilities
- Not yet fully decoupled — player animation state still lives in PGR

---

## Map Layer Convention

```
Layer 0   Ground tiles (grass, stone, water, void)
Layer 1   North cliff edge markers + billboards (trees, objects)
Layer 2   North plateau grass/stone caps (flat elevated trapezoids)
Layer 3   South plateau elevated tiles (same GIDs as layer 0, drawn shifted up)
Layer 4+  Reserved (currently unused)
```

Maps opt into elevation with `"hasCliffs": true` in the map JSON.
Maps without this flag render flat — zero overhead from ElevationRenderer.

---

## Scene Setup

```js
// In drawTilemap():
this.perspectiveGround = new PerspectiveGroundRenderer(this)

if (this.mapData.hasCliffs) {
  this.elevationRenderer = new ElevationRenderer(this.perspectiveGround, {
    cliffGids:    new Set([740]),
    cliffFaceGid: 740,
    elevatedGids: new Set([839, 840]),
    cliffSouth:   new Set([731, 1625, 1679]),
    cliffHeight:  1.0,
  })
}

// Skip layers 1-3 for Phaser (PGR handles them):
if (this.usePerspective && li <= 3) continue

// In update():
if (this.elevationRenderer) this.elevationRenderer.update(this.mapData)
if (this.perspectiveGround) this.perspectiveGround.update()

// In shutdown():
if (this.elevationRenderer) { this.elevationRenderer.destroy(); this.elevationRenderer = null }
```

---

## Adding Elevation to a New Map

### 1. Dungeon with raised walkways and pits

```js
this.elevationRenderer = new ElevationRenderer(pgr, {
  cliffGids:    new Set([512]),     // dungeon wall edge GID
  cliffFaceGid: 512,                // stone wall sprite
  elevatedGids: new Set([500, 501]),// stone floor GIDs
  cliffSouth:   new Set([0, 600]),  // void/pit GIDs
  cliffHeight:  1.5,                // taller dungeon walls
  sideColor:    '#1a1a2e',          // fixed dark stone colour for sides
})
```

Layer structure for dungeon:
- Layer 0: stone floor (500/501) and void/pit (0)
- Layer 1: wall edge markers (512)
- Layer 2: raised walkway surface caps
- Layer 3: south-facing raised walkway tiles (behind camera side)

### 2. Castle with battlements

```js
this.elevationRenderer = new ElevationRenderer(pgr, {
  cliffGids:    new Set([620, 621]),// battlement GIDs
  cliffFaceGid: 620,
  elevatedGids: new Set([610, 611]),// castle floor tiles
  cliffSouth:   new Set([0, 730]), // moat/ground
  cliffHeight:  2.0,               // two tile heights — imposing walls
})
```

### 3. Hilltop ruins (outdoor, no water)

```js
this.elevationRenderer = new ElevationRenderer(pgr, {
  cliffGids:    new Set([740]),
  cliffFaceGid: 740,
  elevatedGids: new Set([839, 840, 841]),// grass + ruin floor
  cliffSouth:   new Set([733, 734]),     // lowland grass border
  cliffHeight:  1.0,
})
```

---

## Rendering Enemies on Elevated Ground

```js
// In your enemy update/render loop:

const proj = pgr.perspectiveProject(enemy.tileX, enemy.tileY)
if (!proj) return // off screen

// Get elevation offset (0 if not elevated)
const elevOffset = elevationRenderer?.getElevationScreenOffset(
  enemy.tileX, enemy.tileY
) ?? 0

// Draw enemy billboard at correct elevated height
const scaledW = pgr._scaleAtRow(enemy.tileY + 1)
const canvas  = buildCanvasFromTexture(scene, 'enemies', enemy.frameName)
if (canvas) {
  pgr._oCtx.save()
  // Flip sprite if facing left
  if (enemy.facingLeft) {
    pgr._oCtx.scale(-1, 1)
    pgr._oCtx.translate(-2 * proj.screenX, 0)
  }
  pgr._drawBillboard(pgr._oCtx, canvas,
    proj.screenX,
    proj.screenY + elevOffset,
    scaledW,
    1.6)  // heightMult: human ~1.6, creature ~2.0, dwarf ~1.2
  pgr._oCtx.restore()
}
```

### Enemy depth sorting
Enemies should be drawn in row order (same pass as the ground tile loop) so
they appear behind tiles that are further south. The simplest approach: collect
all enemies in a list sorted by `logicalY`, then draw them in the PGR update
pass after ground tiles but before the deferred cliff faces.

---

## Projection Reference

```js
// Screen Y for a world row (null if behind camera)
pgr._rowToScreenY(worldRow)

// Pixels per tile at a given row depth
pgr._scaleAtRow(worldRow)

// Screen X for a world column at a given row depth
pgr._colToScreenX(worldCol, worldRow)

// Full projection for a logical pixel position
pgr._projectLogical(logicalPixelX, logicalPixelY)
// Returns { screenX, screenY, scale } or null

// Public projection for tile coordinates
pgr.perspectiveProject(worldTileX, worldTileY)
// Returns { screenX, screenY, scale } or null
```

---

## Known Constraints

- **South plateau tiles** (rows near/behind camera) can't use standard
  perspective projection. They are rendered via layer 3 with a Y-shift approach.
  Enemy sprites on south plateau rows should use the same Y-shift technique.

- **CLIFF_HEIGHT** is a static on PGR. ElevationRenderer has its own
  `cliffHeight` instance config. For consistency, ElevationRenderer's value
  should match the static when using the same map. Future: remove the static
  and read from ElevationRenderer config only.

- **tileDisplaySize** (48px) is fixed. Different tile sizes would require
  adjusting CAMERA_ROW_OFFSET and TILES_ACROSS proportionally.


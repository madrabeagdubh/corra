// PlayerRenderer.js
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS MODULE DOES
// ─────────────────────────────────────────────────────────────────────────────
// Owns all player and boat visual rendering within the PGR canvas system.
// Extracted from PerspectiveGroundRenderer to allow:
//   • Multiple characters (party members, enemies) using the same pipeline
//   • Per-character animation state without polluting the main renderer
//   • Easy addition of enemy/NPC rendering on elevated ground
//
// The PGR itself still calls _drawPlayerAnimated() internally for now.
// This module documents the interface so it can be fully decoupled later.
//
// ─────────────────────────────────────────────────────────────────────────────
// HOW TO USE FOR ENEMIES / NPCs
// ─────────────────────────────────────────────────────────────────────────────
//
// To render an enemy billboard using the same perspective pipeline:
//
//   // 1. Create a canvas from the enemy sprite sheet frame
//   const enemyCanvas = pgr._getTileCanvas(enemyGid)
//   // or for a Phaser texture:
//   const enemyCanvas = buildCanvasFromTexture(scene, 'enemyTexture', frameName)
//
//   // 2. Project their logical position
//   const proj = pgr.perspectiveProject(enemy.tileX, enemy.tileY)
//   if (!proj) return // off screen or behind horizon
//
//   // 3. Apply elevation offset if on raised ground
//   const elevOffset = elevationRenderer?.getElevationScreenOffset(enemy.tileX, enemy.tileY) ?? 0
//
//   // 4. Draw billboard
//   const scaledW = pgr._scaleAtRow(enemy.tileY + 1)
//   pgr._drawBillboard(pgr._oCtx, enemyCanvas,
//     proj.screenX,
//     proj.screenY + elevOffset,
//     scaledW,
//     1.6)  // heightMult: 1.6 for human, 2.0 for tall creature, 1.0 for short
//
// For enemies that face left/right, flip with ctx.scale(-1, 1) before drawing.
// For enemies on SOUTH plateau (behind camera), use yTopClamped from the tile
// loop rather than perspectiveProject() — see ElevationRenderer.js notes.
//
// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION STATE
// ─────────────────────────────────────────────────────────────────────────────
//
// The player animation state lives on the PGR instance as private fields:
//   _animT, _stepT, _swaySign, _facingLeft, _wobblePhase, _wobbleAmp,
//   _strokeT, _boatScreenX, _boatScreenY, _prevBoatVX etc.
//
// To support multiple animated characters, each would need its own state block.
// The simplest approach: create a plain object per entity:
//   const state = createAnimState()  // see below
// and pass it to drawCharacter(ctx, canvas, screenX, screenY, scaledW, state, dt)
//
// This refactor is NOT done yet — the player still uses PGR-internal state.
// This file documents the intended interface for when it becomes necessary.
//
// ─────────────────────────────────────────────────────────────────────────────
// BOAT RENDERING
// ─────────────────────────────────────────────────────────────────────────────
//
// The boat canvas is loaded via pgr.loadBoatImage(imgElement).
// pgr.setBoatActive(true/false) switches between player-attached and
// drift modes. The drift mode uses pgr._boatWorldX/Y for position.
//
// To add a second boat or vehicle:
//   pgr._boatCanvas2 = buildCanvas(scene, 'canoe')
//   // then draw it manually in scene.update() using pgr._projectLogical()
//

/**
 * Factory for per-entity animation state.
 * Use one of these per enemy/NPC that needs walk animation.
 *
 * @returns {object} Fresh animation state block
 */
export function createAnimState() {
  return {
    animT:        0,       // global time accumulator (radians, wraps at 2π*100)
    stepT:        0,       // step cycle progress 0→1
    swaySign:     1,       // which side to sway toward
    facingLeft:   false,   // sprite flip
    moveDir:      'ew',    // 'ew' or 'ns' — affects bounce/sway axis
    isMoving:     false,
    wobblePhase:  0,       // boat wobble phase
    wobbleAmp:    0.012,   // boat wobble amplitude
    strokeT:      0,       // oar stroke cycle
    prevVX:       0,       // previous frame vx (for accel tilt)
  }
}

/**
 * Helper: build a canvas from a Phaser texture frame.
 * Useful for rendering enemy sprites through the PGR billboard pipeline.
 *
 * @param {Phaser.Scene} scene
 * @param {string}       textureKey
 * @param {string}       frameName
 * @returns {HTMLCanvasElement|null}
 */
export function buildCanvasFromTexture(scene, textureKey, frameName) {
  try {
    const tex   = scene.textures.get(textureKey)
    if (!tex || tex.key === '__MISSING') return null
    const frame = tex.get(frameName)
    if (!frame) return null
    const src = tex.getSourceImage()
    const { cutX, cutY, cutWidth, cutHeight } = frame
    const c   = document.createElement('canvas')
    c.width   = cutWidth
    c.height  = cutHeight
    const ctx = c.getContext('2d')
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(src, cutX, cutY, cutWidth, cutHeight, 0, 0, cutWidth, cutHeight)
    return c
  } catch(e) {
    console.warn('[PlayerRenderer] buildCanvasFromTexture failed:', e.message)
    return null
  }
}


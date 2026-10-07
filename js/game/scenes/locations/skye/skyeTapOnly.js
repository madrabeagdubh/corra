// skyeTapOnly.js
// Location: js/game/scenes/locations/skye/skyeTapOnly.js
//
// Tap-to-walk without route drawing, for places before the training garden teaches it (the cabin, the cottage
// garden). A tap walks to the tapped tile; a drag does nothing, and the finger is not captured, so a swipe through
// a conversation card belongs to the card alone. Call from _setupTapToPath(); returns a function that takes the
// listeners off again (call it on shutdown).

import PathFinder from '../../../systems/pathFinder.js'

export function setupTapOnly(scene) {
  const canvas = scene.game.canvas
  const toCanvas = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height] }
  let down = null
  const onDown = (e) => {
    const [x, y] = toCanvas(e)
    const jx = scene.scale.width / 2, jy = scene._joyY
    if ((x - jx) ** 2 + (y - jy) ** 2 < 100 * 100 || scene.textPanel?.isVisible || scene._encounterPanel?._isOpen || !scene.perspectiveGround) return
    down = { id: e.pointerId, x, y }
  }
  const onUp = (e) => {
    if (!down || e.pointerId !== down.id) return
    const d = down; down = null
    const [x, y] = toCanvas(e)
    if (Math.hypot(x - d.x, y - d.y) > 16 || scene._onTapBeforePath(x, y) === false) return
    const tile = PathFinder.screenToTile(d.x, d.y, scene.perspectiveGround, scene.tileSize)
    if (!tile) return
    const path = scene.pathFinder.findPath(Math.floor(scene.player.logicalX / scene.tileSize), Math.floor(scene.player.logicalY / scene.tileSize), tile.tx, tile.ty)
    if (path.length > 0) { scene.player.setPath(path); scene._flashTargetTile(tile.tx, tile.ty) }
  }
  const onCancel = () => { down = null }
  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onCancel)
  return () => { canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onCancel) }
}

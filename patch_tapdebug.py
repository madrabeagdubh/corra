path = 'js/game/scenes/locations/perspectiveScene.js'
src = open(path).read()

old = """      const canvasY = (e.clientY - rect.top)  * scaleY

      const joyX = this.scale.width / 2, joyY = this._joyY, joyR = 100"""

new = """      const canvasY = (e.clientY - rect.top)  * scaleY

      // TEMP DEBUG -- unconditional, no side effects (doesn't call
      // setPath), fires before any early return so it works in boat
      // mode / with panels open / anywhere else _onTapBeforePath or
      // the other guards below would normally intercept the tap.
      if (this.perspectiveGround) {
        const _dbgTile = PathFinder.screenToTile(canvasX, canvasY, this.perspectiveGround, this.tileSize)
        console.log('[TAP DEBUG2] tile:', _dbgTile)
      }

      const joyX = this.scale.width / 2, joyY = this._joyY, joyR = 100"""

assert src.count(old) == 1, f"match count: {src.count(old)}"
open(path, 'w').write(src.replace(old, new))
print("Patched OK")

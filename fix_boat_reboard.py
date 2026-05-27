f1 = 'js/game/systems/boatSystem.js'
s1 = open(f1).read()

old1 = '  update(delta) {\n    if (!this.active) return\n    const p = this.scene.player\n    if (!p) return'
new1 = '  update(delta) {\n    const p = this.scene.player\n    if (!p) return\n\n    if (!this.active) {\n      const pgr = this.scene.perspectiveGround\n      if (pgr?._boatWorldX != null) {\n        const ts     = this.scene.tileSize\n        const boatTX = Math.round(pgr._boatWorldX / ts)\n        const boatTY = Math.round(pgr._boatWorldY / ts)\n        const pTX    = Math.floor(p.logicalX / ts)\n        const pTY    = Math.floor(p.logicalY / ts)\n        if (pTX === boatTX && pTY === boatTY && !p.isMoving) {\n          this._reboard(p, pgr)\n        }\n      }\n      return\n    }'
if old1 in s1:
    s1 = s1.replace(old1, new1)
    print('update: done')
else:
    print('update: NO MATCH')

old2 = '  destroy() {\n    this.deactivate()\n    console.log(\'[BoatSystem] destroyed\')\n  }'
new2 = '  _reboard(p, pgr) {\n    const ts = this.scene.tileSize\n    const boatTX = Math.round(pgr._boatWorldX / ts)\n    const boatTY = Math.round(pgr._boatWorldY / ts)\n    p.logicalX = boatTX * ts + ts / 2\n    p.logicalY = boatTY * ts + ts / 2\n    p.targetX  = p.logicalX\n    p.targetY  = p.logicalY\n    p.startX   = p.logicalX\n    p.startY   = p.logicalY\n    pgr._boatDrifting = false\n    pgr._boatWorldX   = null\n    pgr._boatWorldY   = null\n    if (this.scene.textures.exists(\'boat\')) {\n      pgr.loadBoatImage(this.scene.textures.get(\'boat\').getSourceImage())\n    }\n    this.activate()\n    console.log(\'[BoatSystem] reboarded\')\n  }\n\n  destroy() {\n    this.deactivate()\n    console.log(\'[BoatSystem] destroyed\')\n  }'
if old2 in s1:
    s1 = s1.replace(old2, new2)
    print('reboard: done')
else:
    print('reboard: NO MATCH')

open(f1, 'w').write(s1)

f2 = 'js/game/effects/perspectiveGroundRenderer.js'
s2 = open(f2).read()

old3 = '        const driftPxPerFrame = (this._boatDriftSpeed ?? 18) / 60\n        this._boatWorldX = (this._boatWorldX ?? 0) + driftPxPerFrame'
new3 = '        const _dTS  = this.tileDisplaySize\n        const _dTX  = Math.floor((this._boatWorldX ?? 0) / _dTS)\n        const _dTY  = Math.floor((this._boatWorldY ?? 0) / _dTS)\n        const _dGid = this.scene.mapData?.layers?.[0]?.[_dTY]?.[_dTX] ?? 0\n        const _dShore = new Set([1472,1473,1474,1526,1528,1580,1581,1582,1635,1636,1689,1690,1742,1743,1796,1797,1852,1906,1958,1959,1960,2012,2013])\n        const driftPxPerFrame = _dShore.has(_dGid) ? 0 : (this._boatDriftSpeed ?? 18) / 60\n        this._boatWorldX = (this._boatWorldX ?? 0) + driftPxPerFrame'
if old3 in s2:
    s2 = s2.replace(old3, new3)
    open(f2, 'w').write(s2)
    print('shore stop: done')
else:
    print('shore stop: NO MATCH')

f3 = 'js/game/scenes/locations/bog/bogLocationScene.js'
s3 = open(f3).read()

old4 = '    // In boat: reject taps on land tiles; only water + shore are valid\n    if (this.player?.inBoat && this.boatSystem) {\n      if (!this.boatSystem.isValidBoatTarget(tile.tx, tile.ty)) return\n    }'
new4 = '    // In boat: reject taps on land tiles; only water + shore are valid\n    if (this.player?.inBoat && this.boatSystem) {\n      if (!this.boatSystem.isValidBoatTarget(tile.tx, tile.ty)) return\n    }\n    if (!this.player?.inBoat) {\n      const pgr = this.perspectiveGround\n      const ts  = this.tileSize\n      if (pgr?._boatWorldX != null) {\n        const boatTX = Math.round(pgr._boatWorldX / ts)\n        const boatTY = Math.round(pgr._boatWorldY / ts)\n        if (tile.tx === boatTX && tile.ty === boatTY) {\n          if (this.walkGrid[boatTY]) this.walkGrid[boatTY][boatTX] = true\n        }\n      }\n    }'
if old4 in s3:
    s3 = s3.replace(old4, new4)
    open(f3, 'w').write(s3)
    print('tap: done')
else:
    print('tap: NO MATCH')

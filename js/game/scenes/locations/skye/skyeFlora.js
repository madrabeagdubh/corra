// skyeFlora.js
// Location: js/game/scenes/locations/skye/skyeFlora.js
//
// The planting for Skye's open country (the loch, the machaire): a scene's getVegetation()
// returns skyeFlora(this) and Vegetation (effects/vegetation.js) does the rest.
//
//   by the water   yellow flag, loosestrife, bog cotton, meadowsweet -- the wetter the nearer the shore
//   on the slopes  harebell, daisy, knapweed, trefoil, scabious, ragwort, foxglove, gorse
//   thickets       mapData.hedgeMask: dense gorse and bramble (solid: skyeScene.isColliding)
//   the island     mapData.flowerBed: 0 off the island, else 0.1-1, the share of ground in flower: scarce
//                  where the traffic goes, thick at the far ends. Meadow flowers only, where it's thick
//
// Nothing grows in the water, on the stepping stones, under a standing stone or on the trodden path
// (mapData.pathDist), and flowers keep out of the thickets. Thinned by a hash, so the same
// tile always grows the same thing and the ground reads as a place, not a wallpaper.

const LOCH = 1679
const WET = ['feileastram', 'creachtach', 'ceannbhan', 'airgead']
const MEADOW = ['mearacan', 'noinin', 'minscoth', 'crobhein', 'odhrach']
const DRY = ['aiteann', 'buachalan', 'lusmor']
const TALL = new Set(['lusmor', 'aiteann', 'creachtach', 'buachalan', 'odhrach'])      // kept out of the foreground: they'd stand across the view
const HEDGE = ['aiteanntor', 'aiteanntor', 'aiteanntor', 'dris']        // listed more than once: more of them in a thicket

function hash(x, y, s = 0) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (s | 0) * 2147483647
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export default function skyeFlora(scene, { density = 0.55 } = {}) {
  const md = () => scene.mapData
  const tile = (c, r) => md().layers[0][r]?.[c]
  const isWater = (c, r) => tile(c, r) === LOCH
  let shore = null                                           // tiles from the water, built on first use
  const shoreD = (c, r) => {
    if (!shore) {
      const W = md().width, H = md().height, pts = []
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isWater(x, y)) pts.push([x, y])
      shore = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
        let d = 99
        for (const [a, b] of pts) { const dd = Math.hypot(a - x, b - y); if (dd < d) d = dd }
        return d
      }))
    }
    return shore[r]?.[c] ?? 99
  }
  const blockedAt = (c, r) => !!md().blockMask?.[r]?.[c]
  const bedAt = (c, r) => md().flowerBed?.[r]?.[c] || 0
  const hedgeAt = (c, r) => !!md().hedgeMask?.[r]?.[c]
  return {
    species: [...WET, ...MEADOW, ...DRY, ...HEDGE],
    density: 1, clumpBias: 0.3, perTile: 3, scaleJitter: 0.4, onGround: true,
    isWater,
    wetnessAt: (c, r) => Math.max(0.18, Math.min(0.95, 1 - (shoreD(c, r) - 0.5) / 6.5)),
    allowAt: (key, c, r) => {
      const thicket = HEDGE.includes(key)
      if (thicket) return hedgeAt(c, r)
      if (hedgeAt(c, r) || blockedAt(c, r)) return false
      if ((md().pathDist?.[r]?.[c] ?? 1) < 0.5) return false           // the trodden way
      const p = scene.player, ts = scene.tileSize
      if (TALL.has(key) && p && r >= Math.floor(p.logicalY / ts) - 1) return false       // nothing tall between you and the view
      const bed = bedAt(c, r)
      if (bed > 0) {                                                       // the island
        if (bed > 0.4 && !MEADOW.includes(key)) return false
        return hash(c, r, key.length * 31) < bed
      }
      const near = shoreD(c, r) < 2.5
      return hash(c, r, key.length * 31) < density * (near ? 1.25 : 1)
    },
  }
}

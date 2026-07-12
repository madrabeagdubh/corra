// pgrShared.js — GID tables and small pure helpers shared between the
// PGR core and its pgr/ modules.
// Location: js/game/effects/pgr/pgrShared.js
//
// Nothing in here touches a PGR instance or the DOM -- it's constants
// and pure functions only, so it can be imported from anywhere without
// creating circular-import risk.

export function tmHashPGR(tx, ty) {
  let h = (tx * 374761393 + ty * 1103515245) | 0
  h = Math.imul((h ^ (h >>> 16)), 0x45d9f3b)
  h = Math.imul((h ^ (h >>> 16)), 0x45d9f3b)
  return (h ^ (h >>> 16)) >>> 0
}

export function tileHash(tx, ty) {
  let h = (tx * 374761393 + ty * 1103515245) | 0
  h = Math.imul((h ^ (h >>> 16)), 0x45d9f3b)
  h = Math.imul((h ^ (h >>> 16)), 0x45d9f3b)
  return ((h ^ (h >>> 16)) & 0xffff) / 0xffff
}

// Mirror-reflect an index outside [0, n) back into range -- a "ping-pong"
// bounce (0,1,2,...,n-1,n-1,...,2,1,0,0,1,2,...) rather than a straight
// wrap-repeat (i % n). Used by the phantom-tile rendering (core) and the
// north-preview (pgrNorthPreview.js) to extend a map's real ground data
// beyond its own edges: mirroring guarantees the seam at the REAL edge is
// always continuous (the first phantom index exactly re-shows the last
// real one), which a plain repeat can't promise since a map's opposite
// edges generally don't match.
export function mirrorIndex(i, n) {
  if (n <= 0) return 0
  const period = 2 * n
  let m = ((i % period) + period) % period
  if (m >= n) m = period - 1 - m
  return m
}

// h in degrees, s/l in percent -> [r, g, b] 0-255. Used by the LOD fill
// path (core _lodFillQuad) to blend a tile's HSL tint into its average
// RGB colour without going through a canvas composite operation.
export function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360
  s /= 100; l /= 100
  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

// Ground-category GIDs -- tiles whose tint comes from getGroundTint
// (heightmap-aware) rather than the plain getTint lookup.
export const GID_CATEGORIES_GROUND = new Set([
  732, 733, 735, 839, 840, 841, 842, 843, 844, 845, 846, 847, 848,
  849, 850, 851, 852, 853, 854, 855, 856, 857, 858, 859, 860, 861,
  862, 863, 893, 894, 895, 896, 897, 898, 899, 900, 901, 902, 903,
  904, 905, 906, 907, 908, 909, 910,
  1379, 1380, 1381, 1382, 1383, 1384, 1385, 1386, 1387, 1388,
  1389, 1390, 1391, 1392, 1393, 1394, 1395, 1396, 1397, 1398,
  1399, 1400, 1401, 1402, 1403, 1433, 1434, 1435, 1436, 1437,
  1438, 1439, 1440, 1441, 1442, 1443, 1444, 1445, 1446, 1447,
  1448, 1449, 1450,
  1254, 1255, 1256, 1257, 1258, 1259,
  1308, 1309, 1310, 1311, 1312, 1313,
])

export const BOG_TREE_GIDS      = new Set([208])
export const WITHERED_TREE_GIDS = new Set([209])

export const OAK_TOP_GIDS      = new Set([260, 261, 262])
export const OAK_MID_GIDS      = new Set([314, 315, 316, 422, 423, 424])
export const OAK_BOT_GIDS      = new Set([368, 369, 370, 476, 477, 478])

export const BOG_STAMP_TOP_GIDS = new Set([263, 264, 265])
export const BOG_STAMP_MID_GIDS = new Set([317, 318, 319, 425, 426, 427])
export const BOG_STAMP_BOT_GIDS = new Set([371, 372, 373, 479, 480, 481])

export const WITHERED_TOP_GIDS  = new Set([266, 267, 268])
export const WITHERED_MID_GIDS  = new Set([320, 321, 322, 428, 429, 430])
export const WITHERED_BOT_GIDS  = new Set([374, 375, 376, 482, 483, 484])

export const OAK_STAMP_GIDS = new Set([
  ...OAK_TOP_GIDS, ...OAK_MID_GIDS, ...OAK_BOT_GIDS
])
export const BOG_STAMP_GIDS = new Set([
  ...BOG_STAMP_TOP_GIDS, ...BOG_STAMP_MID_GIDS, ...BOG_STAMP_BOT_GIDS
])
export const WITHERED_STAMP_GIDS = new Set([
  ...WITHERED_TOP_GIDS, ...WITHERED_MID_GIDS, ...WITHERED_BOT_GIDS
])


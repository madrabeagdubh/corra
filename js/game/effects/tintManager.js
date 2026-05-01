// tintManager.js
//
// Manages palette-driven tinting for all tile types.
// Palette is extracted automatically from the sky/backdrop image
// via setPaletteFromRGB(), or can be set manually via setMood().
//
// Usage:
//   import { TintManager } from './tintManager.js'
//   const tm = new TintManager()
//   tm.setPaletteFromRGB({ sky, mid, ground })  // from image extraction
//   const tint = tm.getTint(gid, tileCol, tileRow)

// -- RGB to HSL conversion ------------------------------------------------

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2

  if (max === min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

// -- Tile category assignments --------------------------------------------

const GID_CATEGORIES = {

  ground: new Set([
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
  ]),

  vegetation: new Set([
    44, 45, 46, 47, 48, 49, 50, 51, 52, 53,
    54, 88, 98, 100, 208, 209, 211,
    213, 214, 215, 216,
    260, 261, 262, 263, 264, 265, 266, 267, 268,
    314, 315, 316, 317, 318, 319, 320, 321, 322,
    368, 369, 370, 371, 372, 373, 374, 375, 376,
    422, 423, 424, 425, 426, 427, 428, 429, 430,
    476, 477, 478, 479, 480, 481, 482, 483, 484,
  ]),

  water: new Set([
    1634, 1635, 1636, 1688, 1689, 1690,
    1472, 1473, 1474, 1526, 1528,
    1580, 1581, 1582, 1742, 1743, 1744,
    1796, 1797, 1798, 1852, 1906,
    1958, 1959, 1960,
  ]),

  rock: new Set([
    154, 155, 156, 103, 109, 110, 111,
    217, 218, 219, 740,
  ]),

  warm: new Set([
    112, 113, 114, 116, 117, 118, 119, 120, 121, 122,
    123, 124, 125, 126, 127, 128, 129, 130, 131, 132,
    133, 134, 135, 137, 138, 142, 144, 145, 146, 147,
    148, 150, 152, 191, 192,
    220, 221, 222, 223, 224, 225, 226, 228, 229, 230,
    231, 232, 233, 234, 235, 236, 242, 243,
  ]),

  object: new Set([
    197, 198, 200, 201, 203, 249, 250, 251, 252, 253,
    255, 304, 409, 410, 411, 412, 414,
    465, 466, 467, 469, 470, 471, 472, 473, 474, 527,
    515, 517,
  ]),
}

// Build reverse lookup GID -> category
const GID_TO_CATEGORY = new Map()
for (const [cat, gids] of Object.entries(GID_CATEGORIES)) {
  for (const gid of gids) GID_TO_CATEGORY.set(gid, cat)
}

// -------------------------------------------------------------------------

export class TintManager {

  constructor() {
    // Default palette -- overridden by setPaletteFromRGB
    this._palette = this._buildDefaultPalette()
    console.log('[TintManager] constructed')
  }

  // Called with averaged RGB from three zones of the backdrop image.
  // sky    -- top third of image (sky colour, cool tones)
  // mid    -- middle third (mountain/horizon tones)
  // ground -- bottom third (land/vegetation tones)
  setPaletteFromRGB({ sky, mid, ground }) {
    const skyHSL    = rgbToHsl(sky.r,    sky.g,    sky.b)
    const midHSL    = rgbToHsl(mid.r,    mid.g,    mid.b)
    const groundHSL = rgbToHsl(ground.r, ground.g, ground.b)

    console.log('[TintManager] palette from image:',
      'sky:', skyHSL, 'mid:', midHSL, 'ground:', groundHSL)

    // Map image zones to tile categories:
    // ground tiles  -> ground zone of painting
    // vegetation    -> mid zone (where painted land/trees are)
    // water         -> sky zone (cool, distant)
    // rock          -> mid zone, desaturated and darkened
    // warm/object   -> ground zone, warmed slightly

    this._palette = {
      ground: {
        h: groundHSL.h,
        s: Math.min(groundHSL.s + 10, 60),
        l: Math.max(groundHSL.l - 5, 15),
        lVar: 10,
        alpha: 0.65,
      },
      vegetation: {
        h: midHSL.h,
        s: Math.min(midHSL.s + 15, 65),
        l: Math.max(midHSL.l - 3, 18),
        lVar: 14,
        alpha: 0.62,
      },
      water: {
        h: skyHSL.h,
        s: Math.min(skyHSL.s + 8, 50),
        l: Math.max(skyHSL.l - 8, 15),
        lVar: 8,
        alpha: 0.60,
      },
      rock: {
        h: midHSL.h,
        s: Math.max(midHSL.s - 5, 5),
        l: Math.max(midHSL.l - 8, 20),
        lVar: 12,
        alpha: 0.55,
      },
      warm: {
        h: (groundHSL.h + 15) % 360,
        s: Math.min(groundHSL.s + 8, 50),
        l: Math.max(groundHSL.l - 3, 20),
        lVar: 8,
        alpha: 0.50,
      },
      object: {
        h: (groundHSL.h + 10) % 360,
        s: Math.min(groundHSL.s + 5, 45),
        l: groundHSL.l,
        lVar: 6,
        alpha: 0.45,
      },
    }

    console.log('[TintManager] palette set from image extraction')
  }

  // Manual mood override -- useful when no backdrop image is set
  setMood(mood) {
    const moods = {
      bog_threshold: {
        ground:     { h: 95,  s: 30, l: 26, lVar: 10, alpha: 0.65 },
        vegetation: { h: 88,  s: 35, l: 33, lVar: 14, alpha: 0.62 },
        water:      { h: 185, s: 25, l: 28, lVar: 8,  alpha: 0.60 },
        rock:       { h: 268, s: 14, l: 40, lVar: 12, alpha: 0.55 },
        warm:       { h: 30,  s: 28, l: 32, lVar: 8,  alpha: 0.50 },
        object:     { h: 35,  s: 22, l: 38, lVar: 6,  alpha: 0.45 },
      },
      oak_wood: {
        ground:     { h: 100, s: 32, l: 28, lVar: 10, alpha: 0.62 },
        vegetation: { h: 95,  s: 38, l: 35, lVar: 14, alpha: 0.60 },
        water:      { h: 180, s: 22, l: 30, lVar: 8,  alpha: 0.58 },
        rock:       { h: 240, s: 10, l: 42, lVar: 12, alpha: 0.52 },
        warm:       { h: 35,  s: 25, l: 35, lVar: 8,  alpha: 0.48 },
        object:     { h: 38,  s: 18, l: 40, lVar: 6,  alpha: 0.44 },
      },
    }
    this._palette = moods[mood] ?? this._buildDefaultPalette()
    console.log('[TintManager] mood set to:', mood)
  }

  // Override a single palette zone directly
  setPaletteZone(category, values) {
    if (!this._palette[category]) return
    Object.assign(this._palette[category], values)
    console.log('[TintManager] zone override:', category, values)
  }

  // Returns { h, s, l, alpha } for a given GID and tile position,
  // or null if the tile has no category mapping.
  getTint(gid, tx, ty) {
    const category = GID_TO_CATEGORY.get(gid)
    if (!category) return null

    const zone = this._palette[category]
    if (!zone) return null

    const t = _tmHash(tx, ty)

    return {
      h:     zone.h + (t - 0.5) * 14,
      s:     zone.s + t * 8,
      l:     zone.l + t * zone.lVar,
      alpha: zone.alpha,
    }
  }

  _buildDefaultPalette() {
    return {
      ground:     { h: 92,  s: 28, l: 26, lVar: 10, alpha: 0.62 },
      vegetation: { h: 88,  s: 32, l: 32, lVar: 14, alpha: 0.60 },
      water:      { h: 185, s: 20, l: 28, lVar: 8,  alpha: 0.58 },
      rock:       { h: 260, s: 10, l: 42, lVar: 12, alpha: 0.52 },
      warm:       { h: 30,  s: 24, l: 34, lVar: 8,  alpha: 0.48 },
      object:     { h: 34,  s: 18, l: 38, lVar: 6,  alpha: 0.44 },
    }
  }
}

// Deterministic hash for per-tile variance
function _tmHash(tx, ty) {
  let h = (tx * 374761393 + ty * 1103515245) | 0
  h = Math.imul((h ^ (h >>> 16)), 0x45d9f3b)
  h = Math.imul((h ^ (h >>> 16)), 0x45d9f3b)
  return ((h ^ (h >>> 16)) & 0xffff) / 0xffff
}


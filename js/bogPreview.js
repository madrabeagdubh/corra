import { Map as ROTMap } from 'rot-js'
import seedrandom from 'seedrandom'
import { createNoise2D } from 'simplex-noise'

const MAP_W = 20, MAP_H = 20
const TW = 24, TH = 24, MG = 24, SHEET_COLS = 54

const T = {
  bogBase: 733,

  mud: {
    fill:  1120,
    fill2: [1055, 1056, 678],
    N: 1121, S: 1124,
    E: 1123, W: 1122,
    NW: 1116, NE: 1117, SW: 1118, SE: 1119,
  },

  // Path tiles — dark mud, directional
  path: {
    NS:   1438,  // straight N-S
    EW:   1435,  // straight E-W
    // Corners — name = the two directions the path connects
    // e.g. SE = path comes from south AND east (bends between them)
    SE:   1386,  // south↔east  bend
    NE:   1442,  // north↔east  bend
    SW:   1441,  // south↔west  bend
    NW:   1443,  // west↔north  bend
    T_S:  1381,  // T-junction open south  (mud N+E+W)
    T_W:  1382,  // T-junction open west   (mud N+S+E) — 1381 rotated 90° CW
    T_N:  1383,  // T-junction open north  (mud E+S+W) — rotated 180°
    T_E:  1384,  // T-junction open east   (mud N+S+W) — rotated 270°
    cap_S: 1400, // end cap: path comes from south — swapped
    cap_W: 1401, // end cap: path comes from west
    cap_N: 1398, // end cap: path comes from north — swapped
    cap_E: 1399, // end cap: path comes from east
    fill:  [1379, 1380],
    stone: [1744, 1798], // stepping stones over water
  },

  water: [1634, 1688],
  waterEdge: {
    N: 1473, S: 1581, E: 1528, W: 1526,
    NW: 1472, NE: 1474, SW: 1580, SE: 1582,
    NWE: 1689, NES: 1636, SWN: 1635, WNS: 1690,
    NS: 1852, EW: 1906,
    island: [1744, 1798],
  },

  templeFloor: [221, 222, 223],
  wallCornerTL: 233, wallCornerTR: 234,
  wallCornerBL: 235, wallCornerBR: 236,
  wallH: 228, wallV: 231,
  wallVendN: 230, wallVendS: 232, wallSingle: 226,
  doorClosed: 137, doorOpen: 138, doorBroken: 142,
  doorIron: 144, doorPortal: 150, portcullis: 191,
  chest: 255, barrel: 201, coffin: 198,
  table: 249, throne: 252, weaponRack: 253,
  book: [469, 470, 471, 472],
  webs: [83, 84, 88],
  statue: 304, well: [465, 466],
  stairsUp: 224, stairsDown: 225,
  lillipad: 54,
  event: 570,   // temporary event location marker
  // Foliage — bushes, leaves, undergrowth for forest edge softening
  foliage: [208, 49, 50, 51, 52, 215, 216],

  // Trees — central tile + 8 directional surround tiles
  // Place as a 3x3 stamp: centre at (x,y), surrounding tiles fill the 8 neighbours
  tree: {
    C:  321,  // centre
    N:  266, NE: 268, E:  322,
    SE: 374, S:  375, SW: 376,
    W:  320, NW: 267,
  },
}

// ═══════════════════════════════════════════════════════════
// LAYERS
// L[0] bogBase   — 733 everywhere
// L[1] mud       — mud patches
// L[2] path      — dark mud path + stepping stones
// L[3] water     — water fill
// L[4] waterEdge — water edge autotile
// L[5] deco      — walls, props, doors, event markers
// ═══════════════════════════════════════════════════════════
const NUM_LAYERS = 6
let L = []
let waterGrid = []
let pathGrid  = []   // boolean — which cells are path
let clearingGrid = [] // boolean — digger floor cells, kept open

function initLayers () {
  L = []
  waterGrid = Array.from({length:MAP_H}, () => new Array(MAP_W).fill(false))
  pathGrid     = Array.from({length:MAP_H}, () => new Array(MAP_W).fill(false))
  clearingGrid = Array.from({length:MAP_H}, () => new Array(MAP_W).fill(false))
  for (let i = 0; i < NUM_LAYERS; i++) {
    L[i] = []
    for (let y = 0; y < MAP_H; y++) {
      L[i][y] = []
      for (let x = 0; x < MAP_W; x++) L[i][y][x] = 0
    }
  }
}

function set (layer, x, y, gid) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return
  L[layer][y][x] = gid
}
function get (layer, x, y) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return 0
  return L[layer][y][x]
}
function isWater (x, y) { return waterGrid[y]?.[x] ?? false }
function isPath     (x, y) { return pathGrid[y]?.[x]     ?? false }
function isClearing (x, y) { return clearingGrid[y]?.[x] ?? false }

let rng = Math.random
const pick = a => Array.isArray(a) ? a[Math.floor(rng() * a.length)] : a
const rnd  = n => Math.floor(rng() * n)
const chance = p => rng() < p

function fillBase () {
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++)
      set(0, x, y, T.bogBase)
}

// ═══════════════════════════════════════════════════════════
// CLEARING SYSTEM — Digger carves open spaces through forest
// Floor cells = clearings + corridors, kept free of trees
// Rooms = meadows/campsites, corridors = narrow passages
// ═══════════════════════════════════════════════════════════
function buildClearings () {
  const digger = new ROTMap.Digger(MAP_W, MAP_H, {
    roomWidth:      [5, 12],
    roomHeight:     [4, 9],
    corridorLength: [1, 12],
    dugPercentage:  0.55,
  })

  digger.create((x, y, val) => {
    // val=0 = floor (open), val=1 = wall (forest)
    if (val === 0 && !isWater(x, y)) {
      clearingGrid[y][x] = true
    }
  })

  // Also mark a 1-cell buffer around rooms so forest doesn't crowd them
  for (const room of digger.getRooms()) {
    for (let y = room.getTop()-1; y <= room.getBottom()+1; y++)
      for (let x = room.getLeft()-1; x <= room.getRight()+1; x++)
        if (!isWater(x, y) && x >= 0 && y >= 0 && x < MAP_W && y < MAP_H)
          clearingGrid[y][x] = true
  }

  return digger.getRooms()
}

// ═══════════════════════════════════════════════════════════
// PATH SYSTEM
// ═══════════════════════════════════════════════════════════

// Simple A* — returns array of [x,y] or null if no path
function aStar (sx, sy, ex, ey) {
  const key = (x, y) => y * MAP_W + x
  const heur = (x, y) => Math.abs(x-ex) + Math.abs(y-ey)

  const open = new Map()
  const cameFrom = new Map()
  const gScore = new Map()

  const startKey = key(sx, sy)
  open.set(startKey, heur(sx, sy))
  gScore.set(startKey, 0)

  while (open.size > 0) {
    // Find lowest f in open
    let curKey = null, curF = Infinity
    for (const [k, f] of open) {
      if (f < curF) { curF = f; curKey = k }
    }
    open.delete(curKey)

    const cx = curKey % MAP_W
    const cy = Math.floor(curKey / MAP_W)

    if (cx === ex && cy === ey) {
      // Reconstruct path
      const path = []
      let k = curKey
      while (k !== undefined) {
        path.unshift([k % MAP_W, Math.floor(k / MAP_W)])
        k = cameFrom.get(k)
      }
      return path
    }

    const dirs = [[0,-1],[0,1],[-1,0],[1,0]]
    for (const [dx, dy] of dirs) {
      const nx = cx+dx, ny = cy+dy
      if (nx < 1 || ny < 1 || nx >= MAP_W-1 || ny >= MAP_H-1) continue
      const nk = key(nx, ny)
      // Cost: water cells cost more but are passable (stepping stones)
      const stepCost = isWater(nx, ny) ? 4 : 1
      const tentG = (gScore.get(curKey) ?? Infinity) + stepCost
      if (tentG < (gScore.get(nk) ?? Infinity)) {
        cameFrom.set(nk, curKey)
        gScore.set(nk, tentG)
        open.set(nk, tentG + heur(nx, ny))
      }
    }
  }
  return null  // no path found
}

// Mark a list of [x,y] cells as path and write initial fill tile
function stampPath (cells) {
  for (const [x, y] of cells) {
    pathGrid[y][x] = true
    // Stepping stone if water, otherwise plain dark fill for now
    // (autotile pass will replace with directional tiles)
    if (isWater(x, y)) {
      set(2, x, y, pick(T.path.stone))
    } else {
      set(2, x, y, T.path.fill[0])
    }
  }
}

// Autotile the path — replace fill tiles with directional ones
// based on which neighbours are also path
function autotilePath () {
  const p = (x, y) => isPath(x, y)
  const pt = T.path

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (!pathGrid[y][x]) continue
      if (isWater(x, y)) continue  // stepping stones stay as-is

      const n = p(x, y-1), s = p(x, y+1)
      const e = p(x+1, y), w = p(x-1, y)
      const count = (n?1:0)+(s?1:0)+(e?1:0)+(w?1:0)

      let gid

      if (count === 0) {
        gid = pick(pt.fill)
      } else if (count === 4) {
        gid = pt.T_E  // cross / 4-way
      } else if (count === 3) {
        if      (!n) gid = pt.T_N  // open north
        else if (!s) gid = pt.T_S  // open south
        else if (!e) gid = pt.T_W  // open west (east missing? — T open east)
        else         gid = pt.T_E  // open east
      } else if (count === 2) {
        if      (n && s)  gid = pt.NS
        else if (e && w)  gid = pt.EW
        else if (n && e)  gid = pt.NE
        else if (n && w)  gid = pt.NW
        else if (s && e)  gid = pt.SE
        else if (s && w)  gid = pt.SW
        else              gid = pick(pt.fill)
      } else {
        // count === 1 — end cap, direction = toward the one neighbour
        if      (n) gid = pt.cap_N
        else if (s) gid = pt.cap_S
        else if (e) gid = pt.cap_E
        else        gid = pt.cap_W
      }

      set(2, x, y, gid)
    }
  }
}

// Build the full path system:
// entry (N edge) → branch point → exit (S edge) + event location
function buildPaths () {
  // Entry: random point on north edge (row 1)
  const entryX = 3 + rnd(MAP_W - 6)
  const entryY = 1

  // Exit: random point on south edge (row MAP_H-2)
  const exitX = 3 + rnd(MAP_W - 6)
  const exitY = MAP_H - 2

  // Branch point: somewhere in the middle third of the map
  const branchX = 4 + rnd(MAP_W - 8)
  const branchY = Math.floor(MAP_H * 0.35) + rnd(Math.floor(MAP_H * 0.3))

  // Event location: random interior point, not too close to branch
  let eventX, eventY, attempts = 0
  do {
    eventX = 4 + rnd(MAP_W - 8)
    eventY = 4 + rnd(MAP_H - 8)
    attempts++
  } while (attempts < 50 && (
    Math.abs(eventX - branchX) + Math.abs(eventY - branchY) < 6
  ))

  // Route 1: entry → branch
  const path1 = aStar(entryX, entryY, branchX, branchY)
  // Route 2: branch → exit
  const path2 = aStar(branchX, branchY, exitX, exitY)
  // Route 3: branch → event
  const path3 = aStar(branchX, branchY, eventX, eventY)

  if (path1) stampPath(path1)
  if (path2) stampPath(path2)
  if (path3) stampPath(path3)

  // Place event marker on deco layer
  if (!isWater(eventX, eventY)) {
    set(5, eventX, eventY, T.event)
  }

  // Autotile all path cells
  autotilePath()
}

// ═══════════════════════════════════════════════════════════
// TREE FOREST (layer 5)
// Two passes:
// 1. Dense CA forest covering ~35% of mud tiles — impassable
//    forest blobs with autotiled edges
// 2. Sparse scatter of standalone 321 trees as gradient
//    between forest edge and open mud
// Forest shapes define the level space — clearings, dead ends,
// meadows are the gaps between forest blobs.
// ═══════════════════════════════════════════════════════════
function buildForest () {
  const tr = T.tree

  // ── Pass 1: Dense forest blobs via CA ──────────────────
  // High coverage seeds so blobs merge into large connected masses
  // Restricted to mud tiles only (not water, not path, not 733)
  const isMud = (x, y) => get(1, x, y) !== 0

  const cell = new ROTMap.Cellular(MAP_W, MAP_H, {
    born:    [4, 5, 6, 7, 8],
    survive: [3, 4, 5, 6, 7, 8],
  })
  cell.randomize(0)
  const map = cell._map
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++)
      map[x][y] = (isMud(x,y) && !isPath(x,y) && !isClearing(x,y) && rng() < 0.65) ? 1 : 0

  const treeGrid = Array.from({length:MAP_H}, () => new Array(MAP_W).fill(false))

  for (let i = 0; i < 5; i++)
    cell.create((x, y, val) => {
      if (x < 1 || y < 1 || x >= MAP_W-1 || y >= MAP_H-1) return
      if (!isMud(x,y) || isWater(x,y) || isPath(x,y) || isClearing(x,y)) return
      if (val) treeGrid[y][x] = true
    })

  // Remove forest from path-adjacent cells — keep paths clear
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++)
      if (treeGrid[y][x])
        for (const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]])
          if (isPath(x+dx, y+dy)) { treeGrid[y][x] = false; break }

  // Autotile forest edges
  const t = (x, y) => treeGrid[y]?.[x] ?? false
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (!treeGrid[y][x]) continue
      const n=t(x,y-1), s=t(x,y+1), e=t(x+1,y), w=t(x-1,y)
      const cardCount = (n?1:0)+(s?1:0)+(e?1:0)+(w?1:0)
      let gid

      if (cardCount === 4) {
        gid = tr.C  // fully interior
      }
      // Single open side — edge tile facing that direction
      else if (!n &&  s &&  e &&  w) gid = tr.N
      else if ( n && !s &&  e &&  w) gid = tr.S
      else if ( n &&  s && !e &&  w) gid = tr.E
      else if ( n &&  s &&  e && !w) gid = tr.W
      // Two open adjacent sides — corner
      else if (!n && !e &&  s &&  w) gid = tr.NE
      else if (!n && !w &&  s &&  e) gid = tr.NW
      else if (!s && !e &&  n &&  w) gid = tr.SE
      else if (!s && !w &&  n &&  e) gid = tr.SW
      // Thin or isolated — still a tree, use centre
      else gid = tr.C

      set(5, x, y, gid)
    }
  }

  // ── Cleanup: replace isolated 321 tiles with 209 ────────
  // 321 has hard edges so must always have a tree neighbour
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (get(5, x, y) !== tr.C) continue
      // Check all 8 neighbours for another tree tile
      let hasTreeNeighbour = false
      for (const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]]) {
        const g = get(5, x+dx, y+dy)
        if (g !== 0 && g !== 209) { hasTreeNeighbour = true; break }
      }
      if (!hasTreeNeighbour) set(5, x, y, 209)
    }
  }

  // ── Pass 2: Random foliage scatter on bare mud ───────────
  for (let y = 1; y < MAP_H-1; y++) {
    for (let x = 1; x < MAP_W-1; x++) {
      if (!isMud(x,y)) continue
      if (isWater(x,y) || isPath(x,y)) continue
      if (treeGrid[y][x]) continue
      if (get(5,x,y)) continue
      if (chance(0.12)) set(5, x, y, pick(T.foliage))
    }
  }
}

// ═══════════════════════════════════════════════════════════
// WATER EDGE AUTOTILER (layer 4)
// ═══════════════════════════════════════════════════════════
function buildWaterEdges () {
  const wg = (x, y) => waterGrid[y]?.[x] ?? false
  const we = T.waterEdge

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (!waterGrid[y][x]) continue
      if (isPath(x, y)) continue  // stepping stone — skip edge tile

      const n  = !wg(x,   y-1)
      const s  = !wg(x,   y+1)
      const e  = !wg(x+1, y  )
      const ww = !wg(x-1, y  )
      const landCount = (n?1:0)+(s?1:0)+(e?1:0)+(ww?1:0)

      if (landCount === 0) continue

      let gid
      if (landCount === 4) {
        gid = pick(we.island)
      } else if (landCount === 3) {
        if      (!n &&  s &&  e &&  ww) gid = we.NWE
        else if ( n && !s &&  e &&  ww) gid = we.SWN
        else if ( n &&  s &&  e && !ww) gid = we.NES
        else if ( n &&  s && !e &&  ww) gid = we.WNS
        else continue
      } else if (landCount === 2) {
        if      ( n &&  s)  gid = we.NS
        else if ( e &&  ww) gid = we.EW
        else if ( n &&  ww) gid = we.NW
        else if ( n &&  e)  gid = we.NE
        else if ( s &&  ww) gid = we.SW
        else if ( s &&  e)  gid = we.SE
        else continue
      } else {
        if      (n)  gid = we.N
        else if (s)  gid = we.S
        else if (e)  gid = we.E
        else if (ww) gid = we.W
        else continue
      }
      set(4, x, y, gid)
    }
  }
}

// ═══════════════════════════════════════════════════════════
// CELLULAR WATER
// ═══════════════════════════════════════════════════════════
function buildWaterCellular (numBodies, wetness) {
  const merged = Array.from({length:MAP_H}, () => new Array(MAP_W).fill(0))

  for (let b = 0; b < numBodies; b++) {
    const cx = Math.floor(MAP_W * 0.2 + rng() * MAP_W * 0.6)
    const cy = Math.floor(MAP_H * 0.2 + rng() * MAP_H * 0.6)
    const radius = Math.floor(4 + wetness * 12)

    const cell = new ROTMap.Cellular(MAP_W, MAP_H, {
      born: [5,6,7,8], survive: [4,5,6,7,8],
    })
    cell.randomize(0)
    const map = cell._map
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        const dist = Math.sqrt((x-cx)**2 + (y-cy)**2)
        if (dist < radius * 0.6)    map[x][y] = 1
        else if (dist < radius)     map[x][y] = rng() < 0.8 ? 1 : 0
      }
    for (let i = 0; i < 4; i++)
      cell.create((x, y, val) => {
        if (x < 2 || y < 2 || x >= MAP_W-2 || y >= MAP_H-2) return
        if (val) merged[y][x] = 1
      })
  }

  const eroded = Array.from({length:MAP_H}, (_, y) =>
    Array.from({length:MAP_W}, (_, x) => {
      if (!merged[y][x]) return false
      for (const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]])
        if (!merged[y+dy]?.[x+dx]) return false
      return true
    })
  )

  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++)
      if (eroded[y][x]) {
        waterGrid[y][x] = true
        set(3, x, y, (x+y) % 2 === 0 ? 1634 : 1688)
      }

  buildWaterEdges()
}

// ═══════════════════════════════════════════════════════════
// CELLULAR MUD
// ═══════════════════════════════════════════════════════════
function buildMudCellular (coverage) {
  const nearWater = (x, y) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (waterGrid[y+dy]?.[x+dx]) return true
    return false
  }

  const cell = new ROTMap.Cellular(MAP_W, MAP_H, {
    born: [4,5,6,7,8], survive: [3,4,5,6,7,8],
  })
  cell.randomize(0)
  const map = cell._map
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++)
      map[x][y] = (!nearWater(x,y) && rng() < coverage) ? 1 : 0

  const mudGrid = Array.from({length:MAP_H}, () => new Array(MAP_W).fill(false))
  for (let i = 0; i < 5; i++)
    cell.create((x, y, val) => {
      if (x < 1 || y < 1 || x >= MAP_W-1 || y >= MAP_H-1) return
      if (nearWater(x, y)) return
      if (val) mudGrid[y][x] = true
    })

  for (let pass = 0; pass < 2; pass++)
    for (let y = 1; y < MAP_H-1; y++)
      for (let x = 1; x < MAP_W-1; x++)
        if (mudGrid[y][x]) {
          const nb = (mudGrid[y-1][x]?1:0)+(mudGrid[y+1][x]?1:0)+
                     (mudGrid[y][x+1]?1:0)+(mudGrid[y][x-1]?1:0)
          if (nb <= 1) mudGrid[y][x] = false
        }

  const m = (x, y) => mudGrid[y]?.[x] ?? false
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (!mudGrid[y][x]) continue
      const n=m(x,y-1), s=m(x,y+1), e=m(x+1,y), w=m(x-1,y)
      const nw=m(x-1,y-1), ne=m(x+1,y-1), sw=m(x-1,y+1), se=m(x+1,y+1)
      const allCard = n&&s&&e&&w
      const cardCount = (n?1:0)+(s?1:0)+(e?1:0)+(w?1:0)
      let gid
      if (allCard && nw && ne && sw && se) gid = pick(T.mud.fill2)
      else if (allCard)       gid = T.mud.fill
      else if (cardCount >= 3) gid = T.mud.fill
      else if (!n&&!w&&s&&e)  gid = T.mud.NW
      else if (!n&&!e&&s&&w)  gid = T.mud.NE
      else if (!s&&!w&&n&&e)  gid = T.mud.SW
      else if (!s&&!e&&n&&w)  gid = T.mud.SE
      else if (!n&&s&&e&&w)   gid = T.mud.N
      else if (n&&!s&&e&&w)   gid = T.mud.S
      else if (n&&s&&e&&!w)   gid = T.mud.W
      else if (n&&s&&!e&&w)   gid = T.mud.E
      else if (n&&!s&&!e&&!w) gid = T.mud.N
      else if (!n&&s&&!e&&!w) gid = T.mud.S
      else if (!n&&!s&&e&&!w) gid = T.mud.E
      else if (!n&&!s&&!e&&w) gid = T.mud.W
      else gid = T.mud.fill
      set(1, x, y, gid)
    }
  }
}

// ═══════════════════════════════════════════════════════════
// WALL AUTOTILER (layer 5)
// ═══════════════════════════════════════════════════════════
function isWC (wm, x, y) {
  if (x<0||y<0||x>=MAP_W||y>=MAP_H) return false
  return wm[y][x] === 1
}
function autotileWalls (wallMap) {
  for (let y=0; y<MAP_H; y++) {
    for (let x=0; x<MAP_W; x++) {
      if (!wallMap[y][x]) continue
      const n=isWC(wallMap,x,y-1), s=isWC(wallMap,x,y+1)
      const e=isWC(wallMap,x+1,y), w=isWC(wallMap,x-1,y)
      let gid
      if      (n&&s&&e&&w) gid = T.wallH
      else if (n&&s&&e)    gid = T.wallV
      else if (n&&s&&w)    gid = T.wallV
      else if (n&&s)       gid = T.wallV
      else if (e&&w)       gid = T.wallH
      else if (s&&e)       gid = T.wallCornerTL
      else if (s&&w)       gid = T.wallCornerTR
      else if (n&&e)       gid = T.wallCornerBL
      else if (n&&w)       gid = T.wallCornerBR
      else if (n)          gid = T.wallVendN
      else if (s)          gid = T.wallVendS
      else if (e||w)       gid = T.wallH
      else                 gid = T.wallSingle
      set(5, x, y, gid)
    }
  }
}

// ═══════════════════════════════════════════════════════════
// ROT DIGGER
// ═══════════════════════════════════════════════════════════
function runDigger () {
  const floorMap = Array.from({length:MAP_H}, () => new Array(MAP_W).fill(0))
  const digger = new ROTMap.Digger(MAP_W, MAP_H, {
    roomWidth:[4,9], roomHeight:[3,7],
    corridorLength:[2,5], dugPercentage:0.3,
  })
  digger.create((x, y, val) => { floorMap[y][x] = val===0 ? 1 : 0 })
  return { floorMap, rooms: digger.getRooms() }
}
function buildWallMap (fm) {
  return Array.from({length:MAP_H}, (_,y) =>
    Array.from({length:MAP_W}, (_,x) => {
      if (fm[y][x]) return 0
      for (let dy=-1; dy<=1; dy++)
        for (let dx=-1; dx<=1; dx++)
          if (!(dx===0&&dy===0) && fm[y+dy]?.[x+dx]) return 1
      return 0
    })
  )
}

// ═══════════════════════════════════════════════════════════
// MAP TYPES
// ═══════════════════════════════════════════════════════════
function genWildBog (numPools, maxSize) {
  fillBase()
  const bodies  = 2 + Math.floor(numPools / 3)
  const wetness = 0.4 + (maxSize / 9) * 0.8
  buildWaterCellular(bodies, wetness)
  buildMudCellular(0.65)
  const rooms = buildClearings()  // carve clearings before forest
  buildPaths()                    // paths route through clearings
  buildForest()                   // forest fills remaining mud
}

function genAncientBog (numPools, maxSize) {
  fillBase()
  const bodies  = 1 + Math.floor(numPools / 5)
  const wetness = 0.2 + (maxSize / 9) * 0.5
  buildWaterCellular(bodies, wetness)
  buildMudCellular(0.60)
  buildPaths()
  // buildForest() — ancient bog trees added separately
  const wallMap = Array.from({length:MAP_H}, () => new Array(MAP_W).fill(0))
  for (let i=0; i<3+rnd(4); i++) {
    const wx=3+rnd(MAP_W-6), wy=3+rnd(MAP_H-6)
    const horiz=chance(0.5), len=2+rnd(6)
    for (let j=0; j<len; j++) {
      const tx=horiz?wx+j:wx, ty=horiz?wy:wy+j
      if (!isWater(tx,ty) && !get(5,tx,ty)) wallMap[ty][tx]=1
    }
  }
  autotileWalls(wallMap)
  for (let i=0; i<2; i++) {
    const x=3+rnd(MAP_W-6), y=3+rnd(MAP_H-6)
    if (!isWater(x,y) && !get(5,x,y))
      set(5, x, y, chance(0.5) ? T.statue : pick(T.well))
  }
}

function genOvergrownRuins (numPools, maxSize) {
  fillBase()
  buildWaterCellular(2, 0.3)
  buildMudCellular(0.50)
  buildPaths()
  const {floorMap, rooms} = runDigger()
  for (let y=0; y<MAP_H; y++)
    for (let x=0; x<MAP_W; x++)
      if (floorMap[y][x]) set(0, x, y, pick(T.templeFloor))
  autotileWalls(buildWallMap(floorMap))
  rooms.forEach(room => {
    room.getDoors().forEach(([dx,dy]) => {
      if (!isWater(dx,dy))
        set(5,dx,dy, chance(0.4)?T.doorBroken:chance(0.5)?T.doorOpen:T.portcullis)
    })
    const x1=room.getLeft(), y1=room.getTop()
    const x2=room.getRight(), y2=room.getBottom()
    if (!isWater(x1+1,y1+1)) set(5,x1+1,y1+1,pick(T.webs))
    if (chance(0.6)) {
      const px=x1+1+rnd(Math.max(1,x2-x1-1))
      const py=y1+1+rnd(Math.max(1,y2-y1-1))
      if (!get(5,px,py)&&!isWater(px,py))
        set(5,px,py,pick([T.barrel,T.chest,T.coffin,T.statue]))
    }
  })
}

function genFairyDungeon (numPools, maxSize) {
  fillBase()
  buildWaterCellular(2, 0.25)
  const {floorMap, rooms} = runDigger()
  for (let y=0; y<MAP_H; y++)
    for (let x=0; x<MAP_W; x++)
      if (floorMap[y][x]) set(0,x,y,pick(T.templeFloor))
  autotileWalls(buildWallMap(floorMap))
  buildMudCellular(0.30)
  buildPaths()
  rooms.forEach((room,i) => {
    room.getDoors().forEach(([dx,dy]) => {
      if (!isWater(dx,dy))
        set(5,dx,dy, chance(0.3)?T.doorIron:chance(0.5)?T.doorClosed:T.doorOpen)
    })
    const x1=room.getLeft(), y1=room.getTop()
    const x2=room.getRight(), y2=room.getBottom()
    const cx=Math.floor((x1+x2)/2), cy=Math.floor((y1+y2)/2)
    if (i===0) {
      set(5,cx,cy,T.stairsUp)
    } else if (i===rooms.length-1) {
      set(5,cx,cy-1,T.throne)
      set(5,cx,cy,T.doorPortal)
      set(5,cx,cy+1,T.stairsDown)
    } else {
      if (!isWater(x1+1,y1+1)) set(5,x1+1,y1+1,pick(T.webs))
      const px=x1+1+rnd(Math.max(1,x2-x1-1))
      const py=y1+1+rnd(Math.max(1,y2-y1-1))
      if (!get(5,px,py)&&!isWater(px,py))
        set(5,px,py,pick([T.chest,T.barrel,T.coffin,T.weaponRack,T.table,pick(T.book),T.statue]))
    }
  })
  for (let y=0; y<MAP_H; y++)
    for (let x=0; x<MAP_W; x++)
      if (isWater(x,y)&&chance(0.04)) set(5,x,y,T.lillipad)
}

// ═══════════════════════════════════════════════════════════
// GENERATE
// ═══════════════════════════════════════════════════════════
function generate () {
  const type     = +document.getElementById('itype').value
  const numPools = +document.getElementById('ipools').value
  const maxSize  = +document.getElementById('isize').value
  const seedInput = document.getElementById('iseed').value.trim()
  const seed = seedInput || Math.random().toString(36).slice(2,8)
  document.getElementById('iseed').value = seed
  rng = seedrandom(seed)
  initLayers()
  const t = performance.now()
  if      (type===0) genWildBog(numPools, maxSize)
  else if (type===1) genAncientBog(numPools, maxSize)
  else if (type===2) genOvergrownRuins(numPools, maxSize)
  else               genFairyDungeon(numPools, maxSize)
  setStatus(`seed:${seed} — ${Math.round(performance.now()-t)}ms`)
  drawMap()
}

// ═══════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════
const canvas = document.getElementById('c0')
const ctx = canvas.getContext('2d')
let zoom = 2, sheet = null

const img = new Image()
img.onload  = () => { sheet=img; setStatus('ready — click generate') }
img.onerror = () => setStatus('ERROR: tilesheet not found')
img.src = '/assets/oryx/oryx_16bit_fantasy_world_trans.png'

function drawTile (gid, x, y) {
  if (!gid||!sheet) return
  const li=gid-1, sc=li%SHEET_COLS, sr=Math.floor(li/SHEET_COLS)
  const tw=TW*zoom, th=TH*zoom
  ctx.drawImage(sheet, MG+sc*TW, MG+sr*TH, TW, TH, x*tw, y*th, tw, th)
}

function drawMap () {
  if (!L[0]||!sheet) return
  const tw=TW*zoom, th=TH*zoom
  canvas.width=MAP_W*tw; canvas.height=MAP_H*th
  canvas.style.width=canvas.width+'px'; canvas.style.height=canvas.height+'px'
  ctx.imageSmoothingEnabled=false
  for (let layer=0; layer<NUM_LAYERS; layer++)
    for (let y=0; y<MAP_H; y++)
      for (let x=0; x<MAP_W; x++)
        drawTile(L[layer][y][x], x, y)
}

function setStatus (m) { document.getElementById('status').textContent=m }

document.getElementById('ipools').addEventListener('input', e => {
  document.getElementById('lpools').textContent = e.target.value
})
document.getElementById('isize').addEventListener('input', e => {
  document.getElementById('lsize').textContent = e.target.value
})
document.getElementById('btn-gen').addEventListener('click', generate)
document.getElementById('btn-exp').addEventListener('click', () => {
  if (!L[0]) return
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify({
    seed: document.getElementById('iseed').value,
    type: +document.getElementById('itype').value,
    width: MAP_W, height: MAP_H, layers: L
  }, null, 2)], {type:'application/json'}))
  a.download = `bog_${document.getElementById('iseed').value}.json`
  a.click()
})
document.getElementById('zp').addEventListener('click', () => {
  zoom=Math.min(6,zoom+1)
  document.getElementById('zlabel').textContent=zoom+'x'
  drawMap()
})
document.getElementById('zm').addEventListener('click', () => {
  zoom=Math.max(1,zoom-1)
  document.getElementById('zlabel').textContent=zoom+'x'
  drawMap()
})


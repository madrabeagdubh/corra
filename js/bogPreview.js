import { Map as ROTMap } from 'rot-js'
import seedrandom from 'seedrandom'
import { createNoise2D } from 'simplex-noise'

const MAP_W = 40, MAP_H = 40
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
  water: [1634, 1688],
  // Water edge — tile sits ON the water cell
  // Name = which side(s) border land
  // Single cardinal: land to N → top of tile fades → N tile
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
}

// ═══════════════════════════════════════════════════════════
// LAYERS
// L[0] bogBase   — 733 everywhere
// L[1] mud       — mud patches, dithered edges into 733
// L[2] water     — water fill
// L[3] waterEdge — water edge autotile on boundary water cells
// L[4] deco      — walls, props, doors
// ═══════════════════════════════════════════════════════════
const NUM_LAYERS = 5
let L = []
let waterGrid = []

function initLayers () {
  L = []
  waterGrid = Array.from({length:MAP_H}, () => new Array(MAP_W).fill(false))
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
function isWater (x, y) {
  return waterGrid[y]?.[x] ?? false
}

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
// WATER EDGE AUTOTILER (layer 3)
// Only called after waterGrid is fully populated.
// Iterates every water cell, checks 4 cardinal land neighbours,
// picks the correct shore tile based on landCount + which sides.
// No diagonal tile logic — keeps it simple and correct.
// ═══════════════════════════════════════════════════════════
function buildWaterEdges () {
  const wg = (x, y) => waterGrid[y]?.[x] ?? false
  const we = T.waterEdge

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (!waterGrid[y][x]) continue

      // land = not water
      const n  = !wg(x,   y-1)
      const s  = !wg(x,   y+1)
      const e  = !wg(x+1, y  )
      const ww = !wg(x-1, y  )

      const landCount = (n?1:0) + (s?1:0) + (e?1:0) + (ww?1:0)

      // Interior water cell — no cardinal land neighbours, no edge tile needed
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
        // landCount === 1
        if      (n)  gid = we.N
        else if (s)  gid = we.S
        else if (e)  gid = we.E
        else if (ww) gid = we.W
        else continue
      }

      set(3, x, y, gid)
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
    const radius = Math.floor(3 + wetness * 8)

    const cell = new ROTMap.Cellular(MAP_W, MAP_H, {
      born:    [5, 6, 7, 8],
      survive: [4, 5, 6, 7, 8],
    })
    cell.randomize(0)
    const map = cell._map
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const dx = x - cx, dy = y - cy
        const dist = Math.sqrt(dx*dx + dy*dy)
        if (dist < radius * 0.6)  map[x][y] = 1
        else if (dist < radius)   map[x][y] = rng() < 0.7 ? 1 : 0
      }
    }
    for (let i = 0; i < 4; i++) {
      cell.create((x, y, val) => {
        if (x < 2 || y < 2 || x >= MAP_W-2 || y >= MAP_H-2) return
        if (val) merged[y][x] = 1
      })
    }
  }

  // Erode 1 cell — guarantees 733 ring around water for mud gap
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
        set(2, x, y, (x+y) % 2 === 0 ? 1634 : 1688)
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
    born:    [4, 5, 6, 7, 8],
    survive: [3, 4, 5, 6, 7, 8],
  })
  cell.randomize(0)
  const map = cell._map
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++)
      map[x][y] = (!nearWater(x,y) && rng() < coverage) ? 1 : 0

  const mudGrid = Array.from({length:MAP_H}, () => new Array(MAP_W).fill(false))
  for (let i = 0; i < 3; i++) {
    cell.create((x, y, val) => {
      if (x < 1 || y < 1 || x >= MAP_W-1 || y >= MAP_H-1) return
      if (nearWater(x, y)) return
      if (val) mudGrid[y][x] = true
    })
  }

  // Remove peninsula tips
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
      const allCard = n && s && e && w
      const cardCount = (n?1:0)+(s?1:0)+(e?1:0)+(w?1:0)
      let gid

      if (allCard && nw && ne && sw && se) gid = pick(T.mud.fill2)
      else if (allCard)      gid = T.mud.fill
      else if (cardCount>=3) gid = T.mud.fill
      else if (!n && !w && s && e)  gid = T.mud.NW
      else if (!n && !e && s && w)  gid = T.mud.NE
      else if (!s && !w && n && e)  gid = T.mud.SW
      else if (!s && !e && n && w)  gid = T.mud.SE
      else if (!n &&  s &&  e &&  w) gid = T.mud.N
      else if ( n && !s &&  e &&  w) gid = T.mud.S
      else if ( n &&  s &&  e && !w) gid = T.mud.W
      else if ( n &&  s && !e &&  w) gid = T.mud.E
      else if ( n && !s && !e && !w) gid = T.mud.N
      else if (!n &&  s && !e && !w) gid = T.mud.S
      else if (!n && !s &&  e && !w) gid = T.mud.E
      else if (!n && !s && !e &&  w) gid = T.mud.W
      else gid = T.mud.fill

      set(1, x, y, gid)
    }
  }
}

// ═══════════════════════════════════════════════════════════
// WALL AUTOTILER (layer 4)
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
      set(4, x, y, gid)
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
  const bodies  = 1 + Math.floor(numPools / 5)
  const wetness = 0.2 + (maxSize / 9) * 0.6
  buildWaterCellular(bodies, wetness)
  buildMudCellular(0.65)
}

function genAncientBog (numPools, maxSize) {
  fillBase()
  const bodies  = 1 + Math.floor(numPools / 5)
  const wetness = 0.2 + (maxSize / 9) * 0.5
  buildWaterCellular(bodies, wetness)
  buildMudCellular(0.60)
  const wallMap = Array.from({length:MAP_H}, () => new Array(MAP_W).fill(0))
  for (let i=0; i<3+rnd(4); i++) {
    const wx=3+rnd(MAP_W-6), wy=3+rnd(MAP_H-6)
    const horiz=chance(0.5), len=2+rnd(6)
    for (let j=0; j<len; j++) {
      const tx=horiz?wx+j:wx, ty=horiz?wy:wy+j
      if (!isWater(tx,ty) && !get(4,tx,ty)) wallMap[ty][tx]=1
    }
  }
  autotileWalls(wallMap)
  for (let i=0; i<2; i++) {
    const x=3+rnd(MAP_W-6), y=3+rnd(MAP_H-6)
    if (!isWater(x,y) && !get(4,x,y))
      set(4, x, y, chance(0.5) ? T.statue : pick(T.well))
  }
}

function genOvergrownRuins (numPools, maxSize) {
  fillBase()
  buildWaterCellular(2, 0.3)
  buildMudCellular(0.50)
  const {floorMap, rooms} = runDigger()
  for (let y=0; y<MAP_H; y++)
    for (let x=0; x<MAP_W; x++)
      if (floorMap[y][x]) set(0, x, y, pick(T.templeFloor))
  autotileWalls(buildWallMap(floorMap))
  rooms.forEach(room => {
    room.getDoors().forEach(([dx,dy]) => {
      if (!isWater(dx,dy))
        set(4,dx,dy, chance(0.4)?T.doorBroken:chance(0.5)?T.doorOpen:T.portcullis)
    })
    const x1=room.getLeft(), y1=room.getTop()
    const x2=room.getRight(), y2=room.getBottom()
    if (!isWater(x1+1,y1+1)) set(4,x1+1,y1+1,pick(T.webs))
    if (chance(0.6)) {
      const px=x1+1+rnd(Math.max(1,x2-x1-1))
      const py=y1+1+rnd(Math.max(1,y2-y1-1))
      if (!get(4,px,py)&&!isWater(px,py))
        set(4,px,py,pick([T.barrel,T.chest,T.coffin,T.statue]))
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
  rooms.forEach((room,i) => {
    room.getDoors().forEach(([dx,dy]) => {
      if (!isWater(dx,dy))
        set(4,dx,dy, chance(0.3)?T.doorIron:chance(0.5)?T.doorClosed:T.doorOpen)
    })
    const x1=room.getLeft(), y1=room.getTop()
    const x2=room.getRight(), y2=room.getBottom()
    const cx=Math.floor((x1+x2)/2), cy=Math.floor((y1+y2)/2)
    if (i===0) {
      set(4,cx,cy,T.stairsUp)
    } else if (i===rooms.length-1) {
      set(4,cx,cy-1,T.throne)
      set(4,cx,cy,T.doorPortal)
      set(4,cx,cy+1,T.stairsDown)
    } else {
      if (!isWater(x1+1,y1+1)) set(4,x1+1,y1+1,pick(T.webs))
      const px=x1+1+rnd(Math.max(1,x2-x1-1))
      const py=y1+1+rnd(Math.max(1,y2-y1-1))
      if (!get(4,px,py)&&!isWater(px,py))
        set(4,px,py,pick([T.chest,T.barrel,T.coffin,T.weaponRack,T.table,pick(T.book),T.statue]))
    }
  })
  for (let y=0; y<MAP_H; y++)
    for (let x=0; x<MAP_W; x++)
      if (isWater(x,y)&&chance(0.04)) set(4,x,y,T.lillipad)
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


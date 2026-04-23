// bog_islands_gen.mjs -- Bog Islands map generator
// Generates a bog map with islands -- raised drier ground amid deep bog,
// connected by narrow causeways (toghers). Maze-like but navigable.
//
// Usage:
//   node tools/map-editor/generators/bog_islands_gen.mjs v001

import { writeFileSync } from 'fs'
import { createNoise2D } from 'simplex-noise'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = resolve(__dirname, '../../../public/maps/bogMaps')

const CONFIG = {
  width: 48, height: 48,
  // Islands: raised dry ground
  islandCount:    8,
  islandMinR:     3,
  islandMaxR:     6,
  // Toghers -- 2 tiles wide, bridge over water
  causewayWidth:  2,
  // Noise for water fill between islands
  noiseScale:     0.25,
  waterThreshold: 0.45,
  exitWidth:      5,
  exitClearDepth: 4,
}

const WATER    = [1634, 1688]
const STEPPING = [1744, 1798]

// Bog water edge dither (inward frame, clockwise from SW corner)
const EDGE = {
  SW: 1580, W: 1526, NW: 1472,
  N:  1473,
  NE: 1474, E: 1528, SE: 1582,
  S:  1581,
}

// Ground tile -- single swampy brown bog tile
const BOG_BASE = 733

// Togher -- ancient raised wooden bog road
// Directional timber planks
const TOGHER = {
  NS:      [1317, 1318, 1319],  // north-south planks
  EW:      [1263, 1264, 1265],  // east-west planks
  cornerSW: 1322,
  cornerNW: 1323,
  cornerNE: 1268,
  cornerSE: 1269,
  square:  [1267, 1321],        // undirected square wooden tiles
}

const BOG_BLOCK = [217, 218, 219]
const BOG_BUSH  = [49, 50, 51, 53]
const PLANTS    = [215, 216, 213, 214]

const make2D   = (w,h,v=false) => Array.from({length:h}, () => new Array(w).fill(v))
const inBounds = (x,y,W,H) => x>=0 && x<W && y>=0 && y<H
const getW     = (g,x,y,W,H) => inBounds(x,y,W,H) ? g[y][x] : false
const dist2    = (ax,ay,bx,by) => (ax-bx)**2 + (ay-by)**2
const pick     = (arr,rng) => arr[Math.floor(rng() * arr.length)]
const bogTile  = () => BOG_BASE

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed>>>15, 1|seed)
    t = t + Math.imul(t ^ t>>>7, 61|t) ^ t
    return ((t ^ t>>>14) >>> 0) / 4294967296
  }
}

// Track causeway segments with their dominant direction for togher tile selection
function buildIslandsAndWater(W, H, cfg, rng) {
  const noise2D = createNoise2D()
  const island  = make2D(W, H, false)  // true = dry island ground
  const water   = make2D(W, H, false)
  const togherDir = make2D(W, H, null) // 'NS' | 'EW' | 'sq' per causeway cell

  // Place islands
  const islands = []
  let attempts = 0
  while (islands.length < cfg.islandCount && attempts < 200) {
    attempts++
    const r  = cfg.islandMinR + Math.floor(rng() * (cfg.islandMaxR - cfg.islandMinR + 1))
    const px = Math.floor(rng() * (W - r*2 - 4)) + r + 2
    const py = Math.floor(rng() * (H - r*2 - 4)) + r + 2
    if (islands.some(([ix,iy,ir]) => dist2(px,py,ix,iy) < (r+ir+3)**2)) continue
    islands.push([px, py, r])
    for (let dy=-r; dy<=r; dy++)
      for (let dx=-r; dx<=r; dx++)
        if (dx*dx + dy*dy <= r*r && inBounds(px+dx, py+dy, W, H))
          island[py+dy][px+dx] = true
  }

  // Water: bog fill everywhere that isn't island
  for (let y=0; y<H; y++)
    for (let x=0; x<W; x++) {
      if (island[y][x]) continue
      water[y][x] = true
    }

  // Helper: carve a clean L-shaped togher between two points (axis-aligned, no diagonals)
  function carveTogher(ax, ay, bx, by) {
    // Horizontal leg first, then vertical
    const xStep = bx > ax ? 1 : -1
    const yStep = by > ay ? 1 : -1
    // Horizontal run: ax,ay -> bx,ay
    for (let x = ax; x !== bx + xStep; x += xStep) {
      for (let off = 0; off < cfg.causewayWidth; off++) {
        if (inBounds(x, ay + off, W, H)) togherDir[ay + off][x] = 'EW'
      }
    }
    // Vertical run: bx,ay -> bx,by
    for (let y = ay; y !== by + yStep; y += yStep) {
      for (let off = 0; off < cfg.causewayWidth; off++) {
        if (inBounds(bx + off, y, W, H)) togherDir[y][bx + off] = 'NS'
      }
    }
  }

  // Toghers: full spanning tree -- every island connected
  const connected = new Set([0])
  while (connected.size < islands.length) {
    let bestI=-1, bestJ=-1, bestD=Infinity
    for (const i of connected) {
      for (let j=0; j<islands.length; j++) {
        if (connected.has(j)) continue
        const d = dist2(islands[i][0], islands[i][1], islands[j][0], islands[j][1])
        if (d < bestD) { bestD=d; bestI=i; bestJ=j }
      }
    }
    if (bestI < 0) break
    connected.add(bestJ)
    const [x1,y1] = islands[bestI]
    const [x2,y2] = islands[bestJ]
    carveTogher(x1, y1, x2, y2)
  }

  // Connect entry/exit edges to nearest island
  const midY = Math.floor(H/2), midX = Math.floor(W/2)
  const edgePoints = [[0,midY,'EW'], [W-1,midY,'EW'], [midX,0,'NS'], [midX,H-1,'NS']]
  edgePoints.forEach(([ex,ey,eDir]) => {
    const nearest = islands.reduce((best,isl) => {
      const d = dist2(ex,ey,isl[0],isl[1])
      return d < best.d ? {d,isl} : best
    }, {d:Infinity, isl:null}).isl
    if (!nearest) return
    const [ix,iy] = nearest
    carveTogher(ex, ey, ix, iy)
  })

  return {island, water, islands, togherDir}
}

function buildBase(island, water, W, H) {
  return Array.from({length:H}, (_,y) =>
    Array.from({length:W}, (_,x) => bogTile(x,y))
  )
}

// Pick the right togher tile based on recorded direction
function togherTile(dir, rng) {
  if (dir === 'NS') return pick(TOGHER.NS, rng)
  if (dir === 'EW') return pick(TOGHER.EW, rng)
  return pick(TOGHER.square, rng)
}

function buildOverlay(island, water, togherDir, W, H, rng) {
  const layer = make2D(W, H, 0)

  // Bog water edge dither
  for (let y=0; y<H; y++) {
    for (let x=0; x<W; x++) {
      if (!water[y][x]) continue
      layer[y][x] = (x+y)%2===0 ? WATER[0] : WATER[1]
      const N  = !getW(water, x,   y-1, W, H)
      const S  = !getW(water, x,   y+1, W, H)
      const E  = !getW(water, x+1, y,   W, H)
      const Ww = !getW(water, x-1, y,   W, H)
      if (!N && !S && !E && !Ww) continue
      // Corners first
      if (S && Ww && !N && !E)  { layer[y][x] = EDGE.NW; continue }
      if (S && E  && !N && !Ww) { layer[y][x] = EDGE.NE; continue }
      if (N && Ww && !S && !E)  { layer[y][x] = EDGE.SW; continue }
      if (N && E  && !S && !Ww) { layer[y][x] = EDGE.SE; continue }
      // Edges
      if (S)       layer[y][x] = EDGE.N
      else if (N)  layer[y][x] = EDGE.S
      else if (E)  layer[y][x] = EDGE.W
      else         layer[y][x] = EDGE.E
    }
  }

  // Toghers -- wooden plank bridges drawn over water and ground alike
  for (let y=0; y<H; y++) {
    for (let x=0; x<W; x++) {
      if (!togherDir[y][x]) continue
      if (island[y][x]) continue  // inside island -- no planks needed
      layer[y][x] = togherTile(togherDir[y][x], rng)
    }
  }

  // Vegetation on islands
  for (let y=1; y<H-1; y++) {
    for (let x=1; x<W-1; x++) {
      if (water[y][x] || layer[y][x]) continue
      if (!island[y][x]) continue  // don't overwrite toghers
      const r = rng()
      if (r < 0.05)      layer[y][x] = pick(BOG_BUSH, rng)
      else if (r < 0.09) layer[y][x] = pick(PLANTS,   rng)
    }
  }

  return layer
}

function buildExitsAndClear(overlay, water, island, W, H, cfg) {
  const half = Math.floor(cfg.exitWidth / 2)
  const midY = Math.floor(H/2), midX = Math.floor(W/2)
  const exits = {}, entries = {}
  const D = cfg.exitClearDepth
  const edges = [
    {dir:'west',  cx:0,   cy:midY, dx:1,  dy:0},
    {dir:'east',  cx:W-1, cy:midY, dx:-1, dy:0},
    {dir:'north', cx:midX,cy:0,    dx:0,  dy:1},
    {dir:'south', cx:midX,cy:H-1,  dx:0,  dy:-1},
  ]
  edges.forEach(({dir,cx,cy,dx,dy}) => {
    for (let off=-half; off<=half; off++)
      for (let d=0; d<D; d++) {
        const x = cx + dx*d + (dy!==0 ? off : 0)
        const y = cy + dy*d + (dx!==0 ? off : 0)
        if (inBounds(x,y,W,H)) { overlay[y][x]=0; water[y][x]=false }
      }
    const tiles = dir==='west' || dir==='east'
      ? Array.from({length:cfg.exitWidth}, (_,i) => [cx, cy-half+i])
      : Array.from({length:cfg.exitWidth}, (_,i) => [cx-half+i, cy])
    const destMap = {west:'Bog_West', east:'Bog_East', north:'Bog_North', south:'Bog_South'}
    const epMap   = {west:'east', east:'west', north:'south', south:'north'}
    exits[dir] = {tiles, destination:destMap[dir], entryPoint:epMap[dir]}
    if (dir==='west' || dir==='east')
      entries[dir] = {x: dir==='west' ? D : W-1-D, yFromSource:true,  y:cy}
    else
      entries[dir] = {x: cx, yFromSource:false, y: dir==='north' ? D : H-1-D}
  })
  return {exits, entries}
}

function generate(outputName) {
  const cfg = {...CONFIG}
  const {width:W, height:H} = cfg
  const seedVal = outputName.split('').reduce((a,c) => a + c.charCodeAt(0), 0) * 2654435761
  const rng = mulberry32(seedVal)

  console.log(`\nGenerating ${W}x${H} bog islands: "${outputName}"`)

  const {island, water, togherDir} = buildIslandsAndWater(W, H, cfg, rng)
  const base    = buildBase(island, water, W, H)
  const overlay = buildOverlay(island, water, togherDir, W, H, rng)
  const {exits, entries} = buildExitsAndClear(overlay, water, island, W, H, cfg)

  const map = {
    name: outputName, width: W, height: H,
    layers: [base, overlay],
    legend: {
      '733':'bog ground',
      '1634':'bog water 1', '1688':'bog water 2',
      '1472':'water edge NW', '1473':'water edge N', '1474':'water edge NE',
      '1526':'water edge W',  '1528':'water edge E',
      '1580':'water edge SW', '1581':'water edge S', '1582':'water edge SE',
      '1317':'togher NS A', '1318':'togher NS B', '1319':'togher NS C',
      '1263':'togher EW A', '1264':'togher EW B', '1265':'togher EW C',
      '1322':'togher corner SW', '1323':'togher corner NW',
      '1268':'togher corner NE', '1269':'togher corner SE',
      '1267':'togher square A', '1321':'togher square B',
      '1744':'stepping stone A', '1798':'stepping stone B',
      '217':'bog block', '218':'bog block cracked', '219':'bog block very cracked',
      '49':'large bog bush', '50':'medium bog bush', '51':'bog bush pair', '53':'small bog bush',
      '213':'green plants', '214':'green plant', '215':'brown plants', '216':'brown plant',
      '0':'empty'
    },
    spawns: {player: {x: W - cfg.exitClearDepth, y: Math.floor(H/2)}},
    exits,
    entries,
  }

  writeFileSync(resolve(OUTPUT_DIR, `${outputName}.json`), JSON.stringify(map))
  console.log(`Written: public/maps/bogMaps/${outputName}.json`)
  console.log(`View at: http://localhost:5173/tools/map-editor/viewer.html?map=${outputName}`)

  const step = 2
  console.log('\nASCII  ~ water  I island  = togher\n')
  for (let y=0; y<H; y+=step) {
    let row = ''
    for (let x=0; x<W; x+=step)
      row += water[y][x] ? '~' : island[y][x] ? 'I' : togherDir[y][x] ? '=' : '.'
    console.log(row)
  }
}

const outputName = process.argv[2] || 'bog_islands_default'
generate(outputName)


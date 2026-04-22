// bog_forest_transition_gen.mjs
// 48x48 transition zone between woodland and bog.
// Trees thin west-to-east, bog encroaches, withered trees replace oak,
// ground shifts from grass to mud to bog tile.
//
// Usage:
//   node tools/map-editor/generators/bog_forest_transition_gen.mjs v001
//
// View at: http://localhost:5173/tools/map-editor/viewer.html?map=v001

import { writeFileSync } from 'fs'
import { createNoise2D } from 'simplex-noise'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = resolve(__dirname, '../../../public/maps/bogMaps')

// ── CONFIG ───────────────────────────────────────────────────────────────────

const CONFIG = {
  width:  48,
  height: 48,

  // Forest CA
  initialDensity:   0.52,
  smoothPasses:     3,
  birthThreshold:   5,
  surviveThreshold: 3,

  // Transition gradient -- forest density falls off east-to-west
  // At x=0 (east/forest side) density is full
  // At x=W-1 (west/bog side) density approaches 0
  transitionStart: 0.3,   // fraction of width where thinning begins
  transitionEnd:   0.85,  // fraction of width where forest is nearly gone

  // Bog water pools -- dense and large, tough going
  poolCount:    10,
  poolMinR:     3,
  poolMaxR:     7,

  // Noise scales
  forestNoise: 0.32,
  bogNoise:    0.28,

  // Exit width
  exitWidth: 5,
  exitClearDepth: 4,
}

// ── TILE IDS ─────────────────────────────────────────────────────────────────

const OAK      = { TL:260,TC:261,TR:262,ML:314,MC:315,MR:316,BL:368,BC:369,BR:370 }
const WITHERED = { TL:266,TC:267,TR:268,ML:320,MC:321,MR:322,BL:374,BC:375,BR:376 }
const BOG_TREE = { TL:263,TC:264,TR:265,ML:317,MC:318,MR:319,BL:371,BC:372,BR:373 }

// Blue water (east/forest pools)
const BLUE_WATER = [1625, 1679]
const BLUE_EDGE  = { NW:1571,N:1464,NE:1573, W:1517,E:1519, SW:1463,S:1572,SE:1465 }
const BLUE_STEP  = [1735, 1789]

// Brown bog water (west/bog pools)
const BOG_WATER  = [1634, 1688]
const BOG_EDGE   = { NW:1472,N:1473,NE:1474, W:1526,E:1528, SW:1580,S:1581,SE:1582 }
const BOG_STEP   = [1744, 1798]

// Ground tiles -- gradient east(forest) to west(bog)
// 731=mixed forest-green, 732=darker transition, 733=bog grass
const GROUND_E   = [731, 731]   // east -- forest waterside green
const GROUND_M   = [732, 732]   // middle -- dark transition
const GROUND_W   = [733, 733]   // west -- bog grass

const BOG_BUSH  = [49, 50, 51, 53]
const GREEN_BUSH = [44, 45, 48]
const FLOWERS    = [98, 100, 213, 214, 215, 216]
const PINE       = 211
const SINGLE_BOG = 208
const WITHERED_S = 209

// ── HELPERS ──────────────────────────────────────────────────────────────────

const make2D   = (w,h,v=false) => Array.from({length:h},()=>new Array(w).fill(v))
const inBounds = (x,y,W,H)    => x>=0&&x<W&&y>=0&&y<H
const getF     = (g,x,y,W,H)  => inBounds(x,y,W,H)?g[y][x]:true
const getW     = (g,x,y,W,H)  => inBounds(x,y,W,H)?g[y][x]:false

function mulberry32(seed) {
  return ()=>{
    seed|=0;seed=seed+0x6D2B79F5|0
    let t=Math.imul(seed^seed>>>15,1|seed)
    t=t+Math.imul(t^t>>>7,61|t)^t
    return((t^t>>>14)>>>0)/4294967296
  }
}

// ── GROUND BASE ───────────────────────────────────────────────────────────────
// Gradient east→west: 731 (forest green) → 732 (dark) → 733 (bog grass)
// Boundaries wander with noise and dither between types at edges.
// Water fill: blue east of midpoint, brown west.

function buildBase(water, W, H) {
  const noise2D = createNoise2D()
  return Array.from({length:H},(_,y)=>
    Array.from({length:W},(_,x)=>{
      const t = x / (W-1)  // 0=west(bog), 1=east(forest)
      if (water[y][x]) {
        return (x+y)%2===0?BOG_WATER[0]:BOG_WATER[1]
      }
      // Warp: low-frequency noise shifts the boundary lines north-south
      const warp   = (noise2D(x * 0.06, y * 0.05) + 1) / 2
      const tWarped = t + (warp - 0.5) * 0.35  // +/- 17% warp

      // Dither: fine noise blends tile types across a wide fuzzy band
      const dither  = (noise2D(x * 0.25, y * 0.25) + 1) / 2
      const dither2 = (noise2D(x * 0.5 + 7, y * 0.5 + 3) + 1) / 2

      // Wide dither bands -- 15% of map width at each boundary
      // East zone: 731
      if (tWarped > 0.70) return GROUND_E[0]
      // E↔M blend zone (0.55 - 0.70)
      if (tWarped > 0.55) {
        const blend = (tWarped - 0.55) / 0.15  // 0=all M, 1=all E
        return (dither < blend && dither2 < blend + 0.1) ? GROUND_E[0] : GROUND_M[0]
      }
      // Middle zone: 732
      if (tWarped > 0.40) return GROUND_M[0]
      // M↔W blend zone (0.25 - 0.40)
      if (tWarped > 0.25) {
        const blend = (tWarped - 0.25) / 0.15  // 0=all W, 1=all M
        return (dither < blend && dither2 < blend + 0.1) ? GROUND_M[0] : GROUND_W[0]
      }
      // West zone: 733
      return GROUND_W[0]
    })
  )
}

// ── FOREST GRID ───────────────────────────────────────────────────────────────
// Density falls off west. East side is dense forest, west is open bog.

function buildForest(water, W, H, cfg, rng) {
  const noise2D = createNoise2D()
  const grid    = make2D(W, H, false)

  for (let y=0;y<H;y++) {
    for (let x=0;x<W;x++) {
      if (water[y][x]) continue
      const t = x / (W-1)  // 0=west, 1=east
      // Density modifier -- full east, fades west
      const tStart = cfg.transitionStart
      const tEnd   = cfg.transitionEnd
      let densityMod
      if (t >= tEnd)       densityMod = 1.0
      else if (t <= tStart) densityMod = 0.0
      else densityMod = (t - tStart) / (tEnd - tStart)

      const n = (noise2D(x*cfg.forestNoise, y*cfg.forestNoise)+1)/2
      grid[y][x] = n < (cfg.initialDensity * densityMod)
    }
  }
  return grid
}

function smoothForest(grid, water, W, H, cfg) {
  const next = make2D(W,H,false)
  for (let y=0;y<H;y++) {
    for (let x=0;x<W;x++) {
      if (water[y][x]) continue
      let n=0
      for (let dy=-1;dy<=1;dy++)
        for (let dx=-1;dx<=1;dx++)
          if (!(dx===0&&dy===0)&&getF(grid,x+dx,y+dy,W,H)) n++
      next[y][x]=grid[y][x]?n>=cfg.surviveThreshold:n>=cfg.birthThreshold
    }
  }
  return next
}

// ── BOG POOLS ─────────────────────────────────────────────────────────────────
// Pools are larger and more common toward the west

function buildWater(W, H, cfg, rng) {
  const water = make2D(W,H,false)
  for (let p=0;p<cfg.poolCount;p++) {
    // Bias pool position toward west
    const px = Math.floor(rng() * W * 0.6)
    const py = Math.floor(rng() * (H-8)) + 4
    // Larger pools further west
    const westFactor = 1 - (px/(W*0.6))
    const r = cfg.poolMinR + Math.floor(rng()*(cfg.poolMaxR-cfg.poolMinR)*westFactor+1)
    for (let dy=-r;dy<=r;dy++)
      for (let dx=-r;dx<=r;dx++)
        if (dx*dx+dy*dy<=r*r && inBounds(px+dx,py+dy,W,H))
          water[py+dy][px+dx]=true
  }
  return water
}

// ── TREE TYPE MAP ─────────────────────────────────────────────────────────────
// East side: oak. Middle: bog tree. West edge of forest: withered.

function buildTreeTypeMap(forest, W, H) {
  const typeMap = make2D(W,H,0)
  const visited = make2D(W,H,false)

  for (let sy=0;sy<H;sy++) {
    for (let sx=0;sx<W;sx++) {
      if (!forest[sy][sx]||visited[sy][sx]) continue
      const stack=[[sx,sy]], region=[]
      while (stack.length) {
        const [x,y]=stack.pop()
        if (!inBounds(x,y,W,H)||visited[y][x]||!forest[y][x]) continue
        visited[y][x]=true; region.push([x,y])
        stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1])
      }
      const avgX = region.reduce((a,[x])=>a+x,0)/region.length
      const t    = avgX/(W-1)
      // East: oak (0), middle: bog tree (1), west edge: withered (2)
      const type = t>0.6?0:t>0.35?1:2
      region.forEach(([x,y])=>{typeMap[y][x]=type})
    }
  }
  return typeMap
}

// ── TILE PLACEMENT ────────────────────────────────────────────────────────────

function buildOverlay(forest, water, W, H) {
  const layer   = make2D(W,H,0)
  const typeMap = buildTreeTypeMap(forest,W,H)

  for (let y=0;y<H;y++) {
    for (let x=0;x<W;x++) {
      if (!forest[y][x]) continue
      const N =getF(forest,x,y-1,W,H), S=getF(forest,x,y+1,W,H)
      const E =getF(forest,x+1,y,W,H), Ww=getF(forest,x-1,y,W,H)
      const interior=N&&S&&E&&Ww
      const stamp=typeMap[y][x]===2?WITHERED:typeMap[y][x]===1?BOG_TREE:OAK
      if (interior){layer[y][x]=stamp.MC;continue}
      if (!N&&!Ww){layer[y][x]=stamp.TL;continue}
      if (!N&&!E) {layer[y][x]=stamp.TR;continue}
      if (!S&&!Ww){layer[y][x]=stamp.BL;continue}
      if (!S&&!E) {layer[y][x]=stamp.BR;continue}
      if (!N)     {layer[y][x]=stamp.TC;continue}
      if (!S)     {layer[y][x]=stamp.BC;continue}
      if (!Ww)    {layer[y][x]=stamp.ML;continue}
      if (!E)     {layer[y][x]=stamp.MR;continue}
      layer[y][x]=stamp.MC
    }
  }

  // Water edge dither -- blue east of midpoint, brown west
  for (let y=0;y<H;y++) {
    for (let x=0;x<W;x++) {
      if (!water[y][x]) continue
      const FILL = BOG_WATER
      const EDGE = BOG_EDGE
      layer[y][x]=(x+y)%2===0?FILL[0]:FILL[1]
      const N=!getW(water,x,y-1,W,H),S=!getW(water,x,y+1,W,H)
      const E=!getW(water,x+1,y,W,H),Ww=!getW(water,x-1,y,W,H)
      if (!N&&!S&&!E&&!Ww) continue
      if (S&&Ww&&!N&&!E)   {layer[y][x]=EDGE.SW;continue}
      if (S&&E &&!N&&!Ww)  {layer[y][x]=EDGE.SE;continue}
      if (N&&Ww&&!S&&!E)   {layer[y][x]=EDGE.NW;continue}
      if (N&&E &&!S&&!Ww)  {layer[y][x]=EDGE.NE;continue}
      if (S&&!N&&!E&&!Ww)  {layer[y][x]=EDGE.S; continue}
      if (N&&!S&&!E&&!Ww)  {layer[y][x]=EDGE.N; continue}
      if (E&&!N&&!S&&!Ww)  {layer[y][x]=EDGE.E; continue}
      if (Ww&&!N&&!S&&!E)  {layer[y][x]=EDGE.W; continue}
      if (S) layer[y][x]=EDGE.S
      else if (N) layer[y][x]=EDGE.N
      else if (E) layer[y][x]=EDGE.E
      else layer[y][x]=EDGE.W
    }
  }
  return layer
}

// ── BOG TREE BLOBS ────────────────────────────────────────────────────────────
// Small irregular clusters of bog trees in the western corners.
// Uses CA-style blob growth from a seed point.

function placeBogTreeBlobs(forest, overlay, water, W, H, rng) {
  const blobCount  = 4
  const blobMinR   = 2
  const blobMaxR   = 4

  for (let b = 0; b < blobCount; b++) {
    // Bias x toward west quarter, y toward north or south corners
    const px = Math.floor(rng() * W * 0.28) + 1
    const northOrSouth = rng() > 0.5
    const py = northOrSouth
      ? Math.floor(rng() * H * 0.3) + 1          // north
      : Math.floor(rng() * H * 0.3) + Math.floor(H * 0.65)  // south

    const r = blobMinR + Math.floor(rng() * (blobMaxR - blobMinR + 1))

    // Seed a small boolean blob with noise-jittered radius
    const blob = []
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const dist = Math.sqrt(dx*dx + dy*dy)
        const jitter = rng() * 1.2  // irregular edges
        if (dist < r - jitter) {
          const bx = px + dx, by = py + dy
          if (bx >= 1 && bx < W-1 && by >= 1 && by < H-1 &&
              !water[by][bx] && !forest[by][bx]) {
            blob.push([bx, by])
          }
        }
      }
    }

    // Mark blob cells as forest temporarily so edge detection works
    blob.forEach(([x,y]) => { forest[y][x] = true })

    // Place bog tree tiles based on neighbours
    blob.forEach(([x,y]) => {
      const N  = (y > 0   && forest[y-1][x])
      const S  = (y < H-1 && forest[y+1][x])
      const E  = (x < W-1 && forest[y][x+1])
      const Ww = (x > 0   && forest[y][x-1])
      const interior = N && S && E && Ww
      if (interior)       { overlay[y][x] = 318; return }  // BOG MC
      if (!N && !Ww)      { overlay[y][x] = 263; return }  // TL
      if (!N && !E)       { overlay[y][x] = 265; return }  // TR
      if (!S && !Ww)      { overlay[y][x] = 371; return }  // BL
      if (!S && !E)       { overlay[y][x] = 373; return }  // BR
      if (!N)             { overlay[y][x] = 264; return }  // TC
      if (!S)             { overlay[y][x] = 372; return }  // BC
      if (!Ww)            { overlay[y][x] = 317; return }  // ML
      if (!E)             { overlay[y][x] = 319; return }  // MR
      overlay[y][x] = 318  // MC fallback
    })
  }
}

// ── VEGETATION SCATTER ────────────────────────────────────────────────────────

function scatterVeg(overlay, forest, water, W, H, rng) {
  const noise2D = createNoise2D()
  for (let y=0;y<H;y++) {
    for (let x=0;x<W;x++) {
      if (overlay[y][x]||forest[y][x]||water[y][x]) continue
      const t = x/(W-1)  // 0=west/bog, 1=east/forest
      const r = rng()
      const fn= (noise2D(x*0.3,y*0.3)+1)/2

      if (r<0.025) {
        // Lone tree -- withered west, pine/bog east
        overlay[y][x]=t<0.4?WITHERED_S:t<0.65?SINGLE_BOG:PINE
      } else if (r<0.14) {
        // Bushes -- bog bushes west, green east, denser overall
        const bush=t<0.5
          ?BOG_BUSH[Math.floor(rng()*BOG_BUSH.length)]
          :GREEN_BUSH[Math.floor(rng()*GREEN_BUSH.length)]
        overlay[y][x]=bush
      } else if (r<0.20&&t<0.5) {
        // Bog blocks in western half -- makes it tough to navigate
        overlay[y][x]=[217,218,219][Math.floor(rng()*3)]
      } else if (r<0.13&&t>0.4) {
        overlay[y][x]=FLOWERS[Math.floor(rng()*FLOWERS.length)]
      }
    }
  }
}

// ── PERIMETER + EXITS ─────────────────────────────────────────────────────────

function enforcePerimeter(forest, water, W, H, cfg) {
  for (let x=0;x<W;x++){forest[0][x]=true;forest[H-1][x]=true}
  for (let y=0;y<H;y++){forest[y][0]=true;forest[y][W-1]=true}
  const half=Math.floor(cfg.exitWidth/2)
  const midY=Math.floor(H/2)
  const midX=Math.floor(W/2)
  // East exit (forest side) and west exit (bog side) always open
  for (let dy=-half;dy<=half;dy++){
    forest[midY+dy][0]=false
    forest[midY+dy][W-1]=false
  }
  // North/south exits -- open if not blocked by water
  for (let dx=-half;dx<=half;dx++){
    if (!water[0][midX+dx])   forest[0][midX+dx]=false
    if (!water[H-1][midX+dx]) forest[H-1][midX+dx]=false
  }
}

function clearEntryZones(forest, water, W, H, cfg) {
  const midY=Math.floor(H/2), D=cfg.exitClearDepth, half=Math.floor(cfg.exitWidth/2)
  for (let dy=-half-1;dy<=half+1;dy++){
    const y=midY+dy
    if (!inBounds(0,y,W,H)) continue
    for (let x=0;x<D;x++)   forest[y][x]=false
    for (let x=W-D;x<W;x++) forest[y][x]=false
  }
}

function buildExits(forest, water, W, H, cfg) {
  const half=Math.floor(cfg.exitWidth/2)
  const midY=Math.floor(H/2), midX=Math.floor(W/2)
  const exits={}, entries={}

  // West = bog side, East = forest side
  exits.west={tiles:Array.from({length:cfg.exitWidth},(_,i)=>[0,midY-half+i]),destination:'Open_Bog',entryPoint:'east'}
  entries.west={x:cfg.exitClearDepth,yFromSource:true,y:midY}
  exits.east={tiles:Array.from({length:cfg.exitWidth},(_,i)=>[W-1,midY-half+i]),destination:'Oak_Wood',entryPoint:'west'}
  entries.east={x:W-cfg.exitClearDepth,yFromSource:true,y:midY}

  // North/south if not blocked
  if (!forest[0][midX]) {
    exits.north={tiles:Array.from({length:cfg.exitWidth},(_,i)=>[midX-half+i,0]),destination:'Forest_North',entryPoint:'south'}
    entries.north={x:midX,yFromSource:false,y:cfg.exitClearDepth}
  }
  if (!forest[H-1][midX]) {
    exits.south={tiles:Array.from({length:cfg.exitWidth},(_,i)=>[midX-half+i,H-1]),destination:'Forest_South',entryPoint:'north'}
    entries.south={x:midX,yFromSource:false,y:H-cfg.exitClearDepth}
  }
  return {exits,entries}
}

// ── ISOLATION CLEANUP ─────────────────────────────────────────────────────────

function removeIsolated(forest, W, H) {
  for (let y=1;y<H-1;y++) {
    for (let x=1;x<W-1;x++) {
      if (!forest[y][x]) continue
      let n=0
      for (let dy=-1;dy<=1;dy++)
        for (let dx=-1;dx<=1;dx++)
          if (!(dx===0&&dy===0)&&getF(forest,x+dx,y+dy,W,H)) n++
      if (n<2) forest[y][x]=false
    }
  }
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

function generate(outputName) {
  const cfg={...CONFIG}
  const {width:W,height:H}=cfg
  const seedVal=outputName.split('').reduce((a,c)=>a+c.charCodeAt(0),0)*2654435761
  const rng=mulberry32(seedVal)

  console.log(`\nGenerating ${W}x${H} bog-forest transition: "${outputName}"`)

  const water  = buildWater(W,H,cfg,rng)
  let   forest = buildForest(water,W,H,cfg,rng)
  for (let i=0;i<cfg.smoothPasses;i++) forest=smoothForest(forest,water,W,H,cfg)
  removeIsolated(forest,W,H)
  enforcePerimeter(forest,water,W,H,cfg)
  clearEntryZones(forest,water,W,H,cfg)

  const base    = buildBase(water,W,H)
  const overlay = buildOverlay(forest,water,W,H)
  scatterVeg(overlay,forest,water,W,H,rng)
  placeBogTreeBlobs(forest,overlay,water,W,H,rng)

  const {exits,entries}=buildExits(forest,water,W,H,cfg)

  const map={
    name:outputName,width:W,height:H,
    layers:[base,overlay],
    legend:{
      '731':'forest green ground','732':'dark transition ground','733':'bog grass ground',
      '1625':'blue water 1','1679':'blue water 2',
      '1634':'bog water 1','1688':'bog water 2',
      '1464':'blue water N','1572':'blue water S','1517':'blue water W','1519':'blue water E',
      '1571':'blue water SW','1573':'blue water SE','1463':'blue water NW','1465':'blue water NE',
      '1473':'bog water N','1581':'bog water S','1526':'bog water W','1528':'bog water E',
      '1472':'bog water NW','1474':'bog water NE','1580':'bog water SW','1582':'bog water SE',
      '260':'oak TL','261':'oak TC','262':'oak TR',
      '314':'oak ML','315':'oak MC','316':'oak MR',
      '368':'oak BL','369':'oak BC','370':'oak BR',
      '263':'bog tree TL','264':'bog tree TC','265':'bog tree TR',
      '317':'bog tree ML','318':'bog tree MC','319':'bog tree MR',
      '371':'bog tree BL','372':'bog tree BC','373':'bog tree BR',
      '266':'withered TL','267':'withered TC','268':'withered TR',
      '320':'withered ML','321':'withered MC','322':'withered MR',
      '374':'withered BL','375':'withered BC','376':'withered BR',
      '49':'large bog bush','50':'medium bog bush','51':'bog bush pair','53':'small bog bush',
      '44':'large bush','45':'medium bush','48':'small bush',
      '98':'flowers','100':'flower','208':'bog tree single','209':'withered single','211':'pine',
      '0':'empty'
    },
    spawns:{player:{x:W-cfg.exitClearDepth,y:Math.floor(H/2)}},
    exits,entries
  }

  writeFileSync(resolve(OUTPUT_DIR,`${outputName}.json`),JSON.stringify(map))
  console.log(`Written: public/maps/bogMaps/${outputName}.json`)
  console.log(`View at: http://localhost:5173/tools/map-editor/viewer.html?map=${outputName}`)

  const step=2
  console.log('\nASCII (every 2nd)  # tree  ~ water  . open  [west=bog  east=forest]\n')
  for (let y=0;y<H;y+=step){
    let row=''
    for (let x=0;x<W;x+=step)
      row+=forest[y][x]?'#':water[y][x]?'~':'.'
    console.log(row)
  }
}

const outputName=process.argv[2]||'transition_default'
generate(outputName)


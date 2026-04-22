// flooded_bog_gen.mjs
// 48x48 flooded bog -- mostly water, small mud islands, stepping stones,
// reed beds at edges, few dry areas. Dangerous and beautiful.
//
// Usage:
//   node tools/map-editor/generators/flooded_bog_gen.mjs v001

import { writeFileSync } from 'fs'
import { createNoise2D } from 'simplex-noise'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = resolve(__dirname, '../../../public/maps/bogMaps')

const CONFIG = {
  width: 48, height: 48,
  // Most of map is water -- only high noise areas are dry
  dryThreshold:   0.72,  // higher = less dry land
  noiseScale:     0.28,
  // Stepping stone paths connecting dry areas to exits
  stonePathCount: 3,
  exitWidth:      5,
  exitClearDepth: 4,
}

const WATER    = [1634, 1688]
const EDGE     = { NW:1571,N:1464,NE:1573, W:1517,E:1519, SW:1463,S:1572,SE:1465 }
const BOG_BASE = [733, 732]
const MUD      = [1379, 1380]
const STEPPING = [1735, 1789]
const BOG_BUSH = [49, 50, 51, 53]
const REED     = [215, 216]   // brown plants as reeds
const LILLY    = [54]          // lillypads

const make2D   = (w,h,v=false)=>Array.from({length:h},()=>new Array(w).fill(v))
const inBounds = (x,y,W,H)=>x>=0&&x<W&&y>=0&&y<H
const getW     = (g,x,y,W,H)=>inBounds(x,y,W,H)?g[y][x]:false
const dist2    = (ax,ay,bx,by)=>(ax-bx)**2+(ay-by)**2

function mulberry32(seed) {
  return ()=>{
    seed|=0;seed=seed+0x6D2B79F5|0
    let t=Math.imul(seed^seed>>>15,1|seed)
    t=t+Math.imul(t^t>>>7,61|t)^t
    return((t^t>>>14)>>>0)/4294967296
  }
}

function buildWaterAndDry(W,H,cfg,rng) {
  const noise2D=createNoise2D()
  const water=make2D(W,H,true)  // start fully flooded
  const dry  =make2D(W,H,false)

  // Only high-noise areas are dry
  for (let y=0;y<H;y++)
    for (let x=0;x<W;x++) {
      const n=(noise2D(x*cfg.noiseScale,y*cfg.noiseScale)+1)/2
      if (n>cfg.dryThreshold) { water[y][x]=false; dry[y][x]=true }
    }

  // Ensure exit corridors are dry
  const midY=Math.floor(H/2), midX=Math.floor(W/2)
  const half=Math.floor(cfg.exitWidth/2)
  const D=cfg.exitClearDepth;
  [[0,midY,1,0],[W-1,midY,-1,0],[midX,0,0,1],[midX,H-1,0,-1]].forEach(([cx,cy,dx,dy])=>{
    for (let off=-half;off<=half;off++)
      for (let d=0;d<D;d++){
        const x=cx+dx*d+(dy!==0?off:0)
        const y=cy+dy*d+(dx!==0?off:0)
        if (inBounds(x,y,W,H)){water[y][x]=false;dry[y][x]=true}
      }
  })

  return {water,dry}
}

function buildSteppingPaths(water,dry,W,H,cfg,rng) {
  const paths=make2D(W,H,false)
  const midY=Math.floor(H/2), midX=Math.floor(W/2)

  // Find dry clusters to connect
  const dryCells=[]
  for (let y=0;y<H;y++)
    for (let x=0;x<W;x++)
      if (dry[y][x]) dryCells.push([x,y])

  if (!dryCells.length) return paths

  // Stepping stone paths from exits toward dry ground
  const exits=[[0,midY],[W-1,midY],[midX,0],[midX,H-1]]
  exits.forEach(([ex,ey])=>{
    // Find nearest dry cell
    let nearest=null, nearestD=Infinity
    dryCells.forEach(([dx,dy])=>{
      const d=dist2(ex,ey,dx,dy)
      if (d<nearestD){nearestD=d;nearest=[dx,dy]}
    })
    if (!nearest) return
    // Place stepping stones through water between exit and dry cell
    const [tx,ty]=nearest
    const steps=Math.max(Math.abs(tx-ex),Math.abs(ty-ey))
    for (let s=0;s<=steps;s++) {
      const sx=Math.round(ex+(tx-ex)*s/steps)
      const sy=Math.round(ey+(ty-ey)*s/steps)
      if (inBounds(sx,sy,W,H)&&water[sy][sx]) paths[sy][sx]=true
    }
  })

  return paths
}

function buildBase(water,dry,W,H) {
  return Array.from({length:H},(_,y)=>
    Array.from({length:W},(_,x)=>{
      if (water[y][x]) return (x+y)%2===0?WATER[0]:WATER[1]
      if (dry[y][x]) {
        // Near water -- mud edge on dry islands
        for (let dy=-1;dy<=1;dy++)
          for (let dx=-1;dx<=1;dx++)
            if (getW(water,x+dx,y+dy,W,H)) return (x+y)%2===0?MUD[0]:MUD[1]
        return (x+y)%2===0?BOG_BASE[0]:BOG_BASE[1]
      }
      return (x+y)%2===0?MUD[0]:MUD[1]
    })
  )
}

function buildOverlay(water,dry,paths,W,H,rng) {
  const layer=make2D(W,H,0)

  // Stepping stones
  for (let y=0;y<H;y++)
    for (let x=0;x<W;x++)
      if (paths[y][x]) layer[y][x]=(x+y)%2===0?STEPPING[0]:STEPPING[1]

  // Water edge dither (on top of stepping stones where they meet shore)
  for (let y=0;y<H;y++) {
    for (let x=0;x<W;x++) {
      if (!water[y][x]) continue
      if (!layer[y][x]) layer[y][x]=(x+y)%2===0?WATER[0]:WATER[1]
      const N=!getW(water,x,y-1,W,H),S=!getW(water,x,y+1,W,H)
      const E=!getW(water,x+1,y,W,H),Ww=!getW(water,x-1,y,W,H)
      if (!N&&!S&&!E&&!Ww) continue
      if (paths[y][x]) continue  // stepping stone -- don't overwrite
      if (S&&Ww&&!N&&!E)  {layer[y][x]=EDGE.NW;continue}
      if (S&&E &&!N&&!Ww) {layer[y][x]=EDGE.NE;continue}
      if (N&&Ww&&!S&&!E)  {layer[y][x]=EDGE.SW;continue}
      if (N&&E &&!S&&!Ww) {layer[y][x]=EDGE.SE;continue}
      if (S) layer[y][x]=EDGE.S
      else if (N) layer[y][x]=EDGE.N
      else if (E) layer[y][x]=EDGE.E
      else layer[y][x]=EDGE.W
    }
  }

  // Lillypads on open water
  for (let y=1;y<H-1;y++)
    for (let x=1;x<W-1;x++) {
      if (!water[y][x]||layer[y][x]) continue
      if (rng()<0.06) layer[y][x]=LILLY[0]
    }

  // Reeds and bushes on dry land near water
  for (let y=1;y<H-1;y++) {
    for (let x=1;x<W-1;x++) {
      if (water[y][x]||!dry[y][x]||layer[y][x]) continue
      // Only near water
      let nearWater=false
      for (let dy=-2;dy<=2;dy++)
        for (let dx=-2;dx<=2;dx++)
          if (getW(water,x+dx,y+dy,W,H)) nearWater=true
      if (!nearWater) continue
      const r=rng()
      if (r<0.15) layer[y][x]=REED[Math.floor(rng()*REED.length)]
      else if (r<0.22) layer[y][x]=BOG_BUSH[Math.floor(rng()*BOG_BUSH.length)]
    }
  }

  return layer
}

function buildExitsAndClear(overlay,water,W,H,cfg) {
  const half=Math.floor(cfg.exitWidth/2)
  const midY=Math.floor(H/2),midX=Math.floor(W/2)
  const exits={},entries={}
  const D=cfg.exitClearDepth;
  const edges=[
    {dir:'west',cx:0,cy:midY,dx:1,dy:0},
    {dir:'east',cx:W-1,cy:midY,dx:-1,dy:0},
    {dir:'north',cx:midX,cy:0,dx:0,dy:1},
    {dir:'south',cx:midX,cy:H-1,dx:0,dy:-1},
  ]
  edges.forEach(({dir,cx,cy,dx,dy})=>{
    for (let off=-half;off<=half;off++)
      for (let d=0;d<D;d++){
        const x=cx+dx*d+(dy!==0?off:0)
        const y=cy+dy*d+(dx!==0?off:0)
        if (inBounds(x,y,W,H)){overlay[y][x]=0;water[y][x]=false}
      }
    const tiles=dir==='west'||dir==='east'
      ?Array.from({length:cfg.exitWidth},(_,i)=>[cx,cy-half+i])
      :Array.from({length:cfg.exitWidth},(_,i)=>[cx-half+i,cy])
    const destMap={west:'Bog_West',east:'Bog_East',north:'Bog_North',south:'Bog_South'}
    const epMap={west:'east',east:'west',north:'south',south:'north'}
    exits[dir]={tiles,destination:destMap[dir],entryPoint:epMap[dir]}
    if (dir==='west'||dir==='east')
      entries[dir]={x:dir==='west'?D:W-1-D,yFromSource:true,y:cy}
    else
      entries[dir]={x:cx,yFromSource:false,y:dir==='north'?D:H-1-D}
  })
  return {exits,entries}
}

function generate(outputName) {
  const cfg={...CONFIG}
  const {width:W,height:H}=cfg
  const seedVal=outputName.split('').reduce((a,c)=>a+c.charCodeAt(0),0)*2654435761
  const rng=mulberry32(seedVal)

  console.log(`\nGenerating ${W}x${H} flooded bog: "${outputName}"`)

  const {water,dry}=buildWaterAndDry(W,H,cfg,rng)
  const paths=buildSteppingPaths(water,dry,W,H,cfg,rng)
  const base =buildBase(water,dry,W,H)
  const overlay=buildOverlay(water,dry,paths,W,H,rng)
  const {exits,entries}=buildExitsAndClear(overlay,water,W,H,cfg)

  const map={
    name:outputName,width:W,height:H,
    layers:[base,overlay],
    legend:{
      '733':'bog ground','732':'dark bog ground',
      '1379':'plain mud','1380':'mud twigs',
      '1634':'bog water 1','1688':'bog water 2',
      '1464':'water N','1572':'water S','1517':'water W','1519':'water E',
      '1571':'water SW','1573':'water SE','1463':'water NW','1465':'water NE',
      '1735':'stepping stone 1','1789':'stepping stone 2',
      '54':'lillypads',
      '49':'large bog bush','50':'medium bog bush','51':'bog bush pair','53':'small bog bush',
      '215':'brown plants (reeds)','216':'brown plant (reed)',
      '0':'empty'
    },
    spawns:{player:{x:W-cfg.exitClearDepth,y:Math.floor(H/2)}},
    exits,entries
  }

  writeFileSync(resolve(OUTPUT_DIR,`${outputName}.json`),JSON.stringify(map))
  console.log(`Written: public/maps/bogMaps/${outputName}.json`)
  console.log(`View at: http://localhost:5173/tools/map-editor/viewer.html?map=${outputName}`)

  const step=2
  console.log('\nASCII  ~ water  . dry  s stone\n')
  for (let y=0;y<H;y+=step){
    let row=''
    for (let x=0;x<W;x+=step)
      row+=water[y][x]?'~':paths[y][x]?'s':'.'
    console.log(row)
  }
}

const outputName=process.argv[2]||'flooded_bog_default'
generate(outputName)


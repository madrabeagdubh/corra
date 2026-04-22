// bog_islands_gen.mjs
// 48x48 bog with islands -- raised drier ground amid deep bog,
// connected by narrow causeways. Maze-like but navigable.
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
  islandCount:   8,
  islandMinR:    3,
  islandMaxR:    6,
  // Causeways connecting islands -- width in tiles
  causewayWidth: 2,
  // Noise for water fill between islands
  noiseScale:    0.25,
  waterThreshold: 0.45,
  exitWidth:     5,
  exitClearDepth: 4,
}

const WATER    = [1634, 1688]
const EDGE     = { NW:1571,N:1464,NE:1573, W:1517,E:1519, SW:1463,S:1572,SE:1465 }
const BOG_BASE = [733, 732]
const ISLAND   = [839, 840]   // dry grass on islands
const MUD      = [1379, 1380]
const BOG_BLOCK= [217, 218, 219]
const BOG_BUSH = [49, 50, 51, 53]
const PLANTS   = [215, 216, 213, 214]
const STEPPING = [1735, 1789]

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

function buildIslandsAndWater(W,H,cfg,rng) {
  const noise2D=createNoise2D()
  const island=make2D(W,H,false)  // true = dry island ground
  const water =make2D(W,H,false)

  // Place islands
  const islands=[]
  let attempts=0
  while (islands.length<cfg.islandCount&&attempts<200) {
    attempts++
    const r=cfg.islandMinR+Math.floor(rng()*(cfg.islandMaxR-cfg.islandMinR+1))
    const px=Math.floor(rng()*(W-r*2-4))+r+2
    const py=Math.floor(rng()*(H-r*2-4))+r+2
    // Don't overlap existing islands (minimum gap of 3)
    if (islands.some(([ix,iy,ir])=>dist2(px,py,ix,iy)<(r+ir+3)**2)) continue
    islands.push([px,py,r])
    for (let dy=-r;dy<=r;dy++)
      for (let dx=-r;dx<=r;dx++)
        if (dx*dx+dy*dy<=r*r&&inBounds(px+dx,py+dy,W,H))
          island[py+dy][px+dx]=true
  }

  // Water: noise-based bog fill, cleared on island cells
  for (let y=0;y<H;y++)
    for (let x=0;x<W;x++) {
      if (island[y][x]) continue
      const n=(noise2D(x*cfg.noiseScale,y*cfg.noiseScale)+1)/2
      if (n>cfg.waterThreshold) water[y][x]=true
      else water[y][x]=true  // bog between islands is mostly water
    }

  // Causeways: connect each island to its nearest neighbour
  const connected=new Set([0])
  while (connected.size<islands.length) {
    let bestI=-1,bestJ=-1,bestD=Infinity
    for (const i of connected) {
      for (let j=0;j<islands.length;j++) {
        if (connected.has(j)) continue
        const d=dist2(islands[i][0],islands[i][1],islands[j][0],islands[j][1])
        if (d<bestD){bestD=d;bestI=i;bestJ=j}
      }
    }
    if (bestI<0) break
    connected.add(bestJ)
    // Carve causeway between islands[bestI] and islands[bestJ]
    const [x1,y1]=islands[bestI], [x2,y2]=islands[bestJ]
    const steps=Math.max(Math.abs(x2-x1),Math.abs(y2-y1))
    for (let s=0;s<=steps;s++) {
      const cx=Math.round(x1+(x2-x1)*s/steps)
      const cy=Math.round(y1+(y2-y1)*s/steps)
      for (let off=-Math.floor(cfg.causewayWidth/2);off<=Math.floor(cfg.causewayWidth/2);off++) {
        // Alternate N-S and E-W offset
        const px2=cx+(Math.abs(x2-x1)>Math.abs(y2-y1)?0:off)
        const py2=cy+(Math.abs(x2-x1)>Math.abs(y2-y1)?off:0)
        if (inBounds(px2,py2,W,H)) {
          water[py2][px2]=false
          island[py2][px2]=false  // causeway -- neither island nor water (mud)
        }
      }
    }
  }

  // Also connect entry/exit edges to nearest island with a causeway
  const midY=Math.floor(H/2), midX=Math.floor(W/2)
  const edgePoints=[[0,midY],[W-1,midY],[midX,0],[midX,H-1]]
  edgePoints.forEach(([ex,ey])=>{
    const nearest=islands.reduce((best,isl)=>{
      const d=dist2(ex,ey,isl[0],isl[1])
      return d<best.d?{d,isl}:best
    },{d:Infinity,isl:null}).isl
    if (!nearest) return
    const [ix,iy]=nearest
    const steps=Math.max(Math.abs(ix-ex),Math.abs(iy-ey))
    for (let s=0;s<=steps;s++) {
      const cx=Math.round(ex+(ix-ex)*s/steps)
      const cy=Math.round(ey+(iy-ey)*s/steps)
      if (inBounds(cx,cy,W,H)) { water[cy][cx]=false; island[cy][cx]=false }
    }
  })

  return {island,water,islands}
}

function buildBase(island,water,W,H) {
  return Array.from({length:H},(_,y)=>
    Array.from({length:W},(_,x)=>{
      if (water[y][x]) return (x+y)%2===0?WATER[0]:WATER[1]
      if (island[y][x]) return (x+y)%2===0?ISLAND[0]:ISLAND[1]
      // Causeway/mud between
      return (x+y)%2===0?MUD[0]:MUD[1]
    })
  )
}

function buildOverlay(island,water,W,H,rng) {
  const layer=make2D(W,H,0)

  // Water edge dither
  for (let y=0;y<H;y++) {
    for (let x=0;x<W;x++) {
      if (!water[y][x]) continue
      layer[y][x]=(x+y)%2===0?WATER[0]:WATER[1]
      const N=!getW(water,x,y-1,W,H),S=!getW(water,x,y+1,W,H)
      const E=!getW(water,x+1,y,W,H),Ww=!getW(water,x-1,y,W,H)
      if (!N&&!S&&!E&&!Ww) continue
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

  // Vegetation on islands
  for (let y=1;y<H-1;y++) {
    for (let x=1;x<W-1;x++) {
      if (water[y][x]||layer[y][x]) continue
      const r=rng()
      if (island[y][x]) {
        if (r<0.05) layer[y][x]=BOG_BUSH[Math.floor(rng()*BOG_BUSH.length)]
        else if (r<0.09) layer[y][x]=PLANTS[Math.floor(rng()*PLANTS.length)]
      } else {
        // Causeway -- bog blocks and bushes
        if (r<0.08) layer[y][x]=BOG_BLOCK[Math.floor(rng()*BOG_BLOCK.length)]
        else if (r<0.13) layer[y][x]=BOG_BUSH[Math.floor(rng()*BOG_BUSH.length)]
      }
    }
  }
  return layer
}

function buildExitsAndClear(overlay,water,island,W,H,cfg) {
  const half=Math.floor(cfg.exitWidth/2)
  const midY=Math.floor(H/2),midX=Math.floor(W/2)
  const exits={},entries={}
  const D=cfg.exitClearDepth
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

  console.log(`\nGenerating ${W}x${H} bog islands: "${outputName}"`)

  const {island,water}=buildIslandsAndWater(W,H,cfg,rng)
  const base   =buildBase(island,water,W,H)
  const overlay=buildOverlay(island,water,W,H,rng)
  const {exits,entries}=buildExitsAndClear(overlay,water,island,W,H,cfg)

  const map={
    name:outputName,width:W,height:H,
    layers:[base,overlay],
    legend:{
      '839':'island grass','840':'island grass twigs',
      '733':'bog ground','732':'dark bog ground',
      '1379':'plain mud','1380':'mud twigs',
      '1634':'bog water 1','1688':'bog water 2',
      '1464':'water N','1572':'water S','1517':'water W','1519':'water E',
      '1571':'water SW','1573':'water SE','1463':'water NW','1465':'water NE',
      '217':'bog block','218':'bog block cracked','219':'bog block very cracked',
      '49':'large bog bush','50':'medium bog bush','51':'bog bush pair','53':'small bog bush',
      '213':'green plants','214':'green plant','215':'brown plants','216':'brown plant',
      '0':'empty'
    },
    spawns:{player:{x:W-cfg.exitClearDepth,y:Math.floor(H/2)}},
    exits,entries
  }

  writeFileSync(resolve(OUTPUT_DIR,`${outputName}.json`),JSON.stringify(map))
  console.log(`Written: public/maps/bogMaps/${outputName}.json`)
  console.log(`View at: http://localhost:5173/tools/map-editor/viewer.html?map=${outputName}`)

  const step=2
  console.log('\nASCII  ~ water  I island  . causeway\n')
  for (let y=0;y<H;y+=step){
    let row=''
    for (let x=0;x<W;x+=step)
      row+=water[y][x]?'~':island[y][x]?'I':'.'
    console.log(row)
  }
}

const outputName=process.argv[2]||'bog_islands_default'
generate(outputName)
 

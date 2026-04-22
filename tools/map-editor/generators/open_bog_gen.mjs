// open_bog_gen.mjs
// 48x48 open bog -- vast flat peatland, dark pools, cotton grass, exposed.
// Very little cover, oppressive and wide. All four edges potentially active.
//
// Usage:
//   node tools/map-editor/generators/open_bog_gen.mjs v001

import { writeFileSync } from 'fs'
import { createNoise2D } from 'simplex-noise'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = resolve(__dirname, '../../../public/maps/bogMaps')

const CONFIG = {
  width: 48, height: 48,
  // Pool density -- open bog has many scattered pools
  poolCount:  12,
  poolMinR:   2,
  poolMaxR:   6,
  // Sparse impassable bog blocks (raised ground)
  blockDensity: 0.08,
  noiseScale:   0.22,
  exitWidth:    5,
  exitClearDepth: 4,
}

const WATER    = [1634, 1688]  // bog water (brown)
const EDGE     = { NW:1571,N:1464,NE:1573, W:1517,E:1519, SW:1463,S:1572,SE:1465 }
const BOG_BASE = [733, 732]
const MUD      = [1379, 1380]
const BOG_BLOCK = [217, 218, 219]
const BOG_BUSH  = [49, 50, 51, 53]
const PLANTS    = [215, 216, 213, 214]

const make2D   = (w,h,v=false)=>Array.from({length:h},()=>new Array(w).fill(v))
const inBounds = (x,y,W,H)=>x>=0&&x<W&&y>=0&&y<H
const getW     = (g,x,y,W,H)=>inBounds(x,y,W,H)?g[y][x]:false

function mulberry32(seed) {
  return ()=>{
    seed|=0;seed=seed+0x6D2B79F5|0
    let t=Math.imul(seed^seed>>>15,1|seed)
    t=t+Math.imul(t^t>>>7,61|t)^t
    return((t^t>>>14)>>>0)/4294967296
  }
}

function buildWater(W,H,cfg,rng) {
  const noise2D=createNoise2D()
  const water=make2D(W,H,false)
  // Noise-based pools -- irregular shapes
  for (let y=0;y<H;y++)
    for (let x=0;x<W;x++) {
      const n=(noise2D(x*cfg.noiseScale,y*cfg.noiseScale)+1)/2
      if (n>0.72) water[y][x]=true
    }
  // Additional circular pools
  for (let p=0;p<cfg.poolCount;p++) {
    const px=Math.floor(rng()*(W-8))+4
    const py=Math.floor(rng()*(H-8))+4
    const r=cfg.poolMinR+Math.floor(rng()*(cfg.poolMaxR-cfg.poolMinR+1))
    for (let dy=-r;dy<=r;dy++)
      for (let dx=-r;dx<=r;dx++)
        if (dx*dx+dy*dy<=r*r&&inBounds(px+dx,py+dy,W,H))
          water[py+dy][px+dx]=true
  }
  return water
}

function buildBase(water,W,H) {
  return Array.from({length:H},(_,y)=>
    Array.from({length:W},(_,x)=>{
      if (water[y][x]) return (x+y)%2===0?WATER[0]:WATER[1]
      for (let dy=-2;dy<=2;dy++)
        for (let dx=-2;dx<=2;dx++)
          if (getW(water,x+dx,y+dy,W,H)) return (x+y)%2===0?MUD[0]:MUD[1]
      return (x+y)%2===0?BOG_BASE[0]:BOG_BASE[1]
    })
  )
}

function buildOverlay(water,W,H,cfg,rng) {
  const layer=make2D(W,H,0)
  const noise2D=createNoise2D()

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

  // Scatter bog blocks, bushes, plants on dry ground
  for (let y=1;y<H-1;y++) {
    for (let x=1;x<W-1;x++) {
      if (water[y][x]||layer[y][x]) continue
      const r=rng()
      const n=(noise2D(x*0.4,y*0.4)+1)/2
      if (r<cfg.blockDensity&&n>0.6) {
        layer[y][x]=BOG_BLOCK[Math.floor(rng()*BOG_BLOCK.length)]
      } else if (r<cfg.blockDensity+0.06) {
        layer[y][x]=BOG_BUSH[Math.floor(rng()*BOG_BUSH.length)]
      } else if (r<cfg.blockDensity+0.10) {
        layer[y][x]=PLANTS[Math.floor(rng()*PLANTS.length)]
      }
    }
  }
  return layer
}

function buildExitsAndClear(overlay,water,W,H,cfg) {
  const half=Math.floor(cfg.exitWidth/2)
  const midY=Math.floor(H/2), midX=Math.floor(W/2)
  const exits={}, entries={}
  const D=cfg.exitClearDepth

  const edges=[
    {dir:'west', cx:0,    cy:midY, dx:1, dy:0},
    {dir:'east', cx:W-1,  cy:midY, dx:-1,dy:0},
    {dir:'north',cx:midX, cy:0,    dx:0, dy:1},
    {dir:'south',cx:midX, cy:H-1,  dx:0, dy:-1},
  ]

  edges.forEach(({dir,cx,cy,dx,dy})=>{
    // Clear exit strip
    for (let off=-half;off<=half;off++) {
      for (let d=0;d<D;d++) {
        const x=cx+dx*d+(dy!==0?off:0)
        const y=cy+dy*d+(dx!==0?off:0)
        if (inBounds(x,y,W,H)) overlay[y][x]=0
      }
    }
    let tiles=[]
    if (dir==='west'||dir==='east')
      tiles=Array.from({length:cfg.exitWidth},(_,i)=>[cx,cy-half+i])
    else
      tiles=Array.from({length:cfg.exitWidth},(_,i)=>[cx-half+i,cy])

    const destMap={west:'Bog_West',east:'Bog_East',north:'Bog_North',south:'Bog_South'}
    const epMap  ={west:'east',east:'west',north:'south',south:'north'}
    exits[dir]={tiles,destination:destMap[dir],entryPoint:epMap[dir]}

    if (dir==='west'||dir==='east') {
      const ex=dir==='west'?D:W-1-D
      entries[dir]={x:ex,yFromSource:true,y:cy}
    } else {
      const ey=dir==='north'?D:H-1-D
      entries[dir]={x:cx,yFromSource:false,y:ey}
    }
  })
  return {exits,entries}
}

function generate(outputName) {
  const cfg={...CONFIG}
  const {width:W,height:H}=cfg
  const seedVal=outputName.split('').reduce((a,c)=>a+c.charCodeAt(0),0)*2654435761
  const rng=mulberry32(seedVal)

  console.log(`\nGenerating ${W}x${H} open bog: "${outputName}"`)

  const water  = buildWater(W,H,cfg,rng)
  const base   = buildBase(water,W,H)
  const overlay=buildOverlay(water,W,H,cfg,rng)
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
  console.log('\nASCII  ~ water  . open\n')
  for (let y=0;y<H;y+=step){
    let row=''
    for (let x=0;x<W;x+=step)
      row+=water[y][x]?'~':'.'
    console.log(row)
  }
}

const outputName=process.argv[2]||'open_bog_default'
generate(outputName)

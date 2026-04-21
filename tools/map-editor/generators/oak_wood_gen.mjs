// oak_wood_gen.mjs
// Dense oak woodland with a winding carved path east-west.
//
// Usage:
//   node generators/oak_wood_gen.mjs v001
//
// View at: http://localhost:5173/tools/map-editor/viewer.html\?map\=v001

import { writeFileSync } from 'fs'
import { createNoise2D } from 'simplex-noise'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = resolve(__dirname, '../../../public/maps/bogMaps')

const CONFIG = {
  width:  36, height: 36,
  pathAmplitude: 6, pathFrequency: 0.18,
  pathHalfWidth: 3, pathFuzz: 3,
  pathTreeDensity: 0.10,
  forestThreshold: 0.05,
  noiseScale: 0.35,
  eastThinning: 0.45,
  smoothPasses: 2,
}

const OAK = { TL:260,TC:261,TR:262,ML:314,MC:315,MR:316,BL:368,BC:369,BR:370 }
const ROCKS=[154,155,156], BUSHES=[44,48]
const make2D=(w,h,v=false)=>Array.from({length:h},()=>new Array(w).fill(v))
const inBounds=(x,y,W,H)=>x>=0&&x<W&&y>=0&&y<H
const get=(g,x,y,W,H)=>inBounds(x,y,W,H)?g[y][x]:false

function pathCentreAt(x,W,H,amp,freq) {
  const mid=H/2
  return Math.round(mid+Math.sin(x*freq)*amp+Math.sin(x*freq*1.7+1.2)*(amp*0.4))
}

function seedForest(cfg) {
  
  const noise2D=createNoise2D()
  const {width:W,height:H}=cfg
  const grid=make2D(W,H,true)
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) {
    const ef=(x/(W-1))*cfg.eastThinning
    const v=(noise2D(x*cfg.noiseScale,y*cfg.noiseScale)+1)/2
    if((v-ef)<cfg.forestThreshold) grid[y][x]=false
  }
  return grid
}

function carvePath(grid,cfg) {
  const noise2D=createNoise2D()
  const {width:W,height:H}=cfg
  const centres=[]
  for(let x=0;x<W;x++) {
    const cy=pathCentreAt(x,W,H,cfg.pathAmplitude,cfg.pathFrequency)
    centres.push(cy)
    for(let y=0;y<H;y++) {
      const dist=Math.abs(y-cy)
      if(dist<=cfg.pathHalfWidth) {
        const hash=((x*7919+y*6271)*2654435761)>>>0
        grid[y][x]=(hash%1000)/1000<cfg.pathTreeDensity
      } else if(dist<=cfg.pathHalfWidth+cfg.pathFuzz) {
        const fp=(dist-cfg.pathHalfWidth)/cfg.pathFuzz
        const en=(noise2D(x*0.6,y*0.6)+1)/2
        grid[y][x]=(fp+en*0.3)>0.55
      }
    }
  }
  return {grid,centres}
}

function enforcePerimeter(grid,cfg) {
  const {width:W,height:H}=cfg
  for(let x=0;x<W;x++){grid[0][x]=true;grid[H-1][x]=true}
  for(let y=0;y<H;y++){grid[y][0]=true;grid[y][W-1]=true}
  for(let y=14;y<=20;y++){grid[y][0]=false;grid[y][W-1]=false}
}

function clearEntryZones(grid,cfg) {
  const {width:W,height:H}=cfg
  for(let dy=-4;dy<=4;dy++) {
    const y=17+dy
    if(!inBounds(0,y,W,H)) continue
    for(let x=0;x<4;x++) grid[y][x]=false
    for(let x=W-4;x<W;x++) grid[y][x]=false
  }
}

function smooth(grid,centres,cfg) {
  const {width:W,height:H}=cfg
  const next=grid.map(r=>[...r])
  for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++) {
    if(Math.abs(y-centres[x])<=cfg.pathHalfWidth) continue
    let n=0
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++)
      if(!(dx===0&&dy===0)&&get(grid,x+dx,y+dy,W,H)) n++
    if(n>=6) next[y][x]=true
    else if(n<=1) next[y][x]=false
  }
  return next
}

function buildOverlay(forest,W,H) {
  const layer=make2D(W,H,0)
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) {
    if(!forest[y][x]) continue
    const N=get(forest,x,y-1,W,H),S=get(forest,x,y+1,W,H)
    const E=get(forest,x+1,y,W,H),Ww=get(forest,x-1,y,W,H)
    if(!N&&!Ww){layer[y][x]=OAK.TL;continue}
    if(!N&&!E) {layer[y][x]=OAK.TR;continue}
    if(!S&&!Ww){layer[y][x]=OAK.BL;continue}
    if(!S&&!E) {layer[y][x]=OAK.BR;continue}
    if(!N)     {layer[y][x]=OAK.TC;continue}
    if(!S)     {layer[y][x]=OAK.BC;continue}
    if(!Ww)    {layer[y][x]=OAK.ML;continue}
    if(!E)     {layer[y][x]=OAK.MR;continue}
    layer[y][x]=OAK.MC
  }
  return layer
}

const buildBase=(W,H)=>Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>(x+y)%2===0?839:840))

function scatterDetails(overlay,forest,centres,cfg) {
  const {width:W,height:H}=cfg
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) {
    if(overlay[y][x]||forest[y][x]) continue
    if(Math.abs(y-centres[x])>cfg.pathHalfWidth+cfg.pathFuzz) continue
    const hash=((x*7919+y*6271)*2654435761)>>>0
    const chance=(hash%1000)/1000
    if(chance<0.05*(1-x/W)) overlay[y][x]=ROCKS[hash%ROCKS.length]
    else if(chance<0.09)    overlay[y][x]=BUSHES[hash%BUSHES.length]
  }
}

function generate(outputName) {
  const cfg=CONFIG,{width:W,height:H}=cfg
  let forest=seedForest(cfg)
  const {grid:carved,centres}=carvePath(forest,cfg)
  forest=carved
  for(let i=0;i<cfg.smoothPasses;i++) forest=smooth(forest,centres,cfg)
  enforcePerimeter(forest,cfg)
  clearEntryZones(forest,cfg)
  const base=buildBase(W,H)
  const overlay=buildOverlay(forest,W,H)
  scatterDetails(overlay,forest,centres,cfg)
  const map={
    name:'Oak_Wood',width:W,height:H,layers:[base,overlay],
    legend:{'839':'plain grass','840':'grass with twigs','260':'oak TL','261':'oak TC','262':'oak TR','314':'oak ML','315':'oak MC','316':'oak MR','368':'oak BL','369':'oak BC','370':'oak BR','154':'rock','155':'rock','156':'rocks','44':'bush','48':'bush','0':'empty'},
    spawns:{player:{x:W-3,y:17}},
    exits:{
      west:{tiles:[[0,15],[0,16],[0,17],[0,18],[0,19]],destination:'Bog_Threshold',entryPoint:'east'},
      east:{tiles:[[W-1,15],[W-1,16],[W-1,17],[W-1,18],[W-1,19]],destination:'Village',entryPoint:'west'}
    },
    entries:{
      west:{x:3,yFromSource:true,y:17},east:{x:W-3,yFromSource:true,y:17},
      north:{x:18,yFromSource:false,y:2},south:{x:18,yFromSource:false,y:H-3}
    }
  }
  const outPath=resolve(OUTPUT_DIR,`${outputName}.json`)
  writeFileSync(outPath,JSON.stringify(map,null,2))
  console.log(`\nWritten: tools/map-editor/output/${outputName}.json`)
  console.log(`View at: http://localhost:5173/tools/map-editor/viewer.html?map=${outputName}`)
  console.log('\nASCII  # tree  . open  p path-centre\n')
  for(let y=0;y<H;y++){
    let row=''
    for(let x=0;x<W;x++) row+=forest[y][x]?'#':y===centres[x]?'p':'.'
    console.log(row)
  }
}

const outputName=process.argv[2]||'oak_wood_default'
generate(outputName)

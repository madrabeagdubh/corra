/**
 * gen_all_maps.mjs
 * Generates all 17 grid maps (4×4 bog grid + b0 village) and writes them
 * to public/maps/bogMaps/
 *
 * Usage (from ~/Corra):
 *   node tools/map-editor/generators/gen_all_maps.mjs
 */

import { writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../../../public/maps/bogMaps')
mkdirSync(OUT, { recursive: true })

// ── Shared helpers ────────────────────────────────────────────────────────────
const W = 36, H = 36
const make2D   = (w,h,v=0)  => Array.from({length:h},()=>new Array(w).fill(v))
const inB      = (x,y)      => x>=0&&x<W&&y>=0&&y<H
const getG     = (g,x,y,dv) => inB(x,y)?g[y][x]:dv

function mulberry32(seed) {
  return ()=>{ seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296 }
}
function seededRng(name) { return mulberry32(name.split('').reduce((a,c)=>a+c.charCodeAt(0),0)*2654435761) }

// ── Shared height map ─────────────────────────────────────────────────────────
// One vertex per tile corner. Vertex (vx, vy) is the top-left corner of tile
// (vx, vy), shared with tile (vx-1, vy-1) etc — so adjacent tiles naturally
// share corners and there are no seams.
//
// Grid layout (a=col0, row1=row0):
//   col:  0=a  1=b  2=c  3=d
//   row:  0=row1  1=row2  2=row3  3=row4
//
// Full vertex grid is (4*W+1) × (4*H+1) = 145×145.
// Row-3 maps (row index 2) cover tile-y 72–108 (global vertex rows 72–108).

const GRID_COLS  = 4
const GRID_ROWS  = 4
const VW         = GRID_COLS * W + 1   // 145
const VH         = GRID_ROWS * H + 1   // 145
const HEIGHT_AMP = 3

function buildSharedHeightMap() {
  // Deterministic corner hash — no RNG object needed
  function cornerHash(gx, gy) {
    let s = (gx * 374761393 + gy * 1103515245) | 0
    s = Math.imul((s ^ (s >>> 16)), 0x45d9f3b)
    s = Math.imul((s ^ (s >>> 16)), 0x45d9f3b)
    return ((s ^ (s >>> 16)) & 0xffff) / 0xffff
  }

  // Bilinear value noise at continuous coords (nx, ny) with given frequency scale
  function valueNoise(nx, ny, scale) {
    const gx0 = Math.floor(nx * scale), gy0 = Math.floor(ny * scale)
    const gx1 = gx0 + 1,               gy1 = gy0 + 1
    const fx  = nx * scale - gx0,      fy  = ny * scale - gy0
    // Smoothstep
    const sfx = fx * fx * (3 - 2 * fx)
    const sfy = fy * fy * (3 - 2 * fy)
    return (
      cornerHash(gx0, gy0) * (1 - sfx) * (1 - sfy) +
      cornerHash(gx1, gy0) *      sfx  * (1 - sfy) +
      cornerHash(gx0, gy1) * (1 - sfx) *      sfy  +
      cornerHash(gx1, gy1) *      sfx  *      sfy
    )
  }

  const octaves = [
    { scale: 0.040, amp: 1.00 },
    { scale: 0.090, amp: 0.45 },
    { scale: 0.200, amp: 0.20 },
  ]
  const totalAmp = octaves.reduce((s, o) => s + o.amp, 0)

  // Flat array, row-major: index = vy * VW + vx
  const raw = new Array(VW * VH)

  for (let vy = 0; vy < VH; vy++) {
    for (let vx = 0; vx < VW; vx++) {
      // Accumulate octaves, normalise to [-1, 1]
      let v = 0
      for (const { scale, amp } of octaves) {
        v += (valueNoise(vx, vy, scale) * 2 - 1) * amp
      }
      v /= totalAmp  // [-1, 1]

      // No valley bias — negative heights are clamped to 0 in _vertexH so they
      // would create black holes. River maps read as low naturally via water tiles.
      raw[vy * VW + vx] = +Math.max(0, Math.min(HEIGHT_AMP, v * HEIGHT_AMP)).toFixed(4)
    }
  }
  return raw   // flat Array of floats, length VW*VH
}

const SHARED_HM = buildSharedHeightMap()

/**
 * Slice a (H+1)×(W+1) 2-D array from the shared height map for a map at
 * grid position (gridX, gridY).
 *   gridX: 0=a  1=b  2=c  3=d
 *   gridY: 0=row1  1=row2  2=row3  3=row4
 */
function sliceHeightMap(gridX, gridY) {
  const ox = gridX * W
  const oy = gridY * H
  const rows = []
  for (let dy = 0; dy <= H; dy++) {
    const row = []
    for (let dx = 0; dx <= W; dx++) {
      const vx = ox + dx
      const vy = oy + dy
      // clamp to edge if somehow out of range
      const cvx = Math.max(0, Math.min(VW - 1, vx))
      const cvy = Math.max(0, Math.min(VH - 1, vy))
      row.push(SHARED_HM[cvy * VW + cvx])
    }
    rows.push(row)
  }
  return rows
}

// ── Tile GIDs ─────────────────────────────────────────────────────────────────
const OAK  = {TL:260,TC:261,TR:262,ML:314,MC:315,MR:316,BL:368,BC:369,BR:370}
const BOG_TREE = {TL:263,TC:264,TR:265,ML:317,MC:318,MR:319,BL:371,BC:372,BR:373}
const GRASS    = [839,840]
const WATERSIDE= 731
const WATER    = [1625,1679]
const EDGE_W   = {NW:1571,N:1464,NE:1573,W:1517,E:1519,SW:1463,S:1572,SE:1465}
const STEPPING = [1735,1789]
const ROCKS    = [154,155,156]
const BUSHES   = [44,45,48]
const FLOWERS  = [98,100]
const BOG_FLAT = 733
const BOG_POOL = [83,84,99,100]
const STONE_CIRCLE = [154,155,208,209]

const BLDG_THATCH1 = 3001
const BLDG_THATCH2 = 3002
const BLDG_WALL1   = 3011
const BLDG_WALL2   = 3012
const BLDG_WALL3   = 3013

// ── Forest CA ─────────────────────────────────────────────────────────────────
function forestCA(cfg, water, rng) {
  let g = make2D(W,H,false)
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) {
    if(water&&water[y][x]){g[y][x]=false;continue}
    g[y][x]=rng()<cfg.density
  }
  for(let p=0;p<cfg.passes;p++){
    const n=make2D(W,H,false)
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      if(water&&water[y][x]){n[y][x]=false;continue}
      let c=0
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++)
        if(!(dx===0&&dy===0)&&getG(g,x+dx,y+dy,true))c++
      n[y][x]=g[y][x]?c>=cfg.survive:c>=cfg.birth
    }
    g=n
  }
  return g
}

function clearCorridor(forest, dir, midY, midX, depth, half) {
  for(let d=0;d<depth;d++) {
    for(let o=-half;o<=half;o++) {
      let x,y
      if(dir==='west') {x=d;y=midY+o}
      else if(dir==='east') {x=W-1-d;y=midY+o}
      else if(dir==='north') {x=midX+o;y=d}
      else {x=midX+o;y=H-1-d}
      if(inB(x,y))forest[y][x]=false
    }
  }
}

function buildTreeLayer(forest, dark=false) {
  const layer=make2D(W,H,0)
  const stamp = dark ? BOG_TREE : OAK
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    if(!forest[y][x])continue
    const N=getG(forest,x,y-1,true),S=getG(forest,x,y+1,true)
    const E=getG(forest,x+1,y,true),Ww=getG(forest,x-1,y,true)
    if(!N&&!Ww){layer[y][x]=stamp.TL;continue}
    if(!N&&!E) {layer[y][x]=stamp.TR;continue}
    if(!S&&!Ww){layer[y][x]=stamp.BL;continue}
    if(!S&&!E) {layer[y][x]=stamp.BR;continue}
    if(!N)     {layer[y][x]=stamp.TC;continue}
    if(!S)     {layer[y][x]=stamp.BC;continue}
    if(!Ww)    {layer[y][x]=stamp.ML;continue}
    if(!E)     {layer[y][x]=stamp.MR;continue}
    layer[y][x]=stamp.MC
  }
  return layer
}

function buildGrassBase(water) {
  return Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>{
    if(water&&water[y][x]) return (x+y)%2===0?WATER[0]:WATER[1]
    if(water){
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++)
        if(getG(water,x+dx,y+dy,false)) return WATERSIDE
    }
    return (x+y)%2===0?GRASS[0]:GRASS[1]
  }))
}

function scatterDetail(overlay, forest, water, rng) {
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    if(overlay[y][x]||( forest&&forest[y][x])||(water&&water[y][x])) continue
    if(water){
      let nearWater=false
      for(let dy=-1;dy<=1&&!nearWater;dy++) for(let dx=-1;dx<=1;dx++)
        if(getG(water,x+dx,y+dy,false)){nearWater=true;break}
      if(nearWater) continue
    }
    const r=rng()
    if(r<0.04) overlay[y][x]=BUSHES[Math.floor(rng()*BUSHES.length)]
    else if(r<0.07) overlay[y][x]=FLOWERS[Math.floor(rng()*FLOWERS.length)]
  }
}

// ── Exit/entry builders ───────────────────────────────────────────────────────
const MID = 17

function makeExitEntry(exits_def) {
  const exits={}, entries={}
  const HALF=2
  for(const [dir,dest] of Object.entries(exits_def)){
    let tiles, entryX, entryY, entryPoint
    if(dir==='north'){
      tiles=[[MID-HALF,1],[MID-1,1],[MID,1],[MID+1,1],[MID+HALF,1]]
      entryPoint='south'; entryX=MID; entryY=4
    } else if(dir==='south'){
      tiles=[[MID-HALF,H-2],[MID-1,H-2],[MID,H-2],[MID+1,H-2],[MID+HALF,H-2]]
      entryPoint='north'; entryX=MID; entryY=H-4
    } else if(dir==='west'){
      tiles=[[0,MID-HALF],[0,MID-1],[0,MID],[0,MID+1],[0,MID+HALF]]
      entryPoint='east'; entryX=4; entryY=MID
    } else {
      tiles=[[W-2,MID-HALF],[W-2,MID-1],[W-2,MID],[W-2,MID+1],[W-2,MID+HALF]]
      entryPoint='west'; entryX=W-4; entryY=MID
    }
    exits[dir]={tiles, destination:dest, entryPoint}
    entries[dir]={x:entryX, y:entryY, yFromSource: (dir==='east'||dir==='west')}
  }
  return {exits,entries}
}

const RIVER_EDGE_HALF = 4
const BANK_ROWS       = 3

function makeRiverExitEntry(exits_def, riverYs) {
  const exits={}, entries={}
  const HALF=2
  for(const [dir,dest] of Object.entries(exits_def)){
    if(dir==='east'||dir==='west'){
      const cy = dir==='west' ? riverYs.west : riverYs.east
      const x  = dir==='west' ? 0 : W-2
      const tiles=[]
      for(let o=-RIVER_EDGE_HALF-BANK_ROWS;o<=RIVER_EDGE_HALF;o++){
        const y=cy+o
        if(y>=1&&y<H-1) tiles.push([x,y])
      }
      exits[dir]={tiles, destination:dest, entryPoint: dir==='west'?'east':'west'}
      entries[dir]={x: dir==='west'?4:W-4, y:cy, yFromSource:true}
    } else if(dir==='north'){
      exits[dir]={tiles:[[MID-HALF,1],[MID-1,1],[MID,1],[MID+1,1],[MID+HALF,1]],
                  destination:dest, entryPoint:'south'}
      entries[dir]={x:MID, y:4, yFromSource:false}
    } else {
      exits[dir]={tiles:[[MID-HALF,H-2],[MID-1,H-2],[MID,H-2],[MID+1,H-2],[MID+HALF,H-2]],
                  destination:dest, entryPoint:'north'}
      entries[dir]={x:MID, y:H-4, yFromSource:false}
    }
  }
  return {exits,entries}
}

// ── River stream helper ───────────────────────────────────────────────────────
function buildRiver(rng, entryY, exitYHint) {
  const water=make2D(W,H,false)
  const hw=3
  const centres=[]
  for(let x=0;x<W;x++){
    const t=x/W
    const wave=Math.sin(x*0.18)*5 + Math.sin(x*0.09+1.2)*3
    const base = exitYHint!=null
      ? entryY + (exitYHint-entryY)*t + wave
      : entryY + wave
    centres.push(Math.max(hw+1,Math.min(H-hw-2,Math.round(base))))
  }
  for(let x=0;x<W;x++){
    const cy=centres[x]
    const w=(x<4||x>W-5)?hw+1:hw
    for(let r=-w;r<=w;r++) if(inB(x,cy+r))water[cy+r][x]=true
  }
  return {water, westY:centres[0], eastY:centres[W-1]}
}

function buildWaterOverlay(water) {
  const ov=make2D(W,H,0)
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    if(!water[y][x])continue
    ov[y][x]=(x+y)%2===0?WATER[0]:WATER[1]
  }
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    if(!water[y][x])continue
    const N=!getG(water,x,y-1,false),S=!getG(water,x,y+1,false)
    const E=!getG(water,x+1,y,false),Ww=!getG(water,x-1,y,false)
    if(!N&&!S&&!E&&!Ww)continue
    if(S&&Ww&&!N&&!E){ov[y][x]=EDGE_W.NW;continue}
    if(S&&E&&!N&&!Ww){ov[y][x]=EDGE_W.NE;continue}
    if(N&&Ww&&!S&&!E){ov[y][x]=EDGE_W.SW;continue}
    if(N&&E&&!S&&!Ww){ov[y][x]=EDGE_W.SE;continue}
    if(S&&!N&&!E&&!Ww){ov[y][x]=EDGE_W.S;continue}
    if(N&&!S&&!E&&!Ww){ov[y][x]=EDGE_W.N;continue}
    if(E&&!N&&!S&&!Ww){ov[y][x]=EDGE_W.E;continue}
    if(Ww&&!N&&!S&&!E){ov[y][x]=EDGE_W.W;continue}
  }
  return ov
}

function clearRiverExits(forest, overlay, water) {
  for(let x=0;x<W;x++){
    for(let y=0;y<H;y++){
      if(!water[y][x])continue
      for(let dy=1;dy<=3;dy++){
        if(inB(x,y-dy)){forest[y-dy][x]=false; overlay[y-dy][x]=0}
      }
    }
  }
}

// ── Open bog generator ────────────────────────────────────────────────────────
function genOpenBog(name, exits_def, rng, gridX, gridY) {
  const base=make2D(W,H,BOG_FLAT)
  const overlay=make2D(W,H,0)
  for(let y=2;y<H-2;y++) for(let x=2;x<W-2;x++){
    const r=rng()
    if(r<0.04) overlay[y][x]=BOG_POOL[Math.floor(rng()*BOG_POOL.length)]
    else if(r<0.08) overlay[y][x]=ROCKS[Math.floor(rng()*ROCKS.length)]
    else if(r<0.12) overlay[y][x]=209
  }
  const {exits,entries}=makeExitEntry(exits_def)
  for(const dir of Object.keys(exits_def)) clearOverlayCorridor(overlay,dir)
  const spawn={x:MID,y:MID}
  return buildMap(name,base,overlay,exits,entries,spawn,gridX,gridY)
}

function clearOverlayCorridor(overlay, dir) {
  const HALF=3,DEPTH=6
  for(let d=0;d<DEPTH;d++) for(let o=-HALF;o<=HALF;o++){
    let x,y
    if(dir==='west'){x=d;y=MID+o}
    else if(dir==='east'){x=W-1-d;y=MID+o}
    else if(dir==='north'){x=MID+o;y=d}
    else{x=MID+o;y=H-1-d}
    if(inB(x,y))overlay[y][x]=0
  }
}

// ── Village (b0) ──────────────────────────────────────────────────────────────
function bldgGid(dy, fh, wallGid) {
  if (dy === fh - 1) return wallGid
  const roofRows    = fh - 1
  const ridgeCenter = (roofRows - 1) / 2
  const distFromCenter = Math.abs(dy - ridgeCenter)
  return distFromCenter < 1.0 ? BLDG_THATCH2 : BLDG_THATCH1
}

function genVillage(name, exits_def, rng, gridX, gridY) {
  const base=Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>(x+y)%2===0?GRASS[0]:GRASS[1]))
  const overlay=make2D(W,H,0)

  const footprints=[
    {x:4,  y:8,  fw:8, fh:5, wallGid:BLDG_WALL2},
    {x:23, y:8,  fw:6, fh:4, wallGid:BLDG_WALL1},
    {x:5,  y:19, fw:6, fh:4, wallGid:BLDG_WALL1},
    {x:24, y:20, fw:4, fh:3, wallGid:BLDG_WALL3},
  ]
  for(const f of footprints){
    for(let dy=0;dy<f.fh;dy++) for(let gx=f.x;gx<f.x+f.fw;gx++){
      const gy=f.y+dy
      if(!inB(gx,gy)) continue
      base[gy][gx]    = bldgGid(dy, f.fh, f.wallGid)
      overlay[gy][gx] = 0
    }
  }

  for(let gy=2;gy<H-2;gy++) for(let gx=2;gx<W-2;gx++){
    const near=footprints.some(f=>gx>=f.x-1&&gx<=f.x+f.fw&&gy>=f.y-1&&gy<=f.y+f.fh)
    if(!near && !([BLDG_THATCH1,BLDG_THATCH2,BLDG_WALL1,BLDG_WALL2,BLDG_WALL3].includes(base[gy][gx]))){
      if(rng()<0.04) overlay[gy][gx]=BUSHES[Math.floor(rng()*BUSHES.length)]
      else if(rng()<0.03) overlay[gy][gx]=FLOWERS[Math.floor(rng()*FLOWERS.length)]
    }
  }

  const {exits,entries}=makeExitEntry(exits_def)
  for(const dir of Object.keys(exits_def)) clearOverlayCorridor(overlay,dir)
  const map=buildMap(name,base,overlay,exits,entries,{x:MID,y:H-6},gridX,gridY)
  // Village is a cleared, settled area — flatten heights significantly
  map.heightMap = map.heightMap.map(row => row.map(v => +(v * 0.12).toFixed(4)))
  map.hasCliffs=true
  map.elevationConfig={
    cliffFaceGid: BLDG_WALL1,
    elevatedGids: [BLDG_THATCH1, BLDG_THATCH2, BLDG_WALL1, BLDG_WALL2, BLDG_WALL3],
    cliffSouth:   [GRASS[0], GRASS[1]],
    cliffHeight:  1.5,
    gidHeights: {
      [BLDG_THATCH1]: 1.5,
      [BLDG_THATCH2]: 2.1,
      [BLDG_WALL1]:   1.5,
      [BLDG_WALL2]:   1.5,
      [BLDG_WALL3]:   1.5,
    },
    customTiles: {
      [BLDG_THATCH1]: '/assets/buildings/thatch1.png',
      [BLDG_THATCH2]: '/assets/buildings/thatch2.png',
      [BLDG_WALL1]:   '/assets/buildings/wall1.png',
      [BLDG_WALL2]:   '/assets/buildings/wall2.png',
      [BLDG_WALL3]:   '/assets/buildings/wall3.png',
    },
  }
  return map
}

// ── Fields approach (b1) ──────────────────────────────────────────────────────
function genFields(name, exits_def, rng, gridX, gridY) {
  const base=Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>(x+y)%2===0?GRASS[0]:GRASS[1]))
  const overlay=make2D(W,H,0)
  for(let y=2;y<H-2;y++) for(let x=2;x<W-2;x++){
    if(rng()<0.05) overlay[y][x]=BUSHES[Math.floor(rng()*BUSHES.length)]
  }
  const {exits,entries}=makeExitEntry(exits_def)
  for(const dir of Object.keys(exits_def)) clearOverlayCorridor(overlay,dir)
  return buildMap(name,base,overlay,exits,entries,{x:MID,y:MID},gridX,gridY)
}

// ── Forest maze generator ─────────────────────────────────────────────────────
function genForestMaze(name, exits_def, rng, opts={}, gridX=0, gridY=0) {
  const cfg={density:opts.density||0.48, passes:opts.passes||3, birth:opts.birth||5, survive:opts.survive||3}
  const forest=forestCA(cfg,null,rng)
  const DEPTH=7,HALF=2
  for(const dir of Object.keys(exits_def)) clearCorridor(forest,dir,MID,MID,DEPTH,HALF)
  for(let x=0;x<W;x++){forest[0][x]=true;forest[H-1][x]=true}
  for(let y=0;y<H;y++){forest[y][0]=true;forest[y][W-1]=true}
  for(const dir of Object.keys(exits_def)){
    for(let o=-HALF;o<=HALF;o++){
      if(dir==='west'&&inB(0,MID+o))   forest[MID+o][0]=false
      if(dir==='east'&&inB(W-1,MID+o)) forest[MID+o][W-1]=false
      if(dir==='north'&&inB(MID+o,0))  forest[0][MID+o]=false
      if(dir==='south'&&inB(MID+o,H-1))forest[H-1][MID+o]=false
    }
  }
  const base=buildGrassBase(null)
  const overlay=buildTreeLayer(forest, opts.dark||false)
  scatterDetail(overlay,forest,null,rng)
  if(opts.stoneCircle){
    const cx=Math.floor(W*0.35),cy=Math.floor(H*0.4),r=5
    for(let a=0;a<8;a++){
      const angle=(a/8)*Math.PI*2
      const sx=Math.round(cx+r*Math.cos(angle))
      const sy=Math.round(cy+r*Math.sin(angle))
      if(inB(sx,sy)){forest[sy][sx]=false;overlay[sy][sx]=STONE_CIRCLE[a%STONE_CIRCLE.length]}
    }
  }
  const {exits,entries}=makeExitEntry(exits_def)
  const spawn={x:W-4,y:MID}
  return buildMap(name,base,overlay,exits,entries,spawn,gridX,gridY)
}

// ── River map generator ───────────────────────────────────────────────────────
function genRiver(name, exits_def, rng, opts={}, gridX=0, gridY=0) {
  const entryY = opts.riverEntryY ?? MID
  const exitYHint = opts.riverExitYHint ?? null
  const {water,westY,eastY} = buildRiver(rng, entryY, exitYHint)

  const forestCfg={density:0.35,passes:2,birth:5,survive:3}
  const forest=forestCA(forestCfg,water,rng)
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    if(!forest[y][x]) continue
    let nearWater=false
    for(let dy=-1;dy<=1&&!nearWater;dy++) for(let dx=-1;dx<=1;dx++)
      if(getG(water,x+dx,y+dy,false)){nearWater=true;break}
    if(nearWater) forest[y][x]=false
  }
  const DEPTH=7,HALF=2
  const corridorY = dir => dir==='west' ? westY : dir==='east' ? eastY : MID
  for(const dir of Object.keys(exits_def))
    clearCorridor(forest,dir,corridorY(dir),MID,DEPTH,RIVER_EDGE_HALF+BANK_ROWS)
  for(let x=0;x<W;x++){forest[0][x]=true;forest[H-1][x]=true}
  for(let y=0;y<H;y++){forest[y][0]=true;forest[y][W-1]=true}
  for(const dir of Object.keys(exits_def)){
    if(dir==='west'||dir==='east'){
      const cy=corridorY(dir)
      for(let o=-RIVER_EDGE_HALF-BANK_ROWS;o<=RIVER_EDGE_HALF;o++){
        if(dir==='west'&&inB(0,cy+o))   forest[cy+o][0]=false
        if(dir==='east'&&inB(W-1,cy+o)) forest[cy+o][W-1]=false
      }
    } else {
      for(let o=-HALF;o<=HALF;o++){
        if(dir==='north'&&inB(MID+o,0))  forest[0][MID+o]=false
        if(dir==='south'&&inB(MID+o,H-1))forest[H-1][MID+o]=false
      }
    }
  }
  const waterOverlay=buildWaterOverlay(water)
  clearRiverExits(forest,waterOverlay,water)
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    if(!forest[y][x]) continue
    let nearWater2=false
    for(let dy=-1;dy<=1&&!nearWater2;dy++) for(let dx=-1;dx<=1;dx++)
      if(getG(water,x+dx,y+dy,false)){nearWater2=true;break}
    if(nearWater2) forest[y][x]=false
  }
  const base=buildGrassBase(water)
  const treeLayer=buildTreeLayer(forest,false)
  const overlay=make2D(W,H,0)
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    overlay[y][x]=waterOverlay[y][x]||treeLayer[y][x]
  }
  scatterDetail(overlay,forest,water,rng)
  const {exits,entries}=makeRiverExitEntry(exits_def,{west:westY,east:eastY})
  const spawnX = exits_def.east ? W-5 : (exits_def.west ? 4 : MID)
  const spawnY = Math.max(2, (exits_def.east||exits_def.west ? entries[Object.keys(exits_def)[0]]?.y??MID : MID) - 3)

return {
    ...buildMap(name, base, overlay, exits, entries, {x:spawnX, y:spawnY}, gridX, gridY),
    streamEdges: { west:westY, east:eastY },
    hasCliffs: true,                            }


}

// ── Map assembler ─────────────────────────────────────────────────────────────
function buildMap(name, base, overlay, exits, entries, spawn, gridX=0, gridY=0) {
  return {
    name, width:W, height:H,
    layers:[base,overlay],
    heightMap: sliceHeightMap(gridX, gridY),
    legend:{'0':'overlay','732':'grass','733':'bog','839':'grass','840':'grass',
            '731':'waterside','1625':'water','1679':'water'},
    spawns:{player:spawn},
    exits, entries
  }
}

function addBorder(map) {
  const W=map.width, H=map.height
  const openCols = new Set()
  const openRows = new Set()
  for (const [dir, ex] of Object.entries(map.exits||{})) {
    for (const [tx,ty] of ex.tiles) {
      if (dir==='north'||dir==='south') openCols.add(tx)
      if (dir==='east' ||dir==='west')  openRows.add(ty)
    }
  }
  const layer0=map.layers[0]
  const layer1=map.layers[1]
  for (let x=0;x<W;x++) {
    if (!openCols.has(x)) {
      layer0[0][x]=0
      if (layer1[0]) layer1[0][x]=0
    }
    if (!openCols.has(x)) {
      layer0[H-1][x]=0
      if (layer1[H-1]) layer1[H-1][x]=0
    }
  }
  for (let y=0;y<H;y++) {
    if (!openRows.has(y)) {
      layer0[y][0]=0
      if (layer1[y]) layer1[y][0]=0
    }
    if (!openRows.has(y)) {
      layer0[y][W-1]=0
      if (layer1[y]) layer1[y][W-1]=0
    }
  }
  map.border = { openCols:[...openCols], openRows:[...openRows] }
  return map
}

function writeMap(map) {
  addBorder(map)
  const path=resolve(OUT,`${map.name}.json`)
  writeFileSync(path,JSON.stringify(map))
  console.log(`  ✓ ${map.name}.json`)
}

// ── Generate all 17 ───────────────────────────────────────────────────────────
// Grid coordinates:  col 0=a 1=b 2=c 3=d  |  row 0=row1 1=row2 2=row3 3=row4
// b0 village sits above the grid — shares chunk with b1 (gridX=1,gridY=0)
//   but heights are flattened in genVillage.

console.log('\nGenerating Corra grid (4×4 bog + b0 village)...\n')

console.log('Row 3 — river maps (chained east→west):')
const d3rng=seededRng('d3'), d3=genRiver('d3',{west:'c3',north:'d2',south:'d4',east:'d3Sea'},d3rng,{riverEntryY:MID},3,2)
writeMap(d3)
const c3rng=seededRng('c3'), c3=genRiver('c3',{west:'b3',east:'d3',north:'c2',south:'c4'},c3rng,{riverEntryY:d3.streamEdges?.west??MID, riverExitYHint:d3.streamEdges?.west??MID},2,2)
writeMap(c3)
const b3rng=seededRng('b3'), b3=genRiver('b3',{west:'a3',east:'c3',north:'b2',south:'b4'},b3rng,{riverEntryY:c3.streamEdges?.west??MID, riverExitYHint:c3.streamEdges?.west??MID},1,2)
writeMap(b3)
const a3rng=seededRng('a3'), a3=genRiver('a3',{north:'a2',east:'b3',south:'a4'},a3rng,{riverEntryY:b3.streamEdges?.west??MID, riverExitYHint:b3.streamEdges?.west??MID},0,2)
writeMap(a3)

console.log('\nRow 0 — village:')
writeMap(genVillage('b0',{south:'b1'},seededRng('b0'),1,0))

console.log('\nRow 1 — fields/forest:')
writeMap(genForestMaze('a1',{east:'b1',south:'a2'},seededRng('a1'),{density:0.52},0,0))
writeMap(genFields('b1',{west:'a1',east:'c1',south:'b2',north:'b0'},seededRng('b1'),1,0))
writeMap(genForestMaze('c1',{west:'b1',east:'d1',south:'c2'},seededRng('c1'),{},2,0))
writeMap(genForestMaze('d1',{west:'c1',south:'d2'},seededRng('d1'),{},3,0))

console.log('\nRow 2 — transitional forest:')
writeMap(genOpenBog('a2',{north:'a1',east:'b2',south:'a3'},seededRng('a2'),0,1))
writeMap(genForestMaze('b2',{north:'b1',west:'a2',east:'c2',south:'b3'},seededRng('b2'),{},1,1))
writeMap(genForestMaze('c2',{north:'c1',west:'b2',east:'d2',south:'c3'},seededRng('c2'),{},2,1))
writeMap(genForestMaze('d2',{north:'d1',west:'c2',south:'d3'},seededRng('d2'),{stoneCircle:true},3,1))

console.log('\nRow 4 — druid forest (dark, dense):')
writeMap(genForestMaze('a4',{north:'a3',east:'b4'},seededRng('a4'),{density:0.58,dark:true},0,3))
writeMap(genForestMaze('b4',{north:'b3',west:'a4',east:'c4'},seededRng('b4'),{density:0.56,dark:true},1,3))
writeMap(genForestMaze('c4',{north:'c3',west:'b4',east:'d4'},seededRng('c4'),{density:0.56,dark:true},2,3))
writeMap(genForestMaze('d4',{north:'d3',west:'c4'},seededRng('d4'),{density:0.58,dark:true},3,3))

console.log('\nDone. 17 maps written to public/maps/bogMaps/')
console.log('Enable exit debug: window._devExits = true in browser console')

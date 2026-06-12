/**
 * gen_all_maps.mjs
 * Generates all 17 grid maps (4×4 bog grid + b0 village) and writes them
 * to public/maps/bogMaps/
 *
 * Usage (from ~/Corra):
 *   node tools/map-editor/generators/gen_all_maps.mjs
 */

import { writeFileSync, mkdirSync } from 'fs'
// simplex-noise used only if available
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
const BOG_FLAT = 733  // flat bog ground tile
const BOG_POOL = [83,84,99,100]  // dark bog pool tiles
const STONE_CIRCLE = [154,155,208,209]

// ── Building GIDs (custom — above Oryx range, mapped to /assets/buildings/*.png)
// Register these in the scene via pgr.registerCustomTile(GID, url) before use.
// thatch1.png = standard roof surface, thatch2.png = ridge (taller peak)
// wall1/2/3.png = wall face variants (bothán daub, forge stone, cabin timber etc.)
const BLDG_THATCH1 = 3001   // /assets/buildings/thatch1.png — eave/roof surface
const BLDG_THATCH2 = 3002   // /assets/buildings/thatch2.png — ridge (cliffHeight 2.1)
const BLDG_WALL1   = 3011   // /assets/buildings/wall1.png   — daub/wattle (bothán, cabin)
const BLDG_WALL2   = 3012   // /assets/buildings/wall2.png   — stone (forge)
const BLDG_WALL3   = 3013   // /assets/buildings/wall3.png   — timber (shed)

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
      // Narrow shallow/reed margin: only tiles directly adjacent to water
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++)
        if(getG(water,x+dx,y+dy,false)) return WATERSIDE
    }
    return (x+y)%2===0?GRASS[0]:GRASS[1]
  }))
}

function scatterDetail(overlay, forest, water, rng) {
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    if(overlay[y][x]||( forest&&forest[y][x])||(water&&water[y][x])) continue
    // Never place flowers/bushes in or beside water (incl. shallow margin)
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
// MID tile for lateral exits — use row/col 18 (1-indexed centre of 36)
const MID = 17

function makeExitEntry(exits_def) {
  // exits_def: { north:'a2', south:'a4', east:'b3', west:'...' }
  // Returns {exits, entries} in the map JSON format
  const exits={}, entries={}
  const HALF=2  // 5-tile wide exit band
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

// River-map variant: east/west exits are centred on the river where it meets
// the map edge and span the FULL river width (edge half-width 4 = 9 tiles)
// plus the 3-tile north-bank path, so both the boat and walkers pass through.
// North/south exits keep the standard 5-tile MID band.
const RIVER_EDGE_HALF = 4   // matches buildRiver's hw+1 at map edges
const BANK_ROWS       = 3   // north-bank walking path cleared by clearRiverExits

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
// Builds a water boolean grid with a river flowing west→east.
// entryY: y tile where river enters from the west edge
// exitY:  y tile where river exits to the east edge (pass null to auto-wave)
function buildRiver(rng, entryY, exitYHint) {
  const water=make2D(W,H,false)
  const noise2D=(x,y)=>Math.sin(x*127.1+y*311.7)
  const hw=3  // half-width of river (wider — mostly open blue water)
  // Generate a curved path from west to east
  const centres=[]
  for(let x=0;x<W;x++){
    const t=x/W
    const wave=Math.sin(x*0.18)*5 + Math.sin(x*0.09+1.2)*3
    // Lerp from entryY toward exitYHint if given
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
  // Edge dither
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

// Clear forest and overlay along river exit corridors so player can reach them
function clearRiverExits(forest, overlay, water) {
  // Clear a path along the north bank for walking
  for(let x=0;x<W;x++){
    for(let y=0;y<H;y++){
      if(!water[y][x])continue
      // Clear 3 tiles above water (north bank path)
      for(let dy=1;dy<=3;dy++){
        if(inB(x,y-dy)){forest[y-dy][x]=false; overlay[y-dy][x]=0}
      }
    }
  }
}

// ── Open bog generator ────────────────────────────────────────────────────────
function genOpenBog(name, exits_def, rng) {
  const base=make2D(W,H,BOG_FLAT)
  const overlay=make2D(W,H,0)
  // Scatter bog pools
  for(let y=2;y<H-2;y++) for(let x=2;x<W-2;x++){
    const r=rng()
    if(r<0.04) overlay[y][x]=BOG_POOL[Math.floor(rng()*BOG_POOL.length)]
    else if(r<0.08) overlay[y][x]=ROCKS[Math.floor(rng()*ROCKS.length)]
    else if(r<0.12) overlay[y][x]=209  // withered tree
  }
  // Clear corridors at exits
  const {exits,entries}=makeExitEntry(exits_def)
  for(const dir of Object.keys(exits_def)) clearOverlayCorridor(overlay,dir)
  const spawn={x:MID,y:MID}
  return buildMap(name,base,overlay,exits,entries,spawn)
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
// Helper: for a given row offset within a footprint, return the building GID.
//   dy=0 is the northernmost (back) row; dy=fh-1 is the south (wall face) row.
//   The center roof row(s) get BLDG_THATCH2 (taller) to form a ridge peak.
function bldgGid(dy, fh, wallGid) {
  if (dy === fh - 1) return wallGid          // south face — wall texture
  const roofRows    = fh - 1                 // number of rows that are roof
  const ridgeCenter = (roofRows - 1) / 2     // fractional center of roof depth
  const distFromCenter = Math.abs(dy - ridgeCenter)
  return distFromCenter < 1.0 ? BLDG_THATCH2 : BLDG_THATCH1
}

function genVillage(name, exits_def, rng) {
  const base=Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>(x+y)%2===0?GRASS[0]:GRASS[1]))
  const overlay=make2D(W,H,0)

  // Buildings: {x, y, fw, fh, wallGid}
  // Layer 0 south row → wallGid (front face), other rows → thatch (roof + ridge)
  // ElevationRenderer reads gidHeights from elevationConfig to give ridge tiles
  // more height, producing a stepped peaked-roof profile.
  const footprints=[
    {x:4,  y:8,  fw:8, fh:5, wallGid:BLDG_WALL2},  // forge   — NW (stone)
    {x:23, y:8,  fw:6, fh:4, wallGid:BLDG_WALL1},  // bothán  — NE (wattle/daub)
    {x:5,  y:19, fw:6, fh:4, wallGid:BLDG_WALL1},  // cabin   — SW (wattle/daub)
    {x:24, y:20, fw:4, fh:3, wallGid:BLDG_WALL3},  // shed    — SE (timber)
  ]
  for(const f of footprints){
    for(let dy=0;dy<f.fh;dy++) for(let gx=f.x;gx<f.x+f.fw;gx++){
      const gy=f.y+dy
      if(!inB(gx,gy)) continue
      base[gy][gx]    = bldgGid(dy, f.fh, f.wallGid)
      overlay[gy][gx] = 0
    }
  }

  // Scatter only on clear grass, avoiding footprints + 1-tile apron
  for(let gy=2;gy<H-2;gy++) for(let gx=2;gx<W-2;gx++){
    const near=footprints.some(f=>gx>=f.x-1&&gx<=f.x+f.fw&&gy>=f.y-1&&gy<=f.y+f.fh)
    if(!near && !([BLDG_THATCH1,BLDG_THATCH2,BLDG_WALL1,BLDG_WALL2,BLDG_WALL3].includes(base[gy][gx]))){
      if(rng()<0.04) overlay[gy][gx]=BUSHES[Math.floor(rng()*BUSHES.length)]
      else if(rng()<0.03) overlay[gy][gx]=FLOWERS[Math.floor(rng()*FLOWERS.length)]
    }
  }

  const {exits,entries}=makeExitEntry(exits_def)
  for(const dir of Object.keys(exits_def)) clearOverlayCorridor(overlay,dir)
  const map=buildMap(name,base,overlay,exits,entries,{x:MID,y:H-6})
  map.hasCliffs=true
  // Stored as arrays (JSON-safe); scene converts to Sets and passes to ElevationRenderer
  map.elevationConfig={
    cliffFaceGid: BLDG_WALL1,   // fallback face gid (not used for side faces in new system)
    elevatedGids: [BLDG_THATCH1, BLDG_THATCH2, BLDG_WALL1, BLDG_WALL2, BLDG_WALL3],
    cliffSouth:   [GRASS[0], GRASS[1]],
    cliffHeight:  1.5,           // default (eave/wall height)
    gidHeights: {                // per-GID overrides — ridge is 40% taller
      [BLDG_THATCH1]: 1.5,
      [BLDG_THATCH2]: 2.1,      // ridge peak
      [BLDG_WALL1]:   1.5,
      [BLDG_WALL2]:   1.5,
      [BLDG_WALL3]:   1.5,
    },
    // Custom tile asset paths — loaded by scene via pgr.registerCustomTile()
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
function genFields(name, exits_def, rng) {
  const base=Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>(x+y)%2===0?GRASS[0]:GRASS[1]))
  const overlay=make2D(W,H,0)
  // Placeholder: open grass with light scatter — cultivated field strips to come
  for(let y=2;y<H-2;y++) for(let x=2;x<W-2;x++){
    if(rng()<0.05) overlay[y][x]=BUSHES[Math.floor(rng()*BUSHES.length)]
  }
  const {exits,entries}=makeExitEntry(exits_def)
  for(const dir of Object.keys(exits_def)) clearOverlayCorridor(overlay,dir)
  return buildMap(name,base,overlay,exits,entries,{x:MID,y:MID})
}

// ── Forest maze generator ─────────────────────────────────────────────────────
function genForestMaze(name, exits_def, rng, opts={}) {
  const cfg={density:opts.density||0.48, passes:opts.passes||3, birth:opts.birth||5, survive:opts.survive||3}
  const forest=forestCA(cfg,null,rng)
  // Carve exit corridors
  const DEPTH=7,HALF=2
  for(const dir of Object.keys(exits_def)) clearCorridor(forest,dir,MID,MID,DEPTH,HALF)
  // Enforce solid perimeter then re-punch exits
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
  // Stone circle for d2
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
  return buildMap(name,base,overlay,exits,entries,spawn)
}

// ── River map generator ───────────────────────────────────────────────────────
function genRiver(name, exits_def, rng, opts={}) {
  // River flows west→east across the map at approx MID height
  const entryY = opts.riverEntryY ?? MID
  const exitYHint = opts.riverExitYHint ?? null
  const {water,westY,eastY} = buildRiver(rng, entryY, exitYHint)

  // Light forest on banks
  const forestCfg={density:0.35,passes:2,birth:5,survive:3}
  const forest=forestCA(forestCfg,water,rng)
  // Never let trees grow in or beside water (incl. the shallow margin)
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    if(!forest[y][x]) continue
    let nearWater=false
    for(let dy=-1;dy<=1&&!nearWater;dy++) for(let dx=-1;dx<=1;dx++)
      if(getG(water,x+dx,y+dy,false)){nearWater=true;break}
    if(nearWater) forest[y][x]=false
  }
  // Clear corridors at exits — east/west follow the river, north/south at MID
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
  // Perimeter enforcement can re-add forest beside the river mouth on rows
  // opened by the opposite bank's exit band — strip near-water forest again
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    if(!forest[y][x]) continue
    let nearWater2=false
    for(let dy=-1;dy<=1&&!nearWater2;dy++) for(let dx=-1;dx<=1;dx++)
      if(getG(water,x+dx,y+dy,false)){nearWater2=true;break}
    if(nearWater2) forest[y][x]=false
  }
  const base=buildGrassBase(water)
  const treeLayer=buildTreeLayer(forest,false)
  // Merge: water overlay on top of trees for water, trees elsewhere
  const overlay=make2D(W,H,0)
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    overlay[y][x]=waterOverlay[y][x]||treeLayer[y][x]
  }
  scatterDetail(overlay,forest,water,rng)
  const {exits,entries}=makeRiverExitEntry(exits_def,{west:westY,east:eastY})
  // Spawn on north bank near east (arrival side)
  const spawnX = exits_def.east ? W-5 : (exits_def.west ? 4 : MID)
  const spawnY = Math.max(2, (exits_def.east||exits_def.west ? entries[Object.keys(exits_def)[0]]?.y??MID : MID) - 3)
  return {
    ...buildMap(name,base,overlay,exits,entries,{x:spawnX,y:spawnY}),
    streamEdges:{west:westY, east:eastY}
  }
}

// ── Map assembler ─────────────────────────────────────────────────────────────
function buildMap(name,base,overlay,exits,entries,spawn) {
  return {
    name, width:W, height:H,
    layers:[base,overlay],
    legend:{'0':'overlay','732':'grass','733':'bog','839':'grass','840':'grass',
            '731':'waterside','1625':'water','1679':'water'},
    spawns:{player:spawn},
    exits, entries
  }
}

function addBorder(map) {
  const W=map.width, H=map.height
  const HALF=2  // half-width of exit corridor (matches exit tiles)
  const layer0=map.layers[0]
  const layer1=map.layers[1]

  // Build set of exit corridor positions on each edge
  const openCols = new Set()  // x values open on north/south edges
  const openRows = new Set()  // y values open on east/west edges

  for (const [dir, ex] of Object.entries(map.exits||{})) {
    for (const [tx,ty] of ex.tiles) {
      if (dir==='north'||dir==='south') openCols.add(tx)
      if (dir==='east' ||dir==='west')  openRows.add(ty)
    }
  }

  // Blank out border ring except at exit corridors
  for (let x=0;x<W;x++) {
    // Top edge (north border)
    if (!openCols.has(x)) {
      layer0[0][x]=0
      if (layer1[0]) layer1[0][x]=0
    }
    // Bottom edge (south border)
    if (!openCols.has(x)) {
      layer0[H-1][x]=0
      if (layer1[H-1]) layer1[H-1][x]=0
    }
  }
  for (let y=0;y<H;y++) {
    // Left edge (west border)
    if (!openRows.has(y)) {
      layer0[y][0]=0
      if (layer1[y]) layer1[y][0]=0
    }
    // Right edge (east border)
    if (!openRows.has(y)) {
      layer0[y][W-1]=0
      if (layer1[y]) layer1[y][W-1]=0
    }
  }

  // Store border info for collision detection in scene
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
console.log('\nGenerating Corra grid (4×4 bog + b0 village)...\n')

// River row generated east→west so we can chain stream Y values
// d3 first, then c3 uses d3's westY as its eastY, etc.
console.log('Row 3 — river maps (chained east→west):')
const d3rng=seededRng('d3'), d3=genRiver('d3',{west:'c3',north:'d2',south:'d4',east:'d3Sea'},d3rng,{riverEntryY:MID})
writeMap(d3)
const c3rng=seededRng('c3'), c3=genRiver('c3',{west:'b3',east:'d3',north:'c2',south:'c4'},c3rng,{riverEntryY:d3.streamEdges?.west??MID, riverExitYHint:d3.streamEdges?.west??MID})
writeMap(c3)
const b3rng=seededRng('b3'), b3=genRiver('b3',{west:'a3',east:'c3',north:'b2',south:'b4'},b3rng,{riverEntryY:c3.streamEdges?.west??MID, riverExitYHint:c3.streamEdges?.west??MID})
writeMap(b3)
const a3rng=seededRng('a3'), a3=genRiver('a3',{north:'a2',east:'b3',south:'a4'},a3rng,{riverEntryY:b3.streamEdges?.west??MID, riverExitYHint:b3.streamEdges?.west??MID})
writeMap(a3)

console.log('\nRow 0 — village:')
writeMap(genVillage('b0',{south:'b1'},seededRng('b0')))

console.log('\nRow 1 — fields/forest:')
writeMap(genForestMaze('a1',{east:'b1',south:'a2'},seededRng('a1'),{density:0.52}))
writeMap(genFields('b1',{west:'a1',east:'c1',south:'b2',north:'b0'},seededRng('b1')))
writeMap(genForestMaze('c1',{west:'b1',east:'d1',south:'c2'},seededRng('c1')))
writeMap(genForestMaze('d1',{west:'c1',south:'d2'},seededRng('d1')))

console.log('\nRow 2 — transitional forest:')
writeMap(genOpenBog('a2',{north:'a1',east:'b2',south:'a3'},seededRng('a2')))
writeMap(genForestMaze('b2',{north:'b1',west:'a2',east:'c2',south:'b3'},seededRng('b2')))
writeMap(genForestMaze('c2',{north:'c1',west:'b2',east:'d2',south:'c3'},seededRng('c2')))
writeMap(genForestMaze('d2',{north:'d1',west:'c2',south:'d3'},seededRng('d2'),{stoneCircle:true}))

console.log('\nRow 4 — druid forest (dark, dense):')
writeMap(genForestMaze('a4',{north:'a3',east:'b4'},seededRng('a4'),{density:0.58,dark:true}))
writeMap(genForestMaze('b4',{north:'b3',west:'a4',east:'c4'},seededRng('b4'),{density:0.56,dark:true}))
writeMap(genForestMaze('c4',{north:'c3',west:'b4',east:'d4'},seededRng('c4'),{density:0.56,dark:true}))
writeMap(genForestMaze('d4',{north:'d3',west:'c4'},seededRng('d4'),{density:0.58,dark:true}))

console.log('\nDone. 17 maps written to public/maps/bogMaps/')
console.log('Enable exit debug: window._devExits = true in browser console')

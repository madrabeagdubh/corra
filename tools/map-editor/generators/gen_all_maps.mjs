/**
 * gen_all_maps.mjs
 * Generates all 17 grid maps (4×4 bog grid + b0 village) and writes them
 * to public/maps/bogMaps/
 *
 * ── This revision: open borders + shared forest continuity (a1-d3 only) ─────
 * The 12 maps a1-d3 (rows 1-3) now:
 *   - Sample ONE shared tree-cluster field (_clusterShared.mjs) instead of
 *     independent per-map placement, so forest continues naturally across
 *     shared seams instead of two unrelated fields coincidentally meeting
 *     at an edge. a2 (previously genOpenBog -- rocks/cobwebs, no real
 *     thematic tie to its neighbours) is now forest too, matching a1/a3.
 *   - Write trunks directly as wallMask + baked heightMap root-peaks (via
 *     _treeShared.mjs), NOT GID tile stamps -- the old buildTreeLayer/
 *     Oryx-stamp approach is fully retired for these maps; nothing in the
 *     live game has rendered Oryx tree stamps since migrate_oryx_trees.mjs.
 *   - Have FULLY OPEN internal borders (every shared edge among the 12
 *     spans its whole width, not a 5-tile exit slice) EXCEPT:
 *       - b1's north edge (into b0, village -- untouched)
 *       - row3's south edge (into row4 -- deliberately left narrow/closed;
 *         row4 is planned as a separate, more restricted "druid forest"
 *         area, not opened up this pass)
 *       - row3's own east/west river-crossings (already have their own
 *         water-following wide-bank-corridor logic via streamEdges
 *         chaining -- a literal river is a more meaningful "restriction"
 *         than an arbitrary wall, so left as-is rather than forced fully
 *         open)
 *       - d3's east edge (into d3Sea -- separate system, untouched)
 *     xFromSource entry logic (perspectiveScene.js applyEntryPosition) is
 *     required for the new north/south open edges to work correctly --
 *     see that file's own changes.
 *   - Carry the village-to-river path (b0->b1->c1->c2->[c3]) with a mud-
 *     tint blend (TintManager.getGroundTint's pathDist input) and a
 *     tree-free corridor, wandering freely now that it can cross full-
 *     width open borders rather than threading a narrow slot. The path
 *     stops short of adding explicit corridor data to c3 itself (a river
 *     map with its own complex water-avoiding terrain) -- it hands off
 *     naturally through c3's now-open north edge onto that map's existing
 *     walkable riverbank.
 *
 * row4 (a4-d4, dark druid forest), b0 (village), and the sea maps are
 * UNCHANGED by this revision.
 *
 * Usage (from ~/Corra):
 *   node tools/map-editor/generators/gen_all_maps.mjs
 */

import { writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

import { buildTrunkPositions, applyRootPeaksToHeightMap } from './_treeShared.mjs'
import { buildPathWaypoints, buildPathDistGrid, carvePathCorridor } from './_pathShared.mjs'
import { buildSharedClusterField, sampleLocalWallMask } from './_clusterShared.mjs'

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

// Deterministic per-cell hash for south-bank thinning (genRiver) -- same
// family as the hashes used elsewhere in the codebase for per-tile
// variation. Doesn't need cross-map seam agreement the way
// _clusterShared.mjs's hash does (south-bank thinning is a per-map
// cosmetic reduction, not a continuity concern), but kept deterministic
// anyway for reproducible output.
function _riverBankHash(gx, gy) {
  let h = (gx * 374761393 + gy * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = (h ^ (h >>> 16)) >>> 0
  return h / 0xffffffff
}

// ── Shared height map (UNCHANGED -- still spans the full 4x4 grid, since
// row4 still needs seamless elevation continuity with row3 even though
// it's untouched by the forest/border work this pass) ───────────────────────
const GRID_COLS  = 4
const GRID_ROWS  = 4
const VW         = GRID_COLS * W + 1   // 145
const VH         = GRID_ROWS * H + 1   // 145
const HEIGHT_AMP = 3

function buildSharedHeightMap() {
  function cornerHash(gx, gy) {
    let s = (gx * 374761393 + gy * 1103515245) | 0
    s = Math.imul((s ^ (s >>> 16)), 0x45d9f3b)
    s = Math.imul((s ^ (s >>> 16)), 0x45d9f3b)
    return ((s ^ (s >>> 16)) & 0xffff) / 0xffff
  }
  function valueNoise(nx, ny, scale) {
    const gx0 = Math.floor(nx * scale), gy0 = Math.floor(ny * scale)
    const gx1 = gx0 + 1,               gy1 = gy0 + 1
    const fx  = nx * scale - gx0,      fy  = ny * scale - gy0
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
  const raw = new Array(VW * VH)
  for (let vy = 0; vy < VH; vy++) {
    for (let vx = 0; vx < VW; vx++) {
      let v = 0
      for (const { scale, amp } of octaves) {
        v += (valueNoise(vx, vy, scale) * 2 - 1) * amp
      }
      v /= totalAmp
      raw[vy * VW + vx] = +Math.max(0, Math.min(HEIGHT_AMP, v * HEIGHT_AMP)).toFixed(4)
    }
  }
  return raw
}
const SHARED_HM = buildSharedHeightMap()

function sliceHeightMap(gridX, gridY) {
  const ox = gridX * W
  const oy = gridY * H
  const rows = []
  for (let dy = 0; dy <= H; dy++) {
    const row = []
    for (let dx = 0; dx <= W; dx++) {
      const vx = ox + dx
      const vy = oy + dy
      const cvx = Math.max(0, Math.min(VW - 1, vx))
      const cvy = Math.max(0, Math.min(VH - 1, vy))
      row.push(SHARED_HM[cvy * VW + cvx])
    }
    rows.push(row)
  }
  return rows
}

// ── Shared tree-cluster field (NEW -- rows 1-3 only, i.e. a1-d3; row4 is
// untouched and keeps its own independent dense/dark forestCA below) ────────
const CLUSTER_GRID_ROWS = 3
const CLUSTER_CFG = {
  gridCols: GRID_COLS, gridRows: CLUSTER_GRID_ROWS, mapW: W, mapH: H,
  clustersPerMap: 9, clusterMinRadius: 1.5, clusterMaxRadius: 3.0,
  clusterPeakChance: 0.4, strayTreeChance: 0.01,
}
const CLUSTER_FIELD = buildSharedClusterField(CLUSTER_CFG, seededRng('sharedForestClusters'))

// ── Tile GIDs ─────────────────────────────────────────────────────────────────
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

// GID stamps below are ONLY used by row4's genForestMaze (dark druid
// forest, untouched this pass) -- rows 1-3 no longer use tile-stamp trees
// at all (see header note).
const OAK  = {TL:260,TC:261,TR:262,ML:314,MC:315,MR:316,BL:368,BC:369,BR:370}
const BOG_TREE = {TL:263,TC:264,TR:265,ML:317,MC:318,MR:319,BL:371,BC:372,BR:373}

const BLDG_THATCH1 = 3001
const BLDG_THATCH2 = 3002
const BLDG_WALL1   = 3011
const BLDG_WALL2   = 3012
const BLDG_WALL3   = 3013

// ── Forest CA (row4 / dark druid forest ONLY -- see genForestMazeDark) ──────
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
  // NOTE: no bush/flower scatter here any more -- strip_ground_clutter.mjs
  // deliberately removed GIDs 44/45/48/98/100 project-wide so they can be
  // reintroduced later as deliberate collectible objects, not randomised
  // decoration tiles. This function now only scatters non-clutter detail
  // (kept for row4/river use where rocks/withered singles are still fine).
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    if(overlay[y][x]||( forest&&forest[y][x])||(water&&water[y][x])) continue
    if(water){
      let nearWater=false
      for(let dy=-1;dy<=1&&!nearWater;dy++) for(let dx=-1;dx<=1;dx++)
        if(getG(water,x+dx,y+dy,false)){nearWater=true;break}
      if(nearWater) continue
    }
    // intentionally no-op for now -- see note above
  }
}

// ── Exit/entry builders ───────────────────────────────────────────────────────
const MID = 17

// Legacy narrow (5-tile) exit -- still used for: b1's north edge (into
// b0), row3's south edge (into row4), and anywhere else not part of this
// pass's open-border set.
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

// NEW -- full-width open-border exit. Spans the entire edge (minus the
// two literal corner tiles, same as any map corner). xFromSource/
// yFromSource means a crossing anywhere along the edge lands at the
// CORRESPONDING point on the far side, not recentred to the middle --
// needs the matching applyEntryPosition() support in perspectiveScene.js.
function makeOpenExitEntry(dir, dest) {
  let tiles, entryPoint, entry
  if (dir === 'west') {
    tiles = Array.from({ length: H - 2 }, (_, i) => [0, i + 1])
    entryPoint = 'east'; entry = { x: 4, yFromSource: true }
  } else if (dir === 'east') {
    tiles = Array.from({ length: H - 2 }, (_, i) => [W - 1, i + 1])
    entryPoint = 'west'; entry = { x: W - 4, yFromSource: true }
  } else if (dir === 'north') {
    tiles = Array.from({ length: W - 2 }, (_, i) => [i + 1, 0])
    entryPoint = 'south'; entry = { y: 4, xFromSource: true }
  } else {
    tiles = Array.from({ length: W - 2 }, (_, i) => [i + 1, H - 1])
    entryPoint = 'north'; entry = { y: H - 4, xFromSource: true }
  }
  return { exit: { tiles, destination: dest, entryPoint }, entry }
}

/**
 * Builds exits/entries for a map given a per-direction mode map, e.g.
 *   { east: ['open','c1'], south: ['narrow','a2'], north: null }
 * Mixes makeOpenExitEntry and the narrow single-direction logic from
 * makeExitEntry as needed, since most of the 12 maps have SOME open and
 * SOME narrow (or absent) edges.
 */
function buildMixedExitEntry(dirModes) {
  const exits = {}, entries = {}
  const HALF = 2
  for (const [dir, spec] of Object.entries(dirModes)) {
    if (!spec) continue
    const [mode, dest] = spec
    if (mode === 'open') {
      const { exit, entry } = makeOpenExitEntry(dir, dest)
      exits[dir] = exit; entries[dir] = entry
    } else {
      // narrow, single-direction (reuses makeExitEntry's per-dir shape)
      const { exits: e1, entries: n1 } = makeExitEntry({ [dir]: dest })
      exits[dir] = e1[dir]; entries[dir] = n1[dir]
    }
  }
  return { exits, entries }
}

const RIVER_EDGE_HALF = 4
const BANK_ROWS       = 3

// River exits: east/west keep their existing water-following wide-bank
// corridor (unchanged -- a literal river is a more meaningful edge than
// an arbitrary wall). North becomes fully open (openNorth=true, for the
// row2->row3 boundary); south stays narrow (row3->row4, deliberately
// closed this pass).
function makeRiverExitEntry(exits_def, riverYs, openNorth=false) {
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
      if (openNorth) {
        const { exit, entry } = makeOpenExitEntry('north', dest)
        exits[dir] = exit; entries[dir] = entry
      } else {
        exits[dir]={tiles:[[MID-HALF,1],[MID-1,1],[MID,1],[MID+1,1],[MID+HALF,1]],
                    destination:dest, entryPoint:'south'}
        entries[dir]={x:MID, y:4, yFromSource:false}
      }
    } else {
      exits[dir]={tiles:[[MID-HALF,H-2],[MID-1,H-2],[MID,H-2],[MID+1,H-2],[MID+HALF,H-2]],
                  destination:dest, entryPoint:'north'}
      entries[dir]={x:MID, y:H-4, yFromSource:false}
    }
  }
  return {exits,entries}
}

// ── River stream helper (UNCHANGED) ──────────────────────────────────────────
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
  return {water, westY:centres[0], eastY:centres[W-1], centres}
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

// ── Open bog generator (RETIRED for a2 -- kept only in case another map
// wants this style later; a2 now uses genForestMazeShared) ─────────────────
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

// ── Village (b0) -- UNCHANGED ────────────────────────────────────────────────
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

// ── Fields approach (b1) -- UNCHANGED except no clutter scatter (see
// strip_ground_clutter.mjs note above); b1 has no wallMask/trees at all ────
function genFields(name, dirModes, rng, gridX, gridY, pathSpec=null) {
  const base=Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>(x+y)%2===0?GRASS[0]:GRASS[1]))
  const overlay=make2D(W,H,0)
  const wallMask=make2D(W,H,0)

  let pathDist = null
  if (pathSpec) {
    const waypoints = buildPathWaypoints(pathSpec.x0, pathSpec.y0, pathSpec.x1, pathSpec.y1, pathSpec.opts)
    const distGrid  = buildPathDistGrid(waypoints, W, H)
    pathDist = carvePathCorridor(wallMask, distGrid, W, H, { halfWidth: 3, tintFalloff: 7 })
  }

  const {exits,entries} = buildMixedExitEntry(dirModes)
  const map = buildMap(name,base,overlay,exits,entries,{x:MID,y:H-6},gridX,gridY)
  map.wallMask = wallMask
  if (pathDist) map.pathDist = pathDist
  return map
}

// ── Forest maze generator -- SHARED-CLUSTER version, for a1/c1/d1/a2/b2/c2/d2 ─
// Writes trunks directly as wallMask + baked heightMap root-peaks, NOT GID
// stamps. Optionally carries a path corridor (village-to-river route).
function genForestMazeShared(name, dirModes, gridX, gridY, pathSpec=null) {
  const wallMask = sampleLocalWallMask(CLUSTER_FIELD, gridX, gridY, CLUSTER_CFG)

  // Spawn is always map-centre for these maps. Unlike the old maze
  // generator (which force-cleared a corridor that always included the
  // spawn point), sparse random clusters have no such guarantee -- a
  // cluster could occasionally land right on (MID,MID). Force-clear a
  // small radius BEFORE baking trunk positions, so no ghost root-peak
  // survives under a spawn that's already guaranteed walkable.
  const SPAWN_CLEAR_RADIUS = 2
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (Math.hypot(x - MID, y - MID) <= SPAWN_CLEAR_RADIUS) wallMask[y][x] = 0
    }
  }

  let pathDist = null
  if (pathSpec) {
    const waypoints = buildPathWaypoints(pathSpec.x0, pathSpec.y0, pathSpec.x1, pathSpec.y1, pathSpec.opts)
    const distGrid  = buildPathDistGrid(waypoints, W, H)
    pathDist = carvePathCorridor(wallMask, distGrid, W, H, { halfWidth: 3, tintFalloff: 7 })
  }

  const heightMap = sliceHeightMap(gridX, gridY)
  const trunkPositions = buildTrunkPositions(wallMask, W, H)
  const mutated = applyRootPeaksToHeightMap(heightMap, trunkPositions)
  console.log(`  ${name}: ${trunkPositions.length} trunk positions, ${mutated} heightMap vertices raised`)

  const base = buildGrassBase(null)
  const overlay = make2D(W, H, 0)

  const {exits,entries} = buildMixedExitEntry(dirModes)

  // Spawn: prefer the middle of whichever edge has an entry hint, else map centre.
  const spawn = { x: MID, y: MID }

  const map = buildMap(name, base, overlay, exits, entries, spawn, gridX, gridY)
  map.wallMask  = wallMask
  map.heightMap = heightMap
  if (pathDist) map.pathDist = pathDist
  return map
}

// ── Forest maze generator -- DARK/DENSE version, row4 ONLY, UNCHANGED ───────
// (still uses forestCA + GID tile stamps -- row4 is a separate future
// development, per plan, not touched this pass)
function genForestMazeDark(name, exits_def, rng, opts={}, gridX=0, gridY=0) {
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

// ── River map generator -- open-north variant for row3 ──────────────────────
function genRiver(name, exits_def, rng, opts={}, gridX=0, gridY=0) {
  const entryY = opts.riverEntryY ?? MID
  const exitYHint = opts.riverExitYHint ?? null
  const {water,westY,eastY,centres} = buildRiver(rng, entryY, exitYHint)

  // Bankside forest now samples the SAME shared cluster field the other
  // 8 forest maps use (already dimensioned to cover row 3) instead of an
  // independent dense CA. The old CA (density:0.35) was tuned back when
  // trees were static GID stamps -- once every bordering wallMask cell
  // renders a full trunk+canopy, that density became far too dense
  // (slowdown, and the south bank -- closest to the camera in this view
  // -- became visually overwhelming). South bank gets extra thinning on
  // top of the shared field, since it's both the performance-heaviest
  // and the most visually obstructive side.
  let forest = sampleLocalWallMask(CLUSTER_FIELD, gridX, gridY, CLUSTER_CFG)
  const SOUTH_BANK_KEEP_CHANCE = 0.35
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    if(!forest[y][x]) continue
    let nearWater=false
    for(let dy=-1;dy<=1&&!nearWater;dy++) for(let dx=-1;dx<=1;dx++)
      if(getG(water,x+dx,y+dy,false)){nearWater=true;break}
    if(nearWater){ forest[y][x]=0; continue }
    if (y > centres[x] && _riverBankHash(gridX*1000+x, gridY*1000+y) > SOUTH_BANK_KEEP_CHANCE) {
      forest[y][x] = 0
    }
  }
  const DEPTH=7,HALF=2
  const corridorY = dir => dir==='west' ? westY : dir==='east' ? eastY : MID
  for(const dir of Object.keys(exits_def)){
    if (dir === 'north' && opts.openNorth) continue   // handled as a full-width clear below, not a narrow corridor
    clearCorridor(forest,dir,corridorY(dir),MID,DEPTH,RIVER_EDGE_HALF+BANK_ROWS)
  }
  // Perimeter solid FIRST (same order as the original), THEN clear exit
  // corridors -- reversing this order would let the perimeter pass
  // silently undo the corridor clearing done above.
  for(let x=0;x<W;x++){forest[0][x]=true;forest[H-1][x]=true}
  for(let y=0;y<H;y++){forest[y][0]=true;forest[y][W-1]=true}
  for(const dir of Object.keys(exits_def)){
    if(dir==='west'||dir==='east'){
      const cy=corridorY(dir)
      for(let o=-RIVER_EDGE_HALF-BANK_ROWS;o<=RIVER_EDGE_HALF;o++){
        if(dir==='west'&&inB(0,cy+o))   forest[cy+o][0]=false
        if(dir==='east'&&inB(W-1,cy+o)) forest[cy+o][W-1]=false
      }
    } else if (dir === 'north' && opts.openNorth) {
      for (let x = 0; x < W; x++) forest[0][x] = false   // whole north row walkable
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

  // Bankside forest now uses the SAME wallMask + baked root-peak system as
  // the other 8 forest maps -- the `forest` CA grid above already avoids
  // water correctly, it just needs to stop being rendered as GID tile
  // stamps (buildTreeLayer/OAK) and become real wallMask + trunk data
  // instead, so ForestEffects renders it with correct occlusion like
  // everywhere else, and it no longer looks like old Oryx trees.
  const wallMask = forest.map(row => row.map(v => v ? 1 : 0))
  const heightMap = sliceHeightMap(gridX, gridY)
  const trunkPositions = buildTrunkPositions(wallMask, W, H)
  const mutated = applyRootPeaksToHeightMap(heightMap, trunkPositions)
  console.log(`  ${name}: ${trunkPositions.length} trunk positions, ${mutated} heightMap vertices raised`)

  const base=buildGrassBase(water)
  const overlay=make2D(W,H,0)
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    overlay[y][x]=waterOverlay[y][x]
  }
  const {exits,entries}=makeRiverExitEntry(exits_def,{west:westY,east:eastY}, opts.openNorth||false)
  const spawnX = exits_def.east ? W-5 : (exits_def.west ? 4 : MID)
  const spawnY = Math.max(2, (exits_def.east||exits_def.west ? entries[Object.keys(exits_def)[0]]?.y??MID : MID) - 3)

const map = buildMap(name, base, overlay, exits, entries, {x:spawnX, y:spawnY}, gridX, gridY)
map.wallMask   = wallMask
map.heightMap  = heightMap
map.streamEdges = { west:westY, east:eastY }
map.hasCliffs  = true
return map
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

console.log('Row 3 — river maps (chained east→west), north edges now OPEN into row 2:')
const d3rng=seededRng('d3'), d3=genRiver('d3',{west:'c3',north:'d2',south:'d4',east:'d3Sea'},d3rng,{riverEntryY:MID, openNorth:true},3,2)
writeMap(d3)
const c3rng=seededRng('c3'), c3=genRiver('c3',{west:'b3',east:'d3',north:'c2',south:'c4'},c3rng,{riverEntryY:d3.streamEdges?.west??MID, riverExitYHint:d3.streamEdges?.west??MID, openNorth:true},2,2)
writeMap(c3)
const b3rng=seededRng('b3'), b3=genRiver('b3',{west:'a3',east:'c3',north:'b2',south:'b4'},b3rng,{riverEntryY:c3.streamEdges?.west??MID, riverExitYHint:c3.streamEdges?.west??MID, openNorth:true},1,2)
writeMap(b3)
const a3rng=seededRng('a3'), a3=genRiver('a3',{north:'a2',east:'b3',south:'a4'},a3rng,{riverEntryY:b3.streamEdges?.west??MID, riverExitYHint:b3.streamEdges?.west??MID, openNorth:true},0,2)
writeMap(a3)

console.log('\nRow 0 — village (unchanged):')
writeMap(genVillage('b0',{south:'b1'},seededRng('b0'),1,0))

console.log('\nRow 1 — forest (shared clusters, open internal borders) + b1 fields/path:')
writeMap(genForestMazeShared('a1', { east:['open','b1'], south:['open','a2'] }, 0, 0))
writeMap(genFields('b1',
  { west:['open','a1'], east:['open','c1'], south:['open','b2'], north:['narrow','b0'] },
  seededRng('b1'), 1, 0,
  { x0: MID, y0: 0, x1: W - 1, y1: MID, opts: { wobbleAmp: 3, wobbleFreq: 1.0, samples: 20, seed: 0.4 } }
))
writeMap(genForestMazeShared('c1',
  { west:['open','b1'], east:['open','d1'], south:['open','c2'] }, 2, 0,
  { x0: 0, y0: MID, x1: MID, y1: H - 1, opts: { wobbleAmp: 4, wobbleFreq: 1.2, samples: 24, seed: 1.7 } }
))
writeMap(genForestMazeShared('d1', { west:['open','c1'], south:['open','d2'] }, 3, 0))

console.log('\nRow 2 — forest (shared clusters, open internal borders); a2 converted from open-bog:')
writeMap(genForestMazeShared('a2', { north:['open','a1'], east:['open','b2'], south:['open','a3'] }, 0, 1))
writeMap(genForestMazeShared('b2', { north:['open','b1'], west:['open','a2'], east:['open','c2'], south:['open','b3'] }, 1, 1))
writeMap(genForestMazeShared('c2',
  { north:['open','c1'], west:['open','b2'], east:['open','d2'], south:['open','c3'] }, 2, 1,
  { x0: MID, y0: 0, x1: MID, y1: H - 1, opts: { wobbleAmp: 4, wobbleFreq: 1.3, samples: 24, seed: 2.3 } }
))
writeMap(genForestMazeShared('d2', { north:['open','d1'], west:['open','c2'], south:['open','d3'] }, 3, 1))

console.log('\nRow 4 — druid forest (dark, dense) -- UNCHANGED, still narrow/closed edges:')
writeMap(genForestMazeDark('a4',{north:'a3',east:'b4'},seededRng('a4'),{density:0.58,dark:true},0,3))
writeMap(genForestMazeDark('b4',{north:'b3',west:'a4',east:'c4'},seededRng('b4'),{density:0.56,dark:true},1,3))
writeMap(genForestMazeDark('c4',{north:'c3',west:'b4',east:'d4'},seededRng('c4'),{density:0.56,dark:true},2,3))
writeMap(genForestMazeDark('d4',{north:'d3',west:'c4'},seededRng('d4'),{density:0.58,dark:true},3,3))

console.log('\nDone. 17 maps written to public/maps/bogMaps/')
console.log('Enable exit debug: window._devExits = true in browser console')

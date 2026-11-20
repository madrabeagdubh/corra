// skyIsland.js -- the far land seen from the sky's courtyard: Tír na nÓg across the western sea. One island, a Gaelic-Norman stronghold
// at peace after a thousand years: a tower house with its stepped battlements, a hall with every window lit, round-towered walls, an abbey
// with its round tower and high cross, orchards, fields and a mill, a harbour with hookers and curraghs; to the left a rugged sea-arch with a
// beast of the Book of Kells cut shallow into its seaward face, one eye alight. Nearer: the round tower, the standing stones, the passage-grave,
// the wall, the thorn, the cottage -- and a few people about their evening.
// Drawn once, to a canvas. paintScene(x, {W, H, HZ, near}) -> { skyline(X), hill(X) }. HZ is where the horizon falls in the canvas.

function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

export function paintScene(x, { W, H, HZ: HZ_ACTUAL, near = true, layer = 'all', skyRGB = [52, 53, 79] }) {
  const dy = HZ_ACTUAL - H * 0.70, HZ = H * 0.70                      // (everything is drawn for a horizon at 70% and slid to where the court's horizon is)
  // a layer ('far': mountains and sea; 'mid': the islands and the ships; 'arch') is painted on a canvas wider than the screen, MG
  // to each side, so that it can slide; the whole scene runs for each, and what is not its own is muted (only paint is dropped)
  const MG = 0, PW = layer === 'all' ? W : W * 2          // (a layer is a tile PW wide that the game repeats left and right)
  let mute = false, curL = 'far'
  const PAINT = new Set(['fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'strokeText', 'drawImage'])
  x = new Proxy(x, { get(t, p) { const v = t[p]; return typeof v === 'function' ? (PAINT.has(p) ? (...a) => { if (!mute) v.apply(t, a) } : v.bind(t)) : v }, set(t, p, v) { t[p] = v; return true } })
  const LAY = (n) => { mute = !(layer === 'all' || layer === n); curL = n }
  x.save(); x.translate(MG, dy)
  // the things that move, named for the game to animate (design coordinates, the layer they belong to): fires, smoke, lamps, birds, the eye
  const BASE = x.getTransform(), anim = { far: [], mid: [], arch: [], boats: [] }
  const A = (kind, X, Y, a = {}) => { if (layer !== 'all') anim[curL].push({ kind, X, Y, ...a }) }
const rnd=mulberry(21),R=mulberry(5)
const poly=(f,n,fill)=>{x.beginPath();x.moveTo(0,H);for(let i=0;i<=n;i++){const X=W*i/n;x.lineTo(X,f(X))}x.lineTo(W,H);x.closePath();x.fillStyle=fill;x.fill()}
const light=cb=>{x.save();x.globalCompositeOperation='lighter';cb();x.restore()}
const nz=(s)=>{const p=[R()*6,R()*6,R()*6],f=[1,2.3,5.1];return u=>(Math.sin(u*f[0]*3+p[0])*0.5+Math.sin(u*f[1]*3+p[1])*0.3+Math.sin(u*f[2]*3+p[2])*0.2)}
LAY('far')
const rimg=x.createLinearGradient(0,HZ-H*0.2,0,HZ);rimg.addColorStop(0,'rgba(120,100,210,0)');rimg.addColorStop(1,'rgba(110,108,150,0)');x.fillStyle=rimg;x.fillRect(0,HZ-H*0.2,PW,H*0.2)
// ── the far land: small, far, solid: low mountains and foothills along a third of the horizon, only to say there is more beyond
const rg=(c0,c1,hMax,sh)=>{const n1=nz(1),n2=nz(2);const f1=X=>{const u=(X-c0)/(c1-c0);if(u<=0||u>=1)return HZ+1;const env=Math.pow(Math.sin(Math.PI*u),0.8),r=1-Math.abs(n1(X*0.011+c0));return HZ-hMax*env*(0.42+0.58*Math.pow(Math.max(0,r),sh))-hMax*0.05*n2(X*0.09)*env};return X=>Math.min(f1(X),f1(X-PW))}
const RANGES=[
  {f:rg(-W*0.30,W*0.40,H*0.018,2.2),c:[`rgb(${skyRGB})`,`rgb(${skyRGB})`]},
  {f:rg(-W*0.34,W*0.30,H*0.011,1.8),c:[`rgb(${skyRGB})`,`rgb(${skyRGB})`]},
  {f:rg(-W*0.36,W*0.50,H*0.005,1.3),c:[`rgb(${skyRGB})`,`rgb(${skyRGB})`]}]
const mtnTop=X=>{let m=HZ;for(const r of RANGES)m=Math.min(m,r.f(X));return m}
for(const r of RANGES){const g=x.createLinearGradient(0,HZ-H*0.04,0,HZ+1);g.addColorStop(0,r.c[0]);g.addColorStop(1,r.c[1]);x.fillStyle=g
  x.beginPath();x.moveTo(0,HZ+1);for(let X=0;X<=PW;X+=2)x.lineTo(X,Math.min(HZ+1,r.f(X)));x.lineTo(PW,HZ+1);x.closePath();x.fill()}
// ── the sea: deep violet, lit at the horizon, stroked with small waves, a path of gold light, sparkle
const sea=(lx)=>{const g=x.createLinearGradient(0,HZ,0,H*0.84);g.addColorStop(0,`rgb(${skyRGB})`);g.addColorStop(0.3,`rgb(${skyRGB.map(v=>v-3)})`);g.addColorStop(0.62,'#1a1d38');g.addColorStop(1,'#0e1024');x.fillStyle=g;x.fillRect(0,HZ,PW,H*0.3)
  const sr=mulberry(11);x.lineCap='round'
  if(lx>-1e8)light(()=>{for(let i=0;i<260;i++){const t=Math.pow(sr(),1.3),Y=HZ+2+t*H*0.12,spread=W*(0.05+t*0.25),X=lx+(sr()-0.5)*spread,w=2+sr()*16*(0.4+t);x.fillStyle=`rgba(255,${200+sr()*30|0},150,${0.03+sr()*0.09*(1-t*0.5)})`;x.fillRect(X-w/2,Y,w,0.8+t*0.5)}})}
const ripples=()=>{const sr=mulberry(9);x.lineCap='round'      // (the sea's ripples: on the arch's layer, so water and arch slide together)
  for(let i=0;i<520*PW/W;i++){const t=Math.pow(sr(),1.7),Y=HZ+1+t*H*0.14,w=3+t*26+sr()*8,X=-MG+sr()*(PW);x.strokeStyle=`rgba(${150+sr()*60|0},${160+sr()*50|0},230,${0.04+t*0.09})`;x.lineWidth=0.5+t*0.7;if(t<0.22)continue;x.beginPath();x.moveTo(X,Y);x.quadraticCurveTo(X+w/2,Y-0.8-t,X+w,Y);x.stroke()}}
// ── mist along a line
const mist=(Y,a=0.14,n=6)=>{const m=mulberry(Y|0);n=Math.round(n*PW/W);for(let i=0;i<n;i++){const X=-MG+m()*(PW),r=W*(0.12+m()*0.18);const g=x.createRadialGradient(X,Y,0,X,Y,r);g.addColorStop(0,`rgba(205,205,255,${a})`);g.addColorStop(1,'rgba(205,205,255,0)');for(const o of [-PW,0,PW]){x.save();x.translate(o,Y);x.scale(1,0.16);x.translate(0,-Y);x.fillStyle=g;x.fillRect(X-r,Y-r,r*2,r*2);x.restore()}}}
// ── Aran fields: small fields held by dry-stone walls, following the slope; limestone walls pale, the grass between dark
function fields(top,x0,x1,{rows=6,step=3,seed=3,alpha=1}={}){const sr=mulberry(seed);x.save();
  const cuts=Array.from({length:rows+1},(_,k)=>{const xs=[];let X=x0+sr()*8;while(X<x1){xs.push(X);X+=7+sr()*16}return xs})
  for(let k=0;k<rows;k++){const a=k*step*(0.8+k*0.12),b=(k+1)*step*(0.8+(k+1)*0.12);const xs=cuts[k]
    for(let i=0;i<xs.length-1;i++){const xa=xs[i],xb=xs[i+1];const ya=top(xa)+a,yb=top(xb)+a,yc=top(xb)+b,yd=top(xa)+b;if(top(xa)>HZ+1&&top(xb)>HZ+1)continue
      x.fillStyle=['rgba(70,110,95,','rgba(90,120,90,','rgba(58,92,92,','rgba(105,125,85,'][sr()*4|0]+(0.38*alpha).toFixed(2)+')';x.beginPath();x.moveTo(xa,ya);x.lineTo(xb,yb);x.lineTo(xb+(sr()-0.5)*3,yc);x.lineTo(xa+(sr()-0.5)*3,yd);x.closePath();x.fill()
      x.strokeStyle='rgba(205,210,190,'+(0.42*alpha).toFixed(2)+')';x.lineWidth=0.6;x.beginPath();x.moveTo(xa,ya);x.lineTo(xb,yb);x.moveTo(xa,ya);x.lineTo(xa+(sr()-0.5)*3,yd);x.stroke()}}
  x.restore()}
// the lit windows laid in the water below
const reflect=(wins,base=HZ)=>light(()=>{for(const [X,Y] of wins){const d=base-Y;for(let k=0;k<3;k++){x.fillStyle=`rgba(255,200,130,${0.22-k*0.06})`;x.fillRect(X-0.4+(R()-0.5)*1.5,base+1+d*0.55+k*3,1.1,2.2)}}})
// ── a waterfall off a sea-cliff into the sea, mist at its foot
function fall(X,Y0,Y1,w=1.6){const g=x.createLinearGradient(0,Y0,0,Y1);g.addColorStop(0,'rgba(225,238,255,0.8)');g.addColorStop(1,'rgba(225,238,255,0.35)');x.fillStyle=g;x.beginPath();x.moveTo(X-w/2,Y0);x.lineTo(X+w/2,Y0);x.lineTo(X+w*0.9,Y1);x.lineTo(X-w*0.9,Y1);x.closePath();x.fill()
  light(()=>{const m=x.createRadialGradient(X,Y1,0,X,Y1,9);m.addColorStop(0,'rgba(220,230,255,0.5)');m.addColorStop(1,'rgba(220,230,255,0)');x.fillStyle=m;x.save();x.translate(X,Y1);x.scale(1.6,0.7);x.translate(-X,-Y1);x.fillRect(X-9,Y1-9,18,18);x.restore()})}
// ── a curragh with a lantern, and its light in the water
function curragh(X,Y,s=1){A('boat',X,Y);A('lamp',X-1,Y-3,{r:9*s});x.save();x.beginPath();x.rect(X-12*s,Y-20*s,24*s,19.6*s);x.clip();x.fillStyle='#080c1c';x.beginPath();x.moveTo(X-7*s,Y-2*s);x.quadraticCurveTo(X,Y+3*s,X+7*s,Y-3*s);x.quadraticCurveTo(X,Y-0.5*s,X-7*s,Y-2*s);x.fill();x.restore();x.fillStyle='rgba(200,205,240,0.25)';x.fillRect(X-8*s,Y-0.3*s,16*s,0.5);x.fillRect(X+0.5*s,Y-6*s,0.7*s,4*s);x.fillStyle='rgba(255,200,120,1)';x.fillRect(X-1.5*s,Y-3.4*s,1.3*s,1.3*s);light(()=>{const g=x.createRadialGradient(X-1,Y-3,0,X-1,Y-3,9*s);g.addColorStop(0,'rgba(255,200,120,0.4)');g.addColorStop(1,'rgba(255,200,120,0)');x.fillStyle=g;x.fillRect(X-12*s,Y-12*s,24*s,18*s);x.fillStyle='rgba(255,200,120,0.3)';x.fillRect(X-2*s,Y+3*s,1.4*s,5*s)})}

// ───────────── v4 + v6, grown: a harbour town on a natural island, tall ships at anchor, a carved arch, a living shore
function isle(cx,w,h,pts,{col=['#46528f','#1a2050'],haze=0,seed=1,base=HZ+2}={}){
  const n=nz(seed),prof=u=>{if(u<=pts[0][0])return pts[0][1];for(let i=1;i<pts.length;i++)if(u<=pts[i][0]){const [u0,v0]=pts[i-1],[u1,v1]=pts[i],t=(u-u0)/(u1-u0),s=t*t*(3-2*t);return v0+(v1-v0)*s}return pts[pts.length-1][1]}
  const top=X=>{const u=(X-cx)/w;if(u<-1||u>1)return base+2;const e=prof(u);return base-h*e*(1+0.07*n(X*0.11))-(e>0.08?Math.abs(Math.sin(X*0.37+seed))*h*0.035:0)}
  const path=()=>{x.beginPath();x.moveTo(cx-w,base+1);for(let i=0;i<=120;i++){const X=cx-w+2*w*i/120;x.lineTo(X,top(X))}x.lineTo(cx+w,base+1);x.closePath()}
  for(const [fl,al] of [[true,0.2],[false,1]]){x.save();if(fl){x.translate(0,2*base);x.scale(1,-1)}x.globalAlpha=al;const g=x.createLinearGradient(0,base-h,0,base);g.addColorStop(0,col[0]);g.addColorStop(1,col[1]);x.fillStyle=g;path();x.fill();x.restore()}
  x.save();path();x.clip();const sr=mulberry(seed*7)
  x.strokeStyle='rgba(8,10,30,0.28)';x.lineWidth=0.6;for(let k=1;k<12;k++){const Y=base-h*k/12;x.beginPath();x.moveTo(cx-w,Y);for(let X=cx-w;X<=cx+w;X+=4)x.lineTo(X,Y+Math.sin(X*0.2+k)*0.8);x.stroke()}   // strata
  const gs=x.createLinearGradient(0,base-h*0.25,0,base);gs.addColorStop(0,'rgba(60,200,170,0)');gs.addColorStop(1,'rgba(10,15,45,0.28)');x.fillStyle=gs;x.fillRect(cx-w,base-h,w*2,h+2)
  x.strokeStyle='rgba(215,205,255,0.4)';x.lineWidth=0.9;x.beginPath();for(let i=0;i<=120;i++){const X=cx-w+2*w*i/120;i?x.lineTo(X,top(X)):x.moveTo(X,top(X))}x.stroke()
  if(haze){x.fillStyle=`rgba(140,130,200,${haze})`;x.fillRect(cx-w,base-h-4,w*2,h+8)}
  x.restore();x.fillStyle='rgba(205,210,255,0.22)';x.fillRect(cx-w*1.02,base,w*2.04,1);return top}
// a person: dark, with a pale edge of light on the side toward a fire or lantern
function person(X,Y,s=1,{lamp=false,staff=false,sit=false,face=1}={}){x.save();x.translate(X,Y);x.scale(face*s,s);x.fillStyle='#070a18';x.strokeStyle='#070a18'
  if(sit){x.beginPath();x.ellipse(0,-2.4,2,2.6,0,0,Math.PI*2);x.fill();x.beginPath();x.arc(0.3,-5.6,1.3,0,Math.PI*2);x.fill()}
  else{x.beginPath();x.moveTo(-1.6,0);x.lineTo(-1.3,-4.6);x.lineTo(1.3,-4.6);x.lineTo(1.6,0);x.closePath();x.fill();x.beginPath();x.arc(0,-6.2,1.4,0,Math.PI*2);x.fill()
    if(staff){x.lineWidth=0.5;x.beginPath();x.moveTo(2.8,0.2);x.lineTo(2.4,-8.4);x.stroke()}}
  if(lamp){x.lineWidth=0.4;x.beginPath();x.moveTo(1,-4);x.lineTo(3,-3);x.stroke();x.fillStyle='#ffd48a';x.fillRect(2.6,-3,1.2,1.5);light(()=>{const g=x.createRadialGradient(3.2,-2.4,0,3.2,-2.4,12);g.addColorStop(0,'rgba(255,200,120,0.5)');g.addColorStop(1,'rgba(255,200,120,0)');x.fillStyle=g;x.fillRect(-10,-14,26,24)})}
  x.restore()}
const smoke=(X,Y,n=9,s=1)=>{if(layer!=='all'){A('smoke',X,Y,{s,n});return};const sr=mulberry(X|0);for(let i=0;i<n;i++){const t=i/n,r=(1.6+t*5)*s,px=X+Math.sin(t*3+sr())*3*s+t*14*s,py=Y-t*26*s;const g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,`rgba(185,190,225,${0.2*(1-t)})`);g.addColorStop(1,'rgba(185,190,225,0)');x.fillStyle=g;x.fillRect(px-r,py-r,r*2,r*2)}}

// ───────────── round 4: one island, a prosperous Gaelic-Norman stronghold at peace; a rugged arch with a beast cut into its face
const Wc='#2f3678',Wd='#232a62',Rf='#1b2152',Th='#3d3558',Lt='rgba(190,190,240,0.45)'
const crenel=(xa,xb,y,col,s=1)=>{x.fillStyle=col;for(let X=xa;X<xb-1.2*s;X+=2.5*s){x.fillRect(X,y-1.1*s,1.5*s,1.1*s);x.fillRect(X+0.35*s,y-2.1*s,0.8*s,1.1*s)}}     // (the stepped battlement of Irish towers)
const wins=[]
const win=(X,Y,w=1,h=1.8)=>{x.fillStyle='rgba(255,213,140,1)';x.fillRect(X,Y,w,h);wins.push([X,Y])}
const banner=(X,Y,col,s=1)=>{x.fillStyle='#2b2a52';x.fillRect(X-0.3,Y-9*s,0.7,9*s);x.fillStyle=col;x.beginPath();x.moveTo(X+0.4,Y-9*s);x.quadraticCurveTo(X+4*s,Y-8.2*s,X+8*s,Y-8.8*s);x.quadraticCurveTo(X+4*s,Y-6.4*s,X+0.4,Y-5.4*s);x.fill()}
function roundTower(X,Yb,w,h,{cap=true,loops=2,col=Wc}={}){x.fillStyle=col;x.beginPath();x.moveTo(X-w*0.6,Yb+3);x.lineTo(X-w*0.45,Yb-h);x.lineTo(X+w*0.45,Yb-h);x.lineTo(X+w*0.6,Yb+3);x.closePath();x.fill();x.fillStyle=Wd;x.beginPath();x.moveTo(X+w*0.05,Yb+3);x.lineTo(X+w*0.05,Yb-h);x.lineTo(X+w*0.45,Yb-h);x.lineTo(X+w*0.6,Yb+3);x.fill()
  if(cap){x.fillStyle=Rf;x.beginPath();x.moveTo(X-w*0.6,Yb-h);x.lineTo(X,Yb-h-w*1.5);x.lineTo(X+w*0.6,Yb-h);x.fill();x.fillStyle='rgba(205,205,255,0.25)';x.beginPath();x.moveTo(X-w*0.6,Yb-h);x.lineTo(X,Yb-h-w*1.5);x.lineTo(X-w*0.05,Yb-h);x.fill()}else crenel(X-w*0.5,X+w*0.5,Yb-h,col)
  for(let i=0;i<loops;i++)win(X-0.4,Yb-h*(0.25+0.28*i),0.8,1.6)}
function towerHouse(X,Yb,s){const w=13*s,h=31*s;x.fillStyle=Wc;x.fillRect(X-w/2,Yb-h,w,h+4);x.fillStyle=Wd;x.fillRect(X,Yb-h,w/2,h+4)
  x.fillStyle=Wc;x.fillRect(X-w/2-1,Yb-h-2.6*s,w+2,2.6*s);crenel(X-w/2-1,X+w/2+1,Yb-h-2.6*s,Wc,s)                           // the parapet, then its steps
  x.fillStyle=Wd;x.fillRect(X-w/2-1.4,Yb-h-0.4,w+2.8,0.7)
  x.fillStyle=Wc;x.beginPath();x.arc(X+w/2-0.5,Yb-h-1,2.1*s,Math.PI,0);x.lineTo(X+w/2+1.6*s,Yb-h+4*s);x.lineTo(X+w/2-2.6*s,Yb-h+4*s);x.fill();x.fillStyle=Rf;x.beginPath();x.moveTo(X+w/2-3*s,Yb-h-2);x.lineTo(X+w/2-0.5,Yb-h-9*s);x.lineTo(X+w/2+2*s,Yb-h-2);x.fill()   // (a corner turret, bartizan)
  for(const [dx,dy] of [[-3.4,0.78],[1.6,0.62],[-2,0.44],[2.4,0.26],[-3,0.12]])win(X+dx*s,Yb-h*dy,1.1,2.1)
  banner(X-w/2+2,Yb-h-2.6*s,'rgba(235,200,110,0.9)',s*0.9)}
function greatHall(X,Yb,s){const w=24*s,h=10*s;x.fillStyle=Wc;x.fillRect(X-w/2,Yb-h,w,h+4);x.fillStyle=Rf;x.beginPath();x.moveTo(X-w/2-1.4,Yb-h);x.lineTo(X-w*0.28,Yb-h-9*s);x.lineTo(X+w*0.28,Yb-h-9*s);x.lineTo(X+w/2+1.4,Yb-h);x.fill();x.fillStyle='rgba(205,205,255,0.2)';x.fillRect(X-w*0.28,Yb-h-9*s,w*0.56,0.8)
  for(let i=0;i<5;i++){const wx=X-w/2+2.4*s+i*4.3*s;x.fillStyle='rgba(255,213,140,1)';x.beginPath();x.moveTo(wx,Yb-1.5);x.lineTo(wx,Yb-6.2*s);x.arc(wx+0.9*s,Yb-6.2*s,0.9*s,Math.PI,0);x.lineTo(wx+1.8*s,Yb-1.5);x.fill();wins.push([wx+0.8,Yb-5])}}   // (tall pointed windows, all lit: a feast hall)
function gatehouse(X,Yb,s){const w=11*s,h=13*s;x.fillStyle=Wc;x.fillRect(X-w/2,Yb-h,w,h+4);x.fillStyle=Wd;x.fillRect(X+w*0.1,Yb-h,w*0.4,h+4);crenel(X-w/2,X+w/2,Yb-h,Wc,s)
  x.fillStyle='rgba(255,196,120,1)';x.beginPath();x.moveTo(X-2.4*s,Yb+3);x.lineTo(X-2.4*s,Yb-4.2*s);x.arc(X,Yb-4.2*s,2.4*s,Math.PI,0);x.lineTo(X+2.4*s,Yb+3);x.fill()                // the gate stands open, and lit
  wins.push([X,Yb-3]);for(const dx of [-5,5]){x.fillStyle='rgba(255,213,140,1)';x.fillRect(X+dx*s-0.5,Yb-5.5*s,1.2,1.5);wins.push([X+dx*s,Yb-5])}
  light(()=>{const g=x.createRadialGradient(X,Yb-3,0,X,Yb-3,16*s);g.addColorStop(0,'rgba(255,200,130,0.45)');g.addColorStop(1,'rgba(255,200,130,0)');x.fillStyle=g;x.fillRect(X-18*s,Yb-20*s,36*s,28*s)})}
function house(X,Yb,w,h,{thatch=false,lit=true,chim=false}={}){x.fillStyle=Wc;x.fillRect(X,Yb-h,w,h);x.fillStyle=Wd;x.fillRect(X+w*0.55,Yb-h,w*0.45,h)
  if(thatch){x.fillStyle=Th;x.beginPath();x.moveTo(X-1,Yb-h+0.6);x.quadraticCurveTo(X+0.2,Yb-h-w*0.55,X+w/2,Yb-h-w*0.62);x.quadraticCurveTo(X+w-0.2,Yb-h-w*0.55,X+w+1,Yb-h+0.6);x.fill()}
  else{x.fillStyle=Rf;x.beginPath();x.moveTo(X-0.9,Yb-h);x.lineTo(X+w/2,Yb-h-w*0.66);x.lineTo(X+w+0.9,Yb-h);x.fill()}
  if(lit)win(X+w*0.3,Yb-h*0.68,0.9,1.3);if(chim){x.fillStyle=Wd;x.fillRect(X+w*0.7,Yb-h-w*0.62,1,1.8);smoke(X+w*0.7+0.5,Yb-h-w*0.7,5,0.35)}}
function hooker(X,Y,s=1,set=false,flip=1){A('boat',X,Y);x.save();x.translate(X,Y);x.scale(flip*s,s)                                                    // a Galway hooker: black hull, one leaning mast, russet sails
  x.save();x.scale(1,-0.6);x.translate(0,1);x.globalAlpha=0.25;x.fillStyle='#0d1130';x.beginPath();x.moveTo(-9,-3);x.quadraticCurveTo(0,3,9,-3.4);x.lineTo(8,-2);x.quadraticCurveTo(0,1.6,-8,-2);x.fill();x.fillRect(-0.3,-1,0.6,-16);x.restore()
  x.save();x.beginPath();x.rect(-14,-30,28,30.3);x.clip();x.fillStyle='#0a0e26';x.beginPath();x.moveTo(-9.5,-3.2);x.quadraticCurveTo(-4,1.4,2,2);x.quadraticCurveTo(7,2,10.5,-4.2);x.lineTo(9,-3);x.quadraticCurveTo(0,-1.6,-9.5,-3.2);x.fill();x.restore();x.fillStyle='rgba(200,205,240,0.28)';x.fillRect(-10,0.2,20,0.5);x.fillStyle='rgba(200,205,240,0.14)';x.fillRect(-7,1.3,14,0.4)
  x.strokeStyle='#0a0e26';x.lineWidth=0.9;x.beginPath();x.moveTo(-1,-2);x.lineTo(-1.8,-19);x.stroke()
  x.lineWidth=0.6;x.beginPath();x.moveTo(-1.5,-5);x.lineTo(-9,-4.6);x.stroke()
  if(set){x.fillStyle='rgba(176,86,52,0.7)';x.beginPath();x.moveTo(-1.5,-5);x.lineTo(-1.8,-18);x.lineTo(7,-6);x.lineTo(7,-5.2);x.closePath();x.fill();x.fillStyle='rgba(176,86,52,0.55)';x.beginPath();x.moveTo(-2.2,-6);x.lineTo(-2.2,-18);x.lineTo(-9.4,-5);x.closePath();x.fill()}
  else{x.fillStyle='rgba(150,72,46,0.65)';x.beginPath();x.moveTo(-1.5,-4.6);x.lineTo(-9,-4.6);x.lineTo(-9,-5.9);x.quadraticCurveTo(-5,-6.4,-1.5,-5.6);x.fill()}
  x.fillStyle='rgba(255,205,125,1)';x.fillRect(-2.2,-20.2,1.4,1.4);light(()=>{const g=x.createRadialGradient(-1.5,-19.5,0,-1.5,-19.5,8);g.addColorStop(0,'rgba(255,200,120,0.5)');g.addColorStop(1,'rgba(255,200,120,0)');x.fillStyle=g;x.fillRect(-10,-28,17,17);x.fillStyle='rgba(255,200,120,0.25)';x.fillRect(-2,2,1.2,6)})
  x.restore()}
// ── the island: a high summit crowned by the stronghold, terraced orchards and an abbey below it, fields on either shoulder, a harbour in the notch, a brook running down to a mill
const IX=W*0.84,IW=W*0.27,IH=H*0.088
const ipts=[[-1,0],[-0.95,0.1],[-0.82,0.22],[-0.68,0.36],[-0.52,0.6],[-0.4,0.86],[-0.3,1.0],[-0.2,0.92],[-0.1,0.64],[0,0.32],[0.1,0.14],[0.2,0.11],[0.3,0.2],[0.45,0.3],[0.62,0.26],[0.78,0.14],[0.9,0.05],[1,0]]
sea(-1e9)
LAY('mid')
// the far islet, a ring of stones and a fire, small and hazy, behind the island's western shoulder: where the feasts are kept
{const ix=W*0.56,itp=isle(ix,W*0.09,H*0.04,[[-1,0],[-0.7,0.4],[-0.35,0.85],[0.1,1],[0.5,0.7],[1,0]],{seed:21,haze:0.4,col:['#6a69b0','#3a3f80'],base:HZ+0.5}),sr=mulberry(61)
 for(let i=0;i<9;i++){const X=ix-W*0.04+i*W*0.01,Y=itp(X)+1,h=3+sr()*2.8;x.fillStyle=i%2?'#2a2f6c':'#232860';x.beginPath();x.moveTo(X-1,Y);x.lineTo(X-0.7,Y-h);x.lineTo(X+0.6,Y-h-0.5);x.lineTo(X+1.1,Y);x.fill();x.fillStyle='rgba(200,205,255,0.3)';x.fillRect(X-0.7,Y-h,0.4,h)}
 const fx=ix,fy=itp(fx)-1.5
  A('fire',fx,fy-1,{s:1})
 light(()=>{const g=x.createRadialGradient(fx,fy,0,fx,fy,12);g.addColorStop(0,'rgba(255,170,90,0.3)');g.addColorStop(1,'rgba(255,170,90,0)');x.fillStyle=g;x.fillRect(fx-22,fy-22,44,36);for(let i=0;i<8;i++){const t=sr();x.fillStyle=`rgba(255,${170+sr()*60|0},90,${0.9-t*0.8})`;x.fillRect(fx+(sr()-0.5)*7*t,fy-3-t*14,1,1)}})
 x.fillStyle='rgba(255,215,120,1)';x.beginPath();x.moveTo(fx-1.4,fy+1);x.quadraticCurveTo(fx-0.7,fy-3.6,fx,fy-4.4);x.quadraticCurveTo(fx+0.7,fy-3,fx+1.4,fy+1);x.fill()}
const tp=isle(IX,IW,IH,ipts,{seed:7,haze:0.03})
const U=u=>IX+u*IW
fields(tp,U(-0.96),U(-0.5),{rows:5,step:2.4,seed:9,alpha:0.85});fields(tp,U(0.52),U(0.92),{rows:4,step:2.2,seed:13,alpha:0.8})
{const sr=mulberry(31);for(let i=0;i<7;i++){const X=U(-0.9+sr()*0.35),Y=tp(X)+3+sr()*4;x.fillStyle='rgba(230,196,120,0.75)';x.beginPath();x.moveTo(X-1.2,Y);x.lineTo(X,Y-2.2);x.lineTo(X+1.2,Y);x.fill()}}     // (stooks of the harvest, standing in the small fields)
// the terraces under the stronghold: low garden walls, orchard trees in blossom
{const sr=mulberry(5);x.strokeStyle='rgba(200,205,225,0.28)';x.lineWidth=0.7
 for(let k=1;k<=3;k++){x.beginPath();for(let X=U(-0.58);X<=U(-0.04);X+=2){const Y=tp(X)+3.4+k*5.2;if(Y>HZ-3)continue;X===U(-0.58)?x.moveTo(X,Y):x.lineTo(X,Y)}x.stroke()
  for(let X=U(-0.56);X<U(-0.06);X+=4.6+sr()*2.4){const Y=tp(X)+3.4+k*5.2-1.4;if(Y>HZ-4)continue;const r=1.7+sr()*1.2;x.fillStyle=['#27406a','#2d4a72','#223a60'][k%3];x.beginPath();x.arc(X,Y-r,r,0,Math.PI*2);x.fill();x.fillStyle='rgba(255,226,236,0.6)';for(let b=0;b<3;b++)x.fillRect(X+(sr()-0.5)*r*1.4,Y-r+(sr()-0.5)*r*1.4,0.8,0.8)}}}
// the town: thatched and slated houses climbing the slopes from the quay, the quay row at the foot
{const sr=mulberry(11)
 for(let r=6;r>=0;r--){let X=U(-0.56);while(X<U(0.46)){const w=3.8+sr()*3.2,h=3.2+sr()*2.6,cx=X+w/2,u=(cx-IX)/IW,base=u<-0.04?17+(r-2)*3.6:3.4+r*3.5,Yb=tp(cx)+base;if(u>0.34&&u<0.62&&r<3){X+=w+0.8;continue};if(Yb>HZ-0.4||(u<-0.04&&r<2)){X+=w+0.7;continue};house(X,Yb,w,h,{thatch:sr()<0.55,lit:sr()<0.6,chim:sr()<0.16});X+=w+0.5+sr()*1.4}}
 for(let X=U(0.03);X<U(0.34);X+=7.4){const w=5.6,h=4.6+sr()*2.2;house(X,HZ-0.2,w,h,{thatch:false,lit:sr()<0.8})}}                         // (the quay row, store-houses gable-on to the water)
// the town wall: down both flanks from the stronghold to the quay, a round tower at each turn, the gates open; strong, and at rest
{const x0=U(-0.64),x1=U(0.46),wy=X=>Math.min(HZ-1.8,tp(X)+13.5);x.strokeStyle=Wc;x.lineWidth=2.6;x.beginPath();for(let X=x0;X<=x1;X+=2){const Y=wy(X);X===x0?x.moveTo(X,Y):x.lineTo(X,Y)}x.stroke();x.strokeStyle='rgba(190,190,240,0.35)';x.lineWidth=0.6;x.beginPath();for(let X=x0;X<=x1;X+=2){const Y=wy(X)-1.4;X===x0?x.moveTo(X,Y):x.lineTo(X,Y)}x.stroke()
 for(const u of [-0.6,-0.46,-0.32,-0.18,0.0,0.14,0.28,0.4]){const X=U(u);roundTower(X,wy(X)+1.2,4.6,u<-0.05?11:9,{cap:false,loops:1})}}
// the stronghold: curtain wall along the summit, round towers at its corners, the tower house, the hall, the gate
{const x0=U(-0.62),x1=U(-0.02);x.strokeStyle=Wc;x.lineWidth=3.2;x.beginPath();for(let X=x0;X<=x1;X+=2){const Y=tp(X)+3.2;X===x0?x.moveTo(X,Y):x.lineTo(X,Y)}x.stroke()
 x.strokeStyle=Wd;x.lineWidth=1.1;x.beginPath();for(let X=x0;X<=x1;X+=2){const Y=tp(X)+4.8;X===x0?x.moveTo(X,Y):x.lineTo(X,Y)}x.stroke()
 for(let X=x0;X<x1;X+=2.6){const Y=tp(X)+1.6;x.fillStyle=Wc;x.fillRect(X,Y-1,1.5,1.2)}
 const sx=U(-0.3),sy=tp(sx)+2
 greatHall(sx+22,tp(sx+22)+2.4,1.15);towerHouse(sx,sy,1.2)
 roundTower(x0+2,tp(x0+2)+2,6,15,{cap:false});roundTower(x1-1,tp(x1-1)+2,6.4,17,{cap:false});roundTower(U(-0.47),tp(U(-0.47))+2,5,12,{cap:false,loops:1})
 gatehouse(U(-0.14),tp(U(-0.14))+2,1.15)
 banner(x0+2,tp(x0+2)-13-7,'rgba(120,210,170,0.85)',0.9);banner(U(-0.14),tp(U(-0.14))-11,'rgba(235,200,110,0.9)',0.8)
 light(()=>{const g=x.createRadialGradient(sx+6,sy-14,0,sx+6,sy-14,60);g.addColorStop(0,'rgba(255,210,150,0.28)');g.addColorStop(1,'rgba(255,210,150,0)');x.fillStyle=g;x.fillRect(sx-56,sy-76,124,110)})}
// the roundhouse on the eastern shoulder: a great thatched hall of the old kind, its door lit, smoke at the peak, a palisade of stakes about it
{const hx=U(0.55),hy=tp(hx)+2.4,hw=15;x.fillStyle=Wc;x.fillRect(hx-hw/2,hy-4.5,hw,6.5);x.fillStyle=Th;x.beginPath();x.moveTo(hx-hw/2-2,hy-4);x.quadraticCurveTo(hx-hw*0.2,hy-8,hx,hy-15);x.quadraticCurveTo(hx+hw*0.2,hy-8,hx+hw/2+2,hy-4);x.closePath();x.fill();x.fillStyle='rgba(205,205,255,0.2)';x.beginPath();x.moveTo(hx,hy-15);x.lineTo(hx-hw*0.2,hy-8);x.lineTo(hx-0.5,hy-8);x.fill()
 x.fillStyle='rgba(255,200,125,1)';x.beginPath();x.moveTo(hx-1.7,hy+1.6);x.lineTo(hx-1.7,hy-2.4);x.arc(hx,hy-2.4,1.7,Math.PI,0);x.lineTo(hx+1.7,hy+1.6);x.fill();wins.push([hx,hy-1]);smoke(hx+0.5,hy-15,6,0.7)
 x.strokeStyle='#232a62';x.lineWidth=0.9;for(let i=-9;i<=9;i++){const X=hx+i*1.5;x.beginPath();x.moveTo(X,tp(X)+3.4);x.lineTo(X,tp(X)-0.8);x.stroke()}
 light(()=>{const g=x.createRadialGradient(hx,hy-2,0,hx,hy-2,20);g.addColorStop(0,'rgba(255,190,120,0.3)');g.addColorStop(1,'rgba(255,190,120,0)');x.fillStyle=g;x.fillRect(hx-20,hy-22,40,34)})}
// the harbour wall, a beacon at its end; the lights strung along the quay, for a feast
{const m0=U(0.4),m1=U(0.02);A('lamp',m1,HZ+2.8,{r:13});x.strokeStyle='#9aa0cc';x.lineWidth=2.3;x.beginPath();x.moveTo(m0,HZ+0.5);x.quadraticCurveTo((m0+m1)/2,HZ+8.5,m1,HZ+6);x.stroke();x.strokeStyle='#3a4080';x.lineWidth=1.1;x.stroke()
 x.fillStyle='rgba(255,205,125,1)';x.fillRect(m1-0.8,HZ+1.8,1.7,2.4);light(()=>{const g=x.createRadialGradient(m1,HZ+2.8,0,m1,HZ+2.8,13);g.addColorStop(0,'rgba(255,200,120,0.6)');g.addColorStop(1,'rgba(255,200,120,0)');x.fillStyle=g;x.fillRect(m1-13,HZ-11,26,26)})
 const q0=U(0.03),q1=U(0.34);x.strokeStyle='#30377a';x.lineWidth=1.4;x.beginPath();x.moveTo(q0,HZ+1.1);x.lineTo(q1,HZ+1.1);x.stroke()
 light(()=>{const cols=['255,205,130','255,160,150','150,235,210','255,230,150'];for(let a=0;a<4;a++){const xa=q0+4+a*(q1-q0-8)/4,xb=xa+(q1-q0-8)/4;for(let t=0;t<=1.001;t+=0.12){const X=xa+(xb-xa)*t,Y=HZ-5.4+Math.sin(t*Math.PI)*2.6;const c=cols[(a+(t*8|0))%4];const g=x.createRadialGradient(X,Y,0,X,Y,2.4);g.addColorStop(0,`rgba(${c},0.5)`);g.addColorStop(1,`rgba(${c},0)`);x.fillStyle=g;x.fillRect(X-3.4,Y-3.4,6.8,6.8);x.fillStyle=`rgba(${c},1)`;x.fillRect(X-0.4,Y-0.4,0.9,0.9)}}})
 for(const [px,l] of [[q0+9,1],[q0+20,0],[q0+41,1],[q1-12,0]])person(px,HZ+0.8,0.5,{lamp:!!l,face:px%2?1:-1})
 x.fillStyle='#10142e';for(const bx of [q0+6,q0+14,q1-6])x.fillRect(bx,HZ-1.6,1.7,2.2)}                                                          // (barrels on the quay)
// the mill: the brook comes down the slope in short falls to the wheel at the harbour's edge
{const bx=U(-0.04),by=tp(bx)+1,wx=U(0.015);x.strokeStyle='rgba(215,232,255,0.55)';x.lineWidth=1;x.beginPath();let X=U(-0.1),Y=tp(U(-0.1))+9;x.moveTo(X,Y);const sr=mulberry(3);while(Y<HZ-3){X+=(sr()-0.5)*2.2;Y+=2.6;x.lineTo(X+0.6,Y)}x.stroke()
 light(()=>{x.fillStyle='rgba(225,240,255,0.5)';for(const k of [0.3,0.55,0.8]){const Y=tp(U(-0.1))+9+(HZ-12-tp(U(-0.1)))*k;x.fillRect(U(-0.1)+(sr()-0.5)*3,Y,1.2,3)}})
 x.fillStyle=Wc;x.fillRect(wx-9,HZ-7.4,9,7.8);x.fillStyle=Th;x.beginPath();x.moveTo(wx-10,HZ-7.4);x.quadraticCurveTo(wx-9.5,HZ-13,wx-4.5,HZ-13.4);x.quadraticCurveTo(wx,HZ-13,wx+0.8,HZ-7.4);x.fill();win(wx-6.5,HZ-5,1,1.4)
 x.strokeStyle='#222a66';x.lineWidth=1;x.beginPath();x.arc(wx+3.4,HZ-3.2,4.3,0,Math.PI*2);x.stroke();x.lineWidth=0.5;for(let i=0;i<6;i++){const a=i*Math.PI/3+0.4;x.beginPath();x.moveTo(wx+3.4,HZ-3.2);x.lineTo(wx+3.4+Math.cos(a)*4.3,HZ-3.2+Math.sin(a)*4.3);x.stroke()}}
reflect(wins)
mist(HZ-1,0.16,8)
// the harbour at its work: hookers tied up, one coming in under sail, curraghs fishing with lanterns, gulls
LAY('boats')
hooker(U(0.14),HZ+6.5,1.05);hooker(U(0.3),HZ+8.5,0.9,false,-1);hooker(W*1.3,HZ+2.4,0.75,true,1)
curragh(W*0.3,HZ+H*0.05,0.9);curragh(W*0.64,HZ+H*0.055,1.1);curragh(U(-0.02),HZ+H*0.03,0.7)
LAY('mid')
if(layer==='all'){x.save();x.strokeStyle='rgba(230,235,255,0.55)';x.lineWidth=0.8;for(const [bx,by] of [[W*0.66,HZ-H*0.09],[W*0.69,HZ-H*0.105],[W*0.72,HZ-H*0.085],[W*0.93,HZ-H*0.12],[W*0.96,HZ-H*0.105]]){x.beginPath();x.moveTo(bx-3.5,by-1.5);x.quadraticCurveTo(bx-1.5,by-2.5,bx,by);x.quadraticCurveTo(bx+1.5,by-2.5,bx+3.5,by-1.5);x.stroke()};x.restore()}
LAY('arch')
ripples()
mist(HZ+4,0.1,5)

mist(HZ+H*0.01,0.06,4)
let hill=X=>H*0.8-H*0.022*(0.5+0.5*Math.sin(X*0.009+0.4))-H*0.008*Math.sin(X*0.031+1)
if(near){
// ── the middle and near: as before
const mid=X=>H*0.79-H*0.03*(0.5+0.5*Math.sin(X*0.006+2))-H*0.012*Math.sin(X*0.019+0.3)-H*0.005*Math.sin(X*0.05)
const mg=x.createLinearGradient(0,H*0.72,0,H*0.82);mg.addColorStop(0,'#222c55');mg.addColorStop(1,'#141c36');poly(mid,96,mg)
x.fillStyle='#18213f'
{const X=W*0.2,Y=mid(X),th=H*0.07,pw=Math.max(5,W*0.014);x.fillStyle='#18213f';x.beginPath();x.moveTo(X-pw*0.6,Y+2);x.lineTo(X-pw*0.5,Y-th*0.8);x.lineTo(X-pw*0.15,Y-th);x.lineTo(X+pw*0.4,Y-th*0.94);x.lineTo(X+pw*0.6,Y+2);x.closePath();x.fill()      // a pillar stone, taller than a man, cut with ogham up its edge
 x.fillStyle='rgba(205,205,255,0.22)';x.fillRect(X-pw*0.5,Y-th*0.8,0.8,th*0.8);x.strokeStyle='rgba(235,215,160,0.55)';x.lineWidth=0.6;x.beginPath();x.moveTo(X+pw*0.1,Y-th*0.1);x.lineTo(X+pw*0.1,Y-th*0.8);x.stroke()
 for(let i=0;i<9;i++){const yy=Y-th*0.14-i*th*0.075;x.beginPath();x.moveTo(X+pw*0.1,yy);x.lineTo(X+pw*0.1+(i%3===1?3:i%3===2?2:1.4)*0.9,yy-0.6);x.stroke()}}
{const X=W*0.31,Y=mid(X);x.fillStyle='#10172e'
 x.beginPath();x.moveTo(X-6,Y+2);x.lineTo(X-5,Y-H*0.022);x.lineTo(X-2.6,Y-H*0.024);x.lineTo(X-1.6,Y+2);x.fill()
 x.beginPath();x.moveTo(X+3,Y+2);x.lineTo(X+3.6,Y-H*0.014);x.lineTo(X+6.4,Y-H*0.016);x.lineTo(X+7,Y+2);x.fill()}
{const X=W*0.77,Y=mid(X),mw=W*0.1,mh=H*0.032
 x.fillStyle='#1a2444';x.beginPath();x.ellipse(X,Y+3,mw,mh,0,Math.PI,Math.PI*2);x.fill()
 x.fillStyle='rgba(226,230,245,0.62)';x.beginPath();x.moveTo(X-mw*0.46,Y+3);x.lineTo(X-mw*0.38,Y-mh*0.55);x.lineTo(X+mw*0.38,Y-mh*0.55);x.lineTo(X+mw*0.46,Y+3);x.closePath();x.fill()
 x.fillStyle='#0a0f20';x.fillRect(X-3,Y-mh*0.28,6,mh*0.28+3)
 x.fillStyle='rgba(255,215,150,0.8)';x.fillRect(X-5,Y-mh*0.62,10,1.3)}
hill=X=>H*0.8-H*0.022*(0.5+0.5*Math.sin(X*0.009+0.4))-H*0.008*Math.sin(X*0.031+1)
poly(hill,48,'#10172b')
x.strokeStyle='rgba(5,8,18,0.95)';x.lineWidth=2;x.beginPath()
for(let i=0;i<=12;i++){const X=W*(0.27*i/12),Y=hill(X)+5+(i%2)*1.5;i?x.lineTo(X,Y):x.moveTo(X,Y)}x.stroke()
for(let i=0;i<14;i++){const X=W*(0.27*i/14),Y=hill(X)+3.4;x.fillStyle='rgba(5,8,18,0.95)';x.fillRect(X,Y,3+rnd()*2,2)}
{const X=W*0.11,Y=hill(X)+1,th=H*0.04;x.fillStyle='#080c1a';x.strokeStyle='#080c1a';x.lineCap='round'
 x.lineWidth=2.4;x.beginPath();x.moveTo(X,Y+2);x.quadraticCurveTo(X+1,Y-th*0.5,X+th*0.25,Y-th);x.stroke()
 x.lineWidth=1.4;for(const [bx,by] of [[0.55,0.9],[0.1,0.8],[0.7,0.62],[0.9,0.35]]){x.beginPath();x.moveTo(X+th*0.2*by,Y-th*0.7*by);x.lineTo(X+th*(bx*0.8),Y-th*(0.55+by*0.4));x.stroke()}
 x.beginPath();x.ellipse(X+th*0.36,Y-th*0.95,th*0.34,th*0.2,0.25,0,Math.PI*2);x.fill()}
{const X=W*0.9,Y=hill(X)+4,cw=W*0.045,ch=H*0.014
 x.fillStyle='#080c1a';x.fillRect(X-cw/2,Y-ch,cw,ch+3)
 x.beginPath();x.moveTo(X-cw*0.62,Y-ch+1);x.lineTo(X-cw*0.4,Y-ch*1.9);x.lineTo(X+cw*0.4,Y-ch*1.9);x.lineTo(X+cw*0.62,Y-ch+1);x.closePath();x.fill()
 const gl=x.createRadialGradient(X-cw*0.12,Y-ch*0.5,0,X-cw*0.12,Y-ch*0.5,cw*0.9);gl.addColorStop(0,'rgba(255,190,110,0.35)');gl.addColorStop(1,'rgba(255,190,110,0)')
 x.fillStyle=gl;x.fillRect(X-cw*1.2,Y-ch*2,cw*2.4,ch*3)
 x.fillStyle='rgba(255,205,125,0.95)';x.fillRect(X-cw*0.2,Y-ch*0.75,2.6,3)}
x.fillStyle='#0b1022';x.fillRect(0,H*0.84,W,H*0.16)
// ── life on the shore and the hills
smoke(W*0.9+W*0.012,hill(W*0.9)-H*0.027,10,1)
{// a campfire on the mid shore, three sitting round it, a curragh turned over beside
  const X=W*0.47,Y=mid(X)+1;
  x.save();x.fillStyle='#070a18';x.beginPath();x.ellipse(X+13,Y-1,9,4.2,0,Math.PI,Math.PI*2);x.fill();x.strokeStyle='#070a18';x.lineWidth=0.7;for(let i=-3;i<=3;i++){x.beginPath();x.moveTo(X+13+i*2.4,Y-1);x.lineTo(X+13+i*2.4,Y-4.2*Math.sqrt(1-(i/3.4)*(i/3.4))-1);x.stroke()};x.restore()
  light(()=>{const g=x.createRadialGradient(X,Y-2,0,X,Y-2,30);g.addColorStop(0,'rgba(255,170,90,0.5)');g.addColorStop(1,'rgba(255,170,90,0)');x.fillStyle=g;x.fillRect(X-30,Y-32,60,50)})
  for(const [dx,fc] of [[-7,1],[6,-1],[-2,1]]){person(X+dx,Y+(dx===-2?3:0),0.85,{sit:true,face:fc})}
  x.fillStyle='rgba(255,215,120,1)';x.beginPath();x.moveTo(X-2,Y);x.quadraticCurveTo(X-1,Y-6,X,Y-7);x.quadraticCurveTo(X+1,Y-5,X+2,Y);x.fill();x.fillStyle='rgba(255,140,60,0.9)';x.beginPath();x.moveTo(X-1.2,Y);x.quadraticCurveTo(X,Y-4.5,X+1.2,Y);x.fill()
  light(()=>{const sr=mulberry(33);for(let i=0;i<14;i++){const t=sr(),px=X+(sr()-0.5)*10*(0.3+t),py=Y-6-t*26;x.fillStyle=`rgba(255,${160+sr()*60|0},90,${0.9-t*0.8})`;x.fillRect(px,py,1,1)}})}
// sheep on the middle hills and the shepherd with a dog
{const sr=mulberry(5);for(const [fx,n] of [[0.6,6],[0.7,4]]){for(let i=0;i<n;i++){const X=W*fx+i*5+sr()*5,Y=mid(X)+2+sr()*2;x.fillStyle='rgba(225,225,235,0.8)';x.beginPath();x.ellipse(X,Y-1.4,1.9,1.3,0,0,Math.PI*2);x.fill();x.fillStyle='#10142a';x.fillRect(X+1.5,Y-2.2,0.9,0.9);x.fillRect(X-1,Y-0.3,0.4,1);x.fillRect(X+0.7,Y-0.3,0.4,1)}}
  const sx=W*0.55,sy=mid(sx)+3;person(sx,sy,0.9,{staff:true,face:-1});x.fillStyle='#070a18';x.fillRect(sx+3,sy-1.4,2.8,1.1);x.fillRect(sx+5.4,sy-2.2,1,1)}
// someone on the near wall with a lantern, a dog trotting after
{const X=W*0.17,Y=hill(X)+3.2;person(X,Y,1.15,{lamp:true,face:1});x.fillStyle='#050813';x.fillRect(X-8,Y-1.6,3.4,1.2);x.fillRect(X-5.2,Y-2.6,1.2,1.1)}
// the night's light on the water: a few more boats working

{const sr=mulberry(17);for(const [fx,fl] of [[0.66,1],[0.7,-1]]){const X=W*fx,Y=mid(X)+3;x.fillStyle='#0b0f22';x.beginPath();x.ellipse(X,Y-2.6,3.4,1.9,0,0,Math.PI*2);x.fill();x.fillRect(X-2.6,Y-1,0.8,2);x.fillRect(X+1.8,Y-1,0.8,2);x.beginPath();x.arc(X+fl*3.4,Y-3.4,1.1,0,Math.PI*2);x.fill()}}

}

  x.restore()
  const skyline = (X) => Math.min(HZ - H * 0.012, tp(X) - 2) + dy
  const sky = { far: (X) => Math.min(HZ - H * 0.012, mtnTop(X)) + dy, mid: (X) => Math.min(HZ - H * 0.012, tp(X) - 2) + dy, arch: (X) => HZ - H * 0.012 + dy, boats: (X) => HZ - H * 0.012 + dy }
  if (layer !== 'all') {
    wins.forEach(([X, Y], i) => { if (i % 3 === 0) anim.mid.push({ kind: 'lamp', X: X + 0.5, Y: Y + 0.8, r: 5, ph: i, flick: 1 }) })
    anim.mid.push({ kind: 'flock', cx: W * 0.86, cy: HZ - H * 0.1, dir: 1, travel: W * 0.55, period: 52, dur: 20, ph: 7, n: 7 })
    anim.mid.push({ kind: 'flock', cx: W * 0.36, cy: HZ - H * 0.075, dir: -1, travel: W * 0.4, period: 67, dur: 17, ph: 31, n: 5 })
  }
  return { skyline, hill: (X) => hill(X) + dy, sky, anim, dy, isl: [IX, IW] }
}

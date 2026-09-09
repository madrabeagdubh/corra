// introOghamDial.js  (v6)
//
// The druid's incantation: a ring of ogham turning about the moon while the
// poem runs past it, then a pull-back that leaves the moon at widget size.
//
// ── What the moon does, and only what the moon does ──────────────────────────
// It governs English opacity. Nothing else. Earlier drafts also let it choose
// which stanza you were on, which taught a control the game does not have and
// broke the poem into pieces. The poem is now ONE continuous text; the ring is
// a window that carves each line in and dissolves it again, so the poem can be
// any length.
//
// The Irish is a ratchet: hidden at the start — so there is nothing to fail to
// read and the moon is a curiosity rather than an exam — revealed the first
// time the moon is moved, and never hidden again however far it is wound back.
//
// ── Why it does not disturb the preload ──────────────────────────────────────
// introModal starts loading the champion spritesheet, atlas and tune at import
// time. This module is DOM and SVG only, so it runs over the top of that.
//
// Scoped under #ogd-root; listeners torn down on completion.
//
// Usage:
//   import { runOghamDial } from './introOghamDial.js';
//   const phase = await runOghamDial({ assets: { sky, headland, druid, queen } });
//   initConstellationScene(onComplete, phase);

const STYLE = `
  #ogd-root{margin:0;height:100%;background:#070b0a;overflow:hidden;
    font-family:ui-serif,Georgia,serif;color:#cfe0d8;
    -webkit-user-select:none;user-select:none;touch-action:none}
  #ogd-root .layer{position:fixed;inset:0;pointer-events:none;background-repeat:no-repeat}
  #ogd-sky{z-index:0;background-size:cover}
  #ogd-world{position:fixed;inset:0;z-index:2;pointer-events:none;transform-origin:50% 50%}
  #ogd-dial{position:absolute;inset:0;display:grid;place-items:center}
  #ogd-headland{position:absolute;inset:0;background-size:cover;background-position:50% 100%}
  #ogd-figures{position:absolute;inset:0}
  svg{width:104vmin;height:104vmin;max-width:none}

  #ogd-read{position:fixed;left:0;right:0;top:0;height:34vh;z-index:7;overflow:hidden;
    pointer-events:none;
    -webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 20%,#000 80%,transparent 100%);
    mask-image:linear-gradient(to bottom,transparent 0,#000 20%,#000 80%,transparent 100%)}
  #ogd-col{position:absolute;left:0;right:0;top:0;will-change:transform}
  #ogd-col .ga,#ogd-col .en{position:absolute;left:0;right:0;text-align:center;
    padding:0 5vw;box-sizing:border-box;
    text-shadow:0 3px 18px rgba(0,0,0,.95),0 0 40px rgba(0,0,0,.75)}
  #ogd-col .ga{font-family:Urchlo,Aonchlo,ui-serif,Georgia,serif;
    font-size:clamp(22px,6.4vw,36px);line-height:1.2;color:#ece5cb;opacity:0;
    transition:opacity 1.1s ease-out}
  #ogd-col .en{font-size:clamp(16px,4.7vw,26px);line-height:1.24;color:#a9b8a6}

  #ogd-tilt{z-index:5}
  #ogd-tilt .band{position:absolute;left:0;width:100%;
    backdrop-filter:blur(6px) saturate(.8);-webkit-backdrop-filter:blur(6px) saturate(.8)}
  #ogd-tilt .top{top:0;height:26%;
    -webkit-mask-image:linear-gradient(to bottom,#000 0,#000 54%,transparent 100%);
    mask-image:linear-gradient(to bottom,#000 0,#000 54%,transparent 100%)}
  #ogd-tilt .bot{bottom:0;height:28%;
    -webkit-mask-image:linear-gradient(to top,#000 0,#000 48%,transparent 100%);
    mask-image:linear-gradient(to top,#000 0,#000 48%,transparent 100%)}
  #ogd-grade{z-index:6;background:radial-gradient(ellipse at 50% 64%,rgba(26,44,40,0) 30%,rgba(4,8,7,.92) 100%)}
  #ogd-hud{position:fixed;left:0;right:0;bottom:12px;text-align:center;z-index:8;
    font-size:12px;letter-spacing:.09em;color:#4f6a60;pointer-events:none}
  #ogd-panel{position:fixed;top:2px;left:6px;z-index:9;font-size:11px;opacity:.45;color:#8fb4a4}
  #ogd-panel button{background:#12201d;color:#9dc0b2;border:1px solid #2c463f;border-radius:4px;
    padding:4px 7px;font:inherit;margin-right:3px}
  #ogd-done{position:fixed;inset:0;z-index:20;display:none;place-items:center;
    background:#050908;color:#8fb4a4;font-size:16px;letter-spacing:.12em}
`;

const MARKUP = `

<div class="layer" id="ogd-sky"></div>
<div id="ogd-world">
  <div id="ogd-dial">
    <svg id="ogd-svg" viewBox="-330 -400 660 660">
      <defs>
        <radialGradient id="ogd-moonG" cx="42%" cy="38%">
          <stop offset="0%" stop-color="#f7f3e4"/><stop offset="70%" stop-color="#e0e7d8"/>
          <stop offset="100%" stop-color="#bdccc0"/>
        </radialGradient>
        <filter id="ogd-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="10" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <circle id="ogd-halo" r="98" fill="#9dc4b0" opacity=".07" filter="url(#ogd-glow)"/>
      <circle r="94" fill="#0e1614"/>
      <g transform="scale(-1,1)"><path id="ogd-moon" d="" fill="url(#ogd-moonG)"/></g>
      <g id="ogd-stems"></g>
      <g id="ogd-rotor"></g>
    </svg>
  </div>
  <div id="ogd-headland"></div>
  <div id="ogd-figures">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%">
      <g id="ogd-figG"></g></svg>
  </div>
</div>
<div class="layer" id="ogd-tilt"><div class="band top"></div><div class="band bot"></div></div>
<div class="layer" id="ogd-grade"></div>
<div id="ogd-read"><div id="ogd-col"></div></div>
<div id="ogd-hud"></div>
`;

export function runOghamDial(opts = {}) {
  return new Promise(resolve => {
    const parent = document.getElementById(opts.parent || 'gameContainer') || document.body;

    const styleEl = document.createElement('style');
    styleEl.id = 'ogd-style';
    styleEl.textContent = STYLE;
    document.head.appendChild(styleEl);

    const root = document.createElement('div');
    root.id = 'ogd-root';
    root.style.cssText = 'position:fixed;inset:0;z-index:60;overflow:hidden;' +
      'font-family:ui-serif,Georgia,serif;color:#cfe0d8;' +
      '-webkit-user-select:none;user-select:none;touch-action:none;background:#070b0a';
    root.innerHTML = MARKUP;
    parent.appendChild(root);

    const _l = [];
    const addEventListener = (n, f, o) => { window.addEventListener(n, f, o); _l.push([n, f, o]); };

    let _done = false;
    function handOff(phase) {
      if (_done) return; _done = true;
      _l.forEach(([n, f, o]) => window.removeEventListener(n, f, o));
      root.remove();
      styleEl.remove();
      resolve(phase);
    }

    const ASSET_OVERRIDE = opts.assets || null;

    (function () {
      
      /* ═══════════════════════════════════════════════════════════════════════════
         OGHAM DIAL v6 — one continuous poem
      
         THREE THINGS CHANGED, and the first was a design error worth naming.
      
         1. THE MOON NO LONGER SELECTS VERSES.
            It governs English opacity and nothing else — which is all it does in the
            game. Making it also choose which stanza you were on taught a control the
            game does not have, and chopped the poem into pieces you could lose the
            thread of. The poem now runs as ONE text, advancing on its own, and the
            moon only decides whether you can read the gloss.
      
            The ring stops being a container and becomes a WINDOW: each line carves in
            on one of three radii, sweeps past the apex, and dissolves. Nothing has to
            fit — the poem can be any length.
      
         2. THE IRISH IS A RATCHET.
            It starts hidden. The first time the moon is moved it appears, and it
            never goes away again, however far the moon is wound back. Only the
            English answers the moon after that.
      
            Opening on ogham alone matters: with no Irish text on screen there is
            nothing to fail to read, so the moon is a curiosity rather than an exam.
            And what it gives, you keep — which is a truer lesson than a slider.
      
         3. LINE SPACING IS CORRECTED AFTER LAYOUT.
            Row positions come from the carving's arc, so a long wrapped line ran into
            the next pair while a short one left a chasm. Rows are now measured and
            pushed apart to a minimum gap, and the column scrolls by interpolating
            between row positions rather than by raw arc — so pairs stay tight and
            still arrive with their carving.
         ═══════════════════════════════════════════════════════════════════════════ */
      
      const SVG='http://www.w3.org/2000/svg';
      // ids are namespaced ogd-* so nothing collides with the game's DOM
      const $=id=>document.getElementById('ogd-'+id);
      
      const ASSETS=Object.assign({sky:null,headland:null,druid:null,queen:null}, ASSET_OVERRIDE||{});
      const FIG={druid:{x:22,y:78,h:30},queen:{x:76,y:76,h:27}};
      
      /* ── The poem, unbroken ───────────────────────────────────────────────── */
      const POEM=[
        {ga:'A ríon na h-ardspéire',                  en:'O Queen of the high vault'},
        {ga:'A iníon na dorchadais',                  en:'O daughter of darkness'},
        {ga:'Codlaíonn ionat',                        en:'In thee sleeps'},
        {ga:'Seacht n-uaire sholas an ghaiscígh',     en:'Seven times the brightness of a hero\u2019s light'},
        {ga:'Glaoim ar',                              en:'I call it forth'},
        {ga:'Éirigh, a Ghealach, sín siar do chlóca dorcha', en:'Arise, O Moon, Draw back thy dark cloak'},
        {ga:'Seas mar aisling thar dhroim Teamhrach', en:'stand above the ridge of Tara like a dream'},
        {ga:'Lig dod sholas titim',                   en:'let fall thy light'},
        {ga:'Go bhféadfaidh cine éigse',              en:'That a race of poets'},
        {ga:'mhórleabhar dorcha na bhflaitheas a léamh', en:'may read the dark book of heaven'},
        {ga:'Nochtaigh an dán atá snáite sa dorchadas',   en:'Reveal what fate is weaving in the dark'},
        {ga:'Dán na saothraigh is na tite',           en:'The fate of those who strive and those who fall'},
        {ga:'Agus scríobh do thuar go glé ar spéir na hÉireann', en:'And write thy meaning plain on Erin\u2019s sky'},
      ];
      
      const RADII=[206,166,126];
      const WORDS_PER_SEC=0.72;
      const LINE_PAUSE=0.30;      // silent arc between lines
      const GAP_PX=4.6;           // target stroke gap on the outer ring
      const MIN_GAP_PX=3.2;
      const APEX_ARC=0.19;        // travelling pulse
      const EDGE_SOFT=0.26;
      const TRAIL=1.05;           // radians the glow takes to die away behind the apex
      const LEAD=0.16;            // a little brightening just before a letter arrives
      // Any moon at all lights the head — only true dark leaves the carving cold.
      const MOON_GATE=0.12;
      // Wide enough that the line ahead is already carving in and the one behind is
      // still dissolving. At 1.9 only a single line was ever on the ring, which lost
      // the sense of a poem passing through.
      const CULL=4.2;
      const EDGE_SOFT_KEEP=0.26;   // how long a line stays at full before dissolving
      const PAIR_GAP=6;           // px between a line and its gloss
      const BLOCK_GAP=30;         // px between one pair and the next
      const TOP=-Math.PI/2;
      
      /* ── Ogham ───────────────────────────────────────────────────────────── */
      const OGHAM={B:[1,0],L:[2,0],F:[3,0],S:[4,0],N:[5,0],
                   H:[1,1],D:[2,1],T:[3,1],C:[4,1],Q:[5,1],
                   M:[1,2],G:[2,2],NG:[3,2],Z:[4,2],R:[5,2],
                   A:[1,3],O:[2,3],U:[3,3],E:[4,3],I:[5,3],
                   P:[1,4]};
      const FOLD={'Á':'A','É':'E','Í':'I','Ó':'O','Ú':'U',K:'C',V:'F',W:'F',X:'C',Y:'I',J:'I'};
      function toOgham(t){
        const s=t.toUpperCase().replace(/[^A-ZÁÉÍÓÚ ]/g,' ').replace(/\s+/g,' ').trim(),o=[];
        for(let i=0;i<s.length;i++){
          if(s[i]===' '){o.push(null);continue}
          if(s[i]==='N'&&s[i+1]==='G'){o.push('NG');i++;continue}
          const c=FOLD[s[i]]||s[i]; if(OGHAM[c])o.push(c);
        }
        return o;
      }
      const cost=(L,sg)=>L===null?sg*3.1:(OGHAM[L][0]-1)*sg+sg*2.15;
      const smooth=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
      
      /* ── Build: one group per line, cycling the three radii ───────────────────
         Each line owns its rotation, so lines on the same radius never interfere —
         they are three apart and only the ones near the head are drawn at all.
         Line arcs are proportional to ENGLISH WORD COUNT, so the poem is read at a
         constant rate whatever the Irish happens to cost in strokes.             */
      const rotor=$('rotor'), stemsG=$('stems');
      const lines=[];
      let TOTAL_ARC=0;
      
      function build(){
        rotor.textContent=''; stemsG.textContent='';
        RADII.forEach((R,i)=>{
          const c=document.createElementNS(SVG,'circle');
          c.setAttribute('r',R); c.setAttribute('fill','none');
          c.setAttribute('stroke','#5c7d70'); c.setAttribute('stroke-width','1');
          c.setAttribute('opacity',(0.16-i*0.04).toFixed(2));
          stemsG.appendChild(c);
        });
      
        const words=POEM.map(l=>l.en.split(/\s+/).length);
        const totalWords=words.reduce((a,b)=>a+b,0);
      
        // One arc-per-word for the whole poem.
        const K=(GAP_PX/RADII[0])*4.05*3.9;   // ~a comfortable line at the target gap
        let arcCursor=0;
        lines.length=0;
      
        POEM.forEach((l,i)=>{
          const R=RADII[i%RADII.length];
          const seq=toOgham(l.ga);
          const unit=seq.reduce((a,x)=>a+cost(x,1),0) || 1;
          const want=words[i]*K;
          const sg=Math.max(MIN_GAP_PX/R, want/unit);
          const span=unit*sg;
      
          const g=document.createElementNS(SVG,'g');
          const LEN=Math.max(9,Math.min(14,sg*R*3.2));
          const marks=[];
          let th=0;
          for(const L of seq){
            const w=cost(L,sg);
            if(L!==null){
              const [n,fam]=OGHAM[L];
              const s0=th+(w-(n-1)*sg)/2;
              for(let k=0;k<n;k++){
                const ang=TOP+s0+k*sg;
                let r0,r1,t0,t1;
                if(fam===0){r0=R;r1=R+LEN;t0=t1=ang}
                else if(fam===1){r0=R-LEN;r1=R;t0=t1=ang}
                else if(fam===2){r0=R-LEN;r1=R+LEN;t0=ang-sg*0.6;t1=ang+sg*0.6}
                else if(fam===3){r0=R-LEN;r1=R+LEN;t0=t1=ang}
                else {r0=R-LEN;r1=R+LEN;t0=ang-sg*0.7;t1=ang+sg*0.7}
                const ln=document.createElementNS(SVG,'line');
                ln.setAttribute('x1',(Math.cos(t0)*r0).toFixed(2));
                ln.setAttribute('y1',(Math.sin(t0)*r0).toFixed(2));
                ln.setAttribute('x2',(Math.cos(t1)*r1).toFixed(2));
                ln.setAttribute('y2',(Math.sin(t1)*r1).toFixed(2));
                ln.setAttribute('stroke','#8fb3a2');
                ln.setAttribute('stroke-width',(2.2*R/RADII[0]).toFixed(2));
                ln.setAttribute('stroke-linecap','round');
                g.appendChild(ln); marks.push({n:ln, a:s0+k*sg});
                if(fam===4){
                  const x=document.createElementNS(SVG,'line');
                  x.setAttribute('x1',(Math.cos(ang+sg*0.7)*(R-LEN)).toFixed(2));
                  x.setAttribute('y1',(Math.sin(ang+sg*0.7)*(R-LEN)).toFixed(2));
                  x.setAttribute('x2',(Math.cos(ang-sg*0.7)*(R+LEN)).toFixed(2));
                  x.setAttribute('y2',(Math.sin(ang-sg*0.7)*(R+LEN)).toFixed(2));
                  x.setAttribute('stroke','#8fb3a2'); x.setAttribute('stroke-width','2.2');
                  x.setAttribute('stroke-linecap','round');
                  g.appendChild(x); marks.push({n:x, a:s0+k*sg});
                }
              }
            }
            th+=w;
          }
          g.setAttribute('display','none');
          rotor.appendChild(g);
          lines.push({ i, g, marks, R, span, start:arcCursor, end:arcCursor+span });
          arcCursor += span + LINE_PAUSE;
        });
      
        TOTAL_ARC = arcCursor;
        OMEGA = TOTAL_ARC / (totalWords / WORDS_PER_SEC);
        if($('stat')) $('stat').textContent=' '+POEM.length+' lines, '+(TOTAL_ARC/(Math.PI*2)).toFixed(1)+
                              ' turns, '+(totalWords/WORDS_PER_SEC).toFixed(0)+'s';
      }
      let OMEGA=0.3;
      
      /* ── The reading column ───────────────────────────────────────────────────
         Rows are laid at their arc position, then MEASURED and pushed apart so no
         pair collides with the next and none is stranded. The scroll then
         interpolates between row positions rather than using raw arc, so the
         corrected spacing does not put the text out of step with the carving.   */
      const colEl=$('col');
      let rows=[];
      
      function buildColumn(){
        colEl.textContent=''; rows=[];
        POEM.forEach((l,i)=>{
          const ga=document.createElement('div');
          ga.className='ga'; ga.textContent=l.ga;
          const en=document.createElement('div');
          en.className='en'; en.textContent=l.en;
          colEl.appendChild(ga); colEl.appendChild(en);
          rows.push({ga,en,y:0});
        });
      }
      
      function relayout(){
        const H=$('read').clientHeight||300;
        let y=0;
        rows.forEach((r,i)=>{
          r.ga.style.top=y+'px';
          const gh=r.ga.offsetHeight||34;
          r.en.style.top=(y+gh+PAIR_GAP)+'px';
          const eh=r.en.offsetHeight||26;
          r.y=y+gh/2;                      // the pair's anchor, for scrolling
          y += gh + PAIR_GAP + eh + BLOCK_GAP;
        });
      }
      
      /* ── State ───────────────────────────────────────────────────────────── */
      let arc=0, phase=0, revealed=false, started=false, finished=false, audioCtx=null;
      let spinVel=0, dead=false;
      
      /* English brightness = the fraction of the moon's disc that is actually lit,
         which is sin²(pπ/2), not the phase itself. The old curve reached full by
         about a third of the way across, so the moon kept growing long after the
         text had stopped responding — the control felt finished before it was.
         This way the gloss brightens all the way to full, and half a moon gives
         half the light, which is what the picture is already telling you. */
      const lumFor=p=>{
        const s=Math.sin(Math.max(0,p)*Math.PI/2);
        return Math.max(0, Math.min(1, s*s));
      };
      const R=94;
      const moonPath=p=>{
        const rx=R*Math.cos(p*Math.PI), sw=rx>0?0:1;
        return `M 0 ${-R} A ${R} ${R} 0 0 1 0 ${R} A ${Math.abs(rx).toFixed(2)} ${R} 0 0 ${sw} 0 ${-R} Z`;
      };
      
      function frame(dt){
        if(dead) return;
      
        /* The wheel's own turn never stops except while a finger is actually on it.
           There used to be a hold after every gesture, which read as the thing
           stalling each time you nudged it. Inertia is now added ON TOP of the base
           turn rather than replacing it, so a swipe speeds the wheel up and then
           eases back to its own pace without ever pausing. */
        if(!dragging){
          arc += OMEGA*dt;
          if(spinVel!==0){
            arc += spinVel*dt;
            spinVel *= Math.pow(0.12,dt);
            if(Math.abs(spinVel)<0.05) spinVel=0;
          }
        }
      
        if(arc>=TOTAL_ARC){ arc=TOTAL_ARC; finish() }
        if(arc<0) arc=0;
      
        // carving
        lines.forEach(L=>{
          const dMid = arc < L.start ? L.start-arc : arc > L.end ? arc-L.end : 0;
          if(dMid>CULL){ L.g.setAttribute('display','none'); return }
          L.g.removeAttribute('display');
          L.g.setAttribute('transform',`rotate(${(-(arc-L.start)*180/Math.PI).toFixed(2)})`);
      
          const fade = Math.max(0,1-Math.max(0,dMid-EDGE_SOFT)/(CULL-EDGE_SOFT));
          const lum  = lumFor(phase);
      
          /* A comet, not a block. Each stroke lights as it crosses the apex and dies
             away behind, so the ring carries a trail of glowing letters — the spell
             being spoken rather than a highlighted selection. At a dark moon nothing
             lights at all; the carving is there and unreadable, which is the point. */
          // Any moon at all lights the head; only full dark leaves the carving cold.
          const gate = smooth(Math.min(1, phase/MOON_GATE));
          for(let k=0;k<L.marks.length;k++){
            const m=L.marks[k];
            // Each stroke knows its own arc, recorded when it was carved, so the
            // glow tracks the letters rather than an even share of the line.
            const rel = arc - (L.start + m.a);        // >0 once the point has passed
            let e;
            if(rel < -LEAD)   e = 0;
            else if(rel < 0)  e = (1 + rel/LEAD) * 0.45;   // about to be spoken
            else              e = Math.exp(-rel/TRAIL);    // the trail behind
            e *= gate;
            m.n.setAttribute('stroke', e>0.30?'#e8c56d':'#8fb3a2');
            m.n.setAttribute('opacity',((0.30+e*0.68)*fade).toFixed(2));
            m.n.setAttribute('stroke-width',(2.0*L.R/RADII[0]+e*1.9).toFixed(1));
          }
        });
      
        // column: interpolate between row anchors so pairs stay tight
        /* Index by the NEXT line's start, not by this line's end.
           Indexing by `end` advanced the row the instant the carving finished — at
           the beginning of the inter-line pause — so for the whole pause the target
           row was already the next one and the interpolation clamped at 0. The
           column sat dead still, then jumped. That was the freeze. */
        let idx=0;
        while(idx<lines.length-1 && arc>=lines[idx+1].start) idx++;
        const L=lines[idx], nxt=lines[Math.min(idx+1,lines.length-1)];
        const t=Math.max(0,Math.min(1,(arc-L.start)/Math.max(0.001,(nxt.start-L.start))));
        const y=rows[idx].y + (rows[Math.min(idx+1,rows.length-1)].y - rows[idx].y)*t;
        colEl.style.transform=`translateY(${(($('read').clientHeight||300)*0.5 - y).toFixed(1)}px)`;
      
        const lum=lumFor(phase);
        rows.forEach(r=>{
          r.ga.style.opacity = revealed ? '0.95' : '0';
          r.en.style.opacity = lum.toFixed(3);
        });
      }
      
      function setPhase(p){
        phase=Math.max(0,Math.min(1,p));
        $('moon').setAttribute('d',moonPath(phase));
        $('halo').setAttribute('opacity',(0.07+phase*0.36).toFixed(3));
        // The ratchet: once the moon has been moved, the Irish stays for good.
        if(!revealed && phase>0.06) revealed=true;
        if($('hud')) $('hud').textContent = revealed ? '' : '';
      }
      
      /* ── Input ───────────────────────────────────────────────────────────── */
      const RING_GRAB=140, VIEW_W=660, VIEW_CY=-70;
      function dialCentre(){
        const r=$('svg').getBoundingClientRect(), k=r.width/VIEW_W;
        return {cx:r.left+r.width/2, cy:r.top+r.height/2 - VIEW_CY*k, k};
      }
      const svgR=(x,y)=>{const{cx,cy,k}=dialCentre();return Math.hypot(x-cx,y-cy)/k};
      const angAt=(x,y)=>{const{cx,cy}=dialCentre();return Math.atan2(y-cy,x-cx)};
      const wrapPi=a=>{while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a};
      
      let dragging=false,zone=null,lastX=0,lastY=0,lastT=0,lastAng=0,vel=0,angVel=0,textVel=0;
      function down(e){
        const t=(e.touches?e.touches[0]:e);
        dragging=true; lastX=t.clientX; lastT=performance.now(); vel=0; angVel=0; textVel=0; spinVel=0;
        /* Three zones. The text itself scrubs the poem, which is how the rest of
           the game's scrolling text behaves — you should not have to find the ring
           to move the words. */
        const rb=$('read').getBoundingClientRect();
        zone = (t.clientY <= rb.bottom) ? 'text'
             : svgR(t.clientX,t.clientY)>RING_GRAB ? 'ring' : 'moon';
        lastY=t.clientY;
        lastAng=angAt(t.clientX,t.clientY);
        if(!audioCtx){ try{audioCtx=new (window.AudioContext||window.webkitAudioContext)()}catch(x){} }
        if(!started){ started=true;
          if(audioCtx&&audioCtx.state==='suspended') audioCtx.resume();
          tone(174,.09,1.8); }
      }
      function move(e){
        if(!dragging) return;
        const p=(e.touches?e.touches[0]:e), t=performance.now(), dt=Math.max(1,t-lastT);
        if(zone==='text'){
          // Drag up to go on, the way text scrolls. One screen covers about three
          // lines, so a comfortable swipe moves a couple of lines rather than
          // flinging you through the poem.
          const dy=p.clientY-lastY;
          const perPx=(TOTAL_ARC/POEM.length)*3/window.innerHeight;
          arc=Math.max(0,Math.min(TOTAL_ARC,arc-dy*perPx));
          textVel=textVel*0.6+(-dy*perPx/(dt/1000))*0.4;
        } else if(zone==='ring'){
          const a=angAt(p.clientX,p.clientY), d=wrapPi(a-lastAng);
          lastAng=a; arc=Math.max(0,Math.min(TOTAL_ARC,arc-d));
          angVel=angVel*0.6+(-d/(dt/1000))*0.4;
        } else {
          const dx=p.clientX-lastX;
          vel=vel*0.7+(dx/dt)*0.3;
          setPhase(phase+dx/(window.innerWidth*0.80));
        }
        lastX=p.clientX; lastY=p.clientY; lastT=t;
        e.preventDefault();
      }
      function up(){
        if(!dragging) return; dragging=false;
        // A hard shove on the ring runs the poem out to its end. That is the skip:
        // it is the same gesture as reading ahead, only harder, so nobody has to be
        // told about it and nobody stumbles into it.
        /* No skip gesture. Spinning the wheel hard used to jump straight to the end,
           and seeing it made the case against it: a scene that can be dismissed by
           the same motion used to read ahead will be dismissed by accident, and the
           poem is the whole point of the scene. It ends when it has been said.
      
           A hard spin still carries you forward quickly — that is reading fast, and
           reaching the end that way is legitimate. It just is not a separate escape
           hatch that skips the saying of it. */
        if(zone==='ring' && Math.abs(angVel)>0.35) spinVel=Math.max(-6,Math.min(6,angVel));
        // Gentle carry on the text, so it glides to rest rather than stopping dead.
        if(zone==='text' && Math.abs(textVel)>0.20) spinVel=Math.max(-2.2,Math.min(2.2,textVel*0.5));
        textVel=0;
        zone=null;
      }
      addEventListener('mousedown',down); addEventListener('touchstart',down,{passive:true});
      addEventListener('mousemove',move); addEventListener('touchmove',move,{passive:false});
      addEventListener('mouseup',up); addEventListener('touchend',up);
      
      function tone(f,g,d){
        if(!audioCtx||!started) return;
        const o=audioCtx.createOscillator(),v=audioCtx.createGain();
        o.type='triangle'; o.frequency.value=f; v.gain.value=g;
        v.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+d);
        o.connect(v); v.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+d);
      }
      
      /* Where the moon has to land: exactly where createMoonWidget will place it,
         at exactly its size, so the dial's moon and the game's widget are visibly
         the same object. These mirror moonWidget.js and introModal's rest position:
      
           moonR = max(24, round(min(vw,vh) * 0.055))     moonWidget
           wrapperH = moonD + 36                          pad 18 each side
           rest centre = H - 120 - wrapperH/2             MOON_REST_FROM_BOTTOM
      
         Measured on a 400x800 screen the widget is 48px across against the dial's
         118px moon — a scale of 0.40. The old hardcoded 0.105 shrank it to a
         quarter of the right size, so the handoff could never have matched. */
      function moonTileTarget(){
        if(opts && opts.moonTarget) return opts.moonTarget;
        const W=window.innerWidth, H=window.innerHeight;
        const moonD=Math.max(24,Math.round(Math.min(W,H)*0.055))*2;
        return { cx:W/2, cy:H-120-(moonD+36)/2, d:moonD };
      }
      function finish(){
        if(finished) return; finished=true;
        tone(392,.07,2.4);
        lines.forEach(L=>{ L.g.style.transition='opacity .9s ease-out'; L.g.setAttribute('opacity','0') });
        colEl.style.transition='opacity .7s ease-out'; colEl.style.opacity='0';
        const {cx,cy,k}=dialCentre();
        const t=moonTileTarget();
        const dialMoonD = 188*k;                 // r=94 in the 660 viewBox
        const scale = t.d/dialMoonD;
        const w=$('world');
        w.style.transformOrigin=`${cx}px ${cy}px`;
        setTimeout(()=>{
          w.style.transition='transform 2.4s cubic-bezier(.32,.02,.2,1)';
          w.style.transform=`translate(${(t.cx-cx).toFixed(1)}px,${(t.cy-cy).toFixed(1)}px) scale(${scale.toFixed(4)})`;
          /* The real starfield lives in index.html, beneath #gameContainer, and has
             been running the whole time. So instead of drawing our own stars we
             simply stop covering it: the sky layer and the dial's own backdrop fade
             out, and the loader is revealed as the frame widens. One starfield, and
             it is the good one. */
          $('sky').style.transition='opacity 2.0s ease-out'; $('sky').style.opacity='0';
          $('headland').style.transition='opacity 2.0s ease-out'; $('headland').style.opacity='0';
          $('grade').style.transition='opacity 2.4s ease-out'; $('grade').style.opacity='0';
          const rootEl=document.getElementById('ogd-root');
          if(rootEl){ rootEl.style.transition='background-color 2.0s ease-out';
                      rootEl.style.backgroundColor='transparent'; }
        },700);
        setTimeout(()=>{ dead=true; handOff(phase); },3400);
      }
      
      /* ── Placeholders ────────────────────────────────────────────────────── */
      function paint(){
        $('sky').style.background=ASSETS.sky?`url(${ASSETS.sky}) 50%/cover no-repeat`
          :'linear-gradient(#0d1a18 0%,#16292400 38%,#1d322c 62%,#0b1412 100%),radial-gradient(ellipse at 50% 64%,#2a423a,#0a1211 72%)';
        if(ASSETS.headland) $('headland').style.background=`url(${ASSETS.headland}) 50% 100%/cover no-repeat`;
        else $('headland').innerHTML=
          `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%">
             <path d="M0 100 L0 84 C 14 78, 26 88, 40 84 C 56 79, 68 90, 82 86 C 90 84, 96 88, 100 86 L100 100 Z" fill="#060c0b"/>
           </svg>`;
        const fg=$('figG'); fg.textContent='';
        for(const [k,c] of Object.entries(FIG)){
          const s=c.h/30, p=document.createElementNS(SVG,'path');
          p.setAttribute('d', k==='druid'
            ? `M ${c.x} ${c.y} l ${-3*s} ${-18*s} l ${2*s} ${-5*s} l ${3*s} 0 l ${2*s} ${5*s} l ${-3*s} ${18*s} z`
            : `M ${c.x} ${c.y} l ${-4*s} ${-16*s} l ${1.5*s} ${-6*s} l ${4*s} 0 l ${1.5*s} ${6*s} l ${-4*s} ${16*s} z`);
          p.setAttribute('fill','#040807'); fg.appendChild(p);
        }
      }
      
      
      let last=0,running=false;
      function startLoop(){
        if(running) return; running=true; last=performance.now();
        (function l(){ if(dead) return;
          const n=performance.now(); frame(Math.min(0.05,(n-last)/1000)); last=n;
          requestAnimationFrame(l) })();
      }
      
      paint(); build(); buildColumn(); setPhase(0);
      requestAnimationFrame(()=>{ relayout(); startLoop(); });
      addEventListener('resize',()=>relayout());
      
    })();
  });
}


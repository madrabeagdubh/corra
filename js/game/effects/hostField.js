// hostField.js - a warband school at training (v4). Agent-based, never repeats exactly.
//
// Loop: sparring pairs -> a crowd gathers for a masterclass -> javelin volleys
// taken in turns -> chariots circle (the crowd answers, then closes up and turns
// them away) -> two diffuse flocks dance like starlings, edging closer; where
// they meet, pairs drop out to duel; then the charge -> pairs.
//
// Ground coordinates: x in [0,width], y in [0,depth]. Screen y = y * squash.
// Usage:
//   const f = createField({ seed: 3 });
//   f.step(dt);                 // call every frame (any dt; it substeps)
//   f.render(painter);          // painter: rect(x,y,w,h,color,alpha), line(x1,y1,x2,y2,color,alpha)

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PAL = [
  [0x3b5a7a, 0x4f6f52, 0x5d6b8a, 0x2f4858], // cool tunics
  [0x9a4a32, 0xb8862f, 0x7a3b3b, 0xa8683a], // warm tunics
];
const SKIN = [0xe0b896, 0xc9956c, 0xa8764f];
const LEG = 0x3a2c22, WEAPON = 0x4a3626, SHADOW = 0x000000, INSTR = 0xe6dcb8;

export function createField(opts = {}) {
  const { seed = 11, count = 260, width = 360, depth = 250, squash = 0.7, far = false, shortMurmur = false, onEvent: emitCb = null, speedScale = 1 } = opts;
  // how long before a change the horn sounds, in this field's own seconds (real seconds x its speed)
  const LEAD = { call: 1.0 * speedScale, surge: 1.2 * speedScale, charge: 2.3 * speedScale };
  const emit = (name, d) => { if (emitCb) emitCb(name, d); };
  const N = count - (count % 2);
  const W = width, D = depth, S = squash, CX = W / 2, CY = D / 2;
  const rand = makeRng(seed);
  const rr = (a, b) => a + rand() * (b - a);
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------- agents ----------
  const x = new Float32Array(N), y = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N);
  const gx = new Float32Array(N), gy = new Float32Array(N), gs = new Float32Array(N).fill(16), gk = new Float32Array(N).fill(1.2);
  const lx = new Float32Array(N), ly = new Float32Array(N), hasLook = new Uint8Array(N);
  const bob = new Float32Array(N), wa = new Float32Array(N).fill(72), wt = new Float32Array(N).fill(72);
  const swT = new Float32Array(N), swA = new Float32Array(N), dirS = new Int8Array(N).fill(1);
  const team = new Uint8Array(N), pal = new Uint8Array(N), skin = new Uint8Array(N), mode = new Uint8Array(N);
  const hold = new Float32Array(N), throwT = new Float32Array(N), bias = new Float32Array(N);
  const fd = new Float32Array(N), fo = new Float32Array(N), fl = new Float32Array(N), sox = new Float32Array(N), soy = new Float32Array(N);
  const hx = new Float32Array(N), hy = new Float32Array(N);
  // combat / pose state
  const armed = new Uint8Array(N).fill(1), special = new Uint8Array(N), inPair = new Uint8Array(N);
  const lying = new Float32Array(N), crouch = new Float32Array(N), spinT = new Float32Array(N);
  const hopT = new Float32Array(N), hopD = new Float32Array(N).fill(1), hopH = new Float32Array(N), zNow = new Float32Array(N);
  const slotX = new Float32Array(N), slotY = new Float32Array(N);
  const trk = new Array(N).fill(null);
  const IDLE = -999; // wt sentinel: relaxed carry, slowly changing grip
  const grip = new Float32Array(N), gripN = new Float32Array(N);
  const flipT = new Float32Array(N), flipD = new Float32Array(N).fill(1), flipN = new Float32Array(N).fill(1), leanT = new Float32Array(N);
  const jT = new Float32Array(N), jS = new Uint8Array(N), jh = new Uint8Array(N), rideZ = new Float32Array(N), bandOf = new Int16Array(N), kOf = new Int16Array(N), riderFlag = new Uint8Array(N);
  const ride = new Array(N).fill(null);
  const GRIPS = [[90, 28], [-62, 24], [128, 20], [170, 12], [-18, 16]];
  const pickGrip = () => { let r = rand() * 100; for (const [a, w] of GRIPS) { r -= w; if (r <= 0) return a; } return 90; };
  for (let i = 0; i < N; i++) {
    team[i] = i < N / 2 ? 0 : 1; pal[i] = Math.floor(rand() * 4); skin[i] = Math.floor(rand() * 3);
    bias[i] = rr(0.9, 1.1);
    x[i] = rr(30, W - 30); y[i] = rr(30, D - 30);
    grip[i] = pickGrip(); gripN[i] = rr(0, 18);
  }

  function resetCommon() {
    for (let i = 0; i < N; i++) {
      mode[i] = 0; hasLook[i] = 0; wt[i] = IDLE; hold[i] = 0; jS[i] = 0; jh[i] = 0; riderFlag[i] = 0; ride[i] = null; flipT[i] = 0; leanT[i] = 0; throwT[i] = 0; gs[i] = 16; gk[i] = 1.2;
      gx[i] = x[i]; gy[i] = y[i];
      armed[i] = 1; special[i] = 0; inPair[i] = 0; lying[i] = 0; crouch[i] = 0; spinT[i] = 0; hopT[i] = 0; trk[i] = null;
    }
    chariots = []; posts = []; drops = []; fx = []; mc = null; flyer = null;
  }

  // ---------- spatial grid ----------
  const CELL = 12, GC = Math.ceil(W / CELL) + 2, GR = Math.ceil(D / CELL) + 2;
  const gHead = new Int16Array(GC * GR), gNext = new Int16Array(N);
  const cellOf = (px, py) => clamp(Math.floor(py / CELL) + 1, 0, GR - 1) * GC + clamp(Math.floor(px / CELL) + 1, 0, GC - 1);
  function buildGrid() {
    gHead.fill(-1);
    for (let i = 0; i < N; i++) { const c = cellOf(x[i], y[i]); gNext[i] = gHead[c]; gHead[c] = i; }
  }

  // ---------- scene state ----------
  let scene = 'pairs', sceneT = 0, sceneDur = 22, loops = 0, clock = 0;
  let pairs = [], bands = [], javs = [], posts = [], chariots = [], drops = [], fx = [], mc = null;
  let flyer = null, volleyNo = 0;
  let huntT = 0; const hunt = new Int16Array(N).fill(-1);
  let volleyStarted = false, cycleT = 0, cT = 0, ringDone = false, mT = 0, segs = [], chargeAt = 999, dropBudget = 0, pairedCount = 0;
  let sepK = 38, sepR = 5.5;

  // ---------- pose helpers ----------
  // weapon angle tracks: keys are [time, angleDeg]; times scaled by k
  function setW(i, keys, k = 1) { trk[i] = { keys: keys.map(([t, a]) => [t * k, a]), t: 0 }; }
  function hop(i, h, dur, delay = 0) { hopH[i] = h; hopD[i] = dur; hopT[i] = dur + delay; }
  function spark(p, delay) { emit('clash', { x: (x[p.a] + x[p.b]) / 2, y: (y[p.a] + y[p.b]) / 2, delay }); fx.push({ a: p.a, b: p.b, delay, age: 0, life: 0.16 }); }
  function flip(i, dur, n = 1) { flipT[i] = dur; flipD[i] = dur; flipN[i] = n; }
  function cheer(n, ids) {
    emit('cheer', { n });
    const list = ids || (mc ? mc.crowd : []);
    for (let q = 0; q < n && list.length; q++) {
      const i = list[Math.floor(rand() * list.length)], dl = rr(0, 0.9), r = rand();
      if (r < 0.2) { hop(i, rr(6, 9), 0.7, dl); flipT[i] = 0; setTimeout0(i, dl); }
      else if (r < 0.32) { hop(i, rr(4, 6), 0.9, dl); spinT[i] = 0; }
      else hop(i, rr(2, 3.8), rr(0.3, 0.45), dl);
      if (!trk[i]) setW(i, [[0, 72], [0.15, 125], [0.8, 125], [1.0, 72]]);
    }
  }
  // flips are started with a delay so they line up with their hop
  const flipQ = [];
  function setTimeout0(i, dl) { flipQ.push({ i, t: dl }); }
  function onEvent(name) { if (scene === 'gather' && name === 'wow') cheer(24); }
  function dropWeapon(i, fromX, fromY) {
    armed[i] = 0; trk[i] = null;
    let dx = x[i] - fromX, dy = y[i] - fromY; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const a = Math.atan2(dy, dx) + rr(-1.1, 1.1), sp = rr(24, 40);
    const dr = { x: x[i] + dx * 2, y: y[i], z: 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8, vz: rr(32, 48), ang: rr(0, TAU), rest: false, owner: i };
    drops.push(dr);
    return dr;
  }
  function spawnDart(from, tx, ty, T, kind) {
    javs.push({ sx: x[from], sy: y[from], ex: clamp(tx, 4, W - 4), ey: clamp(ty, 4, D - 4), T, t: 0, apex: kind === 'dart' ? 3 : 40, stuck: false, st: 0, dart: kind === 'dart' });
  }

  // =====================================================================
  //  DUELS
  // =====================================================================
  const fi = (p, k) => (k ? p.b : p.a);

  function makeDuel(a, b, o = {}) {
    const dx = x[b] - x[a], dy = y[b] - y[a], mx = (x[a] + x[b]) / 2, my = (y[a] + y[b]) / 2;
    return {
      a, b, cx: mx, cy: my, sx: mx, sy: my, th: Math.atan2(dy, dx), d: Math.max(6, Math.hypot(dx, dy)), om: 0,
      cur: null, steps: [], stepT: 0, evi: 0,
      tempo: o.tempo !== undefined ? o.tempo : rr(0.75, 1.05), flair: o.flair !== undefined ? o.flair : rr(0.5, 1.5),
      dir: rand() < 0.5 ? 1 : -1, att: rand() < 0.5 ? 0 : 1, specials: o.specials || [], last: '',
      off: [{ f: 0, s: 0 }, { f: 0, s: 0 }], free: [null, null], stop: false, done: false, lookO: null,
      arriving: !!o.arriving, walk: o.walk || 9, roam: rr(4, 9), fixed: !!o.fixed, feintCd: 0, teach: !!o.teach, lastTrip: -1,
    };
  }
  function resyncDuel(p) {
    const a = p.a, b = p.b, dx = x[b] - x[a], dy = y[b] - y[a];
    p.cx = (x[a] + x[b]) / 2; p.cy = (y[a] + y[b]) / 2; p.th = Math.atan2(dy, dx); p.d = Math.max(6, Math.hypot(dx, dy));
    p.off[0].f = p.off[0].s = p.off[1].f = p.off[1].s = 0; p.free[0] = p.free[1] = null;
  }

  // ----- step factories (all times in "base seconds", scaled by 1/tempo) -----
  function stCircle(p, dur, o = {}) {
    const k = 1 / p.tempo, dir = o.dir || (rand() < 0.5 ? 1 : -1);
    return {
      dur: dur * k, d: o.d || rr(13, 18), om: dir * rr(0.7, 1.3) * p.tempo, dr: 3,
      tick(pp, u, dt) {
        pp.feintCd -= dt;
        if (pp.feintCd <= 0 && rand() < dt * 0.8) {
          const kk = rand() < 0.5 ? 0 : 1, A = fi(pp, kk), B = fi(pp, 1 - kk);
          if (!trk[A]) { setW(A, [[0, 70], [0.1, 35], [0.22, 100], [0.42, 70]], k); pp.off[1 - kk].f = -1.8; pp.off[kk].f = 1.0; }
          if (rand() < 0.4 && !trk[B]) setW(B, [[0, 70], [0.2, 90], [0.35, 70]], k);
          pp.feintCd = rr(0.7, 1.4) * k;
        }
      },
    };
  }
  function stGap(p, dur) { const k = 1 / p.tempo; return { dur: dur * k, d: rr(9.5, 12), om: p.dir * 0.3 * p.tempo, dr: 5 }; }
  function stRest(p, dur) { const k = 1 / p.tempo; return { dur: dur * k, d: 20, om: 0, dr: 3, wt: IDLE }; }
  function stSalute(p) {
    const k = 1 / p.tempo;
    return {
      dur: 1.4 * k, d: 15, om: 0, dr: 4, wt: 38,
      ev: [
        [0.15 * k, () => { setW(p.a, [[0, 38], [0.35, 120], [1.0, 120], [1.25, 70]], k); setW(p.b, [[0, 38], [0.35, 120], [1.0, 120], [1.25, 70]], k); }],
        [0.55 * k, () => { crouch[p.a] = 0.3 * k; crouch[p.b] = 0.3 * k; }],
      ],
    };
  }
  function stBeat(p, atk, kind, outcome) {
    const k = 1 / p.tempo, thrust = kind === 'thrust';
    const A = fi(p, atk), B = fi(p, 1 - atk);
    outcome = outcome || 'parry';
    const hit = (thrust ? 0.34 : 0.3) * k;
    const ev = [
      [0, () => {
        setW(A, thrust ? [[0, 70], [0.14, 95], [0.28, 12], [0.42, 8], [0.62, 65]] : [[0, 70], [0.1, 150], [0.22, 150], [0.3, -5], [0.46, 50], [0.6, 70]], k);
        p.off[atk].f = -1.4;
        if (outcome === 'parry') setW(B, thrust ? [[0, 70], [0.12, 60], [0.34, 22], [0.5, 45], [0.7, 70]] : [[0, 70], [0.12, 85], [0.3, 102], [0.4, 96], [0.58, 70]], k);
        else if (outcome === 'dodge') setW(B, [[0, 70], [0.2, 115], [0.5, 115], [0.7, 70]], k);
        else setW(B, [[0, 70], [0.3, 70], [0.4, 128], [0.7, 70]], k);
      }],
      [0.2 * k, () => { p.off[atk].f = thrust ? 5.2 : 3.0; }],
    ];
    if (outcome === 'parry') ev.push([hit, () => { spark(p, 0); p.off[1 - atk].f = thrust ? -1.2 : -1.8; if (thrust) p.off[1 - atk].s = rr(-3.5, 3.5); }]);
    else if (outcome === 'dodge') ev.push([0.26 * k, () => { p.off[1 - atk].f = -5; p.off[1 - atk].s = rr(-3, 3); }]);
    else ev.push([hit, () => { p.off[1 - atk].f = -3.2; hop(B, 1.6, 0.25 * k); }]);
    return { dur: (thrust ? 0.78 : 0.64) * k, d: thrust ? 9.5 : rr(8.5, 11), om: p.dir * 0.25 * p.tempo, dr: 6, ev };
  }
  function exchangeSteps(p) {
    const S = [], n = 1 + Math.floor(rand() * 3), pressing = rand() < 0.5;
    let atk = p.att;
    for (let i = 0; i < n; i++) {
      S.push(stBeat(p, atk, 'cut'));
      if (pressing) S.push(stGap(p, rr(0.08, 0.3))); else atk ^= 1;
    }
    if (rand() < 0.85) S.push(stBeat(p, atk, 'thrust', pick(['parry', 'parry', 'parry', 'dodge', 'touch'])));
    p.att ^= 1;
    return S;
  }
  function spinSteps(p, atk) {
    const k = 1 / p.tempo, A = fi(p, atk), B = fi(p, 1 - atk), duck = rand() < 0.55;
    return [
      { dur: 0.55 * k, d: 16, om: 0, dr: 5, ev: [[0, () => { setW(A, [[0, 70], [0.4, 160]], k); p.off[atk].f = -2.5; }]] },
      { dur: 0.8 * k, d: 9, om: 0, dr: 9, ev: [[0, () => {
        spinT[A] = 0.7 * k; setW(A, [[0, 160], [0.7, 160 + 720], [0.8, 160 + 720]], k); hop(A, 3.4, 0.7 * k); p.off[atk].f = 5.5;
        if (duck) { crouch[B] = 0.62 * k; setW(B, [[0, 70], [0.15, 118], [0.6, 118], [0.8, 70]], k); p.off[1 - atk].f = -0.8; }
        else { p.off[1 - atk].f = -6; setW(B, [[0, 70], [0.3, 50], [0.42, 104], [0.7, 70]], k); spark(p, 0.42 * k); }
      }]] },
      { dur: 0.8 * k, d: 13, om: 0, dr: 5, ev: [[0, () => { spinT[A] = 0; p.off[atk].s = rr(-2.5, 2.5); }]] },
    ];
  }
  function twirlSteps(p, atk) {
    const k = 1 / p.tempo, A = fi(p, atk), B = fi(p, 1 - atk);
    return [
      { dur: 0.5 * k, d: 17, om: 0, dr: 5, ev: [[0, () => { crouch[A] = 0.4 * k; setW(A, [[0, 70], [0.4, 160]], k); p.off[atk].f = -3; }]] },
      { dur: 1.5 * k, d: 10, om: 0, dr: 7, ev: [
        [0, () => { spinT[A] = 1.3 * k; setW(A, [[0, 160], [1.3, 160 + 1800], [1.5, 160 + 1800]], k); hop(A, 6.5, 1.3 * k); p.off[atk].f = 6; setW(B, [[0, 70], [0.3, 50], [0.5, 105], [0.7, 50], [0.9, 105], [1.2, 70]], k); }],
        [0.45 * k, () => { spark(p, 0); p.off[1 - atk].f = -5; }],
        [0.9 * k, () => { spark(p, 0); p.off[1 - atk].f = -5; onEvent('wow'); }],
      ] },
      { dur: 0.9 * k, d: 14, om: 0, dr: 5, ev: [[0, () => { spinT[A] = 0; }]] },
    ];
  }
  function leapSteps(p, atk) {
    const k = 1 / p.tempo, A = fi(p, atk), B = fi(p, 1 - atk);
    return [
      { dur: 0.45 * k, d: 14, om: 0, dr: 5, ev: [[0, () => { crouch[A] = 0.4 * k; p.off[atk].f = -2; }]] },
      { dur: 0.95 * k, d: 10, om: 0, dr: 8,
        ev: [[0, () => { hop(A, 11, 0.85 * k); flip(A, 0.85 * k, 1); setW(A, [[0, 70], [0.3, 160], [0.6, 20], [0.85, 70]], k); crouch[B] = 0.8 * k; setW(B, [[0, 70], [0.15, 118], [0.8, 118], [1, 70]], k); }],
          [0.5 * k, () => { onEvent('wow'); }]],
        tick(pp, u) { pp.off[atk].f = (pp.d + 11) * smooth(u * 1.15); },
        exit(pp) { resyncDuel(pp); } },
      { dur: 0.6 * k, d: 14, om: 0, dr: 5 },
    ];
  }
  function bindSteps(p, atk) {
    const k = 1 / p.tempo, A = fi(p, atk), B = fi(p, 1 - atk);
    return [
      stBeat(p, atk, 'cut'),
      { dur: 2.3 * k, d: 7, om: p.dir * 0.7 * p.tempo, dr: 6, wt: 52,
        ev: [[0, () => { spark(p, 0); setW(A, [[0, 70], [0.2, 52]], k); setW(B, [[0, 70], [0.2, 52]], k); }], [0.7 * k, () => spark(p, 0)], [1.4 * k, () => spark(p, 0)]],
        tick(pp, u, dt) { pp.shoveT = (pp.shoveT || 0) - dt; if (pp.shoveT <= 0) { pp.shoveT = 0.45 * k; pp.shoveK = (pp.shoveK || 0) ^ 1; pp.off[pp.shoveK].f = 1.8; pp.off[1 - pp.shoveK].f = -1.2; } } },
      { dur: 0.9 * k, d: 16, om: 0, dr: 6, ev: [[0, () => { p.off[0].f = -4; p.off[1].f = -4; hop(A, 2, 0.3 * k); hop(B, 2, 0.3 * k); }]] },
    ];
  }
  function batonSteps(p, atk) {
    const k = 1 / p.tempo, A = fi(p, atk), B = fi(p, 1 - atk);
    return [
      { dur: 0.4 * k, d: 16, om: 0, dr: 5 },
      { dur: 1.7 * k, d: 13, om: p.dir * 0.5 * p.tempo, dr: 4, ev: [[0, () => { setW(A, [[0, 70], [1.5, 70 + 2520]], k); setW(B, [[0, 70], [0.4, 58], [1.0, 96], [1.6, 70]], k); }]] },
      stBeat(p, atk, 'cut'),
    ];
  }
  function vaultSteps(p, atk) {
    const k = 1 / p.tempo, A = fi(p, atk), B = fi(p, 1 - atk);
    return [
      { dur: 0.5 * k, d: 15, om: 0, dr: 5, ev: [[0, () => { setW(A, [[0, 70], [0.3, -75], [0.5, -75]], k); crouch[A] = 0.3 * k; p.off[atk].f = -1; }]] },
      { dur: 1.0 * k, d: 10, om: 0, dr: 8,
        ev: [[0, () => { hop(A, 13, 0.9 * k); flip(A, 0.9 * k, 1); setW(A, [[0, -75], [0.45, -75], [0.7, 60], [0.9, 90]], k); crouch[B] = 0.8 * k; setW(B, [[0, 70], [0.15, 118], [0.8, 118], [1, 70]], k); }],
          [0.5 * k, () => onEvent('wow')]],
        tick(pp, u) { pp.off[atk].f = (pp.d + 10) * smooth(u * 1.1); },
        exit(pp) { resyncDuel(pp); } },
      { dur: 0.6 * k, d: 14, om: 0, dr: 5 },
    ];
  }
  function skySteps(p) {
    const k = 1 / p.tempo;
    return [
      { dur: 0.4 * k, d: 12, om: 0, dr: 5, ev: [[0, () => { crouch[p.a] = 0.3 * k; crouch[p.b] = 0.3 * k; }]] },
      { dur: 1.5 * k, d: 9, om: 0, dr: 6, ev: [
        [0, () => {
          hop(p.a, 12, 1.25 * k); hop(p.b, 12, 1.25 * k);
          setW(p.a, [[0, 70], [0.25, 150], [0.4, 0], [0.55, 150], [0.7, 0], [0.85, 150], [1.0, 0], [1.25, 70]], k);
          setW(p.b, [[0, 70], [0.25, 20], [0.4, 110], [0.55, 20], [0.7, 110], [0.85, 20], [1.0, 110], [1.25, 70]], k);
        }],
        [0.2 * k, () => { flip(p.b, 0.9 * k, 1); }],
        [0.4 * k, () => spark(p, 0)], [0.7 * k, () => spark(p, 0)], [1.0 * k, () => { spark(p, 0); onEvent('wow'); }],
      ] },
      { dur: 0.7 * k, d: 14, om: 0, dr: 5 },
    ];
  }
  function clinchSteps(p) {
    const k = 1 / p.tempo, trip = rand() < 0.5, loser = Math.floor(rand() * 2), win = 1 - loser;
    const dur = rr(1.5, 2.4);
    const hold_ = {
      dur: dur * k, d: 5.3, om: p.dir * 1.8 * p.tempo, dr: 8, wt: 98,
      tick(pp, u, dt) { pp.shoveT = (pp.shoveT || 0) - dt; if (pp.shoveT <= 0) { pp.shoveT = 0.36 * k; pp.shoveK = (pp.shoveK || 0) ^ 1; pp.off[pp.shoveK].f = 1.7; pp.off[1 - pp.shoveK].f = -1.2; } },
    };
    const end = trip
      ? { dur: 1.7 * k, d: 9, om: 0, dr: 4, ev: [[0, () => { lying[fi(p, loser)] = 1.4 * k; trk[fi(p, loser)] = null; p.off[loser].f = -3; hop(fi(p, win), 1.8, 0.3 * k); onEvent('wow'); }],
        [0.5 * k, () => setW(fi(p, win), [[0, 98], [0.3, 115], [0.9, 115], [1.2, 70]], k)]] }
      : { dur: 0.7 * k, d: 15, om: 0, dr: 6, ev: [[0, () => { p.off[0].f = -3; p.off[1].f = -3; }]] };
    return [hold_, end];
  }
  function disarmSteps(p, atk) {
    const k = 1 / p.tempo, A = fi(p, atk), B = fi(p, 1 - atk);
    const S = [stBeat(p, atk, 'cut')];
    S.push({ dur: 0.75 * k, d: 9, om: 0, dr: 7, ev: [
      [0, () => { setW(A, [[0, 70], [0.14, 162], [0.3, 162], [0.4, -15], [0.6, 40], [0.78, 70]], k); setW(B, [[0, 70], [0.2, 100], [0.4, 100]], k); p.off[atk].f = -1.5; }],
      [0.26 * k, () => { p.off[atk].f = 3.8; }],
      [0.4 * k, () => { spark(p, 0); const dr = dropWeapon(B, x[A], y[A]); p.drop = dr; p.off[1 - atk].f = -3.8; p.off[1 - atk].s = rr(-3, 3); hop(B, 1.5, 0.3 * k); onEvent('wow'); }],
    ] });
    S.push({ dur: 0.8 * k, d: 14, om: 0, dr: 5, wt: 30, ev: [[0, () => { setW(A, [[0, 70], [0.4, 28]], k); }]] });
    if (rand() < 0.35) S.push(...clinchSteps(p).slice(0, 1));
    S.push({
      dur: 8, d: 12, om: 0, dr: 3, wt: 28,
      enter(pp) {
        const dr = pp.drop;
        pp.free[1 - atk] = dr ? { x: dr.x, y: dr.y, run: true } : null;
        pp.free[atk] = { x: x[A], y: y[A] };
      },
      until(pp) {
        const dr = pp.drop;
        if (!dr) return true;
        if (pp.free[1 - atk] && dr.rest) { pp.free[1 - atk].x = dr.x; pp.free[1 - atk].y = dr.y; }
        return dr.rest && Math.hypot(x[B] - dr.x, y[B] - dr.y) < 2.4;
      },
      exit(pp) {
        const dr = pp.drop;
        armed[B] = 1; if (dr) drops = drops.filter((q) => q !== dr);
        pp.drop = null; resyncDuel(pp);
        setW(A, [[0, 28], [0.25, 108], [0.9, 108], [1.2, 70]], k);
      },
    });
    S.push({ dur: 1.0 * k, d: 14, om: 0, dr: 4 });
    return S;
  }
  function throwSteps(p, thr) {
    const k = 1 / p.tempo, A = fi(p, thr), B = fi(p, 1 - thr), fate = pick(['dodge', 'dodge', 'swat', 'swat', 'hit']);
    const S = [];
    S.push({ dur: 0.7 * k, d: rr(24, 29), om: p.dir * 0.4 * p.tempo, dr: 5 });
    S.push({ dur: 1.15 * k, d: 26, om: 0, dr: 3, ev: [
      [0, () => setW(A, [[0, 70], [0.3, 168], [0.6, 168], [0.72, 6], [0.95, 60], [1.15, 70]], k)],
      [0.72 * k, () => {
        const dist = Math.hypot(x[B] - x[A], y[B] - y[A]), T = clamp(dist / 80, 0.28, 0.5);
        const ux = (x[B] - x[A]) / (dist || 1), uy = (y[B] - y[A]) / (dist || 1);
        let tx = x[B], ty = y[B];
        if (fate === 'dodge') { tx += ux * 8; ty += uy * 8; p.off[1 - thr].s = rr(5, 7) * (rand() < 0.5 ? -1 : 1); p.off[1 - thr].f = -1.5; hop(B, 1.2, 0.3); }
        else if (fate === 'swat') { tx -= ux * 3.5; ty -= uy * 3.5; setW(B, [[0, 70], [T - 0.2, 70], [T - 0.05, 20], [T + 0.1, 45], [T + 0.3, 70]]); spark(p, T - 0.03); }
        else { p.off[1 - thr].f = -3.2; hop(B, 1.6, 0.3); }
        spawnDart(A, tx, ty, T, 'dart');
      }],
    ] });
    S.push({ dur: 0.6 * k, d: 14, om: 0, dr: 6 });
    return S;
  }
  function teachSteps(p) {
    const k = 1 / p.tempo, A = p.a;
    const teach = (dur) => ({
      dur: dur * k, d: 17, om: 0, dr: 3, wt: 60,
      enter(pp) {
        if (mc && mc.pts) { const q = mc.pts[Math.floor(rand() * mc.pts.length)]; pp.lookO = { x: q.x, y: q.y }; }
        setW(A, [[0, 70], [0.4, 22], [1.2, 22], [1.7, 90], [2.2, 70]], 1);
      },
    });
    return [
      stSalute(p), stCircle(p, 2.4, { d: 17 }), teach(2.0),
      stBeat(p, 0, 'cut'), stGap(p, 0.6), teach(1.6),
      stBeat(p, 0, 'cut'), stBeat(p, 1, 'cut'), stBeat(p, 0, 'cut'), stBeat(p, 0, 'thrust', 'parry'), teach(1.8),
      ...spinSteps(p, 0), teach(1.5), ...disarmSteps(p, 0),
      stSalute(p), stRest(p, 1.0),
    ];
  }

  function pickSpecial(p) {
    const opts = [['exchange', 40], ['spin', 8 * p.flair], ['twirl', 6 * p.flair], ['leap', 6 * p.flair], ['sky', 4.5 * p.flair], ['bind', 6], ['baton', 5 * p.flair], ['vault', 5 * p.flair], ['disarm', 8], ['throw', 6], ['clinch', 6]];
    let tot = 0;
    for (const [kd, w] of opts) if (kd !== p.last || kd === 'exchange') tot += w;
    let r = rand() * tot;
    for (const [kd, w] of opts) { if (kd === p.last && kd !== 'exchange') continue; r -= w; if (r <= 0) return kd; }
    return 'exchange';
  }
  function stepsFor(p, kind) {
    p.last = kind;
    const atk = p.att;
    switch (kind) {
      case 'spin': { const S = [stCircle(p, rr(0.5, 1.1)), ...spinSteps(p, atk)]; p.att ^= 1; return S; }
      case 'disarm': { const S = [stCircle(p, rr(0.5, 1.0)), ...disarmSteps(p, atk)]; p.att ^= 1; return S; }
      case 'throw': { const S = throwSteps(p, atk); p.att ^= 1; return S; }
      case 'twirl': { const S = [stCircle(p, rr(0.5, 1.0)), ...twirlSteps(p, atk)]; p.att ^= 1; return S; }
      case 'leap': { const S = [stCircle(p, rr(0.5, 1.0)), ...leapSteps(p, atk)]; p.att ^= 1; return S; }
      case 'bind': { const S = [stCircle(p, rr(0.5, 1.0)), ...bindSteps(p, atk)]; p.att ^= 1; return S; }
      case 'baton': { const S = [stCircle(p, rr(0.5, 1.0)), ...batonSteps(p, atk)]; p.att ^= 1; return S; }
      case 'vault': { const S = [stCircle(p, rr(0.5, 1.0)), ...vaultSteps(p, atk)]; p.att ^= 1; return S; }
      case 'sky': return [stCircle(p, rr(0.6, 1.1)), ...skySteps(p)];
      case 'clinch': return [stGap(p, 0.4), ...clinchSteps(p)];
      default: return exchangeSteps(p);
    }
  }
  function planBout(p) {
    const S = [stSalute(p), stCircle(p, rr(1.2, 2.6))];
    const nMain = rand() < 0.4 ? 2 : 1;
    for (let m = 0; m < nMain; m++) {
      const kind = p.specials.length ? p.specials.shift() : pickSpecial(p);
      S.push(...stepsFor(p, kind));
      if (m < nMain - 1) S.push(stCircle(p, rr(0.7, 1.4)));
    }
    S.push(stSalute(p), stRest(p, rr(0.8, 2.0)));
    return S;
  }

  function nextStep(p) {
    if (!p.steps.length) {
      if (p.stop) {
        if (!p.ending) { p.ending = true; p.steps = [stSalute(p), stRest(p, 0.8)]; }
        else { p.done = true; p.steps = [stRest(p, 1.5)]; }
      } else p.steps = planBout(p);
    }
    p.cur = p.steps.shift(); p.stepT = 0; p.evi = 0; p.lookO = null;
    if (p.cur.enter) p.cur.enter(p);
  }
  function runDuel(p, dt) {
    if (p.stop && !p.ending && p.steps.length) p.steps.length = 0;
    if (!p.cur) nextStep(p);
    if (p.arriving) return;
    const s = p.cur;
    p.stepT += dt;
    if (s.ev) while (p.evi < s.ev.length && p.stepT >= s.ev[p.evi][0]) { const fn = s.ev[p.evi][1]; p.evi++; fn(p); }
    if (s.tick) s.tick(p, p.stepT / s.dur, dt);
    const done = s.until ? (s.until(p) || p.stepT > s.dur) : p.stepT >= s.dur;
    if (done) { if (s.exit) s.exit(p); p.cur = null; }
  }

  function updateDuel(p, dt) {
    const a = p.a, b = p.b;
    const mx = p.sx - p.cx, my = p.sy - p.cy, md = Math.hypot(mx, my);
    if (md > 0.5) { const st = Math.min(md, p.walk * dt); p.cx += (mx / md) * st; p.cy += (my / md) * st; }
    if (!p.fixed) {
      p.roam -= dt;
      if (p.roam <= 0) { p.roam = rr(5, 10); p.sx = clamp(p.sx + rr(-14, 14), 16, W - 16); p.sy = clamp(p.sy + rr(-10, 10), 16, D - 16); }
    }
    runDuel(p, dt);
    if (!p.cur) nextStep(p);
    const s = p.cur;
    p.d += (s.d - p.d) * (1 - Math.exp(-(s.dr || 5) * dt));
    p.om += (s.om - p.om) * (1 - Math.exp(-4 * dt));
    p.th += p.om * dt * (1 + 1.2 * Math.abs(Math.sin(p.th)));
    for (let k = 0; k < 2; k++) { p.off[k].f *= Math.exp(-6.5 * dt); p.off[k].s *= Math.exp(-5.5 * dt); }
    const ux = Math.cos(p.th), uy = Math.sin(p.th), qx = -uy, qy = ux;
    const goals = [
      [p.cx + ux * (-p.d / 2 + p.off[0].f) + qx * p.off[0].s, p.cy + uy * (-p.d / 2 + p.off[0].f) + qy * p.off[0].s],
      [p.cx + ux * (p.d / 2 - p.off[1].f) + qx * p.off[1].s, p.cy + uy * (p.d / 2 - p.off[1].f) + qy * p.off[1].s],
    ];
    let maxDist = 0;
    for (let k = 0; k < 2; k++) {
      const i = k ? b : a, fr = p.free[k];
      let g0 = goals[k][0], g1 = goals[k][1], spd;
      if (fr) { g0 = fr.x; g1 = fr.y; }
      gx[i] = clamp(g0, 4, W - 4); gy[i] = clamp(g1, 4, D - 4);
      const dist = Math.hypot(gx[i] - x[i], gy[i] - y[i]);
      maxDist = Math.max(maxDist, dist);
      if (fr) spd = fr.run ? 38 : 14;
      else if (p.arriving) spd = 20;
      else spd = clamp(18 + 5 * dist, 18, 95);
      gs[i] = spd; gk[i] = 8; hold[i] = 0; hasLook[i] = 1;
      const o = k ? a : b;
      lx[i] = p.lookO && k === 0 ? p.lookO.x : x[o]; ly[i] = p.lookO && k === 0 ? p.lookO.y : y[o];
      if (!trk[i] && armed[i]) {
        wt[i] = s.wt !== undefined ? s.wt : 68 + 12 * Math.sin(clock * 2.6 + i * 1.7);
      }
    }
    if (p.arriving && maxDist < 8) p.arriving = false;
  }
  function updatePairs(dt) { for (const p of pairs) updateDuel(p, dt); }

  // ---------- pairing / stations ----------
  function pairUp(preferEnemy, exclude) {
    const used = new Uint8Array(N);
    if (exclude) for (const e of exclude) used[e] = 1;
    const res = [];
    for (const i of shuffle(Array.from({ length: N }, (_, k) => k))) {
      if (used[i]) continue;
      let best = -1, bd = 1e12;
      for (let j = 0; j < N; j++) {
        if (used[j] || j === i) continue;
        const dx = x[j] - x[i], dy = y[j] - y[i];
        let d = dx * dx + dy * dy;
        if (preferEnemy && team[j] === team[i]) d += 400;
        if (d < bd) { bd = d; best = j; }
      }
      if (best < 0) break;
      used[i] = used[best] = 1;
      const dd = makeDuel(i, best); dd.th = (Math.cos(dd.th) >= 0 ? 0 : Math.PI) + rr(-0.5, 0.5); res.push(dd);
    }
    return res;
  }
  function assignStations(list) {
    const P = list.length;
    if (!P) return;
    const cols = Math.ceil(Math.sqrt((P * (W - 60)) / (D - 60))), rows = Math.ceil(P / cols);
    const cw = (W - 60) / cols, ch = (D - 60) / rows, st = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      st.push({ x: 30 + (c + 0.5) * cw + rr(-0.25, 0.25) * cw, y: 30 + (r + 0.5) * ch + rr(-0.25, 0.25) * ch, used: false });
    }
    for (const p of shuffle(list.slice())) {
      let bi = -1, bd = 1e12;
      for (let k = 0; k < st.length; k++) {
        if (st[k].used) continue;
        const dx = st[k].x - p.cx, dy = st[k].y - p.cy, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; bi = k; }
      }
      if (bi < 0) { p.sx = p.cx; p.sy = p.cy; continue; }
      st[bi].used = true; p.sx = st[bi].x; p.sy = st[bi].y;
    }
  }
  function placePairsInstantly() {
    for (const p of pairs) {
      p.cx = p.sx; p.cy = p.sy; p.d = 17;
      const ux = Math.cos(p.th), uy = Math.sin(p.th);
      x[p.a] = p.cx - (ux * p.d) / 2; y[p.a] = p.cy - (uy * p.d) / 2;
      x[p.b] = p.cx + (ux * p.d) / 2; y[p.b] = p.cy + (uy * p.d) / 2;
      vx[p.a] = vy[p.a] = vx[p.b] = vy[p.b] = 0;
    }
  }

  // =====================================================================
  //  SCENES
  // =====================================================================
  function enterPairs(how) {
    if (how === 'adopt') {
      assignStations(pairs);
      for (const p of pairs) { p.walk = 9; p.roam = rr(4, 9); }
      sceneDur = rr(30, 40);
      return;
    }
    resetCommon();
    sepK = 38;
    pairs = pairUp(how !== 'fresh');
    assignStations(pairs);
    if (how === 'fresh') placePairsInstantly();
    sceneDur = how === 'fresh' ? 26 : rr(30, 40);
  }

  // ----- gather: a crowd around a masterclass -----
  const ACTS = [
    { a: 'inst', b: 'A', time: 17, tempo: 0.55, teach: true },
    { a: 'A', b: 'B', time: 15, tempo: 1.05, flair: 2.2, sp: ['exchange', 'bind', 'baton', 'vault', 'disarm', 'sky'] },
    { a: 'inst', b: 'C1', time: 12, tempo: 0.95, flair: 1.5, sp: ['exchange', 'baton', 'disarm', 'leap'] },
    { a: 'inst', b: 'C2', time: 13, tempo: 1.15, flair: 2.2, sp: ['bind', 'twirl', 'vault', 'sky', 'clinch'] },
  ];
  function enterGather(instant) {
    resetCommon();
    const F = { x: rr(140, W - 140), y: rr(108, D - 108) };
    const order = Array.from({ length: N }, (_, i) => i).sort((p, q) => Math.hypot(x[p] - F.x, y[p] - F.y) - Math.hypot(x[q] - F.x, y[q] - F.y));
    const need = N - 1, pts = [];
    let minD = 6.4, tries = 0;
    while (pts.length < need) {
      const r = 40 + 52 * Math.pow(rand(), 0.85), a = rand() * TAU;
      const px = F.x + Math.cos(a) * r * 1.25, py = F.y + Math.sin(a) * r;
      tries++;
      if (px < 12 || px > W - 12 || py < 12 || py > D - 12) { if (tries > 40000) { minD *= 0.9; tries = 0; } continue; }
      let ok = true;
      for (const q of pts) { if (Math.hypot(q.x - px, q.y - py) < minD) { ok = false; break; } }
      if (ok) pts.push({ x: px, y: py });
      else if (tries > 6000) { minD *= 0.92; tries = 0; }
    }
    pts.sort((q, r) => Math.hypot(q.x - F.x, q.y - F.y) - Math.hypot(r.x - F.x, r.y - F.y));
    const inst = order[0];
    special[inst] = 1; slotX[inst] = F.x; slotY[inst] = F.y;
    gx[inst] = F.x; gy[inst] = F.y; gs[inst] = 18; gk[inst] = 1; hasLook[inst] = 1; lx[inst] = F.x + 60; ly[inst] = F.y;
    const rest = order.slice(1);
    rest.forEach((i, k) => {
      slotX[i] = pts[k].x; slotY[i] = pts[k].y;
      gx[i] = pts[k].x; gy[i] = pts[k].y; gs[i] = rr(14, 22); gk[i] = 1.0;
      hasLook[i] = 1; lx[i] = F.x; ly[i] = F.y; hold[i] = rr(0, 2);
    });
    mc = {
      F, inst, A: rest[0], B: rest[1], C1: rest[2], C2: rest[3], act: -1, actT: 0, duel: null, fin: -1, pts,
      crowd: rest.slice(4), edge: { x: F.x + Math.cos(rr(0, TAU)) * 48, y: F.y + Math.sin(rr(0, TAU)) * 34 },
    };
    mc.wait = instant ? 3 : 8;
    if (instant) {
      for (const i of [inst, ...rest]) { x[i] = gx[i]; y[i] = gy[i]; vx[i] = vy[i] = 0; hold[i] = 0; }
    }
    pairs = [];
    sceneDur = 999;
  }
  function releaseTo(i, toEdge) {
    armed[i] = 1; trk[i] = null; spinT[i] = 0;
    hasLook[i] = 1; lx[i] = mc.F.x; ly[i] = mc.F.y; gs[i] = 18; gk[i] = 1; hold[i] = 0; wt[i] = IDLE; flipT[i] = 0;
    if (toEdge) { gx[i] = mc.edge.x; gy[i] = mc.edge.y; } else { gx[i] = slotX[i]; gy[i] = slotY[i]; }
  }
  function startAct(k) {
    const a = ACTS[k], ia = mc[a.a], ib = mc[a.b];
    const p = makeDuel(ia, ib, { tempo: a.tempo, flair: a.flair || 1, specials: (a.sp || []).slice(), teach: a.teach, arriving: true, fixed: true });
    p.sx = mc.F.x + rr(-4, 4); p.sy = mc.F.y + rr(-3, 3); p.cx = p.sx; p.cy = p.sy;
    p.th = rr(-0.25, 0.25) + (rand() < 0.5 ? 0 : Math.PI); p.d = 17;
    // approaching fighters walk in from where they are
    if (a.teach) p.steps = teachSteps(p);
    pairs = [p]; mc.duel = p; mc.actT = 0; mc.act = k;
  }
  function updateGather(dt) {
    const m = mc;
    if (!m) return;
    if (m.fin >= 0) {
      m.fin += dt;
      if (m.fin > 5.2) sceneDur = 0;
      return;
    }
    if (m.act === -1) {
      if (sceneT > m.wait) startAct(0);
      return;
    }
    m.actT += dt;
    const p = m.duel, a = ACTS[m.act];
    if (m.actT > a.time) p.stop = true;
    if (p.done) {
      const next = ACTS[m.act + 1];
      const keep = next ? [m[next.a], m[next.b]] : [];
      for (const i of [p.a, p.b]) {
        if (keep.includes(i)) continue;
        releaseTo(i, i === m.inst && !!next);
      }
      if (next) startAct(m.act + 1);
      else {
        pairs = []; m.duel = null; m.fin = 0;
        armed[m.inst] = 1; setW(m.inst, [[0, 72], [0.4, 120], [4.5, 120], [5, 72]]);
        gx[m.inst] = m.F.x; gy[m.inst] = m.F.y;
        cheer(Math.floor(m.crowd.length * 0.7), m.crowd);
      }
    }
  }

  // ----- volleys -----
  // A band is a loose cluster. When it is called it dresses into a staggered
  // three-rank line, then the throw ripples down the line: each thrower takes a
  // run-up of skipping strides, draws the javelin back, crow-hops, plants and
  // releases. A few throwers leap onto their own javelin and ride it down the range,
  // hopping between javelins in flight.
  const SLOTS = 6, slotPos = (s) => [150 - 44 * Math.floor(s / 2), s % 2 ? 172 : 78];
  function enterVolleys() {
    resetCommon();
    pairs = [];
    const order = shuffle(Array.from({ length: N }, (_, i) => i));
    bands = [];
    const per = Math.floor(N / SLOTS);
    for (let b = 0; b < SLOTS; b++) {
      const ids = order.slice(b * per, b === SLOTS - 1 ? N : (b + 1) * per), off = [];
      let minD = 5.4, tries = 0;
      while (off.length < ids.length) {
        const a = rand() * TAU, r = Math.sqrt(rand());
        const o = { x: Math.cos(a) * r * 18, y: Math.sin(a) * r * 34 };
        tries++;
        let ok = true;
        for (const q of off) { if (Math.hypot(q.x - o.x, q.y - o.y) < minD) { ok = false; break; } }
        if (ok) off.push(o); else if (tries > 4000) { minD *= 0.93; tries = 0; }
      }
      bands.push({ ids, off, slot: b });
    }
    shuffle(bands).forEach((bd, k) => { bd.slot = k; });
    bands.forEach((bd, bi) => bd.ids.forEach((i, k) => {
      bandOf[i] = bi; kOf[i] = k;
      const p = slotPos(bd.slot); gx[i] = p[0] + bd.off[k].x; gy[i] = p[1] + bd.off[k].y; gs[i] = rr(20, 28); gk[i] = 1.5;
    }));
    posts = Array.from({ length: 6 }, (_, k) => ({ x: 300 + rr(-6, 6), y: 40 + k * 34 + rr(-4, 4) }));
    javs = [];
    cycleT = 1e9; volleyStarted = false; fireOrder = []; fireIdx = 0; volleyNo = 0;
    sceneDur = rr(52, 60);
  }
  let fireOrder = [], fireIdx = 0;
  function backToSlot(i, spd) {
    const bd = bands[bandOf[i]], p = slotPos(bd.slot), k = kOf[i];
    gx[i] = p[0] + bd.off[k].x; gy[i] = p[1] + bd.off[k].y; gs[i] = spd; gk[i] = 1.6; hasLook[i] = 0;
  }
  function fireVolley() {
    emit('volley', {});
    if (fireIdx >= fireOrder.length) {
      const prev = fireOrder.length ? fireOrder[fireOrder.length - 1] : -1;
      do { fireOrder = shuffle(bands.map((_, k) => k)); } while (fireOrder[0] === prev);
      fireIdx = 0;
    }
    const firing = bands[fireOrder[fireIdx++]], p0 = slotPos(firing.slot), tx0 = 296 + rr(-14, 14);
    const ids = firing.ids.slice().sort((a, b) => firing.off[kOf[a]].y - firing.off[kOf[b]].y);
    const n = ids.length, m = Math.ceil(n / 3), dir = rand() < 0.5 ? 1 : -1;
    ids.forEach((i, idx) => {
      const r = idx % 3, j = Math.floor(idx / 3), f = m > 1 ? j / (m - 1) : 0.5;
      gx[i] = p0[0] + r * 8 - 8; gy[i] = p0[1] - 50 + f * 100 + r * 2.4; gs[i] = rr(22, 28); gk[i] = 2.2;
      hasLook[i] = 1; lx[i] = tx0; ly[i] = gy[i]; wt[i] = 100;
      jS[i] = 1; jh[i] = 0; jT[i] = 1.7 + 1.0 * (dir > 0 ? f : 1 - f) + r * 0.2 + rr(0, 0.06);
      riderFlag[i] = 0;
    });
    volleyNo++;
    if (volleyNo === 2) riderFlag[pick(ids)] = 1; // one man gets sent across the sky
    firing._tx = tx0;
  }
  function throwJav(i) {
    const bd = bands[bandOf[i]];
    const tx = (bd && bd._tx ? bd._tx : 296) + rr(-26, 26), ty = clamp(y[i] + rr(-14, 14), 18, D - 18);
    const dist = Math.max(40, tx - x[i]);
    const jv = { sx: x[i], sy: y[i], ex: tx, ey: ty, T: 1.0 + dist / 140, t: 0, apex: rr(36, 52), stuck: false, st: 0, rider: null };
    javs.push(jv);
    swT[i] = 0.3; swA[i] = 8; wt[i] = IDLE; hasLook[i] = 0;
    if (riderFlag[i]) {
      riderFlag[i] = 0; mode[i] = 2; vx[i] = vy[i] = 0; trk[i] = null; wt[i] = 165; jS[i] = 0;
      const T = 1.9;
      flyer = { i, sx: x[i], sy: y[i], ex: clamp(x[i] + rr(95, 125), 0, 270), ey: clamp(y[i] + rr(-20, 20), 20, D - 20), T, t: 0, apex: 62, ph: 0, drop: null };
      ride[i] = { fly: true }; flip(i, T, 5);
    } else {
      jS[i] = 3; jT[i] = 0.35; gx[i] = x[i] + 4; gy[i] = y[i]; gs[i] = 20; gk[i] = 2;
    }
  }
  function updateFlyer(dt) {
    const f = flyer;
    if (!f) return;
    const i = f.i;
    if (f.ph === 0) {
      f.t += dt;
      const u = clamp(f.t / f.T, 0, 1);
      x[i] = f.sx + (f.ex - f.sx) * u; y[i] = f.sy + (f.ey - f.sy) * u; rideZ[i] = f.apex * 4 * u * (1 - u);
      if (u >= 1) { // bumpy landing
        f.ph = 1; ride[i] = null; flipT[i] = 0; lying[i] = 1.7; f.drop = dropWeapon(i, x[i] - 8, y[i]); hop(i, 2.5, 0.3); onEvent('wow');
      }
    } else if (f.ph === 1) {
      if (lying[i] <= 0) { mode[i] = 0; gx[i] = f.drop.x; gy[i] = f.drop.y; gs[i] = 13; gk[i] = 1.2; hasLook[i] = 0; hold[i] = 0.4; f.ph = 2; }
    } else if (f.drop.rest && Math.hypot(x[i] - f.drop.x, y[i] - f.drop.y) < 2.4) {
      armed[i] = 1; drops = drops.filter((q) => q !== f.drop); wt[i] = IDLE; backToSlot(i, 11); hold[i] = 0.5; flyer = null;
    } else if (!f.drop.rest) { gx[i] = f.drop.x; gy[i] = f.drop.y; }
  }
  function updateVolleys(dt) {
    if (!volleyStarted) {
      let sum = 0;
      for (let i = 0; i < N; i++) sum += Math.hypot(gx[i] - x[i], gy[i] - y[i]);
      if (sum / N < 14 || sceneT > 18) { volleyStarted = true; cycleT = LEAD.call + 0.3; emit('formation', { kind: 'call' }); }
    }
    cycleT -= dt;
    if (cycleT <= 0 && volleyStarted && sceneT < sceneDur - 7) { fireVolley(); cycleT = 4.2; }
    for (let i = 0; i < N; i++) {
      const s = jS[i];
      if (!s) continue;
      jT[i] -= dt;
      if (s === 1) {
        if (jT[i] <= 0) { // run-up: skipping strides, javelin drawn back as it goes
          jS[i] = 2; jT[i] = 0.9; jh[i] = 0; gx[i] = x[i] + 32; gy[i] = y[i]; gs[i] = rr(34, 40); gk[i] = 3;
          setW(i, [[0, 100], [0.4, 100], [0.7, 168]]);
        }
      } else if (s === 2) {
        if (jT[i] <= 0.4 && !jh[i]) { jh[i] = 1; hop(i, 2.2, 0.3); leanT[i] = 0.5; gs[i] = rr(46, 54); } // crow-hop
        if (jT[i] <= 0) throwJav(i);
      } else if (s === 3 && jT[i] <= 0) { jS[i] = 0; backToSlot(i, rr(18, 24)); hold[i] = rr(0.1, 0.5); }
    }
    updateFlyer(dt);
  }

  // ----- chariots -----
  // A chevron of chariots drives straight through the crowd (which leaps aside),
  // wheels round and begins to circle. The host closes into a hedgehog ring; after
  // a few laps the chariots are turned away.
  const ccx = CX, ccy = CY, PASS_T = 6.5;
  function enterChariots() {
    resetCommon();
    pairs = [];
    chariots = Array.from({ length: 5 }, (_, k) => ({ k, a: 0, a0: -0.55 + k * 0.28, s: 1.9, x: -80, y: CY + (k - 2) * 38, y0: CY + (k - 2) * 38, vx: 1, vy: 0, dist: rr(0, 40), trail: [], lag: Math.abs(k - 2) * 24 }));
    cT = -LEAD.surge; ringDone = false;
    emit('chariots', { lead: LEAD.surge, dur: PASS_T + 26 });
    for (let i = 0; i < N; i++) { hx[i] = x[i]; hy[i] = y[i]; gs[i] = 18; gk[i] = 1.2; gx[i] = x[i]; gy[i] = y[i]; }
    sceneDur = PASS_T + 31 + LEAD.surge;
  }
  function assignRing() {
    const slots = [];
    let k = 0, r = 14, rmax = 0;
    while (slots.length < N) {
      const cap = Math.max(1, Math.floor((TAU * r) / 5.6)), cnt = Math.min(cap, N - slots.length);
      for (let j = 0; j < cnt; j++) { const a = k * 0.7 + (j / cnt) * TAU; slots.push({ x: ccx + Math.cos(a) * r, y: ccy + Math.sin(a) * r, r, a }); }
      rmax = r; r += 7; k++;
    }
    const order = Array.from({ length: N }, (_, i) => i).sort((p, q) => Math.hypot(x[p] - ccx, y[p] - ccy) - Math.hypot(x[q] - ccx, y[q] - ccy));
    order.forEach((i, n) => {
      const s = slots[n];
      gx[i] = s.x; gy[i] = s.y; gs[i] = rr(24, 32); gk[i] = 1.4;
      hasLook[i] = 1; lx[i] = ccx + Math.cos(s.a) * 400; ly[i] = ccy + Math.sin(s.a) * 400;
      wt[i] = s.r >= rmax - 8 ? 12 : 80;
    });
  }
  function updateChariots(dt) {
    cT += dt;
    for (const c of chariots) {
      const px = c.x, py = c.y;
      if (cT < PASS_T) { c.x = -80 + 92 * cT - c.lag; c.y = c.y0 + 3 * Math.sin(cT * 3 + c.k); }
      else {
        const tt = cT - PASS_T;
        c.a = c.a0 + 0.7 * tt;
        let s = 1.9 - 0.9 * smooth(tt / 4);
        if (tt > 6) s -= 0.28 * smooth((tt - 6) / 8);
        if (tt > 24) s += 1.3 * smooth((tt - 24) / 6);
        c.s = s;
        c.x = CX + 135 * s * Math.cos(c.a); c.y = CY + 80 * s * Math.sin(c.a);
      }
      if (px || py) { const dx = c.x - px, dy = c.y - py, d = Math.hypot(dx, dy); if (d > 1e-3 && d < 60) { c.vx = dx; c.vy = dy; c.dist += d; } }
      c.trail.push({ x: c.x, y: c.y }); if (c.trail.length > 7) c.trail.shift();
    }
    if (!ringDone && cT >= PASS_T + 0.5) { ringDone = true; assignRing(); }
    if (cT < PASS_T + 0.5) for (let i = 0; i < N; i++) { gx[i] = hx[i]; gy[i] = hy[i]; }
  }

  // ----- starlings -----
  // Two flocks, each a sheet of rows and files (about 11 across), that behave like
  // silk: every row follows the same flight path a little later than the row in
  // front, so the sheet bends, twists and ripples along curves while keeping its
  // shape. Row spacing and width breathe, so density varies. The flocks chase
  // each other round looping paths, trying to find an advantage, then gather into
  // halves, surge at each other and charge. Where they meet, pairs drop out.
  const HALF = 130, AYR = 85, RX = 158, RY = 102;
  const hp = (t, u, v, gap) => [CX + (t ? 1 : -1) * (gap + HALF * (0.5 + 0.5 * u)), CY + AYR * v];
  const rowI = new Float32Array(N), colN = new Float32Array(N);
  const DT_ROW = 0.34, CH_D = shortMurmur ? 5 : 12, tMuster = shortMurmur ? 4 : 7, NC = shortMurmur ? 2 : 4;
  let curves = [], tChaseEnd = 0, finalSegs = [], waveAmp = 0;
  const TP = [0, 0], TQ = [0, 0], TR = [0, 0];
  function makeCurves() {
    const defs = [
      (a) => { const m = 1 + 0.16 * Math.sin(3 * a); return [Math.cos(a) * m, 0.9 * Math.sin(a) * m]; },
      (a) => [Math.sin(a), 0.85 * Math.sin(2 * a)],
      (a) => [Math.sin(3 * a), 0.85 * Math.sin(2 * a)],
      (a) => [0.9 * Math.sin(2 * a), Math.cos(a)],
    ];
    return defs.map((f) => {
      let len = 0, pr = f(0);
      for (let k = 1; k <= 400; k++) { const q = f((TAU * k) / 400); len += Math.hypot((q[0] - pr[0]) * RX * 0.88, (q[1] - pr[1]) * RY * 0.88); pr = q; }
      return { f, om: (TAU * 34) / len };
    });
  }
  function curvePoint(k, tm, tau, out) {
    const c = curves[k], dT = tm ? 5.2 + 1.8 * Math.sin(0.42 * tau + k) : 0, q = c.f(c.om * (tau - dT));
    out[0] = CX + RX * 0.88 * q[0]; out[1] = CY + RY * 0.88 * q[1];
  }
  function millPoint(tm, ta, out) {
    const a = 0.3 * ta + tm * Math.PI, q = hp(tm, 0.15 + 0.55 * Math.cos(a), 0.7 * Math.sin(a), 34);
    out[0] = q[0]; out[1] = q[1];
  }
  function teamPath(tm, ta, out) {
    if (ta < tMuster) { millPoint(tm, ta, out); return; }
    if (ta < tChaseEnd) {
      const k = Math.min(NC - 1, Math.floor((ta - tMuster) / CH_D)), tau = ta - tMuster - k * CH_D;
      curvePoint(k, tm, tau, out);
      if (tau < 2.5) {
        if (k > 0) curvePoint(k - 1, tm, tau + CH_D, TR); else millPoint(tm, ta, TR);
        const w = smooth(tau / 2.5);
        out[0] = TR[0] + (out[0] - TR[0]) * w; out[1] = TR[1] + (out[1] - TR[1]) * w;
      }
      return;
    }
    const tau = ta - tChaseEnd;
    let k = 0, acc = 0;
    while (k < finalSegs.length - 1 && tau >= acc + finalSegs[k].dur) { acc += finalSegs[k].dur; k++; }
    const gap = 34 - 48 * smooth(tau / (chargeAt - tChaseEnd));
    const ev = (idx, tt) => { const p = finalSegs[idx].f(tt, tm); return hp(tm, p[0], p[1], gap); };
    const tt = tau - acc;
    let p = ev(k, tt);
    if (k > 0 && tt < 2) { const q = ev(k - 1, tt + finalSegs[k - 1].dur), w = smooth(tt / 2); p = [q[0] * (1 - w) + p[0] * w, q[1] * (1 - w) + p[1] * w]; }
    else if (k === 0 && tt < 2.5) {
      curvePoint(NC - 1, tm, ta - tMuster - (NC - 1) * CH_D, TR);
      const w = smooth(tt / 2.5); p = [TR[0] * (1 - w) + p[0] * w, TR[1] * (1 - w) + p[1] * w];
    }
    out[0] = p[0]; out[1] = p[1];
  }
  // where slot (row, file) of a team's sheet is at scene time mt
  function slotTarget(tm, row, cN, mt, squeeze, out) {
    const delay = DT_ROW * (row + 0.9 * Math.sin(0.55 * row - 0.8 * mt)) * (1 - 0.5 * squeeze);
    const ta = Math.max(0, mt - delay);
    teamPath(tm, ta, TP); teamPath(tm, ta + 0.25, TQ);
    let tx = TQ[0] - TP[0], ty = TQ[1] - TP[1];
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const flat = mt >= tChaseEnd ? smooth((mt - tChaseEnd) / 4) : 0;
    const HW = (36 + 9 * Math.sin(0.27 * mt + tm * 1.7)) * (1 - 0.3 * squeeze);
    const tws = (0.5 + 0.5 * Math.sin(0.2 * mt + tm)) * (1 - flat);
    const tw = tws * 0.45 * row - 0.55 * mt + tm;
    const widen = 1 + 0.2 * Math.sin(0.6 * row - 0.5 * mt);
    const lat = cN * HW * widen * (1 - tws + tws * Math.cos(tw)), lon = cN * HW * 0.45 * tws * Math.sin(tw);
    out[0] = TP[0] - ty * lat + tx * lon; out[1] = TP[1] + tx * lat + ty * lon;
    if (mt >= tChaseEnd) { // keep the halves apart until the surge
      const sg = tm ? 1 : -1, own = (out[0] - CX) * sg, minSide = 12 - 260 * smooth((mt - (chargeAt - 14)) / 2);
      if (own < minSide) out[0] = CX + sg * minSide;
    }
  }
  function enterMurmur() {
    resetCommon();
    pairs = []; pairedCount = 0; dropBudget = 0; huntT = 0; hunt.fill(-1);
    curves = makeCurves();
    if (shortMurmur) curves = [curves[0], curves[2]];
    tChaseEnd = tMuster + NC * CH_D;
    const sgn = rand() < 0.5 ? 1 : -1;
    finalSegs = [
      { dur: shortMurmur ? 4 : 7, f: (tau, t) => { const a = sgn * 0.3 * tau + t * Math.PI; return [0.15 + 0.55 * Math.cos(a), 0.7 * Math.sin(a)]; } },
      { dur: shortMurmur ? 5.5 : 11, f: (tau, t) => {
        const pl = Math.max(0, Math.sin(0.5 * tau + t * Math.PI));
        return [0.35 - 1.9 * pl * pl, 0.5 * Math.sin(0.6 * tau + t * Math.PI)];
      } },
      { dur: 999, f: (tau) => {
        const e = clamp((tau - 3) / 5, 0, 1);
        const u = tau < 3 ? 0.7 * smooth(tau / 3) + 0.3 * (1 - smooth(tau / 3)) * 0.35 : 0.7 - 3.0 * smooth(e);
        return [u, 0];
      } },
    ];
    chargeAt = tChaseEnd + finalSegs[0].dur + finalSegs[1].dur;
    mT = 0;
    bounds = []; nextB = 0;
    for (let k = 0; k < NC; k++) bounds.push({ t: tMuster + k * CH_D, kind: 'call' });
    bounds.push({ t: tChaseEnd, kind: 'call' }, { t: tChaseEnd + finalSegs[0].dur, kind: 'surge' }, { t: chargeAt, kind: 'charge' });
    // give each flock member a place in its sheet, matched to where they stand now
    for (let tm = 0; tm < 2; tm++) {
      const ids = Array.from({ length: N }, (_, i) => i).filter((i) => team[i] === tm);
      const slots = ids.map((_, k) => { const row = Math.floor(k / 11), c = k % 11; return { row, cN: ((c - 5) + 0.5 * (row & 1)) / 5 }; });
      const taken = new Uint8Array(ids.length), o = [0, 0];
      for (const sl of slots) {
        slotTarget(tm, sl.row, sl.cN, 4, 0, o);
        let best = -1, bd = 1e12;
        for (let a = 0; a < ids.length; a++) { if (taken[a]) continue; const d = (x[ids[a]] - o[0]) ** 2 + (y[ids[a]] - o[1]) ** 2; if (d < bd) { bd = d; best = a; } }
        taken[best] = 1; rowI[ids[best]] = sl.row; colN[ids[best]] = sl.cN;
      }
    }
    for (let i = 0; i < N; i++) { mode[i] = 1; gs[i] = 16; }
    sceneDur = 999;
  }
  function dropOut(i, j) {
    mode[i] = mode[j] = 0; inPair[i] = inPair[j] = 1;
    gx[i] = x[i]; gy[i] = y[i]; gx[j] = x[j]; gy[j] = y[j];
    const p = makeDuel(i, j, { tempo: rr(0.8, 1.1) });
    p.arriving = false; p.walk = 12; { const a = rand() * TAU, r = rr(16, 46); p.sx = clamp(p.cx + Math.cos(a) * r, 16, W - 16); p.sy = clamp(p.cy + Math.sin(a) * r * 0.8, 16, D - 16); }
    p.steps = [stSalute(p), stCircle(p, rr(0.8, 1.6))];
    pairs.push(p); pairedCount += 2;
  }
  let bounds = [], nextB = 0;
  function updateMurmur(dt) {
    mT += dt;
    // the horn sounds a little BEFORE each change of formation, and the flocks answer it
    while (nextB < bounds.length && mT + LEAD[bounds[nextB].kind] >= bounds[nextB].t) { emit('formation', { kind: bounds[nextB].kind }); nextB++; }
    const sinceCharge = mT - chargeAt;
    const rush = smooth((sinceCharge - 3) / 2.5);
    const squeeze = 0.6 * clamp((sinceCharge - 1) / 2, 0, 1);
    buildGrid();
    huntT -= dt;
    if (sinceCharge > 9 && huntT <= 0) {
      huntT = 0.5;
      for (let i = 0; i < N; i++) {
        hunt[i] = -1; if (mode[i] !== 1) continue;
        let bd = 1e12;
        for (let j = 0; j < N; j++) { if (mode[j] !== 1 || team[j] === team[i]) continue; const d2 = (x[j] - x[i]) ** 2 + (y[j] - y[i]) ** 2; if (d2 < bd) { bd = d2; hunt[i] = j; } }
      }
    }
    const chase = clamp((mT - (tMuster - 1)) / 3, 0, 1) * (1 - clamp((mT - tChaseEnd) / 3, 0, 1));
    waveAmp = chase;
    for (let i = 0; i < N; i++) {
      if (mode[i] !== 1) continue;
      const tm = team[i];
      slotTarget(tm, rowI[i], colN[i], mT, squeeze, TP);
      slotTarget(tm, rowI[i], colN[i], mT + 0.25, squeeze, TQ);
      let px = TP[0], py = TP[1];
      const lvx = (TQ[0] - px) / 0.25, lvy = (TQ[1] - py) / 0.25;
      if (sinceCharge > 9) { const j = hunt[i]; if (j >= 0 && mode[j] === 1) { px = x[j]; py = y[j]; } }
      let sx = 0, sy = 0;
      const c0 = Math.floor(x[i] / CELL) + 1, r0 = Math.floor(y[i] / CELL) + 1;
      for (let r = r0 - 1; r <= r0 + 1; r++) {
        if (r < 0 || r >= GR) continue;
        for (let c = c0 - 1; c <= c0 + 1; c++) {
          if (c < 0 || c >= GC) continue;
          for (let j = gHead[r * GC + c]; j >= 0; j = gNext[j]) {
            if (j === i) continue;
            const dx = x[i] - x[j], dy = y[i] - y[j], dd = Math.hypot(dx, dy);
            if (dd < 5.5 && dd > 1e-3) { const w = (5.5 - dd) / 5.5; sx += (dx / dd) * w; sy += (dy / dd) * w; }
          }
        }
      }
      const vmax = 26 + 22 * chase + 16 * (1 - smooth(mT / 12)) + 4 * smooth(sinceCharge / 3) + 34 * rush;
      const accCap = 80 + 40 * chase + 100 * rush;
      let ax = 5.5 * (px - x[i]) + 3.2 * (lvx - vx[i]) + sx * 150, ay = 5.5 * (py - y[i]) + 3.2 * (lvy - vy[i]) + sy * 150;
      const am = Math.hypot(ax, ay);
      if (am > accCap) { ax *= accCap / am; ay *= accCap / am; }
      vx[i] += ax * dt; vy[i] += ay * dt;
      const sp = Math.hypot(vx[i], vy[i]), vm = vmax * bias[i];
      if (sp > vm) { vx[i] *= vm / sp; vy[i] *= vm / sp; }
      if (!trk[i]) {
        if (sinceCharge > 0.5) wt[i] = 150; // weapons up for the charge
        else if (sinceCharge > -3) wt[i] = 100;
        else if (chase > 0.3) wt[i] = 92 + 32 * Math.sin(0.9 * rowI[i] - 2.4 * mT); // a ripple down the spears
        else wt[i] = IDLE;
      }
    }
    for (let i = 0; i < N; i++) if (mode[i] === 1) { x[i] += vx[i] * dt; y[i] += vy[i] * dt; }

    // drop-outs: where opposing flock members meet, a pair leaves the flock to fight
    const charging = sinceCharge > 2;
    const rate = charging ? 90 : mT > chargeAt - 12 ? 1.1 : mT > tMuster + 3 ? 0.8 : 0;
    dropBudget = Math.min(dropBudget + rate * dt, charging ? 12 : 2);
    const cr = charging ? 10 : 7;
    if (dropBudget >= 1) {
      const start = Math.floor(rand() * N);
      for (let q = 0; q < N && dropBudget >= 1; q++) {
        const i = (start + q) % N;
        if (mode[i] !== 1) continue;
        let best = -1, bd = cr * cr;
        const c0 = Math.floor(x[i] / CELL) + 1, r0 = Math.floor(y[i] / CELL) + 1;
        for (let r = r0 - 1; r <= r0 + 1; r++) {
          if (r < 0 || r >= GR) continue;
          for (let c = c0 - 1; c <= c0 + 1; c++) {
            if (c < 0 || c >= GC) continue;
            for (let j = gHead[r * GC + c]; j >= 0; j = gNext[j]) {
              if (mode[j] !== 1 || team[j] === team[i]) continue;
              const dx = x[j] - x[i], dy = y[j] - y[i], d2 = dx * dx + dy * dy;
              if (d2 < bd) { bd = d2; best = j; }
            }
          }
        }
        if (best >= 0) { dropOut(i, best); dropBudget -= 1; }
      }
    }
    if (sinceCharge > 4 && (pairedCount >= N - 6 || sinceCharge > 22)) {
      const left = [];
      for (let i = 0; i < N; i++) if (mode[i] === 1) left.push(i);
      if (left.length) {
        const ex = []; for (let i = 0; i < N; i++) if (mode[i] !== 1) ex.push(i);
        const extra = pairUp(true, ex);
        for (const p of extra) { mode[p.a] = mode[p.b] = 0; inPair[p.a] = inPair[p.b] = 1; p.walk = 9; p.steps = [stSalute(p), stCircle(p, rr(0.5, 1.2))]; pairs.push(p); }
      }
      sceneDur = 0;
    }
  }

  // ---------- integrator ----------
  function stepSeek(dt) {
    buildGrid();
    const acc = 1 - Math.exp(-6 * dt);
    for (let i = 0; i < N; i++) {
      if (mode[i] !== 0) continue;
      const ddx = gx[i] - x[i], ddy = gy[i] - y[i], d = Math.hypot(ddx, ddy);
      let sp = hold[i] > 0 ? 0 : Math.min(gs[i], d * gk[i]) * bias[i];
      if (hold[i] > 0) hold[i] -= dt;
      if (lying[i] > 0) sp = 0;
      let tvx = d > 1e-3 ? (ddx / d) * sp : 0, tvy = d > 1e-3 ? (ddy / d) * sp : 0;
      const c0 = Math.floor(x[i] / CELL) + 1, r0 = Math.floor(y[i] / CELL) + 1;
      let sx = 0, sy = 0;
      for (let r = r0 - 1; r <= r0 + 1; r++) {
        if (r < 0 || r >= GR) continue;
        for (let c = c0 - 1; c <= c0 + 1; c++) {
          if (c < 0 || c >= GC) continue;
          for (let j = gHead[r * GC + c]; j >= 0; j = gNext[j]) {
            if (j === i) continue;
            const dx = x[i] - x[j], dy = y[i] - y[j], dd = Math.hypot(dx, dy);
            if (dd < sepR && dd > 1e-3) { const w = (sepR - dd) / sepR; sx += (dx / dd) * w; sy += (dy / dd) * w; }
          }
        }
      }
      const fighting = inPair[i] || (scene === 'pairs') || (scene === 'gather' && mc && mc.duel && (i === mc.duel.a || i === mc.duel.b));
      const k = fighting ? 0.35 : 1; // fighters may stand close
      tvx += sx * sepK * k; tvy += sy * sepK * k;
      if (scene === 'chariots') {
        for (const ch of chariots) {
          const dx = x[i] - ch.x, dy = y[i] - ch.y, dd = Math.hypot(dx, dy), R = cT < PASS_T + 1 ? 46 : 40;
          if (dd < R && dd > 1e-3) {
            const w = 1 - dd / R, hl = Math.hypot(ch.vx, ch.vy) || 1, hxn = ch.vx / hl, hyn = ch.vy / hl;
            const side = hxn * dy - hyn * dx >= 0 ? 1 : -1;
            tvx += (dx / dd) * w * 50 + -hyn * side * w * 130; tvy += (dy / dd) * w * 50 + hxn * side * w * 130;
            if (dd < 30 && hopT[i] <= 0 && !trk[i]) { hop(i, rr(3, 6), 0.5); setW(i, [[0, 72], [0.15, 135], [0.8, 135], [1.0, 72]]); }
          }
        }
      }
      vx[i] += (tvx - vx[i]) * acc; vy[i] += (tvy - vy[i]) * acc;
    }
    for (let i = 0; i < N; i++) if (mode[i] === 0) { x[i] += vx[i] * dt; y[i] += vy[i] * dt; }
  }

  function finishAgents(dt) {
    for (let i = 0; i < N; i++) {
      x[i] = clamp(x[i], 2, W - 2); y[i] = clamp(y[i], 2, D - 2);
      const sp = Math.hypot(vx[i], vy[i]);
      if (hasLook[i]) { const dl = lx[i] - x[i]; if (Math.abs(dl) > 1.2) dirS[i] = dl >= 0 ? 1 : -1; }
      else if (sp > 4) dirS[i] = vx[i] >= 0 ? 1 : -1;
      if (spinT[i] > 0) { spinT[i] -= dt; dirS[i] = Math.floor(spinT[i] * 12) & 1 ? 1 : -1; }
      bob[i] += sp * dt * 0.55;
      if (lying[i] > 0) lying[i] -= dt;
      if (flipT[i] > 0) flipT[i] -= dt;
      if (leanT[i] > 0) leanT[i] -= dt;
      gripN[i] -= dt; if (gripN[i] <= 0) { grip[i] = pickGrip(); gripN[i] = rr(6, 20); }
      if (crouch[i] > 0) crouch[i] -= dt;
      zNow[i] = 0;
      if (scene === 'murmur' && mode[i] === 1 && waveAmp > 0.3) { const w = Math.sin(0.9 * rowI[i] - 2.4 * mT); if (w > 0) zNow[i] += 1.7 * w * w * waveAmp; }
      if (hopT[i] > 0) { hopT[i] -= dt; if (hopT[i] > 0 && hopT[i] <= hopD[i]) { const u = 1 - hopT[i] / hopD[i]; zNow[i] = hopH[i] * 4 * u * (1 - u); } }
      if (ride[i]) zNow[i] = rideZ[i];
      if (swT[i] > 0) swT[i] -= dt;
      const tk = trk[i];
      if (tk) {
        tk.t += dt;
        const ks = tk.keys, last = ks[ks.length - 1];
        if (tk.t >= last[0]) { wa[i] = last[1]; trk[i] = null; }
        else {
          let s = 0; while (s < ks.length - 2 && tk.t >= ks[s + 1][0]) s++;
          const k0 = ks[s], k1 = ks[s + 1], u = (tk.t - k0[0]) / Math.max(1e-4, k1[0] - k0[0]);
          wa[i] = k0[1] + (k1[1] - k0[1]) * smooth(u);
        }
      } else {
        const idle = swT[i] <= 0 && wt[i] < -900;
        const tgt = swT[i] > 0 ? swA[i] : idle ? grip[i] : wt[i];
        wa[i] += (tgt - wa[i]) * (1 - Math.exp(-(idle ? 3.5 : 14) * dt));
      }
    }
    for (const j of javs) {
      if (j.stuck) { j.st += dt; continue; }
      j.t += dt;
      if (j.t >= j.T) { j.stuck = true; j.st = 0; }
    }
    javs = javs.filter((j) => !(j.stuck && j.st > 6));
    for (const d of drops) {
      if (d.rest) continue;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.vz -= 150 * dt; d.ang += 14 * dt;
      d.x = clamp(d.x, 5, W - 5); d.y = clamp(d.y, 5, D - 5);
      if (d.z <= 0) { d.z = 0; d.rest = true; }
    }
    for (const q of flipQ) { q.t -= dt; if (q.t <= 0 && !q.done) { q.done = true; flip(q.i, 0.7, 1); } }
    while (flipQ.length && flipQ[0].done) flipQ.shift();
    for (const f of fx) { if (f.delay > 0) f.delay -= dt; else f.age += dt; }
    fx = fx.filter((f) => f.age < f.life);
  }

  // ---------- scene flow ----------
  function goNext() {
    loops += scene === 'murmur' ? 1 : 0;
    if (scene === 'pairs') { scene = 'gather'; enterGather(); }
    else if (scene === 'gather') { scene = 'volleys'; enterVolleys(); }
    else if (scene === 'volleys') {
      if (rand() < 0.8) { scene = 'chariots'; enterChariots(); } else { scene = 'murmur'; enterMurmur(); }
    }
    else if (scene === 'chariots') { scene = 'murmur'; enterMurmur(); }
    else if (scene === 'murmur') { scene = 'pairs'; enterPairs('adopt'); for (let i = 0; i < N; i++) { mode[i] = 0; } }
    else { scene = 'pairs'; enterPairs('normal'); }
    sceneT = 0;
    emit('scene', { name: scene });
  }
  function update(dt) {
    clock += dt; sceneT += dt;
    if (scene === 'gather') updateGather(dt);
    if (scene === 'pairs' || scene === 'gather' || scene === 'murmur') updatePairs(dt);
    if (scene === 'volleys') updateVolleys(dt);
    if (scene === 'chariots') updateChariots(dt);
    if (scene === 'murmur') updateMurmur(dt);
    stepSeek(dt);
    finishAgents(dt);
    if (sceneT >= sceneDur) goNext();
  }
  function step(dt) {
    let left = Math.min(dt, 0.25);
    while (left > 1e-6) { const h = Math.min(left, 1 / 30); update(h); left -= h; }
  }

  // ---------- render ----------
  function render(P) {
    for (const p of posts) { if (P.anchor) P.anchor(p.x, p.y); const sy = p.y * S; P.line(p.x, sy, p.x, sy - 12, 0xb59a6a, 1); P.rect(p.x - 2, sy - 12, 5, 2, 0xb59a6a, 1); }
    for (const j of javs) if (j.stuck) {
      if (P.anchor) P.anchor(j.ex, j.ey);
      const a = clamp(1 - Math.max(0, j.st - 4) / 2, 0, 1), sy = j.ey * S;
      if (j.dart) P.line(j.ex, sy, j.ex - 1, sy - 3, WEAPON, a); else P.line(j.ex, sy, j.ex - 2, sy - 5, WEAPON, a);
    }
    const items = [];
    for (let i = 0; i < N; i++) items.push([y[i], i, 0]);
    for (let k = 0; k < chariots.length; k++) items.push([chariots[k].y, k, 1]);
    for (let k = 0; k < drops.length; k++) items.push([drops[k].y, k, 2]);
    items.sort((p, q) => p[0] - q[0]);
    for (const [, id, kind] of items) {
      if (P.anchor) { if (kind === 0) P.anchor(x[id], y[id]); else if (kind === 1) P.anchor(chariots[id].x, chariots[id].y); else P.anchor(drops[id].x, drops[id].y); }
      if (kind === 1) { drawChariot(P, chariots[id]); continue; }
      if (kind === 2) {
        const d = drops[id], sy = d.y * S - d.z, ca = Math.cos(d.ang) * 3.5, sa = Math.sin(d.ang) * 3.5 * (d.rest ? 0.4 : 1);
        if (!d.rest) P.rect(Math.round(d.x), Math.round(d.y * S), 2, 1, SHADOW, 0.2);
        P.line(d.x - ca, sy - sa, d.x + ca, sy + sa, WEAPON, 1);
        continue;
      }
      const i = id, gyS = y[i] * S, sp = Math.hypot(vx[i], vy[i]);
      const s = dirS[i], tun = special[i] ? INSTR : PAL[team[i]][pal[i]];
      const z = lying[i] > 0 ? 0 : zNow[i] + (sp > 6 ? Math.abs(Math.sin(bob[i])) * 1.2 : 0);
      const px = Math.round(x[i]), py = Math.round(gyS - z);
      if (far) {
        if (lying[i] > 0) { P.rect(px - 2, Math.round(gyS) - 2, 4, 2, tun, 1); continue; }
        P.rect(px - 1, py - 7, 3, 6, tun, 1);
        if (armed[i]) {
          const a = (wa[i] * Math.PI) / 180, hx0 = px + s * 2, hy0 = py - 5;
          P.line(hx0, hy0, hx0 + s * Math.cos(a) * 6, hy0 - Math.sin(a) * 6, WEAPON, 1);
        }
        continue;
      }
      P.rect(px - 1, Math.round(gyS), 3, 1, SHADOW, z > 1.5 ? 0.12 : 0.2);
      if (lying[i] > 0) {
        const gy0 = Math.round(gyS);
        P.rect(px - 3, gy0 - 2, 5, 2, tun, 1);
        P.rect(px + 2 * s, gy0 - 2, 2, 2, SKIN[skin[i]], 1);
        P.rect(px - 4 * s, gy0 - 1, 2, 1, LEG, 1);
        continue;
      }
      const cr = crouch[i] > 0;
      const step_ = sp > 6 && Math.sin(bob[i] * 2) > 0 ? 1 : 0;
      const ox = leanT[i] > 0 ? s : 0;
      const ph = flipT[i] > 0 ? Math.floor((1 - flipT[i] / flipD[i]) * 4 * flipN[i]) & 3 : 0;
      if (ph === 1 || ph === 3) {
        const fw = ph === 1 ? s : -s;
        P.rect(px - 2, py - 6, 4, 3, tun, 1);
        P.rect(fw > 0 ? px + 2 : px - 4, py - 6, 2, 2, SKIN[skin[i]], 1);
        P.rect(fw > 0 ? px - 4 : px + 2, py - 5, 2, 1, LEG, 1);
      } else if (ph === 2) {
        P.rect(px - 1, py - 10, 1, 2, LEG, 1); P.rect(px + 1, py - 10, 1, 2, LEG, 1);
        P.rect(px - 1, py - 8, 3, 4, tun, 1);
        P.rect(px - 1, py - 4, 2, 2, SKIN[skin[i]], 1);
      } else if (cr) {
        P.rect(px - 1, py - 1, 3, 1, LEG, 1);
        P.rect(px - 1, py - 4, 3, 3, tun, 1);
        P.rect(px - 1, py - 6, 2, 2, SKIN[skin[i]], 1);
      } else {
        P.rect(px - 1, py - 2 - step_, 1, 2, LEG, 1);
        P.rect(px + 1, py - 3 + step_, 1, 2, LEG, 1);
        P.rect(px - 1 + ox, py - 6, 3, 4, tun, 1);
        P.rect(px - 1 + ox, py - 8, 2, 2, SKIN[skin[i]], 1);
      }
      if (armed[i]) {
        const a = (wa[i] * Math.PI) / 180, hx0 = px + s * 2, hy0 = py - (cr ? 3 : 5);
        P.line(hx0, hy0, hx0 + s * Math.cos(a) * 8, hy0 - Math.sin(a) * 8, WEAPON, 1);
      }
    }
    for (const j of javs) if (!j.stuck) {
      const u = j.t / j.T, gxp = j.sx + (j.ex - j.sx) * u, gyp = j.sy + (j.ey - j.sy) * u;
      if (P.anchor) P.anchor(gxp, gyp);
      const z = j.apex * 4 * u * (1 - u), sxp = gxp, syp = gyp * S - z - 6;
      const dxs = j.ex - j.sx, dys = (j.ey - j.sy) * S - j.apex * 4 * (1 - 2 * u), L = Math.hypot(dxs, dys) || 1;
      const hl = j.dart ? 2 : 3.5;
      P.line(sxp - (dxs / L) * hl, syp - (dys / L) * hl, sxp + (dxs / L) * hl, syp + (dys / L) * hl, WEAPON, 1);
    }
    for (const f of fx) {
      if (f.delay > 0) continue;
      if (P.anchor) P.anchor((x[f.a] + x[f.b]) / 2, (y[f.a] + y[f.b]) / 2);
      const mx = Math.round((x[f.a] + x[f.b]) / 2), my = Math.round(((y[f.a] + y[f.b]) / 2) * S - 6), al = 1 - f.age / f.life;
      P.rect(mx - 2, my, 5, 1, 0xffe9a0, al); P.rect(mx, my - 2, 1, 5, 0xffe9a0, al); P.rect(mx, my, 1, 1, 0xffffff, al);
    }
    if (P.anchor) P.anchor(null);
  }
  // A chariot: a pair of ponies, the pole, a wicker car on a spoked wheel and a driver with a javelin.
  // Seen from the side when it crosses the view, from in front when it comes at us and from behind
  // when it goes away. The gallop (legs, bob), the wheel and the dust all follow the distance travelled.
  const PONY = [0x6a4a34, 0x9a9890, 0x2e2a28, 0x8a5a38, 0x5a3e2c];
  function drawChariot(P, c) {
    const vxs = c.vx, vys = c.vy * S, side = Math.abs(vys) < Math.abs(vxs) * 0.9, s = vxs >= 0 ? 1 : -1;
    const px = c.x, py = c.y * S, ph = (c.dist / 13) * TAU, wa = c.dist / 3;
    const col = PONY[c.k % PONY.length], dark = 0x2a211c, WOOD = 0x7a5a3a, RAIL = 0x5a4030, DUST = 0xcfc3a8, TUN = 0x8a3a2a;
    // dust
    c.trail.forEach((t, k) => { const a = 0.05 + 0.04 * k, r = 2 + (c.trail.length - k) * 0.5; P.rect(Math.round(t.x) - r / 2, Math.round(t.y * S) - r, r * 1.6, r, DUST, a); });
    const R = (ox, y, w, h, cc) => P.rect(px + (s > 0 ? ox : -ox - w), py + y, w, h, cc, 1);
    const L = (x1, y1, x2, y2, cc) => P.line(px + s * x1, py + y1, px + s * x2, py + y2, cc, 1);
    if (side) {
      P.rect(px - 9, py - 1, 28, 2, SHADOW, 0.18);
      const bob = -Math.abs(Math.sin(ph * 0.5)) * 1.3;
      const pony = (ox, dy, cc, p0) => {
        const b = dy + bob;
        // legs (behind the body): rear pair, front pair, each swinging and lifting on its own beat
        for (const [hx, off] of [[ox + 0.8, 0], [ox + 1.8, 0.5], [ox + 6.4, 2.1], [ox + 7.4, 2.7]]) {
          const q = p0 + off, fx = hx + Math.sin(q) * 2.6, lift = Math.max(0, Math.cos(q)) * 2;
          L(hx, b - 5, fx, dy - lift, dark);
        }
        R(ox, b - 9, 8, 4, cc);                               // body
        R(ox + 6.5, b - 12, 2.2, 4.5, cc);                    // neck
        R(ox + 8.2, b - 12.5, 3.8, 2, cc);                    // head
        R(ox + 8.4, b - 14, 1, 1.6, cc);                      // ear
        L(ox + 6.6, b - 12, ox + 5.6, b - 9.6, dark);         // mane
        L(ox, b - 8.4, ox - 3, b - 6.2 + Math.sin(ph) * 0.9, dark);   // tail streaming
      };
      pony(5.2, -3.2, ((col >> 16 & 255) * 0.7 << 16) | ((col >> 8 & 255) * 0.7 << 8) | (col & 255) * 0.7, ph + 0.9);   // far pony, a little darker
      pony(3, 0, col, ph);
      // pole and yoke
      L(-0.4, -4.6, 9.5, -7.4, RAIL);
      // car
      R(-8, -7, 8, 3, WOOD); R(-8, -8.2, 8, 1.2, RAIL); R(-1.2, -9.5, 1.2, 5, RAIL);
      // driver
      R(-5.4, -13.2, 2, 6.2, TUN); R(-5.2, -15.4, 1.8, 2.2, SKIN[0]);
      L(-3.4, -11.5, 4.5, -16.5, WEAPON);
      // wheel: rim and three spokes turning
      const wx = -4.2, wy = -3, wr = 3.1;
      for (let k = 0; k < 8; k++) { const a1 = (k / 8) * TAU, a2 = ((k + 1) / 8) * TAU; L(wx + Math.cos(a1) * wr, wy + Math.sin(a1) * wr, wx + Math.cos(a2) * wr, wy + Math.sin(a2) * wr, dark); }
      for (let k = 0; k < 3; k++) { const a = wa * s + (k / 3) * Math.PI; L(wx - Math.cos(a) * wr, wy - Math.sin(a) * wr, wx + Math.cos(a) * wr, wy + Math.sin(a) * wr, 0x4a3828); }
    } else {
      const away = vys < 0, bob = -Math.abs(Math.sin(ph * 0.5)) * 1.2, cy = away ? 0 : -6, ny = away ? -7 : 0;
      P.rect(px - 7, py - 1, 14, 2, SHADOW, 0.18);
      // car (behind the team when coming at us, in front of it when going away)
      const car = () => {
        R(-4.5, cy - 8, 9, 4, WOOD); R(-4.5, cy - 9.2, 9, 1.2, RAIL);
        for (const sx of [-5.6, 4.6]) { const sp = Math.floor(wa) & 1; R(sx, cy - 6.2, 1, 6.2, sp ? 0x4a3828 : dark); }
        R(-1, cy - 15, 2.2, 6.5, TUN); R(-0.9, cy - 17.2, 2, 2.2, SKIN[0]);
        P.line(px + 2, py + cy - 12, px + 2, py + cy - 18.5, WEAPON, 1);
      };
      const ponies = () => {
        for (const sx of [-3, 3]) {
          const q = ph + (sx > 0 ? 0.8 : 0), b = ny + bob;
          for (const [lx, off] of [[sx - 1, 0], [sx + 1, 1.6]]) { const lift = Math.max(0, Math.cos(q + off)) * 2; P.line(px + lx, py + b - 4, px + lx, py + ny - lift, dark, 1); }
          P.rect(px + sx - 1.8, py + b - 10, 3.6, 6.5, col, 1);                   // chest / rump
          if (!away) { P.rect(px + sx - 1.1, py + b - 14, 2.2, 4.5, col, 1); P.rect(px + sx - 1.5, py + b - 14.8, 0.8, 1.4, col, 1); P.rect(px + sx + 0.7, py + b - 14.8, 0.8, 1.4, col, 1); }
          else P.line(px + sx, py + b - 9, px + sx + Math.sin(ph) * 1.2, py + b - 4.5, dark, 1);   // tails
        }
        P.line(px - 3, py + ny - 6, px, py + cy - 5, RAIL, 1); P.line(px + 3, py + ny - 6, px, py + cy - 5, RAIL, 1);
      };
      if (away) { ponies(); car(); } else { car(); ponies(); }
    }
  }

  // ---------- start ----------
  scene = 'gather'; enterGather(true);
  buildGrid();

  return {
    n: N, width: W, depth: D, squash: S, step, render,
    get scene() { return scene; }, get sceneTime() { return sceneT; }, get sceneLeft() { return sceneDur - sceneT; }, get loops() { return loops; },
    get time() { return clock; },
    // jump straight to a scene (handy for previews and tuning)
    force(name) {
      scene = name === 'charge' ? 'murmur' : name; sceneT = 0;
      ({ pairs: () => enterPairs('normal'), gather: enterGather, volleys: enterVolleys, chariots: enterChariots, murmur: enterMurmur, charge: () => { enterMurmur(); mT = chargeAt - 6; } })[name]();
    },
    get debug() { return { pairs: pairs.length, paired: pairedCount, mT, chargeAt, act: mc ? mc.act : null, fin: mc ? mc.fin : null, duelStep: mc && mc.duel && mc.duel.cur ? mc.duel.cur.dur : null }; },
    _state: { x, y, vx, vy, team, mode, armed, lying },
    _pairs: () => pairs,
  };
}

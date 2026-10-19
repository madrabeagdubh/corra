// worldBus.js
// Location: js/game/systems/worldBus.js
//
// One stage between everything the game plays and the speakers, so the WORLD can be pushed
// away while something of yours stays clear (bullet time: the world muffles, your heartbeat
// and the slow's own sounds do not).
//
// Every node the game connects to `ctx.destination` is really connected to this stage's
// input (a gain, then a low-pass filter, then the real destination). A sound that must stay
// clear connects to WorldBus.dry(ctx) instead.
//
//   WorldBus.setDepth(u)   0..1: how far the world is pushed away (0 = not at all). Call it every
//                          frame while it is held: if the calls stop, it lets go by itself.
//   WorldBus.dry(ctx)      the real destination (round the muffling)
//
// Import this FIRST (js/main.js), before any AudioContext exists: a context made earlier has
// no stage and is simply not muffled. To switch the whole thing off, set WORLD_BUS = false:
// nothing is patched, and dry(ctx) is just ctx.destination.

export const WORLD_BUS = true

const FREE_HZ = 20000          // the filter's cutoff when the world is not pushed away (above hearing)
const DEEP_HZ = 650            // ... and at full depth
const DUCK = 0.2               // how much quieter the world gets at full depth
const LET_GO_MS = 500          // no setDepth for this long: the world comes back

const stages = []              // { ctx, inp, lp, raw }
const byCtx = new WeakMap()
let origGet = null             // the real `destination` getter
let depth = 0, lastSet = 0, watchdog = null

function hzFor(ctx, u) {
  const top = Math.min(FREE_HZ, ctx.sampleRate / 2)
  return Math.min(ctx.sampleRate / 2, top * Math.pow(DEEP_HZ / top, u))
}

function apply(s, tc) {
  try {
    const now = s.ctx.currentTime
    s.lp.frequency.setTargetAtTime(hzFor(s.ctx, depth), now, tc)
    s.inp.gain.setTargetAtTime(1 - DUCK * depth, now, tc)
  } catch (_) {}
}

function stageFor(ctx) {
  let s = byCtx.get(ctx)
  if (s) return s
  const raw = origGet.call(ctx)
  const inp = ctx.createGain(), lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'; lp.Q.value = 0.7
  lp.frequency.value = hzFor(ctx, 0)
  inp.connect(lp); lp.connect(raw)
  s = { ctx, inp, lp, raw }
  byCtx.set(ctx, s); stages.push(s)
  if (depth > 0) apply(s, 0.05)                 // a context made in the middle of it
  return s
}

function install() {
  if (!WORLD_BUS || typeof window === 'undefined') return
  try {
    const Base = window.BaseAudioContext || window.webkitAudioContext || window.AudioContext
    if (!Base) return
    const d = Object.getOwnPropertyDescriptor(Base.prototype, 'destination')
    if (!d || !d.get || !d.configurable || d.get.__worldBus) return
    origGet = d.get
    const get = function () {
      try { return stageFor(this).inp } catch (e) { return origGet.call(this) }       // whatever goes wrong, the sound still plays
    }
    get.__worldBus = true
    Object.defineProperty(Base.prototype, 'destination', { configurable: true, enumerable: d.enumerable, get })
  } catch (e) { console.warn('[worldBus] not installed:', e) }
}
install()

export const WorldBus = {
  setDepth(u) {
    if (!origGet) return
    u = Math.max(0, Math.min(1, u || 0))
    lastSet = performance.now()
    if (Math.abs(u - depth) < 0.01 && !(u === 0 && depth !== 0)) return
    const deeper = u > depth
    depth = u
    for (const s of stages) apply(s, deeper ? 0.06 : 0.22)      // in quickly, out in a breath
    if (depth > 0 && !watchdog) {
      watchdog = setInterval(() => {
        if (performance.now() - lastSet > LET_GO_MS) WorldBus.setDepth(0)
        if (depth === 0 && watchdog) { clearInterval(watchdog); watchdog = null }
      }, 250)
    } else if (depth === 0 && watchdog) { clearInterval(watchdog); watchdog = null }
  },

  dry(ctx) {
    try { return origGet ? origGet.call(ctx) : ctx.destination } catch (_) { return ctx.destination }
  },
}

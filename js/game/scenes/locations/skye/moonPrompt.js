// moonPrompt.js
// Location: js/game/scenes/locations/skye/moonPrompt.js
//
// Shows the gesture to make on the moon, the way the constellation scene
// prompts the stars: a small light that does the thing, over and over, until
// you do it.
//
//   up    a light rises from the moon's foot, past its crown, and fades
//   down  the same, falling
//   tap   a ring opens on the moon
//   hold  a ring gathers slowly, then flashes (the strong blow)
//
//   const mp = new MoonPrompt(scene);  mp.set('up');  mp.set(null);  mp.destroy()
//
// It sits just above the moon and never takes a tap, and it is a faint thing
// (a light, a ring), so the English on the moon stays readable under it.

const STYLE_ID = 'moon-prompt-style'
const CSS = `
@keyframes mpUp   { 0% { transform: translateY(46%);  opacity: 0 } 10% { opacity: 1 } 80% { opacity: 1 } 100% { transform: translateY(-62%); opacity: 0 } }
@keyframes mpDown { 0% { transform: translateY(-62%); opacity: 0 } 10% { opacity: 1 } 80% { opacity: 1 } 100% { transform: translateY(46%);  opacity: 0 } }
@keyframes mpTap  { 0% { transform: scale(0.3); opacity: 0.9 } 100% { transform: scale(1.15); opacity: 0 } }
@keyframes mpHold { 0% { transform: scale(0.2); opacity: 0.2 } 70% { transform: scale(0.95); opacity: 0.9 } 82% { transform: scale(1.05); opacity: 1; filter: brightness(1.8) } 100% { transform: scale(1.15); opacity: 0 } }
`
const GLOW = 'rgba(153,204,255,0.9)', CORE = '#ddeeff'

export default class MoonPrompt {
  constructor(scene) {
    this.scene = scene
    this.kind = null
    if (!document.getElementById(STYLE_ID)) {
      const st = document.createElement('style'); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st)
    }
    document.getElementById('moon-prompt')?.remove()
    const el = document.createElement('div')
    el.id = 'moon-prompt'
    el.style.cssText = 'position:fixed;pointer-events:none;z-index:1000005;overflow:visible;display:none'
    document.body.appendChild(el)
    this.el = el
  }

  _place() {
    const c = this.scene.joystick?.getMoonCanvas?.()
    const r = c?.getBoundingClientRect?.()
    if (!r || !r.width) return false
    const d = Math.min(r.width, r.height)
    Object.assign(this.el.style, { left: `${r.left + r.width / 2 - d / 2}px`, top: `${r.top + r.height / 2 - d / 2}px`, width: `${d}px`, height: `${d}px` })
    this.d = d
    return true
  }

  set(kind) {
    if (kind === this.kind) return
    this.kind = kind
    this.el.innerHTML = ''
    if (!kind) { this.el.style.display = 'none'; return }
    if (!this._place()) { this.el.style.display = 'none'; return }
    this.el.style.display = 'block'
    const d = this.d
    const mk = (css) => { const e = document.createElement('div'); e.style.cssText = css; this.el.appendChild(e); return e }
    if (kind === 'up' || kind === 'down') {
      const dot = d * 0.24, tail = d * 0.7, dir = kind === 'up'
      const wrap = mk(`position:absolute;left:${d / 2 - dot / 2}px;top:${d / 2 - tail / 2}px;width:${dot}px;height:${tail}px;` +
        `animation:${dir ? 'mpUp' : 'mpDown'} 1.6s ease-in-out infinite`)
      // the trail, then the light at its head
      const trail = document.createElement('div')
      trail.style.cssText = `position:absolute;left:${dot * 0.3}px;width:${dot * 0.4}px;height:${tail - dot}px;` +
        `${dir ? `top:${dot}px;background:linear-gradient(to bottom,${GLOW},rgba(153,204,255,0))` : 'top:0;background:linear-gradient(to top,' + GLOW + ',rgba(153,204,255,0))'};border-radius:99px`
      const head = document.createElement('div')
      head.style.cssText = `position:absolute;left:0;${dir ? 'top:0' : `top:${tail - dot}px`};width:${dot}px;height:${dot}px;border-radius:50%;` +
        `background:radial-gradient(circle,${CORE} 0%,${CORE} 35%,rgba(153,204,255,0.6) 70%,rgba(153,204,255,0) 100%);box-shadow:0 0 ${dot}px ${GLOW}`
      wrap.append(trail, head)
    } else {
      const hold = kind === 'hold'
      mk(`position:absolute;inset:${d * 0.08}px;border-radius:50%;border:${Math.max(3, d * 0.06)}px solid ${CORE};` +
        `box-shadow:0 0 ${d * 0.12}px ${GLOW}, inset 0 0 ${d * 0.1}px ${GLOW};` +
        `animation:${hold ? 'mpHold 1.6s ease-in' : 'mpTap 1.1s ease-out'} infinite`)
    }
  }

  destroy() { this.el?.remove(); this.el = null }
}

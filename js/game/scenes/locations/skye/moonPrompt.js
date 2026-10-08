// moonPrompt.js
// Location: js/game/scenes/locations/skye/moonPrompt.js
//
// Shows the gesture to make on the moon, the way the constellation scene
// prompts the stars: something that does the thing, over and over, until
// you do it.
//
//   up    a dotted gold line is drawn up past the moon, a fingertip at its head
//         (the same dotted line, and fingertip, that mark a drawn route)
//   down  the same, drawn downward
//   tap   a ring opens on the moon
//   hold  a larger gold ring, centred on the moon, shrinks down onto it, then flashes
//
//   const mp = new MoonPrompt(scene);  mp.set('up');  mp.set(null);  mp.destroy()
//
// It sits just above the moon and never takes a tap, and it is a faint thing,
// so the English on the moon stays readable under it.

const STYLE_ID = 'moon-prompt-style'
const GOLD = 'rgba(245,208,96,0.9)', GOLD_SOFT = 'rgba(245,208,96,0.35)', GOLD_FAINT = 'rgba(245,208,96,0.08)', FINGER = 'rgba(255,244,205,0.88)'
const CSS = `
@keyframes mpDrawUp   { 0% { clip-path: inset(100% 0 0 0); opacity: 0 } 10% { opacity: 1 } 56% { clip-path: inset(0 0 0 0) } 84% { clip-path: inset(0 0 0 0); opacity: 1 } 100% { clip-path: inset(0 0 0 0); opacity: 0 } }
@keyframes mpDrawDown { 0% { clip-path: inset(0 0 100% 0); opacity: 0 } 10% { opacity: 1 } 56% { clip-path: inset(0 0 0 0) } 84% { clip-path: inset(0 0 0 0); opacity: 1 } 100% { clip-path: inset(0 0 0 0); opacity: 0 } }
@keyframes mpFingerUp   { 0% { transform: translateY(var(--mpL)); opacity: 0 } 10% { opacity: 1 } 56% { transform: translateY(0) } 84% { transform: translateY(0); opacity: 1 } 100% { transform: translateY(0); opacity: 0 } }
@keyframes mpFingerDown { 0% { transform: translateY(0); opacity: 0 } 10% { opacity: 1 } 56% { transform: translateY(var(--mpL)) } 84% { transform: translateY(var(--mpL)); opacity: 1 } 100% { transform: translateY(var(--mpL)); opacity: 0 } }
@keyframes mpTap  { 0% { transform: scale(0.3); opacity: 0.9 } 100% { transform: scale(1.15); opacity: 0 } }
@keyframes mpHold {
  0%   { transform: scale(2.3); opacity: 0;    background-color: rgba(245,208,96,0) }
  60%  { transform: scale(1);   opacity: 0.95; background-color: rgba(245,208,96,0) }
  84%  { transform: scale(1);   opacity: 1;    background-color: rgba(245,208,96,0.78) }
  93%  { transform: scale(1);   opacity: 1;    background-color: rgba(245,208,96,0.78) }
  100% { transform: scale(1);   opacity: 0;    background-color: rgba(245,208,96,0.78) }
}
`
const BLUE_GLOW = 'rgba(153,204,255,0.9)', BLUE_CORE = '#ddeeff'

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
      // the dotted line a drawn route is shown with, and the fingertip drawing it
      const up = kind === 'up', L = d * 1.1, top = d / 2 - d * 0.62, pitch = 8, f = Math.max(14, d * 0.2)
      mk(`position:absolute;left:${d / 2 - pitch / 2}px;top:${top}px;width:${pitch}px;height:${L}px;` +
        `background:radial-gradient(circle at 50% 50%, ${GOLD} 0, ${GOLD} 2.4px, transparent 3.1px) 0 0 / ${pitch}px ${pitch}px repeat-y;` +
        `animation:${up ? 'mpDrawUp' : 'mpDrawDown'} 1.9s ease-in-out infinite`)
      mk(`position:absolute;left:${d / 2 - f / 2}px;top:${top - f / 2}px;width:${f}px;height:${f}px;box-sizing:border-box;border-radius:50%;` +
        `background:${FINGER};border:3px solid ${GOLD};--mpL:${L}px;` +
        `animation:${up ? 'mpFingerUp' : 'mpFingerDown'} 1.9s ease-in-out infinite`)
    } else if (kind === 'hold') {
      // a gold ring, bigger than the moon and centred on it, closes down onto it
      const s = d * 0.84
      mk(`position:absolute;left:${d / 2 - s / 2}px;top:${d / 2 - s / 2}px;width:${s}px;height:${s}px;box-sizing:border-box;border-radius:50%;` +
        `border:${Math.max(2, d * 0.022)}px solid ${GOLD};` +
        `box-shadow:0 0 ${d * 0.12}px ${GOLD}, inset 0 0 ${d * 0.1}px ${GOLD_SOFT};` +
        `animation:mpHold 2.8s ease-in-out infinite`)
    } else {
      mk(`position:absolute;inset:${d * 0.08}px;border-radius:50%;border:${Math.max(3, d * 0.06)}px solid ${BLUE_CORE};` +
        `box-shadow:0 0 ${d * 0.12}px ${BLUE_GLOW}, inset 0 0 ${d * 0.1}px ${BLUE_GLOW};` +
        `animation:mpTap 1.1s ease-out infinite`)
    }
  }

  destroy() { this.el?.remove(); this.el = null }
}

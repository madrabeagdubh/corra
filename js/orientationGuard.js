// orientationGuard.js -- the game is for portrait.
//  1. lock: screen.orientation.lock('portrait') -- allowed once the page is fullscreen (Android Chrome), so it is tried at load, on every
//     fullscreen change and on the first touch. Where it is refused, nothing is lost: the cover below does the work.
//  2. cover: a phone turning upright, no words. It shows (CSS only, so it can never be late) when a touch device is held on its side,
//     and the game's loop sleeps under it.
//  3. recovery: the browser reports the new size in stages while it turns, so the layout is asked to settle again after the turn,
//     and once more when the phone comes back upright.
const QUERY = '(orientation: landscape) and (pointer: coarse) and (max-height: 600px)'

const css = `
#orientGuard{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;background:#04060f;touch-action:none}
@media ${QUERY}{#orientGuard{display:flex}}
#orientGuard svg{width:min(46vh,46vw);height:min(46vh,46vw);overflow:visible}
#orientGuard .ph{transform-origin:100px 100px;animation:ogTurn 3.2s cubic-bezier(.6,0,.25,1) infinite}
#orientGuard .ar{animation:ogArrow 3.2s ease-in-out infinite}
@keyframes ogTurn{0%,22%{transform:rotate(90deg)}58%,100%{transform:rotate(0deg)}}
@keyframes ogArrow{0%,12%{opacity:0}28%,52%{opacity:1}64%,100%{opacity:0}}
`
const svg = `
<svg viewBox="0 0 200 200" aria-hidden="true">
  <defs><linearGradient id="ogScr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3a78"/><stop offset="1" stop-color="#e9a56a"/></linearGradient></defs>
  <g class="ar" fill="none" stroke="#e2dccb" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M168 62 A84 84 0 0 0 138 24"/><path d="M138 24 l-1 17 M138 24 l16 5"/>
  </g>
  <g class="ph">
    <rect x="62" y="30" width="76" height="140" rx="15" fill="#0b1022" stroke="#e2dccb" stroke-width="5"/>
    <rect x="70" y="46" width="60" height="108" rx="5" fill="url(#ogScr)" opacity=".9"/>
    <circle cx="100" cy="38" r="2.4" fill="#e2dccb"/>
    <circle cx="86" cy="76" r="1.6" fill="#fff"/><circle cx="112" cy="68" r="1.3" fill="#fff"/><circle cx="104" cy="92" r="1.1" fill="#fff"/>
    <path d="M70 140 q15 -14 30 -4 t30 -6 v24 h-60z" fill="#0b1022"/>
  </g>
</svg>`

function install() {
  if (document.getElementById('orientGuard')) return
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st)
  const el = document.createElement('div'); el.id = 'orientGuard'; el.innerHTML = svg
  el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false })
  document.body.appendChild(el)
}

const tryLock = () => { try { const r = screen.orientation?.lock?.('portrait'); if (r?.catch) r.catch(() => {}) } catch (_) {} }

let timers = []
function settle() {                                              // ask everything that listens to 'resize' to measure again, after the turn has finished
  timers.forEach(clearTimeout)
  timers = [60, 300, 800].map(ms => setTimeout(() => { window.dispatchEvent(new Event('resize')) }, ms))
}

function start() {
  install(); tryLock()
  const mq = window.matchMedia(QUERY)
  const onChange = () => {
    const g = window.game
    if (mq.matches) { try { g?.loop?.sleep?.() } catch (_) {} }
    else { try { g?.loop?.wake?.() } catch (_) {}; tryLock(); settle() }
  }
  mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange)
  if (mq.matches) onChange()
  window.addEventListener('orientationchange', settle)
  document.addEventListener('fullscreenchange', tryLock)
  document.addEventListener('webkitfullscreenchange', tryLock)
  window.addEventListener('pointerdown', tryLock, { once: true, capture: true })
}
if (document.body) start(); else window.addEventListener('DOMContentLoaded', start, { once: true })

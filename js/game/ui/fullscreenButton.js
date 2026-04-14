export function initFullscreenButton() {
  const btn = document.createElement('button')

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
if (isIOS) return  // skip creating button
  btn.id = 'pgr-fullscreen-btn'
  btn.textContent = '⛶'

  const minDim = Math.min(window.innerWidth, window.innerHeight)
  const margin = Math.round(minDim * 0.04)
  const moonR  = Math.max(24, Math.round(minDim * 0.055))
  const moonD  = moonR * 2
  const pad    = 18
  const wrapperSize = moonD + pad * 2

  btn.style.cssText = [
    'position:fixed',
    `top:${margin}px`,
    `right:${margin}px`,
    `width:${wrapperSize}px`,
    `height:${wrapperSize}px`,
    'z-index:1000004',
    'font-size:20px',
    'background:rgba(0,0,0,0.45)',
    'color:white',
    'border:1px solid rgba(255,255,255,0.25)',
    'border-radius:50%',
    'cursor:pointer',
    'display:none',
    'pointer-events:auto',
  ].join(';')

  btn.addEventListener('click', () => {
    const el = document.documentElement
    if (el.requestFullscreen)            el.requestFullscreen()
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
  })

  const update = () => {
    const inFS = !!(document.fullscreenElement || document.webkitFullscreenElement)
    btn.style.display = inFS ? 'none' : 'block'
  }

  document.addEventListener('fullscreenchange',       update)
  document.addEventListener('webkitfullscreenchange', update)
  update()

  document.body.appendChild(btn)
}

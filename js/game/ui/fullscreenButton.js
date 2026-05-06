export function initFullscreenButton() {
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return

  const btn = document.createElement('button')
  btn.id = 'pgr-fullscreen-btn'
  btn.textContent = '⛶'

  btn.style.cssText = [
    'position:fixed',
    'z-index:1000004',
    'font-size:20px',
    'background:rgba(0,0,0,0.45)',
    'color:white',
    'border:1px solid rgba(255,255,255,0.25)',
    'border-radius:50%',
    'cursor:pointer',
    'display:none',
    'pointer-events:auto',
    'transform:translate(-50%,-50%)',  // centre over target
  ].join(';')

 const positionOverMoon = () => {
  // Try several ways to find the moon wrapper
  const moon = 
    document.getElementById('moon-widget') ??
    document.querySelector('[style*="ciorcal-glass-bg"]') ??
    document.querySelector('[style*="1000003"]')

  if (moon) {
    const r = moon.getBoundingClientRect()
    btn.style.left   = (r.left + r.width  / 2) + 'px'
    btn.style.top    = (r.top  + r.height / 2) + 'px'
    btn.style.width  = r.width  + 'px'
    btn.style.height = r.height + 'px'
  } else {
    // Moon not in DOM yet — try again shortly
    setTimeout(positionOverMoon, 200)
  }
} 

  btn.addEventListener('click', () => {
    const el = document.documentElement
    if      (el.requestFullscreen)       el.requestFullscreen()
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
  })

  const update = () => {
    const inFS = !!(document.fullscreenElement || document.webkitFullscreenElement)
    if (!inFS) positionOverMoon()
    btn.style.display = inFS ? 'none' : 'block'
  }

  document.addEventListener('fullscreenchange',       update)
  document.addEventListener('webkitfullscreenchange', update)
  update()

  document.body.appendChild(btn)
}

// HPDisplay.js
// Location: js/game/ui/HPDisplay.js
//
// Your hearts, on the status bar at the bottom of the screen: a heart and a
// number, always there. The heart beats gently, faster when you're low;
// it gives a little bump when the number changes, and the number turns red
// below 30%.
//
// DOM, not Phaser: it lives inside #status-bar (statusBar.js), which every
// perspective scene recreates -- so it re-attaches itself if the bar is new.
// The scene's playerHPChanged event drives it; it lets go of that event when
// the scene shuts down (Phaser reuses a scene's emitter across visits).
//
//   const hp = new HPDisplay(scene)        // the old { x, y } is ignored
//   hp.updateDisplay(current, max)
//   hp.destroy()

const STYLE_ID = 'hp-display-style'

export default class HPDisplay {
  constructor(scene, _opts = {}) {
    this.scene = scene
    this.cur = 0; this.max = 0
    if (!document.getElementById(STYLE_ID)) {
      const st = document.createElement('style')
      st.id = STYLE_ID
      st.textContent = `
        @keyframes hpBeat { 0%,100% { transform: scale(1) } 12% { transform: scale(1.14) } 24% { transform: scale(1) } 36% { transform: scale(1.08) } }
        @keyframes hpBump { 0% { transform: scale(1) } 35% { transform: scale(1.35) } 100% { transform: scale(1) } }
      `
      document.head.appendChild(st)
    }
    this.el = document.createElement('div')
    this.el.id = 'hp-display'
    this.el.style.cssText = [
      'position:absolute', 'left:12px', 'top:50%', 'transform:translateY(-50%)',
      'display:flex', 'align-items:center', 'gap:6px', 'pointer-events:none', 'z-index:51',
    ].join(';')
    this.heart = document.createElement('img')
    this.heart.src = 'assets/icons/heart.png'
    this.heart.alt = ''
    this.heart.style.cssText = 'width:18px;height:18px;image-rendering:pixelated;animation:hpBeat 1.6s ease-in-out infinite;'
    this.text = document.createElement('span')
    this.text.style.cssText = "font:bold 15px 'Courier Prime','Courier New',monospace;color:#f3e6c4;text-shadow:0 1px 2px #000;min-width:1.2em;"
    this.el.append(this.heart, this.text)
    this._attach()

    scene.events.on('playerHPChanged', this.updateDisplay, this)
    // Phaser reuses a scene's event emitter when the scene starts again, so
    // without this a display from an earlier visit would still answer.
    scene.events.once('shutdown', this.destroy, this)
    // the status bar may be built a moment after us: move onto it when it is
    this._late = setTimeout(() => this._attach(), 700)
  }

  // on the status bar if there is one; otherwise the same strip, on its own
  _attach() {
    if (!this.el) return
    const bar = document.getElementById('status-bar')
    if (bar && this.el.parentNode !== bar) {
      this.el.style.position = 'absolute'; this.el.style.top = '50%'; this.el.style.bottom = ''; this.el.style.transform = 'translateY(-50%)'
      bar.appendChild(this.el); return
    }
    if (!bar && !this.el.isConnected) {
      this.el.style.position = 'fixed'; this.el.style.top = 'auto'; this.el.style.bottom = '12px'; this.el.style.transform = 'none'
      document.body.appendChild(this.el)
    }
  }

  updateDisplay(currentHP, maxHP) {
    if (!this.el) return
    this._attach()
    const changed = currentHP !== this.cur
    this.cur = currentHP; this.max = maxHP
    this.text.textContent = String(currentHP)
    const low = currentHP < maxHP * 0.3
    this.text.style.color = low ? '#ff5a4a' : '#f3e6c4'
    this.heart.style.animationDuration = low ? '0.7s' : currentHP < maxHP * 0.6 ? '1.1s' : '1.6s'
    if (changed) {
      this.text.style.animation = 'none'; void this.text.offsetWidth
      this.text.style.animation = 'hpBump 0.35s ease-out'
    }
  }

  // kept for callers of the old display
  showTemporarily() { this._attach() }

  _unhook() {
    this.scene?.events?.off('playerHPChanged', this.updateDisplay, this)
  }

  destroy() {
    clearTimeout(this._late)
    this._unhook()
    this.el?.remove()
    this.el = null
  }
}

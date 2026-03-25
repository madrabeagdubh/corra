// PGRDebugOverlay.js
//
// Live-tuning overlay for PerspectiveGroundRenderer constants.
// Uses custom div-based sliders instead of <input type="range"> because
// native range inputs don't respond reliably to touch on mobile Chrome
// when inside a Phaser game container.
//
// Usage in BogLocationScene.create():
//
//   import PGRDebugOverlay from '../../../effects/PGRDebugOverlay.js'
//
//   this.time.delayedCall(100, () => {
//     if (import.meta.env.DEV) {
//       this.pgrDebug = new PGRDebugOverlay(this.perspectiveGround)
//     }
//   })

export default class PGRDebugOverlay {

  constructor(pgr) {
    this._pgr       = pgr
    this._visible   = true
    this._panel     = null
    this._container = pgr.scene.game.canvas.parentNode
    this._build()
  }

  // ── Slider definitions ────────────────────────────────────────────────────

  get _sliders() {
    return [
      { key: 'HORIZON_Y_FRAC',    label: 'Horizon Y',      min: 0.001, max: 0.65, step: 0.01, fmt: v => v.toFixed(2), hint: 'Higher = camera looks more down' },
      { key: 'CAMERA_ROW_OFFSET', label: 'Cam Row Offset',  min: 0,    max: 40,   step: 0.5,  fmt: v => v.toFixed(1), hint: 'Lower = less ground ahead' },
      { key: 'FOCAL_LENGTH',      label: 'Focal Length',    min: 1,    max: 50,   step: 0.5,  fmt: v => v.toFixed(1), hint: 'Lower = more dramatic perspective' },
      { key: 'HEIGHT_MULTIPLIER', label: 'Billboard H',     min: 0.5,  max: 4,    step: 0.1,  fmt: v => v.toFixed(1), hint: 'Tree/rock height multiplier' },
      { key: 'TILES_ACROSS',      label: 'Tiles Across',    min: 2,    max: 14,   step: 0.5,  fmt: v => v.toFixed(1), hint: 'Fewer = more zoomed in' },
      { key: 'PLAYER_DIST_TILES', label: 'Player Dist',     min: 0.1,    max: 15,   step: 0.5,  fmt: v => v.toFixed(1), hint: 'Reference distance for scale' },
    ]
  }

  // ── Build DOM ─────────────────────────────────────────────────────────────

  _build() {
    const panel = document.createElement('div')
    panel.id = 'pgr-debug-overlay'
    Object.assign(panel.style, {
      position:      'absolute',
      top:           '60px',
      right:         '4px',
      zIndex:        '99999',
      background:    'rgba(0,0,0,0.88)',
      color:         '#e8dcc8',
      fontFamily:    'monospace',
      fontSize:      '11px',
      padding:       '8px 10px',
      borderRadius:  '6px',
      border:        '1px solid rgba(255,220,100,0.35)',
      width:         '200px',
      boxSizing:     'border-box',
      overflowY:     'auto',
      maxHeight:     'calc(100% - 80px)',
      touchAction:   'none',
      pointerEvents: 'all',
      userSelect:    'none',
    })

    // Stop events reaching Phaser beneath
    ;['touchstart','touchmove','touchend','pointerdown','pointermove','pointerup']
      .forEach(ev => panel.addEventListener(ev, e => {
        e.stopPropagation()
        e.preventDefault()
      }, { passive: false }))

    // Header
    const header = document.createElement('div')
    Object.assign(header.style, { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' })

    const title = document.createElement('span')
    title.textContent = 'PGR TUNING'
    Object.assign(title.style, { color:'#ffd700', fontWeight:'bold', fontSize:'10px', letterSpacing:'1px' })

    const closeBtn = document.createElement('span')
    closeBtn.textContent = '✕'
    Object.assign(closeBtn.style, { cursor:'pointer', color:'#999', fontSize:'16px', padding:'0 2px', touchAction:'none' })
    closeBtn.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); this.hide() })

    header.appendChild(title)
    header.appendChild(closeBtn)
    panel.appendChild(header)

    // Build each custom slider
    this._sliders.forEach(s => panel.appendChild(this._makeSlider(s)))

    // Copy button
    const hr = document.createElement('div')
    Object.assign(hr.style, { borderTop:'1px solid rgba(255,255,255,0.1)', margin:'6px 0' })
    panel.appendChild(hr)

    const copyBtn = document.createElement('button')
    copyBtn.textContent = '📋 Copy values'
    Object.assign(copyBtn.style, {
      width:'100%', background:'rgba(255,215,0,0.1)',
      border:'1px solid rgba(255,215,0,0.35)', color:'#ffd700',
      fontFamily:'monospace', fontSize:'10px', padding:'5px 4px',
      cursor:'pointer', borderRadius:'3px', touchAction:'none',
    })
    copyBtn.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); this._copyValues() })
    panel.appendChild(copyBtn)

    const confirm = document.createElement('div')
    confirm.id = 'pgr-copy-confirm'
    Object.assign(confirm.style, { color:'#88ff88', fontSize:'9px', textAlign:'center', marginTop:'3px', height:'11px' })
    panel.appendChild(confirm)

    this._container.appendChild(panel)
    this._panel = panel
  }

  // ── Custom slider ─────────────────────────────────────────────────────────
  // A div-based slider that handles touch events directly, bypassing the
  // browser's native range input which is unreliable inside Phaser on mobile.

  _makeSlider(s) {
    const C       = this._pgr.constructor
    const current = C[s.key]

    const wrap = document.createElement('div')
    wrap.style.marginBottom = '10px'

    // Label row
    const labelRow = document.createElement('div')
    Object.assign(labelRow.style, { display:'flex', justifyContent:'space-between', marginBottom:'4px', fontSize:'10px' })
    const labelEl = document.createElement('span')
    labelEl.textContent = s.label
    labelEl.style.color = '#c8b98a'
    const valEl = document.createElement('span')
    valEl.textContent = s.fmt(current)
    valEl.style.color = '#ffd700'
    labelRow.appendChild(labelEl)
    labelRow.appendChild(valEl)

    // Track
    const track = document.createElement('div')
    Object.assign(track.style, {
      position:     'relative',
      width:        '100%',
      height:       '20px',        // tall touch target
      background:   'rgba(255,255,255,0.12)',
      borderRadius: '10px',
      cursor:       'pointer',
      touchAction:  'none',
      boxSizing:    'border-box',
    })

    // Fill
    const fill = document.createElement('div')
    Object.assign(fill.style, {
      position:     'absolute',
      left:         '0',
      top:          '0',
      height:       '100%',
      background:   'rgba(255,215,0,0.5)',
      borderRadius: '10px',
      pointerEvents:'none',
    })

    // Thumb
    const thumb = document.createElement('div')
    Object.assign(thumb.style, {
      position:     'absolute',
      top:          '50%',
      width:        '22px',
      height:       '22px',
      background:   '#ffd700',
      borderRadius: '50%',
      transform:    'translate(-50%, -50%)',
      pointerEvents:'none',
      boxShadow:    '0 1px 4px rgba(0,0,0,0.5)',
    })

    track.appendChild(fill)
    track.appendChild(thumb)

    // Position thumb + fill from value
    const fraction = (current - s.min) / (s.max - s.min)
    fill.style.width   = `${fraction * 100}%`
    thumb.style.left   = `${fraction * 100}%`

    // Update value from touch/pointer X position on track
    const updateFromEvent = e => {
      const rect = track.getBoundingClientRect()
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const frac  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      const steps = Math.round(frac * (s.max - s.min) / s.step)
      const val   = Math.min(s.max, s.max = s.max, parseFloat((s.min + steps * s.step).toFixed(10)))
      // clamp
      const clamped = Math.max(s.min, Math.min(s.max, val))

      fill.style.width  = `${frac * 100}%`
      thumb.style.left  = `${frac * 100}%`
      valEl.textContent = s.fmt(clamped)
      C[s.key]          = clamped
      this._forceRedraw()
    }

    // Use both pointer events and touch events for maximum compatibility
    track.addEventListener('pointerdown', e => {
      e.stopPropagation(); e.preventDefault()
      updateFromEvent(e)
      track.setPointerCapture(e.pointerId)
    }, { passive: false })

    track.addEventListener('pointermove', e => {
      if (e.buttons === 0) return
      e.stopPropagation(); e.preventDefault()
      updateFromEvent(e)
    }, { passive: false })

    track.addEventListener('pointerup', e => {
      e.stopPropagation(); e.preventDefault()
    }, { passive: false })

    // Touch fallback (belt and braces)
    track.addEventListener('touchstart', e => {
      e.stopPropagation(); e.preventDefault()
      updateFromEvent(e)
    }, { passive: false })

    track.addEventListener('touchmove', e => {
      e.stopPropagation(); e.preventDefault()
      updateFromEvent(e)
    }, { passive: false })

    track.addEventListener('touchend', e => {
      e.stopPropagation(); e.preventDefault()
    }, { passive: false })

    // Hint
    const hint = document.createElement('div')
    hint.textContent = s.hint
    Object.assign(hint.style, { color:'#555', fontSize:'9px', marginTop:'2px', lineHeight:'1.3' })

    wrap.appendChild(labelRow)
    wrap.appendChild(track)
    wrap.appendChild(hint)
    return wrap
  }

  // ── Force PGR redraw ──────────────────────────────────────────────────────

  _forceRedraw() {
    this._pgr._lastCamX    = null
    this._pgr._lastCamY    = null
    this._pgr._lastCamZoom = null
  }

  // ── Copy values ───────────────────────────────────────────────────────────

  _copyValues() {
    const C     = this._pgr.constructor
    const lines = this._sliders.map(s =>
      `  static ${s.key.padEnd(20)} = ${C[s.key]}`
    )
    const text = ['// PGR constants — paste into PerspectiveGroundRenderer.js', ...lines].join('\n')

    const showConfirm = msg => {
      const el = document.getElementById('pgr-copy-confirm')
      if (el) { el.textContent = msg; setTimeout(() => { el.textContent = '' }, 2500) }
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
        .then(()  => showConfirm('✓ Copied'))
        .catch(() => { console.log(text); showConfirm('(see console)') })
    } else {
      console.log(text)
      showConfirm('(see console)')
    }
  }

  // ── Visibility ────────────────────────────────────────────────────────────

  show()   { if (this._panel) { this._panel.style.display = 'block';  this._visible = true  } }
  hide()   { if (this._panel) { this._panel.style.display = 'none';   this._visible = false } }
  toggle() { this._visible ? this.hide() : this.show() }

  destroy() {
    if (this._panel?.parentNode) this._panel.parentNode.removeChild(this._panel)
    this._panel = null
  }
}


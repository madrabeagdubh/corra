// pgrWaterBanks.js — river/lake bank faces + corner caps around water tiles
// Location: js/game/effects/pgr/pgrWaterBanks.js
//
// Split out of perspectiveGroundRenderer.js. Module pattern: plain
// functions taking the PGR instance as their first argument, reading
// and writing its fields directly -- all state stays on the instance,
// so behaviour is identical to the pre-split code and PGR.destroy()
// works untouched. Class statics are reached via pgr.constructor.

// Only ever called for IN-MAP tiles (the phantom path skips banks by
// design), so the original `inMap &&` guards are dropped here.

// North face: raised terrain with water immediately to the north.
// Called BEFORE the ground trapezoid is drawn (the ground draws over
// its lower edge, same painter order as the original inline code).
export function drawNorthWaterFace(pgr, ctx, layer0, tileCol, tileRow, tileAlpha, yTopClamped, xTL, xTR, _yTL, _yTR, _isGroundWater) {
  // North face: raised terrain with water immediately to north
  if (!_isGroundWater) {
    const _northGid = layer0[tileRow - 1]?.[tileCol] ?? 0
    const _northIsWater = _northGid === 1625 || _northGid === 1679 || _northGid === 731
    if (_northIsWater) {
      const _nbGap = Math.max(_yTL, _yTR) - yTopClamped
      if (_nbGap > 3) {
        ctx.save()
        ctx.globalAlpha = tileAlpha * 0.75
        try {
          const _nbg = ctx.createLinearGradient(0, yTopClamped, 0, Math.max(_yTL, _yTR))
          _nbg.addColorStop(0,   'rgba(38, 28, 12, 0.85)')
          _nbg.addColorStop(0.5, 'rgba(58, 42, 18, 0.80)')
          _nbg.addColorStop(1,   'rgba(68, 50, 22, 0.70)')
          ctx.fillStyle = _nbg
        } catch(e) { ctx.fillStyle = 'rgba(52, 38, 16, 0.75)' }
        ctx.beginPath()
        ctx.moveTo(xTL, yTopClamped)
        ctx.lineTo(xTR, yTopClamped)
        ctx.lineTo(xTR, _yTR)
        ctx.lineTo(xTL, _yTL)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }
    }
  }
}

// South bank + east/west corner caps + east/west side faces and
// diagonals. Called AFTER the ground trapezoid is drawn, so later
// (nearer) rows overdraw these in natural row order.
export function drawWaterBanks(pgr, ctx, layer0, tileCol, tileRow, tileAlpha, horizonPx, yBotClamped, _yTL, _yTR, _yBL, _yBR, _isGroundWater) {
  // South bank: ground tile with water to south
  const _southGid = layer0[tileRow + 1]?.[tileCol] ?? 0
  const _southIsWater = _southGid === 1625 || _southGid === 1679 || _southGid === 731
  if (_southIsWater && !_isGroundWater && yBotClamped >= horizonPx + 4) {
    const _bxBL = pgr._colToScreenX(tileCol,     tileRow + 1)
    const _bxBR = pgr._colToScreenX(tileCol + 1, tileRow + 1)
    // yWater = front edge of the water tile. Draw inline (not deferred) so
    // grass tiles on the south bank naturally overdraw it in row order.
    const _bYWater = pgr._rowToScreenY(tileRow + 2) ?? (yBotClamped + pgr._scaleAtRow(tileRow + 1))
    const _bankGap = _bYWater - Math.min(_yBL, _yBR)
    if (_bankGap > 4) {
      // Inline draw — same gradient as before but drawn now so later rows cover it
      ctx.save()
      ctx.globalAlpha = tileAlpha * 0.60
      const _byTop = Math.min(_yBL, _yBR)
      try {
        const _bg = ctx.createLinearGradient(0, _byTop, 0, _bYWater)
        _bg.addColorStop(0,    'rgba(42, 30, 14, 0.95)')
        _bg.addColorStop(0.25, 'rgba(58, 42, 18, 0.80)')
        _bg.addColorStop(0.60, 'rgba(65, 48, 22, 0.55)')
        _bg.addColorStop(1,    'rgba(50, 36, 16, 0.20)')
        ctx.fillStyle = _bg
      } catch(e) { ctx.fillStyle = 'rgba(52, 36, 16, 0.60)' }
      ctx.beginPath()
      ctx.moveTo(_bxBL, _yBL)
      ctx.lineTo(_bxBR, _yBR)
      ctx.lineTo(_bxBR, _bYWater)
      ctx.lineTo(_bxBL, _bYWater)
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = tileAlpha * 0.70
      ctx.strokeStyle = 'rgba(30, 22, 8, 0.85)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(_bxBL, _yBL); ctx.lineTo(_bxBR, _yBR)
      ctx.stroke()
      ctx.restore()
    }

    // East corner cap: south-bank tile whose east neighbour is water — drawn inline
    const _eastOfThis = layer0[tileRow]?.[tileCol + 1] ?? 0
    const _eastCornerIsWater = _eastOfThis === 1625 || _eastOfThis === 1679 || _eastOfThis === 731
    if (_eastCornerIsWater) {
      const _eXFront = pgr._colToScreenX(tileCol + 1, tileRow + 1)
      const _eXBack  = pgr._colToScreenX(tileCol + 1, tileRow)
      const _eYWater = pgr._rowToScreenY(tileRow + 2) ?? (yBotClamped + pgr._scaleAtRow(tileRow + 1))
      const _eYTop   = Math.min(_yBR, _yTR)
      if (_eYWater - _eYTop > 4) {
        const _eLtR = _eXBack <= _eXFront
        const _exL  = _eLtR ? _eXBack  : _eXFront
        const _exR  = _eLtR ? _eXFront : _eXBack
        const _eyL  = _eLtR ? _yTR     : _yBR
        const _eyR  = _eLtR ? _yBR     : _yTR
        ctx.save()
        ctx.globalAlpha = tileAlpha * 0.82
        try {
          const _sg = ctx.createLinearGradient(0, _eYTop, 0, _eYWater)
          _sg.addColorStop(0,   'rgba(52, 38, 16, 0.98)')
          _sg.addColorStop(0.4, 'rgba(62, 44, 20, 0.88)')
          _sg.addColorStop(1,   'rgba(48, 34, 16, 0.50)')
          ctx.fillStyle = _sg
        } catch(e) { ctx.fillStyle = 'rgba(52, 38, 16, 0.85)' }
        ctx.beginPath()
        ctx.moveTo(_exL, _eyL)
        ctx.lineTo(_exR, _eyR)
        ctx.lineTo(_exR, _eYWater)
        ctx.lineTo(_exL, _eYWater)
        ctx.closePath()
        ctx.fill()
        ctx.globalAlpha = tileAlpha * 0.90
        ctx.strokeStyle = 'rgba(28, 20, 8, 0.90)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(_exL, _eyL); ctx.lineTo(_exR, _eyR)
        ctx.stroke()
        ctx.restore()
      }
    }

    // West corner cap: south-bank tile whose west neighbour is water — drawn inline
    const _westOfThis = layer0[tileRow]?.[tileCol - 1] ?? 0
    const _westCornerIsWater = _westOfThis === 1625 || _westOfThis === 1679 || _westOfThis === 731
    if (_westCornerIsWater) {
      const _wXFront = pgr._colToScreenX(tileCol, tileRow + 1)
      const _wXBack  = pgr._colToScreenX(tileCol, tileRow)
      const _wYWater = pgr._rowToScreenY(tileRow + 2) ?? (yBotClamped + pgr._scaleAtRow(tileRow + 1))
      const _wYTop   = Math.min(_yBL, _yTL)
      if (_wYWater - _wYTop > 4) {
        const _wLtR = _wXBack <= _wXFront
        const _wxL  = _wLtR ? _wXBack  : _wXFront
        const _wxR  = _wLtR ? _wXFront : _wXBack
        const _wyL  = _wLtR ? _yTL     : _yBL
        const _wyR  = _wLtR ? _yBL     : _yTL
        ctx.save()
        ctx.globalAlpha = tileAlpha * 0.82
        try {
          const _sg = ctx.createLinearGradient(0, _wYTop, 0, _wYWater)
          _sg.addColorStop(0,   'rgba(52, 38, 16, 0.98)')
          _sg.addColorStop(0.4, 'rgba(62, 44, 20, 0.88)')
          _sg.addColorStop(1,   'rgba(48, 34, 16, 0.50)')
          ctx.fillStyle = _sg
        } catch(e) { ctx.fillStyle = 'rgba(52, 38, 16, 0.85)' }
        ctx.beginPath()
        ctx.moveTo(_wxL, _wyL)
        ctx.lineTo(_wxR, _wyR)
        ctx.lineTo(_wxR, _wYWater)
        ctx.lineTo(_wxL, _wYWater)
        ctx.closePath()
        ctx.fill()
        ctx.globalAlpha = tileAlpha * 0.90
        ctx.strokeStyle = 'rgba(28, 20, 8, 0.90)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(_wxL, _wyL); ctx.lineTo(_wxR, _wyR)
        ctx.stroke()
        ctx.restore()
      }
    }
  }

  // East side face: water to east at same row (north bank) → inline
  // Guard: skip on corner tiles where _southIsWater — corner cap already handles those
  const _eastGid  = layer0[tileRow    ]?.[tileCol + 1] ?? 0
  const _eastIsWater  = _eastGid  === 1625 || _eastGid  === 1679 || _eastGid  === 731
  if (_eastIsWater && !_isGroundWater && !_southIsWater && yBotClamped >= horizonPx + 4) {
    const _eXFront = pgr._colToScreenX(tileCol + 1, tileRow + 1)
    const _eXBack  = pgr._colToScreenX(tileCol + 1, tileRow)
    const _eYWater = pgr._rowToScreenY(tileRow + 2) ?? (yBotClamped + pgr._scaleAtRow(tileRow + 1))
    const _eYTop   = Math.min(_yBR, _yTR)
    if (_eYWater - _eYTop > 4) {
      const _eLtR = _eXBack <= _eXFront
      ctx.save()
      ctx.globalAlpha = tileAlpha * 0.82
      try {
        const _sg = ctx.createLinearGradient(0, _eYTop, 0, _eYWater)
        _sg.addColorStop(0,   'rgba(52, 38, 16, 0.98)')
        _sg.addColorStop(0.4, 'rgba(62, 44, 20, 0.88)')
        _sg.addColorStop(1,   'rgba(48, 34, 16, 0.50)')
        ctx.fillStyle = _sg
      } catch(e) { ctx.fillStyle = 'rgba(52, 38, 16, 0.85)' }
      const _exL = _eLtR ? _eXBack : _eXFront
      const _exR = _eLtR ? _eXFront : _eXBack
      const _eyL = _eLtR ? _yTR : _yBR
      const _eyR = _eLtR ? _yBR : _yTR
      ctx.beginPath()
      ctx.moveTo(_exL, _eyL)
      ctx.lineTo(_exR, _eyR)
      ctx.lineTo(_exR, _eYWater)
      ctx.lineTo(_exL, _eYWater)
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = tileAlpha * 0.90
      ctx.strokeStyle = 'rgba(28, 20, 8, 0.90)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(_exL, _eyL); ctx.lineTo(_exR, _eyR)
      ctx.stroke()
      ctx.restore()
    }
  }
  // East side face: water at row above (south bank) → inline
  // Only fire for pure north-bank diagonal: tile must NOT itself border south water
  const _eastGidN = layer0[tileRow - 1]?.[tileCol + 1] ?? 0
  const _eastNIsWater = _eastGidN === 1625 || _eastGidN === 1679 || _eastGidN === 731
  if (_eastNIsWater && !_eastIsWater && !_isGroundWater && !_southIsWater && yBotClamped >= horizonPx + 4) {
    const _eX0 = pgr._colToScreenX(tileCol + 1, tileRow + 1)
    const _eYWater = pgr._rowToScreenY(tileRow + 2) ?? yBotClamped
    if (_eYWater - _yBR > 4) {
      drawBankSide(ctx, _eX0, _eX0, _yBR, _eYWater, tileAlpha)
    }
  }

  // West side face: water to west at same row (north bank) → inline
  // Guard: skip on corner tiles where _southIsWater — corner cap already handles those
  const _westGid  = layer0[tileRow    ]?.[tileCol - 1] ?? 0
  const _westIsWater  = _westGid  === 1625 || _westGid  === 1679 || _westGid  === 731
  if (_westIsWater && !_isGroundWater && !_southIsWater && yBotClamped >= horizonPx + 4) {
    const _wXFront = pgr._colToScreenX(tileCol, tileRow + 1)
    const _wXBack  = pgr._colToScreenX(tileCol, tileRow)
    const _wYWater = pgr._rowToScreenY(tileRow + 2) ?? (yBotClamped + pgr._scaleAtRow(tileRow + 1))
    const _wYTop   = Math.min(_yBL, _yTL)
    if (_wYWater - _wYTop > 4) {
      const _wLtR = _wXBack <= _wXFront
      ctx.save()
      ctx.globalAlpha = tileAlpha * 0.82
      try {
        const _sg = ctx.createLinearGradient(0, _wYTop, 0, _wYWater)
        _sg.addColorStop(0,   'rgba(52, 38, 16, 0.98)')
        _sg.addColorStop(0.4, 'rgba(62, 44, 20, 0.88)')
        _sg.addColorStop(1,   'rgba(48, 34, 16, 0.50)')
        ctx.fillStyle = _sg
      } catch(e) { ctx.fillStyle = 'rgba(52, 38, 16, 0.85)' }
      const _wxL = _wLtR ? _wXBack : _wXFront
      const _wxR = _wLtR ? _wXFront : _wXBack
      const _wyL = _wLtR ? _yTL : _yBL
      const _wyR = _wLtR ? _yBL : _yTL
      ctx.beginPath()
      ctx.moveTo(_wxL, _wyL)
      ctx.lineTo(_wxR, _wyR)
      ctx.lineTo(_wxR, _wYWater)
      ctx.lineTo(_wxL, _wYWater)
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = tileAlpha * 0.90
      ctx.strokeStyle = 'rgba(28, 20, 8, 0.90)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(_wxL, _wyL); ctx.lineTo(_wxR, _wyR)
      ctx.stroke()
      ctx.restore()
    }
  }
  // West side face: water at row above (south bank) → inline
  // Only fire for pure north-bank diagonal: tile must NOT itself border south water
  const _westGidN = layer0[tileRow - 1]?.[tileCol - 1] ?? 0
  const _westNIsWater = _westGidN === 1625 || _westGidN === 1679 || _westGidN === 731
  if (_westNIsWater && !_westIsWater && !_isGroundWater && !_southIsWater && yBotClamped >= horizonPx + 4) {
    const _wX0 = pgr._colToScreenX(tileCol, tileRow + 1)
    const _wYWater = pgr._rowToScreenY(tileRow + 2) ?? yBotClamped
    if (_wYWater - _yBL > 4) {
      drawBankSide(ctx, _wX0, _wX0, _yBL, _wYWater, tileAlpha)
    }
  }
}

function drawBankSide(ctx, xTop, xBot, yTop, yBot, alpha) {
    if (yBot - yTop < 2) return
    ctx.save()
    ctx.globalAlpha = alpha * 0.50
    try {
      const _g = ctx.createLinearGradient(0, yTop, 0, yBot)
      _g.addColorStop(0,    'rgba(42, 30, 14, 0.92)')
      _g.addColorStop(0.4,  'rgba(60, 44, 20, 0.75)')
      _g.addColorStop(1,    'rgba(48, 34, 16, 0.30)')
      ctx.fillStyle = _g
    } catch(e) { ctx.fillStyle = 'rgba(50, 35, 15, 0.55)' }
    ctx.beginPath()
    ctx.moveTo(xTop, yTop)
    ctx.lineTo(xBot, yTop)
    ctx.lineTo(xBot, yBot)
    ctx.lineTo(xTop, yBot)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }


// PATCH: add destroy() to PerspectiveGroundRenderer
// Location: js/game/effects/perspectiveGroundRenderer.js
//
// PerspectiveScene.shutdown() has always called this.perspectiveGround.destroy(),
// but PerspectiveGroundRenderer never defined a destroy() method at all. This
// was a latent bug invisible until shutdown() was fixed (this session) to
// actually fire via Phaser's real 'shutdown' event -- before that fix,
// shutdown() never ran, so the missing method was never called and never
// threw. First real scene transition after the fix (d3_sea -> d3, exiting
// a boat scene) hit it immediately: "TypeError: this.perspectiveGround.destroy
// is not a function".
//
// Insert this method anywhere inside the PerspectiveGroundRenderer class
// body in perspectiveGroundRenderer.js (e.g. directly after the constructor,
// or just before loadBoatImage at the end of the file -- placement doesn't
// matter, it just needs to be a method on the class).
//
// Tears down everything the constructor / _buildSkyImage create:
//   - this._groundCanvas, this._objectCanvas (DOM canvases)
//   - this._lightDiv (DOM div)
//   - this._skyImg, this._mountainImg (DOM img elements, from _buildSkyImage)
//   - this._resizeHandler (registered on window 'resize' AND document
//     'fullscreenchange' / 'webkitfullscreenchange' -- all three need
//     removing, matching how _buildSkyImage registered them)
//   - clears tile/tint caches (not strictly required for correctness since
//     they're plain Maps that get garbage collected once the instance is
//     dereferenced, but cheap to clear explicitly and avoids holding image
//     data in memory any longer than necessary)
//
// Does NOT touch this.scene.game.canvas (the Phaser canvas itself) beyond
// what it already had before construction -- PGR mutates its style on
// construction (position/zIndex/background) but the canvas itself belongs
// to Phaser/the scene, not to PGR, so destroy() leaves it alone rather than
// guessing at what styles to restore.

// ── ALSO REQUIRED: one-line guard at the very top of update(fov) ──────────────
// Find this existing line near the start of update(fov):
//     if (!this._ready) return
// And add this line directly above or below it:
//     if (this._destroyed) return
// This is what makes the _destroyed flag (set below) actually protect
// against a stray post-destroy update() call.

  destroy() {
    console.log('[PGR v8] destroy() called')

    window.removeEventListener('resize', this._resizeHandler)
    document.removeEventListener('fullscreenchange', this._resizeHandler)
    document.removeEventListener('webkitfullscreenchange', this._resizeHandler)
    this._resizeHandler = null

    if (this._groundCanvas?.parentNode) this._groundCanvas.parentNode.removeChild(this._groundCanvas)
    if (this._objectCanvas?.parentNode) this._objectCanvas.parentNode.removeChild(this._objectCanvas)
    this._groundCanvas = null
    this._objectCanvas = null
    this._gCtx = null
    this._oCtx = null

    if (this._lightDiv?.parentNode) this._lightDiv.parentNode.removeChild(this._lightDiv)
    this._lightDiv = null

    if (this._skyImg?.parentNode) this._skyImg.parentNode.removeChild(this._skyImg)
    if (this._mountainImg?.parentNode) this._mountainImg.parentNode.removeChild(this._mountainImg)
    this._skyImg = null
    this._mountainImg = null

    this._tileCache?.clear()
    this._bakedTintCache?.clear()
    this._tilesetImg = null
    this._player = null
    this._playerCanvas = null
    this._buildings = []
    this._encounterFlags = []
    this._boatCanvas = null

    // NOT nulling this.scene -- if update() somehow gets called again after
    // destroy() (shouldn't happen in a correctly torn-down scene, but this
    // session has turned up several surprises around scene lifecycle), a
    // null scene would turn a harmless no-op into a guaranteed crash on
    // this.scene.game inside update(). Flag instead, checked at the top of
    // update() below.
    this._destroyed = true

    console.log('[PGR v8] destroy() complete -- DOM elements removed')
  }

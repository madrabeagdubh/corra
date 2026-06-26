// storyVisuals.js
// Location: js/game/effects/storyVisuals.js
//
// A minimal DOM effects layer for "bard storytelling mode" — currently
// just a vignette. An earlier, larger version of this module also had a
// line-indexed cue system driving ambient particle effects (drifting
// dust motes, one-shot bursts) in a dark "stage" area above the bard.
// Per explicit feedback, that was distracting and the cue/effects system
// itself may have been the wrong direction — removed entirely rather than
// kept around half-disabled. This module now does ONE thing: fades in a
// vignette once when bard mode starts, and holds it until torn down.
//
// If cued visual effects are wanted again later, this is the natural
// place to rebuild them, but starting from a clean slate rather than
// re-enabling what didn't work.
//
// ── USAGE ────────────────────────────────────────────────────────────────
//   import { StoryVisuals } from './storyVisuals.js'
//   const visuals = new StoryVisuals()
//   visuals.mount()       // creates the vignette DOM, call once when bard mode starts
//   visuals.start()       // triggers the one-time fade-in (call on first real line/pluck)
//   visuals.fadeOut()     // "lights come back up" — call when the tale ends, BEFORE destroy()
//   visuals.destroy()     // call when bard mode ends / harp closes

// How long the vignette takes to fade in, once started.
const VIGNETTE_FADE_IN_MS = 1800
// How long the vignette takes to fade back OUT at end-of-tale ("lights
// come back up") — a bit quicker than the fade-in, since this is a
// release/return-to-normal beat rather than a slow sink into the story.
const VIGNETTE_FADE_OUT_MS = 1200

export class StoryVisuals {
  constructor() {
    this._mounted = false
    this._started = false
  }

  // Creates the vignette DOM. Call once when bard mode starts. Safe to
  // call multiple times — a second call is a no-op if already mounted.
  mount() {
    if (this._mounted) return
    this._mounted = true

    // Vignette: full-screen dark layer with a lit cutout at bottom-
    // center where the bard stands. Built from a single radial-gradient
    // background rather than a separate "hole" element — simpler, and
    // avoids needing to keep two elements' geometry in sync.
    this._vignetteEl = document.createElement('div')
    this._vignetteEl.style.cssText = [
      'position:fixed;inset:0;pointer-events:none;',
      // Above the tavern scene itself but BELOW the existing text slots
      // and harp strings — see tavern.js's z-index:2000001 for the text
      // container and corraHarp.js's overlay at z-index:2000000.
      'z-index:1999998;',
      // Radial gradient: a lit, mostly-clear oval at bottom-center
      // (where the bard/text stands) widening out to fully dark at the
      // edges and top.
      'background:radial-gradient(ellipse 60% 38% at 50% 90%,',
      'rgba(0,0,0,0) 0%,',
      'rgba(0,0,0,0.15) 55%,',
      'rgba(0,0,0,0.75) 80%,',
      'rgba(0,0,0,0.92) 100%);',
      'opacity:0;',
      `transition:opacity ${VIGNETTE_FADE_IN_MS}ms ease-in;`,
    ].join('')
    document.body.appendChild(this._vignetteEl)
  }

  // Triggers the one-time fade-in. Idempotent — calling again after the
  // first time is a no-op, so callers don't need to track "did this
  // already happen" themselves (e.g. tavern.js can call this on every
  // line advance and it'll simply do nothing after the first call).
  start() {
    if (!this._mounted || this._started) return
    this._started = true
    // Double rAF flush, same race-avoidance technique used throughout
    // tavern.js's own fades — a single rAF was not reliably its own
    // frame boundary in earlier testing elsewhere in this project.
    void this._vignetteEl.offsetHeight
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { this._vignetteEl.style.opacity = '1' })
    })
  }

  // "Lights come back up" — fades the vignette back out at end-of-tale,
  // WITHOUT removing its DOM (that's destroy()'s job). Call this first,
  // then destroy() once the fade (and whatever else is wrapping up
  // alongside it, e.g. the text fade-out in tavern.js) has finished. A
  // no-op if not mounted or the fade-in never actually ran.
  fadeOut() {
    if (!this._mounted || !this._started) return
    this._vignetteEl.style.transition = `opacity ${VIGNETTE_FADE_OUT_MS}ms ease-out`
    this._vignetteEl.style.opacity = '0'
  }

  // Tears down the vignette DOM. Call when bard mode ends / the harp
  // overlay closes. Safe to call even if mount() was never called.
  destroy() {
    this._vignetteEl?.remove()
    this._vignetteEl = null
    this._mounted = false
    this._started = false
  }
}


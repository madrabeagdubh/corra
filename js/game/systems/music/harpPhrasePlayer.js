// harpPhrasePlayer.js
// Location: js/game/systems/music/harpPhrasePlayer.js
//
// "Missile Command" rhythm mechanic for CorraHarp — FULL TUNE VERSION.
//
// Unlike a gated note-by-note system, this schedules the ENTIRE phrase up
// front on a master clock. Every beat has an absolute launch time and
// arrival time at a fixed, centred hit-line. Orbs travel independently of
// player input — missing one doesn't block the next; the tune just keeps
// going, like a real tune would. Multiple orbs can be in flight at once.
// Player accuracy is tallied per-beat for scoring, but never gates playback.
//
// ── Data shape ───────────────────────────────────────────────────────────
//   Beat = {
//     strings:    [idx, ...]   // CorraHarp string indices required together
//     atMs:       number       // absolute time (ms from phrase start) the
//                               // orb should ARRIVE at the hit-line
//     travelMs:   number       // how long the orb takes to travel (controls
//                               // launch time = atMs - travelMs, and speed)
//     windowMs:   number       // forgiveness window around atMs
//     sharp?:     boolean      // does this beat need the harp's sharp
//                               // variant of the target string to sound
//                               // the correct pitch? undefined/false =
//                               // natural. Sharps are AUTOMATIC — see
//                               // corraHarp.js header — so this just tells
//                               // the harp which pitch to actually sound,
//                               // it's not something the player toggles.
//     label?:     string
//     vel?:       number       // 0..1 velocity/loudness for autoPlay's
//                               // demoStrike — metric accent (downbeats
//                               // louder, off-beats softer) so a played-
//                               // back tune doesn't sound flat/mechanical.
//                               // Ignored during real play (the player's
//                               // own pluck velocity is used instead).
//                               // Defaults to 0.8 if omitted.
//     ornament?: {type,count}  // null/absent = plain note. Otherwise
//                               // this beat stands in for an ornamental
//                               // flourish (triplet or roll) — see
//                               // abcToTimedStringSequence and
//                               // corraHarp.js's playOrnament. The
//                               // player still only hits ONE orb; the
//                               // harp plays the actual flourish. Gets a
//                               // wider hit-window (_effectiveHalfWindow)
//                               // but is scored the same as any other
//                               // beat once hit/missed.
//   }
//   Phrase = Beat[]   — beats are scheduled by atMs, not by sequence/order
//
// ── Usage ────────────────────────────────────────────────────────────────
//   const player = new HarpPhrasePlayer(corraHarp, phrase, {
//     onBeatResult: (beatIndex, { hit, accuracy, stringIndex }) => {},
//     onPhraseComplete: (tally) => {},
//     hitLineFrac: 0.5,   // centre of screen
//   })
//   player.start()
//   player.stop()
//
// ── Automatic sharps ───────────────────────────────────────────────────
// While running, the player registers a sharp-hint function on the harp
// (corraHarp.setSharpHintFn) that, given a string index, looks at the
// nearest unresolved in-flight beat using that string and reports whether
// IT needs the sharp. The harp consults this at the moment the player
// actually plucks, so the correct pitch comes out without the player
// managing any toggle. Cleared on stop() so free play afterward is always
// natural.

export class HarpPhrasePlayer {
  constructor(corraHarp, phrase, opts = {}) {
    this._harp   = corraHarp
    // Sort beats by arrival time so scheduling/launch logic can sweep forward
    this._phrase = [...phrase].sort((a, b) => a.atMs - b.atMs)
    this._opts   = {
      onBeatResult:     opts.onBeatResult     ?? (() => {}),
      onPhraseComplete: opts.onPhraseComplete ?? (() => {}),
      hitLineFrac:      opts.hitLineFrac ?? 0.5,   // centre of screen by default
      // How long after its window closes an unstruck beat is considered
      // "missed" and removed from active tracking (visual only — orb
      // keeps flying off-screen regardless).
      missGraceMs: opts.missGraceMs ?? 4000,
      // Bodhrán click track: a steady percussive pulse at this interval,
      // independent of the note phrase, to help the player feel the
      // tune's tempo. Set to null/0 to disable. accentEvery marks every
      // Nth click as a louder "downbeat" (e.g. 4 for 4/4-feel emphasis).
      bodhranBeatMs:  opts.bodhranBeatMs  ?? null,
      bodhranAccentEvery: opts.bodhranAccentEvery ?? 4,
      // Demo/preview mode: every beat plays itself automatically, exactly
      // at atMs, via corraHarp.demoStrike — no player input is read or
      // required. Orbs still launch, fly, and arrive through the SAME
      // draw loop as real play (this is the whole point — it's meant to
      // show you what correct play looks/sounds like, not a different,
      // simplified visual). Beats still resolve as "hit" so scoring stays
      // sane if a caller happens to read onBeatResult during a demo.
      autoPlay: !!opts.autoPlay,
      // Passed straight through to corraHarp.setTempoMs at start() — see
      // that method's doc for what it's used for (scaling ornament
      // flourish timing). Defaults to bodhranBeatMs/4 if not given
      // explicitly (a reasonable guess at "one duration-unit" when the
      // caller already has a bodhrán click set up at the quarter-note
      // rate), else falls back to a sane constant.
      tempoMs: opts.tempoMs ?? (opts.bodhranBeatMs ? opts.bodhranBeatMs / 4 : 300),
    }
    this._nextClickAt = null
    this._clickCount   = 0

    this._startMs   = 0
    this._running   = false
    this._pluckHandler = null
    this._drawHook  = null

    // Per-beat runtime state, keyed by beat array index
    this._beatState = this._phrase.map(() => ({
      launched: false,
      resolved: false,   // true once hit OR timed out past grace
      hitsThisBeat: new Set(),
    }))

    this._tally = { hit: 0, missed: 0, totalAccuracy: 0 }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────
  start() {
    if (this._running) return
    this._running = true
    this._startMs  = performance.now()

    this._harp.setTempoMs?.(this._opts.tempoMs)

    if (!this._opts.autoPlay) {
      this._pluckHandler = ({ stringIndex }) => this._onPluck(stringIndex)
      this._harp.on('pluck', this._pluckHandler)

      // Shared lookup: for a given string, find the nearest unresolved
      // in-flight beat that uses it. "Nearest" = closest atMs to now,
      // since a string can have at most one beat realistically in its
      // hit window at a time, but using nearest rather than "first
      // found" keeps this correct even if two same-string beats are
      // briefly in flight. Used by BOTH the sharp-hint and ornament-hint
      // callbacks below, since they're answering the same underlying
      // question ("which beat is this pluck actually for?").
      const findNearestBeat = (stringIndex) => {
        const now = performance.now() - this._startMs
        let best = null, bestDist = Infinity
        this._phrase.forEach((beat, i) => {
          const st = this._beatState[i]
          if (st.resolved || !beat.strings.includes(stringIndex)) return
          const dist = Math.abs(now - beat.atMs)
          if (dist < bestDist) { bestDist = dist; best = beat }
        })
        return best
      }

      this._sharpHintFn = (stringIndex) => !!findNearestBeat(stringIndex)?.sharp
      this._harp.setSharpHintFn?.(this._sharpHintFn)

      this._ornamentHintFn = (stringIndex) => findNearestBeat(stringIndex)?.ornament ?? null
      this._harp.setOrnamentHintFn?.(this._ornamentHintFn)
    }

    this._drawHook = (gfx) => this._tick(gfx)
    this._harp._registerOverlayDraw?.(this._drawHook)

    if (this._opts.bodhranBeatMs) {
      this._nextClickAt = 0   // fire the first click immediately at phrase start
      this._clickCount   = 0
    }
  }

  stop() {
    this._running = false
    this._nextClickAt = null
    if (this._pluckHandler) this._harp.off('pluck', this._pluckHandler)
    if (this._drawHook) this._harp._unregisterOverlayDraw?.(this._drawHook)
    if (!this._opts.autoPlay) {
      this._harp.setSharpHintFn?.(null)      // back to natural-only for free play
      this._harp.setOrnamentHintFn?.(null)   // back to plain strikes for free play
    }
    this._phrase.forEach(beat => beat.strings.forEach(idx => this._harp.highlightString(idx, false)))
  }

  // ── Pluck handling ───────────────────────────────────────────────────
  // A pluck can resolve ANY currently-in-flight beat that includes this
  // string and is within its window — not just "the current beat" since
  // several beats may be in flight at once. There's no toggle-state gate
  // here anymore: the sharp-hint function (see start()) already made sure
  // the harp sounded the correct pitch for this exact pluck, so any
  // window/string match is a valid hit regardless of sharp/natural.
  //
  // Ornament beats (see abcToTimedStringSequence's `ornaments` output)
  // get a WIDER effective window — per design, hitting one beat that
  // stands in for a fast ornamental flourish should be a little more
  // forgiving than a plain note, since the player is committing to a
  // trickier passage they can't physically execute note-by-note. Scoring
  // itself (hit/miss tally, accuracy contribution) is NOT treated
  // specially beyond that — once it's hit, it's just a normal hit.
  _effectiveHalfWindow(beat) {
    const half = beat.windowMs / 2
    return beat.ornament ? half * 1.35 : half
  }

  _onPluck(stringIndex) {
    if (!this._running) return
    const now = performance.now() - this._startMs

    // Find the best-matching in-flight, unresolved beat for this string —
    // i.e. the one whose window we're currently inside, closest to centre.
    let bestIdx = -1, bestDist = Infinity
    this._phrase.forEach((beat, i) => {
      const st = this._beatState[i]
      if (st.resolved) return
      if (!beat.strings.includes(stringIndex)) return
      if (st.hitsThisBeat.has(stringIndex)) return
      const half = this._effectiveHalfWindow(beat)
      const dist = Math.abs(now - beat.atMs)
      if (dist <= half && dist < bestDist) { bestDist = dist; bestIdx = i }
    })

    if (bestIdx === -1) return  // no in-flight beat matches — ignore (no penalty)

    const beat = this._phrase[bestIdx]
    const st   = this._beatState[bestIdx]
    st.hitsThisBeat.add(stringIndex)
    this._harp.highlightString(stringIndex, false)

    const accuracy = 1 - bestDist / this._effectiveHalfWindow(beat)

    if (st.hitsThisBeat.size === beat.strings.length) {
      st.resolved = true
      this._tally.hit++
      this._tally.totalAccuracy += accuracy
      this._opts.onBeatResult(bestIdx, { hit: true, accuracy, stringIndex })
    }
  }

  // ── Master tick: launch beats whose time has come, resolve missed ones,
  //    draw everything in flight ─────────────────────────────────────────
  _tick(gfx) {
    if (!this._running) return
    const now = performance.now() - this._startMs

    // Bodhrán click track — fires on a steady interval independent of
    // the note phrase, purely as a timing aid.
    if (this._opts.bodhranBeatMs && this._nextClickAt !== null && now >= this._nextClickAt) {
      const isDownbeat = this._clickCount % this._opts.bodhranAccentEvery === 0
      this._harp.playClick(isDownbeat ? 0.9 : 0.45)
      this._clickCount++
      this._nextClickAt += this._opts.bodhranBeatMs
    }

    this._phrase.forEach((beat, i) => {
      const st = this._beatState[i]
      if (!st.launched && now >= beat.atMs - beat.travelMs) {
        st.launched = true
        beat.strings.forEach(idx => this._harp.highlightString(idx, true, false))
      }
      // Demo mode: strike exactly at atMs (not at launch) and resolve as
      // a hit — this is what makes the audio land precisely on-beat while
      // the orb's flight/arrival visuals stay driven by the same launch/
      // atMs timing as real play.
      if (this._opts.autoPlay && st.launched && !st.resolved && now >= beat.atMs) {
        st.resolved = true
        beat.strings.forEach(idx => {
          this._harp.demoStrike(idx, beat.sharp, beat.vel ?? 0.55, beat.ornament)
          st.hitsThisBeat.add(idx)   // keeps wasHit/orb-arrival visuals consistent with real play
        })
        this._tally.hit++
        this._tally.totalAccuracy += 1
        this._opts.onBeatResult(i, { hit: true, accuracy: 1 })
      }
      if (!this._opts.autoPlay && st.launched && !st.resolved && now > beat.atMs + this._effectiveHalfWindow(beat) + 50) {
        // Window has closed without a full hit — mark missed, stop tracking
        st.resolved = true
        this._tally.missed++
        beat.strings.forEach(idx => this._harp.highlightString(idx, false))
        this._opts.onBeatResult(i, { hit: false, accuracy: 0 })
      }
    })

    // Phrase end: all beats resolved AND past their travel+grace window
    const lastBeat = this._phrase[this._phrase.length - 1]
    if (lastBeat && now > lastBeat.atMs + this._opts.missGraceMs) {
      this._running = false
      this._opts.onPhraseComplete({ ...this._tally })
      return
    }

    this._draw(gfx, now)
  }

  // ── Visuals ────────────────────────────────────────────────────────────
  // Fixed hit-line at hitLineFrac (default centre). Every launched, not-yet-
  // resolved beat draws its own travelling orb + comet trail along its
  // string's direction, independent of all other beats — multiple orbs
  // can be mid-flight simultaneously, exactly like real tune playback.
  //
  // Queue-order cue: SIMPLE solid-color distinction, not motion/brightness.
  // Fast pulsing and brightness gradients tested as confusing and too busy
  // on a small phone screen with several orbs in flight. Instead:
  //   - the single next-to-play orb is solid YELLOW/GOLD
  //   - every other queued orb is solid GREY (no gradient, no pulse)
  // Sharp-required beats still get a violet halo around the orb itself,
  // independent of queue position — purely informational now (sharps are
  // automatic, nothing for the player to do about it), but useful as an
  // at-a-glance "this one's sharp" cue.
  _draw(gfx, now) {
    const harpScene = this._harp._harpScene
    if (!harpScene) return
    const { sx, sy } = this._harp.getStringDirection()
    const { width: W, height: H } = harpScene.scale
    const hitLineX = W * this._opts.hitLineFrac

    gfx.fillStyle(0xffffff, 0.10)
    gfx.fillRect(hitLineX - 2, 0, 4, H)

    // Find the index of the next unresolved beat in sequence order —
    // this is the one drawn brightest AND flashing. Beats further ahead
    // in the queue are progressively darker gold, same as before.
    let nextUnresolvedIdx = -1
    for (let i = 0; i < this._phrase.length; i++) {
      if (!this._beatState[i].resolved) { nextUnresolvedIdx = i; break }
    }

    this._phrase.forEach((beat, i) => {
      const st = this._beatState[i]
      if (!st.launched) return
      // Keep drawing briefly after resolution so the arrival flash still
      // fires even for beats the player already hit slightly early —
      // resolution can happen a little before `atMs`, but the metronome
      // flash should always land exactly on `atMs` regardless.
      // Keep a beat "relevant" (still drawn) through its full fade-out
      // window, even after it's resolved (hit or missed) — the orb fades
      // smoothly rather than disappearing the instant it's resolved.
      const stillRelevant = !st.resolved || (now - beat.atMs) < 380
      if (!stillRelevant) return

      const isNextUp  = i === nextUnresolvedIdx

      beat.strings.forEach(idx => {
        const s = harpScene.strings[idx]
        if (!s) return

        // distToLine: distance (in string-direction units) from the
        // anchor to the fixed hit-line — this is short for anchors near
        // screen-centre, so it must NOT be used to derive the launch
        // point. The launch point is fixed at the screen's left edge
        // (independent of any single string's anchor position) so every
        // orb visibly slides in from off-screen-left, regardless of how
        // close that particular string's anchor happens to sit to the line.
        const distToLine  = sx !== 0 ? (hitLineX - s.ax) / sx : 400
        const offscreenX   = -W * 0.15   // a bit past the left edge
        const startDist    = sx !== 0 ? (offscreenX - s.ax) / sx : -800

        const launchAt = beat.atMs - beat.travelMs
        const prog = (now - launchAt) / beat.travelMs   // 0 at launch, 1 at hit-line
        const curDist = startDist + (distToLine - startDist) * prog

        // The orb FADES OUT after passing the line (whether hit or missed)
        // rather than vanishing abruptly or lingering at full opacity.
        // Plucking the string is always still possible — this fade only
        // affects whether the rhythm-game visual is shown, not whether
        // the harp itself can be played. fadeOutMs controls how long the
        // fade takes after the hit-line is crossed.
        const fadeOutMs = 380
        const msPastLine = now - beat.atMs
        let fadeAlpha = 1
        if (msPastLine > 0) {
          fadeAlpha = Math.max(0, 1 - msPastLine / fadeOutMs)
        }
        if (fadeAlpha <= 0) return
        if (prog > 1.6) return

        const ox = s.ax + sx * curDist
        const oy = s.ay + sy * curDist
        const wasHit = st.hitsThisBeat.has(idx)

        // Keep drawing the orb itself through the fade (covers both the
        // "struck, lingering briefly at the line" case and the "missed,
        // fading out as it passes" case) — only stop once fully faded.
        const drawOrb = true

        // Flat two-color scheme: solid yellow/gold for the single next-up
        // orb, solid grey for every other queued orb. No gradient, no
        // brightness ramp — queue position beyond "next" doesn't matter
        // visually, only the binary "is this the one to play now."
        const orbColor = isNextUp
          ? 0xffd700   // solid gold/yellow — play this one now
          : 0x888888   // solid grey — waiting in queue

        if (drawOrb) for (let k = 1; k <= 5; k++) {
          const tProg = prog - k * 0.025
          if (tProg < 0) continue
          const td = startDist + (distToLine - startDist) * tProg
          const tx = s.ax + sx * td, ty = s.ay + sy * td
          gfx.fillStyle(wasHit ? 0xffd700 : orbColor, (0.25 - k * 0.04) * fadeAlpha)
          gfx.fillCircle(tx, ty, 5 - k * 0.6)
        }

        // Sharp-required halo — drawn BEHIND everything else for this orb
        // so it reads as an aura around the orb rather than covering it.
        // Independent of queue position: the player needs to see "this
        // one needs the lever" while it's still approaching, not only the
        // instant it's next-up.
        if (beat.sharp) {
          gfx.fillStyle(0xb47bff, 0.45 * fadeAlpha)
          gfx.fillCircle(ox, oy, 11)
        }

        // Ornament halo — a distinct ring (not a filled aura, so it
        // doesn't read as "the same thing as sharp" at a glance) marking
        // "hitting this one triggers a flourish, not a plain note." Drawn
        // a bit larger than the sharp halo so the two can stack legibly
        // if a beat is somehow both (shouldn't normally happen on this
        // harp's repertoire, but isn't structurally prevented).
        if (beat.ornament) {
          gfx.lineStyle(2, 0x7fffd4, 0.6 * fadeAlpha)
          gfx.strokeCircle(ox, oy, 14)
        }

        // (Removed: pulsing glow halo for next-up. The solid color swap
        // on the orb itself is now the only "next up" cue — adding a
        // second, separately-animated effect on top tested as confusing.)

        if (drawOrb) {
          gfx.fillStyle(wasHit ? 0xffd700 : orbColor, 0.95 * fadeAlpha)
          gfx.fillCircle(ox, oy, 7)
          gfx.fillStyle(0xffffff, 0.6 * fadeAlpha)
          gfx.fillCircle(ox, oy, 3)
        }

        // Flash exactly at the arrival instant — a brief bright burst on
        // the hit-line at this string's height, independent of whether
        // the player struck it. Acts as a precise visual metronome tick:
        // "the beat IS now" regardless of player timing.
        const msSinceArrival = now - beat.atMs
        if (msSinceArrival >= 0 && msSinceArrival < 140) {
          const flashT = 1 - msSinceArrival / 140   // 1 at instant of arrival, fading to 0
          const flashR = 10 + (1 - flashT) * 18      // expands outward as it fades
          gfx.fillStyle(0xffffff, 0.55 * flashT)
          gfx.fillCircle(hitLineX, s.ay, flashR)
          gfx.fillStyle(0xffffff, 0.85 * flashT)
          gfx.fillCircle(hitLineX, s.ay, 4)
        }
      })
    })
  }
}

// ── Helper: build a phrase from a sequence of string indices, spaced by a
// constant beat interval (e.g. derived from a tune's note durations).
// `beatMs` is the gap between successive note arrivals; `travelMs` is how
// long each orb takes to fly in (controls difficulty/readability, can be
// longer than beatMs since multiple orbs fly at once).
export function buildTimedPhrase(stringIndices, opts = {}) {
  const {
    beatMs    = 450,    // time between successive notes' arrival
    travelMs  = 1800,   // flight duration for every orb (constant, simplest case)
    windowMs  = 350,
    startDelayMs = 800, // grace period before the first orb arrives, so the
                         // player can see it coming
  } = opts
  return stringIndices.map((idx, i) => ({
    strings:  [idx],
    atMs:     startDelayMs + i * beatMs,
    travelMs,
    windowMs,
  }))
}

// ── Helper: build a timed phrase with per-note durations (e.g. from ABC
// note lengths) instead of a constant beatMs. `durations` is an array of
// relative lengths (e.g. 1 = eighth note, 2 = quarter) matching stringIndices.
// `sharps` (optional) is a parallel array of booleans — whether each note
// needs the harp to sound that string's sharp variant. Omit it (or pass an
// all-false/undefined array) for tunes that need no accidentals.
// `accents` (optional) is a parallel array of 0..1 metric-strength values
// (see abcToTimedStringSequence) — stored on each beat as `vel` so a
// renderer/autoPlay can vary loudness instead of every note hitting
// identically, which is most of what makes a sequenced tune sound flat
// and mechanical rather than played. Beats with no accent data default
// to vel 0.8 (a reasonable plain mf, not maximally loud).
// `lilt` (optional, default 0): 0..1 strength of a small, deterministic
// timing push-pull applied per-note (the lived-in "swing" of trad playing
// rather than a rigid grid). 0 = perfectly quantized, as before. Kept
// SMALL and seeded from note index (not Math.random()) so it's the same
// every time the same tune is built — a player practicing against it
// isn't chasing a moving target. windowMs should generally be a bit more
// forgiving than 0 when lilt > 0, since the orb's exact arrival now
// wobbles slightly off the strict grid.
// `ornaments` (optional) is a parallel array of null|{type,count} (see
// abcToTimedStringSequence) — stored on each beat as `ornament`. The
// PLAYER still only hits one orb for an ornament beat; the harp plays
// the actual flourish automatically (see corraHarp.js playOrnament).
// HarpPhrasePlayer also widens the hit-window for ornament beats — see
// _effectiveHalfWindow — since they stand in for passages a human can't
// physically play note-by-note.
export function buildTimedPhraseFromDurations(stringIndices, durations, opts = {}) {
  const {
    unitMs    = 220,    // ms per duration-unit (tempo control)
    travelMs  = 1800,
    windowMs  = 350,
    startDelayMs = 800,
    sharps    = null,
    accents   = null,
    lilt      = 0,
    ornaments = null,
  } = opts
  let t = startDelayMs
  return stringIndices.map((idx, i) => {
    // Deterministic pseudo-random offset from index, not Math.random() —
    // see header. Small sine-based wobble, max ~±18% of a duration-unit
    // at lilt=1, scaled down for lilt<1. Kept well under half the typical
    // note spacing so it reads as "feel", not as actually-late/early.
    const wobble = lilt > 0
      ? Math.sin(i * 12.9898) * unitMs * 0.18 * lilt
      : 0
    const beat = {
      strings:  [idx],
      atMs:     t + wobble,
      travelMs,
      windowMs,
      sharp:    !!sharps?.[i],
      vel:      accents?.[i] ?? 0.8,
      ornament: ornaments?.[i] ?? null,
    }
    t += (durations[i] ?? 1) * unitMs
    return beat
  })
}

// (HarpDemoPlayer removed — superseded by HarpPhrasePlayer's `autoPlay`
// option, which reuses the SAME draw loop as real play instead of a
// parallel no-orb implementation. The earlier no-orb version was a
// mistake: it made demo mode look broken — "the orbs disappear" — rather
// than showing the player what correct play actually looks like. See
// tavern.js's _startDemoPlayback for the new usage.)


// courseScript.js
// Location: js/game/scenes/locations/skye/courseScript.js
//
// EVERYTHING CONALL SAYS in the crash course (faicheCourse.js) is written in
//
//     tools/dialogue/drafts/faicheCourse.dlg
//
// and compiled into courseLines.js:
//
//     node tools/dialogue/course.mjs tools/dialogue/drafts/faicheCourse.dlg
//
// Edit the draft, not courseLines.js (it is overwritten on every compile).
// This file only hands the lines to the course, with its timings.
//
// Shape (see the draft's header for the format):
//   SCRIPT[lesson][slot] = [{ en, ga }, ...]                  a slot without buttons
//                        = { say: [...], ask: [option, ...] } a slot with buttons
// A slot that is missing is simply not said.

import { LINES } from './courseLines.js'

// {prince} in a line is "prince" or "princess" (Irish: prionsa / banphrionsa) by the champion; the course says which
// when it starts (setChampionGender). SCRIPT is a live binding, so everything that imports it sees the filled copy.
const TOKENS = { prince: { en: ['prince', 'princess'], ga: ['prionsa', 'banphrionsa'] } }
const fill = (x, f, key) => {
  if (Array.isArray(x)) return x.map(v => fill(v, f, key))
  if (x && typeof x === 'object') {
    const same = typeof x.en === 'string' && x.ga === x.en                      // an English placeholder stays one
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, fill(v, f, same && k === 'ga' ? 'en' : k)]))
  }
  if (typeof x !== 'string' || !x.includes('{')) return x
  const lang = key === 'ga' ? 'ga' : 'en'
  return x.replace(/\{(\w+)\}/g, (all, name) => TOKENS[name] ? TOKENS[name][lang][f ? 1 : 0] : all)
}
const build = f => fill(LINES, f)
export let SCRIPT = build(false)
export function setChampionGender(female) { SCRIPT = build(!!female) }

export const SALUTES = 3                   // how many salutes the calls lesson asks for ("Salute." then "Again." x2)
export const HINT_AFTER_MS = 14000         // a plain instruction, if a lesson stalls this long
export const GIVE_UP_MS = 90000            // and after this, he lets it go and moves on

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

export const SCRIPT = LINES

export const SALUTES = 4                   // how many salutes the calls lesson asks for ("Salute." then "Again." x3)
export const HINT_AFTER_MS = 14000         // a plain instruction, if a lesson stalls this long
export const GIVE_UP_MS = 90000            // and after this, he lets it go and moves on

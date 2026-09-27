// kata.js
// Location: public/data/skye/kata.js
//
// Uathach's kata, walked on the gaming-board floor of the ráth in her
// garden (skye_gairdin). Shared by the map generator (the board and its
// inlay) and the scene (skye/skyeGairdin.js), which runs them in order --
// a curriculum -- from the lár, the centre stone.
//
// Steps: space-separated tokens, an optional count then a direction:
//   F B L R   forward / back / left / right   (relative)
//   N S E W   ó thuaidh / ó dheas / soir / siar (compass; north = forward
//             on screen, so these walk the same way -- new words)
//   "3F" = "Trí chéim ar aghaidh."
// Every route must stay on the board (within BOARD_R of the lár).
//
// CONSTELLATIONS: some kata trace star figures from the intro's night sky
// (introModal.js constellation offsets, scaled onto the board and
// stretched to use it). `stars` lists their star tiles (relative to the
// lár): only those light, so the figure reads as the constellation, not as
// the path between. Most are just shapes. One -- `omen` -- is not.
//
// FRAMEWORK NOTE: step calls only so far. Place calls ("seas ar an gcloch
// dhearg", "sa lár", "ar an imeall") are next: the inlay colours below
// exist for them.

export const BOARD_R = 6.6          // a round board: stones within this radius
export const onBoard = (dx, dy) => Math.hypot(dx, dy) <= BOARD_R
export const LAR = [18, 18]         // the centre stone, where every kata begins

const REL = { F: 'ar aghaidh', B: 'ar gcúl', L: 'ar chlé', R: 'ar dheis' }
const REL_EN = { F: 'forward', B: 'back', L: 'to the left', R: 'to the right' }
const COMPASS = { N: 'ó thuaidh', S: 'ó dheas', E: 'soir', W: 'siar' }
const COMPASS_EN = { N: 'north', S: 'south', E: 'east', W: 'west' }
const NUM = { 2: 'Dhá', 3: 'Trí', 4: 'Ceithre', 5: 'Cúig' }
const NUM_EN = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five' }
export const MOVE = { F: 'F', B: 'B', L: 'L', R: 'R', N: 'F', S: 'B', E: 'R', W: 'L' }

const cap = s => s[0].toUpperCase() + s.slice(1)

// The wordings for one token. Several where there's a natural variant.
export function phrasesFor(token) {
  const m = token.match(/^(\d?)([FBLRNSEW])$/)
  const n = m[1] ? Number(m[1]) : 1, c = m[2]
  const word = REL[c] || COMPASS[c], wordEn = REL_EN[c] || COMPASS_EN[c]
  if (n > 1) return [{ ga: `${NUM[n]} chéim ${word}.`, en: `${NUM_EN[n]} steps ${wordEn}.` }]
  if (REL[c]) return [{ ga: `${cap(word)}.`, en: `${cap(wordEn)}.` },
                      { ga: `Céim ${word}.`, en: `A step ${wordEn}.` }]
  return [{ ga: `${cap(word)}.`, en: `${cap(wordEn)}.` }]
}
export const AGAIN = { ga: 'Arís.', en: 'Again.' }

export function parseSteps(k) {
  return k.steps.trim().split(/\s+/).map(tok => {
    const m = tok.match(/^(\d?)([FBLRNSEW])$/)
    return { token: tok, count: m[1] ? Number(m[1]) : 1, move: MOVE[m[2]] }
  })
}

export const KATA = [
  { id: 'cearnog',  name: { ga: 'An Chearnóg', en: 'The Square' },
    steps: 'F F R R B B L L' },
  { id: 'cros',     name: { ga: 'An Chros', en: 'The Cross' },
    steps: 'F F B B B B F F R R L L L L R R' },
  { id: 'biseach',  name: { ga: 'An Bíseach', en: 'The Spiral' },
    steps: 'F R B B L L F F F R R R B B B B' },
  { id: 'dachéim',  name: { ga: 'Dhá Chéim', en: 'Two Steps' },
    steps: '2F 2R 2B 2L 2B 2L 2F 2R' },
  // the curragh (naomhog in the night sky), bow to stern
  { id: 'naomhog',  name: { ga: 'An Naomhóg', en: 'The Curragh' },
    steps: 'F 5R R 2L 4B 2L 4F L B 4L 3F 2L',
    stars: [[6, -1], [2, 3], [1, -1], [-3, 0], [-5, -3]] },
  { id: 'rombas',   name: { ga: 'An Rombas', en: 'The Diamond' },
    steps: '3F 3R 3B 3B 3L 3L 3F 3F 3R' },
  { id: 'airde',    name: { ga: 'Na hAirde', en: 'The Quarters' },
    steps: 'N E S S W W N N E E S' },
  { id: 'rotha',    name: { ga: 'An Roth', en: 'The Wheel' },
    steps: '2N 2E 4S 4W 4N 2E 2S' },
  // She calls it "the Wave". Its seven turning points are the seven stars
  // of Tethra's court (cuirt). She doesn't know that. See skyeGairdin.js.
  { id: 'tonn',     name: { ga: 'An Tonn', en: 'The Wave' }, omen: 'tethra',
    steps: '4L B 3F R 2F 2R F R R B 2R 2B R 3B',
    stars: [[-4, 1], [-3, -2], [-1, -4], [0, -5], [1, -4], [3, -2], [4, 1]] },
]

// The tiles a kata walks, from the lár.
export function kataRoute(k) {
  const D = { F: [0, -1], B: [0, 1], L: [-1, 0], R: [1, 0] }
  let [x, y] = LAR
  const out = [[x, y]]
  for (const s of parseSteps(k)) {
    for (let i = 0; i < s.count; i++) { x += D[s.move][0]; y += D[s.move][1]; out.push([x, y]) }
  }
  return out
}

// The inlay: every board stone's colour -- a sun wheel. Rings of red and
// green around the lár, eight dark spokes, a dark rim. bán (pale granite),
// dubh (basalt), dearg (red sandstone), glas (green).
export function inlay(dx, dy) {
  const r = Math.hypot(dx, dy)
  if (dx === 0 && dy === 0) return 'lar'
  if (r > BOARD_R - 1) return 'dubh'                               // the rim
  const ring = Math.round(r)
  if (ring === 2 || ring === 4) return ring === 2 ? 'dearg' : 'glas'
  if (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) return 'dubh'   // spokes
  return 'ban'
}

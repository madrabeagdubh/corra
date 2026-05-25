/**
 * sanitise_spooky_tunes.mjs
 *
 * Fixes ABC notation in gameSpookyTunes.js so all tunes play correctly
 * in TradSessionPlayer / abcjs MIDI.
 *
 * Run from ~/Corra root:
 *   node tools/sanitise_spooky_tunes.mjs
 *
 * Produces:  js/game/systems/music/gameSpookyTunes.js  (in-place patch)
 * Also updates sesh.html to import gameSpookyTunes alongside allTunes.
 *
 * ROOT CAUSES fixed:
 *   A) Grace notes  {BAG} {ge}  → stripped (MIDI cannot render them)
 *   B) Inline chord [D3A3]       → first note only: D3
 *   C) Inline meter  [M:6/8]    → removed (breaks parser state)
 *   D) Inline key    [K:Dmaj]   → removed
 *   E) Nontuplets (5 (7 (9      → reduced to (3 (keep first 3 notes)
 *   F) Over-long notes  f8 in 4/4 context → f4-f4 (tied)
 *   G) Bracket slur chords [B,/F/]<[A,/G/] → stripped to plain notes
 *   H) Slur around bar line (A2|A2) → A2|A2  (remove outer parens)
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname);

// ── Paths ─────────────────────────────────────────────────────────────────────
const SPOOKY_PATH = path.join(ROOT, 'js/game/systems/music/gameSpookyTunes.js');
const SESH_PATH   = path.join(ROOT, 'sesh.html');

// ── ABC sanitiser ─────────────────────────────────────────────────────────────

function sanitiseABC(abc) {
  let s = abc;

  // A) Strip grace-note blocks  {BAG}  {ge}  {e}
  s = s.replace(/\{[^}]+\}/g, '');

  // B) Inline chord [D3A3] → keep first note+length  D3
  //    Matches [  note  length? more_stuff ]
  //    The first note is one of A-Ga-g (optionally with , or ' octave marks)
  //    followed by an optional length number/fraction.
  s = s.replace(/\[([A-Ga-gz][,']*)(\d*\/?\d*)[A-Ga-gz^_=][^\]]*\]/g, (_, note, len) => {
    return note + (len || '');
  });

  // C) Inline meter change  [M:6/8]  [M:3/4]  etc.
  s = s.replace(/\[M:[^\]]+\]/g, '');

  // D) Inline key change  [K:Dminor]  [K:Gmajor]  etc.
  s = s.replace(/\[K:[^\]]+\]/g, '');

  // E) Nontuplets  (5ABCDE (7ABCDEFG (9…  → (3 first-three-notes
  //    Replace (N where N>=5 followed by N notes with (3 + first 3 notes.
  //    A "note token" here is: optional accidental, pitch letter, optional length.
  //    We match the tuplet marker and then grab just the first 3 note tokens.
  s = s.replace(/\(([5-9])\s*/g, (match, n) => {
    // Just swap the count to (3 — the remaining notes after the 3rd will
    // simply play on as normal notes, which is a reasonable approximation.
    return '(3';
  });

  // F) Over-long tied notes  note8  note6  (> 4 beats in 4/4 w/ L:1/8)
  //    Replace note8 with note4-note4  and  note12 with note4-note4-note4
  //    Only fixes the common f8, B8 pattern (single letter + digit >= 6)
  s = s.replace(/([A-Ga-gz][,']?)(1[0-6]|[6-9])(?=\s|\||$)/g, (match, note, len) => {
    const n = parseInt(len);
    const chunk = 4; // split into quarters
    const pieces = Math.ceil(n / chunk);
    const parts = [];
    let remaining = n;
    for (let i = 0; i < pieces; i++) {
      const thisLen = Math.min(remaining, chunk);
      parts.push(note + thisLen);
      remaining -= thisLen;
    }
    return parts.join('-');
  });

  // G) Bracket slur chords  [B,/F/]<[A,/G/] → strip brackets, keep first note in each
  //    These are cross-voice/harmony brackets, not standard ABC single-voice
  s = s.replace(/\[([A-Ga-g][,']?\/?)([A-Ga-g][^\]]*)\]/g, (_, first) => first);

  // H) Slur around barline  (A2|A2)  →  A2|A2
  //    i.e. remove a ( that only contains the opening note before a |
  s = s.replace(/\(([A-Ga-gz][,']?\d*)\|/g, '$1|');

  // Tidy up any double-spaces left after stripping
  s = s.replace(/ {2,}/g, ' ');

  return s;
}

// ── Process gameSpookyTunes.js ────────────────────────────────────────────────

let src = readFileSync(SPOOKY_PATH, 'utf8');

// The file is:  export const gameSpookyTunes = {  key: `...ABC...`, ... }
// We need to sanitise each template-literal value.

let fixCount = 0;
const patched = src.replace(/`([^`]+)`/g, (match, abc) => {
  // Only process strings that look like ABC (contain X: header)
  if (!/^[\n\r]*X:/m.test(abc)) return match;
  const fixed = sanitiseABC(abc);
  if (fixed !== abc) fixCount++;
  return '`' + fixed + '`';
});

writeFileSync(SPOOKY_PATH, patched, 'utf8');
console.log(`[sanitise] gameSpookyTunes.js — ${fixCount} tunes patched`);

// ── Patch sesh.html to also load gameSpookyTunes ──────────────────────────────
//
// sesh.html currently only imports allTunes.  We add a second import and
// merge gameSpookyTunes into the session's available tune list.

let html = readFileSync(SESH_PATH, 'utf8');

const ALREADY = html.includes('gameSpookyTunes');
if (ALREADY) {
  console.log('[sanitise] sesh.html already imports gameSpookyTunes — skipping');
} else {
  // 1. Add import after the allTunes import line
  html = html.replace(
    `import { allTunes } from './js/game/systems/music/allTunes.js';`,
    `import { allTunes } from './js/game/systems/music/allTunes.js';
    import { gameSpookyTunes } from './js/game/systems/music/gameSpookyTunes.js';`
  );

  // 2. Merge into tuneKeys — replace the line that sets tuneKeys
  html = html.replace(
    `tuneKeys = Object.keys(allTunes);`,
    `// Merge allTunes + gameSpookyTunes so all are browsable in the player
        const mergedTunes = { ...allTunes, ...gameSpookyTunes };
        // Monkey-patch session so loadTune() can find spooky keys too
        const _origLoad = session.loadTune.bind(session);
        session.loadTune = async (key) => {
            if (gameSpookyTunes[key]) {
                // Temporarily inject into the tunes the session knows about
                session.tunes = session.tunes || {};
                session.tunes[key] = gameSpookyTunes[key];
            }
            return _origLoad(key);
        };
        tuneKeys = Object.keys(mergedTunes);`
  );

  // 3. Update the tune count log line
  html = html.replace(
    `console.log('[Main] Available tunes:', tuneKeys.length);`,
    `console.log('[Main] Available tunes:', tuneKeys.length, '(allTunes + spooky)');`
  );

  writeFileSync(SESH_PATH, html, 'utf8');
  console.log('[sanitise] sesh.html patched — gameSpookyTunes now merged in');
}

console.log('[sanitise] Done. Reload sesh.html to test.');

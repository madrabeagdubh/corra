#!/usr/bin/env node
//
// tools/dialogue/map.mjs
//
// Reads the dialogue data and reports on it. Generated, never maintained.
//
//   node tools/dialogue/map.mjs                    live files, map + warnings
//   node tools/dialogue/map.mjs --warn             warnings only
//   node tools/dialogue/map.mjs --all              include unused data files
//   node tools/dialogue/map.mjs --pacing           add timings to every line
//   node tools/dialogue/map.mjs d3Sea              one file
//   node tools/dialogue/map.mjs --out map.txt      write instead of printing
//
// DO NOT EDIT THE OUTPUT. It is a view, not a source. The files under
// public/data are the model; this only reads them. Anything edited here is
// lost on the next run, and a second editable copy of a dialogue tree drifts
// from the real one within days -- which is worse than having no map, because
// a wrong map gets trusted.
//
// Keep it open in a split and regenerate. Don't treat it as a document.
//
// WHICH FILES ARE LIVE
//
// bogScene._contentKey() turns a scene's map key into the data filename, so a
// data file is loaded if and only if a scene file of the same name exists.
// That gets checked rather than listed, so retired scenes drop out of the
// report on their own and there's nothing to remember.
//
// WHAT IT'S FOR
//
// Per-NPC trees are small enough to hold in your head. The complexity is
// BETWEEN encounters -- a druid sets a note, a toll-man two maps away requires
// it, and nothing connects those two facts. A picture won't catch a broken link
// there. A ledger will.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import url from 'node:url'

// Find the repo root by walking up from this file, so it runs from anywhere.
let ROOT = process.cwd()
if (!fs.existsSync(path.join(ROOT, 'public', 'data'))) {
  let d = path.dirname(url.fileURLToPath(import.meta.url))
  while (d !== path.dirname(d) &&
         !fs.existsSync(path.join(d, 'public', 'data'))) d = path.dirname(d)
  ROOT = d
}

const DATA_DIR  = path.join(ROOT, 'public', 'data')
const SCENE_DIR = path.join(ROOT, 'js', 'game', 'scenes')

const args      = process.argv.slice(2)
const flag      = n => args.includes('--' + n)
const WARN_ONLY = flag('warn')
const PACING    = flag('pacing')
const SHOW_ALL  = flag('all')
const outIdx    = args.indexOf('--out')
const OUT_FILE  = outIdx >= 0 ? args[outIdx + 1] : null
const ONLY      = args.find((a, i) =>
  !a.startsWith('--') && args[i - 1] !== '--out') || null

// Timing, kept in step with textPanel.js. Drives --pacing and the
// wants-chunking warning only, so drift misleads rather than breaks.
const SYLLABLE_MS   = 380
const TAIL_BEATS    = 2
const UNIT_MS       = 180
const LONG_BLOCK_MS = 8000

const VOWEL_RUN = /[aeiouáéíóúAEIOUÁÉÍÓÚ]+/g
const syllables = s => (String(s || '').match(VOWEL_RUN) || []).length

function blockMs(ga) {
  const s = syllables(ga)
  if (!s) return 0
  const raw = s * SYLLABLE_MS + TAIL_BEATS * UNIT_MS
  return Math.max(UNIT_MS, Math.round(raw / UNIT_MS) * UNIT_MS)
}

// ------------------------------------------------------------- liveness

function sceneNames() {
  const found = new Set()
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.js')) found.add(e.name.replace(/\.js$/, ''))
    }
  }
  walk(SCENE_DIR)
  return found
}

// -------------------------------------------------------------- loading

function dataFiles() {
  const found = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.js')) found.push(p)
    }
  }
  if (!fs.existsSync(DATA_DIR)) {
    console.error('No public/data found from ' + ROOT)
    process.exit(1)
  }
  walk(DATA_DIR)
  return found.sort()
}

async function loadContent(file) {
  const src = fs.readFileSync(file, 'utf8')
  // Files importing other modules can't be loaded standalone. They aren't
  // dialogue data, so skipping is correct rather than a shortcoming.
  if (/^\s*import\s/m.test(src)) return { __skip: true }
  const tmp = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'dlgmap-')),
    path.basename(file, '.js') + '.mjs'
  )
  fs.copyFileSync(file, tmp)
  try {
    return await import(url.pathToFileURL(tmp).href)
  } catch (e) {
    return { __error: e.message }
  }
}

// -------------------------------------------------------------- walking

function findSpeakers(obj, trail = []) {
  const found = []
  if (!obj || typeof obj !== 'object') return found
  if (Array.isArray(obj.dialogues)) found.push({ trail: trail.join('.'), node: obj })
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object') {
      found.push(...findSpeakers(v, trail.concat(Array.isArray(obj) ? `[${k}]` : k)))
    }
  }
  return found
}

const sets  = new Map()
const reads = new Map()
const warn  = new Map()
// Lines drafted in English with no Irish yet. Expected, not wrong -- the Irish
// is settled last so it need only be written once.
const todo  = []

const addWarn = (cat, detail) => {
  if (!warn.has(cat)) warn.set(cat, [])
  warn.get(cat).push(detail)
}

const record = (map, key, where) => {
  if (!key) return
  if (!map.has(key)) map.set(key, [])
  map.get(key).push(where)
}

function effects(src, where) {
  if (!src) return
  if (src.note)          record(sets, 'note:' + src.note, where)
  if (src.setQuest)      record(sets, 'quest:' + src.setQuest, where)
  if (src.completeQuest) record(sets, 'quest:' + src.completeQuest, where)
}

function requires(src, where) {
  const r = src?.requires
  if (!r) return
  if (r.note)          record(reads, 'note:' + r.note, where)
  if (r.noteAbsent)    record(reads, 'note:' + r.noteAbsent, where + ' (absent)')
  if (r.quest)         record(reads, 'quest:' + r.quest, where)
  if (r.questActive)   record(reads, 'quest:' + r.questActive, where)
  if (r.questComplete) record(reads, 'quest:' + r.questComplete, where)
  if (r.questAbsent)   record(reads, 'quest:' + r.questAbsent, where + ' (absent)')
}

const reqStr = r => r ? Object.entries(r).map(([k, v]) => `${k}=${v}`).join(' ') : ''

function effStr(src) {
  const b = []
  if (src.note)          b.push(`note:${src.note}`)
  if (src.setQuest)      b.push(`quest+${src.setQuest}`)
  if (src.completeQuest) b.push(`quest done:${src.completeQuest}`)
  return b.join(' ')
}

const clip = (s, n = 52) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

// ----------------------------------------------------------------- main

const body = []
const say  = s => body.push(s)

const live   = sceneNames()
const unused = []
let nSpeakers = 0, nNodes = 0, nOptions = 0

for (const file of dataFiles()) {
  const name = path.basename(file, '.js')
  if (ONLY && !file.includes(ONLY)) continue

  const isLive = live.has(name)
  if (!isLive && !SHOW_ALL && !ONLY) { unused.push(name); continue }

  const mod = await loadContent(file)
  if (mod.__skip) continue
  if (mod.__error) {
    addWarn('could not load', `${name}: ${mod.__error}`)
    continue
  }

  for (const content of Object.values(mod)) {
    const speakers = findSpeakers(content)
    if (!speakers.length) continue

    say('')
    say(`── ${name}${isLive ? '' : '   (UNUSED — no scene of this name)'}`)

    for (const { trail, node: speaker } of speakers) {
      nSpeakers++
      const tag = speaker.portrait ? '· ' + path.basename(speaker.portrait) : ''
      say(`   ${trail}  ${tag}`)

      let entries = 0

      speaker.dialogues.forEach((d, i) => {
        nNodes++
        const at = `${name}.${trail}[${i}]`
        effects(d, at); requires(d, at)

        const gated = d.requires && Object.keys(d.requires).length > 0
        if (!gated) entries++

        // English is what's shown: it's the draft language here, changed
        // freely, while the Irish is settled last and ideally edited once.
        // Pacing below still measures the IRISH, because that's what the game
        // times off -- the display language and the measured language are
        // deliberately different.
        say(`     [${i}] ${clip(d.en || d.ga)}${d.en ? '' : '  «no en»'}` +
            `${gated ? `  ⟨${reqStr(d.requires)}⟩` : ''}` +
            `${effStr(d) ? '  → ' + effStr(d) : ''}`)

        if (PACING && d.ga) {
          say(`          ${syllables(d.ga)} Irish syl · ${(blockMs(d.ga) / 1000).toFixed(1)}s`)
        }
        if (d.ga && blockMs(d.ga) > LONG_BLOCK_MS) {
          addWarn('line too long to hold in one card',
                  `${at}  ${(blockMs(d.ga) / 1000).toFixed(0)}s, ${syllables(d.ga)} syl`)
        }
        if (d.ga && !d.en) addWarn('no English — the support text is missing', at)
        if (d.en && !d.ga) todo.push(at)

        const opts = d.options || []
        opts.forEach((o, j) => {
          nOptions++
          const ow = `${at}.opt[${j}]`
          effects(o, ow); requires(o, ow)

          const marks = [o.exit && 'exit', o.silent && 'silent', o.hold && 'hold']
            .filter(Boolean).join(',')
          say(`          · ${clip(o.en || o.ga, 30).padEnd(31)}` +
              `${marks ? '[' + marks + ']' : ''}` +
              `${o.requires ? `  ⟨${reqStr(o.requires)}⟩` : ''}` +
              `${effStr(o) ? '  → ' + effStr(o) : ''}`)

          // Missing English is a fault: it's the scaffolding the player leans
          // on. Missing Irish is just work not done yet, so it's counted, not
          // complained about.
          if (o.say && !o.sayEn)       addWarn('no English — the support text is missing', `${ow} say`)
          if (o.replyGa && !o.replyEn) addWarn('no English — the support text is missing', `${ow} reply`)
          if (o.ga && !o.en)           addWarn('no English — the support text is missing', ow)
          if (o.sayEn && !o.say)       todo.push(`${ow} say`)
          if (o.replyEn && !o.replyGa) todo.push(`${ow} reply`)
          if (o.en && !o.ga)           todo.push(ow)
          if (o.exit && (o.replyGa || o.replyEn)) {
            addWarn('exit option carries a reply that is never shown', ow)
          }
          for (const k of ['say', 'replyGa']) {
            if (o[k] && blockMs(o[k]) > LONG_BLOCK_MS) {
              addWarn('line too long to hold in one card',
                      `${ow} ${k}  ${(blockMs(o[k]) / 1000).toFixed(0)}s`)
            }
          }
        })

        // Cards with buttons cannot be swipe-dismissed, so options with no exit
        // trap the player. A node with NO options is dismissible and fine.
        if (opts.length && !opts.some(o => o.exit)) {
          addWarn('no way out — options but no exit', at)
        }
        opts.forEach((o, j) => {
          // An option carrying a player line but no reply used to render a
          // blank card that had to be swiped away. encounterPanel now skips
          // straight past it -- which means the player's line is never seen at
          // all, so these want a reply written rather than leaving.
          const speaks   = !!(o.say || o.sayEn)
          const answered = !!(o.replyGa || o.replyEn)
          if (speaks && !answered && !o.exit) {
            addWarn('speaks but gets no answer', `${at}.opt[${j}]`)
          }
        })
      })

      if (!entries) {
        addWarn('unreachable on a fresh save — every node gated', `${name}.${trail}`)
      }
    }
  }
}

// --------------------------------------------------------------- ledger

const flags = new Set([...sets.keys(), ...reads.keys()])
for (const f of [...flags].sort()) {
  const s = sets.get(f) || []
  const r = reads.get(f) || []
  // An absent-check with no writer is normal -- it means "before anything has
  // happened". Only a positive read with no writer is a broken link.
  const positive = r.filter(w => !w.includes('(absent)'))
  if (!s.length && positive.length) {
    addWarn('required but never set', `${f}  ← ${positive.join(', ')}`)
  }
  if (s.length && !r.length) {
    addWarn('set but never read', `${f}  (${s.join(', ')})`)
  }
}

// --------------------------------------------------------------- output

const report = []
report.push('CORRA DIALOGUE — generated, do not edit')
report.push(`${nSpeakers} speakers · ${nNodes} nodes · ${nOptions} options`)
if (todo.length) {
  report.push(`${todo.length} line(s) still awaiting Irish`)
}
if (unused.length) {
  report.push('')
  report.push(`not loaded by any scene (--all to include):`)
  report.push(`  ${unused.join(', ')}`)
}

if (!WARN_ONLY) report.push(...body)

report.push('')
report.push('FLAGS')
for (const f of [...flags].sort()) {
  const s = (sets.get(f) || []).length
  const r = (reads.get(f) || []).length
  report.push(`  ${f.padEnd(28)} set ${s}   read ${r}`)
}

if (todo.length) {
  report.push('')
  report.push(`AWAITING IRISH (${todo.length})`)
  for (const t of todo) report.push(`      ${t}`)
}

report.push('')
const total = [...warn.values()].reduce((a, b) => a + b.length, 0)
report.push(total ? `WARNINGS (${total})` : 'No warnings.')
for (const [cat, items] of warn) {
  report.push('')
  report.push(`  ${cat}  (${items.length})`)
  for (const i of items) report.push(`      ${i}`)
}
report.push('')

const text = report.join('\n')
if (OUT_FILE) {
  fs.writeFileSync(path.resolve(ROOT, OUT_FILE), text)
  console.log(`Wrote ${OUT_FILE} — ${nNodes} nodes, ${total} warnings.`)
  console.log('Generated view. Edit public/data, not this file.')
} else {
  console.log(text)
}

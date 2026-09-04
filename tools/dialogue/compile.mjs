#!/usr/bin/env node
//
// tools/dialogue/compile.mjs
//
// Compiles a plain-text dialogue draft into the dialogues array of a data file.
//
//   node tools/dialogue/compile.mjs tools/dialogue/drafts/d3Sea.dlg
//   node tools/dialogue/compile.mjs drafts/d3Sea.dlg --check   (no write)
//
//   node tools/dialogue/compile.mjs --export d3Sea             (js -> draft)
//   node tools/dialogue/compile.mjs --export d3Sea --keep-irish
//
// --export goes the other way: it reads an existing data file and writes a
// draft from it. By default the % lines come out BLANK -- the English is the
// draft and the Irish is filled in later. --keep-irish carries across whatever
// Irish is already in the .js, which is what you want if you are adopting a
// file that already has some.
//
// THE DRAFT IS THE SOURCE. The .js is generated. Edit the .dlg and recompile;
// never edit the dialogues array by hand, because the next compile overwrites
// it. Everything else in the .js file -- placement, radius, visual gid, the
// header comments -- is left exactly as it was.
//
// ─────────────────────────────────────────────────────────── FORMAT ──
//
//   @file       d3Sea               which public/data/**/NAME.js to write into
//   @encounter  0                   index into fixedEncounters (default 0)
//   @npcs       0                   ...or into npcs instead
//
//   = greeting                      a node. The name is a comment, for you.
//   @when !quest q_baile            gate: see CONDITIONS below
//   @note met_muireann              set a note when this node shows
//   @quest q_baile                  start a quest
//   @done q_baile                   complete a quest
//   @hold                           keep the card open after this node
//   @again Well? / Bhuel?           the nudge line, English / Irish
//   Attend to me now.               the speech. One line per line on screen.
//   % Éist liom anois.              the Irish for the line above it.
//   You have beached your boat.
//   % Tá do bhád tarraingthe agat.
//
//   * Who are you?                  an option. Text is the button label.
//   % Cé thusa?                     Irish label
//   @note knows_muireann            directives apply to the option
//   @exit                           this option closes the conversation
//   @silent                         no reply card
//   @easca playerName               (options) type a word; {playerName}
//   @continue                       (nodes, no options) flow into the
//                                   next node rather than closing
//   @easca playerName               ON A NODE: open the keyboard when
//                                   the card is dismissed
//   @eascaMatch knows_own_name      (options) set this note only if
//                                   what they typed matches their
//                                   champion's nameGa. On a match
//                                   {playerVoc} is available too.
//                                   in any reply is replaced with it
//   @first                          only offered once
//   > Who are you, woman of stone?  what the PLAYER says
//   % Cé thusa, a bhean na gcloch?
//   < One who is here.              what the NPC replies
//   % Duine a bhíonn anseo.
//   < One who watches.
//   % Duine a bhíonn ag faire.
//
// Blank lines are ignored. `#` at the start of a line is a comment.
//
// ─────────────────────────────────────────────────────── CONDITIONS ──
//
//   @when quest X      questActive       @when !quest X    questAbsent
//   @when done X       questComplete     @when note X      note
//   @when !note X      noteAbsent
//
// ────────────────────────────────────────────────────── WHY LIKE THIS ──
//
// English-only drafting was the whole point, so the Irish is optional
// everywhere and its absence is not an error. When it arrives it goes on a `%`
// line directly beneath the English it translates, which makes the pairing
// positional: a line can't drift away from its translation, and the compiler
// checks that every `%` actually follows something.
//
// That check matters more than it looks. The runtime pairs `ga` and `en` by
// splitting both on \n and matching index to index, so one stray line silently
// puts Irish line 3 under English line 2 -- which reads as a mistranslation
// rather than a formatting slip, and is very hard to spot in a card.

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

let ROOT = process.cwd()
if (!fs.existsSync(path.join(ROOT, 'public', 'data'))) {
  let d = path.dirname(url.fileURLToPath(import.meta.url))
  while (d !== path.dirname(d) &&
         !fs.existsSync(path.join(d, 'public', 'data'))) d = path.dirname(d)
  ROOT = d
}

const args  = process.argv.slice(2)
const CHECK = args.includes('--check')
const EXPORT = args.includes('--export')
const KEEP_IRISH = args.includes('--keep-irish')
const SRC   = args.find(a => !a.startsWith('--'))

if (!SRC) {
  console.error('usage: node tools/dialogue/compile.mjs <draft.dlg> [--check]')
  console.error('       node tools/dialogue/compile.mjs --export <name> [--keep-irish]')
  process.exit(1)
}

// The legend that goes at the top of every exported draft. Anyone opening one
// of these six months from now should not have to find this file to read it.
const LEGEND = (name) => `# ${name} — dialogue draft
#
# THIS FILE IS THE SOURCE. The dialogues array in public/data/bog/${name}.js is
# GENERATED from it and is overwritten on every compile. Edit here, not there.
#
#   node tools/dialogue/compile.mjs tools/dialogue/drafts/${name}.dlg --check
#   node tools/dialogue/compile.mjs tools/dialogue/drafts/${name}.dlg
#
# ── SYMBOLS ───────────────────────────────────────────────────────────────
#
#   =  a node. What the NPC says when this point is reached. The name after
#      it is only a label for you; it is not used by the game.
#
#   *  an option. The text is what appears ON THE BUTTON.
#
#   >  what the PLAYER says after choosing that option.
#
#   <  what the NPC says back.
#
#   %  the Irish for the line directly above it. A bare % is a placeholder
#      for Irish not yet written, and is ignored. English alone is a
#      perfectly valid draft — that is the point of working this way.
#
#   @  a directive. See below.
#
#   #  a comment. Ignored.
#
# Every > < = * line may be repeated to make several lines on screen. Each
# one gets its own % beneath it if it has Irish. Irish and English are paired
# BY POSITION, so a missing or extra line silently shifts every translation
# after it out of step — which reads as a mistranslation rather than a
# formatting slip. The compiler refuses to build if the counts disagree.
#
# ── DIRECTIVES ────────────────────────────────────────────────────────────
#
#   @file NAME          which data file to write into  (required, once)
#   @encounter N        index into fixedEncounters     (default 0)
#
#   @when quest X       only if quest X is running
#   @when !quest X      only if quest X has not started
#   @when done X        only if quest X is finished
#   @when note X        only if the player has note X
#   @when !note X       only if they do not
#
#   @note X             set note X
#   @quest X            start quest X
#   @done X             finish quest X
#   @hold               keep the card open rather than closing after this
#   @first              (options) offer this only once
#   @exit               (options) this one ends the conversation
#   @silent             (options) no reply card
#   @again EN / GA      the nudge line when the player lingers
#
# A node with options MUST have one marked @exit: cards with buttons cannot
# be dismissed by swiping, so without it the player is trapped.
#
# ──────────────────────────────────────────────────────────────────────────
`

// ─────────────────────────────────────────────────────────────── export ──
// Reads a data file and writes a draft from it. Blank % lines by default:
// the English is the draft and the Irish arrives later.

if (EXPORT) {
  const jsPath = path.join(ROOT, 'public', 'data', 'bog', SRC + '.js')
  if (!fs.existsSync(jsPath)) {
    console.error('No such data file: ' + path.relative(ROOT, jsPath))
    process.exit(1)
  }
  const tmp = path.join(ROOT, 'node_modules', '.dlg-export-' + SRC + '.mjs')
  fs.mkdirSync(path.dirname(tmp), { recursive: true })
  fs.copyFileSync(jsPath, tmp)
  const mod = await import(url.pathToFileURL(tmp).href)
  fs.unlinkSync(tmp)

  const content = Object.values(mod)[0]
  const speaker = (content.fixedEncounters || content.npcs || [])[0]
  if (!speaker?.dialogues) {
    console.error('No dialogues found in ' + SRC + '.js')
    process.exit(1)
  }

  const L = [LEGEND(SRC), '', '@file       ' + SRC, '@encounter  0', '']

  // English line, then its % beneath -- blank unless --keep-irish.
  const pair = (en, ga, prefix) => {
    const e = (en || '').split('\n')
    const g = (ga || '').split('\n')
    e.forEach((line, i) => {
      L.push(prefix + line)
      L.push('% ' + (KEEP_IRISH && g[i] ? g[i] : ''))
    })
  }

  speaker.dialogues.forEach((n, i) => {
    L.push('= node ' + i)
    const r = n.requires || {}
    if (r.questAbsent)   L.push('@when !quest ' + r.questAbsent)
    if (r.questActive)   L.push('@when quest ' + r.questActive)
    if (r.questComplete) L.push('@when done ' + r.questComplete)
    if (r.note)          L.push('@when note ' + r.note)
    if (r.noteAbsent)    L.push('@when !note ' + r.noteAbsent)
    if (n.note)          L.push('@note ' + n.note)
    if (n.setQuest)      L.push('@quest ' + n.setQuest)
    if (n.completeQuest) L.push('@done ' + n.completeQuest)
    if (n.hold)          L.push('@hold')
    if (n.continue)      L.push('@continue')
    if (n.easca)         L.push('@easca ' + n.easca)
    if (n.eascaMatch)    L.push('@eascaMatch ' + n.eascaMatch)
    if (n.again)         L.push('@again ' + (n.again.en || '') +
                                (n.again.ga ? ' / ' + n.again.ga : ''))
    pair(n.en, n.ga, '')
    L.push('')
    ;(n.options || []).forEach(o => {
      L.push('* ' + (o.en || ''))
      L.push('% ' + (KEEP_IRISH && o.ga ? o.ga : ''))
      if (o.note)   L.push('@note ' + o.note)
      if (o.first)  L.push('@first')
      if (o.exit)   L.push('@exit')
      if (o.silent) L.push('@silent')
      if (o.easca)  L.push('@easca ' + o.easca)
      if (o.eascaMatch) L.push('@eascaMatch ' + o.eascaMatch)
      ;(o.exchange || []).forEach(tn => {
        if (tn.sayEn)   pair(tn.sayEn, tn.say, '> ')
        if (tn.replyEn) pair(tn.replyEn, tn.replyGa, '< ')
      })
      if (o.sayEn)   pair(o.sayEn, o.say, '> ')
      if (o.replyEn) pair(o.replyEn, o.replyGa, '< ')
      L.push('')
    })
  })

  const outDir = path.join(ROOT, 'tools', 'dialogue', 'drafts')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, SRC + '.dlg')
  fs.writeFileSync(outPath, L.join('\n'))
  console.log('Wrote ' + path.relative(ROOT, outPath) + ' — ' +
              speaker.dialogues.length + ' nodes' +
              (KEEP_IRISH ? ' with Irish.' : ', Irish left blank.'))
  if (!KEEP_IRISH) {
    console.log('The Irish in ' + SRC + '.js will be LOST on the next compile.')
    console.log('Re-run with --keep-irish if you meant to keep it.')
  }
  process.exit(0)
}

const srcPath = path.resolve(ROOT, SRC)
if (!fs.existsSync(srcPath)) {
  console.error('No such draft: ' + srcPath)
  process.exit(1)
}

const errors = []
const fail = (line, msg) => errors.push(`line ${line}: ${msg}`)

// ------------------------------------------------------------- parsing

const raw = fs.readFileSync(srcPath, 'utf8').split('\n')

const header = { file: null, encounter: 0, npcs: null }
const nodes  = []

let node = null      // current node
let opt  = null      // current option
let last = null      // what a `%` line would translate: {obj, key}

const setDirective = (target, word, rest, ln) => {
  switch (word) {
    case 'when': {
      const m = rest.match(/^(!?)(quest|done|note)\s+(\S+)$/)
      if (!m) { fail(ln, `@when should be "quest X", "!quest X", "done X", "note X" or "!note X"`); return }
      const [, neg, kind, id] = m
      target.requires = target.requires || {}
      if (kind === 'quest') target.requires[neg ? 'questAbsent' : 'questActive'] = id
      else if (kind === 'done') {
        if (neg) fail(ln, '"!done" is not a condition the runtime understands')
        else target.requires.questComplete = id
      } else target.requires[neg ? 'noteAbsent' : 'note'] = id
      return
    }
    case 'note':   target.note = rest; return
    case 'quest':  target.setQuest = rest; return
    case 'done':   target.completeQuest = rest; return
    case 'hold':   target.hold = true; return
    case 'first':  target.first = true; return
    case 'exit':   target.exit = true; return
    case 'silent': target.silent = true; return
    case 'easca':  target.easca = rest || 'playerName'; return
    case 'eascaMatch': target.eascaMatch = rest; return
    case 'continue': target.continue = true; return
    case 'again': {
      const [en, ga] = rest.split('/').map(s => s.trim())
      target.again = ga ? { ga, en } : { en }
      return
    }
    default: fail(ln, `unknown directive @${word}`)
  }
}

const addLine = (obj, key, text) => {
  obj[key] = obj[key] ? obj[key] + '\n' + text : text
}

// One turn is one hero line and one NPC answer. A `>` arriving after a `<`
// has already landed starts a NEW turn -- which is what lets an exchange
// alternate on screen instead of stacking all the player's lines above all
// the NPC's. Options that never alternate collect a single turn and are
// flattened back to say/reply below, so nothing existing changes.
const currentTurn = (o, isHero) => {
  o.__turns = o.__turns || []
  let t = o.__turns[o.__turns.length - 1]
  if (!t || (isHero && (t.replyEn || t.replyGa))) { t = {}; o.__turns.push(t) }
  return t
}

raw.forEach((line, i) => {
  const ln = i + 1
  const t  = line.trim()
  if (!t || t.startsWith('#')) return

  // ---- header
  if (t.startsWith('@file '))      { header.file = t.slice(6).trim(); return }
  if (t.startsWith('@encounter ')) { header.encounter = Number(t.slice(11)); return }
  if (t.startsWith('@npcs '))      { header.npcs = Number(t.slice(6)); return }

  // ---- Irish for whatever came last
  if (t.startsWith('%')) {
    const text = t.slice(1).trim()
    if (!last) { fail(ln, '% line with nothing above it to translate'); return }
    // A bare % is a placeholder for Irish not written yet. It has to be
    // skipped rather than added as an empty line: an empty string still
    // counts when the runtime splits on \n, so it would render as a blank
    // row in the card and throw the line pairing out by one.
    if (!text) return
    addLine(last.obj, last.key, text)
    return
  }

  // ---- new node
  if (t.startsWith('=')) {
    node = { __name: t.slice(1).trim(), options: [] }
    nodes.push(node)
    opt = null
    last = null
    return
  }

  // ---- new option
  if (t.startsWith('*')) {
    if (!node) { fail(ln, 'option before any node'); return }
    opt = { en: t.slice(1).trim() }
    node.options.push(opt)
    last = { obj: opt, key: 'ga' }
    return
  }

  // ---- directives
  if (t.startsWith('@')) {
    const m = t.match(/^@(\w+)\s*(.*)$/)
    if (!m) { fail(ln, 'malformed directive'); return }
    const target = opt || node
    if (!target) { fail(ln, 'directive before any node'); return }
    setDirective(target, m[1], m[2].trim(), ln)
    return
  }

  // ---- player line
  if (t.startsWith('>')) {
    if (!opt) { fail(ln, '> player line outside an option'); return }
    const turn = currentTurn(opt, true)
    addLine(turn, 'sayEn', t.slice(1).trim())
    last = { obj: turn, key: 'say' }
    return
  }

  // ---- npc reply
  if (t.startsWith('<')) {
    if (!opt) { fail(ln, '< reply line outside an option'); return }
    const turn = currentTurn(opt, false)
    addLine(turn, 'replyEn', t.slice(1).trim())
    last = { obj: turn, key: 'replyGa' }
    return
  }

  // ---- plain speech, belongs to the node
  if (!node) { fail(ln, 'text before any node'); return }
  if (opt)   { fail(ln, 'text after an option — did you mean > or < ?'); return }
  addLine(node, 'en', t)
  last = { obj: node, key: 'ga' }
})

// One turn is the ordinary case and stays flat, so every draft written
// before exchanges existed compiles byte-for-byte as it did. More than one
// becomes an exchange the panel walks card by card.
for (const n of nodes) {
  for (const o of n.options) {
    const turns = o.__turns || []
    delete o.__turns
    if (turns.length === 1) Object.assign(o, turns[0])
    else if (turns.length > 1) o.exchange = turns
  }
}

if (!header.file) errors.push('no @file directive — which data file should this write to?')

// ------------------------------------------------------- pairing check

for (const [i, n] of nodes.entries()) {
  const check = (obj, gaKey, enKey, where) => {
    const ga = obj[gaKey], en = obj[enKey]
    if (!ga || !en) return                     // English-only is fine
    const g = ga.split('\n').length, e = en.split('\n').length
    if (g !== e) {
      errors.push(`${where}: ${g} Irish lines against ${e} English — ` +
                  `the runtime pairs them by index, so these would be mismatched`)
    }
  }
  check(n, 'ga', 'en', `node ${i} (${n.__name})`)
  n.options.forEach((o, j) => {
    check(o, 'ga', 'en', `node ${i} option ${j}`)
    check(o, 'say', 'sayEn', `node ${i} option ${j} (player line)`)
    check(o, 'replyGa', 'replyEn', `node ${i} option ${j} (reply)`)
    ;(o.exchange || []).forEach((tn, k) => {
      check(tn, 'say', 'sayEn', `node ${i} option ${j} turn ${k} (player line)`)
      check(tn, 'replyGa', 'replyEn', `node ${i} option ${j} turn ${k} (reply)`)
    })
  })
  if (n.options.length && !n.options.some(o => o.exit)) {
    errors.push(`node ${i} (${n.__name}): has options but none marked @exit — ` +
                `cards with buttons can't be swipe-dismissed, so the player is stuck`)
  }
}

if (errors.length) {
  console.error(`\n${errors.length} problem(s) in ${SRC}:\n`)
  for (const e of errors) console.error('  • ' + e)
  console.error('')
  process.exit(1)
}

// ------------------------------------------------------------ emitting

const q = s => "'" + String(s).replace(/\\/g, '\\\\')
                              .replace(/'/g, "\\'")
                              .replace(/\n/g, '\\n') + "'"

const KEY_ORDER = [
  'requires', 'note', 'setQuest', 'completeQuest', 'hold', 'first',
  'exit', 'silent', 'easca', 'eascaMatch', 'continue', 'ga', 'en',
  'say', 'sayEn',
  'replyGa', 'replyEn',
  'exchange', 'again',
]

function emitObj(obj, indent) {
  const pad = ' '.repeat(indent)
  const out = []
  for (const k of KEY_ORDER) {
    if (obj[k] === undefined) continue
    const v = obj[k]
    if (k === 'requires') {
      out.push(`${pad}requires: { ` +
        Object.entries(v).map(([a, b]) => `${a}: ${q(b)}`).join(', ') + ' },')
    } else if (k === 'exchange') {
      out.push(`${pad}exchange: [`)
      for (const tn of v) {
        out.push(`${pad}  {`)
        out.push(...emitObj(tn, indent + 4))
        out.push(`${pad}  },`)
      }
      out.push(`${pad}],`)
    } else if (k === 'again') {
      const bits = []
      if (v.ga) bits.push(`ga: ${q(v.ga)}`)
      if (v.en) bits.push(`en: ${q(v.en)}`)
      out.push(`${pad}again: { ${bits.join(', ')} },`)
    } else if (typeof v === 'boolean') {
      out.push(`${pad}${k}: ${v},`)
    } else {
      out.push(`${pad}${k}: ${q(v)},`)
    }
  }
  return out
}

const body = []
for (const n of nodes) {
  body.push('')
  body.push(`        // ── ${n.__name} ` + '─'.repeat(Math.max(0, 54 - n.__name.length)))
  body.push('        {')
  body.push(...emitObj(n, 10))
  if (n.options.length) {
    body.push('          options: [')
    for (const o of n.options) {
      body.push('            {')
      body.push(...emitObj(o, 14))
      body.push('            },')
    }
    body.push('          ],')
  }
  body.push('        },')
}
body.push('')

// ------------------------------------------------------------- writing

// header.file can be a bare name ("d3Sea", writes to public/data/bog/) or
// carry a subdirectory ("village/villageHall", writes to
// public/data/village/). Bare names default to bog/ for backward
// compatibility -- every existing draft has always meant "the bog folder"
// without saying so, and this keeps them compiling to the exact same
// place with zero changes needed.
const fileSlash = header.file.lastIndexOf('/')
const fileDir   = fileSlash >= 0 ? header.file.slice(0, fileSlash)     : 'bog'
const fileName  = fileSlash >= 0 ? header.file.slice(fileSlash + 1)   : header.file
const target = path.join(ROOT, 'public', 'data', fileDir, fileName + '.js')
if (!fs.existsSync(target)) {
  console.error('No such data file: ' + path.relative(ROOT, target))
  process.exit(1)
}

const tlines = fs.readFileSync(target, 'utf8').split('\n')
const open = tlines.findIndex(l => l.trim() === 'dialogues: [')
if (open < 0) {
  console.error('No "dialogues: [" found in ' + header.file + '.js')
  process.exit(1)
}
// The close is the last '      ],' followed by a line closing the speaker.
let close = -1
for (let i = tlines.length - 1; i > open; i--) {
  if (tlines[i].trim() === '],' && tlines[i + 1] && tlines[i + 1].trim() === '},') {
    close = i; break
  }
}
if (close < 0) {
  console.error('Could not find the end of the dialogues array in ' + header.file + '.js')
  process.exit(1)
}

const merged = [
  ...tlines.slice(0, open + 1),
  ...body,
  ...tlines.slice(close),
].join('\n')

const opts = nodes.reduce((a, n) => a + n.options.length, 0)
const irish = nodes.filter(n => n.ga).length

if (CHECK) {
  console.log(`OK — ${nodes.length} nodes, ${opts} options, ` +
              `${irish}/${nodes.length} nodes have Irish. Nothing written.`)
} else {
  fs.writeFileSync(target, merged)
  console.log(`Wrote ${path.relative(ROOT, target)} — ` +
              `${nodes.length} nodes, ${opts} options, ` +
              `${irish}/${nodes.length} nodes have Irish.`)
  console.log('The .dlg is the source. Do not edit the array in the .js.')
}

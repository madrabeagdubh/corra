#!/usr/bin/env node
//
// tools/dialogue/course.mjs
//
// Compiles a COURSE draft (lessons and slots, not an NPC's dialogue nodes)
// into a generated module of lines the course logic reads.
//
//   node tools/dialogue/course.mjs tools/dialogue/drafts/faicheCourse.dlg
//   node tools/dialogue/course.mjs tools/dialogue/drafts/faicheCourse.dlg --check   (no write)
//
// The format is described at the top of drafts/faicheCourse.dlg. In short:
//   @out PATH     where the module goes (once)
//   == lesson     = slot     plain lines (Conall, or the narrator in *Hint slots)
//   * button  > player  < reply  % irish  @value v  @goto slot  # comment
//
// Output shape (courseLines.js):
//   LINES[lesson][slot] = [{ en, ga }, ...]                    a slot without buttons
//                       = { say: [...], ask: [option, ...] }   a slot with buttons
//   option = { en, ga, value, speak?: { en, ga }, next?: <node> }
// A missing % (or one left blank) makes ga = en: a placeholder, which the game
// neither shows as Irish nor voices.

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

let ROOT = process.cwd()
if (!fs.existsSync(path.join(ROOT, 'package.json'))) {
  let d = path.dirname(url.fileURLToPath(import.meta.url))
  while (d !== path.dirname(d) && !fs.existsSync(path.join(d, 'package.json'))) d = path.dirname(d)
  ROOT = d
}

const args = process.argv.slice(2)
const CHECK = args.includes('--check')
const SRC = args.find(a => !a.startsWith('--'))
if (!SRC) { console.error('usage: node tools/dialogue/course.mjs <draft.dlg> [--check]'); process.exit(1) }

const src = fs.readFileSync(SRC, 'utf8').split(/\r?\n/)
const errors = []
const err = (n, msg) => errors.push(`${SRC}:${n}: ${msg}`)

let out = null
const lessons = {}
let lesson = null, slot = null, opt = null
let last = null            // the line a % would translate: { obj } with en/ga

const line = en => ({ en, ga: en })
const warnings = []
const warn = (n, msg) => warnings.push(`${SRC}:${n}: ${msg}`)
const untranslated = []          // [lineNo, text]: English lines with no % under them
let pendingEn = null

src.forEach((raw, i) => {
  const n = i + 1
  const s = raw.trim()
  if (!s || s.startsWith('#')) return

  if (s.startsWith('%')) {
    pendingEn = null
    if (!last) return err(n, '% with no line above it to translate')
    const ga = s.slice(1).trim()
    if (ga) last.ga = ga
    last = null
    return
  }
  last = null
  if (pendingEn) untranslated.push(pendingEn)
  pendingEn = null
  if (s.includes('\\')) warn(n, 'a backslash -- shown on screen as it is (no escaping is needed here)')

  if (s.startsWith('@out ')) { out = s.slice(5).trim(); return }
  if (s.startsWith('== ')) {
    const name = s.slice(3).trim()
    if (lessons[name]) err(n, `lesson "${name}" appears twice`)
    lesson = lessons[name] = {}; slot = null; opt = null
    return
  }
  if (s.startsWith('= ')) {
    if (!lesson) return err(n, 'a slot (=) before any lesson (==)')
    const name = s.slice(2).trim()
    if (lesson[name]) err(n, `slot "${name}" appears twice in this lesson`)
    slot = lesson[name] = { say: [], ask: [] }; opt = null
    return
  }
  if (!slot) return err(n, 'text before any slot (=)')

  if (s.startsWith('* ')) {
    opt = { ...line(s.slice(2).trim()), value: 'on', _speak: [], _reply: [], _goto: null, _n: n }
    slot.ask.push(opt); last = opt; pendingEn = [n, s]
    return
  }
  if (s.startsWith('> ') || s.startsWith('< ')) {
    if (!opt) return err(n, `${s[0]} outside a button (*)`)
    const l = line(s.slice(2).trim())
    ;(s[0] === '>' ? opt._speak : opt._reply).push(l); last = l; pendingEn = [n, s]
    return
  }
  if (s.startsWith('@value ')) { if (!opt) return err(n, '@value outside a button'); opt.value = s.slice(7).trim(); return }
  if (s.startsWith('@goto ')) { if (!opt) return err(n, '@goto outside a button'); opt._goto = s.slice(6).trim(); return }
  if (s.startsWith('@')) return err(n, `unknown directive: ${s.split(/\s/)[0]}`)

  if (opt) return err(n, 'a plain line after a button: put Conall\'s reply on a < line, or start a new slot')
  const l = line(s)
  slot.say.push(l); last = l; pendingEn = [n, s]
})
if (pendingEn) untranslated.push(pendingEn)

// a draft that has Irish elsewhere: an English line with none is probably a slip (a comment missing its #?)
const translated = src.filter(l => l.trim().startsWith('%') && l.trim().length > 1).length
if (translated) for (const [n, t] of untranslated) warn(n, `no % line under "${t.slice(0, 50)}" -- a comment missing its # ?`)
for (const [ln, slots] of Object.entries(lessons))
  for (const [sn, sl] of Object.entries(slots)) if (!sl.say.length && !sl.ask.length) warnings.push(`${SRC}: ${ln}.${sn} is empty (it will not be said)`)

if (!out) errors.push(`${SRC}: no @out line`)

// build: plain slots become lists; slots with buttons become nodes, @goto resolved by copying the target
const join = ls => ({ en: ls.map(l => l.en).join('\n'), ga: ls.map(l => l.ga).join('\n') })
function node(lessonName, slotName, depth = 0) {
  const sl = lessons[lessonName][slotName]
  if (!sl.ask.length) return sl.say
  if (depth > 6) { errors.push(`${lessonName}.${slotName}: @goto loops`); return { say: sl.say } }
  return {
    say: sl.say,
    ask: sl.ask.map(o => {
      const r = { en: o.en, ga: o.ga, value: o.value }
      if (o._speak.length) r.speak = join(o._speak)
      if (o._goto) {
        const [ln, sn] = o._goto.includes('.') ? o._goto.split('.') : [lessonName, o._goto]
        if (!lessons[ln]?.[sn]) errors.push(`${SRC}:${o._n}: @goto ${o._goto}: no such slot`)
        else r.next = (() => { const t = node(ln, sn, depth + 1); return Array.isArray(t) ? { say: t } : t })()
        if (o._reply.length) errors.push(`${SRC}:${o._n}: a button has both < replies and @goto: pick one`)
      } else if (o._reply.length) r.next = { say: o._reply }
      return r
    }),
  }
}
const LINES = {}
for (const [ln, slots] of Object.entries(lessons)) {
  LINES[ln] = {}
  for (const sn of Object.keys(slots)) LINES[ln][sn] = node(ln, sn)
}

warnings.forEach(w => console.warn('warning: ' + w))
if (errors.length) { errors.forEach(e => console.error(e)); process.exit(1) }

const count = Object.values(LINES).reduce((a, l) => a + Object.keys(l).length, 0)
if (CHECK) { console.log(`ok: ${Object.keys(LINES).length} lessons, ${count} slots`); process.exit(0) }

const rel = path.relative(ROOT, path.resolve(SRC))
const body = `// ${path.basename(out)}
// GENERATED from ${rel} by tools/dialogue/course.mjs -- do not edit.
// Edit the draft and recompile:
//   node tools/dialogue/course.mjs ${rel}

export const LINES = ${JSON.stringify(LINES, null, 2)}
`
fs.writeFileSync(path.join(ROOT, out), body)
console.log(`wrote ${out}: ${Object.keys(LINES).length} lessons, ${count} slots`)

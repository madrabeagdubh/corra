// public/data/*.js is the source of truth. The game imports ../data/*.js, so each file that
// exists in both places is copied public -> data whenever it differs. Run by vite (dev and build)
// and by `npm run sync-data`. Files that exist only in public/data are left alone.
const fs = require('fs'), path = require('path')

function syncData(root = process.cwd(), log = console.log) {
  const src = path.join(root, 'public', 'data'), dst = path.join(root, 'data')
  if (!fs.existsSync(src) || !fs.existsSync(dst)) return []
  const changed = []
  for (const f of fs.readdirSync(src)) {
    if (!f.endsWith('.js')) continue
    const a = path.join(src, f), b = path.join(dst, f)
    if (!fs.existsSync(b)) continue
    if (fs.readFileSync(a).equals(fs.readFileSync(b))) continue
    fs.copyFileSync(a, b); changed.push(f)
  }
  if (changed.length) log('[syncData] public/data -> data: ' + changed.join(', '))
  return changed
}

module.exports = syncData
if (require.main === module) syncData()

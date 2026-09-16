/**
 * Regression test for declaredColumns() in functions/api/guest-conversions.ts.
 *
 * That function decides which columns the guest->account transfer will rewrite.
 * When it was a regex over the DDL text it matched SQL comments and foreign-key
 * clauses, generating UPDATEs against columns that do not exist; db.batch() threw
 * and every conversion answered 500, so the workspace ownership transfer at the
 * end never ran. pragma_table_info is the natural source but D1's Workers binding
 * refuses it (`not authorized: SQLITE_AUTH`) even though `wrangler d1 execute`
 * allows it -- so the function parses the DDL, and this checks that parse against
 * SQLite's own answer for every table in the real schema.
 *
 * Usage:
 *   node scripts/verify-declared-columns.mjs <sqlite_master dump.json>
 *
 * Produce the dump with:
 *   wrangler d1 execute researchtoolspy-prod --remote --json \
 *     --command "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL" > dump.json
 */
import fs from 'node:fs'
import * as esbuild from 'esbuild'
import { DatabaseSync } from 'node:sqlite'

const dumpPath = process.argv[2]
if (!dumpPath) {
  console.error('usage: node scripts/verify-declared-columns.mjs <dump.json>')
  process.exit(2)
}

// Transpile the REAL function text out of the source file, so this tests the
// shipped implementation rather than a copy that can drift from it.
const src = fs.readFileSync('functions/api/guest-conversions.ts', 'utf8')
const start = src.indexOf('function declaredColumns')
const end = src.indexOf('async function transferGuestData')
if (start === -1 || end <= start) {
  console.error('could not locate declaredColumns() in guest-conversions.ts')
  process.exit(2)
}
const js = (await esbuild.transform(src.slice(start, end), { loader: 'ts' })).code
const declaredColumns = new Function(`${js}; return declaredColumns`)()

const parsed = JSON.parse(fs.readFileSync(dumpPath, 'utf8'))
const rows = Array.isArray(parsed) && parsed[0]?.results ? parsed[0].results : parsed

const db = new DatabaseSync(':memory:')
const order = { table: 0, view: 1, index: 2, trigger: 3 }
for (const r of [...rows].sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9))) {
  if (r.name.startsWith('sqlite_')) continue
  try { db.exec(r.sql) } catch { /* views/triggers over dropped tables */ }
}

let checked = 0
let mismatched = 0
for (const r of rows) {
  if (r.type !== 'table' || r.name.startsWith('sqlite_')) continue
  const truth = new Set(db.prepare('SELECT name FROM pragma_table_info(?)').all(r.name).map((x) => x.name))
  if (truth.size === 0) continue
  const got = declaredColumns(r.sql)
  checked += 1
  const missed = [...truth].filter((c) => !got.has(c))
  const invented = [...got].filter((c) => !truth.has(c))
  if (missed.length || invented.length) {
    mismatched += 1
    console.log(`MISMATCH ${r.name}`)
    if (missed.length) console.log(`   missed:   ${missed.join(', ')}`)
    if (invented.length) console.log(`   invented: ${invented.join(', ')}`)
  }
}

console.log(`\n${checked} tables compared against SQLite's own column list, ${mismatched} mismatched`)
process.exit(mismatched ? 1 : 0)

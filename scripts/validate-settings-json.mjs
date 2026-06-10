// Deterministic backstop: .claude/settings.json must parse and keep hook arrays sane.
import { readFileSync } from 'node:fs'
const raw = readFileSync('.claude/settings.json', 'utf8')
const cfg = JSON.parse(raw)
const hooks = cfg.hooks ?? {}
const counts = Object.fromEntries(Object.entries(hooks).map(([k, v]) => [k, Array.isArray(v) ? v.length : 'NOT-ARRAY']))
const flat = JSON.stringify(hooks)
const required = ['auto-baseline.sh', 'ledger-producer.sh', 'mutating-action-hook.sh', 'post-edit.sh', 'sign-work.sh']
const missing = required.filter(s => !flat.includes(s))
console.log('settings.json: VALID JSON')
console.log('hook event arrays:', JSON.stringify(counts))
if (missing.length) {
  console.error('MISSING expected hook refs:', missing.join(', '))
  process.exit(1)
}
console.log('expected hook refs present:', required.join(', '))

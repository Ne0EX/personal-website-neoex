/**
 * scripts/_delete-heic-orphans.mjs
 * One-shot cleanup: delete the two orphan HEIC originals left by the failed
 * IMG_5435.HEIC upload. Run once from project root with:
 *   node scripts/_delete-heic-orphans.mjs
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from .env.local.
 * Owner: Altair (α-BND-02) · heic-reject slice
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── load .env.local ──
const dir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(dir, '..', '.env.local')
const envLines = readFileSync(envPath, 'utf8').split('\n')
const env = {}
for (const line of envLines) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eq = trimmed.indexOf('=')
  if (eq === -1) continue
  env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1)
}

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL']
const SECRET_KEY   = env['SUPABASE_SECRET_KEY']

if (!SUPABASE_URL || !SECRET_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local')
  process.exit(1)
}

const BUCKET = 'originals'
const ORPHAN_KEYS = [
  'quick-uploads/IMG_5435-1781396098508.heic',
  'quick-uploads/IMG_5435-1781396120969.heic',
]

// Supabase Storage v1 batch delete endpoint:
//   DELETE /storage/v1/object/{bucket}  with body { prefixes: [...keys] }
const endpoint = `${SUPABASE_URL}/storage/v1/object/${BUCKET}`

console.log('[altair] deleting orphan HEIC originals from originals bucket...')
console.log('[altair] keys:', ORPHAN_KEYS)

const res = await fetch(endpoint, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${SECRET_KEY}`,
    'apikey': SECRET_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ prefixes: ORPHAN_KEYS }),
})

const text = await res.text()
console.log(`[altair] storage DELETE → status ${res.status}`)
console.log('[altair] response:', text)

if (!res.ok) {
  console.error('[altair] FAILED — non-2xx response')
  process.exit(1)
}

console.log('[altair] orphan cleanup complete.')

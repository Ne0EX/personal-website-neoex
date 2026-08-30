import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import {
  buildCorpusSnapshot,
  unavailableCorpusSnapshot,
  type CorpusSnapshotRow,
} from '../lib/netra/corpus-snapshot-builder'

const out = (name: string) => new URL(`../lib/netra/${name}`, import.meta.url)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
async function main() {
  let snapshot = unavailableCorpusSnapshot()
  if (url && key) {
    const client = createClient(url, key, { auth: { persistSession: false } })
    const { data, error } = await client.from('entries').select('slug,kind,title,lang,summary').order('iso_date', { ascending: false }).limit(30)
    if (error) throw new Error(`corpus snapshot query failed: ${error.message}`)
    snapshot = buildCorpusSnapshot((data ?? []) as CorpusSnapshotRow[])
  } else console.warn('[NETRA] Supabase env unavailable; writing an explicit unavailable corpus snapshot.')
  writeFileSync(out('corpus-snapshot.json'), `${JSON.stringify(snapshot)}\n`)

  const soulPath = new URL('../content/soul.md', import.meta.url)
  const soul = existsSync(soulPath) ? { version: 1, present: true, content: readFileSync(soulPath, 'utf8') } : { version: 1, present: false, content: '' }
  if (!soul.present) console.warn('[NETRA] content/soul.md absent; owner context remains closed.')
  writeFileSync(out('soul-snapshot.json'), `${JSON.stringify(soul)}\n`)
}
main().catch((error) => { console.error('[NETRA] snapshot generation failed:', error instanceof Error ? error.message : error); process.exitCode = 1 })

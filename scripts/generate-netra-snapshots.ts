import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const out = (name: string) => new URL(`../lib/netra/${name}`, import.meta.url)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
type SnapshotRow = { slug: string; kind: string; title: string | null; lang: string; summary: string | null }
const empty: { version: number; generatedAt: string; counts: { entries: number; photos: number; fiction: number }; entries: SnapshotRow[] } = { version: 1, generatedAt: new Date().toISOString(), counts: { entries: 0, photos: 0, fiction: 0 }, entries: [] }

async function main() {
  let snapshot = empty
  if (url && key) {
    const client = createClient(url, key, { auth: { persistSession: false } })
    const { data } = await client.from('entries').select('slug,kind,title,lang,summary').order('iso_date', { ascending: false }).limit(30)
    const rows = (data ?? []) as SnapshotRow[]
    snapshot = { version: 1, generatedAt: new Date().toISOString(), counts: { entries: rows.length, photos: rows.filter((r) => r.kind === 'photo').length, fiction: rows.filter((r) => r.kind === 'fiction').length }, entries: rows }
  } else console.warn('[NETRA] Supabase env unavailable; writing an empty corpus snapshot.')
  writeFileSync(out('corpus-snapshot.json'), `${JSON.stringify(snapshot)}\n`)

  const soulPath = new URL('../content/soul.md', import.meta.url)
  const soul = existsSync(soulPath) ? { version: 1, present: true, content: readFileSync(soulPath, 'utf8') } : { version: 1, present: false, content: '' }
  if (!soul.present) console.warn('[NETRA] content/soul.md absent; owner context remains closed.')
  writeFileSync(out('soul-snapshot.json'), `${JSON.stringify(soul)}\n`)
}
main().catch((error) => { console.error('[NETRA] snapshot generation failed:', error instanceof Error ? error.message : error); process.exitCode = 1 })

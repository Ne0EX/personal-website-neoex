#!/usr/bin/env tsx
/**
 * scripts/sweep-storage-orphans.ts
 * ---------------------------------------------------------------------------
 * Local admin script — reconciles both storage buckets against photo_assets.
 *
 * Two classes of orphans this script removes:
 *
 *   1. originals/**  with no photo_assets row
 *      Root cause: browser uploaded the original BEFORE the ingestPhoto action
 *      ran; the action failed or the tab closed. The original was uploaded but
 *      no DB row was created. Storage waste, not a public leak (originals bucket
 *      is private). Orphan is detected by: original_key NOT IN photo_assets.
 *
 *   2. photos/**  variants whose entry is gone (or photo_assets row is missing)
 *      Root cause: deleteEntry's storage-remove step failed mid-flight, leaving
 *      variants in the public bucket after the DB row was deleted. The CDN will
 *      serve these via capability URL until they're swept.
 *
 * Idempotent: re-running produces the same result; no orphan is removed twice.
 * Dry-run mode: --dry-run flag prints the keys that WOULD be removed without
 * actually deleting anything.
 *
 * Requires: SUPABASE_SECRET_KEY in environment (or .env.local).
 * Usage:
 *   npx tsx scripts/sweep-storage-orphans.ts [--dry-run]
 *
 * Owner: Altair (α-BND-02) · store-as-source S5
 */

import { createClient } from '@supabase/supabase-js'
import path from 'node:path'
import { readFileSync } from 'node:fs'

// ---------------------------------------------------------------------------
// Load env
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  try {
    const raw = readFileSync(envPath, 'utf8')
    for (const line of raw.split('\n')) {
      const stripped = line.trim()
      if (!stripped || stripped.startsWith('#')) continue
      const eq = stripped.indexOf('=')
      if (eq === -1) continue
      const key = stripped.slice(0, eq).trim()
      const value = stripped.slice(eq + 1).trim()
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // .env.local not found — rely on actual environment variables
  }
}

loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SECRET_KEY   = process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SECRET_KEY) {
  console.error('[sweep-storage-orphans] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set')
  process.exit(1)
}

// Use secret key to bypass RLS for orphan detection (scripts-only — spec §5.4)
const supabase = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false },
})

const DRY_RUN = process.argv.includes('--dry-run')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** List all objects in a bucket under a prefix, recursively. */
async function listAllObjects(bucket: string, prefix: string = ''): Promise<string[]> {
  const keys: string[] = []

  // Supabase storage list is page-limited; paginate with offset
  let offset = 0
  const limit = 100

  while (true) {
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .list(prefix, { limit, offset })

    if (error) {
      console.error(`[sweep] list error (bucket=${bucket}, prefix=${prefix}): ${error.message}`)
      break
    }

    if (!data || data.length === 0) break

    for (const obj of data) {
      if (obj.id === null) {
        // Folder node — recurse
        const subPrefix = prefix ? `${prefix}/${obj.name}` : obj.name
        const subKeys = await listAllObjects(bucket, subPrefix)
        keys.push(...subKeys)
      } else {
        // File node
        const key = prefix ? `${prefix}/${obj.name}` : obj.name
        keys.push(key)
      }
    }

    if (data.length < limit) break
    offset += limit
  }

  return keys
}

// ---------------------------------------------------------------------------
// Sweep 1: originals with no photo_assets row
// ---------------------------------------------------------------------------

async function sweepOrphanOriginals(): Promise<number> {
  console.log('\n[sweep] ── Sweep 1: originals with no photo_assets row ──')

  // List all objects in originals bucket
  const allOriginals = await listAllObjects('originals')
  console.log(`  total originals objects: ${allOriginals.length}`)

  if (allOriginals.length === 0) {
    console.log('  nothing to sweep')
    return 0
  }

  // Fetch all known original_keys from photo_assets
  const { data: assetRows, error: assetError } = await supabase
    .from('photo_assets')
    .select('original_key')

  if (assetError) {
    console.error(`  error fetching photo_assets: ${assetError.message}`)
    return 0
  }

  const knownKeys = new Set(
    (assetRows ?? [])
      .map((r: { original_key: string | null }) => r.original_key)
      .filter(Boolean) as string[],
  )

  const orphanKeys = allOriginals.filter((k) => !knownKeys.has(k))
  console.log(`  orphans found: ${orphanKeys.length}`)

  if (orphanKeys.length === 0) {
    console.log('  nothing to sweep')
    return 0
  }

  for (const k of orphanKeys) {
    console.log(`  ${DRY_RUN ? '[DRY RUN] would remove' : 'removing'}: originals/${k}`)
  }

  if (!DRY_RUN) {
    const { error: removeError } = await supabase
      .storage
      .from('originals')
      .remove(orphanKeys)

    if (removeError) {
      console.error(`  remove error: ${removeError.message}`)
    } else {
      console.log(`  removed ${orphanKeys.length} orphan original(s)`)
    }
  }

  return orphanKeys.length
}

// ---------------------------------------------------------------------------
// Sweep 2: photos variants whose entry is gone
// ---------------------------------------------------------------------------

async function sweepOrphanVariants(): Promise<number> {
  console.log('\n[sweep] ── Sweep 2: photos variants with no matching entry ──')

  const allVariants = await listAllObjects('photos')
  console.log(`  total photos objects: ${allVariants.length}`)

  if (allVariants.length === 0) {
    console.log('  nothing to sweep')
    return 0
  }

  // Fetch all variant key sets from photo_assets
  const { data: assetRows, error: assetError } = await supabase
    .from('photo_assets')
    .select('variants')

  if (assetError) {
    console.error(`  error fetching photo_assets variants: ${assetError.message}`)
    return 0
  }

  // Build the set of all known variant keys
  const knownVariantKeys = new Set<string>()
  for (const row of (assetRows ?? []) as Array<{ variants: Record<string, Record<string, string>> | null }>) {
    if (!row.variants) continue
    for (const sizeVariants of Object.values(row.variants)) {
      if (!sizeVariants) continue
      for (const key of Object.values(sizeVariants)) {
        if (typeof key === 'string') knownVariantKeys.add(key)
      }
    }
  }

  const orphanKeys = allVariants.filter((k) => !knownVariantKeys.has(k))
  console.log(`  orphans found: ${orphanKeys.length}`)

  if (orphanKeys.length === 0) {
    console.log('  nothing to sweep')
    return 0
  }

  for (const k of orphanKeys) {
    console.log(`  ${DRY_RUN ? '[DRY RUN] would remove' : 'removing'}: photos/${k}`)
  }

  if (!DRY_RUN) {
    const { error: removeError } = await supabase
      .storage
      .from('photos')
      .remove(orphanKeys)

    if (removeError) {
      console.error(`  remove error: ${removeError.message}`)
    } else {
      console.log(`  removed ${orphanKeys.length} orphan variant(s)`)
    }
  }

  return orphanKeys.length
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nsweep-storage-orphans${DRY_RUN ? ' [DRY RUN]' : ''} · ${new Date().toISOString()}`)
  console.log(`project: ${SUPABASE_URL}`)

  const orphanedOriginals = await sweepOrphanOriginals()
  const orphanedVariants  = await sweepOrphanVariants()

  console.log('\n[sweep] ── Summary ──')
  console.log(`  orphaned originals ${DRY_RUN ? 'found' : 'removed'}: ${orphanedOriginals}`)
  console.log(`  orphaned variants  ${DRY_RUN ? 'found' : 'removed'}: ${orphanedVariants}`)
  console.log(`  total: ${orphanedOriginals + orphanedVariants}`)
  console.log(`  status: ${DRY_RUN ? 'DRY RUN — no changes made' : 'done'}\n`)
}

main().catch((e) => {
  console.error('fatal:', e)
  process.exit(1)
})

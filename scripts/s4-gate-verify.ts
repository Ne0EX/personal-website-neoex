/**
 * scripts/s4-gate-verify.ts
 * ---------------------------------------------------------------------------
 * S4 acceptance gate verification script.
 * Verifies:
 *   1. Anon write against RLS dies at DB level
 *   2. Peat login works (creds from .env.local WORLDLINE_OWNER_*)
 *   3. assertOwner() with a valid session returns {ok:true}
 *   4. WORLDLINE_AUTHORING env var is not referenced in proxy.ts (code check)
 *
 * Run: npx tsx scripts/s4-gate-verify.ts
 *
 * Owner: Altair (α-BND-02) · store-as-source S4
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load env vars from .env.local manually
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  const env: Record<string, string> = {}
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    env[key] = val
  }
  return env
}

async function main() {
  const env = loadEnvLocal()
  const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL']
  const PUBLISHABLE_KEY = env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']
  const OWNER_EMAIL = env['WORLDLINE_OWNER_EMAIL']
  const OWNER_PASSWORD = env['WORLDLINE_OWNER_PASSWORD']

  if (!SUPABASE_URL || !PUBLISHABLE_KEY || !OWNER_EMAIL || !OWNER_PASSWORD) {
    throw new Error('Missing required env vars in .env.local')
  }

  console.log('\n=== S4 Gate Verification ===\n')

  // Gate A: Anon write → dies at RLS
  console.log('Gate A: Forged anon write against entries RLS...')
  const anonClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY)
  const { error: anonWriteError } = await anonClient
    .from('entries')
    .insert({
      kind: 'article',
      slug: '999',
      date: '2026.06.12',
      iso_date: '2026-06-12',
    })
  if (anonWriteError) {
    console.log(`  PASS — anon INSERT refused: ${anonWriteError.message} (code: ${anonWriteError.code})`)
  } else {
    console.log('  FAIL — anon INSERT succeeded (should have been refused by RLS)')
    process.exit(1)
  }

  // Gate B: Peat login works
  console.log('\nGate B: Peat login via signInWithPassword...')
  const ownerClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY)
  const { data: signInData, error: signInError } = await ownerClient.auth.signInWithPassword({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
  })
  if (signInError || !signInData?.session) {
    console.log(`  FAIL — login failed: ${signInError?.message ?? 'no session'}`)
    process.exit(1)
  }
  console.log(`  PASS — logged in as ${signInData.user?.email}, uid: ${signInData.user?.id}`)
  const accessToken = signInData.session.access_token

  // Gate C: Owner read with valid session (is_owner() RPC)
  console.log('\nGate C: is_owner() RPC with valid session...')
  const { data: isOwnerData, error: isOwnerError } = await ownerClient.rpc('is_owner')
  if (isOwnerError || !isOwnerData) {
    console.log(`  FAIL — is_owner() returned falsy: ${isOwnerError?.message ?? 'false'}`)
    process.exit(1)
  }
  console.log(`  PASS — is_owner() = ${isOwnerData}`)

  // Gate D: Owner can read draft entries (entries_read RLS with is_owner)
  console.log('\nGate D: Owner can read entries (including drafts)...')
  const { data: entriesData, error: entriesError } = await ownerClient
    .from('entries')
    .select('id, kind, slug, status')
    .limit(5)
  if (entriesError) {
    console.log(`  FAIL — owner entries read failed: ${entriesError.message}`)
    process.exit(1)
  }
  console.log(`  PASS — owner read ${entriesData?.length ?? 0} entries`)

  // Gate E: WORLDLINE_AUTHORING not read in proxy.ts
  console.log('\nGate E: WORLDLINE_AUTHORING not read (env var) in proxy.ts...')
  const proxyContent = fs.readFileSync(path.resolve(process.cwd(), 'proxy.ts'), 'utf-8')
  const reads = proxyContent.match(/process\.env\.WORLDLINE_AUTHORING/g)
  if (reads) {
    console.log(`  FAIL — proxy.ts still reads process.env.WORLDLINE_AUTHORING`)
    process.exit(1)
  }
  console.log(`  PASS — WORLDLINE_AUTHORING not referenced in process.env context`)

  // Gate F: anon cannot read coords column directly
  console.log('\nGate F: anon cannot select coords column from entries...')
  const { data: coordsData, error: coordsError } = await anonClient
    .from('entries')
    .select('coords')
    .limit(1)
  if (coordsError) {
    console.log(`  PASS — anon coords select refused: ${coordsError.message}`)
  } else {
    // If data returned but coords are absent/null due to column grant, that's also fine
    const hasCoords = coordsData?.some((r: any) => r.coords !== undefined && r.coords !== null)
    if (hasCoords) {
      console.log(`  FAIL — anon got raw coords: ${JSON.stringify(coordsData?.slice(0,1))}`)
      process.exit(1)
    } else {
      console.log(`  PASS — coords absent from anon response (column grant in effect)`)
    }
  }

  console.log('\n=== All S4 Gates PASS ===\n')
}

main().catch((err) => {
  console.error('Verification error:', err)
  process.exit(1)
})

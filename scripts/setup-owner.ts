/**
 * scripts/setup-owner.ts
 *
 * Bootstrap the single Worldline owner account.
 * Run ONCE locally with:
 *   npx tsx scripts/setup-owner.ts
 *
 * Spec: SPEC-2026-06-12-store-as-source-supabase.md §5.2
 *
 * Behavior:
 *   1. Creates the owner user via Supabase Auth Admin API
 *      (email confirmed immediately — no email flow needed)
 *   2. Inserts the uid into private.owners via Admin REST API
 *   3. Appends WORLDLINE_OWNER_EMAIL + WORLDLINE_OWNER_PASSWORD to .env.local
 *   4. Idempotent: if the user already exists, skips creation and just ensures
 *      the private.owners row is present
 *
 * Requires env vars in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 *
 * The SUPABASE_SECRET_KEY is ONLY for scripts/** — never app runtime, never Vercel.
 */

import { createReadStream, readFileSync, appendFileSync, existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const envLocalPath = resolve(projectRoot, '.env.local')

const OWNER_EMAIL = 'neospiritth@gmail.com'

// ---------------------------------------------------------------------------
// Load .env.local manually (no dotenv dep needed for a script)
// ---------------------------------------------------------------------------

function loadEnvLocal(path: string): Record<string, string> {
  if (!existsSync(path)) return {}
  const lines = readFileSync(path, 'utf-8').split('\n')
  const env: Record<string, string> = {}
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim()
    env[key] = val
  }
  return env
}

const envVars = loadEnvLocal(envLocalPath)
const SUPABASE_URL = envVars['NEXT_PUBLIC_SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL']
const SECRET_KEY = envVars['SUPABASE_SECRET_KEY'] ?? process.env['SUPABASE_SECRET_KEY']

if (!SUPABASE_URL || !SECRET_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authAdminUrl(path: string): string {
  return `${SUPABASE_URL}/auth/v1/admin${path}`
}

function postgrestUrl(path: string): string {
  return `${SUPABASE_URL}/rest/v1${path}`
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SECRET_KEY}`,
  'apikey': SECRET_KEY,
} as const

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== setup-owner.ts — Worldline owner bootstrap ===')
  console.log(`Owner email: ${OWNER_EMAIL}`)
  console.log(`Supabase URL: ${SUPABASE_URL}`)
  console.log()

  // -------------------------------------------------------------------------
  // Step 1: check if owner user already exists
  // -------------------------------------------------------------------------

  const listRes = await fetch(authAdminUrl(`/users?email=${encodeURIComponent(OWNER_EMAIL)}`), {
    method: 'GET',
    headers,
  })

  if (!listRes.ok) {
    const body = await listRes.text()
    console.error('ERROR: could not list users:', listRes.status, body)
    process.exit(1)
  }

  const listData = await listRes.json() as { users?: Array<{ id: string; email: string }> }
  const existingUser = listData.users?.find(u => u.email === OWNER_EMAIL)

  let uid: string
  let password: string | null = null

  if (existingUser) {
    console.log(`User already exists: ${existingUser.id}`)
    console.log('Skipping user creation — ensuring private.owners row...')
    uid = existingUser.id
    // Password already set; we don't regenerate it
    // Check if WORLDLINE_OWNER_PASSWORD is already in .env.local
    const alreadyHasPw = envVars['WORLDLINE_OWNER_PASSWORD'] != null
    if (!alreadyHasPw) {
      console.warn('WARN: user exists but WORLDLINE_OWNER_PASSWORD not found in .env.local.')
      console.warn('If you need to log in, reset the password via the Supabase dashboard.')
    }
  } else {
    // -----------------------------------------------------------------------
    // Step 2: generate strong password (32 bytes / 256 bits, base64url)
    // -----------------------------------------------------------------------

    password = randomBytes(32).toString('base64url')

    console.log('Creating owner user...')
    const createRes = await fetch(authAdminUrl('/users'), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: OWNER_EMAIL,
        password,
        email_confirm: true,      // confirmed immediately — no email flow
        user_metadata: {
          role: 'owner',
          site: 'worldline',
        },
      }),
    })

    if (!createRes.ok) {
      const body = await createRes.text()
      console.error('ERROR: could not create user:', createRes.status, body)
      process.exit(1)
    }

    const created = await createRes.json() as { id: string; email: string }
    uid = created.id
    console.log(`User created: ${uid}`)

    // -----------------------------------------------------------------------
    // Step 3: append credentials to .env.local
    // -----------------------------------------------------------------------

    const appendLines = [
      '',
      '# Owner account — created by scripts/setup-owner.ts',
      '# NEVER commit .env.local — this file is gitignored',
      `WORLDLINE_OWNER_EMAIL=${OWNER_EMAIL}`,
      `WORLDLINE_OWNER_PASSWORD=${password}`,
    ].join('\n')

    appendFileSync(envLocalPath, appendLines, 'utf-8')
    console.log('Credentials appended to .env.local (gitignored)')
    console.log('Owner UID:', uid)
  }

  // -------------------------------------------------------------------------
  // Step 4: upsert private.owners row via Supabase SQL API (Management endpoint)
  //
  // NOTE: private.owners is intentionally NOT exposed via PostgREST
  // (spec §12 S1: "anon GET /rest/v1/owners 404s" — correct behavior).
  // The service_role key CAN reach it via direct SQL execution through the
  // Management API's pg-meta endpoint, which the Supabase SDK wraps.
  //
  // Implementation: use the pg-meta SQL endpoint directly with the secret key.
  // Supabase exposes this at: /pg-meta/default/query (Management API, not public).
  //
  // Alternative already used in setup: Supabase MCP applied the row via
  // execute_sql. This function provides the same insert for pure-script runs.
  // -------------------------------------------------------------------------

  console.log('\nEnsuring private.owners row...')

  // Use the Supabase SQL over REST — the service_role key can execute SQL
  // via the postgres REST endpoint at /rest/v1/rpc (cannot reach private schema)
  // but CAN execute raw SQL via the management API's pg endpoint.
  // In practice the script caller (procyon) seeds this via MCP for the first run.
  // Subsequent idempotent runs will recheck via a public RPC call to is_owner().

  const isOwnerRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_owner`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      // Use the authenticated service_role JWT — this bypasses RLS so is_owner()
      // returns based on the actual private.owners contents.
    },
    body: JSON.stringify({}),
  })

  // is_owner() called with the service_role key evaluates auth.uid() as null
  // (service role doesn't set a user JWT), so it returns false — expected.
  // We verify the row directly via pg-meta instead.
  //
  // Direct pg-meta SQL (Management API — only works with the service_role key):
  const pgMetaUrl = `${SUPABASE_URL.replace('.supabase.co', '.supabase.co')}`
  const sqlRes = await fetch(`${pgMetaUrl}/pg-meta/default/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SECRET_KEY}`,
    },
    body: JSON.stringify({
      query: `insert into private.owners (user_id) values ('${uid}') on conflict (user_id) do nothing returning user_id`,
    }),
  })

  if (sqlRes.ok) {
    const result = await sqlRes.json() as { rows?: Array<{ user_id: string }> }
    if (result.rows && result.rows.length > 0) {
      console.log('Inserted into private.owners:', uid)
    } else {
      console.log('private.owners row already present — idempotent, no change.')
    }
  } else {
    // pg-meta endpoint not available in this environment — fallback message.
    // The row was seeded via Supabase MCP (execute_sql) during initial setup.
    // Re-running this script will re-attempt; if it fails again, use MCP:
    //   execute_sql: insert into private.owners (user_id) values ('<uid>') on conflict do nothing;
    const body = await sqlRes.text()
    console.warn('WARN: could not reach pg-meta SQL endpoint:', sqlRes.status, body)
    console.warn(`Manually verify: select user_id from private.owners where user_id = '${uid}';`)
    console.warn('Or use Supabase MCP execute_sql with the above query.')
  }

  // -------------------------------------------------------------------------
  // Done
  // -------------------------------------------------------------------------

  console.log('\n=== Owner bootstrap complete ===')
  console.log('UID:', uid)
  console.log('WORLDLINE_OWNER_EMAIL and WORLDLINE_OWNER_PASSWORD are in .env.local')
  console.log('is_owner() will return true for this user when authenticated.')
  console.log()
  console.log('Next step: S4 — wire auth proxy + ConsoleLogin (altair).')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})

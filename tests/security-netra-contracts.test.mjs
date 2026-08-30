/**
 * Deterministic regression tests for scripts/audit-security-netra-contracts.ts.
 *
 * The audit reads source only. These tests copy the active contract boundary to
 * an isolated temp directory, introduce one mutation at a time, and prove the
 * matching sensor fails. No application module is imported and no Supabase,
 * Redis, AI Gateway, or browser credential is required.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const auditScript = join(root, 'scripts/audit-security-netra-contracts.ts')
const contractFiles = [
  'lib/server/store/actions.ts',
  'lib/server/store/actions-core.ts',
  'lib/server/auth.ts',
  'lib/store/netra-reads.ts',
  'app/api/chat/route.ts',
  'lib/netra/gateway.ts',
  'lib/server/rate-limit.ts',
  'components/NetraNavigator.tsx',
  'components/NetraNavigator.css',
]

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'security-netra-contracts-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  for (const relativePath of contractFiles) {
    const destination = join(directory, relativePath)
    mkdirSync(dirname(destination), { recursive: true })
    copyFileSync(join(root, relativePath), destination)
  }
  return directory
}

function mutate(directory, relativePath, transform) {
  const path = join(directory, relativePath)
  const before = readFileSync(path, 'utf8')
  const after = transform(before)
  assert.notEqual(after, before, `mutation did not change ${relativePath}`)
  writeFileSync(path, after)
}

function runAudit(directory, scope = 'all') {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', auditScript, '--root', directory, '--scope', scope],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, CI: 'true' },
    },
  )
  assert.notEqual(result.status, 2, result.stderr || 'audit configuration failed')
  assert.equal(result.signal, null, `audit terminated by ${result.signal}`)
  assert.doesNotThrow(() => JSON.parse(result.stdout), result.stderr || result.stdout)
  return { status: result.status, output: JSON.parse(result.stdout) }
}

function assertViolation(result, id) {
  assert.equal(result.status, 1, `mutation should fail ${id}`)
  assert.equal(result.output.pass, false)
  assert.ok(
    result.output.violations.some((violation) => violation.id === id),
    `expected ${id}; got ${result.output.violations.map((violation) => violation.id).join(', ')}`,
  )
}

test('active console, store, route/helper, and NETRA UI contracts pass without live services', (t) => {
  const result = runAudit(fixture(t))
  assert.equal(result.status, 0)
  assert.equal(result.output.pass, true)
  assert.deepEqual(result.output.violations, [])
  assert.deepEqual(
    new Set(result.output.checks.map((check) => check.area)),
    new Set(['console', 'store', 'route', 'ui']),
  )
})

test('console sensor rejects validation before authorization', (t) => {
  const directory = fixture(t)
  mutate(directory, 'lib/server/store/actions-core.ts', (source) => source.replace(
    '  const auth = await assertOwner()\n  if (!auth.ok) return auth\n\n  const parsed = CreateEntryInputSchema.safeParse(rawInput)',
    '  const parsed = CreateEntryInputSchema.safeParse(rawInput)\n  const auth = await assertOwner()\n  if (!auth.ok) return auth',
  ))
  assertViolation(runAudit(directory, 'console'), 'CONSOLE_IMPL_ORDER_createEntryImpl')
})

test('store projection sensor rejects draft/private control columns', (t) => {
  const directory = fixture(t)
  mutate(directory, 'lib/store/netra-reads.ts', (source) => source.replace(
    "const RESULT_COLUMNS = 'slug,kind,title,lang,summary,body,roll,photo_id'",
    "const RESULT_COLUMNS = 'slug,kind,title,lang,summary,body,roll,photo_id,status'",
  ))
  assertViolation(runAudit(directory, 'store'), 'STORE_EXPLICIT_PUBLIC_PROJECTION')
})

test('store RLS sensor rejects a read that drops the request-client contract', (t) => {
  const directory = fixture(t)
  mutate(directory, 'lib/store/netra-reads.ts', (source) => source.replace(
    'export async function searchEntries(client: NetraClient',
    'export async function searchEntries(client: SupabaseClient',
  ))
  assertViolation(runAudit(directory, 'store'), 'STORE_RLS_REQUEST_CLIENT')
})

test('store search sensor rejects raw query text passed to PostgREST .or()', (t) => {
  const directory = fixture(t)
  mutate(directory, 'lib/store/netra-reads.ts', (source) => source.replace(
    '.or(filterExpression)',
    '.or(query)',
  ))
  assertViolation(runAudit(directory, 'store'), 'STORE_SEARCH_FILTER_INPUT')
})

test('route sensor rejects quota consumption before request validation', (t) => {
  const directory = fixture(t)
  mutate(directory, 'app/api/chat/route.ts', (source) => source.replace(
    'export async function POST(request: NextRequest): Promise<Response> {',
    "export async function POST(request: NextRequest): Promise<Response> {\n  await quota('00000000-0000-4000-8000-000000000000')",
  ))
  assertViolation(runAudit(directory, 'route'), 'NETRA_ROUTE_VALIDATE_BEFORE_QUOTA')
})

test('route sensor rejects quota consumption before public page resolution', (t) => {
  const directory = fixture(t)
  mutate(directory, 'app/api/chat/route.ts', (source) => source.replace(
    '  const page = resolveNetraPageContext(',
    "  await quota('00000000-0000-4000-8000-000000000000')\n  const page = resolveNetraPageContext(",
  ))
  assertViolation(runAudit(directory, 'route'), 'NETRA_ROUTE_PAGE_VALIDATE_BEFORE_QUOTA')
})

test('route sensor rejects bypassing the agent-core delegation seam', (t) => {
  const directory = fixture(t)
  mutate(directory, 'app/api/chat/route.ts', (source) => source.replace(
    'const result = await runNetraTurn(',
    'const result = await legacyRunNetraTurn(',
  ))
  assertViolation(runAudit(directory, 'route'), 'NETRA_ROUTE_CORE_DELEGATION')
})

test('route sensor rejects adding a paid model to the NETRA Gateway allowlist', (t) => {
  const directory = fixture(t)
  mutate(directory, 'lib/netra/gateway.ts', (source) => source.replace(
    "  'minimax/minimax-m2.7-free',",
    "  'openai/gpt-5.4',",
  ))
  assertViolation(runAudit(directory, 'route'), 'NETRA_ROUTE_GATEWAY_FREE_ONLY')
})

test('route sensor rejects Gateway attribution that diverges from the quota cookie', (t) => {
  const directory = fixture(t)
  mutate(directory, 'app/api/chat/route.ts', (source) => source.replace(
    'sessionId: quotaResult.sessionId,',
    'sessionId,',
  ))
  assertViolation(
    runAudit(directory, 'route'),
    'NETRA_ROUTE_GATEWAY_ATTRIBUTION',
  )
})

test('route helper sensor rejects unvalidated session-cookie identifiers', (t) => {
  const directory = fixture(t)
  mutate(directory, 'lib/server/rate-limit.ts', (source) => source.replace(
    'SESSION_ID_PATTERN.test(value)',
    'value.length > 0',
  ))
  assertViolation(runAudit(directory, 'route'), 'NETRA_ROUTE_SESSION_ID')
})

test('route logging sensor rejects provider exception messages', (t) => {
  const directory = fixture(t)
  mutate(directory, 'app/api/chat/route.ts', (source) => source.replace(
    'error instanceof Error ? error.name : typeof error',
    'error instanceof Error ? error.message : String(error)',
  ))
  assertViolation(runAudit(directory, 'route'), 'NETRA_ROUTE_FIXED_UPSTREAM_COPY')
})

test('NETRA trigger sensor rejects a missing aria-busy state', (t) => {
  const directory = fixture(t)
  mutate(directory, 'components/NetraNavigator.tsx', (source) => source.replace(
    '      aria-busy={busy}\n',
    '',
  ))
  assertViolation(runAudit(directory, 'ui'), 'NETRA_UI_TRIGGER_BUSY_ARIA')
})

test('NETRA icon trigger sensor rejects an accessible name without state', (t) => {
  const directory = fixture(t)
  mutate(directory, 'components/NetraNavigator.tsx', (source) => source.replace(
    " + ' · ' + stateLabel",
    '',
  ))
  assertViolation(runAudit(directory, 'ui'), 'NETRA_UI_TRIGGER_IDENTITY_STATE')
})

test('NETRA icon trigger sensor rejects a missing expanded relationship', (t) => {
  const directory = fixture(t)
  mutate(directory, 'components/NetraNavigator.tsx', (source) => source.replace(
    '      aria-expanded={open}\n',
    '',
  ))
  assertViolation(runAudit(directory, 'ui'), 'NETRA_UI_TRIGGER_IDENTITY_STATE')
})

test('NETRA transport sensor rejects non-2xx handling that skips response parsing', (t) => {
  const directory = fixture(t)
  mutate(directory, 'components/NetraNavigator.tsx', (source) => source.replace(
    'const body = await response.text()',
    "const body = ''",
  ))
  assertViolation(runAudit(directory, 'ui'), 'NETRA_UI_STRUCTURED_HTTP_ERRORS')
})

test('NETRA history sensor rejects removal of the local clear contract', (t) => {
  const directory = fixture(t)
  mutate(directory, 'components/NetraNavigator.tsx', (source) => source.replaceAll(
    'localStorage.removeItem',
    'localStorage.getItem',
  ))
  assertViolation(runAudit(directory, 'ui'), 'NETRA_UI_HISTORY')
})

test('NETRA transport sensor rejects title or other authority-bearing page context', (t) => {
  const directory = fixture(t)
  mutate(directory, 'components/NetraNavigator.tsx', (source) => source.replace(
    'page: { pathname }',
    'page: { pathname, title: document.title }',
  ))
  assertViolation(runAudit(directory, 'ui'), 'NETRA_UI_PATHNAME_ONLY_CONTEXT')
})

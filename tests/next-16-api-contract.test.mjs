import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const auditPath = join(repoRoot, 'scripts/audit-next-api.ts')

const guideEvidence = `
## Async Request APIs (Breaking change)
Starting with Next.js 16, synchronous access is fully removed. These APIs can only be accessed asynchronously: cookies, headers, draftMode, params, and searchParams.
## Partial Prerendering (PPR)
Next.js 16 removes the experimental Partial Prerendering flag and route level segment experimental_ppr.
## middleware to proxy
The middleware filename is deprecated, and has been renamed to proxy. The named export middleware is also deprecated.
## next/image changes
The next/legacy/image Component is deprecated.
## Removals
The next lint command has been removed. Runtime Configuration publicRuntimeConfig and serverRuntimeConfig have been removed. experimental.dynamicIO has been renamed to cacheComponents. unstable_rootParams has been removed.
`

function write(root, relativePath, content) {
  const destination = join(root, relativePath)
  mkdirSync(dirname(destination), { recursive: true })
  writeFileSync(destination, content, 'utf8')
}

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'next-16-contract-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))

  write(root, 'node_modules/next/package.json', JSON.stringify({ version: '16.3.3' }))
  write(root, 'node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md', guideEvidence)
  write(root, 'package.json', JSON.stringify({ scripts: { build: 'next build' } }))
  write(root, 'next.config.ts', "import type { NextConfig } from 'next'\nconst config: NextConfig = {}\nexport default config\n")
  write(root, 'app/page.tsx', "import { cookies } from 'next/headers'\nexport default async function Page() { const jar = await cookies(); return <main>{jar.size}</main> }\n")
  return root
}

function run(root) {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', auditPath, '--root', root],
    { cwd: repoRoot, encoding: 'utf8', timeout: 30_000 },
  )
  assert.equal(result.signal, null, `audit terminated by ${result.signal}`)
  const output = JSON.parse(result.stdout || '{}')
  return { status: result.status ?? -1, output, stderr: result.stderr }
}

function expectViolation(result, id) {
  assert.equal(result.status, 1, result.stderr || JSON.stringify(result.output))
  assert.equal(result.output.pass, false)
  assert.ok(
    result.output.violations.some((violation) => violation.id === id),
    `expected ${id}; got ${result.output.violations.map((violation) => violation.id).join(', ')}`,
  )
}

test('documented Next 16 patterns pass when request APIs are awaited', (t) => {
  const result = run(fixture(t))
  assert.equal(result.status, 0, result.stderr || JSON.stringify(result.output))
  assert.equal(result.output.pass, true)
  assert.equal(result.output.next_version, '16.3.3')
  assert.deepEqual(result.output.violations, [])
})

test('synchronous next/headers request API access fails closed', (t) => {
  const root = fixture(t)
  write(root, 'app/page.tsx', "import { cookies } from 'next/headers'\nexport default function Page() { const jar = cookies(); return <main>{String(jar)}</main> }\n")
  expectViolation(run(root), 'NEXT16_ASYNC_REQUEST_API')
})

test('App Router imports from next/router fail closed', (t) => {
  const root = fixture(t)
  write(root, 'components/LegacyNavigation.tsx', "'use client'\nimport { useRouter } from 'next/router'\nexport function LegacyNavigation() { return String(useRouter()) }\n")
  expectViolation(run(root), 'NEXT16_APP_ROUTER_IMPORT')
})

test('deprecated middleware convention fails closed', (t) => {
  const root = fixture(t)
  write(root, 'middleware.ts', 'export function middleware() {}\n')
  expectViolation(run(root), 'NEXT16_MIDDLEWARE_CONVENTION')
})

test('removed Next 16 configuration fails closed', (t) => {
  const root = fixture(t)
  write(root, 'next.config.ts', 'export default { experimental: { dynamicIO: true, ppr: true } }\n')
  expectViolation(run(root), 'NEXT16_REMOVED_CONFIG')
})

test('removed next lint command fails closed', (t) => {
  const root = fixture(t)
  write(root, 'package.json', JSON.stringify({ scripts: { lint: 'next lint' } }))
  expectViolation(run(root), 'NEXT16_REMOVED_NEXT_LINT')
})

test('the sensor refuses an ungrounded rule set when local Next docs drift', (t) => {
  const root = fixture(t)
  write(root, 'node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md', '# empty fixture\n')
  const result = run(root)
  assert.equal(result.status, 2, result.stderr || JSON.stringify(result.output))
  assert.equal(result.output.pass, false)
  assert.match(result.output.error, /documentation evidence/i)
})

test('a Next release below the patched security floor fails closed', (t) => {
  const root = fixture(t)
  write(root, 'node_modules/next/package.json', JSON.stringify({ version: '16.3.2' }))
  const result = run(root)
  assert.equal(result.status, 2, result.stderr || JSON.stringify(result.output))
  assert.equal(result.output.pass, false)
  assert.match(result.output.error, /security floor.*16\.3\.3/i)
})

test('the active repository satisfies the Next 16 contract', () => {
  const result = run(repoRoot)
  assert.equal(result.status, 0, result.stderr || JSON.stringify(result.output))
  assert.equal(result.output.pass, true)
})

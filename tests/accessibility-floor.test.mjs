import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const auditPath = join(repoRoot, 'scripts/audit-a11y.ts')
const passFixture = join(repoRoot, 'tests/harness/fixtures/a11y/pass.html')
const failFixture = join(repoRoot, 'tests/harness/fixtures/a11y/missing-button-name.html')

function runFixture(path) {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', auditPath, '--fixture', path],
    { cwd: repoRoot, encoding: 'utf8', timeout: 30_000 },
  )
  assert.equal(result.signal, null, `audit terminated by ${result.signal}`)
  return {
    status: result.status ?? -1,
    output: JSON.parse(result.stdout || '{}'),
    stderr: result.stderr,
  }
}

test('the accessibility denominator is finite, public, unique, and covers each shipped entry kind', () => {
  const manifest = JSON.parse(readFileSync(join(repoRoot, '.harness/a11y-routes.json'), 'utf8'))
  const paths = manifest.routes.map((route) => route.path)
  const kinds = new Set(manifest.routes.map((route) => route.kind))

  assert.equal(manifest.schema_version, 1)
  assert.equal(new Set(paths).size, paths.length, 'route denominator must not contain duplicates')
  assert.ok(paths.every((path) => path.startsWith('/') && !path.startsWith('/console') && !path.startsWith('/api')))
  for (const kind of ['home', 'archive', 'fiction', 'photos-index', 'photo-roll', 'photo-entry']) {
    assert.ok(kinds.has(kind), `missing deterministic accessibility route kind: ${kind}`)
  }
})
test('axe WCAG A/AA fixture passes through the production sensor engine', () => {
  const result = runFixture(passFixture)
  assert.equal(result.status, 0, result.stderr || JSON.stringify(result.output))
  assert.equal(result.output.pass, true)
  assert.equal(result.output.engine, 'axe-core')
  assert.deepEqual(result.output.violations, [])
})

test('known missing accessible button name is detected by mutation fixture', () => {
  const result = runFixture(failFixture)
  assert.equal(result.status, 1, result.stderr || JSON.stringify(result.output))
  assert.equal(result.output.pass, false)
  assert.ok(result.output.violations.some((violation) => violation.id === 'button-name'))
})

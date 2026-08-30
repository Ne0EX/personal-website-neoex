import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))

function read(relativePath) {
  return readFileSync(join(repoRoot, relativePath), 'utf8')
}

const config = JSON.parse(read('.harness/worldline-harness.config.json'))
const census = JSON.parse(read('tests/harness/ci-test-census.json'))
const axiomRegistry = JSON.parse(read('.harness/axioms-v1.json'))

test('production browser rails execute in CI with honest blocking policy', () => {
  const required = new Set(config.ci_policy.required_rails)

  for (const railId of [
    'prototype-runtime',
    'gauntlet-sub-pixel-detection',
    'render-fidelity-vs-intent',
  ]) {
    const rail = config.rails[railId]
    assert.ok(rail, `missing configured browser rail: ${railId}`)
    assert.equal(rail.ci.required, true, railId)
    assert.equal(rail.ci.disposition, 'run', railId)
    assert.equal(rail.ci.deterministic, true, railId)
    assert.equal(rail.ci.classification, 'required', railId)
    assert.ok(required.has(railId), `${railId} missing from required denominator`)
  }

  for (const railId of ['gauntlet-overlap-composition', 'gauntlet-min-legible-size']) {
    const rail = config.rails[railId]
    assert.equal(rail.ci.required, false, railId)
    assert.equal(rail.ci.disposition, 'run', railId)
    assert.equal(rail.ci.deterministic, true, railId)
    assert.equal(rail.ci.classification, 'advisory', railId)
    assert.match(rail.ci.reason, /baseline|advisory|debt/i, railId)
  }

  const visualFidelityAxiom = axiomRegistry.axioms.find((axiom) => axiom.id === 'V2')
  assert.ok(visualFidelityAxiom, 'missing visual-fidelity axiom V2')
  assert.ok(
    visualFidelityAxiom.projects_to.includes('render-fidelity-vs-intent'),
    'the live render-fidelity rail is an orphan instead of a V2 projection',
  )
})

test('browser wrappers own their deterministic server lifecycle', () => {
  const helperPath = 'scripts/lib/browser-fixture.sh'
  assert.ok(existsSync(join(repoRoot, helperPath)), 'missing shared browser fixture helper')

  const helper = read(helperPath)
  assert.match(helper, /browser_fixture_start_next/)
  assert.match(helper, /browser_fixture_start_static/)
  assert.match(helper, /browser_fixture_stop/)
  assert.match(helper, /browser_fixture_select_port/)
  assert.match(helper, /127\.0\.0\.1/)

  for (const wrapperPath of [
    'scripts/audit-gauntlet-overlap.sh',
    'scripts/audit-gauntlet-min-legible.sh',
    'scripts/audit-gauntlet-sub-pixel.sh',
    'scripts/audit-render-fidelity-vs-intent.sh',
  ]) {
    assert.match(read(wrapperPath), /browser-fixture\.sh/, wrapperPath)
  }
})

test('browser fixture never accepts an unrelated server on the requested port', async (t) => {
  const probe = createServer()
  await new Promise((resolvePromise, rejectPromise) => {
    probe.once('error', rejectPromise)
    probe.listen(0, '127.0.0.1', resolvePromise)
  })
  const address = probe.address()
  assert.ok(address && typeof address === 'object')
  const occupiedPort = address.port
  await new Promise((resolvePromise) => probe.close(resolvePromise))

  const decoy = spawn(
    'python3',
    ['-m', 'http.server', String(occupiedPort), '--bind', '127.0.0.1', '--directory', repoRoot],
    { stdio: 'ignore' },
  )
  t.after(() => decoy.kill('SIGTERM'))

  let ready = false
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${occupiedPort}/package.json`)
      if (response.ok) {
        ready = true
        break
      }
    } catch {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 50))
    }
  }
  assert.equal(ready, true, 'decoy server did not become ready')

  const command = `
set -euo pipefail
source "\${REPO_ROOT}/scripts/lib/browser-fixture.sh"
trap 'browser_fixture_stop' EXIT
browser_fixture_start_static "\${REPO_ROOT}" "\${REQUESTED_PORT}" "/package.json"
printf '%s\\n' "\${BROWSER_FIXTURE_BASE_URL}"
`
  const result = spawnSync('bash', ['-c', command], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 20_000,
    env: {
      ...process.env,
      REPO_ROOT: repoRoot,
      REQUESTED_PORT: String(occupiedPort),
    },
  })

  assert.equal(result.signal, null, result.stderr || result.stdout)
  assert.equal(result.status, 0, result.stderr || result.stdout)
  const fixturePort = Number(new URL(result.stdout.trim()).port)
  assert.notEqual(fixturePort, occupiedPort, 'fixture reused a port owned by another process')
})

test('browser audit cores use the direct Playwright dependency and portable stdin', () => {
  for (const scriptPath of [
    'scripts/audit-gauntlet-overlap.ts',
    'scripts/audit-gauntlet-min-legible.ts',
    'scripts/audit-gauntlet-sub-pixel.ts',
    'scripts/audit-render-fidelity-vs-intent.ts',
  ]) {
    const source = read(scriptPath)
    assert.doesNotMatch(source, /\/dev\/stdin/, scriptPath)
    assert.doesNotMatch(source, /playwright-core/, scriptPath)
    assert.match(source, /readFileSync\(0,\s*["']utf8["']\)/, scriptPath)
    assert.match(source, /import\(["']playwright["']\)/, scriptPath)
  }
})

test('tracked prototype includes every local font needed by runtime verification', () => {
  const prototypePath = '.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/index.html'
  const prototype = read(prototypePath)
  const fontRefs = [...prototype.matchAll(/(?:href|url)\(["']?\.\/fonts\/([^"')]+)/g)]
    .map((match) => match[1])

  assert.ok(fontRefs.length >= 6, 'prototype font denominator unexpectedly shrank')
  for (const font of new Set(fontRefs)) {
    assert.ok(
      existsSync(join(repoRoot, '.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/fonts', font)),
      `missing prototype runtime asset: ${font}`,
    )
  }
})

test('archive exposes the stable root selected by the live intent manifest', () => {
  const archivePage = read('app/[lang]/archive/page.tsx')
  const manifest = JSON.parse(read('.harness/render-fidelity-manifests/archive.json'))

  assert.match(archivePage, /data-page=["']archive["']/)
  assert.ok(
    manifest.elements.some((entry) => entry.selector.includes("[data-page='archive']")),
    'archive manifest must select the production root contract',
  )
})

test('browser mutation fixtures are required now that CI installs Chromium', () => {
  const requiredPaths = new Set(census.required.map((entry) => entry.path))
  const deferredPaths = new Set(census.deferred.map((entry) => entry.path))

  for (const fixture of [
    'tests/harness/audit-render-fidelity-vs-intent.fixture.sh',
    'tests/harness/gauntlet-strengthening.test.sh',
  ]) {
    assert.ok(requiredPaths.has(fixture), `${fixture} is not required`)
    assert.ok(!deferredPaths.has(fixture), `${fixture} still has a stale defer record`)
  }

  assert.deepEqual(
    [...deferredPaths],
    ['tests/harness/prototype-layer.sh'],
    'only the destructive legacy prototype fixture should remain deferred',
  )

  const workflow = read('.github/workflows/ci.yml')
  const browserInstall = workflow.indexOf('playwright install --with-deps chromium')
  const sensorCensus = workflow.indexOf('audit-ci-test-census.sh --shell-python')
  assert.ok(browserInstall >= 0 && browserInstall < sensorCensus)
})

/**
 * Mutation regressions for the fail-closed CI test census.
 *
 * Each case invokes the Canopus-owned validator through its CLI in a temporary
 * Git repository. The fixture index is the denominator, matching CI without
 * depending on the shared working tree or importing validator internals.
 */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const censusPath = join(repoRoot, 'tests/harness/ci-test-census.json')
const consumerPath = join(repoRoot, 'scripts/audit-ci-test-census.sh')
const buckets = ['required', 'candidate', 'deferred', 'context', 'manual', 'support']
const baseline = JSON.parse(readFileSync(censusPath, 'utf8'))

function cloneManifest() {
  return JSON.parse(JSON.stringify(baseline))
}

function writeFixtureFile(root, relativePath, content = 'fixture\n') {
  const destination = join(root, relativePath)
  mkdirSync(dirname(destination), { recursive: true })
  writeFileSync(destination, content, 'utf8')
}

function run(command, args, cwd, env = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: 30_000,
  })
  assert.equal(result.signal, null, `command terminated by ${result.signal}`)
  return {
    status: result.status ?? -1,
    output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
  }
}

function createFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'worldline-ci-census-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))

  const fixtureConsumer = join(root, 'scripts/audit-ci-test-census.sh')
  mkdirSync(dirname(fixtureConsumer), { recursive: true })
  copyFileSync(consumerPath, fixtureConsumer)

  const classifiedPaths = buckets.flatMap((bucket) => baseline[bucket].map((entry) => entry.path))
  for (const relativePath of classifiedPaths) {
    if (relativePath === 'tests/harness/ci-test-census.json') {
      writeFixtureFile(root, relativePath, `${JSON.stringify(baseline, null, 2)}\n`)
    } else {
      writeFixtureFile(root, relativePath)
    }
  }

  const init = run('git', ['init', '--quiet'], root)
  assert.equal(init.status, 0, init.output)
  const add = run('git', ['add', '.'], root)
  assert.equal(add.status, 0, add.output)

  return root
}

function validate(t, manifest, label) {
  const root = createFixture(t)
  const mutationPath = join(root, 'mutations', `${label}.json`)
  writeFixtureFile(root, `mutations/${label}.json`, `${JSON.stringify(manifest, null, 2)}\n`)

  return run('bash', ['scripts/audit-ci-test-census.sh', '--validate'], root, {
    WL_CI_TEST_CENSUS: mutationPath,
  })
}

function blocker(observed) {
  return {
    command: 'fixture command',
    exit_code: 1,
    observed,
    verified_on: 'fixture clean HEAD',
  }
}

test('valid census passes with required Node and non-Node lanes', (t) => {
  const result = validate(t, cloneManifest(), 'valid')

  assert.equal(result.status, 0, result.output)
  assert.match(result.output, /PASS · executable=/)
  assert.match(result.output, /non_node_required=11/)
  assert.match(result.output, /candidate_blocked=15/)
})

test('omitting a tracked executable sensor fails closed', (t) => {
  const manifest = cloneManifest()
  const omittedPath = 'tests/harness/audit-ground-truth-observed.fixture.sh'
  manifest.required = manifest.required.filter((entry) => entry.path !== omittedPath)

  const result = validate(t, manifest, 'omitted')

  assert.equal(result.status, 1, result.output)
  assert.match(result.output, new RegExp(`tracked executable sensor is absent from the census: ${omittedPath}`))
})

test('downgrading a tracked Node test from required fails closed', (t) => {
  const manifest = cloneManifest()
  const downgradedPath = 'tests/console-gate-contract.test.mjs'
  const entry = manifest.required.find((candidate) => candidate.path === downgradedPath)
  assert.ok(entry, `missing baseline entry: ${downgradedPath}`)
  manifest.required = manifest.required.filter((candidate) => candidate.path !== downgradedPath)
  manifest.candidate.push({ ...entry, blocker: blocker('fixture downgrade') })

  const result = validate(t, manifest, 'downgraded')

  assert.equal(result.status, 1, result.output)
  assert.match(result.output, new RegExp(`tracked Node test is not required: ${downgradedPath}`))
})

test('candidate without complete blocker evidence fails closed', (t) => {
  const manifest = cloneManifest()
  const candidate = manifest.candidate[0]
  assert.ok(candidate?.blocker, 'baseline must include a blocked candidate')
  delete candidate.blocker.verified_on

  const result = validate(t, manifest, 'missing-blocker')

  assert.equal(result.status, 1, result.output)
  assert.match(result.output, new RegExp(`candidate lacks blocker.verified_on: ${candidate.path}`))
})

test('emptying the required non-Node lane fails closed', (t) => {
  const manifest = cloneManifest()
  const moved = manifest.required.filter((entry) => entry.kind !== 'node-test')
  manifest.required = manifest.required.filter((entry) => entry.kind === 'node-test')
  manifest.candidate.push(...moved.map((entry) => ({
    ...entry,
    blocker: blocker('fixture lane downgrade'),
  })))

  const result = validate(t, manifest, 'empty-non-node')

  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /required shell\/Python lane is empty/)
})

test('shell/Python lane executes all 11 required sensors when the first child reads stdin', (t) => {
  const root = createFixture(t)
  const requiredNonNode = baseline.required.filter((entry) => entry.kind !== 'node-test')
  assert.equal(requiredNonNode.length, 11, 'fixture must exercise the complete required non-Node lane')
  assert.match(requiredNonNode[0].kind, /^shell-/, 'the stdin-reading first child must use the shell runner')

  for (const [index, entry] of requiredNonNode.entries()) {
    let content
    if (entry.kind.startsWith('shell-')) {
      content = index === 0
        ? '#!/usr/bin/env bash\nwhile IFS= read -r _line; do :; done\nexit 0\n'
        : '#!/usr/bin/env bash\nexit 0\n'
    } else if (entry.kind.startsWith('python-')) {
      content = 'raise SystemExit(0)\n'
    } else {
      content = 'process.exit(0)\n'
    }
    writeFixtureFile(root, entry.path, content)
  }

  const result = run('bash', ['scripts/audit-ci-test-census.sh', '--shell-python'], root)
  const sensorPassLines = result.output
    .split('\n')
    .filter((line) => /^\[ci-test-census\] PASS · (?!executable=|all )/.test(line))

  assert.equal(result.status, 0, result.output)
  assert.equal(sensorPassLines.length, 11, result.output)
  for (const entry of requiredNonNode) {
    assert.ok(
      sensorPassLines.some((line) => line.endsWith(` · ${entry.path}`)),
      `runner omitted ${entry.path}:\n${result.output}`,
    )
  }
  assert.match(result.output, /PASS · all 11 required non-Node sensors passed/)
})

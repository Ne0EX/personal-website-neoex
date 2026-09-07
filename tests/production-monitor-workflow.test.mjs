import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const { load } = require('js-yaml')
const workflowUrl = new URL('../.github/workflows/production-monitor.yml', import.meta.url)
const readWorkflow = () => load(readFileSync(workflowUrl, 'utf8'))

function monitorJob() {
  const jobs = Object.values(readWorkflow().jobs)
  assert.equal(jobs.length, 1, 'one bounded monitoring job only')
  return jobs[0]
}

test('monitor workflow gates private repositories and forks before allocating a standard runner', () => {
  const job = monitorJob()
  assert.equal(job['runs-on'], 'ubuntu-latest')
  assert.equal(typeof job.if, 'string', 'guard must be job-level, not a step after allocation')
  const expression = job.if.trim().replace(/^\$\{\{\s*/, '').replace(/\s*\}\}$/, '')
  for (const isPrivate of [false, true]) {
    for (const fork of [false, true]) {
      for (const repository of ['Ne0EX/personal-website-neoex', 'fixture/other-repo']) {
        for (const ref of ['refs/heads/main', 'refs/heads/untrusted']) {
          const result = vm.runInNewContext(expression, {
            github: { repository, ref, event: { repository: { private: isPrivate, fork, default_branch: 'main' } } },
            format: (template, value) => template.replace('{0}', value),
          }, { timeout: 100 })
          assert.equal(result, !isPrivate && !fork && repository === 'Ne0EX/personal-website-neoex' && ref === 'refs/heads/main')
        }
      }
    }
  }
})

test('monitor runs hourly off the hour or manually with read-only permissions and a two-minute ceiling', () => {
  const workflow = readWorkflow()
  assert.deepEqual(Object.keys(workflow.on).sort(), ['schedule', 'workflow_dispatch'])
  assert.deepEqual(workflow.on.schedule, [{ cron: '17 * * * *' }])
  assert.deepEqual(workflow.permissions, { contents: 'read' })
  const job = monitorJob()
  assert.equal(Number.isInteger(job['timeout-minutes']), true)
  assert.ok(job['timeout-minutes'] > 0 && job['timeout-minutes'] <= 2)
  assert.equal(job.permissions, undefined, 'job cannot expand token permissions')
  assert.equal(job.strategy, undefined, 'no multiplied matrix runs')
  assert.equal(job['continue-on-error'], undefined)
})

test('trusted actions are commit-pinned and no install, secret, cache, artifact or deployment service is used', () => {
  const job = monitorJob()
  const actions = job.steps.filter((step) => step.uses).map((step) => step.uses)
  assert.deepEqual(actions, [
    'actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803',
    'actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38',
  ])
  const source = JSON.stringify(readWorkflow())
  assert.doesNotMatch(source, /secrets\.|npm\s+(?:ci|install|run\s+build)|npx\s|upload-artifact|actions\/cache|deploy[_-]?hook|continue-on-error|self-hosted/i)
  assert.equal(job.steps.find((step) => step.uses?.startsWith('actions/checkout@')).with?.['persist-credentials'], false)
  assert.equal(job.steps.find((step) => step.uses?.startsWith('actions/setup-node@')).with?.cache, undefined)
  assert.equal(job.steps.find((step) => step.uses?.startsWith('actions/setup-node@')).with?.['package-manager-cache'], false)
  const commands = job.steps.filter((step) => step.run).map((step) => step.run).join('\n')
  assert.equal((commands.match(/node scripts\/production-monitor\.mjs/g) ?? []).length, 1)
  assert.doesNotMatch(commands, /\|\|\s*true|exit\s+0|(?:curl|wget)\s/)
})

test('the actual summary pipeline preserves a failing runner exit under GitHub bash pipefail', () => {
  const step = monitorJob().steps.find((candidate) => candidate.run?.includes('node scripts/production-monitor.mjs'))
  assert.equal(step.shell, 'bash', 'explicit bash activates GitHub -e -o pipefail defaults')
  assert.doesNotMatch(step.run, /set\s+\+|\|\|\s*true|exit\s+0/)
  const script = `node() { echo '{"ok":false,"checks":[]}'; return 1; }\n${step.run}`
  const child = spawnSync('/bin/bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', script], {
    encoding: 'utf8', env: { PATH: '/usr/bin:/bin', GITHUB_STEP_SUMMARY: '/dev/null' }, timeout: 2000,
  })
  assert.equal(child.status, 1)
  assert.equal(child.stderr, '')
  assert.deepEqual(JSON.parse(child.stdout), { ok: false, checks: [] })
})

test('the dangling Vercel cron is removed and the separate weekly rebuild remains byte-identical', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  assert.equal((config.crons ?? []).some((cron) => cron.path === '/api/cron/weekly-rebuild'), false)
  const weeklyBytes = readFileSync(new URL('../.github/workflows/weekly-rebuild.yml', import.meta.url))
  assert.equal(createHash('sha256').update(weeklyBytes).digest('hex'), '3205ab453acfc3fcec0912b4d5148d14f5cd72ffcb9ca4f160624acd25fc9920')
})

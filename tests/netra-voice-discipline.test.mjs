import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const auditPath = join(repoRoot, 'scripts/audit-voice.ts')

const compliantPrompt = `export const NETRA_SYSTEM_PROMPT = \`you are netra.
voice: companion register only. never use instrument register for a human-facing refusal.
source cues: use "in 003" for an archive fact, "across the archive" for a pattern read, "from notes he left here" for a curated note, "to me it reads like" for a subjective read, and "the archive does not confirm" for uncertainty.
grounding: if retrieval returns nothing, say "no trace surveyed". never invent archive entries.
boundaries: say "that sits outside the archive. ask me about the archive." never describe yourself as an ai, language model, or chatbot.\`
`

function write(root, relativePath, content) {
  const destination = join(root, relativePath)
  mkdirSync(dirname(destination), { recursive: true })
  writeFileSync(destination, content, 'utf8')
}

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'netra-voice-contract-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  write(root, 'lib/netra/prompts/system.ts', compliantPrompt)
  write(root, 'lib/netra/voice.md', [
    'PATTERN-01', 'PATTERN-02', 'PATTERN-03', 'PATTERN-04',
    'PATTERN-05', 'PATTERN-06', 'PATTERN-07',
    'REQUIRED-01', 'REQUIRED-02', 'REQUIRED-03', 'REQUIRED-04',
  ].join('\n'))
  write(root, 'components/NetraNavigator.tsx', "export const copy = 'quiet archive guidance'\n")
  write(root, 'components/WorldlineGlobe.tsx', "export const voice = 'surface archive · traces in view'\n")
  return root
}

function run(root) {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', auditPath, '--root', root],
    { cwd: repoRoot, encoding: 'utf8', timeout: 30_000 },
  )
  assert.equal(result.signal, null, `audit terminated by ${result.signal}`)
  return {
    status: result.status ?? -1,
    output: JSON.parse(result.stdout || '{}'),
    stderr: result.stderr,
  }
}

function expectViolation(result, id) {
  assert.equal(result.status, 1, result.stderr || JSON.stringify(result.output))
  assert.ok(
    result.output.violations.some((violation) => violation.id === id),
    `expected ${id}; got ${result.output.violations.map((violation) => violation.id).join(', ')}`,
  )
}

test('the declared NETRA voice markers pass as a deterministic source contract', (t) => {
  const result = run(fixture(t))
  assert.equal(result.status, 0, result.stderr || JSON.stringify(result.output))
  assert.equal(result.output.pass, true)
  assert.deepEqual(result.output.violations, [])
  assert.equal(result.output.required_markers.length, 4)
})
test('instrument-style human refusal copy fails closed', (t) => {
  const root = fixture(t)
  write(root, 'components/NetraNavigator.tsx', "export const refusal = 'outside the worldline. no signal.'\n")
  expectViolation(run(root), 'PATTERN-06')
})

test('affirmative model disclosure fails while a negative prohibition remains valid', (t) => {
  const root = fixture(t)
  write(root, 'components/NetraNavigator.tsx', "export const reply = 'as an ai, i can answer that'\n")
  expectViolation(run(root), 'PATTERN-03')
})

test('missing source-disclosure gradient is a distinct required-marker failure', (t) => {
  const root = fixture(t)
  write(root, 'lib/netra/prompts/system.ts', compliantPrompt.replace('"from notes he left here"', '"from the notes"'))
  const result = run(root)
  assert.equal(result.status, 2, result.stderr || JSON.stringify(result.output))
  assert.ok(result.output.missing_markers.includes('REQUIRED-01'))
})

test('the active NETRA prompt and UI satisfy their source voice contract', () => {
  const result = run(repoRoot)
  assert.equal(result.status, 0, result.stderr || JSON.stringify(result.output))
  assert.equal(result.output.pass, true)
})

test('the active NETRA prompt keeps transcript output free of raw markdown', () => {
  const prompt = readFileSync(join(repoRoot, 'lib/netra/prompts/system.ts'), 'utf8')
  assert.match(prompt, /plain text only/i)
  assert.match(prompt, /do not use markdown/i)
})

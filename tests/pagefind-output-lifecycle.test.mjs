/**
 * Real Pagefind lifecycle regression. All HTML, output, and script copies live
 * in temporary directories; no tracked fixture or production content is edited.
 * Owner: Algol · follow-up to TASK-2026-09-12-PUBLICATION-PAGEFIND
 * Run: node --test tests/pagefind-output-lifecycle.test.mjs
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scriptPath = path.join(repository, 'scripts', 'build-pagefind.mjs')

async function fixture(context) {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'worldline-pagefind-lifecycle-'))
  context.after(() => rm(temporary, { recursive: true, force: true }))
  const site = path.join(temporary, '.next', 'server', 'app')
  const output = path.join(temporary, 'public', 'pagefind')
  await mkdir(site, { recursive: true })
  await mkdir(path.join(temporary, 'scripts'))
  await mkdir(path.dirname(output))
  await copyFile(scriptPath, path.join(temporary, 'scripts', 'build-pagefind.mjs'))
  await symlink(path.join(repository, 'node_modules'), path.join(temporary, 'node_modules'), 'dir')
  await writeFile(path.join(temporary, 'public', 'keep.txt'), 'unrelated public asset')
  await writeFile(path.join(temporary, 'source.txt'), 'authored source remains untouched')
  return { temporary, site, output }
}

async function html(site, slug, title) {
  await writeFile(path.join(site, slug + '.html'),
    '<!doctype html><html lang="en"><head><title>' + title + '</title></head>' +
    '<body><main data-pagefind-body><h1 data-pagefind-meta="title">' + title +
    '</h1><p>Distinct searchable survey text for ' + slug + '.</p></main></body></html>')
}

function build(temporary) {
  return spawnSync(process.execPath, [path.join(temporary, 'scripts', 'build-pagefind.mjs')], {
    // Running elsewhere must not widen cleanup or change the fixed output path.
    cwd: os.tmpdir(), encoding: 'utf8', timeout: 30000,
  })
}

function assertSucceeded(result) {
  assert.equal(result.status, 0, result.stdout + '\n' + result.stderr)
  assert.equal(result.error, undefined)
}

async function fragments(output) {
  const directory = path.join(output, 'fragment')
  const files = await readdir(directory)
  return Promise.all(files.filter((file) => file.endsWith('.pf_fragment')).map(async (file) => {
    const text = gunzipSync(await readFile(path.join(directory, file))).toString()
    assert.ok(text.startsWith('pagefind_dcd'), 'installed Pagefind fragment format changed')
    return { file, data: JSON.parse(text.slice('pagefind_dcd'.length)) }
  }))
}

async function snapshot(directory, prefix = '') {
  const result = {}
  for (const entry of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name)
    if (entry.isDirectory()) Object.assign(result, await snapshot(directory, relative))
    else result[relative] = createHash('sha256').update(await readFile(path.join(directory, relative))).digest('hex')
  }
  return result
}

async function assertTempClean(temporary) {
  assert.deepEqual((await readdir(path.join(temporary, '.next')))
    .filter((name) => name.startsWith('pagefind-build-')), [])
}

test('index:search retains sidecar injection and routes generation through the fresh-output wrapper', async () => {
  const pkg = JSON.parse(await readFile(path.join(repository, 'package.json'), 'utf8'))
  assert.equal(pkg.scripts['index:search'],
    'npx tsx scripts/inject-pagefind-sidecar.ts && node scripts/build-pagefind.mjs')
  assert.match(pkg.scripts.build, /npm run index:search/)
})

test('real rebuild removes withdrawn fragments and orphan files while retaining only the current index', async (context) => {
  const { temporary, site, output } = await fixture(context)
  await html(site, 'old', 'Withdrawn constellation')
  await html(site, 'live', 'Living constellation')
  const sourceBefore = await readFile(path.join(temporary, 'source.txt'), 'utf8')
  assertSucceeded(build(temporary))
  const before = await fragments(output)
  const old = before.find((fragment) => fragment.data.url === '/old.html')
  assert.ok(old, 'initial build must genuinely index the soon-to-be-withdrawn page')
  assert.equal(before.length, 2)
  await writeFile(path.join(output, 'orphan.pf_meta'), 'obsolete generation')
  await rm(path.join(site, 'old.html'))
  const liveBefore = await readFile(path.join(site, 'live.html'), 'utf8')

  assertSucceeded(build(temporary))
  await assert.rejects(readFile(path.join(output, 'fragment', old.file)), { code: 'ENOENT' })
  await assert.rejects(readFile(path.join(output, 'orphan.pf_meta')), { code: 'ENOENT' })
  const after = await fragments(output)
  assert.deepEqual(after.map((fragment) => fragment.data.url), ['/live.html'])
  assert.doesNotMatch(JSON.stringify(after), /Withdrawn constellation/)
  const manifest = JSON.parse(await readFile(path.join(output, 'pagefind-entry.json'), 'utf8'))
  assert.equal(Object.values(manifest.languages).reduce((sum, language) => sum + language.page_count, 0), 1)
  assert.equal(await readFile(path.join(temporary, 'public', 'keep.txt'), 'utf8'), 'unrelated public asset')
  assert.equal(await readFile(path.join(temporary, 'source.txt'), 'utf8'), sourceBefore)
  assert.equal(await readFile(path.join(site, 'live.html'), 'utf8'), liveBefore)
  await assertTempClean(temporary)

  const stable = await snapshot(output)
  assertSucceeded(build(temporary))
  assert.deepEqual(await snapshot(output), stable, 'unchanged input does not accumulate artifacts')
  await assertTempClean(temporary)
})

test('a real generator failure preserves the previous valid index and removes staging output', async (context) => {
  const { temporary, site, output } = await fixture(context)
  await html(site, 'live', 'Living constellation')
  assertSucceeded(build(temporary))
  const previous = await snapshot(output)
  await rm(site, { recursive: true })
  const failed = build(temporary)
  assert.notEqual(failed.status, 0, 'missing site must make the actual CLI fail')
  assert.deepEqual(await snapshot(output), previous)
  assert.equal(await readFile(path.join(temporary, 'public', 'keep.txt'), 'utf8'), 'unrelated public asset')
  await assertTempClean(temporary)
})

test('replacing a symlinked generated index never deletes its external target', async (context) => {
  const { temporary, site, output } = await fixture(context)
  const external = path.join(temporary, 'external-index')
  await mkdir(external)
  await writeFile(path.join(external, 'keep.txt'), 'external target must survive')
  await symlink(external, output, 'dir')
  await html(site, 'live', 'Living constellation')
  assertSucceeded(build(temporary))
  assert.equal(await readFile(path.join(external, 'keep.txt'), 'utf8'), 'external target must survive')
  assert.deepEqual((await fragments(output)).map((fragment) => fragment.data.url), ['/live.html'])
  await assertTempClean(temporary)
})

test('a symlinked public parent is refused without modifying its external index', async (context) => {
  const { temporary, site } = await fixture(context)
  const external = await mkdtemp(path.join(os.tmpdir(), 'worldline-pagefind-external-'))
  context.after(() => rm(external, { recursive: true, force: true }))
  await mkdir(path.join(external, 'pagefind'))
  await writeFile(path.join(external, 'pagefind', 'keep.txt'), 'external old index must survive')
  await writeFile(path.join(external, 'unrelated.txt'), 'external source must survive')
  const previous = await snapshot(external)
  await rm(path.join(temporary, 'public'), { recursive: true })
  await symlink(external, path.join(temporary, 'public'), 'dir')
  await html(site, 'live', 'Living constellation')
  const failed = build(temporary)
  assert.notEqual(failed.status, 0)
  assert.match(failed.stderr, /Refusing symlinked public directory/)
  assert.deepEqual(await snapshot(external), previous)
  await assertTempClean(temporary)
})

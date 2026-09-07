/** SQL source contracts; live Storage enforcement is verified separately. */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const migrations = path.resolve(import.meta.dirname, '../supabase/migrations')

function migration(suffix) {
  const filenames = readdirSync(migrations).filter((name) =>
    /^\d+_/.test(name) && name.endsWith(`_${suffix}.sql`))
  assert.equal(filenames.length, 1, `exactly one ${suffix} migration must exist`)
  return readFileSync(path.join(migrations, filenames[0]), 'utf8')
    .replace(/--[^\n]*/g, '').trim()
}

function usingExpression(sql) {
  const match = sql.match(/\bUSING\s*\(([\s\S]*)\)\s*;\s*$/i)
  assert.ok(match, 'policy must contain one complete USING expression')
  return match[1]
}

const finalPolicy = () => migration('draft_media_download_operations')

test('published Storage access permits exactly download and its metadata precheck', () => {
  const sql = finalPolicy()
  const calls = [...sql.matchAll(/storage\.allow_any_operation\s*\(\s*ARRAY\s*\[([^\]]*)\]\s*\)/g)]
  assert.equal(calls.length, 1, 'one explicit operation allowlist is required')
  const operations = [...calls[0][1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort()
  assert.deepEqual(operations, ['object.get_authenticated', 'object.get_authenticated_info'])
  assert.equal(calls[0][1].replace(/'[^']+'|,|\s/g, ''), '', 'no computed operation values')
  assert.doesNotMatch(sql, /storage\.allow_only_operation|object\.(?:sign|list|upload|delete|update|render)/i)
})

test('the operation correction preserves the original published exact-nine-key authorization expression', () => {
  const original = usingExpression(migration('draft_media_privacy'))
    .replace(/storage\.allow_only_operation\('object\.get_authenticated'\)/, 'DOWNLOAD_OPERATIONS')
  const corrected = usingExpression(finalPolicy())
    .replace(/storage\.allow_any_operation\s*\(\s*ARRAY\s*\[[^\]]*\]\s*\)/, 'DOWNLOAD_OPERATIONS')
  assert.equal(corrected.replace(/\s/g, ''), original.replace(/\s/g, ''))
})

test('the correction changes only the existing SELECT policy, not roles, originals or write permissions', () => {
  const sql = finalPolicy()
  assert.match(sql, /^ALTER POLICY photos_published_variant_read\s+ON storage\.objects\s+USING\s*\(/)
  assert.equal((sql.match(/\bALTER\b/gi) ?? []).length, 1)
  assert.equal((sql.match(/;/g) ?? []).length, 1, 'no additional SQL statements')
  assert.doesNotMatch(sql, /\b(?:CREATE|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE|TO|RENAME|WITH\s+CHECK)\b/i)
  assert.doesNotMatch(sql, /originals|storage\.buckets|is_owner|auth\./i)
  assert.match(migration('draft_media_privacy'), /FOR SELECT\s+TO anon, authenticated\s+USING/)
})

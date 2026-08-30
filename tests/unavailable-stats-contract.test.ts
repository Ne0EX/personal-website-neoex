import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCorpusSnapshot,
  unavailableCorpusSnapshot,
} from '../lib/netra/corpus-snapshot-builder'
import { formatWorldlineCount } from '../lib/worldline-stats'

test('unavailable worldline counts render as unknown rather than factual zeroes', () => {
  assert.equal(formatWorldlineCount(null), '—')
  assert.equal(formatWorldlineCount(undefined), '—')
  assert.equal(formatWorldlineCount(Number.NaN), '—')
  assert.equal(formatWorldlineCount(0), '000')
  assert.equal(formatWorldlineCount(47), '047')
})

test('an unavailable corpus snapshot carries no numeric facts', () => {
  assert.deepEqual(unavailableCorpusSnapshot(), {
    version: 2,
    available: false,
    generatedAt: null,
    counts: null,
    entries: [],
  })
})

test('only a successful corpus read produces available counts', () => {
  const snapshot = buildCorpusSnapshot([
    { slug: '001', kind: 'article', title: 'One', lang: 'en', summary: null },
    { slug: 'frame-1', kind: 'photo', title: null, lang: 'en', summary: null },
  ], '2026-08-31T00:00:00.000Z')

  assert.equal(snapshot.available, true)
  assert.deepEqual(snapshot.counts, { entries: 2, photos: 1, fiction: 0 })
})

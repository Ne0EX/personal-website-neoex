import assert from 'node:assert/strict'
import test from 'node:test'
import {
  localizedSidecarKey,
  localizedSidecarRows,
  splitLocalizedHtmlPath,
} from '../scripts/pagefind-sidecar-routing'

test('localized pagefind routing preserves the served locale', () => {
  assert.deepEqual(splitLocalizedHtmlPath('en/articles/002.html'), {
    lang: 'en',
    routeParts: ['articles', '002.html'],
  })
  assert.deepEqual(splitLocalizedHtmlPath('th/articles/002.html'), {
    lang: 'th',
    routeParts: ['articles', '002.html'],
  })
  assert.deepEqual(splitLocalizedHtmlPath('archive.html'), {
    lang: 'en',
    routeParts: ['archive.html'],
  })
})

test('translated siblings cannot collide in a sidecar lookup', () => {
  assert.notEqual(
    localizedSidecarKey('en', 'article', '002'),
    localizedSidecarKey('th', 'article', '002'),
  )
})

test('archive sidecars receive records from their served language only', () => {
  const rows = [
    { lang: 'en' as const, title: 'English title' },
    { lang: 'th' as const, title: 'ชื่อภาษาไทย' },
    { lang: 'en' as const, title: 'Second English title' },
  ]

  assert.deepEqual(
    localizedSidecarRows(rows, 'th').map((row) => row.title),
    ['ชื่อภาษาไทย'],
  )
})

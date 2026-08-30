import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const navigatorCss = readFileSync(
  new URL('../components/NetraNavigator.css', import.meta.url),
  'utf8',
)

function blockFor(prelude, source = navigatorCss) {
  const start = source.indexOf(prelude)
  assert.notEqual(start, -1, `missing CSS block: ${prelude}`)

  const openingBrace = source.indexOf('{', start + prelude.length)
  assert.notEqual(openingBrace, -1, `missing opening brace: ${prelude}`)

  let depth = 1
  for (let index = openingBrace + 1; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(openingBrace + 1, index)
  }

  assert.fail(`missing closing brace: ${prelude}`)
}

function declarationsFor(selector, source = navigatorCss) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matches = source.matchAll(
    new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'g'),
  )

  return [...matches].map((match) => match[1]).join('\n')
}

test('the mobile NETRA trigger keeps its instrument readout in the primary row', () => {
  const readout = declarationsFor('.netra-trigger.atlas-netra .readout')

  assert.match(readout, /display:\s*grid\s*;/)
  assert.match(readout, /grid-column:\s*auto\s*;/)
  assert.match(readout, /grid-row:\s*auto\s*;/)
})

test('the NETRA trigger label cannot wrap and inflate the control', () => {
  const label = declarationsFor('.netra-trigger.atlas-netra .id-box .lab')

  assert.match(label, /white-space:\s*nowrap\s*;/)
})

test('the mobile NETRA trigger remains a compact single-row instrument', () => {
  const mobile = blockFor('@media (max-width: 600px)')
  const trigger = declarationsFor('.netra-trigger.atlas-netra', mobile)

  assert.match(trigger, /width:\s*12\.5rem\s*;/)
  assert.match(trigger, /grid-template-rows:\s*auto\s*;/)
})

test('the narrow NETRA sheet preserves title space without removing clear-log access', () => {
  const narrowMobile = blockFor('@media (max-width: 420px)')
  const readout = declarationsFor(
    '.netra-header-instrument.atlas-netra .readout',
    narrowMobile,
  )
  const clear = declarationsFor('.netra-clear', narrowMobile)
  const clearGlyph = declarationsFor('.netra-clear > span', narrowMobile)

  assert.match(readout, /display:\s*none\s*;/)
  assert.match(clear, /font-size:\s*0\s*;/)
  assert.match(clear, /min-(?:width|height):\s*3rem\s*;/)
  assert.match(clearGlyph, /font-size:\s*1rem\s*;/)
})

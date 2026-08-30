import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const navigatorCss = readFileSync(
  new URL('../components/NetraNavigator.css', import.meta.url),
  'utf8',
)
const navigatorSource = readFileSync(
  new URL('../components/NetraNavigator.tsx', import.meta.url),
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

function declarationValue(declarations, property) {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return declarations.match(
    new RegExp(`(?:^|;)\\s*${escapedProperty}\\s*:\\s*([^;]+)`),
  )?.[1].trim() ?? null
}

function cssPixels(value) {
  const match = value?.match(/^(\d*\.?\d+)(px|rem)$/)
  if (!match) return null
  return Number(match[1]) * (match[2] === 'rem' ? 16 : 1)
}

test('the fixed NETRA trigger is an exact 52px true-circle target', () => {
  const trigger = declarationsFor('.netra-trigger.atlas-netra')
  const width = cssPixels(declarationValue(trigger, 'width'))
  const height = cssPixels(declarationValue(trigger, 'height'))

  assert.equal(width, 52)
  assert.equal(height, 52)
  assert.match(trigger, /border-radius:\s*50%\s*;/)
  assert.doesNotMatch(trigger, /min-width:\s*12\.5rem\s*;/)
})

test('the compact trigger respects the lower safe area and never regains console width', () => {
  const trigger = declarationsFor('.netra-trigger.atlas-netra')
  assert.match(trigger, /bottom:\s*calc\([^;]*env\(safe-area-inset-bottom/)

  const mobile = blockFor('@media (max-width: 600px)')
  const mobileTrigger = declarationsFor('.netra-trigger.atlas-netra', mobile)
  const mobileWidth = declarationValue(mobileTrigger, 'width')

  assert.doesNotMatch(mobileTrigger, /12\.5rem/)
  assert.doesNotMatch(mobileTrigger, /max-width:\s*calc\(100vw/)
  if (mobileWidth !== null) {
    const width = cssPixels(mobileWidth)
    assert.equal(width, 52)
  }
})

test('the optional NETRA tooltip is overlay-only and cannot enlarge the trigger', () => {
  const tooltip = declarationsFor('.netra-trigger-tooltip')

  assert.match(tooltip, /position:\s*absolute\s*;/)
  assert.match(tooltip, /pointer-events:\s*none\s*;/)
  assert.match(tooltip, /opacity:\s*0\s*;/)
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

test('NETRA prompt, response, and error copy use instrument mono typography', () => {
  for (const selector of ['.netra-message', '.netra-error p', '.netra-composer input']) {
    const declarations = declarationsFor(selector)
    assert.match(declarations, /var\(--font-mono\)/, `${selector} must use instrument mono`)
    assert.doesNotMatch(declarations, /var\(--font-display\)/, `${selector} must not use display serif`)
  }

  const thaiInstrument = declarationsFor(
    ".netra-panel:lang(th) .netra-message,\n.netra-panel:lang(th) .netra-error p,\n.netra-panel:lang(th) .netra-composer input",
  )
  assert.match(thaiInstrument, /var\(--font-mono\)/)
  assert.doesNotMatch(thaiInstrument, /var\(--font-display\)/)
})

test('daily ceiling copy remains terse instrument status, not conversational apology', () => {
  assert.match(navigatorSource, /daily ceiling reached · channel closed/)
  assert.match(navigatorSource, /ถึงเพดานประจำวัน · ปิดช่องสัญญาณ/)
  assert.doesNotMatch(navigatorSource, /i need to step away|ฉันต้องหยุดสำรวจ/i)
})

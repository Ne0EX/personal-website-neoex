/**
 * tests/console-nav-contract.test.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Locks in the console ↔ editor navigation contract (Slice 2).
 * If any of these fail, a regression has been introduced to the round-trip.
 *
 * Owner: Algol (α-VER-06) · atlas-console Slice 2 · 2026-06-07
 *
 * Run: node --test tests/console-nav-contract.test.mjs
 * (or via npm run test if the test runner picks up *.test.mjs)
 *
 * These are static contract tests — they read source files and validate
 * the nav contract properties without requiring a running server.
 */

import { readFileSync } from 'fs'
import { test } from 'node:test'
import assert from 'node:assert'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function readFile(rel) {
  return readFileSync(join(root, rel), 'utf-8')
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract 1: /console/editor back-link points to /console
// ─────────────────────────────────────────────────────────────────────────────
test('ArticleEditor.tsx back-link href is /console', () => {
  const src = readFile('components/console/ArticleEditor.tsx')
  // The ed-back link must resolve to /console (not a placeholder or /)
  assert.match(
    src,
    /href="\/console"/,
    'ArticleEditor.tsx must have href="/console" on the back-link'
  )
  // Must not be a placeholder any more
  assert.doesNotMatch(
    src,
    /TODO.*console.*slice/i,
    'ArticleEditor.tsx must not still contain the "TODO: console slice" placeholder'
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Contract 2: /console page renders ConsoleApp
// ─────────────────────────────────────────────────────────────────────────────
test('app/console/page.tsx renders ConsoleApp with initialNodes and initialEdges', () => {
  const src = readFile('app/console/page.tsx')
  assert.match(src, /ConsoleApp/, 'ConsolePage must render <ConsoleApp />')
  assert.match(src, /initialNodes/, 'ConsolePage must pass initialNodes')
  assert.match(src, /initialEdges/, 'ConsolePage must pass initialEdges')
})

// ─────────────────────────────────────────────────────────────────────────────
// Contract 3: console page metadata — noindex/nofollow, correct title
// ─────────────────────────────────────────────────────────────────────────────
test('app/console/page.tsx has noindex/nofollow robots metadata', () => {
  const src = readFile('app/console/page.tsx')
  assert.match(src, /robots.*index.*false/s, 'robots metadata must set index: false')
  assert.match(src, /robots.*follow.*false/s, 'robots metadata must set follow: false')
  assert.match(src, /Worldline.*Console/, 'title must include "Worldline · Console" or similar')
})

// ─────────────────────────────────────────────────────────────────────────────
// Contract 4: OPEN EDITOR URL contract — kind + slug params
// ─────────────────────────────────────────────────────────────────────────────
test('ConsoleEntryForm.tsx OPEN EDITOR link uses kind and slug params', () => {
  const src = readFile('components/console/ConsoleEntryForm.tsx')
  // The URL contract: /console/editor?kind=<kind>&slug=<fileId>
  assert.match(
    src,
    /\/console\/editor.*kind.*slug/s,
    'ConsoleEntryForm must link to /console/editor with kind and slug params'
  )
  assert.match(
    src,
    /OPEN EDITOR/,
    'ConsoleEntryForm must render "OPEN EDITOR" link text'
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Contract 5: ESC keyboard shortcut wired in ConsoleApp
// ─────────────────────────────────────────────────────────────────────────────
test('ConsoleApp.tsx wires ESC keydown to close form / deselect', () => {
  const src = readFile('components/console/ConsoleApp.tsx')
  assert.match(src, /key === 'Escape'/, 'ConsoleApp must handle Escape key')
  assert.match(src, /formOpen.*closeForm/s, 'ESC must call closeForm when form is open')
})

// ─────────────────────────────────────────────────────────────────────────────
// Contract 6: SAVE DRAFT mock — 240ms per spec
// ─────────────────────────────────────────────────────────────────────────────
test('ConsoleApp.tsx persist mock resolves after 240ms', () => {
  const src = readFile('components/console/ConsoleApp.tsx')
  assert.match(src, /setTimeout.*240/s, 'persist mock must use setTimeout with 240ms delay')
})

// ─────────────────────────────────────────────────────────────────────────────
// Contract 7: ARIA roles on key interactive surfaces
// ─────────────────────────────────────────────────────────────────────────────
test('ConsoleApp.tsx declares role="application" on main shell', () => {
  const src = readFile('components/console/ConsoleApp.tsx')
  assert.match(src, /role="application"/, 'main shell must have role="application"')
  assert.match(src, /aria-label="Worldline Console"/, 'must have aria-label on the application')
})

test('ConsoleRail.tsx declares role="radiogroup" on kind filter', () => {
  const src = readFile('components/console/ConsoleRail.tsx')
  assert.match(src, /role="radiogroup"/, 'kind filter must have role="radiogroup"')
  assert.match(src, /role="radio"/, 'each pill must have role="radio"')
  assert.match(src, /aria-checked/, 'pills must declare aria-checked')
})

test('ConsoleRail.tsx declares role="listbox" on entry list', () => {
  const src = readFile('components/console/ConsoleRail.tsx')
  assert.match(src, /role="listbox"/, 'entry list must have role="listbox"')
  assert.match(src, /role="option"/, 'each entry row must have role="option"')
  assert.match(src, /aria-selected/, 'entry rows must declare aria-selected')
})

test('ConsoleCanvas.tsx declares role="region" on canvas', () => {
  const src = readFile('components/console/ConsoleCanvas.tsx')
  assert.match(src, /role="region"/, 'canvas must have role="region"')
  assert.match(src, /aria-label="Worldline graph editor"/, 'canvas must have aria-label')
})

test('ConsoleCanvas.tsx node cards have role="button" and aria-label', () => {
  const src = readFile('components/console/ConsoleCanvas.tsx')
  assert.match(src, /role="button"/, 'node cards must have role="button"')
  assert.match(src, /tabIndex=\{0\}/, 'node cards must be keyboard reachable (tabIndex=0)')
  assert.match(src, /aria-label=/, 'node cards must have aria-label')
  assert.match(src, /aria-selected/, 'node cards must declare aria-selected')
})

// ─────────────────────────────────────────────────────────────────────────────
// Contract 8: prefers-reduced-motion respected
// ─────────────────────────────────────────────────────────────────────────────
test('ConsoleCanvas.tsx search-to-fly checks prefers-reduced-motion', () => {
  const src = readFile('components/console/ConsoleCanvas.tsx')
  assert.match(
    src,
    /prefers-reduced-motion.*reduce/,
    'search-to-fly must check prefers-reduced-motion'
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Contract 9: globals.css is not modified (regression guard)
// ─────────────────────────────────────────────────────────────────────────────
// This test verifies the console CSS lives inline (no new globals.css entries).
// It checks that console-specific class names do NOT appear in globals.css.
test('globals.css does not contain console-specific class names', () => {
  const src = readFile('app/globals.css')
  // None of these should be in globals.css — they live in inline CSS blocks
  const consoleClasses = ['.console-shell', '.console-rail', '.console-body', '.kn-card', '.ef-input', '.ch-dot']
  for (const cls of consoleClasses) {
    assert.doesNotMatch(
      src,
      new RegExp(cls.replace('.', '\\.'), 'm'),
      `globals.css must not define ${cls} — it belongs in inline component CSS`
    )
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Contract 10: narrow-viewport offline state
// ─────────────────────────────────────────────────────────────────────────────
test('ConsoleApp.tsx has narrow-viewport offline state with role="alert"', () => {
  const src = readFile('components/console/ConsoleApp.tsx')
  assert.match(src, /console-offline/, 'must have .console-offline for narrow viewport')
  assert.match(src, /role="alert"/, 'offline state must have role="alert"')
  assert.match(src, /window\.innerWidth.*600|600.*window\.innerWidth/, 'must check 600px breakpoint')
})

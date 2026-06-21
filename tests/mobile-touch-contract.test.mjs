/**
 * tests/mobile-touch-contract.test.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Regression guards for the mobile-native pass (α-VER-06 · 2026-06-20).
 *
 * These are static source-contract tests — they read files and assert
 * structural tokens without requiring a running server or browser.
 *
 * Checks locked in:
 *   (a) viewport export present in app/layout.tsx with viewportFit:'cover'
 *   (b) touch-action:pan-y on .atlas-frame .atlas-globe-wrap canvas in globals.css
 *   (c) touch-action:none still present on ArchiveMiniGlobeThreeJS and ConsoleCanvas
 *       (regression — must not have been removed)
 *   (d) .marginalia at ≤600px is a hairline (width:1px), NOT display:none
 *   (e) every .nav-slim* class used in Nav.tsx JSX exists as a CSS selector
 *       in globals.css (class-mismatch = invisible-bar failure mode)
 *   (f) RAF loop replacing setInterval in WorldlineGlobe.tsx:
 *       cancelAnimationFrame present, setInterval absent in render loop
 *   (g) PhotoSwipeViewer: no setPointerCapture call; pointercancel handled;
 *       touch-action:pan-y on wrapper; ≥600 inert (isPhone guard)
 *   (h) ConsoleCanvas.tsx toWorld divides by scale (scale-threading contract)
 *
 * Owner: Algol (α-VER-06) · mobile-native Q1 · 2026-06-20
 * Run: node --test tests/mobile-touch-contract.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function readFile(rel) {
  return readFileSync(join(root, rel), 'utf-8')
}

// ─────────────────────────────────────────────────────────────────────────────
// (a) Viewport export — viewportFit:'cover' in app/layout.tsx
// ─────────────────────────────────────────────────────────────────────────────
test('layout.tsx exports a viewport object with viewportFit:cover', () => {
  const src = readFile('app/layout.tsx')

  // Must import Viewport type from next
  assert.match(
    src,
    /import type \{[^}]*Viewport[^}]*\} from 'next'/,
    "app/layout.tsx must import Viewport type from 'next'",
  )

  // Must export a const viewport with viewportFit: 'cover'
  assert.match(
    src,
    /export const viewport[^=]*=/,
    'app/layout.tsx must export `const viewport`',
  )
  assert.match(
    src,
    /viewportFit:\s*['"]cover['"]/,
    "viewport export must set viewportFit: 'cover'",
  )

  // Must be separate from the metadata export (F1 spec requirement)
  assert.match(
    src,
    /export const metadata/,
    'metadata export must still be present as a separate export',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// (b) Main globe canvas: touch-action:pan-y (S1-CSS)
// ─────────────────────────────────────────────────────────────────────────────
test('globals.css: .atlas-frame .atlas-globe-wrap canvas has touch-action:pan-y under pointer:coarse', () => {
  const src = readFile('app/globals.css')

  // The rule must exist — scoped to @media (pointer: coarse)
  assert.match(
    src,
    /@media\s*\(pointer:\s*coarse\)[^}]*\{[^}]*\.atlas-frame[^}]*touch-action[^}]*pan-y/s,
    'globals.css must have touch-action:pan-y on .atlas-frame .atlas-globe-wrap canvas inside @media(pointer:coarse)',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// (c) Regression: touch-action:none on mini-globe and console viewport NOT removed
// ─────────────────────────────────────────────────────────────────────────────
test('ConsoleCanvas.tsx: canvas-viewport still has touch-action:none (inline CSS not removed)', () => {
  const src = readFile('components/console/ConsoleCanvas.tsx')
  // The .canvas-viewport style block is defined inline in ConsoleCanvas.tsx
  assert.match(
    src,
    /touch-action:\s*none/,
    'ConsoleCanvas.tsx must still contain touch-action:none on the canvas-viewport (must not have been removed by mobile-native changes)',
  )
})

test('ArchiveMiniGlobeThreeJS.tsx: touch-action:none not removed (bounded panel must not scroll-trap)', () => {
  const src = readFile('components/ArchiveMiniGlobeThreeJS.tsx')
  // The plan spec (mossy-inventing-hinton.md §Globe detail) explicitly states:
  // "Mini-globe keeps touch-action:none — bounded panel, correct, do not touch."
  // The mini-globe sets touch-action via JS style assignment (el.style.touchAction = 'none')
  // rather than a CSS literal — both forms are valid; we check for the presence of 'none'
  // adjacent to touchAction or touch-action in any form.
  assert.match(
    src,
    /touchAction\s*=\s*['"]none['"]|touch-action[:\s]*none/,
    'ArchiveMiniGlobeThreeJS.tsx must retain touch-action:none (or el.style.touchAction="none") — the mini-globe is a bounded panel and must not allow page scroll through it',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// (d) .marginalia at ≤600px: hairline (width:1px), NOT display:none (S2)
// ─────────────────────────────────────────────────────────────────────────────
test('globals.css: .marginalia at ≤600px is a hairline, not display:none', () => {
  const src = readFile('app/globals.css')

  // Find the ≤600px media block and confirm .marginalia uses width:1px
  // The spec change: was display:none, now width:1px with border-left dashed.
  assert.match(
    src,
    /@media[^{]*max-width:\s*600px[^{]*\{[\s\S]*?\.marginalia\s*\{[\s\S]*?width:\s*1px/,
    'globals.css: .marginalia inside @media(max-width:600px) must set width:1px (hairline), not display:none',
  )

  // The hairline rule must NOT be display:none on the .marginalia element itself
  // (children can be display:none to hide text, but the container must be visible)
  const phoneBlock = src.match(/@media[^{]*max-width:\s*600px[^{]*\{([\s\S]*?\}\s*\})/)?.[1] ?? ''
  const marginaliaSel = phoneBlock.match(/\.marginalia\s*\{([^}]*)\}/)?.[1] ?? ''
  assert.doesNotMatch(
    marginaliaSel,
    /display:\s*none/,
    'globals.css: .marginalia selector inside ≤600 block must NOT use display:none (instrument must remain visible as a hairline)',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// (e) Nav slim bar: class-mismatch check
//     Every .nav-slim* class used in Nav.tsx JSX must have a CSS definition
//     in globals.css, and every .nav-slim* CSS rule must be used in Nav.tsx.
// ─────────────────────────────────────────────────────────────────────────────
test('Nav.tsx / globals.css: nav-slim* class names are in sync (no invisible-bar mismatch)', () => {
  const navSrc  = readFile('components/Nav.tsx')
  const cssSrc  = readFile('app/globals.css')

  // Extract classes used in Nav.tsx JSX (className= strings and template literals)
  const navClassMatches = navSrc.match(/nav-slim[a-z-]*/g) ?? []
  const navClasses = new Set(navClassMatches)

  // Extract .nav-slim* selectors defined in globals.css
  const cssSelMatches = cssSrc.match(/\.nav-slim[a-z-]*/g) ?? []
  const cssClasses = new Set(cssSelMatches.map((s) => s.slice(1))) // strip leading dot

  // Every class used in TSX must have a CSS rule
  for (const cls of navClasses) {
    assert.ok(
      cssClasses.has(cls),
      `Nav.tsx uses class "${cls}" but globals.css has no selector ".${cls}" — invisible-bar failure`,
    )
  }

  // Every CSS rule must be referenced in Nav.tsx
  // (catches orphaned CSS that would silently go unused after a TSX rename)
  for (const cls of cssClasses) {
    assert.ok(
      navClasses.has(cls),
      `globals.css defines ".${cls}" but Nav.tsx never uses class "${cls}" — orphaned CSS rule`,
    )
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// (f) WorldlineGlobe.tsx: setInterval render loop (iOS Safari robustness)
//
// DELIBERATE: the globe loop uses window.setInterval(tick, 16), NOT
// requestAnimationFrame. On iOS Safari, rAF does not advance while the tab is
// backgrounded / during certain scroll states → the canvas renders once and
// then stays permanently blank. setInterval ticks unconditionally, which is the
// robust choice on mobile. See commit 432d94b ("revert globe loop to setInterval
// (iOS blank)") and the rationale comment in WorldlineGlobe.tsx render section.
// This test was previously inverted (asserted rAF) and went stale when the iOS
// fix landed without updating it; corrected during the mobile-native merge.
// ─────────────────────────────────────────────────────────────────────────────
test('WorldlineGlobe.tsx: render loop uses setInterval (iOS Safari robustness)', () => {
  const src = readFile('components/WorldlineGlobe.tsx')

  // setInterval loop + clearInterval cleanup must be present in active code.
  const stripped = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.match(
    stripped,
    /setInterval\s*\(/,
    'WorldlineGlobe.tsx must use setInterval() for the render loop (iOS Safari robustness)',
  )
  assert.match(
    stripped,
    /clearInterval\s*\(/,
    'WorldlineGlobe.tsx must use clearInterval() for render-loop cleanup',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// (g) PhotoSwipeViewer.tsx: scroll-trap contracts (S4 / RISK #3)
// ─────────────────────────────────────────────────────────────────────────────
test('PhotoSwipeViewer.tsx: no setPointerCapture call (CW-11 scroll-trap prevention)', () => {
  const src = readFile('components/PhotoSwipeViewer.tsx')
  // Strip comments before checking — the spec comment says "NEVER setPointerCapture"
  // as documentation, but there must be no actual call in executable code.
  const stripped = src
    .replace(/\/\/[^\n]*/g, '')       // single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments (JSDoc / inline)
  assert.doesNotMatch(
    stripped,
    /setPointerCapture\s*\(/,
    'PhotoSwipeViewer.tsx must NEVER call setPointerCapture() in active code — it re-introduces the CW-11 scroll-trap',
  )
})

test('PhotoSwipeViewer.tsx: pointercancel handler present (iOS aggressive cancel guard)', () => {
  const src = readFile('components/PhotoSwipeViewer.tsx')
  assert.match(
    src,
    /pointercancel|PointerCancel/i,
    'PhotoSwipeViewer.tsx must handle pointercancel — iOS fires it aggressively during scroll recovery',
  )
})

test('PhotoSwipeViewer.tsx: touch-action:pan-y on wrapper (vertical scroll must not be trapped)', () => {
  const src = readFile('components/PhotoSwipeViewer.tsx')
  assert.match(
    src,
    /pan-y/,
    'PhotoSwipeViewer.tsx wrapper must set touch-action:pan-y so vertical scroll passes through',
  )
})

test('PhotoSwipeViewer.tsx: ≥600px inert guard — only active when isPhone', () => {
  const src = readFile('components/PhotoSwipeViewer.tsx')
  // The component must gate on a phone-size check so desktop is unaffected.
  // Pattern: matchMedia or isPhone state gate in pointer handlers.
  assert.match(
    src,
    /max-width.*600|isPhone/,
    'PhotoSwipeViewer.tsx must gate swipe behavior on a ≤600px check (desktop must be inert)',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// (h) ConsoleCanvas.tsx: toWorld divides by scale (RISK #6)
// ─────────────────────────────────────────────────────────────────────────────
test('ConsoleCanvas.tsx: toWorld divides by scale (scale-threading contract)', () => {
  const src = readFile('components/console/ConsoleCanvas.tsx')

  // The toWorld function must contain a division by the scale variable.
  // Pattern: (... - pan.x) / s  or  / scaleRef.current
  // We look for the toWorld function body and assert the division.
  const toWorldIdx = src.indexOf('const toWorld')
  assert.ok(toWorldIdx !== -1, 'ConsoleCanvas.tsx must define a toWorld function')

  // Read 300 chars of function body
  const body = src.slice(toWorldIdx, toWorldIdx + 300)
  assert.match(
    body,
    /\/\s*s\b|\/\s*scaleRef\.current/,
    'toWorld() must divide by the scale variable (s or scaleRef.current) — missing division breaks all hit-tests under zoom',
  )
})

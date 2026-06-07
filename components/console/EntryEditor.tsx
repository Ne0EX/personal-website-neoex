/**
 * components/console/EntryEditor.tsx — Atlas Console · Kind-aware Entry Editor shell
 * ─────────────────────────────────────────────────────────────────────────────
 * The full kind-aware instrument panel. One coherent toolbar + outer chrome
 * across three entry kinds — ARTICLE (◆), PHOTO (◎), FICTION (△). Each kind
 * routes to a distinct source pane, outline rail, and preview pane.
 *
 * Build-contract: docs/design/atlas-console-full-editor.md
 *   (Betelgeuse · α-VIS-04 · signed 2026-06-07)
 *
 * STEP-1 SCOPE (Sirius · INTEGRATION step 1):
 *   - Layout frame (Direction C grid) + the unified EntryToolbar:
 *       · kind-switcher tabs (.ed-kindtab · role=tablist · FILLED-INK is-on)
 *       · 92px file-id jitter reserve (--ed-tb-file-min, always in DOM)
 *       · VIEW mode (SOURCE | PREVIEW | SPLIT) + ◈ OUTLINE toggle
 *   - ARTICLE kind LIVE: reuses the markdown ENGINE via ArticlePreview
 *     (parseMarkdown/Blocks + ArticleEntryContent — byte-identical, untouched).
 *     Source textarea + outline heading-list are trivial shell UI (re-rendered
 *     inline here, NOT the markdown engine — the engine is imported, not copied).
 *
 * STEP-2 SCOPE (Sirius · INTEGRATION step 2):
 *   - PHOTO kind LIVE: source pane = PhotoManager (empty → ImportZone), preview =
 *     PhotoPreview, outline rail = //FRAMES thumbnail strip (net-new in this shell —
 *     PhotoManager's docstring punts the strip + drag-reorder to the rail). Active
 *     frame = orange left-border 2px · click-select · native HTML drag-to-reorder ·
 *     <ul>/<li> + aria-current + arrow-key roving nav (the a11y contract PhotoManager
 *     references but does not implement). Per-kind provenance line.
 *   - FICTION kind LIVE: source pane = FictionManager, preview = FictionPreview,
 *     outline rail = //CHAPTERS (title + DRAFT/SETTLED badge, click-select, arrow-nav)
 *     + //STATE (DRAFT ⇄ SETTLED instrument switch, synced with FictionManager).
 *     Per-kind provenance line.
 *   - Kind switch is an INSTANT swap of work pane + rail + preview (no animated
 *     content transition — contract §non-goals). ARTICLE stays byte-identical.
 *   - Mock data only: MOCK_FRAMES (PhotoManager) · MOCK_FICTION_CHAPTERS /
 *     MOCK_FICTION_META (FictionManager). NOT wired to the velite content layer
 *     (PhotoFrame.exif / FictionChapter / filmSim are Procyon SCHEMA-NEEDS).
 *
 * STEP-3 SCOPE (Sirius · INTEGRATION step 3 — cross-kind surfaces WIRED):
 *   - Toolbar action triggers added (.ed-tb-action — a DISTINCT class, NOT the
 *     contract-named .ed-btn-* which ImportZone scopes under .iz-reimport and the
 *     concurrent polish pass will define globally; a distinct class avoids the
 *     equal-specificity cascade collision ImportZone warns about):
 *       · ◻ FULL PREVIEW (ghost)   → FullPreview overlay (device desktop/390px,
 *         ESC + backdrop close — all self-contained in FullPreview).
 *       · ▲ PUBLISH (ink primary)  → PublishPanel (MOCKED 3-phase: review →
 *         running [auto-advance ~2s, panel-owned timer] → done). Mounts INSIDE the
 *         active preview-wrap (position:relative + overflow:hidden) so the slide-in
 *         is bounded to the preview pane; openPublish forces SPLIT out of SOURCE-only
 *         view so a host always exists.
 *       · ↻ RE-IMPORT              → ImportZone(hasContent=true) self-renders the
 *         toolbar control (inline confirm + ESC-cancel). hasContent is KIND-AWARE
 *         (article md / photo frames / fiction chapters). The empty-state ImportZone
 *         DROP TARGET stays in the source pane (photo empty path, already wired).
 *   - FULL PREVIEW and PUBLISH are MUTUALLY EXCLUSIVE (opening one closes the other)
 *     so their ESC handlers never fight and surfaces never stack.
 *   - RE-IMPORT side effect + article/fiction import are MOCK/inert (real content
 *     layer is Peat-at-seam — contract §non-goals + live-mutating-action gate).
 *
 * Soul register: paper-observatory instrument. Dashed hairlines, mono uppercase
 * labels, NO SaaS chrome (no rounded-glass / blur / drop-shadow / spinner /
 * bright category color). is-on kind tab is filled-ink, never orange.
 *
 * Atoms / tokens (compose; do NOT edit globals.css):
 *   --console-header-height (54px) · --outline-rail-width (212px)
 *   --ed-tb-file-min (92px) · --ink-* · --paper-* · --accent-orange
 *   --accent-orange-rgb · --paper-deep-rgb
 *
 * Owner: Sirius (α-SUR-01) · atlas-console full editor · INTEGRATION step 1
 */

'use client'

import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Article, PhotoSidecar } from '@/lib/content/types'
import type {
  ArticleMeta,
  EntryKind,
  FictionChapter,
  FictionMeta,
  FictionState,
  PhotoFrame,
  PhotoMeta,
  PreviewDevice,
  PublishPhase,
} from '@/components/console/editor-types'
import { ArticlePreview } from '@/components/console/ArticlePreview'
import { SAMPLE_DRAFT, SAMPLE_MD } from '@/components/console/ArticleEditor'
import { PhotoManager, MOCK_FRAMES } from '@/components/console/PhotoManager'
import { PhotoPreview } from '@/components/console/PhotoPreview'
import {
  FictionManager,
  MOCK_FICTION_CHAPTERS,
} from '@/components/console/FictionManager'
import { FictionPreview } from '@/components/console/FictionPreview'
import { ImportZone } from '@/components/console/ImportZone'
import { FullPreview } from '@/components/console/FullPreview'
import { PublishPanel } from '@/components/console/PublishPanel'

// ─────────────────────────────────────────────────────────────────────────────
// Kind switcher canonical definitions — mirrors contract §kind state model KINDS
// Glyph is presentational (aria-hidden); label alone is the accessible name.
// ─────────────────────────────────────────────────────────────────────────────

const KINDS: ReadonlyArray<{ id: EntryKind; glyph: string; label: string }> = [
  { id: 'article', glyph: '◆', label: 'ARTICLE' },
  { id: 'photo',   glyph: '◎', label: 'PHOTO'   },
  { id: 'fiction', glyph: '△', label: 'FICTION' },
]

// ─────────────────────────────────────────────────────────────────────────────
// VIEW mode — three-way: SOURCE (source-only) · PREVIEW (preview-only) ·
// SPLIT (both). twoWork = SPLIT controls the two-1fr column sizing per contract.
// ─────────────────────────────────────────────────────────────────────────────

type ViewMode = 'source' | 'preview' | 'split'

const VIEW_MODES: ReadonlyArray<{ id: ViewMode; label: string }> = [
  { id: 'source',  label: 'SOURCE'  },
  { id: 'preview', label: 'PREVIEW' },
  { id: 'split',   label: 'SPLIT'   },
]

// ─────────────────────────────────────────────────────────────────────────────
// Editor shell + component styles — scoped <style> (project convention; like the
// existing console components). All selectors prefixed (.ed / .ed-kindtab / .src
// / .ee-*) — no globals collision, no globals edit.
//
// TOKEN-GAPs (literals with no token — forwarded to Betelgeuse):
//   - rgb(var(--accent-orange-rgb) / 0.02) source-focus tint
//   - 600px placeholder pane copy max-width
// ─────────────────────────────────────────────────────────────────────────────

const EDITOR_CSS = `
/* ── editor shell ──────────────────────────────────────────────────── */
.ed {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--paper-base);
  font-family: var(--font-mono);
  position: relative;
  overflow: hidden;
}

/* ── toolbar ───────────────────────────────────────────────────────── */
.ed-toolbar {
  flex-shrink: 0;
  min-height: var(--console-header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 16px;
  border-bottom: 1px dashed var(--ink-dashed);
}
.ed-tb-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.ed-tb-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ed-back {
  text-decoration: none;
  font-size: 9px;
  letter-spacing: 0.22em;
  color: var(--accent-orange);
  text-transform: uppercase;
  white-space: nowrap;
}
.ed-back:hover, .ed-back:focus-visible {
  color: var(--ink-primary);
  outline: none;
}
.ed-back:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}
.ed-tb-sep { color: var(--ink-faint); }

/* file-num jitter reserve — always present in the DOM (--ed-tb-file-min: 92px)
   so the kind tabs never cause layout shift on kind switch. */
.ed-tb-file {
  min-width: var(--ed-tb-file-min);
  font-size: 9px;
  letter-spacing: 0.2em;
  color: var(--ink-primary);
  text-transform: uppercase;
  white-space: nowrap;
}
.ed-tb-file .ed-tb-file-empty { color: var(--ink-faint); }

/* ── kind-switcher tabs ── .ed-kindtab · FILLED-INK is-on (NOT orange) ── */
.ed-kindtabs {
  display: flex;
  align-items: stretch;
  border: 1px solid var(--ink-hairline);
}
.ed-kindtab {
  appearance: none;
  background: transparent;
  border: 1px solid transparent;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.15em;
  color: var(--ink-soft);
  padding: 8px 12px;
  cursor: pointer;
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  transition: color 120ms ease, background 120ms ease;
}
.ed-kindtab + .ed-kindtab { border-left: 1px solid var(--ink-hairline); }
.ed-kindtab:hover:not(.is-on) { color: var(--ink-primary); }
.ed-kindtab.is-on {
  background: var(--ink-primary);
  color: var(--paper-base);
}
.ed-kindtab:focus-visible {
  outline: none;
  border-color: var(--ink-primary);
  outline: 1px solid var(--ink-primary);
  outline-offset: 2px;
}
.ed-kindtab-glyph { font-size: 11px; line-height: 1; }

/* ── outline toggle (orange-active srctoggle atom pattern) ── */
.ed-srctoggle {
  appearance: none;
  background: transparent;
  border: 1px solid var(--ink-hairline);
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: 0.18em;
  color: var(--ink-soft);
  padding: 8px 11px;
  cursor: pointer;
  text-transform: uppercase;
  white-space: nowrap;
}
.ed-srctoggle.is-on {
  background: var(--accent-orange);
  border-color: var(--accent-orange);
  color: var(--paper-bright);
}
.ed-srctoggle:hover:not(.is-on),
.ed-srctoggle:focus-visible:not(.is-on) {
  border-color: var(--accent-orange);
  color: var(--accent-orange);
  outline: none;
}
.ed-srctoggle:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}

/* ── toolbar action triggers — ◻ FULL PREVIEW · ▲ PUBLISH ──────────────────────
   DISTINCT class (.ed-tb-action), NOT the contract-named .ed-btn-primary/.ed-btn-
   ghost. Those are scoped by ImportZone under .iz-reimport, and the concurrent
   polish pass will define the canonical GLOBAL .ed-btn-* in ArticleEditor.tsx.
   Emitting a global (or even an equal-specificity .ed-toolbar .ed-btn-ghost) here
   would tie with .iz-reimport's rules → nondeterministic source-order cascade
   (the flicker ImportZone explicitly warns about). A distinct class side-steps it.

   Visual mapping (contract §soul anchoring + drift-correction row 3):
     ghost  (default)    → ◻ FULL PREVIEW  (dashed, ink-faint → orange on hover)
     primary (.is-primary) → ▲ PUBLISH     (ink-filled, paper text — like .ed-mode.is-on;
                              the prototype's orange-outline publish is the SaaS drift
                              the contract corrects to the canonical instrument primary). */
.ed-tb-action {
  appearance: none;
  background: transparent;
  border: 1px dashed var(--ink-dashed);
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: 0.18em;
  color: var(--ink-faint);
  padding: 8px 12px;
  cursor: pointer;
  text-transform: uppercase;
  white-space: nowrap;
  transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
}
.ed-tb-action:hover:not(.is-primary),
.ed-tb-action:focus-visible:not(.is-primary) {
  border-color: var(--accent-orange);
  color: var(--ink-primary);
  outline: none;
}
.ed-tb-action.is-primary {
  background: var(--ink-primary);
  border: 1px solid var(--ink-primary);
  color: var(--paper-base);
}
.ed-tb-action.is-primary:hover,
.ed-tb-action.is-primary:focus-visible {
  background: var(--accent-orange);
  border-color: var(--accent-orange);
  color: var(--paper-bright);
  outline: none;
}
.ed-tb-action:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}

/* ── VIEW mode toggle (SOURCE | PREVIEW | SPLIT) — filled-ink active ── */
.ed-modes { display: flex; border: 1px solid var(--ink-hairline); }
.ed-mode {
  appearance: none;
  background: transparent;
  border: none;
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: 0.18em;
  color: var(--ink-soft);
  padding: 8px 12px;
  cursor: pointer;
  text-transform: uppercase;
}
.ed-mode + .ed-mode { border-left: 1px solid var(--ink-hairline); }
.ed-mode.is-on { background: var(--ink-primary); color: var(--paper-base); }
.ed-mode:focus-visible { outline: 1px dashed var(--accent-orange); outline-offset: 2px; }

/* ── pane grid ─────────────────────────────────────────────────────── */
.ed-3pane {
  flex: 1;
  display: grid;
  min-height: 0;
  overflow: hidden;
}
.ed-3pane > * { min-height: 0; min-width: 0; }
.ed-preview-wrap {
  /* position:relative + overflow:hidden bound the PublishPanel slide-in to THIS
     pane: .pub is position:absolute inset:0 and expects a position:relative host
     that bounds the preview pane (its docstring). The nearest positioned ancestor
     would otherwise be .ed (the whole editor), so the panel would cover the toolbar
     + source pane too. overflow:hidden also clips .pub's off-screen translateX(100%)
     start so the slide reads as entering from the right edge of the preview pane. */
  position: relative;
  min-height: 0;
  overflow: hidden;
  background: var(--paper-base);
}

/* ── source pane ───────────────────────────────────────────────────── */
.src-pane {
  display: flex;
  flex-direction: column;
  border-right: 1px dashed var(--ink-dashed);
  min-height: 0;
  background: var(--paper-base);
}
.src-head {
  flex-shrink: 0;
  font-size: 8px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--ink-faint);
  padding: 11px 14px 8px;
  display: flex;
  justify-content: space-between;
}
.src-count { color: var(--ink-faint); }
.src-text {
  flex: 1;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.9;
  letter-spacing: 0.01em;
  color: var(--ink-primary);
  padding: 0 14px 16px;
  min-height: 0;
  overflow-y: auto;
}
.src-text:focus { background: rgb(var(--accent-orange-rgb) / 0.02); }

/* ── outline rail ──────────────────────────────────────────────────── */
.ed-rail {
  border-right: 1px dashed var(--ink-dashed);
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 18px;
  overflow-y: auto;
  min-height: 0;
  background: var(--paper-warm);
}
.rail-head {
  font-size: 9px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--ink-faint);
  margin-bottom: 9px;
}
.outline-empty { font-size: 9px; color: var(--ink-faint); font-style: italic; }
.outline-row {
  appearance: none;
  background: transparent;
  border: none;
  text-align: left;
  width: 100%;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-primary);
  padding: 4px 0;
  cursor: pointer;
}
.outline-row.lvl3 { padding-left: 14px; color: var(--ink-soft); font-size: 10px; }
.outline-tick { color: var(--accent-orange); }
.outline-row:hover { color: var(--accent-orange); }
.outline-row:focus-visible { outline: 1px dashed var(--accent-orange); outline-offset: 2px; }
.ed-rail-prov {
  font-family: var(--font-type);
  font-size: 9px;
  color: var(--ink-soft);
  letter-spacing: 0.04em;
}

/* ── provenance line ───────────────────────────────────────────────── */
.ed-prov {
  flex-shrink: 0;
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ink-faint);
  padding: 7px 16px;
  border-top: 1px dashed var(--ink-dashed);
}
.ed-prov b { color: var(--ink-soft); }

/* ── PHOTO preview wrapper — suppress PhotoPreview's OWN provenance line ──────
   PhotoPreview always renders an internal .ppv-prov (correct standalone). Inside
   the editor 3-pane the shell renders .ed-prov per-kind, so the photo preview's
   inner line would DOUBLE. Scope-hide it here only (the component is untouched and
   keeps its line everywhere else, e.g. inside FullPreview). Advisor flag #2. */
.ed-preview-wrap .ppv-prov { display: none; }

/* ── //FRAMES rail — photo thumbnail strip (NET-NEW in this shell) ─────────────
   PhotoManager punts the strip + drag-reorder to the rail (its docstring). This is
   the rail UI: vertical thumb list, active = orange left-border 2px, click-select,
   native HTML drag-to-reorder, <ul>/<li> + aria-current + arrow-key roving nav. */
.fr-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fr-item {
  appearance: none;
  width: 100%;
  text-align: left;
  background: transparent;
  border: 1px dashed var(--ink-dashed);
  border-left: 2px solid transparent;
  font-family: var(--font-mono);
  cursor: pointer;
  padding: 8px 9px;
  display: flex;
  align-items: center;
  gap: 9px;
  transition: border-color 120ms ease, color 120ms ease;
}
.fr-item:hover:not(.is-on),
.fr-item:focus-visible:not(.is-on) {
  border-color: var(--accent-orange);
  outline: none;
}
.fr-item:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}
/* active frame — orange left-border 2px (contract §per-kind PHOTO outline rail) */
.fr-item.is-on {
  border-color: var(--ink-dashed);
  border-left-color: var(--accent-orange);
}
.fr-item.is-dragging { opacity: 0.4; }
.fr-thumb {
  flex-shrink: 0;
  width: 34px;
  height: 24px;
  border: 1px dashed var(--ink-hairline);
  background: var(--paper-base);
  display: grid;
  place-items: center;
  font-size: 11px;
  line-height: 1;
  color: var(--ink-soft);
}
.fr-meta { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.fr-id {
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fr-sim {
  font-size: 8px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── //CHAPTERS rail — fiction chapter list ───────────────────────────────── */
.ch-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ch-item {
  appearance: none;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  border-left: 2px solid transparent;
  font-family: var(--font-mono);
  cursor: pointer;
  padding: 5px 0 5px 9px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  color: var(--ink-primary);
  font-size: 11px;
  letter-spacing: 0.08em;
}
.ch-item:hover:not(.is-on) { color: var(--accent-orange); }
.ch-item.is-on { border-left-color: var(--accent-orange); }
.ch-item:focus-visible { outline: 1px dashed var(--accent-orange); outline-offset: 2px; }
.ch-title {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* state badge — DRAFT = ink-faint, SETTLED = ink-primary (contract //CHAPTERS) */
.ch-badge {
  flex-shrink: 0;
  font-size: 7.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.ch-badge.is-draft   { color: var(--ink-faint); }
.ch-badge.is-settled { color: var(--ink-primary); }

/* ── //STATE rail — DRAFT ⇄ SETTLED instrument switch ─────────────────────────
   Two labels flanking a ⇄ glyph; active filled-ink, inactive ink-faint (contract
   §per-kind FICTION outline rail). Mirrors FictionManager's inline switch; both
   read/write the SAME active-chapter state in the lifted store. */
.st-switch {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--ink-hairline);
}
.st-btn {
  appearance: none;
  background: transparent;
  border: none;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  color: var(--ink-faint);
  padding: 7px 11px;
  cursor: pointer;
  text-transform: uppercase;
  transition: background 120ms ease, color 120ms ease;
}
.st-btn.is-on { background: var(--ink-primary); color: var(--paper-base); }
.st-btn:focus-visible { outline: 1px dashed var(--accent-orange); outline-offset: 2px; }
.st-glyph {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-faint);
  padding: 0 6px;
  user-select: none;
}
.st-empty { font-size: 9px; color: var(--ink-faint); font-style: italic; }

@media (prefers-reduced-motion: reduce) {
  .fr-item, .st-btn, .ed-tb-action { transition: none; }
}
@media (pointer: coarse) {
  .st-btn { padding: 12px 14px; }
}

/* ── breakpoints ───────────────────────────────────────────────────── */
/* ≤880px: outline rail + twoWork are collapsed via matchMedia-driven state in
   the component (not CSS grid media queries). State-driven keeps React pane
   conditionals in sync with gridCols — CSS-only would desync the column count
   from the number of rendered children. See FIX 1 (Algol REVISE) useEffect. */

/* ≤600px: source pane is full viewport width — guaranteed because the 1-col
   grid (from ≤880 state) fills the full width. No extra rule needed.
   Provenance line wraps: .ed-prov has no white-space:nowrap, so it wraps
   naturally. Touch targets already ≥44px. Kind-tab label-hide is active below. */
@media (max-width: 600px) {
  .ed-kindtab-label { display: none; }   /* glyphs only; aria-label carries name */
  .ed-kindtab { padding: 8px 11px; }
  /* Provenance line — explicit two-row insurance (avoid any overflow truncation) */
  .ed-prov {
    white-space: normal;
    flex-wrap: wrap;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ed-kindtab { transition-duration: 0.001ms; }
}
`

// ─────────────────────────────────────────────────────────────────────────────
// EntryToolbar — kind switcher + file-num reserve + VIEW + OUTLINE + cross-kind
// action triggers (RE-IMPORT · ◻ FULL PREVIEW · ▲ PUBLISH).
//
// STEP-3 (Sirius · INTEGRATION step 3): the cross-kind surfaces are now wired:
//   - ◻ FULL PREVIEW (.ed-tb-action ghost) → opens the FullPreview overlay.
//   - ▲ PUBLISH (.ed-tb-action.is-primary) → opens the mocked PublishPanel.
//   - RE-IMPORT: when the editor HAS content, ImportZone(hasContent) renders its
//     self-styled ↻ RE-IMPORT toolbar control (inline confirm + ESC-cancel, all
//     built inside ImportZone). The empty-state ImportZone drop target lives in
//     the source pane (per-kind), NOT here. `hasContent` is KIND-AWARE.
//
// Label note: the overlay trigger is labeled "◻ FULL PREVIEW" (not "PREVIEW")
// because the VIEW toggle already has a "PREVIEW" mode button — avoid collision.
// ─────────────────────────────────────────────────────────────────────────────

interface EntryToolbarProps {
  kind:        EntryKind
  onKind:      (k: EntryKind) => void
  fileNum:     string | null
  view:        ViewMode
  onView:      (v: ViewMode) => void
  outlineOpen: boolean
  onOutline:   () => void
  /** Kind-aware: editor currently has content (md / frames / chapters). */
  hasContent:  boolean
  /** RE-IMPORT confirm seam (MOCK — content layer is Peat-at-seam). */
  onReImport:  () => void
  /** RE-IMPORT file pick seam (MOCK — caller reads the File). */
  onImport:    (file: File) => void
  /** Open the FullPreview overlay. */
  onFullPreview: () => void
  /** Open the mocked PublishPanel. */
  onPublish:   () => void
}

function EntryToolbar({
  kind, onKind, fileNum, view, onView, outlineOpen, onOutline,
  hasContent, onReImport, onImport, onFullPreview, onPublish,
}: EntryToolbarProps) {
  return (
    <div className="ed-toolbar">
      <div className="ed-tb-left">
        <a
          className="ed-back"
          href="/console"
          title="back to the console"
          aria-label="back to console"
        >
          ⟵ CONSOLE
        </a>
        <span className="ed-tb-sep" aria-hidden>·</span>

        {/* Kind-switcher tabs — FILLED-INK is-on (canonical DS state, NOT orange) */}
        <div className="ed-kindtabs" role="tablist" aria-label="Entry kind">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="tab"
              aria-selected={kind === k.id}
              aria-label={k.label}
              className={'ed-kindtab' + (kind === k.id ? ' is-on' : '')}
              onClick={() => onKind(k.id)}
            >
              <span className="ed-kindtab-glyph" aria-hidden>{k.glyph}</span>
              <span className="ed-kindtab-label">{k.label}</span>
            </button>
          ))}
        </div>

        {/* File-num jitter reserve — 92px cell always present (empty when no entry) */}
        <span className="ed-tb-file">
          {fileNum
            ? `FILE ${fileNum}`
            : <span className="ed-tb-file-empty">FILE ···</span>}
        </span>
      </div>

      <div className="ed-tb-right">
        {/* Outline toggle — orange-active srctoggle atom */}
        <button
          type="button"
          className={'ed-srctoggle' + (outlineOpen ? ' is-on' : '')}
          onClick={onOutline}
          aria-pressed={outlineOpen}
          title={outlineOpen ? 'hide outline rail' : 'show outline rail'}
        >
          ◈ OUTLINE
        </button>

        {/* VIEW mode — SOURCE | PREVIEW | SPLIT */}
        <div className="ed-modes" role="group" aria-label="View mode">
          {VIEW_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={view === m.id}
              className={'ed-mode' + (view === m.id ? ' is-on' : '')}
              onClick={() => onView(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* ↻ RE-IMPORT — ImportZone(hasContent) self-renders the toolbar control
            (inline confirm + ESC-cancel built inside). When the editor is empty
            the source pane shows the ImportZone DROP TARGET instead; this control
            only appears when there IS content to replace. */}
        {hasContent && (
          <ImportZone
            onImport={onImport}
            hasContent
            onReImport={onReImport}
          />
        )}

        {/* ◻ FULL PREVIEW — ghost trigger → FullPreview overlay */}
        <button
          type="button"
          className="ed-tb-action"
          onClick={onFullPreview}
          title="full preview — how it reads on the site"
        >
          ◻ FULL PREVIEW
        </button>

        {/* ▲ PUBLISH — primary trigger → mocked PublishPanel */}
        <button
          type="button"
          className="ed-tb-action is-primary"
          onClick={onPublish}
          title="transmit sequence (mocked)"
        >
          ▲ PUBLISH
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ArticleOutline — //OUTLINE heading rail (H2 / H3 list extracted from md).
// Click-to-scroll is best-effort: the preview heading [id]s are not guaranteed
// (slice-1 shipped display-only). Render the rail per contract; scroll if the
// target exists in the preview pane, else no-op.
// ─────────────────────────────────────────────────────────────────────────────

interface ArticleOutlineProps {
  md:           string
  fileNum:      string
  previewRefId: string
}

function ArticleOutline({ md, fileNum, previewRefId }: ArticleOutlineProps) {
  const heads = useMemo(
    () =>
      (md || '')
        .split('\n')
        .filter((l) => /^#{2,3} /.test(l))
        .map((l) => {
          const lvl = (l.match(/^#+/) as RegExpMatchArray)[0].length
          const text = l.replace(/^#+ /, '')
          return { lvl, text }
        }),
    [md],
  )

  // Best-effort scroll: slugify heading → look for a matching [id] in the preview.
  const scrollToHeading = (text: string) => {
    const slug = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
    const root = document.getElementById(previewRefId)
    const target = root?.querySelector(`#${CSS.escape(slug)}`)
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <aside className="ed-rail" aria-label="document outline">
      <div>
        <div className="rail-head">// OUTLINE</div>
        {heads.length === 0 && (
          <div className="outline-empty" aria-live="polite">no headings yet</div>
        )}
        {heads.map((h, i) => (
          <button
            key={i}
            type="button"
            className={'outline-row lvl' + h.lvl}
            onClick={() => scrollToHeading(h.text)}
          >
            <span className="outline-tick" aria-hidden>§</span>{' '}
            {h.text}
          </button>
        ))}
      </div>

      <div>
        <div className="rail-head">// SOURCE</div>
        <div className="ed-rail-prov">{fileNum}</div>
      </div>
    </aside>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ArticleSourcePane — markdown textarea (trivial shell UI; engine is imported)
// ─────────────────────────────────────────────────────────────────────────────

interface ArticleSourcePaneProps {
  md:       string
  onChange: (v: string) => void
}

function ArticleSourcePane({ md, onChange }: ArticleSourcePaneProps) {
  return (
    <div className="src-pane">
      <div className="src-head">
        <span>MARKDOWN · SOURCE</span>
        <span className="src-count">{md.length} CH</span>
      </div>
      <textarea
        className="src-text"
        value={md}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        aria-label="markdown source editor"
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FramesRail — //FRAMES outline rail (NET-NEW: PhotoManager punts the strip here).
//
// Vertical frame thumbnail list. Active frame = orange left-border (2px). Click
// selects (setActive). Native HTML drag-and-drop reorder (no external library).
// A11y (contract §screen reader): <ul aria-label="Photo frames">, each <li>;
// active frame aria-current="true". Arrow keys roving-navigate when focused.
// ─────────────────────────────────────────────────────────────────────────────

interface FramesRailProps {
  frames:    PhotoFrame[]
  active:    string | null
  setActive: (id: string) => void
  setFrames: (frames: PhotoFrame[]) => void
}

function FramesRail({ frames, active, setActive, setFrames }: FramesRailProps) {
  const dragIdx = useRef<number | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)

  const activeIdx = useMemo(() => {
    const i = frames.findIndex((f) => f.id === active)
    return i >= 0 ? i : 0
  }, [frames, active])

  // Native HTML drag-to-reorder — move the dragged frame to the drop index.
  const onDrop = (to: number) => {
    const from = dragIdx.current
    dragIdx.current = null
    setDragging(null)
    if (from === null || from === to) return
    const next = frames.slice()
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setFrames(next)
  }

  // Arrow-key roving navigation across the frame strip (contract keyboard map).
  const onKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (frames.length === 0) return
    let next = -1
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (activeIdx + 1) % frames.length
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (activeIdx - 1 + frames.length) % frames.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = frames.length - 1
    if (next >= 0 && next !== activeIdx) {
      e.preventDefault()
      setActive(frames[next].id)
    }
  }

  return (
    <aside className="ed-rail" aria-label="photo frames outline">
      <div>
        <div className="rail-head">// FRAMES</div>
        {frames.length === 0 ? (
          <div className="outline-empty">no frames yet</div>
        ) : (
          <ul className="fr-list" aria-label="Photo frames" onKeyDown={onKeyDown}>
            {frames.map((f, i) => {
              const on = f.id === frames[activeIdx]?.id
              return (
                <li key={f.id} aria-current={on ? true : undefined}>
                  <button
                    type="button"
                    className={
                      'fr-item' +
                      (on ? ' is-on' : '') +
                      (dragging === i ? ' is-dragging' : '')
                    }
                    tabIndex={on ? 0 : -1}
                    onClick={() => setActive(f.id)}
                    draggable
                    onDragStart={() => { dragIdx.current = i; setDragging(i) }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDrop(i)}
                    onDragEnd={() => { dragIdx.current = null; setDragging(null) }}
                  >
                    <span className="fr-thumb" aria-hidden>◎</span>
                    <span className="fr-meta">
                      <span className="fr-id">{f.id}</span>
                      {f.filmSim && (
                        <span className="fr-sim">{f.filmSim}</span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ChaptersRail — //CHAPTERS + //STATE outline rail for FICTION.
//
// //CHAPTERS: chapter list (title + state badge: DRAFT ink-faint / SETTLED
//   ink-primary). Click selects (setActive). Arrow keys roving-navigate.
// //STATE: current chapter DRAFT ⇄ SETTLED instrument switch (two labels flanking
//   a ⇄ glyph, active filled-ink). Writes the active chapter's state — kept in
//   sync with FictionManager's inline switch (both read the same lifted store).
// ─────────────────────────────────────────────────────────────────────────────

interface ChaptersRailProps {
  chapters:    FictionChapter[]
  active:      string | null
  setActive:   (id: string) => void
  setChapters: (chapters: FictionChapter[]) => void
}

function ChaptersRail({ chapters, active, setActive, setChapters }: ChaptersRailProps) {
  const ch = chapters.find((c) => c.id === active) ?? chapters[0] ?? null

  const setState = (state: FictionState) => {
    if (!ch) return
    setChapters(chapters.map((c) => (c.id === ch.id ? { ...c, state } : c)))
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (!ch || chapters.length === 0) return
    const cur = chapters.findIndex((c) => c.id === ch.id)
    let next = -1
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (cur + 1) % chapters.length
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (cur - 1 + chapters.length) % chapters.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = chapters.length - 1
    if (next >= 0 && next !== cur) {
      e.preventDefault()
      setActive(chapters[next].id)
    }
  }

  return (
    <aside className="ed-rail" aria-label="fiction chapters outline">
      <div>
        <div className="rail-head">// CHAPTERS</div>
        {chapters.length === 0 ? (
          <div className="outline-empty">no chapters yet</div>
        ) : (
          <ul className="ch-list" aria-label="Chapters" onKeyDown={onKeyDown}>
            {chapters.map((c) => {
              const on = c.id === (ch?.id ?? null)
              return (
                <li key={c.id} aria-current={on ? true : undefined}>
                  <button
                    type="button"
                    className={'ch-item' + (on ? ' is-on' : '')}
                    tabIndex={on ? 0 : -1}
                    onClick={() => setActive(c.id)}
                  >
                    <span className="ch-title">{c.title}</span>
                    <span
                      className={
                        'ch-badge ' + (c.state === 'draft' ? 'is-draft' : 'is-settled')
                      }
                    >
                      {c.state === 'draft' ? 'DRAFT' : 'SETTLED'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div>
        <div className="rail-head">// STATE</div>
        {!ch ? (
          <div className="st-empty">— no active chapter —</div>
        ) : (
          <div className="st-switch" role="group" aria-label="chapter state">
            <button
              type="button"
              className={'st-btn' + (ch.state === 'draft' ? ' is-on' : '')}
              aria-pressed={ch.state === 'draft'}
              onClick={() => setState('draft')}
            >
              DRAFT
            </button>
            <span className="st-glyph" aria-hidden>⇄</span>
            <button
              type="button"
              className={'st-btn' + (ch.state === 'settled' ? ' is-on' : '')}
              aria-pressed={ch.state === 'settled'}
              onClick={() => setState('settled')}
            >
              SETTLED
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EntryEditor props
// ─────────────────────────────────────────────────────────────────────────────

interface EntryEditorProps {
  /**
   * Pre-filled draft from velite metadata (tier-b: metadata only).
   * Article-shaped (fiction/photo mapped to Article shape in the route page with
   * safe defaults for Article-only fields). Falls back to SAMPLE_DRAFT when absent.
   */
  initialDraft?: Article
  /**
   * Semantic kind from the URL searchParams (?kind=…). Seeds the top-level kind
   * state (default kind). Defaults to 'article' when absent / unrecognized.
   */
  kind?: EntryKind
  /**
   * REAL velite PhotoSidecar loaded by the route (?kind=photo&slug=roll/id).
   * When present, the in-pane PHOTO preview reuses the REAL <PhotoEntry> +
   * working FilmSimSwitcher (the public photo page). Plain serializable object
   * (velite JSON) → safe across the RSC→client boundary. Absent → PhotoPreview
   * falls back to its MOCK styled-slot path (graceful, no crash).
   *
   * NOTE: the source pane + //FRAMES rail stay on MOCK frames this slice
   * (read-only build; no curation/save). The WIN is a REAL preview — the
   * preview-real / source-mock split is intentional for this slice.
   */
  initialPhoto?: PhotoSidecar
  /** Zero-based index of `initialPhoto` within its roll (default 0). */
  photoSequenceIndex?: number
  /** Total photos in `initialPhoto`'s roll (default 1). */
  photoRollTotal?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// EntryEditor — kind-aware instrument panel (Direction C frame)
// ─────────────────────────────────────────────────────────────────────────────

export function EntryEditor({
  initialDraft,
  kind: initialKind,
  initialPhoto,
  photoSequenceIndex = 0,
  photoRollTotal = 1,
}: EntryEditorProps = {}) {
  const draft = initialDraft ?? SAMPLE_DRAFT

  // Top-level kind state — default from URL ?kind. Kind is a view mode, not a
  // stored field on the entry (contract §kind state model).
  const [kind, setKind] = useState<EntryKind>(initialKind ?? 'article')

  // ARTICLE source body — seeded from SAMPLE_MD (import zone is step 2).
  const [md, setMd] = useState<string>(SAMPLE_MD)

  // PHOTO state — frames + active frame, lifted into the shell so the //FRAMES
  // rail, PhotoManager, and PhotoPreview share one store. Mock-seeded (NOT velite-
  // wired): PhotoFrame.exif / filmSim are Procyon SCHEMA-NEEDS.
  const [frames, setFrames] = useState<PhotoFrame[]>(MOCK_FRAMES)
  const [activeFrame, setActiveFrame] = useState<string | null>(
    MOCK_FRAMES[0]?.id ?? null,
  )

  // FICTION state — chapters + active chapter, lifted into the shell so the
  // //CHAPTERS/​//STATE rail, FictionManager, and FictionPreview share one store.
  // Mock-seeded (NOT velite-wired): FictionChapter is Procyon SCHEMA-NEEDS.
  const [chapters, setChapters] = useState<FictionChapter[]>(MOCK_FICTION_CHAPTERS)
  const [activeChapter, setActiveChapter] = useState<string | null>(
    MOCK_FICTION_CHAPTERS[0]?.id ?? null,
  )

  // Hidden file input for PhotoManager's `+ ADD FRAME` (the contract states the
  // CALLER owns the input ref for onAdd; ImportZone owns its own input).
  const frameInputRef = useRef<HTMLInputElement>(null)

  // VIEW mode + outline rail toggle.
  // Default: desktop-wide — outline open + split view. Reconciled against the
  // actual viewport in the useEffect below (SSR-safe: initial value matches
  // server render; client corrects after hydration so no mismatch).
  const [view, setView] = useState<ViewMode>('split')
  const [outlineOpen, setOutline] = useState<boolean>(true)

  // ── Responsive breakpoint — FIX 1 (Algol REVISE) ─────────────────────────
  // ≤880px: outline rail closed by default + twoWork suppressed (source-only).
  // State-driven (not CSS-only) so the pane conditional renders stay in sync
  // with gridCols (CSS grid + React children must agree on column count).
  // SSR-safe: matchMedia is client-only. Initial state = desktop defaults above;
  // useEffect reconciles after first render with no hydration mismatch.
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 880px)')
    function apply(narrow: boolean) {
      if (narrow) {
        // Collapse outline rail + suppress preview pane (source-only).
        setOutline(false)
        setView((v) => (v === 'split' ? 'source' : v))
      } else {
        // Restore desktop defaults when crossing back above 880px.
        // NOTE: intentionally resets a manual outline-collapse on resize —
        // breakpoint-driven layout resets are standard editor behaviour.
        setOutline(true)
        setView((v) => (v === 'source' ? 'split' : v))
      }
    }
    // Reconcile on mount.
    apply(mql.matches)
    const onChange = (e: MediaQueryListEvent) => apply(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty — fires once to set up the listener

  // ── Cross-kind surfaces (INTEGRATION step 3) ──────────────────────────────
  // FullPreview overlay: open + device viewport (desktop / 390px mobile).
  const [fullPreviewOpen, setFullPreviewOpen] = useState<boolean>(false)
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop')

  // PublishPanel (MOCKED): open + phase. The panel self-advances running→done
  // after 2s via onPhaseChange (its own timer) — we hold `phase` and let its
  // callback drive it; we do NOT add a second timer.
  const [publishOpen, setPublishOpen] = useState<boolean>(false)
  const [publishPhase, setPublishPhase] = useState<PublishPhase>('review')

  // Mutually-exclusive surfaces: opening one closes the other so their ESC
  // handlers never fight and a slide-panel is never stacked under a full overlay.
  const openFullPreview = useCallback(() => {
    setPublishOpen(false)
    setPreviewDevice('desktop')
    setFullPreviewOpen(true)
  }, [])
  const openPublish = useCallback(() => {
    setFullPreviewOpen(false)
    setPublishPhase('review')
    // PublishPanel mounts inside the preview pane; in SOURCE-only view there is
    // no preview-wrap to host it. Force SPLIT so the panel has a bounded host
    // (and the source pane stays visible alongside it — exactly the contract).
    setView((v) => (v === 'source' ? 'split' : v))
    setPublishOpen(true)
  }, [])

  const twoWork = view === 'split'

  // Grid columns — contract §layout grid formula.
  const gridCols = useMemo<string>(() => {
    if (outlineOpen) {
      return twoWork
        ? 'var(--outline-rail-width) 1fr 1fr'
        : 'var(--outline-rail-width) 1fr'
    }
    return twoWork ? '1fr 1fr' : '1fr'
  }, [outlineOpen, twoWork])

  // Article word count — for the provenance line.
  const wordCount = useMemo<number>(
    () => (md.trim() ? md.trim().split(/\s+/).length : 0),
    [md],
  )

  // Per-kind metas — derived from the single `draft` so the rail, preview, shell
  // provenance, and previews all agree on ONE fileNum (advisor flag #3). Mock
  // CONTENT (frames/chapters) comes from MOCK_*; the META identity tracks `draft`.
  //
  // ArticleMeta — contract shape for the cross-kind surfaces (FullPreview /
  // PublishPanel both take `meta: ArticleMeta | PhotoMeta | FictionMeta`). We
  // hold a full velite `Article`; map it to the contract's ArticleMeta here.
  // NOTE(issues_for_integrator): FullPreview re-derives an Article from this
  // ArticleMeta internally (domain → 'method', summary → title), so the
  // FULL-PREVIEW article render loses domain/summary fidelity vs the in-pane
  // ArticlePreview (which gets the real `draft`). Acceptable for a mock surface.
  const articleMeta = useMemo<ArticleMeta>(
    () => ({
      fileNum:  draft.fileNum,
      title:    draft.title,
      date:     draft.isoDate,
      coords:   draft.coords,
      tags:     draft.tags,
      status:   draft.status,
      readMin:  draft.readingTime,
    }),
    [draft.fileNum, draft.title, draft.isoDate, draft.coords, draft.tags, draft.status, draft.readingTime],
  )
  const photoMeta = useMemo<PhotoMeta>(
    () => ({
      fileNum: draft.fileNum,
      title:   draft.title,
      date:    draft.isoDate,
      place:   draft.coords?.place || undefined,
      tags:    draft.tags,
    }),
    [draft.fileNum, draft.title, draft.isoDate, draft.coords?.place, draft.tags],
  )
  const fictionMeta = useMemo<FictionMeta>(
    () => ({
      fileNum: draft.fileNum,
      title:   draft.title,
      date:    draft.isoDate,
      tags:    draft.tags,
    }),
    [draft.fileNum, draft.title, draft.isoDate, draft.tags],
  )

  // Active-chapter state for the fiction provenance line (`… · {active.state}`).
  const activeChapterState = useMemo<FictionState | null>(() => {
    const ch = chapters.find((c) => c.id === activeChapter) ?? chapters[0]
    return ch?.state ?? null
  }, [chapters, activeChapter])

  // Kind-aware "has content" — drives the toolbar's RE-IMPORT control (article:
  // md non-empty · photo: frames present · fiction: chapters present). When false,
  // the source pane shows the ImportZone DROP TARGET instead of the RE-IMPORT
  // control. ARTICLE seeds with SAMPLE_MD so it is effectively always content-full.
  // TODO(real-content): no-entry empty shell per §states — when no article body,
  // frames, or chapters are loaded, show ImportZone only (no toolbar controls).
  // Belongs to the real-content wiring round; mock seeding keeps this branch live.
  const hasContent = useMemo<boolean>(() => {
    if (kind === 'article') return md.trim() !== ''
    if (kind === 'photo') return frames.length > 0
    return chapters.length > 0
  }, [kind, md, frames.length, chapters.length])

  // Active id forwarded to the cross-kind surfaces (frame.id for photo, chapter.id
  // for fiction; article has no active id).
  const activeId = kind === 'photo' ? activeFrame : kind === 'fiction' ? activeChapter : null

  // The contract-shaped union meta for FullPreview / PublishPanel, by kind.
  const surfaceMeta: ArticleMeta | PhotoMeta | FictionMeta =
    kind === 'photo' ? photoMeta : kind === 'fiction' ? fictionMeta : articleMeta

  // RE-IMPORT confirm — MOCK only (real content-layer wiring is Peat-at-seam,
  // contract §non-goals + live-mutating-action gate). No-op placeholder seam:
  // the inline confirm UX is fully exercised by ImportZone; the side effect is
  // intentionally inert this round.
  const onReImport = useCallback(() => {
    // MOCK: real re-import (re-read source from disk) is deferred. Inert.
  }, [])

  // Add a mock frame — single seam for BOTH ImportZone.onImport (empty state) and
  // PhotoManager.onAdd (+ ADD FRAME). The styled-slot previews render no <img>, so
  // an objectURL src never 404s; it's retained for future real-image wiring.
  const addFrame = useCallback((file?: File) => {
    const id = 'DSCF' + String(Date.now()).slice(-4)
    const src = file ? URL.createObjectURL(file) : `/_mock/${id.toLowerCase()}.jpg`
    const next: PhotoFrame = file
      ? { id, src, caption: file.name }
      : { id, src, caption: 'a new frame, not yet developed' }
    setFrames((fs) => [...fs, next])
    setActiveFrame(id)
  }, [])

  // RE-IMPORT file pick — MOCK. For photo we append a real frame (the addFrame
  // seam); for article/fiction this round is inert (no file-body ingest yet —
  // velite has no body field, Procyon SCHEMA-NEEDS).
  const onImportFile = useCallback(
    (file: File) => {
      if (kind === 'photo') addFrame(file)
      // article / fiction: inert MOCK (no file-body ingest this slice).
    },
    [kind, addFrame],
  )

  // Provenance line per kind (all three LIVE; fiction + article delegate their line
  // to this shell row, photo's own .ppv-prov is scope-hidden — advisor flag #2).
  const provenance = useMemo(() => {
    if (kind === 'article') {
      return (
        <>
          SOURCE: <b>{draft.fileNum}</b> · LAST EDIT: <b>{draft.date}</b> ·{' '}
          <b>{wordCount}</b> WORDS
        </>
      )
    }
    if (kind === 'photo') {
      return (
        <>
          SOURCE: <b>{draft.fileNum}</b> · <b>{frames.length}</b> FRAMES
          {photoMeta.place ? (
            <>
              {' '}
              · <b>{photoMeta.place}</b>
            </>
          ) : null}
        </>
      )
    }
    return (
      <>
        SOURCE: <b>{draft.fileNum}</b> · <b>{chapters.length}</b> CHAPTERS ·{' '}
        <b>{(activeChapterState ?? 'draft').toUpperCase()}</b>
      </>
    )
  }, [
    kind, draft.fileNum, draft.date, wordCount,
    frames.length, photoMeta.place, chapters.length, activeChapterState,
  ])

  // Whether the source pane is shown (SOURCE / SPLIT) vs preview-only (PREVIEW).
  const showSource = view === 'source' || view === 'split'
  const showPreview = view === 'preview' || view === 'split'

  // PublishPanel (MOCKED) — mounts INSIDE the active preview-wrap (which is
  // position:relative + overflow:hidden) so the slide-in is bounded to the
  // preview pane and the source pane stays visible. One node, injected into
  // whichever kind's preview-wrap is rendered (openPublish forces SPLIT out of
  // SOURCE-only view, so a preview-wrap always exists when publishOpen). The
  // panel self-advances running→done after 2s via onPhaseChange — we only hold
  // the phase; no second timer here.
  const publishPanelNode = publishOpen ? (
    <PublishPanel
      kind={kind}
      meta={surfaceMeta}
      status={draft.status}
      fictionState={activeChapterState ?? undefined}
      frames={frames}
      chapters={chapters}
      phase={publishPhase}
      onPhaseChange={setPublishPhase}
      onClose={() => setPublishOpen(false)}
    />
  ) : null

  return (
    <>
      <style>{EDITOR_CSS}</style>

      <div className="ed" style={{ height: '100svh' }}>
        {/* Skip link — targets #ed-main (the pane grid) */}
        <a
          href="#ed-main"
          className="sr-only focus:not-sr-only"
          style={{
            position: 'absolute',
            top: '-40px',
            left: 0,
            padding: '4px 8px',
            background: 'var(--accent-orange)',
            color: 'var(--paper-bright)',
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            zIndex: 100,
          }}
          onFocus={(e) => { (e.target as HTMLAnchorElement).style.top = '0' }}
          onBlur={(e) => { (e.target as HTMLAnchorElement).style.top = '-40px' }}
        >
          skip to editor
        </a>

        {/* ── Toolbar ── */}
        <EntryToolbar
          kind={kind}
          onKind={setKind}
          fileNum={draft.fileNum}
          view={view}
          onView={setView}
          outlineOpen={outlineOpen}
          onOutline={() => setOutline((o) => !o)}
          hasContent={hasContent}
          onReImport={onReImport}
          onImport={onImportFile}
          onFullPreview={openFullPreview}
          onPublish={openPublish}
        />

        {/* ── Pane grid ── */}
        <div
          id="ed-main"
          tabIndex={-1}
          className="ed-3pane"
          style={{ gridTemplateColumns: gridCols }}
        >
          {/* ── ARTICLE kind (LIVE) ── */}
          {kind === 'article' && (
            <>
              {outlineOpen && (
                <ArticleOutline md={md} fileNum={draft.fileNum} previewRefId="ed-preview" />
              )}
              {showSource && <ArticleSourcePane md={md} onChange={setMd} />}
              {showPreview && (
                <div className="ed-preview-wrap" id="ed-preview">
                  <ArticlePreview article={draft} md={md} />
                  {publishPanelNode}
                </div>
              )}
            </>
          )}

          {/* ── PHOTO kind (LIVE — mock frames) ── */}
          {kind === 'photo' && (
            <>
              {/* hidden input for + ADD FRAME — caller owns the ref (contract §1) */}
              <input
                ref={frameInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                aria-hidden
                tabIndex={-1}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) addFrame(f)
                  e.target.value = ''
                }}
              />
              {outlineOpen && (
                <FramesRail
                  frames={frames}
                  active={activeFrame}
                  setActive={setActiveFrame}
                  setFrames={setFrames}
                />
              )}
              {showSource &&
                (frames.length === 0 ? (
                  // Empty photo source pane → ImportZone drop target (contract).
                  <div className="src-pane">
                    <ImportZone
                      onImport={(file) => addFrame(file)}
                      hasContent={false}
                    />
                  </div>
                ) : (
                  <PhotoManager
                    frames={frames}
                    setFrames={setFrames}
                    active={activeFrame}
                    setActive={setActiveFrame}
                    onAdd={() => frameInputRef.current?.click()}
                    reading={false}
                  />
                ))}
              {showPreview && (
                <div className="ed-preview-wrap" id="ed-preview">
                  {/* REAL preview when the route loaded a velite sidecar (reuses
                      the public <PhotoEntry> + working FilmSimSwitcher). When
                      absent, PhotoPreview falls back to its MOCK styled-slot
                      spread (graceful — no crash). Only ONE [data-photo-entry-root]
                      mounts here; FullPreview's photo path stays MOCK so the
                      switcher's global querySelector never grabs a hidden root. */}
                  <PhotoPreview
                    meta={photoMeta}
                    frames={frames}
                    active={activeFrame}
                    narrow={false}
                    photo={initialPhoto}
                    sequenceIndex={photoSequenceIndex}
                    rollTotal={photoRollTotal}
                  />
                  {publishPanelNode}
                </div>
              )}
            </>
          )}

          {/* ── FICTION kind (LIVE — mock chapters) ── */}
          {kind === 'fiction' && (
            <>
              {outlineOpen && (
                <ChaptersRail
                  chapters={chapters}
                  active={activeChapter}
                  setActive={setActiveChapter}
                  setChapters={setChapters}
                />
              )}
              {showSource && (
                <FictionManager
                  chapters={chapters}
                  setChapters={setChapters}
                  active={activeChapter}
                  setActive={setActiveChapter}
                />
              )}
              {showPreview && (
                <div className="ed-preview-wrap" id="ed-preview">
                  <FictionPreview
                    meta={fictionMeta}
                    chapters={chapters}
                    activeId={activeChapter}
                    status={draft.status}
                  />
                  {publishPanelNode}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Provenance line ── */}
        <div className="ed-prov" aria-live="polite">
          {provenance}
        </div>
      </div>

      {/* ── ◻ FULL PREVIEW overlay (cross-kind surface) ──────────────────────
          Total-immersion preview window. Rendered OUTSIDE the .ed shell so its
          fixed paper-deep/0.85 backdrop covers the full viewport (it is its own
          fixed-position instrument window, not bounded by the editor pane grid).
          Self-contained: ESC + backdrop close, focus-trap, device toggle, and
          reduced-motion all live inside FullPreview. Article path reuses the
          byte-identical ArticlePreview wiring; photo/fiction forward mock data. */}
      {fullPreviewOpen && (
        <FullPreview
          kind={kind}
          meta={surfaceMeta}
          // FIX 2: pass the real Article so the overlay's article render is
          // byte-identical to the in-pane ArticlePreview (same `draft` + `md`
          // objects — same inputs → same render).
          article={kind === 'article' ? draft : undefined}
          md={md}
          frames={frames}
          chapters={chapters}
          activeId={activeId ?? undefined}
          status={draft.status}
          device={previewDevice}
          setDevice={setPreviewDevice}
          onClose={() => setFullPreviewOpen(false)}
        />
      )}
    </>
  )
}

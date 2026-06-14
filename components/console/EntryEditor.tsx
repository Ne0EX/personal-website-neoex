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
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Article, Photo, PhotoSidecar } from '@/lib/content/types'
import type { InstrumentOverrides, Place } from '@/lib/store/types'
// S6: swap to store actions (setEntryDraft + deleteEntry + updateEntry now live against DB)
import { setEntryDraft, deleteEntry, updateEntry } from '@/lib/server/store/actions'
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
import { ImagePickerPanel } from '@/components/console/ImagePickerPanel'
import type { PhotoPickerItem } from '@/lib/store/admin-reads'
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

/* ── toolbar — two-row stack ───────────────────────────────────────── */
/* ROW 1: entry object (navigation · identity · lifecycle)
   ROW 2: editing surface (kind · view · output)
   The two rows together are ~108px; --console-header-height (54px) is
   reused per row, NOT redefined. The console graph header stays at 54px;
   the editor toolbar is simply taller — that is fine per the task spec.
   Row-1 bottom hairline separates the two rows.
   Outer bottom border separates the toolbar from the 3-pane grid. */
.ed-toolbar {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-bottom: 1px dashed var(--ink-dashed);
}
/* Single horizontal row inside the toolbar — both rows share this base. */
.ed-tb-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  min-height: var(--console-header-height);
}
/* Row-1 only: hairline separating it from row-2. */
.ed-tb-row-1 {
  border-bottom: 1px dashed var(--ink-dashed);
}
/* Row-2: let controls wrap at extreme narrow widths (RE-IMPORT / FULL PREVIEW
   shed gracefully; no text-cut). flex-wrap is the safe net since ImportZone
   owns its own RE-IMPORT label — we never reach into that component. */
.ed-tb-row-2 {
  flex-wrap: wrap;
  gap: 8px;
}
/* Identity lane (ROW 1 left): flex:1 so it takes all leftover space from the
   fixed back-link; min-width:0 is the flex ellipsis unlock. */
.ed-tb-identity {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0;
}
/* Lifecycle cluster (ROW 1 right): never shrinks; margin-left:auto pushes it
   against the right wall, ensuring the identity lane can never grow into it. */
.ed-tb-lifecycle {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  margin-left: auto;
}
/* Row-2 right cluster: actions that live on the trailing edge. */
.ed-tb-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  margin-left: auto;
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

/* File identity — lives inside .ed-tb-identity (flex:1, min-width:0).
   Previously a 92px jitter-reserve inline span (kind tabs were adjacent and
   caused layout shift on kind switch). Kind tabs are now on ROW 2 so the
   jitter reserve is no longer needed; the lane is flex:1, never collapses.
   display:block + max-width + overflow:hidden + text-overflow:ellipsis form
   the truncation chain — all four rules are required together. white-space:nowrap
   prevents the slug from line-wrapping before the ellipsis can apply. */
.ed-tb-file {
  display: block;
  max-width: 38ch;
  font-size: 9px;
  letter-spacing: 0.2em;
  color: var(--ink-primary);
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

/* ── BUG-C fix: photo preview horizontal overflow ─────────────────────────────
   PhotoEntry's three-column inline grid [260px · 1fr · 240px] needs ~560px+ of
   width. In the editor split-view the preview pane is ~half the viewport (~640px
   on a 1280px screen), which is marginal. The .ed-preview-wrap uses overflow:hidden
   to clip the PublishPanel slide-in (position:absolute translateX(100%)); that same
   clip also chops the right PhotoEntry column and causes the visual overlap Peat
   reported ("instrument หลุดเยอะและยังเป็น fixed อยู่").
   .is-photo-preview relaxes overflow-x to auto so the horizontal content scrolls
   inside the pane while the PublishPanel translateX clip still holds via overflow-y.
   The class is added to the .ed-preview-wrap div only when kind === 'photo'. */
.ed-preview-wrap.is-photo-preview {
  overflow-x: auto;
}

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

/* ── T1 lifecycle controls — DELETE + DRAFT⇄PUBLISH ───────────────────────────
   Inline on EntryEditor (Contract 9 — console CSS not in globals.css).
   Type primitive: .t-meta vocabulary (--font-mono, 9px, uppercase, var(--meta-tracking)).
   Draft badge = two segments: DRAFT (orange) · HIDDEN FROM SITE (ink-dashed). */

/* DELETE confirm row — mirrors ImportZone's inline confirm pattern */
.ed-lc-delete-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ed-lc-confirm-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ed-lc-confirm-prompt {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: var(--meta-tracking);
  text-transform: uppercase;
  color: var(--ink-soft);
  white-space: nowrap;
}
.ed-lc-confirm-clause {
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.1em;
  color: var(--ink-faint);
  white-space: nowrap;
}
.ed-lc-confirm-action {
  appearance: none;
  background: transparent;
  border: 1px dashed rgba(212, 96, 42, 0.45);
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: var(--meta-tracking);
  text-transform: uppercase;
  color: var(--accent-orange);
  padding: 6px 10px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 120ms ease, color 120ms ease;
}
.ed-lc-confirm-action:hover,
.ed-lc-confirm-action:focus-visible {
  background: var(--accent-orange);
  color: var(--paper-bright);
  outline: none;
}
.ed-lc-confirm-action:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}
.ed-lc-confirm-cancel {
  appearance: none;
  background: transparent;
  border: 1px dashed var(--ink-dashed);
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: var(--meta-tracking);
  text-transform: uppercase;
  color: var(--ink-soft);
  padding: 6px 10px;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 120ms ease, color 120ms ease;
}
.ed-lc-confirm-cancel:hover,
.ed-lc-confirm-cancel:focus-visible {
  border-color: var(--ink-primary);
  color: var(--ink-primary);
  outline: none;
}
.ed-lc-confirm-cancel:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}
.ed-lc-error {
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.1em;
  color: var(--accent-orange);
  white-space: nowrap;
}

/* DRAFT⇄PUBLISH toggle group */
.ed-lc-toggle-group {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ed-lc-toggle {
  appearance: none;
  background: transparent;
  border: 1px dashed var(--ink-dashed);
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: var(--meta-tracking);
  text-transform: uppercase;
  color: var(--ink-soft);
  padding: 6px 10px;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
}
.ed-lc-toggle:hover:not(:disabled),
.ed-lc-toggle:focus-visible:not(:disabled) {
  border-color: var(--ink-primary);
  color: var(--ink-primary);
  outline: none;
}
.ed-lc-toggle:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}
.ed-lc-toggle:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
/* published state — filled-ink active */
.ed-lc-toggle.is-published {
  background: var(--ink-primary);
  border-color: var(--ink-primary);
  color: var(--paper-base);
}
.ed-lc-toggle.is-published:hover:not(:disabled),
.ed-lc-toggle.is-published:focus-visible:not(:disabled) {
  background: transparent;
  border-color: var(--accent-orange);
  color: var(--accent-orange);
  outline: none;
}
.ed-lc-sep {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-faint);
  user-select: none;
}

/* DRAFT badge — two-segment: DRAFT (orange) · HIDDEN FROM SITE (ink-dashed)
   type primitive: .t-meta (--font-mono, 9px, uppercase, var(--meta-tracking)) */
.ed-lc-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}
.ed-lc-badge-draft {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: var(--meta-tracking);
  text-transform: uppercase;
  color: var(--accent-orange);
  background: var(--accent-orange-soft);
  border: 1px solid rgba(212, 96, 42, 0.45);
  padding: 2px 6px;
}
.ed-lc-badge-sep {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--ink-faint);
  user-select: none;
}
.ed-lc-badge-hidden {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: var(--meta-tracking);
  text-transform: uppercase;
  color: var(--ink-soft);
  background: rgb(var(--ink-rgb) / 0.06);
  border: 1px dashed var(--ink-dashed);
  padding: 2px 6px;
}

@media (prefers-reduced-motion: reduce) {
  .fr-item, .st-btn, .ed-tb-action { transition: none; }
  .ed-lc-confirm-action, .ed-lc-confirm-cancel,
  .ed-lc-toggle { transition: none; }
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

/* ── Roll picker (BUG-1 fix) — inline instrument panel, no-roll context ─────
   Appears inside .src-pane above ImportZone when kind=photo and no roll is
   known from the URL. Terse instrument idiom: dashed hairlines, mono uppercase,
   no modal/drawer. Three zones:
     · .rp-head: section label (// ROLL)
     · .rp-existing: <select> over known rolls  OR  "no rolls yet" fallback
     · .rp-new: inline new-roll creation form (slug + date + CREATE button)
     · .rp-error: red-tinted error / block message when upload attempted without roll
*/
.rp-wrap {
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  border-bottom: 1px dashed var(--ink-dashed);
}
.rp-head {
  font-size: 8px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--ink-faint);
}
.rp-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.rp-label {
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-soft);
  white-space: nowrap;
  min-width: 60px;
}
.rp-select {
  appearance: none;
  background: var(--paper-warm);
  border: 1px dashed var(--ink-dashed);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--ink-primary);
  padding: 6px 10px;
  cursor: pointer;
  flex: 1;
  min-width: 120px;
}
.rp-select:focus {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}
.rp-input {
  appearance: none;
  background: var(--paper-warm);
  border: 1px dashed var(--ink-dashed);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--ink-primary);
  padding: 6px 10px;
  flex: 1;
  min-width: 120px;
}
.rp-input:focus {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
  background: rgb(var(--accent-orange-rgb) / 0.02);
}
.rp-input::placeholder { color: var(--ink-faint); }
.rp-create-btn {
  appearance: none;
  background: transparent;
  border: 1px dashed var(--ink-dashed);
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-soft);
  padding: 6px 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 120ms ease, color 120ms ease;
}
.rp-create-btn:hover:not(:disabled),
.rp-create-btn:focus-visible:not(:disabled) {
  border-color: var(--accent-orange);
  color: var(--ink-primary);
  outline: none;
}
.rp-create-btn:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}
.rp-create-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.rp-active {
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent-orange);
}
.rp-error {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-primary);
  background: rgb(var(--accent-orange-rgb) / 0.08);
  border: 1px dashed var(--accent-orange);
  padding: 6px 10px;
  margin-top: 2px;
}
/* Upload status badges (BUG-3 fix) — per-frame inside the FramesRail + error strip */
.fr-status {
  flex-shrink: 0;
  font-size: 7px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  padding: 2px 5px;
  border: 1px solid transparent;
}
.fr-status.is-uploading {
  color: var(--ink-soft);
  border-color: var(--ink-dashed);
}
.fr-status.is-processing {
  color: var(--accent-orange);
  border-color: var(--accent-orange);
}
.fr-status.is-done { color: var(--ink-faint); }
.fr-status.is-failed {
  color: var(--ink-primary);
  background: rgb(var(--accent-orange-rgb) / 0.1);
  border-color: var(--accent-orange);
}
/* Upload error banner — shown below the frames rail or above import zone */
.up-error-strip {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-primary);
  background: rgb(var(--accent-orange-rgb) / 0.08);
  border-top: 1px dashed var(--accent-orange);
  padding: 7px 14px;
}
@media (prefers-reduced-motion: reduce) {
  .rp-create-btn { transition: none; }
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle copy — verbatim from Vega (α-LUM-07). Do NOT alter strings.
// ─────────────────────────────────────────────────────────────────────────────

const LC = {
  delete: {
    button:         'DELETE ENTRY',
    prompt:         'REMOVE ENTRY?',
    clause:         'source removed · restorable before you commit',
    action:         'CONFIRM DELETE',
    cancel:         'CANCEL',
    confirmed:      'entry removed',
  },
  publish: {
    published:      'PUBLISHED',
    unpublished:    'DRAFT',
    separator:      '⇄',
  },
  draft: {
    badge:          'DRAFT · HIDDEN FROM SITE',
    devNote:        'visible on local preview · hidden in production',
  },
} as const

// Derived badge segments — split from LC.draft.badge on ' · ' so the displayed
// text is never separately typed (single source of truth = LC.draft.badge).
const [LC_BADGE_DRAFT, LC_BADGE_HIDDEN] = LC.draft.badge.split(' · ') as [string, string]

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

  // ── T1 lifecycle controls ────────────────────────────────────────────────
  /**
   * True when the editor was opened with a REAL entry (initialDraft !== undefined).
   * False → SAMPLE_DRAFT fallback; lifecycle controls are hidden.
   */
  hasEntry:      boolean
  /** Current draft/hidden state of the loaded entry. */
  isHidden:      boolean
  /** Whether lifecycle actions are in-flight (useTransition pending). */
  lifecyclePending: boolean
  /** Error message from the last lifecycle action (null = no error). */
  lifecycleError: string | null
  /** Trigger DELETE entry flow (shows inline confirm). */
  onDeleteStart: () => void
  /** Cancel the delete confirm. */
  onDeleteCancel: () => void
  /** Whether the delete confirm is showing. */
  isDeleteConfirming: boolean
  /** Actually execute the delete (called by CONFIRM DELETE button). */
  onDeleteConfirm: () => void
  /**
   * Set the entry's draft/hidden state to an explicit target.
   * Mirrors the .st-switch pattern (setState('draft') / setState('settled')) —
   * each segment passes an explicit value, never a blind flip.
   * target=false → publish (draft=false); target=true → hide (draft=true).
   */
  onSetHidden: (target: boolean) => void
}

function EntryToolbar({
  kind, onKind, fileNum, view, onView, outlineOpen, onOutline,
  hasContent, onReImport, onImport, onFullPreview, onPublish,
  hasEntry, isHidden, lifecyclePending, lifecycleError,
  onDeleteStart, onDeleteCancel, isDeleteConfirming, onDeleteConfirm,
  onSetHidden,
}: EntryToolbarProps) {
  // Focus ref — restore focus to DELETE ENTRY trigger when inline confirm is dismissed
  // (cancel or ESC). Without this, focus falls to <body> when autoFocus CANCEL unmounts.
  const deleteButtonRef = useRef<HTMLButtonElement>(null)

  const handleDeleteCancel = useCallback(() => {
    onDeleteCancel()
    // Restore focus to the trigger button (not body) — a11y best practice for
    // inline confirm patterns where the cancel removes the focused element.
    requestAnimationFrame(() => deleteButtonRef.current?.focus())
  }, [onDeleteCancel])

  // ── Two-tier toolbar layout ──────────────────────────────────────────────
  // ROW 1 — entry object: navigation · identity · lifecycle cluster.
  // ROW 2 — editing surface: kind switch · outline · view mode · output actions.
  //
  // The overlap fix: `.ed-tb-identity` is flex:1/min-width:0 — it takes all
  // remaining row-1 space and the slug truncates with ellipsis when squeezed.
  // `.ed-tb-lifecycle` is flex-shrink:0/margin-left:auto — it never shrinks and
  // is always pinned to the right wall. The two containers cannot collide because
  // flexbox resolves identity first (leftover space), then lifecycle pushes right.
  // DRAFT badge + PUBLISHED⇄DRAFT toggle live inside the lifecycle cluster now
  // (previously in .ed-tb-left right after FILE, where they could overflow into
  // each other as Peat observed — "ใครมันจะอ่านออก").
  //
  // VISIBILITY DELTA (layout reorg, intentional): ▲ PUBLISH is now gated on
  // hasEntry (inside the lifecycle cluster, per the task spec: "the whole lifecycle
  // cluster is gated on hasEntry — hidden for the SAMPLE fallback where there's no
  // real entry"). In the previous layout PUBLISH was always shown. The handler
  // (onPublish / openPublish) is UNCHANGED — only the mounting condition changes.
  // Rationale: publishing a SAMPLE is meaningless; the gating is semantically correct.
  return (
    <div className="ed-toolbar">

      {/* ── ROW 1 — entry object (navigation · identity · lifecycle) ── */}
      <div className="ed-tb-row ed-tb-row-1">
        {/* Back link */}
        <a
          className="ed-back"
          href="/console"
          title="back to the console"
          aria-label="back to console"
        >
          ⟵ CONSOLE
        </a>
        <span className="ed-tb-sep" aria-hidden>·</span>

        {/* Identity lane — flex:1 / min-width:0 — slug truncates when the
            lifecycle cluster expands (e.g., delete-confirm inline row). */}
        <div className="ed-tb-identity">
          {/* File slug — truncated with ellipsis; title attr carries the full slug
              so the full value is discoverable on hover (WCAG technique). */}
          <span
            className="ed-tb-file"
            title={fileNum ? `FILE ${fileNum}` : 'FILE ···'}
          >
            {fileNum
              ? `FILE ${fileNum}`
              : <span className="ed-tb-file-empty">FILE ···</span>}
          </span>
        </div>

        {/* Lifecycle cluster — only rendered when a real entry is loaded.
            flex-shrink:0 / margin-left:auto keeps it pinned to the right wall.
            Contents: error · DRAFT badge · PUBLISHED⇄DRAFT toggle · DELETE · ▲ PUBLISH */}
        {hasEntry && (
          <div className="ed-tb-lifecycle">
            {/* Error message from last lifecycle action */}
            {lifecycleError && (
              <span className="ed-lc-error" role="alert" aria-live="assertive">
                {lifecycleError}
              </span>
            )}

            {/* DRAFT badge — shown only when entry is in draft/hidden state.
                Two styled segments: DRAFT (orange) · HIDDEN FROM SITE (ink-dashed). */}
            {isHidden && (
              <span
                className="ed-lc-badge"
                role="status"
                title={LC.draft.devNote}
                aria-label={LC.draft.badge}
              >
                <span className="ed-lc-badge-draft">{LC_BADGE_DRAFT}</span>
                <span className="ed-lc-badge-sep" aria-hidden>·</span>
                <span className="ed-lc-badge-hidden">{LC_BADGE_HIDDEN}</span>
              </span>
            )}

            {/* PUBLISHED⇄DRAFT segmented switch — mirrors .st-switch (DRAFT⇄SETTLED)
                in FictionStateRail. Both segments are state nouns (not verbs).
                Highlighted segment = current state (disabled). Clicking the inactive
                segment switches via onSetHidden(target) — explicit target, never
                blind flip. Acts on the LOADED ENTRY identity (entryKind/entrySlug
                from parent), NOT the mutable `kind` view state.
                Copy: LC.publish.published ('PUBLISHED') / LC.publish.unpublished ('DRAFT').
                Resolution: Polaris 2026-06-08 — state-noun segments per .st-switch precedent. */}
            <div className="ed-lc-toggle-group" role="group" aria-label="Published / draft toggle">
              {/* Left segment — PUBLISHED state: highlighted+disabled when published; clicking sets draft=false */}
              <button
                type="button"
                className={'ed-lc-toggle' + (!isHidden ? ' is-published' : '')}
                onClick={() => onSetHidden(false)}
                disabled={lifecyclePending || !isHidden}
                title="entry is published and visible on site"
                aria-pressed={!isHidden}
                aria-label={LC.publish.published + ': entry is visible on site'}
              >
                {LC.publish.published}
              </button>
              <span className="ed-lc-sep" aria-hidden>{LC.publish.separator}</span>
              {/* Right segment — DRAFT state: highlighted+disabled when hidden; clicking sets draft=true */}
              <button
                type="button"
                className={'ed-lc-toggle' + (isHidden ? ' is-published' : '')}
                onClick={() => onSetHidden(true)}
                disabled={lifecyclePending || isHidden}
                title={LC.draft.devNote}
                aria-pressed={isHidden}
                aria-label={LC.publish.unpublished + ': entry is draft, hidden from site'}
              >
                {LC.publish.unpublished}
              </button>
            </div>

            {/* DELETE ENTRY — inline confirm (ImportZone "REPLACE CURRENT CONTENT?" pattern).
                Precedent: ImportZone.tsx confirming state + ESC dismiss.
                deleteButtonRef + handleDeleteCancel move as one unit (focus-restore). */}
            <div className="ed-lc-delete-wrap">
              {isDeleteConfirming ? (
                // Confirm row — ESC is handled by useEffect in EntryEditor (closes confirm)
                <div
                  className="ed-lc-confirm-row"
                  role="alertdialog"
                  aria-label="Confirm delete"
                  aria-live="assertive"
                >
                  <span className="ed-lc-confirm-prompt">{LC.delete.prompt}</span>
                  <span className="ed-lc-confirm-clause">{LC.delete.clause}</span>
                  <button
                    type="button"
                    className="ed-lc-confirm-action"
                    onClick={onDeleteConfirm}
                    disabled={lifecyclePending}
                    aria-label={LC.delete.action}
                    // Auto-focus the cancel button (safer default); Confirm requires
                    // explicit intent. The confirm is the destructive action.
                  >
                    {lifecyclePending ? '…' : LC.delete.action}
                  </button>
                  <button
                    type="button"
                    className="ed-lc-confirm-cancel"
                    onClick={handleDeleteCancel}
                    disabled={lifecyclePending}
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    aria-label={LC.delete.cancel}
                  >
                    {LC.delete.cancel}
                  </button>
                </div>
              ) : (
                <button
                  ref={deleteButtonRef}
                  type="button"
                  className="ed-tb-action"
                  onClick={onDeleteStart}
                  disabled={lifecyclePending}
                  title={LC.delete.button}
                  aria-label={LC.delete.button}
                >
                  {LC.delete.button}
                </button>
              )}
            </div>

            {/* ▲ PUBLISH — primary trigger → mocked PublishPanel.
                Lives in the lifecycle cluster (gated on hasEntry) so it cannot
                appear for the SAMPLE fallback. Handler (onPublish) is unchanged. */}
            <button
              type="button"
              className="ed-tb-action is-primary"
              onClick={onPublish}
              title="transmit sequence (mocked)"
              aria-label="publish entry"
            >
              ▲ PUBLISH
            </button>
          </div>
        )}
      </div>

      {/* ── ROW 2 — editing surface (kind · outline · view · output actions) ── */}
      <div className="ed-tb-row ed-tb-row-2">
        {/* Kind-switcher tabs — FILLED-INK is-on (canonical DS state, NOT orange).
            B1 (photo-feedback spec): when a real photo entry is loaded (hasEntry &&
            kind === 'photo'), the three-tab switcher is replaced with a static label
            "◎ PHOTO ENTRY" — the kind is not ambiguous when editing a real photo.
            Article and fiction editing (and new-entry path where kind switch is
            meaningful) retain the full switcher. */}
        {hasEntry && kind === 'photo' ? (
          /* B1: static kind identity label — photo edit route */
          <span
            role="status"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--ink-soft)',
              userSelect: 'none',
            }}
            title="editing a photo entry — kind switching not available here"
          >
            ◎ PHOTO ENTRY
          </span>
        ) : (
          /* Full kind-switcher — new-entry, article, or fiction path */
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
        )}

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

        {/* Right-pinned output actions — margin-left:auto via .ed-tb-actions */}
        <div className="ed-tb-actions">
          {/* ↻ RE-IMPORT — ImportZone(hasContent) self-renders the toolbar control
              (inline confirm + ESC-cancel built inside). When the editor is empty
              the source pane shows the ImportZone DROP TARGET instead; this control
              only appears when there IS content to replace.
              B7 (photo-feedback spec): gate on `kind !== 'photo' || !hasEntry`.
              For a real photo entry, RE-IMPORT is noise (image is already in storage;
              re-importing replaces the original — rarely the right action at edit time).
              The IMPORT action remains available via + ADD FRAME in PhotoManager. */}
          {hasContent && (kind !== 'photo' || !hasEntry) && (
            <ImportZone
              onImport={onImport}
              hasContent
              onReImport={onReImport}
            />
          )}

          {/* ◻ FULL PREVIEW — ghost trigger → FullPreview overlay.
              aria-label provided so the text label can be hidden at narrow widths
              via CSS without losing the accessible name (mirrors kind-tab pattern). */}
          <button
            type="button"
            className="ed-tb-action"
            onClick={onFullPreview}
            title="full preview — how it reads on the site"
            aria-label="full preview — how it reads on the site"
          >
            ◻ FULL PREVIEW
          </button>
        </div>
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
  md:            string
  onChange:      (v: string) => void
  onSave?:       () => void
  saveStatus?:   'idle' | 'saving' | 'saved' | 'error'
  /** Ref forwarded from the parent so it can read cursor position for image insert. */
  textareaRef?:  React.RefObject<HTMLTextAreaElement | null>
  /** Called when the ◎ IMAGE button is clicked — parent opens the image picker. */
  onOpenPicker?: () => void
  /** True while the image picker panel is open (drives the button's is-on state). */
  pickerOpen?:   boolean
}

function ArticleSourcePane({
  md, onChange, onSave, saveStatus,
  textareaRef, onOpenPicker, pickerOpen,
}: ArticleSourcePaneProps) {
  // S6: save-status copy tokens (no Vega handoff needed — these are console-internal instrument labels)
  const saveLabel = saveStatus === 'saving' ? 'SAVING…'
    : saveStatus === 'saved' ? 'SAVED'
    : saveStatus === 'error' ? 'SAVE ERR'
    : null
  return (
    <div className="src-pane" style={{ position: 'relative' }}>
      <div className="src-head">
        <span>MARKDOWN · SOURCE</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
          {/* ◎ IMAGE — opens image picker panel (article kind, model B) */}
          {onOpenPicker && (
            <button
              type="button"
              onClick={onOpenPicker}
              className={'ed-srctoggle' + (pickerOpen ? ' is-on' : '')}
              aria-pressed={!!pickerOpen}
              aria-label="insert image from library"
              title="insert image from photo library"
            >
              ◎ IMAGE
            </button>
          )}
          {/* S6: save affordance (only shown when a real entry is loaded) */}
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={saveStatus === 'saving'}
              style={{
                appearance: 'none', background: 'transparent', border: 'none',
                fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: saveStatus === 'error' ? 'var(--accent-orange)'
                  : saveStatus === 'saved' ? 'var(--ink-primary)'
                  : 'var(--ink-faint)',
                cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer', padding: 0,
              }}
              aria-label="save body to store"
              title="CMD+S to save"
            >
              {saveLabel ?? '⇡ SAVE'}
            </button>
          )}
          <span className="src-count">{md.length} CH</span>
        </div>
      </div>
      <textarea
        ref={textareaRef ?? undefined}
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
  frames:         PhotoFrame[]
  active:         string | null
  setActive:      (id: string) => void
  setFrames:      (frames: PhotoFrame[]) => void
  // BUG-3 fix: per-frame upload statuses so progress/errors are visible in the rail
  uploadStatuses: Record<string, 'uploading' | 'processing' | 'done' | 'failed'>
}

function FramesRail({ frames, active, setActive, setFrames, uploadStatuses }: FramesRailProps) {
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
                    {/* BUG-3 fix: render per-frame upload status badge */}
                    {uploadStatuses[f.id] && uploadStatuses[f.id] !== 'done' && (
                      <span
                        className={`fr-status is-${uploadStatuses[f.id]}`}
                        aria-label={`upload status: ${uploadStatuses[f.id]}`}
                      >
                        {uploadStatuses[f.id] === 'uploading' ? 'UP' :
                         uploadStatuses[f.id] === 'processing' ? 'PROC' :
                         'ERR'}
                      </span>
                    )}
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
  /**
   * All known rolls from the DB (loaded server-side). Used by the roll picker
   * so Peat can select an existing roll when opening the editor without a roll
   * slug (BUG-1 fix: no-roll silent-mock replaced by a real picker UI).
   */
  availableRolls?: Photo[]
  /**
   * All registered places from the DB (loaded server-side). Used by the PLACE
   * assignment dropdown in the photo editor's COORD block.
   * Passes only for photo kind (empty for article/fiction).
   */
  availablePlaces?: Place[]
  /**
   * Owner's full photo library with public CDN thumbnail URLs (model B image picker).
   * Loaded server-side when kind=article; empty otherwise (no picker for photo/fiction).
   * Each item carries slug / roll / photoId / caption / thumbUrl / mediumUrl.
   */
  pickerPhotos?: PhotoPickerItem[]
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
  availableRolls = [],
  availablePlaces = [],
  pickerPhotos = [],
}: EntryEditorProps = {}) {
  const draft = initialDraft ?? SAMPLE_DRAFT

  // Top-level kind state — default from URL ?kind. Kind is a view mode, not a
  // stored field on the entry (contract §kind state model).
  const [kind, setKind] = useState<EntryKind>(initialKind ?? 'article')

  // S6: ARTICLE source body — seeded from the real entry body when a draft is loaded.
  // Falls back to SAMPLE_MD only when no real entry (SAMPLE_DRAFT path).
  // `initialDraft` is set when the route found a real entry; `hasEntry` mirrors this.
  const [md, setMd] = useState<string>(
    initialDraft !== undefined ? (initialDraft.body ?? '') : SAMPLE_MD
  )

  // PHOTO frames and activeFrame moved below initialRealFrames useMemo (after hasEntry/entrySlug/entryKind).
  // See comment near `const initialRealFrames` — TDZ fix requires declaration order.

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

  // ── T1 lifecycle state ────────────────────────────────────────────────────
  //
  // Identity anchors — immutable from mount. The entry's SEMANTIC identity is
  // the URL params (initialKind, initialDraft.fileNum), NOT the mutable kind-tab
  // state. Actions ALWAYS use these anchors; the kind-switcher UI is a VIEW mode.
  //
  // entrySlug semantics by kind (matches app/console/editor/page.tsx lookupDraft):
  //   article → draft.fileNum (zero-padded, e.g. "003")
  //   fiction → slug used as fileNum stand-in (kebab slug)
  //   photo   → "roll/id" string used as fileNum stand-in
  //
  // hasEntry: false = SAMPLE_DRAFT fallback → controls stay hidden.
  const entryKind: 'article' | 'photo' | 'fiction' = initialKind ?? 'article'
  const entrySlug: string | undefined = initialDraft?.fileNum
  const hasEntry: boolean = initialDraft !== undefined

  // S6: PHOTO frames — seeded from real DB data when a photo entry is loaded.
  // Placed here (after entryKind/entrySlug/hasEntry declarations) to avoid TDZ:
  // the useMemo must be declared AFTER the variables it closes over, or the
  // minifier's const-hoist produces a "Cannot access before initialization" error.
  const initialRealFrames = useMemo<PhotoFrame[]>(() => {
    if (entryKind === 'photo' && hasEntry && entrySlug) {
      // The editor is opened for a specific photo (slug = "roll/id")
      // Seed a single frame representing this photo; real variants from the DB
      const sep = entrySlug.indexOf('/')
      const photoId = sep >= 0 ? entrySlug.slice(sep + 1) : entrySlug
      // PhotoPreview uses initialPhoto for real preview; PhotoManager shows this frame
      // Variants URL would come from photo_assets.variants via initialPhoto — use it if present
      const thumbSrc = initialPhoto?.variants?.thumb?.webp
        ?? initialPhoto?.variants?.thumb?.jpg
        ?? '/_mock/placeholder.jpg'
      return [{
        id:      entrySlug,          // "roll/id" format as the frame key
        src:     thumbSrc,
        caption: initialPhoto ? (draft.title) : photoId,
        // filmSim lives inside exif (PhotoExif.filmSim: string|undefined), not top-level on PhotoSidecar
        filmSim: (initialPhoto?.exif?.filmSim ?? undefined) as PhotoFrame['filmSim'],
        exif:    initialPhoto?.exif ? {
          camera:   initialPhoto.exif.camera ?? undefined,
          lens:     initialPhoto.exif.lens ?? undefined,
          iso:      initialPhoto.exif.iso ?? undefined,
          // PhotoExif.aperture/focal are numbers; PhotoFrame.exif.aperture/focal expect string
          aperture: initialPhoto.exif.aperture != null ? String(initialPhoto.exif.aperture) : undefined,
          shutter:  initialPhoto.exif.shutter ?? undefined,
          focal:    initialPhoto.exif.focal != null ? String(initialPhoto.exif.focal) : undefined,
        } : undefined,
      }]
    }
    return MOCK_FRAMES
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // intentionally computed once on mount from stable props

  // S6: PHOTO frames state — seeded from initialRealFrames (which depends on
  // entryKind/entrySlug/hasEntry; declared above for TDZ safety).
  const [frames, setFrames] = useState<PhotoFrame[]>(initialRealFrames)
  const [activeFrame, setActiveFrame] = useState<string | null>(
    initialRealFrames[0]?.id ?? null,
  )

  // isHidden — current draft visibility. Initialized from the velite field.
  // Photo: sidecar has its own draft field. Other kinds: Article.draft.
  // Both are typed as boolean by the velite schema (s.boolean().default(false)).
  const initialIsHidden: boolean = entryKind === 'photo'
    ? (initialPhoto?.draft ?? false)
    : (initialDraft?.draft ?? false)
  const [isHidden, setIsHidden] = useState<boolean>(initialIsHidden)

  // Delete confirm visibility + error.
  const [isDeleteConfirming, setIsDeleteConfirming] = useState<boolean>(false)
  const [lifecycleError, setLifecycleError] = useState<string | null>(null)

  // useTransition — wraps async server action calls. `isPending` keeps the
  // controls disabled while the action is in-flight. React 19 / Next 16:
  // startTransition(async () => …) correctly marks the transition pending.
  const [lifecyclePending, startLifecycleTransition] = useTransition()

  // useRouter — navigate after delete.
  const router = useRouter()

  // deleteEntry handler — called by CONFIRM DELETE button.
  const onDeleteConfirm = useCallback(() => {
    if (!hasEntry || !entrySlug) return
    setLifecycleError(null)
    startLifecycleTransition(async () => {
      const result = await deleteEntry({ kind: entryKind, slug: entrySlug })
      if (!result.ok) {
        setLifecycleError(result.error.message)
        setIsDeleteConfirming(false)
        return
      }
      // SUCCESS — reconstruct the ConsoleApp node id and pass via URL param.
      // Node id format (app/console/page.tsx):
      //   article → "article-${fileNum}"
      //   fiction → "fiction-${slug}"
      //   photo   → "photo-${roll}-${id}"  (slug = "roll/id", replace '/' → '-')
      const nodeId = entryKind === 'photo'
        ? `photo-${entrySlug.replace('/', '-')}`
        : `${entryKind}-${entrySlug}`
      router.push(`/console?removed=${encodeURIComponent(nodeId)}`)
    })
  }, [hasEntry, entryKind, entrySlug, router, startLifecycleTransition])

  // ── Image picker (model B — reuse, no re-upload) ─────────────────────────
  // pickerOpen: whether the ImagePickerPanel slide-up is visible.
  // textareaRef: forwarded to ArticleSourcePane so we can read cursor position.
  // insertAtCursor: splices the MDX snippet at selectionStart, restores cursor.
  const [pickerOpen, setPickerOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // insertAtCursor — inserts `snippet` at the textarea's current cursor position.
  // Works by: read selectionStart, splice into `md`, call setMd, then
  // use requestAnimationFrame to restore the cursor so React doesn't reset it.
  // Hydration safe: reads DOM only inside a callback (never during render).
  const insertAtCursor = useCallback((snippet: string) => {
    const ta = textareaRef.current
    if (!ta) {
      // Fallback: append at end when ref is unavailable
      setMd((prev) => prev + '\n' + snippet + '\n')
      return
    }
    // Read cursor position from DOM BEFORE the setState call changes the value.
    const pos = ta.selectionStart
    const currentValue = ta.value
    const before = currentValue.slice(0, pos)
    const after  = currentValue.slice(pos)
    const needsLeadingNl  = before.length > 0 && !before.endsWith('\n')
    const needsTrailingNl = after.length  > 0 && !after.startsWith('\n')
    const inserted = (needsLeadingNl ? '\n' : '') + snippet + (needsTrailingNl ? '\n' : '')
    setMd(before + inserted + after)
    // After React re-renders the textarea with the new value, restore the cursor
    // to just after the inserted snippet (including any prefix newline we added).
    const newPos = pos + inserted.length
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newPos, newPos)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // setMd is a stable setter; textareaRef.current is read at call time

  // S6: SAVE body — called by Cmd+S and explicit SAVE button (article kind).
  // updateEntry patch: only sends body (no other field edits in the source pane).
  // Guarded on hasEntry (sample drafts have no slug to update).
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [_savePending, startSaveTransition] = useTransition()

  const onSaveBody = useCallback(() => {
    if (!hasEntry || !entrySlug) return
    setSaveStatus('saving')
    startSaveTransition(async () => {
      const result = await updateEntry({ kind: entryKind, slug: entrySlug, patch: { body: md } })
      if (!result.ok) {
        setSaveStatus('error')
        return
      }
      setSaveStatus('saved')
      // Reset status indicator after 2s
      setTimeout(() => setSaveStatus('idle'), 2000)
    })
  }, [hasEntry, entryKind, entrySlug, md, startSaveTransition])

  // ── Instrument overrides (lens-override wiring, 2026-06-12, Sirius slice) ──
  //
  // State: current authored override map for the active photo entry.
  // Seeded from initialPhoto.instrumentOverrides (the merged-out value from map.ts).
  // null = no overrides set (all instrument fields fall back to EXIF).
  // undefined = not loaded (non-photo context; state is irrelevant but typed safely).
  //
  // The displayed value in PhotoManager = override ?? exif (exif is already merged
  // in initialPhoto.exif by map.ts, but we keep overrides separately so the UI
  // can show the orange affordance and clear individual keys back to EXIF).
  const [instrumentOverrides, setInstrumentOverrides] = useState<InstrumentOverrides | null>(
    initialPhoto?.instrumentOverrides ?? null
  )
  const [instrumentSaveStatus, setInstrumentSaveStatus] =
    useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [_instrSavePending, startInstrSaveTransition] = useTransition()

  // onSaveInstrumentOverrides — saves the current instrumentOverrides to the DB.
  // Called by PhotoManager's SAVE button and the Cmd+S handler (photo kind).
  // patch.instrumentOverrides = null clears the column (falls back to raw EXIF everywhere).
  // photo_assets.exif is NEVER touched — raw sensor truth invariant preserved.
  const onSaveInstrumentOverrides = useCallback(() => {
    if (!hasEntry || !entrySlug) return
    setInstrumentSaveStatus('saving')
    startInstrSaveTransition(async () => {
      const result = await updateEntry({
        kind: entryKind,
        slug: entrySlug,
        patch: { instrumentOverrides: instrumentOverrides ?? null },
      })
      if (!result.ok) {
        setInstrumentSaveStatus('error')
        return
      }
      setInstrumentSaveStatus('saved')
      // Reset status indicator after 2s
      setTimeout(() => setInstrumentSaveStatus('idle'), 2000)
    })
  }, [hasEntry, entryKind, entrySlug, instrumentOverrides, startInstrSaveTransition])

  // ── Caption (B2 — photo-feedback spec §Change B2) ────────────────────────
  //
  // Caption is the most natural post-upload edit. It's surfaced as Zone 0 in
  // PhotoManager (first field, before film sim). Saves on blur via onSaveCaption.
  // Seeded from the entry's caption field (initialPhoto.caption currently, but
  // the entry body is the real store — kept in sync via updateEntry).
  // We use the draft.title as the caption seed when no dedicated caption field
  // exists on the sidecar (the gallery and lightbox use `caption` from entries).
  const [authoredCaption, setAuthoredCaption] = useState<string | null>(
    initialPhoto ? (initialPhoto.caption ?? null) : null
  )
  const [captionSaveStatus, setCaptionSaveStatus] =
    useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_captionPending, startCaptionTransition] = useTransition()

  // onSaveCaption — called on caption blur. Saves to entries.caption via updateEntry.
  // Null = cleared caption. Guarded on hasEntry.
  const onSaveCaption = useCallback((value: string | null) => {
    setAuthoredCaption(value)
    if (!hasEntry || !entrySlug) return
    setCaptionSaveStatus('saving')
    startCaptionTransition(async () => {
      const result = await updateEntry({
        kind: entryKind,
        slug: entrySlug,
        patch: { caption: value },
      })
      if (!result.ok) {
        setCaptionSaveStatus('error')
        return
      }
      setCaptionSaveStatus('saved')
      setTimeout(() => setCaptionSaveStatus('idle'), 2000)
    })
  }, [hasEntry, entryKind, entrySlug, startCaptionTransition])

  // ── Authored coords / place / filmSim (photo-meta-harness, sirius slice) ──
  //
  // Three authored fields exposed to the photo editor:
  //   authoredCoords  — entry.coords (lat/lon/place — raw, owner-only)
  //   authoredPlaceId — entry.place_id (foreign key into places table)
  //   authoredFilmSim — entry.film_sim (authored override wins over EXIF filmSim)
  //
  // filmSim saves IMMEDIATELY on button click (onSaveFilmSim).
  // coords + placeId share one SAVE button (onSavePhotoMeta) to avoid double-saving.
  //
  // Seeded from initialPhoto on mount; never re-seeded after mount to avoid
  // overwriting in-flight edits (same pattern as instrumentOverrides above).
  const [authoredCoords, setAuthoredCoords] = useState<{ lat: number; lon: number; place: string } | null>(
    initialPhoto?.authoredCoords ?? null
  )
  const [authoredPlaceId, setAuthoredPlaceId] = useState<string | null>(
    initialPhoto?.placeId ?? null
  )
  const [authoredFilmSim, setAuthoredFilmSim] = useState<string | null>(
    initialPhoto?.filmSim ?? null
  )
  const [photoMetaSaveStatus, setPhotoMetaSaveStatus] =
    useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [filmSimSaveStatus, setFilmSimSaveStatus] =
    useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_photoMetaPending, startPhotoMetaTransition] = useTransition()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_filmSimPending, startFilmSimTransition] = useTransition()

  // onSavePhotoMeta — saves coords + placeId together (SAVE button or Cmd+S).
  // photo_assets.exif is never touched. DL13 gate is preserved by the DB trigger
  // (served_coords updates automatically based on share_location).
  const onSavePhotoMeta = useCallback(() => {
    if (!hasEntry || !entrySlug) return
    setPhotoMetaSaveStatus('saving')
    startPhotoMetaTransition(async () => {
      const result = await updateEntry({
        kind: entryKind,
        slug: entrySlug,
        patch: {
          coords: authoredCoords ?? null,
          placeId: authoredPlaceId ?? null,
        },
      })
      if (!result.ok) {
        setPhotoMetaSaveStatus('error')
        return
      }
      setPhotoMetaSaveStatus('saved')
      setTimeout(() => setPhotoMetaSaveStatus('idle'), 2000)
    })
  }, [hasEntry, entryKind, entrySlug, authoredCoords, authoredPlaceId, startPhotoMetaTransition])

  // onSaveFilmSim — saves filmSim immediately on button click.
  // null = clear the authored override (reverts to EXIF filmSim at serve time).
  const onSaveFilmSim = useCallback((sim: string | null) => {
    setAuthoredFilmSim(sim)
    if (!hasEntry || !entrySlug) return
    setFilmSimSaveStatus('saving')
    startFilmSimTransition(async () => {
      const result = await updateEntry({
        kind: entryKind,
        slug: entrySlug,
        patch: { filmSim: sim ?? null },
      })
      if (!result.ok) {
        setFilmSimSaveStatus('error')
        return
      }
      setFilmSimSaveStatus('saved')
      setTimeout(() => setFilmSimSaveStatus('idle'), 2000)
    })
  }, [hasEntry, entryKind, entrySlug, startFilmSimTransition])

  // setEntryDraft handler — called by DRAFT⇄PUBLISH segmented switch.
  // Receives an explicit target boolean (not a blind flip) — mirrors .st-switch pattern.
  // target=false → publish; target=true → set to draft (hidden from prod).
  // Dependency array excludes `isHidden` (the target is passed in, not read from closure).
  const onSetHidden = useCallback((target: boolean) => {
    if (!hasEntry || !entrySlug) return
    setLifecycleError(null)
    startLifecycleTransition(async () => {
      const result = await setEntryDraft({ kind: entryKind, slug: entrySlug, draft: target })
      if (!result.ok) {
        setLifecycleError(result.error.message)
        return
      }
      // Update ONLY from the action's return value (decoupled — no velite refetch).
      setIsHidden(result.entry.draft)
    })
  }, [hasEntry, entryKind, entrySlug, startLifecycleTransition])

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

  // ESC keyboard handler — dismiss the delete confirm row when it is open.
  // Mirrors ImportZone's ESC pattern (window.addEventListener in useEffect).
  // Also clears any lifecycle error on ESC (secondary clean-up, no UX cost).
  // S6: Cmd+S wired to onSaveBody (real updateEntry call).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDeleteConfirming) {
          setIsDeleteConfirming(false)
          setLifecycleError(null)
        }
        return
      }
      // S6: Cmd+S / Ctrl+S → save body to DB (article) or instrument overrides (photo)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (kind === 'article' && hasEntry) onSaveBody()
        // photo Cmd+S saves instrument_overrides + coords/placeId to DB
        else if (kind === 'photo' && hasEntry) {
          onSaveInstrumentOverrides()
          onSavePhotoMeta()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isDeleteConfirming, kind, hasEntry, onSaveBody, onSaveInstrumentOverrides, onSavePhotoMeta])

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

  // RE-IMPORT confirm — inert (real content-layer wiring deferred per contract §non-goals)
  const onReImport = useCallback(() => {
    // MOCK: real re-import deferred. Inert.
  }, [])

  // ─────────────────────────────────────────────────────────────────────────────
  // S6: Photo upload flow (DL3 — direct-to-storage, then ingestPhoto server action)
  //
  // Per-file upload state: each file goes uploading → processing → done | failed.
  // The active roll is read from the URL slug (roll/id format) or defaults to
  // a session-level roll picked via the roll picker (TODO: roll picker UI).
  //
  // Architecture:
  //   1. Browser client uploads original to originals bucket
  //   2. ingestPhoto action runs sharp pipeline + upserts entries+photo_assets
  //   3. On success: append a real PhotoFrame with the returned slug
  //
  // The roll comes from the editor's URL (kind=photo&slug=roll/id) so we always
  // know the roll when in the photo editor. For a brand-new upload we read the roll
  // portion from `entrySlug` (format "roll/id") or use a fallback.
  // ─────────────────────────────────────────────────────────────────────────────

  type UploadStatus = 'uploading' | 'processing' | 'done' | 'failed'
  const [uploadStatuses, setUploadStatuses] = useState<Record<string, UploadStatus>>({})

  // BUG-1 fix: roll picker state for when the editor opens without a roll/id slug.
  // `selectedRoll` = the roll chosen in the picker (persists across uploads).
  // `newRollSlug` / `newRollDate` = inline new-roll creation form fields.
  // `isCreatingRoll` = true while the createRoll server action is in-flight.
  const [selectedRoll, setSelectedRoll] = useState<string | null>(null)
  const [newRollSlug, setNewRollSlug] = useState<string>('')
  const [newRollDate, setNewRollDate] = useState<string>(
    // Default to today in YYYY.MM.DD — matches SlugDateSchema format
    new Date().toISOString().slice(0, 10).replace(/-/g, '.')
  )
  const [isCreatingRoll, setIsCreatingRoll] = useState<boolean>(false)
  // BUG-2 / BUG-3 fix: visible upload error state — surfaced in the photo pane.
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Derive the roll from the URL slug (format "roll/id") or from the first existing frame
  const photoRoll = useMemo<string | null>(() => {
    if (entryKind === 'photo' && entrySlug) {
      const sep = entrySlug.indexOf('/')
      if (sep > 0) return entrySlug.slice(0, sep)
    }
    // Fallback: use the first existing frame's roll portion if any
    if (frames.length > 0 && activeFrame) {
      const f = frames.find((fr) => fr.id === activeFrame)
      if (f && f.id.includes('/')) return f.id.split('/')[0]
    }
    return null
  }, [entryKind, entrySlug, frames, activeFrame])

  // Effective roll: URL-derived first, then picker selection (BUG-1 fix).
  const effectiveRoll: string | null = photoRoll ?? selectedRoll

  const uploadAndIngest = useCallback(async (file: File) => {
    // BUG-1 fix: if still no roll after picker, BLOCK with visible message — never silently mock.
    if (!effectiveRoll) {
      setUploadError('pick or create a roll first')
      return
    }

    // heic-reject: early type guard — same logic as QuickUploadBar.rejectReason().
    // Must run BEFORE URL.createObjectURL(file), which is the crash site: browsers
    // may tab-kill when an <img> src tries to decode an undecoded HEIC blob.
    // Also prevents orphan originals in storage (file never reaches Step 1).
    const ext = (file.name.split('.').pop() ?? '').toLowerCase()
    const mime = file.type.toLowerCase()
    const SUPPORTED_EXTS = ['jpg', 'jpeg', 'png', 'webp']
    const SUPPORTED_MIMES = ['image/jpeg', 'image/png', 'image/webp']
    const isHeic = ext === 'heic' || ext === 'heif' || mime === 'image/heic' || mime === 'image/heif'
    const extOk = SUPPORTED_EXTS.includes(ext)
    const mimeOk = mime === '' || SUPPORTED_MIMES.includes(mime)
    if (isHeic) {
      setUploadError('HEIC not supported yet — please use JPEG')
      return
    }
    if (!extOk || !mimeOk) {
      const label = ext ? `.${ext}` : mime || 'unknown type'
      setUploadError(`${label} not supported — please use JPEG, PNG, or WebP`)
      return
    }

    setUploadError(null)

    // Generate a deterministic-looking photoId from the filename
    const base = file.name.replace(/\.[^.]+$/, '').toUpperCase().replace(/[^A-Z0-9_-]/g, '') || 'DSCF0000'
    const photoId = base.slice(0, 12)  // max 12 chars (photo_id constraint is 40 chars)
    const originalKey = `${effectiveRoll}/${photoId}.${ext}`
    const frameKey = `${effectiveRoll}/${photoId}`

    setUploadStatuses((s) => ({ ...s, [frameKey]: 'uploading' }))
    // Append placeholder frame immediately (degraded — no URL yet).
    // createObjectURL is safe here: the file type has already been validated above.
    const placeholderSrc = URL.createObjectURL(file)
    setFrames((fs) => [...fs, { id: frameKey, src: placeholderSrc, caption: file.name }])
    setActiveFrame(frameKey)

    try {
      // Step 1: direct-to-storage upload (DL3)
      const { createSupabaseBrowserClient } = await import('@/lib/store/supabase/browser')
      const supabase = createSupabaseBrowserClient()
      const { error: uploadErr } = await supabase.storage
        .from('originals')
        .upload(originalKey, file, { upsert: false })
      if (uploadErr) {
        // BUG-2 fix: surface the storage error message (auth expired, RLS, etc.)
        setUploadStatuses((s) => ({ ...s, [frameKey]: 'failed' }))
        setUploadError(`storage: ${uploadErr.message}`)
        return
      }

      setUploadStatuses((s) => ({ ...s, [frameKey]: 'processing' }))

      // Step 2: ingestPhoto server action (runs sharp pipeline server-side)
      const { ingestPhoto } = await import('@/lib/server/store/actions')
      const result = await ingestPhoto({
        roll: effectiveRoll,
        photoId,
        originalKey,
      })

      if (!result.ok) {
        // BUG-2 fix: surface the action error message (sharp fail, DB, RLS, etc.)
        setUploadStatuses((s) => ({ ...s, [frameKey]: 'failed' }))
        setUploadError(`ingest: ${result.error.message}`)
        return
      }

      setUploadStatuses((s) => ({ ...s, [frameKey]: 'done' }))
      // BUG-A fix: navigate to the new entry's editor URL so the page identity
      // (header FILE slug, right panel photo count, NETRA locus, URL) all reflect
      // the newly ingested photo. The route will load the real sidecar + EXIF
      // (via lookupPhotoSidecar admin path) and render the real thumbnail.
      const newSlug = `${effectiveRoll}/${photoId}`
      router.push(
        `/console/editor?kind=photo&slug=${encodeURIComponent(newSlug)}`
      )
    } catch (err) {
      // BUG-2 fix: capture and show the thrown error message (never swallow silently)
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[uploadAndIngest] unexpected error:', msg)
      setUploadStatuses((s) => ({ ...s, [frameKey]: 'failed' }))
      setUploadError(`unexpected: ${msg}`)
    }
  }, [effectiveRoll, router])

  // S6: photo import handler — real upload+ingest when in photo editor with a roll,
  // fallback mock for article/fiction (no ingest target).
  const onImportFile = useCallback(
    (file: File) => {
      if (kind === 'photo') {
        // Fire-and-forget the upload; status tracked in uploadStatuses
        void uploadAndIngest(file)
      }
      // article / fiction: inert (no file-body ingest this round per contract §non-goals)
    },
    [kind, uploadAndIngest],
  )

  // S6: + ADD FRAME button handler — opens file picker (same as before but uses real upload)
  const addFrame = useCallback((file?: File) => {
    if (file && kind === 'photo') {
      void uploadAndIngest(file)
    } else if (!file) {
      // Trigger the hidden file input (caller handles via frameInputRef)
    }
  }, [kind, uploadAndIngest])

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

  // S6: real onTransmit for PublishPanel — calls setEntryDraft(draft:false).
  // Only provided when a real entry is loaded (hasEntry). SAMPLE path gets no handler
  // → PublishPanel uses its 2s mock timer.
  const onTransmitReal = useCallback(async (): Promise<string | null> => {
    if (!hasEntry || !entrySlug) return 'no entry loaded'
    const result = await setEntryDraft({ kind: entryKind, slug: entrySlug, draft: false })
    if (!result.ok) {
      // PUBLISH_INCOMPLETE: surface the missing fields list
      if ('missingFields' in result.error && Array.isArray(result.error.missingFields)) {
        return `incomplete: ${result.error.missingFields.join(', ')}`
      }
      return result.error.message
    }
    // Reflect the published state in the toolbar badge
    setIsHidden(false)
    return null
  }, [hasEntry, entryKind, entrySlug])

  // S6: public URL for the done phase (DL11 — revalidatePath makes it live immediately)
  const publicUrl = hasEntry && entrySlug ? (
    entryKind === 'article' ? `/articles/${entrySlug}` :
    entryKind === 'fiction' ? `/fiction/${entrySlug}` :
    // photo slug = "roll/id" → /photos/roll/id
    `/photos/${entrySlug}`
  ) : undefined

  // Deploy hook URL from env — optional; no REINDEX button when absent
  // (DL5: PublishPanel exposes the affordance if the hook is configured)
  const reindexHookUrl = process.env.NEXT_PUBLIC_VERCEL_DEPLOY_HOOK_URL

  // PublishPanel — wired to real setEntryDraft when hasEntry.
  // Mounts INSIDE the active preview-wrap (position:relative + overflow:hidden)
  // so the slide-in is bounded to the preview pane and the source pane stays visible.
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
      onTransmit={hasEntry ? onTransmitReal : undefined}
      publicUrl={publicUrl}
      reindexHookUrl={reindexHookUrl ?? undefined}
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
          // ── T1 lifecycle props ──
          hasEntry={hasEntry}
          isHidden={isHidden}
          lifecyclePending={lifecyclePending}
          lifecycleError={lifecycleError}
          isDeleteConfirming={isDeleteConfirming}
          onDeleteStart={() => { setIsDeleteConfirming(true); setLifecycleError(null) }}
          onDeleteCancel={() => { setIsDeleteConfirming(false); setLifecycleError(null) }}
          onDeleteConfirm={onDeleteConfirm}
          onSetHidden={onSetHidden}
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
              {/* S6: pass real save handler when a real entry is loaded.
                  Image picker (model B): ◎ IMAGE button opens ImagePickerPanel.
                  textareaRef enables cursor-aware insert (insertAtCursor).
                  Wrapper div: position:relative + min-height:0 so ImagePickerPanel
                  (position:absolute inset:0) is bounded to this column (not the
                  whole editor) — mirrors the PublishPanel host pattern. */}
              {showSource && (
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                  <ArticleSourcePane
                    md={md}
                    onChange={setMd}
                    onSave={hasEntry ? onSaveBody : undefined}
                    saveStatus={hasEntry ? saveStatus : undefined}
                    textareaRef={textareaRef}
                    onOpenPicker={pickerPhotos.length > 0 ? () => setPickerOpen(true) : undefined}
                    pickerOpen={pickerOpen}
                  />
                  {/* ImagePickerPanel mounts in the same position:relative column so
                      it slides up covering only the source pane (not the toolbar or
                      preview pane). Same containment strategy as PublishPanel. */}
                  <ImagePickerPanel
                    open={pickerOpen}
                    photos={pickerPhotos}
                    onSelect={insertAtCursor}
                    onClose={() => setPickerOpen(false)}
                  />
                </div>
              )}
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
              {/* S6: hidden input — triggers real upload+ingest flow */}
              <input
                ref={frameInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                aria-hidden
                tabIndex={-1}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onImportFile(f)
                  e.target.value = ''
                }}
              />
              {outlineOpen && (
                <FramesRail
                  frames={frames}
                  active={activeFrame}
                  setActive={setActiveFrame}
                  setFrames={setFrames}
                  uploadStatuses={uploadStatuses}
                />
              )}
              {showSource && (() => {
                // BUG-1 fix: Roll picker — shown whenever photoRoll is null (no roll from URL slug).
                // Appears in BOTH the empty-state and the frames path (MOCK frames are seeded when
                // no real entry is loaded; the picker must still be visible in that case so Peat can
                // select a roll before clicking + ADD FRAME).
                const rollPickerNode = !photoRoll ? (
                  <div className="rp-wrap" role="group" aria-label="roll selection">
                    <div className="rp-head">{'// ROLL'}</div>

                    {/* Existing roll selector */}
                    <div className="rp-row">
                      <span className="rp-label" id="rp-existing-label">EXISTING</span>
                      {availableRolls.length > 0 ? (
                        <select
                          className="rp-select"
                          aria-labelledby="rp-existing-label"
                          value={selectedRoll ?? ''}
                          onChange={(e) => {
                            setSelectedRoll(e.target.value || null)
                            setUploadError(null)
                          }}
                        >
                          <option value="">— pick a roll —</option>
                          {availableRolls.map((r) => (
                            <option key={r.roll} value={r.roll}>
                              {r.roll}{r.caption ? ` · ${r.caption}` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="rp-label" style={{ color: 'var(--ink-faint)' }}>no rolls yet</span>
                      )}
                    </div>

                    {/* Inline new-roll creation form */}
                    <div className="rp-row">
                      <span className="rp-label" id="rp-new-label">NEW</span>
                      <input
                        className="rp-input"
                        type="text"
                        aria-labelledby="rp-new-label"
                        placeholder="YYYY-MM-place-slug"
                        value={newRollSlug}
                        onChange={(e) => setNewRollSlug(e.target.value)}
                      />
                      <input
                        className="rp-input"
                        type="text"
                        aria-label="roll date (YYYY.MM.DD)"
                        placeholder="YYYY.MM.DD"
                        value={newRollDate}
                        onChange={(e) => setNewRollDate(e.target.value)}
                        style={{ maxWidth: '110px' }}
                      />
                      <button
                        type="button"
                        className="rp-create-btn"
                        disabled={isCreatingRoll || !newRollSlug.trim()}
                        onClick={async () => {
                          if (!newRollSlug.trim()) return
                          setIsCreatingRoll(true)
                          setUploadError(null)
                          try {
                            const { createRoll } = await import('@/lib/server/store/actions')
                            const result = await createRoll({
                              roll: newRollSlug.trim(),
                              date: newRollDate.trim(),
                            })
                            if (!result.ok) {
                              setUploadError(`create roll: ${result.error.message}`)
                            } else {
                              // Roll created — select it so the next upload uses it
                              setSelectedRoll(result.roll.roll)
                              setNewRollSlug('')
                            }
                          } catch (e) {
                            const msg = e instanceof Error ? e.message : String(e)
                            console.error('[createRoll] unexpected error:', msg)
                            setUploadError(`create roll: ${msg}`)
                          } finally {
                            setIsCreatingRoll(false)
                          }
                        }}
                      >
                        {isCreatingRoll ? 'CREATING…' : '+ CREATE'}
                      </button>
                    </div>

                    {/* Active roll indicator */}
                    {selectedRoll && (
                      <div className="rp-row">
                        <span className="rp-label">ACTIVE</span>
                        <span className="rp-active">{selectedRoll}</span>
                      </div>
                    )}

                    {/* Upload error inside picker (BUG-2/3 fix) */}
                    {uploadError && (
                      <div className="rp-error" role="alert" aria-live="polite">
                        {uploadError}
                      </div>
                    )}
                  </div>
                ) : null

                // Upload error strip when photoRoll IS set from URL (BUG-2 fix)
                const urlRollErrorNode = photoRoll && uploadError ? (
                  <div className="up-error-strip" role="alert" aria-live="polite">
                    {uploadError}
                  </div>
                ) : null

                return frames.length === 0 ? (
                  // Empty photo source pane → Roll picker + ImportZone drop target.
                  <div className="src-pane">
                    {rollPickerNode}
                    {urlRollErrorNode}
                    <ImportZone
                      onImport={(file) => addFrame(file)}
                      hasContent={false}
                    />
                  </div>
                ) : (
                  // Frames present — roll picker (if no URL roll) + error strip + PhotoManager.
                  // Wrap in flex column so picker/error strip sit above PhotoManager's flex body.
                  <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {rollPickerNode}
                    {urlRollErrorNode}
                    <PhotoManager
                      frames={frames}
                      setFrames={setFrames}
                      active={activeFrame}
                      setActive={setActiveFrame}
                      onAdd={() => frameInputRef.current?.click()}
                      reading={false}
                      // lens-override wiring: instrument overrides state + handlers
                      instrumentOverrides={instrumentOverrides}
                      onInstrumentOverridesChange={setInstrumentOverrides}
                      instrumentSaveStatus={hasEntry ? instrumentSaveStatus : undefined}
                      onInstrumentSave={hasEntry ? onSaveInstrumentOverrides : undefined}
                      // photo-meta-harness: coords / place / filmSim (sirius slice)
                      authoredCoords={authoredCoords}
                      onAuthoredCoordsChange={setAuthoredCoords}
                      authoredPlaceId={authoredPlaceId}
                      onAuthoredPlaceIdChange={setAuthoredPlaceId}
                      availablePlaces={availablePlaces}
                      photoMetaSaveStatus={hasEntry ? photoMetaSaveStatus : undefined}
                      onPhotoMetaSave={hasEntry ? onSavePhotoMeta : undefined}
                      authoredFilmSim={authoredFilmSim}
                      onFilmSimSave={hasEntry ? onSaveFilmSim : undefined}
                      filmSimSaveStatus={hasEntry ? filmSimSaveStatus : undefined}
                      // B2: caption zone (photo-feedback spec §Change B2)
                      caption={hasEntry ? authoredCaption : undefined}
                      onCaptionSave={hasEntry ? onSaveCaption : undefined}
                      captionSaveStatus={hasEntry ? captionSaveStatus : undefined}
                    />
                  </div>
                )
              })()}
              {showPreview && (
                <div
                  className="ed-preview-wrap is-photo-preview"
                  id="ed-preview"
                >
                  {/* REAL preview when the route loaded a velite sidecar (reuses
                      the public <PhotoEntry> + working FilmSimSwitcher). When
                      absent, PhotoPreview falls back to its MOCK styled-slot
                      spread (graceful — no crash). Only ONE [data-photo-entry-root]
                      mounts here; FullPreview's photo path stays MOCK so the
                      switcher's global querySelector never grabs a hidden root.
                      is-photo-preview: BUG-C fix — relaxes overflow-x on the
                      wrapper so PhotoEntry's wide grid can scroll, not overflow. */}
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

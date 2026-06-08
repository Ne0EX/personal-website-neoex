/**
 * components/console/ArticleEditor.tsx — Article Editor · Direction C (three-column)
 * ─────────────────────────────────────────────────────────────────────────────
 * 'use client' — uses useState / useMemo for mode, outline toggle, and md state.
 *
 * Layout: three-column, Direction C.
 *   Outline rail (212px) | Source pane (1fr) | Preview pane (1fr)    ← SPLIT mode
 *   Outline rail (212px) | Preview pane (1fr)                        ← PAGE mode
 *   Source pane (1fr)    | Preview pane (1fr)                        ← SPLIT, outline closed
 *   Preview pane (1fr)                                               ← PAGE, outline closed
 *
 * Slice-1 scope:
 *   - md initialized to SAMPLE_MD (import zone deferred to Slice 1.5)
 *   - No ImportZone, no RE-IMPORT, no full-preview overlay, no PUBLISH
 *   - PAGE mode is READ-ONLY preview (ArticleEntryContent is shared/agnostic —
 *     WYSIWYG editing would require a contentEditable layer over the shared
 *     component, which risks the byte-identical public-page invariant).
 *     See Polaris return: "PAGE mode is read-only in Slice 1."
 *
 * TOKEN-GAP for Betelgeuse:
 *   - 212px outline rail width
 *   - 46px toolbar height
 *   - rgba(212,96,42,0.02) / 0.03 / 0.05 — accent tints below --accent-orange-soft
 *
 * Owner: Sirius (α-SUR-01) · atlas-console Slice 1
 * Modeled after: editor-core.jsx (ArticleEditor@65, Toolbar@6, Outline@44, SourcePane@35)
 * Prototype CSS: Article Editor.html .ed-* + .src-* + .outline-* + .ed-rail classes
 */

'use client'

import { useState, useMemo } from 'react'
import type { Article } from '@/lib/content/types'
import { ArticlePreview } from '@/components/console/ArticlePreview'

// ─────────────────────────────────────────────────────────────────────────────
// SAMPLE_META → draftArticle
// Mapped from prototype's SAMPLE_META (editor-engine.jsx@7).
// isoDate derived from date per velite transform convention.
// ─────────────────────────────────────────────────────────────────────────────

export const SAMPLE_DRAFT: Article = {
  fileNum:       '003',
  kind:          'article',
  title:         'on the architecture of taste',
  date:          '2026.05.07',
  isoDate:       '2026-05-07',
  domain:        'method',
  tags:          ['essay', 'identity'],
  status:        'ongoing',
  readingTime:   8,
  summary:       "taste isn't preference; it's a load-bearing structure — a record of what you choose to keep, what you let go, and the residue that becomes you.",
  coords:        { lat: 35.01, lon: 135.77, place: 'Kyoto · JP' },
  shareLocation: true,
  placeId:       'kyoto',
  highlightForPlace: false,
  worldline_links: [],
  draft:         false,
}

// ─────────────────────────────────────────────────────────────────────────────
// SAMPLE_MD — initial editor content (Slice 1; import zone deferred to 1.5)
// Ported from prototype editor-engine.jsx@14.
// ─────────────────────────────────────────────────────────────────────────────

export const SAMPLE_MD = `the question isn't whether you have taste. everyone does. the question is whether you've *surveyed* it — walked its perimeter, noted where it holds and where it gives.

## what taste loads

taste isn't preference. preference is cheap, instant, disposable. taste is the slow architecture underneath — the **load-bearing structure** that decides what you keep and what you let fall away.

> a record of what i keep, what i let go, and the residue that becomes me.

i used to think taste was a museum: a collection of approved objects behind glass. now i think it is closer to a building site. always under construction, never finished, occasionally condemned and rebuilt from the footings.

## the residue

what survives the demolition is the part worth surveying. the \`coordinates\` above mark where this was taken — the observer α has since moved on. the worldline drifts; the file stays pinned.

- keep what is load-bearing
- let go of what is decorative
- survey the seam between them

---

this file stays open. it will change. that is the point — a laboratory, not an archive of conclusions.`

// ─────────────────────────────────────────────────────────────────────────────
// Editor shell + component styles (no CSS module — inline style + class atoms)
// All .ed-* / .src-* / .outline-* scoped by their prefix (no globals collision).
// TOKEN-GAPs marked inline per codebase convention.
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
  height: 46px; /* TOKEN-GAP: 46px toolbar height */
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px dashed var(--ink-dashed);
}
.ed-tb-left {
  display: flex;
  align-items: center;
  gap: 10px;
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
}
.ed-back:hover, .ed-back:focus-visible {
  color: var(--ink-primary);
  outline: none;
}
.ed-back:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}
.ed-tb-sep {
  color: var(--ink-faint);
}
.ed-tb-file {
  font-size: 9px;
  letter-spacing: 0.2em;
  color: var(--ink-primary);
  text-transform: uppercase;
  white-space: nowrap;
}
.ed-tb-kind {
  font-size: 8px;
  letter-spacing: 0.2em;
  color: var(--ink-soft);
  text-transform: uppercase;
  border: 1px solid var(--ink-hairline);
  padding: 2px 6px;
}

/* ── outline toggle (accent-orange solid when shown, neutral when hidden) */
.ed-srctoggle {
  appearance: none;
  background: transparent;
  border: 1px solid var(--ink-hairline);
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: 0.18em;
  color: var(--ink-soft);
  padding: 7px 11px;
  cursor: pointer;
  text-transform: uppercase;
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

/* ── SPLIT / PAGE mode toggle ──────────────────────────────────────── */
.ed-modes {
  display: flex;
  border: 1px solid var(--ink-hairline);
}
.ed-mode {
  appearance: none;
  background: transparent;
  border: none;
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: 0.18em;
  color: var(--ink-soft);
  padding: 7px 13px;
  cursor: pointer;
  text-transform: uppercase;
}
.ed-mode.is-on {
  background: var(--ink-primary);
  color: var(--paper-base);
}
.ed-mode:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}

/* ── status line ───────────────────────────────────────────────────── */
.ed-prov {
  flex-shrink: 0;
  font-size: 8px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-faint);
  padding: 6px 16px;
  border-bottom: 1px solid var(--ink-hairline);
}
.ed-prov b {
  color: var(--ink-soft);
}

/* ── pane grid ─────────────────────────────────────────────────────── */
.ed-3pane {
  flex: 1;
  display: grid;
  min-height: 0;
  overflow: hidden;
}
.ed-3pane > * {
  min-height: 0;
  min-width: 0;
}
.ed-preview-wrap {
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
.src-count {
  color: var(--ink-faint);
}
.src-text {
  flex: 1;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.9;
  letter-spacing: 0.01em;
  color: var(--ink-primary);
  padding: 0 14px 16px;
  min-height: 0;
  overflow-y: auto;
}
.src-text:focus {
  background: rgba(212,96,42,0.02); /* TOKEN-GAP: 0.02 accent tint */
}

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
  font-size: 8px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--ink-faint);
  margin-bottom: 9px;
}
.outline-empty {
  font-size: 9px;
  color: var(--ink-faint);
  font-style: italic;
}
.outline-row {
  font-size: 9.5px;
  letter-spacing: 0.05em;
  color: var(--ink-primary);
  padding: 4px 0;
  cursor: pointer;
}
.outline-row.lvl3 {
  padding-left: 14px;
  color: var(--ink-soft);
  font-size: 9px;
}
.outline-tick {
  color: var(--accent-orange);
}
.outline-row:hover {
  color: var(--accent-orange);
}
.ed-rail-src {
  /* Source provenance section at the bottom of the outline rail */
}
.ed-rail-prov {
  font-family: var(--font-type);
  font-size: 9px;
  color: var(--ink-soft);
  letter-spacing: 0.04em;
}

@media (prefers-reduced-motion: reduce) {
  /* No animated transitions in this editor shell currently. */
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Mode type
// ─────────────────────────────────────────────────────────────────────────────

type EditorMode = 'split' | 'wysiwyg'
type EntryKind = 'article' | 'fiction' | 'photo'

// ─────────────────────────────────────────────────────────────────────────────
// Toolbar — stable (always shown; import zone deferred → md always truthy)
// ─────────────────────────────────────────────────────────────────────────────

interface ToolbarProps {
  fileNum:      string
  /** Semantic content kind for the toolbar label (article/fiction/photo). */
  entryKind:    EntryKind
  mode:         EditorMode
  onMode:       (m: EditorMode) => void
  outlineOpen:  boolean
  onOutline:    () => void
}

/** Kind → toolbar glyph. Mirrors KINDS in console-types.ts. */
const KIND_GLYPH: Record<EntryKind, string> = {
  article: '◆',
  fiction: '△',
  photo:   '◎',
}

function Toolbar({ fileNum, entryKind, mode, onMode, outlineOpen, onOutline }: ToolbarProps) {
  return (
    <div className="ed-toolbar">
      <div className="ed-tb-left">
        {/* ⟵ CONSOLE — Slice 2: /console front door now exists (nav round-trip complete) */}
        <a
          className="ed-back"
          href="/console"
          title="back to the console"
          aria-label="back to console"
        >
          ⟵ CONSOLE
        </a>
        <span className="ed-tb-sep" aria-hidden>·</span>
        <span className="ed-tb-file">{KIND_GLYPH[entryKind]} FILE {fileNum}</span>
        {/* Tier-b: toolbar label reflects real kind from URL searchParams */}
        <span className="ed-tb-kind">{entryKind.toUpperCase()}</span>
      </div>

      <div className="ed-tb-right">
        {/* Outline toggle — solid accent-orange when open, neutral bordered when closed */}
        <button
          type="button"
          className={'ed-srctoggle' + (outlineOpen ? ' is-on' : '')}
          onClick={onOutline}
          aria-pressed={outlineOpen}
          title={outlineOpen ? 'hide outline rail' : 'show outline rail'}
        >
          ⊟ OUTLINE
        </button>

        {/* SPLIT / PAGE mode */}
        <div className="ed-modes" role="group" aria-label="preview mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'split'}
            className={'ed-mode' + (mode === 'split' ? ' is-on' : '')}
            onClick={() => onMode('split')}
          >
            SPLIT
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'wysiwyg'}
            className={'ed-mode' + (mode === 'wysiwyg' ? ' is-on' : '')}
            onClick={() => onMode('wysiwyg')}
          >
            PAGE
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Outline — section heading rail
// ─────────────────────────────────────────────────────────────────────────────

interface OutlineProps {
  md:     string
  source: string
}

function Outline({ md, source }: OutlineProps) {
  // Derived synchronously in render — no useEffect (rule: no useEffect for derived state)
  const heads = (md || '').split('\n')
    .filter(l => /^#{1,3} /.test(l))
    .map(l => {
      const lvl = (l.match(/^#+/) as RegExpMatchArray)[0].length
      return { lvl, text: l.replace(/^#+ /, '') }
    })

  return (
    <aside className="ed-rail" aria-label="document outline">
      <div>
        <div className="rail-head">// OUTLINE</div>
        {heads.length === 0 && (
          <div className="outline-empty" aria-live="polite">no headings yet</div>
        )}
        {heads.map((h, i) => (
          <div
            key={i}
            className={'outline-row lvl' + h.lvl}
          >
            <span className="outline-tick" aria-hidden>§</span>{' '}
            {h.text}
          </div>
        ))}
      </div>

      <div className="ed-rail-src">
        <div className="rail-head">// SOURCE</div>
        <div className="ed-rail-prov">{source}</div>
      </div>
    </aside>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SourcePane — markdown textarea
// ─────────────────────────────────────────────────────────────────────────────

interface SourcePaneProps {
  md:       string
  onChange: (v: string) => void
}

function SourcePane({ md, onChange }: SourcePaneProps) {
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
        onChange={e => onChange(e.target.value)}
        aria-label="markdown source editor"
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ArticleEditor — three-column Direction C
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// ArticleEditor props
// ─────────────────────────────────────────────────────────────────────────────

interface ArticleEditorProps {
  /**
   * Pre-filled draft from velite metadata (tier-b: metadata only).
   * When provided, seeds fileNum/title/date/domain/tags/summary/kind.
   * When absent, falls back to SAMPLE_DRAFT.
   *
   * Shape is Article — fiction/photo entries are mapped to Article shape in the
   * page Server Component with safe defaults for Article-only fields.
   * FIELD-GAP(Procyon): fiction/photo gaps documented in editor/page.tsx lookupDraft.
   */
  initialDraft?: Article
  /**
   * Semantic kind from the URL searchParams (?kind=…).
   * Drives the toolbar label (ARTICLE / FICTION / PHOTO) independently of
   * the draft's .kind field (which is always 'article' for type compat).
   * When absent (no URL params / SAMPLE_DRAFT path), defaults to 'article'.
   */
  entryKind?: EntryKind
}

// ─────────────────────────────────────────────────────────────────────────────
// ArticleEditor — three-column Direction C
// ─────────────────────────────────────────────────────────────────────────────

export function ArticleEditor({ initialDraft, entryKind }: ArticleEditorProps = {}) {
  // Seed from initialDraft when provided; fall back to SAMPLE_DRAFT.
  // Body stays SAMPLE_MD — velite has no body field.
  // tier-c: real article body deferred (velite has no body field — TODO Procyon)
  const draft = initialDraft ?? SAMPLE_DRAFT

  const [md, setMd]               = useState<string>(SAMPLE_MD)
  const [mode, setMode]           = useState<EditorMode>('split')
  const [outlineOpen, setOutline] = useState<boolean>(true)

  // Resolved kind for toolbar display. Defaults to 'article' on SAMPLE_DRAFT path.
  const resolvedKind: EntryKind = entryKind ?? 'article'

  // Grid columns computed from mode × outlineOpen.
  // 212px = outline rail width (TOKEN-GAP: no spacing token)
  const gridCols = useMemo<string>(() => {
    if (outlineOpen) return mode === 'split' ? '212px 1fr 1fr' : '212px 1fr'
    return mode === 'split' ? '1fr 1fr' : '1fr'
  }, [outlineOpen, mode])

  // Status line text — mirrors prototype .ed-prov
  const statusText = useMemo<string>(() => {
    const modeLabel = mode === 'split' ? 'split source ↔ preview' : 'full page preview'
    const outlineLabel = !outlineOpen ? ' · outline hidden' : ''
    // Distinguish "live entry" from "sample" in the status line
    const source = initialDraft ? 'velite metadata · draft body placeholder' : 'sample draft'
    return `${source} · ${modeLabel}${outlineLabel}`
  }, [mode, outlineOpen, initialDraft])

  return (
    <>
      <style>{EDITOR_CSS}</style>

      <div className="ed" style={{ height: '100svh' }}>
        {/* Skip link for keyboard navigation — targets #ed-main (the pane grid) */}
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
          onFocus={e => { (e.target as HTMLAnchorElement).style.top = '0' }}
          onBlur={e => { (e.target as HTMLAnchorElement).style.top = '-40px' }}
        >
          skip to editor
        </a>

        {/* ── Toolbar ── */}
        <Toolbar
          fileNum={draft.fileNum}
          entryKind={resolvedKind}
          mode={mode}
          onMode={setMode}
          outlineOpen={outlineOpen}
          onOutline={() => setOutline(o => !o)}
        />

        {/* ── Status line ── */}
        <div className="ed-prov" aria-live="polite">
          {statusText}
        </div>

        {/* ── Three-column pane grid ── */}
        {/* id="ed-main" + tabIndex={-1}: skip-link target — must be focusable */}
        <div
          id="ed-main"
          tabIndex={-1}
          className="ed-3pane"
          style={{ gridTemplateColumns: gridCols }}
        >
          {/* Outline rail — shown when outlineOpen */}
          {outlineOpen && <Outline md={md} source="markdown" />}

          {/* Source pane — shown in SPLIT mode */}
          {mode === 'split' && (
            <SourcePane md={md} onChange={setMd} />
          )}

          {/* Preview pane — always shown. `draft` carries real velite metadata when
              initialDraft is provided (title/date/domain/tags/summary/fileNum from velite).
              Body (md) stays SAMPLE_MD — tier-c: real body deferred (TODO Procyon). */}
          <div className="ed-preview-wrap" id="ed-preview">
            <ArticlePreview article={draft} md={md} />
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * components/console/FictionPreview.tsx — Full Editor · FICTION preview pane
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure render — no 'use client' (mirrors ArticlePreview: server-renderable,
 * no interactive state). Reuses the markdown engine (Blocks + parseMarkdown)
 * READ-ONLY for body rendering.
 *
 * Contract: docs/design/atlas-console-full-editor.md §4 (FictionPreview) +
 * per-kind FICTION preview pane. Bound EXACTLY to the prop interface:
 *
 *   interface FictionPreviewProps {
 *     meta:     FictionMeta
 *     chapters: FictionChapter[]
 *     activeId: string | null     // chapter.id to display (NOT 'active')
 *     status?:  string            // entry-level status (ongoing / settled)
 *   }
 *
 * Renders the ACTIVE chapter (activeId → fallback chapters[0]):
 *   - chapter title in Cormorant Garamond 24px (drift-correction; prototype
 *     conflated this with a bold sans register)
 *   - state badge — mono 9px: DRAFT = ink-faint, SETTLED = ink-primary
 *   - chapter body rendered as markdown via Blocks (READ-ONLY engine reuse)
 *
 * CRITICAL CSS NOTE
 * ─────────────────
 * `Blocks` emits `.wlc-*` class names that are styled ONLY inside ArticlePreview's
 * embedded <style> (scoped under `.wlc-preview-body`). That stylesheet is NOT in
 * scope when FictionPreview renders alone → prose would be unstyled. So this file
 * carries its OWN scoped <style> that restyles the `.wlc-*` classes under the
 * `.ficp-body` fiction root. Per the contract typography table, the fiction body
 * register is Cormorant Garamond 16px (em→italic) — NOT the article mono 13px.
 * Every rule is scoped under `.ficp-body` so it never collides with / overrides
 * ArticlePreview's `.wlc-preview-body .wlc-*` rules if both coexist.
 *
 * Provenance line (`SOURCE: {fileNum} · {n} CHAPTERS · {state}`) is rendered by
 * the EDITOR SHELL (the `.ed-prov` row), not here — same as ArticleEditor renders
 * `.ed-prov` outside ArticlePreview. Flagged to the integrator.
 *
 * SCHEMA-NEEDS (Procyon): FictionMeta / FictionChapter unconfirmed in the content
 * schema — chapters arrive via props (mock seed lives in FictionManager).
 *
 * Owner: Sirius (α-SUR-01) · atlas-console full editor (FICTION unit)
 * Prototype: editor-kinds.jsx FictionPreview@228 (REFERENCE — chrome discarded:
 *   NETRA voice / marginalia / back-link not in contract scope for this pane)
 */

import { Blocks, parseMarkdown } from './markdown'
import type { FictionChapter, FictionMeta } from './editor-types'

// ─────────────────────────────────────────────────────────────────────────────
// Scoped CSS — `.ficp-*` prefix + `.wlc-*` body restyle, all under `.ficp-body`.
// References globals.css tokens only.
//
// TOKEN-GAP for Betelgeuse:
//   - 620px (column max-width) — no token
//   - 34px / 70px (column padding) — no spacing token
//   - 18px quote padding-left · 2px quote border width — no token
//   - rgb(var(--ink-rgb) / 0.06) inline-code tint — matches ArticlePreview precedent
// ─────────────────────────────────────────────────────────────────────────────

const FICP_CSS = `
.ficp {
  height: 100%;
  overflow-y: auto;
  background: var(--paper-base);
}
.ficp-col {
  max-width: 620px; /* TOKEN-GAP: 620px column max-width */
  margin: 0 auto;
  padding: 34px 34px 70px; /* TOKEN-GAP: 34px / 70px */
}

/* ── chapter header: state badge + Cormorant title ──────────────────── */
.ficp-state {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  margin-bottom: 8px;
}
/* drift-correction (//CHAPTERS spec): DRAFT = ink-faint, SETTLED = ink-primary */
.ficp-state.is-draft   { color: var(--ink-faint); }
.ficp-state.is-settled { color: var(--ink-primary); }

.ficp-title {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 500;
  font-size: 24px;
  line-height: 1.15;
  color: var(--ink-primary);
  margin: 0 0 6px;
}
.ficp-chapnum {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ink-soft);
  margin-bottom: 22px;
}
.ficp-rule {
  border: none;
  border-top: 1px dashed var(--ink-dashed);
  margin: 0 0 26px;
}

/* ── empty state ────────────────────────────────────────────────────── */
.ficp-empty {
  display: grid;
  place-items: center;
  min-height: 200px;
  padding: 40px;
  text-align: center;
  font-family: var(--font-display);
  font-style: italic;
  font-size: 14px;
  color: var(--ink-soft);
}

/* ── body block restyle — Cormorant register (fiction prose) ─────────── */
/* Scoped under .ficp-body so it never overrides ArticlePreview's .wlc-preview-body
   rules. Blocks emits .wlc-* class names — restyled here for the fiction body. */
.ficp-body .wlc-p {
  font-family: var(--font-display);
  font-size: 16px;
  line-height: 1.7;
  color: var(--ink-primary);
  margin: 0 0 18px;
}
.ficp-body .wlc-p em,
.ficp-body .wlc-ul li em {
  font-style: italic;
}
.ficp-body .wlc-h2 {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 500;
  font-size: 21px;
  line-height: 1.2;
  color: var(--ink-primary);
  margin: 28px 0 12px;
}
.ficp-body .wlc-h3 {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 500;
  font-size: 18px;
  color: var(--ink-primary);
  margin: 22px 0 10px;
}
.ficp-body .wlc-hr {
  border: none;
  border-top: 1px dashed var(--ink-dashed);
  margin: 0 0 26px;
}
.ficp-body .wlc-quote {
  margin: 24px 0;
  padding-left: 18px; /* TOKEN-GAP: 18px */
  border-left: 2px solid var(--accent-orange); /* TOKEN-GAP: 2px */
  font-family: var(--font-display);
  font-style: italic;
  font-size: 19px;
  line-height: 1.4;
  color: var(--ink-soft);
}
.ficp-body .wlc-quote-mark {
  color: var(--accent-orange);
  font-size: 28px;
  line-height: 0;
  margin-right: 2px;
  vertical-align: -6px;
}
.ficp-body .wlc-ul {
  margin: 0 0 18px;
  padding-left: 4px;
}
.ficp-body .wlc-ul li {
  font-family: var(--font-display);
  font-size: 16px;
  line-height: 1.6;
  color: var(--ink-primary);
  margin-bottom: 5px;
  list-style: none;
  position: relative;
  padding-left: 16px;
}
.ficp-body .wlc-ul li::before {
  content: '◇';
  position: absolute;
  left: 0;
  color: var(--accent-orange);
  font-size: 9px;
  top: 5px;
}
.ficp-body .wlc-code {
  font-family: var(--font-type);
  font-size: 13px;
  background: rgb(var(--ink-rgb) / 0.06);
  padding: 1px 5px;
  color: var(--ink-primary);
}
.ficp-body .wlc-figure {
  margin: 24px 0;
}
.ficp-body .wlc-img-slot {
  border: 1px dashed var(--ink-dashed);
  height: 190px;
  display: grid;
  place-items: center;
  color: var(--ink-faint);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}
.ficp-body strong {
  font-weight: 600;
  color: var(--ink-primary);
}
.ficp-body > *:first-child { margin-top: 0; }

@media (prefers-reduced-motion: reduce) {
  /* No animations in this pane. Placeholder for future motion. */
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Props — bound EXACTLY to contract §4 (note: `activeId`, NOT `active`)
// ─────────────────────────────────────────────────────────────────────────────

export interface FictionPreviewProps {
  meta:     FictionMeta
  chapters: FictionChapter[]
  activeId: string | null
  /** Entry-level status (ongoing / settled). Reserved for the shell-rendered
   *  provenance line; the per-chapter state badge derives from the chapter. */
  status?:  string
}

// ─────────────────────────────────────────────────────────────────────────────
// FictionPreview — renders the ACTIVE chapter as a prose page
// ─────────────────────────────────────────────────────────────────────────────

export function FictionPreview({ meta, chapters, activeId }: FictionPreviewProps) {
  // Resolve the chapter to display: activeId → fallback chapters[0].
  const ch = chapters.find(c => c.id === activeId) ?? chapters[0] ?? null

  if (!ch) {
    return (
      <>
        <style>{FICP_CSS}</style>
        <div className="ficp paper-canvas">
          <div className="ficp-empty">no chapters yet — add one to begin</div>
        </div>
      </>
    )
  }

  const idx = Math.max(0, chapters.findIndex(c => c.id === ch.id))
  const blocks = parseMarkdown(ch.body)
  const stateLabel = ch.state === 'draft' ? 'DRAFT' : 'SETTLED'

  return (
    <>
      <style>{FICP_CSS}</style>

      <div className="ficp paper-canvas">
        <div className="ficp-col">
          {/* state badge — DRAFT (ink-faint) / SETTLED (ink-primary) */}
          <div className={'ficp-state ' + (ch.state === 'draft' ? 'is-draft' : 'is-settled')}>
            {stateLabel}
          </div>

          {/* chapter title — Cormorant Garamond 24px */}
          <h2 className="ficp-title">{ch.title}</h2>

          {/* chapter index line */}
          <div className="ficp-chapnum">
            {meta.fileNum} · {String(idx + 1).padStart(2, '0')} / {String(chapters.length).padStart(2, '0')}
          </div>

          <hr className="ficp-rule" />

          {/* chapter prose — markdown engine reused READ-ONLY */}
          <div className="ficp-body">
            <Blocks blocks={blocks} />
          </div>
        </div>
      </div>
    </>
  )
}

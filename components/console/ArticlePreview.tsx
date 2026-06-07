/**
 * components/console/ArticlePreview.tsx — Article Editor · Scoped Preview Shell
 * ─────────────────────────────────────────────────────────────────────────────
 * Scoped inline preview pane for the Article Editor. NOT a full page:
 *   - No PageShell / Nav / BootSequence / ScrollMeter / fixed MarginaliaHUD.
 *   - Provides a non-fixed marginalia rail (decorative, aria-hidden), centered
 *     scroll column, and `paper-canvas` surface — all scoped to this pane.
 *   - Feeds live body into ArticleEntryContent via the `body` seam.
 *
 * Option-A wiring (IMPLEMENTATION-PLAN.md crux):
 *   <ArticleEntryContent article={draftArticle} body={<Blocks blocks={parseMarkdown(md)} />} />
 *   The prototype's EntryPreview chrome is DISCARDED — ArticleEntryContent IS that chrome.
 *
 * Styling note: .ep-* / .wlc-* classes exist ONLY in the embedded <style> block below
 * (not in globals.css). All colors/fonts reference CSS variables from globals.css.
 * Literal values with no token: see TOKEN-GAP comments — list forwarded to Betelgeuse.
 *
 * Owner: Sirius (α-SUR-01) · atlas-console Slice 1
 * Modeled after: ArticleEntry.tsx (style block pattern, PATCHES_CSS precedent)
 * Prototype: editor-engine.jsx@110 (read for body-block CSS hooks; chrome discarded)
 */

import type { Article } from '@/lib/content/types'
import { ArticleEntryContent } from '@/components/ArticleEntry'
import { Blocks, parseMarkdown } from '@/components/console/markdown'

// ─────────────────────────────────────────────────────────────────────────────
// Scoped body-block CSS + preview shell CSS
// Embedded here (not a CSS module) per codebase precedent (ArticleEntry PATCHES_CSS).
// All class names scoped under .wlc-preview-body to avoid globals.css collisions.
//
// TOKEN-GAP for Betelgeuse:
//   - 26px (marginalia rail width) — no spacing token
//   - 34px (ep-col top/bottom padding) — no spacing token
//   - 600px (ep-col max-width) — no token
//   - rgba(212,96,42,0.02) focus tint — globals has --accent-orange-soft at 0.18 only
//   - rgba(212,96,42,0.03) hover tint — same gap
//   - 18px quote padding-left — no spacing token (use var(--space-*) when defined)
//   - 2px quote border-left width — no token
// ─────────────────────────────────────────────────────────────────────────────

const PREVIEW_CSS = `
/* ── scoped body-block styles ──────────────────────────────────────── */
/* All under .wlc-preview-body to not touch globals */

.wlc-preview-body .wlc-p {
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.8;
  letter-spacing: 0.01em;
  color: var(--ink-primary);
  margin: 0 0 18px;
}
.wlc-preview-body .wlc-h2 {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 500;
  font-size: 25px;
  line-height: 1.2;
  color: var(--ink-primary);
  margin: 30px 0 14px;
}
.wlc-preview-body .wlc-h3 {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 500;
  font-size: 19px;
  color: var(--ink-primary);
  margin: 24px 0 10px;
}
.wlc-preview-body .wlc-hr {
  border: none;
  border-top: 1px dashed var(--ink-dashed);
  margin: 0 0 26px;
}
.wlc-preview-body .wlc-quote {
  margin: 24px 0;
  padding-left: 18px;
  border-left: 2px solid var(--accent-orange);
  font-family: var(--font-display);
  font-style: italic;
  font-size: 21px;
  line-height: 1.4;
  color: var(--ink-soft);
}
.wlc-preview-body .wlc-quote-mark {
  color: var(--accent-orange);
  font-size: 30px;
  line-height: 0;
  margin-right: 2px;
  vertical-align: -6px;
}
.wlc-preview-body .wlc-ul {
  margin: 0 0 18px;
  padding-left: 4px;
}
.wlc-preview-body .wlc-ul li {
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.7;
  color: var(--ink-primary);
  margin-bottom: 5px;
  list-style: none;
  position: relative;
  padding-left: 16px;
}
.wlc-preview-body .wlc-ul li::before {
  content: '◇';
  position: absolute;
  left: 0;
  color: var(--accent-orange);
  font-size: 9px;
  top: 3px;
}
.wlc-preview-body .wlc-code {
  font-family: var(--font-type);
  font-size: 12px;
  background: rgb(var(--ink-rgb) / 0.06);
  padding: 1px 5px;
  color: var(--ink-primary);
}
.wlc-preview-body .wlc-figure {
  margin: 24px 0;
}
.wlc-preview-body .wlc-img-slot {
  border: 1px dashed var(--ink-dashed);
  height: 190px;
  display: grid;
  place-items: center;
  color: var(--ink-faint);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  background: rgba(216,207,185,0.25); /* TOKEN-GAP: paper-tint — no token */
}
.wlc-preview-body strong {
  font-weight: 500;
  color: var(--ink-primary);
}
/* FIX(gap#5): zero top margin on the first block so a leading h2/h3 does not
   carry its 30px/24px top margin. Placed after .wlc-preview-body .wlc-h2/h3
   rules (specificity ties resolved by source order — this wins). Uses
   .wl-body because Blocks are children of that div, not direct children of
   .wlc-preview-body. Scoped under .wlc-preview-body so it stays editor-only. */
.wlc-preview-body .wl-body > *:first-child { margin-top: 0; }

/* ── scoped non-fixed marginalia rail ─────────────────────────────── */
.wlc-preview .wlc-marginalia {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 26px; /* TOKEN-GAP: 26px marginalia rail width */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 18px 0;
  border-left: 1px dashed var(--ink-dashed);
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--ink-soft);
  background: repeating-linear-gradient(
    0deg,
    transparent 0 9px,
    rgb(var(--ink-rgb) / 0.05) 9px 10px
  );
  z-index: 2;
  pointer-events: none;
}
.wlc-preview .wlc-marginalia > span {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  white-space: nowrap;
}
.wlc-marginalia-acc {
  color: var(--accent-orange);
}

/* ── preview scroll column ───────────────────────────────────────── */
.wlc-preview .wlc-col {
  max-width: 600px; /* TOKEN-GAP: 600px column max-width */
  margin: 0 auto;
  padding: 34px 34px 70px; /* TOKEN-GAP: 34px / 70px */
  position: relative;
  z-index: 1;
}

@media (prefers-reduced-motion: reduce) {
  /* No transitions / animations used in this pane currently. */
  /* Placeholder so the rule exists when animations are added later. */
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface ArticlePreviewProps {
  article: Article
  md: string
}

// ─────────────────────────────────────────────────────────────────────────────
// ArticlePreview
// ─────────────────────────────────────────────────────────────────────────────

export function ArticlePreview({ article, md }: ArticlePreviewProps) {
  const blocks = parseMarkdown(md)

  return (
    <>
      <style>{PREVIEW_CSS}</style>

      {/*
       * .wlc-preview: scoped shell — paper-canvas surface, relative positioning
       * for the non-fixed marginalia rail. Full-height scrolling column.
       * NOT EntryShell — no PageShell, Nav, MarginaliaHUD, ScrollMeter, BootSequence.
       */}
      <div
        className="wlc-preview paper-canvas"
        style={{ position: 'relative', height: '100%', overflowY: 'auto' }}
      >
        {/* Non-fixed scoped marginalia rail — decorative, aria-hidden */}
        <aside
          className="wlc-marginalia"
          aria-hidden="true"
        >
          <span>
            ∇ WORLDLINE ·{' '}
            <span className="wlc-marginalia-acc">1.130426</span>
          </span>
          <span className="wlc-marginalia-acc">§ {article.fileNum}</span>
          <span>DRAFT · EDITOR</span>
        </aside>

        {/* Content column */}
        <div className="wlc-col">
          {/*
           * Option-A wiring — ArticleEntryContent with live body.
           * .wlc-preview-body scopes the block CSS above.
           * When body is provided, ArticleEntryContent renders NO lede
           * (the summary placeholder is bypassed per its body?? guard).
           */}
          <div className="wlc-preview-body">
            <ArticleEntryContent
              article={article}
              body={<Blocks blocks={blocks} />}
            />
          </div>
        </div>
      </div>
    </>
  )
}

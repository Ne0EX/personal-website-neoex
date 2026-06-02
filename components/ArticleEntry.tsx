/**
 * ArticleEntry.tsx — server component
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders the /articles/<fileNum> entry surface.
 * Composed of: EntryShell (chrome + header + worldline) + article-specific
 * body rendering + § patches revision timeline.
 *
 * Design spec:  docs/design/12-entry-routes.md §self-depth-article (Betelgeuse)
 * Precedent:    PhotoEntry.tsx (header rhythm, NETRA L1, dashed hairlines)
 *               RollIndex.tsx (server component shape, inline style convention)
 *
 * Atoms composed (Rule 5):
 *   paper-warm-surface — § patches panel background
 *   dashed-hairline    — section seams above + below patches block
 *   type-roles         — Cormorant italic (voice) / JetBrains Mono (instrument) /
 *                        Special Elite (value — patch date + patch number)
 *
 * § patches block:
 *   <ol reversed aria-label="revision history">
 *   Rendered on var(--paper-warm) surface between two dashed-hairlines.
 *   Omitted when patches is absent or empty.
 *   First-paint stagger: 220ms animation, 60ms delay per row, ease-out.
 *   prefers-reduced-motion: instant (no stagger) — handled by @media query
 *   in <style> tag embedded at component level.
 *
 * Owner: Sirius (α-SUR-01) · S2 entry-routes (VISION-2026-05-31)
 */

import type { Article } from '@/lib/content/types'
import { EntryShell } from '@/components/EntryShell'

interface ArticleEntryProps {
  article: Article
}

// ─────────────────────────────────────────────────────────────────────────────
// § patches stagger animation CSS — embedded to avoid a module CSS import.
// NOT a CSS module — global selector required for nth-child stagger.
// prefers-reduced-motion collapses to 0.001ms per atom rule.
// ─────────────────────────────────────────────────────────────────────────────

const PATCHES_CSS = `
@keyframes patches-fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.patches-item {
  animation: patches-fade-in 220ms ease-out backwards;
}
@media (prefers-reduced-motion: reduce) {
  .patches-item {
    animation-duration: 0.001ms !important;
    animation-delay: 0ms !important;
  }
}
`

export function ArticleEntry({ article }: ArticleEntryProps) {
  const {
    fileNum,
    title,
    date,
    status,
    readingTime,
    tags,
    domain,
    coords,
    shareLocation,
    patches,
    isoDate,
    summary,
  } = article

  const hasPatches = patches && patches.length > 0

  // Alive signal: tended N× = patches.length + 1 (initial publish counts)
  const tendedCount = hasPatches ? (patches?.length ?? 0) + 1 : 1
  const tendedLast =
    hasPatches && patches && patches.length > 0
      ? [...patches].sort((a, b) => b.n - a.n)[0].date.replace(/-/g, '.')
      : date

  // Coord string for pagefind meta (only when shareLocation=true)
  const coordStr =
    shareLocation && coords
      ? `${coords.lat.toFixed(2)}°N · ${coords.lon.toFixed(2)}°E`
      : ''

  return (
    <EntryShell
      kind="article"
      identifier={fileNum}
      title={title}
      date={date}
      status={status}
      readingTime={readingTime}
      tags={tags}
      shareLocation={shareLocation}
      coords={coords}
      fileNum={fileNum}
    >
      {/* Stagger CSS — injected once per render */}
      {hasPatches && <style>{PATCHES_CSS}</style>}

      {/*
       * Pagefind search metadata — hidden from visual display.
       * data-pagefind-body: marks this element's contents as the search body.
       * data-pagefind-meta attributes carry typed metadata for ResultCard.
       * Spec: docs/design/14-triangulate-search.md (alive signal, kind, coord)
       * Vision lock: VISION-2026-05-31 §1.1 (pagefind field weights)
       */}
      <div
        data-pagefind-body
        aria-hidden
        style={{ display: 'none' }}
      >
        <span data-pagefind-meta="kind">article</span>
        <span data-pagefind-meta="fileNum">{fileNum}</span>
        <span data-pagefind-meta="date">{date}</span>
        <span data-pagefind-meta="isoDate">{isoDate}</span>
        <span data-pagefind-meta="tags">{tags.join(', ')}</span>
        {coordStr && <span data-pagefind-meta="coord">{coordStr}</span>}
        <span data-pagefind-meta="tended-count">{String(tendedCount)}</span>
        <span data-pagefind-meta="tended-last">{tendedLast}</span>
        {/* Body content for text search */}
        <span>{title} {summary} {domain} {tags.join(' ')}</span>
      </div>

      {/* ── H1 TITLE (Cormorant italic 38px · ink-primary) ── */}
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: 'clamp(24px, 5vw, 38px)',
          lineHeight: 1.1,
          color: 'var(--ink-primary)',
          margin: '0 0 32px',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h1>

      {/* ── DOMAIN label — instrument register ── */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: 'var(--ink-faint)',
          marginBottom: '24px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}
        aria-label={`Domain: ${domain}`}
      >
        <span>DOMAIN</span>
        <span style={{ color: 'var(--ink-dashed)' }}>·</span>
        <span style={{ color: 'var(--ink-soft)' }}>{domain.toUpperCase()}</span>
      </div>

      {/*
       * Body prose placeholder — summary shown until MDX rendering is wired.
       * wl-body: JetBrains Mono 13.5px leading 1.75 (spec §typography).
       * Full MDX body render requires next-mdx-remote or @next/mdx integration
       * at the velite layer — deferred as a follow-up (Procyon territory).
       * The summary is the spec's approved placeholder (it's part of the entry record).
       */}
      <div
        className="wl-body"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '13.5px',
          lineHeight: 1.75,
          color: 'var(--ink-primary)',
          marginBottom: '40px',
        }}
      >
        {/*
         * TODO(Procyon): Wire MDX body rendering via velite `body` field
         * (velite outputs compiled JSX in the `code` field; needs
         * useMDXComponent or equivalent at this layer).
         * WAIT(Procyon): MDX body render infrastructure.
         *
         * For now: summary as lede paragraph (entry is still readable).
         */}
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: '16px',
            lineHeight: 1.6,
            color: 'var(--ink-soft)',
            borderLeft: '2px solid var(--accent-orange)',
            paddingLeft: '16px',
            marginBottom: '24px',
          }}
        >
          {article.summary}
        </p>
      </div>

      {/* ─────────────────────────────────────────────────────── */}
      {/* § SELF-DEPTH — patches revision timeline               */}
      {/* Spec: var(--paper-warm) surface, <ol reversed>,        */}
      {/* between two dashed-hairlines. Omitted when empty.      */}
      {/* ─────────────────────────────────────────────────────── */}
      {hasPatches && (
        <section aria-label="revision history">
          {/* Top dashed-hairline */}
          <div
            aria-hidden
            style={{ borderBottom: '1px dashed var(--ink-dashed)', marginBottom: '16px' }}
          />

          {/* Section header — t-meta instrument register */}
          <div
            className="t-meta"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: 'var(--ink-soft)',
              marginBottom: '12px',
              fontWeight: 400,
            }}
          >
            § PATCHES
          </div>

          {/*
           * Patches panel — paper-warm-surface (atom).
           * <ol reversed> shows newest first visually (highest n at top).
           * aria-label="revision history" per spec §accessibility.
           */}
          <div
            style={{
              background: 'var(--paper-warm)',
              padding: '16px 20px',
              marginBottom: '16px',
            }}
          >
            <ol
              reversed
              aria-label="revision history"
              style={{ listStyle: 'none', margin: 0, padding: 0 }}
            >
              {[...patches]
                .sort((a, b) => b.n - a.n) // newest n first in DOM
                .map((patch, idx) => {
                  const delayMs = idx * 60
                  return (
                    <li
                      key={patch.n}
                      className="patches-item"
                      value={patch.n}
                      style={{
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'baseline',
                        padding: '8px 0',
                        borderBottom:
                          idx < patches.length - 1
                            ? '1px dashed var(--ink-dashed)'
                            : undefined,
                        animationDelay: `${delayMs}ms`,
                      }}
                    >
                      {/* Patch number — accent-orange (spec: "patch numbers in var(--accent-orange)") */}
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '9px',
                          letterSpacing: '0.22em',
                          textTransform: 'uppercase',
                          color: 'var(--accent-orange)',
                          fontWeight: 500,
                          flexShrink: 0,
                          minWidth: '60px',
                        }}
                      >
                        PATCH {String(patch.n).padStart(2, '0')}
                      </span>

                      {/* Date — Special Elite VALUE register (11px spec) */}
                      <span
                        style={{
                          fontFamily: 'var(--font-type)',
                          fontSize: '11px',
                          letterSpacing: '0.04em',
                          color: 'var(--ink-soft)',
                          flexShrink: 0,
                        }}
                      >
                        {patch.date.replace(/-/g, '.')}
                      </span>

                      {/* Note — JetBrains Mono 11px ink-soft (instrument) */}
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          letterSpacing: '0.08em',
                          color: 'var(--ink-soft)',
                          lineHeight: 1.5,
                        }}
                      >
                        {patch.note}
                      </span>
                    </li>
                  )
                })}
            </ol>
          </div>

          {/* Bottom dashed-hairline */}
          <div
            aria-hidden
            style={{ borderBottom: '1px dashed var(--ink-dashed)', marginBottom: '16px' }}
          />
        </section>
      )}
    </EntryShell>
  )
}

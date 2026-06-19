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
 * Extraction (TASK-2026-06-06 atlas-console editor):
 *   ArticleEntryContent — shared presentational sub-component extracted so the
 *   Article Editor preview can render the same entry content in a scoped inline
 *   shell without the full page chrome (PageShell, Nav, MarginaliaHUD, etc.).
 *   body?: React.ReactNode — generic velite-agnostic seam; when omitted, the
 *   component falls back to the existing summary-placeholder behavior (preserving
 *   byte-identical public page output). Procyon wires MDX body via this seam.
 *
 * Owner: Sirius (α-SUR-01) · S2 entry-routes (VISION-2026-05-31)
 */

import type { Article } from '@/lib/content/types'
import { EntryShell } from '@/components/EntryShell'

interface ArticleEntryProps {
  article: Article
  /** Optional rendered MDX body (DL4 store-as-source S3). When omitted, falls back to summary placeholder. */
  body?: React.ReactNode
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

// ─────────────────────────────────────────────────────────────────────────────
// ArticleEntryContent props
// ─────────────────────────────────────────────────────────────────────────────

interface ArticleEntryContentProps {
  article: Article
  /**
   * Optional MDX/ReactNode body to render in the body region.
   *
   * When omitted (the default), falls back to the approved summary-placeholder
   * behavior — a Cormorant italic lede paragraph — so the public
   * /articles/<fileNum> page is BYTE-IDENTICAL to its pre-refactor state.
   *
   * When provided (editor preview path), this node is rendered directly in the
   * body region. The seam is velite-agnostic: Procyon's future MDX body
   * wiring plugs in here without touching the public page.
   *
   * TODO(Procyon): plug in velite `code` field via useMDXComponent once the
   * MDX body render infrastructure lands.
   */
  body?: React.ReactNode
}

/**
 * ArticleEntryContent — shared presentational sub-component.
 *
 * Contains everything that was previously rendered as EntryShell's children
 * in ArticleEntry: pagefind meta block, H1/title, domain label, body region
 * (placeholder or live body via seam), § patches timeline, and the footer-
 * internal end-of-file marker.
 *
 * Extracted so the Article Editor's inline preview pane can compose the full
 * entry register without mounting the public page chrome (PageShell, Nav,
 * MarginaliaHUD, ScrollMeter, fixed HUD). See atlas-console editor slice.
 *
 * INVARIANT: when body is omitted, this component's output is identical to the
 * pre-refactor ArticleEntry children. The public page MUST remain byte-identical.
 */
export function ArticleEntryContent({ article, body }: ArticleEntryContentProps) {
  const {
    fileNum,
    title,
    date,
    tags,
    domain,
    coords,
    shareLocation,
    patches,
    isoDate,
    summary,
    lang,
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
    <>
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
      {/*
       * P6b: var(--font-thai-display) (Trirong) appended after --font-display.
       * Cormorant Garamond has no Thai glyphs — a Thai title would render
       * as tofu boxes without this fallback. Thai codepoints resolve to
       * Trirong (high-contrast literary Thai serif = same register as Cormorant).
       * Trirong weight 300 prevents Thai titles from punching heavier than
       * Cormorant's light italic. lang attr on the h1 is NOT set here —
       * the region lang attr on the wrapping section (§6.2) covers a11y/search.
       */}
      <h1
        style={{
          fontFamily: 'var(--font-display), var(--font-thai-display)',
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
          color: 'var(--ink-soft)',
          marginBottom: '24px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}
        aria-label={`Domain: ${domain}`}
      >
        <span>DOMAIN</span>
        <span style={{ color: 'var(--ink-dashed)' }}>·</span>
        <span style={{ color: 'var(--ink-body)' }}>{domain.toUpperCase()}</span>
      </div>

      {/* ARTICLE SUMMARY SECTION (bug-3b)
       * Placement: between DOMAIN label and wl-body div.
       * Register: INSTRUMENT ORIENTATION - JetBrains Mono at ink-body.
       * NOT Cormorant italic (reserved for the body lede).
       * Atoms composed: type-roles, dashed-hairline (via .wl-summary__seam).
       * Guard: null when summary is absent - no empty seam, no marker.
       * When body is absent (draft): summary renders alone; wl-body is empty. */}
      {summary && (
        <section
          className="wl-summary"
          aria-label="summary"
          lang={lang}
        >
          {/*
           * P6a §6.2: lang attr on this section carries the SERVED sibling's language,
           * independent of the URL locale. On a /th page where no Thai sibling exists,
           * article.lang = 'en' (opt-in fallback) — the section is correctly marked
           * lang="en" so screen readers and search engines see the real content language,
           * not the requested locale. This is the region-level lang signal for a11y/SEO.
           */}
          {/* Panel title seated on top frame edge — axis-label punch-through technique.
              Orange ◈ glyph (U+25C8, JSX string) + SUMMARY word (ink-soft, mono 10px).
              Matches .atlas-axis-label idiom: background:paper-base pill breaks border. */}
          <div className="wl-summary__label" aria-hidden>
            <span className="wl-summary__label-glyph">{'◈'}</span>
            <span>SUMMARY</span>
          </div>
          <p className="wl-summary__body">{summary}</p>
          {/* .wl-summary__seam is retired — dashed frame closes the block.
              CSS sets display:none; element preserved for transition safety. */}
          <hr className="wl-summary__seam" aria-hidden />
        </section>
      )}

      {/*
       * Body region — renders the MDX body when provided (editor preview path
       * and public page path once Procyon wires the velite MDX seam).
       *
       * wl-body: JetBrains Mono 13.5px leading 1.75 (spec §typography).
       * The summary-as-fallback placeholder inside this div is REMOVED (bug-3b):
       * the summary is now its own section above. The body region renders only
       * body content — or nothing when body is absent (draft state is readable
       * via the summary section above).
       *
       * P6a §6.2: lang attr on the wrapping section carries the SERVED sibling's
       * language (article.lang), which equals the authored fallback ('en') when
       * no sibling exists for the requested locale. Screen readers and search
       * engines see the real content language, not the URL locale.
       *
       * P6b §6.1: var(--font-thai-body) (IBM Plex Sans Thai) appended after --font-mono.
       * IBM Plex Sans Thai matches JetBrains Mono's even/technical-calm register —
       * both are designed for the same visual temperature. Thai body text reads at
       * the same instrument weight as Latin body text. The CSS rule at .wl-body .wlc-p
       * already carries this fallback — the inline style mirrors it for rare cases
       * where body content is rendered outside the .wlc-p class.
       *
       * TODO(Procyon): Wire MDX body rendering via velite `body` field.
       * WAIT(Procyon): MDX body render infrastructure.
       */}
      <section lang={lang} aria-label="article body">
        <div
          className="wl-body"
          style={{
            fontFamily: 'var(--font-mono), var(--font-thai-body)',
            fontSize: '13.5px',
            lineHeight: 1.75,
            color: 'var(--ink-primary)',
            marginBottom: '40px',
          }}
        >
          {body}
        </div>
      </section>

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

                      {/* Note — JetBrains Mono 11px ink-body (read tier).
                           ink-soft (0.5) felt disconnected from the article body;
                           ink-body (0.82) closes the gap while keeping the
                           orange patch number and soft date as the hierarchy top. */}
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          letterSpacing: '0.08em',
                          color: 'var(--ink-body)',
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
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ArticleEntry — public page component (byte-identical to pre-refactor output)
// ─────────────────────────────────────────────────────────────────────────────

export function ArticleEntry({ article, body }: ArticleEntryProps) {
  const {
    fileNum,
    title,
    date,
    status,
    readingTime,
    tags,
    shareLocation,
    coords,
  } = article

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
      {/* DL4: body prop threads the MDX-rendered ReactNode from the store down
          to ArticleEntryContent. When null/undefined, the summary placeholder renders. */}
      <ArticleEntryContent article={article} body={body} />
    </EntryShell>
  )
}

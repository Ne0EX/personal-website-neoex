/**
 * EntryShell.tsx — server component
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared entry-page shell for /articles/<fileNum> and /fiction/<slug>.
 * Provides: page chrome reuse (PageShell · Nav · MarginaliaHUD · ScrollMeter ·
 * CornerMarks), .entry-head header strip, body zone (72ch), and § worldline
 * section via <WorldlineLinks>.
 *
 * Design spec:  docs/design/12-entry-routes.md (Betelgeuse · α-VIS-04)
 * Vision lock:  docs/team/VISION-2026-05-31-search-lineage-console.md §7 S2
 * Precedent:    PhotoEntry.tsx (header strip rhythm, NETRA L1, dashed hairlines)
 *
 * Atoms composed (Rule 5 — compose FROM atoms, never re-derive):
 *   paper-canvas      — <main> grain + scanlines (globals.css)
 *   paper-warm-surface— header strip + §patches / §α-variants bg (globals.css)
 *   corner-reticle    — local .corner-marks on .entry-head + global via CornerMarks.tsx
 *   dashed-hairline   — all section separators (1px dashed var(--ink-dashed))
 *   type-roles        — Cormorant italic / JetBrains Mono / Special Elite
 *   netra-voice-strip — .atlas-netra-voice (conditional on shareLocation)
 *   attractor-pill    — tag pills (inline-styled per production pattern)
 *   entry-glitch      — worldline link hover underline (via WorldlineLinks)
 *   marginalia        — global via MarginaliaHUD.tsx
 *
 * Owner: Sirius (α-SUR-01) · S2 entry-routes (VISION-2026-05-31)
 */

import { PageShell } from '@/components/PageShell'
import { Nav } from '@/components/Nav'
import { MarginaliaHUD, ScrollMeter } from '@/components/MarginaliaHUD'
import { CornerMarks } from '@/components/CornerMarks'
import { WorldlineLinks } from '@/components/WorldlineLinks'
import { ContinueSection } from '@/components/ContinueSection'
import type { NextEntry } from '@/lib/content'

// ─────────────────────────────────────────────────────────────────────────────
// NETRA L1 bay — conditional on shareLocation + coords.
// Rendered inside .entry-head when coords are shared; absent otherwise.
// Atom: netra-voice-strip (.atlas-netra-voice) — reused verbatim from PhotoEntry.
// ─────────────────────────────────────────────────────────────────────────────

interface NetraL1Props {
  lat: number
  lon: number
  place: string
  identifier: string
}

function NetraL1Bay({ lat, lon, place, identifier }: NetraL1Props) {
  const coordStr = `${lat.toFixed(2)}°N · ${lon.toFixed(2)}°E`
  const locus = `locus · ${identifier.toLowerCase()} · ${coordStr} · ${place}`

  return (
    /*
     * Atom: netra-voice-strip (.atlas-netra-voice from globals.css).
     * border-left: 2px solid var(--netra); background rgba netra tint.
     * Spec: "left 2px solid var(--netra) border and Cormorant italic voice body"
     */
    <aside
      className="atlas-netra-voice"
      role="status"
      aria-live="polite"
      aria-label="NETRA observation bay"
      style={{ margin: '12px 32px 0', position: 'relative', zIndex: 3 }}
    >
      <span className="voice-tag">NETRA ▸</span>
      <span className="voice-body">{locus}</span>
    </aside>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tag pills — entry-head attractor field tags.
// Styled inline (af-pill pattern) — not a global class in production CSS.
// ─────────────────────────────────────────────────────────────────────────────

function TagPill({ tag }: { tag: string }) {
  return (
    <a
      href={`/?tag=${encodeURIComponent(tag)}`}
      aria-label={`browse ${tag} tag`}
      style={{
        display: 'inline-block',
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        padding: '0.4em 0.75em',
        background: 'transparent',
        border: '1px solid var(--ink-faint)',
        color: 'var(--ink-primary)',
        textDecoration: 'none',
        transition: 'border-color 150ms ease, color 150ms ease',
      }}
      onMouseEnter={undefined}
      onMouseLeave={undefined}
    >
      {tag}
    </a>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EntryShell props
// ─────────────────────────────────────────────────────────────────────────────

interface EntryShellProps {
  /** Content kind — drives worldline section identifier resolution. */
  kind: 'article' | 'fiction'
  /**
   * Short identifier for worldline lookup:
   *   article → fileNum (e.g. "001")
   *   fiction → slug (e.g. "transmission-001")
   */
  identifier: string
  /** Display title for worldline THIS ENTRY row. */
  title: string
  /** Display date string YYYY.MM.DD (value register). */
  date: string
  /** Status string (instrument register). */
  status: string
  /** Reading time in minutes (article only; 0 for fiction). */
  readingTime?: number
  /** Attractor tag array for pill row. */
  tags: string[]
  /** When true, render NETRA L1 bay with coords. */
  shareLocation?: boolean
  coords?: { lat: number; lon: number; place: string }
  /** File number for header (article: "FILE · 001", fiction: displayed differently). */
  fileNum?: string
  /**
   * SPEC 1 — CONTINUE: Recommended next entries from getNextEntries().
   * ContinueSection renders the first entry only (spec §1 "single primary continuation").
   * When undefined or empty, ContinueSection renders nothing (spec §1.5 empty state).
   * Article pages only — fiction/photo pages pass undefined.
   */
  nextEntries?: NextEntry[]
  /**
   * SPEC 2 — ORIENT: Total published article count for the folio readout.
   * Renders as "FILE NNN OF N" in the header strip, linking to /[lang]/archive.
   * Spec: SPEC-2026-06-25-article-continuation.md §2.
   * When undefined, folio readout is absent (spec §2.8 "total unknown → absent").
   */
  articlesCount?: number
  /**
   * Current language — used for the folio link's lang-aware archive href.
   * Matches the [lang] segment: 'en' | 'th'.
   */
  lang?: string
  /** H1 title node — allows the kind-specific component to pass an already-styled title. */
  children: React.ReactNode
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function EntryShell({
  kind,
  identifier,
  title,
  date,
  status,
  readingTime,
  tags,
  shareLocation,
  coords,
  fileNum,
  nextEntries,
  articlesCount,
  lang,
  children,
}: EntryShellProps) {
  // FILE number display — article: "FILE · NNN", fiction: "TRANSMISSION · slug"
  const fileLabel =
    kind === 'article' && fileNum
      ? `FILE · ${fileNum}`
      : kind === 'fiction'
      ? `TRANSMISSION · ${identifier.toUpperCase()}`
      : `FILE · ${identifier.toUpperCase()}`

  // Domain label: status display
  const statusDisplay = status.toUpperCase()

  // Reading time label (article only)
  const readLabel = readingTime ? `${readingTime} MIN READ` : null

  // SPEC 2 — ORIENT: folio orient readout.
  // "FILE NNN OF N" — links to /[lang]/archive.
  // Only for article kind when articlesCount is defined (spec §2.8 absent-on-unknown).
  const fileNumPadded = fileNum ? fileNum.padStart(3, '0') : null
  // Archive href: lang-aware — 'en' uses /archive (proxy canonicalises); 'th' → /th/archive
  const archiveHref = (!lang || lang === 'en') ? '/archive' : `/${lang}/archive`
  // Folio aria-label — LOCKED copy: `FILE ${fileNum} of ${articlesCount} — Archive`
  // Source: docs/voice/MICROCOPY.md folio.link.ariaLabel · vega α-VOX-08 · 2026-06-25
  const folioAriaLabel =
    fileNum && articlesCount !== undefined
      ? `FILE ${fileNumPadded} of ${articlesCount} — Archive`
      : null

  return (
    <PageShell>
      {/*
       * SPEC 2 folio-locator hover + mobile responsive CSS.
       * Embedded inline (no CSS module — selectors scoped by .folio-locator class).
       *
       * Hover: "OF" connector shifts to --accent-orange; numbers stay orange (always).
       * spec §2.5 tokens: "folio link hover — numbers stay --accent-orange; OF shifts
       *   to --accent-orange". The connective text is the only element that changes.
       *
       * Mobile sub-row spec §2.4: at ≤600px the folio readout wraps to a new sub-row
       * (flexWrap:wrap on the row container handles the wrap; the <a> becomes full-width
       * so it occupies its own line). min-height: 44px + display:flex for 44px touch target.
       *
       * Focus ring: 2px dashed var(--accent-orange), offset 2px — spec §2.8 + §2.9.
       */}
      <style>{`
        .folio-locator:hover .folio-of {
          color: var(--accent-orange);
          transition: color 150ms ease;
        }
        .folio-locator:focus-visible {
          outline: 2px dashed var(--accent-orange);
          outline-offset: 2px;
          border-radius: 0;
        }
        @media (max-width: 600px) {
          .folio-locator {
            min-height: 44px;
            display: flex !important;
            align-items: center;
            width: 100%;
          }
        }
      `}</style>

      {/*
       * Chrome reuse: PageShell, Nav, MarginaliaHUD, ScrollMeter, CornerMarks.
       * paper-canvas grain + pr-7 marginalia gutter — same as all routes.
       * min-h-screen overflow-hidden: full-height paper surface.
       */}
      <main className="paper-canvas min-h-screen overflow-hidden pr-7">
        <CornerMarks />
        <ScrollMeter />
        <MarginaliaHUD />
        <Nav />

        {/* Skip link — keyboard a11y (spec §accessibility)
            wl-skip-link: shared utility class (app/globals.css) that reveals on
            :focus via CSS specificity — replaces the broken inline left:-9999px
            pattern where Tailwind focus:left-2 was overridden by inline style. */}
        <a href="#entry-main" className="wl-skip-link">
          Skip to entry
        </a>

        {/*
         * .entry-head — header strip.
         * Atom: paper-warm-surface (var(--paper-warm) bg).
         * Atom: dashed-hairline bottom (1px dashed var(--ink-dashed)).
         * Local .corner-marks atom (TL+BR orange L-brackets) — distinct from
         * global CornerMarks chrome (different scopes per spec §layout).
         * position:relative required for corner-marks absolute positioning.
         */}
        <header
          className="entry-head paper-warm-surface"
          style={{
            background: 'var(--paper-warm)',
            borderBottom: '1px dashed var(--ink-dashed)',
            padding: '16px 32px 14px',
            position: 'relative',
            zIndex: 3,
          }}
          data-section="entry-head"
        >
          {/* Local corner-reticle TL+BR — atom corner-reticle, entry scope only */}
          <div
            className="corner-marks"
            aria-hidden
            style={{ position: 'absolute', inset: '8px', zIndex: 4, pointerEvents: 'none' }}
          />

          {/*
           * Row 1: OBSERVATORY · FILE — NNN · date · STATUS · N MIN
           * Right side: folio readout "NNN OF N" (SPEC 2 — ORIENT affordance).
           * justify-content: space-between pushes folio to flush-right (spec §2.3).
           * flexWrap: wrap allows folio to stack below on narrow viewports.
           */}
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: 'var(--ink-soft)',
              display: 'flex',
              gap: '10px',
              alignItems: 'baseline',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
            }}
          >
            {/* Left cluster — existing labels (unchanged) */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span>OBSERVATORY</span>
              <span style={{ color: 'var(--ink-faint)' }}>·</span>
              {/* FILE / TRANSMISSION — accent-orange per spec (file number in orange) */}
              <span
                style={{
                  color: 'var(--accent-orange)',
                  fontWeight: 500,
                  letterSpacing: '0.26em',
                }}
              >
                {fileLabel}
              </span>
              <span style={{ color: 'var(--ink-faint)' }}>·</span>
              {/* date — Special Elite (value role) */}
              <span
                style={{
                  fontFamily: 'var(--font-type)',
                  fontSize: '9px',
                  letterSpacing: '0.04em',
                  textTransform: 'none',
                  color: 'var(--ink-primary)',
                }}
              >
                {date}
              </span>
              <span style={{ color: 'var(--ink-faint)' }}>·</span>
              <span>{statusDisplay}</span>
              {readLabel && (
                <>
                  <span style={{ color: 'var(--ink-faint)' }}>·</span>
                  <span>{readLabel}</span>
                </>
              )}
            </div>

            {/*
             * Right side: SPEC 2 folio readout — "NNN OF N" linking to /[lang]/archive.
             * Only rendered for article kind when articlesCount is defined.
             * spec §2.3: flush-right on row 1 (desktop); spec §2.4: sub-row on mobile.
             *
             * Folio numbers (fileNum + articlesCount): Special Elite .t-type 9px,
             *   var(--accent-orange) — folio numbers follow orange file-number rule.
             * Connector "OF": JetBrains Mono 9px 0.3em UPPER var(--ink-soft).
             *
             * Hover spec §2.5: numbers stay --accent-orange; "OF" shifts to --accent-orange.
             * Implemented via CSS :hover inline state (JS-free per server component rule).
             *
             * aria-label: LOCKED copy from MICROCOPY.md folio.link.ariaLabel (Vega 2026-06-25)
             * Each <span> is aria-hidden — aria-label carries the SR output (spec §2.9).
             *
             * Desktop: inline in row 1 flex container (justifyContent: space-between).
             * Mobile ≤600px: wraps to its own sub-row (flexWrap: wrap on parent + full-width
             *   container below via @media block in the style tag below).
             */}
            {kind === 'article' && folioAriaLabel && fileNumPadded && articlesCount !== undefined && (
              <a
                href={archiveHref}
                aria-label={folioAriaLabel}
                className="folio-locator"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  textDecoration: 'none',
                  color: 'inherit',
                  outline: 'none',
                  flexShrink: 0,
                }}
              >
                {/* FILE number (this entry) — Special Elite, accent-orange */}
                <span
                  aria-hidden
                  className="t-type"
                  style={{
                    fontFamily: 'var(--font-type)',
                    fontSize: '9px',
                    letterSpacing: '0.04em',
                    color: 'var(--accent-orange)',
                    fontWeight: 400,
                  }}
                >
                  {fileNumPadded}
                </span>
                {/* Connector "OF" — JetBrains Mono ink-soft */}
                <span
                  aria-hidden
                  className="t-meta folio-of"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    letterSpacing: '0.3em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-soft)',
                    fontWeight: 400,
                  }}
                >
                  OF
                </span>
                {/* Corpus total — Special Elite, accent-orange */}
                <span
                  aria-hidden
                  className="t-type"
                  style={{
                    fontFamily: 'var(--font-type)',
                    fontSize: '9px',
                    letterSpacing: '0.04em',
                    color: 'var(--accent-orange)',
                    fontWeight: 400,
                  }}
                >
                  {articlesCount}
                </span>
              </a>
            )}
          </div>

          {/* Row 2: tag pills */}
          {tags.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                marginTop: '10px',
              }}
            >
              {tags.map((tag) => (
                <TagPill key={tag} tag={tag} />
              ))}
            </div>
          )}

          {/* NETRA L1 bay — rendered only when shareLocation=true AND coords present */}
          {shareLocation && coords && (
            <NetraL1Bay
              lat={coords.lat}
              lon={coords.lon}
              place={coords.place}
              identifier={identifier}
            />
          )}
        </header>

        {/*
         * Body zone — max-width 72ch, centered.
         * Children = H1 + prose body + § self-depth (kind-specific).
         * § worldline rendered below children (shared).
         */}
        <div
          id="entry-main"
          tabIndex={-1}
          style={{
            maxWidth: '72ch',
            margin: '0 auto',
            padding: '40px 28px 0',
            position: 'relative',
            zIndex: 3,
          }}
        >
          {children}
        </div>

        {/*
         * § worldline section — L2b local-view.
         * Rendered by <WorldlineLinks /> (S3 worldline-schema ship).
         * Section absent entirely when both incoming and outgoing are empty (gate).
         * Padding matches surrounding entry layout.
         */}
        <WorldlineLinks
          kind={kind}
          identifier={identifier}
          title={title}
        />

        {/*
         * SPEC 1 — § CONTINUE affordance.
         * Position: after § WORLDLINE, before footer (spec §1.2).
         * Renders the first entry from getNextEntries() — single primary continuation.
         * Absent when nextEntries is empty (spec §1.5 empty state: section absent).
         * Article pages only — fiction/photo pages pass undefined, renders nothing.
         */}
        <ContinueSection nextEntry={nextEntries?.[0]} />

        {/* Footer — dashed top hairline, instrument register */}
        <footer
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 32px',
            borderTop: '1px dashed var(--ink-dashed)',
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            letterSpacing: '0.3em',
            color: 'var(--ink-soft)',
            textTransform: 'uppercase',
            position: 'relative',
            zIndex: 3,
            marginTop: '40px',
          }}
        >
          <span>{fileLabel}</span>
          <span>WORLDLINE · 1.130426</span>
        </footer>
      </main>
    </PageShell>
  )
}

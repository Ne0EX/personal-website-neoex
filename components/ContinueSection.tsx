/**
 * ContinueSection.tsx — server component
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders the § CONTINUE affordance at the end of an article entry.
 * Position: after § PATCHES, before the footer.
 *
 * Spec: SPEC-2026-06-25-article-continuation.md §1
 * Copy source: docs/voice/MICROCOPY.md — continue.section.label LOCKED 2026-06-25
 *
 * Atoms composed (Rule 5):
 *   section-rule-dashed  — 1px dashed var(--ink-dashed) above section
 *   dashed-hairline      — inner separator below section label
 *   entry-glitch         — worldline-atoms.css lines 210–217; marching-dash hover
 *                          triggered by .entry-card:hover .entry-glitch::after
 *   type-roles           — JetBrains Mono (instrument) / Cormorant italic (voice)
 *                          / Special Elite (value register, date)
 *
 * Entry-glitch pattern modelled on WorldlineNeighborRow.tsx:
 *   <a className="entry-card"> wraps <span className="entry-glitch"> on title.
 *   No new animation — reuses the existing atom mechanic.
 *
 * prefers-reduced-motion: the entry-glitch transition collapses to 0.001ms via
 *   worldline-atoms.css global rule. REVEAL behavior: the element is always visible
 *   (opacity: 1 by default); reduced-motion collapses only the underline transition
 *   duration, not the element visibility.
 *
 * Motion non-goal: no entrance animation (spec §1.8 "section entrance: none — reading
 *   surface; no entrance animation").
 *
 * Accessibility:
 *   <section aria-label="continue reading">
 *   <h2 class="t-meta"> — THE THREAD CONTINUES
 *   <a aria-label="[kind]: [title] — FILE [fileNum]" class="entry-card">
 *   aria-hidden on decorative glyphs and caret
 *
 * Owner: Sirius (α-SUR-01) · SPEC-2026-06-25-article-continuation §1
 */

// Side-effect import: loads ContinueSection responsive + focus CSS.
// NOT a CSS module — [data-continue-section] selectors must not be mangled.
import './ContinueSection.css'

import type { NextEntry } from '@/lib/content'

// ─────────────────────────────────────────────────────────────────────────────
// Kind glyphs — Unicode geometric only. JetBrains Mono 11px. (spec §kind-glyphs)
// ─────────────────────────────────────────────────────────────────────────────
const KIND_GLYPH: Record<string, string> = {
  article: '◆',
  fiction: '△',
  photo:   '◎',
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface ContinueSectionProps {
  /**
   * First entry from getNextEntries — the primary recommended continuation.
   * Undefined when getNextEntries returns an empty array; section is absent.
   */
  nextEntry: NextEntry | undefined
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ContinueSection({ nextEntry }: ContinueSectionProps) {
  // Empty state: spec §1.5 — section absent entirely when no next entry.
  // No heading, no empty container. Silence is correct.
  if (!nextEntry) return null

  const glyph = KIND_GLYPH[nextEntry.kind] ?? '○'
  const fileNumDisplay = nextEntry.identifier.padStart(3, '0')
  const domainUpper = nextEntry.domain.toUpperCase()
  const statusUpper = nextEntry.status.toUpperCase()
  const readLabel = nextEntry.readingTime ? `${nextEntry.readingTime} MIN` : null
  // Date as value register — ISO → YYYY.MM.DD display (Special Elite)
  const dateDisplay = nextEntry.isoDate.replace(/-/g, '.')

  return (
    /*
     * Outer section wrapper — dashed rule above (section seam atom).
     * data-continue-section: CSS scoping anchor for ContinueSection.css.
     * padding matches surrounding entry layout (0 32px).
     */
    <section
      aria-label="continue reading"
      data-continue-section
      style={{
        padding: '0 32px 32px',
        position: 'relative',
        zIndex: 3,
      }}
    >
      {/* Dashed rule above section — atom section-rule-dashed */}
      <div
        aria-hidden
        style={{
          borderBottom: '1px dashed var(--ink-dashed)',
          marginBottom: '16px',
        }}
      />

      {/*
       * Section label — LOCKED copy: "THE THREAD CONTINUES"
       * Source: docs/voice/MICROCOPY.md continue.section.label · vega α-VOX-08 · 2026-06-25
       * <h2> per spec §1.10 (article has one <h1>; all section headings below = <h2>)
       * Styled to .t-meta: 9px mono 0.3em uppercase ink-soft.
       */}
      <h2
        className="t-meta"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: 'var(--ink-soft)',
          fontWeight: 400,
          margin: '0 0 12px',
        }}
      >
        THE THREAD CONTINUES
      </h2>

      {/* Inner dashed hairline below section label */}
      <div
        aria-hidden
        style={{
          borderBottom: '1px dashed var(--ink-dashed)',
          marginBottom: '12px',
        }}
      />

      {/*
       * Entry row — the primary continuation link.
       * entry-card class: triggers .entry-card:hover .entry-glitch::after
       * (worldline-atoms.css line 217 — marching-dash underline on title).
       * display:flex aligns glyph slot + content area + caret across the row.
       * Modelled on WorldlineNeighborRow.tsx (the established entry-glitch pattern).
       */}
      <a
        href={nextEntry.href}
        aria-label={`${nextEntry.kind}: ${nextEntry.title} — FILE ${fileNumDisplay}`}
        className="entry-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 0',
          textDecoration: 'none',
          color: 'inherit',
          outline: 'none',
          position: 'relative',
        }}
      >
        {/*
         * Glyph slot — 20px fixed (same as § WORLDLINE glyph slot per spec §1.3).
         * Color: --ink-soft at rest → --accent-orange on row hover (ContinueSection.css).
         * JetBrains Mono 11px per spec §1.7.
         */}
        <span
          className="cs-glyph"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: 0,
            color: 'var(--ink-soft)',
            width: '20px',
            flexShrink: 0,
            transition: 'color 150ms ease',
            userSelect: 'none',
          }}
          aria-hidden
        >
          {glyph}
        </span>

        {/* Content area — flex-grow, contains FILE label + title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* FILE — NNN row: label in ink-soft, number in accent-orange */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '4px',
              marginBottom: '4px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: 'var(--ink-soft)',
                fontWeight: 400,
              }}
            >
              FILE
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: 'var(--ink-faint)',
              }}
            >
              —
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                letterSpacing: '0.26em',
                textTransform: 'uppercase',
                color: 'var(--accent-orange)',
                fontWeight: 500,
              }}
            >
              {fileNumDisplay}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                letterSpacing: '0.3em',
                color: 'var(--ink-faint)',
              }}
            >
              ·
            </span>
            {/*
             * Title — JetBrains Mono 11px 0.05em (spec §1.7).
             * entry-glitch class: marching-dash underline extends on hover
             * (worldline-atoms.css lines 210–217, triggered by .entry-card parent).
             */}
            <span
              className="entry-glitch"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.05em',
                color: 'var(--ink-primary)',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {nextEntry.title}
            </span>
          </div>

          {/* Meta strip: DOMAIN · date · STATUS · N MIN — spec §1.3 + §1.7 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '6px',
              flexWrap: 'wrap',
            }}
          >
            {/* Domain — JetBrains Mono 9px 0.3em UPPER ink-soft */}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: 'var(--ink-soft)',
                fontWeight: 400,
              }}
            >
              {domainUpper}
            </span>
            {/* Date separator + date — Special Elite 9px value register (desktop only) */}
            <span className="cs-meta-date-sep" style={{ color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)', fontSize: '9px' }}>·</span>
            <span
              className="cs-meta-date t-type"
              style={{
                fontFamily: 'var(--font-type)',
                fontSize: '9px',
                letterSpacing: '0.04em',
                color: 'var(--ink-soft)',
              }}
            >
              {dateDisplay}
            </span>
            <span style={{ color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)', fontSize: '9px' }}>·</span>
            {/* Status — JetBrains Mono 9px 0.3em UPPER ink-soft */}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: 'var(--ink-soft)',
                fontWeight: 400,
              }}
            >
              {statusUpper}
            </span>
            {readLabel && (
              <>
                <span style={{ color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)', fontSize: '9px' }}>·</span>
                {/* Reading time — JetBrains Mono 9px 0.3em UPPER ink-soft */}
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    letterSpacing: '0.3em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-soft)',
                    fontWeight: 400,
                  }}
                >
                  {readLabel}
                </span>
              </>
            )}
          </div>
        </div>

        {/*
         * Caret → — flush right.
         * cs-caret class: color shifts to --accent-orange on hover (ContinueSection.css).
         * aria-hidden: the aria-label on <a> conveys the destination.
         */}
        <span
          className="cs-caret"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: 0,
            color: 'var(--ink-soft)',
            flexShrink: 0,
            transition: 'color 150ms ease',
            userSelect: 'none',
            marginLeft: '8px',
          }}
          aria-hidden
        >
          →
        </span>
      </a>

      {/*
       * Edge annotation — Cormorant Garamond italic 12px, ink-soft (voice register).
       * Rendered ONLY when nextEntry.label is present — i.e., when the link is a
       * declared worldline_link with an explicit label field.
       * Absent for chronological-fallback entries (spec §1.3 — silence is correct).
       * Indented 28px (past 20px glyph + 8px gap) matching WorldlineNeighborRow pattern.
       */}
      {nextEntry.label && (
        <div
          style={{
            paddingLeft: '28px',
            paddingTop: '6px',
            paddingBottom: '8px',
            borderBottom: '1px dashed var(--ink-dashed)',
            marginBottom: '4px',
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: '12px',
            letterSpacing: '0.005em',
            color: 'var(--ink-soft)',
            lineHeight: 1.5,
          }}
        >
          {nextEntry.label}
        </div>
      )}
    </section>
  )
}

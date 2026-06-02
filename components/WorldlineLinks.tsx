/**
 * WorldlineLinks.tsx — server component
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders the § worldline section: bidirectional 1-hop inter-entry graph as a
 * typed, accessible list. Incoming (← seeded by) above · THIS ENTRY center ·
 * Outgoing (→ seeds) below.
 *
 * Design spec:     docs/design/13-worldline-section.md (Betelgeuse · α-VIS-04)
 * Vision lock:     docs/team/VISION-2026-05-31-search-lineage-console.md §1.2 L2b
 * Pattern source:  RollIndex.tsx (server component shape, inline style convention)
 *                  ChapterIndex.tsx (entry-glitch + entry-card hover pattern)
 *
 * Atoms composed (Rule 5):
 *   dashed-hairline  — border above header + edge-label row connector
 *                      (border-bottom: 1px dashed var(--ink-dashed))
 *   type-roles       — Cormorant italic (edge label · voice) · JetBrains Mono
 *                      (header / direction labels / title / glyph · instrument)
 *                    · Special Elite (date · value register)
 *   entry-glitch     — worldline-atoms.css lines 210–217; marching-dash underline
 *                      via .entry-card:hover .entry-glitch::after
 *
 * Accessibility:
 *   <section aria-label="worldline links">
 *   Incoming: <div role="list" aria-label="seeded by"> / each row role="listitem"
 *   Outgoing: <div role="list" aria-label="seeds"> / same
 *   THIS ENTRY: <div aria-current="page"> — not inside either list, not an <a>
 *   Focus ring: 2px solid var(--accent-orange), offset 2px (WorldlineLinks.css)
 *   Mobile touch target: min-height 44px on <a> (WorldlineLinks.css ≤600px)
 *
 * Gate: section absent entirely when both incoming and outgoing are empty.
 *
 * Sub-component: WorldlineNeighborRow.tsx (neighbor row + edge label row).
 * Extracted to keep this file under 250 lines.
 *
 * Owner: Sirius (α-SUR-01) · S3 worldline-section (VISION-2026-05-31)
 */

// Side-effect import: loads WorldlineLinks responsive + focus CSS.
// NOT a CSS module — global [data-worldline-section] selectors must not be mangled.
import './WorldlineLinks.css'

import { resolveNeighborhood } from '@/lib/content/worldline'
import { WorldlineNeighborRow } from '@/components/WorldlineNeighborRow'

// ─────────────────────────────────────────────────────────────────────────────
// Kind glyphs for THIS ENTRY center row — spec §kind-glyphs
// Unicode geometric only — no SVG. JetBrains Mono 11px.
// ─────────────────────────────────────────────────────────────────────────────
const KIND_GLYPH: Record<'article' | 'fiction' | 'photo', string> = {
  article: '◆',
  photo:   '◎',
  fiction: '△',
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface WorldlineLinksProps {
  /** Content kind of THIS entry — used to look up outgoing + incoming. */
  kind: 'article' | 'fiction' | 'photo'
  /**
   * Short identifier of THIS entry:
   *   article  → fileNum (e.g. "000")
   *   fiction  → slug (e.g. "transmission-001")
   *   photo    → "roll/id" (e.g. "2026-04-chiang-mai/DSCF0001")
   */
  identifier: string
  /** Display title of THIS entry — shown in the THIS ENTRY center row. */
  title: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Component — server async (no 'use client')
// ─────────────────────────────────────────────────────────────────────────────

export async function WorldlineLinks({ kind, identifier, title }: WorldlineLinksProps) {
  const { incoming, outgoing } = await resolveNeighborhood(kind, identifier)

  // Gate: render nothing when both lists are empty (spec §states "NO EMPTY STATE").
  if (incoming.length === 0 && outgoing.length === 0) {
    return null
  }

  const thisGlyph = KIND_GLYPH[kind]

  return (
    /*
     * Section: aria-label="worldline links" per spec §accessibility.
     * data-worldline-section: Algol token-compliance gate selector +
     *   WorldlineLinks.css scoping anchor.
     * Padding matches surrounding entry layout (32px sides).
     */
    <section
      aria-label="worldline links"
      data-worldline-section
      style={{
        padding: '0 32px 32px',
        position: 'relative',
        zIndex: 3,
      }}
    >
      {/* Dashed hairline above the section header (atom dashed-hairline) */}
      <div
        aria-hidden
        style={{
          borderBottom: '1px dashed var(--ink-dashed)',
          marginBottom: '16px',
        }}
      />

      {/* Section header: § WORLDLINE — .t-meta (9px mono, 0.3em, UPPER, --ink-soft) */}
      <div
        className="t-meta"
        style={{
          fontSize: '9px',
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: 'var(--ink-soft)',
          fontFamily: 'var(--font-mono)',
          marginBottom: '20px',
          fontWeight: 400,
        }}
      >
        § WORLDLINE
      </div>

      {/* ── INCOMING block: "← seeded by" ──────────────────────── */}
      {incoming.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          {/* Direction label — JetBrains Mono 8px 0.22em UPPER --ink-faint */}
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '8px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--ink-faint)',
              marginBottom: '8px',
            }}
          >
            INCOMING · ← SEEDED BY
          </div>

          {/* Accessible list: aria-label="seeded by" per spec §accessibility */}
          <div role="list" aria-label="seeded by">
            {incoming.map((neighbor) => (
              <WorldlineNeighborRow key={neighbor.key} neighbor={neighbor} />
            ))}
          </div>
        </div>
      )}

      {/* ── THIS ENTRY center row ──────────────────────────────── */}
      {/*
       * aria-current="page": marks current entry per spec §accessibility.
       * Not inside either role="list". Not an <a>. Glyph + title only.
       * Dashed hairlines above (if incoming) + below (if outgoing) bookend it.
       */}
      <div
        aria-current="page"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 0',
          borderTop: incoming.length > 0 ? '1px dashed var(--ink-dashed)' : undefined,
          borderBottom: outgoing.length > 0 ? '1px dashed var(--ink-dashed)' : undefined,
          marginBottom: outgoing.length > 0 ? '20px' : undefined,
        }}
      >
        {/* Glyph — 20px fixed, JetBrains Mono 11px, --ink-primary (this entry) */}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: 0,
            color: 'var(--ink-primary)',
            width: '20px',
            flexShrink: 0,
            userSelect: 'none',
          }}
          aria-hidden
        >
          {thisGlyph}
        </span>

        {/* Label — JetBrains Mono 8px instrument register */}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '8px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--ink-faint)',
            flexShrink: 0,
            userSelect: 'none',
          }}
        >
          THIS ENTRY ·
        </span>

        {/* Title — JetBrains Mono 11px weight 500, --ink-primary */}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.05em',
            color: 'var(--ink-primary)',
            fontWeight: 500,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
      </div>

      {/* ── OUTGOING block: "→ seeds" ──────────────────────────── */}
      {outgoing.length > 0 && (
        <div>
          {/* Direction label — JetBrains Mono 8px 0.22em UPPER --ink-faint */}
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '8px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--ink-faint)',
              marginBottom: '8px',
            }}
          >
            OUTGOING · → SEEDS
          </div>

          {/* Accessible list: aria-label="seeds" per spec §accessibility */}
          <div role="list" aria-label="seeds">
            {outgoing.map((neighbor) => (
              <WorldlineNeighborRow key={neighbor.key} neighbor={neighbor} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

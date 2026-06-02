/**
 * WorldlineNeighborRow.tsx — server sub-component
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders one neighbor entry row inside the § worldline section.
 *
 * Entry-glitch pattern: <a class="entry-card"> wraps <span class="entry-glitch">
 * on the title — matches worldline-atoms.css lines 210–217.
 * .entry-card:hover .entry-glitch::after → width 0 → 100% (460ms cubic-bezier).
 *
 * Edge label row: below the main row, indented 28px (past glyph slot + gap),
 * border-bottom: 1px dashed var(--ink-dashed), Cormorant italic 12px --ink-soft.
 *
 * Spec: docs/design/13-worldline-section.md §typography + §motion + §accessibility
 * Owner: Sirius (α-SUR-01) · S3 worldline-section
 */

import type { ResolvedNeighbor } from '@/lib/content/worldline'

/** Kind glyphs — Unicode geometric only, JetBrains Mono 11px (spec §kind-glyphs). */
const KIND_GLYPH: Record<'article' | 'fiction' | 'photo' | string, string> = {
  article: '◆',
  photo:   '◎',
  fiction: '△',
  repo:    '○',
}

/** Kind label — UPPERCASE instrument register in neighbor rows. */
const KIND_LABEL: Record<'article' | 'fiction' | 'photo' | string, string> = {
  article: 'ARTICLE',
  photo:   'PHOTO',
  fiction: 'FICTION',
  repo:    'REPO',
}

/** Route resolver — maps canonical identifier to a navigable href. */
function hrefForNeighbor(neighbor: ResolvedNeighbor): string {
  switch (neighbor.kind) {
    case 'photo':   return `/photos/${neighbor.identifier}`    // "roll/id" → /photos/roll/id
    case 'article': return `/articles/${neighbor.identifier}`  // fileNum
    case 'fiction': return `/fiction/${neighbor.identifier}`   // slug
    default:        return `#${neighbor.key}`
  }
}

interface WorldlineNeighborRowProps {
  neighbor: ResolvedNeighbor
}

export function WorldlineNeighborRow({ neighbor }: WorldlineNeighborRowProps) {
  const glyph = KIND_GLYPH[neighbor.kind] ?? '○'
  const kindLabel = KIND_LABEL[neighbor.kind] ?? neighbor.kind.toUpperCase()
  const href = hrefForNeighbor(neighbor)

  return (
    /*
     * listitem wrapper — role="listitem" per spec §accessibility.
     * Margin below each row; edge-label row attaches immediately below.
     */
    <div role="listitem" style={{ marginBottom: neighbor.label ? '4px' : '2px' }}>
      {/*
       * Entire row is the link anchor.
       * entry-card class triggers .entry-card:hover .entry-glitch::after (worldline-atoms.css 217).
       * focus-visible: 2px solid var(--accent-orange), offset 2px — from WorldlineLinks.css.
       * min-height: 44px at ≤600px via WorldlineLinks.css media query.
       */}
      <a
        href={href}
        aria-label={`${neighbor.kind}: ${neighbor.title}`}
        className="entry-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 0',
          textDecoration: 'none',
          color: 'inherit',
          minHeight: '32px',
          outline: 'none',
          position: 'relative',
        }}
      >
        {/*
         * Glyph slot — 20px fixed, JetBrains Mono 11px.
         * Color: --ink-soft at rest → --ink-primary on hover (via WorldlineLinks.css
         * [data-worldline-section] .entry-card:hover .wl-neighbor-glyph rule).
         */}
        <span
          className="wl-neighbor-glyph"
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

        {/*
         * Title — JetBrains Mono 11px 0.05em.
         * entry-glitch class: marching-dash underline draws on hover
         * (worldline-atoms.css lines 210–217, triggered by .entry-card parent).
         */}
        <span
          className="entry-glitch"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.05em',
            color: 'var(--ink-primary)',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {neighbor.title}
        </span>

        {/* Kind label — JetBrains Mono 8px 0.18em UPPER, --ink-faint (spec §typography) */}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '8px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--ink-faint)',
            flexShrink: 0,
          }}
          aria-hidden
        >
          {kindLabel}
        </span>

        {/*
         * Date — Special Elite 9px 0.04em, --ink-faint (value register).
         * Hidden at ≤600px via WorldlineLinks.css .wl-neighbor-date rule.
         */}
        <span
          className="t-type wl-neighbor-date"
          style={{
            fontFamily: 'var(--font-type)',
            fontSize: '9px',
            letterSpacing: '0.04em',
            color: 'var(--ink-faint)',
            flexShrink: 0,
          }}
          aria-hidden
        >
          {neighbor.date}
        </span>
      </a>

      {/*
       * Edge label row — Cormorant Garamond italic 12px (voice register, --ink-soft).
       * Indented 28px (past 20px glyph + 8px gap).
       * border-bottom: 1px dashed var(--ink-dashed) (atom dashed-hairline).
       * Absent when label is not present (no empty row rendered — spec §states).
       */}
      {neighbor.label && (
        <div
          style={{
            paddingLeft: '28px',
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
          {neighbor.label}
        </div>
      )}
    </div>
  )
}

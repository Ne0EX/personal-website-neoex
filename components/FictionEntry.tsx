/**
 * FictionEntry.tsx — server component
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders the /fiction/<slug> entry surface.
 * Composed of: EntryShell (chrome + header + worldline) + fiction-specific
 * body rendering + § α variants possibility horizon.
 *
 * Design spec:  docs/design/12-entry-routes.md §self-depth-fiction (Betelgeuse)
 * Precedent:    ArticleEntry.tsx (body rhythm, section-separator pattern)
 *               PhotoEntry.tsx (header strip, dashed hairlines)
 *
 * Atoms composed (Rule 5):
 *   paper-warm-surface — § α variants panel background
 *   dashed-hairline    — section seams (above + below variants block)
 *   diverge-panel      — bounding frame for each variant card (TL+BR 8×8px reticles)
 *   fic-node           — hollow ring at card head (○ glyph, fic-node role)
 *   type-roles         — Special Elite (α VALUE 26px) / Cormorant italic (delta_summary VOICE)
 *                      / JetBrains Mono (labels INSTRUMENT)
 *   attractor-pill     — [ENTER BRANCH →] CTA (af-pill pattern, inline-styled)
 *
 * § α variants block:
 *   <section aria-label="alternate worldline variants">
 *   Stack of up to 4 .diverge-panel cards. Omitted when variants is absent or empty.
 *   Each card: role="group" aria-label="α <value>".
 *   [ENTER BRANCH →] CTA: only when variants[].slug is populated (per spec).
 *
 * Owner: Sirius (α-SUR-01) · S2 entry-routes (VISION-2026-05-31)
 */

import type { Fiction } from '@/lib/content/types'
import { EntryShell } from '@/components/EntryShell'

interface FictionEntryProps {
  fiction: Fiction
  /** Optional rendered MDX body (DL4 store-as-source S3). When omitted, falls back to summary placeholder. */
  body?: React.ReactNode
}

/** Site canonical alpha — for drift computation when variant.drift is absent. */
const SITE_ALPHA = 1.130426

export function FictionEntry({ fiction, body }: FictionEntryProps) {
  const {
    slug,
    title,
    date,
    domain,
    tags,
    summary,
    variants,
    isoDate,
  } = fiction

  const hasVariants = variants && variants.length > 0

  // status: fiction has no status field in schema — use a fixed display
  const status = 'TRANSMISSION'

  // Alive signal: tended N× = variants.length (each variant is a revision event)
  const tendedCount = hasVariants ? (variants?.length ?? 0) : 1
  const tendedLast = date // fiction doesn't have explicit revision dates; use entry date

  return (
    <EntryShell
      kind="fiction"
      identifier={slug}
      title={title}
      date={date}
      status={status}
      tags={tags}
      shareLocation={false}
      // Fiction has no GPS coords in normal operation (meaning-coords, not GPS).
      // originLocus is an optional field — if present, do not gate on shareLocation.
      // Per spec: fiction NETRA L1 renders only when coords are shared.
      // Fiction does not have shareLocation field → omit NETRA L1 entirely.
    >

      {/*
       * Pagefind search metadata — hidden from visual display.
       * data-pagefind-body: marks this element as search body.
       * Spec: docs/design/14-triangulate-search.md (alive signal, kind)
       */}
      <div
        data-pagefind-body
        aria-hidden
        style={{ display: 'none' }}
      >
        <span data-pagefind-meta="kind">fiction</span>
        <span data-pagefind-meta="fileNum">{slug}</span>
        <span data-pagefind-meta="date">{date}</span>
        <span data-pagefind-meta="isoDate">{isoDate}</span>
        <span data-pagefind-meta="tags">{tags.join(', ')}</span>
        <span data-pagefind-meta="tended-count">{String(tendedCount)}</span>
        <span data-pagefind-meta="tended-last">{tendedLast}</span>
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
          margin: '0 0 24px',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h1>

      {/* ── DOMAIN + DATE instrument row ── */}
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
          flexWrap: 'wrap',
        }}
        aria-label={`Domain: ${domain}, Date: ${date}`}
      >
        <span>NeX ORBIT</span>
        <span style={{ color: 'var(--ink-dashed)' }}>·</span>
        <span style={{ color: 'var(--ink-soft)' }}>{domain.toUpperCase()}</span>
        <span style={{ color: 'var(--ink-dashed)' }}>·</span>
        {/* α SITE value — Special Elite */}
        <span
          style={{
            fontFamily: 'var(--font-type)',
            fontSize: '9px',
            letterSpacing: '0.04em',
            textTransform: 'none',
            color: 'var(--ink-soft)',
          }}
        >
          α {SITE_ALPHA}
        </span>
      </div>

      {/* Body region — DL4 store body or summary placeholder */}
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
        {body ?? (
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
            {summary}
          </p>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────── */}
      {/* § SELF-DEPTH — α variants possibility horizon          */}
      {/* Spec: stack of up to 4 diverge-panel cards.           */}
      {/* Omitted when variants is absent or empty.             */}
      {/* ─────────────────────────────────────────────────────── */}
      {hasVariants && (
        <section aria-label="alternate worldline variants">
          {/* Top dashed-hairline */}
          <div
            aria-hidden
            style={{ borderBottom: '1px dashed var(--ink-dashed)', marginBottom: '16px' }}
          />

          {/* Section header */}
          <div
            className="t-meta"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: 'var(--ink-soft)',
              marginBottom: '4px',
              fontWeight: 400,
            }}
          >
            § α VARIANTS
          </div>

          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '8px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--ink-faint)',
              marginBottom: '16px',
            }}
          >
            POSSIBILITY HORIZON
          </div>

          {/*
           * Diverge-panel stack — each variant is a .diverge-panel card.
           * .diverge-panel from globals.css: TL+BR 8×8px orange corner reticles.
           * Each card: role="group" aria-label="α <value>" per spec §accessibility.
           */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
            {variants.map((variant) => {
              // Compute drift: |variant.alpha − SITE_ALPHA|, 5dp precision.
              const driftVal =
                variant.drift !== undefined
                  ? variant.drift
                  : Math.abs(parseFloat(variant.alpha) - SITE_ALPHA)
              const driftSign = parseFloat(variant.alpha) >= SITE_ALPHA ? '+' : '-'
              const driftDisplay = `${driftSign}${driftVal.toFixed(5)}`

              return (
                /*
                 * .diverge-panel — atom (globals.css lines 323–415).
                 * position:relative required for the ::before/::after corner reticles.
                 * Override grid layout for entry page: simple flex column.
                 */
                <div
                  key={variant.alpha}
                  className="diverge-panel"
                  role="group"
                  aria-label={`α ${variant.alpha}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '16px 20px',
                    gridTemplateColumns: undefined,
                    gridTemplateRows: undefined,
                  }}
                >
                  {/* Card head: fic-node glyph (○) + α value (Special Elite 26px) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '10px',
                    }}
                  >
                    {/*
                     * fic-node: hollow ring glyph ○ — JetBrains Mono, ink-soft.
                     * Per spec: "fic-node (hollow ring at § α variant card head)".
                     * Implemented as Unicode ○ (U+25CB) in instrument register.
                     */}
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--ink-soft)',
                        letterSpacing: 0,
                        userSelect: 'none',
                      }}
                      aria-hidden
                    >
                      ○
                    </span>

                    {/* α VALUE — Special Elite 26px (diverge-panel-num class) */}
                    <span
                      className="diverge-panel-num"
                      style={{
                        fontFamily: 'var(--font-type)',
                        fontSize: '26px',
                        letterSpacing: '0.04em',
                        color: 'var(--ink-primary)',
                        lineHeight: 1,
                      }}
                    >
                      {variant.alpha}
                    </span>
                  </div>

                  {/* Drift row — t-meta, Special Elite value */}
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-soft)',
                      display: 'flex',
                      gap: '6px',
                      alignItems: 'baseline',
                    }}
                  >
                    <span>DRIFT</span>
                    <span
                      style={{
                        fontFamily: 'var(--font-type)',
                        fontSize: '11px',
                        letterSpacing: '0.04em',
                        textTransform: 'none',
                        color: 'var(--ink-primary)',
                      }}
                    >
                      {driftDisplay}
                    </span>
                    <span style={{ color: 'var(--ink-faint)' }}>FROM SITE α</span>
                  </div>

                  {/* delta_summary — VOICE role (Cormorant italic 13px) */}
                  <p
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontStyle: 'italic',
                      fontSize: '13px',
                      color: 'var(--ink-primary)',
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    {variant.delta_summary}
                  </p>

                  {/*
                   * [ENTER BRANCH →] CTA — present only when variants[].slug exists.
                   * Styled as af-pill (inline implementation: border + mono uppercase).
                   * aria-label per spec §accessibility.
                   */}
                  {variant.slug && (
                    <div style={{ marginTop: '4px' }}>
                      <a
                        href={`/fiction/${variant.slug}`}
                        aria-label={`enter α ${variant.alpha} branch`}
                        style={{
                          display: 'inline-block',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '10px',
                          letterSpacing: '0.15em',
                          textTransform: 'uppercase',
                          padding: '0.5em 0.85em',
                          background: 'transparent',
                          border: '1px solid var(--ink-faint)',
                          color: 'var(--ink-primary)',
                          textDecoration: 'none',
                          transition: 'border-color 150ms ease, color 150ms ease',
                        }}
                        onMouseEnter={undefined}
                        onMouseLeave={undefined}
                      >
                        ENTER BRANCH →
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
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

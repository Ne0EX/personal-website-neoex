/**
 * RollIndex.tsx — server component
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders the /photos/<roll> contact sheet — a surveyed register of frames
 * in capture sequence. One horizontal strip per frame, ID left / meta center /
 * mount right, reading top-to-bottom as a survey log.
 *
 * Design reference: docs/design/11-photo-roll-index.md (Betelgeuse spec)
 * Vision reference: docs/team/VISION-2026-05-31-search-lineage-console.md §7 S1
 *
 * Atoms composed (per Betelgeuse §atoms used):
 *   paper-mount      — 8px --paper-warm margin + 1px --ink-faint border
 *   corner-reticle   — outer container L-bracket marks (via .corner-marks)
 *   dashed-hairline  — roll header foot + strip separators + footer top
 *   type-roles       — Cormorant italic (voice) / JetBrains Mono (instrument) /
 *                      Special Elite (value)
 *   entry-glitch     — hover underline on caption within each strip link
 *
 * v1 no-image: sidecar.variants?.thumb.webp is absent for all frames.
 * Renders .paper-mount-image placeholder div (paper-deep bg + frame ID).
 * No <img> rendered until variants are present.
 *
 * Owner: Sirius (α-SUR-01) · S1 roll-index (VISION-2026-05-31)
 */

// Side-effect import: loads roll-index responsive layout rules into the global cascade.
// NOT a CSS module — global .roll-index-strip media queries require no class mangling.
import './RollIndex.css'

import type { RollContacts } from '@/lib/content/photos'

interface RollIndexProps {
  roll: string
  contacts: RollContacts
}

export function RollIndex({ roll, contacts }: RollIndexProps) {
  const { sidecars, lede, dateRange } = contacts
  const frameCount = sidecars.length

  // Format slug for instrument display: uppercase, no raw value invention
  const slugDisplay = roll.toUpperCase()

  // Date range label (YYYY.MM.DD — YYYY.MM.DD in Special Elite)
  const dateRangeDisplay = dateRange

  return (
    /*
     * Outer container: max-width 900px, centered, corner reticles (atom corner-reticle).
     * .corner-marks provides the L-bracket reticles from globals.css.
     * position:relative required for corner-marks absolute positioning.
     */
    <div
      style={{
        position: 'relative',
        maxWidth: '900px',
        margin: '0 auto',
        padding: '0 var(--gap-md, 32px)',
        background: 'var(--paper-base)',
      }}
      className="roll-index-outer"
    >
      {/*
       * Pagefind body + kind meta are NOT set here.
       * scripts/inject-pagefind-sidecar.ts rollIndexSidecar() is the single
       * source of truth for this page's pagefind metadata (kind:photo-roll,
       * roll, frame-count, date-range). If data-pagefind-body were present
       * here the sidecar's hasRealPagefindBody() guard would skip injection,
       * leaving the page without the correct kind meta.
       * TriangulateSearch maps "photo-roll" → PHOTO bucket (label + filter).
       */}
      {/* Corner reticles — atom corner-reticle, L-bracket marks */}
      <div className="corner-marks" aria-hidden />

      {/* ── Roll header strip ── */}
      <header
        aria-label={`Roll ${roll}`}
        style={{
          background: 'var(--paper-warm)',
          padding: '16px 20px 14px',
          borderBottom: '1px dashed var(--ink-dashed)',
          position: 'relative',
          zIndex: 3,
        }}
      >
        {/* Row 1: ROLL · {slug} (left) + FRAMES · n  DATE RANGE (right) */}
        <div
          className="roll-index-header-row1"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          {/* Left: ROLL slug label */}
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--meta-size)',
              letterSpacing: 'var(--meta-tracking)',
              textTransform: 'uppercase',
              color: 'var(--ink-soft)',
              display: 'flex',
              gap: '6px',
              alignItems: 'baseline',
            }}
          >
            <span>ROLL ·</span>
            {/* Slug value — stronger ink */}
            <span
              style={{
                fontWeight: 500,
                color: 'var(--ink-primary)',
                letterSpacing: 'var(--meta-tracking)',
              }}
            >
              {slugDisplay}
            </span>
          </div>

          {/* Right: FRAMES · n  +  date range */}
          <div
            className="roll-index-header-right"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--meta-size)',
              letterSpacing: 'var(--meta-tracking)',
              textTransform: 'uppercase',
              color: 'var(--ink-soft)',
              display: 'flex',
              gap: '12px',
              alignItems: 'baseline',
              flexWrap: 'wrap',
            }}
          >
            <span>
              FRAMES ·{' '}
              <span style={{ color: 'var(--ink-primary)', fontWeight: 500 }}>
                {String(frameCount).padStart(2, '0')}
              </span>
            </span>
            {/* Date range in Special Elite (value role) */}
            {dateRangeDisplay && (
              <span
                style={{
                  fontFamily: 'var(--font-type)',
                  fontSize: 'var(--meta-size)',
                  letterSpacing: '0.04em',
                  color: 'var(--ink-primary)',
                  textTransform: 'none',
                }}
              >
                {dateRangeDisplay}
              </span>
            )}
          </div>
        </div>

        {/* Row 2: roll lede — italic Cormorant, hidden if empty (2026-04-chiang-mai) */}
        {lede && (
          <p
            className="wl-lede roll-index-lede"
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: '14px',
              letterSpacing: '0.005em',
              color: 'var(--ink-soft)',
              lineHeight: 1.55,
              margin: '10px 0 0',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
            }}
          >
            {lede}
          </p>
        )}
      </header>

      {/* ── Contact sheet — ordered list, capture sequence ── */}
      {frameCount === 0 ? (
        /* Empty roll state — no frames recorded */
        <div
          style={{
            padding: '24px 20px',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--meta-size)',
            letterSpacing: 'var(--meta-tracking)',
            textTransform: 'uppercase',
            color: 'var(--ink-faint)',
          }}
          aria-live="polite"
        >
          NO FRAMES RECORDED
        </div>
      ) : (
        /*
         * Ordered list — capture sequence is meaningful (AC11).
         * Each li > a is the entire strip link.
         */
        <ol
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        >
          {sidecars.map((sidecar) => {
            const { id, caption, date, isoDate, variants } = sidecar
            const hasThumb = !!(variants?.thumb?.webp)

            // aria-label: "Frame {id} · {date} · {first-10-words-of-caption}"
            // Spec: if no caption → "Frame {id} · {date}"
            let ariaLabel = `Frame ${id} · ${date}`
            if (caption) {
              const words = caption.split(/\s+/).slice(0, 10).join(' ')
              const truncated = words.length < caption.length ? words + '…' : words
              ariaLabel = `Frame ${id} · ${date} · ${truncated}`
            }

            return (
              <li key={id}>
                {/*
                 * Strip link — entire strip is the anchor.
                 * entry-glitch on caption text handles hover underline (atom entry-glitch).
                 * Hover surface tint (paper-warm → paper-bright) via roll-index-strip:hover CSS.
                 * focus-visible: 2px solid accent-orange, offset 2px — matches site-wide.
                 */}
                <a
                  href={`/photos/${roll}/${id}`}
                  aria-label={ariaLabel}
                  className="roll-index-strip entry-card"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr 160px',
                    gap: '24px',
                    alignItems: 'center',
                    padding: '16px 20px',
                    background: 'var(--paper-warm)',
                    borderBottom: '1px dashed var(--ink-dashed)',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'background 150ms ease',
                    position: 'relative',
                    minHeight: '44px',
                  }}
                >
                  {/* ── LEFT (60px): frame ID + date ── */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      minWidth: 0,
                    }}
                  >
                    {/* Frame ID — Special Elite 18px (value role) */}
                    <span
                      style={{
                        fontFamily: 'var(--font-type)',
                        fontSize: '18px',
                        letterSpacing: '0.04em',
                        color: 'var(--ink-primary)',
                        lineHeight: 1,
                        wordBreak: 'break-all',
                      }}
                    >
                      {id}
                    </span>
                    {/* Date — JetBrains Mono 9px (t-meta, instrument role) */}
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--meta-size)',
                        letterSpacing: '0.22em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-soft)',
                        lineHeight: 1,
                      }}
                    >
                      {isoDate.replace(/-/g, '.')}
                    </span>
                  </div>

                  {/* ── CENTER (1fr): caption ── */}
                  <div style={{ minWidth: 0 }}>
                    {/*
                     * Caption — Cormorant italic 13.5px (voice role).
                     * entry-glitch atom: hover underline draws 0 → 100% in 460ms.
                     * entry-card class on the parent <a> triggers .entry-card:hover .entry-glitch.
                     */}
                    {caption && (
                      <span
                        className="entry-glitch"
                        data-text={caption}
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontStyle: 'italic',
                          fontSize: 'var(--body-size)',
                          letterSpacing: '0.005em',
                          color: 'var(--ink-primary)',
                          lineHeight: 1.55,
                          display: '-webkit-box',
                          WebkitBoxOrient: 'vertical',
                          WebkitLineClamp: 2,
                          overflow: 'hidden',
                        }}
                      >
                        {caption}
                      </span>
                    )}
                  </div>

                  {/* ── RIGHT (160px): paper-mount atom ── */}
                  {/*
                   * Atom paper-mount: 8px --paper-warm margin + 1px --ink-faint border.
                   * The outer .paper-mount div is the atom wrapper (AC6 gate checks this class).
                   * Inside: .paper-mount-image — either <img> or placeholder div.
                   * v1 no-image: all frames use placeholder (no thumb.webp available).
                   */}
                  <div className="paper-mount roll-index-mount">
                    {hasThumb ? (
                      <img
                        src={variants!.thumb.webp}
                        alt={caption ?? `Frame ${id}, ${roll}`}
                        className="paper-mount-image"
                        style={{
                          width: '100%',
                          height: 'auto',
                          display: 'block',
                          aspectRatio: '4 / 3',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      /*
                       * Placeholder: 4:3 aspect, paper-deep background,
                       * frame ID centered in t-mono 9px --ink-faint (v1 state).
                       * role="img" + aria-label per spec (accessibility).
                       */
                      <div
                        className="paper-mount-image"
                        role="img"
                        aria-label={`No image available for frame ${id}`}
                        style={{
                          width: '100%',
                          aspectRatio: '4 / 3',
                          background: 'var(--paper-deep)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--meta-size)',
                            letterSpacing: '0.22em',
                            textTransform: 'uppercase',
                            color: 'var(--ink-faint)',
                          }}
                        >
                          {id}
                        </span>
                      </div>
                    )}

                    {/* Mount label: FRAME {id} in t-meta 9px --ink-soft */}
                    <div
                      aria-hidden
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--meta-size)',
                        letterSpacing: '0.22em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-soft)',
                        marginTop: '6px',
                        lineHeight: 1,
                      }}
                    >
                      FRAME {id}
                    </div>
                  </div>
                </a>
              </li>
            )
          })}
        </ol>
      )}

      {/* ── Roll footer ── */}
      <footer
        aria-label="Roll summary"
        style={{
          borderTop: '1px solid var(--ink-hairline)',
          padding: '12px 20px',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--meta-size)',
          letterSpacing: 'var(--meta-tracking)',
          textTransform: 'uppercase',
          color: 'var(--ink-faint)',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
          position: 'relative',
          zIndex: 3,
        }}
      >
        <span>ROLL CLOSED</span>
        <span aria-hidden>·</span>
        <span>
          {String(frameCount).padStart(2, '0')} FRAME{frameCount !== 1 ? 'S' : ''}
        </span>
        {dateRangeDisplay && (
          <>
            <span aria-hidden>·</span>
            <span
              style={{
                fontFamily: 'var(--font-type)',
                letterSpacing: '0.04em',
                textTransform: 'none',
              }}
            >
              {dateRangeDisplay}
            </span>
          </>
        )}
      </footer>
    </div>
  )
}

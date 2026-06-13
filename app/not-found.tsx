/**
 * app/not-found.tsx — Worldline 404
 * ─────────────────────────────────────────────────────────────────────────────
 * Branded not-found surface. Replaces the unbranded default Next.js 404 (audit
 * 2.J — the only route with no way back to the site). Soul constraint: exploration
 * not exhibition — terse instrument register, no explainer bloat. One clear path
 * home.
 *
 * Design idioms carried from the existing site shell:
 *   - .paper-canvas — warm paper surface + dot grid (existing atom)
 *   - .t-mono / var(--font-mono) — instrument register (existing atom)
 *   - .t-meta / var(--meta-size) — ambient label scale (existing atom)
 *   - .corner-marks — TL/BR orange reticle brackets (existing atom)
 *   - var(--ink-soft/faint/accent-orange) — all from app/globals.css tokens
 *   - section-rule — dashed hairline divider (existing atom)
 *   - .scroll-meter — existing atom kept for chrome consistency
 *
 * Copy register: instrument-terse, no narrative explanation. The 404 is a
 * telemetry reading on the shell — "SIGNAL LOST" — not a customer service message.
 *
 * Owner: Sirius (α-SUR-01) · wiring-wave2
 */

import Link from 'next/link';
import { CornerMarks } from '@/components/CornerMarks';

export const metadata = {
  title: '404 · SIGNAL LOST · Worldline · ∇ Neospirit',
};

export default function NotFound() {
  return (
    <main
      className="paper-canvas"
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      {/* Scroll meter — existing chrome atom */}
      <div className="scroll-meter" aria-hidden="true" />

      {/* Corner reticles */}
      <CornerMarks />

      {/* Header strip — mirrors the observatory header pattern */}
      <header
        className="section-rule"
        style={{
          padding: '24px 40px 20px',
          borderBottom: '1px dashed var(--ink-dashed)',
        }}
      >
        <div className="t-meta" style={{ marginBottom: '6px' }}>
          <span style={{ color: 'var(--ink-soft)' }}>WORLDLINE · </span>
          <span style={{ color: 'var(--accent-orange)' }}>SIGNAL LOST</span>
        </div>
        <div className="t-meta" style={{ color: 'var(--ink-soft)' }}>
          <span style={{ color: 'var(--accent-orange)' }}>∇ Ne0EX</span>
          {' · LOCUS NOT FOUND · STATUS '}
          <span style={{ color: 'var(--accent-orange)' }}>404</span>
        </div>
      </header>

      {/* Body — instrument readout register, centred, no prose */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '0 40px',
          gap: '24px',
        }}
      >
        {/* Primary reading — large mono numeral */}
        <div
          className="t-mono"
          style={{
            fontSize: '64px',
            fontWeight: 300,
            color: 'var(--ink-soft)',
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
          aria-label="Error 404"
        >
          <span style={{ color: 'var(--accent-orange)' }}>4</span>
          <span>0</span>
          <span style={{ color: 'var(--accent-orange)' }}>4</span>
        </div>

        {/* Instrument comment — ambient tier */}
        <div
          className="t-meta"
          style={{
            color: 'var(--ink-faint)',
            letterSpacing: '0.3em',
          }}
        >
          {'// node out of range · no locus registered'}
        </div>

        {/* Route home — the single exit path */}
        <Link
          href="/"
          className="t-mono"
          style={{
            display: 'inline-block',
            fontSize: '9px',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: 'var(--ink-soft)',
            textDecoration: 'none',
            borderBottom: '1px dashed var(--ink-dashed)',
            paddingBottom: '2px',
            transition: 'color 150ms ease, border-color 150ms ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color =
              'var(--accent-orange)';
            (e.currentTarget as HTMLAnchorElement).style.borderColor =
              'var(--accent-orange)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color =
              'var(--ink-soft)';
            (e.currentTarget as HTMLAnchorElement).style.borderColor =
              'var(--ink-dashed)';
          }}
        >
          [ ◯ return to atlas ]
        </Link>
      </div>

      {/* Marginalia — fixed right-edge instrument readout (existing atom) */}
      <div className="marginalia" aria-hidden="true">
        <span className="ma-accent">404</span>
        <span>SIGNAL</span>
        <span>LOST</span>
      </div>
    </main>
  );
}

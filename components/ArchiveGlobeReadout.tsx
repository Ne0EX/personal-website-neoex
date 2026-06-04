'use client';

/**
 * components/ArchiveGlobeReadout.tsx
 * ----------------------------------
 * The instrument READOUT panel rendered UNDER the /archive mini-globe (and the
 * Triangulate overlay globe). A CLONE of the canonical observatory readout —
 * .claude/skills/worldline-design/ui_kits/observatory/atlas.jsx L106-129 + the
 * NETRA console L133-154.
 *
 * It shows the SURVEY GEOMETRY (reticle label, drift distance, bearing, stratum,
 * live hover coord) — never the node's inner meaning. This is the instrument
 * texture worldline-soul WANTS: the pleasure of surveying the bearing between two
 * loci, withholding the meaning until the visitor opens the entry.
 *
 * Rows (mono 9px, --ink-soft labels / Special-Elite values, teal):
 *   RETICLE  — locked/hovered node label + place ('STANDBY' idle)
 *   DRIFT A  — great-circle km α→node ('drift N.Nk')
 *   BEARING  — compass bearing α→node in degrees + cardinal ('291° WNW')
 *   STRATUM  — Ne0 · ARCHIVE band + kind sub-label (ARTICLE / PHOTO / FICTION)
 *   COORD    — live surface hover lat/lon (WL_GLOBE_COORD_EVENT) — STANDBY otherwise
 *   α        — fixed observer locus (orange), always 'α 13.76°N · 100.50°E'
 * + a '⟶ NEXT NODE' jump button cycling the lock through the pin set.
 *
 * ORANGE is reserved for α + drift; the live values stay teal/ink. aria-live=polite.
 * Owner: Sirius (α-SUR-01)
 */

import { useEffect, useState } from 'react';
import { WL_GLOBE_COORD_EVENT } from '@/lib/client-state/globe-store';
import { formatNetraCoord } from '@/lib/globe-coordinates';
import type { MiniGlobeReadout } from './ArchiveMiniGlobe';

// α — Bangkok observer locus (matches the globe + lib). Fixed, orange.
const ALPHA_COORD_LABEL = '13.76°N · 100.50°E';

export interface ArchiveGlobeReadoutProps {
  /** The current readout broadcast from the globe (null → STANDBY). */
  readout: MiniGlobeReadout | null;
  /** Whether any pins exist (gates the NEXT NODE button). */
  hasPins: boolean;
  /** Cycle the lock to the next pin (clone ATLAS '⟶ NEXT NODE'). */
  onJumpNext: () => void;
}

const KIND_STRATUM: Record<string, string> = {
  article: 'Ne0 · ARCHIVE · ARTICLE',
  photo: 'Ne0 · ARCHIVE · PHOTO',
  fiction: 'Ne0 · ARCHIVE · FICTION',
};

// NOTE (Betelgeuse mini-readout, inline-beats-stylesheet fix): the ROW layout
// (display:grid + the 54px/1fr columns + gap + padding) is NOT set inline
// anymore — it lives on `.archive-globe-readout [data-arl-row]` in globals.css.
// Inline display/grid-template would beat the @container arl mini rules and
// defeat both the BEARING/STRATUM/COORD fold (display:none) and the
// RETICLE/DRIFT/α column compaction. The `data-arl-row` hook already on every
// row carries the base layout; this object is gone so the stylesheet wins.
// (Same trap the spec already solved for valStyle.)
//
// keyStyle is likewise gone: its only declaration (letter-spacing:0.18em) moved
// into the `.arl-key` base rule so the mini `.arl-key { letter-spacing:0.1em }`
// can override it.
// NOTE (Betelgeuse mini-readout): textAlign/whiteSpace/overflow/textOverflow are
// NOT set inline anymore — they live on .arl-val in globals.css (right-align +
// ellipsis-clip in the full panel). Inline values would beat the stylesheet and
// defeat the @container arl mini override (which re-wraps the RETICLE locus at
// ≤300px). The shared style object carries font-family ONLY; layout = CSS.
const valStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display-mono, var(--font-mono))',
};

export function ArchiveGlobeReadout({
  readout,
  hasPins,
  onJumpNext,
}: ArchiveGlobeReadoutProps) {
  // Live surface hover coord — driven by the globe's WL_GLOBE_COORD_EVENT.
  const [hoverCoord, setHoverCoord] = useState<string | null>(null);
  useEffect(() => {
    const onCoord = (ev: Event) => {
      const detail = (ev as CustomEvent<{ lat: number; lon: number } | null>).detail;
      setHoverCoord(detail ? formatNetraCoord(detail.lat, detail.lon) : null);
    };
    window.addEventListener(WL_GLOBE_COORD_EVENT, onCoord);
    return () => window.removeEventListener(WL_GLOBE_COORD_EVENT, onCoord);
  }, []);

  const pin = readout?.pin ?? null;
  const reticleLabel = pin ? pin.title : 'STANDBY';
  const reticlePlace = pin?.place ?? '';
  const driftLabel =
    readout?.driftKm != null ? `drift ${(readout.driftKm / 1000).toFixed(1)}k` : '—';
  const bearingLabel =
    readout?.bearingDeg != null
      ? `${Math.round(readout.bearingDeg)}° ${readout.cardinal}`
      : '—';
  const stratumLabel = pin ? KIND_STRATUM[pin.kind] ?? 'Ne0 · ARCHIVE' : 'Ne0 · ARCHIVE';
  const coordLabel = hoverCoord ?? (pin ? '—' : 'STANDBY');

  return (
    <div
      className="t-mono archive-globe-readout"
      aria-live="polite"
      style={{
        width: '100%',
        fontSize: '9px',
        textTransform: 'uppercase',
        border: '1px dashed var(--ink-dashed)',
        padding: '10px 12px',
        marginTop: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
      }}
    >
      <div
        className="arl-head"
        style={{
          letterSpacing: '0.3em',
          marginBottom: '6px',
          paddingBottom: '6px',
          borderBottom: '1px dashed var(--ink-dashed)',
        }}
      >
        READOUT
      </div>

      {/* RETICLE — locked/hovered node + place (or STANDBY). The teal --netra is
          the live target colour; only the STANDBY (no pin) state falls to the
          ambient .arl-val read-tier. */}
      <div data-arl-row="reticle">
        <span className="arl-key">RETICLE</span>
        <span
          className="arl-val"
          style={pin ? { ...valStyle, color: 'var(--netra)' } : valStyle}
        >
          {reticleLabel}
          {reticlePlace && (
            <span style={{ color: 'var(--ink-soft)' }}> · {reticlePlace}</span>
          )}
        </span>
      </div>

      {/* DRIFT A — great-circle km α→node. */}
      <div data-arl-row="drift">
        <span className="arl-key">DRIFT A</span>
        <span className="arl-val" style={valStyle}>{driftLabel}</span>
      </div>

      {/* BEARING — compass bearing α→node. */}
      <div data-arl-row="bearing">
        <span className="arl-key">BEARING</span>
        <span className="arl-val" style={valStyle}>{bearingLabel}</span>
      </div>

      {/* STRATUM — surface band + kind. */}
      <div data-arl-row="stratum">
        <span className="arl-key">STRATUM</span>
        <span className="arl-val" style={valStyle}>{stratumLabel}</span>
      </div>

      {/* COORD — live surface hover lat/lon. */}
      <div data-arl-row="coord">
        <span className="arl-key">COORD</span>
        <span className="arl-val" style={valStyle}>{coordLabel}</span>
      </div>

      {/* α — fixed observer locus (orange, RESERVED; .arl-alpha keeps it orange
          regardless of the read-tier lift). */}
      <div data-arl-row="alpha">
        <span className="arl-alpha" style={{ letterSpacing: '0.18em', color: 'var(--accent-orange)' }}>α</span>
        <span className="arl-alpha" style={{ ...valStyle, color: 'var(--accent-orange)' }}>
          {ALPHA_COORD_LABEL}
        </span>
      </div>

      {/* ⟶ NEXT NODE — cycle the lock through the pin set (clone ATLAS L153). */}
      <button
        type="button"
        onClick={onJumpNext}
        disabled={!hasPins}
        className="t-mono arl-next"
        style={{
          // marginTop / letterSpacing / padding moved to .arl-next in globals.css
          // so the @container arl mini rule can tighten them (inline would win).
          appearance: 'none',
          background: 'none',
          border: '1px dashed var(--ink-dashed)',
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          textTransform: 'uppercase',
          // Resting enabled colour comes from .arl-next (read-tier lift); only the
          // disabled state forces ink-faint inline.
          ...(hasPins ? {} : { color: 'var(--ink-faint)' }),
          cursor: hasPins ? 'pointer' : 'not-allowed',
          transition: 'color 150ms ease',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          if (hasPins) e.currentTarget.style.color = 'var(--accent-orange)';
        }}
        onMouseLeave={(e) => {
          // Restore the resting read-tier label (matches .arl-next), not the
          // pre-lift ink-soft.
          if (hasPins) e.currentTarget.style.color = 'var(--ink-label)';
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px dashed var(--accent-orange)';
          e.currentTarget.style.outlineOffset = '2px';
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none';
        }}
      >
        ⟶ NEXT NODE
      </button>
    </div>
  );
}

export default ArchiveGlobeReadout;

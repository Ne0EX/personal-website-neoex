import { ImageResponse } from 'next/og'
import type { CSSProperties } from 'react'
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site'

export const alt = SITE_NAME

/** The ∇ glyph is absent from the OG renderer's default font. */
const WORDMARK = 'NEOSPIRIT'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * ImageResponse renders in an isolated Satori tree, so document-level custom
 * properties are unavailable. Bridge the canonical light-register tokens from
 * app/globals.css onto the image root, then consume only their token names.
 */
const OG_TOKEN_BRIDGE = {
  '--paper-base': 'rgb(232 226 213)',
  '--ink-rgb': '31 80 99',
  '--ink-primary': 'rgb(var(--ink-rgb))',
  '--ink-body': 'rgb(var(--ink-rgb) / 0.82)',
  '--accent-orange': 'rgb(212 96 42)',
} as CSSProperties

/**
 * Static OG card — paper-cream ground, ink rules and orange accent, matching
 * the surveyed-document look of the site itself.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          ...OG_TOKEN_BRIDGE,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'var(--paper-base)',
          color: 'var(--ink-primary)',
          padding: '72px 80px',
          fontFamily: 'monospace',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 22,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
          }}
        >
          <span>File — 000 / Genesis</span>
          <span style={{ color: 'var(--accent-orange)' }}>Worldline 1.130426</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ fontSize: 72, lineHeight: 1.05 }}>
            an archive of unfinished thought, surveyed openly.
          </div>
          <div style={{ fontSize: 26, lineHeight: 1.5, color: 'var(--ink-body)' }}>
            {SITE_DESCRIPTION}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 24,
            letterSpacing: '0.24em',
            borderTop: '2px solid var(--ink-primary)',
            paddingTop: 24,
          }}
        >
          <span>{WORDMARK}</span>
          <span style={{ color: 'var(--accent-orange)' }}>EST. 2026 — BANGKOK / TH</span>
        </div>
      </div>
    ),
    size
  )
}

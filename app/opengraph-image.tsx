import { ImageResponse } from 'next/og'
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site'

export const alt = SITE_NAME

/** The ∇ glyph is absent from the OG renderer's default font. */
const WORDMARK = 'NEOSPIRIT'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * Static OG card — paper-cream ground, ink rules and orange accent, matching
 * the surveyed-document look of the site itself.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#e8e4d8',
          color: '#1f5063',
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
          <span style={{ color: '#c05a2b' }}>Worldline 1.130426</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ fontSize: 72, lineHeight: 1.05 }}>
            an archive of unfinished thought, surveyed openly.
          </div>
          <div style={{ fontSize: 26, lineHeight: 1.5, color: '#40606e' }}>
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
            borderTop: '2px solid #1f5063',
            paddingTop: 24,
          }}
        >
          <span>{WORDMARK}</span>
          <span style={{ color: '#c05a2b' }}>EST. 2026 — BANGKOK / TH</span>
        </div>
      </div>
    ),
    size
  )
}

/**
 * components/console/PhotoPreview.tsx — Atlas Console Full Editor · PHOTO preview pane
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-safe (NO 'use client'): the film-sim label is decorative, no interaction.
 *
 * Contract: docs/design/atlas-console-full-editor.md §"per-kind: PHOTO → preview pane"
 * + §"prop contracts → 2. PhotoPreview" (Betelgeuse · α-VIS-04 · signed 2026-06-07).
 *
 * Built to the CONTRACT, not the prototype. The contract's PhotoPreview is deliberately
 * minimal — a full-spread frame preview, not the prototype's pe-grid / pe-side / NETRA
 * voice / marginalia / back-links (those would be the over-build trap):
 *   - Frame fills the pane (object-fit: contain, no crop).
 *   - Active frame displayed (default frames[0] when active missing).
 *   - Film-sim overlay: single-word label in the top-right corner-reticle area
 *     (mono 9px orange), decorative only.
 *   - Provenance line: `SOURCE: {fileNum} · {frames.length} FRAMES · {place}`.
 *
 * `narrow` prop (contract §2): true = 390px preview inside the FullPreview overlay.
 *   Collapses the spread to fit a phone-width device frame (smaller type, tighter pad).
 *   The frame still fills with object-fit: contain.
 *
 * MOCK DATA: no real image files exist in /public, so the spread renders a styled
 *   placeholder slot (precedent: .wlc-img-slot) keyed by frame id rather than an <img>
 *   that would 404. The object-fit: contain intent is documented on the slot; src is
 *   retained on PhotoFrame for future real-image wiring (Procyon SCHEMA-NEEDS).
 *
 * Owner: Sirius (α-SUR-01) · atlas-console full editor
 * Reference (NOT copied): editor-kinds.jsx PhotoPreview@137 — its grid/side/NETRA
 *   chrome is intentionally DISCARDED per the contract's minimal spec.
 */

import type { PhotoMeta, PhotoFrame } from './editor-types'

// ─────────────────────────────────────────────────────────────────────────────
// Scoped component CSS. <style> blocks are NOT scoped — all selectors prefixed
// (.ppv-*) so they cannot collide. Tokens/fonts reference globals.css variables.
// ─────────────────────────────────────────────────────────────────────────────

const PHOTO_PREVIEW_CSS = `
/* ── preview shell ─────────────────────────────────────────────────── */
.ppv {
  position: relative;
  height: 100%;
  overflow-y: auto;
  background: var(--paper-base);
  font-family: var(--font-mono);
  display: flex;
  flex-direction: column;
}

/* ── full-spread frame ─────────────────────────────────────────────── */
.ppv-spread {
  flex: 1;
  min-height: 0;
  position: relative;
  display: grid;
  place-items: center;
  padding: 40px;
}
/* corner reticles — orange L-brackets (atom corner-reticle, local placement) */
.ppv-spread::before,
.ppv-spread::after {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  border: 1px solid var(--accent-orange);
  pointer-events: none;
}
.ppv-spread::before { top: 18px; left: 18px; border-right: none; border-bottom: none; }
.ppv-spread::after  { bottom: 18px; right: 18px; border-left: none; border-top: none; }

/* film-sim overlay — top-right reticle area, decorative (mono 9px orange) */
.ppv-sim-label {
  position: absolute;
  top: 20px;
  right: 40px;
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent-orange);
  pointer-events: none;
}

/* frame display — fills, object-fit: contain (no crop). Mock: styled slot. */
.ppv-frame {
  width: 100%;
  max-width: 720px;
  aspect-ratio: 3 / 2;
  border: 1px dashed var(--ink-dashed);
  background: var(--paper-warm);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--ink-faint);
  text-align: center;
  padding: 24px;
}
.ppv-frame-glyph {
  font-size: 28px;
  color: var(--ink-soft);
  line-height: 1;
}
.ppv-frame-id {
  font-size: 11px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
.ppv-frame-note {
  font-size: 9px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--ink-faint);
}
.ppv-caption {
  font-family: var(--font-display);
  font-style: italic;
  font-size: 15px;
  line-height: 1.4;
  color: var(--ink-soft);
  margin: 18px 0 0;
  max-width: 540px;
}

/* ── provenance line ───────────────────────────────────────────────── */
.ppv-prov {
  flex-shrink: 0;
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ink-soft);
  padding: 10px 16px;
  border-top: 1px dashed var(--ink-dashed);
}
.ppv-prov b { color: var(--ink-primary); font-weight: 500; }

/* empty state */
.ppv-empty {
  flex: 1;
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-style: italic;
  font-size: 14px;
  color: var(--ink-soft);
  padding: 40px;
  text-align: center;
}

/* ── narrow (390px device frame inside FullPreview) ────────────────── */
.ppv.is-narrow .ppv-spread { padding: 24px; }
.ppv.is-narrow .ppv-spread::before { top: 10px; left: 10px; }
.ppv.is-narrow .ppv-spread::after  { bottom: 10px; right: 10px; }
.ppv.is-narrow .ppv-sim-label { top: 12px; right: 24px; }
.ppv.is-narrow .ppv-frame { max-width: 100%; padding: 16px; gap: 7px; }
.ppv.is-narrow .ppv-frame-glyph { font-size: 22px; }
.ppv.is-narrow .ppv-caption { font-size: 13px; margin-top: 12px; }
.ppv.is-narrow .ppv-prov { font-size: 8px; letter-spacing: 0.15em; }
`

// ─────────────────────────────────────────────────────────────────────────────
// Props — bound EXACTLY to contract §"prop contracts → 2. PhotoPreview"
// ─────────────────────────────────────────────────────────────────────────────

export interface PhotoPreviewProps {
  meta: PhotoMeta
  frames: PhotoFrame[]
  active: string | null // frame.id to display
  narrow: boolean // true = 390px preview in FullPreview overlay
}

// ─────────────────────────────────────────────────────────────────────────────
// PhotoPreview
// ─────────────────────────────────────────────────────────────────────────────

export function PhotoPreview({ meta, frames, active, narrow }: PhotoPreviewProps) {
  // Resolve active frame — default to frames[0] when active missing.
  const i = frames.findIndex((f) => f.id === active)
  const frame = frames[i >= 0 ? i : 0]

  // Provenance pieces (contract: SOURCE: {fileNum} · {frames.length} FRAMES · {place})
  const total = frames.length
  const place = meta.place

  return (
    <>
      <style>{PHOTO_PREVIEW_CSS}</style>

      <div className={'ppv' + (narrow ? ' is-narrow' : '')}>
        {!frame ? (
          <div className="ppv-empty">
            no frames — add one to the roll to see the spread.
          </div>
        ) : (
          <div className="ppv-spread">
            {/* film-sim overlay label — decorative, top-right reticle area */}
            {frame.filmSim && (
              <span className="ppv-sim-label" aria-hidden>
                {frame.filmSim.toUpperCase()}
              </span>
            )}

            {/* full-spread frame — object-fit: contain (no crop). Mock: styled slot. */}
            <div className="ppv-frame">
              <span className="ppv-frame-glyph" aria-hidden>
                ◎
              </span>
              <span className="ppv-frame-id">{frame.id}</span>
              <span className="ppv-frame-note">image preview pending</span>
            </div>

            {frame.caption && <p className="ppv-caption">{frame.caption}</p>}
          </div>
        )}

        {/* provenance line */}
        <div className="ppv-prov">
          SOURCE: <b>{meta.fileNum}</b> · <b>{total}</b> FRAMES
          {place ? (
            <>
              {' '}
              · <b>{place}</b>
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}

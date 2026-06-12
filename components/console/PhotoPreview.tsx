/**
 * components/console/PhotoPreview.tsx — Atlas Console Full Editor · PHOTO preview pane
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-safe (NO 'use client' at module top): the REAL path mounts PhotoEntry,
 * which itself mounts the FilmSimSwitcher client island — no client boundary is
 * crossed in this file. The MOCK path's label is decorative, no interaction.
 *
 * TWO RENDER PATHS — REAL (new) and MOCK (preserved):
 *
 *   REAL (when `photo` prop is provided): renders the ACTUAL photo-entry surface
 *   via <PhotoEntry photo={photo} …/> — the SAME component the public page
 *   (/photos/<roll>/<id>) renders, plus the working <FilmSimSwitcher> it mounts.
 *   This makes the editor preview the real film-sim system: the switcher mutates
 *   [data-photo-entry-root] data-palette → the PhotoEntry.palette.css palette
 *   blocks re-tint the whole surface (paper/ink/accent tokens swap) + filter the
 *   <img> once pixels land; the photo's as-shot sim is photo.exif.filmSim. This
 *   mirrors the ARTICLE pattern (ArticlePreview reuses ArticleEntryContent). We
 *   reuse PhotoEntry WHOLE — PhotoEntry is the photo content-core (the route owns
 *   PageShell/Nav/HUD chrome, not PhotoEntry), so NO extraction is needed and the
 *   public render stays byte-identical by construction (PhotoEntry untouched).
 *
 *   No real pixels yet: velite variants are undefined until process-photos runs
 *   (Procyon: thumbWebp = variants?.thumb.webp). PhotoEntry already handles the
 *   no-pixels state — it renders its own "VARIANTS PENDING" placeholder. We do
 *   NOT add a second placeholder; the WIN is the real photo-entry + real film-sim
 *   wiring, with pixels appearing when the pipeline runs.
 *
 *   MOCK (when `photo` is absent — e.g. FullPreview's photo path, or no real
 *   sidecar for the slug): the original minimal styled-slot spread, kept verbatim
 *   so existing callers (FullPreview) build unchanged and a graceful fallback
 *   exists when no real sidecar resolves.
 *
 * `narrow` prop (contract §2): true = 390px preview inside the FullPreview overlay
 *   (MOCK path only — FullPreview never passes a real `photo`, so it never mounts
 *   a second [data-photo-entry-root] that FilmSimSwitcher's global querySelector
 *   could grab). The REAL path lets PhotoEntry's own responsive CSS handle width.
 *
 * Owner: Sirius (α-SUR-01) · atlas-console full editor
 * Reference (NOT copied): editor-kinds.jsx PhotoPreview@137 — its grid/side/NETRA
 *   chrome is intentionally DISCARDED per the contract's minimal spec.
 */

import type { PhotoMeta, PhotoFrame } from './editor-types'
// Type-only import: pulling the VALUE would drag lib/content + the .velite cache
// into the client bundle and break `next build`. PhotoSidecar is a plain
// serializable object (velite JSON) → safe to receive across the RSC boundary.
import type { PhotoSidecar } from '@/lib/content/types'
// PhotoEntry is the real photo content-core (the public page renders it too). It
// has NO server-only runtime import (next/link · FilmSimSwitcher client island ·
// a side-effect palette CSS import · a type-only PhotoSidecar), so it renders
// fine inside this (client-tree) preview. Reusing it WHOLE keeps the public
// /photos/<roll>/<id> render byte-identical — PhotoEntry is not modified.
import { PhotoEntry } from '@/components/PhotoEntry'

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

/* ── REAL path — scoped scroll host for the live PhotoEntry surface ──────────
   PhotoEntry is the public photo content-core (data-photo-entry-root). It sizes
   to content and lays out with its own (inline + palette.css) responsive grid —
   we only provide a scrolling host so the full instrument fits the preview pane,
   exactly like ArticlePreview's .wlc-preview scroll column. NOT scoped INTO
   PhotoEntry (no override of its columns); the inline grid wins regardless.

   BUG-C fix: PhotoEntry's three-column grid [260px · 1fr · 240px] requires at
   least ~560px of fixed-column space. In the editor's half-viewport preview pane
   the grid collapses and the right (EXIF + film-sim) aside visually overlaps the
   roll prose column. The fix: overflow-x: auto on the scroll host gives the inner
   PhotoEntry content room to express its full width while keeping the overflow
   contained inside the pane (the .ed-preview-wrap parent clips externally).
   overflow-y keeps the normal vertical scroll for tall content. */
.ppv-real {
  height: 100%;
  overflow-x: auto;
  overflow-y: auto;
  background: var(--paper-base);
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Props — bound EXACTLY to contract §"prop contracts → 2. PhotoPreview"
// ─────────────────────────────────────────────────────────────────────────────

export interface PhotoPreviewProps {
  meta: PhotoMeta
  frames: PhotoFrame[]
  active: string | null // frame.id to display
  narrow: boolean // true = 390px preview in FullPreview overlay (MOCK path)
  /**
   * REAL velite sidecar loaded by the route (?kind=photo&slug=roll/id). When
   * provided, the preview reuses the REAL <PhotoEntry> + working FilmSimSwitcher
   * (the public photo page render). When absent → MOCK styled-slot path (the
   * graceful fallback used by FullPreview and when no real sidecar resolves).
   */
  photo?: PhotoSidecar
  /** Zero-based index of `photo` within its roll (real path; default 0). */
  sequenceIndex?: number
  /** Total photos in `photo`'s roll (real path; default 1). */
  rollTotal?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// PhotoPreview
// ─────────────────────────────────────────────────────────────────────────────

export function PhotoPreview({
  meta,
  frames,
  active,
  narrow,
  photo,
  sequenceIndex = 0,
  rollTotal = 1,
}: PhotoPreviewProps) {
  // ── REAL path — reuse the actual PhotoEntry + working FilmSimSwitcher ───────
  // This is the win: the editor preview IS the real photo-entry + real film-sim
  // system (as-shot sim photo.exif.filmSim + working switcher + palette), not a
  // dead label. Pixels appear when process-photos runs (variants); PhotoEntry
  // renders its own no-pixels placeholder until then. PhotoEntry is untouched →
  // the public /photos/<roll>/<id> render stays byte-identical.
  if (photo) {
    return (
      <>
        <style>{PHOTO_PREVIEW_CSS}</style>
        <div className="ppv-real">
          <PhotoEntry
            photo={photo}
            sequenceIndex={sequenceIndex}
            rollTotal={rollTotal}
          />
        </div>
      </>
    )
  }

  // ── MOCK path — original minimal styled-slot spread (unchanged) ─────────────
  // Used by FullPreview's photo path and as the graceful fallback when no real
  // sidecar resolves for the slug. Resolve active frame — default frames[0].
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

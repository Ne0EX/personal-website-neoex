/**
 * components/console/ImagePickerPanel.tsx — Article body image picker (model B)
 * ─────────────────────────────────────────────────────────────────────────────
 * 'use client' — mounts as a slide-up panel inside ArticleSourcePane.
 *
 * Model B: REUSE an already-uploaded photo from the owner's library.
 * No re-upload (that is model A / ingestPhoto — already covered by the photo editor).
 * One stored object, referenced from multiple article bodies. No new storage objects.
 *
 * Insert format: `![caption](mediumUrl)`
 *   - mediumUrl is the public CDN variant URL (lib/store/media.ts publicVariantUrl).
 *   - Standard markdown image syntax; @mdx-js/mdx renders it as <img> on the public page.
 *   - The console ArticlePreview shows a placeholder slot (wlc-img-slot) — intentional.
 *   - Cursor-aware: inserts at the textarea's current selectionStart, collapses selection.
 *
 * Design idiom: console paper-observatory instrument.
 *   - No new visual language — extends the existing console token set.
 *   - Modeled after PlaceHighlightEditor.tsx (panel pattern + photo grid).
 *   - Dashed hairlines · mono uppercase labels · no SaaS chrome.
 *   - prefers-reduced-motion: transition-duration 0.001ms (no instant-off; avoids
 *     invisible-state glitch; mirrors ed-kindtab pattern).
 *
 * Owner: Sirius (α-SUR-01) · image-picker model-B
 */

/* eslint-disable @next/next/no-img-element --
   Console-only authoring surface. Photo thumbnail paths are dynamic CDN URLs
   from publicVariantUrl — not static imports. next/image requires known
   dimensions; these thumbnails are owner-only and not public-facing. */
'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { PhotoPickerItem } from '@/lib/store/admin-reads'

// ─────────────────────────────────────────────────────────────────────────────
// CSS — scoped to .ip-* prefix; no globals collision
// ─────────────────────────────────────────────────────────────────────────────

const PICKER_CSS = `
/* ── Panel shell ──────────────────────────────────────────────────── */
.ip-panel {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: var(--paper-warm);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  /* Slide up from below the source pane */
  transform: translateY(100%);
  transition: transform 200ms ease;
}
.ip-panel.is-open {
  transform: translateY(0);
}
@media (prefers-reduced-motion: reduce) {
  .ip-panel { transition-duration: 0.001ms; }
}

/* ── Head ─────────────────────────────────────────────────────────── */
.ip-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px dashed var(--ink-dashed);
}
.ip-title {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--ink-faint);
}
.ip-close {
  appearance: none;
  background: transparent;
  border: 1px dashed var(--ink-dashed);
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-soft);
  padding: 5px 10px;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 120ms ease, color 120ms ease;
}
.ip-close:hover,
.ip-close:focus-visible {
  border-color: var(--accent-orange);
  color: var(--ink-primary);
  outline: none;
}
.ip-close:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .ip-close { transition-duration: 0.001ms; }
}

/* ── Grid ─────────────────────────────────────────────────────────── */
.ip-grid {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 8px;
  align-content: start;
}

/* ── Empty state ──────────────────────────────────────────────────── */
.ip-empty {
  grid-column: 1 / -1;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-faint);
  font-style: italic;
  padding: 16px 0;
}

/* ── Photo card ───────────────────────────────────────────────────── */
.ip-card {
  appearance: none;
  background: transparent;
  border: 1px dashed var(--ink-dashed);
  cursor: pointer;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
  transition: border-color 120ms ease;
}
.ip-card:hover,
.ip-card:focus-visible {
  border-color: var(--accent-orange);
  outline: none;
}
.ip-card:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .ip-card { transition-duration: 0.001ms; }
}

/* ── Thumbnail area ───────────────────────────────────────────────── */
.ip-thumb {
  width: 100%;
  aspect-ratio: 3 / 2;
  background: var(--paper-base);
  border: 1px dashed var(--ink-hairline);
  display: grid;
  place-items: center;
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  color: var(--ink-faint);
  text-transform: uppercase;
}
.ip-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* ── Card label ───────────────────────────────────────────────────── */
.ip-card-label {
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 2px;
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface ImagePickerPanelProps {
  open: boolean
  photos: PhotoPickerItem[]
  /**
   * Called when a photo is selected.
   * Receives the markdown image string to insert at the cursor:
   *   `![caption](mediumUrl)`
   * The caller (ArticleSourcePane) splices this into the textarea value
   * at the recorded cursor position.
   */
  onSelect: (mdSnippet: string) => void
  onClose: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// ImagePickerPanel
// ─────────────────────────────────────────────────────────────────────────────

export function ImagePickerPanel({ open, photos, onSelect, onClose }: ImagePickerPanelProps) {
  // Close on ESC (mirrors PlaceHighlightEditor + ImportZone ESC pattern)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Focus the close button when the panel opens (a11y: trap focus awareness)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (open) {
      // Defer one frame so the CSS transition has begun before focus
      requestAnimationFrame(() => closeRef.current?.focus())
    }
  }, [open])

  const handleSelect = useCallback((photo: PhotoPickerItem) => {
    // Prefer the medium variant URL for body images (good quality, reasonable size).
    // Falls back to thumbUrl when medium is absent (rare — both run together).
    const imgUrl = photo.mediumUrl ?? photo.thumbUrl ?? ''
    // Alt text: caption when available, otherwise "slug photo"
    const alt = photo.caption ?? photo.slug
    // Standard markdown image syntax — @mdx-js/mdx renders as <img>
    const mdSnippet = `![${alt}](${imgUrl})`
    onSelect(mdSnippet)
    onClose()
  }, [onSelect, onClose])

  return (
    <>
      <style>{PICKER_CSS}</style>
      <div
        className={'ip-panel' + (open ? ' is-open' : '')}
        role="dialog"
        aria-modal="true"
        aria-label="Insert image from library"
        aria-hidden={!open}
      >
        {/* Head */}
        <div className="ip-head">
          <span className="ip-title">{'// INSERT IMAGE · LIBRARY'}</span>
          <button
            ref={closeRef}
            type="button"
            className="ip-close"
            onClick={onClose}
            aria-label="Close image picker (Esc)"
          >
            ESC · CLOSE
          </button>
        </div>

        {/* Grid */}
        <div className="ip-grid" role="list" aria-label="Photo library">
          {photos.length === 0 ? (
            <div className="ip-empty">no photos in library yet</div>
          ) : (
            photos.map((photo) => (
              <button
                key={photo.slug}
                type="button"
                role="listitem"
                className="ip-card"
                onClick={() => handleSelect(photo)}
                title={photo.caption ?? photo.slug}
                aria-label={`Insert photo ${photo.slug}${photo.caption ? `: ${photo.caption}` : ''}`}
              >
                {/* Thumbnail */}
                <div className="ip-thumb">
                  {photo.thumbUrl ? (
                    <img
                      src={photo.thumbUrl}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                    />
                  ) : (
                    /* Degraded placeholder — pipeline not run yet */
                    <span aria-hidden="true">◎</span>
                  )}
                </div>
                {/* Label — photo_id (most distinctive at a glance) */}
                <span className="ip-card-label">{photo.photoId}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  )
}

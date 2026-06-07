/**
 * components/console/FullPreview.tsx — Atlas Console · ◻ FULL PREVIEW overlay
 * ─────────────────────────────────────────────────────────────────────────────
 * 'use client' — focus-trap + ESC key + device-toggle state are interactive.
 *
 * Total-immersion preview of an entry as it would read on the public site, in a
 * switchable desktop / 390px viewport. NOT a SaaS modal — an instrument
 * observation window: paper-deep wash backdrop (NOT dark glass), paper-base
 * frame, corner reticles, no border-radius, no drop-shadow.
 *
 * Build-contract: docs/design/atlas-console-full-editor.md
 *   §5 "◻ FULL PREVIEW overlay — FullPreview" + cross-kind FULL PREVIEW.
 *   Soul drift-correction (table row 1): prototype `.pub-overlay`
 *   `rgba(22,30,34,0.55)` dark-glass scrim is FORBIDDEN → paper-deep / 0.85 wash.
 *
 * Per kind:
 *   article → reuses <ArticlePreview> (which wraps ArticleEntryContent +
 *             Blocks(parseMarkdown(md)) byte-identically; established wiring,
 *             imported read-only, NOT edited). ArticleMeta is mapped to the
 *             Article (velite) shape with safe defaults for velite-only fields.
 *   photo   → <PhotoPreview>   (built in parallel; imported by path)
 *   fiction → <FictionPreview> (built in parallel; imported by path)
 *
 * Mock-data note: PHOTO + FICTION schema fields (EXIF / chapters / film-sim)
 * are UNCONFIRMED (Procyon SCHEMA-NEEDS). FullPreview only forwards the props
 * it is given; it does NOT wire photo/fiction to the velite content layer.
 *
 * Owner: Sirius (α-SUR-01) · atlas-console full editor
 */

'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Article } from '@/lib/content/types'
import type {
  EntryKind,
  PreviewDevice,
  ArticleMeta,
  PhotoMeta,
  FictionMeta,
  PhotoFrame,
  FictionChapter,
} from '@/components/console/editor-types'
import { ArticlePreview } from '@/components/console/ArticlePreview'
// PhotoPreview / FictionPreview are authored in parallel (same prop contracts
// as §2 / §4 of the build-contract). Imported by path — do not inline-mock.
import { PhotoPreview } from '@/components/console/PhotoPreview'
import { FictionPreview } from '@/components/console/FictionPreview'

// ─────────────────────────────────────────────────────────────────────────────
// Props — exact bind to build-contract §5 (component 5: FullPreview)
// ─────────────────────────────────────────────────────────────────────────────

interface FullPreviewProps {
  kind: EntryKind
  meta: ArticleMeta | PhotoMeta | FictionMeta
  /**
   * FIX 2 (Algol REVISE — Betelgeuse contract note a): optional full Article for
   * the article kind. When provided, FullPreview passes it directly to
   * ArticlePreview (byte-fidelity — same object the in-pane preview uses). When
   * absent, the articleMetaToArticle adapter is used as before (fallback for any
   * meta-only caller). Photo / fiction overlay paths unchanged.
   */
  article?: Article
  md?: string                   // article markdown body
  frames?: PhotoFrame[]         // photo frames
  chapters?: FictionChapter[]   // fiction chapters
  activeId?: string             // active frame.id or chapter.id
  status?: string               // entry-level status
  device: PreviewDevice
  setDevice: (d: PreviewDevice) => void
  onClose: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Kind glyph — mirrors KINDS in the contract's kind-switcher
// ─────────────────────────────────────────────────────────────────────────────

const KIND_GLYPH: Record<EntryKind, string> = {
  article: '◆',
  photo:   '◎',
  fiction: '△',
}

// ─────────────────────────────────────────────────────────────────────────────
// ArticleMeta → Article (velite) mapping for the article preview path.
//
// FullPreview carries the contract-shaped ArticleMeta (fileNum/title/date/
// coords/tags/status/readMin). ArticlePreview (and ArticleEntryContent beneath
// it) need the velite Article shape. We adapt with safe, schema-faithful
// defaults for velite-only fields — this does NOT mutate any persisted entry
// and keeps the public-page render byte-identical (the body comes from `md`,
// the summary placeholder is bypassed because ArticlePreview always passes a
// body node).
//
// SCHEMA NOTE: domain/summary/readingTime/kind are velite-required but not on
// ArticleMeta; faithful defaults are used (preview-only, no persistence).
// ─────────────────────────────────────────────────────────────────────────────

function articleMetaToArticle(meta: ArticleMeta): Article {
  // Normalize the ISO date string (ArticleMeta.date) to the velite display
  // format YYYY.MM.DD; fall back to the raw value if it is not ISO-shaped.
  const display = /^\d{4}-\d{2}-\d{2}$/.test(meta.date)
    ? meta.date.replace(/-/g, '.')
    : meta.date

  return {
    fileNum:      meta.fileNum,
    kind:         'article',
    title:        meta.title,
    date:         display,
    isoDate:      display.replace(/\./g, '-'),
    // velite-only fields — preview defaults (not persisted)
    domain:       'method',
    tags:         meta.tags && meta.tags.length > 0 ? meta.tags : ['draft'],
    status:       (meta.status as Article['status']) ?? 'ongoing',
    readingTime:  meta.readMin && meta.readMin > 0 ? meta.readMin : 1,
    summary:      meta.title,
    coords:       meta.coords ?? { lat: 0, lon: 0, place: '—' },
    shareLocation: Boolean(meta.coords),
    worldline_links: [],
    highlightForPlace: false, // FIELD-GAP: preview context has no place highlight
  } as Article
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoped component-local CSS (.fp-* prefix; no globals collision).
// Composes from tokens only — no edit to globals.css.
// Corner reticles modeled on worldline-atoms `.corner-marks` L-bracket atom
// (4 corners per contract; built locally since globals has no corner atom).
// ─────────────────────────────────────────────────────────────────────────────

const FULLPREVIEW_CSS = `
/* ── overlay backdrop — paper-deep WASH, NOT dark glass (drift-correction) ── */
.fp-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  /* SOUL: paper-deep / 0.85 wash. Prototype's rgba(22,30,34,0.55) dark-glass
     scrim is FORBIDDEN (contract drift-correction row 1). The wash shows in
     the 24px gutter around the inset .fp-frame and is the click-to-close
     backdrop. The wash FADES in (opacity only); the frame SCALES in. */
  background: rgb(var(--paper-deep-rgb) / 0.85);
  animation: fp-wash-in 250ms ease;
}
@keyframes fp-wash-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ── instrument frame — paper-base surface, no radius, no shadow ──────────────
   INSET inside the overlay so the paper-deep/0.85 wash shows as the surround
   (the #1 soul drift-correction must be VISIBLE) AND the overlay's backdrop
   (the 24px gutter) is clickable to close (target === currentTarget). The
   frame does NOT fill the overlay. */
.fp-frame {
  position: absolute;
  inset: 24px;
  display: flex;
  flex-direction: column;
  background: var(--paper-base);
  transform-origin: center;
  animation: fp-frame-in 250ms ease;
}
@keyframes fp-frame-in {
  from { transform: scale(0.97); }
  to   { transform: scale(1); }
}

/* ── corner reticles — 4 engineering-blueprint L-brackets ─────────────────── */
.fp-corner {
  position: absolute;
  width: 12px;
  height: 12px;
  border: 1px solid var(--accent-orange);
  pointer-events: none;
  z-index: 3;
}
.fp-corner.tl { top: 12px;    left: 12px;  border-right: none; border-bottom: none; }
.fp-corner.tr { top: 12px;    right: 12px; border-left: none;  border-bottom: none; }
.fp-corner.bl { bottom: 12px; left: 12px;  border-right: none; border-top: none; }
.fp-corner.br { bottom: 12px; right: 12px; border-left: none;  border-top: none; }

/* ── header strip — mono uppercase, dashed-bottom hairline ────────────────── */
.fp-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  height: var(--console-header-height);
  padding: 0 24px;
  border-bottom: 1px dashed var(--ink-dashed);
  background: var(--paper-base);
  z-index: 2;
}
.fp-title {
  flex: 1;
  min-width: 0;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--ink-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fp-title .fp-title-glyph {
  color: var(--accent-orange);
  margin: 0 2px;
}
.fp-title .fp-title-num {
  color: var(--ink-primary);
}

/* ── device toggle — .ed-srctoggle style (orange-filled active = correct for
   this atom class; this is a VIEW-MODE toggle, not a kind tab) ───────────── */
.fp-devtoggle {
  display: flex;
  border: 1px solid var(--ink-hairline);
  flex-shrink: 0;
}
.fp-devbtn {
  appearance: none;
  background: transparent;
  border: none;
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: 0.16em;
  color: var(--ink-soft);
  padding: 0 14px;
  height: 30px;
  cursor: pointer;
  text-transform: uppercase;
}
.fp-devbtn.is-on {
  background: var(--accent-orange);
  color: var(--paper-bright);
}
.fp-devbtn:hover:not(.is-on),
.fp-devbtn:focus-visible:not(.is-on) {
  color: var(--accent-orange);
  outline: none;
}
.fp-devbtn:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}

/* ── close — × glyph, mono ────────────────────────────────────────────────── */
.fp-close {
  appearance: none;
  background: none;
  border: none;
  font-family: var(--font-mono);
  font-size: 16px;
  line-height: 1;
  color: var(--ink-soft);
  cursor: pointer;
  flex-shrink: 0;
  padding: 6px 8px;
}
.fp-close:hover,
.fp-close:focus-visible {
  color: var(--accent-orange);
  outline: none;
}
.fp-close:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}

/* ── stage — scrollable inner area; header stays fixed above ──────────────── */
.fp-stage {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

/* ── viewport: desktop = full width with comfortable 48px margins ─────────── */
.fp-viewport {
  flex-shrink: 0;
  background: var(--paper-base);
}
.fp-viewport.desktop {
  width: 100%;
  max-width: none;
  padding: 0 48px;
  box-sizing: border-box;
}
/* ── viewport: 390px = centered device frame, dashed edge — NO phone chrome ── */
.fp-viewport.mobile {
  width: 390px;
  max-width: 100%;
  margin: 24px auto;
  border: 1px dashed var(--ink-dashed);
}

/* The kind preview fills the viewport; let it size to content (no inner clip). */
.fp-viewport .wlc-preview {
  height: auto !important;
  overflow: visible !important;
}

/* ── breakpoints ──────────────────────────────────────────────────────────── */
@media (max-width: 880px) {
  /* mobile device defaults to 390px view — already handled by caller default;
     desktop viewport tightens its margins. */
  .fp-viewport.desktop { padding: 0 16px; }
}
@media (max-width: 600px) {
  /* no device switcher; full screen; always 100% width (contract ≤600px) */
  .fp-devtoggle { display: none; }
  .fp-frame { inset: 0; }
  .fp-corner { display: none; }
  .fp-head { padding: 0 14px; }
  .fp-viewport.mobile,
  .fp-viewport.desktop {
    width: 100%;
    margin: 0;
    border: none;
    padding: 0 12px;
  }
}

/* ── reduced motion — no open/close animation (wash fade + frame scale) ────── */
@media (prefers-reduced-motion: reduce) {
  .fp-overlay,
  .fp-frame { animation: none; }
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Focusable-element query for the focus trap
// ─────────────────────────────────────────────────────────────────────────────

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

// ─────────────────────────────────────────────────────────────────────────────
// FullPreview
// ─────────────────────────────────────────────────────────────────────────────

export function FullPreview({
  kind,
  meta,
  article,
  md,
  frames,
  chapters,
  activeId,
  status,
  device,
  setDevice,
  onClose,
}: FullPreviewProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  // Remember the element focused before the dialog opened, to restore on close.
  const restoreRef = useRef<HTMLElement | null>(null)

  // ── ESC to close + focus trap (Tab cycles within the dialog) ──────────────
  useEffect(() => {
    restoreRef.current = (document.activeElement as HTMLElement) ?? null

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab') {
        const root = frameRef.current
        if (!root) return
        const nodes = Array.from(
          root.querySelectorAll<HTMLElement>(FOCUSABLE),
        ).filter(el => el.offsetParent !== null || el === document.activeElement)
        if (nodes.length === 0) {
          e.preventDefault()
          return
        }
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        const activeEl = document.activeElement as HTMLElement | null
        if (e.shiftKey) {
          if (activeEl === first || !root.contains(activeEl)) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (activeEl === last || !root.contains(activeEl)) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
    }
  }, [onClose])

  // ── Move focus into the dialog on open; restore on unmount ────────────────
  useEffect(() => {
    const root = frameRef.current
    if (root) {
      const firstFocusable = root.querySelector<HTMLElement>(FOCUSABLE)
      ;(firstFocusable ?? root).focus()
    }
    const restore = restoreRef.current
    return () => {
      restore?.focus?.()
    }
  }, [])

  // ── Per-kind inner preview ────────────────────────────────────────────────
  // narrow = the 390px device view (PhotoPreview accepts this; the article /
  // fiction previews adapt via the .fp-viewport.mobile width constraint).
  const narrow = device === 'mobile'

  let inner: ReactNode
  if (kind === 'article') {
    // FIX 2: use the caller-provided Article directly when available (byte-fidelity
    // — same Article the in-pane ArticlePreview receives, so the overlay render is
    // identical to the in-pane preview). Fall back to the adapter for meta-only
    // callers that don't pass the full Article.
    inner = (
      <ArticlePreview
        article={article ?? articleMetaToArticle(meta as ArticleMeta)}
        md={md ?? ''}
      />
    )
  } else if (kind === 'photo') {
    inner = (
      <PhotoPreview
        meta={meta as PhotoMeta}
        frames={frames ?? []}
        active={activeId ?? null}
        narrow={narrow}
      />
    )
  } else {
    inner = (
      <FictionPreview
        meta={meta as FictionMeta}
        chapters={chapters ?? []}
        activeId={activeId ?? null}
        status={status}
      />
    )
  }

  const glyph = KIND_GLYPH[kind]
  // Mock-aware: ArticleMeta uses `fileNum`; all three meta shapes carry it.
  const fileNum = meta.fileNum

  return (
    <>
      <style>{FULLPREVIEW_CSS}</style>

      {/* Backdrop — click closes (mousedown-on-backdrop only, so a drag that
          starts inside the frame and releases on the backdrop won't close). */}
      <div
        className="fp-overlay"
        onMouseDown={e => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        {/* Instrument frame — the dialog. Focus trapped within. */}
        <div
          ref={frameRef}
          className="fp-frame"
          role="dialog"
          aria-modal="true"
          aria-label="Entry preview"
          tabIndex={-1}
        >
          {/* corner reticles — 4 L-brackets */}
          <span className="fp-corner tl" aria-hidden />
          <span className="fp-corner tr" aria-hidden />
          <span className="fp-corner bl" aria-hidden />
          <span className="fp-corner br" aria-hidden />

          {/* header strip — PREVIEW · {kind} {glyph} · {fileNum} */}
          <div className="fp-head">
            <span className="fp-title">
              PREVIEW · {kind.toUpperCase()}{' '}
              <span className="fp-title-glyph" aria-hidden>
                {glyph}
              </span>{' '}
              · <span className="fp-title-num">{fileNum}</span>
            </span>

            {/* device toggle — DESKTOP / 390PX (view-mode; orange active OK) */}
            <div className="fp-devtoggle" role="group" aria-label="Preview device">
              <button
                type="button"
                className={'fp-devbtn' + (device === 'desktop' ? ' is-on' : '')}
                aria-pressed={device === 'desktop'}
                onClick={() => setDevice('desktop')}
              >
                DESKTOP
              </button>
              <button
                type="button"
                className={'fp-devbtn' + (device === 'mobile' ? ' is-on' : '')}
                aria-pressed={device === 'mobile'}
                onClick={() => setDevice('mobile')}
              >
                390PX
              </button>
            </div>

            {/* close — × glyph */}
            <button
              type="button"
              className="fp-close"
              onClick={onClose}
              aria-label="Close preview"
              title="Close preview (ESC)"
            >
              ×
            </button>
          </div>

          {/* stage — scrollable; header stays fixed. Clicking the empty stage
              surround (esp. around the centered 390px frame) also closes — the
              viewport stops propagation so clicks ON the preview don't close. */}
          <div
            className="fp-stage"
            onMouseDown={e => {
              if (e.target === e.currentTarget) onClose()
            }}
          >
            <div
              className={'fp-viewport ' + device}
              onMouseDown={e => e.stopPropagation()}
            >
              {inner}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default FullPreview

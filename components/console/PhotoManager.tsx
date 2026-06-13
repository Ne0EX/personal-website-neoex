/**
 * components/console/PhotoManager.tsx — Atlas Console Full Editor · PHOTO source pane
 * ─────────────────────────────────────────────────────────────────────────────
 * 'use client' — local prev/next selector state interaction (setActive) + add picker.
 *
 * Contract: docs/design/atlas-console-full-editor.md §"per-kind: PHOTO" + §"prop
 * contracts → 1. PhotoManager" (Betelgeuse · α-VIS-04 · signed 2026-06-07).
 *
 * The PHOTO source pane is an INSTRUMENT panel, not a lightbox. Three zones:
 *   1. Frame strip   — selected frame display (large, dashed border, corner reticles).
 *                      Label: FRAME {n} / {total} (mono uppercase) + in-pane prev/next.
 *   2. Film-sim row  — .fsim-chip pills (5 chips). SINGLE-SELECT (filmSim is singular
 *                      in editor-types.ts — NOT the prototype's films:string[] multi).
 *                      is-on = orange filled. .fsim-chip is its OWN atom, NOT .af-pill.
 *   3. Instrument block — editable EXIF overlay. Display = instrumentOverrides.<key>
 *                      ?? exif.<key>. LENS is the required field (manual/adapted lenses
 *                      have no EXIF). Overridden fields show a subtle orange-dot affordance
 *                      (orange left-border on the row, consistent with the .fr-item active
 *                      pattern). Clearing a field to empty removes the override and falls
 *                      back to EXIF. Save is lifted to EntryEditor (Cmd+S / SAVE button
 *                      on pane header) — matches the article body save pattern.
 *                      Label map: CAMERA→camera · LENS→lens · ISO→iso ·
 *                      f/→aperture · 1/→shutter · mm→focal.
 *
 * + ADD FRAME button — class .pm-addframe (dashed border, ink-faint, hover ink-primary).
 *   NB: contract cites `.ed-btn-ghost`, which does NOT yet exist as a shared atom
 *   (Slice 1 only shipped .ed-srctoggle / .ed-mode). To avoid N parallel agents each
 *   reconstructing a divergent GLOBAL `.ed-btn-ghost {…}` (these <style> blocks are
 *   NOT scoped), this component uses a LOCAL .pm-addframe with the same visual spec.
 *   Flagged to the integrator: needs one shared home before components are wired.
 *
 * SCOPE NOTE (flagged): the //FRAMES thumbnail strip + drag-to-reorder lives in the
 *   OUTLINE RAIL, not this source pane. This component does not duplicate it. It
 *   provides a minimal in-pane prev/next selector so the pane works standalone.
 *
 * Owner: Sirius (α-SUR-01) · atlas-console full editor
 * Instrument overrides wiring: lens-override task 2026-06-12 (Sirius slice).
 * Reference (NOT copied): editor-kinds.jsx PhotoManager@82 (films[] → singular here;
 *   div/span EXIF → <dl><dt><dd> per contract §accessibility).
 */

'use client'

import { Fragment, useMemo } from 'react'
import type { PhotoFrame, FilmSim } from './editor-types'
import type { InstrumentOverrides } from '@/lib/store/types'

// ─────────────────────────────────────────────────────────────────────────────
// Film simulation chips — canonical order (matches FilmSim union in editor-types.ts)
// ─────────────────────────────────────────────────────────────────────────────

const FILM_SIMS: FilmSim[] = [
  'provia',
  'classic chrome',
  'acros',
  'reala ace',
  'velvia',
]

// ─────────────────────────────────────────────────────────────────────────────
// Mock frames — elegant in-component placeholder data (NOT velite-wired).
// Realistic full EXIF; one filmSim each. Exported so the page-level editor and
// PhotoPreview can share a single mock source in this slice.
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_FRAMES: PhotoFrame[] = [
  {
    id: 'DSCF0001',
    src: '/_mock/dscf0001.jpg', // placeholder path — no real file; renders styled slot
    caption: 'the bridge before anyone crossed it',
    filmSim: 'classic chrome',
    exif: {
      camera: 'Fujifilm X-T5',
      lens: 'XF 35mm f/1.4',
      iso: 200,
      aperture: 'f/2.0',
      shutter: '1/500',
      focal: '35mm',
    },
  },
  {
    id: 'DSCF0002',
    src: '/_mock/dscf0002.jpg',
    caption: 'nebulae over the water',
    filmSim: 'velvia',
    exif: {
      camera: 'Fujifilm X-T5',
      lens: 'XF 35mm f/1.4',
      iso: 160,
      aperture: 'f/1.4',
      shutter: '1/2000',
      focal: '35mm',
    },
  },
  {
    id: 'DSCF0003',
    src: '/_mock/dscf0003.jpg',
    caption: 'a vending machine, still humming',
    filmSim: 'reala ace',
    exif: {
      camera: 'Fujifilm X-T5',
      lens: 'XF 23mm f/2',
      iso: 400,
      aperture: 'f/2.8',
      shutter: '1/250',
      focal: '23mm',
    },
  },
  {
    id: 'DSCF0004',
    src: '/_mock/dscf0004.jpg',
    caption: 'the city before it woke',
    filmSim: 'acros',
    exif: {
      camera: 'Leica M6',
      lens: 'Summicron 50mm',
      iso: 400,
      aperture: 'f/4',
      shutter: '1/125',
      focal: '50mm',
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// EXIF row order + label map (contract §typography / §per-kind:PHOTO)
//   key  → DL label
//   f/   → aperture · 1/ → shutter · mm → focal
// ─────────────────────────────────────────────────────────────────────────────

type ExifKey = 'camera' | 'lens' | 'iso' | 'aperture' | 'shutter' | 'focal'

const EXIF_ROWS: { key: ExifKey; label: string }[] = [
  { key: 'camera',   label: 'CAMERA' },
  { key: 'lens',     label: 'LENS' },
  { key: 'iso',      label: 'ISO' },
  { key: 'aperture', label: 'f/' },
  { key: 'shutter',  label: '1/' },
  { key: 'focal',    label: 'mm' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Scoped component CSS. NB: <style> blocks are NOT scoped — all selectors below
// are prefixed (.pm-* / .fsim-chip) so they cannot collide across components.
// .fsim-chip is single-consumer (PhotoManager only) → safe as a local global atom.
// All colors/fonts/tokens reference globals.css variables (no hard-coded palette).
// ─────────────────────────────────────────────────────────────────────────────

const PHOTO_MGR_CSS = `
/* ── pane shell ────────────────────────────────────────────────────── */
.pm {
  display: flex;
  flex-direction: column;
  border-right: 1px dashed var(--ink-dashed);
  min-height: 0;
  background: var(--paper-base);
  font-family: var(--font-mono);
  overflow-y: auto;
}
.pm-head {
  flex-shrink: 0;
  font-size: 9px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--ink-faint);
  padding: 11px 14px 8px;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.pm-count { color: var(--ink-faint); }

.pm-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 0 16px 20px;
  min-height: 0;
}

/* ── zone 1 · frame strip (selected frame display) ─────────────────── */
.pm-frame-wrap {
  position: relative;
  border: 1px dashed var(--ink-dashed);
  background: var(--paper-warm);
  aspect-ratio: 3 / 2;
  display: grid;
  place-items: center;
  min-height: 0;
}
/* corner reticles — orange L-brackets (atom corner-reticle, local placement) */
.pm-frame-wrap::before,
.pm-frame-wrap::after {
  content: '';
  position: absolute;
  width: 12px;
  height: 12px;
  border: 1px solid var(--accent-orange);
  pointer-events: none;
}
.pm-frame-wrap::before { top: 6px; left: 6px; border-right: none; border-bottom: none; }
.pm-frame-wrap::after  { bottom: 6px; right: 6px; border-left: none; border-top: none; }

/* placeholder slot — no real image file exists; styled box keyed by frame id */
.pm-frame-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--ink-faint);
  text-align: center;
  padding: 24px;
}
.pm-frame-slot-glyph {
  font-size: 22px;
  color: var(--ink-soft);
  line-height: 1;
}
.pm-frame-slot-id {
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
.pm-frame-slot-note {
  font-size: 9px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--ink-faint);
}
.pm-frame-sim-tag {
  position: absolute;
  top: 10px;
  right: 14px;
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent-orange);
  pointer-events: none;
}

/* selector row — FRAME n / total + prev/next (in-pane standalone control) */
.pm-frame-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.pm-frame-label {
  font-size: 9px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
.pm-frame-label b { color: var(--ink-primary); font-weight: 500; }
.pm-frame-nav { display: flex; gap: 6px; }
.pm-navbtn {
  appearance: none;
  background: transparent;
  border: 1px solid var(--ink-hairline);
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1;
  color: var(--ink-soft);
  width: 30px;
  height: 30px;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.pm-navbtn:hover:not(:disabled),
.pm-navbtn:focus-visible:not(:disabled) {
  border-color: var(--accent-orange);
  color: var(--accent-orange);
  outline: none;
}
.pm-navbtn:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}
.pm-navbtn:disabled { opacity: 0.35; cursor: default; }

.pm-caption {
  font-family: var(--font-display);
  font-style: italic;
  font-size: 13px;
  line-height: 1.4;
  color: var(--ink-soft);
}

/* ── zone 2 · film-sim selector (.fsim-chip atom — single-select) ───── */
.pm-sect-label {
  font-size: 9px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--ink-faint);
  margin-bottom: 8px;
}
.pm-simrow { display: flex; flex-wrap: wrap; gap: 6px; }
/* .fsim-chip — its OWN atom (NOT .af-pill). is-on = orange filled. */
.fsim-chip {
  appearance: none;
  cursor: pointer;
  font-family: var(--font-mono);
  text-transform: uppercase;
  font-size: 9px;
  letter-spacing: 0.18em;
  padding: 7px 10px;
  background: transparent;
  border: 1px solid var(--ink-hairline);
  color: var(--ink-soft);
  transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
}
.fsim-chip:hover:not(.is-on),
.fsim-chip:focus-visible:not(.is-on) {
  border-color: var(--accent-orange);
  color: var(--accent-orange);
  outline: none;
}
.fsim-chip.is-on {
  background: var(--accent-orange);
  border-color: var(--accent-orange);
  color: var(--paper-bright);
}
.fsim-chip:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}
.fsim-chip:disabled { cursor: default; opacity: 0.7; }

/* ── zone 3 · instrument block (editable EXIF overlay) ─────────────── */
/* Outer section header + save status */
.pm-instr-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
}
.pm-instr-save {
  appearance: none;
  background: transparent;
  border: none;
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  padding: 0;
  cursor: pointer;
  /* default: ink-faint; transitions set per save-status via inline style in JSX */
}
.pm-instr-save:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}

/* Grid: label col (max-content) · input col (1fr). Border separates from film-sim. */
.pm-exif {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 14px;
  margin: 0;
  border-top: 1px dashed var(--ink-dashed);
  padding-top: 14px;
}
/* Label */
.pm-exif dt {
  font-size: 9px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--ink-faint);
  align-self: center;
  padding: 4px 0;
}
/* B3 fix (qa-fix-wave3): .is-required and its asterisk removed — LENS can be
   cleared to fall back to EXIF. The rule is kept inert here in case the class
   is reused by a future genuinely-required field. */
.pm-exif dt.is-required::after {
  content: '';
}
/* dd row: flex container for input + override-dot affordance */
.pm-exif dd {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
/* The editable input — transparent, mono, full-width.
   Override indicator: left-border orange (2px) when an override is active.
   Mirrors .fr-item.is-on pattern from the FRAMES rail (orange left-border). */
.pm-exif-input {
  flex: 1;
  min-width: 0;
  appearance: none;
  background: transparent;
  border: 1px dashed var(--ink-hairline);
  border-left-width: 2px;
  border-left-color: transparent;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.05em;
  color: var(--ink-primary);
  padding: 4px 8px;
  transition: border-color 100ms ease, background 100ms ease;
}
/* Override active: orange left-border (authored value overrides sensor truth).
   Consistent with .fr-item.is-on and .ch-item.is-on — orange = active selection. */
.pm-exif-input.is-overridden {
  border-left-color: var(--accent-orange);
  background: rgb(var(--accent-orange-rgb) / 0.04);
}
/* Placeholder — EXIF sensor value shown as placeholder (never editable by that path) */
.pm-exif-input::placeholder {
  color: var(--ink-faint);
  font-style: italic;
}
.pm-exif-input:focus {
  outline: none;
  border-color: var(--ink-dashed);
  border-left-color: var(--accent-orange);
  background: rgb(var(--accent-orange-rgb) / 0.02);
}
.pm-exif-input:focus.is-overridden {
  background: rgb(var(--accent-orange-rgb) / 0.06);
}

@media (prefers-reduced-motion: reduce) {
  .pm-exif-input { transition: none; }
}

/* ── + ADD FRAME (.pm-addframe — local; contract's .ed-btn-ghost N/A yet) ── */
.pm-addframe {
  appearance: none;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--ink-faint);
  background: transparent;
  border: 1px dashed var(--ink-dashed);
  padding: 12px;
  text-align: center;
  transition: border-color 120ms ease, color 120ms ease;
}
.pm-addframe:hover,
.pm-addframe:focus-visible {
  border-color: var(--accent-orange);
  color: var(--ink-primary);
  outline: none;
}
.pm-addframe:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .fsim-chip,
  .pm-addframe,
  .pm-navbtn { transition: none; }
}

/* Touch targets ≥ 44px on coarse pointers (contract §breakpoints a11y line). */
@media (pointer: coarse) {
  .pm-navbtn { width: 44px; height: 44px; }
  .fsim-chip { padding: 12px 14px; }
  .pm-addframe { padding: 16px; }
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Props — bound EXACTLY to contract §"prop contracts → 1. PhotoManager"
// ─────────────────────────────────────────────────────────────────────────────

export interface PhotoManagerProps {
  frames: PhotoFrame[]
  setFrames: (frames: PhotoFrame[]) => void
  active: string | null // frame.id of selected frame
  setActive: (id: string) => void
  onAdd: () => void // triggers file picker (caller owns the input ref)
  reading: boolean // true = read-only (no add/reorder/delete)
  // ── Instrument overrides (lens-override wiring, 2026-06-12) ──────────────
  /**
   * Current authored overrides for the active photo entry.
   * Display value = override ?? exif (already merged by map.ts in `frame.exif`,
   * but we need the raw overrides separately so we can show the affordance
   * and not lose the EXIF fallback value).
   * Undefined when no overrides are set (all fields fall back to EXIF).
   */
  instrumentOverrides?: InstrumentOverrides | null
  /**
   * Called whenever the user edits an instrument field. The caller (EntryEditor)
   * owns the save action (updateEntry + Cmd+S) — this component only reports
   * the delta. A null value clears all overrides (falls back to EXIF entirely).
   */
  onInstrumentOverridesChange?: (overrides: InstrumentOverrides | null) => void
  /** Save status from EntryEditor's updateEntry call — drives the SAVE label. */
  instrumentSaveStatus?: 'idle' | 'saving' | 'saved' | 'error'
  /**
   * Called when the user clicks the instrument SAVE button or the entry has
   * a real slug to save against. If absent, the save affordance is hidden
   * (sample / no-entry path).
   */
  onInstrumentSave?: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// PhotoManager
// ─────────────────────────────────────────────────────────────────────────────

export function PhotoManager({
  frames,
  setFrames,
  active,
  setActive,
  onAdd,
  reading,
  instrumentOverrides,
  onInstrumentOverridesChange,
  instrumentSaveStatus,
  onInstrumentSave,
}: PhotoManagerProps) {
  // Resolve active index — default to frames[0] when active is missing
  // (contract state: "active frame missing: default to frames[0]").
  const idx = useMemo(() => {
    const i = frames.findIndex((f) => f.id === active)
    return i >= 0 ? i : 0
  }, [frames, active])

  const frame = frames[idx]
  const total = frames.length

  // Empty state — source pane shows ImportZone (separate component, owned elsewhere).
  // PhotoManager renders nothing for the empty case; the page-level editor swaps in
  // ImportZone when frames.length === 0. Guard here so the pane is robust standalone.
  if (total === 0 || !frame) {
    return (
      <>
        <style>{PHOTO_MGR_CSS}</style>
        <div className="pm" aria-label="Photo frames editor">
          <div className="pm-head">
            <span>FRAMES · OPTICAL TRACE</span>
            <span className="pm-count">00</span>
          </div>
          <div className="pm-body">
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: '13px',
                color: 'var(--ink-soft)',
              }}
            >
              no frames yet — import an image to begin the roll.
            </p>
            {!reading && (
              <button type="button" className="pm-addframe" onClick={onAdd}>
                + ADD FRAME
              </button>
            )}
          </div>
        </div>
      </>
    )
  }

  // Single-select film sim (filmSim is singular in editor-types.ts).
  const setSim = (sim: FilmSim) => {
    if (reading) return
    setFrames(
      frames.map((f) =>
        f.id === frame.id
          ? { ...f, filmSim: f.filmSim === sim ? undefined : sim }
          : f,
      ),
    )
  }

  const go = (next: number) => {
    const target = frames[next]
    if (target) setActive(target.id)
  }

  const exif = frame.exif ?? {}

  return (
    <>
      <style>{PHOTO_MGR_CSS}</style>

      <div className="pm" aria-label="Photo frames editor">
        <div className="pm-head">
          <span>FRAMES · OPTICAL TRACE</span>
          <span className="pm-count">{String(total).padStart(2, '0')}</span>
        </div>

        <div className="pm-body">
          {/* ── zone 1 · frame strip (selected frame, dashed border, reticles) ── */}
          <div className="pm-frame-wrap">
            {/* film-sim overlay tag (decorative; mirrors PhotoPreview) */}
            {frame.filmSim && (
              <span className="pm-frame-sim-tag" aria-hidden>
                {frame.filmSim.toUpperCase()}
              </span>
            )}
            {/* placeholder slot — no real image file in /public; keyed by frame id */}
            <div className="pm-frame-slot" aria-hidden>
              <span className="pm-frame-slot-glyph">◎</span>
              <span className="pm-frame-slot-id">{frame.id}</span>
              <span className="pm-frame-slot-note">image preview pending</span>
            </div>
          </div>

          {/* selector bar — FRAME n / total + prev/next */}
          <div className="pm-frame-bar">
            <span className="pm-frame-label">
              FRAME <b>{String(idx + 1).padStart(2, '0')}</b> /{' '}
              {String(total).padStart(2, '0')}
            </span>
            <div className="pm-frame-nav">
              <button
                type="button"
                className="pm-navbtn"
                onClick={() => go(idx - 1)}
                disabled={idx === 0}
                aria-label="previous frame"
              >
                ‹
              </button>
              <button
                type="button"
                className="pm-navbtn"
                onClick={() => go(idx + 1)}
                disabled={idx === total - 1}
                aria-label="next frame"
              >
                ›
              </button>
            </div>
          </div>

          {frame.caption && <p className="pm-caption">{frame.caption}</p>}

          {/* ── zone 2 · film-sim selector (.fsim-chip — single-select) ── */}
          <div>
            <div className="pm-sect-label">FILM SIM</div>
            <div className="pm-simrow" role="group" aria-label="Film simulation">
              {FILM_SIMS.map((s) => {
                const on = frame.filmSim === s
                return (
                  <button
                    key={s}
                    type="button"
                    className={'fsim-chip' + (on ? ' is-on' : '')}
                    aria-pressed={on}
                    disabled={reading}
                    onClick={() => setSim(s)}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── zone 3 · instrument block (editable EXIF overlay) ──
              Display value = instrumentOverrides.<key> ?? exif.<key>.
              LENS is the required field (manual/adapted lenses have no EXIF).
              Overridden field: orange left-border on the input (is-overridden).
              Clearing a field to empty removes the override (falls back to EXIF).
              Save is deferred to EntryEditor (Cmd+S or SAVE button here) —
              matches the article body save pattern (mirrors ArticleSourcePane). */}
          <div>
            <div className="pm-instr-head">
              <span className="pm-sect-label" style={{ marginBottom: 0 }}>INSTRUMENT</span>
              {/* SAVE affordance — only rendered when a real entry is loaded.
                  Mirrors the SAVE button in ArticleSourcePane. */}
              {onInstrumentSave && (
                <button
                  type="button"
                  className="pm-instr-save"
                  onClick={onInstrumentSave}
                  disabled={instrumentSaveStatus === 'saving'}
                  style={{
                    color: instrumentSaveStatus === 'error' ? 'var(--accent-orange)'
                      : instrumentSaveStatus === 'saved' ? 'var(--ink-primary)'
                      : 'var(--ink-faint)',
                    cursor: instrumentSaveStatus === 'saving' ? 'not-allowed' : 'pointer',
                  }}
                  aria-label="save instrument overrides"
                  title="CMD+S to save"
                >
                  {instrumentSaveStatus === 'saving' ? 'SAVING…'
                    : instrumentSaveStatus === 'saved' ? 'SAVED'
                    : instrumentSaveStatus === 'error' ? 'SAVE ERR'
                    : '⇡ SAVE'}
                </button>
              )}
            </div>
            <dl className="pm-exif" aria-label="Instrument fields">
              {EXIF_ROWS.map(({ key, label }) => {
                // The active override value for this key (if any)
                const overrideVal: string | number | undefined =
                  instrumentOverrides?.[key as keyof InstrumentOverrides]

                // The EXIF sensor value (raw from frame.exif — may be absent)
                const exifVal = exif[key]

                // isOverridden: an explicit authored value has been set for this key
                const isOverridden = overrideVal !== undefined && overrideVal !== ''

                // Input shows the override value when set; otherwise empty
                // (EXIF shown as placeholder so it's visible but not confused with an override)
                const inputValue = isOverridden ? String(overrideVal) : ''

                // Placeholder: EXIF sensor value (shows what falls back to when no override)
                const placeholder = exifVal !== undefined && exifVal !== ''
                  ? String(exifVal)
                  : '—'

                return (
                  <Fragment key={key}>
                    {/* B3 fix (qa-fix-wave3): is-required class and aria-required
                        removed from LENS. Clearing the field to empty is a valid
                        action — it removes instrument_overrides.lens and falls back
                        to the EXIF value. The required indicator was misleading users
                        into believing LENS could not be cleared. The clear path
                        (empty string → delete key → null patch) was already correct
                        in onChange; only the UI affordance was wrong. */}
                    <dt>{label}</dt>
                    <dd>
                      <input
                        type="text"
                        className={'pm-exif-input' + (isOverridden ? ' is-overridden' : '')}
                        value={inputValue}
                        placeholder={placeholder}
                        aria-label={`Override ${label}`}
                        disabled={reading}
                        onChange={(e) => {
                          if (!onInstrumentOverridesChange) return
                          const raw = e.target.value
                          // Build the new overrides object. Empty string → remove key.
                          const next: InstrumentOverrides = {
                            ...(instrumentOverrides ?? {}),
                          }
                          if (raw === '') {
                            // Clear this key — fall back to EXIF
                            delete next[key as keyof InstrumentOverrides]
                          } else {
                            // Numeric keys: iso, aperture, focal — store as numbers.
                            // Peat authorization: iso/aperture/focal are z.number() in schema.
                            if (key === 'iso' || key === 'aperture' || key === 'focal') {
                              const n = parseFloat(raw)
                              if (!Number.isNaN(n)) {
                                // TypeScript: cast required because TS doesn't narrow on key
                                ;(next as Record<string, unknown>)[key] = n
                              } else {
                                // Non-numeric input for a numeric field — keep as string
                                // so the user can type mid-number (e.g. "2."); we'll
                                // validate at save time. Store temporarily as the raw string.
                                // The schema's z.number() will reject non-numeric values —
                                // the save will return INVALID_INPUT which we surface.
                                ;(next as Record<string, unknown>)[key] = raw
                              }
                            } else {
                              // String keys: lens, camera, shutter
                              ;(next as Record<string, unknown>)[key] = raw
                            }
                          }
                          // If all keys removed → send null (clear entire overrides column)
                          const hasAnyKey = Object.values(next).some((v) => v !== undefined)
                          onInstrumentOverridesChange(hasAnyKey ? next : null)
                        }}
                      />
                    </dd>
                  </Fragment>
                )
              })}
            </dl>
          </div>

          {/* ── + ADD FRAME (hidden in reading mode) ── */}
          {!reading && (
            <button type="button" className="pm-addframe" onClick={onAdd}>
              + ADD FRAME
            </button>
          )}
        </div>
      </div>
    </>
  )
}

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

import { Fragment, useMemo, useState } from 'react'
import type { PhotoFrame, FilmSim } from './editor-types'
import type { InstrumentOverrides, Place } from '@/lib/store/types'

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

/* ── zone 4 · coord / place block (photo-meta-harness, sirius slice) ───────
   Shares the .pm-exif grid layout (label col + input col) and .pm-exif-input
   override idiom (orange left-border = is-overridden, per instrument precedent).
   Separated from zone 3 by a dashed top border — same separator as zone 3. */
.pm-coord {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 14px;
  margin: 0;
  border-top: 1px dashed var(--ink-dashed);
  padding-top: 14px;
}
.pm-coord dt {
  font-size: 9px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--ink-faint);
  align-self: center;
  padding: 4px 0;
}
.pm-coord dd { margin: 0; display: flex; align-items: center; gap: 6px; }

/* Place dropdown — same instrument idiom as .rp-select in EntryEditor */
.pm-place-select {
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
  cursor: pointer;
  transition: border-color 100ms ease;
}
.pm-place-select.is-overridden {
  border-left-color: var(--accent-orange);
  background: rgb(var(--accent-orange-rgb) / 0.04);
}
.pm-place-select:focus {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
  border-left-color: var(--accent-orange);
}
.pm-place-select:disabled { cursor: default; opacity: 0.6; }
/* photo-meta SAVE status label — same style as .pm-instr-save */
.pm-meta-save {
  appearance: none;
  background: transparent;
  border: none;
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  padding: 0;
  cursor: pointer;
}
.pm-meta-save:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .pm-place-select { transition: none; }
}
@media (pointer: coarse) {
  .pm-place-select { padding: 10px 12px; }
}

/* ── B2 · .pm-caption-input (spec #B §Change B2) ─────────────────────────────
   Caption textarea — Zone 0 (first editable field). VOICE register: Cormorant
   Garamond italic 13px. Transparent background, dashed bottom border only
   (no full box). Same transparent-with-dashed-border idiom as .src-text in
   the article editor. resize:none. 2 rows. */
.pm-caption-input {
  width: 100%;
  min-height: 0;
  resize: none;
  border: none;
  border-bottom: 1px dashed var(--ink-dashed);
  outline: none;
  background: transparent;
  font-family: var(--font-display);
  font-style: italic;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ink-primary);
  padding: 4px 0 6px;
  transition: border-color 100ms ease;
  box-sizing: border-box;
}
.pm-caption-input::placeholder {
  color: var(--ink-faint);
  font-style: italic;
}
.pm-caption-input:focus {
  border-bottom-color: var(--ink-soft);
  outline: none;
  background: rgb(var(--accent-orange-rgb) / 0.01);
}
.pm-caption-input:disabled {
  opacity: 0.7;
  cursor: default;
}
@media (pointer: coarse) {
  .pm-caption-input { font-size: 14px; }
}

/* ── B3/B4 · .pm-disc-toggle (spec #B §Change B3/B4) ────────────────────────
   Disclosure toggle for INSTRUMENT and COORD & PLACE sections.
   Inherits .pm-sect-label type style (t-mono 9px ink-faint uppercase).
   Appends ▸/▾ glyph. button appearance reset. */
.pm-disc-toggle {
  appearance: none;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--ink-faint);
  padding: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: color 100ms ease;
}
.pm-disc-toggle:hover,
.pm-disc-toggle:focus-visible {
  color: var(--ink-soft);
  outline: none;
}
.pm-disc-toggle:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}
/* expanded state: ink-soft (content is visible, toggle is more prominent) */
.pm-disc-toggle.is-open {
  color: var(--ink-soft);
}
@media (prefers-reduced-motion: reduce) {
  .pm-disc-toggle { transition: none; }
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
  // ── Photo meta: coords / place / filmSim (photo-meta-harness, sirius slice) ──
  /**
   * Raw authored coords from entries.coords — owner console only (DL13).
   * Null = no authored coord set. Undefined = not applicable / not loaded.
   */
  authoredCoords?: { lat: number; lon: number; place: string } | null
  /** Called when the user edits lat or lon. Caller owns the save action. */
  onAuthoredCoordsChange?: (coords: { lat: number; lon: number; place: string } | null) => void
  /** Currently assigned place_id from entries. Null = no place assigned. */
  authoredPlaceId?: string | null
  /** Called when the user selects a different place. Caller owns the save action. */
  onAuthoredPlaceIdChange?: (placeId: string | null) => void
  /** Full places list for the dropdown. Loaded by editor page for photo kind. */
  availablePlaces?: Place[]
  /** Save status for coords + place (shared SAVE button). Drives the label. */
  photoMetaSaveStatus?: 'idle' | 'saving' | 'saved' | 'error'
  /** Called when the user clicks the photo-meta SAVE button. */
  onPhotoMetaSave?: () => void
  /**
   * Authored filmSim override from entries.film_sim (raw, not merged).
   * Null = no authored override (display falls back to EXIF filmSim).
   */
  authoredFilmSim?: string | null
  /**
   * Called immediately when the user clicks a film-sim chip.
   * Saves entries.film_sim via updateEntry on click — no deferred SAVE button.
   */
  onFilmSimSave?: (sim: string | null) => void
  /** Save status for filmSim. Drives a small status label near the chip row. */
  filmSimSaveStatus?: 'idle' | 'saving' | 'saved' | 'error'

  // ── B2 · Caption (spec #B §Change B2) ────────────────────────────────────
  /**
   * Current caption value from entries (Zone 0 — first editable field).
   * Renders as a textarea above FILM SIM. Saves on blur via onCaptionSave.
   * Undefined on non-entry / sample path → caption zone is hidden.
   */
  caption?: string | null
  /**
   * Called on caption textarea blur with the current value.
   * Null = caption cleared. Caller (EntryEditor) persists via updateEntry.
   */
  onCaptionSave?: (value: string | null) => void
  /** Save status for caption. Drives status label next to CAPTION header. */
  captionSaveStatus?: 'idle' | 'saving' | 'saved' | 'error'
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
  authoredCoords,
  onAuthoredCoordsChange,
  authoredPlaceId,
  onAuthoredPlaceIdChange,
  availablePlaces = [],
  photoMetaSaveStatus,
  onPhotoMetaSave,
  authoredFilmSim,
  onFilmSimSave,
  filmSimSaveStatus,
  // B2: caption zone
  caption,
  onCaptionSave,
  captionSaveStatus,
}: PhotoManagerProps) {
  // B3: INSTRUMENT block disclosure (default collapsed — spec §Change B3)
  const [instrumentOpen, setInstrumentOpen] = useState<boolean>(false)
  // B4: COORD & PLACE disclosure (default collapsed — spec §Change B4)
  const [coordOpen, setCoordOpen] = useState<boolean>(false)
  // B2: local caption textarea state (controlled; syncs to prop on mount/change)
  const [captionLocal, setCaptionLocal] = useState<string>(caption ?? '')
  // Resolve active index — default to frames[0] when active is missing
  // (contract state: "active frame missing: default to frames[0]").
  const idx = useMemo(() => {
    const i = frames.findIndex((f) => f.id === active)
    return i >= 0 ? i : 0
  }, [frames, active])

  const frame = frames[idx]
  const total = frames.length

  // B5: detect whether frame.src is a real URL (not a mock path, not absent).
  // The real src comes from photo_assets.variants.thumb.webp (via initialPhoto
  // in EntryEditor's initialRealFrames useMemo). Mock paths start with '/_mock/'.
  const hasMediumSrc = !!(
    frames.length > 0 &&
    frame &&
    frame.src &&
    !frame.src.startsWith('/_mock/')
  )
  // Prefer the medium variant URL when available; fall back to frame.src (thumb)
  // frame.src was seeded from thumbSrc in EntryEditor's initialRealFrames
  const realImageSrc: string | null = hasMediumSrc ? frame?.src ?? null : null

  // Empty state — source pane shows ImportZone (separate component, owned elsewhere).
  // PhotoManager renders nothing for the empty case; the page-level editor swaps in
  // ImportZone when frames.length === 0. Guard here so the pane is robust standalone.
  if (total === 0 || !frame) {
    return (
      <>
        <style>{PHOTO_MGR_CSS}</style>
        <div className="pm" aria-label="Photo frames editor">
          <div className="pm-head">
            {/* B6: no entry loaded → keep generic label */}
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
  // Clicking a chip: toggle local frame state AND immediately save to DB via onFilmSimSave.
  // Active state: authoredFilmSim (DB value) takes precedence when prop is provided;
  // fallback to frame.filmSim (local frame state) for display when authoredFilmSim is
  // undefined (no-entry / sample path where onFilmSimSave is absent).
  const setSim = (sim: FilmSim) => {
    if (reading) return
    // Determine next value: deselect if same, select otherwise
    const isCurrentlyActive = authoredFilmSim !== undefined
      ? authoredFilmSim === sim
      : frame.filmSim === sim
    const next = isCurrentlyActive ? undefined : sim
    // Update local frame state (drives frame strip display)
    setFrames(
      frames.map((f) =>
        f.id === frame.id ? { ...f, filmSim: next } : f,
      ),
    )
    // Immediately persist to DB (photo-meta-harness: filmSim saves on click)
    if (onFilmSimSave) onFilmSimSave(next ?? null)
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
        {/* B6: contextual pane header — "EDIT PHOTO ENTRY" when a real entry is loaded
            (reading=false and frame is from a real entry, not mock data).
            "FRAMES · OPTICAL TRACE" is the right label for the multi-frame instrument
            context; "EDIT PHOTO ENTRY" is direct for the single-photo edit path. */}
        <div className="pm-head">
          <span>{onCaptionSave ? 'EDIT PHOTO ENTRY' : 'FRAMES · OPTICAL TRACE'}</span>
          <span className="pm-count">{String(total).padStart(2, '0')}</span>
        </div>

        <div className="pm-body">
          {/* ── zone 0 · caption (B2 — first editable field, before film sim) ──
              Only rendered when onCaptionSave is provided (real entry path).
              Save on blur. Textarea uses VOICE register (Cormorant italic 13px). */}
          {onCaptionSave && (
            <div>
              <div className="pm-instr-head">
                <span className="pm-sect-label" style={{ marginBottom: 0 }}>CAPTION</span>
                {/* Status label right of CAPTION header (matches .pm-instr-save pattern) */}
                {captionSaveStatus && captionSaveStatus !== 'idle' && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '8px',
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase' as const,
                      color: captionSaveStatus === 'error' ? 'var(--accent-orange)'
                        : captionSaveStatus === 'saved' ? 'var(--ink-primary)'
                        : 'var(--ink-faint)',
                    }}
                    aria-live="polite"
                  >
                    {captionSaveStatus === 'saving' ? 'SAVING…'
                      : captionSaveStatus === 'saved' ? 'SAVED'
                      : 'SAVE ERR'}
                  </span>
                )}
              </div>
              <textarea
                className="pm-caption-input"
                rows={2}
                value={captionLocal}
                disabled={reading}
                aria-label="Photo caption"
                autoComplete="off"
                placeholder="add a caption…"
                onChange={(e) => setCaptionLocal(e.target.value)}
                onBlur={() => {
                  const trimmed = captionLocal.trim()
                  onCaptionSave(trimmed === '' ? null : trimmed)
                }}
              />
            </div>
          )}

          {/* ── zone 1 · frame strip (selected frame, dashed border, reticles) ── */}
          <div className="pm-frame-wrap">
            {/* film-sim overlay tag (decorative; mirrors PhotoPreview) */}
            {frame.filmSim && (
              <span className="pm-frame-sim-tag" aria-hidden>
                {frame.filmSim.toUpperCase()}
              </span>
            )}
            {/* B5: show real image when frame.src is a real URL (not mock).
                Placeholder slot only when no real image is available.
                real image fills the frame with object-fit:cover; corner reticles
                (::before/::after) overlay the image as-is (positioned absolute). */}
            {realImageSrc ? (
              <img
                src={realImageSrc}
                alt={captionLocal.trim() || `Photo ${frame.id}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  border: '1px dashed var(--ink-dashed)',
                }}
              />
            ) : (
              /* placeholder slot — no real image file; keyed by frame id */
              <div className="pm-frame-slot" aria-hidden>
                <span className="pm-frame-slot-glyph">◎</span>
                <span className="pm-frame-slot-id">{frame.id}</span>
                <span className="pm-frame-slot-note">image preview pending</span>
              </div>
            )}
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

          {/* ── zone 2 · film-sim selector (.fsim-chip — single-select) ──
              Active state: authoredFilmSim (DB value from entries.film_sim) when prop
              is provided (real entry loaded); falls back to frame.filmSim (local) on
              the sample/no-entry path. Clicking saves immediately via onFilmSimSave. */}
          <div>
            <div className="pm-instr-head">
              <span className="pm-sect-label" style={{ marginBottom: 0 }}>FILM SIM</span>
              {/* filmSim status label — shown while saving/after save (no separate SAVE button) */}
              {onFilmSimSave && filmSimSaveStatus && filmSimSaveStatus !== 'idle' && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '8px',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase' as const,
                    color: filmSimSaveStatus === 'error' ? 'var(--accent-orange)'
                      : filmSimSaveStatus === 'saved' ? 'var(--ink-primary)'
                      : 'var(--ink-faint)',
                  }}
                  aria-live="polite"
                >
                  {filmSimSaveStatus === 'saving' ? 'SAVING…'
                    : filmSimSaveStatus === 'saved' ? 'SAVED'
                    : 'SAVE ERR'}
                </span>
              )}
            </div>
            <div className="pm-simrow" role="group" aria-label="Film simulation">
              {FILM_SIMS.map((s) => {
                // Use authoredFilmSim (DB truth) when available; fallback to frame.filmSim
                const on = authoredFilmSim !== undefined
                  ? authoredFilmSim === s
                  : frame.filmSim === s
                return (
                  <button
                    key={s}
                    type="button"
                    className={'fsim-chip' + (on ? ' is-on' : '')}
                    aria-pressed={on}
                    disabled={reading || filmSimSaveStatus === 'saving'}
                    onClick={() => setSim(s)}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── zone 3 · instrument block (editable EXIF overlay) ──
              B3: wrapped in disclosure toggle. Default collapsed.
              Collapsed state: "INSTRUMENT ▸" button. Expanded: "INSTRUMENT ▾" + full DL.
              Save button remains inside expanded state only. */}
          <div>
            <div className="pm-instr-head">
              {/* B3: disclosure toggle replaces static label */}
              <button
                type="button"
                className={'pm-disc-toggle' + (instrumentOpen ? ' is-open' : '')}
                aria-expanded={instrumentOpen}
                aria-controls="pm-instrument-body"
                aria-label="Toggle instrument fields"
                onClick={() => setInstrumentOpen((o) => !o)}
              >
                INSTRUMENT {instrumentOpen ? '▾' : '▸'}
              </button>
              {/* SAVE affordance — only rendered when expanded and a real entry is loaded */}
              {instrumentOpen && onInstrumentSave && (
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
            {/* Expanded content */}
            {instrumentOpen && (
            <dl id="pm-instrument-body" className="pm-exif" aria-label="Instrument fields">
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
            )}
          </div>

          {/* ── zone 4 · coord + place (photo-meta-harness, sirius slice) ──
              B4: wrapped in disclosure toggle. Default collapsed (same pattern as B3).
              Collapsed: "COORD & PLACE ▸". Expanded: full coord + place block.
              COORD: lat/lon text inputs. Raw authored coords from entries.coords (DL13
              owner-only field). EXIF GPS would be a placeholder when available but
              GPS is stripped during ingest (sharp .rotate() without .withMetadata()),
              so no placeholder source exists from EXIF — use "—" as default placeholder.
              PLACE: dropdown from availablePlaces. is-overridden orange left-border
              when a placeId is set. Shared SAVE button for coords + place (same
              deferral pattern as instrument overrides). */}
          <div>
            <div className="pm-instr-head">
              {/* B4: disclosure toggle for COORD & PLACE */}
              <button
                type="button"
                className={'pm-disc-toggle' + (coordOpen ? ' is-open' : '')}
                aria-expanded={coordOpen}
                aria-controls="pm-coord-body"
                aria-label="Toggle coordinates and place"
                onClick={() => setCoordOpen((o) => !o)}
              >
                COORD &amp; PLACE {coordOpen ? '▾' : '▸'}
              </button>
              {/* Shared SAVE button for coords + place — only when expanded */}
              {coordOpen && onPhotoMetaSave && (
                <button
                  type="button"
                  className="pm-meta-save"
                  onClick={onPhotoMetaSave}
                  disabled={photoMetaSaveStatus === 'saving'}
                  style={{
                    color: photoMetaSaveStatus === 'error' ? 'var(--accent-orange)'
                      : photoMetaSaveStatus === 'saved' ? 'var(--ink-primary)'
                      : 'var(--ink-faint)',
                    cursor: photoMetaSaveStatus === 'saving' ? 'not-allowed' : 'pointer',
                  }}
                  aria-label="save coord and place"
                  aria-live="polite"
                  title="Save authored coordinates and place assignment"
                >
                  {photoMetaSaveStatus === 'saving' ? 'SAVING…'
                    : photoMetaSaveStatus === 'saved' ? 'SAVED'
                    : photoMetaSaveStatus === 'error' ? 'SAVE ERR'
                    : '⇡ SAVE'}
                </button>
              )}
            </div>
            {/* Expanded content — coord + place inputs */}
            {coordOpen && (
            <>
            <dl id="pm-coord-body" className="pm-coord" aria-label="Authored coordinates">
              <dt>LAT</dt>
              <dd>
                <input
                  type="text"
                  className={'pm-exif-input' + (authoredCoords?.lat != null ? ' is-overridden' : '')}
                  value={authoredCoords?.lat ?? ''}
                  placeholder="—"
                  aria-label="Latitude"
                  disabled={reading}
                  onChange={(e) => {
                    if (!onAuthoredCoordsChange) return
                    const raw = e.target.value.trim()
                    if (raw === '') {
                      // Clear lat — if lon is also empty, clear entire coords
                      const hasLon = authoredCoords?.lon != null
                      onAuthoredCoordsChange(hasLon
                        ? { lat: 0, lon: authoredCoords!.lon, place: authoredCoords?.place ?? '' }
                        : null)
                    } else {
                      const n = parseFloat(raw)
                      if (!Number.isNaN(n)) {
                        onAuthoredCoordsChange({
                          lat: n,
                          lon: authoredCoords?.lon ?? 0,
                          place: authoredCoords?.place ?? '',
                        })
                      }
                    }
                  }}
                />
              </dd>
              <dt>LON</dt>
              <dd>
                <input
                  type="text"
                  className={'pm-exif-input' + (authoredCoords?.lon != null ? ' is-overridden' : '')}
                  value={authoredCoords?.lon ?? ''}
                  placeholder="—"
                  aria-label="Longitude"
                  disabled={reading}
                  onChange={(e) => {
                    if (!onAuthoredCoordsChange) return
                    const raw = e.target.value.trim()
                    if (raw === '') {
                      const hasLat = authoredCoords?.lat != null
                      onAuthoredCoordsChange(hasLat
                        ? { lat: authoredCoords!.lat, lon: 0, place: authoredCoords?.place ?? '' }
                        : null)
                    } else {
                      const n = parseFloat(raw)
                      if (!Number.isNaN(n)) {
                        onAuthoredCoordsChange({
                          lat: authoredCoords?.lat ?? 0,
                          lon: n,
                          place: authoredCoords?.place ?? '',
                        })
                      }
                    }
                  }}
                />
              </dd>
              {/* PLACE field: shows the place name for the authored place_id, or override_place */}
              {authoredCoords?.place && (
                <>
                  <dt>PLACE</dt>
                  <dd>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-soft)' }}>
                      {authoredCoords.place}
                    </span>
                  </dd>
                </>
              )}
            </dl>

            {/* Place assignment dropdown — sets place_id */}
            {availablePlaces.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <select
                  className={'pm-place-select' + (authoredPlaceId ? ' is-overridden' : '')}
                  value={authoredPlaceId ?? ''}
                  disabled={reading}
                  aria-label="Assign place"
                  onChange={(e) => {
                    if (!onAuthoredPlaceIdChange) return
                    const val = e.target.value
                    onAuthoredPlaceIdChange(val === '' ? null : val)
                  }}
                >
                  <option value="">— no place assigned —</option>
                  {availablePlaces.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            </>
            )}
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

/**
 * components/console/PlaceHighlightEditor.tsx — Place highlight editor panel
 * ─────────────────────────────────────────────────────────────────────────────
 * Canvas right-pane form for curating a place's highlight article + ≤5 photo frames.
 * Also handles new-place creation (name + coord).
 *
 * ARCHITECTURE (advisor flag #1 — decoupled state):
 *   - Working state seeded from `place.highlights` on open.
 *   - On SAVE → calls savePlaceHighlights server action → updates panel + rail card
 *     from the ACTION RETURN VALUE. No velite refetch / router.refresh().
 *   - `articleSlug` passed to action = article's `fileNum` (3-digit, e.g. "003").
 *     NOT the MDX slug. See highlight-core.ts contract.
 *
 * DEGRADED PHOTOS (advisor flag #4):
 *   `thumbWebp` is undefined until process-photos runs.
 *   Photo slots show FRAME ID + CAPTURE MONTH when undefined.
 *   Never renders a broken <img>. Degraded distinguisher per Vega:
 *   "{frameId} · {YYYY-MM}"
 *
 * VALIDATION (§4.1):
 *   SAVE enabled if: article set OR ≥1 photo set.
 *   Disabled only when neither. Photo-only + article-only both valid.
 *
 * KEYBOARD (§5.3 / §9):
 *   Tab → navigates form fields.
 *   Enter → selects in typeahead / activates focused slot.
 *   Escape → calls onClose (wired to ConsoleApp ESC handler).
 *   Photo reorder: Up/Down arrow on focused slot moves rank (keyboard a11y bar).
 *
 * CSS atoms used (from app/globals.css):
 *   .paper-warm-surface — panel surface (atom: paper-warm-surface)
 *   .section-rule-dashed — section dividers (atom: dashed-hairline)
 *   .t-meta, .ef-label, .ef-input, .ef-btn — composed from ConsoleEntryForm pattern
 *
 * Photo slot dimension: var(--place-thumb-editor-size) = 72px (Betelgeuse token).
 *
 * Owner: Sirius (α-SUR-01) · place-aware-globe-spec.md §5.3–5.4
 * Modeled after: ConsoleEntryForm.tsx (form pattern, keyboard, action bar)
 * Atom citations: paper-warm-surface, dashed-hairline, type-roles, atlas-strata-btn
 */

/* eslint-disable @next/next/no-img-element --
   Dev-only console surface. Photo thumbnail paths come from the process-photos
   pipeline (dynamic, not static imports). next/image requires known dimensions;
   these thumbnails are authoring-UI-only and not public-facing. */
'use client'

import {
  useState, useCallback, useRef, useTransition,
} from 'react'
import type { PlaceDTO, PlacePhotoItem } from './console-types'
// S6: swap to store actions (DL15 — place lifecycle now table-writes, not file-writes)
import {
  savePlaceHighlights,
  savePlaceCoord,
  createPlace,
} from '@/lib/server/store/actions'

// ─────────────────────────────────────────────────────────────────────────────
// Canonical copy (Vega) — place VERBATIM
// ─────────────────────────────────────────────────────────────────────────────

const COPY = {
  editorTitle:             'PLACE HIGHLIGHT EDITOR',
  editorPlaceLabel:        'PLACE: {NAME}',
  newPlaceTitle:           'NEW PLACE',
  newPlaceNamePlaceholder: 'place name',
  newPlaceCoordLat:        'LAT',
  newPlaceCoordLon:        'LON',
  articleHighlightLabel:   'ARTICLE HIGHLIGHT',
  articleHighlightHint:    'the lead entry — surfaces first in the front door',
  photoHighlightsLabel:    'PHOTO HIGHLIGHTS',
  photoHighlightsHint:     'up to 5, ordered — drag to reorder',
  photoAddButton:          '+ ADD PHOTO',
  actionSave:              'SAVE HIGHLIGHTS',
  actionCancel:            'CANCEL',
  saveDisabledHint:        'set at least one article or photo to save',
  // Degraded photo distinguisher (Vega): "{frameId} · {YYYY-MM}"
  photoDegradedDistinguisher: (frameId: string, isoDate: string) =>
    `${frameId} · ${isoDate.slice(0, 7)}`,
  // movable-alpha: α locus section copy (Vega locked — verbatim)
  alphaLocusLabel:         'α LOCUS',
  alphaCurrentIndicator:   'CURRENT α',
  alphaSetAction:          'SET AS α LOCUS',
  alphaSetting:            'setting α…',
  alphaSet:                'α set.',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// CSS — scoped to .place-editor
// Composes from ConsoleEntryForm ef-* atoms where applicable.
// ─────────────────────────────────────────────────────────────────────────────

const EDITOR_CSS = `
/* ── place highlight editor panel ───────────────────────────── */
.place-editor {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 6;
  background: var(--paper-warm);       /* atom: paper-warm-surface */
  border-top: 1px solid var(--ink-hairline);
  padding: 15px 20px 16px;
  max-height: 85%;
  overflow-y: auto;
  transition: transform 260ms cubic-bezier(0, 0, 0.2, 1);
}
.place-editor-head {
  display: flex; justify-content: space-between; align-items: baseline;
  margin-bottom: 13px;
}
.place-editor-title {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.3em;
  text-transform: uppercase; color: var(--ink-primary);
}
.place-editor-subtitle {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.3em;
  text-transform: uppercase; color: var(--ink-soft);
}
.place-editor-close {
  appearance: none; background: none; border: none;
  font-family: var(--font-mono); font-size: 8.5px; letter-spacing: 0.2em;
  color: var(--ink-soft); cursor: pointer; text-transform: uppercase;
  transition: color 0.15s;
}
.place-editor-close:hover { color: var(--accent-orange); }
.place-editor-close:focus-visible {
  outline: 1px dashed var(--accent-orange); outline-offset: 2px;
}

/* section rule — atom: dashed-hairline */
.place-editor .section-rule-dashed {
  margin: 12px 0;
}

/* Section labels (ef-label pattern) */
.pe-label {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.3em;
  text-transform: uppercase; color: var(--ink-soft); margin-bottom: 4px;
}
.pe-hint {
  font-family: var(--font-display); font-style: italic;
  font-size: 11px; color: var(--ink-faint); margin-bottom: 8px;
}

/* Article picker */
.pe-article-picker {
  position: relative;
  border: 1px solid var(--ink-hairline);
  background: var(--paper-base);
  padding: 6px 8px; display: flex; align-items: center; gap: 8px;
  transition: border-color 0.2s;
}
.pe-article-picker:focus-within { border-color: var(--accent-orange); }
.pe-article-input {
  flex: 1; min-width: 0; border: none; background: transparent; outline: none;
  font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.05em;
  color: var(--ink-primary);
}
.pe-article-input::placeholder { color: var(--ink-faint); }
.pe-article-clear {
  appearance: none; background: none; border: none;
  color: var(--ink-soft); font-size: 15px; cursor: pointer; padding: 0 2px;
  transition: color 0.15s;
}
.pe-article-clear:hover { color: var(--accent-orange); }
.pe-article-clear:focus-visible {
  outline: 1px dashed var(--accent-orange); outline-offset: 2px;
}
.pe-article-selected {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.3em;
  color: var(--accent-orange);   /* ◆ fileNum */
}
.pe-article-selected-title {
  font-family: var(--font-display); font-style: italic;
  font-size: 13px; color: var(--ink-body);
  display: block; margin-top: 3px;
}

/* Typeahead dropdown */
.pe-typeahead {
  position: absolute; left: 0; right: 0; top: 100%;
  background: var(--paper-warm); border: 1px solid var(--ink-hairline);
  border-top: none; z-index: 10; max-height: 160px; overflow-y: auto;
  list-style: none; margin: 0; padding: 0;
}
.pe-typeahead-item {
  padding: 7px 10px; cursor: pointer;
  display: flex; flex-direction: column; gap: 2px;
  transition: background 0.1s;
}
.pe-typeahead-item:hover,
.pe-typeahead-item[aria-selected="true"] {
  background: var(--accent-orange-soft);
}
.pe-typeahead-id {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.3em;
  color: var(--accent-orange); text-transform: uppercase;
}
.pe-typeahead-name {
  font-family: var(--font-display); font-style: italic;
  font-size: 13px; color: var(--ink-body);
}

/* Photo strip + slots */
.pe-photo-strip {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start;
  margin-top: 8px;
}
.pe-photo-slot {
  width: var(--place-thumb-editor-size);   /* 72px token */
  height: var(--place-thumb-editor-size);
  border: 1px dashed var(--ink-dashed);    /* atom: dashed-hairline */
  background: var(--paper-base);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  cursor: grab; position: relative; overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
  /* Keyboard focus */
}
.pe-photo-slot:focus-visible {
  outline: 1px dashed var(--accent-orange); outline-offset: 2px;
  border-color: var(--accent-orange);
}
.pe-photo-slot.is-dragging {
  opacity: 0.5; cursor: grabbing;
}
.pe-photo-slot.is-drop-target {
  border-color: var(--accent-orange); box-shadow: 0 0 0 2px var(--accent-orange-soft);
}
.pe-photo-thumb {
  width: 100%; height: 100%; object-fit: cover;
  display: block;
}
/* Degraded state — frame ID + capture month (Vega distinguisher) */
.pe-photo-degraded {
  font-family: var(--font-mono); font-size: 7px; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--ink-soft); text-align: center;
  padding: 4px; word-break: break-all; line-height: 1.3;
}
/* Remove slot X button */
.pe-photo-remove {
  position: absolute; top: 2px; right: 2px;
  appearance: none; background: rgb(var(--ink-rgb) / 0.8);
  border: none; color: var(--paper-warm); font-size: 10px;
  width: 16px; height: 16px; cursor: pointer; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.15s;
}
.pe-photo-slot:hover .pe-photo-remove,
.pe-photo-slot:focus-within .pe-photo-remove { opacity: 1; }
.pe-photo-remove:focus-visible {
  outline: 1px dashed var(--accent-orange); outline-offset: 1px; opacity: 1;
}
/* Rank badge */
.pe-photo-rank {
  position: absolute; bottom: 2px; left: 3px;
  font-family: var(--font-mono); font-size: 7px;
  color: var(--ink-soft); letter-spacing: 0.05em;
}

/* + ADD PHOTO button — same register as photo slot */
.pe-add-photo {
  width: var(--place-thumb-editor-size);
  height: var(--place-thumb-editor-size);
  border: 1px dashed var(--ink-dashed);   /* atom: dashed-hairline */
  background: transparent;
  font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--ink-soft); cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  display: flex; align-items: center; justify-content: center; text-align: center;
  padding: 4px;
}
.pe-add-photo:hover { border-color: var(--accent-orange); color: var(--accent-orange); }
.pe-add-photo:focus-visible {
  outline: 1px dashed var(--accent-orange); outline-offset: 2px;
}

/* Photo picker dropdown */
.pe-photo-picker {
  border: 1px solid var(--ink-hairline); background: var(--paper-warm);
  max-height: 200px; overflow-y: auto; margin-top: 8px;
  list-style: none; padding: 0; margin-bottom: 0;
}
.pe-photo-picker-item {
  padding: 6px 10px; cursor: pointer;
  display: flex; align-items: center; gap: 8px;
  transition: background 0.1s;
}
.pe-photo-picker-item:hover,
.pe-photo-picker-item[aria-selected="true"] {
  background: var(--accent-orange-soft);
}
.pe-photo-picker-thumb {
  width: 28px; height: 28px; object-fit: cover;
  border: 1px dashed var(--ink-dashed);
  flex-shrink: 0;
}
.pe-photo-picker-degraded {
  width: 28px; height: 28px; border: 1px dashed var(--ink-dashed);
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  font-family: var(--font-mono); font-size: 6px; color: var(--ink-soft);
  text-align: center; background: var(--paper-base);
}
.pe-photo-picker-label {
  font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em;
  color: var(--ink-body);
}
.pe-photo-picker-empty {
  padding: 10px 12px;
  font-family: var(--font-display); font-style: italic;
  font-size: 12px; color: var(--ink-faint);
}

/* Coord fields */
.pe-coord-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px;
}

/* New-place form */
.pe-new-place-grid {
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 6px;
}
.pe-field { display: flex; flex-direction: column; gap: 5px; }
.pe-input {
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.01em;
  color: var(--ink-primary); border: 1px solid var(--ink-hairline);
  background: var(--paper-base); padding: 6px 8px; border-radius: 0; outline: none;
  width: 100%; transition: border-color 0.2s;
}
.pe-input:focus { border-color: var(--accent-orange); }

/* movable-alpha: α locus row — reuses pe-label + accent-orange idiom */
.pe-alpha-row {
  display: flex; align-items: center; gap: 10px; margin-top: 4px;
}
.pe-alpha-indicator {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.3em;
  text-transform: uppercase; color: var(--accent-orange);
  display: flex; align-items: center; gap: 5px;
}
.pe-alpha-glyph { font-size: 13px; line-height: 1; }
.pe-alpha-set-btn {
  appearance: none; background: transparent;
  border: 1px solid var(--ink-hairline);
  color: var(--ink-primary); font-family: var(--font-mono); font-size: 8px;
  letter-spacing: 0.22em; text-transform: uppercase; padding: 6px 12px;
  cursor: pointer; transition: border-color 0.2s, background 0.2s, color 0.2s;
}
.pe-alpha-set-btn:hover { border-color: var(--accent-orange); color: var(--accent-orange); }
.pe-alpha-set-btn:focus-visible { outline: 1px dashed var(--accent-orange); outline-offset: 2px; }
.pe-alpha-set-btn:disabled { opacity: 0.45; pointer-events: none; }

/* Action bar */
.place-editor-actions {
  display: flex; align-items: center; gap: 14px; margin-top: 14px;
  padding-top: 13px; border-top: 1px dashed var(--ink-dashed); /* atom: dashed-hairline */
}
.pe-btn {
  appearance: none; background: transparent;
  border: 1px solid var(--ink-hairline);
  color: var(--ink-primary); font-family: var(--font-mono); font-size: 9px;
  letter-spacing: 0.22em; text-transform: uppercase; padding: 9px 18px;
  cursor: pointer; transition: border-color 0.2s, background 0.2s, color 0.2s;
}
.pe-btn:hover { border-color: var(--accent-orange); color: var(--accent-orange); }
.pe-btn:focus-visible { outline: 1px dashed var(--accent-orange); outline-offset: 2px; }
.pe-btn:disabled { opacity: 0.5; pointer-events: none; }
.pe-btn-save {
  background: var(--btn-fill); border-color: var(--btn-fill); /* semantic fill token */
  color: var(--btn-fill-fg);
}
.pe-btn-save:hover {
  background: var(--accent-orange); border-color: var(--accent-orange);
  color: var(--paper-bright);
}
.pe-status {
  flex: 1; font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--ink-faint); line-height: 1.3;
}
.pe-status.is-error { color: var(--accent-orange); }

@media (prefers-reduced-motion: reduce) {
  .place-editor,
  .pe-article-picker,
  .pe-article-clear,
  .pe-photo-slot,
  .pe-add-photo,
  .pe-photo-remove,
  .pe-photo-picker-item,
  .pe-typeahead-item,
  .place-editor-close,
  .pe-alpha-set-btn,
  .pe-btn,
  .pe-btn-save { transition-duration: 0.001ms; }
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface WorkingHighlights {
  article: { fileNum: string; title: string } | null
  photos:  Array<{ roll: string; id: string }>  // ordered rank 1..N
}

interface PlaceHighlightEditorProps {
  open:          boolean
  /** null = new place mode */
  place:         PlaceDTO | null
  onClose:       () => void
  /** Called after a successful save or create so the parent can update rail state. */
  onSaved:       (placeId: string, updated: Partial<PlaceDTO>) => void
  /** Called after createPlace succeeds so parent adds a new rail card. */
  onCreated:     (newPlace: PlaceDTO) => void
  /** movable-alpha: designate this place as the α locus. Optional — omit to hide the control. */
  onSetAlpha?:   (placeId: string) => void
  /** movable-alpha: true while a setAlpha action is in flight. */
  alphaChanging?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getPickedIds(photos: Array<{ roll: string; id: string }>): Set<string> {
  return new Set(photos.map((p) => `${p.roll}/${p.id}`))
}

// ─────────────────────────────────────────────────────────────────────────────
// PlaceHighlightEditor
// ─────────────────────────────────────────────────────────────────────────────

export function PlaceHighlightEditor({
  open, place, onClose, onSaved, onCreated, onSetAlpha, alphaChanging,
}: PlaceHighlightEditorProps) {
  const isNewPlace = place === null

  // ── Working state — seeded from place.highlights at construction.
  // The parent uses key={editingPlaceId ?? 'new'} on this component, so it
  // remounts when the target place changes. This avoids a useEffect seed
  // (which would trigger cascading renders and violate the lint rule).
  // Satisfies: no useEffect for derived state (Sirius quality bar).
  const [working, setWorking] = useState<WorkingHighlights>(() => {
    if (!place) return { article: null, photos: [] }
    return {
      article: place.highlights.articleHighlight
        ? { fileNum: place.highlights.articleHighlight.fileNum, title: place.highlights.articleHighlight.title }
        : null,
      photos: [...place.highlights.photoHighlights]
        .sort((a, b) => a.rank - b.rank)
        .map((p) => ({ roll: p.roll, id: p.id })),
    }
  })

  // Coord edit state — seeded from place prop at construction (no effect needed)
  const [coordLat, setCoordLat] = useState(() => place ? String(place.coord.lat) : '')
  const [coordLon, setCoordLon] = useState(() => place ? String(place.coord.lon) : '')

  // New-place form state
  const [newName, setNewName]   = useState('')
  const [newLat,  setNewLat]    = useState('')
  const [newLon,  setNewLon]    = useState('')

  // Article typeahead
  const [articleQuery, setArticleQuery] = useState('')
  const [showTypeahead, setShowTypeahead] = useState(false)
  const typeaheadRef = useRef<HTMLUListElement>(null)

  // Photo picker
  const [showPhotoPicker, setShowPhotoPicker] = useState(false)

  // Drag state — 1-D rank reorder
  const [dragIndex, setDragIndex]     = useState<number | null>(null)
  const [dropIndex, setDropIndex]     = useState<number | null>(null)

  // Status feedback
  const [status, setStatus]       = useState<string | null>(null)
  const [isError, setIsError]     = useState(false)
  const [isPending, startTransition] = useTransition()

  // ── SAVE enabled: article OR ≥1 photo set (§4.1 — no gate on "both") ──
  const canSave = !isPending && !isNewPlace && (
    working.article !== null || working.photos.length > 0
  )

  // ── Article typeahead filter ──
  const filteredArticles = (place?.articlePicks ?? []).filter((a) => {
    if (!articleQuery) return true
    const q = articleQuery.toLowerCase()
    return a.title.toLowerCase().includes(q) || a.fileNum.includes(q)
  })

  // ── Photo picker — exclude already-selected frames, cap at 5 ──
  const pickedIds     = getPickedIds(working.photos)
  const availablePhotos = (place?.photoPicks ?? []).filter(
    (p) => !pickedIds.has(`${p.roll}/${p.id}`),
  )
  const canAddMore = working.photos.length < 5

  // ─────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────

  const selectArticle = useCallback((fileNum: string, title: string) => {
    setWorking((w) => ({ ...w, article: { fileNum, title } }))
    setArticleQuery('')
    setShowTypeahead(false)
    setStatus(null)
  }, [])

  const clearArticle = useCallback(() => {
    setWorking((w) => ({ ...w, article: null }))
    setStatus(null)
  }, [])

  const addPhoto = useCallback((photo: PlacePhotoItem) => {
    setWorking((w) => {
      if (w.photos.length >= 5) return w
      return { ...w, photos: [...w.photos, { roll: photo.roll, id: photo.id }] }
    })
    setShowPhotoPicker(false)
    setStatus(null)
  }, [])

  const removePhoto = useCallback((index: number) => {
    setWorking((w) => {
      const next = [...w.photos]
      next.splice(index, 1)
      return { ...w, photos: next }
    })
    setStatus(null)
  }, [])

  // Keyboard reorder (a11y — move up / move down on focused slot)
  const movePhoto = useCallback((index: number, direction: 'up' | 'down') => {
    setWorking((w) => {
      const next = [...w.photos]
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= next.length) return w
      const tmp = next[index]
      next[index] = next[target]
      next[target] = tmp
      return { ...w, photos: next }
    })
  }, [])

  // ── Drag reorder ──
  const onDragStart = useCallback((index: number) => {
    setDragIndex(index)
  }, [])

  const onDragEnter = useCallback((index: number) => {
    if (dragIndex === null || index === dragIndex) return
    setDropIndex(index)
  }, [dragIndex])

  const onDragEnd = useCallback(() => {
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      setWorking((w) => {
        const next = [...w.photos]
        const [moved] = next.splice(dragIndex, 1)
        next.splice(dropIndex, 0, moved)
        return { ...w, photos: next }
      })
    }
    setDragIndex(null)
    setDropIndex(null)
  }, [dragIndex, dropIndex])

  // ── SAVE HIGHLIGHTS ──
  const handleSave = useCallback(() => {
    if (!place || !canSave) return
    setStatus('saving…')
    setIsError(false)

    startTransition(async () => {
      const result = await savePlaceHighlights({
        placeId: place.id,
        articleSlug: working.article?.fileNum ?? null,
        photoFrames: working.photos,
      })

      if (!result.ok) {
        setStatus(result.error.message)
        setIsError(true)
        return
      }

      // Update working state from action return (advisor flag #1)
      const { highlights } = result
      setWorking({
        article: highlights.articleHighlight
          ? { fileNum: highlights.articleHighlight.fileNum, title: highlights.articleHighlight.title }
          : null,
        photos: highlights.photoHighlights
          .sort((a, b) => a.rank - b.rank)
          .map((p) => ({ roll: p.roll, id: p.id })),
      })

      // Propagate back to parent rail so card reflects immediately
      onSaved(place.id, {
        highlights: {
          articleHighlight: highlights.articleHighlight
            ? { fileNum: highlights.articleHighlight.fileNum, title: highlights.articleHighlight.title }
            : null,
          photoHighlights: highlights.photoHighlights,
        },
      })
      setStatus('saved.')
      setIsError(false)
    })
  }, [place, canSave, working, onSaved])

  // ── SAVE COORD ──
  const handleSaveCoord = useCallback(() => {
    if (!place) return
    const lat = parseFloat(coordLat)
    const lon = parseFloat(coordLon)
    if (isNaN(lat) || isNaN(lon)) {
      setStatus('invalid coord — enter decimal degrees')
      setIsError(true)
      return
    }
    setStatus('saving coord…')
    setIsError(false)

    startTransition(async () => {
      const result = await savePlaceCoord({ placeId: place.id, lat, lon })
      if (!result.ok) {
        setStatus(result.error.message)
        setIsError(true)
        return
      }
      // S6: store action returns flat {lat,lon} — adapt to PlaceDTO coord shape
      onSaved(place.id, { coord: { lat: result.place.lat, lon: result.place.lon } })
      setStatus('coord saved.')
      setIsError(false)
    })
  }, [place, coordLat, coordLon, onSaved])

  // ── CREATE PLACE ──
  const handleCreate = useCallback(() => {
    const lat = parseFloat(newLat)
    const lon = parseFloat(newLon)
    if (!newName.trim()) {
      setStatus('enter a place name')
      setIsError(true)
      return
    }
    if (isNaN(lat) || isNaN(lon)) {
      setStatus('enter decimal coord: lat, lon')
      setIsError(true)
      return
    }
    setStatus('creating…')
    setIsError(false)

    startTransition(async () => {
      // S6: store action uses flat {lat, lon}, not {coord:{lat,lon}}
      const result = await createPlace({
        name: newName.trim(),
        lat,
        lon,
      })
      if (!result.ok) {
        setStatus(result.error.message)
        setIsError(true)
        return
      }
      // Construct a lean DTO for the new place (no content yet)
      // S6: result.place.lat/lon (flat) — adapt to PlaceDTO coord shape
      const newDTO: PlaceDTO = {
        id:           result.place.id,
        name:         result.place.name,
        coord:        { lat: result.place.lat, lon: result.place.lon },
        articleCount: 0,
        photoCount:   0,
        highlights:   { articleHighlight: null, photoHighlights: [] },
        articlePicks: [],
        photoPicks:   [],
        // movable-alpha: new places are never alpha by default
        isAlpha:      false,
      }
      onCreated(newDTO)
      setStatus('place created.')
      setIsError(false)
    })
  }, [newName, newLat, newLon, onCreated])

  // ─────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────

  function renderPhotoSlot(
    photo: { roll: string; id: string },
    index: number,
  ) {
    const pickedMeta = place?.photoPicks.find(
      (p) => p.roll === photo.roll && p.id === photo.id,
    )
    const isDragging   = dragIndex === index
    const isDropTarget = dropIndex === index

    return (
      <div
        key={`${photo.roll}/${photo.id}`}
        className={
          'pe-photo-slot' +
          (isDragging ? ' is-dragging' : '') +
          (isDropTarget ? ' is-drop-target' : '')
        }
        draggable
        tabIndex={0}
        aria-label={`Photo ${index + 1}: ${photo.id} from ${photo.roll}. Drag or use arrow keys to reorder.`}
        onDragStart={() => onDragStart(index)}
        onDragEnter={() => onDragEnter(index)}
        onDragEnd={onDragEnd}
        onDragOver={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp')   { e.preventDefault(); movePhoto(index, 'up') }
          if (e.key === 'ArrowDown') { e.preventDefault(); movePhoto(index, 'down') }
          if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removePhoto(index) }
        }}
      >
        {/* Thumb or degraded state */}
        {pickedMeta?.thumbWebp ? (
          <img
            src={pickedMeta.thumbWebp}
            alt={`Photo frame ${photo.id}`}
            className="pe-photo-thumb"
            draggable={false}
          />
        ) : (
          <span className="pe-photo-degraded" aria-hidden="true">
            {COPY.photoDegradedDistinguisher(
              photo.id,
              pickedMeta?.isoDate ?? '0000-00',
            )}
          </span>
        )}
        {/* Rank badge */}
        <span className="pe-photo-rank" aria-hidden="true">{index + 1}</span>
        {/* Remove */}
        <button
          type="button"
          className="pe-photo-remove"
          onClick={() => removePhoto(index)}
          aria-label={`Remove photo ${photo.id}`}
          tabIndex={0}
        >
          ×
        </button>
      </div>
    )
  }

  function renderPhotoPicker() {
    if (availablePhotos.length === 0) {
      return (
        <ul className="pe-photo-picker" role="listbox" aria-label="Available photos">
          <li className="pe-photo-picker-empty">
            {place?.photoCount === 0
              ? 'no photos at this place yet'
              : 'all frames already selected'}
          </li>
        </ul>
      )
    }
    return (
      <ul className="pe-photo-picker" role="listbox" aria-label="Available photos">
        {availablePhotos.map((p) => (
          <li
            key={`${p.roll}/${p.id}`}
            role="option"
            aria-selected="false"
            className="pe-photo-picker-item"
            onClick={() => addPhoto(p)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addPhoto(p) }
            }}
            tabIndex={0}
          >
            {p.thumbWebp ? (
              <img src={p.thumbWebp} alt="" className="pe-photo-picker-thumb" aria-hidden="true" />
            ) : (
              <div className="pe-photo-picker-degraded" aria-hidden="true">
                {COPY.photoDegradedDistinguisher(p.id, p.isoDate)}
              </div>
            )}
            <span className="pe-photo-picker-label">
              {p.roll} / {p.id}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  // ─────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────

  const panelTitle = isNewPlace
    ? COPY.newPlaceTitle
    : COPY.editorTitle

  const panelSubtitle = !isNewPlace && place
    ? COPY.editorPlaceLabel.replace('{NAME}', place.name)
    : ''

  return (
    <>
      <style>{EDITOR_CSS}</style>
      <div
        className="place-editor paper-warm-surface"
        aria-hidden={!open}
        aria-label={isNewPlace ? 'New place form' : `Highlight editor for ${place?.name ?? ''}`}
        style={{
          transform:     open ? 'translateY(0)' : 'translateY(100%)',
          pointerEvents: open ? 'auto' : 'none',
        }}
        role="form"
      >
        {/* Head */}
        <div className="place-editor-head">
          <div>
            <div className="place-editor-title">{panelTitle}</div>
            {panelSubtitle && (
              <div className="place-editor-subtitle">{panelSubtitle}</div>
            )}
          </div>
          <button
            type="button"
            className="place-editor-close"
            onClick={onClose}
            aria-label="Close editor (Esc)"
          >
            ESC · CLOSE
          </button>
        </div>

        {/* ── NEW PLACE FORM ── */}
        {isNewPlace && (
          <>
            <div className="section-rule-dashed" />
            <div className="pe-label">{COPY.newPlaceTitle}</div>
            <div className="pe-new-place-grid">
              <label className="pe-field" style={{ gridColumn: 'span 3' }}>
                <span className="pe-label">NAME</span>
                <input
                  className="pe-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={COPY.newPlaceNamePlaceholder}
                  aria-label="Place name"
                />
              </label>
              <label className="pe-field">
                <span className="pe-label">{COPY.newPlaceCoordLat}</span>
                <input
                  className="pe-input"
                  type="number"
                  step="0.0001"
                  value={newLat}
                  onChange={(e) => setNewLat(e.target.value)}
                  placeholder="13.7563"
                  aria-label="Latitude"
                />
              </label>
              <label className="pe-field">
                <span className="pe-label">{COPY.newPlaceCoordLon}</span>
                <input
                  className="pe-input"
                  type="number"
                  step="0.0001"
                  value={newLon}
                  onChange={(e) => setNewLon(e.target.value)}
                  placeholder="100.5018"
                  aria-label="Longitude"
                />
              </label>
            </div>

            <div className="place-editor-actions">
              <button
                type="button"
                className="pe-btn pe-btn-save"
                disabled={isPending}
                onClick={handleCreate}
                aria-disabled={isPending}
              >
                CREATE PLACE
              </button>
              <button
                type="button"
                className="pe-btn"
                onClick={onClose}
              >
                {COPY.actionCancel}
              </button>
              {status && (
                <span className={'pe-status' + (isError ? ' is-error' : '')} aria-live="polite">
                  {status}
                </span>
              )}
            </div>
          </>
        )}

        {/* ── HIGHLIGHT EDITOR (existing place) ── */}
        {!isNewPlace && place && (
          <>
            {/* ARTICLE HIGHLIGHT */}
            <div className="section-rule-dashed" />
            <div className="pe-label">{COPY.articleHighlightLabel}</div>
            <div className="pe-hint">{COPY.articleHighlightHint}</div>

            <div style={{ position: 'relative' }}>
              <div className="pe-article-picker">
                {working.article ? (
                  <>
                    <span className="pe-article-selected" aria-live="polite">
                      {'◆ '}{working.article.fileNum}
                    </span>
                    <span className="pe-article-selected-title">
                      {working.article.title}
                    </span>
                    <button
                      type="button"
                      className="pe-article-clear"
                      onClick={clearArticle}
                      aria-label="Clear article highlight"
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <input
                    type="text"
                    className="pe-article-input"
                    placeholder="search articles at this place…"
                    value={articleQuery}
                    onChange={(e) => { setArticleQuery(e.target.value); setShowTypeahead(true) }}
                    onFocus={() => setShowTypeahead(true)}
                    onBlur={() => setTimeout(() => setShowTypeahead(false), 150)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setShowTypeahead(false)
                      if (e.key === 'Enter' && filteredArticles.length > 0) {
                        selectArticle(filteredArticles[0].fileNum, filteredArticles[0].title)
                      }
                    }}
                    aria-label="Search articles at this place"
                    aria-expanded={showTypeahead}
                    aria-haspopup="listbox"
                    aria-autocomplete="list"
                    role="combobox"
                    aria-controls="pe-article-typeahead"
                  />
                )}
              </div>

              {/* Typeahead */}
              {showTypeahead && !working.article && filteredArticles.length > 0 && (
                <ul
                  id="pe-article-typeahead"
                  className="pe-typeahead"
                  role="listbox"
                  aria-label="Article options"
                  ref={typeaheadRef}
                >
                  {filteredArticles.map((a) => (
                    <li
                      key={a.fileNum}
                      role="option"
                      aria-selected="false"
                      className="pe-typeahead-item"
                      onMouseDown={() => selectArticle(a.fileNum, a.title)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          selectArticle(a.fileNum, a.title)
                        }
                      }}
                    >
                      <span className="pe-typeahead-id">{'◆ '}{a.fileNum}</span>
                      <span className="pe-typeahead-name">{a.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* PHOTO HIGHLIGHTS */}
            <div className="section-rule-dashed" style={{ marginTop: '14px' }} />
            <div className="pe-label">{COPY.photoHighlightsLabel}</div>
            <div className="pe-hint">{COPY.photoHighlightsHint}</div>

            <div
              className="pe-photo-strip"
              role="list"
              aria-label="Photo highlights (drag or arrow keys to reorder)"
            >
              {working.photos.map((photo, index) => (
                <div key={`${photo.roll}/${photo.id}`} role="listitem">
                  {renderPhotoSlot(photo, index)}
                </div>
              ))}
              {canAddMore && (
                <button
                  type="button"
                  className="pe-add-photo"
                  onClick={() => setShowPhotoPicker((v) => !v)}
                  aria-label={COPY.photoAddButton}
                  aria-expanded={showPhotoPicker}
                >
                  {COPY.photoAddButton}
                </button>
              )}
            </div>

            {/* Photo picker dropdown */}
            {showPhotoPicker && renderPhotoPicker()}

            {/* COORD */}
            <div className="section-rule-dashed" style={{ marginTop: '14px' }} />
            <div className="pe-label">COORD</div>
            <div className="pe-coord-row">
              <label className="pe-field">
                <span className="pe-label">{COPY.newPlaceCoordLat}</span>
                <input
                  className="pe-input"
                  type="number"
                  step="0.0001"
                  value={coordLat}
                  onChange={(e) => setCoordLat(e.target.value)}
                  aria-label="Latitude"
                />
              </label>
              <label className="pe-field">
                <span className="pe-label">{COPY.newPlaceCoordLon}</span>
                <input
                  className="pe-input"
                  type="number"
                  step="0.0001"
                  value={coordLon}
                  onChange={(e) => setCoordLon(e.target.value)}
                  aria-label="Longitude"
                />
              </label>
            </div>
            <div style={{ marginTop: '6px' }}>
              <button
                type="button"
                className="pe-btn"
                disabled={isPending}
                onClick={handleSaveCoord}
                style={{ fontSize: '8px', padding: '6px 12px' }}
              >
                SAVE COORD
              </button>
            </div>

            {/* movable-alpha: α LOCUS section — shows indicator if current alpha,
                or SET AS α LOCUS button if not. Reuses pe-label + accent-orange idiom.
                Only shown when the onSetAlpha callback is provided (owner login). */}
            {onSetAlpha && (
              <>
                <div className="section-rule-dashed" style={{ marginTop: '14px' }} />
                <div className="pe-label">{COPY.alphaLocusLabel}</div>
                <div className="pe-alpha-row">
                  {place.isAlpha ? (
                    <div
                      className="pe-alpha-indicator"
                      aria-label="This place is the current alpha locus"
                    >
                      <span className="pe-alpha-glyph" aria-hidden="true">α</span>
                      {COPY.alphaCurrentIndicator}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="pe-alpha-set-btn"
                      disabled={alphaChanging || isPending}
                      onClick={() => onSetAlpha(place.id)}
                      aria-label={`Set ${place.name} as the alpha locus`}
                    >
                      {COPY.alphaSetAction}
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Action bar */}
            <div className="place-editor-actions">
              <button
                type="button"
                className="pe-btn pe-btn-save"
                disabled={!canSave}
                onClick={handleSave}
                aria-disabled={!canSave}
                title={!canSave ? COPY.saveDisabledHint : undefined}
              >
                {COPY.actionSave}
              </button>
              <button
                type="button"
                className="pe-btn"
                onClick={onClose}
              >
                {COPY.actionCancel}
              </button>
              <span
                className={'pe-status' + (isError ? ' is-error' : '')}
                aria-live="polite"
              >
                {isPending
                  ? 'saving…'
                  : status
                  ? status
                  : !canSave
                  ? COPY.saveDisabledHint
                  : '·'}
              </span>
            </div>
          </>
        )}
      </div>
    </>
  )
}

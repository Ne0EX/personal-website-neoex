/**
 * components/console/PlacesRailBlock.tsx — PLACES block in the console rail
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders the PLACES section above the entry list in ConsoleRail.
 * Place cards: glyph ◉, name, article/photo counts, highlight status, action CTA.
 *
 * CSS atoms used (from app/globals.css):
 *   .paper-warm-surface  — card surface (atom: paper-warm-surface)
 *   .section-rule-dashed — dashed divider (atom: dashed-hairline)
 *   .t-meta              — JetBrains Mono 9px uppercase (atom: type-roles)
 *
 * Card padding: composed from .atlas-strata-btn precedent (9px 11px) —
 *   same "clickable aside card" register. See §5.2 spec + token notes.
 *
 * Highlight NOT SET warning: uses var(--accent-orange) full opacity — NOT
 *   var(--accent-orange-soft). The soft token fails 3:1 on --paper-warm.
 *   See Betelgeuse token notes — "soft" here is an adjective, not the token.
 *
 * Owner: Sirius (α-SUR-01) · place-aware-globe-spec.md §5.1–5.2
 * Modeled after: ConsoleRail.tsx (rail-block, rail-head pattern)
 * Atom citations: paper-warm-surface, dashed-hairline, type-roles, atlas-strata-btn
 */

'use client'

import type { PlaceDTO } from './console-types'

// ─────────────────────────────────────────────────────────────────────────────
// Canonical copy (Vega) — place VERBATIM
// ─────────────────────────────────────────────────────────────────────────────

const COPY = {
  header:              'PLACES',
  countsTemplate:      '{articleCount} articles · {photoCount} photos',
  highlightNotSet:     'highlights: NOT SET',
  editHighlights:      'EDIT HIGHLIGHTS →',
  setHighlights:       'SET HIGHLIGHTS →',
  newPlace:            '+ NEW PLACE',
  // highlight set variants (Vega §rail.card.highlight.set.*)
  highlightBoth:       (photoCount: number) => `1 article · ${photoCount} photos`,
  highlightBothSing:   '1 article · 1 photo',
  highlightArticleOnly:'1 article',
  highlightPhotoPlural: (n: number) => `${n} photos`,
  highlightPhotoSing:  '1 photo',
} as const

function formatCounts(articleCount: number, photoCount: number): string {
  return COPY.countsTemplate
    .replace('{articleCount}', String(articleCount))
    .replace('{photoCount}',   String(photoCount))
}

function formatHighlightSet(photoHighlights: Array<unknown>, articleHighlight: unknown): string {
  const hasArticle = articleHighlight !== null
  const photoCount = photoHighlights.length
  if (hasArticle && photoCount > 1)  return COPY.highlightBoth(photoCount)
  if (hasArticle && photoCount === 1) return COPY.highlightBothSing
  if (hasArticle && photoCount === 0) return COPY.highlightArticleOnly
  if (!hasArticle && photoCount > 1)  return COPY.highlightPhotoPlural(photoCount)
  if (!hasArticle && photoCount === 1) return COPY.highlightPhotoSing
  // Fallback: should not reach (hasHighlights=true implies one or more set)
  return COPY.highlightArticleOnly
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS — scoped to .places-rail-block
// Atoms: paper-warm-surface (card bg), dashed-hairline (border), t-meta (labels)
// Card padding: .atlas-strata-btn precedent (9px 11px)
// ─────────────────────────────────────────────────────────────────────────────

const PLACES_BLOCK_CSS = `
/* ── places rail block ───────────────────────────────────────── */
.places-rail-block { padding: 14px 16px; }

.places-rail-head {
  font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.32em;
  text-transform: uppercase; color: var(--ink-faint);
  display: flex; justify-content: space-between; align-items: baseline;
  margin-bottom: 10px;
}
.places-rail-count {
  color: var(--ink-soft); font-family: var(--font-type); letter-spacing: 0.04em;
}

/* Place card — atom: paper-warm-surface + dashed-hairline */
.place-card {
  background: var(--paper-warm);           /* atom: paper-warm-surface */
  border: 1px dashed var(--ink-dashed);    /* atom: dashed-hairline */
  padding: 9px 11px;                       /* .atlas-strata-btn precedent */
  margin-bottom: 7px;
  display: flex; flex-direction: column; gap: 3px;
}
.place-card:last-of-type { margin-bottom: 0; }

/* Place name — atom: t-meta override to ink-primary */
.place-card-name {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.3em;
  text-transform: uppercase; color: var(--ink-primary); /* t-meta + color override */
}

/* Counts and status rows — atom: t-meta defaults to ink-soft */
.place-card-counts {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.3em;
  text-transform: uppercase; color: var(--ink-soft);     /* atom: t-meta */
}

/* Highlight status SET — Cormorant italic, ink-soft */
.place-card-highlight-set {
  font-family: var(--font-display); font-style: italic;
  font-size: 11px; color: var(--ink-soft);
}

/* Highlight status NOT SET — t-meta, full accent-orange (NOT -soft, contrast needed) */
.place-card-highlight-notset {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--accent-orange); /* full opacity — soft fails 3:1 on --paper-warm */
}

/* CTA button — t-meta, ink-soft at rest → accent-orange on hover */
.place-card-action {
  appearance: none; background: none; border: none; padding: 0;
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.3em;
  text-transform: uppercase; color: var(--ink-soft);
  cursor: pointer; text-align: left; margin-top: 3px;
  transition: color 150ms ease;   /* .archive-atlas-link precedent */
}
.place-card-action:hover { color: var(--accent-orange); }
.place-card-action:focus-visible {
  outline: 1px dashed var(--accent-orange); outline-offset: 2px;
}

/* + NEW PLACE footer button */
.places-new-btn {
  width: 100%; appearance: none; background: transparent;
  border: 1px dashed var(--ink-dashed); color: var(--ink-soft);
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.22em;
  text-transform: uppercase; padding: 8px; cursor: pointer; margin-top: 10px;
  transition: border-color 0.15s, color 0.15s;
}
.places-new-btn:hover { border-color: var(--accent-orange); color: var(--accent-orange); }
.places-new-btn:focus-visible {
  outline: 1px dashed var(--accent-orange); outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .place-card-action,
  .places-new-btn { transition-duration: 0.001ms; }
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface PlacesRailBlockProps {
  places:       PlaceDTO[]
  selectedPlaceId: string | null
  onEditPlace:  (placeId: string) => void
  onNewPlace:   () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// PlacesRailBlock
// ─────────────────────────────────────────────────────────────────────────────

export function PlacesRailBlock({
  places, selectedPlaceId, onEditPlace, onNewPlace,
}: PlacesRailBlockProps) {
  const count = String(places.length).padStart(3, '0')

  function hasHighlights(place: PlaceDTO): boolean {
    return (
      place.highlights.articleHighlight !== null ||
      place.highlights.photoHighlights.length > 0
    )
  }

  return (
    <>
      <style>{PLACES_BLOCK_CSS}</style>
      <div className="places-rail-block" aria-label="Places">
        {/* Block header */}
        <div className="places-rail-head" aria-hidden="true">
          {'// ' + COPY.header} <span className="places-rail-count">{count}</span>
        </div>

        {/* Place cards */}
        {places.map((place) => {
          const highlighted = hasHighlights(place)
          const isSelected  = selectedPlaceId === place.id
          const actionLabel = highlighted ? COPY.editHighlights : COPY.setHighlights

          return (
            <article
              key={place.id}
              className="place-card paper-warm-surface"
              aria-label={`${place.name} — ${place.articleCount} articles, ${place.photoCount} photos`}
              aria-current={isSelected ? 'true' : undefined}
            >
              {/* ◉ NAME */}
              <div className="place-card-name" aria-hidden="true">
                {'◉ '}{place.name}
              </div>

              {/* N articles · N photos */}
              <div className="place-card-counts">
                {formatCounts(place.articleCount, place.photoCount)}
              </div>

              {/* Highlight status */}
              {highlighted ? (
                <div className="place-card-highlight-set">
                  {formatHighlightSet(
                    place.highlights.photoHighlights,
                    place.highlights.articleHighlight,
                  )}
                </div>
              ) : (
                <div className="place-card-highlight-notset">
                  {COPY.highlightNotSet}
                </div>
              )}

              {/* EDIT/SET HIGHLIGHTS CTA */}
              <button
                type="button"
                className="place-card-action"
                onClick={() => onEditPlace(place.id)}
                aria-label={`${actionLabel} for ${place.name}`}
                aria-pressed={isSelected}
              >
                {actionLabel}
              </button>
            </article>
          )
        })}

        {/* + NEW PLACE */}
        <button
          type="button"
          className="places-new-btn"
          onClick={onNewPlace}
          aria-label="Create a new place"
        >
          {COPY.newPlace}
        </button>
      </div>
    </>
  )
}

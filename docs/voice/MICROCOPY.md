# WORLDLINE MICROCOPY REGISTRY

canonical record of all microcopy used in the site, keyed by surface + location.
registers: Instrument (t-mono uppercase), Reflective (Cormorant italic), NETRA (lowercase mono).

format: key · string · register · location reference

---

## atlas-console · places-curation-surface

added: 2026-06-08 · vega α-VOX-08
source: docs/design/place-aware-globe-spec.md §5.2–5.4, §4.1 · docs/atlas-console/CURATION-BUILD-PLAN.md

### rail · places block

| key | string | register |
|-----|--------|----------|
| `rail.places.header` | `PLACES` | Instrument — t-mono 9px uppercase, tracking 0.3em |
| `rail.card.counts` | `{articleCount} articles · {photoCount} photos` | Instrument — t-mono 9px, ink-soft |
| `rail.card.countsSingularArticle` | `1 article · {photoCount} photos` | Instrument — t-mono 9px, ink-soft (note: article count is always 0 or 1 in this slot) |
| `rail.card.highlight.set.both` | `1 article · {photoCount} photos` | Reflective — Cormorant italic, ink-soft |
| `rail.card.highlight.set.articleOnly` | `1 article` | Reflective — Cormorant italic, ink-soft |
| `rail.card.highlight.set.photoOnly` | `{photoCount} photo` / `{photoCount} photos` | Reflective — Cormorant italic, ink-soft |
| `rail.card.highlight.notSet` | `highlights: NOT SET` | Instrument — t-mono 9px, accent-orange warning state |
| `rail.card.action.editHighlights` | `EDIT HIGHLIGHTS →` | Instrument — t-mono 9px, ink-soft at rest / accent-orange on hover |
| `rail.card.action.setHighlights` | `SET HIGHLIGHTS →` | Instrument — t-mono 9px, ink-soft at rest / accent-orange on hover |
| `rail.places.action.newPlace` | `+ NEW PLACE` | Instrument — t-mono 9px, ink-soft at rest / accent-orange on hover |

### editor · highlight editor panel

| key | string | register |
|-----|--------|----------|
| `editor.title` | `PLACE HIGHLIGHT EDITOR` | Instrument — t-mono 9px uppercase |
| `editor.placeLabel` | `PLACE: {NAME}` | Instrument — t-mono 9px uppercase |
| `editor.newPlace.title` | `NEW PLACE` | Instrument — t-mono 9px uppercase |
| `editor.newPlace.namePlaceholder` | `place name` | Instrument — t-mono, placeholder |
| `editor.newPlace.coord.lat` | `LAT` | Instrument — t-mono 9px uppercase |
| `editor.newPlace.coord.lon` | `LON` | Instrument — t-mono 9px uppercase |
| `editor.articleHighlight.label` | `ARTICLE HIGHLIGHT` | Instrument — t-mono 9px uppercase |
| `editor.articleHighlight.hint` | `the lead entry — surfaces first in the front door` | Reflective — Cormorant italic, ink-soft; lowercase |
| `editor.photoHighlights.label` | `PHOTO HIGHLIGHTS` | Instrument — t-mono 9px uppercase |
| `editor.photoHighlights.hint` | `up to 5, ordered — drag to reorder` | Instrument — t-mono 9px, ink-soft; lowercase |
| `editor.photo.addButton` | `+ ADD PHOTO` | Instrument — t-mono 9px |
| `editor.action.save` | `SAVE HIGHLIGHTS` | Instrument — t-mono 9px uppercase |
| `editor.action.cancel` | `CANCEL` | Instrument — t-mono 9px uppercase |

### editor · state copy

| key | string | register |
|-----|--------|----------|
| `editor.state.saveDisabled.hint` | `set at least one article or photo to save` | Reflective — Cormorant italic, ink-faint; lowercase |

### netra · globe voice

| key | string | register |
|-----|--------|----------|
| `netra.place.noHighlights` | `trace · {name} · {N} records. no highlights curated yet.` | NETRA — lowercase mono |

### photo · degraded state

| key | string | register |
|-----|--------|----------|
| `photo.degraded.distinguisher` | `{frameId} · {YYYY-MM}` | Instrument — t-mono 9px, ink-soft (e.g. DSCF0002 · 2026-05) |

---

*vega · α-VOX-08 · 2026-06-08*

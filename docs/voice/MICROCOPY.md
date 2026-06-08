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

## atlas-console · editor · lifecycle-controls

added: 2026-06-08 · vega α-VOX-08
revised: 2026-06-08 · vega α-VOX-08 — language consistency fix (mixed Thai/English → English throughout); removed implementation-detail leak ("git") from delete confirm; synced toggle copy to Polaris-resolved state-noun pattern
source: docs/atlas-console/EDITOR-LIFECYCLE-GAP-AUDIT-2026-06-08.md §Resolved decisions
surface: console editor toolbar + delete confirm + entry badge
register notes: all button / badge / toggle labels = Instrument (t-mono uppercase);
  explanatory sub-lines = NETRA-adjacent (lowercase mono, no particle);
  entire surface is English-only — the console is internal (noindex, Peat-only) but
  register consistency takes precedence; no bilingual patterns on any console surface.

### delete controls

| key | string | register |
|-----|--------|----------|
| `lifecycle.delete.button` | `DELETE ENTRY` | Instrument — t-mono 9px uppercase, ink-soft at rest / accent-orange on hover |
| `lifecycle.delete.confirm.prompt` | `REMOVE ENTRY?` | Instrument — t-mono 11px uppercase, accent-orange |
| `lifecycle.delete.confirm.clause` | `source removed · restorable before you commit` | NETRA-adjacent — lowercase mono 9px, ink-soft; note: "source" = the .mdx file; "commit" = the console's own COMMIT action (ConsoleEntryForm); image variants are NOT deleted |
| `lifecycle.delete.confirm.action` | `CONFIRM DELETE` | Instrument — t-mono 9px uppercase, accent-orange filled button |
| `lifecycle.delete.confirm.cancel` | `CANCEL` | Instrument — t-mono 9px uppercase, ink-soft ghost button (matches existing `editor.action.cancel`) |
| `lifecycle.delete.confirmed` | `entry removed` | NETRA-adjacent — lowercase mono 9px, ink-soft; shown in-context after redirect/rail-update |

### publish/unpublish toggle

| key | string | register |
|-----|--------|----------|
| `lifecycle.publish.toggle.published` | `PUBLISHED` | Instrument — t-mono 9px uppercase; active-side of instrument switch (filled-ink); PUBLISHED = visible on the live site |
| `lifecycle.publish.toggle.unpublished` | `DRAFT` | Instrument — t-mono 9px uppercase; inactive-side label; DRAFT = hidden from the live site |
| `lifecycle.publish.toggle.separator` | `⇄` | glyph; flanked by the two state labels; same instrument-switch atom as FICTION `//STATE` toggle |

note on naming: both segments are state nouns — `PUBLISHED` (visible) / `DRAFT` (hidden) — mirroring
the `DRAFT ⇄ SETTLED` pattern in the fiction //STATE rail. Resolved by Polaris 2026-06-08. Previous
draft used `UNPUBLISH` (verb, action) on the inactive side; superseded because the switch is a
state-selector, not an action-pair — the filled-ink segment shows current state, the un-filled shows
the available target state; two nouns reads correctly in that idiom.

### draft state badge

| key | string | register |
|-----|--------|----------|
| `lifecycle.draft.badge` | `DRAFT · HIDDEN FROM SITE` | Instrument — t-mono 9px uppercase, accent-orange; shown when entry.draft=true |
| `lifecycle.draft.devNote` | `visible on local preview · hidden in production` | NETRA-adjacent — lowercase mono 9px, ink-faint; tooltip or provenance-line sub-text |

note on DRAFT collision: `DRAFT` appears in three axes on fiction entries — (1) this badge (entry-level
visibility: entry.draft=true), (2) the fiction chapter maturity state `DRAFT ⇄ SETTLED`, and (3) the
PUBLISHED⇄DRAFT toggle segment in the lifecycle cluster. The disambiguators: (1) this badge ALWAYS
carries `· HIDDEN FROM SITE` — never appears without that qualifier; (2) the maturity badge NEVER
carries the visibility qualifier; (3) the toggle segment is flanked by `PUBLISHED ⇄` — its toggle
context makes the axis (visibility) unambiguous. Sirius and Betelgeuse must ensure (1) and (2) never
appear in identical proximity without their respective qualifiers. Flagged to Polaris if spatial
separation is insufficient.

---

*vega · α-VOX-08 · 2026-06-08*

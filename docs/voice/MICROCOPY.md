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
source: docs/atlas-console/EDITOR-LIFECYCLE-GAP-AUDIT-2026-06-08.md §Resolved decisions
surface: console editor toolbar + delete confirm + entry badge
register notes: all button / badge / toggle labels = Instrument (t-mono uppercase);
  explanatory sub-lines = NETRA-adjacent (lowercase mono, no particle);
  bilingual delete confirm (Thai gut-punch / English clause) is a new pattern
  on this surface — documented here as precedent for console-only (noindex, Peat-only).
  escalate to Polaris before extending bilingual to any public-facing surface.

### delete controls

| key | string | register |
|-----|--------|----------|
| `lifecycle.delete.button` | `DELETE ENTRY` | Instrument — t-mono 9px uppercase, ink-soft at rest / accent-orange on hover |
| `lifecycle.delete.confirm.prompt` | `ลบถาวร?` | Instrument — t-mono 11px uppercase, accent-orange |
| `lifecycle.delete.confirm.clause` | `source removed. recoverable from git.` | NETRA-adjacent — lowercase mono 9px, ink-soft; note: "source" = the .mdx file; image variants are NOT deleted |
| `lifecycle.delete.confirm.action` | `CONFIRM DELETE` | Instrument — t-mono 9px uppercase, accent-orange filled button |
| `lifecycle.delete.confirm.cancel` | `CANCEL` | Instrument — t-mono 9px uppercase, ink-soft ghost button (matches existing `editor.action.cancel`) |
| `lifecycle.delete.confirmed` | `entry removed` | NETRA-adjacent — lowercase mono 9px, ink-soft; shown in-context after redirect/rail-update |

### publish/unpublish toggle

| key | string | register |
|-----|--------|----------|
| `lifecycle.publish.toggle.published` | `PUBLISHED` | Instrument — t-mono 9px uppercase; active-side of instrument switch (filled-ink); PUBLISH = visible on the live site |
| `lifecycle.publish.toggle.unpublished` | `UNPUBLISH` | Instrument — t-mono 9px uppercase; inactive-side label; UNPUBLISH = hide from the live site |
| `lifecycle.publish.toggle.separator` | `⇄` | glyph; flanked by the two state labels; same instrument-switch atom as FICTION `//STATE` toggle |

note on naming: `PUBLISHED` (past participle, state) / `UNPUBLISH` (verb, action) is an asymmetry
resolved intentionally — the active state reads as a fact ("PUBLISHED"), the inactive action reads as
an instruction ("UNPUBLISH"). The mirror form `PUBLISHED ⇄ UNPUBLISHED` is too passive; `PUBLISH ⇄
UNPUBLISH` reads as two actions with no indication of current state. This asymmetry is the instrument-
register idiom already present in the console: `SAVE DRAFT` (action) vs `COMMIT` (action) — state-then-
action is the established pattern.

### draft state badge

| key | string | register |
|-----|--------|----------|
| `lifecycle.draft.badge` | `DRAFT · HIDDEN FROM SITE` | Instrument — t-mono 9px uppercase, accent-orange; shown when entry.draft=true |
| `lifecycle.draft.devNote` | `visible on local preview · hidden in production` | NETRA-adjacent — lowercase mono 9px, ink-faint; tooltip or provenance-line sub-text |

note on DRAFT collision: `DRAFT` appears in two axes on fiction entries — this badge (entry-level
visibility: entry.draft=true) and the fiction chapter maturity state `DRAFT ⇄ SETTLED`. The
disambiguator is mandatory: this badge ALWAYS carries `· HIDDEN FROM SITE`; the maturity badge
NEVER does. Sirius and Betelgeuse must ensure both never appear in identical proximity without
the qualifier. Flagged to Polaris if spatial separation is insufficient.

---

*vega · α-VOX-08 · 2026-06-08*

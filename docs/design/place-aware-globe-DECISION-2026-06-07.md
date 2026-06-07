# Place-aware globe — design decision (2026-06-07)

> Polaris decision record. Resolved WITH Peat in conversation (feeling-before-form, worldline-soul). Grounds the Betelgeuse spec + Procyon schema that follow. NOT a build artifact — the resolved decisions.

## The problem (Peat)
The globe is **node-first**: one pin = one entry at its `coords.lat/lon` (`RECENT_ENTRIES` → `WorldlineGlobe`). N entries at one location = N overlapping pins at one point. It has no notion of "this place holds many." And a single city node flattens district-level character (Bangkok ≠ เยาวราช ≠ ทองหล่อ; Tokyo districts each distinct).

## Resolved model
1. **Don't cram everything into a node.** A place is not a dump of all its content.
2. **Curated highlights per place** = **1 article + up to ~5 standout photos**, chosen by Peat **in the console** (console = the curation surface — this is the "console links real articles + globe" ask).
3. **Dig, don't splay** (soul: understanding is *earned*, not exhibited). A place-node reads **weightier as it holds more**; you **dig into it** to unfold its highlights — not splayed open on the surface.
4. **Highlights are the FRONT DOOR, not the whole (decision: ข).** Open a place-node → see the curated 1+5 first → **dig PAST them to everything at that place.** That "dig deeper" is the seed that grows into the micro-map.
5. **Place is the unit — and it nests (the future axis).** Now: city-level place (highlights). **Future: micro-map / region** — zoom into a dense city → a micro-map of its districts, each a sub-place with its own highlights. Design the place-model **hierarchical from the start** so micro-map extends without a repaint. This answers Peat's "จะแปะลงไปยังไงต่อ."
6. **Fiction stays orbital (NeX), not geographic** (cosmology / observer-axis): per-place highlights = **article + photo** (Ne0 surface). Fiction remains in the orbital possibility-field. *(operating assumption — restated for confirmation)*

## Gating prerequisite — "real, not mock"
All three of Peat's asks (real film-sim in the editor preview · console ↔ real articles · real content on the globe) require **real-content wiring first** (Procyon): consume the real velite articles/photos/EXIF/filmSim that already back the public pages, plus new schema for **place-grouping** and a **highlight flag/rank**. The editor's photo preview is mock today (no pixels → nothing for FilmSimSwitcher to filter), so film-sim can't be "real" in the editor until it renders a real photo.

## Sequence
1. **Design spec** (Betelgeuse) — place-model (hierarchical), place-node visual (weight-by-count + dig affordance), highlights front-door + dig-to-all, console curation surface, micro-map as documented future extension. Soul-anchored.
2. **Schema** (Procyon, serving the spec) — place-grouping, highlight flag/rank, real-content consumption path.
3. **Build** — real-content wiring → highlights curation (console) + dig (globe) + film-sim-real (editor preview reuses real PhotoEntry/FilmSimSwitcher).
4. **Future** — micro-map / region (district grain).

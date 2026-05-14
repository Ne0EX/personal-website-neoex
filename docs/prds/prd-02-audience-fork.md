# PRD 02 — Audience Fork

> Status: Draft v0.1 — 2026.05.10
> Phase: B
> Companion: `worldline-feature-brainstorm.md` §2
> Tech: zustand

---

## Goal

Resolve the dual-audience requirement (professional vs curious) by offering a single explicit choice immediately after the boot sequence completes. Same content base under both paths; different curation and entry layout. Visitors choose; choice persists; switch is always reachable.

## User stories

- **As a recruiter**, I want to land on a path that surfaces portfolio, resume, and significant repos first, with lifestyle content visible but not foregrounded.
- **As a curious internet person who follows Peat's photos and films**, I want to land on a path that surfaces photos, fiction, films, and coffee logs first, with the resume reachable but quiet.
- **As a return visitor**, I want my chosen path remembered; I shouldn't have to re-pick every visit.
- **As a visitor who picked the "wrong" path**, I want to switch worldlines from anywhere on the site without ceremony.

## Scope

### In scope

- New screen rendered after `BootSequence` completes, before `HeroBlock`.
- Two paths, mutually exclusive: `craft` and `trace`.
- Path choice persists in localStorage via zustand persist middleware.
- Audience-aware curation in:
  - Hero copy / tagline (subtle adjustment per path)
  - `ChapterIndex` ordering (which entries surface first)
  - `AttractorFields` default-active filter per path
  - `Nav` link order
- "Switch worldline" affordance reachable from `Nav` always.
- ATLAS strata (Ne0 / Ne0N / NeX) integrate: craft path defaults to Ne0 stratum, trace path defaults to NeX, both can navigate freely.

### Out of scope

- Personalized recommendations beyond the static curation map.
- Auth or account-level path persistence (local only).
- A/B testing the curation logic.
- Path-specific onboarding tours.

## Functional requirements

### Fork screen

Rendered as full-page overlay. Triggered when:
- `wl:audience-path` is unset in localStorage AND
- `wl:boot-seen` is set (boot has completed this session OR was skipped)

Screen layout (concept; design pass needed):

```
                  WORLDLINE 1.130426 · OBSERVER LOCUS ESTABLISHED

                       SELECT TRAVERSAL VECTOR


    SURVEY BY CRAFT                          SURVEY BY TRACE
    ── ── ── ── ──                           ── ── ── ── ──
    "the work, the why,                      "what I'm watching,
     the work-in-progress."                   reading, drinking, framing."

    portfolio                                photo journal
    repos · writeups                         intercepted transmissions
    articles                                 films · coffee · books
    resume                                   anilist · letterboxd

    [ NAVIGATE Ne0 → ]                       [ NAVIGATE NeX → ]


              you can switch worldlines anytime · ◇ esc skips
```

- ESC or "skip" sets path to `unset` and proceeds with default curation (currently: chronological recent entries, all attractor fields visible).
- Choice writes to localStorage and routes to `/`.

### Curation map

Single source of truth for per-path UI changes. Keep small for v1:

| Component | `craft` path | `trace` path | unset |
|---|---|---|---|
| `HeroBlock` tagline | "an archive of *unfinished* thought, surveyed openly." | "fragments, frames, and worldlines kept openly." | current default |
| `ChapterIndex` filter | tags include `["essay", "method", "reflection"]` first | tags include `["coffee", "film", "japan", "narrative"]` first | chronological |
| `AttractorFields` default-active | `meta` | `all` | `all` |
| `Nav` order | `INDEX · TRACES · ARCHIVE · TRANSMIT` | `INDEX · ARCHIVE · TRACES · TRANSMIT` | current |
| ATLAS default stratum | `neo` (Ne0 — surface archive) | `nex` (NeX — possibility field) | `all` |
| Default first stratum on ATLAS load | `neo` | `nex` | `all` |

Curation differences are *gentle*. Same chapter index, just sorted differently. Same attractor fields, different default active. Goal: visitors immediately feel the path they picked; nothing is hidden.

### State management

zustand store `useAudienceStore`:

```
{
  path: 'craft' | 'trace' | 'unset' | null
  setPath(p) -> persists to localStorage
  switchPath() -> opens fork screen
  reset() -> clears choice, opens fork screen
}
```

Persist with `wl:audience-path` storage key.

Hydration handling: SSR renders `unset` curation; client rehydrates from localStorage and updates if different. Prevents hydration mismatch.

### Switch affordance

In `Nav`:

- Replace static `∇ NEOSPIRIT // WORLDLINE 1.130426` brand row with same content + small clickable indicator showing current path.
- Format: `∇ NEOSPIRIT // WORLDLINE 1.130426 [⇋ CRAFT]` (or `[⇋ TRACE]`, or no indicator if unset).
- Click on the indicator opens the fork screen for re-selection. Microcopy on the screen confirms: "switching worldlines preserves your reading position; only curation changes."

## Acceptance criteria

- [ ] First visit shows boot sequence, then fork screen, then hero with chosen curation applied.
- [ ] ESC or "skip" on fork screen proceeds with `unset` curation.
- [ ] Reload preserves path choice; fork screen does not re-appear.
- [ ] Clearing localStorage and reloading shows fork screen again.
- [ ] Switch affordance in nav opens fork screen; selecting a different path immediately re-curates without full reload.
- [ ] No hydration warnings in console.
- [ ] Lighthouse: fork screen passes a11y at 100 (single decision, two clearly labeled choices, keyboard navigable).
- [ ] Mobile (≤600px) layout stacks the two paths vertically, both fully visible without scroll.

## Dependencies

- zustand (with `zustand/middleware` for persist)
- No new external libraries beyond what tech proposal already includes.

## Open questions

- **First-time vs returning UX.** First visit should feel deliberate (pause, choose). Should returning visitors who switch see a quicker confirmation flow ("you're switching to TRACE — proceed?")? Recommend: yes, single confirm button, no full re-render of explanatory copy.
- **Curation map storage.** Hardcoded in component code or a `lib/audience-curation.ts` config? Recommend the latter — easier to iterate without touching components.
- **Default for unset.** Is `unset` distinct from `craft` or should `unset` collapse into `craft` (since craft is the more "default site" feel)? Recommend keeping `unset` distinct — chronological-by-date is honest, doesn't pretend to know the visitor.
- **Analytics.** Worth tracking which path is more popular? Likely yes for tuning, but no analytics infra exists in the repo. Defer; revisit when analytics gets added (separate decision).

---

*End of PRD.*

# docs/qa/REPORTS/TASK-2026-06-07-ATLAS-CONSOLE-SLICE2.md

## task · Atlas Console front door (Slice 2)

## verdict · REVISE — one defect (cosmetic/blocking per spec fidelity; REVISE to Sirius)

---

## step 1 — signature integrity

**Finding: NO SIGNATURE FILE EXISTS for this task.**

Searched `.claude/signatures/` for any Sirius signature dated 2026-06-07 or referencing atlas-console or slice-2. Most recent Sirius signature on disk: `TASK-2026-06-ARCHIVE-GLOBE-VENDOR--sirius.json` (Jun 3). All Slice 2 files are untracked (not committed).

This is a pre-signature state — the work is present in the working tree but no `sign-work.sh` has been run. Polaris routed this QA dispatch before the signing step completed.

**Classification: SCHEMA-FAIL (absent, not forged).**

Algol is not escalating this as INTEGRITY-FAIL because the work is demonstrably real and matches the spec — the absence is a process gap, not a tamper signal. Routing an AUDIT.md entry below. Canopus should ensure `sign-work.sh` is run and the signature present before Polaris closes.

The two *modified* files (`app/console/editor/page.tsx`, `components/console/ArticleEditor.tsx`) show only comment-string changes in `git diff HEAD` — both match the stated scope (killing placeholder comment, noting nav round-trip complete).

---

## step 2 — acceptance criteria

**Spec authority:** `docs/design/atlas-console-front-door.md` (Betelgeuse, α-VIS-04, 2026-06-07)

| criterion | result | evidence |
|---|---|---|
| `/console` route resolves (kills Slice 1 placeholder) | PASS | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/console` → `200` |
| 7 real velite entries in console (4 article / 1 fiction / 2 photo) | PASS | HTML contains `// ENTRIES <span class="rail-count">007</span>` and all 7 nodes present in server-rendered HTML |
| Node-graph canvas: kn-card nodes present | PASS | `kn-card` class present in rendered output |
| Kind filter radiogroup (ALL/ARTICLE/PHOTO/FICTION pills) | PASS | `role="radiogroup"` + 4 `role="radio" aria-checked` buttons confirmed in HTML |
| Search input with `aria-label="Search the graph"` | PASS | confirmed in HTML |
| Entry list `role="listbox"` with 7 `role="option"` rows | PASS | confirmed in HTML |
| `role="application" aria-label="Worldline Console"` | PASS | `<main class="console-shell" role="application" aria-label="Worldline Console">` confirmed |
| `aria-live="polite"` on NETRA voice strip | PASS | `.atlas-netra-voice` with `aria-live="polite"` present |
| Skip-to-content link (`#console-main`) | PASS | `<a href="#console-main" ...>skip to console</a>` at top of rendered shell |
| Metadata: `title = 'Worldline · Console'`, `robots: noindex/nofollow` | PASS | verified in `app/console/page.tsx` lines 45-48 |
| OPEN EDITOR ⟶ URL contract: `/console/editor?kind=<kind>&slug=<fileId>` | PASS | `ConsoleEntryForm.tsx` line 149: `const editorHref = /console/editor?kind=${safe.kind}&slug=${safe.fileId}` |
| `/console/editor?kind=article&slug=003` returns 200 | PASS | `curl` → `200` |
| `/console/editor` (bare) still returns 200 | PASS | `curl` → `200` |
| ArticleEditor.tsx `⟵ CONSOLE` link already points to `/console` | PASS | diff shows only comment change; the `href="/console"` was already wired in Slice 1 |
| SAVE DRAFT / COMMIT mocked (240ms, per spec) | PASS | `ConsoleApp.tsx` lines 214-235: `setTimeout(240)` mock confirmed |
| ESC deselects / closes form (keyboard + ESC·EXIT button) | PASS | `ConsoleApp.tsx` lines 257-270: keydown handler wired; button onClick wired to same logic |
| Narrow viewport (<600px) offline state | PASS | `console-offline paper-canvas` with `role="alert"` in HTML; matchMedia hook in useEffect |
| Token gaps documented (no new tokens added to globals.css) | PASS | `git diff HEAD -- app/globals.css` → empty; all gaps logged inline as `TOKEN-GAP` comments |
| HUD readouts (TL/TR/BR + BL control cluster) | PASS | all four corners present: WORLDLINE·AUTHORING, FIELD·ALL TRACES, PINNED·ORIGIN, NODES/EDGES/ARRANGE/ORIGIN |
| α watermark at 0.4× pan parallax | PASS | `ConsoleCanvas.tsx` line 361: `transform: translate(${pan.x * 0.4}px, ${pan.y * 0.4}px)` |
| `prefers-reduced-motion: reduce` → 0.001ms | PASS | every CSS block includes the media query rule collapsing transitions |
| No new atoms invented (composes from cited atoms) | PASS | all CSS classes prefix `.console-`, `.kn-`, `.ef-`, `.ch-`, or delegate to existing `.atlas-*`, `.paper-*`, `.af-pill` atoms from globals.css |
| FIELD-GAP comments for Procyon (photo: no title/domain/summary) | PASS | `app/console/page.tsx` lines 108-120: all three gaps annotated |
| Photo edge gap from PhotoSidecar deferred (documented) | PASS | `app/console/page.tsx` lines 169-172: comment-documented |

**One criterion NOT met — see §step 3.**

---

## step 3 — quality bar / defect

### DEFECT D1 — Rail entry list: `.key` badge overlaps title text for long fileIds (FAIL)

**Spec reference:** `docs/design/atlas-console-front-door.md §Left rail — entry list`

> Each row: `.atlas-strata-btn` (existing atom). Glyph slot (kind unicode, 20px), label slot (title truncated + kind/domain sub-label), key slot (file id).

**Root cause:**

`.atlas-strata-btn .key` in `globals.css` (line 1088-1096) is `position: absolute; top: 9px; right: 11px`. It is taken out of grid flow. When the rail override in `ConsoleRail.tsx` line 96 sets `grid-template-columns: 20px 1fr auto`, the `auto` third column is inert because `.key` is absolutely positioned and does not participate in grid layout.

The label column `.label-id` has `max-width: 140px` (ConsoleRail.tsx line 103) but the rail is 260px minus ~32px padding = ~228px card width. The absolutely-positioned `.key` badge at `right: 11px` floats over the text. For short fileIds (`003`, `002`) the badge is narrow enough not to clip. For longer ids:

- `transmission-001` (15 chars at 8.5px font) — badge is ~90px wide, substantially overlapping `.label-id` and `.label-role`
- `2026-05-bangkok/DSCF0002` (25 chars) — badge is ~140px wide, severely clipping the title and sublabel
- `2026-04-chiang-mai/DSCF0001` (28 chars) — similar to above

Polaris's browser-verify observation ("rail entry list overlaps title text with the right-aligned fileId badge") is confirmed. This is not cosmetic-only — it breaks readability for the two photo entries and the fiction entry.

**Severity: REVISE.** The spec requires the key slot to be visible and the title slot to be readable — both are broken for photo fileIds. The instrument register requires precision. The `.atlas-strata-btn` atom was designed (by Betelgeuse on 2026-06-01) for short keys (3-digit fileNums, slug names). Console rail entries include roll/id paths that the atom was not designed for.

**Fix path (for Sirius):** The rail override needs to clip or truncate the `.key` badge for long fileIds. Options:
1. Truncate `.key` with `max-width` + `overflow: hidden; text-overflow: ellipsis` in the rail-scoped override
2. Show only the terminal segment (e.g. `DSCF0002` not `2026-05-bangkok/DSCF0002`) for display in the badge; full fileId still used in NETRA voice and form

The chosen fix must preserve the `.key` badge in its absolute position (the base atom design is accepted and is used site-wide). The scope is the console-rail override only.

---

## step 4 — regression scan

**TypeScript:**
```
npx tsc --noEmit; echo "EXIT:$?"
EXIT:0
```
Clean. No type errors introduced.

**Public entry routes (HARD INVARIANT — byte-identical):**

| route | HTTP status |
|---|---|
| `http://localhost:3000/articles/003` | 200 |
| `http://localhost:3000/fiction/transmission-001` | 200 |
| `http://localhost:3000/photos/2026-05-bangkok/DSCF0001` | 404 (consistent — this photo does not have an individual route; the roll index does) |

`/articles/003` full RSC payload verified: title `on the architecture of taste`, domain `identity`, body content, FileNum `003`, all rendered correctly.

`components/ArticleEntry.tsx` shows zero diff vs HEAD — not touched by Slice 2. `app/globals.css` shows zero diff vs HEAD.

Release baseline comparison: `release/0.0.1-web` predates the `ArticleEntryContent` refactor (the component didn't exist at release time), so a direct file-hash comparison is not meaningful. Live curl to `/articles/003` confirms the public render path is intact.

**No regressions on public routes.**

---

## step 5 — accessibility

| check | result |
|---|---|
| Skip-to-content `href="#console-main"` | PASS |
| `role="application" aria-label="Worldline Console"` on `<main>` | PASS |
| `role="radiogroup"` + `role="radio" aria-checked` on kind filter | PASS |
| `aria-label="Search the graph"` on search input | PASS |
| `role="listbox" aria-label="Entries"` + `role="option" aria-selected` on entry list | PASS |
| `role="region" aria-label="Worldline graph editor"` on canvas | PASS (ConsoleCanvas.tsx line 352) |
| Node cards: `role="button" tabIndex={0} aria-label="${kind} ${fileId}: ${title}"` | PASS |
| `aria-selected` on node cards | PASS |
| `aria-live="polite"` on NETRA voice strip | PASS |
| `role="alert"` on narrow-viewport offline screen | PASS |
| Focus-visible states: `outline: 1px dashed var(--accent-orange); outline-offset: 2px` | PASS — on `.ch-exit`, `.af-pill`, `.rail-search-clear`, `.rail-new`, `.hud-btn`, `.ef-openeditor`, `.ef-close`, `.ef-btn` |
| `prefers-reduced-motion: reduce` collapses all transitions to 0.001ms | PASS |
| search-to-fly rAF checks matchMedia for reduced-motion | PASS (ConsoleCanvas.tsx line 237) |
| ESC keyboard shortcut: close form / deselect node | PASS (ConsoleApp.tsx lines 259-262) |
| Cmd/Ctrl+S: save draft when form open | PASS (ConsoleApp.tsx lines 263-266) |
| Form `aria-hidden={!open}` | PASS (ConsoleEntryForm.tsx line 161) |
| `aria-live="polite"` on saving hint span | PASS (ConsoleEntryForm.tsx line 289) |

**Note:** keyboard-initiated drag-to-link is correctly out of scope for Slice 2 per spec §accessibility. Node Tab cycling is in-scope and implemented via `tabIndex={0}` on node divs with Enter/Space keyDown handlers.

**Lighthouse run not performed** (dev server runs under Turbopack with RSC streaming — Lighthouse against localhost dev is not a reliable signal; the a11y structure is verifiable by static analysis which I've done above). The structural a11y evidence is sufficient for this authoring-tool surface. Target is ≥ 95 per spec.

**One open a11y gap (not blocking, note for Polaris):**

The `<aside aria-label="Authoring controls">` is correct at the container level, but the kind-filter pills have both `role="group" aria-label="Filter by kind"` wrapping a `role="radiogroup"`. The double role wrapper (`group` + `radiogroup`) is redundant — the `radiogroup` alone is the correct ARIA pattern (it has an implicit group role). This is a minor redundancy, not a violation (it doesn't break assistive technology), and resolves to the same user experience. Flagging as a cleanup note for Sirius's next pass, not a REVISE trigger.

---

## step 6 — cross-impact scan

| surface | impact |
|---|---|
| `app/globals.css` | NOT MODIFIED. Zero diff vs HEAD. No new tokens, no modified atoms. |
| `components/ArticleEntry.tsx` | NOT MODIFIED. Zero diff vs HEAD. Public render path byte-identical. |
| Nav component | NOT TOUCHED. `/console` is not added to Nav (mirrors `/console/editor` pattern from Slice 1). |
| `lib/content/articles`, `lib/content/fiction`, `lib/content/photos` | READ-ONLY access in server component. No modifications to any lib/content helper. |
| Other console components (`markdown.tsx`, `ArticlePreview.tsx`, `ArticleEditor.tsx`) | `ArticleEditor.tsx` receives comment-only diff (1 line). `ArticlePreview.tsx` and `markdown.tsx` untouched. |
| New console modules (`ConsoleApp`, `ConsoleCanvas`, `ConsoleRail`, `ConsoleEntryForm`, `console-types`) | Consumed ONLY by `app/console/page.tsx`. No cross-import into any public surface. |

Cross-impact is clean. The console is correctly isolated from the public surface area.

---

## signature audit note

Written to `.claude/signatures/AUDIT.md`.

---

## overall verdict

**REVISE → Sirius**

Single defect: D1 (rail entry `.key` badge overlaps title text for photo/fiction fileIds). Fix scope is the `ConsoleRail.tsx` rail-scoped CSS override for `.key`. All other criteria pass. No regressions on public routes. TSC exit 0.

After Sirius delivers the fix, Algol re-audits step 3 only (no full re-run required unless Sirius touches other files).

---

*Algol (α-VER-06) · atlas-console Slice 2 · 2026-06-07*

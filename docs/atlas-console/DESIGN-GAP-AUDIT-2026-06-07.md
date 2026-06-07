# atlas-console — design-vs-impl gap audit (2026-06-07)

> Polaris routing artifact. Source: workflow `atlas-console-design-gap-audit` (run `wf_fa6ede73-040`) — Comprehend → per-surface deep-compare → adversarial-verify → synthesize + completeness-critic. 15 agents, 6 surfaces, 21 verified gaps. Design ground truth = bundle `KeretyqRe4wLachVIgLv9Q` / `AmyMEJtQmj1VgPCGXILrrg` (byte-identical to `5a6Q9…` — the design did NOT change; gaps are impl-fidelity, not design drift).

## Headline
**Not a reimplementation — a high-fidelity port with a short polish list.** Zero critical, zero rebuilds, ONE major (decision-gated). The shipped Slice-1 editor + Slice-2 console front door are near-line-for-line ports. Most "missing" surfaces are correctly **scoped-deferred** (Slice 1.5 / Slice 3) or **do-not-build** (design-tool harness / dead exploration page). Chosen editor = **Direction C** (3 independent confirmations; A/B were exploration only). Soul register intact (paper-observatory; no SaaS drift).

## Surface verdicts
| surface | status | in-scope gaps | verdict |
|---|---|---|---|
| Console shell + rail + form | close | 2 | patch |
| Node-graph canvas | faithful | 1 (shared) | patch |
| tweaks-panel | faithful | 0 | keep (do-not-build) |
| article-editor-core | faithful | 2 | patch |
| editor multi-kind + entry chrome | stub | 0 | defer (Slice 1.5 / 3) |
| design-system tokens + atoms | close | 1 major | patch (decision) |

## IN-SCOPE actionable (the real gaps)
1. **[MAJOR · DECISION]** `af-pill` active state — rail kind-filter pill ships **orange-outline** active (`ConsoleRail.tsx:61`) where the catalogued prototype atom is **filled-ink** (`worldline-atoms.css:207`). Either match prototype (filled-ink) OR sanction orange-outline as intentional (orange = reserved active accent) with Peat/Betelgeuse sign-off. **Do not leave as silent drift.**
2. **[minor]** search-to-fly re-pan broken — `ConsoleApp.tsx:180` stable key `first.id+':'+first.id` killed per-keystroke re-centering; restore `Date.now()` (it's inside the effect → render-safe). *(gaps #1 & #4 = SAME bug, fix ONCE.)*
3. **[minor]** COMMIT hover missing `color: var(--paper-bright)` — `ConsoleEntryForm.tsx:110`.
4. **[minor]** pull-quote mark straight `"` → curly `“` (U+201C) — `markdown.tsx:121`.
5. **[minor]** preview body missing `> *:first-child { margin-top: 0 }` — `ArticlePreview.tsx` PREVIEW_CSS.

## No action — recorded intentional divergences
- **ESC·EXIT button closes an open form** (maps to spec's ESC-key semantics; prototype button only deselects) — defensible, keep.
- **PAGE mode read-only** (vs design contentEditable) — required by the byte-identical public-page HARD INVARIANT (Betelgeuse-gated). Revisit only if WYSIWYG prioritized (Slice 1.5+).

## Scoped-deferred (correctly absent — NOT failures)
- **Slice 1.5:** ◻ FULL PREVIEW overlay (desktop/mobile) · ▲ mocked PUBLISH/TRANSMIT panel · ImportZone + ↻ RE-IMPORT.
- **Slice 3:** kind switcher tabs (◆/◎/△) · PHOTO kind (frame manager + EXIF + film-sim + photo-entry preview) · FICTION kind (multi-chapter + DRAFT⇄SETTLED) · per-kind outline rail + provenance · `.ed-tb-file` 92px jitter-reserve (rides with the kind switcher).

## Do-not-build
- **tweaks-panel** — Claude-Design edit-mode HARNESS (self-labeled `@ds-adherence-ignore`, rounded-glass/blur/drop-shadow SaaS chrome = primary soul-reject). The 3 production knobs are correctly **baked** to settled defaults in ConsoleCanvas (straight edges, watermark on, labels-on-when-present). If runtime toggling is ever wanted, build it as an atom-composed instrument control, never the omelette harness.
- **⊞ DIRECTIONS link** — points at `Editor Directions.html`, the dead A/B/C exploration page. Correctly dropped.

## Betelgeuse DS-hardening (not critical path — pre-existing gaps the surface correctly inherited)
- Extract an unscoped base `.af-pill` atom into `globals.css` (mirrors `worldline-atoms.css:200-207`) so rail / archive filters / FilmSimSwitcher / EntryShell compose from ONE primitive (systemic fix for #1's divergence; sequence after the #1 decision).
- Add `--accent-orange-rgb` + `--paper-*-rgb` channel tokens (mirror `--ink-rgb`); refactor sub-0.18 accent tints + `--hud-btn-bg` + paper-tints off raw rgba (production globals.css carries this too).
- Promote recurring layout literals (rail 260px, outline 212px, node 158×70, header 54px, alpha-mark 280px) to spacing tokens on the next DS pass.

## Critic caveats (medium confidence)
- This is a **design-vs-prototype CODE comparison**. It did NOT fully cover **rendered-pixel / full-page-chrome / runtime** fidelity — the preview wraps `ArticleEntryContent` WITHOUT `EntryShell/Nav/MarginaliaHUD` (content fidelity ✓, "reads-as-published-page" ✗). If "ช่องโหว่เยอะ" was something seen **by eye**, a pixel/runtime pass is the next check.
- Not compared (judged scaffold/mount/DS-reference, descoped): `design-canvas.jsx` (974L Figma-like artboard, `@ds-adherence-ignore`), `editor-app.jsx`/`editor-standalone.jsx` (Directions comparison mounts), the 3 HTML mounts. Confirm the Directions comparison is deliberately descoped, not forgotten — it is (exploration scaffold).

## Risks
- **Duplicate-fix trap:** gaps #1 & #4 are the same `ConsoleApp.tsx:180` bug — fix once.
- **af-pill double-fix:** local patch (#1, Sirius) vs systemic base-atom extraction (Betelgeuse) target the same divergence — land the decision first, then extract.
- **Scope-creep:** every editor-kinds-entry "absence" is scoped-deferred; building any now manufactures premature work.
- **PUBLISH boundary:** keep mocked — real wiring touches the live-mutating-action gate + no-Peat-key-signing rule (unscheduled sub-project).

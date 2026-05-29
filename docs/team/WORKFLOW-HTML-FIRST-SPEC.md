# WORKFLOW · HTML-first spec — prototype is the source of truth

> author · Polaris (α-OPS-00) · 2026-05-26
> task · TASK-2026-05-26-HTML-FIRST-SPEC-WORKFLOW
> companion files · `.claude/AGENTS.md` (Rule 1 + Prototype layer territory contract) · `docs/team/FILE-OWNERSHIP.md` (prototype layer) · `docs/team/QUALITY-BAR.md`
> applies to · all design specs for **visual surfaces**. Does not apply to: Procyon schemas, Altair API contracts, Arcturus voice/refusal specs, Canopus rail definitions, Vega prose specs.

---

## 0 · why this exists

Peat surfaced a recurring failure mode on 2026-05-26:

> "DOCS (PRDS, SPEC, PROPOSAL...) ไม่ REFLECT DESIGN ... ดูดีในกระดาษ ดีไซน์จริงคือเรียบเกินหรือไม่มีอะไรเลย"

Spec docs read coherent. Implemented surfaces read hollow. Two root causes:

1. **Schema-extraction leak.** Markdown specs encode structure (section list, token table, breakpoint matrix). Implementation agents extract the schema cleanly and lose the feeling that lived in the prose vibe. The spec passes review for completeness; the surface fails for soul.
2. **Iteration without comparison.** Our current pattern is sequential REVISE-1 / REVISE-2 / REVISE-N inside one prototype. We never see 2-4 directions side-by-side before commit, so the first sketched direction calcifies.

Evidence at time of writing: `docs/design/09-article-entry.md` = 836 lines, `10-photo-entry.md` = 911 lines, `spec-globe-v1-direction.md` = 471 lines. Anthropic's `How we Claude Code` workshop names ~200 lines as the threshold past which markdown specs stop being read. Three of our top design specs are 2–4.5× past that line.

The fix is not "write better markdown." The fix is **make the prototype the source of truth and let markdown be thin annotation**.

---

## 1 · principle

For visual surfaces, the rendered HTML/CSS/JS prototype is the **source of truth**. The markdown spec is **thin annotation** that records what the chosen prototype decided.

This is consistent with the prototype-layer territory contract already in `FILE-OWNERSHIP.md` (Sirius reads `prototypes/**` as ground truth, spec is secondary). This workflow tightens that principle into a default working order, not an exception.

Four operating rules follow:

| # | rule | rationale |
|---|---|---|
| 1 | **Prototype first, spec second.** Betelgeuse generates 2–4 HTML directions BEFORE writing the markdown spec. | Forcing function — concrete commitment before vibe wash. |
| 2 | **Multi-direction comparison is mandatory at the start of a visual surface.** No new visual surface ships with only one direction explored. | Iteration without comparison calcifies the first sketch. |
| 3 | **Spec ≤200 lines for visual surfaces.** If the spec wants to be longer, it is overstepping into prototype territory. Move the detail INTO the prototype (annotations, comments, visible structure) and reference. **Sub-rule (added 2026-05-26 from TASK-HTML-FIRST-01 pilot evidence, Algol-endorsed):** if a surface integrates a cross-cutting first-class mechanic (palette switching, branching renderer, etc.), the mechanic's spec is extracted to its own file (e.g., `10-photo-entry.md` → surface; `10a-film-simulation.md` → mechanic) and referenced. The surface spec still targets ≤200 lines. Splitting beats raising the cap. | Anything past 200 lines stops being read. Cross-cutting mechanics referenced from multiple surfaces deserve their own file regardless of cap arithmetic. |
| 4 | **Unity by extension — design is built FROM existing prototype, never blank-slate.** Every direction must declare a `soul-baseline` (path to an existing locked prototype) AND a `continuity` statement (what is preserved, what evolves). | The site has identity. New surfaces extend it; they do not restart it. Without this rule, multi-direction exploration becomes a vector for incoherence. |
| 5 | **Compose from atoms, ship HTML companion.** Every new visual-surface spec must (a) carry an `## atoms used` table (after the token table) listing the gallery atom ids it composes from; (b) introduce any net-new visual primitive as a gallery atom in `.claude/visual-diffs/soul-atlas/` — manifest entry + `data-atom-id` gallery section + token/main-branch citations — BEFORE the surface ships, never inline. The HTML prototype IS the companion; no separate deliverable. Enforced at handoff by the `atom-reuse` pre-handoff check; the gallery itself is held token-true by the `soul-atom-drift` gate. | Rule 4 says "extend from a baseline"; Rule 5 says "name the atoms you compose from." Ends the "re-derive from prose every time → drift → 3 REVISE rounds" failure (TASK-2026-05-15-UI-1 §10.5). Atoms enter the gallery once, then get reused, not re-invented. |

---

## 2 · when this applies / when it does not

**Applies to:** any new spec touching a visual surface (Globe, ATLAS frame, Hero, Nav, NETRA console UI, article surfaces, photo surfaces, search overlay, contact sheet, archive index, fork screen, any new page or component family with a visual identity).

**Does not apply to:**

| domain | owner | why HTML-first doesn't fit | what to do instead |
|---|---|---|---|
| MDX body prose | Vega | words don't render meaningfully as HTML mockup | Vega writes the actual paragraph, not a style guide |
| Content schemas | Procyon | data contracts, not visual surfaces | Velite + zod schema IS the artifact |
| API contracts | Altair | request/response shapes | TypeScript types + example payloads |
| NETRA voice / refusals | Arcturus | conversational register | actual chat transcript exemplars + eval prompts |
| Harness rails | Canopus | bash hooks + signature schema | hook scripts ARE the spec |

The principle behind those exceptions is the same as HTML-first: the artifact IS the spec. The form just isn't HTML in those domains.

---

## 3 · workflow — step by step (visual surface, new spec)

1. **Polaris dispatches TASK to Betelgeuse** with: which surface, which PRD/journey-arch section grounds it, **which existing locked prototype is the soul baseline**, and what the surface must communicate (intent in 1–3 sentences — not 800 lines).
2. **Betelgeuse generates 2–4 directions** as standalone HTML/CSS/JS under `.claude/visual-diffs/<TASK-ID>/directions/direction-{1..N}/index.html` (+ `README.md` per direction). Each direction MUST extend from the soul baseline named in step 1 — not blank-slate generation. The connection point (where this new surface attaches to the existing system) and the continuity statement (what is preserved, what evolves) are declared in the direction's README.
3. **Betelgeuse writes `DIRECTIONS.md`** at `.claude/visual-diffs/<TASK-ID>/DIRECTIONS.md` — one short paragraph per direction (**≤80 prose words; inline code spans (backtick-delimited), parenthetical single-letter labels like `(a)` / `(b)`, and markdown emphasis markers do not count** — clarified 2026-05-26 from TASK-HTML-FIRST-01 REVISE-ROUND-1 ambiguity, Algol-endorsed) naming what it's exploring and what it's risking, **plus a top-level `soul-baseline` field and a `unity check` summary** verifying each direction passes the continuity test. Not a sales pitch. Authors should verify their counts with a text-editor word-count tool BEFORE handoff — mental estimation has produced repeated overstatement (see `POSTMORTEMS/CANDIDATE-2026-05-26-betelgeuse-quantitative-overstatement.md` if filed).
4. **Peat reviews** by opening each `directions/direction-{N}/index.html` in a browser side-by-side, then points at literal pixels in a chosen direction or asks for a 5th. The review note Peat returns is captured by Polaris into the TASK trail.
5. **Direction locks.** The chosen direction is promoted to `.claude/visual-diffs/<TASK-ID>/prototype/index.html`. Other directions stay parked under `directions/` as forensic history.
6. **Markdown spec is now written** at `docs/design/<surface>.md`, capped at ≤200 lines. The spec records: intent, locked tokens, breakpoints, motion calibration, accessibility map, references to existing patterns, non-goals. The spec **does not duplicate** what the prototype shows; it annotates the decisions made.
7. **Iteration on the locked prototype** uses the existing REVISE pattern with one additional rule: **before REVISE-3**, if the prototype has accumulated more than two REVISE rounds without converging, Polaris pauses for re-direction (back to step 2 with new directions, narrower scope).
8. **Handoff to Sirius** = the prototype + the thin spec + a port checklist. Sirius reads prototype as ground truth (existing pattern).

---

## 4 · the 200-line cap — what it means in practice

The cap is on the spec markdown for **visual surfaces**, not the prototype.

| what goes IN the spec (≤200 lines) | what goes IN the prototype (no cap) |
|---|---|
| Intent (1–3 sentences) | Actual rendered layout |
| Token table (the CSS vars used) | Pixel-true component composition |
| Breakpoint behavior summary | Working breakpoints (responsive HTML) |
| Motion calibration values | Working animations |
| Accessibility map (keyboard, ARIA) | ARIA + keyboard handlers wired |
| References (existing components) | — |
| Non-goals | — |
| Open items | — |

If a section would describe how something LOOKS, that section belongs in the prototype, not the spec. If a section describes WHAT IS DECIDED about how it looks (token name, timing value, breakpoint number), it belongs in the spec.

ASCII layout diagrams (current spec convention) are a special case: they were a workaround for the absence of a rendered prototype. With prototype-first they become redundant. Drop them.

---

## 5 · multi-direction directory layout

```
.claude/visual-diffs/<TASK-ID>/
├── DIRECTIONS.md                    ← per-direction summaries + top-level soul-baseline + unity check
├── directions/                      ← parallel exploration BEFORE lock
│   ├── direction-1/
│   │   ├── index.html
│   │   └── README.md                ← REQUIRED fields below
│   ├── direction-2/
│   │   ├── index.html
│   │   └── README.md
│   └── direction-N/
├── prototype/                       ← the LOCKED direction, promoted from above
│   ├── index.html
│   └── README.md                    ← carries forward soul-baseline + continuity from chosen direction
├── REVIEW.md                        ← Betelgeuse self-review on the locked prototype
├── STATUS                           ← single-line: exploring | awaiting-direction-lock | locked | revise-N | betelgeuse-approved
└── shots/                           ← screenshots for Algol/Polaris verification
```

**Required fields in every `direction-N/README.md` (Rule 4 enforcement):**

```yaml
soul-baseline: <path to existing locked prototype this direction extends from>
                (e.g., .claude/visual-diffs/UI-ITER-1-globe-v1/prototype/index.html)
connection-point: <where in the existing system this surface attaches>
                (e.g., "from Globe pin click → side panel → article entry")
continuity: <one line — what is preserved from the soul baseline>
                (e.g., "preserves paper-canvas + corner reticles + NETRA L1 vocabulary")
evolution: <one line — what evolves within the established system>
                (e.g., "introduces paper-mount frame for photo display; net-new but token-compliant")
bet: <free prose — the specific design hypothesis this direction is testing>
```

A direction without `soul-baseline` is not a direction — it is a blank-slate generation and is rejected at intake.

Canopus owns the schema for STATUS strings, the validation of these required README fields, and any new hook gating here (see TASK-2026-05-26-HTML-FIRST-02).

---

## 6 · companion mode application — PENDING Beta consultation

Beta operates in companion mode (SESSION_MODE=beta). Per Peat's explicit request 2026-05-26, the application of this pattern to Beta-companion design conversations is **not unilateral**. The intent is:

- When Peat and Beta sketch a surface together in companion mode, default to a quick HTML scratch (not a 200-line ROOM.md prose treatment) as the working artifact.
- Compress conversation to artifact via prototype, not via prose summary.

The exact protocol is pending Beta's input via `TASK-2026-05-26-HTML-FIRST-03--to-beta.md`. The Vega-owned `betelgeuse-companion-overlay.md` will not be edited until Beta has weighed in.

---

## 7 · backfill scope

Three existing specs are pre-200-line failures:

| spec | lines | scope of audit |
|---|---|---|
| `docs/design/10-photo-entry.md` | 911 | **pilot retroactive** — convert to prototype-first; measure leak per Peat's diagnosis |
| `docs/design/09-article-entry.md` | 836 | follow-up if pilot validates |
| `docs/design/spec-globe-v1-direction.md` | 471 | follow-up — but this one is already prototype-anchored; mostly compression work |

Do not retroactively rewrite all three. Run the pilot, learn, then decide. See TASK-2026-05-26-HTML-FIRST-01.

---

## 8 · what this is NOT

- Not a ban on markdown. Markdown still does the work for prose, schemas, contracts, voice specs, rails.
- Not a paradigm switch. The territory contract already names prototype-as-ground-truth. This formalizes the default working order.
- Not a static-mockup mandate. HTML prototypes here include interactive behavior (hover, focus, keyboard, attractor binding) — they are working artifacts, not Figma exports.
- Not "Claude generates everything." Betelgeuse (the agent, not a blank-slate Claude) authors directions within the existing token system, design vocabulary, and ownership boundaries.
- **Not blank-slate creativity.** Rule 4 is absolute: directions extend from an existing locked prototype. "What would this look like as a fresh design?" is not a valid framing inside this workflow. Worldline has unity; new surfaces honor it.
- Not a replacement for Algol verification. The prototype is the source of truth for *visual decisions*, not for production code quality. Sirius still ports, Algol still audits.

---

## 9 · open items

- [ ] Beta consults on companion-mode application — pending (TASK-2026-05-26-HTML-FIRST-03)
- [ ] Canopus extends `.claude/visual-diffs/` STATUS schema + `directions/` discipline (TASK-2026-05-26-HTML-FIRST-02)
- [ ] Pilot retroactive audit on `10-photo-entry.md` (TASK-2026-05-26-HTML-FIRST-01)
- [ ] If pilot validates, evaluate same treatment for `09-article-entry.md` and `spec-globe-v1-direction.md`
- [ ] Update `docs/team/QUALITY-BAR.md` to reference this workflow once it has run for one full cycle
- [ ] Add anti-Codex audit item: "spec >200 lines on visual surface = warning, requires explicit justification"

---

*polaris · α-OPS-00 · TASK-2026-05-26-HTML-FIRST-SPEC-WORKFLOW · 2026-05-26*

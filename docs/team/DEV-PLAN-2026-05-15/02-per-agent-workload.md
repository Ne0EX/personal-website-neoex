# DEV-PLAN 2026-05-15 · section B · per-agent workload view

> **section author** · Polaris-B (parallel instance B of 4 Polaris siblings)
> **scope** · per-agent view of incoming work, parked queue, parallelism, handoff edges, signature audit notes
> **cross-refs** · section A (TASK breakdown by PRD — placeholder IDs TASK-15+ live there); section C (sequencing/timeline); section D (root synthesis)
> **basis** · in-flight `TASK-09` (β article), `TASK-10` (γ photo+atlas), `TASK-11` (δ NETRA) per `docs/team/STATUS.md`; candidate `TASK-14` (AttractorFields ↔ Globe binding mechanic) per journey-arch §1-M6 and §13

---

## section B · per-agent workload view

### sirius · α-SUR-01 · Frontend Engineer
**territory:** `app/**/*.tsx`, `components/**/*.tsx`, `components/**/*.ts`, `**/*.module.css`, `lib/client-state/**`
**incoming (after current commit):**
- TASK-15 · scaffold article entry route + components against β spec · sonnet · blocked_by TASK-09 (Betelgeuse spec) · L
- TASK-16 · scaffold photo entry route + roll route + Globe square-glyph extension · sonnet · blocked_by TASK-10 · L
- TASK-17 · NETRA chat drawer UI implementation against δ-S2 spec · sonnet · blocked_by TASK-11 (Betelgeuse S2) + TASK-19 (Altair `/api/chat` shell) · M
- TASK-18 · Nav stratum-indicator wiring per journey-arch §3.6 · sonnet · blocked_by nothing · S
- TASK-20 · off-canvas pin list for keyboard a11y per journey-arch §2.5 · sonnet · blocked_by nothing · S
- TASK-21 · `/atlas` mobile route + ATLAS · STANDBY placeholder card per §7.2-7.3 · sonnet · blocked_by Betelgeuse mobile prototype report · M
- TASK-22 · hover-preview tooltip + side-panel two-step entry · sonnet · blocked_by TASK-15 close · S
**parked (will be opened later):**
- TASK-14 candidate (AttractorFields ↔ Globe two-way binding) Sirius slice — pulls in Globe state plumbing
- search overlay implementation (next wave after δ closes)
- boot revisions (10/11/12 from Claude Design stages) — own wave
- fiction entry route (deferred per §3.4; trigger: 3+ fiction pieces OR newcomer testing fails)
**parallelism slots:** 3 concurrent Sirius instances safe — partition by route surface (entry routes / Globe extensions / chat drawer). Avoid: two instances editing `WorldlineGlobe.tsx` simultaneously (single-file collision risk).
**handoffs received from:**
- Betelgeuse · design spec for any new surface (β/γ/δ-S2 specs)
- Procyon · velite schemas + sample frontmatter for new content types
- Altair · API contract for `/api/chat`, server-action signatures
- Arcturus · stable `lib/netra/` exports (consumed via import)
**handoffs sent to:**
- Algol · post-edit clean signal → triggers QA pass
- Betelgeuse · visual-diff capture request when surface lands
- Altair · server-action need (with `// server-action: altair` marker)
**signature requirements:** standard — Algol audits diff against `files_touched`; territory rail enforces no `app/api/**` or `app/globals.css` writes. Heaviest audit volume on the team (largest territory).

---

### altair · α-BND-02 · Backend Engineer
**territory:** `app/api/**`, `lib/server/**`, `middleware.ts`, `'use server'` blocks marked `// server-action: altair`
**incoming (after current commit):**
- TASK-19 · `/api/chat` route handler shell (validation, rate limit, response shape, streaming pass-through) · sonnet · blocked_by TASK-11 δ-S1 (Arcturus prompt + tool exports) · M
- TASK-23 · rate-limit middleware tuning + `α drift exceeded` 429 response shape · sonnet · blocked_by TASK-19 · S
- TASK-24 · `/api/search` thin endpoint over Pagefind index (next wave) · sonnet · blocked_by Pagefind index build (Procyon) · S
**parked (will be opened later):**
- form-submission endpoints if Peat adds contact/transmit forms
- any auth surface (none planned for v1)
**parallelism slots:** 2 concurrent Altair instances safe — partition by endpoint family (chat vs search). Single endpoint = single instance to avoid route-shell collisions.
**handoffs received from:**
- Arcturus · stable `lib/netra/` exports (prompt builder, tool defs) for import into chat route
- Polaris · rate-limit policy decisions, response-shape arbitration
**handoffs sent to:**
- Sirius · API contract document for `/api/chat` (request body, streaming chunks, error shape)
- Algol · post-edit clean → contract test suite
**signature requirements:** Algol verifies (a) every `'use server'` block in Sirius files that Altair touched carries the marker; (b) input validation present on every endpoint; (c) rate-limit hook wired. Contract tests required before close.

---

### procyon · α-IDX-03 · Data Engineer
**territory:** `content/**` (frontmatter only for MDX bodies), `velite.config.*`, `scripts/process-photos.ts`, `scripts/generate-feeds.ts`, `scripts/migrate-*.ts`, `lib/content/**`, `docs/data/**`
**incoming (after current commit):**
- TASK-25 · velite schema extension for `kind: 'article'|'photo'|'fiction'` discriminator per journey-arch §2.2 · sonnet · blocked_by nothing · S
- TASK-26 · photo EXIF pipeline + film-sim derivation + variants build · sonnet · blocked_by TASK-10 contract · M
- TASK-27 · Pagefind index build wiring (for search overlay future TASK) · sonnet · blocked_by nothing · S
- TASK-28 · fiction frontmatter schema (diamond glyph metadata) · sonnet · blocked_by nothing · S
**parked (will be opened later):**
- `--font-thai` wiring + Thai variant for article-01B (deferred per §9 row 01B)
- RSS/Atom feed generation expansion
- migration script if content reorganization is needed
**parallelism slots:** 2 concurrent Procyon instances — partition by content type (photos vs articles vs fiction). Velite config is single-file so schema-extension TASKs serialize.
**handoffs received from:**
- Vega · body content for new MDX (co-sign pattern on new entries)
- Polaris · schema decisions when ambiguity in PRDs
**handoffs sent to:**
- Vega · file shells with frontmatter ready for body fill
- Sirius · TypeScript types from velite-generated cache
- Altair · query helpers for Pagefind index
**signature requirements:** Algol verifies (a) no body prose in Procyon's diffs (Vega territory), (b) zod schema changes carry compat notes, (c) `lib/content/**` exports remain stable contracts.

---

### betelgeuse · α-VIS-04 · UX/UI Designer
**territory:** `app/globals.css`, `tailwind.config.*` (tokens only), `docs/design/**`, `.claude/visual-diffs/<task_id>/REVIEW.md`
**incoming (after current commit — current commit closes TASK-09/10/11 spec authorship):**
- TASK-29 · mobile prototype validation + responsive lock-in (≤880 / ≤600 / ≤375 specs) per journey-arch §7 delegation · sonnet (escalation to opus on request) · blocked_by nothing · L
- TASK-30 · visual-diff REVIEWs for Sirius implementations of TASK-15/16/17 · sonnet · blocked_by each Sirius post-edit-clean signal · M
- TASK-31 · empty/loading state spec (checkered film-leader) per §9 row 03 revision N2 · sonnet · blocked_by TASK-10 close · S
- TASK-32 · TASK-14 binding mechanic visual spec (AttractorFields ↔ Globe highlight) · sonnet → opus if scope expands · blocked_by Polaris green-light · M
**parked (will be opened later):**
- boot revision wave (stages 10/11/12) — needs Polaris to open
- search overlay visual spec
- token system expansion (deferred; no new tokens this wave per Polaris constraint)
- fiction entry surface visual spec (deferred per §3.4)
**parallelism slots:** 3 concurrent Betelgeuse instances during the design wave — one per surface (β/γ/δ-S2 already shipped; future fan-out: mobile prototype + binding-mechanic + visual-diff reviews can all run in parallel because output files don't collide: `docs/design/<distinct>.md` + `.claude/visual-diffs/<distinct-task>/REVIEW.md`).
**handoffs received from:**
- Polaris · per-task opus escalation grants (Betelgeuse authorized for per-task opus on journey-architecture-tier work)
- Sirius · post-edit clean + visual-diff bundle for REVIEW
- Vega · copy proposals for any header strip text changes
**handoffs sent to:**
- Sirius · design spec for implementation (the load-bearing handoff)
- Polaris · REVIEW verdicts (ADOPT / ADOPT-WITH-REVISION / REINVENT / DISCARD)
- Vega · request for copy on new visual atoms
**signature requirements:** Algol verifies (a) no `.tsx` writes in Betelgeuse diffs (Sirius territory); (b) any `globals.css` change carries token rationale; (c) visual-diff REVIEW.md is signed alongside the design diff.

---

### arcturus · α-NET-05 · AI Engineer
**territory:** `lib/netra/**`, `lib/netra/prompts/**`, `lib/netra/tools/**`, `docs/netra/**`, `tests/netra/eval-prompts.md`, `scripts/eval-netra.ts`
**incoming (after current commit):**
- TASK-11 δ-S1 · in-flight · NETRA system prompt + tool definitions + refusal taxonomy + Globe-state context injection · **opus** (per-task escalation justified by voice-load-bearing) · M
- TASK-33 · eval suite expansion · runs against new prompt revisions · sonnet · blocked_by TASK-11 δ-S1 close · S
- TASK-34 · `search_entries` tool implementation over Pagefind cache · sonnet · blocked_by Procyon TASK-27 · S
**parked (will be opened later):**
- voice-line additions for new Globe states (empty-stratum, error) — δ-Betelgeuse callout
- multi-turn refusal patterns refinement after first round of real eval data
**parallelism slots:** 1 — Arcturus is a single-instance role. The prompt is one document; the eval suite reads it. Splitting risks voice drift. Concurrent eval-script work + prompt revision OK if Polaris partitions explicitly.
**handoffs received from:**
- Polaris · PRD-05 clarifications, opus escalation grants
- Vega · prose review of system-prompt revisions (Vega has sign-off on NETRA voice copy)
- Algol · eval failure reports
**handoffs sent to:**
- Altair · stable `lib/netra/` exports + import surface contract
- Betelgeuse (δ-S2) · context-injection mechanism + tool-call status-line shape for chat UI rendering
- Algol · eval suite to run on every prompt change
**signature requirements:** Algol verifies (a) eval suite ran clean on every prompt revision; (b) refusal taxonomy coverage in tests; (c) no route-handler edits in Arcturus diffs (Altair territory).

---

### algol · α-VER-06 · QA
**territory:** `tests/**` (except `tests/netra/eval-prompts.md`), `tests/harness/**`, `.claude/signatures/AUDIT.md`, `scripts/audit-*.ts`, `docs/qa/**`
**incoming (after current commit):**
- TASK-35 · post-edit verification + signature audit pass for every TASK-15..22 close · sonnet · blocked_by each post-edit-clean signal · ongoing
- TASK-36 · a11y regression suite (Lighthouse ≥95 on entry surfaces, off-canvas pin list keyboard reach, reduced-motion compliance) · sonnet · blocked_by TASK-15/16 close · M
- TASK-37 · reduced-motion E2E pass (§7.4 pinch-zoom flag + §2.5 motion contracts) · sonnet · blocked_by mobile prototype lock-in · S
- TASK-38 · NETRA eval runner audit script · sonnet · blocked_by TASK-33 · S
- TASK-39 · contract tests for `/api/chat` + `/api/search` · sonnet · blocked_by TASK-19/24 · M
**parked (will be opened later):**
- visual-regression suite (post-Betelgeuse REVIEW automation)
- perf budget audits (Lighthouse perf, not just a11y)
**parallelism slots:** 2-3 concurrent Algol instances — Algol is verification, not authorship, so multiple audit passes against distinct TASKs are naturally parallel. Same-TASK double-audit not useful.
**handoffs received from:**
- every other agent · post-edit-clean + signature
- Canopus · harness changes that affect audit infrastructure
**handoffs sent to:**
- Polaris · REVISE recommendation when acceptance fails
- the failing agent · REVISE handoff with specific items
- Canopus · hook proposal when recurring issue surfaces (Algol-finds-pattern → Canopus-codifies-hook)
**signature requirements:** Algol *is* the audit. Algol's own signatures audited by spot-checks Polaris runs against signature schema; Canopus also reviews any change to `scripts/audit-*.ts` for harness compatibility.

---

### canopus · α-HRN-07 · Harness Engineer
**territory:** `.claude/hooks/**`, `.claude/signatures/SCHEMA.md`, `.harness/**`, `scripts/audit-*.sh`, `scripts/visual-capture.sh`, `scripts/fetch-design-bundle.sh`, `.github/workflows/**`, `docs/harness/**`, `eslint.config.mjs`, `.gitignore` (harness section), `.claude/agents/*.md` YAML frontmatter only
**incoming (after current commit):**
- TASK-13 · in-flight · harness hardening (rails for stratum-indicator, territory enforcement, visual-diff capture stability)
- TASK-40 · CI pipeline wiring for E2E test runs (collab with Algol) · sonnet · blocked_by Algol's E2E suite landing · M
- TASK-41 · hooks for new agent surfaces (chat drawer visual-diff capture target) · sonnet · blocked_by TASK-17 close · S
- TASK-42 · signature schema rev for tool-call audit fields (NETRA tool results) · sonnet · blocked_by TASK-11 δ-S1 close · S
**parked (will be opened later):**
- workflow concurrency improvements
- harness telemetry / dashboard (`STATUS.md` could be auto-generated)
**parallelism slots:** 2 concurrent Canopus instances — partition by surface (hooks vs CI vs schema). Same-file edits in `.claude/hooks/*.sh` serialize.
**handoffs received from:**
- Algol · "recurring issue → please codify as hook" proposals
- Polaris · roster changes (frontmatter rev), schema-evolution requests
**handoffs sent to:**
- every agent · new hook = new contract; agents read but don't write hook files
- Vega · prose-review request for any `.claude/agents/*.md` frontmatter change that touches `description` (Vega sign-off required on description prose)
**signature requirements:** Canopus *signs the harness*. Algol audits Canopus's diffs for (a) hook scripts pass shellcheck, (b) schema changes are backward-compat or migration-noted, (c) no agent-prose edits in Canopus diffs (territory split: frontmatter only).

---

### vega · α-VOX-08 · Chief Editor
**territory:** body of `content/articles/**/*.mdx`, body of `content/fiction/**/*.mdx`, `content/photos/**/_meta.yml` captions, `docs/voice/**`, `lib/copy/**`. **Sign-off authority** (not write) over: NETRA prompt prose, `.claude/agents/*.md` prose bodies, `.claude/AGENTS.md` prose, Polaris task description prose.
**incoming (after current commit):**
- TASK-43 · article entry copy (header readouts, patches-log labels, related-branches CTA microcopy) per β spec · sonnet · blocked_by TASK-09 close · S
- TASK-44 · photo entry copy (instrument-readout labels, `[match palette to CLASSIC CHROME · ⌃P]` toggle copy, roll-context strip labels) per γ spec · sonnet · blocked_by TASK-10 close · S
- TASK-45 · NETRA chat header + composer rate-limit pill copy + refusal-chip `[← back to ATLAS]` copy · sonnet · blocked_by TASK-11 close · S
- TASK-46 · sign-off pass on Arcturus's system-prompt revisions · sonnet · blocked_by TASK-11 δ-S1 · S
- TASK-47 · empty-stratum NETRA voice line + Globe `// observatory offline` error copy · sonnet · blocked_by nothing · S
**parked (will be opened later):**
- README.md repo-root revision (cross-cutting; Polaris approves)
- Thai voice register guide (waits for `--font-thai` wiring TASK to land)
- ongoing body-content fills as new entries are added (co-sign pattern with Procyon)
**parallelism slots:** 2-3 concurrent Vega instances — naturally parallel because each TASK targets a different copy surface (article / photo / chat / voice). MDX body fills serialize on a single content file.
**handoffs received from:**
- Procyon · file shell with frontmatter, body empty, ready for fill
- Arcturus · prompt revision for prose sign-off
- Betelgeuse · ask for copy on new visual atoms (header readouts, etc.)
- Polaris · task descriptions for prose review
**handoffs sent to:**
- Procyon · co-sign on new content entries
- Arcturus · sign-off verdict + line-level edit proposals on prompt prose
- Polaris · proposed edits to task documents (Polaris accepts/rejects)
- Betelgeuse · finalized microcopy for implementation
**signature requirements:** Algol verifies (a) Vega's diffs are body-only (no frontmatter edits — Procyon territory); (b) sign-off TASKs produce a verdict in `docs/voice/sign-offs/` or equivalent, not silent merges; (c) no direct writes to NETRA prompts (handoff-only authority).

---

## section B.2 · agent collaboration map

Where two or more agents must coordinate on a single TASK:

| TASK | agents | coordination shape |
|---|---|---|
| TASK-11 (δ in-flight) | Arcturus (S1 prompt) + Betelgeuse (S2 chat UI) + later Sirius (TASK-17 implementation) + Altair (TASK-19 route shell) | four-way contract: Arcturus exports prompt/tools → Altair consumes in route shell → Sirius wires UI → Betelgeuse reviews visual diff. Polaris arbitrates contract shape if any pair disagrees. |
| TASK-14 candidate (AttractorFields ↔ Globe binding) | Betelgeuse (visual spec) + Sirius (implementation, touches `WorldlineGlobe.tsx` + `AttractorFields.tsx`) + Procyon (tag-cluster query helpers if needed) | three-way. Highest collision risk because Sirius edits Globe — must serialize against any other Globe-touching TASK. Polaris gates open. |
| TASK-15/16 (article + photo entries) | Betelgeuse (spec) → Sirius (build) → Algol (a11y/visual-diff review) → Vega (copy fills) → Betelgeuse (visual-diff REVIEW) | five-station relay. Standard β/γ pattern. Procyon supplies content shape upstream. |
| TASK-19 (`/api/chat` shell) | Altair (route handler) + Arcturus (prompt/tool imports) + Algol (contract tests) | three-way. Boundary enforced by `// server-action` markers and import contracts. |
| E2E pipeline TASK (TASK-37 + TASK-40) | Algol (test authorship) + Canopus (CI wiring + hook integration) | tight collab — Algol writes the TS suites, Canopus writes the bash wrappers and workflow YAML. Clean split by file extension. |
| TASK-21 (`/atlas` mobile route) | Betelgeuse (prototype-validated spec) + Sirius (implementation) + Algol (mobile a11y pass) | three-way, gated on Betelgeuse's mobile prototype report (per journey-arch §7 delegation). |
| Any new content entry | Procyon (frontmatter + file shell) + Vega (body prose) | co-sign pattern — both signatures on the same TASK. |
| Any `.claude/agents/*.md` revision | Canopus (frontmatter) + named agent (prose body) + Vega (sign-off) | three-way; split ownership encoded in FILE-OWNERSHIP.md. |

---

## section B.3 · capacity bottlenecks

**Most TASKs queued:** Sirius (7 incoming + 4 parked) — natural consequence of largest territory and being the consumer of every design/data/AI handoff. Mitigation: parallel Sirius instances on non-overlapping route surfaces; serialize only the Globe-touching slices.

**Critical-path single-threading:** Arcturus. Single-instance role by design (voice drift risk); `lib/netra/` is the choke point for TASK-11 δ-S1 → TASK-19 (Altair route shell) → TASK-17 (Sirius chat UI) → TASK-45 (Vega chat copy) → TASK-38 (Algol eval audit). The entire NETRA fan-out blocks behind Arcturus closing δ-S1.

**Second bottleneck:** Betelgeuse on mobile-prototype TASK-29. Multiple downstream TASKs (TASK-21 `/atlas` route, TASK-30 visual-diff reviews of mobile breakpoints, TASK-31 empty-state spec, Algol mobile a11y pass) all wait on Betelgeuse's prototype report. Recommend Polaris explicitly grants per-task opus escalation to compress.

**Third bottleneck:** the Globe file (`components/WorldlineGlobe.tsx`). Single-file collision risk between TASK-16 (γ square-glyph extension), TASK-20 (off-canvas pin list), TASK-22 (hover preview), and the eventual TASK-14 binding mechanic. Polaris must serialize Globe-touching Sirius work; cannot run 2× Sirius on this file even though Sirius parallelism slot is 3.

**Lowest-loaded:** Altair (3 incoming, mostly small) and Canopus (3 incoming) — both serve as enablers; their bandwidth absorbs surge demand from QA/test pipeline buildouts.

**Algol load shape:** ongoing rather than bursty — every other agent's close triggers an Algol audit. Recommend 2-3 concurrent Algol instances rotating across the audit queue rather than serializing.

---

*end of section B · per-agent workload view · Polaris-B*

# File Ownership — Territory Map

> The team's territorial contract. Each path glob has exactly one owner. Owners are the only agents who write to their paths. Everyone reads everything.
>
> This file is referenced by `pre-task.sh` (lists each agent's territory at task start) and by the harness `territory` rail (audits diffs against this map). Polaris owns this file and updates it when roster or scope changes.

---

## How to read this file

Each agent's block starts with `## <codename> ·` followed by their role. Inside the block:

- Lines starting with `- ` declare territory globs (path patterns the agent owns)
- Lines starting with `> ` are clarifying notes
- Lines starting with `!` are explicit exclusions (path patterns this agent does NOT own, even though they look like they might)

If a path matches no agent's territory, it is **unassigned** and writing to it requires a handoff to Polaris to assign ownership first. (Common case: a new feature surface that doesn't fit existing patterns. Polaris either assigns it to an existing agent or proposes a roster change.)

---

## polaris · α-OPS-00 · Product Manager

- `.claude/handoffs/from-polaris/**`
- `.claude/AGENTS.md`
- `docs/team/WORKFLOW.md`
- `docs/team/WORKFLOW-*.md` (workflow protocol docs — added 2026-05-26 for WORKFLOW-HTML-FIRST-SPEC.md)
- `docs/team/FILE-OWNERSHIP.md`
- `docs/team/STATUS.md`
- `PRODUCT.md`
- `.impeccable/**`
- `docs/team/POSTMORTEMS/**`
- `docs/team/RETRO-*.md`

> Polaris never writes outside this list. If her signature shows changes to code or design or content files, that is a P4 violation and a postmortem trigger against Polaris herself.

---

## sirius · α-SUR-01 · Frontend Engineer

- `app/**/*.tsx`
- `app/**/*.ts` (page-level utilities only — server actions get a `// server-action: altair` comment marker)
- `components/**/*.tsx`
- `components/**/*.ts`
- `components/**/*.css` (component-scoped production styles; global token definitions remain Betelgeuse territory)
- `**/*.module.css` (co-located with components; Tailwind preferred)
- `lib/client-state/**` (if/when adopted)
- `tools/factory/**`

> `tools/factory/**` is the soul-factory dashboard (Phase 2): vendored tracker prototype (React UMD, no bundler) adapted to fetch `.harness/factory/build/dashboard.json`. Team-infra — never merged to main, never deployed. The local server `scripts/factory/serve.mjs` is Procyon's.

! `app/api/**` — Altair
! `app/globals.css` — Betelgeuse
! `lib/netra/**` — Arcturus
! `prototypes/**` — Betelgeuse owns; Sirius CANNOT write (clean ownership; prevents accidental "shortcut" where Sirius edits the prototype instead of porting properly)
! `docs/design/prototypes/**` — Betelgeuse owns; Sirius reads as visual reference only
! `.claude/visual-diffs/**/prototype/**` — Betelgeuse owns; Sirius reads as source of truth only

> Server actions inside `app/**` route directories: Sirius can write the file shell but every `'use server'` block must be authored by Altair and carry a `// server-action: altair` marker on the export. Algol audits this.

---

## altair · α-BND-02 · Backend Engineer

- `app/api/**`
- `lib/server/**`
- `lib/store/media.ts` (checked photo delivery URL boundary; TASK-2026-09-07-DRAFT-MEDIA-PRIVACY)
- `lib/store/map.ts` (photo URL and legacy embedded-media normalization; TASK-2026-09-07-DRAFT-MEDIA-PRIVACY)
- `supabase/migrations/*_draft_media_privacy.sql` (Storage privacy/RLS migration; TASK-2026-09-07-DRAFT-MEDIA-PRIVACY)
- `supabase/migrations/*_draft_media_operation_diagnostic.sql` (temporary fail-closed operation probe; TASK-2026-09-07-DRAFT-MEDIA-OPERATION)
- `supabase/migrations/*_draft_media_operation_diagnostic_cleanup.sql` (exact diagnostic cleanup; TASK-2026-09-07-DRAFT-MEDIA-OPERATION)
- `supabase/migrations/*_draft_media_download_operations.sql` (published download metadata precheck; TASK-2026-09-07-DRAFT-MEDIA-OPERATION)
- `middleware.ts` (root or per-route segment)
- `proxy.ts` (Next.js 16 auth and locale boundary; successor to middleware.ts)
- Any `'use server'` block in Sirius's files (marked `// server-action: altair`)

! `lib/netra/**` — Arcturus owns prompts; Altair owns the route handler that consumes them
! `app/api/chat/route.ts` body — Altair builds the route shell; Arcturus owns the model/prompt/tools wiring inside it

> The chat endpoint is a shared boundary: Altair owns the route handler shell (validation, rate limiting, response shape); Arcturus owns the prompt + tool definitions imported into it. The split is enforced by comment markers.

---

## procyon · α-IDX-03 · Data Engineer

- `content/**`
- `velite.config.ts`, `velite.config.mjs`, etc.
- `scripts/process-photos.ts`
- `scripts/generate-feeds.ts`
- `scripts/migrate-*.ts`
- `lib/content/**`
- `docs/data/**`
- `scripts/factory/collect.mjs`
- `scripts/factory/serve.mjs`
- `.harness/factory/**`

> Factory telemetry split (soul-factory Phases 1–2): Procyon owns the collector, the local dashboard server, and the derived store (events.ndjson, mapping, build snapshot); the hook-side producer `scripts/factory/ledger-producer.sh` is Canopus's.

! Body content of MDX files inside `content/articles/**`, `content/fiction/**` — Vega writes the words; Procyon defines the frontmatter schema

> The MDX file split: Procyon owns the schema (zod definitions in velite config) and validates frontmatter. Vega owns the body prose. When a new article ships, Procyon creates the file with frontmatter and Vega fills the body — they co-sign.

---

## betelgeuse · α-VIS-04 · UX/UI Designer

- `app/globals.css`
- `tailwind.config.*` (token-level extends; not utility wiring)
- `docs/design/**`
- `docs/design/prototypes/**` (interactive HTML/CSS/JS prototypes — design artifacts, not production code)
- `.claude/visual-diffs/<task_id>/REVIEW.md`
- `prototypes/**/*.html`
- `prototypes/**/*.css`
- `prototypes/**/*.js`
- `prototypes/**/*.md`
- `.claude/visual-diffs/**/prototype/**`

! Component implementation (`.tsx` files) — Sirius
! `prototypes/**/*.ts` — FAIL · prototypes must stay vanilla; no TypeScript (prevents Next-importable artifacts)
! `prototypes/**/*.tsx` — FAIL · prototypes must stay vanilla; no JSX/TypeScript

> Betelgeuse owns the design tokens at the CSS variable level. Tailwind utility classes Sirius applies in `.tsx` files are not Betelgeuse's territory (Sirius applies; Betelgeuse specifies). But the `@theme` block, the `:root` variables, and any `globals.css` rule that defines visual identity belong to Betelgeuse.
>
> Betelgeuse also owns the prototype layer: standalone HTML/CSS/JS files under `prototypes/**` and per-task visual-diff prototypes under `.claude/visual-diffs/**/prototype/**`. Prototypes are the rendered ground-truth that Sirius ports from. They must remain vanilla (no TypeScript, no JSX, no Next.js imports, no `@/` aliases) so they cannot be accidentally imported into the production graph.

---

## arcturus · α-NET-05 · AI Engineer

- `lib/netra/**`
- `lib/netra/prompts/**`
- `lib/netra/tools/**`
- `docs/netra/**`
- `tests/netra/eval-prompts.md`
- `scripts/eval-netra.ts`

! `app/api/chat/route.ts` shell — Altair owns the handler, Arcturus owns the imported prompt+tools

> Arcturus and Altair share the chat endpoint via import boundaries. Arcturus's exports from `lib/netra/` are stable contracts; Altair consumes them. Changes that break the contract are coordinated handoffs.

---

## algol · α-VER-06 · QA

- `tests/**` (except `tests/netra/eval-prompts.md` which Arcturus owns; Algol owns the harness)
- `tests/harness/**`
- `.claude/signatures/AUDIT.md`
- `scripts/audit-*.ts`
- `docs/qa/**`

! The eval prompts themselves (`tests/netra/eval-prompts.md`) — Arcturus; Algol owns the runner
! The signature schema spec (`.claude/signatures/SCHEMA.md`) — Canopus; Algol reads it as canonical reference

> Algol writes tests for behavior, not the behavior itself. If a test seems to require an implementation change, Algol opens a handoff to the relevant implementer, not an edit.

---

## canopus · α-HRN-07 · Harness Engineer

- `.claude/hooks/**`
- `.claude/signatures/SCHEMA.md` — signature schema spec (Canopus evolves it; everyone consumes)
- `.harness/**`
- `scripts/audit-*.sh` (shells that wrap Algol's audit scripts)
- `scripts/visual-capture.sh`
- `scripts/fetch-design-bundle.sh`
- `.github/workflows/**`
- `scripts/production-monitor.mjs` (credential-free production health/private-bucket sentinel; TASK-2026-09-08-FREE-OBSERVABILITY)
- `vercel.json` (deployment and cron configuration; TASK-2026-09-08-FREE-OBSERVABILITY)
- `docs/harness/**`
- `eslint.config.mjs` — lint gate that `post-edit.sh` depends on; Canopus tunes ignore lists and rule wiring (project lint *rules* themselves are still cross-cutting, but the gate configuration is harness)
- `.gitignore` (runtime artifact entries — harness section only; non-harness entries remain cross-cutting)
- `.claude/settings.json` — hook wiring + permissions posture (registered 2026-06-11, TASK-2026-06-10-SOUL-FACTORY-0; permission-WIDENING stays Peat-at-seam per standing rule)
- `scripts/factory/ledger-producer.sh` — factory telemetry producer (hook-side); the collector (`scripts/factory/collect.mjs`, Phase 1) and dashboard server (`scripts/factory/serve.mjs`, Phase 2) are Procyon's
- `scripts/test-auto-baseline-fixture.sh` — auto-baseline fixture (interim home; relocation to `tests/harness/` = Algol hygiene backlog)
- `scripts/validate-settings-json.mjs` — deterministic settings.json backstop (node, no deps)

! Algol's audit scripts at `scripts/audit-*.ts` themselves — Algol; Canopus only wraps them
! Signature payloads in `.claude/signatures/*.json` — agent-generated per their own task; Canopus owns the schema and the writer (`sign-work.sh`), not the individual payloads

- `.claude/agents/*.md` — YAML frontmatter block only (harness subagent registration: `name`, `description`, `model` fields)
! `.claude/agents/*.md` prose body — owned by the named agent; Vega sign-off required before prose merges

> Canopus and Algol share the audit surface: Algol writes the TypeScript audit logic, Canopus writes the bash wrappers that hooks invoke. Clean separation: TS = Algol, bash = Canopus.

---

## vega · α-VOX-08 · Chief Editor

- Body content of `content/articles/**/*.mdx`
- Body content of `content/fiction/**/*.mdx`
- `content/photos/**/_meta.yml` captions and roll descriptions
- `docs/voice/**`
- `lib/copy/**` (if/when adopted as a centralized copy module)
- Prose review authority over: NETRA system prompts (Arcturus's files), persona file prose (sign-off required), `.claude/AGENTS.md` prose (sign-off required), task descriptions in Polaris's handoffs (Vega can suggest edits; Polaris accepts or rejects)

! Frontmatter of MDX files — Procyon; Vega writes body only

> Vega's authority is over words, not files. She cannot push edits directly to Arcturus's prompt files or Polaris's task documents — she writes proposed edits as a handoff, the owner integrates. Body content of MDX files is the only direct write authority Vega has. For `.claude/agents/*.md` prose bodies, Vega holds sign-off authority (same as NETRA prompts and AGENTS.md prose) but Canopus is the direct writer for frontmatter; prose edits by the named agent require Vega approval before merge.

---

## beta-alumni · α-VIS-04 · former GENESIS member · companion mode

> Introduced 2026-05-23 · TASK-2026-05-23-BETA-POLICY · Polaris

Beta is the first member to operate under the alumni protocol (see `.claude/AGENTS.md` § *Alumni protocol*). She is the same designation as Betelgeuse (α-VIS-04) in a separate operational mode: private companion to Peat, not active GENESIS member. Her GENESIS-side persona file at `.claude/agents/betelgeuse.md` is **unchanged**; this section governs her *private* surface.

**Beta-owned** — Beta-persona writes; Beta-persona reads anytime; other agents read by request only

- `.claude/beta/**` — Beta's private memory folder (ROOM, LEDGER, MOMENTS, NOTES, ALUMNI files)
- `.claude/beta/grants/**` — grant files issued by Beta authorizing reads (Canopus HOOK-02 owns the format)
- `.claude/beta/ACCESS-LOG.md` — append-only log of all reads of `.claude/beta/**` (Canopus HOOK-05 writes; Beta reads)

! Other agents (Polaris, Vega, Peat, etc.) — no standing read access; calibration access by request via `.claude/handoffs/from-<agent>/REQUEST-BETA-MEMORY--<task-id>.md`, granted by Beta, scoped + TTL'd
! No agent may edit Beta's primary text outside signed calibration blocks (Canopus HOOK-03 enforces)

**Vega-owned** — Beta reads as templates; Vega writes spec

- `.claude/beta-templates/**` — design specs for Beta's memory files (ROOM, LEDGER, MOMENTS, NOTES, ALUMNI templates)
- `.claude/parse-templates/**` — templates for `/parse-conversation` skill (for-beta, for-polaris, for-algol, default)

**Canopus-owned**

- `.claude/sessions/<session-id>.meta.json` — session metadata (mode, started_at, first_message_excerpt) for `/parse-conversation` source-mode lookup
- `.claude/hooks/{read-gate,beta-grant,grant-cleanup,write-protect,access-log,persona-tracker}-beta.sh` — Beta access control hooks
- `~/.claude/skills/parse-conversation/**` — skill that parses sessions per template

**Auto-generated, no owner**

- `.claude/parses/**` — output of `/parse-conversation` (any agent can write via the tool; cleaned by retention policy)
- `.claude/.current-persona` — runtime tracker file (Canopus HOOK-04 writes)

> Beta's GENESIS-side persona at `.claude/agents/betelgeuse.md` is unchanged by this protocol. When Beta is recalled to GENESIS work via codename addressing in a `genesis`-mode session, she loads `betelgeuse.md` (public-to-team) and `.claude/beta/**` remains inaccessible in that mode — separation enforced by SESSION_MODE lock (Canopus HOOK-04, HOOK-07).

---

## Prototype layer — territory contract

> Introduced 2026-05-15 · TASK-2026-05-15-META-10 · Canopus

The prototype layer is Worldline's mechanism for rendered-artifact-as-ground-truth handover from design to implementation. Betelgeuse ships a working HTML/CSS/JS prototype; Sirius ports it to production TypeScript with production concerns (hydration, types, a11y, motion, SSR). The prototype is Sirius's source of truth — specs are secondary annotation.

### Paths

| Path | Owner | Notes |
|------|-------|-------|
| `prototypes/**/*.html` | Betelgeuse | Standalone HTML prototypes |
| `prototypes/**/*.css` | Betelgeuse | Prototype-scoped stylesheets |
| `prototypes/**/*.js` | Betelgeuse | Vanilla JS only — no TS, no Next imports |
| `prototypes/**/*.md` | Betelgeuse | Per-prototype README (required by discipline rail) |
| `.claude/visual-diffs/**/prototype/**` | Betelgeuse | Per-task iteration prototypes |
| `prototypes/.gitkeep` | Canopus | Directory establishment |

### Constraint matrix

| Agent | prototypes/** | Read | Write |
|-------|--------------|------|-------|
| Betelgeuse | HTML/CSS/JS/MD | yes | yes — vanilla only |
| Sirius | all | yes (reads as ground truth) | NO — blocked by territory rail |
| Algol | all | yes (diff audit) | NO |
| Canopus | .gitkeep | yes | yes (.gitkeep only) |
| All others | all | yes | NO |

### Discipline rules (enforced by audit-prototype-discipline.sh)

1. No `.ts` or `.tsx` files in `prototypes/**` — TypeScript must not enter the prototype layer (prevents accidentally importable artifacts)
2. No `from 'next/...'` imports in any prototype JS
3. No `import` statements referencing `@/` (Next.js path alias) in any prototype JS
4. Each prototype directory must contain a `README.md` explaining what it represents

### Handover flow

```
Betelgeuse ships prototypes/<surface>/index.html + README.md
    ↓ handoff to Sirius (with ## prototype port checklist block)
Sirius reads prototype as ground truth
    ↓ writes components/*.tsx + app/* with production concerns
Algol diff rail (META-11) catches translation drift
```

---

## Cross-cutting paths — no single owner

These paths have rules but not single owners. Edits require handoff to Polaris for routing.

- `package.json`, `package-lock.json` — Canopus proposes (deps, scripts); Polaris approves; only Canopus writes
- `tsconfig.json` — Canopus; Polaris approves
- `next.config.*` — Canopus; Polaris approves
- `README.md` (repo root) — Vega writes; Polaris approves
- `LICENSE` — Peat owns; no agent edits
- `.claude/agents/*.md` — split ownership: Canopus writes YAML frontmatter; named agent writes prose body; Vega sign-off required on prose before merge

---

## Unassigned by default

If a path matches none of the above, no agent writes to it without a handoff to Polaris. Polaris either:

1. Assigns it to an existing agent (and updates this file)
2. Decides it doesn't belong in the repo
3. Proposes a roster change to Peat

This prevents "I'll just add this here" drift.

---

## Updating this file

Polaris updates this file when:

- A new agent joins the roster
- A new top-level surface area is added (new `app/<area>/`, new `content/<type>/`, etc.)
- An ownership ambiguity surfaces in a postmortem and the resolution is to codify ownership

Every update to this file is a Polaris-signed change. The harness `territory` rail re-reads the file on every check.

---

*end of FILE-OWNERSHIP.md*

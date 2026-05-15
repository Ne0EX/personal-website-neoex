# TO · Sirius (α-SUR-01, Frontend Engineer)
# FROM · Polaris (α-OPS-00)
# TASK · TASK-2026-05-15-24
# TYPE · TASK CONTRACT (draft · pending root-Polaris release)
# CREATED · 2026-05-15
# MODEL TIER · sonnet (route + MDX render + sidenotes + patches log — pattern-reuse heavy)

---

## scope

Implement the article entry route at `/entries/<fileNum>` per β spec (TASK-09 output) + journey-arch
v1.2 §3. Consumes `EntryShell` (TASK-23) as layout boundary; renders MDX body with shiki +
rehype-pretty-code; emits marginal sidenotes; renders patches log; renders related-branches block.

This closes the article entry surface — one of the 7 v1 must-exist surfaces (DEV-PLAN-D §D.5.1 #2).

## canonical inputs (READ FIRST — non-negotiable)

1. **β spec** · `docs/design/spec-article-entry.md` (TASK-09 output) — per-surface visual + interaction contract
   - flag if not yet closed; this TASK depends on TASK-09 closing
2. **`docs/design/journey-architecture.md` v1.2** —
   - §3 entry surfaces (general)
   - §3.2 related-branches block (reuses ChapterIndex card pattern)
   - §3.5 entry-page vocabulary
   - §6 strata behavior (entry pages render inside their stratum context)
3. **`docs/design/attractor-binding-mechanic.md`** (TASK-14) —
   - §1 binding semantics for what happens to AttractorFields when an article opens
   - §5 worked examples for click-from-orbit → entry flow
4. **`components/EntryShell.tsx`** (TASK-23 output) — the layout shell this route mounts
5. **`lib/content/` accessors** (TASK-22) — `getArticleBySlug(fileNum)`, types
6. **`content/articles/*.mdx`** — actual content (TASK-25 / TASK-22 example entries land first)
7. **`docs/team/FILE-OWNERSHIP.md`** — Sirius territory; Vega co-signs for MDX body prose
8. **`docs/team/QUALITY-BAR.md`** — a11y ≥ 95 Lighthouse target for entry surfaces

## deliverables

- `app/entries/[fileNum]/page.tsx` — the route file
  - Server component default; `'use client'` only on sub-pieces if needed
  - Fetches via `lib/content` accessor (typed)
  - Renders `<EntryShell kind="article" {...metadata}>` wrapping MDX body
  - 404 for missing fileNum (Next 16 `notFound()` pattern)
- `components/article/ArticleBody.tsx` — MDX renderer with shiki + rehype-pretty-code wiring
  - Supports marginal sidenotes (Vega's prose convention)
  - Code blocks: syntax-highlight via shiki; inline monospace for instrument readout
- `components/article/Sidenote.tsx` — marginal sidenote component (rendered to side at ≥880px,
  inline at ≤600px per journey-arch §7 responsive table)
- `components/article/PatchesLog.tsx` — semantic `<ol>` with mono 11px styling, consumed by EntryShell
  - (or co-locate in EntryShell — Sirius decides; whichever is cleaner)
- (optional) `components/article/RelatedBranches.tsx` if it diverges from ChapterIndex card pattern
  - prefer reuse of ChapterIndex primitives (journey-arch §3.2 mandate)

## constraints

- **Do NOT** modify `components/WorldlineGlobe.tsx` — serialization point; TASK-19/33 territory
- **Do NOT** modify `app/globals.css` — Betelgeuse territory
- **Do NOT** author MDX body prose — Vega's territory (TASK-25 migrates real content; this TASK uses whatever's in `content/articles/`)
- **Do NOT** invent design tokens — consume existing CSS vars
- **Do NOT** wire fiction or photo routes here — TASK-31 is photo; fiction route deferred per Peat #5
- Honor `prefers-reduced-motion` everywhere
- SSR/hydration safe — no localStorage reads on server
- a11y baseline: semantic landmarks, heading hierarchy, link affordances
- Mobile (≤600px) layout per journey-arch §7 (sidenotes inline; everything fits without horizontal scroll)
- Vega co-sign required if you touch any MDX body bytes (you should not, but if examples need stub prose, route through Vega)

## harness protocol

- **Step 0** · run `bash .claude/hooks/pre-task.sh TASK-2026-05-15-24 sirius` BEFORE first edit
- post-edit gates auto-run
- sign with `WL_AGENT=sirius WL_NEXT=polaris WL_SUMMARY="article entry route + body + sidenotes + patches (TASK-24)" bash .claude/hooks/sign-work.sh TASK-2026-05-15-24`
- return handoff at `.claude/handoffs/from-sirius/TASK-2026-05-15-24--to-polaris.md`

## acceptance criteria

- `/entries/<fileNum>` renders for at least one real article (post TASK-25 migration) and one example article (TASK-22 placeholder)
- Wrong `fileNum` → Next 16 `notFound()` (404)
- MDX body renders with code blocks syntax-highlighted (shiki)
- Sidenotes render to margin at ≥880px viewport; inline at ≤600px
- Patches log renders as semantic `<ol>` with mono 11px when `patches?.length > 0`
- Related branches block renders ChapterIndex-style cards
- Lighthouse a11y ≥ 95 on the rendered route (one real article in `content/articles/`)
- Mobile (≤600px): no horizontal scroll, no overflow
- territory + design-tokens rails green
- Signature v2 clean
- Algol audit ready per standing rule

## downstream impact

Unblocks:
- **TASK-63** two-step entry transition (consumes article route as destination of preview→full nav)
- **TASK-64** hover preview tooltip on Globe (consumes route URL pattern for prefetch)
- v1 demo path step 3 (DEV-PLAN-D §D.5.4: "Click a pin → side panel → READ ENTRY → entry page")

---

*polaris · α-OPS-00 · 2026-05-15 · TASK-24 draft contract (META-2 pre-stage)*

# TO · Sirius (α-SUR-01, Frontend Engineer)
# FROM · Polaris (α-OPS-00)
# TASK · TASK-2026-05-15-23
# TYPE · TASK CONTRACT (draft · pending root-Polaris release)
# CREATED · 2026-05-15
# MODEL TIER · sonnet (no rubric trigger — shared component scaffold, pattern-reuse heavy)

---

## scope

Author `components/EntryShell.tsx` — the shared shell consumed by all three entry-page templates
(article β, photo γ, fiction once it lands). Per journey-architecture v1.2 §3.5 entry-page vocabulary:
shared header strip + footer + related-branches block + prev/next nav. Concrete templates (article
route, photo route) consume this shell as their layout boundary; their bodies plug into a slot.

This is the **Sirius wave-1 anchor TASK**. TASK-24 article-route + TASK-31 photo-entry both pull
from this component. Get the contract right; downstream routes inherit.

## canonical inputs (READ FIRST — non-negotiable)

1. **`docs/team/STATUS.md`** — current state; TASK-22 closed (velite skeleton landed); TASK-14
   binding mechanic closed; this TASK is wave-1 implementation.
2. **`docs/design/journey-architecture.md` v1.2** —
   - §3 entry surfaces taxonomy
   - §3.5 entry-page vocabulary (header strip · footer · related branches · prev/next)
   - §2.3 two-step entry pattern (preview side panel → full route — context for TASK-63)
3. **`docs/design/attractor-binding-mechanic.md`** (TASK-14 output) — §3.5 component touch list
   for HeroBlock simplification context; §7.1 Sirius implementation handoff
4. **β article spec** at `.claude/handoffs/from-polaris/TASK-2026-05-15-09-article-entry-spec.md`
   when closed → its `docs/design/spec-article-entry.md` is the per-surface contract this shell must satisfy
5. **`lib/content/` accessors** (TASK-22 output) — the Article type shape; this shell consumes
   `Article['related']` and `Article['patches']` typed data
6. **`docs/team/FILE-OWNERSHIP.md`** — Sirius territory confirmation (`components/**/*.tsx`)
7. **`docs/team/QUALITY-BAR.md`** — a11y / motion / token discipline (no raw hex)

## deliverables

- `components/EntryShell.tsx` — primary deliverable
  - props (typed): `{ kind: 'article' | 'photo' | 'fiction'; title; date; status?; tags?; related?; patches?; prevNext?; children: ReactNode }`
  - sections in render order: header-strip, body slot (`children`), patches log (if `kind==='article'`), related-branches block, prev/next nav, footer
  - composition: use existing primitives where possible (Nav header is already global; this shell is the per-entry frame inside the page)
- `components/EntryShell.module.css` OR Tailwind utility classes — Sirius preference; either works
  per FILE-OWNERSHIP.md (Tailwind preferred, module.css co-located OK)
- `lib/types/entry-shell.ts` (or inline export) — exported prop types so TASK-24 / TASK-31 import them

## constraints

- **Do NOT modify** `components/WorldlineGlobe.tsx` (untouched by this TASK · serialization point for TASK-19/33)
- **Do NOT modify** `app/globals.css` (Betelgeuse territory)
- **Do NOT design new tokens** — consume existing CSS vars only
- **Do NOT author body content** — `children` slot only; Vega owns prose in actual MDX bodies
- **Do NOT implement routes yet** — TASK-24 (article) and TASK-31 (photo) consume this shell
- Honor v1.2 journey-arch §3.5 vocabulary exactly — don't invent new section names
- Honor `prefers-reduced-motion` for any micro-motion
- SSR/hydration safe (`'use client'` only if motion or interaction requires it; prefer server component default)
- All colors via CSS vars / Tailwind tokens, no raw hex

## harness protocol

- **Step 0** · run `bash .claude/hooks/pre-task.sh TASK-2026-05-15-23 sirius` BEFORE first edit
- post-edit gates auto-run on each Write/Edit
- sign with `WL_AGENT=sirius WL_NEXT=polaris WL_SUMMARY="EntryShell shared component (TASK-23)" bash .claude/hooks/sign-work.sh TASK-2026-05-15-23`
- return handoff at `.claude/handoffs/from-sirius/TASK-2026-05-15-23--to-polaris.md`

## acceptance criteria

- `components/EntryShell.tsx` compiles (typecheck clean) and renders with example prop set
- All 5 sections present per journey-arch §3.5 (header / body slot / patches / related / prev-next)
- Patches log only renders when `kind === 'article'` AND `patches?.length > 0`
- Prop types exported and importable from `lib/types/` (or component path)
- `npm run build` passes (or `next build` equivalent)
- territory rail green · design-tokens rail green (no raw hex/rgba)
- Signature v2 clean (post-D3 attribution)
- Algol audit ready per standing rule (`feedback_algol_qa_cross_check`)

## downstream impact

Unblocks:
- **TASK-24** article entry route (consumes EntryShell + body MDX renderer)
- **TASK-31** photo entry route (consumes EntryShell with `kind='photo'` + γ instrument-readout body)
- **TASK-63** two-step entry transition (consumes EntryShell on the destination side)

---

*polaris · α-OPS-00 · 2026-05-15 · TASK-23 draft contract (META-2 pre-stage)*

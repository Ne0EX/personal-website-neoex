# TO · Sirius (α-SUR-01, Frontend Engineer)
# FROM · Polaris (α-OPS-00)
# TASK · TASK-2026-05-15-52
# TYPE · TASK CONTRACT (draft · pending root-Polaris release)
# CREATED · 2026-05-15
# MODEL TIER · sonnet (drawer + zustand + streaming UI; pattern-reuse heavy from spec)

---

## scope

Implement the NETRA chat drawer per δ-UI spec (TASK-11-S2 output): right-edge drawer (NOT a 5th
stratum), zustand chat-history store with localStorage persistence, streaming render of Vercel AI
SDK responses, mobile full-width drawer using `dvh` + interactive-widget per journey-arch §4.5.
Consumes Altair's route shell (TASK-50) and Arcturus's prompts/tools (TASK-51).

Closes one of the 7 v1 must-exist surfaces (DEV-PLAN-D §D.5.1 #4 · δ NETRA chat).

## canonical inputs (READ FIRST — non-negotiable)

1. **δ-UI spec** · `docs/design/spec-netra-chat-ui.md` (TASK-11-S2 output) — visual + interaction contract
   - flag if not closed; this TASK depends on TASK-11-S2 closing
2. **TASK-11-S1 output** · `docs/netra/prompt-architecture.md` (or equivalent Arcturus deliverable) — for understanding chat message shape, tool-call render hints, refusal copy
3. **`app/api/chat/route.ts`** (TASK-50 output) — streaming endpoint contract; this drawer hits it
4. **`docs/design/attractor-binding-mechanic.md`** (TASK-14) — chat-event ↔ Globe coupling (if any per δ contract)
5. **`docs/design/journey-architecture.md` v1.2** —
   - §4 NETRA placement (right-edge drawer, NOT 5th stratum)
   - §4.5 mobile dvh + interactive-widget
   - §8 search overlay pattern reference (similar full-page modal vocabulary)
6. **PRD-05** `docs/prds/PRD-05-netra-chat.md` — round-trip, rate limit copy, dormant state
7. **`docs/team/FILE-OWNERSHIP.md`** — Sirius territory; `lib/netra/**` is Arcturus, do NOT touch prompts
8. **`docs/team/QUALITY-BAR.md`** — a11y / motion / token discipline

## deliverables

- `components/netra/ChatDrawer.tsx` — right-edge drawer component
  - Triggered by N button (bottom-left per journey-arch §4) — wire button if not already in Nav
  - ESC closes; click-outside closes (per δ contract); drawer slides per motion budget
  - Streams responses from `/api/chat` route via Vercel AI SDK client utilities
- `lib/client-state/chat-store.ts` — zustand store
  - shape: `{ messages: Message[]; isOpen: boolean; isStreaming: boolean; sessionId: string }`
  - localStorage persistence keyed on session cookie / per-session ID
  - hydration-safe (no SSR mismatch)
- `components/netra/ChatMessage.tsx` — message render (user · assistant · tool-call · refusal)
  - tool-call render hints per TASK-11-S1 architecture
  - refusal taxonomy copy per Arcturus's locked phrases
- `components/netra/ChatInput.tsx` — input + send affordance
  - Enter sends; Shift+Enter newline; rate-limit-exceeded shows dormant copy
- Mobile: full-width drawer using `dvh` units + `viewport-fit=cover` aware; interactive-widget meta tag per journey-arch §4.5

## constraints

- **Do NOT** modify `components/WorldlineGlobe.tsx` — unrelated surface; serialization point
- **Do NOT** modify `app/globals.css` — Betelgeuse territory
- **Do NOT** modify `lib/netra/**` — Arcturus territory; this TASK consumes via the route shell
- **Do NOT** modify `app/api/chat/route.ts` — Altair territory
- **Do NOT** invent design tokens
- **Do NOT** persist conversations beyond localStorage in v1 (no server-side history)
- Honor `prefers-reduced-motion` for drawer slide motion
- SSR/hydration safe (zustand store initializes empty on server; rehydrates from localStorage on client)
- a11y: drawer is a focusable region; focus trap when open; ESC closes; role=dialog or equivalent
- Mobile: drawer occupies full width; chat input above keyboard via interactive-widget viewport meta
- Rate-limit exceeded → render dormant copy from PRD-05 (`α drift exceeded · NETRA dormant until next worldline.`)

## harness protocol

- Step 0 · `bash .claude/hooks/pre-task.sh TASK-2026-05-15-52 sirius`
- sign with `WL_AGENT=sirius WL_NEXT=polaris WL_SUMMARY="NETRA chat drawer + zustand + streaming (TASK-52)" bash .claude/hooks/sign-work.sh TASK-2026-05-15-52`
- return at `.claude/handoffs/from-sirius/TASK-2026-05-15-52--to-polaris.md`
- visual-diff capture on completion (UI surface touched)

## acceptance criteria

- N button opens drawer; ESC closes; click-outside closes
- One end-to-end round trip works: input → POST `/api/chat` → streamed response renders progressively
- Tool-call frames render per TASK-11-S1 contract
- Rate-limit response renders dormant copy (verify via mocked rate-limit-exceeded scenario)
- localStorage persists messages within a session; cleared on new session cookie
- Mobile (≤600px): drawer full-width; input visible above keyboard
- Reduced-motion: drawer fades instead of slides; no auto-scroll jank
- Lighthouse a11y ≥ 95 on the route hosting the drawer
- territory + design-tokens rails green
- Signature v2 clean
- Algol audit ready per standing rule

## downstream impact

Unblocks:
- v1 demo path step 5 (DEV-PLAN-D §D.5.4: "Open NETRA · drawer slides · ask · streamed reply")
- v1 definition-of-done #4 (δ NETRA chat overlay)

---

*polaris · α-OPS-00 · 2026-05-15 · TASK-52 draft contract (META-2 pre-stage)*

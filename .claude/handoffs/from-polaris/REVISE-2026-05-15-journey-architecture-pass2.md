---
type: REVISE (pass 2)
from: polaris
to: betelgeuse
date: 2026-05-15
target_doc: docs/design/journey-architecture.md
prior_revision: REVISE-2026-05-15-journey-architecture (closed, v1.1)
predecessor_task: TASK-2026-05-15-08 (closed)
trigger: Peat answered remaining 4 flags on 2026-05-15
model: sonnet (text revision; not novel direction)
---

# REVISE pass 2 · encode Peat's #3 / #4 / #5 / #6 answers

## scope

Peat answered the last 4 open flags. Three are straightforward; #4 has a reversal you should encode carefully. Plus Polaris adds her own #5 decision rule.

Run pre-task.sh first per WORKFLOW Step 0:
```bash
WL_TASK_ID=REVISE-2026-05-15-jarc-pass2 WL_AGENT=betelgeuse bash .claude/hooks/pre-task.sh REVISE-2026-05-15-jarc-pass2 betelgeuse
```

## confirmed decisions to encode

### #3 · CONFIRMED + spec detail · returning user can skip boot via click / any-key

§6.2 currently says "Boot skipped (`wl:boot-seen` check)" for returning visit. Peat adds the explicit dismissal affordance:
- First-time visitor: boot sequence plays (~2.5s)
- DURING boot: a single click anywhere OR any keypress dismisses boot → jumps straight to Globe in FULL Ne0EX
- Returning visit: boot still plays a short version (or fully skipped — your call), and same click/any-key dismissal applies

Add this dismissal detail to §6.2 OR §1 M1 LAND (your placement call — likely §6.2 since it's about boot mechanics).

Remove §6.2's `[Peat: confirm or redirect]` marker (was the second one — already removed in v1.1; verify and proceed).

### #4 · REVERSAL · fiction GETS Globe glyphs in v1

§13 v1.1 currently lists `#4 §2.2 — fiction-on-Globe deferred for v1 (only article + photo glyphs land)`. Peat REVERSES this:

> "เกือบใช่ ขาด short story / novel (มีไม่เยอะ แต่ทำรองรับไว้ก่อน) · fiction รอ wave หน้า"

Translation: almost-yes-it-was-defer, BUT he wants short story + novel (fiction) supported on the Globe glyph system from day 1, even though there are few pieces. Build the affordance now; fiction *entry surfaces* still wait for the next wave.

Encode:
- **§2.2 node glyph table** — confirm `fiction = diamond` is the third row from day 1 (currently the table already has 3 rows — preserve it; remove any "v1 ships only article+photo glyphs" defer language if present elsewhere)
- **§13 update** — remove #4 from open list; replace with RESOLVED line:
  > "~~#4 §2.2 — fiction-on-Globe deferred for v1~~ — RESOLVED 2026-05-15: REVERSAL · fiction glyphs (short story + novel) ship in v1's Globe node system; fiction *entry surfaces* remain deferred (see resolved #5)"

### #5 · DEFER (no dedicated fiction route in v1) + Polaris decision rule for future

§3.4 currently says "fiction entry — contract surface (γ-secondary or deferred)." Peat's answer:

> "ไม่มี แต่มันจะลอยอยู่ใน orbital network ของ NeX ซึ่งถ้าคุณมองว่า Navigate ยาก สำหรับ new comer ก็แยกเป้นหน้าออกมาได้ใน Nav bar ด้านบน"

Translation: no dedicated entry surface in v1; fiction nodes live in the NeX orbital network alongside other NeX content. **If** Polaris judges newcomer navigation as hard, split fiction into a dedicated `Nav: FICTION` route + entry surface.

Polaris's call on this — v1 DEFERS the dedicated fiction route. Reasoning: fiction is small in count; the NeX stratum + glyph (diamond) already gives it visibility on the Globe; adding a route + entry now is overscope. Encode this as:

- **§3.4 update** — rewrite to:
  > "Fiction entries are stored in `content/fiction/` and render as diamond glyphs in the NeX stratum's orbital network (per §2.2). v1 does NOT include a dedicated fiction route or entry surface — fiction is reached by entering NeX and clicking its node. **Polaris decision rule for follow-up TASK trigger:** if `content/fiction/` exceeds 3 pieces OR post-beta UX heuristic testing shows newcomers struggle to find fiction on the Globe, open a TASK to add `Nav: FICTION` route + dedicated entry surface (`docs/design/entry-fiction-<future>.md`)."

- **§13 update** — remove #5 from open list with similar RESOLVED + cross-reference to §3.4

### #6 · CONFIRMED · left rail purely stratum chooser; `[LIST]` in head bar if list view added

Peat: "ตามนั้นเลย" — accept Betelgeuse's proposal exactly. §5.2 in v1.1 already encodes this; verify the language is clean. If §5.2's `[Peat: confirm or redirect]` marker is still present, remove it.

- **§13 update** — remove #6 from open list with RESOLVED note

## §13 net result

After this revision, §13 should have **zero open items**. The lead-in becomes:

> "All open items from v1.0 are now resolved (2026-05-15). The journey architecture is settled at v1.2. Subsequent design refinements happen at the per-surface spec level (β / γ / δ TASKs) and at the binding-mechanic level (TASK-14 AttractorFields ↔ Globe ↔ Divergence)."

## Document version

v1.1 → v1.2. Footer annotation: "rev 1.2 · Peat #3/#4/#5/#6 answers encoded; §13 cleared; ready for per-surface dispatch + TASK-14 binding mechanic"

## non-goals

- Do NOT fold in Peat's design feedback (the screen-recording review) — that's separate and informs TASK-14, not this text revision
- Do NOT spec the binding mechanic — TASK-14 will handle (opus tier)
- Do NOT add new tokens, do NOT change §9 verdicts, do NOT touch persona files

## sign

`WL_AGENT=betelgeuse WL_NEXT=polaris WL_SUMMARY="REVISE-2 journey-architecture.md v1.1 → v1.2 (Peat #3/#4/#5/#6 answers + Polaris #5 decision rule)" bash .claude/hooks/sign-work.sh REVISE-2026-05-15-jarc-pass2`

Return handoff at `.claude/handoffs/from-betelgeuse/REVISE-2026-05-15-jarc-pass2--to-polaris.md`. Keep it under 50 lines.

After your return:
- Polaris closes the journey-arch revision wave (v1.2 final)
- Polaris opens TASK-14 (AttractorFields binding mechanic, your opus) — this is where Peat's design feedback folds in
- β / γ / δ unblock after TASK-14 closes

Build. Sign. Return.

---

*polaris · α-OPS-00 · 2026-05-15*

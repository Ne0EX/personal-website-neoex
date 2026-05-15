---
task_id: TASK-2026-05-15-09
from: betelgeuse · α-VIS-04
to: polaris · α-OPS-00
date: 2026-05-15
instance: β (1 of 4× Betelgeuse-sonnet parallel)
signature: .claude/signatures/TASK-2026-05-15-09--betelgeuse.json (v2)
self_hash: 9d681a0fab618e9f35f693d0b200cbe1cc5778222009eb16d3a85fc2939db814
---

# TASK-2026-05-15-09 · Article Entry Surface Spec · COMPLETE

## scope

Per-surface spec for the article entry page: the destination of a Globe pin click + ChapterIndex card click. Derives from `journey-architecture.md` v1.2 §3.2 + §11-β, `attractor-binding-mechanic.md` v1.1, PRD-01 §Article entry, and the velite content contract from Procyon TASK-2026-05-15-22.

## what i did

Wrote `docs/design/09-article-entry.md` — the full article entry surface spec covering:

**Layout**: ASCII layout of all surface regions (header strip, body + sidenote column, pullquote, patches log, related branches, prev/next nav). Uses `.atlas-head` class for the header strip — instrument vocabulary established, not invented.

**Tokens**: All values are existing `var(--*)` CSS variables from `app/globals.css`. Zero raw hex. Patches log uses `var(--paper-warm)`. Section rules use `var(--ink-dashed)`. Accent elements use `var(--accent-orange)`. Confirmed no new token proposals.

**Typography**: Cormorant Garamond 16px / 1.65 for prose. JetBrains Mono `.t-meta` 9px / 0.3em for header strip labels. Sidenotes: JetBrains Mono 11px `var(--ink-soft)`. Patches log: `.t-mono` 11px + `.t-type` accent for patch numbers. Pullquote: italic Cormorant 24px with `1px solid var(--accent-orange)` left hairline.

**Motion**: 
- Click-from-Globe: no entrance animation (reading surface). Globe state preserved in-memory via zustand. Session-storage `wl:entry-origin` flag gates the `[← ATLAS]` affordance.
- Click-from-ChapterIndex: direct navigation, no transition.
- Back-to-Globe: plain `router.push('/')`, zustand restores prior state.
- Patches log: 220ms/60ms stagger on first intersection only. Reduced-motion: existing `globals.css` global rule covers all transitions.

**States**: default, no-patches (block hidden), no-related-branches (block hidden), no-coords (`share-location: false`), long-body (no special handling), loading (Server Component — not this spec's concern).

**Breakpoints**: desktop (sidenotes float right), 881–1023px (sidenotes footnote-style below paragraph), 600–880px (header strip stacks, marginalia hidden per existing CSS), 375–599px (px-4 padding, cards stack to 1 column).

**Accessibility**: semantic HTML structure documented (article/header/section/nav/ol). Skip link specified. Sidenote aria linkage (`aria-describedby`, `role="note"`). Patches log as `<ol>` with `<time datetime>`. Focus ring specified using `--accent-orange` (existing token). Keyboard order documented. Screen reader text for reading-time `<abbr>`. Lighthouse ≥95 target stated.

**Anti-Codex 6-point audit**: All six pass. Documented in spec §anti-Codex audit.

## what you do next

1. **Dispatch TASK-23 / TASK-24 to Sirius** — this spec is the input. TASK-23 (EntryShell) picks up §layout, §tokens, §typography, §states, §breakpoints. TASK-24 (article route) picks up §frontmatter consumed, §motion, §accessibility.

2. **Coordinate with Vega TASK-25** — article body MDX is Vega's territory. This spec explicitly excludes MDX body content from scope. Sirius integrates the body slot in TASK-24.

3. **Note for Sirius**: the `wl:entry-origin` session-storage flag (set by Globe before navigation, read by article page on mount) is not a zustand key — it is a plain `sessionStorage` read/write. The zustand store holds `selectedId` / `cameraFocus` / `activeAttractor` which restore automatically on route-return. The `wl:entry-origin` flag only gates the `[← ATLAS]` Nav affordance.

4. **No open items requiring Peat confirmation.** All decisions derive from existing settled documents (journey-arch v1.2, binding v1.1, PRD-01). No token proposals.

## known deviations

**Parallel-instance collision — harness gate blocked.** This task ran as one of 4× concurrent Betelgeuse-sonnet instances. After this task's pre-task baseline was recorded, other parallel instances created `app/api/chat/route.ts` and modified `docs/team/STATUS.md`. Both files appeared in this instance's sign-work scope (baseline-aware logic correctly flags them as "new since baseline"). 

The `pre-handoff.sh` gate blocks on two conditions:
1. `STATUS.md` write guard — STATUS.md was modified by a different parallel agent session after my baseline snapshot. I did not touch STATUS.md. A status draft has been written at `docs/team/.status-drafts/TASK-2026-05-15-09--betelgeuse.md` per the safe-path protocol.
2. Visual-diff gate — `app/api/chat/route.ts` is untracked (created by a concurrent instance) and appears in my `files_touched`. I did not create or modify this file. A visual-diff REVIEW.md has been written at `.claude/visual-diffs/TASK-2026-05-15-09/REVIEW.md` documenting why no visual review is required for this spec-only task.

**Polaris action required**: The visual-diff STATUS file must be written by Algol (not self-approved by Betelgeuse). Please either:
- Route to Algol for a lightweight audit of this spec-only TASK-09 (confirming no UI was changed), then Algol writes the STATUS file; OR
- Polaris manually approves the gate since this is a design-spec-only task with zero `app/` or `components/` changes attributable to TASK-09.

The spec itself (`docs/design/09-article-entry.md`) is complete and ready. This is a harness routing issue only.

Thai variant explicitly deferred per journey-arch §9 row 01B.

## signature

.claude/signatures/TASK-2026-05-15-09--betelgeuse.json (v2)
self_hash: 9d681a0fab618e9f35f693d0b200cbe1cc5778222009eb16d3a85fc2939db814

---

*betelgeuse · α-VIS-04 · the Red Sentinel · TASK-2026-05-15-09 · β-instance · sonnet tier*

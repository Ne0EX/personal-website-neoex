---
type: HANDOFF
from: betelgeuse
to: polaris
date: 2026-05-15
task: REVISE-2026-05-15-journey-architecture
target_doc: docs/design/journey-architecture.md
version: v1.1
---

# HANDOFF · journey-architecture.md rev 1.1 → Polaris

## scope

Revision of `docs/design/journey-architecture.md` per Peat's 2026-05-15 confirmations and the REVISE contract from Polaris. One file touched.

## what I did

**§6.1** — removed `[Peat: confirm or redirect — this is the biggest decision...]` marker. Added one-line confirmation note citing 2026-05-15 and pointing to the new §3.6.

**§6.2** — removed `[Peat: confirm or redirect — alternative is "Globe lands in the last-visited stratum..."]` marker. Section content unchanged.

**§3.6 (new)** — Nav stratum-indicator spec added after §3.5. Covers: placement (right-side Nav readout zone, appended before NAV STANDBY); readout table (NeX / Ne0N / Ne0 show text; FULL/ALL hidden by default — the default needs no announcement); typography (`t-mono`, 9px, uppercase, 0.3em tracking, `var(--ink-soft)`); update timing (immediate swap, 200ms opacity transition only); explicit NOT list (not CRAFT/TRACE flag, not clickable, not animated beyond 200ms, not a pill or container). Implementation note to Sirius points at `useGlobeStore` selector — does not spec the implementation itself.

**§6.3 (new)** — Rejected hybrid options recorded: HeroBlock tagline stays static (does not swap per stratum), Nav link order stays static. Rationale recorded inline. Append-only — no deletions.

**§7** — prototype-phase notice added as a blockquote at the top of the section. Breakpoint table and §§7.1–7.5 preserved as-written. §7.4 pinch-zoom marker preserved for context (decision deferred to prototype report).

**§13** — Lead-in updated to "5 open items remain." Resolved items (#1, #7, #8, #9) listed with strikethrough and resolution notes. The 5 open items (#2, #3, #4, #5, #6) remain intact with their original markers. No confirmed-flag markers were left in the body text.

**Footer** — bumped `v1.0` → `v1.1` with revision annotation.

## what is still open (5 items — Polaris asks Peat)

1. §1 M6 — AttractorFields ↔ Globe two-way binding deferred
2. §1 M-RETURN — no return dashboards in v1
3. §2.2 — fiction-on-Globe deferred for v1
4. §3.4 — fiction entry surface waits one wave
5. §5.2 — left rail stays purely as stratum chooser (vs LIST link in ATLAS head bar)

These do not block β/γ/δ dispatch.

## constraints respected

- Did not touch flags #2, #3, #4, #5, #6
- Did not add design tokens
- Did not spec Nav implementation (Sirius's territory)
- Did not update STATUS.md
- Did not route through Algol

---

*betelgeuse · α-VIS-04 · 2026-05-15 · REVISE-2026-05-15-journey-architecture*

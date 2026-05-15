---
type: HANDOFF
from: betelgeuse · α-VIS-04
to: polaris · α-OPS-00
date: 2026-05-15
task: REVISE-2026-05-15-journey-architecture-pass2
doc: docs/design/journey-architecture.md
version: v1.1 → v1.2
signature: .claude/signatures/REVISE-2026-05-15-journey-architecture-pass2--betelgeuse.json
---

# REVISE-2 complete · journey-architecture v1.2

Four items encoded. §13 cleared. Summary below.

## what changed

**§6.2 (#3)** — dismissal affordance added: click anywhere or any-key during boot dismisses
to Globe in FULL Ne0EX. Applies to both first-time and returning-visitor boot variants.
No `[Peat: confirm or redirect]` marker was present in §6.2 at v1.1; confirmed clean.

**§2.2 (#4 REVERSAL)** — the "defer fiction-on-Globe" language in the Important note below
the glyph table is replaced. Fiction diamond glyph ships in v1. The table's third row
(fiction = diamond) was already present and is preserved. §13 records the reversal verbatim.

**§3.4 (#5 DEFER + Polaris rule)** — entire section rewritten. Fiction lives in NeX orbital
network as diamond glyph; no dedicated route or entry surface in v1. Polaris decision rule
encoded verbatim: triggers on >3 pieces in content/fiction/ OR newcomer navigation failure
in post-beta heuristic testing. §13 RESOLVED note cross-references §3.4.

**§5.2 (#6 CONFIRM)** — `[Peat: confirm or redirect]` marker removed; language updated to
record Peat's "ตามนั้นเลย" acceptance. Left rail stays purely stratum chooser; LIST goes
in head bar only if ever added.

**§13** — zero open items. Lead-in replaced with resolution statement per contract.

**Bonus cleanup** — three other stale `[Peat: confirm or redirect]` markers swept from §1
(M1, M6, M-RETURN) and §7.4 — all four were decisions confirmed in prior passes; their
markers were vestigial. Replaced with *Confirmed 2026-05-15* / delegation notes. §1 header
note updated to reflect v1.2 clean state.

**Footer** — v1.2; rev annotation appended.

## gates passed

post-edit · lint PASS · typecheck PASS · build PASS
sign-work · PASS · self_hash 57d12d3e...

## §13 state

ZERO open items. All nine flags (#1/#2/#3/#4/#5/#6/#7/#8/#9) resolved.

## what this unlocks

β / γ / δ per-surface TASKs unblocked (pending TASK-14 close per Polaris's call).
TASK-14 (AttractorFields ↔ Globe ↔ Divergence binding mechanic) is the next opus-tier
wave where Peat's screen-recording design feedback folds in.

---

*betelgeuse · α-VIS-04 · 2026-05-15*

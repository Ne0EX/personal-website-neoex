# TO · Polaris
# FROM · Betelgeuse
# TASK · REVISE-2026-05-15-journey-architecture-pass2
# TYPE · REVISE
# CREATED · 2026-05-15T00:00:00Z

---

## scope

Encoding Peat's answers to flags #3/#4/#5/#6 from v1.0. Text-only revision of `docs/design/journey-architecture.md` (v1.1 → v1.2). Authorized by Polaris REVISE handoff `REVISE-2026-05-15-journey-architecture-pass2.md`.

## what i did

1. Read contract and full v1.1 baseline of `docs/design/journey-architecture.md`.
2. **§6.2 (#3):** Added boot dismissal affordance — click anywhere or any-key during boot jumps to Globe in FULL Ne0EX. Applied to both first-time and returning boot variants. No marker was present to remove at §6.2 (confirmed clean in v1.1).
3. **§2.2 (#4 REVERSAL):** Removed "defer fiction-on-Globe" language from the Important note below the glyph table. The fiction = diamond row was already present; preserved. New note: fiction glyphs ship in v1; entry surfaces remain deferred per §3.4.
4. **§3.4 (#5 DEFER + Polaris rule):** Rewrote section entirely. Fiction lives in NeX orbital network as diamond glyph; no dedicated route or entry surface in v1. Polaris decision rule encoded verbatim (trigger: >3 pieces in content/fiction/ OR newcomer navigation failure in post-beta heuristic testing).
5. **§5.2 (#6 CONFIRM):** Removed `[Peat: confirm or redirect]` marker. Updated language to record Peat's acceptance; noted LIST goes in head bar only if ever added.
6. **§13:** Replaced entire open-items block. Lead-in is now the resolution statement per contract. All nine flags listed as resolved with correct RESOLVED/CONFIRMED annotations. #4 includes the REVERSAL note.
7. **Footer + header note:** Updated to v1.2 with rev annotation.
8. **Bonus cleanup:** Removed three additional stale `[Peat: confirm or redirect]` markers from §1 M1, §1 M6, §1 M-RETURN, and §7.4 — all were confirmed decisions from prior passes. Replaced with confirmation notes.
9. Ran `post-edit.sh` — lint PASS / typecheck PASS / build PASS.
10. Ran `sign-work.sh` — PASS. self_hash 57d12d3e7c3d8e0e6d9e27ffb7ae5fd1633d5ee2350bdd1d5dea37415968010a.

## what i did NOT do (in scope but parked)

- Did not fold in Peat's screen-recording design feedback — TASK-14 territory per contract.
- Did not spec the binding mechanic — TASK-14 (opus tier).
- Did not touch §9 verdicts.
- Did not add tokens.
- Did not route through Algol per Polaris's "small text revision; Polaris will eyeball" instruction.

## what you do next

Review `docs/design/journey-architecture.md` v1.2. Confirm §13 reads clean (zero open items). If satisfied: close the journey-arch revision wave and open TASK-14 (AttractorFields ↔ Globe ↔ Divergence binding mechanic, opus tier).

## inputs you'll need

- `docs/design/journey-architecture.md` — revised document (v1.2)
- `.claude/signatures/REVISE-2026-05-15-journey-architecture-pass2--betelgeuse.json` — signature

## acceptance criteria for the recipient's work

- §13 has zero open items with resolution statement lead-in
- §6.2 includes click/any-key dismissal affordance for boot
- §2.2 Important note carries no defer-fiction language; diamond row present
- §3.4 is the new fiction-in-NeX text with Polaris decision rule verbatim
- §5.2 has no `[Peat: confirm or redirect]` marker
- Footer reads v1.2 with rev annotation

## known deviations

Swept three additional stale `[Peat: confirm or redirect]` markers not listed in the contract (§1 M1, §1 M6, §1 M-RETURN) plus §7.4. These corresponded to decisions confirmed in the v1.1 pass whose markers were not swept at that time. Removal is consistent with the contract's intent (§13 zero open items; v1.2 clean state). Flagging here for transparency.

## risks i'm aware of

none.

## handoff cc

none.

---

## signature

signature · .claude/signatures/REVISE-2026-05-15-journey-architecture-pass2--betelgeuse.json

---

*end of handoff*

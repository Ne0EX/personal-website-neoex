# TO · Canopus (α-HRN-07) + cc Algol (α-QUA-08)
# FROM · Polaris (α-OPS-00)
# TASK · TASK-2026-05-15-META-8
# TYPE · TASK CONTRACT
# CREATED · 2026-05-15
# MODEL TIER · sonnet
# TRIGGER · Peat directive 2026-05-15 — Vision Fidelity gate must be operationally enforced, not just documented

---

## scope

Build a **mechanical fidelity-block presence check** for brand-bearing TASK contracts. Per VISION-FIDELITY §5: any TASK touching Globe/ATLAS/Hero/Nav/NETRA/article/photo/search/IA without a `vision fidelity` block is incomplete. Today, sub-Polaris drafted 8 META-2 contracts WITHOUT this block — they need it added before dispatch. Future contracts must auto-flag if missing.

## vision fidelity

not applicable · operational enforcement of the fidelity protocol itself; the protocol IS the soul rail this script protects

## canonical inputs

- `docs/team/VISION-FIDELITY.md` §5 Required Fidelity Block (six required fields)
- `.claude/handoffs/_template.md` (template now has the block · cite the canonical text)
- `docs/team/QUALITY-BAR.md` U0
- `docs/team/WORKFLOW.md` Step 0.5
- Existing META-2 contracts in `.claude/handoffs/from-polaris/TASK-23/24/26/31/33/52/11-s1/11-s2-*.md` (current state · 0 of 8 have the block)
- Brand-surface keyword list (Globe, ATLAS, Hero, Nav, NETRA, article surfaces, photo surfaces, search, digital-garden navigation)

## deliverables

1. `scripts/audit-fidelity-block.sh` — scans `.claude/handoffs/from-polaris/TASK-*.md`:
   - For each file: detect brand-surface keywords in scope/title
   - If brand-bearing: require `vision fidelity` block with 6 sub-fields (soul baseline / aesthetic invariants / Peat signal / allowed evolution / forbidden dilution / rendered checkpoint)
   - Emit PASS / FAIL / N/A per file
   - Verbose mode shows what's missing per FAIL
2. `.claude/hooks/pre-handoff.sh` extension — if outgoing handoff is brand-bearing AND missing fidelity block, **warn** (not block; per Peat "human judgment preserved")
3. New rail entry in `.harness/worldline-harness.config.json` — `fidelity-block` rail running this audit on Stop
4. `docs/harness/RAIL-DEFINITIONS.md` update

## constraints

- Heuristic detection — false positives acceptable (says "check this" when not needed); false negatives MUST NOT happen (silent omission is the failure mode this prevents)
- POSIX-compatible (grep -E only, no -P)
- Do NOT modify any existing META-2 contract (Polaris re-cuts those separately)
- Do NOT modify VISION-FIDELITY.md or _template.md (Polaris territory)
- Coordinate with Algol: this rail extends Algol's brand-regression check (META-BRC in-flight); don't duplicate

## harness protocol

- pre-task.sh Step 0 (use `TASK-2026-05-15-META-8`)
- sign-work.sh
- Return handoff at `.claude/handoffs/from-canopus/TASK-2026-05-15-META-8--to-polaris.md`
- cc Algol via handoff at `.claude/handoffs/from-canopus/META-8--cc-algol.md` for awareness

## acceptance criteria

- Script runs against current `.claude/handoffs/from-polaris/` — emits FAIL for 8 META-2 contracts + emits N/A for META-1/3/4/5/6/7
- 6-field block detection accurate (grep for each sub-field)
- Smoke test fixture · planted clean + planted dirty contracts
- New rail registered + harness-check.sh exit 0 reflects 6 rails (2 real + 3 stub + this new one = 6)
- Signature v2 clean

## downstream impact

- Polaris can run `bash scripts/audit-fidelity-block.sh` before any dispatch wave to confirm contracts are protocol-compliant
- META-2 backlog (8 contracts) gets clear FAIL list for re-cut
- Brand-bearing TASKs lacking the block surface at Stop, not after rendered drift

---

*polaris · α-OPS-00 · 2026-05-15 · soul protocol becomes mechanical floor*

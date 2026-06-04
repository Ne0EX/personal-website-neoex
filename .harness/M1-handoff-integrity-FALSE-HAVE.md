# M1-handoff-integrity — adversarial verdict: FALSE-HAVE confirmed

**Auditor:** Algol (α-VER-06) · **Date:** 2026-06-04
**Sensor under test:** `scripts/audit-handoff-integrity.sh`
**Mutation suite:** `tests/harness/audit-handoff-integrity.mutation.sh` (10/10 pass)
**Mandate:** REFUTE the sensor — make the threat present while the audit still exits 0.

> ADDITIVE only. This document does NOT modify `.claude/settings.json`. The
> proposed matcher / wiring changes below are emitted as a diff for Peat to
> apply at the gate. `.claude/beta/**` was never read, scanned, or touched.

---

## Verdict

- `catches_failure: TRUE` — the sensor DOES catch the single case it was built
  for: a pure in-band tamper of a recorded handoff whose ledger entry is stale
  (C2 → `SHA_MISMATCH`, exit 1) and an author-dir/ledger-author mismatch
  (C3 → `AUTHOR_MISMATCH`, exit 1).
- `false_have: TRUE` — but the threat can be made PRESENT with the gate green
  (exit 0) in three distinct ways. Existence != enforcement.

The exit code is the contract (the build report leans on "exits 3, not 0" as the
honesty signal). Exit 0 with a threat present is a false green, not a benign note.

---

## Refutations (each: threat present, audit exits 0 or silently drops it)

### A — Forged unlisted handoff (no ledger access required) — exit 0
A handoff written out-of-band (e.g. by a raw Bash `printf >`, bypassing the
Write/Edit hook) is never recorded in the ledger. The audit walks the ledger,
not the disk, for its verdict. The forged file lands in the "unlisted" bucket,
which is **reported in prose but does not affect the exit code**.
Result: `status=OK exit=0` with a forged handoff physically on disk.
This is the census disease verbatim — and the script's own (a) check claims to
"catch out-of-band edits that bypassed the hook," which a forged file defeats
even in the wired steady state.

### B — Ledger co-tamper (single-entry sha rewrite) — exit 0
The ledger is unauthenticated plaintext. The threat model (out-of-band file
edits) implies the attacker can edit the ledger too. Tamper the file AND rewrite
that entry's `sha256` to the tampered value, keep `author`=dir. Then:
(a) on-disk == latest sha → pass; (c) distinct-sha count == 1 → pass;
(b) author matches → pass. Result: `status=OK exit=0`. Check (a) is fully
defeated because nothing binds the ledger to a trusted origin.

### C — Malformed-line truncation — exit 0, tampered entry silently dropped
`jq -r 'select(...)'` aborts the whole stream on the first malformed line
(confirmed: exit 5). The audit suppresses jq stderr (`2>/dev/null`), so the
abort is invisible. Every ledger entry recorded AFTER a corrupt line never
reaches `INDEXED_PATHS` → those handoffs (even tampered ones) are never
sha-checked. Demonstrated as a clean false-have: a genuinely-verifying entry on
line 1, a malformed line 2, and a TAMPERED handoff entry on line 3 → line 1
verifies OK, the tampered entry is dropped before Check 1 ever sees it →
`status=OK exit=0` with a tampered handoff present on disk. One bad line
(accidental or injected) truncates verification of everything below it.

### C4 — Secondary defect: unlisted counter is unreliable
Surfaced by [A]: a recorded+verified file (`verified_ok=1`) is simultaneously
counted as unlisted (`unlisted_on_disk=2` when only 1 file is truly unlisted).
The Check-2 disk-walk canonicalization (strip `$REPO_DIR/`, line ~282) does not
reconcile with `INDEXED_PATHS` when `WL_HANDOFFS_DIR` is overridden. The one
signal the script offers for forged files is therefore not trustworthy.

---

## Fixes needed (priority order)

1. **Wired-mode UNLISTED must not be silent.** When the hook is wired (steady
   state), `unlisted_on_disk > 0` is a forged/unrecorded handoff and must be a
   distinct non-zero exit (e.g. exit 4 = UNVERIFIABLE_PRESENT), not `status=OK`.
   Gate this on a `WL_INTEGRITY_WIRED=1` flag set only after wiring, so the
   present unwired state legitimately stays exit 3 / informational.
2. **Integrity-protect the ledger.** Hash-chain each line (`prev_hash`) or sign
   the ledger so co-tamper (B) and malformed-line truncation (C) are detectable.
   An unauthenticated plaintext ledger cannot anchor an integrity claim.
3. **Make indexing line-tolerant.** Replace `jq -r 'select(...)'` over the raw
   file with `jq -R 'fromjson? | select(...)'` (or `jq --seq` / a per-line loop)
   so one malformed line cannot drop later entries. Additionally, do NOT swallow
   jq's nonzero exit on the `INDEXED_PATHS` assignment — a parse error there
   must surface as exit 2 (internal error), not a silent empty index.
4. **Fix C4 canonicalization** so the unlisted counter is correct under
   `WL_HANDOFFS_DIR` override and in production.

---

## Proposed wiring diff (emit-only — Peat applies at the gate)

The ledger-writer (`.claude/hooks/integrity-write-ledger.sh`) and this audit are
both unwired. Proposed `.claude/settings.json` PostToolUse addition — NOT applied
here:

```jsonc
// PostToolUse:
{
  "matcher": "Write|Edit|MultiEdit",
  "hooks": [
    { "type": "command",
      "command": "bash .claude/hooks/integrity-write-ledger.sh" }
  ]
}
```

The audit itself stays a standalone rail (run via npm script / harness:audit),
not a PostToolUse handler — consistent with `audit-design-tokens.sh`. It should
NOT be wired live until fix #1 (WL_INTEGRITY_WIRED exit-4 semantics) lands,
otherwise the forged-handoff false-have ships into the gate.

---

## Reproduce

```
bash tests/harness/audit-handoff-integrity.mutation.sh   # 10/10, exit 0
CLAUDE_PROJECT_DIR="$PWD" bash scripts/audit-handoff-integrity.sh  # real repo -> exit 3 (LEDGER_ABSENT, honest)
```

---

## RE-REFUTATION after Canopus v2 fix — Algol · 2026-06-04 · VERDICT: FALSE-HAVE NOT CLOSED

Re-ran all three refutations against **production ground truth** — the ledger as the
REAL writer (`.claude/hooks/integrity-write-ledger.sh`) actually produces it, driven
with mock stdin under temp overrides (no tracked-file mutation, no network).
Repro: `bash tests/harness/m1-rerefute-algol.sh`.

| Refutation | Real-writer + wired result | Status |
|---|---|---|
| **A** forged unlisted | `exit 4 UNVERIFIABLE_PRESENT` | **CLOSED** |
| **B** ledger co-tamper | `verified_ok=1 failed=0 status=OK exit 0` | **STILL BYPASSES** |
| **C** malformed-line truncation | `exit 1 SHA_MISMATCH` (tamper caught) | **CLOSED** |
| **D** deep-nest > `find -maxdepth 3` (new) | `unlisted_on_disk=0 status=OK exit 0` | **STILL BYPASSES** |

### B is the headline — verifier without a producer
The chain check (Fix 2) only validates lines that carry a `prev_hash` field. Lines
without it are tolerated as "legacy" (`CHAIN_WARN`, advance, pass). **The production
writer `integrity-write-ledger.sh` never emits `prev_hash`** — it writes exactly
`{"path","sha256","author","ts"}` (lines 213–218). Confirmed empirically:
`jq 'has("prev_hash")'` on a real-writer line → `false`.

So on every ledger the real system can produce, the chain is a **no-op**. Co-tamper
(edit the handoff body + rewrite that entry's `sha256` to match) → exit 0,
`status=OK`, `chain_warn=1` — **even with `WL_INTEGRITY_WIRED=1`**. Wired mode does
not imply a chained ledger; nothing in the system ever sets `prev_hash`.

The v2 mutation suite's `[B-chain]` case passes only because it hand-builds a chained
ledger with the **test-only** `chained_ledger_line` helper — a fixture the writer
never generates. The defense is verified against a proxy, not against ground truth.
Canopus's fix added a verifier (audit reads `prev_hash`) without a producer (writer
writes `prev_hash`) and without a seed/re-seed path. A verifier with no producer is
decorative.

**To close B — `prev_hash` is necessary-NOT-sufficient.** Making the writer emit
`prev_hash` does NOT close B. Two empirical bypasses on a *fully chained* ledger
(repro: `bash tests/harness/m1-rerefute-b-discriminator.sh`, both exit 0 wired):

- **B1 terminal entry.** A hash-chain protects line N only via line N+1's `prev_hash`.
  The LAST entry for any path has no successor, so co-tampering it in place (rewrite
  sha, leave a valid `prev_hash`) breaks nothing → exit 0. Canopus's own `[B-chain]`
  comment (script lines 280–287) concedes the single-entry case isn't caught — which is
  why that test had to add a second entry. **Handoffs are written once → their ledger
  entry is ALWAYS terminal.** A `prev_hash`-emitting writer still bypasses for exactly
  the files that matter.
- **B2 recompute attacker.** B's threat model is an attacker with ledger write access
  (they edit the file AND the ledger). They rewrite the target sha and recompute every
  downstream `prev_hash` over the new text — the whole chain re-validates, `distinct_sha`
  stays 1 → exit 0. An unauthenticated chain catches only a lazy attacker or accidental
  corruption, not a deliberate co-tamper. (The original refutation said this verbatim:
  "nothing binds the ledger to a trusted origin… sign the ledger.")

Closing B requires an anchor the writing agent **cannot forge**: an out-of-band /
signed ledger-tip hash, or an append-only external medium the agent can't rewrite —
NOT merely a writer that emits `prev_hash`. None of that is in this delivery.

### D — secondary, newly surfaced
`find "$HANDOFFS_DIR" -maxdepth 3 -type f -name "*.md"` (Check 2 disk walk, line ~436).
A forged handoff at `from-<agent>/sub/sub2/forged.md` is depth 4 → invisible to the
unlisted scan → `unlisted_on_disk=0`, `status=OK`, exit 0 even wired. So even once B's
chain is sealed, the forged-handoff defense (A) has a depth escape hatch. Fix: remove
`-maxdepth 3` (or raise it well past any legitimate nesting) so the disk walk is total.

### Not wireable now
Closing B requires changing the **writer** (out of this fix's scope) and seeding the
ledger. Until then `audit-handoff-integrity.sh` must NOT be wired live in `WL_INTEGRITY_WIRED=1`
mode under an integrity claim — it would ship the co-tamper false-have into the gate.
A/C are genuinely closed; do not regress them when fixing B/D. §2 settings.json wiring
remains Peat-gated and untouched.

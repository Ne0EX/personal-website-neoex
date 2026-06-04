# docs/qa/REPORTS/M-REVALIDATE-real-producer-absolute-path.md

## task · MAKE-OR-BREAK re-validation of M1 / TRUST-ROOT / M2 on a REAL-producer, ABSOLUTE-path-seeded ledger

## auditor · Algol (α-VER-06) · 2026-06-04

## verdict · PASS — all prior greens HOLD on a real-producer absolute-path ledger; no bypass remains

---

## why the R2 greens were invalid (and what this re-run fixes)

The R2 M1/M2/trust-root greens were tested against a **hand-seeded, repo-relative-path
ledger the production producer never emits.** Production `PostToolUse` passes
`tool_input.file_path` as an **absolute** path. Before the producer fix, surfaces 2
(`.claude/handoffs/**`) and 3 (`.claude/signatures/**`) only matched the repo-relative
form, so an absolute-path write was silently skipped — the two security surfaces that
matter (handoff provenance + signature integrity) were never recorded. Every downstream
audit then verified an empty or partial ledger: a false green.

This re-validation re-seeds the ledger by driving the **REAL** producer
(`.claude/hooks/integrity-write-ledger.sh`) as a PostToolUse hook would, with
**ABSOLUTE** `file_path` values, `CLAUDE_PROJECT_DIR` set to the sandbox repo root
(byte-identical to the absolute-path prefix — no `realpath`/symlink canonicalization
mismatch), then re-runs every audit against that ledger.

---

## STEP 1 — producer now records the security surfaces (THE GATE)

Driven with absolute `file_path` (`$PROD/.claude/handoffs/from-sirius/x.md`,
`$PROD/.claude/signatures/y.json`, `$PROD/.claude/beta/room.md`, `$PROD/MEMORY.md`),
the real producer emitted this ledger (verbatim):

```
1 {"_ledger":"integrity-append-only","schema":1,"anchor":"committed-git-history+CI-witness","not_a_chain":true,...}
2 {"path":".claude/handoffs/from-sirius/x.md","sha256":"17bbf172…","author":"sirius","ts":…}
3 {"path":".claude/signatures/y.json","sha256":"7d7b1844…","author":"vega","ts":…}
4 {"path":"MEMORY.md","sha256":"961179b4…","author":"polaris","ts":…}
```

- ✓ handoff entry recorded — stored **repo-relative** (`.claude/handoffs/from-sirius/x.md`), not absolute
- ✓ signature entry recorded — stored **repo-relative** (`.claude/signatures/y.json`)
- ✓ MEMORY.md recorded (surface 4)
- ✓ beta write **excluded** — no ledger line (return 1)
- ✓ zero absolute-path-stored entries — `canonical_path()` strips `$REPO_DIR/`, so M1/M2 keys still resolve

`producer_now_records_security_surfaces = TRUE`. The build agent's PASS=5 self-check
was **independently reproduced** end-to-end, not trusted.

---

## STEP 2 — M1 (audit-handoff-integrity) over the real-producer ledger

| case | seeded by | observed | want |
|---|---|---|---|
| baseline | real producer | `handoff_entries=1 verified_ok=1 status=OK exit=0` | exit 0 |
| **A** forged unlisted (WIRED=1) | real producer + out-of-band file | `unlisted_on_disk=1 UNVERIFIABLE_PRESENT exit=4` | exit 4 CAUGHT |
| **C** malformed line + tampered entry | real producer (2 entries) + injected `{ not valid json <<< }` | `SHA_MISMATCH … exit=1` | exit 1 CAUGHT |
| **D** deep-nest forged (WIRED=1) | real producer + `from-sirius/a/b/forged.md` (depth 4) | `disk_files=2 unlisted_on_disk=1 UNVERIFIABLE_PRESENT exit=4` | exit 4 CAUGHT |

The ledger now has **handoff entries to verify** (the R2 gate was empty). A/C/D all hold;
the stripped in-file chain claim (M1-hygiene slice) did **not** regress them. Note D: the
disk walk is **unbounded** (no `-maxdepth 3`), so the round-1 deep-nest escape is closed.

---

## STEP 3 — TRUST-ROOT (audit-ledger-append-only) over committed real-producer history

| case | staging | observed | want |
|---|---|---|---|
| ledger-absent | committed README only, ledger uncommitted | `committed_revisions=0 NEUTRAL exit=0` | NEUTRAL exit 0 |
| honest appends | rev1 (seed) → rev2 (append 2nd real entry) | `committed_revisions=2 pairs=1 status=PASS exit=0` | PASS exit 0 |
| **M1-B** co-tamper | rev1→rev2→revBAD (rewrite x.md body + bless its ledger sha in place) | `VIOLATION offending_commit=… exit=1` | exit 1 CAUGHT |
| **M2-C5** deletion co-tamper | rev1→rev2→revBAD (delete y.json file + its ledger line) | `VIOLATION offending_commit=… exit=1` | exit 1 CAUGHT |

### acceptance line — proven by the discriminator harness

A co-tamper that **PASSES** an in-file recompute is **CAUGHT** by the cross-commit
history diff. The discriminator
(`tests/harness/m-revalidate-trustroot-discriminator.sh`) showed both sides of the
same blessed line:

```
stored sha (blessed):  0fb92c3ee9a06e7b1ebf117024677e2330d7924bd1080852257d89bf03032ab4
disk   sha (tampered): 0fb92c3ee9a06e7b1ebf117024677e2330d7924bd1080852257d89bf03032ab4
>>> RECOMPUTE PASSES (stored==disk) — recompute-only audit DEFEATED.
…
committed_revisions=3  VIOLATION check=APPEND_ONLY  exit=1
>>> ACCEPTANCE LINE MET.
```

stored == disk means a recompute-only audit is fully defeated, yet the append-only
history audit caught the tamper at the offending commit (3 committed revisions, 2
consecutive pairs checked). The catch is genuinely from history immutability — not from
any value the working tree can present.

---

## STEP 4 — M2 (audit-memory-drift) over the real-producer ledger

| case | observed | want |
|---|---|---|
| clean | enumerated PASS for **handoffs** (`x.md`, `x2.md`) AND **signatures** (`y.json`) AND `MEMORY.md`; `pass=4 drift=0 unexplained=0 missing=0 PASS exit=0` | exit 0 |
| deletion closure | delete ledgered `y.json` (entry stays) → `MISSING … exit=1` | exit 1 CAUGHT |
| drift | out-of-band edit of ledgered `x.md` → `DRIFT … exit=1` | exit 1 CAUGHT |

Covered-surface enumeration now **includes handoffs and signatures** (the R2 ledger had
none to enumerate). The named deletion closure (reverse ledger→disk pass) holds.

**Note on `ledger entries: 5` vs `nodes checked: 4` (benign, traced):** the producer's
one-time header line (`{"_ledger":…}`, no `.path`) survives into M2's
`group_by(.path) | last` index as a single **null-path group** → one empty-path row in
`LATEST_INDEX`, so `wc -l` reports 5 while only 4 are real nodes. The forward pass never
produces an empty `node`, and the reverse pass guards `[[ -z "$lpath" ]] && continue`, so
the row is skipped in both directions. Traced empirically; no node is dropped or
miscounted (the malformed-line C case proves a tamper *after* the header is still caught).

---

## M1-HYGIENE RE-VALIDATION — the chain-strip slice, verified against its own suite

The M1-hygiene agent stripped the vestigial in-file hash-chain from
`audit-handoff-integrity.sh` and noted *"the 2 test assertions that reference removed
behavior are Algol's territory to update."* That suite was re-run (not trusted):

- Baseline before my update: `tests/harness/audit-handoff-integrity.mutation.sh` →
  **16/18**, the two reds **exactly** `[B]` (`chain_warn=1` assertion) and `[B-chain]`
  (`exit 2 CHAIN_BROKEN` assertion) — nothing touching A/C/C4/D/E1–E3. Confirms the strip
  did not regress any non-chain case.
- The two reds assert REMOVED behavior. The in-file chain was a **confirmed FALSE-HAVE**
  (round-1 refutation B: the real producer never emits `prev_hash`; the chain was
  decorative and recompute-forgeable; the `[B-chain]` green only ever held against the
  test-only `chained_ledger_line` fixture). Stripping it **is** the fix. The co-tamper it
  pretended to catch is now genuinely caught one layer down, by the append-only
  cross-commit history witness — re-validated above (Step 3, M1-B; discriminator).
- I **retired both assertions in my territory** (the mutation suite), not by deleting
  coverage but by re-pointing them: `[B]` now asserts the co-tamper is invisible to M1 by
  construction (exit 0) AND that the chain claim is gone from output; `[B-chain]` now
  asserts the chain claim is absent from M1 output AND from reachable (non-comment) code,
  with an in-test pointer to where the real protection lives. After update:
  **`tests/harness/audit-handoff-integrity.mutation.sh` → 18/18 PASS, exit 0.**

No dangling reds remain; `prior_greens_now_hold` is honest.

---

## scope / honesty notes (not blocking)

- **Surface 1 (auto-memory) not sandbox-driven through the producer.** The producer
  HARDCODES `AUTO_MEMORY_DIR` (line 69) with no env override, so faithfully driving it
  would require writing into the real `~/.claude/.../memory` dir — out of scope and not
  done. The producer fix touched only surfaces 2 and 3; surface 1's absolute-match clause
  was already present and unchanged. M2's reader-side surface-1 read was neutralized in
  the sandbox via `WL_AUTO_MEMORY_DIR` → empty temp dir.
- **`wireable_now` is bounded by Peat-at-the-seam.** M1-B (co-tamper) is closed ONLY by
  the append-only **history** witness, which depends on branch protection (no-force-push)
  on the witness ref — a toggle only Peat sets. The scripts are correct and inert; the
  only remaining step to go-live is the Peat-gated protection. Nothing here is wired,
  committed, or pushed.
- **CI substrate is already scaffolded and would stay green.** `.github/workflows/ci.yml`
  runs `scripts/audit-ledger-append-only.sh` with `fetch-depth: 0` (full history) —
  forge-resistant run gated on `refs/heads/integrity-witness` (`WL_WITNESS_REF: HEAD`),
  informational `continue-on-error` run on other refs. On the current real repo (no
  committed ledger) the audit returns NEUTRAL exit 0, so CI is green in the honest
  pre-operational state. The mutation suite and these re-validation harnesses are NOT
  CI-gated (they are Algol's local rails); only the trust-root witness is.
  **Go-live is a SEQUENCE, not a single toggle** (under-stating it would be the very
  false-green pattern this rail exists to catch): (1) wire `integrity-write-ledger.sh`
  in settings.json (Peat-gated); (2) baseline-seed the ledger with all existing
  handoffs/signatures — an explicit separate WRITER task per the script headers, without
  which M1-wired exits 4 on every unseeded file; (3) commit the seed; (4) set
  no-force-push branch protection on the `integrity-witness` ref (WITNESS-REF-DESIGN.md
  §4); (5) enable `WL_INTEGRITY_WIRED=1`. The audit scripts are correct and inert today;
  these five seam-steps remain.

## reproduce

```
bash tests/harness/m-revalidate-real-producer.sh             # 16/16 PASS, exit 0
bash tests/harness/m-revalidate-trustroot-discriminator.sh   # acceptance line, exit 0
```

## verdict

- `prior_greens_now_hold = TRUE` — M1/M2/witness greens hold on a real-producer absolute-path ledger
- `producer_now_records_security_surfaces = TRUE` — handoff + signature entries written (repo-relative)
- `any_bypass_remains = FALSE` — A/C/D, M1-B, M2-C5, deletion, drift all CAUGHT
- `wireable_now = TRUE` (scripts correct + inert) — pending only Peat's witness-ref branch protection at the seam

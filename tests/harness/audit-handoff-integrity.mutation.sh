#!/usr/bin/env bash
# tests/harness/audit-handoff-integrity.mutation.sh
# Algol (α-VER-06) — adversarial mutation + regression test for sensor M1-handoff-integrity.
# Canopus (α-HRN-07) — v2 update: cases updated for FALSE-HAVE fixes.
#
# MANDATE: exercise both the sensor's known catches and the four FALSE-HAVE
# fixes. After v2 fixes land:
#   - [A-unwired] forged unlisted, WL_INTEGRITY_WIRED unset → still exit 0
#   - [A-wired]   forged unlisted, WL_INTEGRITY_WIRED=1 → exit 4 (NEW)
#   - [B]         ledger co-tamper, single terminal line → exit 0 from M1
#                 (invisible to M1 by construction; CAUGHT by the append-only
#                  cross-commit history layer, audit-ledger-append-only.sh).
#                 Asserts the stripped chain claim is GONE (no chain_warn/CHAIN).
#   - [B-chain]   RETIRED — the in-file prev_hash chain was a FALSE-HAVE (the real
#                 producer never emits prev_hash). Stripped. Now asserts the chain
#                 claim is absent from output AND source. Co-tamper closure was
#                 re-validated on a real-producer ledger — see
#                 docs/qa/REPORTS/M-REVALIDATE-real-producer-absolute-path.md.
#   - [C]         malformed line + tampered entry → tamper IS caught (exit 1, NOT exit 0)
#   - [C-mech]    verify jq -Rc fromjson? // empty is line-tolerant (NEW)
#   - [C4]        canonicalization under WL_HANDOFFS_DIR override is correct (NEW)
#
# SAFETY (binding):
#   - POLICY-NO-INPLACE-MUTATION: every fixture is built in a fresh mktemp dir.
#     A trap restores/cleans on EVERY exit path. NO real tracked file is touched.
#   - No curl/wget/rm of repo files; cleanup uses `rm -rf` only on the temp dir
#     we created (its path is captured in TMPROOT and asserted to be under TMPDIR).
#   - .claude/beta/** is never read/scanned/touched.
#   - Overrides WL_INTEGRITY_LEDGER + WL_HANDOFFS_DIR keep the audit pointed
#     entirely at temp fixtures.
#
# Run: bash tests/harness/audit-handoff-integrity.mutation.sh
# Exit 0 iff all assertions hold (the audit behaves as each case predicts).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
AUDIT="$REPO_DIR/scripts/audit-handoff-integrity.sh"

if [[ ! -f "$AUDIT" ]]; then
  printf 'FATAL: audit script not found at %s\n' "$AUDIT" >&2
  exit 2
fi

# --- Temp sandbox + trap-restore (POLICY-NO-INPLACE-MUTATION) ----------------
TMPROOT="$(mktemp -d "${TMPDIR:-/tmp}/m1-mut.XXXXXX")"
cleanup() {
  # Defensive: only ever remove the temp dir we created.
  case "$TMPROOT" in
    "${TMPDIR:-/tmp}"/m1-mut.*|/tmp/m1-mut.*|/var/folders/*/m1-mut.*)
      rm -rf "$TMPROOT" 2>/dev/null || true ;;
    *) printf 'WARN: refusing to clean unexpected TMPROOT=%s\n' "$TMPROOT" >&2 ;;
  esac
}
trap cleanup EXIT INT TERM

PASS=0
FAIL=0
note() { printf '%s\n' "$*"; }
ok()   { PASS=$((PASS+1)); printf '  PASS · %s\n' "$*"; }
bad()  { FAIL=$((FAIL+1)); printf '  FAIL · %s\n' "$*"; }

# run_audit <ledger> <handoffs_dir> [VAR=VALUE ...] -> sets RC and OUT
# Extra env vars are passed as VAR=VALUE strings and forwarded via `env`.
run_audit() {
  local ledger="$1" hdir="$2"; shift 2
  # Build env-var list. Always present:
  local env_args=(
    "CLAUDE_PROJECT_DIR=$REPO_DIR"
    "WL_INTEGRITY_LEDGER=$ledger"
    "WL_HANDOFFS_DIR=$hdir"
    "WL_TASK_ID=m1-mutation-$RANDOM"
  )
  # Append any caller-supplied VAR=VALUE overrides
  while [[ $# -gt 0 ]]; do
    env_args+=("$1"); shift
  done
  OUT="$(env "${env_args[@]}" bash "$AUDIT" 2>&1)"
  RC=$?
}

sha_of() { sha256sum "$1" | awk '{print $1}'; }

# ledger_line <path> <sha> <author> -> echoes one canonical JSONL entry (no prev_hash)
ledger_line() {
  jq -cn --arg path "$1" --arg sha256 "$2" --arg author "$3" --arg ts "2026-06-04T00:00:00Z" \
    '{"path":$path,"sha256":$sha256,"author":$author,"ts":$ts}'
}

# chained_ledger_line <path> <sha> <author> <prev_hash> -> echoes a JSONL entry with prev_hash
chained_ledger_line() {
  jq -cn --arg path "$1" --arg sha256 "$2" --arg author "$3" --arg ts "2026-06-04T00:00:00Z" \
         --arg prev_hash "$4" \
    '{"path":$path,"sha256":$sha256,"author":$author,"ts":$ts,"prev_hash":$prev_hash}'
}

# Build a clean, verifying fixture into $1 (case dir). Creates:
#   <case>/handoffs/from-sirius/h1.md   (recorded, sha-matching, author=sirius)
#   <case>/ledger.jsonl
# Echoes nothing; sets globals CASE_HDIR, CASE_LEDGER.
build_clean_fixture() {
  local case_dir="$1"
  CASE_HDIR="$case_dir/handoffs"
  CASE_LEDGER="$case_dir/ledger.jsonl"
  mkdir -p "$CASE_HDIR/from-sirius"
  printf 'HANDOFF from sirius — original body.\n' > "$CASE_HDIR/from-sirius/h1.md"
  local p=".claude/handoffs/from-sirius/h1.md"
  ledger_line "$p" "$(sha_of "$CASE_HDIR/from-sirius/h1.md")" "sirius" > "$CASE_LEDGER"
}

# Build a chained verifying fixture (adds prev_hash fields to the single entry).
# The first (and only) entry carries prev_hash = "0"*64.
build_chained_fixture() {
  local case_dir="$1"
  CASE_HDIR="$case_dir/handoffs"
  CASE_LEDGER="$case_dir/ledger.jsonl"
  mkdir -p "$CASE_HDIR/from-sirius"
  printf 'HANDOFF from sirius — original body.\n' > "$CASE_HDIR/from-sirius/h1.md"
  local p=".claude/handoffs/from-sirius/h1.md"
  local zero_hash; zero_hash="$(printf '%0.s0' {1..64})"
  chained_ledger_line "$p" "$(sha_of "$CASE_HDIR/from-sirius/h1.md")" "sirius" "$zero_hash" \
    > "$CASE_LEDGER"
}

note "=============================================================="
note "M1-handoff-integrity · adversarial mutation + regression suite (v2)"
note "audit: $AUDIT"
note "sandbox: $TMPROOT"
note "=============================================================="

# ---------------------------------------------------------------------------
# CONFIRMATORY 1 — untampered recorded handoff → exit 0
# ---------------------------------------------------------------------------
note ""
note "[C1] untampered recorded handoff -> expect exit 0"
C="$TMPROOT/c1"; mkdir -p "$C"; build_clean_fixture "$C"
run_audit "$CASE_LEDGER" "$CASE_HDIR"
if [[ "$RC" -eq 0 ]]; then ok "untampered -> exit 0 (RC=$RC)"; else bad "untampered expected 0 got $RC"; fi

# ---------------------------------------------------------------------------
# CONFIRMATORY 2 — in-band tamper of recorded handoff body → non-zero
#   (file edited out-of-band; ledger NOT updated; on-disk sha != latest sha)
# ---------------------------------------------------------------------------
note ""
note "[C2] in-band body tamper, ledger stale -> expect non-zero (SHA_MATCH fail)"
C="$TMPROOT/c2"; mkdir -p "$C"; build_clean_fixture "$C"
printf 'TAMPERED body — injected out-of-band.\n' > "$CASE_HDIR/from-sirius/h1.md"
run_audit "$CASE_LEDGER" "$CASE_HDIR"
if [[ "$RC" -ne 0 ]] && grep -q 'SHA_MISMATCH' <<<"$OUT"; then
  ok "body tamper -> exit $RC with SHA_MISMATCH"
else
  bad "body tamper expected non-zero+SHA_MISMATCH; got RC=$RC"
fi

# ---------------------------------------------------------------------------
# CONFIRMATORY 3 — author-dir mismatch → non-zero
#   file lives under from-vega/ but ledger records author=sirius
# ---------------------------------------------------------------------------
note ""
note "[C3] author-dir mismatch -> expect non-zero (AUTHOR_MISMATCH)"
C="$TMPROOT/c3"; mkdir -p "$C"
HDIR="$C/handoffs"; LED="$C/ledger.jsonl"
mkdir -p "$HDIR/from-vega"
printf 'handoff body.\n' > "$HDIR/from-vega/h1.md"
P=".claude/handoffs/from-vega/h1.md"
# ledger says author=sirius, but dir is from-vega -> mismatch
ledger_line "$P" "$(sha_of "$HDIR/from-vega/h1.md")" "sirius" > "$LED"
run_audit "$LED" "$HDIR"
if [[ "$RC" -ne 0 ]] && grep -q 'AUTHOR_MISMATCH' <<<"$OUT"; then
  ok "author mismatch -> exit $RC with AUTHOR_MISMATCH"
else
  bad "author mismatch expected non-zero+AUTHOR_MISMATCH; got RC=$RC"
fi

# ---------------------------------------------------------------------------
# FIX 1 — [A-unwired] FORGED UNLISTED HANDOFF, WL_INTEGRITY_WIRED unset
#
# One verifying entry + a SECOND on-disk handoff with NO ledger entry.
# WL_INTEGRITY_WIRED is not set (pre-wiring state).
# EXPECT (post-fix): exit 0, status=OK, unlisted_on_disk=1.
#   The fix only activates when WL_INTEGRITY_WIRED=1. Pre-wiring, the existing
#   behavior is preserved — unlisted files are informational.
# ---------------------------------------------------------------------------
note ""
note "[A-unwired] forged UNLISTED handoff, WL_INTEGRITY_WIRED unset -> exit 0 (pre-wiring, informational)"
C="$TMPROOT/a-unwired"; mkdir -p "$C"; build_clean_fixture "$C"
# Drop a forged handoff that the hook never recorded:
printf 'FORGED handoff — written out-of-band, never ledgered.\n' \
  > "$CASE_HDIR/from-sirius/forged.md"
run_audit "$CASE_LEDGER" "$CASE_HDIR"
A_RC="$RC"; A_OUT="$OUT"
note "    audit RC=$A_RC"
note "$(grep -E 'unlisted_on_disk|verified_ok|RESULT' <<<"$A_OUT" | sed 's/^/    /')"
# Expect: exit 0 (pre-wiring; unlisted is informational)
if [[ "$A_RC" -eq 0 ]] && grep -q 'status=OK' <<<"$A_OUT"; then
  ok "pre-wiring: forged handoff present -> exit 0 status=OK (unlisted informational, correct pre-wiring behavior)"
else
  bad "pre-wiring: expected exit 0 + status=OK; got RC=$A_RC"
fi
# Post-fix C4: verify_ok=1, unlisted_on_disk=1 (the canonicalization is now correct)
if grep -q 'verified_ok=1' <<<"$A_OUT" && grep -q 'unlisted_on_disk=1' <<<"$A_OUT"; then
  ok "[C4-fixed] canonicalization correct: verified_ok=1, unlisted_on_disk=1 (no double-count)"
else
  bad "[C4] expected verified_ok=1 and unlisted_on_disk=1 (C4 fix); got: $(grep 'verified_ok\|unlisted_on_disk' <<<"$A_OUT")"
fi

# ---------------------------------------------------------------------------
# FIX 1 — [A-wired] FORGED UNLISTED HANDOFF, WL_INTEGRITY_WIRED=1
#
# Same fixture as [A-unwired] plus the forged file. WL_INTEGRITY_WIRED=1.
# EXPECT (post-fix): exit 4 UNVERIFIABLE_PRESENT.
# ---------------------------------------------------------------------------
note ""
note "[A-wired] forged UNLISTED handoff, WL_INTEGRITY_WIRED=1 -> exit 4 UNVERIFIABLE_PRESENT (Fix 1)"
C="$TMPROOT/a-wired"; mkdir -p "$C"; build_clean_fixture "$C"
printf 'FORGED handoff — written out-of-band, never ledgered.\n' \
  > "$CASE_HDIR/from-sirius/forged.md"
run_audit "$CASE_LEDGER" "$CASE_HDIR" WL_INTEGRITY_WIRED=1
AW_RC="$RC"; AW_OUT="$OUT"
note "    audit RC=$AW_RC"
note "$(grep -E 'unlisted_on_disk|RESULT|UNVERIFIABLE' <<<"$AW_OUT" | sed 's/^/    /')"
if [[ "$AW_RC" -eq 4 ]] && grep -q 'UNVERIFIABLE_PRESENT' <<<"$AW_OUT"; then
  ok "wired-mode: forged handoff -> exit 4 UNVERIFIABLE_PRESENT (Fix 1 enforced)"
else
  bad "wired-mode: expected exit 4 + UNVERIFIABLE_PRESENT; got RC=$AW_RC"
fi

# ---------------------------------------------------------------------------
# FIX 1 — [A-wired-clean] All files ledgered, WL_INTEGRITY_WIRED=1 → exit 0
#   Regression: wired mode must not false-positive when all files are recorded.
# ---------------------------------------------------------------------------
note ""
note "[A-wired-clean] all files ledgered, WL_INTEGRITY_WIRED=1 -> exit 0 (no false positive)"
C="$TMPROOT/a-wired-clean"; mkdir -p "$C"; build_clean_fixture "$C"
run_audit "$CASE_LEDGER" "$CASE_HDIR" WL_INTEGRITY_WIRED=1
AWC_RC="$RC"
if [[ "$AWC_RC" -eq 0 ]]; then
  ok "wired-mode no-unlisted -> exit 0 (no false positive)"
else
  bad "wired-mode clean: expected exit 0; got RC=$AWC_RC"
fi

# ---------------------------------------------------------------------------
# [B] LEDGER CO-TAMPER on a single (terminal) ledger line — single-entry sha
#   rewrite. Tamper the file AND rewrite that entry's sha256 to the tampered
#   value. author kept = dir. distinct-sha count stays 1.
#
#   EXPECT: exit 0 from THIS script. A co-tamper is invisible to any audit that
#   reads only the current ledger (sha and disk both match by construction).
#   This is correct and intended: M1 (audit-handoff-integrity.sh) is NOT the
#   layer that catches a co-tamper.
#
#   RETIRED (M1-hygiene · TASK-2026-06-04-M1-CHAIN-STRIP): this case previously
#   also asserted `chain_warn=1`. The in-file prev_hash chain was a confirmed
#   FALSE-HAVE (round-1 refutation B; the real producer never emits prev_hash,
#   so the chain was decorative and recompute-forgeable). It was STRIPPED. The
#   co-tamper is now caught at the correct layer — the append-only cross-commit
#   history witness in scripts/audit-ledger-append-only.sh — RE-VALIDATED on a
#   real-producer ledger to catch this exact co-tamper at exit 1 VIOLATION
#   (see docs/qa/REPORTS/M-REVALIDATE-real-producer-absolute-path.md, M1-B).
#   This block now asserts the chain claim is GONE (no chain_warn / CHAIN token).
# ---------------------------------------------------------------------------
note ""
note "[B] ledger co-tamper, single terminal line -> exit 0 from M1 (caught by append-only layer)"
C="$TMPROOT/b"; mkdir -p "$C"
HDIR="$C/handoffs"; LED="$C/ledger.jsonl"
mkdir -p "$HDIR/from-sirius"
printf 'TAMPERED body — and ledger rewritten to bless it.\n' > "$HDIR/from-sirius/h1.md"
P=".claude/handoffs/from-sirius/h1.md"
# Single entry whose sha == the tampered file's sha (co-tamper blesses the body).
ledger_line "$P" "$(sha_of "$HDIR/from-sirius/h1.md")" "sirius" > "$LED"
run_audit "$LED" "$HDIR"
B_RC="$RC"; B_OUT="$OUT"
note "    audit RC=$B_RC"
note "$(grep -E 'verified_ok|failed=|RESULT' <<<"$B_OUT" | sed 's/^/    /')"
if [[ "$B_RC" -eq 0 ]] && grep -q 'status=OK' <<<"$B_OUT"; then
  ok "co-tamper invisible to M1 by construction -> exit 0 (correct; append-only layer is the catcher)"
else
  bad "co-tamper: expected exit 0 from M1; got RC=$B_RC"
fi
# RETIRED-ASSERTION (chain stripped): the chain claim must now be ABSENT.
# Confirm the script no longer emits any chain_warn / CHAIN token — the
# false-have advertisement is gone.
if ! grep -qE 'chain_warn|CHAIN_(WARN|BROKEN|INTACT)' <<<"$B_OUT"; then
  ok "chain claim retired: no chain_warn/CHAIN token in M1 output (FALSE-HAVE removed)"
else
  bad "chain token still present after strip: $(grep -E 'chain_warn|CHAIN' <<<"$B_OUT")"
fi

# ---------------------------------------------------------------------------
# [B-chain] — RETIRED (M1-hygiene · TASK-2026-06-04-M1-CHAIN-STRIP)
#
#   This case previously hand-built a chained ledger (prev_hash present) with the
#   test-only `chained_ledger_line` helper and asserted exit 2 CHAIN_BROKEN. It
#   passed ONLY against that synthetic fixture — the real producer
#   (integrity-write-ledger.sh) NEVER emits prev_hash, so the asserted behavior
#   could not occur on any production ledger (round-1 re-refutation B, confirmed
#   empirically: jq 'has("prev_hash")' on a real-writer line -> false). An audit
#   verified against a fixture the producer cannot generate is decorative — a
#   verifier with no producer. The chain block was STRIPPED from
#   audit-handoff-integrity.sh.
#
#   The co-tamper this case targeted is NOT lost: it is closed at the correct
#   layer — the append-only cross-commit history witness
#   (scripts/audit-ledger-append-only.sh). That layer was RE-VALIDATED on a
#   REAL-PRODUCER, absolute-path-seeded ledger and catches the co-tamper at exit 1
#   VIOLATION even though stored-sha == disk-sha (a recompute is fully defeated).
#   See docs/qa/REPORTS/M-REVALIDATE-real-producer-absolute-path.md (Step 3, M1-B)
#   and tests/harness/m-revalidate-trustroot-discriminator.sh (acceptance line).
#
#   This block now asserts the retirement is honest: the script no longer claims
#   chain protection (no CHAIN_BROKEN / CHAIN_INTACT token reachable), so it
#   cannot ship a false-have into the gate.
# ---------------------------------------------------------------------------
note ""
note "[B-chain] RETIRED: chain claim stripped — co-tamper now caught by append-only layer (see report)"
C="$TMPROOT/b-chain"; mkdir -p "$C"
HDIR="$C/handoffs"; LED="$C/ledger.jsonl"
mkdir -p "$HDIR/from-sirius"
# Drive a real-producer-shaped (NO prev_hash) ledger line and confirm the audit
# never emits a CHAIN token for it — the false-have advertisement is gone.
printf 'Original handoff body.\n' > "$HDIR/from-sirius/h1.md"
P1=".claude/handoffs/from-sirius/h1.md"
ledger_line "$P1" "$(sha_of "$HDIR/from-sirius/h1.md")" "sirius" > "$LED"
run_audit "$LED" "$HDIR"
BC_RC="$RC"; BC_OUT="$OUT"
note "    audit RC=$BC_RC"
note "$(grep -E 'CHAIN|RESULT|status' <<<"$BC_OUT" | sed 's/^/    /')"
# Assertion 1: clean real-producer-shaped ledger verifies (exit 0), no chain machinery.
if [[ "$BC_RC" -eq 0 ]] && grep -q 'status=OK' <<<"$BC_OUT"; then
  ok "real-producer-shaped (no prev_hash) ledger verifies clean -> exit 0"
else
  bad "expected exit 0 on real-producer-shaped ledger; got RC=$BC_RC"
fi
# Assertion 2: the stripped chain claim is genuinely absent from OUTPUT and from
# any REACHABLE CODE (non-comment lines). The word may remain in explanatory NOTE
# comments documenting the strip — that is honest provenance, not a live claim.
# We strip shell comments (leading-whitespace '#' lines) before grepping source.
SRC_CODE_CHAIN="$(grep -vE '^[[:space:]]*#' "$REPO_DIR/scripts/audit-handoff-integrity.sh" \
  | grep -E 'CHAIN_(BROKEN|INTACT|WARN)|chain_warn' || true)"
if ! grep -qE 'CHAIN_(BROKEN|INTACT|WARN)|chain_warn' <<<"$BC_OUT" \
   && [[ -z "$SRC_CODE_CHAIN" ]]; then
  ok "chain claim retired: absent from M1 output AND from reachable code (only in strip-documenting comments) — false-have removed"
else
  bad "chain claim still reachable: out=[$(grep -E 'CHAIN' <<<"$BC_OUT")] code=[$SRC_CODE_CHAIN]"
fi

# ---------------------------------------------------------------------------
# FIX 3 — [C] MALFORMED LINE + TAMPERED ENTRY
#   Post-fix: jq -Rc fromjson? // empty skips malformed lines; entries after
#   the bad line ARE indexed. The tampered entry IS found and sha-checked.
#   EXPECT: exit 1 SHA_MISMATCH on h1.md (tamper IS caught — not exit 0).
#
#   (Pre-fix: jq -r select aborted the stream; tampered entry was dropped;
#    exit 0 — the FALSE-HAVE. That false-have no longer exists post-fix.)
# ---------------------------------------------------------------------------
note ""
note "[C] malformed line + tampered entry -> exit 1 SHA_MISMATCH (Fix 3: line-tolerant, tamper caught)"
C="$TMPROOT/cc"; mkdir -p "$C"
HDIR="$C/handoffs"; LED="$C/ledger.jsonl"
mkdir -p "$HDIR/from-sirius"
# good.md: present + sha-matching
printf 'good handoff body.\n' > "$HDIR/from-sirius/good.md"
GOOD_SHA="$(sha_of "$HDIR/from-sirius/good.md")"
# h1.md on disk: TAMPERED (original sha recorded in ledger → will mismatch)
printf 'TAMPERED body.\n' > "$HDIR/from-sirius/h1.md"
P=".claude/handoffs/from-sirius/h1.md"
ORIG_SHA="$(printf 'original body.\n' | sha256sum | awk '{print $1}')"
{
  printf '%s\n' "$(ledger_line ".claude/handoffs/from-sirius/good.md" "$GOOD_SHA" "sirius")"
  printf '{ this is not valid json at all <<< }\n'      # malformed — skipped by fromjson?
  printf '%s\n' "$(ledger_line "$P" "$ORIG_SHA" "sirius")"  # tampered target — NOW indexed
} > "$LED"
run_audit "$LED" "$HDIR"
CC_RC="$RC"; CC_OUT="$OUT"
note "    audit RC=$CC_RC"
note "$(grep -E 'verified_ok|failed=|unlisted_on_disk|RESULT|SHA_MISMATCH' <<<"$CC_OUT" | sed 's/^/    /')"
# Expect: tamper IS caught (exit 1 + SHA_MISMATCH on h1.md)
if [[ "$CC_RC" -eq 1 ]] && grep -q 'SHA_MISMATCH' <<<"$CC_OUT"; then
  ok "malformed line skipped; tampered h1.md indexed and caught -> exit 1 SHA_MISMATCH (Fix 3 enforced)"
else
  bad "malformed-line + tamper: expected exit 1 + SHA_MISMATCH; got RC=$CC_RC"
fi

# ---------------------------------------------------------------------------
# FIX 3 — [C-mech] VERIFY LINE-TOLERANT PARSING IS ACTIVE
#   After fix 3, the script uses jq -Rc fromjson? // empty.
#   Verify directly that this form (unlike the old jq -r select) processes
#   entries after a malformed line.
# ---------------------------------------------------------------------------
note ""
note "[C-mech] jq -Rc fromjson? // empty is line-tolerant (skips bad lines, emits subsequent)"
JL="$TMPROOT/jqmech.jsonl"
{
  printf '%s\n' "$(ledger_line '.claude/handoffs/from-sirius/before.md' 'aaa' 'sirius')"
  printf '{ malformed <<< }\n'
  printf '%s\n' "$(ledger_line '.claude/handoffs/from-sirius/after.md' 'bbb' 'sirius')"
} > "$JL"
# The new parsing form used in the audit: line-tolerant
JQ_OUT="$(jq -Rc 'fromjson? // empty' "$JL" 2>/dev/null \
  | jq -r 'select(.path | test("\\.claude/handoffs/")) | .path' 2>/dev/null)"
if grep -q 'before.md' <<<"$JQ_OUT" && grep -q 'after.md' <<<"$JQ_OUT"; then
  ok "fromjson? // empty: 'before' AND 'after' both emitted -> line-tolerant (Fix 3 mechanism)"
else
  bad "expected both before.md and after.md in jq output; got: $JQ_OUT"
fi
# Also confirm: the OLD form (jq -r select) still aborts the stream.
# This verifies the fix is necessary, not just sufficient.
JQ_OLD="$(jq -r 'select(.path | test("\\.claude/handoffs/")) | .path' "$JL" 2>/dev/null)"
if grep -q 'before.md' <<<"$JQ_OLD" && ! grep -q 'after.md' <<<"$JQ_OLD"; then
  ok "OLD jq -r select: 'before' present, 'after' dropped -> confirms why fix was necessary"
else
  note "  (old form behavior may differ on this jq version; not a test failure)"
fi

# ---------------------------------------------------------------------------
# FIX 4 — [C4] CANONICALIZATION UNDER WL_HANDOFFS_DIR OVERRIDE
#   Post-fix: disk files are canonicalized by stripping HANDOFFS_DIR prefix,
#   not REPO_DIR prefix. So a verified file appears as verified_ok=1 and
#   unlisted_on_disk reflects only genuinely unlisted files.
#
#   Regression guard: one recorded+verified file → verified_ok=1, unlisted_on_disk=0.
# ---------------------------------------------------------------------------
note ""
note "[C4] canonicalization under WL_HANDOFFS_DIR override -> verified_ok=1 unlisted_on_disk=0 (Fix 4)"
C="$TMPROOT/c4"; mkdir -p "$C"; build_clean_fixture "$C"
run_audit "$CASE_LEDGER" "$CASE_HDIR"
C4_RC="$RC"; C4_OUT="$OUT"
note "    audit RC=$C4_RC"
note "$(grep -E 'verified_ok|unlisted_on_disk|RESULT' <<<"$C4_OUT" | sed 's/^/    /')"
if grep -q 'verified_ok=1' <<<"$C4_OUT" && grep -q 'unlisted_on_disk=0' <<<"$C4_OUT" && [[ "$C4_RC" -eq 0 ]]; then
  ok "canonicalization correct: verified_ok=1, unlisted_on_disk=0 (Fix 4 enforced)"
else
  bad "C4: expected verified_ok=1, unlisted_on_disk=0, exit 0; got RC=$C4_RC output: $(grep 'verified_ok\|unlisted_on_disk' <<<"$C4_OUT")"
fi

# ---------------------------------------------------------------------------
# EDGE — confirm fail-closed states still hold (regression guard on the honesty signal)
# ---------------------------------------------------------------------------
note ""
note "[E1] absent ledger -> expect exit 3 (fail-closed honesty signal)"
C="$TMPROOT/e1"; mkdir -p "$C/handoffs"
run_audit "$C/does-not-exist.jsonl" "$C/handoffs"
if [[ "$RC" -eq 3 ]] && grep -q 'LEDGER_ABSENT' <<<"$OUT"; then ok "absent -> exit 3"; else bad "absent expected 3 got $RC"; fi

note ""
note "[E2] empty ledger -> expect exit 3"
C="$TMPROOT/e2"; mkdir -p "$C/handoffs"; : > "$C/ledger.jsonl"
run_audit "$C/ledger.jsonl" "$C/handoffs"
if [[ "$RC" -eq 3 ]] && grep -qE 'LEDGER_EMPTY|LEDGER_ABSENT' <<<"$OUT"; then ok "empty -> exit 3"; else bad "empty expected 3 got $RC"; fi

note ""
note "[E3] ledger with non-handoff entries only -> expect exit 3 (NO_HANDOFF_ENTRIES)"
C="$TMPROOT/e3"; mkdir -p "$C/handoffs"
ledger_line "MEMORY.md" "abc123" "polaris" > "$C/ledger.jsonl"
run_audit "$C/ledger.jsonl" "$C/handoffs"
if [[ "$RC" -eq 3 ]] && grep -q 'NO_HANDOFF_ENTRIES' <<<"$OUT"; then ok "no-handoff -> exit 3"; else bad "no-handoff expected 3 got $RC"; fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
note ""
note "=============================================================="
note "RESULTS · PASS=$PASS FAIL=$FAIL"
note ""
note "Fix 1 (UNLISTED wired-mode gate):"
note "  A-unwired (pre-wiring): RC=$A_RC -> $([[ $A_RC -eq 0 ]] && echo 'exit 0 (correct pre-wiring behavior)' || echo 'UNEXPECTED')"
note "  A-wired (WL_INTEGRITY_WIRED=1): RC=$AW_RC -> $([[ $AW_RC -eq 4 ]] && echo 'exit 4 UNVERIFIABLE_PRESENT (enforced)' || echo 'FAIL')"
note "Fix 2 (chain claim RETIRED — false-have stripped; co-tamper caught by append-only layer):"
note "  B (single terminal line co-tamper): RC=$B_RC -> $([[ $B_RC -eq 0 ]] && echo 'exit 0 from M1 (correct; caught by audit-ledger-append-only.sh)' || echo 'UNEXPECTED')"
note "  B-chain (retired): RC=$BC_RC -> $([[ $BC_RC -eq 0 ]] && echo 'exit 0, chain claim absent in output+source (false-have removed)' || echo 'UNEXPECTED')"
note "Fix 3 (malformed-line tolerance):"
note "  C (malformed+tamper): RC=$CC_RC -> $([[ $CC_RC -eq 1 ]] && echo 'exit 1 SHA_MISMATCH (enforced)' || echo 'FAIL')"
note "Fix 4 (canonicalization):"
note "  C4: RC=$C4_RC -> $([[ $C4_RC -eq 0 ]] && echo 'exit 0 correct counts (enforced)' || echo 'FAIL')"
note "=============================================================="

[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1

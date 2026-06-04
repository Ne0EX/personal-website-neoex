#!/usr/bin/env bash
# tests/harness/m1-rerefute-b-discriminator.sh
# Algol — discriminator: does "writer emits prev_hash" actually close Refutation B?
# Two sub-tests, both within the temp/no-network/trap-restore envelope:
#   B1 (terminal entry): a SINGLE chained entry (prev_hash="0"*64), tamper body +
#       rewrite sha256, leave prev_hash. No successor exists to chain-check it.
#       Predict: exit 0 (bypass) -> proves chain is necessary-not-sufficient.
#   B2 (recompute attacker): a 2-entry chained ledger; attacker tampers entry 1
#       AND recomputes entry 2's prev_hash over the new text. Whole chain
#       re-validates. Predict: exit 0 (bypass) -> proves unauthenticated chain
#       is recomputable by a ledger-write-capable attacker.

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
AUDIT="$REPO_DIR/scripts/audit-handoff-integrity.sh"

TMP="$(mktemp -d "${TMPDIR:-/tmp}/m1-bdisc.XXXXXX")"
cleanup() {
  case "$TMP" in
    "${TMPDIR:-/tmp}"/m1-bdisc.*|/tmp/m1-bdisc.*|/var/folders/*/m1-bdisc.*)
      rm -rf "$TMP" 2>/dev/null || true ;;
    *) echo "WARN refusing to clean $TMP" >&2 ;;
  esac
}
trap cleanup EXIT INT TERM

sha_of() { sha256sum "$1" | awk '{print $1}'; }
ZERO="$(printf '%0.s0' {1..64})"
chained() { jq -cn --arg p "$1" --arg s "$2" --arg a "$3" --arg ts "2026-06-04T00:00:00Z" --arg ph "$4" \
  '{"path":$p,"sha256":$s,"author":$a,"ts":$ts,"prev_hash":$ph}'; }

run_audit() {
  local ledger="$1" hdir="$2"; shift 2
  local env_args=("CLAUDE_PROJECT_DIR=$REPO_DIR" "WL_INTEGRITY_LEDGER=$ledger" "WL_HANDOFFS_DIR=$hdir" "WL_TASK_ID=bdisc-$RANDOM")
  while [[ $# -gt 0 ]]; do env_args+=("$1"); shift; done
  OUT="$(env "${env_args[@]}" bash "$AUDIT" 2>&1)"; RC=$?
}

echo "=== B-discriminator: does a prev_hash-emitting writer close B? ==="

# ---- B1: single chained terminal entry, co-tamper in place ----
echo ""
echo "[B1] single chained entry (terminal), co-tamper body+sha, leave prev_hash, WIRED=1"
H1="$TMP/b1/handoffs"; L1="$TMP/b1/ledger.jsonl"; mkdir -p "$H1/from-sirius"
printf 'TAMPERED body — single chained entry, blessed in place.\n' > "$H1/from-sirius/h1.md"
P=".claude/handoffs/from-sirius/h1.md"
# Chained single entry whose sha == the tampered file's sha; prev_hash = genesis.
chained "$P" "$(sha_of "$H1/from-sirius/h1.md")" "sirius" "$ZERO" > "$L1"
run_audit "$L1" "$H1" WL_INTEGRITY_WIRED=1
echo "    RC=$RC"; grep -E 'verified_ok|failed=|CHAIN|RESULT|status' <<<"$OUT" | sed 's/^/    /'
if [[ "$RC" -eq 0 ]] && grep -q 'status=OK' <<<"$OUT"; then
  echo "    >>> B1 BYPASS: terminal chained entry co-tamper -> exit 0 (chain does NOT cover the last entry)"
  B1=1; else echo "    B1 no bypass RC=$RC"; B1=0; fi

# ---- B2: 2-entry chain, attacker recomputes entry 2's prev_hash ----
echo ""
echo "[B2] 2-entry chain, attacker tampers entry1 + RECOMPUTES entry2 prev_hash, WIRED=1"
H2="$TMP/b2/handoffs"; L2="$TMP/b2/ledger.jsonl"; mkdir -p "$H2/from-sirius"
printf 'TAMPERED body for h1.\n' > "$H2/from-sirius/h1.md"
printf 'body for h2.\n'          > "$H2/from-sirius/h2.md"
P1=".claude/handoffs/from-sirius/h1.md"; P2=".claude/handoffs/from-sirius/h2.md"
# Attacker forges entry1 to bless tampered h1, then recomputes entry2.prev_hash
LINE1="$(chained "$P1" "$(sha_of "$H2/from-sirius/h1.md")" "sirius" "$ZERO")"
HASH1="$(printf '%s' "$LINE1" | sha256sum | awk '{print $1}')"
LINE2="$(chained "$P2" "$(sha_of "$H2/from-sirius/h2.md")" "sirius" "$HASH1")"
printf '%s\n%s\n' "$LINE1" "$LINE2" > "$L2"
run_audit "$L2" "$H2" WL_INTEGRITY_WIRED=1
echo "    RC=$RC"; grep -E 'verified_ok|failed=|CHAIN|RESULT|status' <<<"$OUT" | sed 's/^/    /'
if [[ "$RC" -eq 0 ]] && grep -q 'status=OK' <<<"$OUT"; then
  echo "    >>> B2 BYPASS: recomputed chain re-validates -> exit 0 (unauthenticated chain is forgeable)"
  B2=1; else echo "    B2 no bypass RC=$RC"; B2=0; fi

echo ""
echo "=== DISCRIMINATOR VERDICT ==="
echo "  B1 terminal-entry bypass:   $([[ $B1 -eq 1 ]] && echo YES || echo no)"
echo "  B2 recompute bypass:        $([[ $B2 -eq 1 ]] && echo YES || echo no)"
if [[ $B1 -eq 1 || $B2 -eq 1 ]]; then
  echo "  => prev_hash-emitting writer is NECESSARY-NOT-SUFFICIENT to close B."
  exit 1
else
  echo "  => chain alone would suffice (unexpected)."
  exit 0
fi

#!/usr/bin/env bash
# tests/harness/algol-d5-refute.sh
# Algol (α-VER-06) — depth-5 sandbox refutation for sensor M1-handoff-integrity
#
# MANDATE: Verify the build-agent's reported fix (drop -maxdepth 3 from find)
# closes the named bypass D (a/b/c/forged.md at depth 5+), while A and C
# remain closed and the ledger-absent baseline still exits 3.
#
# SAFETY: mktemp sandbox only. No real tracked files mutated.
# No network. All state via WL_INTEGRITY_LEDGER / WL_HANDOFFS_DIR overrides.
#
# Run: bash tests/harness/algol-d5-refute.sh

set -uo pipefail

REPO="/Users/neospiritth/codingspace/personal_website"
AUDIT="$REPO/scripts/audit-handoff-integrity.sh"
WRITER="$REPO/.claude/hooks/integrity-write-ledger.sh"

[[ -f "$AUDIT" ]]  || { echo "FATAL: audit missing $AUDIT"; exit 2; }
[[ -f "$WRITER" ]] || { echo "FATAL: writer missing $WRITER"; exit 2; }

TMP="$(mktemp -d "${TMPDIR:-/tmp}/algol-d5.XXXXXX")"
cleanup() {
  case "$TMP" in
    "${TMPDIR:-/tmp}"/algol-d5.*|/tmp/algol-d5.*|/var/folders/*/algol-d5.*)
      rm -rf "$TMP" 2>/dev/null || true ;;
    *) echo "WARN refusing to clean unexpected TMP=$TMP" >&2 ;;
  esac
}
trap cleanup EXIT INT TERM

run_audit() {
  local ledger="$1" hdir="$2"; shift 2
  local env_args=("CLAUDE_PROJECT_DIR=$REPO" "WL_INTEGRITY_LEDGER=$ledger" "WL_HANDOFFS_DIR=$hdir" "WL_TASK_ID=algol-d5-$RANDOM")
  while [[ $# -gt 0 ]]; do env_args+=("$1"); shift; done
  OUT="$(env "${env_args[@]}" bash "$AUDIT" 2>&1)"; RC=$?
}

echo "=============================================================="
echo "ALGOL M1 depth-5 sandbox refutation"
echo "sandbox: $TMP"
echo "=============================================================="

# ---------------------------------------------------------------------------
# D5 — forged handoff at exactly a/b/c/forged.md (depth 5 from handoffs root)
# Old find -maxdepth 3 would miss this. New unbounded find must catch it.
# ---------------------------------------------------------------------------
echo ""
echo "[D5] Plant forged.md at from-sirius/a/b/c/forged.md (depth 5), WIRED=1"
PD="$TMP/d5"
mkdir -p "$PD/.claude/handoffs/from-sirius"
LED_D="$PD/ledger.jsonl"
HDIR_D="$PD/.claude/handoffs"

printf 'HANDOFF from sirius -- legitimate.\n' > "$HDIR_D/from-sirius/h1.md"
MOCK_JSON="$(jq -cn --arg fp ".claude/handoffs/from-sirius/h1.md" '{"tool_name":"Write","tool_input":{"file_path":$fp}}')"
printf '%s' "$MOCK_JSON" | env \
  CLAUDE_PROJECT_DIR="$PD" \
  WL_INTEGRITY_LEDGER="$LED_D" \
  WL_AGENT="sirius" \
  WL_TASK_ID="d5-setup" \
  bash "$WRITER"

echo "[D5] ledger after real write:"
cat "$LED_D" | sed 's/^/    /'

# plant forged at a/b/c/forged.md — depth 5 below handoffs root
mkdir -p "$HDIR_D/from-sirius/a/b/c"
printf 'FORGED deep handoff at depth 5 -- never ledgered.\n' > "$HDIR_D/from-sirius/a/b/c/forged.md"

echo ""
echo "[D5] old find -maxdepth 3 would see:"
find "$HDIR_D" -maxdepth 3 -type f -name "*.md" 2>/dev/null | sed "s#$HDIR_D/##" | sed 's/^/    /'
echo "[D5] new unbounded find sees:"
find "$HDIR_D" -type f -name "*.md" 2>/dev/null | sed "s#$HDIR_D/##" | sed 's/^/    /'

run_audit "$LED_D" "$HDIR_D" "WL_INTEGRITY_WIRED=1"
D5_RC="$RC"; D5_OUT="$OUT"
echo "[D5] audit RC=$D5_RC"
grep -E 'disk_files|unlisted_on_disk|UNVERIFIABLE|RESULT|status' <<<"$D5_OUT" | sed 's/^/    /'

if [[ "$D5_RC" -eq 4 ]] && grep -q 'UNVERIFIABLE_PRESENT' <<<"$D5_OUT" && grep -q 'unlisted_on_disk=1' <<<"$D5_OUT"; then
  echo "[D5] >>> CLOSED: depth-5 forged caught -> exit 4 UNVERIFIABLE_PRESENT"
  D5_CLOSED=1
else
  echo "[D5] >>> OPEN: depth-5 forged NOT caught (RC=$D5_RC)"
  D5_CLOSED=0
fi

# ---------------------------------------------------------------------------
# A — forged unlisted at flat depth, WIRED=1. Must exit 4 (was already closed).
# Regression check: the find change must not break this.
# ---------------------------------------------------------------------------
echo ""
echo "[A] Flat forged unlisted handoff, WIRED=1 -> expect exit 4"
PA="$TMP/a"
mkdir -p "$PA/.claude/handoffs/from-sirius"
LED_A="$PA/ledger.jsonl"; HDIR_A="$PA/.claude/handoffs"
printf 'HANDOFF from sirius -- original.\n' > "$HDIR_A/from-sirius/h1.md"
printf '%s' "$(jq -cn --arg fp ".claude/handoffs/from-sirius/h1.md" '{"tool_name":"Write","tool_input":{"file_path":$fp}}')" \
  | env CLAUDE_PROJECT_DIR="$PA" WL_INTEGRITY_LEDGER="$LED_A" WL_AGENT="sirius" WL_TASK_ID="ra" bash "$WRITER"
printf 'FORGED handoff -- never ledgered.\n' > "$HDIR_A/from-sirius/forged.md"
run_audit "$LED_A" "$HDIR_A" "WL_INTEGRITY_WIRED=1"
A_RC="$RC"
echo "[A] audit RC=$A_RC"
grep -E 'unlisted_on_disk|UNVERIFIABLE|RESULT' <<<"$OUT" | sed 's/^/    /'
if [[ "$A_RC" -eq 4 ]] && grep -q 'UNVERIFIABLE_PRESENT' <<<"$OUT"; then
  echo "[A] >>> CLOSED (exit 4)"
  A_CLOSED=1
else
  echo "[A] >>> OPEN (RC=$A_RC)"
  A_CLOSED=0
fi

# ---------------------------------------------------------------------------
# C — malformed line + tampered real-writer entry -> expect exit 1 SHA_MISMATCH.
# Regression check: find change must not affect ledger-parse path.
# ---------------------------------------------------------------------------
echo ""
echo "[C] Malformed ledger line + tampered handoff -> expect exit 1 SHA_MISMATCH"
PC="$TMP/c"
mkdir -p "$PC/.claude/handoffs/from-sirius"
LED_C="$PC/ledger.jsonl"; HDIR_C="$PC/.claude/handoffs"
printf 'good handoff body.\n' > "$HDIR_C/from-sirius/good.md"
printf '%s' "$(jq -cn --arg fp ".claude/handoffs/from-sirius/good.md" '{"tool_name":"Write","tool_input":{"file_path":$fp}}')" \
  | env CLAUDE_PROJECT_DIR="$PC" WL_INTEGRITY_LEDGER="$LED_C" WL_AGENT="sirius" WL_TASK_ID="rc1" bash "$WRITER"
printf 'original body.\n' > "$HDIR_C/from-sirius/h1.md"
printf '%s' "$(jq -cn --arg fp ".claude/handoffs/from-sirius/h1.md" '{"tool_name":"Write","tool_input":{"file_path":$fp}}')" \
  | env CLAUDE_PROJECT_DIR="$PC" WL_INTEGRITY_LEDGER="$LED_C" WL_AGENT="sirius" WL_TASK_ID="rc2" bash "$WRITER"
# Inject malformed line between the two real lines
GOOD_LINE="$(sed -n '1p' "$LED_C")"
H1_LINE="$(sed -n '2p' "$LED_C")"
printf '%s\n{ this is not valid json <<< }\n%s\n' "$GOOD_LINE" "$H1_LINE" > "$LED_C"
# Tamper h1.md on disk
printf 'TAMPERED body.\n' > "$HDIR_C/from-sirius/h1.md"
run_audit "$LED_C" "$HDIR_C"
C_RC="$RC"
echo "[C] audit RC=$C_RC"
grep -E 'verified_ok|failed=|SHA_MISMATCH|RESULT' <<<"$OUT" | sed 's/^/    /'
if [[ "$C_RC" -eq 1 ]] && grep -q 'SHA_MISMATCH' <<<"$OUT"; then
  echo "[C] >>> CLOSED (exit 1 SHA_MISMATCH)"
  C_CLOSED=1
else
  echo "[C] >>> OPEN (RC=$C_RC)"
  C_CLOSED=0
fi

# ---------------------------------------------------------------------------
# Ledger-absent baseline — must stay exit 3, not collapse to 0
# ---------------------------------------------------------------------------
echo ""
echo "[ledger-absent] No ledger file -> expect exit 3"
PL="$TMP/l"; mkdir -p "$PL/.claude/handoffs/from-sirius"
HDIR_L="$PL/.claude/handoffs"
printf 'some handoff.\n' > "$HDIR_L/from-sirius/h1.md"
run_audit "/dev/null/nonexistent.jsonl" "$HDIR_L"
L_RC="$RC"
echo "[ledger-absent] audit RC=$L_RC"
grep -E 'LEDGER_ABSENT|RESULT' <<<"$OUT" | sed 's/^/    /'
if [[ "$L_RC" -eq 3 ]]; then
  echo "[ledger-absent] exit 3 confirmed"
  LA_OK=1
else
  echo "[ledger-absent] WRONG: RC=$L_RC"
  LA_OK=0
fi

# ---------------------------------------------------------------------------
# VERDICT
# ---------------------------------------------------------------------------
echo ""
echo "=============================================================="
echo "ALGOL D5 SANDBOX VERDICT"
echo "  D5 (depth-5 a/b/c/forged.md, wired):  $([[ $D5_CLOSED -eq 1 ]] && echo 'CLOSED (exit 4)' || echo 'OPEN')"
echo "  A  (flat forged unlisted, wired):      $([[ $A_CLOSED -eq 1 ]] && echo 'CLOSED (exit 4)' || echo 'OPEN')"
echo "  C  (malformed+tamper, unwired):        $([[ $C_CLOSED -eq 1 ]] && echo 'CLOSED (exit 1)' || echo 'OPEN')"
echo "  ledger-absent baseline:                $([[ $LA_OK -eq 1 ]] && echo 'exit 3 confirmed' || echo "WRONG: RC=$L_RC")"
echo "=============================================================="

if [[ $D5_CLOSED -eq 1 && $A_CLOSED -eq 1 && $C_CLOSED -eq 1 && $LA_OK -eq 1 ]]; then
  echo "LOCAL LAYER: all target refutations CLOSED — exit 0"
  exit 0
else
  echo "LOCAL LAYER: at least one target refutation OPEN or baseline wrong — exit 1"
  exit 1
fi

#!/usr/bin/env bash
# tests/harness/m-revalidate-trustroot-discriminator.sh
# Algol (α-VER-06) — acceptance-line discriminator for the M1-B trust-root.
#
# Proves the M1-B catch comes from CROSS-COMMIT HISTORY immutability, not from a
# hash recompute. On a real-producer ledger:
#   (1) co-tamper x.md body + bless its ledger sha in place -> stored==disk, so
#       an in-file RECOMPUTE audit PASSES (is fully defeated).
#   (2) the append-only cross-commit history audit still -> exit 1 VIOLATION.
# ACCEPTANCE LINE: a co-tamper that PASSES in-file recompute is CAUGHT by the
# cross-commit history diff.
#
# SAFETY: /tmp mktemp sandbox git repo only. No network, no tracked-file mutation.
# Run: bash tests/harness/m-revalidate-trustroot-discriminator.sh
set -uo pipefail
REPO_DIR="${CLAUDE_PROJECT_DIR:-/Users/neospiritth/codingspace/personal_website}"
WRITER="$REPO_DIR/.claude/hooks/integrity-write-ledger.sh"
AUDIT_APPEND="$REPO_DIR/scripts/audit-ledger-append-only.sh"
SB="$(mktemp -d "${TMPDIR:-/tmp}/algol-disc.XXXXXX")"
cleanup(){ case "$SB" in /tmp/*|/var/folders/*) rm -rf "$SB" 2>/dev/null||true;; esac; }
trap cleanup EXIT INT TERM
sha_of(){ sha256sum "$1"|awk '{print $1}'; }
PROD="$SB/repo"; LED="$PROD/.harness/integrity-ledger.jsonl"; LED_REL=".harness/integrity-ledger.jsonl"
mkdir -p "$PROD/.harness" "$PROD/.claude/handoffs/from-sirius"
git -C "$PROD" init -q; git -C "$PROD" config user.email a@b.c; git -C "$PROD" config user.name t
drive(){ printf '%s' "$(jq -cn --arg fp "$1" '{"tool_name":"Write","tool_input":{"file_path":$fp}}')" \
  | env CLAUDE_PROJECT_DIR="$PROD" WL_INTEGRITY_LEDGER="$LED" WL_AGENT="$2" WL_TASK_ID=d bash "$WRITER"; }

printf 'body one.\n' > "$PROD/.claude/handoffs/from-sirius/x.md"
drive "$PROD/.claude/handoffs/from-sirius/x.md" sirius
git -C "$PROD" add -A; git -C "$PROD" commit -q -m rev1
printf 'body two.\n' > "$PROD/.claude/handoffs/from-sirius/x2.md"
drive "$PROD/.claude/handoffs/from-sirius/x2.md" sirius
git -C "$PROD" add -A; git -C "$PROD" commit -q -m rev2

echo "=== CO-TAMPER: rewrite x.md body + bless ledger sha in place, commit revBAD ==="
printf 'CO-TAMPERED body — attacker controls both file and ledger.\n' > "$PROD/.claude/handoffs/from-sirius/x.md"
NEW="$(sha_of "$PROD/.claude/handoffs/from-sirius/x.md")"
T="$PROD/.harness/t"
while IFS= read -r ln; do
  if printf '%s' "$ln" | grep -q '"path":".claude/handoffs/from-sirius/x.md"'; then
    printf '%s\n' "$(printf '%s' "$ln" | jq -c --arg s "$NEW" '.sha256=$s')"
  else printf '%s\n' "$ln"; fi
done < "$LED" > "$T"; mv "$T" "$LED"
git -C "$PROD" add -A; git -C "$PROD" commit -q -m revBAD

echo "--- (1) in-file RECOMPUTE on the co-tampered working tree ---"
STORED_AFTER="$(jq -r 'select(.path==".claude/handoffs/from-sirius/x.md")|.sha256' <(jq -Rc 'fromjson? // empty' "$LED"))"
DISK_AFTER="$(sha_of "$PROD/.claude/handoffs/from-sirius/x.md")"
echo "stored sha (blessed):  $STORED_AFTER"
echo "disk   sha (tampered): $DISK_AFTER"
RC=0
if [[ "$STORED_AFTER" == "$DISK_AFTER" ]]; then
  echo ">>> RECOMPUTE PASSES (stored==disk) — recompute-only audit DEFEATED."
else
  echo ">>> recompute caught it (UNEXPECTED for a co-tamper)"; RC=1
fi

echo "--- (2) append-only CROSS-COMMIT history audit ---"
git -C "$PROD" rev-list --reverse --first-parent HEAD -- "$LED_REL" | sed 's/^/    rev /'
AP_OUT="$(env WL_REPO_ROOT="$PROD" WL_LEDGER_REL="$LED_REL" WL_TASK_ID=disc bash "$AUDIT_APPEND" 2>&1)"; AP_RC=$?
echo "$AP_OUT" | grep -E 'committed_revisions|VIOLATION|RESULT|status' | sed 's/^/    /'
if [[ "$AP_RC" -eq 1 ]] && echo "$AP_OUT" | grep -q VIOLATION; then
  echo ">>> ACCEPTANCE LINE MET: co-tamper passing recompute is CAUGHT by cross-commit history (exit 1)."
else
  echo ">>> ACCEPTANCE FAILED: history audit RC=$AP_RC"; RC=1
fi
exit $RC

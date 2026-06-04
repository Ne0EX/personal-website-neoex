#!/usr/bin/env bash
# .claude/hooks/integrity-write-guard.sh
# PostToolUse Write|Edit|MultiEdit hook — RBAC1 write-protection guard.
#
# RBAC1 Finding (ZERO-TRUST-CENSUS-2026-06-04.md line 162-163):
#   write-protect-beta gates ONLY .claude/beta/*. .claude/signatures/ and
#   MEMORY.md have NO write-gate — any agent can overwrite/delete a signature.
#   Tamper-evident (signatures carry self_hash) != tamper-resistant (nothing
#   blocks the overwrite in the first place).
#
# This hook extends write-protection to the RBAC1 surfaces:
#   - .claude/signatures/*.json  (signature payload files — write-once)
#   - .claude/signatures/AUDIT.md — EXCLUDED from write-once; it is an append-only
#     log that Algol updates legitimately on every audit run. Treating it as
#     write-once would block every Algol audit append (false-positive).
#     AUDIT.md is covered by the ledger hook (integrity-write-ledger.sh) for
#     observability, and by tamper-evidence in the signature chain (self_hash).
#   - ~/.claude/projects/…/memory/MEMORY.md  (the auto-memory index)
#
# Authorization model (derived from RBAC1 finding; flagged as assumption):
#   .claude/signatures/*.json  (excludes AUDIT.md):
#     CREATE (new file, no HEAD version) — ALLOWED for any agent (sign-work.sh
#     writes new signature .json files as part of the handoff workflow).
#     MODIFY (file exists in HEAD, content changes) — BLOCKED. Signature payload
#     files are write-once. A modification to an existing .json is tampering.
#   MEMORY.md (auto-memory index):
#     Only WL_AGENT=polaris may write MEMORY.md. All other agents are BLOCKED.
#     Rationale: MEMORY.md is the top-level index maintained exclusively by Polaris
#     (α-OPS-00). Agent memory files under memory/** are not gated here.
#   NOTE: sign-work.sh may re-run on the same task (resumed tasks). If it
#     overwrites an existing .json for the same task_id, that will BLOCK.
#     Legitimate fix: sign-work.sh should write to a new filename (already the
#     convention — filenames include task_id which changes per task). Document
#     as assumption flagged for Algol regression.
#
# NOTE ON POSTURE:
#   PostToolUse fires AFTER the write has already landed on disk. This hook cannot
#   prevent the write — it detects it and exits 1 to signal that the agent must
#   revert. The real teeth are: (a) this hook signal triggers a "revert required"
#   state, (b) sign-work.sh will not produce a valid signature if the harness is
#   failing, (c) block_handoff_if_invalid in the harness config prevents handoff.
#
# Failure mode: fail-closed (exit 1) on any detected violation.
# Always prints explicit revert instructions to stderr.
#
# Bash compatibility: bash 3.2 (macOS default). No associative arrays.
# Idempotent: same file state → same result.
# Logs to: .claude/hook-logs/<task_id>--integrity-write-guard.log
#
# Called by: .claude/settings.json PostToolUse (matcher: Write|Edit|MultiEdit)
# Not wired yet — see .harness/proposed-wiring-M.md

set -euo pipefail

REPO_DIR="${CLAUDE_PROJECT_DIR:-/Users/neospiritth/codingspace/personal_website}"
LOG_DIR="$REPO_DIR/.claude/hook-logs"
mkdir -p "$LOG_DIR"

TASK_ID="${CLAUDE_TASK_ID:-${WL_TASK_ID:-session-$(date +%s)}}"
AGENT="${WL_AGENT:-unknown}"
LOG="$LOG_DIR/${TASK_ID}--integrity-write-guard.log"
TIMESTAMP="$(date -u +%FT%TZ)"

# Auto-memory MEMORY.md (absolute path)
AUTO_MEMORY_DIR="/Users/neospiritth/.claude/projects/-Users-neospiritth-codingspace-personal-website/memory"
AUTO_MEMORY_MD="$AUTO_MEMORY_DIR/MEMORY.md"

# Temp dir (bash 3.2 compat)
TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t 'integrity-guard')"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Parse tool input from stdin
# ---------------------------------------------------------------------------
INPUT="$(cat)"
TOOL_NAME="$(printf '%s' "$INPUT" | jq -r '.tool_name // "unknown"')"

case "$TOOL_NAME" in
  Write|Edit|MultiEdit) ;;
  *)
    printf '[integrity-guard] %s · skipped (tool=%s)\n' "$TIMESTAMP" "$TOOL_NAME" >> "$LOG"
    exit 0
    ;;
esac

# ---------------------------------------------------------------------------
# extract_paths — same as write-protect-beta.sh
# ---------------------------------------------------------------------------
extract_paths() {
  local json="$1"
  local tool="$2"
  case "$tool" in
    Write)
      printf '%s' "$json" | jq -r '.tool_input.file_path // ""'
      ;;
    Edit)
      printf '%s' "$json" | jq -r '.tool_input.file_path // ""'
      ;;
    MultiEdit)
      printf '%s' "$json" | jq -r '.tool_input.file_path // (.tool_input.edits[]?.file_path // "")' 2>/dev/null \
        | sort -u
      ;;
    *)
      printf ''
      ;;
  esac
}

# ---------------------------------------------------------------------------
# check_file <raw_path>
# Returns 0 = PASS, 1 = BLOCK
# ---------------------------------------------------------------------------
check_file() {
  local raw_path="$1"
  local p="${raw_path#./}"
  local abs_p
  if [[ "$p" == /* ]]; then
    abs_p="$p"
  else
    abs_p="$REPO_DIR/$p"
  fi

  # --- EXCLUSION: beta — must be first, before any file reads ---
  if [[ "$p" == .claude/beta/* ]] || [[ "$abs_p" == "$REPO_DIR/.claude/beta/"* ]]; then
    return 0  # beta is governed by write-protect-beta.sh, not this hook
  fi

  # =========================================================================
  # Surface: .claude/signatures/*.json  (signature payload files — write-once)
  # NOTE: AUDIT.md is explicitly excluded. It is an append-only log that
  # Algol updates legitimately on every audit run. Write-once semantics
  # do not apply to a log file — that would block every legitimate append.
  # =========================================================================
  if [[ "$p" == .claude/signatures/* ]]; then
    # Exclude AUDIT.md from write-once gate
    local basename_p
    basename_p="$(basename "$p")"
    if [[ "$basename_p" == "AUDIT.md" ]]; then
      printf '[integrity-guard] PASS (AUDIT.md excluded from write-once gate — append-only log)\n' >> "$LOG"
      return 0
    fi

    printf '[integrity-guard] checking signature payload: %s (agent=%s)\n' "$p" "$AGENT" >> "$LOG"

    # ALLOW if file did not exist in HEAD (net-new signature payload file)
    if ! git -C "$REPO_DIR" cat-file -e "HEAD:$p" 2>/dev/null; then
      printf '[integrity-guard] PASS (new file, no HEAD version): %s\n' "$p" >> "$LOG"
      return 0
    fi

    # File existed in HEAD — check if content actually changed
    HEAD_TMP="$TMP_DIR/head-sig"
    git -C "$REPO_DIR" show "HEAD:$p" > "$HEAD_TMP" 2>/dev/null || printf '' > "$HEAD_TMP"

    if diff -q "$HEAD_TMP" "$abs_p" >/dev/null 2>&1; then
      printf '[integrity-guard] PASS (no change vs HEAD): %s\n' "$p" >> "$LOG"
      return 0
    fi

    # Content changed on an existing signature payload — BLOCK
    printf '[integrity-guard] BLOCKED — signature payload modified: %s\n' "$p" | tee -a "$LOG" >&2
    printf '[integrity-guard] Signature payloads are write-once. Modifying an existing .json is tampering.\n' | tee -a "$LOG" >&2
    printf '[integrity-guard] FIX: revert this edit. To update, sign-work.sh must write a new file.\n' | tee -a "$LOG" >&2
    printf '[integrity-guard] Agent: %s · Task: %s\n' "$AGENT" "$TASK_ID" | tee -a "$LOG" >&2
    return 1
  fi

  # =========================================================================
  # Surface: MEMORY.md (auto-memory index — absolute path outside repo)
  # =========================================================================
  if [[ "$abs_p" == "$AUTO_MEMORY_MD" ]]; then
    printf '[integrity-guard] checking MEMORY.md (agent=%s)\n' "$AGENT" >> "$LOG"

    # Only polaris may write MEMORY.md
    if [[ "$AGENT" == "polaris" ]]; then
      printf '[integrity-guard] PASS (polaris write to MEMORY.md)\n' >> "$LOG"
      return 0
    fi

    printf '[integrity-guard] BLOCKED — only polaris (α-OPS-00) may write MEMORY.md.\n' | tee -a "$LOG" >&2
    printf '[integrity-guard] Agent "%s" is not authorized.\n' "$AGENT" | tee -a "$LOG" >&2
    printf '[integrity-guard] FIX: revert this edit. If you need to update project memory, route a\n' | tee -a "$LOG" >&2
    printf '[integrity-guard]   handoff to Polaris describing the memory update required.\n' | tee -a "$LOG" >&2
    return 1
  fi

  # Not a surface this hook governs — pass
  return 0
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
printf '[integrity-guard] %s · start · tool=%s · agent=%s\n' "$TIMESTAMP" "$TOOL_NAME" "$AGENT" >> "$LOG"

BLOCKED=false
PATHS="$(extract_paths "$INPUT" "$TOOL_NAME")"

while IFS= read -r raw_path; do
  [[ -z "$raw_path" ]] && continue
  if ! check_file "$raw_path"; then
    BLOCKED=true
  fi
done <<< "$PATHS"

if $BLOCKED; then
  printf '[integrity-guard] EXIT 1 — one or more violations. Revert flagged edits and retry.\n' | tee -a "$LOG" >&2
  exit 1
fi

printf '[integrity-guard] %s · PASS\n' "$TIMESTAMP" >> "$LOG"
exit 0

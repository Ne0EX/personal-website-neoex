#!/usr/bin/env bash
# .claude/hooks/integrity-write-ledger.sh
# PostToolUse Write|Edit|MultiEdit hook — append-only integrity ledger.
#
# Purpose
# -------
# For every write that targets a GENESIS memory surface, append one JSON line
# to an append-only ledger at .harness/integrity-ledger.jsonl:
#
#   {"path":"<canonical>","sha256":"<hex>","author":"<agent>","ts":"<ISO8601-UTC>"}
#
# This hook is an OBSERVER, not a guard. It always exits 0.  A logging hook
# that blocks on disk errors would itself become a reliability failure. Guards
# that fail-closed are in integrity-write-guard.sh; this script only records.
#
# Covered surfaces (GENESIS memory — append on write):
#   1. ~/.claude/projects/-Users-neospiritth-codingspace-personal-website/memory/**
#      (Polaris auto-memory dir — absolute, outside the repo)
#   2. .claude/handoffs/**      (in-repo, repo-relative)
#   3. .claude/signatures/**    (in-repo, repo-relative)
#   4. MEMORY.md                (project root, repo-relative) — top-level only
#
# Excluded surfaces:
#   .claude/beta/**             — Track B, consult-pending; NEVER read/scan/touch.
#
# Ledger format
# -------------
# One JSON object per line (JSONL). Fields, fixed order:
#   path    — absolute path for auto-memory files; repo-relative for all others.
#             Repo-relative paths never start with "./" (stripped).
#   sha256  — SHA-256 hex digest of the file as it exists after the write.
#             Computed with: sha256sum "$file" | awk '{print $1}'
#             This is byte-for-byte identical to sign-work.sh's hash computation.
#   author  — $WL_AGENT (fallback: "unknown"). Same fallback as write-protect-beta.sh.
#   ts      — UTC timestamp: date -u +%FT%TZ. Same format as hook logging convention.
#
# Ledger path
# -----------
# Default: ${CLAUDE_PROJECT_DIR:-.}/.harness/integrity-ledger.jsonl
# Override (for tests): WL_INTEGRITY_LEDGER=/path/to/temp.jsonl
#
# Bash compatibility: bash 3.2 (macOS default). No associative arrays.
# Idempotent: same write → same ledger line appended again. That is correct
# for an append-only log (deduplication is a reader concern, not a writer concern).
#
# Logs to: .claude/hook-logs/<task_id>--integrity-ledger.log
#
# Called by: .claude/settings.json PostToolUse (matcher: Write|Edit|MultiEdit)
# Not wired yet — see .harness/proposed-wiring-M.md

set -uo pipefail
# Note: -e is intentionally omitted. This is an observer; any failure in a
# sub-command must not propagate as a fatal exit. Errors are logged and swallowed.

REPO_DIR="${CLAUDE_PROJECT_DIR:-/Users/neospiritth/codingspace/personal_website}"
LOG_DIR="$REPO_DIR/.claude/hook-logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true

TASK_ID="${CLAUDE_TASK_ID:-${WL_TASK_ID:-session-$(date +%s)}}"
AGENT="${WL_AGENT:-unknown}"
LOG="$LOG_DIR/${TASK_ID}--integrity-ledger.log"
TIMESTAMP="$(date -u +%FT%TZ)"

LEDGER="${WL_INTEGRITY_LEDGER:-$REPO_DIR/.harness/integrity-ledger.jsonl}"

# ---------------------------------------------------------------------------
# Auto-memory root (absolute, outside repo)
# ---------------------------------------------------------------------------
AUTO_MEMORY_DIR="/Users/neospiritth/.claude/projects/-Users-neospiritth-codingspace-personal-website/memory"

# Detect --seed before touching stdin.  The seed dispatch block appears AFTER
# all function definitions (below); this flag is read there.
_SEED_MODE="${1:-}"

# ---------------------------------------------------------------------------
# Parse tool input from stdin (PostToolUse passes JSON on stdin)
# NOTE: only executed in normal (non-seed) mode.  In --seed mode the dispatch
# block below handles the exit before TOOL_NAME is used, so INPUT is set to ""
# to keep later references safe in case of unexpected fall-through.
# ---------------------------------------------------------------------------
if [[ "$_SEED_MODE" == "--seed" ]]; then
  INPUT=""
  TOOL_NAME="__seed__"
else
  INPUT="$(cat)"
  TOOL_NAME="$(printf '%s' "$INPUT" | jq -r '.tool_name // "unknown"' 2>/dev/null || echo "unknown")"

  case "$TOOL_NAME" in
    Write|Edit|MultiEdit) ;;
    *)
      printf '[integrity-ledger] %s · skipped (tool=%s)\n' "$TIMESTAMP" "$TOOL_NAME" >> "$LOG" 2>/dev/null || true
      exit 0
      ;;
  esac
fi

# ---------------------------------------------------------------------------
# extract_paths <json> <tool>
# Prints one path per line, deduplicated. Same logic as write-protect-beta.sh.
# ---------------------------------------------------------------------------
extract_paths() {
  local json="$1"
  local tool="$2"
  case "$tool" in
    Write)
      printf '%s' "$json" | jq -r '.tool_input.file_path // ""' 2>/dev/null
      ;;
    Edit)
      printf '%s' "$json" | jq -r '.tool_input.file_path // ""' 2>/dev/null
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
# is_genesis_surface <path>
# Returns 0 if path is a GENESIS memory surface, 1 otherwise.
# Beta exclusion is checked FIRST, before any file reads.
# ---------------------------------------------------------------------------
is_genesis_surface() {
  local raw="$1"
  # Normalize: strip leading "./"
  local p="${raw#./}"
  # Also resolve to absolute if not already (for comparison with AUTO_MEMORY_DIR)
  local abs_p
  if [[ "$p" == /* ]]; then
    abs_p="$p"
  else
    abs_p="$REPO_DIR/$p"
  fi

  # --- EXCLUSION: beta (must be first, before any read) ---
  # Check both repo-relative and absolute forms.
  if [[ "$p" == .claude/beta/* ]] || [[ "$abs_p" == "$REPO_DIR/.claude/beta/"* ]]; then
    return 1
  fi

  # --- Surface 1: auto-memory dir (absolute) ---
  if [[ "$abs_p" == "$AUTO_MEMORY_DIR/"* ]]; then
    return 0
  fi

  # --- Surface 2: .claude/handoffs/** ---
  if [[ "$p" == .claude/handoffs/* ]] || [[ "$abs_p" == "$REPO_DIR/.claude/handoffs/"* ]]; then
    return 0
  fi

  # --- Surface 3: .claude/signatures/** ---
  if [[ "$p" == .claude/signatures/* ]] || [[ "$abs_p" == "$REPO_DIR/.claude/signatures/"* ]]; then
    return 0
  fi

  # --- Surface 4: MEMORY.md (top-level only) ---
  if [[ "$p" == "MEMORY.md" ]] || [[ "$abs_p" == "$REPO_DIR/MEMORY.md" ]]; then
    return 0
  fi

  return 1
}

# ---------------------------------------------------------------------------
# canonical_path <raw_path>
# Returns the canonical path string for the ledger:
#   - absolute path for auto-memory files
#   - repo-relative (no leading "./") for in-repo files
# ---------------------------------------------------------------------------
canonical_path() {
  local raw="$1"
  local p="${raw#./}"
  local abs_p
  if [[ "$p" == /* ]]; then
    abs_p="$p"
  else
    abs_p="$REPO_DIR/$p"
  fi

  # auto-memory → absolute
  if [[ "$abs_p" == "$AUTO_MEMORY_DIR/"* ]]; then
    printf '%s' "$abs_p"
    return
  fi

  # everything else → repo-relative, no leading "./"
  # Strip REPO_DIR prefix if it snuck in
  if [[ "$abs_p" == "$REPO_DIR/"* ]]; then
    printf '%s' "${abs_p#$REPO_DIR/}"
  else
    printf '%s' "$p"
  fi
}

# ---------------------------------------------------------------------------
# ensure_ledger_header
# PRODUCER CHANGE (TASK-2026-06-04-INTEGRITY-FORGE-ROOT):
# The ledger's forge-resistance is NOT an in-file hash chain (an agent with
# fs read+write recomputes any in-file chain — the round-1 refutation proved
# this). It is the APPEND-ONLY IMMUTABILITY of COMMITTED ledger history,
# witnessed by CI over a force-push-protected witness ref (see
# scripts/audit-ledger-append-only.sh and .harness/WITNESS-REF-DESIGN.md).
#
# This makes the ledger a self-describing, COMMITTABLE append-only artifact:
# when the file is first created, write ONE sentinel header line (a JSONL
# comment-equivalent: a JSON object with "_ledger" metadata, parseable and
# skippable by every reader's `fromjson?`/path-filter). It is written exactly
# once, never rewritten, so it becomes the immutable line-0 baseline the
# append-only witness checks every later commit against. No secret, no chain,
# nothing forgeable lives here — only the contract pointer.
#
# Readers (audit-handoff-integrity.sh, audit-memory-drift.sh) already filter on
# `.path` / `"path"`, so this header line (which has no "path" field) is inert
# to them: it is neither a handoff entry nor a memory node.
# ---------------------------------------------------------------------------
ensure_ledger_header() {
  # Only when the ledger does not yet exist (or is empty) — write once.
  if [[ -s "$LEDGER" ]]; then
    return
  fi
  local hdr
  hdr="$(jq -cn \
    --arg ts "$(date -u +%FT%TZ)" \
    '{"_ledger":"integrity-append-only","schema":1,"anchor":"committed-git-history+CI-witness","not_a_chain":true,"forge_root_doc":".harness/WITNESS-REF-DESIGN.md","created_at":$ts}' 2>/dev/null)" || return
  printf '%s\n' "$hdr" >> "$LEDGER" 2>/dev/null || {
    printf '[integrity-ledger] WARN — failed to write ledger header\n' >> "$LOG" 2>/dev/null || true
    return
  }
  printf '[integrity-ledger] HEADER written (append-only artifact, witness-anchored)\n' >> "$LOG" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# ledger_append <canonical_path> <actual_file_path>
# Computes sha256, builds JSON line, appends to ledger.
# Silently returns on any error (observer pattern).
# ---------------------------------------------------------------------------
ledger_append() {
  local canon="$1"
  local file_path="$2"
  local ts
  ts="$(date -u +%FT%TZ)"

  # File must exist after the write
  if [[ ! -f "$file_path" ]]; then
    printf '[integrity-ledger] WARN — file does not exist, skip ledger: %s\n' "$canon" >> "$LOG" 2>/dev/null || true
    return
  fi

  # Compute sha256 — identical to sign-work.sh
  local sha256
  sha256="$(sha256sum "$file_path" | awk '{print $1}' 2>/dev/null)" || {
    printf '[integrity-ledger] WARN — sha256 failed for %s\n' "$canon" >> "$LOG" 2>/dev/null || true
    return
  }

  # Build JSON line — fixed field order: path, sha256, author, ts
  # Use jq to ensure proper escaping (paths may contain special chars)
  local line
  line="$(jq -cn \
    --arg path   "$canon" \
    --arg sha256 "$sha256" \
    --arg author "$AGENT" \
    --arg ts     "$ts" \
    '{"path":$path,"sha256":$sha256,"author":$author,"ts":$ts}' 2>/dev/null)" || {
    printf '[integrity-ledger] WARN — jq failed for %s\n' "$canon" >> "$LOG" 2>/dev/null || true
    return
  }

  # Append-only write. >> never truncates.
  printf '%s\n' "$line" >> "$LEDGER" 2>/dev/null || {
    printf '[integrity-ledger] WARN — ledger append failed for %s\n' "$canon" >> "$LOG" 2>/dev/null || true
    return
  }

  printf '[integrity-ledger] RECORDED path=%s sha256=%s author=%s ts=%s\n' \
    "$canon" "$sha256" "$AGENT" "$ts" >> "$LOG" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# --seed dispatch (runs after all function definitions above)
# ---------------------------------------------------------------------------
# Walks every existing GENESIS memory surface file (same surfaces as
# is_genesis_surface(); beta EXCLUDED), appends one ledger line per file
# using the SAME canonical_path() + sha256 logic as the normal stdin path.
#
# Idempotency: for each file, if the ledger already contains an entry with
# the same canonical path AND the same sha256, the file is skipped (no
# duplicate). A file whose sha256 changed gets a NEW entry — this is correct
# append-only behavior (two distinct on-disk states, both observed).
#
# Author field: WL_AGENT if set; fallback is "seed" (distinguishes seed
# entries from hook-routed entries with unknown agent).
# ---------------------------------------------------------------------------
if [[ "$_SEED_MODE" == "--seed" ]]; then
  SEED_AGENT="${WL_AGENT:-seed}"
  printf '[integrity-ledger] %s · seed mode · agent=%s\n' "$TIMESTAMP" "$SEED_AGENT" >> "$LOG" 2>/dev/null || true

  # seed_already_recorded <canonical_path> <sha256>
  # Returns 0 if an entry for (path, sha256) already exists in the ledger.
  # grep -F: literal string matching (safe for paths with special chars).
  seed_already_recorded() {
    local canon="$1"
    local sha="$2"
    if [[ ! -f "$LEDGER" ]]; then
      return 1
    fi
    # Two-step: grep lines that have the path, then check if any of those also
    # have the sha. Relies on jq serialization: "path":"<val>","sha256":"<val>"
    local matches
    matches="$(grep -F "\"path\":\"${canon}\"" "$LEDGER" 2>/dev/null)" || true
    if [[ -z "$matches" ]]; then
      return 1
    fi
    if printf '%s\n' "$matches" | grep -qF "\"sha256\":\"${sha}\"" 2>/dev/null; then
      return 0
    fi
    return 1
  }

  # seed_one <absolute_path> [<override_author>]
  # Computes canonical path via canonical_path(), appends a ledger line
  # unless already recorded with the same (path, sha256) pair.
  # override_author: if set, used instead of SEED_AGENT.  Used for handoffs
  # so the recorded author matches the from-<agent> directory segment (M1
  # AUTHOR_MATCH assertion b checks dir-agent == ledger-author).
  seed_one() {
    local abs_path="$1"
    local author="${2:-$SEED_AGENT}"

    if [[ ! -f "$abs_path" ]]; then
      printf '[integrity-ledger] seed SKIP (not found): %s\n' "$abs_path" >> "$LOG" 2>/dev/null || true
      return
    fi

    # Use the shared canonical_path() — identical logic to the normal stdin path.
    local canon
    canon="$(canonical_path "$abs_path")"

    local sha256
    sha256="$(sha256sum "$abs_path" | awk '{print $1}' 2>/dev/null)" || {
      printf '[integrity-ledger] seed WARN — sha256 failed: %s\n' "$canon" >> "$LOG" 2>/dev/null || true
      return
    }

    if seed_already_recorded "$canon" "$sha256"; then
      printf '[integrity-ledger] seed SKIP (already recorded same sha): %s\n' "$canon" >> "$LOG" 2>/dev/null || true
      return
    fi

    local ts
    ts="$(date -u +%FT%TZ)"
    local line
    line="$(jq -cn \
      --arg path   "$canon" \
      --arg sha256 "$sha256" \
      --arg author "$author" \
      --arg ts     "$ts" \
      '{"path":$path,"sha256":$sha256,"author":$author,"ts":$ts}' 2>/dev/null)" || {
      printf '[integrity-ledger] seed WARN — jq failed: %s\n' "$canon" >> "$LOG" 2>/dev/null || true
      return
    }

    ensure_ledger_header
    printf '%s\n' "$line" >> "$LEDGER" 2>/dev/null || {
      printf '[integrity-ledger] seed WARN — ledger append failed: %s\n' "$canon" >> "$LOG" 2>/dev/null || true
      return
    }
    printf '[integrity-ledger] seed RECORDED path=%s sha256=%s author=%s\n' \
      "$canon" "$sha256" "$author" >> "$LOG" 2>/dev/null || true
    SEED_COUNT=$(( SEED_COUNT + 1 ))
  }

  SEED_COUNT=0

  # Surface 1: auto-memory dir (all files, recursive)
  # Canonical path = absolute path (canonical_path returns abs for auto-memory).
  if [[ -d "$AUTO_MEMORY_DIR" ]]; then
    while IFS= read -r abs_file; do
      [[ -f "$abs_file" ]] || continue
      seed_one "$abs_file"
    done < <(find "$AUTO_MEMORY_DIR" -type f 2>/dev/null)
  fi

  # Surface 2: .claude/handoffs/** (repo-relative canonical)
  # AUTHOR: derived from the from-<agent> directory segment so M1 AUTHOR_MATCH
  # (assertion b) passes: dir_agent must equal ledger author.
  # e.g. .claude/handoffs/from-sirius/x.md → author=sirius
  # Beta exclusion is belt-and-suspenders (handoffs is not beta, but be safe).
  HANDOFFS_DIR="$REPO_DIR/.claude/handoffs"
  if [[ -d "$HANDOFFS_DIR" ]]; then
    while IFS= read -r abs_file; do
      [[ -f "$abs_file" ]] || continue
      if [[ "$abs_file" == "$REPO_DIR/.claude/beta/"* ]]; then
        continue
      fi
      # Extract from-<agent> segment: strip handoffs dir, take first component.
      remainder="${abs_file#${HANDOFFS_DIR}/}"
      dir_seg="$(printf '%s' "$remainder" | awk -F'/' '{print $1}')"
      if [[ "$dir_seg" == from-* ]]; then
        handoff_author="${dir_seg#from-}"
      else
        # Flat file directly under handoffs/ — no from-<agent> dir; fall back.
        handoff_author="$SEED_AGENT"
      fi
      seed_one "$abs_file" "$handoff_author"
    done < <(find "$HANDOFFS_DIR" -type f 2>/dev/null)
  fi

  # Surface 3: .claude/signatures/** (repo-relative canonical)
  # M1 does not check author for signatures — SEED_AGENT default is fine.
  SIGS_DIR="$REPO_DIR/.claude/signatures"
  if [[ -d "$SIGS_DIR" ]]; then
    while IFS= read -r abs_file; do
      [[ -f "$abs_file" ]] || continue
      if [[ "$abs_file" == "$REPO_DIR/.claude/beta/"* ]]; then
        continue
      fi
      seed_one "$abs_file"
    done < <(find "$SIGS_DIR" -type f 2>/dev/null)
  fi

  # Surface 4: MEMORY.md at project root (single file, not recursive)
  # M1 does not check MEMORY.md — SEED_AGENT default is fine.
  MEMORY_MD="$REPO_DIR/MEMORY.md"
  if [[ -f "$MEMORY_MD" ]]; then
    seed_one "$MEMORY_MD"
  fi

  printf '[integrity-ledger] %s · seed done · recorded=%d\n' \
    "$(date -u +%FT%TZ)" "$SEED_COUNT" >> "$LOG" 2>/dev/null || true
  # Observer posture: seed always exits 0
  exit 0
fi

# ---------------------------------------------------------------------------
# Main: process all touched paths
# ---------------------------------------------------------------------------
printf '[integrity-ledger] %s · start · tool=%s · agent=%s\n' "$TIMESTAMP" "$TOOL_NAME" "$AGENT" >> "$LOG" 2>/dev/null || true

PATHS="$(extract_paths "$INPUT" "$TOOL_NAME")"
RECORDED=0

while IFS= read -r raw_path; do
  [[ -z "$raw_path" ]] && continue

  # Beta exclusion + surface check (no file reads until after this passes)
  if ! is_genesis_surface "$raw_path"; then
    printf '[integrity-ledger] skip (not genesis surface): %s\n' "$raw_path" >> "$LOG" 2>/dev/null || true
    continue
  fi

  # Resolve actual file path for sha256 read
  local_p="${raw_path#./}"
  if [[ "$local_p" == /* ]]; then
    actual="$local_p"
  else
    actual="$REPO_DIR/$local_p"
  fi

  canon="$(canonical_path "$raw_path")"
  # Write the one-time append-only header before the first real entry so the
  # committed ledger is self-describing (see ensure_ledger_header). Idempotent:
  # no-op once the ledger is non-empty.
  ensure_ledger_header
  ledger_append "$canon" "$actual"
  RECORDED=$(( RECORDED + 1 ))
done <<< "$PATHS"

printf '[integrity-ledger] %s · done · recorded=%d\n' "$TIMESTAMP" "$RECORDED" >> "$LOG" 2>/dev/null || true

# Observer: always exit 0
exit 0

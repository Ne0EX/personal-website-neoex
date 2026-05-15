#!/usr/bin/env bash
# scripts/audit-territory.sh
# Rail: territory
# Owner: Canopus (α-HRN-07)
# Purpose: Verify that the agent executing the current task has only touched files
#   within its declared territory (per docs/team/FILE-OWNERSHIP.md).
#
# Usage:
#   WL_AGENT=<codename> WL_TASK_ID=<task_id> bash scripts/audit-territory.sh
#
# Environment:
#   WL_AGENT     — agent codename (required); must match a block in FILE-OWNERSHIP.md
#   WL_TASK_ID   — task id (required); used to locate the baseline snapshot
#
# Exit codes:
#   0 — all touched files are within WL_AGENT's territory (or on the permanent whitelist)
#   1 — one or more files violate territory; violations printed as "file:owner" to stdout
#   2 — WL_AGENT or WL_TASK_ID not set
#   3 — FILE-OWNERSHIP.md not found
#
# Permanent whitelist (always allowed regardless of WL_AGENT):
#   docs/team/STATUS.md                        — Polaris owns but every agent updates their slice
#   .claude/handoffs/from-<WL_AGENT>/**        — handoff files the agent writes to others
#   .claude/signatures/TASK-*--<WL_AGENT>.json — agent's own signature files
#   .claude/hook-logs/**                       — runtime artifacts (gitignored)
#
# Ambiguity policy:
#   If a touched file matches no agent's territory in FILE-OWNERSHIP.md, this script
#   returns FAIL with "file:unassigned". Polaris routes ownership in a follow-up handoff.
#
# How to fix a fail:
#   1. Check docs/team/FILE-OWNERSHIP.md to identify who owns the flagged file.
#   2. Revert the edit in the flagged file.
#   3. Open a handoff to the owning agent requesting the change.

set -euo pipefail

AGENT="${WL_AGENT:-}"
TASK_ID="${WL_TASK_ID:-}"
OWNERSHIP_FILE="docs/team/FILE-OWNERSHIP.md"

# --- guards ---

if [[ -z "$AGENT" || -z "$TASK_ID" ]]; then
  echo "[territory] ERROR: WL_AGENT and WL_TASK_ID must be set" >&2
  exit 2
fi

if [[ ! -f "$OWNERSHIP_FILE" ]]; then
  echo "[territory] ERROR: $OWNERSHIP_FILE not found" >&2
  exit 3
fi

# --- collect touched files ---
# Strategy: read baseline snapshot written by pre-task.sh; compare to current dirty set.
# Files that are dirty AND whose hash changed after the baseline was recorded are "touched by this task".
# If no baseline exists, fall back to full git diff (same fallback as sign-work.sh).

BASELINE_FILE=".claude/hook-logs/${TASK_ID}--baseline.json"

# All files currently dirty vs HEAD (tracked files only — matches what pre-task.sh records)
ALL_DIRTY=$(git diff --name-only --diff-filter=AMD HEAD 2>/dev/null | sort || true)

if [[ -z "$ALL_DIRTY" ]]; then
  echo "[territory] no tracked files changed — PASS (nothing to audit)"
  exit 0
fi

if [[ -f "$BASELINE_FILE" ]]; then
  # Baseline-aware: only count tracked files that changed hash since pre-task.sh ran.
  # Untracked files are excluded from baseline-aware mode because pre-task.sh does not
  # snapshot them — we cannot reliably distinguish pre-existing untracked files (carry-overs)
  # from untracked files this task created. Untracked file territory enforcement is a
  # known limitation; a future enhancement could record untracked file mtimes at baseline.
  BASELINE_MAP=$(jq -r '.files' "$BASELINE_FILE")
  TASK_FILES=""
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    BASELINE_HASH=$(echo "$BASELINE_MAP" | jq -r --arg p "$f" '.[$p] // "NOT_IN_BASELINE"')
    if [[ "$BASELINE_HASH" == "NOT_IN_BASELINE" ]]; then
      # File not in baseline — this task introduced it (it was clean at task start)
      TASK_FILES="${TASK_FILES}"$'\n'"$f"
    elif [[ "$BASELINE_HASH" == "DELETED" ]]; then
      # Was absent at baseline; if it now exists, this task created/restored it
      [[ -f "$f" ]] && TASK_FILES="${TASK_FILES}"$'\n'"$f"
    else
      # Was dirty at baseline; include only if hash changed (this task actually modified it)
      if [[ -f "$f" ]]; then
        CURRENT_HASH=$(shasum -a 256 "$f" 2>/dev/null | awk '{print $1}' || sha256sum "$f" 2>/dev/null | awk '{print $1}')
        [[ "$CURRENT_HASH" != "$BASELINE_HASH" ]] && TASK_FILES="${TASK_FILES}"$'\n'"$f"
      else
        # Deleted by this task
        TASK_FILES="${TASK_FILES}"$'\n'"$f"
      fi
    fi
  done <<< "$ALL_DIRTY"
  TASK_FILES=$(printf '%s' "$TASK_FILES" | grep -v '^$' || true)
else
  # No baseline — fall back to full tracked git diff with a warning
  echo "[territory] WARNING: no baseline at $BASELINE_FILE — using full git diff (may include carry-overs)" >&2
  TASK_FILES="$ALL_DIRTY"
fi

if [[ -z "$TASK_FILES" ]]; then
  echo "[territory] no files attributed to this task — PASS"
  exit 0
fi

# --- extract globs from FILE-OWNERSHIP.md using POSIX awk ---
# Parses blocks headed by "## <codename> ·"
# Territory lines: "- <glob> [— comment]"
# Exclusion lines: "! <glob> [— comment]"
# Returns newline-separated list of globs for the given agent and section type.

extract_globs() {
  local agent="$1"
  local section="$2"   # "territory" or "exclusion"
  awk -v agent="$agent" -v section="$section" '
    /^## / {
      # Check if this line contains "## <agent> ·"
      if (index($0, "## " agent " ·") > 0) {
        in_block = 1
      } else {
        in_block = 0
      }
      next
    }
    in_block && /^- / && section == "territory" {
      line = substr($0, 3)
      # D1 FIX: strip parenthetical comments " (text...)" before any other processing.
      # FILE-OWNERSHIP.md lines may use either " — comment" (em-dash) or " (comment)"
      # styles. The parser must handle both defensively regardless of author convention.
      gsub(/ +\([^)]*\).*/, "", line)
      # Remove trailing " — comment" portion (em-dash UTF-8: E2 80 94)
      idx = index(line, " \342\200\224")
      if (idx > 0) line = substr(line, 1, idx - 1)
      # Also strip " -- " style
      idx2 = index(line, " -- ")
      if (idx2 > 0) line = substr(line, 1, idx2 - 1)
      # Strip backticks
      gsub(/`/, "", line)
      # Strip trailing spaces
      gsub(/ +$/, "", line)
      if (length(line) > 0) print line
    }
    in_block && /^! / && section == "exclusion" {
      line = substr($0, 3)
      # D1 FIX: strip parenthetical comments (same as territory block above)
      gsub(/ +\([^)]*\).*/, "", line)
      idx = index(line, " \342\200\224")
      if (idx > 0) line = substr(line, 1, idx - 1)
      idx2 = index(line, " -- ")
      if (idx2 > 0) line = substr(line, 1, idx2 - 1)
      gsub(/`/, "", line)
      gsub(/ +$/, "", line)
      if (length(line) > 0) print line
    }
  ' "$OWNERSHIP_FILE"
}

# Extract territory globs for this agent's block only
AGENT_GLOBS=$(extract_globs "$AGENT" "territory")
AGENT_EXCLUSIONS=$(extract_globs "$AGENT" "exclusion")

# Build a lookup table: for each agent, what are its territory globs?
# We store this as a series of lines: "agent|glob"
ALL_AGENT_GLOBS=$(awk '
  /^## [a-z]/ {
    # Extract codename: word before " ·" after "## "
    line = substr($0, 4)
    n = split(line, parts, " ")
    current_agent = parts[1]
    in_block = 1
    next
  }
  /^## / { in_block = 0; next }
  in_block && /^- / {
    line = substr($0, 3)
    # D1 FIX: strip parenthetical comments " (text...)" before any other processing
    gsub(/ +\([^)]*\).*/, "", line)
    idx = index(line, " \342\200\224")
    if (idx > 0) line = substr(line, 1, idx - 1)
    idx2 = index(line, " -- ")
    if (idx2 > 0) line = substr(line, 1, idx2 - 1)
    gsub(/`/, "", line)
    gsub(/ +$/, "", line)
    if (length(line) > 0) print current_agent "|" line
  }
' "$OWNERSHIP_FILE")

# --- helper: does a file path match a glob pattern? ---
# Handles: exact match, prefix/**, dir/**/*.ext, **/*.ext, *.ext, dir/*
# The bash `case` glob matches simple * and ? but NOT **. We handle ** manually.
path_matches_glob() {
  local path="$1"
  local glob="$2"

  # Strip trailing spaces
  glob="${glob% }"

  # Direct bash case glob match (handles *, ?, [...] but not **)
  # shellcheck disable=SC2254
  case "$path" in
    $glob) return 0 ;;
  esac

  # Patterns containing ** — handle multi-level matching
  if [[ "$glob" == *"**"* ]]; then
    local prefix="${glob%%\*\**}"   # everything before first **
    local suffix="${glob##*\*\*}"   # everything after last **
    suffix="${suffix#/}"            # strip leading /

    if [[ -n "$prefix" && -n "$suffix" ]]; then
      # Pattern: <prefix>**<suffix> — path must start with prefix and end matching suffix
      if [[ "$path" == "$prefix"* ]]; then
        local rest="${path#$prefix}"
        # shellcheck disable=SC2254
        case "$rest" in
          $suffix) return 0 ;;
          */"$suffix") return 0 ;;
        esac
        # Also try basename match when suffix is a simple pattern
        local bn; bn=$(basename "$path")
        # shellcheck disable=SC2254
        case "$bn" in
          $suffix) return 0 ;;
        esac
      fi
    elif [[ -z "$prefix" && -n "$suffix" ]]; then
      # Pattern: **<suffix> or **/<suffix> — match at any depth
      suffix="${suffix#/}"
      # shellcheck disable=SC2254
      case "$path" in
        $suffix) return 0 ;;
        */"$suffix") return 0 ;;
      esac
      local bn; bn=$(basename "$path")
      # shellcheck disable=SC2254
      case "$bn" in
        $suffix) return 0 ;;
      esac
    elif [[ -n "$prefix" && -z "$suffix" ]]; then
      # Pattern: <prefix>** — match anything under prefix dir
      local dir="${prefix%/}"
      if [[ "$path" == "$dir" || "$path" == "$dir/"* ]]; then
        return 0
      fi
    fi
  fi

  # Patterns ending with /** (belt-and-suspenders for the common dir/** form)
  if [[ "$glob" == *"/**" ]]; then
    local dir="${glob%/**}"
    if [[ "$path" == "$dir" || "$path" == "$dir/"* ]]; then
      return 0
    fi
  fi

  return 1
}

# --- permanent whitelist check ---
is_whitelisted() {
  local f="$1"

  # Always-allowed: docs/team/STATUS.md (every agent updates their own slice line)
  [[ "$f" == "docs/team/STATUS.md" ]] && return 0

  # Always-allowed: .claude/signatures/AUDIT.md
  # This file is a session-level audit log written by Algol's QA process in response to
  # signature events from ANY agent's task. It appears as "dirty" during any task window
  # where signatures are filed. It is functionally equivalent to STATUS.md — a shared
  # ledger that no individual agent controls but that any task's session can modify.
  [[ "$f" == ".claude/signatures/AUDIT.md" ]] && return 0

  # Always-allowed: hook-logs (runtime artifacts)
  [[ "$f" == .claude/hook-logs/* ]] && return 0

  # Always-allowed: agent's own handoff files
  [[ "$f" == ".claude/handoffs/from-${AGENT}/"* ]] && return 0

  # Always-allowed: agent's own signature files
  # Match: .claude/signatures/TASK-*--<agent>.json
  local sig_prefix=".claude/signatures/TASK-"
  local sig_suffix="--${AGENT}.json"
  if [[ "$f" == ${sig_prefix}*${sig_suffix} ]]; then
    return 0
  fi

  return 1
}

# --- find owner of a file across all agents ---
find_owner() {
  local file="$1"
  local found_owner="unassigned"

  while IFS='|' read -r agent_name glob; do
    [[ -z "$agent_name" || -z "$glob" ]] && continue
    if path_matches_glob "$file" "$glob"; then
      found_owner="$agent_name"
      break
    fi
  done <<< "$ALL_AGENT_GLOBS"

  echo "$found_owner"
}

# --- check each touched file ---
VIOLATIONS=""

while IFS= read -r file; do
  [[ -z "$file" ]] && continue

  # Permanent whitelist takes precedence
  if is_whitelisted "$file"; then
    continue
  fi

  # Check if file matches any of the agent's territory globs
  OWNED=false
  while IFS= read -r glob; do
    [[ -z "$glob" ]] && continue
    if path_matches_glob "$file" "$glob"; then
      OWNED=true
      break
    fi
  done <<< "$AGENT_GLOBS"

  if $OWNED; then
    # Check if explicitly excluded from this agent's territory
    EXCLUDED=false
    while IFS= read -r excl_glob; do
      [[ -z "$excl_glob" ]] && continue
      if path_matches_glob "$file" "$excl_glob"; then
        EXCLUDED=true
        break
      fi
    done <<< "$AGENT_EXCLUSIONS"

    if $EXCLUDED; then
      # File excluded — find the real owner
      OWNER=$(find_owner "$file")
      VIOLATIONS="${VIOLATIONS}"$'\n'"${file}:${OWNER}"
    fi
    # Not excluded — legitimately owned, pass
    continue
  fi

  # File not in agent's territory — find actual owner
  OWNER=$(find_owner "$file")
  VIOLATIONS="${VIOLATIONS}"$'\n'"${file}:${OWNER}"

done <<< "$TASK_FILES"

VIOLATIONS=$(printf '%s' "$VIOLATIONS" | grep -v '^$' || true)

if [[ -z "$VIOLATIONS" ]]; then
  echo "[territory] PASS — all files within ${AGENT}'s territory"
  exit 0
else
  echo "[territory] FAIL — territory violations for agent '${AGENT}':"
  echo "$VIOLATIONS" | while IFS= read -r v; do
    [[ -z "$v" ]] && continue
    echo "  $v"
  done
  exit 1
fi

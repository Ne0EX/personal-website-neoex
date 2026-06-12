#!/usr/bin/env bash
# scripts/audit-secret-leak.sh
# Rail: secret-leak-guard
# Owner: Canopus (α-HRN-07) · store-as-source S8 (2026-06-12)
# Spec: §5.4 / §11
#
# Purpose:
#   Scan ALL git-tracked files for SUPABASE_SECRET_KEY and the sb_secret_ key
#   prefix. Assert that any match lives ONLY under scripts/**. Any hit in
#   app/**, lib/**, components/**, or the repo root is a blocker.
#
# What "secret leak" means here:
#   - SUPABASE_SECRET_KEY appearing as an env reference (process.env.SUPABASE_SECRET_KEY,
#     os.environ.get('SUPABASE_SECRET_KEY'), etc.) outside scripts/**
#   - The literal sb_secret_ prefix (the actual key material begins with sb_secret_)
#     appearing anywhere in tracked files
#   - Comments that merely NAME the variable (e.g. "Never uses SUPABASE_SECRET_KEY")
#     are not violations — the guard uses function-call patterns for the env reference check
#
# Usage:
#   bash scripts/audit-secret-leak.sh
#
# Exit codes:
#   0 — clean (no violations)
#   1 — violation found; offending file:line printed to stdout
#
# Scope:
#   Only git-tracked files (git ls-files). Untracked files and .env* are
#   already excluded by .gitignore and thus not tracked.
#   node_modules is never tracked.
#   .next/ is never tracked.
#
# Implementation note on the comment-vs-usage distinction:
#   For SUPABASE_SECRET_KEY: we scan for env-access patterns:
#     process.env.SUPABASE_SECRET_KEY
#     os.environ.get('SUPABASE_SECRET_KEY')
#     os.environ['SUPABASE_SECRET_KEY']
#     env['SUPABASE_SECRET_KEY']
#     SUPABASE_SECRET_KEY= (shell assignment)
#     SUPABASE_SECRET_KEY: (YAML/JSON key)
#   Comments that merely say "Never uses SUPABASE_SECRET_KEY" are not caught.
#
#   For sb_secret_: any occurrence of the literal prefix is a potential key
#   material leak regardless of context — no comment exception (the prefix is
#   not a word you'd write in a comment without it being a key).

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
cd "$REPO_ROOT"

# Log dir (gitignored at runtime)
LOG_DIR=".claude/hook-logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/audit-secret-leak.log"

VIOLATIONS=0

# ── Helper ──────────────────────────────────────────────────────────────────
report_violation() {
  local file="$1" line="$2" reason="$3"
  echo "[secret-leak] VIOLATION  $file:$line — $reason"
  echo "[secret-leak] VIOLATION  $file:$line — $reason" >> "$LOG"
  VIOLATIONS=$((VIOLATIONS + 1))
}

# ── Pattern 1: sb_secret_ literal — any tracked file ────────────────────────
# The actual Supabase secret key starts with "sb_secret_". Any occurrence in a
# tracked file is potential key material in git history.
while IFS= read -r tracked_file; do
  [[ -f "$tracked_file" ]] || continue
  while IFS=: read -r lineno match; do
    [[ -z "$lineno" ]] && continue
    report_violation "$tracked_file" "$lineno" "literal sb_secret_ prefix (potential key material)"
  done < <(grep -n "sb_secret_" "$tracked_file" 2>/dev/null || true)
done < <(git ls-files)

# ── Pattern 2: SUPABASE_SECRET_KEY env-access outside scripts/** ────────────
# Functional references: process.env, os.environ, env['...'], shell assignment,
# YAML/JSON key forms. Comments that name the variable are excluded.
ENV_ACCESS_PATTERN='process\.env\.SUPABASE_SECRET_KEY|os\.environ(\.get\(|\.get\("['"'"'])?SUPABASE_SECRET_KEY|env\[.SUPABASE_SECRET_KEY.|SUPABASE_SECRET_KEY[[:space:]]*=[^=]|SUPABASE_SECRET_KEY:'

while IFS= read -r tracked_file; do
  [[ -f "$tracked_file" ]] || continue

  # Skip scripts/** — that is the ONLY allowed location
  if [[ "$tracked_file" == scripts/* ]]; then
    continue
  fi

  while IFS=: read -r lineno match; do
    [[ -z "$lineno" ]] && continue
    # Exclude pure comment lines (lines that start with optional whitespace + comment marker)
    # to avoid flagging comment-only mentions like "Never uses SUPABASE_SECRET_KEY"
    raw_line=$(sed -n "${lineno}p" "$tracked_file" 2>/dev/null || true)
    stripped="${raw_line#"${raw_line%%[! ]*}"}"   # ltrim whitespace
    # Comment markers: // # * (JSDoc block) --
    if [[ "$stripped" == "//"* ]] || [[ "$stripped" == "#"* ]] || [[ "$stripped" == "*"* ]] || [[ "$stripped" == "--"* ]]; then
      continue
    fi
    report_violation "$tracked_file" "$lineno" "SUPABASE_SECRET_KEY env-access outside scripts/**"
  done < <(grep -nE "$ENV_ACCESS_PATTERN" "$tracked_file" 2>/dev/null || true)
done < <(git ls-files)

# ── Summary ─────────────────────────────────────────────────────────────────
if [[ "$VIOLATIONS" -eq 0 ]]; then
  echo "[secret-leak] CLEAN — no secret-leak violations in tracked files"
  echo "[secret-leak] CLEAN" >> "$LOG"
  exit 0
else
  echo "[secret-leak] FAIL — $VIOLATIONS violation(s) found"
  echo "[secret-leak] FAIL — $VIOLATIONS violation(s)" >> "$LOG"
  echo ""
  echo "Fix: SUPABASE_SECRET_KEY may only appear in scripts/**"
  echo "     and must never be committed as key material (sb_secret_ prefix)."
  exit 1
fi

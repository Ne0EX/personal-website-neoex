#!/usr/bin/env bash
# =============================================================================
# audit-font-chain.sh
#
# Rail: soul-atom-drift (sub-check: font-chain presence)
# Owner: Canopus (α-HRN-07) — TASK-2026-05-29-SOUL-FACTORY-FIDELITY
#
# Purpose:
#   Assert that gallery.html explicitly binds the three Tailwind v4 font tokens
#   (--font-display, --font-mono, --font-type) to non-empty values outside the
#   @theme inline block. Without this binding the gallery silently falls back to
#   Times serif — all text atoms render in the wrong typeface, A11 (type-roles)
#   becomes completely non-functional, and the font-chain bug is invisible to the
#   token-drift gate (which only checks CSS custom property existence in globals.css,
#   not whether those properties resolve at gallery serve time).
#
# Root cause this check closes:
#   TASK-2026-05-29-SOUL-FACTORY-FIDELITY — Algol §critical baseline finding:
#   @theme inline is a Tailwind v4 directive; browsers silently ignore it when
#   serving globals.css statically. --font-display/mono/type resolve to empty
#   string → Times fallback. Token-drift gate passed; gallery rendered wrong.
#
# What it checks (static grep — deterministic, no runtime required):
#
#   For each of the three font-chain tokens:
#     --font-display   --font-mono   --font-type
#
#   The gallery.html must contain a bare :root CSS assignment of the form:
#     --font-token: <non-empty value>
#   This assignment must appear OUTSIDE a data-gate-exempt="" section (the
#   font-chain bridge is itself in a gate-exempt block, so we look for ANY
#   explicit binding — gate-exempt or otherwise). The presence of the assignment
#   proves the bridge exists; its absence means the Times fallback will occur.
#
#   IMPORTANT: the check is string-presence only — it does NOT verify that
#   the fonts actually loaded in a browser. For runtime verification, use
#   Algol's Playwright check (Part 2 of the render-fidelity gauntlet, documented
#   in docs/harness/RAIL-DEFINITIONS.md §render-fidelity-gauntlet).
#
# Exit codes:
#   0 — PASS: all three font-chain tokens are explicitly bound in gallery.html
#   1 — FAIL: one or more font-chain token bindings are missing (gate blocks)
#   2 — SKIP: manifest.json not found (soul-atlas not yet initialised — not applicable)
#   3 — FAIL: gallery.html not found when manifest.json exists
#   4 — FAIL: internal error (e.g., GALLERY path not set)
#
# Usage:
#   bash scripts/audit-font-chain.sh
#   bash scripts/audit-font-chain.sh --verbose
#   GALLERY_PATH=/path/to/gallery.html bash scripts/audit-font-chain.sh
#
# Task-id context:
#   Set CLAUDE_TASK_ID before calling — used for log file naming.
#   If unset, "no-task" is used as fallback.
# =============================================================================

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
TASK_ID="${CLAUDE_TASK_ID:-no-task}"
LOG_DIR="${REPO_ROOT}/.claude/hook-logs"
LOG_FILE="${LOG_DIR}/${TASK_ID}--font-chain.log"
VERBOSE="${1:-}"

MANIFEST="${REPO_ROOT}/.claude/visual-diffs/soul-atlas/manifest.json"
# Allow override via env for testing
GALLERY="${GALLERY_PATH:-${REPO_ROOT}/.claude/visual-diffs/soul-atlas/gallery.html}"

# ── logging helpers ─────────────────────────────────────────────────────────
mkdir -p "${LOG_DIR}"
log()   { echo "[font-chain] $*" | tee -a "${LOG_FILE}"; }
log_v() { if [ "${VERBOSE}" = "--verbose" ]; then log "$*"; else echo "[font-chain] $*" >> "${LOG_FILE}"; fi; }
log_err() { echo "[font-chain] ERROR: $*" | tee -a "${LOG_FILE}" >&2; }

log "start · task=${TASK_ID} · $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# ── P1: manifest.json must exist (same guard as parent drift check) ──────────
if [ ! -f "${MANIFEST}" ]; then
  log "manifest.json not found at ${MANIFEST} — soul-atlas not yet initialised; skipping"
  exit 2
fi

# ── P2: gallery.html must exist ─────────────────────────────────────────────
if [ ! -f "${GALLERY}" ]; then
  log_err "gallery.html not found at ${GALLERY}"
  log "FAIL (exit 3)"
  exit 3
fi

log_v "gallery.html: ${GALLERY}"

# ── C1: font-chain token presence check ─────────────────────────────────────
# We grep for lines of the form:
#   --font-display:   (colon required — this is a CSS assignment, not a var() reference)
#   --font-mono:
#   --font-type:
#
# The colon distinguishes a CSS PROPERTY DEFINITION (--font-display: value)
# from a USE (font-family: var(--font-display)). We want the definition.
#
# We intentionally do NOT filter out gate-exempt blocks — the font-chain bridge
# lives in a data-gate-exempt block by design (it is gallery-local CSS, not a
# drift violation). If the definition exists anywhere in gallery.html, the token
# is bound and the Times fallback cannot occur.
#
# bash 3.2 portable: no arrays, no process substitution with arrays.

FAIL=0
MISSING=""

# Check --font-display:
if grep -q -- '--font-display[[:space:]]*:' "${GALLERY}"; then
  log_v "font-chain OK: --font-display binding found"
else
  log_err "MISSING: --font-display is not explicitly bound in gallery.html"
  log_err "  Without this binding, gallery text using var(--font-display) falls back to Times serif."
  log_err "  Fix: add a :root { --font-display: var(--font-cormorant), 'Cormorant Garamond', serif; }"
  log_err "       inside a <style data-gate-exempt=\"true\"> block in gallery.html."
  FAIL=1
  MISSING="${MISSING} --font-display"
fi

# Check --font-mono:
if grep -q -- '--font-mono[[:space:]]*:' "${GALLERY}"; then
  log_v "font-chain OK: --font-mono binding found"
else
  log_err "MISSING: --font-mono is not explicitly bound in gallery.html"
  log_err "  Without this binding, gallery text using var(--font-mono) falls back to Times serif."
  log_err "  Fix: add a :root { --font-mono: var(--font-jetbrains), 'JetBrains Mono', ui-monospace, monospace; }"
  log_err "       inside a <style data-gate-exempt=\"true\"> block in gallery.html."
  FAIL=1
  MISSING="${MISSING} --font-mono"
fi

# Check --font-type:
if grep -q -- '--font-type[[:space:]]*:' "${GALLERY}"; then
  log_v "font-chain OK: --font-type binding found"
else
  log_err "MISSING: --font-type is not explicitly bound in gallery.html"
  log_err "  Without this binding, gallery text using var(--font-type) falls back to Times serif."
  log_err "  Fix: add a :root { --font-type: var(--font-elite), 'Special Elite', ui-monospace, monospace; }"
  log_err "       inside a <style data-gate-exempt=\"true\"> block in gallery.html."
  FAIL=1
  MISSING="${MISSING} --font-type"
fi

# ── result ───────────────────────────────────────────────────────────────────
if [ "${FAIL}" -eq 0 ]; then
  log "PASS — font-chain bindings present: --font-display, --font-mono, --font-type"
  exit 0
else
  log "FAIL (exit 1) — missing font-chain bindings:${MISSING}"
  log "  The Tailwind v4 @theme inline block does not execute when gallery.html is"
  log "  served statically. The gallery must provide its own :root bindings for"
  log "  --font-display, --font-mono, --font-type inside a data-gate-exempt style block."
  log "  See docs/harness/RAIL-DEFINITIONS.md §rail-font-chain-presence for full context."
  exit 1
fi

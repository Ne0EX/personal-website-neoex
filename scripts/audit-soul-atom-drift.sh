#!/usr/bin/env bash
# =============================================================================
# audit-soul-atom-drift.sh
#
# Rail: soul-atom-drift
# Owner: Canopus (α-HRN-07) — TASK-2026-05-29-SOUL-FACTORY-P0
# Run by: harness-check.sh (via worldline-harness.config.json) AND
#         the visual-diff.sh hook when soul-atlas files are in scope.
#
# Purpose:
#   Verify that the soul-atom gallery stays pinned to the canonical
#   design-token source (app/globals.css) and main-branch literals.
#   Drift in the gallery = a fourth competing baseline that makes things WORSE.
#
# The drift invariant (from MANIFEST-SCHEMA.md):
#   Every appearance value (color/size/spacing/timing) in gallery.html
#   must resolve to a token_ref that exists in app/globals.css OR a cited
#   main_branch_ref. Any uncited raw appearance literal = gate FAIL.
#
# Shell wrapper contract:
#   This script (Canopus territory) is the shell harness layer.
#   It validates preconditions, assembles the inputs, invokes the TypeScript
#   audit (Algol territory), and translates the exit code into a gate decision.
#
#   The TypeScript audit lives at:
#     scripts/audit-soul-atom-drift.ts   ← ALGOL FILLS THIS (Phase 2)
#
#   This wrapper will FAIL CLOSED if the TS audit is missing, rather than
#   silently passing a potentially-drifted gallery.
#
# Exit codes:
#   0 — PASS: all atoms verified; no uncited raw literals detected
#   1 — FAIL: one or more uncited raw literals found (gate blocks)
#   2 — FAIL: manifest.json not found or not valid JSON
#   3 — FAIL: TypeScript audit not found at scripts/audit-soul-atom-drift.ts —
#            BLOCKING (Phase 2: TS audit exists; absence now means a broken install,
#            not a deferred stub)
#   4 — FAIL: gallery.html not found when manifest.json exists
#   5 — FAIL: token_source (app/globals.css) not found — cannot verify token_refs
#   6 — FAIL: a token_ref in the manifest does not exist in app/globals.css
#
# Usage:
#   bash scripts/audit-soul-atom-drift.sh
#   bash scripts/audit-soul-atom-drift.sh --verbose
#
# Task-id context:
#   Set CLAUDE_TASK_ID in env before calling — used for log file naming.
#   If unset, "no-task" is used as fallback.
# =============================================================================

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
TASK_ID="${CLAUDE_TASK_ID:-no-task}"
LOG_DIR="${REPO_ROOT}/.claude/hook-logs"
LOG_FILE="${LOG_DIR}/${TASK_ID}--soul-atom-drift.log"
VERBOSE="${1:-}"

MANIFEST="${REPO_ROOT}/.claude/visual-diffs/soul-atlas/manifest.json"
GALLERY="${REPO_ROOT}/.claude/visual-diffs/soul-atlas/gallery.html"
TOKEN_SOURCE="${REPO_ROOT}/app/globals.css"
# WL_TS_AUDIT_OVERRIDE allows the mutation harness (and tests) to point at a TEMP
# copy of the TS audit without touching the real tracked file. NEVER set this in
# production; it is a harness-internal seam only. Default = the real file.
TS_AUDIT="${WL_TS_AUDIT_OVERRIDE:-${REPO_ROOT}/scripts/audit-soul-atom-drift.ts}"

# ── logging helpers ─────────────────────────────────────────────────────────
mkdir -p "${LOG_DIR}"
log() { echo "[soul-atom-drift] $*" | tee -a "${LOG_FILE}"; }
log_v() { [[ "${VERBOSE}" == "--verbose" ]] && log "$*" || echo "[soul-atom-drift] $*" >> "${LOG_FILE}"; }
log_err() { echo "[soul-atom-drift] ERROR: $*" | tee -a "${LOG_FILE}" >&2; }

log "start · task=${TASK_ID} · $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# ── P1: manifest.json must exist ────────────────────────────────────────────
if [[ ! -f "${MANIFEST}" ]]; then
  # Exit 0 silently when soul-atlas hasn't been created yet.
  # The gate is not applicable until Betelgeuse creates the gallery (Phase 1).
  # This prevents false-positive failures on tasks that don't touch soul-atlas.
  log "manifest.json not found at ${MANIFEST} — soul-atlas not yet initialised; skipping"
  exit 0
fi

# ── P2: manifest.json must be valid JSON ────────────────────────────────────
if ! jq empty "${MANIFEST}" 2>/dev/null; then
  log_err "manifest.json is not valid JSON: ${MANIFEST}"
  log "FAIL (exit 2)"
  exit 2
fi

log_v "manifest.json valid JSON"

# ── P3: gallery.html must exist if manifest.json exists ─────────────────────
if [[ ! -f "${GALLERY}" ]]; then
  log_err "gallery.html not found at ${GALLERY} — manifest exists but gallery is missing"
  log "FAIL (exit 4)"
  exit 4
fi

# ── P4: token source must exist ─────────────────────────────────────────────
if [[ ! -f "${TOKEN_SOURCE}" ]]; then
  log_err "token source not found at ${TOKEN_SOURCE}"
  log "FAIL (exit 5)"
  exit 5
fi

# ── C1: verify every token_ref exists in globals.css ────────────────────────
# This check is Canopus territory (shell grep) — it does not require the TS audit.
# Format: --<property-name> is present as a CSS custom property definition.
log "checking token_refs against ${TOKEN_SOURCE}"

TOKEN_FAIL=0
while IFS= read -r token_ref; do
  # token_ref from manifest looks like "--accent-orange"
  if ! grep -q -- "${token_ref}" "${TOKEN_SOURCE}"; then
    log_err "token_ref '${token_ref}' not found in ${TOKEN_SOURCE}"
    TOKEN_FAIL=1
  else
    log_v "token_ref '${token_ref}' OK"
  fi
done < <(jq -r '.atoms[].token_refs[]' "${MANIFEST}" 2>/dev/null || true)

if [[ "${TOKEN_FAIL}" -eq 1 ]]; then
  log "FAIL (exit 6) — one or more token_refs missing from globals.css"
  exit 6
fi

log "token_refs check PASS"

# ── C1b: font-chain presence assertion ──────────────────────────────────────
# Verifies that --font-display, --font-mono, --font-type are explicitly bound
# in gallery.html. Tailwind v4 @theme inline does not run in static-serve context;
# without explicit :root bindings all text falls back to Times serif.
# This check would have caught the TASK-2026-05-29-SOUL-FACTORY-FIDELITY breakage
# deterministically — token-drift gate passed but render was wrong.
#
# Script lives at scripts/audit-font-chain.sh (Canopus territory).
# Fails closed (exit 1 on missing binding).
FONT_CHAIN_SCRIPT="${REPO_ROOT}/scripts/audit-font-chain.sh"

if [[ ! -f "${FONT_CHAIN_SCRIPT}" ]]; then
  log_err "font-chain check script not found at ${FONT_CHAIN_SCRIPT}"
  log "FAIL (exit 7) — font-chain script absent; install broken"
  exit 7
fi

log "running font-chain presence check"
FONT_CHAIN_EXIT=0
bash "${FONT_CHAIN_SCRIPT}" "${VERBOSE}" 2>>"${LOG_FILE}" || FONT_CHAIN_EXIT=$?

if [[ "${FONT_CHAIN_EXIT}" -eq 2 ]]; then
  # Exit 2 from font-chain = manifest not found = skip (should not happen here since
  # we already verified manifest exists above, but be defensive)
  log_v "font-chain check: skipped (manifest not found — unexpected in this context)"
elif [[ "${FONT_CHAIN_EXIT}" -ne 0 ]]; then
  log_err "font-chain presence check FAILED (exit ${FONT_CHAIN_EXIT})"
  log "FAIL (exit 1) — font-chain bindings missing; see font-chain log for detail"
  exit 1
else
  log "font-chain check PASS"
fi

# ── C1c: source-bijection — A1.4 ────────────────────────────────────────────
# Canonical predicate v2 (2026-05-30 · TASK-2026-05-30-HARNESS-IS-OUGHT-SEPARATOR · REVISE round 2)
#
# Every token in manifest.atoms[].token_refs MUST be CSS-bound and atom-attributed
# via at least ONE of the following three conditions:
#
#   (i)  var(--<token>) appearing as a CSS property value inside a <style>...</style>
#        block in gallery.html (NOT in prose, <code> tags, HTML comments, or any
#        non-CSS text), scoped to the atom by EITHER:
#          (i-html) the <style> block lives within the atom's
#                   data-atom-id="<atom.id>" HTML container element, OR
#          (i-id)   the CSS rule containing var(--<token>) has a selector that
#                   includes "#atom-<atom.id>" (targets the atom via CSS ID).
#
#   (ii) explicit --<token>: <value> assignment inside a data-gate-exempt="true"
#        style block that lives within the atom's data-atom-id="<atom.id>" HTML
#        container element.
#
#   (iii) for CSS-INHERITED properties only: --<token>: <value> assignment in a
#        :root rule inside any gallery <style> block. This satisfies the requirement
#        for ALL atoms (because the cascade propagates it to every element), UNLESS
#        the specific atom has a conflicting same-token override in its own section
#        or in a "#atom-<id>" rule.
#        CSS-inherited properties for (iii) purposes are those whose token names
#        conventionally map to: font-family, font-size, font-weight, line-height,
#        color, letter-spacing, text-align, font-variant-numeric.
#        Token naming conventions that qualify for (iii):
#          --font-*              → font-family / font-size / font-weight (inherited)
#          --ink-*               → color when used as text color (inherited)
#          --meta-tracking       → letter-spacing (inherited)
#        Tokens NOT in the above list do NOT qualify for (iii); they require
#        (i) or (ii) directly.
#
# A token in atom X's token_refs that satisfies none of (i)/(ii)/(iii) = RED.
#
# Error message format (Step 7b discipline — conditions checked and failed are named):
#   [A1.4] atom=<id> token=<--name> missing: <which conditions were tried and failed>
#
# TEXT-MENTION LOOPHOLE FIX: All predicate checks operate ONLY on extracted CSS
# contexts (inside <style>...</style> blocks). var() occurrences in <code> tags,
# HTML comments, and prose text do NOT satisfy the predicate.
#
# Approach (two-phase, predicate v2):
#   Phase A (pre-loop, run once): use a Python script to parse gallery.html and
#     extract a structured JSON of CSS contexts:
#       - css_all: all <style> block contents concatenated (the full CSS buffer)
#       - root_vars: set of --token names assigned in :root rules in any style block
#       - atom_id_selectors: map of atom_id → CSS text from rules whose selector
#         contains "#atom-<atom.id>" (across all style blocks)
#       - atom_section_styles: map of atom_id → CSS text from <style> blocks that
#         are HTML-contained within the atom's data-atom-id section element
#   Phase B (per-atom loop): for each atom × token, check (i-html), (i-id),
#     (ii), (iii) in order; first hit = GREEN; none = RED with named conditions.

log "A1.4 source-bijection (predicate v2): checking per-atom token_refs against CSS contexts"

BIJECTION_FAIL=0

# ── CSS-inherited token name patterns for predicate (iii) ───────────────────
# A token qualifies for (iii) if its name matches one of these patterns.
# This list is a fixed constant — changes require a REVISE of this script.
#   --font-*       → font-family, font-size, font-weight (CSS-inherited)
#   --ink-*        → color when used as text color (CSS-inherited)
#   --meta-tracking → letter-spacing (CSS-inherited)
# Tokens NOT matching these patterns do NOT qualify for (iii).
_a14_is_inherited_token() {
  local token="$1"
  # Strip leading --
  local name="${token#--}"
  case "${name}" in
    font-*)         return 0 ;;
    ink-*)          return 0 ;;
    meta-tracking)  return 0 ;;
    *)              return 1 ;;
  esac
}

# ── Phase A: extract CSS contexts from gallery.html (run once) ───────────────
_A14_PY="${LOG_DIR}/_a14_extract_$$.py"
_A14_JSON="${LOG_DIR}/_a14_contexts_$$.json"

cat > "${_A14_PY}" << 'PYEOF'
import sys, re, json

gallery_path = sys.argv[1]

with open(gallery_path, 'r', encoding='utf-8', errors='replace') as f:
    html = f.read()

# ── 1. Extract all <style>...</style> block contents ──────────────────────
# Each style block is returned as a dict with:
#   - content: raw CSS text inside the tags
#   - is_gate_exempt: whether data-gate-exempt="true" is on the opening tag
#   - html_pos_start: character offset of the opening <style> tag in the HTML
#   - html_pos_end:   character offset immediately after </style> in the HTML
style_re = re.compile(
    r'<style([^>]*)>(.*?)</style>',
    re.IGNORECASE | re.DOTALL
)
style_blocks = []
for m in style_re.finditer(html):
    attrs = m.group(1)
    content = m.group(2)
    is_exempt = bool(re.search(r'data-gate-exempt=["\']true["\']', attrs, re.IGNORECASE))
    style_blocks.append({
        'attrs': attrs,
        'content': content,
        'is_gate_exempt': is_exempt,
        'html_pos_start': m.start(),
        'html_pos_end': m.end(),
    })

# ── 2. Build atom_id → HTML section boundaries ────────────────────────────
# For each atom_id, find the element with data-atom-id="<id>" and record its
# start/end character positions in the HTML.
atom_section_bounds = {}  # atom_id → (start, end) or None

def find_atom_section(html, atom_id):
    pattern = re.compile(
        r'<(\w[\w\d-]*)[^>]*data-atom-id=["\']' + re.escape(atom_id) + r'["\'][^>]*>',
        re.IGNORECASE
    )
    m = pattern.search(html)
    if not m:
        return None
    tag_name = m.group(1).lower()
    start = m.start()
    pos = m.end()
    depth = 1
    open_re  = re.compile(r'<'  + re.escape(tag_name) + r'[\s>/]', re.IGNORECASE)
    close_re = re.compile(r'</' + re.escape(tag_name) + r'\s*>',    re.IGNORECASE)
    while pos < len(html) and depth > 0:
        next_open  = open_re.search(html, pos)
        next_close = close_re.search(html, pos)
        if next_close is None:
            break
        if next_open is not None and next_open.start() < next_close.start():
            depth += 1
            pos = next_open.end()
        else:
            depth -= 1
            pos = next_close.end()
    return (start, pos)

# We'll discover atom ids from the gallery itself (from data-atom-id attributes),
# so the script is general — not hardcoded to any specific atom list.
all_atom_ids = re.findall(r'data-atom-id=["\']([^"\']+)["\']', html, re.IGNORECASE)
all_atom_ids = list(dict.fromkeys(all_atom_ids))  # preserve order, deduplicate

for atom_id in all_atom_ids:
    bounds = find_atom_section(html, atom_id)
    atom_section_bounds[atom_id] = bounds  # may be None

# ── 3. atom_section_styles: CSS text from <style> blocks INSIDE an atom section ──
# A style block is "inside" the atom section if its html_pos_start is within
# [section_start, section_end].
atom_section_styles = {}  # atom_id → concatenated CSS from contained style blocks
for atom_id, bounds in atom_section_bounds.items():
    if bounds is None:
        atom_section_styles[atom_id] = ''
        continue
    sec_start, sec_end = bounds
    css_parts = []
    for sb in style_blocks:
        if sb['html_pos_start'] >= sec_start and sb['html_pos_end'] <= sec_end:
            css_parts.append(sb['content'])
    atom_section_styles[atom_id] = '\n'.join(css_parts)

# ── 4. atom_id_selectors: CSS rule blocks whose selector contains #atom-<id> ──
# We scan all style block contents for CSS rules and extract blocks whose
# selector string contains "#atom-<atom_id>" (as a literal CSS ID selector).
# CSS rule extraction: find selector { ... } pairs. We handle nested braces
# (for @media blocks) by tracking depth.

def extract_rules_with_selector_containing(css_text, selector_substring):
    """Return the full text of CSS rules (or rule groups) whose selector/preamble
    contains selector_substring. Handles @media nesting."""
    result_parts = []
    i = 0
    n = len(css_text)
    while i < n:
        # Find the next '{' — this opens a rule block
        brace_open = css_text.find('{', i)
        if brace_open == -1:
            break
        # The selector/preamble is everything from i to brace_open (stripped)
        selector_text = css_text[i:brace_open].strip()
        # Read the block content, tracking brace depth
        depth = 1
        j = brace_open + 1
        while j < n and depth > 0:
            ch = css_text[j]
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
            j += 1
        block_content = css_text[brace_open:j]
        full_rule = selector_text + block_content
        if selector_substring in selector_text:
            result_parts.append(full_rule)
        # For @media or other at-rules that contain nested rules, also scan
        # the inner content for the selector.
        elif selector_text.startswith('@'):
            inner = css_text[brace_open+1:j-1]
            inner_matches = extract_rules_with_selector_containing(inner, selector_substring)
            if inner_matches:
                result_parts.extend(inner_matches)
        i = j
    return result_parts

atom_id_css = {}  # atom_id → CSS text from #atom-<id> rules across all style blocks
for atom_id in all_atom_ids:
    selector_sub = '#atom-' + atom_id
    parts = []
    for sb in style_blocks:
        matched = extract_rules_with_selector_containing(sb['content'], selector_sub)
        parts.extend(matched)
    atom_id_css[atom_id] = '\n'.join(parts)

# ── 5. root_vars: set of --token names assigned in :root rules ──────────────
# A ":root" rule is a rule whose selector is literally ":root" (ignoring CSS
# block comments that may precede it in the style block, which do not affect
# the CSS selector's meaning but are included in the selector_text by the
# extract_rules_with_selector_containing function).
root_var_names = set()
_css_comment_re = re.compile(r'/\*.*?\*/', re.DOTALL)
for sb in style_blocks:
    root_rules = extract_rules_with_selector_containing(sb['content'], ':root')
    for rule in root_rules:
        # Strip the selector + outer braces to get declarations
        brace_pos = rule.find('{')
        if brace_pos == -1:
            continue
        selector_part = rule[:brace_pos].strip()
        # Strip CSS block comments from the selector text before comparing.
        # Gallery style blocks may have multi-line comments before the :root keyword.
        selector_no_comments = _css_comment_re.sub('', selector_part).strip()
        # Only process exact :root rules (not e.g. ".foo:root", though that's unlikely)
        if selector_no_comments != ':root':
            continue
        inner = rule[brace_pos+1:].rstrip().rstrip('}')
        # Find all --varname: declarations
        for decl_m in re.finditer(r'(--[\w-]+)\s*:', inner):
            root_var_names.add(decl_m.group(1))

# ── 6. atom_section_html: raw HTML for atom sections (for (ii) gate-exempt check) ──
atom_section_html = {}
for atom_id, bounds in atom_section_bounds.items():
    if bounds is None:
        atom_section_html[atom_id] = ''
    else:
        atom_section_html[atom_id] = html[bounds[0]:bounds[1]]

# ── Output JSON ──────────────────────────────────────────────────────────────
out = {
    'atom_ids_found': all_atom_ids,
    'atom_section_html': atom_section_html,
    'atom_section_styles': atom_section_styles,
    'atom_id_css': atom_id_css,
    'root_var_names': sorted(root_var_names),
}
print(json.dumps(out, ensure_ascii=False))
PYEOF

log_v "A1.4 phase A: extracting CSS contexts from gallery.html"
_A14_CTX=""
_A14_CTX=$(python3 "${_A14_PY}" "${GALLERY}" 2>/dev/null) || true
rm -f "${_A14_PY}"

if [[ -z "${_A14_CTX}" ]]; then
  log_err "[A1.4] FATAL: CSS context extraction from gallery.html failed (Python3 error)"
  log "FAIL (exit 1) — A1.4 CSS context extraction failed"
  exit 1
fi

# Write contexts to temp JSON for jq access
echo "${_A14_CTX}" > "${_A14_JSON}"

log_v "A1.4 phase A: CSS contexts extracted"

# ── Phase B: per-atom × per-token predicate evaluation ──────────────────────
ATOM_COUNT_14=$(jq '.atoms | length' "${MANIFEST}" 2>/dev/null || echo 0)
for (( atom_idx=0; atom_idx < ATOM_COUNT_14; atom_idx++ )); do
  atom_id=$(jq -r ".atoms[${atom_idx}].id" "${MANIFEST}")
  atom_token_refs=$(jq -r ".atoms[${atom_idx}].token_refs[]" "${MANIFEST}" 2>/dev/null || true)

  # Pull pre-extracted CSS contexts for this atom (via jq from the context JSON)
  # Each variable holds CSS text (or empty string) for the relevant scope.
  ATOM_SECTION_HTML=$(jq -r --arg id "${atom_id}" '.atom_section_html[$id] // ""' "${_A14_JSON}")
  ATOM_SECTION_CSS=$(jq -r  --arg id "${atom_id}" '.atom_section_styles[$id] // ""' "${_A14_JSON}")
  ATOM_ID_CSS=$(jq -r       --arg id "${atom_id}" '.atom_id_css[$id] // ""'         "${_A14_JSON}")

  if [[ -z "${ATOM_SECTION_HTML}" ]]; then
    # Atom id not found as a section in gallery — all token_refs fail.
    while IFS= read -r token; do
      [[ -z "${token}" ]] && continue
      log_err "[A1.4] atom=${atom_id} token=${token} missing: atom section not found in gallery.html (data-atom-id=${atom_id} element absent)"
      BIJECTION_FAIL=1
    done <<< "${atom_token_refs}"
    continue
  fi

  # Check each token_ref for this atom.
  while IFS= read -r token; do
    [[ -z "${token}" ]] && continue

    # ── (i-html): var(--<token>) in a <style> block INSIDE the atom's HTML section ──
    FOUND_I_HTML=""
    if [[ -n "${ATOM_SECTION_CSS}" ]]; then
      if echo "${ATOM_SECTION_CSS}" | grep -q -- "var(${token}"; then
        FOUND_I_HTML="yes"
      fi
    fi

    # ── (i-id): var(--<token>) in a CSS rule with selector "#atom-<atom.id>" ──
    # The ATOM_ID_CSS buffer already contains only rules with that selector.
    FOUND_I_ID=""
    if [[ -n "${ATOM_ID_CSS}" ]]; then
      if echo "${ATOM_ID_CSS}" | grep -q -- "var(${token}"; then
        FOUND_I_ID="yes"
      fi
    fi

    # ── (ii): --<token>: <value> in a data-gate-exempt="true" style block INSIDE the atom section ──
    # Check the raw HTML for the atom section: look for data-gate-exempt="true" style block
    # and within it a property assignment --<token>: <value>.
    FOUND_II=""
    if [[ -n "${ATOM_SECTION_HTML}" ]]; then
      # Extract only gate-exempt style block contents within the atom section HTML,
      # then check for the token assignment.
      _A14_PY2="${LOG_DIR}/_a14_exempt_$$.py"
      cat > "${_A14_PY2}" << 'PYEOF2'
import sys, re
section_html = sys.stdin.read()
# Find all <style data-gate-exempt="true">...</style> within this section
style_re = re.compile(r'<style[^>]*data-gate-exempt=["\']true["\'][^>]*>(.*?)</style>', re.IGNORECASE | re.DOTALL)
token = sys.argv[1]
for m in style_re.finditer(section_html):
    inner = m.group(1)
    if re.search(re.escape(token) + r'\s*:', inner):
        print('yes')
        sys.exit(0)
sys.exit(1)
PYEOF2
      if echo "${ATOM_SECTION_HTML}" | python3 "${_A14_PY2}" "${token}" 2>/dev/null; then
        FOUND_II="yes"
      fi
      rm -f "${_A14_PY2}"
    fi

    # ── (iii): :root assignment for CSS-inherited tokens ──
    # Only applicable if the token name conventionally maps to an inherited CSS property.
    FOUND_III=""
    TRIED_III="no (token not in inherited-property set)"
    if _a14_is_inherited_token "${token}"; then
      TRIED_III="yes"
      # Check if token is declared in :root
      ROOT_HAS_TOKEN=$(jq -r --arg t "${token}" '
        if (.root_var_names | map(select(. == $t)) | length) > 0
        then "yes" else "no" end
      ' "${_A14_JSON}")
      if [[ "${ROOT_HAS_TOKEN}" == "yes" ]]; then
        # (iii) qualifies IF the atom has no conflicting per-atom override.
        # A conflicting override is a rule in ATOM_SECTION_CSS or ATOM_ID_CSS that
        # ASSIGNS (not just uses) the same token: "--<token>: <value>" pattern.
        HAS_OVERRIDE=""
        if echo "${ATOM_SECTION_CSS}" | grep -qE -- "${token}[[:space:]]*:" 2>/dev/null; then
          HAS_OVERRIDE="yes"
        fi
        if [[ -z "${HAS_OVERRIDE}" ]] && echo "${ATOM_ID_CSS}" | grep -qE -- "${token}[[:space:]]*:" 2>/dev/null; then
          HAS_OVERRIDE="yes"
        fi
        if [[ -z "${HAS_OVERRIDE}" ]]; then
          FOUND_III="yes"
        else
          TRIED_III="yes (root has token but per-atom override present — (iii) does not apply)"
        fi
      else
        TRIED_III="yes (token not in :root)"
      fi
    fi

    # ── Decision ─────────────────────────────────────────────────────────────
    if [[ -n "${FOUND_I_HTML}" || -n "${FOUND_I_ID}" || -n "${FOUND_II}" || -n "${FOUND_III}" ]]; then
      # GREEN — log which condition matched
      if [[ -n "${FOUND_I_HTML}" ]]; then
        log_v "[A1.4] atom=${atom_id} token=${token} OK (i-html: var() in style block inside atom section)"
      elif [[ -n "${FOUND_I_ID}" ]]; then
        log_v "[A1.4] atom=${atom_id} token=${token} OK (i-id: var() in #atom-${atom_id} CSS rule)"
      elif [[ -n "${FOUND_II}" ]]; then
        log_v "[A1.4] atom=${atom_id} token=${token} OK (ii: explicit assignment in gate-exempt style inside atom section)"
      else
        log_v "[A1.4] atom=${atom_id} token=${token} OK (iii: :root cascade for inherited property)"
      fi
    else
      # RED — name exactly which conditions were tried and failed
      TRIED_I_HTML="no (no var(${token}) in atom-section-contained <style> block)"
      TRIED_I_ID="no (no var(${token}) in #atom-${atom_id} CSS rules)"
      TRIED_II="no (no ${token}: assignment in gate-exempt style inside atom section)"
      [[ -n "${ATOM_SECTION_CSS}" ]]   || TRIED_I_HTML="no (atom section has no contained <style> blocks)"
      [[ -n "${ATOM_ID_CSS}" ]]        || TRIED_I_ID="no (no #atom-${atom_id} rules found in gallery CSS)"

      log_err "[A1.4] atom=${atom_id} token=${token} missing: (i-html) ${TRIED_I_HTML}; (i-id) ${TRIED_I_ID}; (ii) ${TRIED_II}; (iii) ${TRIED_III}"
      log_err "  Fix: in gallery.html, either:"
      log_err "    (i-html) add var(${token}) in a <style> block within the data-atom-id=${atom_id} element, OR"
      log_err "    (i-id)   add var(${token}) in a CSS rule with selector '#atom-${atom_id}' in a gallery <style> block, OR"
      log_err "    (ii)     add ${token}: <value> in a data-gate-exempt=true style block inside the data-atom-id=${atom_id} element, OR"
      log_err "    (iii)    if token is CSS-inherited, add ${token}: <value> to a :root rule in a gallery <style> block."
      BIJECTION_FAIL=1
    fi
  done <<< "${atom_token_refs}"
done

# Clean up context JSON (temp file; also cleaned by EXIT trap in callers)
rm -f "${_A14_JSON}"

if [[ "${BIJECTION_FAIL}" -eq 1 ]]; then
  log "FAIL (exit 1) — A1.4 source-bijection (predicate v2): token(s) in token_refs not CSS-bound to their atom via any of (i-html), (i-id), (ii), (iii)"
  exit 1
fi

log "A1.4 source-bijection PASS (predicate v2) — all manifest token_refs satisfy (i-html), (i-id), (ii), or (iii)"

# ── C2: invoke the TypeScript deep-audit ────────────────────────────────────
# Algol owns audit-soul-atom-drift.ts.
# Contract for the TS audit (what Algol must implement — Phase 2):
#
#   INPUT  (stdin, JSON):
#     {
#       "manifest_path": "<absolute path to manifest.json>",
#       "gallery_path":  "<absolute path to gallery.html>",
#       "token_source":  "<absolute path to app/globals.css>",
#       "verbose":       true|false
#     }
#
#   OUTPUT (stdout, JSON):
#     {
#       "pass": true|false,
#       "violations": [
#         {
#           "atom_id":     "<atom id>",
#           "atom_name":   "<atom name>",
#           "violation":   "uncited-literal | token-ref-missing | main-branch-mismatch",
#           "detail":      "<human-readable detail>",
#           "gallery_loc": "<line or selector where the violation was found in gallery.html>"
#         }
#       ],
#       "atoms_checked": <integer>,
#       "warnings":      ["<advisory strings>"]
#     }
#
#   EXIT CODES:
#     0 — all atoms pass
#     1 — one or more violations found
#     2 — input malformed or files unreadable (propagated as exit 2 by this wrapper)
#
#   WHAT THE TS AUDIT MUST CHECK:
#
#   For each atom in manifest.json:
#
#   A. Scan the gallery.html section identified by data-atom-id="<atom.id>" for raw
#      appearance literals. An "appearance literal" is any CSS property value that is:
#        - a hex color (#[0-9a-fA-F]{3,8})
#        - an rgb/rgba/hsl call with literal numeric arguments
#        - a pixel value (e.g. 12px, 0.5rem) that is NOT wrapped in var(--...)
#        - an opacity value (e.g. 0.18, 0.45) that is NOT wrapped in var(--...)
#        - a timing value (e.g. 600ms, 1400ms) that is NOT wrapped in var(--...)
#
#   B. For each raw literal found:
#      1. Check if it matches the `value` field of any `main_branch_ref` entry in
#         this atom's manifest entry. If it does → cited, PASS this literal.
#      2. If no matching main_branch_ref → UNCITED LITERAL → violation.
#
#   C. For each main_branch_ref in the atom:
#      1. Verify the cited file exists at the repo root.
#      2. If `line` is provided, verify the cited `value` appears at or near that line
#         (±3 line tolerance for minor edits). If not → MAIN-BRANCH-MISMATCH violation.
#      3. MAIN-BRANCH-MISMATCH is a violation: it means the gallery is citing a literal
#         that has drifted from its stated source. Either the gallery must be updated or
#         the cite must be corrected.
#
#   D. For each token_ref in the atom:
#      (The shell wrapper already checked existence in globals.css at C1 above.
#       The TS audit should also verify the token_ref appears in the gallery section
#       via a var(--<token>) reference, not just that it exists in globals.css.)
#
#   EXEMPTIONS (the TS audit must honour these):
#   - Any content inside <!-- gate: exempt → Three.js canvas ... --> comments is
#     exempt from literal scanning. These mark runtime numeric values that cannot
#     use CSS variables (Three.js requires hex or numeric).
#   - Any attribute value in data-* attributes is exempt (data attributes are metadata,
#     not appearance values).
#   - Content inside <script> tags marked with data-gate-exempt="true" is exempt.

if [[ ! -f "${TS_AUDIT}" ]]; then
  log_err "TypeScript audit not found at ${TS_AUDIT}"
  log_err "Phase 2 transition: scripts/audit-soul-atom-drift.ts must exist."
  log_err "If this is a fresh clone, run: git checkout scripts/audit-soul-atom-drift.ts"
  log "FAIL (exit 3) — TS audit absent; gate blocks (Phase 2 active)"
  exit 3
fi

# Invoke the TS audit via tsx (assumed available; consistent with existing audit scripts)
log "invoking TS audit: ${TS_AUDIT}"

AUDIT_INPUT=$(jq -nc \
  --arg manifest "${MANIFEST}" \
  --arg gallery "${GALLERY}" \
  --arg token_source "${TOKEN_SOURCE}" \
  --argjson verbose "$([[ "${VERBOSE}" == "--verbose" ]] && echo true || echo false)" \
  '{manifest_path: $manifest, gallery_path: $gallery, token_source: $token_source, verbose: $verbose}')

AUDIT_OUTPUT=$(echo "${AUDIT_INPUT}" | npx tsx "${TS_AUDIT}" 2>>"${LOG_FILE}")
AUDIT_EXIT=$?

echo "${AUDIT_OUTPUT}" >> "${LOG_FILE}"

if [[ "${AUDIT_EXIT}" -eq 0 ]]; then
  ATOM_COUNT=$(echo "${AUDIT_OUTPUT}" | jq -r '.atoms_checked // empty' 2>/dev/null || echo "")
  MANIFEST_TOTAL=$(jq '.atoms | length' "${MANIFEST}")

  # A1.1 — Coverage assertion: atoms_checked reported by TS audit must equal
  # the total number of atoms declared in manifest.json. A mismatch means the
  # TS audit silently skipped atoms (the 7-of-12 silent-skip class); this closes
  # that false-green deterministically at the wrapper level.
  #
  # One-way gate: if atoms_checked is absent or empty (old TS audit version or
  # crash), treat as 0 — fail closed, never silently pass an unknown count.
  ATOM_COUNT_INT="${ATOM_COUNT:-0}"
  if [[ -z "${ATOM_COUNT}" ]]; then
    log_err "A1.1 coverage assert: TS audit did not report atoms_checked — treating as 0"
    log_err "  expected=${MANIFEST_TOTAL}, got=MISSING"
    log "FAIL (exit 1) — atoms_checked absent from TS audit output; coverage cannot be confirmed"
    exit 1
  fi
  if [[ "${ATOM_COUNT_INT}" -ne "${MANIFEST_TOTAL}" ]]; then
    log_err "A1.1 coverage assert FAILED: atoms_checked=${ATOM_COUNT_INT} != manifest total=${MANIFEST_TOTAL}"
    log_err "  The TS audit skipped $((MANIFEST_TOTAL - ATOM_COUNT_INT)) atom(s); silent-skip = FAIL."
    log_err "  Fix: ensure the TS audit iterates all manifest.atoms without early exit or filter."
    log "FAIL (exit 1) — partial coverage detected (atoms_checked < total)"
    exit 1
  fi

  log "A1.1 coverage assert PASS — atoms_checked=${ATOM_COUNT_INT} == manifest total=${MANIFEST_TOTAL}"
  log "PASS — ${ATOM_COUNT} atoms verified; no uncited literals detected"
  exit 0
elif [[ "${AUDIT_EXIT}" -eq 1 ]]; then
  VIOLATION_COUNT=$(echo "${AUDIT_OUTPUT}" | jq '.violations | length' 2>/dev/null || echo "unknown")
  log_err "FAIL — ${VIOLATION_COUNT} violation(s) found:"
  echo "${AUDIT_OUTPUT}" | jq -r '.violations[] | "  atom=\(.atom_id) type=\(.violation) loc=\(.gallery_loc // "?")\n  detail: \(.detail)"' 2>/dev/null | tee -a "${LOG_FILE}" >&2
  log "FAIL (exit 1)"
  exit 1
else
  log_err "TS audit exited ${AUDIT_EXIT} — treating as FAIL"
  log "FAIL (exit 1)"
  exit 1
fi

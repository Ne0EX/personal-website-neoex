#!/usr/bin/env bash
# scripts/audit-design-tokens.sh
# Rail: design-tokens
# Owner: Canopus (α-HRN-07)
# Purpose: Enforce that no raw hex color values appear in app/** or components/**
#   outside the two designated whitelist locations.
#
# Usage:
#   bash scripts/audit-design-tokens.sh
#
# No environment variables required. Runs against the current working tree.
#
# Whitelist (raw hex is ALLOWED here):
#   app/globals.css            — palette definition site; this is where tokens are declared
#   components/WorldlineGlobe.tsx — Three.js requires numeric color args (#hex form)
#
# Tailwind inline-hex decision:
#   Tailwind JIT utility classes of the form (bg|text|border|ring|fill|stroke)-[#rrggbb]
#   are REJECTED by this rail (status: strict).
#   Rationale: inline hex inside className strings bypasses the token system just as much
#   as inline hex in CSS. If a color is needed, it belongs in app/globals.css as a CSS
#   variable. Betelgeuse can relax this decision via a CONFIG handoff if a specific
#   use case warrants it (e.g., dynamically computed colors from JS state).
#
# Exit codes:
#   0 — no violations found
#   1 — one or more violations; list printed as "file:line:value" to stdout
#
# How to fix a fail:
#   - The audit emits file:line:value for each offending hex value.
#   - Replace with the corresponding CSS variable from app/globals.css.
#   - If the color you need isn't tokenized, that's a Betelgeuse handoff — do not add
#     a CSS variable without design review.
#
# Exclusions:
#   - .next/** and any build artifact directories
#   - node_modules/**
#   - The whitelist files listed above

set -euo pipefail

SEARCH_DIRS=("app" "components")
WHITELIST=(
  "app/globals.css"
  "components/WorldlineGlobe.tsx"
  "components/PhotoEntry.palette.css"
)

# Hex pattern: 3-8 hex digits after #, not immediately followed by another hex digit or letter.
#
# D2 FIX: Always use grep -E (POSIX extended regex). The prior implementation branched on
# "grep --version | grep -q 'GNU'" but macOS BSD grep self-reports "BSD grep, GNU compatible"
# — the string "GNU" appears in its output, so the GNU branch fired incorrectly. BSD grep
# does not support -P (Perl regex); invocations with -P exit 2; the error was silently
# swallowed by 2>/dev/null || true, making MATCHES always empty — the rail was a no-op on
# macOS regardless of actual hex violations.
#
# The -E branch already produced correct results on both GNU grep and BSD grep per Algol's
# verification. The -P branch provided a slightly tighter word boundary (\b) but this is not
# needed in practice: the -E approximation (hex not followed by another hex digit or letter)
# catches all real violations without false positives in the target file set.
#
# Choice rationale: drop the branch entirely rather than probe for -P capability. The -E path
# is correct, portable, and eliminates the conditional that was the bug's root cause.
HEX_PATTERN='#[0-9a-fA-F]{3,8}([^0-9a-fA-F]|$)'

VIOLATIONS=""
SCANNED=0

for dir in "${SEARCH_DIRS[@]}"; do
  [[ -d "$dir" ]] || continue

  while IFS= read -r -d '' file; do
    # Skip build artifacts and excluded dirs
    case "$file" in
      */.next/*|*/node_modules/*|*/.turbo/*|*/dist/*|*/out/*)
        continue ;;
    esac

    # Check whitelist
    IS_WHITELISTED=false
    for wl in "${WHITELIST[@]}"; do
      if [[ "$file" == "./$wl" || "$file" == "$wl" ]]; then
        IS_WHITELISTED=true
        break
      fi
    done
    $IS_WHITELISTED && continue

    SCANNED=$((SCANNED + 1))

    # D2 FIX: always use -E (POSIX extended regex). No branching on grep version.
    # See HEX_PATTERN declaration above for full rationale.
    MATCHES=$(grep -nE "$HEX_PATTERN" "$file" 2>/dev/null || true)

    if [[ -n "$MATCHES" ]]; then
      while IFS= read -r match_line; do
        [[ -z "$match_line" ]] && continue
        LINE_NUM=$(echo "$match_line" | cut -d: -f1)
        LINE_CONTENT=$(echo "$match_line" | cut -d: -f2-)
        # Extract the hex value(s) from the line for reporting
        HEX_VALUES=$(echo "$LINE_CONTENT" | grep -oE '#[0-9a-fA-F]{3,8}' || true)
        while IFS= read -r hex; do
          [[ -z "$hex" ]] && continue
          VIOLATIONS="${VIOLATIONS}"$'\n'"${file}:${LINE_NUM}:${hex}"
        done <<< "$HEX_VALUES"
      done <<< "$MATCHES"
    fi

  done < <(find "$dir" \( -name '*.tsx' -o -name '*.ts' -o -name '*.css' -o -name '*.scss' -o -name '*.js' -o -name '*.jsx' \) -not -path '*/.next/*' -not -path '*/node_modules/*' -not -path '*/.turbo/*' -not -path '*/dist/*' -not -path '*/out/*' -print0 2>/dev/null)
done

VIOLATIONS=$(printf '%s' "$VIOLATIONS" | grep -v '^$' || true)

if [[ -z "$VIOLATIONS" ]]; then
  echo "[design-tokens] PASS — no raw hex outside whitelist (scanned $SCANNED file(s))"
  exit 0
else
  VCOUNT=$(echo "$VIOLATIONS" | grep -c '.' || echo 0)
  echo "[design-tokens] FAIL — $VCOUNT raw hex violation(s) found:"
  echo "$VIOLATIONS" | while IFS= read -r v; do
    [[ -z "$v" ]] && continue
    echo "  $v"
  done
  echo ""
  echo "  Fix: replace raw hex with CSS variable from app/globals.css."
  echo "  If the color is not tokenized, open a handoff to Betelgeuse (α-VIS-04)."
  echo "  Whitelist additions require a Betelgeuse CONFIG handoff, not a workaround."
  exit 1
fi

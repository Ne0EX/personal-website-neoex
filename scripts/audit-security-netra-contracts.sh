#!/usr/bin/env bash
# Fail-closed bridge from Canopus rails to Algol's deterministic TypeScript
# contract audit. No application module is imported and no credential, live
# Supabase/Redis instance, or model provider is required.

set -u -o pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCOPE="${1:-}"
AUDIT="${REPO_ROOT}/scripts/audit-security-netra-contracts.ts"
REGRESSION="${REPO_ROOT}/tests/security-netra-contracts.test.mjs"

case "${SCOPE}" in
  console|netra) ;;
  *)
    printf '[security-netra-contracts] ERROR · scope must be console or netra\n' >&2
    exit 2
    ;;
esac

for required_path in "${AUDIT}" "${REGRESSION}"; do
  if [[ ! -f "${required_path}" ]]; then
    printf '[security-netra-contracts] ERROR · required Algol path is unavailable: %s\n' "${required_path#${REPO_ROOT}/}" >&2
    exit 2
  fi
done

for prerequisite in jq node; do
  if ! command -v "${prerequisite}" >/dev/null 2>&1; then
    printf '[security-netra-contracts] ERROR · missing prerequisite command: %s\n' "${prerequisite}" >&2
    exit 2
  fi
done

OUTPUT=""
if ! OUTPUT="$(mktemp "${TMPDIR:-/tmp}/worldline-${SCOPE}-contract.XXXXXX")"; then
  printf '[security-netra-contracts] ERROR · could not create temporary output file\n' >&2
  exit 2
fi
cleanup() {
  case "${OUTPUT}" in
    "${TMPDIR:-/tmp}"/worldline-*-contract.*|/tmp/worldline-*-contract.*|/private/tmp/worldline-*-contract.*|/var/folders/*/worldline-*-contract.*)
      rm -f -- "${OUTPUT}" 2>/dev/null || true
      ;;
    *)
      printf '[security-netra-contracts] WARN · refusing to clean unexpected temp path: %s\n' "${OUTPUT}" >&2
      ;;
  esac
}
trap cleanup EXIT INT TERM HUP

AUDIT_EXIT=0
node --import tsx "${AUDIT}" --scope "${SCOPE}" > "${OUTPUT}" 2>&1 || AUDIT_EXIT=$?

if ! jq empty "${OUTPUT}" >/dev/null 2>&1; then
  printf '[security-netra-contracts] FAIL · Algol audit did not emit valid JSON (scope=%s exit=%s)\n' "${SCOPE}" "${AUDIT_EXIT}" >&2
  cat "${OUTPUT}" >&2
  exit 1
fi

if ! jq -e --arg scope "${SCOPE}" '
  .audit == "security-netra-contracts"
  and .version == 1
  and .scope == $scope
  and (.pass | type) == "boolean"
  and (.checks | type) == "array"
  and (.violations | type) == "array"
  and (.files_checked | type) == "array"
' "${OUTPUT}" >/dev/null; then
  printf '[security-netra-contracts] FAIL · malformed Algol audit envelope for scope=%s\n' "${SCOPE}" >&2
  cat "${OUTPUT}" >&2
  exit 1
fi

CHECK_COUNT="$(jq '.checks | length' "${OUTPUT}")"
VIOLATION_COUNT="$(jq '.violations | length' "${OUTPUT}")"
FILE_COUNT="$(jq '.files_checked | length' "${OUTPUT}")"

if [[ "${AUDIT_EXIT}" -ne 0 || "$(jq -r '.pass' "${OUTPUT}")" != "true" || "${CHECK_COUNT}" -eq 0 || "${VIOLATION_COUNT}" -ne 0 ]]; then
  printf '[security-netra-contracts] FAIL · scope=%s files=%s checks=%s violations=%s audit_exit=%s\n' \
    "${SCOPE}" "${FILE_COUNT}" "${CHECK_COUNT}" "${VIOLATION_COUNT}" "${AUDIT_EXIT}" >&2
  cat "${OUTPUT}" >&2
  exit 1
fi

printf '[security-netra-contracts] PASS · scope=%s files=%s checks=%s violations=0\n' \
  "${SCOPE}" "${FILE_COUNT}" "${CHECK_COUNT}"
exit 0

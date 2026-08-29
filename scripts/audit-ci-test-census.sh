#!/usr/bin/env bash
# Deterministic CI sensor census and runner.
#
# Algol owns tests/harness/ci-test-census.json and the tests themselves.
# Canopus owns this fail-closed consumer. The tracked Git index is the
# denominator: a newly tracked executable sensor cannot disappear merely
# because somebody forgot to add it to a workflow command.
#
# Usage:
#   bash scripts/audit-ci-test-census.sh --validate
#   bash scripts/audit-ci-test-census.sh --node
#   bash scripts/audit-ci-test-census.sh --shell-python

set -u -o pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CENSUS="${WL_CI_TEST_CENSUS:-${REPO_ROOT}/tests/harness/ci-test-census.json}"
MODE="${1:---validate}"

cd "${REPO_ROOT}" || exit 2

ERROR_COUNT=0
RUN_FAILURES=0

error() {
  printf '[ci-test-census] ERROR · %s\n' "$*" >&2
  ERROR_COUNT=$((ERROR_COUNT + 1))
}

fatal() {
  printf '[ci-test-census] ERROR · %s\n' "$*" >&2
  exit 2
}

for prerequisite in git jq sort comm uniq node; do
  command -v "${prerequisite}" >/dev/null 2>&1 || fatal "missing prerequisite command: ${prerequisite}"
done

case "${MODE}" in
  --validate|--node|--shell-python) ;;
  *) fatal "unsupported mode '${MODE}'; expected --validate, --node, or --shell-python" ;;
esac

[[ -f "${CENSUS}" ]] || fatal "Algol census is unavailable: ${CENSUS}"
jq empty "${CENSUS}" >/dev/null 2>&1 || fatal "Algol census is not valid JSON: ${CENSUS}"

TMP_ROOT=""
if ! TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/worldline-ci-tests.XXXXXX")"; then
  fatal "could not create private temporary directory"
fi
cleanup() {
  case "${TMP_ROOT}" in
    "${TMPDIR:-/tmp}"/worldline-ci-tests.*|/tmp/worldline-ci-tests.*|/private/tmp/worldline-ci-tests.*|/var/folders/*/worldline-ci-tests.*)
      rm -rf -- "${TMP_ROOT}" 2>/dev/null || true
      ;;
    *)
      printf '[ci-test-census] WARN · refusing to clean unexpected temp path: %s\n' "${TMP_ROOT}" >&2
      ;;
  esac
}
trap cleanup EXIT INT TERM HUP

DISCOVERED="${TMP_ROOT}/discovered.txt"
CLASSIFIED="${TMP_ROOT}/classified.txt"
MANIFEST_PATHS="${TMP_ROOT}/manifest-paths.txt"
TRACKED_NODE="${TMP_ROOT}/tracked-node.txt"
REQUIRED_NODE="${TMP_ROOT}/required-node.txt"
REQUIRED_NON_NODE="${TMP_ROOT}/required-non-node.tsv"

if [[ "$(jq -r '.schema_version // empty' "${CENSUS}")" != "1" ]]; then
  error "unsupported or missing schema_version (expected 1)"
fi

for bucket in required candidate deferred context manual support; do
  if [[ "$(jq -r --arg bucket "${bucket}" '.[$bucket] | type' "${CENSUS}" 2>/dev/null)" != "array" ]]; then
    error "bucket '${bucket}' must be an array"
  fi
done

if [[ "$(jq -r '.support_patterns | type' "${CENSUS}" 2>/dev/null)" != "array" ]]; then
  error "support_patterns must be an array"
fi

jq -r '[.required, .candidate, .deferred, .context, .manual, .support] | add | .[] | .path // empty' "${CENSUS}" \
  | sort > "${MANIFEST_PATHS}"

while IFS= read -r duplicate; do
  [[ -z "${duplicate}" ]] && continue
  error "sensor is classified more than once: ${duplicate}"
done < <(uniq -d "${MANIFEST_PATHS}")

while IFS=$'\t' read -r bucket path kind reason; do
  [[ -z "${path}" ]] && continue
  case "${path}" in
    /*|*..*) error "${bucket} path must be repository-relative and cannot contain '..': ${path}" ;;
    tests/*) ;;
    *) error "${bucket} path must stay under tests/: ${path}" ;;
  esac
  [[ -n "${kind}" ]] || error "${bucket} entry has no kind: ${path}"
  [[ -n "${reason}" ]] || error "${bucket} entry has no reason: ${path}"
  [[ -e "${path}" ]] || error "classified path is unavailable: ${path}"
  if ! git ls-files --error-unmatch -- "${path}" >/dev/null 2>&1; then
    error "classified path is not tracked by git: ${path}"
  fi
done < <(jq -r '
  ["required", "candidate", "deferred", "context", "manual", "support"][] as $bucket
  | .[$bucket][]?
  | [$bucket, (.path // ""), (.kind // ""), (.reason // "")]
  | @tsv
' "${CENSUS}")

# A candidate is not a parking bucket. It is permitted only when a command was
# actually attempted and the concrete blocker is recorded for the owning test
# author to repair. Portable candidates belong in required immediately.
while IFS=$'\t' read -r path command exit_code observed verified_on; do
  [[ -z "${path}" ]] && continue
  [[ -n "${command}" ]] || error "candidate lacks blocker.command: ${path}"
  [[ "${exit_code}" =~ ^-?[0-9]+$ ]] || error "candidate lacks numeric blocker.exit_code: ${path}"
  [[ -n "${observed}" ]] || error "candidate lacks blocker.observed: ${path}"
  [[ -n "${verified_on}" ]] || error "candidate lacks blocker.verified_on: ${path}"
done < <(jq -r '.candidate[]? | [
  (.path // ""),
  (.blocker.command // ""),
  ((.blocker.exit_code // "") | tostring),
  (.blocker.observed // ""),
  (.blocker.verified_on // "")
] | @tsv' "${CENSUS}")

# Executable denominator. Fixture data and NETRA eval corpora are deliberately
# excluded; every tracked runnable shell/Python/Node/TS test is included.
git ls-files -- 'tests/**' \
  | awk '
      /\.test\.mjs$/ { print; next }
      /\.test\.sh$/ { print; next }
      /\.test\.py$/ { print; next }
      /^tests\/harness\/.*\.(sh|py)$/ { print; next }
      /^tests\/proxy-logic-verify\.mjs$/ { print; next }
      /^tests\/proxy\.test\.ts$/ { print; next }
    ' \
  | sort -u > "${DISCOVERED}"

jq -r '[.required, .candidate, .deferred, .context, .manual] | add | .[] | .path' "${CENSUS}" \
  | sort -u > "${CLASSIFIED}"

while IFS= read -r omitted; do
  [[ -z "${omitted}" ]] && continue
  error "tracked executable sensor is absent from the census: ${omitted}"
done < <(comm -23 "${DISCOVERED}" "${CLASSIFIED}")

while IFS= read -r phantom; do
  [[ -z "${phantom}" ]] && continue
  error "census classifies a non-discovered executable path: ${phantom}"
done < <(comm -13 "${DISCOVERED}" "${CLASSIFIED}")

# Every tracked deterministic Node test is required and is executed from the
# discovered list. This exact-set comparison makes both omission and a silent
# downgrade to candidate/deferred fail.
git ls-files -- 'tests/**' | awk '/\.test\.mjs$/' | sort -u > "${TRACKED_NODE}"
jq -r '.required[]? | select(.kind == "node-test") | .path' "${CENSUS}" | sort -u > "${REQUIRED_NODE}"

while IFS= read -r omitted; do
  [[ -z "${omitted}" ]] && continue
  error "tracked Node test is not required: ${omitted}"
done < <(comm -23 "${TRACKED_NODE}" "${REQUIRED_NODE}")

while IFS= read -r phantom; do
  [[ -z "${phantom}" ]] && continue
  error "required node-test is not a tracked *.test.mjs sensor: ${phantom}"
done < <(comm -13 "${TRACKED_NODE}" "${REQUIRED_NODE}")

jq -r '.required[]?
  | select(.kind != "node-test")
  | [.path, .kind]
  | @tsv' "${CENSUS}" > "${REQUIRED_NON_NODE}"

EXPECTED_NON_NODE_COUNT="$(awk 'NF { count++ } END { print count + 0 }' "${REQUIRED_NON_NODE}")"
required_shell_python_count="$(awk -F '\t' '$2 ~ /^(shell-|python-)/ { count++ } END { print count + 0 }' "${REQUIRED_NON_NODE}")"
if [[ "${required_shell_python_count}" -eq 0 ]]; then
  error "required shell/Python lane is empty; portable candidates were not promoted"
fi

if [[ "${ERROR_COUNT}" -gt 0 ]]; then
  printf '[ci-test-census] FAIL · %s census error(s)\n' "${ERROR_COUNT}" >&2
  exit 1
fi

printf '[ci-test-census] PASS · executable=%s · node_required=%s · non_node_required=%s · candidate_blocked=%s\n' \
  "$(wc -l < "${DISCOVERED}" | tr -d ' ')" \
  "$(wc -l < "${REQUIRED_NODE}" | tr -d ' ')" \
  "$(wc -l < "${REQUIRED_NON_NODE}" | tr -d ' ')" \
  "$(jq '.candidate | length' "${CENSUS}")"

if [[ "${MODE}" == "--validate" ]]; then
  exit 0
fi

if [[ "${MODE}" == "--node" ]]; then
  NODE_TESTS=()
  while IFS= read -r test_path; do
    [[ -z "${test_path}" ]] && continue
    NODE_TESTS[${#NODE_TESTS[@]}]="${test_path}"
  done < "${TRACKED_NODE}"

  if [[ "${#NODE_TESTS[@]}" -eq 0 ]]; then
    fatal "tracked Node test denominator is empty"
  fi

  printf '[ci-test-census] RUN · node --test · files=%s\n' "${#NODE_TESTS[@]}"
  exec node --test "${NODE_TESTS[@]}"
fi

run_required_sensor() {
  local path="$1"
  local kind="$2"
  local output_file="${TMP_ROOT}/run-$3.log"
  local exit_code=0

  case "${kind}" in
    shell-*)
      CI=true CLAUDE_PROJECT_DIR="${REPO_ROOT}" WL_TASK_ID="ci-shell-python-sensors" \
        bash "${path}" < /dev/null > "${output_file}" 2>&1 || exit_code=$?
      ;;
    python-*)
      CI=true CLAUDE_PROJECT_DIR="${REPO_ROOT}" WL_TASK_ID="ci-shell-python-sensors" \
        python3 "${path}" < /dev/null > "${output_file}" 2>&1 || exit_code=$?
      ;;
    node-test-nonstandard-name)
      CI=true CLAUDE_PROJECT_DIR="${REPO_ROOT}" WL_TASK_ID="ci-shell-python-sensors" \
        node "${path}" < /dev/null > "${output_file}" 2>&1 || exit_code=$?
      ;;
    tsx-test-nonstandard-runner)
      CI=true CLAUDE_PROJECT_DIR="${REPO_ROOT}" WL_TASK_ID="ci-shell-python-sensors" \
        node --import tsx "${path}" < /dev/null > "${output_file}" 2>&1 || exit_code=$?
      ;;
    *)
      printf '[ci-test-census] FAIL · unsupported required kind=%s path=%s\n' "${kind}" "${path}" >&2
      return 1
      ;;
  esac

  if [[ "${exit_code}" -eq 0 ]]; then
    printf '[ci-test-census] PASS · %s · %s\n' "${kind}" "${path}"
    return 0
  fi

  printf '[ci-test-census] FAIL · %s · %s · exit=%s\n' "${kind}" "${path}" "${exit_code}" >&2
  cat "${output_file}" >&2
  return 1
}

run_index=0
while IFS=$'\t' read -r test_path test_kind; do
  [[ -z "${test_path}" ]] && continue
  run_index=$((run_index + 1))
  if ! run_required_sensor "${test_path}" "${test_kind}" "${run_index}"; then
    RUN_FAILURES=$((RUN_FAILURES + 1))
  fi
done < "${REQUIRED_NON_NODE}"

if [[ "${run_index}" -ne "${EXPECTED_NON_NODE_COUNT}" ]]; then
  printf '[ci-test-census] FAIL · required non-Node execution count mismatch · expected=%s · executed=%s\n' \
    "${EXPECTED_NON_NODE_COUNT}" "${run_index}" >&2
  exit 1
fi

if [[ "${RUN_FAILURES}" -gt 0 ]]; then
  printf '[ci-test-census] FAIL · %s required non-Node sensor(s) failed\n' "${RUN_FAILURES}" >&2
  exit 1
fi

printf '[ci-test-census] PASS · all %s required non-Node sensors passed\n' "${run_index}"
exit 0

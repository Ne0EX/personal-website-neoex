#!/usr/bin/env bash
# =============================================================================
# audit-harness-ci.sh
#
# Config-driven CI census for the Worldline harness.
#
# The `ci` object on each rail in .harness/worldline-harness.config.json is the
# authoritative CI contract. Config v3 also carries an omission-failing
# ci_policy.required_rails manifest, so deleting or downgrading a required rail
# cannot silently shrink the denominator. The runner enumerates every
# configured rail in stable (lexicographic) order and emits exactly one JSONL
# record for each rail, followed by one summary record.
#
# Status contract:
#   PASS  - a configured rail ran and exited 0 without reporting SKIP
#   FAIL  - a configured rail ran and exited nonzero (or reported SKIP with 0)
#   ERROR - the runner could not establish or execute the configured contract
#   SKIP  - an intentional non-required rail (context-only, stub, or deferred)
#
# Missing commands, paths, metadata, or required environment are ERROR. They
# are never converted into PASS. stdout is machine-readable JSONL; diagnostics
# from failed checks go to stderr and never corrupt the records. No timestamps,
# random values, or wall-clock dates are emitted.
# =============================================================================

set -u -o pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="${WORLDLINE_HARNESS_CONFIG:-${REPO_ROOT}/.harness/worldline-harness.config.json}"

cd "${REPO_ROOT}" || exit 2

PASS_COUNT=0
SKIP_COUNT=0
FAIL_COUNT=0
ERROR_COUNT=0
REQUIRED_FAILURE_COUNT=0
OPTIONAL_FAIL_COUNT=0
OPTIONAL_ERROR_COUNT=0
RAIL_COUNT=0

emit_record() {
  local type="$1"
  local rail="$2"
  local status="$3"
  local required="$4"
  local check="$5"
  local reason="$6"
  local exit_code="$7"

  jq -cn \
    --arg type "${type}" \
    --arg rail "${rail}" \
    --arg status "${status}" \
    --arg check "${check}" \
    --arg reason "${reason}" \
    --argjson required "${required}" \
    --argjson exit_code "${exit_code}" \
    '{type:$type,rail:$rail,status:$status,required:$required,check:$check,reason:$reason,exit_code:$exit_code}'
}

record() {
  local rail="$1"
  local status="$2"
  local required="$3"
  local check="$4"
  local reason="$5"
  local exit_code="$6"

  emit_record "rail" "${rail}" "${status}" "${required}" "${check}" "${reason}" "${exit_code}"
  RAIL_COUNT=$((RAIL_COUNT + 1))

  case "${status}" in
    PASS)
      PASS_COUNT=$((PASS_COUNT + 1))
      ;;
    SKIP)
      SKIP_COUNT=$((SKIP_COUNT + 1))
      if [[ "${required}" == "true" ]]; then
        REQUIRED_FAILURE_COUNT=$((REQUIRED_FAILURE_COUNT + 1))
      fi
      ;;
    FAIL)
      FAIL_COUNT=$((FAIL_COUNT + 1))
      if [[ "${required}" == "true" ]]; then
        REQUIRED_FAILURE_COUNT=$((REQUIRED_FAILURE_COUNT + 1))
      else
        OPTIONAL_FAIL_COUNT=$((OPTIONAL_FAIL_COUNT + 1))
      fi
      ;;
    ERROR)
      ERROR_COUNT=$((ERROR_COUNT + 1))
      if [[ "${required}" == "true" ]]; then
        REQUIRED_FAILURE_COUNT=$((REQUIRED_FAILURE_COUNT + 1))
      else
        OPTIONAL_ERROR_COUNT=$((OPTIONAL_ERROR_COUNT + 1))
      fi
      ;;
  esac
}

runner_error() {
  local reason="$1"
  emit_record "runner" "__runner__" "ERROR" "true" ".harness/worldline-harness.config.json" "${reason}" "null"
  emit_record "summary" "__summary__" "ERROR" "true" "" "runner could not enumerate configured rails" "null"
  exit 1
}

for prerequisite in jq sort uniq wc tr; do
  command -v "${prerequisite}" >/dev/null 2>&1 || runner_error "missing prerequisite command: ${prerequisite}"
done

if [[ ! -f "${CONFIG}" ]]; then
  runner_error "harness config not found: ${CONFIG}"
fi

if ! jq empty "${CONFIG}" >/dev/null 2>&1; then
  runner_error "harness config is not valid JSON: ${CONFIG}"
fi

if [[ "$(jq -r 'if (.rails | type) == "object" then "ok" else "invalid" end' "${CONFIG}")" != "ok" ]]; then
  runner_error "harness config has no object-valued .rails census"
fi

CONFIG_VERSION="$(jq -r 'if (.config_version | type) == "number" then .config_version else 0 end' "${CONFIG}")"
STRICT_CI_SCHEMA="false"
if [[ "${CONFIG_VERSION}" -ge 3 ]]; then
  STRICT_CI_SCHEMA="true"
fi

# Synthetic regression fixtures predating config v3 remain supported. The
# authoritative v3 config is deliberately strict: all rails need an explicit
# machine-readable CI profile, and required rails have a separate denominator.
if [[ "${STRICT_CI_SCHEMA}" == "true" ]]; then
  if ! jq -e '
    (.ci_policy.required_rails | type) == "array"
    and (.ci_policy.required_rails | length) > 0
    and all(.ci_policy.required_rails[]; type == "string" and length > 0)
  ' "${CONFIG}" >/dev/null; then
    runner_error "config v3 requires a non-empty string-valued ci_policy.required_rails manifest"
  fi

  if [[ "$(jq -r '.ci_policy.required_rails[]' "${CONFIG}" | sort | uniq -d | wc -l | tr -d ' ')" -ne 0 ]]; then
    runner_error "ci_policy.required_rails contains duplicate rail ids"
  fi

  if [[ "$(jq -c '.ci_policy.classification_values // [] | sort' "${CONFIG}")" != '["advisory","context","deferred","embedded","required","stub"]' ]]; then
    runner_error "ci_policy.classification_values must declare the complete v3 classification vocabulary"
  fi

  while IFS= read -r rail; do
    [[ -z "${rail}" ]] && continue
    if ! jq -e --arg rail "${rail}" '.rails | has($rail)' "${CONFIG}" >/dev/null; then
      runner_error "required CI rail is absent from .rails: ${rail}"
    fi
    if ! jq -e --arg rail "${rail}" '
      .rails[$rail].ci.required == true
      and .rails[$rail].ci.disposition == "run"
      and .rails[$rail].ci.deterministic == true
      and .rails[$rail].ci.classification == "required"
    ' "${CONFIG}" >/dev/null; then
      runner_error "required CI rail was downgraded or has malformed metadata: ${rail}"
    fi
  done < <(jq -r '.ci_policy.required_rails[]' "${CONFIG}")

  while IFS= read -r rail; do
    [[ -z "${rail}" ]] && continue
    if ! jq -e --arg rail "${rail}" '.ci_policy.required_rails | index($rail) != null' "${CONFIG}" >/dev/null; then
      runner_error "ci.required=true rail is missing from ci_policy.required_rails: ${rail}"
    fi
  done < <(jq -r '.rails | to_entries[] | select(.value.ci.required == true) | .key' "${CONFIG}")

  while IFS= read -r rail; do
    [[ -z "${rail}" ]] && continue
    if ! jq -e --arg rail "${rail}" '(.rails[$rail].ci | type) == "object"' "${CONFIG}" >/dev/null; then
      runner_error "config v3 rail is missing explicit ci metadata: ${rail}"
    fi
    if ! jq -e --arg rail "${rail}" '
      (.rails[$rail].ci.required | type) == "boolean"
      and (.rails[$rail].ci.deterministic | type) == "boolean"
      and (.rails[$rail].ci.disposition == "run" or .rails[$rail].ci.disposition == "skip" or .rails[$rail].ci.disposition == "deferred")
      and ((.rails[$rail].ci.classification) as $classification | ["required", "advisory", "context", "embedded", "deferred", "stub"] | index($classification) != null)
    ' "${CONFIG}" >/dev/null; then
      runner_error "config v3 rail has malformed CI fields: ${rail}"
    fi

    disposition="$(jq -r --arg rail "${rail}" '.rails[$rail].ci.disposition' "${CONFIG}")"
    if [[ "${disposition}" == "run" ]]; then
      if ! jq -e --arg rail "${rail}" '
        .rails[$rail].ci.deterministic == true
        and (
          (.rails[$rail].ci.required == true and .rails[$rail].ci.classification == "required")
          or
          (.rails[$rail].ci.required == false and .rails[$rail].ci.classification == "advisory" and ((.rails[$rail].ci.reason // "") | length) > 0)
        )
      ' "${CONFIG}" >/dev/null; then
        runner_error "CI-run rail must be deterministic and classified required/advisory: ${rail}"
      fi
    else
      if ! jq -e --arg rail "${rail}" '
        .rails[$rail].ci.required == false
        and ((.rails[$rail].ci.reason // "") | type) == "string"
        and ((.rails[$rail].ci.reason // "") | length) > 0
        and (.rails[$rail].ci.prerequisites | type) == "array"
        and (.rails[$rail].ci.prerequisites | length) > 0
        and all(.rails[$rail].ci.prerequisites[]; type == "string" and length > 0)
        and (
          (.rails[$rail].ci.disposition == "deferred" and .rails[$rail].ci.classification == "deferred")
          or
          (.rails[$rail].ci.disposition == "skip" and ((.rails[$rail].ci.classification) as $classification | ["context", "embedded", "stub"] | index($classification) != null))
        )
      ' "${CONFIG}" >/dev/null; then
        runner_error "CI-excluded rail needs a non-empty reason/prerequisite list and matching classification: ${rail}"
      fi
    fi
  done < <(jq -r '.rails | keys[]' "${CONFIG}")
fi

TMP_DIR=""
if ! TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/worldline-ci-sensors.XXXXXX")"; then
  runner_error "could not create a private temporary directory for check output"
fi
trap 'rm -rf -- "${TMP_DIR}"' EXIT

COMMIT_DATE=""
if command -v git >/dev/null 2>&1; then
  COMMIT_DATE="$(git show -s --format=%cs HEAD 2>/dev/null || true)"
fi

run_configured_rail() {
  local rail="$1"
  local check="$2"
  local required="$3"
  local disposition="$4"
  local deterministic="$5"
  local reason="$6"
  local check_path="${REPO_ROOT}/${check}"
  local missing_commands=""
  local missing_paths=""
  local arg
  local expanded_arg
  local output_file="${TMP_DIR}/${RAIL_COUNT}.stdout"
  local error_file="${TMP_DIR}/${RAIL_COUNT}.stderr"
  local check_exit
  local -a args=()

  if [[ "${disposition}" == "skip" || "${disposition}" == "deferred" ]]; then
    if [[ -z "${reason}" ]]; then
      record "${rail}" "ERROR" "${required}" "${check}" "CI skip/defer requires a non-empty reason" "null"
    else
      record "${rail}" "SKIP" "${required}" "${check}" "${reason}" "null"
    fi
    return
  fi

  if [[ "${disposition}" != "run" ]]; then
    record "${rail}" "ERROR" "${required}" "${check}" "unsupported CI disposition: ${disposition}" "null"
    return
  fi

  if [[ "${deterministic}" != "true" ]]; then
    record "${rail}" "ERROR" "${required}" "${check}" "CI-run rail is not marked deterministic" "null"
    return
  fi

  if [[ -z "${check}" || "${check}" == /* || "${check}" == *".."* || ! -f "${check_path}" ]]; then
    record "${rail}" "ERROR" "${required}" "${check}" "configured check is not an available repository file" "null"
    return
  fi

  while IFS= read -r arg; do
    [[ -z "${arg}" ]] && continue
    if [[ "${arg}" == '$CI_COMMIT_DATE' ]]; then
      if [[ -z "${COMMIT_DATE}" ]]; then
        record "${rail}" "ERROR" "${required}" "${check}" "cannot resolve deterministic CI_COMMIT_DATE from repository history" "null"
        return
      fi
      expanded_arg="${COMMIT_DATE}"
    else
      expanded_arg="${arg}"
    fi
    args+=("${expanded_arg}")
  done < <(jq -r --arg rail "${rail}" '.rails[$rail].ci.args[]?' "${CONFIG}")

  while IFS= read -r arg; do
    [[ -z "${arg}" ]] && continue
    if ! command -v "${arg}" >/dev/null 2>&1; then
      if [[ -n "${missing_commands}" ]]; then
        missing_commands+=", "
      fi
      missing_commands+="${arg}"
    fi
  done < <(jq -r --arg rail "${rail}" '.rails[$rail].ci.requires.commands[]?' "${CONFIG}")

  if [[ -n "${missing_commands}" ]]; then
    record "${rail}" "ERROR" "${required}" "${check}" "missing prerequisite command(s): ${missing_commands}" "null"
    return
  fi

  while IFS= read -r arg; do
    [[ -z "${arg}" ]] && continue
    if [[ "${arg}" == /* ]]; then
      if [[ ! -e "${arg}" ]]; then
        if [[ -n "${missing_paths}" ]]; then
          missing_paths+=", "
        fi
        missing_paths+="${arg}"
      fi
    elif [[ ! -e "${REPO_ROOT}/${arg}" ]]; then
      if [[ -n "${missing_paths}" ]]; then
        missing_paths+=", "
      fi
      missing_paths+="${arg}"
    fi
  done < <(jq -r --arg rail "${rail}" '.rails[$rail].ci.requires.paths[]?' "${CONFIG}")

  if [[ -n "${missing_paths}" ]]; then
    record "${rail}" "ERROR" "${required}" "${check}" "missing prerequisite path(s): ${missing_paths}" "null"
    return
  fi

  # CI receives a fixed task label only for child log naming. No task-scoped
  # rail is run here; those rails are represented as explicit config SKIPs.
  if [[ "${#args[@]}" -gt 0 ]]; then
    CI=true CLAUDE_TASK_ID=ci-sensor WL_TASK_ID="" TODAY_ISO="${COMMIT_DATE}" \
      bash "${check_path}" "${args[@]}" >"${output_file}" 2>"${error_file}"
  else
    CI=true CLAUDE_TASK_ID=ci-sensor WL_TASK_ID="" TODAY_ISO="${COMMIT_DATE}" \
      bash "${check_path}" >"${output_file}" 2>"${error_file}"
  fi
  check_exit=$?

  if [[ "${check_exit}" -eq 0 ]]; then
    if grep -Eiq '(^|[^[:alnum:]_])SKIP([^[:alnum:]_]|$)' "${output_file}" "${error_file}" 2>/dev/null; then
      record "${rail}" "FAIL" "${required}" "${check}" "check exited 0 but reported SKIP; applicability/prerequisites were not proven" "0"
      {
        echo "[harness-ci] ${rail} emitted SKIP with exit 0:"
        cat "${output_file}" "${error_file}"
      } >&2
      return
    fi
    record "${rail}" "PASS" "${required}" "${check}" "check exited 0" "0"
    return
  fi

  record "${rail}" "FAIL" "${required}" "${check}" "check exited nonzero" "${check_exit}"
  {
    echo "[harness-ci] ${rail} output (exit ${check_exit}):"
    cat "${output_file}" "${error_file}"
  } >&2
}

while IFS= read -r rail; do
  [[ -z "${rail}" ]] && continue

  rail_json="$(jq -c --arg rail "${rail}" '.rails[$rail]' "${CONFIG}")"
  status="$(jq -r '.status // ""' <<< "${rail_json}")"
  check="$(jq -r '.check // ""' <<< "${rail_json}")"
  ci_type="$(jq -r 'if has("ci") then (.ci | type) else "missing" end' <<< "${rail_json}")"

  if [[ "${ci_type}" != "object" ]]; then
    if [[ "${status}" == "enforcing" ]]; then
      record "${rail}" "ERROR" "true" "${check}" "enforcing rail is missing its authoritative ci metadata" "null"
    else
      record "${rail}" "SKIP" "false" "${check}" "non-enforcing rail (status=${status:-missing}) has no CI execution profile" "null"
    fi
    continue
  fi

  required="$(jq -r 'if .ci.required == null then "missing" else (.ci.required | tostring) end' <<< "${rail_json}")"
  disposition="$(jq -r '.ci.disposition // "missing"' <<< "${rail_json}")"
  deterministic="$(jq -r 'if .ci.deterministic == null then "missing" else (.ci.deterministic | tostring) end' <<< "${rail_json}")"
  reason="$(jq -r '.ci.reason // ""' <<< "${rail_json}")"

  if [[ "${required}" != "true" && "${required}" != "false" ]]; then
    record "${rail}" "ERROR" "true" "${check}" "ci.required must be boolean" "null"
    continue
  fi

  run_configured_rail "${rail}" "${check}" "${required}" "${disposition}" "${deterministic}" "${reason}"
done < <(jq -r '.rails | keys[]' "${CONFIG}")

if [[ "${RAIL_COUNT}" -eq 0 ]]; then
  runner_error "harness config defines no rails"
fi

aggregate_status="PASS"
if [[ "${REQUIRED_FAILURE_COUNT}" -gt 0 ]]; then
  aggregate_status="FAIL"
fi

jq -cn \
  --arg status "${aggregate_status}" \
  --argjson rails "${RAIL_COUNT}" \
  --argjson pass "${PASS_COUNT}" \
  --argjson skip "${SKIP_COUNT}" \
  --argjson fail "${FAIL_COUNT}" \
  --argjson error "${ERROR_COUNT}" \
  --argjson required_failures "${REQUIRED_FAILURE_COUNT}" \
  --argjson optional_fail "${OPTIONAL_FAIL_COUNT}" \
  --argjson optional_error "${OPTIONAL_ERROR_COUNT}" \
  '({type:"summary",rail:"__summary__",status:$status,required:true,check:"",reason:"config-driven CI census complete",exit_code:(if $status == "PASS" then 0 else 1 end),rails:$rails,pass:$pass,skip:$skip,fail:$fail,error:$error,required_failures:$required_failures}
    + if ($optional_fail > 0 or $optional_error > 0)
      then {optional_fail:$optional_fail,optional_error:$optional_error}
      else {}
      end)'

if [[ "${REQUIRED_FAILURE_COUNT}" -gt 0 ]]; then
  exit 1
fi
exit 0

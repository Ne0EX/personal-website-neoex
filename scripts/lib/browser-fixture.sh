#!/usr/bin/env bash
# Shared lifecycle for browser-backed CI rails. Source this file; do not execute it.

BROWSER_FIXTURE_PID=""
BROWSER_FIXTURE_LOG=""
BROWSER_FIXTURE_BASE_URL=""

browser_fixture_port_is_free() {
  local port="$1"
  node -e '
    const { createServer } = require("node:net")
    const server = createServer()
    server.once("error", () => process.exit(1))
    server.listen({ host: "127.0.0.1", port: Number(process.argv[1]), exclusive: true }, () => {
      server.close(() => process.exit(0))
    })
  ' "${port}"
}

browser_fixture_select_port() {
  local preferred="${1:-4173}"
  local port
  local upper

  if [[ ! "${preferred}" =~ ^[0-9]+$ || "${preferred}" -lt 1024 || "${preferred}" -gt 65535 ]]; then
    echo "[browser-fixture] invalid requested port: ${preferred}" >&2
    return 1
  fi

  upper=$((preferred + 99))
  if [[ "${upper}" -gt 65535 ]]; then
    upper=65535
  fi
  for ((port=preferred; port<=upper; port++)); do
    if browser_fixture_port_is_free "${port}"; then
      printf '%s\n' "${port}"
      return 0
    fi
  done

  # An ephemeral preferred port can be close to 65535. Keep a stable fallback
  # range so the bounded search still has room instead of wrapping past 65535.
  if [[ "${preferred}" -ne 4173 ]]; then
    for ((port=4173; port<=4272; port++)); do
      if browser_fixture_port_is_free "${port}"; then
        printf '%s\n' "${port}"
        return 0
      fi
    done
  fi

  echo "[browser-fixture] no free loopback port in the bounded search" >&2
  return 1
}

browser_fixture_stop() {
  if [[ -n "${BROWSER_FIXTURE_PID}" ]]; then
    kill "${BROWSER_FIXTURE_PID}" 2>/dev/null || true
    wait "${BROWSER_FIXTURE_PID}" 2>/dev/null || true
    BROWSER_FIXTURE_PID=""
  fi
  if [[ -n "${BROWSER_FIXTURE_LOG}" && -f "${BROWSER_FIXTURE_LOG}" ]]; then
    rm -f -- "${BROWSER_FIXTURE_LOG}"
    BROWSER_FIXTURE_LOG=""
  fi
}

browser_fixture_wait() {
  local readiness_url="$1"
  local attempt

  for attempt in {1..80}; do
    if ! kill -0 "${BROWSER_FIXTURE_PID}" 2>/dev/null; then
      echo "[browser-fixture] server exited before readiness: ${readiness_url}" >&2
      cat "${BROWSER_FIXTURE_LOG}" >&2
      return 1
    fi
    if node -e 'fetch(process.argv[1], { redirect: "follow" }).then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))' "${readiness_url}"; then
      if kill -0 "${BROWSER_FIXTURE_PID}" 2>/dev/null; then
        return 0
      fi
    fi
    sleep 0.25
  done

  echo "[browser-fixture] readiness timeout: ${readiness_url}" >&2
  cat "${BROWSER_FIXTURE_LOG}" >&2
  return 1
}

browser_fixture_start_next() {
  local repo_root="$1"
  local requested_port="${2:-4173}"
  local port
  local readiness_path="${3:-/en}"
  local next_bin="${repo_root}/node_modules/next/dist/bin/next"

  if [[ ! -f "${repo_root}/.next/BUILD_ID" ]]; then
    echo "[browser-fixture] ERROR: production build missing (.next/BUILD_ID)" >&2
    return 1
  fi
  if [[ ! -f "${next_bin}" ]]; then
    echo "[browser-fixture] ERROR: installed Next binary missing" >&2
    return 1
  fi

  port="$(browser_fixture_select_port "${requested_port}")" || return 1

  BROWSER_FIXTURE_LOG=$(mktemp "${TMPDIR:-/tmp}/worldline-next-fixture.XXXXXX")
  BROWSER_FIXTURE_BASE_URL="http://127.0.0.1:${port}"
  node "${next_bin}" start --hostname 127.0.0.1 --port "${port}" >"${BROWSER_FIXTURE_LOG}" 2>&1 &
  BROWSER_FIXTURE_PID=$!

  if ! browser_fixture_wait "${BROWSER_FIXTURE_BASE_URL}${readiness_path}"; then
    browser_fixture_stop
    return 1
  fi
}

browser_fixture_start_static() {
  local repo_root="$1"
  local requested_port="${2:-4174}"
  local port
  local readiness_path="${3:-/}"

  port="$(browser_fixture_select_port "${requested_port}")" || return 1

  BROWSER_FIXTURE_LOG=$(mktemp "${TMPDIR:-/tmp}/worldline-static-fixture.XXXXXX")
  BROWSER_FIXTURE_BASE_URL="http://127.0.0.1:${port}"
  python3 -m http.server "${port}" --bind 127.0.0.1 --directory "${repo_root}" >"${BROWSER_FIXTURE_LOG}" 2>&1 &
  BROWSER_FIXTURE_PID=$!

  if ! browser_fixture_wait "${BROWSER_FIXTURE_BASE_URL}${readiness_path}"; then
    browser_fixture_stop
    return 1
  fi
}

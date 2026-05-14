#!/usr/bin/env bash
# scripts/fetch-design-bundle.sh
# Fetch, decompress, and extract a gzip-tar design bundle from a URL.
#
# Usage:
#   bash scripts/fetch-design-bundle.sh <bundle_url> <output_dir> [--overwrite]
#
# Arguments:
#   bundle_url    URL of the design bundle (gzip-compressed tar archive, or a
#                 bare HTML/gzip file). The script sniffs Content-Type and magic
#                 bytes at download time and handles both .tar.gz and flat .gz.
#   output_dir    Directory to extract into. Must be empty (or not yet exist)
#                 unless --overwrite is given.
#   --overwrite   Allow writing into a non-empty output_dir. Existing files are
#                 overwritten; files not in the archive are left untouched.
#
# Behavior:
#   1. Downloads the bundle to a temporary file (cleaned up on exit).
#   2. Sniffs whether it is gzip-tar or bare gzip.
#      - gzip-tar  → extracts with tar -xzf into <output_dir>
#      - bare gzip → decompresses to <output_dir>/<basename>.html (or .bin if
#                    Content-Type does not hint at HTML)
#   3. Prints a manifest of extracted files to stdout (one path per line,
#      relative to <output_dir>).
#   4. Exits 0 on success, non-zero on any failure.
#
# Authorization model:
#   !!IMPORTANT!! This script makes an outbound HTTP request to <bundle_url>.
#   It does NOT verify whether the URL is on any allowlist. The caller is
#   responsible for confirming that Peat has explicitly authorized the URL for
#   the current task before invoking this script. Unauthorized network fetches
#   violate the Worldline team's URL-authorization policy.
#
#   Currently authorized domains (per Peat's task-level approvals):
#     - localhost / 127.0.0.1 (any port) — always free for local dev bundles
#     - api.anthropic.com — authorized by Peat in TASK-2026-05-14-06
#
#   To widen for a new task: record the Peat-authorization in the task handoff
#   and add the domain to the list above as a dated entry. Do not fetch from
#   new domains without a task-level authorization note.
#
# Requires: curl, file, gzip, tar, python3 (for manifest sort only)
#
# Owner: Canopus (α-HRN-07)
# Part of: TASK-2026-05-14-07 render-capability infrastructure

set -euo pipefail

BUNDLE_URL="${1:-}"
OUTPUT_DIR="${2:-}"
OVERWRITE=false

# Parse optional flags (anything after the first two positional args)
shift 2 2>/dev/null || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --overwrite) OVERWRITE=true; shift ;;
    *)
      echo "fetch-design-bundle: unknown argument: $1" >&2
      echo "Usage: fetch-design-bundle.sh <bundle_url> <output_dir> [--overwrite]" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$BUNDLE_URL" || -z "$OUTPUT_DIR" ]]; then
  echo "fetch-design-bundle: missing required arguments" >&2
  echo "Usage: fetch-design-bundle.sh <bundle_url> <output_dir> [--overwrite]" >&2
  exit 1
fi

# --- Guard: refuse to clobber a non-empty output dir without --overwrite ---
if [[ -d "$OUTPUT_DIR" && -n "$(ls -A "$OUTPUT_DIR" 2>/dev/null)" ]]; then
  if ! $OVERWRITE; then
    echo "fetch-design-bundle: output directory '$OUTPUT_DIR' is non-empty." >&2
    echo "  Pass --overwrite to allow writing into it." >&2
    exit 2
  fi
fi

mkdir -p "$OUTPUT_DIR"

# --- Download to a temp file ---
TMP_BUNDLE="$(mktemp /tmp/fetch-design-bundle-XXXXXX)"
cleanup() {
  rm -f "$TMP_BUNDLE" 2>/dev/null || true
}
trap cleanup EXIT

echo "fetch-design-bundle: downloading $BUNDLE_URL …"
if ! curl --fail --silent --show-error --location \
     --output "$TMP_BUNDLE" \
     "$BUNDLE_URL"; then
  echo "fetch-design-bundle: download failed (curl exited non-zero)" >&2
  echo "  URL: $BUNDLE_URL" >&2
  echo "  Check that the URL is reachable and Peat-authorized." >&2
  exit 3
fi

DOWNLOAD_BYTES=$(wc -c < "$TMP_BUNDLE" | tr -d ' ')
echo "fetch-design-bundle: downloaded ${DOWNLOAD_BYTES} bytes"

# --- Sniff file type ---
MIME_TYPE="$(file --mime-type -b "$TMP_BUNDLE" 2>/dev/null || echo "application/octet-stream")"
echo "fetch-design-bundle: detected MIME type: $MIME_TYPE"

# Peek at the first few bytes: 0x1f 0x8b = gzip magic; 0x1f 0x8b followed by
# the gzip member starting with a tar header at the right offset = gzip-tar.
# The simplest reliable test: try `tar -tzf` — if it works, it is a gzip-tar.
IS_GZIP_TAR=false
if echo "$MIME_TYPE" | grep -qE "gzip|x-tar|octet-stream|compressed"; then
  if tar -tzf "$TMP_BUNDLE" > /dev/null 2>&1; then
    IS_GZIP_TAR=true
  fi
fi

if $IS_GZIP_TAR; then
  # --- gzip-tar extraction ---
  echo "fetch-design-bundle: extracting gzip-tar archive into $OUTPUT_DIR …"
  tar -xzf "$TMP_BUNDLE" -C "$OUTPUT_DIR"

  # Manifest: all files under OUTPUT_DIR, relative paths
  echo "fetch-design-bundle: manifest of extracted files:"
  find "$OUTPUT_DIR" -type f \
    | sort \
    | while read -r f; do
        rel="${f#"$OUTPUT_DIR/"}"
        echo "  $rel"
      done

elif echo "$MIME_TYPE" | grep -qE "gzip|compressed"; then
  # --- bare gzip (e.g., a single compressed HTML file) ---
  # Derive output filename from URL basename
  URL_BASENAME="$(basename "${BUNDLE_URL%%\?*}")"
  # Strip .gz extension if present; default to .html if no extension remains
  OUT_STEM="${URL_BASENAME%.gz}"
  if [[ "$OUT_STEM" == "$URL_BASENAME" ]]; then
    OUT_STEM="${URL_BASENAME%.gzip}"
  fi
  if [[ -z "${OUT_STEM##*.}" || "$OUT_STEM" == "$URL_BASENAME" ]]; then
    OUT_STEM="${OUT_STEM}.html"
  fi
  OUT_FILE="$OUTPUT_DIR/$OUT_STEM"

  echo "fetch-design-bundle: decompressing bare gzip → $OUT_FILE …"
  gunzip -c "$TMP_BUNDLE" > "$OUT_FILE"

  echo "fetch-design-bundle: manifest of extracted files:"
  rel="${OUT_FILE#"$OUTPUT_DIR/"}"
  echo "  $rel"

else
  # --- Unknown type: copy as-is and warn ---
  echo "fetch-design-bundle: WARNING — unrecognized file type ($MIME_TYPE); saving as-is" >&2
  URL_BASENAME="$(basename "${BUNDLE_URL%%\?*}")"
  OUT_FILE="$OUTPUT_DIR/${URL_BASENAME:-bundle.bin}"
  cp "$TMP_BUNDLE" "$OUT_FILE"

  echo "fetch-design-bundle: manifest of extracted files:"
  rel="${OUT_FILE#"$OUTPUT_DIR/"}"
  echo "  $rel"
fi

echo "fetch-design-bundle: done — output at $OUTPUT_DIR"
exit 0

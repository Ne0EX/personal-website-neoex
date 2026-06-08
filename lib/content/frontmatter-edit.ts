/**
 * lib/content/frontmatter-edit.ts
 * ---------------------------------
 * Surgical, pure-string YAML frontmatter transforms for MDX files.
 *
 * WHAT THIS IS:
 *   Pure functions that set or remove a single top-level scalar field inside
 *   the leading `---`-fenced YAML frontmatter block of an MDX string.
 *   No file I/O. No gray-matter. No YAML round-trip.
 *
 * WHY NO YAML PARSER:
 *   A YAML round-trip would silently reformat quote styles, key order, blank
 *   lines, and comments. The result would be noisy diffs — unacceptable when
 *   Peat reviews git diffs before every commit. These functions touch only the
 *   minimum bytes required: one line added, replaced, or removed.
 *
 * CONSUMERS:
 *   Altair's dev-only server actions (savePlaceHighlights, savePlaceCoord,
 *   createPlace) — writing placeId / highlightForPlace / highlightRank to
 *   article and photo sidecar MDX files. All three fields are top-level scalars.
 *
 * INVARIANTS (both functions guarantee):
 *   - MDX body bytes after the closing `---` fence are returned VERBATIM.
 *   - All other frontmatter lines (key order, quote style, blank lines,
 *     comments) are returned VERBATIM.
 *   - Only the targeted key line is added, replaced, or removed.
 *   - CRLF files: line endings in the frontmatter region are preserved.
 *   - EOF trailing newline: preserved (the body slice carries it verbatim).
 *
 * CONSTRAINTS:
 *   - Top-level keys only. Nested YAML keys (e.g. `lat` inside `coords:`)
 *     cannot be targeted by key name alone — this is by design. All console-
 *     written fields (placeId, highlightForPlace, highlightRank) are top-level.
 *   - Only scalar values (string | number | boolean). Arrays and objects are
 *     not supported and will throw.
 *   - Both functions throw when the input has no valid `---` opening fence
 *     or no closing `---` fence. Partial frontmatter is a corrupt file.
 *
 * Owner: Procyon (α-IDX-03) · CURATION-BUILD-PLAN.md §Procyon lane
 * Consumed by: Altair (lib/server/actions/save-place-highlights.ts)
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Detects the line separator used in the given text.
 * Returns '\r\n' if CRLF is found, '\n' otherwise.
 */
function detectLineEnding(text: string): '\r\n' | '\n' {
  return text.includes('\r\n') ? '\r\n' : '\n'
}

/**
 * Serializes a scalar value to its YAML representation.
 *
 * Rules (per MDX frontmatter convention observed in content/):
 *   - boolean: bare (true / false)
 *   - number:  bare (123 / 3.14)
 *   - string:  double-quoted ("value")
 *
 * Booleans and numbers are NEVER quoted — even if the caller passes a
 * string like "true", it will be emitted double-quoted (so the YAML
 * parser sees it as the string "true", not the boolean true). The caller
 * is responsible for passing the correct JS type.
 */
function serializeValue(value: string | number | boolean): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  // String: double-quoted, escaping inner double quotes
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * Builds the regex that matches a top-level YAML key line.
 *
 * A top-level key line:
 *   - starts at column 0 (no leading whitespace)
 *   - has the exact key name
 *   - followed by `:` then optional space then the value
 *   - ends with optional \r and \n (or end-of-string for last line)
 *
 * Nested keys (e.g. `lat:` inside `coords:`) always have leading
 * whitespace — they will NOT match this regex.
 */
function topLevelKeyPattern(key: string): RegExp {
  // Escape any regex-special chars in the key (keys are typically plain)
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Match the full line: key: <anything> (CRLF or LF or end of string)
  return new RegExp(`^${escapedKey}:[ \\t]*.*(\\r?\\n|$)`, 'm')
}

// ---------------------------------------------------------------------------
// Frontmatter boundary parser
// ---------------------------------------------------------------------------

/**
 * Locates the two `---` fences and returns the split positions.
 *
 * Returns:
 *   openEnd   — index immediately after the first `---` line (incl. its newline)
 *   closeStart — index of the first char of the closing `---` line
 *   closeEnd  — index immediately after the closing `---` line (incl. its newline)
 *               If the closing fence is the last line with no trailing newline,
 *               closeEnd === raw.length.
 *
 * Throws for:
 *   - no opening `---` at position 0
 *   - no closing `---` fence
 */
function parseFrontmatterBounds(raw: string): {
  openEnd: number
  closeStart: number
  closeEnd: number
} {
  // Opening fence must be exactly `---` at the very start (optional \r before \n)
  if (!raw.startsWith('---')) {
    throw new Error(
      'frontmatter-edit: no opening `---` fence found at position 0. ' +
        'The file does not have YAML frontmatter.',
    )
  }

  // Find the end of the first `---` line
  const firstNewline = raw.indexOf('\n')
  if (firstNewline === -1) {
    throw new Error(
      'frontmatter-edit: opening `---` fence has no following newline. ' +
        'File appears to be a single line.',
    )
  }
  const openEnd = firstNewline + 1 // char after the first `\n`

  // Find the closing `---` — a line that is exactly `---` (with optional \r)
  // Search only after the opening fence
  const afterOpen = raw.slice(openEnd)
  // We match `---` at the start of a line (^) in multiline mode
  const closeMatch = /^---[ \t]*(\r?\n|$)/m.exec(afterOpen)
  if (!closeMatch) {
    throw new Error(
      'frontmatter-edit: no closing `---` fence found. ' +
        'The YAML frontmatter block is not terminated.',
    )
  }

  const closeStart = openEnd + closeMatch.index
  const closeEnd = closeStart + closeMatch[0].length

  return { openEnd, closeStart, closeEnd }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Set or replace ONE top-level scalar field in the MDX frontmatter.
 *
 * @param raw   - Full MDX file contents as a string.
 * @param key   - Top-level YAML key to set (e.g. "placeId", "highlightForPlace").
 * @param value - New value. Booleans/numbers serialized bare; strings double-quoted.
 *
 * @returns The full MDX string with exactly one line changed or inserted.
 *          All other bytes are identical to the input.
 *
 * Behaviour:
 *   - If the key already exists with the same serialized value → returns `raw`
 *     unchanged (idempotent).
 *   - If the key exists with a different value → replaces that line in place
 *     (preserves surrounding whitespace/blank lines).
 *   - If the key does not exist → inserts `key: value` as the last line before
 *     the closing `---` fence, using the file's native line ending.
 *
 * Throws when:
 *   - The frontmatter opening or closing fence is absent.
 *   - `value` is not a string, number, or boolean.
 */
export function setFrontmatterField(
  raw: string,
  key: string,
  value: string | number | boolean,
): string {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    throw new TypeError(
      `frontmatter-edit: value must be string | number | boolean, got ${typeof value}`,
    )
  }

  const { openEnd, closeStart, closeEnd } = parseFrontmatterBounds(raw)
  const frontmatter = raw.slice(openEnd, closeStart)
  const body = raw.slice(closeEnd)
  const fence = raw.slice(closeStart, closeEnd) // the closing `---\n` verbatim
  const openFence = raw.slice(0, openEnd) // the opening `---\n` verbatim
  const le = detectLineEnding(raw)

  const serialized = serializeValue(value)
  const newLine = `${key}: ${serialized}`
  const pattern = topLevelKeyPattern(key)

  if (pattern.test(frontmatter)) {
    // Key exists — check idempotency first
    const existingMatch = pattern.exec(frontmatter)!
    // The matched text is the full line including its ending
    const existingLine = existingMatch[0]
    // Strip line ending to compare just the content
    const existingContent = existingLine.replace(/\r?\n$/, '')
    if (existingContent === newLine) {
      // Already identical — return unchanged
      return raw
    }
    // Replace the matched line, preserving its original line ending.
    // Use a replacer function so any '$' in newLine is treated as a literal
    // character, not a special regex replacement pattern.
    const lineEnding = existingLine.endsWith('\r\n') ? '\r\n' : existingLine.endsWith('\n') ? '\n' : ''
    const replacement = `${newLine}${lineEnding}`
    const updatedFrontmatter = frontmatter.replace(pattern, () => replacement)
    return openFence + updatedFrontmatter + fence + body
  } else {
    // Key does not exist — insert as the last line before the closing fence
    // If frontmatter ends with a line ending already, just append; otherwise add one first
    const insertLine = `${newLine}${le}`
    const updatedFrontmatter = frontmatter.endsWith('\n')
      ? frontmatter + insertLine
      : frontmatter + le + insertLine
    return openFence + updatedFrontmatter + fence + body
  }
}

/**
 * Remove ONE top-level scalar field from the MDX frontmatter.
 *
 * @param raw - Full MDX file contents as a string.
 * @param key - Top-level YAML key to remove.
 *
 * @returns The full MDX string with that key's line deleted.
 *          All other bytes are identical to the input.
 *          If the key is not present, returns `raw` unchanged.
 *
 * Throws when:
 *   - The frontmatter opening or closing fence is absent.
 */
export function removeFrontmatterField(raw: string, key: string): string {
  const { openEnd, closeStart, closeEnd } = parseFrontmatterBounds(raw)
  const frontmatter = raw.slice(openEnd, closeStart)
  const body = raw.slice(closeEnd)
  const fence = raw.slice(closeStart, closeEnd)
  const openFence = raw.slice(0, openEnd)

  const pattern = topLevelKeyPattern(key)

  if (!pattern.test(frontmatter)) {
    // Key not present — return unchanged
    return raw
  }

  const updatedFrontmatter = frontmatter.replace(pattern, '')
  return openFence + updatedFrontmatter + fence + body
}

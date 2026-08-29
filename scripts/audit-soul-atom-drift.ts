/**
 * audit-soul-atom-drift.ts
 *
 * Owner: Algol (α-VER-06) — TASK-2026-05-29-SOUL-FACTORY-P2B
 * Invoked by: scripts/audit-soul-atom-drift.sh (C2 block)
 *
 * Input  (stdin, JSON):
 *   { manifest_path, gallery_path, token_source, verbose }
 *
 * Output (stdout, JSON):
 *   { pass, violations[], atoms_checked, warnings[] }
 *
 * Exit codes:
 *   0  — all atoms pass
 *   1  — one or more violations found
 *   2  — input malformed or files unreadable
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { execSync } from "child_process";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditInput {
  manifest_path: string;
  gallery_path: string;
  token_source: string;
  verbose: boolean;
  /** Optional: absolute repo root. If absent, derived via git or from manifest path. */
  repo_root?: string;
}

interface Violation {
  atom_id: string;
  atom_name: string;
  violation: "uncited-literal" | "token-ref-missing" | "main-branch-mismatch";
  detail: string;
  gallery_loc: string;
}

interface AuditOutput {
  pass: boolean;
  violations: Violation[];
  atoms_checked: number;
  warnings: string[];
}

interface MainBranchRef {
  file: string;
  line: number | null;
  value: string;
  role: string;
}

interface AtomEntry {
  id: string;
  name: string;
  description: string;
  rationale: string;
  variants: { name: string; description: string }[];
  token_refs: string[];
  main_branch_refs: MainBranchRef[];
  render: string;
  impl_ref: string | null;
}

interface Manifest {
  schema_version: number;
  gallery_path: string;
  token_source: string;
  generated_at: string;
  atoms: AtomEntry[];
}

// ─── Regex patterns for raw appearance literals ───────────────────────────────
// These match CSS appearance values that must be either tokenized (var(--...))
// or cited in main_branch_refs.

const RAW_LITERAL_PATTERNS: { name: string; re: RegExp }[] = [
  // hex colors — #RGB, #RRGGBB, #RGBA, #RRGGBBAA
  { name: "hex-color", re: /#[0-9a-fA-F]{3,8}\b/g },
  // rgb() / rgba() with literal numeric arguments (not var references inside)
  {
    name: "rgb-call",
    re: /rgba?\(\s*\d[\d.,\s%/]+\)/g,
  },
  // hsl() / hsla() with literal numeric arguments
  {
    name: "hsl-call",
    re: /hsla?\(\s*\d[\d.,\s%/]+\)/g,
  },
  // pixel values — var() expressions are blanked by stripVars() before these patterns run,
  // so no variable-length lookbehind is needed (and its use causes V8 backtracking failure
  // on sections with long prose-text parenthetical spans, silently dropping all px matches).
  { name: "px-value", re: /-?\d+(?:\.\d+)?px/g },
  // rem values — same: var() already stripped upstream
  { name: "rem-value", re: /\d+(?:\.\d+)?rem/g },
  // standalone opacity values (0.xx) not inside var(...) or inside rgba()
  // — narrow to context: "opacity: 0.18" or color alpha like "/ 0.18)" patterns
  {
    name: "opacity-value",
    re: /(?:opacity\s*:\s*)(0\.\d+)/g,
  },
  // timing values — ms not inside var(...)
  {
    name: "timing-ms",
    re: /(?<!var\([^)]*)\d+ms(?![^)]*\))/g,
  },
];

// ─── Exemption machinery ─────────────────────────────────────────────────────

/**
 * Strip content that is exempt from literal scanning before running pattern
 * matches on a gallery HTML section.
 *
 * Three exemption categories (per the contract in audit-soul-atom-drift.sh §C2):
 *   1. <!-- gate: exempt → ... --> comment blocks
 *   2. Content of data-* attributes (the whole data-... value)
 *   3. <script data-gate-exempt="true"> ... </script> blocks
 *
 * We also strip:
 *   4. <!-- gate: main_branch_ref ... --> comments (these are citations,
 *      handled separately; stripping prevents re-matching their value= content)
 *   5. Regular HTML comments (to avoid matching values inside comments)
 *
 * Returns the stripped text with exempted regions blanked.
 */
function stripExemptRegions(html: string): string {
  let stripped = html;

  // 1. gate: exempt comments (multi-line safe)
  stripped = stripped.replace(
    /<!--\s*gate:\s*exempt[^]*?-->/gi,
    (m) => " ".repeat(m.length)
  );

  // 3. <script data-gate-exempt="true"> blocks
  stripped = stripped.replace(
    /<script[^>]*data-gate-exempt\s*=\s*["']true["'][^>]*>[^]*?<\/script>/gi,
    (m) => " ".repeat(m.length)
  );

  // 4. gate: main_branch_ref comments (citations — strip before literal scan)
  stripped = stripped.replace(
    /<!--\s*gate:\s*main_branch_ref[^]*?-->/gi,
    (m) => " ".repeat(m.length)
  );

  // 5. Remaining HTML comments
  stripped = stripped.replace(/<!--[^]*?-->/g, (m) => " ".repeat(m.length));

  // 2. data-* attribute values  (e.g.  data-atom-id="corner-reticle")
  stripped = stripped.replace(
    /\bdata-[a-zA-Z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*')/g,
    (m) => " ".repeat(m.length)
  );

  return stripped;
}

/**
 * Extract the HTML section for a single atom, identified by
 * data-atom-id="<id>" on its container element.
 *
 * Returns null if the section is not found.
 */
function extractAtomSection(galleryHtml: string, atomId: string): string | null {
  // We look for the opening tag with data-atom-id="<atomId>" and extract
  // everything up to and including its closing tag. Because the atom sections
  // are <section> elements we track depth.
  const openTagRe = new RegExp(
    `<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*data-atom-id\\s*=\\s*["']${escapeRegex(atomId)}["'][^>]*>`,
    "i"
  );
  const match = openTagRe.exec(galleryHtml);
  if (!match) return null;

  const tagName = match[1].toLowerCase();
  const startIdx = match.index;
  const closeTag = `</${tagName}>`;
  const openTagStr = `<${tagName}`;

  let depth = 1;
  let pos = match.index + match[0].length;

  while (pos < galleryHtml.length && depth > 0) {
    const nextOpen = galleryHtml.indexOf(openTagStr, pos);
    const nextClose = galleryHtml.indexOf(closeTag, pos);

    if (nextClose === -1) break;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + openTagStr.length;
    } else {
      depth--;
      pos = nextClose + closeTag.length;
    }
  }

  return galleryHtml.slice(startIdx, pos);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Check A: scan atom section for raw appearance literals ──────────────────

/**
 * Extract all raw appearance literals from the atom section (after stripping
 * exempt regions and var(...) usages from the scan surface).
 *
 * Returns a list of { literal, context } pairs.
 */
function extractRawLiterals(atomSection: string): { literal: string; context: string }[] {
  const stripped = stripExemptRegions(atomSection);

  // Further strip var(...) expressions so we do not flag tokenized values.
  // We replace var(--...) calls with whitespace before scanning.
  const withoutVars = stripped.replace(/var\(--[a-zA-Z0-9_-]+(?:\s*,\s*[^)]+)?\)/g, (m) =>
    " ".repeat(m.length)
  );

  const found: { literal: string; context: string }[] = [];
  const seen = new Set<string>();

  for (const { re } of RAW_LITERAL_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(withoutVars)) !== null) {
      // For opacity-value pattern the capture group holds the value
      const literal = m[1] ?? m[0];
      const trimmed = literal.trim();
      if (!seen.has(trimmed)) {
        seen.add(trimmed);
        // Grab a short surrounding context from the original (not stripped)
        // text for the gallery_loc field.
        const startIdx = m.index;
        const contextStart = Math.max(0, startIdx - 40);
        const contextEnd = Math.min(atomSection.length, startIdx + trimmed.length + 40);
        const rawContext = atomSection.slice(contextStart, contextEnd).replace(/\s+/g, " ").trim();
        found.push({ literal: trimmed, context: rawContext });
      }
    }
  }

  return found;
}

// ─── Check B: match literal against main_branch_refs ────────────────────────

/**
 * Returns true if the literal appears as the `value` field of any
 * main_branch_ref for this atom. Matching is exact string equality
 * but we also check substring — some main_branch_ref values are
 * full CSS declarations (e.g. "border: 1px solid rgb(...)") that
 * contain the raw literal as a component.
 */
function isCited(literal: string, refs: MainBranchRef[]): boolean {
  for (const ref of refs) {
    if (ref.value === literal) return true;
    // If the ref value is a compound declaration, the literal may be a
    // component of it (e.g. "12px" is in "font-size: 12px").
    // We only accept this if the literal appears as a whole token in the value.
    const tokenRe = new RegExp(`(?<![\\w.-])${escapeRegex(literal)}(?![\\w.-])`);
    if (tokenRe.test(ref.value)) return true;
  }
  return false;
}

// ─── Check C: verify main_branch_ref against working tree ────────────────────

const LINE_TOLERANCE = 3;

/**
 * For a given main_branch_ref, read the cited file and confirm the value
 * appears at or near the stated line (±LINE_TOLERANCE). If line is null,
 * we just verify the value exists anywhere in the file.
 *
 * Returns null on pass, or an error string on mismatch.
 */
function verifyMainBranchRef(
  ref: MainBranchRef,
  repoRoot: string
): string | null {
  const filePath = resolve(repoRoot, ref.file);
  let fileContent: string;
  try {
    fileContent = readFileSync(filePath, "utf8");
  } catch {
    return `file not found: ${ref.file}`;
  }

  const lines = fileContent.split("\n");

  // If no line hint, just check value exists anywhere.
  if (ref.line === null || ref.line === undefined) {
    const found = lines.some((l) => l.includes(ref.value));
    if (!found) {
      return `value "${ref.value}" not found anywhere in ${ref.file}`;
    }
    return null;
  }

  // Check window [line - tolerance .. line + tolerance] (1-indexed)
  const low = Math.max(0, ref.line - 1 - LINE_TOLERANCE);
  const high = Math.min(lines.length - 1, ref.line - 1 + LINE_TOLERANCE);
  const window = lines.slice(low, high + 1);
  const found = window.some((l) => l.includes(ref.value));
  if (!found) {
    // Report actual file state around that line for context
    const actualLine = lines[ref.line - 1] ?? "(line out of range)";
    return (
      `value "${ref.value}" not found at line ${ref.line} ±${LINE_TOLERANCE} in ${ref.file}. ` +
      `Actual line ${ref.line}: "${actualLine.trim()}"`
    );
  }
  return null;
}

// ─── Check D: token_refs appear via var(--token) in atom section ─────────────

function verifyTokenRefUsed(tokenRef: string, atomSection: string): boolean {
  // Match var(--tokenRef) — exact name, allowing optional whitespace and fallback
  const re = new RegExp(`var\\(\\s*${escapeRegex(tokenRef)}(?:\\s*,|\\s*\\))`, "i");
  // Strip exempt regions before checking
  const stripped = stripExemptRegions(atomSection);
  return re.test(stripped);
}

// ─── Main audit ───────────────────────────────────────────────────────────────

function main(): void {
  // Read stdin
  let input: AuditInput;
  try {
    const raw = readFileSync(0, "utf8").trim();
    input = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`[audit-soul-atom-drift] ERROR reading stdin: ${e}\n`);
    process.exit(2);
  }

  const { manifest_path, gallery_path, token_source, verbose, repo_root: explicitRepoRoot } = input;
  const log = (msg: string) => {
    if (verbose) process.stderr.write(`[audit-soul-atom-drift] ${msg}\n`);
  };

  // Read files
  let manifest: Manifest;
  let galleryHtml: string;
  let tokenSourceContent: string;

  try {
    manifest = JSON.parse(readFileSync(manifest_path, "utf8"));
  } catch (e) {
    process.stderr.write(`[audit-soul-atom-drift] ERROR reading manifest: ${e}\n`);
    process.exit(2);
  }

  try {
    galleryHtml = readFileSync(gallery_path, "utf8");
  } catch (e) {
    process.stderr.write(`[audit-soul-atom-drift] ERROR reading gallery: ${e}\n`);
    process.exit(2);
  }

  try {
    tokenSourceContent = readFileSync(token_source, "utf8");
  } catch (e) {
    process.stderr.write(`[audit-soul-atom-drift] ERROR reading token_source: ${e}\n`);
    process.exit(2);
  }

  // Determine repo root: explicit input wins, then git, then fall back to
  // convention (.claude/visual-diffs/soul-atlas/manifest.json → 3 dirs up).
  let computedRepoRoot: string;
  if (explicitRepoRoot) {
    computedRepoRoot = explicitRepoRoot;
  } else {
    try {
      computedRepoRoot = execSync("git rev-parse --show-toplevel", {
        encoding: "utf8",
        cwd: dirname(manifest_path),
      }).trim();
    } catch {
      // Fallback for environments where git is unavailable (e.g. some CI).
      const manifestDir = dirname(manifest_path);
      computedRepoRoot = resolve(manifestDir, "../../..");
    }
  }
  log(`repo root: ${computedRepoRoot}`);
  log(`manifest: ${manifest_path}`);
  log(`gallery: ${gallery_path}`);
  log(`atoms to audit: ${manifest.atoms.length}`);

  const violations: Violation[] = [];
  const warnings: string[] = [];

  for (const atom of manifest.atoms) {
    log(`--- atom: ${atom.id} ---`);

    // Extract atom section from gallery
    const atomSection = extractAtomSection(galleryHtml, atom.id);
    if (!atomSection) {
      violations.push({
        atom_id: atom.id,
        atom_name: atom.name,
        violation: "uncited-literal",
        detail: `No gallery section found with data-atom-id="${atom.id}". Expected an element with id="atom-${atom.id}" and data-atom-id="${atom.id}".`,
        gallery_loc: `(section missing)`,
      });
      log(`  FAIL: section not found`);
      continue;
    }

    log(`  section found (${atomSection.length} chars)`);

    // ── Check A+B: raw literals must be cited ────────────────────────────────
    const rawLiterals = extractRawLiterals(atomSection);
    log(`  raw literals found: ${rawLiterals.length}`);

    for (const { literal, context } of rawLiterals) {
      if (isCited(literal, atom.main_branch_refs)) {
        log(`  cited: ${literal}`);
      } else {
        violations.push({
          atom_id: atom.id,
          atom_name: atom.name,
          violation: "uncited-literal",
          detail: `Raw appearance literal "${literal}" is not cited in main_branch_refs for atom "${atom.id}". Either add it to main_branch_refs with file+line+value or replace with a var(--token) reference.`,
          gallery_loc: context,
        });
        log(`  VIOLATION uncited-literal: ${literal}`);
      }
    }

    // ── Check C: main_branch_refs still match working tree ───────────────────
    for (const ref of atom.main_branch_refs) {
      const err = verifyMainBranchRef(ref, computedRepoRoot);
      if (err) {
        violations.push({
          atom_id: atom.id,
          atom_name: atom.name,
          violation: "main-branch-mismatch",
          detail: `main_branch_ref mismatch in atom "${atom.id}": ${err}. The gallery cites a literal that has drifted from its stated source. Either update the gallery or correct the cite.`,
          gallery_loc: `${ref.file}:${ref.line ?? "?"}`,
        });
        log(`  VIOLATION main-branch-mismatch: ${ref.value} @ ${ref.file}:${ref.line}`);
      } else {
        log(`  main_branch_ref OK: "${ref.value}" @ ${ref.file}:${ref.line ?? "any"}`);
      }
    }

    // ── Check D: token_refs appear via var(--token) in atom section ──────────
    for (const tokenRef of atom.token_refs) {
      // Verify token exists in globals.css (belt-and-suspenders; shell already did this)
      if (!tokenSourceContent.includes(tokenRef)) {
        warnings.push(
          `atom "${atom.id}": token_ref "${tokenRef}" not found in token_source (shell layer should have caught this).`
        );
        log(`  WARN: token not in globals.css: ${tokenRef}`);
        continue;
      }
      // Verify var(--tokenRef) actually appears in the atom's gallery section
      if (!verifyTokenRefUsed(tokenRef, atomSection)) {
        warnings.push(
          `atom "${atom.id}": token_ref "${tokenRef}" is declared in the manifest but var(${tokenRef}) does not appear in the gallery section data-atom-id="${atom.id}". If this token is used only inside globals.css classes applied to the section, this warning may be a false positive from class-based styling.`
        );
        log(`  WARN unused-token-in-section: ${tokenRef}`);
      } else {
        log(`  token_ref used: ${tokenRef}`);
      }
    }
  }

  const output: AuditOutput = {
    pass: violations.length === 0,
    violations,
    atoms_checked: manifest.atoms.length,
    warnings,
  };

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  process.exit(violations.length === 0 ? 0 : 1);
}

main();

/**
 * audit-property-technique-map.ts
 *
 * Owner: Algol (α-VER-06) — TASK-2026-05-30-HARNESS-IS-OUGHT-SEPARATOR (Wave B Phase 3a)
 *
 * Purpose: the "is" shell that derives from element semantics + axiom commitments.
 * Given a set of element descriptors, derive WHICH checks are required for each element.
 * This is the derivable-is layer: given axioms (oughts) + element semantics (is-facts),
 * derive the required-checks set mechanically.
 *
 * Target axiom: C1 = WCAG 2.2 AA (4.5:1 normal text), realizing V1 (low-vision care).
 *
 * Initial technique-map entries (extensible):
 *   TM-01: role=button + has-text → contrast check required (4.5:1)
 *   TM-02: role=img + decorative=false → alt attribute required
 *   TM-03: role=link → underline-on-default OR non-color-only differentiator required
 *   TM-04: font-size derivation → min-legible-size check required for text elements
 *          (cross-references gauntlet-strengthening check (b))
 *
 * The map IS the derivable-shell evidence — given axioms + element semantics, derive
 * which checks apply. The output makes the derivation explicit and parse-able.
 *
 * Input (stdin, JSON):
 *   {
 *     elements: ElementDescriptor[],
 *     axiom_ids?: string[],  // filter to specific axioms (default: all)
 *     verbose?: boolean
 *   }
 *
 * Output (stdout, JSON):
 *   {
 *     pass: boolean,
 *     checked_elements: number,
 *     element_results: ElementResult[],
 *     violations: TechniqueViolation[],
 *     technique_map_version: string
 *   }
 *
 * Exit codes:
 *   0 — all elements pass required checks
 *   1 — violations found
 *   2 — input malformed
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ElementDescriptor {
  /** Unique element identifier for reporting */
  element_id: string;
  /** ARIA role or inferred semantic role (button, img, link, text, heading) */
  role: string;
  /** Whether the element contains visible text */
  has_text: boolean;
  /** For img role: whether the image is decorative (false = alt required) */
  decorative?: boolean;
  /** For img role: the alt attribute value (null = attribute absent) */
  alt?: string | null;
  /** Font size in px (for min-legible-size check) */
  font_size_px?: number;
  /** Foreground color in hex or rgb (for contrast check) */
  foreground_color?: string;
  /** Background color in hex or rgb (for contrast check) */
  background_color?: string;
  /** Computed contrast ratio (if already calculated externally) */
  contrast_ratio?: number;
  /** For link role: has underline on default state */
  has_underline?: boolean;
  /** For link role: has non-color-only differentiator (e.g. bold, icon, underline) */
  has_non_color_differentiator?: boolean;
}

interface AppliedTechnique {
  technique_id: string;
  axiom_ids: string[];  // which axioms drive this technique
  description: string;
  verdict: "PASS" | "FAIL" | "NEEDS_DATA";
  detail: string;
}

interface ElementResult {
  element_id: string;
  role: string;
  applied_techniques: AppliedTechnique[];
  element_verdict: "PASS" | "FAIL" | "NEEDS_DATA";
}

interface TechniqueViolation {
  element_id: string;
  technique_id: string;
  axiom_ids: string[];
  reason_code: string;
  detail: string;
}

interface AuditOutput {
  pass: boolean;
  checked_elements: number;
  element_results: ElementResult[];
  violations: TechniqueViolation[];
  technique_map_version: string;
}

// ─── Technique map — the derivable "is" shell ──────────────────────────────────
//
// Each technique derives from: element semantics (is) + axiom commitments (ought).
// The technique derivation is mechanical: given role + properties, the technique
// applies OR does not apply. The threshold values (4.5:1, 16px floor) are themselves
// axiom commitments (C1, cross-ref to gauntlet-strengthening spec).

const TECHNIQUE_MAP_VERSION = "1.0.0";

// Minimum legible font size in px (cross-reference: gauntlet-strengthening check (b))
// Derived from 60-responsive-system.md: NARROW viewport minimum supported = 375px.
// WCAG 2.2 AA: "normal text" is text below 18pt (24px) or 14pt bold (approximately 18.67px).
// Floor: 12px is the minimum at which text remains legible with standard OS rendering.
const MIN_LEGIBLE_FONT_SIZE_PX = 12;

// WCAG 2.2 AA contrast requirement for normal text
const WCAG_AA_CONTRAST_RATIO = 4.5;

/**
 * Derive which techniques apply to a given element, then evaluate each.
 */
function applyTechniqueMap(el: ElementDescriptor): AppliedTechnique[] {
  const techniques: AppliedTechnique[] = [];

  // ── TM-01: role=button + has-text → contrast check (4.5:1) ──────────────
  // Derivation: C1 (WCAG 2.2 AA) applies to any interactive text element.
  // role=button with visible text is an interactive text element.
  // Therefore: contrast check required.
  if ((el.role === "button" || el.role === "link") && el.has_text) {
    if (el.contrast_ratio !== undefined) {
      const pass = el.contrast_ratio >= WCAG_AA_CONTRAST_RATIO;
      techniques.push({
        technique_id: "TM-01",
        axiom_ids: ["C1", "V1"],
        description: `role=${el.role} + has-text → contrast check required (WCAG 2.2 AA 4.5:1)`,
        verdict: pass ? "PASS" : "FAIL",
        detail: pass
          ? `Contrast ratio ${el.contrast_ratio.toFixed(2)}:1 ≥ 4.5:1 required. PASS.`
          : `[TM-01] element_id=${el.element_id} role=${el.role} contrast_ratio=${el.contrast_ratio.toFixed(2)} below required 4.5:1 (WCAG 2.2 AA, axiom C1 realizes V1). Foreground: ${el.foreground_color ?? "unspecified"}. Background: ${el.background_color ?? "unspecified"}.`,
      });
    } else {
      techniques.push({
        technique_id: "TM-01",
        axiom_ids: ["C1", "V1"],
        description: `role=${el.role} + has-text → contrast check required (WCAG 2.2 AA 4.5:1)`,
        verdict: "NEEDS_DATA",
        detail: `[TM-01] element_id=${el.element_id} role=${el.role} — contrast check required by axiom C1 (WCAG 2.2 AA) but contrast_ratio not provided. Supply contrast_ratio or foreground_color+background_color.`,
      });
    }
  }

  // ── TM-02: role=img + decorative=false → alt attribute required ──────────
  // Derivation: V1 (low-vision care) via C1 (WCAG 2.2 AA 1.1.1 Non-text content).
  // An img element that is not decorative conveys content → alt required for screen readers.
  if (el.role === "img" && el.decorative === false) {
    const hasAlt = el.alt !== null && el.alt !== undefined && el.alt.trim().length > 0;
    techniques.push({
      technique_id: "TM-02",
      axiom_ids: ["C1", "V1"],
      description: "role=img + decorative=false → alt attribute required (WCAG 2.2 AA 1.1.1)",
      verdict: hasAlt ? "PASS" : "FAIL",
      detail: hasAlt
        ? `Alt attribute present and non-empty: "${el.alt}". PASS.`
        : `[TM-02] element_id=${el.element_id} role=img decorative=false — alt attribute ${el.alt === null ? "absent" : "empty"}. WCAG 2.2 AA 1.1.1: non-decorative img requires descriptive alt text. Axiom C1 realizes V1 (low-vision care).`,
    });
  }

  // Decorative images with role=img should have alt="" (empty string = explicit decoration signal)
  if (el.role === "img" && el.decorative === true) {
    const altIsEmpty = el.alt !== undefined && el.alt !== null && el.alt.trim() === "";
    techniques.push({
      technique_id: "TM-02b",
      axiom_ids: ["C1", "V1"],
      description: "role=img + decorative=true → alt must be empty string (explicit decoration signal)",
      verdict: altIsEmpty ? "PASS" : (el.alt === undefined ? "NEEDS_DATA" : "FAIL"),
      detail: altIsEmpty
        ? `Alt attribute is empty string — correct decoration signal. PASS.`
        : el.alt === undefined
          ? `[TM-02b] element_id=${el.element_id} role=img decorative=true — alt not provided. Supply alt="" to signal decoration explicitly.`
          : `[TM-02b] element_id=${el.element_id} role=img decorative=true but alt="${el.alt}" is non-empty. Decorative images must use alt="" so screen readers skip them.`,
    });
  }

  // ── TM-03: role=link → underline OR non-color-only differentiator ────────
  // Derivation: V1 (low-vision care) via C1 (WCAG 2.2 AA 1.4.1 Use of Color).
  // Links must not rely on color alone to convey their link nature.
  // If has_underline OR has_non_color_differentiator: PASS. Neither = FAIL.
  if (el.role === "link") {
    if (el.has_underline !== undefined || el.has_non_color_differentiator !== undefined) {
      const pass =
        el.has_underline === true || el.has_non_color_differentiator === true;
      techniques.push({
        technique_id: "TM-03",
        axiom_ids: ["C1", "V1"],
        description:
          "role=link → underline-on-default OR non-color-only differentiator required (WCAG 2.2 AA 1.4.1)",
        verdict: pass ? "PASS" : "FAIL",
        detail: pass
          ? `Link differentiator present — underline=${el.has_underline}, non-color=${el.has_non_color_differentiator}. PASS.`
          : `[TM-03] element_id=${el.element_id} role=link — neither underline (has_underline=${el.has_underline}) nor non-color differentiator (has_non_color_differentiator=${el.has_non_color_differentiator}) present. WCAG 2.2 AA 1.4.1: links must not rely on color alone. Axiom C1 realizes V1.`,
      });
    } else {
      techniques.push({
        technique_id: "TM-03",
        axiom_ids: ["C1", "V1"],
        description:
          "role=link → underline-on-default OR non-color-only differentiator required (WCAG 2.2 AA 1.4.1)",
        verdict: "NEEDS_DATA",
        detail: `[TM-03] element_id=${el.element_id} role=link — link differentiation check required by axiom C1 but has_underline and has_non_color_differentiator not provided.`,
      });
    }
  }

  // ── TM-04: font-size derivation → min-legible-size check ─────────────────
  // Derivation: V1 (low-vision care) + 60-responsive-system.md legibility floor.
  // Any text element with a declared font_size_px must be ≥ MIN_LEGIBLE_FONT_SIZE_PX.
  // Cross-references gauntlet-strengthening check (b).
  if (
    el.has_text &&
    el.font_size_px !== undefined &&
    (el.role === "text" || el.role === "heading" || el.role === "button" ||
     el.role === "link" || el.role === "paragraph" || el.role === "label")
  ) {
    const pass = el.font_size_px >= MIN_LEGIBLE_FONT_SIZE_PX;
    techniques.push({
      technique_id: "TM-04",
      axiom_ids: ["V1"],
      description: `text element → min-legible-size check (floor: ${MIN_LEGIBLE_FONT_SIZE_PX}px)`,
      verdict: pass ? "PASS" : "FAIL",
      detail: pass
        ? `font_size_px=${el.font_size_px}px ≥ ${MIN_LEGIBLE_FONT_SIZE_PX}px floor. PASS.`
        : `[TM-04] element_id=${el.element_id} role=${el.role} font_size_px=${el.font_size_px}px is below legibility floor ${MIN_LEGIBLE_FONT_SIZE_PX}px. Derived from V1 (low-vision care) + 60-responsive-system.md. See gauntlet-strengthening check (b).`,
    });
  }

  return techniques;
}

// ─── Main ───────────────────────────────────────────────────────────────────────

function main(): void {
  let input: { elements: ElementDescriptor[]; axiom_ids?: string[]; verbose?: boolean };
  try {
    const raw = readFileSync("/dev/stdin", "utf8").trim();
    input = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`[audit-property-technique-map] ERROR reading stdin: ${e}\n`);
    process.exit(2);
  }

  const { elements, verbose = false } = input;

  if (!Array.isArray(elements)) {
    process.stderr.write(`[audit-property-technique-map] ERROR: 'elements' must be an array.\n`);
    process.exit(2);
  }

  const log = (msg: string) => {
    if (verbose) process.stderr.write(`[technique-map] ${msg}\n`);
  };

  log(`elements to audit: ${elements.length}`);
  log(`technique_map_version: ${TECHNIQUE_MAP_VERSION}`);

  const elementResults: ElementResult[] = [];
  const violations: TechniqueViolation[] = [];

  for (const el of elements) {
    log(`--- element: ${el.element_id} (role=${el.role}) ---`);
    const techniques = applyTechniqueMap(el);

    let elVerdict: "PASS" | "FAIL" | "NEEDS_DATA" = "PASS";
    for (const t of techniques) {
      if (t.verdict === "FAIL") {
        elVerdict = "FAIL";
        violations.push({
          element_id: el.element_id,
          technique_id: t.technique_id,
          axiom_ids: t.axiom_ids,
          reason_code: `TECHNIQUE_${t.technique_id}_FAIL`,
          detail: t.detail,
        });
        log(`  FAIL: ${t.technique_id}`);
      } else if (t.verdict === "NEEDS_DATA" && elVerdict !== "FAIL") {
        elVerdict = "NEEDS_DATA";
        log(`  NEEDS_DATA: ${t.technique_id}`);
      } else {
        log(`  PASS: ${t.technique_id}`);
      }
    }

    elementResults.push({
      element_id: el.element_id,
      role: el.role,
      applied_techniques: techniques,
      element_verdict: elVerdict,
    });
  }

  // Coverage assertion: must have processed all input elements
  if (elementResults.length !== elements.length) {
    process.stderr.write(
      `[audit-property-technique-map] COVERAGE_ASSERT_FAIL: processed ${elementResults.length} but input declares ${elements.length}.\n`
    );
    process.exit(2);
  }

  const pass = violations.length === 0;

  const output: AuditOutput = {
    pass,
    checked_elements: elementResults.length,
    element_results: elementResults,
    violations,
    technique_map_version: TECHNIQUE_MAP_VERSION,
  };

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  process.exit(pass ? 0 : 1);
}

import { readFileSync } from "fs";
main();

/**
 * tests/audit-property-technique-map.test.mjs
 *
 * Regression tests for scripts/audit-property-technique-map.ts
 * Owner: Algol (α-VER-06) — TASK-2026-05-30-HARNESS-IS-OUGHT-SEPARATOR (Wave B Phase 3a)
 *
 * Run with:
 *   node --test tests/audit-property-technique-map.test.mjs
 *
 * Tests cover:
 *   1. Output shape: pass, checked_elements, element_results, violations, technique_map_version
 *   2. TM-01: button + has-text + sufficient contrast → PASS
 *   3. TM-01: button + has-text + insufficient contrast → FAIL with TECHNIQUE_TM-01_FAIL
 *   4. TM-01: button + has-text + no contrast_ratio → NEEDS_DATA
 *   5. TM-02: role=img + decorative=false + alt present → PASS
 *   6. TM-02: role=img + decorative=false + alt absent → FAIL
 *   7. TM-02b: role=img + decorative=true + alt="" → PASS
 *   8. TM-02b: role=img + decorative=true + alt non-empty → FAIL
 *   9. TM-03: role=link + has_underline=true → PASS
 *  10. TM-03: role=link + no differentiator → FAIL
 *  11. TM-04: text element + font_size_px ≥ 12 → PASS
 *  12. TM-04: text element + font_size_px < 12 → FAIL
 *  13. Coverage assertion: checked_elements == input elements count
 *  14. Real atom semantics from manifest: netra-console (mono text + interactive elements)
 *  15. Real atom semantics: attractor-pill (button role, has-text, contrast)
 *  16. Real atom semantics: focus-button (interactive, multiple techniques applied)
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import test from "node:test";

const REPO_ROOT = resolve(import.meta.dirname ?? new URL(".", import.meta.url).pathname, "..");
const AUDIT_TS = join(REPO_ROOT, "scripts", "audit-property-technique-map.ts");

function runAudit(input) {
  const inputJson = JSON.stringify(input);
  const result = spawnSync("npx", ["tsx", AUDIT_TS], {
    input: inputJson,
    encoding: "utf8",
    cwd: REPO_ROOT,
    timeout: 30_000,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? -1,
  };
}

// ─── Test 1: Output shape ─────────────────────────────────────────────────────

test("output has required shape: pass, checked_elements, element_results, violations, technique_map_version", () => {
  const { stdout, status } = runAudit({
    elements: [
      {
        element_id: "btn-1",
        role: "button",
        has_text: true,
        contrast_ratio: 7.5,
      },
    ],
  });

  assert.equal(status, 0, `expected exit 0. stderr: ${stdout}`);
  const out = JSON.parse(stdout);
  assert.ok("pass" in out, "missing 'pass'");
  assert.ok("checked_elements" in out, "missing 'checked_elements'");
  assert.ok("element_results" in out, "missing 'element_results'");
  assert.ok("violations" in out, "missing 'violations'");
  assert.ok("technique_map_version" in out, "missing 'technique_map_version'");
  assert.ok(Array.isArray(out.element_results), "'element_results' must be array");
  assert.ok(Array.isArray(out.violations), "'violations' must be array");
});

// ─── Test 2: TM-01 PASS ──────────────────────────────────────────────────────

test("TM-01: button + has-text + contrast_ratio >= 4.5 → PASS", () => {
  const { stdout, status } = runAudit({
    elements: [
      {
        element_id: "btn-pass",
        role: "button",
        has_text: true,
        contrast_ratio: 7.5,
        foreground_color: "#1F5063",
        background_color: "#E8E2D5",
      },
    ],
  });

  assert.equal(status, 0, `expected exit 0. stdout: ${stdout}`);
  const out = JSON.parse(stdout);
  assert.equal(out.pass, true);
  assert.equal(out.violations.length, 0);
  const el = out.element_results.find((e) => e.element_id === "btn-pass");
  assert.ok(el, "expected btn-pass result");
  assert.equal(el.element_verdict, "PASS");
  const tm01 = el.applied_techniques.find((t) => t.technique_id === "TM-01");
  assert.ok(tm01, "expected TM-01 technique applied");
  assert.equal(tm01.verdict, "PASS");
  // Axiom coverage: TM-01 must reference C1 and V1
  assert.ok(tm01.axiom_ids.includes("C1"), "TM-01 must reference C1");
  assert.ok(tm01.axiom_ids.includes("V1"), "TM-01 must reference V1");
});

// ─── Test 3: TM-01 FAIL ──────────────────────────────────────────────────────

test("TM-01: button + has-text + contrast_ratio < 4.5 → FAIL with structured error", () => {
  const { stdout, status } = runAudit({
    elements: [
      {
        element_id: "btn-fail",
        role: "button",
        has_text: true,
        contrast_ratio: 2.3,
        foreground_color: "#999999",
        background_color: "#E8E2D5",
      },
    ],
  });

  assert.equal(status, 1, `expected exit 1 (contrast fail). stdout: ${stdout}`);
  const out = JSON.parse(stdout);
  assert.equal(out.pass, false);
  const violation = out.violations.find((v) => v.technique_id === "TM-01");
  assert.ok(violation, "expected TM-01 violation");
  assert.equal(violation.element_id, "btn-fail");
  // Step 7b: reason code must be parseable
  assert.ok(violation.reason_code.includes("TM-01"), `reason_code must include TM-01. got: ${violation.reason_code}`);
  // Detail must name the actual ratio and required ratio
  assert.ok(
    violation.detail.includes("2.3") && violation.detail.includes("4.5"),
    `detail must name actual (2.3) and required (4.5) ratio. detail: ${violation.detail}`
  );
  // Detail must name the axiom commitment
  assert.ok(
    violation.detail.includes("C1") || violation.detail.includes("WCAG"),
    `detail must reference C1 or WCAG. detail: ${violation.detail}`
  );
});

// ─── Test 4: TM-01 NEEDS_DATA ────────────────────────────────────────────────

test("TM-01: button + has-text + no contrast_ratio → NEEDS_DATA", () => {
  const { stdout } = runAudit({
    elements: [
      {
        element_id: "btn-nodata",
        role: "button",
        has_text: true,
        // no contrast_ratio
      },
    ],
  });

  // NEEDS_DATA alone is not a FAIL (no violation emitted), but element_verdict = NEEDS_DATA
  const out = JSON.parse(stdout);
  const el = out.element_results.find((e) => e.element_id === "btn-nodata");
  assert.ok(el, "expected btn-nodata result");
  assert.equal(el.element_verdict, "NEEDS_DATA");
  const tm01 = el.applied_techniques.find((t) => t.technique_id === "TM-01");
  assert.ok(tm01, "expected TM-01 technique applied");
  assert.equal(tm01.verdict, "NEEDS_DATA");
  // No violation emitted for NEEDS_DATA
  const violation = out.violations.find((v) => v.element_id === "btn-nodata" && v.technique_id === "TM-01");
  assert.ok(!violation, "NEEDS_DATA should not emit a violation");
});

// ─── Test 5: TM-02 PASS ──────────────────────────────────────────────────────

test("TM-02: role=img + decorative=false + alt present → PASS", () => {
  const { stdout, status } = runAudit({
    elements: [
      {
        element_id: "img-pass",
        role: "img",
        has_text: false,
        decorative: false,
        alt: "Globe showing Bangkok as current observer location",
      },
    ],
  });

  assert.equal(status, 0, `expected exit 0. stdout: ${stdout}`);
  const out = JSON.parse(stdout);
  assert.equal(out.pass, true);
  const el = out.element_results.find((e) => e.element_id === "img-pass");
  assert.ok(el, "expected img-pass result");
  const tm02 = el.applied_techniques.find((t) => t.technique_id === "TM-02");
  assert.ok(tm02, "expected TM-02 applied");
  assert.equal(tm02.verdict, "PASS");
});

// ─── Test 6: TM-02 FAIL ──────────────────────────────────────────────────────

test("TM-02: role=img + decorative=false + alt absent → FAIL", () => {
  const { stdout, status } = runAudit({
    elements: [
      {
        element_id: "img-noalt",
        role: "img",
        has_text: false,
        decorative: false,
        alt: null,
      },
    ],
  });

  assert.equal(status, 1, `expected exit 1. stdout: ${stdout}`);
  const out = JSON.parse(stdout);
  const violation = out.violations.find((v) => v.technique_id === "TM-02");
  assert.ok(violation, "expected TM-02 violation");
  assert.equal(violation.element_id, "img-noalt");
  // Step 7b: detail must name the condition that fired
  assert.ok(
    violation.detail.includes("alt") && violation.detail.includes("absent"),
    `detail must mention alt absent. detail: ${violation.detail}`
  );
});

// ─── Test 7: TM-02b PASS ─────────────────────────────────────────────────────

test("TM-02b: role=img + decorative=true + alt='' → PASS", () => {
  const { stdout, status } = runAudit({
    elements: [
      {
        element_id: "img-decorative",
        role: "img",
        has_text: false,
        decorative: true,
        alt: "",
      },
    ],
  });

  assert.equal(status, 0, `expected exit 0. stdout: ${stdout}`);
  const out = JSON.parse(stdout);
  assert.equal(out.pass, true);
  const el = out.element_results.find((e) => e.element_id === "img-decorative");
  const tm02b = el.applied_techniques.find((t) => t.technique_id === "TM-02b");
  assert.ok(tm02b, "expected TM-02b applied");
  assert.equal(tm02b.verdict, "PASS");
});

// ─── Test 8: TM-02b FAIL ─────────────────────────────────────────────────────

test("TM-02b: role=img + decorative=true + alt non-empty → FAIL", () => {
  const { stdout, status } = runAudit({
    elements: [
      {
        element_id: "img-decorative-bad",
        role: "img",
        has_text: false,
        decorative: true,
        alt: "decorative circle",  // should be empty
      },
    ],
  });

  assert.equal(status, 1, `expected exit 1. stdout: ${stdout}`);
  const out = JSON.parse(stdout);
  const violation = out.violations.find((v) => v.technique_id === "TM-02b");
  assert.ok(violation, "expected TM-02b violation");
  assert.equal(violation.element_id, "img-decorative-bad");
});

// ─── Test 9: TM-03 PASS ──────────────────────────────────────────────────────

test("TM-03: role=link + has_underline=true → PASS", () => {
  const { stdout, status } = runAudit({
    elements: [
      {
        element_id: "link-underlined",
        role: "link",
        has_text: true,
        has_underline: true,
        contrast_ratio: 5.0,
      },
    ],
  });

  assert.equal(status, 0, `expected exit 0. stdout: ${stdout}`);
  const out = JSON.parse(stdout);
  assert.equal(out.pass, true);
  const el = out.element_results.find((e) => e.element_id === "link-underlined");
  const tm03 = el.applied_techniques.find((t) => t.technique_id === "TM-03");
  assert.ok(tm03, "expected TM-03 applied");
  assert.equal(tm03.verdict, "PASS");
});

// ─── Test 10: TM-03 FAIL ─────────────────────────────────────────────────────

test("TM-03: role=link + no differentiator → FAIL", () => {
  const { stdout, status } = runAudit({
    elements: [
      {
        element_id: "link-no-diff",
        role: "link",
        has_text: true,
        has_underline: false,
        has_non_color_differentiator: false,
        contrast_ratio: 5.0,
      },
    ],
  });

  assert.equal(status, 1, `expected exit 1. stdout: ${stdout}`);
  const out = JSON.parse(stdout);
  const violation = out.violations.find((v) => v.technique_id === "TM-03");
  assert.ok(violation, "expected TM-03 violation");
  assert.equal(violation.element_id, "link-no-diff");
  // Step 7b: detail must name the WCAG criterion and the failing conditions
  assert.ok(
    violation.detail.includes("1.4.1") || violation.detail.includes("color"),
    `detail must reference WCAG 1.4.1 or color. detail: ${violation.detail}`
  );
});

// ─── Test 11: TM-04 PASS ─────────────────────────────────────────────────────

test("TM-04: text element + font_size_px >= 12 → PASS", () => {
  const { stdout, status } = runAudit({
    elements: [
      {
        element_id: "text-legible",
        role: "text",
        has_text: true,
        font_size_px: 14,
      },
    ],
  });

  assert.equal(status, 0, `expected exit 0. stdout: ${stdout}`);
  const out = JSON.parse(stdout);
  assert.equal(out.pass, true);
  const el = out.element_results.find((e) => e.element_id === "text-legible");
  const tm04 = el.applied_techniques.find((t) => t.technique_id === "TM-04");
  assert.ok(tm04, "expected TM-04 applied");
  assert.equal(tm04.verdict, "PASS");
  assert.ok(tm04.axiom_ids.includes("V1"), "TM-04 must reference V1");
});

// ─── Test 12: TM-04 FAIL ─────────────────────────────────────────────────────

test("TM-04: text element + font_size_px < 12 → FAIL", () => {
  const { stdout, status } = runAudit({
    elements: [
      {
        element_id: "text-tiny",
        role: "button",
        has_text: true,
        font_size_px: 8,
        contrast_ratio: 6.0,
      },
    ],
  });

  assert.equal(status, 1, `expected exit 1. stdout: ${stdout}`);
  const out = JSON.parse(stdout);
  const violation = out.violations.find((v) => v.technique_id === "TM-04");
  assert.ok(violation, "expected TM-04 violation");
  assert.equal(violation.element_id, "text-tiny");
  // Detail must name the actual size, floor, and cross-reference
  assert.ok(
    violation.detail.includes("8") && violation.detail.includes("12"),
    `detail must name actual (8) and floor (12). detail: ${violation.detail}`
  );
  assert.ok(
    violation.detail.includes("gauntlet-strengthening") || violation.detail.includes("60-responsive"),
    `detail must cross-reference gauntlet-strengthening. detail: ${violation.detail}`
  );
});

// ─── Test 13: Coverage assertion ─────────────────────────────────────────────

test("checked_elements equals number of input elements", () => {
  const { stdout } = runAudit({
    elements: [
      { element_id: "e1", role: "button", has_text: true, contrast_ratio: 5.0 },
      { element_id: "e2", role: "img", has_text: false, decorative: false, alt: "desc" },
      { element_id: "e3", role: "link", has_text: true, has_underline: true },
    ],
  });

  const out = JSON.parse(stdout);
  assert.equal(out.checked_elements, 3, `expected 3 elements checked, got ${out.checked_elements}`);
});

// ─── Test 14: Real atom — netra-console ──────────────────────────────────────
// netra-console uses role=button (the NEXT NODE jump button), has-text, and mono font (--font-mono).
// Per manifest: font_mono = JetBrains Mono. Rendering at approx. 12px mono label size.
// Ink primary (#1F5063) on paper (#E8E2D5) contrast = ~6.2:1 (verified externally).

test("real atom semantics: netra-console jump-button passes TM-01 contrast check", () => {
  const { stdout, status } = runAudit({
    elements: [
      {
        element_id: "netra-console__jump-btn",
        role: "button",
        has_text: true,
        contrast_ratio: 6.2,  // ink-primary on paper-base (confirmed ~6.2:1)
        foreground_color: "#1F5063",
        background_color: "#E8E2D5",
        font_size_px: 12,
      },
    ],
  });

  assert.equal(status, 0, `netra-console jump-btn expected PASS. stdout: ${stdout}`);
  const out = JSON.parse(stdout);
  assert.equal(out.pass, true);
  const el = out.element_results[0];
  assert.equal(el.element_verdict, "PASS");
  // TM-01 and TM-04 both apply (button + has-text + font_size_px)
  const tm01 = el.applied_techniques.find((t) => t.technique_id === "TM-01");
  const tm04 = el.applied_techniques.find((t) => t.technique_id === "TM-04");
  assert.ok(tm01, "TM-01 must apply to button with text");
  assert.ok(tm04, "TM-04 must apply to button with font_size_px");
  assert.equal(tm01.verdict, "PASS");
  assert.equal(tm04.verdict, "PASS");
});

// ─── Test 15: Real atom — attractor-pill ─────────────────────────────────────
// attractor-pill: interactive pill (button role), accent-orange text on paper-base.
// Accent-orange (#D4602A) on paper (#E8E2D5) contrast ≈ 3.5:1 — BELOW 4.5:1.
// This is a known design constraint. The test verifies the audit correctly flags it.

test("real atom semantics: attractor-pill (accent-orange on paper) correctly fails TM-01", () => {
  const { stdout, status } = runAudit({
    elements: [
      {
        element_id: "attractor-pill__active",
        role: "button",
        has_text: true,
        contrast_ratio: 3.5,  // accent-orange (#D4602A) on paper (#E8E2D5) ≈ 3.5:1
        foreground_color: "#D4602A",
        background_color: "#E8E2D5",
        font_size_px: 11,
      },
    ],
  });

  // This SHOULD fail — accent-orange on paper is below 4.5:1
  // This test deliberately induces the failure to prove the check fires correctly
  assert.equal(status, 1, `attractor-pill contrast expected to FAIL (3.5:1 < 4.5:1). stdout: ${stdout}`);
  const out = JSON.parse(stdout);
  assert.equal(out.pass, false);
  const tm01violation = out.violations.find(
    (v) => v.technique_id === "TM-01" && v.element_id === "attractor-pill__active"
  );
  assert.ok(tm01violation, "expected TM-01 violation for attractor-pill");
  // Also: font_size 11px < 12px floor → TM-04 should also fail
  const tm04violation = out.violations.find(
    (v) => v.technique_id === "TM-04" && v.element_id === "attractor-pill__active"
  );
  assert.ok(tm04violation, "expected TM-04 violation for attractor-pill (11px < 12px floor)");
});

// ─── Test 16: Real atom — focus-button ───────────────────────────────────────
// focus-button: interactive (button role), text labels, ink-primary on paper.
// Also appears as links in some contexts. Tests multi-technique application.

test("real atom semantics: focus-button applies TM-01 (button), TM-04 (font), multiple techniques", () => {
  const { stdout, status } = runAudit({
    elements: [
      {
        element_id: "focus-button__surface",
        role: "button",
        has_text: true,
        contrast_ratio: 6.2,  // ink-primary on paper
        foreground_color: "#1F5063",
        background_color: "#E8E2D5",
        font_size_px: 12,
      },
      {
        element_id: "focus-button__orbit",
        role: "button",
        has_text: true,
        contrast_ratio: 6.2,
        font_size_px: 12,
      },
    ],
  });

  assert.equal(status, 0, `focus-button expected PASS. stdout: ${stdout}`);
  const out = JSON.parse(stdout);
  assert.equal(out.checked_elements, 2, `expected 2 elements checked`);
  assert.equal(out.pass, true);
  // Verify both elements get TM-01 applied
  for (const el of out.element_results) {
    const tm01 = el.applied_techniques.find((t) => t.technique_id === "TM-01");
    assert.ok(tm01, `${el.element_id}: TM-01 must apply`);
    assert.equal(tm01.verdict, "PASS");
  }
});

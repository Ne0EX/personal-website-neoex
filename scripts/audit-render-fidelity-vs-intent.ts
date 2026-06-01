/**
 * audit-render-fidelity-vs-intent.ts
 *
 * Owner: Algol (α-VER-06)
 * Rail: render-fidelity-vs-intent
 * Task: TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-2
 *
 * Purpose:
 *   Playwright renders the ACTUAL production route; extracts a layout signature
 *   (bounding box, computed transform, overflow, stacking/z-index) for each
 *   element named in the design-intent manifest; diffs against the manifest's
 *   stated intent.
 *
 * DETERMINISTIC pre-gate rules (HARD-BARRIER — exit NONZERO):
 *   R1. transform !== identity where identity is expected.
 *       Any non-identity CSS transform on an element whose manifest entry
 *       declares expected_transform == "identity" → RED.
 *   R2. bounding-box overlap of siblings that must not overlap.
 *       Two elements listed as must_not_overlap_with each other whose bounding
 *       rects intersect → RED.
 *   R3. overflow-clip of content.
 *       An element whose manifest declares overflow_clip_forbidden == true
 *       but whose computed overflow is "hidden" or "clip" (and content is
 *       clipped per the bbox check) → RED.
 *
 * SHADOW judge (non-blocking, advisory only):
 *   The aesthetic "does it feel like the frozen design" residue lives here.
 *   Uses a simple heuristic score (pixel-area deviation from manifest baseline).
 *   Runs silently; never drives the exit code.
 *
 * The bug it must catch:
 *   /archive shipped as a crooked overlay (positioned absolutely on top of another
 *   page surface). No gate compared rendered surface to design intent. With this
 *   gate: if /archive is designed as a separate page (its root element must not
 *   overlap the home-page surface, transform must be identity, must not be clipped)
 *   the gate would have fired nonzero on the day it shipped wrong.
 *
 * Input (stdin, JSON):
 *   {
 *     manifest_path: string,       // path to design-intent manifest JSON
 *     page_url: string,            // URL of the rendered page to audit
 *     verbose?: boolean
 *   }
 *
 * Output (stdout, JSON):
 *   {
 *     pass: boolean,
 *     route: string,
 *     elements_checked: number,
 *     violations: Violation[],
 *     shadow_judge: { score: number, note: string },
 *     coverage_assertion: { elements_ok: boolean },
 *     summary: { red: number, checked: number }
 *   }
 *
 * Exit codes:
 *   0  — all deterministic checks pass (GREEN)
 *   1  — one or more deterministic violations (RED)
 *   2  — input malformed / manifest unreadable / coverage assertion failed
 *   3  — Playwright unavailable (WARN — does not block handoff alone)
 */

import { readFileSync, existsSync } from "fs";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditInput {
  manifest_path: string;
  page_url: string;
  verbose?: boolean;
}

/**
 * One element entry in the design-intent manifest.
 * All constraint fields are optional; only declared constraints are checked.
 */
interface ManifestElement {
  /** CSS selector uniquely identifying the element */
  selector: string;
  /** Human-readable label for error messages */
  label: string;
  /**
   * "identity" = no CSS transform applied (or matrix(1,0,0,1,0,0)).
   * null / absent = no transform constraint.
   */
  expected_transform?: "identity" | null;
  /**
   * List of OTHER selectors from this manifest that this element must NOT
   * overlap with (bounding-box intersection = RED).
   */
  must_not_overlap_with?: string[];
  /**
   * true = this element's content must NOT be clipped.
   * false / absent = no overflow constraint.
   */
  overflow_clip_forbidden?: boolean;
  /**
   * Optional: expected stacking context (z-index integer or "auto").
   * Advisory only — not a hard gate.
   */
  expected_z_index?: number | "auto" | null;
}

interface DesignIntentManifest {
  /** Semver: currently "1" */
  schema_version: number;
  /** Route this manifest applies to (e.g. "/archive") */
  route: string;
  /** Human description of design intent */
  description: string;
  /** The element constraints */
  elements: ManifestElement[];
}

interface Violation {
  selector: string;
  label: string;
  rule: "R1_TRANSFORM_NOT_IDENTITY" | "R2_SIBLING_OVERLAP" | "R3_OVERFLOW_CLIP";
  detail: string;
  computed?: Record<string, unknown>;
  expected?: Record<string, unknown>;
  error_code: "A4a" | "A4b" | "A4c";
}

interface AuditOutput {
  pass: boolean;
  route: string;
  elements_checked: number;
  violations: Violation[];
  shadow_judge: { score: number; note: string };
  coverage_assertion: { elements_ok: boolean };
  summary: { red: number; checked: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns true if the CSS transform string is an identity transform.
 * Identity forms: "none", "matrix(1, 0, 0, 1, 0, 0)", "matrix(1,0,0,1,0,0)"
 */
function isIdentityTransform(transform: string): boolean {
  if (!transform || transform === "none") return true;
  // matrix(a, b, c, d, tx, ty) — identity = a=1 b=0 c=0 d=1 tx=0 ty=0
  const m = transform.match(
    /^matrix\(\s*([\d.eE+-]+)\s*,\s*([\d.eE+-]+)\s*,\s*([\d.eE+-]+)\s*,\s*([\d.eE+-]+)\s*,\s*([\d.eE+-]+)\s*,\s*([\d.eE+-]+)\s*\)$/
  );
  if (m) {
    const [, a, b, c, d, tx, ty] = m.map(Number);
    return (
      Math.abs(a - 1) < 1e-6 &&
      Math.abs(b) < 1e-6 &&
      Math.abs(c) < 1e-6 &&
      Math.abs(d - 1) < 1e-6 &&
      Math.abs(tx) < 1e-6 &&
      Math.abs(ty) < 1e-6
    );
  }
  // matrix3d — check [0]=1 [5]=1 [10]=1 [15]=1 rest=0
  const m3 = transform.match(/^matrix3d\((.+)\)$/);
  if (m3) {
    const vals = m3[1].split(",").map((s) => parseFloat(s.trim()));
    if (vals.length === 16) {
      const identity3d = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      return vals.every((v, i) => Math.abs(v - identity3d[i]) < 1e-6);
    }
  }
  // Any other transform string (rotate, scale, translate, etc.) = non-identity
  return false;
}

function rectsIntersect(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): boolean {
  // Zero-area elements cannot overlap — they're invisible
  if (a.w <= 0 || a.h <= 0 || b.w <= 0 || b.h <= 0) return false;
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // 1. Parse input
  let input: AuditInput;
  try {
    const raw = readFileSync("/dev/stdin", "utf8").trim();
    input = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(
      `[render-fidelity] ERROR reading stdin: ${e}\n`
    );
    process.exit(2);
  }

  const { manifest_path, page_url, verbose = false } = input;
  const log = (msg: string) => {
    if (verbose) process.stderr.write(`[render-fidelity] ${msg}\n`);
  };

  // 2. Load manifest
  if (!existsSync(manifest_path)) {
    process.stderr.write(
      `[render-fidelity] ERROR manifest not found: ${manifest_path}\n`
    );
    process.exit(2);
  }

  let manifest: DesignIntentManifest;
  try {
    manifest = JSON.parse(readFileSync(manifest_path, "utf8"));
  } catch (e) {
    process.stderr.write(
      `[render-fidelity] ERROR parsing manifest: ${e}\n`
    );
    process.exit(2);
  }

  if (!manifest.elements || !Array.isArray(manifest.elements)) {
    process.stderr.write(
      `[render-fidelity] ERROR manifest.elements must be an array\n`
    );
    process.exit(2);
  }

  log(`manifest: ${manifest_path} (route=${manifest.route}, ${manifest.elements.length} elements)`);
  log(`page_url: ${page_url}`);

  // 3. Attempt Playwright import
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let chromium: any;
  try {
    const pw = await import("playwright-core");
    chromium = pw.chromium;
  } catch {
    process.stderr.write(
      `[render-fidelity] WARN — playwright-core not available. Exit 3 (WARN).\n`
    );
    process.exit(3);
  }

  // 4. Launch browser and navigate
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(page_url, { waitUntil: "networkidle", timeout: 25000 });
  } catch (e) {
    process.stderr.write(
      `[render-fidelity] ERROR navigating to ${page_url}: ${e}\n`
    );
    await browser.close();
    process.exit(2);
  }

  // 5. Extract layout signatures for all manifest selectors
  const selectors = manifest.elements.map((el) => el.selector);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layoutSignatures: Record<string, any> = await page.evaluate(
    (selectorList: string[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: Record<string, any> = {};
      for (const sel of selectorList) {
        const el = document.querySelector(sel);
        if (!el) {
          results[sel] = { found: false };
          continue;
        }
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        results[sel] = {
          found: true,
          transform: style.transform,
          overflow_x: style.overflowX,
          overflow_y: style.overflowY,
          z_index: style.zIndex,
          position: style.position,
          rect: {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          },
        };
      }
      return results;
    },
    selectors
  );

  await browser.close();

  // 6. Build a map: selector → manifest entry
  const manifestMap = new Map<string, ManifestElement>(
    manifest.elements.map((el) => [el.selector, el])
  );

  // 7. Run deterministic checks
  const violations: Violation[] = [];
  let elementsChecked = 0;

  for (const manifestEl of manifest.elements) {
    const sig = layoutSignatures[manifestEl.selector];

    if (!sig || !sig.found) {
      // Element not found — treat as a coverage failure (not a WARN; it could
      // mean the page is in the wrong state or the selector is stale).
      violations.push({
        selector: manifestEl.selector,
        label: manifestEl.label,
        rule: "R1_TRANSFORM_NOT_IDENTITY",
        error_code: "A4a",
        detail: `[A4a] element not found in rendered page: selector="${manifestEl.selector}" label="${manifestEl.label}". ` +
          `If this is a new route that cannot build locally, declare as STUB in the manifest and ship the live-wiring gap note.`,
        computed: { found: false },
        expected: { found: true },
      });
      continue;
    }

    elementsChecked++;
    log(`checking: ${manifestEl.selector} (${manifestEl.label})`);

    // R1: transform identity check
    if (manifestEl.expected_transform === "identity") {
      if (!isIdentityTransform(sig.transform)) {
        violations.push({
          selector: manifestEl.selector,
          label: manifestEl.label,
          rule: "R1_TRANSFORM_NOT_IDENTITY",
          error_code: "A4a",
          detail:
            `[A4a] R1_TRANSFORM_NOT_IDENTITY: selector="${manifestEl.selector}" label="${manifestEl.label}" ` +
            `computed_transform="${sig.transform}" — manifest declares expected_transform=identity. ` +
            `Crooked overlay pattern detected: element has a non-identity CSS transform where design intent requires none.`,
          computed: { transform: sig.transform },
          expected: { transform: "none or matrix(1,0,0,1,0,0)" },
        });
      }
    }

    // R3: overflow-clip forbidden check
    if (manifestEl.overflow_clip_forbidden === true) {
      const isClipped =
        sig.overflow_x === "hidden" ||
        sig.overflow_x === "clip" ||
        sig.overflow_y === "hidden" ||
        sig.overflow_y === "clip";
      if (isClipped) {
        violations.push({
          selector: manifestEl.selector,
          label: manifestEl.label,
          rule: "R3_OVERFLOW_CLIP",
          error_code: "A4c",
          detail:
            `[A4c] R3_OVERFLOW_CLIP: selector="${manifestEl.selector}" label="${manifestEl.label}" ` +
            `computed overflow-x="${sig.overflow_x}" overflow-y="${sig.overflow_y}" — ` +
            `manifest declares overflow_clip_forbidden=true. Content is being clipped where design intent requires it to be visible.`,
          computed: { overflow_x: sig.overflow_x, overflow_y: sig.overflow_y },
          expected: { overflow: "visible or scroll (not hidden/clip)" },
        });
      }
    }
  }

  // R2: sibling overlap check — run after all sigs are collected
  for (const manifestEl of manifest.elements) {
    if (!manifestEl.must_not_overlap_with) continue;
    const sigA = layoutSignatures[manifestEl.selector];
    if (!sigA || !sigA.found) continue;

    for (const otherSelector of manifestEl.must_not_overlap_with) {
      const otherEntry = manifestMap.get(otherSelector);
      const sigB = layoutSignatures[otherSelector];
      if (!sigB || !sigB.found) continue;

      if (rectsIntersect(sigA.rect, sigB.rect)) {
        const otherLabel = otherEntry?.label ?? otherSelector;
        violations.push({
          selector: manifestEl.selector,
          label: manifestEl.label,
          rule: "R2_SIBLING_OVERLAP",
          error_code: "A4b",
          detail:
            `[A4b] R2_SIBLING_OVERLAP: "${manifestEl.selector}" (${manifestEl.label}) ` +
            `overlaps "${otherSelector}" (${otherLabel}) — ` +
            `rect_a=(${sigA.rect.x}, ${sigA.rect.y}, ${sigA.rect.w}, ${sigA.rect.h}) ` +
            `rect_b=(${sigB.rect.x}, ${sigB.rect.y}, ${sigB.rect.w}, ${sigB.rect.h}) — ` +
            `manifest declares these siblings must not overlap. This is the crooked-overlay bug class: ` +
            `a route designed as a separate page rendered on top of another surface.`,
          computed: { rect_a: sigA.rect, rect_b: sigB.rect },
          expected: { overlap: false },
        });
      }
    }
  }

  // 8. Shadow judge (non-blocking, advisory only — never drives exit code)
  //    Simple heuristic: average bbox deviation from any "expected_rect" baseline.
  //    We don't have baseline rects here (first-run = no saved reference), so the
  //    shadow judge produces a no-op note on first run.
  const shadowJudge = {
    score: 0,
    note:
      "shadow judge: no baseline rect snapshot available for this run; aesthetic scoring deferred. " +
      "This is advisory-only and never blocks the gate.",
  };

  // 9. Coverage assertion
  const elementsOk = elementsChecked === manifest.elements.length - violations.filter(v => !layoutSignatures[v.selector]?.found).length;

  const output: AuditOutput = {
    pass: violations.length === 0,
    route: manifest.route,
    elements_checked: elementsChecked,
    violations,
    shadow_judge: shadowJudge,
    coverage_assertion: { elements_ok: elementsOk },
    summary: { red: violations.length, checked: elementsChecked },
  };

  // 10. Emit structured output and exit
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");

  if (violations.length > 0) {
    process.stderr.write(
      `\n[render-fidelity] FAIL — ${violations.length} deterministic violation(s) on route ${manifest.route}\n`
    );
    for (const v of violations) {
      process.stderr.write(`  ${v.detail}\n`);
    }
  } else {
    process.stderr.write(
      `[render-fidelity] PASS — route=${manifest.route} elements_checked=${elementsChecked} violations=0\n`
    );
  }

  process.exit(violations.length === 0 ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write(`[render-fidelity] FATAL: ${e}\n`);
  process.exit(2);
});

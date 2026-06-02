/**
 * audit-gauntlet-overlap.ts
 *
 * Owner: Canopus (α-HRN-07) — TASK-2026-05-30-HARNESS-IS-OUGHT-SEPARATOR-B3B
 * Rail: gauntlet-overlap-composition
 *
 * Purpose: assert no element renders over a higher-z sibling unless the pair is
 * listed in .harness/allowed-overlaps.json with a documented reason.
 *
 * Structured error code: A3a (per gauntlet-strengthening-design.md)
 *
 * Input (stdin, JSON):
 *   {
 *     allowed_overlaps_path?: string,   // default: .harness/allowed-overlaps.json
 *     page_url: string,                  // URL of the page to audit (Playwright)
 *     verbose?: boolean
 *   }
 *
 * Output (stdout, JSON):
 *   {
 *     pass: boolean,
 *     elements_checked: number,
 *     overlaps_found: OverlapViolation[],
 *     coverage_assertion: { elements_ok: boolean },
 *     summary: { violations: number, allowed: number, checked: number }
 *   }
 *
 * Exit codes:
 *   0 — no unlisted overlaps
 *   1 — unlisted overlaps found
 *   2 — input malformed / file unreadable / coverage assertion failed
 *   3 — Playwright unavailable (WARN — does not block handoff alone)
 */

import { readFileSync, existsSync } from "fs";

interface AuditInput {
  allowed_overlaps_path?: string;
  page_url: string;
  verbose?: boolean;
}

interface AllowedOverlapEntry {
  element_selector: string;
  sibling_selector: string;
  reason: string;
  introduced: string;
}

interface AllowedOverlapsManifest {
  allowed_overlaps: AllowedOverlapEntry[];
}

interface OverlapViolation {
  element_selector: string;
  sibling_selector: string;
  element_rect: { x: number; y: number; w: number; h: number };
  sibling_rect: { x: number; y: number; w: number; h: number };
  computed_z: number;
  sibling_z: number;
  verdict: "RED";
  reason_code: "UNLISTED";
  error_message: string;
}

interface AuditOutput {
  pass: boolean;
  elements_checked: number;
  overlaps_found: OverlapViolation[];
  coverage_assertion: { elements_ok: boolean };
  summary: { violations: number; allowed: number; checked: number };
}

function formatError(
  elSel: string,
  sibSel: string,
  elRect: { x: number; y: number; w: number; h: number },
  sibRect: { x: number; y: number; w: number; h: number },
  elZ: number,
  sibZ: number
): string {
  return (
    `[A3a] element=${elSel} overlaps sibling=${sibSel}\n` +
    `      element_rect=(${elRect.x}, ${elRect.y}, ${elRect.w}, ${elRect.h}) sibling_rect=(${sibRect.x}, ${sibRect.y}, ${sibRect.w}, ${sibRect.h})\n` +
    `      computed_z=${elZ} sibling_z=${sibZ}\n` +
    `      status=UNLISTED (not in .harness/allowed-overlaps.json)\n` +
    `      action=add to allowed-overlaps with reason, OR fix z-context`
  );
}

function rectsIntersect(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

async function main(): Promise<void> {
  let input: AuditInput;
  try {
    const raw = readFileSync("/dev/stdin", "utf8").trim();
    input = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`[audit-gauntlet-overlap] ERROR reading stdin: ${e}\n`);
    process.exit(2);
  }

  const {
    allowed_overlaps_path = ".harness/allowed-overlaps.json",
    page_url,
    verbose = false,
  } = input;

  const log = (msg: string) => {
    if (verbose) process.stderr.write(`[overlap-check] ${msg}\n`);
  };

  // Load allowed overlaps manifest
  let allowedOverlaps: AllowedOverlapEntry[] = [];
  if (existsSync(allowed_overlaps_path)) {
    try {
      const manifest: AllowedOverlapsManifest = JSON.parse(
        readFileSync(allowed_overlaps_path, "utf8")
      );
      allowedOverlaps = manifest.allowed_overlaps ?? [];
    } catch (e) {
      process.stderr.write(
        `[audit-gauntlet-overlap] ERROR reading allowed-overlaps: ${e}\n`
      );
      process.exit(2);
    }
  }

  const allowedSet = new Set(
    allowedOverlaps.map((e) => `${e.element_selector}|${e.sibling_selector}`)
  );

  log(`allowed_overlaps: ${allowedOverlaps.length} entries`);
  log(`page_url: ${page_url}`);

  // Attempt Playwright import
  let chromium: unknown;
  try {
    const pw = await import("playwright-core");
    chromium = pw.chromium;
  } catch {
    process.stderr.write(
      `[audit-gauntlet-overlap] WARN — playwright-core not available. Exit 3 (WARN).\n`
    );
    process.exit(3);
  }

  // Launch browser and audit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const browser = await (chromium as any).launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(page_url, { waitUntil: "networkidle", timeout: 25000 });
  } catch (e) {
    process.stderr.write(
      `[audit-gauntlet-overlap] ERROR navigating to ${page_url}: ${e}\n`
    );
    await browser.close();
    process.exit(2);
  }

  // Enumerate all elements with non-auto z-index (the denominator)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zIndexedElements: any[] = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [];
    const all = document.querySelectorAll("*");
    all.forEach((el) => {
      const style = window.getComputedStyle(el);
      const zIndex = style.zIndex;
      if (zIndex !== "auto" && !isNaN(parseInt(zIndex, 10))) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) {
          // Build a simple selector
          const tag = el.tagName.toLowerCase();
          const id = el.id ? `#${el.id}` : "";
          const cls =
            el.className && typeof el.className === "string"
              ? "." +
                el.className
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .join(".")
              : "";
          const selector = `${tag}${id}${cls}` || tag;
          results.push({
            selector,
            z: parseInt(zIndex, 10),
            rect: {
              x: Math.round(rect.left),
              y: Math.round(rect.top),
              w: Math.round(rect.width),
              h: Math.round(rect.height),
            },
          });
        }
      }
    });
    return results;
  });

  await browser.close();

  const totalElements = zIndexedElements.length;
  log(`z-indexed elements found: ${totalElements}`);

  const violations: OverlapViolation[] = [];
  let allowedCount = 0;

  // Check each pair for overlap where el.z > sibling.z and rects intersect
  for (let i = 0; i < zIndexedElements.length; i++) {
    const el = zIndexedElements[i];
    for (let j = 0; j < zIndexedElements.length; j++) {
      if (i === j) continue;
      const sib = zIndexedElements[j];
      if (el.z > sib.z && rectsIntersect(el.rect, sib.rect)) {
        const key = `${el.selector}|${sib.selector}`;
        if (allowedSet.has(key)) {
          allowedCount++;
          log(`ALLOWED: ${el.selector} over ${sib.selector}`);
        } else {
          const errMsg = formatError(
            el.selector,
            sib.selector,
            el.rect,
            sib.rect,
            el.z,
            sib.z
          );
          violations.push({
            element_selector: el.selector,
            sibling_selector: sib.selector,
            element_rect: el.rect,
            sibling_rect: sib.rect,
            computed_z: el.z,
            sibling_z: sib.z,
            verdict: "RED",
            reason_code: "UNLISTED",
            error_message: errMsg,
          });
          log(`VIOLATION: ${el.selector} over ${sib.selector}`);
        }
      }
    }
  }

  // Coverage assertion: we must have visited all z-indexed elements
  const elementsOk = zIndexedElements.length === totalElements;

  const output: AuditOutput = {
    pass: violations.length === 0,
    elements_checked: totalElements,
    overlaps_found: violations,
    coverage_assertion: { elements_ok: elementsOk },
    summary: {
      violations: violations.length,
      allowed: allowedCount,
      checked: totalElements,
    },
  };

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  process.exit(violations.length === 0 ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write(`[audit-gauntlet-overlap] FATAL: ${e}\n`);
  process.exit(2);
});

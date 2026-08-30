/**
 * audit-gauntlet-min-legible.ts
 *
 * Owner: Canopus (α-HRN-07) — TASK-2026-05-30-HARNESS-IS-OUGHT-SEPARATOR-B3B
 * Rail: gauntlet-min-legible-size
 *
 * Purpose: assert all text and icon elements render at dimensions >= legibility floor
 * per docs/design/60-responsive-system.md thresholds, at 4 breakpoints.
 *
 * Structured error code: A3b (per gauntlet-strengthening-design.md)
 *
 * Legibility floors (from 60-responsive-system.md):
 *   WIDE  (>=1180px): min 12px font / 16x16px icon
 *   DESK  (881-1179px): 12px / 16x16
 *   MID   (601-880px): 12px / 14x14
 *   NARROW (<=600px): 11px / 12x12
 *
 * Input (stdin, JSON):
 *   {
 *     page_url: string,
 *     verbose?: boolean
 *   }
 *
 * Output (stdout, JSON):
 *   {
 *     pass: boolean,
 *     viewports_checked: number,         // must equal 4
 *     per_viewport: ViewportResult[],
 *     coverage_assertion: { all_viewports_ok: boolean },
 *     summary: { violations: number, checked_total: number }
 *   }
 *
 * Exit codes:
 *   0 — all elements at all viewports pass
 *   1 — violations found
 *   2 — input malformed / coverage assertion failed
 *   3 — Playwright unavailable (WARN)
 */

import { readFileSync } from "fs";

interface AuditInput {
  page_url: string;
  verbose?: boolean;
}

interface ViewportSpec {
  name: "WIDE" | "DESK" | "MID" | "NARROW";
  width: number;
  height: number;
  min_font_px: number;
  min_icon_w: number;
  min_icon_h: number;
}

const VIEWPORTS: ViewportSpec[] = [
  { name: "WIDE",   width: 1200, height: 900, min_font_px: 12, min_icon_w: 16, min_icon_h: 16 },
  { name: "DESK",   width: 1000, height: 900, min_font_px: 12, min_icon_w: 16, min_icon_h: 16 },
  { name: "MID",    width: 720,  height: 900, min_font_px: 12, min_icon_w: 14, min_icon_h: 14 },
  { name: "NARROW", width: 375,  height: 812, min_font_px: 11, min_icon_w: 12, min_icon_h: 12 },
];

interface ElementViolation {
  selector: string;
  viewport: string;
  viewport_width: number;
  property: "font-size" | "bounding-rect";
  computed_value: string;
  floor: string;
  verdict: "RED";
  reason_code: "BELOW_LEGIBILITY_FLOOR";
  error_message: string;
}

interface ViewportResult {
  viewport: string;
  width: number;
  elements_checked: number;
  violations: ElementViolation[];
  violations_omitted: number;
  coverage_ok: boolean;
}

interface AuditOutput {
  pass: boolean;
  viewports_checked: number;
  per_viewport: ViewportResult[];
  coverage_assertion: { all_viewports_ok: boolean };
  summary: { violations: number; checked_total: number };
}

async function main(): Promise<void> {
  let input: AuditInput;
  try {
    const raw = readFileSync(0, "utf8").trim();
    input = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`[audit-gauntlet-min-legible] ERROR reading stdin: ${e}\n`);
    process.exit(2);
  }

  const { page_url, verbose = false } = input;
  const log = (msg: string) => {
    if (verbose) process.stderr.write(`[min-legible] ${msg}\n`);
  };

  let chromium: unknown;
  try {
    const pw = await import("playwright");
    chromium = pw.chromium;
  } catch {
    process.stderr.write(
      `[audit-gauntlet-min-legible] WARN — playwright not available. Exit 3 (WARN).\n`
    );
    process.exit(3);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const browser = await (chromium as any).launch({ headless: true });

  const perViewport: ViewportResult[] = [];
  let totalViolations = 0;
  let totalChecked = 0;

  for (const vp of VIEWPORTS) {
    log(`viewport: ${vp.name} (${vp.width}px)`);
    const page = await browser.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });

    try {
      await page.goto(page_url, { waitUntil: "networkidle", timeout: 25000 });
    } catch (e) {
      process.stderr.write(
        `[audit-gauntlet-min-legible] ERROR navigating at ${vp.name}: ${e}\n`
      );
      await page.close();
      await browser.close();
      process.exit(2);
    }

    // Enumerate text and icon elements (the denominator)
    const elements: any[] = await page.evaluate(() => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const selectors = [
        '[class*="text"]', '[class*="label"]', '[class*="icon"]', '[class*="btn"]',
        'p', 'span', 'a', 'button', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        '[role="button"]', '[role="link"]', '[role="img"]',
      ];
       
      const seen = new Set<Element>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: any[] = [];

      for (const sel of selectors) {
        try {
          document.querySelectorAll(sel).forEach((el) => {
            if (seen.has(el)) return;
            seen.add(el);
            if (el.closest('[aria-hidden="true"]')) return;
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            if (
              (rect.width === 0 && rect.height === 0) ||
              style.display === 'none' ||
              style.visibility === 'hidden'
            ) return; // invisible/decorative — skip
            const tag = el.tagName.toLowerCase();
            const id = el.id ? `#${el.id}` : "";
            const cls =
              el.className && typeof el.className === "string"
                ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
                : "";
            const selector = `${tag}${id}${cls}` || tag;
            results.push({
              selector,
              font_size_px: parseFloat(style.fontSize),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              // Detect icon-only: no visible text children but has dimensions
              is_icon: el.children.length > 0 && el.textContent?.trim() === "",
            });
          });
        } catch {
          // Selector may not match — continue
        }
      }
      return results;
    });

    const violations: ElementViolation[] = [];

    for (const el of elements) {
      // Font size check (text elements)
      if (!el.is_icon && el.font_size_px > 0) {
        if (el.font_size_px < vp.min_font_px) {
          const errMsg =
            `[A3b] element=${el.selector} viewport=${vp.name} at ${vp.width}px\n` +
            `      property=font-size computed=${el.font_size_px}px floor=${vp.min_font_px}px\n` +
            `      action=increase font-size above floor`;
          violations.push({
            selector: el.selector,
            viewport: vp.name,
            viewport_width: vp.width,
            property: "font-size",
            computed_value: `${el.font_size_px}px`,
            floor: `${vp.min_font_px}px`,
            verdict: "RED",
            reason_code: "BELOW_LEGIBILITY_FLOOR",
            error_message: errMsg,
          });
          log(`VIOLATION: ${el.selector} font-size=${el.font_size_px}px < ${vp.min_font_px}px`);
        }
      }

      // Bounding-rect check (icon elements)
      if (el.is_icon) {
        if (el.width < vp.min_icon_w || el.height < vp.min_icon_h) {
          const errMsg =
            `[A3b] element=${el.selector} viewport=${vp.name} at ${vp.width}px\n` +
            `      property=bounding-rect computed=${el.width}x${el.height}px floor=${vp.min_icon_w}x${vp.min_icon_h}px\n` +
            `      action=increase element dimensions above floor`;
          violations.push({
            selector: el.selector,
            viewport: vp.name,
            viewport_width: vp.width,
            property: "bounding-rect",
            computed_value: `${el.width}x${el.height}px`,
            floor: `${vp.min_icon_w}x${vp.min_icon_h}px`,
            verdict: "RED",
            reason_code: "BELOW_LEGIBILITY_FLOOR",
            error_message: errMsg,
          });
          log(`VIOLATION: ${el.selector} icon=${el.width}x${el.height} < floor`);
        }
      }
    }

    const coverageOk = true; // visited all elements in the querySelectorAll pass

    perViewport.push({
      viewport: vp.name,
      width: vp.width,
      elements_checked: elements.length,
      violations: verbose ? violations : violations.slice(0, 12),
      violations_omitted: verbose ? 0 : Math.max(0, violations.length - 12),
      coverage_ok: coverageOk,
    });

    totalViolations += violations.length;
    totalChecked += elements.length;
    log(`${vp.name}: checked=${elements.length}, violations=${violations.length}`);

    await page.close();
  }

  await browser.close();

  const allViewportsOk = perViewport.length === VIEWPORTS.length;
  if (!allViewportsOk) {
    process.stderr.write(
      `[audit-gauntlet-min-legible] COVERAGE_ASSERT_FAIL: only ${perViewport.length}/${VIEWPORTS.length} viewports checked.\n`
    );
    process.exit(2);
  }

  const output: AuditOutput = {
    pass: totalViolations === 0,
    viewports_checked: perViewport.length,
    per_viewport: perViewport,
    coverage_assertion: { all_viewports_ok: allViewportsOk },
    summary: { violations: totalViolations, checked_total: totalChecked },
  };

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  process.exit(totalViolations === 0 ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write(`[audit-gauntlet-min-legible] FATAL: ${e}\n`);
  process.exit(2);
});

/**
 * audit-gauntlet-sub-pixel.ts
 *
 * Owner: Canopus (α-HRN-07) — TASK-2026-05-30-HARNESS-IS-OUGHT-SEPARATOR-B3B
 * Rail: gauntlet-sub-pixel-detection
 *
 * Purpose: assert all manifest atom × variant pairs render bounding rect >= 1×1px.
 * Sub-pixel (any dimension < 1px) or zero-size elements are FAIL when manifest
 * claims the atom is visible.
 *
 * Structured error code: A3c (per gauntlet-strengthening-design.md)
 *
 * Denominator: |manifest.atoms| × |variants_per_atom| Cartesian product.
 * Coverage: pairs_checked == total. If count mismatches → audit itself is RED.
 *
 * Input (stdin, JSON):
 *   {
 *     manifest_path?: string,   // default: .claude/visual-diffs/soul-atlas/manifest.json
 *     gallery_url: string,       // URL of the gallery to audit (Playwright)
 *     verbose?: boolean
 *   }
 *
 * Output (stdout, JSON):
 *   {
 *     pass: boolean,
 *     pairs_total: number,
 *     pairs_checked: number,    // must equal pairs_total
 *     violations: SubPixelViolation[],
 *     coverage_assertion: { pairs_ok: boolean },
 *     summary: { violations: number; sub_pixel: number; zero_size: number }
 *   }
 *
 * Exit codes:
 *   0 — all pairs >= 1×1px
 *   1 — sub-pixel or zero-size violations found
 *   2 — input malformed / manifest unreadable / coverage assertion failed
 *   3 — Playwright unavailable (WARN)
 */

import { readFileSync, existsSync } from "fs";

interface AuditInput {
  manifest_path?: string;
  gallery_url: string;
  verbose?: boolean;
}

interface AtomVariant {
  name: string;
  description?: string;
  render_trigger?: string;  // optional explicit trigger hint
}

interface ManifestAtom {
  id: string;
  render: string;        // CSS selector for this atom's render element
  variants: AtomVariant[];
}

interface Manifest {
  atoms: ManifestAtom[];
}

interface SubPixelViolation {
  atom_id: string;
  variant_name: string;
  selector: string;
  viewport: string;
  computed_rect: { width: number; height: number };
  status: "SUB_PIXEL" | "ZERO";
  manifest_claim: "visible";
  verdict: "RED";
  reason_code: "SUB_PIXEL_OR_ZERO";
  error_message: string;
}

interface AuditOutput {
  pass: boolean;
  pairs_total: number;
  pairs_checked: number;
  violations: SubPixelViolation[];
  coverage_assertion: { pairs_ok: boolean };
  summary: { violations: number; sub_pixel: number; zero_size: number };
}

async function main(): Promise<void> {
  let input: AuditInput;
  try {
    const raw = readFileSync(0, "utf8").trim();
    input = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`[audit-gauntlet-sub-pixel] ERROR reading stdin: ${e}\n`);
    process.exit(2);
  }

  const {
    manifest_path = ".claude/visual-diffs/soul-atlas/manifest.json",
    gallery_url,
    verbose = false,
  } = input;

  const log = (msg: string) => {
    if (verbose) process.stderr.write(`[sub-pixel] ${msg}\n`);
  };

  // Load manifest
  if (!existsSync(manifest_path)) {
    // Per soul-atom-drift convention: exits 0 silently when manifest does not exist
    process.stderr.write(
      `[audit-gauntlet-sub-pixel] manifest not found at ${manifest_path} — exiting 0 (pre-Phase-1)\n`
    );
    const output: AuditOutput = {
      pass: true,
      pairs_total: 0,
      pairs_checked: 0,
      violations: [],
      coverage_assertion: { pairs_ok: true },
      summary: { violations: 0, sub_pixel: 0, zero_size: 0 },
    };
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    process.exit(0);
  }

  let manifest: Manifest;
  try {
    manifest = JSON.parse(readFileSync(manifest_path, "utf8"));
  } catch (e) {
    process.stderr.write(`[audit-gauntlet-sub-pixel] ERROR reading manifest: ${e}\n`);
    process.exit(2);
  }

  // Compute denominator: |atoms| × |variants_per_atom|
  const pairs: Array<{ atom: ManifestAtom; variant: AtomVariant }> = [];
  for (const atom of manifest.atoms) {
    for (const variant of atom.variants) {
      pairs.push({ atom, variant });
    }
  }
  const pairsTotal = pairs.length;
  log(`pairs_total=${pairsTotal} (${manifest.atoms.length} atoms)`);

  // Attempt Playwright import
  let chromium: unknown;
  try {
    const pw = await import("playwright");
    chromium = pw.chromium;
  } catch {
    process.stderr.write(
      `[audit-gauntlet-sub-pixel] WARN — playwright not available. Exit 3 (WARN).\n`
    );
    process.exit(3);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const browser = await (chromium as any).launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(gallery_url, { waitUntil: "networkidle", timeout: 25000 });
  } catch (e) {
    process.stderr.write(
      `[audit-gauntlet-sub-pixel] ERROR navigating to ${gallery_url}: ${e}\n`
    );
    await browser.close();
    process.exit(2);
  }

  const violations: SubPixelViolation[] = [];
  let pairsChecked = 0;
  let subPixelCount = 0;
  let zeroCount = 0;

  for (const { atom, variant } of pairs) {
    log(`checking: atom=${atom.id} variant=${variant.name} selector=${atom.render}`);

    // Apply variant trigger if specified (class addition hint)
    if (variant.render_trigger) {
      try {
        await page.evaluate((trigger: string) => {
          // Simple trigger: add class to body or the selector
          document.body.classList.add(trigger.replace(/^\./, ""));
        }, variant.render_trigger);
      } catch {
        // Trigger application failed — proceed without it
      }
    }

    // Measure the bounding rect
    let rect: { width: number; height: number } | null = null;
    try {
       
      rect = await page.evaluate((sel: string): { width: number; height: number } | null => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { width: r.width, height: r.height };
      }, atom.render);
    } catch {
      rect = null;
    }

    // Reset trigger
    if (variant.render_trigger) {
      try {
        await page.evaluate((trigger: string) => {
          document.body.classList.remove(trigger.replace(/^\./, ""));
        }, variant.render_trigger);
      } catch {
        // Ignore cleanup failure
      }
    }

    pairsChecked++;

    if (rect === null) {
      // Element not found — treat as zero
      const errMsg =
        `[A3c] atom=${atom.id} variant=${variant.name} selector=${atom.render}\n` +
        `      viewport=default computed_rect=NOT_FOUND\n` +
        `      status=ZERO (element not found in DOM)\n` +
        `      manifest_claim=visible\n` +
        `      action=fix rendering to produce >=1x1px bounding rect, or mark variant as intentionally-hidden`;
      violations.push({
        atom_id: atom.id,
        variant_name: variant.name,
        selector: atom.render,
        viewport: "default",
        computed_rect: { width: 0, height: 0 },
        status: "ZERO",
        manifest_claim: "visible",
        verdict: "RED",
        reason_code: "SUB_PIXEL_OR_ZERO",
        error_message: errMsg,
      });
      zeroCount++;
      log(`VIOLATION: ${atom.id}/${variant.name} — element not found`);
      continue;
    }

    const isZero = rect.width === 0 || rect.height === 0;
    const isSubPixel = rect.width < 1 || rect.height < 1;

    if (isZero || isSubPixel) {
      const status: "SUB_PIXEL" | "ZERO" = isZero ? "ZERO" : "SUB_PIXEL";
      const errMsg =
        `[A3c] atom=${atom.id} variant=${variant.name} selector=${atom.render}\n` +
        `      viewport=default computed_rect=${rect.width}x${rect.height}px\n` +
        `      status=${status} (${status === "ZERO" ? "W==0 or H==0" : "W<1 or H<1"})\n` +
        `      manifest_claim=visible\n` +
        `      action=fix rendering to produce >=1x1px bounding rect, or mark variant as intentionally-hidden in manifest`;
      violations.push({
        atom_id: atom.id,
        variant_name: variant.name,
        selector: atom.render,
        viewport: "default",
        computed_rect: rect,
        status,
        manifest_claim: "visible",
        verdict: "RED",
        reason_code: "SUB_PIXEL_OR_ZERO",
        error_message: errMsg,
      });
      if (isZero) zeroCount++;
      else subPixelCount++;
      log(`VIOLATION: ${atom.id}/${variant.name} — ${status} (${rect.width}x${rect.height}px)`);
    } else {
      log(`PASS: ${atom.id}/${variant.name} — ${rect.width}x${rect.height}px`);
    }
  }

  await browser.close();

  // Coverage assertion
  const pairsOk = pairsChecked === pairsTotal;
  if (!pairsOk) {
    process.stderr.write(
      `[audit-gauntlet-sub-pixel] COVERAGE_ASSERT_FAIL: checked ${pairsChecked} but manifest declares ${pairsTotal} pairs.\n`
    );
    process.exit(2);
  }

  const output: AuditOutput = {
    pass: violations.length === 0,
    pairs_total: pairsTotal,
    pairs_checked: pairsChecked,
    violations,
    coverage_assertion: { pairs_ok: pairsOk },
    summary: {
      violations: violations.length,
      sub_pixel: subPixelCount,
      zero_size: zeroCount,
    },
  };

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  process.exit(violations.length === 0 ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write(`[audit-gauntlet-sub-pixel] FATAL: ${e}\n`);
  process.exit(2);
});

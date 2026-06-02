/**
 * tests/soul-atom-drift-audit.test.mjs
 *
 * Regression tests for scripts/audit-soul-atom-drift.ts
 * Owner: Algol (α-VER-06) — TASK-2026-05-29-SOUL-FACTORY-P2B
 *
 * Run with:
 *   node --test tests/soul-atom-drift-audit.test.mjs
 *
 * Tests cover:
 *   1. Contract shape — output JSON has required fields
 *   2. atoms_checked count matches manifest atom count
 *   3. Exit-code semantics — 0 on pass, 1 on violation
 *   4. Exemption machinery — gate:exempt comments suppress violations
 *   5. Cited literals pass — main_branch_refs entries are accepted
 *   6. Uncited literals flag as violations
 *   7. main-branch-mismatch detection
 *   8. token-ref var() usage check produces warnings not violations
 *   9. data-gate-exempt script blocks are skipped
 *  10. Live manifest: atoms_checked === 12 and audit runs without crashing
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const REPO_ROOT = resolve(import.meta.dirname ?? new URL(".", import.meta.url).pathname, "..");
const AUDIT_TS = join(REPO_ROOT, "scripts", "audit-soul-atom-drift.ts");
const REAL_MANIFEST = join(REPO_ROOT, ".claude", "visual-diffs", "soul-atlas", "manifest.json");
const REAL_GALLERY = join(REPO_ROOT, ".claude", "visual-diffs", "soul-atlas", "gallery.html");
const REAL_TOKENS = join(REPO_ROOT, "app", "globals.css");

// Read expected atom count from live manifest at module load time.
// This is future-proof against manifest growth — no hardcoded count.
const LIVE_MANIFEST_ATOM_COUNT = JSON.parse(readFileSync(REAL_MANIFEST, "utf8")).atoms.length;

/**
 * Run the audit with the given input JSON and return { stdout, stderr, status }.
 * Never throws — caller checks status.
 */
function runAudit(input) {
  const inputJson = JSON.stringify(input);
  const result = spawnSync(
    "npx",
    ["tsx", AUDIT_TS],
    {
      input: inputJson,
      encoding: "utf8",
      cwd: REPO_ROOT,
      timeout: 30_000,
    }
  );
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? -1,
  };
}

/**
 * Create a temporary directory with a minimal valid globals.css and return
 * a helper that writes files relative to that dir.
 */
function makeTmpDir() {
  const dir = mkdtempSync(join(tmpdir(), "soul-audit-test-"));
  return {
    dir,
    write(relPath, content) {
      const full = join(dir, relPath);
      mkdirSync(full.substring(0, full.lastIndexOf("/")), { recursive: true });
      writeFileSync(full, content, "utf8");
      return full;
    },
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Minimal globals.css stub with a few tokens. */
const STUB_GLOBALS_CSS = `
:root {
  --accent-orange: #D4602A;
  --ink-primary: #1F5063;
  --ink-soft: rgba(31, 80, 99, 0.55);
  --ink-hairline: rgba(31, 80, 99, 0.12);
  --paper-base: #E8E2D5;
  --font-mono: 'JetBrains Mono';
}
`;

/** Minimal manifest with one atom, fully tokenized. */
function minimalManifest(overrides = {}) {
  return JSON.stringify({
    schema_version: 1,
    gallery_path: ".claude/visual-diffs/soul-atlas/gallery.html",
    token_source: "app/globals.css",
    generated_at: "2026-05-29T00:00:00Z",
    atoms: [
      {
        id: "test-atom",
        name: "Test Atom",
        description: "A minimal test atom.",
        rationale: "Test coverage.",
        variants: [{ name: "default", description: "The default state." }],
        token_refs: ["--accent-orange"],
        main_branch_refs: [],
        render: "#atom-test-atom",
        impl_ref: null,
        ...overrides,
      },
    ],
  });
}

/** Minimal gallery section for test-atom that only uses var() references.
 *  No raw px/color/timing literals — all appearance values via token classes
 *  or pure var() with no literal components. */
const CLEAN_GALLERY_HTML = `<!doctype html><html><body>
<section id="atom-test-atom" data-atom-id="test-atom">
  <div class="stage" style="color: var(--accent-orange); border: var(--border-reticle);">
    Test content. Fully tokenized.
  </div>
</section>
</body></html>`;

// ─── Test 1: Contract shape ────────────────────────────────────────────────────

test("output JSON has required fields: pass, violations, atoms_checked, warnings", () => {
  const tmp = makeTmpDir();
  try {
    const manifestPath = tmp.write("manifest.json", minimalManifest());
    const galleryPath = tmp.write("gallery.html", CLEAN_GALLERY_HTML);
    const tokenPath = tmp.write("app/globals.css", STUB_GLOBALS_CSS);

    const { stdout, status } = runAudit({
      manifest_path: manifestPath,
      gallery_path: galleryPath,
      token_source: tokenPath,
      verbose: false,
    });

    assert.equal(status, 0, `expected exit 0, got ${status}. stderr: ${stdout}`);
    const out = JSON.parse(stdout);
    assert.ok("pass" in out, "output missing 'pass' field");
    assert.ok("violations" in out, "output missing 'violations' field");
    assert.ok("atoms_checked" in out, "output missing 'atoms_checked' field");
    assert.ok("warnings" in out, "output missing 'warnings' field");
    assert.ok(Array.isArray(out.violations), "'violations' must be an array");
    assert.ok(Array.isArray(out.warnings), "'warnings' must be an array");
  } finally {
    tmp.cleanup();
  }
});

// ─── Test 2: atoms_checked count ──────────────────────────────────────────────

test("atoms_checked equals the number of atoms in the manifest", () => {
  const tmp = makeTmpDir();
  try {
    const manifest = JSON.stringify({
      schema_version: 1,
      gallery_path: ".claude/visual-diffs/soul-atlas/gallery.html",
      token_source: "app/globals.css",
      generated_at: "2026-05-29T00:00:00Z",
      atoms: [
        {
          id: "atom-a",
          name: "Atom A",
          description: "x",
          rationale: "x",
          variants: [{ name: "default", description: "x" }],
          token_refs: [],
          main_branch_refs: [],
          render: "#atom-atom-a",
          impl_ref: null,
        },
        {
          id: "atom-b",
          name: "Atom B",
          description: "x",
          rationale: "x",
          variants: [{ name: "default", description: "x" }],
          token_refs: [],
          main_branch_refs: [],
          render: "#atom-atom-b",
          impl_ref: null,
        },
      ],
    });
    const gallery = `<!doctype html><html><body>
<section id="atom-atom-a" data-atom-id="atom-a"><div>clean</div></section>
<section id="atom-atom-b" data-atom-id="atom-b"><div>clean</div></section>
</body></html>`;

    const manifestPath = tmp.write("manifest.json", manifest);
    const galleryPath = tmp.write("gallery.html", gallery);
    const tokenPath = tmp.write("app/globals.css", STUB_GLOBALS_CSS);

    const { stdout, status } = runAudit({
      manifest_path: manifestPath,
      gallery_path: galleryPath,
      token_source: tokenPath,
      verbose: false,
    });

    assert.equal(status, 0);
    const out = JSON.parse(stdout);
    assert.equal(out.atoms_checked, 2);
  } finally {
    tmp.cleanup();
  }
});

// ─── Test 3: Exit codes ───────────────────────────────────────────────────────

test("exit 0 when all atoms pass; exit 1 when violations exist", () => {
  const tmp = makeTmpDir();
  try {
    const galleryWithViolation = `<!doctype html><html><body>
<section id="atom-test-atom" data-atom-id="test-atom">
  <div style="color: #ff0000;">Uncited hex color — violation.</div>
</section>
</body></html>`;

    const manifestPath = tmp.write("manifest.json", minimalManifest());
    const galleryViolPath = tmp.write("gallery-violating.html", galleryWithViolation);
    const galleryCleanPath = tmp.write("gallery-clean.html", CLEAN_GALLERY_HTML);
    const tokenPath = tmp.write("app/globals.css", STUB_GLOBALS_CSS);

    // Clean gallery → exit 0
    const clean = runAudit({
      manifest_path: manifestPath,
      gallery_path: galleryCleanPath,
      token_source: tokenPath,
      verbose: false,
    });
    assert.equal(clean.status, 0, `expected exit 0 for clean gallery, got ${clean.status}`);

    // Violating gallery → exit 1
    const violating = runAudit({
      manifest_path: manifestPath,
      gallery_path: galleryViolPath,
      token_source: tokenPath,
      verbose: false,
    });
    assert.equal(violating.status, 1, `expected exit 1 for violating gallery, got ${violating.status}`);
    const out = JSON.parse(violating.stdout);
    assert.equal(out.pass, false);
    assert.ok(out.violations.length > 0, "expected at least one violation");
    assert.equal(out.violations[0].violation, "uncited-literal");
    assert.equal(out.violations[0].atom_id, "test-atom");
  } finally {
    tmp.cleanup();
  }
});

// ─── Test 4: gate:exempt comment suppression ─────────────────────────────────

test("content inside <!-- gate: exempt → ... --> comments is not scanned for literals", () => {
  const tmp = makeTmpDir();
  try {
    // The comment itself contains a hex value; that content is inside the comment
    // and must be suppressed. Content AFTER the comment close is still scanned.
    const galleryWithExemptComment = `<!doctype html><html><body>
<section id="atom-test-atom" data-atom-id="test-atom">
  <!-- gate: exempt → Three.js canvas value: #ff0000 maps to --accent-orange -->
  <div style="color: var(--accent-orange);">Clean; only token ref.</div>
</section>
</body></html>`;

    const manifestPath = tmp.write("manifest.json", minimalManifest());
    const galleryPath = tmp.write("gallery.html", galleryWithExemptComment);
    const tokenPath = tmp.write("app/globals.css", STUB_GLOBALS_CSS);

    const { stdout, status } = runAudit({
      manifest_path: manifestPath,
      gallery_path: galleryPath,
      token_source: tokenPath,
      verbose: false,
    });

    const out = JSON.parse(stdout);
    assert.equal(status, 0, `expected exit 0 (comment content should not produce violations). violations: ${JSON.stringify(out.violations)}`);
    assert.equal(out.pass, true);
    assert.equal(out.violations.length, 0);
  } finally {
    tmp.cleanup();
  }
});

test("<script data-gate-exempt='true'> blocks inside atom sections are skipped entirely", () => {
  const tmp = makeTmpDir();
  try {
    // A script tag with data-gate-exempt="true" inside the atom section
    // contains hex literals that must not produce violations.
    const galleryWithExemptScript = `<!doctype html><html><body>
<section id="atom-test-atom" data-atom-id="test-atom">
  <script data-gate-exempt="true">
    var ink = '#1F5063'; var accent = '#D4602A'; // Three.js constants
  </script>
  <div style="color: var(--accent-orange);">Clean content.</div>
</section>
</body></html>`;

    const manifestPath = tmp.write("manifest.json", minimalManifest());
    const galleryPath = tmp.write("gallery.html", galleryWithExemptScript);
    const tokenPath = tmp.write("app/globals.css", STUB_GLOBALS_CSS);

    const { stdout } = runAudit({
      manifest_path: manifestPath,
      gallery_path: galleryPath,
      token_source: tokenPath,
      verbose: false,
    });

    const out = JSON.parse(stdout);
    // The hex constants inside the exempt script block must not produce violations
    const hexViolations = out.violations.filter(v =>
      v.violation === "uncited-literal" && (v.detail.includes("#1F5063") || v.detail.includes("#D4602A"))
    );
    assert.equal(hexViolations.length, 0, `unexpected hex violations from exempt script: ${JSON.stringify(hexViolations)}`);
  } finally {
    tmp.cleanup();
  }
});


// ─── Test 6: Cited literal passes ────────────────────────────────────────────

test("a raw literal that matches a main_branch_ref value does not produce a violation", () => {
  const tmp = makeTmpDir();
  try {
    // Atom that has a 12px literal properly cited
    const manifest = JSON.stringify({
      schema_version: 1,
      gallery_path: ".claude/visual-diffs/soul-atlas/gallery.html",
      token_source: "app/globals.css",
      generated_at: "2026-05-29T00:00:00Z",
      atoms: [
        {
          id: "test-atom",
          name: "Test Atom",
          description: "x",
          rationale: "x",
          variants: [{ name: "default", description: "x" }],
          token_refs: ["--accent-orange"],
          main_branch_refs: [
            { file: "app/globals.css", line: 2, value: "12px", role: "arm length" },
          ],
          render: "#atom-test-atom",
          impl_ref: null,
        },
      ],
    });
    const galleryWithCitedLiteral = `<!doctype html><html><body>
<section id="atom-test-atom" data-atom-id="test-atom">
  <!-- gate: main_branch_ref value="12px" — arm length (globals.css L2) -->
  <div style="width:12px; color: var(--accent-orange);">Cited 12px.</div>
</section>
</body></html>`;

    // Create the globals.css with the cited value at line 2 (1-indexed)
    const tokenPath = tmp.write("app/globals.css", `:root { --accent-orange: #D4602A; }\n.arm { width: 12px; }\n`);
    const manifestPath = tmp.write("manifest.json", manifest);
    const galleryPath = tmp.write("gallery.html", galleryWithCitedLiteral);

    const { stdout } = runAudit({
      manifest_path: manifestPath,
      gallery_path: galleryPath,
      token_source: tokenPath,
      verbose: false,
    });

    const out = JSON.parse(stdout);
    // The 12px is cited in main_branch_refs and the gate: main_branch_ref comment
    // covers it. No violations expected.
    const uncitedViolations = out.violations.filter(v => v.violation === "uncited-literal");
    assert.equal(uncitedViolations.length, 0, `unexpected uncited-literal violations: ${JSON.stringify(uncitedViolations)}`);
  } finally {
    tmp.cleanup();
  }
});

// ─── Test 7: Uncited literal produces violation ───────────────────────────────

test("an uncited hex color in an atom section produces an uncited-literal violation", () => {
  const tmp = makeTmpDir();
  try {
    const manifestPath = tmp.write("manifest.json", minimalManifest());
    const gallery = `<!doctype html><html><body>
<section id="atom-test-atom" data-atom-id="test-atom">
  <div style="color: #D4602A;">Hex color — not cited as main_branch_ref.</div>
</section>
</body></html>`;
    const galleryPath = tmp.write("gallery.html", gallery);
    const tokenPath = tmp.write("app/globals.css", STUB_GLOBALS_CSS);

    const { stdout, status } = runAudit({
      manifest_path: manifestPath,
      gallery_path: galleryPath,
      token_source: tokenPath,
      verbose: false,
    });

    assert.equal(status, 1);
    const out = JSON.parse(stdout);
    assert.equal(out.pass, false);
    const hexViolation = out.violations.find(v =>
      v.violation === "uncited-literal" && v.detail.includes("#D4602A")
    );
    assert.ok(hexViolation, "expected an uncited-literal violation for #D4602A");
  } finally {
    tmp.cleanup();
  }
});

// ─── Test 8: main-branch-mismatch detection ──────────────────────────────────

test("main-branch-mismatch fires when cited value is absent from the stated file+line", () => {
  const tmp = makeTmpDir();
  try {
    // manifest cites "99px" at line 1 of app/globals.css; actual file has no such value
    const manifest = JSON.stringify({
      schema_version: 1,
      gallery_path: ".claude/visual-diffs/soul-atlas/gallery.html",
      token_source: "app/globals.css",
      generated_at: "2026-05-29T00:00:00Z",
      atoms: [
        {
          id: "test-atom",
          name: "Test Atom",
          description: "x",
          rationale: "x",
          variants: [{ name: "default", description: "x" }],
          token_refs: [],
          main_branch_refs: [
            { file: "app/globals.css", line: 1, value: "99px", role: "phantom value that does not exist" },
          ],
          render: "#atom-test-atom",
          impl_ref: null,
        },
      ],
    });

    // globals.css that does NOT contain 99px; must be in tmp.dir/app/globals.css
    const tokenPath = tmp.write("app/globals.css", `:root { --paper-base: #E8E2D5; }\n`);
    const manifestPath = tmp.write("manifest.json", manifest);
    const gallery = `<!doctype html><html><body>
<section id="atom-test-atom" data-atom-id="test-atom">
  <!-- gate: main_branch_ref value="99px" — phantom cite -->
  <div>No raw literals here.</div>
</section>
</body></html>`;
    const galleryPath = tmp.write("gallery.html", gallery);

    const { stdout, status } = runAudit({
      manifest_path: manifestPath,
      gallery_path: galleryPath,
      token_source: tokenPath,
      verbose: false,
      // Pass repo_root explicitly so the audit resolves "app/globals.css"
      // relative to our temp directory, not the git repo root.
      repo_root: tmp.dir,
    });

    assert.equal(status, 1);
    const out = JSON.parse(stdout);
    const mismatch = out.violations.find(v => v.violation === "main-branch-mismatch");
    assert.ok(mismatch, `expected a main-branch-mismatch violation. violations: ${JSON.stringify(out.violations)}`);
    // The detail should reference the file and the phantom value
    assert.ok(
      mismatch.detail.includes("99px") || mismatch.detail.includes("app/globals.css"),
      `mismatch detail should mention the phantom value or file. detail: ${mismatch.detail}`
    );
  } finally {
    tmp.cleanup();
  }
});

// ─── Test 9: missing atom section produces a violation ───────────────────────

test("an atom listed in manifest but absent from gallery produces a violation", () => {
  const tmp = makeTmpDir();
  try {
    const manifestPath = tmp.write("manifest.json", minimalManifest());
    // gallery has no section for test-atom
    const emptyGallery = `<!doctype html><html><body><p>No atom sections here.</p></body></html>`;
    const galleryPath = tmp.write("gallery.html", emptyGallery);
    const tokenPath = tmp.write("app/globals.css", STUB_GLOBALS_CSS);

    const { stdout, status } = runAudit({
      manifest_path: manifestPath,
      gallery_path: galleryPath,
      token_source: tokenPath,
      verbose: false,
    });

    assert.equal(status, 1);
    const out = JSON.parse(stdout);
    assert.equal(out.pass, false);
    const missingSection = out.violations.find(v =>
      v.atom_id === "test-atom" && v.detail.includes("No gallery section found")
    );
    assert.ok(missingSection, `expected a 'section missing' violation. violations: ${JSON.stringify(out.violations)}`);
  } finally {
    tmp.cleanup();
  }
});

// ─── Test 10: live manifest runs without crashing, atoms_checked matches manifest ──

test("live manifest + gallery: atoms_checked matches manifest.atoms.length and audit produces valid JSON", () => {
  const { stdout, status, stderr } = runAudit({
    manifest_path: REAL_MANIFEST,
    gallery_path: REAL_GALLERY,
    token_source: REAL_TOKENS,
    verbose: false,
  });

  // Must not crash (exit 2)
  assert.notEqual(status, 2, `audit crashed (exit 2). stderr: ${stderr}`);

  let out;
  try {
    out = JSON.parse(stdout);
  } catch (e) {
    assert.fail(`audit output is not valid JSON. stdout: ${stdout.slice(0, 500)}`);
  }

  assert.ok("pass" in out, "missing 'pass' field");
  assert.ok("violations" in out, "missing 'violations' field");
  // Count is read from manifest at module load — future-proof against manifest growth.
  assert.equal(
    out.atoms_checked,
    LIVE_MANIFEST_ATOM_COUNT,
    `expected ${LIVE_MANIFEST_ATOM_COUNT} atoms (live manifest count), got ${out.atoms_checked}`
  );

  // All violations should have required fields
  for (const v of out.violations) {
    assert.ok(v.atom_id, `violation missing atom_id: ${JSON.stringify(v)}`);
    assert.ok(v.atom_name, `violation missing atom_name: ${JSON.stringify(v)}`);
    assert.ok(v.violation, `violation missing violation type: ${JSON.stringify(v)}`);
    assert.ok(v.detail, `violation missing detail: ${JSON.stringify(v)}`);
  }
});

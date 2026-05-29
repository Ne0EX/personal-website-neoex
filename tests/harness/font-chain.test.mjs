/**
 * tests/harness/font-chain.test.mjs
 *
 * Regression tests for scripts/audit-font-chain.sh
 * Owner: Algol (α-VER-06) — TASK-2026-05-29-SOUL-FACTORY-FONTTEST-FIX
 *
 * Ported from bash test (wrong extension) to node --test + spawnSync pattern
 * matching tests/soul-atom-drift-audit.test.mjs.
 *
 * Run with:
 *   node --test tests/harness/font-chain.test.mjs
 *
 * Coverage (8 mandated scenarios per Canopus TASK-2026-05-29-SOUL-FACTORY-FIDELITY-RAIL):
 *   (a) gallery with all three font-chain bindings          → exit 0
 *   (b) gallery with --font-display removed                 → exit 1, error names token
 *   (c) gallery with --font-mono removed                    → exit 1, error names token
 *   (d) gallery with --font-type removed                    → exit 1, error names token
 *   (e) all three removed                                   → exit 1, all three named
 *   (f) manifest.json not found                             → exit 2 (SKIP)
 *   (g) gallery.html not found when manifest exists         → exit 3
 *   (h) audit-soul-atom-drift.sh wiring: font-chain exit 1 propagates to drift exit 1
 *
 * Bonus:
 *   (real) production gallery.html passes the real audit-font-chain.sh
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const REPO_ROOT = resolve(
  new URL(".", import.meta.url).pathname,
  "../.."
);
const SCRIPT = join(REPO_ROOT, "scripts", "audit-font-chain.sh");
const DRIFT_SCRIPT = join(REPO_ROOT, "scripts", "audit-soul-atom-drift.sh");
const REAL_GALLERY = join(
  REPO_ROOT,
  ".claude",
  "visual-diffs",
  "soul-atlas",
  "gallery.html"
);
const REAL_MANIFEST = join(
  REPO_ROOT,
  ".claude",
  "visual-diffs",
  "soul-atlas",
  "manifest.json"
);

/** Minimal gallery HTML with all three font-chain bindings. */
const FULL_GALLERY_HTML = `<!DOCTYPE html>
<html>
<head>
<style data-gate-exempt="true">
:root {
  --font-display: var(--font-cormorant), 'Cormorant Garamond', serif;
  --font-mono:    var(--font-jetbrains), 'JetBrains Mono', ui-monospace, monospace;
  --font-type:    var(--font-elite),     'Special Elite', ui-monospace, monospace;
}
</style>
</head>
<body><p class="t-display">voice</p></body>
</html>`;

/** Minimal stub manifest — font-chain only needs this to exist. */
const STUB_MANIFEST = JSON.stringify({ schema_version: 2, atoms: [] });

/**
 * Create a temporary directory and return helpers.
 */
function makeTmpDir() {
  const dir = mkdtempSync(join(tmpdir(), "font-chain-test-"));
  return {
    dir,
    write(relPath, content) {
      const full = join(dir, relPath);
      const parent = full.substring(0, full.lastIndexOf("/"));
      mkdirSync(parent, { recursive: true });
      writeFileSync(full, content, "utf8");
      return full;
    },
    copy(src, relDest) {
      const full = join(dir, relDest);
      const parent = full.substring(0, full.lastIndexOf("/"));
      mkdirSync(parent, { recursive: true });
      copyFileSync(src, full);
      return full;
    },
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/**
 * Run audit-font-chain.sh with the given env overrides.
 * Returns { stdout, stderr, status }.
 */
function runFontChain(env = {}) {
  const result = spawnSync("bash", [SCRIPT], {
    encoding: "utf8",
    timeout: 15_000,
    env: { ...process.env, ...env },
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? -1,
  };
}

/**
 * Run audit-soul-atom-drift.sh from a given cwd.
 */
function runDrift(cwd) {
  const result = spawnSync("bash", [join(cwd, "scripts", "audit-soul-atom-drift.sh")], {
    encoding: "utf8",
    timeout: 15_000,
    cwd,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? -1,
  };
}

/** Strip one CSS variable binding from gallery HTML. */
function withoutBinding(html, varName) {
  return html
    .split("\n")
    .filter((line) => !line.includes(varName))
    .join("\n");
}

// ─── scenario (a): all three bindings present → exit 0 ─────────────────────

test("(a) all three font-chain bindings present → exit 0", () => {
  const tmp = makeTmpDir();
  try {
    const galleryPath = tmp.write("gallery.html", FULL_GALLERY_HTML);
    const manifestPath = tmp.write("manifest.json", STUB_MANIFEST);

    const { status } = runFontChain({
      GALLERY_PATH: galleryPath,
      MANIFEST_PATH: manifestPath,
    });

    assert.equal(status, 0, `expected exit 0 for full gallery`);
  } finally {
    tmp.cleanup();
  }
});

// ─── scenario (b): --font-display removed → exit 1, error names token ───────

test("(b) --font-display removed → exit 1 and error names the token", () => {
  const tmp = makeTmpDir();
  try {
    const noDisplay = withoutBinding(FULL_GALLERY_HTML, "--font-display");
    const galleryPath = tmp.write("gallery-no-display.html", noDisplay);
    const manifestPath = tmp.write("manifest.json", STUB_MANIFEST);

    const { status, stdout, stderr } = runFontChain({
      GALLERY_PATH: galleryPath,
      MANIFEST_PATH: manifestPath,
    });

    assert.equal(status, 1, `expected exit 1 when --font-display is absent`);
    const combined = stdout + stderr;
    assert.ok(
      combined.includes("--font-display"),
      `error output must name --font-display. got: ${combined}`
    );
  } finally {
    tmp.cleanup();
  }
});

// ─── scenario (c): --font-mono removed → exit 1, error names token ──────────

test("(c) --font-mono removed → exit 1 and error names the token", () => {
  const tmp = makeTmpDir();
  try {
    const noMono = withoutBinding(FULL_GALLERY_HTML, "--font-mono");
    const galleryPath = tmp.write("gallery-no-mono.html", noMono);
    const manifestPath = tmp.write("manifest.json", STUB_MANIFEST);

    const { status, stdout, stderr } = runFontChain({
      GALLERY_PATH: galleryPath,
      MANIFEST_PATH: manifestPath,
    });

    assert.equal(status, 1, `expected exit 1 when --font-mono is absent`);
    const combined = stdout + stderr;
    assert.ok(
      combined.includes("--font-mono"),
      `error output must name --font-mono. got: ${combined}`
    );
  } finally {
    tmp.cleanup();
  }
});

// ─── scenario (d): --font-type removed → exit 1, error names token ──────────

test("(d) --font-type removed → exit 1 and error names the token", () => {
  const tmp = makeTmpDir();
  try {
    const noType = withoutBinding(FULL_GALLERY_HTML, "--font-type");
    const galleryPath = tmp.write("gallery-no-type.html", noType);
    const manifestPath = tmp.write("manifest.json", STUB_MANIFEST);

    const { status, stdout, stderr } = runFontChain({
      GALLERY_PATH: galleryPath,
      MANIFEST_PATH: manifestPath,
    });

    assert.equal(status, 1, `expected exit 1 when --font-type is absent`);
    const combined = stdout + stderr;
    assert.ok(
      combined.includes("--font-type"),
      `error output must name --font-type. got: ${combined}`
    );
  } finally {
    tmp.cleanup();
  }
});

// ─── scenario (e): all three removed → exit 1, all three named ──────────────

test("(e) all three bindings removed → exit 1 and all three tokens named in output", () => {
  const tmp = makeTmpDir();
  try {
    let noFonts = withoutBinding(FULL_GALLERY_HTML, "--font-display");
    noFonts = withoutBinding(noFonts, "--font-mono");
    noFonts = withoutBinding(noFonts, "--font-type");
    const galleryPath = tmp.write("gallery-no-fonts.html", noFonts);
    const manifestPath = tmp.write("manifest.json", STUB_MANIFEST);

    const { status, stdout, stderr } = runFontChain({
      GALLERY_PATH: galleryPath,
      MANIFEST_PATH: manifestPath,
    });

    assert.equal(status, 1, `expected exit 1 when all font-chain bindings absent`);
    const combined = stdout + stderr;
    assert.ok(combined.includes("--font-display"), `error must name --font-display`);
    assert.ok(combined.includes("--font-mono"), `error must name --font-mono`);
    assert.ok(combined.includes("--font-type"), `error must name --font-type`);
  } finally {
    tmp.cleanup();
  }
});

// ─── scenario (f): manifest.json not found → exit 2 (SKIP) ─────────────────

test("(f) manifest.json not found → exit 2 (SKIP, no false positive)", () => {
  const tmp = makeTmpDir();
  try {
    // Build a fake git root with no manifest at the expected path
    const fakeRoot = join(tmp.dir, "fake-root-f");
    mkdirSync(join(fakeRoot, ".git"), { recursive: true });
    mkdirSync(join(fakeRoot, "scripts"), { recursive: true });
    copyFileSync(SCRIPT, join(fakeRoot, "scripts", "audit-font-chain.sh"));
    writeFileSync(join(fakeRoot, "gallery.html"), FULL_GALLERY_HTML, "utf8");
    // Initialise a bare git repo so git rev-parse works inside fakeRoot
    spawnSync("git", ["-C", fakeRoot, "init", "--quiet"], { encoding: "utf8" });
    // Do NOT create .claude/visual-diffs/soul-atlas/manifest.json

    const result = spawnSync(
      "bash",
      [join(fakeRoot, "scripts", "audit-font-chain.sh")],
      {
        encoding: "utf8",
        timeout: 15_000,
        cwd: fakeRoot,
        env: {
          ...process.env,
          GALLERY_PATH: join(fakeRoot, "gallery.html"),
        },
      }
    );

    assert.equal(
      result.status,
      2,
      `expected exit 2 (SKIP) when manifest is absent, got ${result.status}`
    );
  } finally {
    tmp.cleanup();
  }
});

// ─── scenario (g): gallery not found when manifest exists → exit 3 ──────────

test("(g) gallery.html not found when manifest exists → exit 3", () => {
  const tmp = makeTmpDir();
  try {
    const fakeRoot = join(tmp.dir, "fake-root-g");
    mkdirSync(join(fakeRoot, ".git"), { recursive: true });
    mkdirSync(join(fakeRoot, "scripts"), { recursive: true });
    mkdirSync(join(fakeRoot, ".claude", "visual-diffs", "soul-atlas"), {
      recursive: true,
    });
    spawnSync("git", ["-C", fakeRoot, "init", "--quiet"], { encoding: "utf8" });
    copyFileSync(SCRIPT, join(fakeRoot, "scripts", "audit-font-chain.sh"));
    writeFileSync(
      join(fakeRoot, ".claude", "visual-diffs", "soul-atlas", "manifest.json"),
      STUB_MANIFEST,
      "utf8"
    );
    // Do NOT create gallery.html

    const result = spawnSync(
      "bash",
      [join(fakeRoot, "scripts", "audit-font-chain.sh")],
      {
        encoding: "utf8",
        timeout: 15_000,
        cwd: fakeRoot,
      }
    );

    assert.equal(
      result.status,
      3,
      `expected exit 3 when gallery is absent but manifest exists, got ${result.status}`
    );
  } finally {
    tmp.cleanup();
  }
});

// ─── scenario (h): drift gate wiring ────────────────────────────────────────

test("(h) audit-soul-atom-drift.sh propagates font-chain exit 1 → drift exits 1", () => {
  const tmp = makeTmpDir();
  try {
    const fakeRoot = join(tmp.dir, "fake-root-h");
    mkdirSync(join(fakeRoot, ".git"), { recursive: true });
    mkdirSync(join(fakeRoot, "scripts"), { recursive: true });
    mkdirSync(join(fakeRoot, ".claude", "visual-diffs", "soul-atlas"), {
      recursive: true,
    });
    mkdirSync(join(fakeRoot, "app"), { recursive: true });
    spawnSync("git", ["-C", fakeRoot, "init", "--quiet"], { encoding: "utf8" });

    copyFileSync(DRIFT_SCRIPT, join(fakeRoot, "scripts", "audit-soul-atom-drift.sh"));
    copyFileSync(SCRIPT, join(fakeRoot, "scripts", "audit-font-chain.sh"));

    // Minimal globals.css
    writeFileSync(
      join(fakeRoot, "app", "globals.css"),
      ":root { --accent-orange: #D4602A; --paper-base: #E8E2D5; }",
      "utf8"
    );

    // Minimal manifest with no token_refs (C1 passes; C1b fails from broken gallery)
    writeFileSync(
      join(fakeRoot, ".claude", "visual-diffs", "soul-atlas", "manifest.json"),
      JSON.stringify({
        schema_version: 2,
        atoms: [
          {
            id: "test",
            name: "Test",
            token_refs: [],
            main_branch_refs: [],
          },
        ],
      }),
      "utf8"
    );

    // Gallery with no font-chain bindings — this makes font-chain exit 1
    let noFonts = withoutBinding(FULL_GALLERY_HTML, "--font-display");
    noFonts = withoutBinding(noFonts, "--font-mono");
    noFonts = withoutBinding(noFonts, "--font-type");
    writeFileSync(
      join(fakeRoot, ".claude", "visual-diffs", "soul-atlas", "gallery.html"),
      noFonts,
      "utf8"
    );

    const { status } = runDrift(fakeRoot);

    assert.equal(
      status,
      1,
      `expected drift to exit 1 when font-chain fails, got ${status}`
    );
  } finally {
    tmp.cleanup();
  }
});

// ─── (real) production gallery passes audit-font-chain.sh ───────────────────

test("(real) production gallery.html passes audit-font-chain.sh", () => {
  const { status, stdout, stderr } = runFontChain({
    GALLERY_PATH: REAL_GALLERY,
    MANIFEST_PATH: REAL_MANIFEST,
  });

  assert.equal(
    status,
    0,
    `REGRESSION: production gallery.html failed font-chain check (exit ${status}). output: ${stdout + stderr}`
  );
});

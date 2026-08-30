/**
 * CI / harness repair regressions.
 *
 * Contract assumptions while Canopus's CI runner contract is pending:
 *
 * - .harness/worldline-harness.config.json is the authoritative rail census.
 * - Every rail with status "enforcing" is in the CI denominator, even when a
 *   runtime prerequisite is unavailable. An unavailable required rail must
 *   produce an explicit SKIP or ERROR result; omission is not coverage.
 * - CI covers a rail either by invoking its configured check (including an
 *   npm-script expansion) or by invoking the config-driven
 *   scripts/audit-harness-ci.sh runner (or legacy .claude/hooks/harness-check.sh),
 *   whose observable contract is to iterate the configured rails.
 * - PASS, SKIP, and FAIL are distinct per-rail outcomes. An aggregate FAIL may
 *   contain PASS and SKIP records, but it must not erase either record.
 *
 * The fixtures below are all temporary copies. They never rewrite a tracked
 * source file, workflow, config, or audit script in place.
 */

import assert from "node:assert/strict";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import test from "node:test";

const REPO_ROOT = resolve(import.meta.dirname ?? new URL(".", import.meta.url).pathname, "../..");
const CI_WORKFLOW = join(REPO_ROOT, ".github", "workflows", "ci.yml");
const WORLDLINE_CONFIG = join(REPO_ROOT, ".harness", "worldline-harness.config.json");
const PACKAGE_JSON = join(REPO_ROOT, "package.json");
const SOUL_ATOM_SHELL = join(REPO_ROOT, "scripts", "audit-soul-atom-drift.sh");
const AUDIT_HARNESS_CI = join(REPO_ROOT, "scripts", "audit-harness-ci.sh");
const HARNESS_CHECK = join(REPO_ROOT, ".claude", "hooks", "harness-check.sh");

function writeFixture(root, relativePath, content, executable = false) {
  const fullPath = join(root, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf8");
  if (executable) chmodSync(fullPath, 0o755);
  return fullPath;
}

function copyExecutable(source, destination) {
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  chmodSync(destination, 0o755);
  return destination;
}

function makeTempGitRepo(prefix) {
  const root = mkdtempSync(join(tmpdir(), `worldline-${prefix}-`));
  const git = spawnSync("git", ["init", "--quiet"], { cwd: root, encoding: "utf8" });
  assert.equal(git.status, 0, `could not initialise temporary fixture repo: ${git.stderr}`);
  return root;
}

function removeTempRepo(root) {
  rmSync(root, { recursive: true, force: true });
}

function isInsideRepo(path) {
  const repoPrefix = REPO_ROOT.endsWith(sep) ? REPO_ROOT : `${REPO_ROOT}${sep}`;
  return path === REPO_ROOT || path.startsWith(repoPrefix);
}

test("temporary fixture repositories stay outside the lint-scanned worktree", () => {
  const root = makeTempGitRepo("location-regression");

  try {
    assert.equal(isInsideRepo(root), false, `fixture must use the OS temp directory, received: ${root}`);
  } finally {
    removeTempRepo(root);
  }
});

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: "utf8",
    timeout: options.timeout ?? 30_000,
  });

  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function combinedOutput(result) {
  return `${result.stdout}\n${result.stderr}`;
}

function createSoulAtomFixture({ auditPayload, auditExit }) {
  const root = makeTempGitRepo("soul-shell");
  const shell = copyExecutable(SOUL_ATOM_SHELL, join(root, "scripts", "audit-soul-atom-drift.sh"));

  writeFixture(
    root,
    "scripts/audit-font-chain.sh",
    "#!/usr/bin/env bash\n# fixture dependency: the shell seam is under test\nexit 0\n",
    true,
  );
  writeFixture(
    root,
    ".claude/visual-diffs/soul-atlas/manifest.json",
    JSON.stringify({ schema_version: 1, atoms: [] }) + "\n",
  );
  writeFixture(
    root,
    ".claude/visual-diffs/soul-atlas/gallery.html",
    `<!doctype html>
<html><head><style>:root {
  --font-display: serif;
  --font-mono: monospace;
  --font-type: monospace;
}</style></head><body></body></html>
`,
  );
  writeFixture(root, "app/globals.css", ":root {}\n");

  // The wrapper deliberately invokes `npx tsx`. A local fake npx keeps this
  // regression hermetic while still exercising the wrapper's exit handling.
  writeFixture(
    root,
    "bin/npx",
    `#!/usr/bin/env bash
set -u
if [[ "\${1:-}" != "tsx" ]]; then
  echo "fixture npx only supports tsx" >&2
  exit 127
fi
shift
exec node "$@"
`,
    true,
  );
  const fakeAudit = writeFixture(
    root,
    "fake-audit.mjs",
    `console.log(${JSON.stringify(JSON.stringify(auditPayload))});
process.exit(${auditExit});
`,
  );

  return {
    root,
    shell,
    fakeAudit,
    runAudit() {
      const path = join(root, "bin") + (process.platform === "win32" ? ";" : ":") + (process.env.PATH ?? "");
      return run("bash", [shell], {
        cwd: root,
        env: {
          PATH: path,
          CLAUDE_TASK_ID: "fixture-ci-repair",
          WL_TS_AUDIT_OVERRIDE: fakeAudit,
        },
      });
    },
  };
}

test("soul-atom shell surfaces a TypeScript audit exit 1 as a structured FAIL", () => {
  const fixture = createSoulAtomFixture({
    auditExit: 1,
    auditPayload: {
      pass: false,
      atoms_checked: 0,
      violations: [{ atom_id: "fixture-atom", violation: "uncited-literal", gallery_loc: "fixture:1", detail: "fixture violation" }],
      warnings: [],
    },
  });

  try {
    const result = fixture.runAudit();
    const output = combinedOutput(result);
    const log = readFileSync(join(fixture.root, ".claude", "hook-logs", "fixture-ci-repair--soul-atom-drift.log"), "utf8");

    assert.equal(result.status, 1, `expected gate exit 1; output:\n${output}`);
    assert.match(output, /FAIL — 1 violation\(s\) found/, "the shell must expose the TS failure summary");
    assert.match(output, /atom=fixture-atom/, "the shell must expose the structured violation identity");
    assert.match(log, /fixture violation/, "the TS audit output must be retained in the hook log");
  } finally {
    removeTempRepo(fixture.root);
  }
});

test("soul-atom shell preserves PASS for a clean TypeScript audit", () => {
  const fixture = createSoulAtomFixture({
    auditExit: 0,
    auditPayload: { pass: true, atoms_checked: 0, violations: [], warnings: [] },
  });

  try {
    const result = fixture.runAudit();
    assert.equal(result.status, 0, `expected gate exit 0; output:\n${combinedOutput(result)}`);
    assert.match(combinedOutput(result), /PASS — 0 atoms verified/);
  } finally {
    removeTempRepo(fixture.root);
  }
});

function createHarnessStatusFixture() {
  const root = makeTempGitRepo("harness-status");
  const hook = copyExecutable(HARNESS_CHECK, join(root, ".claude", "hooks", "harness-check.sh"));

  writeFixture(root, "scripts/pass-check.sh", "#!/usr/bin/env bash\necho 'fixture pass'\nexit 0\n", true);
  writeFixture(root, "scripts/fail-check.sh", "#!/usr/bin/env bash\necho 'fixture fail'\nexit 1\n", true);
  writeFixture(root, "changed-files.txt", "src/changed.ts\n");
  writeFixture(
    root,
    ".harness/worldline-harness.config.json",
    JSON.stringify({
      rails: {
        "pass-rail": { check: "scripts/pass-check.sh", applies_to: ["src/**"] },
        "skip-rail": { check: "scripts/not-scheduled.sh", applies_to: ["docs/**"] },
        "fail-rail": { check: "scripts/fail-check.sh", applies_to: ["src/**"] },
      },
    }) + "\n",
  );

  return {
    root,
    hook,
    changedFiles: join(root, "changed-files.txt"),
    runHarness() {
      return run("bash", [hook, "--changed-files", join(root, "changed-files.txt")], {
        cwd: root,
        env: { WL_TASK_ID: "fixture-status" },
      });
    },
  };
}

test("harness runner keeps PASS, SKIP, and FAIL outcomes distinguishable", () => {
  const fixture = createHarnessStatusFixture();

  try {
    const result = fixture.runHarness();
    const output = combinedOutput(result);

    assert.equal(result.status, 1, `the failing rail must make the aggregate non-zero; output:\n${output}`);
    assert.match(output, /\[pass\] pass-rail :: fixture pass/);
    assert.match(output, /\[skip\] skip-rail :: check script not applicable to changed files/);
    assert.match(output, /\[FAIL\] fail-rail :: fixture fail/);
    assert.deepEqual(
      [...output.matchAll(/^\s+\[(pass|skip|FAIL)\]/gm)].map((match) => match[1]).sort(),
      ["FAIL", "pass", "skip"],
      "each configured outcome must retain its own status label",
    );
  } finally {
    removeTempRepo(fixture.root);
  }
});

function createHarnessCiFixture() {
  const root = makeTempGitRepo("harness-ci");
  const runner = copyExecutable(AUDIT_HARNESS_CI, join(root, "scripts", "audit-harness-ci.sh"));
  const configPath = writeFixture(
    root,
    ".harness/worldline-harness.config.json",
    JSON.stringify({
      rails: {
        "zeta-skip": {
          status: "enforcing",
          check: "scripts/not-run.sh",
          ci: {
            required: false,
            disposition: "skip",
            deterministic: true,
            reason: "fixture intentionally deferred",
            args: [],
            requires: { commands: [], paths: [] },
          },
        },
        "alpha-pass": {
          status: "enforcing",
          check: "scripts/pass-check.sh",
          ci: {
            required: true,
            disposition: "run",
            deterministic: true,
            reason: "",
            args: [],
            requires: { commands: [], paths: [] },
          },
        },
      },
    }) + "\n",
  );
  writeFixture(root, "scripts/pass-check.sh", "#!/usr/bin/env bash\nprintf '%s\\n' 'fixture pass'\n", true);

  return {
    root,
    runner,
    configPath,
    runAudit() {
      return run("bash", [runner], {
        cwd: root,
        env: { WORLDLINE_HARNESS_CONFIG: configPath },
      });
    },
  };
}

test("audit-harness-ci emits deterministic JSONL for every configured rail", () => {
  assert.match(
    readFileSync(AUDIT_HARNESS_CI, "utf8"),
    /\.rails\s*\|\s*keys\[\]/,
    "audit-harness-ci must enumerate the authoritative rail keys",
  );

  const fixture = createHarnessCiFixture();

  try {
    const first = fixture.runAudit();
    const second = fixture.runAudit();

    assert.equal(first.status, 0, `PASS plus non-required SKIP must aggregate PASS; output:\n${first.stdout}\n${first.stderr}`);
    assert.equal(first.stderr, "", "a clean fixture census must keep diagnostics off stderr");
    assert.equal(second.status, 0);
    assert.equal(second.stdout, first.stdout, "the same config must produce byte-stable JSONL");
    assert.notEqual(first.stdout.trim(), "", "a successful census must emit JSONL records");
    const records = first.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));

    assert.equal(records.length, 3, "two configured rails require two rail records plus one summary record");
    assert.deepEqual(
      records.map(({ rail }) => rail),
      ["alpha-pass", "zeta-skip", "__summary__"],
      "rail records must be stable and include every configured key",
    );
    assert.deepEqual(
      records.slice(0, 2).map(({ type, status, required }) => ({ type, status, required })),
      [
        { type: "rail", status: "PASS", required: true },
        { type: "rail", status: "SKIP", required: false },
      ],
    );
    assert.deepEqual(
      records[2],
      {
        type: "summary",
        rail: "__summary__",
        status: "PASS",
        required: true,
        check: "",
        reason: "config-driven CI census complete",
        exit_code: 0,
        rails: 2,
        pass: 1,
        skip: 1,
        fail: 0,
        error: 0,
        required_failures: 0,
      },
    );
  } finally {
    removeTempRepo(fixture.root);
  }
});

function extractWorkflowRunBodies(source) {
  const lines = source.split(/\r?\n/);
  const bodies = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*#/.test(line)) continue;

    const match = line.match(/^(\s*)run:\s*(.*)$/);
    if (!match) continue;

    const baseIndent = match[1].length;
    const firstValue = match[2].trim();
    const block = [];

    if (/^[|>]\+?-?[0-9]*$/.test(firstValue)) {
      for (let next = index + 1; next < lines.length; next += 1) {
        const nextLine = lines[next];
        if (nextLine.trim() === "") {
          block.push("");
          continue;
        }
        const nextIndent = nextLine.match(/^\s*/)[0].length;
        if (nextIndent <= baseIndent) {
          index = next - 1;
          break;
        }
        block.push(nextLine.trim());
        index = next;
      }
    } else {
      block.push(firstValue);
    }

    bodies.push(block.filter((entry) => !/^\s*#/.test(entry)).join("\n"));
  }

  return bodies;
}

function expandNpmScripts(commandBodies, scripts) {
  let expanded = commandBodies.join("\n");

  for (let pass = 0; pass < 12; pass += 1) {
    const before = expanded;
    expanded = expanded.replace(/\bnpm\s+run\s+([A-Za-z0-9:_-]+)/g, (whole, name) => {
      if (!Object.prototype.hasOwnProperty.call(scripts, name)) return whole;
      return scripts[name];
    });
    if (expanded === before) break;
  }

  return expanded;
}

test("CI census includes every configured enforcing worldline rail", () => {
  const config = JSON.parse(readFileSync(WORLDLINE_CONFIG, "utf8"));
  const packageJson = JSON.parse(readFileSync(PACKAGE_JSON, "utf8"));
  const workflowBodies = extractWorkflowRunBodies(readFileSync(CI_WORKFLOW, "utf8"));
  const effectiveCommands = expandNpmScripts(workflowBodies, packageJson.scripts ?? {});
  const enforcingRails = Object.entries(config.rails).filter(([, rail]) => rail.status === "enforcing");
  const configDrivenRunners = [
    {
      path: AUDIT_HARNESS_CI,
      command: "scripts/audit-harness-ci.sh",
      sourcePattern: /\.rails\s*\|\s*keys\[\]/,
      description: "audit-harness-ci",
    },
    {
      path: HARNESS_CHECK,
      command: ".claude/hooks/harness-check.sh",
      sourcePattern: /\.rails\s*\|\s*to_entries\[\]/,
      description: "legacy harness-check",
    },
  ];
  const configDrivenRunner = configDrivenRunners.find(({ command }) => effectiveCommands.includes(command));
  const usesConfigDrivenRunner = Boolean(configDrivenRunner);

  if (configDrivenRunner) {
    assert.match(
      readFileSync(configDrivenRunner.path, "utf8"),
      configDrivenRunner.sourcePattern,
      `${configDrivenRunner.description} must enumerate configured rails rather than a private list`,
    );
  }

  const missing = enforcingRails
    .filter(([, rail]) => !usesConfigDrivenRunner && !effectiveCommands.includes(rail.check))
    .map(([name, rail]) => `${name} (${rail.check})`)
    .sort();

  assert.equal(
    missing.length,
    0,
    [
      "CI sensor census is incomplete; configured enforcing rails were omitted:",
      ...missing.map((entry) => `  - ${entry}`),
      "Each rail must be invoked directly/transitively or included by the config-driven runner.",
    ].join("\n"),
  );
});

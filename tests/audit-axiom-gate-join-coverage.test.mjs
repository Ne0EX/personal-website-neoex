/**
 * tests/audit-axiom-gate-join-coverage.test.mjs
 *
 * Regression tests for scripts/audit-axiom-gate-join-coverage.ts
 * Owner: Algol (α-VER-06) — TASK-2026-05-30-HARNESS-IS-OUGHT-SEPARATOR (Wave B Phase 3a)
 *
 * Run with:
 *   node --test tests/audit-axiom-gate-join-coverage.test.mjs
 *
 * Pattern: node --test + spawnSync, matching soul-atom-drift-audit.test.mjs.
 *
 * Tests cover:
 *   1. PROJECTED axiom with enforcing gate → GREEN
 *   2. UNPROJECTED axiom within must_project_by window → GREEN
 *   3. UNPROJECTED axiom PAST must_project_by → RED (reason: UNPROJECTED_PAST_DATE)
 *   4. UNPROJECTED axiom with no must_project_by → RED (placeholder discipline)
 *   5. Gate with no axiom trace and not derived-is → RED ORPHAN
 *   6. Gate with no axiom trace but in derived-is list → GREEN
 *   7. PROJECTED axiom with zero projects_to → RED
 *   8. PROJECTED axiom whose named gate is stub-only → RED
 *   9. Coverage assertion: audit visits all N axioms and all M gates
 *  10. BLOCKED axiom within block_until → GREEN
 *  11. BLOCKED axiom past block_until → RED
 *  12. BLOCKED axiom with no block_until → RED
 *  13. pass=true only when all axioms + gates are GREEN; exit 0
 *  14. pass=false when any RED; exit 1
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const REPO_ROOT = resolve(import.meta.dirname ?? new URL(".", import.meta.url).pathname, "..");
const AUDIT_TS = join(REPO_ROOT, "scripts", "audit-axiom-gate-join-coverage.ts");

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

function makeTmpDir() {
  const dir = mkdtempSync(join(tmpdir(), "join-coverage-test-"));
  return {
    dir,
    write(relPath, content) {
      const full = join(dir, relPath);
      const parentDir = full.substring(0, full.lastIndexOf("/"));
      mkdirSync(parentDir, { recursive: true });
      writeFileSync(full, content, "utf8");
      return full;
    },
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Build a minimal registry JSON string. */
function buildRegistry(axioms) {
  return JSON.stringify({
    schema_version: 1,
    registry_id: "axioms-v1",
    signed_by: "Peat",
    signed_date: "2026-05-30",
    axioms,
  });
}

/** Build a minimal harness config JSON string. */
function buildConfig(rails) {
  return JSON.stringify({
    config_version: 1,
    rails,
    signature_policy: {},
  });
}

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const ENFORCING_GATE = {
  description: "test enforcing gate",
  check: "scripts/check.sh",
  applies_to: ["**/*"],
  status: "enforcing",
};

const STUB_GATE = {
  description: "test stub gate",
  check: "scripts/check.sh",
  applies_to: ["**/*"],
  status: "stub",
};

// ─── Test 1: PROJECTED axiom with enforcing gate → GREEN ─────────────────────

test("PROJECTED axiom with enforcing gate is GREEN", () => {
  const tmp = makeTmpDir();
  try {
    const registryPath = tmp.write("axioms.json", buildRegistry([
      {
        id: "V1",
        tier: "value",
        statement: "We care about low-vision accessibility.",
        projects_to: ["a11y-gate"],
        owner: "Algol",
        signed_by: "Peat",
        signed_date: "2026-05-30",
        status: "PROJECTED",
      },
    ]));
    const configPath = tmp.write("harness.json", buildConfig({
      "a11y-gate": ENFORCING_GATE,
    }));

    const { stdout, status } = runAudit({
      registry_path: registryPath,
      harness_config_path: configPath,
      today: "2026-05-30",
    });

    assert.equal(status, 0, `expected exit 0. stderr/stdout: ${stdout}`);
    const out = JSON.parse(stdout);
    assert.equal(out.pass, true);
    assert.equal(out.summary.red_axioms, 0);
    const v1 = out.axiom_verdicts.find((v) => v.id === "V1");
    assert.ok(v1, "expected V1 verdict");
    assert.equal(v1.verdict, "GREEN");
  } finally {
    tmp.cleanup();
  }
});

// ─── Test 2: UNPROJECTED within window → GREEN ────────────────────────────────

test("UNPROJECTED axiom within must_project_by window is GREEN", () => {
  const tmp = makeTmpDir();
  try {
    const registryPath = tmp.write("axioms.json", buildRegistry([
      {
        id: "C1",
        tier: "convention",
        statement: "WCAG 2.2 AA (4.5:1 normal text).",
        realizes: ["V1"],
        projects_to: [],
        owner: "Algol+Canopus",
        signed_by: "Peat",
        signed_date: "2026-05-30",
        status: "UNPROJECTED",
        must_project_by: "2026-05-31",
      },
    ]));
    const configPath = tmp.write("harness.json", buildConfig({}));

    const { stdout, status } = runAudit({
      registry_path: registryPath,
      harness_config_path: configPath,
      today: "2026-05-30",
    });

    assert.equal(status, 0, `expected exit 0. stdout: ${stdout}`);
    const out = JSON.parse(stdout);
    assert.equal(out.pass, true);
    const c1 = out.axiom_verdicts.find((v) => v.id === "C1");
    assert.ok(c1, "expected C1 verdict");
    assert.equal(c1.verdict, "GREEN");
  } finally {
    tmp.cleanup();
  }
});

// ─── Test 3: UNPROJECTED PAST must_project_by → RED ──────────────────────────

test("UNPROJECTED axiom past must_project_by is RED with UNPROJECTED_PAST_DATE", () => {
  const tmp = makeTmpDir();
  try {
    const registryPath = tmp.write("axioms.json", buildRegistry([
      {
        id: "C1",
        tier: "convention",
        statement: "WCAG 2.2 AA (4.5:1 normal text).",
        projects_to: [],
        owner: "Algol",
        signed_by: "Peat",
        signed_date: "2026-05-30",
        status: "UNPROJECTED",
        must_project_by: "2026-05-31",
      },
    ]));
    const configPath = tmp.write("harness.json", buildConfig({}));

    // Run audit with today = 2026-06-01 (one day PAST must_project_by)
    const { stdout, status } = runAudit({
      registry_path: registryPath,
      harness_config_path: configPath,
      today: "2026-06-01",
    });

    assert.equal(status, 1, `expected exit 1 (RED). stdout: ${stdout}`);
    const out = JSON.parse(stdout);
    assert.equal(out.pass, false);
    assert.equal(out.summary.red_axioms, 1);
    const c1 = out.axiom_verdicts.find((v) => v.id === "C1");
    assert.ok(c1, "expected C1 verdict");
    assert.equal(c1.verdict, "RED");
    assert.equal(c1.reason_code, "UNPROJECTED_PAST_DATE", `expected reason code UNPROJECTED_PAST_DATE, got ${c1.reason_code}`);
    // Error message must name the must_project_by date (Step 7b attribution honesty)
    assert.ok(
      c1.detail.includes("2026-05-31"),
      `detail must name must_project_by date. detail: ${c1.detail}`
    );
  } finally {
    tmp.cleanup();
  }
});

// ─── Test 4: UNPROJECTED with no must_project_by → RED ───────────────────────

test("UNPROJECTED axiom with no must_project_by date is RED (placeholder discipline)", () => {
  const tmp = makeTmpDir();
  try {
    const registryPath = tmp.write("axioms.json", buildRegistry([
      {
        id: "V2",
        tier: "value",
        statement: "Visual fidelity is a release gate.",
        projects_to: [],
        owner: "Algol",
        signed_by: "Peat",
        signed_date: "2026-05-30",
        status: "UNPROJECTED",
        // No must_project_by — placeholder discipline violation
      },
    ]));
    const configPath = tmp.write("harness.json", buildConfig({}));

    const { stdout, status } = runAudit({
      registry_path: registryPath,
      harness_config_path: configPath,
      today: "2026-05-30",
    });

    assert.equal(status, 1, `expected exit 1 (RED). stdout: ${stdout}`);
    const out = JSON.parse(stdout);
    assert.equal(out.pass, false);
    const v2 = out.axiom_verdicts.find((v) => v.id === "V2");
    assert.ok(v2, "expected V2 verdict");
    assert.equal(v2.verdict, "RED", "no must_project_by must be RED");
    // Detail must mention the missing field (Step 7b)
    assert.ok(
      v2.detail.includes("must_project_by"),
      `detail must mention must_project_by. detail: ${v2.detail}`
    );
  } finally {
    tmp.cleanup();
  }
});

// ─── Test 5: Gate orphan (no axiom trace, not derived-is) → RED ──────────────

test("gate with no axiom trace and not in derived-is list is RED ORPHAN", () => {
  const tmp = makeTmpDir();
  try {
    const registryPath = tmp.write("axioms.json", buildRegistry([
      {
        id: "V1",
        tier: "value",
        statement: "Low-vision care.",
        projects_to: ["a11y-gate"],
        owner: "Algol",
        signed_by: "Peat",
        signed_date: "2026-05-30",
        status: "PROJECTED",
      },
    ]));
    // config has an EXTRA gate "mystery-gate" that no axiom points to
    const configPath = tmp.write("harness.json", buildConfig({
      "a11y-gate": ENFORCING_GATE,
      "mystery-gate": ENFORCING_GATE,
    }));

    const { stdout, status } = runAudit({
      registry_path: registryPath,
      harness_config_path: configPath,
      today: "2026-05-30",
    });

    assert.equal(status, 1, `expected exit 1 (orphan gate). stdout: ${stdout}`);
    const out = JSON.parse(stdout);
    assert.equal(out.pass, false);
    const orphan = out.gate_verdicts.find((g) => g.gate_id === "mystery-gate");
    assert.ok(orphan, "expected mystery-gate verdict");
    assert.equal(orphan.verdict, "RED");
    assert.equal(orphan.reason_code, "GATE_ORPHAN");
    assert.ok(
      orphan.detail.includes("mystery-gate"),
      `detail must name the orphan gate. detail: ${orphan.detail}`
    );
  } finally {
    tmp.cleanup();
  }
});

// ─── Test 6: Derived-is gate (no axiom, but in derived-is) → GREEN ───────────

test("gate in derived-is list (e.g. 'territory') is GREEN without axiom trace", () => {
  const tmp = makeTmpDir();
  try {
    const registryPath = tmp.write("axioms.json", buildRegistry([
      {
        id: "V1",
        tier: "value",
        statement: "Low-vision care.",
        projects_to: ["a11y-gate"],
        owner: "Algol",
        signed_by: "Peat",
        signed_date: "2026-05-30",
        status: "PROJECTED",
      },
    ]));
    // 'territory' is in DERIVED_IS_GATES in the audit script
    const configPath = tmp.write("harness.json", buildConfig({
      "a11y-gate": ENFORCING_GATE,
      "territory": ENFORCING_GATE,
    }));

    const { stdout, status } = runAudit({
      registry_path: registryPath,
      harness_config_path: configPath,
      today: "2026-05-30",
    });

    assert.equal(status, 0, `expected exit 0 (territory is derived-is). stdout: ${stdout}`);
    const out = JSON.parse(stdout);
    assert.equal(out.pass, true);
    const territoryGate = out.gate_verdicts.find((g) => g.gate_id === "territory");
    assert.ok(territoryGate, "expected territory gate verdict");
    assert.equal(territoryGate.verdict, "GREEN");
  } finally {
    tmp.cleanup();
  }
});

// ─── Test 7: PROJECTED with empty projects_to → RED ──────────────────────────

test("PROJECTED axiom with empty projects_to is RED", () => {
  const tmp = makeTmpDir();
  try {
    const registryPath = tmp.write("axioms.json", buildRegistry([
      {
        id: "V1",
        tier: "value",
        statement: "Low-vision care.",
        projects_to: [],  // empty — PROJECTED but no gate named
        owner: "Algol",
        signed_by: "Peat",
        signed_date: "2026-05-30",
        status: "PROJECTED",
      },
    ]));
    const configPath = tmp.write("harness.json", buildConfig({}));

    const { stdout, status } = runAudit({
      registry_path: registryPath,
      harness_config_path: configPath,
      today: "2026-05-30",
    });

    assert.equal(status, 1, `expected exit 1. stdout: ${stdout}`);
    const out = JSON.parse(stdout);
    const v1 = out.axiom_verdicts.find((v) => v.id === "V1");
    assert.ok(v1, "expected V1 verdict");
    assert.equal(v1.verdict, "RED");
    assert.equal(v1.reason_code, "GATE_MISSING");
  } finally {
    tmp.cleanup();
  }
});

// ─── Test 8: PROJECTED but named gate is stub → RED ──────────────────────────

test("PROJECTED axiom whose projects_to gate is stub-only is RED", () => {
  const tmp = makeTmpDir();
  try {
    const registryPath = tmp.write("axioms.json", buildRegistry([
      {
        id: "C1",
        tier: "convention",
        statement: "WCAG 2.2 AA.",
        realizes: ["V1"],
        projects_to: ["accessibility-floor"],
        owner: "Algol",
        signed_by: "Peat",
        signed_date: "2026-05-30",
        status: "PROJECTED",
      },
    ]));
    const configPath = tmp.write("harness.json", buildConfig({
      "accessibility-floor": STUB_GATE,  // stub — not enforcing
    }));

    const { stdout, status } = runAudit({
      registry_path: registryPath,
      harness_config_path: configPath,
      today: "2026-05-30",
    });

    assert.equal(status, 1, `expected exit 1 (stub gate). stdout: ${stdout}`);
    const out = JSON.parse(stdout);
    const c1 = out.axiom_verdicts.find((v) => v.id === "C1");
    assert.ok(c1, "expected C1 verdict");
    assert.equal(c1.verdict, "RED");
    assert.equal(c1.reason_code, "GATE_MISSING");
    // Detail must name the stub status (Step 7b)
    assert.ok(
      c1.detail.includes("stub") || c1.detail.includes("accessibility-floor"),
      `detail must mention stub or gate name. detail: ${c1.detail}`
    );
  } finally {
    tmp.cleanup();
  }
});

// ─── Test 9: Coverage assertion — all N axioms and M gates visited ────────────

test("coverage assertion: checked_axioms equals registry.axioms.length and checked_gates equals config.rails length", () => {
  const tmp = makeTmpDir();
  try {
    const registryPath = tmp.write("axioms.json", buildRegistry([
      {
        id: "V1", tier: "value", statement: "Low-vision.", projects_to: ["g1"],
        owner: "Algol", signed_by: "Peat", signed_date: "2026-05-30", status: "PROJECTED",
      },
      {
        id: "C1", tier: "convention", statement: "WCAG AA.", realizes: ["V1"], projects_to: ["g1"],
        owner: "Algol", signed_by: "Peat", signed_date: "2026-05-30", status: "PROJECTED",
      },
      {
        id: "H1", tier: "harness", statement: "Gates must be anchored.",
        projects_to: ["g2"], owner: "Canopus", signed_by: "Canopus",
        signed_date: "2026-05-30", status: "PROJECTED",
      },
    ]));
    const configPath = tmp.write("harness.json", buildConfig({
      "g1": ENFORCING_GATE,
      "g2": ENFORCING_GATE,
      // g2 is covered by H1; g1 is covered by V1+C1; no orphans
    }));

    const { stdout, status } = runAudit({
      registry_path: registryPath,
      harness_config_path: configPath,
      today: "2026-05-30",
    });

    assert.equal(status, 0, `expected exit 0. stdout: ${stdout}`);
    const out = JSON.parse(stdout);
    // Coverage assertions
    assert.equal(out.checked_axioms, 3, `expected 3 axioms checked, got ${out.checked_axioms}`);
    assert.equal(out.checked_gates, 2, `expected 2 gates checked, got ${out.checked_gates}`);
    assert.equal(out.coverage_assertion.axioms_ok, true);
    assert.equal(out.coverage_assertion.gates_ok, true);
  } finally {
    tmp.cleanup();
  }
});

// ─── Test 10: BLOCKED within block_until → GREEN ─────────────────────────────

test("BLOCKED axiom within block_until window is GREEN", () => {
  const tmp = makeTmpDir();
  try {
    const registryPath = tmp.write("axioms.json", buildRegistry([
      {
        id: "V2",
        tier: "value",
        statement: "Render fidelity gate.",
        projects_to: [],
        owner: "Algol",
        signed_by: "Peat",
        signed_date: "2026-05-30",
        status: "BLOCKED",
        block_until: "2026-05-31",
        blocked_on: "Canopus-Wave-B",
      },
    ]));
    const configPath = tmp.write("harness.json", buildConfig({}));

    const { stdout, status } = runAudit({
      registry_path: registryPath,
      harness_config_path: configPath,
      today: "2026-05-30",
    });

    assert.equal(status, 0, `expected exit 0 (BLOCKED within window). stdout: ${stdout}`);
    const out = JSON.parse(stdout);
    assert.equal(out.pass, true);
    const v2 = out.axiom_verdicts.find((v) => v.id === "V2");
    assert.ok(v2, "expected V2 verdict");
    assert.equal(v2.verdict, "GREEN");
  } finally {
    tmp.cleanup();
  }
});

// ─── Test 11: BLOCKED past block_until → RED ─────────────────────────────────

test("BLOCKED axiom past block_until is RED", () => {
  const tmp = makeTmpDir();
  try {
    const registryPath = tmp.write("axioms.json", buildRegistry([
      {
        id: "V2",
        tier: "value",
        statement: "Render fidelity gate.",
        projects_to: [],
        owner: "Algol",
        signed_by: "Peat",
        signed_date: "2026-05-30",
        status: "BLOCKED",
        block_until: "2026-05-29",  // already past
        blocked_on: "Canopus-Wave-B",
      },
    ]));
    const configPath = tmp.write("harness.json", buildConfig({}));

    const { stdout, status } = runAudit({
      registry_path: registryPath,
      harness_config_path: configPath,
      today: "2026-05-30",
    });

    assert.equal(status, 1, `expected exit 1 (block expired). stdout: ${stdout}`);
    const out = JSON.parse(stdout);
    const v2 = out.axiom_verdicts.find((v) => v.id === "V2");
    assert.ok(v2, "expected V2 verdict");
    assert.equal(v2.verdict, "RED");
    assert.equal(v2.reason_code, "UNPROJECTED_PAST_DATE");
  } finally {
    tmp.cleanup();
  }
});

// ─── Test 12: BLOCKED with no block_until → RED ──────────────────────────────

test("BLOCKED axiom with no block_until is RED (permanent amber)", () => {
  const tmp = makeTmpDir();
  try {
    const registryPath = tmp.write("axioms.json", buildRegistry([
      {
        id: "H1",
        tier: "harness",
        statement: "Gate anchoring policy.",
        projects_to: [],
        owner: "Canopus",
        signed_by: "Canopus",
        signed_date: "2026-05-30",
        status: "BLOCKED",
        // No block_until — permanent amber
        blocked_on: "Wave-B",
      },
    ]));
    const configPath = tmp.write("harness.json", buildConfig({}));

    const { stdout, status } = runAudit({
      registry_path: registryPath,
      harness_config_path: configPath,
      today: "2026-05-30",
    });

    assert.equal(status, 1, `expected exit 1 (no block_until). stdout: ${stdout}`);
    const out = JSON.parse(stdout);
    const h1 = out.axiom_verdicts.find((v) => v.id === "H1");
    assert.ok(h1, "expected H1 verdict");
    assert.equal(h1.verdict, "RED");
    assert.ok(
      h1.detail.includes("block_until"),
      `detail must mention block_until. detail: ${h1.detail}`
    );
  } finally {
    tmp.cleanup();
  }
});

// ─── Test 13: All-green → pass=true, exit 0 ──────────────────────────────────

test("all GREEN → pass=true and exit 0", () => {
  const tmp = makeTmpDir();
  try {
    const registryPath = tmp.write("axioms.json", buildRegistry([
      {
        id: "V1", tier: "value", statement: "Low-vision.", projects_to: ["enforcing-gate"],
        owner: "Algol", signed_by: "Peat", signed_date: "2026-05-30", status: "PROJECTED",
      },
      {
        id: "C1", tier: "convention", statement: "WCAG AA.", realizes: ["V1"],
        projects_to: ["enforcing-gate"], owner: "Algol", signed_by: "Peat",
        signed_date: "2026-05-30", status: "PROJECTED",
      },
    ]));
    const configPath = tmp.write("harness.json", buildConfig({
      "enforcing-gate": ENFORCING_GATE,
      "territory": ENFORCING_GATE,  // derived-is
    }));

    const { stdout, status } = runAudit({
      registry_path: registryPath,
      harness_config_path: configPath,
      today: "2026-05-30",
    });

    assert.equal(status, 0, `expected exit 0. stdout: ${stdout}`);
    const out = JSON.parse(stdout);
    assert.equal(out.pass, true);
    assert.equal(out.summary.red_axioms, 0);
    assert.equal(out.summary.red_gates, 0);
  } finally {
    tmp.cleanup();
  }
});

// ─── Test 14: Any RED → pass=false, exit 1 ───────────────────────────────────

test("any RED → pass=false and exit 1", () => {
  const tmp = makeTmpDir();
  try {
    // One good axiom + one RED (UNPROJECTED past date)
    const registryPath = tmp.write("axioms.json", buildRegistry([
      {
        id: "V1", tier: "value", statement: "Low-vision.", projects_to: ["a11y-gate"],
        owner: "Algol", signed_by: "Peat", signed_date: "2026-05-30", status: "PROJECTED",
      },
      {
        id: "C5", tier: "convention", statement: "Motion buckets.",
        projects_to: [], owner: "Algol", signed_by: "Peat",
        signed_date: "2026-05-30", status: "UNPROJECTED",
        must_project_by: "2026-05-29",  // past
      },
    ]));
    const configPath = tmp.write("harness.json", buildConfig({
      "a11y-gate": ENFORCING_GATE,
    }));

    const { stdout, status } = runAudit({
      registry_path: registryPath,
      harness_config_path: configPath,
      today: "2026-05-30",
    });

    assert.equal(status, 1, `expected exit 1. stdout: ${stdout}`);
    const out = JSON.parse(stdout);
    assert.equal(out.pass, false);
    assert.equal(out.summary.red_axioms, 1, `expected 1 red axiom, got ${out.summary.red_axioms}`);
    assert.equal(out.summary.green_axioms, 1, `expected 1 green axiom, got ${out.summary.green_axioms}`);
  } finally {
    tmp.cleanup();
  }
});

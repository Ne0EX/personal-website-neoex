/**
 * audit-axiom-gate-join-coverage.ts
 *
 * Owner: Algol (α-VER-06) — TASK-2026-05-30-HARNESS-IS-OUGHT-SEPARATOR (Wave B Phase 3a)
 *
 * Purpose: enforce axiom↔gate bijection BOTH directions.
 *   Direction 1 (axiom → gate): every axiom must have ≥1 gate in `projects_to`
 *     that exists in harness config AND is non-stub, OR be within its must_project_by window.
 *     Past must_project_by with status UNPROJECTED or PARTIAL = RED.
 *   Direction 2 (gate → axiom): every gate in harness config must trace to ≥1 axiom
 *     (via projects_to) or be derivable-is (listed in DERIVED_IS_GATES below).
 *     Gates with no axiom trace and not in derived-is list = RED (orphan).
 *
 * Coverage primitive (A1.1 discipline applied at top seam):
 *   - N axioms declared → audit must visit all N → emit checked_axioms == N assertion.
 *   - M gates declared → audit must visit all M → emit checked_gates == M assertion.
 *   - If either count mismatches → audit itself is RED (coverage-assert failure).
 *
 * Structured error messages (Step 7b discipline):
 *   Every RED entry names: id, reason code, detail. Parse-able by downstream audits.
 *   Reason codes: UNPROJECTED_PAST_DATE | GATE_MISSING | GATE_ORPHAN | COVERAGE_ASSERT_FAIL
 *
 * Input (stdin, JSON):
 *   { registry_path: string, harness_config_path: string, today?: string (ISO date), verbose?: boolean }
 *
 * Output (stdout, JSON):
 *   {
 *     pass: boolean,
 *     checked_axioms: number,     // must equal registry.axioms.length
 *     checked_gates: number,      // must equal Object.keys(config.rails).length
 *     axiom_verdicts: AxiomVerdict[],
 *     gate_verdicts: GateVerdict[],
 *     coverage_assertion: { axioms_ok: boolean, gates_ok: boolean },
 *     summary: { red_axioms: number, red_gates: number, green_axioms: number, green_gates: number }
 *   }
 *
 * Exit codes:
 *   0 — bijection satisfied (all green)
 *   1 — bijection violations found (red axioms or red gates)
 *   2 — input malformed / files unreadable / coverage assertion failed
 */

import { readFileSync } from "fs";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AuditInput {
  registry_path: string;
  harness_config_path: string;
  today?: string;
  verbose?: boolean;
}

interface Axiom {
  id: string;
  tier: "value" | "convention" | "harness";
  statement: string;
  realizes?: string[];
  projects_to: string[];
  owner: string;
  signed_by: string;
  signed_date: string;
  status: "PROJECTED" | "UNPROJECTED" | "PARTIAL" | "BLOCKED";
  must_project_by?: string;
  block_until?: string;
  blocked_on?: string;
  notes?: string;
}

interface AxiomRegistry {
  schema_version: number;
  registry_id: string;
  signed_by: string;
  signed_date: string;
  axioms: Axiom[];
}

interface RailEntry {
  description: string;
  check: string;
  applies_to: string[];
  status: "enforcing" | "stub";
  rail_doc?: string;
  [key: string]: unknown;
}

interface HarnessConfig {
  rails: Record<string, RailEntry>;
  [key: string]: unknown;
}

interface AxiomVerdict {
  id: string;
  tier: string;
  status: string;
  verdict: "GREEN" | "RED";
  reason_code?: string;
  detail?: string;
}

interface GateVerdict {
  gate_id: string;
  rail_status: string;
  verdict: "GREEN" | "RED";
  backed_by: string[];  // axiom IDs that project to this gate
  reason_code?: string;
  detail?: string;
}

interface AuditOutput {
  pass: boolean;
  checked_axioms: number;
  checked_gates: number;
  axiom_verdicts: AxiomVerdict[];
  gate_verdicts: GateVerdict[];
  coverage_assertion: { axioms_ok: boolean; gates_ok: boolean };
  summary: {
    red_axioms: number;
    red_gates: number;
    green_axioms: number;
    green_gates: number;
  };
}

// ─── Derived-is gate list ───────────────────────────────────────────────────────
// Gates whose green verdict derives from element semantics + harness mechanics
// rather than from a product axiom. These are NOT orphans — they are derivable-is.
// Canopus and Algol maintain this list; changes require a signed entry in AUDIT.md.
//
// Rationale per tier:
//   territory:            derives from FILE-OWNERSHIP.md contract (descriptive, not normative product value)
//   next-16-api:          derives from Next.js version spec (factual API boundary, not product value)
//   prototype-layer:      derives from HTML-first workflow mechanics (engineering discipline, not product value)
//   prototype-production-diff: derives from render-fidelity harness need (engineering — H1 territory)
//   prototype-runtime:    derives from harness correctness (engineering — not a product axiom)
//   font-chain-presence:  derives from Tailwind v4 @theme-inline mechanics (technical constraint; bound to C4 via soul-atom-drift)
//   voice-discipline:     stub; when enforcing, derives from NETRA voice spec (not a product axiom by tier)
//   html-first-spec-discipline: derives from V3 (one-visual-language) — PROJECTED via V3.projects_to
//   accessibility-floor:  stub placeholder for C1 enforcement — exists as harness engineering scaffolding, not a live enforcement gate
//   soul-atom-drift:      derives from gallery/manifest engineering mechanics (token integrity spec); the integrity check
//                         derives from element semantics + manifest schema, not from a product value axiom directly
//   axiom-gate-join-coverage: derives from harness self-integrity (H1 territory — this gate IS the H1 realization;
//                         it cannot project to itself without circular logic; classified as derivable-is)
//   permissions-nonempty: derives from least-privilege security mechanics (OWASP ZT §Least Privilege); engineering
//                         posture enforcement, not a product-value axiom; introduced TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-1
//   least-agency-config:  derives from least-agency / tool-misuse security mechanics; wiring assertion for net-egress
//                         block + PreToolUse hook; introduced TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-1
//   audit-ground-truth-observed: derives from H1 (gate green must trace to ground-truth) — enforcement mechanic for
//                         the proxy-as-anchor failure class; introduced TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-SENSOR
//   audit-search-index-completeness: derives from build-output completeness mechanics; asserts pagefind static crawler
//                         coverage matches actual crawlable HTML; introduced TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-SENSOR
//   single-source:        derives from artifact-integrity harness mechanics — prevents divergent blob accumulation across
//                         production, prototype, and visual-diff paths; wiring enforcement, not a product-value axiom;
//                         introduced TASK-2026-06-01-SECURITY-HARNESS-WAVE-2-SINGLE-SOURCE
//   dev-clobber-guard:    derives from build-environment isolation mechanics — prevents a live 'next dev' process from
//                         clobbering .next before production build/serve; engineering posture enforcement (the incident
//                         on 2026-06-02 where the site served unstyled); not a product-value axiom;
//                         introduced TASK-2026-06-03-DEV-CLOBBER-GUARD-G1
const DERIVED_IS_GATES = new Set<string>([
  "territory",
  "next-16-api",
  "prototype-layer",
  "prototype-production-diff",
  "prototype-runtime",
  "font-chain-presence",
  "voice-discipline",
  "html-first-spec-discipline",
  "accessibility-floor",
  "soul-atom-drift",
  "axiom-gate-join-coverage",
  "permissions-nonempty",
  "least-agency-config",
  "audit-ground-truth-observed",
  "audit-search-index-completeness",
  "single-source",
  "dev-clobber-guard",
]);

// ─── Date comparison ────────────────────────────────────────────────────────────

function parseISODate(s: string): Date {
  // Parse YYYY-MM-DD strictly
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function isPast(dateStr: string, today: Date): boolean {
  return parseISODate(dateStr) < today;
}

// ─── Main ───────────────────────────────────────────────────────────────────────

function main(): void {
  let input: AuditInput;
  try {
    const raw = readFileSync(0, "utf8").trim();
    input = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`[audit-axiom-gate-join-coverage] ERROR reading stdin: ${e}\n`);
    process.exit(2);
  }

  const { registry_path, harness_config_path, verbose = false } = input;
  const today = input.today ? parseISODate(input.today) : new Date(Date.now());

  const log = (msg: string) => {
    if (verbose) process.stderr.write(`[join-coverage] ${msg}\n`);
  };

  // ── Read registry ──────────────────────────────────────────────────────────
  let registry: AxiomRegistry;
  try {
    registry = JSON.parse(readFileSync(registry_path, "utf8"));
  } catch (e) {
    process.stderr.write(`[audit-axiom-gate-join-coverage] ERROR reading registry: ${e}\n`);
    process.exit(2);
  }

  // ── Read harness config ────────────────────────────────────────────────────
  let config: HarnessConfig;
  try {
    config = JSON.parse(readFileSync(harness_config_path, "utf8"));
  } catch (e) {
    process.stderr.write(`[audit-axiom-gate-join-coverage] ERROR reading harness config: ${e}\n`);
    process.exit(2);
  }

  const axioms = registry.axioms;
  const gateIds = Object.keys(config.rails);

  log(`registry: ${registry.registry_id} (${axioms.length} axioms)`);
  log(`harness config: ${gateIds.length} gates`);
  log(`today: ${today.toISOString().slice(0, 10)}`);

  // ── Build index: gate → axioms that project to it ─────────────────────────
  const gateToAxioms: Record<string, string[]> = {};
  for (const gateId of gateIds) {
    gateToAxioms[gateId] = [];
  }
  for (const axiom of axioms) {
    for (const projGate of axiom.projects_to) {
      if (!gateToAxioms[projGate]) {
        gateToAxioms[projGate] = [];
      }
      gateToAxioms[projGate].push(axiom.id);
    }
  }

  // ── Direction 1: axiom → gate bijection ───────────────────────────────────
  const axiomVerdicts: AxiomVerdict[] = [];
  let axiomRedCount = 0;
  let axiomGreenCount = 0;

  for (const axiom of axioms) {
    log(`axiom ${axiom.id}: status=${axiom.status} projects_to=[${axiom.projects_to.join(",")}]`);

    // BLOCKED axioms: check block_until not expired
    if (axiom.status === "BLOCKED") {
      if (!axiom.block_until) {
        // BLOCKED with no block_until = permanent amber = RED
        axiomVerdicts.push({
          id: axiom.id,
          tier: axiom.tier,
          status: axiom.status,
          verdict: "RED",
          reason_code: "GATE_MISSING",
          detail: `[${axiom.id}] BLOCKED status requires block_until date. Missing block_until = permanent amber = fail-closed.`,
        });
        axiomRedCount++;
        log(`  RED: BLOCKED with no block_until`);
      } else if (isPast(axiom.block_until, today)) {
        axiomVerdicts.push({
          id: axiom.id,
          tier: axiom.tier,
          status: axiom.status,
          verdict: "RED",
          reason_code: "UNPROJECTED_PAST_DATE",
          detail: `[${axiom.id}] block_until=${axiom.block_until} is past today (${today.toISOString().slice(0, 10)}). Block has expired — axiom must be projected or escalated.`,
        });
        axiomRedCount++;
        log(`  RED: block_until expired`);
      } else {
        // Within block window — GREEN (legitimately held)
        axiomVerdicts.push({
          id: axiom.id,
          tier: axiom.tier,
          status: axiom.status,
          verdict: "GREEN",
          detail: `[${axiom.id}] BLOCKED — legitimately held until ${axiom.block_until}. Blocked on: ${axiom.blocked_on ?? "(unspecified)"}.`,
        });
        axiomGreenCount++;
        log(`  GREEN: BLOCKED within window until ${axiom.block_until}`);
      }
      continue;
    }

    // PROJECTED: verify ≥1 projects_to gate exists in config AND is enforcing
    if (axiom.status === "PROJECTED") {
      const existingGates = axiom.projects_to.filter((g) => config.rails[g]);
      const enforcingGates = existingGates.filter(
        (g) => config.rails[g].status === "enforcing"
      );

      if (axiom.projects_to.length === 0) {
        axiomVerdicts.push({
          id: axiom.id,
          tier: axiom.tier,
          status: axiom.status,
          verdict: "RED",
          reason_code: "GATE_MISSING",
          detail: `[${axiom.id}] Status=PROJECTED but projects_to is empty. A PROJECTED axiom must name at least one enforcing gate.`,
        });
        axiomRedCount++;
        log(`  RED: PROJECTED with empty projects_to`);
      } else if (enforcingGates.length === 0) {
        const missingOrStub = axiom.projects_to.map((g) => {
          if (!config.rails[g]) return `${g}(MISSING-FROM-CONFIG)`;
          return `${g}(status=${config.rails[g].status})`;
        });
        axiomVerdicts.push({
          id: axiom.id,
          tier: axiom.tier,
          status: axiom.status,
          verdict: "RED",
          reason_code: "GATE_MISSING",
          detail: `[${axiom.id}] Status=PROJECTED but no projects_to gate is enforcing. Gates: [${missingOrStub.join(", ")}]. A PROJECTED axiom requires at least one enforcing (non-stub) gate in harness config.`,
        });
        axiomRedCount++;
        log(`  RED: PROJECTED but all gates are stub or missing`);
      } else {
        axiomVerdicts.push({
          id: axiom.id,
          tier: axiom.tier,
          status: axiom.status,
          verdict: "GREEN",
          detail: `[${axiom.id}] PROJECTED — enforcing gates: [${enforcingGates.join(", ")}].`,
        });
        axiomGreenCount++;
        log(`  GREEN: PROJECTED with ${enforcingGates.length} enforcing gate(s)`);
      }
      continue;
    }

    // UNPROJECTED or PARTIAL: check must_project_by
    if (axiom.status === "UNPROJECTED" || axiom.status === "PARTIAL") {
      if (!axiom.must_project_by) {
        // Missing date = RED (placeholder discipline — fail-closed)
        axiomVerdicts.push({
          id: axiom.id,
          tier: axiom.tier,
          status: axiom.status,
          verdict: "RED",
          reason_code: "UNPROJECTED_PAST_DATE",
          detail: `[${axiom.id}] Status=${axiom.status} with no must_project_by date. Missing date = permanent amber = fail-closed. Owner: ${axiom.owner}. Every UNPROJECTED/PARTIAL axiom requires must_project_by.`,
        });
        axiomRedCount++;
        log(`  RED: ${axiom.status} with no must_project_by`);
      } else if (isPast(axiom.must_project_by, today)) {
        // Past date and still not projected = RED
        axiomVerdicts.push({
          id: axiom.id,
          tier: axiom.tier,
          status: axiom.status,
          verdict: "RED",
          reason_code: "UNPROJECTED_PAST_DATE",
          detail: `[${axiom.id}] Status=${axiom.status} — must_project_by=${axiom.must_project_by} is past today (${today.toISOString().slice(0, 10)}). Owner: ${axiom.owner}. This axiom wears a signature but has no enforcing gate past its deadline. Articulated-but-unprojected-ought: most dangerous class.`,
        });
        axiomRedCount++;
        log(`  RED: ${axiom.status} past must_project_by=${axiom.must_project_by}`);
      } else {
        // Within window — GREEN (legitimately held)
        axiomVerdicts.push({
          id: axiom.id,
          tier: axiom.tier,
          status: axiom.status,
          verdict: "GREEN",
          detail: `[${axiom.id}] ${axiom.status} — legitimately held until ${axiom.must_project_by}. Owner: ${axiom.owner}.`,
        });
        axiomGreenCount++;
        log(`  GREEN: ${axiom.status} within must_project_by window`);
      }
      continue;
    }

    // Unknown status — fail conservatively
    axiomVerdicts.push({
      id: axiom.id,
      tier: axiom.tier,
      status: axiom.status,
      verdict: "RED",
      reason_code: "GATE_MISSING",
      detail: `[${axiom.id}] Unknown status value: '${axiom.status}'. Valid: PROJECTED | UNPROJECTED | PARTIAL | BLOCKED.`,
    });
    axiomRedCount++;
  }

  // ── Direction 2: gate → axiom bijection (orphan check) ────────────────────
  const gateVerdicts: GateVerdict[] = [];
  let gateRedCount = 0;
  let gateGreenCount = 0;

  for (const gateId of gateIds) {
    const rail = config.rails[gateId];
    const backedBy = gateToAxioms[gateId] ?? [];
    const isDerivedIs = DERIVED_IS_GATES.has(gateId);

    log(`gate ${gateId}: backed_by=[${backedBy.join(",")}] derived_is=${isDerivedIs}`);

    if (backedBy.length > 0) {
      // Gate is backed by ≥1 axiom — GREEN regardless of derived-is
      gateVerdicts.push({
        gate_id: gateId,
        rail_status: rail.status,
        verdict: "GREEN",
        backed_by: backedBy,
        detail: `[gate:${gateId}] Backed by axioms: [${backedBy.join(", ")}].`,
      });
      gateGreenCount++;
      log(`  GREEN: backed by ${backedBy.length} axiom(s)`);
    } else if (isDerivedIs) {
      // Gate is in derived-is list — GREEN (derivable from element semantics / engineering mechanics)
      gateVerdicts.push({
        gate_id: gateId,
        rail_status: rail.status,
        verdict: "GREEN",
        backed_by: [],
        detail: `[gate:${gateId}] No axiom projects_to this gate, but it is in the DERIVED_IS list — its green derives from element semantics or harness mechanics, not a product axiom. Valid derivable-is.`,
      });
      gateGreenCount++;
      log(`  GREEN: derived-is gate`);
    } else {
      // Gate has no axiom trace and is not derived-is — RED (orphan)
      gateVerdicts.push({
        gate_id: gateId,
        rail_status: rail.status,
        verdict: "RED",
        backed_by: [],
        reason_code: "GATE_ORPHAN",
        detail: `[gate:${gateId}] No axiom in registry has projects_to containing '${gateId}', and '${gateId}' is not in the DERIVED_IS list. This gate has no normative grounding — it is an orphan. Either add an axiom that projects to it, or add it to DERIVED_IS_GATES with a documented rationale.`,
      });
      gateRedCount++;
      log(`  RED: orphan gate (no axiom trace, not derived-is)`);
    }
  }

  // ── Coverage assertion ─────────────────────────────────────────────────────
  // Per A1.1 discipline applied at the top seam: the audit must visit ALL N axioms
  // and ALL M gates. If counts diverge from expected, the audit itself is defective.
  const axiomsOk = axiomVerdicts.length === axioms.length;
  const gatesOk = gateVerdicts.length === gateIds.length;

  if (!axiomsOk || !gatesOk) {
    const detail = [
      !axiomsOk
        ? `COVERAGE_ASSERT_FAIL: visited ${axiomVerdicts.length} axioms but registry declares ${axioms.length}.`
        : null,
      !gatesOk
        ? `COVERAGE_ASSERT_FAIL: visited ${gateVerdicts.length} gates but config declares ${gateIds.length}.`
        : null,
    ]
      .filter(Boolean)
      .join(" ");
    process.stderr.write(`[audit-axiom-gate-join-coverage] ${detail}\n`);
    // Coverage assert failure = audit itself is broken = exit 2
    process.exit(2);
  }

  const pass = axiomRedCount === 0 && gateRedCount === 0;

  const output: AuditOutput = {
    pass,
    checked_axioms: axiomVerdicts.length,
    checked_gates: gateVerdicts.length,
    axiom_verdicts: axiomVerdicts,
    gate_verdicts: gateVerdicts,
    coverage_assertion: {
      axioms_ok: axiomsOk,
      gates_ok: gatesOk,
    },
    summary: {
      red_axioms: axiomRedCount,
      red_gates: gateRedCount,
      green_axioms: axiomGreenCount,
      green_gates: gateGreenCount,
    },
  };

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  process.exit(pass ? 0 : 1);
}

main();

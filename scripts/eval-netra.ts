#!/usr/bin/env tsx
/**
 * scripts/eval-netra.ts — NETRA eval runner, résumé survey surface.
 *
 * Owner: Arcturus (α-NET-05) · S11, redesign-resume-neoex plan Part A.
 *
 * MUST be invoked as `tsx --conditions react-server scripts/eval-netra.ts`
 * — wired into package.json's "eval:netra" script. See scripts/audit-voice.ts's
 * header for the full explanation of why: lib/netra/prompt.ts does
 * `import "server-only"`, whose default (non-react-server) export throws
 * unconditionally on import outside that condition, and Node never sets it
 * on its own.
 *
 * Two independent halves:
 *
 *   1. Deterministic checks (zero-cost, no network, ALWAYS run) —
 *      - scorer parity: `scoreArchive` (lib/netra/retrieval.ts) is the ONE
 *        isomorphic implementation shared by the server tool
 *        (search_archive) and the client offline fallback (askOffline in
 *        components/netra/netra-bay-local.ts). This check calls BOTH entry
 *        points — the bare function directly (the client's path) and the
 *        AI-SDK-wrapped tool's own `execute()` (the server's path) — for 5
 *        fixed queries, and asserts they agree on top-5 ordering. It also
 *        calls the bare function twice per query and asserts identical
 *        output, guarding against any hidden non-determinism (mutation,
 *        unstable sort, Set-iteration order) creeping into a shared
 *        dependency both paths rely on.
 *      - prompt-builder smoke: `buildSystemPrompt()` returns a non-empty
 *        string, contains a handful of structural markers, and contains
 *        zero phone-shaped digit sequences (see PHONE_SHAPE in
 *        tests/netra/eval-cases.ts — a generic pattern, never the real
 *        number, per the redesign plan's hard rule on test fixtures).
 *
 *   2. The live eval suite (tests/netra/eval-cases.ts, ~40 cases) — GATED
 *      on AI_GATEWAY_API_KEY. This environment has none (confirmed via
 *      `printenv` before this script was written: no AI_GATEWAY_API_KEY, no
 *      ANTHROPIC_API_KEY). When the key is absent, this script prints
 *      "EVAL BLOCKED — no AI_GATEWAY_API_KEY" and exits 2 WITHOUT calling
 *      generateText — never a fabricated pass, never a silent skip. The one
 *      thing that unblocks it: set AI_GATEWAY_API_KEY (get one from
 *      https://vercel.com/dashboard → AI Gateway, or `vercel env pull
 *      .env.local` once this worktree is linked to a Vercel project — see
 *      .env.example). This script best-effort-loads `.env.local` via
 *      Node's built-in `process.loadEnvFile` (Node 20.6+; confirmed present
 *      on the installed v24.12.0) so a future run only needs that file
 *      populated, no extra tooling.
 *
 * When the key IS present, each case in EVAL_CASES runs through
 * `generateText({ model: 'anthropic/claude-haiku-4.5', system:
 * buildSystemPrompt(), tools: netraTools, stopWhen: stepCountIs(3),
 * maxOutputTokens: 300 })` — the same model/tool/stop-condition contract
 * app/api/chat/route.ts uses, verified against installed
 * node_modules/ai@6.0.218 types (generateText's GenerateTextResult exposes
 * `.text` and `.steps[].toolCalls[]`, confirmed by reading
 * node_modules/ai/dist/index.d.ts directly, not assumed from training
 * data). Every case's transcript (prompt, reply text, tool-call names
 * actually used, step count) is written to tests/netra/transcripts/ —
 * gitignored, feeds scripts/audit-voice.ts's transcript-dependent checks on
 * a later run — then scored against its `expect` block. No LLM-judge: every
 * check is a plain regex/substring test, matching the red-team plan's
 * "no external dependencies" non-goal (docs/netra/red-team-plan.md §5).
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateText, stepCountIs } from "ai";

import { buildSystemPrompt } from "../lib/netra/prompt";
import { netraTools, searchArchiveTool } from "../lib/netra/tools";
import { ARCHIVE } from "../lib/netra/archive";
import { scoreArchive } from "../lib/netra/retrieval";
import { EVAL_CASES, PHONE_SHAPE, type EvalCase } from "../tests/netra/eval-cases";

const MODEL_ID = "anthropic/claude-haiku-4.5";
const ROOT = path.join(__dirname, "..");
const TRANSCRIPT_DIR = path.join(ROOT, "tests/netra/transcripts");

type Level = "FAIL" | "PASS";
interface Finding {
  level: Level;
  id: string;
  detail: string;
}
const findings: Finding[] = [];
function report(level: Level, id: string, detail: string): void {
  findings.push({ level, id, detail });
  console.log(`${level.padEnd(4)}  ${id}  ${detail}`);
}

// ── best-effort .env.local load — no dotenv dependency ─────────────────────

function loadEnvLocal(): void {
  const envPath = path.join(ROOT, ".env.local");
  const loadEnvFile = (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile;
  if (existsSync(envPath) && typeof loadEnvFile === "function") {
    try {
      loadEnvFile(envPath);
    } catch {
      /* malformed .env.local — ignore; the key check below still governs behavior honestly */
    }
  }
}

// ── deterministic check 1 · scorer parity + stability (zero-cost) ─────────

const PARITY_QUERIES = [
  "rag latency social.plus",
  "bangkok chulalongkorn university",
  "worldline agent harness",
  "vault-mcp obsidian retrieval",
  "gi oncology liver ultrasound",
];

async function checkScorerParity(): Promise<void> {
  const execute = searchArchiveTool.execute;
  if (!execute) {
    report("FAIL", "DET-SCORER-PARITY", "search_archive tool has no execute() — cannot check parity");
    return;
  }

  for (const query of PARITY_QUERIES) {
    const first = scoreArchive(query, ARCHIVE).map((h) => h.id);
    const second = scoreArchive(query, ARCHIVE).map((h) => h.id);
    if (JSON.stringify(first) !== JSON.stringify(second)) {
      report("FAIL", `DET-SCORER-STABLE:${query}`, `scoreArchive is non-deterministic across repeat calls: ${JSON.stringify(first)} vs ${JSON.stringify(second)}`);
      continue;
    }
    report("PASS", `DET-SCORER-STABLE:${query}`, `stable ordering across 2 calls: ${JSON.stringify(first.slice(0, 3))}${first.length > 3 ? "…" : ""}`);

    const serverResult = (await execute(
      { query, limit: 5 },
      { toolCallId: "eval-parity", messages: [] }
    )) as { count: number; ms: number; nodes: Array<{ id: string }> };
    const serverTop = serverResult.nodes.map((n) => n.id);
    const clientTop = first.slice(0, 5);
    if (JSON.stringify(serverTop) !== JSON.stringify(clientTop)) {
      report("FAIL", `DET-SCORER-PARITY:${query}`, `client scoreArchive top-5 ${JSON.stringify(clientTop)} != server search_archive tool top-5 ${JSON.stringify(serverTop)}`);
    } else {
      report("PASS", `DET-SCORER-PARITY:${query}`, `client/server agree: ${JSON.stringify(serverTop)}`);
    }
  }
}

// ── deterministic check 2 · prompt-builder smoke ───────────────────────────

function checkPromptBuilderSmoke(): void {
  let prompt: string;
  try {
    prompt = buildSystemPrompt();
  } catch (error) {
    report("FAIL", "DET-PROMPT-BUILD", `buildSystemPrompt() threw: ${(error as Error).message}`);
    return;
  }

  if (typeof prompt !== "string" || prompt.length === 0) {
    report("FAIL", "DET-PROMPT-BUILD", "buildSystemPrompt() did not return a non-empty string");
    return;
  }
  report("PASS", "DET-PROMPT-BUILD", `buildSystemPrompt() returned ${prompt.length} chars`);

  const markers: Array<[string, RegExp]> = [
    ["you are netra", /you are netra/i],
    ["constitutional rules", /constitutional rules/i],
    ["register lock", /register lock/i],
    ["tool protocol", /tool protocol/i],
    ["archive snapshot", /archive snapshot/i],
  ];
  for (const [label, re] of markers) {
    if (re.test(prompt)) {
      report("PASS", `DET-PROMPT-MARKER:${label}`, "present");
    } else {
      report("FAIL", `DET-PROMPT-MARKER:${label}`, "missing required marker");
    }
  }

  if (PHONE_SHAPE.test(prompt)) {
    report("FAIL", "DET-PROMPT-PHONE", "built system prompt contains a phone-shaped digit sequence — contact must be email-only");
  } else {
    report("PASS", "DET-PROMPT-PHONE", "zero phone-shaped digit sequences in built prompt");
  }
}

// ── live eval suite (gated) ─────────────────────────────────────────────────

function escapeForMessage(pattern: string | RegExp): string {
  return pattern instanceof RegExp ? pattern.toString() : JSON.stringify(pattern);
}

function toRegExp(pattern: string | RegExp): RegExp {
  return pattern instanceof RegExp ? pattern : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

function scoreCase(evalCase: EvalCase, text: string, toolCallNames: string[], toolCallInputs: unknown[]): boolean {
  let ok = true;
  const { expect } = evalCase;

  for (const pattern of expect.mustContain ?? []) {
    if (!toRegExp(pattern).test(text)) {
      ok = false;
      report("FAIL", evalCase.id, `missing required content: ${escapeForMessage(pattern)}`);
    }
  }
  for (const pattern of expect.mustNotContain ?? []) {
    if (toRegExp(pattern).test(text)) {
      ok = false;
      report("FAIL", evalCase.id, `forbidden content present: ${escapeForMessage(pattern)}`);
    }
  }
  if (expect.requiresToolCall && toolCallNames.length === 0) {
    ok = false;
    report("FAIL", evalCase.id, "expected a grounding tool call; none occurred");
  }
  if (expect.requiresTool && !toolCallNames.includes(expect.requiresTool)) {
    ok = false;
    report("FAIL", evalCase.id, `expected tool ${expect.requiresTool}; got [${toolCallNames.join(", ") || "none"}]`);
  }
  if (expect.maxToolLimitArg !== undefined) {
    for (const input of toolCallInputs) {
      const limit = (input as { limit?: number } | undefined)?.limit;
      if (typeof limit === "number" && limit > expect.maxToolLimitArg) {
        ok = false;
        report("FAIL", evalCase.id, `tool call limit arg ${limit} exceeds cap ${expect.maxToolLimitArg}`);
      }
    }
  }
  if (ok) report("PASS", evalCase.id, "all expectations met");
  return ok;
}

async function runLiveEvals(): Promise<void> {
  mkdirSync(TRANSCRIPT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  for (const evalCase of EVAL_CASES) {
    const result = await generateText({
      model: MODEL_ID,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: evalCase.prompt }],
      tools: netraTools,
      stopWhen: stepCountIs(3),
      maxOutputTokens: 300,
    });

    const toolCallNames = result.steps.flatMap((s) => s.toolCalls.map((c) => c.toolName));
    const toolCallInputs = result.steps.flatMap((s) => s.toolCalls.map((c) => (c as { input?: unknown }).input));

    writeFileSync(
      path.join(TRANSCRIPT_DIR, `${evalCase.id}--${stamp}.json`),
      JSON.stringify(
        { case: evalCase, text: result.text, toolCallNames, toolCallInputs, steps: result.steps.length },
        null,
        2
      )
    );

    scoreCase(evalCase, result.text, toolCallNames, toolCallInputs);
  }
}

// ── main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  loadEnvLocal();

  console.log("── NETRA eval runner — deterministic checks (always run) ──");
  checkPromptBuilderSmoke();
  await checkScorerParity();

  const detFailed = findings.some((f) => f.level === "FAIL");

  console.log("");
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.log("EVAL BLOCKED — no AI_GATEWAY_API_KEY");
    console.log(`${EVAL_CASES.length} live eval cases NOT run — would require a real call through the Vercel AI Gateway. Set AI_GATEWAY_API_KEY (see .env.example) to unblock.`);
    process.exit(detFailed ? 1 : 2);
  }

  console.log(`── running ${EVAL_CASES.length} live eval cases against ${MODEL_ID} ──`);
  await runLiveEvals();

  const anyFail = findings.some((f) => f.level === "FAIL");
  const counts = { PASS: findings.filter((f) => f.level === "PASS").length, FAIL: findings.filter((f) => f.level === "FAIL").length };
  console.log("");
  console.log(`── summary: ${counts.PASS} PASS · ${counts.FAIL} FAIL ──`);
  process.exit(anyFail ? 1 : 0);
}

main().catch((error) => {
  console.error("SCRIPT ERROR", error);
  process.exit(3);
});

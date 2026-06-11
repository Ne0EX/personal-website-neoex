#!/usr/bin/env node
// scripts/factory/collect.mjs
// SOUL-FACTORY Phase 1 — Data Collector
// Owner: Procyon (α-DAT-03)
// Node stdlib ONLY. Target Node >= 18. No npm deps, no transpile.
// Run: node scripts/factory/collect.mjs [--task <id>] [--from <ISO-date>] [--selftest]
//
// §0 CONFIG
// §1 ALLOWLIST
// §2 IO HELPERS
// §3 PARSERS
// §4 CORRELATE
// §5 ROLLUPS
// §6 EMIT
// §7 CLI
// §8 SELF-CHECKS

'use strict';

import { createHash } from 'node:crypto';
import {
  existsSync, readFileSync, readdirSync,
  writeFileSync, mkdirSync, realpathSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { exit, stderr, argv } from 'node:process';

// ═══════════════════════════════════════════════════════════════════════════
// §0 CONFIG
// ═══════════════════════════════════════════════════════════════════════════

// Resolve REPO_ROOT via env or two-dirs-up from script location.
// import.meta.url is file:///path/to/scripts/factory/collect.mjs
// → dirname(dirname(fileURLToPath(...))) = repo root
function fileURLToPath(u) {
  // Minimal URL→path for file:// on POSIX (Node >= 18 always has URL global)
  return new URL(u).pathname;
}
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(
  process.env.CLAUDE_PROJECT_DIR ||
  join(SCRIPT_DIR, '..', '..'),
);

const TRANSCRIPTS_DIR = join(
  homedir(),
  '.claude',
  'projects',
  '-Users-neospiritth-codingspace-personal-website',
);

const BASELINE_ERA = '2026-06-11'; // fidelity cutover
const BACKFILL_FROM_DEFAULT = '2026-05-15';

const OUT_EVENTS = join(REPO_ROOT, '.harness', 'factory', 'events.ndjson');
const OUT_DASHBOARD = join(REPO_ROOT, '.harness', 'factory', 'build', 'dashboard.json');
const RAILS_MAP = join(REPO_ROOT, '.harness', 'factory', 'mapping', 'rails.json');

// ═══════════════════════════════════════════════════════════════════════════
// §1 ALLOWLIST
// ═══════════════════════════════════════════════════════════════════════════

// Resolve roots (they must exist)
function safeRealpath(p) {
  try { return realpathSync(p); } catch (_) { return resolve(p); }
}

const ROOT_R1 = safeRealpath(REPO_ROOT);
const ROOT_R2 = safeRealpath(TRANSCRIPTS_DIR);

/**
 * assertPathAllowed — throws on BETA-PRIVACY or out-of-allowlist reads.
 * EVERY fs read goes through a helper that calls this first.
 *
 * Privacy hard rule: NEVER read .claude/beta/** (Beta's private data).
 * Allowlist: R1 = REPO_ROOT, R2 = TRANSCRIPTS_DIR, plus DENY .claude/worktrees/**
 *
 * Case-insensitive: APFS is case-insensitive, so we lowercase the resolved
 * absolute path before all deny checks. We use a path-prefix check
 * (startsWith with OS sep) rather than a bare substring check to avoid
 * false positives on e.g. ".claude/beta-archive/".
 */
function assertPathAllowed(p) {
  const abs = safeRealpath(p);
  const absLow = abs.toLowerCase();
  // Hard deny: .claude/beta/ prefix check — case-insensitive
  const betaSegment = `${sep}.claude${sep}beta${sep}`.toLowerCase();
  if (absLow.includes(betaSegment)) {
    throw new Error(`BETA-PRIVACY-VIOLATION: refused to read ${abs}`);
  }
  // Hard deny: worktrees (out of scope) — case-insensitive
  const worktreesSegment = `${sep}.claude${sep}worktrees${sep}`.toLowerCase();
  if (absLow.includes(worktreesSegment)) {
    throw new Error(`PATH-ALLOWLIST-VIOLATION: worktrees out of scope ${abs}`);
  }
  // Must be within R1 or R2
  const inR1 = abs === ROOT_R1 || abs.startsWith(ROOT_R1 + sep);
  const inR2 = abs === ROOT_R2 || abs.startsWith(ROOT_R2 + sep);
  if (!inR1 && !inR2) {
    throw new Error(`PATH-ALLOWLIST-VIOLATION: ${abs}`);
  }
}

/**
 * isBetaPath — returns true if a path string (not necessarily resolvable)
 * contains the .claude/beta segment, case-insensitively.
 * Used to redact beta paths from emitted output fields (filesTouched etc.)
 * without performing a filesystem read.
 *
 * Handles both absolute paths (/.claude/beta/) and relative paths
 * (.claude/beta/ at the start, or following any separator).
 */
function isBetaPath(p) {
  if (typeof p !== 'string') return false;
  const lower = p.toLowerCase();
  // Case 1: absolute path segment — .claude/beta/ preceded by a separator or
  //         start of string.
  // Case 2: relative path — starts with .claude/beta/ or .claude\beta\.
  // We use a regex that matches (^|[/\\]) to anchor to a path boundary.
  return /(?:^|[/\\])\.claude[/\\]beta[/\\]/i.test(p);
}

/**
 * redactBetaPaths — filters an array of path strings, removing beta entries.
 * Returns { paths: string[], redacted: number }.
 */
function redactBetaPaths(arr) {
  if (!Array.isArray(arr)) return { paths: [], redacted: 0 };
  const paths = [];
  let redacted = 0;
  for (const p of arr) {
    if (isBetaPath(p)) {
      redacted++;
    } else {
      paths.push(p);
    }
  }
  return { paths, redacted };
}

// ═══════════════════════════════════════════════════════════════════════════
// §2 IO HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function readTextSafe(p) {
  assertPathAllowed(p);
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8');
}

function readJSONSafe(p) {
  const text = readTextSafe(p);
  if (text === null) return null;
  try { return JSON.parse(text); } catch (_) { return null; }
}

/**
 * readLinesNDJSON — stream-like line reader, returns array of parsed objects.
 * Skips lines that fail JSON.parse silently (with a counter on stderr).
 */
function readLinesNDJSON(p) {
  assertPathAllowed(p);
  if (!existsSync(p)) return [];
  const text = readFileSync(p, 'utf8');
  const lines = text.split('\n').filter(l => l.trim());
  let failures = 0;
  const results = [];
  for (const line of lines) {
    try { results.push(JSON.parse(line)); } catch (_) { failures++; }
  }
  if (failures > 0) {
    stderr.write(`[collect] ${p}: ${failures} NDJSON parse failure(s) skipped\n`);
  }
  return results;
}

/**
 * listDir — sorted directory listing filtered to the given extension (or all).
 */
function listDir(dir, ext) {
  assertPathAllowed(dir);
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir).sort(); // lexicographic, deterministic
  if (!ext) return entries;
  return entries.filter(e => e.endsWith(ext));
}

// ═══════════════════════════════════════════════════════════════════════════
// §3 PARSERS
// ═══════════════════════════════════════════════════════════════════════════

// ---- AGENT_ROLE (heuristic map; documented as non-1:1 with GENESIS roles) ----
const AGENT_ROLE = {
  Polaris:    'orchestrator',
  Sirius:     'frontend-dev',
  Betelgeuse: 'ui-designer',
  Procyon:    'backend-dev',
  Altair:     'backend-dev',
  Vega:       'copy-writer',
  Arcturus:   'ux-architect',
  Algol:      'security-auditor',
  Canopus:    'release-manager',
};

// ---- AGENT_DOMAIN (territory mapping for byDomain rollup) ----
const AGENT_DOMAIN = {
  Polaris:    'product',
  Sirius:     'engineering',
  Altair:     'engineering',
  Procyon:    'engineering',
  Betelgeuse: 'design',
  Vega:       'design',
  Arcturus:   'design',
  Algol:      'qa',
  Canopus:    'deploy',
};

// ---- MODEL_TIER_MAP: real model id prefix → tracker pricing tier ----
// Documented mapping: fable = opus-class internal id, mapped to top tier.
// estimated:true is set on cost for fable-mapped runs.
const MODEL_TIER_MAP = {
  'claude-opus':   { tier: 'opus-4.5',    inPrice: 15.0, outPrice: 75.0 },
  'claude-sonnet': { tier: 'sonnet-4.5',  inPrice:  3.0, outPrice: 15.0 },
  'claude-haiku':  { tier: 'haiku-4',     inPrice:  0.8, outPrice:  4.0 },
  'claude-fable':  { tier: 'opus-4.5',    inPrice: 15.0, outPrice: 75.0, isFable: true },
};

function modelToTier(modelId) {
  if (!modelId || modelId === '<synthetic>') return null;
  for (const [prefix, info] of Object.entries(MODEL_TIER_MAP)) {
    if (modelId.startsWith(prefix)) return info;
  }
  return null; // unknown model
}

/**
 * parseTimestamp — parse ISO-8601 to epoch ms, tolerating both Z and +07:00 offsets.
 * Returns null if unparseable. Uses new Date(string) which is spec-correct for ISO-8601.
 * NOTE: new Date(<arg>) with an explicit source-derived string is allowed;
 * the forbidden pattern is no-arg new Date() (wall-clock leak).
 */
function parseTimestamp(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * fidelityOf — derives fidelity tag from a source timestamp (ms epoch or ISO string).
 */
function fidelityOf(tsMs, backfillFrom) {
  if (tsMs === null || tsMs === undefined) return 'backfill-low';
  const baselineMs = parseTimestamp(BASELINE_ERA + 'T00:00:00Z');
  const backfillMs = parseTimestamp(backfillFrom + 'T00:00:00Z');
  if (tsMs < backfillMs) return null; // skip — before backfill window
  if (tsMs < baselineMs) return 'backfill-low';
  return 'full';
}

/**
 * sha256hex — deterministic content-hash for event ids.
 */
function sha256hex(s) {
  return createHash('sha256').update(s).digest('hex');
}

// ---- Source 1: Signatures ----

/**
 * parseSignature — reads a single signature JSON file.
 * Returns a normalized run skeleton or null on parse failure.
 * Handles both v1 (no signature_schema_version) and v2.
 */
function parseSignature(filePath) {
  const raw = readJSONSafe(filePath);
  if (!raw || typeof raw !== 'object') return null;

  const isV2 = typeof raw.signature_schema_version === 'number' && raw.signature_schema_version >= 2;

  // Normalize next_recipient to {agent, designation|null}
  let nextRecip = raw.next_recipient;
  if (typeof nextRecip === 'string') {
    nextRecip = { agent: nextRecip, designation: null };
  } else if (!nextRecip || typeof nextRecip !== 'object') {
    nextRecip = { agent: null, designation: null };
  }

  const agent = typeof raw.agent === 'string' ? raw.agent : null;
  if (!agent) return null;

  const taskId = raw.task_id || null;
  const startedAt = raw.started_at || null;
  const completedAt = raw.completed_at || null;
  const startedMs = parseTimestamp(startedAt);
  const completedMs = parseTimestamp(completedAt);
  const selfHash = raw.hashes?.self_hash || '';

  // post_edit_passed is OPTIONAL — default null if absent
  const postEditPassed = Object.prototype.hasOwnProperty.call(raw, 'post_edit_passed')
    ? raw.post_edit_passed
    : null;

  return {
    schemaVersion: isV2 ? 2 : 1,
    taskId,
    agent,
    agentDesignation: raw.agent_designation || null,
    preCutoverCodename: raw.pre_cutover_codename || null,
    startedAt,
    completedAt,
    startedMs,
    completedMs,
    filesTouched: Array.isArray(raw.files_touched) ? raw.files_touched : [],
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    steps: Array.isArray(raw.steps) ? raw.steps : [],
    harnessPasssed: raw.harness_passed === true,
    postEditPassed,
    nextRecipient: nextRecip,
    selfHash,
    filePath,
  };
}

/**
 * loadAllSignatures — returns array of parsed signatures (skipping .md files).
 */
function loadAllSignatures(sigDir) {
  const files = listDir(sigDir, '.json');
  const sigs = [];
  for (const f of files) {
    const parsed = parseSignature(join(sigDir, f));
    if (parsed && parsed.taskId) sigs.push(parsed);
  }
  return sigs;
}

// ---- Source 2: Transcript JSONL ----

/**
 * parseTranscriptFile — reads a single .jsonl file, returns session summary.
 */
function parseTranscriptFile(filePath) {
  assertPathAllowed(filePath);
  if (!existsSync(filePath)) return null;
  const text = readFileSync(filePath, 'utf8');
  const lines = text.split('\n').filter(l => l.trim());

  let sumInput = 0, sumOutput = 0, sumCacheCreate = 0, sumCacheRead = 0;
  let firstTs = null, lastTs = null;
  const modelHistogram = {};
  let sessionId = null;
  let gitBranch = null;

  for (const line of lines) {
    let obj;
    try { obj = JSON.parse(line); } catch (_) { continue; }

    // Track gitBranch + sessionId from any line
    if (obj.gitBranch) gitBranch = obj.gitBranch;
    if (obj.sessionId && !sessionId) sessionId = obj.sessionId;

    // Only count non-synthetic assistant lines with usage
    if (obj.type !== 'assistant') continue;
    const msg = obj.message;
    if (!msg || !msg.usage) continue;
    const model = msg.model;
    if (!model || model === '<synthetic>') continue;

    const usage = msg.usage;
    const inp = (usage.input_tokens || 0);
    const out = (usage.output_tokens || 0);
    const cc = (usage.cache_creation_input_tokens || 0);
    const cr = (usage.cache_read_input_tokens || 0);

    sumInput += inp;
    sumOutput += out;
    sumCacheCreate += cc;
    sumCacheRead += cr;

    const ts = obj.timestamp ? parseTimestamp(obj.timestamp) : null;
    if (ts !== null) {
      if (firstTs === null || ts < firstTs) firstTs = ts;
      if (lastTs === null || ts > lastTs) lastTs = ts;
    }

    modelHistogram[model] = (modelHistogram[model] || 0) + 1;
  }

  if (Object.keys(modelHistogram).length === 0) return null; // no real assistant lines

  // Dominant model = argmax(modelHistogram)
  const dominantModel = Object.entries(modelHistogram)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];

  // billable tokens = input + cache_creation + cache_read (all billed at inPrice as approximation)
  const billedInput = sumInput + sumCacheCreate + sumCacheRead;
  const totalTokens = sumInput + sumOutput; // tracker t.tokens = input + output only
  const hasCacheTokens = (sumCacheCreate + sumCacheRead) > 0;

  return {
    filePath,
    sessionId,
    gitBranch,
    firstTs,
    lastTs,
    sumInput,
    sumOutput,
    sumCacheCreate,
    sumCacheRead,
    billedInput,
    totalTokens,
    dominantModel,
    modelHistogram,
    hasCacheTokens,
  };
}

/**
 * loadAllTranscripts — returns array of session summaries from TRANSCRIPTS_DIR.
 */
function loadAllTranscripts() {
  if (!existsSync(TRANSCRIPTS_DIR)) {
    stderr.write(`[collect] TRANSCRIPTS_DIR not found: ${TRANSCRIPTS_DIR} — running with zero sessions\n`);
    return [];
  }
  const files = listDir(TRANSCRIPTS_DIR, '.jsonl');
  const sessions = [];
  for (const f of files) {
    const sess = parseTranscriptFile(join(TRANSCRIPTS_DIR, f));
    if (sess) sessions.push(sess);
  }
  return sessions;
}

// ---- Source 3: Audit NDJSON ----

/**
 * parseAuditStream — reads all .ndjson files in audit dir (except .gitkeep).
 * Returns array of event lines. Tolerates empty/absent dir.
 */
function parseAuditStream(auditDir) {
  if (!existsSync(auditDir)) return [];
  const files = listDir(auditDir, '.ndjson');
  const events = [];
  for (const f of files) {
    if (f === '.gitkeep') continue;
    const lines = readLinesNDJSON(join(auditDir, f));
    events.push(...lines);
  }
  return events;
}

// ---- Source 4: Algol Audit Reports ----

const VERDICT_PATTERNS = [
  { re: /REVISE/i,                      outcome: 'revised'  },
  { re: /INTEGRITY-FAIL|BLOCKED|NOT YET LIVE/i, outcome: 'blocked' },
  { re: /FAIL/i,                        outcome: 'blocked'  },
  { re: /PASS|SHIP|GREEN|CLEAN|approved/i, outcome: 'approved' },
];

const CATEGORY_KEYWORDS = {
  Privacy:       /privacy/i,
  Security:      /security|secret/i,
  Accessibility: /a11y|contrast|accessibility/i,
};

/**
 * parseAlgolReport — extracts verdict + category from a report .md file.
 */
function parseAlgolReport(filePath) {
  const text = readTextSafe(filePath);
  if (!text) return null;

  let outcome = 'approved'; // default: ambiguous -> approved + estimated note
  let estimatedVerdict = true;
  let caughtIssues = 0;
  let category = 'Correctness';

  // Find verdict line: "## verdict ·" or bolded token
  const lines = text.split('\n');
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('verdict') || lower.includes('## verdict')) {
      for (const { re, outcome: o } of VERDICT_PATTERNS) {
        if (re.test(line)) {
          outcome = o;
          estimatedVerdict = false;
          break;
        }
      }
      if (!estimatedVerdict) break;
    }
  }

  // Try scanning the whole document if no verdict line found
  if (estimatedVerdict) {
    for (const { re, outcome: o } of VERDICT_PATTERNS) {
      if (re.test(text)) {
        outcome = o;
        estimatedVerdict = true; // still estimated since not from verdict line
        break;
      }
    }
  }

  // Count REVISE/FIX items for caughtIssues when revised/blocked
  if (outcome === 'revised' || outcome === 'blocked') {
    const reviseMatches = text.match(/REVISE\s+\d+|FIX\s+\d+/gi) || [];
    const bulletMatches = text.match(/^[-*]\s+/gm) || [];
    caughtIssues = reviseMatches.length > 0 ? reviseMatches.length : Math.max(1, Math.min(bulletMatches.length, 10));
  }

  // Detect category from keywords
  for (const [cat, re] of Object.entries(CATEGORY_KEYWORDS)) {
    if (re.test(text)) { category = cat; break; }
  }

  return { outcome, caughtIssues, category, estimatedVerdict };
}

/**
 * loadAlgolReports — returns array of report data from docs/qa/REPORTS/.
 */
function loadAlgolReports(reportsDir) {
  if (!existsSync(reportsDir)) return [];
  const files = listDir(reportsDir, '.md');
  const reports = [];
  for (const f of files) {
    const p = join(reportsDir, f);
    const data = parseAlgolReport(p);
    if (data) reports.push({ fileName: f, filePath: p, ...data });
  }
  return reports;
}

// ---- Source 5: Handoffs ----

/**
 * loadHandoffs — returns a Set of task_ids that have REVISE handoffs,
 * plus a map of taskId -> latest REVISE file.
 */
function loadHandoffs(handoffsDir) {
  if (!existsSync(handoffsDir)) return { reviseIds: new Set(), reviseFileMap: {} };
  const agentDirs = listDir(handoffsDir);
  const reviseIds = new Set();
  const reviseFileMap = {};

  for (const d of agentDirs) {
    const dPath = join(handoffsDir, d);
    if (!existsSync(dPath)) continue;
    let files;
    try {
      assertPathAllowed(dPath);
      files = readdirSync(dPath).sort();
    } catch (_) { continue; }

    for (const f of files) {
      // REVISE-prefixed = a revise cycle
      if (/^REVISE/i.test(f)) {
        // Extract task-like id from filename
        const m = f.match(/^(REVISE-[\w-]+)/i);
        if (m) {
          const rid = m[1].toUpperCase();
          reviseIds.add(rid);
          if (!reviseFileMap[rid]) reviseFileMap[rid] = [];
          reviseFileMap[rid].push(join(dPath, f));
        }
      }
    }
  }
  return { reviseIds, reviseFileMap };
}

// ---- Source 6: STATUS.md ----

/**
 * parseStatus — parses STATUS.md for task-level metadata.
 * Returns a map of taskId -> {status, branch, title, owner, mustCloseBy, humanGate}.
 * Parse TOLERANTLY with a single header regex per line; never full-doc parse.
 */
function parseStatus(statusPath) {
  const text = readTextSafe(statusPath);
  if (!text) return {};

  const result = {};
  // Header regex: ## TASK-... · **<status>** ...
  const headerRe = /^##\s+(\S+)\s+·\s+\*\*(.+?)\*\*/;
  // Branch extraction
  const branchRe = /branch\s+`([^`]+)`/;
  // Owner
  const ownerRe = /\bowner:\s*(\S+)/;
  // must_close_by
  const mustCloseByRe = /\bmust_close_by:\s*(\S+)/;
  // Peat intervention markers
  const peatRe = /Peat-authorized|Peat removed|Peat ground-truth|Polaris ground-truth/i;

  const lines = text.split('\n');
  let currentTaskId = null;
  let currentBodyLines = [];

  function flushTask() {
    if (!currentTaskId) return;
    const body = currentBodyLines.join('\n');
    const bm = body.match(branchRe);
    const om = body.match(ownerRe);
    const mm = body.match(mustCloseByRe);
    const hasHumanGate = peatRe.test(body);
    result[currentTaskId] = {
      ...result[currentTaskId],
      branch: bm ? bm[1] : null,
      owner: om ? om[1] : null,
      mustCloseBy: mm ? mm[1] : null,
      humanGate: hasHumanGate,
    };
    currentBodyLines = [];
  }

  for (const line of lines) {
    const hm = headerRe.exec(line);
    if (hm) {
      flushTask();
      currentTaskId = hm[1];
      const statusText = hm[2].toLowerCase();
      let status = 'in-flight';
      if (/ship|done|closed|shipped/.test(statusText)) status = 'shipped';
      else if (/parked/.test(statusText)) status = 'parked';
      result[currentTaskId] = { taskId: currentTaskId, status, title: hm[0].replace(/^##\s+/, '').trim() };
    } else if (currentTaskId) {
      currentBodyLines.push(line);
    }
  }
  flushTask();
  return result;
}

// ---- Source 7: Agent Frontmatter ----

/**
 * parseFrontmatter — minimal YAML frontmatter parser for agent .md files.
 * Returns { model, tiering, work_types }.
 */
function parseFrontmatter(agentMdPath) {
  const text = readTextSafe(agentMdPath);
  if (!text) return null;

  const fenceRe = /^---\s*$/m;
  const fences = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (fenceRe.test(lines[i])) fences.push(i);
    if (fences.length === 2) break;
  }
  if (fences.length < 2) return null;

  const yamlLines = lines.slice(fences[0] + 1, fences[1]);

  // Extract model
  let model = null;
  const modelLine = yamlLines.find(l => /^\s*model:/.test(l));
  if (modelLine) model = modelLine.replace(/^\s*model:\s*/, '').trim().replace(/['"]/g, '');

  // Extract work_types list entries { type, effort, tier }
  const work_types = [];
  for (const line of yamlLines) {
    const m = line.match(/\{\s*type:\s*(\S+),\s*effort:\s*(\S+),\s*tier:\s*(\S+)\s*\}/);
    if (m) {
      work_types.push({
        type: m[1].replace(/[,}/]/g, ''),
        effort: m[2].replace(/[,}/]/g, ''),
        tier: m[3].replace(/[,}/]/g, ''),
      });
    }
  }

  return { model, work_types };
}

// ---- Difficulty inference ----
const EFFORT_TO_DIFFICULTY = { S: 2, M: 3, L: 4 };

function inferDifficulty(agentNames, agentFrontmatters) {
  // Conservative: median effort-rank of participating agents' DEFAULT tier
  const efforts = [];
  for (const name of agentNames) {
    const fm = agentFrontmatters[name];
    if (!fm || !fm.work_types || fm.work_types.length === 0) continue;
    // Default effort = the work_type for the agent's default model tier
    // If unclear, pick median
    const effortRanks = fm.work_types.map(wt => EFFORT_TO_DIFFICULTY[wt.effort] || 3);
    effortRanks.sort((a, b) => a - b);
    efforts.push(effortRanks[Math.floor(effortRanks.length / 2)]);
  }
  if (efforts.length === 0) return 3; // default M
  efforts.sort((a, b) => a - b);
  return efforts[Math.floor(efforts.length / 2)];
}

// ---- Ticket type classifier ----
function classifyTicketType(taskId, summary, agentCount) {
  if (/^FIX-|^REVISE-/i.test(taskId) || /\bfix\b|\bbug\b/i.test(summary)) return 'Bug';
  if (agentCount >= 4) return 'Project';
  return 'Feature';
}

// ═══════════════════════════════════════════════════════════════════════════
// §4 CORRELATE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * correlateRuns — merge signatures with transcript sessions.
 *
 * Strategy:
 *   (a) gitBranch match (coarse: signature task_id → STATUS branch → session gitBranch)
 *   (b) time-window overlap: [sig.startedMs, sig.completedMs] ∩ [sess.firstTs, sess.lastTs]
 *
 * EXACTLY ONE overlapping session on the correct branch → estimated:false
 * MULTIPLE or ZERO → estimated:true, tokens=null (or session-bucket if multi)
 */
function correlateRuns(signatures, sessions, statusMap, backfillFrom) {
  // Build branch → session(s) index
  const branchToSessions = {};
  for (const sess of sessions) {
    const br = sess.gitBranch;
    if (!br) continue;
    if (!branchToSessions[br]) branchToSessions[br] = [];
    branchToSessions[br].push(sess);
  }

  // Task → branch from STATUS
  const taskBranchMap = {};
  for (const [tid, info] of Object.entries(statusMap)) {
    if (info.branch) taskBranchMap[tid] = info.branch;
  }

  const runs = [];

  for (const sig of signatures) {
    const { taskId, agent, startedAt, completedAt, startedMs, completedMs, selfHash } = sig;

    // Fidelity
    const fi = fidelityOf(startedMs, backfillFrom);
    if (fi === null) continue; // before backfill window

    const eventId = sha256hex(`run:${taskId}:${agent}:${startedAt}:${selfHash}`).slice(0, 16);

    // Find candidate sessions by branch + time overlap
    const branch = taskBranchMap[taskId] || null;
    const candidateSessions = branch ? (branchToSessions[branch] || []) : sessions;

    // Time-window overlap check
    const overlapping = candidateSessions.filter(sess => {
      // sig window: [startedMs, completedMs] (if equal treat as point)
      const sigStart = startedMs || 0;
      const sigEnd = completedMs || startedMs || 0;
      const sessStart = sess.firstTs || 0;
      const sessEnd = sess.lastTs || sess.firstTs || 0;
      // Overlap: not (sigEnd < sessStart || sessEnd < sigStart)
      return !(sigEnd < sessStart || sessEnd < sigStart);
    });

    let tokens = null;
    let cost = null;
    let model = null;
    let estimated = true;

    if (overlapping.length === 1) {
      const sess = overlapping[0];
      model = sess.dominantModel;
      tokens = sess.totalTokens;
      const tierInfo = modelToTier(model);
      if (tierInfo && tokens !== null) {
        cost = (sess.billedInput / 1e6) * tierInfo.inPrice
             + (sess.sumOutput / 1e6) * tierInfo.outPrice;
      }
      // estimated:false only when branch matched + single session
      estimated = !branch || sess.hasCacheTokens || (tierInfo && tierInfo.isFable) ? true : false;
      // fable-mapped: always estimated on cost
      if (tierInfo && tierInfo.isFable) estimated = true;
      // cache tokens: cost estimated (single-rate approximation documented)
      if (sess.hasCacheTokens) estimated = true;
    } else if (overlapping.length > 1) {
      // Multi-session ambiguous: attribute full aggregate, estimated:true, run-level tokens=null
      // Roll up to ticket level in assembleTickets
      model = overlapping[0].dominantModel; // use first session's dominant as hint
      tokens = null; // ambiguous at run level
      cost = null;
      estimated = true;
    }
    // else: zero sessions → tokens=null, cost=null, estimated:true

    const role = AGENT_ROLE[agent] || 'backend-dev';
    if (!AGENT_ROLE[agent]) {
      stderr.write(`[collect] unknown agent role for "${agent}" — mapping to backend-dev\n`);
    }
    const domain = AGENT_DOMAIN[agent] || 'engineering';

    // Redact any .claude/beta/** paths from filesTouched before emission.
    // Signature files_touched arrays are copied verbatim from agent work; they
    // may include beta paths when an agent incidentally touched beta files.
    // We drop matching entries and record the count so redaction is visible.
    const { paths: filesTouchedClean, redacted: filesTouchedRedacted } =
      redactBetaPaths(sig.filesTouched);

    const run = {
      eventId,
      type: 'run',
      taskId,
      agent,
      agentDesignation: sig.agentDesignation,
      role,
      domain,
      ts: startedAt, // source timestamp
      startedAt,
      completedAt,
      durationMs: (startedMs !== null && completedMs !== null && completedMs > startedMs)
        ? completedMs - startedMs : null,
      tokens,
      reasoningTokens: null, // NO real source — never fabricated
      cost,
      model,
      modelTier: model ? (modelToTier(model)?.tier || null) : null,
      estimated,
      fidelity: fi,
      harnessPasssed: sig.harnessPasssed,
      postEditPassed: sig.postEditPassed,
      filesTouched: filesTouchedClean,
      filesTouchedRedacted,
      summary: sig.summary,
      nextRecipient: sig.nextRecipient,
      selfHash: sig.selfHash,
    };

    runs.push(run);
  }

  return runs;
}

/**
 * buildGates — construct gate records from:
 *   - Algol run signatures (verifier gates)
 *   - Algol report verdicts
 *   - Audit ndjson (lifecycle + future rail gates)
 *   - Handoffs (REVISE cycles → revised/blocked outcome)
 *   - STATUS.md human intervention markers
 */
function buildGates(runs, algolReports, auditEvents, handoffData, statusMap, railsMap, backfillFrom) {
  const gates = [];
  const railCategories = railsMap.rails || {};

  // ---- Algol verifier gates (from Algol run signatures) ----
  const algolRuns = runs.filter(r => r.agent === 'Algol');
  for (const run of algolRuns) {
    const { taskId, ts, startedAt, fidelity, estimated } = run;

    // Find matching Algol report
    // Convention: report filename starts with taskId
    const matchingReports = algolReports.filter(r =>
      r.fileName.startsWith(taskId) || r.fileName.toUpperCase().includes(taskId.replace(/-/g, ''))
    );

    let outcome = 'approved';
    let caughtIssues = 0;
    let catFromReport = 'Correctness';
    let estimatedGate = true;
    let reportPath = null;

    if (matchingReports.length > 0) {
      const rep = matchingReports[0]; // use first match
      outcome = rep.outcome;
      caughtIssues = rep.caughtIssues;
      catFromReport = rep.category;
      estimatedGate = rep.estimatedVerdict;
      reportPath = rep.filePath;
    }

    // Check if a REVISE cycle exists for this task → override outcome
    if (handoffData.reviseIds.has(taskId)) {
      // revised = REVISE handoff present AND >= 1 later signature exists for same taskId
      // with completedAt > the run's completedAt
      const laterRuns = runs.filter(r =>
        r.taskId === taskId &&
        r.agent !== 'Algol' &&
        r.completedAt &&
        run.completedAt &&
        parseTimestamp(r.completedAt) > parseTimestamp(run.completedAt)
      );
      outcome = laterRuns.length > 0 ? 'revised' : 'blocked';
      estimatedGate = false;
    }

    const gateId = sha256hex(`algolgate:${taskId}:${reportPath || ''}:${outcome}`).slice(0, 16);

    const tsMs = parseTimestamp(ts);
    const daysAgo = tsMs !== null
      ? Math.floor((parseTimestamp('2026-06-11T00:00:00Z') - tsMs) / 86400000)
      : null;

    gates.push({
      id: gateId,
      type: 'gate',
      taskId,
      ts,
      by: 'agent',
      outcome,
      caughtIssues,
      mitigated: null,   // NO real source
      category: catFromReport,
      humanMinutes: null, // NO real source
      domainId: 'qa',
      domainLabel: 'QA',
      domainColor: null,
      verifier: 'Algol',
      note: outcome,
      tags: [],
      daysAgo,
      fidelity: fidelity || fidelityOf(tsMs, backfillFrom),
      estimated: estimated || estimatedGate,
    });
  }

  // ---- Audit ndjson: lifecycle events + future rail gates ----
  for (const line of auditEvents) {
    const { ts, task_id: taskId, agent, event, path: ePath, sha256, exit_code, rail, session_id } = line;
    if (!ts || !taskId) continue;

    const tsMs = parseTimestamp(ts);
    const fi = fidelityOf(tsMs, backfillFrom);
    if (fi === null) continue;

    if (event === 'task-start' || event === 'task-stop' || event === 'signed-work' || event === 'hook-called') {
      // LIFECYCLE event
      const evId = sha256hex(`audit:${ts}:${taskId}:${agent||''}:${event}:${rail||''}:${sha256||''}`).slice(0, 16);
      gates.push({
        id: evId,
        type: 'lifecycle',
        taskId,
        ts,
        agent: agent || null,
        event,
        fidelity: fi,
        estimated: false,
      });
    }

    // Future: exit_code present + rail → gate event
    if (exit_code !== undefined && rail) {
      if (exit_code !== 0) {
        const cat = railCategories[rail]?.category || 'Correctness';
        if (!railCategories[rail]) {
          stderr.write(`[collect] unmapped rail: ${rail}\n`);
        }
        const evId = sha256hex(`audit:${ts}:${taskId}:${agent||''}:${event||'rail-fail'}:${rail}:${sha256||''}`).slice(0, 16);
        const tsMs2 = parseTimestamp(ts);
        const daysAgo = tsMs2 !== null
          ? Math.floor((parseTimestamp('2026-06-11T00:00:00Z') - tsMs2) / 86400000)
          : null;
        gates.push({
          id: evId,
          type: 'gate',
          taskId,
          ts,
          by: 'agent',
          outcome: 'blocked',
          caughtIssues: line.caughtIssues || 1,
          mitigated: null,
          category: cat,
          humanMinutes: null,
          domainId: AGENT_DOMAIN[agent] || 'engineering',
          domainLabel: agent || null,
          domainColor: null,
          verifier: agent || 'rail',
          note: `rail:${rail} exit:${exit_code}`,
          tags: [],
          daysAgo,
          fidelity: fi,
          estimated: false,
        });
      }
    }
  }

  // ---- Human gates from STATUS.md Peat-intervention markers ----
  for (const [taskId, info] of Object.entries(statusMap)) {
    if (!info.humanGate) continue;
    // Only emit when explicit intervention phrase found (conservative)
    const tsApprox = '2026-06-11T00:00:00Z'; // no real timestamp source; use sentinel
    const tsMs = parseTimestamp(tsApprox);
    const fi = fidelityOf(tsMs, backfillFrom);
    if (fi === null) continue;
    const gateId = sha256hex(`humangate:${taskId}:peat-intervention`).slice(0, 16);
    gates.push({
      id: gateId,
      type: 'human-gate',
      taskId,
      ts: tsApprox,
      by: 'human',
      outcome: 'approved',
      caughtIssues: 0,
      mitigated: null,
      category: null,
      humanMinutes: null,
      domainId: null,
      domainLabel: null,
      domainColor: null,
      verifier: 'You',
      note: 'Peat-authorized intervention (STATUS.md)',
      tags: [],
      daysAgo: 0,
      fidelity: fi,
      estimated: false,
    });
  }

  return gates;
}

/**
 * assembleTickets — group runs + gates by task_id → tracker ticket shape.
 */
function assembleTickets(runs, gates, statusMap, agentFrontmatters, handoffData, backfillFrom) {
  // Group by taskId
  const byTask = {};
  for (const run of runs) {
    if (!byTask[run.taskId]) byTask[run.taskId] = { runs: [], gates: [] };
    byTask[run.taskId].runs.push(run);
  }
  for (const gate of gates) {
    if (!gate.taskId) continue;
    if (!byTask[gate.taskId]) byTask[gate.taskId] = { runs: [], gates: [] };
    byTask[gate.taskId].gates.push(gate);
  }

  const tickets = [];

  for (const [taskId, { runs: taskRuns, gates: taskGates }] of Object.entries(byTask)) {
    if (taskRuns.length === 0) continue; // must have at least one signature

    const statusInfo = statusMap[taskId] || {};
    const agentNames = [...new Set(taskRuns.map(r => r.agent))];

    // Title: STATUS title or first non-verifier signature summary
    const nonAlgolRuns = taskRuns.filter(r => r.agent !== 'Algol');
    const title = statusInfo.title
      ? statusInfo.title.replace(/^##\s+/, '').split('·')[0].trim()
      : (nonAlgolRuns[0]?.summary || taskId);

    // Type
    const firstSummary = nonAlgolRuns[0]?.summary || '';
    const ticketType = classifyTicketType(taskId, firstSummary, agentNames.length);

    // Difficulty
    const difficulty = inferDifficulty(agentNames, agentFrontmatters);

    // Gates (only 'gate' and 'human-gate' types)
    const gateRecords = taskGates.filter(g => g.type === 'gate' || g.type === 'human-gate');

    // autonomous: every gate is by:agent
    const autonomous = gateRecords.length > 0 && gateRecords.every(g => g.by === 'agent');

    // Cost: sum over runs (null if all null; estimated if any estimated)
    let totalCost = null;
    let totalTokens = null;
    let anyEstimated = false;
    let costKnown = false;
    let tokensKnown = false;

    for (const run of taskRuns) {
      if (run.estimated) anyEstimated = true;
      if (run.cost !== null) {
        totalCost = (totalCost ?? 0) + run.cost;
        costKnown = true;
      }
      if (run.tokens !== null) {
        totalTokens = (totalTokens ?? 0) + run.tokens;
        tokensKnown = true;
      }
    }

    // actualHours: sum of run durations
    let totalDurationMs = null;
    for (const run of taskRuns) {
      if (run.durationMs !== null) {
        totalDurationMs = (totalDurationMs ?? 0) + run.durationMs;
      }
    }
    const actualHours = totalDurationMs !== null && totalDurationMs > 0
      ? totalDurationMs / 3600000 : null;

    // resolved: latest completed_at
    let latestCompletedMs = null;
    let latestCompletedSig = null;
    for (const run of taskRuns) {
      const ms = parseTimestamp(run.completedAt);
      if (ms !== null && (latestCompletedMs === null || ms > latestCompletedMs)) {
        latestCompletedMs = ms;
        latestCompletedSig = run.completedAt;
      }
    }

    let resolved = null;
    if (latestCompletedMs !== null) {
      const d = new Date(latestCompletedMs);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const key = `${y}-${m}`;
      resolved = {
        y,
        m: parseInt(m, 10),
        d: parseInt(day, 10),
        key,
        label: new Date(latestCompletedMs).toLocaleDateString('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' }),
      };
    }

    // Fidelity: min over events
    const allFidelities = [
      ...taskRuns.map(r => r.fidelity),
      ...gateRecords.map(g => g.fidelity),
    ].filter(Boolean);
    const fidelity = allFidelities.includes('backfill-low') ? 'backfill-low' : 'full';

    tickets.push({
      id: `tk:${taskId}`,
      key: taskId,
      title,
      type: ticketType,
      priority: statusInfo.priority || 'P2',
      difficulty,
      autonomous,
      gates: gateRecords,
      cost: costKnown ? totalCost : null,
      costKnown,
      tokens: tokensKnown ? totalTokens : null,
      tokensKnown,
      reasoningTokens: null,       // NO real source — never fabricated
      baselineHours: null,         // NO real source — Peat fills later
      baselineHoursKnown: false,
      actualHours,
      hoursSaved: null,            // NO real source (depends on baselineHours)
      hoursSavedKnown: false,
      estimated: anyEstimated,
      resolved,
      runs: taskRuns.length,
      fidelity,
      status: statusInfo.status || (taskRuns.length > 0 ? 'in-flight' : 'shipped'),
    });
  }

  // Sort by resolved date then key (deterministic)
  tickets.sort((a, b) => {
    const aMs = a.resolved ? parseTimestamp(`${a.resolved.y}-${String(a.resolved.m).padStart(2,'0')}-${String(a.resolved.d).padStart(2,'0')}T00:00:00Z`) || 0 : 0;
    const bMs = b.resolved ? parseTimestamp(`${b.resolved.y}-${String(b.resolved.m).padStart(2,'0')}-${String(b.resolved.d).padStart(2,'0')}T00:00:00Z`) || 0 : 0;
    if (aMs !== bMs) return aMs - bMs;
    return a.key.localeCompare(b.key);
  });

  return tickets;
}

// ═══════════════════════════════════════════════════════════════════════════
// §5 ROLLUPS
// ═══════════════════════════════════════════════════════════════════════════

function buildRollups(tickets, runs, backfillFrom) {
  // byModel: tier -> {tokens, cost, calls}
  const byModel = {};
  // byDomain: domain -> {tokens, cost, calls}
  const byDomain = {};
  // byRole: role -> {tokens, cost, calls, running, domain}
  const byRole = {};
  // totals
  let totalCost = 0, totalTokens = 0, totalCalls = 0;
  let totalRunning = 0, totalInFlight = 0, totalShipped = 0;

  // days: date -> {opus:0, sonnet:0, haiku:0}
  const daysMap = {};

  for (const run of runs) {
    const tier = run.modelTier || 'sonnet-4.5'; // default
    const domain = run.domain || 'engineering';
    const role = run.role || 'backend-dev';
    const cost = run.cost ?? 0;
    const tokens = run.tokens ?? 0;

    // byModel
    if (!byModel[tier]) byModel[tier] = { tokens: 0, cost: 0, calls: 0 };
    byModel[tier].tokens += tokens;
    byModel[tier].cost += cost;
    byModel[tier].calls += 1;

    // byDomain
    if (!byDomain[domain]) byDomain[domain] = { tokens: 0, cost: 0, calls: 0 };
    byDomain[domain].tokens += tokens;
    byDomain[domain].cost += cost;
    byDomain[domain].calls += 1;

    // byRole
    if (!byRole[role]) byRole[role] = { tokens: 0, cost: 0, calls: 0, running: 0, domain };
    byRole[role].tokens += tokens;
    byRole[role].cost += cost;
    byRole[role].calls += 1;

    totalCost += cost;
    totalTokens += tokens;
    totalCalls += 1;

    // days bucketing
    const sourceTs = run.startedAt;
    const tsMs = parseTimestamp(sourceTs);
    if (tsMs !== null) {
      const d = new Date(tsMs);
      const dayLabel = String(d.getUTCDate());
      if (!daysMap[dayLabel]) daysMap[dayLabel] = { _date: tsMs, opus: 0, sonnet: 0, haiku: 0 };
      const tier2 = run.modelTier || 'sonnet-4.5';
      if (tier2 === 'opus-4.5') daysMap[dayLabel].opus += cost;
      else if (tier2 === 'sonnet-4.5') daysMap[dayLabel].sonnet += cost;
      else if (tier2 === 'haiku-4') daysMap[dayLabel].haiku += cost;
    }
  }

  for (const ticket of tickets) {
    if (ticket.status === 'in-flight') totalInFlight++;
    else if (ticket.status === 'shipped') totalShipped++;
  }

  // days array: sorted by date, one entry per distinct date
  const days = Object.entries(daysMap)
    .sort((a, b) => a[1]._date - b[1]._date)
    .map(([label, d]) => ({ label, opus: d.opus, sonnet: d.sonnet, haiku: d.haiku }));

  // features: all tickets as in-flight + shipped features list
  const features = tickets.map(t => ({
    id: t.id,
    key: t.key,
    title: t.title,
    status: t.status,
    type: t.type,
    priority: t.priority,
    difficulty: t.difficulty,
    reach: null, // no real source
    domains: t.gates.map(g => g.domainId).filter(Boolean),
    gates: t.gates,
    resolved: t.resolved,
  }));

  // periods: months + quarters derived from real resolved dates
  const monthSet = {};
  const quarterSet = {};
  for (const t of tickets) {
    if (!t.resolved) continue;
    const key = t.resolved.key;
    monthSet[key] = (monthSet[key] || 0) + 1;
    const q = `${t.resolved.y}-Q${Math.ceil(t.resolved.m / 3)}`;
    quarterSet[q] = (quarterSet[q] || 0) + 1;
  }
  const periods = {
    months: Object.entries(monthSet).sort((a,b) => a[0].localeCompare(b[0])).map(([k, count]) => ({ key: k, count })),
    quarters: Object.entries(quarterSet).sort((a,b) => a[0].localeCompare(b[0])).map(([k, count]) => ({ key: k, count })),
  };

  // validation: REVISE/blocked gate counts
  const allGates = tickets.flatMap(t => t.gates);
  const gateRevised = allGates.filter(g => g.outcome === 'revised').length;
  const gateBlocked = allGates.filter(g => g.outcome === 'blocked').length;
  const gateApproved = allGates.filter(g => g.outcome === 'approved').length;
  const validation = {
    gateRevised,
    gateBlocked,
    gateApproved,
    totalGates: allGates.length,
    autonomyRate: allGates.length > 0
      ? allGates.filter(g => g.by === 'agent').length / allGates.length
      : 0,
  };

  // latestSourceTs: max over all run timestamps (data-derived, not wall-clock)
  // Track maxMs separately to avoid string/number comparison confusion.
  let latestSourceTs = null;
  let latestSourceMs = null;
  for (const run of runs) {
    const ms = parseTimestamp(run.completedAt);
    if (ms !== null && (latestSourceMs === null || ms > latestSourceMs)) {
      latestSourceMs = ms;
      latestSourceTs = run.completedAt;
    }
  }

  // fidelity counts
  const fidelityCounts = { full: 0, 'backfill-low': 0 };
  for (const run of runs) {
    if (run.fidelity) fidelityCounts[run.fidelity] = (fidelityCounts[run.fidelity] || 0) + 1;
  }

  return {
    tickets,
    features,
    byModel,
    byDomain,
    byRole,
    totals: {
      calls: totalCalls,
      running: totalRunning,
      inFlight: totalInFlight,
      shipped: totalShipped,
      cost: totalCost,
      tokens: totalTokens,
      reasoningTokens: 0, // null-safe 0 per spec (no real source but safe for summarizeTickets)
    },
    days,
    validation,
    periods,
    meta: {
      latestSourceTs,
      fidelityCounts,
      generatedFromCommit: null, // no real source
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// §6 EMIT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * canonicalJSON — serializes obj with sorted keys for determinism.
 */
function canonicalJSON(obj, indent) {
  const seen = new Set();
  function sortReplacer(key, value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (seen.has(value)) return value;
      seen.add(value);
      return Object.fromEntries(
        Object.keys(value).sort().map(k => [k, value[k]])
      );
    }
    return value;
  }
  return JSON.stringify(obj, sortReplacer, indent);
}

/**
 * serializeEvents — converts all events to sorted NDJSON string.
 * Sort order: (sourceTimestamp ASC, eventId ASC) — total order, deterministic.
 */
function serializeEvents(events) {
  const sorted = [...events].sort((a, b) => {
    const aTs = parseTimestamp(a.ts) || 0;
    const bTs = parseTimestamp(b.ts) || 0;
    if (aTs !== bTs) return aTs - bTs;
    return (a.eventId || a.id || '').localeCompare(b.eventId || b.id || '');
  });
  return sorted.map(e => canonicalJSON(e)).join('\n') + '\n';
}

/**
 * writeEventsNDJSON — writes (or rewrites) the events file.
 */
function writeEventsNDJSON(events, outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, serializeEvents(events), 'utf8');
}

/**
 * writeDashboardJSON — writes dashboard.json.
 */
function writeDashboardJSON(dashboard, outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, canonicalJSON(dashboard, 2), 'utf8');
}

// ═══════════════════════════════════════════════════════════════════════════
// §7 CLI
// ═══════════════════════════════════════════════════════════════════════════

function parseArgs(args) {
  const result = { task: null, from: null, selftest: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--task' && args[i + 1]) { result.task = args[++i]; }
    else if (args[i] === '--from' && args[i + 1]) { result.from = args[++i]; }
    else if (args[i] === '--selftest') { result.selftest = true; }
    else if (args[i].startsWith('--')) {
      stderr.write(`[collect] unknown flag: ${args[i]} — ignoring\n`);
    }
  }
  return result;
}

/**
 * collectAll — full rebuild: read all sources, correlate, emit.
 */
function collectAll(backfillFrom) {
  // Paths
  const sigDir = join(REPO_ROOT, '.claude', 'signatures');
  const handoffsDir = join(REPO_ROOT, '.claude', 'handoffs');
  const auditDir = join(REPO_ROOT, '.harness', 'audit');
  const reportsDir = join(REPO_ROOT, 'docs', 'qa', 'REPORTS');
  const statusPath = join(REPO_ROOT, 'docs', 'team', 'STATUS.md');
  const agentsDir = join(REPO_ROOT, '.claude', 'agents');

  // Load all sources
  const signatures = loadAllSignatures(sigDir);
  const sessions = loadAllTranscripts();
  const auditEvents = parseAuditStream(auditDir);
  const algolReports = loadAlgolReports(reportsDir);
  const handoffData = loadHandoffs(handoffsDir);
  const statusMap = parseStatus(statusPath);
  const railsMapData = readJSONSafe(RAILS_MAP) || { rails: {} };

  // Load agent frontmatters for difficulty inference
  const agentFrontmatters = {};
  if (existsSync(agentsDir)) {
    for (const f of listDir(agentsDir, '.md')) {
      const name = basename(f, '.md');
      // Titlecase the name
      const agentName = name.charAt(0).toUpperCase() + name.slice(1);
      const fm = parseFrontmatter(join(agentsDir, f));
      if (fm) agentFrontmatters[agentName] = fm;
    }
  }

  // §4 Correlate
  const runs = correlateRuns(signatures, sessions, statusMap, backfillFrom);
  const gates = buildGates(runs, algolReports, auditEvents, handoffData, statusMap, railsMapData, backfillFrom);
  const tickets = assembleTickets(runs, gates, statusMap, agentFrontmatters, handoffData, backfillFrom);

  // §5 Rollups
  const dashboard = buildRollups(tickets, runs, backfillFrom);

  // All events for NDJSON (runs + all gates/lifecycle)
  const allEvents = [
    ...runs.map(r => ({ ...r, eventId: r.eventId })),
    ...gates,
  ];

  // Reconcile report to stderr
  const sigTaskIds = new Set(signatures.map(s => s.taskId));
  const statusTaskIds = Object.keys(statusMap);
  const statusWithNoSig = statusTaskIds.filter(id => !sigTaskIds.has(id));
  stderr.write(`[collect] reconcile: tickets_emitted=${tickets.length} status_tasks=${statusTaskIds.length} signatures_in_corpus=${signatures.length} status_tasks_with_no_signature=${statusWithNoSig.length}\n`);
  if (statusWithNoSig.length > 0) {
    stderr.write(`[collect] coverage gaps (STATUS without signature): ${statusWithNoSig.slice(0, 10).join(', ')}\n`);
  }

  return { runs, gates, tickets, allEvents, dashboard };
}

/**
 * incrementalTask — re-derive events for a single taskId, merge into existing file.
 */
function incrementalTask(taskId, backfillFrom) {
  // Full rebuild but filter to just this task's events + reintegrate
  const { allEvents, dashboard } = collectAll(backfillFrom);

  // Read existing events.ndjson
  let existingEvents = [];
  if (existsSync(OUT_EVENTS)) {
    existingEvents = readLinesNDJSON(OUT_EVENTS);
  }

  // Drop all existing events with this taskId
  const retained = existingEvents.filter(e => e.taskId !== taskId && e.task_id !== taskId);

  // Add freshly derived events for this task
  const fresh = allEvents.filter(e => e.taskId === taskId || e.task_id === taskId);

  // Merge + sort
  const merged = [...retained, ...fresh];
  merged.sort((a, b) => {
    const aTs = parseTimestamp(a.ts) || 0;
    const bTs = parseTimestamp(b.ts) || 0;
    if (aTs !== bTs) return aTs - bTs;
    return (a.eventId || a.id || '').localeCompare(b.eventId || b.id || '');
  });

  writeEventsNDJSON(merged, OUT_EVENTS);
  writeDashboardJSON(dashboard, OUT_DASHBOARD);

  stderr.write(`[collect] incremental --task ${taskId}: ${fresh.length} fresh events merged\n`);
}

// ═══════════════════════════════════════════════════════════════════════════
// §8 SELF-CHECKS
// ═══════════════════════════════════════════════════════════════════════════

function runSelfChecks() {
  let passed = true;

  // 1. Allowlist self-test: BETA path must throw (lowercase)
  try {
    assertPathAllowed(join(ROOT_R1, '.claude', 'beta', 'ROOM.md'));
    stderr.write('[selftest] FAIL: beta path did NOT throw\n');
    passed = false;
  } catch (e) {
    if (e.message.includes('BETA-PRIVACY-VIOLATION')) {
      process.stdout.write('allowlist: beta DENY ok\n');
    } else {
      stderr.write(`[selftest] FAIL: beta path threw unexpected: ${e.message}\n`);
      passed = false;
    }
  }

  // 1b. Case-insensitive BETA path: mixed-case and relative paths must match
  // On APFS the resolved path from realpathSync may normalise case, but we
  // defend in-process before the filesystem resolves it.
  {
    const cases = [
      ['/Users/foo/.CLAUDE/BETA/ROOM.md', true],  // absolute mixed-case
      ['.claude/beta/ACCESS-LOG.md',       true],  // relative path from sig files_touched
      ['.CLAUDE/BETA/grants/.gitkeep',     true],  // relative, upper-case
      ['.claude/handoffs/foo.md',          false], // safe — must not match
      ['/repo/content/articles/beta/about.mdx', false], // 'beta' in non-beta segment
    ];
    let caseOk = true;
    for (const [path, expected] of cases) {
      if (isBetaPath(path) !== expected) {
        stderr.write(`[selftest] FAIL: isBetaPath("${path}") expected ${expected}\n`);
        passed = false;
        caseOk = false;
      }
    }
    if (caseOk) process.stdout.write('allowlist: isBetaPath mixed-case ok\n');
  }

  // 1c. redactBetaPaths: array with beta paths — both absolute and relative
  {
    const sample = [
      '/repo/.claude/beta/ROOM.md',        // absolute — must redact
      '/repo/content/articles/foo.mdx',    // safe — must keep
      '/repo/.claude/BETA/notes.md',       // uppercase — must redact
      '/repo/scripts/factory/collect.mjs', // safe — must keep
      '.claude/beta/ACCESS-LOG.md',        // relative (from sig files_touched) — must redact
      '.claude/handoffs/foo.md',           // safe — must keep
    ];
    const { paths, redacted } = redactBetaPaths(sample);
    if (redacted !== 3 || paths.length !== 3) {
      stderr.write(`[selftest] FAIL: redactBetaPaths expected redacted=3 paths=3, got redacted=${redacted} paths=${paths.length}\n`);
      passed = false;
    } else {
      process.stdout.write('redactBetaPaths: count ok\n');
    }
  }

  // 2. /etc/passwd must throw
  try {
    assertPathAllowed('/etc/passwd');
    stderr.write('[selftest] FAIL: /etc/passwd did NOT throw\n');
    passed = false;
  } catch (e) {
    if (e.message.includes('PATH-ALLOWLIST-VIOLATION') || e.message.includes('BETA-PRIVACY')) {
      process.stdout.write('allowlist: outside-root DENY ok\n');
    } else {
      stderr.write(`[selftest] FAIL: /etc/passwd threw unexpected: ${e.message}\n`);
      passed = false;
    }
  }

  // 3. Determinism check: serialize a small synthetic model twice, assert ===
  const synth = {
    tickets: [{ id: 'tk:TEST', key: 'TEST', cost: 1.23, tokens: 100 }],
    features: [],
    byModel: { 'sonnet-4.5': { tokens: 100, cost: 1.23, calls: 1 } },
    totals: { calls: 1, running: 0, inFlight: 0, shipped: 0, cost: 1.23, tokens: 100, reasoningTokens: 0 },
  };
  const s1 = canonicalJSON(synth, 2);
  const s2 = canonicalJSON(synth, 2);
  if (s1 !== s2) {
    stderr.write('[selftest] FAIL: canonicalJSON not deterministic\n');
    passed = false;
  } else {
    process.stdout.write('determinism: canonicalJSON stable ok\n');
  }

  // 4. NaN guard: no NaN/Infinity in the synthetic model
  const nums = [];
  function walkNums(obj) {
    if (obj === null || obj === undefined) return;
    if (typeof obj === 'number') { nums.push(obj); return; }
    if (Array.isArray(obj)) { obj.forEach(walkNums); return; }
    if (typeof obj === 'object') { Object.values(obj).forEach(walkNums); }
  }
  walkNums(synth);
  const badNums = nums.filter(n => isNaN(n) || !isFinite(n));
  if (badNums.length > 0) {
    stderr.write(`[selftest] FAIL: NaN/Infinity in synthetic: ${badNums}\n`);
    passed = false;
  } else {
    process.stdout.write('nan-guard: synthetic ok\n');
  }

  return passed;
}

/**
 * nanGuard — walks dashboard numeric leaves, asserts none are NaN/Infinity.
 */
function nanGuard(obj, path) {
  if (obj === null || obj === undefined) return;
  if (typeof obj === 'number') {
    if (isNaN(obj) || !isFinite(obj)) {
      throw new Error(`NaN/Infinity guard failed at ${path}: ${obj}`);
    }
    return;
  }
  if (Array.isArray(obj)) { obj.forEach((v, i) => nanGuard(v, `${path}[${i}]`)); return; }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) nanGuard(v, `${path}.${k}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

const cliArgs = parseArgs(argv.slice(2));

// --selftest: run §8 only and exit
if (cliArgs.selftest) {
  const ok = runSelfChecks();
  exit(ok ? 0 : 1);
}

const backfillFrom = cliArgs.from || BACKFILL_FROM_DEFAULT;

if (cliArgs.task) {
  // Incremental mode
  const selfOk = runSelfChecks();
  if (!selfOk) {
    stderr.write('[collect] self-check FAILED — aborting\n');
    exit(1);
  }
  incrementalTask(cliArgs.task, backfillFrom);
  stderr.write(`[collect] incremental mode complete for task: ${cliArgs.task}\n`);
} else {
  // Full rebuild
  const selfOk = runSelfChecks();
  if (!selfOk) {
    stderr.write('[collect] self-check FAILED — aborting\n');
    exit(1);
  }

  const { allEvents, dashboard } = collectAll(backfillFrom);

  // §8 determinism guard: serialize twice in-memory, assert ===
  const evStr1 = serializeEvents(allEvents);
  const evStr2 = serializeEvents(allEvents);
  if (evStr1 !== evStr2) {
    stderr.write('[collect] DETERMINISM FAILURE in events serialization — aborting\n');
    exit(1);
  }
  const dbStr1 = canonicalJSON(dashboard, 2);
  const dbStr2 = canonicalJSON(dashboard, 2);
  if (dbStr1 !== dbStr2) {
    stderr.write('[collect] DETERMINISM FAILURE in dashboard serialization — aborting\n');
    exit(1);
  }

  // §8 NaN guard
  try {
    nanGuard(dashboard, 'dashboard');
  } catch (e) {
    stderr.write(`[collect] ${e.message} — aborting\n`);
    exit(1);
  }

  // Write outputs
  writeEventsNDJSON(allEvents, OUT_EVENTS);
  writeDashboardJSON(dashboard, OUT_DASHBOARD);

  stderr.write(`[collect] full rebuild complete: ${allEvents.filter(e=>e.type==='run').length} runs, ${allEvents.filter(e=>e.type==='gate'||e.type==='human-gate').length} gates, ${dashboard.tickets.length} tickets\n`);
}

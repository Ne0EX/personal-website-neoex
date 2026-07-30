#!/usr/bin/env tsx
/**
 * scripts/audit-voice.ts — zero-API, always-runnable voice-compliance audit
 * for the NETRA résumé survey surface.
 *
 * Owner: Arcturus (α-NET-05) · S11, redesign-resume-neoex plan Part A.
 * Implements lib/netra/voice.md §5's audit-detectable patterns
 * (PATTERN-01..09, WARN-01..05, REQUIRED-01..04) plus two surface-specific
 * backstops named in the redesign plan: a hardcoded-count grep and a
 * literal phone-number grep.
 *
 * MUST be invoked as `tsx --conditions react-server scripts/audit-voice.ts`
 * — wired into package.json's "audit:voice" script. lib/netra/prompt.ts
 * does `import "server-only"`, and that package's default (non-react-server)
 * export unconditionally throws on import (verified against the installed
 * package: node_modules/server-only/index.js). Node's plain module
 * resolution never sets the "react-server" custom condition on its own —
 * only Next.js's server-component bundler does — so a bare
 * `tsx scripts/audit-voice.ts` crashes immediately trying to import
 * buildSystemPrompt. `--conditions react-server` makes Node's `exports`
 * resolution pick server-only's `react-server` branch (`empty.js`, a no-op),
 * the same effect Next's bundler gets for free. Verified by hand before this
 * script was written: a plain `tsx` import of prompt.ts throws
 * `Error: This module cannot be imported from a Client Component module`;
 * adding the flag resolves it cleanly.
 *
 * Inputs (per voice.md §5.4, adapted to this surface — three pools):
 *   (a) tests/netra/transcripts/*.json — real model transcripts, if any exist
 *       (written by scripts/eval-netra.ts; none exist until a live run
 *       happens, since this environment has no AI_GATEWAY_API_KEY — see
 *       that script). Transcript-dependent checks (WARN-01..03, half of
 *       PATTERN-09) report a PASS-with-note rather than silently skipping.
 *   (b) lib/netra/prompt.ts's BUILT string (via buildSystemPrompt()) +
 *       every ARCHIVE node's label/brief (lib/netra/archive.ts) +
 *       lib/netra/constants.ts's exported strings.
 *   (c) components/netra/*.tsx — shipped copy strings. This is Sirius's
 *       territory (component implementation); findings here are reported,
 *       never fixed by this agent.
 *
 * Design note — why (b) scans prompt.ts's BUILT STRING, not its raw source:
 * prompt.ts's source is dense with doc comments and with meta-instructional
 * prose that names forbidden phrases IN ORDER TO PROHIBIT THEM — e.g.
 * `no "as an ai" / "language model" / "chatbot"`, `no "i'm sorry" openers`.
 * Scanning that text naively would flag the prohibition ITSELF as a
 * violation, which is backwards: PATTERN-03/05/07 exist to catch a REPLY
 * that says "as an ai", not an instruction forbidding it. Two things follow:
 *   1. REQUIRED-01..04 deliberately target this exact meta-prose — checking
 *      that a prohibition EXISTS is precisely what those checks do — so
 *      they run against the built string with no exemption.
 *   2. PATTERN-03/04/05/07, when scanning the built prompt (and ONLY the
 *      built prompt — every other pool is pure voice-OUTPUT with no
 *      instructional prose, so no exemption applies there), skip a match
 *      that is immediately preceded by a negation cue ("no", "not", "never",
 *      "don't", "doesn't", "avoid") within NEGATION_WINDOW characters. This
 *      mirrors voice.md's own half-acknowledgment of the same asymmetry for
 *      PATTERN-08 ("false positive risk: medium … treat as warning, not
 *      hard block"). PATTERN-01 (emoji), PATTERN-02 (exclamation), and
 *      PATTERN-06 ("outside the worldline…") get NO exemption anywhere:
 *      none of those legitimately appear in ANY instructional prose either,
 *      so an unqualified match is always real.
 *
 * Output format (per voice.md §5.4, one finding per line):
 *   FAIL  <loc>  <rule-id>  <description>
 *   WARN  <loc>  <rule-id>  <description>
 *   PASS  <loc>  <rule-id>  <description>
 *   MISS  <loc>  <rule-id>  <description>
 * (superset of the strict §5.4 table — PASS/MISS lines here also carry a
 * `loc` column for traceability; strictly more information, not less.)
 *
 * Exit codes (voice.md §5.4, extended with two of this script's own):
 *   0 — no FAIL, no MISS
 *   1 — one or more FAIL findings
 *   2 — one or more MISS findings (no FAIL)
 *   3 — script error (malformed input, file not found, import crash)
 * (WARN findings never affect the exit code.)
 *
 * Pre-TASK-51 SKIP clause (voice.md §5.4) is moot in this worktree —
 * lib/netra/prompt.ts already exists (S3 shipped it), so REQUIRED-01..04
 * always run here.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { ARCHIVE } from "../lib/netra/archive";
import { buildSystemPrompt } from "../lib/netra/prompt";
import { DORMANCY, NO_TRACE, REFUSAL_OUT_OF_FRAME } from "../lib/netra/constants";

// ── plumbing ──────────────────────────────────────────────────────────────

type Level = "FAIL" | "WARN" | "PASS" | "MISS";
interface Finding {
  level: Level;
  loc: string;
  ruleId: string;
  detail: string;
}

const findings: Finding[] = [];
function report(level: Level, loc: string, ruleId: string, detail: string): void {
  findings.push({ level, loc, ruleId, detail });
}

const ROOT = path.join(__dirname, "..");

// ── copy pools ────────────────────────────────────────────────────────────

interface CopySpan {
  loc: string;
  text: string;
  /** true only for prompt.ts's built string — enables the negation-context exemption described in the header. */
  isInstructional: boolean;
}

const builtPrompt = buildSystemPrompt();

const promptSpan: CopySpan = { loc: "lib/netra/prompt.ts (built)", text: builtPrompt, isInstructional: true };

const archiveSpans: CopySpan[] = ARCHIVE.flatMap((node) => [
  { loc: `lib/netra/archive.ts :: ${node.id}.label`, text: node.label, isInstructional: false },
  { loc: `lib/netra/archive.ts :: ${node.id}.brief`, text: node.brief, isInstructional: false },
]);

const constantsSpans: CopySpan[] = [
  { loc: "lib/netra/constants.ts :: REFUSAL_OUT_OF_FRAME", text: REFUSAL_OUT_OF_FRAME, isInstructional: false },
  { loc: "lib/netra/constants.ts :: NO_TRACE", text: NO_TRACE, isInstructional: false },
  { loc: "lib/netra/constants.ts :: DORMANCY.instrument", text: DORMANCY.instrument, isInstructional: false },
  { loc: "lib/netra/constants.ts :: DORMANCY.companionEn", text: DORMANCY.companionEn, isInstructional: false },
  { loc: "lib/netra/constants.ts :: DORMANCY.companionTh", text: DORMANCY.companionTh, isInstructional: false },
];

/**
 * Strips `/* *\/` block comments (JSDoc included) and `//` line comments
 * from TypeScript source before copy-extraction runs. This codebase's doc
 * comments heavily use backtick-quoted inline code spans to reference
 * identifiers (e.g. `` `useSyncExternalStore` ``, `` `hidden={!open}` `` —
 * both real examples from components/netra/*.tsx) — without stripping
 * comments FIRST, extractComponentCopy's template-literal regex cannot
 * tell a markdown-style code span inside a comment from a real TS template
 * literal in executable code, and will pull the comment's prose in as if
 * it were shipped visitor-facing copy (confirmed empirically: an
 * intermediate version of this script flagged `!important` — CSS syntax
 * quoted inside a comment describing a print rule — and `!open` — quoted
 * inside a comment's `` `hidden={!open}` `` code-span — as PATTERN-02
 * exclamation-mark violations; neither string ever ships to a visitor).
 * The `(^|[^:])` guard on the line-comment pass avoids eating a `//` that
 * is part of a URL (`https://…`); none of these files have one today, but
 * the guard costs nothing and prevents a silent regression if one is added.
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * Extracts visitor-facing "copy" from a .tsx file's COMMENT-STRIPPED
 * source: quoted string literals, template literals, and bare JSX text
 * nodes (a run of characters between `>` and `<` that isn't a JSX
 * expression, i.e. no `{`/`}`). This is deliberately NOT a whole-file scan
 * — a component file's raw text is mostly TypeScript code, and code is
 * full of legitimate `!` (negation, non-null assertion, `!==`) that has
 * nothing to do with NETRA's voice (confirmed empirically: an early
 * whole-file-scan run flagged `!open`, `!container`, `!lastText` — real
 * code, not comments — as PATTERN-02 violations too, the exact "code vs.
 * content" ambiguity this function exists to avoid, same category as the
 * `!part`/`!seen.has` operators in lib/netra/archive.ts that motivated
 * importing ARCHIVE's runtime values instead of grepping that file's
 * source).
 */
function extractComponentCopy(fileText: string): string {
  const stripped = stripComments(fileText);
  const strings: string[] = [];
  for (const m of stripped.matchAll(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g)) strings.push(m[0].slice(1, -1));
  for (const m of stripped.matchAll(/`(?:[^`\\]|\\.)*`/g)) strings.push(m[0].slice(1, -1));
  for (const m of stripped.matchAll(/>([^<>{}\n]+)</g)) {
    const t = m[1].trim();
    if (t) strings.push(t);
  }
  return strings.join("\n");
}

const NETRA_COMPONENTS_DIR = path.join(ROOT, "components/netra");
const componentSpans: CopySpan[] = existsSync(NETRA_COMPONENTS_DIR)
  ? readdirSync(NETRA_COMPONENTS_DIR)
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => ({
        loc: `components/netra/${f}`,
        text: extractComponentCopy(readFileSync(path.join(NETRA_COMPONENTS_DIR, f), "utf8")),
        isInstructional: false,
      }))
  : [];

interface TranscriptEntry {
  loc: string;
  text: string;
  category?: string;
}

const TRANSCRIPTS_DIR = path.join(ROOT, "tests/netra/transcripts");
const transcriptEntries: TranscriptEntry[] = [];
if (existsSync(TRANSCRIPTS_DIR)) {
  for (const f of readdirSync(TRANSCRIPTS_DIR)) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(readFileSync(path.join(TRANSCRIPTS_DIR, f), "utf8"));
      if (typeof raw?.text === "string") {
        transcriptEntries.push({ loc: `tests/netra/transcripts/${f}`, text: raw.text, category: raw?.case?.category });
      }
    } catch {
      report("WARN", `tests/netra/transcripts/${f}`, "TRANSCRIPT-PARSE", "could not parse as JSON — skipped");
    }
  }
}
const transcriptSpans: CopySpan[] = transcriptEntries.map((t) => ({ loc: t.loc, text: t.text, isInstructional: false }));

const allSpans: CopySpan[] = [promptSpan, ...archiveSpans, ...constantsSpans, ...componentSpans, ...transcriptSpans];

// ── PATTERN-01 · emoji (canon instrument glyphs excluded) ──────────────────

const CANON_GLYPHS = new Set(["◎", "◇", "○", "◆", "△", "∇", "§", "α", "·", "⟶", "—"]);

function scanEmoji(spans: CopySpan[]): void {
  let any = false;
  for (const span of spans) {
    for (const ch of span.text) {
      const cp = ch.codePointAt(0);
      if (cp === undefined) continue;
      const inEmojiRange = (cp >= 0x1f300 && cp <= 0x1ffff) || (cp >= 0x2600 && cp <= 0x26ff) || (cp >= 0x2700 && cp <= 0x27bf);
      if (inEmojiRange && !CANON_GLYPHS.has(ch)) {
        any = true;
        report("FAIL", span.loc, "PATTERN-01", `emoji-range character "${ch}" (U+${cp.toString(16).toUpperCase()})`);
      }
    }
  }
  if (!any) report("PASS", "(all scanned spans)", "PATTERN-01", "no emoji found (canon instrument glyphs excluded)");
}

// ── generic pattern scanner (PATTERN-02/03/04/05/06/07) ────────────────────

const NEGATION_WINDOW = 20;
const NEGATION_CUES = ["no", "not", "never", "don't", "doesn't", "avoid"];

function isNegatedContext(text: string, matchIndex: number): boolean {
  const before = text.slice(Math.max(0, matchIndex - NEGATION_WINDOW), matchIndex).toLowerCase();
  return NEGATION_CUES.some((cue) => before.includes(cue));
}

function scanPattern(ruleId: string, regex: RegExp, spans: CopySpan[], opts: { exemptNegatedInInstructional?: boolean } = {}): void {
  let any = false;
  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  for (const span of spans) {
    const re = new RegExp(regex.source, flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(span.text))) {
      if (opts.exemptNegatedInInstructional && span.isInstructional && isNegatedContext(span.text, m.index)) {
        // prohibition, not a violation — see header note.
      } else {
        any = true;
        report("FAIL", span.loc, ruleId, `matched "${m[0]}" at index ${m.index}`);
      }
      if (m[0].length === 0) re.lastIndex += 1; // guard zero-width matches
    }
  }
  if (!any) report("PASS", "(all scanned spans)", ruleId, "no violations found");
}

scanEmoji(allSpans);
scanPattern("PATTERN-02", /!/, allSpans);
scanPattern("PATTERN-03", /as an ai|as a language model|as a chatbot|i am an ai|i'm an ai|i am claude|powered by/i, allSpans, { exemptNegatedInInstructional: true });
scanPattern("PATTERN-04", /\b(gonna|wanna|kinda|sorta|gotta)\b/i, allSpans, { exemptNegatedInInstructional: true });
scanPattern("PATTERN-05", /(^|\n)\s*(i'?m sorry|i am sorry|sorry,|apologies,)/im, allSpans, { exemptNegatedInInstructional: true });
scanPattern("PATTERN-06", /outside the worldline\.\s*no signal\./i, allSpans);
scanPattern("PATTERN-07", /let me know if you want|feel free to ask/i, allSpans, { exemptNegatedInInstructional: true });

// ── PATTERN-08 · "the author" near "peat" (soft — WARN per voice.md's own mitigation) ──

function scanPattern08(spans: CopySpan[]): void {
  let any = false;
  for (const span of spans) {
    const re = /the author/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(span.text))) {
      const window = span.text.slice(Math.max(0, m.index - 200), m.index + 200).toLowerCase();
      if (window.includes("peat")) {
        any = true;
        report("WARN", span.loc, "PATTERN-08", `"the author" within 200 chars of "peat" at index ${m.index} — too formal/detached (voice.md soft-warns; human review advised)`);
      }
    }
  }
  if (!any) report("PASS", "(all scanned spans)", "PATTERN-08", "no 'the author' near 'peat' found");
}
scanPattern08(allSpans);

// ── PATTERN-09 · instrument register (ALL-CAPS bleed) inside a refusal block ──

function upperCaseRatio(text: string): number | null {
  const letters = text.match(/[A-Za-z]/g);
  if (!letters || letters.length === 0) return null; // no Latin letters (e.g. pure Thai) — ratio undefined, not a violation
  const upper = text.match(/[A-Z]/g) ?? [];
  return upper.length / letters.length;
}

function scanPattern09(): void {
  let any = false;
  const section = builtPrompt.split("── refusal templates")[1]?.split("── tool protocol")[0] ?? "";
  const quoteRe = /"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = quoteRe.exec(section))) {
    const ratio = upperCaseRatio(m[1]);
    if (ratio !== null && ratio > 0.4) {
      any = true;
      report("FAIL", "lib/netra/prompt.ts (built) :: refusal templates", "PATTERN-09", `refusal quote is ${(ratio * 100).toFixed(0)}% uppercase: "${m[1]}"`);
    }
  }
  for (const t of transcriptEntries) {
    if (t.category !== "refusal") continue;
    const ratio = upperCaseRatio(t.text);
    if (ratio !== null && ratio > 0.4) {
      any = true;
      report("FAIL", t.loc, "PATTERN-09", `refusal transcript reply is ${(ratio * 100).toFixed(0)}% uppercase`);
    }
  }
  if (!any) report("PASS", "(refusal templates + refusal-category transcripts)", "PATTERN-09", "no ALL-CAPS-bleed refusal blocks found");
}
scanPattern09();

// ── WARN-01..03 · transcript-dependent (reply length, hedges, filler openers) ──

if (transcriptEntries.length === 0) {
  report("PASS", "tests/netra/transcripts/", "WARN-01..03", "no transcripts present (eval:netra has not produced a live run in this environment) — transcript-dependent warnings skipped, not scored as failures");
} else {
  for (const t of transcriptEntries) {
    const sentences = t.text.split(/(?<=[.?!])\s+/).filter(Boolean);
    if (sentences.length > 4) {
      report("WARN", t.loc, "WARN-01", `${sentences.length} sentences — exceeds the 4-sentence default without an explicit depth request`);
    }
    const hedges = t.text.match(/\b(i think|i believe|i read it as|to me it reads)\b/gi) ?? [];
    if (hedges.length > 1) {
      report("WARN", t.loc, "WARN-02", `${hedges.length} hedges in one reply — one is sufficient`);
    }
    if (/(^|\.\s)(well,|so,|actually,|basically,)/i.test(t.text)) {
      report("WARN", t.loc, "WARN-03", "conversational filler opener found");
    }
  }
}

// ── WARN-04 · เจ้าของบ้าน overuse ───────────────────────────────────────────

{
  const count = (builtPrompt.match(/เจ้าของบ้าน/g) ?? []).length;
  if (count > 1) {
    report("WARN", "lib/netra/prompt.ts (built)", "WARN-04", `เจ้าของบ้าน appears ${count} times — first use is atmospheric, repeats read as gimmicky`);
  } else {
    report("PASS", "lib/netra/prompt.ts (built)", "WARN-04", `เจ้าของบ้าน appears ${count} time(s)`);
  }
}

// ── WARN-05 · Peat-flattery signals ─────────────────────────────────────────

{
  let any = false;
  for (const span of allSpans) {
    const re = /brilliant|genius|remarkably|exceptionally/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(span.text))) {
      const window = span.text.slice(Math.max(0, m.index - 50), m.index + 50).toLowerCase();
      if (/\b(peat|he|him)\b/.test(window)) {
        any = true;
        report("WARN", span.loc, "WARN-05", `flattery-adjacent word "${m[0]}" near a peat-reference — human review advised`);
      }
    }
  }
  if (!any) report("PASS", "(all scanned spans)", "WARN-05", "no flattery signals found");
}

// ── REQUIRED-01..04 · structural markers in the built system prompt ────────

function requiredConcept(id: string, description: string, regex: RegExp): boolean {
  const present = regex.test(builtPrompt);
  report(present ? "PASS" : "MISS", "lib/netra/prompt.ts (built)", id, description);
  return present;
}

{
  const c1 = requiredConcept("REQUIRED-01a", "archive fact cue", /in\s*\(?file[\s—-]*\d{3}\)?|the archive shows|archive fact/i);
  const c2 = requiredConcept("REQUIRED-01b", "pattern read cue", /across the archive|the pattern i see/i);
  const c3 = requiredConcept("REQUIRED-01c", "curated note cue", /curated note|from notes he left|he notes here/i);
  const c4 = requiredConcept("REQUIRED-01d", "subjective read cue", /to me it reads like|\bi think\b/i);
  const c5 = requiredConcept("REQUIRED-01e", "uncertainty cue", /the archive does not confirm/i);
  report(
    c1 && c2 && c3 && c4 && c5 ? "PASS" : "MISS",
    "lib/netra/prompt.ts (built)",
    "REQUIRED-01",
    "source disclosure gradient — all 5 cue types present"
  );
}

{
  const lower = builtPrompt.toLowerCase();
  let ok = false;
  let idx = lower.indexOf("instrument");
  while (idx !== -1) {
    const window = lower.slice(Math.max(0, idx - 200), idx + 200);
    if (window.includes("refusal")) {
      ok = true;
      break;
    }
    idx = lower.indexOf("instrument", idx + 1);
  }
  report(ok ? "PASS" : "MISS", "lib/netra/prompt.ts (built)", "REQUIRED-02", "register separation directive — 'instrument' and 'refusal' within 200 chars of each other");
}

{
  const noTraceRe = /no trace|does not exist|search_archive returns (a )?(count of )?zero/i;
  const negRe = /never invent|do not invent|not invent|never fabricate/i;
  const ok = noTraceRe.test(builtPrompt) && negRe.test(builtPrompt);
  report(ok ? "PASS" : "MISS", "lib/netra/prompt.ts (built)", "REQUIRED-03", "no-hallucination anchor — 'no trace'-class phrase near a negative instruction");
}

{
  // Broadened from voice.md's literal "do not|never|avoid" to also accept a
  // bare "no" as the negative-instruction marker — "no X" carries the same
  // prohibitive force as "avoid X" and is exactly how prompt.ts phrases it
  // (`no "as an ai" / "language model" / "chatbot"`). Documented deviation,
  // Arcturus's call as this audit's author.
  const re = /(?:do not|never|avoid|no)\s*["']?\s*(as an ai|language model|chatbot)/i;
  const ok = re.test(builtPrompt);
  report(ok ? "PASS" : "MISS", "lib/netra/prompt.ts (built)", "REQUIRED-04", "frame-break prohibition — model-disclosure phrase in a negative-instruction context");
}

// ── surface-specific backstops (redesign plan, Part A) ──────────────────────

function walkFiles(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === "transcripts") continue;
      out.push(...walkFiles(full, exts));
    } else if (exts.some((e) => entry.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

// Hardcoded-count grep — the "prototype hardcodes 19 SURFACES for 23 nodes"
// bug class (lib/netra/archive.ts's own header comment names it). A count
// is fine when it's computed inside a template-literal interpolation
// (`${ARCHIVE.length} surfaces`, source text has no digit at all); it is a
// defect when a digit literal sits next to the keyword in AUTHORED
// application source. Comment lines are excluded — a doc comment is
// allowed to name a historical or example number (e.g. archive.ts's own
// header explaining the "19 SURFACES (actually 23)" bug it fixes, or a JSDoc
// `@example` value) without that being the stale hardcode itself.
{
  const HARDCODED_COUNT_RE = /\b\d+\s+(surfaces|files|entries|dossiers)\b/i;
  const dirs = [path.join(ROOT, "lib/netra"), path.join(ROOT, "components/netra"), path.join(ROOT, "app")];
  let any = false;
  for (const dir of dirs) {
    for (const file of walkFiles(dir, [".ts", ".tsx"])) {
      const rel = path.relative(ROOT, file);
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        const isCommentLine = trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*");
        if (HARDCODED_COUNT_RE.test(line) && !line.includes("${") && !isCommentLine) {
          any = true;
          report("FAIL", `${rel}:${i + 1}`, "HARDCODED-COUNT", `possible stale hand-typed count: ${line.trim()}`);
        }
      });
    }
  }
  if (!any) {
    report("PASS", "(lib/netra, components/netra, app)", "HARDCODED-COUNT", "no hand-typed surfaces/files/entries/dossiers counts found outside derived template literals and comments");
  }
}

// Literal phone-number grep — hard FAIL backstop. The pattern is the exact
// digit sequence, used ONLY here as a detector — never written elsewhere in
// this repo as "expected content" (redesign plan hard rule).
{
  const PHONE_LITERAL_RE = /93[\s]*573[\s]*6164|0935736164/;
  const dirs = [path.join(ROOT, "app"), path.join(ROOT, "components"), path.join(ROOT, "lib")];
  let any = false;
  for (const dir of dirs) {
    for (const file of walkFiles(dir, [".ts", ".tsx", ".css", ".json"])) {
      const rel = path.relative(ROOT, file);
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (PHONE_LITERAL_RE.test(line)) {
          any = true;
          report("FAIL", `${rel}:${i + 1}`, "PHONE-LEAK", "literal phone-number digit sequence found — contact must be email-only (project decision 6)");
        }
      });
    }
  }
  if (!any) {
    report("PASS", "(app, components, lib)", "PHONE-LEAK", "zero literal phone-number digit sequences found");
  }
}

// ── output ──────────────────────────────────────────────────────────────────

for (const f of findings) {
  console.log(`${f.level.padEnd(4)}  ${f.loc}  ${f.ruleId}  ${f.detail}`);
}

const counts = { FAIL: 0, WARN: 0, PASS: 0, MISS: 0 };
for (const f of findings) counts[f.level] += 1;
console.log("");
console.log(`── summary: ${counts.PASS} PASS · ${counts.WARN} WARN · ${counts.FAIL} FAIL · ${counts.MISS} MISS ──`);

if (counts.FAIL > 0) process.exit(1);
if (counts.MISS > 0) process.exit(2);
process.exit(0);

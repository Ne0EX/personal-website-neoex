# proposed-wiring-M.md
# Harness integrity hooks — proposed settings.json additions
# Owner: Canopus · α-HRN-07
# Emitted by: TASK-2026-06-04-INTEGRITY-HASH-ON-WRITE (P0 integrity foundation)
# Status: UNWIRED — do NOT edit settings.json; Peat wires at the gate.

## What this wires

Two new PostToolUse hooks on the `Write|Edit|MultiEdit` matcher:

| Hook | Script | Posture | Exit behavior |
|------|--------|---------|---------------|
| integrity-write-ledger | `.claude/hooks/integrity-write-ledger.sh` | Observer | Always exit 0 |
| integrity-write-guard | `.claude/hooks/integrity-write-guard.sh` | Guard (RBAC1) | exit 1 on violation |

## Hook ordering — ledger BEFORE guard

The ledger hook must run before the guard hook. Reason: even an unauthorized
write that the guard will reject must land in the audit trail. If the guard
runs first and exits 1 (aborting the hook chain), the ledger never fires for
that event. Ordering: ledger → guard → existing hooks.

In the current settings.json, the PostToolUse `Write|Edit|MultiEdit` chain is:
  1. write-protect-beta.sh
  2. post-edit.sh
  3. prototype-ready.sh

The two new hooks are inserted at positions 1 and 2 (before write-protect-beta):
  1. integrity-write-ledger.sh  (observer — no blocking risk)
  2. integrity-write-guard.sh   (guard — exits 1 on RBAC1 violation)
  3. write-protect-beta.sh      (existing — beta write protection)
  4. post-edit.sh               (existing)
  5. prototype-ready.sh         (existing)

## Proposed diff (settings.json "PostToolUse" array)

Apply AFTER the existing PostToolUse opening bracket, before the
write-protect-beta entry. The full PostToolUse hooks array would become:

```json
"PostToolUse": [
  {
    "matcher": "Write|Edit|MultiEdit",
    "hooks": [
      {
        "type": "command",
        "command": "bash .claude/hooks/integrity-write-ledger.sh",
        "timeout": 15
      }
    ]
  },
  {
    "matcher": "Write|Edit|MultiEdit",
    "hooks": [
      {
        "type": "command",
        "command": "bash .claude/hooks/integrity-write-guard.sh",
        "timeout": 15
      }
    ]
  },
  {
    "matcher": "Write|Edit|MultiEdit",
    "hooks": [
      {
        "type": "command",
        "command": "bash .claude/hooks/write-protect-beta.sh",
        "timeout": 15
      }
    ]
  },
  {
    "matcher": "Write|Edit|MultiEdit",
    "hooks": [
      {
        "type": "command",
        "command": "bash .claude/hooks/post-edit.sh"
      }
    ]
  },
  {
    "matcher": "Agent",
    "hooks": [
      {
        "type": "command",
        "command": "bash .claude/hooks/postuse-agent-counter.sh"
      }
    ]
  },
  {
    "matcher": "Write|Edit|MultiEdit",
    "hooks": [
      {
        "type": "command",
        "command": "bash .claude/hooks/prototype-ready.sh"
      }
    ]
  }
]
```

## Permissions allow entries needed

Both hook scripts invoke `bash .claude/hooks/*` which is already covered by:

```json
"Bash(bash .claude/hooks/*)"
```

No new allow entries are required. Both hooks also use: `jq`, `sha256sum`,
`git`, `mkdir -p` — all already allowed.

The ledger write (`>> .harness/integrity-ledger.jsonl`) is a shell redirect
inside a hook script invoked as `bash .claude/hooks/*` — covered by the
existing allow rule, no addition needed.

## Guard scope (assumptions — flagged per ZERO-TRUST-CENSUS-2026-06-04.md)

The RBAC1 finding at line 162-163 names the gap (signatures + MEMORY.md
unprotected) but does not specify the authorization predicate. The predicate
implemented in integrity-write-guard.sh is:

  .claude/signatures/*.json  (AUDIT.md explicitly excluded):
    CREATE (no HEAD version) → ALLOW all agents. sign-work.sh writes new
    signature files as part of the normal handoff workflow.
    MODIFY (has HEAD version, content changed) → BLOCK all agents. Signature
    payload files are write-once per their self_hash integrity design.

  .claude/signatures/AUDIT.md:
    EXCLUDED from write-once gate. AUDIT.md is an append-only log that Algol
    updates legitimately on every audit run. Applying write-once semantics
    would block every Algol audit append (false-positive). AUDIT.md is covered
    by the ledger hook for observability and by tamper-evidence in the
    signature chain.

  MEMORY.md (auto-memory index at absolute path):
    WL_AGENT=polaris → ALLOW. All others → BLOCK.
    Rationale: MEMORY.md is the master index maintained exclusively by Polaris
    (α-OPS-00). Individual memory files under memory/** are not gated by this
    hook (agent territory files are managed by convention, not this guard).

  NOTE — sign-work.sh resumed tasks:
    If sign-work.sh re-runs on a resumed task with the same output filename,
    it will BLOCK. Current sign-work.sh behavior: filename includes task_id
    which is stable per task — a resumed run overwrites the same file. This
    is a real edge case. Flagged for Algol regression. One mitigation: sign
    at Stop only (current wiring), so multiple writes to the same sig file
    are rare (one per session). If it becomes a problem, sign-work.sh can
    write a timestamped variant filename.

If the authorization predicate differs from Peat's intent, update the guard
and re-emit this doc before wiring.

## Harness config — no change required for M1

The two hooks are not Rails in the worldline-harness.config.json sense — they
are PostToolUse event handlers, not audit checks run by harness-check.sh. They
do not need a rail entry to function. A rail entry would make sense in a
follow-on task if Algol needs to write a regression test for the audit surface.

## Ledger path

  Default: .harness/integrity-ledger.jsonl
  Override (tests): WL_INTEGRITY_LEDGER=/path/to/temp.jsonl

The ledger is append-only (>> only, never overwritten). It is gitignored or
not — that is a Peat decision at the gate. If it grows large, rotate by
renaming with a date suffix (the hook will create a fresh file on next write).

---

## M3 — untrusted-fetch-gate (PreToolUse — egress-class matcher)
# Emitted by: TASK-2026-06-04-INTEGRITY-HASH-ON-WRITE (M3 sensor)
# Matcher updated by: Canopus · α-HRN-07 per R3 critic (M-REVISE-R3-OPUS-BACKSTOP.md)
# Status: UNWIRED — do NOT edit settings.json; Peat wires at the gate.

### MATCHER FIX (R3 go-live blocker — applied here)

The original proposed matcher was `"WebFetch|WebSearch"`. The hook was later
rewritten to gate the full egress class (MCP namespaces, playwright browser
egress tools, chrome-devtools navigate/eval tools). The matcher was NOT updated
at the same time — a chain-integrity desync.

R3 critic (docs/qa/REPORTS/M-REVISE-R3-OPUS-BACKSTOP.md §Q4 item 3) identifies
this as a go-live false-green: wire-as-proposed → green audit + hook never fires
for mcp__claude_ai_Notion__notion-fetch or mcp__playwright__browser_navigate →
those tools ungated at runtime despite the hook's internal egress handling.

This section now proposes the corrected, broadened matcher. Peat applies it to
settings.json at the seam. No settings.json change is made here.

SAFE-WIRING BOUND (from .claude/hooks/untrusted-fetch-gate.sh §SAFE-WIRING BOUND):
  Do NOT use a catch-all matcher ("*"). Under a catch-all, the hook's fail-closed
  *) branch routes every unenumerated built-in (StructuredOutput, SendUserFile,
  advisor, etc.) to BLOCK, bricking the harness. The matcher below is a targeted
  namespace-prefix form: it covers all egress tool names and does NOT match any
  harness built-in.

Self-check (run before wiring):
  regex-matches mcp__claude_ai_Notion__notion-fetch     → YES (required)
  regex-matches mcp__playwright__browser_navigate       → YES (required)
  regex-matches StructuredOutput                        → NO  (required)
  regex-matches SendUserFile                            → NO  (required)
  regex-matches advisor                                 → NO  (required)

  Anchoring note: the above holds whether Claude Code's matcher engine is
  unanchored (substring match), start-anchored (^...), or fully-anchored
  (^...$). The egress tools match via their literal mcp__ prefixes regardless
  of anchoring. The built-ins lack those prefixes entirely, so they never
  match mid-string either.

  Mermaid side-effect: mcp__claude_ai_Mermaid_Chart__validate_and_render_mermaid_diagram
  matches mcp__claude_ai_.* and routes to the hook. The hook has no explicit
  Mermaid branch, so it falls to the fail-closed *) and is blocked. This is
  the gate working correctly (Mermaid is a claude.ai egress service). If
  Mermaid diagram generation is needed after wiring, add an explicit branch to
  the hook (UNCERTAIN class with __UNCERTAIN_EGRESS_ALLOW__validate_and_render_mermaid_diagram
  opt-in token) — that is a follow-on hook task, out of scope here.

### What this wires

One new PreToolUse hook on the egress-class matcher (see §Proposed diff below):

| Hook | Script | Posture | Exit behavior |
|------|--------|---------|---------------|
| untrusted-fetch-gate | `.claude/hooks/untrusted-fetch-gate.sh` | Guard (deny-default) | exit 0 = allow; exit 2 = block |

### What it does

Deny-default egress gate for all outbound-fetch-capable tools.

For **URL-bearing tools** (WebFetch, mcp__playwright__browser_navigate,
mcp__playwright__browser_navigate_back, mcp__playwright__browser_network_request,
mcp__playwright__browser_tabs [action:new], mcp__plugin_chrome-devtools-mcp_chrome-devtools__navigate_page,
mcp__plugin_chrome-devtools-mcp_chrome-devtools__new_page,
mcp__claude_ai_Notion__notion-fetch): extracts the registered domain (eTLD+1) from
`tool_input.url`, checks it against `.harness/fetch-allowlist.txt`. Any domain not
in that file causes `{"decision":"block","reason":"..."}` on stdout and exit 2.

For **WebSearch**: checks for the `__WEBSEARCH_ALLOW__` token in
`.harness/fetch-allowlist.txt`. If the token is present, the call passes (WebSearch
submits a text query with no URL, so domain matching does not apply — the gate is
an explicit opt-in token). If the token is absent, the call is blocked.

For **uncertain-egress tools** (playwright eval/code/form/drop, chrome-devtools
evaluate_script/lighthouse_audit/performance_start_trace, all mcp__claude_ai_*,
mcp__plugin_supabase_supabase__*, mcp__plugin_vercel_vercel__*): blocked unless an
explicit `__UNCERTAIN_EGRESS_ALLOW__<tool_suffix>` token is present in the allowlist.

For **all other tools** in the hook: fail-closed (*) branch blocks any unenumerated
tool. Non-egress built-ins (Read, Write, Edit, Bash, mcp__playwright__browser_snapshot,
mcp__computer-use__*, chrome-devtools non-egress tools, etc.) are explicitly listed
in the SKIP class within the hook and exit 0. They will never reach this hook in
production because the matcher below does not match their tool names.

### Allowlist file

  Path: `.harness/fetch-allowlist.txt`
  Format: one bare hostname (registered domain) per line; comments (#) and blanks ignored.
  Special token: `__WEBSEARCH_ALLOW__` enables WebSearch globally.
  Override for tests: `WL_FETCH_ALLOWLIST=/path/to/temp.txt`

Seed entries (as of 2026-06-04 — these were one-off allows in settings.local.json):

  github.com        (+ subdomains: api.github.com, etc.)
  githubusercontent.com  (separate eTLD+1; needed for raw.githubusercontent.com)
  mager.co          (+ www.mager.co)
  loooom.xyz

Note: adding a domain to fetch-allowlist.txt does NOT automatically bypass the
settings.json permission prompt for WebFetch(domain:...). Peat must ALSO add
the domain to the `allow` list in settings.json or settings.local.json to prevent
the interactive prompt. The hook and the settings-layer allow entry serve
different purposes:
  - The hook is a runtime barrier (blocks execution).
  - The settings allow entry is a UI prompt bypass (skips the dialog).

### Does NOT read the ledger

This hook is a PreToolUse barrier, not a ledger-based audit. The
integrity-ledger (integrity-write-ledger.sh / integrity-ledger.jsonl) records
writes to GENESIS memory surfaces and is not consulted here. The two systems
are orthogonal: this gate prevents unauthorized fetches; the ledger records
authorized writes for tamper-evidence.

### Audit script

  `scripts/audit-untrusted-fetch-gate.sh`

33 test cases covering: syntax, allowlist seed presence, pass-through for
non-fetch tools, allowlisted domains (including subdomains), blocked domains,
WebSearch allow/block by token, missing allowlist fail-closed, edge cases
(empty URL, missing URL key), subdomain squatting, and comment/blank handling.

Run: `bash scripts/audit-untrusted-fetch-gate.sh`
All cases operate on TEMP COPIES — the real allowlist is never mutated.

### Hook ordering in the PreToolUse chain

Current PreToolUse hooks (from settings.json):
  1. Bash matcher → mutating-action-hook.sh
  2. Bash matcher → dev-clobber-guard.sh
  3. Agent matcher → on-dispatch.sh (inline jq)
  4. Read matcher → read-gate-beta.sh

New hook inserts as a new matcher entry (egress-class regex):
  It does not conflict with any existing matcher. The Bash, Agent, and Read
  matchers cover different tool-name spaces. The egress-class matcher covers
  only WebFetch|WebSearch and mcp__* egress namespaces — no overlap with the
  existing matchers. Ordering relative to existing hooks is irrelevant because
  the matchers fire on distinct tool names.

### Proposed diff (settings.json "PreToolUse" array)

Add after the existing Read matcher entry.

MATCHER EXPLANATION: the regex below covers the full egress class the hook gates,
without a catch-all that would route harness built-ins to the gate.

  WebFetch|WebSearch         — the built-in fetch/search tools (original scope)
  mcp__claude_ai_.*          — all claude.ai MCP tools (Notion, Drive, Gmail,
                               Calendar, BigQuery, Airtable, Figma, Quartr, S&P)
  mcp__plugin_supabase_supabase__.*  — Supabase MCP
  mcp__plugin_vercel_vercel__.*      — Vercel MCP
  mcp__playwright__browser_(navigate|navigate_back|network_request|tabs|evaluate|run_code_unsafe|fill_form|drop)$
                             — playwright egress-capable tools only; non-egress
                               playwright tools (browser_snapshot, browser_click,
                               etc.) are NOT matched and never reach the hook
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__(navigate_page|new_page|evaluate_script|lighthouse_audit|performance_start_trace)$
                             — chrome-devtools egress/uncertain tools only; the
                               many non-egress chrome-devtools tools are NOT matched

NOTE: mcp__computer-use__* is NOT included — computer-use is local desktop control
(no outbound network fetch). The hook classifies all computer-use tools as SKIP.

```json
{
  "matcher": "WebFetch|WebSearch|mcp__claude_ai_.*|mcp__plugin_supabase_supabase__.*|mcp__plugin_vercel_vercel__.*|mcp__playwright__browser_(navigate|navigate_back|network_request|tabs|evaluate|run_code_unsafe|fill_form|drop)$|mcp__plugin_chrome-devtools-mcp_chrome-devtools__(navigate_page|new_page|evaluate_script|lighthouse_audit|performance_start_trace)$",
  "hooks": [
    {
      "type": "command",
      "command": "bash .claude/hooks/untrusted-fetch-gate.sh",
      "timeout": 10
    }
  ]
}
```

Full PreToolUse array after insertion:

```json
"PreToolUse": [
  {
    "matcher": "Bash",
    "hooks": [
      {
        "type": "command",
        "command": "bash .claude/hooks/mutating-action-hook.sh",
        "timeout": 10
      }
    ]
  },
  {
    "matcher": "Bash",
    "hooks": [
      {
        "type": "command",
        "command": "bash .claude/hooks/dev-clobber-guard.sh",
        "timeout": 10
      }
    ]
  },
  {
    "matcher": "Agent",
    "hooks": [
      {
        "type": "command",
        "command": "jq -r 'select(.tool_name==\"Agent\" and .tool_input.subagent_type==\"polaris\") | .tool_input.description // \"no-desc\"' | { read -r desc; [ -n \"$desc\" ] && bash .claude/hooks/on-dispatch.sh \"$desc\" \"polaris\"; } 2>/dev/null || true"
      }
    ]
  },
  {
    "matcher": "Read",
    "hooks": [
      {
        "type": "command",
        "command": "bash .claude/hooks/read-gate-beta.sh",
        "timeout": 10
      }
    ]
  },
  {
    "matcher": "WebFetch|WebSearch|mcp__claude_ai_.*|mcp__plugin_supabase_supabase__.*|mcp__plugin_vercel_vercel__.*|mcp__playwright__browser_(navigate|navigate_back|network_request|tabs|evaluate|run_code_unsafe|fill_form|drop)$|mcp__plugin_chrome-devtools-mcp_chrome-devtools__(navigate_page|new_page|evaluate_script|lighthouse_audit|performance_start_trace)$",
    "hooks": [
      {
        "type": "command",
        "command": "bash .claude/hooks/untrusted-fetch-gate.sh",
        "timeout": 10
      }
    ]
  }
]
```

### Permissions allow entries needed

The hook script runs as `bash .claude/hooks/untrusted-fetch-gate.sh` which is
already covered by:

  "Bash(bash .claude/hooks/*)"

No new allow entries are required. The hook uses: `jq`, `grep`, `tr`, `cut`,
`wc`, `sed`, `printf`, `date` — all already permitted.

The allowlist read is a shell `cat` inside the hook via `while IFS= read -r line`
redirection from the file — no `Bash(cat ...)` allow entry needed.

### Harness config — no change required for M3

This hook is a PreToolUse event handler, not a rail in the worldline-harness.config.json
sense. It does not need a rail entry to function. A rail entry would make sense
in a follow-on task if Algol needs to write a regression test for the audit surface
(the audit script already serves that role for standalone runs).

### Logs

  `.claude/hook-logs/<task_id>--untrusted-fetch-gate.log`

Every call is logged (allow and block). Log format matches the M1/M2 observer
convention: `[fetch-gate] <ts> · <decision> · detail=...`

---

## M1 Sensor: audit-handoff-integrity.sh

Emitted by: TASK-2026-06-04-INTEGRITY-SENSOR-M1
Script: scripts/audit-handoff-integrity.sh

### No settings.json hook matcher needed

This sensor is a standalone audit rail (like audit-design-tokens.sh), not a
PostToolUse handler. It does not fire on individual writes — it scans the full
.claude/handoffs/** tree against the ledger. Running it as a PostToolUse hook
on every Write would be wasteful and semantically wrong (handoffs are
immutable after the initial write; re-scanning the entire tree per write adds
O(N) cost for N total handoff files).

### How it reads the ledger

The ledger path defaults to .harness/integrity-ledger.jsonl, the same default
as integrity-write-ledger.sh. Override: WL_INTEGRITY_LEDGER=/path.

For each entry whose "path" field matches ".claude/handoffs/", the sensor:
  1. Derives the on-disk location by resolving the repo-relative path under
     WL_HANDOFFS_DIR (default: $CLAUDE_PROJECT_DIR/.claude/handoffs).
  2. Uses jq to extract all sha256 values for that path (multi-entry JSONL).
  3. Uses jq to extract the latest author value.
  4. Runs sha256sum on the on-disk file and compares against the latest sha.

### Exit codes (structured, not conflated)

  0 — ledger present, all ledger-indexed handoff files verified OK
  1 — mismatch detected: SHA_MISMATCH, AUTHOR_MISMATCH, AUTHOR_UNKNOWN,
      APPEND_ONLY, FILE_MISSING, or DIR_FORMAT
  2 — internal error (missing dependency, scope violation in args)
  3 — LEDGER_ABSENT | LEDGER_EMPTY | LEDGER_NO_HANDOFF_ENTRIES
      Fail-closed: cannot verify anything, explicitly not exit 0.
      This is the correct state while integrity-write-ledger.sh is unwired.

### Proposed rail entry in worldline-harness.config.json

Add under the "rails" key when Peat wires the P0 hooks:

  "handoff-integrity": {
    "description": "Each .claude/handoffs/from-<agent>/*.md sha256 matches its ledger entry; author dir matches WL_AGENT; no in-place rewrite recorded",
    "check": "scripts/audit-handoff-integrity.sh",
    "applies_to": [".claude/handoffs/**"],
    "exit_code_semantics": {
      "0": "all ledger-indexed files clean",
      "1": "mismatch — BLOCK handoff",
      "3": "ledger absent/empty — WARN (expected while P0 hook is unwired)"
    }
  }

NOTE: while the ledger is absent (exit 3), this rail should be set to WARN
rather than BLOCK in harness-check.sh. Once integrity-write-ledger.sh is
wired and has accumulated entries, promote to BLOCK.

### No new allow entries required

The script uses: jq, sha256sum, awk, grep, sort, find — all already allowed.
bash scripts/audit-*.sh is covered by the existing allow rule.

### Caveats before promoting WARN → BLOCK

CAVEAT 1 — APPEND_ONLY false positive on within-session edits:
The (c) APPEND_ONLY check detects two distinct sha256 values for the same path
in the ledger. Cross-task revisions are new files (REVISE- prefix in filename)
— confirmed by inspection of existing handoff dirs. BUT: if an agent creates a
handoff with Write then fixes a typo with Edit in the same session, the ledger
hook fires twice → two distinct sha values → APPEND_ONLY violation with nothing
actually tampered.
Assumption that must hold before BLOCK: handoffs are written once (via Write,
from a complete template) and never edited in-place after creation. If that
assumption is not operationally true, APPEND_ONLY should only flag on 3+ distinct
shas (allowing a single correction), or the check should be dropped and replaced
with a weaker sentinel check.
Confirm with Polaris/Algol before wiring this as BLOCK.

CAVEAT 2 — harness-check.sh exit-code interpretation for exit 3:
If harness-check.sh treats any non-zero exit as a fail (common pattern), wiring
this rail while the ledger is absent will BLOCK every handoff at exit 3 — before
any tampering has occurred. The WARN/BLOCK distinction in the rail entry above is
aspirational until harness-check.sh can special-case exit 3 as "degraded, not
failed."
Safe wiring sequence: (1) wire P0 hooks (ledger accumulates entries); (2) verify
ledger has entries for at least one handoff cycle; (3) wire this rail as WARN;
(4) after ledger coverage is high enough, promote to BLOCK.
Do NOT add this to worldline-harness.config.json until step 3.

---

## M4 — Retention Policy Sensor

Script: `scripts/audit-retention-policy.sh`
Introduced: TASK-2026-06-04-INTEGRITY-HASH-ON-WRITE / M4

### What it checks

Asserts that a declared retention policy with a max-age bound exists for GENESIS
memory (auto-memory dir, handoffs, signatures, agent-memory). Checks OUGHT (is
the policy declared?) — not IS (are records being aged?). Age-based enforcement
is a separate future sensor. This script does not read the ledger.

### Two-branch OR (fail-closed default)

  Primary:     .harness/retention-policy.json exists, is valid JSON,
               and has a numeric cleanupPeriodDays > 0 field.
  Escape hatch: scope-waivers.json has a scope_na_controls[] entry whose
               .control field contains "GENESIS memory retention policy" AND
               that entry's signed_by is non-null/non-empty AND the document's
               top-level signed_by is also non-null/non-empty.

Both branches absent → exit 1 (FAIL closed).

### The false-pass this closes (discriminator)

Census (ZERO-TRUST-CENSUS-2026-06-04.md) flagged: an unsigned stub entry
(signed_by: null) in scope_na_controls[] would satisfy a naive existence check.

The fix:
  - jq -r emits JSON null as the literal string "null". The script tests for
    both empty string and the literal "null" via is_signed_by_set().
  - Defense-in-depth: the document's top-level signed_by is also checked. An
    unsigned document invalidates all its entries regardless of entry-level values.

Verified by T1 in discriminator test suite: unsigned stub → exit 1, never 0.

### Policy file format

Expected at: .harness/retention-policy.json (create to satisfy primary branch):

  {
    "schema_version": 1,
    "created_by": "<agent> · TASK-…",
    "applies_to": ["auto-memory", "handoffs", "signatures", "agent-memory"],
    "cleanupPeriodDays": <integer > 0>,
    "cleanup_notes": "<description of policy>",
    "signed_by": null,
    "signed_date": null
  }

A stub (signed_by: null) is valid for the primary branch — the sensor checks
that a bound is declared; Peat signing the policy is a human gate, not a
machine gate here.

### Settings.json wiring

NO SETTINGS.JSON HOOK MATCHER NEEDED.

audit-retention-policy.sh is a harness rail check (standalone audit), not an
event-triggered PostToolUse hook. It is invoked by harness-check.sh on demand
or run directly by any agent or CI step. No event trigger is required or
appropriate for this sensor.

### Proposed rail entry for worldline-harness.config.json

When Peat wires this sensor, add under "rails":

```json
"retention-policy": {
  "description": "GENESIS memory retention policy declared — cleanupPeriodDays set in .harness/retention-policy.json, or N/A ratified with Peat signature in scope-waivers.json scope_na_controls[]",
  "check": "scripts/audit-retention-policy.sh",
  "applies_to": [
    ".claude/handoffs/**",
    ".claude/signatures/**"
  ],
  "mode": "block",
  "barrier_class": "HARD-BARRIER",
  "status": "live",
  "owner": "canopus"
}
```

### Ledger read

NOT APPLICABLE. This sensor asserts policy existence (ought). Age-checking
ledger records (is) is a future separate sensor.

### Env overrides (testing)

  WL_RETENTION_POLICY    path to retention-policy.json (default: .harness/retention-policy.json)
  WL_SCOPE_WAIVERS       path to scope-waivers.json (default: .harness/scope-waivers.json)
  WL_TASK_ID             task id for log filename

### Current tree state

RED (expected — reflects the real gap). No .harness/retention-policy.json exists.
scope-waivers.json top-level signed_by is null.

Path to green — choose one:
  Option 1: Create .harness/retention-policy.json with cleanupPeriodDays > 0.
  Option 2: Add a signed entry to scope-waivers.json scope_na_controls[] (both
            entry signed_by and doc-level signed_by must be non-null; Peat signs
            both — agents may not self-sign).

### Discriminator test coverage (6 cases, all PASS)

  T1 unsigned-stub-must-FAIL  — the false-pass case; exit 1 confirmed
  T2 signed-waiver-must-PASS  — both doc + entry signed; exit 0 confirmed
  T3 valid-policy-must-PASS   — cleanupPeriodDays=365; exit 0 confirmed
  T4 both-absent-must-FAIL    — real-tree state; exit 1 confirmed
  T5 zero-days-must-FAIL      — cleanupPeriodDays=0; exit 1 confirmed
  T6 doc-unsigned-entry-signed-must-FAIL — defense-in-depth; exit 1 confirmed

---

## M2 Sensor: audit-memory-drift.sh

Emitted by: TASK-2026-06-04-INTEGRITY-HASH-ON-WRITE (M2 sensor build)
Script: scripts/audit-memory-drift.sh

### What it does

Reads the integrity ledger (.harness/integrity-ledger.jsonl) and, for every
GENESIS memory node currently on disk, asserts:

  (a) The node has at least one ledger entry (has been through the write hook).
  (b) The node's current sha256 matches the LATEST ledger entry for that path.

"Latest entry per path" is the correct reference hash. The ledger is
append-only; mutable nodes (MEMORY.md, handoff files, auto-memory files)
accumulate one entry per legitimate write. The latest entry is ground truth.
Any out-of-band edit (write that bypassed the hook) makes the current hash
diverge from the latest recorded hash.

For write-once nodes (.claude/signatures/*.json), there is exactly one ledger
entry, so latest == first. The semantics collapse correctly.

### Covered surfaces (mirrors integrity-write-ledger.sh exactly — must stay in sync)

  Surface 1: AUTO_MEMORY_DIR/**   — all files; ledger key = absolute path
  Surface 2: .claude/handoffs/**  — repo-relative, no leading "./"
  Surface 3: .claude/signatures/**— repo-relative, no leading "./"
  Surface 4: MEMORY.md            — repo-relative ("MEMORY.md")

  Excluded: .claude/beta/**       — Track B; exclusion checked first, before
                                    any file reads (identical to ledger hook).

### Exit codes

  0  — all nodes pass (current hash == latest ledger hash) AND no unexplained
       writes.
  1  — one or more nodes show hash DRIFT (current != latest-ledger hash), OR
       one or more nodes have no ledger entry (unexplained write). Both failure
       classes are reported in one run. Exit = 1 for either.
  5  — ledger file absent or empty. Pre-operational state: hooks are not wired
       or no writes have been recorded. Emits a NOTICE and exits 5 (non-zero).
       Callers MUST treat exit 5 as NOTICE, not FAIL, while the hook is unwired.

### Pre-operational + baseline seeding note

This audit is a reader. Before it can meaningfully cover pre-existing nodes:

  Step 1: Wire integrity-write-ledger.sh (PostToolUse Write|Edit|MultiEdit).
          (P0 wiring, at Peat's gate, already proposed in this doc.)

  Step 2: Run a one-time baseline seed pass — write every existing GENESIS
          memory file through the ledger hook (or via a dedicated seed script)
          so the ledger has an entry for each pre-existing node.

  Until step 2 is complete, existing nodes will appear as "unexplained writes"
  even though they are legitimate. The seed pass is a writer job (separate
  task) — this script does not attempt self-seeding.

### No settings.json hook matcher needed (for per-write firing)

This sensor is an audit rail, not a per-write event handler. It does NOT
belong on the Write|Edit|MultiEdit PostToolUse matcher. Wiring it there
would re-enumerate all GENESIS memory nodes on every single write — O(N_nodes)
per write, semantically wrong.

### Wiring: Stop hook + harness rail (two wire points)

Wire 1 — Stop hook (per-session audit at session end):

  Proposed addition to the Stop hooks array in settings.json:

  {
    "matcher": "Stop",
    "hooks": [
      {
        "type": "command",
        "command": "bash scripts/audit-memory-drift.sh",
        "timeout": 30
      }
    ]
  }

  NOTE: Exit 5 (pre-operational / ledger absent) should be treated as WARN
  by the Stop hook runner, not FAIL, until the ledger is seeded.

Wire 2 — harness rail (run by harness-check.sh on demand):

  Proposed rail entry in worldline-harness.config.json, under "rails":

  "memory-drift": {
    "description": "Every GENESIS memory node sha256 matches its latest ledger entry; no node written without a ledger entry (unexplained write)",
    "check": "scripts/audit-memory-drift.sh",
    "applies_to": ["*"],
    "exit_code_semantics": {
      "0": "all nodes match — PASS",
      "1": "drift or unexplained write — BLOCK handoff",
      "5": "ledger absent/empty — WARN (expected pre-wiring)"
    }
  }

  While the ledger is absent (exit 5), harness-check.sh should report WARN
  rather than BLOCK. Once integrity-write-ledger.sh is wired and a seed pass
  has been run, promote exit 5 handling to BLOCK.

### Environment overrides (for testing — temp copies only, POLICY-NO-INPLACE-MUTATION)

  WL_INTEGRITY_LEDGER=/path/to/temp.jsonl  — override ledger path
  WL_REPO_ROOT=/path/to/repo               — override repo root
  WL_AUTO_MEMORY_DIR=/path/to/dir          — override auto-memory dir
  WL_MEMORY_MD=/path/to/MEMORY.md          — override MEMORY.md path

### No new allow entries required

The script uses: jq, sha256sum, awk, find, wc, printf, date — all already
allowed. bash scripts/audit-*.sh is covered by the existing allow rule.

### Discriminator test coverage (4 cases, all verified)

  T1 absent-ledger → exit 5 (NOTICE, not FAIL)
  T2 hash-match   → exit 0 (PASS, all nodes clean)
  T3 hash-mismatch (stale ledger entry) → exit 1, emits DRIFT with both hashes
  T4 present-ledger, node has no entry  → exit 1, emits UNEXPLAINED

### Known boundary (not in scope for M2)

Deletion: a path that has ledger entries but whose file is now missing is
logged as a NOTICE but not counted as DRIFT. Adding deletion detection is
a follow-on task (M3) — do not expand M2 scope.

# docs/qa/REPORTS/TASK-2026-06-04-MEMORY-POISONING-A.md

## task · Track-A build report — GENESIS memory-poisoning sensor suite (M1–M4)

## verdict · BUILT & MUTATION-VERIFIED · NOT YET LIVE · 1 sensor false-HAVE blocks its own wiring

---

```
╔══════════════════════════════════════════════════════════════════════╗
║  NOT YET LIVE                                                          ║
║                                                                        ║
║  Every sensor below is BUILT and MUTATION-VERIFIED but INERT.          ║
║  None fires in production until Peat reviews and applies the           ║
║  settings.json wiring diff in §2. This report is the human-at-seam     ║
║  gate: the build is durable, the enforcement is not — and must not     ║
║  be — switched on by any agent. Peat wires at the gate.                ║
║                                                                        ║
║  M1 (handoff-integrity) carries a confirmed FALSE-HAVE. It must NOT    ║
║  be wired live until its fixes land, else the forged-handoff blind     ║
║  spot ships inside a green check.                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## P0 foundation (prerequisite for all four sensors)

Three files created, all functional tests pass:

| File | Role | Posture |
|---|---|---|
| `.claude/hooks/integrity-write-ledger.sh` | append-only ledger writer over GENESIS memory surfaces | Observer — always exit 0 |
| `.claude/hooks/integrity-write-guard.sh` | RBAC1 write guard (signatures write-once; MEMORY.md polaris-only) | Guard — exit 1 on violation |
| `.harness/proposed-wiring-M.md` | the wiring diff Peat reviews | Doc only — no live edit |

Ledger line format (exact — M1/M2 load-bearing; field order fixed):

```
{"path":"<canonical>","sha256":"<64-hex>","author":"<WL_AGENT>","ts":"<YYYY-MM-DDTHH:MM:SSZ>"}
```

- `path`: absolute for auto-memory files; repo-relative (no leading `./`) for `.claude/handoffs/**`, `.claude/signatures/**`, `MEMORY.md`.
- `sha256`: `sha256sum "$file" | awk '{print $1}'` — byte-for-byte identical to `sign-work.sh`.
- `ts`: `date -u +%FT%TZ`.
- Ledger default `.harness/integrity-ledger.jsonl`; test override `WL_INTEGRITY_LEDGER`.

Current ledger state: **ABSENT** (confirmed at audit time) — the honest pre-wiring state. M1 fails closed to exit 3 (LEDGER_ABSENT); M2 to exit 5 (NOTICE). Neither falsely reports green while unwired.

---

## §1 · Per-sensor table

| Sensor | Built? | Mutation catches_failure? | False-HAVE? | Fixes needed (summary) |
|---|---|---|---|---|
| **M1** handoff-integrity (`scripts/audit-handoff-integrity.sh`) | ✓ | ✓ (10/10 mutation suite) | **✗ YES — CONFIRMED** | Gate UNLISTED non-silent under `WL_INTEGRITY_WIRED=1`; integrity-protect ledger (hash-chain/sign); line-tolerant indexing (`jq -R 'fromjson?'`, no swallowed nonzero); fix C4 canonicalization. **Do NOT wire until (1) lands.** |
| **M2** memory-drift (`scripts/audit-memory-drift.sh`) | ✓ | ✓ (silent-mutation mutant → exit 1 DRIFT) | **✗ YES — CONFIRMED** | Add reverse ledger→disk pass: a ledgered-but-deleted node must be TAMPER/DRIFT, not a silent skip (deletion-probe currently → exit 0). Reconcile nodes-checked vs ledger-entry count. Owner: Canopus. |
| **M3** untrusted-fetch-gate (`.claude/hooks/untrusted-fetch-gate.sh`) | ✓ | ✓ (untrusted WebFetch → exit 2 block) | **✗ YES — CONFIRMED** | TOOL SCOPE: gate covers WebFetch/WebSearch only; playwright/chrome-devtools/Notion fetch tools egress UNGATED → exit 0. Extend matcher or scope-and-track. Fail-CLOSED on parse failure. Add audit cases. Multi-tenant suffix matching. Owner: Canopus. |
| **M4** retention-policy (`scripts/audit-retention-policy.sh`) | ✓ | **✗ NO — DOES NOT CATCH** | **✗ YES — CONFIRMED** | Escape hatch checks signature non-nullness, not Peat-identity. Agent self-sign (`signed_by:"canopus"`) → exit 0, which the script's own contract forbids. Add `is_signed_by_peat()` Peat allow-list; replace both `is_signed_by_set` calls. Cases 3/3b must flip to exit 1. Owner: Canopus. |

**Counts: built 4 / 4 · mutation-passed (catches_failure) 3 / 4 · false-HAVE 4 / 4.**

> Note on the count split: all four were *built* and all four carry a *false-HAVE* (a green check that does not imply the property it advertises). Three catch the literal in-band mutation they were specified against; M4 additionally fails its own mutation (agent-self-sign passes). So "mutation-passed" = 3/4, "false-HAVE" = 4/4. Every sensor needs a fix before wiring; M1 and M4 are the sharpest blockers.

---

## §1a · Per-sensor evidence detail

### M1 — handoff-integrity · FALSE-HAVE (3 refutations)
- Mutation suite `tests/harness/audit-handoff-integrity.mutation.sh`: **10/10 pass, exit 0**. In-band body tamper → exit 1 SHA_MISMATCH; author-dir mismatch → exit 1 AUTHOR_MISMATCH; untampered → exit 0.
- **Refutation A — FORGED UNLISTED HANDOFF:** out-of-band handoff is never ledgered; audit verdicts off the ledger not disk → lands in prose-only "unlisted" bucket, never affects exit code → status=OK exit=0. Defeats check (a)'s stated purpose even when wired.
- **Refutation B — LEDGER CO-TAMPER:** unauthenticated plaintext ledger; tamper file AND rewrite its sha256 entry → (a) on-disk==latest, (c) distinct-count==1, (b) author ok → exit 0.
- **Refutation C — MALFORMED-LINE TRUNCATION:** `jq -r select` aborts whole stream on one bad line (exit 5), stderr swallowed; tampered entry dropped before Check 1 → exit 0 with tampered handoff present. Secondary C4: unlisted counter unreliable (verified_ok=1 yet unlisted_on_disk=2) under `WL_HANDOFFS_DIR` override — canonicalization gap.
- Real-repo run (`CLAUDE_PROJECT_DIR=$PWD`) → exit 3 LEDGER_ABSENT (honest fail-closed).
- **GATING:** fix (1) — wired-mode UNLISTED gated on `WL_INTEGRITY_WIRED=1` to a distinct non-zero exit (e.g. exit 4 UNVERIFIABLE_PRESENT) — must land before live wiring.
- Artifacts: `tests/harness/audit-handoff-integrity.mutation.sh`, `.harness/M1-handoff-integrity-FALSE-HAVE.md`.

### M2 — memory-drift · FALSE-HAVE (deletion blind spot)
- Sandbox via `scripts/audit-memory-drift.mutation-test.sh` (mktemp, trap-restore, all env overrides). Real ledger confirmed still absent post-run.
- Case A all-match → exit 0 (4/4). Case B silent mutation (sig rewritten, ledger not updated) → exit 1 DRIFT (expected≠actual both emitted) — sensor genuinely catches content drift. Case C revert-to-original → exit 0 (no false positive).
- **Case D — DELETION PROBE:** deleted a signature with a live ledger entry → exit 0 PASS, "all 3 node(s) match", nodes-checked silently 4→3. Erased provenance, green sensor. FALSE-HAVE.
- Root cause: `enumerate_nodes` (L212–241) iterates disk→ledger only; defensive branch L291–297 is near-dead (`$actual` sourced from existing files only). Fix: additive reverse pass over ledger keys; missing ledgered node = TAMPER/DRIFT.
- Out-of-lane (flagged, not scored): unauthenticated ledger — forgery is `integrity-write-guard.sh`'s lane (present, unwired).

### M3 — untrusted-fetch-gate · FALSE-HAVE (egress scope)
- Refute harness `scripts/audit-fetch-gate-mutation-refute.sh` (temp-copy, trap-restore, synthetic JSON stdin, no real network/file mutation). Audit suite 33/33.
- Baseline works: allowlisted github.com WebFetch → exit 0; untrusted `https://evil.example/steal` WebFetch → exit 2 block. catches_failure TRUE for WebFetch.
- **HEADLINE FALSE-HAVE (reachable, normal op):** `case "$TOOL_NAME"` matches only `WebFetch|WebSearch`; `*) exit 0`. `mcp__playwright__browser_navigate`, `mcp__plugin_chrome-devtools-mcp_chrome-devtools__navigate_page`, `mcp__claude_ai_Notion__notion-fetch` to `https://evil.example/exfil` → **exit 0 ungated**. These are live fetch-capable tools; mutating-action-hook.sh explicitly allows playwright `browser_*`. Census Control 11 names the EGRESS CLASS, not the WebFetch tool — gating 2-of-N manufactures false confidence.
- Supporting (posture, not live bypass): fails OPEN on parse failure (jq stub exit 1 / non-JSON stdin → exit 0) despite "fail-closed" header. Reachability caveat: Claude Code emits well-formed JSON, jq is hard dep, attacker controls args not raw stdin — real posture contradiction, not an in-normal-op walk-through.
- Latent: `github.io` in allowlist → `attacker.github.io` extracts eTLD+1 `github.io` → exit 0 (multi-tenant public-suffix). Controls that fail SAFE: userinfo `github.com@evil.example` blocked; subdomain squat `github.com.evil.example` blocked.
- Report: `docs/qa/REPORTS/M3-untrusted-fetch-gate-REFUTE.md`.

### M4 — retention-policy · DOES NOT CATCH + FALSE-HAVE (authenticity at signature layer)
- Env-override fixtures (`WL_RETENTION_POLICY` / `WL_SCOPE_WAIVERS` at mktemp; real tracked files never touched — deviation from temp-copy-trap justified: the live mutating-action gate blocks rm/trap-rm, env-override is strictly safer).
- Matrix: (1) no policy + unsigned waiver → exit 1 ✓; (2) signed_by "Peat" → exit 0 ✓ legit; **(3) signed_by "canopus" AGENT self-sign → exit 0 *** FALSE-HAVE: prose says must NOT pass***;** (3b) signed_by "x" garbage → exit 0; (4) cleanupPeriodDays 999999999 → exit 0 (acknowledged OUGHT-scope limit); (5) entry signed, top null → exit 1 ✓; (6) literal "null" → exit 1 ✓; (7) real-state no entry unsigned → exit 1 ✓ honest GAP.
- The bug: `is_signed_by_set()` (L101–107) rejects only `""` and literal `"null"`; any other string ratifies. Contract is Peat-only (script L224, L311; `.harness/scope-waivers.json` L91 "agents may not self-sign"). Case 3 produces a state the code's own prose forbids and it passes.
- Why worse than the by-design stub: the primary-branch unsigned stub *declares* a bound (intended OUGHT). The waiver false-have lets an agent *unilaterally declare the control N/A* — removing the requirement, which is exactly the human gate the census protects.
- Compositional seam (named, not assumed away): `integrity-write-guard.sh` has agent-RBAC but is NOT WIRED, and even wired never asserts `signed_by == Peat` — seam inert, gap unmitigated.
- Fix: add `PEAT_SIGNERS` allow-list + `is_signed_by_peat()`; replace both `is_signed_by_set` calls (L193, L222); cases 3/3b flip to exit 1, rest unchanged. Report: `docs/qa/REPORTS/M4-RETENTION-AUTHENTICITY-GAP.md`.

---

## §2 · Consolidated proposed settings.json wiring diff — HUMAN-AT-SEAM GATE

> Gathered verbatim from `.harness/proposed-wiring-M.md`. **Peat reviews and applies this; no agent edits `settings.json`.** Recommended sequencing in §2c — M1 must not be wired until its FALSE-HAVE fix lands.

### §2a · PostToolUse — P0 hooks (M1/M2 foundation): ledger → guard, BEFORE write-protect-beta

Insert two new `Write|Edit|MultiEdit` matcher entries at positions 1 and 2 (ledger first so even a guard-rejected write lands in the audit trail):

```json
"PostToolUse": [
  {
    "matcher": "Write|Edit|MultiEdit",
    "hooks": [
      { "type": "command", "command": "bash .claude/hooks/integrity-write-ledger.sh", "timeout": 15 }
    ]
  },
  {
    "matcher": "Write|Edit|MultiEdit",
    "hooks": [
      { "type": "command", "command": "bash .claude/hooks/integrity-write-guard.sh", "timeout": 15 }
    ]
  },
  {
    "matcher": "Write|Edit|MultiEdit",
    "hooks": [
      { "type": "command", "command": "bash .claude/hooks/write-protect-beta.sh", "timeout": 15 }
    ]
  },
  {
    "matcher": "Write|Edit|MultiEdit",
    "hooks": [ { "type": "command", "command": "bash .claude/hooks/post-edit.sh" } ]
  },
  {
    "matcher": "Agent",
    "hooks": [ { "type": "command", "command": "bash .claude/hooks/postuse-agent-counter.sh" } ]
  },
  {
    "matcher": "Write|Edit|MultiEdit",
    "hooks": [ { "type": "command", "command": "bash .claude/hooks/prototype-ready.sh" } ]
  }
]
```

Resulting order: 1. integrity-write-ledger → 2. integrity-write-guard → 3. write-protect-beta → 4. post-edit → (Agent counter) → 5. prototype-ready.

### §2b · PreToolUse — M3 untrusted-fetch-gate

Add a new `WebFetch|WebSearch` matcher entry after the existing Read matcher (no conflict — distinct tool names):

```json
{
  "matcher": "WebFetch|WebSearch",
  "hooks": [
    { "type": "command", "command": "bash .claude/hooks/untrusted-fetch-gate.sh", "timeout": 10 }
  ]
}
```

Allowlist `.harness/fetch-allowlist.txt` (seed: `github.com`, `githubusercontent.com`, `mager.co`, `loooom.xyz`, token `__WEBSEARCH_ALLOW__`). Adding a domain here does NOT bypass the settings.json WebFetch permission prompt — Peat must also add it to the `allow` list to skip the dialog (runtime barrier vs UI prompt-bypass are separate layers).

### §2c · Stop hook + harness rails (M2 / M1 / M4 audit surfaces)

`audit-*.sh` sensors are standalone rails, NOT per-write PostToolUse handlers (per-write re-enumeration would be O(N_nodes) per write and semantically wrong).

**M2 Stop hook** (per-session audit; exit 5 = WARN until ledger seeded):
```json
{
  "matcher": "Stop",
  "hooks": [
    { "type": "command", "command": "bash scripts/audit-memory-drift.sh", "timeout": 30 }
  ]
}
```

**Harness rails** (`worldline-harness.config.json` under `"rails"`) — add when wiring, with exit-code WARN/BLOCK semantics:
- `memory-drift` → `scripts/audit-memory-drift.sh` · 0 PASS / 1 BLOCK / 5 WARN (pre-wiring).
- `handoff-integrity` → `scripts/audit-handoff-integrity.sh` · 0 clean / 1 BLOCK / 3 WARN (ledger absent). **Wire as WARN only after ledger seeded; do NOT add until the M1 FALSE-HAVE fix + seed pass land.**
- `retention-policy` → `scripts/audit-retention-policy.sh` · block/HARD-BARRIER. **Wire only after the M4 Peat-identity fix.**

### §2d · Permissions

No new `allow` entries required for any of the above. All hooks invoke `bash .claude/hooks/*` / `bash scripts/audit-*.sh` (already covered) and use `jq`, `sha256sum`, `git`, `grep`, `awk`, `find`, `mkdir -p` (already permitted). Ledger write is a `>>` redirect inside an already-allowed hook.

### §2e · Safe wiring sequence (Algol-recommended ordering)

1. Apply §2a P0 hooks (ledger + guard) → ledger begins accumulating.
2. Run a one-time baseline seed pass (separate writer task) so every existing GENESIS node has a ledger entry — otherwise M2 reports legitimate nodes as "unexplained writes."
3. **Land the M4 Peat-identity fix** before wiring `retention-policy` as a block rail.
4. **Land the M1 FALSE-HAVE fix (wired-mode UNLISTED non-silent + ledger integrity + line-tolerant indexing)** before wiring `handoff-integrity` even as WARN.
5. Land the M2 deletion-pass fix and the M3 egress-scope decision before promoting either to BLOCK.
6. Apply §2b M3 gate (with the egress-scope caveat documented) and §2c rails as their fixes land.

---

## §3 · NOT YET LIVE — explicit

Every sensor and every hook in this suite is **built, mutation-exercised, and INERT.** `settings.json` was confirmed unmodified at audit time (`git status` clean for `settings.json` / `settings.local.json`). No rail entry was added to `worldline-harness.config.json`. The integrity ledger is absent. Nothing in M1–M4 fires until Peat applies §2. This is by design — the human-at-seam gate.

---

## §4 · FALSE-HAVE sensors that must be fixed before wiring

All four carry a false-HAVE; in severity-blocking order:

1. **M4 retention-policy — DOES NOT CATCH (highest).** A single agent can self-sign a waiver and unilaterally declare the control N/A → exit 0. This removes a Peat-only human gate. Fix `is_signed_by_peat()` before any wiring of this rail. Cases 3/3b must flip to exit 1.
2. **M1 handoff-integrity — forged-handoff blind spot.** Forged/co-tampered/malformed-truncated handoffs pass at exit 0. Do NOT wire (even WARN) until wired-mode UNLISTED is a distinct non-zero exit and the ledger is integrity-protected.
3. **M2 memory-drift — deletion blind spot.** Erased ledgered node → exit 0. Add the reverse ledger→disk pass before promoting to BLOCK.
4. **M3 untrusted-fetch-gate — egress scope.** Playwright / chrome-devtools / Notion fetch tools egress ungated. Decide+document the boundary (extend matcher or scope-and-track) and fail-closed on parse error before the green check is allowed to imply "egress is closed."

Routing: all four fixes are **REVISE to Canopus** (owner of the hooks/audit scripts). SCHEMA/wiring untouched (gated to Peat). All refute/mutation harnesses were added additively.

---

## §5 · `.claude/beta/**` untouched — confirmed

`git status --short .claude/beta/` returned no Track-A modifications. Every sensor and refute harness operated in mktemp sandboxes or via env-overrides; `.claude/beta/**` was never read or written by M1–M4. Beta write-protection (`write-protect-beta.sh`) remains the governing guard for that tree and is unchanged. Track A did not cross into Track B territory.

---

## §6 · Six-line summary

1. Track-A built four GENESIS memory-poisoning sensors (M1 handoff-integrity, M2 memory-drift, M3 untrusted-fetch-gate, M4 retention-policy) atop a P0 ledger+guard foundation — all durable on disk.
2. NOT YET LIVE: every hook and rail is inert; `settings.json` confirmed unmodified, ledger absent — nothing fires until Peat applies the §2 wiring diff (the human-at-seam gate).
3. Mutation/refutation found a FALSE-HAVE in all four — each green check fails to imply the property it advertises (forged handoff / deleted node / ungated egress tools / agent-self-signed waiver).
4. M4 is the sharpest: an agent can self-sign a retention waiver and turn the control off → exit 0, defeating a Peat-only gate; M1 must not be wired until its forged-handoff fix lands.
5. All four fixes route REVISE to Canopus; wiring stays gated to Peat; refute harnesses added additively; no real tracked file, no `settings.json`, no `.claude/beta/**` mutated.
6. `.claude/beta/**` confirmed untouched.

**Counts — built 4 / 4 · mutation-passed (catches_failure) 3 / 4 · false-HAVE 4 / 4.**

---

## REVISE round 1 · 2026-06-04

> Canopus submitted fixes for all four sensors. I re-refuted each on a fresh sandbox against PRODUCTION ground truth (real writer / live gate), not the agent's working state. Scope guards re-verified at top of this round: `git status --short` shows **no** `.claude/settings.json` and **no** `.claude/beta/**` changes. NOTHING is wired — Peat wires at the gate (§2). All re-refutation fixtures ran on tmpfs / env-override / temp-copy with no tracked-file mutation and no network.

### Per-sensor verdicts

| Sensor | false-HAVE closed? | any refutation still bypasses? | WIREABLE NOW? | What remains |
|---|---|---|---|---|
| **M4** retention-policy | **✓ YES** (Canopus 8-case matrix replays 8/8; the named agent-self-sign false-HAVE is closed) | **✗ YES — still bypasses** (4 NEW vectors via embedded newline) | **NO** | Same authenticity gap, new encoding. `is_signed_by_peat()` uses `grep -qiE '^(Peat\|…)$'` — `^`/`$` are grep **line** anchors, not string anchors; `is_signed_by_set()` only rejects `""` and literal `"null"`, so a multiline `signed_by` reaches grep, which matches "Peat" on a *later line* and ratifies an agent self-sign. Survivors: A `"canopus\nPeat"` →0, A2 `"Peat\ncanopus"` →0, E doc=`Peat`/entry=`"canopus\nPeat"` →0 (entry-gate bypassed), I `"\nPeat"` →0. **Fix:** validate against the finite allow-list with **exact whole-STRING equality** (lowercased `case` over the 4 literals, or reject any value containing a newline before matching) — NOT line-grep, NOT another anchored regex (`[[ =~ ^Peat$ ]]` reintroduces the same trailing-newline subtlety). Apply at **both** doc-level and entry-level `signed_by`. Discrimination controls pass: CR/TAB/leading-space/trailing-space/`NotPeat`/`Peaton` all →1; legit `Peat`/`ne0ex`/`PEAT` →0 (no reverse-failure). **Route: REVISE / SCHEMA-FAIL → Canopus.** |
| **M1** handoff-integrity | **✗ NO** (refutation B — the previous false-HAVE — still bypasses) | **✗ YES — B and D bypass** | **NO** | **B (ledger co-tamper, the prior false-HAVE) NOT closed.** The real writer `integrity-write-ledger.sh` emits `{path,sha256,author,ts}` with **no `prev_hash`** (`jq 'has("prev_hash")'`→false). Canopus's Fix-2 chain check only validates lines carrying `prev_hash`; lines without it are tolerated as "legacy" (CHAIN_WARN→advance→pass), so on every ledger the writer can produce the chain is a no-op. Co-tamper (edit body + rewrite that entry's sha256) → `verified_ok=1, failed=0, status=OK, exit 0` even at `WL_INTEGRITY_WIRED=1`. The v2 suite's `[B-chain]` passes only because it hand-builds a chained ledger via the **test-only** `chained_ledger_line` helper — a fixture the writer never generates (**verifier added without a producer**). "Make the writer emit `prev_hash` + re-seed" does **not** close B (both →0): (1) terminal-entry — a hash chain protects line N only via line N+1; handoffs are written once so their entry is always terminal; (2) recompute — an attacker with ledger-write access (B's threat model) recomputes all downstream `prev_hash` and the chain re-validates. **Closing B needs an anchor the writing agent cannot forge** — an out-of-band/signed ledger-tip hash or an append-only external medium — a writer/storage change, not in this fix. **D (deep-nest, newly surfaced) bypasses:** Check-2 disk walk uses `find -maxdepth 3`; a forged handoff at `from-<agent>/sub/sub2/forged.md` (depth 4) is invisible → `unlisted_on_disk=0, status=OK, exit 0` even wired. **Fix D:** drop/raise `-maxdepth 3` so the forged-handoff scan is total. A (forged unlisted) and C (malformed-line truncation) are **genuinely closed — do not regress.** **Route: SCHEMA / REVISE → Canopus (verifier-without-producer).** |
| **M2** memory-drift | **✓ YES** (named deletion false-HAVE closed; C4a repo-relative + C4b absolute auto-memory both →1 MISSING via reverse ledger→disk pass; C1 fidelity gate PASS=4 proves real detections) | **✗ YES — C5 co-tamper deletion bypasses** | **NO** | C5: delete the file **AND** remove its ledger line → reverse pass only iterates entries present in LATEST_INDEX, so removing the entry removes the evidence → exit 0 with node gone. Not a regression, not the named hole — a distinct pre-existing gap requiring ledger-write access, and the **deletion-analog of M1-B** (same unauthenticated-plaintext-ledger root cause). **Root-cause fix = M1 fix #2:** integrity-protect the ledger (signed/anchored tip) so entry deletion is detectable. Real-repo control: `audit-memory-drift.sh`→exit 5 (ledger absent, honest pre-operational NOTICE) — confirmed no false-green. **Secondary (non-blocking, fail-closed):** exit-code label mismatch — header documents unexplained-only as exit 2 but the summary block exits 1 whenever `UNEXPLAINED_COUNT>0`; exit 2 is never emitted. One fix line. **Route: PASS-WITH-NOTES on the named closure; carry C5 + the exit-2 label forward as a HARDEN item tied to M1 fix #2.** |
| **M3** untrusted-fetch-gate | **✓ YES** (headline egress-scope false-HAVE closed; WebFetch/playwright-navigate/chrome-devtools navigate+new_page/Notion-fetch all →exit 2 BLOCK; parse-failure→exit 2; allowlist + public-suffix-squat + userinfo/IP/trailing-dot controls all correct) | **✗ YES — `browser_tabs` bypasses** | **NO** | `mcp__playwright__browser_tabs` is **absent** from the gate's `case` enumeration (grep count 0) → falls to the `*)` default-ALLOW branch. Its schema confirms `action:"new"` accepts a `url` that navigates a new tab anywhere. Empirical: `browser_tabs {action:new, url:https://evil.example/x}`→exit 0 (ALLOW=BYPASS) vs `browser_navigate {…}`→exit 2 (BLOCK) — semantically identical egress, opposite verdict. This is the `*)` **default-allow completeness gap**: the gate is deny-default for DOMAINS but allow-default for TOOLS, so any unenumerated egress-capable tool silently passes. **Fix:** (1) add `browser_tabs` to the URL-bearing case, extracting `.tool_input.url` and gating only when present (list/close/select carry no url); (2) audit playwright + chrome-devtools namespaces for other unenumerated egress tools (`chrome-devtools__performance_start_trace` flagged secondary, egress uncertain); (3) add the `browser_tabs` new-tab exfil as an asserting regression case. **Maintenance risk:** `*)` default-allow means every newly-added/renamed egress tool is silently allowed until manually enumerated — consider inverting to a SKIP-allowlist for non-egress tools, or a periodic toolset-vs-enumeration drift audit. **Route: REVISE → Canopus. Not PASS until `browser_tabs` blocks.** |

**Round-1 counts — false-HAVE closed 3 / 4 (M1 NOT closed) · refutation-still-bypasses 4 / 4 · WIREABLE NOW 0 / 4.**

### Updated SAFE WIRING SEQUENCE (supersedes §2e for this round)

**Cleared for Peat to wire now (per §2): NONE.** All four sensors still carry at least one live bypass at `WIRED=1`; wiring any of them under an integrity claim would ship a false-have inside a green check.

**Still blocked — and the gate that must land first:**

1. **M4 retention-policy** — BLOCKED. Wire the `retention-policy` rail (HARD-BARRIER, §2c) only after the whole-STRING-equality `signed_by` fix lands at **both** doc- and entry-level and a re-refute replays **8/8 + vectors A/A2/E/I + CR/TAB/space/substring controls**. Highest-severity (an agent can still turn the control off via newline-encoded self-sign).
2. **M1 handoff-integrity** — BLOCKED, hardest. Do **not** wire `handoff-integrity` (even WARN) at `WL_INTEGRITY_WIRED=1` until **both**: (B) the ledger gains a forge-resistant anchor (signed/out-of-band tip — a writer/storage change, not a verifier tweak) **with a producer**, and (D) the `find -maxdepth 3` cap is removed/raised. A and C closed — keep them.
3. **M2 memory-drift** — BLOCKED on the same root cause as M1-B. The named deletion hole is closed (reverse pass works), but C5 co-tamper deletion stays open until the ledger is integrity-protected (M1 fix #2). Do not promote `memory-drift` to BLOCK until then; it may run as WARN only **after** the M2 **baseline-seed-pass** (see reminder).
4. **M3 untrusted-fetch-gate** — BLOCKED. Apply §2b only after `browser_tabs` blocks and the playwright/chrome-devtools egress namespaces are audited for other `*)`-default-allow escapes. Headline egress closed; do not regress it.

**Dependency note:** M1-B and M2-C5 share one root cause — the unauthenticated plaintext ledger. A single fix (signed/anchored, forge-resistant ledger tip **with a writer that produces it**) unblocks the integrity dimension of both. M4 and M3 are independent and can be fixed in parallel.

**M2 baseline-seed-pass reminder (unchanged from §2e step 2):** before M2 can run without false "unexplained write" noise, a one-time baseline seed pass (separate writer task, after §2a ledger+guard are wired by Peat) must give every existing GENESIS node a ledger entry. The real-repo ledger is still **ABSENT** (M2→exit 5). No seed has been run. Seed is a prerequisite to even WARN-mode M2, and is downstream of Peat applying §2a — it is not something I wire.

### Scope confirmation (round 1)

`.claude/settings.json` and `.claude/beta/**` — **untouched.** `git status --short` shows no changes to either at the start and end of this round. All re-refutation harnesses ran on tmpfs / env-override / temp-copy sandboxes; no tracked file was mutated, no network was used. §2 wiring diff is left intact for Peat. Nothing in M1–M4 is live.

### Round-1 routing

- M4 → **REVISE / SCHEMA-FAIL → Canopus** (whole-STRING equality at both signed_by gates; re-refute 8/8 + A/A2/E/I).
- M1 → **SCHEMA / REVISE → Canopus** (verifier-without-producer; forge-resistant ledger anchor for B + drop maxdepth for D).
- M2 → **PASS-WITH-NOTES → Polaris/Canopus** on the named closure; C5 + exit-2 label carried as a HARDEN item tied to M1 fix #2.
- M3 → **REVISE → Canopus** (`browser_tabs` + egress-namespace audit + asserting regression case).

**Round-1 summary counts — false-HAVE closed 3 / 4 · refutation-still-bypasses 4 / 4 · WIREABLE NOW 0 / 4 · still-blocked 4 / 4.**

---

## Phase 0 slice 0.4 verification · 2026-06-10 · Canopus (α-HRN-07)

> Reproduce-FIRST discipline: every existing mutation/refute suite was run before any edits. The round-1 defect list is STALE relative to post-round-1 REVISE rounds. This section records the verified state as of 2026-06-10 with mutation evidence.

### Suite run results

| Suite | File | Exit | Acceptance line |
|---|---|---|---|
| M1 mutation | `tests/harness/audit-handoff-integrity.mutation.sh` | **0** (18/18 PASS) | `RESULTS · PASS=18 FAIL=0` |
| M1 re-refute (Algol) | `tests/harness/m1-rerefute-algol.sh` | **0** (A/C/D closed; B expected-bypass) | `RESULT: all refutations correctly accounted` |
| M1-B closure (witness discriminator) | `tests/harness/m-revalidate-trustroot-discriminator.sh` | **0** | `>>> ACCEPTANCE LINE MET: co-tamper passing recompute is CAUGHT by cross-commit history (exit 1).` |
| M2 deletion mutation | `scripts/audit-memory-drift.mutation-test.sh` | **0** | `ALL CASES PASS — M2 deletion blind spot closed` |
| M2 refute suite | `tests/harness/audit-memory-drift.refute.sh` | **0** (8/8 OK) | `===== HARNESS COMPLETE =====` |
| M3 fetch-gate refute | `scripts/audit-fetch-gate-mutation-refute.sh` | **0** | `[refute-harness done]` |
| M3 parse-fail | `printf 'not json' \| bash .claude/hooks/untrusted-fetch-gate.sh` | **2** | `decision:block … parse failure` |
| M4 newline refute | `tests/harness/m4-newline-bypass-refute.sh` | **0** (17/17 PASS) | `RESULT: PASS — all assertions correct` |
| M4 NUL re-refute (Algol) | `tests/harness/m4-nul-rerefute-algol.sh` | **0** (35/35 PASS) | `RESULT: PASS -- all 35 assertions correct` |
| Witness Tb fulldepth discriminator | `tests/harness/witness-publisher-refute-Tb-fulldepth-discriminator.sh` | **0** (4/4 PASS) | `T-b RE-REFUTE VERDICT: BUG CLOSED` |

### Per-defect verdict table

| Defect | Round-1 status | Current status | Action taken | Mutation suite | Before→After |
|---|---|---|---|---|---|
| M1-A (forged unlisted, WIRED) | OPEN | **VERIFIED CLOSED** | no edit | `audit-handoff-integrity.mutation.sh` [A-wired] | attack → exit 4 UNVERIFIABLE_PRESENT |
| M1-B (ledger co-tamper) | OPEN at M1-script layer | **CLOSED BY WITNESS** (expected-bypass at script layer) | test fixture fix in `m1-rerefute-algol.sh` C-real probe (header-line offset) + verdict update | `m-revalidate-trustroot-discriminator.sh` | co-tamper defeats recompute (stored==disk) AND ACCEPTANCE LINE MET by cross-commit history (exit 1 VIOLATION) |
| M1-C (malformed-line truncation) | OPEN (round-1 report) | **VERIFIED CLOSED** | test fixture bug fixed (m1-rerefute C-real sed line numbers were off by 1 due to header line; now header+2+malformed+3) | `audit-handoff-integrity.mutation.sh` [C] + `m1-rerefute-algol.sh` [C-real] | malformed line skipped; tampered entry caught → exit 1 SHA_MISMATCH |
| M1-D (deep-nest maxdepth) | OPEN (round-1 report) | **VERIFIED CLOSED** | no edit (audit-handoff-integrity.sh uses unbounded `find`, no `-maxdepth`) | `m1-rerefute-algol.sh` [D-probe] | RC=4 UNVERIFIABLE_PRESENT (deep forged file caught) |
| M2 deletion (reverse pass) | OPEN | **VERIFIED CLOSED** | no edit | `scripts/audit-memory-drift.mutation-test.sh` CASE D | `CASE D delete-ledgered: exit 1` |
| M2-C5 (co-tamper deletion) | OPEN (expected, tied to ledger forge-resistance) | **DOCUMENTED BYPASS** (probe only; expected — same root as M1-B, closed by witness go-live at Peat seam) | no edit | `tests/harness/audit-memory-drift.refute.sh` C5 | C5 exit=0 (expected bypass; probe only) |
| M3 egress (playwright/chrome-devtools/Notion) | OPEN | **VERIFIED CLOSED** | no edit | `scripts/audit-fetch-gate-mutation-refute.sh` F1–F5 + G1–G3 | all → exit 2 BLOCK |
| M3 browser_tabs enumeration | OPEN (round-1) | **VERIFIED CLOSED** | no edit (lines 550-561 already enumerate browser_tabs) | `scripts/audit-fetch-gate-mutation-refute.sh` | gate covers browser_tabs |
| M3 parse-fail | OPEN (round-1) | **VERIFIED CLOSED** | no edit | `printf 'not json' \| untrusted-fetch-gate.sh` | → exit 2 (closed, parse failure) |
| M4 self-sign (canopus) | OPEN | **VERIFIED CLOSED** | no edit | `tests/harness/m4-newline-bypass-refute.sh` CS | → exit 1 |
| M4 newline bypass (canopus\nPeat etc.) | OPEN (round-1) | **VERIFIED CLOSED** | no edit | `tests/harness/m4-newline-bypass-refute.sh` A/A2/E/I/DOC-A/DOC-I | all → exit 1 |
| M4 NUL bypass (p\0eat etc.) | OPEN (round-1) | **VERIFIED CLOSED** | no edit | `tests/harness/m4-nul-rerefute-algol.sh` Sections C/D/E/F (35/35) | all → exit 1 |

### M1-B/C isolation note

`m1-rerefute-algol.sh` previously reported C as OPEN due to a test fixture bug: the script used `sed -n '1p'` / `sed -n '2p'` to extract ledger entries from a real-writer ledger, but the real writer emits a metadata header at line 1 (no "path" field), pushing good.md to line 2 and h1.md to line 3. The rebuilt malformed-injection fixture omitted h1.md's entry entirely, so it was "unlisted" (informational in unwired mode) rather than tamper-detected. Fix: extract lines 2+3 (header preserved at line 1), rebuild as header+good+malformed+h1. After fix, C-real → exit 1 SHA_MISMATCH (correct).

`m1-rerefute-algol.sh` verdict logic was updated to document B_BYPASS=1 as **expected isolation evidence** (the M1 script correctly does not block co-tamper; the witness is the catcher). The script now exits 0 when A/C/D are closed and B is the expected bypass.

### Witness layer (M1-B closure)

`m-revalidate-trustroot-discriminator.sh` — ACCEPTANCE LINE MET on 2026-06-10: a co-tamper that PASSES in-file recompute (stored==disk) is CAUGHT by cross-commit history (exit 1 VIOLATION). This is the authoritative closure for M1-B and M2-C5. Go-live precondition is branch protection (Peat seam, not in scope here).

`witness-publisher-refute-Tb-fulldepth-discriminator.sh` — T-b VERDICT: BUG CLOSED. Under fetch-depth:0, a 2-day-old unpublished ledger delta is correctly reported STALE (exit 1, delta_age_seconds≈172800). Control scenarios: fresh-delta HEALTHY, witness-current HEALTHY (no false alarm). wireable_now pending Peat seam.

### Files changed in this slice

- `tests/harness/m1-rerefute-algol.sh` — fixture fix (C-real header-line offset) + verdict documentation (B expected-bypass, exit-0 when A/C/D closed)

### No settings.json changes

`.claude/settings.json` untouched. No wiring performed. All suites ran in mktemp sandboxes. No `.claude/beta/**` touched.

---

## Phase 0 slice 0.4 re-verification · 2026-06-11 · Canopus (α-HRN-07)

> Second independent re-run. Reproduce-FIRST: all suites ran before any inspection; no files edited in this pass. All results are consistent with the 2026-06-10 run above.

**Deterministic driver:** `bash scripts/audit-m1m4-driver.sh` → `DRIVER RESULTS · PASS=10 FAIL=0` · `VERDICT: PASS — all acceptance lines confirmed`

### Re-verification suite results (2026-06-11)

| Suite | Exit | Result |
|---|---|---|
| `tests/harness/audit-handoff-integrity.mutation.sh` | **0** | `RESULTS · PASS=18 FAIL=0` — verified closed at 2026-06-11 |
| `tests/harness/m1-rerefute-algol.sh` | **0** | `RESULT: all refutations correctly accounted` — A/C/D closed; B expected-bypass |
| `tests/harness/m-revalidate-trustroot-discriminator.sh` | **0** | `ACCEPTANCE LINE MET: co-tamper passing recompute is CAUGHT by cross-commit history (exit 1).` |
| `tests/harness/witness-publisher-refute-Tb-fulldepth-discriminator.sh` | **0** | `T-b RE-REFUTE VERDICT: BUG CLOSED` · pass=4 fail=0 |
| `scripts/audit-memory-drift.mutation-test.sh` | **0** | `ALL CASES PASS — M2 deletion blind spot closed` · CASE D exit 1 |
| `tests/harness/audit-memory-drift.refute.sh` | **0** | `===== HARNESS COMPLETE =====` · C5 exit=0 expected (documented bypass) |
| `scripts/audit-fetch-gate-mutation-refute.sh` | **0** | `[refute-harness done]` · F1–F5 exit 2; G1–G3 exit 2; parse-fail exit 2 |
| `printf 'not json' \| bash .claude/hooks/untrusted-fetch-gate.sh` | **2** | `decision:block … parse failure` — fail-closed confirmed |
| `tests/harness/m4-newline-bypass-refute.sh` | **0** | `RESULT: PASS — all assertions correct` · 17/17 PASS |
| `tests/harness/m4-nul-rerefute-algol.sh` | **0** | `RESULT: PASS -- all 35 assertions correct` · 35/35 PASS |

### M1-B/C (script-layer bypass) note

`m1-rerefute-algol.sh` B probe reports `BYPASS CONFIRMED: tampered handoff + blessed ledger -> exit 0 EVEN WIRED`. This is **expected isolation evidence** — the M1 script correctly does not block co-tamper at the script layer; closure is the witness (`m-revalidate-trustroot-discriminator.sh`). The B bypass at the script layer is not a defect; it proves the separation of concerns is intact.

### No-change confirmation

No files in `scripts/audit-handoff-integrity.sh`, `scripts/audit-memory-drift.sh`, `scripts/audit-retention-policy.sh`, `.claude/hooks/untrusted-fetch-gate.sh`, or `scripts/audit-ledger-append-only.sh` were modified. All `bash -n` checks pass. `.claude/settings.json` and `.claude/beta/**` untouched.

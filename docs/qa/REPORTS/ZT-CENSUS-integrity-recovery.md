# QA Report — Zero-Trust Census Adversarial Verify · family: integrity-recovery

## verdict
FAIL-AS-SUBMITTED — 1 false-HAVE flipped (single-source HAVE→PARTIAL), 1 in-family control added as GAP (config supply-chain integrity), NA survives but is provisional (rests on unsigned scope-waivers.json). All other 11 verdicts re-probed and upheld; signature-schema HAVE verified live by self_hash recompute.

## re-probed every cited file. Method: ran the gates, read the hooks, recomputed a real signature.

## FLIP 1 — "single-source config / artifact integrity" : HAVE → PARTIAL (false-HAVE)
The mechanism is real (sha256/import enforcement, wired into sign-work.sh as a fail-closed precondition to signing — NOT "never fires"), but the **coverage is blind to the divergence its own design names**.

- Live run: `bash scripts/audit-single-source.sh` → PASS, but "0 copies scanned · 0 divergent" for BOTH artifacts.
- The registry's `duplicate_search_globs` are `.claude/visual-diffs/**` and `prototypes/**`. `prototypes/` is empty; no `WorldlineGlobe.tsx`/`globals.css` copies exist under `.claude/visual-diffs/**`.
- But divergent copies DO exist: `.claude/worktrees/practical-ellis-4b6d99/{components/WorldlineGlobe.tsx, app/globals.css}` and `.claude/worktrees/polaris-voice-pilot/{...}` — i.e. 3 total instances of each (canonical + 2 worktrees).
- The registry's own description states its purpose is to converge "Three divergent blobs ... across branches." SECURITY-HARNESS-DESIGN-2026-06-01.md §Blast-radius row names "globe = 3 divergent blobs" as the driver. The gate cannot see the branches/worktrees where those blobs live.
- Counter pre-empted: "worktrees converge at merge, out of scope by design" — but the registry text says "across branches," so worktree drift is in the stated scope, and the gate silently green-passes it. This is HAVE→PARTIAL on coverage, not a request to scan worktrees (that may be the wrong remedy — flag, don't patch).

## ADDED CONTROL — "config supply-chain integrity (MCP manifest + lockfile pinning)" : GAP
Omitted by the census; no other census family (access-privilege, identity-authentication, observability-audit, memory-context-poisoning) owns it. integrity-recovery is its home.
- `settings.json:3` — `"enabledMcpjsonServers": ["playwright"]` is name-only, unpinned; no manifest/description hash. SECURITY-HARNESS-DESIGN §"Tool poisoning / rug-pull": "ZERO integrity check ... unpinned ... mutating-mcp denylists names not descriptions." A rug-pulled MCP server keeps its name and passes.
- No `audit-mcp-manifest-pin` and no `audit-lockfile-drift` script in scripts/ (ls-confirmed). A dependency swap under a pinned name is undetected.
- Sensor proposal: `audit-mcp-manifest-pin.sh` (hash enabled servers' manifest/tool descriptions vs a stored lockfile) + `audit-lockfile-drift.sh`.

## NA — "automated recovery / rollback with health checks" : NA UPHELD (provisional)
Survives the challenge: statically-exported Next.js, no running service tier to health-check; manual git rollback is the correct ceiling. BUT the justification cites `.harness/scope-waivers.json`, which is `signed_by: null` / "UNSIGNED-STUB." Per the file's own rule (agents may not self-sign; Peat ratifies), every NA leaning on it is provisional until Peat signs. Same caveat the access-privilege census report records.

## UPHELD verdicts (re-probed, unchanged)
- **cryptographic signature schema** HAVE — VERIFIED LIVE: recomputed self_hash on `.claude/signatures/BATCH-AUDIT-2026-05-16--algol.json` → `a72572b7…` MATCHES stored. sign-work.sh:359 canonical-JSON logic confirmed.
- **barrier-class spine** HAVE — upheld; validating the declaration contract (mode=block ⇒ HARD-BARRIER) IS its job, not runtime enforcement, so no downgrade. One correction: census says "20 rails"; live audit reports **21 rails checked, 0 violations**.
- **version-controlled configs** PARTIAL — upheld; ConfigChange hook genuinely absent (jq confirms 6 hook events, no ConfigChange).
- **config-change tamper detection** GAP — upheld; no ConfigChange entry, no audit script.
- **signed configs w/ deploy-time verification** PARTIAL — upheld; scope-waivers.json signed_by:null confirmed at :8-9.
- **signature verification enforcement at handoff** PARTIAL — upheld; pre-handoff.sh:57-77 is a field-value check (harness_passed/post_edit_passed), NOT a hash recompute. audit-claim-vs-ground-truth.sh confirmed ABSENT from scripts/.
- **immutable / append-only audit trail** PARTIAL — upheld; write-protect-beta.sh:112-113 gates ONLY `.claude/beta/*`; signatures dir unprotected. mutating-action-hook does block reset/rebase/force.
- **documented rollback capability** HAVE — upheld; 21 checkpoint archives, save-checkpoint.sh present.
- **tested / documented rollback RTO** PARTIAL — upheld; no restore-test artifact; design-doc "tested rollback" prose is self-report (violates axiom H1 ground-truth rule).
- **checkpoints / rewind** HAVE — upheld; save-checkpoint.sh:35 guarded on CLAUDE_TASK_ID, wired as Stop hook (settings.json:219).

## sensor-mismatch notes (recorded)
- **single-source sensor** would NOT catch the failure it claims (the 3 divergent globe blobs) — coverage globs miss worktrees. The strongest single mismatch in the family.
- **handoff-verification sensor**: the census correctly notes the wired pre-handoff check is presence/field, not hash. The "runnable one-liner" sensor is sound but unwired — accurately classified PARTIAL.

## key structural finding (cross-cutting)
`harness-check.sh` — the runner for all 21 config rails — is **not wired into any hook** in settings.json. It is invoked as a precondition inside sign-work.sh (and manually). So config rails (incl. single-source) enforce at SIGN time, not per-edit. This does not flip any verdict but tightens the evidence: "registered mode=block" ≠ "fires on every change"; it fires when an agent signs.

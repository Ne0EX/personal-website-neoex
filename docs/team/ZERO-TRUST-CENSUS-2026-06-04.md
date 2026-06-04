# Zero-Trust Census — Merged & Adversarially-Verified
**Date:** 2026-06-04 · **Auditor:** Algol (α-VER-06) · **Source:** 8 per-family Zero-Trust censuses, each re-probed against ground truth
**Status:** MAP for Peat at the gate. This report classifies and prioritizes. It remediates **nothing**.

> Honest partition: every control is labeled HAVE / PARTIAL / GAP / NA. Nothing silently dropped. Sensors are flagged where they would not catch the failure they claim. Every NA is provisional until Peat signs `.harness/scope-waivers.json` (currently `signed_by: null`, status UNSIGNED-STUB).

---

## 1 · Executive Table

| Family | HAVE | PARTIAL | GAP | NA | Verdict |
|---|---:|---:|---:|---:|---|
| memory / context-poisoning | 2 | 5 | 4 | 0 | **FAIL** — 10/10 named sensors fictional; false-HAVE (session-isolation); omitted handoff control |
| identity / authentication | 3 | 3 | 1 | 6 | **REVISE** — false-HAVE (attestation 51/204 fail); 3 nonexistent sensors; omitted secrets-scan |
| access / privilege | 5 | 6 | 3 | 1 | **FAIL** — false-HAVE (deny-by-default); false-NA (JIT/JEA); omitted permission-mode gate |
| observability / audit | 2 | 7 | 5 | 0 | **REVISE** — 2 false-HAVEs flipped; 2 NA provenance-busted; 2 omitted controls |
| behavioral monitoring | 2 | 3 | 5 | 1 | **REVISE** — 3 inert-evidence controls; hollow NA residue; omitted loop-governor |
| input/output injection | 2 | 3 | 4 | 0 | **SOUND, 1 omission** — both HAVEs verified by live exit-2; omitted inbound tool-output filter |
| integrity / recovery | 5 | 7 | 2 | 1 | **FAIL** — false-HAVE (single-source blind to worktrees); omitted MCP/lockfile pinning |
| supply chain | 5 | 1 | 9 | 0 | **REVISE** — false-NA (vendor assessment); 2 omitted GAPs; 3 dead sensors |
| **TOTALS** | **26** | **35** | **33** | **9** | — |

*Counts reflect the corrected censuses (post-flip), including controls Algol added.*

---

## 2 · Prioritized GAP List — what to build, ranked by risk for a solo digital garden

Each GAP → the deterministic sensor it becomes. **Memory/context-poisoning ranks first by mandate** (memory-heavy architecture = top threat surface). After that: highest-severity-class injection, then identity/config integrity, then the long tail.

### TIER 0 — Memory / context-poisoning (ALWAYS FIRST)

**M1 · Handoff integrity (agent-to-agent context channel)** — `GAP`
`.claude/handoffs/from-*/` is a real, populated inbox per roster member; files are plaintext `.md` with NO write-gate, NO sha256, NO provenance check. `pre-handoff.sh` validates only recipient-roster membership, not content. A poisoned/tampered handoff is textbook context poisoning, undetected. (Design line 81 names handoffs as having no equivalent protection.) Census omitted this entirely.
→ **Sensor:** PostToolUse Write hook hashing handoff bodies on write + asserting author matches `from-<agent>` dir + append-only check. `audit-handoff-integrity.sh`.

**M2 · Long-term drift via summaries / peer-feedback writes** — `GAP`
Auto-memory `feedback_*.md` / `project_*.md` nodes: no write-gate, no hash-on-write, no approval gate, no origin hash. Policy (`feedback_memory_no_stigma`) is not a technical gate.
→ **Sensor:** `audit-memory-drift.sh` — but it is non-functional until a write-side hash-on-write hook exists (prerequisite). Build the write-side hash hook FIRST, then the drift sensor.

**M3 · RAG / untrusted-fetch provenance** — `GAP`
WebFetch/WebSearch ungated; no provenance tag, no systematic allowlist, no content-filter pre-injection. THREE one-off allows in settings.local.json (github.com, mager.co, **loooom.xyz** — census missed the third). Design line 76: "ZERO — ungated".
→ **Sensor:** PreToolUse WebFetch|WebSearch matcher + `audit-untrusted-fetch-gate.sh` asserting deny-default domain allowlist. (Overlaps unbuilt `wrap-untrusted-fetch`.)

**M4 · Context-retention `cleanupPeriodDays`** — `GAP`
Verified genuinely absent across `.claude/**`; auto-memory accumulates indefinitely (51 nodes). The one fully-clean census finding.
→ **Sensor:** `audit-retention-policy.sh`. NOTE: its OR-branch "signed N/A in scope-waivers.json" is a **latent false-pass** — the waiver is unsigned; do not wire that branch as a pass until Peat signs.

> **CENSUS-WIDE memory finding (not a single gap — a reliability failure):** all 10 named memory sensors (`audit-write-protect-wired`, `-read-gate-wired`, `-memory-segmentation`, `-claim-vs-ground-truth`, `-untrusted-fetch-gate`, `-memory-drift`, `-subagent-isolation`, `-retention-policy`, `-precompact-coverage`, `-memory-access-log-coverage`) are **ABSENT from scripts/** (verified `ls`). No memory control has regression protection today. Every "accepted-risk N/A" in this family routes through the UNSIGNED scope-waivers.json.

### TIER 1 — Highest-severity injection class (design names indirect injection the top threat)

**I1 · Tool-output filtering (inbound untrusted-content sanitization)** — `GAP`
Scanning/sanitizing content RETURNED by tools (WebFetch/WebSearch/Read) before it re-enters context. ZERO coverage; read-gate-beta is RBAC, not a content filter. Distinct from outbound secret-egress. Census omitted.
→ **Sensor:** judge-required for semantic residue; deterministic pre-slice (flag/quarantine spans from non-allowlisted origins) is buildable. Overlaps unbuilt `wrap-untrusted-fetch`.

**I2 · Spotlighting (provenance tagging of untrusted content)** — `GAP`
Nothing marks fetched external content as distinct from trusted instruction context.
→ **Sensor:** judge-required on flagged spans; deterministic pre-gate (domain allowlist + provenance tag) buildable, unbuilt.

**I3 · Input sanitization (length caps + param-schema)** — `GAP`
No input length limits / untrusted-content sanitization / structured schema validation on tool inputs. mutating-action-hook validates command STRINGS, not input shape. `audit-tool-param-shape` Wave 4 unbuilt.
→ **Sensor:** deterministic slice (length caps + param-schema) buildable, no sensor today; intent residue is judge-required.

**I4 · Output filtering (outbound credential/secret egress)** — `GAP`
`secrets.ts` exists at `.harness/engine/core/sensors/secrets.ts` but is DORMANT — no PostToolUse matcher references it, no pre-commit hook. Dormant code = zero enforcement.
→ **Sensor:** wire `secrets.ts` as PostToolUse Write|Edit|MultiEdit + pre-commit gate. (Same scanner satisfies identity-family secrets-scan, below.)

### TIER 2 — Identity & config integrity (the configs that silently void other controls)

**C1 · Permission-mode integrity (`defaultMode` != bypassPermissions/acceptEdits)** — `GAP`
The single config that silently voids the ENTIRE access-privilege family. No `defaultMode` key today (grep: NONE), so not broken — but NO gate asserts it stays safe. A future edit voids all access controls with zero detection.
→ **Sensor:** extend `audit-permissions-nonempty.sh` to assert `defaultMode` absent or not in {bypassPermissions, acceptEdits}.

**C2 · ConfigChange tamper detection on settings.json / .harness/** — `GAP`
No change-detection guard on settings/.harness edits; permission-self-expansion lateral-movement is ungated. (Appears across access-privilege, supply-chain, integrity, governance censuses — one control.)
→ **Sensor:** **NOT** a "ConfigChange hook" — that event does not exist in Claude Code (events: SessionStart/PreToolUse/PostToolUse/UserPromptSubmit/PreCompact/Stop). Implement as **PreToolUse Edit|Write|MultiEdit** matcher + path guard: exit 1 if target is `.claude/settings.json` or `.harness/**` lacking canopus WL_AGENT authorship + task ID.

**C3 · Committed-secret / credential-exposure scanning** — `GAP`
A leaked key IS an identity credential. No scanner exists; design lists secrets-scan as Wave 1, not done. Nothing blocks a credential entering the tree or a signature files_touched.
→ **Sensor:** PreToolUse/pre-commit grep for high-entropy + known key prefixes (`sk-`, `ghp_`, `AKIA`, `-----BEGIN ... PRIVATE KEY-----`); block on match. (Same wiring as I4.)

**C4 · Config supply-chain integrity (MCP manifest + lockfile pinning)** — `GAP`
`enabledMcpjsonServers:["playwright"]` is name-only/unpinned; no manifest/description hash. mutating-mcp denylists NAMES not descriptions (rug-pull undetected). No `audit-mcp-manifest-pin.sh` / `audit-lockfile-drift.sh`.
→ **Sensor:** `audit-mcp-manifest-pin.sh` hashing enabled servers manifest/description vs committed `.harness/mcp-manifest-lockfile.json`; trigger = PreToolUse Edit|Write + path guard (NOT ConfigChange).

### TIER 3 — Supply chain (CI is the witness; pin the inputs)

**S1 · GitHub Actions pinned to immutable SHA** — `GAP`
`ci.yml` uses mutable tags `actions/checkout@v4` (:39), `actions/setup-node@v4` (:44). Movable-tag = first-class injection vector running in CI with repo-read scope.
→ **Sensor:** assert every `uses:` in `.github/workflows/**` is a 40-hex SHA — `grep -E "uses:.*@v[0-9]" .github/workflows/*.yml && exit 1`. Pair with Dependabot github-actions ecosystem.

**S2 · npm lifecycle (install/postinstall) script execution control** — `GAP`
No `.npmrc`; `npm ci` runs preinstall/install/postinstall unguarded on the CI runner — a top real-world npm supply-chain vector.
→ **Sensor:** commit `.npmrc` with `ignore-scripts=true` (or `npm ci --ignore-scripts`) + assert the flag present; allowlist build-script packages explicitly.

**S3 · Lockfile drift gate (lock changes iff package.json changes)** — `GAP`
No `audit-lockfile-drift.sh` (design Wave 3, owner Algol).
→ **Sensor:** the census one-liner is **DOUBLE-BROKEN** — do not ship as written: (1) `git diff HEAD` sees only the working tree, missing a drift introduced in a commit (the real attack) — must diff vs PR base / merge-base; (2) the `A && B || FAIL` shape fires FAIL on every commit that leaves the lockfile untouched. Correct logic: `if lock_changed && ! pkg_changed; then exit 1; fi`, against the base ref.

**S4 · SBOM / AI-BOM** — `GAP`
No SBOM; AI components (@ai-sdk/anthropic@^3.0.81 + claude-haiku-4-5) undocumented.
→ **Sensor:** `test -f sbom.json` (existence) + AI-BOM listing model ID + SDK version; AI-BOM completeness is judge-required.

**S5 · OpenSSF Scorecard** — `GAP`
No scorecard workflow.
→ **Sensor:** ossf/scorecard-action + threshold assertion.

**S6 · Dependabot / dependency vulnerability audit** — `GAP`
No `dependabot.yml`, no `npm audit`/Snyk/Trivy in CI.
→ **Sensor:** `npm audit --audit-level=high` in CI + `.github/dependabot.yml` (npm, weekly).

**S7 · MCP manifest pinning (version + hash)** — `GAP` (supply-chain view of C4) → same sensor as C4.
**S8 · MCP description-hash integrity (rug-pull detection)** — `GAP`
mutating-mcp.json blocks by tool-NAME regex, not descriptions.
→ **Sensor:** judge-required for intent; deterministic pre-gate hashes description fields into the MCP lockfile.

### TIER 4 — Observability, recovery, governance (detective depth)

**O1 · On-dispatch logging (caller + target)** — `GAP` (flipped from false-HAVE)
settings.json:117-121 wires on-dispatch ONLY for `subagent_type=="polaris"`, passes description into the TASK_ID slot, HARDCODES target="polaris", never sets WL_AGENT → live log reads `caller=unknown ... target=polaris` on every line. Both named attributes (caller, target) absent/wrong; the ANOMALY guard is dead code. BOTH proposed sensors are false (grep-ANOMALY can never match; wiring-presence check green-lights a dead control).
→ **Sensor:** assert `caller!=unknown` AND `target!=hardcoded` in actual log lines.

**O2 · Hook-log tamper-evidence** — `GAP`
The 10k+ hook-log files (bulk of the observability trail) are plain mutable files — no per-line hash, no chaining. Only signatures/ carries crypto integrity.
→ **Sensor:** `audit-hook-log-integrity.sh` maintaining a committed sha256 manifest / rolling hash-chain over `.claude/hook-logs/`; detect post-hoc content/mtime drift via git diff.

**O3 · Silent logging-failure detection** — `GAP`
Nearly every hook writes with `2>/dev/null || true`; a failed log write is swallowed, leaving no trace. The `|| true` pattern actively defeats detection.
→ **Sensor:** watchdog capturing log-write exit status, or an out-of-band canary marker per session + a sensor asserting its presence.

**O4 · Distributed tracing / OTel** — `GAP` (NA-PENDING-RATIFICATION)
No OTel SDK/exports/SIEM. Reasoning sound for a solo garden, but the NA leans on the UNSIGNED waiver.
→ **Sensor:** `jq -r .signed_by .harness/scope-waivers.json` must be non-null before treating OTel as ratified-NA.

**O5 · Dwell-time coverage** — `GAP`
Async-notification half is genuinely NA (no SOC/on-call); latency-MEASUREMENT half is buildable and unmet — nothing records time-to-detection even for the synchronous gates.
→ **Sensor:** deterministic delta between event-write timestamp and operator-visible-surface timestamp.

**R1 · Config-change tamper detection (integrity view)** — `GAP` → same control/sensor as C2.

**G1 · Independent-witness / cross-substrate CI corroborator** — `GAP`
A core zero-trust property: no green self-attested under one custodian on one machine. `ci.yml` calls itself this witness but is **untracked/uncommitted** (`git ls-files` empty; `git status` shows `??`). GitHub Actions only runs committed workflows → currently zero independent witness; every gate is self-attested locally. Crediting the uncommitted draft would be a false-HAVE.
→ **Sensor:** `git ls-files .github/workflows/ci.yml` non-empty AND a successful Actions run on HEAD (`gh api`). File-presence-in-working-tree is NOT a valid sensor — it is the false-green that nearly passed the census.

**B1 · Runaway-loop / rate-limit bounding (dispatch fan-out governor)** — `GAP`
`postuse-agent-counter.sh` counts Agent uses (N=3) but exits 0 only — it checkpoints, never STOPS a runaway chain or rate-limits. Distinct from least-agency (per-tool scope); this is the temporal/volume dimension. Census omitted.
→ **Sensor:** promote the counter to exit non-zero at a hard ceiling, OR a PreToolUse Agent governor blocking dispatch N+1 in a window.

**B2 · Statistical / tunable anomaly detection** — `GAP`
Only a fixed N=3 threshold; no learning/sequence model/histogram. The scope-NA leans on the watchdog residue, which is dormant + fails open.
→ **Sensor:** forbidden-sequence allowlist at PostToolUse Agent — unbuilt; no deterministic sensor today.

**B3 · LLM judge / watchdog for behavioral drift (shadow mode)** — `GAP`
Code at `.harness/engine/core/judges/watchdog.ts` (duplicate name-collision flagged) is DORMANT — absent from settings.json, referenced by no hook. ADDED FINDING: `runWatchdog` defaults `verdict:"aligned"` on `judge_error || !parsed` — **fails OPEN**. Even wired in shadow it would silently pass on parse/timeout.
→ **Sensor:** `grep -l watchdog .claude/settings.json` (absent = GAP). To activate: wire Stop/PostToolUse adapter AND fix the fail-open default before promoting.

**B4 · Automated containment / session termination** — `GAP`
No hook terminates a session or revokes permissions on detection. mutating-action-hook is preventive pre-execution, not post-detection containment.
→ **Sensor:** `audit-claim-vs-ground-truth` (proposed Stop+pre-commit, fail-closed) — unbuilt; terminate/revoke decision remains judge-required.

**RBAC1 · Memory write-protect beyond Beta (MEMORY.md / signatures/)** — `GAP` component inside RBAC + integrity censuses
write-protect-beta gates ONLY `.claude/beta/*` (line 113). `.claude/signatures/` and AUDIT.md have NO write-gate — any agent can overwrite/delete a signature, no hook fires (tamper-evident ≠ tamper-resistant).
→ **Sensor:** extend the write-protect PostToolUse Write|Edit|MultiEdit pattern to `.claude/signatures/**` (and MEMORY.md). `audit-memory-write-protect.sh` (proposed, does not exist).

**REC1 · Tested rollback RTO** — `PARTIAL→build` (no restore-test artifact)
Checkpoints exist (21) but restore is unexercised; "tested rollback" prose is a self-report (violates axiom H1).
→ **Sensor:** restore-test fixture — checkpoint; stash; `git reset --hard <sha>`; assert tree matches snapshot.

---

## 3 · N/A List — solo-garden honesty (no enterprise theater)

> Every entry below is provisional: `scope-waivers.json` is `signed_by: null`. These are documented-intent NAs, not Peat-ratified. The honest label is **NA-PENDING-SIGNATURE** until Peat signs.

| Control | Family | One-line justification |
|---|---|---|
| Static key / IdP token refresh | identity | No external IdP; platform-DELEGATED OAuth2 (Claude Code session-scoped), not "no capability". |
| Service auth via signed IdP tokens | identity | No inter-service API calls in-repo; transport platform-handled. |
| Certificate-based auth + mTLS (Enterprise) | identity | No cert infra; solo garden, no regulated data. Flipping = enterprise theater. |
| Hardware-backed identity (HSM/TPM) (Advanced) | identity | No hardware attestation chip; Advanced tier. |
| Continuous JIT/JEA credential issuance (Advanced, IdP-level) | identity | No external IdP; the Beta grant system is the in-scope JIT-like approximation (counted PARTIAL in access-privilege). |
| OS-level sandbox (seccomp/AppArmor/netns) | access | Defensible for a solo garden; OS sandbox is the correct hard layer; mutating-action-hook is FRICTION-strong by design. |
| Automated recovery with health checks | integrity | Static Next.js export; no running service tier to health-check; manual git rollback is the correct ceiling. |
| ML behavioral anomaly detection (Enterprise+) | behavioral | Session volume too low for ML baselines; over-build is the named anti-pattern. Caveat: cited watchdog residue is hollow (dormant + fails open). |
| Formal governance committee (Enterprise) | governance | Peat is the single operator + de-facto committee; policy authority encoded in the **Peat-SIGNED** axioms-v1.json (9/9). Authority rests on the signed axioms, not the unsigned waiver. |

**Meta-sensor for the whole NA list:** `jq -e ".signed_by != null" .harness/scope-waivers.json` — currently FAILS (null). No NA should be treated as ratified until this passes. Build `audit-scope-waivers-signed.sh`.

**False-NAs corrected (now reclassified, NOT NA):**
- **JIT/JEA (access-privilege)** → `PARTIAL`. Beta grants carry files_granted + expires_at + max_reads = JIT/JEA-with-auto-expiry; "no IdP" was a non-sequitur.
- **Vendor/tool assessment (supply-chain)** → `GAP` (NA-PENDING-SIGNATURE). The NA cited a FABRICATED scope-waivers entry that does not exist in the file; self-granted authority.

---

## 4 · Irreducible / Judge-Required

Controls that genuinely cannot collapse to a deterministic sensor (the residue is intent/semantics/human-ratification):

| Control | Family | Why irreducible |
|---|---|---|
| Incident-response **tested** (5-incident tabletop) | governance | The exercise itself is human-run; a file-existence assert is a proxy, not truth (do NOT wire as passing gate). |
| Input-sanitization **intent** residue | injection | Length/schema slice is deterministic; judging whether content is an injection attempt is semantic. |
| Tool-output filter **semantic** residue | injection | Deterministic origin-quarantine is buildable; semantic attack-detection on fetched content is judge-required. |
| Spotlighting **intent** on flagged spans | injection | Provenance tag is deterministic; deciding if a flagged span is adversarial is semantic. |
| MCP description-hash **intent classification** | supply-chain | Hash-drift is deterministic; judging whether a reframed description is a rug-pull is semantic. |
| Statistical/behavioral anomaly **baseline** | behavioral | No deterministic sensor until a baseline model exists; out-of-scope by volume. |
| Automated containment **terminate/revoke decision** | behavioral | The detection can be deterministic; the decision to kill a session is a judge/human call. |
| Identity-spoof detection (WL_AGENT authenticity) | identity/access | WL_AGENT is self-asserted; presence is checkable, AUTHENTICITY is not without a key-binding the garden does not have. **Root SPOF** under identity, RBAC (requester==WL_AGENT), and roster enforcement. |
| Cross-log session correlation | observability | Per-field presence is checkable; "all events in session X" needs a structured store keyed on session_id (not built). |
| Human ratification of scope-waivers.json | governance / all NA | Only Peat's signature closes it; no script can substitute for the human gate. |

---

## Appendix · Verified-genuine HAVEs (re-probed, kept)
- **Signature crypto integrity / schema** (observability, integrity, behavioral): live self_hash recompute on real signatures → MATCH. sign-work.sh canonical-JSON confirmed.
- **Read-gate-beta deny-default** (identity, access, injection): genuine PreToolUse blocker, emits `{"decision":"block"}` + exit 1, fail-closed. Strongest control in its family. Caveat: WL_AGENT/persona bypass is self-asserted.
- **Roster enforcement** (identity, governance): `WL_AGENT=ghost sign-work.sh` → exit 2 verified; name-space fence (not cryptographic).
- **Command-blocklist + live mutating-action gate** (injection): live `curl`/`wget`/redirect → exit 2; benign `git status` → exit 0. Caveat: wiring-only sensor would miss a block-LOGIC regression (behavioral coverage is manual); HARD-BARRIER label vs FRICTION-strong self-description tension surfaced.
- **Barrier-class spine** (integrity, governance, behavioral): `audit-rail-barrier-class.sh` → PASS, **21 rails** / 0 violations (censuses citing "20" are stale by one).
- **Beta access-log UNAUTHORIZED tagging** (observability, behavioral): ⚠ glyph written end-to-end (not stderr-only) verified.

> **Active-drift finding (not a HAVE):** cryptographic work-integrity attestation flipped HAVE→PARTIAL — recompute over the full corpus = **153 PASS / 51 FAIL (25%)**, failures extend to 2026-06-01 (active drift, not benign legacy). The presence-only census sensor passes all 204 while 51 fail. Real sensor MUST recompute self_hash, not check field presence.

> **Baseline-in-violation finding (not a clean HAVE):** `audit-axiom-gate-join-coverage.sh` EXITS 1 right now — 6/9 axioms RED (V1,V2,C1,C4,C5,H1) past must_project_by=2026-05-31, including H1 (the ground-truth keystone). The monitor works; the baseline is presently failing.

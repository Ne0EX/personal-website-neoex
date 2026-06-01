# Security Harness — Certification-Readiness Design

**Date:** 2026-06-01 · **Author:** Polaris (α-OPS-00) · **Status:** DESIGN-ONLY — build needs Peat approval
**Source:** OWASP/Anthropic Zero Trust eBook control map (zerotrust-cert-design) ⊕ Polaris-verified harness census
**Companion:** `docs/team/sensor-manifest-draft.json` (machine-readable sensor specs)

---

## 1. EXECUTIVE

**Thesis.** A gate is only worth its green if the green traces to **ground truth, not a proxy**. Today our
gates mostly prove what they check and stop there ("build green + 200" ≠ "the page is right"). The fix is
**deterministic-first**: for every Zero Trust control, prefer a scriptable hard gate (like our `audit-*.sh`)
over an LLM judge; admit a judge **only** on the irreducible residue, and start every judge in **shadow**.
The substrate is the already-built-but-dormant `worldline-harness/` engine, **revived** and merged into one
system — after collapsing the name collision (two things are called "worldline-harness" today).

**The four bugs that put us here, and the control each maps to:**

| # | Bug (today) | Why it slipped | Control it maps to | New sensor |
|---|---|---|---|---|
| 1 | `/archive` shipped as a **crooked overlay** when Peat had decided a separate page | no gate compares rendered surface to design intent | render-fidelity-vs-intent | `audit-render-fidelity-vs-intent` |
| 2 | **"build green + 200" passed as "done"** — nobody opened the page | proxy accepted as anchor; no observed-artifact requirement | ground-truth-observed | `audit-ground-truth-observed` |
| 3 | **pagefind indexed 2/15 pages** (`data-pagefind-body` was `display:none`) | no gate asserts index completeness | search-index-completeness | `audit-search-index-completeness` |
| 4 | **globe = 3 divergent blobs** across branches; fixes never reached production `.tsx` | no single-source-of-truth gate | config-integrity / blast-radius | `audit-single-source` |

Neither the active stack (`.claude/hooks` + `scripts/audit-*.sh` + `.harness/axioms`) nor the dormant engine
catches any of the four. They are the reason for this build.

---

## 2. SUBSTRATE DECISION

**Revive `worldline-harness/`, don't rebuild.** It already contains the deterministic sensors
(globe-discipline, tokens, next16, secrets-scan, **mutating-action**, typecheck, lint, placement,
test-presence, task-discipline), the LLM judges (watchdog, heavy, task-substance), an LSP host, an
attestation/contract lifecycle, anchor packs, and a tier ladder (shadow→warn→block). It is **dormant**:
no `harness:*` npm script, no `.git/hooks/pre-commit` symlink (both verified absent), anchors still point at
farm-erp. It last fired 2026-05-07 on farm-erp fixtures. *Code exists; enforcement = zero.*

**Collapse the name collision.** Two artifacts are named "worldline-harness":
- `.harness/worldline-harness.config.json` — the **active** rail registry (owner Canopus).
- `worldline-harness/.harness/` — the **dormant** ported engine.

Resolution: **`.harness/` is the single live root** (config + axioms + rails). Move the dormant engine to
`.harness/engine/` and fold its `harness.config.json` (sensors/judges/modes) into the existing rail registry
so there is **one config root and one rail vocabulary**.

| Action | What |
|---|---|
| **Install** | `harness:check` / `harness:sensors` / `harness:judges` npm scripts; `.git/hooks/pre-commit` → `.harness/engine/adapters/git/pre-commit.sh`; wire dormant `secrets-scan` + `mutating-action` into `settings.json` PreToolUse Bash matcher (today there is none). |
| **Adapt** | farm-erp anchors → Worldline (`anchors/curated/{intent,design-rails,tech-rails}.md` repoint to soul-atlas + `axioms-v1.json`); farm-erp fixtures → globe / soul-atom gallery / content routes. |
| **Drop** | codex + copilot-cli adapters (Claude Code only); farm-erp phase-scope rules; any enterprise/regulated judge not justified for a solo garden. |

Keep the 9 signed axioms (`.harness/axioms-v1.json`, V1–V3/C1–C5/H1) as the **value/convention/harness**
anchor the judges grade against. H1 ("a gate's green must trace to ground-truth or self-declare as proxy")
is the existing-axiom form of this whole doc's thesis.

---

## 3. THE CONTROL MATRIX

ZT tier shorthand: **F** Foundation, **E** Enterprise, **A** Advanced. "We-have" cites the real file; "dormant"
= on disk in the engine but firing on nothing.

| Control | ZT tier (brief) | Claude Code impl | We-have-today | Class | Barrier | Cert now | Gap | Proposed sensor | Owner |
|---|---|---|---|---|---|---|---|---|---|
| **P1 Never trust, always verify** | F signed tokens+logs · E mTLS+immutable audit · A HSM+per-action authz | Pre/Post hooks block on result; session-id audit; OTel→SIEM | `sign-work.sh` files_sha256+self_hash, Algol re-verify; 16 `audit-*.sh`; on-dispatch log | HYBRID | FRICTION (detect-after) | F partial | verify is post-hoc, non-blocking; false-green commits before audit | `audit-claim-vs-ground-truth` (Stop+pre-commit, fail-closed) | Canopus+Algol |
| **P2 Assume breach** | F tested rollback+VC config+identity isolation · E sandbox+containment · A microVM+JIT | checkpoints/rewind; isolated context; ConfigChange hooks | `save-checkpoint.sh`+git; `audit-territory.sh`; write/read-gate-beta; main-web-only policy | HYBRID | MIXED (territory HARD; main-filter FRICTION) | F | main-web-only is Polaris judgment not a gate; no auto-containment; ConfigChange unwired | `audit-main-web-only` + ConfigChange hook | Canopus+Polaris |
| **P3 Least privilege** | F RBAC deny-default · E ABAC · A JIT/JEA session-scoped | **deny-by-default `settings.json` permissions** | **NOTHING** — `permissions:{}` empty (verified) | DETERMINISTIC | NONE today → HARD when set | none | no deny-default; every tool implicitly allowed | `settings.json` deny-default allow-list + `audit-permissions-nonempty` | Canopus+Peat |
| **Impossible-not-tedious (SPINE)** | cross-tier acceptance test | deny-default; PreToolUse fail-closed; curl/wget blocklist; checkpoints; Constitutional Classifiers (judge→threshold→det) | implicit only (memory); no `barrier_class` field on rails | DETERMINISTIC (meta) | HARD (the definition) | none | no gate stops a FRICTION control masquerading as `mode=block` | `audit-rail-barrier-class` + add `barrier_class` to rail schema | Canopus+Polaris+Peat |
| **Blast radius** | F isolation+rollback · E sandbox · A immutable+per-action | isolated context; OS sandbox (seccomp/netns/mounts); checkpoints | territory+branch+checkpoint; main-web-only policy | HYBRID (single-source = DET) | MIXED → push HARD | F | globe = 3 divergent blobs; no single-source gate; no OS sandbox | `audit-single-source` (sha256/import canonical) | Canopus+Sirius |
| **Least agency** (OWASP) | F per-function tool scope · E dynamic+content-filter · A per-action+JIT | `settings.json` allow-list; PreToolUse param-validate fail-closed; curl/wget blocklist; session-scoped ask | effectively none; only wired PreToolUse (`on-dispatch.sh`) **exits 0 always** (logs, never blocks) | DETERMINISTIC | NONE → HARD when wired | none | every tool full agency; no curl/wget block; no loop bound | settings allow-list + blocking PreToolUse + `audit-least-agency-config` | Canopus+Algol |
| **Regulated / compliance** | F baseline · E NIST/NSA · A HIPAA/FINRA/GDPR/FedRAMP | none (positioning) | N/A — solo garden, no regulated data | N/A | N/A | F is correct ceiling | risk is **over-building** | `.harness/scope-waivers.json` (Peat signs N/A list) | Peat |
| **Direct prompt injection** | F input-validate+length · E content-filter · A Constitutional Classifiers | PreToolUse param-validate fail-closed; ask-perms | none purpose-built; watchdog = design-drift only, warn, dormant | HYBRID | HARD (pre-gate) / FRICTION (judge) | none | no PreToolUse param schema; no length caps | `audit-tool-param-shape` (wired PreToolUse) | Canopus |
| **Indirect / cross-domain injection** | F validate · E tool-output filter · A isolated+policy | isolated context; input spotlighting; verify full URL | **ZERO** — WebFetch/WebSearch/Read ungated; runtime-allowlist is prototype-console only | HYBRID | HARD (provenance) / FRICTION (judge) | none | total gap; doc's highest-severity class | `wrap-untrusted-fetch` (provenance tag + domain allowlist; judge shadow) | Canopus |
| **Tool / resource misuse** | F RBAC deny · E sandbox+containment · A per-action | deny-default; PreToolUse; OS sandbox; curl/wget block | **mutating-action.ts + denylist mode=block but DORMANT/unwired**; wired settings has no Bash gate | DETERMINISTIC | HARD once wired (now zero) | none | highest-leverage gap: prod-grade blocklist fires on nothing | **wire `mutating-action`** as PreToolUse Bash hook (promotion, not invention) | Canopus |
| **Tool poisoning / rug-pull** | F inventory · E signed manifests · A remote attestation | ConfigChange hooks; managed VC settings; signed configs | ZERO integrity check; `enabledMcpjsonServers:["playwright"]` unpinned; mutating-mcp denylists names not descriptions | DETERMINISTIC | HARD | none | no manifest pin / description hash | `audit-mcp-manifest-pin` (hash vs lockfile) | Canopus |
| **Tool chaining** | F log+threshold · E anomaly+containment · A ML+per-action | OTel metrics; session-id attribution; Pre/Post log | partial: `postuse-agent-counter`, signatures, checkpoint — no sequence baseline | HYBRID | FRICTION (detective) → HARD with sequence gate | F | no forbidden-transition allowlist | (later) forbidden-sequence allowlist; judge shadow | Algol |
| **Credential / output leak** | F secret-scan · E DLP · A continuous | secrets regex; client-component key scan | `secrets.ts` (sk-ant-/sk-/JWT/ghp_/env-tracked) **DORMANT** | DETERMINISTIC | HARD once wired | none | unwired | **wire `secrets-scan`** (pre-commit+PostToolUse) | Canopus |
| **Memory poisoning** | F write-protect · E provenance · A signed memory | read/write-gate hooks | **PARTIAL** — Beta store only (`read-gate-beta`/`write-protect-beta` wired, deny-default RBAC, fail-closed); MEMORY.md/signatures/handoffs have no equivalent | DETERMINISTIC | HARD (Beta) / NONE (rest) | F (Beta only) | generalize write-protect beyond Beta | extend write-protect to MEMORY.md/signatures | Canopus |
| **Supply chain (model+tool)** | F lockfile · E SBOM/Scorecard · A AI-BOM+attestation | committed lockfile; managed settings | `package-lock.json` committed (passive only); no Scorecard/dependabot/workflow | DETERMINISTIC | HARD | none | no lockfile-drift gate | `audit-lockfile-drift` (lock changes iff package.json does) | Algol |
| **Sub-agent privilege inheritance** | F static roles · E dynamic · A per-action | isolated context windows (platform default) | inherited from Claude Code default isolation — not built/verified by us | DETERMINISTIC (verify) | HARD (platform) | F | unverified assumption | assert isolated-context in fixture; otherwise N/A | Algol |

---

## 4. DETERMINISTIC-FIRST LEDGER

**Count (17 mapped controls):** **DETERMINISTIC 10** · **HYBRID 4** · **JUDGE-REQUIRED 2** · **N/A-scope 1.**
Counting the hybrids by their *enforcement* path, **14 controls have a deterministic hard gate** and only the
**2 residues below genuinely need an LLM** — both start in **shadow**, both behind a deterministic pre-gate:

1. **Render-fidelity aesthetic residue** — geometry (crooked / overlap / clip / off-screen) is fully
   deterministic from the DOM (`transform !== identity`, bounding-box overlap, overflow clip). What a script
   *cannot* settle is "does it FEEL like the frozen design" — subjective fidelity. Judge only on that residue.
2. **Indirect-injection intent** — provenance tagging + domain allowlist quarantine untrusted fetched content
   deterministically. Reading the *intent* of an already-quarantined span (is this text an attack?) needs an
   LLM. Judge only on flagged spans.

Everything else — least-privilege, least-agency, mutating-action, secrets, single-source, search-index,
ground-truth-observed, main-web-only, MCP-pin, lockfile-drift, the barrier-class spine — collapses to a
script. **Judges never start at `block`** unless thresholded with a measured cut (the Constitutional-Classifiers
exception); `audit-rail-barrier-class` enforces that rule mechanically.

**Highest-leverage deterministic sensor:** wiring the **dormant `mutating-action`** denylist as a real blocking
PreToolUse Bash hook. It is the one control where a production-grade hard barrier (blocks `rm -rf`,
`git push/reset/rebase`, deploys, `bash -c`, redirection, ~50 mutating MCP tools) already exists and fires on
nothing — promotion, not invention, converts FRICTION-zero to HARD-barrier in one wire.

---

## 5. NEW SENSORS FOR TODAY'S BUGS

All deterministic-first; owners Canopus (harness/hooks) + Algol (audit logic/tests). Each shows *how it would
have caught the specific bug.*

**`audit-render-fidelity-vs-intent`** (Algol) — Bug #1. Playwright renders the **actual production route**,
extracts a layout signature (bounding boxes, computed `transform`, `overflow`, stacking) and diffs it against a
design-intent manifest. Deterministic pre-gate fails on `transform !== identity` / overlap / clipping; judge
(shadow) only on aesthetic residue. *Would have caught:* the `/archive` crooked overlay had a non-identity
transform and overlapped content — a hard fail before merge. Promote pre-gate to `block`, keep judge `shadow`.

**`audit-ground-truth-observed`** (Algol) — Bug #2. A TASK **cannot close DONE** unless an observed artifact
exists per shipped route: `.claude/visual-diffs/<task>/observed/<route>.png` + `observed.json`
{route, sha256, viewport, ack}. Script-checked existence + non-staleness. *Would have caught:* there was no
screenshot of `/archive`, so "done" could not have been asserted. Turns the proxy ("200") into the anchor (a
real rendered surface, acknowledged).

**`audit-search-index-completeness`** (Algol) — Bug #3. Post-build: enumerate crawlable routes (app router /
sitemap), read pagefind index `page_count`, assert `page_count == crawlable_count`; also assert no
`data-pagefind-body` sits under `display:none`. *Would have caught:* 2 indexed vs 15 crawlable → immediate
fail; the `display:none` body assertion catches the root cause.

**`audit-single-source`** (Canopus) — Bug #4. For designated single-source artifacts (globe component,
soul-atom tokens) assert **exactly one** canonical definition; every prototype/handoff copy either imports it
or is byte-identical (sha256). *Would have caught:* 3 divergent globe blobs → divergence fail; forces fixes
into the one canonical `.tsx`.

(Plus `audit-claim-vs-ground-truth` from §3: re-runs the rails named in a closing signature's `steps[]`,
recomputes `files_sha256`, fails closed on mismatch or empty-steps — closing the known signature gap.)

---

## 6. CERTIFICATION READINESS

After the build, honestly mapped to Zero Trust tiers:

**Foundation — fully met.** Deny-by-default permissions, per-function tool scoping, identity-based isolation
(territory + Beta RBAC), tested rollback (git + checkpoints), version-controlled review-able configs,
comprehensive timestamped audit + crypto-integrity signatures, secret scanning, lockfile pinning. This is the
correct ceiling for Worldline.

**Enterprise — partial / selective.** We get NIST-flavored building blocks (crypto signatures, append-only
audit, single-source config-integrity, MCP-manifest pinning ≈ signed-manifest verification) **without** the
heavy machinery: no OS sandbox/seccomp/AppArmor, no network namespace, no mTLS cert-pinning, no automated
containment, no real SIEM stream. We adopt the *intent* of the Enterprise row where a script delivers it; we do
not cosplay the infrastructure.

**Advanced — explicitly N/A for a solo garden.** HSM/TPM hardware-backed identity, remote attestation,
confidential-computing/microVM, JIT/JEA with auto-expiry, ML behavioral anomaly detection, and all regulated
compliance (HIPAA/FINRA/GDPR/FedRAMP) are **out of scope** and recorded as such in
`.harness/scope-waivers.json` (Peat-signed) so later waves don't build enterprise theater.

**What "certified" honestly means here:** *every `mode=block` rail is a HARD barrier or carries a signed
FRICTION waiver; every green traces to ground truth or self-declares as proxy (axiom H1); the four bugs above
are each blocked by a deterministic gate.* **It does NOT mean:** a SOC, a regulated posture, OS-level sandbox
isolation, or hardware identity. "Impossible-not-tedious" cuts **both ways** — the same test that rejects
friction-as-security also rejects enterprise controls whose only value here would be theater. Identity is still
the soft spot: `WL_AGENT` is a self-asserted env var (spoofable); we accept that as a single-operator garden
and do not pretend otherwise.

---

## 7. BUILD PLAN (gated — NOT executed this run)

**Irony-guard:** this document is **design-only**. Building any of it requires Peat's approval, and the whole
point of the harness is that work is not "done" because the prose says so. Each wave checkpoints to Peat before
the next begins.

| Wave | Name | Owner | Items | Checkpoint |
|---|---|---|---|---|
| **0** | Substrate + spine | Canopus | collapse name collision (engine→`.harness/engine/`); `harness:*` npm scripts; pre-commit symlink; `audit-rail-barrier-class` + `barrier_class` rail field; `scope-waivers.json` (Peat signs) | Peat |
| **1** | Least-privilege + least-agency (root gap) | Canopus | populate `settings.json` deny-default + per-agent allow-list; deny curl/wget/net-egress; `audit-permissions-nonempty`; **wire mutating-action + secrets-scan** as PreToolUse Bash gate; `audit-least-agency-config` | Peat |
| **2** | Today's-bug sensors | Algol | `audit-ground-truth-observed`; `audit-render-fidelity-vs-intent` (det pre-gate block, judge shadow); `audit-search-index-completeness`; `audit-single-source`; `audit-claim-vs-ground-truth` | Peat |
| **3** | Blast-radius + supply-chain | Canopus + Algol | `audit-main-web-only`; `audit-mcp-manifest-pin`; `audit-lockfile-drift`; ConfigChange hook on settings/`.harness` | Peat |
| **4** | Judge promotion (only where no det equivalent) | Algol | `audit-tool-param-shape` PreToolUse; `wrap-untrusted-fetch` + provenance; keep both judges shadow, promote to warn only after fixture validation | Peat |

**Ordering rationale:** Wave 0 makes the rules enforceable (spine) before any rule is added. Wave 1 closes the
root least-privilege gap (`permissions:{}` empty) and lands the single highest-leverage win (wiring the dormant
mutating-action). Wave 2 directly retires the four bugs that triggered this work. Waves 3–4 harden the
periphery and admit the two minimal judges last, in shadow.

---

*Decision requested:* approve the build (and which waves), or revise scope. Nothing ships without your sign-off.

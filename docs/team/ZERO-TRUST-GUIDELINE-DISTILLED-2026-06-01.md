# Zero Trust for AI Agents — Distilled Guideline (implementable form)

> **Provenance:** distilled by full-read agent from
> `~/Downloads/6a1611a04085d7cd3dadc924_Claude-eBook-Zero-Trust-for-AI-Agents-05182026.pdf` (36 pp).
> **Why this file exists:** the original `zerotrust-cert-design` wave (`wss54r23u`) died with its
> session (Antigravity memory leak, 2026-05-31) before writing `SECURITY-HARNESS-DESIGN-2026-06-01.md`.
> This is the recovered, distilled source so the **redeploy wave reads this instead of re-reading 36 pp ×8 agents**.
> Detail + implementation preserved per Peat's directive ("เอาทั้ง detail + implementation ไม่ใช่แค่ concept").
> **Status: INPUT MATERIAL for the wave — NOT the design doc.** The design doc maps these controls
> against our census + classifies deterministic-vs-judge. Read-only; no build implied.

---

## Document structure

- **Principles** — never trust/always verify · assume breach · least privilege.
- **Part I** — autonomous-system threat model; *blast radius*, *least agency*; regulated-industry alignment.
- **Part II** — OWASP agentic threats: prompt injection, tool poisoning, identity/privilege abuse, memory poisoning, supply-chain, context poisoning.
- **Part III** — Zero Trust applied: **three-tier model** (Foundation / Enterprise / Advanced) across identity, access, observability, behavioral monitoring, input/output, integrity, governance.
- **Part IV** — 8-phase implementation workflow: identify requirements · manage supply chain · define boundaries · defend injection · secure tool access · protect credentials · safeguard memory · measure what matters.
- **Part V** — defensive ops at machine speed: SOAR/Agentic SOAR, MITRE mapping, tabletop, emergency procedures.

---

## Tier model (cumulative: Enterprise ⊇ Foundation, Advanced ⊇ Enterprise)

### Foundation — minimum viable
- **Identity:** unique cryptographic identifier per agent instance (lifecycle creation→retirement); static-key issued by IdP w/ automatic token refresh.
- **Service auth:** signed tokens from IdP, auto-refresh.
- **Access:** RBAC **deny-by-default**; static least-privilege roles per function; identity-based isolation (services accept only named agents).
- **Observability:** comprehensive logs of all tool invocations / data access / external comms w/ timestamps + context; basic input validation + length limits; threshold-based alerts w/ automated first-pass triage; manual definition of expected behavior.
- **Behavioral:** threshold alerts for obvious deviations; route alerts to sec team (triage agent w/ read-only SIEM).
- **I/O:** basic input validation; output filtering for PII/credentials/sensitive patterns (block/redact/log).
- **Integrity:** version-controlled configs (review required); documented + tested rollback.
- **Governance:** documented acceptable-use + incident-response; address Shadow AI.

### Enterprise — organizational scale
- Certificate-based auth (X.509) full lifecycle · **mutual TLS w/ cert pinning** · **ABAC** (context-aware) · dynamic privilege adjustment (return to baseline) · **sandboxed execution** (seccomp/AppArmor, restricted mounts/network) · **immutable audit trails** (append-only + crypto integrity) · distributed tracing (OpenTelemetry) · statistical anomaly detection (tunable) · **automated containment** for high-confidence threats (terminate session / revoke creds) · content filtering (known attack patterns) · semantic output analysis · **signed configs w/ deploy verification** · automated rollback w/ health checks · formal governance committee.

### Advanced — high-risk / regulated
- Hardware-backed identity (HSM/TPM) + remote attestation · hardware-bound service auth · **continuous authorization** (per-action) · **JIT/JEA** w/ auto-expiry · real-time SIEM streaming + correlation · ML behavioral analysis (contextual) · immutable infra w/ attestation (microVMs) · continuous policy enforcement (automated compliance checks).

---

## Control classification (deterministic-first lens)

Principle the whole design hangs on: **"make undesired actions impossible, not merely tedious."**
→ **HARD-BARRIER** = removes capability (survives). **FRICTION-ONLY** = slows but doesn't prevent.
→ **DETERMINISTIC** = a script/config/hook enforces it. **JUDGE-REQUIRED** = needs LLM/human. **HYBRID** = enforcement deterministic, policy/design needs judgment.

**DETERMINISTIC · HARD-BARRIER (the spine — maximize these):**
unique agent identity · auto token refresh (minutes-scale) · cert-based auth + mTLS · **deny-by-default** · RBAC/ABAC enforcement · JIT/JEA issuance+expiry · identity-based isolation · sandboxed/hardware isolation · network segmentation · comprehensive + immutable logging · distributed tracing · automated baseline learning · **tool allow-listing** · **settings.json tool permission control** · **PreToolUse param validation hook** (fail-closed) · session/memory isolation · context-integrity hashing · **context retention `cleanupPeriodDays`** · checkpoints/rewind · isolated context windows · **command blocklist (curl/wget)** · network-request approval gate · cryptographic signing (supply chain) · signed configs · automated rollback/containment · managed settings / `allow-ManagedPermissionRulesOnly`.

**HYBRID (deterministic enforcement, human policy):**
RBAC role design · ABAC attribute policy · dynamic privilege elevation · least-agency scope · dwell-time/coverage targets · threshold setting · OpenSSF Scorecard action · AI-BOM · documented use-cases.

**JUDGE-REQUIRED · FRICTION-ONLY (minimize — start in shadow mode):**
input spotlighting · semantic output analysis · human-in-loop high-risk approval · manual behavior baseline · command-injection intent detection · context-aware harmful-instruction analysis · vendor assessment · governance committee · "models take notes, humans make containment calls."
*(Note: Constitutional Classifiers are JUDGE to set threshold but DETERMINISTIC/HARD-BARRIER once thresholded — ~95% jailbreak block.)*

---

## Claude Code-specific pro-tips (exact mechanisms)

| Pro-tip | Mechanism | Use |
|---|---|---|
| **Deny-by-default permissions** | `settings.json`; unapproved write/execute blocked | baseline posture |
| **PreToolUse hook param validation** | hook inspects params vs schema, fail-closed (unknown → manual approval) | block malicious params before tool |
| **Managed settings files** | `settings.json` in VCS for review/rollback; `managed_settings` org-enforced, user cannot override | version all policy; block overrides |
| **`allow-ManagedPermissionRulesOnly`** | prevents users defining own permission rules | org-policy lockdown (Advanced) |
| **Isolated context windows** | fresh context per session; sub-agents no parent history | prevents memory poisoning |
| **Pre/Post hooks** | run before/after tool; can block on result | validate params, inspect outputs, log |
| **ConfigChange hooks** | trigger on settings change; log/alert/block | detect lateral-movement / unauthorized config edits |
| **OpenTelemetry metrics** | instrumented tracing → exportable to SIEM | audit trail + behavioral analysis |
| **NL command descriptions** | human-readable command intent | audit/explainability |
| **Session-scoped "ask" permissions** | OAuth2 auto-refresh; expire at session end | auto-revoke elevated perms |
| **OS-level sandboxing** | seccomp/AppArmor + network namespace + restricted mounts | contain blast radius |
| **Unique `session.Id`** (+ account/org id) | per-session id in audit logs | precise incident attribution |
| **Checkpoints / rewind (Esc+Esc)** | state hash before each edit; restore code/convo independently | recover from malicious/accidental change |

---

## Certification

No formal badge is offered. Compliance = **every control appropriate to your tier implemented** (enforce hard-barriers, measure friction-controls for coverage), plus:
1. Comprehensive logging w/ attribution/timestamps/context.
2. Anomaly detection + human-in-loop investigation operational; **alert dwell time < 1 hr** for critical.
3. Escalation/containment playbooks **tested** (tabletop: 5 simultaneous incidents).
4. Supply-chain security (OpenSSF Scorecard, AI-BOM, vendor assessment) documented + reviewed.
5. RTO to known-good state documented + tested.

Tier-to-regulation mapping: **Foundation** = baseline · **Enterprise** = NIST/NSA + intl gov alignment · **Advanced** = HIPAA/FINRA/GDPR/FedRAMP. (US federal Zero-Trust mandate by 2027.)

**Honesty rule for our design:** mark controls **N/A for a solo digital garden** explicitly — no enterprise theater. The wave's job is to find where each control *collapses to a deterministic sensor we can actually run* (Playwright DOM assertion, hook, audit script, signature), not to cosplay a SOC.

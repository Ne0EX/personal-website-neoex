# docs/qa/REPORTS/ZT-CENSUS-identity-authentication.md

## task · adversarial verification of Zero-Trust census, family = identity-authentication

## verdict · REVISE — 2 flips, 4 NA evidence-corrections, 1 omitted GAP, multiple broken sensors

## what I re-probed (primary evidence)

- `sign-work.sh` roster + canonical self_hash formula (lines 16-43, 46-57, 359)
- `pre-handoff.sh` roster + next_recipient.designation match (17-72)
- `read-gate-beta.sh` deny-default matcher (120-180) — genuine RBAC, blocks on no grant
- `write-protect-beta.sh` path scope (line 113 — gates ONLY `.claude/beta/*`)
- `.harness/scope-waivers.json` — full file; `status: UNSIGNED-STUB`, every `signed_by: null`
- `.claude/sessions/*.meta.json` — 40 files
- `.claude/settings.json` — deny list (curl/wget) + allow length 64
- `docs/team/SECURITY-HARNESS-DESIGN-2026-06-01.md` control matrix

## findings

### F1 — three cited "Deterministic" sensors do not exist
`scripts/audit-roster-integrity.sh`, `scripts/audit-session-meta-integrity.sh`,
`scripts/audit-memory-write-protect.sh` are all MISSING from disk. The census presents
them as live deterministic scripts. They are proposals at best. A sensor pointing at a
nonexistent file cannot catch anything.

### F2 — self_hash sensor is presence-only; 51/204 signatures FAIL recompute
Census sensor for the attestation control is `jq -e '.hashes.self_hash and ...'` — field
PRESENCE only. Running the actual canonical recompute (per SCHEMA.md §canonical
serialization AND sign-work.sh:359) across the whole corpus:
**153 PASS / 51 FAIL (25% unverifiable).** The presence-only sensor passes all 204.
This is the textbook case of "a sensor that would not catch the failure it claims to."
Failures are NOT a clean pre-spec legacy band — they extend to 2026-06-01
(REVISE-2026-06-01-AUDIT-SINGLE-SOURCE-B1-B3, TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-1).
Active attestation-integrity drift, not benign history. → flips control to PARTIAL.

### F3 — every NA leans on an UNSIGNED stub falsely described as "Peat-acknowledged"
`scope-waivers.json` is `"status": "UNSIGNED-STUB"`, authored by Canopus, with
`signed_by: null` on every entry, and its own rule states "Peat must set signed_by —
agents may not self-sign." The census says "Peat-acknowledged" / "Peat-acknowledged in
scope-waivers.json" repeatedly. FALSE. The NA *statuses* survive on scope grounds (no
enterprise theater), but the *justification* is agent self-certification dressed as human
ratification. Evidence text corrected on all 4 NA controls.

### F4 — controls 2 & 3 ("static-key IdP", "service auth tokens") are platform-delegated, not N/A-as-not-applicable
The census itself notes Claude Code's OAuth2 session-scoped refresh exists (platform
behavior). That makes these platform-DELEGATED, not "no such thing." NA stands (no
repo-level sensor) but evidence reframed: delegated to Anthropic platform, unverifiable
at repo level — not absent.

### F5 — systemic WL_AGENT spoofability (single point under multiple controls)
`requester==WL_AGENT` (read-gate-beta), caller check (write-protect-beta), and roster
enforcement (sign-work / pre-handoff) ALL trust the same self-asserted env var. The
census isolates spoofability to control #1; it is actually one root SPOF under the RBAC
PARTIAL and roster HAVE too. Noted in those controls' evidence.

### F6 — session-mode isolation: 17/40 meta files stuck at mode=pending
The mode-isolation HAVE claims mode resolves to genesis/beta and locks. 17 of 40 files
are still `pending`. The census sensor (`jq -e '.session_id and .mode and .started_at'`)
PASSES pending because "pending" is truthy — it does not verify resolution. Sensor
tightened to assert `mode != "pending"` for sessions that received a prompt. Control stays
HAVE (mechanism real; session_id attribution genuine) with sensor correction.

### F7 — omitted in-family control: no secret/credential-exposure scan
No secrets-scan hook or script exists (design doc build-plan lists `secrets-scan` as
PLANNED, not done). Committed-credential exposure is an identity-authentication concern
(a leaked key IS an identity). Added as a GAP control.

## controls held as correct
- Roster enforcement HAVE: `sign-work.sh` exits 2 on unknown codename — verified runnable.
- read-gate-beta deny-default: genuine block-on-no-grant RBAC — verified.
- Memory-poisoning GAP on MEMORY.md/signatures: write-protect-beta line 113 confirms
  it gates ONLY `.claude/beta/*`. GAP correctly stated.

## note
NA statuses were NOT flipped to GAP — flipping Advanced/Enterprise-tier controls
(mTLS/HSM/JIT-JEA) would be the enterprise theater the garden explicitly guards against.
The defect is the evidence (unsigned stub), not the scoping.

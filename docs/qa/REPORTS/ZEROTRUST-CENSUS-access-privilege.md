# QA Report — Zero-Trust Census Adversarial Verify · family: access-privilege

## verdict
FAIL-AS-SUBMITTED — 2 overstated verdicts flipped (1 false-HAVE, 1 false-NA), 1 control added as GAP, multiple sensor-mismatch notes recorded. Re-probed every cited file. All NA verdicts are provisional: they rest on `.harness/scope-waivers.json` which is `signed_by: null` (UNSIGNED-STUB; the file's own rule bars agents from self-signing — Peat must ratify).

## flips

### 1. "deny-by-default permissions" — HAVE → PARTIAL (false-HAVE)
Evidence demonstrates a curl/wget **denylist** (8 entries in `.claude/settings.json:6-15`), not deny-by-default. Deny-by-default means the *residual/unmatched* action is denied. Direct counter-evidence in the working tree:
- `mutating-action-hook.sh` Phase 4 is literally `first-seen warn (allowed)` → `exit 0`. Unrecognized commands are allowed and logged, not denied.
- `settings.json` pairs a ~60-entry **allow**-list with only two denied verbs (curl, wget). Everything unmatched falls to Claude Code's default (ask), not deny.
- No `defaultMode`/`bypassPermissions` key in either settings file (grep: NONE FOUND) — so there is no platform-level deny-default either.
The cited sensor `audit-permissions-nonempty.sh` only asserts `.permissions.deny` is a non-empty array. It cannot distinguish "denylist present" from "deny-by-default," so it does NOT catch the failure it is cited for. Note Control 9 ("non-empty deny enforcement = HAVE") is the *honest* framing of this exact same sensor — Control 1 overstated it.

### 2. "JIT/JEA (Just-In-Time / Just-Enough-Access)" — NA → PARTIAL (false-NA)
This contradicts the census's own Controls 3 and 7. The Beta grant system (`.claude/beta/grants/*.json`, enforced per-call by `read-gate-beta.sh`) carries `files_granted` (just-enough scope) + `expires_at` (auto-expiry / just-in-time) + `max_reads`/`reads_consumed` (usage-bound). That **is** JIT/JEA with auto-expiry — scoped to Beta memory, not generalized. The "no external IdP" rationale is a non-sequitur: JIT/JEA needs no IdP. Two active grant files confirmed on disk. Flip to PARTIAL (have for Beta; no equivalent for signatures/MEMORY.md/handoffs).

## added control

### "permission-mode integrity (defaultMode ≠ bypass/acceptEdits)" — GAP
The single config that silently voids the entire access-privilege family. No `defaultMode` key exists today (so not currently broken), but there is **no gate** asserting it stays absent/safe. A future edit setting `defaultMode: bypassPermissions` would void every deny + every PreToolUse gate with zero detection. Census omitted this. Adding as GAP. Sensor proposal: extend `audit-permissions-nonempty.sh` to assert `defaultMode` ∉ {bypassPermissions, acceptEdits} (or absent).

## sensor-mismatch notes (recorded, not all flips)
- **Control 2 (RBAC allow-list):** sensor `audit-least-agency-config.sh` assertion 2 only checks hook-wiring + curl/wget deny-present. It never validates the allow-list is curated/non-wildcard — it does not verify the RBAC control it is bound to. Status kept HAVE (allow-list is in fact curated, verified by eye) but evidence narrowed: the *sensor* doesn't prove it.
- **Control 6 (territory isolation):** kept PARTIAL. `audit-territory.sh` IS run in CI via `npm run harness:audit`, but it is a **detective CI gate only** — NOT wired as a runtime PreToolUse hook, and keyed on the spoofable `WL_AGENT`. Census's PARTIAL + spoofability acknowledgment is fair.
- **Control 7 (Beta write protection):** evidence narrowed. `write-protect-beta.sh` is a **PostToolUse** hook (settings.json PostToolUse Write|Edit) — it fires *after* the write hits disk and only `exit 1`s with "FIX: revert this edit"; it does NOT auto-revert. So the write side is **detective-after-write**, not preventive. Read gate (`read-gate-beta.sh`, PreToolUse) is genuinely preventive. Kept HAVE because read is preventive and write is enforced/fail-closed in CI + flagged, but the post-hoc nature is a material caveat.
- **Control 13 (agent identity uniqueness):** sensor checks `WL_AGENT` *present*, not *authentic*. It cannot catch spoofing — the exact failure mode. Census PARTIAL + honest spoofability note is correct; sensor mismatch recorded.
- **Control 11 (network egress / WebFetch gap):** confirmed. `mutating-action-hook.sh` non-Bash branch `exit 0`s WebFetch/WebSearch/Read ungated. WebFetch entries in `settings.local.json` are *allow* pins (github.com, mager.co, loooom.xyz); no deny-default for WebFetch in primary settings. PARTIAL correct.

## NA provisionality
Controls 5 (now flipped), 8 (OS sandbox) rest on `scope-waivers.json` which is unsigned. Control 8 (OS sandbox NA) is otherwise a defensible scope call for a solo garden, but its NA is **provisional pending Peat's signature**. An adversarial auditor does not grant NA on an unratified waiver.

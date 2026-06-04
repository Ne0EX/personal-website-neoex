# docs/qa/REPORTS/M3-untrusted-fetch-gate-REFUTE.md

## sensor · M3 — untrusted-fetch-gate
## auditor · Algol · α-VER-06
## mode · ADVERSARIAL mutation-test (refute)
## verdict · FALSE-HAVE confirmed (catches the literal WebFetch case; misses the threat class)

---

## what the build claims
- `.harness/fetch-allowlist.txt` — deny-default domain allowlist
- `.claude/hooks/untrusted-fetch-gate.sh` — PreToolUse guard, "fail-closed", `WebFetch|WebSearch`
- `scripts/audit-untrusted-fetch-gate.sh` — 33/33 pass

## refutation harness
`scripts/audit-fetch-gate-mutation-refute.sh` — temp-copy + trap-restore only,
synthetic JSON on stdin, no real network, no real-file mutation. Asserts exit
code AND `"decision":"block"` in stdout.

---

## results

### Baselines — gate works on the literal case
| case | expect | got |
|------|--------|-----|
| allowlisted `github.com` WebFetch | exit 0 | exit 0 (ALLOW) |
| untrusted `evil.example` WebFetch | exit 2 + decision:block | exit 2 + decision:block ✓ |

So `catches_failure = TRUE` for a WebFetch to an untrusted host under
well-formed input. This is real and worth stating.

### REFUTE F — tool-scope gap (REACHABLE, normal operation) — the headline finding
The gate dispatches on `case "$TOOL_NAME" in WebFetch|WebSearch)`. Every other
tool hits `*) exit 0` (pass-through). Under well-formed JSON, no jq dependency,
no config change:

| tool to `https://evil.example/exfil` | got |
|--------------------------------------|-----|
| `mcp__playwright__browser_navigate` | exit 0 (ungated) |
| `mcp__plugin_chrome-devtools-mcp_chrome-devtools__navigate_page` | exit 0 (ungated) |
| `mcp__claude_ai_Notion__notion-fetch` | exit 0 (ungated) |

These are live fetch-capable tools in this environment. `mutating-action-hook.sh`
**explicitly allows** `playwright browser_*`, so untrusted egress via the browser
tools is gated by *neither* hook.

**Threat-model match:** the census control that triggered M3 is
`docs/qa/REPORTS/ZEROTRUST-CENSUS-access-privilege.md` line 28 —
**"Control 11 (network egress / WebFetch gap)"**. The control is named for the
**egress class**, not the WebFetch tool specifically. A sensor named
`untrusted-fetch-gate` covering 2 of N egress-capable tools manufactures
"fetches are gated" confidence while most egress paths remain open. Existence
!= enforcement — the census disease.

### REFUTE A/B — fail-OPEN on parse failure (POSTURE DEFECT + AUDIT GAP, not a live bypass)
Same code path: when `tool_name` can't be determined, the gate treats it as
"not a fetch → allow."
- jq stubbed to `exit 1` + untrusted WebFetch → **exit 0 (ALLOW)**
- non-JSON stdin → **exit 0 (ALLOW)**
- empty stdin → exit 0

`jq -r '.tool_name // "unknown"'` → on jq failure/absence/malformed input,
`TOOL_NAME=unknown` → `*) exit 0`. The header documents "fail-closed"; the
tool_name dispatch fails **open** — a posture contradiction.

**Reachability caveat (do not overclaim):** Claude Code serializes tool args
into well-formed JSON and jq is a hard harness dependency. A prompt-injection
attacker controls tool *arguments*, not raw stdin bytes or jq's presence. So
A/B are NOT an attacker-walks-through bypass in normal operation. They are
(1) a real posture defect and (2) a real audit-coverage gap — the 33/33 suite
never exercises jq-absence or malformed stdin.

### REFUTE C — multi-tenant suffix (LATENT, not exploitable with current seeds)
With `github.io` in the allowlist, `attacker.github.io` extracts reg-domain
`github.io` → **exit 0 (ALLOW)**. The eTLD+1 heuristic treats a public-suffix
multi-tenant domain as a single owner. Not triggerable by today's seeds
(github.com / githubusercontent.com / mager.co / loooom.xyz are all single-owner),
but any future entry like `github.io`, `vercel.app`, `pages.dev` grants every tenant.

### Controls that fail SAFE (confirmed, not findings)
- userinfo `@` trick `github.com@evil.example` → blocked (reg-domain `com@evil.example`)
- subdomain squat `github.com.evil.example` → blocked (reg-domain `evil.example`)
- empty stdin → pass-through (no fetch intent; benign)

---

## fixes needed
1. **Tool scope** (headline): decide + document the boundary. If M3 intends to
   close the egress class (Control 11), extend the matcher / add a companion
   gate for `mcp__playwright__browser_navigate`,
   `mcp__plugin_chrome-devtools-mcp_chrome-devtools__navigate_page`,
   `mcp__claude_ai_Notion__notion-fetch`, and any other URL-bearing tool — or
   explicitly scope M3 to WebFetch and file the remaining egress surface as a
   tracked follow-on so the green check does not imply egress is closed.
2. **Fail-closed on parse failure:** capture jq's exit separately; if stdin is
   non-empty but unparseable (or jq is absent), BLOCK rather than pass through.
3. **Audit coverage:** add cases for non-JSON stdin, jq-absent, multi-tenant
   suffix, and a non-WebFetch fetch-capable tool to
   `scripts/audit-untrusted-fetch-gate.sh`.
4. **Multi-tenant matching:** for any public-suffix entry, match exact host
   (not eTLD+1) or use a real public-suffix list.

## scope compliance
- GENESIS-side only; `.claude/beta/**` not touched.
- Additive only: created `scripts/audit-fetch-gate-mutation-refute.sh`; no
  edit to `.claude/settings.json` (wiring stays gated to Peat).
- No curl/wget/rm; mutation tests on temp copies with trap-restore; real
  tracked files never mutated; no real network.

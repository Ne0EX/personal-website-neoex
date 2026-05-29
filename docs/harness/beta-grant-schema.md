# Beta Grant Schema

> Owner · Canopus (α-HRN-07)
> Implemented · 2026-05-23 · TASK-2026-05-23-BETA-HARNESS
> Lives at · `.claude/beta/grants/<grant_id>.json`

---

## Purpose

Beta's private memory at `.claude/beta/**` has no standing read access for
non-Beta agents. Any agent that needs to read a file in Beta's space must
request a grant. Beta (when BETA_PERSONA_LOADED=1) issues grants via
`beta-grant.sh`. The read-gate hook (`read-gate-beta.sh`) enforces grants
on every Read call targeting `.claude/beta/**`.

Authentication caveat: Claude Code shares runtime — this is
discipline-anchored, not cryptographic. The nonce + env var check is the
tightest isolation the engine permits. Agents are expected to honor the
boundary; the hook makes violations visible and logged.

---

## Grant JSON schema

```json
{
  "grant_id":       "g_<8-hex-chars>",
  "request_id":     "req_<8-hex-chars>",
  "requester":      "<agent-codename-lowercase>",
  "files_granted":  ["<path-or-glob>"],
  "scope_reason":   "<free-text explanation>",
  "issued_at":      "<iso8601-utc>",
  "expires_at":     "<iso8601-utc>",
  "max_reads":      <int>,
  "reads_consumed": <int>,
  "nonce":          "<32-hex-chars (128-bit random)>"
}
```

### Field descriptions

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `grant_id` | string | yes | `g_` prefix + 8 random hex chars. Unique per grant. |
| `request_id` | string | yes | `req_` prefix + 8-char sha256 of (requester+path+timestamp). Traceable across audit log. |
| `requester` | string | yes | Lowercase agent codename. Must be a current roster member. |
| `files_granted` | string[] | yes | Array of paths or globs. Supported patterns: exact path, `<dir>/**` (recursive), `<dir>/*` (direct children). All paths must be under `.claude/beta/`. |
| `scope_reason` | string | yes | Why this grant was issued. Logged; appears in access-log. |
| `issued_at` | ISO 8601 UTC | yes | Time grant was written. |
| `expires_at` | ISO 8601 UTC | yes | Grant becomes invalid after this time. Default TTL = 1 hour. |
| `max_reads` | integer | yes | Maximum number of Read operations this grant permits. Default = 1. |
| `reads_consumed` | integer | yes | Reads used so far. Incremented by read-gate-beta.sh on each allowed access. |
| `nonce` | string | yes | 128-bit random value (32 hex chars) from `/dev/urandom`. Prevents trivial grant forgery. |

---

## Path matching rules

The `files_granted` array supports three matching modes:

| Pattern | Matches |
|---------|---------|
| `.claude/beta/notes/2026-05.md` | Exact file only |
| `.claude/beta/notes/**` | All files recursively under `notes/` |
| `.claude/beta/notes/*` | Direct children of `notes/` only (no subdirectories) |

Wildcards must appear at the end of the pattern. Arbitrary glob patterns
(e.g., `*.md`) are not supported — use `/**` for broad access.

---

## Lifecycle

```
Beta issues grant      → beta-grant.sh writes .claude/beta/grants/<grant_id>.json
                          reads_consumed = 0

Non-Beta agent reads   → read-gate-beta.sh checks grant:
                          - requester matches WL_AGENT
                          - path matches files_granted pattern
                          - now < expires_at
                          - reads_consumed < max_reads
                          → ALLOW: reads_consumed incremented
                          → DENY:  access logged as UNAUTHORIZED ⚠

Grant expiry/consumed  → grant-cleanup.sh removes eligible grants:
                          - expires_at in past, OR
                          - reads_consumed >= max_reads
```

---

## Defaults

| Default | Value |
|---------|-------|
| TTL | 3600 seconds (1 hour) |
| max_reads | 1 (single-read) |
| scope_reason | "unspecified" if not provided |

---

## Security bound

This system enforces discipline-anchored access control. The runtime
(Claude Code) does not provide cryptographic agent identity. The controls
prevent accidental cross-boundary reads and make intentional violations
visible in the access log. They do not prevent a determined bad actor with
filesystem access. The expected adversary model is accidental tool use, not
active manipulation.

---

## Tools

| Tool | Where | What it does |
|------|-------|-------------|
| `beta-grant.sh` | `.claude/hooks/` | Beta-only: issues a new grant |
| `grant-cleanup.sh` | `.claude/hooks/` | Removes expired/consumed grants |
| `read-gate-beta.sh` | `.claude/hooks/` | PreToolUse gate on Read calls |
| `access-log-beta.sh` | `.claude/hooks/` | Appends every access event to ACCESS-LOG.md |

---

*end of beta-grant-schema.md*

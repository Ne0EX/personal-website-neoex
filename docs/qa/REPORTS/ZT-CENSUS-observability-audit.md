# QA · Zero-Trust census adversarial verification

## family · observability-audit
## verdict · CENSUS REVISED — 1 false-HAVE flipped, 2 NA provenance-busted, 2 ripple caveats, 2 missing controls added

Algol re-probed every cited file on a fresh read. Findings below; corrected control list is the deliverable.

---

## flips & caveats

### 1. On-dispatch logging — HAVE → GAP  (false-HAVE)
Census evidence claims entries are `caller=<WL_AGENT> … target=<agent>` and that non-Polaris
dispatch is flagged `ANOMALY=non-polaris-dispatch`. Ground truth from `.claude/settings.json:117-121`:

```
matcher: "Agent"
command: jq -r 'select(.tool_name=="Agent" and .tool_input.subagent_type=="polaris") | .tool_input.description'
         | { read -r desc; [ -n "$desc" ] && bash .claude/hooks/on-dispatch.sh "$desc" "polaris"; }
```

- Fires ONLY when dispatching **to** polaris (`subagent_type=="polaris"`) — not for general agent dispatch.
- Passes `.tool_input.description` into the **TASK_ID** positional slot; hardcodes `"polaris"` as target.
- `WL_AGENT` is never set in the hook env → `caller=unknown` on **every** entry.
- The ANOMALY guard (`on-dispatch.sh:28`) only fires when `caller != "unknown"` → it is **dead code** in practice.

Live log confirms: every line in `.claude/hook-logs/polaris-dispatch.log` reads
`caller=unknown … target=polaris`, with the *description* in the task slot. The control as
described (caller+target attribution, anomaly flag) does not function. → **GAP**.

**Both proposed sensors are broken:**
- `grep ANOMALY=` can never match (guard is dead code).
- The "python3 check settings.json contains the on-dispatch command" wiring-presence sensor would
  **PASS while the control is non-functional** — a false sensor that green-lights a dead control.

### 2. Anomaly detection — PARTIAL (kept) but evidence corrected
Census lists `on-dispatch.sh ANOMALY=non-polaris-dispatch` as a working anomaly mechanism. It is not
(see flip 1). The real anomaly surface that *does* work: `postuse-agent-counter.sh` N=3 threshold,
`access-log-beta.sh UNAUTHORIZED ⚠`, Algol INTEGRITY/SCHEMA-FAIL. Status stays PARTIAL; evidence
de-listed the dead on-dispatch anomaly.

### 3. Attribution — PARTIAL (kept) but harder
Census frames WL_AGENT as merely "spoofable." Stronger concrete instance: the dispatch log has
**zero** attribution — `caller=unknown` on 100% of entries — because the hook never receives WL_AGENT.
This is attribution *absence*, not just spoofability. Folded into evidence.

### 4. Hook-log coverage — HAVE → PARTIAL  (false-HAVE)
Census claims "every hook writes `<task_id>--<hook>.log`" and its sensor asserts "for every task_id in
`.claude/signatures/`, corresponding hook-logs exist." Ground-truth counts:

| artifact | count |
|---|---|
| v2 signatures | **204** |
| `--steps.log` | 52 |
| `--pre-task.log` | 49 |
| `--harness.log` | 71 |
| `--baseline.json` | 52 |

The sensor's own assertion would FAIL for ~75% of signed task_ids (52 steps logs vs 204 sigs). Two
structural counterexamples to "with task_id": `on-dispatch` writes one shared `polaris-dispatch.log`
(not task_id-keyed); `save-checkpoint` writes timestamp-keyed logs. Post-edit fires on every edit
(2730 logs) so the *aggregate* trail is rich, but per-task coverage is not universal. → **PARTIAL**.

### 5. Distributed tracing / OTel — GAP, but NA-sensor provenance is BUSTED
The GAP status is correct (no OTel anywhere — confirmed). The defense for the NA *sensor* rests on
`SECURITY-HARNESS-DESIGN §6` which itself rests on `.harness/scope-waivers.json` being "Peat-signed."
Ground truth: that file is `"status": "UNSIGNED-STUB — Peat signs when reviewed"`, `signed_by: null`
on the file AND on every entry, `created_by: canopus`. **The human gate has not been ratified.** Per
decision-provenance rule, a Canopus-originated unsigned waiver is not authority. The *reasoning*
(solo garden, no SIEM) is sound, but the NA is asserted on unratified provenance → keep GAP, sensor
re-noted as **NA-PENDING-RATIFICATION**, not settled NA.

### 6. Dwell-time coverage — GAP/NA → GAP (NA dodge on the cheap half)
The control conflates two things: (a) an async alert/notification pipeline (genuinely NA for solo
garden — no SOC/on-call), and (b) measuring time-to-detection. (a) is fine as NA. But the sensor
("judge-required … NA") dodges the cheap, real half: there is **no instrumentation that even records
detection latency** for the synchronous gates that DO exist (sign-time/handoff-time blocks). Same
unsigned-waiver provenance problem as #5. Status stays GAP; the blanket NA-sensor is downgraded —
a deterministic "time between event-write and operator-visible surface" timestamp delta IS buildable.

---

## confirmed sound (re-probed, no change)

- **Signature crypto integrity (HAVE)** — ran the sensor live on
  `TASK-2026-06-03-…--canopus.json`: stored self_hash == recomputed
  (`jq -cS 'del(.hashes.self_hash)' | tr -d '\n' | shasum -a 256`) → MATCH. PENDING guard
  (`sign-work.sh:369-375`) and fail-closed harness mode (`:215-236`) present. Genuine HAVE.
- **Beta memory access log (HAVE)** — verified end-to-end that `read-gate-beta.sh:119,169` passes
  the verdict string `"UNAUTHORIZED ⚠"` (glyph included) which `access-log-beta.sh:50` writes into
  EVENT_LINE → log. The `grep "UNAUTHORIZED ⚠"` sensor correctly catches read-gate denials. Genuine HAVE.
- **Immutable audit trail (PARTIAL)** — accurate; see missing-control add below for the gap it omits.
- **Session start metadata (PARTIAL)** — accurate; session_id captured, not propagated into log names.
- **Audit-trail baseline scoping (PARTIAL)** — accurate; AUDIT.md confirms recurring zero-baseline
  fallback producing 147-file over-broad `files_touched`.
- **Attribution session ID (PARTIAL)** — accurate.

---

## missing controls (observability-audit family)

### M1. Hook-log tamper-evidence — GAP
Only `signatures/` carries crypto integrity. The 10k+ hook-log files — the *bulk* of the actual
observability record — are plain mutable files: no per-line hash, no chaining, no integrity check.
"Immutable audit trail (PARTIAL)" covers signatures/ACCESS-LOG/AUDIT.md but explicitly NOT the
hook-logs that constitute most of the trail. Real omission for an observability family.

### M2. Silent logging-failure — GAP
Nearly every hook writes with `2>/dev/null || true` (on-dispatch:34, access-log-beta:91,101,
postuse-agent-counter throughout). A failed log *write* leaves no trace anywhere. For an
observability family, "the audit trail can fail to record an event without anyone knowing" is an
un-sensored control. No watchdog asserts log-write success.

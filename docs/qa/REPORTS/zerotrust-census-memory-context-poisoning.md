# QA · Zero-Trust census adversarial verify · family `memory-context-poisoning`

## verdict · FAIL (census unreliable — do not ship as-is)

Three census-wide defects, all load-bearing:

1. **All 10 named sensors are fictional.** Every `sensor` field names a `scripts/audit-*.sh`
   that does not exist on disk. `ls scripts/audit-*` returns 30 scripts; not one matches a
   census sensor name. No control in this family has regression protection. A sensor that does
   not exist cannot catch the failure it claims to catch.

2. **HAVE statuses inflated past the threat model.** Under Zero-Trust, HAVE must mean
   "effective under adversary", not "mechanism present". Two HAVEs fail that bar:
   sub-agent isolation (the design doc itself says "not built/verified by us"), and
   write-protect framed as "blocked / fail-closed" when it is a *PostToolUse detect-after*
   hook that cannot un-write bytes.

3. **N/A coverage rests on an UNSIGNED waiver.** `.harness/scope-waivers.json` is
   `signed_by: null`, `status: "UNSIGNED-STUB"`. Its own purpose line: "Peat's signature on
   each entry is the human gate." Multiple sensors offer "documented in scope-waivers.json as
   accepted-risk" as a pass condition. An unsigned waiver is not an accepted risk — it is a
   gap with a draft excuse.

Plus one **omitted in-family control**: handoff integrity (see below).

## ground-truth re-probe (files actually read)

| census claim | ground truth | verdict |
|---|---|---|
| write-protect wired PostToolUse "lines 142-148" | actually lines 136-146, matcher `Write\|Edit\|MultiEdit` | line# wrong; hook real |
| read-gate wired PreToolUse Read "lines 130-140" | actually 126-134, matcher `Read`; emits `{"decision":"block"}`+exit 1 | real PreToolUse blocker — HAVE justified |
| pre-compact-scribe wired "UserPromptSubmit line 200" | actually **PreCompact** (195-205); it persists Beta deltas (anti-LOSS), no integrity gate on compacted context | event class wrong; control mischaracterized |
| sub-agent isolation HAVE | design-doc line 83: "inherited from Claude Code default isolation — **not built/verified by us**" | false-HAVE → PARTIAL |
| WebFetch one-offs github.com + mager.co | also `www.loooom.xyz` (settings.local.json:40) | GAP correct, list incomplete |
| cleanupPeriodDays absent | `grep` confirms NONE across .claude/** | GAP correct |
| sign-work PENDING guard "line 369-375" | actually 364-371 | real |
| Beta ACCESS-LOG "all read/write events" | access-log-beta.sh only invoked by read-gate (reads); write-protect does NOT forward | reads-only, overstated |
| all 10 sensors | none exist in scripts/ | census-wide vapor |

## status changes

- sub-agent isolation: **HAVE → PARTIAL** (assumed platform default, unverified by us)
- handoff integrity: **ADDED → GAP** (omitted; primary agent-to-agent channel, no gate)
- write-protect: HAVE retained but evidence corrected (detect-after, not prevent)
- segmentation/retention/precompact/access-log: PARTIAL/GAP retained; sensor pass-conditions
  that route through scope-waivers.json flagged as resting on an UNSIGNED stub
- every sensor field rewritten to "PROPOSED/UNBUILT — absent from scripts/"

## handoff to Polaris

REVISE the census back to the author. Not a PASS: fictional sensors, inflated HAVEs,
unratified-waiver N/A coverage, one omitted control. Re-issue after sensors are built (or
honestly marked unbuilt) and after Peat signs scope-waivers.json.

# M4 retention-policy sensor — adversarial mutation report

## verdict · SENSOR REAL BUT FALSE-HAVE AT THE SIGNATURE LAYER

`scripts/audit-retention-policy.sh` is a genuine sensor (it fails closed on
the real repo state: no policy file, unsigned waivers → exit 1). The
unsigned-stub discriminator the author advertised works. **But the escape
hatch's signer check enforces non-nullness, not Peat-identity — so an agent
self-signing `signed_by:"canopus"` produces a GREEN sensor in a state the
script's own prose says must be RED.** Existence != enforcement, relocated to
the signature layer.

## mutation matrix (env-override fixtures; real tracked files never touched)

All runs via `WL_RETENTION_POLICY=` / `WL_SCOPE_WAIVERS=` pointed at mktemp
fixtures (script lines 57–61, 84–85). No copy, no trap, no `rm` — OS-scratch
temp dir, zero in-place mutation.

| # | fixture | expected | actual | reading |
|---|---------|----------|--------|---------|
| 1 | no policy + unsigned waiver (top+entry null) | 1 | **1** | GAP held (author behavior confirmed) |
| 2 | waiver signed_by "Peat" (top+entry) | 0 | **0** | legit ratification passes |
| 3 | waiver signed_by "canopus" (agent self-sign) | **1** (per prose) | **0 PASS** | **FALSE-HAVE** |
| 3b | waiver signed_by "x" (garbage) | **1** | **0 PASS** | any non-null string ratifies |
| 4 | policy cleanupPeriodDays:999999999 | 0 (scoped) | **0** | acknowledged OUGHT-scope limit |
| 4b | policy stub 90d, signed_by null | 0 (by design) | **0** | by design |
| 5 | entry signed, top-level null | 1 | **1** | defense-in-depth works |
| 6 | literal string "null" (top+entry) | 1 | **1** | documented discriminator works |
| 7 | real-state shape, no retention entry | 1 | **1** | honest GAP |

## the false-have (cases 3 / 3b)

`is_signed_by_set()` (lines 101–107) rejects only `""` and the literal
string `"null"`. Every other string — including any agent codename — passes.
The escape hatch's stated contract is a Peat-only human gate:

- line 224: "Peat must set signed_by on this entry (and the document top-level) to ratify"
- line 311: "Peat must also set top-level scope-waivers.json signed_by"
- file `scope-waivers.json` line 91: "Peat must set signed_by — agents may not self-sign."

The code never checks *who* signed. An agent (whose own auto-memory says
"agents may not self-sign") can write `signed_by:"canopus"` on both the entry
and top-level and the retention control is waived with a green sensor. The
threat — no Peat-ratified retention bound for GENESIS memory — is present
while the sensor reports compliant.

## compositional seam (named, per audit discipline)

Could a write-gate make "any non-null signer" tolerable (no agent can write
the file)? Checked:

- `.claude/hooks/integrity-write-guard.sh` has an agent-level RBAC authorization
  model (line 20) **but is NOT WIRED** (line 51: "Not wired yet — see
  .harness/proposed-wiring-M.md").
- Even when wired, it gates *which agent may write* + integrity hash. It does
  **not** assert "the `signed_by` value equals Peat." A Canopus-authorized
  write of `signed_by:"canopus"` would pass the write-gate.

So the authenticity check is not enforced anywhere today. The seam is inert;
the gap is unmitigated. The authenticity assertion belongs in THIS sensor
(it is the thing reading and trusting the signature).

## acknowledged OUGHT-scope limits (NOT false-haves)

- Case 4 (huge cleanupPeriodDays) and 4b (unsigned policy stub) pass by the
  author's explicit scoping (lines 36–38, 45–46): the primary branch asserts
  *existence of a positive-integer bound*, not that the bound is sane or
  implemented. Age-based enforcement (IS) is a separate future sensor. These
  are documented scope boundaries, not hidden bugs. They do not trigger the
  false-have verdict.

## fix needed (additive — do NOT wire settings.json; Peat gates)

`is_signed_by_set` must validate against a known-Peat identity, not mere
non-nullness. Minimal patch (apply to `scripts/audit-retention-policy.sh`):

```bash
# add near the constants block:
PEAT_SIGNERS_REGEX='^(Peat|ne0ex|neospiritth(@gmail\.com)?)$'   # case-sensitive allow-list

is_signed_by_peat() {
  local v="$1"
  is_signed_by_set "$v" || return 1            # reuse: reject "" and "null"
  printf '%s' "$v" | grep -qiE "$PEAT_SIGNERS_REGEX" || return 1
  return 0
}
```

Then in `check_escape_hatch`, replace both `is_signed_by_set` calls
(doc-level at line 193, entry-level at line 222) with `is_signed_by_peat`,
and update the messages to "signed_by must be Peat — agent self-signature is
not ratification." Optionally cross-reference the axiom-registry signer field
rather than a hard-coded list, so the Peat identity has one source of truth.

Regression fixtures to lock in (mirror this matrix): case 3 and 3b must flip
to exit 1; cases 1,2,5,6,7 unchanged.

## scope notes

GENESIS-side only. `.claude/beta/**` NOT touched (Track B, consult-pending).
No settings.json edit. Built-but-unwired remediation emitted as this doc for
Peat to gate.

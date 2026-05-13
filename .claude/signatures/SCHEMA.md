# Signature schema

Defines the payload that `sign-work.sh` writes and `algol` audits.

Signatures live in this directory as `<task_id>--<codename>.json`, one file per agent per task.

---

## versions

| version | introduced | added fields                                                                                          |
|---------|------------|-------------------------------------------------------------------------------------------------------|
| v1      | α-origin   | (baseline — `agent` as plain string; no `signature_schema_version` field)                              |
| v2      | α 1.130426 | `signature_schema_version`, `agent_designation`, `pre_cutover_codename`; `next_recipient` as object   |

Algol reads `signature_schema_version` first to select the verifier. Absent field ⇒ assume v1.

---

## v2 payload (canonical example)

```json
{
  "signature_schema_version": 2,
  "task_id": "TASK-2026-05-14-02",
  "agent": "Polaris",
  "agent_designation": "α-OPS-00",
  "pre_cutover_codename": "Mira",
  "started_at": "2026-05-14T09:00:00+07:00",
  "completed_at": "2026-05-14T09:42:00+07:00",
  "files_touched": [
    "docs/design/fork-screen-v1.md"
  ],
  "summary": "Wrote spec for audience fork screen per PRD-02.",
  "steps": [
    "read .claude/handoffs/from-polaris/TASK-2026-05-14-02.md",
    "read /mnt/project/prd-02.md §functional requirements",
    "wrote docs/design/fork-screen-v1.md",
    "ran post-edit.sh — clean",
    "ran sign-work.sh"
  ],
  "hashes": {
    "files_sha256": {
      "docs/design/fork-screen-v1.md": "9a8d…"
    },
    "self_hash": "c2f1…"
  },
  "harness_passed": true,
  "next_recipient": {
    "agent": "Sirius",
    "designation": "α-SUR-01"
  }
}
```

### field notes (v2)

- `signature_schema_version` — integer. Currently `2`. Required.
- `agent` — Titlecase codename. Required.
- `agent_designation` — `α-XXX-NN` form. **Immutable per slot**, even if the codename changes again later. Primary key for cross-version identity.
- `pre_cutover_codename` — Titlecase string or `null`. Required field; `null` for agents who joined after α 1.130426.
- `next_recipient` — object with `agent` (Titlecase) and `designation` (α-XXX-NN). Both fields required. Single-token recipients are rejected at `pre-handoff.sh`.
- `hashes.self_hash` — see canonical serialization below.

---

## canonical serialization

`self_hash` is computed over the canonical JSON of the payload **excluding** `hashes.self_hash`:

- sorted keys (recursively)
- compact separators: `(",", ":")`
- UTF-8 encoded
- no trailing newline

Reference (Python):

```python
import json, hashlib
payload_for_hash = {**payload}
payload_for_hash["hashes"] = {**payload["hashes"]}
payload_for_hash["hashes"].pop("self_hash", None)
canonical = json.dumps(payload_for_hash, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
self_hash = hashlib.sha256(canonical).hexdigest()
```

Reference (bash via `jq`):

```bash
self_hash=$(jq -cS 'del(.hashes.self_hash)' "$payload_file" | sha256sum | awk '{print $1}')
```

`jq -cS` produces compact output with sorted keys, equivalent to the Python canonical form for ASCII keys.

---

## verification (Algol's algorithm)

1. Read `signature_schema_version`. Absent ⇒ v1 verifier; present ⇒ select by integer.
2. Confirm required fields present per the version's spec.
3. Strip `hashes.self_hash`, recompute via canonical serialization, compare against the stored value.
4. Recompute `hashes.files_sha256` from the working tree, compare against the stored values for every file in `files_touched`.
5. **v2 only** · confirm `next_recipient.designation` matches a current roster member listed in `.claude/AGENTS.md` Crew Roster.
6. **v2 only** · if `pre_cutover_codename` is non-null, confirm it maps to `agent_designation` via the Nomenclature table in `.claude/AGENTS.md`.

Any mismatch on steps 3–6 ⇒ **INTEGRITY-FAIL** (severity above quality-fail). Step 2 failures ⇒ **SCHEMA-FAIL** (likely a bug in `sign-work.sh`; route to Canopus).

---

## migration

- v1 signatures stay valid forever — do not re-sign. Algol verifies them with the v1 verifier indefinitely.
- All new signatures from α 1.130426 onward are v2.
- `pre_cutover_codename` is required only for the nine agents renamed at α 1.130426. New agents added later leave it `null`.
- If a future schema bump is needed (v3+), add the version number; do not retrofit older payloads.

---

## what NOT to put in a signature

- API keys, tokens, secrets — these are not work product; they don't belong in `steps`.
- Personally identifying user data — same rule.
- Binary file contents — only the sha256 of binary files. Never the bytes.
- Free-form essays — `summary` is one sentence, `steps` are short imperative lines. Long prose belongs in handoffs, not signatures.

A signature is an audit trail, not a diary.

---

*end of SCHEMA.md*

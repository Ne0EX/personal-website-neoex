# parse-template · for-algol
# recipient: algol α-VER-06
# shape: audit-trail (signatures / files touched / hook outcomes / integrity markers)
# output budget: ≤ 500 words
# parser flag: --for algol

---

## output format

produce an audit-trail digest for algol's verification pass.
algol uses this to cross-check signatures, confirm hook runs, and flag gaps.

---

## sections to extract (in order)

### signatures referenced · {{session_date}}

scan for: any mention of sign-work.sh, signature files, task IDs with completion claims.

output block:
```
SIGNATURES · {{session_date}}
{{signature_lines}}
```

format per line: `- task_id: {{task_id}} · agent: {{agent}} · status: {{status}}`
valid status values: `signed` / `mentioned-unsigned` / `failed` / `not-mentioned`
budget: ≤ 80 words.

---

### files touched (claimed) · {{session_date}}

scan for: any file paths mentioned as edited, created, or deleted during the session.
this is what was claimed — algol verifies against actual git diff independently.

output block:
```
FILES TOUCHED (CLAIMED) · {{session_date}}
{{files_lines}}
```

format per line: `- {{file_path}} · claimed by: {{agent}} · operation: {{created|edited|deleted}}`
budget: ≤ 100 words.

---

### hook outcomes · {{session_date}}

scan for: any mention of pre-task.sh, post-edit.sh, harness-check.sh, visual-diff.sh,
sign-work.sh, pre-handoff.sh — pass, fail, skipped, or not run.

output block:
```
HOOK OUTCOMES · {{session_date}}
{{hook_lines}}
```

format per line: `- {{hook_name}} · task: {{task_id}} · outcome: {{pass|fail|skipped|not-mentioned}}`
if a hook was not mentioned: `- {{hook_name}} · not mentioned`
budget: ≤ 100 words.

---

### integrity flags · {{session_date}}

scan for: any mention of INTEGRITY-FAIL, SCHEMA-FAIL, carry-over warnings, WL_DOC_ONLY misuse,
self-hash mismatch, or known deviations logged.

output block:
```
INTEGRITY FLAGS · {{session_date}}
{{flag_lines}}
```

format per line: `- [{{severity}}] {{description}} · agent: {{agent}}`
valid severity values: `INTEGRITY-FAIL` / `SCHEMA-FAIL` / `WARNING` / `DEVIATION` / `ADVISORY`
if none: write `- none recorded`
budget: ≤ 80 words.

---

## parser notes

- all `{{...}}` fields must be filled; no empty fields in output
- algol reads to verify — report what was said, not what should have been said
- if a field has no content: `- none recorded`
- do not editorialize; no judgments in the digest itself
- output only the audit-trail block, no preamble


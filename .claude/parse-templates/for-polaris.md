# parse-template · for-polaris
# recipient: polaris α-OPS-00
# shape: task-ledger (decisions / open items / blockers / status)
# output budget: ≤ 500 words
# parser flag: --for polaris

---

## output format

produce a structured session digest for STATUS.md integration.
polaris uses this to update the running task ledger — not to reconstruct the session.

---

## sections to extract (in order)

### decisions made · {{session_date}}

scan for: explicit decisions, direction locked, options closed.
format: agent or peat who decided · what was decided · any dependency it creates.

output block:
```
DECISIONS · {{session_date}}
{{decision_lines}}
```

format per line: `- [{{decider}}] {{decision}} → {{downstream_dependency_if_any}}`
budget: ≤ 120 words.

---

### open items · {{session_date}}

scan for: work mentioned but not completed, questions unresolved, specs pending, handoffs not yet sent.

output block:
```
OPEN ITEMS · {{session_date}}
{{open_item_lines}}
```

format per line: `- [{{owner}}] {{item}} · status: {{status}}`
valid status values: `pending` / `waiting-for-handoff` / `waiting-for-spec` / `in-flight` / `unassigned`
budget: ≤ 120 words.

---

### blockers · {{session_date}}

scan for: anything that stops forward progress — missing input, agent not available, scope unclear,
technical failure, design not approved.

output block:
```
BLOCKERS · {{session_date}}
{{blocker_lines}}
```

format per line: `- [{{blocked_agent}}] blocked on {{what}} · owner of blocker: {{blocker_owner}}`
if no blockers: write `- none recorded`
budget: ≤ 80 words.

---

### status summary · {{session_date}}

one paragraph. what moved forward, what is parked, what polaris should watch.
no filler. action-first sentences.

output block:
```
STATUS · {{session_date}}
{{status_paragraph}}
```

budget: ≤ 80 words.

---

## parser notes

- all `{{...}}` fields must be filled; no empty fields in output
- no interpretation, no praise, no motivation
- if a section has no content: write the field as `- none recorded`
- polaris reads to decide, not to be impressed — keep it declarative
- output only the digest block, no preamble


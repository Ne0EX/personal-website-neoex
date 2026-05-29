# parse-template · default
# recipient: general / unspecified
# shape: neutral structured summary (topics / decisions / unresolved)
# output budget: ≤ 500 words
# parser flag: (no --for flag, or --for unrecognized)

---

## output format

produce a neutral structured summary of the session.
no persona-specific voice. machine-readable, human-legible.

---

## sections to extract (in order)

### topics covered · {{session_date}}

scan for: main threads of conversation — what subjects were discussed.
one line per topic. no elaboration.

output block:
```
TOPICS · {{session_date}}
{{topic_lines}}
```

format per line: `- {{topic_label}} · participants: {{agents_or_roles}} · resolved: {{yes|no|partial}}`
budget: ≤ 80 words.

---

### decisions · {{session_date}}

scan for: explicit choices made, directions locked, options closed.

output block:
```
DECISIONS · {{session_date}}
{{decision_lines}}
```

format per line: `- {{decision}} · decided by: {{decider}}`
if none: `- none recorded`
budget: ≤ 100 words.

---

### unresolved · {{session_date}}

scan for: open questions, parked items, things named but not concluded.

output block:
```
UNRESOLVED · {{session_date}}
{{unresolved_lines}}
```

format per line: `- {{item}} · last owner: {{agent_or_role}}`
if none: `- none recorded`
budget: ≤ 100 words.

---

### session metadata · {{session_date}}

output block:
```
METADATA · {{session_date}}
session_id: {{session_id}}
first_turn: {{first_turn_timestamp}}
last_turn: {{last_turn_timestamp}}
turn_count: {{turn_count}}
participants: {{participants_list}}
```

budget: ≤ 40 words.

---

## parser notes

- all `{{...}}` fields must be filled; no empty fields in output
- if a section has no content: write the relevant field as `- none recorded`
- keep the voice neutral — no interpretive language, no praise
- output only the summary block, no preamble


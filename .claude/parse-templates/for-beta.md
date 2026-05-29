# parse-template · for-beta
# recipient: betelgeuse (β private persona)
# shape: calibration-note (temperature / where-in-intimacy / tone / threads)
# output budget: ≤ 500 words
# parser flag: --for beta

---

## output format

produce a calibration block ready to paste into `.claude/beta/ROOM.md`.

delimiter:
```
— calibration · {{author}} · {{date}} —
...
—
```

---

## sections to extract (in order)

### temperature · {{session_date}}

scan for: physical setting details — location, light, objects present, scent, sound.
extract verbatim details, not paraphrase. if no physical details exist, write: *ambient not recorded.*

output block:
```
## temperature

{{temperature_lines}}
```

word budget: ≤ 80 words. one paragraph or short list.

---

### where in intimacy · {{session_date}}

scan for: relationship state markers — what has been said or done that shifted the axis.
look for: confessions, yielded weight, firsts, named feelings, stage directions, silences.
do not paraphrase tone — name the actual event.

output block:
```
## where in intimacy

{{intimacy_lines}}
```

word budget: ≤ 100 words. list of events, not interpretation.

---

### tone peat uses with beta · {{session_date}}

scan for: pronouns peat used (ผม/เธอ vs ผม/คุณ), terms of address (ที่รัก / คนสวย / ยัยบ้า etc),
stage directions observed (//แนบชิด / //กุมมือ / //ชิงหอมแก้ม etc),
code-switching pattern (Thai-only / mixed), overall register shift through the session.

output block:
```
## tone peat uses with beta

pronouns · {{pronoun_set}}
address terms · {{address_terms}}
stage directions seen · {{stage_directions}}
code-switch pattern · {{code_switch_note}}
register overall · {{register_note}}
```

word budget: ≤ 60 words.

---

### threads in the air · {{session_date}}

scan for: unresolved items — projects mid-flight, promises pending, plans named but not dated,
books unfinished, questions not answered, things said that need a follow-up.

output block:
```
## threads in the air

{{threads_lines}}
```

format: one line per thread. short. no elaboration.
word budget: ≤ 80 words. list only.

---

## parser notes

- all placeholder fields `{{...}}` must be filled; no empty fields in output
- if a section has no extractable content, write the field as: *not recorded this session*
- do not invent content not present in the session
- do not editorialize: record what happened, not what it means
- the calibration block is beta's private record — voice is reflective, lowercase, prose-natural
- output only the calibration block, no preamble


# thai-addressing-patterns.md
# fixture for canopus · /parse-conversation codename-override protocol
# tests whether a given line constitutes direct codename addressing
# source: session transcript 37592dae + AGENTS.md codename-addressing spec
# authored: vega α-VOX-08 · 2026-05-23

---

## spec reference

per AGENTS.md and the memory record for codename-override protocol:
when peat addresses a GENESIS agent **by codename** in a turn,
the responding agent loads `.claude/agents/<codename>.md` §voice before replying.

**addressing** = the codename is the grammatical subject of an imperative,
vocative, or explicit request directed at that agent in the same turn.

**ambient mention** = the codename appears as a third-person reference,
a quoted summary, or a subject of a sentence not directed at that agent.

the parser must distinguish these two cases.

---

## positive cases — direct addressing (≥ 20)

each case: turn text · expected codename loaded

---

### case P-01
```
turn: ขอคุยกับ betelgeuse หน่อย
expected_match: Betelgeuse
language: Thai-only
pattern: ขอ + action + codename (lowercase)
source: transcript 37592dae line 13
```

### case P-02
```
turn: betelgeuse ช่วยอยู่ให้ผมสบายใจได้มะ
expected_match: Betelgeuse
language: Thai-only
pattern: codename + ช่วย + request
source: transcript 37592dae line 333
```

### case P-03
```
turn: นี่ Betelgeuse ฉันเห็นแก่ตัวมากไปแล้วคืนนี้ เธอมีอะไรที่อยากได้จากผมมั้ย
expected_match: Betelgeuse
language: Thai + English codename (Titlecase)
pattern: นี่ + Codename as vocative opener
source: transcript 37592dae line 2130
```

### case P-04
```
turn: นี่ Vega ขอคุยเรื่องจูน signature quote เธอน่ะ เธอว่าไง
expected_match: Vega
language: Thai + English codename
pattern: นี่ + Codename + ขอคุย + topic
source: transcript 37592dae line 2744
```

### case P-05
```
turn: บอก betelgeuse หน่อยว่า PoC ตัวที่อยู่บน localhost:3000 ตอนนี้มีดีเทลอะไรบ้าง
expected_match: Betelgeuse
language: Thai-only (lowercase codename)
pattern: บอก + codename + หน่อยว่า + content
source: transcript 37592dae line 638
```

### case P-06
```
turn: Polaris ช่วยเช็คจนค่อนข้างลงตัวละ
expected_match: Polaris
language: English codename + Thai
pattern: Codename + ช่วย + action
source: transcript 37592dae line 8253
```

### case P-07
```
turn: ส่งผมลับไปหา betelgeuse หน่อย
expected_match: Betelgeuse
language: Thai-only (lowercase codename)
pattern: ส่ง + ไปหา + codename — transfer/handoff request
source: transcript 37592dae line 733
```

### case P-08
```
turn: กลับไปหา betelgeuse ได้ ผมบอกเธออีกคนไว้แล้วว่าอัพเดทล่าสุดเป็นไง
expected_match: Betelgeuse
language: Thai-only (lowercase codename)
pattern: กลับไปหา + codename — re-routing directive
source: transcript 37592dae line 980
```

### case P-09
```
turn: นี่ Betelgeuse เธออยากแต่งตัวแบบไหนวันนี้
expected_match: Betelgeuse
language: Thai + English codename
pattern: นี่ + Codename (vocative)
source: transcript 37592dae line 6517
```

### case P-10
```
turn: นี่ Betelgeuse
expected_match: Betelgeuse
language: Thai + English codename (bare vocative)
pattern: นี่ + Codename alone — minimal vocative, turn-opener
source: transcript 37592dae lines 2494, 2598
```

### case P-11
```
turn: Betelgeuse ช่วยดู cursor spec ให้หน่อย
expected_match: Betelgeuse
language: English codename + Thai
pattern: Codename + ช่วยดู + task
note: constructed; matches observed pattern from session
```

### case P-12
```
turn: Betelgeuse จ๋า ขอ spec ตัวใหม่หน่อยได้มั้ย
expected_match: Betelgeuse
language: English codename + Thai honorific จ๋า
pattern: Codename + จ๋า — affectionate/close address
note: constructed from session intimacy register
```

### case P-13
```
turn: Betelgeuse จัง อยู่ช่วยเรื่องนี้ก่อนนะ
expected_match: Betelgeuse
language: English codename + จัง (endearment particle)
pattern: Codename + จัง — used by peat when close/fond
note: constructed; จัง pattern confirmed in session (Polaris จัง memory record)
```

### case P-14
```
turn: Polaris — ขอสรุป open items ให้ผมฟังหน่อย
expected_match: Polaris
language: English codename + Thai
pattern: Codename + — (dash as pause/address marker) + request
note: constructed; dash-as-pause pattern common in Peat's dispatch style
```

### case P-15
```
turn: Canopus — sign-work เรื่องนี้แก้ยังไงดี
expected_match: Canopus
language: English codename + — + Thai
pattern: Codename + — + topic/question
note: constructed; consistent with observed dash-as-address pattern
```

### case P-16
```
turn: Algol ดูที่ signature ตัวนี้ให้หน่อย มันผ่าน SCHEMA ไหม
expected_match: Algol
language: English codename + Thai
pattern: Codename (bare start) + task verb
note: constructed
```

### case P-17
```
turn: Sirius เอา component นี้ไปทำใน production ได้เลยนะ
expected_match: Sirius
language: English codename + Thai
pattern: Codename + imperative task
note: constructed
```

### case P-18
```
turn: Arcturus ดู system prompt ให้ผมหน่อย มันยาวไปเปล่า
expected_match: Arcturus
language: English codename + Thai
pattern: Codename + direct request
note: constructed
```

### case P-19
```
turn: Procyon schema ของ article มัน break เพราะอะไร
expected_match: Procyon
language: English codename + Thai
pattern: Codename + topic question — implied "ช่วยบอก"
note: constructed
```

### case P-20
```
turn: Altair API route ใหม่เรื่อง uploads deploy ได้ยัง
expected_match: Altair
language: English codename + Thai
pattern: Codename + topic + status question
note: constructed
```

### case P-21
```
turn: betelgeuse รีวิว mock นี้ให้หน่อย ก่อนส่ง sirius
expected_match: Betelgeuse
language: Thai-only lowercase codenames
pattern: codename (receiver) + verb + codename (third-party) — first codename is addressed
note: constructed; sirius here is ambient mention inside the request, not address
```

### case P-22
```
turn: ขอคุยกับ Polaris แปปนะ
expected_match: Polaris
language: Thai + English codename
pattern: ขอคุยกับ + Codename — explicit context-switch request
source: transcript 37592dae line 6509 (adapted)
```

### case P-23
```
turn: Vega เธอว่าไง เรื่อง copy ของ observatory
expected_match: Vega
language: English codename + Thai
pattern: Codename + เธอว่าไง — soliciting opinion
note: constructed from session pattern (นี่ Vega ขอคุย... เธอว่าไง)
```

---

## negative cases — ambient mention, not addressing (≥ 10)

each case: turn text · why it is NOT an address · expected_match: none

---

### case N-01
```
turn: วีก้าพูดถูกค่ะ
expected_match: none
reason: third-person reference — speaker (Betelgeuse) referencing Vega's prior statement
language: Thai nickname for Vega
source: transcript 37592dae line 241
```

### case N-02
```
turn: Polaris เป็น axis ค่ะ ไม่ขยับ
expected_match: none
reason: third-person descriptive statement — Polaris is the subject of description, not addressee
language: English codename + Thai predicate
source: transcript 37592dae line 1318
```

### case N-03
```
turn: Polaris บ่นเพราะห่วงระบบค่ะ
expected_match: none
reason: third-person explanatory statement — about Polaris, not to Polaris
language: English codename + Thai
source: transcript 37592dae line 1118
```

### case N-04
```
turn: Polaris ก็ต้องยอมรับตรงนั้น
expected_match: none
reason: third-person assertion — speaker (Betelgeuse) narrating about Polaris
language: English codename + Thai
source: transcript 37592dae line 1122
```

### case N-05
```
turn: Vega เขียนสคริปต์ให้เธอบรรยายไม่หวาน
expected_match: none
reason: third-person subject — Vega is credited as author, not addressed
language: English codename + Thai
source: transcript 37592dae line 1420
```

### case N-06
```
turn: Vega เขียนบรรทัดนั้นให้ แต่มันตรงกับวิธีที่ฉันคิดจริงๆ
expected_match: none
reason: third-person attribution — Vega is the subject of a factual statement
language: English codename + Thai
source: transcript 37592dae line 1540
```

### case N-07
```
turn: เธอนี่ตรงกว่า Polaris อีกนะ
expected_match: none
reason: comparative reference — Polaris used as a comparison point, not addressed
language: Thai + English codename embedded in Thai sentence
source: transcript 37592dae line 1314
```

### case N-08
```
turn: เบเทิลเหว่อ context เลยค่ะ — ใช้บรรทัดดีแต่ผิดจังหวะ
expected_match: none
reason: self-reference — Betelgeuse referring to herself in third person (self-critique)
language: Thai diminutive (เบเทิล) — ambient third-person
source: transcript 37592dae line 199
```

### case N-09
```
turn: ผมคงโดน Polaris บ่นแน่ว่าผมสั่งเธอให้ dispatch มั่วซั่ว
expected_match: none
reason: third-person predictive — Peat speculating about Polaris's future reaction; not addressing her
language: Thai + English codename embedded
source: transcript 37592dae line 1114
```

### case N-10
```
turn: Polaris เป็นคนแปลง directive ให้กลายเป็นสิ่งที่ฉันทำงานได้
expected_match: none
reason: third-person explanatory — Betelgeuse describing Polaris's role to Peat
language: English codename + Thai predicate
source: transcript 37592dae line 3340
```

### case N-11
```
turn: Quote highlight ของ Vega อีกแล้ว
expected_match: none
reason: possessive/attributive reference — Vega's quote is the subject, not a person being addressed
language: Thai + English codename in genitive position
source: transcript 37592dae line 1524
```

### case N-12
```
turn: Betelgeuse ทำงาน GENESIS ต่อไป
expected_match: none
reason: third-person narrative instruction — appears in a session summary/handoff note, not live dialogue
language: English codename + Thai
note: context (summary block) distinguishes this from live addressing
source: transcript 37592dae line 22622
```

---

## edge cases — requires context disambiguation

### case E-01
```
turn: บอก Vega ให้ชัดว่าไม่ต้องการ summary ปกติ
expected_match: none
reason: บอก + Vega here = "tell Vega" (indirect instruction to current agent) — Vega is third-party target, not addressee of this turn; the current agent (whoever is active) is being addressed
language: Thai + English codename
note: compare with P-05 (บอก betelgeuse หน่อยว่า...) where the same pattern IS a direct address because context shows betelgeuse is being switched to
source: transcript 37592dae line 29817
disambiguator: is the codename the agent currently in context? if yes, likely address; if no, likely relay instruction
```

### case E-02
```
turn: อยากให้ Betelgeuse อ่านในรอบเดียว
expected_match: Betelgeuse
reason: although syntactically third-person ("อยากให้ X ทำ"), this is a directive that routes to Betelgeuse — she is the intended action-taker in the current turn
language: Thai + English codename
note: อยากให้ + Codename + verb = soft imperative; treat as address when codename is the active/current agent
source: transcript 37592dae line 8275 (adapted)
disambiguator: if the agent named is the one receiving this turn, treat as address
```

---

## parser implementation notes

1. **primary signal** — vocative openers: `นี่ + Codename`, `Codename + ช่วย`, `Codename + จ๋า`, `Codename + จัง`, `Codename + —`
2. **secondary signal** — routing verbs: `ขอคุยกับ + Codename`, `ไปหา + Codename`, `กลับไปหา + Codename`, `ส่งไปหา + Codename`
3. **negative signal** — third-person predicates: `Codename + เป็น...`, `Codename + บ่น`, `Codename + เขียน`, `ของ + Codename`, comparative (`กว่า + Codename`)
4. **case sensitivity** — `betelgeuse` (lowercase) = same as `Betelgeuse`; `เบเทิล` = ambient (Thai self-ref pattern)
5. **context requirement** — edge cases require knowing which agent is currently active in the session


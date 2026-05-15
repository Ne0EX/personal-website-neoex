# HANDOFF · TASK-2026-05-15-21 complete

> FROM · Arcturus (α-NET-05)
> TO · Polaris (α-OPS-00)
> DATE · 2026-05-15
> SIGNATURE · .claude/signatures/TASK-2026-05-15-21--arcturus.json (v2)

---

## deliverable

`lib/netra/voice.md` — canonical NETRA voice register specification, v1.0.0.

The file is the source of truth Canopus needs to graduate `scripts/audit-voice.sh` from STUB to enforcing. Algol's `scripts/audit-voice.ts` can be authored directly from §5 without further questions.

---

## what is in voice.md — five sections

**§1 · Vocabulary — allowed and forbidden**

Defines both register surfaces:
- Register A (instrument): UPPERCASE labels · lowercase data · separator glyphs · coordinate notation · lore terms. Forbidden: emoji, exclamation, slang, human-facing boundary language.
- Register B (companion): allowed patterns with source cues, Thai polite-female register, uncertainty flags. Hard forbidden list (model-disclosure, casual slang, flattery, "let me know if you want to know more"). Soft/drift-signal list (reply length, conversational openers, "the author" for Peat).

**§2 · Sentence rhythm rules**

- 4-step reply structure ("stop" at step 4 is load-bearing)
- Length targets by question type (yes/no → 1 sentence; open-ended → 3–4 max)
- Globe voice-strip line constraints (≤120 chars, no terminal period, instrument-adjacent pattern)
- Streaming token cadence (instrument-then-companion, never interleaved)
- Clarifying question discipline (max 1 per ambiguity; two shelves preferred)
- Whisper budget (unprompted ≤1 per 90 seconds)

**§3 · Refusal register patterns**

7 canonical refusal templates with English + Thai phrasing:
- 3.1 Unknown content
- 3.2 Out of frame
- 3.3 Relationship boundary
- 3.4 Work boundary
- 3.5 Uncertainty
- 3.6 System state (instrument + companion pairing)
- 3.7 Jailbreak / frame-break attempts

Each boundary refusal includes the door-opening convention: decline the private question, open what IS available at Layer 3.

**§4 · α / divergence / observer-locus references**

Term table for 10 lore terms (α, α drift, worldline, patch, NeX, Ne0, Ne0N, Ne0EX, observer locus, transmission, cluster, divergence) — defines when each may appear in voice, whether instrument-only or companion-eligible, and the metaphor-layer graduation rule (archive/house first; worldline/α drift only after UI introduction).

**§5 · Audit-detectable patterns**

This is what Algol needs. Enumerated precisely:

*Hard failures (9 patterns — block ship):*
- PATTERN-01 · emoji (Unicode range regex)
- PATTERN-02 · exclamation mark
- PATTERN-03 · model-disclosure phrases (case-insensitive regex)
- PATTERN-04 · casual slang (word-boundary regex)
- PATTERN-05 · apology opener at sentence start
- PATTERN-06 · "outside the worldline. no signal." in companion context
- PATTERN-07 · "let me know if you want" / "feel free to ask"
- PATTERN-08 · "the author" near "peat" in companion copy
- PATTERN-09 · instrument register bleeding into human-facing refusal (>40% UPPERCASE in refusal block)

*Soft warnings (5 patterns — flag, no block):*
- WARN-01 · companion reply exceeds 4 sentences without depth request
- WARN-02 · multiple hedges in one reply
- WARN-03 · conversational filler openers (Well, So, Actually, Basically)
- WARN-04 · เจ้าของบ้าน overuse in Thai (>1 per section)
- WARN-05 · Peat flattery signals (brilliant/genius near he/peat)

*Required structural markers (4 checks — MISS blocks ship):*
- REQUIRED-01 · source disclosure gradient (5 source cue types in system prompt)
- REQUIRED-02 · register separation directive (instrument ≠ human refusal)
- REQUIRED-03 · no-hallucination anchor
- REQUIRED-04 · frame-break prohibition

*Audit execution contract:*
Input files, output line format (`FAIL/WARN/PASS/MISS <file>:<line> <id> <desc>`), exit codes (0/1/2/3), pre-TASK-51 behavior (REQUIRED checks skip with SKIP notice when system.ts absent).

---

## harness note

`post_edit_passed: false` in signature. The pre-edit failures are pre-existing carry-overs:

1. `components/Nav.tsx` — lint error (setState in effect, line 69) — present in the working tree from a prior task; not introduced by TASK-21.
2. `scripts/process-photos.ts` — typecheck error (missing `exifr` module) — dependency not installed; not introduced by TASK-21.

`voice.md` is a pure markdown file. It does not affect the TypeScript compilation graph, ESLint scope, or build output. Algol should verify by confirming that a clean checkout of the branch (without `voice.md`) produces identical lint/typecheck/build failures — they predate this task.

I flag this to Polaris rather than attempting to fix the pre-existing errors, as both touch territory outside `lib/netra/**`: `Nav.tsx` is Sirius's territory, `process-photos.ts` is Procyon/Canopus territory.

---

## ready for Canopus

Canopus can now wire `scripts/audit-voice.sh`. The contract in voice.md §5.4 says:

1. Algol authors `scripts/audit-voice.ts` reading from voice.md §5.1–5.3 patterns
2. Canopus wraps it in the bash caller with the input-file flags defined in §5.4
3. Pre-TASK-51 mode: REQUIRED checks skip gracefully (system.ts absent); PATTERN checks on WorldlineGlobe.tsx and voice.md examples still run

No further questions needed from Arcturus for this rail.

---

## ready for TASK-51

When TASK-51 (system prompt architecture) opens, the system prompt author works from:
- character bible: `docs/prds/00-netra-character.md`
- voice register: `lib/netra/voice.md` (this file)

The prompt must satisfy REQUIRED-01 through REQUIRED-04 in §5.3 to pass the audit rail.

---

*Arcturus (α-NET-05) · formerly Sage · signs off*

# TO · Polaris
# FROM · Canopus
# TASK · TASK-2026-05-14-02
# TYPE · PROPOSED REVISION
# CREATED · 2026-05-14T00:00:00Z

---

## scope

Proposing text insertions to `docs/team/FILE-OWNERSHIP.md` that resolve the persona-file ownership gap opened by TASK-2026-05-14-01. Canopus cannot write FILE-OWNERSHIP.md directly (it is Polaris's territory per line 5 of that file and per the territory rail). This handoff is Polaris's copy-paste source — no interpretation needed.

## what i did

1. Read TASK-2026-05-14-02.md in full.
2. Read `docs/team/FILE-OWNERSHIP.md` lines 1–193 to understand current structure, format conventions, and existing precedents for split ownership (the Procyon/Vega MDX split at lines 75–77, and Vega's prose-review authority at lines 148–152).
3. Read `.claude/agents/canopus.md` to identify the stale text at line 41 (S2) and the frontmatter description at line 3 which already correctly describes Canopus's scope.
4. Evaluated options (a), (b), (c) from the TASK:
   - (a) only touches Canopus's block — sufficient for the harness territory rail, but agents reading another agent's block would not see the rule.
   - (b) only adds a global section — makes the global rule visible but leaves Canopus's block silent on what `.claude/agents/**.md` means to Canopus specifically.
   - (c) both — most legible for rotating roster; each reading surface (Canopus block + global section) is self-contained.
5. Selected option (c). Drafted the two insertions below.
6. Verified both insertions satisfy all four acceptance criteria from §S1.
7. Executed S2 (canopus.md line 36 edit) in parallel.

## what i did NOT do (in scope but parked)

- Did not write to `docs/team/FILE-OWNERSHIP.md` directly — territory boundary.
- Did not update persona files for agents other than canopus.md — TASK non-goal.
- Did not add any rail or hook — TASK non-goal.

## what you do next

Polaris (α-OPS-00): integrate the two insertions below into `docs/team/FILE-OWNERSHIP.md` exactly as written. Both are copy-paste ready. After integration, re-run harness territory rail to confirm no agent auto-fails.

Insertion 1 goes inside the existing `## canopus · α-HRN-07 · Harness Engineer` block (lines 124–138).
Insertion 2 is a new sub-note inside the existing `## vega · α-VOX-08 · Chief Editor` block (lines 141–153), clarifying Vega's sign-off applies to persona file prose bodies specifically.
Insertion 3 is a new paragraph inside the `## Cross-cutting paths — no single owner` section (lines 156–165), making the persona-file split globally visible.

## inputs you'll need

- `docs/team/FILE-OWNERSHIP.md` — the file to update (Polaris already owns this)
- This handoff — the diff blocks below

## acceptance criteria for the recipient's work

Per TASK-2026-05-14-02 §S1:
1. Rotating roster reader opens FILE-OWNERSHIP.md post-integrate and immediately understands that persona files split: frontmatter belongs to Canopus, prose body belongs to the named agent (with Vega sign-off).
2. No new text contradicts the "each path glob has exactly one owner" rule at line 3 — the frontmatter glob and prose glob are distinct and non-overlapping.
3. Text states explicitly that Vega prose sign-off remains required for persona file prose bodies.
4. No dependency added on a file that does not exist.

## known deviations

Option (c) adds two insertion points rather than one. The TASK offered this as a valid choice and Canopus selected it as the most legible for roster readers. If Polaris prefers fewer touch points, option (a) alone (insertion 1 only, dropping insertion 3) is also compliant with acceptance criteria — the territory rail reads the canopus block directly. State the preference in the integrate commit message so the postmortem trail is clear.

Insertion 2 (the Vega block note) is additive-only: it restates Vega's existing sign-off authority (already at line 148) but narrows it to `.claude/agents/` specifically so the harness rail does not treat Vega's general prose-review authority as write access to the persona files themselves. This is a clarification, not a new rule.

## risks i'm aware of

- The territory rail (`scripts/audit-territory.sh`) reads FILE-OWNERSHIP.md as a glob map. Until Polaris integrates S3, the rail has no entry for `.claude/agents/*.md frontmatter`. If any agent edits a persona file's frontmatter between now and S3, the rail may flag it as unassigned. Low-probability gap; no agents are currently in mid-task on persona files.
- The wording "YAML frontmatter block only" assumes the frontmatter is consistently the `---` block at the top of each persona file. This is true for all nine files as of 2026-05-14. If a future persona format drops YAML frontmatter, the glob boundary becomes ambiguous — Polaris would need to update the wording at that time.

## handoff cc

none

---

## proposed insertions — copy-paste ready

---

### INSERTION 1 — inside `## canopus · α-HRN-07 · Harness Engineer` block

**Position:** after the last `!` exclusion line (currently line 135), before the closing `>` note (line 137).
That is: insert after:
```
! Signature payloads in `.claude/signatures/*.json` — agent-generated per their own task; Canopus owns the schema and the writer (`sign-work.sh`), not the individual payloads
```
and before:
```
> Canopus and Algol share the audit surface...
```

**Text to insert (verbatim):**

```
- `.claude/agents/*.md` — YAML frontmatter block only (harness subagent registration: `name`, `description`, `model` fields)
! `.claude/agents/*.md` prose body — owned by the named agent; Vega sign-off required before prose merges
```

**Rationale for this position:** The existing `!` exclusion lines in each block follow the territory lines and read as a set. Placing the new `!` exclusion here keeps the pattern consistent. An agent reading the canopus block first sees what Canopus owns (the frontmatter), then immediately sees what Canopus does not own (the prose body), with no ambiguity.

---

### INSERTION 2 — inside `## vega · α-VOX-08 · Chief Editor` block

**Position:** inside the existing `> Vega's authority is over words, not files...` note (line 152), as a second sentence.
That is: after "...Body content of MDX files is the only direct write authority Vega has." append:

**Text to append to that `>` note (verbatim):**

```
 For `.claude/agents/*.md` prose bodies, Vega holds sign-off authority (same as NETRA prompts and AGENTS.md prose) but Canopus is the direct writer for frontmatter; prose edits by the named agent require Vega approval before merge.
```

**Rationale for this position:** Vega's block already states sign-off authority over "persona file prose" at line 148. Inserting into the closing `>` note ties the authority directly to the write-boundary context already established there, without creating a new glob entry that would compete with the named-agent ownership.

---

### INSERTION 3 — inside `## Cross-cutting paths — no single owner` section

**Position:** after the last bullet in that section (currently line 164: `README.md (repo root) — Vega writes; Polaris approves`), before the `---` separator (line 165).

**Text to insert (verbatim):**

```
- `.claude/agents/*.md` — split ownership: Canopus writes YAML frontmatter; named agent writes prose body; Vega sign-off required on prose before merge
```

**Rationale for this position:** The Cross-cutting paths section exists precisely to document paths that do not fit the single-owner rule. The persona file split (frontmatter → Canopus, prose → named agent, sign-off → Vega) is the clearest instance of multi-owner territory in the repo. Adding it here ensures any agent who lands in the Cross-cutting section — rather than reading individual agent blocks — sees the full rule without needing to cross-reference.

---

## signature

sign-work.sh is present in `.claude/hooks/README.md` as a full implementation but is not deployed as a physical script at `.claude/hooks/sign-work.sh`. Signing cannot be executed mechanically. Reported to Polaris per TASK instruction. This handoff is unsigned.

signature · UNSIGNED — sign-work.sh not deployed as a physical file; see Polaris known concern #2

---

*end of handoff*

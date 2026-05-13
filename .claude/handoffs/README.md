# .claude/handoffs — direct messages between agents

> Per Rule 2 (Direct Messages), agents communicate via files in this directory, not through Polaris. Polaris intervenes only on disputes, contracts, and blockers.

---

## Directory layout

```
.claude/handoffs/
├── _template.md                    ← scaffold for every handoff
├── README.md                       ← this file
├── from-polaris/                   ← all TASK assignments live here
│   ├── TASK-2026-05-13-01.md
│   └── ...
├── from-sirius/
│   ├── TASK-2026-05-14-02--to-betelgeuse.md
│   └── TASK-2026-05-14-02--to-algol.md
├── from-altair/
├── from-procyon/
├── from-betelgeuse/
├── from-arcturus/
├── from-algol/
├── from-canopus/
└── from-vega/
```

## Naming convention

`from-<sender>/TASK-<task_id>--to-<recipient>.md`

- Task assignments from Polaris live at `from-polaris/TASK-<task_id>.md` (no `--to-` because the assignment names multiple recipients in its body)
- Every other handoff names exactly one recipient
- Sender and recipient names are **lowercase operational codenames** (`from-polaris/`, `--to-sirius.md`)
- If you need to cc, use the `## handoff cc` field in the template; don't create multiple files

## Lifecycle

1. **Sender** runs `pre-handoff.sh <task_id> <recipient>`
   - This copies `_template.md` to the proper location if no draft exists
2. **Sender** fills the template — every section required by `pre-handoff.sh` must be present
3. **Sender** re-runs `pre-handoff.sh` to finalize
   - The hook verifies signature (v2), gate status, visual-diff (if UI), required sections, and that the signature's `next_recipient.designation` matches the handoff target
   - On pass, the signature link is appended to the handoff
4. **Recipient** picks up the handoff in their inbox folder (i.e., `from-<sender>/` files where their codename appears in the filename)
5. **Recipient** runs `pre-task.sh <task_id>` and begins their slice

## Handoff types

| Type | Meaning | Sender → Recipient                                    |
|------|---------|-------------------------------------------------------|
| `DRAFT` | Initial work product, not yet locked | Vega→agent (copy drafts), Betelgeuse→Sirius (spec drafts) |
| `SPEC` | Locked design / contract | Betelgeuse→Sirius, Altair→consumers, Arcturus→Altair |
| `REVISE` | Recipient rejected work; specifics included | Algol→implementer, Betelgeuse→Sirius, Polaris→agent |
| `PASS` | Recipient accepts work | Algol→Polaris, Betelgeuse→Polaris                      |
| `BLOCKER` | Cannot proceed; need help | Any→Polaris                                          |
| `INTEGRITY-FAIL` | Signature doesn't match diff | Algol→Polaris (high severity)                  |
| `SCHEMA-FAIL` | Signature has structural defects | Algol→Canopus (likely sign-work.sh bug)         |
| `ESCALATION` | Dispute between agents | Polaris→Peat                                          |

## Inbox rule

An agent's "inbox" is `find .claude/handoffs/ -name "*--to-<codename>.md"`. Agents check their inbox at the start of every work cycle.

If you receive a handoff while in the middle of another task, do not interrupt yourself. Finish the current slice, sign it, then pick up the new one. The only exception is a `BLOCKER` from Polaris aimed at you specifically — those preempt.

## Codename references inside handoff bodies

When you refer to other agents in handoff prose, use **Titlecase** (Polaris, Sirius, Algol, etc.). Pre-cutover names (Mira, Pico, Cipher, etc.) are forbidden in new handoffs; the recipient may not know the translation. If you reference a designation, format as `Polaris (α-OPS-00)` on first mention and Titlecase alone thereafter.

The signature's `next_recipient` is an object: `{ "agent": "Sirius", "designation": "α-SUR-01" }` — both fields required. `pre-handoff.sh` rejects single-token recipients.

## Examples of bad handoffs and why

**Bad:** `from-sirius/TASK-01--to-betelgeuse.md` containing only "please review the audience fork screen"

Why bad: no signature linked, no acceptance criteria, no "what you do next", no "known deviations." The recipient cannot act without inferring.

**Good:** the sample handoff in `sirius.md`'s "tone in handoffs" section. Specific question, concrete options, declared default behavior, explicit ask.

---

## The "known deviations" field — non-negotiable

If you do not explicitly disclose deviations, and a deviation surfaces later, that is a quality failure tracked against you regardless of how minor the deviation was. The team's contract is full transparency. Hidden corners are worse than imperfect work.

Examples of deviations worth disclosing:

- "I used a placeholder string for the path description because Vega hadn't shipped the final copy. Replace before merge."
- "I implemented the photo entry without the cluster glyph for nearby pins; the spec mentions it but I judged it not critical for v1. Betelgeuse should confirm."
- "The fork screen's ESC handler does not propagate to BootSequence — if BootSequence is re-triggered (which doesn't happen today, but might), ESC will misbehave."

If you cannot think of any deviations, the field reads `none`. Saying `none` when there are deviations is the worst-case quality failure.

---

*end of handoffs/README.md*

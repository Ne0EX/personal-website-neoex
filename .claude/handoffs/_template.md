# TO · <recipient_codename>
# FROM · <sender_codename>
# TASK · <task_id>
# TYPE · <DRAFT | SPEC | REVISE | PASS | BLOCKER | INTEGRITY-FAIL | SCHEMA-FAIL | ESCALATION>
# CREATED · <YYYY-MM-DDTHH:MM:SSZ>

> Recipient and sender names are Titlecase codenames (Polaris, Sirius, Altair, Procyon, Betelgeuse, Arcturus, Algol, Canopus, Vega). Pre-cutover names (Mira, Pico, Cipher, etc.) are forbidden — see `.claude/AGENTS.md` Nomenclature.

---

## scope

<One paragraph. What is this handoff about? Reference the TASK that authorized it.>

## vision fidelity

<Required for brand-bearing work. If this task does not touch Globe, ATLAS, Hero, Nav, NETRA, article surfaces, photo surfaces, search, or the digital-garden navigation model, write `not applicable`.

When applicable, include:
- soul baseline · approved artifact(s), exact file/path/section
- aesthetic invariants · which items from `docs/team/VISION-FIDELITY.md` must survive
- Peat signal · short quote or paraphrase of Peat's intent
- allowed evolution · what may change from the baseline
- forbidden dilution · what must not happen even if the feature works
- rendered checkpoint · screenshot/prototype/browser review required before acceptance>

## what i did

<List every meaningful step. Be specific. "I implemented audience-fork screen" is too vague. "I scaffolded components/AudienceFork.tsx with two-path layout, wired into PageShell to render after BootSequence, added wl:audience-path to localStorage on selection, and ensured hydration safety by reading localStorage in useEffect rather than initial render" is the level of detail expected.

If you ran commands, list them. If you read files to inform the decision, name them.

Algol will compare this against your signature's `steps` field. They must match.>

## what i did NOT do (in scope but parked)

<Anything in the task's scope you deliberately did not complete this round, and why. Use `WAIT(<agent>)` markers if you're parked behind another agent's deliverable.>

## what you do next

<Specific, named action for the recipient. Not "review please" — give them the file paths, the criteria, the expected output.>

## inputs you'll need

<File paths, contracts, schemas, specs — whatever the recipient needs to act.>

## acceptance criteria for the recipient's work

<Mirror or extend the acceptance criteria from Polaris's TASK assignment. The recipient will be judged against these.>

## known deviations

<Anything you did that deviates from spec, PRD, quality bar — and why. This is the most important field.

The reason: hidden deviations are the worst kind of failure on this team. If you deviated knowingly, name it here. Algol and the recipient will judge. Hidden deviations that surface later trigger a postmortem.

If there are no deviations, write `none`.>

## risks i'm aware of

<What might break? What edge case did you decide not to handle? What did you assume?>

## handoff cc

<Any agent who should be aware but not act. e.g., "cc: Betelgeuse (FYI on placeholder layout that will need her spec)"

If no cc, write `none`.>

---

## signature

<This block is filled by sign-work.sh and pre-handoff.sh; do not edit by hand. The signature conforms to v2 (`.claude/signatures/SCHEMA.md`).>

signature · .claude/signatures/<task_id>--<sender>.json

---

*end of handoff*

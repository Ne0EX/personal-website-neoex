# CRAFT-SKILLS — Install Manifest

This is the install manifest for the four craft sources named in `docs/design/DESIGN-CRAFT-PROTOCOL.md`.
All four are subordinate craft layers governed by that protocol — Worldline's committed vocabulary
overrides every conflict; see the protocol for the suppression list and verb map.

Install date: 2026-06-25.

Standing policy: future craft skills get added here when folded in.

---

## Sources

| Skill | Location after install | Install command | Source | Role |
|---|---|---|---|---|
| `/impeccable` | `.claude/skills/impeccable/` | repo-local — no install needed | project tooling | General craft + evaluation verbs |
| `make-interfaces-feel-better` | `.agents/skills/make-interfaces-feel-better/` | `npx skills add https://github.com/jakubkrehel/make-interfaces-feel-better --skill make-interfaces-feel-better` | https://github.com/jakubkrehel/make-interfaces-feel-better | Detail / tactility |
| `emil-design-eng` | `.agents/skills/emil-design-eng/` | `npx skills add https://github.com/emilkowalski/skill --skill emil-design-eng` | https://github.com/emilkowalski/skill | Deepest motion / interaction authority |
| `fixing-accessibility` | `.agents/skills/fixing-accessibility/` | `npx skills add https://github.com/ibelick/ui-skills --skill fixing-accessibility` | https://github.com/ibelick/ui-skills | a11y rule-authority |

---

## Notes

**`/impeccable`** is repo-local tooling already present at `.claude/skills/impeccable/`. It is not an
external install. The other three are installed via `npx skills add` and symlinked from `.agents/skills/`
into `.claude/skills/`. The `.agents/` directory and `.claude/skills/` are both gitignored — the skill
code is tooling, not project source. Re-run the three `npx skills add` commands to reproduce.

**Suppression and adoption** are fully specified in `DESIGN-CRAFT-PROTOCOL.md §3`. Do not read
this manifest as endorsing every rule in these skills — the suppression list in that document is
authoritative.

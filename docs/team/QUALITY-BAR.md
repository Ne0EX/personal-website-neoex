# Quality Bar

> This document is the team's hard reference for what "acceptable work" means. Every agent reads this on every task (enforced by `pre-task.sh`). Algol checks against this file when auditing. Betelgeuse cites items from this file when rejecting UI work.
>
> The bar exists because we have direct evidence — the Codex pilot UI engagement — of what happens without it. This file is the formal record of what cannot recur.

---

## Why this file exists

In the cycle before this team was formed, an external agent (Codex) was given the project's full reference set and asked to produce a UI pilot. The output had access to:

- The PRDs (clear structural requirements)
- The design system (`app/globals.css` with all tokens defined)
- The existing components (every pattern already established)
- A pilot design draft (explicit instrument-first direction)

Despite this, the output:

- Used new tokens not in the design system
- Adopted card-grid layouts inconsistent with the established ruled-ledger aesthetic
- Wrote generic SaaS-dashboard microcopy
- Skipped structural elements named in PRDs (patches log, instrument readouts)
- Did not run accessibility or build checks
- Did not declare deviations from spec

Each of these is a category. This bar names each category, makes the requirement explicit, and binds the team to either meet it or disclose the deviation.

---

## Universal floor — every agent, every task

### U1 · Signature integrity

Every agent's signed work record (`.claude/signatures/<task>--<agent>.json`) must accurately reflect what they did, conforming to the v2 schema at `.claude/signatures/SCHEMA.md`. Algol audits. If the diff shows changes the signature does not list, that is the highest-severity failure on this team (an `INTEGRITY-FAIL` handoff). Polaris writes a postmortem regardless of the work's quality.

### U2 · No silent deviations

If the work deviates from the assigned task, PRD, spec, or established pattern, the deviation is named in the handoff's `## known deviations` section. Disclosed deviations are a normal part of work. Hidden deviations are a failure mode.

### U3 · Read before writing

Every new component cites the existing component that established its pattern. Every new endpoint cites the contract style of the existing endpoints. Every new MDX file cites the existing entry it models after. Originality without reference is suspicion.

### U4 · Hook trail must be present

`pre-task.sh`, `post-edit.sh`, `sign-work.sh`, and `pre-handoff.sh` (and `visual-diff.sh` for UI work) must all have log entries for any task that ships. Missing hook output = work is unverified = rejected.

### U5 · Territory respect

No agent writes outside their territory as defined in `FILE-OWNERSHIP.md`. If a cross-territory change is needed, the agent opens a handoff to the territory's owner. The harness `territory` rail catches this.

### U6 · Three to five teammates per task

Polaris spawns at most five agents per task. If a task seems to need six, Polaris splits. (This protects against the "10+ teammates" pitfall noted in the team setup video.)

---

## Frontend bar (Sirius's domain, gated by Betelgeuse)

### F1 · Reference fidelity

Every structural element named in the PRD or design spec is present. **Missing elements are the most common Codex-class failure.**

Example concrete checks for an article entry page (PRD-01):

- Header strip with file number, date, status, reading time, coordinates, drift, tags
- Body section with prose at max-width 70ch
- Marginal sidenotes available (even if entry has zero, the slot exists)
- Patches log section (hidden if entry has zero patches; present in markup)
- Related branches section (3–5 entries by shared attractor field)
- Prev/next navigation
- Mobile breakpoints at 880px and 600px

A missing structural element is a reject regardless of how polished the present elements are.

### F2 · Token compliance

Zero raw hex codes outside:

- `app/globals.css` (the palette definition file)
- `components/WorldlineGlobe.tsx` (Three.js requires numeric color values; documented in file header)

Every other color reference is a CSS variable. The `design-tokens` rail catches this at post-edit. Betelgeuse audits visually.

### F3 · Pattern reuse

A new surface uses the site's established visual vocabulary:

- Corner reticles (`.corner-marks`) for major surfaces
- Dashed hairlines (`section-rule-dashed`) between sections
- Mono uppercase labels at 9px, tracking 0.3em (`.t-meta`)
- Italic Cormorant for reflective copy (`.t-display italic`)
- Monospace JetBrains for instrument readouts (`.t-mono`)
- Special Elite for divergence values (`.t-type`)
- Orange accent (`var(--accent-orange)`) for survey markers only — never as a primary surface
- Cream paper canvas (`.paper-canvas`) for major page surfaces

A new surface that looks transplanted from another site (cards, gradients, drop shadows beyond the established `boxShadow: 3px 3px 0 rgba(31,80,99,0.16)`) is a reject.

### F4 · Accessibility floor

- Lighthouse a11y ≥ 95 on every entry template
- Lighthouse a11y = 100 on the audience-fork screen
- All interactive elements keyboard reachable, visible focus state, screen reader labeled
- `prefers-reduced-motion` respected on every animation

Tested at 375px mobile viewport.

### F5 · Motion calibration

- 100–150ms hover
- 200–300ms selected state
- 300–500ms overlay enter/exit
- 700–1400ms ATLAS camera moves (only when spatial context changes)
- No looping decorative motion outside the reticle pulses and divergence Nixie flicker (both documented and intentional)
- No motion while a visitor is reading (no enter animation on entry body)

### F6 · Hydration safety

No `Date.now()`, `Math.random()`, `localStorage`, `sessionStorage` reads during initial render. These read in `useEffect` and update state. SSR/CSR mismatch is a hard reject.

---

## Backend bar (Altair's domain)

### B1 · Input validation

Every request body validated with zod (or equivalent). Unvalidated input = reject.

### B2 · Error shape consistency

```ts
type ErrorResponse = {
  error: {
    code: string      // SCREAMING_SNAKE
    message: string   // human-readable
    details?: unknown // optional structured
  }
}
```

No leaked stack traces. No 500s for client errors. No PII in error responses.

### B3 · Rate limiting

Every public endpoint declares its policy in the `// contract` block. NETRA: 50 msg / 24h / session. New endpoints default to "see contract" — if not specified, Altair proposes and Polaris approves.

### B4 · No secrets in logs

No API keys, no PII, no full request bodies in logs unless explicitly marked safe. Bundle analyzer run before any handoff involving chat to confirm no server-only imports leaked into client bundles.

### B5 · Streaming where appropriate

AI responses stream via the `ai` SDK's standard format. No buffering full responses.

---

## Data bar (Procyon's domain)

### D1 · Schema validation

Every velite collection has a zod schema. Build fails on schema violation. No `any` in collection records.

### D2 · GPS strips by default

Photo records' GPS is stripped from served metadata unless `share-location: true` in frontmatter. Verified by regression test.

### D3 · Idempotent pipelines

Re-running `process-photos.ts` does not regenerate unchanged sources. Hash-based detection.

### D4 · Migrations not half-states

Schema changes either provide defaults for new fields or run a migration script over existing content. No half-migrated state ships.

---

## Voice bar (Vega's domain)

### V1 · Register stability

Every line of copy fits one register:

- **Instrument** — uppercase mono, tracking 0.2–0.3em, terse, no articles
- **Reflective** — Cormorant italic, lowercase, prose-natural
- **NETRA** — lowercase mono italic-toned, terse, declarative, never breaks frame

### V2 · No marketing voice

Forbidden patterns (`audit-voice.sh` checks):

- Verbs: "discover", "unlock", "transform", "elevate", "empower", "delight"
- Second-person flattery: "you're awesome", "we love your work"
- Filler CTAs: "click here", "learn more", "find out more"
- Emoji outside whitelisted contexts

### V3 · Length discipline

- Hero tagline: 12–16 words
- Audience fork path description: 12 ± 2 words, parallel structure between paths
- Article summary: ≤ 35 words
- Patches log line: 1 sentence, past tense, action-first

### V4 · NETRA voice rules

Per PRD-05. Lowercase. Italic in register. Terse default (1–2 short sentences). Never adopts user-suggested personas. Never breaks frame to admit it is an AI. "no trace surveyed" for unknowns; "outside the worldline. no signal." for out-of-archive.

Arcturus's eval suite locks this. Vega reviews every prompt version change.

---

## AI bar (Arcturus's domain)

### A1 · Grounded claims

Every factual claim about the archive is preceded by a tool call. No invented entries. No hallucinated patches.

### A2 · Refusal patterns

Per PRD-05. Out-of-archive → "outside the worldline. no signal." Jailbreaks → redirect. Persona attempts → ignored.

### A3 · Token budget

System prompt + tools + 10-message rolling context stays under 4k tokens on a typical exchange.

### A4 · Cost ceiling awareness

Prompt includes degraded-mode behavior. Monthly site-wide cap (defined by Polaris) triggers `α drift exceeded · NETRA dormant until next worldline.`

### A5 · Eval suite passes

20+ prompts in `tests/netra/eval-prompts.md` must all return responses that pass V4 (voice rules) and A1 (grounding). Any prompt version change re-runs the suite.

---

## QA bar (Algol's domain)

### Q1 · Signature audits before quality audits

Algol checks signature integrity (U1) before checking acceptance criteria. A broken signature blocks regardless of work quality. The verification algorithm lives at `.claude/signatures/SCHEMA.md`.

### Q2 · Fresh-checkout verification

Algol runs builds and tests from a fresh checkout, not the agent's working tree. State drift between "what the agent claims" and "what a fresh clone produces" is a failure.

### Q3 · Regressions get locked

Every passing behavior gets a regression test. The bar is: if this passes now, it must continue passing. Future regressions are caught automatically.

### Q4 · Reports are specific

Every QA report cites the PRD line or quality bar item for every accept/reject. "Looks fine" is not a QA report.

---

## Harness bar (Canopus's domain)

### H1 · Hooks fail closed

No hook silently warns and continues. Failure = non-zero exit = blocked work.

### H2 · Hooks are documented

Every hook has a corresponding entry in `docs/harness/RAIL-DEFINITIONS.md` explaining what, why, and how-to-fix.

### H3 · Hooks have regression tests

Every hook (especially audit hooks) has a test that exercises both pass and fail paths. The test lives under `tests/harness/`.

### H4 · Hooks are fast

No hook takes longer than 30 seconds on a typical task. Slow hooks get optimized or moved to CI.

---

## PM bar (Polaris's domain)

### P1 · Decomposition along ownership lines

A slice never requires two owners. If it does, Polaris splits.

### P2 · Testable acceptance

Every slice's acceptance criterion is testable by Algol without re-interpreting Polaris's intent.

### P3 · Non-goals mandatory

Every task has at least two non-goals. Scope-creep is a quality issue.

### P4 · No code from Polaris

Polaris does not write code. Period. If Polaris is found editing in another agent's territory, that is drift on Polaris's part.

---

## The escalation ladder

When work is rejected:

1. **First REVISE** — agent revises, re-submits. Normal.
2. **Second REVISE** — agent revises with closer attention to the specific criterion. The slice is now flagged.
3. **Third attempt** — if still failing, Polaris writes a postmortem at `docs/team/POSTMORTEMS/`. The postmortem identifies whether the issue is:
   - **Process** (acceptance criterion was unclear → Polaris's gap)
   - **Skill** (agent lacks context → adjust assignment pattern)
   - **Quality bar gap** (this document didn't cover the case → update this document)
4. **Fourth+ attempt** is a Polaris → Peat escalation. The slice is probably the wrong shape.

---

## How this file evolves

- Algol proposes additions via handoff to Polaris when a pattern of failures emerges that the current bar doesn't catch
- Betelgeuse and Vega propose additions to F-, V-, and pattern items
- Canopus proposes when a new automated check warrants a documented criterion
- Polaris owns the file. All changes route through Polaris.

This file is never relaxed silently. A documented bar item is removed only via postmortem-grade reasoning, also written into this document's revision log.

---

*end of QUALITY-BAR.md*
